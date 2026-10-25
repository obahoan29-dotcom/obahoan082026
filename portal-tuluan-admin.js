// =========================================================
// FILE: portal-tuluan-admin.js
// QUẢN LÝ ĐỀ THI TỰ LUẬN, ĐÁP ÁN CHẤM, HẸN GIỜ & REALTIME SUPABASE
// =========================================================

async function refreshTuLuanExamList(targetCat, preferredExamId = null) {
    const selector = document.getElementById("tuluan-exam-selector");
    if (!selector) return;
    currentTuLuanModalData.classId = targetCat;
    selector.innerHTML = "<option value=''>⏳ Đang tải 5 đề mới nhất...</option>";

    let rawExams = [];
    const client = getDbClient();
    if (client) {
        try {
            const { data: linksData } = await client.from('custom_links').select('*').eq('category_id', targetCat);
            if (Array.isArray(linksData)) {
                linksData.forEach(item => {
                    if (item && item.title && String(item.title).trim() !== "") {
                        let t = item.timestamp || (typeof parseDateString === 'function' ? parseDateString(item.date) : 0) || 0;
                        rawExams.push({ id: (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(item) || item.id) : item.id, title: item.title, timestamp: t });
                    }
                });
            }
        } catch(e) { console.warn("Lỗi tải đề custom_links:", e); }
    }

    const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
    const catObj = allCats.find(c => c.id === targetCat);
    if (catObj && Array.isArray(catObj.links)) {
        catObj.links.forEach(l => {
            if (l && l.title && String(l.title).trim() !== "") {
                let t = l.timestamp || (typeof parseDateString === 'function' ? parseDateString(l.date) : 0) || 0;
                rawExams.push({ id: (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(l) || l.id) : l.id, title: l.title, timestamp: t });
            }
        });
    }

    rawExams.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const uniqueExams = []; const seenTitles = new Set();
    rawExams.forEach(ex => { const norm = ex.title.trim().toLowerCase(); if (!seenTitles.has(norm)) { seenTitles.add(norm); uniqueExams.push(ex); } });

    let top5Exams = uniqueExams.slice(0, 5);
    if (top5Exams.length === 0) {
        const driveClassClean = getCleanDriveClassName(targetCat);
        top5Exams.push({ id: `DE_TU_LUAN_${driveClassClean}`, title: `Đề tự luận ${driveClassClean}`, timestamp: Date.now() });
    }

    currentTuLuanModalData.availableExams = top5Exams;
    selector.innerHTML = "";
    top5Exams.forEach((ex, idx) => {
        const opt = document.createElement("option");
        opt.value = ex.id; opt.innerText = `${idx + 1}. ${ex.title}`; opt.dataset.title = ex.title;
        selector.appendChild(opt);
    });

    let selectedExam = top5Exams[0];
    if (preferredExamId) {
        const found = top5Exams.find(e => e.id === preferredExamId || e.title === preferredExamId);
        if (found) selectedExam = found;
    }
    selector.value = selectedExam.id;
    if (typeof updateTuLuanAdminUI === 'function') updateTuLuanAdminUI();
    await switchTuLuanExam(selectedExam.id, selectedExam.title);
}

async function switchTuLuanExam(examId, examTitle) {
    const classSelector = document.getElementById("tuluan-class-selector");
    if (classSelector && classSelector.value) { currentTuLuanModalData.classId = classSelector.value; }
    currentTuLuanModalData.quizId = examId; currentTuLuanModalData.examTitle = examTitle;

    const folderKey = getUnifiedExamFolderKey(examTitle, "", examId);
    const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);

    const headTitle = document.getElementById("tuluan-modal-heading");
    const pathCode = document.getElementById("tuluan-drive-folder-path");
    if (headTitle) headTitle.innerText = `📤 NỘP BÀI TỰ LUẬN - ${examTitle}`;
    if (pathCode) pathCode.innerText = `BAI_TAP_TU_LUAN / ${driveClassName} / ${folderKey} / [STT_SBD_HỌ_TÊN]`;

    if (typeof updateTuLuanAdminUI === 'function') updateTuLuanAdminUI();
    await loadTuLuanSubmissionsFromSupabase();
    if (typeof renderDapAnChamUI === 'function') renderDapAnChamUI();
    if (typeof renderTuLuanStudentsTable === 'function') renderTuLuanStudentsTable();
    startTuLuanRealtimeListener(examId);
}

function onTuLuanClassChanged(newClassId) {
    currentTuLuanModalData.classId = newClassId;
    refreshTuLuanExamList(newClassId);
}

function onTuLuanExamChanged(newExamId) {
    const selector = document.getElementById("tuluan-exam-selector");
    const selectedOpt = selector.options[selector.selectedIndex];
    const examTitle = selectedOpt ? selectedOpt.dataset.title : newExamId;
    switchTuLuanExam(newExamId, examTitle);
}

async function promptAddNewTuLuanExam() {
    const inputTitle = prompt("➕ NHẬP TÊN ĐỀ THI TỰ LUẬN MỚI (VD: Đề 109 Giữa Kỳ 1, Đề 108 Toán 11...):");
    if (!inputTitle || !inputTitle.trim()) return;

    const examTitle = inputTitle.trim();
    const classId = currentTuLuanModalData.classId || "lop-11a";
    const examId = "exam_" + Date.now();
    const folderKey = getUnifiedExamFolderKey(examTitle, "", examId);
    const driveClassName = getCleanDriveClassName(classId);

    try {
        const client = getDbClient();
        if (client) {
            await client.from('custom_links').upsert({ id: examId, category_id: classId, title: examTitle, is_doc: true, badge_text: "MỚI", timestamp: Date.now(), date: new Date().toLocaleDateString("vi-VN"), url: "#" });
        }
        const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ? GOOGLE_DRIVE_TULUAN_GAS_URL : GOOGLE_DRIVE_UPLOAD_GAS_URL;
        if (gasUrl && !gasUrl.includes("DÁN_URL")) {
            fetch(gasUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "createExamFolders", rootFolder: "BAI_TAP_TU_LUAN", className: driveClassName, class: driveClassName, lop: driveClassName, classList: [driveClassName], examTitle: folderKey, folderKey: folderKey }) }).catch(() => null);
        }
        alert(`✅ Đã thêm đề "${examTitle}" thành công cho lớp ${driveClassName}!`);
        await refreshTuLuanExamList(classId, examId);
    } catch(err) { alert("❌ Lỗi khi thêm đề: " + err.message); }
}

async function deleteCurrentTuLuanExam(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!checkCurrentIsAdmin()) { alert("⛔ Chỉ Giáo viên quản trị mới có quyền xóa đề thi!"); return; }
    
    const classId = currentTuLuanModalData.classId || "lop-11a"; const className = getCleanDriveClassName(classId);
    const selector = document.getElementById("tuluan-exam-selector");
    if (!selector || !selector.value) { alert("⚠️ Vui lòng chọn một đề để xóa!"); return; }
    const examId = selector.value;
    const selectedOpt = selector.options[selector.selectedIndex];
    let examTitle = selectedOpt ? (selectedOpt.dataset.title || selectedOpt.innerText) : examId;
    examTitle = examTitle.replace(/^\d+\.\s*/, '').trim();

    if (!confirm(`⚠️ XÁC NHẬN XÓA ĐỀ TỰ LUẬN (ADMIN):\n\nThầy có chắc chắn muốn XÓA đề:\n"${examTitle}"\nkhỏi danh sách nộp bài của lớp ${className} không?\n\n(Hệ thống sẽ gỡ bỏ đề này khỏi lớp ${className} và cập nhật tức thì).`)) return;

    const btn = document.getElementById("btn-del-current-exam");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang xóa..."; }
    try {
        const client = getDbClient();
        if (client) {
            await Promise.all([
                client.from('custom_links').delete().eq('category_id', classId).eq('id', examId),
                client.from('custom_links').delete().eq('category_id', classId).eq('title', examTitle),
                client.from('tu_luan_submissions').delete().eq('quiz_id', examId),
                client.from('app_key_values').delete().eq('key', 'dapan_' + examId),
                client.from('app_key_values').delete().eq('key', 'detail_scores_' + examId)
            ]);
        }
        alert(`🗑️ Đã xóa đề "${examTitle}" của lớp ${className} thành công!`);
        await refreshTuLuanExamList(classId);
    } catch(err) { alert("❌ Lỗi khi xóa đề: " + err.message); } 
    finally { if (btn) { btn.disabled = false; btn.innerText = "🗑️ Xóa đề"; } }
}

async function loadTuLuanSubmissionsFromSupabase() {
    const qId = currentTuLuanModalData.quizId; if (!qId) return;
    const client = getDbClient();
    if (!client) { currentTuLuanModalData.submissionsMap = {}; currentTuLuanModalData.dapAnCham = null; return; }

    try {
        const [subsRes, passRes, dapanRes, detailScoresRes] = await Promise.all([
            client.from('tu_luan_submissions').select('*').eq('quiz_id', qId),
            client.from('app_key_values').select('value').eq('key', 'student_custom_passwords').single(),
            client.from('app_key_values').select('value').eq('key', 'dapan_' + qId).single(),
            client.from('app_key_values').select('value').eq('key', 'detail_scores_' + qId).single()
        ]);

        const backupDetailsMap = (detailScoresRes && detailScoresRes.data && detailScoresRes.data.value && typeof detailScoresRes.data.value === 'object') ? detailScoresRes.data.value : {};
        let combined = {};
        if (subsRes && Array.isArray(subsRes.data)) {
            subsRes.data.forEach(row => {
                if (row && row.sbd) {
                    let dScores = {};
                    if (row.detail_scores) { try { dScores = (typeof row.detail_scores === 'object') ? row.detail_scores : JSON.parse(row.detail_scores); } catch(e) {} }
                    if (Object.keys(dScores).length === 0 && backupDetailsMap[row.sbd] && backupDetailsMap[row.sbd].detailScores) { dScores = backupDetailsMap[row.sbd].detailScores; }

                    combined[row.sbd] = {
                        stt: row.stt, sbd: row.sbd, studentName: row.student_name, className: row.class_name, examTitle: row.exam_title,
                        lastSubmit: row.last_submit, lastSubmitTime: row.last_submit_time, count: row.count || (Array.isArray(row.images) ? row.images.length : 0),
                        images: Array.isArray(row.images) ? row.images : [], crossScore: row.cross_score || "", crossScoreBy: row.cross_score_by || "", crossScoreTime: row.cross_score_time || "",
                        feedback: row.feedback || "", feedbackTime: row.feedback_time || "", isApproved: !!row.is_approved, detailScores: dScores,
                        questionCount: (backupDetailsMap[row.sbd] && backupDetailsMap[row.sbd].questionCount) || detectExamQuestionCount()
                    };
                }
            });
        }
        currentTuLuanModalData.submissionsMap = combined;
        currentTuLuanModalData.customPasswords = (passRes && passRes.data && passRes.data.value) ? passRes.data.value : {};
        currentTuLuanModalData.dapAnCham = (dapanRes && dapanRes.data && dapanRes.data.value && dapanRes.data.value.fileUrl) ? dapanRes.data.value : null;
    } catch(e) { console.warn("Lỗi đọc dữ liệu tự luận Supabase:", e); currentTuLuanModalData.submissionsMap = {}; currentTuLuanModalData.dapAnCham = null; }
}

function startTuLuanRealtimeListener(quizId) {
    const client = getDbClient(); if (!client || !quizId) return;
    if (tuLuanRealtimeChannel) { try { client.removeChannel(tuLuanRealtimeChannel); } catch(e) {} tuLuanRealtimeChannel = null; }
    try {
        tuLuanRealtimeChannel = client.channel(`tuluan_realtime_${quizId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tu_luan_submissions', filter: `quiz_id=eq.${quizId}` }, async () => {
                await loadTuLuanSubmissionsFromSupabase();
                if(typeof renderDapAnChamUI === 'function') renderDapAnChamUI();
                if(typeof renderTuLuanStudentsTable === 'function') renderTuLuanStudentsTable();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_key_values', filter: `key=eq.dapan_${quizId}` }, async () => {
                await loadTuLuanSubmissionsFromSupabase();
                if(typeof renderDapAnChamUI === 'function') renderDapAnChamUI();
            })
            .subscribe();
    } catch(e) { console.warn("Lỗi kết nối Supabase Realtime channel:", e); }
}

function triggerUploadDapAnCham(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const fileIn = document.getElementById("tuluan-dapan-file-input");
    if (fileIn) { fileIn.value = ""; fileIn.click(); }
}

async function handleUploadDapAnCham(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0]; const btn = document.getElementById("btn-up-dapan-cham");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang gửi..."; }
    
    const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ? GOOGLE_DRIVE_TULUAN_GAS_URL : GOOGLE_DRIVE_UPLOAD_GAS_URL;
    if (!gasUrl || gasUrl.includes("DÁN_URL")) { alert("⚠️ Chưa cấu hình GOOGLE_DRIVE_TULUAN_GAS_URL!"); if (btn) { btn.disabled = false; btn.innerText = "📤 Đ.Á chấm"; } return; }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                let rawResult = String(e.target.result || ""); let base64Data = rawResult.includes("base64,") ? rawResult.split("base64,")[1] : rawResult;
                const payload = { action: "uploadDapAnCham", rootFolder: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO", className: "Dap_an_cham_tu_luan", class: "Dap_an_cham_tu_luan", lop: "Dap_an_cham_tu_luan", examTitle: "Dap_an_cham_tu_luan", folderKey: "Dap_an_cham_tu_luan", studentFolder: "Dap_an_cham_tu_luan", filename: file.name, mimeType: file.type || "application/octet-stream", base64: base64Data };
                
                const result = await fetch(gasUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }).then(res => res.json());
                
                if (result && result.status === "success" && result.fileUrl) {
                    const now = new Date(); const pad = n => String(n).padStart(2, '0');
                    const uploadTimeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
                    const directUrl = result.directUrl || (typeof toDirectGoogleDriveImageUrl === 'function' ? toDirectGoogleDriveImageUrl(result.fileUrl) : result.fileUrl);
                    const dapanData = { quizId: currentTuLuanModalData.quizId, classId: currentTuLuanModalData.classId, fileName: file.name, fileUrl: result.fileUrl, directUrl: directUrl, fileId: result.fileId || "", uploadedAt: uploadTimeStr, timestamp: Date.now(), scheduleTime: (currentTuLuanModalData.dapAnCham || {}).scheduleTime || null };
                    
                    const client = getDbClient();
                    if (client) await client.from('app_key_values').upsert({ key: 'dapan_' + currentTuLuanModalData.quizId, value: dapanData });
                    
                    currentTuLuanModalData.dapAnCham = dapanData;
                    if(typeof renderDapAnChamUI === 'function') renderDapAnChamUI();
                    alert(`🎉 ĐÃ TẢI LÊN ĐÁP ÁN CHẤM THÀNH CÔNG!\n\n📁 Tên file: ${file.name}`);
                }
            } catch(upErr) { alert("❌ Lỗi khi tải file lên Drive: " + upErr.message); } 
            finally { if (btn) { btn.disabled = false; btn.innerText = "📤 Đ.Á chấm"; } fileInput.value = ""; }
        };
        reader.readAsDataURL(file);
    } catch(err) { alert("❌ Lỗi đọc file từ máy: " + err.message); if (btn) { btn.disabled = false; btn.innerText = "📤 Đ.Á chấm"; } fileInput.value = ""; }
}

async function deleteDapAnCham(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!checkCurrentIsAdmin()) { alert("⛔ Chỉ Giáo viên quản trị mới có quyền xóa file Đáp án chấm!"); return; }
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA file Đáp án chấm của đề này không?")) return;

    try {
        const client = getDbClient();
        if (client) await client.from('app_key_values').delete().eq('key', 'dapan_' + currentTuLuanModalData.quizId);
        
        if (currentTuLuanModalData.dapAnCham && currentTuLuanModalData.dapAnCham.fileId) {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ? GOOGLE_DRIVE_TULUAN_GAS_URL : GOOGLE_DRIVE_UPLOAD_GAS_URL;
            if (gasUrl && !gasUrl.includes("DÁN_URL")) { fetch(gasUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deleteFile", fileId: currentTuLuanModalData.dapAnCham.fileId }) }).catch(() => null); }
        }
        currentTuLuanModalData.dapAnCham = null;
        if(typeof renderDapAnChamUI === 'function') renderDapAnChamUI();
        alert("🗑️ Đã xóa file Đáp án chấm thành công!");
    } catch(err) { alert("❌ Lỗi khi xóa: " + err.message); }
}

function toggleDapAnSchedulePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("dapan-schedule-popover"); if (!pop) return;
    const isShown = pop.classList.contains("show");

    document.querySelectorAll(".student-pass-popover.show, .student-feedback-popover.show, .dapan-schedule-popover.show, .component-score-popover.show").forEach(p => p.classList.remove("show"));

    if (!isShown) {
        pop.classList.add("show");
        const curDapan = currentTuLuanModalData.dapAnCham;
        if (curDapan && curDapan.scheduleTime) {
            document.getElementById("sched-mode-auto").checked = true; onDapAnScheduleModeChanged('auto');
            const d = new Date(curDapan.scheduleTime);
            if (!isNaN(d.getTime())) {
                const pad = n => String(n).padStart(2, '0');
                document.getElementById("dapan-sched-datetime").value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
        } else {
            document.getElementById("sched-mode-now").checked = true; onDapAnScheduleModeChanged('now');
            document.getElementById("dapan-sched-datetime").value = "";
        }
    }
}

function closeDapAnSchedulePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("dapan-schedule-popover"); if (pop) pop.classList.remove("show");
}

function onDapAnScheduleModeChanged(mode) {
    const inputGroup = document.getElementById("sched-datetime-input-group");
    if (inputGroup) {
        inputGroup.style.display = (mode === 'auto') ? 'block' : 'none';
        if (mode === 'auto' && !document.getElementById("dapan-sched-datetime").value) setScheduleToExamDeadline();
    }
}

function setScheduleToExamDeadline() {
    let deadlineStr = null; const currentQuizId = currentTuLuanModalData.quizId;
    if (typeof examData !== 'undefined' && examData && examData.examEndTimeStr) { deadlineStr = examData.examEndTimeStr; } 
    else {
        const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
        for (const cat of allCats) {
            if (Array.isArray(cat.links)) {
                const match = cat.links.find(l => (l.id === currentQuizId || l.firebaseId === currentQuizId));
                if (match && match.examEndTimeStr) { deadlineStr = match.examEndTimeStr; break; }
            }
        }
    }

    if (deadlineStr) {
        const d = new Date(deadlineStr);
        if (!isNaN(d.getTime())) {
            const pad = n => String(n).padStart(2, '0');
            document.getElementById("dapan-sched-datetime").value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return;
        }
    }
    const def = new Date(); def.setHours(21, 0, 0, 0); const pad = n => String(n).padStart(2, '0');
    document.getElementById("dapan-sched-datetime").value = `${def.getFullYear()}-${pad(def.getMonth() + 1)}-${pad(def.getDate())}T${pad(def.getHours())}:${pad(def.getMinutes())}`;
}

async function saveDapAnSchedule(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentTuLuanModalData.dapAnCham) { alert("⚠️ Vui lòng upload file Đáp án chấm trước khi thiết lập lịch hẹn giờ!"); closeDapAnSchedulePopover(); return; }
    
    let scheduleTimeISO = null;
    if (document.getElementById("sched-mode-auto").checked) {
        const val = document.getElementById("dapan-sched-datetime").value;
        if (!val) { alert("⚠️ Vui lòng chọn ngày và giờ mở đáp án!"); return; }
        const d = new Date(val); if (isNaN(d.getTime())) { alert("⚠️ Thời gian hẹn không hợp lệ!"); return; }
        scheduleTimeISO = d.toISOString();
    }
    
    currentTuLuanModalData.dapAnCham.scheduleTime = scheduleTimeISO;
    try {
        const client = getDbClient();
        if (client) await client.from('app_key_values').upsert({ key: 'dapan_' + currentTuLuanModalData.quizId, value: currentTuLuanModalData.dapAnCham });
        if(typeof renderDapAnChamUI === 'function') renderDapAnChamUI();
        closeDapAnSchedulePopover();
        if (scheduleTimeISO) { alert(`⏰ ĐÃ THIẾT LẬP HẸN GIỜ MỞ ĐÁP ÁN!\n\n- Đề thi: ${currentTuLuanModalData.examTitle}\n- Tự động mở: ${new Date(scheduleTimeISO).toLocaleString("vi-VN")}`); } 
        else { alert("🔓 Đã mở đáp án tự do cho học sinh xem ngay lập tức!"); }
    } catch(err) { alert("❌ Lỗi khi lưu hẹn giờ: " + err.message); }
}

function isDapAnUnlocked(dapan) {
    if (!dapan || !dapan.fileUrl) return false;
    if (checkCurrentIsAdmin()) return true;
    if (!dapan.scheduleTime) return true;
    const targetMs = new Date(dapan.scheduleTime).getTime();
    if (isNaN(targetMs)) return true;
    return Date.now() >= targetMs;
}

function formatRemainingLockTime(targetMs) {
    const diffSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    if (diffSec <= 0) return "Đang mở...";
    const days = Math.floor(diffSec / 86400); const hours = Math.floor((diffSec % 86400) / 3600); const mins = Math.floor((diffSec % 3600) / 60);
    if (days > 0) return `${days} ngày ${hours} giờ`;
    if (hours > 0) return `${hours} giờ ${mins} phút`;
    return `${mins} phút`;
}

function renderDapAnChamUI() {
    const dapan = currentTuLuanModalData.dapAnCham; const isAdmin = checkCurrentIsAdmin();
    const schedBtn = document.getElementById("btn-schedule-dapan");
    const badgeWrap = document.getElementById("tuluan-dapan-badge-wrap"); const badgeLink = document.getElementById("tuluan-dapan-badge-link");
    const badgeFilename = document.getElementById("tuluan-dapan-badge-filename"); const badgeMoiMini = document.getElementById("badge-moi-mini-text");
    const delMiniBtn = document.getElementById("btn-del-dapan-mini");
    const fullStrip = document.getElementById("tuluan-dapan-full-strip"); const stripFilename = document.getElementById("strip-dapan-filename");
    const stripLink = document.getElementById("strip-dapan-link"); const stripTime = document.getElementById("strip-dapan-time");
    const stripOpenBtn = document.getElementById("strip-dapan-open-btn"); const stripDelBtn = document.getElementById("strip-dapan-del-btn");
    const stripBadgeTag = document.getElementById("strip-dapan-badge-tag");

    if (schedBtn) {
        if (dapan && dapan.scheduleTime) { schedBtn.classList.add("has-schedule"); schedBtn.title = `Đang hẹn giờ mở lúc: ${new Date(dapan.scheduleTime).toLocaleString("vi-VN")}`; schedBtn.innerHTML = `⏰ Đã hẹn`; } 
        else { schedBtn.classList.remove("has-schedule"); schedBtn.title = "Hẹn giờ tự động mở đáp án cho học sinh"; schedBtn.innerHTML = `⏰ Hẹn giờ`; }
    }

    if (dapan && dapan.fileUrl) {
        const directUrl = dapan.fileUrl; const name = dapan.fileName || "Đáp án chấm"; const uploadTime = dapan.uploadedAt || "";
        const isUnlocked = isDapAnUnlocked(dapan);

        if (badgeWrap) badgeWrap.style.display = "inline-flex";
        if (badgeFilename) badgeFilename.innerText = name;
        if (badgeLink) {
            if (isUnlocked) { badgeLink.href = directUrl; badgeLink.classList.remove("is-locked"); badgeLink.title = `Mở Đáp án: ${name} (${uploadTime})`; if (badgeMoiMini) { badgeMoiMini.innerText = "MỚI"; badgeMoiMini.style.backgroundColor = "#0284c7"; } } 
            else { badgeLink.href = "javascript:void(0)"; badgeLink.classList.add("is-locked"); const remain = formatRemainingLockTime(new Date(dapan.scheduleTime).getTime()); badgeLink.title = `🔒 Đáp án đang khóa! Sẽ mở sau: ${remain}`; if (badgeMoiMini) { badgeMoiMini.innerText = "KHÓA"; badgeMoiMini.style.backgroundColor = "#ea580c"; } }
        }
        if (delMiniBtn) delMiniBtn.style.display = isAdmin ? "inline-flex" : "none";

        if (fullStrip) {
            fullStrip.style.display = "flex";
            if (!isUnlocked) fullStrip.classList.add("strip-locked"); else fullStrip.classList.remove("strip-locked");
        }

        if (isUnlocked) {
            if (stripBadgeTag) { stripBadgeTag.className = "dapan-badge-new"; stripBadgeTag.innerText = "MỚI"; }
            if (stripFilename) stripFilename.innerText = name;
            if (stripLink) { stripLink.href = directUrl; stripLink.style.pointerEvents = "auto"; }
            if (stripTime) stripTime.innerText = `📅 ${uploadTime}`;
            if (stripOpenBtn) { stripOpenBtn.href = directUrl; stripOpenBtn.className = "btn-open-dapan-strip"; stripOpenBtn.innerText = isAdmin ? "🔗 Mở xem (Admin)" : "🔗 Mở xem"; }
        } else {
            const schedStr = new Date(dapan.scheduleTime).toLocaleString("vi-VN"); const remain = formatRemainingLockTime(new Date(dapan.scheduleTime).getTime());
            if (stripBadgeTag) { stripBadgeTag.className = "dapan-badge-new badge-lock"; stripBadgeTag.innerText = "HẸN GIỜ"; }
            if (stripFilename) { stripFilename.innerText = `${name} [Mở lúc: ${schedStr} - Còn ${remain}]`; }
            if (stripTime) stripTime.innerText = `⏳ Đang khóa với học sinh`;
            if (isAdmin) {
                if (stripLink) { stripLink.href = directUrl; stripLink.style.pointerEvents = "auto"; }
                if (stripOpenBtn) { stripOpenBtn.href = directUrl; stripOpenBtn.className = "btn-open-dapan-strip"; stripOpenBtn.innerText = "🔗 Mở xem (Admin)"; }
            } else {
                if (stripLink) { stripLink.href = "javascript:void(0)"; stripLink.style.pointerEvents = "none"; }
                if (stripOpenBtn) { stripOpenBtn.href = "javascript:void(0)"; stripOpenBtn.className = "btn-open-dapan-strip disabled-strip"; stripOpenBtn.innerText = "🔒 Đang khóa"; }
            }
        }
        if (stripDelBtn) stripDelBtn.style.display = isAdmin ? "inline-flex" : "none";
    } else {
        if (badgeWrap) badgeWrap.style.display = "none"; if (fullStrip) fullStrip.style.display = "none";
    }
    if (typeof updateTuLuanAdminUI === 'function') updateTuLuanAdminUI();
}

window.refreshTuLuanExamList = refreshTuLuanExamList;
window.switchTuLuanExam = switchTuLuanExam;
window.onTuLuanClassChanged = onTuLuanClassChanged;
window.onTuLuanExamChanged = onTuLuanExamChanged;
window.promptAddNewTuLuanExam = promptAddNewTuLuanExam;
window.deleteCurrentTuLuanExam = deleteCurrentTuLuanExam;
window.loadTuLuanSubmissionsFromSupabase = loadTuLuanSubmissionsFromSupabase;
window.startTuLuanRealtimeListener = startTuLuanRealtimeListener;
window.triggerUploadDapAnCham = triggerUploadDapAnCham;
window.handleUploadDapAnCham = handleUploadDapAnCham;
window.deleteDapAnCham = deleteDapAnCham;
window.toggleDapAnSchedulePopover = toggleDapAnSchedulePopover;
window.closeDapAnSchedulePopover = closeDapAnSchedulePopover;
window.onDapAnScheduleModeChanged = onDapAnScheduleModeChanged;
window.setScheduleToExamDeadline = setScheduleToExamDeadline;
window.saveDapAnSchedule = saveDapAnSchedule;
window.isDapAnUnlocked = isDapAnUnlocked;
window.formatRemainingLockTime = formatRemainingLockTime;
window.renderDapAnChamUI = renderDapAnChamUI;