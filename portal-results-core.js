// =========================================================
// FILE: portal-results-core.js (BẢN FIX TRIỆT ĐỂ ĐA LẦN THI & THU ÉP TỨC THÌ 0S)
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
    const raw = String(sbd).trim();
    const clean = cleanSbdStandard(raw);
    const setVars = new Set([raw, raw.toLowerCase(), raw.toUpperCase(), clean]);
    const m = clean.match(/^([a-z]+|\d+[a-z]+)0*(\d+)$/i);
    if (m) {
        const prefix = m[1].toLowerCase();
        const num = parseInt(m[2], 10);
        setVars.add(`${prefix}${num}`);
        setVars.add(`${prefix}${String(num).padStart(2, '0')}`);
        setVars.add(`${prefix.toUpperCase()}${String(num).padStart(2, '0')}`);
    }
    const mNum = clean.match(/^(\d+)$/);
    if (mNum) {
        const num = parseInt(mNum[1], 10);
        setVars.add(String(num));
        setVars.add(String(num).padStart(2, '0'));
    }
    return Array.from(setVars).filter(Boolean);
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
    let quizObj = item.quizObj || null;

    if (quizId && !quizObj) {
        try {
            const { data: qData } = await client.from('quizzes').select('*').eq('id', quizId).maybeSingle();
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
            const rawKey = String(a.sbd).trim();
            const cleanKey = cleanSbdStandard(a.sbd);
            const sessObj = {
                id: a.id,
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
                id: d.id,
                sbd: d.sbd,
                name: d.student_name,
                className: d.class_name,
                userAnswers: d.user_answers || {},
                score10: d.score10,
                correctCount: d.correct_count,
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
    // SẮP XẾP TẤT CẢ BÀI NỘP THEO THỜI GIAN: CŨ NHẤT XẾP TRƯỚC (LẦN 1), MỚI NHẤT XẾP SAU
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    const activeUsersMap = {};
    const nowMs = Date.now();

    for (let rawKey in activeSessionsMap) {
        let sess = activeSessionsMap[rawKey];
        if (!sess) continue;
        let sbdClean = cleanSbdStandard(sess.sbd);
        let sbdRaw = String(sess.sbd || "").trim();
        if (sbdClean) activeUsersMap[sbdClean] = sess;
        if (sbdRaw) activeUsersMap[sbdRaw] = sess;
    }

    for (let rawKey in liveDraftsMap) {
        let draft = liveDraftsMap[rawKey];
        if (!draft) continue;
        let sbdClean = cleanSbdStandard(draft.sbd);
        let sbdRaw = String(draft.sbd || "").trim();
        if (!activeUsersMap[sbdClean]) {
            const draftTime = draft.lastUpdated ? new Date(draft.lastUpdated).getTime() : nowMs;
            const draftSess = {
                id: draft.id,
                sbd: draft.sbd,
                name: draft.name,
                className: draft.className,
                startTime: draftTime,
                lastPing: draftTime,
                isFree: false
            };
            if (sbdClean) activeUsersMap[sbdClean] = draftSess;
            if (sbdRaw) activeUsersMap[sbdRaw] = draftSess;
        }
    }

    const finalRows = [];
    const usedPendingKeys = new Set();
    const usedSubIds = new Set();

    // 1. DUYỆT HỌC SINH THEO DANH SÁCH LỚP CHÍNH THỨC
    classAccounts.forEach((acc, idx) => {
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

        let activeSess = activeUsersMap[accSbdClean] || activeUsersMap[acc.sbd];
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

        let cheatDurations = cheatHistoryBySbd[accSbdClean] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdClean] || cheatDurations.length;
        let cheatTimeString = cheatDurations.length > 0 ? cheatDurations.join(" | ") : "0s";
        
        // MẶC ĐỊNH LẤY LẦN NỘP MỚI NHẤT (CUỐI DANH SÁCH)
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

    // 2. THÍ SINH TỰ DO ĐANG THI (ACTIVE SESSION)
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

    // 3. THÍ SINH TỰ DO ĐÃ NỘP BÀI (GOM TẤT CẢ CÁC LẦN THI CỦA BẠN ĐÓ VÀO CÙNG 1 DÒNG)
    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const rawSbd = sub.sbd || sub.studentId || "free";

        if (classAccounts.some(acc => isSbdMatchedFlexibly(acc.sbd, rawSbd))) continue;
        if (typeof isSbdBelongsToCategory === 'function') {
            if (!isSbdBelongsToCategory(rawSbd, categoryId)) continue;
        }

        let freeMatchedSubs = [];
        for (let otherSub of submissionsList) {
            if (usedSubIds.has(otherSub.id)) continue;
            let isSbdMatch = isSbdMatchedFlexibly(rawSbd, otherSub.sbd || otherSub.studentId);
            let isNameMatch = (sub.studentName && otherSub.studentName && normalizeName(sub.studentName) === normalizeName(otherSub.studentName));
            if (isSbdMatch || isNameMatch) {
                freeMatchedSubs.push(otherSub);
                usedSubIds.add(otherSub.id);
            }
        }
        freeMatchedSubs = deduplicateAttempts(freeMatchedSubs);

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
            allAttempts: freeMatchedSubs,
            selectedAttemptIndex: freeMatchedSubs.length > 0 ? (freeMatchedSubs.length - 1) : 0,
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

// BỘ HỖ TRỢ LẤY CẤU TRÚC ĐỀ THI AN TOÀN
async function getQuizObjectSafely(client, candidateCodes) {
    if (typeof examData !== 'undefined' && examData && Array.isArray(examData.questions) && examData.questions.length > 0) {
        return examData;
    }
    for (let k in _examResultsCache) {
        const cachedQ = _examResultsCache[k]?.examMeta?.quizObj;
        if (cachedQ && Array.isArray(cachedQ.questions) && cachedQ.questions.length > 0) {
            return cachedQ;
        }
    }
    if (currentExamResultData.item?.quizObj && Array.isArray(currentExamResultData.item.quizObj.questions)) {
        return currentExamResultData.item.quizObj;
    }
    if (client && candidateCodes && candidateCodes.length > 0) {
        try {
            const { data: qList } = await client.from('quizzes').select('*').in('id', candidateCodes);
            if (qList && qList.length > 0) return qList[0];
        } catch(e) {}
    }
    return null;
}

// BỘ MÁY THU ÉP BUỘC ĐƠN LẺ (TẠO ID MỚI THEO GIỜ, BẢO TỒN CÁC LẦN NỘP TRƯỚC)
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
    const examTitle = currentItem.title || "Đề thi";
    const maDe = currentItem.made || "101";

    if (!confirm(`⚡ XÁC NHẬN THU BÀI ÉP BUỘC:\n\nThu bài ngay lập tức cho học sinh:\n"${name}" (SBD: ${sbd})?\n\n- Trái tim đang thi sẽ lập tức ngừng đập và chốt điểm số chính thức.\n- Thiết bị của học sinh (nếu đang mở) sẽ tự động nộp bài ngay.`)) return;

    const btn = event?.target;
    if (btn && btn.tagName === 'BUTTON') {
        btn.disabled = true;
        btn.innerText = "⏳...";
    }

    try {
        let candidateCodes = [];
        if (typeof getExamCandidateCodes === 'function') {
            candidateCodes = getExamCandidateCodes(examTitle, maDe, quizId);
        }
        if (quizId && !candidateCodes.includes(String(quizId).trim())) {
            candidateCodes.push(String(quizId).trim());
        }

        const sbdVariations = getSbdVariations(sbd);
        const cleanSbd = cleanSbdStandard(sbd);

        try {
            const forceChannel = client.channel(`exam_force_submit_${quizId}`);
            await forceChannel.send({
                type: 'broadcast',
                event: 'FORCE_SUBMIT',
                payload: { quizId: quizId, sbd: cleanSbd, targetSbd: sbd }
            });
        } catch(sigErr) {}

        let draftItem = null;
        try {
            const { data: drafts } = await client.from('live_drafts')
                .select('*')
                .in('quiz_id', candidateCodes)
                .in('sbd', sbdVariations);
            if (drafts && drafts.length > 0) draftItem = drafts[0];
        } catch(e) {}

        let finalScore10 = 0;
        let finalRawScore = 0;
        let finalMaxScale = 10.0;
        let finalCorrectCount = 0;
        let finalWrongCount = 0;
        let finalDataString = "[THU ÉP BUỘC BỞI GIÁO VIÊN]";
        let finalUserAnswers = draftItem?.user_answers || {};

        const quizObj = await getQuizObjectSafely(client, candidateCodes);

        if (quizObj && Array.isArray(quizObj.questions) && quizObj.questions.length > 0 && Object.keys(finalUserAnswers).length > 0) {
            const answerVault = {};
            const letters = ["A", "B", "C", "D"];
            quizObj.questions.forEach(q => {
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
            const scoreResult = calculateExamScoreWithConfig(quizObj.questions, finalUserAnswers, answerVault, scoringConfig);
            finalScore10 = scoreResult.finalScore;
            finalRawScore = scoreResult.totalRawScore;
            finalMaxScale = scoreResult.maxScale;
            finalCorrectCount = scoreResult.correctCount;
            finalWrongCount = scoreResult.wrongCount;
            finalDataString = scoreResult.dataDetails.join(" | ") + " | [THU ÉP TỪ BẢN NHÁP]";
        } else if (row.allAttempts && row.allAttempts.length > 0) {
            const lastSub = row.allAttempts[row.allAttempts.length - 1];
            finalScore10 = lastSub.score10 ?? 0;
            finalRawScore = lastSub.rawScore ?? 0;
            finalCorrectCount = lastSub.correctCount ?? 0;
            finalWrongCount = lastSub.wrongCount ?? 0;
            finalDataString = lastSub.dataString || "[BẢO LƯU KẾT QUẢ ĐÃ NỘP]";
            finalUserAnswers = lastSub.userAnswers || {};
        }

        const nowMs = Date.now();
        // ID MỚI KÈM MỐC THỜI GIAN -> KHÔNG BAO GIỜ BỊ ĐÈ LẦN TRƯỚC
        const cleanSubmissionId = `${quizId}_${cleanSbd}_${nowMs}`;

        const newSubObj = {
            id: cleanSubmissionId,
            quizId: quizId,
            quiz_id: quizId,
            sbd: sbd,
            studentName: name,
            student_name: name,
            studentClass: acc.className || "Lớp",
            class_name: acc.className || "Lớp",
            score10: finalScore10,
            rawScore: finalRawScore,
            raw_score: finalRawScore,
            maxScale: finalMaxScale,
            max_scale: finalMaxScale,
            correctCount: finalCorrectCount,
            correct_count: finalCorrectCount,
            wrongCount: finalWrongCount,
            wrong_count: finalWrongCount,
            completionTime: "Thu ép buộc",
            completion_time: "Thu ép buộc",
            spentMins: 90,
            spent_mins: 90,
            tabSwitchCount: `${row.cheatLogsTabCount || 0} lần`,
            tab_switch_count: `${row.cheatLogsTabCount || 0} lần`,
            dataString: finalDataString,
            data_string: finalDataString,
            userAnswers: finalUserAnswers,
            user_answers: finalUserAnswers,
            category_id: currentExamResultData.categoryId || "them-11",
            isFree: !row.isClassStudent,
            is_free: !row.isClassStudent,
            maDe: maDe,
            ma_de: maDe,
            examTitle: examTitle,
            exam_title: examTitle,
            timestamp: typeof formatDateTimeFull === 'function' ? formatDateTimeFull(nowMs) : new Date().toLocaleString("vi-VN"),
            created_at: new Date(nowMs).toISOString(),
            createdAt: nowMs
        };

        row.isDoing = false;
        row.doingStartTime = null;
        if (!row.allAttempts) row.allAttempts = [];
        row.allAttempts.push(newSubObj);
        row.selectedAttemptIndex = row.allAttempts.length - 1;

        for (let k in _examResultsCache) {
            const cache = _examResultsCache[k];
            if (cache?.activeSessionsData) {
                sbdVariations.forEach(sv => delete cache.activeSessionsData[sv]);
            }
            if (cache?.liveDraftsData) {
                sbdVariations.forEach(sv => delete cache.liveDraftsData[sv]);
            }
        }

        calculateRanksForRows(currentExamResultData.rawRows);
        updateStatsAndRenderTable(currentExamResultData.rawRows);

        await client.from('submissions').insert([newSubObj]);

        await Promise.all([
            client.from('active_sessions').delete().in('sbd', sbdVariations),
            client.from('live_drafts').delete().in('sbd', sbdVariations)
        ]);

        const extraDocIds = [];
        candidateCodes.forEach(c => {
            sbdVariations.forEach(sv => extraDocIds.push(`${c}_${sv}`));
        });
        if (extraDocIds.length > 0) {
            await Promise.all([
                client.from('active_sessions').delete().in('id', extraDocIds),
                client.from('live_drafts').delete().in('id', extraDocIds)
            ]);
        }

        alert(`✅ ĐÃ THU ÉP BÀI THÀNH CÔNG!\n\n- Thí sinh: ${name} (SBD: ${sbd})\n- Điểm chốt lần này: ${finalScore10} điểm\n- Tổng số lần nộp: ${row.allAttempts.length} lần.`);

    } catch(err) {
        console.error("Lỗi thu ép:", err);
        alert("❌ Lỗi khi thu ép bài: " + err.message);
    } finally {
        if (btn && btn.tagName === 'BUTTON') {
            btn.disabled = false;
            btn.innerText = "⚡ Thu ép";
        }
    }
}

async function forceSubmitAllDoingStudents(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const doingRows = currentExamResultData.rawRows.filter(r => r.isDoing);
    if (doingRows.length === 0) {
        alert("ℹ️ Hiện không có học sinh nào đang làm bài thi để thu ép!");
        return;
    }

    if (!confirm(`⚡ CẢNH BÁO THU ÉP TOÀN BỘ:\n\nBạn có chắc muốn THU ÉP BÀI của TẤT CẢ ${doingRows.length} thí sinh đang thi không?\n\n- Toàn bộ trái tim đang thi sẽ lập tức ngừng đập.\n- Điểm số và xếp hạng của tất cả học sinh sẽ hiện ra ngay lập tức.`)) return;

    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!currentItem || !client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : null) || currentItem.id;
    const examTitle = currentItem.title || "Đề thi";
    const maDe = currentItem.made || "101";

    try {
        const forceChannel = client.channel(`exam_force_submit_${quizId}`);
        await forceChannel.send({
            type: 'broadcast',
            event: 'FORCE_SUBMIT',
            payload: { quizId: quizId, sbd: "ALL" }
        });
    } catch(sigErr) {}

    doingRows.forEach(row => {
        row.isDoing = false;
        row.doingStartTime = null;
        if (row.allAttempts && row.allAttempts.length > 0) {
            row.selectedAttemptIndex = row.allAttempts.length - 1;
        }
    });

    calculateRanksForRows(currentExamResultData.rawRows);
    updateStatsAndRenderTable(currentExamResultData.rawRows);

    await triggerAutoCollectDrafts(null, true);
}

async function triggerAutoCollectDrafts(event, isSilentMode = false) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!currentItem || !client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : null) || currentItem.id;
    const examTitle = currentItem.title || "Đề thi";
    const maDe = currentItem.made || "101";

    const btn = document.getElementById("btn-auto-collect-drafts");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang quét thu bài..."; }

    try {
        let candidateCodes = [];
        if (typeof getExamCandidateCodes === 'function') {
            candidateCodes = getExamCandidateCodes(examTitle, maDe, quizId);
        }
        if (quizId && !candidateCodes.includes(String(quizId).trim())) {
            candidateCodes.push(String(quizId).trim());
        }

        const [draftsRes, activeRes, allQuizzesRes] = await Promise.all([
            client.from('live_drafts').select('*').in('quiz_id', candidateCodes),
            client.from('active_sessions').select('*').in('quiz_id', candidateCodes),
            client.from('quizzes').select('*').in('id', candidateCodes)
        ]);

        const drafts = draftsRes.data || [];
        const activeList = activeRes.data || [];
        const quizObj = (allQuizzesRes.data && allQuizzesRes.data.length > 0) ? allQuizzesRes.data[0] : await getQuizObjectSafely(client, candidateCodes);

        const doingRows = currentExamResultData.rawRows.filter(r => r.isDoing);

        if (drafts.length === 0 && activeList.length === 0 && doingRows.length === 0) {
            if (!isSilentMode) alert("ℹ️ Hiện không có học sinh nào đang làm bài thi để thu ép!");
            return;
        }

        const answerVault = {};
        const letters = ["A", "B", "C", "D"];
        if (quizObj && Array.isArray(quizObj.questions)) {
            quizObj.questions.forEach(q => {
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
        }
        const scoringConfig = quizObj?.scoring_config || { mode: "option1" };

        let collectedCount = 0;
        const allTargetSbds = new Set();
        const nowMs = Date.now();

        for (const row of doingRows) {
            const acc = row.account;
            const sbd = acc.sbd || "---";
            const cleanSbd = cleanSbdStandard(sbd);
            allTargetSbds.add(sbd);
            allTargetSbds.add(cleanSbd);

            const draft = drafts.find(d => cleanSbdStandard(d.sbd) === cleanSbd);
            let uAnswers = draft?.user_answers || {};

            let sc10 = 0; let rawSc = 0; let maxSc = 10.0; let cCount = 0; let wCount = 0;
            let dString = "[THU TỰ ĐỘNG BỞI GIÁO VIÊN]";

            if (quizObj && Array.isArray(quizObj.questions) && Object.keys(uAnswers).length > 0) {
                const scoreRes = calculateExamScoreWithConfig(quizObj.questions, uAnswers, answerVault, scoringConfig);
                sc10 = scoreRes.finalScore;
                rawSc = scoreRes.totalRawScore;
                maxSc = scoreRes.maxScale;
                cCount = scoreRes.correctCount;
                wCount = scoreRes.wrongCount;
                dString = scoreRes.dataDetails.join(" | ") + " | [THU TỰ ĐỘNG TỪ BẢN NHÁP]";
            } else if (row.allAttempts && row.allAttempts.length > 0) {
                const lastA = row.allAttempts[row.allAttempts.length - 1];
                sc10 = lastA.score10 ?? 0;
                rawSc = lastA.rawScore ?? 0;
                cCount = lastA.correctCount ?? 0;
                wCount = lastA.wrongCount ?? 0;
                dString = lastA.dataString || "[BẢO LƯU LẦN THI TRƯỚC]";
                uAnswers = lastA.userAnswers || {};
            }

            const cleanSubId = `${quizId}_${cleanSbd}_${nowMs}`;
            await client.from('submissions').insert([{
                id: cleanSubId,
                quiz_id: quizId,
                sbd: sbd,
                student_name: acc.name || "Học sinh",
                class_name: acc.className || "Lớp",
                score10: sc10,
                raw_score: rawSc,
                max_scale: maxSc,
                correct_count: cCount,
                wrong_count: wCount,
                completion_time: "Thu tự động",
                spent_mins: 90,
                tab_switch_count: `${row.cheatLogsTabCount || 0} lần`,
                data_string: dString,
                user_answers: uAnswers,
                category_id: currentExamResultData.categoryId || "them-11",
                is_free: !row.isClassStudent,
                ma_de: maDe,
                exam_title: examTitle,
                created_at: new Date(nowMs).toISOString()
            }]);

            collectedCount++;
        }

        if (allTargetSbds.size > 0) {
            const arrSbds = Array.from(allTargetSbds);
            await Promise.all([
                client.from('active_sessions').delete().in('sbd', arrSbds),
                client.from('live_drafts').delete().in('sbd', arrSbds)
            ]);
        }

        await fetchAndRenderExamResults(currentItem, true);

        if (!isSilentMode) {
            alert(`🎉 THU BÀI THÀNH CÔNG!\nĐã thu bài và chốt điểm chính thức cho ${collectedCount} học sinh.`);
        }
    } catch(err) {
        console.error("Lỗi thu bài tự động:", err);
        if (!isSilentMode) alert("❌ Lỗi thu bài tự động: " + err.message);
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
