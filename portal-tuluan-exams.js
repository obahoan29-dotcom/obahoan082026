// =========================================================
// FILE: portal-tuluan-exams.js
// QUẢN LÝ MODAL, DANH SÁCH 5 ĐỀ MỚI NHẤT, REALTIME & PHÊ DUYỆT
// =========================================================

async function openTuLuanModal(classId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (typeof ensureTuLuanModalDOM === "function") ensureTuLuanModalDOM();

    let targetCat = classId;
    if (targetCat === "tu-luan-padlet" || !targetCat) {
        if (itemId && itemId.includes("11c")) targetCat = "lop-11c";
        else if (itemId && itemId.includes("10p")) targetCat = "lop-10p";
        else if (itemId && itemId.includes("11e")) targetCat = "lop-11e";
        else targetCat = "lop-11a";
    }

    currentTuLuanModalData.classId = targetCat;
    const classSelector = document.getElementById("tuluan-class-selector");
    if (classSelector) classSelector.value = targetCat;

    updateTuLuanAdminUI();

    document.getElementById("modal-tuluan-submission").style.display = "flex";
    await refreshTuLuanExamList(targetCat, itemId);
}

function closeTuLuanModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const modal = document.getElementById("modal-tuluan-submission");
    if (modal) modal.style.display = "none";
    
    if (tuLuanRealtimeChannel) {
        const client = getDbClient();
        if (client) {
            try { client.removeChannel(tuLuanRealtimeChannel); } catch(e) {}
        }
        tuLuanRealtimeChannel = null;
    }
}

async function refreshTuLuanExamList(targetCat, preferredExamId = null) {
    const selector = document.getElementById("tuluan-exam-selector");
    if (!selector) return;

    currentTuLuanModalData.classId = targetCat;
    selector.innerHTML = "<option value=''>⏳ Đang tải 5 đề mới nhất...</option>";

    let rawExams = [];
    const client = getDbClient();

    if (client) {
        try {
            const { data: linksData } = await client
                .from('custom_links')
                .select('*')
                .eq('category_id', targetCat);

            if (Array.isArray(linksData)) {
                linksData.forEach(item => {
                    if (item && item.title && String(item.title).trim() !== "") {
                        let t = item.timestamp || (typeof parseDateString === 'function' ? parseDateString(item.date) : 0) || 0;
                        rawExams.push({
                            id: (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(item) || item.id) : item.id,
                            title: item.title,
                            timestamp: t
                        });
                    }
                });
            }
        } catch(e) {
            console.warn("Lỗi tải đề từ Supabase custom_links:", e);
        }
    }

    const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
    const catObj = allCats.find(c => c.id === targetCat);
    if (catObj && Array.isArray(catObj.links)) {
        catObj.links.forEach(l => {
            if (l && l.title && String(l.title).trim() !== "") {
                let t = l.timestamp || (typeof parseDateString === 'function' ? parseDateString(l.date) : 0) || 0;
                rawExams.push({
                    id: (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(l) || l.id) : l.id,
                    title: l.title,
                    timestamp: t
                });
            }
        });
    }

    rawExams.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const uniqueExams = [];
    const seenTitles = new Set();
    rawExams.forEach(ex => {
        const norm = ex.title.trim().toLowerCase();
        if (!seenTitles.has(norm)) {
            seenTitles.add(norm);
            uniqueExams.push(ex);
        }
    });

    let top5Exams = uniqueExams.slice(0, 5);

    if (top5Exams.length === 0) {
        const driveClassClean = getCleanDriveClassName(targetCat);
        top5Exams.push({
            id: `DE_TU_LUAN_${driveClassClean}`,
            title: `Đề tự luận ${driveClassClean}`,
            timestamp: Date.now()
        });
    }

    currentTuLuanModalData.availableExams = top5Exams;
    selector.innerHTML = "";

    top5Exams.forEach((ex, idx) => {
        const opt = document.createElement("option");
        opt.value = ex.id;
        opt.innerText = `${idx + 1}. ${ex.title}`;
        opt.dataset.title = ex.title;
        selector.appendChild(opt);
    });

    let selectedExam = top5Exams[0];
    if (preferredExamId) {
        const found = top5Exams.find(e => e.id === preferredExamId || e.title === preferredExamId);
        if (found) selectedExam = found;
    }
    selector.value = selectedExam.id;

    updateTuLuanAdminUI();
    await switchTuLuanExam(selectedExam.id, selectedExam.title);
}

async function switchTuLuanExam(examId, examTitle) {
    const classSelector = document.getElementById("tuluan-class-selector");
    if (classSelector && classSelector.value) {
        currentTuLuanModalData.classId = classSelector.value;
    }

    currentTuLuanModalData.quizId = examId;
    currentTuLuanModalData.examTitle = examTitle;

    const folderKey = getUnifiedExamFolderKey(examTitle, "", examId);
    const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);

    const headTitle = document.getElementById("tuluan-modal-heading");
    const pathCode = document.getElementById("tuluan-drive-folder-path");
    if (headTitle) headTitle.innerText = `📤 NỘP BÀI TỰ LUẬN - ${examTitle}`;
    if (pathCode) pathCode.innerText = `BAI_TAP_TU_LUAN / ${driveClassName} / ${folderKey} / [STT_SBD_HỌ_TÊN]`;

    updateTuLuanAdminUI();

    await loadTuLuanSubmissionsFromSupabase();
    if (typeof renderDapAnChamUI === "function") renderDapAnChamUI();
    if (typeof renderTuLuanStudentsTable === "function") renderTuLuanStudentsTable();
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

async function deleteCurrentTuLuanExam(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!checkCurrentIsAdmin()) {
        alert("⛔ Chỉ Giáo viên quản trị mới có quyền xóa đề thi!");
        return;
    }

    const classSelector = document.getElementById("tuluan-class-selector");
    const classId = (classSelector && classSelector.value) ? classSelector.value : (currentTuLuanModalData.classId || "lop-11a");
    const className = getCleanDriveClassName(classId);

    const selector = document.getElementById("tuluan-exam-selector");
    if (!selector || !selector.value) {
        alert("⚠️ Vui lòng chọn một đề để xóa!");
        return;
    }

    const examId = selector.value;
    const selectedOpt = selector.options[selector.selectedIndex];
    let examTitle = selectedOpt ? (selectedOpt.dataset.title || selectedOpt.innerText) : examId;
    examTitle = examTitle.replace(/^\d+\.\s*/, '').trim();

    if (!confirm(`⚠️ XÁC NHẬN XÓA ĐỀ TỰ LUẬN (ADMIN):\n\nThầy có chắc chắn muốn XÓA đề:\n"${examTitle}"\nkhỏi danh sách nộp bài của lớp ${className} không?\n\n(Hệ thống sẽ gỡ bỏ đề này khỏi lớp ${className} và cập nhật tức thì).`)) {
        return;
    }

    const btn = document.getElementById("btn-del-current-exam");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang xóa...";
    }

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

        const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
        const catObj = allCats.find(c => c.id === classId);
        if (catObj && Array.isArray(catObj.links)) {
            catObj.links = catObj.links.filter(l => (l.id !== examId && l.firebaseId !== examId && l.title !== examTitle));
        }

        alert(`🗑️ Đã xóa đề "${examTitle}" của lớp ${className} thành công!`);
        await refreshTuLuanExamList(classId);
    } catch(err) {
        alert("❌ Lỗi khi xóa đề: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🗑️ Xóa đề";
        }
    }
}

async function promptAddNewTuLuanExam() {
    const inputTitle = prompt("➕ NHẬP TÊN ĐỀ THI TỰ LUẬN MỚI (VD: Đề 109 Giữa Kỳ 1, Đề 108 Toán 11...):");
    if (!inputTitle || !inputTitle.trim()) return;

    const examTitle = inputTitle.trim();
    const classSelector = document.getElementById("tuluan-class-selector");
    const classId = (classSelector && classSelector.value) ? classSelector.value : (currentTuLuanModalData.classId || "lop-11a");
    currentTuLuanModalData.classId = classId;

    const examId = "exam_" + Date.now();
    const folderKey = getUnifiedExamFolderKey(examTitle, "", examId);
    const driveClassName = getCleanDriveClassName(classId);

    try {
        const client = getDbClient();
        if (client) {
            await client.from('custom_links').upsert({
                id: examId,
                category_id: classId,
                title: examTitle,
                is_doc: true,
                badge_text: "MỚI",
                timestamp: Date.now(),
                date: new Date().toLocaleDateString("vi-VN"),
                url: "#"
            });
        }

        const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
            ? GOOGLE_DRIVE_TULUAN_GAS_URL 
            : GOOGLE_DRIVE_UPLOAD_GAS_URL;

        if (gasUrl && !gasUrl.includes("DÁN_URL")) {
            fetch(gasUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "createExamFolders",
                    rootFolder: "BAI_TAP_TU_LUAN",
                    className: driveClassName,
                    class: driveClassName,
                    lop: driveClassName,
                    classList: [driveClassName],
                    examTitle: folderKey,
                    folderKey: folderKey
                })
            }).catch(() => null);
        }

        alert(`✅ Đã thêm đề "${examTitle}" thành công cho lớp ${driveClassName}!`);
        await refreshTuLuanExamList(classId, examId);
    } catch(err) {
        alert("❌ Lỗi khi thêm đề: " + err.message);
    }
}

async function loadTuLuanSubmissionsFromSupabase() {
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    const client = getDbClient();
    if (!client) {
        currentTuLuanModalData.submissionsMap = {};
        currentTuLuanModalData.dapAnCham = null;
        return;
    }

    try {
        const [subsRes, passRes, dapanRes, detailScoresRes] = await Promise.all([
            client.from('tu_luan_submissions').select('*').eq('quiz_id', qId),
            client.from('app_key_values').select('value').eq('key', 'student_custom_passwords').single(),
            client.from('app_key_values').select('value').eq('key', 'dapan_' + qId).single(),
            client.from('app_key_values').select('value').eq('key', 'detail_scores_' + qId).single()
        ]);

        const backupDetailsMap = (detailScoresRes && detailScoresRes.data && detailScoresRes.data.value && typeof detailScoresRes.data.value === 'object')
            ? detailScoresRes.data.value 
            : {};

        let combined = {};
        if (subsRes && Array.isArray(subsRes.data)) {
            subsRes.data.forEach(row => {
                if (row && row.sbd) {
                    let dScores = {};
                    if (row.detail_scores) {
                        try {
                            dScores = (typeof row.detail_scores === 'object') ? row.detail_scores : JSON.parse(row.detail_scores);
                        } catch(e) {}
                    }
                    if (Object.keys(dScores).length === 0 && backupDetailsMap[row.sbd] && backupDetailsMap[row.sbd].detailScores) {
                        dScores = backupDetailsMap[row.sbd].detailScores;
                    }

                    combined[row.sbd] = {
                        stt: row.stt,
                        sbd: row.sbd,
                        studentName: row.student_name,
                        className: row.class_name,
                        examTitle: row.exam_title,
                        lastSubmit: row.last_submit,
                        lastSubmitTime: row.last_submit_time,
                        count: row.count || (Array.isArray(row.images) ? row.images.length : 0),
                        images: Array.isArray(row.images) ? row.images : [],
                        crossScore: row.cross_score || "",
                        crossScoreBy: row.cross_score_by || "",
                        crossScoreTime: row.cross_score_time || "",
                        feedback: row.feedback || "",
                        feedbackTime: row.feedback_time || "",
                        isApproved: !!row.is_approved,
                        detailScores: dScores,
                        questionCount: (backupDetailsMap[row.sbd] && backupDetailsMap[row.sbd].questionCount) || detectExamQuestionCount()
                    };
                }
            });
        }
        currentTuLuanModalData.submissionsMap = combined;

        if (passRes && passRes.data && passRes.data.value) {
            currentTuLuanModalData.customPasswords = passRes.data.value;
        } else {
            currentTuLuanModalData.customPasswords = {};
        }

        if (dapanRes && dapanRes.data && dapanRes.data.value && dapanRes.data.value.fileUrl) {
            currentTuLuanModalData.dapAnCham = dapanRes.data.value;
        } else {
            currentTuLuanModalData.dapAnCham = null;
        }
    } catch(e) {
        console.warn("Lỗi đọc dữ liệu tự luận Supabase:", e);
        currentTuLuanModalData.submissionsMap = {};
        currentTuLuanModalData.dapAnCham = null;
    }
}

function startTuLuanRealtimeListener(quizId) {
    const client = getDbClient();
    if (!client || !quizId) return;

    if (tuLuanRealtimeChannel) {
        try { client.removeChannel(tuLuanRealtimeChannel); } catch(e) {}
        tuLuanRealtimeChannel = null;
    }

    try {
        tuLuanRealtimeChannel = client.channel(`tuluan_realtime_${quizId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tu_luan_submissions',
                filter: `quiz_id=eq.${quizId}`
            }, async () => {
                await loadTuLuanSubmissionsFromSupabase();
                if (typeof renderDapAnChamUI === "function") renderDapAnChamUI();
                if (typeof renderTuLuanStudentsTable === "function") renderTuLuanStudentsTable();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'app_key_values',
                filter: `key=eq.dapan_${quizId}`
            }, async () => {
                await loadTuLuanSubmissionsFromSupabase();
                if (typeof renderDapAnChamUI === "function") renderDapAnChamUI();
            })
            .subscribe();
    } catch(e) {
        console.warn("Lỗi kết nối Supabase Realtime channel:", e);
    }
}

async function handleToggleApproveStudent(cleanSbd, isChecked) {
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').update({
                is_approved: isChecked
            }).eq('quiz_id', qId).eq('sbd', cleanSbd);
        }

        if (currentTuLuanModalData.submissionsMap[cleanSbd]) {
            currentTuLuanModalData.submissionsMap[cleanSbd].isApproved = isChecked;
        }
        if (typeof renderTuLuanStudentsTable === "function") renderTuLuanStudentsTable();
    } catch(err) {
        alert("❌ Lỗi cập nhật phê duyệt: " + err.message);
    }
}

async function toggleApproveAllSubmissions(isApproved) {
    const qId = currentTuLuanModalData.quizId;
    const subMap = currentTuLuanModalData.submissionsMap || {};
    const keys = Object.keys(subMap);
    if (keys.length === 0) {
        alert("ℹ️ Chưa có bài nộp nào để phê duyệt!");
        return;
    }

    if (!confirm(`Bạn có chắc muốn ${isApproved ? 'PHÊ DUYỆT TẤT CẢ' : 'HỦY DUYỆT'} bài làm của đề này không?`)) return;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').update({
                is_approved: isApproved
            }).eq('quiz_id', qId);
        }

        keys.forEach(k => { if (subMap[k]) subMap[k].isApproved = isApproved; });
        if (typeof renderTuLuanStudentsTable === "function") renderTuLuanStudentsTable();
        alert(`✅ Đã cập nhật trạng thái phê duyệt cho ${keys.length} học sinh!`);
    } catch(e) {
        alert("❌ Lỗi duyệt bài: " + e.message);
    }
}

function filterTuLuanStudentTable() { 
    if (typeof renderTuLuanStudentsTable === "function") renderTuLuanStudentsTable(); 
}

function filterTuLuanStatus(filterType) {
    currentTuLuanModalData.statusFilter = filterType;
    document.querySelectorAll(".tuluan-tab-pill").forEach(p => p.classList.remove("active"));
    const activeBtn = document.getElementById(`tab-filter-${filterType}`);
    if (activeBtn) activeBtn.classList.add("active");
    if (typeof renderTuLuanStudentsTable === "function") renderTuLuanStudentsTable();
}