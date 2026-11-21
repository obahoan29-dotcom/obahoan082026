// =========================================================
// FILE: qbank-export-bank.js
// MODULE 4/4 CỦA HỆ THỐNG NGÂN HÀNG ĐỀ:
// - POPOVER XUẤT FILE (PDF / WORD) THEO CÂY THƯ MỤC KIẾN THỨC
// - CỘT 3: TRÍCH XUẤT & LƯU ĐỀ THI MỚI VÀO NGÂN HÀNG
// - MODAL NGÂN HÀNG ĐỀ ĐÃ LƯU (XEM TRƯỚC, SOI ĐỀ, JSON, XÓA, CHUYỂN SANG 8 LỚP)
// =========================================================

// ============================================================================
// 1. XUẤT FILE (PDF / WORD) THEO CÂY THƯ MỤC
// ============================================================================
function syncExportSelectedFolderIds() {
    const validIds = new Set();
    function collectIds(nodes) {
        (nodes || []).forEach(n => {
            validIds.add(n.id);
            if (n.children && n.children.length > 0) collectIds(n.children);
        });
    }
    collectIds(qbankState.currentTree);
    const hasUnassigned = (qbankState.rawQuestions || []).some(q => q && !q.folderId);
    const cleaned = new Set();
    qbankState.exportSelectedFolderIds.forEach(id => {
        if (id === QBANK_EXPORT_UNASSIGNED_KEY) { if (hasUnassigned) cleaned.add(id); }
        else if (validIds.has(id)) cleaned.add(id);
    });
    qbankState.exportSelectedFolderIds = cleaned;
}

function toggleQbankExportPopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const popover = document.getElementById("qbank-export-popover");
    const triggerBtn = document.getElementById("btn-qbank-export-file");
    if (!popover || !triggerBtn) return;
    if (popover.classList.contains("show")) { closeQbankExportPopover(); return; }

    syncExportSelectedFolderIds();
    qbankState.exportCustomTitleTouched = false;
    renderQbankExportTree();
    updateQbankExportFooterUI();
    const formatMenu = document.getElementById("qbank-export-format-menu");
    if (formatMenu) formatMenu.classList.remove("show", "open-upward");

    popover.classList.add("show");
    triggerBtn.classList.add("is-open");
    const rect = triggerBtn.getBoundingClientRect();
    const popWidth = Math.min(450, window.innerWidth * 0.94);
    let left = Math.max(12, Math.min(rect.left, window.innerWidth - popWidth - 12));
    const approxHeight = Math.min(popover.offsetHeight || 420, window.innerHeight * 0.78);
    let top = rect.bottom + 8;
    if (top + approxHeight > window.innerHeight - 12) top = Math.max(12, window.innerHeight - approxHeight - 12);
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
}

function closeQbankExportPopover() {
    const p = document.getElementById("qbank-export-popover");
    const b = document.getElementById("btn-qbank-export-file");
    const m = document.getElementById("qbank-export-format-menu");
    if (p) p.classList.remove("show");
    if (b) b.classList.remove("is-open");
    if (m) m.classList.remove("show", "open-upward");
}

function handleQbankExportPopoverInnerClick(event) {
    event.stopPropagation();
    const actionWrap = document.getElementById("qbank-export-action-wrapper");
    const formatMenu = document.getElementById("qbank-export-format-menu");
    if (formatMenu && formatMenu.classList.contains("show") && (!actionWrap || !actionWrap.contains(event.target))) {
        formatMenu.classList.remove("show", "open-upward");
    }
}

function refreshQbankExportPopoverIfOpen() {
    const popover = document.getElementById("qbank-export-popover");
    if (popover && popover.classList.contains("show")) {
        syncExportSelectedFolderIds();
        renderQbankExportTree();
        updateQbankExportFooterUI();
    }
}

function toggleQbankExportNodeExpand(folderId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (qbankState.exportCollapsedFolderIds.has(folderId)) qbankState.exportCollapsedFolderIds.delete(folderId);
    else qbankState.exportCollapsedFolderIds.add(folderId);
    renderQbankExportTree();
}

function getExportNodeCheckState(node) {
    const isLeaf = (!node.children || node.children.length === 0);
    if (isLeaf) return { checked: qbankState.exportSelectedFolderIds.has(node.id), indeterminate: false };
    const descendantIds = getAllDescendantFolderIds(node).filter(id => id !== node.id);
    if (descendantIds.length === 0) return { checked: qbankState.exportSelectedFolderIds.has(node.id), indeterminate: false };
    let selectedCount = 0;
    descendantIds.forEach(id => { if (qbankState.exportSelectedFolderIds.has(id)) selectedCount++; });
    if (selectedCount === descendantIds.length) return { checked: true, indeterminate: false };
    if (selectedCount > 0 || qbankState.exportSelectedFolderIds.has(node.id)) return { checked: false, indeterminate: true };
    return { checked: false, indeterminate: false };
}

function toggleQbankExportFolderCheck(folderId, isChecked) {
    const targetNode = findNodeInTree(qbankState.currentTree, folderId);
    if (!targetNode) return;
    const allIds = getAllDescendantFolderIds(targetNode);
    if (isChecked) {
        allIds.forEach(id => qbankState.exportSelectedFolderIds.add(id));
    } else {
        allIds.forEach(id => qbankState.exportSelectedFolderIds.delete(id));
        const path = getFolderPathNodes(folderId);
        for (let i = 0; i < path.length - 1; i++) {
            const anc = path[i];
            if (!(qbankState.rawQuestions || []).some(q => q && q.folderId === anc.id)) {
                qbankState.exportSelectedFolderIds.delete(anc.id);
            }
        }
    }
    renderQbankExportTree();
    updateQbankExportFooterUI();
}

function toggleQbankExportUnassignedCheck(isChecked) {
    if (isChecked) qbankState.exportSelectedFolderIds.add(QBANK_EXPORT_UNASSIGNED_KEY);
    else qbankState.exportSelectedFolderIds.delete(QBANK_EXPORT_UNASSIGNED_KEY);
    updateQbankExportFooterUI();
}

function selectAllQbankExportFolders(selectAll) {
    if (!selectAll) {
        qbankState.exportSelectedFolderIds.clear();
    } else {
        function addAll(nodes) {
            (nodes || []).forEach(n => {
                qbankState.exportSelectedFolderIds.add(n.id);
                if (n.children && n.children.length > 0) addAll(n.children);
            });
        }
        addAll(qbankState.currentTree);
        if ((qbankState.rawQuestions || []).some(q => q && !q.folderId)) {
            qbankState.exportSelectedFolderIds.add(QBANK_EXPORT_UNASSIGNED_KEY);
        }
    }
    renderQbankExportTree();
    updateQbankExportFooterUI();
}

function renderQbankExportTree() {
    const container = document.getElementById("qbank-export-tree-list");
    if (!container) return;
    const directCounts = {};
    let unassignedCount = 0;
    (qbankState.rawQuestions || []).forEach(q => {
        if (!q) return;
        if (q.folderId) directCounts[q.folderId] = (directCounts[q.folderId] || 0) + 1;
        else unassignedCount++;
    });
    function getSubtreeCount(node) {
        let sum = directCounts[node.id] || 0;
        if (node.children && node.children.length > 0) node.children.forEach(c => { sum += getSubtreeCount(c); });
        return sum;
    }
    const indeterminateIds = [];
    function buildExportNodeHtml(node) {
        const isLeaf = (!node.children || node.children.length === 0);
        const isCollapsed = !isLeaf && qbankState.exportCollapsedFolderIds.has(node.id);
        const count = getSubtreeCount(node);
        const state = getExportNodeCheckState(node);
        const nodeColor = node.color || "#0284c7";
        if (state.indeterminate) indeterminateIds.push(node.id);
        const toggleBtnHtml = !isLeaf ? `<button type="button" class="export-tree-toggle" onclick="toggleQbankExportNodeExpand('${node.id}', event)">${isCollapsed ? "▶" : "▼"}</button>` : `<span class="export-tree-toggle-spacer"></span>`;
        const childrenHtml = (!isLeaf && !isCollapsed) ? `<div class="export-tree-children">${node.children.map(c => buildExportNodeHtml(c)).join("")}</div>` : "";
        return `<div class="export-tree-node"><div class="export-tree-row ${count === 0 ? "is-empty-folder" : ""}">${toggleBtnHtml}<label class="export-tree-label"><input type="checkbox" id="exp-chk-${node.id}" ${state.checked ? "checked" : ""} onchange="toggleQbankExportFolderCheck('${node.id}', this.checked)"><span style="color:${nodeColor}; font-size:13px;">${isLeaf ? "📄" : "📁"}</span><span class="export-tree-name" style="color:${nodeColor};">${escapeQbankHtml(node.name)}</span><span class="export-tree-count ${count === 0 ? "zero" : ""}">${count} câu</span></label></div>${childrenHtml}</div>`;
    }
    let html = (qbankState.currentTree || []).map(r => buildExportNodeHtml(r)).join("");
    if (unassignedCount > 0) {
        const isUnassignedChecked = qbankState.exportSelectedFolderIds.has(QBANK_EXPORT_UNASSIGNED_KEY);
        html += `<div class="export-tree-divider"><div class="export-tree-row"><span class="export-tree-toggle-spacer"></span><label class="export-tree-label"><input type="checkbox" id="exp-chk-unassigned" ${isUnassignedChecked ? "checked" : ""} onchange="toggleQbankExportUnassignedCheck(this.checked)"><span style="font-size:13px;">📥</span><span class="export-tree-name" style="color:#b45309;">Câu chưa xếp của đề gốc</span><span class="export-tree-count">${unassignedCount} câu</span></label></div></div>`;
    }
    container.innerHTML = html || `<div style="text-align:center; padding:24px; color:#94a3b8; font-size:12px;">Chưa có thư mục nào.</div>`;
    indeterminateIds.forEach(id => {
        const chk = document.getElementById(`exp-chk-${id}`);
        if (chk) chk.indeterminate = true;
    });
}

function getSelectedQbankExportQuestions() {
    const selectedSet = qbankState.exportSelectedFolderIds;
    if (!selectedSet || selectedSet.size === 0) return [];
    const includeUnassigned = selectedSet.has(QBANK_EXPORT_UNASSIGNED_KEY);
    const list = (qbankState.rawQuestions || []).filter(q => q && (q.folderId ? selectedSet.has(q.folderId) : includeUnassigned));
    const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };
    const { orderMap } = buildTreeOrderMap();
    return [...list].sort((a, b) => {
        const pA = getQbankQuestionPart(a), pB = getQbankQuestionPart(b);
        if (pA !== pB) return pA - pB;
        const lvlA = levelOrder[a.level || "nb"] || 1, lvlB = levelOrder[b.level || "nb"] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;
        const ordA = a.folderId ? (orderMap[a.folderId] ?? 999999) : 999999;
        const ordB = b.folderId ? (orderMap[b.folderId] ?? 999999) : 999999;
        if (ordA !== ordB) return ordA - ordB;
        if (a.matrixSeq && b.matrixSeq) return a.matrixSeq - b.matrixSeq;
        return (a.origIndex || 0) - (b.origIndex || 0);
    });
}

function onQbankExportTitleManualInput() { qbankState.exportCustomTitleTouched = true; }

function buildDefaultQbankExportTitle(questionCount) {
    const selectedNames = [];
    function collectSelectedLabels(nodes) {
        (nodes || []).forEach(n => {
            const st = getExportNodeCheckState(n);
            if (st.checked) selectedNames.push(n.name);
            else if (st.indeterminate && n.children && n.children.length > 0) collectSelectedLabels(n.children);
        });
    }
    collectSelectedLabels(qbankState.currentTree);
    if (qbankState.exportSelectedFolderIds.has(QBANK_EXPORT_UNASSIGNED_KEY)) selectedNames.push(qbankState.currentExamTitle || "Đề gốc chưa xếp");
    if (selectedNames.length === 1) return `NGÂN HÀNG ĐỀ - ${selectedNames[0].toUpperCase()}`;
    if (selectedNames.length > 1) return `ĐỀ TRÍCH XUẤT NGÂN HÀNG (${selectedNames.length} MỤC - ${questionCount} CÂU)`;
    return "ĐỀ TRÍCH XUẤT TỪ NGÂN HÀNG CÂU HỎI";
}

function updateQbankExportFooterUI() {
    const summaryEl = document.getElementById("qbank-export-summary");
    const emptyHintEl = document.getElementById("qbank-export-empty-hint");
    const actionWrap = document.getElementById("qbank-export-action-wrapper");
    const btnText = document.getElementById("btn-qbank-export-options-text");
    const formatMenu = document.getElementById("qbank-export-format-menu");
    const titleInput = document.getElementById("qbank-export-title-input");
    const qCount = getSelectedQbankExportQuestions().length;
    let selectedLeafCount = 0;
    qbankState.exportSelectedFolderIds.forEach(id => {
        if (id === QBANK_EXPORT_UNASSIGNED_KEY) selectedLeafCount++;
        else {
            const n = findNodeInTree(qbankState.currentTree, id);
            if (n && (!n.children || n.children.length === 0)) selectedLeafCount++;
        }
    });
    const hasAny = qbankState.exportSelectedFolderIds.size > 0;
    const displayFolderCount = selectedLeafCount > 0 ? selectedLeafCount : qbankState.exportSelectedFolderIds.size;
    if (summaryEl) summaryEl.innerHTML = `Đã chọn: <b>${displayFolderCount}</b> mục • <b>${qCount}</b> câu`;
    if (titleInput && !qbankState.exportCustomTitleTouched) titleInput.value = hasAny ? buildDefaultQbankExportTitle(qCount) : "";
    if (hasAny) {
        if (emptyHintEl) emptyHintEl.style.display = "none";
        if (actionWrap) actionWrap.style.display = "inline-flex";
        if (btnText) btnText.textContent = `Tùy chọn xuất (${qCount} câu)`;
    } else {
        if (emptyHintEl) emptyHintEl.style.display = "block";
        if (actionWrap) actionWrap.style.display = "none";
        if (formatMenu) formatMenu.classList.remove("show", "open-upward");
    }
}

function toggleQbankExportFormatMenu(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById("qbank-export-format-menu");
    const btn = document.getElementById("btn-qbank-export-options");
    if (!menu || !btn) return;
    if (menu.classList.contains("show")) { menu.classList.remove("show", "open-upward"); return; }
    menu.classList.toggle("open-upward", window.innerHeight - btn.getBoundingClientRect().bottom < 145);
    menu.classList.add("show");
}

function normalizeQuestionForExamOutput(rawQ, idx, imagesMap) {
    const letters = ["A", "B", "C", "D"];
    const q = JSON.parse(JSON.stringify(rawQ));
    const p = getQbankQuestionPart(q);
    q.id = idx + 1;
    const resolvedImg = resolveQbankImageUrl(rawQ, imagesMap);
    if (resolvedImg) {
        q.imageUrl = resolvedImg;
        q.imageKey = `img_q_${q.id}`;
        if (imagesMap && typeof imagesMap === "object") imagesMap[q.imageKey] = resolvedImg;
    }
    if (p === 1) {
        q.type = "multiple_choice"; delete q.part; delete q.isPart4;
        q.options = Array.isArray(q.options) ? q.options.map(o => String(o ?? "")) : ["", "", "", ""];
        if (typeof q.correct === "string") {
            const cIdx = letters.indexOf(q.correct.trim().toUpperCase());
            q.correct = cIdx !== -1 ? cIdx : 0;
        } else if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) {
            q.correct = 0;
        }
    } else if (p === 2) {
        q.type = "true_false"; delete q.part; delete q.isPart4;
        q.statements = Array.isArray(q.statements) ? q.statements.map((st, sIdx) => ({
            id: st.id || ["a", "b", "c", "d"][sIdx] || String(sIdx + 1),
            statement: String(st.statement ?? ""),
            correct: (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true")
        })) : [];
    } else if (p === 4) {
        q.type = "essay";
        q.correctAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : ""));
    } else {
        q.type = "short_answer"; delete q.part; delete q.isPart4;
        q.correctAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : ""));
    }
    return q;
}

function executeQbankExport(format, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const exportQuestions = getSelectedQbankExportQuestions();
    if (exportQuestions.length === 0) return showQbankToast("⚠️ Các thư mục đang chọn hiện có 0 câu hỏi!", "warning");
    const titleInput = document.getElementById("qbank-export-title-input");
    const exportTitle = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : buildDefaultQbankExportTitle(exportQuestions.length);
    const includeKey = document.getElementById("qbank-export-include-key") ? !!document.getElementById("qbank-export-include-key").checked : true;
    const exportImagesMap = { ...(qbankState.imagesMap || {}) };
    const normalizedQuestions = exportQuestions.map((rawQ, idx) => normalizeQuestionForExamOutput(rawQ, idx, exportImagesMap));
    const exportData = { title: exportTitle, maDe: "QBANK", timeLimitMinutes: 90, questions: normalizedQuestions, images: exportImagesMap };

    if (format === "pdf") {
        if (typeof exportExamToPDF !== "function") return alert("❌ Không tìm thấy bộ xuất PDF!");
        closeQbankExportPopover();
        exportExamToPDF(exportData, exportTitle, "QBANK", 90, includeKey);
        showQbankToast(`📄 Đã mở bản xem in / Xuất PDF (${normalizedQuestions.length} câu)!`, "success");
    } else if (format === "word") {
        if (typeof exportExamToWord !== "function") return alert("❌ Không tìm thấy bộ xuất Word!");
        closeQbankExportPopover();
        exportExamToWord(exportData, exportTitle, "QBANK", 90, includeKey);
        showQbankToast(`📝 Đã tải file Word (.doc) gồm ${normalizedQuestions.length} câu!`, "success");
    }
}

// ============================================================================
// 2. CỘT 3: TRÍCH XUẤT ĐỀ THI & NGÂN HÀNG ĐÃ LƯU
// ============================================================================
function updateQbankBuilderStats() {
    const container = document.getElementById("qbank-builder-stats");
    if (!container) return;
    const total = pruneStaleSelectedQuestionIds();
    if (total === 0) {
        container.innerHTML = `<p style="color:#64748b; font-style:italic;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>`;
        return;
    }
    const pCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }, lvlCounts = { nb: 0, th: 0, vdt: 0, vdc: 0 };
    qbankState.rawQuestions.forEach(q => {
        if (qbankState.selectedQuestionIds.has(String(q.id))) {
            const p = getQbankQuestionPart(q), lvl = q.level || "nb";
            if (pCounts[p] !== undefined) pCounts[p]++;
            if (lvlCounts[lvl] !== undefined) lvlCounts[lvl]++;
        }
    });
    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
            <span style="font-weight:900; color:#10b981; font-size:13px;">🎯 Đã chọn: ${total} câu</span>
            <button type="button" onclick="clearSelectedQuestions()" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:5px; padding:2px 6px; font-size:10.5px; font-weight:800; cursor:pointer;">Bỏ chọn hết</button>
        </div>
        <div style="font-size:11px; color:#334155; margin-bottom:4px;"><b>Phần:</b> P1(${pCounts[1]}) • P2(${pCounts[2]}) • P3(${pCounts[3]}) • P4(${pCounts[4]})</div>
        <div style="font-size:11px; color:#334155; margin-bottom:4px;"><b>Mức độ:</b> NB(${lvlCounts.nb}) • TH(${lvlCounts.th}) • VD(${lvlCounts.vdt}) • VDC(${lvlCounts.vdc})</div>
        <div style="font-size:10.5px; color:#64748b;">Hệ thống sẽ tự động xếp lại câu từ 1 ➔ ${total} và bảo toàn đầy đủ phương án A,B,C,D, hình vẽ &amp; lời giải.</div>
    `;
}

async function saveExtractedExamToBank() {
    if (!requireQbankAdminOrPrompt()) return;
    const titleInp = document.getElementById("qbank-exam-name");
    const gradeSel = document.getElementById("qbank-exam-grade");
    const title = titleInp ? titleInp.value.trim() : "";
    const grade = gradeSel ? gradeSel.value : "Lop_11";
    if (!title) { alert("⚠️ Vui lòng nhập Tên đề thi mới!"); if (titleInp) titleInp.focus(); return; }

    const pickedRaw = qbankState.rawQuestions.filter(q => qbankState.selectedQuestionIds.has(String(q.id)));
    if (pickedRaw.length === 0) {
        updateQbankDeleteSelectedButtonUI();
        updateQbankBuilderStats();
        return alert("⚠️ Thầy chưa tích chọn câu hỏi nào ở cột giữa!");
    }

    pickedRaw.sort((a, b) => getQbankQuestionPart(a) - getQbankQuestionPart(b));
    const examImagesMap = {};
    const selectedQ = pickedRaw.map((q, idx) => {
        const resolved = resolveQbankImageUrl(q, qbankState.imagesMap);
        const normalized = normalizeQuestionForExamOutput(q, idx, examImagesMap);
        if (resolved) {
            normalized.imageUrl = resolved;
            normalized.imageKey = `img_q_${normalized.id}`;
            examImagesMap[normalized.imageKey] = resolved;
        }
        return normalized;
    });

    const btn = document.getElementById("btn-save-extracted-exam");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang lưu đề..."; }

    const newExam = {
        id: "exam_bank_" + Date.now(),
        title,
        grade,
        questionCount: selectedQ.length,
        createdAt: new Date().toISOString(),
        assignedClasses: [],
        questions: selectedQ,
        images: examImagesMap,
        scoringConfig: { mode: "option1" }
    };

    try {
        await loadSavedExamsList(false);
        qbankState.savedExams.unshift(newExam);
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        const client = getQbankSupabaseClient();
        if (client) await client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });

        if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "saveQuestionBankData",
                    path: `KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/${grade}`,
                    filename: `${title.replace(/\s/g, "_")}.json`,
                    data: newExam
                })
            }).catch(() => {});
        }
        alert(`🎉 ĐÃ LƯU ĐỀ "${title}" VÀO NGÂN HÀNG THÀNH CÔNG!`);
        closeQbankCreatorModal();
        openSavedExamsModal();
    } catch (err) {
        alert("❌ Lỗi lưu đề: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Lưu đề vào Ngân hàng"; }
    }
}

async function loadSavedExamsList(doRender = true) {
    try { const local = localStorage.getItem("qbank_saved_exams"); if (local) qbankState.savedExams = JSON.parse(local) || []; } catch (e) {}
    const client = getQbankSupabaseClient();
    if (client) {
        try {
            const { data } = await client.from("app_key_values").select("value").eq("key", "qbank_saved_exams").single();
            if (data && Array.isArray(data.value)) {
                qbankState.savedExams = data.value;
                localStorage.setItem("qbank_saved_exams", JSON.stringify(data.value));
            }
        } catch (e) {}
    }
    if (doRender) {
        const filterSel = document.getElementById("qbank-filter-grade");
        filterSavedExamsList(filterSel ? filterSel.value : "all");
    }
}

function filterSavedExamsList(gradeVal) {
    qbankState.savedExamFilter = gradeVal;
    const container = document.getElementById("qbank-saved-list");
    if (!container) return;
    let list = qbankState.savedExams || [];
    if (gradeVal !== "all") list = list.filter(e => e.grade === gradeVal);
    if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b; font-size:12px;">Chưa có đề thi nào trong phân loại này.</div>`;
        return;
    }

    container.innerHTML = list.map(exam => {
        const dateStr = exam.createdAt ? new Date(exam.createdAt).toLocaleString("vi-VN") : "---";
        const assignedTags = (exam.assignedClasses && exam.assignedClasses.length > 0)
            ? exam.assignedClasses.map(c => `<span class="exam-tag">✅ ${escapeQbankHtml(c)}</span>`).join("")
            : `<span style="font-size:10.5px; color:#94a3b8; font-style:italic;">Chưa chuyển</span>`;
        return `
            <div class="saved-exam-item">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:14px; font-weight:900; color:#0f172a;">📑 ${escapeQbankHtml(exam.title)}</div>
                    <div style="font-size:11.5px; color:#64748b; font-weight:600; margin-top:3px;">${exam.questionCount} câu • Khối: <b style="color:#0284c7;">${escapeQbankHtml(exam.grade)}</b> • Tạo: ${dateStr}</div>
                    <div class="exam-assigned-tags" style="display:flex; gap:4px; margin-top:5px; flex-wrap:wrap;">${assignedTags}</div>
                </div>
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    <button class="btn-qbank btn-qbank-primary" onclick="openTransferExamModal('${exam.id}')">🚀 Chuyển lớp</button>
                    <button class="btn-qbank btn-qbank-success" onclick="previewSavedExam('${exam.id}')">👁️ Xem đề</button>
                    <button class="btn-qbank" style="background:#8b5cf6; color:#fff;" onclick="openInSoiDeFromBank('${exam.id}')" title="Mở sang công cụ Soi đề">🔬 Soi đề</button>
                    <button class="btn-qbank" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;" onclick="downloadSavedExamJson('${exam.id}')">💾 JSON</button>
                    <button class="btn-qbank btn-qbank-danger" onclick="deleteSavedExam('${exam.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join("");
}

function previewSavedExam(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    let modal = document.getElementById("modal-qbank-preview");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-qbank-preview";
        modal.className = "qbank-modal-overlay";
        modal.innerHTML = `<div class="qbank-modal-container" style="width:820px; height:85vh; max-width:95vw;"><div class="qbank-header"><div style="font-size:14.5px; font-weight:900; display:flex; align-items:center; gap:8px;"><span>👁️</span> <span id="qbank-preview-title">Xem trước đề</span></div><button onclick="document.getElementById('modal-qbank-preview').style.display='none'" style="background:none; border:none; color:#fff; font-size:20px; font-weight:900; cursor:pointer;">✕</button></div><div id="qbank-preview-body" style="flex:1; overflow-y:auto; padding:14px; background:#ffffff;"></div></div>`;
        document.body.appendChild(modal);
    }
    document.getElementById("qbank-preview-title").innerText = `📑 ${exam.title} (${exam.questionCount} câu)`;
    const body = document.getElementById("qbank-preview-body");
    const letters = ["A", "B", "C", "D"];
    const examImages = exam.images || {};
    let html = "";
    (exam.questions || []).forEach((q, idx) => {
        const imgUrl = resolveQbankImageUrl(q, examImages);
        const imgHtml = imgUrl ? `<div style="text-align:center; margin:6px 0;"><img src="${escapeQbankAttr(imgUrl)}" onerror="handleQbankImgError(this)" style="max-height:180px; max-width:100%; border-radius:8px; border:1px solid #cbd5e1;" alt="Hình câu ${idx + 1}"></div>` : "";
        let optionsHtml = "";
        if (q.type === "multiple_choice" && Array.isArray(q.options)) {
            let cIdx = typeof q.correct === "number" ? q.correct : letters.indexOf(String(q.correct).toUpperCase());
            optionsHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">${q.options.map((opt, oIdx) => `<div style="padding:5px 8px; border-radius:5px; border:1px solid #cbd5e1; background:${oIdx === cIdx ? "#dcfce7" : "#f8fafc"}; font-size:12px; font-weight:${oIdx === cIdx ? "800" : "600"}; color:${oIdx === cIdx ? "#15803d" : "#1e293b"};"><b>${letters[oIdx]}.</b> ${opt} ${oIdx === cIdx ? "✓" : ""}</div>`).join("")}</div>`;
        } else if (q.type === "true_false" && Array.isArray(q.statements)) {
            optionsHtml = `<div style="margin-top:5px; border:1px solid #e2e8f0; border-radius:5px; padding:5px; background:#f8fafc;">${q.statements.map(st => `<div style="font-size:11.5px; margin-bottom:3px; display:flex; justify-content:space-between;"><span><b>${st.id})</b> ${st.statement}</span><b style="color:${st.correct ? "#16a34a" : "#dc2626"};">${st.correct ? "🟢 Đúng" : "🔴 Sai"}</b></div>`).join("")}</div>`;
        } else {
            optionsHtml = `<div style="margin-top:5px; font-size:12px; font-weight:800; color:#0d9488;">🎯 Đáp số: <span style="color:#0f172a;">${q.correctAnswer || q.correct || "---"}</span></div>`;
        }
        const expHtml = q.explanation ? `<div style="font-size:11px; color:#78350f; background:#fffbeb; padding:5px; border-radius:5px; margin-top:5px; border-left:3px solid #f59e0b;">💡 <b>Lời giải:</b> ${q.explanation}</div>` : "";
        const redIdBadge = q.matrixId ? `<span class="qbank-q-id-badge" style="margin-left:6px; font-size:10.5px;">${escapeQbankHtml(q.matrixId)}</span>` : "";
        html += `<div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed #cbd5e1;"><div style="font-size:13px; font-weight:700; color:#0f172a;"><b style="color:#0284c7;">Câu ${idx + 1}:</b> ${qbFormatQuestionText(q.question || "")} ${redIdBadge}</div>${imgHtml}${optionsHtml}${expHtml}</div>`;
    });
    body.innerHTML = html;
    modal.style.display = "flex";
    if (window.MathJax && MathJax.typesetPromise) { try { MathJax.typesetPromise([body]).catch(() => {}); } catch (e) {} }
}

function openInSoiDeFromBank(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    if (typeof ensureSoiDeModalInDOM === "function") ensureSoiDeModalInDOM();
    if (typeof soiDeState !== "undefined") {
        soiDeState.examData = {
            id: exam.id,
            title: exam.title,
            maDe: "101",
            timeLimitMinutes: 90,
            images: { ...(exam.images || {}) },
            questions: JSON.parse(JSON.stringify(exam.questions || [])),
            scoringConfig: exam.scoringConfig || { mode: "option1" }
        };
        soiDeState.isFromQBank = false;
        if (typeof openSoiDeModal === "function") { closeSavedExamsModal(); openSoiDeModal(); }
    } else {
        alert("⚠️ Không tìm thấy công cụ Soi đề trên trang này!");
    }
}

function openTransferExamModal(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    qbankState.currentExamToTransfer = exam;
    createTransferModalInDOM();
    const titleEl = document.getElementById("transfer-exam-title");
    if (titleEl) titleEl.innerText = exam.title;
    const modal = document.getElementById("modal-transfer-exam");
    if (modal) modal.style.display = "flex";
}

function createTransferModalInDOM() {
    if (document.getElementById("modal-transfer-exam")) return;
    const div = document.createElement("div");
    div.id = "modal-transfer-exam";
    div.className = "qbank-modal-overlay";
    div.innerHTML = `
        <div class="qbank-modal-container" style="width:480px; height:auto; padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:10px;">
                <h3 style="font-size:14.5px; font-weight:900; color:#0284c7;">🚀 CHUYỂN ĐỀ SANG LỚP</h3>
                <button onclick="document.getElementById('modal-transfer-exam').style.display='none'" style="background:none; border:none; font-size:18px; font-weight:900; cursor:pointer;">✕</button>
            </div>
            <div style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:10px;" id="transfer-exam-title">...</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:14px;" id="transfer-class-list">
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-11a"> <span>🏫 Lớp 11A</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-11c"> <span>🏫 Lớp 11C</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-10p"> <span>🏫 Lớp 10P</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-11e"> <span>🏫 Lớp 11E</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="them-10"> <span>📐 Thêm 10</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="them-11" checked> <span>✍️ Thêm 11</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="them-12"> <span>🎓 Thêm 12</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="hsg-toan-11"> <span>🏆 HSG Toán 11</span></label>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-qbank" style="flex:1; background:#f1f5f9; color:#475569;" onclick="document.getElementById('modal-transfer-exam').style.display='none'">Hủy</button>
                <button class="btn-qbank btn-qbank-success" style="flex:1.5;" onclick="confirmTransferExamToClasses()">🚀 Xác nhận chuyển</button>
            </div>
        </div>`;
    document.body.appendChild(div);
}

async function confirmTransferExamToClasses() {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.currentExamToTransfer;
    if (!exam) return;
    const checked = Array.from(document.querySelectorAll("#transfer-class-list input:checked")).map(c => c.value);
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn ít nhất 1 lớp!");
    const client = getQbankSupabaseClient();
    if (!client) return alert("❌ Chưa kết nối Supabase!");

    try {
        const quizId = "quiz_" + Date.now();
        const dateStr = new Date().toLocaleString("vi-VN");
        const { error: qErr } = await client.from("quizzes").upsert({
            id: quizId,
            title: exam.title,
            made: "101",
            time_limit_minutes: 90,
            scoring_config: exam.scoringConfig || { mode: "option1" },
            questions: exam.questions,
            images: exam.images || {}
        });
        if (qErr) throw qErr;

        const defaultAvatar = (typeof PRESET_AVATARS !== "undefined" && PRESET_AVATARS[0]) ? PRESET_AVATARS[0] : "";
        const { error: lErr } = await client.from("custom_links").insert(checked.map(cat => ({
            id: quizId,
            category_id: cat,
            title: exam.title,
            date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT",
            is_hot: true,
            is_doc: false,
            avatar: defaultAvatar,
            is_shuffled: true,
            allow_free: true,
            time_limit_minutes: 90,
            timestamp: Date.now()
        })));
        if (lErr) throw lErr;

        const classNamesMap = { "lop-11a": "Lớp 11A", "lop-11c": "Lớp 11C", "lop-10p": "Lớp 10P", "lop-11e": "Lớp 11E", "them-10": "Thêm 10", "them-11": "Thêm 11", "them-12": "Thêm 12", "hsg-toan-11": "HSG Toán 11" };
        if (!exam.assignedClasses) exam.assignedClasses = [];
        checked.map(c => classNamesMap[c] || c).forEach(c => { if (!exam.assignedClasses.includes(c)) exam.assignedClasses.push(c); });

        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        await client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });

        alert(`🎉 ĐÃ CHUYỂN ĐỀ "${exam.title}" THÀNH CÔNG VÀO ${checked.length} LỚP!`);
        document.getElementById("modal-transfer-exam").style.display = "none";
        filterSavedExamsList(qbankState.savedExamFilter);
        if (typeof loadDataFromSupabase === "function") loadDataFromSupabase();
    } catch (err) {
        alert("❌ Lỗi chuyển đề: " + err.message);
    }
}

function downloadSavedExamJson(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    const a = document.createElement("a");
    const blob = new Blob([JSON.stringify(exam, null, 2)], { type: "application/json" });
    a.href = URL.createObjectURL(blob);
    a.download = `${exam.title.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function deleteSavedExam(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA đề thi này khỏi Ngân hàng đề không?")) return;
    qbankState.savedExams = qbankState.savedExams.filter(e => e.id !== examId);
    localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
    const client = getQbankSupabaseClient();
    if (client) client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });
    filterSavedExamsList(qbankState.savedExamFilter);
}

// Xuất ra window scope
window.toggleQbankExportPopover = toggleQbankExportPopover;
window.closeQbankExportPopover = closeQbankExportPopover;
window.handleQbankExportPopoverInnerClick = handleQbankExportPopoverInnerClick;
window.refreshQbankExportPopoverIfOpen = refreshQbankExportPopoverIfOpen;
window.toggleQbankExportNodeExpand = toggleQbankExportNodeExpand;
window.toggleQbankExportFolderCheck = toggleQbankExportFolderCheck;
window.toggleQbankExportUnassignedCheck = toggleQbankExportUnassignedCheck;
window.selectAllQbankExportFolders = selectAllQbankExportFolders;
window.onQbankExportTitleManualInput = onQbankExportTitleManualInput;
window.toggleQbankExportFormatMenu = toggleQbankExportFormatMenu;
window.executeQbankExport = executeQbankExport;
window.updateQbankBuilderStats = updateQbankBuilderStats;
window.saveExtractedExamToBank = saveExtractedExamToBank;
window.loadSavedExamsList = loadSavedExamsList;
window.filterSavedExamsList = filterSavedExamsList;
window.previewSavedExam = previewSavedExam;
window.openInSoiDeFromBank = openInSoiDeFromBank;
window.openTransferExamModal = openTransferExamModal;
window.confirmTransferExamToClasses = confirmTransferExamToClasses;
window.downloadSavedExamJson = downloadSavedExamJson;
window.deleteSavedExam = deleteSavedExam;