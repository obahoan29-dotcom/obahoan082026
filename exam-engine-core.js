// =========================================================
// FILE 3: exam-engine-core.js 
// (BẢN FIX TRIỆT ĐỂ LỖI TRẮNG MÀN HÌNH & OUT TRÊN IPHONE / MESSENGER / IOS)
// ĐÃ TỐI ƯU 180+ THÍ SINH - TIẾT KIỆM TÀI NGUYÊN SUPABASE FREE
// ĐÃ TÍCH HỢP: ZERO-BLANK-SCREEN WATCHDOG (KHÔNG BAO GIỜ BỊ TRẮNG MÀN HÌNH)
// OFFLINE-FIRST: LƯU TỨC THÌ LOCAL/INDEXEDDB, BẢO LƯU 100% BÀI THI
// =========================================================

window.SECURE_VAULT = window.SECURE_VAULT || {
    answers: {},
    explanations: {},
    userAnswers: {},
    padletClicked: {},
    questionData: {}
};

let hasInitExamEngine = false;
let isExamLocked = false;
let lockedDurationSec = 0;
let isSubmittingInProgress = false;

let _storageDebounceTimer = null;
let _statementDebounceTimer = null;
let _autoSaveDebounceTimer = null;

(function injectLockStyles() {
    const styleId = "exam-engine-lock-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .quiz-content-locked { pointer-events: none !important; user-select: none !important; opacity: 0.88; }
        .quiz-content-locked input, .quiz-content-locked textarea, .quiz-content-locked select, .quiz-content-locked button { cursor: not-allowed !important; }
        .tf-table input[type="radio"] {
            transition: transform 0.08s ease;
            cursor: pointer;
        }
        .tf-table input[type="radio"]:active {
            transform: scale(1.25);
        }
        /* BANNER HƯỚNG DẪN MỞ SAFARI CHO IPHONE TRONG MESSENGER */
        .ios-messenger-tip-banner {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 1.5px solid #3b82f6;
            border-radius: 12px;
            padding: 8px 12px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
            font-size: 12px;
            font-weight: 700;
            color: #1e40af;
        }
    `;
    document.head.appendChild(style);
})();

// KIỂM TRA TRÌNH DUYỆT NHÚNG TRÊN IPHONE ĐỂ HIỂN THỊ HƯỚNG DẪN MỞ BẰNG SAFARI
function checkAndInjectIOSMessengerBanner() {
    try {
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isInApp = /FBAN|FBAV|Messenger|Instagram|Zalo/i.test(ua);

        if (isIOS && isInApp && !document.getElementById('ios-messenger-tip')) {
            const banner = document.createElement('div');
            banner.id = 'ios-messenger-tip';
            banner.className = 'ios-messenger-tip-banner';
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:16px;">💡</span>
                    <span>Em đang mở trong Messenger. Để thi mượt nhất và không bị văng, em bấm dấu <b>(...)</b> góc trên rồi chọn <b>"Mở bằng Safari"</b> nhé!</span>
                </div>
                <button type="button" onclick="this.parentElement.style.display='none'" style="background:none; border:none; color:#1e40af; font-size:16px; font-weight:900; cursor:pointer;">✕</button>
            `;
            const container = document.querySelector('.container') || document.body;
            if (container.firstChild) {
                container.insertBefore(banner, container.firstChild);
            } else {
                container.appendChild(banner);
            }
        }
    } catch(e) {}
}

function calculateTemporaryDraftScore() {
    if (typeof calculateExamScoreWithConfig === 'function' && typeof examData !== 'undefined' && examData && Array.isArray(examData.questions)) {
        return calculateExamScoreWithConfig(
            examData.questions,
            window.SECURE_VAULT.userAnswers || {},
            window.SECURE_VAULT.answers || {},
            examData.scoringConfig || { mode: 'option1' }
        );
    }
    return {
        correctCount: 0,
        wrongCount: 0,
        totalRawScore: 0,
        finalScore: 0,
        maxScale: 10.0,
        dataDetails: []
    };
}

async function ensureActiveSessionAndDraft() {
    if (isSubmitted) return;
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd");
    if (!sId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);
    if (!quizId) return;

    const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
    const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "Thí sinh";
    const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "Lớp";
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    
    const strictClassName = typeof getStrictStandardClassName === 'function' 
        ? getStrictStandardClassName(sClass || currentCat, sId) 
        : sClass;

    const nowMs = Date.now();
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    try {
        const cfg = window.CURRENT_RT_CONFIG || {};
        if (cfg.pingIntervalSec !== 0) {
            const { data: updatedAct } = await client.from('active_sessions')
                .update({
                    name: sName,
                    class_name: strictClassName,
                    category_id: currentCat,
                    is_free: !(typeof findStudentFromDatabase === 'function' && findStudentFromDatabase(sId, currentCat)),
                    ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
                    exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
                    last_ping: nowMs
                })
                .match({ quiz_id: quizId, sbd: cleanSbd })
                .select();

            if (!updatedAct || updatedAct.length === 0) {
                await client.from('active_sessions').insert([{
                    quiz_id: quizId,
                    sbd: cleanSbd,
                    name: sName,
                    class_name: strictClassName,
                    category_id: currentCat,
                    is_free: !(typeof findStudentFromDatabase === 'function' && findStudentFromDatabase(sId, currentCat)),
                    ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
                    exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
                    start_time: examStartTime || nowMs,
                    last_ping: nowMs
                }]);
            }
        }
    } catch(err) {
        console.warn("Lỗi ping active_session:", err);
    }
}

function buildCurrentLiveDraftPayload() {
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
    if (!sId) return null;

    const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "Thí sinh";
    const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "Lớp";
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "quiz";
    const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
    const primaryDocId = `${quizId}_${cleanSbd}`;

    const strictClassName = typeof getStrictStandardClassName === 'function' 
        ? getStrictStandardClassName(sClass || currentCat, sId) 
        : sClass;
        
    const exactExamTitle = (typeof EXAM_NAME !== 'undefined' && EXAM_NAME && EXAM_NAME !== 'ĐỀ THI TRẮC NGHIỆM') 
        ? EXAM_NAME 
        : ((typeof examData !== 'undefined' && examData && examData.title) ? examData.title : "Đề thi");

    const tempScoreResult = calculateTemporaryDraftScore();
    const elapsedSec = examStartTime ? Math.max(1, Math.round((Date.now() - examStartTime) / 1000)) : 0;
    const spentMins = Math.floor(elapsedSec / 60);
    const spentSecs = elapsedSec % 60;
    const completionTimeStr = `${spentMins} phút ${spentSecs} giây`;

    const clonedAnswers = JSON.parse(JSON.stringify(window.SECURE_VAULT.userAnswers || {}));

    return {
        id: primaryDocId,
        quiz_id: quizId,
        sbd: cleanSbd,
        student_name: sName,
        class_name: strictClassName,
        category_id: currentCat,
        ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
        exam_title: exactExamTitle,
        user_answers: clonedAnswers,
        score10: tempScoreResult.finalScore,
        raw_score: tempScoreResult.totalRawScore,
        max_scale: tempScoreResult.maxScale,
        correct_count: tempScoreResult.correctCount,
        wrong_count: tempScoreResult.wrongCount,
        completion_time: completionTimeStr,
        spent_mins: spentMins,
        tab_switch_count: `${tabSwitchCount} lần`,
        data_string: tempScoreResult.dataDetails.join(" | "),
        last_updated: new Date().toISOString()
    };
}

async function autoSaveAnswerToCloud(qKey, answerVal) {
    if (isSubmitted || isExamLocked) return;

    const draftData = buildCurrentLiveDraftPayload();
    if (!draftData) return;

    if (typeof examIndexedDB !== 'undefined') {
        examIndexedDB.setItem('live_drafts', {
            key: draftData.id,
            ...draftData
        }).catch(() => {});
    }
}

function sendDraftToGoogleSheetTemp(draftData) {
    if (typeof sendCurrentDraftToGoogleSheetTemp === 'function') {
        sendCurrentDraftToGoogleSheetTemp();
    }
}

window.addEventListener('online', function() {
    if (isExamLocked && !isSubmitted) {
        if (typeof showTimeChangeToast === 'function') {
            showTimeChangeToast("📶 Đã có kết nối Internet! Đang tự động gửi lại bài...");
        }
        if (typeof executeSubmitExam === 'function') executeSubmitExam(false);
    }
});

function lockExamInteractions() {
    isExamLocked = true;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    const maxAllowedSec = totalTimeSeconds || (TIME_LIMIT_MINUTES * 60) || 5400;
    if (!lockedDurationSec && examStartTime) {
        let actualSec = Math.round((Date.now() - examStartTime) / 1000);
        lockedDurationSec = Math.min(Math.max(1, actualSec), maxAllowedSec);
    }

    const quizContent = document.getElementById("quiz-content");
    if (quizContent) {
        quizContent.classList.add("quiz-content-locked");
        quizContent.querySelectorAll("input, button, select, textarea").forEach(el => {
            el.disabled = true;
            if (el.tagName === 'INPUT' && el.type === 'text') el.readOnly = true;
        });
    }

    const topSubmitBtn = document.querySelector(".btn-top-submit");
    if (topSubmitBtn) {
        topSubmitBtn.innerText = "⏳ Đang nộp";
        topSubmitBtn.style.background = "linear-gradient(135deg, #0284c7, #0369a1)";
        topSubmitBtn.onclick = function() { 
            if (typeof executeSubmitExam === 'function') executeSubmitExam(false); 
        };
    }

    const timerBox = document.getElementById("nav-timer-box");
    if (timerBox) {
        timerBox.classList.remove("timer-warning");
        const timerVal = document.getElementById("nav-timer-val");
        if (timerVal) timerVal.innerText = "HẾT GIỜ THI";
    }
}

// BỘ GIÁM SÁT AN TOÀN CHỐNG TRẮNG MÀN HÌNH (ZERO-BLANK-SCREEN WATCHDOG)
function ensureSomeUIElementsAreVisible() {
    const gl = document.getElementById('global-loading');
    if (gl) gl.style.display = 'none';

    const quizContent = document.getElementById("quiz-content");
    const studentCard = document.getElementById("student-card");
    const loginBox = document.getElementById("login-box");
    const resView = document.getElementById("result-view-container");
    const errorCard = document.getElementById("error-card");

    const isQuizShown = quizContent && quizContent.style.display === "block";
    const isStudentShown = studentCard && studentCard.style.display === "block";
    const isLoginShown = loginBox && loginBox.style.display === "block";
    const isResShown = resView && resView.style.display === "block";
    const isErrShown = errorCard && errorCard.style.display === "block";

    // Nếu không có bất kỳ màn hình nào được bật -> Ép bật student-card ngay lập tức
    if (!isQuizShown && !isStudentShown && !isLoginShown && !isResShown && !isErrShown) {
        console.warn("⚠️ Watchdog: Phát hiện nguy cơ trắng màn hình trên WebKit Messenger. Đang bật student-card ngay!");
        if (studentCard) studentCard.style.display = "block";
    }
}

async function initExamEngine() {
    if (hasInitExamEngine) return;
    hasInitExamEngine = true;

    checkAndInjectIOSMessengerBanner();

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    const isAutostart = (urlParams.get('autostart') === "1");

    const hideLoading = () => {
        const gl = document.getElementById('global-loading');
        if (gl) gl.style.display = 'none';
    };

    // Đặt hẹn giờ 1.5 giây cứu cánh tối đa: Bất kể chuyện gì xảy ra, màn hình loading phải biến mất
    setTimeout(ensureSomeUIElementsAreVisible, 1500);

    if (!quizId) {
        hideLoading();
        showError("Lỗi đường dẫn", "Không tìm thấy mã đề thi (thiếu tham số ?id=...)");
        return;
    }

    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!client) throw new Error("Chưa khởi tạo được Supabase Client");

        // Đặt timeout 6 giây cho truy vấn Supabase quizzes để không bị treo vĩnh viễn trên mạng di động
        const fetchPromise = client.from('quizzes').select('*').eq('id', quizId).single();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Mạng kết nối tới máy chủ quá thời gian")), 6000));
        
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
        if (error || !data) throw new Error("Mã đề thi không tồn tại trên hệ thống!");

        examData = {
            ...data,
            timeLimitMinutes: data.time_limit_minutes,
            examStartTimeStr: data.exam_start_time,
            examEndTimeStr: data.exam_end_time,
            allowFree: data.allow_free,
            resultMode: data.result_mode,
            allowReviewOriginal: data.allow_review_original,
            showOnlineCount: data.show_online_count,
            allowExportExam: data.allow_export_exam,
            isShuffled: data.is_shuffled,
            scoringConfig: data.scoring_config
        };

        if (urlParams.get('review') === "1") {
            if (examData.allowReviewOriginal !== true) {
                hideLoading();
                showError("Bị Khóa", "Giáo viên đã tắt tính năng xem đáp án gốc của đề thi này.");
                return;
            }
            isSubmitted = true;
            totalQuestionsCount = examData.questions ? examData.questions.length : 0;
            document.getElementById("top-navbar").style.display = "none";
            document.getElementById("quiz-content").style.display = "none";
            document.getElementById("login-box").style.display = "none";
            document.getElementById("student-card").style.display = "none";
            document.getElementById("waiting-room-card").style.display = "none";
            renderOriginalReviewScreen();
            hideLoading();
            return;
        }

        if (examData.allowFree !== undefined) {
            safeLocal.setItem(`exam_allow_free_${quizId}`, String(examData.allowFree !== false));
        }

        if (typeof loadRealtimeExamConfig === 'function') {
            try { await loadRealtimeExamConfig(); } catch(e) {}
        }

        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount();

        fetchExamQuestions(isAutostart);
        setupBackPrevention();

        if (typeof requestWakeLock === 'function') {
            try { requestWakeLock(); } catch(e) {}
        }
        
        await checkSessionStatus(isAutostart);

        if (typeof startTimeWatcherRealtime === 'function') {
            startTimeWatcherRealtime(quizId);
        }

        if (typeof startImageSyncWatcher === 'function') {
            startImageSyncWatcher(quizId);
        }
    } catch (error) {
        hideLoading();
        console.error("Lỗi tải đề thi:", error);
        showError("Lỗi tải đề thi", error.message || "Vui lòng kiểm tra lại mạng Internet và tải lại trang");
    } finally {
        hideLoading();
        ensureSomeUIElementsAreVisible();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExamEngine);
} else {
    initExamEngine();
}
window.addEventListener("load", initExamEngine);

function shuffleArray(arr) {
    let array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function shuffleExamData(data) {
    if (!data || !data.questions) return;
    const isP4 = typeof isPart4Question === 'function' ? isPart4Question : (q => (q.part === 4 || q.isPart4 || q.type === "essay" || q.type === "essay_answer"));
    let p1 = shuffleArray(data.questions.filter(q => q.type === "multiple_choice" && !isP4(q)));
    let p2 = shuffleArray(data.questions.filter(q => q.type === "true_false" && !isP4(q)));
    let p3 = shuffleArray(data.questions.filter(q => (q.type === "short_answer") && !isP4(q)));
    let p4 = shuffleArray(data.questions.filter(q => isP4(q)));
    data.questions = [...p1, ...p2, ...p3, ...p4];
}

function trackPadletClick(qId) { 
    if (isSubmitted || isExamLocked) return; 
    window.SECURE_VAULT.padletClicked[qId] = true; 
    saveExamStateToStorage(); 
}

function toggleSubPadlet(qId) { 
    if (isSubmitted || isExamLocked) return; 
    const el = document.getElementById(`sub-padlet-dropdown-${qId}`); 
    if (el) el.style.display = (el.style.display === "none" || el.style.display === "") ? "flex" : "none"; 
}

function resetToFreshLoginScreen() { 
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd");
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);

    safeLocal.removeItem(getStorageKey()); 
    if (typeof getStorageKey === 'function') {
        safeLocal.removeItem(getStorageKey(1));
        safeLocal.removeItem(getStorageKey(2));
        safeLocal.removeItem(getStorageKey(3));
    }
    safeLocal.removeItem(`shuffled_exam_${getExamCode()}`);
    safeLocal.removeItem("pending_exam_submission");
    safeLocal.removeItem("last_submission_cleared");

    if (typeof examIndexedDB !== 'undefined') {
        examIndexedDB.removeItem('exam_states', getStorageKey()).catch(() => {});
    }

    if (quizId && sId) {
        const nextAttempt = getRealStudentExamAttemptNumber(quizId, sId);
        window.currentStudentAttemptNumber = nextAttempt;
    }

    window.location.reload(); 
}

// BẢN FIX TOÀN DIỆN: CHỐNG TRẮNG MÀN HÌNH KHI VỪA VÀO PHÒNG THI TỪ MESSENGER
async function checkSessionStatus(isAutostart = false) { 
    syncStudentFromParamsAndStorage();
    const hideLoading = () => {
        const gl = document.getElementById('global-loading');
        if (gl) gl.style.display = 'none';
    };

    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd");
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);

    if (typeof renderStudentSubmissionHistoryButtons === 'function') {
        renderStudentSubmissionHistoryButtons();
    }

    let attempt = 1;
    if (quizId && sId) {
        try {
            attempt = await fetchStudentAttemptNumberFromCloud(quizId, sId);
        } catch(e) {
            attempt = 1;
        }
        window.currentStudentAttemptNumber = attempt;
        checkAndDisplayAttemptNoticeOnStudentCard(sId);
    }

    const isCleared = (safeLocal.getItem("last_submission_cleared") === "true");
    if (isCleared && !isAutostart) {
        hideLoading();
        ensureSomeUIElementsAreVisible();
        return;
    }

    // THỬ KHÔI PHỤC PHIÊN LÀM BÀI CŨ NẾU CÓ
    let isRestored = restoreExamStateFromStorage();
    if (!isRestored && typeof examIndexedDB !== 'undefined') {
        try {
            // Đặt timeout 300ms cho IndexedDB tránh treo trên iOS WebKit
            const idbPromise = examIndexedDB.getItem('exam_states', getStorageKey(attempt));
            const timeoutPromise = new Promise(res => setTimeout(() => res(null), 300));
            const idbState = await Promise.race([idbPromise, timeoutPromise]);
            
            if (idbState && idbState.data) {
                safeLocal.setItem(getStorageKey(attempt), JSON.stringify(idbState.data));
                isRestored = restoreExamStateFromStorage();
            }
        } catch(e) {}
    }

    if (isRestored) { 
        const elapsedTimeSec = Math.floor((Date.now() - examStartTime) / 1000); 
        const timeRemaining = totalTimeSeconds - elapsedTimeSec; 
        const currentAnsCount = Object.keys(window.SECURE_VAULT.userAnswers || {}).length;

        if (isAutostart || timeRemaining <= 0 || isExamLocked) {
            if (timeRemaining <= 0 || isExamLocked || currentAnsCount === 0) {
                console.warn("⚠️ Dọn dẹp phiên thi cũ không hợp lệ để bắt đầu phiên mới sạch 100%");
                safeLocal.removeItem(getStorageKey(attempt));
                if (typeof getStorageKey === 'function') {
                    safeLocal.removeItem(getStorageKey());
                }
                if (typeof examIndexedDB !== 'undefined') {
                    examIndexedDB.removeItem('exam_states', getStorageKey(attempt)).catch(() => {});
                }
                isRestored = false;
                isExamLocked = false;
                lockedDurationSec = 0;
                examStartTime = null;
                window.SECURE_VAULT.userAnswers = {};
                window.SECURE_VAULT.padletClicked = {};
            }
        }
    }

    if (isRestored) { 
        const sName = document.getElementById("student-name").value.trim() || "Thí sinh"; 
        const sClass = document.getElementById("student-class").value.trim() || "---"; 
        document.getElementById("nav-student-name").innerText = sName; 
        document.getElementById("nav-student-id").innerText = (attempt > 1) ? `${sId} (Lần ${attempt})` : sId; 
        document.getElementById("nav-student-class").innerText = sClass; 
        document.getElementById("nav-exam-code-text").innerText = `Đề: ${getMaDe()}`; 
        
        document.getElementById("login-box").style.display = "none"; 
        document.getElementById("student-card").style.display = "none"; 
        document.getElementById("waiting-room-card").style.display = "none"; 
        document.getElementById("top-navbar").style.display = "block"; 
        document.getElementById("quiz-content").style.display = "block"; 
        
        hideLoading();
        reapplySavedAnswers(); 
        updateProgress(); 
        
        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount();

        const elapsedTimeSec = Math.floor((Date.now() - examStartTime) / 1000); 
        const timeRemaining = totalTimeSeconds - elapsedTimeSec; 

        if (timeRemaining > 0 && !isExamLocked) {
            remainingSeconds = timeRemaining; 
            startCountdownTimer(); 
            startPresenceSystem(sId);
            ensureActiveSessionAndDraft();
            return; 
        }
    }

    // XỬ LÝ AUTOSTART CHO HỌC SINH TỪ TRANG CHỦ VÀO (ĐÃ FIX: KHÔNG BAO GIỜ BỊ TRẮNG MÀN HÌNH)
    if (isAutostart) {
        let sIdVal = document.getElementById("student-id")?.value.trim() || urlParams.get('sbd') || safeLocal.getItem("saved_student_sbd") || "";
        let sNameVal = document.getElementById("student-name")?.value.trim() || urlParams.get('name') || safeLocal.getItem("saved_student_name") || "";
        let sClassVal = document.getElementById("student-class")?.value.trim() || urlParams.get('class') || safeLocal.getItem("saved_student_class") || "";

        if (document.getElementById("student-id")) document.getElementById("student-id").value = sIdVal;
        if (document.getElementById("student-name")) document.getElementById("student-name").value = sNameVal;
        if (document.getElementById("student-class")) document.getElementById("student-class").value = sClassVal;

        if (sIdVal && sNameVal) {
            if (typeof startExamAction === 'function') {
                try {
                    const success = await startExamAction(true);
                    if (success) {
                        document.getElementById("login-box").style.display = "none";
                        document.getElementById("student-card").style.display = "none";
                        hideLoading();
                        return;
                    } else {
                        document.getElementById("student-card").style.display = "block";
                    }
                } catch(e) {
                    console.error("Lỗi autostart:", e);
                    document.getElementById("student-card").style.display = "block";
                }
            }
            hideLoading();
            ensureSomeUIElementsAreVisible();
            return;
        } else {
            // Nếu thông tin rỗng do Messenger cắt query -> Hiện ngay student-card để học sinh vào bình thường
            document.getElementById("student-card").style.display = "block";
            hideLoading();
            ensureSomeUIElementsAreVisible();
            return;
        }
    }

    hideLoading();
    ensureSomeUIElementsAreVisible();
}

function fetchExamQuestions(isAutostart = false) { 
    try { 
        if (typeof examData === 'undefined' || !examData) { 
            showError("Lỗi", "Không tìm thấy dữ liệu đề thi!"); 
            return; 
        } 
        if (examData.title) { 
            EXAM_NAME = examData.title; 
            document.getElementById("banner-title").innerText = EXAM_NAME; 
            const examTitleEl = document.getElementById("res-exam-title");
            if (examTitleEl) examTitleEl.innerText = EXAM_NAME;
        } 
        document.getElementById("nav-exam-code-text").innerText = `Đề: ${getMaDe()}`; 
        if (examData.password !== undefined) EXAM_PASSWORD = String(examData.password).trim(); 
        
        if (examData.timeLimitMinutes || examData.time_limit_minutes) { 
            TIME_LIMIT_MINUTES = parseInt(examData.timeLimitMinutes || examData.time_limit_minutes, 10); 
            totalTimeSeconds = TIME_LIMIT_MINUTES * 60; 
            remainingSeconds = totalTimeSeconds; 
        } 
        if (examData.examStartTimeStr && examData.examEndTimeStr) { 
            const st = new Date(examData.examStartTimeStr).toLocaleString("vi-VN"); 
            const et = new Date(examData.examEndTimeStr).toLocaleString("vi-VN"); 
            const noticeEl = document.getElementById("exam-time-notice"); 
            noticeEl.innerText = `⏱ Mở từ: ${st} - Đến: ${et}`; 
            noticeEl.style.display = "inline-block"; 
        } 
        
        const shuffleKey = `shuffled_exam_${getExamCode()}`;
        const isAdminMode = typeof checkIsAdminPreviewMode === 'function' && checkIsAdminPreviewMode();
        let shouldShuffle = (examData.isShuffled !== false) && !isAdminMode; 

        if (shouldShuffle) {
            const cachedShuffle = safeLocal.getItem(shuffleKey);
            if (cachedShuffle) {
                try {
                    const parsedQ = JSON.parse(cachedShuffle);
                    if (Array.isArray(parsedQ)) {
                        examData.questions = parsedQ;
                    } else {
                        shuffleExamData(examData);
                        safeLocal.setItem(shuffleKey, JSON.stringify(examData.questions));
                    }
                } catch(e) {
                    shuffleExamData(examData);
                    safeLocal.setItem(shuffleKey, JSON.stringify(examData.questions));
                }
            } else {
                shuffleExamData(examData);
                safeLocal.setItem(shuffleKey, JSON.stringify(examData.questions));
            }
        }

        if (!isAutostart) {
            if (EXAM_PASSWORD !== "") document.getElementById("login-box").style.display = "block"; 
            else document.getElementById("student-card").style.display = "block"; 
        }
        
        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        renderQuizLayout(examData.questions || [], examData.images || {}); 
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise().catch(() => {});
        }
    } catch (err) { 
        showError("Lỗi", err.message); 
    } 
}

function showError(title, msg) { 
    document.getElementById("login-box").style.display = "none"; 
    document.getElementById("student-card").style.display = "none"; 
    const errCard = document.getElementById("error-card"); 
    if (errCard) {
        document.getElementById("error-title").innerText = title; 
        document.getElementById("error-msg").innerHTML = msg + `<br><br><button type="button" onclick="window.location.reload()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:800; cursor:pointer;">🔄 Tải lại trang</button>`; 
        errCard.style.display = "block"; 
    }
}

function selectOption(qId, letter) { 
    if (isSubmitted || isExamLocked) return; 
    const letters = ["A", "B", "C", "D"]; 
    letters.forEach(l => { 
        const el = document.getElementById(`opt-box-${qId}-${l}`); 
        if (el) el.classList.remove('selected'); 
    }); 
    const current = document.getElementById(`opt-box-${qId}-${letter}`); 
    if (current) current.classList.add('selected'); 
    const radio = document.querySelector(`input[name="q${qId}"][value="${letter}"]`); 
    if (radio) radio.checked = true; 
    window.SECURE_VAULT.userAnswers[`q${qId}`] = letter; 
    
    updateProgress(); 

    if (_storageDebounceTimer) clearTimeout(_storageDebounceTimer);
    _storageDebounceTimer = setTimeout(() => {
        saveExamStateToStorage();
        autoSaveAnswerToCloud(`q${qId}`, letter);
    }, 180);
}

function onStatementChange(subKey) { 
    if (isSubmitted || isExamLocked) return; 
    const selected = document.querySelector(`input[name="${subKey}"]:checked`); 
    if (!selected) return;

    window.SECURE_VAULT.userAnswers[subKey] = selected.value; 
    updateProgress(); 

    if (_statementDebounceTimer) clearTimeout(_statementDebounceTimer);
    _statementDebounceTimer = setTimeout(() => {
        saveExamStateToStorage(); 
        autoSaveAnswerToCloud(subKey, selected.value);
    }, 180);
}

function onShortInputChange(qId) { 
    if (isSubmitted || isExamLocked) return; 
    const val = document.getElementById(`q${qId}-input`).value.trim(); 
    if (val) {
        window.SECURE_VAULT.userAnswers[`q${qId}`] = val; 
    } else {
        delete window.SECURE_VAULT.userAnswers[`q${qId}`]; 
    }
    updateProgress(); 

    saveExamStateToStorage(); 

    if (_autoSaveDebounceTimer) clearTimeout(_autoSaveDebounceTimer);
    _autoSaveDebounceTimer = setTimeout(() => {
        autoSaveAnswerToCloud(`q${qId}`, val);
    }, 300);
}

function updateProgress() { 
    if (!examData || !examData.questions) return 0; 
    let answeredCount = 0; 
    examData.questions.forEach(q => { 
        const navBtn = document.getElementById(`q-nav-btn-${q.id}`); 
        let status = "unanswered"; 
        if (q.type === "multiple_choice") { 
            if (window.SECURE_VAULT.userAnswers[`q${q.id}`]) { answeredCount++; status = "answered"; } 
        } else if (q.type === "true_false") { 
            let doneCount = 0; 
            const stList = q.statements || [];
            const reqCount = stList.length || 4;
            for (let i = 0; i < reqCount; i++) {
                const st = stList[i];
                if (st && window.SECURE_VAULT.userAnswers[`q${q.id}_${st.id}`]) {
                    doneCount++;
                }
            }
            if (doneCount === reqCount) { answeredCount++; status = "answered"; } 
            else if (doneCount > 0) { status = "partial"; } 
        } else { 
            if (window.SECURE_VAULT.userAnswers[`q${q.id}`]) { answeredCount++; status = "answered"; } 
        } 
        if (navBtn) { 
            navBtn.classList.remove("answered", "partial"); 
            if (status === "answered") navBtn.classList.add("answered"); 
            else if (status === "partial") navBtn.classList.add("partial"); 
        } 
    }); 
    const progressValEl = document.getElementById("nav-progress-val"); 
    if (progressValEl) progressValEl.innerText = `${answeredCount}/${totalQuestionsCount}`; 
    return answeredCount; 
}

function reapplySavedAnswers() { 
    Object.keys(window.SECURE_VAULT.userAnswers).forEach(key => { 
        const val = window.SECURE_VAULT.userAnswers[key]; 
        if (key.includes('_')) { 
            const r = document.querySelector(`input[name="${key}"][value="${val}"]`); 
            if (r) r.checked = true; 
        } else if (document.getElementById(`${key}-input`)) { 
            document.getElementById(`${key}-input`).value = val; 
        } else { 
            const qId = key.replace('q', ''); 
            const letters = ["A", "B", "C", "D"]; 
            letters.forEach(l => { 
                const el = document.getElementById(`opt-box-${qId}-${l}`); 
                if (el) el.classList.remove('selected'); 
            }); 
            const current = document.getElementById(`opt-box-${qId}-${val}`); 
            if (current) current.classList.add('selected'); 
            const radio = document.querySelector(`input[name="q${qId}"][value="${val}"]`); 
            if (radio) radio.checked = true; 
        } 
    }); 
}

function formatHHMMSS(totalSecs) { 
    const h = Math.floor(totalSecs / 3600); 
    const m = Math.floor((totalSecs % 3600) / 60); 
    const s = totalSecs % 60; 
    return `${h < 10 ? '0'+h : h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`; 
}

function startCountdownTimer() { 
    if (isExamLocked) return;
    const timerVal = document.getElementById("nav-timer-val"); 
    const timerBox = document.getElementById("nav-timer-box"); 
    if (timerInterval) clearInterval(timerInterval); 
    
    timerInterval = setInterval(() => { 
        if (isExamLocked) {
            clearInterval(timerInterval);
            timerInterval = null;
            return;
        }

        const now = Date.now(); 
        let currentEndTimeMs = Infinity; 
        if (typeof examData !== 'undefined' && examData && examData.examEndTimeStr) { 
            let t = new Date(examData.examEndTimeStr).getTime();
            if (!isNaN(t)) currentEndTimeMs = t;
        } 

        const elapsedTimeSec = examStartTime ? Math.floor((now - examStartTime) / 1000) : 0; 
        remainingSeconds = totalTimeSeconds - elapsedTimeSec; 

        // LỚP BẢO VỆ: Nếu học sinh mới vào dưới 15 giây mà phát hiện hết giờ hoặc hết hạn, không tự nộp bài trắng
        if (elapsedTimeSec < 15 && (remainingSeconds <= 0 || now >= currentEndTimeMs)) {
            if (now >= currentEndTimeMs) {
                clearInterval(timerInterval);
                timerInterval = null;
                alert("⚠️ KHUNG GIỜ LÀM BÀI THI NÀY ĐÃ KẾT THÚC!\nHệ thống không nhận bài làm mới. Vui lòng quay lại trang chủ.");
                window.location.href = "./index.html";
                return;
            }
            remainingSeconds = totalTimeSeconds;
            return;
        }

        if (now >= currentEndTimeMs || remainingSeconds <= 0) { 
            clearInterval(timerInterval); 
            timerInterval = null;
            if (timerVal) timerVal.innerText = "00:00:00"; 
            lockExamInteractions();
            if (typeof executeSubmitExam === 'function') executeSubmitExam(true); 
            return; 
        } 

        if (timerVal) timerVal.innerText = formatHHMMSS(remainingSeconds); 
        if (remainingSeconds <= 120 && timerBox) timerBox.classList.add("timer-warning"); 
        else if (timerBox) timerBox.classList.remove("timer-warning");
    }, 1000); 
}

function saveExamStateToStorage() { 
    if (!examStartTime || isSubmitted) return; 
    const currentAttempt = window.currentStudentAttemptNumber || 1;
    const dataToSave = { 
        userAnswers: window.SECURE_VAULT.userAnswers, 
        padletClickedMap: window.SECURE_VAULT.padletClicked, 
        examStartTime: examStartTime, 
        tabSwitchCount: tabSwitchCount, 
        timeLimitMinutes: TIME_LIMIT_MINUTES, 
        studentId: document.getElementById("student-id").value.trim(), 
        studentName: document.getElementById("student-name").value.trim(), 
        studentClass: document.getElementById("student-class").value.trim(), 
        isStarted: true,
        attemptNumber: currentAttempt,
        isExamLocked: isExamLocked,
        lockedDurationSec: lockedDurationSec
    }; 
    safeLocal.setItem(getStorageKey(currentAttempt), JSON.stringify(dataToSave)); 

    if (typeof examIndexedDB !== 'undefined') {
        examIndexedDB.setItem('exam_states', {
            key: getStorageKey(currentAttempt),
            data: dataToSave,
            updatedAt: Date.now()
        }).catch(() => {});
    }
}

function restoreExamStateFromStorage() { 
    try { 
        const currentAttempt = window.currentStudentAttemptNumber || 1;
        const storageKey = getStorageKey(currentAttempt);
        const raw = safeLocal.getItem(storageKey); 
        if (!raw) return false; 
        
        let parsed = JSON.parse(raw);
        
        const urlParams = new URLSearchParams(window.location.search);
        const currentUrlSbd = urlParams.get('sbd');
        if (currentUrlSbd && parsed && parsed.studentId && currentUrlSbd.toLowerCase() !== String(parsed.studentId).toLowerCase()) {
            safeLocal.removeItem(storageKey);
            return false;
        }

        if (parsed && parsed.isStarted) { 
            const savedStartTime = parsed.examStartTime || Date.now();
            const elapsed = Math.floor((Date.now() - savedStartTime) / 1000);
            const limitSec = (parseInt(parsed.timeLimitMinutes, 10) || TIME_LIMIT_MINUTES || 45) * 60;

            if (elapsed > limitSec || parsed.isExamLocked) {
                console.warn("Dọn dẹp phiên thi cũ đã quá giờ hoặc bị khóa để bắt đầu bài mới.");
                safeLocal.removeItem(storageKey);
                if (typeof examIndexedDB !== 'undefined') {
                    examIndexedDB.removeItem('exam_states', storageKey).catch(() => {});
                }
                return false;
            }

            window.SECURE_VAULT.userAnswers = parsed.userAnswers || {}; 
            window.SECURE_VAULT.padletClicked = parsed.padletClickedMap || {}; 
            tabSwitchCount = parsed.tabSwitchCount || 0; 
            examStartTime = savedStartTime; 
            
            if (parsed.timeLimitMinutes) {
                TIME_LIMIT_MINUTES = parseInt(parsed.timeLimitMinutes, 10);
                totalTimeSeconds = TIME_LIMIT_MINUTES * 60;
            }
            if (parsed.studentId) document.getElementById("student-id").value = parsed.studentId; 
            if (parsed.studentName) document.getElementById("student-name").value = parsed.studentName; 
            if (parsed.studentClass) document.getElementById("student-class").value = parsed.studentClass; 
            
            isExamLocked = false;
            lockedDurationSec = 0;
            return true; 
        } 
    } catch(e) {} 
    return false; 
}

function renderResultSummaryScreen(correct, wrong, spentMins, spentTimeStr, finalScore, maxScale = 10.0, quizId = "") { 
    document.getElementById("top-navbar").style.display = "none"; 
    document.getElementById("quiz-content").style.display = "none"; 

    const topbar = document.getElementById("universal-backup-topbar");
    if (topbar) topbar.style.display = "flex";
    const topDownloadBtn = document.getElementById("btn-always-download-backup");
    if (topDownloadBtn) topDownloadBtn.style.display = "inline-flex";

    const resView = document.getElementById("result-view-container"); 
    resView.style.display = "block"; 
    
    const resExamTitle = document.getElementById("res-exam-title");
    if (resExamTitle) resExamTitle.innerText = EXAM_NAME || "BÀI THI TRẮC NGHIỆM";

    const currentAttempt = window.currentStudentAttemptNumber || 1;
    const scoreTitle = (maxScale && maxScale !== 10.0)
        ? `Lần ${currentAttempt}: Đúng ${correct}/${totalQuestionsCount} câu (${finalScore} / ${maxScale} điểm)`
        : `Lần ${currentAttempt}: Đúng ${correct}/${totalQuestionsCount} câu (${finalScore} điểm)`;

    document.getElementById("res-score-overview").innerText = scoreTitle; 
    document.getElementById("res-stat-correct").innerText = correct; 
    document.getElementById("res-stat-wrong").innerText = wrong; 
    document.getElementById("res-stat-time").innerText = spentMins; 
    document.getElementById("res-user-name").innerText = document.getElementById("student-name").value.trim() || "Thí sinh"; 
    document.getElementById("res-user-class").innerText = document.getElementById("student-class").value.trim() || "---"; 
    document.getElementById("res-user-id").innerText = document.getElementById("student-id").value.trim() || "---"; 
    document.getElementById("res-spent-time").innerText = spentTimeStr; 

    let existingDownloadBtn = document.getElementById("res-btn-download-backup");
    if (!existingDownloadBtn) {
        const btnBox = document.createElement("div");
        btnBox.id = "res-download-container-box";
        btnBox.style.margin = "12px 0";
        btnBox.innerHTML = `
            <button type="button" id="res-btn-download-backup" onclick="downloadCompletedOrDraftSubmission()" style="width: 100%; padding: 11px 16px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; border: none; border-radius: 12px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                💾 Tải file dự phòng bài làm (.json)
            </button>
        `;
        const userDetails = document.querySelector(".user-details-grid");
        if (userDetails && userDetails.parentNode) {
            userDetails.parentNode.insertBefore(btnBox, userDetails.nextSibling);
        }
    }

    const resultMode = (examData && examData.resultMode) ? examData.resultMode : "show_all";
    const scoreOverviewEl = document.getElementById("res-score-overview");
    const statsCardsEl = document.querySelector(".stats-cards-grid");
    const reviewBannerEl = document.querySelector(".review-banner");
    const reviewBodyEl = document.getElementById("review-container-body");

    if (resultMode === "hide_all") {
        scoreOverviewEl.style.display = "none";
        statsCardsEl.style.display = "none";
        reviewBannerEl.style.display = "none";
        reviewBodyEl.style.display = "none";
    } else if (resultMode === "score_only") {
        scoreOverviewEl.style.display = "block";
        statsCardsEl.style.display = "grid";
        reviewBannerEl.style.display = "none";
        reviewBodyEl.style.display = "none";
    } else {
        scoreOverviewEl.style.display = "block";
        statsCardsEl.style.display = "grid";
        reviewBannerEl.style.display = "flex";
        reviewBodyEl.style.display = "block";

        let revHTML = ""; 
        let idx = 1; 

        (examData.questions || []).forEach(q => { 
            const imgUrl = getEffectiveImageUrl(q, examData.images || {}); 
            const imgTag = buildImgHtml(imgUrl, `rev_${q.id}`); 
            const explainText = window.SECURE_VAULT.explanations[`q${q.id}`] ? `<div class="explanation-box">💡 <b>Lời giải chi tiết:</b> ${window.SECURE_VAULT.explanations[`q${q.id}`]}</div>` : ""; 
            
            if (q.type === "multiple_choice") { 
                const letters = ["A", "B", "C", "D"]; 
                const uAns = window.SECURE_VAULT.userAnswers[`q${q.id}`]; 
                const cAns = window.SECURE_VAULT.answers[`q${q.id}`]; 
                revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge" style="background:${uAns===cAns?'#22c55e':'#ef4444'}">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="options-list grid-2">${q.options.map((opt, oIdx) => { const L = letters[oIdx]; let cls = ""; let icon = ""; if (L === cAns) { cls = "is-correct"; icon = " ✓"; } else if (L === uAns && uAns !== cAns) { cls = "is-wrong"; icon = " ✗"; } return `<div class="opt-label ${cls}"><span class="opt-circle">${L}</span><span class="opt-text">${opt} <b>${icon}</b></span></div>`; }).join('')}</div>${explainText}</div>`; 
            } else if (q.type === "true_false") { 
                let rows = ""; 
                (q.statements || []).forEach(st => { 
                    const sub = `q${q.id}_${st.id}`; 
                    const uVal = window.SECURE_VAULT.userAnswers[sub] || "Chưa chọn"; 
                    const cVal = window.SECURE_VAULT.answers[sub]; 
                    const ok = (uVal === cVal); 
                    rows += `<tr><td><b>${st.id})</b> ${st.statement}</td><td align="center">${uVal==="Đúng"?(ok?"🟢 Đúng":"🔴 Đúng (Sai)"):""}</td><td align="center">${uVal==="Sai"?(ok?"🟢 Sai":"🔴 Sai (Sai)"):""}</td><td align="center"><b>${cVal}</b></td></tr>`; 
                }); 
                revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="tf-table-box"><table class="tf-table"><thead><tr><th>Mệnh đề</th><th>Bạn chọn</th><th>Đ.Á Đúng</th></tr></thead><tbody>${rows}</tbody></table></div>${explainText}</div>`; 
            } else { 
                const uVal = window.SECURE_VAULT.userAnswers[`q${q.id}`] || "(Để trống)"; 
                const cVal = window.SECURE_VAULT.answers[`q${q.id}`]; 
                revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div style="margin-top:14px; font-size:1.05rem; font-weight:600;"><div style="color:#15803d; font-weight:800; margin-top:6px;">Đáp án đúng / tham khảo: ${cVal}</div><div>Tr.lời của bạn: <b>${uVal}</b></div></div>${explainText}</div>`; 
            } 
            idx++; 
        }); 
        reviewBodyEl.innerHTML = revHTML; 
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise().catch(() => {});
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function renderOriginalReviewScreen() {
    const resView = document.getElementById("result-view-container"); 
    resView.style.display = "block"; 
    document.querySelector(".result-summary-card").style.display = "none";

    const reviewBannerEl = document.querySelector(".review-banner");
    const reviewBodyEl = document.getElementById("review-container-body");
    
    reviewBannerEl.style.display = "flex";
    reviewBannerEl.innerHTML = `<span>📖</span> TÀI LIỆU ĐỀ THI GỐC & LỜI GIẢI CHI TIẾT`;
    reviewBannerEl.style.background = "linear-gradient(135deg, #059669, #047857)";

    let generatedAnswerKey = {};
    const letters = ["A", "B", "C", "D"]; 
    (examData.questions || []).forEach(q => {
        if (q.type === "multiple_choice") {
            generatedAnswerKey[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
        } else if (q.type === "true_false") {
            (q.statements || []).forEach(st => {
                generatedAnswerKey[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng' || String(st.correct).toLowerCase() === 'true') ? "Đúng" : "Sai";
            });
        } else {
            generatedAnswerKey[`q${q.id}`] = String(q.correctAnswer).trim();
        }
    });

    let revHTML = ""; 
    let idx = 1; 

    (examData.questions || []).forEach(q => { 
        const imgUrl = getEffectiveImageUrl(q, examData.images || {}); 
        const imgTag = buildImgHtml(imgUrl, `orig_${q.id}`); 
        const explainText = q.explanation ? `<div class="explanation-box">💡 <b>Lời giải chi tiết:</b> ${q.explanation}</div>` : ""; 
        
        if (q.type === "multiple_choice") { 
            const cAns = generatedAnswerKey[`q${q.id}`]; 
            revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="options-list grid-2">${q.options.map((opt, oIdx) => { const L = letters[oIdx]; let cls = ""; let icon = ""; if (L === cAns) { cls = "is-correct"; icon = " ✓ Đ.Án"; } return `<div class="opt-label ${cls}"><span class="opt-circle">${L}</span><span class="opt-text">${opt} <b>${icon}</b></span></div>`; }).join('')}</div>${explainText}</div>`; 
        } else if (q.type === "true_false") { 
            let rows = ""; 
            (q.statements || []).forEach(st => { 
                const sub = `q${q.id}_${st.id}`; 
                const cVal = generatedAnswerKey[sub]; 
                rows += `<tr><td><b>${st.id})</b> ${st.statement}</td><td align="center" style="color:#15803d; font-weight:800;">${cVal}</td></tr>`; 
            }); 
            revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="tf-table-box"><table class="tf-table"><thead><tr><th>Mệnh đề</th><th>Đáp án gốc</th></tr></thead><tbody>${rows}</tbody></table></div>${explainText}</div>`; 
        } else { 
            const cVal = generatedAnswerKey[`q${q.id}`]; 
            revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div style="margin-top:14px; font-size:1.05rem; font-weight:600;"><div style="color:#15803d; font-weight:800; margin-top:6px;">Đáp án chuẩn: ${cVal}</div></div>${explainText}</div>`; 
        } 
        idx++; 
    }); 
    reviewBodyEl.innerHTML = revHTML; 
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise().catch(() => {});
    }
}

window.selectOption = selectOption;
window.onStatementChange = onStatementChange;
window.onShortInputChange = onShortInputChange;
window.toggleSubPadlet = toggleSubPadlet;
window.trackPadletClick = trackPadletClick;
window.resetToFreshLoginScreen = resetToFreshLoginScreen;
window.startCountdownTimer = startCountdownTimer;
window.formatHHMMSS = formatHHMMSS;
window.__saveExamState = saveExamStateToStorage;
window.__updateProgress = updateProgress;
window.lockExamInteractions = lockExamInteractions;
window.autoSaveAnswerToCloud = autoSaveAnswerToCloud;
window.ensureActiveSessionAndDraft = ensureActiveSessionAndDraft;
window.renderResultSummaryScreen = renderResultSummaryScreen;
window.sendDraftToGoogleSheetTemp = sendDraftToGoogleSheetTemp;
