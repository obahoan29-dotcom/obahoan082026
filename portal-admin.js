// =========================================================
// FILE: portal-admin.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG)
// =========================================================

let currentEditingTimeQuizId = null;
let currentEditingTimeMode = null;

function parseScriptOrJson(content) {
    if (!content) return null;
    let clean = String(content).trim();
    clean = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, '').trim();
    if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();

    try {
        return JSON.parse(clean);
    } catch(e) {
        try {
            return new Function("return (" + clean + ");")();
        } catch(e2) {
            return null;
        }
    }
}

function mergeQuestionsAndAnswers(examObj, answerObj) {
    if (!examObj || !examObj.questions || !answerObj) return examObj;
    const answersMap = answerObj.answers || answerObj.dapan || answerObj;

    examObj.questions.forEach((q, idx) => {
        const qKey = String(q.id || (idx + 1));
        const itemAns = answersMap[qKey] || answersMap[q.id];

        if (itemAns !== undefined) {
            if (typeof itemAns === 'object' && itemAns !== null) {
                if (itemAns.correct !== undefined) q.correct = itemAns.correct;
                if (itemAns.correctAnswer !== undefined) q.correctAnswer = itemAns.correctAnswer;
                if (itemAns.explanation !== undefined) q.explanation = itemAns.explanation;
                if (itemAns.statements && q.statements) {
                    q.statements.forEach(st => {
                        if (itemAns.statements[st.id] !== undefined) st.correct = itemAns.statements[st.id];
                    });
                }
            } else {
                if (q.type === 'multiple_choice') q.correct = itemAns;
                else q.correctAnswer = String(itemAns);
            }
        }
    });
    return examObj;
}

function getSelectedAdminCategories() {
    return Array.from(document.querySelectorAll('input[name="admin-cat-checkbox"]:checked')).map(cb => cb.value);
}

function toggleAllAdminCategories(checkAll) {
    document.querySelectorAll('input[name="admin-cat-checkbox"]').forEach(cb => {
        cb.checked = checkAll;
        const parent = cb.closest('.cat-checkbox-item');
        if (parent) parent.classList.toggle('checked', checkAll);
    });
}

function handleCatCheckboxChange(checkbox) {
    const parent = checkbox.closest('.cat-checkbox-item');
    if (parent) parent.classList.toggle('checked', checkbox.checked);
}

function initAvatarGrid() {
    const grid = document.getElementById("avatar-grid");
    if (!grid) return;
    grid.innerHTML = "";
    selectedAvatarUrl = PRESET_AVATARS[0];
    PRESET_AVATARS.forEach((url, index) => {
        let img = document.createElement("img");
        img.src = url;
        img.className = "avatar-option " + (index === 0 ? "selected" : "");
        img.onclick = () => {
            document.querySelectorAll(".avatar-option").forEach(el => el.classList.remove("selected"));
            img.classList.add("selected");
            selectedAvatarUrl = url;
        };
        grid.appendChild(img);
    });
}

function switchAdminTab(tabName) {
    ['quiz', 'drive', 'doc'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const content = document.getElementById(`admin-tab-${t}`);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (content) content.style.display = (t === tabName ? 'block' : 'none');
    });
}

function autoFillDriveTitle(fileInput) {
    const titleInput = document.getElementById("admin-drive-title");
    if (fileInput.files.length > 0 && titleInput && !titleInput.value.trim()) {
        titleInput.value = fileInput.files[0].name.replace(/\.[^/.]+$/, "");
    }
}

function readFileAsTextAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = err => reject(err);
        reader.readAsText(file);
    });
}

// ĐĂNG ĐỀ THI LÊN SUPABASE
async function processUpload() {
    const fileInput = document.getElementById("admin-file-upload");
    const answerFileInput = document.getElementById("admin-answer-file-upload");
    const customTitleInput = document.getElementById("admin-quiz-custom-title");
    const categories = getSelectedAdminCategories();
    const btn = document.getElementById("btn-create-quiz");

    if (categories.length === 0) { alert("⚠️ Vui lòng chọn ít nhất 1 lớp để đăng đề!"); return; }
    if (!fileInput || fileInput.files.length === 0) { alert("⚠️ Vui lòng chọn file câu hỏi!"); return; }

    btn.innerText = "⏳ Đang xử lý..."; btn.disabled = true;

    try {
        const qContent = await readFileAsTextAsync(fileInput.files[0]);
        let parsedExam = parseScriptOrJson(qContent);

        if (!parsedExam || !parsedExam.questions) throw new Error("File đề thi thiếu mảng questions!");

        if (answerFileInput && answerFileInput.files.length > 0) {
            const aContent = await readFileAsTextAsync(answerFileInput.files[0]);
            let parsedAnswers = parseScriptOrJson(aContent);
            if (parsedAnswers) parsedExam = mergeQuestionsAndAnswers(parsedExam, parsedAnswers);
        }

        const customTitle = customTitleInput ? customTitleInput.value.trim() : "";
        if (customTitle) parsedExam.title = customTitle;
        if (!parsedExam.title) parsedExam.title = fileInput.files[0].name.replace(/\.[^/.]+$/, "");

        const quizId = "quiz_" + Date.now();
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;

        // 1. LƯU ĐỀ VÀO BẢNG QUIZZES
        await supabaseClient.from('quizzes').insert([{
            id: quizId,
            title: parsedExam.title,
            made: parsedExam.maDe || "101",
            time_limit_minutes: parsedExam.timeLimitMinutes || 90,
            scoring_config: parsedExam.scoringConfig || { mode: 'option1' },
            images: parsedExam.images || {},
            questions: parsedExam.questions
        }]);

        // 2. TẠO LIÊN KẾT CHO TỪNG LỚP TRONG BẢNG CUSTOM_LINKS
        const linkRows = categories.map(cat => ({
            id: quizId,
            category_id: cat,
            title: parsedExam.title,
            date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT",
            is_hot: true,
            is_doc: false,
            avatar: selectedAvatarUrl,
            timestamp: Date.now(),
            is_shuffled: true,
            allow_free: true,
            scoring_config: parsedExam.scoringConfig || { mode: 'option1' }
        }));

        await supabaseClient.from('custom_links').insert(linkRows);

        alert(`✨ Tạo đề thi "${parsedExam.title}" thành công!`);
        window.location.reload();
    } catch (err) {
        alert("❌ Lỗi: " + err.message);
    } finally {
        btn.innerText = "✨ Đăng đề thi"; btn.disabled = false;
    }
}

// XÓA MỤC ĐỀ HOẶC TÀI LIỆU
async function deleteItem(categoryId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA vĩnh viễn mục này không?")) return;

    try {
        await supabaseClient.from('custom_links').delete().match({ id: itemId, category_id: categoryId });
        if (itemId.startsWith('quiz_')) {
            await supabaseClient.from('quizzes').delete().match({ id: itemId });
        }
        window.location.reload();
    } catch(e) {
        alert("Lỗi khi xóa!");
    }
}

// ĐỔI THỜI GIAN LÀM BÀI
async function saveExamTimeConfig() {
    if (!currentEditingTimeQuizId) return;
    const btn = document.getElementById("btn-save-exam-time");
    btn.innerText = "⏳ Đang lưu..."; btn.disabled = true;

    try {
        let payload = {};
        if (currentEditingTimeMode === 'minutes') {
            const mins = parseInt(document.getElementById("edit-time-limit").value, 10);
            if (isNaN(mins) || mins <= 0) return alert("Vui lòng nhập số phút hợp lệ!");
            payload.time_limit_minutes = mins;
        } else if (currentEditingTimeMode === 'schedule') {
            payload.exam_start_time = document.getElementById("edit-start-time").value;
            payload.exam_end_time = document.getElementById("edit-end-time").value;
        }

        await supabaseClient.from('quizzes').update(payload).match({ id: currentEditingTimeQuizId });
        alert("✅ Đã cập nhật thời gian đề thi!");
        closeExamTimeModal();
        window.location.reload();
    } catch(e) {
        alert("Lỗi: " + e.message);
    } finally {
        btn.innerText = "Lưu cấu hình"; btn.disabled = false;
    }
}