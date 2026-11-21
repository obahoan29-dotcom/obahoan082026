// =========================================================
// FILE: ngan-hang-de.js (BẢN HOÀN THIỆN 100% - NÂNG CẤP LƯU NHÁP, MOVE, DELETE VÀ LỌC SÂU)
// =========================================================

let qbankState = {
    storageTarget: "drive",
    savedExamFilter: "all",
    currentTree: [
        {
            id: "node_lop10",
            name: "Lớp 10",
            color: "#0284c7",
            children: [
                {
                    id: "node_10_c1",
                    name: "Chương 1. Mệnh đề & Tập hợp",
                    color: "#059669",
                    children: [
                        { id: "node_10_c1_b1", name: "Bài 1. Mệnh đề toán học", color: "#6b21a8", children: [] },
                        { id: "node_10_c1_b2", name: "Bài 2. Tập hợp & Các phép toán", color: "#d97706", children: [] }
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
                        { id: "node_11_c1_b1", name: "Bài 1. Giá trị lượng giác", color: "#dc2626", children: [] },
                        { id: "node_11_c1_b2", name: "Bài 2. Phương trình lượng giác", color: "#7c3aed", children: [] }
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
                    name: "Chương 1. Ứng dụng đạo hàm",
                    color: "#0891b2",
                    children: [
                        { id: "node_12_c1_b1", name: "Bài 1. Tính đơn điệu", color: "#059669", children: [] },
                        { id: "node_12_c1_b2", name: "Bài 2. Cực trị của hàm số", color: "#b91c1c", children: [] }
                    ]
                }
            ]
        }
    ],
    activeFolderId: null,
    activeFolderObj: null,
    rawQuestions: [],
    selectedQuestionIds: new Set(),
    savedExams: [],
    draggedQId: null,
    imagesMap: {},
    currentExamToTransfer: null,

    // BỘ NHỚ LƯU TRẠNG THÁI MỞ/ĐÓNG MA TRẬN 16 Ô CỦA TỪNG NODE LÁ
    expandedLeafMatrixIds: new Set(),

    // BỘ LỌC THÔNG MINH HIỆN TẠI
    activeFilter: {
        folderId: null,
        folderName: null,
        part: null,
        level: null
    },

    // TRẠNG THÁI ẨN CÂU HỎI ĐÃ GÁN (NÚT XẾP CÂU)
    hideAssigned: false
};

const QBANK_COLOR_PALETTE = [
    "#0284c7", "#059669", "#7c3aed", "#ea580c", "#dc2626", "#0891b2", "#ca8a04", "#475569"
];

// ============================================================================
// HÀM LƯU/TẢI DỮ LIỆU BẢN NHÁP (FEATURE 1)
// ============================================================================
function saveQbankDraftState() {
    try {
        localStorage.setItem('qbank_draft_questions', JSON.stringify(qbankState.rawQuestions));
        localStorage.setItem('qbank_draft_images', JSON.stringify(qbankState.imagesMap));
        showSoiDeToast("💾 Đã lưu phiên làm việc Ngân hàng câu hỏi vào máy!");
    } catch(e) {
        console.error("Lỗi lưu nháp:", e);
    }
}

function loadQbankDraftState() {
    try {
        let q = localStorage.getItem('qbank_draft_questions');
        let img = localStorage.getItem('qbank_draft_images');
        if(q) {
            let parsedQ = JSON.parse(q);
            if(Array.isArray(parsedQ)) qbankState.rawQuestions = parsedQ;
        }
        if(img) {
            let parsedImg = JSON.parse(img);
            if(typeof parsedImg === 'object') qbankState.imagesMap = parsedImg;
        }
    } catch(e){}
}

// ============================================================================
// HÀM MỞ & ĐỊNH VỊ DROPDOWN MENU CHÍNH XÁC (CHỐNG CHÌM & CHỐNG TRÀN)
// ============================================================================

function toggleQbankMenu(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const btn = document.getElementById("qbank-btn");
    const menu = document.getElementById("qbank-dropdown-menu");
    if (!btn || !menu) return;

    const isShown = menu.classList.contains("show");
    if (isShown) {
        menu.classList.remove("show");
        return;
    }

    const adminPanel = document.getElementById("admin-popover-panel");
    if (adminPanel) adminPanel.classList.remove("show");

    const rect = btn.getBoundingClientRect();
    const menuWidth = 285;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > windowWidth - 10) left = windowWidth - menuWidth - 10;

    const spaceBelow = windowHeight - rect.bottom;
    if (spaceBelow < 180 && rect.top > 180) {
        menu.style.top = "auto";
        menu.style.bottom = `${windowHeight - rect.top + 6}px`;
    } else {
        menu.style.bottom = "auto";
        menu.style.top = `${rect.bottom + 6}px`;
    }

    menu.style.left = `${left}px`;
    menu.classList.add("show");
}

document.addEventListener("click", function(e) {
    const wrap = e.target.closest(".qbank-dropdown-wrapper");
    const menu = document.getElementById("qbank-dropdown-menu");
    if (!wrap && menu && menu.classList.contains("show")) {
        menu.classList.remove("show");
    }
});

function openQbankCreatorModal() {
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");

    const modal = document.getElementById("modal-qbank-creator");
    if (modal) {
        modal.style.display = "flex";
        loadQbankTreeData();
        loadQbankDraftState(); // KHÔI PHỤC DỮ LIỆU ĐÃ LƯU KHI MỞ
        renderQbankTree();
        renderQbankQuestions();
        updateQbankMatrixStats();
        updateQbankBuilderStats();
    }
}

function closeQbankCreatorModal() { 
    const modal = document.getElementById("modal-qbank-creator");
    if (modal) modal.style.display = "none"; 
}

function openSavedExamsModal() {
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");

    const modal = document.getElementById("modal-qbank-saved");
    if (modal) { 
        modal.style.display = "flex"; 
        loadSavedExamsList(); 
    }
}

function closeSavedExamsModal() { 
    const modal = document.getElementById("modal-qbank-saved");
    if (modal) modal.style.display = "none"; 
}

function toggleStorageLocation(selectEl) { 
    qbankState.storageTarget = selectEl.value; 
}

// ============================================================================
// CỘT 1: CÂY THƯ MỤC & MA TRẬN PHÂN LOẠI
// ============================================================================

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

function getAllDescendantFolderIds(node) {
    let ids = [node.id];
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            ids = ids.concat(getAllDescendantFolderIds(child));
        });
    }
    return ids;
}

function generatePrefixSlug(name) {
    let s = String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (s.includes("lop") || s.includes("lớp")) return s.replace(/[^0-9]/g, "") || "lop";
    if (s.includes("chuong") || s.includes("chương")) return "c" + s.replace(/[^0-9]/g, "");
    if (s.includes("bai") || s.includes("bài")) return "b" + s.replace(/[^0-9]/g, "");
    return s.substring(0, 3).replace(/[^a-z0-9]/g, "");
}

function getHierarchicalPrefix(targetId) {
    let path = [];
    function traverse(nodes, currentPath) {
        for (let n of nodes) {
            let newPath = [...currentPath, n];
            if (n.id === targetId) { 
                path = newPath; 
                return true; 
            }
            if (n.children && traverse(n.children, newPath)) return true;
        }
        return false;
    }
    traverse(qbankState.currentTree, []);
    return path.map(p => generatePrefixSlug(p.name)).join(".");
}

// TOGGLE MỞ / THU MA TRẬN 16 Ô CỦA TỪNG NODE LÁ (CHỦ ĐỘNG BẬT TẮT, KHÔNG TỰ ĐỘNG THU LẠI)
function toggleLeafMatrixDisplay(folderId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (qbankState.expandedLeafMatrixIds.has(folderId)) {
        qbankState.expandedLeafMatrixIds.delete(folderId);
    } else {
        qbankState.expandedLeafMatrixIds.add(folderId);
    }
    renderQbankTree();
}

function renderQbankTree() {
    const rootEl = document.getElementById("qbank-tree-root");
    if (!rootEl) return;

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
        let subHtml = "";

        if (!isLeaf) {
            subHtml = `<div class="tree-children">${node.children.map(child => buildNodeHtml(child, depth + 1)).join("")}</div>`;
        }

        let matrixDropHtml = "";
        const isMatrixOpen = isLeaf && qbankState.expandedLeafMatrixIds.has(node.id);

        if (isLeaf && isMatrixOpen) {
            const counts = { 
                1: {nb:0, th:0, vdt:0, vdc:0}, 
                2: {nb:0, th:0, vdt:0, vdc:0}, 
                3: {nb:0, th:0, vdt:0, vdc:0}, 
                4: {nb:0, th:0, vdt:0, vdc:0} 
            };

            qbankState.rawQuestions.forEach(q => {
                if (q.folderId === node.id) {
                    let p = q.part || 1;
                    if (q.type === 'true_false') p = 2;
                    else if (q.type === 'short_answer' && q.part !== 4) p = 3;
                    
                    let lvl = q.level || 'nb';
                    if (counts[p] && counts[p][lvl] !== undefined) {
                        counts[p][lvl]++;
                    }
                }
            });

            matrixDropHtml = `
                <div class="leaf-matrix-container" onclick="event.stopPropagation()">
                    <div class="leaf-matrix-header-bar">
                        <span>📥 Ma trận 16 ô (${node.name}):</span>
                        <button type="button" class="btn-clear-filter" onclick="toggleLeafMatrixDisplay('${node.id}', event)" title="Thu gọn ma trận">▲ Thu lại</button>
                    </div>
                    ${[1, 2, 3, 4].map(p => {
                        const isPartFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
                        return `
                        <div class="leaf-matrix-row">
                            <div class="leaf-matrix-lbl ${isPartFiltered ? 'active-filter' : ''}" 
                                 onclick="setFilterByNodePart('${node.id}', ${p})"
                                 title="Bấm để xem tất cả câu Phần ${p}">P${p}</div>
                            ${['nb', 'th', 'vdt', 'vdc'].map(lvl => {
                                const lblMap = { nb: 'NB', th: 'TH', vdt: 'VD', vdc: 'VDC' };
                                const isCellFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl);
                                return `
                                <div class="leaf-drop-zone ${isCellFiltered ? 'active-filter' : ''}"
                                     ondragover="handleDropZoneOver(event)" 
                                     ondragleave="handleDropZoneLeave(event)"
                                     ondrop="handleDropZoneDrop(event, '${node.id}', ${p}, '${lvl}')" 
                                     onclick="handleMatrixCellClick('${node.id}', ${p}, '${lvl}')"
                                     title="Kéo thả vào đây HOẶC Click để lọc Phần ${p} - ${lblMap[lvl]}">
                                    <span>${lblMap[lvl]}</span>
                                    <b>(${counts[p][lvl]})</b>
                                </div>`;
                            }).join('')}
                        </div>`;
                    }).join('')}
                </div>
            `;
        }

        return `
            <div class="tree-item-wrapper" style="margin-left: ${depth > 0 ? 3 : 0}px;">
                <div class="tree-item ${isActive ? 'active' : ''}" id="tree-node-${node.id}"
                     onclick="handleFolderNodeClick('${node.id}')"
                     style="border-left: 3.5px solid ${nodeColor};">
                    
                    <div style="display:flex; align-items:center; gap:5px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:13px;">${isLeaf ? '📄' : '📁'}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.8px;" title="${node.name}">${node.name}</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:2px;" onclick="event.stopPropagation()">
                        ${isLeaf ? `
                            <button class="btn-matrix-toggle ${isMatrixOpen ? 'is-open' : ''}" 
                                    onclick="toggleLeafMatrixDisplay('${node.id}', event)" 
                                    title="${isMatrixOpen ? 'Thu gọn ma trận 16 ô' : 'Mở rộng ma trận 16 ô để xếp câu'}">
                                ${isMatrixOpen ? '⊞' : '⊞'}
                            </button>
                        ` : ''}
                        <div class="tree-color-picker-dot" style="background:${nodeColor};" onclick="promptChangeFolderColor('${node.id}')" title="Đổi màu"></div>
                        <button class="btn-rename-tree" onclick="promptRenameFolder('${node.id}')" title="Đổi tên thư mục">✏️</button>
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

// XỬ LÝ CLICK CHỌN THƯ MỤC: LỌC TỰ ĐỘNG CỘT GIỮA
function handleFolderNodeClick(folderId) {
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);

    // Thiết lập bộ lọc thông minh tương ứng
    qbankState.activeFilter = {
        folderId: folderId,
        folderName: qbankState.activeFolderObj ? qbankState.activeFolderObj.name : "",
        part: null,
        level: null
    };

    // Nếu là node lá, tự động mở xòe ma trận (và giữ nguyên không đóng lại)
    const node = qbankState.activeFolderObj;
    if (node && (!node.children || node.children.length === 0)) {
        qbankState.expandedLeafMatrixIds.add(folderId);
    }

    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

// LỌC THEO PHẦN (P1, P2, P3, P4) TẠI NODE LÁ
function setFilterByNodePart(folderId, part) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = node;
    qbankState.activeFilter = {
        folderId: folderId,
        folderName: node ? node.name : "",
        part: part,
        level: null
    };
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

// CLICK VÀO Ô MA TRẬN: GÁN CÂU ĐÃ CHỌN (NẾU CÓ CHỌN) HOẶC LỌC CÂU THEO Ô ĐÓ
function handleMatrixCellClick(folderId, part, level) {
    if (qbankState.selectedQuestionIds.size > 0) {
        assignSelectedQuestionsToMatrix(folderId, part, level);
    } else {
        // Nếu không có câu nào được tích chọn -> kích hoạt lọc theo ô này
        const node = findNodeInTree(qbankState.currentTree, folderId);
        qbankState.activeFolderId = folderId;
        qbankState.activeFolderObj = node;
        qbankState.activeFilter = {
            folderId: folderId,
            folderName: node ? node.name : "",
            part: part,
            level: level
        };
        renderQbankTree();
        renderQbankQuestions();
        updateQbankMatrixStats();
    }
}

// NÚT HỦY BỘ LỌC ĐỂ QUAY VỀ XEM TẤT CẢ
function clearQbankFilter() {
    qbankState.activeFilter = {
        folderId: null,
        folderName: null,
        part: null,
        level: null
    };
    qbankState.activeFolderId = null;
    qbankState.activeFolderObj = null;
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

// NÚT XẾP CÂU: BẬT/TẮT ẨN TOÀN BỘ CÂU ĐÃ GÁN VÀO MA TRẬN
function toggleHideAssignedQuestions() {
    qbankState.hideAssigned = !qbankState.hideAssigned;
    const btn = document.getElementById("btn-toggle-assigned");
    if (btn) {
        btn.classList.toggle("is-active", qbankState.hideAssigned);
        btn.innerHTML = qbankState.hideAssigned 
            ? `<span>👁️</span> <b>Hiện lại câu đã xếp</b>` 
            : `<span>📦</span> <b>Xếp câu (Ẩn đã xếp)</b>`;
    }
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function promptRenameFolder(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    const newName = prompt("✏️ Đổi tên thư mục:", node.name);
    if (newName && newName.trim()) {
        node.name = newName.trim();
        saveQbankTreeData(); 
        renderQbankTree();
    }
}

function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Lớp 10):");
    if (name && name.trim()) {
        qbankState.currentTree.push({ 
            id: "node_" + Date.now(), 
            name: name.trim(), 
            color: QBANK_COLOR_PALETTE[Math.floor(Math.random() * QBANK_COLOR_PALETTE.length)], 
            children: [] 
        });
        saveQbankTreeData(); 
        renderQbankTree();
    }
}

function promptAddChildFolder(parentId) {
    const parent = findNodeInTree(qbankState.currentTree, parentId);
    const name = prompt(`📁 Thêm mục con vào [${parent.name}]:`);
    if (name && name.trim()) {
        if (!parent.children) parent.children = [];
        parent.children.push({ 
            id: "node_" + Date.now(), 
            name: name.trim(), 
            color: parent.color, 
            children: [] 
        });
        saveQbankTreeData(); 
        renderQbankTree();
    }
}

function promptChangeFolderColor(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    const chosen = prompt("🎨 Chọn mã màu Hex (VD: #0284c7):", node.color);
    if (chosen && chosen.trim()) { 
        node.color = chosen.trim(); 
        saveQbankTreeData(); 
        renderQbankTree(); 
    }
}

function promptDeleteFolder(folderId) {
    if (!confirm(`⚠️ Bạn có chắc muốn xóa thư mục này và tất cả mục con?`)) return;
    const parent = findParentNodeInTree(qbankState.currentTree, folderId);
    if (parent) {
        parent.children = parent.children.filter(c => c.id !== folderId);
    } else {
        qbankState.currentTree = qbankState.currentTree.filter(c => c.id !== folderId);
    }
    if (qbankState.activeFolderId === folderId) {
        qbankState.activeFolderId = null;
        qbankState.activeFolderObj = null;
        clearQbankFilter();
    }
    saveQbankTreeData(); 
    renderQbankTree();
}

function selectQbankFolder(folderId) {
    handleFolderNodeClick(folderId);
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

// ============================================================================
// KÉO THẢ & GÁN VÀO MA TRẬN 16 Ô (MẶC ĐỊNH KHÔNG TỰ ĐỘNG CHỌN CHECKBOX)
// ============================================================================

function handleDropZoneOver(e) { 
    e.preventDefault(); 
    e.currentTarget.classList.add("drag-over"); 
}

function handleDropZoneLeave(e) { 
    e.currentTarget.classList.remove("drag-over"); 
}

function handleDropZoneDrop(e, folderId, part, level) {
    e.preventDefault(); 
    e.currentTarget.classList.remove("drag-over");
    
    const qId = e.dataTransfer.getData("text/plain") || qbankState.draggedQId;
    if (!qId) return;

    applyMatrixToQuestion(qId, folderId, part, level);
}

function assignSelectedQuestionsToMatrix(folderId, part, level) {
    if (qbankState.selectedQuestionIds.size === 0) return;
    qbankState.selectedQuestionIds.forEach(qId => {
        applyMatrixToQuestion(qId, folderId, part, level);
    });
}

function applyMatrixToQuestion(qId, folderId, part, level) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;

    if (part === 1) { 
        q.type = "multiple_choice"; 
        delete q.part; 
        if(!q.options) q.options = ["A","B","C","D"]; 
    } else if (part === 2) { 
        q.type = "true_false"; 
        delete q.part; 
        if(!q.statements) q.statements = [{id:'a', statement:'', correct:true}]; 
    } else if (part === 3) { 
        q.type = "short_answer"; 
        delete q.part; 
    } else if (part === 4) { 
        q.type = "short_answer"; 
        q.part = 4; 
    }

    q.level = level;
    q.folderId = folderId;
    
    const currentFolderTarget = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = currentFolderTarget ? currentFolderTarget.name : "";
    
    const countInFolder = qbankState.rawQuestions.filter(x => x.folderId === folderId).length;
    const prefix = getHierarchicalPrefix(folderId);
    q.id = `${prefix}.num${countInFolder}`; 

    saveQbankDraftState();
    renderQbankTree(); 
    renderQbankQuestions(); 
    updateQbankMatrixStats();
    updateQbankBuilderStats();
}

// ============================================================================
// CHUYỂN & XÓA CÂU HỎI (FEATURE 3 & 4)
// ============================================================================
function deleteQbankQuestion(qId) {
    if(!confirm("⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn câu hỏi này khỏi hệ thống biên soạn?")) return;
    qbankState.rawQuestions = qbankState.rawQuestions.filter(q => String(q.id) !== String(qId));
    qbankState.selectedQuestionIds.delete(String(qId));
    saveQbankDraftState();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
}

function promptMoveQuestion(qId) {
    let options = [];
    function traverse(nodes, path) {
        nodes.forEach(n => {
            let currentPath = path ? path + " > " + n.name : n.name;
            if (!n.children || n.children.length === 0) {
                options.push({id: n.id, name: currentPath, shortName: n.name});
            } else {
                traverse(n.children, currentPath);
            }
        });
    }
    traverse(qbankState.currentTree, "");

    if (options.length === 0) return alert("Chưa có thư mục lá nào để chuyển!");

    let selectHtml = `<select id="move-qbank-select" style="width:100%; padding:10px; margin:15px 0; border-radius:8px; border:1px solid #cbd5e1; font-weight:700; color:#334155; outline:none;">`;
    options.forEach(o => {
        selectHtml += `<option value="${o.id}">${o.name}</option>`;
    });
    selectHtml += `</select>`;

    let div = document.createElement("div");
    div.className = "qbank-modal-overlay";
    div.id = "move-qbank-modal";
    div.style.display = "flex";
    div.innerHTML = `
        <div class="qbank-modal-container" style="width: 420px; height: auto; padding: 22px; overflow:visible;">
            <h3 style="margin-top:0; color:#0284c7; font-weight:900; font-size:16px;">🔄 Chuyển câu hỏi sang mục khác</h3>
            ${selectHtml}
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="document.getElementById('move-qbank-modal').remove()" style="flex:1; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; background:#f1f5f9; cursor:pointer; font-weight:800; color:#475569;">Hủy</button>
                <button onclick="executeMoveQbankQuestion('${qId}')" style="flex:1; padding:10px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; cursor:pointer; font-weight:900; box-shadow:0 3px 8px rgba(2,132,199,0.3);">Xác nhận chuyển</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

function executeMoveQbankQuestion(qId) {
    let sel = document.getElementById("move-qbank-select");
    if(!sel) return;
    let targetFolderId = sel.value;
    let targetFolder = findNodeInTree(qbankState.currentTree, targetFolderId);
    let q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    
    if(q && targetFolder) {
        qbankState.selectedQuestionIds.delete(String(qId));
        q.folderId = targetFolderId;
        q.folderName = targetFolder.name;
        
        const countInFolder = qbankState.rawQuestions.filter(x => x.folderId === targetFolderId).length;
        const prefix = getHierarchicalPrefix(targetFolderId);
        q.id = `${prefix}.num${countInFolder}`; 
        
        saveQbankDraftState();
        renderQbankQuestions();
        updateQbankMatrixStats();
        updateQbankBuilderStats();
        document.getElementById('move-qbank-modal').remove();
        showSoiDeToast("✅ Đã chuyển câu hỏi sang " + targetFolder.name);
    }
}

// ============================================================================
// CỘT 2: PARSER ĐỀ THI ĐA TẦNG, LỌC THÔNG MINH & SẮP XẾP NB -> TH -> VD -> VDC
// ============================================================================

function triggerQbankUpload() {
    let input = document.getElementById("qbank-file-upload-input");
    if (!input) {
        input = document.createElement("input");
        input.type = "file"; 
        input.id = "qbank-file-upload-input"; 
        input.accept = ".json,.js,.txt"; 
        input.style.display = "none";
        document.body.appendChild(input);
        
        input.onchange = function() { 
            if (this.files && this.files[0]) readQbankJsonFile(this.files[0]); 
        };
    }
    input.value = ""; 
    input.click();
}

function parseUniversalExamText(text) {
    if (!text) return null;
    let clean = String(text).trim();

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

function readQbankJsonFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const parsed = parseUniversalExamText(text);
            if (!parsed) throw new Error("File đề thi không đúng cấu trúc (không nhận diện được mảng questions)!");

            let rawQ = [];
            if (Array.isArray(parsed)) rawQ = parsed;
            else if (parsed.questions) {
                rawQ = parsed.questions;
                if (parsed.images) qbankState.imagesMap = parsed.images;
                if (parsed.title) {
                    const titleInp = document.getElementById("qbank-exam-name");
                    if (titleInp) titleInp.value = parsed.title;
                }
            }

            rawQ.forEach((q, idx) => {
                q.id = q.id || (idx + 1);
                if (!q.level) q.level = "nb";
            });

            qbankState.rawQuestions = rawQ;
            qbankState.selectedQuestionIds = new Set();
            clearQbankFilter();
            
            saveQbankDraftState(); // Auto save upon load

            renderQbankQuestions();
            updateQbankMatrixStats();
            updateQbankBuilderStats();
            
            alert(`✅ Đã nạp thành công ${rawQ.length} câu hỏi vào hệ thống soạn thảo!`);
        } catch(err) { 
            alert("❌ Lỗi nạp file: " + err.message); 
        }
    };
    reader.readAsText(file);
}

// BỘ LỌC VÀ SẮP XẾP CÂU HỎI THEO THỨ TỰ P1->P4 VÀ NB->TH->VD->VDC
function getFilteredAndSortedQuestions() {
    let list = [...(qbankState.rawQuestions || [])];

    // 1. Lọc theo trạng thái "Ẩn câu đã xếp" (hideAssigned)
    if (qbankState.hideAssigned) {
        list = list.filter(q => !q.folderId);
    }

    // 2. Lọc theo cây thư mục tương tác (Interactive Filtering)
    if (qbankState.activeFilter.folderId) {
        const rootNode = findNodeInTree(qbankState.currentTree, qbankState.activeFilter.folderId);
        if (rootNode) {
            const allowedFolderIds = new Set(getAllDescendantFolderIds(rootNode));
            list = list.filter(q => q.folderId && allowedFolderIds.has(q.folderId));
        }
    }

    // 3. Lọc theo Phần (P1, P2, P3, P4)
    if (qbankState.activeFilter.part) {
        list = list.filter(q => {
            let p = q.part || 1;
            if (q.type === 'true_false') p = 2;
            else if (q.type === 'short_answer' && q.part !== 4) p = 3;
            return p === qbankState.activeFilter.part;
        });
    }

    // 4. Lọc theo Mức độ (NB, TH, VD, VDC)
    if (qbankState.activeFilter.level) {
        list = list.filter(q => (q.level || 'nb') === qbankState.activeFilter.level);
    }

    // 5. SẮP XẾP CHUẨN MỰC: Từ Phần 1 -> 4 và trong mỗi phần: NB -> TH -> VD -> VDC
    const levelOrder = { 'nb': 1, 'th': 2, 'vdt': 3, 'vdc': 4 };

    list.sort((a, b) => {
        let pA = a.part || 1;
        if (a.type === 'true_false') pA = 2;
        else if (a.type === 'short_answer' && a.part !== 4) pA = 3;

        let pB = b.part || 1;
        if (b.type === 'true_false') pB = 2;
        else if (b.type === 'short_answer' && b.part !== 4) pB = 3;

        if (pA !== pB) return pA - pB;

        let lvlA = levelOrder[a.level || 'nb'] || 1;
        let lvlB = levelOrder[b.level || 'nb'] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;

        return 0;
    });

    return list;
}

function updateQbankMatrixStats() {
    const bar = document.getElementById("qbank-matrix-bar");
    if (!bar) return;

    const questions = qbankState.rawQuestions || [];
    if (questions.length === 0) {
        bar.innerHTML = `<span style="color:#64748b; font-style:italic;">Upload file JSON để xem ma trận thống kê 4 mức độ</span>`;
        return;
    }

    const stats = { 
        1: {nb:0, th:0, vdt:0, vdc:0}, 
        2: {nb:0, th:0, vdt:0, vdc:0}, 
        3: {nb:0, th:0, vdt:0, vdc:0}, 
        4: {nb:0, th:0, vdt:0, vdc:0} 
    };
    let total = 0;

    questions.forEach(q => {
        let p = q.part || 1;
        if (q.type === 'true_false') p = 2; 
        else if (q.type === 'short_answer' && q.part !== 4) p = 3;
        
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
            const isPartAct = (qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
            html += `
            <div class="matrix-group ${isPartAct ? 'active-filter' : ''}" onclick="filterByGlobalPart(${p})">
                <span class="matrix-title">Phần ${p} (${sumP})</span>
                <div class="matrix-row">
                    <span class="stat-pill nb ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === 'nb' ? 'active-filter' : ''}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'nb')">NB: ${s.nb}</span>
                    <span class="stat-pill th ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === 'th' ? 'active-filter' : ''}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'th')">TH: ${s.th}</span>
                    <span class="stat-pill vdt ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === 'vdt' ? 'active-filter' : ''}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdt')">VD: ${s.vdt}</span>
                    <span class="stat-pill vdc ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === 'vdc' ? 'active-filter' : ''}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdc')">VDC: ${s.vdc}</span>
                </div>
            </div>`;
        }
    });
    
    html += `<div style="margin-left:auto; font-weight:900; color:#0f172a; font-size:11.5px; white-space:nowrap;">Tổng cộng: ${total} câu</div>`;

    // Nếu đang lọc, hiển thị thêm thanh chỉ báo lọc
    const hasFilter = qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned;
    if (hasFilter) {
        let filterLabels = [];
        if (qbankState.hideAssigned) filterLabels.push("Đang ẩn câu đã xếp");
        if (qbankState.activeFilter.folderName) filterLabels.push(`Mục: ${qbankState.activeFilter.folderName}`);
        if (qbankState.activeFilter.part) filterLabels.push(`Phần ${qbankState.activeFilter.part}`);
        if (qbankState.activeFilter.level) {
            const lvlMap = { nb: 'Nhận biết', th: 'Thông hiểu', vdt: 'Vận dụng', vdc: 'Vận dụng cao' };
            filterLabels.push(`Mức: ${lvlMap[qbankState.activeFilter.level]}`);
        }

        html += `
            <div class="qbank-active-filter-bar" style="width: 100%;">
                <span>🔍 Đang lọc kết hợp: <b>${filterLabels.join(" • ")}</b></span>
                <button type="button" class="btn-clear-filter" onclick="clearQbankFilter()">✕ Hủy lọc</button>
            </div>
        `;
    }

    bar.innerHTML = html;
}

function filterByGlobalPart(p) {
    if (qbankState.activeFilter.part === p && !qbankState.activeFilter.level) {
        qbankState.activeFilter.part = null;
    } else {
        qbankState.activeFilter.part = p;
        qbankState.activeFilter.level = null;
    }
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function filterByGlobalCell(p, lvl) {
    if (qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl) {
        qbankState.activeFilter.part = null;
        qbankState.activeFilter.level = null;
    } else {
        qbankState.activeFilter.part = p;
        qbankState.activeFilter.level = lvl;
    }
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function renderQbankQuestions() {
    const container = document.getElementById("qbank-questions-list");
    if (!container) return;

    const questions = getFilteredAndSortedQuestions();

    if (questions.length === 0) {
        const isFilterActive = qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned;
        container.innerHTML = `
            <div style="text-align:center; padding:40px 16px; color:#64748b;">
                <div style="font-size:36px; margin-bottom:8px;">${isFilterActive ? '🔍' : '📥'}</div>
                <b>${isFilterActive ? 'Không tìm thấy câu hỏi nào phù hợp với bộ lọc này.' : 'Chưa có câu hỏi nào trong danh sách.'}</b>
                <p style="font-size:11.5px; margin-top:4px;">
                    ${isFilterActive ? '<a href="javascript:void(0)" onclick="clearQbankFilter()" style="color:#0284c7; font-weight:800; text-decoration:underline;">Nhấn vào đây để hủy lọc và xem tất cả</a>' : 'Nhấn nút "Upload file JSON đề" ở trên để nạp ngân hàng câu hỏi nhé!'}
                </p>
            </div>
        `;
        return;
    }

    let html = "";
    const letters = ["A", "B", "C", "D"];

    questions.forEach((q) => {
        const isChecked = qbankState.selectedQuestionIds.has(String(q.id));
        
        let p = q.part || 1;
        if (q.type === 'true_false') p = 2; 
        else if (q.type === 'short_answer' && q.part !== 4) p = 3;
        
        const levelText = { nb: 'Nhận biết', th: 'Thông hiểu', vdt: 'Vận dụng', vdc: 'Vận dụng cao' }[q.level || 'nb'];

        const imgKey = q.imageKey || `img_q_${q.id}`;
        let imgUrl = q.imageUrl || qbankState.imagesMap[imgKey] || "";
        
        const uploaderHtml = `
            <div class="qbank-img-tool-zone" id="zone-qbank-${q.id}" tabindex="0" title="Bấm vào vùng này rồi ấn Ctrl+V để dán ảnh" style="display:flex; align-items:center; gap:5px; background:#f8fafc; padding:3px 6px; border-radius:5px; border:1px dashed #cbd5e1; margin-top:4px;">
                <span style="font-size:10.5px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
                <button type="button" class="btn-qbank-img" onclick="triggerQBankPaste('${q.id}', '${imgKey}')">📋 Dán (Ctrl+V)</button>
                <input type="file" id="file-qbank-${q.id}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${q.id}', '${imgKey}')">
                <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbank-${q.id}').click()">📁 Tệp</button>
                ${imgUrl ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${q.id}', '${imgKey}')">🗑 Xóa</button>` : ''}
                <span id="status-qbank-${q.id}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
            </div>
            ${imgUrl ? `<div style="text-align:center; margin:4px 0;"><img src="${imgUrl}" style="max-height:140px; border-radius:6px; border:1px solid #cbd5e1;"></div>` : ''}
        `;

        let contentDetailsHtml = "";
        if (q.type === "multiple_choice" && !q.part) {
            let correctIdx = 0;
            if (typeof q.correct === 'number') correctIdx = q.correct;
            else if (typeof q.correct === 'string') correctIdx = letters.indexOf(q.correct.trim().toUpperCase());

            contentDetailsHtml = `
                <div class="qbank-options-preview">
                    ${(q.options || []).map((opt, oIdx) => `
                        <div class="qbank-opt-item ${oIdx === correctIdx ? 'is-correct' : ''}">
                            <span class="qbank-opt-circle">${letters[oIdx]}</span>
                            <span>${opt} ${oIdx === correctIdx ? '<b>✓</b>' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (q.type === "true_false") {
            contentDetailsHtml = `
                <div style="margin:4px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 6px;">
                    ${(q.statements || []).map(st => {
                        const isTrue = (st.correct === true || String(st.correct).toLowerCase() === 'đúng');
                        return `
                        <div style="font-size:11.5px; margin-bottom:2px; display:flex; justify-content:space-between;">
                            <span><b>${st.id})</b> ${st.statement}</span>
                            <b style="color:${isTrue ? '#16a34a' : '#dc2626'};">${isTrue ? '🟢 Đúng' : '🔴 Sai'}</b>
                        </div>`;
                    }).join('')}
                </div>
            `;
        } else {
            const ans = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || "0");
            contentDetailsHtml = `
                <div style="margin:4px 0; font-size:11.5px; font-weight:800; color:#0d9488; background:#f0fdfa; padding:3px 6px; border-radius:5px; border:1px solid #99f6e4;">
                    🎯 Đáp số: <span style="color:#0f172a;">${ans}</span>
                </div>
            `;
        }

        const explainHtml = q.explanation ? `
            <div style="font-size:11px; color:#78350f; background:#fffbeb; padding:4px 6px; border-radius:5px; border-left:3px solid #f59e0b; margin-top:4px;">
                💡 <b>Lời giải:</b> ${q.explanation}
            </div>` : '';

        const folderTag = q.folderName ? `<span style="font-size:10px; color:#16a34a; background:#dcfce7; padding:1px 5px; border-radius:5px; border:1px solid #bbf7d0;">📁 ${q.folderName}</span>` : '';

        html += `
            <div class="qbank-q-card ${isChecked ? 'selected' : ''}" id="qbank-card-${q.id}" draggable="true" ondragstart="handleQuestionDragStart(event, '${q.id}')">
                <div class="qbank-q-header">
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                        <span class="qbank-q-id-badge">${q.id}</span>
                        <span style="font-size:10.5px; font-weight:800; color:#059669; border:1px solid #10b981; padding:1px 5px; border-radius:5px; background:#ecfdf5;">Phần ${p} • ${levelText}</span>
                        ${folderTag}
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button type="button" class="btn-soide-mini" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;" onclick="promptMoveQuestion('${q.id}')" title="Chuyển sang mục khác">🔄 Chuyển</button>
                        <button type="button" class="btn-soide-mini" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;" onclick="deleteQbankQuestion('${q.id}')" title="Xóa câu hỏi này">🗑️ Xóa</button>
                        <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:900; font-size:11.5px; color:#0f172a;">
                            <input type="checkbox" style="width:16px; height:16px; accent-color:#10b981; cursor:pointer;" ${isChecked ? 'checked' : ''} onchange="toggleSelectQuestion('${q.id}', this.checked)"> Chọn
                        </label>
                    </div>
                </div>
                <div style="font-size:12.5px; font-weight:600; color:#1e293b; margin-bottom:3px; line-height:1.4;">${q.question || ''}</div>
                ${uploaderHtml}
                ${contentDetailsHtml}
                ${explainHtml}
            </div>
        `;
    });

    container.innerHTML = html;

    if (window.MathJax && MathJax.typesetPromise) {
        try { MathJax.typesetPromise([container]).catch(() => {}); } catch(e) {}
    }
}

function handleQuestionDragStart(e, qId) {
    qbankState.draggedQId = qId;
    e.dataTransfer.setData("text/plain", qId);
}

function toggleSelectQuestion(qId, isChecked) {
    if (isChecked) {
        qbankState.selectedQuestionIds.add(String(qId));
    } else {
        qbankState.selectedQuestionIds.delete(String(qId));
    }
    
    const card = document.getElementById(`qbank-card-${qId}`);
    if (card) {
        card.classList.toggle("selected", isChecked);
    }
    
    updateQbankBuilderStats();
}

// ============================================================================
// DÁN ẢNH & CHỌN TỆP CHO TỪNG CÂU HỎI
// ============================================================================

function triggerQBankPaste(qId, imgKey) {
    const zone = document.getElementById(`zone-qbank-${qId}`);
    if (zone) zone.focus();
    alert(`📋 Thầy hãy bấm phím Ctrl + V để dán ảnh chụp từ Snipping Tool vào câu này nhé!`);
}

document.addEventListener('paste', function(e) {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.id && activeEl.id.startsWith("zone-qbank-")) {
        const qId = activeEl.id.replace("zone-qbank-", "");
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;
        
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                uploadQBankImage(blob, qId, imgKey);
                break;
            }
        }
    }
});

function handleQBankImgSelect(input, qId, imgKey) {
    if (input.files && input.files[0]) {
        uploadQBankImage(input.files[0], qId, imgKey);
    }
}

async function uploadQBankImage(file, qId, imgKey) {
    const stEl = document.getElementById(`status-qbank-${qId}`);
    if (stEl) { 
        stEl.style.color = "#0284c7"; 
        stEl.innerText = "⏳ Đang tải..."; 
    }

    try {
        const reader = new FileReader();
        const b64 = await new Promise((res, rej) => {
            reader.onload = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

        let directUrl = "";
        
        if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_")) {
            let fd = new FormData(); 
            fd.append("image", b64);
            let r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd }).then(x=>x.json()).catch(()=>null);
            if (r && r.data) directUrl = r.data.display_url || r.data.url;
        }

        if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            let payload = { 
                filename: `qbank_img_${qId}_${Date.now()}.png`, 
                mimeType: file.type || "image/png", 
                base64: b64 
            };
            let r = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, { 
                method: "POST", 
                headers: { "Content-Type": "text/plain;charset=utf-8" }, 
                body: JSON.stringify(payload) 
            }).then(x=>x.json()).catch(()=>null);
            
            if (r && r.fileUrl) {
                directUrl = (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(r.fileUrl) : r.fileUrl;
            }
        }

        if (!directUrl) {
            directUrl = `data:${file.type};base64,${b64}`;
        }

        qbankState.imagesMap[imgKey] = directUrl;
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        if (q) { 
            q.imageUrl = directUrl; 
            q.imageKey = imgKey; 
        }

        saveQbankDraftState();
        renderQbankQuestions();
    } catch(e) {
        if (stEl) { 
            stEl.style.color = "#dc2626"; 
            stEl.innerText = "❌ Lỗi"; 
        }
    }
}

function deleteQBankImg(qId, imgKey) {
    if(!confirm("⚠️ Xóa ảnh minh họa của câu này?")) return;
    delete qbankState.imagesMap[imgKey];
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (q) q.imageUrl = "";
    saveQbankDraftState();
    renderQbankQuestions();
}

// ============================================================================
// CỘT 3: TRÍCH XUẤT ĐỀ THI & LƯU VÀO NGÂN HÀNG
// ============================================================================

function updateQbankBuilderStats() {
    const container = document.getElementById("qbank-builder-stats");
    if (!container) return;

    const total = qbankState.selectedQuestionIds.size;
    if (total === 0) {
        container.innerHTML = `<p style="color:#64748b; font-style:italic;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>`;
        return;
    }
    
    container.innerHTML = `
        <div style="font-weight:900; color:#10b981; font-size:13px; margin-bottom:3px;">🎯 Đã chọn: ${total} câu hỏi</div>
        <div style="font-size:11px; color:#475569;">Hệ thống sẽ tự động xếp lại câu từ 1 ➔ ${total} và bảo toàn đầy đủ các phương án A,B,C,D & lời giải.</div>
    `;
}

async function saveExtractedExamToBank() {
    const titleInp = document.getElementById("qbank-exam-name");
    const gradeSel = document.getElementById("qbank-exam-grade");
    
    const title = titleInp ? titleInp.value.trim() : "";
    const grade = gradeSel ? gradeSel.value : "Lop_11";
    
    if (!title) {
        alert("⚠️ Vui lòng nhập Tên đề thi mới!");
        if (titleInp) titleInp.focus();
        return;
    }
    if (qbankState.selectedQuestionIds.size === 0) {
        return alert("⚠️ Thầy chưa tích chọn câu hỏi nào ở cột giữa!");
    }

    const btn = document.getElementById("btn-save-extracted-exam");
    if (btn) {
        btn.disabled = true; 
        btn.innerText = "⏳ Đang lưu đề...";
    }

    const selectedQ = qbankState.rawQuestions
        .filter(q => qbankState.selectedQuestionIds.has(String(q.id)))
        .map((q, idx) => ({ ...q, id: idx + 1 }));

    const newExam = {
        id: "exam_bank_" + Date.now(),
        title: title, 
        grade: grade, 
        questionCount: selectedQ.length,
        createdAt: new Date().toISOString(), 
        assignedClasses: [],
        questions: selectedQ, 
        images: { ...qbankState.imagesMap }, 
        scoringConfig: { mode: "option1" }
    };

    try {
        await loadSavedExamsList(false);
        qbankState.savedExams.unshift(newExam);
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));

        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) {
            await client.from('app_key_values').upsert({ 
                key: 'qbank_saved_exams', 
                value: qbankState.savedExams 
            });
        }

        if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            const drivePath = `KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/${grade}`;
            const payload = { 
                action: "saveQuestionBankData", 
                path: drivePath, 
                filename: `${title.replace(/\s/g,'_')}.json`, 
                data: newExam 
            };
            
            fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST", 
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            }).catch(() => {});
        }

        alert(`🎉 ĐÃ LƯU ĐỀ "${title}" VÀO NGÂN HÀNG THÀNH CÔNG!`);
        closeQbankCreatorModal(); 
        openSavedExamsModal();
        
    } catch(err) {
        alert("❌ Lỗi lưu đề: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false; 
            btn.innerText = "💾 Lưu đề vào Ngân hàng"; 
        }
    }
}

// ============================================================================
// QUẢN LÝ NGÂN HÀNG ĐÃ LƯU & BỘ LỌC
// ============================================================================

async function loadSavedExamsList(doRender = true) {
    try {
        const local = localStorage.getItem("qbank_saved_exams");
        if (local) qbankState.savedExams = JSON.parse(local) || [];
    } catch(e) {}
    
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
    if (gradeVal !== "all") {
        list = list.filter(e => e.grade === gradeVal);
    }

    if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b; font-size:12px;">Chưa có đề thi nào trong phân loại này.</div>`;
        return;
    }

    container.innerHTML = list.map(exam => {
        const dateStr = exam.createdAt ? new Date(exam.createdAt).toLocaleString("vi-VN") : "---";
        const assignedTags = (exam.assignedClasses && exam.assignedClasses.length > 0)
            ? exam.assignedClasses.map(c => `<span class="exam-tag">✅ ${c}</span>`).join("")
            : `<span style="font-size:10.5px; color:#94a3b8; font-style:italic;">Chưa chuyển</span>`;

        return `
            <div class="saved-exam-item">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:14px; font-weight:900; color:#0f172a;">📑 ${exam.title}</div>
                    <div style="font-size:11.5px; color:#64748b; font-weight:600; margin-top:3px;">
                        ${exam.questionCount} câu • Khối: <b style="color:#0284c7;">${exam.grade}</b> • Tạo: ${dateStr}
                    </div>
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

// XEM TRƯỚC ĐỀ THI ĐÃ LƯU TRONG NGÂN HÀNG
function previewSavedExam(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;

    let modal = document.getElementById("modal-qbank-preview");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-qbank-preview";
        modal.className = "qbank-modal-overlay";
        modal.innerHTML = `
            <div class="qbank-modal-container" style="width: 820px; height: 85vh; max-width: 95vw;">
                <div class="qbank-header">
                    <div style="font-size: 14.5px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                        <span>👁️</span> <span id="qbank-preview-title">Xem trước đề</span>
                    </div>
                    <button onclick="document.getElementById('modal-qbank-preview').style.display='none'" style="background:none; border:none; color:#fff; font-size:20px; font-weight:900; cursor:pointer;">✕</button>
                </div>
                <div id="qbank-preview-body" style="flex:1; overflow-y:auto; padding:14px; background:#ffffff;"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById("qbank-preview-title").innerText = `📑 ${exam.title} (${exam.questionCount} câu)`;
    const body = document.getElementById("qbank-preview-body");
    const letters = ["A", "B", "C", "D"];

    let html = "";
    (exam.questions || []).forEach((q, idx) => {
        let optionsHtml = "";
        if (q.type === "multiple_choice" && Array.isArray(q.options)) {
            let cIdx = typeof q.correct === 'number' ? q.correct : letters.indexOf(String(q.correct).toUpperCase());
            optionsHtml = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                    ${q.options.map((opt, oIdx) => `
                        <div style="padding:5px 8px; border-radius:5px; border:1px solid #cbd5e1; background:${oIdx === cIdx ? '#dcfce7' : '#f8fafc'}; font-size:12px; font-weight:${oIdx === cIdx ? '800' : '600'}; color:${oIdx === cIdx ? '#15803d' : '#1e293b'};">
                            <b>${letters[oIdx]}.</b> ${opt} ${oIdx === cIdx ? '✓' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (q.type === "true_false" && Array.isArray(q.statements)) {
            optionsHtml = `
                <div style="margin-top:5px; border:1px solid #e2e8f0; border-radius:5px; padding:5px; background:#f8fafc;">
                    ${q.statements.map(st => `
                        <div style="font-size:11.5px; margin-bottom:3px; display:flex; justify-content:space-between;">
                            <span><b>${st.id})</b> ${st.statement}</span>
                            <b style="color:${st.correct ? '#16a34a' : '#dc2626'};">${st.correct ? '🟢 Đúng' : '🔴 Sai'}</b>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            optionsHtml = `
                <div style="margin-top:5px; font-size:12px; font-weight:800; color:#0d9488;">
                    🎯 Đáp số: <span style="color:#0f172a;">${q.correctAnswer || q.correct || '---'}</span>
                </div>
            `;
        }

        const expHtml = q.explanation ? `<div style="font-size:11px; color:#78350f; background:#fffbeb; padding:5px; border-radius:5px; margin-top:5px; border-left:3px solid #f59e0b;">💡 <b>Lời giải:</b> ${q.explanation}</div>` : '';

        html += `
            <div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed #cbd5e1;">
                <div style="font-size:13px; font-weight:700; color:#0f172a;">
                    <b style="color:#0284c7;">Câu ${idx + 1}:</b> ${q.question || ''}
                </div>
                ${optionsHtml}
                ${expHtml}
            </div>
        `;
    });

    body.innerHTML = html;
    modal.style.display = "flex";

    if (window.MathJax && MathJax.typesetPromise) {
        try { MathJax.typesetPromise([body]).catch(() => {}); } catch(e) {}
    }
}

// CHUYỂN THẲNG ĐỀ TRÍCH XUẤT SANG CÔNG CỤ SOI ĐỀ
function openInSoiDeFromBank(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;

    if (typeof ensureSoiDeModalInDOM === 'function') {
        ensureSoiDeModalInDOM();
    }

    if (typeof soiDeState !== 'undefined') {
        soiDeState.examData = {
            id: exam.id,
            title: exam.title,
            maDe: "101",
            timeLimitMinutes: 90,
            images: { ...(exam.images || {}) },
            questions: JSON.parse(JSON.stringify(exam.questions || [])),
            scoringConfig: { mode: "option1" }
        };

        if (typeof openSoiDeModal === 'function') {
            closeSavedExamsModal();
            openSoiDeModal();
        }
    } else {
        alert("⚠️ Không tìm thấy công cụ Soi đề trên trang này!");
    }
}

// MODAL CHUYỂN ĐỀ VÀO CÁC LỚP
function openTransferExamModal(examId) {
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
    const exam = qbankState.currentExamToTransfer;
    const checkedBoxes = Array.from(document.querySelectorAll('#transfer-class-list input:checked'));
    const checked = checkedBoxes.map(c => c.value);
    
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn ít nhất 1 lớp!");

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("❌ Chưa kết nối Supabase!");

    try {
        const quizId = "quiz_" + Date.now();
        const dateStr = new Date().toLocaleString("vi-VN");
        
        await client.from('quizzes').upsert({
            id: quizId, 
            title: exam.title, 
            made: "101", 
            time_limit_minutes: 90,
            scoring_config: exam.scoringConfig || { mode: 'option1' }, 
            questions: exam.questions, 
            images: exam.images || {}
        });

        const linkRows = checked.map(cat => ({
            id: quizId, 
            category_id: cat, 
            title: exam.title, 
            date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT", 
            is_hot: true, 
            timestamp: Date.now()
        }));
        await client.from('custom_links').insert(linkRows);

        const classNamesMap = {
            "lop-11a": "Lớp 11A", "lop-11c": "Lớp 11C", "lop-10p": "Lớp 10P", "lop-11e": "Lớp 11E",
            "them-10": "Thêm 10", "them-11": "Thêm 11", "them-12": "Thêm 12", "hsg-toan-11": "HSG Toán 11"
        };
        const newClassNames = checked.map(c => classNamesMap[c] || c);

        if (!exam.assignedClasses) exam.assignedClasses = [];
        newClassNames.forEach(c => { 
            if (!exam.assignedClasses.includes(c)) exam.assignedClasses.push(c); 
        });
        
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        await client.from('app_key_values').upsert({ key: 'qbank_saved_exams', value: qbankState.savedExams });

        alert(`🎉 ĐÃ CHUYỂN ĐỀ "${exam.title}" THÀNH CÔNG VÀO ${checked.length} LỚP!`);
        document.getElementById("modal-transfer-exam").style.display = "none";
        
        filterSavedExamsList(qbankState.savedExamFilter);
    } catch(err) { 
        alert("❌ Lỗi chuyển đề: " + err.message); 
    }
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
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA đề thi này khỏi Ngân hàng đề không?")) return;
    
    qbankState.savedExams = qbankState.savedExams.filter(e => e.id !== examId);
    localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
    
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (client) {
        client.from('app_key_values').upsert({ key: 'qbank_saved_exams', value: qbankState.savedExams });
    }
    
    filterSavedExamsList(qbankState.savedExamFilter);
}

// XUẤT CÁC HÀM RA WINDOW SCOPE
window.saveQbankDraftState = saveQbankDraftState;
window.loadQbankDraftState = loadQbankDraftState;
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

window.handleFolderNodeClick = handleFolderNodeClick;
window.setFilterByNodePart = setFilterByNodePart;
window.handleMatrixCellClick = handleMatrixCellClick;
window.clearQbankFilter = clearQbankFilter;
window.toggleHideAssignedQuestions = toggleHideAssignedQuestions;
window.toggleLeafMatrixDisplay = toggleLeafMatrixDisplay;
window.filterByGlobalPart = filterByGlobalPart;
window.filterByGlobalCell = filterByGlobalCell;

window.handleDropZoneOver = handleDropZoneOver;
window.handleDropZoneLeave = handleDropZoneLeave;
window.handleDropZoneDrop = handleDropZoneDrop;
window.assignSelectedQuestionsToMatrix = assignSelectedQuestionsToMatrix;
window.handleQuestionDragStart = handleQuestionDragStart;

window.deleteQbankQuestion = deleteQbankQuestion;
window.promptMoveQuestion = promptMoveQuestion;
window.executeMoveQbankQuestion = executeMoveQbankQuestion;

window.toggleSelectQuestion = toggleSelectQuestion;
window.triggerQBankPaste = triggerQBankPaste;
window.handleQBankImgSelect = handleQBankImgSelect;
window.deleteQBankImg = deleteQBankImg;

window.saveExtractedExamToBank = saveExtractedExamToBank;
window.filterSavedExamsList = filterSavedExamsList;
window.previewSavedExam = previewSavedExam;
window.openInSoiDeFromBank = openInSoiDeFromBank;
window.openTransferExamModal = openTransferExamModal;
window.confirmTransferExamToClasses = confirmTransferExamToClasses;
window.downloadSavedExamJson = downloadSavedExamJson;
window.deleteSavedExam = deleteSavedExam;
