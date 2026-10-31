// =========================================================
// FILE 4: student-exam-flow.js 
// (BẢN CHUẨN HÓA LƯU RIÊNG TỪNG LẦN THI TRÊN SUPABASE & BẢO LƯU 100%)
// =========================================================

let submissionCountdownTimer = null;
let currentSubmitAttempt = 1;

// HÀM ÁNH XẠ CHÍNH XÁC VỀ ĐÚNG 1 TRONG CÁC TÊN LỚP CHUẨN
function getStrictStandardClassName(rawClass, rawSbd) {
    const s = String(rawClass || "").toLowerCase().trim();
    const sbd = String(rawSbd || "").toLowerCase().trim();

    if (s.includes("11a") || sbd.includes("11a")) return "Lớp 11A";
    if (s.includes("11c") || sbd.includes("11c")) return "Lớp 11C";
    if (s.includes("11e") || sbd.includes("11e")) return "Lớp 11E";
    if (s.includes("10p") || sbd.includes("10p")) return "Lớp 10P";

    if (s.includes("them-10") || s.includes("thêm 10") || s.includes("them 10") || /^10\d{2}$/.test(sbd)) return "Thêm 10";
    if (s.includes("them-11") || s.includes("thêm 11") || s.includes("them 11") || /^11\d{2}$/.test(sbd)) return "Thêm 11";
    if (s.includes("them-12") || s.includes("thêm 12") || s.includes("them 12") || /^12\d{2}$/.test(sbd)) return "Thêm 12";

    return "Thêm 11";
}

// XÁC ĐỊNH CHÍNH XÁC HỌC SINH ĐANG THI LẦN MẤY
function getRealStudentExamAttemptNumber(quizId, sbd) {
    try {
        const cleanSbd = String(sbd || "").replace(/[^a-zA-Z0-9]/g, '_');
        const storageKey = `exam_history_${quizId}_${cleanSbd}`;
        const raw = safeLocal.getItem(storageKey);
        if (raw) {
            const history = JSON.parse(raw);
            if (Array.isArray(history)) return history.length + 1;
        }
    } catch(e) {}
    return 1;
}

function openStudentLoginModal(item, categoryId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const targetCatId = categoryId || item.categoryId || "them-11";
    activeStudentLogin.targetUrl = item.url || "";
    activeStudentLogin.examTitle = item.title || "Bài kiểm tra";
    activeStudentLogin.categoryId = targetCatId;
    activeStudentLogin.currentMode = "class";
    activeStudentLogin.item = item;

    const modal = document.getElementById("student-login-modal");
    const nameEl = document.getElementById("st-modal-exam-name");
    const timeBox = document.getElementById("st-modal-time-box");
    const errBox = document.getElementById("st-login-error");
    const mainTitleEl = document.getElementById("st-modal-main-title");

    const catName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(targetCatId) : targetCatId;
    if (mainTitleEl) mainTitleEl.innerText = `Đăng Nhập Làm Bài Thi: ${catName}`;
    if (nameEl) nameEl.innerText = item.title;
    if (errBox) { errBox.style.display = "none"; errBox.innerText = ""; }

    if (timeBox && typeof buildTimeBoxHtml === 'function') { 
        timeBox.innerHTML = buildTimeBoxHtml(item.timeLimitMinutes, item.examStartTimeStr, item.examEndTimeStr, item.date || (typeof getItemDisplayDate === 'function' ? getItemDisplayDate(item) : "")); 
    }

    const userIn = document.getElementById("st-username-input");
    const passIn = document.getElementById("st-password-input");
    const fNameIn = document.getElementById("st-free-name-input");
    const fClassIn = document.getElementById("st-free-class-input");
    const fSbdIn = document.getElementById("st-free-sbd-input");

    const placeholderHint = typeof getSbdPlaceholderForCategory === 'function' ? getSbdPlaceholderForCategory(targetCatId) : "Nhập SBD...";
    if (userIn) {
        userIn.value = "";
        userIn.placeholder = placeholderHint;
    }
    if (passIn) { passIn.value = ""; passIn.type = "password"; }
    if (fNameIn) fNameIn.value = "";
    if (fClassIn) fClassIn.value = "";
    if (fSbdIn) {
        fSbdIn.value = "";
        fSbdIn.placeholder = placeholderHint;
    }

    const eyeBtn = document.getElementById("st-eye-btn");
    if (eyeBtn) eyeBtn.innerText = "👁️";

    safeLocal.removeItem("saved_student_sbd");
    safeLocal.removeItem("saved_student_name");
    safeLocal.removeItem("saved_student_class");
    safeLocal.removeItem("current_exam_student");

    const allowFree = (item.allowFree !== false);
    const tabFree = document.getElementById("tab-st-free");
    if (tabFree) {
        if (!allowFree) {
            tabFree.disabled = true; 
            tabFree.classList.add("disabled"); 
            tabFree.title = "Đề thi này chỉ dành riêng cho học sinh trong danh sách lớp";
        } else {
            tabFree.disabled = false; 
            tabFree.classList.remove("disabled"); 
            tabFree.title = "";
        }
    }

    switchStudentLoginMode("class");
    if (modal) modal.style.display = "flex";
}

function closeStudentLoginModal() {
    const modal = document.getElementById("student-login-modal");
    if (modal) modal.style.display = "none";
    const errBox = document.getElementById("st-login-error");
    if (errBox) { errBox.style.display = "none"; errBox.innerText = ""; }
}

function switchStudentLoginMode(mode) {
    activeStudentLogin.currentMode = mode;
    const tabClass = document.getElementById("tab-st-class");
    const tabFree = document.getElementById("tab-st-free");
    const viewClass = document.getElementById("st-login-mode-class");
    const viewFree = document.getElementById("st-login-mode-free");
    const errBox = document.getElementById("st-login-error");

    if (errBox) { errBox.style.display = "none"; errBox.innerText = ""; }

    if (mode === "free") {
        if (activeStudentLogin.item && activeStudentLogin.item.allowFree === false) { 
            alert("⛔ Đề thi này không cho phép thí sinh tự do tham gia!"); 
            return; 
        }
        if (tabClass) tabClass.classList.remove("active");
        if (tabFree) tabFree.classList.add("active");
        if (viewClass) viewClass.style.display = "none";
        if (viewFree) viewFree.style.display = "block";
    } else {
        if (tabClass) tabClass.classList.add("active");
        if (tabFree) tabFree.classList.remove("active");
        if (viewClass) viewClass.style.display = "block";
        if (viewFree) viewFree.style.display = "none";
    }
}

function toggleStudentPassVisibility() {
    const passIn = document.getElementById("st-password-input");
    const eyeBtn = document.getElementById("st-eye-btn");
    if (!passIn) return;
    if (passIn.type === "password") { 
        passIn.type = "text"; 
        if (eyeBtn) eyeBtn.innerText = "🙈"; 
    } else { 
        passIn.type = "password"; 
        if (eyeBtn) eyeBtn.innerText = "👁️"; 
    }
}

function submitStudentLogin() {
    const errBox = document.getElementById("st-login-error");
    const showErr = (msg) => {
        if (errBox) { errBox.innerText = msg; errBox.style.display = "block"; } else { alert(msg); }
    };

    let targetUrl = activeStudentLogin.targetUrl;
    if (!targetUrl) { showErr("❌ Không tìm thấy đường dẫn đề thi!"); return; }

    const targetCat = activeStudentLogin.categoryId || "them-11";
    const targetCatDisplayName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(targetCat) : targetCat;

    let finalSbd = ""; 
    let finalName = ""; 
    let finalClass = "";

    if (activeStudentLogin.currentMode === "class") {
        const usernameVal = (document.getElementById("st-username-input").value || "").trim();
        const passVal = (document.getElementById("st-password-input").value || "").trim();

        if (!usernameVal || !passVal) { 
            showErr("⚠️ Vui lòng nhập đầy đủ Tên đăng nhập (hoặc SBD) và Mật khẩu!"); 
            return; 
        }

        const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(targetCat) : [];
        const normUser = typeof normalizeName === 'function' ? normalizeName(usernameVal) : usernameVal.toLowerCase();

        const matched = classAccounts.find(acc => {
            const accSbd = String(acc.sbd || "").trim().toLowerCase();
            const accUser = typeof normalizeName === 'function' ? normalizeName(acc.username) : String(acc.username || "").toLowerCase();
            const accName = typeof normalizeName === 'function' ? normalizeName(acc.name) : String(acc.name || "").toLowerCase();
            const isUserMatch = (accSbd === usernameVal.toLowerCase()) || (normUser && (accUser === normUser || accName === normUser));
            const passOk = String(acc.pass || "").trim() === passVal;
            return isUserMatch && passOk;
        });

        if (!matched) {
            const otherCat = typeof detectCategoryFromSbd === 'function' ? detectCategoryFromSbd(usernameVal) : null;
            if (otherCat && otherCat !== targetCat) {
                const otherCatName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(otherCat) : otherCat;
                showErr(`⛔ Tài khoản "${usernameVal}" thuộc danh sách ${otherCatName}!\nĐề thi này chỉ dành riêng cho ${targetCatDisplayName}. Vui lòng chọn đúng đề thi của lớp bạn!`);
            } else {
                showErr(`❌ Sai Tên đăng nhập (SBD) hoặc Mật khẩu trong danh sách ${targetCatDisplayName}!`);
            }
            return;
        }

        finalSbd = matched.sbd; 
        finalName = matched.name || matched.username; 
        finalClass = matched.className || targetCatDisplayName;
    } else {
        if (activeStudentLogin.item && activeStudentLogin.item.allowFree === false) { 
            showErr("⛔ Giáo viên đã tắt chế độ thi tự do đối với đề thi này!"); 
            return; 
        }
        finalName = (document.getElementById("st-free-name-input").value || "").trim();
        finalClass = (document.getElementById("st-free-class-input").value || "").trim();
        finalSbd = (document.getElementById("st-free-sbd-input").value || "").trim();
        
        if (!finalName || !finalClass || !finalSbd) { 
            showErr("⚠️ Vui lòng nhập đầy đủ Họ tên, Lớp và SBD tự do!"); 
            return; 
        }

        const detectedCat = typeof detectCategoryFromSbd === 'function' ? detectCategoryFromSbd(finalSbd) : null;
        if (detectedCat) {
            const detectedName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(detectedCat) : detectedCat;
            showErr(`⚠️ Số báo danh "${finalSbd}" thuộc danh sách chính thức của ${detectedName}!\nVui lòng chuyển sang tab "Học sinh theo lớp" để đăng nhập bằng mật khẩu.`);
            return;
        }
    }

    safeLocal.removeItem("last_submission_cleared"); 
    safeLocal.removeItem("saved_student_sbd");
    safeLocal.removeItem("saved_student_name"); 
    safeLocal.removeItem("saved_student_class");
    safeLocal.setItem("current_exam_student", JSON.stringify({ sbd: finalSbd, name: finalName, className: finalClass, categoryId: targetCat }));

    try {
        let u = new URL(targetUrl, window.location.href);
        u.searchParams.set("cat", targetCat); 
        u.searchParams.set("sbd", finalSbd); 
        u.searchParams.set("name", finalName);
        u.searchParams.set("class", finalClass); 
        u.searchParams.set("autostart", "1"); 
        window.location.href = u.toString();
    } catch (e) {
        window.location.href = `${targetUrl}&cat=${encodeURIComponent(targetCat)}&sbd=${encodeURIComponent(finalSbd)}&name=${encodeURIComponent(finalName)}&class=${encodeURIComponent(finalClass)}&autostart=1`;
    }
}

function checkPassword() { 
    const val = document.getElementById("exam-pass-input").value.trim(); 
    if (!val) {
        alert("⚠️ Vui lòng nhập mật khẩu hoặc mã học sinh!");
        return;
    }

    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(currentCat) : [];
    
    const pLow = val.toLowerCase();
    const matchedStudent = classAccounts.find(acc => 
        (acc.sbd && String(acc.sbd).trim().toLowerCase() === pLow) ||
        (acc.pass && String(acc.pass).trim().toLowerCase() === pLow) ||
        (acc.username && String(acc.username).trim().toLowerCase() === pLow)
    );
    
    if (matchedStudent) {
        if (typeof applyStudentToUI === 'function') applyStudentToUI(matchedStudent);
        document.getElementById("login-box").style.display = "none";
        startExamAction();
        return;
    }

    if (typeof EXAM_PASSWORD !== 'undefined' && EXAM_PASSWORD !== "" && val === EXAM_PASSWORD) { 
        document.getElementById("login-box").style.display = "none"; 
        document.getElementById("student-card").style.display = "block"; 
        if (typeof syncStudentFromParamsAndStorage === 'function') syncStudentFromParamsAndStorage();
    } else { 
        alert(`❌ Mật khẩu hoặc mã học sinh không đúng trong danh sách ${typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(currentCat) : currentCat}!`); 
    } 
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
    const currentCatName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(currentCat) : currentCat;

    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(currentCat) : [];
    const checkInClass = classAccounts.find(acc => 
        String(acc.sbd || "").trim().toLowerCase() === sId.toLowerCase()
    );

    const isFree = !checkInClass;

    if (isFree) {
        const otherCat = typeof detectCategoryFromSbd === 'function' ? detectCategoryFromSbd(sId) : null;
        if (otherCat && otherCat !== currentCat) {
            const otherCatName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName(otherCat) : otherCat;
            alert(`⛔ Số báo danh "${sId}" thuộc danh sách học sinh của ${otherCatName}!\nBạn không thể sử dụng tài khoản này để làm đề thi của ${currentCatName}.\nVui lòng quay lại trang chủ và chọn đúng đề thi của lớp bạn!`);
            window.location.href = `./index.html`;
            return;
        }

        const allowFree = typeof isCurrentExamAllowFree === 'function' ? isCurrentExamAllowFree() : true;
        if (!allowFree) {
            alert(`⛔ Đề thi này chỉ dành riêng cho học sinh lớp ${currentCatName}!\nThí sinh tự do hoặc học sinh lớp khác không được phép tham gia.`);
            window.location.href = `./index.html`;
            return;
        }
    }

    await executeStartExamAPI(sId, sName, sClass, isFree);
}

async function executeStartExamAPI(sId, sName, sClass, isFreeStudent = false) { 
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const strictClassName = getStrictStandardClassName(sClass || currentCat, sId);

    const urlParams = new URLSearchParams(window.location.search);
    const currentQuizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "";
    const startBtn = document.getElementById("btn-start-exam");

    if (startBtn) { 
        startBtn.disabled = true; 
        startBtn.innerText = "⏳ Đang kết nối phòng thi..."; 
    }

    safeLocal.removeItem(getStorageKey());

    const cleanSbd = (sId || "user").replace(/[^a-zA-Z0-9]/g, '_');
    const nowMs = Date.now();
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;

    if (client && currentQuizId) {
        try {
            await client.from('active_sessions').delete().match({ quiz_id: currentQuizId, sbd: cleanSbd });

            await client.from('active_sessions').insert([{
                id: `${currentQuizId}_${cleanSbd}`,
                quiz_id: currentQuizId,
                sbd: cleanSbd,
                name: sName,
                class_name: strictClassName,
                category_id: currentCat,
                is_free: isFreeStudent,
                ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
                exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
                start_time: nowMs,
                last_ping: nowMs
            }]);

            await client.from('live_drafts').upsert({
                id: `${currentQuizId}_${cleanSbd}`,
                quiz_id: currentQuizId,
                sbd: cleanSbd,
                student_name: sName,
                class_name: strictClassName,
                category_id: currentCat,
                ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
                exam_title: typeof EXAM_NAME !== 'undefined' ? EXAM_NAME : "Đề thi",
                user_answers: (window.SECURE_VAULT && window.SECURE_VAULT.userAnswers) || {},
                last_updated: new Date().toISOString()
            }, { onConflict: 'id' });

            if (typeof examIndexedDB !== 'undefined') {
                examIndexedDB.setItem('live_drafts', {
                    key: `${currentQuizId}_${cleanSbd}`,
                    quiz_id: currentQuizId,
                    sbd: cleanSbd,
                    student_name: sName,
                    class_name: strictClassName,
                    user_answers: (window.SECURE_VAULT && window.SECURE_VAULT.userAnswers) || {},
                    updatedAt: nowMs
                }).catch(() => {});
            }

            client.from('cheating_logs').insert([{
                quiz_id: currentQuizId,
                sbd: cleanSbd,
                student_name: sName,
                student_class: strictClassName,
                category_id: currentCat,
                switch_count: 0,
                duration_str: "Bắt đầu",
                duration_sec: 0
            }]).then();

        } catch (err) {
            console.warn("Cảnh báo ghi nhận phòng thi:", err);
        }
    }

    document.getElementById("nav-student-name").innerText = sName; 
    document.getElementById("nav-student-id").innerText = sId; 
    document.getElementById("nav-student-class").innerText = strictClassName; 
    document.getElementById("nav-exam-code-text").innerText = `Đề: ${typeof getMaDe === 'function' ? getMaDe() : '101'}`; 
    document.getElementById("student-card").style.display = "none"; 
    
    const waitingCard = document.getElementById("waiting-room-card"); 
    if (waitingCard) waitingCard.style.display = "none"; 
    
    document.getElementById("top-navbar").style.display = "block"; 
    document.getElementById("quiz-content").style.display = "block"; 
    
    examStartTime = Date.now(); 
    if (typeof window.__saveExamState === 'function') window.__saveExamState();
    if (typeof window.__updateProgress === 'function') window.__updateProgress(); 
    
    if (typeof applyOnlineCountVisibility === 'function') applyOnlineCountVisibility();
    if (typeof startCountdownTimer === 'function') startCountdownTimer(); 
    if (typeof startPresenceSystem === 'function') startPresenceSystem(sId);
    if (typeof updateTopBackupStatus === 'function') updateTopBackupStatus(false);

    renderStudentSubmissionHistoryButtons();

    if (startBtn) { 
        startBtn.disabled = false; 
        startBtn.innerText = "Vào Làm Bài"; 
    }
}

// BỘ ĐÓNG GÓI BÀI NỘP CHUẨN XÁC VỚI TIMESTAMP DUY NHẤT CHO MỖI LẦN THI
function buildCompleteSubmissionPayload(isForceSubmit = false) {
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "user";
    const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "Thí sinh";
    const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "Lớp";
    
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "them-11";
    const strictClassName = getStrictStandardClassName(sClass || currentCat, sId);

    const urlParams = new URLSearchParams(window.location.search);
    const currentQuizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "exam";

    const classAccounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(currentCat) : [];
    const isClassAcc = classAccounts.some(acc => String(acc.sbd || "").trim().toLowerCase() === sId.toLowerCase());
    const isFreeStudent = !isClassAcc;

    const maxAllowedSec = totalTimeSeconds || (TIME_LIMIT_MINUTES * 60) || 5400;
    let actualElapsedSec = lockedDurationSec || (examStartTime ? Math.round((Date.now() - examStartTime) / 1000) : 0);
    const durationSec = Math.min(Math.max(1, actualElapsedSec), maxAllowedSec);
    const spentMins = Math.floor(durationSec / 60);
    const spentSecs = durationSec % 60;
    const completionTimeStr = `${spentMins} phút ${spentSecs} giây`;

    let scoreResult = null;
    if (typeof calculateExamScoreWithConfig === 'function' && typeof examData !== 'undefined' && examData) {
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

    const cleanSbd = sId.replace(/[^a-zA-Z0-9]/g, '_');
    const submissionTimestampMs = Date.now();
    // ID MỖI LẦN THI ĐỀU KHÁC BIỆT KÈM MỐC THỜI GIAN -> KHÔNG BAO GIỜ BỊ ĐÈ
    const submissionId = `sub_${currentQuizId}_${cleanSbd}_${submissionTimestampMs}`;

    const exactExamTitle = (typeof EXAM_NAME !== 'undefined' && EXAM_NAME && EXAM_NAME !== 'ĐỀ THI TRẮC NGHIỆM') 
        ? EXAM_NAME 
        : ((typeof examData !== 'undefined' && examData && examData.title) ? examData.title : "Đề thi");

    return {
        id: submissionId,
        quiz_id: currentQuizId,
        sbd: cleanSbd,
        student_name: sName,
        class_name: strictClassName,
        score10: isNaN(finalScore) ? 0 : Number(finalScore),
        raw_score: isNaN(totalRawScore) ? 0 : Number(Math.round(totalRawScore * 100) / 100),
        max_scale: isNaN(maxScale) ? 10.0 : Number(maxScale),
        correct_count: isNaN(correctCount) ? 0 : parseInt(correctCount, 10),
        wrong_count: isNaN(wrongCount) ? 0 : parseInt(wrongCount, 10),
        completion_time: completionTimeStr,
        spent_mins: isNaN(spentMins) ? 0 : parseInt(spentMins, 10),
        tab_switch_count: `${tabSwitchCount} lần`,
        data_string: dataDetails.join(" | "),
        user_answers: (window.SECURE_VAULT && window.SECURE_VAULT.userAnswers) || {},
        category_id: currentCat,
        is_free: isFreeStudent,
        ma_de: typeof getMaDe === 'function' ? getMaDe() : "101",
        exam_title: exactExamTitle,
        created_at: new Date(submissionTimestampMs).toISOString()
    };
}

// GỬI BẢN SAO LƯU NGẦM LÊN GOOGLE DRIVE (CHẠY NỀN)
function sendSubmissionJsonToGoogleDriveFolder(payload) {
    setTimeout(() => {
        try {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
                ? GOOGLE_DRIVE_TULUAN_GAS_URL 
                : ((typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined") ? GOOGLE_DRIVE_UPLOAD_GAS_URL : null);

            if (!gasUrl || gasUrl.includes("DÁN_URL")) return;

            const strictClassName = getStrictStandardClassName(payload.class_name, payload.sbd);
            const exactExamTitle = payload.exam_title || "Đề thi";

            const sbd = payload.sbd || "sbd";
            const sName = payload.student_name || "hocsinh";
            const fileName = `${sbd}_${sName}_${Date.now()}.json`.replace(/\s+/g, '_');

            const jsonStr = JSON.stringify(payload, null, 2);
            let base64Data = "";
            try {
                base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
            } catch(e) {
                base64Data = btoa(jsonStr);
            }

            const drivePayload = {
                action: "saveSubmissionJsonFile",
                rootFolder: "FILE_SHEET_AND_JSON_DU_PHONG",
                className: strictClassName,
                class: strictClassName,
                lop: strictClassName,
                examTitle: exactExamTitle,
                filename: fileName,
                mimeType: "application/json",
                base64: base64Data,
                submission: payload
            };

            const payloadText = JSON.stringify(drivePayload);
            fetch(gasUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: payloadText,
                keepalive: true
            }).catch(() => {
                if (navigator.sendBeacon) {
                    const blob = new Blob([payloadText], { type: "text/plain;charset=utf-8" });
                    navigator.sendBeacon(gasUrl, blob);
                }
            });
        } catch(e) {}
    }, 100);
}

function downloadSubmissionJsonSilently(payload, attemptNumber = 1) {
    try {
        const sId = (payload.sbd || "sbd").replace(/[^a-zA-Z0-9]/g, '_');
        const sName = (payload.student_name || "hocsinh").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
        const fileName = `${sId}_${sName}_lan${attemptNumber}.json`;

        const exportObj = {
            ...payload,
            attemptNumber: attemptNumber,
            exportedAt: Date.now()
        };

        const jsonStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        return fileName;
    } catch (e) {
        console.error("Lỗi tự động tải JSON:", e);
        return "BaiLam_DuPhong.json";
    }
}

async function shareSubmissionFileNative(payload, attemptNumber = 1) {
    if (!payload) return;
    const sId = (payload.sbd || "sbd").replace(/[^a-zA-Z0-9]/g, '_');
    const sName = (payload.student_name || "hocsinh").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const fileName = `${sId}_${sName}_lan${attemptNumber}.json`;
    const exportObj = { ...payload, attemptNumber, exportedAt: Date.now() };
    const jsonStr = JSON.stringify(exportObj, null, 2);

    try {
        const file = new File([jsonStr], fileName, { type: "application/json" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `Bài làm: ${payload.student_name} (${payload.sbd})`,
                text: `Kính gửi Thầy bài làm dự phòng của em [${payload.student_name} - SBD: ${payload.sbd} - Lớp: ${payload.class_name}]`
            });
            return;
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.warn("Web Share API không khả dụng:", err);
        } else {
            return;
        }
    }

    downloadSubmissionJsonSilently(payload, attemptNumber);
    alert(`📁 ĐÃ TẢI FILE DỰ PHÒNG!\n\nTên file: "${fileName}"\nVị trí: Thư mục Tải về (Downloads).\n\n👉 Em hãy gửi file này cho Thầy giáo qua Zalo/Messenger nhé!`);
}

function recordSubmissionToHistory(payload) {
    try {
        const quizId = payload.quiz_id;
        const sbd = payload.sbd;
        const storageKey = `exam_history_${quizId}_${sbd}`;

        let history = [];
        const raw = safeLocal.getItem(storageKey);
        if (raw) {
            try { history = JSON.parse(raw); } catch(e) {}
        }
        if (!Array.isArray(history)) history = [];

        const attemptIndex = history.length + 1;
        const historyItem = {
            id: `${storageKey}_attempt_${attemptIndex}`,
            attempt: attemptIndex,
            timestamp: Date.now(),
            dateStr: new Date().toLocaleString("vi-VN"),
            payload: payload
        };
        history.push(historyItem);

        safeLocal.setItem(storageKey, JSON.stringify(history));

        if (typeof examIndexedDB !== 'undefined') {
            examIndexedDB.setItem('exam_history', historyItem).catch(() => {});
        }

        renderStudentSubmissionHistoryButtons();
    } catch (e) {
        console.error("Lỗi lưu lịch sử nộp bài:", e);
    }
}

function renderStudentSubmissionHistoryButtons() {
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd");
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);

    if (!sId || !quizId) return;

    const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
    const storageKey = `exam_history_${quizId}_${cleanSbd}`;
    const raw = safeLocal.getItem(storageKey);
    if (!raw) return;

    let history = [];
    try { history = JSON.parse(raw); } catch(e) { return; }
    if (!Array.isArray(history) || history.length === 0) return;

    let container = document.getElementById("student-history-buttons-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "student-history-buttons-container";
        container.style.cssText = `
            margin: 10px 0 14px 0;
            padding: 12px 14px;
            background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
            border: 1.5px solid #38bdf8;
            border-radius: 14px;
            box-shadow: 0 4px 14px rgba(2, 132, 199, 0.12);
            display: flex;
            flex-direction: column;
            gap: 8px;
            position: relative;
            z-index: 100;
        `;

        const targetAnchor = document.getElementById("student-card") || document.getElementById("quiz-content");
        if (targetAnchor && targetAnchor.parentNode) {
            targetAnchor.parentNode.insertBefore(container, targetAnchor);
        }
    }

    let buttonsHtml = `
        <div style="font-size: 13px; font-weight: 800; color: #0369a1; display: flex; align-items: center; gap: 6px;">
            <span>💾</span> <b>BÀI LÀM ĐÃ LƯU TRÊN MÁY NÀY (BẢO LƯU 100%):</b>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
    `;

    history.forEach(item => {
        buttonsHtml += `
            <button type="button" class="btn-history-share-json" 
                    onclick="triggerShareFromHistory(${item.attempt})" 
                    style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: 1.2px solid #86efac; padding: 8px 14px; border-radius: 10px; font-weight: 900; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(16, 185, 129, 0.28); transition: transform 0.15s ease;">
                📤 Hãy gửi file json lần ${item.attempt} nếu cần (${item.dateStr.split(' ')[0]})
            </button>
        `;
    });

    buttonsHtml += `</div>`;
    container.innerHTML = buttonsHtml;
}

window.triggerShareFromHistory = function(attemptNumber) {
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd");
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id);

    if (!sId || !quizId) return;

    const cleanSbd = String(sId).replace(/[^a-zA-Z0-9]/g, '_');
    const storageKey = `exam_history_${quizId}_${cleanSbd}`;
    const raw = safeLocal.getItem(storageKey);
    if (!raw) return;

    try {
        const history = JSON.parse(raw);
        const item = history.find(h => h.attempt === attemptNumber);
        if (item && item.payload) {
            shareSubmissionFileNative(item.payload, attemptNumber);
        }
    } catch(e) {}
};

// =========================================================================
// HÀM NỘP BÀI: CHUẨN HÓA LƯU RIÊNG TỪNG LẦN THI - TUYỆT ĐỐI KHÔNG GHI ĐÈ
// =========================================================================
async function executeSubmitExam(isForceSubmit = false) { 
    if (isSubmitted || isSubmittingInProgress) return; 

    isSubmittingInProgress = true;
    if (typeof lockExamInteractions === 'function') lockExamInteractions();
    if (typeof saveExamStateToStorage === 'function') saveExamStateToStorage();
    
    const confirmModal = document.getElementById("submit-confirm-modal");
    const normalView = document.getElementById("modal-normal-submit-view");
    const progressView = document.getElementById("modal-submitting-progress-view");
    const actionsBox = document.getElementById("modal-actions-container");

    if (confirmModal) confirmModal.style.display = "flex";
    if (normalView) normalView.style.display = "none";
    if (actionsBox) actionsBox.innerHTML = "";

    const payload = buildCompleteSubmissionPayload(isForceSubmit);
    
    // Tính đúng số thứ tự lần thi thực tế của học sinh này
    const currentAttemptNumber = getRealStudentExamAttemptNumber(payload.quiz_id, payload.sbd);

    // Lưu ngay bản sao vào bộ nhớ máy tính & IndexedDB
    safeLocal.setItem(`exam_completed_backup_${payload.quiz_id}`, JSON.stringify(payload));
    safeLocal.setItem("pending_exam_submission", JSON.stringify(payload));
    pendingSubmissionPayload = payload;

    if (typeof examIndexedDB !== 'undefined') {
        const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
            ? GOOGLE_DRIVE_TULUAN_GAS_URL 
            : ((typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined") ? GOOGLE_DRIVE_UPLOAD_GAS_URL : "");

        examIndexedDB.setItem('pending_submissions', {
            id: payload.id,
            payload: payload,
            gasUrl: gasUrl,
            savedAt: Date.now()
        }).catch(() => {});
    }

    // Sao lưu ngầm lên Google Drive chạy nền
    sendSubmissionJsonToGoogleDriveFolder(payload);

    const dbPayload = {
        id: payload.id,
        quiz_id: payload.quiz_id,
        sbd: payload.sbd,
        student_name: payload.student_name,
        class_name: payload.class_name,
        score10: payload.score10,
        raw_score: payload.raw_score,
        max_scale: payload.max_scale,
        correct_count: payload.correct_count,
        wrong_count: payload.wrong_count,
        completion_time: payload.completion_time,
        spent_mins: payload.spent_mins,
        tab_switch_count: payload.tab_switch_count,
        data_string: payload.data_string,
        user_answers: payload.user_answers,
        category_id: payload.category_id,
        is_free: payload.is_free,
        ma_de: payload.ma_de,
        exam_title: payload.exam_title,
        created_at: payload.created_at
    };

    // NÂNG LÊN 25 GIÂY CHO MẠNG 3G/4G YẾU ĐỦ THỜI GIAN KẾT NỐI
    let secondsLeft = 25;
    if (submissionCountdownTimer) clearInterval(submissionCountdownTimer);

    const updateCountdownDisplay = (sec) => {
        if (progressView) {
            progressView.innerHTML = `
                <div class="spinner" style="width:42px; height:42px; margin:0 auto 12px auto; border-top-color:#0284c7;"></div>
                <div style="font-weight:900; color:#0284c7; font-size:1.15rem;">
                    ⏳ Đang gửi bài Lần ${currentAttemptNumber} lên máy chủ: <span style="color:#ef4444; font-size:1.3rem;">${sec}s</span>
                </div>
                <div style="font-size:0.92rem; color:#475569; margin-top:6px; font-weight:600;">
                    Đang xác thực và lưu điểm chính thức lên hệ thống...
                </div>
            `;
            progressView.style.display = "block";
        }
    };

    updateCountdownDisplay(secondsLeft);

    let isFinishedTime = false;
    let submitSuccess = false;

    const countdownPromise = new Promise(resolve => {
        submissionCountdownTimer = setInterval(() => {
            secondsLeft--;
            if (secondsLeft >= 0) {
                updateCountdownDisplay(secondsLeft);
            }
            if (secondsLeft <= 0) {
                clearInterval(submissionCountdownTimer);
                isFinishedTime = true;
                resolve();
            }
        }, 1000);
    });

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;

    // CHIẾN LƯỢC GỬI SUPABASE BẢO VỆ MỌI LẦN THI
    const trySendToSupabase = async () => {
        if (!client) throw new Error("Chưa kết nối Supabase Client");

        const uniqueId = dbPayload.id || `sub_${payload.quiz_id}_${payload.sbd}_${Date.now()}`;
        const submissionRow = { ...dbPayload, id: uniqueId };

        // 1. Thử chèn bản ghi mới
        let { error: err1 } = await client.from('submissions').insert([submissionRow]);
        if (!err1) return true;

        // 2. Nếu do xung đột id khi retry mạng -> upsert theo 'id'
        let { error: err2 } = await client.from('submissions').upsert(submissionRow, { onConflict: 'id' });
        if (!err2) return true;

        console.warn("Lỗi gửi bài lên Supabase:", err2.message || err1.message);
        throw err2 || err1;
    };

    const sendLoopPromise = (async () => {
        const startTime = Date.now();
        while (Date.now() - startTime < 24500 && !isFinishedTime) {
            try {
                await trySendToSupabase();
                submitSuccess = true;
                break;
            } catch (err) {
                console.warn(`Đang thử gửi lại bài...:`, err.message || err);
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    })();

    await Promise.race([sendLoopPromise, countdownPromise]);
    if (submissionCountdownTimer) clearInterval(submissionCountdownTimer);

    // THÀNH CÔNG: XÓA PHIÊN ĐANG THI & HIỂN THỊ KẾT QUẢ
    if (submitSuccess) {
        if (client) {
            client.from('live_drafts').delete().match({ quiz_id: payload.quiz_id, sbd: payload.sbd }).then();
            client.from('active_sessions').delete().match({ quiz_id: payload.quiz_id, sbd: payload.sbd }).then();
        }
        if (typeof clearPresence === 'function') clearPresence(payload.sbd);
        if (timerInterval) clearInterval(timerInterval); 

        safeLocal.removeItem("pending_exam_submission");
        safeLocal.removeItem(getStorageKey()); 
        safeLocal.removeItem(`shuffled_exam_${getExamCode()}`);
        safeLocal.setItem("last_submission_cleared", "true");

        if (typeof examIndexedDB !== 'undefined') {
            examIndexedDB.removeItem('pending_submissions', payload.id).catch(() => {});
        }
        
        recordSubmissionToHistory(payload);

        isSubmitted = true; 
        isSubmittingInProgress = false;
        if (typeof updateTopBackupStatus === 'function') updateTopBackupStatus(true);

        if (confirmModal) confirmModal.style.display = "none"; 

        renderResultSummaryScreen(
            payload.correct_count, 
            payload.wrong_count, 
            payload.spent_mins, 
            payload.completion_time, 
            payload.score10, 
            payload.max_scale, 
            payload.quiz_id
        ); 
        return;
    }

    // THẤT BẠI DO MẠNG: TỰ ĐỘNG TẢI FILE JSON DỰ PHÒNG CÓ ĐÚNG SỐ LẦN THI
    isSubmittingInProgress = false;
    const savedFileName = downloadSubmissionJsonSilently(payload, currentAttemptNumber);
    recordSubmissionToHistory(payload);

    if (progressView) {
        progressView.innerHTML = `
            <div style="font-size:36px; margin-bottom:8px;">💾⚠️</div>
            <div style="font-weight:900; color:#dc2626; font-size:1.15rem;">CHƯA THỂ KẾT NỐI MÁY CHỦ (MẠNG YẾU)</div>
            <div style="font-size:0.95rem; color:#1e293b; margin-top:8px; font-weight:700; line-height:1.45; text-align:left; background:#f0fdf4; padding:10px 14px; border-radius:10px; border:1px solid #86efac;">
                ✅ <b>ĐÃ TỰ ĐỘNG LƯU FILE JSON BÀI LÀM:</b><br>
                📁 Tên tệp: <b>${savedFileName}</b><br>
                📍 Vị trí: Đã lưu an toàn trong mục <b>"Tải về" (Downloads)</b> trên máy của em.<br>
                ⚡ Điểm số & bài làm đã được bảo vệ nguyên vẹn 100%.
            </div>
        `;
    }

    if (actionsBox) {
        actionsBox.innerHTML = `
            <div style="margin-top: 14px; width:100%; display:flex; flex-direction:column; gap:8px;">
                <button type="button" onclick="executeSubmitExam(${isForceSubmit})" 
                        style="width:100%; padding:13px; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#fff; border:none; border-radius:11px; font-weight:900; font-size:1.05rem; cursor:pointer; box-shadow:0 4px 14px rgba(2, 132, 199, 0.35);">
                    🔄 Thử gửi lại bài lần ${currentAttemptNumber}
                </button>
                <button type="button" onclick="viewResultOfflineFallback(pendingSubmissionPayload)"
                        style="width:100%; padding:11px; background:#f0fdf4; color:#15803d; border:1.5px solid #86efac; border-radius:10px; font-weight:900; font-size:0.98rem; cursor:pointer;">
                    📊 Xem điểm số & bài làm ngay (Offline)
                </button>
                <button type="button" onclick="shareSubmissionFileNative(pendingSubmissionPayload, ${currentAttemptNumber})" 
                        style="width:100%; padding:9px; background:#f8fafc; color:#475569; border:1px solid #cbd5e1; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer;">
                    📤 Gửi file json bài làm qua Zalo cho Thầy
                </button>
            </div>
        `;
        actionsBox.style.display = "block";
    }
}

// HÀM DỰ PHÒNG XEM ĐIỂM NGAY KHI MẤT MẠNG HOÀN TOÀN
function viewResultOfflineFallback(payload) {
    if (!payload) return;
    const confirmModal = document.getElementById("submit-confirm-modal");
    if (confirmModal) confirmModal.style.display = "none";

    isSubmitted = true;
    isSubmittingInProgress = false;

    renderResultSummaryScreen(
        payload.correct_count, 
        payload.wrong_count, 
        payload.spent_mins, 
        payload.completion_time, 
        payload.score10, 
        payload.max_scale, 
        payload.quiz_id
    );
}

function showSubmitConfirmModal() { 
    if (isSubmitted) return; 

    const topbar = document.getElementById("universal-backup-topbar");
    if (topbar) topbar.style.display = "flex";
    const topDownloadBtn = document.getElementById("btn-always-download-backup");
    if (topDownloadBtn) topDownloadBtn.style.display = "inline-flex";

    if (typeof isExamLocked !== 'undefined' && isExamLocked) {
        executeSubmitExam(false);
        return;
    }

    const answered = typeof updateProgress === 'function' ? updateProgress() : 0; 
    const unanswered = totalQuestionsCount - answered; 
    document.getElementById("modal-remain-time").innerText = typeof formatHHMMSS === 'function' ? formatHHMMSS(Math.max(0, remainingSeconds)) : "00:00"; 
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
        <div style="margin-top: 10px; width: 100%;">
            <button type="button" onclick="downloadCompletedOrDraftSubmission()" style="width: 100%; padding: 10px; background: #f0f9ff; color: #0284c7; border: 1.5px solid #7dd3fc; border-radius: 11px; font-weight: 800; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
                💾 Tải file dự phòng bài làm (.json)
            </button>
        </div>
    `;
    document.getElementById("submit-confirm-modal").style.display = "flex"; 
}

function closeSubmitConfirmModal() { 
    if (isSubmittingInProgress) return;
    document.getElementById("submit-confirm-modal").style.display = "none"; 
}

// ĐĂNG KÝ CÁC HÀM TOÀN CỤC
window.getStrictStandardClassName = getStrictStandardClassName;
window.getRealStudentExamAttemptNumber = getRealStudentExamAttemptNumber;
window.openStudentLoginModal = openStudentLoginModal;
window.closeStudentLoginModal = closeStudentLoginModal;
window.switchStudentLoginMode = switchStudentLoginMode;
window.toggleStudentPassVisibility = toggleStudentPassVisibility;
window.submitStudentLogin = submitStudentLogin;
window.checkPassword = checkPassword;
window.startExamAction = startExamAction;
window.executeStartExamAPI = executeStartExamAPI;
window.executeSubmitExam = executeSubmitExam;
window.viewResultOfflineFallback = viewResultOfflineFallback;
window.showSubmitConfirmModal = showSubmitConfirmModal;
window.closeSubmitConfirmModal = closeSubmitConfirmModal;
window.shareSubmissionFileNative = shareSubmissionFileNative;
window.downloadSubmissionJsonSilently = downloadSubmissionJsonSilently;
window.renderStudentSubmissionHistoryButtons = renderStudentSubmissionHistoryButtons;
window.sendSubmissionJsonToGoogleDriveFolder = sendSubmissionJsonToGoogleDriveFolder;
