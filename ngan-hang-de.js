// =========================================================
// FILE: ngan-hang-de.js
// HỆ THỐNG BIÊN SOẠN CÂU HỎI, PHÂN LOẠI MA TRẬN & TRÍCH ĐỀ THI
// HỖ TRỢ LƯU TRỮ ĐA NỀN TẢNG (SUPABASE & GOOGLE DRIVE 5TB QUA GAS)
// =========================================================

let qbankState = {
    storageTarget: "supabase", // 'supabase' hoặc 'drive'
    currentTree: [
        {
            id: "node_lop10",
            name: "Khối Lớp 10",
            color: "#0284c7",
            children: [
                {
                    id: "node_10_c1",
                    name: "Chương 1. Mệnh đề và tập hợp",
                    color: "#059669",
                    children: [
                        { id: "node_10_c1_b1", name: "Bài 1. Mệnh đề toán học", color: "#6b21a8", children: [] },
                        { id: "node_10_c1_b2", name: "Bài 2. Tập hợp và các phép toán", color: "#d97706", children: [] }
                    ]
                }
            ]
        },
        {
            id: "node_lop11",
            name: "Khối Lớp 11",
            color: "#16a34a",
            children: [
                {
                    id: "node_11_c1",
                    name: "Chương 1. Hàm số lượng giác và phương trình",
                    color: "#0284c7",
                    children: [
                        { id: "node_11_c1_b1", name: "Bài 1. Giá trị lượng giác của góc", color: "#dc2626", children: [] },
                        { id: "node_11_c1_b2", name: "Bài 2. Phương trình lượng giác cơ bản", color: "#7c3aed", children: [] }
                    ]
                }
            ]
        },
        {
            id: "node_lop12",
            name: "Khối Lớp 12",
            color: "#ea580c",
            children: [
                {
                    id: "node_12_c1",
                    name: "Chương 1. Ứng dụng đạo hàm khảo sát hàm số",
                    color: "#0891b2",
                    children: [
                        { id: "node_12_c1_b1", name: "Bài 1. Tính đơn điệu của hàm số", color: "#059669", children: [] },
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
    currentExamToTransfer: null,
    currentExamToSchedule: null
};

const QBANK_COLOR_PALETTE = [
    "#0284c7", "#059669", "#7c3aed", "#ea580c", "#dc2626", "#0891b2", "#ca8a04", "#475569"
];

// 1. ĐÓNG MỞ DROPDOWN MENU
function toggleQbankMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById("qbank-dropdown-menu");
    if (!menu) return;
    menu.classList.toggle("show");
}

document.addEventListener("click", function(e) {
    const wrap = e.target.closest(".qbank-dropdown-wrapper");
    if (!wrap) {
        const menu = document.getElementById("qbank-dropdown-menu");
        if (menu) menu.classList.remove("show");
    }
});

// 2. MODAL 1: TẠO CÂU HỎI VÀ TRÍCH ĐỀ
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

// 3. MODAL 2: NGÂN HÀNG ĐỀ ĐÃ LƯU
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

// 4. LỰA CHỌN NƠI LƯU TRỮ (SUPABASE HOẶC GOOGLE DRIVE)
function toggleStorageLocation(selectEl) {
    qbankState.storageTarget = selectEl.value;
    if (qbankState.storageTarget === "drive") {
        alert("📁 ĐÃ CHUYỂN NƠI LƯU TRỮ SANG GOOGLE DRIVE 5TB:\n\nTất cả dữ liệu ngân hàng đề sẽ được đồng bộ theo đường dẫn:\nG:\\My Drive\\KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO\\Kho_ngan_hang_cau_hoi\\...");
    } else {
        alert("⚡ ĐÃ CHUYỂN NƠI LƯU TRỮ SANG MÁY CHỦ SUPABASE (MẶC ĐỊNH): Tốc độ truy vấn siêu nhanh.");
    }
}

// =========================================================================
// CỘT 1: QUẢN LÝ CÂY THƯ MỤC DẠNG CÂY (TREE VIEW) & ĐỔI MÀU
// =========================================================================

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
        let subHtml = "";

        if (node.children && node.children.length > 0) {
            subHtml = `<div class="tree-children">${node.children.map(child => buildNodeHtml(child, depth + 1)).join("")}</div>`;
        }

        return `
            <div class="tree-item-wrapper" style="margin-left: ${depth > 0 ? 4 : 0}px;">
                <div class="tree-item ${isActive ? 'active' : ''}" id="tree-node-${node.id}"
                     onclick="selectQbankFolder('${node.id}')"
                     ondragover="handleTreeDragOver(event, '${node.id}')"
                     ondragleave="handleTreeDragLeave(event, '${node.id}')"
                     ondrop="handleTreeDrop(event, '${node.id}')"
                     style="border-left: 4px solid ${nodeColor};">
                    
                    <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:14px;">📁</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${node.name}">${node.name}</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:3px;" onclick="event.stopPropagation()">
                        <div class="tree-color-picker-dot" style="background:${nodeColor}; width:12px; height:12px; border-radius:50%; cursor:pointer;" onclick="promptChangeFolderColor('${node.id}')" title="Đổi màu thư mục"></div>
                        <button class="btn-add-tree" onclick="promptAddChildFolder('${node.id}')" title="Thêm mục con">+</button>
                        <button class="btn-add-tree" style="color:#ef4444;" onclick="promptDeleteFolder('${node.id}')" title="Xóa thư mục">✕</button>
                    </div>
                </div>
                ${subHtml}
            </div>
        `;
    }

    html += qbankState.currentTree.map(rootNode => buildNodeHtml(rootNode, 0)).join("");
    rootEl.innerHTML = html;
}

function selectQbankFolder(folderId) {
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);
    renderQbankTree();
    renderQbankQuestions();
}

function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Khối Lớp 11 Nâng Cao...):");
    if (!name || !name.trim()) return;
    const newId = "node_" + Date.now();
    qbankState.currentTree.push({
        id: newId,
        name: name.trim(),
        color: QBANK_COLOR_PALETTE[Math.floor(Math.random() * QBANK_COLOR_PALETTE.length)],
        children: []
    });
    saveQbankTreeData();
    renderQbankTree();
}

function promptAddChildFolder(parentId) {
    const parent = findNodeInTree(qbankState.currentTree, parentId);
    if (!parent) return;
    const name = prompt(`📁 Thêm mục con vào [${parent.name}]:`);
    if (!name || !name.trim()) return;
    const newId = "node_" + Date.now();
    if (!parent.children) parent.children = [];
    parent.children.push({
        id: newId,
        name: name.trim(),
        color: parent.color || QBANK_COLOR_PALETTE[0],
        children: []
    });
    saveQbankTreeData();
    renderQbankTree();
}

function promptChangeFolderColor(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    const chosen = prompt("🎨 Chọn mã màu Hex (VD: #0284c7, #16a34a, #ea580c, #7c3aed, #dc2626):", node.color || "#0284c7");
    if (chosen && chosen.trim()) {
        node.color = chosen.trim();
        saveQbankTreeData();
        renderQbankTree();
    }
}

function promptDeleteFolder(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa thư mục [${node.name}] và tất cả mục con không?`)) return;

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

function saveQbankTreeData() {
    try {
        localStorage.setItem("qbank_tree_structure", JSON.stringify(qbankState.currentTree));
    } catch(e) {}

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (client) {
        client.from('app_key_values').upsert({
            key: 'qbank_tree_structure',
            value: qbankState.currentTree
        }).then();
    }
}

function loadQbankTreeData() {
    try {
        const local = localStorage.getItem("qbank_tree_structure");
        if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
                qbankState.currentTree = parsed;
            }
        }
    } catch(e) {}
}

// DRAG & DROP TỪ CÂU HỎI VÀO CÂY THƯ MỤC
function handleTreeDragOver(e, folderId) {
    e.preventDefault();
    const el = document.getElementById(`tree-node-${folderId}`);
    if (el) el.classList.add("drag-over");
}

function handleTreeDragLeave(e, folderId) {
    const el = document.getElementById(`tree-node-${folderId}`);
    if (el) el.classList.remove("drag-over");
}

function handleTreeDrop(e, folderId) {
    e.preventDefault();
    const el = document.getElementById(`tree-node-${folderId}`);
    if (el) el.classList.remove("drag-over");

    const qId = e.dataTransfer.getData("text/plain") || qbankState.draggedQId;
    if (!qId) return;

    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const question = qbankState.rawQuestions.find(q => String(q.id) === String(qId));

    if (targetFolder && question) {
        question.folderId = folderId;
        question.folderName = targetFolder.name;
        alert(`🎯 Đã gán Câu ${question.indexInList || question.id} vào mục: "${targetFolder.name}"!`);
        renderQbankQuestions();
    }
}

// =========================================================================
// CỘT 2: DANH SÁCH CÂU HỎI, MA TRẬN 4 MỨC ĐỘ & BIÊN TẬP
// =========================================================================

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
            if (typeof robustParseExamScriptOrJson === 'function') {
                parsed = robustParseExamScriptOrJson(text);
            } else {
                try { parsed = JSON.parse(text); } catch(err) {
                    let clean = text.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, 'return ');
                    parsed = new Function(clean)();
                }
            }

            if (!parsed) throw new Error("File không đúng cấu trúc!");

            let rawQuestions = [];
            if (Array.isArray(parsed)) {
                rawQuestions = parsed;
            } else if (parsed.questions && Array.isArray(parsed.questions)) {
                rawQuestions = parsed.questions;
                if (parsed.title) {
                    const examNameInput = document.getElementById("qbank-exam-name");
                    if (examNameInput) examNameInput.value = parsed.title;
                }
            }

            // Gán tự động ID, mức độ và số thứ tự
            rawQuestions.forEach((q, idx) => {
                q.indexInList = idx + 1;
                q.id = q.id || (idx + 1);
                // Nhận biết 4 mức độ: nb, th, vdt, vdc
                if (!q.level) {
                    const textContent = (q.question || "") + " " + (q.explanation || "");
                    if (/vận dụng cao|vdc/i.test(textContent)) q.level = "vdc";
                    else if (/vận dụng|vdt/i.test(textContent)) q.level = "vdt";
                    else if (/thông hiểu|th/i.test(textContent)) q.level = "th";
                    else q.level = "nb";
                }
                if (qbankState.activeFolderId) {
                    q.folderId = qbankState.activeFolderId;
                    q.folderName = qbankState.activeFolderObj ? qbankState.activeFolderObj.name : "";
                }
            });

            qbankState.rawQuestions = rawQuestions;
            qbankState.selectedQuestionIds = new Set(rawQuestions.map(q => String(q.id))); // Mặc định tích chọn hết

            renderQbankQuestions();
            updateQbankMatrixStats();
            updateQbankBuilderStats();

            alert(`✅ ĐÃ TẢI LÊN THÀNH CÔNG ${rawQuestions.length} CÂU HỎI VÀO BỘ SOẠN THẢO MA TRẬN!`);
        } catch(err) {
            alert("❌ Lỗi nạp file đề: " + err.message);
        }
    };
    reader.readAsText(file);
}

function getQuestionPartNumber(q) {
    if (typeof isPart4Question === 'function' && isPart4Question(q)) return 4;
    if (q.part === 4 || q.isPart4) return 4;
    if (q.type === "true_false") return 2;
    if (q.type === "short_answer") return 3;
    return 1;
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
        nb: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
        th: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
        vdt: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 },
        vdc: { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 }
    };

    questions.forEach(q => {
        const lvl = q.level || "nb";
        const part = getQuestionPartNumber(q);
        if (stats[lvl]) {
            stats[lvl][part]++;
            stats[lvl].total++;
        }
    });

    bar.innerHTML = `
        <div class="matrix-group">
            <span class="matrix-title" style="color:#166534;">🟢 Nhận biết (${stats.nb.total})</span>
            <div class="matrix-row">
                <span class="stat-pill nb">P1: ${stats.nb[1]}</span>
                <span class="stat-pill nb">P2: ${stats.nb[2]}</span>
                <span class="stat-pill nb">P3: ${stats.nb[3]}</span>
                <span class="stat-pill nb">P4: ${stats.nb[4]}</span>
            </div>
        </div>

        <div class="matrix-group">
            <span class="matrix-title" style="color:#0369a1;">🔵 Thông hiểu (${stats.th.total})</span>
            <div class="matrix-row">
                <span class="stat-pill th">P1: ${stats.th[1]}</span>
                <span class="stat-pill th">P2: ${stats.th[2]}</span>
                <span class="stat-pill th">P3: ${stats.th[3]}</span>
                <span class="stat-pill th">P4: ${stats.th[4]}</span>
            </div>
        </div>

        <div class="matrix-group">
            <span class="matrix-title" style="color:#854d0e;">🟡 Vận dụng thấp (${stats.vdt.total})</span>
            <div class="matrix-row">
                <span class="stat-pill vdt">P1: ${stats.vdt[1]}</span>
                <span class="stat-pill vdt">P2: ${stats.vdt[2]}</span>
                <span class="stat-pill vdt">P3: ${stats.vdt[3]}</span>
                <span class="stat-pill vdt">P4: ${stats.vdt[4]}</span>
            </div>
        </div>

        <div class="matrix-group">
            <span class="matrix-title" style="color:#991b1b;">🔴 Vận dụng cao (${stats.vdc.total})</span>
            <div class="matrix-row">
                <span class="stat-pill vdc">P1: ${stats.vdc[1]}</span>
                <span class="stat-pill vdc">P2: ${stats.vdc[2]}</span>
                <span class="stat-pill vdc">P3: ${stats.vdc[3]}</span>
                <span class="stat-pill vdc">P4: ${stats.vdc[4]}</span>
            </div>
        </div>

        <div style="margin-left:auto; display:flex; align-items:center; font-weight:900; color:#0f172a; font-size:13px;">
            Tổng: ${questions.length} câu
        </div>
    `;
}

function renderQbankQuestions() {
    const container = document.getElementById("qbank-questions-list");
    if (!container) return;

    const questions = qbankState.rawQuestions || [];
    if (questions.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:#64748b;">
                <div style="font-size:48px; margin-bottom:10px;">📥</div>
                <h3 style="color:#1e293b; margin-bottom:6px;">Chưa có câu hỏi nào</h3>
                <p>Nhấn nút <b>"Upload file JSON đề"</b> ở trên hoặc kéo thả file đề thi vào đây để bắt đầu biên soạn.</p>
            </div>
        `;
        return;
    }

    const letters = ["A", "B", "C", "D"];
    let html = "";

    questions.forEach((q, idx) => {
        const qIdStr = String(q.id);
        const isChecked = qbankState.selectedQuestionIds.has(qIdStr);
        const part = getQuestionPartNumber(q);
        const lvl = q.level || "nb";

        let partBadgeText = "Phần I (Trắc nghiệm)";
        if (part === 2) partBadgeText = "Phần II (Đúng/Sai)";
        else if (part === 3) partBadgeText = "Phần III (Trả lời ngắn)";
        else if (part === 4) partBadgeText = "Phần IV (Tự luận)";

        // Hình ảnh nếu có
        let imgHtml = "";
        const imgUrl = q.imageUrl || (qbankState.images && qbankState.images[q.imageKey]);
        if (imgUrl) {
            imgHtml = `<div style="text-align:center; margin:8px 0;"><img src="${imgUrl}" style="max-height:180px; max-width:90%; border-radius:8px; border:1px solid #cbd5e1;"></div>`;
        }

        // Nội dung đáp án & phương án
        let bodyHtml = "";
        if (part === 1) {
            const opts = q.options || [];
            let correctLetter = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct || 'A').toUpperCase();
            bodyHtml = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px;">
                    ${opts.map((opt, oIdx) => `
                        <div style="padding:6px 10px; border-radius:6px; border:1px solid ${letters[oIdx] === correctLetter ? '#10b981' : '#e2e8f0'}; background:${letters[oIdx] === correctLetter ? '#ecfdf5' : '#fff'}; font-size:12px;">
                            <b>${letters[oIdx]}.</b> ${opt} ${letters[oIdx] === correctLetter ? '<b>✓</b>' : ''}
                        </div>
                    `).join("")}
                </div>
            `;
        } else if (part === 2) {
            const stList = q.statements || [];
            bodyHtml = `
                <div style="margin-top:8px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <tr style="background:#f8fafc; font-weight:800; border-bottom:1px solid #e2e8f0;"><th style="padding:6px;">Mệnh đề</th><th style="width:70px; text-align:center;">Đáp án</th></tr>
                        ${stList.map(st => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:6px;"><b>${st.id})</b> ${st.statement}</td>
                                <td align="center" style="font-weight:900; color:${st.correct ? '#16a34a' : '#dc2626'};">${st.correct ? '🟢 Đúng' : '🔴 Sai'}</td>
                            </tr>
                        `).join("")}
                    </table>
                </div>
            `;
        } else {
            bodyHtml = `
                <div style="margin-top:8px; font-size:12px; font-weight:800; color:#0f766e; background:#f0fdfa; padding:6px 10px; border-radius:6px; border:1px solid #ccfbf1;">
                    🎯 Đáp số: <span style="color:#0f172a;">${q.correctAnswer || q.correct || '---'}</span>
                </div>
            `;
        }

        // Lời giải ẩn
        const explanationHtml = q.explanation ? `
            <div style="margin-top:8px;">
                <button class="btn-qbank" style="padding:3px 8px; font-size:11px; background:#f8fafc; color:#0284c7; border:1px solid #bae6fd;" onclick="toggleQbankExplanation('${q.id}', event)">💡 Lời giải chi tiết ▾</button>
                <div id="qbank-explain-${q.id}" style="display:none; margin-top:6px; padding:8px 12px; background:#fefce8; border-left:3.5px solid #eab308; border-radius:6px; font-size:12px; color:#713f12; line-height:1.45;">
                    ${q.explanation}
                </div>
            </div>
        ` : '';

        html += `
            <div class="qbank-q-card ${isChecked ? 'selected' : ''}" id="qbank-card-${q.id}"
                 draggable="true"
                 ondragstart="handleQuestionDragStart(event, '${q.id}')">
                
                <div class="qbank-q-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="qbank-q-id-badge">Câu ${idx + 1}</span>
                        <span style="font-size:11px; font-weight:800; color:#0284c7; background:#e0f2fe; padding:2px 6px; border-radius:6px;">${partBadgeText}</span>
                        ${q.folderName ? `<span style="font-size:11px; font-weight:700; color:#059669; background:#dcfce7; padding:2px 6px; border-radius:6px;">📁 ${q.folderName}</span>` : ''}
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <select class="qbank-level-select" onchange="changeQuestionLevel('${q.id}', this.value)">
                            <option value="nb" ${lvl === 'nb' ? 'selected' : ''}>🟢 Nhận biết</option>
                            <option value="th" ${lvl === 'th' ? 'selected' : ''}>🔵 Thông hiểu</option>
                            <option value="vdt" ${lvl === 'vdt' ? 'selected' : ''}>🟡 Vận dụng thấp</option>
                            <option value="vdc" ${lvl === 'vdc' ? 'selected' : ''}>🔴 Vận dụng cao</option>
                        </select>

                        <label style="display:flex; align-items:center; gap:4px; font-weight:900; font-size:12px; cursor:pointer;" onclick="event.stopPropagation()">
                            <input type="checkbox" style="width:18px; height:18px; accent-color:#10b981; cursor:pointer;"
                                   ${isChecked ? 'checked' : ''}
                                   onchange="toggleSelectQuestion('${q.id}', this.checked)">
                            <span>Chọn</span>
                        </label>
                    </div>
                </div>

                <div style="font-size:13px; line-height:1.5; color:#0f172a; font-weight:600;">
                    ${typeof formatQuestionText === 'function' ? formatQuestionText(q.question) : q.question}
                </div>

                ${imgHtml}
                ${bodyHtml}
                ${explanationHtml}
            </div>
        `;
    });

    container.innerHTML = html;

    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([container]).catch(() => {});
    }
}

function handleQuestionDragStart(e, qId) {
    qbankState.draggedQId = qId;
    e.dataTransfer.setData("text/plain", qId);
    e.dataTransfer.effectAllowed = "move";
}

function toggleQbankExplanation(qId, e) {
    if (e) e.stopPropagation();
    const el = document.getElementById(`qbank-explain-${qId}`);
    if (el) el.style.display = (el.style.display === "none" || el.style.display === "") ? "block" : "none";
}

function changeQuestionLevel(qId, newLevel) {
    const q = qbankState.rawQuestions.find(item => String(item.id) === String(qId));
    if (q) {
        q.level = newLevel;
        updateQbankMatrixStats();
        updateQbankBuilderStats();
    }
}

function toggleSelectQuestion(qId, isChecked) {
    const idStr = String(qId);
    if (isChecked) {
        qbankState.selectedQuestionIds.add(idStr);
    } else {
        qbankState.selectedQuestionIds.delete(idStr);
    }
    const card = document.getElementById(`qbank-card-${qId}`);
    if (card) card.classList.toggle("selected", isChecked);
    updateQbankBuilderStats();
}

function autoSortQuestionsToSelectedFolder() {
    if (!qbankState.activeFolderId) {
        alert("⚠️ Vui lòng nhấp chọn một bài/mục trong Cây thư mục ở cột bên trái trước!");
        return;
    }

    const folder = findNodeInTree(qbankState.currentTree, qbankState.activeFolderId);
    if (!folder) return;

    let count = 0;
    qbankState.rawQuestions.forEach(q => {
        if (qbankState.selectedQuestionIds.has(String(q.id))) {
            q.folderId = folder.id;
            q.folderName = folder.name;
            count++;
        }
    });

    if (count > 0) {
        alert(`✅ Đã xếp ${count} câu hỏi đã chọn vào mục "${folder.name}"!`);
        renderQbankQuestions();
    } else {
        alert("⚠️ Bạn chưa tích chọn câu hỏi nào ở cột giữa!");
    }
}

// =========================================================================
// CỘT 3: TRÍCH ĐỀ & LƯU VÀO NGÂN HÀNG ĐỀ (SUPABASE HOẶC DRIVE)
// =========================================================================

function updateQbankBuilderStats() {
    const container = document.getElementById("qbank-builder-stats");
    if (!container) return;

    const totalSelected = qbankState.selectedQuestionIds.size;
    if (totalSelected === 0) {
        container.innerHTML = `<p style="color:#64748b; font-style:italic;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>`;
        return;
    }

    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    let nb = 0, th = 0, vdt = 0, vdc = 0;

    qbankState.rawQuestions.forEach(q => {
        if (qbankState.selectedQuestionIds.has(String(q.id))) {
            const p = getQuestionPartNumber(q);
            if (p === 1) p1++; else if (p === 2) p2++; else if (p === 3) p3++; else p4++;

            const lvl = q.level || "nb";
            if (lvl === "nb") nb++; else if (lvl === "th") th++; else if (lvl === "vdt") vdt++; else vdc++;
        }
    });

    container.innerHTML = `
        <div style="font-weight:900; font-size:14px; color:#0f172a; margin-bottom:8px;">
            🎯 Tổng câu hỏi trích xuất: <b style="color:#10b981;">${totalSelected} câu</b>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
            <div><b>Cấu trúc đề:</b> P1: ${p1} câu • P2: ${p2} câu • P3: ${p3} câu • P4: ${p4} câu</div>
            <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
                <span class="stat-pill nb">Nhận biết: ${nb}</span>
                <span class="stat-pill th">Thông hiểu: ${th}</span>
                <span class="stat-pill vdt">Vận dụng thấp: ${vdt}</span>
                <span class="stat-pill vdc">Vận dụng cao: ${vdc}</span>
            </div>
        </div>
    `;
}

async function saveExtractedExamToBank() {
    const titleInput = document.getElementById("qbank-exam-name");
    const gradeSelect = document.getElementById("qbank-exam-grade");
    const title = titleInput ? titleInput.value.trim() : "";
    const grade = gradeSelect ? gradeSelect.value : "Lop_11";

    if (!title) {
        alert("⚠️ Vui lòng nhập Tên đề thi mới ở cột bên phải!");
        titleInput.focus();
        return;
    }

    if (qbankState.selectedQuestionIds.size === 0) {
        alert("⚠️ Vui lòng tích chọn ít nhất 1 câu hỏi để tạo đề!");
        return;
    }

    const selectedQuestions = qbankState.rawQuestions
        .filter(q => qbankState.selectedQuestionIds.has(String(q.id)))
        .map((q, idx) => ({ ...q, id: idx + 1 })); // Đánh số lại 1..N

    const btn = document.getElementById("btn-save-extracted-exam");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang lưu đề..."; }

    const newExamRecord = {
        id: "exam_bank_" + Date.now(),
        title: title,
        grade: grade,
        questionCount: selectedQuestions.length,
        createdAt: new Date().toISOString(),
        assignedClasses: [], // Vết chuyển lớp
        questions: selectedQuestions,
        scoringConfig: { mode: "option1" }
    };

    try {
        // 1. Lưu vào bộ nhớ đệm
        loadSavedExamsList(false);
        qbankState.savedExams.unshift(newExamRecord);
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));

        // 2. Lưu vào Supabase (Table app_key_values)
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'qbank_saved_exams',
                value: qbankState.savedExams
            });
        }

        // 3. Nếu chọn Google Drive, gửi qua Google Apps Script (GAS)
        if (qbankState.storageTarget === "drive") {
            const gasUrl = (typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined") ? GOOGLE_DRIVE_UPLOAD_GAS_URL : "";
            if (gasUrl && !gasUrl.includes("DÁN_URL")) {
                const drivePath = `KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/${grade}`;
                const payload = {
                    action: "saveQuestionBankData",
                    path: drivePath,
                    filename: `${title.replace(/\s+/g, '_')}_${Date.now()}.json`,
                    data: newExamRecord
                };
                fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(payload)
                }).catch(() => null);
            }
        }

        alert(`🎉 ĐÃ LƯU ĐỀ "${title}" (${selectedQuestions.length} CÂU) VÀO NGÂN HÀNG ĐỀ THÀNH CÔNG!`);
        closeQbankCreatorModal();
        openSavedExamsModal();
    } catch(err) {
        alert("❌ Lỗi lưu đề: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Lưu đề vào Ngân hàng"; }
    }
}

// =========================================================================
// PHẦN B: QUẢN LÝ NGÂN HÀNG ĐỀ ĐÃ LƯU, CHUYỂN ĐỀ SANG LỚP & ĐẶT GIỜ THI
// =========================================================================

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

    if (doRender) renderSavedExamsListUI();
}

function renderSavedExamsListUI() {
    const container = document.getElementById("qbank-saved-list");
    if (!container) return;

    const list = qbankState.savedExams || [];
    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:#64748b;">
                <div style="font-size:48px; margin-bottom:10px;">🏦</div>
                <h3 style="color:#1e293b; margin-bottom:6px;">Ngân hàng đề đang trống</h3>
                <p>Hãy vào mục <b>"Tạo câu hỏi từ file JSON"</b> để biên soạn và trích xuất đề thi.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(exam => {
        const dateStr = exam.createdAt ? new Date(exam.createdAt).toLocaleString("vi-VN") : "---";
        const assignedTags = (exam.assignedClasses && exam.assignedClasses.length > 0)
            ? exam.assignedClasses.map(c => `<span class="exam-tag">✅ Đã chuyển: ${c}</span>`).join("")
            : `<span style="font-size:11px; color:#94a3b8; font-style:italic;">Chưa chuyển sang lớp nào</span>`;

        return `
            <div class="saved-exam-item">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:15px; font-weight:900; color:#0f172a; margin-bottom:4px;">
                        📑 ${exam.title}
                    </div>
                    <div style="font-size:12px; color:#64748b; font-weight:600; margin-bottom:6px;">
                        Số câu: <b style="color:#0284c7;">${exam.questionCount || (exam.questions ? exam.questions.length : 0)} câu</b> • Khối: <b>${exam.grade || '11'}</b> • Tạo lúc: ${dateStr}
                    </div>
                    <div class="exam-assigned-tags">
                        ${assignedTags}
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <button class="btn-qbank btn-qbank-primary" onclick="openTransferExamModal('${exam.id}')" title="Chuyển đề thi này sang các lớp học">
                        🚀 Chuyển sang lớp
                    </button>
                    <button class="btn-qbank btn-qbank-warning" onclick="openScheduleExamModal('${exam.id}')" title="Đặt ngày giờ bắt đầu và kết thúc thi">
                        ⏰ Đặt giờ thi
                    </button>
                    <button class="btn-qbank" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;" onclick="downloadSavedExamJson('${exam.id}')" title="Tải file JSON đề thi">
                        💾 JSON
                    </button>
                    <button class="btn-qbank btn-qbank-danger" onclick="deleteSavedExam('${exam.id}')" title="Xóa đề này khỏi ngân hàng">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// CHUYỂN ĐỀ SANG LỚP & LƯU VẾT
function openTransferExamModal(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    qbankState.currentExamToTransfer = exam;

    const modal = document.getElementById("modal-transfer-exam");
    if (!modal) {
        createTransferModalInDOM();
    }
    document.getElementById("transfer-exam-title").innerText = exam.title;
    document.getElementById("modal-transfer-exam").style.display = "flex";
}

function createTransferModalInDOM() {
    const div = document.createElement("div");
    div.id = "modal-transfer-exam";
    div.className = "qbank-modal-overlay";
    div.innerHTML = `
        <div class="qbank-modal-container" style="width:480px; height:auto; max-height:85vh; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px;">
                <h3 style="font-size:15px; font-weight:900; color:#0284c7;">🚀 CHUYỂN ĐỀ SANG LỚP</h3>
                <button onclick="document.getElementById('modal-transfer-exam').style.display='none'" style="background:none; border:none; font-size:18px; font-weight:900; cursor:pointer;">✕</button>
            </div>
            <div style="font-size:12.5px; font-weight:700; color:#1e293b; margin-bottom:10px;" id="transfer-exam-title">...</div>
            <p style="font-size:12px; color:#64748b; margin-bottom:10px;">Tích chọn các lớp bạn muốn nạp đề thi này vào (sẽ tự động lưu vết):</p>
            
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
        </div>
    `;
    document.body.appendChild(div);
}

async function confirmTransferExamToClasses() {
    const exam = qbankState.currentExamToTransfer;
    if (!exam) return;

    const checkedBoxes = Array.from(document.querySelectorAll('#transfer-class-list input[type="checkbox"]:checked'));
    const selectedClasses = checkedBoxes.map(cb => cb.value);

    if (selectedClasses.length === 0) {
        alert("⚠️ Vui lòng chọn ít nhất 1 lớp để chuyển đề!");
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("Chưa kết nối được Supabase!");

    try {
        const quizId = "quiz_" + Date.now();
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;

        // 1. Tạo bản ghi trong quizzes
        await client.from('quizzes').upsert({
            id: quizId,
            title: exam.title,
            made: "101",
            time_limit_minutes: 90,
            scoring_config: exam.scoringConfig || { mode: "option1" },
            questions: exam.questions || []
        });

        // 2. Tạo bản ghi trong custom_links cho từng lớp
        const linkRows = selectedClasses.map(cat => ({
            id: quizId,
            category_id: cat,
            title: exam.title,
            date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT",
            is_hot: true,
            is_doc: false,
            timestamp: Date.now()
        }));
        await client.from('custom_links').insert(linkRows);

        // 3. Lưu vết đã chuyển vào Ngân hàng đề
        const classNamesMap = {
            "lop-11a": "Lớp 11A", "lop-11c": "Lớp 11C", "lop-10p": "Lớp 10P", "lop-11e": "Lớp 11E",
            "them-10": "Thêm 10", "them-11": "Thêm 11", "them-12": "Thêm 12", "hsg-toan-11": "HSG Toán 11"
        };
        const newClassNames = selectedClasses.map(c => classNamesMap[c] || c);

        if (!exam.assignedClasses) exam.assignedClasses = [];
        newClassNames.forEach(name => {
            if (!exam.assignedClasses.includes(name)) exam.assignedClasses.push(name);
        });

        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        await client.from('app_key_values').upsert({
            key: 'qbank_saved_exams',
            value: qbankState.savedExams
        });

        alert(`🎉 ĐÃ CHUYỂN ĐỀ "${exam.title}" VÀO ${newClassNames.length} LỚP THÀNH CÔNG VÀ ĐÃ LƯU VẾT!`);
        document.getElementById("modal-transfer-exam").style.display = "none";
        renderSavedExamsListUI();
    } catch(err) {
        alert("❌ Lỗi chuyển đề: " + err.message);
    }
}

// ĐẶT NGÀY GIỜ THI
function openScheduleExamModal(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    qbankState.currentExamToSchedule = exam;

    const start = prompt(`📅 Nhập thời gian MỞ ĐỀ (YYYY-MM-DDTHH:mm):`, exam.startTime || "2026-10-15T08:00");
    if (!start) return;
    const end = prompt(`📅 Nhập thời gian ĐÓNG ĐỀ (YYYY-MM-DDTHH:mm):`, exam.endTime || "2026-10-20T22:00");
    if (!end) return;

    exam.startTime = start;
    exam.endTime = end;
    localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
    alert(`✅ Đã lưu khung giờ thi cho đề "${exam.title}"!`);
}

function downloadSavedExamJson(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    const jsonStr = JSON.stringify(exam, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exam.title.replace(/\s+/g, '_')}.json`;
    a.click();
}

function deleteSavedExam(examId) {
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa đề "${exam.title}" khỏi ngân hàng không?`)) return;

    qbankState.savedExams = qbankState.savedExams.filter(e => e.id !== examId);
    localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (client) {
        client.from('app_key_values').upsert({
            key: 'qbank_saved_exams',
            value: qbankState.savedExams
        }).then();
    }
    renderSavedExamsListUI();
}

// Đăng ký toàn cục
window.toggleQbankMenu = toggleQbankMenu;
window.openQbankCreatorModal = openQbankCreatorModal;
window.closeQbankCreatorModal = closeQbankCreatorModal;
window.openSavedExamsModal = openSavedExamsModal;
window.closeSavedExamsModal = closeSavedExamsModal;
window.toggleStorageLocation = toggleStorageLocation;
window.triggerQbankUpload = triggerQbankUpload;
window.toggleSelectQuestion = toggleSelectQuestion;
window.autoSortQuestionsToSelectedFolder = autoSortQuestionsToSelectedFolder;
window.saveExtractedExamToBank = saveExtractedExamToBank;
window.openTransferExamModal = openTransferExamModal;
window.confirmTransferExamToClasses = confirmTransferExamToClasses;
window.openScheduleExamModal = openScheduleExamModal;
window.downloadSavedExamJson = downloadSavedExamJson;
window.deleteSavedExam = deleteSavedExam;
window.promptAddRootFolder = promptAddRootFolder;
window.promptAddChildFolder = promptAddChildFolder;
window.promptChangeFolderColor = promptChangeFolderColor;
window.promptDeleteFolder = promptDeleteFolder;
window.selectQbankFolder = selectQbankFolder;
window.handleTreeDragOver = handleTreeDragOver;
window.handleTreeDragLeave = handleTreeDragLeave;
window.handleTreeDrop = handleTreeDrop;
window.handleQuestionDragStart = handleQuestionDragStart;
window.toggleQbankExplanation = toggleQbankExplanation;
window.changeQuestionLevel = changeQuestionLevel;