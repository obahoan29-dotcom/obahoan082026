// =========================================================
// FILE: exam-api.js
// QUẢN LÝ KẾT NỐI REALTIME, ĐỒNG BỘ THỜI GIAN, PHÒNG THI & SĨ SỐ
// ĐÃ TỐI ƯU BĂNG THÔNG: BỎ .select() THỪA KHI PING & CHỐNG PING KÉP
// ĐÃ TỐI ƯU HOÀN TOÀN CHO IPHONE TRONG TRÌNH DUYỆT NHÚNG MESSENGER & SAFARI (IOS WEBKIT)
// =========================================================

const URL1_TAB_CHEATING = "https://script.google.com/macros/s/AKfycbzAPaLBO8gjPdbzrXOhvChUMzBHsnrhIMbJQIsDhqFtNfsW2Rf1Dki-bYJf-YCM-CCU/exec";
const URL2_EXAM_RESULT  = "https://script.google.com/macros/s/AKfycbx4ezz_9YOZKt9-idYUKz8N1dXg-LeIG-_UknLYKBVZJpxCJRx3yNHwfdWEQp-yhOISog/exec";

let examData = null;
let EXAM_NAME = "ĐỀ THI TRẮC NGHIỆM";
let EXAM_PASSWORD = ""; 
let TIME_LIMIT_MINUTES = 45;  

let tabSwitchCount = 0;
let leaveTime = 0;
let isTabHidden = false;
let timerInterval = null;
let isShowOnlineCountEnabled = true;

let isSubmitted = false;
let examStartTime = null;
let totalTimeSeconds = 45 * 60;
let remainingSeconds = 45 * 60;

let totalQuestionsCount = 0;
let currentActiveQId = null;
let pendingSubmissionPayload = null;
let presenceInterval = null;
let realtimeConfigChannel = null;
let onlineRealtimeChannel = null;
let forceSubmitRealtimeChannel = null;

window.localOnlineCount = 1; 

// Hàm nhận diện In-App Browser (Messenger, Facebook, Zalo, Instagram)
function isMobileInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /FBAN|FBAV|Messenger|Instagram|Zalo|Line|Twitter|Kakaotalk/i.test(ua);
}

// CẤU HÌNH LẮNG NGHE REALTIME TOÀN CỤC
window.CURRENT_RT_CONFIG = {
    watchOnlineCount: true,
    watchForceSubmit: true,
    watchTimeConfig: true,
    watchImageSync: true,
    pingIntervalSec: 25
};

async function loadRealtimeExamConfig() {
    try {
        const rawLocal = safeLocal.getItem("exam_realtime_config");
        if (rawLocal) {
            window.CURRENT_RT_CONFIG = { ...window.CURRENT_RT_CONFIG, ...JSON.parse(rawLocal) };
        }

        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) {
            const { data } = await client.from('app_key_values').select('value').eq('key', 'exam_realtime_config').maybeSingle();
            if (data && data.value) {
                window.CURRENT_RT_CONFIG = { ...window.CURRENT_RT_CONFIG, ...data.value };
                safeLocal.setItem("exam_realtime_config", JSON.stringify(window.CURRENT_RT_CONFIG));
            }
        }
    } catch(e) {}
}

loadRealtimeExamConfig();

// CHỦ ĐỘNG GỠ BỎ TOÀN BỘ SERVICE WORKER ĐỂ CHỐNG VĂNG VÀ TREO TRÊN IOS WEBKIT
if ('serviceWorker' in navigator) {
    try {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (let reg of registrations) {
                reg.unregister().catch(() => {});
            }
        }).catch(() => {});
    } catch(e) {}
}

let wakeLockSentinel = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && navigator.wakeLock && typeof navigator.wakeLock.request === 'function') {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
        }
    } catch (err) {
        wakeLockSentinel = null;
    }
}

function getExamCategory() {
    const urlParams = new URLSearchParams(window.location.search);
    let cat = urlParams.get('cat'); 
    if (cat) return cat;
    try {
        const raw = safeLocal.getItem("current_exam_student");
        if (raw) { 
            const parsed = JSON.parse(raw); 
            if (parsed && parsed.categoryId) return parsed.categoryId; 
        }
    } catch(e) {}
    return "them-11";
}

function findStudentFromDatabase(query, preferredCat = null) {
    if (!query || !window.STUDENT_ACCOUNTS) return null;
    const q = String(query).trim().toLowerCase();
    
    if (preferredCat && window.STUDENT_ACCOUNTS[preferredCat]) {
        const list = window.STUDENT_ACCOUNTS[preferredCat];
        const matched = list.find(acc => 
            (acc.sbd && String(acc.sbd).trim().toLowerCase() === q) || 
            (acc.username && String(acc.username).trim().toLowerCase() === q) || 
            (acc.name && String(acc.name).trim().toLowerCase() === q)
        );
        if (matched) return matched;
    }
    
    for (let c in window.STUDENT_ACCOUNTS) {
        const list = window.STUDENT_ACCOUNTS[c];
        if (Array.isArray(list)) {
            const m = list.find(acc => 
                (acc.sbd && String(acc.sbd).trim().toLowerCase() === q) || 
                (acc.username && String(acc.username).trim().toLowerCase() === q) || 
                (acc.name && String(acc.name).trim().toLowerCase() === q)
            );
            if (m) return m;
        }
    }
    return null;
}

function findStudentByPassword(passQuery, preferredCat = null) {
    if (!passQuery || !window.STUDENT_ACCOUNTS) return null;
    const p = String(passQuery).trim().toLowerCase();
    if (preferredCat && window.STUDENT_ACCOUNTS[preferredCat]) {
        const list = window.STUDENT_ACCOUNTS[preferredCat];
        const matched = list.find(acc => String(acc.pass).trim().toLowerCase() === p);
        if (matched) return matched;
    }
    for (let c in window.STUDENT_ACCOUNTS) {
        const list = window.STUDENT_ACCOUNTS[c];
        if (Array.isArray(list)) {
            const m = list.find(acc => String(acc.pass).trim().toLowerCase() === p);
            if (m) return m;
        }
    }
    return null;
}

function applyStudentToUI(student) {
    if (!student) return;
    const sName = student.name || student.username || "Thí sinh";
    const sId = student.sbd || student.id || "---";
    const sClass = student.className || student.lop || "---";

    const nameEl = document.getElementById("student-name"); 
    const idEl = document.getElementById("student-id"); 
    const classEl = document.getElementById("student-class");
    if (nameEl) nameEl.value = sName; 
    if (idEl) idEl.value = sId; 
    if (classEl) classEl.value = sClass;

    const navName = document.getElementById("nav-student-name"); 
    const navId = document.getElementById("nav-student-id"); 
    const navClass = document.getElementById("nav-student-class");
    if (navName) navName.innerText = sName; 
    if (navId) navId.innerText = sId; 
    if (navClass) navClass.innerText = sClass;

    safeLocal.setItem("saved_student_name", sName); 
    safeLocal.setItem("saved_student_sbd", sId); 
    safeLocal.setItem("saved_student_class", sClass);

    checkAndDisplayAttemptNoticeOnStudentCard(sId);

    if (typeof renderStudentSubmissionHistoryButtons === 'function') {
        renderStudentSubmissionHistoryButtons();
    }
}

async function checkAndDisplayAttemptNoticeOnStudentCard(sId) {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);
    if (!quizId || !sId) return;

    let attempt = 1;
    if (typeof fetchStudentAttemptNumberFromCloud === 'function') {
        attempt = await fetchStudentAttemptNumberFromCloud(quizId, sId);
    } else if (typeof getRealStudentExamAttemptNumber === 'function') {
        attempt = getRealStudentExamAttemptNumber(quizId, sId);
    }

    window.currentStudentAttemptNumber = attempt;

    let badgeEl = document.getElementById("student-card-attempt-notice");
    if (!badgeEl) {
        badgeEl = document.createElement("div");
        badgeEl.id = "student-card-attempt-notice";
        badgeEl.style.cssText = `
            margin: 10px auto 14px auto;
            padding: 8px 14px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 800;
            text-align: center;
            display: none;
        `;
        const startBtn = document.getElementById("btn-start-exam");
        if (startBtn && startBtn.parentNode) {
            startBtn.parentNode.insertBefore(badgeEl, startBtn);
        }
    }

    if (attempt > 1) {
        badgeEl.style.display = "block";
        badgeEl.style.background = "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)";
        badgeEl.style.border = "1.5px solid #fca5a5";
        badgeEl.style.color = "#b91c1c";
        badgeEl.innerHTML = `🎯 <b>BẠN ĐANG DỰ THI LẦN ${attempt}</b><br><span style="font-size: 11.5px; color:#475569; font-weight:600;">(Bài thi mới tinh, đồng hồ và các câu trả lời sẽ được làm lại từ đầu)</span>`;

        const startBtn = document.getElementById("btn-start-exam");
        if (startBtn) startBtn.innerText = `Bắt Đầu Làm Bài Lần ${attempt} 🚀`;
    } else {
        badgeEl.style.display = "none";
        const startBtn = document.getElementById("btn-start-exam");
        if (startBtn) startBtn.innerText = "Vào Làm Bài 🚀";
    }
}

function syncStudentFromParamsAndStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    let sbd = urlParams.get('sbd'); 
    let name = urlParams.get('name'); 
    let className = urlParams.get('class');

    const cat = getExamCategory();
    const idEl = document.getElementById("student-id");
    if (idEl && typeof getSbdPlaceholderForCategory === 'function') {
        idEl.placeholder = getSbdPlaceholderForCategory(cat);
    }

    if (name && name.trim()) { 
        applyStudentToUI({ sbd: sbd ? sbd.trim() : "---", name: name.trim(), className: className ? className.trim() : "---" }); 
        return; 
    }

    try {
        const rawSaved = safeLocal.getItem("current_exam_student");
        if (rawSaved) {
            const parsed = JSON.parse(rawSaved);
            if (parsed && parsed.name && parsed.name.trim()) { 
                applyStudentToUI({ sbd: parsed.sbd ? parsed.sbd.trim() : "---", name: parsed.name.trim(), className: parsed.className ? parsed.className.trim() : "---" }); 
                return; 
            }
        }
    } catch(e) {}

    sbd = safeLocal.getItem("saved_student_sbd"); 
    name = safeLocal.getItem("saved_student_name"); 
    className = safeLocal.getItem("saved_student_class");
    if (name && name.trim()) { 
        applyStudentToUI({ sbd: sbd ? sbd.trim() : "---", name: name.trim(), className: className ? className.trim() : "---" }); 
    }
}

function isCurrentExamAllowFree() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    if (quizId) { 
        const localVal = safeLocal.getItem(`exam_allow_free_${quizId}`); 
        if (localVal !== null) { return (localVal === 'true'); } 
    }
    if (examData && examData.allow_free !== undefined) { 
        return (examData.allow_free !== false); 
    }
    return true;
}

function getMaDe() { 
    const urlParams = new URLSearchParams(window.location.search); 
    const urlMaDe = urlParams.get('made') || urlParams.get('maDe'); 
    if (urlMaDe) return String(urlMaDe).trim(); 
    if (typeof examData !== 'undefined' && examData && examData.made) return String(examData.made).trim(); 
    return "101"; 
}

function getExamCode() { 
    let code = getMaDe() || EXAM_NAME; 
    return String(code).trim().replace(/\s+/g, '_'); 
}

function getStorageKey(attempt = null) { 
    const sbd = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "guest";
    const att = attempt || window.currentStudentAttemptNumber || 1;
    return `exam_autosave_session_${EXAM_NAME}_${getMaDe()}_${sbd}_lan${att}`; 
}

function applyOnlineCountVisibility() {
    const onlineBox = document.getElementById("nav-online-box");
    if (!onlineBox) return;

    const cfg = window.CURRENT_RT_CONFIG || {};
    if (cfg.watchOnlineCount === false) {
        onlineBox.style.display = "none";
        return;
    }

    if (typeof examData !== 'undefined' && examData && examData.show_online_count !== undefined) {
        isShowOnlineCountEnabled = (examData.show_online_count !== false);
    }
    onlineBox.style.display = isShowOnlineCountEnabled ? "flex" : "none";
}

function triggerOnlineBoxAnimation() {
    const box = document.getElementById("nav-online-box");
    if (box) {
        box.classList.remove("nav-online-pulse");
        requestAnimationFrame(() => {
            box.classList.add("nav-online-pulse");
        });
    }
}

async function refreshOnlineCount() {
    const cfg = window.CURRENT_RT_CONFIG || {};
    if (cfg.watchOnlineCount === false) return;

    try {
        const urlParams = new URLSearchParams(window.location.search); 
        const currentQuizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData ? (examData.id || "") : "");
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!currentQuizId || !client) return;

        const activeThreshold = Date.now() - (15 * 60 * 1000);
        let { count, error } = await client
            .from('active_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('quiz_id', currentQuizId)
            .gte('last_ping', activeThreshold);

        if (!error && count !== null) {
            window.localOnlineCount = Math.max(1, count);
        }
        
        const countEl = document.getElementById("nav-online-val");
        if (countEl) countEl.innerText = window.localOnlineCount;
    } catch(e) {}
}

async function handleOnlineCountClick() {
    let isAdmin = false;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === '1') isAdmin = true;
        
        const logged = safeLocal.getItem("adminLoggedInSession");
        const exp = safeLocal.getItem("admin_expires_at");
        if (logged === "true" && exp && Date.now() < parseInt(exp, 10)) {
            isAdmin = true;
        }
    } catch(e) {}

    if (isAdmin) {
        const box = document.getElementById("nav-online-box");
        if (box) box.style.opacity = "0.5";
        await refreshOnlineCount();
        if (box) box.style.opacity = "1";
        triggerOnlineBoxAnimation();
        if (typeof showTimeChangeToast === 'function') {
            showTimeChangeToast(`🔄 Admin: Đã đồng bộ sĩ số thực tế (${window.localOnlineCount} em)!`);
        }
    } else {
        if (typeof showTimeChangeToast === 'function') {
            showTimeChangeToast(`👥 Đang có ${window.localOnlineCount} bạn cùng thi.`);
        }
    }
}

function startOnlineRealtimeWatcher(quizId) {
    const cfg = window.CURRENT_RT_CONFIG || {};
    if (cfg.watchOnlineCount === false) {
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!quizId || !client) return;
    if (onlineRealtimeChannel) {
        try { client.removeChannel(onlineRealtimeChannel); } catch(e) {}
        onlineRealtimeChannel = null;
    }

    onlineRealtimeChannel = client.channel(`online_count_${quizId}_${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'active_sessions', filter: `quiz_id=eq.${quizId}` }, () => {
            window.localOnlineCount++;
            const countEl = document.getElementById("nav-online-val");
            if (countEl) countEl.innerText = window.localOnlineCount;
            triggerOnlineBoxAnimation();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'active_sessions', filter: `quiz_id=eq.${quizId}` }, () => {
            window.localOnlineCount = Math.max(1, window.localOnlineCount - 1);
            const countEl = document.getElementById("nav-online-val");
            if (countEl) countEl.innerText = window.localOnlineCount;
            triggerOnlineBoxAnimation();
        })
        .subscribe();
}

function startForceSubmitWatcher(quizId) {
    const cfg = window.CURRENT_RT_CONFIG || {};
    if (cfg.watchForceSubmit === false) return;

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!quizId || !client) return;

    if (forceSubmitRealtimeChannel) {
        try { client.removeChannel(forceSubmitRealtimeChannel); } catch(e) {}
        forceSubmitRealtimeChannel = null;
    }

    const sbd = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
    const cleanSbd = (sbd || "user").replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    forceSubmitRealtimeChannel = client.channel(`exam_force_submit_${quizId}`)
        .on('broadcast', { event: 'FORCE_SUBMIT' }, payload => {
            if (isSubmitted) return;
            const data = payload.payload;
            if (!data) return;

            const targetSbd = String(data.sbd || data.targetSbd || "").trim().toLowerCase();
            const mySbdClean = cleanSbd;
            const myRawSbd = String(sbd).trim().toLowerCase();

            if (targetSbd === 'all' || targetSbd === mySbdClean || targetSbd === myRawSbd) {
                if (typeof showTimeChangeToast === 'function') {
                    showTimeChangeToast("⚡ Giáo viên đã gửi lệnh thu bài ép buộc! Đang nộp bài...");
                }
                setTimeout(() => {
                    if (typeof window.executeSubmitExam === 'function') {
                        window.executeSubmitExam(true);
                    }
                }, 400);
            }
        })
        .on('broadcast', { event: 'TEMP_DRAFT_CAPTURE' }, payload => {
            if (isSubmitted || !examStartTime) return;
            if (typeof showTimeChangeToast === 'function') {
                showTimeChangeToast("📋 Thầy vừa thu bài tạm thời! Điểm nháp đang được gửi sang Drive...");
            }
            if (typeof sendCurrentDraftToGoogleSheetTemp === 'function') {
                sendCurrentDraftToGoogleSheetTemp();
            }
        })
        .subscribe();
}

async function startPresenceSystem(sId) {
    await loadRealtimeExamConfig();
    const cfg = window.CURRENT_RT_CONFIG || {};

    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    const urlParams = new URLSearchParams(window.location.search); 
    const currentQuizId = urlParams.get('id') || "";

    if (cfg.watchOnlineCount !== false && currentQuizId) {
        startOnlineRealtimeWatcher(currentQuizId);
        refreshOnlineCount();
    } else {
        const onlineBox = document.getElementById("nav-online-box");
        if (onlineBox) onlineBox.style.display = "none";
    }

    if (cfg.watchForceSubmit !== false && currentQuizId) {
        startForceSubmitWatcher(currentQuizId);
    }

    const intervalSec = (cfg.pingIntervalSec !== undefined) ? parseInt(cfg.pingIntervalSec, 10) : 25;
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }

    if (intervalSec > 0) {
        // Nếu executeStartExamAPI vừa mới ghi danh cách đây < 5s -> không cần ping lặp lại ở giây 0
        if (!window.__lastPresencePingMs || (Date.now() - window.__lastPresencePingMs) > 5000) {
            updatePresence(cleanSbd);
        }
        presenceInterval = setInterval(() => { 
            updatePresence(cleanSbd); 
        }, intervalSec * 1000);
    }
}

// BẢN TỐI ƯU ĐIỂM 2: BỎ .select() THỪA KHI PING (GIẢM RESPONSE TỪ ~1KB XUỐNG 0 BYTE) + CHỐNG PING KÉP 3S
async function updatePresence(cleanSbd) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        const urlParams = new URLSearchParams(window.location.search); 
        const currentQuizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData ? (examData.id || "") : "");
        if (!currentQuizId || isSubmitted || !client) return;

        const nowMs = Date.now();
        if (window.__lastPresencePingMs && (nowMs - window.__lastPresencePingMs) < 3000) {
            return;
        }
        window.__lastPresencePingMs = nowMs;

        // Chỉ update last_ping với count: 'exact' và KHÔNG gọi .select() -> returning minimal (0 byte body)
        const { error: upErr, count } = await client
            .from('active_sessions')
            .update({ last_ping: nowMs }, { count: 'exact' })
            .match({ quiz_id: currentQuizId, sbd: cleanSbd });

        if (!upErr && count === 0) {
            const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || cleanSbd;
            const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "Thí sinh";
            const rawClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "Lớp";
            const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
            const strictClass = (typeof getStrictStandardClassName === 'function')
                ? getStrictStandardClassName(rawClass || currentCat, sId)
                : rawClass;

            const currentAttempt = window.currentStudentAttemptNumber || 1;
            const originStored = safeLocal.getItem(`exam_start_time_origin_${currentQuizId}_${cleanSbd}_lan${currentAttempt}`);
            const parsedOrigin = originStored ? parseInt(originStored, 10) : NaN;
            const reliableStartTime = (!isNaN(parsedOrigin) && parsedOrigin > 0) ? parsedOrigin : (examStartTime || nowMs);
            const isFree = !(typeof findStudentFromDatabase === 'function' && findStudentFromDatabase(sId, currentCat));

            await client.from('active_sessions').insert([{
                quiz_id: currentQuizId,
                sbd: cleanSbd,
                name: sName,
                class_name: strictClass,
                category_id: currentCat,
                is_free: isFree,
                ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
                exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
                start_time: reliableStartTime,
                last_ping: nowMs
            }]);
        }
    } catch(e) {}
}

function clearPresence(sId) {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    
    if (onlineRealtimeChannel && client) {
        try { client.removeChannel(onlineRealtimeChannel); } catch(e) {}
        onlineRealtimeChannel = null;
    }
    if (forceSubmitRealtimeChannel && client) {
        try { client.removeChannel(forceSubmitRealtimeChannel); } catch(e) {}
        forceSubmitRealtimeChannel = null;
    }

    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    const urlParams = new URLSearchParams(window.location.search); 
    const currentQuizId = urlParams.get('id') || "";

    if (client && currentQuizId) {
        client.from('active_sessions').delete().match({ quiz_id: currentQuizId, sbd: cleanSbd }).then();
    }
}

function showTimeChangeToast(message) {
    const toast = document.getElementById("time-change-toast"); 
    const msg = document.getElementById("time-change-toast-msg");
    if (!toast || !msg) return; 
    msg.innerText = message; 
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 4500);
}

function startTimeWatcherRealtime(quizId) {
    const cfg = window.CURRENT_RT_CONFIG || {};
    if (cfg.watchTimeConfig === false) return;

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!quizId || !client) return;
    if (realtimeConfigChannel) { 
        try { client.removeChannel(realtimeConfigChannel); } catch(e) {}
    }

    realtimeConfigChannel = client.channel(`exam_config_${quizId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` }, payload => {
            const freshData = payload.new;
            if (!freshData || isSubmitted || !examStartTime) return;

            // Cập nhật thời gian thi & đồng bộ ngay trên đồng hồ
            const freshMins = parseInt(freshData.time_limit_minutes, 10);
            if (!isNaN(freshMins) && freshMins > 0 && freshMins !== TIME_LIMIT_MINUTES) {
                TIME_LIMIT_MINUTES = freshMins;
                totalTimeSeconds = TIME_LIMIT_MINUTES * 60;
                const elapsedTimeSec = Math.max(0, Math.floor((Date.now() - examStartTime) / 1000));
                remainingSeconds = Math.max(0, totalTimeSeconds - elapsedTimeSec);

                const timerVal = document.getElementById("nav-timer-val");
                const timerBox = document.getElementById("nav-timer-box");
                if (timerVal && typeof formatHHMMSS === 'function') {
                    timerVal.innerText = formatHHMMSS(remainingSeconds);
                }
                if (timerBox) {
                    timerBox.classList.add("timer-updated");
                    setTimeout(() => timerBox.classList.remove("timer-updated"), 2000);
                }
                if (typeof startCountdownTimer === 'function' && !isExamLocked && remainingSeconds > 0) {
                    startCountdownTimer();
                }
                showTimeChangeToast(`⏱ Giáo viên vừa cập nhật thời gian: ${TIME_LIMIT_MINUTES} phút!`);
            }

            // Cập nhật đồng bộ cả 2 trường khung giờ làm bài
            if (freshData.exam_start_time !== undefined || freshData.exam_end_time !== undefined) {
                if (examData) {
                    if (freshData.exam_start_time !== undefined) {
                        examData.exam_start_time = freshData.exam_start_time;
                        examData.examStartTimeStr = freshData.exam_start_time;
                    }
                    if (freshData.exam_end_time !== undefined) {
                        examData.exam_end_time = freshData.exam_end_time;
                        examData.examEndTimeStr = freshData.exam_end_time;
                    }
                }
                const noticeEl = document.getElementById("exam-time-notice");
                if (noticeEl && freshData.exam_start_time && freshData.exam_end_time) {
                    const st = new Date(freshData.exam_start_time).toLocaleString("vi-VN");
                    const et = new Date(freshData.exam_end_time).toLocaleString("vi-VN");
                    noticeEl.innerText = `⏱ Mở từ: ${st} - Đến: ${et}`;
                    noticeEl.style.display = "inline-block";
                }
                showTimeChangeToast(`📅 Giáo viên vừa cập nhật lại khung giờ làm bài!`);
            }

            // Cập nhật cấu hình hiển thị sĩ số
            if (freshData.show_online_count !== undefined) {
                if (examData) examData.show_online_count = freshData.show_online_count;
                applyOnlineCountVisibility();
            }

            // ĐỒNG BỘ TIÊU ĐỀ NẾU ADMIN CẬP NHẬT TỪ SOI ĐỀ
            if (freshData.title && freshData.title !== EXAM_NAME) {
                EXAM_NAME = freshData.title;
                if (examData) examData.title = freshData.title;
                const bannerTitle = document.getElementById("banner-title");
                if (bannerTitle) bannerTitle.innerText = freshData.title;
            }
        }).subscribe();
}

// BỘ CHỐNG THOÁT TRANG: ĐÃ FIX TRIỆT ĐỂ LỖI CRASH WEBKIT TRÊN IPHONE KHI VUỐT MÀN HÌNH
function setupBackPrevention() { 
    try {
        window.history.pushState({ page: 'quiz' }, "", ""); 
        window.addEventListener('popstate', function () { 
            if (!isSubmitted && examStartTime) { 
                window.history.pushState({ page: 'quiz' }, "", ""); 
                if (typeof showTimeChangeToast === 'function') {
                    showTimeChangeToast("⚠️ BẠN ĐANG TRONG BÀI THI! Hãy làm bài và bấm nút NỘP BÀI.");
                }
            } 
        }); 

        window.addEventListener('beforeunload', function (e) { 
            if (!isSubmitted && examStartTime) { 
                if (typeof window.__saveExamState === 'function') window.__saveExamState(); 
                e.preventDefault(); 
                e.returnValue = 'Bài làm của bạn chưa được nộp. Dữ liệu đã được lưu tạm an toàn.'; 
            } 
        });

        // Chuẩn hóa cho Safari iOS khi chuyển app hoặc đóng tab
        window.addEventListener('pagehide', function() {
            if (!isSubmitted && examStartTime) {
                if (typeof window.__saveExamState === 'function') window.__saveExamState();
            }
        });
    } catch(e) {}

    window.addEventListener('online', function() { 
        const banner = document.getElementById("net-status-banner");
        if (banner) banner.style.display = "none"; 
        checkPendingSubmissionOnLoad(); 
    }); 
    window.addEventListener('offline', function() { 
        const banner = document.getElementById("net-status-banner");
        if (banner) banner.style.display = "block"; 
        updateTopBackupStatus(false);
    }); 
}

function updateTopBackupStatus(isServerConfirmed = false) {
    const statusText = document.getElementById("backup-status-text");
    const statusIcon = document.getElementById("backup-status-icon");
    const indicator = document.getElementById("backup-status-indicator");
    const resendBtn = document.getElementById("btn-universal-resend");

    if (isServerConfirmed) {
        if (statusText) statusText.innerText = "✅ Đã lưu máy chủ an toàn 100%";
        if (statusIcon) statusIcon.innerText = "🟢";
        if (indicator) indicator.className = "backup-status-indicator synced";
        if (resendBtn) resendBtn.style.display = "none";
    } else {
        const hasPending = Boolean(safeLocal.getItem("pending_exam_submission"));
        if (hasPending) {
            if (statusText) statusText.innerText = "⚠️ Chưa gửi thành công lên máy chủ (Đã bảo lưu an toàn)";
            if (statusIcon) statusIcon.innerText = "🔴";
            if (indicator) indicator.className = "backup-status-indicator pending";
            if (resendBtn) resendBtn.style.display = "inline-flex";
        } else {
            if (statusText) statusText.innerText = "";
            if (statusIcon) statusIcon.innerText = "";
            if (indicator) indicator.className = "backup-status-indicator";
            if (resendBtn) resendBtn.style.display = "none";
        }
    }
}

async function checkPendingSubmissionOnLoad() { 
    try { 
        let raw = safeLocal.getItem("pending_exam_submission"); 
        if (!raw && typeof examIndexedDB !== 'undefined') {
            const list = await examIndexedDB.getAll('pending_submissions');
            if (list && list.length > 0) {
                raw = JSON.stringify(list[0].payload);
            }
        }
        if (raw) { 
            const parsed = JSON.parse(raw); 
            if (parsed && (parsed.studentName || parsed.studentId || parsed.student_name)) { 
                pendingSubmissionPayload = parsed; 
                updateTopBackupStatus(false);
                return;
            } 
        } 
    } catch(e) {} 
    updateTopBackupStatus(isSubmitted);
}

// BẢN FIX: KHI HỌC SINH TỪ ỨNG DỤNG KHÁC QUAY LẠI, PING NGAY LẬP TỨC ĐỂ ADMIN KHÔNG BỊ BÁO CHƯA THI
document.addEventListener("visibilitychange", async function() { 
    if (wakeLockSentinel === null && !document.hidden) { 
        await requestWakeLock(); 
    }
    if (!examStartTime || isSubmitted) return; 

    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');

    const urlParams = new URLSearchParams(window.location.search);
    const isAdminPreviewUrl = (urlParams.get('admin') === '1');

    if (!document.hidden) {
        if (!isAdminPreviewUrl) {
            // Học sinh vừa quay lại bài thi: lập tức ping ngay lên Supabase (có cooldown chống dội 3s)!
            updatePresence(cleanSbd);

            const elapsedSec = Math.floor((Date.now() - examStartTime) / 1000);
            if (elapsedSec >= totalTimeSeconds) {
                if (typeof window.executeSubmitExam === 'function') {
                    window.executeSubmitExam(true);
                    return;
                }
            }
        }
    }

    if (document.hidden) { 
        if (!isTabHidden) { 
            isTabHidden = true; 
            leaveTime = Date.now(); 
            tabSwitchCount++; 
            if (!isAdminPreviewUrl && typeof window.__saveExamState === 'function') window.__saveExamState();
        } 
    } else { 
        if (isTabHidden && leaveTime > 0) { 
            isTabHidden = false; 
            let durationSec = Math.max(1, Math.round((Date.now() - leaveTime) / 1000)); 
            leaveTime = 0; 
            let mins = Math.floor(durationSec / 60); 
            let secs = durationSec % 60; 
            let durationStr = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`; 
            if (!isAdminPreviewUrl) {
                sendTabSwitchLog(tabSwitchCount, durationStr, durationSec); 
            }
            if (typeof showTimeChangeToast === 'function') {
                showTimeChangeToast(`⚠️ Bạn vừa rời bài thi ${durationStr} (Lần ${tabSwitchCount})!`);
            }
        } 
    } 
});

window.addEventListener("focus", function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === '1') return;
    if (examStartTime && !isSubmitted) {
        const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
        const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
        updatePresence(cleanSbd);
    }
});

function sendTabSwitchLog(switchCount, durationStr, durationSec = 0) { 
    let sId = document.getElementById("student-id") ? document.getElementById("student-id").value.trim() : ""; 
    let sName = document.getElementById("student-name") ? document.getElementById("student-name").value.trim() : ""; 
    let sClass = document.getElementById("student-class") ? document.getElementById("student-class").value.trim() : ""; 
    const currentCat = getExamCategory(); 
    const urlParams = new URLSearchParams(window.location.search); 
    const currentQuizId = urlParams.get('id') || "";
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    client.from('cheating_logs').insert([{
        quiz_id: currentQuizId,
        sbd: (sId || "user").replace(/[^a-zA-Z0-9]/g, '_'),
        student_name: sName || "Chưa nhập",
        student_class: sClass || "Chưa nhập",
        category_id: currentCat,
        switch_count: switchCount,
        duration_str: durationStr,
        duration_sec: durationSec
    }]).then();
}

window.startForceSubmitWatcher = startForceSubmitWatcher;
window.updateTopBackupStatus = updateTopBackupStatus;
window.refreshOnlineCount = refreshOnlineCount;
window.applyOnlineCountVisibility = applyOnlineCountVisibility;
window.handleOnlineCountClick = handleOnlineCountClick;
window.startPresenceSystem = startPresenceSystem;
window.clearPresence = clearPresence;
window.checkPendingSubmissionOnLoad = checkPendingSubmissionOnLoad;
window.getStorageKey = getStorageKey;
window.checkAndDisplayAttemptNoticeOnStudentCard = checkAndDisplayAttemptNoticeOnStudentCard;
window.loadRealtimeExamConfig = loadRealtimeExamConfig;
