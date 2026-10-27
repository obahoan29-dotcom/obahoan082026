// =========================================================
// FILE: portal-results-core.js (BẢN SUPABASE TỐI ƯU & QUÉT ĐA MÃ ĐỀ)
// CẬP NHẬT: FIX LỖI MẤT TÊN KHI NỘP BÀI, HIỂN THỊ ĐỦ THÍ SINH TỰ DO & THI THỬ
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

// Hàm gom nhóm cập nhật thông minh: cập nhật tức thì nhưng gộp request nếu nhiều em vào cùng lúc
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

function identifyOfficialStudentCategory(sbd, name) {
    if (!window.STUDENT_ACCOUNTS) return null;
    const cleanSbd = String(sbd || "").trim().toLowerCase();
    const cleanName = typeof normalizeName === 'function' ? normalizeName(name) : String(name || "").trim().toLowerCase();

    if (cleanSbd && cleanSbd.length >= 3 && cleanSbd !== "---" && cleanSbd !== "free" && cleanSbd !== "chuanhap") {
        for (let catId in window.STUDENT_ACCOUNTS) {
            const list = window.STUDENT_ACCOUNTS[catId];
            if (!Array.isArray(list)) continue;
            if (list.some(acc => String(acc.sbd || "").trim().toLowerCase() === cleanSbd)) {
                return catId;
            }
        }
    }

    if (cleanName && cleanName.length >= 3) {
        for (let catId in window.STUDENT_ACCOUNTS) {
            const list = window.STUDENT_ACCOUNTS[catId];
            if (!Array.isArray(list)) continue;
            if (list.some(acc => (typeof normalizeName === 'function' ? normalizeName(acc.name) : String(acc.name || "").toLowerCase()) === cleanName)) {
                return catId;
            }
        }
    }
    return null;
}

// BỘ LỌC THÔNG MINH: GIỮ 100% BÀI NỘP HỢP LỆ, KHÔNG BAO GIỜ LÀM MẤT TÊN HỌC SINH TỰ DO HOẶC NICK THỬ NGHIỆM
function isSubmissionMatchingCategory(sub, targetCatId) {
    if (!sub) return false;
    if (!targetCatId) return true;

    const normTarget = normalizeCategoryKey(targetCatId);
    const subSbdClean = String(sub.sbd || sub.studentId || "").trim().toLowerCase();
    const subNameClean = String(sub.studentName || sub.student_name || sub.name || "").trim();
    const rawSubCat = normalizeCategoryKey(sub.categoryId || sub.category_id || sub.cat || "");
    const rawClass = normalizeCategoryKey(sub.studentClass || sub.class_name || "");

    // 1. Nếu thí sinh thuộc danh sách chính thức của lớp đang xem (theo SBD hoặc theo Họ tên) -> Luôn hiển thị
    const classAccounts = getAccountsForCategory(targetCatId);
    const isMatchingClass = classAccounts.some(acc => {
        const accSbd = String(acc.sbd || "").trim().toLowerCase();
        const accName = String(acc.name || "").trim();
        return (accSbd && accSbd === subSbdClean) || 
               (typeof normalizeName === 'function' && normalizeName(accName) === normalizeName(subNameClean));
    });
    if (isMatchingClass) return true;

    // 2. Nếu thí sinh thuộc danh sách chính thức của một lớp KHÁC -> Hiển thị bên lớp của họ
    const officialCat = identifyOfficialStudentCategory(sub.sbd || sub.studentId, sub.studentName || sub.name);
    if (officialCat) {
        return normalizeCategoryKey(officialCat) === normTarget;
    }

    // 3. Nếu bài nộp có category_id khớp với lớp đang xem -> Luôn giữ lại 100%
    if (rawSubCat && rawSubCat === normTarget) return true;

    // 4. Nếu thí sinh tự do nhập tên lớp khớp với lớp đang xem
    if (normTarget === "lop11a" && (rawClass.includes("11a") || subSbdClean.startsWith("11a"))) return true;
    if (normTarget === "lop11c" && (rawClass.includes("11c") || subSbdClean.startsWith("11c"))) return true;
    if (normTarget === "lop11e" && (rawClass.includes("11e") || subSbdClean.startsWith("11e"))) return true;
    if (normTarget === "lop10p" && (rawClass.includes("10p") || subSbdClean.startsWith("10p"))) return true;
    if ((normTarget === "hsgtoan11" || normTarget.includes("hsg")) && (rawClass.includes("hsg") || subSbdClean.startsWith("hsg"))) return true;

    // 5. Loại trừ nếu thí sinh rõ ràng thuộc lớp đặc thù khác
    const isExplicitlyOtherClass = 
        (normTarget !== "lop11a" && (rawClass.includes("11a") || subSbdClean.startsWith("11a")) && !subSbdClean.startsWith("hsg")) ||
        (normTarget !== "lop11c" && (rawClass.includes("11c") || subSbdClean.startsWith("11c"))) ||
        (normTarget !== "lop11e" && (rawClass.includes("11e") || subSbdClean.startsWith("11e"))) ||
        (normTarget !== "lop10p" && (rawClass.includes("10p") || subSbdClean.startsWith("10p"))) ||
        (!normTarget.includes("hsg") && (rawClass.includes("hsg") || subSbdClean.startsWith("hsg")));

    if (isExplicitlyOtherClass) return false;

    // 6. Thí sinh tự do, nick kiểm tra của giáo viên (Trying, Obahoan29...) nộp đề này -> GIỮ LẠI ĐẦY ĐỦ
    return true;
}

function getExamPossibleQuizIds(examItem, examMeta) {
    const ids = new Set();
    if (examMeta && examMeta.quizId) ids.add(String(examMeta.quizId).trim());
    if (examItem) {
        let extracted = extractQuizIdFromItem(examItem);
        if (extracted) ids.add(String(extracted).trim());
        if (examItem.id) ids.add(String(examItem.id).trim());
        if (examItem.firebaseId) ids.add(String(examItem.firebaseId).trim());
    }
    return Array.from(ids).filter(Boolean);
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
    return parseDateString(sub.timestamp) || 0;
}

// BỘ LẮNG NGHE REALTIME KẾT HỢP: TỰ ĐỘNG CẬP NHẬT TỨC THÌ 0S KHI CÓ EM NỘP BÀI
function startRealtimeSubmissionsListener(quizId) {
    stopRealtimeSubmissionsListener();
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    const currentItem = currentExamResultData.item;
    const targetQuizId = quizId || (currentItem ? (extractQuizIdFromItem(currentItem) || currentItem.id) : "");
    if (!targetQuizId) return;

    // Tập hợp toàn bộ ID khả dĩ của đề thi này
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
        // 1. Lắng nghe bài thi nộp thành công (submissions)
        channel = channel.on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'submissions', 
            filter: `quiz_id=eq.${id}` 
        }, () => {
            debouncedRefreshResults(200);
        });

        // 2. Lắng nghe học sinh VÀO THI hoặc THOÁT THI (active_sessions)
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

    channel.subscribe();
    realtimeSubmissionsChannel = channel;
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

// TẢI KẾT QUẢ TỪ SUPABASE
async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item) return;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    let quizId = extractQuizIdFromItem(item) || item.id || "";
    let maDe = "";
    let examTitle = item.title || "";

    try {
        const { data: qData } = await client.from('quizzes').select('made, title').eq('id', quizId).single();
        if (qData) {
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
        const [subRes, cheatRes, activeRes] = await Promise.all([
            client.from('submissions').select('*').in('quiz_id', candidateIds),
            client.from('cheating_logs').select('*').in('quiz_id', candidateIds),
            client.from('active_sessions').select('*').in('quiz_id', candidateIds)
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
            timestamp: formatDateTimeFull(new Date(r.created_at).getTime()),
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
            activeSessionsMap[a.sbd] = {
                sbd: a.sbd,
                name: a.name,
                className: a.class_name,
                startTime: a.start_time,
                lastPing: a.last_ping,
                isFree: a.is_free
            };
        });

        const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
        const examMeta = { quizId, maDe, examTitle };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsMap, activeSessionsMap, item, examMeta);

        const searchInput = document.getElementById("result-search-input");
        if (searchInput && searchInput.value.trim() !== "") filterResultTable();

    } catch(err) {
        console.error("Lỗi nạp bảng điểm Supabase:", err);
    }
}

function renderExamResultTable(categoryId, submissionsListRaw, cheatingMap, activeSessionsMap, examItem, examMeta = {}) {
    const classAccounts = getAccountsForCategory(categoryId);
    const targetCatId = String(categoryId || "").trim();

    const cheatHistoryBySbd = {};
    const maxCheatCountBySbd = {};

    for (let k in cheatingMap) {
        let log = cheatingMap[k];
        if (!log) continue;
        let sbdKey = String(log.sbd || "").trim().toLowerCase();
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
        if (!isSubmissionMatchingCategory(sub, targetCatId)) continue;
        if (sub.dataString) sub.dataString = sortDataString(sub.dataString);
        submissionsList.push(sub);
    }
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    // Tập hợp SBD của tất cả thí sinh đã nộp bài thành công
    const submittedSbds = new Set(submissionsList.map(s => String(s.sbd || "").trim().toLowerCase()));

    const activeUsersMap = {};
    const nowMs = Date.now();
    for (let rawKey in activeSessionsMap) {
        let sess = activeSessionsMap[rawKey];
        if (!sess) continue;
        let lastPing = sess.lastPing || sess.startTime || 0;
        let sessSbd = String(sess.sbd || "").trim().toLowerCase();
        let cleanSbdKey = sessSbd.replace(/[^a-zA-Z0-9]/g, '_');

        // Nếu thí sinh đã nộp bài rồi thì không coi là đang làm dở
        if (submittedSbds.has(sessSbd) || submittedSbds.has(cleanSbdKey)) continue;

        if (nowMs - lastPing < 360000) {
            if (sessSbd) activeUsersMap[sessSbd] = sess;
            if (cleanSbdKey) activeUsersMap[cleanSbdKey] = sess;
        }
    }

    const finalRows = [];
    const usedSbdSet = new Set();
    const usedSubIds = new Set();

    // 1. DUYỆT DANH SÁCH THÍ SINH THEO LỚP
    classAccounts.forEach((acc, idx) => {
        const accSbdLower = String(acc.sbd || "").trim().toLowerCase();
        const accSbdClean = accSbdLower.replace(/[^a-zA-Z0-9]/g, '_');
        const accNameNorm = typeof normalizeName === 'function' ? normalizeName(acc.name) : acc.name.toLowerCase();

        let matchedSubs = [];
        for (let sub of submissionsList) {
            let subSbd = String(sub.sbd || sub.studentId || "").trim().toLowerCase();
            let subSbdClean = subSbd.replace(/[^a-zA-Z0-9]/g, '_');
            let subNameNorm = typeof normalizeName === 'function' ? normalizeName(sub.studentName || sub.name) : "";

            // Khớp chính xác theo SBD HOẶC theo Họ tên
            let isSbdMatch = (accSbdLower && subSbd && (subSbd === accSbdLower || subSbdClean === accSbdClean));
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
        if (matchedSubs.length === 0 && activeSess) {
            isDoing = true; 
            doingStartTime = activeSess.startTime || Date.now();
        }

        if (matchedSubs.length > 0) usedSbdSet.add(accSbdLower);

        let cheatDurations = cheatHistoryBySbd[accSbdLower] || cheatHistoryBySbd[accSbdClean] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdLower] || maxCheatCountBySbd[accSbdClean] || cheatDurations.length;
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

    // 2. THÍ SINH TỰ DO ĐANG LÀM BÀI (CHƯA NỘP)
    for (let sessKey in activeUsersMap) {
        let sess = activeUsersMap[sessKey];
        if (!sess) continue;
        let sessSbdLower = String(sess.sbd || "").trim().toLowerCase();
        let sessSbdClean = sessSbdLower.replace(/[^a-zA-Z0-9]/g, '_');

        if (usedSbdSet.has(sessSbdLower) || usedSbdSet.has(sessSbdClean)) continue;
        if (classAccounts.some(acc => {
            const accSbd = String(acc.sbd || "").trim().toLowerCase();
            return accSbd === sessSbdLower || accSbd.replace(/[^a-zA-Z0-9]/g, '_') === sessSbdClean;
        })) continue;

        usedSbdSet.add(sessSbdLower);
        usedSbdSet.add(sessSbdClean);

        const freeAcc = {
            sbd: sess.sbd || "---",
            name: sess.name || "Thí sinh tự do",
            className: sess.className || "Tự do"
        };
        finalRows.push({
            _rowUid: 'row_free_doing_' + (sess.sbd || freeSttCounter) + '_' + Math.random().toString(36).substring(2, 7),
            stt: freeSttCounter++, 
            isClassStudent: false, 
            account: freeAcc, 
            allAttempts: [],
            selectedAttemptIndex: 0, 
            isDoing: true, 
            doingStartTime: sess.startTime || Date.now(),
            isFreeDoing: true, 
            cheatTimeString: "0s", 
            cheatLogsTabCount: 0
        });
    }

    // 3. THÍ SINH TỰ DO / NICK TEST ĐÃ NỘP BÀI (GOM NHÓM THEO SBD ĐỂ HIỂN THỊ ĐỦ ĐIỂM SỐ & TÊN)
    const freeSubmissionsBySbd = {};
    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const sbdKey = String(sub.sbd || sub.studentId || "free").trim().toLowerCase();
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
            isFreeDoing: false, 
            cheatTimeString: "0s", 
            cheatLogsTabCount: 0
        });
    }

    if (typeof calculateRanksForRows === 'function') calculateRanksForRows(finalRows);
    currentExamResultData.rawRows = finalRows;
    if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(finalRows);
}

// THU BÀI TỰ ĐỘNG TỪ BẢN NHÁP SUPABASE
async function triggerAutoCollectDrafts(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!currentItem || !client) return;

    const quizId = extractQuizIdFromItem(currentItem);
    if (!quizId) { alert("⚠️ Không tìm thấy ID đề thi!"); return; }

    if (!confirm("⚡ BẠN CÓ CHẮC MUỐN THU BÀI TỰ ĐỘNG?\nHệ thống sẽ tính điểm và nộp bài chính thức cho các em chưa kịp nộp.")) return;

    const btn = document.getElementById("btn-auto-collect-drafts");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang thu..."; }

    try {
        const [draftsRes, quizRes, subsRes] = await Promise.all([
            client.from('live_drafts').select('*').eq('quiz_id', quizId),
            client.from('quizzes').select('*').eq('id', quizId).single(),
            client.from('submissions').select('sbd').eq('quiz_id', quizId)
        ]);

        const drafts = draftsRes.data || [];
        const quizObj = quizRes.data;
        const submittedSbds = new Set((subsRes.data || []).map(s => s.sbd));

        if (drafts.length === 0) {
            alert("ℹ️ Hiện không có bản nháp nào cần thu!");
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

        for (const draft of drafts) {
            if (submittedSbds.has(draft.sbd)) continue;

            const scoreResult = calculateExamScoreWithConfig(quizObj.questions, draft.user_answers, answerVault, scoringConfig);
            const submissionId = `${quizId}_${draft.sbd}`;

            await client.from('submissions').upsert({
                id: submissionId,
                quiz_id: quizId,
                sbd: draft.sbd,
                student_name: draft.student_name || "Học sinh",
                class_name: draft.class_name || "Lớp học",
                score10: scoreResult.finalScore,
                raw_score: scoreResult.totalRawScore,
                max_scale: scoreResult.maxScale,
                correct_count: scoreResult.correctCount,
                wrong_count: scoreResult.wrongCount,
                completion_time: "Thu tự động",
                spent_mins: quizObj.time_limit_minutes || 90,
                tab_switch_count: "0 lần",
                data_string: scoreResult.dataDetails.join(" | ") + " | [THU TỰ ĐỘNG TỪ BẢN NHÁP]",
                user_answers: draft.user_answers,
                category_id: draft.category_id || "them-11",
                is_free: false,
                ma_de: quizObj.made || "101",
                exam_title: quizObj.title || "Đề thi"
            });

            await client.from('live_drafts').delete().match({ quiz_id: quizId, sbd: draft.sbd });
            collectedCount++;
        }

        alert(`🎉 THU BÀI THÀNH CÔNG!\nĐã thu bài và tính điểm cho ${collectedCount} học sinh.`);
        await refreshCurrentExamResults();
    } catch(err) {
        alert("❌ Lỗi: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "⚡ Thu bài tự động"; }
    }
}

window.triggerAutoCollectDrafts = triggerAutoCollectDrafts;
window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;
