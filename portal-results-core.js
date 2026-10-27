// =========================================================
// FILE: portal-results-core.js (BẢN TỐI ƯU TOÀN DIỆN CHỐNG MẤT BÀI & THU TỰ ĐỘNG)
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

function normalizeCategoryKey(cat) {
    if (!cat) return "";
    return String(cat).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanSbdStandard(sbd) {
    return String(sbd || "").trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
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
    if (sub.created_at) return new Date(sub.created_at).getTime();
    if (typeof sub.createdAt === 'number') return sub.createdAt;
    return (typeof parseDateString === 'function' ? parseDateString(sub.timestamp) : 0) || 0;
}

function stopRealtimeSubmissionsListener() {
    if (realtimeDebounceTimer) {
        clearTimeout(realtimeDebounceTimer);
        realtimeDebounceTimer = null;
    }
    if (realtimeSubmissionsChannel && supabaseClient) {
        supabaseClient.removeChannel(realtimeSubmissionsChannel);
        realtimeSubmissionsChannel = null;
    }
}

function startRealtimeSubmissionsListener(quizId) {
    stopRealtimeSubmissionsListener();
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
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

    let channel = client.channel(`admin_realtime_${targetQuizId}_${Date.now()}`);

    candidateIds.forEach(id => {
        channel = channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `quiz_id=eq.${id}` }, () => debouncedRefreshResults(200))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_drafts', filter: `quiz_id=eq.${id}` }, () => debouncedRefreshResults(250))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions', filter: `quiz_id=eq.${id}` }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    const oldStartTime = payload.old ? payload.old.start_time : null;
                    const newStartTime = payload.new ? payload.new.start_time : null;
                    if (oldStartTime && newStartTime && oldStartTime === newStartTime) return;
                }
                debouncedRefreshResults(200);
            });
    });

    channel.subscribe();
    realtimeSubmissionsChannel = channel;
}

// BỘ TRUY VẤN VÀ ĐỒNG BỘ KẾT QUẢ TỪ 4 BẢNG SUPABASE
async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item) return;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    let quizId = extractQuizIdFromItem(item) || item.id || "";
    let maDe = "";
    let examTitle = item.title || "";
    let quizObj = null;

    try {
        const { data: qData } = await client.from('quizzes').select('*').eq('id', quizId).single();
        if (qData) {
            quizObj = qData;
            maDe = qData.made || "";
            if (qData.title) examTitle = qData.title;
        }
    } catch(e) {}

    const candidateCodes = (typeof getExamCandidateCodes === 'function') 
        ? getExamCandidateCodes(examTitle || item.title, maDe, quizId)
        : [];

    const candidateIds = Array.from(new Set([
        quizId,
        item.id,
        item.firebaseId,
        cleanExamCodeKey(maDe),
        cleanExamCodeKey(examTitle),
        cleanExamCodeKey(item.title),
        ...candidateCodes
    ].filter(Boolean)));

    try {
        // TRUY VẤN ĐỦ 4 BẢNG: submissions, live_drafts, active_sessions, cheating_logs
        const [subRes, cheatRes, activeRes, draftRes] = await Promise.all([
            client.from('submissions').select('*').in('quiz_id', candidateIds),
            client.from('cheating_logs').select('*').in('quiz_id', candidateIds),
            client.from('active_sessions').select('*').in('quiz_id', candidateIds),
            client.from('live_drafts').select('*').in('quiz_id', candidateIds)
        ]);

        const rawSubs = (subRes.data || []).map(r => ({
            ...r,
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
            createdAt: new Date(r.created_at).getTime()
        }));

        const cheatingLogsMap = {};
        (cheatRes.data || []).forEach(c => {
            cheatingLogsMap[c.id] = {
                sbd: c.sbd,
                studentName: c.student_name,
                durationStr: c.duration_str,
                switchCount: c.switch_count
            };
        });

        const activeSessionsMap = {};
        (activeRes.data || []).forEach(a => {
            const key = cleanSbdStandard(a.sbd);
            activeSessionsMap[key] = {
                sbd: a.sbd,
                name: a.name,
                className: a.class_name,
                startTime: a.start_time,
                lastPing: a.last_ping,
                isFree: a.is_free
            };
        });

        const liveDraftsMap = {};
        (draftRes.data || []).forEach(d => {
            const key = cleanSbdStandard(d.sbd);
            liveDraftsMap[key] = {
                sbd: d.sbd,
                name: d.student_name,
                className: d.class_name,
                userAnswers: d.user_answers || {},
                lastUpdated: d.last_updated
            };
        });

        const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
        const examMeta = { quizId, maDe, examTitle, quizObj };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsMap, activeSessionsMap, liveDraftsMap, item, examMeta);

        const searchInput = document.getElementById("result-search-input");
        if (searchInput && searchInput.value.trim() !== "") filterResultTable();

    } catch(err) {
        console.error("Lỗi nạp bảng điểm Supabase:", err);
    }
}

// BỘ DỰNG BẢNG THÔNG MINH: KHÔNG BAO GIỜ BỎ SÓT BÀI ĐANG LÀM HOẶC THÍ SINH TỰ DO
function renderExamResultTable(categoryId, submissionsListRaw, cheatingMap, activeSessionsMap, liveDraftsMap, examItem, examMeta = {}) {
    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];
    const targetCatId = String(categoryId || "").trim();

    // 1. Tổng hợp nhật ký chuyển tab
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

    // 2. TẬP HỢP TẤT CẢ BÀI NỘP CỦA ĐỀ THI NÀY
    let submissionsList = [];
    for (let sub of (Array.isArray(submissionsListRaw) ? submissionsListRaw : [])) {
        if (!sub) continue;
        if (sub.dataString) sub.dataString = sortDataString(sub.dataString);
        submissionsList.push(sub);
    }
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    const submittedSbds = new Set(submissionsList.map(s => cleanSbdStandard(s.sbd || s.studentId)));

    // 3. HỢP NHẤT TRẠNG THÁI "ĐANG LÀM BÀI" TỪ CẢ active_sessions VÀ live_drafts (GIẢI QUYẾT LỖI 1)
    const inProgressUsersMap = {};
    const allPendingKeys = new Set([...Object.keys(activeSessionsMap), ...Object.keys(liveDraftsMap)]);

    allPendingKeys.forEach(sbdKey => {
        if (submittedSbds.has(sbdKey)) return; // Đã nộp thì thôi

        const sess = activeSessionsMap[sbdKey] || {};
        const draft = liveDraftsMap[sbdKey] || {};

        const answeredCount = draft.userAnswers ? Object.keys(draft.userAnswers).length : 0;
        inProgressUsersMap[sbdKey] = {
            sbd: sess.sbd || draft.sbd || sbdKey,
            name: sess.name || draft.name || "Thí sinh",
            className: sess.className || draft.className || "Lớp",
            startTime: sess.startTime || (draft.lastUpdated ? new Date(draft.lastUpdated).getTime() : Date.now()),
            isFree: sess.isFree !== undefined ? sess.isFree : true,
            userAnswers: draft.userAnswers || {},
            answeredCount: answeredCount
        };
    });

    const finalRows = [];
    const usedSbdSet = new Set();
    const usedSubIds = new Set();

    // 4. DUYỆT DANH SÁCH THÍ SINH THEO LỚP
    classAccounts.forEach((acc, idx) => {
        const accSbdLower = String(acc.sbd || "").trim().toLowerCase();
        const accSbdClean = cleanSbdStandard(acc.sbd);
        const accNameNorm = typeof normalizeName === 'function' ? normalizeName(acc.name) : acc.name.toLowerCase();

        let matchedSubs = [];
        for (let sub of submissionsList) {
            let subSbdClean = cleanSbdStandard(sub.sbd || sub.studentId);
            let subNameNorm = typeof normalizeName === 'function' ? normalizeName(sub.studentName || sub.name) : "";

            let isSbdMatch = (accSbdClean && subSbdClean && (accSbdClean === subSbdClean));
            let isNameMatch = (accNameNorm && subNameNorm && accNameNorm === subNameNorm);

            if (isSbdMatch || isNameMatch) {
                matchedSubs.push(sub);
                usedSubIds.add(sub.id);
            }
        }

        matchedSubs = deduplicateAttempts(matchedSubs);

        let isDoing = false; 
        let doingStartTime = null;
        let doingDraftInfo = null;

        let activeSess = inProgressUsersMap[accSbdClean] || inProgressUsersMap[accSbdLower];
        if (matchedSubs.length === 0 && activeSess) {
            isDoing = true; 
            doingStartTime = activeSess.startTime || Date.now();
            doingDraftInfo = activeSess;
        }

        if (matchedSubs.length > 0) {
            usedSbdSet.add(accSbdClean);
            usedSbdSet.add(accSbdLower);
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
            doingDraftInfo: doingDraftInfo,
            isFreeDoing: false, 
            cheatTimeString: cheatTimeString, 
            cheatLogsTabCount: cheatLogsTabCount
        });
    });

    let freeSttCounter = classAccounts.length + 1;

    // 5. THÍ SINH TỰ DO ĐANG LÀM BÀI (ĐƯỢC BẢO LƯU TỪ IN_PROGRESS_USERS_MAP)
    for (let sbdKey in inProgressUsersMap) {
        if (usedSbdSet.has(sbdKey)) continue;
        const prog = inProgressUsersMap[sbdKey];

        const isBelongToClass = classAccounts.some(acc => cleanSbdStandard(acc.sbd) === sbdKey);
        if (isBelongToClass) continue;

        usedSbdSet.add(sbdKey);

        const freeAcc = {
            sbd: prog.sbd || "---",
            name: prog.name || "Thí sinh tự do",
            className: prog.className || "Tự do"
        };

        finalRows.push({
            _rowUid: 'row_free_doing_' + sbdKey + '_' + Math.random().toString(36).substring(2, 7),
            stt: freeSttCounter++, 
            isClassStudent: false, 
            account: freeAcc, 
            allAttempts: [],
            selectedAttemptIndex: 0, 
            isDoing: true, 
            doingStartTime: prog.startTime || Date.now(),
            doingDraftInfo: prog,
            isFreeDoing: true, 
            cheatTimeString: "0s", 
            cheatLogsTabCount: 0
        });
    }

    // 6. THÍ SINH TỰ DO ĐÃ NỘP BÀI (KHÔNG BAO GIỜ BỊ LỌC MẤT - GIẢI QUYẾT TRIỆT ĐỂ LỖI 3)
    const freeSubmissionsBySbd = {};
    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const sbdKey = cleanSbdStandard(sub.sbd || sub.studentId || "free");
        if (!freeSubmissionsBySbd[sbdKey]) freeSubmissionsBySbd[sbdKey] = [];
        freeSubmissionsBySbd[sbdKey].push(sub);
    }

    for (let sbdKey in freeSubmissionsBySbd) {
        let attempts = deduplicateAttempts(freeSubmissionsBySbd[sbdKey]);
        if (attempts.length === 0) continue;
        const latestSub = attempts[attempts.length - 1];

        const freeAcc = {
            sbd: latestSub.sbd || latestSub.studentId || "---",
            name: latestSub.studentName || latestSub.student_name || "Thí sinh tự do",
            className: latestSub.studentClass || latestSub.class_name || "Tự do"
        };

        finalRows.push({
            _rowUid: 'row_free_' + sbdKey + '_' + Math.random().toString(36).substring(2, 7),
            stt: freeSttCounter++, 
            isClassStudent: false, 
            account: freeAcc, 
            allAttempts: attempts,
            selectedAttemptIndex: attempts.length - 1, 
            isDoing: false, 
            doingStartTime: null,
            doingDraftInfo: null,
            isFreeDoing: false, 
            cheatTimeString: "0s", 
            cheatLogsTabCount: 0
        });
    }

    if (typeof calculateRanksForRows === 'function') calculateRanksForRows(finalRows);
    currentExamResultData.rawRows = finalRows;
    if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(finalRows);
}

// 7. BỘ THU BÀI TỰ ĐỘNG NÂNG CẤP (QUÉT CẢ LIVE_DRAFTS VÀ ACTIVE_SESSIONS)
async function triggerAutoCollectDrafts(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!currentItem || !client) return;

    const quizId = extractQuizIdFromItem(currentItem);
    if (!quizId) { alert("⚠️ Không tìm thấy ID đề thi!"); return; }

    if (!confirm("⚡ BẠN CÓ CHẮC MUỐN THU BÀI TỰ ĐỘNG?\nHệ thống sẽ tính điểm và nộp bài chính thức cho tất cả các em chưa kịp nộp.")) return;

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

        // Hợp nhất danh sách tất cả các em cần thu bài
        const pendingToCollect = new Map();

        // Nguồn 1: live_drafts
        drafts.forEach(d => {
            const key = cleanSbdStandard(d.sbd);
            if (!submittedSbds.has(key)) {
                pendingToCollect.set(key, {
                    sbd: d.sbd || key,
                    name: d.student_name || "Học sinh",
                    className: d.class_name || "Lớp",
                    userAnswers: d.user_answers || {},
                    cat: d.category_id || "them-11"
                });
            }
        });

        // Nguồn 2: active_sessions (Nếu học sinh vào thi mà bị gián đoạn trước khi chọn đáp án)
        activeList.forEach(a => {
            const key = cleanSbdStandard(a.sbd);
            if (!submittedSbds.has(key) && !pendingToCollect.has(key)) {
                pendingToCollect.set(key, {
                    sbd: a.sbd || key,
                    name: a.name || "Học sinh",
                    className: a.class_name || "Lớp",
                    userAnswers: {},
                    cat: a.category_id || "them-11"
                });
            }
        });

        if (pendingToCollect.size === 0) {
            alert("ℹ️ Tất cả các em đã nộp bài, không còn bài nháp nào cần thu!");
            return;
        }

        // Tạo bảng đáp án chuẩn từ đề gốc
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
            });

            // Xóa dọn dẹp nháp và session sau khi đã thu bài thành công
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

window.triggerAutoCollectDrafts = triggerAutoCollectDrafts;
window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;
window.fetchAndRenderExamResults = fetchAndRenderExamResults;
window.renderExamResultTable = renderExamResultTable;
