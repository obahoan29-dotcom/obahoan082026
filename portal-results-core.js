// =========================================================
// FILE: portal-results-core.js (BẢN TÍCH HỢP TÍNH NĂNG THU ÉP BUỘC ĐƠN LẺ & TOÀN BỘ)
// =========================================================

let currentExamResultData = {
    item: null, title: "", examCode: "", categoryId: "them-11", rawRows: []
};

let autoRefreshTimer = null;
let isAutoRefreshEnabled = true;
let scoreChartInstance = null;
const _examResultsCache = {};
let _regradeFileParsedAnswers = null;
let currentRankSortMode = 'default';

let realtimeSubmissionsChannel = null;
let realtimeDebounceTimer = null;

function debouncedRefreshResults(delayMs = 350) {
    if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
    realtimeDebounceTimer = setTimeout(() => {
        if (currentExamResultData.item) {
            fetchAndRenderExamResults(currentExamResultData.item, true);
        }
    }, delayMs);
}

function cleanSbdStandard(sbd) {
    if (!sbd) return "";
    return String(sbd).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSbdVariations(sbd) {
    if (!sbd) return [];
    const raw = cleanSbdStandard(sbd);
    const setVars = new Set([raw]);
    const m = raw.match(/^([a-z]+|\d+[a-z]+)0*(\d+)$/i);
    if (m) {
        const prefix = m[1].toLowerCase();
        const num = parseInt(m[2], 10);
        setVars.add(`${prefix}${num}`);
        setVars.add(`${prefix}${String(num).padStart(2, '0')}`);
    }
    const mNum = raw.match(/^(\d+)$/);
    if (mNum) {
        const num = parseInt(mNum[1], 10);
        setVars.add(String(num));
        setVars.add(String(num).padStart(2, '0'));
    }
    return Array.from(setVars);
}

function isSbdMatchedFlexibly(sbd1, sbd2) {
    if (!sbd1 || !sbd2) return false;
    const v1 = getSbdVariations(sbd1);
    const v2 = getSbdVariations(sbd2);
    return v1.some(x => v2.includes(x));
}

function sortDataString(str) {
    if (!str) return "";
    let parts = str.split(/\s*\|\s*/);
    parts.sort((a, b) => {
        let isTabA = a.toLowerCase().includes("tab switch");
        let isTabB = b.toLowerCase().includes("tab switch");
        if (isTabA && !isTabB) return 1;
        if (!isTabA && isTabB) return -1;
        return a.localeCompare(b);
    });
    return parts.join(" | ");
}

function extractTabCountFromDataString(dataStr) {
    if (!dataStr) return 0;
    let m = dataStr.match(/tab\s*switch\s*:\s*(\d+)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
}

function deduplicateAttempts(attempts) {
    if (!attempts || attempts.length <= 1) return attempts || [];
    let unique = [];
    attempts.forEach(sub => {
        let subTime = getSubmissionTimestamp(sub);
        let subScore = (sub.score10 !== undefined) ? String(sub.score10) : "";
        let isDup = unique.some(existing => {
            let exTime = getSubmissionTimestamp(existing);
            let exScore = (existing.score10 !== undefined) ? String(existing.score10) : "";
            return (subTime > 0 && exTime > 0 && Math.abs(subTime - exTime) < 30000 && subScore === exScore);
        });
        if (!isDup) unique.push(sub);
    });
    return unique;
}

function getSubmissionTimestamp(sub) {
    if (!sub) return 0;
    if (sub.createdAt) return sub.createdAt;
    if (sub.created_at) return new Date(sub.created_at).getTime();
    return (typeof parseDateString === 'function' ? parseDateString(sub.timestamp) : 0) || 0;
}

function stopRealtimeSubmissionsListener() {
    if (realtimeDebounceTimer) {
        clearTimeout(realtimeDebounceTimer);
        realtimeDebounceTimer = null;
    }
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (realtimeSubmissionsChannel && client) {
        try { client.removeChannel(realtimeSubmissionsChannel); } catch(e) {}
        realtimeSubmissionsChannel = null;
    }
}

function startRealtimeSubmissionsListener(quizId) {
    stopRealtimeSubmissionsListener();
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return;

    const currentItem = currentExamResultData.item;
    const targetQuizId = quizId || (currentItem ? (extractQuizIdFromItem(currentItem) || currentItem.id) : "");
    if (!targetQuizId) return;

    const candidateIds = new Set();
    if (targetQuizId) candidateIds.add(String(targetQuizId).trim());
    if (currentItem) {
        if (currentItem.id) candidateIds.add(String(currentItem.id).trim());
        if (currentItem.firebaseId) candidateIds.add(String(currentItem.firebaseId).trim());
        if (currentItem.title && typeof cleanExamCodeKey === 'function') {
            candidateIds.add(cleanExamCodeKey(currentItem.title));
        }
    }

    try {
        let channel = client.channel(`admin_realtime_${targetQuizId}_${Date.now()}`);

        candidateIds.forEach(id => {
            channel = channel.on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'submissions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(200));

            channel = channel.on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    const oldStartTime = payload.old ? payload.old.start_time : null;
                    const newStartTime = payload.new ? payload.new.start_time : null;
                    if (oldStartTime && newStartTime && oldStartTime === newStartTime) {
                        return;
                    }
                }
                debouncedRefreshResults(200);
            });
        });

        channel = channel.on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'live_drafts' 
        }, () => debouncedRefreshResults(200));

        channel.subscribe();
        realtimeSubmissionsChannel = channel;
    } catch(e) {
        console.warn("Lỗi gắn Supabase Realtime:", e);
    }
}

async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item) return;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) {
        console.error("Lỗi: Không tìm thấy Supabase Client");
        return;
    }

    let quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(item) : null) || item.id || item.quizId || item.firebaseId || "";
    let maDe = item.made || item.maDe || "";
    let examTitle = item.title || "";
    let quizObj = null;

    if (quizId) {
        try {
            const { data: qData } = await client.from('quizzes').select('*').eq('id', quizId).single();
            if (qData) {
                quizObj = qData;
                if (!maDe && qData.made) maDe = qData.made;
                if (!examTitle && qData.title) examTitle = qData.title;
            }
        } catch(e) {}
    }

    if (!isSilent) {
        const tbody = document.getElementById("result-table-tbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; font-weight:700; color:#0284c7;">⏳ Đang tải dữ liệu từ máy chủ Supabase...</td></tr>`;
    }

    try {
        let candidateCodes = [];
        if (typeof getExamCandidateCodes === 'function') {
            candidateCodes = getExamCandidateCodes(examTitle, maDe, quizId);
        }
        if (quizId && !candidateCodes.includes(String(quizId).trim())) {
            candidateCodes.push(String(quizId).trim());
        }

        let [subRes, cheatRes, activeRes, draftRes] = await Promise.all([
            client.from('submissions').select('*').in('quiz_id', candidateCodes),
            client.from('cheating_logs').select('*').in('quiz_id', candidateCodes),
            client.from('active_sessions').select('*'),
            client.from('live_drafts').select('*')
        ]);

        let rawSubsData = subRes.data || [];
        let allActiveData = activeRes.data || [];
        let allDraftsData = draftRes.data || [];
        let cheatData = cheatRes.data || [];

        const candSet = new Set(candidateCodes.map(c => String(c).trim().toLowerCase()));
        const cleanTitleNorm = normalizeName(examTitle);

        let activeData = allActiveData.filter(a => {
            if (!a) return false;
            const qMatch = a.quiz_id && candSet.has(String(a.quiz_id).trim().toLowerCase());
            const titleMatch = cleanTitleNorm && a.exam_title && normalizeName(a.exam_title).includes(cleanTitleNorm);
            return qMatch || titleMatch;
        });

        let draftsData = allDraftsData.filter(d => {
            if (!d) return false;
            const qMatch = d.quiz_id && candSet.has(String(d.quiz_id).trim().toLowerCase());
            const titleMatch = cleanTitleNorm && d.exam_title && normalizeName(d.exam_title).includes(cleanTitleNorm);
            return qMatch || titleMatch;
        });

        if (rawSubsData.length === 0 && examTitle && examTitle.trim() !== "") {
            const { data: extraSubs } = await client.from('submissions').select('*').ilike('exam_title', `%${examTitle.trim()}%`);
            if (extraSubs && extraSubs.length > 0) {
                rawSubsData = extraSubs;
            }
        }

        const rawSubs = rawSubsData.map(r => ({
            id: r.id,
            quizId: r.quiz_id,
            sbd: r.sbd,
            studentName: r.student_name || r.name || "Thí sinh",
            studentClass: r.class_name || r.className || "---",
            score10: r.score10,
            rawScore: r.raw_score,
            correctCount: r.correct_count,
            wrongCount: r.wrong_count,
            completionTime: r.completion_time,
            spentMins: r.spent_mins,
            tabSwitchCount: r.tab_switch_count,
            dataString: r.data_string,
            userAnswers: r.user_answers,
            timestamp: typeof formatDateTimeFull === 'function' ? formatDateTimeFull(new Date(r.created_at).getTime()) : r.created_at,
            createdAt: new Date(r.created_at).getTime(),
            isFree: r.is_free,
            categoryId: r.category_id
        }));

        const cheatingLogsMap = {};
        cheatData.forEach(c => {
            cheatingLogsMap[c.id] = {
                sbd: c.sbd,
                studentName: c.student_name,
                durationStr: c.duration_str,
                switchCount: c.switch_count
            };
        });

        const activeSessionsMap = {};
        activeData.forEach(a => {
            if (!a || !a.sbd) return;
            const rawKey = String(a.sbd).trim().toLowerCase();
            const cleanKey = cleanSbdStandard(a.sbd);
            const sessObj = {
                sbd: a.sbd,
                name: a.name || a.student_name,
                className: a.class_name,
                startTime: a.start_time,
                lastPing: a.last_ping,
                isFree: a.is_free,
                categoryId: a.category_id,
                quizId: a.quiz_id,
                examTitle: a.exam_title
            };
            if (rawKey) activeSessionsMap[rawKey] = sessObj;
            if (cleanKey) activeSessionsMap[cleanKey] = sessObj;
        });

        const liveDraftsMap = {};
        draftsData.forEach(d => {
            if (!d || !d.sbd) return;
            const cleanKey = cleanSbdStandard(d.sbd);
            liveDraftsMap[cleanKey] = {
                sbd: d.sbd,
                name: d.student_name,
                className: d.class_name,
                userAnswers: d.user_answers || {},
                lastUpdated: d.last_updated,
                categoryId: d.category_id,
                quizId: d.quiz_id,
                examTitle: d.exam_title
            };
        });

        const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
        const examMeta = { quizId, maDe, examTitle, quizObj };

        _examResultsCache[`${targetCatId}_${quizId}`] = {
            submissionsListRaw: rawSubs,
            cheatingLogsData: cheatingLogsMap,
            activeSessionsData: activeSessionsMap,
            liveDraftsData: liveDraftsMap,
            examMeta: examMeta
        };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsMap, activeSessionsMap, liveDraftsMap, item, examMeta);

        const searchInput = document.getElementById("result-search-input");
        if (searchInput && searchInput.value.trim() !== "") filterResultTable();

    } catch(err) {
        console.error("❌ Lỗi nạp bảng điểm Supabase:", err);
        const tbody = document.getElementById("result-table-tbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; font-weight:700; color:#dc2626;">❌ Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

function renderExamResultTable(categoryId, submissionsListRaw, cheatingMap, activeSessionsMap, liveDraftsMap, examItem, examMeta = {}) {
    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];

    const cheatHistoryBySbd = {};
    const maxCheatCountBySbd = {};

    for (let k in cheatingMap) {
        let log = cheatingMap[k];
        if (!log) continue;
        let sbdKey = cleanSbdStandard(log.sbd);
        let dur = String(log.durationStr || "").trim();
        if (!dur || dur.toLowerCase() === "bắt đầu") continue;

        let shortDur = dur.replace(/phút/g, 'p').replace(/giây/g, 's').replace(/\s+/g, '');
        let sCount = parseInt(log.switchCount, 10) || 0;

        if (sbdKey && sbdKey !== "---") {
            if (!cheatHistoryBySbd[sbdKey]) cheatHistoryBySbd[sbdKey] = [];
            cheatHistoryBySbd[sbdKey].push(shortDur);
            maxCheatCountBySbd[sbdKey] = Math.max(maxCheatCountBySbd[sbdKey] || 0, sCount);
        }
    }

    let submissionsList = [];
    for (let sub of (Array.isArray(submissionsListRaw) ? submissionsListRaw : [])) {
        if (!sub) continue;
        if (sub.dataString) sub.dataString = sortDataString(sub.dataString);
        submissionsList.push(sub);
    }
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    const activeUsersMap = {};
    const nowMs = Date.now();

    for (let rawKey in activeSessionsMap) {
        let sess = activeSessionsMap[rawKey];
        if (!sess) continue;
        let lastPing = sess.lastPing || sess.startTime || 0;
        if ((nowMs - lastPing) < 600000 || (nowMs - sess.startTime) < 5400000) {
            let sbdClean = cleanSbdStandard(sess.sbd);
            let sbdLower = String(sess.sbd || "").trim().toLowerCase();
            if (sbdClean) activeUsersMap[sbdClean] = sess;
            if (sbdLower) activeUsersMap[sbdLower] = sess;
        }
    }

    for (let rawKey in liveDraftsMap) {
        let draft = liveDraftsMap[rawKey];
        if (!draft) continue;
        let sbdClean = cleanSbdStandard(draft.sbd);
        let sbdLower = String(draft.sbd || "").trim().toLowerCase();
        if (!activeUsersMap[sbdClean]) {
            const draftTime = draft.lastUpdated ? new Date(draft.lastUpdated).getTime() : nowMs;
            const draftSess = {
                sbd: draft.sbd,
                name: draft.name,
                className: draft.className,
                startTime: draftTime,
                lastPing: draftTime,
                isFree: false
            };
            if (sbdClean) activeUsersMap[sbdClean] = draftSess;
            if (sbdLower) activeUsersMap[sbdLower] = draftSess;
        }
    }

    const finalRows = [];
    const usedPendingKeys = new Set();
    const usedSubIds = new Set();

    classAccounts.forEach((acc, idx) => {
        const accSbdLower = String(acc.sbd || "").trim().toLowerCase();
        const accSbdClean = cleanSbdStandard(acc.sbd);
        const accNameNorm = typeof normalizeName === 'function' ? normalizeName(acc.name) : acc.name.toLowerCase();

        let matchedSubs = [];
        for (let sub of submissionsList) {
            let isSbdMatch = isSbdMatchedFlexibly(acc.sbd, sub.sbd || sub.studentId);
            let subNameNorm = typeof normalizeName === 'function' ? normalizeName(sub.studentName || sub.name) : "";
            let isNameMatch = (accNameNorm && subNameNorm && accNameNorm === subNameNorm);

            if (isSbdMatch || isNameMatch) {
                matchedSubs.push(sub);
                usedSubIds.add(sub.id);
            }
        }

        matchedSubs = deduplicateAttempts(matchedSubs);

        let isDoing = false;
        let doingStartTime = null;

        let activeSess = activeUsersMap[accSbdLower] || activeUsersMap[accSbdClean];
        if (!activeSess) {
            for (let k in activeUsersMap) {
                if (isSbdMatchedFlexibly(acc.sbd, k)) {
                    activeSess = activeUsersMap[k];
                    break;
                }
            }
        }

        if (activeSess) {
            const sessTime = Number(activeSess.lastPing || activeSess.startTime || 0);

            if (matchedSubs.length === 0) {
                isDoing = true;
                doingStartTime = activeSess.startTime || sessTime || nowMs;
                usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
            } else {
                const latestSubTime = getSubmissionTimestamp(matchedSubs[matchedSubs.length - 1]);
                if (sessTime > (latestSubTime + 3000) || (nowMs - sessTime) < 1800000) {
                    isDoing = true;
                    doingStartTime = activeSess.startTime || sessTime || nowMs;
                    usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                }
            }
        }

        let cheatDurations = cheatHistoryBySbd[accSbdClean] || cheatHistoryBySbd[accSbdLower] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdClean] || maxCheatCountBySbd[accSbdLower] || cheatDurations.length;
        let cheatTimeString = cheatDurations.length > 0 ? cheatDurations.join(" | ") : "0s";
        let selectedAttemptIndex = matchedSubs.length > 0 ? (matchedSubs.length - 1) : 0;

        finalRows.push({
            _rowUid: 'row_cls_' + (acc.sbd || idx) + '_' + Math.random().toString(36).substring(2, 7),
            stt: acc.stt || (idx + 1),
            isClassStudent: true,
            account: acc,
            allAttempts: matchedSubs,
            selectedAttemptIndex: selectedAttemptIndex,
            isDoing: isDoing,
            doingStartTime: doingStartTime,
            isFreeDoing: false,
            cheatTimeString: cheatTimeString,
            cheatLogsTabCount: cheatLogsTabCount
        });
    });

    let freeSttCounter = classAccounts.length + 1;

    for (let sessKey in activeUsersMap) {
        let sess = activeUsersMap[sessKey];
        if (!sess) continue;
        let cleanKey = cleanSbdStandard(sess.sbd || sessKey);

        if (usedPendingKeys.has(cleanKey)) continue;
        if (classAccounts.some(acc => isSbdMatchedFlexibly(acc.sbd, sess.sbd || sessKey))) continue;

        if (typeof isSbdBelongsToCategory === 'function') {
            if (!isSbdBelongsToCategory(sess.sbd || sessKey, categoryId)) continue;
        }

        usedPendingKeys.add(cleanKey);

        const freeAcc = {
            sbd: sess.sbd || "---",
            name: sess.name || "Thí sinh tự do",
            className: sess.className || "Tự do"
        };

        finalRows.push({
            _rowUid: 'row_free_doing_' + cleanKey + '_' + Math.random().toString(36).substring(2, 7),
            stt: freeSttCounter++,
            isClassStudent: false,
            account: freeAcc,
            allAttempts: [],
            selectedAttemptIndex: 0,
            isDoing: true,
            doingStartTime: sess.startTime || nowMs,
            isFreeDoing: true,
            cheatTimeString: "0s",
            cheatLogsTabCount: 0
        });
    }

    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const rawSbd = sub.sbd || sub.studentId || "free";

        if (classAccounts.some(acc => isSbdMatchedFlexibly(acc.sbd, rawSbd))) continue;
        if (typeof isSbdBelongsToCategory === 'function') {
            if (!isSbdBelongsToCategory(rawSbd, categoryId)) continue;
        }

        const freeAcc = {
            sbd: sub.sbd || "---",
            name: sub.studentName || "Thí sinh tự do",
            className: sub.studentClass || "Tự do"
        };

        finalRows.push({
            _rowUid: 'row_free_' + sub.id + '_' + Math.random().toString(36).substring(2, 7),
            stt: freeSttCounter++,
            isClassStudent: false,
            account: freeAcc,
            allAttempts: [sub],
            selectedAttemptIndex: 0,
            isDoing: false,
            doingStartTime: null,
            isFreeDoing: false,
            cheatTimeString: "0s",
            cheatLogsTabCount: 0
        });
    }

    if (typeof calculateRanksForRows === 'function') calculateRanksForRows(finalRows);
    currentExamResultData.rawRows = finalRows;
    if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(finalRows);
}

// =========================================================================
// BỘ MÁY THU ÉP BUỘC ĐƠN LẺ VÀ THU ÉP TOÀN BỘ CHUẨN XÁC 100%
// =========================================================================

async function forceSubmitSingleStudent(rowUid, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const row = currentExamResultData.rawRows.find(r => r._rowUid === rowUid);
    if (!row) return;

    const acc = row.account;
    const sbd = acc.sbd || "---";
    const name = acc.name || "Học sinh";
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

    if (!currentItem || !client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : null) || currentItem.id;
    if (!quizId) { alert("⚠️ Không tìm thấy ID đề thi!"); return; }

    if (!confirm(`⚡ XÁC NHẬN THU BÀI ÉP BUỘC:\n\nBạn có chắc muốn THU ÉP BÀI cho học sinh:\n"${name}" (SBD: ${sbd}) ngay lập tức không?\n\n- Nếu học sinh đang mở web thi: Web sẽ tự động dừng và nộp bài ngay.\n- Nếu học sinh đã thoát ngang (treo): Hệ thống sẽ tự chấm điểm từ bản nháp và chốt điểm chính thức.`)) return;

    try {
        const cleanSbd = cleanSbdStandard(sbd);

        // 1. Gửi tín hiệu Realtime ép nộp bài cho thiết bị học sinh (nếu học sinh đang online)
        try {
            const forceChannel = client.channel(`exam_force_submit_${quizId}`);
            await forceChannel.send({
                type: 'broadcast',
                event: 'FORCE_SUBMIT',
                payload: { quizId: quizId, sbd: cleanSbd, targetSbd: sbd }
            });
        } catch(sigErr) {}

        // 2. Kiểm tra bản nháp live_drafts hoặc active_sessions để chốt bài trên máy chủ
        const [draftRes, quizRes, activeRes] = await Promise.all([
            client.from('live_drafts').select('*').match({ quiz_id: quizId, sbd: cleanSbd }).single(),
            client.from('quizzes').select('*').eq('id', quizId).single(),
            client.from('active_sessions').select('*').match({ quiz_id: quizId, sbd: cleanSbd }).single()
        ]);

        const quizObj = quizRes.data;
        if (!quizObj) throw new Error("Không tìm thấy cấu trúc đề thi trên máy chủ!");

        const userAnswers = (draftRes.data && draftRes.data.user_answers) ? draftRes.data.user_answers : {};
        const cat = row.account.className || currentExamResultData.categoryId || "them-11";

        const answerVault = {};
        const letters = ["A", "B", "C", "D"];
        (quizObj.questions || []).forEach(q => {
            if (q.type === "multiple_choice" && q.correct !== undefined) {
                answerVault[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
            } else if (q.type === "true_false" && q.statements) {
                q.statements.forEach(st => {
                    answerVault[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                });
            } else if (q.correctAnswer !== undefined) {
                answerVault[`q${q.id}`] = String(q.correctAnswer).trim();
            }
        });

        const scoringConfig = quizObj.scoring_config || { mode: "option1" };
        const scoreResult = calculateExamScoreWithConfig(quizObj.questions, userAnswers, answerVault, scoringConfig);
        const submissionId = `${quizId}_${cleanSbd}`;

        // 3. Chèn vào bảng submissions bài nộp chính thức
        await client.from('submissions').upsert({
            id: submissionId,
            quiz_id: quizId,
            sbd: sbd,
            student_name: name,
            class_name: acc.className || "Lớp",
            score10: scoreResult.finalScore,
            raw_score: scoreResult.totalRawScore,
            max_scale: scoreResult.maxScale,
            correct_count: scoreResult.correctCount,
            wrong_count: scoreResult.wrongCount,
            completion_time: "Thu ép buộc",
            spent_mins: quizObj.time_limit_minutes || 90,
            tab_switch_count: "0 lần",
            data_string: scoreResult.dataDetails.join(" | ") + " | [THU ÉP BUỘC BỞI GIÁO VIÊN]",
            user_answers: userAnswers,
            category_id: cat,
            is_free: !row.isClassStudent,
            ma_de: quizObj.made || "101",
            exam_title: quizObj.title || "Đề thi",
            created_at: new Date().toISOString()
        }, { onConflict: 'id' });

        // 4. Xóa sạch phiên treo khỏi live_drafts và active_sessions
        await Promise.all([
            client.from('live_drafts').delete().match({ quiz_id: quizId, sbd: cleanSbd }),
            client.from('active_sessions').delete().match({ quiz_id: quizId, sbd: cleanSbd })
        ]);

        alert(`✅ ĐÃ THU ÉP BÀI THÀNH CÔNG!\n\n- Thí sinh: ${name} (SBD: ${sbd})\n- Điểm số: ${scoreResult.finalScore} / ${scoreResult.maxScale} điểm.`);
        await refreshCurrentExamResults();
    } catch(err) {
        alert("❌ Lỗi khi thu ép bài: " + err.message);
    }
}

async function forceSubmitAllDoingStudents(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const doingRows = currentExamResultData.rawRows.filter(r => r.isDoing);
    if (doingRows.length === 0) {
        alert("ℹ️ Hiện không có học sinh nào đang làm bài thi để thu ép!");
        return;
    }

    if (!confirm(`⚡ CẢNH BÁO THU ÉP TOÀN BỘ:\n\nBạn có chắc muốn THU ÉP BÀI của TẤT CẢ ${doingRows.length} thí sinh đang làm bài thi không?\n\n- Các thiết bị học sinh đang thi sẽ lập tức nộp bài.\n- Các em bị treo máy/thoát ngang sẽ được hệ thống chấm điểm và chốt sổ ngay.`)) return;

    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!currentItem || !client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : null) || currentItem.id;
    if (!quizId) return;

    try {
        // Gửi lệnh Broadcast thu toàn bộ phòng
        try {
            const forceChannel = client.channel(`exam_force_submit_${quizId}`);
            await forceChannel.send({
                type: 'broadcast',
                event: 'FORCE_SUBMIT',
                payload: { quizId: quizId, sbd: "ALL" }
            });
        } catch(sigErr) {}

        // Tự động thu từng em qua hàm triggerAutoCollectDrafts
        if (typeof triggerAutoCollectDrafts === 'function') {
            await triggerAutoCollectDrafts();
        } else {
            await refreshCurrentExamResults();
        }
    } catch(err) {
        alert("❌ Lỗi thu ép bài toàn bộ: " + err.message);
    }
}

async function triggerAutoCollectDrafts(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!currentItem || !client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : null) || currentItem.id;
    if (!quizId) { alert("⚠️ Không tìm thấy ID đề thi!"); return; }

    const btn = document.getElementById("btn-auto-collect-drafts");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang quét thu bài..."; }

    try {
        const [draftsRes, quizRes, subsRes, activeRes] = await Promise.all([
            client.from('live_drafts').select('*').eq('quiz_id', quizId),
            client.from('quizzes').select('*').eq('id', quizId).single(),
            client.from('submissions').select('sbd').eq('quiz_id', quizId),
            client.from('active_sessions').select('*').eq('quiz_id', quizId)
        ]);

        const drafts = draftsRes.data || [];
        const activeList = activeRes.data || [];
        const quizObj = quizRes.data;
        if (!quizObj) throw new Error("Không tìm thấy dữ liệu đề thi trên máy chủ!");

        const submittedSbds = new Set((subsRes.data || []).map(s => cleanSbdStandard(s.sbd)));
        const pendingToCollect = new Map();

        drafts.forEach(d => {
            const key = cleanSbdStandard(d.sbd);
            if (!submittedSbds.has(key)) {
                pendingToCollect.set(key, {
                    sbd: d.sbd || key,
                    name: d.student_name || "Học sinh",
                    className: d.class_name || "Lớp",
                    userAnswers: d.user_answers || {},
                    cat: d.category_id || (typeof detectCategoryFromSbd === 'function' ? detectCategoryFromSbd(d.sbd) : "them-11")
                });
            }
        });

        activeList.forEach(a => {
            const key = cleanSbdStandard(a.sbd);
            if (!submittedSbds.has(key) && !pendingToCollect.has(key)) {
                pendingToCollect.set(key, {
                    sbd: a.sbd || key,
                    name: a.name || a.student_name || "Học sinh",
                    className: a.class_name || "Lớp",
                    userAnswers: {},
                    cat: a.category_id || (typeof detectCategoryFromSbd === 'function' ? detectCategoryFromSbd(a.sbd) : "them-11")
                });
            }
        });

        if (pendingToCollect.size === 0) {
            alert("ℹ️ Tất cả các em đã nộp bài, không còn bài nháp nào cần thu!");
            return;
        }

        const answerVault = {};
        const letters = ["A", "B", "C", "D"];
        (quizObj.questions || []).forEach(q => {
            if (q.type === "multiple_choice" && q.correct !== undefined) {
                answerVault[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
            } else if (q.type === "true_false" && q.statements) {
                q.statements.forEach(st => {
                    answerVault[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                });
            } else if (q.correctAnswer !== undefined) {
                answerVault[`q${q.id}`] = String(q.correctAnswer).trim();
            }
        });

        const scoringConfig = quizObj.scoring_config || { mode: "option1" };
        let collectedCount = 0;

        for (const [key, student] of pendingToCollect.entries()) {
            const scoreResult = calculateExamScoreWithConfig(quizObj.questions, student.userAnswers, answerVault, scoringConfig);
            const submissionId = `${quizId}_${student.sbd}`;

            await client.from('submissions').upsert({
                id: submissionId,
                quiz_id: quizId,
                sbd: student.sbd,
                student_name: student.name,
                class_name: student.className,
                score10: scoreResult.finalScore,
                raw_score: scoreResult.totalRawScore,
                max_scale: scoreResult.maxScale,
                correct_count: scoreResult.correctCount,
                wrong_count: scoreResult.wrongCount,
                completion_time: "Thu tự động",
                spent_mins: quizObj.time_limit_minutes || 90,
                tab_switch_count: "0 lần",
                data_string: scoreResult.dataDetails.join(" | ") + " | [THU TỰ ĐỘNG TỪ MÁY CHỦ]",
                user_answers: student.userAnswers,
                category_id: student.cat,
                is_free: false,
                ma_de: quizObj.made || "101",
                exam_title: quizObj.title || "Đề thi",
                created_at: new Date().toISOString()
            }, { onConflict: 'id' });

            await client.from('live_drafts').delete().match({ quiz_id: quizId, sbd: student.sbd });
            await client.from('active_sessions').delete().match({ quiz_id: quizId, sbd: student.sbd });

            collectedCount++;
        }

        alert(`🎉 THU BÀI THÀNH CÔNG!\nĐã thu bài và tính điểm cho ${collectedCount} học sinh.`);
        await refreshCurrentExamResults();
    } catch(err) {
        alert("❌ Lỗi thu bài tự động: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "⚡ Thu bài tự động"; }
    }
}

window.forceSubmitSingleStudent = forceSubmitSingleStudent;
window.forceSubmitAllDoingStudents = forceSubmitAllDoingStudents;
window.triggerAutoCollectDrafts = triggerAutoCollectDrafts;
window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;
window.fetchAndRenderExamResults = fetchAndRenderExamResults;
window.renderExamResultTable = renderExamResultTable;
