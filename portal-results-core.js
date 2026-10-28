// =========================================================
// FILE: portal-results-core.js (BẢN TỐI ƯU HÓA TRUY VẤN SUPABASE ĐA TẦNG 100%)
// KHẮC PHỤC TRIỆT ĐỂ: LỆCH QUIZ_ID, LỆCH CHUYÊN MỤC, KHÔNG BỊ RỖNG BẢNG ĐIỂM
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

function debouncedRefreshResults(delayMs = 300) {
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

// Chuẩn hóa SBD: loại bỏ mọi khoảng trắng, dấu gạch dưới, gạch ngang, đưa về chữ thường
function cleanSbdStandard(sbd) {
    if (!sbd) return "";
    return String(sbd).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
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

    try {
        let channel = client.channel(`admin_realtime_board_${Date.now()}`);
        channel = channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => debouncedRefreshResults(200))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_drafts' }, () => debouncedRefreshResults(200))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, () => debouncedRefreshResults(200));

        channel.subscribe();
        realtimeSubmissionsChannel = channel;
    } catch(e) {
        console.warn("Lỗi gắn Supabase Realtime:", e);
    }
}

// BỘ TRUY VẤN SUPABASE ĐA TẦNG: TÌM BẰNG MỌI KHÓA KHẢ DĨ (ID, TITLE, MADE, URL)
async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item) return;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return;

    let quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(item) : null) || item.id || item.quizId || item.firebaseId || "";
    let maDe = item.made || item.maDe || "";
    let examTitle = item.title || "";
    let quizObj = null;

    // 1. Thử lấy thông tin đề thi trong bảng quizzes
    if (quizId) {
        try {
            const { data: qData } = await client.from('quizzes').select('*').eq('id', quizId).maybeSingle();
            if (qData) {
                quizObj = qData;
                if (!maDe && qData.made) maDe = qData.made;
                if (!examTitle && qData.title) examTitle = qData.title;
            }
        } catch(e) {}
    }

    // 2. Gom tất cả các mã định danh có thể có
    const candidateIdsSet = new Set();
    if (quizId) candidateIdsSet.add(String(quizId).trim());
    if (item.id) candidateIdsSet.add(String(item.id).trim());
    if (item.firebaseId) candidateIdsSet.add(String(item.firebaseId).trim());
    if (maDe) candidateIdsSet.add(String(maDe).trim());

    if (typeof cleanExamCodeKey === 'function') {
        if (maDe) candidateIdsSet.add(cleanExamCodeKey(maDe));
        if (examTitle) candidateIdsSet.add(cleanExamCodeKey(examTitle));
        if (item.title) candidateIdsSet.add(cleanExamCodeKey(item.title));
    }
    if (typeof getExamCandidateCodes === 'function') {
        const extraCodes = getExamCandidateCodes(examTitle || item.title, maDe, quizId);
        if (Array.isArray(extraCodes)) extraCodes.forEach(c => candidateIdsSet.add(String(c).trim()));
    }

    const candidateIds = Array.from(candidateIdsSet).filter(Boolean);

    try {
        // TẦNG 1: Truy vấn theo mảng candidateIds
        let [subRes, cheatRes, activeRes, draftRes] = await Promise.all([
            client.from('submissions').select('*').in('quiz_id', candidateIds),
            client.from('cheating_logs').select('*').in('quiz_id', candidateIds),
            client.from('active_sessions').select('*').in('quiz_id', candidateIds),
            client.from('live_drafts').select('*').in('quiz_id', candidateIds)
        ]);

        let rawSubsData = subRes.data || [];
        let cheatData = cheatRes.data || [];
        let activeData = activeRes.data || [];
        let draftsData = draftRes.data || [];

        // TẦNG 2 (CỨU CÁNH): Nếu tìm theo ID mà submissions chưa có, tự động quét theo tên đề thi (exam_title)
        if (rawSubsData.length === 0 && examTitle) {
            try {
                const { data: fallbackSubs } = await client.from('submissions').select('*').ilike('exam_title', `%${examTitle.trim()}%`);
                if (Array.isArray(fallbackSubs) && fallbackSubs.length > 0) {
                    rawSubsData = fallbackSubs;
                }
            } catch(e) {}
        }

        // TẦNG 2 cho active_sessions: Quét theo exam_title nếu chưa thấy ai đang thi
        if (activeData.length === 0 && examTitle) {
            try {
                const { data: fallbackActive } = await client.from('active_sessions').select('*').ilike('exam_title', `%${examTitle.trim()}%`);
                if (Array.isArray(fallbackActive) && fallbackActive.length > 0) {
                    activeData = fallbackActive;
                }
            } catch(e) {}
        }

        // TẦNG 2 cho live_drafts: Quét theo exam_title
        if (draftsData.length === 0 && examTitle) {
            try {
                const { data: fallbackDrafts } = await client.from('live_drafts').select('*').ilike('exam_title', `%${examTitle.trim()}%`);
                if (Array.isArray(fallbackDrafts) && fallbackDrafts.length > 0) {
                    draftsData = fallbackDrafts;
                }
            } catch(e) {}
        }

        // TẦNG 3: Nếu mã đề (made) tồn tại mà vẫn chưa có bài, quét thêm theo mã đề
        if (rawSubsData.length === 0 && maDe) {
            try {
                const { data: madeSubs } = await client.from('submissions').select('*').eq('ma_de', maDe.trim());
                if (Array.isArray(madeSubs) && madeSubs.length > 0) {
                    rawSubsData = madeSubs;
                }
            } catch(e) {}
        }

        // Chuẩn hóa danh sách bài nộp về format chung
        const rawSubs = rawSubsData.map(r => ({
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
            const key = cleanSbdStandard(a.sbd);
            activeSessionsMap[key] = {
                sbd: a.sbd,
                name: a.name || a.student_name,
                className: a.class_name,
                startTime: a.start_time,
                lastPing: a.last_ping,
                isFree: a.is_free,
                categoryId: a.category_id
            };
        });

        const liveDraftsMap = {};
        draftsData.forEach(d => {
            const key = cleanSbdStandard(d.sbd);
            liveDraftsMap[key] = {
                sbd: d.sbd,
                name: d.student_name,
                className: d.class_name,
                userAnswers: d.user_answers || {},
                lastUpdated: d.last_updated,
                categoryId: d.category_id
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

// BỘ GHÉP DỮ LIỆU THÔNG MINH: SO KHỚP CHÍNH XÁC DANH SÁCH LỚP VỚI SUPABASE
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

    // 2. Chuẩn bị danh sách bài nộp
    let submissionsList = [];
    for (let sub of (Array.isArray(submissionsListRaw) ? submissionsListRaw : [])) {
        if (!sub) continue;
        if (sub.dataString) sub.dataString = sortDataString(sub.dataString);
        submissionsList.push(sub);
    }
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    const submittedSbds = new Set(submissionsList.map(s => cleanSbdStandard(s.sbd || s.studentId)));

    // 3. Gom các học sinh ĐANG LÀM BÀI (từ active_sessions hoặc live_drafts)
    const inProgressUsersMap = {};
    const allPendingKeys = new Set([...Object.keys(activeSessionsMap), ...Object.keys(liveDraftsMap)]);

    allPendingKeys.forEach(sbdKey => {
        // Nếu học sinh đã có bài nộp thì không tính là đang làm nữa
        if (submittedSbds.has(sbdKey)) return;

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
            answeredCount: answeredCount,
            categoryId: sess.categoryId || draft.categoryId || ""
        };
    });

    const finalRows = [];
    const usedSbdSet = new Set();
    const usedSubIds = new Set();

    // 4. DUYỆT DANH SÁCH HỌC SINH CỦA LỚP ĐANG XEM (VD: 11A01 - 11A45)
    classAccounts.forEach((acc, idx) => {
        const accSbdClean = cleanSbdStandard(acc.sbd);
        const accNameNorm = typeof normalizeName === 'function' ? normalizeName(acc.name) : acc.name.toLowerCase().trim();

        let matchedSubs = [];
        for (let sub of submissionsList) {
            let subSbdClean = cleanSbdStandard(sub.sbd || sub.studentId);
            let subNameNorm = typeof normalizeName === 'function' ? normalizeName(sub.studentName || sub.name) : (sub.studentName || sub.name || "").toLowerCase().trim();

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

        // So khớp trạng thái ĐANG THI theo SBD sạch hoặc họ tên
        let activeSess = inProgressUsersMap[accSbdClean];
        if (!activeSess) {
            // Tìm dự phòng theo tên
            for (let k in inProgressUsersMap) {
                let progNameNorm = typeof normalizeName === 'function' ? normalizeName(inProgressUsersMap[k].name) : inProgressUsersMap[k].name.toLowerCase().trim();
                if (progNameNorm && progNameNorm === accNameNorm) {
                    activeSess = inProgressUsersMap[k];
                    break;
                }
            }
        }

        if (matchedSubs.length === 0 && activeSess) {
            isDoing = true; 
            doingStartTime = activeSess.startTime || Date.now();
            doingDraftInfo = activeSess;
        }

        if (matchedSubs.length > 0) {
            usedSbdSet.add(accSbdClean);
        }

        let cheatDurations = cheatHistoryBySbd[accSbdClean] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdClean] || cheatDurations.length;
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

    // 5. THÍ SINH TỰ DO ĐANG LÀM BÀI (Chỉ gom những em chưa có trong danh sách lớp)
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

    // 6. THÍ SINH TỰ DO ĐÃ NỘP BÀI (Những bài nộp không trùng SBD với lớp đang xem)
    const freeSubmissionsBySbd = {};
    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const rawSbd = sub.sbd || sub.studentId || "free";
        const sbdKey = cleanSbdStandard(rawSbd);

        const isBelongToClass = classAccounts.some(acc => cleanSbdStandard(acc.sbd) === sbdKey);
        if (isBelongToClass) continue;

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

// 7. BỘ THU BÀI TỰ ĐỘNG NÂNG CẤP TỪ LIVE DRAFTS
async function triggerAutoCollectDrafts(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!currentItem || !client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : null) || currentItem.id;
    if (!quizId) { alert("⚠️ Không tìm thấy ID đề thi!"); return; }

    if (!confirm("⚡ BẠN CÓ CHẮC MUỐN THU BÀI TỰ ĐỘNG?\nHệ thống sẽ tính điểm và nộp bài chính thức cho tất cả các em chưa kịp nộp.")) return;

    const btn = document.getElementById("btn-auto-collect-drafts");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang quét thu bài..."; }

    try {
        const [draftsRes, quizRes, subsRes, activeRes] = await Promise.all([
            client.from('live_drafts').select('*').eq('quiz_id', quizId),
            client.from('quizzes').select('*').eq('id', quizId).maybeSingle(),
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
            });

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
