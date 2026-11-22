// =========================================================
// FILE: qbank-tree-questions.js
// MODULE 2/4 CỦA HỆ THỐNG NGÂN HÀNG ĐỀ:
// - CỘT 1: CÂY THƯ MỤC KIẾN THỨC & MA TRẬN 16 Ô KÉO THẢ
// - CỘT 2: DANH SÁCH THẺ CÂU HỎI (ĐÃ XẾP TRÊN CÙNG / CHƯA XẾP Ở DƯỚI)
// - CHUYỂN ĐỀ THI TỪ CÁC LỚP SANG NGÂN HÀNG ĐỀ
// - UPLOAD FILE JSON ĐỀ MỚI, DÁN ẢNH (CTRL + V)
// - MENU XÓA NHIỀU CÂU 3 TÙY CHỌN (1. CHỜ XẾP, 2. ĐANG HIỂN THỊ, 3. TÍCH CHỌN)
// =========================================================

let _qbankLeafHoverTimer = null;
let _qbankLeafHoverFolderId = null;

function cancelLeafAutoExpandTimer() {
    if (_qbankLeafHoverTimer) {
        clearTimeout(_qbankLeafHoverTimer);
        _qbankLeafHoverTimer = null;
    }
    _qbankLeafHoverFolderId = null;
}

// ============================================================================
// 1. CHUYỂN ĐỀ TỪ LỚP SANG CỘT GIỮA NGÂN HÀNG ĐỀ
// ============================================================================
function findClassItemFallback(categoryId, itemId, quizId) {
    const allCats = [
        ...(typeof DAY_THEM_CATEGORIES !== "undefined" ? DAY_THEM_CATEGORIES : []),
        ...(typeof CHINH_KHOA_CATEGORIES !== "undefined" ? CHINH_KHOA_CATEGORIES : []),
        ...(typeof KHO_TAI_LIEU_FOLDER !== "undefined" ? [KHO_TAI_LIEU_FOLDER] : [])
    ];
    for (const c of allCats) {
        if (!c || !Array.isArray(c.links)) continue;
        if (categoryId && c.id !== categoryId) continue;
        const found = c.links.find(l => l && (l.id === itemId || l.firebaseId === itemId || l.id === quizId || l.firebaseId === quizId));
        if (found) return found;
    }
    return null;
}

function normalizeQuestionAnswerOnTransfer(q) {
    if (!q) return;
    const letters = ["A", "B", "C", "D"];
    const part = getQbankQuestionPart(q);
    q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");

    if (part === 1) {
        q.type = "multiple_choice";
        q.part = 1;
        q.isPart4 = false;
        let rawCorrect = q.correct !== undefined ? q.correct : (q.answer !== undefined ? q.answer : q.dapan);
        if (typeof rawCorrect === "string") {
            const u = rawCorrect.trim().toUpperCase();
            const idx = letters.indexOf(u);
            q.correct = idx !== -1 ? idx : (parseInt(u, 10) >= 0 && parseInt(u, 10) <= 3 ? parseInt(u, 10) : 0);
        } else if (typeof rawCorrect === "number" && rawCorrect >= 0 && rawCorrect <= 3) {
            q.correct = rawCorrect;
        } else if (q.correct === undefined) {
            q.correct = 0;
        }
    } else if (part === 2) {
        q.type = "true_false";
        q.part = 2;
        q.isPart4 = false;
        if (Array.isArray(q.statements)) {
            q.statements.forEach((st, sIdx) => {
                if (!st.id) st.id = ["a", "b", "c", "d"][sIdx] || String(sIdx + 1);
                let val = st.correct !== undefined ? st.correct : (st.answer !== undefined ? st.answer : st.dapan);
                st.correct = val !== undefined ? (val === true || String(val).toLowerCase() === "đúng" || String(val).toLowerCase() === "true") : true;
            });
        }
    } else {
        if (part === 4) {
            q.part = 4;
            q.isPart4 = true;
            if (q.type !== "essay" && q.type !== "essay_answer" && q.type !== "part4") {
                q.type = "short_answer";
            }
        } else {
            q.type = "short_answer";
            q.part = 3;
            q.isPart4 = false;
        }
        let ans = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer !== undefined ? q.correct_answer : (q.correct !== undefined ? q.correct : (q.answer !== undefined ? q.answer : q.dapan)));
        q.correctAnswer = (ans !== undefined && ans !== null) ? String(ans).trim() : "0";
    }
}

async function transferClassExamToQBank(quizId, categoryId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!requireQbankAdminOrPrompt()) return;
    const btn = (event && event.currentTarget) ? event.currentTarget : null;
    const origBtnHtml = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Đang chuyển..."; }

    try {
        const client = getQbankSupabaseClient();
        if (!client) throw new Error("Chưa kết nối được cơ sở dữ liệu Supabase!");

        let quizRecord = null;
        const candidateIds = Array.from(new Set([quizId, itemId].filter(v => v && String(v).trim() !== "")));
        for (const idVal of candidateIds) {
            const { data, error } = await client.from("quizzes").select("*").eq("id", idVal).maybeSingle();
            if (!error && data && Array.isArray(data.questions) && data.questions.length > 0) { quizRecord = data; break; }
        }
        if (!quizRecord) throw new Error("Không tìm thấy dữ liệu câu hỏi của đề thi này trên Supabase!");

        const fallbackItem = findClassItemFallback(categoryId, itemId, quizId);
        const examTitle = (quizRecord.title && String(quizRecord.title).trim()) || (fallbackItem && fallbackItem.title && String(fallbackItem.title).trim()) || `Đề thi ${quizId}`;
        const rawQuestions = Array.isArray(quizRecord.questions) ? quizRecord.questions : [];
        const rawImages = (quizRecord.images && typeof quizRecord.images === "object") ? quizRecord.images : {};

        await loadQbankDraftState();

        const keptAssignedQuestions = (qbankState.rawQuestions || []).filter(q => Boolean(q && q.folderId));
        const oldUnassignedQuestions = (qbankState.rawQuestions || []).filter(q => Boolean(q && !q.folderId));

        if (oldUnassignedQuestions.length > 0) {
            const oldName = qbankState.currentExamTitle ? `"${qbankState.currentExamTitle}"` : "đề trước";
            const ok = confirm(`📥 CHUYỂN ĐỀ SANG NGÂN HÀNG ĐỀ:\n\nHiện cột giữa đang có ${oldUnassignedQuestions.length} câu chưa xếp của ${oldName}.\nBấm [OK] để đưa toàn bộ ${rawQuestions.length} câu của đề:\n"${examTitle}"\nvào cột giữa.\n\n(${keptAssignedQuestions.length} câu đã xếp trong thư mục vẫn được giữ nguyên 100%).`);
            if (!ok) return;
        }

        pushQbankUndoState(`Chuyển đề "${examTitle}" sang Ngân hàng đề`);
        const keptIds = new Set(keptAssignedQuestions.map(q => String(q.id)));
        const cleanedSelected = new Set();
        qbankState.selectedQuestionIds.forEach(id => { if (keptIds.has(String(id))) cleanedSelected.add(String(id)); });
        qbankState.selectedQuestionIds = cleanedSelected;
        if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") qbankState.imagesMap = {};

        const nowTs = Date.now();
        let transferredImageCount = 0;
        const importedQuestions = rawQuestions.map((item, idx) => {
            const q = JSON.parse(JSON.stringify(item));
            const resolvedImgUrl = resolveQbankImageUrl(q, rawImages);
            q.id = `qb_${nowTs}_${idx + 1}`;
            q.origIndex = idx + 1;
            q.sourceExam = examTitle;
            q.sourceQuizId = quizRecord.id || quizId;
            q.sourceCategoryId = categoryId || "";
            q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = "";
            delete q.assignedAt;
            q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
            normalizeQuestionAnswerOnTransfer(q);
            if (resolvedImgUrl) {
                const uniqueImgKey = `img_q_${q.id}`;
                q.imageUrl = resolvedImgUrl; q.imageKey = uniqueImgKey;
                qbankState.imagesMap[uniqueImgKey] = resolvedImgUrl;
                transferredImageCount++;
            } else {
                q.imageUrl = ""; q.imageKey = `img_q_${q.id}`;
            }
            return q;
        });

        qbankState.rawQuestions = [...keptAssignedQuestions, ...importedQuestions];
        qbankState.currentExamTitle = examTitle;
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
        qbankState.assignMode = true; qbankState.hideAssigned = false;

        recomputeAllMatrixIds();
        await saveQbankDraftState(false);
        await openQbankCreatorModal({ skipDraftReload: true });

        const listEl = document.getElementById("qbank-questions-list");
        if (listEl) listEl.scrollTop = 0;
        showQbankToast(`✅ Đã chuyển "${examTitle}" (${importedQuestions.length} câu${transferredImageCount > 0 ? `, ${transferredImageCount} hình vẽ` : ""}) vào cột giữa!`, "success");
    } catch (err) {
        alert("❌ Lỗi chuyển đề sang Ngân hàng đề: " + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
    }
}

// ============================================================================
// 2. CỘT 1: CÂY THƯ MỤC & MA TRẬN 16 Ô
// ============================================================================
function toggleLeafMatrixDisplay(folderId, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (qbankState.expandedLeafMatrixIds.has(folderId)) qbankState.expandedLeafMatrixIds.delete(folderId);
    else qbankState.expandedLeafMatrixIds.add(folderId);
    renderQbankTree();
}

// Thêm độ trễ 280ms khi lướt chuột qua thư mục lá đang đóng để tránh bung nhầm gây giật/đẩy ô phía dưới
function handleLeafTreeDragOver(e, folderId, isLeaf) {
    if (!qbankState.draggedQId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (!isLeaf || qbankState.expandedLeafMatrixIds.has(folderId)) return;

    if (_qbankLeafHoverFolderId !== folderId) {
        cancelLeafAutoExpandTimer();
        _qbankLeafHoverFolderId = folderId;
        _qbankLeafHoverTimer = setTimeout(() => {
            if (qbankState.draggedQId && _qbankLeafHoverFolderId === folderId && !qbankState.expandedLeafMatrixIds.has(folderId)) {
                qbankState.expandedLeafMatrixIds.add(folderId);
                renderQbankTree();
            }
            cancelLeafAutoExpandTimer();
        }, 280);
    }
}

function handleLeafTreeDragLeave(e, folderId) {
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    if (_qbankLeafHoverFolderId === folderId) {
        cancelLeafAutoExpandTimer();
    }
}

function renderQbankTree() {
    const rootEl = document.getElementById("qbank-tree-root");
    if (!rootEl) return;

    const directFolderCounts = {};
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && q.folderId) directFolderCounts[q.folderId] = (directFolderCounts[q.folderId] || 0) + 1;
    });

    function getSubtreeQuestionCount(node) {
        let sum = directFolderCounts[node.id] || 0;
        if (node.children && node.children.length > 0) node.children.forEach(c => { sum += getSubtreeQuestionCount(c); });
        return sum;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding-bottom:4px; border-bottom:1.5px solid #e2e8f0;">
            <b style="font-size:11.5px; color:#334155;">🌳 THƯ MỤC KIẾN THỨC:</b>
            <button class="btn-qbank btn-qbank-primary" style="padding:2px 7px; font-size:10.5px;" onclick="promptAddRootFolder()">+ Thư mục gốc</button>
        </div>
    `;

    function buildNodeHtml(node, depth = 0) {
        const isActive = (qbankState.activeFolderId === node.id && !qbankState.activeFilter.part);
        const nodeColor = node.color || "#0284c7";
        const isLeaf = (!node.children || node.children.length === 0);
        const subtreeCount = getSubtreeQuestionCount(node);
        const subHtml = !isLeaf ? `<div class="tree-children">${node.children.map(c => buildNodeHtml(c, depth + 1)).join("")}</div>` : "";
        const safeNodeId = safeQbankJsArg(node.id);

        let matrixDropHtml = "";
        const isMatrixOpen = isLeaf && qbankState.expandedLeafMatrixIds.has(node.id);
        if (isLeaf && isMatrixOpen) {
            const counts = { 1: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 2: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 3: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 4: { nb: 0, th: 0, vdt: 0, vdc: 0 } };
            (qbankState.rawQuestions || []).forEach(q => {
                if (q && q.folderId === node.id) {
                    const p = getQbankQuestionPart(q);
                    const lvl = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
                    if (counts[p] && counts[p][lvl] !== undefined) counts[p][lvl]++;
                }
            });

            matrixDropHtml = `
                <div class="leaf-matrix-container" onclick="event.stopPropagation()">
                    <div class="leaf-matrix-header-bar">
                        <span>📥 Ma trận 16 ô (${escapeQbankHtml(node.name)}):</span>
                        <button type="button" class="btn-clear-filter" onclick="toggleLeafMatrixDisplay('${safeNodeId}', event)">▲ Thu lại</button>
                    </div>
                    ${[1, 2, 3, 4].map(p => {
                        const isPartFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
                        return `
                        <div class="leaf-matrix-row">
                            <div class="leaf-matrix-lbl ${isPartFiltered ? "active-filter" : ""}" onclick="setFilterByNodePart('${safeNodeId}', ${p})" title="Xem câu Phần ${p}">P${p}</div>
                            ${["nb", "th", "vdt", "vdc"].map(lvl => {
                                const lblMap = { nb: "NB", th: "TH", vdt: "VD", vdc: "VDC" };
                                const isCellFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl);
                                return `<div class="leaf-drop-zone ${isCellFiltered ? "active-filter" : ""}" ondragover="handleDropZoneOver(event)" ondragleave="handleDropZoneLeave(event)" ondrop="handleDropZoneDrop(event, '${safeNodeId}', ${p}, '${lvl}')" onclick="handleMatrixCellClick('${safeNodeId}', ${p}, '${lvl}')" title="Kéo thả hoặc Click lọc P${p}-${lblMap[lvl]}"><span style="pointer-events:none;">${lblMap[lvl]}</span><b style="pointer-events:none;">(${counts[p][lvl]})</b></div>`;
                            }).join("")}
                        </div>`;
                    }).join("")}
                </div>
            `;
        }

        return `
            <div class="tree-item-wrapper" style="margin-left:${depth > 0 ? 3 : 0}px;">
                <div class="tree-item ${isActive ? "active" : ""}" id="tree-node-${escapeQbankAttr(node.id)}" onclick="handleFolderNodeClick('${safeNodeId}')" ondragover="handleLeafTreeDragOver(event, '${safeNodeId}', ${isLeaf})" ondragleave="handleLeafTreeDragLeave(event, '${safeNodeId}')" style="border-left:3.5px solid transparent;">
                    <div style="display:flex; align-items:center; gap:5px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:13px;">${isLeaf ? "📄" : "📁"}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; color:${nodeColor}; font-weight:800;" title="${escapeQbankHtml(node.name)}">${escapeQbankHtml(node.name)}</span>
                        ${subtreeCount > 0 ? `<span class="tree-q-count">${subtreeCount}</span>` : ""}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;" onclick="event.stopPropagation()">
                        ${isLeaf ? `<button class="btn-matrix-toggle ${isMatrixOpen ? "is-open" : ""}" onclick="toggleLeafMatrixDisplay('${safeNodeId}', event)" title="Mở/Đóng ma trận 16 ô">⊞</button>` : ""}
                        <div class="tree-color-picker-dot" style="background:${nodeColor};" onclick="promptChangeFolderColor('${safeNodeId}')" title="Đổi màu"></div>
                        <button class="btn-rename-tree" onclick="promptRenameFolder('${safeNodeId}')" title="Đổi tên">✏️</button>
                        ${!isLeaf || depth < 2 ? `<button class="btn-add-tree" onclick="promptAddChildFolder('${safeNodeId}')" title="Thêm mục con">+</button>` : ""}
                        <button class="btn-add-tree" style="color:#ef4444;" onclick="promptDeleteFolder('${safeNodeId}')" title="Xóa">✕</button>
                    </div>
                </div>
                ${matrixDropHtml}
                ${subHtml}
            </div>
        `;
    }

    html += qbankState.currentTree.map(r => buildNodeHtml(r, 0)).join("");
    rootEl.innerHTML = html;
}

function handleFolderNodeClick(folderId) {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);
    qbankState.activeFilter = { folderId: folderId, folderName: qbankState.activeFolderObj ? qbankState.activeFolderObj.name : "", part: null, level: null };
    const node = qbankState.activeFolderObj;
    if (node && (!node.children || node.children.length === 0)) qbankState.expandedLeafMatrixIds.add(folderId);
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function setFilterByNodePart(folderId, part) {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    const node = findNodeInTree(qbankState.currentTree, folderId);
    qbankState.activeFolderId = folderId; qbankState.activeFolderObj = node;
    qbankState.activeFilter = { folderId: folderId, folderName: node ? node.name : "", part: part, level: null };
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function handleMatrixCellClick(folderId, part, level) {
    const selectedUnassigned = Array.from(qbankState.selectedQuestionIds).filter(qId => {
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        return q && !q.folderId;
    });
    if (selectedUnassigned.length > 0 && selectedUnassigned.length === qbankState.selectedQuestionIds.size) {
        assignSelectedQuestionsToMatrix(folderId, part, level);
    } else {
        if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
        const node = findNodeInTree(qbankState.currentTree, folderId);
        qbankState.activeFolderId = folderId; qbankState.activeFolderObj = node;
        qbankState.activeFilter = { folderId: folderId, folderName: node ? node.name : "", part: part, level: level };
        syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    }
}

function syncAssignModeButtonsUI() {
    const assignBtn = document.getElementById("btn-toggle-assigned");
    if (assignBtn) {
        const isAssignActive = qbankState.assignMode && !qbankState.activeFilter.folderId && !qbankState.hideAssigned;
        assignBtn.classList.toggle("is-active", isAssignActive);
        assignBtn.innerHTML = isAssignActive ? `<span>📦</span> <b>Xếp câu (Đang bật)</b>` : `<span>📦</span> <b>Xếp câu (Trên cùng)</b>`;
    }
    const hideBtn = document.getElementById("btn-qbank-hide-assigned");
    if (hideBtn) {
        hideBtn.classList.toggle("is-active", qbankState.hideAssigned);
        hideBtn.innerHTML = qbankState.hideAssigned ? `<span>👁️</span> <b>Đang ẩn đã xếp</b>` : `<span>🙈</span> <b>Ẩn đã xếp</b>`;
    }
}

function clearQbankFilter() {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
    qbankState.assignMode = false; qbankState.hideAssigned = false;
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function toggleQbankAssignMode() {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    if (qbankState.activeFilter.folderId || qbankState.hideAssigned || !qbankState.assignMode) {
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
        qbankState.hideAssigned = false; qbankState.assignMode = true;
    } else {
        qbankState.assignMode = false;
    }
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function toggleHideAssignedQuestions() {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    if (qbankState.activeFilter.folderId) {
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null; qbankState.hideAssigned = true;
    } else {
        qbankState.hideAssigned = !qbankState.hideAssigned;
    }
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function promptRenameFolder(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    const newName = prompt("✏️ Đổi tên thư mục:", node.name);
    if (newName && newName.trim() && newName.trim() !== node.name) {
        pushQbankUndoState(`Đổi tên thư mục "${node.name}"`);
        node.name = newName.trim();
        if (qbankState.activeFilter.folderId === folderId) qbankState.activeFilter.folderName = node.name;
        recomputeAllMatrixIds(); saveQbankTreeData(); saveQbankDraftState(false);
        renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
        showQbankToast(`✏️ Đã đổi tên thành "${node.name}" & cập nhật ID!`, "success");
    }
}

function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Lớp 10):");
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm thư mục gốc "${name.trim()}"`);
        qbankState.currentTree.push({ id: "node_" + Date.now(), name: name.trim(), color: QBANK_COLOR_PALETTE[Math.floor(Math.random() * QBANK_COLOR_PALETTE.length)], children: [] });
        saveQbankTreeData(); saveQbankDraftState(false); renderQbankTree();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
        showQbankToast(`📁 Đã tạo thư mục gốc "${name.trim()}" & đồng bộ Cloud!`, "success");
    }
}

function promptAddChildFolder(parentId) {
    const parent = findNodeInTree(qbankState.currentTree, parentId);
    if (!parent) return;
    const name = prompt(`📁 Thêm mục con vào [${parent.name}]:`);
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm mục con "${name.trim()}"`);
        if (!parent.children) parent.children = [];
        parent.children.push({ id: "node_" + Date.now(), name: name.trim(), color: parent.color, children: [] });
        saveQbankTreeData(); saveQbankDraftState(false); renderQbankTree();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
        showQbankToast(`📁 Đã tạo mục "${name.trim()}" & đồng bộ Cloud!`, "success");
    }
}

function promptChangeFolderColor(folderId) {
    const oldModal = document.getElementById("color-picker-modal");
    if (oldModal) oldModal.remove();
    const safeFId = safeQbankJsArg(folderId);
    let colorHtml = `<div style="display:flex; gap:8px; justify-content:center; margin:10px 0;">`;
    QBANK_COLOR_PALETTE.forEach(c => { colorHtml += `<div onclick="applyFolderColorChange('${safeFId}', '${c}')" style="width:24px; height:24px; border-radius:50%; background:${c}; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`; });
    colorHtml += `</div>`;
    let div = document.createElement("div");
    div.className = "qbank-modal-overlay"; div.id = "color-picker-modal"; div.style.display = "flex";
    div.onclick = function(e) { if (e.target === div) div.remove(); };
    div.innerHTML = `<div class="qbank-modal-container" style="width:320px; height:auto; padding:22px; background:#fff; box-shadow:0 25px 60px rgba(0,0,0,0.5);" onclick="event.stopPropagation()"><h3 style="margin-top:0; color:#0f172a; font-weight:900; font-size:15px; text-align:center;">🎨 Chọn màu thư mục</h3>${colorHtml}<button onclick="document.getElementById('color-picker-modal').remove()" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; cursor:pointer; font-weight:800; color:#475569; margin-top:10px;">Đóng</button></div>`;
    document.body.appendChild(div);
}

window.applyFolderColorChange = function(folderId, newColor) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (node) {
        node.color = newColor;
        saveQbankTreeData();
        renderQbankTree();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    }
    const modal = document.getElementById("color-picker-modal");
    if (modal) modal.remove();
};

function promptDeleteFolder(folderId) {
    const targetNode = findNodeInTree(qbankState.currentTree, folderId);
    if (!targetNode) return;
    if (!confirm(`⚠️ Xóa thư mục "${targetNode.name}" và tất cả mục con?\n(Câu hỏi bên trong sẽ trở về mục Chưa xếp).`)) return;
    pushQbankUndoState(`Xóa thư mục "${targetNode.name}"`);

    const deletedIds = new Set(getAllDescendantFolderIds(targetNode));
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && q.folderId && deletedIds.has(q.folderId)) {
            q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = ""; delete q.assignedAt;
        }
    });

    const parent = findParentNodeInTree(qbankState.currentTree, folderId);
    if (parent) parent.children = parent.children.filter(c => c.id !== folderId);
    else qbankState.currentTree = qbankState.currentTree.filter(c => c.id !== folderId);

    if (qbankState.activeFolderId && deletedIds.has(qbankState.activeFolderId)) {
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    }
    deletedIds.forEach(id => qbankState.exportSelectedFolderIds.delete(id));

    recomputeAllMatrixIds(); saveQbankTreeData(); saveQbankDraftState(false);
    syncAssignModeButtonsUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`🗑️ Đã xóa thư mục "${targetNode.name}".`, "warning");
}

function selectQbankFolder(folderId) { handleFolderNodeClick(folderId); }

// ============================================================================
// 3. KÉO THẢ & GÁN VÀO MA TRẬN 16 Ô
// ============================================================================
function handleDropZoneOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    cancelLeafAutoExpandTimer();
    if (e.currentTarget) e.currentTarget.classList.add("drag-over");
}

function handleDropZoneLeave(e) {
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    if (e.currentTarget) e.currentTarget.classList.remove("drag-over");
}

// GÁN TƯỜNG MINH q.part (1..4) VÀ q.isPart4 (true/false) ĐỂ KHÔNG BAO GIỜ BỊ ĐẨY NHẦM VỀ P4
function mutateQuestionMatrix(qId, folderId, part, level, assignedTimestamp = null) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return null;

    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");

    if (targetPart === 1) {
        q.type = "multiple_choice";
        q.part = 1;
        q.isPart4 = false;
        if (!Array.isArray(q.options) || q.options.length === 0) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
        if (q.correct === undefined || q.correct === null) q.correct = 0;
    } else if (targetPart === 2) {
        q.type = "true_false";
        q.part = 2;
        q.isPart4 = false;
        if (!Array.isArray(q.statements) || q.statements.length === 0) {
            q.statements = [
                { id: "a", statement: "", correct: true },
                { id: "b", statement: "", correct: false },
                { id: "c", statement: "", correct: true },
                { id: "d", statement: "", correct: false }
            ];
        }
    } else if (targetPart === 3) {
        q.type = "short_answer";
        q.part = 3;
        q.isPart4 = false;
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
            q.correctAnswer = q.correct !== undefined ? String(q.correct) : "0";
        }
    } else if (targetPart === 4) {
        q.type = "short_answer";
        q.part = 4;
        q.isPart4 = true;
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
            q.correctAnswer = q.correct !== undefined ? String(q.correct) : "0";
        }
    }

    q.level = targetLevel;
    q.folderId = folderId;
    q.assignedAt = assignedTimestamp || Date.now();
    const cur = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = cur ? cur.name : "";
    return q;
}

function handleDropZoneDrop(e, folderId, part, level) {
    e.preventDefault();
    e.stopPropagation();
    cancelLeafAutoExpandTimer();
    if (e.currentTarget) e.currentTarget.classList.remove("drag-over");

    const qId = (e.dataTransfer ? e.dataTransfer.getData("text/plain") : "") || qbankState.draggedQId;
    qbankState.draggedQId = null;
    if (!qId) return;

    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const isMultiDrag = qbankState.selectedQuestionIds.has(String(qId)) && qbankState.selectedQuestionIds.size > 1;
    const idsToMove = isMultiDrag ? Array.from(qbankState.selectedQuestionIds) : [String(qId)];

    pushQbankUndoState(`Xếp ${idsToMove.length} câu vào ${folderLabel} (P${targetPart} - ${getQbankLevelLabel(targetLevel)})`);
    const baseTs = Date.now();
    let lastMovedQ = null;
    idsToMove.forEach((id, idx) => { const m = mutateQuestionMatrix(id, folderId, targetPart, targetLevel, baseTs + idx); if (m) lastMovedQ = m; });
    if (isMultiDrag) { qbankState.selectedQuestionIds.clear(); updateQbankDeleteSelectedButtonUI(); }
    if (!lastMovedQ) return;

    recomputeAllMatrixIds(); saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(idsToMove.length > 1 ? `✅ Đã xếp ${idsToMove.length} câu vào ${folderLabel} (${lastMovedQ.matrixId})` : `✅ Đã đánh số & xếp: ${lastMovedQ.matrixId}`, "success");
}

function assignSelectedQuestionsToMatrix(folderId, part, level) {
    if (qbankState.selectedQuestionIds.size === 0) return;
    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const count = qbankState.selectedQuestionIds.size;

    pushQbankUndoState(`Xếp ${count} câu vào ${folderLabel} (P${targetPart} - ${getQbankLevelLabel(targetLevel)})`);
    const baseTs = Date.now();
    let idx = 0;
    qbankState.selectedQuestionIds.forEach(qId => { mutateQuestionMatrix(qId, folderId, targetPart, targetLevel, baseTs + idx); idx++; });
    qbankState.selectedQuestionIds.clear();

    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`✅ Đã đánh số & xếp ${count} câu vào ${folderLabel}`, "success");
}

function applyMatrixToQuestion(qId, folderId, part, level) {
    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    pushQbankUndoState(`Chuyển câu vào ${targetFolder ? targetFolder.name : "Thư mục"} (P${targetPart} - ${getQbankLevelLabel(targetLevel)})`);
    const q = mutateQuestionMatrix(qId, folderId, targetPart, targetLevel, Date.now());
    if (!q) return;
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`✅ Đã chuyển câu: ${q.matrixId}`, "success");
}

function unassignQbankQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q || !q.folderId) return;
    pushQbankUndoState(`Bỏ xếp ${q.matrixId || "câu hỏi"}`);
    q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = ""; delete q.assignedAt;
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast("↩️ Đã trả câu về mục Chưa xếp!", "info");
}

// ============================================================================
// 4. CHUYỂN, XÓA LẺ & MENU XÓA NHIỀU CÂU (3 TÙY CHỌN)
// ============================================================================
function pruneStaleSelectedQuestionIds() {
    const existingIds = new Set((qbankState.rawQuestions || []).map(q => String(q.id)));
    const cleaned = new Set();
    qbankState.selectedQuestionIds.forEach(id => { if (existingIds.has(String(id))) cleaned.add(String(id)); });
    qbankState.selectedQuestionIds = cleaned;
    return cleaned.size;
}

function cleanupOrphanedImagesInQbank(deletedQuestions) {
    if (!Array.isArray(deletedQuestions) || deletedQuestions.length === 0) return;
    if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") return;

    const activeImageKeys = new Set();
    (qbankState.rawQuestions || []).forEach(q => {
        if (!q) return;
        if (q.imageKey) activeImageKeys.add(String(q.imageKey));
        activeImageKeys.add(`img_q_${q.id}`);
    });

    deletedQuestions.forEach(dq => {
        if (!dq) return;
        const k1 = dq.imageKey ? String(dq.imageKey) : "";
        const k2 = `img_q_${dq.id}`;
        if (k1 && !activeImageKeys.has(k1)) delete qbankState.imagesMap[k1];
        if (k2 && !activeImageKeys.has(k2)) delete qbankState.imagesMap[k2];
    });
}

function ensureQbankDeleteMultiDropdownInDOM() {
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!btn) return null;

    let wrapper = btn.closest(".qbank-delete-dropdown-wrapper");
    if (!wrapper && btn.parentNode) {
        wrapper = document.createElement("div");
        wrapper.className = "qbank-delete-dropdown-wrapper";
        wrapper.id = "qbank-delete-dropdown-wrapper";
        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
    }

    let menu = document.getElementById("qbank-delete-multi-menu");
    if (!menu && wrapper) {
        menu = document.createElement("div");
        menu.id = "qbank-delete-multi-menu";
        menu.className = "qbank-delete-menu";
        menu.onclick = function(e) { e.stopPropagation(); };
        menu.innerHTML = `
            <div class="qbank-delete-menu-header">
                <span>🗑️ TÙY CHỌN XÓA CÂU HỎI</span>
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:none;">Có thể ↩️ Lùi</span>
            </div>
            <div class="qbank-delete-menu-item" id="qbank-del-opt-unassigned" onclick="executeQbankMultiDelete('unassigned', event)">
                <div class="qbank-delete-item-left">
                    <span class="qbank-delete-item-icon">📥</span>
                    <div class="qbank-delete-item-text">
                        <b>1. Xóa câu Chờ xếp</b>
                        <small>Xóa các câu chưa kéo vào thư mục</small>
                    </div>
                </div>
                <span class="del-count-badge" id="qbank-del-count-unassigned">0 câu</span>
            </div>
            <div class="qbank-delete-menu-item" id="qbank-del-opt-displayed" onclick="executeQbankMultiDelete('displayed', event)">
                <div class="qbank-delete-item-left">
                    <span class="qbank-delete-item-icon">👁️</span>
                    <div class="qbank-delete-item-text">
                        <b>2. Xóa các câu đang hiển thị</b>
                        <small>Xóa danh sách đang hiện ở cột giữa</small>
                    </div>
                </div>
                <span class="del-count-badge" id="qbank-del-count-displayed">0 câu</span>
            </div>
            <div class="qbank-delete-menu-item" id="qbank-del-opt-selected" onclick="executeQbankMultiDelete('selected', event)">
                <div class="qbank-delete-item-left">
                    <span class="qbank-delete-item-icon">☑️</span>
                    <div class="qbank-delete-item-text">
                        <b>3. Xóa câu tích chọn</b>
                        <small>Chỉ xóa các câu đã đánh dấu ☑️ Chọn</small>
                    </div>
                </div>
                <span class="del-count-badge" id="qbank-del-count-selected">0 câu</span>
            </div>
        `;
        wrapper.appendChild(menu);
    }

    return menu;
}

function updateQbankDeleteMenuCounts() {
    const allQ = qbankState.rawQuestions || [];
    const unassignedCount = allQ.filter(q => Boolean(q && !q.folderId)).length;
    const displayedList = (typeof getFilteredAndSortedQuestions === "function") ? getFilteredAndSortedQuestions() : allQ;
    const displayedCount = displayedList.length;
    const selectedCount = pruneStaleSelectedQuestionIds();

    const elUnassigned = document.getElementById("qbank-del-count-unassigned");
    const elDisplayed = document.getElementById("qbank-del-count-displayed");
    const elSelected = document.getElementById("qbank-del-count-selected");

    if (elUnassigned) elUnassigned.textContent = `${unassignedCount} câu`;
    if (elDisplayed) elDisplayed.textContent = `${displayedCount} câu`;
    if (elSelected) elSelected.textContent = `${selectedCount} câu`;

    const optUnassigned = document.getElementById("qbank-del-opt-unassigned");
    const optDisplayed = document.getElementById("qbank-del-opt-displayed");
    const optSelected = document.getElementById("qbank-del-opt-selected");

    if (optUnassigned) optUnassigned.classList.toggle("is-disabled", unassignedCount === 0);
    if (optDisplayed) optDisplayed.classList.toggle("is-disabled", displayedCount === 0);
    if (optSelected) optSelected.classList.toggle("is-disabled", selectedCount === 0);
}

function updateQbankDeleteSelectedButtonUI() {
    ensureQbankDeleteMultiDropdownInDOM();
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!btn) return;
    const count = pruneStaleSelectedQuestionIds();
    btn.classList.toggle("has-selection", count > 0);
    btn.innerHTML = count > 0
        ? `<span>🗑️</span> <span>Xóa nhiều câu (${count}) ▾</span>`
        : `<span>🗑️</span> <span>Xóa nhiều câu ▾</span>`;
    updateQbankDeleteMenuCounts();
}

function closeQbankDeleteMultiMenu() {
    const menu = document.getElementById("qbank-delete-multi-menu");
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (menu) menu.classList.remove("show");
    if (btn) btn.classList.remove("is-open");
}

function toggleQbankDeleteMultiMenu(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = ensureQbankDeleteMultiDropdownInDOM();
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!menu || !btn) return;

    if (menu.classList.contains("show")) {
        closeQbankDeleteMultiMenu();
        return;
    }

    if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();
    updateQbankDeleteMenuCounts();

    menu.classList.add("show");
    btn.classList.add("is-open");

    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.min(288, window.innerWidth * 0.92);
    let left = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10));
    const approxHeight = menu.offsetHeight || 195;
    let top = rect.bottom + 6;
    if (top + approxHeight > window.innerHeight - 10 && rect.top > approxHeight + 10) {
        top = rect.top - approxHeight - 6;
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
}

// Giữ tên hàm deleteSelectedQbankQuestions để tương thích 100% với onclick trong index.html
function deleteSelectedQbankQuestions(event) {
    toggleQbankDeleteMultiMenu(event);
}

function executeQbankMultiDelete(mode, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const allQ = qbankState.rawQuestions || [];
    let targets = [];
    let confirmMsg = "";
    let undoLabel = "";
    let toastMsg = "";

    if (mode === "unassigned") {
        targets = allQ.filter(q => Boolean(q && !q.folderId));
        if (targets.length === 0) {
            closeQbankDeleteMultiMenu();
            showQbankToast("ℹ️ Hiện không có câu Chờ xếp nào để xóa!", "info");
            return;
        }
        const assignedKeepCount = allQ.length - targets.length;
        confirmMsg = `⚠️ XÁC NHẬN XÓA CÂU CHỜ XẾP:\n\nBạn có chắc chắn muốn xóa toàn bộ ${targets.length} câu Chờ xếp (chưa gán vào thư mục)?\n\n(${assignedKeepCount} câu đã xếp trong thư mục vẫn được giữ nguyên 100% • Có thể bấm ↩️ Lùi nếu lỡ tay).`;
        undoLabel = `Xóa ${targets.length} câu Chờ xếp`;
        toastMsg = `🗑️ Đã xóa ${targets.length} câu Chờ xếp!`;
    } else if (mode === "displayed") {
        targets = (typeof getFilteredAndSortedQuestions === "function") ? getFilteredAndSortedQuestions() : [...allQ];
        if (targets.length === 0) {
            closeQbankDeleteMultiMenu();
            showQbankToast("ℹ️ Hiện không có câu hỏi nào đang hiển thị ở cột giữa để xóa!", "info");
            return;
        }
        let scopeDesc = "danh sách đang hiển thị ở cột giữa";
        if (qbankState.activeFilter && qbankState.activeFilter.folderName) {
            scopeDesc = `thư mục "${qbankState.activeFilter.folderName}" đang hiển thị`;
        }
        confirmMsg = `⚠️ XÁC NHẬN XÓA CÁC CÂU ĐANG HIỂN THỊ:\n\nBạn có chắc chắn muốn xóa toàn bộ ${targets.length} câu trong ${scopeDesc}?\n\n(Có thể bấm ↩️ Lùi hoặc Ctrl+Z để khôi phục ngay nếu cần).`;
        undoLabel = `Xóa ${targets.length} câu đang hiển thị`;
        toastMsg = `🗑️ Đã xóa ${targets.length} câu đang hiển thị!`;
    } else if (mode === "selected") {
        pruneStaleSelectedQuestionIds();
        const selSet = qbankState.selectedQuestionIds;
        targets = allQ.filter(q => q && selSet.has(String(q.id)));
        if (targets.length === 0) {
            closeQbankDeleteMultiMenu();
            showQbankToast("⚠️ Vui lòng tích chọn (☑️ Chọn) ít nhất 1 câu hỏi bên dưới!", "warning");
            return;
        }
        confirmMsg = `⚠️ XÁC NHẬN XÓA CÂU TÍCH CHỌN:\n\nBạn có chắc chắn muốn xóa ${targets.length} câu hỏi đã đánh dấu ☑️ Chọn?\n\n(Có thể bấm ↩️ Lùi hoặc Ctrl+Z nếu lỡ tay).`;
        undoLabel = `Xóa ${targets.length} câu tích chọn`;
        toastMsg = `🗑️ Đã xóa ${targets.length} câu tích chọn!`;
    } else {
        return;
    }

    closeQbankDeleteMultiMenu();

    if (!confirm(confirmMsg)) return;

    if (typeof qbankMidEditState !== "undefined" && qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") {
        closeQbankMidEditMode(true);
    }

    pushQbankUndoState(undoLabel);

    const idsToDelete = new Set(targets.map(q => String(q.id)));
    const deletedQuestions = allQ.filter(q => q && idsToDelete.has(String(q.id)));
    qbankState.rawQuestions = allQ.filter(q => q && !idsToDelete.has(String(q.id)));

    idsToDelete.forEach(id => qbankState.selectedQuestionIds.delete(id));
    cleanupOrphanedImagesInQbank(deletedQuestions);

    const remainingUnassigned = (qbankState.rawQuestions || []).filter(q => Boolean(q && !q.folderId)).length;
    if (remainingUnassigned === 0 && mode === "unassigned") {
        qbankState.currentExamTitle = "";
    }

    recomputeAllMatrixIds();
    saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(toastMsg, "warning");
}

document.addEventListener("click", function(e) {
    const menu = document.getElementById("qbank-delete-multi-menu");
    if (!menu || !menu.classList.contains("show")) return;
    const wrapper = document.getElementById("qbank-delete-dropdown-wrapper");
    const btn = document.getElementById("btn-qbank-delete-selected");
    if ((wrapper && wrapper.contains(e.target)) || (btn && btn.contains(e.target)) || menu.contains(e.target)) {
        return;
    }
    closeQbankDeleteMultiMenu();
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const menu = document.getElementById("qbank-delete-multi-menu");
        if (menu && menu.classList.contains("show")) {
            closeQbankDeleteMultiMenu();
        }
    }
});

function deleteQbankQuestion(qId) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
    const target = qbankState.rawQuestions.find(q => String(q.id) === String(qId));
    pushQbankUndoState(`Xóa ${target && target.matrixId ? target.matrixId : "1 câu hỏi"}`);
    qbankState.rawQuestions = qbankState.rawQuestions.filter(q => String(q.id) !== String(qId));
    qbankState.selectedQuestionIds.delete(String(qId));
    if (target) cleanupOrphanedImagesInQbank([target]);
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast("🗑️ Đã xóa câu hỏi.", "warning");
}

function promptMoveQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;

    const existingModal = document.getElementById("move-qbank-modal");
    if (existingModal) existingModal.remove();

    let options = [];
    function traverse(nodes, path) {
        (nodes || []).forEach(n => {
            let p = path ? path + " > " + n.name : n.name;
            if (!n.children || n.children.length === 0) options.push({ id: n.id, name: p });
            else traverse(n.children, p);
        });
    }
    traverse(qbankState.currentTree, "");
    if (options.length === 0) return alert("Chưa có thư mục lá nào để chuyển!");

    const currentPart = getQbankQuestionPart(q);
    const currentLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
    let selectHtml = `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">1. Chọn thư mục lưu trữ:</label><select id="move-qbank-folder" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;">${options.map(o => `<option value="${escapeQbankAttr(o.id)}" ${o.id === q.folderId ? "selected" : ""}>${escapeQbankHtml(o.name)}</option>`).join("")}</select></div>`;
    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">2. Chọn Phần thi:</label><select id="move-qbank-part" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;"><option value="1" ${currentPart === 1 ? "selected" : ""}>Phần I: Trắc nghiệm 4 lựa chọn</option><option value="2" ${currentPart === 2 ? "selected" : ""}>Phần II: Trắc nghiệm Đúng/Sai</option><option value="3" ${currentPart === 3 ? "selected" : ""}>Phần III: Trả lời ngắn</option><option value="4" ${currentPart === 4 ? "selected" : ""}>Phần IV: Tự luận ngắn</option></select></div>`;
    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">3. Chọn Mức độ:</label><select id="move-qbank-level" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;"><option value="nb" ${currentLevel === "nb" ? "selected" : ""}>Nhận biết (NB)</option><option value="th" ${currentLevel === "th" ? "selected" : ""}>Thông hiểu (TH)</option><option value="vdt" ${currentLevel === "vdt" ? "selected" : ""}>Vận dụng (VD)</option><option value="vdc" ${currentLevel === "vdc" ? "selected" : ""}>Vận dụng cao (VDC)</option></select></div>`;

    let div = document.createElement("div");
    div.className = "qbank-modal-overlay"; div.id = "move-qbank-modal"; div.style.display = "flex";
    div.onclick = function(e) { if (e.target === div) div.remove(); };
    div.innerHTML = `<div class="qbank-modal-container" style="width:50vw; min-width:320px; max-width:520px; height:auto; padding:22px; overflow:visible; background:#fff;" onclick="event.stopPropagation()"><h3 style="margin-top:0; color:#0284c7; font-weight:900; font-size:17px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:14px;">🔄 CHUYỂN CÂU HỎI SANG MỤC KHÁC</h3>${selectHtml}<div style="display:flex; gap:10px; margin-top:16px;"><button onclick="document.getElementById('move-qbank-modal').remove()" style="flex:1; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:800;">✕ Hủy</button><button onclick="executeMoveQbankQuestion('${safeQbankJsArg(qId)}')" style="flex:1.5; padding:10px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; cursor:pointer; font-weight:900;">🚀 Xác nhận chuyển</button></div></div>`;
    document.body.appendChild(div);
}

function executeMoveQbankQuestion(qId) {
    let f = document.getElementById("move-qbank-folder"), p = document.getElementById("move-qbank-part"), l = document.getElementById("move-qbank-level");
    if (!f || !p || !l) return;
    if (findNodeInTree(qbankState.currentTree, f.value) && qbankState.rawQuestions.find(x => String(x.id) === String(qId))) {
        applyMatrixToQuestion(qId, f.value, parseInt(p.value, 10), l.value);
        const modal = document.getElementById("move-qbank-modal");
        if (modal) modal.remove();
    }
}

// ============================================================================
// 5. UPLOAD JSON ĐỀ MỚI
// ============================================================================
function triggerQbankUpload() {
    let input = document.getElementById("qbank-file-upload-input");
    if (!input) {
        input = document.createElement("input");
        input.type = "file"; input.id = "qbank-file-upload-input"; input.accept = ".json,.js,.txt"; input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = function() { if (this.files && this.files[0]) readQbankJsonFile(this.files[0]); };
    }
    input.value = ""; input.click();
}

function readQbankJsonFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = parseUniversalExamText(e.target.result);
            if (!parsed) throw new Error("File đề thi không đúng cấu trúc!");
            let rawQ = [], parsedImages = {}, examTitle = file.name.replace(/\.[^/.]+$/, "");
            if (Array.isArray(parsed)) rawQ = parsed;
            else if (parsed.questions && Array.isArray(parsed.questions)) {
                rawQ = parsed.questions;
                if (parsed.title && String(parsed.title).trim()) examTitle = String(parsed.title).trim();
                if (parsed.images && typeof parsed.images === "object") parsedImages = parsed.images;
            }
            if (rawQ.length === 0) throw new Error("File đề thi không có câu hỏi nào!");

            pushQbankUndoState(`Upload đề mới "${examTitle}"`);
            const keptAssignedQuestions = (qbankState.rawQuestions || []).filter(q => Boolean(q && q.folderId));
            const keptIds = new Set(keptAssignedQuestions.map(q => String(q.id)));
            const cleanedSelected = new Set();
            qbankState.selectedQuestionIds.forEach(id => { if (keptIds.has(String(id))) cleanedSelected.add(String(id)); });
            qbankState.selectedQuestionIds = cleanedSelected;
            if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") qbankState.imagesMap = {};

            const nowTs = Date.now();
            const importedQuestions = rawQ.map((item, idx) => {
                const q = JSON.parse(JSON.stringify(item));
                const resolvedImgUrl = resolveQbankImageUrl(q, parsedImages);
                q.id = `qb_${nowTs}_${idx + 1}`; q.origIndex = idx + 1; q.sourceExam = examTitle;
                q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = "";
                delete q.assignedAt;
                q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
                normalizeQuestionAnswerOnTransfer(q);
                if (resolvedImgUrl) {
                    const uniqueImgKey = `img_q_${q.id}`;
                    q.imageUrl = resolvedImgUrl; q.imageKey = uniqueImgKey; qbankState.imagesMap[uniqueImgKey] = resolvedImgUrl;
                } else {
                    q.imageUrl = ""; q.imageKey = `img_q_${q.id}`;
                }
                return q;
            });

            qbankState.rawQuestions = [...keptAssignedQuestions, ...importedQuestions];
            qbankState.currentExamTitle = examTitle;
            qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
            qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
            qbankState.assignMode = true; qbankState.hideAssigned = false;
            if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(true);

            recomputeAllMatrixIds(); syncAssignModeButtonsUI(); updateQbankDeleteSelectedButtonUI(); saveQbankDraftState(false);
            renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
            if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
            if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
            showQbankToast(`✅ Đã nạp đề "${examTitle}" (${importedQuestions.length} câu mới)!`, "success");
        } catch (err) {
            showQbankToast("❌ Lỗi nạp file: " + err.message, "error");
            alert("❌ Lỗi nạp file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================================================
// 6. LỌC, SẮP XẾP & RENDER THẺ CÂU HỎI CỘT GIỮA
// ============================================================================
function getScopeQuestionsForMatrix() {
    let list = [...(qbankState.rawQuestions || [])];
    if (qbankState.activeFilter.folderId) {
        const rootNode = findNodeInTree(qbankState.currentTree, qbankState.activeFilter.folderId);
        if (rootNode) {
            const allowedFolderIds = new Set(getAllDescendantFolderIds(rootNode));
            list = list.filter(q => q && q.folderId && allowedFolderIds.has(q.folderId));
        }
    } else if (qbankState.hideAssigned) {
        list = list.filter(q => q && !q.folderId);
    } else if (qbankState.assignMode) {
        const curTitle = (qbankState.currentExamTitle || "").trim();
        list = list.filter(q => !q ? false : (!q.folderId || !curTitle || !q.sourceExam || q.sourceExam === curTitle));
    }
    return list;
}

function sortAssignedQuestionsArray(arr) {
    const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };
    const { orderMap } = buildTreeOrderMap();
    return [...arr].sort((a, b) => {
        const orderA = orderMap[a.folderId] ?? 999999, orderB = orderMap[b.folderId] ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        const pA = getQbankQuestionPart(a), pB = getQbankQuestionPart(b);
        if (pA !== pB) return pA - pB;
        const lvlA = levelOrder[normalizeQbankLevel(a.level)] || 1, lvlB = levelOrder[normalizeQbankLevel(b.level)] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;
        const seqA = Number(a.matrixSeq) || 0, seqB = Number(b.matrixSeq) || 0;
        if (seqA !== seqB) return seqA - seqB;
        return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
    });
}

function getFilteredAndSortedQuestions() {
    let list = getScopeQuestionsForMatrix();
    if (qbankState.activeFilter.part) list = list.filter(q => getQbankQuestionPart(q) === qbankState.activeFilter.part);
    if (qbankState.activeFilter.level) {
        const filterLvl = normalizeQbankLevel(qbankState.activeFilter.level);
        list = list.filter(q => normalizeQbankLevel(q.level) === filterLvl);
    }
    const assigned = list.filter(q => Boolean(q && q.folderId && q.matrixId));
    const unassigned = list.filter(q => Boolean(q && !(q.folderId && q.matrixId)));
    return [...sortAssignedQuestionsArray(assigned), ...[...unassigned].sort((a, b) => (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0))];
}

function updateQbankMatrixStats() {
    const bar = document.getElementById("qbank-matrix-bar");
    if (!bar) return;
    const scopedQuestions = getScopeQuestionsForMatrix();
    if ((qbankState.rawQuestions || []).length === 0) {
        bar.innerHTML = `<span style="color:#64748b; font-style:italic;">Upload file JSON hoặc bấm "Chuyển ngân hàng đề" trên lớp để xem ma trận thống kê 4 mức độ</span>`;
        return;
    }
    const stats = { 1: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 2: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 3: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 4: { nb: 0, th: 0, vdt: 0, vdc: 0 } };
    let total = 0;
    scopedQuestions.forEach(q => {
        const p = getQbankQuestionPart(q);
        const lvl = normalizeQbankLevel(q.level);
        if (stats[p] && stats[p][lvl] !== undefined) { stats[p][lvl]++; total++; }
    });

    let html = "";
    [1, 2, 3, 4].forEach(p => {
        const s = stats[p], sumP = s.nb + s.th + s.vdt + s.vdc;
        if (sumP > 0) {
            const isPartAct = (qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
            html += `<div class="matrix-group ${isPartAct ? "active-filter" : ""}" onclick="filterByGlobalPart(${p})"><span class="matrix-title">Phần ${p} (${sumP})</span><div class="matrix-row"><span class="stat-pill nb ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "nb" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'nb')">NB: ${s.nb}</span><span class="stat-pill th ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "th" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'th')">TH: ${s.th}</span><span class="stat-pill vdt ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "vdt" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdt')">VD: ${s.vdt}</span><span class="stat-pill vdc ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "vdc" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdc')">VDC: ${s.vdc}</span></div></div>`;
        }
    });
    html += `<div style="margin-left:auto; font-weight:900; color:#0f172a; font-size:11.5px; white-space:nowrap;">Đang xem: ${total} câu</div>`;

    if (qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned || qbankState.assignMode) {
        let filterLabels = [];
        if (qbankState.activeFilter.folderName) filterLabels.push(`Thư mục: ${qbankState.activeFilter.folderName}`);
        else if (qbankState.hideAssigned) filterLabels.push("Đang ẩn câu đã xếp");
        else if (qbankState.assignMode) filterLabels.push("Chế độ Xếp câu (Đã đánh ID ở trên • Chưa xếp ở dưới)");
        if (qbankState.activeFilter.part) filterLabels.push(`Phần ${qbankState.activeFilter.part}`);
        if (qbankState.activeFilter.level) filterLabels.push(`Mức: ${getQbankLevelLabel(qbankState.activeFilter.level)}`);
        html += `<div class="qbank-active-filter-bar" style="width:100%;"><span>🔍 Đang xem: <b>${escapeQbankHtml(filterLabels.join(" • "))}</b></span><button type="button" class="btn-clear-filter" onclick="clearQbankFilter()">✕ Hiện tất cả ngân hàng</button></div>`;
    }
    bar.innerHTML = html;
}

function filterByGlobalPart(p) {
    if (qbankState.activeFilter.part === p && !qbankState.activeFilter.level) qbankState.activeFilter.part = null;
    else { qbankState.activeFilter.part = p; qbankState.activeFilter.level = null; }
    renderQbankQuestions(); updateQbankMatrixStats();
}

function filterByGlobalCell(p, lvl) {
    if (qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl) { qbankState.activeFilter.part = null; qbankState.activeFilter.level = null; }
    else { qbankState.activeFilter.part = p; qbankState.activeFilter.level = lvl; }
    renderQbankQuestions(); updateQbankMatrixStats();
}

function renderQbankCardHtml(q, idx) {
    const letters = ["A", "B", "C", "D"];
    const isChecked = qbankState.selectedQuestionIds.has(String(q.id));
    const p = getQbankQuestionPart(q), levelText = getQbankLevelLabel(q.level || "nb");
    const isAssigned = Boolean(q.folderId && q.matrixId);
    const displayIdText = isAssigned ? q.matrixId : `Câu ${q.origIndex || (idx + 1)} • Chưa xếp`;
    const imgKey = String(q.imageKey || `img_q_${q.id}`).replace(/'/g, "");
    const imgUrl = resolveQbankImageUrl(q, qbankState.imagesMap);
    const safeQId = safeQbankJsArg(q.id);

    const uploaderHtml = `
        <div class="qbank-img-tool-zone" id="zone-qbank-${escapeQbankAttr(q.id)}" tabindex="0" title="Bấm vào đây rồi ấn Ctrl+V để dán ảnh" style="display:flex; align-items:center; gap:5px; background:#f8fafc; padding:3px 6px; border-radius:5px; border:1px dashed #cbd5e1; margin-top:4px;">
            <span style="font-size:10.5px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
            <button type="button" class="btn-qbank-img" onclick="triggerQBankPaste('${safeQId}', '${safeQbankJsArg(imgKey)}')">📋 Dán (Ctrl+V)</button>
            <input type="file" id="file-qbank-${escapeQbankAttr(q.id)}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${safeQId}', '${safeQbankJsArg(imgKey)}')">
            <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbank-${safeQId}').click()">📁 Tệp</button>
            ${imgUrl ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${safeQId}', '${safeQbankJsArg(imgKey)}')">🗑 Xóa</button>` : ""}
            <span id="status-qbank-${escapeQbankAttr(q.id)}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
        </div>
        ${imgUrl ? `<div style="text-align:center; margin:4px 0;"><img src="${escapeQbankAttr(imgUrl)}" onerror="handleQbankImgError(this)" style="max-height:140px; max-width:100%; border-radius:6px; border:1px solid #cbd5e1;" alt="Hình minh họa"></div>` : ""}
    `;

    let contentDetailsHtml = "";
    if (p === 1 && Array.isArray(q.options)) {
        let correctIdx = typeof q.correct === "number" ? q.correct : letters.indexOf(String(q.correct || "A").trim().toUpperCase());
        contentDetailsHtml = `<div class="qbank-options-preview">${q.options.map((opt, oIdx) => `<div class="qbank-opt-item ${oIdx === correctIdx ? "is-correct" : ""}"><span class="qbank-opt-circle">${letters[oIdx] || ""}</span><span>${opt} ${oIdx === correctIdx ? "<b>✓</b>" : ""}</span></div>`).join("")}</div>`;
    } else if (p === 2 && Array.isArray(q.statements)) {
        contentDetailsHtml = `<div style="margin:4px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 6px;">${q.statements.map(st => { const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true"); return `<div style="font-size:11.5px; margin-bottom:2px; display:flex; justify-content:space-between;"><span><b>${st.id})</b> ${st.statement}</span><b style="color:${isTrue ? "#16a34a" : "#dc2626"};">${isTrue ? "🟢 Đúng" : "🔴 Sai"}</b></div>`; }).join("")}</div>`;
    } else {
        contentDetailsHtml = `<div style="margin:4px 0; font-size:11.5px; font-weight:800; color:#0d9488; background:#f0fdfa; padding:3px 6px; border-radius:5px; border:1px solid #99f6e4;">🎯 Đáp số: <span style="color:#0f172a;">${q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || "0")}</span></div>`;
    }

    const explainHtml = q.explanation ? `<div style="font-size:11px; color:#78350f; background:#fffbeb; padding:4px 6px; border-radius:5px; border-left:3px solid #f59e0b; margin-top:4px;">💡 <b>Lời giải:</b> ${q.explanation}</div>` : "";
    const folderTag = q.folderName ? `<span style="font-size:10px; color:#16a34a; background:#dcfce7; padding:1px 5px; border-radius:5px; border:1px solid #bbf7d0;">📁 ${escapeQbankHtml(q.folderName)}</span>` : "";
    const unassignBtnHtml = isAssigned ? `<button type="button" class="btn-soide-mini" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;" onclick="unassignQbankQuestion('${safeQId}')">↩️ Bỏ xếp</button>` : "";

    return `
        <div class="qbank-q-card ${isAssigned ? "is-assigned-card" : ""} ${isChecked ? "selected" : ""}" id="qbank-card-${escapeQbankAttr(q.id)}" draggable="true" ondragstart="handleQuestionDragStart(event, '${safeQId}')" ondragend="handleQuestionDragEnd()">
            <div class="qbank-q-header">
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    <span class="qbank-q-id-badge ${isAssigned ? "is-assigned" : "is-unassigned"}">${escapeQbankHtml(displayIdText)}</span>
                    <span style="font-size:10.5px; font-weight:800; color:#059669; border:1px solid #10b981; padding:1px 5px; border-radius:5px; background:#ecfdf5;">Phần ${p} • ${levelText}</span>
                    ${folderTag}
                </div>
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    ${unassignBtnHtml}
                    <button type="button" class="btn-soide-mini" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;" onclick="promptMoveQuestion('${safeQId}')">🔄 Chuyển</button>
                    <button type="button" class="btn-soide-mini" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;" onclick="deleteQbankQuestion('${safeQId}')">🗑️ Xóa</button>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:900; font-size:11.5px; color:#0f172a;"><input type="checkbox" style="width:16px; height:16px; accent-color:#10b981; cursor:pointer;" ${isChecked ? "checked" : ""} onchange="toggleSelectQuestion('${safeQId}', this.checked)"> Chọn</label>
                </div>
            </div>
            <div style="font-size:12.5px; font-weight:600; color:#1e293b; margin-bottom:3px; line-height:1.4;">${qbFormatQuestionText(q.question || "")}</div>
            ${uploaderHtml}${contentDetailsHtml}${explainHtml}
        </div>
    `;
}

function renderQbankQuestions() {
    recomputeAllMatrixIds();
    renderQbankHeaderAndMidExamTitle();
    updateQbankDeleteSelectedButtonUI();
    const container = document.getElementById("qbank-questions-list");
    if (!container) return;
    const questions = getFilteredAndSortedQuestions();

    if (questions.length === 0) {
        const isFilterActive = qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned;
        const unassignedLeft = (qbankState.rawQuestions || []).filter(q => !q.folderId).length;
        const assignedTotal = (qbankState.rawQuestions || []).length - unassignedLeft;
        let emptyHeadline = "Chưa có câu hỏi nào trong danh sách.";
        let emptyHint = 'Nhấn "Upload file JSON đề" ở trên hoặc bấm "🏦 Chuyển ngân hàng đề" trên lớp để nạp đề thi!';
        if (qbankState.hideAssigned && !qbankState.activeFilter.folderId && assignedTotal > 0 && unassignedLeft === 0) {
            emptyHeadline = "🎉 Đã xếp xong 100% câu hỏi của đề gốc vào ngân hàng!";
            emptyHint = `Hiện có <b>${assignedTotal} câu</b> trong các thư mục bên trái.`;
        } else if (isFilterActive) {
            emptyHeadline = "Không tìm thấy câu hỏi nào phù hợp với bộ lọc này.";
            emptyHint = '<a href="javascript:void(0)" onclick="clearQbankFilter()" style="color:#0284c7; font-weight:800; text-decoration:underline;">Nhấn vào đây để hủy lọc và xem tất cả</a>';
        }
        container.innerHTML = `<div style="text-align:center; padding:40px 16px; color:#64748b;"><div style="font-size:36px; margin-bottom:8px;">${isFilterActive ? "🔍" : "📥"}</div><b>${emptyHeadline}</b><p style="font-size:11.5px; margin-top:6px;">${emptyHint}</p></div>`;
        return;
    }

    const assignedQuestions = questions.filter(q => Boolean(q.folderId && q.matrixId));
    const unassignedQuestions = questions.filter(q => !Boolean(q.folderId && q.matrixId));
    let html = "";
    const showGroupHeaders = !qbankState.activeFilter.folderId && assignedQuestions.length > 0;
    if (showGroupHeaders) html += `<div class="qbank-section-banner assigned-banner"><span>📌 CÂU ĐÃ XẾP VÀO THƯ MỤC &amp; ĐÁNH SỐ ID TỰ ĐỘNG (${assignedQuestions.length} câu)</span><span style="font-size:10px; font-weight:700;">Xếp trên cùng</span></div>`;
    assignedQuestions.forEach((q, idx) => { html += renderQbankCardHtml(q, idx); });
    if (showGroupHeaders && unassignedQuestions.length > 0) html += `<div class="qbank-section-banner unassigned-banner"><span>📥 CÂU CHƯA KÉO THẢ / CHƯA CÓ ID (${unassignedQuestions.length} câu)</span><span style="font-size:10px; font-weight:700;">Giữ nguyên thứ tự đề gốc</span></div>`;
    unassignedQuestions.forEach((q, idx) => { html += renderQbankCardHtml(q, idx); });
    container.innerHTML = html;
    if (window.MathJax && MathJax.typesetPromise) { try { MathJax.typesetPromise([container]).catch(() => {}); } catch (e) {} }
}

function handleQuestionDragStart(e, qId) {
    cancelLeafAutoExpandTimer();
    qbankState.draggedQId = qId;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", qId);
    }
}
function handleQuestionDragEnd() {
    cancelLeafAutoExpandTimer();
    qbankState.draggedQId = null;
    document.querySelectorAll(".leaf-drop-zone.drag-over").forEach(el => el.classList.remove("drag-over"));
}
function toggleSelectQuestion(qId, isChecked) {
    if (isChecked) qbankState.selectedQuestionIds.add(String(qId));
    else qbankState.selectedQuestionIds.delete(String(qId));
    const card = document.getElementById(`qbank-card-${qId}`);
    if (card) card.classList.toggle("selected", isChecked);
    updateQbankDeleteSelectedButtonUI();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
}
function clearSelectedQuestions() {
    qbankState.selectedQuestionIds.clear();
    updateQbankDeleteSelectedButtonUI(); renderQbankQuestions();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
}

// ============================================================================
// 7. UPLOAD & DÁN ẢNH CHO CÂU HỎI (CTRL + V)
// ============================================================================
function triggerQBankPaste(qId, imgKey) {
    const zone = document.getElementById(`zone-qbank-${qId}`);
    if (zone) zone.focus();
    showQbankToast("📋 Hãy bấm phím Ctrl + V để dán ảnh chụp vào câu này!", "info");
}

async function uploadImageToHostOrDrive(file, filenamePrefix = "qbank_img") {
    const reader = new FileReader();
    const b64 = await new Promise((res, rej) => {
        reader.onload = () => res(String(reader.result || "").split(",")[1] || "");
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
    let directUrl = "";
    if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_")) {
        const fd = new FormData(); fd.append("image", b64);
        const controller = new AbortController(), timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 5000);
        try {
            const r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd, signal: controller.signal }).then(x => x.json()).catch(() => null);
            clearTimeout(timer);
            if (r && r.data) directUrl = r.data.display_url || r.data.url || "";
        } catch (e) { clearTimeout(timer); }
    }
    if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
        const r = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ filename: `${filenamePrefix}_${Date.now()}.png`, mimeType: file.type || "image/png", base64: b64 })
        }).then(x => x.json()).catch(() => null);
        if (r && r.fileUrl) directUrl = (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(r.fileUrl) : r.fileUrl;
    }
    if (!directUrl) directUrl = `data:${file.type || "image/png"};base64,${b64}`;
    return normalizeDriveImageLinkIfNeeded(directUrl);
}

document.addEventListener("paste", function(e) {
    const activeEl = document.activeElement;
    if (!activeEl || !activeEl.id) return;
    const items = (e.clipboardData || window.clipboardData)?.items;
    if (!items) return;

    if (activeEl.id.startsWith("zone-qbank-")) {
        const qId = activeEl.id.replace("zone-qbank-", "");
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) { e.preventDefault(); uploadQBankImage(items[i].getAsFile(), qId, imgKey); break; }
        }
    } else if (activeEl.id.startsWith("qb-edit-zone-")) {
        const qId = activeEl.id.replace("qb-edit-zone-", "");
        const q = (qbankMidEditState.questions || []).find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                e.preventDefault();
                if (typeof qbEditUploadImage === "function") qbEditUploadImage(items[i].getAsFile(), qId, imgKey);
                break;
            }
        }
    }
});

function handleQBankImgSelect(input, qId, imgKey) { if (input.files && input.files[0]) uploadQBankImage(input.files[0], qId, imgKey); }

async function uploadQBankImage(file, qId, imgKey) {
    const stEl = document.getElementById(`status-qbank-${qId}`);
    if (stEl) { stEl.style.color = "#0284c7"; stEl.innerText = "⏳ Đang tải..."; }
    try {
        const directUrl = await uploadImageToHostOrDrive(file, `qbank_img_${qId}`);
        if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") qbankState.imagesMap = {};
        qbankState.imagesMap[imgKey] = directUrl;
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        if (q) { q.imageUrl = directUrl; q.imageKey = imgKey; }
        saveQbankDraftState(false); renderQbankQuestions();
        showQbankToast("🖼️ Đã chèn ảnh cho câu hỏi thành công!", "success");
    } catch (e) {
        if (stEl) { stEl.style.color = "#dc2626"; stEl.innerText = "❌ Lỗi"; }
        showQbankToast("❌ Lỗi tải ảnh: " + e.message, "error");
    }
}

function deleteQBankImg(qId, imgKey) {
    if (!confirm("⚠️ Xóa ảnh minh họa của câu này?")) return;
    if (qbankState.imagesMap) { delete qbankState.imagesMap[imgKey]; delete qbankState.imagesMap[`img_q_${qId}`]; }
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (q) q.imageUrl = "";
    saveQbankDraftState(false); renderQbankQuestions();
    showQbankToast("🗑️ Đã xóa ảnh của câu hỏi.", "info");
}

// Xuất ra window scope
window.normalizeQuestionAnswerOnTransfer = normalizeQuestionAnswerOnTransfer;
window.transferClassExamToQBank = transferClassExamToQBank;
window.toggleLeafMatrixDisplay = toggleLeafMatrixDisplay;
window.handleLeafTreeDragOver = handleLeafTreeDragOver;
window.handleLeafTreeDragLeave = handleLeafTreeDragLeave;
window.renderQbankTree = renderQbankTree;
window.handleFolderNodeClick = handleFolderNodeClick;
window.setFilterByNodePart = setFilterByNodePart;
window.handleMatrixCellClick = handleMatrixCellClick;
window.syncAssignModeButtonsUI = syncAssignModeButtonsUI;
window.clearQbankFilter = clearQbankFilter;
window.toggleQbankAssignMode = toggleQbankAssignMode;
window.toggleHideAssignedQuestions = toggleHideAssignedQuestions;
window.promptRenameFolder = promptRenameFolder;
window.promptAddRootFolder = promptAddRootFolder;
window.promptAddChildFolder = promptAddChildFolder;
window.promptChangeFolderColor = promptChangeFolderColor;
window.promptDeleteFolder = promptDeleteFolder;
window.selectQbankFolder = selectQbankFolder;
window.handleDropZoneOver = handleDropZoneOver;
window.handleDropZoneLeave = handleDropZoneLeave;
window.handleDropZoneDrop = handleDropZoneDrop;
window.assignSelectedQuestionsToMatrix = assignSelectedQuestionsToMatrix;
window.unassignQbankQuestion = unassignQbankQuestion;
window.pruneStaleSelectedQuestionIds = pruneStaleSelectedQuestionIds;
window.updateQbankDeleteSelectedButtonUI = updateQbankDeleteSelectedButtonUI;
window.toggleQbankDeleteMultiMenu = toggleQbankDeleteMultiMenu;
window.closeQbankDeleteMultiMenu = closeQbankDeleteMultiMenu;
window.executeQbankMultiDelete = executeQbankMultiDelete;
window.deleteSelectedQbankQuestions = deleteSelectedQbankQuestions;
window.deleteQbankQuestion = deleteQbankQuestion;
window.promptMoveQuestion = promptMoveQuestion;
window.executeMoveQbankQuestion = executeMoveQbankQuestion;
window.triggerQbankUpload = triggerQbankUpload;
window.getFilteredAndSortedQuestions = getFilteredAndSortedQuestions;
window.updateQbankMatrixStats = updateQbankMatrixStats;
window.filterByGlobalPart = filterByGlobalPart;
window.filterByGlobalCell = filterByGlobalCell;
window.renderQbankQuestions = renderQbankQuestions;
window.handleQuestionDragStart = handleQuestionDragStart;
window.handleQuestionDragEnd = handleQuestionDragEnd;
window.toggleSelectQuestion = toggleSelectQuestion;
window.clearSelectedQuestions = clearSelectedQuestions;
window.triggerQBankPaste = triggerQBankPaste;
window.uploadImageToHostOrDrive = uploadImageToHostOrDrive;
window.handleQBankImgSelect = handleQBankImgSelect;
window.deleteQBankImg = deleteQBankImg;
