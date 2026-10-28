// =========================================================
// FILE: portal-results-core.js (BẢN FIX ĐỒNG BỘ ĐANG THI & LỌC ĐÚNG LỚP THEO SBD)
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

// Chuẩn hoá SBD thống nhất: viết thường, bỏ toàn bộ ký tự đặc biệt
function cleanSbdStandard(sbd) {
    if (!sbd) return "";
    return String(sbd).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Tạo tập các biến thể SBD (xử lý triệt để 11C04 <-> 11C4, 10P01 <-> 10P1)
function getSbdVariations(sbd) {
    if (!sbd) return [];
    const raw = cleanSbdStandard(sbd);
    const setVars = new Set([raw]);
    const m = raw.match(/^([a-z]+|\d+[a-z]+)0*(\d+)$/i);
    if (m) {
        const prefix = m[1];
        const num = parseInt(m[2], 10);
        setVars.add(`${prefix}${num}`);
        setVars.add(`${prefix}${String(num).padStart(2, '0')}`);
    }
    const mNum = raw.match(/^(\d+)$/);
    if (mNum) {
        const num = parseInt(mNum[1], 10);
        setVars.add(String(num));
    }
    return Array.from(setVars);
}

// Kiểm tra 2 SBD có trùng khớp nhau không
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

    try {
        let channel = client.channel(`admin_realtime_${targetQuizId}_${Date.now()}`);
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

// BỘ TRUY VẤN VÀ ĐỒNG BỘ KẾT QUẢ TỪ 4 BẢNG SUPABASE
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding:30px; font-weight:700; color:#0284c7;">⏳ Đang tải dữ liệu từ máy chủ Supabase...</td></tr>`;
    }

    try {
        // Thu thập toàn bộ các mã ứng viên hợp lệ của đề thi
        let candidateCodes = [];
        if (typeof getExamCandidateCodes === 'function') {
            candidateCodes = getExamCandidateCodes(examTitle, maDe, quizId);
        }
        if (quizId && !candidateCodes.includes(String(quizId).trim())) {
            candidateCodes.push(String(quizId).trim());
        }

        // 1. Truy vấn đồng thời theo mã đề
        let [subRes, cheatRes, activeRes, draftRes] = await Promise.all([
            client.from('submissions').select('*').in('quiz_id', candidateCodes),
            client.from('cheating_logs').select('*').in('quiz_id', candidateCodes),
            client.from('active_sessions').select('*').in('quiz_id', candidateCodes),
            client.from('live_drafts').select('*').in('quiz_id', candidateCodes)
        ]);

        let rawSubsData = subRes.data || [];
        let activeData = activeRes.data || [];
        let draftsData = draftRes.data || [];
        let cheatData = cheatRes.data || [];

        // 2. Quét bổ sung theo tiêu đề đề thi nếu cần
        if (examTitle && examTitle.trim() !== "") {
            const cleanTitle = examTitle.trim();
            const [extraActiveRes, extraDraftRes, extraSubRes] = await Promise.all([
                client.from('active_sessions').select('*').ilike('exam_title', `%${cleanTitle}%`),
                client.from('live_drafts').select('*').ilike('exam_title', `%${cleanTitle}%`),
                rawSubsData.length === 0 ? client.from('submissions').select('*').ilike('exam_title', `%${cleanTitle}%`) : Promise.resolve({ data: [] })
            ]);

            if (extraSubRes.data && extraSubRes.data.length > 0) {
                const existingSubIds = new Set(rawSubsData.map(s => s.id));
                extraSubRes.data.forEach(s => {
                    if (!existingSubIds.has(s.id)) rawSubsData.push(s);
                });
            }

            if (extraActiveRes.data && extraActiveRes.data.length > 0) {
                const existingActIds = new Set(activeData.map(a => a.id || `${a.quiz_id}_${a.sbd}`));
                extraActiveRes.data.forEach(a => {
                    const uid = a.id || `${a.quiz_id}_${a.sbd}`;
                    if (!existingActIds.has(uid)) activeData.push(a);
                });
            }

            if (extraDraftRes.data && extraDraftRes.data.length > 0) {
                const existingDraftIds = new Set(draftsData.map(d => d.id || `${d.quiz_id}_${d.sbd}`));
                extraDraftRes.data.forEach(d => {
                    const uid = d.id || `${d.quiz_id}_${d.sbd}`;
                    if (!existingDraftIds.has(uid)) draftsData.push(d);
                });
            }
        }

        console.log(`📊 Đã nạp: ${rawSubsData.length} bài nộp, ${activeData.length} active_sessions, ${draftsData.length} live_drafts.`);

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
            const key = cleanSbdStandard(a.sbd);
            if (!key) return;
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
            if (!key) return;
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

        _examResultsCache[`${targetCatId}_${quizId}`] = {
            submissionsListRaw: rawSubs,
            cheatingLogsData: cheatingLogsMap,
            activeSessionsData: activeSessionsMap,
            examMeta: examMeta
        };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsMap, activeSessionsMap, liveDraftsMap, item, examMeta);

        const searchInput = document.getElementById("result-search-input");
        if (searchInput && searchInput.value.trim() !== "") filterResultTable();

    } catch(err) {
        console.error("❌ Lỗi nạp bảng điểm Supabase:", err);
        const tbody = document.getElementById("result-table-tbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding:30px; font-weight:700; color:#dc2626;">❌ Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// BỘ DỰNG BẢNG THÔNG MINH: FIX TRIỆT ĐỂ YÊU CẦU 1, 2, 3
function renderExamResultTable(categoryId, submissionsListRaw, cheatingMap, activeSessionsMap, liveDraftsMap, examItem, examMeta = {}) {
    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];

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

    // 2. Tập hợp bài nộp
    let submissionsList = [];
    for (let sub of (Array.isArray(submissionsListRaw) ? submissionsListRaw : [])) {
        if (!sub) continue;
        if (sub.dataString) sub.dataString = sortDataString(sub.dataString);
        submissionsList.push(sub);
    }
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    // 3. HỢP NHẤT TOÀN BỘ PHIÊN ĐANG THI (active_sessions + live_drafts)
    const inProgressUsersMap = {};
    const allPendingKeys = new Set([...Object.keys(activeSessionsMap), ...Object.keys(liveDraftsMap)]);

    allPendingKeys.forEach(sbdKey => {
        const sess = activeSessionsMap[sbdKey] || {};
        const draft = liveDraftsMap[sbdKey] || {};

        const answeredCount = draft.userAnswers ? Object.keys(draft.userAnswers).length : 0;
        const lastActivityMs = Number(sess.lastPing || sess.startTime || (draft.lastUpdated ? new Date(draft.lastUpdated).getTime() : 0)) || Date.now();

        inProgressUsersMap[sbdKey] = {
            sbd: sess.sbd || draft.sbd || sbdKey,
            name: sess.name || draft.name || "Thí sinh",
            className: sess.className || draft.className || "Lớp",
            startTime: sess.startTime || lastActivityMs,
            lastPing: sess.lastPing || lastActivityMs,
            isFree: sess.isFree !== undefined ? sess.isFree : true,
            userAnswers: draft.userAnswers || {},
            answeredCount: answeredCount,
            categoryId: sess.categoryId || draft.categoryId || ""
        };
    });

    const finalRows = [];
    const usedPendingKeys = new Set();
    const usedSubIds = new Set();

    // 4. DUYỆT DANH SÁCH HỌC SINH CHÍNH KHÓA CỦA LỚP
    classAccounts.forEach((acc, idx) => {
        const accSbdClean = cleanSbdStandard(acc.sbd);
        const accNameNorm = typeof normalizeName === 'function' ? normalizeName(acc.name) : acc.name.toLowerCase();

        // Tìm các bài nộp đã nộp trước đó của em này
        let matchedSubs = [];
        for (let sub of submissionsList) {
            let subSbdClean = cleanSbdStandard(sub.sbd || sub.studentId);
            let subNameNorm = typeof normalizeName === 'function' ? normalizeName(sub.studentName || sub.name) : "";

            let isSbdMatch = isSbdMatchedFlexibly(acc.sbd, sub.sbd || sub.studentId);
            let isNameMatch = (accNameNorm && subNameNorm && accNameNorm === subNameNorm);

            if (isSbdMatch || isNameMatch) {
                matchedSubs.push(sub);
                usedSubIds.add(sub.id);
            }
        }

        matchedSubs = deduplicateAttempts(matchedSubs);

        // TÌM PHIÊN ĐANG THI CỦA HỌC SINH NÀY
        let isDoing = false; 
        let doingStartTime = null;
        let doingDraftInfo = null;

        // Quét khớp mềm theo SBD hoặc Tên học sinh
        let matchedPendingKey = null;
        for (let pKey of allPendingKeys) {
            const prog = inProgressUsersMap[pKey];
            if (!prog) continue;
            const isMatchSbd = isSbdMatchedFlexibly(acc.sbd, prog.sbd || pKey);
            const isMatchName = accNameNorm && (normalizeName(prog.name) === accNameNorm);

            if (isMatchSbd || isMatchName) {
                matchedPendingKey = pKey;
                break;
            }
        }

        if (matchedPendingKey) {
            const activeSess = inProgressUsersMap[matchedPendingKey];
            const sessTime = Number(activeSess.lastPing || activeSess.startTime || 0);

            if (matchedSubs.length === 0) {
                // Chưa nộp bài lần nào -> Đang thi lần 1!
                isDoing = true;
                doingStartTime = activeSess.startTime || sessTime || Date.now();
                doingDraftInfo = activeSess;
                usedPendingKeys.add(matchedPendingKey);
            } else {
                // Đã có bài nộp trước đó -> kiểm tra có đang thi lượt mới không
                const latestSubTime = getSubmissionTimestamp(matchedSubs[matchedSubs.length - 1]);
                const isPingRecent = activeSess.lastPing && (Date.now() - activeSess.lastPing < 35 * 60 * 1000);
                const isAfterSubmit = sessTime > (latestSubTime + 10000);

                if (isPingRecent || isAfterSubmit) {
                    isDoing = true;
                    doingStartTime = activeSess.startTime || sessTime || Date.now();
                    doingDraftInfo = activeSess;
                    usedPendingKeys.add(matchedPendingKey);
                }
            }
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

    // 5. THÍ SINH TỰ DO ĐANG THI (LỌC THEO SBD & CATEGORY)
    for (let sbdKey of allPendingKeys) {
        if (usedPendingKeys.has(sbdKey)) continue;
        const prog = inProgressUsersMap[sbdKey];
        if (!prog) continue;

        // Nếu thuộc danh sách lớp đã duyệt ở trên thì bỏ qua
        const isBelongToClass = classAccounts.some(acc => isSbdMatchedFlexibly(acc.sbd, prog.sbd || sbdKey));
        if (isBelongToClass) continue;

        // FIX YÊU CẦU 2 & 3: Kiểm tra định dạng SBD. Nếu SBD thuộc lớp khác thì tuyệt đối không đưa vào modal này
        if (typeof isSbdBelongsToCategory === 'function') {
            if (!isSbdBelongsToCategory(prog.sbd || sbdKey, categoryId)) {
                continue; // Thuộc lớp khác (VD: 11E05 khi đang xem 11C) -> bỏ qua!
            }
        }

        usedPendingKeys.add(sbdKey);

        const freeAcc = {
            sbd: prog.sbd || sbdKey || "---",
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

    // 6. THÍ SINH TỰ DO ĐÃ NỘP BÀI (LỌC THEO SBD & CATEGORY)
    const freeSubmissionsBySbd = {};
    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const rawSbd = sub.sbd || sub.studentId || "free";
        const sbdKey = cleanSbdStandard(rawSbd);

        const isBelongToClass = classAccounts.some(acc => isSbdMatchedFlexibly(acc.sbd, rawSbd));
        if (isBelongToClass) continue;

        // FIX YÊU CẦU 2 & 3: Nếu bài nộp có SBD dạng lớp khác (VD: 11E05 khi đang xem 11C) -> KHÔNG đưa vào modal 11C!
        if (typeof isSbdBelongsToCategory === 'function') {
            if (!isSbdBelongsToCategory(rawSbd, categoryId)) {
                continue; 
            }
        } else {
            // Dự phòng: nếu SBD có dạng lớp khác thì loại trừ
            const detected = typeof detectCategoryFromSbd === 'function' ? detectCategoryFromSbd(rawSbd) : null;
            if (detected && detected !== categoryId) {
                continue;
            }
        }

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

// 7. BỘ THU BÀI TỰ ĐỘNG TỪ BẢN LƯU NHÁP LIVE DRAFTS
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

            await client.from('live_drafts').delete().match({ id: submissionId });
            await client.from('active_sessions').delete().match({ id: submissionId });

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
