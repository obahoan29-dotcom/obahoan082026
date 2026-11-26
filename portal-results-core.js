// =========================================================
// FILE: portal-results-core.js 
// (BẢN TỐI ƯU BĂNG THÔNG + LỌC ĐÚNG KHUNG GIỜ PHIÊN THI + ĐỒNG BỘ 100% 2 CỘT CHUYỂN TAB)
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

window._userSelectedAttemptsBySbd = window._userSelectedAttemptsBySbd || {};

let realtimeSubmissionsChannel = null;
let realtimeDebounceTimer = null;

const SUBMISSIONS_LITE_COLUMNS = 'id, quiz_id, sbd, student_name, class_name, score10, raw_score, correct_count, wrong_count, completion_time, spent_mins, tab_switch_count, data_string, created_at, is_free, category_id';
const ACTIVE_SESSIONS_LITE_COLUMNS = 'sbd, name, class_name, start_time, last_ping, is_free, category_id, quiz_id, exam_title';

function debouncedRefreshResults(delayMs = 1500) {
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

function sortDataString(str) {
    if (!str) return "";
    let parts = str.split(/\s*\|\s*/);
    
    parts.sort((a, b) => {
        let isLogA = a.startsWith("[") || /^tab\s*(?:switch|times)/i.test(a);
        let isLogB = b.startsWith("[") || /^tab\s*(?:switch|times)/i.test(b);
        
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

function extractTabTimesFromDataString(dataStr) {
    if (!dataStr) return [];
    const m = String(dataStr).match(/(?:^|\|)\s*TabTimes\s*:\s*([^|]+)/i);
    if (!m || !m[1]) return [];
    return m[1]
        .split(/\s*[;,]\s*/)
        .map(tok => {
            const t = String(tok || "").trim();
            if (!t || t === "?s" || t === "0s") return "";
            return formatShortCheatDuration(t) || t;
        })
        .filter(Boolean);
}

function parseDurationTokenToSeconds(token) {
    if (!token) return 0;
    const s = String(token).trim().toLowerCase();
    const mFull = s.match(/(\d+)\s*(?:p|phút)\s*(\d+)\s*(?:s|giây)?/);
    if (mFull) return (parseInt(mFull[1], 10) || 0) * 60 + (parseInt(mFull[2], 10) || 0);
    const mMinOnly = s.match(/^(\d+)\s*(?:p|phút)$/);
    if (mMinOnly) return (parseInt(mMinOnly[1], 10) || 0) * 60;
    const mSecOnly = s.match(/(\d+)\s*(?:s|giây)/);
    if (mSecOnly) return parseInt(mSecOnly[1], 10) || 0;
    return 0;
}

function parseCompletionTimeSeconds(compStr, fallbackSpentMins = 0) {
    const s = String(compStr || "").trim();
    if (s) {
        const mFull = s.match(/(\d+)\s*phút(?:\s*(\d+)\s*giây)?/i);
        if (mFull) {
            return (parseInt(mFull[1], 10) || 0) * 60 + (parseInt(mFull[2] || "0", 10) || 0);
        }
        const mShort = s.match(/(\d+)\s*p(?:\s*(\d+)\s*s)?/i);
        if (mShort) {
            return (parseInt(mShort[1], 10) || 0) * 60 + (parseInt(mShort[2] || "0", 10) || 0);
        }
        const mSecOnly = s.match(/(\d+)\s*(?:giây|s)\b/i);
        if (mSecOnly) {
            return parseInt(mSecOnly[1], 10) || 0;
        }
    }
    const mins = Number(fallbackSpentMins) || 0;
    return mins > 0 ? mins * 60 : 0;
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

function formatShortCheatDuration(rawDur) {
    if (!rawDur) return "";
    const str = String(rawDur).trim();
    if (!str || /^bắt\s*đầu/i.test(str) || str === "---" || str === "?s") return "";
    return str
        .replace(/phút/gi, 'p')
        .replace(/giây/gi, 's')
        .replace(/\s+/g, '');
}

function formatAlignedCheatTimeString(durations, tabCount, isDoing = false) {
    if (tabCount <= 0) return "0s";
    const list = Array.isArray(durations)
        ? durations.map(d => String(d || "").trim()).filter(d => d && d !== "?s" && d !== "0s")
        : [];

    if (list.length === 0) {
        return isDoing ? "Đang rời tab..." : "Chưa lưu giây";
    }
    if (list.length >= tabCount) {
        return list.join(" | ");
    }
    const missing = tabCount - list.length;
    const suffix = missing === 1 ? "1 lần chưa rõ" : `${missing} lần chưa rõ`;
    return `${list.join(" | ")} | (${suffix})`;
}

function findCheatEntriesForSbd(cheatEntriesBySbd, rawSbd) {
    if (!cheatEntriesBySbd || !rawSbd) return [];
    const cleanKey = cleanSbdStandard(rawSbd);
    if (cleanKey && Array.isArray(cheatEntriesBySbd[cleanKey])) {
        return cheatEntriesBySbd[cleanKey];
    }
    for (const k in cheatEntriesBySbd) {
        if (isSbdMatchedFlexibly(rawSbd, k) && Array.isArray(cheatEntriesBySbd[k])) {
            return cheatEntriesBySbd[k];
        }
    }
    return [];
}

function getAttemptCheatStats(row, targetSub = null) {
    const entries = Array.isArray(row?.cheatEntries) ? row.cheatEntries : [];
    const attempts = Array.isArray(row?.allAttempts) ? row.allAttempts : [];
    const sub = targetSub || (attempts.length > 0 ? (attempts[row.selectedAttemptIndex] || attempts[0]) : null);

    let scopedEntries = entries;

    if (entries.length > 0 && entries.some(e => e.createdAtMs > 0)) {
        if (row?.isDoing && !sub) {
            const lastSubMs = attempts.length > 0 ? getSubmissionTimestamp(attempts[attempts.length - 1]) : 0;
            const doingStartMs = Number(row.doingStartTime) || 0;
            const winStart = Math.max(lastSubMs, doingStartMs > 0 ? (doingStartMs - 120000) : 0);
            if (winStart > 0) {
                scopedEntries = entries.filter(e => e.createdAtMs > 0 && e.createdAtMs >= winStart);
            }
        } else if (sub && attempts.length > 1) {
            const attIdx = attempts.indexOf(sub);
            const subEndMs = getSubmissionTimestamp(sub);
            const prevEndMs = (attIdx > 0) ? getSubmissionTimestamp(attempts[attIdx - 1]) : 0;
            const spentSec = parseCompletionTimeSeconds(sub.completionTime, sub.spentMins);

            if (subEndMs > 0) {
                let winStart = prevEndMs;
                if (spentSec > 0) {
                    const estStart = subEndMs - (spentSec * 1000) - 180000;
                    winStart = Math.max(winStart, estStart);
                }
                const winEnd = subEndMs + 180000;
                scopedEntries = entries.filter(e => {
                    if (!e.createdAtMs) return false;
                    return e.createdAtMs >= winStart && e.createdAtMs <= winEnd;
                });
            }
        }
        // Khi attempts.length === 1: giữ nguyên toàn bộ entries của bài thi đó, không cắt theo đồng hồ máy học sinh
    }

    const logDurations = scopedEntries.map(e => e.durationShort).filter(Boolean);
    const maxLogSwitch = scopedEntries.reduce((mx, e) => Math.max(mx, e.switchCount || 0), 0);

    if (sub) {
        const rawSubTab = parseInt(sub.tabSwitchCount, 10) || 0;
        const dataStrTab = extractTabCountFromDataString(sub.dataString);
        const subReported = Math.max(rawSubTab, dataStrTab);
        const dataStrTimes = extractTabTimesFromDataString(sub.dataString);

        let durations = dataStrTimes.length >= logDurations.length ? [...dataStrTimes] : [...logDurations];
        if (attempts.length > 1 && subReported === 0 && !entries.some(e => e.createdAtMs > 0)) {
            durations = [];
        }

        const tabCount = subReported > 0
            ? Math.max(subReported, durations.length)
            : Math.max(maxLogSwitch, durations.length);

        const timeString = formatAlignedCheatTimeString(durations, tabCount, false);
        const totalSeconds = durations.reduce((sum, tok) => sum + parseDurationTokenToSeconds(tok), 0);
        return {
            tabCount,
            timeString,
            durations,
            totalSeconds,
            hasMissingDuration: (tabCount > durations.length)
        };
    }

    if (row?.isDoing) {
        const tabCount = Math.max(maxLogSwitch, logDurations.length);
        const timeString = formatAlignedCheatTimeString(logDurations, tabCount, true);
        const totalSeconds = logDurations.reduce((sum, tok) => sum + parseDurationTokenToSeconds(tok), 0);
        return {
            tabCount,
            timeString,
            durations: logDurations,
            totalSeconds,
            hasMissingDuration: (tabCount > logDurations.length)
        };
    }

    return { tabCount: 0, timeString: "0s", durations: [], totalSeconds: 0, hasMissingDuration: false };
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
            }, () => debouncedRefreshResults(1500));

            channel = channel.on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(1500));

            channel = channel.on('postgres_changes', { 
                event: 'DELETE', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(1500));
        });

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

    if (quizId && !quizObj && !isSilent) {
        try {
            const { data: qData } = await client.from('quizzes').select('id, title, made, time_limit_minutes').eq('id', quizId).maybeSingle();
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

        let [subRes, cheatRes, activeRes] = await Promise.all([
            client.from('submissions').select(SUBMISSIONS_LITE_COLUMNS).in('quiz_id', candidateCodes).order('created_at', { ascending: true }).limit(5000),
            client.from('cheating_logs').select('id, sbd, student_name, duration_str, switch_count, created_at').in('quiz_id', candidateCodes).order('created_at', { ascending: true }).limit(5000),
            client.from('active_sessions').select(ACTIVE_SESSIONS_LITE_COLUMNS).in('quiz_id', candidateCodes).limit(1000)
        ]);

        let rawSubsData = subRes.data || [];
        let activeData = activeRes.data || [];
        let cheatData = cheatRes.data || [];

        if (rawSubsData.length === 0 && examTitle && examTitle.trim() !== "") {
            const { data: extraSubs } = await client
                .from('submissions')
                .select(SUBMISSIONS_LITE_COLUMNS)
                .ilike('exam_title', `%${examTitle.trim()}%`)
                .order('created_at', { ascending: true })
                .limit(5000);
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

        const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
        const examMeta = { quizId, maDe, examTitle, quizObj };

        _examResultsCache[`${targetCatId}_${quizId}`] = {
            submissionsListRaw: rawSubs,
            cheatingLogsData: cheatingLogsList,
            activeSessionsData: activeSessionsMap,
            liveDraftsData: {},
            examMeta: examMeta
        };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsList, activeSessionsMap, {}, item, examMeta, { isSilent });

    } catch(err) {
        console.error("❌ Lỗi nạp bảng điểm Supabase:", err);
        const tbody = document.getElementById("result-table-tbody");
        if (tbody && !isSilent) tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; font-weight:700; color:#dc2626;">❌ Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

function renderExamResultTable(categoryId, submissionsListRaw, cheatingInput, activeSessionsMap, liveDraftsMap, examItem, examMeta = {}, renderOpts = {}) {
    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];

    const cheatEntriesBySbd = {};
    const cheatList = Array.isArray(cheatingInput)
        ? cheatingInput
        : Object.values(cheatingInput || {});

    cheatList.forEach(log => {
        if (!log) return;
        const sbdKey = cleanSbdStandard(log.sbd);
        if (!sbdKey || sbdKey === "---") return;

        const dur = String(log.durationStr || "").trim();
        const sCount = parseInt(log.switchCount, 10) || 0;

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
            if (usedSubIds.has(sub.id)) continue;
            const subSbdRaw = sub.sbd || sub.studentId || "";
            const hasValidSubSbd = Boolean(subSbdRaw && String(subSbdRaw).trim() !== "" && String(subSbdRaw).trim() !== "---");

            let isSbdMatch = hasValidSubSbd && isSbdMatchedFlexibly(acc.sbd, subSbdRaw);
            let subNameNorm = typeof normalizeName === 'function' ? normalizeName(sub.studentName || sub.name) : "";
            let isNameMatch = (!hasValidSubSbd && accNameNorm && subNameNorm && accNameNorm === subNameNorm);

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

        let selectedAttemptIndex = 0;
        const savedAttemptIdx = window._userSelectedAttemptsBySbd[accSbdClean];
        if (savedAttemptIdx !== undefined && savedAttemptIdx >= 0 && savedAttemptIdx < matchedSubs.length) {
            selectedAttemptIndex = savedAttemptIdx;
        }

        const rowObj = {
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
            cheatEntries: findCheatEntriesForSbd(cheatEntriesBySbd, acc.sbd)
        };
        const initialCheat = getAttemptCheatStats(rowObj, matchedSubs[selectedAttemptIndex] || null);
        rowObj.cheatTimeString = initialCheat.timeString;
        rowObj.cheatLogsTabCount = initialCheat.tabCount;

        finalRows.push(rowObj);
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

        const rowObj = {
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
            cheatEntries: findCheatEntriesForSbd(cheatEntriesBySbd, sess.sbd || sessKey)
        };
        const initialCheat = getAttemptCheatStats(rowObj, null);
        rowObj.cheatTimeString = initialCheat.timeString;
        rowObj.cheatLogsTabCount = initialCheat.tabCount;

        finalRows.push(rowObj);
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
            const curCheat = getAttemptCheatStats(existingFreeRow, existingFreeRow.allAttempts[existingFreeRow.selectedAttemptIndex] || null);
            existingFreeRow.cheatTimeString = curCheat.timeString;
            existingFreeRow.cheatLogsTabCount = curCheat.tabCount;
            usedSubIds.add(sub.id);
            continue;
        }

        const freeAcc = {
            sbd: String(rawSbd).replace(/_lan\d+$/i, '') || "---",
            name: sub.studentName || "Thí sinh tự do",
            className: sub.studentClass || "Tự do"
        };

        usedSubIds.add(sub.id);

        const rowObj = {
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
            cheatEntries: findCheatEntriesForSbd(cheatEntriesBySbd, rawSbd)
        };
        const initialCheat = getAttemptCheatStats(rowObj, sub);
        rowObj.cheatTimeString = initialCheat.timeString;
        rowObj.cheatLogsTabCount = initialCheat.tabCount;

        finalRows.push(rowObj);
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
window.extractTabCountFromDataString = extractTabCountFromDataString;
window.extractTabTimesFromDataString = extractTabTimesFromDataString;
window.parseDurationTokenToSeconds = parseDurationTokenToSeconds;
window.getAttemptCheatStats = getAttemptCheatStats;
window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;
window.fetchAndRenderExamResults = fetchAndRenderExamResults;
window.renderExamResultTable = renderExamResultTable;
