// =========================================================
// FILE: qbank-mid-editor.js
// MODULE 3/4 CỦA HỆ THỐNG NGÂN HÀNG ĐỀ:
// - BỎ NÚT "✏️ SỬA ĐỀ" TRÊN THANH CÔNG CỤ TRÊN CÙNG CỘT GIỮA
// - MỞ CHẾ ĐỘ SỬA ĐỀ CHIA ĐÔI MÀN HÌNH NGAY KHI BẤM "✏️ SỬA" TRÊN TỪNG CÂU HỎI
// - TỰ ĐỘNG CUỘN & TÔ SÁNG ĐÚNG CÂU VỪA BẤM Ở CẢ 2 NỬA TRÁI & PHẢI
// - HỖ TRỢ UPLOAD ẢNH 2 TẦNG (IMGBB + NGẦM DRIVE) & NÚT "🔄 TẢI LẠI ẢNH"
// - TỰ ĐỘNG NHẬN DIỆN & ÁP DỤNG CÁC Ô 💻 MÃ THÔ ĐANG MỞ KHI BẤM ⚡ UPDATE
// - ĐỒNG BỘ THẲNG LÊN SUPABASE NGAY KHI BẤM ⚡ UPDATE
// =========================================================

let _qbEditResizerInitialized = false;
let _qbEditScrollSyncActivePane = null;
let _qbEditLastSyncedRightToLeft = null;
let _qbEditLastSyncedLeftToRight = null;

function ensureQbankMidEditControlsInDOM() {
    // Gỡ bỏ nút "Sửa đề" ở thanh trên cùng cột giữa (nếu có) vì đã tích hợp vào từng câu hỏi
    const oldTopEditBtn = document.getElementById("btn-qbank-toggle-edit-mode");
    if (oldTopEditBtn) oldTopEditBtn.remove();

    const colMid = document.getElementById("qbank-col-mid");
    if (colMid && !document.getElementById("qbank-mid-edit-workspace")) {
        const ws = document.createElement("div");
        ws.id = "qbank-mid-edit-workspace";
        ws.className = "qbank-mid-edit-workspace";
        ws.innerHTML = `
            <div class="qb-edit-topbar">
                <div class="qb-edit-topbar-title"><span>🔬</span><span>SỬA ĐỀ TRỰC TIẾP (CHIA ĐÔI CỘT GIỮA)</span></div>
                <div class="qb-edit-topbar-tools">
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-save" id="btn-qb-edit-save" onclick="commitQbankMidEditChanges(true)" title="Lưu cập nhật (Ctrl+S)">⚡ Update</button>
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-upload" onclick="qbEditTriggerUpload()">📂 Upload Đề</button>
                    <input type="file" id="qb-edit-file-input" accept=".json,.js,.txt" style="display:none;" onchange="qbEditHandleFileSelected(this)">
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-add" onclick="qbEditAddNewQuestion()">➕ Thêm câu mới</button>
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-json" onclick="qbEditDownloadJson()">💾 Tải JSON đề</button>
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-mode active" id="qb-edit-btn-mode-cards" onclick="qbEditSetMode('cards')">📑 Khối từng câu</button>
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-mode" id="qb-edit-btn-mode-raw" onclick="qbEditSetMode('raw')">💻 Mã nguồn thô</button>
                    <button type="button" class="btn-qb-edit-tool btn-qb-edit-close" onclick="closeQbankMidEditMode(false)">✕ Đóng sửa đề</button>
                </div>
            </div>
            <div class="qb-edit-split-body" id="qb-edit-split-body">
                <div class="qb-edit-left-pane" id="qb-edit-left-pane" style="width: 50%;">
                    <div class="qb-edit-pane-head">
                        <span style="font-size:12px; font-weight:900; color:#0f172a; display:flex; align-items:center; gap:4px;">👁️ HÌNH ẢNH ĐỀ THI THỰC TẾ (<span id="qb-edit-qcount" style="color:#0284c7;">0</span> câu)</span>
                        <div id="qb-edit-alert-box" class="soide-alert-box is-valid">✅ Cú pháp &amp; công thức hợp lệ</div>
                    </div>
                    <div id="qb-edit-preview-content"></div>
                </div>
                <div class="qb-edit-resizer" id="qb-edit-resizer" title="Kéo sang trái/phải để chỉnh độ rộng 2 nửa"></div>
                <div class="qb-edit-right-pane" id="qb-edit-right-pane" style="width: 50%;">
                    <div class="soide-drop-zone" id="qb-edit-drop-zone">
                        <div class="soide-drop-text" style="font-size:11px;"><span>📥</span> <span>Kéo thả file <b>.json / .js / .txt</b> vào đây hoặc bấm <b>Upload Đề</b>!</span></div>
                        <button type="button" class="btn-qb-edit-tool btn-qb-edit-upload" style="padding:3px 7px; font-size:10.5px;" onclick="qbEditTriggerUpload()">📁 Chọn file</button>
                    </div>
                    <div class="qb-edit-meta-grid">
                        <div><div class="soide-textarea-label">Tên đề thi:</div><input type="text" id="qb-edit-meta-title" class="soide-latex-input" style="font-size:12px !important; padding:3px 6px; min-height:28px;" oninput="qbEditUpdateMeta()"></div>
                        <div><div class="soide-textarea-label">Mã đề:</div><input type="text" id="qb-edit-meta-made" class="soide-latex-input" style="font-size:12px !important; padding:3px 6px; min-height:28px;" oninput="qbEditUpdateMeta()"></div>
                        <div><div class="soide-textarea-label">Số phút:</div><input type="number" id="qb-edit-meta-minutes" class="soide-latex-input" style="font-size:12px !important; padding:3px 6px; min-height:28px;" oninput="qbEditUpdateMeta()"></div>
                    </div>
                    <div id="qb-edit-cards-container" class="qb-edit-cards-list"></div>
                    <div id="qb-edit-raw-container" style="display:none; flex:1; flex-direction:column;">
                        <textarea id="qb-edit-raw-editor" class="soide-raw-textarea" spellcheck="false" oninput="qbEditHandleRawInput(this.value)"></textarea>
                    </div>
                </div>
            </div>
        `;
        colMid.appendChild(ws);
        setupQbEditResizerAndDrop();
        setupQbEditDualScrollSync();
    }
}

function toggleQbankMidEditMode(focusQId = null) {
    if (qbankMidEditState.isActive && !focusQId) closeQbankMidEditMode(false);
    else openQbankMidEditMode(focusQId);
}

function openQbankMidEditMode(focusQId = null) {
    if (!requireQbankAdminOrPrompt()) return;

    const nav = qbankState.pendingNav || { mode: "none", khoId: null, examId: null };
    const hasPartOrLevelFilter = Boolean(qbankState.activeFilter.part || qbankState.activeFilter.level);
    if (!focusQId && (nav.mode === "root" || nav.mode === "kho") && !qbankState.activeFilter.folderId && !hasPartOrLevelFilter) {
        showQbankToast("⚠️ Hãy bấm vào tên 1 Đề (hoặc chọn 1 thư mục bên trái) trước khi sửa!", "warning");
        return;
    }

    ensureQbankMidEditControlsInDOM();
    let visibleList = getFilteredAndSortedQuestions();

    // Nếu danh sách hiện tại quá dài (> 120 câu), tự lấy đúng trang 50 câu chứa focusQId để MathJax chạy siêu mượt
    if (visibleList.length > 120) {
        const pageSize = qbankState.pageSize || 50;
        let targetPage = qbankState.currentMidPage || 1;
        if (focusQId) {
            const foundIdx = visibleList.findIndex(q => q && String(q.id) === String(focusQId));
            if (foundIdx !== -1) {
                targetPage = Math.floor(foundIdx / pageSize) + 1;
            }
        }
        const startIdx = (targetPage - 1) * pageSize;
        visibleList = visibleList.slice(startIdx, startIdx + pageSize);
    }

    const clonedQ = JSON.parse(JSON.stringify(visibleList));

    let activePendingExamId = null;
    let activePendingKhoId = null;
    let activeTitle = qbankState.currentExamTitle || qbankState.activeFilter.folderName || "NGÂN HÀNG ĐỀ";

    if (!qbankState.activeFilter.folderId && nav.mode === "exam" && nav.examId) {
        const ex = (qbankState.pendingExams || []).find(e => e.id === nav.examId);
        activePendingExamId = nav.examId;
        activePendingKhoId = (ex && ex.khoId) || nav.khoId || null;
        if (ex && ex.title) activeTitle = ex.title;
    } else if (focusQId) {
        const focusedQ = clonedQ.find(q => q && String(q.id) === String(focusQId));
        if (focusedQ && focusedQ.pendingExamId) {
            activePendingExamId = focusedQ.pendingExamId;
            activePendingKhoId = focusedQ.pendingKhoId || null;
            if (focusedQ.sourceExam) activeTitle = focusedQ.sourceExam;
        }
    }

    qbankMidEditState.isActive = true;
    qbankMidEditState.questions = clonedQ;
    qbankMidEditState.images = JSON.parse(JSON.stringify(qbankState.imagesMap || {}));
    qbankMidEditState.editingSourceIds = new Set(clonedQ.map(q => String(q.id)));
    qbankMidEditState.pendingExamId = activePendingExamId;
    qbankMidEditState.pendingKhoId = activePendingKhoId;
    qbankMidEditState.title = activeTitle;
    qbankMidEditState.maDe = "QBANK";
    qbankMidEditState.timeLimitMinutes = 90;
    qbankMidEditState.editorMode = "cards";
    qbankMidEditState.rawEditingCardIds = new Set();
    qbankMidEditState.isDirty = false;

    const midExamBar = document.getElementById("qbank-mid-exam-bar"), matrixBar = document.getElementById("qbank-matrix-bar");
    const qList = document.getElementById("qbank-questions-list"), ws = document.getElementById("qbank-mid-edit-workspace");
    if (midExamBar) midExamBar.style.display = "none";
    if (matrixBar) matrixBar.style.display = "none";
    if (qList) qList.style.display = "none";
    if (ws) ws.classList.add("show");

    qbEditSetMode("cards");
    qbEditRenderBothSides();

    setTimeout(() => {
        qbEditAutoResizeAllTextareas();
        if (focusQId) {
            qbEditScrollToLeftPreview(focusQId, true);
            qbEditScrollToRightEditor(focusQId, true);
        }
    }, 80);

    showQbankToast(
        focusQId
            ? `✏️ Đã mở Sửa đề chia đôi ngay tại câu đang chọn (${clonedQ.length} câu)!`
            : `✏️ Đã mở chế độ Sửa đề chia đôi màn hình (${clonedQ.length} câu)!`,
        "info"
    );
}

async function closeQbankMidEditMode(forceSkipPrompt = false) {
    if (!qbankMidEditState.isActive) return;
    if (qbankMidEditState.isDirty && !forceSkipPrompt) {
        if (confirm("💾 Bạn vừa có chỉnh sửa trong chế độ Sửa đề.\n\nBấm [OK] để LƯU các thay đổi vào Ngân hàng đề trước khi đóng.\nBấm [Cancel] để đóng không lưu.")) {
            await commitQbankMidEditChanges(false);
            return;
        }
    }
    qbankMidEditState.isActive = false;
    qbankMidEditState.isDirty = false;
    qbankMidEditState.pendingExamId = null;
    qbankMidEditState.pendingKhoId = null;

    const midExamBar = document.getElementById("qbank-mid-exam-bar"), matrixBar = document.getElementById("qbank-matrix-bar");
    const qList = document.getElementById("qbank-questions-list"), ws = document.getElementById("qbank-mid-edit-workspace");
    if (ws) ws.classList.remove("show");
    if (midExamBar) midExamBar.style.display = "";
    if (matrixBar) matrixBar.style.display = "";
    if (qList) qList.style.display = "flex";

    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
}

function qbEditGetPartType(q) { return getQbankQuestionPart(q); }

function qbEditReorganizeQuestions(list) {
    if (!Array.isArray(list)) return [];
    return [
        ...list.filter(q => qbEditGetPartType(q) === 1),
        ...list.filter(q => qbEditGetPartType(q) === 2),
        ...list.filter(q => qbEditGetPartType(q) === 3),
        ...list.filter(q => qbEditGetPartType(q) === 4)
    ];
}

function qbEditInsertOrganizedByPart(newList) {
    if (!Array.isArray(newList) || newList.length === 0) return [];
    const cur = qbankMidEditState.questions || [];
    const p1 = cur.filter(q => qbEditGetPartType(q) === 1), p2 = cur.filter(q => qbEditGetPartType(q) === 2);
    const p3 = cur.filter(q => qbEditGetPartType(q) === 3), p4 = cur.filter(q => qbEditGetPartType(q) === 4);
    newList.forEach(nq => {
        const pt = qbEditGetPartType(nq);
        if (pt === 1) p1.push(nq); else if (pt === 2) p2.push(nq); else if (pt === 3) p3.push(nq); else p4.push(nq);
    });
    qbankMidEditState.questions = [...p1, ...p2, ...p3, ...p4];
    return newList;
}

function qbEditValidateSyntax(questions) {
    if (typeof validateExamSyntax === "function") return validateExamSyntax(questions);
    const errors = [];
    if (!Array.isArray(questions) || questions.length === 0) { errors.push("Đề thi chưa có câu hỏi nào!"); return errors; }
    questions.forEach((q, idx) => {
        const qNum = idx + 1;
        if (!q.question || !String(q.question).trim()) errors.push(`Câu ${qNum}: Nội dung câu hỏi đang để trống!`);
        else {
            const m = String(q.question).match(/(^|[^\\])\$/g);
            if (m && m.length % 2 !== 0) errors.push(`Câu ${qNum}: Dấu '$' chưa đóng mở cân bằng!`);
        }
    });
    return errors;
}

function qbEditSetValidationStatus(isValid, msg) {
    const alertBox = document.getElementById("qb-edit-alert-box");
    if (!alertBox) return;
    alertBox.className = isValid ? "soide-alert-box is-valid" : "soide-alert-box has-errors";
    alertBox.textContent = msg || "✅ Cú pháp & công thức hợp lệ";
}

function qbEditAutoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight + 4, 34) + "px";
}

function qbEditAutoResizeAllTextareas() {
    document.querySelectorAll("#qb-edit-cards-container textarea.soide-latex-input, #qb-edit-cards-container textarea.soide-card-raw-textarea").forEach(qbEditAutoResizeTextarea);
}

function qbEditGenerateNewUniqueId() {
    const used = new Set([...(qbankState.rawQuestions || []).map(x => String(x.id)), ...(qbankMidEditState.questions || []).map(x => String(x.id))]);
    let c; do { c = `qb_${Date.now()}_${Math.floor(Math.random() * 100000)}`; } while (used.has(c));
    return c;
}

function qbEditInheritActiveFolderMeta(newQ) {
    if (!newQ) return;
    const fId = qbankState.activeFilter.folderId;
    if (fId) {
        const node = findNodeInTree(qbankState.currentTree, fId);
        if (node && (!node.children || node.children.length === 0)) {
            newQ.folderId = node.id;
            newQ.folderName = node.name;
            newQ.level = normalizeQbankLevel(qbankState.activeFilter.level || "nb");
            newQ.assignedAt = Date.now();
            if (qbankMidEditState.pendingExamId) {
                newQ.pendingExamId = qbankMidEditState.pendingExamId;
                newQ.pendingKhoId = qbankMidEditState.pendingKhoId || "pending_11";
                newQ.sourceExam = qbankMidEditState.title || newQ.sourceExam || "";
            }
            return;
        }
    }
    newQ.folderId = null;
    newQ.folderName = "";
    newQ.level = normalizeQbankLevel(newQ.level || "nb");
    if (qbankMidEditState.pendingExamId) {
        newQ.pendingExamId = qbankMidEditState.pendingExamId;
        newQ.pendingKhoId = qbankMidEditState.pendingKhoId || "pending_11";
        newQ.sourceExam = qbankMidEditState.title || newQ.sourceExam || "";
    }
}

function qbEditUpdateMeta() {
    const t = document.getElementById("qb-edit-meta-title"), m = document.getElementById("qb-edit-meta-made"), min = document.getElementById("qb-edit-meta-minutes");
    if (t) qbankMidEditState.title = t.value;
    if (m) qbankMidEditState.maDe = m.value;
    if (min) qbankMidEditState.timeLimitMinutes = parseInt(min.value, 10) || 90;
    qbankMidEditState.isDirty = true;
    qbEditDebouncedLivePreview();
}

function qbEditRenderBothSides() { qbEditRenderRightEditor(); qbEditRenderLeftLivePreview(); }

function qbEditRenderRightEditor() {
    const t = document.getElementById("qb-edit-meta-title"), m = document.getElementById("qb-edit-meta-made"), min = document.getElementById("qb-edit-meta-minutes");
    if (t) t.value = qbankMidEditState.title || "";
    if (m) m.value = qbankMidEditState.maDe || "QBANK";
    if (min) min.value = qbankMidEditState.timeLimitMinutes || 90;

    const cardsContainer = document.getElementById("qb-edit-cards-container");
    if (!cardsContainer) return;
    cardsContainer.innerHTML = "";
    const questions = qbankMidEditState.questions || [];

    questions.forEach((q, qIdx) => {
        const palette = QBANK_EDIT_THEME_PALETTES[qIdx % QBANK_EDIT_THEME_PALETTES.length];
        const card = document.createElement("div");
        card.className = "soide-editor-qcard";
        card.id = `qb-edit-qcard-${q.id}`;
        card.dataset.qid = String(q.id);
        card.style.background = palette.bg;
        card.style.border = `1.8px solid ${palette.border}`;
        card.addEventListener("focusin", () => qbEditScrollToLeftPreview(q.id, true));

        const pNum = qbEditGetPartType(q);
        const currentPartType = pNum === 4 ? "part4" : (pNum === 2 ? "true_false" : (pNum === 3 ? "short_answer" : "multiple_choice"));

        const safeQId = safeQbankJsArg(q.id);
        const isRawEditing = qbankMidEditState.rawEditingCardIds.has(String(q.id));
        let cardBodyHtml = "";

        if (isRawEditing) {
            cardBodyHtml = `
                <div class="soide-card-raw-box" id="qb-edit-card-raw-box-${escapeQbankAttr(q.id)}">
                    <div class="soide-card-raw-header"><span>💻 Mã nguồn thô câu ${qIdx + 1}:</span><span>(Dán JSON hoặc text Word)</span></div>
                    <textarea class="soide-card-raw-textarea" id="qb-edit-card-raw-text-${escapeQbankAttr(q.id)}" spellcheck="false" oninput="qbEditMarkCardRawDirty()">${escapeQbankHtml(JSON.stringify(q, null, 2))}</textarea>
                    <div class="soide-card-raw-btn-row">
                        <button type="button" class="btn-soide-mini" onclick="qbEditToggleCardRawBox('${safeQId}')" style="background:#475569; color:#fff;">✕ Thu gọn</button>
                        <button type="button" class="btn-soide-mini" onclick="qbEditApplyCardRawInput(${qIdx}, '${safeQId}')" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-weight:900;">⚡ Nhận diện &amp; Áp dụng</button>
                    </div>
                </div>
            `;
        } else {
            let specificHtml = "";
            if (currentPartType === "multiple_choice") {
                const letters = ["A", "B", "C", "D"];
                const currentCorrect = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").toUpperCase();
                specificHtml = `
                    <div class="soide-textarea-label">Các phương án lựa chọn (A, B, C, D):</div>
                    <div class="soide-options-editor-grid">
                        ${(q.options || ["", "", "", ""]).map((opt, oIdx) => `<div><span style="font-weight:900; font-size:11px; color:${palette.text};">${letters[oIdx] || ""}:</span><textarea class="soide-latex-input" rows="1" oninput="qbEditAutoResizeTextarea(this); qbEditUpdateOption(${qIdx}, ${oIdx}, this.value)">${escapeQbankHtml(opt)}</textarea></div>`).join("")}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                        <b style="font-size:11px; color:#15803d;">Đáp án đúng:</b>
                        <select class="soide-latex-input" style="width:62px; padding:2px 4px; font-size:12.5px !important; min-height:28px;" onchange="qbEditUpdateCorrectMC(${qIdx}, this.value)">
                            ${letters.map(L => `<option value="${L}" ${L === currentCorrect ? "selected" : ""}>${L}</option>`).join("")}
                        </select>
                    </div>`;
            } else if (currentPartType === "true_false") {
                specificHtml = `
                    <div class="soide-textarea-label">Các mệnh đề Đúng / Sai (a, b, c, d):</div>
                    <table class="soide-tf-editor-table">${(q.statements || []).map((st, sIdx) => {
                        const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true");
                        return `<tr><td width="22" align="center"><b>${escapeQbankHtml(st.id)})</b></td><td><textarea class="soide-latex-input" rows="1" style="padding:3px 5px; font-size:12.5px !important; min-height:28px;" oninput="qbEditAutoResizeTextarea(this); qbEditUpdateStatementText(${qIdx}, ${sIdx}, this.value)">${escapeQbankHtml(st.statement)}</textarea></td><td width="82" align="center"><select class="soide-latex-input" style="padding:2px 4px; font-size:12px !important; min-height:28px;" onchange="qbEditUpdateStatementCorrect(${qIdx}, ${sIdx}, this.value)"><option value="Đúng" ${isTrue ? "selected" : ""}>🟢 Đúng</option><option value="Sai" ${!isTrue ? "selected" : ""}>🔴 Sai</option></select></td></tr>`;
                    }).join("")}</table>`;
            } else {
                specificHtml = `<div style="display:flex; align-items:center; gap:6px;"><b style="font-size:11.5px; color:#0d9488;">Đáp số chính xác:</b><input type="text" class="soide-latex-input" style="width:160px; padding:3px 6px; min-height:28px;" value="${escapeQbankAttr(q.correctAnswer || "")}" oninput="qbEditUpdateShortAnswer(${qIdx}, this.value)"></div>`;
            }
            cardBodyHtml = `
                <div><div class="soide-textarea-label"><span>Nội dung câu hỏi (LaTeX $...$):</span></div><textarea class="soide-latex-input" rows="1" oninput="qbEditAutoResizeTextarea(this); qbEditUpdateQuestionText(${qIdx}, this.value)">${escapeQbankHtml(q.question || "")}</textarea></div>
                ${specificHtml}
                <div><div class="soide-textarea-label">Lời giải chi tiết:</div><textarea class="soide-latex-input" rows="1" oninput="qbEditAutoResizeTextarea(this); qbEditUpdateExplanation(${qIdx}, this.value)">${escapeQbankHtml(q.explanation || "")}</textarea></div>
            `;
        }

        const redIdTag = q.matrixId ? `<span class="qbank-q-id-badge" style="font-size:10px; padding:1px 5px;">${escapeQbankHtml(q.matrixId)}</span>` : `<span style="font-size:10.5px; opacity:0.8; font-weight:700;">(ID: ${escapeQbankHtml(q.id)})</span>`;
        card.innerHTML = `
            <div class="soide-paste-zones-row">
                <div class="soide-paste-box zone-overwrite" id="qb-edit-paste-over-${qIdx}" tabindex="0" onclick="qbEditHandlePasteZoneClick(${qIdx}, 'overwrite')" onpaste="qbEditHandlePasteOnQuestion(event, ${qIdx}, 'overwrite')"><span>📋</span><span>Click &amp; <b>Ctrl+V</b> để <b>paste đè</b></span></div>
                <div class="soide-paste-box zone-insert" id="qb-edit-paste-ins-${qIdx}" tabindex="0" onclick="qbEditHandlePasteZoneClick(${qIdx}, 'insert')" onpaste="qbEditHandlePasteOnQuestion(event, ${qIdx}, 'insert')"><span>➕</span><span>Click &amp; <b>Ctrl+V</b> để <b>paste thêm</b></span></div>
            </div>
            <div class="soide-qcard-head">
                <div class="soide-qcard-num" style="color:${palette.text}; flex-wrap:wrap;"><span>Câu ${qIdx + 1}</span>${redIdTag}</div>
                <div class="soide-head-actions">
                    <button type="button" class="btn-soide-mini btn-soide-raw-toggle" onclick="qbEditToggleCardRawBox('${safeQId}')">${isRawEditing ? "👁️ Xem Form" : "💻 Mã thô"}</button>
                    <select class="soide-part-select-mini" onchange="qbEditChangeQuestionType(${qIdx}, this.value)">
                        <option value="multiple_choice" ${currentPartType === "multiple_choice" ? "selected" : ""}>Phần I (TN)</option>
                        <option value="true_false" ${currentPartType === "true_false" ? "selected" : ""}>Phần II (Đ/S)</option>
                        <option value="short_answer" ${currentPartType === "short_answer" ? "selected" : ""}>Phần III (TLN)</option>
                        <option value="part4" ${currentPartType === "part4" ? "selected" : ""}>Phần IV (TL)</option>
                    </select>
                    <button type="button" class="btn-soide-mini btn-soide-add-inline" onclick="qbEditInsertQuestionAfter(${qIdx})">➕ Thêm</button>
                    <button type="button" class="btn-soide-mini btn-soide-del-inline" onclick="qbEditDeleteQuestion(${qIdx})">🗑️ Xóa</button>
                </div>
            </div>
            ${cardBodyHtml}
        `;
        cardsContainer.appendChild(card);
    });
    qbEditUpdateRawTextFromState();
    setTimeout(qbEditAutoResizeAllTextareas, 20);
}

function qbEditRenderLeftLivePreview() {
    const previewContainer = document.getElementById("qb-edit-preview-content"), countEl = document.getElementById("qb-edit-qcount");
    if (!previewContainer) return;
    const questions = qbankMidEditState.questions || [];
    if (countEl) countEl.innerText = questions.length;
    const errors = qbEditValidateSyntax(questions);
    qbEditSetValidationStatus(errors.length === 0, errors.length > 0 ? `⚠️ Có ${errors.length} cảnh báo: ${errors[0]}` : "✅ Cú pháp & công thức hợp lệ");

    if (questions.length === 0) {
        previewContainer.innerHTML = `<div style="text-align:center; padding:36px 12px; color:#64748b; font-weight:700;">Chưa có câu hỏi nào. Hãy bấm <b>➕ Thêm câu mới</b> hoặc kéo thả file đề vào bên phải!</div>`;
        return;
    }

    let html = "";
    const imageMap = qbankMidEditState.images || {}, letters = ["A", "B", "C", "D"];
    questions.forEach((q, qIdx) => {
        const displayIndex = qIdx + 1, qId = q.id, safeQId = safeQbankJsArg(qId);
        const palette = QBANK_EDIT_THEME_PALETTES[qIdx % QBANK_EDIT_THEME_PALETTES.length];
        const pNum = qbEditGetPartType(q);
        const currentPartType = pNum === 4 ? "part4" : (pNum === 2 ? "true_false" : (pNum === 3 ? "short_answer" : "multiple_choice"));

        const imgUrl = resolveQbankImageUrl(q, imageMap), imgKey = q.imageKey || `img_q_${qId}`, safeImgKey = safeQbankJsArg(imgKey);
        const hasAnyImgOrDrive = Boolean(imgUrl || q.imageDriveFileId || q.imageBackupUrl || (q.imageDrivePath && q.imageDriveFilename));
        const hasDrive = Boolean(q.imageDriveFileId || q.imageBackupUrl);
        const driveOpenUrl = q.imageDriveFolderUrl || q.imageDriveUrl || q.imageBackupUrl || "";
        const driveBadge = hasDrive
            ? (driveOpenUrl ? `<a href="${escapeQbankAttr(driveOpenUrl)}" target="_blank" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:6px; padding:3px 7px; font-size:10.5px; font-weight:800; text-decoration:none;">☁️ Đã lưu Drive</a>` : `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:6px; padding:3px 7px; font-size:10.5px; font-weight:800;">☁️ Đã lưu Drive</span>`)
            : "";

        const imgHtml = imgUrl ? `<div class="quiz-img-container" id="qb-edit-img-box-${escapeQbankAttr(qId)}"><div class="quiz-img-wrapper" style="position:relative; display:inline-block;"><img id="qb-edit-img-el-${escapeQbankAttr(qId)}" src="${escapeQbankAttr(imgUrl)}" class="quiz-img" style="max-height:220px;" onerror="handleQbankImgError(this, '${safeQId}')" alt="Hình câu ${displayIndex}"></div></div>` : `<div class="quiz-img-container" id="qb-edit-img-box-${escapeQbankAttr(qId)}" style="display:none;"></div>`;
        const uploaderHtml = `
            <div class="admin-img-uploader-zone" id="qb-edit-zone-${escapeQbankAttr(qId)}" tabindex="0" style="margin:4px 0 6px 0; padding:4px 7px; background:rgba(255,255,255,0.75); border-radius:7px;">
                <div class="admin-uploader-btn-group">
                    <button type="button" class="btn-admin-paste-img" style="padding:3px 9px; font-size:11px;" onclick="qbEditTriggerPastePrompt('${safeQId}', '${safeImgKey}')">📋 Dán ảnh (Ctrl+V)</button>
                    <button type="button" class="btn-admin-file-img" style="padding:3px 9px; font-size:11px;" onclick="document.getElementById('qb-edit-img-file-${safeQId}').click()">📁 Tệp ảnh</button>
                    ${hasAnyImgOrDrive ? `<button type="button" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; border-radius:6px; padding:3px 8px; font-size:11px; font-weight:800; cursor:pointer;" onclick="qbEditReloadQuestionImage('${safeQId}')">🔄 Tải lại ảnh</button>` : ""}
                    ${driveBadge}
                    ${hasAnyImgOrDrive ? `<button type="button" class="btn-admin-del-img" style="padding:3px 9px; font-size:11px;" onclick="qbEditDeleteQuestionImage('${safeQId}', '${safeImgKey}')">🗑️ Xóa ảnh</button>` : ""}
                    <input type="file" id="qb-edit-img-file-${escapeQbankAttr(qId)}" accept="image/*" style="display:none;" onchange="qbEditHandleImageSelected(this, '${safeQId}', '${safeImgKey}')">
                </div>
                <span class="admin-uploader-status" id="qb-edit-img-status-${escapeQbankAttr(qId)}"></span>
            </div>`;

        let bodyHtml = "";
        if (currentPartType === "multiple_choice") {
            const correctLetter = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").toUpperCase();
            const opts = q.options || [];
            const maxLen = opts.reduce((m, o) => Math.max(m, String(o || "").length), 0);
            const layoutClass = maxLen > 45 ? "opt-grid-1" : (maxLen > 18 ? "opt-grid-2" : "opt-grid-4");
            bodyHtml = `<div class="options-list ${layoutClass}">${opts.map((opt, oIdx) => {
                const L = letters[oIdx] || "", isCorrect = (L === correctLetter);
                return `<div class="opt-label ${isCorrect ? "selected" : ""}" style="cursor:default; padding:5px 8px;"><span class="opt-circle" style="width:21px; height:21px; font-size:0.8rem;">${L}</span><span class="opt-text" style="font-size:12.5px;">${opt} ${isCorrect ? '<b style="color:#16a34a; margin-left:4px;">✓</b>' : ""}</span></div>`;
            }).join("")}</div>`;
        } else if (currentPartType === "true_false") {
            bodyHtml = `<div class="tf-table-box" style="margin-top:4px;"><table class="tf-table"><thead><tr><th>Mệnh đề</th><th width="70" style="text-align:center;">Đáp án</th></tr></thead><tbody>${(q.statements || []).map(st => {
                const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true");
                return `<tr><td style="font-size:12.5px;"><b>${escapeQbankHtml(st.id)})</b> ${st.statement}</td><td align="center" style="font-weight:900; font-size:12px; color:${isTrue ? "#16a34a" : "#dc2626"};">${isTrue ? "🟢 Đúng" : "🔴 Sai"}</td></tr>`;
            }).join("")}</tbody></table></div>`;
        } else {
            bodyHtml = `<div style="background:#f0fdf4; border:1px solid #86efac; padding:5px 9px; border-radius:7px; font-weight:800; color:#166534; margin-top:4px; display:inline-block; font-size:12.5px;">🎯 Đáp số: <span style="color:#0f172a;">${escapeQbankHtml(q.correctAnswer || "(Chưa nhập)")}</span></div>`;
        }

        const explainHtml = q.explanation ? `<div class="explanation-box" style="margin-top:6px; padding:5px 9px; font-size:12px;">💡 <b>Lời giải chi tiết:</b> ${q.explanation}</div>` : "";
        const redIdTag = q.matrixId ? `<span class="qbank-q-id-badge" style="font-size:10px; padding:1px 5px; margin-left:4px;">${escapeQbankHtml(q.matrixId)}</span>` : "";

        html += `
            <div class="soide-preview-card" id="qb-edit-preview-card-${escapeQbankAttr(qId)}" data-qid="${escapeQbankAttr(qId)}" style="background:${palette.bg}; border:1.8px solid ${palette.border};">
                <div class="soide-preview-head-row">
                    <div class="soide-preview-title-badge" style="color:${palette.text}; font-size:12.5px;"><b>Câu ${displayIndex}</b> <span style="font-size:10.5px; opacity:0.85; font-weight:700;">(ID: ${escapeQbankHtml(qId)})</span> ${redIdTag}</div>
                    <div class="soide-head-actions">
                        <select class="soide-part-select-mini" onchange="qbEditChangeQuestionType(${qIdx}, this.value)">
                            <option value="multiple_choice" ${currentPartType === "multiple_choice" ? "selected" : ""}>Phần I</option>
                            <option value="true_false" ${currentPartType === "true_false" ? "selected" : ""}>Phần II</option>
                            <option value="short_answer" ${currentPartType === "short_answer" ? "selected" : ""}>Phần III</option>
                            <option value="part4" ${currentPartType === "part4" ? "selected" : ""}>Phần IV</option>
                        </select>
                        <button type="button" class="btn-soide-mini btn-soide-add-inline" onclick="qbEditInsertQuestionAfter(${qIdx})">➕ Thêm</button>
                        <button type="button" class="btn-soide-mini btn-soide-del-inline" onclick="qbEditDeleteQuestionById('${safeQId}')">🗑️ Xóa</button>
                    </div>
                </div>
                <div class="q-content-text" style="margin-bottom:5px; font-size:13.5px;">${qbFormatQuestionText(q.question || "")}</div>
                ${uploaderHtml}${imgHtml}${bodyHtml}${explainHtml}
            </div>`;
    });

    previewContainer.innerHTML = html;
    qbEditSetupPreviewPasteListeners();
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([previewContainer]).catch(() => {});
}

function qbEditSetupPreviewPasteListeners() {
    document.querySelectorAll("#qb-edit-left-pane .soide-preview-card").forEach(card => {
        card.addEventListener("paste", function(e) {
            const qId = this.dataset.qid;
            const q = (qbankMidEditState.questions || []).find(item => String(item.id) === String(qId));
            const imgKey = (q && q.imageKey) || `img_q_${qId}`;
            const clipboardItems = (e.clipboardData || window.clipboardData)?.items;
            if (!clipboardItems) return;
            for (let i = 0; i < clipboardItems.length; i++) {
                if (clipboardItems[i].type.indexOf("image") !== -1) {
                    e.preventDefault();
                    qbEditUploadImage(clipboardItems[i].getAsFile(), qId, imgKey);
                    break;
                }
            }
        });
    });
}

function qbEditTriggerPastePrompt(qId) {
    const z = document.getElementById(`qb-edit-zone-${qId}`);
    if (z) z.focus();
    showQbankToast("📋 Click vào khung này rồi nhấn Ctrl + V để dán ảnh!", "info");
}

function qbEditHandleImageSelected(input, qId, imgKey) {
    if (input.files && input.files[0]) qbEditUploadImage(input.files[0], qId, imgKey);
}

async function qbEditUploadImage(file, qId, imgKey) {
    if (!file) return;
    const statusEl = document.getElementById(`qb-edit-img-status-${qId}`);
    if (statusEl) { statusEl.className = "admin-uploader-status loading"; statusEl.innerText = "⏳ Đang tải ảnh..."; }
    const targetQ = (qbankMidEditState.questions || []).find(item => String(item.id) === String(qId));
    try {
        let directUrl = "";
        if (typeof window.uploadDualQuestionImage === "function" && targetQ) {
            const res = await window.uploadDualQuestionImage(file, targetQ, {
                contextTitle: qbankMidEditState.title || "",
                imgKey: imgKey,
                onStatus: (msg) => {
                    const el = document.getElementById(`qb-edit-img-status-${qId}`);
                    if (el) { el.className = "admin-uploader-status loading"; el.innerText = msg; }
                },
                onBackupComplete: (updatedQ) => {
                    if (!qbankMidEditState.images) qbankMidEditState.images = {};
                    if (updatedQ.imageUrl) qbankMidEditState.images[imgKey] = updatedQ.imageUrl;
                    qbankMidEditState.isDirty = true;
                    qbEditRenderLeftLivePreview();
                    showQbankToast("☁️ Đã sao lưu ngầm ảnh sang Google Drive!", "success");
                }
            });
            directUrl = res.primaryUrl;
        } else {
            directUrl = await uploadImageToHostOrDrive(file, `qbank_edit_${qId}`, targetQ);
        }

        if (!qbankMidEditState.images) qbankMidEditState.images = {};
        qbankMidEditState.images[imgKey] = directUrl;
        if (targetQ) { targetQ.imageUrl = directUrl; targetQ.imageKey = imgKey; }
        qbankMidEditState.isDirty = true;
        qbEditRenderBothSides();
        showQbankToast("🖼️ Đã chèn ảnh thành công! Bấm ⚡ Update để lưu.", "success");
    } catch (err) {
        if (statusEl) { statusEl.className = "admin-uploader-status error"; statusEl.innerText = "❌ Lỗi: " + err.message; }
        showQbankToast("❌ Lỗi tải ảnh: " + err.message, "error");
    }
}

async function qbEditReloadQuestionImage(qId) {
    const targetQ = (qbankMidEditState.questions || []).find(item => String(item.id) === String(qId));
    if (!targetQ || typeof window.reloadQuestionImageAction !== "function") return;
    const statusEl = document.getElementById(`qb-edit-img-status-${qId}`);
    const res = await window.reloadQuestionImageAction(targetQ, {
        onStatus: (msg, color) => {
            if (statusEl) { statusEl.style.color = color; statusEl.innerText = msg; }
        },
        onSuccess: (info) => {
            if (info.directUrl && !targetQ.imageUrl) {
                targetQ.imageUrl = info.directUrl;
                const imgKey = targetQ.imageKey || `img_q_${targetQ.id}`;
                if (!qbankMidEditState.images) qbankMidEditState.images = {};
                qbankMidEditState.images[imgKey] = info.directUrl;
            }
            qbankMidEditState.isDirty = true;
            const imgEl = document.getElementById(`qb-edit-img-el-${targetQ.id}`);
            if (imgEl) {
                const box = imgEl.parentElement && imgEl.parentElement.querySelector(".img-recovery-box");
                if (box) box.remove();
                imgEl.style.display = "inline-block";
                imgEl.src = info.displaySrc;
            } else {
                qbEditRenderLeftLivePreview();
            }
        }
    });
    if (res && res.ok) showQbankToast("🔄 Đã tải lại ảnh thành công!", "success");
    else if (res && res.message) alert(res.message);
}

function qbEditDeleteQuestionImage(qId, imgKey) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA ảnh của câu này không?")) return;
    if (qbankMidEditState.images) { delete qbankMidEditState.images[imgKey]; delete qbankMidEditState.images[`img_q_${qId}`]; }
    const targetQ = (qbankMidEditState.questions || []).find(item => String(item.id) === String(qId));
    if (targetQ) {
        targetQ.imageUrl = "";
        targetQ.imageBackupUrl = "";
        targetQ.imageDriveFileId = "";
        targetQ.imageDriveUrl = "";
        targetQ.imageDriveFolderUrl = "";
        targetQ.imageDrivePath = "";
        targetQ.imageDriveFilename = "";
    }
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
}

function qbEditDebouncedLivePreview() {
    if (qbankMidEditState.debounceTimer) clearTimeout(qbankMidEditState.debounceTimer);
    qbankMidEditState.debounceTimer = setTimeout(() => { qbEditRenderLeftLivePreview(); qbEditUpdateRawTextFromState(); }, 220);
}

function qbEditMarkCardRawDirty() { qbankMidEditState.isDirty = true; }
function qbEditUpdateQuestionText(idx, val) { if (qbankMidEditState.questions[idx]) { qbankMidEditState.questions[idx].question = val; qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }
function qbEditUpdateOption(qIdx, oIdx, val) { const q = qbankMidEditState.questions[qIdx]; if (q && Array.isArray(q.options)) { q.options[oIdx] = val; qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }
function qbEditUpdateCorrectMC(qIdx, letter) { const q = qbankMidEditState.questions[qIdx]; if (q) { q.correct = ["A", "B", "C", "D"].indexOf(letter); qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }
function qbEditUpdateStatementText(qIdx, sIdx, val) { const q = qbankMidEditState.questions[qIdx]; if (q && q.statements && q.statements[sIdx]) { q.statements[sIdx].statement = val; qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }
function qbEditUpdateStatementCorrect(qIdx, sIdx, val) { const q = qbankMidEditState.questions[qIdx]; if (q && q.statements && q.statements[sIdx]) { q.statements[sIdx].correct = (val === "Đúng"); qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }
function qbEditUpdateShortAnswer(qIdx, val) { if (qbankMidEditState.questions[qIdx]) { qbankMidEditState.questions[qIdx].correctAnswer = val; qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }
function qbEditUpdateExplanation(qIdx, val) { if (qbankMidEditState.questions[qIdx]) { qbankMidEditState.questions[qIdx].explanation = val; qbankMidEditState.isDirty = true; qbEditDebouncedLivePreview(); } }

function qbEditChangeQuestionType(qIdx, newType) {
    const q = qbankMidEditState.questions[qIdx];
    if (!q) return;
    if (newType === "multiple_choice") {
        q.type = "multiple_choice"; q.part = 1; q.isPart4 = false;
        if (!q.options || q.options.length < 4) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
        if (q.correct === undefined || q.correct === null) q.correct = 0;
    } else if (newType === "true_false") {
        q.type = "true_false"; q.part = 2; q.isPart4 = false;
        if (!q.statements || q.statements.length < 4) q.statements = [{ id: "a", statement: "Mệnh đề a", correct: true }, { id: "b", statement: "Mệnh đề b", correct: false }, { id: "c", statement: "Mệnh đề c", correct: true }, { id: "d", statement: "Mệnh đề d", correct: false }];
    } else if (newType === "short_answer") {
        q.type = "short_answer"; q.part = 3; q.isPart4 = false;
        if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === "") q.correctAnswer = "0";
    } else if (newType === "part4") {
        q.type = "short_answer"; q.part = 4; q.isPart4 = true;
        if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === "") q.correctAnswer = "0";
    }
    qbankMidEditState.questions = qbEditReorganizeQuestions(qbankMidEditState.questions);
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    showQbankToast("✅ Đã chuyển câu sang phần mới!", "info");
}

function qbEditInsertQuestionAfter(qIdx) {
    const currentQ = qbankMidEditState.questions[qIdx], currentPart = currentQ ? qbEditGetPartType(currentQ) : 1;
    const newId = qbEditGenerateNewUniqueId();
    let newQuestion = { id: newId, type: "multiple_choice", part: 1, isPart4: false, question: "Câu hỏi mới: Cho hàm số $y = f(x)$...", options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], correct: 0, explanation: "" };
    if (currentPart === 2) newQuestion = { id: newId, type: "true_false", part: 2, isPart4: false, question: "Xét tính đúng sai của các mệnh đề sau:", statements: [{ id: "a", statement: "Mệnh đề a", correct: true }, { id: "b", statement: "Mệnh đề b", correct: false }, { id: "c", statement: "Mệnh đề c", correct: true }, { id: "d", statement: "Mệnh đề d", correct: false }], explanation: "" };
    else if (currentPart === 3) newQuestion = { id: newId, type: "short_answer", part: 3, isPart4: false, question: "Tìm giá trị của biểu thức sau:", correctAnswer: "0", explanation: "" };
    else if (currentPart === 4) newQuestion = { id: newId, type: "short_answer", part: 4, isPart4: true, question: "PHẦN IV. Tự luận ngắn:", correctAnswer: "0", explanation: "" };
    qbEditInheritActiveFolderMeta(newQuestion);
    qbEditInsertOrganizedByPart([newQuestion]);
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    setTimeout(() => { qbEditAutoResizeAllTextareas(); qbEditScrollToLeftPreview(newId, true); const card = document.getElementById(`qb-edit-qcard-${newId}`); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
}

function qbEditAddNewQuestion() {
    const newId = qbEditGenerateNewUniqueId();
    const newQ = { id: newId, type: "multiple_choice", part: 1, isPart4: false, question: "Câu hỏi trắc nghiệm mới...", options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], correct: 0, explanation: "" };
    qbEditInheritActiveFolderMeta(newQ);
    qbEditInsertOrganizedByPart([newQ]);
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    setTimeout(() => { qbEditAutoResizeAllTextareas(); qbEditScrollToLeftPreview(newId, true); const card = document.getElementById(`qb-edit-qcard-${newId}`); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); showQbankToast("➕ Đã thêm câu mới vào Phần I!", "info"); }, 60);
}

function qbEditDeleteQuestion(qIdx) {
    if (!confirm(`⚠️ Bạn có chắc chắn muốn XÓA Câu ${qIdx + 1} không?`)) return;
    const removed = qbankMidEditState.questions.splice(qIdx, 1);
    if (removed && removed[0]) qbankMidEditState.rawEditingCardIds.delete(String(removed[0].id));
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
}

function qbEditDeleteQuestionById(qId) {
    const idx = (qbankMidEditState.questions || []).findIndex(q => String(q.id) === String(qId));
    if (idx !== -1) qbEditDeleteQuestion(idx);
}

function qbEditToggleCardRawBox(qId) {
    const key = String(qId);
    if (qbankMidEditState.rawEditingCardIds.has(key)) qbankMidEditState.rawEditingCardIds.delete(key);
    else qbankMidEditState.rawEditingCardIds.add(key);
    qbEditRenderRightEditor();
    setTimeout(() => {
        qbEditAutoResizeAllTextareas();
        const box = document.getElementById(`qb-edit-card-raw-box-${key}`);
        if (box) { box.scrollIntoView({ behavior: "smooth", block: "center" }); const ta = document.getElementById(`qb-edit-card-raw-text-${key}`); if (ta) ta.focus(); }
    }, 40);
}

function qbEditParseSingleQuestion(text) {
    if (typeof parseSmartSingleQuestion === "function") return parseSmartSingleQuestion(text);
    const parsed = parseUniversalExamText(text);
    if (parsed && typeof parsed === "object") return parsed;
    return { type: "multiple_choice", question: String(text || "").trim(), options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], correct: 0, explanation: "" };
}

function qbEditParseMultipleQuestions(text) {
    if (typeof parseSmartQuestionOrQuestions === "function") return parseSmartQuestionOrQuestions(text);
    const one = qbEditParseSingleQuestion(text);
    return one ? [one] : [];
}

async function qbEditHandlePasteZoneClick(qIdx, mode) {
    let clipboardText = "";
    if (navigator.clipboard && navigator.clipboard.readText) { try { clipboardText = await navigator.clipboard.readText(); } catch (e) {} }
    if (mode === "overwrite") {
        const targetQ = qbankMidEditState.questions[qIdx];
        if (!targetQ) return;
        qbankMidEditState.rawEditingCardIds.add(String(targetQ.id));
        qbEditRenderRightEditor();
        setTimeout(() => {
            const ta = document.getElementById(`qb-edit-card-raw-text-${targetQ.id}`);
            if (ta) { if (clipboardText && clipboardText.trim()) { ta.value = clipboardText.trim(); qbankMidEditState.isDirty = true; showQbankToast(`📋 Đã nạp nội dung dán vào mã thô Câu ${qIdx + 1}!`, "info"); } ta.focus(); }
            qbEditScrollToLeftPreview(targetQ.id, true);
        }, 50);
    } else if (mode === "insert") {
        let parsedQuestions = (clipboardText && clipboardText.trim()) ? qbEditParseMultipleQuestions(clipboardText) : [];
        if (parsedQuestions.length === 0) parsedQuestions = [{ type: "multiple_choice", part: 1, isPart4: false, question: "Câu hỏi mới: ...", options: ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], correct: 0, explanation: "" }];
        parsedQuestions.forEach(q => { q.id = qbEditGenerateNewUniqueId(); qbEditInheritActiveFolderMeta(q); });
        qbEditInsertOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => qbankMidEditState.rawEditingCardIds.add(String(q.id)));
        qbankMidEditState.isDirty = true;
        qbEditRenderBothSides();
        const firstId = parsedQuestions[0].id;
        setTimeout(() => {
            const ta = document.getElementById(`qb-edit-card-raw-text-${firstId}`);
            if (ta && clipboardText && clipboardText.trim()) ta.value = clipboardText.trim();
            qbEditScrollToLeftPreview(firstId, true);
            const card = document.getElementById(`qb-edit-qcard-${firstId}`);
            if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
            showQbankToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào cuối từng phần!`, "success");
        }, 60);
    }
}

function qbEditHandlePasteOnQuestion(event, qIdx, mode) {
    event.preventDefault(); event.stopPropagation();
    const text = (event.clipboardData || window.clipboardData)?.getData("text");
    if (mode === "overwrite") {
        const targetQ = qbankMidEditState.questions[qIdx];
        if (!targetQ) return;
        qbankMidEditState.rawEditingCardIds.add(String(targetQ.id));
        qbEditRenderRightEditor();
        setTimeout(() => { const ta = document.getElementById(`qb-edit-card-raw-text-${targetQ.id}`); if (ta) { if (text) { ta.value = text.trim(); qbankMidEditState.isDirty = true; } ta.focus(); } showQbankToast(`📋 Đã dán vào mã thô Câu ${qIdx + 1}!`, "info"); }, 40);
    } else if (mode === "insert") {
        let parsedQuestions = qbEditParseMultipleQuestions(text);
        if (parsedQuestions.length === 0) parsedQuestions = [{ type: "multiple_choice", part: 1, isPart4: false, question: text || "Câu hỏi mới...", options: ["A", "B", "C", "D"], correct: 0, explanation: "" }];
        parsedQuestions.forEach(q => { q.id = qbEditGenerateNewUniqueId(); qbEditInheritActiveFolderMeta(q); });
        qbEditInsertOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => qbankMidEditState.rawEditingCardIds.add(String(q.id)));
        qbankMidEditState.isDirty = true;
        qbEditRenderBothSides();
        const firstId = parsedQuestions[0].id;
        setTimeout(() => { const ta = document.getElementById(`qb-edit-card-raw-text-${firstId}`); if (ta && text) ta.value = text.trim(); qbEditScrollToLeftPreview(firstId, true); showQbankToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào cuối từng phần!`, "success"); }, 60);
    }
}

function qbEditApplySingleCardRawValue(targetQ, rawVal) {
    if (!targetQ || !rawVal) return false;
    const parsedJson = parseUniversalExamText(rawVal);

    if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson) && parsedJson.question !== undefined) {
        const origId = targetQ.id;
        Object.assign(targetQ, parsedJson);
        targetQ.id = origId;

        const explicitPart = parseInt(parsedJson.part, 10);
        if (explicitPart >= 1 && explicitPart <= 4) {
            targetQ.part = explicitPart;
            targetQ.isPart4 = (explicitPart === 4);
        } else if (parsedJson.isPart4 !== undefined) {
            targetQ.isPart4 = !!parsedJson.isPart4;
            targetQ.part = targetQ.isPart4 ? 4 : (targetQ.type === "multiple_choice" ? 1 : (targetQ.type === "true_false" ? 2 : 3));
        } else {
            targetQ.part = qbEditGetPartType(targetQ);
            targetQ.isPart4 = (targetQ.part === 4);
        }
        if (targetQ.level !== undefined) {
            targetQ.level = normalizeQbankLevel(targetQ.level);
        }
        return true;
    }

    const qObj = qbEditParseSingleQuestion(rawVal);
    if (!qObj) return false;

    targetQ.type = qObj.type;
    targetQ.question = qObj.question;
    if (qObj.options) targetQ.options = qObj.options;
    if (qObj.statements) targetQ.statements = qObj.statements;
    if (qObj.correct !== undefined) targetQ.correct = qObj.correct;
    if (qObj.correctAnswer !== undefined) targetQ.correctAnswer = qObj.correctAnswer;
    if (qObj.explanation !== undefined) targetQ.explanation = qObj.explanation;
    if (qObj.imageUrl !== undefined && qObj.imageUrl !== "") targetQ.imageUrl = qObj.imageUrl;
    if (qObj.imageKey !== undefined && qObj.imageKey !== "") targetQ.imageKey = qObj.imageKey;

    const explicitPart = parseInt(qObj.part, 10);
    if (explicitPart >= 1 && explicitPart <= 4) {
        targetQ.part = explicitPart;
        targetQ.isPart4 = (explicitPart === 4);
    } else if (qObj.type === "essay" || qObj.type === "essay_answer" || qObj.type === "part4") {
        targetQ.part = 4;
        targetQ.isPart4 = true;
    } else if (qObj.type === "multiple_choice") {
        targetQ.part = 1;
        targetQ.isPart4 = false;
    } else if (qObj.type === "true_false") {
        targetQ.part = 2;
        targetQ.isPart4 = false;
    } else if (qObj.type === "short_answer") {
        const isTextP4 = /PH[ẦA]N\s*(IV|4)/i.test(String(qObj.question || ""));
        targetQ.part = isTextP4 ? 4 : 3;
        targetQ.isPart4 = isTextP4;
    }
    return true;
}

function qbEditApplyCardRawInput(qIdx, qId) {
    const ta = document.getElementById(`qb-edit-card-raw-text-${qId}`);
    if (!ta) return;
    const rawVal = ta.value.trim();
    if (!rawVal) return alert("⚠️ Vui lòng nhập nội dung câu hỏi!");

    const targetQ = (qbankMidEditState.questions || []).find(x => String(x.id) === String(qId)) || qbankMidEditState.questions[qIdx];
    const applied = qbEditApplySingleCardRawValue(targetQ, rawVal);
    if (!applied) return alert("⚠️ Không nhận diện được cấu trúc câu hỏi!");

    qbankMidEditState.questions = qbEditReorganizeQuestions(qbankMidEditState.questions);
    qbankMidEditState.rawEditingCardIds.delete(String(qId));
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    setTimeout(() => { qbEditAutoResizeAllTextareas(); qbEditScrollToLeftPreview(qId, true); }, 40);
    showQbankToast("✅ Đã nhận diện và áp dụng câu hỏi thành công!", "success");
}

function qbEditFlushOpenRawCards() {
    if (qbankMidEditState.editorMode !== "cards" || !qbankMidEditState.rawEditingCardIds || qbankMidEditState.rawEditingCardIds.size === 0) {
        return;
    }
    const questions = qbankMidEditState.questions || [];
    let anyApplied = false;

    Array.from(qbankMidEditState.rawEditingCardIds).forEach(qId => {
        const ta = document.getElementById(`qb-edit-card-raw-text-${qId}`);
        if (!ta) return;
        const rawVal = (ta.value || "").trim();
        if (!rawVal) return;

        const targetQ = questions.find(item => item && String(item.id) === String(qId));
        if (targetQ && qbEditApplySingleCardRawValue(targetQ, rawVal)) {
            anyApplied = true;
        }
    });

    if (anyApplied) {
        qbankMidEditState.questions = qbEditReorganizeQuestions(questions);
        qbankMidEditState.isDirty = true;
    }
    qbankMidEditState.rawEditingCardIds.clear();
}

function qbEditSetMode(mode) {
    qbankMidEditState.editorMode = mode;
    const btnCards = document.getElementById("qb-edit-btn-mode-cards"), btnRaw = document.getElementById("qb-edit-btn-mode-raw");
    const cardsBox = document.getElementById("qb-edit-cards-container"), rawBox = document.getElementById("qb-edit-raw-container");
    if (mode === "cards") {
        if (btnCards) btnCards.classList.add("active"); if (btnRaw) btnRaw.classList.remove("active");
        if (cardsBox) cardsBox.style.display = "flex"; if (rawBox) rawBox.style.display = "none";
        qbEditRenderRightEditor();
    } else {
        if (btnCards) btnCards.classList.remove("active"); if (btnRaw) btnRaw.classList.add("active");
        if (cardsBox) cardsBox.style.display = "none"; if (rawBox) rawBox.style.display = "flex";
        qbEditUpdateRawTextFromState();
    }
}

function qbEditUpdateRawTextFromState() {
    const rawEditor = document.getElementById("qb-edit-raw-editor");
    if (!rawEditor) return;
    const questions = qbankMidEditState.questions || [];
    let scriptOutput = `const examData = {\n  title: ${JSON.stringify(qbankMidEditState.title || "ĐỀ THI")},\n  maDe: ${JSON.stringify(qbankMidEditState.maDe || "QBANK")},\n  timeLimitMinutes: ${parseInt(qbankMidEditState.timeLimitMinutes, 10) || 90},\n  images: ${JSON.stringify(qbankMidEditState.images || {}, null, 4)},\n  questions: [\n`;
    questions.forEach((q, idx) => {
        scriptOutput += `    //---------------------------------------- Câu ${idx + 1}\n` + JSON.stringify(q, null, 4).split("\n").map(l => "    " + l).join("\n") + `${idx < questions.length - 1 ? "," : ""}\n`;
    });
    scriptOutput += `    //---------------------------------------- HẾT ĐỀ\n  ]\n};`;
    rawEditor.value = scriptOutput;
}

function qbEditSyncFromRawText(text) {
    try {
        const parsed = parseUniversalExamText(text);
        if (parsed && Array.isArray(parsed.questions)) {
            qbankMidEditState.title = parsed.title || qbankMidEditState.title;
            qbankMidEditState.maDe = parsed.maDe || parsed.made || qbankMidEditState.maDe;
            qbankMidEditState.timeLimitMinutes = parseInt(parsed.timeLimitMinutes || parsed.time_limit_minutes, 10) || qbankMidEditState.timeLimitMinutes;
            if (parsed.images && typeof parsed.images === "object") qbankMidEditState.images = parsed.images;
            qbankMidEditState.questions = qbEditReorganizeQuestions(parsed.questions);
            qbEditSetValidationStatus(true, "✅ Cú pháp mã nguồn hợp lệ!");
            qbEditRenderLeftLivePreview();
            return true;
        } else if (Array.isArray(parsed)) {
            qbankMidEditState.questions = qbEditReorganizeQuestions(parsed);
            qbEditSetValidationStatus(true, "✅ Cú pháp mảng câu hỏi hợp lệ!");
            qbEditRenderLeftLivePreview();
            return true;
        } else {
            qbEditSetValidationStatus(false, "⚠️ Cần có biến examData chứa trường questions!");
            return false;
        }
    } catch (e) {
        qbEditSetValidationStatus(false, "❌ Lỗi cú pháp: " + e.message);
        return false;
    }
}

function qbEditHandleRawInput(text) {
    qbankMidEditState.isDirty = true;
    if (qbankMidEditState.debounceTimer) clearTimeout(qbankMidEditState.debounceTimer);
    qbankMidEditState.debounceTimer = setTimeout(() => { qbEditSyncFromRawText(text); }, 350);
}

function qbEditTriggerUpload() { const i = document.getElementById("qb-edit-file-input"); if (i) { i.value = ""; i.click(); } }
function qbEditHandleFileSelected(input) { if (input.files && input.files[0]) qbEditReadFile(input.files[0]); }

function qbEditReadFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = parseUniversalExamText(e.target.result);
            if (!parsed) throw new Error("File rỗng hoặc không đúng cấu trúc!");
            let rawQuestions = [], rawImages = {};
            if (Array.isArray(parsed)) rawQuestions = parsed;
            else if (typeof parsed === "object") {
                rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
                rawImages = (parsed.images && typeof parsed.images === "object") ? parsed.images : {};
                if (parsed.title) qbankMidEditState.title = parsed.title;
                if (parsed.maDe || parsed.made) qbankMidEditState.maDe = parsed.maDe || parsed.made;
                if (parsed.timeLimitMinutes || parsed.time_limit_minutes) qbankMidEditState.timeLimitMinutes = parseInt(parsed.timeLimitMinutes || parsed.time_limit_minutes, 10) || 90;
            }
            rawQuestions.forEach((q, idx) => {
                if (!q.id) q.id = qbEditGenerateNewUniqueId();
                q.origIndex = idx + 1;
                normalizeQuestionAnswerOnTransfer(q);
                const resolvedImg = resolveQbankImageUrl(q, rawImages);
                if (resolvedImg) { const key = q.imageKey || `img_q_${q.id}`; q.imageUrl = resolvedImg; q.imageKey = key; qbankMidEditState.images[key] = resolvedImg; }
                if (q.folderId === undefined) qbEditInheritActiveFolderMeta(q);
                else if (qbankMidEditState.pendingExamId && !q.pendingExamId) {
                    q.pendingExamId = qbankMidEditState.pendingExamId;
                    q.pendingKhoId = qbankMidEditState.pendingKhoId || "pending_11";
                }
            });
            qbankMidEditState.questions = qbEditReorganizeQuestions(rawQuestions);
            qbankMidEditState.isDirty = true;
            qbEditRenderBothSides();
            showQbankToast(`✅ Đã nạp ${qbankMidEditState.questions.length} câu vào trình Sửa đề!`, "success");
        } catch (err) { alert("❌ Lỗi đọc file: " + err.message); }
    };
    reader.readAsText(file);
}

function qbEditDownloadJson() {
    if (qbankMidEditState.editorMode === "raw") {
        const rawEditor = document.getElementById("qb-edit-raw-editor");
        if (rawEditor) qbEditSyncFromRawText(rawEditor.value);
    } else {
        qbEditFlushOpenRawCards();
    }
    try {
        const exportObj = { title: qbankMidEditState.title || "DE_THI", maDe: qbankMidEditState.maDe || "QBANK", timeLimitMinutes: qbankMidEditState.timeLimitMinutes || 90, images: qbankMidEditState.images || {}, questions: qbankMidEditState.questions || [] };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(exportObj.title || "De_Thi").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, "_")}_Edited.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) { alert("❌ Lỗi xuất JSON: " + e.message); }
}

async function commitQbankMidEditChanges(keepOpen = true) {
    if (qbankMidEditState.editorMode === "raw") {
        const rawEditor = document.getElementById("qb-edit-raw-editor");
        if (rawEditor && !qbEditSyncFromRawText(rawEditor.value)) {
            return alert("❌ Mã nguồn thô đang bị lỗi cú pháp! Vui lòng kiểm tra lại trước khi Update.");
        }
    } else {
        qbEditFlushOpenRawCards();
    }

    const editedQuestions = qbankMidEditState.questions || [];
    const errors = qbEditValidateSyntax(editedQuestions);
    if (errors.length > 0 && !confirm(`⚠️ Có ${errors.length} cảnh báo cú pháp (VD: ${errors[0]}).\nTiếp tục lưu?`)) return;

    const btn = document.getElementById("btn-qb-edit-save");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang lưu..."; }

    try {
        pushQbankUndoState("Cập nhật từ trình Sửa đề");
        const mergedImages = { ...(qbankState.imagesMap || {}), ...(qbankMidEditState.images || {}) };
        const usedIds = new Set();
        (qbankState.rawQuestions || []).forEach(q => {
            if (q && !qbankMidEditState.editingSourceIds.has(String(q.id))) usedIds.add(String(q.id));
        });

        const updatedTitleTrimmed = (qbankMidEditState.title || "").trim();
        if (qbankMidEditState.pendingExamId && updatedTitleTrimmed) {
            const pEx = (qbankState.pendingExams || []).find(e => e.id === qbankMidEditState.pendingExamId);
            if (pEx) pEx.title = updatedTitleTrimmed;
        }

        const normalizedEdited = editedQuestions.map((rawQ, idx) => {
            const resolvedImg = resolveQbankImageUrl(rawQ, mergedImages);
            const q = JSON.parse(JSON.stringify(rawQ));
            if (!q.id || usedIds.has(String(q.id))) {
                let c;
                do { c = `qb_${Date.now()}_${Math.floor(Math.random() * 100000)}`; } while (usedIds.has(c));
                q.id = c;
            }
            usedIds.add(String(q.id));
            if (!q.origIndex) q.origIndex = idx + 1;
            if (qbankMidEditState.pendingExamId) {
                if (!q.pendingExamId) q.pendingExamId = qbankMidEditState.pendingExamId;
                if (!q.pendingKhoId) q.pendingKhoId = qbankMidEditState.pendingKhoId || "pending_11";
                if (updatedTitleTrimmed) q.sourceExam = updatedTitleTrimmed;
            }
            normalizeQuestionAnswerOnTransfer(q);
            if (resolvedImg) {
                const key = q.imageKey || `img_q_${q.id}`;
                q.imageUrl = resolvedImg; q.imageKey = key; mergedImages[key] = resolvedImg;
            } else {
                q.imageUrl = "";
            }
            return q;
        });

        const untouchedQuestions = (qbankState.rawQuestions || []).filter(q => q && !qbankMidEditState.editingSourceIds.has(String(q.id)));
        qbankState.rawQuestions = [...untouchedQuestions, ...normalizedEdited];
        qbankState.imagesMap = mergedImages;
        if (!qbankState.activeFilter.folderId && updatedTitleTrimmed) qbankState.currentExamTitle = updatedTitleTrimmed;

        qbankMidEditState.questions = JSON.parse(JSON.stringify(normalizedEdited));
        qbankMidEditState.images = JSON.parse(JSON.stringify(mergedImages));
        qbankMidEditState.editingSourceIds = new Set(normalizedEdited.map(q => String(q.id)));
        qbankMidEditState.isDirty = false;

        ensureQbankPendingExamsIntegrity();
        recomputeAllMatrixIds();
        await saveQbankDraftState(false);

        // Đồng bộ thẳng lên Supabase ngay khi bấm ⚡ Update thay vì chỉ đợi debounce
        let syncedCloudOk = true;
        if (typeof syncQbankDraftToCloud === "function") {
            syncedCloudOk = await syncQbankDraftToCloud();
        }

        if (typeof updateQbankUploadMenuCounts === "function") updateQbankUploadMenuCounts();
        renderQbankHeaderAndMidExamTitle();
        renderQbankTree();
        if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
        updateQbankDeleteSelectedButtonUI();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();

        if (keepOpen) {
            const freshMap = new Map((qbankState.rawQuestions || []).map(q => [String(q.id), q]));
            qbankMidEditState.questions = qbankMidEditState.questions.map(q => JSON.parse(JSON.stringify(freshMap.get(String(q.id)) || q)));
            qbEditRenderBothSides();
            showQbankToast(
                syncedCloudOk
                    ? `⚡ Đã cập nhật ${normalizedEdited.length} câu hỏi & đồng bộ Cloud thành công!`
                    : `⚠️ Đã cập nhật ${normalizedEdited.length} câu trên máy (chưa đồng bộ được Cloud)!`,
                syncedCloudOk ? "success" : "warning"
            );
        } else {
            await closeQbankMidEditMode(true);
            showQbankToast(
                syncedCloudOk
                    ? `⚡ Đã lưu & đồng bộ ${normalizedEdited.length} câu hỏi vào Ngân hàng đề!`
                    : `⚠️ Đã lưu ${normalizedEdited.length} câu trên máy (chưa đồng bộ được Cloud)!`,
                syncedCloudOk ? "success" : "warning"
            );
        }
    } catch (err) {
        showQbankToast("❌ Lỗi lưu cập nhật: " + err.message, "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "⚡ Update"; }
    }
}

function setupQbEditResizerAndDrop() {
    if (_qbEditResizerInitialized) return;
    const container = document.getElementById("qb-edit-split-body"), leftPane = document.getElementById("qb-edit-left-pane"), rightPane = document.getElementById("qb-edit-right-pane"), resizer = document.getElementById("qb-edit-resizer"), dropZone = document.getElementById("qb-edit-drop-zone");
    if (!container || !leftPane || !rightPane || !resizer) return;
    _qbEditResizerInitialized = true;

    let isDragging = false;
    const getClientX = (e) => (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    function startDrag(e) { if (window.innerWidth <= 900) return; e.preventDefault(); isDragging = true; container.classList.add("is-resizing"); resizer.classList.add("is-dragging"); }
    function onMove(e) {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect(); if (!rect.width) return;
        let percent = Math.min(Math.max(20, ((getClientX(e) - rect.left) / rect.width) * 100), 80);
        qbankMidEditState.splitRatio = percent; leftPane.style.width = `${percent}%`; rightPane.style.width = `${100 - percent}%`;
    }
    function endDrag() { if (!isDragging) return; isDragging = false; container.classList.remove("is-resizing"); resizer.classList.remove("is-dragging"); qbEditAutoResizeAllTextareas(); }

    resizer.addEventListener("mousedown", startDrag); resizer.addEventListener("touchstart", startDrag, { passive: false });
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", endDrag);

    if (dropZone) {
        dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
        dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("dragover"); });
        dropZone.addEventListener("drop", e => { e.preventDefault(); dropZone.classList.remove("dragover"); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) qbEditReadFile(e.dataTransfer.files[0]); });
    }
}

function setupQbEditDualScrollSync() {
    const leftPane = document.getElementById("qb-edit-left-pane"), rightPane = document.getElementById("qb-edit-right-pane");
    if (!leftPane || !rightPane || rightPane.dataset.hasQbScrollSync === "true") return;
    rightPane.dataset.hasQbScrollSync = "true";

    leftPane.addEventListener("mouseenter", () => { _qbEditScrollSyncActivePane = "left"; });
    leftPane.addEventListener("touchstart", () => { _qbEditScrollSyncActivePane = "left"; }, { passive: true });
    rightPane.addEventListener("mouseenter", () => { _qbEditScrollSyncActivePane = "right"; });
    rightPane.addEventListener("touchstart", () => { _qbEditScrollSyncActivePane = "right"; }, { passive: true });

    let rightRaf = null, leftRaf = null;
    rightPane.addEventListener("scroll", () => {
        if (_qbEditScrollSyncActivePane !== "right" || qbankMidEditState.editorMode !== "cards") return;
        if (rightRaf) cancelAnimationFrame(rightRaf);
        rightRaf = requestAnimationFrame(() => {
            const paneRect = rightPane.getBoundingClientRect(), cards = rightPane.querySelectorAll(".soide-editor-qcard");
            if (!cards.length) return;
            const probeY = paneRect.top + 70; let best = null, minD = Infinity;
            for (const c of cards) { const r = c.getBoundingClientRect(); if (r.top <= probeY && r.bottom >= probeY) { best = c; break; } const d = Math.abs(r.top - probeY); if (d < minD) { minD = d; best = c; } }
            if (best && best.dataset.qid && best.dataset.qid !== _qbEditLastSyncedRightToLeft) { _qbEditLastSyncedRightToLeft = best.dataset.qid; qbEditScrollToLeftPreview(best.dataset.qid, false); }
        });
    }, { passive: true });

    leftPane.addEventListener("scroll", () => {
        if (_qbEditScrollSyncActivePane !== "left" || qbankMidEditState.editorMode !== "cards") return;
        if (leftRaf) cancelAnimationFrame(leftRaf);
        leftRaf = requestAnimationFrame(() => {
            const paneRect = leftPane.getBoundingClientRect(), cards = leftPane.querySelectorAll(".soide-preview-card");
            if (!cards.length) return;
            const probeY = paneRect.top + 70; let best = null, minD = Infinity;
            for (const c of cards) { const r = c.getBoundingClientRect(); if (r.top <= probeY && r.bottom >= probeY) { best = c; break; } const d = Math.abs(r.top - probeY); if (d < minD) { minD = d; best = c; } }
            if (best && best.dataset.qid && best.dataset.qid !== _qbEditLastSyncedLeftToRight) { _qbEditLastSyncedLeftToRight = best.dataset.qid; qbEditScrollToRightEditor(best.dataset.qid, false); }
        });
    }, { passive: true });
}

function qbEditScrollToLeftPreview(qId, smooth = true) {
    const leftPane = document.getElementById("qb-edit-left-pane"), leftCard = document.getElementById(`qb-edit-preview-card-${qId}`);
    if (!leftPane || !leftCard) return;
    leftPane.scrollTo({ top: Math.max(0, leftPane.scrollTop + leftCard.getBoundingClientRect().top - leftPane.getBoundingClientRect().top - 10), behavior: smooth ? "smooth" : "auto" });
    leftPane.querySelectorAll(".soide-preview-card.is-synced-active").forEach(c => c.classList.remove("is-synced-active"));
    leftCard.classList.add("is-synced-active");
    _qbEditLastSyncedLeftToRight = String(qId);
}

function qbEditScrollToRightEditor(qId, smooth = true) {
    const rightPane = document.getElementById("qb-edit-right-pane"), rightCard = document.getElementById(`qb-edit-qcard-${qId}`);
    if (!rightPane || !rightCard) return;
    rightPane.scrollTo({ top: Math.max(0, rightPane.scrollTop + rightCard.getBoundingClientRect().top - rightPane.getBoundingClientRect().top - 10), behavior: smooth ? "smooth" : "auto" });
    rightPane.querySelectorAll(".soide-editor-qcard.is-synced-active").forEach(c => c.classList.remove("is-synced-active"));
    rightCard.classList.add("is-synced-active");
    _qbEditLastSyncedRightToLeft = String(qId);
}

// Xuất ra window scope
window.ensureQbankMidEditControlsInDOM = ensureQbankMidEditControlsInDOM;
window.toggleQbankMidEditMode = toggleQbankMidEditMode;
window.openQbankMidEditMode = openQbankMidEditMode;
window.closeQbankMidEditMode = closeQbankMidEditMode;
window.qbEditFlushOpenRawCards = qbEditFlushOpenRawCards;
window.commitQbankMidEditChanges = commitQbankMidEditChanges;
window.qbEditTriggerUpload = qbEditTriggerUpload;
window.qbEditHandleFileSelected = qbEditHandleFileSelected;
window.qbEditAddNewQuestion = qbEditAddNewQuestion;
window.qbEditDownloadJson = qbEditDownloadJson;
window.qbEditSetMode = qbEditSetMode;
window.qbEditHandleRawInput = qbEditHandleRawInput;
window.qbEditMarkCardRawDirty = qbEditMarkCardRawDirty;
window.qbEditUpdateMeta = qbEditUpdateMeta;
window.qbEditAutoResizeTextarea = qbEditAutoResizeTextarea;
window.qbEditAutoResizeAllTextareas = qbEditAutoResizeAllTextareas;
window.qbEditUpdateQuestionText = qbEditUpdateQuestionText;
window.qbEditUpdateOption = qbEditUpdateOption;
window.qbEditUpdateCorrectMC = qbEditUpdateCorrectMC;
window.qbEditUpdateStatementText = qbEditUpdateStatementText;
window.qbEditUpdateStatementCorrect = qbEditUpdateStatementCorrect;
window.qbEditUpdateShortAnswer = qbEditUpdateShortAnswer;
window.qbEditUpdateExplanation = qbEditUpdateExplanation;
window.qbEditChangeQuestionType = qbEditChangeQuestionType;
window.qbEditInsertQuestionAfter = qbEditInsertQuestionAfter;
window.qbEditDeleteQuestion = qbEditDeleteQuestion;
window.qbEditDeleteQuestionById = qbEditDeleteQuestionById;
window.qbEditToggleCardRawBox = qbEditToggleCardRawBox;
window.qbEditApplyCardRawInput = qbEditApplyCardRawInput;
window.qbEditHandlePasteZoneClick = qbEditHandlePasteZoneClick;
window.qbEditHandlePasteOnQuestion = qbEditHandlePasteOnQuestion;
window.qbEditTriggerPastePrompt = qbEditTriggerPastePrompt;
window.qbEditHandleImageSelected = qbEditHandleImageSelected;
window.qbEditUploadImage = qbEditUploadImage;
window.qbEditReloadQuestionImage = qbEditReloadQuestionImage;
window.qbEditDeleteQuestionImage = qbEditDeleteQuestionImage;
