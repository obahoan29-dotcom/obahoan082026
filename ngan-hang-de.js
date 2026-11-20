// =========================================================
// FILE: ngan-hang-de.js
// HỆ THỐNG BIÊN SOẠN CÂU HỎI, PHÂN LOẠI MA TRẬN & TRÍCH ĐỀ THI
// =========================================================

let qbankState = {
    storageTarget: "drive", // MẶC ĐỊNH LƯU DRIVE (Yêu cầu 2)
    savedExamFilter: "all",
    currentTree: [
        {
            id: "node_lop10",
            name: "Lớp 10",
            color: "#0284c7",
            children: [
                {
                    id: "node_10_c1",
                    name: "Chương 1. Mệnh đề",
                    color: "#059669",
                    children: [
                        { id: "node_10_c1_b1", name: "Bài 1. Mệnh đề", color: "#6b21a8", children: [] },
                        { id: "node_10_c1_b2", name: "Bài 2. Tập hợp", color: "#d97706", children: [] }
                    ]
                }
            ]
        },
        {
            id: "node_lop11",
            name: "Lớp 11",
            color: "#16a34a",
            children: [
                {
                    id: "node_11_c1",
                    name: "Chương 1. Hàm số lượng giác",
                    color: "#0284c7",
                    children: [
                        { id: "node_11_c1_b1", name: "Bài 1. Giá trị LG", color: "#dc2626", children: [] },
                        { id: "node_11_c1_b2", name: "Bài 2. PT lượng giác", color: "#7c3aed", children: [] }
                    ]
                }
            ]
        },
        {
            id: "node_lop12",
            name: "Lớp 12",
            color: "#ea580c",
            children: [
                {
                    id: "node_12_c1",
                    name: "Chương 1. Đạo hàm",
                    color: "#0891b2",
                    children: [
                        { id: "node_12_c1_b1", name: "Bài 1. Đơn điệu", color: "#059669", children: [] },
                        { id: "node_12_c1_b2", name: "Bài 2. Cực trị", color: "#b91c1c", children: [] }
                    ]
                }
            ]
        }
    ],
    activeFolderId: null,
    activeFolderObj: null,
    rawQuestions: [],
    selectedQuestionIds: new Set(), // MẶC ĐỊNH BỎ CHỌN TOÀN BỘ (Yêu cầu 1)
    savedExams: [],
    draggedQId: null,
    imagesMap: {}
};

const QBANK_COLOR_PALETTE = ["#0284c7", "#059669", "#7c3aed", "#ea580c", "#dc2626", "#0891b2", "#ca8a04", "#475569"];

// ================== CÁC HÀM CƠ BẢN VÀ MODAL ==================
function toggleQbankMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.toggle("show");
}

document.addEventListener("click", function(e) {
    const wrap = e.target.closest(".qbank-dropdown-wrapper");
    if (!wrap) {
        const menu = document.getElementById("qbank-dropdown-menu");
        if (menu) menu.classList.remove("show");
    }
});

function openQbankCreatorModal() {
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");
    const modal = document.getElementById("modal-qbank-creator");
    if (modal) {
        modal.style.display = "flex";
        loadQbankTreeData();
        renderQbankTree();
        renderQbankQuestions();
        updateQbankMatrixStats();
        updateQbankBuilderStats();
    }
}
function closeQbankCreatorModal() { document.getElementById("modal-qbank-creator").style.display = "none"; }
function openSavedExamsModal() {
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");
    const modal = document.getElementById("modal-qbank-saved");
    if (modal) { modal.style.display = "flex"; loadSavedExamsList(); }
}
function closeSavedExamsModal() { document.getElementById("modal-qbank-saved").style.display = "none"; }
function toggleStorageLocation(selectEl) { qbankState.storageTarget = selectEl.value; }

// ================== CỘT 1: CÂY THƯ MỤC & MA TRẬN KÉO THẢ ==================
function findNodeInTree(nodes, id) {
    for (let n of nodes) {
        if (n.id === id) return n;
        if (n.children && n.children.length > 0) {
            const found = findNodeInTree(n.children, id);
            if (found) return found;
        }
    }
    return null;
}

function findParentNodeInTree(nodes, childId) {
    for (let n of nodes) {
        if (n.children && n.children.some(c => c.id === childId)) return n;
        if (n.children && n.children.length > 0) {
            const found = findParentNodeInTree(n.children, childId);
            if (found) return found;
        }
    }
    return null;
}

// SINH ID THEO YÊU CẦU 5 (VD: 10.c1.b1.num1)
function generatePrefixSlug(name) {
    let s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (s.includes("lop")) return s.replace(/[^0-9]/g, ""); // Lớp 10 -> 10
    if (s.includes("chuong")) return "c" + s.replace(/[^0-9]/g, ""); // Chương 1 -> c1
    if (s.includes("bai")) return "b" + s.replace(/[^0-9]/g, ""); // Bài 1 -> b1
    return s.substring(0, 3).replace(/[^a-z0-9]/g, "");
}

function getHierarchicalPrefix(targetId) {
    let path = [];
    function traverse(nodes, currentPath) {
        for (let n of nodes) {
            let newPath = [...currentPath, n];
            if (n.id === targetId) { path = newPath; return true; }
            if (n.children && traverse(n.children, newPath)) return true;
        }
        return false;
    }
    traverse(qbankState.currentTree, []);
    return path.map(p => generatePrefixSlug(p.name)).join(".");
}

// YÊU CẦU 3 & 4: Render thư mục và khung ma trận lá
function renderQbankTree() {
    const rootEl = document.getElementById("qbank-tree-root");
    if (!rootEl) return;

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:4px; border-bottom:1.5px solid #e2e8f0;">
            <b style="font-size:12px; color:#334155;">🌳 CÂY THƯ MỤC KIẾN THỨC:</b>
            <button class="btn-qbank btn-qbank-primary" style="padding:3px 8px; font-size:11px;" onclick="promptAddRootFolder()">+ Thư mục gốc</button>
        </div>
    `;

    function buildNodeHtml(node, depth = 0) {
        const isActive = (qbankState.activeFolderId === node.id);
        const nodeColor = node.color || "#0284c7";
        const isLeaf = (!node.children || node.children.length === 0);
        let subHtml = "";

        if (!isLeaf) {
            subHtml = `<div class="tree-children">${node.children.map(child => buildNodeHtml(child, depth + 1)).join("")}</div>`;
        }

        // MA TRẬN 16 Ô TẠI THƯ MỤC LÁ
        let matrixDropHtml = "";
        if (isLeaf && isActive) {
            const counts = { 1:{nb:0,th:0,vdt:0,vdc:0}, 2:{nb:0,th:0,vdt:0,vdc:0}, 3:{nb:0,th:0,vdt:0,vdc:0}, 4:{nb:0,th:0,vdt:0,vdc:0} };
            qbankState.rawQuestions.forEach(q => {
                if (q.folderId === node.id) {
                    let p = q.part || 1;
                    if (q.type === 'true_false') p = 2;
                    else if (q.type === 'short_answer' && q.part !== 4) p = 3;
                    let lvl = q.level || 'nb';
                    if (counts[p] && counts[p][lvl] !== undefined) counts[p][lvl]++;
                }
            });

            matrixDropHtml = `
                <div class="leaf-matrix-container">
                    <div style="font-size:10px; color:#0369a1; font-weight:800; margin-bottom:4px; text-align:center;">📥 Kéo thả câu hỏi từ Cột Giữa vào từng ô:</div>
                    ${[1,2,3,4].map(p => `
                        <div class="leaf-matrix-row">
                            <div class="leaf-matrix-lbl">P${p}</div>
                            ${['nb', 'th', 'vdt', 'vdc'].map(lvl => {
                                const lblMap = {nb:'NB', th:'TH', vdt:'VD', vdc:'VDC'};
                                return `
                                <div class="leaf-drop-zone"
                                     ondragover="handleDropZoneOver(event)" ondragleave="handleDropZoneLeave(event)"
                                     ondrop="handleDropZoneDrop(event, '${node.id}', ${p}, '${lvl}')" title="Kéo thả vào đây: Phần ${p} - ${lblMap[lvl]}">
                                    ${lblMap[lvl]}
                                    <b style="color:#0284c7;">(${counts[p][lvl]})</b>
                                </div>`;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <div class="tree-item-wrapper" style="margin-left: ${depth > 0 ? 4 : 0}px;">
                <div class="tree-item ${isActive ? 'active' : ''}" id="tree-node-${node.id}"
                     onclick="selectQbankFolder('${node.id}')"
                     style="border-left: 4px solid ${nodeColor};">
                    
                    <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:14px;">${isLeaf ? '📄' : '📁'}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px;" title="${node.name}">${node.name}</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:3px;" onclick="event.stopPropagation()">
                        <div class="tree-color-picker-dot" style="background:${nodeColor}; width:12px; height:12px; border-radius:50%; cursor:pointer;" onclick="promptChangeFolderColor('${node.id}')" title="Đổi màu"></div>
                        <button class="btn-rename-tree" onclick="promptRenameFolder('${node.id}')" title="Đổi tên">✏️</button>
                        ${!isLeaf || depth < 2 ? `<button class="btn-add-tree" onclick="promptAddChildFolder('${node.id}')" title="Thêm mục con">+</button>` : ''}
                        <button class="btn-add-tree" style="color:#ef4444;" onclick="promptDeleteFolder('${node.id}')" title="Xóa">✕</button>
                    </div>
                </div>
                ${matrixDropHtml}
                ${subHtml}
            </div>
        `;
    }

    html += qbankState.currentTree.map(rootNode => buildNodeHtml(rootNode, 0)).join("");
    rootEl.innerHTML = html;
}

// CÁC HÀM CÂY THƯ MỤC
function promptRenameFolder(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    const newName = prompt("✏️ Đổi tên thư mục:", node.name);
    if (newName && newName.trim()) {
        node.name = newName.trim();
        saveQbankTreeData(); renderQbankTree();
    }
}
function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Lớp 11):");
    if (name && name.trim()) {
        qbankState.currentTree.push({ id: "node_" + Date.now(), name: name.trim(), color: QBANK_COLOR_PALETTE[0], children: [] });
        saveQbankTreeData(); renderQbankTree();
    }
}
function promptAddChildFolder(parentId) {
    const parent = findNodeInTree(qbankState.currentTree, parentId);
    const name = prompt(`📁 Thêm mục con vào [${parent.name}]:`);
    if (name && name.trim()) {
        if (!parent.children) parent.children = [];
        parent.children.push({ id: "node_" + Date.now(), name: name.trim(), color: parent.color, children: [] });
        saveQbankTreeData(); renderQbankTree();
    }
}
function promptChangeFolderColor(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    const chosen = prompt("🎨 Chọn mã màu Hex (VD: #0284c7):", node.color);
    if (chosen && chosen.trim()) { node.color = chosen.trim(); saveQbankTreeData(); renderQbankTree(); }
}
function promptDeleteFolder(folderId) {
    if (!confirm(`⚠️ Xóa thư mục này và tất cả mục con?`)) return;
    const parent = findParentNodeInTree(qbankState.currentTree, folderId);
    if (parent) parent.children = parent.children.filter(c => c.id !== folderId);
    else qbankState.currentTree = qbankState.currentTree.filter(c => c.id !== folderId);
    if (qbankState.activeFolderId === folderId) qbankState.activeFolderId = null;
    saveQbankTreeData(); renderQbankTree();
}

function selectQbankFolder(folderId) {
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);
    renderQbankTree();
}

function saveQbankTreeData() {
    try { localStorage.setItem("qbank_tree_structure", JSON.stringify(qbankState.currentTree)); } catch(e) {}
}
function loadQbankTreeData() {
    try {
        const local = localStorage.getItem("qbank_tree_structure");
        if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) qbankState.currentTree = parsed;
        }
    } catch(e) {}
}

// XỬ LÝ KÉO THẢ MA TRẬN 16 Ô
function handleDropZoneOver(e) { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }
function handleDropZoneLeave(e) { e.currentTarget.classList.remove("drag-over"); }
function handleDropZoneDrop(e, folderId, part, level) {
    e.preventDefault(); e.currentTarget.classList.remove("drag-over");
    const qId = e.dataTransfer.getData("text/plain") || qbankState.draggedQId;
    if (!qId) return;

    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;

    // Phân loại Type dựa trên ô ma trận
    if (part === 1) { q.type = "multiple_choice"; delete q.part; if(!q.options) q.options = ["A","B","C","D"]; }
    else if (part === 2) { q.type = "true_false"; delete q.part; if(!q.statements) q.statements = [{id:'a', statement:'', correct:true}]; }
    else if (part === 3) { q.type = "short_answer"; delete q.part; }
    else if (part === 4) { q.type = "short_answer"; q.part = 4; }

    q.level = level;
    q.folderId = folderId;
    
    // YÊU CẦU 5: Đổi ID và đường dẫn. VD: 10.c1.b1.num1
    const currentFolderTarget = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = currentFolderTarget ? currentFolderTarget.name : "";
    const countInFolder = qbankState.rawQuestions.filter(x => x.folderId === folderId).length;
    const prefix = getHierarchicalPrefix(folderId);
    q.id = `${prefix}.num${countInFolder}`;

    // Tự động gán Checked cho câu vừa kéo thả xong
    qbankState.selectedQuestionIds.add(String(q.id));

    renderQbankTree(); 
    renderQbankQuestions(); 
    updateQbankMatrixStats();
    updateQbankBuilderStats();
}


// ================== CỘT 2: ĐỌC FILE, HIỂN THỊ CÂU HỎI ==================
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
            const text = e.target.result;
            let parsed = null;
            try { parsed = JSON.parse(text); } catch(err) {
                let clean = text.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, 'return ');
                parsed = new Function(clean)();
            }
            if (!parsed) throw new Error("File không đúng cấu trúc!");

            let rawQ = [];
            if (Array.isArray(parsed)) rawQ = parsed;
            else if (parsed.questions) {
                rawQ = parsed.questions;
                if (parsed.images) qbankState.imagesMap = parsed.images;
                if (parsed.title) document.getElementById("qbank-exam-name").value = parsed.title;
            }

            rawQ.forEach((q, idx) => {
                q.id = q.id || `temp_${idx+1}`;
                if (!q.level) q.level = "nb";
            });

            qbankState.rawQuestions = rawQ;
            qbankState.selectedQuestionIds = new Set(); // MẶC ĐỊNH BỎ CHỌN TOÀN BỘ (Yêu cầu 1)

            renderQbankQuestions();
            updateQbankMatrixStats();
            updateQbankBuilderStats();
            alert(`✅ Đã nạp ${rawQ.length} câu hỏi. Tất cả đang được BỎ CHỌN.\n👉 Hãy kéo thả từng câu vào Lưới Ma Trận ở thư mục tương ứng!`);
        } catch(err) { alert("❌ Lỗi nạp file: " + err.message); }
    };
    reader.readAsText(file);
}

// YÊU CẦU 6: Hiển thị ma trận Cột Giữa theo 4 Phần
function updateQbankMatrixStats() {
    const bar = document.getElementById("qbank-matrix-bar");
    if (!bar) return;

    const questions = qbankState.rawQuestions || [];
    if (questions.length === 0) {
        bar.innerHTML = `<span style="color:#64748b; font-style:italic;">Upload file JSON để xem ma trận thống kê</span>`;
        return;
    }

    const stats = { 1:{nb:0,th:0,vdt:0,vdc:0}, 2:{nb:0,th:0,vdt:0,vdc:0}, 3:{nb:0,th:0,vdt:0,vdc:0}, 4:{nb:0,th:0,vdt:0,vdc:0} };
    let total = 0;

    questions.forEach(q => {
        let p = q.part || 1;
        if (q.type === 'true_false') p = 2; else if (q.type === 'short_answer' && q.part !== 4) p = 3;
        let lvl = q.level || 'nb';
        if (stats[p] && stats[p][lvl] !== undefined) {
            stats[p][lvl]++;
            total++;
        }
    });

    let html = "";
    [1, 2, 3, 4].forEach(p => {
        const s = stats[p];
        const sumP = s.nb + s.th + s.vdt + s.vdc;
        if (sumP > 0) {
            html += `
            <div class="matrix-group">
                <span class="matrix-title" style="color:#0284c7;">Phần ${p} (${sumP})</span>
                <div class="matrix-row">
                    <span class="stat-pill nb">NB: ${s.nb}</span>
                    <span class="stat-pill th">TH: ${s.th}</span>
                    <span class="stat-pill vdt">VD: ${s.vdt}</span>
                    <span class="stat-pill vdc">VDC: ${s.vdc}</span>
                </div>
            </div>`;
        }
    });
    
    html += `<div style="margin-left:auto; font-weight:900; color:#0f172a; font-size:13px;">Tổng toàn bộ: ${total} câu</div>`;
    bar.innerHTML = html;
}

function renderQbankQuestions() {
    const container = document.getElementById("qbank-questions-list");
    if (!container) return;

    const questions = qbankState.rawQuestions || [];
    let html = "";

    questions.forEach((q, idx) => {
        const isChecked = qbankState.selectedQuestionIds.has(String(q.id));
        let p = q.part || 1;
        if (q.type === 'true_false') p = 2; else if (q.type === 'short_answer' && q.part !== 4) p = 3;
        const levelText = {nb: 'Nhận biết', th: 'Thông hiểu', vdt: 'Vận dụng', vdc: 'Vận dụng cao'}[q.level || 'nb'];

        // YÊU CẦU 7: Dán ảnh giống y như trang Soi đề
        const imgKey = q.imageKey || `img_q_${q.id}`;
        let imgUrl = q.imageUrl || qbankState.imagesMap[imgKey] || "";
        
        const uploaderHtml = `
            <div class="qbank-img-tool-zone" id="zone-qbank-${q.id}" tabindex="0">
                <span style="font-size:11px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
                <button type="button" class="btn-qbank-img" onclick="triggerQBankPaste('${q.id}', '${imgKey}')">📋 Dán (Ctrl+V)</button>
                <input type="file" id="file-qbank-${q.id}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${q.id}', '${imgKey}')">
                <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbank-${q.id}').click()">📁 Tệp</button>
                ${imgUrl ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${q.id}', '${imgKey}')">🗑 Xóa</button>` : ''}
                <span id="status-qbank-${q.id}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
            </div>
            ${imgUrl ? `<div style="text-align:center; margin-bottom:8px;"><img src="${imgUrl}" style="max-height:150px; border-radius:6px; border:1px solid #cbd5e1;"></div>` : ''}
        `;

        let bodyHtml = `<div style="font-size:13px; font-weight:600; color:#1e293b; margin-bottom:6px;">${q.question || ''}</div>`;
        const folderTag = q.folderName ? `<span style="font-size:10px; color:#16a34a; background:#dcfce7; padding:2px 6px; border-radius:6px;">📁 ${q.folderName}</span>` : '';

        // Tự gán ID dạng 10.c1.b1.num1 nên KHÔNG hiên Thị "Câu 1, Câu 2" nữa
        html += `
            <div class="qbank-q-card ${isChecked ? 'selected' : ''}" id="qbank-card-${q.id}" draggable="true" ondragstart="handleQuestionDragStart(event, '${q.id}')">
                <div class="qbank-q-header">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="qbank-q-id-badge">${q.id}</span>
                        <span style="font-size:11px; font-weight:800; color:#059669; border:1px solid #10b981; padding:2px 6px; border-radius:6px;">Phần ${p} • ${levelText}</span>
                        ${folderTag}
                    </div>
                    
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:900; font-size:12.5px; color:#0f172a;">
                        <input type="checkbox" style="width:18px; height:18px; accent-color:#10b981;" ${isChecked ? 'checked' : ''} onchange="toggleSelectQuestion('${q.id}', this.checked)"> Chọn
                    </label>
                </div>
                ${bodyHtml}
                ${uploaderHtml}
            </div>
        `;
    });

    container.innerHTML = html;
}

function handleQuestionDragStart(e, qId) {
    qbankState.draggedQId = qId;
    e.dataTransfer.setData("text/plain", qId);
}

function toggleSelectQuestion(qId, isChecked) {
    if (isChecked) qbankState.selectedQuestionIds.add(String(qId));
    else qbankState.selectedQuestionIds.delete(String(qId));
    document.getElementById(`qbank-card-${qId}`).classList.toggle("selected", isChecked);
    updateQbankBuilderStats();
}

// YÊU CẦU 7: DÁN VÀ UPLOAD ẢNH TẠI CỘT GIỮA
function triggerQBankPaste(qId, imgKey) {
    const zone = document.getElementById(`zone-qbank-${qId}`);
    if (zone) zone.focus();
    alert(`📋 Hãy nhấn Ctrl + V (hoặc Cmd + V) để dán ảnh vào thuộc tính của ID này!`);
}

document.addEventListener('paste', function(e) {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.id && activeEl.id.startsWith("zone-qbank-")) {
        const qId = activeEl.id.replace("zone-qbank-", "");
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;
        
        const items = (e.clipboardData || window.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                uploadQBankImage(items[i].getAsFile(), qId, imgKey);
                break;
            }
        }
    }
});

function handleQBankImgSelect(input, qId, imgKey) {
    if (input.files && input.files[0]) uploadQBankImage(input.files[0], qId, imgKey);
}

async function uploadQBankImage(file, qId, imgKey) {
    const stEl = document.getElementById(`status-qbank-${qId}`);
    if (stEl) { stEl.style.color = "#0284c7"; stEl.innerText = "⏳ Đang lưu..."; }

    try {
        const reader = new FileReader();
        const b64 = await new Promise((res, rej) => {
            reader.onload = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

        let directUrl = "";
        // Nếu Thầy có ImgBB
        if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_")) {
            let fd = new FormData(); fd.append("image", b64);
            let r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd }).then(x=>x.json());
            if (r && r.data) directUrl = r.data.url;
        }

        // Nếu có Drive Script
        if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL) {
            let payload = { filename: `qbank_img_${qId}_${Date.now()}.png`, mimeType: file.type || "image/png", base64: b64 };
            let r = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }).then(x=>x.json());
            if (r && r.fileUrl) directUrl = (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(r.fileUrl) : r.fileUrl;
        }

        if (!directUrl) directUrl = `data:${file.type};base64,${b64}`;

        qbankState.imagesMap[imgKey] = directUrl;
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        if (q) { q.imageUrl = directUrl; q.imageKey = imgKey; }

        renderQbankQuestions();
    } catch(e) {
        if (stEl) { stEl.style.color = "#dc2626"; stEl.innerText = "❌ Lỗi"; }
    }
}

function deleteQBankImg(qId, imgKey) {
    if(!confirm("⚠️ Xóa ảnh minh họa này?")) return;
    delete qbankState.imagesMap[imgKey];
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (q) q.imageUrl = "";
    renderQbankQuestions();
}


// ================== CỘT 3: TRÍCH XUẤT ĐỀ THI ==================
function updateQbankBuilderStats() {
    const container = document.getElementById("qbank-builder-stats");
    const total = qbankState.selectedQuestionIds.size;
    if (total === 0) {
        container.innerHTML = `<p style="color:#64748b; font-style:italic;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>`;
        return;
    }
    container.innerHTML = `<div style="font-weight:900; color:#10b981; font-size:14px;">🎯 Tổng số câu trích xuất: ${total} câu</div>`;
}

async function saveExtractedExamToBank() {
    const title = document.getElementById("qbank-exam-name").value.trim();
    const grade = document.getElementById("qbank-exam-grade").value; // Lớp 10, 11, 12, HSG 11
    if (!title) return alert("⚠️ Vui lòng nhập Tên đề thi mới!");
    if (qbankState.selectedQuestionIds.size === 0) return alert("⚠️ Bạn chưa tích chọn câu nào!");

    const btn = document.getElementById("btn-save-extracted-exam");
    btn.disabled = true; btn.innerText = "⏳ Đang lưu...";

    const selectedQ = qbankState.rawQuestions
        .filter(q => qbankState.selectedQuestionIds.has(String(q.id)))
        .map((q, idx) => ({ ...q, id: idx + 1 })); // Khi xuất đề thì reset lại id 1, 2, 3

    const newExam = {
        id: "exam_bank_" + Date.now(),
        title: title, grade: grade, questionCount: selectedQ.length,
        createdAt: new Date().toISOString(), assignedClasses: [],
        questions: selectedQ, images: qbankState.imagesMap, scoringConfig: { mode: "option1" }
    };

    try {
        loadSavedExamsList(false);
        qbankState.savedExams.unshift(newExam);
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));

        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) await client.from('app_key_values').upsert({ key: 'qbank_saved_exams', value: qbankState.savedExams });

        // YÊU CẦU 2: GỬI LÊN DRIVE NẾU CHỌN STORAGE ĐÓ
        if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined") {
            const drivePath = `KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/${grade}`;
            fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "saveQuestionBankData", path: drivePath, filename: `${title.replace(/\s/g,'_')}.json`, data: newExam })
            }).catch(()=>{});
        }

        alert("🎉 ĐÃ LƯU ĐỀ VÀO NGÂN HÀNG THÀNH CÔNG!");
        closeQbankCreatorModal(); openSavedExamsModal();
    } catch(err) { alert("Lỗi: " + err.message); }
    finally { btn.disabled = false; btn.innerText = "💾 Lưu đề vào Ngân hàng"; }
}

// ================== QUẢN LÝ NGÂN HÀNG ĐÃ LƯU & BỘ LỌC ==================
async function loadSavedExamsList(doRender = true) {
    try {
        const local = localStorage.getItem("qbank_saved_exams");
        if (local) qbankState.savedExams = JSON.parse(local) || [];
    } catch(e) {}
    
    // Đọc từ Cloud
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (client) {
        try {
            const { data } = await client.from('app_key_values').select('value').eq('key', 'qbank_saved_exams').single();
            if (data && Array.isArray(data.value)) {
                qbankState.savedExams = data.value;
                localStorage.setItem("qbank_saved_exams", JSON.stringify(data.value));
            }
        } catch(e) {}
    }

    if (doRender) filterSavedExamsList(document.getElementById("qbank-filter-grade")?.value || "all");
}

// YÊU CẦU 8: LỌC THEO KHỐI LỚP (Bao gồm Lớp HSG 11)
function filterSavedExamsList(gradeVal) {
    qbankState.savedExamFilter = gradeVal;
    const container = document.getElementById("qbank-saved-list");
    if (!container) return;

    let list = qbankState.savedExams || [];
    if (gradeVal !== "all") {
        list = list.filter(e => e.grade === gradeVal);
    }

    if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Chưa có đề thi nào trong khối ${gradeVal === 'all' ? '' : gradeVal}.</div>`;
        return;
    }

    container.innerHTML = list.map(exam => {
        const dateStr = exam.createdAt ? new Date(exam.createdAt).toLocaleString("vi-VN") : "---";
        const assignedTags = (exam.assignedClasses && exam.assignedClasses.length > 0)
            ? exam.assignedClasses.map(c => `<span class="exam-tag">✅ ${c}</span>`).join("")
            : `<span style="font-size:11px; color:#94a3b8; font-style:italic;">Chưa chuyển</span>`;

        return `
            <div class="saved-exam-item">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:15px; font-weight:900; color:#0f172a;">📑 ${exam.title}</div>
                    <div style="font-size:12px; color:#64748b; font-weight:600; margin-top:4px;">
                        ${exam.questionCount} câu • Khối: <b style="color:#0284c7;">${exam.grade}</b> • Tạo: ${dateStr}
                    </div>
                    <div class="exam-assigned-tags">${assignedTags}</div>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <button class="btn-qbank btn-qbank-primary" onclick="openTransferExamModal('${exam.id}')">🚀 Chuyển lớp</button>
                    <button class="btn-qbank" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;" onclick="downloadSavedExamJson('${exam.id}')">💾 JSON</button>
                    <button class="btn-qbank btn-qbank-danger" onclick="deleteSavedExam('${exam.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join("");
}

function openTransferExamModal(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    qbankState.currentExamToTransfer = exam;
    
    createTransferModalInDOM();
    document.getElementById("transfer-exam-title").innerText = exam.title;
    document.getElementById("modal-transfer-exam").style.display = "flex";
}

function createTransferModalInDOM() {
    if (document.getElementById("modal-transfer-exam")) return;
    const div = document.createElement("div");
    div.id = "modal-transfer-exam"; div.className = "qbank-modal-overlay";
    div.innerHTML = `
        <div class="qbank-modal-container" style="width:480px; height:auto; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:12px;">
                <h3 style="font-size:15px; font-weight:900; color:#0284c7;">🚀 CHUYỂN ĐỀ SANG LỚP</h3>
                <button onclick="document.getElementById('modal-transfer-exam').style.display='none'" style="background:none; border:none; font-size:18px; font-weight:900; cursor:pointer;">✕</button>
            </div>
            <div style="font-size:12.5px; font-weight:700; color:#1e293b; margin-bottom:10px;" id="transfer-exam-title">...</div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;" id="transfer-class-list">
                <label><input type="checkbox" value="lop-11a"> 🏫 Lớp 11A</label>
                <label><input type="checkbox" value="lop-11c"> 🏫 Lớp 11C</label>
                <label><input type="checkbox" value="lop-10p"> 🏫 Lớp 10P</label>
                <label><input type="checkbox" value="lop-11e"> 🏫 Lớp 11E</label>
                <label><input type="checkbox" value="them-10"> 📐 Thêm 10</label>
                <label><input type="checkbox" value="them-11" checked> ✍️ Thêm 11</label>
                <label><input type="checkbox" value="them-12"> 🎓 Thêm 12</label>
                <label><input type="checkbox" value="hsg-toan-11"> 🏆 HSG Toán 11</label>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-qbank" style="flex:1; background:#f1f5f9; color:#475569;" onclick="document.getElementById('modal-transfer-exam').style.display='none'">Hủy</button>
                <button class="btn-qbank btn-qbank-success" style="flex:1.5;" onclick="confirmTransferExamToClasses()">🚀 Xác nhận chuyển</button>
            </div>
        </div>`;
    document.body.appendChild(div);
}

async function confirmTransferExamToClasses() {
    const exam = qbankState.currentExamToTransfer;
    const checked = Array.from(document.querySelectorAll('#transfer-class-list input:checked')).map(c => c.value);
    if (checked.length === 0) return alert("Chọn ít nhất 1 lớp!");

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("Chưa kết nối Supabase!");

    try {
        const quizId = "quiz_" + Date.now();
        const dateStr = new Date().toLocaleString("vi-VN");
        
        await client.from('quizzes').upsert({
            id: quizId, title: exam.title, made: "101", time_limit_minutes: 90,
            scoring_config: exam.scoringConfig, questions: exam.questions, images: exam.images
        });

        const linkRows = checked.map(cat => ({
            id: quizId, category_id: cat, title: exam.title, date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT", is_hot: true, timestamp: Date.now()
        }));
        await client.from('custom_links').insert(linkRows);

        if (!exam.assignedClasses) exam.assignedClasses = [];
        checked.forEach(c => { if (!exam.assignedClasses.includes(c)) exam.assignedClasses.push(c); });
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        await client.from('app_key_values').upsert({ key: 'qbank_saved_exams', value: qbankState.savedExams });

        alert("🎉 ĐÃ CHUYỂN ĐỀ THÀNH CÔNG!");
        document.getElementById("modal-transfer-exam").style.display = "none";
        filterSavedExamsList(qbankState.savedExamFilter);
    } catch(err) { alert("Lỗi: " + err.message); }
}

function downloadSavedExamJson(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    const blob = new Blob([JSON.stringify(exam, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exam.title.replace(/\s+/g, '_')}.json`;
    a.click();
}

function deleteSavedExam(examId) {
    if (!confirm("⚠️ Xóa đề thi này khỏi Ngân hàng đề?")) return;
    qbankState.savedExams = qbankState.savedExams.filter(e => e.id !== examId);
    localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (client) client.from('app_key_values').upsert({ key: 'qbank_saved_exams', value: qbankState.savedExams });
    filterSavedExamsList(qbankState.savedExamFilter);
}

// BỘC LỘ HÀM GỌI RA GLOBAL SCOPE
window.toggleQbankMenu = toggleQbankMenu;
window.openQbankCreatorModal = openQbankCreatorModal;
window.closeQbankCreatorModal = closeQbankCreatorModal;
window.openSavedExamsModal = openSavedExamsModal;
window.closeSavedExamsModal = closeSavedExamsModal;
window.toggleStorageLocation = toggleStorageLocation;
window.triggerQbankUpload = triggerQbankUpload;
window.promptRenameFolder = promptRenameFolder;
window.promptAddRootFolder = promptAddRootFolder;
window.promptAddChildFolder = promptAddChildFolder;
window.promptChangeFolderColor = promptChangeFolderColor;
window.promptDeleteFolder = promptDeleteFolder;
window.selectQbankFolder = selectQbankFolder;
window.handleDropZoneOver = handleDropZoneOver;
window.handleDropZoneLeave = handleDropZoneLeave;
window.handleDropZoneDrop = handleDropZoneDrop;
window.handleQuestionDragStart = handleQuestionDragStart;
window.toggleSelectQuestion = toggleSelectQuestion;
window.triggerQBankPaste = triggerQBankPaste;
window.handleQBankImgSelect = handleQBankImgSelect;
window.deleteQBankImg = deleteQBankImg;
window.saveExtractedExamToBank = saveExtractedExamToBank;
window.filterSavedExamsList = filterSavedExamsList;
window.openTransferExamModal = openTransferExamModal;
window.confirmTransferExamToClasses = confirmTransferExamToClasses;
window.downloadSavedExamJson = downloadSavedExamJson;
window.deleteSavedExam = deleteSavedExam;
