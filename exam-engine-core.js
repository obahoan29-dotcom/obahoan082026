// =========================================================
// FILE 3: exam-engine-core.js (FIX TỨC THÌ ĐANG THI & LƯU ĐỆM CLOUD)
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
let _autoSaveDebounceTimer = null;

(function injectLockStyles() {
    const styleId = "exam-engine-lock-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .quiz-content-locked { pointer-events: none !important; user-select: none !important; opacity: 0.88; }
        .quiz-content-locked input, .quiz-content-locked textarea, .quiz-content-locked select, .quiz-content-locked button { cursor: not-allowed !important; }
    `;
    document.head.appendChild(style);
})();

// FIX YÊU CẦU 1 & 5: ĐẢM BẢO PHIÊN ĐANG THI VÀ LƯU ĐỆM REALTIME VÀO SUPABASE
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
    const primaryDocId = `${quizId}_${cleanSbd}`;
    const nowMs = Date.now();

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    try {
        // Ghi chắc chắn trạng thái Đang thi vào active_sessions
        await client.from('active_sessions').upsert({
            id: primaryDocId,
            quiz_id: quizId,
            sbd: cleanSbd,
            name: sName,
            class_name: sClass,
            category_id: currentCat,
            is_free: !(typeof findStudentFromDatabase === 'function' && findStudentFromDatabase(sId, currentCat)),
            ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
            exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
            start_time: examStartTime || nowMs,
            last_ping: nowMs
        }, { onConflict: 'id' });

        // Khởi tạo ngay dòng nháp trong live_drafts nếu chưa có
        await client.from('live_drafts').upsert({
            id: primaryDocId,
            quiz_id: quizId,
            sbd: cleanSbd,
            student_name: sName,
            class_name: sClass,
            category_id: currentCat,
            ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
            exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
            user_answers: window.SECURE_VAULT.userAnswers || {},
            last_updated: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch(err) {
        console.warn("Lỗi đồng bộ phiên đang thi:", err);
    }
}

// FIX YÊU CẦU 5: LƯU TỨC THÌ TỪNG CÂU, TỪNG Ý CHỌN CỦA HỌC SINH VÀO SUPABASE & INDEXEDDB
async function autoSaveAnswerToCloud(qKey, answerVal) {
    if (isSubmitted || isExamLocked) return;

    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd");
    if (!sId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);
    if (!quizId) return;

    const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
    const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "";
    const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "";
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const primaryDocId = `${quizId}_${cleanSbd}`;

    const draftData = {
        id: primaryDocId,
        quiz_id: quizId,
        sbd: cleanSbd,
        student_name: sName,
        class_name: sClass,
        category_id: currentCat,
        ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
        exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
        user_answers: window.SECURE_VAULT.userAnswers || {},
        last_updated: new Date().toISOString()
    };

    // 1. Lưu tức thì vào IndexedDB offline (không phụ thuộc mạng)
    if (typeof examIndexedDB !== 'undefined') {
        examIndexedDB.setItem('live_drafts', {
            key: primaryDocId,
            ...draftData
        }).catch(() => {});
    }

    // 2. Lưu trực tiếp lên Supabase Cloud (Dùng Primary Key 'id' tránh lỗi constraint)
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    try {
        await client.from('live_drafts').upsert(draftData, { onConflict: 'id' });
        // Cập nhật luôn last_ping để bảng admin nhận diện đang hoạt động liên tục
        await client.from('active_sessions').update({ last_ping: Date.now() }).match({ id: primaryDocId });
    } catch(e) {
        console.warn("Lỗi lưu nháp Supabase:", e);
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
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        const { data, error } = await client.from('quizzes').select('*').eq('id', quizId).single();
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

    if (typeof examIndexedDB !== 'undefined') {
        examIndexedDB.removeItem('exam_states', getStorageKey()).catch(() => {});
    }

    const sName = document.getElementById("student-name");
    const sId = document.getElementById("student-id");
    const sClass = document.getElementById("student-class");
    if (sName) sName.value = "";
    if (sId) sId.value = "";
    if (sClass) sClass.value = "";
    window.location.reload(); 
}

async function checkSessionStatus(isAutostart = false) { 
    syncStudentFromParamsAndStorage();
    const hideLoading = () => {
        const gl = document.getElementById('global-loading');
        if (gl) gl.style.display = 'none';
    };

    if (typeof renderStudentSubmissionHistoryButtons === 'function') {
        renderStudentSubmissionHistoryButtons();
    }

    let isRestored = restoreExamStateFromStorage();
    if (!isRestored && typeof examIndexedDB !== 'undefined') {
        try {
            const idbState = await examIndexedDB.getItem('exam_states', getStorageKey());
            if (idbState && idbState.data) {
                safeLocal.setItem(getStorageKey(), JSON.stringify(idbState.data));
                isRestored = restoreExamStateFromStorage();
            }
        } catch(e) {}
    }

    if (isRestored) { 
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
        
        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount();

        const elapsedTimeSec = Math.floor((Date.now() - examStartTime) / 1000); 
        const timeRemaining = totalTimeSeconds - elapsedTimeSec; 

        if (isExamLocked) {
            lockExamInteractions();
            if (typeof executeSubmitExam === 'function') executeSubmitExam(true);
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
            if (typeof executeSubmitExam === 'function') executeSubmitExam(true);
            return;
        }

        remainingSeconds = timeRemaining; 
        startCountdownTimer(); 
        startPresenceSystem(sId);

        // KHI PHỤC HỒI PHIÊN: BẬT NGAY ĐANG THI TRÊN SUPABASE CLOUD
        ensureActiveSessionAndDraft();
        return; 
    }

    if (isAutostart) {
        const sId = document.getElementById("student-id").value.trim();
        const sName = document.getElementById("student-name").value.trim();
        if (sId && sName) {
            document.getElementById("login-box").style.display = "none";
            document.getElementById("student-card").style.display = "none";
            if (typeof startExamAction === 'function') await startExamAction(true);
            hideLoading();
            return;
        }
    }
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
        
        // FIX YÊU CẦU 4: LẤY ĐÚNG SỐ PHÚT TỪ DỮ LIỆU ĐỀ THI
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
    document.getElementById("error-title").innerText = title; 
    document.getElementById("error-msg").innerHTML = msg; 
    errCard.style.display = "block"; 
}

// FIX YÊU CẦU 5: LƯU TRỰC TIẾP NGAY KHI CHỌN PHẦN 1
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

// FIX YÊU CẦU 5: LƯU TRỰC TIẾP TỪNG Ý ĐÚNG / SAI PHẦN 2
function onStatementChange(subKey) { 
    if (isSubmitted || isExamLocked) return; 
    const selected = document.querySelector(`input[name="${subKey}"]:checked`); 
    if (selected) {
        window.SECURE_VAULT.userAnswers[subKey] = selected.value; 
        updateProgress(); 
        saveExamStateToStorage(); 
        autoSaveAnswerToCloud(subKey, selected.value);
    }
}

// FIX YÊU CẦU 5: LƯU TỨC THÌ ĐIỀN ĐÁP ÁN NGẮN PHẦN 3 & 4
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

    if (typeof examIndexedDB !== 'undefined') {
        examIndexedDB.setItem('exam_states', {
            key: getStorageKey(),
            data: dataToSave,
            updatedAt: Date.now()
        }).catch(() => {});
    }
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
                studentName: pend.studentName || pend.student_name,
                studentClass: pend.studentClass || pend.class_name,
                userAnswers: pend.userAnswers || pend.user_answers || {}
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
window.resetToFreshLoginScreen = resetToFreshLoginScreen;
window.startCountdownTimer = startCountdownTimer;
window.formatHHMMSS = formatHHMMSS;
window.__saveExamState = saveExamStateToStorage;
window.__updateProgress = updateProgress;
window.lockExamInteractions = lockExamInteractions;
window.autoSaveAnswerToCloud = autoSaveAnswerToCloud;
window.ensureActiveSessionAndDraft = ensureActiveSessionAndDraft;
window.renderResultSummaryScreen = renderResultSummaryScreen;
