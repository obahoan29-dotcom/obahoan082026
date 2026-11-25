// =========================================================
// FILE: exam-engine-core.js 
// (BẢN FIX TRIỆT ĐỂ + CACHE ĐỀ THI 5 PHÚT CHO HỌC SINH GIẢM BĂNG THÔNG KHI F5)
// =========================================================

window.SECURE_VAULT = window.SECURE_VAULT || {
    answers: {},
    explanations: {},
    userAnswers: {},
    padletClicked: {},
    questionData: {}
};

window.ORIGINAL_EXAM_DATA = null;

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
            const currentAttempt = window.currentStudentAttemptNumber || 1;
            const originStored = safeLocal.getItem(`exam_start_time_origin_${quizId}_${cleanSbd}_lan${currentAttempt}`);
            const parsedOrigin = originStored ? parseInt(originStored, 10) : NaN;
            const trueStartTime = (!isNaN(parsedOrigin) && parsedOrigin > 0) ? parsedOrigin : (examStartTime || nowMs);

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
                .select('sbd');

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
                    start_time: trueStartTime,
                    last_ping: nowMs
                }]);
            }
        }
    } catch(err) {}
}

function translateUserAnswersToOriginal(uiAnswers, shuffledQuestions) {
    if (!window.ORIGINAL_EXAM_DATA || !Array.isArray(shuffledQuestions)) return uiAnswers;
    let origAnswers = {};
    const letters = ["A", "B", "C", "D"];
    
    for (let key in uiAnswers) {
        let val = uiAnswers[key];
        let q = null;
        let stId = null;

        for (let i = 0; i < shuffledQuestions.length; i++) {
            const cand = shuffledQuestions[i];
            if (!cand) continue;
            const prefix = `q${cand.id}`;
            if (key === prefix) {
                q = cand;
                stId = null;
                break;
            } else if (key.startsWith(prefix + "_")) {
                q = cand;
                stId = key.slice(prefix.length + 1);
                break;
            }
        }
        
        if (!q) {
            origAnswers[key] = val;
            continue;
        }

        if (q.type === "multiple_choice" && !stId) {
            if (q.originalLettersMap && val) {
                let uiIdx = letters.indexOf(String(val).toUpperCase());
                if (uiIdx !== -1 && q.originalLettersMap[uiIdx]) {
                    origAnswers[key] = q.originalLettersMap[uiIdx];
                } else {
                    origAnswers[key] = val;
                }
            } else {
                origAnswers[key] = val;
            }
        } 
        else if (q.type === "true_false" && stId) {
            if (q.statements) {
                let st = q.statements.find(x => String(x.id) === String(stId));
                if (st && st.originalId) {
                    origAnswers[`q${q.id}_${st.originalId}`] = val;
                } else {
                    origAnswers[key] = val;
                }
            } else {
                origAnswers[key] = val;
            }
        } 
        else {
            origAnswers[key] = val;
        }
    }
    return origAnswers;
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

    const elapsedSec = examStartTime ? Math.max(1, Math.round((Date.now() - examStartTime) / 1000)) : 0;
    const spentMins = Math.floor(elapsedSec / 60);
    const spentSecs = elapsedSec % 60;
    const completionTimeStr = `${spentMins} phút ${spentSecs} giây`;

    const uiAnswers = window.SECURE_VAULT.userAnswers || {};
    let origAnswers = uiAnswers;
    let scoreResult;

    if (typeof translateUserAnswersToOriginal === 'function' && examData && examData.questions && window.ORIGINAL_EXAM_DATA) {
        origAnswers = translateUserAnswersToOriginal(uiAnswers, examData.questions);
        
        let originalAnswerVault = {};
        const letters = ["A", "B", "C", "D"];
        window.ORIGINAL_EXAM_DATA.questions.forEach(q => {
            if (q.type === "multiple_choice" && q.correct !== undefined) {
                originalAnswerVault[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
            } else if (q.type === "true_false" && q.statements) {
                q.statements.forEach(st => {
                    originalAnswerVault[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                });
            } else if (q.correctAnswer !== undefined) {
                originalAnswerVault[`q${q.id}`] = String(q.correctAnswer).trim();
            }
        });

        scoreResult = calculateExamScoreWithConfig(
            window.ORIGINAL_EXAM_DATA.questions,
            origAnswers,
            originalAnswerVault,
            window.ORIGINAL_EXAM_DATA.scoringConfig || { mode: 'option1' }
        );
    } else {
        scoreResult = calculateTemporaryDraftScore();
    }

    return {
        id: primaryDocId,
        quiz_id: quizId,
        sbd: cleanSbd,
        student_name: sName,
        class_name: strictClassName,
        category_id: currentCat,
        ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
        exam_title: exactExamTitle,
        user_answers: origAnswers,
        score10: scoreResult.finalScore,
        raw_score: scoreResult.totalRawScore,
        max_scale: scoreResult.maxScale,
        correct_count: scoreResult.correctCount,
        wrong_count: scoreResult.wrongCount,
        completion_time: completionTimeStr,
        spent_mins: spentMins,
        tab_switch_count: `${tabSwitchCount} lần`,
        data_string: scoreResult.dataDetails.join(" | "),
        last_updated: new Date().toISOString()
    };
}

async function autoSaveAnswerToCloud(qKey, answerVal) {
    if (isSubmitted || isExamLocked) return;

    const draftData = buildCurrentLiveDraftPayload();
    if (!draftData) return;

    if (typeof examIndexedDB !== 'undefined') {
        try {
            examIndexedDB.setItem('live_drafts', {
                key: draftData.id,
                ...draftData
            }).catch(() => {});
        } catch(e) {}
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

function redirectToPortalNewLogin(quizId = "", cat = "") {
    window.__isRedirectingToNewLogin = true;
    try {
        const targetUrl = new URL("./index.html", window.location.href);
        if (quizId) targetUrl.searchParams.set("login_exam", quizId);
        if (cat) targetUrl.searchParams.set("cat", cat);
        window.location.replace(targetUrl.toString());
    } catch (e) {
        window.location.replace("./index.html");
    }
}

function ensureSomeUIElementsAreVisible() {
    if (window.__isRedirectingToNewLogin) return;

    const gl = document.getElementById('global-loading');
    const quizContent = document.getElementById("quiz-content");
    const waitingCard = document.getElementById("waiting-room-card");
    const resView = document.getElementById("result-view-container");
    const errorCard = document.getElementById("error-card");

    const isQuizShown = quizContent && (quizContent.style.display === "block" || getComputedStyle(quizContent).display === "block");
    const isWaitShown = waitingCard && (waitingCard.style.display === "block" || getComputedStyle(waitingCard).display === "block");
    const isResShown = resView && (resView.style.display === "block" || getComputedStyle(resView).display === "block");
    const isErrShown = errorCard && (errorCard.style.display === "block" || getComputedStyle(errorCard).display === "block");

    if (!isQuizShown && !isWaitShown && !isResShown && !isErrShown) {
        const urlParams = new URLSearchParams(window.location.search);
        const qId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "";
        const cat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
        showError(
            "Chưa có thông tin thí sinh",
            `Vui lòng đăng nhập từ trang chủ để vào đề thi.<br><br><a href="./index.html?login_exam=${encodeURIComponent(qId)}&cat=${encodeURIComponent(cat)}" style="display:inline-block; background:#0284c7; color:#fff; padding:9px 18px; border-radius:8px; font-weight:800; text-decoration:none;">🏠 Về trang chủ đăng nhập</a>`
        );
    }

    if (gl) {
        gl.style.display = 'none';
    }
}

function synchronizeExamQuestionsAndImages(questionsList, imageMap) {
    if (!Array.isArray(questionsList)) return [];
    if (!imageMap || typeof imageMap !== 'object') imageMap = {};

    questionsList.forEach(q => {
        if (!q) return;
        const directUrl = (typeof getEffectiveImageUrl === 'function') ? getEffectiveImageUrl(q, imageMap) : (q.imageUrl || "");
        if (directUrl && String(directUrl).trim() !== "") {
            q.imageUrl = directUrl.trim();
            const effKey = q.imageKey || `img_q_${q.id}`;
            q.imageKey = effKey;
            if (!imageMap[effKey]) {
                imageMap[effKey] = q.imageUrl;
            }
        }
    });

    return questionsList;
}

function parseUniversalDate(str) {
    if (!str) return null;
    let s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) {
        s = s.replace(/\s+/, 'T');
    }
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    if (typeof parseDateString === 'function') {
        let t = parseDateString(s);
        if (t) return new Date(t);
    }
    return null;
}

async function fetchQuizWithSmartCache(client, quizId, isAdminMode, isReview) {
    const cacheKey = `exam_quiz_cache_${quizId}`;
    const QUIZ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
    const META_COLS = 'id, title, made, time_limit_minutes, exam_start_time, exam_end_time, allow_free, result_mode, allow_review_original, show_online_count, allow_export_exam, is_shuffled, scoring_config';

    if (!isAdminMode && !isReview) {
        try {
            const rawCache = safeLocal.getItem(cacheKey);
            if (rawCache) {
                const parsedCache = JSON.parse(rawCache);
                if (parsedCache && parsedCache.data && Array.isArray(parsedCache.data.questions) && parsedCache.data.questions.length > 0) {
                    if ((Date.now() - (Number(parsedCache.cachedAt) || 0)) < QUIZ_CACHE_TTL_MS) {
                        // Chỉ fetch phần metadata cấu hình (~400 bytes) để cập nhật giờ thi / chế độ mới nhất của Thầy
                        const metaPromise = client.from('quizzes').select(META_COLS).eq('id', quizId).single();
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000));
                        const { data: freshMeta, error: metaErr } = await Promise.race([metaPromise, timeoutPromise]);
                        if (!metaErr && freshMeta) {
                            return { ...parsedCache.data, ...freshMeta };
                        }
                        return parsedCache.data;
                    }
                }
            }
        } catch(e) {}
    }

    const fetchPromise = client.from('quizzes').select('*').eq('id', quizId).single();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Mạng kết nối tới máy chủ quá thời gian")), 8000));
    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
    if (error || !data) throw new Error("Mã đề thi không tồn tại trên hệ thống!");

    if (!isAdminMode && Array.isArray(data.questions) && data.questions.length > 0) {
        try {
            safeLocal.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), data: data }));
        } catch(e) {}
    }
    return data;
}

async function initExamEngine() {
    if (hasInitExamEngine) return;
    hasInitExamEngine = true;

    checkAndInjectIOSMessengerBanner();

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    const isAdminPreviewUrl = (urlParams.get('admin') === '1');
    const isAdminMode = isAdminPreviewUrl || (typeof checkIsAdminPreviewMode === 'function' && checkIsAdminPreviewMode());
    const isReviewMode = (urlParams.get('review') === "1");
    const isAutostart = (urlParams.get('autostart') === "1") || isAdminPreviewUrl;

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
        if (!client) throw new Error("Chưa khởi tạo được Supabase Client");

        const data = await fetchQuizWithSmartCache(client, quizId, isAdminMode, isReviewMode);

        const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
        const rawImages = (data.images && typeof data.images === 'object') ? { ...data.images } : {};

        const synchronizedQuestions = synchronizeExamQuestionsAndImages(rawQuestions, rawImages);

        examData = {
            ...data,
            questions: synchronizedQuestions,
            images: rawImages,
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

        window.ORIGINAL_EXAM_DATA = JSON.parse(JSON.stringify(examData));

        if (isReviewMode) {
            if (examData.allowReviewOriginal !== true && !isAdminMode) {
                hideLoading();
                showError("Bị Khóa", "Giáo viên đã tắt tính năng xem đáp án gốc của đề thi này.");
                return;
            }
            isSubmitted = true;
            totalQuestionsCount = examData.questions ? examData.questions.length : 0;
            const topNav = document.getElementById("top-navbar");
            const quizCont = document.getElementById("quiz-content");
            const waitCard = document.getElementById("waiting-room-card");
            if (topNav) topNav.style.display = "none";
            if (quizCont) quizCont.style.display = "none";
            if (waitCard) waitCard.style.display = "none";
            renderOriginalReviewScreen();
            hideLoading();
            return;
        }

        if (isAdminPreviewUrl) {
            safeLocal.setItem(`exam_allow_free_${quizId}`, "true");
        } else if (examData.allowFree !== undefined) {
            safeLocal.setItem(`exam_allow_free_${quizId}`, String(examData.allowFree !== false));
        }

        if (typeof loadRealtimeExamConfig === 'function') {
            try { await loadRealtimeExamConfig(); } catch(e) {}
        }

        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount(false);

        fetchExamQuestions(isAutostart);
        setupBackPrevention();

        if (typeof requestWakeLock === 'function') {
            try { await requestWakeLock(); } catch(e) {}
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
    const isP4 = typeof isPart4Question === 'function' ? isPart4Question : (q => (q.part === 4 || q.isPart4 === true || q.type === "essay" || q.type === "essay_answer"));
    const letters = ["A", "B", "C", "D"];
    const tfLetters = ['a', 'b', 'c', 'd'];
    
    data.questions.forEach(q => {
        if (q.type === "multiple_choice" && !isP4(q) && Array.isArray(q.options) && q.options.length > 0) {
            let originalCorrectIdx = 0;
            if (typeof q.correct === 'number') {
                originalCorrectIdx = q.correct;
            } else if (typeof q.correct === 'string') {
                const u = q.correct.trim().toUpperCase();
                originalCorrectIdx = letters.indexOf(u) !== -1 ? letters.indexOf(u) : 0;
            }
            
            let mappedOptions = q.options.map((opt, idx) => ({
                text: opt,
                originalLetter: letters[idx],
                isCorrect: (idx === originalCorrectIdx)
            }));
            
            mappedOptions = shuffleArray(mappedOptions);
            
            q.options = mappedOptions.map(o => o.text);
            q.originalLettersMap = mappedOptions.map(o => o.originalLetter);
            q.correct = mappedOptions.findIndex(o => o.isCorrect);
            if (q.correct === -1) q.correct = 0;
        } 
        else if (q.type === "true_false" && !isP4(q) && Array.isArray(q.statements) && q.statements.length > 0) {
            let mappedStatements = q.statements.map((st, idx) => ({
                ...st,
                originalId: st.id || tfLetters[idx]
            }));
            
            mappedStatements = shuffleArray(mappedStatements);
            
            q.statements = mappedStatements.map((st, idx) => ({
                ...st,
                id: tfLetters[idx],
                originalId: st.originalId
            }));
        }
    });

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
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "";
    const cat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const isAdminPreviewUrl = (urlParams.get('admin') === '1');

    safeLocal.removeItem(getStorageKey()); 
    if (typeof getStorageKey === 'function') {
        safeLocal.removeItem(getStorageKey(1));
        safeLocal.removeItem(getStorageKey(2));
        safeLocal.removeItem(getStorageKey(3));
    }
    
    safeLocal.removeItem(`shuffled_exam_${quizId}_${getExamCode()}`);
    safeLocal.removeItem(`shuffled_exam_${getExamCode()}`);
    safeLocal.removeItem("pending_exam_submission");
    safeLocal.removeItem("last_submission_cleared");

    if (quizId && sId) {
        const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
        safeLocal.removeItem(`exam_start_time_origin_${quizId}_${cleanSbd}_lan1`);
        safeLocal.removeItem(`exam_start_time_origin_${quizId}_${cleanSbd}_lan2`);
        safeLocal.removeItem(`exam_start_time_origin_${quizId}_${cleanSbd}_lan3`);
    }

    if (typeof examIndexedDB !== 'undefined') {
        try {
            examIndexedDB.removeItem('exam_states', getStorageKey()).catch(() => {});
        } catch(e) {}
    }

    if (quizId && sId) {
        const nextAttempt = getRealStudentExamAttemptNumber(quizId, sId);
        window.currentStudentAttemptNumber = nextAttempt;
    }

    if (isAdminPreviewUrl) {
        window.location.href = `./thi.html?id=${encodeURIComponent(quizId)}&cat=${encodeURIComponent(cat)}&sbd=Trying&name=Obahoan29&class=42&autostart=1&admin=1`;
        return;
    }

    redirectToPortalNewLogin(quizId, cat);
}

async function checkSessionStatus(isAutostart = false) { 
    syncStudentFromParamsAndStorage();
    const hideLoading = () => {
        const gl = document.getElementById('global-loading');
        if (gl) gl.style.display = 'none';
    };

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "";
    const cat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const isAdminPreviewUrl = (urlParams.get('admin') === '1');

    let sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
    if (isAdminPreviewUrl && !sId) {
        if (typeof applyStudentToUI === 'function') {
            applyStudentToUI({ sbd: "Trying", name: "Obahoan29", className: "42" });
        }
        sId = "Trying";
    }

    if (typeof renderStudentSubmissionHistoryButtons === 'function') {
        renderStudentSubmissionHistoryButtons();
    }

    let attempt = 1;
    if (quizId && sId && !isAdminPreviewUrl) {
        try {
            attempt = await fetchStudentAttemptNumberFromCloud(quizId, sId);
        } catch(e) {
            attempt = 1;
        }
        window.currentStudentAttemptNumber = attempt;
        if (typeof checkAndDisplayAttemptNoticeOnStudentCard === 'function') {
            checkAndDisplayAttemptNoticeOnStudentCard(sId);
        }
    } else if (isAdminPreviewUrl) {
        window.currentStudentAttemptNumber = 1;
    }

    const isCleared = (safeLocal.getItem("last_submission_cleared") === "true");
    if (isCleared && !isAutostart && !isAdminPreviewUrl) {
        hideLoading();
        redirectToPortalNewLogin(quizId, cat);
        return;
    }

    if (isAdminPreviewUrl && isAutostart) {
        try {
            const cleanSbd = String(sId || "Trying").replace(/[^a-zA-Z0-9]/g, '_');
            safeLocal.removeItem(getStorageKey(1));
            safeLocal.removeItem(`exam_start_time_origin_${quizId}_${cleanSbd}_lan1`);
        } catch(e) {}
    }

    let isRestored = (isAdminPreviewUrl && isAutostart) ? false : restoreExamStateFromStorage();
    if (!isRestored && !(isAdminPreviewUrl && isAutostart) && typeof examIndexedDB !== 'undefined' && sId) {
        try {
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
        const elapsedTimeSec = Math.max(0, Math.floor((Date.now() - examStartTime) / 1000)); 
        const timeRemaining = totalTimeSeconds - elapsedTimeSec; 

        if (timeRemaining <= 0 && totalTimeSeconds > 0 && !isAdminPreviewUrl) {
            safeLocal.removeItem(getStorageKey(attempt));
            if (typeof getStorageKey === 'function') {
                safeLocal.removeItem(getStorageKey());
            }
            if (typeof examIndexedDB !== 'undefined') {
                try {
                    examIndexedDB.removeItem('exam_states', getStorageKey(attempt)).catch(() => {});
                } catch(e) {}
            }
            isRestored = false;
            isExamLocked = false;
            lockedDurationSec = 0;
            examStartTime = null;
            window.SECURE_VAULT.userAnswers = {};
            window.SECURE_VAULT.padletClicked = {};
        }
    }

    if (isRestored) { 
        const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "Thí sinh"; 
        const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "---"; 
        const navName = document.getElementById("nav-student-name");
        const navId = document.getElementById("nav-student-id");
        const navClass = document.getElementById("nav-student-class");
        const navCode = document.getElementById("nav-exam-code-text");
        if (navName) navName.innerText = sName; 
        if (navId) navId.innerText = (attempt > 1) ? `${sId} (Lần ${attempt})` : sId; 
        if (navClass) navClass.innerText = sClass; 
        if (navCode) navCode.innerText = `Đề: ${getMaDe()}`; 
        
        const waitCard = document.getElementById("waiting-room-card"); 
        if (waitCard) waitCard.style.display = "none"; 
        const topNav = document.getElementById("top-navbar");
        if (topNav) topNav.style.display = "block"; 
        const quizCont = document.getElementById("quiz-content");
        if (quizCont) quizCont.style.display = "block"; 
        
        hideLoading();
        reapplySavedAnswers(); 
        updateProgress(); 
        
        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        if (typeof refreshOnlineCount === 'function') refreshOnlineCount(false);
        if (typeof checkAndDisplayAdminSoiDeButton === 'function') checkAndDisplayAdminSoiDeButton();

        const elapsedTimeSec = Math.max(0, Math.floor((Date.now() - examStartTime) / 1000)); 
        const timeRemaining = totalTimeSeconds - elapsedTimeSec; 

        if (isAdminPreviewUrl || (timeRemaining > 0 && !isExamLocked)) {
            if (isAdminPreviewUrl && timeRemaining <= 0) {
                examStartTime = Date.now();
                remainingSeconds = totalTimeSeconds;
            } else {
                remainingSeconds = Math.max(0, timeRemaining);
            }
            startCountdownTimer(); 
            if (!isAdminPreviewUrl) startPresenceSystem(sId);
            if (!isAdminPreviewUrl) ensureActiveSessionAndDraft();
            return; 
        }
    }

    const sIdVal = (document.getElementById("student-id")?.value.trim() || urlParams.get('sbd') || safeLocal.getItem("saved_student_sbd") || (isAdminPreviewUrl ? "Trying" : "")).trim();
    const sNameVal = (document.getElementById("student-name")?.value.trim() || urlParams.get('name') || safeLocal.getItem("saved_student_name") || (isAdminPreviewUrl ? "Obahoan29" : "")).trim();
    const fallbackCatName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(cat) : (cat || "Tự do");
    const sClassVal = (document.getElementById("student-class")?.value.trim() || urlParams.get('class') || safeLocal.getItem("saved_student_class") || (isAdminPreviewUrl ? "42" : fallbackCatName)).trim();

    if (document.getElementById("student-id")) document.getElementById("student-id").value = sIdVal;
    if (document.getElementById("student-name")) document.getElementById("student-name").value = sNameVal;
    if (document.getElementById("student-class")) document.getElementById("student-class").value = sClassVal;

    if (isAutostart || isAdminPreviewUrl || (sIdVal && sNameVal && !isCleared)) {
        if (sIdVal && sNameVal) {
            if (typeof startExamAction === 'function') {
                try {
                    const success = await startExamAction(true);
                    if (success) {
                        if (typeof checkAndDisplayAdminSoiDeButton === 'function') checkAndDisplayAdminSoiDeButton();
                        hideLoading();
                        return;
                    }
                    if (isAdminPreviewUrl) {
                        hideLoading();
                        showError("Không thể khởi tạo chế độ xem thử Admin", "Vui lòng bấm tải lại trang hoặc kiểm tra lại mã đề.");
                        return;
                    }
                } catch(e) {
                    console.error("Lỗi khởi động bài thi:", e);
                    hideLoading();
                    showError("Lỗi khởi động phòng thi", `Không thể vào bài thi (${e.message || e}). Vui lòng thử tải lại trang.`);
                    return;
                }
            } else {
                hideLoading();
                showError("Lỗi nạp module phòng thi", "File <b>student-exam-flow.js</b> chưa được nạp thành công (có thể do cache cũ hoặc lỗi mạng). Vui lòng tải lại trang!");
                return;
            }
        }
    }

    hideLoading();
    if (!isAdminPreviewUrl) {
        redirectToPortalNewLogin(quizId, cat);
    } else {
        showError("Lỗi mở chế độ Admin", "Không xác định được phiên xem thử đề thi. Vui lòng thử lại!");
    }
}

function fetchExamQuestions(isAutostart = false) { 
    try { 
        if (typeof examData === 'undefined' || !examData) { 
            showError("Lỗi", "Không tìm thấy dữ liệu đề thi!"); 
            return; 
        } 
        if (examData.title) { 
            EXAM_NAME = examData.title; 
            const bannerTitleEl = document.getElementById("banner-title");
            if (bannerTitleEl) bannerTitleEl.innerText = EXAM_NAME; 
            const examTitleEl = document.getElementById("res-exam-title");
            if (examTitleEl) examTitleEl.innerText = EXAM_NAME;
        } 
        const navCodeText = document.getElementById("nav-exam-code-text");
        if (navCodeText) navCodeText.innerText = `Đề: ${getMaDe()}`; 
        if (examData.password !== undefined) EXAM_PASSWORD = String(examData.password).trim(); 
        
        const parsedMins = parseInt(examData.timeLimitMinutes || examData.time_limit_minutes, 10);
        if (!isNaN(parsedMins) && parsedMins > 0) {
            TIME_LIMIT_MINUTES = parsedMins;
        } else {
            TIME_LIMIT_MINUTES = 90;
        }
        totalTimeSeconds = TIME_LIMIT_MINUTES * 60; 
        remainingSeconds = totalTimeSeconds; 

        if (examData.examStartTimeStr && examData.examEndTimeStr) { 
            const stObj = parseUniversalDate(examData.examStartTimeStr);
            const etObj = parseUniversalDate(examData.examEndTimeStr);
            const st = stObj ? stObj.toLocaleString("vi-VN") : examData.examStartTimeStr;
            const et = etObj ? etObj.toLocaleString("vi-VN") : examData.examEndTimeStr;
            const noticeEl = document.getElementById("exam-time-notice"); 
            if (noticeEl) {
                noticeEl.innerText = `⏱ Mở từ: ${st} - Đến: ${et}`; 
                noticeEl.style.display = "inline-block"; 
            }
        } 

        const urlParams = new URLSearchParams(window.location.search);
        const currentQuizId = urlParams.get('id') || examData.id || "quiz";
        
        const shuffleKey = `shuffled_exam_${currentQuizId}_${getExamCode()}`;
        const isAdminPreviewUrl = (urlParams.get('admin') === '1');
        let shouldShuffle = (examData.isShuffled !== false) && !isAdminPreviewUrl; 

        examData.questions = synchronizeExamQuestionsAndImages(examData.questions || [], examData.images || {});

        if (shouldShuffle) {
            const cachedShuffle = safeLocal.getItem(shuffleKey);
            if (cachedShuffle) {
                try {
                    let parsedQ = JSON.parse(cachedShuffle);
                    if (Array.isArray(parsedQ) && parsedQ.length === examData.questions.length) {
                        let needsReorganize = false;
                        parsedQ.forEach(qCached => {
                            const originalQ = examData.questions.find(orig => String(orig.id) === String(qCached.id));
                            if (originalQ) {
                                qCached.imageUrl = originalQ.imageUrl || getEffectiveImageUrl(originalQ, examData.images);
                                qCached.imageKey = originalQ.imageKey;
                                qCached.question = originalQ.question;
                                qCached.explanation = originalQ.explanation;
                                if (qCached.type !== originalQ.type || qCached.part !== originalQ.part || qCached.isPart4 !== originalQ.isPart4) {
                                    qCached.type = originalQ.type;
                                    qCached.part = originalQ.part;
                                    qCached.isPart4 = originalQ.isPart4;
                                    if (originalQ.options) qCached.options = [...originalQ.options];
                                    if (originalQ.statements) qCached.statements = JSON.parse(JSON.stringify(originalQ.statements));
                                    if (originalQ.correct !== undefined) qCached.correct = originalQ.correct;
                                    if (originalQ.correctAnswer !== undefined) qCached.correctAnswer = originalQ.correctAnswer;
                                    delete qCached.originalLettersMap;
                                    needsReorganize = true;
                                } else {
                                    if (originalQ.correctAnswer !== undefined) qCached.correctAnswer = originalQ.correctAnswer;
                                }
                            }
                        });
                        if (needsReorganize) {
                            const isP4 = typeof isPart4Question === 'function' ? isPart4Question : (q => (q.part === 4 || q.isPart4 === true || q.type === "essay" || q.type === "essay_answer"));
                            const p1 = parsedQ.filter(q => q.type === "multiple_choice" && !isP4(q));
                            const p2 = parsedQ.filter(q => q.type === "true_false" && !isP4(q));
                            const p3 = parsedQ.filter(q => q.type === "short_answer" && !isP4(q));
                            const p4 = parsedQ.filter(q => isP4(q));
                            parsedQ = [...p1, ...p2, ...p3, ...p4];
                        }
                        examData.questions = parsedQ;
                        safeLocal.setItem(shuffleKey, JSON.stringify(examData.questions));
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
        
        if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
        
        renderQuizLayout(examData.questions || [], examData.images || {}); 
        if (window.MathJax && MathJax.typesetPromise) {
            try {
                MathJax.typesetPromise().catch(() => {});
            } catch(mjxErr) {}
        }
    } catch (err) { 
        showError("Lỗi", err.message); 
    } 
}

function showError(title, msg) { 
    const errCard = document.getElementById("error-card"); 
    if (errCard) {
        const titleEl = document.getElementById("error-title");
        const msgEl = document.getElementById("error-msg");
        if (titleEl) titleEl.innerText = title; 
        if (msgEl) msgEl.innerHTML = msg + `<br><br><button type="button" onclick="window.location.reload()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:800; cursor:pointer;">🔄 Tải lại trang</button>`; 
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
    const inputEl = document.getElementById(`q${qId}-input`);
    if (!inputEl) return;
    const val = inputEl.value.trim(); 
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
        const shortInput = document.getElementById(`${key}-input`);
        if (shortInput) { 
            shortInput.value = val; 
            return;
        }
        const matchedInput = document.querySelector(`input[name="${key}"][value="${val}"]`);
        if (matchedInput) {
            matchedInput.checked = true;
            if (key.startsWith('q')) {
                const qId = key.slice(1);
                const optBox = document.getElementById(`opt-box-${qId}-${val}`);
                if (optBox) {
                    ["A", "B", "C", "D"].forEach(l => {
                        const el = document.getElementById(`opt-box-${qId}-${l}`);
                        if (el) el.classList.remove('selected');
                    });
                    optBox.classList.add('selected');
                }
            }
        }
    }); 
}

function formatHHMMSS(totalSecs) { 
    const safe = Math.max(0, Math.floor(Number(totalSecs) || 0));
    const h = Math.floor(safe / 3600); 
    const m = Math.floor((safe % 3600) / 60); 
    const s = safe % 60; 
    return `${h < 10 ? '0'+h : h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`; 
}

function startCountdownTimer() { 
    if (isExamLocked) return;
    const timerVal = document.getElementById("nav-timer-val"); 
    const timerBox = document.getElementById("nav-timer-box"); 
    if (timerInterval) {
        clearInterval(timerInterval); 
        timerInterval = null;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isAdminPreview = (urlParams.get('admin') === '1');

    if (!examStartTime || isNaN(Number(examStartTime))) {
        examStartTime = Date.now();
    }
    if (!totalTimeSeconds || isNaN(Number(totalTimeSeconds)) || totalTimeSeconds <= 0) {
        totalTimeSeconds = (TIME_LIMIT_MINUTES || 90) * 60;
    }

    const tickCountdown = () => {
        if (isExamLocked || isSubmitted) {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            return;
        }

        const now = Date.now(); 
        let currentEndTimeMs = Infinity; 
        const endStr = (typeof examData !== 'undefined' && examData) ? (examData.examEndTimeStr || examData.exam_end_time) : null;
        if (!isAdminPreview && endStr) { 
            let dEnd = parseUniversalDate(endStr);
            if (dEnd && !isNaN(dEnd.getTime())) currentEndTimeMs = dEnd.getTime();
        } 

        const elapsedTimeSec = Math.max(0, Math.floor((now - examStartTime) / 1000)); 
        remainingSeconds = Math.max(0, totalTimeSeconds - elapsedTimeSec); 

        if (!isAdminPreview && elapsedTimeSec < 15 && now >= currentEndTimeMs) {
            clearInterval(timerInterval);
            timerInterval = null;
            alert("⚠️ KHUNG GIỜ LÀM BÀI THI NÀY ĐÃ KẾT THÚC!\nHệ thống không nhận bài làm mới. Vui lòng quay lại trang chủ.");
            window.location.href = "./index.html";
            return;
        }

        if (!isAdminPreview && (now >= currentEndTimeMs || remainingSeconds <= 0)) { 
            clearInterval(timerInterval); 
            timerInterval = null;
            remainingSeconds = 0;
            if (timerVal) timerVal.innerText = "00:00:00"; 
            lockExamInteractions();
            if (typeof executeSubmitExam === 'function') executeSubmitExam(true); 
            return; 
        }

        if (isAdminPreview && remainingSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            remainingSeconds = 0;
            if (timerVal) timerVal.innerText = "00:00:00";
            if (timerBox) timerBox.classList.add("timer-warning");
            if (typeof showTimeChangeToast === 'function') {
                showTimeChangeToast("⏱ Đã hết thời gian làm bài (Chế độ Admin xem thử - không tự động nộp).");
            }
            return;
        }

        if (timerVal) timerVal.innerText = formatHHMMSS(remainingSeconds); 
        if (remainingSeconds <= 120 && timerBox) timerBox.classList.add("timer-warning"); 
        else if (timerBox) timerBox.classList.remove("timer-warning");
    };

    tickCountdown();
    if (!isExamLocked && !isSubmitted) {
        timerInterval = setInterval(tickCountdown, 1000); 
    }
}

function saveExamStateToStorage() { 
    if (!examStartTime || isSubmitted) return; 
    const currentAttempt = window.currentStudentAttemptNumber || 1;
    const sbd = document.getElementById("student-id")?.value?.trim() || safeLocal.getItem("saved_student_sbd") || "";
    const cleanSbd = sbd.replace(/[^a-zA-Z0-9]/g, '_');
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "quiz";

    const originKey = `exam_start_time_origin_${quizId}_${cleanSbd}_lan${currentAttempt}`;
    if (!safeLocal.getItem(originKey)) {
        safeLocal.setItem(originKey, String(examStartTime));
    }

    const dataToSave = { 
        userAnswers: window.SECURE_VAULT.userAnswers, 
        padletClickedMap: window.SECURE_VAULT.padletClicked, 
        examStartTime: examStartTime, 
        tabSwitchCount: tabSwitchCount, 
        timeLimitMinutes: TIME_LIMIT_MINUTES, 
        studentId: sbd, 
        studentName: document.getElementById("student-name")?.value?.trim() || safeLocal.getItem("saved_student_name") || "", 
        studentClass: document.getElementById("student-class")?.value?.trim() || safeLocal.getItem("saved_student_class") || "", 
        isStarted: true,
        attemptNumber: currentAttempt,
        isExamLocked: isExamLocked,
        lockedDurationSec: lockedDurationSec
    }; 
    safeLocal.setItem(getStorageKey(currentAttempt), JSON.stringify(dataToSave)); 

    if (typeof examIndexedDB !== 'undefined') {
        try {
            examIndexedDB.setItem('exam_states', {
                key: getStorageKey(currentAttempt),
                data: dataToSave,
                updatedAt: Date.now()
            }).catch(() => {});
        } catch(e) {}
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
            const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "quiz";
            const cleanSbd = String(parsed.studentId || "").replace(/[^a-zA-Z0-9]/g, '_');
            const originKey = `exam_start_time_origin_${quizId}_${cleanSbd}_lan${currentAttempt}`;
            const originStored = safeLocal.getItem(originKey);

            const parsedOrigin = originStored ? parseInt(originStored, 10) : NaN;
            const parsedSaved = parsed.examStartTime ? parseInt(parsed.examStartTime, 10) : NaN;
            const savedStartTime = (!isNaN(parsedOrigin) && parsedOrigin > 0) ? parsedOrigin : ((!isNaN(parsedSaved) && parsedSaved > 0) ? parsedSaved : Date.now());
            const elapsed = Math.max(0, Math.floor((Date.now() - savedStartTime) / 1000));
            const limitSec = (parseInt(parsed.timeLimitMinutes, 10) || TIME_LIMIT_MINUTES || 90) * 60;
            const isAdminPreviewUrl = (urlParams.get('admin') === '1');

            if (!isAdminPreviewUrl && (elapsed >= limitSec || parsed.isExamLocked)) {
                safeLocal.removeItem(storageKey);
                if (typeof examIndexedDB !== 'undefined') {
                    try {
                        examIndexedDB.removeItem('exam_states', storageKey).catch(() => {});
                    } catch(e) {}
                }
                return false;
            }

            window.SECURE_VAULT.userAnswers = parsed.userAnswers || {}; 
            window.SECURE_VAULT.padletClicked = parsed.padletClickedMap || {}; 
            tabSwitchCount = parsed.tabSwitchCount || 0; 
            examStartTime = savedStartTime; 
            
            if (parsed.timeLimitMinutes && !isNaN(parseInt(parsed.timeLimitMinutes, 10)) && parseInt(parsed.timeLimitMinutes, 10) > 0) {
                TIME_LIMIT_MINUTES = parseInt(parsed.timeLimitMinutes, 10);
                totalTimeSeconds = TIME_LIMIT_MINUTES * 60;
            }
            if (parsed.studentId && document.getElementById("student-id")) document.getElementById("student-id").value = parsed.studentId; 
            if (parsed.studentName && document.getElementById("student-name")) document.getElementById("student-name").value = parsed.studentName; 
            if (parsed.studentClass && document.getElementById("student-class")) document.getElementById("student-class").value = parsed.studentClass; 
            
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
    document.getElementById("res-user-name").innerText = document.getElementById("student-name")?.value?.trim() || "Thí sinh"; 
    document.getElementById("res-user-class").innerText = document.getElementById("student-class")?.value?.trim() || "---"; 
    document.getElementById("res-user-id").innerText = document.getElementById("student-id")?.value?.trim() || "---"; 
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
        const letters = ["A", "B", "C", "D"];

        (examData.questions || []).forEach(q => { 
            const imgUrl = (typeof getEffectiveImageUrl === 'function') ? getEffectiveImageUrl(q, examData.images || {}) : (q.imageUrl || ""); 
            const imgTag = (typeof buildImgHtml === 'function') ? buildImgHtml(imgUrl, `rev_${q.id}`) : ""; 
            const explainText = (window.SECURE_VAULT.explanations[`q${q.id}`] || q.explanation) ? `<div class="explanation-box">💡 <b>Lời giải chi tiết:</b> ${window.SECURE_VAULT.explanations[`q${q.id}`] || q.explanation}</div>` : ""; 
            
            if (q.type === "multiple_choice" && !isPart4Question(q)) { 
                const uAns = window.SECURE_VAULT.userAnswers[`q${q.id}`]; 
                let cAns = window.SECURE_VAULT.answers[`q${q.id}`]; 
                if (!cAns && q.correct !== undefined) {
                    cAns = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
                }

                revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge" style="background:${uAns===cAns?'#22c55e':'#ef4444'}">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="options-list grid-2">${(q.options || []).map((opt, oIdx) => { const L = letters[oIdx]; let cls = ""; let icon = ""; if (L === cAns) { cls = "is-correct"; icon = " ✓"; } else if (L === uAns && uAns !== cAns) { cls = "is-wrong"; icon = " ✗"; } return `<div class="opt-label ${cls}"><span class="opt-circle">${L}</span><span class="opt-text">${opt} <b>${icon}</b></span></div>`; }).join('')}</div>${explainText}</div>`; 
            } else if (q.type === "true_false" && !isPart4Question(q)) { 
                let rows = ""; 
                (q.statements || []).forEach(st => { 
                    const sub = `q${q.id}_${st.id}`; 
                    const uVal = window.SECURE_VAULT.userAnswers[sub] || "Chưa chọn"; 
                    let cVal = window.SECURE_VAULT.answers[sub]; 
                    if (!cVal && st.correct !== undefined) {
                        cVal = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                    }
                    if (!cVal) cVal = "Đúng";

                    const ok = (uVal === cVal); 
                    rows += `<tr><td><b>${st.id})</b> ${st.statement}</td><td align="center">${uVal==="Đúng"?(ok?"🟢 Đúng":"🔴 Đúng (Sai)"):""}</td><td align="center">${uVal==="Sai"?(ok?"🟢 Sai":"🔴 Sai (Sai)"):""}</td><td align="center"><b>${cVal}</b></td></tr>`; 
                }); 
                revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="tf-table-box"><table class="tf-table"><thead><tr><th>Mệnh đề</th><th>Bạn chọn</th><th>Đ.Á Đúng</th></tr></thead><tbody>${rows}</tbody></table></div>${explainText}</div>`; 
            } else { 
                const uVal = window.SECURE_VAULT.userAnswers[`q${q.id}`] || "(Để trống)"; 
                let cVal = window.SECURE_VAULT.answers[`q${q.id}`]; 
                if (cVal === undefined || cVal === null) {
                    cVal = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : (q.answer !== undefined ? q.answer : "---"));
                }
                revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div style="margin-top:14px; font-size:1.05rem; font-weight:600;"><div style="color:#15803d; font-weight:800; margin-top:6px;">Đáp án đúng / tham khảo: ${cVal}</div><div>Tr.lời của bạn: <b>${uVal}</b></div></div>${explainText}</div>`; 
            } 
            idx++; 
        }); 
        reviewBodyEl.innerHTML = revHTML; 
        if (window.MathJax && MathJax.typesetPromise) {
            try {
                MathJax.typesetPromise().catch(() => {});
            } catch(e) {}
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
        if (q.type === "multiple_choice" && !isPart4Question(q)) {
            generatedAnswerKey[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
        } else if (q.type === "true_false" && !isPart4Question(q)) {
            (q.statements || []).forEach(st => {
                generatedAnswerKey[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng' || String(st.correct).toLowerCase() === 'true') ? "Đúng" : "Sai";
            });
        } else {
            generatedAnswerKey[`q${q.id}`] = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : "0")).trim();
        }
    });

    let revHTML = ""; 
    let idx = 1; 

    (examData.questions || []).forEach(q => { 
        const imgUrl = (typeof getEffectiveImageUrl === 'function') ? getEffectiveImageUrl(q, examData.images || {}) : (q.imageUrl || ""); 
        const imgTag = (typeof buildImgHtml === 'function') ? buildImgHtml(imgUrl, `orig_${q.id}`) : ""; 
        const explainText = q.explanation ? `<div class="explanation-box">💡 <b>Lời giải chi tiết:</b> ${q.explanation}</div>` : ""; 
        
        if (q.type === "multiple_choice" && !isPart4Question(q)) { 
            const cAns = generatedAnswerKey[`q${q.id}`]; 
            revHTML += `<div class="question-card"><div class="q-header"><div class="q-num-badge">${idx}</div><div class="q-content-text">${formatQuestionText(q.question)}</div></div>${imgTag} <div class="options-list grid-2">${(q.options || []).map((opt, oIdx) => { const L = letters[oIdx]; let cls = ""; let icon = ""; if (L === cAns) { cls = "is-correct"; icon = " ✓ Đ.Án"; } return `<div class="opt-label ${cls}"><span class="opt-circle">${L}</span><span class="opt-text">${opt} <b>${icon}</b></span></div>`; }).join('')}</div>${explainText}</div>`; 
        } else if (q.type === "true_false" && !isPart4Question(q)) { 
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
        try {
            MathJax.typesetPromise().catch(() => {});
        } catch(e) {}
    }
}

window.synchronizeExamQuestionsAndImages = synchronizeExamQuestionsAndImages;
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
