// =========================================================
// FILE: ngan-hang-de.js
// NÂNG CẤP V2 (HOÀN CHỈNH 100%): 
// 1. Mặc định bỏ chọn ở tất cả các câu khi up file.
// 2. Mặc định lưu dữ liệu lên Google Drive.
// 3. Có nút đổi tên thư mục.
// 4. Ma trận kéo thả 16 ô tại thư mục con cùng nhất.
// 5. Tự động sinh ID theo đường dẫn (VD: 10.c1.b1.num1).
// 6. Sắp xếp lại bảng thống kê ma trận theo Phần 1, 2, 3, 4.
// 7. Khung dán ảnh/cắt ảnh y hệt phần Soi đề.
// 8. & 9. Nút lọc Ngân hàng đề (có Lớp HSG 11).
// =========================================================

let qbankState = {
    storageTarget: "drive", // YÊU CẦU 2: MẶC ĐỊNH LƯU GOOGLE DRIVE
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
    selectedQuestionIds: new Set(), // YÊU CẦU 1: SET RỖNG (MẶC ĐỊNH BỎ CHỌN)
    savedExams: [],
    draggedQId: null,
    imagesMap: {} // Kho ảnh cục bộ
};

const QBANK_COLOR_PALETTE = [
    "#0284c7", "#059669", "#7c3aed", "#ea580c", "#dc2626", "#0891b2", "#ca8a04", "#475569"
];

// ============================================================================
// HÀM ĐÓNG / MỞ GIAO DIỆN & MODAL
// ============================================================================

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
// CỘT 1: LOGIC CÂY THƯ MỤC & MA TRẬN KÉO THẢ TẠI LÁ
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

// YÊU CẦU 5: SINH ID PHÂN CẤP TỰ ĐỘNG DỰA TRÊN ĐƯỜNG DẪN CÂY
function generatePrefixSlug(name) {
    let s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (s.includes("lop") || s.includes("lớp")) return s.replace(/[^0-9]/g, ""); // "Lớp 10" -> "10"
    if (s.includes("chuong") || s.includes("chương")) return "c" + s.replace(/[^0-9]/g, ""); // "Chương 1" -> "c1"
    if (s.includes("bai") || s.includes("bài")) return "b" + s.replace(/[^0-9]/g, ""); // "Bài 1" -> "b1"
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

// RENDER CÂY THƯ MỤC VÀ KHUNG MA TRẬN 16 Ô (YÊU CẦU 4)
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

        // TẠO MA TRẬN 16 Ô TẠI NODE LÁ KHI ĐƯỢC CHỌN (ACTIVE)
        let matrixDropHtml = "";
        if (isLeaf && isActive) {
            // Đếm số lượng câu hỏi hiện tại đã gán vào folder này theo từng phần/mức độ
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
                <div class="leaf-matrix-container">
                    <div style="font-size:10px; color:#0369a1; font-weight:800; margin-bottom:4px; text-align:center;">📥 Kéo thả câu hỏi từ Cột Giữa vào từng ô:</div>
                    ${[1, 2, 3, 4].map(p => `
                        <div class="leaf-matrix-row">
                            <div class="leaf-matrix-lbl">P${p}</div>
                            ${['nb', 'th', 'vdt', 'vdc'].map(lvl => {
                                const lblMap = { nb: 'NB', th: 'TH', vdt: 'VD', vdc: 'VDC' };
                                return `
                                <div class="leaf-drop-zone"
                                     ondragover="handleDropZoneOver(event)" 
                                     ondragleave="handleDropZoneLeave(event)"
                                     ondrop="handleDropZoneDrop(event, '${node.id}', ${p}, '${lvl}')" 
                                     title="Kéo thả vào đây: Phần ${p} - ${lblMap[lvl]}">
                                    ${lblMap[lvl]}
                                    <b style="color:#0284c7;">(${counts[p][lvl]})</b>
                                </div>`;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // YÊU CẦU 3: CÓ NÚT ĐỔI TÊN THƯ MỤC (✏️)
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

// CÁC HÀM TƯƠNG TÁC CÂY THƯ MỤC
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
            color: QBANK_COLOR_PALETTE[0], 
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
    }
    
    saveQbankTreeData(); 
    renderQbankTree();
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


// ============================================================================
// HÀNH ĐỘNG KÉO THẢ VÀO MA TRẬN
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

    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;

    // Ép kiểu (Type) dựa trên phần được thả vào
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

    // Cập nhật mức độ và Folder cha
    q.level = level;
    q.folderId = folderId;
    
    // YÊU CẦU 5: Tự sinh ID (Ví dụ: 10.c1.b1.num1)
    const currentFolderTarget = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = currentFolderTarget ? currentFolderTarget.name : "";
    
    const countInFolder = qbankState.rawQuestions.filter(x => x.folderId === folderId).length;
    const prefix = getHierarchicalPrefix(folderId);
    
    // Gắn ID chuẩn
    q.id = `${prefix}.num${countInFolder}`; 

    // Tự động gán tích (Checked) cho câu hỏi vừa phân loại xong
    qbankState.selectedQuestionIds.add(String(q.id));

    // Cập nhật toàn bộ UI
    renderQbankTree(); 
    renderQbankQuestions(); 
    updateQbankMatrixStats();
    updateQbankBuilderStats();
}


// ============================================================================
// CỘT 2: ĐỌC FILE JSON, HIỂN THỊ CÂU HỎI VÀ UPLOAD ẢNH (YÊU CẦU 7)
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

function readQbankJsonFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            let parsed = null;
            
            try { 
                // Cố gắng parse chuẩn JSON trước
                parsed = JSON.parse(text); 
            } catch(err) {
                // Nếu là file JS chứa "const examData = ..." thì dùng Function để bóc tách
                let clean = text.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, 'return ');
                parsed = new Function(clean)();
            }
            if (!parsed) throw new Error("File không đúng cấu trúc!");

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
                q.id = q.id || `temp_up_${idx+1}`;
                if (!q.level) q.level = "nb";
            });

            qbankState.rawQuestions = rawQ;
            qbankState.selectedQuestionIds = new Set(); // YÊU CẦU 1: BỎ CHỌN TẤT CẢ

            renderQbankQuestions();
            updateQbankMatrixStats();
            updateQbankBuilderStats();
            
            alert(`✅ Đã nạp ${rawQ.length} câu hỏi.\n(Mặc định đang được bỏ chọn toàn bộ).\n\n👉 Thầy hãy nhấp kéo từng câu vào Lưới Ma Trận bên Cây thư mục để phân loại nhé!`);
        } catch(err) { 
            alert("❌ Lỗi nạp file: " + err.message); 
        }
    };
    reader.readAsText(file);
}

// YÊU CẦU 6: THỐNG KÊ MA TRẬN NHÓM THEO PHẦN 1, 2, 3, 4
function updateQbankMatrixStats() {
    const bar = document.getElementById("qbank-matrix-bar");
    if (!bar) return;

    const questions = qbankState.rawQuestions || [];
    if (questions.length === 0) {
        bar.innerHTML = `<span style="color:#64748b; font-style:italic;">Upload file JSON để xem ma trận thống kê</span>`;
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

    questions.forEach((q) => {
        const isChecked = qbankState.selectedQuestionIds.has(String(q.id));
        
        let p = q.part || 1;
        if (q.type === 'true_false') p = 2; 
        else if (q.type === 'short_answer' && q.part !== 4) p = 3;
        
        const levelText = { nb: 'Nhận biết', th: 'Thông hiểu', vdt: 'Vận dụng', vdc: 'Vận dụng cao' }[q.level || 'nb'];

        // YÊU CẦU 7: DÁN ẢNH / CHỌN TỆP CHO TỪNG CÂU HỎI
        const imgKey = q.imageKey || `img_q_${q.id}`;
        let imgUrl = q.imageUrl || qbankState.imagesMap[imgKey] || "";
        
        const uploaderHtml = `
            <div class="qbank-img-tool-zone" id="zone-qbank-${q.id}" tabindex="0" title="Bấm vào vùng này rồi ấn Ctrl+V để dán ảnh">
                <span style="font-size:11px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
                <button type="button" class="btn-qbank-img" onclick="triggerQBankPaste('${q.id}', '${imgKey}')">📋 Dán (Ctrl+V)</button>
                <input type="file" id="file-qbank-${q.id}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${q.id}', '${imgKey}')">
                <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbank-${q.id}').click()">📁 Tệp</button>
                ${imgUrl ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${q.id}', '${imgKey}')">🗑 Xóa</button>` : ''}
                <span id="status-qbank-${q.id}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
            </div>
            ${imgUrl ? `<div style="text-align:center; margin-bottom:8px;"><img src="${imgUrl}" style="max-height:160px; border-radius:6px; border:1px solid #cbd5e1;"></div>` : ''}
        `;

        // Text câu hỏi
        let bodyHtml = `<div style="font-size:13px; font-weight:600; color:#1e293b; margin-bottom:6px; line-height:1.45;">${q.question || ''}</div>`;
        
        // Thẻ hiển thị Folder gốc
        const folderTag = q.folderName ? `<span style="font-size:10px; color:#16a34a; background:#dcfce7; padding:2px 6px; border-radius:6px; border:1px solid #bbf7d0;">📁 ${q.folderName}</span>` : '';

        html += `
            <div class="qbank-q-card ${isChecked ? 'selected' : ''}" id="qbank-card-${q.id}" draggable="true" ondragstart="handleQuestionDragStart(event, '${q.id}')">
                <div class="qbank-q-header">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="qbank-q-id-badge">${q.id}</span>
                        <span style="font-size:11px; font-weight:800; color:#059669; border:1px solid #10b981; padding:2px 6px; border-radius:6px; background:#ecfdf5;">Phần ${p} • ${levelText}</span>
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
// UPLOAD & DÁN ẢNH TẠI CỘT GIỮA (YÊU CẦU 7)
// ============================================================================

function triggerQBankPaste(qId, imgKey) {
    const zone = document.getElementById(`zone-qbank-${qId}`);
    if (zone) zone.focus();
    alert(`📋 Thầy hãy nhấn phím Ctrl + V (hoặc Cmd + V) để dán ảnh vào câu này nhé!`);
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
        stEl.innerText = "⏳ Đang tải lên..."; 
    }

    try {
        const reader = new FileReader();
        const b64 = await new Promise((res, rej) => {
            reader.onload = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

        let directUrl = "";
        
        // Cố gắng up ImgBB nếu có cấu hình
        if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_")) {
            let fd = new FormData(); 
            fd.append("image", b64);
            let r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd }).then(x=>x.json());
            if (r && r.data) directUrl = r.data.display_url || r.data.url;
        }

        // Nếu lỗi ImgBB thì up sang Google Drive GAS
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
            }).then(x=>x.json());
            
            if (r && r.fileUrl) {
                directUrl = (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(r.fileUrl) : r.fileUrl;
            }
        }

        // Bất đắc dĩ lưu Base64 nguyên thủy
        if (!directUrl) {
            directUrl = `data:${file.type};base64,${b64}`;
        }

        qbankState.imagesMap[imgKey] = directUrl;
        
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        if (q) { 
            q.imageUrl = directUrl; 
            q.imageKey = imgKey; 
        }

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
    
    renderQbankQuestions();
}


// ============================================================================
// CỘT 3: TRÍCH XUẤT ĐỀ THI
// ============================================================================

function updateQbankBuilderStats() {
    const container = document.getElementById("qbank-builder-stats");
    if (!container) return;

    const total = qbankState.selectedQuestionIds.size;
    if (total === 0) {
        container.innerHTML = `<p style="color:#64748b; font-style:italic;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>`;
        return;
    }
    
    container.innerHTML = `<div style="font-weight:900; color:#10b981; font-size:14px;">🎯 Tổng số câu trích xuất: ${total} câu</div>`;
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
        return alert("⚠️ Bạn chưa tích chọn câu hỏi nào ở cột giữa!");
    }

    const btn = document.getElementById("btn-save-extracted-exam");
    if (btn) {
        btn.disabled = true; 
        btn.innerText = "⏳ Đang lưu...";
    }

    // Trích xuất các câu đã chọn và set lại id chạy từ 1 -> N
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
        images: qbankState.imagesMap, 
        scoringConfig: { mode: "option1" }
    };

    try {
        loadSavedExamsList(false);
        qbankState.savedExams.unshift(newExam);
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));

        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) {
            await client.from('app_key_values').upsert({ 
                key: 'qbank_saved_exams', 
                value: qbankState.savedExams 
            });
        }

        // YÊU CẦU 2: LƯU TỰ ĐỘNG LÊN DRIVE QUA GAS NẾU CHỌN STORAGE NÀY
        if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined") {
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
// QUẢN LÝ NGÂN HÀNG ĐÃ LƯU & BỘ LỌC (YÊU CẦU 8 & 9)
// ============================================================================

async function loadSavedExamsList(doRender = true) {
    try {
        const local = localStorage.getItem("qbank_saved_exams");
        if (local) qbankState.savedExams = JSON.parse(local) || [];
    } catch(e) {}
    
    // Đọc từ Cloud Supabase
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
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Chưa có đề thi nào trong phân loại này.</div>`;
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
        <div class="qbank-modal-container" style="width:480px; height:auto; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:12px;">
                <h3 style="font-size:15px; font-weight:900; color:#0284c7;">🚀 CHUYỂN ĐỀ SANG LỚP</h3>
                <button onclick="document.getElementById('modal-transfer-exam').style.display='none'" style="background:none; border:none; font-size:18px; font-weight:900; cursor:pointer;">✕</button>
            </div>
            <div style="font-size:12.5px; font-weight:700; color:#1e293b; margin-bottom:10px;" id="transfer-exam-title">...</div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;" id="transfer-class-list">
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-11a"> <span>🏫 Lớp 11A</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-11c"> <span>🏫 Lớp 11C</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-10p"> <span>🏫 Lớp 10P</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="lop-11e"> <span>🏫 Lớp 11E</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="them-10"> <span>📐 Thêm 10</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="them-11" checked> <span>✍️ Thêm 11</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="them-12"> <span>🎓 Thêm 12</span></label>
                <label class="cat-checkbox-item"><input type="checkbox" value="hsg-toan-11"> <span>🏆 HSG Toán 11</span></label>
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
    const checkedBoxes = Array.from(document.querySelectorAll('#transfer-class-list input:checked'));
    const checked = checkedBoxes.map(c => c.value);
    
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn ít nhất 1 lớp!");

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("❌ Chưa kết nối Supabase!");

    try {
        const quizId = "quiz_" + Date.now();
        const dateStr = new Date().toLocaleString("vi-VN");
        
        // 1. Lưu cấu trúc đề
        await client.from('quizzes').upsert({
            id: quizId, 
            title: exam.title, 
            made: "101", 
            time_limit_minutes: 90,
            scoring_config: exam.scoringConfig || { mode: 'option1' }, 
            questions: exam.questions, 
            images: exam.images
        });

        // 2. Tạo link cho từng lớp
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

        // 3. Ghi vết đã chuyển
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

// BỘC LỘ HÀM GỌI RA GLOBAL SCOPE CHO HTML SỬ DỤNG
window.toggleQbankMenu = toggleQbankMenu;
window.openQbankCreatorModal = openQbankCreatorModal;
window.closeQbankCreatorModal = closeQbankCreatorModal;
window.openSavedExamsModal = openSavedExamsModal;
window.closeSavedExamsModal = closeSavedExamsModal;
window.toggleStorageLocation = toggleStorageLocation;
window.triggerQbankUpload = triggerQbankUpload;

// Cây thư mục
window.promptRenameFolder = promptRenameFolder;
window.promptAddRootFolder = promptAddRootFolder;
window.promptAddChildFolder = promptAddChildFolder;
window.promptChangeFolderColor = promptChangeFolderColor;
window.promptDeleteFolder = promptDeleteFolder;
window.selectQbankFolder = selectQbankFolder;

// Kéo thả
window.handleDropZoneOver = handleDropZoneOver;
window.handleDropZoneLeave = handleDropZoneLeave;
window.handleDropZoneDrop = handleDropZoneDrop;
window.handleQuestionDragStart = handleQuestionDragStart;

// Checkbox
window.toggleSelectQuestion = toggleSelectQuestion;

// Xử lý ảnh
window.triggerQBankPaste = triggerQBankPaste;
window.handleQBankImgSelect = handleQBankImgSelect;
window.deleteQBankImg = deleteQBankImg;

// Các Modal & Trích xuất
window.saveExtractedExamToBank = saveExtractedExamToBank;
window.filterSavedExamsList = filterSavedExamsList;
window.openTransferExamModal = openTransferExamModal;
window.confirmTransferExamToClasses = confirmTransferExamToClasses;
window.downloadSavedExamJson = downloadSavedExamJson;
window.deleteSavedExam = deleteSavedExam;
--- START OF FILE text/html ---

<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    
    <title>Kho đề thi & tài liệu trực tuyến</title>
    <!-- FAVICON Chữ P nghệ thuật -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='neonFlow' x1='0%25' y1='100%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%2300E5FF'/%3E%3Cstop offset='25%25' stop-color='%2310B981'/%3E%3Cstop offset='50%25' stop-color='%23FFEA00'/%3E%3Cstop offset='75%25' stop-color='%23FF007F'/%3E%3Cstop offset='100%25' stop-color='%238B5CF6'/%3E%3C/linearGradient%3E%3Cfilter id='glow' x='-20%25' y='-20%25' width='140%25' height='140%25'%3E%3CfeDropShadow dx='0' dy='2' stdDeviation='3' flood-color='%23FF007F' flood-opacity='0.6'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100' height='100' rx='24' fill='%230f172a' stroke='%23334155' stroke-width='2'/%3E%3Cpath d='M28,82 C34,80 32,50 33,28 C33,18 48,12 66,16 C82,20 84,40 68,52 C52,61 32,54 32,54' fill='none' stroke='url(%23neonFlow)' stroke-width='13' stroke-linecap='round' stroke-linejoin='round' filter='url(%23glow)'/%3E%3Cpath d='M25,82 Q32,80 35,76' fill='none' stroke='%2300E5FF' stroke-width='8' stroke-linecap='round'/%3E%3Cpath d='M72,20 L74,25 L79,27 L74,29 L72,34 L70,29 L65,27 L70,25 Z' fill='%23FFFFFF' opacity='0.95'/%3E%3Cpath d='M30,34 L31,37 L34,38 L31,39 L30,42 L29,39 L26,38 L29,37 Z' fill='%23FFEA00' opacity='0.9'/%3E%3Ccircle cx='76' cy='46' r='2.5' fill='%23FFFFFF' opacity='0.8'/%3E%3C/svg%3E">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="style-base.css">
    <link rel="stylesheet" href="style-modals.css">

    <!-- CSS NGÂN HÀNG ĐỀ & BIÊN SOẠN MA TRẬN 3 CỘT -->
    <link rel="stylesheet" href="ngan-hang-de.css">

    <style>
        .btn-upload-json-backup {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            border: none;
            border-radius: 20px;
            padding: 8px 14px;
            font-size: 12.5px;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
            transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.16s ease, filter 0.16s ease;
            user-select: none;
            white-space: nowrap;
        }
        .btn-upload-json-backup:hover {
            transform: translateY(-1px);
            filter: brightness(1.08);
            box-shadow: 0 6px 14px rgba(2, 132, 199, 0.4);
        }
        .btn-upload-json-backup:active {
            transform: translateY(2px) scale(0.95) !important;
            box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.3) !important;
            filter: brightness(0.92);
        }

        .btn-auto-collect-drafts {
            background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
            color: #ffffff;
            border: none;
            border-radius: 20px;
            padding: 8px 14px;
            font-size: 12.5px;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 10px rgba(13, 148, 136, 0.3);
            transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.16s ease, filter 0.16s ease;
            user-select: none;
            white-space: nowrap;
        }
        .btn-auto-collect-drafts:hover {
            transform: translateY(-1px);
            filter: brightness(1.08);
            box-shadow: 0 6px 14px rgba(13, 148, 136, 0.45);
        }
        .btn-auto-collect-drafts:active {
            transform: translateY(2px) scale(0.95) !important;
            box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.3) !important;
            filter: brightness(0.92);
        }

        .btn-open-file-explorer {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 5px 11px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 2px 6px rgba(2, 132, 199, 0.32);
            transition: all 0.15s ease;
            text-decoration: none;
        }
        .btn-open-file-explorer:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(2, 132, 199, 0.4);
        }
        .btn-open-file-explorer:active {
            transform: translateY(2px) scale(0.96);
        }

        .btn-admin-header-tool {
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 5px 11px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: all 0.15s ease;
            user-select: none;
        }
        .btn-admin-header-tool:hover {
            filter: brightness(1.12);
            transform: translateY(-1px);
        }
        .btn-admin-header-tool:active {
            transform: translateY(2px) scale(0.96);
        }

        .btn-cat-quick {
            background: #ffffff;
            border: 1.2px solid #cbd5e1;
            color: #334155;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: 0.15s;
        }
        .btn-cat-quick:hover {
            background: #f1f5f9;
            border-color: #94a3b8;
            color: #0f172a;
        }
        .cat-quick-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
        }

        .mini-switch {
            cursor: pointer;
            user-select: none;
            position: relative;
            display: inline-block;
            width: 32px !important;
            height: 18px !important;
            margin: 0 2px !important;
        }
        .mini-switch input[type="checkbox"] {
            position: absolute;
            opacity: 0;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            margin: 0;
            cursor: pointer;
            z-index: 5;
            pointer-events: auto !important;
        }
        .mini-switch .slider-toggle {
            pointer-events: none;
        }

        @media (max-width: 640px) {
            .btn-upload-json-backup, .btn-auto-collect-drafts {
                font-size: 11px !important;
                padding: 6px 10px !important;
            }
        }

        @supports (-webkit-touch-callout: none) {
            input[type="text"],
            input[type="password"],
            input[type="number"],
            .st-input-field,
            .auth-input,
            .tuluan-search-box {
                font-size: 16px !important;
            }
            .move-modal-overlay,
            .result-fullscreen-modal,
            .visit-stats-modal-overlay,
            .dantri-article-modal,
            .tuluan-lightbox-overlay,
            .qbank-modal-overlay {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                background: rgba(15, 23, 42, 0.95) !important;
            }
            .student-login-box,
            .auth-container,
            .admin-popover-panel,
            .tuluan-modal-card,
            .qbank-modal-container {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                background: #ffffff !important;
                transform: translateZ(0); 
            }
        }
    </style>

    <!-- Thư viện SheetJS xuất Excel .xlsx -->
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <script>
        window.MathJax = { 
            tex: { 
                inlineMath: [['$', '$'], ['\\(', '\\)']], 
                displayMath: [['$$', '$$'], ['\\[', '\\]']], 
                processEscapes: true 
            },
            svg: {
                scale: 1.05,
                displayAlign: 'center',
                fontCache: 'global'
            },
            options: { 
                enableMenu: false 
            } 
        };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

    <script src="accounts-data.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    <!-- CÁC MODULE JAVASCRIPT -->
    <script src="app-config.js"></script>
    <script src="app-utils.js"></script>
    <script src="portal-exam-scoring.js"></script>
    <script src="portal-analytics.js"></script>
    <script src="student-exam-flow.js"></script>
    <script src="portal-auth.js"></script>
    <script src="portal-admin.js"></script>
    <script src="portal-db-cleanup.js"></script>
    <script src="portal-results-core.js"></script>
    <script src="portal-results-table.js"></script>
    <script src="portal-results-stats.js"></script>
    <script src="portal-results-regrade.js"></script>
    <script src="portal-tuluan-core.js"></script>
    <script src="portal-tuluan-admin.js"></script>
    <script src="portal-tuluan-upload.js"></script>
    <script src="portal-tuluan-table.js"></script>
    <script src="portal-tuluan-lightbox.js"></script>
    <script src="portal-ui-core.js"></script>
    <script src="portal-ui-cards.js"></script>
    <script src="portal-ui-article.js"></script>
    <script src="portal-exam-printer.js"></script>
    <script src="portal-soi-de.js"></script>

    <!-- JS NGÂN HÀNG ĐỀ & BIÊN SOẠN MA TRẬN 3 CỘT -->
    <script src="ngan-hang-de.js"></script>
</head>
<body>

<div class="mid-autumn-badge" title="Tết Trung Thu Vui Vẻ - Đêm Hội Trăng Rằm! 🏮">
    <div class="lantern-stick"></div>
    <div class="lantern-string"></div>
    <span class="mid-autumn-icon">🏮</span>
</div>

<div class="site-visit-badge" id="site-visit-badge" onclick="toggleVisitStatsModal(event)" title="Nhấn để xem chi tiết thống kê lượt truy cập">
    <div class="visit-pulse-dot"></div>
    <span class="visit-icon">👁️</span>
    <span class="visit-label">Hôm nay:</span>
    <b class="visit-number" id="visit-today-count">...</b>
    <span class="visit-arrow">📈</span>
</div>

<div class="container" id="app">
    <div class="top-banner-box">
        <div class="top-banner-img-wrap">
            <img id="top-banner-img" class="top-banner-img" src="" alt="Banner Top">
            <div class="banner-overlay"></div>
        </div>
        <img id="web-avatar-img" class="banner-avatar" src="" alt="Avatar Web">
        <div class="banner-title">Kho đề thi & tài liệu trực tuyến (main)</div>
        <div class="banner-rocket">🚀</div>
        <div class="banner-watermark">Obahoan</div>
        
        <div class="admin-controls-wrapper">
            <div class="auth-container" id="auth-container">
                <div class="auth-input-wrapper">
                    <input type="password" id="admin-pass-input" class="auth-input" placeholder="Mật khẩu..." onkeypress="handleEnter(event)" autocorrect="off" autocapitalize="none">
                    <button type="button" class="eye-toggle-btn" id="eye-toggle-btn" onclick="togglePasswordVisibility()" title="Hiện/Ẩn">👁️</button>
                </div>
                <select id="admin-expiry-select" class="admin-duration-select" title="Thời gian duy trì trạng thái đăng nhập">
                    <option value="1h">1 giờ</option>
                    <option value="2h">2 giờ</option>
                    <option value="4h">4 giờ</option>
                    <option value="8h">8 giờ</option>
                    <option value="1d" selected>1 ngày</option>
                    <option value="3d">3 ngày</option>
                    <option value="7d">7 ngày</option>
                    <option value="30d">30 ngày</option>
                </select>
                <button class="auth-btn" onclick="checkAdminPassword()">VÀO</button>
            </div>
            
            <!-- NÚT TẠO CÂU HỎI & TRÍCH ĐỀ (THIẾT KẾ ĐÚNG ICON XẾP LỚP TRÊN ẢNH CHỤP) -->
            <div class="qbank-dropdown-wrapper" style="position:relative; z-index:99999;">
                <button type="button" class="qbank-trigger-btn" id="qbank-btn" onclick="toggleQbankMenu(event)" title="Tạo câu hỏi & Trích đề">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2.5" y="7.5" width="13" height="13" rx="2" fill="#38BDF8" stroke="#ffffff" stroke-width="1.2"/>
                        <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="#EC4899" stroke="#ffffff" stroke-width="1.2"/>
                        <rect x="8.5" y="3.5" width="13" height="13" rx="2" fill="#FACC15" stroke="#ffffff" stroke-width="1.2"/>
                    </svg>
                </button>
                <div class="qbank-dropdown" id="qbank-dropdown-menu">
                    <div class="qbank-dropdown-item" onclick="openQbankCreatorModal()">
                        <span>📥</span> 
                        <div>
                            Tạo câu hỏi từ file JSON
                            <br><small style="color:#64748b;font-size:10.5px;font-weight:600;">Soạn thảo, phân loại ma trận 4 mức độ</small>
                        </div>
                    </div>
                    <div class="qbank-dropdown-item" onclick="openSavedExamsModal()">
                        <span>🏦</span> 
                        <div>
                            Ngân hàng đề (Đã lưu)
                            <br><small style="color:#64748b;font-size:10.5px;font-weight:600;">Quản lý và chuyển đề sang lớp</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="admin-gear-btn" id="gear-btn" onclick="toggleAdminPanel(event)" title="Quản trị viên">⚙️</div>

            <div class="admin-popover-panel" id="admin-popover-panel">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 6px; flex-wrap: wrap;">
                    <div class="admin-popover-title" style="margin-bottom: 0;">🚀 Bảng Điều Khiển Quản Trị</div>
                    <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn-admin-header-tool" onclick="changeAdminPassword(event)" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 2px 6px rgba(245, 158, 11, 0.32);">🔑 Đổi MK</button>
                        <a href="./admin-files.html" target="_blank" class="btn-open-file-explorer" title="Mở trang quản lý tệp và cấu trúc thư mục Supabase như Windows Explorer">
                            📂 Quản lý tệp
                        </a>
                        <button type="button" class="btn-admin-header-tool" onclick="openRealtimeConfigModal(event)" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); box-shadow: 0 2px 6px rgba(2, 132, 199, 0.32);" title="Bật/tắt các kênh kết nối Realtime & điều chỉnh tần suất Ping để tiết kiệm băng thông">
                            📡 Chỉnh lắng nghe
                        </button>
                        <button type="button" class="admin-logout-btn" onclick="logoutAdmin(event)" title="Khóa quyền quản trị ngay lập tức">🔒 Khóa lại</button>
                    </div>
                </div>

                <div class="admin-redirect-control-box">
                    <div class="admin-redirect-toggle-row">
                        <span class="admin-redirect-title" onclick="document.getElementById('admin-redirect-toggle').click();" style="cursor: pointer;">
                            <span>🔀</span> <b>Tự chuyển sang Web dự phòng:</b>
                        </span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label class="mini-switch" for="admin-redirect-toggle" title="Gạt để Bật/Tắt chuyển hướng">
                                <input type="checkbox" id="admin-redirect-toggle" onchange="handleSiteRedirectToggle(this.checked)">
                                <span class="slider-toggle"></span>
                            </label>
                            <b id="admin-redirect-status-txt" style="font-size: 11px; color: #64748b; white-space: nowrap; cursor: pointer;" onclick="document.getElementById('admin-redirect-toggle').click();">TẮT</b>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 6px;">
                        <input type="text" id="admin-redirect-url-input" placeholder="https://obahoan2026.vercel.app/" style="flex:1; padding: 5px 8px; font-size: 11.5px; border: 1.2px solid #cbd5e1; border-radius: 7px; outline: none; background: #fff;">
                        <button type="button" onclick="saveSiteRedirectUrl()" style="background: #0284c7; color:#fff; border:none; border-radius:7px; padding:5px 10px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap; box-shadow: 0 2px 5px rgba(2, 132, 199, 0.3);">Lưu link</button>
                    </div>
                    <div class="admin-redirect-subhint">
                        💡 <b>BẬT:</b> Học sinh ấn vào web này sẽ tự động chuyển sang link dự phòng trên. Thầy là Admin được giữ lại trang chính an toàn 100%.
                    </div>
                </div>

                <div class="admin-section-card">
                    <div class="admin-input-group" style="margin-bottom: 0;">
                        <div class="cat-quick-actions">
                            <label style="margin-bottom:0; font-size: 12px; color: #0f172a;">🏫 Lớp / Chuyên mục đăng vào:</label>
                            <div style="display:flex; gap:5px; align-items:center;">
                                <button type="button" class="btn-cat-quick" onclick="toggleAllAdminCategories(true)">Tất cả</button>
                                <button type="button" class="btn-cat-quick" onclick="toggleAllAdminCategories(false)">Bỏ chọn</button>
                                <button type="button" class="btn-cat-quick btn-soi-de" onclick="openSoiDeModal(event)" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: 1px solid #34d399; font-weight: 900; margin-left: 2px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35);">
                                    🔍 Soi đề
                                </button>
                            </div>
                        </div>
                        <div class="category-checkbox-grid" id="admin-category-checkbox-list">
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="lop-11a" onchange="handleCatCheckboxChange(this)">
                                <span>🏫 Lớp 11A</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="lop-11c" onchange="handleCatCheckboxChange(this)">
                                <span>🏫 Lớp 11C</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="lop-10p" onchange="handleCatCheckboxChange(this)">
                                <span>🏫 Lớp 10P</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="lop-11e" onchange="handleCatCheckboxChange(this)">
                                <span>🏫 Lớp 11E</span>
                            </label>
                            <label class="cat-checkbox-item checked">
                                <input type="checkbox" name="admin-cat-checkbox" value="them-11" checked onchange="handleCatCheckboxChange(this)">
                                <span>✍️ Thêm 11</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="them-10" onchange="handleCatCheckboxChange(this)">
                                <span>📐 Thêm 10</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="them-12" onchange="handleCatCheckboxChange(this)">
                                <span>🎓 Thêm 12</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="hsg-toan-11" onchange="handleCatCheckboxChange(this)">
                                <span>🏆 HSG Toán 11</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="kho-tai-lieu" onchange="handleCatCheckboxChange(this)">
                                <span>📚 Kho tài liệu</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="nhac-nho" onchange="handleCatCheckboxChange(this)">
                                <span>📌 Nhắc nhở</span>
                            </label>
                            <label class="cat-checkbox-item">
                                <input type="checkbox" name="admin-cat-checkbox" value="tu-luan-padlet" onchange="handleCatCheckboxChange(this)">
                                <span>💜 Nộp Padlet</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="admin-section-card">
                    <div class="admin-input-group" style="margin-bottom: 0;">
                        <label style="font-size: 12px; color: #0f172a;">🎨 Chọn icon đại diện:</label>
                        <div class="avatar-picker-grid" id="avatar-grid"></div>
                    </div>
                </div>

                <div class="admin-section-card">
                    <div class="admin-tabs">
                        <button class="admin-tab-btn active" id="tab-btn-quiz" onclick="switchAdminTab('quiz')">📝 Đề thi (JS)</button>
                        <button class="admin-tab-btn" id="tab-btn-drive" onclick="switchAdminTab('drive')">📤 Tải PDF/Word/Ảnh</button>
                        <button class="admin-tab-btn" id="tab-btn-doc" onclick="switchAdminTab('doc')">🔗 Link web</button>
                    </div>

                    <div id="admin-tab-quiz">
                        <div class="admin-input-group">
                            <label>Đặt tên đề thi (để trống sẽ tự lấy tên trong file questions):</label>
                            <input type="text" id="admin-quiz-custom-title" placeholder="VD: ĐỀ 101 GIỮA HỌC KỲ I TOÁN 11...">
                        </div>
                        <div class="admin-input-group">
                            <label>Tải lên file câu hỏi đề thi (questions.js / .txt / .json):</label>
                            <input type="file" id="admin-file-upload" accept="*/*">
                        </div>
                        <div class="admin-input-group">
                            <label>Tải lên file đáp án & giải thích (dapan.js / .txt / .json - nếu tách riêng):</label>
                            <input type="file" id="admin-answer-file-upload" accept="*/*">
                            <div style="font-size:11.5px; color:#64748b; margin-top:4px; font-style:italic;">
                                * Nếu file đề questions đã có sẵn đáp án thì có thể để trống ô này.
                            </div>
                        </div>
                        <div class="admin-btn-row">
                            <button class="btn-admin btn-cancel" onclick="closeAdminPanel()">Thoát</button>
                            <button class="btn-admin btn-submit" id="btn-create-quiz" onclick="processUpload()">✨ Đăng đề thi</button>
                        </div>
                    </div>

                    <div id="admin-tab-drive" style="display: none;">
                        <div class="admin-input-group">
                            <label>Chọn file PDF / Word / Ảnh / Excel từ máy tính:</label>
                            <input type="file" id="admin-drive-file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onchange="autoFillDriveTitle(this)">
                        </div>
                        <div class="admin-input-group">
                            <label>Tên hiển thị tài liệu (để trống sẽ tự lấy tên file):</label>
                            <input type="text" id="admin-drive-title" placeholder="VD: Đề cương ôn tập Toán 11 GK1, Ảnh bảng công thức...">
                        </div>
                        <div id="drive-upload-status" style="display: none; margin-bottom: 10px; font-size: 12.5px; font-weight: 700; color: #0284c7; text-align: center;"></div>
                        <div class="admin-btn-row">
                            <button class="btn-admin btn-cancel" onclick="closeAdminPanel()">Thoát</button>
                            <button class="btn-admin btn-submit" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);" id="btn-upload-drive" onclick="processUploadToGoogleDrive()">📤 Tải lên Drive</button>
                        </div>
                    </div>

                    <div id="admin-tab-doc" style="display: none;">
                        <div class="admin-input-group">
                            <label>Tên tài liệu / Video:</label>
                            <input type="text" id="admin-doc-title" placeholder="VD: File ôn tập, Video bài giảng...">
                        </div>
                        <div class="admin-input-group">
                            <label>Link gốc (Google Drive, Youtube...):</label>
                            <input type="text" id="admin-doc-url" placeholder="Dán đường link vào đây...">
                        </div>
                        <div class="admin-btn-row">
                            <button class="btn-admin btn-cancel" onclick="closeAdminPanel()">Thoát</button>
                            <button class="btn-admin btn-submit" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);" id="btn-create-doc" onclick="processAddDocument()">🔗 Đăng tài liệu</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- KHỐI DÂN TRÍ NAVIGATION -->
    <div class="dantri-nav-container">
        <div class="dantri-scroll-bar" id="dantri-nav-bar"></div>
        <div class="dantri-dropdown-panel" id="dantri-dropdown-panel">
            <div class="dantri-sub-header" id="dantri-sub-title">📌 Tin tức nổi bật</div>
            <div id="dantri-news-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>
    </div>

    <!-- KHỐI BẢN TIN THƯỜNG NGÀY & NHẮC NHỞ -->
    <div class="reminder-section" id="reminder-main-card">
        <div class="reminder-header-row-box">
            <h3 class="reminder-header-title" id="reminder-section-title-text">📌 Nhắc nhở quan trọng</h3>
            <button type="button" class="btn-edit-reminder-head" id="btn-edit-reminder-head" onclick="editReminderSectionTitle(event)" title="Sửa tiêu đề 'Nhắc nhở quan trọng'">
                ✏️ Sửa tiêu đề
            </button>
        </div>
        <div class="link-list" style="padding:0; background:transparent;" id="reminder-container"></div>
    </div>

    <!-- CÁC LỚP DẠY THÊM -->
    <div class="section-header-title red-title">🔴 Các lớp dạy thêm</div>
    <div class="dantri-nav-container">
        <div class="full-width-nav-row" id="daythem-nav-bar"></div>
        <div class="dantri-dropdown-panel" id="daythem-dropdown-panel">
            <div class="link-list" id="daythem-links-container"></div>
        </div>
    </div>

    <!-- CÁC LỚP CHÍNH KHÓA -->
    <div class="section-header-title blue-title">🔵 Các lớp chính khóa</div>
    <div class="dantri-nav-container">
        <div class="full-width-nav-row" id="chinhkhoa-row1-bar"></div>
        <div class="dantri-dropdown-panel" id="chinhkhoa-row1-dropdown">
            <div class="link-list" id="chinhkhoa-row1-links"></div>
        </div>

        <div class="full-width-nav-row" id="chinhkhoa-row2-bar"></div>
        <div class="dantri-dropdown-panel" id="chinhkhoa-row2-dropdown">
            <div class="link-list" id="chinhkhoa-row2-links"></div>
        </div>
    </div>

    <!-- KHO TÀI LIỆU -->
    <div id="kho-tai-lieu-container"></div>

    <!-- BẢNG TIN DẶN DÒ -->
    <div class="news-section">
        <h3 class="news-header-title">📋 Bảng tin & dặn dò từ thầy giáo</h3>
        <div id="news-container"></div>
    </div>

    <!-- BANNER DƯỚI -->
    <div class="bottom-banner-box">
        <img id="bottom-banner-img" class="bottom-banner-img" src="" alt="Banner Bottom">
    </div>

    <footer>Copyright &copy; 2026 Phạm Công Hoan</footer>
</div>

<!-- ======================================================== -->
<!-- CÁC CỬA SỔ MODAL TIỆN ÍCH HỆ THỐNG -->
<!-- ======================================================== -->

<!-- 1. MODAL BÀI BÁO PHONG CÁCH DÂN TRÍ -->
<div class="dantri-article-modal" id="dantri-article-modal">
    <div class="dantri-article-card" onclick="event.stopPropagation()">
        <div class="dantri-modal-top-bar">
            <div class="dantri-tag-pill" id="dantri-modal-tag">THÔNG BÁO</div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="dantri-btn-mode-toggle" id="btn-toggle-article-edit" onclick="toggleArticleEditMode(event)" style="display: none;">✏️ Chỉnh sửa</button>
                <button type="button" class="dantri-btn-close" onclick="closeArticleModal(event)">✕</button>
            </div>
        </div>

        <div id="dantri-article-view-mode">
            <h1 class="dantri-view-title" id="article-view-title">Lưu ý quan trọng</h1>
            <div class="dantri-author-meta-bar">
                <span class="dantri-author-name" id="article-view-author">Thầy Hoan</span>
                <span class="dantri-meta-dot">•</span>
                <span class="dantri-meta-time" id="article-view-time">--:--</span>
            </div>
            <div class="dantri-sapo-text" id="article-view-sapo">
                (Dân trí) - Thông báo quan trọng gửi tới toàn thể học sinh.
            </div>
            <div class="dantri-main-img-box" id="article-view-img-box" style="display:none;">
                <img id="article-view-img" src="" alt="Ảnh bài báo">
                <div class="dantri-img-caption" id="article-view-caption">Ảnh minh họa</div>
            </div>
            <div class="dantri-body-content" id="article-view-body">
                Nội dung bài viết thông báo...
            </div>
        </div>

        <div id="dantri-article-edit-mode" style="display: none;">
            <div class="article-edit-input-group">
                <label>Tiêu đề bài viết:</label>
                <input type="text" id="edit-article-title" placeholder="Nhập tiêu đề bài báo...">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="article-edit-input-group">
                    <label>Tác giả (nhập tay):</label>
                    <input type="text" id="edit-article-author" placeholder="VD: Thầy Hoan, Ban Giám Hiệu...">
                </div>
                <div class="article-edit-input-group">
                    <label>Thời gian hệ thống:</label>
                    <input type="text" id="edit-article-time" readonly style="background:#f1f5f9; cursor:not-allowed;">
                </div>
            </div>
            <div class="article-edit-input-group">
                <label>Đoạn tóm tắt mở đầu (Sapo):</label>
                <textarea id="edit-article-sapo" rows="2" placeholder="Tóm tắt ngắn gọn bài viết..."></textarea>
            </div>
            <div class="article-edit-input-group" style="background: #f8fafc; padding: 12px; border-radius: 12px; border: 1.5px dashed #cbd5e1;">
                <label>🖼️ Ảnh đại diện bài viết (Tải lên tự lưu Google Drive):</label>
                <input type="file" id="edit-article-file-upload" accept="image/*" onchange="uploadArticleImageToDrive(this)">
                <div id="article-img-upload-status" style="display:none; font-size:12px; font-weight:700; color:#0284c7; margin-top:5px;"></div>
                <div class="article-edit-preview-box" id="article-edit-preview-box">
                    <img id="article-edit-preview-img" src="" alt="Xem trước ảnh">
                </div>
                <input type="text" id="edit-article-img-url" placeholder="Hoặc dán trực tiếp đường link ảnh..." style="margin-top:6px;">
                <input type="text" id="edit-article-img-caption" placeholder="Chú thích ảnh (nếu có)..." style="margin-top:6px;">
            </div>
            <div class="article-edit-input-group">
                <label>Nội dung chi tiết bài viết:</label>
                <textarea id="edit-article-body" rows="6" placeholder="Nhập toàn bộ nội dung bài viết dặn dò tại đây..."></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 14px;">
                <button type="button" class="btn-admin btn-cancel" onclick="cancelArticleEdit(event)">Hủy bỏ</button>
                <button type="button" class="btn-admin btn-submit" id="btn-save-article-firebase" onclick="saveArticleToFirebase(event)">💾 Lưu bài viết lên hệ thống</button>
            </div>
        </div>
    </div>
</div>

<!-- 2. MODAL THỐNG KÊ LƯỢT TRUY CẬP -->
<div class="visit-stats-modal-overlay" id="visit-stats-modal" onclick="if(event.target===this) closeVisitStatsModal(event);">
    <div class="visit-stats-modal-box" onclick="event.stopPropagation();">
        <div class="visit-modal-header">
            <div class="visit-modal-title">
                <span class="vm-icon">📊</span>
                <div>
                    <h3 style="margin:0; font-size:16px; font-weight:900; color:#0f172a;">Thống Kê Lượt Truy Cập</h3>
                    <p style="margin:2px 0 0 0; font-size:12px; color:#64748b; font-weight:600;">Hệ thống tự động theo dõi theo thời gian thực</p>
                </div>
            </div>
            <button type="button" class="btn-close-visit-modal" onclick="closeVisitStatsModal(event)">✕</button>
        </div>

        <div class="visit-kpi-grid">
            <div class="visit-kpi-card kpi-today">
                <div class="kpi-label">Hôm nay</div>
                <div class="kpi-val" id="kpi-visit-today">0</div>
                <div class="kpi-sub">Lượt xem trang</div>
            </div>
            <div class="visit-kpi-card kpi-yesterday">
                <div class="kpi-label">Hôm qua</div>
                <div class="kpi-val" id="kpi-visit-yesterday">0</div>
                <div class="kpi-sub">Lượt xem trang</div>
            </div>
            <div class="visit-kpi-card kpi-week">
                <div class="kpi-label">7 ngày qua</div>
                <div class="kpi-val" id="kpi-visit-7days">0</div>
                <div class="kpi-sub">Tổng trong tuần</div>
            </div>
            <div class="visit-kpi-card kpi-total">
                <div class="kpi-label">Tổng truy cập</div>
                <div class="kpi-val" id="kpi-visit-alltime">0</div>
                <div class="kpi-sub">Toàn thời gian</div>
            </div>
        </div>

        <div class="visit-tabs-row">
            <button type="button" class="visit-tab-btn active" id="tab-btn-hours" onclick="switchVisitStatsTab('hours')">⏱ Theo giờ hôm nay</button>
            <button type="button" class="visit-tab-btn" id="tab-btn-week" onclick="switchVisitStatsTab('week')">📅 Theo 7 ngày trong tuần</button>
        </div>

        <div id="visit-tab-content-hours" class="visit-tab-content" style="display:block;">
            <div class="chart-header-hint">
                <span>🕒 Phân bổ lượt truy cập 24 giờ ngày hôm nay:</span>
                <span id="current-hour-badge" style="font-weight:800; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:12px; font-size:11.5px;">--:--</span>
            </div>
            <div class="hourly-bars-scroll-container" id="hourly-bars-container"></div>
        </div>

        <div id="visit-tab-content-week" class="visit-tab-content" style="display:none;">
            <div class="chart-header-hint">
                <span>📆 Thống kê lượt truy cập các ngày gần nhất:</span>
            </div>
            <div class="weekly-list-container" id="weekly-bars-container"></div>
        </div>

        <div class="visit-modal-footer">
            <span style="font-size:11.5px; color:#64748b; font-style:italic;">* Dữ liệu tự động làm mới và đồng bộ an toàn qua máy chủ.</span>
            <button type="button" class="btn-refresh-visits" onclick="refreshVisitStatsData()">🔄 Cập nhật</button>
        </div>
    </div>
</div>

<!-- 3. MODAL TOÀN MÀN HÌNH BẢNG KẾT QUẢ THI -->
<div class="result-fullscreen-modal" id="result-fullscreen-modal">
    <div class="result-modal-header">
        <div class="result-modal-title-box">
            <button type="button" id="btn-result-back-action" onclick="handleResultHeaderBack()" style="background:#e0f2fe; color:#0284c7; border:1.5px solid #7dd3fc; border-radius:10px; padding:7px 12px; font-weight:800; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:5px; flex-shrink:0;">
                ← Quay lại
            </button>
            <div class="result-modal-icon">📊</div>
            <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <div style="font-size: 12px; color: #64748b; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <a href="javascript:void(0)" onclick="closeResultModal()" style="color:#0284c7; text-decoration:none;">🏠 Trang chủ</a>
                    <span>/</span>
                    <span id="breadcrumb-category" style="color:#475569;">Lớp học</span>
                    <span>/</span>
                    <span style="color:#0f172a; font-weight:800;" id="breadcrumb-current-view">📊 Bảng kết quả</span>
                </div>
                <div class="result-modal-heading" id="result-modal-heading">Bảng Kết Quả Bài Thi</div>
                <div class="result-modal-subheading" id="result-modal-subheading">Chi tiết kết quả làm bài & nhật ký thi trực tuyến</div>
            </div>
        </div>
        <div class="result-modal-tools">
            <input type="text" id="result-search-input" class="result-search-input" placeholder="🔍 Tìm tên, SBD..." oninput="filterResultTable()" autocorrect="off" autocapitalize="none">
            
            <button type="button" id="btn-toggle-autorefresh" onclick="toggleAutoRefresh(event)" 
                style="background: #1e293b; color: #38bdf8; border: 1.5px solid #38bdf8; border-radius: 20px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;" 
                title="Bấm để Tạm dừng hoặc Bật lại tự động cập nhật">
                🟢 Auto: BẬT
            </button>

            <button class="btn-refresh-result" onclick="refreshCurrentExamResults()" title="Tải lại dữ liệu mới nhất"></button>
            
            <button type="button" class="btn-auto-collect-drafts" id="btn-auto-collect-drafts" onclick="triggerAutoCollectDrafts(event)" 
                title="Tự động thu bài và chấm điểm từ bản lưu nháp Realtime cho các em học sinh quên nộp hoặc gặp sự cố mạng">
                ⚡ Thu tự động
            </button>

            <div class="regrade-action-wrapper" style="position: relative; display: inline-block;">
                <button type="button" class="btn-regrade-exam" id="btn-regrade-exam" onclick="openRegradeModal(event)" title="Tải file đáp án đã sửa để chấm lại toàn bộ bài thi">
                    ⚖️ Chấm lại ▾
                </button>
                
                <div class="regrade-inline-dropdown" id="regrade-inline-dropdown" style="display:none; position:absolute; top:calc(100% + 8px); right:0; width:340px; background:#ffffff; border-radius:14px; box-shadow:0 14px 35px rgba(15,23,42,0.25); border:1.5px solid #fde68a; padding:14px; z-index:9999999; animation:popInBadge 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">
                        <span style="font-weight:900; color:#b45309; font-size:13px; display:flex; align-items:center; gap:5px;">⚖️ Tải file đáp án đã sửa</span>
                        <button type="button" onclick="closeRegradeModal(event)" style="background:none; border:none; font-size:15px; font-weight:900; color:#94a3b8; cursor:pointer;">✕</button>
                    </div>
                    <div style="font-size:11.5px; color:#475569; margin-bottom:8px; line-height:1.4;">
                        Chọn file <b>dapan.js / .txt / .json</b> mới. Hệ thống sẽ tự động tính lại điểm và cập nhật đồng bộ các bài đã nộp.
                    </div>
                    <input type="file" id="regrade-answer-file" accept="*/*" onchange="previewRegradeFile(this)" style="width:100%; padding:6px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:12px; margin-bottom:8px; background:#f8fafc;">
                    <div id="regrade-file-preview-status" style="font-size:11.5px; font-weight:700; color:#0284c7; margin-bottom:8px; display:none; background:#f0f9ff; padding:6px 10px; border-radius:8px; border:1px solid #bae6fd; line-height:1.3;"></div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" onclick="closeRegradeModal(event)" style="flex:1; padding:7px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; font-weight:800; color:#475569; cursor:pointer;">Đóng</button>
                        <button type="button" id="btn-confirm-regrade" onclick="processRegradeWithAnswers()" style="flex:1.5; padding:7px; background:linear-gradient(135deg, #f59e0b, #d97706); border:none; border-radius:8px; font-size:12px; font-weight:800; color:#fff; cursor:pointer; box-shadow:0 2px 6px rgba(245,158,11,0.3);">🚀 Chấm lại ngay</button>
                    </div>
                </div>
            </div>

            <button type="button" class="btn-upload-json-backup" id="btn-upload-json-backup" onclick="triggerUploadBackupJson(event)" title="Nạp bài thi từ file JSON lưu dự phòng khi học sinh bị mất mạng không nộp được">
                📥 Nạp JSON
            </button>
            <input type="file" id="input-upload-backup-json" accept=".json,application/json" style="display: none;" onchange="handleBackupJsonFileInput(this)">

            <button class="btn-export-excel" onclick="exportResultsToExcel()" title="Tải file Excel (.xlsx)">📥 Excel</button>
            
            <div class="table-settings-wrapper" id="table-settings-wrapper">
                <button type="button" class="btn-table-settings" id="btn-table-settings" onclick="toggleTableSettingsPopover(event)" title="Tùy chỉnh cỡ chữ & khoảng cách giữa các dòng">
                    ⚙️
                </button>
                <div class="table-settings-popover" id="table-settings-popover">
                    <div class="settings-popover-header">
                        <span>⚙️ Tùy chỉnh hiển thị bảng</span>
                        <button type="button" class="btn-close-settings" onclick="closeTableSettingsPopover(event)">✕</button>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label-row">
                            <span>🔤 Cỡ chữ hiển thị:</span>
                            <span class="setting-val-badge" id="val-font-size">13px</span>
                        </div>
                        <div class="slider-control-row">
                            <button type="button" class="btn-step" onclick="adjustSetting('fontSize', -1)" title="Giảm cỡ chữ">−</button>
                            <input type="range" id="slider-font-size" min="10" max="20" value="13" step="1" oninput="onFontSizeChange(this.value)">
                            <button type="button" class="btn-step" onclick="adjustSetting('fontSize', 1)" title="Tăng cỡ chữ">+</button>
                        </div>
                        <div class="preset-pills">
                            <button type="button" class="preset-btn" onclick="applyFontSizePreset(11)">Nhỏ (11)</button>
                            <button type="button" class="preset-btn" onclick="applyFontSizePreset(13)">Chuẩn (13)</button>
                            <button type="button" class="preset-btn" onclick="applyFontSizePreset(15)">Lớn (15)</button>
                            <button type="button" class="preset-btn" onclick="applyFontSizePreset(17)">Rất lớn (17)</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label-row">
                            <span>↕️ Khoảng cách giữa các dòng:</span>
                            <span class="setting-val-badge" id="val-row-padding">9px</span>
                        </div>
                        <div class="slider-control-row">
                            <button type="button" class="btn-step" onclick="adjustSetting('rowPadding', -1)" title="Thu gọn dòng">−</button>
                            <input type="range" id="slider-row-padding" min="0" max="24" value="9" step="1" oninput="onRowPaddingChange(this.value)">
                            <button type="button" class="btn-step" onclick="adjustSetting('rowPadding', 1)" title="Nới rộng dòng">+</button>
                        </div>
                        <div class="preset-pills">
                            <button type="button" class="preset-btn" onclick="applyRowPaddingPreset(0)">Sát nhất (0px)</button>
                            <button type="button" class="preset-btn" onclick="applyRowPaddingPreset(3)">Gọn (3px)</button>
                            <button type="button" class="preset-btn" onclick="applyRowPaddingPreset(9)">Chuẩn (9px)</button>
                            <button type="button" class="preset-btn" onclick="applyRowPaddingPreset(14)">Rộng (14px)</button>
                            <button type="button" class="preset-btn" onclick="applyRowPaddingPreset(18)">Rất rộng (18px)</button>
                        </div>
                    </div>

                    <div class="settings-footer">
                        <button type="button" class="btn-reset-settings" onclick="resetTableSettings()">↺ Mặc định</button>
                    </div>
                </div>
            </div>

            <button class="btn-close-result-modal" onclick="closeResultModal()" title="Đóng bảng">✕</button>
        </div>
    </div>

    <div class="result-modal-stats-bar" id="result-modal-stats-bar" style="background:#f8fafc; padding:8px 18px; display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1px solid #e2e8f0; font-size:12.5px; font-weight:700; flex-shrink:0; overflow-x:auto;">
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; flex-wrap:nowrap;">
            <div class="stat-badge-item">
                👥 Tổng thí sinh: <b id="stat-total-students">0</b>
                <span style="font-size:11.5px; color:#64748b; margin-left:4px; font-weight:700;">
                    (Lớp: <b id="stat-class-students" style="color:#0284c7;">0</b>, Tự do: <b id="stat-free-students" style="color:#d97706;">0</b>)
                </span>
            </div>
            <div class="stat-badge-item">✅ Đã nộp: <b id="stat-submitted-students" style="color:#10b981;">0</b></div>
            <div class="stat-badge-item">⚡ Đang làm: <b id="stat-doing-students" style="color:#f59e0b;">0</b></div>
            <div class="stat-badge-item">⏳ Chưa thi: <b id="stat-unsubmitted-students" style="color:#ef4444;">0</b></div>
            <div class="stat-badge-item">🎯 Điểm TB: <b id="stat-avg-score" style="color:#8b5cf6;">0.0</b></div>

            <span style="display:inline-block; width:1.5px; height:18px; background:#cbd5e1; margin:0 3px; flex-shrink:0;"></span>

            <span style="color:#475569; display:inline-flex; align-items:center; gap:4px; font-size:12px; white-space:nowrap;">
                📊 <b>Phân loại:</b>
            </span>
            <div class="stat-badge-item" style="background:#fef2f2; border-color:#fecaca; color:#991b1b; padding:3px 7px; border-radius:12px;">
                0 đến &lt; 3: <b id="stat-score-0-to-3" style="color:#dc2626; margin-left:3px;">0</b>
            </div>
            <div class="stat-badge-item" style="background:#fff1f2; border-color:#fecdd3; color:#9f1239; padding:3px 7px; border-radius:12px;">
                3 đến &lt; 5: <b id="stat-score-3-to-5" style="color:#e11d48; margin-left:3px;">0</b>
            </div>
            <div class="stat-badge-item" style="background:#fffbeb; border-color:#fef3c7; color:#92400e; padding:3px 7px; border-radius:12px;">
                5 đến &le; 6: <b id="stat-score-5-to-6" style="color:#d97706; margin-left:3px;">0</b>
            </div>
            <div class="stat-badge-item" style="background:#fefce8; border-color:#fef08a; color:#854d0e; padding:3px 7px; border-radius:12px;">
                6 đến &le; 7: <b id="stat-score-6-to-7" style="color:#b45309; margin-left:3px;">0</b>
            </div>
            <div class="stat-badge-item" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534; padding:3px 7px; border-radius:12px;">
                7 đến &le; 8: <b id="stat-score-7-to-8" style="color:#16a34a; margin-left:3px;">0</b>
            </div>
            <div class="stat-badge-item" style="background:#ecfdf5; border-color:#a7f3d0; color:#065f46; padding:3px 7px; border-radius:12px;">
                8 đến &le; 9: <b id="stat-score-8-to-9" style="color:#059669; margin-left:3px;">0</b>
            </div>
            <div class="stat-badge-item" style="background:#eff6ff; border-color:#bfdbfe; color:#1e40af; padding:3px 7px; border-radius:12px;">
                9 đến &le; 10: <b id="stat-score-9-to-10" style="color:#2563eb; margin-left:3px;">0</b>
            </div>
        </div>

        <div style="flex-shrink:0; margin-left:auto;">
            <button type="button" id="btn-view-detailed-stats" onclick="openDetailedStatsView()" style="background:linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color:#fff; border:none; border-radius:18px; padding:6px 14px; font-size:12.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 10px rgba(99,102,241,0.32); white-space:nowrap; transition:all 0.2s;">
                📈 Chi tiết ➔
            </button>
        </div>
    </div>

    <div class="result-modal-body" id="result-modal-main-view">
        <div class="result-table-card">
            <div class="result-table-scroll-wrap">
                <table class="result-table" id="admin-result-table">
                    <thead>
                        <tr>
                            <th class="td-stt" style="width: 50px;">STT</th>
                            <th style="width: 175px;">
                                <div class="exam-picker-wrapper">
                                    <button type="button" class="btn-exam-picker" onclick="toggleExamPickerMenu(event)" title="Bấm vào để chuyển đổi đề thi">
                                        <span class="btn-exam-picker-text" id="current-selected-exam-name">📑 Số đề thi ▾</span>
                                    </button>
                                    <div class="exam-picker-menu" id="exam-picker-dropdown-list"></div>
                                </div>
                            </th>
                            <th style="width: 105px; text-align:center;">Số lần thi</th>
                            <th style="width: 155px;">Thời gian vào thi</th>
                            <th style="width: 125px;">Thời gian thi</th>
                            <th style="width: 175px;">Họ và tên</th>
                            <th style="width: 90px; text-align:center;">Lớp</th>
                            <th style="width: 85px;">SBD</th>
                            <th style="width: 135px; text-align:center;">Tình trạng</th>
                            <th style="width: 110px; text-align:center;">Số câu đúng</th>
                            <th style="width: 120px; text-align:center;">Điểm</th>

                            <th style="width: 125px; text-align:center; overflow: visible;">
                                <div class="rank-picker-wrapper" style="position: relative; display: inline-block; width: 100%;">
                                    <button type="button" class="btn-rank-picker" onclick="toggleRankSortMenu(event)" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 4px 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25); user-select: none;">
                                        <span id="rank-header-btn-text">🏅 Xếp hạng ▾</span>
                                    </button>
                                    <div class="rank-picker-menu" id="rank-sort-dropdown-menu" style="display:none; position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%); min-width: 185px; background: #ffffff; border-radius: 12px; box-shadow: 0 14px 32px rgba(15, 23, 42, 0.25), 0 0 0 1px #cbd5e1; z-index: 999999; padding: 6px; text-transform: none;">
                                        <div class="rank-sort-item" id="opt-rank-desc" onclick="changeRankSort('desc', event)" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" style="padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1e293b; cursor: pointer; text-align: left; transition: 0.15s; display: flex; align-items: center; gap: 6px;">
                                            <span>⬇️</span> <span>Từ cao xuống thấp</span>
                                        </div>
                                        <div class="rank-sort-item" id="opt-rank-asc" onclick="changeRankSort('asc', event)" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" style="padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1e293b; cursor: pointer; text-align: left; transition: 0.15s; display: flex; align-items: center; gap: 6px;">
                                            <span>⬆️</span> <span>Xếp từ thấp đến cao</span>
                                        </div>
                                        <div class="rank-sort-item" id="opt-rank-default" onclick="changeRankSort('default', event)" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" style="padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1e293b; cursor: pointer; text-align: left; transition: 0.15s; display: flex; align-items: center; gap: 6px;">
                                            <span>🔢</span> <span>Theo STT cột thứ tự</span>
                                        </div>
                                    </div>
                                </div>
                            </th>

                            <th style="width: 145px; text-align:center;">Số lần chuyển tab</th>
                            <th style="width: 175px;">Thời gian chuyển tab</th>
                            <th style="width: 250px;">Chi tiết bài làm</th>
                        </tr>
                    </thead>
                    <tbody id="result-table-tbody">
                        <tr><td colspan="15" style="text-align:center; padding:30px; font-weight:700; color:#64748b;">⏳ Đang tải dữ liệu kết quả thi...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- KHỐI THỐNG KÊ CHI TIẾT & BIỂU ĐỒ PHỔ ĐIỂM -->
    <div id="result-detailed-stats-view" style="display:none; flex:1; padding:16px; overflow-y:auto; background:#f1f5f9; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:12px 18px; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <button type="button" onclick="closeDetailedStatsView()" style="background:#f8fafc; color:#1e293b; border:1.5px solid #cbd5e1; border-radius:10px; padding:7px 15px; font-weight:800; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px; transition:0.2s;">
                ⬅ Quay lại bảng kết quả
            </button>
            <div style="font-size:13px; color:#64748b; font-weight:700;">
                Đang xem: <b style="color:#0284c7;" id="detail-stat-exam-name">Đề thi</b>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
            <div style="background:linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius:14px; padding:16px; border-left:5px solid #16a34a; box-shadow:0 3px 10px rgba(22,163,74,0.1);">
                <div style="color:#166534; font-size:12px; font-weight:800;">ĐIỂM CAO NHẤT</div>
                <div id="kpi-max-score" style="font-size:28px; font-weight:900; color:#14532d; margin-top:4px;">0.0</div>
            </div>
            <div style="background:linear-gradient(135deg, #fef2f2, #fee2e2); border-radius:14px; padding:16px; border-left:5px solid #ef4444; box-shadow:0 3px 10px rgba(239,68,68,0.1);">
                <div style="color:#991b1b; font-size:12px; font-weight:800;">ĐIỂM THẤP NHẤT</div>
                <div id="kpi-min-score" style="font-size:28px; font-weight:900; color:#7f1d1d; margin-top:4px;">0.0</div>
            </div>
            <div style="background:linear-gradient(135deg, #faf5ff, #f3e8ff); border-radius:14px; padding:16px; border-left:5px solid #a855f7; box-shadow:0 3px 10px rgba(168,85,247,0.1);">
                <div style="color:#6b21a8; font-size:12px; font-weight:800;">ĐIỂM TRUNG BÌNH</div>
                <div id="kpi-avg-score" style="font-size:28px; font-weight:900; color:#581c87; margin-top:4px;">0.0</div>
            </div>
            <div style="background:linear-gradient(135deg, #eff6ff, #dbeafe); border-radius:14px; padding:16px; border-left:5px solid #2563eb; box-shadow:0 3px 10px rgba(37,99,235,0.1);">
                <div style="color:#1e40af; font-size:12px; font-weight:800;">TỶ LỆ ĐẠT (≥ 5.0)</div>
                <div id="kpi-pass-rate" style="font-size:28px; font-weight:900; color:#1e3a8a; margin-top:4px;">0%</div>
            </div>
            <div style="background:linear-gradient(135deg, #fffbeb, #fef3c7); border-radius:14px; padding:16px; border-left:5px solid #f59e0b; box-shadow:0 3px 10px rgba(245,158,11,0.1);">
                <div style="color:#92400e; font-size:12px; font-weight:800;">TỶ LỆ KHÁ - GIỎI (≥ 7.0)</div>
                <div id="kpi-good-rate" style="font-size:28px; font-weight:900; color:#78350f; margin-top:4px;">0%</div>
            </div>
        </div>

        <div style="background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:20px; box-shadow:0 4px 18px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
                <h3 style="margin:0; font-size:16px; font-weight:900; color:#0f172a; display:flex; align-items:center; gap:8px;">
                    📊 Biểu đồ hình cột Phổ điểm chi tiết
                </h3>
                <span style="font-size:12px; color:#64748b; font-weight:700;">Đơn vị: Số học sinh</span>
            </div>
            <div style="position:relative; height:340px; width:100%;">
                <canvas id="detailedScoreChart"></canvas>
            </div>
        </div>

        <div style="background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; padding:18px; box-shadow:0 4px 18px rgba(0,0,0,0.05);">
            <h4 style="margin:0 0 12px 0; font-size:15px; font-weight:900; color:#0f172a;">
                📑 Bảng tổng hợp mức xếp loại học lực bài thi
            </h4>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:800;">
                            <th style="padding:10px 12px;">Mức xếp loại</th>
                            <th style="padding:10px 12px;">Khoảng điểm</th>
                            <th style="padding:10px 12px; text-align:center;">Số lượng học sinh</th>
                            <th style="padding:10px 12px; text-align:center;">Tỉ lệ phần trăm</th>
                            <th style="padding:10px 12px;">Ghi chú đánh giá</th>
                        </tr>
                    </thead>
                    <tbody id="rating-breakdown-tbody"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- 4. MODAL ĐĂNG NHẬP PHÒNG THI DÀNH CHO HỌC SINH -->
<div class="move-modal-overlay" id="student-login-modal">
    <div class="student-login-box">
        <div class="student-login-header">
            <div class="student-login-icon" id="st-modal-icon">🔐</div>
            <div class="student-login-title" id="st-modal-main-title">Đăng Nhập Làm Bài Thi</div>
            <div class="student-login-sub" id="st-modal-exam-name">Hệ thống bài thi trắc nghiệm</div>
            <div class="st-modal-time-box" id="st-modal-time-box">
                ⏳ Đang tải khung thời gian làm bài...
            </div>
        </div>

        <div class="student-type-tabs">
            <button type="button" class="st-tab-btn active" id="tab-st-class" onclick="switchStudentLoginMode('class')">🏫 Học sinh theo lớp</button>
            <button type="button" class="st-tab-btn" id="tab-st-free" onclick="switchStudentLoginMode('free')">🎯 Thí sinh tự do</button>
        </div>

        <div class="st-error-box" id="st-login-error"></div>

        <div id="st-login-mode-class">
            <div class="st-input-group">
                <label>Tên đăng nhập / Số báo danh:</label>
                <div class="st-input-wrapper">
                    <span class="st-input-icon">👤</span>
                    <input type="text" id="st-username-input" class="st-input-field" placeholder="Nhập tên đăng nhập hoặc SBD..." autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
                </div>
            </div>

            <div class="st-input-group">
                <label>Mật khẩu:</label>
                <div class="st-input-wrapper">
                    <span class="st-input-icon">🔑</span>
                    <input type="password" id="st-password-input" class="st-input-field" placeholder="Nhập mật khẩu..." autocomplete="new-password" autocorrect="off" autocapitalize="none">
                    <button type="button" class="st-eye-btn" id="st-eye-btn" onclick="toggleStudentPassVisibility()">👁️</button>
                </div>
            </div>

            <div class="switch-mode-hint">
                Không có tài khoản? <a class="switch-mode-link" onclick="switchStudentLoginMode('free')">Vào thi tự do tại đây</a>
            </div>
        </div>

        <div id="st-login-mode-free" style="display: none;">
            <div class="st-input-group">
                <label>Họ và tên thí sinh:</label>
                <div class="st-input-wrapper">
                    <span class="st-input-icon">📝</span>
                    <input type="text" id="st-free-name-input" class="st-input-field" placeholder="VD: Nguyễn Văn An..." autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false">
                </div>
            </div>

            <div class="st-input-group">
                <label>Lớp học:</label>
                <div class="st-input-wrapper">
                    <span class="st-input-icon">🏫</span>
                    <input type="text" id="st-free-class-input" class="st-input-field" placeholder="VD: 10A1, Tự do..." autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false">
                </div>
            </div>

            <div class="st-input-group">
                <label>Số báo danh (SBD):</label>
                <div class="st-input-wrapper">
                    <span class="st-input-icon">🔢</span>
                    <input type="text" id="st-free-sbd-input" class="st-input-field" placeholder="VD: SBD01, 1001..." autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
                </div>
            </div>

            <div class="switch-mode-hint">
                Đã có tài khoản lớp? <a class="switch-mode-link" onclick="switchStudentLoginMode('class')">Đăng nhập tài khoản</a>
            </div>
        </div>

        <div class="st-btn-row">
            <button type="button" class="st-btn st-btn-cancel" onclick="closeStudentLoginModal()">Hủy bỏ</button>
            <button type="button" class="st-btn st-btn-submit" id="st-submit-btn" onclick="submitStudentLogin()">Vào thi 🚀</button>
        </div>
    </div>
</div>

<!-- 5. MODAL CẤU HÌNH THỜI GIAN ĐỀ THI -->
<div class="move-modal-overlay" id="exam-time-modal">
    <div class="move-modal-box" style="width: 360px;">
        <h4 id="exam-time-modal-title">⏱ Cấu hình thời gian đề thi</h4>
        
        <div id="modal-time-minutes-group" style="display: none;">
            <div class="admin-input-group">
                <label>Thời lượng làm bài (phút):</label>
                <input type="number" id="edit-time-limit" min="5" max="300" placeholder="VD: 45, 60, 90...">
            </div>
        </div>

        <div id="modal-time-schedule-group" style="display: none;">
            <div class="admin-input-group">
                <label>Thời gian mở đề (Bắt đầu):</label>
                <input type="datetime-local" id="edit-start-time">
            </div>
            <div class="admin-input-group">
                <label>Thời gian đóng đề (Hết hạn):</label>
                <input type="datetime-local" id="edit-end-time">
            </div>
        </div>

        <div class="move-btn-row" style="margin-top: 14px;">
            <button class="move-btn-cancel" onclick="closeExamTimeModal()">Hủy</button>
            <button class="move-btn-submit" id="btn-save-exam-time" onclick="saveExamTimeConfig()">Lưu cấu hình</button>
        </div>
    </div>
</div>

<!-- 6. MODAL CHUYỂN LỚP -->
<div class="move-modal-overlay" id="move-modal">
    <div class="move-modal-box">
        <h4>🔄 Chuyển sang lớp:</h4>
        <select id="move-category-select">
            <option value="kho-tai-lieu">📚 Kho tài liệu PDF, Word, Ảnh...</option>
            <option value="nhac-nho">📌 Nhắc nhở quan trọng</option>
            <option value="them-10">📐 Thêm 10</option>
            <option value="them-11">✍️ Thêm 11</option>
            <option value="them-12">🎓 Thêm 12</option>
            <option value="lop-11a">🏫 Lớp 11A</option>
            <option value="lop-11c">🏫 Lớp 11C</option>
            <option value="lop-10p">🏫 Lớp 10P</option>
            <option value="lop-11e">🏫 Lớp 11E</option>
            <option value="hsg-toan-11">🏆 HSG Toán 11</option>
            <option value="tu-luan-padlet">💜 Nộp tự luận Padlet</option>
        </select>
        <div class="move-btn-row">
            <button class="move-btn-cancel" onclick="closeMoveModal()">Hủy</button>
            <button class="move-btn-submit" onclick="confirmMoveQuiz()">Xác nhận</button>
        </div>
    </div>
</div>

<!-- 7. MODAL COPY SANG MỤC KHÁC -->
<div class="move-modal-overlay" id="copy-modal">
    <div class="move-modal-box">
        <h4>📋 Sao chép sang mục:</h4>
        <select id="copy-category-select">
            <option value="kho-tai-lieu">📚 Kho tài liệu PDF, Word, Ảnh...</option>
            <option value="nhac-nho">📌 Nhắc nhở quan trọng</option>
            <option value="them-10">📐 Thêm 10</option>
            <option value="them-11">✍️ Thêm 11</option>
            <option value="them-12">🎓 Thêm 12</option>
            <option value="lop-11a">🏫 Lớp 11A</option>
            <option value="lop-11c">🏫 Lớp 11C</option>
            <option value="lop-10p">🏫 Lớp 10P</option>
            <option value="lop-11e">🏫 Lớp 11E</option>
            <option value="hsg-toan-11">🏆 HSG Toán 11</option>
            <option value="tu-luan-padlet">💜 Nộp tự luận Padlet</option>
        </select>
        <div class="move-btn-row">
            <button class="move-btn-cancel" onclick="closeCopyModal()">Hủy</button>
            <button class="move-btn-submit" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);" onclick="confirmCopyItem()">Sao chép</button>
        </div>
    </div>
</div>

<input type="file" id="reminder-custom-avatar-input" accept="image/*" style="display: none;" onchange="handleReminderCustomAvatarUploaded(this)">

<!-- 8. MODAL CẤU HÌNH LẮNG NGHE REALTIME TIẾT KIỆM BĂNG THÔNG -->
<div class="move-modal-overlay" id="realtime-config-modal" style="display: none; z-index: 1000000;">
    <div class="move-modal-box" style="width: 380px; max-width: 95vw; background: #ffffff; border-radius: 16px; padding: 18px; box-shadow: 0 20px 50px rgba(15,23,42,0.35);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 8px;">
            <div style="font-weight: 900; font-size: 14px; color: #0284c7; display:flex; align-items:center; gap:6px;">
                <span>📡</span> CẤU HÌNH LẮNG NGHE REALTIME
            </div>
            <button type="button" onclick="closeRealtimeConfigModal()" style="background:none; border:none; font-size:16px; font-weight:900; color:#94a3b8; cursor:pointer;">✕</button>
        </div>

        <div style="font-size: 11.5px; color: #64748b; line-height: 1.4; margin-bottom: 14px; background: #f8fafc; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
            💡 <b>Mẹo thi đông (100–180 em):</b> Gạt tắt bớt các dòng 1, 3, 4 và chỉnh Ping lên <b>60s hoặc 90s</b> để máy chủ gói Free không bao giờ bị nghẽn!
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>
                    <b style="font-size: 12px; color: #1e293b; display:block;">1. Đếm người cùng thi</b>
                    <span style="font-size: 10.5px; color: #64748b;">(Kênh onlineRealtimeChannel)</span>
                </div>
                <label class="mini-switch" style="position:relative; width:34px; height:18px;">
                    <input type="checkbox" id="cfg-watch-online" checked style="opacity:0; width:0; height:0;">
                    <span class="slider-toggle"></span>
                </label>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>
                    <b style="font-size: 12px; color: #1e293b; display:block;">2. Thu bài ép buộc từ xa</b>
                    <span style="font-size: 10.5px; color: #64748b;">(Kênh forceSubmitRealtimeChannel)</span>
                </div>
                <label class="mini-switch" style="position:relative; width:34px; height:18px;">
                    <input type="checkbox" id="cfg-watch-forcesubmit" checked style="opacity:0; width:0; height:0;">
                    <span class="slider-toggle"></span>
                </label>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>
                    <b style="font-size: 12px; color: #1e293b; display:block;">3. Cập nhật giờ thi trực tiếp</b>
                    <span style="font-size: 10.5px; color: #64748b;">(Kênh realtimeConfigChannel)</span>
                </div>
                <label class="mini-switch" style="position:relative; width:34px; height:18px;">
                    <input type="checkbox" id="cfg-watch-timeconfig" checked style="opacity:0; width:0; height:0;">
                    <span class="slider-toggle"></span>
                </label>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>
                    <b style="font-size: 12px; color: #1e293b; display:block;">4. Đồng bộ ảnh câu hỏi</b>
                    <span style="font-size: 10.5px; color: #64748b;">(Kênh imageSyncChannel)</span>
                </div>
                <label class="mini-switch" style="position:relative; width:34px; height:18px;">
                    <input type="checkbox" id="cfg-watch-imagesync" checked style="opacity:0; width:0; height:0;">
                    <span class="slider-toggle"></span>
                </label>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                <div>
                    <b style="font-size: 12px; color: #1e293b; display:block;">5. Tần suất ping nhịp tim</b>
                    <span style="font-size: 10.5px; color: #64748b;">(Lệnh updatePresence)</span>
                </div>
                <select id="cfg-ping-interval" style="padding:4px 8px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:800; font-size:12px; color:#0284c7; outline:none; background:#fff;">
                    <option value="30">30 giây (Mặc định)</option>
                    <option value="60">60 giây (Tiết kiệm)</option>
                    <option value="90">90 giây (Rất dôi)</option>
                    <option value="0">Tắt hẳn (Không ping)</option>
                </select>
            </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:16px;">
            <button type="button" class="btn-admin btn-cancel" onclick="closeRealtimeConfigModal()" style="flex:1;">Hủy</button>
            <button type="button" class="btn-admin btn-submit" id="btn-save-rt-cfg" onclick="saveRealtimeConfigToCloud()" style="flex:1.5;">💾 Lưu cài đặt</button>
        </div>
    </div>
</div>

<!-- ============================================== -->
<!-- 9. MODAL 1: TẠO CÂU HỎI VÀ TRÍCH ĐỀ (3 CỘT) -->
<!-- ============================================== -->
<div class="qbank-modal-overlay" id="modal-qbank-creator">
    <div class="qbank-modal-container">
        <div class="qbank-header">
            <div style="font-size:16px; font-weight:900; display:flex; align-items:center; gap:8px;">
                <span style="font-size:24px;">📚</span> <span>HỆ THỐNG BIÊN SOẠN & TẠO MA TRẬN ĐỀ</span>
            </div>
            <button onclick="closeQbankCreatorModal()" style="background:none; border:none; color:#fff; font-size:22px; font-weight:900; cursor:pointer; padding:0 10px;">✕</button>
        </div>

        <div class="qbank-body-3cols">
            <!-- CỘT 1: TREE FOLDER -->
            <div class="qbank-col-left">
                <div class="qbank-storage-toggle">
                    <b style="font-size:12px; color:#1e293b;">Nơi Lưu trữ dữ liệu:</b>
                    <select onchange="toggleStorageLocation(this)">
                        <option value="drive" selected>2. Đồng bộ Google Drive 5TB (Qua GAS)</option>
                        <option value="supabase">1. Máy chủ Supabase (Nhanh)</option>
                    </select>
                </div>
                <div class="qbank-tree-container" id="qbank-tree-root">
                    <!-- JS Render Tree -->
                </div>
            </div>

            <!-- CỘT 2: QUESTIONS & DRAG/DROP -->
            <div class="qbank-col-mid">
                <div class="qbank-stats-bar">
                    <div class="qbank-tools-row">
                        <button class="btn-qbank btn-qbank-primary" onclick="triggerQbankUpload()">📥 Upload file JSON đề</button>
                    </div>
                    <div class="qbank-matrix-stats" id="qbank-matrix-bar">
                        <span style="color:#64748b; font-style:italic;">Upload file JSON để xem ma trận thống kê 4 mức độ</span>
                    </div>
                </div>
                <div class="qbank-questions-list" id="qbank-questions-list">
                    <!-- JS Render Question Cards -->
                </div>
            </div>

            <!-- CỘT 3: EXAM BUILDER -->
            <div class="qbank-col-right">
                <h3 style="color:#0f172a; font-size:15px; font-weight:900; margin-bottom:16px; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">🛠️ TRÍCH XUẤT TỪ NGÂN HÀNG</h3>
                
                <div class="qbank-exam-builder-form">
                    <label>Tên đề thi mới:</label>
                    <input type="text" id="qbank-exam-name" placeholder="VD: Đề thi Giữa kỳ 1 Toán 11...">
                    
                    <label>Khối lớp (Folder Google Drive):</label>
                    <select id="qbank-exam-grade">
                        <option value="Lop_10">Khối Lớp 10</option>
                        <option value="Lop_11" selected>Khối Lớp 11</option>
                        <option value="Lop_12">Khối Lớp 12</option>
                        <option value="Lop_HSG_11">Khối Lớp HSG 11</option>
                    </select>
                </div>

                <div class="qbank-selected-stats" id="qbank-builder-stats">
                    <p style="color:#64748b;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>
                </div>

                <button class="btn-qbank btn-qbank-warning" id="btn-save-extracted-exam" onclick="saveExtractedExamToBank()" style="padding:14px; font-size:14px; width:100%; justify-content:center;">
                    💾 Lưu đề vào Ngân hàng
                </button>
            </div>
        </div>
    </div>
</div>

<!-- ============================================== -->
<!-- 10. MODAL 2: NGÂN HÀNG ĐỀ ĐÃ LƯU -->
<!-- ============================================== -->
<div class="qbank-modal-overlay" id="modal-qbank-saved">
    <div class="qbank-modal-container" style="width: 850px; height: 85vh; max-width:95vw;">
        <div class="qbank-header">
            <div style="font-size:16px; font-weight:900; display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">🏦</span> <span>NGÂN HÀNG ĐỀ (ĐÃ LƯU)</span>
            </div>
            <button onclick="closeSavedExamsModal()" style="background:none; border:none; color:#fff; font-size:22px; font-weight:900; cursor:pointer; padding:0 10px;">✕</button>
        </div>
        
        <div style="padding: 14px 20px 0 20px; background: #f1f5f9; display: flex; align-items: center; gap: 10px;">
            <b style="font-size: 13px; color: #334155;">🔍 Lọc theo khối lớp:</b>
            <select id="qbank-filter-grade" onchange="filterSavedExamsList(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; outline: none; background: #fff;">
                <option value="all">Tất cả các khối</option>
                <option value="Lop_10">Lớp 10</option>
                <option value="Lop_11">Lớp 11</option>
                <option value="Lop_12">Lớp 12</option>
                <option value="Lop_HSG_11">Lớp HSG 11</option>
            </select>
        </div>

        <div class="saved-exams-list" id="qbank-saved-list">
            <!-- JS Render Saved Exams from Supabase -->
        </div>
    </div>
</div>

</body>
</html>
