// =========================================================
// FILE: portal-tuluan-lightbox.js (BẢN MA TRẬN 10 CỘT ĐIỂM TP CHUẨN XÁC 100% THEO ẢNH 2)
// =========================================================

let _compScoreAutoSaveTimer = null;

// TIÊM BỘ STYLE MÀU SẮC ĐẶC QUYỀN CHO Ô ĐIỂM BẢNG NGOÀI (CÓ ĐIỂM = XANH, CHƯA CHẤM = ĐỎ)
(function injectScoreColorStyles() {
    const styleId = "tuluan-cross-score-color-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        /* Ô ĐÃ CÓ ĐIỂM: MÀU XANH LÁ MÁT MẮT, RÕ RÀNG */
        .tuluan-score-input.score-has-val {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important;
            color: #15803d !important;
            border: 1.5px solid #22c55e !important;
            box-shadow: 0 2px 6px rgba(34, 197, 94, 0.28) !important;
            font-weight: 900 !important;
        }
        /* Ô CHƯA CÓ ĐIỂM: MÀU ĐỎ NỔI BẬT DỄ NHẬN BIẾT */
        .tuluan-score-input.score-no-val {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
            color: #b91c1c !important;
            border: 1.5px solid #ef4444 !important;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.22) !important;
            font-weight: 800 !important;
        }
        .tuluan-score-input.score-no-val::placeholder {
            color: #dc2626 !important;
            font-weight: 800 !important;
            opacity: 0.85 !important;
        }
    `;
    document.head.appendChild(style);
})();

function updateCrossScoreInputStyles() {
    const inputs = document.querySelectorAll('.tuluan-score-input');
    inputs.forEach(inp => {
        const val = (inp.value || "").trim();
        if (val !== "" && val !== "---") {
            inp.classList.remove('score-no-val');
            inp.classList.add('score-has-val');
        } else {
            inp.classList.remove('score-has-val');
            inp.classList.add('score-no-val');
        }
    });
}
window.updateCrossScoreInputStyles = updateCrossScoreInputStyles;

function onThumbnailItemClicked(cleanSbd, imgIndex, canView, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!canView) {
        alert("🔒 BÀI LÀM ĐANG CHỜ THẦY PHÊ DUYỆT!\n\nSau khi Thầy phê duyệt, em sẽ được xem chi tiết để học hỏi nhé!");
        return;
    }

    const record = currentTuLuanModalData.submissionsMap[cleanSbd];
    if (!record || !Array.isArray(record.images) || record.images.length === 0) return;

    currentLightboxGallery.studentName = record.studentName || "Học sinh";
    currentLightboxGallery.studentSbd = cleanSbd;
    currentLightboxGallery.images = record.images;
    currentLightboxGallery.currentIndex = Math.max(0, Math.min(imgIndex, record.images.length - 1));
    currentLightboxGallery.currentQuestionCount = record.questionCount || (typeof detectExamQuestionCount === 'function' ? detectExamQuestionCount() : 30);
    
    const qId = currentTuLuanModalData.quizId;
    let loadedScores = null;

    try {
        const localMapRaw = localStorage.getItem(`tuluan_scores_${qId}`);
        if (localMapRaw) {
            const localMap = JSON.parse(localMapRaw);
            if (localMap && localMap[cleanSbd] && localMap[cleanSbd].detailScores) {
                loadedScores = localMap[cleanSbd].detailScores;
            }
        }
    } catch(e) {}

    if (!loadedScores) {
        const draftKey = `draft_comp_score_${qId}_${cleanSbd}`;
        const draftRaw = sessionStorage.getItem(draftKey);
        if (draftRaw) {
            try { loadedScores = JSON.parse(draftRaw); } catch(e) {}
        }
    }

    if (!loadedScores && record.detailScores) {
        loadedScores = { ...record.detailScores };
    }

    currentLightboxGallery.componentScores = loadedScores || {};

    resetLightboxZoom(false);
    updateLightboxView();

    const lb = document.getElementById("tuluan-lightbox");
    if (lb) lb.style.display = "flex";
}

function updateLightboxView() {
    const gallery = currentLightboxGallery;
    const total = gallery.images.length;
    const curIdx = gallery.currentIndex;
    const curImg = gallery.images[curIdx];
    if (!curImg) return;

    const fullImg = document.getElementById("lightbox-full-img");
    const titleEl = document.getElementById("lightbox-student-title");
    const pageBadge = document.getElementById("lightbox-page-indicator");
    const btnPrev = document.getElementById("btn-lightbox-prev");
    const btnNext = document.getElementById("btn-lightbox-next");
    const dotsWrap = document.getElementById("lightbox-dots-container");

    const imgSrc = curImg.directUrl || curImg.fileUrl;
    if (fullImg) {
        fullImg.style.opacity = "0.4"; fullImg.src = imgSrc;
        fullImg.onload = function() { fullImg.style.opacity = "1"; };
    }

    if (titleEl) titleEl.innerText = `${gallery.studentName} - Trang ${curIdx + 1}`;
    if (pageBadge) pageBadge.innerText = `Tr ${curIdx + 1}/${total}`;
    if (btnPrev) btnPrev.classList.toggle("disabled", curIdx <= 0);
    if (btnNext) btnNext.classList.toggle("disabled", curIdx >= total - 1);

    if (dotsWrap) {
        dotsWrap.innerHTML = gallery.images.map((_, i) => `<div class="lightbox-dot-item ${i === curIdx ? 'active' : ''}" onclick="jumpToLightboxPage(${i}, event)"></div>`).join('');
    }
}

function navigateLightbox(step, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const gallery = currentLightboxGallery;
    const newIdx = gallery.currentIndex + step;
    if (newIdx >= 0 && newIdx < gallery.images.length) {
        gallery.currentIndex = newIdx; resetLightboxZoom(false); updateLightboxView();
    }
}

function jumpToLightboxPage(targetIndex, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (targetIndex >= 0 && targetIndex < currentLightboxGallery.images.length) {
        currentLightboxGallery.currentIndex = targetIndex; resetLightboxZoom(false); updateLightboxView();
    }
}

function openTuLuanLightbox(imgSrc, driveUrl, title, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentLightboxGallery.studentName = title || "Ảnh bài làm"; currentLightboxGallery.studentSbd = "";
    currentLightboxGallery.images = [{ directUrl: imgSrc, fileUrl: driveUrl }]; currentLightboxGallery.currentIndex = 0;
    currentLightboxGallery.currentQuestionCount = (typeof detectExamQuestionCount === 'function') ? detectExamQuestionCount() : 30;
    currentLightboxGallery.componentScores = {};

    resetLightboxZoom(false); updateLightboxView();
    const lb = document.getElementById("tuluan-lightbox"); if (lb) lb.style.display = "flex";
}

function closeTuLuanLightbox(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const lb = document.getElementById("tuluan-lightbox"); if (lb) lb.style.display = "none";
    closeComponentScorePopover(); resetLightboxZoom(false);
}

// BỘ ĐIỀU HƯỚNG POPOVER ĐIỂM THÀNH PHẦN
function toggleComponentScorePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("component-score-popover"); if (!pop) return;
    if (!pop.classList.contains("show")) {
        pop.classList.add("show");
        renderComponentScoreGrid();
    } else {
        pop.classList.remove("show");
    }
}
function closeComponentScorePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("component-score-popover"); if (pop) pop.classList.remove("show");
}

function setQuickQuestionCount(num) {
    const input = document.getElementById("comp-score-q-count");
    if (input) input.value = num;
    document.querySelectorAll(".btn-quick-count-pill").forEach(b => b.classList.toggle("active", b.id === `btn-count-${num}`));
    onComponentQuestionCountChanged(num);
}

function onComponentQuestionCountChanged(val) {
    let count = parseInt(val, 10);
    if (isNaN(count) || count < 1) count = 30;
    if (count > 120) count = 120;
    currentLightboxGallery.currentQuestionCount = count;
    renderComponentScoreGrid();
}

// RENDER MA TRẬN 10 CỘT ĐIỂM TP CHUẨN XÁC THEO ẢNH 2
function renderComponentScoreGrid() {
    const container = document.getElementById("comp-score-grid-container"); 
    const nameEl = document.getElementById("comp-score-st-name"); 
    const qCountInput = document.getElementById("comp-score-q-count");
    const modeSelect = document.getElementById("comp-score-apply-mode");
    if (!container) return;

    if (nameEl) nameEl.innerText = (currentLightboxGallery.studentName || "Học sinh").toUpperCase();
    const totalQ = currentLightboxGallery.currentQuestionCount || (typeof detectExamQuestionCount === 'function' ? detectExamQuestionCount() : 30);
    if (qCountInput) qCountInput.value = totalQ;

    // Đánh dấu nút chọn nhanh tương ứng
    document.querySelectorAll(".btn-quick-count-pill").forEach(b => b.classList.toggle("active", b.id === `btn-count-${totalQ}`));

    if (modeSelect && !modeSelect.dataset.hasListener) {
        modeSelect.dataset.hasListener = "true";
        modeSelect.addEventListener("change", () => updateComponentScoreTotals());
    }

    const sbd = currentLightboxGallery.studentSbd; 
    const qId = currentTuLuanModalData.quizId;
    const record = currentTuLuanModalData.submissionsMap[sbd] || {};

    let savedDetails = {}; 
    const draftKey = `draft_comp_score_${qId}_${sbd}`; 
    const draftRaw = sessionStorage.getItem(draftKey);
    if (draftRaw) { 
        try { savedDetails = JSON.parse(draftRaw); } catch(e) {} 
    } else { 
        savedDetails = record.detailScores || currentLightboxGallery.componentScores || {}; 
    }
    currentLightboxGallery.componentScores = { ...savedDetails };

    let html = "";
    for (let i = 1; i <= totalQ; i++) {
        const val = (savedDetails[i] !== undefined && savedDetails[i] !== null) ? savedDetails[i] : "";
        html += `
            <div class="comp-score-cell-box">
                <input type="text" class="comp-score-cell-input" id="comp-q-${i}" value="${val}" placeholder="" oninput="onComponentCellInput(${i}, this.value)" onkeydown="onComponentCellKeyDown(event, ${i}, ${totalQ})">
            </div>
        `;
    }
    container.innerHTML = html; 
    updateComponentScoreTotals();

    // Tự động focus vào ô trống đầu tiên
    setTimeout(() => {
        for (let i = 1; i <= totalQ; i++) {
            const input = document.getElementById(`comp-q-${i}`);
            if (input && input.value === "") { input.focus(); break; }
        }
    }, 80);
}

function onComponentCellInput(qIdx, val) {
    let cleanVal = String(val).trim().replace(',', '.');
    if (cleanVal === "") { 
        delete currentLightboxGallery.componentScores[qIdx]; 
    } else { 
        let num = parseFloat(cleanVal); 
        if (!isNaN(num)) currentLightboxGallery.componentScores[qIdx] = num; 
    }
    
    updateComponentScoreTotals();

    const sbd = currentLightboxGallery.studentSbd; 
    const qId = currentTuLuanModalData.quizId;
    if (sbd && qId) sessionStorage.setItem(`draft_comp_score_${qId}_${sbd}`, JSON.stringify(currentLightboxGallery.componentScores));
}

function onComponentCellKeyDown(event, currentIdx, totalQ) {
    if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const nextIdx = currentIdx + 1;
        if (nextIdx <= totalQ) {
            const nextInput = document.getElementById(`comp-q-${nextIdx}`);
            if (nextInput) nextInput.focus();
        }
    }
}

// CẬP NHẬT TỔNG ĐIỂM VÀ ĐƯA RA BẢNG NGOÀI
function updateComponentScoreTotals() {
    const scores = currentLightboxGallery.componentScores || {}; 
    const totalQ = currentLightboxGallery.currentQuestionCount || 30;
    let sum = 0; 
    let hasAnyScore = false;

    for (let k in scores) { 
        const n = parseFloat(scores[k]); 
        if (!isNaN(n)) {
            sum += n; 
            hasAnyScore = true;
        }
    }
    sum = Math.round(sum * 100) / 100; 
    let scale10 = (totalQ > 0) ? Math.round(((sum / totalQ) * 10) * 100) / 100 : sum; 
    if (scale10 > 10.0) scale10 = 10.0;

    const totalEl = document.getElementById("comp-score-total-sum"); 
    const scale10El = document.getElementById("comp-score-scale10-val");
    if (totalEl) totalEl.innerText = sum; 
    if (scale10El) scale10El.innerText = scale10;

    const sbd = currentLightboxGallery.studentSbd;
    const qId = currentTuLuanModalData.quizId;
    const mode = document.getElementById("comp-score-apply-mode")?.value || "scale10";
    const finalScore = (mode === "scale10") ? scale10 : sum;

    if (sbd) {
        const scoreInput = document.getElementById(`cross-score-${sbd}`);
        if (scoreInput) {
            scoreInput.value = hasAnyScore ? finalScore : "";
            scoreInput.title = `🎯 Điểm TP: ${finalScore}đ\n(Đang tự động cập nhật)`;
        }

        if (!currentTuLuanModalData.submissionsMap[sbd]) {
            const driveClassName = typeof getCleanDriveClassName === 'function' ? getCleanDriveClassName(currentTuLuanModalData.classId) : currentTuLuanModalData.classId;
            currentTuLuanModalData.submissionsMap[sbd] = {
                sbd: sbd,
                studentName: currentLightboxGallery.studentName,
                className: driveClassName,
                count: 0,
                images: [],
                crossScore: hasAnyScore ? finalScore : "",
                detailScores: { ...currentLightboxGallery.componentScores },
                questionCount: totalQ
            };
        } else {
            currentTuLuanModalData.submissionsMap[sbd].crossScore = hasAnyScore ? finalScore : "";
            currentTuLuanModalData.submissionsMap[sbd].detailScores = { ...currentLightboxGallery.componentScores };
            currentTuLuanModalData.submissionsMap[sbd].questionCount = totalQ;
        }

        updateCrossScoreInputStyles();

        if (qId && hasAnyScore) {
            triggerAutoSaveComponentScore(sbd, qId, finalScore);
        }
    }
}

function triggerAutoSaveComponentScore(sbd, qId, finalScore) {
    if (_compScoreAutoSaveTimer) clearTimeout(_compScoreAutoSaveTimer);
    _compScoreAutoSaveTimer = setTimeout(async () => {
        await persistComponentScoreData(sbd, qId, finalScore, false);
    }, 600);
}

async function persistComponentScoreData(sbd, qId, finalScore, showAlert = false) {
    if (!sbd || !qId) return;

    const driveClassName = typeof getCleanDriveClassName === 'function' ? getCleanDriveClassName(currentTuLuanModalData.classId) : currentTuLuanModalData.classId;
    const graderInfo = typeof getCurrentGraderInfo === 'function' ? getCurrentGraderInfo() : { name: "Giáo viên", sbd: "ADMIN" };
    const graderDisplay = graderInfo.sbd && graderInfo.sbd !== "ADMIN" ? `${graderInfo.name} (${graderInfo.sbd})` : graderInfo.name;
    const now = new Date(); 
    const pad = n => String(n).padStart(2, '0'); 
    const scoreTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    // Lưu LocalStorage
    try {
        const localKey = `tuluan_scores_${qId}`;
        const rawLocal = localStorage.getItem(localKey);
        const map = rawLocal ? JSON.parse(rawLocal) : {};
        map[sbd] = {
            crossScore: finalScore,
            detailScores: { ...currentLightboxGallery.componentScores },
            questionCount: currentLightboxGallery.currentQuestionCount,
            grader: graderDisplay,
            time: scoreTimeStr,
            studentName: currentLightboxGallery.studentName,
            updatedAt: Date.now()
        };
        localStorage.setItem(localKey, JSON.stringify(map));
    } catch(e) {}

    if (currentTuLuanModalData.submissionsMap[sbd]) {
        currentTuLuanModalData.submissionsMap[sbd].crossScore = finalScore;
        currentTuLuanModalData.submissionsMap[sbd].crossScoreBy = graderDisplay;
        currentTuLuanModalData.submissionsMap[sbd].crossScoreTime = scoreTimeStr;
        currentTuLuanModalData.submissionsMap[sbd].detailScores = { ...currentLightboxGallery.componentScores };
        currentTuLuanModalData.submissionsMap[sbd].questionCount = currentLightboxGallery.currentQuestionCount;
    }

    // Lưu Supabase
    try {
        const client = typeof getDbClient === 'function' ? getDbClient() : null;
        if (client) {
            try {
                const { data: existMeta } = await client.from('app_key_values').select('value').eq('key', 'detail_scores_' + qId).single();
                const allCompScores = (existMeta && existMeta.value && typeof existMeta.value === 'object') ? existMeta.value : {};
                allCompScores[sbd] = { 
                    detailScores: currentLightboxGallery.componentScores, 
                    questionCount: currentLightboxGallery.currentQuestionCount, 
                    crossScore: finalScore, 
                    crossScoreBy: graderDisplay, 
                    crossScoreTime: scoreTimeStr, 
                    studentName: currentLightboxGallery.studentName,
                    updatedAt: Date.now() 
                };
                await client.from('app_key_values').upsert({ key: 'detail_scores_' + qId, value: allCompScores });
            } catch(metaErr) {}

            try {
                const { data: updatedRows } = await client.from('tu_luan_submissions')
                    .update({ 
                        cross_score: String(finalScore), 
                        cross_score_by: graderDisplay, 
                        cross_score_time: scoreTimeStr 
                    })
                    .eq('quiz_id', qId)
                    .eq('sbd', sbd)
                    .select();

                if (!updatedRows || updatedRows.length === 0) {
                    await client.from('tu_luan_submissions').insert([{
                        quiz_id: qId,
                        sbd: sbd,
                        student_name: currentLightboxGallery.studentName,
                        class_name: driveClassName,
                        exam_title: currentTuLuanModalData.examTitle || "Tự luận",
                        cross_score: String(finalScore),
                        cross_score_by: graderDisplay,
                        cross_score_time: scoreTimeStr,
                        images: [],
                        count: 0
                    }]);
                }
            } catch(subErr) {}
        }

        const scoreInput = document.getElementById(`cross-score-${sbd}`);
        if (scoreInput) { 
            scoreInput.value = finalScore; 
            scoreInput.title = `🎯 Điểm TP: ${finalScore}đ\n👤 Người chấm: ${graderDisplay}\n🕒 Lúc: ${scoreTimeStr}`; 
        }

        updateCrossScoreInputStyles();

        if (showAlert) {
            closeComponentScorePopover();
            alert(`✅ ĐÃ LƯU ĐIỂM THÀNH PHẦN THÀNH CÔNG!\n\n- Học sinh: ${currentLightboxGallery.studentName}\n- Điểm đưa ra bảng: ${finalScore} điểm\n- Người chấm: ${graderDisplay}`);
        }
    } catch(err) {
        if (showAlert) alert("❌ Lỗi lưu điểm thành phần: " + err.message);
    }
}

async function saveComponentScoresAction(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const sbd = currentLightboxGallery.studentSbd; 
    const qId = currentTuLuanModalData.quizId;
    if (!sbd || !qId) return;

    const mode = document.getElementById("comp-score-apply-mode")?.value || "scale10";
    const totalSum = parseFloat(document.getElementById("comp-score-total-sum")?.innerText || 0);
    const scale10 = parseFloat(document.getElementById("comp-score-scale10-val")?.innerText || 0);
    const finalScore = (mode === "scale10") ? scale10 : totalSum;

    await persistComponentScoreData(sbd, qId, finalScore, true);
}

async function saveStudentCrossScore(cleanSbd, stt, sbd, studentName, scoreVal) {
    const qId = currentTuLuanModalData.quizId; if (!qId) return;
    const trimmedScore = String(scoreVal || "").trim(); 
    const driveClassName = typeof getCleanDriveClassName === 'function' ? getCleanDriveClassName(currentTuLuanModalData.classId) : currentTuLuanModalData.classId;
    let graderDisplay = ""; 
    let scoreTimeStr = "";

    if (trimmedScore !== "") {
        const graderInfo = typeof getCurrentGraderInfo === 'function' ? getCurrentGraderInfo() : { name: "Giáo viên", sbd: "ADMIN" };
        graderDisplay = graderInfo.sbd && graderInfo.sbd !== "ADMIN" ? `${graderInfo.name} (${graderInfo.sbd})` : graderInfo.name;
        const now = new Date(); 
        const pad = n => String(n).padStart(2, '0'); 
        scoreTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    }

    try {
        const localKey = `tuluan_scores_${qId}`;
        const rawLocal = localStorage.getItem(localKey);
        const map = rawLocal ? JSON.parse(rawLocal) : {};
        if (!map[cleanSbd]) map[cleanSbd] = {};
        map[cleanSbd].crossScore = trimmedScore;
        map[cleanSbd].grader = graderDisplay;
        map[cleanSbd].time = scoreTimeStr;
        map[cleanSbd].studentName = studentName;
        localStorage.setItem(localKey, JSON.stringify(map));
    } catch(e) {}

    if (!currentTuLuanModalData.submissionsMap[cleanSbd]) {
        currentTuLuanModalData.submissionsMap[cleanSbd] = { stt: stt, sbd: sbd, studentName: studentName, className: driveClassName, count: 0, images: [], crossScore: trimmedScore, crossScoreBy: graderDisplay, crossScoreTime: scoreTimeStr };
    } else { 
        currentTuLuanModalData.submissionsMap[cleanSbd].crossScore = trimmedScore; 
        currentTuLuanModalData.submissionsMap[cleanSbd].crossScoreBy = graderDisplay; 
        currentTuLuanModalData.submissionsMap[cleanSbd].crossScoreTime = scoreTimeStr; 
    }

    try {
        const client = typeof getDbClient === 'function' ? getDbClient() : null;
        if (client) {
            const { data: upRows } = await client.from('tu_luan_submissions')
                .update({ 
                    cross_score: trimmedScore, 
                    cross_score_by: graderDisplay, 
                    cross_score_time: scoreTimeStr 
                })
                .eq('quiz_id', qId)
                .eq('sbd', cleanSbd)
                .select();

            if (!upRows || upRows.length === 0) {
                await client.from('tu_luan_submissions').insert([{
                    quiz_id: qId,
                    sbd: cleanSbd,
                    stt: String(stt || "00"),
                    student_name: studentName,
                    class_name: driveClassName,
                    exam_title: currentTuLuanModalData.examTitle || "Tự luận",
                    cross_score: trimmedScore,
                    cross_score_by: graderDisplay,
                    cross_score_time: scoreTimeStr,
                    images: [],
                    count: 0
                }]);
            }
        }
        const scoreInput = document.getElementById(`cross-score-${cleanSbd}`);
        if (scoreInput) { 
            if (trimmedScore !== "") { 
                scoreInput.title = `🎯 Điểm: ${trimmedScore}đ\n👤 Người chấm: ${graderDisplay}\n🕒 Lúc: ${scoreTimeStr}`; 
            } else { 
                scoreInput.title = "Nhập điểm chấm chéo"; 
            } 
        }
        updateCrossScoreInputStyles();
    } catch(err) { 
        console.error("Lỗi lưu điểm chấm chéo Supabase:", err); 
    }
}

window.onThumbnailItemClicked = onThumbnailItemClicked;
window.updateLightboxView = updateLightboxView;
window.navigateLightbox = navigateLightbox;
window.jumpToLightboxPage = jumpToLightboxPage;
window.openTuLuanLightbox = openTuLuanLightbox;
window.closeTuLuanLightbox = closeTuLuanLightbox;
window.toggleComponentScorePopover = toggleComponentScorePopover;
window.closeComponentScorePopover = closeComponentScorePopover;
window.setQuickQuestionCount = setQuickQuestionCount;
window.onComponentQuestionCountChanged = onComponentQuestionCountChanged;
window.onComponentCellInput = onComponentCellInput;
window.onComponentCellKeyDown = onComponentCellKeyDown;
window.saveComponentScoresAction = saveComponentScoresAction;
window.saveStudentCrossScore = saveStudentCrossScore;
window.persistComponentScoreData = persistComponentScoreData;
window.triggerAutoSaveComponentScore = triggerAutoSaveComponentScore;
