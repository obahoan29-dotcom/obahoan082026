// =========================================================
// FILE 2: portal-admin.js (FIX LƯU ĐẦY ĐỦ SỐ PHÚT VÀO CUSTOM_LINKS)
// =========================================================

let currentEditingTimeQuizId = null;
let currentEditingTimeItemId = null;
let currentEditingTimeMode = null;

function updateRedirectUIElements() {
    const toggle = document.getElementById("admin-redirect-toggle");
    const statusTxt = document.getElementById("admin-redirect-status-txt");
    const urlInput = document.getElementById("admin-redirect-url-input");

    const isEnabled = Boolean(SITE_REDIRECT_CONFIG && SITE_REDIRECT_CONFIG.enabled);
    if (toggle) toggle.checked = isEnabled;
    if (statusTxt) {
        statusTxt.innerText = isEnabled ? "BẬT (Đang chuyển hướng)" : "TẮT (Để im web này)";
        statusTxt.style.color = isEnabled ? "#dc2626" : "#64748b";
    }
    if (urlInput) {
        urlInput.value = (SITE_REDIRECT_CONFIG && SITE_REDIRECT_CONFIG.targetUrl) || DEFAULT_BACKUP_WEB_URL;
    }
}

async function handleSiteRedirectToggle(isChecked) {
    const urlInput = document.getElementById("admin-redirect-url-input");
    const targetUrl = (urlInput && urlInput.value.trim()) ? urlInput.value.trim() : DEFAULT_BACKUP_WEB_URL;

    SITE_REDIRECT_CONFIG.enabled = isChecked;
    SITE_REDIRECT_CONFIG.targetUrl = targetUrl;
    updateRedirectUIElements();

    try {
        localStorage.setItem("site_redirect_config", JSON.stringify({
            enabled: isChecked,
            targetUrl: targetUrl,
            updatedAt: Date.now()
        }));
    } catch(e) {}

    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'site_redirect_config',
                value: {
                    enabled: isChecked,
                    targetUrl: targetUrl,
                    updatedAt: Date.now()
                }
            });
        }
        if (isChecked) {
            alert(`⚠️ ĐÃ BẬT TỰ ĐỘNG CHUYỂN HƯỚNG!\n\nToàn bộ học sinh mở web này sẽ tự động chuyển sang:\n👉 ${targetUrl}\n\n(Thầy là Admin nên luôn được giữ lại trang chính này an toàn 100%)`);
        } else {
            alert("✅ ĐÃ TẮT CHUYỂN HƯỚNG!\nHọc sinh sẽ vào và làm bài trên web này bình thường.");
        }
    } catch(err) {
        console.warn("Lỗi lưu Supabase:", err);
    }
}

async function saveSiteRedirectUrl() {
    const urlInput = document.getElementById("admin-redirect-url-input");
    if (!urlInput || !urlInput.value.trim()) return alert("Vui lòng nhập đường dẫn web dự phòng!");
    
    let newUrl = urlInput.value.trim();
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
        newUrl = "https://" + newUrl;
        urlInput.value = newUrl;
    }

    SITE_REDIRECT_CONFIG.targetUrl = newUrl;

    try {
        localStorage.setItem("site_redirect_config", JSON.stringify({
            enabled: SITE_REDIRECT_CONFIG.enabled,
            targetUrl: newUrl,
            updatedAt: Date.now()
        }));
    } catch(e) {}

    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'site_redirect_config',
                value: {
                    enabled: SITE_REDIRECT_CONFIG.enabled,
                    targetUrl: newUrl,
                    updatedAt: Date.now()
                }
            });
        }
        alert("✅ Đã cập nhật địa chỉ web dự phòng thành công!");
    } catch(err) {
        alert("❌ Lỗi lưu: " + err.message);
    }
}

function parseScriptOrJson(content) {
    if (!content) return null;
    let clean = String(content).trim();
    try {
        return JSON.parse(clean);
    } catch(e) {}

    try {
        let scriptText = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, 'return ');
        return new Function(scriptText)();
    } catch(e) {
        clean = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, '').trim();
        clean = clean.replace(/;?(\s*\/\*[\s\S]*?\*\/|\s*\/\/.*)*\s*$/, '').trim();
        if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();
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

// FIX YÊU CẦU 4: LƯU ĐẦY ĐỦ SỐ PHÚT VÀO CẢ QUIZZES VÀ CUSTOM_LINKS
async function processUpload() {
    const fileInput = document.getElementById("admin-file-upload");
    const answerFileInput = document.getElementById("admin-answer-file-upload");
    const customTitleInput = document.getElementById("admin-quiz-custom-title");
    const categories = getSelectedAdminCategories();
    const btn = document.getElementById("btn-create-quiz");

    if (categories.length === 0) { alert("⚠️ Vui lòng chọn ít nhất 1 lớp để đăng đề!"); return; }
    if (!fileInput || fileInput.files.length === 0) { alert("⚠️ Vui lòng chọn file đề thi!"); return; }

    btn.innerText = "⏳ Đang xử lý..."; btn.disabled = true;

    try {
        const qContent = await readFileAsTextAsync(fileInput.files[0]);
        let parsedExam = parseScriptOrJson(qContent);

        if (!parsedExam || !parsedExam.questions) throw new Error("File đề thi không đúng cấu trúc (thiếu trường questions)!");

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

        // Lấy chính xác thời lượng thi từ file đề (VD: đề 110 là 90 phút)
        const finalTimeLimitMinutes = parseInt(parsedExam.timeLimitMinutes, 10) || 90;
        const examStartStr = parsedExam.examStartTimeStr || null;
        const examEndStr = parsedExam.examEndTimeStr || null;

        // 1. Lưu vào bảng quizzes
        await supabaseClient.from('quizzes').insert([{
            id: quizId,
            title: parsedExam.title,
            made: parsedExam.maDe || "101",
            time_limit_minutes: finalTimeLimitMinutes,
            exam_start_time: examStartStr,
            exam_end_time: examEndStr,
            scoring_config: parsedExam.scoringConfig || { mode: 'option1' },
            images: parsedExam.images || {},
            questions: parsedExam.questions
        }]);

        // 2. Tạo liên kết cho từng lớp trong custom_links (ĐÃ BỔ SUNG time_limit_minutes)
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
            time_limit_minutes: finalTimeLimitMinutes,
            exam_start_time_str: examStartStr,
            exam_end_time_str: examEndStr,
            scoring_config: parsedExam.scoringConfig || { mode: 'option1' }
        }));

        await supabaseClient.from('custom_links').insert(linkRows);

        alert(`✨ Đăng đề thi "${parsedExam.title}" (${finalTimeLimitMinutes} phút) thành công!`);
        window.location.reload(); 
    } catch (err) { 
        alert("❌ Lỗi: " + err.message); 
    } finally { 
        btn.innerText = "✨ Đăng đề thi"; btn.disabled = false; 
    }
}

async function processUploadToGoogleDrive() {
    const fileInput = document.getElementById("admin-drive-file");
    const titleInput = document.getElementById("admin-drive-title");
    const categories = getSelectedAdminCategories();
    const btn = document.getElementById("btn-upload-drive");
    const statusBox = document.getElementById("drive-upload-status");

    if (categories.length === 0) { alert("⚠️ Vui lòng tích chọn ít nhất 1 lớp / chuyên mục để đăng tài liệu!"); return; }
    if (!fileInput || fileInput.files.length === 0) { alert("⚠️ Vui lòng chọn file PDF, Word hoặc Ảnh trên máy tính!"); return; }
    if (!GOOGLE_DRIVE_UPLOAD_GAS_URL || GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
        alert("⚠️ Bạn chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL trong file app-config.js!"); return;
    }

    const file = fileInput.files[0];
    if (file.size > 25 * 1024 * 1024) { alert("⚠️ Dung lượng file quá lớn (> 25MB)!"); return; }

    let finalTitle = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : file.name;
    btn.disabled = true; btn.innerText = "⏳ Đang chuyển đổi...";
    if (statusBox) { statusBox.style.display = "block"; statusBox.innerText = `⏳ Đang đọc file "${file.name}"...`; }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                let rawResult = e.target.result || "";
                let base64Data = rawResult.includes("base64,") ? rawResult.split("base64,")[1] : rawResult.split(",")[1];
                btn.innerText = "🚀 Đang tải lên Drive...";

                let mimeType = file.type || "application/octet-stream";
                const payload = { filename: file.name, mimeType: mimeType, base64: base64Data };

                const res = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                const result = await res.json();
                if (result.status === "success" && result.fileUrl) {
                    const docId = "doc_" + Date.now();
                    const now = new Date();
                    const pad = n => String(n).padStart(2, '0');
                    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
                    
                    const saveTasks = categories.map(cat => ({
                        id: docId,
                        category_id: cat,
                        title: finalTitle,
                        date: dateStr,
                        url: result.fileUrl,
                        badge_text: "MỚI",
                        is_hot: false,
                        is_doc: true,
                        avatar: selectedAvatarUrl,
                        timestamp: Date.now()
                    }));

                    await supabaseClient.from('custom_links').insert(saveTasks);
                    alert(`🎉 Tải file lên Google Drive thành công!\n📁 Tên: ${finalTitle}`);
                    window.location.reload();
                } else {
                    throw new Error(result.message || "Máy chủ Drive không phản hồi!");
                }
            } catch(uploadErr) {
                alert("❌ Lỗi khi tải file: " + uploadErr.message);
                btn.disabled = false; btn.innerText = "📤 Tải lên Drive";
                if (statusBox) statusBox.style.display = "none";
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        alert("❌ Lỗi đọc file: " + err.message);
        btn.disabled = false; btn.innerText = "📤 Tải lên Drive";
        if (statusBox) statusBox.style.display = "none";
    }
}

async function processAddDocument() {
    const titleInput = document.getElementById("admin-doc-title").value.trim();
    const urlInput = document.getElementById("admin-doc-url").value.trim();
    const categories = getSelectedAdminCategories();
    const btn = document.getElementById("btn-create-doc");

    if (categories.length === 0) { alert("⚠️ Vui lòng chọn ít nhất 1 mục để đăng!"); return; }
    if (!titleInput || !urlInput) { alert("⚠️ Vui lòng nhập đủ tên tài liệu và đường link!"); return; }

    btn.innerText = "⏳ Đang đăng..."; btn.disabled = true;

    try {
        const docId = "doc_" + Date.now();
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        
        const tasks = categories.map(cat => ({
            id: docId,
            category_id: cat,
            title: titleInput,
            date: dateStr,
            url: urlInput,
            badge_text: "NONE",
            is_hot: false,
            is_doc: true,
            avatar: selectedAvatarUrl,
            timestamp: Date.now()
        }));

        await supabaseClient.from('custom_links').insert(tasks);
        alert(`📤 Đăng tài liệu thành công!`);
        window.location.reload(); 
    } catch (err) { alert("❌ Lỗi: " + err.message); } 
    finally { btn.innerText = "🔗 Đăng tài liệu"; btn.disabled = false; }
}

async function deleteItem(categoryId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA vĩnh viễn mục này không?")) return;

    try {
        await supabaseClient.from('custom_links').delete().match({ id: itemId, category_id: categoryId });
        if (itemId.startsWith('quiz_')) {
            await supabaseClient.from('quizzes').delete().match({ id: itemId });
            await supabaseClient.from('submissions').delete().match({ quiz_id: itemId });
            await supabaseClient.from('live_drafts').delete().match({ quiz_id: itemId });
            await supabaseClient.from('active_sessions').delete().match({ quiz_id: itemId });
        }
        window.location.reload();
    } catch(e) {
        alert("Lỗi khi xóa: " + e.message);
    }
}

async function renameItem(categoryId, itemId, isDoc, currentTitle, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    let newTitle = prompt("✏️ Nhập tên mới:", currentTitle);
    if (newTitle !== null && newTitle.trim() !== "" && newTitle.trim() !== currentTitle) {
        try {
            await supabaseClient.from('custom_links').update({ title: newTitle.trim() }).match({ id: itemId, category_id: categoryId });
            if (!isDoc && itemId.startsWith('quiz_')) {
                await supabaseClient.from('quizzes').update({ title: newTitle.trim() }).match({ id: itemId });
            }
            window.location.reload();
        } catch(e) { alert("Lỗi khi sửa tên!"); }
    }
}

async function moveItemOrder(categoryId, currentId, direction, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    try {
        const { data: arr } = await supabaseClient.from('custom_links').select('*').eq('category_id', categoryId).order('timestamp', { ascending: false });
        if (!arr || arr.length === 0) return;

        const currentIndex = arr.findIndex(item => item.id === currentId);
        if (currentIndex === -1) return;

        let targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex >= 0 && targetIndex < arr.length) {
            let currentItem = arr[currentIndex];
            let targetItem = arr[targetIndex];
            let tCurrent = currentItem.timestamp || Date.now();
            let tTarget = targetItem.timestamp || Date.now();

            if (tCurrent === tTarget) {
                tTarget = tCurrent + (direction === 'up' ? 10 : -10);
            }

            await supabaseClient.from('custom_links').update({ timestamp: tTarget }).match({ id: currentItem.id, category_id: categoryId });
            await supabaseClient.from('custom_links').update({ timestamp: tCurrent }).match({ id: targetItem.id, category_id: categoryId });
            window.location.reload();
        } else {
            alert(direction === 'up' ? "Mục này đã ở trên cùng!" : "Mục này đã ở dưới cùng!");
        }
    } catch(e) { alert("Lỗi đổi thứ tự: " + e.message); }
}

function openMoveModal(oldCategory, quizId, stringifiedData, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentMoveData = { oldCategory, quizId, quizData: JSON.parse(decodeURIComponent(stringifiedData)) };
    document.getElementById("move-category-select").value = oldCategory;
    document.getElementById("move-modal").style.display = "flex";
}
function closeMoveModal() { document.getElementById("move-modal").style.display = "none"; }

async function confirmMoveQuiz() {
    const newCategory = document.getElementById("move-category-select").value;
    if (newCategory === currentMoveData.oldCategory) { alert("Đã nằm ở mục này rồi!"); return; }
    try {
        let itemUrl = currentMoveData.quizData.url || "";
        try {
            if (itemUrl.includes("thi.html")) {
                let u = new URL(itemUrl, window.location.href);
                u.searchParams.set("cat", newCategory);
                itemUrl = u.pathname + u.search + u.hash;
            }
        } catch(e) {}

        const row = {
            id: currentMoveData.quizId,
            category_id: newCategory,
            title: currentMoveData.quizData.title,
            date: currentMoveData.quizData.date,
            url: itemUrl,
            badge_text: currentMoveData.quizData.badgeText || "HOT",
            is_hot: !!currentMoveData.quizData.isHot,
            is_doc: !!currentMoveData.quizData.isDoc,
            avatar: currentMoveData.quizData.avatar,
            time_limit_minutes: currentMoveData.quizData.timeLimitMinutes || 90,
            timestamp: Date.now()
        };

        await supabaseClient.from('custom_links').insert([row]);
        await supabaseClient.from('custom_links').delete().match({ id: currentMoveData.quizId, category_id: currentMoveData.oldCategory });
        window.location.reload();
    } catch(e) { alert("Lỗi khi chuyển: " + e.message); }
}

function openCopyModal(sourceCategory, itemId, stringifiedData, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentCopyData = { sourceCategory, itemId, itemData: JSON.parse(decodeURIComponent(stringifiedData)) };
    document.getElementById("copy-category-select").value = sourceCategory;
    document.getElementById("copy-modal").style.display = "flex";
}
function closeCopyModal() { document.getElementById("copy-modal").style.display = "none"; }

async function confirmCopyItem() {
    const destCategory = document.getElementById("copy-category-select").value;
    const btn = document.querySelector("#copy-modal .move-btn-submit");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang sao chép..."; }

    try {
        const isDoc = currentCopyData.itemData.isDoc;
        const newItemId = (isDoc ? "doc_" : "quiz_") + Date.now();
        let itemUrl = currentCopyData.itemData.url || "";

        if (!isDoc) {
            let oldQuizId = (typeof extractQuizIdFromItem === 'function') ? extractQuizIdFromItem(currentCopyData.itemData) : currentCopyData.itemData.id;
            if (oldQuizId) {
                const { data: quizData } = await supabaseClient.from('quizzes').select('*').eq('id', oldQuizId).single();
                if (quizData) {
                    await supabaseClient.from('quizzes').insert([{ ...quizData, id: newItemId }]);
                }
            }
            itemUrl = `./thi.html?id=${newItemId}&cat=${encodeURIComponent(destCategory)}`;
        }

        await supabaseClient.from('custom_links').insert([{
            id: newItemId,
            category_id: destCategory,
            title: currentCopyData.itemData.title,
            date: currentCopyData.itemData.date,
            url: itemUrl,
            badge_text: currentCopyData.itemData.badgeText || "HOT",
            is_hot: !!currentCopyData.itemData.isHot,
            is_doc: !!isDoc,
            avatar: currentCopyData.itemData.avatar,
            time_limit_minutes: currentCopyData.itemData.timeLimitMinutes || 90,
            timestamp: Date.now()
        }]);

        alert("📋 Đã sao chép sang mục mới thành công!");
        window.location.reload();
    } catch(e) { 
        alert("Lỗi sao chép: " + e.message); 
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Sao chép"; }
    }
}

async function openEditMinutesModal(quizId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentEditingTimeQuizId = quizId;
    currentEditingTimeItemId = itemId;
    currentEditingTimeMode = 'minutes';

    document.getElementById("exam-time-modal-title").innerText = "⏱ Đổi thời lượng làm bài";
    document.getElementById("modal-time-minutes-group").style.display = "block";
    document.getElementById("modal-time-schedule-group").style.display = "none";
    document.getElementById("edit-time-limit").value = "";

    try {
        const { data: qData } = await supabaseClient.from('quizzes').select('time_limit_minutes').eq('id', quizId).single();
        if (qData && qData.time_limit_minutes) {
            document.getElementById("edit-time-limit").value = qData.time_limit_minutes;
        }
    } catch(e) {}

    document.getElementById("exam-time-modal").style.display = "flex";
}

async function openEditScheduleModal(quizId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentEditingTimeQuizId = quizId;
    currentEditingTimeItemId = itemId;
    currentEditingTimeMode = 'schedule';

    document.getElementById("exam-time-modal-title").innerText = "📅 Gia hạn khung giờ làm bài";
    document.getElementById("modal-time-minutes-group").style.display = "none";
    document.getElementById("modal-time-schedule-group").style.display = "block";

    const startInput = document.getElementById("edit-start-time");
    const endInput = document.getElementById("edit-end-time");
    startInput.value = "";
    endInput.value = "";

    try {
        const { data: qData } = await supabaseClient.from('quizzes').select('exam_start_time, exam_end_time').eq('id', quizId).single();
        if (qData) {
            if (qData.exam_start_time) startInput.value = qData.exam_start_time;
            if (qData.exam_end_time) endInput.value = qData.exam_end_time;
        }
    } catch(e) {}

    document.getElementById("exam-time-modal").style.display = "flex";
}

function closeExamTimeModal() {
    document.getElementById("exam-time-modal").style.display = "none";
    currentEditingTimeQuizId = null;
    currentEditingTimeItemId = null;
    currentEditingTimeMode = null;
}

async function saveExamTimeConfig() {
    if (!currentEditingTimeQuizId || !currentEditingTimeItemId) return;
    const btn = document.getElementById("btn-save-exam-time");
    btn.innerText = "⏳ Đang lưu..."; btn.disabled = true;

    try {
        let payload = {};
        if (currentEditingTimeMode === 'minutes') {
            const mins = parseInt(document.getElementById("edit-time-limit").value, 10);
            if (isNaN(mins) || mins <= 0) {
                alert("⚠️ Vui lòng nhập số phút hợp lệ (> 0)!");
                btn.innerText = "Lưu cấu hình"; btn.disabled = false;
                return;
            }
            payload.time_limit_minutes = mins;
        } else if (currentEditingTimeMode === 'schedule') {
            payload.exam_start_time = document.getElementById("edit-start-time").value;
            payload.exam_end_time = document.getElementById("edit-end-time").value;
        }

        await supabaseClient.from('quizzes').update(payload).match({ id: currentEditingTimeQuizId });
        await supabaseClient.from('custom_links').update(payload).match({ id: currentEditingTimeQuizId });

        alert("✅ Đã cập nhật thời gian đề thi thành công!");
        closeExamTimeModal();
        
        const timeBox = document.getElementById(`time-box-${currentEditingTimeItemId}`);
        if (timeBox && typeof buildTimeBoxHtml === 'function') {
            const { data } = await supabaseClient.from('custom_links').select('*').eq('id', currentEditingTimeItemId).single();
            if (data) {
                timeBox.innerHTML = buildTimeBoxHtml(
                    data.time_limit_minutes || payload.time_limit_minutes, 
                    data.exam_start_time_str || payload.exam_start_time, 
                    data.exam_end_time_str || payload.exam_end_time, 
                    data.date
                );
            }
        }
    } catch(e) {
        alert("❌ Lỗi lưu cấu hình: " + e.message);
    } finally {
        btn.innerText = "Lưu cấu hình"; btn.disabled = false;
    }
}

async function handleAllowFreeToggleChange(categoryId, itemId, isChecked, event) {
    if (event) event.stopPropagation();
    const txt = document.getElementById(`free-status-txt-${itemId}`);
    if (txt) {
        txt.innerText = isChecked ? 'BẬT' : 'TẮT';
        txt.className = `free-toggle-status ${isChecked ? 'st-on' : 'st-off'}`;
    }

    try {
        await supabaseClient.from('custom_links').update({ allow_free: isChecked }).match({ id: itemId, category_id: categoryId });
        await supabaseClient.from('quizzes').update({ allow_free: isChecked }).match({ id: itemId });
    } catch(e) {
        console.error("Lỗi toggle tự do:", e);
    }
}

async function toggleShuffle(categoryId, itemId, isChecked, event) {
    if (event) event.stopPropagation();
    try {
        await supabaseClient.from('custom_links').update({ is_shuffled: isChecked }).match({ id: itemId, category_id: categoryId });
        await supabaseClient.from('quizzes').update({ is_shuffled: isChecked }).match({ id: itemId });
    } catch(e) { alert("❌ Lỗi đổi trạng thái đảo đề!"); }
}

function openItemAvatarPicker(itemId, event) {
    if (!isAdminLoggedIn) return;
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const targetPop = document.getElementById(`avatar-popover-${itemId}`);
    const isAlreadyOpen = targetPop && targetPop.classList.contains("show");

    document.querySelectorAll(".avatar-selection-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".exam-card.has-active-popover").forEach(c => c.classList.remove("has-active-popover"));

    if (targetPop && !isAlreadyOpen) {
        targetPop.classList.add("show");
        const card = document.getElementById(`card-${itemId}`);
        if (card) card.classList.add("has-active-popover");
    }
}

function closeAvatarPopover(itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById(`avatar-popover-${itemId}`);
    if (pop) pop.classList.remove("show");
    const card = document.getElementById(`card-${itemId}`);
    if (card) card.classList.remove("has-active-popover");
}

async function selectItemAvatar(categoryId, itemId, avatarUrl, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    closeAvatarPopover(itemId, event);

    try {
        await supabaseClient.from('custom_links').update({ avatar: avatarUrl }).match({ id: itemId, category_id: categoryId });
        window.location.reload();
    } catch(e) { alert("❌ Lỗi đổi avatar: " + e.message); }
}

async function changeAvatarSize(categoryId, itemId, sizePx, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    try {
        await supabaseClient.from('custom_links').update({ avatar_size: sizePx }).match({ id: itemId, category_id: categoryId });
        window.location.reload();
    } catch(e) { alert("❌ Lỗi đổi cỡ avatar: " + e.message); }
}

window.handleSiteRedirectToggle = handleSiteRedirectToggle;
window.saveSiteRedirectUrl = saveSiteRedirectUrl;
window.updateRedirectUIElements = updateRedirectUIElements;
window.openEditMinutesModal = openEditMinutesModal;
window.openEditScheduleModal = openEditScheduleModal;
