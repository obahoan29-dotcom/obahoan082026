// =========================================================
// FILE: exam-engine-core.js (BẢN SUPABASE TỐI ƯU TIMEOUT 8S & CHUYỂN MESSENGER)
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
let submitFailCount = 0; // Đếm số lần nộp bài không thành công liên tiếp
let submitCountdownInterval = null; // Timer đếm ngược 8 giây khi nộp bài

(function injectLockStyles() {
    const styleId = "exam-engine-lock-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .quiz-content-locked { pointer-events: none !important; user-select: none !important; opacity: 0.88; }
        .quiz-content-locked input, .quiz-content-locked textarea, .quiz-content-locked select, .quiz-content-locked button { cursor: not-allowed !important; }
        .submit-countdown-badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0284c7;
            font-size: 1.4rem;
            font-weight: 900;
            padding: 4px 16px;
            border-radius: 20px;
            border: 2px solid #38bdf8;
            margin: 8px 0;
            font-family: 'Courier New', Courier, monospace;
            animation: pulseSubmitSec 1s infinite alternate;
        }
        @keyframes pulseSubmitSec {
            0% { transform: scale(1); }
            100% { transform: scale(1.08); }
        }
        .file-location-box {
            background: #f8fafc;
            border: 1.5px dashed #0284c7;
            border-radius: 12px;
            padding: 10px 14px;
            margin: 12px 0;
            text-align: left;
            font-size: 0.9rem;
            color: #0f172a;
            line-height: 1.45;
        }
        .file-location-box b { color: #0284c7; }
        .btn-send-messenger-teacher {
            background: linear-gradient(135deg, #0084ff 0%, #0062e0 100%);
            color: #ffffff !important;
            border: none;
            padding: 12px 18px;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 900;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 14px rgba(0, 132, 255, 0.4);
            transition: all 0.2s ease;
            width: 100%;
        }
        .btn-send-messenger-teacher:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }
        .btn-send-messenger-teacher:active {
            transform: translateY(2px) scale(0.96);
        }
    `;
    document.head.appendChild(style);
})();

function getStudentHistoryKey() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData ? examData.id : "quiz");
    
    let sbd = urlParams.get('sbd');
    if (!sbd) sbd = document.getElementById("student-id")?.value.trim();
    if (!sbd) sbd = safeLocal.getItem("saved_student_sbd");
    
    const cleanSbd = sbd ? sbd.replace(/[^a-zA-Z0-9]/g, '_') : "guest";
    return `exam_history_backups_${quizId}_${cleanSbd}`;
}

// BẢNG HIỂN THỊ CÁC NÚT LẦN 1, LẦN 2 TRÊN ĐẦU BÀI LÀM KHI ĐĂNG NHẬP LẠI
function renderBackupHistoryBanners() {
    let container = document.getElementById("multi-backup-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "multi-backup-container";
        container.className = "multi-backup-container";
        document.body.insertBefore(container, document.body.firstChild);
    }
    
    container.innerHTML = "";
    const key = getStudentHistoryKey();
    let history = [];
    try {
        const raw = safeLocal.getItem(key);
        if (raw) history = JSON.parse(raw);
    } catch(e) {}

    if (!Array.isArray(history) || history.length === 0) {
        container.style.display = "none";
        return;
    }
    
    container.style.display = "flex";
    
    history.forEach((payload, index) => {
        const attemptNum = payload.attemptNumber || (index + 1);
        const timeStr = payload.timestamp_str || payload.completion_time || "Vừa xong";
        const score = payload.score10 !== undefined ? payload.score10 : "?";
        
        const row = document.createElement("div");
        row.className = "backup-history-item";
        
        row.innerHTML = `
            <button type="button" class="backup-history-btn" onclick="handleSendHistoryToTeacher(${index})" title="Bấm vào để lấy file JSON bài làm và mở Messenger gửi Thầy giáo">
                💾 <b>Lần ${attemptNum}</b>: Lấy file JSON gửi Thầy giáo (${score}đ - lúc ${timeStr}) ➔
            </button>
            <button type="button" class="backup-history-del" onclick="deleteSpecificBackup(${index})" title="Xóa file dự phòng lần này">✕</button>
        `;
        container.appendChild(row);
    });
}

// HÀM XỬ LÝ LẤY FILE JSON VÀ CHUYỂN MESSENGER KHI BẤM NÚT LẦN 1, LẦN 2...
function handleSendHistoryToTeacher(index) {
    const key = getStudentHistoryKey();
    let history = [];
    try { history = JSON.parse(safeLocal.getItem(key)) || []; } catch(e) {}
    
    const payload = history[index];
    if (!payload) {
        alert("⚠️ Không tìm thấy bài làm của lần thi này!");
        return;
    }

    if (typeof triggerAutoDownloadJSON === 'function') {
        triggerAutoDownloadJSON(payload);
    }

    const sId = (payload.studentId || payload.sbd || "sbd").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const sName = (payload.studentName || "hocsinh").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const attempt = payload.attemptNumber ? `_Lan${payload.attemptNumber}` : `_Lan${index + 1}`;
    const fileName = `BaiLam_${sId}_${sName}${attempt}.json`;

    alert(`📁 THÔNG TIN FILE DỰ PHÒNG LẦN ${index + 1}:\n\n` +
          `1. Tên file: "${fileName}"\n` +
          `2. Vị trí lưu: Thư mục "Tải về" (Downloads) trên thiết bị của em.\n\n` +
          `👉 Hệ thống sẽ chuyển ngay sang Messenger của Thầy. Em hãy chọn tệp "${fileName}" và gửi cho Thầy nhé!`);

    const messengerUrl = (typeof TEACHER_MESSENGER_LINK !== 'undefined' && TEACHER_MESSENGER_LINK) 
        ? TEACHER_MESSENGER_LINK 
        : ((typeof TEACHER_ZALO_LINK !== 'undefined' && TEACHER_ZALO_LINK) ? TEACHER_ZALO_LINK : "https://m.me/");

    window.open(messengerUrl, "_blank");
}

function downloadSpecificBackup(index) {
    handleSendHistoryToTeacher(index);
}

function deleteSpecificBackup(index) {
    if(!confirm("⚠️ CẢNH BÁO QUAN TRỌNG!\n\nBạn có chắc chắn muốn xóa file dự phòng bài làm này không?\n\nNếu Thầy giáo báo chưa nhận được điểm của bạn, bạn sẽ KHÔNG THỂ gửi lại file này để lấy lại điểm được nữa!")) return;
    
    const key = getStudentHistoryKey();
    let history = [];
    try { history = JSON.parse(safeLocal.getItem(key)) || []; } catch(e) {}
    
    history.splice(index, 1);
    safeLocal.setItem(key, JSON.stringify(history));
    renderBackupHistoryBanners();
}

async function autoSaveAnswerToCloud(qKey, answerVal) {
    if (isSubmitted || isExamLocked || !supabaseClient) return;
    const sId = document.getElementById("student-id")?.value.trim();
    if (!sId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    if (!quizId) return;

    const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
    const sName = document.getElementById("student-name")?.value.trim() || "";
    const sClass = document.getElementById("student-class")?.value.trim() || "";
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";

    try {
        await supabaseClient.from('live_drafts').upsert({
            quiz_id: quizId,
            sbd: cleanSbd,
            student_name: sName,
            class_name: sClass,
            category_id: currentCat,
            ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
            exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
            user_answers: window.SECURE_VAULT.userAnswers || {},
            last_updated: new Date().toISOString()
        });
    } catch(e) {}
}

window.addEventListener('online', function() {
    if (isExamLocked && !isSubmitted) {
        if (typeof showTimeChangeToast === 'function') {
            showTimeChangeToast("📶 Đã có kết nối Internet! Đang tự động gửi lại bài...");
        }
        executeSubmitExam(false);
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
        topSubmitBtn.onclick = function() { executeSubmitExam(false); };
    }

    const timerBox = document.getElementById("nav-timer-box");
    if (timerBox) {
        timerBox.classList.remove("timer-warning");
        const timerVal = document.getElementById("nav-timer-val");
        if (timerVal) timerVal.innerText = "HẾT GIỜ THI";
    }
}

async function initExamEngine() {
    if (hasInitExamEngine) return;
    hasInitExamEngine = true;

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    const isAutostart = (urlParams.get('autostart') === "1");

    const hideLoading = () => {
        const gl = document.getElementById('global-loading');
        if (gl) gl.style.display = 'none';
    };

    if (!quizId) {
        hideLoading();
        showError("Lỗi đường dẫn", "Không tìm thấy mã đề thi (thiếu tham số ?id=...)");
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('quizzes').select('*').eq('id', quizId).single();
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

        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount();

        fetchExamQuestions(isAutostart);
        setupBackPrevention();
        if (typeof requestWakeLock === 'function') {
            try { requestWakeLock(); } catch(e) {}
        }
        
        checkPendingSubmissionOnLoad();
        await checkSessionStatus(isAutostart);
        startTimeWatcherRealtime(quizId);
    } catch (error) {
        hideLoading();
        showError("Lỗi tải đề thi", error.message);
    } finally {
        hideLoading();
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
    safeLocal.removeItem(getStorageKey()); 
    safeLocal.removeItem(`shuffled_exam_${getExamCode()}`);
    safeLocal.removeItem("saved_student_sbd");
    safeLocal.removeItem("saved_student_name");
    safeLocal.removeItem("saved_student_class");
    safeLocal.removeItem("current_exam_student");
    safeLocal.removeItem("pending_exam_submission");
    safeLocal.setItem("last_submission_cleared", "true");

    const sName = document.getElementById("student-name");
    const sId = document.getElementById("student-id");
    const sClass = document.getElementById("student-class");
    if (sName) sName.value = "";
    if (sId) sId.value = "";
    if (sClass) sClass.value = "";
    window.location.reload(); 
}

async function startExamAction(isAutostart = false) {
    const sId = document.getElementById("student-id").value.trim();
    const sName = document.getElementById("student-name").value.trim();
    const sClass = document.getElementById("student-class").value.trim();

    if (!sId || !sName || !sClass) {
        if (!isAutostart) alert("⚠️ Vui lòng nhập đầy đủ Số báo danh, Họ và tên, Lớp!");
        return;
    }

    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const checkInClass = typeof findStudentFromDatabase === 'function' ? findStudentFromDatabase(sId, currentCat) : null;
    const isFree = !checkInClass;

    if (isFree) {
        const allowFree = typeof isCurrentExamAllowFree === 'function' ? isCurrentExamAllowFree() : true;
        if (!allowFree) {
            alert("⛔ Đề thi này không cho phép thí sinh tự do tham gia!\nVui lòng kiểm tra lại thông tin đăng nhập.");
            return;
        }
    }

    if (typeof executeStartExamAPI === 'function') {
        await executeStartExamAPI(sId, sName, sClass, isFree);
        renderBackupHistoryBanners();
    }
}

async function checkSessionStatus(isAutostart = false) { 
    syncStudentFromParamsAndStorage();
    const hideLoading = () => {
        const gl = document.getElementById('global-loading');
        if (gl) gl.style.display = 'none';
    };

    if (restoreExamStateFromStorage()) { 
        const sName = document.getElementById("student-name").value.trim() || "Thí sinh"; 
        const sId = document.getElementById("student-id").value.trim() || "---"; 
        const sClass = document.getElementById("student-class").value.trim() || "---"; 
        document.getElementById("nav-student-name").innerText = sName; 
        document.getElementById("nav-student-id").innerText = sId; 
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
        renderBackupHistoryBanners();
        
        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount();

        const elapsedTimeSec = Math.floor((Date.now() - examStartTime) / 1000); 
        const timeRemaining = totalTimeSeconds - elapsedTimeSec; 

        if (isExamLocked) {
            lockExamInteractions();
            executeSubmitExam(true);
            return;
        }

        if (timeRemaining <= 0) {
            if (elapsedTimeSec > totalTimeSeconds + 3600) {
                safeLocal.removeItem(getStorageKey());
                alert("⚠️ Phát hiện phiên làm bài cũ đã hết hạn. Hệ thống đang tải lại phiên mới...");
                window.location.reload();
                return;
            }
            lockExamInteractions();
            executeSubmitExam(true);
            return;
        }

        remainingSeconds = timeRemaining; 
        startCountdownTimer(); 
        startPresenceSystem(sId);
        return; 
    }

    if (isAutostart) {
        const sId = document.getElementById("student-id").value.trim();
        const sName = document.getElementById("student-name").value.trim();
        if (sId && sName) {
            document.getElementById("login-box").style.display = "none";
            document.getElementById("student-card").style.display = "none";
            await startExamAction(true);
            hideLoading();
            return;
        }
    }
    renderBackupHistoryBanners();
    hideLoading();
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
        if (examData.timeLimitMinutes) { 
            TIME_LIMIT_MINUTES = parseInt(examData.timeLimitMinutes, 10); 
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
    document.getElementById("error-title").innerText = title; 
    document.getElementById("error-msg").innerHTML = msg; 
    errCard.style.display = "block"; 
}

function checkPassword() { 
    const val = document.getElementById("exam-pass-input").value.trim(); 
    if (!val) {
        alert("⚠️ Vui lòng nhập mật khẩu hoặc mã học sinh!");
        return;
    }

    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const matchedStudent = (typeof findStudentFromDatabase === 'function' ? findStudentFromDatabase(val, currentCat) : null) || 
                           (typeof findStudentByPassword === 'function' ? findStudentByPassword(val, currentCat) : null);
    
    if (matchedStudent) {
        if (typeof applyStudentToUI === 'function') applyStudentToUI(matchedStudent);
        document.getElementById("login-box").style.display = "none";
        startExamAction();
        return;
    }

    if (EXAM_PASSWORD !== "" && val === EXAM_PASSWORD) { 
        document.getElementById("login-box").style.display = "none"; 
        document.getElementById("student-card").style.display = "block"; 
        if (typeof syncStudentFromParamsAndStorage === 'function') syncStudentFromParamsAndStorage();
    } else { 
        alert("❌ Mật khẩu bài thi không đúng!"); 
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
    saveExamStateToStorage(); 
    autoSaveAnswerToCloud(`q${qId}`, letter);
}

function onStatementChange(subKey) { 
    if (isSubmitted || isExamLocked) return; 
    const selected = document.querySelector(`input[name="${subKey}"]:checked`); 
    if (selected) {
        window.SECURE_VAULT.userAnswers[subKey] = selected.value; 
        autoSaveAnswerToCloud(subKey, selected.value);
    }
    updateProgress(); 
    saveExamStateToStorage(); 
}

function onShortInputChange(qId) { 
    if (isSubmitted || isExamLocked) return; 
    const val = document.getElementById(`q${qId}-input`).value.trim(); 
    if (val) {
        window.SECURE_VAULT.userAnswers[`q${qId}`] = val; 
        autoSaveAnswerToCloud(`q${qId}`, val);
    } else {
        delete window.SECURE_VAULT.userAnswers[`q${qId}`]; 
    }
    updateProgress(); 
    saveExamStateToStorage(); 
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
            (q.statements || []).forEach(st => { 
                if (window.SECURE_VAULT.userAnswers[`q${q.id}_${st.id}`]) doneCount++; 
            }); 
            if (doneCount === (q.statements ? q.statements.length : 4)) { answeredCount++; status = "answered"; } 
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

        const elapsedTimeSec = Math.floor((now - examStartTime) / 1000); 
        remainingSeconds = totalTimeSeconds - elapsedTimeSec; 

        if (now >= currentEndTimeMs || remainingSeconds <= 0) { 
            clearInterval(timerInterval); 
            timerInterval = null;
            if (timerVal) timerVal.innerText = "00:00:00"; 
            lockExamInteractions();
            executeSubmitExam(true); 
            return; 
        } 

        if (timerVal) timerVal.innerText = formatHHMMSS(remainingSeconds); 
        if (remainingSeconds <= 120 && timerBox) timerBox.classList.add("timer-warning"); 
        else if (timerBox) timerBox.classList.remove("timer-warning");
    }, 1000); 
}

function showSubmitConfirmModal() { 
    if (isSubmitted) return; 

    const topbar = document.getElementById("universal-backup-topbar");
    if (topbar) topbar.style.display = "flex";
    const topDownloadBtn = document.getElementById("btn-always-download-backup");
    if (topDownloadBtn) topDownloadBtn.style.display = "inline-flex";

    if (isExamLocked) {
        executeSubmitExam(false);
        return;
    }

    const answered = updateProgress(); 
    const unanswered = totalQuestionsCount - answered; 
    document.getElementById("modal-remain-time").innerText = formatHHMMSS(Math.max(0, remainingSeconds)); 
    document.getElementById("modal-answered-count").innerText = `${answered}/${totalQuestionsCount}`; 
    const warnBox = document.getElementById("modal-unanswered-warning"); 
    if (unanswered > 0) { 
        warnBox.style.display = "block"; 
        warnBox.innerText = `⚠️ Còn ${unanswered} câu chưa làm!`; 
    } else { 
        warnBox.style.display = "none"; 
    } 
    document.getElementById("modal-normal-submit-view").style.display = "block";
    document.getElementById("modal-submitting-progress-view").style.display = "none";
    
    document.getElementById("modal-actions-container").innerHTML = `
        <div class="modal-btn-row">
            <button type="button" class="btn-modal-cancel" onclick="closeSubmitConfirmModal()">Tiếp tục làm</button>
            <button type="button" class="btn-modal-confirm" onclick="executeSubmitExam()">✓ Nộp bài</button>
        </div>
    `;
    document.getElementById("submit-confirm-modal").style.display = "flex"; 
}

function closeSubmitConfirmModal() { 
    if (isSubmittingInProgress) return;
    document.getElementById("submit-confirm-modal").style.display = "none"; 
}

function saveExamStateToStorage() { 
    if (!examStartTime || isSubmitted) return; 
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
        isExamLocked: isExamLocked,
        lockedDurationSec: lockedDurationSec
    }; 
    safeLocal.setItem(getStorageKey(), JSON.stringify(dataToSave)); 
}

function restoreExamStateFromStorage() { 
    try { 
        const raw = safeLocal.getItem(getStorageKey()); 
        const hasPending = safeLocal.getItem("pending_exam_submission");
        if (!raw && !hasPending) return false; 
        
        let parsed = raw ? JSON.parse(raw) : null;
        if (!parsed && hasPending) {
            const pend = JSON.parse(hasPending);
            parsed = {
                isStarted: true,
                isExamLocked: true,
                studentId: pend.studentId || pend.sbd,
                studentName: pend.studentName,
                studentClass: pend.studentClass || pend.className,
                userAnswers: pend.userAnswers || {}
            };
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const currentUrlSbd = urlParams.get('sbd');
        if (currentUrlSbd && parsed && parsed.studentId && currentUrlSbd.toLowerCase() !== String(parsed.studentId).toLowerCase()) {
            safeLocal.removeItem(getStorageKey());
            return false;
        }

        if (parsed && parsed.isStarted) { 
            const savedStartTime = parsed.examStartTime || Date.now();
            const elapsed = Math.floor((Date.now() - savedStartTime) / 1000);
            const limitSec = (parseInt(parsed.timeLimitMinutes, 10) || TIME_LIMIT_MINUTES || 45) * 60;

            if (elapsed > limitSec + 3600 && !hasPending && !parsed.isExamLocked) {
                safeLocal.removeItem(getStorageKey());
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
            
            if (parsed.isExamLocked || hasPending) {
                isExamLocked = true;
                lockedDurationSec = parsed.lockedDurationSec || 0;
            }
            return true; 
        } 
    } catch(e) {} 
    return false; 
}

// BỘ ĐIỀU KHIỂN NỘP BÀI THI: TIMEOUT 8 GIÂY, ĐẾM LÙI TRÊN MÀN HÌNH & CHUYỂN MESSENGER
async function executeSubmitExam(isForceSubmit = false) { 
    if (isSubmitted || isSubmittingInProgress) return; 

    const topbar = document.getElementById("universal-backup-topbar");
    if (topbar) topbar.style.display = "flex";
    const topDownloadBtn = document.getElementById("btn-always-download-backup");
    if (topDownloadBtn) topDownloadBtn.style.display = "inline-flex";

    isSubmittingInProgress = true;
    lockExamInteractions();
    saveExamStateToStorage();
    
    const confirmModal = document.getElementById("submit-confirm-modal");
    const normalView = document.getElementById("modal-normal-submit-view");
    const progressView = document.getElementById("modal-submitting-progress-view");
    const actionsBox = document.getElementById("modal-actions-container");

    if (confirmModal) confirmModal.style.display = "flex";
    if (normalView) normalView.style.display = "none";
    if (actionsBox) actionsBox.innerHTML = "";

    // 1. Chuẩn bị dữ liệu bài làm trước
    const sId = document.getElementById("student-id").value.trim(); 
    const sName = document.getElementById("student-name").value.trim(); 
    const sClass = document.getElementById("student-class").value.trim(); 
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const urlParams = new URLSearchParams(window.location.search);
    const currentQuizId = urlParams.get('id') || (examData && examData.id) || "exam";

    const isClassAcc = typeof findStudentFromDatabase === 'function' ? !!findStudentFromDatabase(sId, currentCat) : false;
    const isFreeStudent = !isClassAcc;

    const maxAllowedSec = totalTimeSeconds || (TIME_LIMIT_MINUTES * 60) || 5400;
    let actualElapsedSec = lockedDurationSec || (examStartTime ? Math.round((Date.now() - examStartTime) / 1000) : 0);
    const durationSec = Math.min(Math.max(1, actualElapsedSec), maxAllowedSec);
    const spentMins = Math.floor(durationSec / 60); 
    const spentSecs = durationSec % 60; 
    const completionTimeStr = `${spentMins} phút ${spentSecs} giây`; 
    
    let scoreResult = null;
    if (typeof calculateExamScoreWithConfig === 'function') {
        scoreResult = calculateExamScoreWithConfig(
            examData.questions || [],
            window.SECURE_VAULT.userAnswers || {},
            window.SECURE_VAULT.answers || {},
            examData.scoringConfig || { mode: 'option1' }
        );
    } else {
        scoreResult = { correctCount: 0, wrongCount: 0, totalRawScore: 0, finalScore: 0, maxScale: 10.0, dataDetails: [] };
    }

    const { correctCount, wrongCount, totalRawScore, finalScore, maxScale, dataDetails } = scoreResult;
    dataDetails.push(`Tab Switch: ${tabSwitchCount}`);

    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    const submissionId = `${currentQuizId}_${cleanSbd}`;

    const payload = { 
        id: submissionId,
        quiz_id: currentQuizId,
        sbd: cleanSbd,
        student_name: sName,
        class_name: sClass,
        score10: finalScore,
        raw_score: Math.round(totalRawScore * 100) / 100,
        max_scale: maxScale,
        correct_count: correctCount,
        wrong_count: wrongCount,
        completion_time: completionTimeStr,
        spent_mins: spentMins,
        tab_switch_count: `${tabSwitchCount} lần`,
        data_string: dataDetails.join(" | "),
        user_answers: window.SECURE_VAULT.userAnswers || {},
        category_id: currentCat,
        is_free: isFreeStudent,
        ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
        exam_title: EXAM_NAME
    }; 

    safeLocal.setItem(`exam_completed_backup_${currentQuizId}`, JSON.stringify(payload));
    safeLocal.setItem("pending_exam_submission", JSON.stringify(payload));
    pendingSubmissionPayload = payload;

    // Lưu mảng lịch sử dự phòng
    const historyKey = getStudentHistoryKey();
    let history = [];
    try {
        const raw = safeLocal.getItem(historyKey);
        if (raw) history = JSON.parse(raw);
    } catch(e) {}
    
    payload.attemptNumber = history.length + 1;
    payload.timestamp_str = new Date().toLocaleString("vi-VN");
    history.push(payload);
    safeLocal.setItem(historyKey, JSON.stringify(history));
    renderBackupHistoryBanners();

    // 2. KHỞI ĐỘNG BỘ ĐẾM NGƯỢC 8 GIÂY TRÊN MÀN HÌNH
    let remainSec = 8;
    if (submitCountdownInterval) clearInterval(submitCountdownInterval);

    const renderCountdownUI = (sec) => {
        if (progressView) {
            progressView.innerHTML = `
                <div class="spinner" style="width:38px; height:38px; margin:0 auto 10px auto; border-top-color:#0284c7;"></div>
                <div style="font-weight:900; color:#0284c7; font-size:1.05rem;">
                    Đang kết nối máy chủ nộp bài...
                </div>
                <div class="submit-countdown-badge">⏱ Chờ: ${sec}s</div>
                <div style="font-size:0.85rem; color:#64748b; font-weight:600;">
                    Hệ thống đang gửi và đồng bộ điểm số lên máy chủ.
                </div>
            `;
            progressView.style.display = "block";
        }
    };

    renderCountdownUI(remainSec);

    submitCountdownInterval = setInterval(() => {
        remainSec--;
        if (remainSec >= 0) {
            renderCountdownUI(remainSec);
        }
    }, 1000);

    // 3. THỰC HIỆN GỬI SUPABASE VỚI GIỚI HẠN TIMEOUT 8 GIÂY
    let submitOk = false;
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Quá thời gian 8 giây phản hồi từ máy chủ")), 8000)
        );

        const supabaseSubmitPromise = (async () => {
            const { error } = await supabaseClient.from('submissions').upsert(payload);
            if (error) throw error;
            return true;
        })();

        // Cuộc đua giữa việc gửi máy chủ và giới hạn 8 giây
        submitOk = await Promise.race([supabaseSubmitPromise, timeoutPromise]);
    } catch(err) {
        submitOk = false;
        console.warn("Lỗi nộp bài Supabase:", err);
    } finally {
        if (submitCountdownInterval) {
            clearInterval(submitCountdownInterval);
            submitCountdownInterval = null;
        }
    }

    // 4. NẾU NỘP BÀI THẤT BẠI HOẶC QUÁ 8 GIÂY
    if (!submitOk) {
        submitFailCount++; // Tăng số lần nộp lỗi liên tiếp
        isSubmittingInProgress = false;
        updateTopBackupStatus(false);

        // TỰ ĐỘNG TẢI FILE DỰ PHÒNG XUỐNG MÁY HỌC SINH
        if (typeof triggerAutoDownloadJSON === 'function') {
            triggerAutoDownloadJSON(payload);
        }

        const safeSbd = cleanSbd;
        const safeName = (sName || "hocsinh").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
        const fileName = `BaiLam_${safeSbd}_${safeName}${payload.attemptNumber ? `_Lan${payload.attemptNumber}` : ''}.json`;

        if (progressView) {
            progressView.innerHTML = `
                <div style="font-size:38px; margin-bottom:6px;">📶⚠️</div>
                <div style="font-weight:900; color:#ef4444; font-size:1.15rem; text-transform:uppercase;">CHƯA THỂ NỘP LÊN MÁY CHỦ!</div>
                <div style="font-size:0.92rem; color:#334155; margin-top:6px; font-weight:700; line-height:1.45;">
                    Mạng Internet của em bị chập chờn (quá 8 giây chưa kết nối được máy chủ).
                </div>
                
                <div class="file-location-box">
                    <div>✅ <b>ĐÃ TỰ ĐỘNG LƯU FILE BÀI LÀM VÀO MÁY CỦA EM:</b></div>
                    <div style="margin-top:4px;">📄 <b>Tên file:</b> <code>${fileName}</code></div>
                    <div style="margin-top:2px;">📍 <b>Vị trí lưu:</b> Thư mục <b>Tải về (Downloads)</b> trên điện thoại/máy tính của em.</div>
                </div>
            `;
        }

        // LẦN 1: CHỈ CÓ 1 NÚT DUY NHẤT "BẤM ĐỂ NỘP LẠI", KHÔNG HIỆN NÚT TẢI DỰ PHÒNG
        if (submitFailCount === 1) {
            if (actionsBox) {
                actionsBox.innerHTML = `
                    <div style="margin-top: 10px; width: 100%;">
                        <button type="button" onclick="executeSubmitExam(false)" style="width:100%; padding:13px; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; border:none; border-radius:12px; font-weight:900; font-size:1.02rem; cursor:pointer; box-shadow:0 3px 10px rgba(2, 132, 199, 0.35);">
                            🔄 Bấm để nộp lại (chờ tối đa 8s)
                        </button>
                    </div>
                `;
                actionsBox.style.display = "block";
            }
        } 
        // LẦN 2 (HOẶC HƠN) KHÔNG NỘP ĐƯỢC: HIỆN NÚT "NỘP FILE DỰ PHÒNG CHO THẦY GIÁO" VÀ CHUYỂN SANG MESSENGER
        else {
            if (actionsBox) {
                actionsBox.innerHTML = `
                    <div style="margin-top: 12px; display: flex; flex-direction:column; gap: 9px; width:100%;">
                        <button type="button" class="btn-send-messenger-teacher" onclick="openMessengerForTeacherSubmission('${encodeURIComponent(JSON.stringify(payload))}', '${fileName}')">
                            <span style="font-size:18px;">📤</span> <span>Nộp file dự phòng cho Thầy giáo</span>
                        </button>

                        <button type="button" onclick="executeSubmitExam(false)" style="width:100%; padding:10px; background:#f8fafc; color:#0284c7; border:1.5px solid #7dd3fc; border-radius:11px; font-weight:800; font-size:0.9rem; cursor:pointer;">
                            🔄 Thử nộp lại mạng lần nữa
                        </button>
                    </div>
                `;
                actionsBox.style.display = "block";
            }
        }

        return; 
    }

    // 5. NỘP BÀI THÀNH CÔNG
    submitFailCount = 0; // Reset đếm lỗi
    supabaseClient.from('live_drafts').delete().match({ quiz_id: currentQuizId, sbd: cleanSbd }).then();
    if (typeof clearPresence === 'function') clearPresence(sId);
    if (timerInterval) clearInterval(timerInterval); 

    safeLocal.removeItem("pending_exam_submission");
    safeLocal.removeItem(getStorageKey()); 
    safeLocal.removeItem(`shuffled_exam_${getExamCode()}`);
    safeLocal.setItem("last_submission_cleared", "true");
    
    isSubmitted = true; 
    isSubmittingInProgress = false;
    updateTopBackupStatus(true);

    if (confirmModal) confirmModal.style.display = "none"; 
    renderResultSummaryScreen(correctCount, wrongCount, spentMins, completionTimeStr, finalScore, maxScale, currentQuizId); 
}

// HÀM MỞ FILE DỰ PHÒNG VÀ CHUYỂN NGAY SANG MESSENGER CỦA THẦY
function openMessengerForTeacherSubmission(encodedPayload, fileName) {
    let payload = null;
    try {
        payload = JSON.parse(decodeURIComponent(encodedPayload));
    } catch(e) {
        payload = pendingSubmissionPayload || {};
    }

    if (typeof triggerAutoDownloadJSON === 'function' && payload) {
        triggerAutoDownloadJSON(payload);
    }

    alert(`📁 THÔNG BÁO GỬI FILE DỰ PHÒNG CHO THẦY:\n\n` +
          `1. File bài làm của em tên là: "${fileName}"\n` +
          `2. File đang nằm ở: Thư mục "Tải về" (Downloads) trên máy của em.\n\n` +
          `👉 Hệ thống sẽ mở Messenger của Thầy ngay bây giờ. Em chỉ cần đính kèm tệp "${fileName}" trong thư mục Downloads gửi cho Thầy là xong!`);

    const messengerUrl = (typeof TEACHER_MESSENGER_LINK !== 'undefined' && TEACHER_MESSENGER_LINK) 
        ? TEACHER_MESSENGER_LINK 
        : ((typeof TEACHER_ZALO_LINK !== 'undefined' && TEACHER_ZALO_LINK) ? TEACHER_ZALO_LINK : "https://m.me/");

    window.open(messengerUrl, "_blank");
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

    const scoreTitle = (maxScale && maxScale !== 10.0)
        ? `Đúng ${correct}/${totalQuestionsCount} câu (${finalScore} / ${maxScale} điểm)`
        : `Đúng ${correct}/${totalQuestionsCount} câu (${finalScore} điểm)`;

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
window.showSubmitConfirmModal = showSubmitConfirmModal;
window.closeSubmitConfirmModal = closeSubmitConfirmModal;
window.executeSubmitExam = executeSubmitExam;
window.resetToFreshLoginScreen = resetToFreshLoginScreen;
window.checkPassword = checkPassword;
window.startExamAction = startExamAction;
window.startCountdownTimer = startCountdownTimer;
window.formatHHMMSS = formatHHMMSS;
window.__saveExamState = saveExamStateToStorage;
window.__updateProgress = updateProgress;
window.lockExamInteractions = lockExamInteractions;
window.autoSaveAnswerToCloud = autoSaveAnswerToCloud;
window.renderBackupHistoryBanners = renderBackupHistoryBanners;
window.downloadSpecificBackup = downloadSpecificBackup;
window.deleteSpecificBackup = deleteSpecificBackup;
window.handleSendHistoryToTeacher = handleSendHistoryToTeacher;
window.openMessengerForTeacherSubmission = openMessengerForTeacherSubmission;
