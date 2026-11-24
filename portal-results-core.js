// =========================================================
// FILE: portal-results-core.js 
// (BẢN TỐI ƯU BĂNG THÔNG 95% + ĐỒNG BỘ 100%: REALTIME IN-MEMORY PING,
//  LỌC ĐÚNG ĐỀ ACTIVE_SESSIONS, CACHE META ĐỀ THI, SẮP XẾP CHUẨN DATA_STRING)
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

// Bộ nhớ đệm lưu chỉ mục lần thi người dùng đang chọn xem theo SBD
window._userSelectedAttemptsBySbd = window._userSelectedAttemptsBySbd || {};

let realtimeSubmissionsChannel = null;
let realtimeDebounceTimer = null;
let _pendingSilentResultRefresh = false;

function debouncedRefreshResults(delayMs = 600) {
    if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
    realtimeDebounceTimer = setTimeout(() => {
        if (currentExamResultData.item) {
            fetchAndRenderExamResults(currentExamResultData.item, true);
        }
    }, delayMs);
}

// Khi Thầy chuyển từ tab khác quay lại bảng điểm đang mở, nếu có cập nhật chờ thì tải bù ngay
document.addEventListener("visibilitychange", function() {
    if (!document.hidden && _pendingSilentResultRefresh && currentExamResultData.item) {
        const modal = document.getElementById("result-fullscreen-modal");
        if (modal && modal.style.display === "flex") {
            _pendingSilentResultRefresh = false;
            fetchAndRenderExamResults(currentExamResultData.item, true);
        }
    }
});

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

// FIX: Cập nhật hàm sortDataString để trích xuất số ID và sắp xếp theo Numeric Sort.
function sortDataString(str) {
    if (!str) return "";
    let parts = str.split(/\s*\|\s*/);
    
    parts.sort((a, b) => {
        // 1. Nhận diện các câu log hệ thống (Đẩy về cuối cùng)
        let isLogA = a.startsWith("[") || a.toLowerCase().includes("tab switch");
        let isLogB = b.startsWith("[") || b.toLowerCase().includes("tab switch");
        
        if (isLogA && !isLogB) return 1;
        if (!isLogA && isLogB) return -1;
        if (isLogA && isLogB) return a.localeCompare(b);

        // 2. Lấy con số ID và chữ cái nhỏ ở đầu mỗi mục (Ví dụ: "1-A", "10-C", "2a-Đúng")
        let matchA = a.match(/^(\d+)([a-zA-Z]?)/);
        let matchB = b.match(/^(\d+)([a-zA-Z]?)/);
        
        let numA = matchA ? parseInt(matchA[1], 10) : 0;
        let numB = matchB ? parseInt(matchB[1], 10) : 0;

        // 3. Sắp xếp theo số
        if (numA !== numB) {
            return numA - numB;
        }
        
        // Nếu cùng số (VD: câu Đúng/Sai 2a, 2b, 2c), tiếp tục sắp xếp theo chữ cái
        let charA = matchA && matchA[2] ? matchA[2].toLowerCase() : "";
        let charB = matchB && matchB[2] ? matchB[2].toLowerCase() : "";
        
        if (charA !== charB) return charA.localeCompare(charB);
        
        return a.localeCompare(b);
    });
    
    return parts.join(" | ");
}

function extractTabCountFromDataString(dataStr) {
    if (!dataStr) return 0;
    let m = dataStr.match(/tab\s*switch\s*:\s*(\d+)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
}

function getSubmissionTimestamp(sub) {
    if (!sub) return 0;
    if (sub.createdAt && !isNaN(Number(sub.createdAt))) return Number(sub.createdAt);
    if (sub.created_at) {
        const t = new Date(sub.created_at).getTime();
        if (!isNaN(t)) return t;
    }
    if (sub.timestamp) {
        const t = typeof parseDateString === 'function' ? parseDateString(sub.timestamp) : new Date(sub.timestamp).getTime();
        if (!isNaN(t)) return t;
    }
    return 0;
}

// BỘ LỌC CHỐNG SPAM CLICK KÉP (CHỈ LOẠI BỎ KHI NỘP TRÙNG TRONG VÒNG 2 GIÂY)
function deduplicateAttempts(attempts) {
    if (!attempts || attempts.length <= 1) return attempts || [];
    let unique = [];
    attempts.forEach(sub => {
        let subTime = getSubmissionTimestamp(sub);
        let subScore = (sub.score10 !== undefined) ? String(sub.score10) : "";
        let isDup = unique.some(existing => {
            let exTime = getSubmissionTimestamp(existing);
            let exScore = (existing.score10 !== undefined) ? String(existing.score10) : "";
            if (sub.id && existing.id && sub.id === existing.id) return true;
            return (subTime > 0 && exTime > 0 && Math.abs(subTime - exTime) < 2000 && subScore === exScore);
        });
        if (!isDup) unique.push(sub);
    });
    return unique;
}

function stopRealtimeSubmissionsListener() {
    if (realtimeDebounceTimer) {
        clearTimeout(realtimeDebounceTimer);
        realtimeDebounceTimer = null;
    }
    _pendingSilentResultRefresh = false;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (realtimeSubmissionsChannel && client) {
        try { client.removeChannel(realtimeSubmissionsChannel); } catch(e) {}
        realtimeSubmissionsChannel = null;
    }
}

// XỬ LÝ THÔNG MINH CẬP NHẬT PING TRÊN RAM (0 BYTE TRUY VẤN SUPABASE)
function handleRealtimeActiveSessionChange(newRow, eventType) {
    if (!newRow || !newRow.sbd) {
        if (eventType === 'INSERT' || eventType === 'DELETE') debouncedRefreshResults(600);
        return;
    }

    const currentItem = currentExamResultData.item;
    const targetCatId = (currentItem && currentItem.categoryId) || currentExamResultData.categoryId || "them-11";
    const quizId = currentItem ? (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentItem) : currentItem.id) : "";
    const cacheKey = `${targetCatId}_${quizId}`;
    const cached = _examResultsCache[cacheKey];

    const rawKey = String(newRow.sbd).trim();
    const cleanKey = cleanSbdStandard(newRow.sbd);
    const sessObj = {
        id: newRow.id,
        sbd: newRow.sbd,
        name: newRow.name || newRow.student_name,
        className: newRow.class_name,
        startTime: newRow.start_time,
        lastPing: newRow.last_ping,
        isFree: newRow.is_free,
        categoryId: newRow.category_id,
        quizId: newRow.quiz_id,
        examTitle: newRow.exam_title
    };

    if (cached && cached.activeSessionsData) {
        if (rawKey) cached.activeSessionsData[rawKey] = sessObj;
        if (cleanKey) cached.activeSessionsData[cleanKey] = sessObj;
    }

    const rows = currentExamResultData.rawRows || [];
    const matchedRow = rows.find(r => r && r.account && isSbdMatchedFlexibly(r.account.sbd, newRow.sbd));

    if (eventType === 'UPDATE') {
        // Nếu học sinh đã hiển thị "💓 Đang thi" bình thường -> BỎ QUA HOÀN TOÀN (0 query DB, 0 vẽ lại DOM)
        if (matchedRow && matchedRow.isDoing && !matchedRow.isAwayApp) {
            return;
        }
        // Nếu học sinh vừa quay lại từ app khác -> chỉ gỡ cờ isAwayApp trên RAM
        if (matchedRow && matchedRow.isDoing && matchedRow.isAwayApp) {
            matchedRow.isAwayApp = false;
            if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
            return;
        }
        // Nếu học sinh vừa bắt đầu lần thi mới đè lên dòng cũ
        if (matchedRow && !matchedRow.isDoing) {
            const rawStart = Number(newRow.start_time || 0);
            const latestSubTime = matchedRow.allAttempts.length > 0
                ? getSubmissionTimestamp(matchedRow.allAttempts[matchedRow.allAttempts.length - 1])
                : 0;
            if (matchedRow.allAttempts.length === 0 || rawStart > (latestSubTime + 3000)) {
                matchedRow.isDoing = true;
                matchedRow.isAwayApp = false;
                matchedRow.doingStartTime = rawStart > 0 ? rawStart : (Number(newRow.last_ping) || Date.now());
                if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
            }
            return;
        }
        // Chỉ tải lại nếu là thí sinh tự do hoàn toàn mới chưa có trong bảng
        if (!matchedRow) {
            debouncedRefreshResults(800);
        }
        return;
    }

    // Với INSERT: nếu dòng đã có trong danh sách lớp -> bật Đang thi ngay trên RAM, không cần query DB
    if (eventType === 'INSERT') {
        if (matchedRow) {
            matchedRow.isDoing = true;
            matchedRow.isAwayApp = false;
            matchedRow.doingStartTime = Number(newRow.start_time || newRow.last_ping || Date.now());
            if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
            return;
        }
        debouncedRefreshResults(600);
    }
}

// BẢN TỐI ƯU: KHÔNG TẢI LẠI TOÀN BỘ BẢNG ĐIỂM KHI HỌC SINH PING (TIẾT KIỆM >95% BĂNG THÔNG)
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
            // 1. Lắng nghe bài nộp (gom nhóm 800ms để tránh tải dồn khi nộp hàng loạt)
            channel = channel.on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'submissions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(800));

            // 2. Lắng nghe phiên làm bài: INSERT & DELETE mới refresh, UPDATE ping chỉ xử lý nhẹ trên RAM
            channel = channel.on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, (payload) => handleRealtimeActiveSessionChange(payload && payload.new, 'INSERT'));

            channel = channel.on('postgres_changes', { 
                event: 'DELETE', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(600));

            channel = channel.on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, (payload) => handleRealtimeActiveSessionChange(payload && payload.new, 'UPDATE'));
        });

        channel.subscribe();
        realtimeSubmissionsChannel = channel;
    } catch(e) {
        console.warn("Lỗi gắn Supabase Realtime:", e);
    }
}

async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item) return;

    // Nếu tab đang ẩn và là lệnh làm mới ngầm -> tạm hoãn tới khi Thầy mở lại tab
    if (isSilent && typeof document !== 'undefined' && document.hidden) {
        _pendingSilentResultRefresh = true;
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) {
        console.error("Lỗi: Không tìm thấy Supabase Client");
        return;
    }

    let quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(item) : null) || item.id || item.quizId || item.firebaseId || "";
    let maDe = item.made || item.maDe || "";
    let examTitle = item.title || "";
    let quizObj = item.quizObj || item._cachedQuizMeta || null;

    if (quizId && !quizObj) {
        try {
            const { data: qData } = await client
                .from('quizzes')
                .select('id, title, made, time_limit_minutes')
                .eq('id', quizId)
                .maybeSingle();
            if (qData) {
                quizObj = qData;
                item._cachedQuizMeta = qData;
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

        const SUB_SLIM_COLS = 'id, quiz_id, sbd, student_name, class_name, score10, raw_score, correct_count, wrong_count, completion_time, spent_mins, tab_switch_count, data_string, created_at, is_free, category_id';
        const CHEAT_SLIM_COLS = 'id, sbd, student_name, duration_str, switch_count';
        const ACTIVE_SLIM_COLS = 'id, sbd, name, class_name, start_time, last_ping, is_free, category_id, quiz_id, exam_title';

        let [subRes, cheatRes, activeRes] = await Promise.all([
            client.from('submissions').select(SUB_SLIM_COLS).in('quiz_id', candidateCodes).order('created_at', { ascending: true }),
            client.from('cheating_logs').select(CHEAT_SLIM_COLS).in('quiz_id', candidateCodes),
            client.from('active_sessions').select(ACTIVE_SLIM_COLS).in('quiz_id', candidateCodes)
        ]);

        let rawSubsData = subRes.data || [];
        let activeData = activeRes.data || [];
        let cheatData = cheatRes.data || [];

        if (rawSubsData.length === 0 && examTitle && examTitle.trim() !== "") {
            const { data: extraSubs } = await client
                .from('submissions')
                .select(SUB_SLIM_COLS)
                .ilike('exam_title', `%${examTitle.trim()}%`)
                .order('created_at', { ascending: true });
            if (extraSubs && extraSubs.length > 0) {
                rawSubsData = extraSubs;
            }
        }

        const rawSubs = rawSubsData.map(r => {
            const tMs = r.created_at ? new Date(r.created_at).getTime() : 0;
            return {
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
                timestamp: (typeof formatDateTimeFull === 'function' && tMs > 0) ? formatDateTimeFull(tMs) : (r.timestamp || r.created_at || "---"),
                createdAt: tMs > 0 ? tMs : Date.now(),
                isFree: r.is_free,
                categoryId: r.category_id
            };
        });

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

// BẢN FIX: XÁC ĐỊNH CHÍNH XÁC "ĐANG THI" & ĐẾM ĐỦ THỜI GIAN LÀM BÀI, KHÔNG BỊ TỤT VỀ CHƯA THI KHI RỜI APP
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
    // Sắp xếp các lần thi theo thời gian nộp tăng dần: Lần 1 -> Lần 2 -> Lần 3
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

    const finalRows = [];
    const usedPendingKeys = new Set();
    const usedSubIds = new Set();

    // LẤY THỜI LƯỢNG ĐỀ THI ĐỂ TÍNH HẠN CÒN ĐANG THI
    const timeLimitMinutes = parseInt(examItem?.timeLimitMinutes || examItem?.time_limit_minutes || examMeta?.quizObj?.time_limit_minutes || 90, 10);
    const maxExamDurationMs = (timeLimitMinutes + 15) * 60 * 1000; // Cho phép trôi thêm 15 phút gia hạn

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
        let isAwayApp = false;
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

        // BẢN FIX: XÁC ĐỊNH ĐANG THI CHÍNH XÁC KỂ CẢ KHI HỌC SINH MỞ APP KHÁC
        if (activeSess) {
            const rawStartTime = Number(activeSess.startTime || 0);
            const sessPingTime = Number(activeSess.lastPing || activeSess.startTime || 0);
            const timeSincePing = nowMs - sessPingTime;
            const timeSinceStart = rawStartTime > 0 ? (nowMs - rawStartTime) : 0;

            const isPingFresh = (timeSincePing < 180000); // Dưới 3 phút: Đang thao tác trực tiếp
            // Nếu học sinh rời sang app khác (máy tính, Zalo): vẫn giữ ĐANG THI trong suốt thời lượng bài thi
            const isStillWithinExamTime = (timeSinceStart < maxExamDurationMs) && (timeSincePing < 25 * 60 * 1000);

            if (matchedSubs.length === 0) {
                if (isPingFresh || isStillWithinExamTime) {
                    isDoing = true;
                    isAwayApp = !isPingFresh;
                    doingStartTime = rawStartTime > 0 ? rawStartTime : sessPingTime;
                    usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                }
            } else {
                const latestSubTime = getSubmissionTimestamp(matchedSubs[matchedSubs.length - 1]);
                if (rawStartTime > (latestSubTime + 3000) && (isPingFresh || isStillWithinExamTime)) {
                    isDoing = true;
                    isAwayApp = !isPingFresh;
                    doingStartTime = rawStartTime;
                    usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                }
            }
        }

        let cheatDurations = cheatHistoryBySbd[accSbdClean] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdClean] || cheatDurations.length;
        let cheatTimeString = cheatDurations.length > 0 ? cheatDurations.join(" | ") : "0s";

        // Mặc định hiển thị Lần 1 (chỉ mục 0), trừ khi giáo viên chọn xem lần khác
        let selectedAttemptIndex = 0;
        const savedAttemptIdx = window._userSelectedAttemptsBySbd[accSbdClean];
        if (savedAttemptIdx !== undefined && savedAttemptIdx >= 0 && savedAttemptIdx < matchedSubs.length) {
            selectedAttemptIndex = savedAttemptIdx;
        }

        finalRows.push({
            _rowUid: 'row_cls_' + (acc.sbd || idx),
            stt: acc.stt || (idx + 1),
            isClassStudent: true,
            account: acc,
            allAttempts: matchedSubs,
            selectedAttemptIndex: selectedAttemptIndex,
            isDoing: isDoing,
            isAwayApp: isAwayApp,
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

        const rawStartTime = Number(sess.startTime || 0);
        const sessPingTime = Number(sess.lastPing || sess.startTime || 0);
        const timeSincePing = nowMs - sessPingTime;
        const timeSinceStart = rawStartTime > 0 ? (nowMs - rawStartTime) : 0;

        const isPingFresh = (timeSincePing < 180000);
        const isStillWithinExamTime = (timeSinceStart < maxExamDurationMs) && (timeSincePing < 25 * 60 * 1000);

        if (!isPingFresh && !isStillWithinExamTime) continue;

        usedPendingKeys.add(cleanKey);

        const freeAcc = {
            sbd: sess.sbd || "---",
            name: sess.name || "Thí sinh tự do",
            className: sess.className || "Tự do"
        };

        finalRows.push({
            _rowUid: 'row_free_doing_' + cleanKey,
            stt: freeSttCounter++,
            isClassStudent: false,
            account: freeAcc,
            allAttempts: [],
            selectedAttemptIndex: 0,
            isDoing: true,
            isAwayApp: !isPingFresh,
            doingStartTime: rawStartTime > 0 ? rawStartTime : sessPingTime,
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

        let existingFreeRow = finalRows.find(r => !r.isClassStudent && isSbdMatchedFlexibly(r.account.sbd, rawSbd));
        if (existingFreeRow) {
            existingFreeRow.allAttempts.push(sub);
            const savedAttemptIdx = window._userSelectedAttemptsBySbd[cleanSbdStandard(rawSbd)];
            if (savedAttemptIdx !== undefined && savedAttemptIdx >= 0 && savedAttemptIdx < existingFreeRow.allAttempts.length) {
                existingFreeRow.selectedAttemptIndex = savedAttemptIdx;
            } else {
                existingFreeRow.selectedAttemptIndex = 0;
            }
            usedSubIds.add(sub.id);
            continue;
        }

        const freeAcc = {
            sbd: sub.sbd || "---",
            name: sub.studentName || "Thí sinh tự do",
            className: sub.studentClass || "Tự do"
        };

        usedSubIds.add(sub.id);

        finalRows.push({
            _rowUid: 'row_free_' + cleanSbdStandard(rawSbd),
            stt: freeSttCounter++,
            isClassStudent: false,
            account: freeAcc,
            allAttempts: [sub],
            selectedAttemptIndex: 0,
            isDoing: false,
            isAwayApp: false,
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

window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;
window.fetchAndRenderExamResults = fetchAndRenderExamResults;
window.renderExamResultTable = renderExamResultTable;
