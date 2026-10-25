// =========================================================
// FILE: portal-tuluan-lightbox.js
// QUẢN LÝ XEM ẢNH ZOOM 2 NGÓN TAY & CHẤM ĐIỂM THÀNH PHẦN (AUTO FOCUS)
// =========================================================

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
    currentLightboxGallery.currentQuestionCount = record.questionCount || (typeof detectExamQuestionCount === 'function' ? detectExamQuestionCount() : 40);
    
    // ĐỌC BẢN NHÁP TỪ CACHE KHI VỪA MỞ LẠI HỌC SINH NÀY
    const qId = currentTuLuanModalData.quizId;
    const draftKey = `draft_comp_score_${qId}_${cleanSbd}`;
    const draftRaw = sessionStorage.getItem(draftKey);
    if (draftRaw) {
        try { currentLightboxGallery.componentScores = JSON.parse(draftRaw); } 
        catch(e) { currentLightboxGallery.componentScores = record.detailScores ? { ...record.detailScores } : {}; }
    } else {
        currentLightboxGallery.componentScores = record.detailScores ? { ...record.detailScores } : {};
    }

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
    currentLightboxGallery.currentQuestionCount = (typeof detectExamQuestionCount === 'function') ? detectExamQuestionCount() : 40;
    currentLightboxGallery.componentScores = {};

    resetLightboxZoom(false); updateLightboxView();
    const lb = document.getElementById("tuluan-lightbox"); if (lb) lb.style.display = "flex";
}

function closeTuLuanLightbox(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const lb = document.getElementById("tuluan-lightbox"); if (lb) lb.style.display = "none";
    closeComponentScorePopover(); resetLightboxZoom(false);
}

// BỘ ĐIỀU HƯỚNG PINCH-TO-ZOOM 2 NGÓN TAY VÀ PAN KÉO RÊ
function setupLightboxTouchAndZoom() {
    const area = document.getElementById("lightbox-touch-area");
    if (!area) return;

    function getDistance(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }

    area.addEventListener("touchstart", function(e) {
        if (!e.touches) return;
        if (e.touches.length === 2) {
            lightboxZoomState.initialDistance = getDistance(e.touches[0], e.touches[1]);
            lightboxZoomState.initialScale = lightboxZoomState.scale;
            lightboxZoomState.isDragging = false;
        } else if (e.touches.length === 1) {
            const touch = e.touches[0]; const now = Date.now();
            if (now - lightboxZoomState.lastTapTime < 280) {
                if (lightboxZoomState.scale > 1.1) resetLightboxZoom(true);
                else { lightboxZoomState.scale = 2.4; lightboxZoomState.posX = 0; lightboxZoomState.posY = 0; applyImageTransform(true); }
                lightboxZoomState.lastTapTime = 0; return;
            }
            lightboxZoomState.lastTapTime = now;
            if (lightboxZoomState.scale > 1.05) { lightboxZoomState.isDragging = true; lightboxZoomState.startX = touch.clientX - lightboxZoomState.posX; lightboxZoomState.startY = touch.clientY - lightboxZoomState.posY; } 
            else { lightboxZoomState.swipeStartX = touch.clientX; lightboxZoomState.swipeStartY = touch.clientY; lightboxZoomState.isDragging = false; }
        }
    }, { passive: false });

    area.addEventListener("touchmove", function(e) {
        if (!e.touches) return;
        if (e.touches.length === 2 && lightboxZoomState.initialDistance > 0) {
            e.preventDefault();
            const factor = getDistance(e.touches[0], e.touches[1]) / lightboxZoomState.initialDistance;
            let newScale = Math.min(Math.max(1, lightboxZoomState.initialScale * factor), 5);
            lightboxZoomState.scale = newScale;
            if (newScale === 1) { lightboxZoomState.posX = 0; lightboxZoomState.posY = 0; }
            applyImageTransform(false);
        } else if (e.touches.length === 1 && lightboxZoomState.isDragging && lightboxZoomState.scale > 1.05) {
            e.preventDefault();
            lightboxZoomState.posX = e.touches[0].clientX - lightboxZoomState.startX;
            lightboxZoomState.posY = e.touches[0].clientY - lightboxZoomState.startY;
            applyImageTransform(false);
        }
    }, { passive: false });

    area.addEventListener("touchend", function(e) {
        if (e.touches && e.touches.length === 1) {
            lightboxZoomState.startX = e.touches[0].clientX - lightboxZoomState.posX;
            lightboxZoomState.startY = e.touches[0].clientY - lightboxZoomState.posY;
            lightboxZoomState.isDragging = (lightboxZoomState.scale > 1.05);
            return;
        }
        if (!e.touches || e.touches.length === 0) {
            lightboxZoomState.isDragging = false; lightboxZoomState.initialDistance = 0;
            if (lightboxZoomState.scale <= 1.05 && e.changedTouches && e.changedTouches.length > 0) {
                const diffX = e.changedTouches[0].clientX - lightboxZoomState.swipeStartX;
                const diffY = e.changedTouches[0].clientY - lightboxZoomState.swipeStartY;
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 38) { if (diffX < 0) navigateLightbox(1); else navigateLightbox(-1); }
            }
        }
    }, { passive: true });

    area.addEventListener("wheel", function(e) { e.preventDefault(); zoomLightboxStep(e.deltaY < 0 ? 0.25 : -0.25); }, { passive: false });

    let isMouseDown = false;
    area.addEventListener("mousedown", function(e) { if (lightboxZoomState.scale > 1.05) { isMouseDown = true; lightboxZoomState.startX = e.clientX - lightboxZoomState.posX; lightboxZoomState.startY = e.clientY - lightboxZoomState.posY; } });
    window.addEventListener("mousemove", function(e) { if (isMouseDown && lightboxZoomState.scale > 1.05) { lightboxZoomState.posX = e.clientX - lightboxZoomState.startX; lightboxZoomState.posY = e.clientY - lightboxZoomState.startY; applyImageTransform(false); } });
    window.addEventListener("mouseup", function() { isMouseDown = false; });
    document.addEventListener("keydown", function(e) {
        const lb = document.getElementById("tuluan-lightbox");
        if (lb && lb.style.display === "flex") { if (e.key === "ArrowLeft") navigateLightbox(-1); else if (e.key === "ArrowRight") navigateLightbox(1); else if (e.key === "Escape") closeTuLuanLightbox(); }
    });
}

function applyImageTransform(smooth = false) {
    const img = document.getElementById("lightbox-full-img"); const area = document.getElementById("lightbox-touch-area"); const resetBtn = document.getElementById("btn-zoom-reset");
    if (!img) return;
    img.style.transition = smooth ? "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)" : "none";
    img.style.transform = `translate3d(${lightboxZoomState.posX}px, ${lightboxZoomState.posY}px, 0) scale(${lightboxZoomState.scale})`;
    if (area) area.classList.toggle("is-zoomed", lightboxZoomState.scale > 1.05);
    if (resetBtn) {
        const roundScale = Math.round(lightboxZoomState.scale * 10) / 10;
        resetBtn.innerText = roundScale > 1 ? `↺ ${roundScale}x` : `↺ 1x`;
        resetBtn.style.color = roundScale > 1 ? "#38bdf8" : "#ffffff";
    }
}

function resetLightboxZoom(smooth = false, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    lightboxZoomState.scale = 1; lightboxZoomState.posX = 0; lightboxZoomState.posY = 0; applyImageTransform(smooth);
}

function zoomLightboxStep(step, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    let newScale = Math.min(Math.max(1, lightboxZoomState.scale + step), 5);
    lightboxZoomState.scale = Math.round(newScale * 100) / 100;
    if (lightboxZoomState.scale <= 1.02) { lightboxZoomState.scale = 1; lightboxZoomState.posX = 0; lightboxZoomState.posY = 0; }
    applyImageTransform(true);
}

// =========================================================
// LOGIC BẢNG ĐIỂM THÀNH PHẦN TỪNG CÂU VÀ AUTO-FOCUS
// =========================================================
function toggleComponentScorePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("component-score-popover"); if (!pop) return;
    if (!pop.classList.contains("show")) { pop.classList.add("show"); renderComponentScoreGrid(); } else { pop.classList.remove("show"); }
}
function closeComponentScorePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("component-score-popover"); if (pop) pop.classList.remove("show");
}

function setQuickQuestionCount(num) { const input = document.getElementById("comp-score-q-count"); if (input) input.value = num; onComponentQuestionCountChanged(num); }
function onComponentQuestionCountChanged(val) {
    let count = parseInt(val, 10); if (isNaN(count) || count < 1) count = 40; if (count > 120) count = 120;
    currentLightboxGallery.currentQuestionCount = count; renderComponentScoreGrid();
}

function renderComponentScoreGrid() {
    const container = document.getElementById("comp-score-grid-container"); const nameEl = document.getElementById("comp-score-st-name"); const qCountInput = document.getElementById("comp-score-q-count");
    if (!container) return;

    if (nameEl) nameEl.innerText = currentLightboxGallery.studentName || "Học sinh";
    const totalQ = currentLightboxGallery.currentQuestionCount || (typeof detectExamQuestionCount === 'function' ? detectExamQuestionCount() : 40);
    if (qCountInput) qCountInput.value = totalQ;

    const sbd = currentLightboxGallery.studentSbd; const qId = currentTuLuanModalData.quizId;
    const record = currentTuLuanModalData.submissionsMap[sbd] || {};

    let savedDetails = {}; const draftKey = `draft_comp_score_${qId}_${sbd}`; const draftRaw = sessionStorage.getItem(draftKey);
    if (draftRaw) { try { savedDetails = JSON.parse(draftRaw); } catch(e) {} } else { savedDetails = record.detailScores || currentLightboxGallery.componentScores || {}; }
    currentLightboxGallery.componentScores = { ...savedDetails };

    let html = "";
    for (let i = 1; i <= totalQ; i++) {
        const val = (savedDetails[i] !== undefined && savedDetails[i] !== null) ? savedDetails[i] : "";
        html += `<div class="comp-score-cell-box"><input type="text" class="comp-score-cell-input" id="comp-q-${i}" value="${val}" placeholder="C${i}" oninput="onComponentCellInput(${i}, this.value)" onkeydown="onComponentCellKeyDown(event, ${i}, ${totalQ})"></div>`;
    }
    container.innerHTML = html; updateComponentScoreTotals();

    // AUTO-FOCUS VÀO Ô TRỐNG ĐẦU TIÊN KHI MỞ BẢNG LÊN
    setTimeout(() => {
        for (let i = 1; i <= totalQ; i++) {
            const input = document.getElementById(`comp-q-${i}`);
            if (input && input.value === "") { input.focus(); break; }
        }
    }, 100);
}

function onComponentCellInput(qIdx, val) {
    let cleanVal = String(val).trim().replace(',', '.');
    if (cleanVal === "") { delete currentLightboxGallery.componentScores[qIdx]; } else { let num = parseFloat(cleanVal); if (!isNaN(num)) currentLightboxGallery.componentScores[qIdx] = num; }
    updateComponentScoreTotals();

    // LƯU NHÁP TỰ ĐỘNG VÀO BỘ NHỚ TRÌNH DUYỆT (CHỐNG MẤT DỮ LIỆU KHI TẮT BẢNG)
    const sbd = currentLightboxGallery.studentSbd; const qId = currentTuLuanModalData.quizId;
    if (sbd && qId) sessionStorage.setItem(`draft_comp_score_${qId}_${sbd}`, JSON.stringify(currentLightboxGallery.componentScores));
}

function onComponentCellKeyDown(event, currentIdx, totalQ) {
    if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault(); const nextIdx = currentIdx + 1;
        if (nextIdx <= totalQ) { const nextInput = document.getElementById(`comp-q-${nextIdx}`); if (nextInput) nextInput.focus(); }
    }
}

function updateComponentScoreTotals() {
    const scores = currentLightboxGallery.componentScores || {}; const totalQ = currentLightboxGallery.currentQuestionCount || 40;
    let sum = 0; for (let k in scores) { const n = parseFloat(scores[k]); if (!isNaN(n)) sum += n; }
    sum = Math.round(sum * 100) / 100; let scale10 = (totalQ > 0) ? Math.round(((sum / totalQ) * 10) * 100) / 100 : sum; if (scale10 > 10.0) scale10 = 10.0;
    const totalEl = document.getElementById("comp-score-total-sum"); const scale10El = document.getElementById("comp-score-scale10-val");
    if (totalEl) totalEl.innerText = sum; if (scale10El) scale10El.innerText = scale10;
}

async function saveComponentScoresAction(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const sbd = currentLightboxGallery.studentSbd; const qId = currentTuLuanModalData.quizId;
    if (!sbd || !qId) return;

    const mode = document.getElementById("comp-score-apply-mode")?.value || "scale10";
    const totalSum = parseFloat(document.getElementById("comp-score-total-sum")?.innerText || 0);
    const scale10 = parseFloat(document.getElementById("comp-score-scale10-val")?.innerText || 0);
    const finalScore = (mode === "scale10") ? scale10 : totalSum;
    const driveClassName = typeof getCleanDriveClassName === 'function' ? getCleanDriveClassName(currentTuLuanModalData.classId) : currentTuLuanModalData.classId;
    const graderInfo = typeof getCurrentGraderInfo === 'function' ? getCurrentGraderInfo() : { name: "Giáo viên", sbd: "ADMIN" };
    const graderDisplay = graderInfo.sbd && graderInfo.sbd !== "ADMIN" ? `${graderInfo.name} (${graderInfo.sbd})` : graderInfo.name;
    const now = new Date(); const pad = n => String(n).padStart(2, '0'); const scoreTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    if (!currentTuLuanModalData.submissionsMap[sbd]) {
        currentTuLuanModalData.submissionsMap[sbd] = { sbd: sbd, studentName: currentLightboxGallery.studentName, className: driveClassName, count: 0, images: [], crossScore: finalScore, crossScoreBy: graderDisplay, crossScoreTime: scoreTimeStr, detailScores: currentLightboxGallery.componentScores, questionCount: currentLightboxGallery.currentQuestionCount };
    } else {
        currentTuLuanModalData.submissionsMap[sbd].crossScore = finalScore; currentTuLuanModalData.submissionsMap[sbd].crossScoreBy = graderDisplay; currentTuLuanModalData.submissionsMap[sbd].crossScoreTime = scoreTimeStr; currentTuLuanModalData.submissionsMap[sbd].detailScores = currentLightboxGallery.componentScores; currentTuLuanModalData.submissionsMap[sbd].questionCount = currentLightboxGallery.currentQuestionCount;
    }

    try {
        const client = typeof getDbClient === 'function' ? getDbClient() : null;
        if (client) {
            await client.from('tu_luan_submissions').upsert({ quiz_id: qId, sbd: sbd, student_name: currentLightboxGallery.studentName, class_name: driveClassName, exam_title: currentTuLuanModalData.examTitle || "Tự luận", cross_score: String(finalScore), cross_score_by: graderDisplay, cross_score_time: scoreTimeStr, detail_scores: currentLightboxGallery.componentScores }, { onConflict: 'quiz_id,sbd' });
            try {
                const { data: existMeta } = await client.from('app_key_values').select('value').eq('key', 'detail_scores_' + qId).single();
                const allCompScores = (existMeta && existMeta.value && typeof existMeta.value === 'object') ? existMeta.value : {};
                allCompScores[sbd] = { detailScores: currentLightboxGallery.componentScores, questionCount: currentLightboxGallery.currentQuestionCount, crossScore: finalScore, crossScoreBy: graderDisplay, crossScoreTime: scoreTimeStr, updatedAt: Date.now() };
                await client.from('app_key_values').upsert({ key: 'detail_scores_' + qId, value: allCompScores });
            } catch(metaErr) {}
        }
        const scoreInput = document.getElementById(`cross-score-${sbd}`);
        if (scoreInput) { scoreInput.value = finalScore; scoreInput.title = `🎯 Điểm TP: ${finalScore}đ\n👤 Người chấm: ${graderDisplay}\n🕒 Lúc: ${scoreTimeStr}`; scoreInput.style.borderColor = "#10b981"; setTimeout(() => { scoreInput.style.borderColor = "#cbd5e1"; }, 1500); }

        // XOÁ CACHE NHÁP SAU KHI LƯU THÀNH CÔNG VÀO DB
        sessionStorage.removeItem(`draft_comp_score_${qId}_${sbd}`);
        closeComponentScorePopover();
        alert(`✅ ĐÃ LƯU ĐIỂM THÀNH PHẦN THÀNH CÔNG!\n\n- Học sinh: ${currentLightboxGallery.studentName}\n- Điểm đưa ra bảng: ${finalScore} điểm\n- Người chấm: ${graderDisplay}`);
    } catch(err) { alert("❌ Lỗi lưu điểm thành phần: " + err.message); }
}

async function saveStudentCrossScore(cleanSbd, stt, sbd, studentName, scoreVal) {
    const qId = currentTuLuanModalData.quizId; if (!qId) return;
    const trimmedScore = String(scoreVal || "").trim(); const driveClassName = typeof getCleanDriveClassName === 'function' ? getCleanDriveClassName(currentTuLuanModalData.classId) : currentTuLuanModalData.classId;
    let graderDisplay = ""; let scoreTimeStr = "";
    if (trimmedScore !== "") {
        const graderInfo = typeof getCurrentGraderInfo === 'function' ? getCurrentGraderInfo() : { name: "Giáo viên", sbd: "ADMIN" };
        graderDisplay = graderInfo.sbd && graderInfo.sbd !== "ADMIN" ? `${graderInfo.name} (${graderInfo.sbd})` : graderInfo.name;
        const now = new Date(); const pad = n => String(n).padStart(2, '0'); scoreTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    }

    if (!currentTuLuanModalData.submissionsMap[cleanSbd]) {
        currentTuLuanModalData.submissionsMap[cleanSbd] = { stt: stt, sbd: sbd, studentName: studentName, className: driveClassName, count: 0, images: [], crossScore: trimmedScore, crossScoreBy: graderDisplay, crossScoreTime: scoreTimeStr };
    } else { currentTuLuanModalData.submissionsMap[cleanSbd].crossScore = trimmedScore; currentTuLuanModalData.submissionsMap[cleanSbd].crossScoreBy = graderDisplay; currentTuLuanModalData.submissionsMap[cleanSbd].crossScoreTime = scoreTimeStr; }

    try {
        const client = typeof getDbClient === 'function' ? getDbClient() : null;
        if (client) await client.from('tu_luan_submissions').upsert({ quiz_id: qId, sbd: cleanSbd, stt: String(stt || "00"), student_name: studentName, class_name: driveClassName, exam_title: currentTuLuanModalData.examTitle || "Tự luận", cross_score: trimmedScore, cross_score_by: graderDisplay, cross_score_time: scoreTimeStr }, { onConflict: 'quiz_id,sbd' });
        const scoreInput = document.getElementById(`cross-score-${cleanSbd}`);
        if (scoreInput) { scoreInput.style.borderColor = "#10b981"; if (trimmedScore !== "") { scoreInput.title = `🎯 Điểm: ${trimmedScore}đ\n👤 Người chấm: ${graderDisplay}\n🕒 Lúc: ${scoreTimeStr}`; } else { scoreInput.title = "Nhập điểm chấm chéo"; } setTimeout(() => { scoreInput.style.borderColor = "#cbd5e1"; }, 1500); }
    } catch(err) { console.error("Lỗi lưu điểm chấm chéo Supabase:", err); }
}

window.onThumbnailItemClicked = onThumbnailItemClicked;
window.updateLightboxView = updateLightboxView;
window.navigateLightbox = navigateLightbox;
window.jumpToLightboxPage = jumpToLightboxPage;
window.openTuLuanLightbox = openTuLuanLightbox;
window.closeTuLuanLightbox = closeTuLuanLightbox;
window.resetLightboxZoom = resetLightboxZoom;
window.zoomLightboxStep = zoomLightboxStep;
window.toggleComponentScorePopover = toggleComponentScorePopover;
window.closeComponentScorePopover = closeComponentScorePopover;
window.setQuickQuestionCount = setQuickQuestionCount;
window.onComponentQuestionCountChanged = onComponentQuestionCountChanged;
window.onComponentCellInput = onComponentCellInput;
window.onComponentCellKeyDown = onComponentCellKeyDown;
window.saveComponentScoresAction = saveComponentScoresAction;
window.saveStudentCrossScore = saveStudentCrossScore;