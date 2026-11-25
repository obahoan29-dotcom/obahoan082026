// =========================================================
// FILE: portal-results-core.js 
// (BẢN TỐI ƯU BĂNG THÔNG 95% + ĐỒNG BỘ 100%: REALTIME IN-MEMORY PING,
//  FIX TREO "ĐANG THI" 151 PHÚT / QUÁ 90 PHÚT, TỰ ĐỘNG THU BÀI QUÁ GIỜ,
//  CHẤM TỪ LIVE_DRAFTS, XÓA ACTIVE_SESSIONS TREO & BÁO VỀ MODAL KẾT QUẢ)
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
let activeSyncDebounceTimer = null;
let _pendingSilentResultRefresh = false;
let _isResultRealtimeConnected = false;
let _cachedAdminRtCfg = null;
let _cachedAdminRtCfgTime = 0;

// BỘ QUẢN LÝ TỰ ĐỘNG THU BÀI QUÁ GIỜ TRONG MODAL KẾT QUẢ
let _overtimeMonitorInterval = null;
let _overtimeCollectDebounceTimer = null;
let _isAutoCollectingOvertime = false;
const _overtimeAttemptCooldown = new Map();
const _forceBroadcastedOvertimeKeys = new Set();

const OVERTIME_GRACE_MS = 25000;      // 25s ân hạn cho máy học sinh tự nộp lúc 90:00
const OVERTIME_HARD_FALLBACK_MS = 45000; // 45s sau hạn nếu máy HS vẫn im -> Admin tự thu chốt điểm

function getAdminRealtimeConfigSafe() {
    if (typeof window !== "undefined" && window.CURRENT_RT_CONFIG) {
        return window.CURRENT_RT_CONFIG;
    }
    if (_cachedAdminRtCfg) return _cachedAdminRtCfg;
    try {
        const raw = (typeof safeLocal !== "undefined") ? safeLocal.getItem("exam_realtime_config") : localStorage.getItem("exam_realtime_config");
        if (raw) {
            _cachedAdminRtCfg = JSON.parse(raw);
            return _cachedAdminRtCfg;
        }
    } catch(e) {}
    return { pingIntervalSec: 30 };
}

async function refreshAdminRealtimeConfigCache(client) {
    const now = Date.now();
    if (_cachedAdminRtCfg && (now - _cachedAdminRtCfgTime) < 120000) return _cachedAdminRtCfg;
    try {
        if (client) {
            const { data } = await client.from('app_key_values').select('value').eq('key', 'exam_realtime_config').maybeSingle();
            if (data && data.value) {
                _cachedAdminRtCfg = data.value;
                _cachedAdminRtCfgTime = now;
                try {
                    if (typeof safeLocal !== "undefined") safeLocal.setItem("exam_realtime_config", JSON.stringify(data.value));
                } catch(e) {}
                return _cachedAdminRtCfg;
            }
        }
    } catch(e) {}
    return getAdminRealtimeConfigSafe();
}

function getEffectiveExamTimeLimitMs(examItem, examMeta = {}) {
    const mins = parseInt(
        examItem?.timeLimitMinutes ||
        examItem?.time_limit_minutes ||
        examMeta?.quizObj?.time_limit_minutes ||
        90,
        10
    );
    const validMins = (!isNaN(mins) && mins > 0) ? mins : 90;
    return {
        timeLimitMinutes: validMins,
        examDurationMs: validMins * 60 * 1000,
        maxExamDurationMs: validMins * 60 * 1000 + OVERTIME_GRACE_MS
    };
}

function showResultModalToast(message, isError = false) {
    const modal = document.getElementById("result-fullscreen-modal");
    if (!modal || modal.style.display !== "flex") return;

    let toast = document.getElementById("result-modal-auto-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "result-modal-auto-toast";
        toast.style.cssText = `
            position: fixed;
            top: 38px;
            left: 50%;
            transform: translateX(-50%) translateY(-10px);
            padding: 8px 18px;
            border-radius: 999px;
            font-size: 12.5px;
            font-weight: 800;
            color: #ffffff;
            z-index: 2147483645;
            box-shadow: 0 10px 28px rgba(15, 23, 42, 0.35);
            border: 1.5px solid rgba(255, 255, 255, 0.5);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.22s ease, transform 0.22s ease;
            max-width: 92vw;
            text-align: center;
        `;
        modal.appendChild(toast);
    }

    toast.style.background = isError
        ? "linear-gradient(135deg, #ef4444, #b91c1c)"
        : "linear-gradient(135deg, #059669, #0284c7)";
    toast.textContent = message;
    void toast.offsetWidth;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    if (toast._hideTimer) clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(-10px)";
    }, 4500);
}

function debouncedRefreshResults(delayMs = 600) {
    if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
    realtimeDebounceTimer = setTimeout(() => {
        if (currentExamResultData.item) {
            fetchAndRenderExamResults(currentExamResultData.item, true);
        }
    }, delayMs);
}

function debouncedLightweightActiveSync(delayMs = 900) {
    if (activeSyncDebounceTimer) clearTimeout(activeSyncDebounceTimer);
    activeSyncDebounceTimer = setTimeout(() => {
        if (currentExamResultData.item) {
            syncExamResultsLightweight();
        }
    }, delayMs);
}

// Khi Thầy chuyển từ tab khác quay lại bảng điểm đang mở, nếu có cập nhật chờ thì tải bù ngay
document.addEventListener("visibilitychange", function() {
    if (!document.hidden && currentExamResultData.item) {
        const modal = document.getElementById("result-fullscreen-modal");
        if (modal && modal.style.display === "flex") {
            if (_pendingSilentResultRefresh) {
                _pendingSilentResultRefresh = false;
                fetchAndRenderExamResults(currentExamResultData.item, true);
            } else {
                syncExamResultsLightweight();
            }
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

// Sắp xếp chuỗi chi tiết theo Numeric Sort chuẩn
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

function stopOvertimeMonitor() {
    if (_overtimeMonitorInterval) {
        clearInterval(_overtimeMonitorInterval);
        _overtimeMonitorInterval = null;
    }
    if (_overtimeCollectDebounceTimer) {
        clearTimeout(_overtimeCollectDebounceTimer);
        _overtimeCollectDebounceTimer = null;
    }
}

function startOvertimeMonitor() {
    stopOvertimeMonitor();
    _overtimeMonitorInterval = setInterval(() => {
        const modal = document.getElementById("result-fullscreen-modal");
        if (!modal || modal.style.display !== "flex" || !currentExamResultData.item) return;

        const targetCatId = currentExamResultData.item.categoryId || currentExamResultData.categoryId || "them-11";
        const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(currentExamResultData.item) : null) || currentExamResultData.item.id || "";
        const cached = _examResultsCache[`${targetCatId}_${quizId}`];
        if (!cached) return;

        const { maxExamDurationMs } = getEffectiveExamTimeLimitMs(currentExamResultData.item, cached.examMeta || {});
        const nowMs = Date.now();
        const hasExpiredActiveRow = (currentExamResultData.rawRows || []).some(r =>
            r && r.isDoing && r.doingStartTime && (nowMs - r.doingStartTime) >= maxExamDurationMs
        );

        if (hasExpiredActiveRow) {
            renderExamResultTable(
                targetCatId,
                cached.submissionsListRaw,
                cached.cheatingLogsData,
                cached.activeSessionsData,
                cached.liveDraftsData || {},
                currentExamResultData.item,
                cached.examMeta || { quizId }
            );
        }
    }, 10000);
}

function stopRealtimeSubmissionsListener() {
    stopOvertimeMonitor();
    if (realtimeDebounceTimer) {
        clearTimeout(realtimeDebounceTimer);
        realtimeDebounceTimer = null;
    }
    if (activeSyncDebounceTimer) {
        clearTimeout(activeSyncDebounceTimer);
        activeSyncDebounceTimer = null;
    }
    _pendingSilentResultRefresh = false;
    _isResultRealtimeConnected = false;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (realtimeSubmissionsChannel && client) {
        try { client.removeChannel(realtimeSubmissionsChannel); } catch(e) {}
        realtimeSubmissionsChannel = null;
    }
}

function buildActiveSessionsMapFromArray(activeData, preferredQuizId = "") {
    const activeSessionsMap = {};
    (activeData || []).forEach(a => {
        if (!a || !a.sbd) return;
        const rawKey = String(a.sbd).trim();
        const cleanKey = cleanSbdStandard(a.sbd);
        const sessObj = {
            id: a.id || `${a.quiz_id || ''}_${rawKey}`,
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
        const curTime = Number(sessObj.lastPing || sessObj.startTime || 0);
        const isPref = preferredQuizId && String(sessObj.quizId || "") === String(preferredQuizId);

        [rawKey, cleanKey].forEach(k => {
            if (!k) return;
            const existing = activeSessionsMap[k];
            if (!existing) {
                activeSessionsMap[k] = sessObj;
            } else {
                const exPref = preferredQuizId && String(existing.quizId || "") === String(preferredQuizId);
                const exTime = Number(existing.lastPing || existing.startTime || 0);
                if ((isPref && !exPref) || (isPref === exPref && curTime >= exTime)) {
                    activeSessionsMap[k] = sessObj;
                }
            }
        });
    });
    return activeSessionsMap;
}

// XỬ LÝ THÔNG MINH CẬP NHẬT PING TRÊN RAM (0 BYTE TRUY VẤN SUPABASE)
function handleRealtimeActiveSessionChange(newRow, eventType) {
    if (eventType === 'DELETE') {
        debouncedLightweightActiveSync(900);
        return;
    }

    if (!newRow || !newRow.sbd) {
        if (eventType === 'INSERT') debouncedLightweightActiveSync(600);
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
        id: newRow.id || `${newRow.quiz_id || quizId}_${rawKey}`,
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

    const { maxExamDurationMs } = getEffectiveExamTimeLimitMs(currentItem, cached ? cached.examMeta : {});
    const nowMs = Date.now();
    const rawStart = Number(newRow.start_time || 0);
    const lastPing = Number(newRow.last_ping || rawStart || nowMs);
    const timeSinceStart = rawStart > 0 ? Math.max(0, nowMs - rawStart) : 0;

    // Nếu phiên vừa cập nhật đã quá thời gian làm bài -> KHÔNG hiển thị "Đang thi", kích hoạt tự thu ngay
    if (timeSinceStart >= maxExamDurationMs) {
        if (cached) {
            renderExamResultTable(
                targetCatId,
                cached.submissionsListRaw,
                cached.cheatingLogsData,
                cached.activeSessionsData,
                cached.liveDraftsData || {},
                currentItem,
                cached.examMeta || { quizId }
            );
        } else {
            debouncedLightweightActiveSync(400);
        }
        return;
    }

    const rows = currentExamResultData.rawRows || [];
    const matchedRow = rows.find(r => r && r.account && isSbdMatchedFlexibly(r.account.sbd, newRow.sbd));

    if (eventType === 'UPDATE') {
        if (matchedRow && matchedRow.isDoing && !matchedRow.isAwayApp) {
            return;
        }
        if (matchedRow && matchedRow.isDoing && matchedRow.isAwayApp) {
            matchedRow.isAwayApp = false;
            if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
            return;
        }
        if (matchedRow && !matchedRow.isDoing) {
            const latestSubTime = matchedRow.allAttempts.length > 0
                ? getSubmissionTimestamp(matchedRow.allAttempts[matchedRow.allAttempts.length - 1])
                : 0;
            const isNewerThanLatestSub = matchedRow.allAttempts.length === 0 ||
                rawStart > (latestSubTime + 2000) ||
                (rawStart >= (latestSubTime - 60000) && lastPing > (latestSubTime + 10000));
            if (isNewerThanLatestSub) {
                matchedRow.isDoing = true;
                matchedRow.isAwayApp = false;
                matchedRow.doingStartTime = rawStart > 0 ? rawStart : lastPing;
                if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
            }
            return;
        }
        if (!matchedRow) {
            if (typeof isSbdBelongsToCategory === 'function' && !isSbdBelongsToCategory(newRow.sbd, targetCatId)) {
                return;
            }
            const nextStt = rows.length + 1;
            rows.push({
                _rowUid: 'row_free_doing_' + cleanKey,
                stt: nextStt,
                isClassStudent: false,
                account: {
                    sbd: newRow.sbd || "---",
                    name: newRow.name || newRow.student_name || "Thí sinh tự do",
                    className: newRow.class_name || "Tự do"
                },
                allAttempts: [],
                selectedAttemptIndex: 0,
                isDoing: true,
                isAwayApp: false,
                doingStartTime: rawStart > 0 ? rawStart : lastPing,
                isFreeDoing: true,
                cheatTimeString: "0s",
                cheatLogsTabCount: 0
            });
            if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
        }
        return;
    }

    if (eventType === 'INSERT') {
        if (matchedRow) {
            matchedRow.isDoing = true;
            matchedRow.isAwayApp = false;
            matchedRow.doingStartTime = rawStart > 0 ? rawStart : lastPing;
            if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
            return;
        }
        if (typeof isSbdBelongsToCategory === 'function' && !isSbdBelongsToCategory(newRow.sbd, targetCatId)) {
            return;
        }
        const nextStt = rows.length + 1;
        rows.push({
            _rowUid: 'row_free_doing_' + cleanKey,
            stt: nextStt,
            isClassStudent: false,
            account: {
                sbd: newRow.sbd || "---",
                name: newRow.name || newRow.student_name || "Thí sinh tự do",
                className: newRow.class_name || "Tự do"
            },
            allAttempts: [],
            selectedAttemptIndex: 0,
            isDoing: true,
            isAwayApp: false,
            doingStartTime: rawStart > 0 ? rawStart : lastPing,
            isFreeDoing: true,
            cheatTimeString: "0s",
            cheatLogsTabCount: 0
        });
        if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(rows);
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
            channel = channel.on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'submissions', 
                filter: `quiz_id=eq.${id}` 
            }, () => debouncedRefreshResults(700));

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
            }, () => handleRealtimeActiveSessionChange(null, 'DELETE'));

            channel = channel.on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'active_sessions', 
                filter: `quiz_id=eq.${id}` 
            }, (payload) => handleRealtimeActiveSessionChange(payload && payload.new, 'UPDATE'));
        });

        channel.subscribe((status) => {
            _isResultRealtimeConnected = (status === 'SUBSCRIBED');
        });
        realtimeSubmissionsChannel = channel;
    } catch(e) {
        _isResultRealtimeConnected = false;
        console.warn("Lỗi gắn Supabase Realtime:", e);
    }

    startOvertimeMonitor();
}

// TRUY VẤN AN TOÀN CÓ FALLBACK NẾU SCHEMA THIẾU CỘT
async function queryActiveSessionsSafely(client, candidateCodes) {
    const ACTIVE_SLIM_COLS = 'quiz_id, sbd, name, class_name, start_time, last_ping, is_free, category_id, exam_title';
    let res = await client.from('active_sessions').select(ACTIVE_SLIM_COLS).in('quiz_id', candidateCodes);
    if (res && res.error) {
        res = await client.from('active_sessions').select('*').in('quiz_id', candidateCodes);
    }
    return res;
}

async function queryCheatingLogsSafely(client, candidateCodes) {
    const CHEAT_SLIM_COLS = 'sbd, student_name, duration_str, switch_count';
    let res = await client.from('cheating_logs').select(CHEAT_SLIM_COLS).in('quiz_id', candidateCodes);
    if (res && res.error) {
        res = await client.from('cheating_logs').select('*').in('quiz_id', candidateCodes);
    }
    return res;
}

async function querySubmissionsSafely(client, candidateCodes) {
    const SUB_SLIM_COLS = 'id, quiz_id, sbd, student_name, class_name, score10, raw_score, correct_count, wrong_count, completion_time, spent_mins, tab_switch_count, data_string, created_at, is_free, category_id';
    let res = await client.from('submissions').select(SUB_SLIM_COLS).in('quiz_id', candidateCodes).order('created_at', { ascending: true });
    if (res && res.error) {
        res = await client.from('submissions').select('*').in('quiz_id', candidateCodes).order('created_at', { ascending: true });
    }
    return res;
}

// ĐỒNG BỘ SIÊU NHẸ (~300 BYTES): CHỈ KIỂM TRA active_sessions & ĐẾM HEAD submissions + PHÁT HIỆN QUÁ GIỜ
async function syncExamResultsLightweight() {
    const item = currentExamResultData.item;
    if (!item) return;

    const modal = document.getElementById("result-fullscreen-modal");
    if (!modal || modal.style.display !== "flex") return;

    if (typeof document !== 'undefined' && document.hidden) {
        _pendingSilentResultRefresh = true;
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return;

    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(item) : null) || item.id || item.quizId || item.firebaseId || "";
    const maDe = item.made || item.maDe || "";
    const examTitle = item.title || "";
    const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
    const cacheKey = `${targetCatId}_${quizId}`;
    const cached = _examResultsCache[cacheKey];

    if (!cached) {
        return fetchAndRenderExamResults(item, true);
    }

    let candidateCodes = [];
    if (typeof getExamCandidateCodes === 'function') {
        candidateCodes = getExamCandidateCodes(examTitle, maDe, quizId);
    }
    if (quizId && !candidateCodes.includes(String(quizId).trim())) {
        candidateCodes.push(String(quizId).trim());
    }

    try {
        const [activeRes, subCountRes] = await Promise.all([
            queryActiveSessionsSafely(client, candidateCodes),
            client.from('submissions').select('id', { count: 'exact', head: true }).in('quiz_id', candidateCodes)
        ]);

        if (!subCountRes.error && typeof subCountRes.count === 'number') {
            const prevServerCount = cached.rawServerSubCount ?? cached.submissionsListRaw.length;
            if (subCountRes.count !== prevServerCount) {
                return fetchAndRenderExamResults(item, true);
            }
        }

        const { maxExamDurationMs } = getEffectiveExamTimeLimitMs(item, cached.examMeta || {});
        const nowMs = Date.now();
        let hasExpiredSession = false;

        if (activeRes && !activeRes.error && Array.isArray(activeRes.data)) {
            const newActiveMap = buildActiveSessionsMapFromArray(activeRes.data, quizId);
            const oldKeys = Object.keys(cached.activeSessionsData || {}).sort();
            const newKeys = Object.keys(newActiveMap).sort();

            for (const k of newKeys) {
                const s = newActiveMap[k];
                const rawStart = Number(s?.startTime || 0);
                if (rawStart > 0 && (nowMs - rawStart) >= maxExamDurationMs) {
                    hasExpiredSession = true;
                    break;
                }
            }

            let hasMeaningfulChange = hasExpiredSession || (oldKeys.length !== newKeys.length);
            if (!hasMeaningfulChange) {
                for (let i = 0; i < newKeys.length; i++) {
                    const k = newKeys[i];
                    if (oldKeys[i] !== k) { hasMeaningfulChange = true; break; }
                    const oS = cached.activeSessionsData[k];
                    const nS = newActiveMap[k];
                    if (!oS || Number(oS.startTime || 0) !== Number(nS.startTime || 0)) {
                        hasMeaningfulChange = true;
                        break;
                    }
                    const oldPing = Number(oS.lastPing || oS.startTime || 0);
                    const newPing = Number(nS.lastPing || nS.startTime || 0);
                    if (newPing > oldPing) {
                        const matchedRow = (currentExamResultData.rawRows || []).find(r => r && r.account && isSbdMatchedFlexibly(r.account.sbd, nS.sbd));
                        if (!matchedRow || !matchedRow.isDoing || matchedRow.isAwayApp) {
                            hasMeaningfulChange = true;
                            break;
                        }
                    }
                }
            }

            cached.activeSessionsData = newActiveMap;

            if (hasMeaningfulChange) {
                renderExamResultTable(
                    targetCatId,
                    cached.submissionsListRaw,
                    cached.cheatingLogsData,
                    newActiveMap,
                    cached.liveDraftsData || {},
                    item,
                    cached.examMeta || { quizId, maDe, examTitle }
                );
                const searchInput = document.getElementById("result-search-input");
                if (searchInput && searchInput.value.trim() !== "" && typeof filterResultTable === "function") {
                    filterResultTable();
                }
            }
        }
    } catch(e) {}
}

async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item) return;

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

    await refreshAdminRealtimeConfigCache(client);

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
            querySubmissionsSafely(client, candidateCodes),
            queryCheatingLogsSafely(client, candidateCodes),
            queryActiveSessionsSafely(client, candidateCodes)
        ]);

        let rawSubsData = (subRes && subRes.data) ? subRes.data : [];
        let activeData = (activeRes && activeRes.data) ? activeRes.data : [];
        let cheatData = (cheatRes && cheatRes.data) ? cheatRes.data : [];
        const rawServerSubCount = rawSubsData.length;

        if (rawSubsData.length === 0 && examTitle && examTitle.trim() !== "") {
            const { data: extraSubs } = await client
                .from('submissions')
                .select('id, quiz_id, sbd, student_name, class_name, score10, raw_score, correct_count, wrong_count, completion_time, spent_mins, tab_switch_count, data_string, created_at, is_free, category_id')
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
        cheatData.forEach((c, idx) => {
            const key = c.id || `cheat_${idx}`;
            cheatingLogsMap[key] = {
                sbd: c.sbd,
                studentName: c.student_name,
                durationStr: c.duration_str,
                switchCount: c.switch_count
            };
        });

        const activeSessionsMap = buildActiveSessionsMapFromArray(activeData, quizId);
        const liveDraftsMap = {};
        const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
        const examMeta = { quizId, maDe, examTitle, quizObj };

        _examResultsCache[`${targetCatId}_${quizId}`] = {
            submissionsListRaw: rawSubs,
            rawServerSubCount: rawServerSubCount,
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

function scheduleOvertimeAutoCollect(overtimeSessions, categoryId, examItem, examMeta) {
    if (!Array.isArray(overtimeSessions) || overtimeSessions.length === 0) return;
    if (_overtimeCollectDebounceTimer) clearTimeout(_overtimeCollectDebounceTimer);
    _overtimeCollectDebounceTimer = setTimeout(() => {
        autoCollectOvertimeSessions(overtimeSessions, categoryId, examItem, examMeta);
    }, 350);
}

// BỘ MÁY TỰ ĐỘNG THU BÀI KHI HỌC SINH QUÁ THỜI GIAN ĐỀ THI (VD > 90 PHÚT)
async function autoCollectOvertimeSessions(overtimeSessions, categoryId, examItem, examMeta = {}) {
    if (_isAutoCollectingOvertime || !Array.isArray(overtimeSessions) || overtimeSessions.length === 0) return;

    const modal = document.getElementById("result-fullscreen-modal");
    if (!modal || modal.style.display !== "flex") return;

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return;

    const nowMs = Date.now();
    const { timeLimitMinutes, examDurationMs } = getEffectiveExamTimeLimitMs(examItem, examMeta);
    const quizId = examMeta.quizId || (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(examItem) : null) || examItem?.id || "";
    if (!quizId) return;

    // Lọc các phiên chưa bị cooldown (tránh lặp vô hạn nếu lỗi mạng)
    const eligible = overtimeSessions.filter(entry => {
        const s = entry.sess;
        if (!s || !s.sbd) return false;
        const cKey = `${s.quizId || quizId}_${cleanSbdStandard(s.sbd)}_${entry.rawStartTime || 0}`;
        const lastTry = _overtimeAttemptCooldown.get(cKey) || 0;
        return (nowMs - lastTry) > 15000;
    });

    if (eligible.length === 0) return;

    _isAutoCollectingOvertime = true;

    try {
        const activeTargetQuizIds = Array.from(new Set(eligible.map(e => String(e.sess.quizId || quizId).trim()).filter(Boolean)));
        if (!activeTargetQuizIds.includes(quizId)) activeTargetQuizIds.push(quizId);

        // 1. Tải mới nhất submissions & live_drafts + đề gốc quizzes 1 lần cho cả đợt thu
        const [freshSubRes, draftsRes, quizObj] = await Promise.all([
            querySubmissionsSafely(client, activeTargetQuizIds),
            client.from('live_drafts').select('*').in('quiz_id', activeTargetQuizIds),
            getQuizObjectSafely(client, activeTargetQuizIds)
        ]);

        const freshSubs = (freshSubRes && Array.isArray(freshSubRes.data)) ? freshSubRes.data : [];
        const allDrafts = (draftsRes && Array.isArray(draftsRes.data)) ? draftsRes.data : [];

        // Chuẩn bị kho đáp án gốc nếu tải được đề thi
        let answerVault = {};
        const letters = ["A", "B", "C", "D"];
        if (quizObj && Array.isArray(quizObj.questions)) {
            quizObj.questions.forEach(q => {
                if (q.type === "multiple_choice" && (typeof isPart4Question !== 'function' || !isPart4Question(q))) {
                    let c = q.correct !== undefined ? q.correct : q.answer;
                    if (c !== undefined) {
                        answerVault[`q${q.id}`] = typeof c === 'number' ? letters[c] : String(c).trim().toUpperCase();
                    }
                } else if (q.type === "true_false" && (typeof isPart4Question !== 'function' || !isPart4Question(q))) {
                    (q.statements || []).forEach(st => {
                        let stVal = st.correct !== undefined ? st.correct : st.answer;
                        answerVault[`q${q.id}_${st.id}`] = (stVal === true || String(stVal).toLowerCase() === 'đúng' || String(stVal).toLowerCase() === 'true') ? "Đúng" : "Sai";
                    });
                } else {
                    let ans = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : q.answer);
                    if (ans !== undefined) answerVault[`q${q.id}`] = String(ans).trim();
                }
            });
        }

        const broadcastSbds = [];
        let collectedCount = 0;
        let cleanedAlreadySubmittedCount = 0;

        for (const entry of eligible) {
            const s = entry.sess;
            const sessQuizId = String(s.quizId || quizId).trim();
            const rawSbd = String(s.sbd).trim();
            const cleanSbd = rawSbd.replace(/[^a-zA-Z0-9]/g, '_');
            const rawStart = Number(entry.rawStartTime || s.startTime || 0);
            const timeSinceStart = rawStart > 0 ? Math.max(0, nowMs - rawStart) : (examDurationMs + OVERTIME_HARD_FALLBACK_MS);
            const timeSincePing = entry.timeSincePing || 0;
            const cKey = `${sessQuizId}_${cleanSbd}_${rawStart}`;
            _overtimeAttemptCooldown.set(cKey, nowMs);

            // Kiểm tra xem em này đã kịp nộp bài cho lần thi này chưa
            const alreadySubmitted = freshSubs.some(sub => {
                if (!isSbdMatchedFlexibly(sub.sbd, rawSbd)) return false;
                const subTime = sub.created_at ? new Date(sub.created_at).getTime() : 0;
                return rawStart === 0 || subTime >= (rawStart - 5000);
            });

            if (alreadySubmitted) {
                await client.from('active_sessions').delete().match({ quiz_id: sessQuizId, sbd: rawSbd });
                await client.from('live_drafts').delete().match({ quiz_id: sessQuizId, sbd: rawSbd });
                cleanedAlreadySubmittedCount++;
                continue;
            }

            // Nếu máy học sinh vừa mới ping (< 40s) và mới quá hạn trong khoảng 25s–45s:
            // Gửi FORCE_SUBMIT tới máy học sinh để máy học sinh tự hiện điểm + nộp bản đầy đủ nhất
            if (timeSincePing < 40000 && timeSinceStart < (examDurationMs + OVERTIME_HARD_FALLBACK_MS)) {
                if (!_forceBroadcastedOvertimeKeys.has(cKey)) {
                    _forceBroadcastedOvertimeKeys.add(cKey);
                    broadcastSbds.push({ quizId: sessQuizId, sbd: cleanSbd.toLowerCase() });
                }
                continue;
            }

            // Nếu đã quá hẳn 45s sau giờ thi (hoặc máy học sinh đã tắt/mất mạng): Admin tự động thu & chốt điểm ngay!
            if (timeSincePing < 40000 && !_forceBroadcastedOvertimeKeys.has(cKey)) {
                _forceBroadcastedOvertimeKeys.add(cKey);
                broadcastSbds.push({ quizId: sessQuizId, sbd: cleanSbd.toLowerCase() });
            }

            const matchedDraft = allDrafts.find(d => d && String(d.quiz_id) === sessQuizId && isSbdMatchedFlexibly(d.sbd, rawSbd))
                || allDrafts.find(d => d && isSbdMatchedFlexibly(d.sbd, rawSbd));

            const studentName = (entry.acc && entry.acc.name) || s.name || (matchedDraft && matchedDraft.student_name) || "Thí sinh";
            const strictClassName = (entry.acc && entry.acc.className)
                || s.className
                || (matchedDraft && matchedDraft.class_name)
                || (typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(categoryId) : "Lớp");
            const examTitle = (examItem && examItem.title) || s.examTitle || (matchedDraft && matchedDraft.exam_title) || "Đề thi";
            const userAnswers = (matchedDraft && matchedDraft.user_answers && typeof matchedDraft.user_answers === 'object') ? matchedDraft.user_answers : {};
            const hasAnswers = Object.keys(userAnswers).length > 0;

            let finalScore = 0;
            let rawScore = 0;
            let maxScale = 10.0;
            let correctCount = 0;
            let wrongCount = (quizObj && Array.isArray(quizObj.questions)) ? quizObj.questions.length : 0;
            let dataString = `[HẾT GIỜ ${timeLimitMinutes} PHÚT - TỰ ĐỘNG THU BÀI (CHƯA CHỌN CÂU NÀO)]`;

            if (hasAnswers && quizObj && Array.isArray(quizObj.questions) && typeof calculateExamScoreWithConfig === 'function') {
                const scoreRes = calculateExamScoreWithConfig(
                    quizObj.questions,
                    userAnswers,
                    answerVault,
                    quizObj.scoring_config || { mode: 'option1' }
                );
                finalScore = scoreRes.finalScore;
                rawScore = scoreRes.totalRawScore;
                maxScale = scoreRes.maxScale;
                correctCount = scoreRes.correctCount;
                wrongCount = scoreRes.wrongCount;
                dataString = scoreRes.dataDetails.join(" | ") + " | [TỰ ĐỘNG THU BÀI KHI HẾT GIỜ]";
            } else if (matchedDraft && matchedDraft.score10 !== undefined && matchedDraft.score10 !== null) {
                finalScore = Number(matchedDraft.score10) || 0;
                rawScore = Number(matchedDraft.raw_score) || 0;
                maxScale = Number(matchedDraft.max_scale) || 10.0;
                correctCount = parseInt(matchedDraft.correct_count, 10) || 0;
                wrongCount = parseInt(matchedDraft.wrong_count, 10) || 0;
                dataString = (matchedDraft.data_string ? `${matchedDraft.data_string} | ` : "") + "[TỰ ĐỘNG THU BÀI KHI HẾT GIỜ]";
            }

            const existingAttemptsForSbd = freshSubs.filter(sub => isSbdMatchedFlexibly(sub.sbd, rawSbd)).length;
            const deterministicId = rawStart > 0
                ? `sub_${sessQuizId}_${cleanSbd}_ot_${rawStart}`
                : `sub_${sessQuizId}_${cleanSbd}_ot_${nowMs}`;

            const subPayload = {
                id: deterministicId,
                quiz_id: sessQuizId,
                sbd: cleanSbd,
                student_name: studentName,
                class_name: strictClassName,
                score10: finalScore,
                raw_score: rawScore,
                max_scale: maxScale,
                correct_count: correctCount,
                wrong_count: wrongCount,
                completion_time: `Hết giờ (Tự thu ${timeLimitMinutes}p)`,
                spent_mins: timeLimitMinutes,
                tab_switch_count: (matchedDraft && matchedDraft.tab_switch_count) || `${entry.cheatLogsTabCount || 0} lần`,
                data_string: dataString,
                user_answers: userAnswers,
                category_id: s.categoryId || categoryId || "them-11",
                is_free: !!s.isFree,
                ma_de: examMeta.maDe || quizObj?.made || "101",
                exam_title: examTitle,
                created_at: new Date(rawStart > 0 ? Math.min(nowMs, rawStart + examDurationMs) : nowMs).toISOString()
            };

            let savedOk = false;
            const { error: upErr } = await client.from('submissions').upsert([subPayload], { onConflict: 'id' });
            if (!upErr) {
                savedOk = true;
            } else {
                const msg = String(upErr.message || "");
                const isConstraint = msg.includes("idx_submissions_quiz_sbd") || msg.includes("unique constraint") || msg.includes("duplicate key");
                if (isConstraint) {
                    const branchPayload = {
                        ...subPayload,
                        sbd: existingAttemptsForSbd > 0 ? `${cleanSbd}_lan${existingAttemptsForSbd + 1}` : cleanSbd
                    };
                    const { error: bErr } = await client.from('submissions').upsert([branchPayload], { onConflict: 'id' });
                    if (!bErr) savedOk = true;
                }
            }

            if (savedOk) {
                await client.from('active_sessions').delete().match({ quiz_id: sessQuizId, sbd: rawSbd });
                if (matchedDraft) {
                    await client.from('live_drafts').delete().match({ quiz_id: sessQuizId, sbd: matchedDraft.sbd });
                }
                collectedCount++;
            }
        }

        // Gửi broadcast FORCE_SUBMIT tới các máy học sinh vừa chạm ngưỡng quá giờ
        if (broadcastSbds.length > 0) {
            const byQuiz = {};
            broadcastSbds.forEach(b => {
                if (!byQuiz[b.quizId]) byQuiz[b.quizId] = [];
                byQuiz[b.quizId].push(b.sbd);
            });
            for (const qIdKey in byQuiz) {
                try {
                    const ch = client.channel(`exam_force_submit_${qIdKey}`);
                    ch.subscribe(async (status) => {
                        if (status === 'SUBSCRIBED') {
                            for (const targetSbd of byQuiz[qIdKey]) {
                                await ch.send({
                                    type: 'broadcast',
                                    event: 'FORCE_SUBMIT',
                                    payload: { targetSbd, sbd: targetSbd, quizId: qIdKey, reason: 'timeout', timestamp: Date.now() }
                                });
                            }
                            setTimeout(() => { try { client.removeChannel(ch); } catch(e) {} }, 500);
                        }
                    });
                } catch(e) {}
            }
        }

        if (collectedCount > 0 || cleanedAlreadySubmittedCount > 0) {
            if (collectedCount > 0) {
                showResultModalToast(`⏰ Đã tự động thu ${collectedCount} bài thi quá ${timeLimitMinutes} phút & cập nhật điểm!`);
            }
            if (currentExamResultData.item) {
                await fetchAndRenderExamResults(currentExamResultData.item, true);
            }
        }
    } catch (err) {
        console.warn("Lỗi tự động thu bài quá giờ:", err);
    } finally {
        _isAutoCollectingOvertime = false;
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
        let durLower = dur.toLowerCase();
        if (!dur || durLower.startsWith("bắt đầu")) continue;

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
        let sbdClean = cleanSbdStandard(sess.sbd);
        let sbdRaw = String(sess.sbd || "").trim();
        if (sbdClean) activeUsersMap[sbdClean] = sess;
        if (sbdRaw) activeUsersMap[sbdRaw] = sess;
    }

    const finalRows = [];
    const usedPendingKeys = new Set();
    const usedSubIds = new Set();
    const overtimeSessionsToCollect = [];

    const { maxExamDurationMs } = getEffectiveExamTimeLimitMs(examItem, examMeta);

    const rtCfg = getAdminRealtimeConfigSafe();
    const pingSec = (rtCfg && rtCfg.pingIntervalSec !== undefined) ? parseInt(rtCfg.pingIntervalSec, 10) : 30;
    const freshThresholdMs = (pingSec === 0)
        ? maxExamDurationMs
        : Math.max(180000, pingSec * 3 * 1000);

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

        let cheatDurations = cheatHistoryBySbd[accSbdClean] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdClean] || cheatDurations.length;
        let cheatTimeString = cheatDurations.length > 0 ? cheatDurations.join(" | ") : "0s";

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
            const timeSincePing = Math.max(0, nowMs - sessPingTime);
            const timeSinceStart = rawStartTime > 0 ? Math.max(0, nowMs - rawStartTime) : 0;

            const isPingFresh = (timeSincePing < freshThresholdMs);
            // BẮT BUỘC PHẢI TRONG THỜI GIAN CHO PHÉP (< timeLimitMinutes + 25s), KHÔNG BAO GIỜ TREO 151 PHÚT!
            const isStillWithinExamTime = (timeSinceStart < maxExamDurationMs);

            if (matchedSubs.length === 0) {
                if (isStillWithinExamTime) {
                    isDoing = true;
                    isAwayApp = !isPingFresh;
                    doingStartTime = rawStartTime > 0 ? rawStartTime : (sessPingTime || nowMs);
                    usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                } else {
                    overtimeSessionsToCollect.push({
                        sess: activeSess,
                        rawStartTime: rawStartTime > 0 ? rawStartTime : sessPingTime,
                        timeSincePing,
                        acc,
                        cheatLogsTabCount
                    });
                    usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                }
            } else {
                const latestSubTime = getSubmissionTimestamp(matchedSubs[matchedSubs.length - 1]);
                const isNewAttempt = (rawStartTime > (latestSubTime + 2000)) ||
                    (rawStartTime >= (latestSubTime - 60000) && sessPingTime > (latestSubTime + 10000));
                if (isNewAttempt) {
                    if (isStillWithinExamTime) {
                        isDoing = true;
                        isAwayApp = !isPingFresh;
                        doingStartTime = rawStartTime > 0 ? rawStartTime : (sessPingTime || nowMs);
                        usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                    } else {
                        overtimeSessionsToCollect.push({
                            sess: activeSess,
                            rawStartTime: rawStartTime > 0 ? rawStartTime : sessPingTime,
                            timeSincePing,
                            acc,
                            cheatLogsTabCount
                        });
                        usedPendingKeys.add(cleanSbdStandard(activeSess.sbd));
                    }
                }
            }
        }

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
        const timeSincePing = Math.max(0, nowMs - sessPingTime);
        const timeSinceStart = rawStartTime > 0 ? Math.max(0, nowMs - rawStartTime) : 0;

        const isPingFresh = (timeSincePing < freshThresholdMs);
        const isStillWithinExamTime = (timeSinceStart < maxExamDurationMs);

        usedPendingKeys.add(cleanKey);

        const freeAcc = {
            sbd: sess.sbd || "---",
            name: sess.name || "Thí sinh tự do",
            className: sess.className || "Tự do"
        };

        if (!isStillWithinExamTime) {
            const matchedFreeSub = submissionsList.find(sub =>
                isSbdMatchedFlexibly(sess.sbd || sessKey, sub.sbd || sub.studentId) &&
                getSubmissionTimestamp(sub) >= (rawStartTime - 5000)
            );
            if (!matchedFreeSub) {
                overtimeSessionsToCollect.push({
                    sess,
                    rawStartTime: rawStartTime > 0 ? rawStartTime : sessPingTime,
                    timeSincePing,
                    acc: freeAcc,
                    cheatLogsTabCount: 0
                });
            }
            continue;
        }

        finalRows.push({
            _rowUid: 'row_free_doing_' + cleanKey,
            stt: freeSttCounter++,
            isClassStudent: false,
            account: freeAcc,
            allAttempts: [],
            selectedAttemptIndex: 0,
            isDoing: true,
            isAwayApp: !isPingFresh,
            doingStartTime: rawStartTime > 0 ? rawStartTime : (sessPingTime || nowMs),
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

    // KÍCH HOẠT TỰ ĐỘNG THU BÀI NẾU PHÁT HIỆN THÍ SINH QUÁ THỜI GIAN ĐỀ THI
    if (overtimeSessionsToCollect.length > 0) {
        scheduleOvertimeAutoCollect(overtimeSessionsToCollect, categoryId, examItem, examMeta);
    }
}

// BỘ HỖ TRỢ THU TỰ ĐỘNG THỦ CÔNG (KHI GỌI TỪ NÚT NGOÀI MODAL)
async function triggerAutoCollectDrafts(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const item = currentExamResultData.item;
    if (!item) return;
    const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
    const quizId = (typeof extractQuizIdFromItem === 'function' ? extractQuizIdFromItem(item) : null) || item.id || "";
    const cached = _examResultsCache[`${targetCatId}_${quizId}`];
    if (!cached) {
        await fetchAndRenderExamResults(item, false);
        return;
    }

    const sessions = Object.values(cached.activeSessionsData || {});
    if (sessions.length === 0) {
        showResultModalToast("ℹ️ Hiện không có học sinh nào đang thi cần thu bài!");
        return;
    }

    const uniqueBySbd = new Map();
    sessions.forEach(s => {
        if (s && s.sbd) uniqueBySbd.set(cleanSbdStandard(s.sbd), s);
    });

    const entries = Array.from(uniqueBySbd.values()).map(s => ({
        sess: s,
        rawStartTime: Number(s.startTime || 0),
        timeSincePing: 999999,
        acc: { sbd: s.sbd, name: s.name, className: s.className },
        cheatLogsTabCount: 0
    }));

    _overtimeAttemptCooldown.clear();
    await autoCollectOvertimeSessions(entries, targetCatId, item, cached.examMeta || { quizId });
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
window.syncExamResultsLightweight = syncExamResultsLightweight;
window.renderExamResultTable = renderExamResultTable;
window.autoCollectOvertimeSessions = autoCollectOvertimeSessions;
window.triggerAutoCollectDrafts = triggerAutoCollectDrafts;
window.showResultModalToast = showResultModalToast;
