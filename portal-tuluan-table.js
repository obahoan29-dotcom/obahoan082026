// =========================================================
// FILE: portal-tuluan-table.js
// QUẢN LÝ BẢNG DANH SÁCH, PHÊ DUYỆT, NHẬN XÉT, MẬT KHẨU & EXCEL
// =========================================================
function renderTuLuanStudentsTable() {
const tbody = document.getElementById("tuluan-students-tbody");
if (!tbody) return;
tbody.innerHTML = "";
code
Code
const students = getAccountsForCategory(currentTuLuanModalData.classId);
const searchVal = (document.getElementById("tuluan-search-student")?.value || "").trim().toLowerCase();
const subMap = currentTuLuanModalData.submissionsMap || {};
const isAdmin = checkCurrentIsAdmin();

const loggedStudentSbd = (safeLocal.getItem("saved_student_sbd") || "").trim().toLowerCase();

let totalSt = students.length;
let submittedCount = 0;

students.forEach(st => {
    const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
    if (subMap[cleanSbd] && subMap[cleanSbd].images && subMap[cleanSbd].images.length > 0) {
        submittedCount++;
    }
});

const elTotal = document.getElementById("count-all-st");
const elSub = document.getElementById("count-sub-st");
const elPen = document.getElementById("count-pen-st");
if (elTotal) elTotal.innerText = totalSt;
if (elSub) elSub.innerText = submittedCount;
if (elPen) elPen.innerText = (totalSt - submittedCount);

students.forEach(st => {
    const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
    const record = subMap[cleanSbd];
    const hasSubmitted = Boolean(record && record.images && record.images.length > 0);
    const isApproved = Boolean(record && record.isApproved === true);

    if (currentTuLuanModalData.statusFilter === "submitted" && !hasSubmitted) return;
    if (currentTuLuanModalData.statusFilter === "pending" && hasSubmitted) return;

    if (searchVal) {
        const nameNorm = (typeof normalizeName === 'function') ? normalizeName(st.name) : st.name.toLowerCase();
        const sbdNorm = String(st.sbd || "").toLowerCase();
        if (!nameNorm.includes(searchVal) && !sbdNorm.includes(searchVal)) return;
    }

    const tr = document.createElement("tr");
    let statusHtml = `<span class="tuluan-status-badge pending">⏳ Chưa nộp</span>`;
    let thumbnailsHtml = `<span style="font-size:11px; color:#94a3b8; font-style:italic;">Chưa có ảnh</span>`;
    let approveHtml = "";

    if (!hasSubmitted) {
        approveHtml = `<span style="color:#cbd5e1; font-weight:700;">---</span>`;
    } else if (isAdmin) {
        approveHtml = `<label class="approve-switch-wrapper" title="Bật/Tắt duyệt bài cho học sinh này" onclick="event.stopPropagation()"><span class="mini-switch"><input type="checkbox" ${isApproved ? "checked" : ""} onchange="handleToggleApproveStudent('${cleanSbd}', this.checked)"><span class="slider-toggle" style="${isApproved ? 'background-color:#10b981;' : ''}"></span></span><b class="approve-text ${isApproved ? 'approved' : 'pending'}">${isApproved ? 'Đã duyệt' : 'Chưa duyệt'}</b></label>`;
    } else {
        approveHtml = isApproved ? `<span class="tuluan-approved-badge yes">✅ Đã duyệt</span>` : `<span class="tuluan-approved-badge no">⏳ Chưa duyệt</span>`;
    }

    const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;
    const isSessionAuthed = (safeSession.getItem(sessionAuthKey) === "true");
    const isOwner = Boolean((loggedStudentSbd && loggedStudentSbd === String(st.sbd).trim().toLowerCase()) || isSessionAuthed);

    if (hasSubmitted) {
        const imgCount = record.images.length;
        statusHtml = `<div class="tuluan-status-badge done">✅ Đã nộp ${imgCount} ảnh</div><div style="font-size: 10.5px; color: #64748b; font-weight: 700; margin-top: 1px;">🕒 ${record.lastSubmit || "Vừa xong"}</div>`;
        const canViewDetailed = (isAdmin || isApproved || isOwner);
        const canDeleteThisStudentImage = (isAdmin || isOwner);

        thumbnailsHtml = `<div class="tuluan-thumb-row">
            ${record.images.map((im, idx) => `
                <div class="tuluan-img-thumbnail-item ${!canViewDetailed ? 'locked-anti-cheat' : ''}" 
                     onclick="onThumbnailItemClicked('${cleanSbd}', ${idx}, ${canViewDetailed}, event)" 
                     title="${canViewDetailed ? `Bấm để xem ảnh & chấm bài (Trang ${idx + 1}/${record.images.length})` : '🔒 Bài làm đang chờ Thầy phê duyệt!'}">
                    <img src="${im.directUrl || im.fileUrl}" alt="Trang ${idx + 1}">
                    <span class="tuluan-thumb-page">Trang ${idx + 1}</span>
                    ${!canViewDetailed ? `<div class="lock-overlay-icon">🔒</div>` : ''}
                    ${canDeleteThisStudentImage ? `<button type="button" class="btn-del-single-thumb" onclick="deleteSingleStudentImage('${cleanSbd}', ${idx}, '${st.name}', '${st.pass}', event)" title="Xóa bức ảnh này">✕</button>` : ''}
                </div>
            `).join('')}
        </div>`;
    }

    const currentCrossScore = (record && record.crossScore !== undefined && record.crossScore !== null) ? record.crossScore : '';
    const crossScoreBy = (record && record.crossScoreBy) ? record.crossScoreBy : '';
    const crossScoreTime = (record && record.crossScoreTime) ? record.crossScoreTime : '';
    let scoreTooltip = currentCrossScore !== "" ? `🎯 Điểm chấm: ${currentCrossScore}đ\n👤 Người chấm: ${crossScoreBy || "Chưa rõ"}${crossScoreTime ? `\n🕒 Lúc: ${crossScoreTime}` : ""}` : (isAdmin ? "Thầy có thể sửa trực tiếp hoặc mở ảnh bấm Điểm TP" : "🔒 Học sinh mở ảnh bấm Điểm TP để chấm từng câu");

    const crossScoreHtml = isAdmin 
        ? `<input type="text" class="tuluan-score-input" id="cross-score-${cleanSbd}" value="${currentCrossScore}" placeholder="VD: 8.5" onchange="saveStudentCrossScore('${cleanSbd}', '${st.stt}', '${st.sbd}', '${st.name}', this.value)" title="${scoreTooltip}">`
        : `<input type="text" class="tuluan-score-input is-locked-for-student" id="cross-score-${cleanSbd}" value="${currentCrossScore}" placeholder="---" readonly onclick="alert('🔒 Để đảm bảo tính công bằng, học sinh không sửa trực tiếp ô này! Em hãy bấm vào ẢNH BÀI LÀM của bạn rồi ấn nút [📊 Điểm TP] để chấm từng câu nhé!')" title="${scoreTooltip}">`;

    const currentFeedback = (record && record.feedback) ? record.feedback : '';
    const hasFeedback = Boolean(currentFeedback && currentFeedback.trim() !== "");
    const feedbackHtml = `
        <div style="position: relative; display: inline-block;">
            <button type="button" class="btn-tuluan-comment ${hasFeedback ? 'active' : ''}" onclick="toggleStudentFeedbackPopover('${cleanSbd}', event)" title="${hasFeedback ? ('Nhận xét: ' + currentFeedback) : 'Bấm để viết nhận xét bài làm'}">${hasFeedback ? '💬 Đã có NX' : '💬 Nhận xét'}</button>
            <div class="student-feedback-popover" id="feedback-popover-${cleanSbd}" onclick="event.stopPropagation()">
                <div class="pass-popover-header"><span style="color:#b45309;">💬 Nhận Xét: <b>${st.name}</b></span><button type="button" class="btn-close-pass-pop" onclick="closeStudentFeedbackPopover('${cleanSbd}', event)">✕</button></div>
                <textarea id="feedback-textarea-${cleanSbd}" rows="4" class="feedback-textarea" placeholder="Nhập nhận xét chi tiết...">${currentFeedback}</textarea>
                <div class="pass-popover-actions">
                    <button type="button" class="btn-pass-cancel" onclick="closeStudentFeedbackPopover('${cleanSbd}', event)">Hủy</button>
                    <button type="button" class="btn-pass-save" style="background: linear-gradient(135deg, #d97706, #b45309);" onclick="saveStudentFeedback('${cleanSbd}', '${st.stt}', '${st.sbd}', '${st.name}', event)">💾 Lưu NX</button>
                </div>
            </div>
        </div>`;

    tr.innerHTML = `
        <td style="text-align: center; font-weight: 800; color: #475569;">${st.stt}</td>
        <td style="font-weight: 800; color: #0f172a;">${st.name}</td>
        <td style="text-align: center; font-weight: 800; color: #0284c7; font-family: monospace;">${st.sbd}</td>
        <td>${statusHtml}</td>
        <td style="text-align: center;">${approveHtml}</td>
        <td>${thumbnailsHtml}</td>
        <td style="text-align: center;">${crossScoreHtml}</td>
        <td style="text-align: center;">${feedbackHtml}</td>
        <td style="text-align: center; position: relative;">
            <div class="tuluan-action-btn-group">
                <input type="file" id="tuluan-input-${cleanSbd}" accept="image/*" multiple style="position:fixed; top:-9999px; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none; z-index:-1;" onchange="handleStudentEssayUploadPC('${st.stt}', '${st.sbd}', '${st.name}', this)">
                <button type="button" class="btn-tuluan-upload-row" onclick="triggerStudentUpload('${st.stt}', '${st.sbd}', '${st.name}', '${st.pass}')" id="btn-up-${cleanSbd}" title="Tải ảnh bài làm">📷 Tải ảnh</button>
                <button type="button" class="btn-tuluan-change-pass" onclick="toggleStudentPassPopover('${cleanSbd}', event)" title="Đổi mật khẩu nộp bài (4 số)">🔑 Đổi MK</button>
                ${isAdmin ? `<button type="button" class="btn-tuluan-reset-pass" onclick="resetStudentPasswordToDefault('${cleanSbd}', '${st.sbd}', '${st.name}', event)" title="[Admin] Reset mật khẩu (${st.sbd})">↺ Reset</button>` : ''}
            </div>
            <div class="student-pass-popover" id="pass-popover-${cleanSbd}" onclick="event.stopPropagation()">
                <div class="pass-popover-header"><span style="color:#0369a1;">🔑 Đổi Mật Khẩu: <b>${st.name}</b></span><button type="button" class="btn-close-pass-pop" onclick="closeStudentPassPopover('${cleanSbd}', event)">✕</button></div>
                <div class="pass-popover-hint">💡 Mật khẩu gồm đúng <b>4 chữ số</b>.<br>Mặc định ban đầu là Số báo danh (<b>${st.sbd}</b>).</div>
                <div class="pass-input-row"><label>Dòng 1: Mật khẩu cũ (hoặc SBD):</label><input type="password" id="old-pass-${cleanSbd}" placeholder="Nhập mật khẩu cũ..." autocomplete="off"></div>
                <div class="pass-input-row"><label>Dòng 2: Mật khẩu mới (4 số):</label><input type="password" id="new-pass-${cleanSbd}" placeholder="4 số, VD: 1234..." maxlength="4" pattern="[0-9]{4}" inputmode="numeric" autocomplete="new-password"></div>
                <div class="pass-popover-actions"><button type="button" class="btn-pass-cancel" onclick="closeStudentPassPopover('${cleanSbd}', event)">Hủy</button><button type="button" class="btn-pass-save" onclick="saveStudentPasswordChange('${cleanSbd}', '${st.sbd}', '${st.name}', '${st.pass}', event)">💾 Lưu MK</button></div>
            </div>
        </td>`;
    tbody.appendChild(tr);
});

if(typeof updateTuLuanAdminUI === 'function') updateTuLuanAdminUI();
}
function filterTuLuanStudentTable() { renderTuLuanStudentsTable(); }
function filterTuLuanStatus(filterType) {
currentTuLuanModalData.statusFilter = filterType;
document.querySelectorAll(".tuluan-tab-pill").forEach(p => p.classList.remove("active"));
const activeBtn = document.getElementById(tab-filter-${filterType});
if (activeBtn) activeBtn.classList.add("active");
renderTuLuanStudentsTable();
}
async function handleToggleApproveStudent(cleanSbd, isChecked) {
const qId = currentTuLuanModalData.quizId; if (!qId) return;
try {
const client = getDbClient();
if (client) await client.from('tu_luan_submissions').update({ is_approved: isChecked }).eq('quiz_id', qId).eq('sbd', cleanSbd);
if (currentTuLuanModalData.submissionsMap[cleanSbd]) currentTuLuanModalData.submissionsMap[cleanSbd].isApproved = isChecked;
renderTuLuanStudentsTable();
} catch(err) { alert("❌ Lỗi cập nhật phê duyệt: " + err.message); }
}
async function toggleApproveAllSubmissions(isApproved) {
const qId = currentTuLuanModalData.quizId; const subMap = currentTuLuanModalData.submissionsMap || {};
const keys = Object.keys(subMap);
if (keys.length === 0) { alert("ℹ️ Chưa có bài nộp nào để phê duyệt!"); return; }
if (!confirm(Bạn có chắc muốn ${isApproved ? 'PHÊ DUYỆT TẤT CẢ' : 'HỦY DUYỆT'} bài làm của đề này không?)) return;
code
Code
try {
    const client = getDbClient();
    if (client) await client.from('tu_luan_submissions').update({ is_approved: isApproved }).eq('quiz_id', qId);
    keys.forEach(k => { if (subMap[k]) subMap[k].isApproved = isApproved; });
    renderTuLuanStudentsTable();
    alert(`✅ Đã cập nhật trạng thái phê duyệt cho ${keys.length} học sinh!`);
} catch(e) { alert("❌ Lỗi duyệt bài: " + e.message); }
}
// ĐÃ SỬA: Auto-scroll khi mở bảng Popover để không bao giờ bị khuất màn hình
function toggleStudentPassPopover(cleanSbd, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const pop = document.getElementById(pass-popover-${cleanSbd}); if (!pop) return;
const isShown = pop.classList.contains("show");
code
Code
document.querySelectorAll(".student-pass-popover.show, .student-feedback-popover.show, .dapan-schedule-popover.show, .component-score-popover.show").forEach(p => p.classList.remove("show"));

if (!isShown) {
    pop.classList.add("show");
    const oldIn = document.getElementById(`old-pass-${cleanSbd}`); const newIn = document.getElementById(`new-pass-${cleanSbd}`);
    if (oldIn) { oldIn.value = ""; oldIn.focus(); }
    if (newIn) newIn.value = "";
    // Cuộn để người dùng nhìn thấy
    try { pop.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
}
}
function closeStudentPassPopover(cleanSbd, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const pop = document.getElementById(pass-popover-${cleanSbd}); if (pop) pop.classList.remove("show");
}
async function saveStudentPasswordChange(cleanSbd, defaultSbd, studentName, defaultPass, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const oldPassInput = document.getElementById(old-pass-${cleanSbd}); const newPassInput = document.getElementById(new-pass-${cleanSbd});
if (!oldPassInput || !newPassInput) return;
code
Code
const oldVal = oldPassInput.value.trim(); const newVal = newPassInput.value.trim();
const effectiveOldPass = getEffectiveStudentPassword(cleanSbd, defaultSbd, defaultPass);

if (!oldVal) { alert("⚠️ Vui lòng nhập Mật khẩu cũ (hoặc SBD) của em!"); oldPassInput.focus(); return; }
const isOldOk = (oldVal.toLowerCase() === effectiveOldPass.toLowerCase()) || (oldVal.toLowerCase() === String(defaultSbd).trim().toLowerCase()) || (defaultPass && oldVal.toLowerCase() === String(defaultPass).trim().toLowerCase());
if (!isOldOk) { alert("❌ Mật khẩu cũ không chính xác!"); oldPassInput.focus(); return; }
if (!/^\d{4}$/.test(newVal)) { alert("⚠️ Mật khẩu mới phải gồm đúng 4 chữ số!"); newPassInput.focus(); return; }
if (newVal === effectiveOldPass) { alert("⚠️ Mật khẩu mới không được trùng mật khẩu cũ!"); newPassInput.focus(); return; }

try {
    currentTuLuanModalData.customPasswords = currentTuLuanModalData.customPasswords || {};
    currentTuLuanModalData.customPasswords[cleanSbd] = newVal;
    const client = getDbClient();
    if (client) await client.from('app_key_values').upsert({ key: 'student_custom_passwords', value: currentTuLuanModalData.customPasswords });
    
    safeSession.setItem(`tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`, "true");
    closeStudentPassPopover(cleanSbd);
    alert(`🎉 ĐỔI MẬT KHẨU THÀNH CÔNG!\nMật khẩu mới của ${studentName} là: ${newVal}`);
    renderTuLuanStudentsTable();
} catch(err) { alert("❌ Lỗi khi lưu mật khẩu: " + err.message); }
}
async function resetStudentPasswordToDefault(cleanSbd, defaultSbd, studentName, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
if (!checkCurrentIsAdmin()) { alert("⛔ Chỉ Giáo viên quản trị mới có quyền Reset mật khẩu!"); return; }
if (!confirm(⚠️ XÁC NHẬN RESET MẬT KHẨU (ADMIN):\n\nKhôi phục mật khẩu của [${studentName}] về mặc định (${defaultSbd})?)) return;
code
Code
try {
    if (currentTuLuanModalData.customPasswords) delete currentTuLuanModalData.customPasswords[cleanSbd];
    const client = getDbClient();
    if (client) await client.from('app_key_values').upsert({ key: 'student_custom_passwords', value: currentTuLuanModalData.customPasswords || {} });
    
    safeSession.removeItem(`tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`);
    alert(`✅ Đã reset mật khẩu của em [${studentName}] về: ${defaultSbd}.`);
    renderTuLuanStudentsTable();
} catch(err) { alert("❌ Lỗi reset mật khẩu: " + err.message); }
}
// ĐÃ SỬA: Auto-scroll khi mở bảng Nhận xét
function toggleStudentFeedbackPopover(cleanSbd, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const pop = document.getElementById(feedback-popover-${cleanSbd}); if (!pop) return;
const isShown = pop.classList.contains("show");
code
Code
document.querySelectorAll(".student-pass-popover.show, .student-feedback-popover.show, .dapan-schedule-popover.show, .component-score-popover.show").forEach(p => p.classList.remove("show"));

if (!isShown) { 
    pop.classList.add("show"); 
    const textarea = document.getElementById(`feedback-textarea-${cleanSbd}`); 
    if (textarea) textarea.focus(); 
    try { pop.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
}
}
function closeStudentFeedbackPopover(cleanSbd, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const pop = document.getElementById(feedback-popover-${cleanSbd}); if (pop) pop.classList.remove("show");
}
async function saveStudentFeedback(cleanSbd, stt, sbd, studentName, event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const textarea = document.getElementById(feedback-textarea-${cleanSbd}); if (!textarea) return;
const feedbackVal = textarea.value.trim(); const qId = currentTuLuanModalData.quizId; if (!qId) return;
const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);
code
Code
if (!currentTuLuanModalData.submissionsMap[cleanSbd]) {
    currentTuLuanModalData.submissionsMap[cleanSbd] = { stt: stt, sbd: sbd, studentName: studentName, className: driveClassName, count: 0, images: [], feedback: feedbackVal, feedbackTime: new Date().toLocaleString("vi-VN") };
} else {
    currentTuLuanModalData.submissionsMap[cleanSbd].feedback = feedbackVal; currentTuLuanModalData.submissionsMap[cleanSbd].feedbackTime = new Date().toLocaleString("vi-VN");
}

try {
    const client = getDbClient();
    if (client) await client.from('tu_luan_submissions').upsert({ quiz_id: qId, sbd: cleanSbd, stt: String(stt || "00"), student_name: studentName, class_name: driveClassName, exam_title: currentTuLuanModalData.examTitle || "Tự luận", feedback: feedbackVal, feedback_time: new Date().toLocaleString("vi-VN") }, { onConflict: 'quiz_id,sbd' });
    closeStudentFeedbackPopover(cleanSbd);
    renderTuLuanStudentsTable();
} catch(err) { alert("❌ Lỗi khi lưu nhận xét: " + err.message); }
}
function exportTuLuanToExcel(event) {
if (event) { event.preventDefault(); event.stopPropagation(); }
const students = getAccountsForCategory(currentTuLuanModalData.classId);
if (!students || students.length === 0) { alert("⚠️ Không có dữ liệu học sinh để xuất Excel!"); return; }
code
Code
const examTitle = currentTuLuanModalData.examTitle || "BAI_TAP_TU_LUAN";
const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);
const subMap = currentTuLuanModalData.submissionsMap || {};

let maxQ = detectExamQuestionCount() || 40;
students.forEach(st => {
    const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
    const record = subMap[cleanSbd];
    if (record && record.questionCount) maxQ = Math.max(maxQ, record.questionCount);
    if (record && record.detailScores) {
        const keys = Object.keys(record.detailScores).map(k => parseInt(k, 10)).filter(k => !isNaN(k));
        if (keys.length > 0) maxQ = Math.max(maxQ, Math.max(...keys));
    }
});

let questionHeadersHtml = "";
for (let c = 1; c <= maxQ; c++) { questionHeadersHtml += `<th style="width: 38px; background-color: #0369a1; border: 1px solid #94a3b8; text-align: center;">C${c}</th>`; }

let rowsHtml = "";
students.forEach((st) => {
    const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
    const record = subMap[cleanSbd] || {}; const detailScores = record.detailScores || {};
    let qCellsHtml = ""; let sumRaw = 0; let answeredCount = 0;

    for (let c = 1; c <= maxQ; c++) {
        if (detailScores[c] !== undefined && detailScores[c] !== null && detailScores[c] !== "") {
            const score = parseFloat(detailScores[c]);
            if (!isNaN(score)) { sumRaw += score; answeredCount++; qCellsHtml += `<td style="text-align: center; font-weight: bold; background-color: #f0fdf4;">${score}</td>`; } 
            else { qCellsHtml += `<td style="text-align: center; color: #94a3b8;">-</td>`; }
        } else { qCellsHtml += `<td style="text-align: center; color: #cbd5e1;">-</td>`; }
    }

    sumRaw = Math.round(sumRaw * 100) / 100;
    let scale10 = (maxQ > 0) ? Math.round(((sumRaw / maxQ) * 10) * 100) / 100 : sumRaw;
    if (scale10 > 10.0) scale10 = 10.0;

    const hasSub = Boolean(record.images && record.images.length > 0);
    const statusText = hasSub ? `Đã nộp (${record.images.length} ảnh) lúc ${record.lastSubmit || ''}` : "Chưa nộp";
    const isApprovedText = (record.isApproved === true) ? "Đã duyệt" : "Chưa duyệt";
    const scoreVal = (record.crossScore !== undefined && record.crossScore !== null) ? record.crossScore : (answeredCount > 0 ? scale10 : "");
    
    let imagesHtml = "Chưa có ảnh";
    if (hasSub && Array.isArray(record.images)) {
        imagesHtml = record.images.map((im, idx) => {
            const imgUrl = im.directUrl || im.fileUrl || ""; const driveUrl = im.fileUrl || imgUrl;
            return `<div style="display: inline-block; margin: 4px 6px; text-align: center; vertical-align: top;"><img src="${imgUrl}" width="95" height="95" style="border: 1px solid #94a3b8; border-radius: 4px; object-fit: cover; display: block; margin-bottom: 3px;" alt="Trang ${idx + 1}"><br><a href="${driveUrl}" target="_blank" style="font-size: 10px; color: #0284c7; text-decoration: underline; font-weight: bold;">Trang ${idx + 1} [Drive]</a></div>`;
        }).join('');
    }

    rowsHtml += `<tr><td style="text-align: center; font-weight: bold;">${st.stt}</td><td style="font-weight: bold; white-space: nowrap;">${st.name}</td><td style="text-align: center; font-family: monospace; font-weight: bold;">${st.sbd}</td><td style="text-align: center;">${driveClassName}</td>${qCellsHtml}<td style="text-align: center; font-weight: bold; background-color: #fefce8; color: #854d0e;">${answeredCount > 0 ? sumRaw : '-'}</td><td style="text-align: center; font-weight: bold; background-color: #ecfdf5; color: #047857;">${answeredCount > 0 ? scale10 : '-'}</td><td style="text-align: center; font-weight: 900; color: #0284c7; font-size: 13pt; background-color: #eff6ff;">${scoreVal}</td><td style="font-size: 9.5pt; color: #475569;">${record.crossScoreBy ? `${record.crossScoreBy}${record.crossScoreTime ? ` (${record.crossScoreTime})` : ''}` : ''}</td><td>${statusText}</td><td style="text-align: center;">${isApprovedText}</td><td style="white-space: pre-wrap; word-break: break-word;">${record.feedback || ""}</td><td style="min-width: 250px;">${imagesHtml}</td></tr>`;
});

const excelCompleteHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Diem_Tu_Luan_${driveClassName}</title><style>body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 11pt; color: #0f172a; } h2, h3 { margin: 4px 0; } table { border-collapse: collapse; width: 100%; margin-top: 10px; } th { background-color: #0284c7; color: #ffffff; font-weight: bold; padding: 6px 8px; border: 1px solid #94a3b8; text-align: center; font-size: 10pt; } td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; } tr:nth-child(even) td { background-color: #f8fafc; }</style></head><body><h2>BẢNG ĐIỂM CHI TIẾT TỪNG CÂU & TỔNG ĐIỂM BÀI TẬP TỰ LUẬN</h2><h3>Đề thi: ${examTitle}</h3><p><b>Lớp:</b> ${driveClassName} &nbsp;|&nbsp; <b>Số câu của đề:</b> ${maxQ} câu &nbsp;|&nbsp; <b>Thời gian xuất file:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}</p><table><thead><tr><th style="width: 45px;">STT</th><th style="width: 170px;">Họ và tên</th><th style="width: 75px;">SBD</th><th style="width: 65px;">Lớp</th>${questionHeadersHtml}<th style="width: 85px; background-color: #d97706;">Tổng TP</th><th style="width: 85px; background-color: #059669;">Thang 10</th><th style="width: 95px; background-color: #2563eb;">Điểm chốt</th><th style="width: 150px;">Người chấm</th><th style="width: 150px;">Trạng thái nộp</th><th style="width: 90px;">Phê duyệt</th><th style="width: 200px;">Nhận xét bài làm</th><th style="width: 360px;">Ảnh bài làm đã nộp</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;

const blob = new Blob(['\ufeff', excelCompleteHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
const safeExam = examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
const fileName = `Diem_Chi_Tiet_Tu_Luan_${driveClassName}_${safeExam}_${Date.now()}.xls`;

const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName;
document.body.appendChild(link); link.click(); document.body.removeChild(link);
setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}
window.renderTuLuanStudentsTable = renderTuLuanStudentsTable;
window.filterTuLuanStudentTable = filterTuLuanStudentTable;
window.filterTuLuanStatus = filterTuLuanStatus;
window.handleToggleApproveStudent = handleToggleApproveStudent;
window.toggleApproveAllSubmissions = toggleApproveAllSubmissions;
window.toggleStudentPassPopover = toggleStudentPassPopover;
window.closeStudentPassPopover = closeStudentPassPopover;
window.saveStudentPasswordChange = saveStudentPasswordChange;
window.resetStudentPasswordToDefault = resetStudentPasswordToDefault;
window.toggleStudentFeedbackPopover = toggleStudentFeedbackPopover;
window.closeStudentFeedbackPopover = closeStudentFeedbackPopover;
window.saveStudentFeedback = saveStudentFeedback;
window.exportTuLuanToExcel = exportTuLuanToExcel;