// =========================================================
// FILE: portal-results-core.js 
// (BẢN FIX ĐỒNG BỘ 100%: REALTIME CHÍNH XÁC, KHÔNG BỊ MẤT ĐANG THI KHI RỜI APP)
// ĐÃ SỬA:
// 1. LOẠI BỎ TRIỆT ĐỂ LOG "Bắt đầu Lần ..." KHỎI SỐ LẦN & THỜI GIAN CHUYỂN TAB
// 2. SẮP XẾP LOG CHUYỂN TAB THEO THỜI GIAN TĂNG DẦN & TÁCH THEO TỪNG LẦN THI
// 3. KHỚP SBD LINH HOẠT KỂ CẢ HẬU TỐ _lan2, _lan3
// 4. GIỮ NGUYÊN MENU NỔI KHI BẢNG CẬP NHẬT NGẦM (isSilent)
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

function debouncedRefreshResults(delayMs = 250) {
    if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
    realtimeDebounceTimer = setTimeout(() => {
        if (currentExamResultData.item) {
            fetchAndRenderExamResults(currentExamResultData.item, true);
        }
    }, delayMs);
}

function cleanSbdStandard(sbd) {
    if (!sbd) return "";
    return String(sbd).trim().toLowerCase().replace(/_lan\d+$/i, '').replace(/[^a-z0-9]/g, '');
}

function getSbdVariations(sbd) {
    if (!sbd) return [];
    const raw = String(sbd).trim();
    const baseRaw = raw.replace(/_lan\d+$/i, '').trim();
    const clean = cleanSbdStandard(baseRaw);
    const setVars = new Set([raw, raw.toLowerCase(), raw.toUpperCase(), baseRaw, baseRaw.toLowerCase(), baseRaw.toUpperCase(), clean]);
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

// Sắp xếp chuỗi chi tiết đáp án theo thứ tự số câu (1, 2, ..., 10)
function sortDataString(str) {
    if (!str) return "";
    let parts = str.split(/\s*\|\s*/);
    
    parts.sort((a, b) => {
        let isLogA = a.startsWith("[") || a.toLowerCase().includes("tab switch");
        let isLogB = b.startsWith("[") || b.toLowerCase().includes("tab switch");
        
        if (isLogA && !isLogB) return 1;
        if (!isLogA && isLogB) return -1;
        if (isLogA && isLogB) return a.localeCompare(b);

        let matchA = a.match(/^(\d+)([a-zA-Z]?)/);
        let matchB = b.match(/^(\d+)([a-zA-Z]?)/);
        
        let numA = matchA ? parseInt(matchA[1], 10) : 0;
        let numB = matchB ? parseInt(matchB[1], 10) : 0;

        if (numA !== numB) {
            return numA - numB;
        }
        
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

// Chuẩn hóa thời gian chuyển tab ngắn gọn: "5 giây" -> "5s", "3 phút 50 giây" -> "3p50s"
function formatShortCheatDuration(rawDur) {
    if (!rawDur) return "";
    const str = String(rawDur).trim();
    if (!str || /^bắt\s*đầu/i.test(str) || str === "---") return "";
    return str
        .replace(/phút/gi, 'p')
        .replace(/giây/gi, 's')
        .replace(/\s+/g, '');
}

// Tính chính xác Số lần chuyển tab & Thời gian chuyển tab (ví dụ: 2 lần | 5s | 10s) cho đúng lần thi đang xem
function getAttemptCheatStats(row, targetSub = null) {
    const entries = Array.isArray(row?.cheatEntries) ? row.cheatEntries : [];
    const attempts = Array.isArray(row?.allAttempts) ? row.allAttempts : [];
    const sub = targetSub || (attempts.length > 0 ? (attempts[row.selectedAttemptIndex] || attempts[0]) : null);

    let scopedEntries = entries;

    if (entries.length > 0 && entries.some(e => e.createdAtMs > 0)) {
        if (row?.isDoing && !sub && attempts.length > 0) {
            const lastSubMs = getSubmissionTimestamp(attempts[attempts.length - 1]);
            if (lastSubMs > 0) {
                scopedEntries = entries.filter(e => e.createdAtMs > lastSubMs);
            }
        } else if (sub && attempts.length > 1) {
            const attIdx = attempts.indexOf(sub);
            if (attIdx !== -1) {
                const winStart = attIdx === 0 ? 0 : getSubmissionTimestamp(attempts[attIdx - 1]);
                const winEnd = getSubmissionTimestamp(sub) + 10000;
                if (winEnd > 10000) {
                    scopedEntries = entries.filter(e => {
                        if (!e.createdAtMs) return false;
                        return e.createdAtMs > winStart && e.createdAtMs <= winEnd;
                    });
                }
            }
        }
    }

    const durations = scopedEntries.map(e => e.durationShort).filter(Boolean);
    const maxLogSwitch = scopedEntries.reduce((mx, e) => Math.max(mx, e.switchCount || 0), 0);

    if (sub) {
        const rawSubTab = parseInt(sub.tabSwitchCount, 10) || 0;
        const dataStrTab = extractTabCountFromDataString(sub.dataString);
        const subReported = Math.max(rawSubTab, dataStrTab);

        // Nếu bài nộp ghi rõ 0 lần nhưng log chung (không có created_at) lại có dữ liệu của lần khác -> tránh gán nhầm
        let effectiveLogCount = Math.max(maxLogSwitch, durations.length);
        let effectiveDurations = durations;
        if (attempts.length > 1 && subReported === 0 && !entries.some(e => e.createdAtMs > 0)) {
            effectiveLogCount = 0;
            effectiveDurations = [];
        }

        const tabCount = Math.max(subReported, effectiveLogCount);
        const timeString = effectiveDurations.length > 0
            ? effectiveDurations.join(" | ")
            : (tabCount > 0 ? "---" : "0s");

        return { tabCount, timeString, durations: effectiveDurations };
    }

    if (row?.isDoing) {
        const tabCount = Math.max(maxLogSwitch, durations.length);
        const timeString = durations.length > 0 ? durations.join(" | ") : "0s";
        return { tabCount, timeString, durations };
    }

    return { tabCount: 0, timeString: "0s", durations: [] };
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
            }, () => debouncedRefreshResults(250));

            channel = channel.on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(350));
        });

        channel = channel.on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'live_drafts' 
        }, () => debouncedRefreshResults(350));

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
            client.from('submissions').select('*').in('quiz_id', candidateCodes).order('created_at', { ascending: true }),
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
            const { data: extraSubs } = await client.from('submissions').select('*').ilike('exam_title', `%${examTitle.trim()}%`).order('created_at', { ascending: true });
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
                userAnswers: r.user_answers,
                timestamp: (typeof formatDateTimeFull === 'function' && tMs > 0) ? formatDateTimeFull(tMs) : (r.timestamp || r.created_at || "---"),
                createdAt: tMs > 0 ? tMs : Date.now(),
                isFree: r.is_free,
                categoryId: r.category_id
            };
        });

        // Sắp xếp cheating_logs theo thứ tự thời gian tăng dần trong JS (an toàn kể cả nếu thiếu created_at)
        const sortedCheatRows = [...cheatData].sort((a, b) => {
            const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
            const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (ta !== tb) return ta - tb;
            const ia = Number(a.id);
            const ib = Number(b.id);
            if (!isNaN(ia) && !isNaN(ib)) return ia - ib;
            return String(a.id || "").localeCompare(String(b.id || ""));
        });

        const cheatingLogsList = sortedCheatRows.map((c, idx) => ({
            id: c.id || `cheat_${idx}`,
            sbd: c.sbd,
            studentName: c.student_name,
            durationStr: c.duration_str,
            switchCount: c.switch_count,
            createdAtMs: c.created_at ? (new Date(c.created_at).getTime() || 0) : 0
        }));

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
            cheatingLogsData: cheatingLogsList,
            activeSessionsData: activeSessionsMap,
            liveDraftsData: liveDraftsMap,
            examMeta: examMeta
        };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsList, activeSessionsMap, liveDraftsMap, item, examMeta, { isSilent });

    } catch(err) {
        console.error("❌ Lỗi nạp bảng điểm Supabase:", err);
        const tbody = document.getElementById("result-table-tbody");
        if (tbody && !isSilent) tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; font-weight:700; color:#dc2626;">❌ Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

function renderExamResultTable(categoryId, submissionsListRaw, cheatingInput, activeSessionsMap, liveDraftsMap, examItem, examMeta = {}, renderOpts = {}) {
    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];

    const cheatEntriesBySbd = {};
    const cheatHistoryBySbd = {};
    const maxCheatCountBySbd = {};

    const cheatList = Array.isArray(cheatingInput)
        ? cheatingInput
        : Object.values(cheatingInput || {});

    cheatList.forEach(log => {
        if (!log) return;
        const sbdKey = cleanSbdStandard(log.sbd);
        if (!sbdKey || sbdKey === "---") return;

        const dur = String(log.durationStr || "").trim();
        const sCount = parseInt(log.switchCount, 10) || 0;

        // LỌC BỎ TRIỆT ĐỂ "Bắt đầu", "Bắt đầu Lần 1", "Bắt đầu Lần 2"... và các dòng không có chuyển tab thực tế
        if (!dur || /^bắt\s*đầu/i.test(dur) || dur === "---") return;
        if (sCount <= 0 && !/\d+\s*(?:giây|phút|s|p|m)/i.test(dur)) return;

        const shortDur = formatShortCheatDuration(dur);
        if (!shortDur) return;

        if (!cheatEntriesBySbd[sbdKey]) cheatEntriesBySbd[sbdKey] = [];
        cheatEntriesBySbd[sbdKey].push({
            durationShort: shortDur,
            switchCount: sCount,
            createdAtMs: Number(log.createdAtMs) || 0
        });

        if (!cheatHistoryBySbd[sbdKey]) cheatHistoryBySbd[sbdKey] = [];
        cheatHistoryBySbd[sbdKey].push(shortDur);
        maxCheatCountBySbd[sbdKey] = Math.max(maxCheatCountBySbd[sbdKey] || 0, sCount);
    });

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
        let sbdClean = cleanSbdStandard(sess.sbd);
        let sbdRaw = String(sess.sbd || "").trim();
        if (sbdClean) activeUsersMap[sbdClean] = sess;
        if (sbdRaw) activeUsersMap[sbdRaw] = sess;
    }

    const finalRows = [];
    const usedPendingKeys = new Set();
    const usedSubIds = new Set();

    const timeLimitMinutes = parseInt(examItem?.timeLimitMinutes || examItem?.time_limit_minutes || examMeta?.quizObj?.time_limit_minutes || 90, 10);
    const maxExamDurationMs = (timeLimitMinutes + 15) * 60 * 1000;

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

        if (activeSess) {
            const rawStartTime = Number(activeSess.startTime || 0);
            const sessPingTime = Number(activeSess.lastPing || activeSess.startTime || 0);
            const timeSincePing = nowMs - sessPingTime;
            const timeSinceStart = rawStartTime > 0 ? (nowMs - rawStartTime) : 0;

            const isPingFresh = (timeSincePing < 180000);
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

        let cheatEntries = cheatEntriesBySbd[accSbdClean] || [];
        let cheatDurations = cheatHistoryBySbd[accSbdClean] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdClean] || cheatDurations.length;
        let cheatTimeString = cheatDurations.length > 0 ? cheatDurations.join(" | ") : "0s";

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
            cheatEntries: cheatEntries,
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

        const freeCheatEntries = cheatEntriesBySbd[cleanKey] || [];
        const freeCheatDurations = cheatHistoryBySbd[cleanKey] || [];

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
            cheatEntries: freeCheatEntries,
            cheatTimeString: freeCheatDurations.length > 0 ? freeCheatDurations.join(" | ") : "0s",
            cheatLogsTabCount: maxCheatCountBySbd[cleanKey] || freeCheatDurations.length
        });
    }

    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const rawSbd = sub.sbd || sub.studentId || "free";
        const cleanKey = cleanSbdStandard(rawSbd);

        if (classAccounts.some(acc => isSbdMatchedFlexibly(acc.sbd, rawSbd))) continue;
        if (typeof isSbdBelongsToCategory === 'function') {
            if (!isSbdBelongsToCategory(rawSbd, categoryId)) continue;
        }

        let existingFreeRow = finalRows.find(r => !r.isClassStudent && isSbdMatchedFlexibly(r.account.sbd, rawSbd));
        if (existingFreeRow) {
            existingFreeRow.allAttempts.push(sub);
            existingFreeRow.allAttempts = deduplicateAttempts(existingFreeRow.allAttempts);
            const savedAttemptIdx = window._userSelectedAttemptsBySbd[cleanKey];
            if (savedAttemptIdx !== undefined && savedAttemptIdx >= 0 && savedAttemptIdx < existingFreeRow.allAttempts.length) {
                existingFreeRow.selectedAttemptIndex = savedAttemptIdx;
            } else {
                existingFreeRow.selectedAttemptIndex = 0;
            }
            usedSubIds.add(sub.id);
            continue;
        }

        const freeAcc = {
            sbd: String(rawSbd).replace(/_lan\d+$/i, '') || "---",
            name: sub.studentName || "Thí sinh tự do",
            className: sub.studentClass || "Tự do"
        };

        const freeCheatEntries = cheatEntriesBySbd[cleanKey] || [];
        const freeCheatDurations = cheatHistoryBySbd[cleanKey] || [];

        usedSubIds.add(sub.id);

        finalRows.push({
            _rowUid: 'row_free_' + cleanKey,
            stt: freeSttCounter++,
            isClassStudent: false,
            account: freeAcc,
            allAttempts: [sub],
            selectedAttemptIndex: 0,
            isDoing: false,
            isAwayApp: false,
            doingStartTime: null,
            isFreeDoing: false,
            cheatEntries: freeCheatEntries,
            cheatTimeString: freeCheatDurations.length > 0 ? freeCheatDurations.join(" | ") : "0s",
            cheatLogsTabCount: maxCheatCountBySbd[cleanKey] || freeCheatDurations.length
        });
    }

    if (typeof calculateRanksForRows === 'function') calculateRanksForRows(finalRows);
    currentExamResultData.rawRows = finalRows;
    if (typeof updateStatsAndRenderTable === 'function') {
        updateStatsAndRenderTable(finalRows, { keepFloatingMenu: Boolean(renderOpts && renderOpts.isSilent) });
    }
}

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

window.cleanSbdStandard = cleanSbdStandard;
window.getSbdVariations = getSbdVariations;
window.isSbdMatchedFlexibly = isSbdMatchedFlexibly;
window.getAttemptCheatStats = getAttemptCheatStats;
window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;
window.fetchAndRenderExamResults = fetchAndRenderExamResults;
window.renderExamResultTable = renderExamResultTable;
