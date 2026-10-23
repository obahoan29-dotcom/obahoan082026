// =========================================================
// FILE: exam-api.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG)
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

let wakeLockSentinel = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && navigator.wakeLock) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
        }
    } catch (err) {}
}

function getExamCategory() {
    const urlParams = new URLSearchParams(window.location.search);
    let cat = urlParams.get('cat'); if (cat) return cat;
    try {
        const raw = safeLocal.getItem("current_exam_student");
        if (raw) { const parsed = JSON.parse(raw); if (parsed && parsed.categoryId) return parsed.categoryId; }
    } catch(e) {}
    return "them-11";
}

function findStudentFromDatabase(query, preferredCat = null) {
    if (!query || !window.STUDENT_ACCOUNTS) return null;
    const q = String(query).trim().toLowerCase();
    
    if (preferredCat && window.STUDENT_ACCOUNTS[preferredCat]) {
        const list = window.STUDENT_ACCOUNTS[preferredCat];
        const matched = list.find(acc => (acc.sbd && String(acc.sbd).trim().toLowerCase() === q) || (acc.username && String(acc.username).trim().toLowerCase() === q) || (acc.name && String(acc.name).trim().toLowerCase() === q));
        if (matched) return matched;
    }
    
    for (let c in window.STUDENT_ACCOUNTS) {
        const list = window.STUDENT_ACCOUNTS[c];
        if (Array.isArray(list)) {
            const m = list.find(acc => (acc.sbd && String(acc.sbd).trim().toLowerCase() === q) || (acc.username && String(acc.username).trim().toLowerCase() === q) || (acc.name && String(acc.name).trim().toLowerCase() === q));
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

    const nameEl = document.getElementById("student-name"); const idEl = document.getElementById("student-id"); const classEl = document.getElementById("student-class");
    if (nameEl) nameEl.value = sName; if (idEl) idEl.value = sId; if (classEl) classEl.value = sClass;

    const navName = document.getElementById("nav-student-name"); const navId = document.getElementById("nav-student-id"); const navClass = document.getElementById("nav-student-class");
    if (navName) navName.innerText = sName; if (navId) navId.innerText = sId; if (navClass) navClass.innerText = sClass;

    safeLocal.setItem("saved_student_name", sName); safeLocal.setItem("saved_student_sbd", sId); safeLocal.setItem("saved_student_class", sClass);
}

function syncStudentFromParamsAndStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    let sbd = urlParams.get('sbd'); let name = urlParams.get('name'); let className = urlParams.get('class');

    if (name && name.trim()) { applyStudentToUI({ sbd: sbd ? sbd.trim() : "---", name: name.trim(), className: className ? className.trim() : "---" }); return; }

    try {
        const rawSaved = safeLocal.getItem("current_exam_student");
        if (rawSaved) {
            const parsed = JSON.parse(rawSaved);
            if (parsed && parsed.name && parsed.name.trim()) { applyStudentToUI({ sbd: parsed.sbd ? parsed.sbd.trim() : "---", name: parsed.name.trim(), className: parsed.className ? parsed.className.trim() : "---" }); return; }
        }
    } catch(e) {}

    sbd = safeLocal.getItem("saved_student_sbd"); name = safeLocal.getItem("saved_student_name"); className = safeLocal.getItem("saved_student_class");
    if (name && name.trim()) { applyStudentToUI({ sbd: sbd ? sbd.trim() : "---", name: name.trim(), className: className ? className.trim() : "---" }); }
}

function isCurrentExamAllowFree() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    if (quizId) { const localVal = safeLocal.getItem(`exam_allow_free_${quizId}`); if (localVal !== null) { return (localVal === 'true'); } }
    if (examData && examData.allow_free !== undefined) { return (examData.allow_free !== false); }
    return true;
}

function getMaDe() { 
    const urlParams = new URLSearchParams(window.location.search); const urlMaDe = urlParams.get('made') || urlParams.get('maDe'); 
    if (urlMaDe) return String(urlMaDe).trim(); 
    if (typeof examData !== 'undefined' && examData && examData.made) return String(examData.made).trim(); 
    return "101"; 
}

function getExamCode() { 
    let code = getMaDe() || EXAM_NAME; return String(code).trim().replace(/\s+/g, '_'); 
}

async function postToGoogleSheet(url, payload, timeoutMs = 15000) { 
    try {
        const controller = new AbortController(); 
        const timer = setTimeout(() => controller.abort(), timeoutMs); 
        await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timer);
    } catch(e) {}
}

async function executeStartExamAPI(sId, sName, sClass, isFreeStudent = false) { 
    const currentCat = getExamCategory(); const urlParams = new URLSearchParams(window.location.search); const currentQuizId = urlParams.get('id') || "";
    const startBtn = document.getElementById("btn-start-exam");

    if (startBtn) { startBtn.disabled = true; startBtn.innerText = "⏳ Đang kết nối phòng thi..."; }

    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    const nowMs = Date.now();

    // 1. CẬP NHẬT TRẠNG THÁI ACTIVE LÊN SUPABASE
    try {
        await supabaseClient.from('active_sessions').upsert({
            quiz_id: currentQuizId,
            sbd: cleanSbd,
            name: sName,
            class_name: sClass,
            category_id: currentCat,
            is_free: isFreeStudent,
            ma_de: getMaDe(),
            exam_title: EXAM_NAME,
            start_time: nowMs,
            last_ping: nowMs
        });

        // 2. GHI NHẬT KÝ BẮT ĐẦU
        supabaseClient.from('cheating_logs').insert([{
            quiz_id: currentQuizId,
            sbd: cleanSbd,
            student_name: sName,
            student_class: sClass,
            category_id: currentCat,
            switch_count: 0,
            duration_str: "Bắt đầu",
            duration_sec: 0
        }]).then();
    } catch(e) {
        console.warn("Supabase start exam warning:", e);
    }

    document.getElementById("nav-student-name").innerText = sName; 
    document.getElementById("nav-student-id").innerText = sId; 
    document.getElementById("nav-student-class").innerText = sClass; 
    document.getElementById("nav-exam-code-text").innerText = `Đề: ${getMaDe()}`; 
    document.getElementById("student-card").style.display = "none"; 
    
    const waitingCard = document.getElementById("waiting-room-card"); 
    if (waitingCard) waitingCard.style.display = "none"; 
    
    document.getElementById("top-navbar").style.display = "block"; 
    document.getElementById("quiz-content").style.display = "block"; 
    
    if (!examStartTime) { examStartTime = Date.now(); if (typeof window.__saveExamState === 'function') window.__saveExamState(); } 
    if (typeof window.__updateProgress === 'function') window.__updateProgress(); 
    
    if (examData && examData.show_online_count !== undefined) isShowOnlineCountEnabled = examData.show_online_count;

    startCountdownTimer(); 
    startPresenceSystem(sId);
    updateTopBackupStatus(false);

    if (startBtn) { startBtn.disabled = false; startBtn.innerText = "Vào Làm Bài"; }
}

function startPresenceSystem(sId) {
    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    updatePresence(cleanSbd);

    if (presenceInterval) clearInterval(presenceInterval);
    // Tăng thời gian ping lên 60s để bảo vệ tuyệt đối hạn mức
    presenceInterval = setInterval(() => { updatePresence(cleanSbd); }, 60000);
}

async function updatePresence(cleanSbd) {
    try {
        const urlParams = new URLSearchParams(window.location.search); 
        const currentQuizId = urlParams.get('id') || "";
        if (!currentQuizId || isSubmitted) return;

        await supabaseClient.from('active_sessions').update({ last_ping: Date.now() })
            .match({ quiz_id: currentQuizId, sbd: cleanSbd });
    } catch(e) {}
}

function clearPresence(sId) {
    if (presenceInterval) clearInterval(presenceInterval);
    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    const urlParams = new URLSearchParams(window.location.search); 
    const currentQuizId = urlParams.get('id') || "";

    supabaseClient.from('active_sessions').delete().match({ quiz_id: currentQuizId, sbd: cleanSbd }).then();
}

function showTimeChangeToast(message) {
    const toast = document.getElementById("time-change-toast"); const msg = document.getElementById("time-change-toast-msg");
    if (!toast || !msg) return; msg.innerText = message; toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 4500);
}

// THEO DÕI THAY ĐỔI CẤU HÌNH ĐỀ QUA SUPABASE REALTIME
function startTimeWatcherRealtime(quizId) {
    if (!quizId || !supabaseClient) return;
    if (realtimeConfigChannel) {
        supabaseClient.removeChannel(realtimeConfigChannel);
    }

    realtimeConfigChannel = supabaseClient.channel(`exam_config_${quizId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'quizzes', 
            filter: `id=eq.${quizId}` 
        }, payload => {
            const freshData = payload.new;
            if (!freshData || isSubmitted || !examStartTime) return;

            if (freshData.time_limit_minutes && freshData.time_limit_minutes !== TIME_LIMIT_MINUTES) {
                TIME_LIMIT_MINUTES = freshData.time_limit_minutes;
                totalTimeSeconds = TIME_LIMIT_MINUTES * 60;
                const elapsedTimeSec = Math.floor((Date.now() - examStartTime) / 1000);
                remainingSeconds = Math.max(0, totalTimeSeconds - elapsedTimeSec);
                showTimeChangeToast(`⏱ Giáo viên vừa cập nhật thời gian: ${TIME_LIMIT_MINUTES} phút!`);
            }

            if (freshData.exam_end_time && examData && freshData.exam_end_time !== examData.exam_end_time) {
                examData.exam_end_time = freshData.exam_end_time;
                showTimeChangeToast(`📅 Giáo viên vừa gia hạn lịch nộp bài!`);
            }
        })
        .subscribe();
}

function setupBackPrevention() { 
    window.history.pushState({ page: 'quiz' }, "", ""); 
    window.addEventListener('popstate', function () { 
        if (!isSubmitted && examStartTime) { window.history.pushState({ page: 'quiz' }, "", ""); confirm("⚠️ BẠN ĐANG TRONG BÀI THI!\nThoát hoặc quay lại sẽ làm gián đoạn bài làm của bạn."); } 
    }); 
    window.addEventListener('beforeunload', function (e) { 
        if (!isSubmitted && examStartTime) { if (typeof window.__saveExamState === 'function') window.__saveExamState(); e.preventDefault(); e.returnValue = 'Bài làm của bạn chưa được nộp. Dữ liệu đã được lưu tạm an toàn.'; } 
    }); 
    window.addEventListener('online', function() { 
        document.getElementById("net-status-banner").style.display = "none"; 
        checkPendingSubmissionOnLoad(); 
    }); 
    window.addEventListener('offline', function() { 
        document.getElementById("net-status-banner").style.display = "block"; 
        updateTopBackupStatus(false);
    }); 
}

function getStorageKey() { return `exam_autosave_active_session_${EXAM_NAME}_${getMaDe()}`; }

function updateTopBackupStatus(isServerConfirmed = false) {
    const statusText = document.getElementById("backup-status-text");
    const statusIcon = document.getElementById("backup-status-icon");
    const indicator = document.getElementById("backup-status-indicator");
    const resendBtn = document.getElementById("btn-universal-resend");

    if (isServerConfirmed) {
        if (statusText) statusText.innerText = "✅ Đã lưu máy chủ an toàn 100%";
        if (statusIcon) statusIcon.innerText = "🟢";
        if (indicator) { indicator.className = "backup-status-indicator synced"; }
        if (resendBtn) resendBtn.style.display = "none";
    } else {
        const hasPending = Boolean(safeLocal.getItem("pending_exam_submission"));
        if (hasPending) {
            if (statusText) statusText.innerText = "⚠️ Chưa gửi thành công lên máy chủ (Đã bảo lưu trên máy)";
            if (statusIcon) statusIcon.innerText = "🔴";
            if (indicator) { indicator.className = "backup-status-indicator pending"; }
            if (resendBtn) resendBtn.style.display = "inline-flex";
        } else {
            if (statusText) statusText.innerText = "";
            if (statusIcon) statusIcon.innerText = "";
            if (indicator) { indicator.className = "backup-status-indicator"; }
            if (resendBtn) resendBtn.style.display = "none";
        }
    }
}

function checkPendingSubmissionOnLoad() { 
    try { 
        const raw = safeLocal.getItem("pending_exam_submission"); 
        if (raw) { 
            const parsed = JSON.parse(raw); 
            if (parsed && (parsed.studentName || parsed.studentId)) { 
                pendingSubmissionPayload = parsed; 
                updateTopBackupStatus(false);
                return;
            } 
        } 
    } catch(e) {} 
    updateTopBackupStatus(isSubmitted);
}

document.addEventListener("visibilitychange", async function() { 
    if (wakeLockSentinel === null && !document.hidden) { await requestWakeLock(); }
    if (!examStartTime || isSubmitted) return; 

    if (!document.hidden) {
        const elapsedSec = Math.floor((Date.now() - examStartTime) / 1000);
        if (elapsedSec >= totalTimeSeconds) {
            if (typeof window.executeSubmitExam === 'function') {
                window.executeSubmitExam(true);
                return;
            }
        }
    }

    if (document.hidden) { 
        if (!isTabHidden) { isTabHidden = true; leaveTime = Date.now(); tabSwitchCount++; } 
    } else { 
        if (isTabHidden && leaveTime > 0) { 
            isTabHidden = false; 
            let durationSec = Math.max(1, Math.round((Date.now() - leaveTime) / 1000)); 
            leaveTime = 0; 
            let mins = Math.floor(durationSec / 60); 
            let secs = durationSec % 60; 
            let durationStr = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`; 
            sendTabSwitchLog(tabSwitchCount, durationStr, durationSec); 
            setTimeout(() => alert(`⚠️ CẢNH BÁO GIAN LẬN:\nBạn vừa rời bài thi ${durationStr} (Lần ${tabSwitchCount}).`), 100); 
        } 
    } 
});

function sendTabSwitchLog(switchCount, durationStr, durationSec = 0) { 
    let sId = document.getElementById("student-id") ? document.getElementById("student-id").value.trim() : ""; 
    let sName = document.getElementById("student-name") ? document.getElementById("student-name").value.trim() : ""; 
    let sClass = document.getElementById("student-class") ? document.getElementById("student-class").value.trim() : ""; 
    const currentCat = getExamCategory(); 
    const urlParams = new URLSearchParams(window.location.search); 
    const currentQuizId = urlParams.get('id') || "";

    supabaseClient.from('cheating_logs').insert([{
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

window.updateTopBackupStatus = updateTopBackupStatus;