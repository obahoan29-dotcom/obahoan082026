// =========================================================
// FILE: ngan-hang-de.js
// BẢN HOÀN THIỆN 100%:
// 1. CHỈ MỞ ĐƯỢC TRONG CHẾ ĐỘ ADMIN (PHẢI ĐĂNG NHẬP ADMIN MỚI MỞ ĐƯỢC)
// 2. KHI KÉO THẢ VÀO THƯ MỤC: TỰ ĐỘNG ĐÁNH SỐ ID (VD: id.L10-Ch1-Bai1-P1-Nhận biết-C1, C2...)
// 3. TRONG CHẾ ĐỘ XẾP CÂU: CÂU ĐÃ ĐÁNH SỐ ID TỰ ĐỘNG XẾP PHÍA TRÊN CÙNG, CÂU CHƯA XẾP GIỮ ĐÚNG THỨ TỰ NẰM PHÍA DƯỚI
// 4. ĐẦY ĐỦ: UNDO (CTRL+Z), LƯU NHÁP, XÓA NHIỀU CÂU, XUẤT PDF/WORD THEO CÂY THƯ MỤC, CO GIÃN 3 CỘT
// =========================================================

let qbankState = {
    storageTarget: "drive",
    savedExamFilter: "all",
    currentExamTitle: "",
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

    // CHẾ ĐỘ XẾP CÂU (MẶC ĐỊNH BẬT: ĐÃ ĐÁNH ID LÊN TRÊN CÙNG, CHƯA XẾP Ở DƯỚI THEO THỨ TỰ)
    assignMode: true,

    // TÙY CHỌN ẨN CÁC CÂU ĐÃ GÁN VÀO THƯ MỤC (TẮT MẶC ĐỊNH)
    hideAssigned: false,

    // NGĂN XẾP HOÀN TÁC (UNDO)
    undoStack: [],

    // TRẠNG THÁI BẢNG XUẤT FILE THEO CÂY THƯ MỤC
    exportSelectedFolderIds: new Set(),
    exportCollapsedFolderIds: new Set(),
    exportCustomTitleTouched: false
};

const QBANK_COLOR_PALETTE = ["#0284c7", "#059669", "#7c3aed", "#ea580c", "#dc2626", "#0891b2", "#ca8a04", "#475569"];
const QBANK_MAX_UNDO = 40;
const QBANK_EXPORT_UNASSIGNED_KEY = "__UNASSIGNED__";
let _qbankToastTimer = null;
let _qbankResizersInitialized = false;

// ============================================================================
// 0. KIỂM TRA QUYỀN ADMIN TUYỆT ĐỐI CHO HỆ THỐNG BIÊN SOẠN & NGÂN HÀNG ĐỀ
// ============================================================================
function isQbankAdminAuthorized() {
    try {
        if (typeof isAdminLoggedIn !== "undefined" && isAdminLoggedIn === true) return true;
        if (typeof checkAdminSessionValidity === "function" && checkAdminSessionValidity()) return true;

        const logged = (typeof safeLocal !== "undefined")
            ? safeLocal.getItem("adminLoggedInSession")
            : localStorage.getItem("adminLoggedInSession");
        const expiresAt = (typeof safeLocal !== "undefined")
            ? safeLocal.getItem("admin_expires_at")
            : localStorage.getItem("admin_expires_at");

        if (logged === "true" && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
            return true;
        }
    } catch (e) {}
    return false;
}

function requireQbankAdminOrPrompt() {
    if (isQbankAdminAuthorized()) return true;

    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");
    const creatorModal = document.getElementById("modal-qbank-creator");
    if (creatorModal) creatorModal.style.display = "none";
    const savedModal = document.getElementById("modal-qbank-saved");
    if (savedModal) savedModal.style.display = "none";

    alert("🔒 Chức năng Hệ thống biên soạn & Ngân hàng đề chỉ dành cho Quản trị viên!\n\nVui lòng bấm ⚙️ và đăng nhập mật khẩu Admin trước.");

    const authContainer = document.getElementById("auth-container");
    const passInput = document.getElementById("admin-pass-input");
    if (authContainer) {
        authContainer.classList.add("show");
        if (passInput) passInput.focus();
    }
    return false;
}

// ============================================================================
// 1. THÔNG BÁO TOAST NỔI TRỰC TIẾP TRONG MODAL NGÂN HÀNG ĐỀ
// ============================================================================
function showQbankToast(message, type = "success") {
    const toast = document.getElementById("qbank-toast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = "qbank-toast";
    if (type === "info") toast.classList.add("toast-info");
    else if (type === "warning") toast.classList.add("toast-warning");
    else if (type === "error") toast.classList.add("toast-error");

    void toast.offsetWidth;
    toast.classList.add("show");

    if (_qbankToastTimer) clearTimeout(_qbankToastTimer);
    _qbankToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

function escapeQbankHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ============================================================================
// 2. NHẬN DIỆN PHẦN & SINH ID MÀU ĐỎ TỰ ĐỘNG THEO CÂY THƯ MỤC + MA TRẬN
//    Ví dụ: id.L10-Ch1-Bai1-P1-Nhận biết-C1, id.L10-Ch1-Bai1-P1-Nhận biết-C2...
// ============================================================================
function getQbankQuestionPart(q) {
    if (!q) return 1;
    if (q.part === 4 || q.isPart4 === true || q.type === "essay" || q.type === "essay_answer" || q.type === "part4") {
        return 4;
    }
    const txt = String(q.question || "").toUpperCase();
    if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) {
        return 4;
    }
    if (q.type === "true_false") return 2;
    if (q.type === "short_answer") return 3;
    return q.part ? parseInt(q.part, 10) || 1 : 1;
}

function getQbankLevelLabel(level) {
    const map = {
        nb: "Nhận biết",
        th: "Thông hiểu",
        vdt: "Vận dụng",
        vdc: "Vận dụng cao"
    };
    return map[level || "nb"] || "Nhận biết";
}

function formatNodeSlugForId(name) {
    const raw = String(name || "").trim();
    if (!raw) return "M";

    const norm = raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d");
    const lower = norm.toLowerCase();

    const mHsg = lower.match(/(?:lop|khoi)?\s*hsg\s*(\d+)?/);
    if (mHsg) return "LHSG" + (mHsg[1] || "");

    const mLop = lower.match(/(?:lop|khoi)\s*(\d+[a-z]?)/);
    if (mLop) return "L" + mLop[1].toUpperCase();

    const mChuong = lower.match(/chuong\s*(\d+)/);
    if (mChuong) return "Ch" + mChuong[1];

    const mBai = lower.match(/bai\s*(\d+)/);
    if (mBai) return "Bai" + mBai[1];

    const mCd = lower.match(/chuyen\s*de\s*(\d+)/);
    if (mCd) return "CD" + mCd[1];

    const mDang = lower.match(/dang\s*(\d+)/);
    if (mDang) return "D" + mDang[1];

    const mMuc = lower.match(/(?:chu\s*de|muc|phan|tiet)\s*(\d+)/);
    if (mMuc) return "M" + mMuc[1];

    const words = norm.replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "M";
    if (words.length === 1) return words[0].substring(0, 10);
    return words
        .slice(0, 2)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("")
        .substring(0, 10);
}

function getFolderPathNodes(targetId) {
    if (!targetId) return [];
    let foundPath = [];
    function traverse(nodes, currentPath) {
        for (let n of nodes) {
            const nextPath = [...currentPath, n];
            if (n.id === targetId) {
                foundPath = nextPath;
                return true;
            }
            if (n.children && n.children.length > 0 && traverse(n.children, nextPath)) {
                return true;
            }
        }
        return false;
    }
    traverse(qbankState.currentTree, []);
    return foundPath;
}

// TỰ ĐỘNG ĐÁNH LẠI TOÀN BỘ ID MÀU ĐỎ THEO THỨ TỰ KÉO THẢ (assignedAt -> origIndex)
// ĐẢM BẢO C1, C2, C3... KHÔNG BAO GIỜ BỊ NHẢY SỐ LỘN XỘN KHI THÊM CÂU MỚI
function recomputeAllMatrixIds() {
    const slotCounters = {};
    const questions = qbankState.rawQuestions || [];

    const assignedQuestions = [];
    questions.forEach(q => {
        if (!q) return;
        if (!q.folderId) {
            q.matrixId = "";
            q.matrixSeq = 0;
            q.matrixPathSlug = "";
        } else {
            assignedQuestions.push(q);
        }
    });

    assignedQuestions.sort((a, b) => {
        const atA = Number(a.assignedAt) || 0;
        const atB = Number(b.assignedAt) || 0;
        if (atA !== atB) return atA - atB;
        return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
    });

    assignedQuestions.forEach(q => {
        const pathNodes = getFolderPathNodes(q.folderId);
        if (pathNodes.length === 0) {
            q.folderId = null;
            q.folderName = "";
            q.matrixId = "";
            q.matrixSeq = 0;
            q.matrixPathSlug = "";
            return;
        }

        const lastNode = pathNodes[pathNodes.length - 1];
        q.folderName = lastNode.name;

        const pathSlug = pathNodes.map(n => formatNodeSlugForId(n.name)).join("-");
        const part = getQbankQuestionPart(q);
        const levelKey = q.level || "nb";
        const levelLabel = getQbankLevelLabel(levelKey);

        const slotKey = `${q.folderId}__P${part}__${levelKey}`;
        slotCounters[slotKey] = (slotCounters[slotKey] || 0) + 1;
        const seqNum = slotCounters[slotKey];

        q.matrixSeq = seqNum;
        q.matrixPathSlug = pathSlug;
        q.matrixId = `id.${pathSlug}-P${part}-${levelLabel}-C${seqNum}`;
    });
}

// ============================================================================
// 3. HỆ THỐNG LÙI LẠI (UNDO) KHI KÉO NHẦM HOẶC THAO TÁC NHẦM
// ============================================================================
function pushQbankUndoState(actionLabel = "Thao tác") {
    try {
        const snapshot = {
            label: actionLabel,
            rawQuestions: JSON.parse(JSON.stringify(qbankState.rawQuestions || [])),
            currentTree: JSON.parse(JSON.stringify(qbankState.currentTree || [])),
            currentExamTitle: qbankState.currentExamTitle || "",
            selectedQuestionIds: Array.from(qbankState.selectedQuestionIds || []),
            assignMode: !!qbankState.assignMode,
            hideAssigned: !!qbankState.hideAssigned,
            activeFilter: JSON.parse(JSON.stringify(qbankState.activeFilter || {}))
        };
        qbankState.undoStack.push(snapshot);
        if (qbankState.undoStack.length > QBANK_MAX_UNDO) {
            qbankState.undoStack.shift();
        }
        updateQbankUndoButtonUI();
    } catch (e) {
        console.warn("Không thể tạo snapshot Undo:", e);
    }
}

function updateQbankUndoButtonUI() {
    const btn = document.getElementById("btn-qbank-undo");
    if (!btn) return;
    const count = qbankState.undoStack.length;
    btn.disabled = count === 0;
    if (count > 0) {
        const lastLabel = qbankState.undoStack[count - 1].label || "thao tác gần nhất";
        btn.innerHTML = `<span>↩️</span> <span>Lùi (${count})</span>`;
        btn.title = `Lùi lại: ${lastLabel} (Phím tắt: Ctrl + Z)`;
    } else {
        btn.innerHTML = `<span>↩️</span> <span>Lùi</span>`;
        btn.title = "Chưa có thao tác nào để lùi lại";
    }
}

function undoQbankAction() {
    if (!qbankState.undoStack || qbankState.undoStack.length === 0) {
        showQbankToast("ℹ️ Không còn thao tác nào để lùi lại!", "info");
        return;
    }

    const prev = qbankState.undoStack.pop();
    qbankState.rawQuestions = prev.rawQuestions || [];
    qbankState.currentTree = prev.currentTree || qbankState.currentTree;
    qbankState.currentExamTitle = prev.currentExamTitle || "";
    qbankState.selectedQuestionIds = new Set(prev.selectedQuestionIds || []);
    qbankState.assignMode = prev.assignMode !== undefined ? !!prev.assignMode : true;
    qbankState.hideAssigned = !!prev.hideAssigned;
    qbankState.activeFilter = prev.activeFilter || { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = qbankState.activeFilter.folderId || null;
    qbankState.activeFolderObj = qbankState.activeFolderId
        ? findNodeInTree(qbankState.currentTree, qbankState.activeFolderId)
        : null;

    recomputeAllMatrixIds();
    saveQbankTreeData();
    saveQbankDraftState(false);

    syncAssignModeButtonsUI();
    updateQbankUndoButtonUI();
    updateQbankDeleteSelectedButtonUI();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    showQbankToast(`↩️ Đã lùi lại: ${prev.label}`, "warning");
}

document.addEventListener("keydown", function(e) {
    const modal = document.getElementById("modal-qbank-creator");
    if (!modal || modal.style.display !== "flex") return;

    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoQbankAction();
    }
});

// ============================================================================
// 4. LƯU & TẢI BẢN NHÁP
// ============================================================================
async function saveQbankDraftState(showFeedback = false) {
    recomputeAllMatrixIds();

    let savedLocal = false;
    let savedIDB = false;

    try {
        try {
            localStorage.setItem("qbank_draft_questions", JSON.stringify(qbankState.rawQuestions));
            localStorage.setItem("qbank_draft_images", JSON.stringify(qbankState.imagesMap));
            localStorage.setItem("qbank_draft_exam_title", qbankState.currentExamTitle || "");
            localStorage.setItem("qbank_tree_structure", JSON.stringify(qbankState.currentTree));
            savedLocal = true;
        } catch (e) {
            console.warn("Ngân hàng đề vượt dung lượng LocalStorage, lưu bằng IndexedDB.");
        }

        if (typeof examIndexedDB !== "undefined") {
            savedIDB = await examIndexedDB.setItem("exam_states", {
                key: "qbank_draft_state_v1",
                questions: qbankState.rawQuestions,
                images: qbankState.imagesMap,
                currentExamTitle: qbankState.currentExamTitle || "",
                currentTree: qbankState.currentTree,
                updatedAt: Date.now()
            });
        }

        if (showFeedback) {
            const total = (qbankState.rawQuestions || []).length;
            const assignedCount = (qbankState.rawQuestions || []).filter(q => Boolean(q.folderId)).length;
            const unassignedCount = total - assignedCount;

            if (savedLocal || savedIDB) {
                showQbankToast(
                    `✅ Đã lưu dữ liệu thành công! (Ngân hàng: ${assignedCount} câu • Chờ xếp: ${unassignedCount} câu)`,
                    "success"
                );
            } else {
                showQbankToast("⚠️ Trình duyệt hạn chế bộ nhớ tạm, hãy trích đề hoặc tải JSON dự phòng!", "warning");
            }
        }
        return savedLocal || savedIDB;
    } catch (e) {
        console.error("Lỗi lưu nháp Ngân hàng đề:", e);
        if (showFeedback) {
            showQbankToast("❌ Lỗi khi lưu dữ liệu: " + e.message, "error");
        }
        return false;
    }
}

async function manualSaveQbankDraftState(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const btn = document.getElementById("btn-qbank-save-draft");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ Đang lưu...";
    }

    const ok = await saveQbankDraftState(true);

    if (btn) {
        if (ok) {
            btn.innerHTML = "✅ Đã lưu!";
            setTimeout(() => {
                btn.innerHTML = "💾 Lưu dữ liệu";
                btn.disabled = false;
            }, 1500);
        } else {
            btn.innerHTML = "💾 Lưu dữ liệu";
            btn.disabled = false;
        }
    }
}

async function loadQbankDraftState() {
    let loadedFromIDB = false;
    if (typeof examIndexedDB !== "undefined") {
        try {
            const data = await examIndexedDB.getItem("exam_states", "qbank_draft_state_v1");
            if (data && Array.isArray(data.questions)) {
                qbankState.rawQuestions = data.questions;
                qbankState.imagesMap = data.images || {};
                if (data.currentExamTitle) qbankState.currentExamTitle = data.currentExamTitle;
                if (Array.isArray(data.currentTree) && data.currentTree.length > 0 && !localStorage.getItem("qbank_tree_structure")) {
                    qbankState.currentTree = data.currentTree;
                }
                loadedFromIDB = true;
            }
        } catch (e) {}
    }

    if (!loadedFromIDB) {
        try {
            const q = localStorage.getItem("qbank_draft_questions");
            const img = localStorage.getItem("qbank_draft_images");
            const title = localStorage.getItem("qbank_draft_exam_title");
            if (q) {
                const parsedQ = JSON.parse(q);
                if (Array.isArray(parsedQ)) qbankState.rawQuestions = parsedQ;
            }
            if (img) {
                const parsedImg = JSON.parse(img);
                if (typeof parsedImg === "object" && parsedImg) qbankState.imagesMap = parsedImg;
            }
            if (title) qbankState.currentExamTitle = title;
        } catch (e) {}
    }

    recomputeAllMatrixIds();
}

// ============================================================================
// 5. HIỂN THỊ TÊN ĐỀ GỐC Ở HEADER VÀ CỘT GIỮA
// ============================================================================
function renderQbankHeaderAndMidExamTitle() {
    const headerBadge = document.getElementById("qbank-header-exam-title");
    const midNameEl = document.getElementById("qbank-mid-exam-name");
    const midCounterEl = document.getElementById("qbank-mid-exam-counter");

    const title = (qbankState.currentExamTitle || "").trim();
    const allQ = qbankState.rawQuestions || [];
    const assignedCount = allQ.filter(q => Boolean(q.folderId)).length;
    const unassignedCount = allQ.length - assignedCount;

    if (headerBadge) {
        if (title) {
            headerBadge.classList.add("has-exam");
            headerBadge.title = `Đề gốc đang xử lý: ${title}`;
            headerBadge.innerHTML = `<span>📄</span> <span>Đề đang xử lý: ${escapeQbankHtml(title)}</span>`;
        } else {
            headerBadge.classList.remove("has-exam");
            headerBadge.title = "Chưa nạp đề gốc";
            headerBadge.innerHTML = `<span>📄</span> <span>Chưa nạp đề gốc</span>`;
        }
    }

    if (midNameEl) {
        midNameEl.textContent = title || "Chưa nạp đề gốc (Bấm Upload file JSON đề)";
        midNameEl.title = title || "";
    }

    if (midCounterEl) {
        midCounterEl.textContent = `Chờ xếp: ${unassignedCount} • Ngân hàng: ${assignedCount}`;
    }
}

// ============================================================================
// 6. CO GIÃN ĐỘ RỘNG 3 CỘT (CHUỘT + CẢM ỨNG + NHỚ ĐỘ RỘNG)
// ============================================================================
function applySavedQbankColWidths() {
    const leftCol = document.getElementById("qbank-col-left");
    const rightCol = document.getElementById("qbank-col-right");
    if (!leftCol || !rightCol) return;

    try {
        const saved = JSON.parse(localStorage.getItem("qbank_col_widths") || "null");
        if (saved) {
            if (saved.left >= 210 && saved.left <= window.innerWidth * 0.55) {
                leftCol.style.flex = `0 0 ${saved.left}px`;
                leftCol.style.width = `${saved.left}px`;
            }
            if (saved.right >= 210 && saved.right <= window.innerWidth * 0.45) {
                rightCol.style.flex = `0 0 ${saved.right}px`;
                rightCol.style.width = `${saved.right}px`;
            }
        }
    } catch (e) {}
}

function resetQbankColWidths() {
    const leftCol = document.getElementById("qbank-col-left");
    const rightCol = document.getElementById("qbank-col-right");
    if (leftCol) {
        leftCol.style.flex = "0 0 330px";
        leftCol.style.width = "330px";
    }
    if (rightCol) {
        rightCol.style.flex = "0 0 310px";
        rightCol.style.width = "310px";
    }
    try { localStorage.removeItem("qbank_col_widths"); } catch (e) {}
    showQbankToast("↔️ Đã khôi phục độ rộng mặc định cho 3 cột!", "info");
}

function initQbankColumnResizers() {
    applySavedQbankColWidths();
    if (_qbankResizersInitialized) return;

    const container = document.getElementById("qbank-body-3cols");
    const leftCol = document.getElementById("qbank-col-left");
    const rightCol = document.getElementById("qbank-col-right");
    const resizerLeft = document.getElementById("qbank-resizer-left");
    const resizerRight = document.getElementById("qbank-resizer-right");

    if (!container || !leftCol || !rightCol || !resizerLeft || !resizerRight) return;
    _qbankResizersInitialized = true;

    let activeSide = null;
    let startX = 0;
    let startLeftWidth = 0;
    let startRightWidth = 0;

    function getClientX(e) {
        return (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    }

    function startDrag(side, e) {
        if (window.innerWidth <= 900) return;
        e.preventDefault();
        activeSide = side;
        startX = getClientX(e);
        startLeftWidth = leftCol.getBoundingClientRect().width;
        startRightWidth = rightCol.getBoundingClientRect().width;
        container.classList.add("is-resizing");
        (side === "left" ? resizerLeft : resizerRight).classList.add("is-dragging");
    }

    function onMove(e) {
        if (!activeSide) return;
        const containerWidth = container.getBoundingClientRect().width;
        const minCol = 210;
        const minMid = 260;
        const resizersTotal = 14;
        const dx = getClientX(e) - startX;

        if (activeSide === "left") {
            const currentRight = rightCol.getBoundingClientRect().width;
            const maxLeft = Math.max(minCol, containerWidth - currentRight - minMid - resizersTotal);
            const newLeft = Math.round(Math.min(Math.max(minCol, startLeftWidth + dx), maxLeft));
            leftCol.style.flex = `0 0 ${newLeft}px`;
            leftCol.style.width = `${newLeft}px`;
        } else if (activeSide === "right") {
            const currentLeft = leftCol.getBoundingClientRect().width;
            const maxRight = Math.max(minCol, containerWidth - currentLeft - minMid - resizersTotal);
            const newRight = Math.round(Math.min(Math.max(minCol, startRightWidth - dx), maxRight));
            rightCol.style.flex = `0 0 ${newRight}px`;
            rightCol.style.width = `${newRight}px`;
        }
    }

    function endDrag() {
        if (!activeSide) return;
        container.classList.remove("is-resizing");
        resizerLeft.classList.remove("is-dragging");
        resizerRight.classList.remove("is-dragging");
        activeSide = null;

        try {
            localStorage.setItem("qbank_col_widths", JSON.stringify({
                left: Math.round(leftCol.getBoundingClientRect().width),
                right: Math.round(rightCol.getBoundingClientRect().width)
            }));
        } catch (e) {}
    }

    resizerLeft.addEventListener("mousedown", e => startDrag("left", e));
    resizerRight.addEventListener("mousedown", e => startDrag("right", e));
    resizerLeft.addEventListener("touchstart", e => startDrag("left", e), { passive: false });
    resizerRight.addEventListener("touchstart", e => startDrag("right", e), { passive: false });

    resizerLeft.addEventListener("dblclick", resetQbankColWidths);
    resizerRight.addEventListener("dblclick", resetQbankColWidths);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", endDrag);
}

// ============================================================================
// 7. MỞ & ĐỊNH VỊ DROPDOWN MENU CHÍNH XÁC (BẢO VỆ CHỈ ADMIN ĐƯỢC MỞ)
// ============================================================================
function toggleQbankMenu(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!requireQbankAdminOrPrompt()) return;

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

    const exportPop = document.getElementById("qbank-export-popover");
    const exportTrigger = document.getElementById("btn-qbank-export-file");
    if (exportPop && exportPop.classList.contains("show")) {
        if (!exportPop.contains(e.target) && !(exportTrigger && exportTrigger.contains(e.target))) {
            closeQbankExportPopover();
        }
    }
});

async function openQbankCreatorModal() {
    if (!requireQbankAdminOrPrompt()) return;

    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");

    const modal = document.getElementById("modal-qbank-creator");
    if (modal) {
        modal.style.display = "flex";
        loadQbankTreeData();
        await loadQbankDraftState();
        initQbankColumnResizers();

        syncAssignModeButtonsUI();
        updateQbankUndoButtonUI();
        updateQbankDeleteSelectedButtonUI();
        renderQbankHeaderAndMidExamTitle();
        renderQbankTree();
        renderQbankQuestions();
        updateQbankMatrixStats();
        updateQbankBuilderStats();
    }
}

function closeQbankCreatorModal() {
    closeQbankExportPopover();
    const modal = document.getElementById("modal-qbank-creator");
    if (modal) modal.style.display = "none";
}

function openSavedExamsModal() {
    if (!requireQbankAdminOrPrompt()) return;

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
// 8. MỞ SOI ĐỀ TỪ NGÂN HÀNG CÂU HỎI
// ============================================================================
function openSoiDeFromQBank() {
    if (!requireQbankAdminOrPrompt()) return;
    if (qbankState.rawQuestions.length === 0) {
        alert("⚠️ Ngân hàng đề đang trống. Vui lòng thêm câu hỏi trước khi Soi đề!");
        return;
    }
    closeQbankExportPopover();
    if (typeof soiDeState !== "undefined") {
        soiDeState.examData = {
            id: "qbank_preview_" + Date.now(),
            title: qbankState.currentExamTitle || "NGÂN HÀNG CÂU HỎI",
            maDe: "QBANK",
            timeLimitMinutes: 120,
            images: JSON.parse(JSON.stringify(qbankState.imagesMap)),
            questions: JSON.parse(JSON.stringify(qbankState.rawQuestions)),
            scoringConfig: { mode: "option1" }
        };
        soiDeState.isFromQBank = true;
        if (typeof ensureSoiDeModalInDOM === "function") ensureSoiDeModalInDOM();
        openSoiDeModal();
    } else {
        alert("⚠️ Lỗi: Không tìm thấy công cụ Soi Đề!");
    }
}

// ============================================================================
// 9. CỘT 1: CÂY THƯ MỤC & MA TRẬN PHÂN LOẠI 16 Ô
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
    return formatNodeSlugForId(name);
}

function getHierarchicalPrefix(targetId) {
    return getFolderPathNodes(targetId).map(n => formatNodeSlugForId(n.name)).join("-");
}

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

// TỰ ĐỘNG MỞ RỘNG MA TRẬN 16 Ô KHI KÉO CÂU HỎI ĐI QUA THƯ MỤC LÁ ĐANG ĐÓNG
function handleLeafTreeDragOver(e, folderId, isLeaf) {
    if (!qbankState.draggedQId) return;
    e.preventDefault();
    if (isLeaf && !qbankState.expandedLeafMatrixIds.has(folderId)) {
        qbankState.expandedLeafMatrixIds.add(folderId);
        renderQbankTree();
    }
}

function renderQbankTree() {
    const rootEl = document.getElementById("qbank-tree-root");
    if (!rootEl) return;

    const directFolderCounts = {};
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && q.folderId) {
            directFolderCounts[q.folderId] = (directFolderCounts[q.folderId] || 0) + 1;
        }
    });

    function getSubtreeQuestionCount(node) {
        let sum = directFolderCounts[node.id] || 0;
        if (node.children && node.children.length > 0) {
            node.children.forEach(c => { sum += getSubtreeQuestionCount(c); });
        }
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
        let subHtml = "";

        if (!isLeaf) {
            subHtml = `<div class="tree-children">${node.children.map(child => buildNodeHtml(child, depth + 1)).join("")}</div>`;
        }

        let matrixDropHtml = "";
        const isMatrixOpen = isLeaf && qbankState.expandedLeafMatrixIds.has(node.id);

        if (isLeaf && isMatrixOpen) {
            const counts = {
                1: { nb: 0, th: 0, vdt: 0, vdc: 0 },
                2: { nb: 0, th: 0, vdt: 0, vdc: 0 },
                3: { nb: 0, th: 0, vdt: 0, vdc: 0 },
                4: { nb: 0, th: 0, vdt: 0, vdc: 0 }
            };

            (qbankState.rawQuestions || []).forEach(q => {
                if (q && q.folderId === node.id) {
                    const p = getQbankQuestionPart(q);
                    const lvl = q.level || "nb";
                    if (counts[p] && counts[p][lvl] !== undefined) {
                        counts[p][lvl]++;
                    }
                }
            });

            matrixDropHtml = `
                <div class="leaf-matrix-container" onclick="event.stopPropagation()">
                    <div class="leaf-matrix-header-bar">
                        <span>📥 Ma trận 16 ô (${escapeQbankHtml(node.name)}):</span>
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
                     ondragover="handleLeafTreeDragOver(event, '${node.id}', ${isLeaf})"
                     style="border-left: 3.5px solid transparent;">
                    
                    <div style="display:flex; align-items:center; gap:5px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:13px;">${isLeaf ? '📄' : '📁'}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; color:${nodeColor}; font-weight:800;" title="${escapeQbankHtml(node.name)}">${escapeQbankHtml(node.name)}</span>
                        ${subtreeCount > 0 ? `<span class="tree-q-count" title="Số câu đã lưu trong mục này">${subtreeCount}</span>` : ''}
                    </div>

                    <div style="display:flex; align-items:center; gap:2px;" onclick="event.stopPropagation()">
                        ${isLeaf ? `
                            <button class="btn-matrix-toggle ${isMatrixOpen ? 'is-open' : ''}" 
                                    onclick="toggleLeafMatrixDisplay('${node.id}', event)" 
                                    title="${isMatrixOpen ? 'Thu gọn ma trận 16 ô' : 'Mở rộng ma trận 16 ô để xếp câu'}">
                                ⊞
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

// CLICK CHỌN THƯ MỤC: LỌC CÂU HỎI CỦA THƯ MỤC ĐÓ
function handleFolderNodeClick(folderId) {
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);

    qbankState.activeFilter = {
        folderId: folderId,
        folderName: qbankState.activeFolderObj ? qbankState.activeFolderObj.name : "",
        part: null,
        level: null
    };

    const node = qbankState.activeFolderObj;
    if (node && (!node.children || node.children.length === 0)) {
        qbankState.expandedLeafMatrixIds.add(folderId);
    }

    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

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
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function handleMatrixCellClick(folderId, part, level) {
    const selectedUnassigned = Array.from(qbankState.selectedQuestionIds).filter(qId => {
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        return q && !q.folderId;
    });

    if (selectedUnassigned.length > 0 && selectedUnassigned.length === qbankState.selectedQuestionIds.size) {
        assignSelectedQuestionsToMatrix(folderId, part, level);
    } else {
        const node = findNodeInTree(qbankState.currentTree, folderId);
        qbankState.activeFolderId = folderId;
        qbankState.activeFolderObj = node;
        qbankState.activeFilter = {
            folderId: folderId,
            folderName: node ? node.name : "",
            part: part,
            level: level
        };
        syncAssignModeButtonsUI();
        renderQbankTree();
        renderQbankQuestions();
        updateQbankMatrixStats();
    }
}

function syncAssignModeButtonsUI() {
    const assignBtn = document.getElementById("btn-toggle-assigned");
    if (assignBtn) {
        const isAssignActive = qbankState.assignMode && !qbankState.activeFilter.folderId && !qbankState.hideAssigned;
        assignBtn.classList.toggle("is-active", isAssignActive);
        assignBtn.innerHTML = isAssignActive
            ? `<span>📦</span> <b>Xếp câu (Đang bật)</b>`
            : `<span>📦</span> <b>Xếp câu (Trên cùng)</b>`;
    }

    const hideBtn = document.getElementById("btn-qbank-hide-assigned");
    if (hideBtn) {
        hideBtn.classList.toggle("is-active", qbankState.hideAssigned);
        hideBtn.innerHTML = qbankState.hideAssigned
            ? `<span>👁️</span> <b>Đang ẩn đã xếp</b>`
            : `<span>🙈</span> <b>Ẩn đã xếp</b>`;
    }
}

// HỦY TOÀN BỘ BỘ LỌC ĐỂ XEM TOÀN BỘ NGÂN HÀNG (VẪN XẾP CÂU CÓ ID LÊN TRÊN, CHƯA XẾP Ở DƯỚI)
function clearQbankFilter() {
    qbankState.activeFilter = {
        folderId: null,
        folderName: null,
        part: null,
        level: null
    };
    qbankState.activeFolderId = null;
    qbankState.activeFolderObj = null;
    qbankState.assignMode = false;
    qbankState.hideAssigned = false;

    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

// NÚT CHẾ ĐỘ XẾP CÂU: ĐƯA CÂU ĐÃ ĐÁNH SỐ ID LÊN TRÊN CÙNG, CÂU CHƯA XẾP THEO THỨ TỰ NẰM PHÍA DƯỚI
function toggleQbankAssignMode() {
    if (qbankState.activeFilter.folderId || qbankState.hideAssigned || !qbankState.assignMode) {
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null;
        qbankState.activeFolderObj = null;
        qbankState.hideAssigned = false;
        qbankState.assignMode = true;
    } else {
        qbankState.assignMode = false;
    }
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

// NÚT TÙY CHỌN ẨN CÂU ĐÃ XẾP
function toggleHideAssignedQuestions() {
    if (qbankState.activeFilter.folderId) {
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null;
        qbankState.activeFolderObj = null;
        qbankState.hideAssigned = true;
    } else {
        qbankState.hideAssigned = !qbankState.hideAssigned;
    }
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function promptRenameFolder(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    const newName = prompt("✏️ Đổi tên thư mục:", node.name);
    if (newName && newName.trim() && newName.trim() !== node.name) {
        pushQbankUndoState(`Đổi tên thư mục "${node.name}"`);
        node.name = newName.trim();
        if (qbankState.activeFilter.folderId === folderId) {
            qbankState.activeFilter.folderName = node.name;
        }
        recomputeAllMatrixIds();
        saveQbankTreeData();
        saveQbankDraftState(false);
        renderQbankTree();
        renderQbankQuestions();
        updateQbankMatrixStats();
        refreshQbankExportPopoverIfOpen();
        showQbankToast(`✏️ Đã đổi tên thành "${node.name}" và tự động cập nhật ID!`, "success");
    }
}

function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Lớp 10):");
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm thư mục gốc "${name.trim()}"`);
        qbankState.currentTree.push({
            id: "node_" + Date.now(),
            name: name.trim(),
            color: QBANK_COLOR_PALETTE[Math.floor(Math.random() * QBANK_COLOR_PALETTE.length)],
            children: []
        });
        saveQbankTreeData();
        saveQbankDraftState(false);
        renderQbankTree();
        refreshQbankExportPopoverIfOpen();
    }
}

function promptAddChildFolder(parentId) {
    const parent = findNodeInTree(qbankState.currentTree, parentId);
    if (!parent) return;
    const name = prompt(`📁 Thêm mục con vào [${parent.name}]:`);
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm mục con "${name.trim()}"`);
        if (!parent.children) parent.children = [];
        parent.children.push({
            id: "node_" + Date.now(),
            name: name.trim(),
            color: parent.color,
            children: []
        });
        saveQbankTreeData();
        saveQbankDraftState(false);
        renderQbankTree();
        refreshQbankExportPopoverIfOpen();
    }
}

function promptChangeFolderColor(folderId) {
    const colors = QBANK_COLOR_PALETTE;
    let colorHtml = `<div style="display:flex; gap:8px; justify-content:center; margin:10px 0;">`;
    colors.forEach(c => {
        colorHtml += `<div onclick="applyFolderColorChange('${folderId}', '${c}')" style="width:24px; height:24px; border-radius:50%; background:${c}; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`;
    });
    colorHtml += `</div>`;

    let div = document.createElement("div");
    div.className = "qbank-modal-overlay";
    div.id = "color-picker-modal";
    div.style.display = "flex";
    div.innerHTML = `
        <div class="qbank-modal-container" style="width: 320px; height: auto; padding: 22px; background:#fff; box-shadow:0 25px 60px rgba(0,0,0,0.5);">
            <h3 style="margin-top:0; color:#0f172a; font-weight:900; font-size:15px; text-align:center;">🎨 Chọn màu thư mục</h3>
            ${colorHtml}
            <button onclick="document.getElementById('color-picker-modal').remove()" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; cursor:pointer; font-weight:800; color:#475569; margin-top:10px;">Đóng</button>
        </div>
    `;
    document.body.appendChild(div);
}

window.applyFolderColorChange = function(folderId, newColor) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (node) {
        node.color = newColor;
        saveQbankTreeData();
        renderQbankTree();
        refreshQbankExportPopoverIfOpen();
    }
    const modal = document.getElementById("color-picker-modal");
    if (modal) modal.remove();
};

function promptDeleteFolder(folderId) {
    const targetNode = findNodeInTree(qbankState.currentTree, folderId);
    if (!targetNode) return;
    if (!confirm(`⚠️ Bạn có chắc muốn xóa thư mục "${targetNode.name}" và tất cả mục con?\n(Các câu hỏi bên trong sẽ được trả về trạng thái chưa xếp để không bị mất).`)) return;

    pushQbankUndoState(`Xóa thư mục "${targetNode.name}"`);

    const deletedIds = new Set(getAllDescendantFolderIds(targetNode));
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && q.folderId && deletedIds.has(q.folderId)) {
            q.folderId = null;
            q.folderName = "";
            q.matrixId = "";
            q.matrixSeq = 0;
            q.matrixPathSlug = "";
            delete q.assignedAt;
        }
    });

    const parent = findParentNodeInTree(qbankState.currentTree, folderId);
    if (parent) {
        parent.children = parent.children.filter(c => c.id !== folderId);
    } else {
        qbankState.currentTree = qbankState.currentTree.filter(c => c.id !== folderId);
    }
    if (qbankState.activeFolderId && deletedIds.has(qbankState.activeFolderId)) {
        qbankState.activeFolderId = null;
        qbankState.activeFolderObj = null;
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    }

    deletedIds.forEach(id => qbankState.exportSelectedFolderIds.delete(id));

    recomputeAllMatrixIds();
    saveQbankTreeData();
    saveQbankDraftState(false);
    syncAssignModeButtonsUI();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    refreshQbankExportPopoverIfOpen();
    showQbankToast(`🗑️ Đã xóa thư mục "${targetNode.name}". Bấm Lùi để khôi phục nếu nhầm.`, "warning");
}

function selectQbankFolder(folderId) {
    handleFolderNodeClick(folderId);
}

function saveQbankTreeData() {
    try { localStorage.setItem("qbank_tree_structure", JSON.stringify(qbankState.currentTree)); } catch (e) {}
}

function loadQbankTreeData() {
    try {
        const local = localStorage.getItem("qbank_tree_structure");
        if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) qbankState.currentTree = parsed;
        }
    } catch (e) {}
}

// ============================================================================
// 10. KÉO THẢ & GÁN VÀO MA TRẬN 16 Ô (CÓ UNDO + TỰ ĐỘNG ĐÁNH ID ĐỎ + XẾP LÊN ĐẦU)
// ============================================================================
function handleDropZoneOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
}

function handleDropZoneLeave(e) {
    e.currentTarget.classList.remove("drag-over");
}

function mutateQuestionMatrix(qId, folderId, part, level, assignedTimestamp = null) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return null;

    if (part === 1) {
        q.type = "multiple_choice";
        delete q.part;
        delete q.isPart4;
        if (!q.options) q.options = ["A", "B", "C", "D"];
    } else if (part === 2) {
        q.type = "true_false";
        delete q.part;
        delete q.isPart4;
        if (!q.statements) q.statements = [{ id: "a", statement: "", correct: true }];
    } else if (part === 3) {
        q.type = "short_answer";
        delete q.part;
        delete q.isPart4;
    } else if (part === 4) {
        q.type = "short_answer";
        q.part = 4;
    }

    q.level = level;
    q.folderId = folderId;
    q.assignedAt = assignedTimestamp || Date.now();

    const currentFolderTarget = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = currentFolderTarget ? currentFolderTarget.name : "";
    return q;
}

function handleDropZoneDrop(e, folderId, part, level) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");

    const qId = e.dataTransfer.getData("text/plain") || qbankState.draggedQId;
    qbankState.draggedQId = null;
    if (!qId) return;

    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";

    // Hỗ trợ kéo thả hàng loạt nếu câu đang kéo nằm trong danh sách đã tích chọn nhiều câu
    const isMultiDrag = qbankState.selectedQuestionIds.has(String(qId)) && qbankState.selectedQuestionIds.size > 1;
    const idsToMove = isMultiDrag ? Array.from(qbankState.selectedQuestionIds) : [String(qId)];

    pushQbankUndoState(`Xếp ${idsToMove.length} câu vào ${folderLabel} (P${part} - ${getQbankLevelLabel(level)})`);

    const baseTs = Date.now();
    let lastMovedQ = null;
    idsToMove.forEach((id, idx) => {
        const moved = mutateQuestionMatrix(id, folderId, part, level, baseTs + idx);
        if (moved) lastMovedQ = moved;
    });

    if (isMultiDrag) {
        qbankState.selectedQuestionIds.clear();
        updateQbankDeleteSelectedButtonUI();
    }

    if (!lastMovedQ) return;

    recomputeAllMatrixIds();
    saveQbankDraftState(false);

    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    if (idsToMove.length > 1) {
        showQbankToast(`✅ Đã xếp ${idsToMove.length} câu vào ${folderLabel} (mới nhất: ${lastMovedQ.matrixId})`, "success");
    } else {
        showQbankToast(`✅ Đã đánh số & xếp lên đầu: ${lastMovedQ.matrixId}`, "success");
    }
}

function assignSelectedQuestionsToMatrix(folderId, part, level) {
    if (qbankState.selectedQuestionIds.size === 0) return;

    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const count = qbankState.selectedQuestionIds.size;

    pushQbankUndoState(`Xếp ${count} câu vào ${folderLabel} (P${part} - ${getQbankLevelLabel(level)})`);

    const baseTs = Date.now();
    let idx = 0;
    qbankState.selectedQuestionIds.forEach(qId => {
        mutateQuestionMatrix(qId, folderId, part, level, baseTs + idx);
        idx++;
    });
    qbankState.selectedQuestionIds.clear();

    recomputeAllMatrixIds();
    saveQbankDraftState(false);

    updateQbankDeleteSelectedButtonUI();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    showQbankToast(`✅ Đã đánh số & xếp ${count} câu vào ${folderLabel} (P${part} - ${getQbankLevelLabel(level)})`, "success");
}

function applyMatrixToQuestion(qId, folderId, part, level) {
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    pushQbankUndoState(`Chuyển câu vào ${folderLabel} (P${part} - ${getQbankLevelLabel(level)})`);

    const q = mutateQuestionMatrix(qId, folderId, part, level, Date.now());
    if (!q) return;

    recomputeAllMatrixIds();
    saveQbankDraftState(false);

    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    showQbankToast(`✅ Đã chuyển câu: ${q.matrixId}`, "success");
}

// BỎ XẾP 1 CÂU: TRẢ VỀ TRẠNG THÁI CHƯA XẾP Ở PHÍA DƯỚI THEO THỨ TỰ GỐC
function unassignQbankQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q || !q.folderId) return;

    const oldMatrixId = q.matrixId || "câu hỏi";
    pushQbankUndoState(`Bỏ xếp ${oldMatrixId}`);

    q.folderId = null;
    q.folderName = "";
    q.matrixId = "";
    q.matrixSeq = 0;
    q.matrixPathSlug = "";
    delete q.assignedAt;

    recomputeAllMatrixIds();
    saveQbankDraftState(false);

    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    showQbankToast(`↩️ Đã trả câu về mục Chưa xếp (giữ nguyên thứ tự gốc)!`, "info");
}

// ============================================================================
// 11. CHUYỂN, XÓA LẺ & XÓA NHIỀU CÂU ĐÃ TÍCH CHỌN (ĐỀU CÓ UNDO & TỰ CẬP NHẬT ID)
// ============================================================================
function pruneStaleSelectedQuestionIds() {
    const existingIds = new Set((qbankState.rawQuestions || []).map(q => String(q.id)));
    const cleaned = new Set();
    qbankState.selectedQuestionIds.forEach(id => {
        if (existingIds.has(String(id))) cleaned.add(String(id));
    });
    qbankState.selectedQuestionIds = cleaned;
    return cleaned.size;
}

function updateQbankDeleteSelectedButtonUI() {
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!btn) return;
    const count = pruneStaleSelectedQuestionIds();

    if (count > 0) {
        btn.classList.add("has-selection");
        btn.innerHTML = `<span>🗑️</span> <span>Xóa nhiều câu (${count})</span>`;
        btn.title = `Xóa ${count} câu hỏi đã tích chọn (Có thể bấm ↩️ Lùi nếu xóa nhầm)`;
    } else {
        btn.classList.remove("has-selection");
        btn.innerHTML = `<span>🗑️</span> <span>Xóa nhiều câu</span>`;
        btn.title = "Tích chọn (☑️) một hoặc nhiều câu hỏi bên dưới rồi bấm nút này để xóa hàng loạt";
    }
}

function deleteSelectedQbankQuestions() {
    const count = pruneStaleSelectedQuestionIds();
    if (count === 0) {
        showQbankToast("⚠️ Vui lòng tích chọn (☑️) ít nhất 1 câu hỏi ở danh sách bên dưới trước khi xóa!", "warning");
        return;
    }

    if (!confirm(`⚠️ Bạn có chắc chắn muốn XÓA ${count} câu hỏi đã tích chọn khỏi hệ thống biên soạn không?\n\n(Thầy có thể bấm nút ↩️ Lùi nếu lỡ tay xóa nhầm).`)) {
        return;
    }

    pushQbankUndoState(`Xóa ${count} câu đã chọn`);

    const idsToDelete = new Set(qbankState.selectedQuestionIds);
    qbankState.rawQuestions = (qbankState.rawQuestions || []).filter(q => !idsToDelete.has(String(q.id)));
    qbankState.selectedQuestionIds.clear();

    recomputeAllMatrixIds();
    saveQbankDraftState(false);

    updateQbankDeleteSelectedButtonUI();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    showQbankToast(`🗑️ Đã xóa ${count} câu hỏi đã chọn! Bấm ↩️ Lùi để khôi phục nếu xóa nhầm.`, "warning");
}

function deleteQbankQuestion(qId) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn xóa câu hỏi này khỏi hệ thống biên soạn?")) return;

    const target = qbankState.rawQuestions.find(q => String(q.id) === String(qId));
    const label = target && target.matrixId ? target.matrixId : "1 câu hỏi";
    pushQbankUndoState(`Xóa ${label}`);

    qbankState.rawQuestions = qbankState.rawQuestions.filter(q => String(q.id) !== String(qId));
    qbankState.selectedQuestionIds.delete(String(qId));

    recomputeAllMatrixIds();
    saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    updateQbankBuilderStats();
    refreshQbankExportPopoverIfOpen();

    showQbankToast(`🗑️ Đã xóa ${label}. Bấm Lùi nếu xóa nhầm.`, "warning");
}

function promptMoveQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;

    let options = [];
    function traverse(nodes, path) {
        nodes.forEach(n => {
            let currentPath = path ? path + " > " + n.name : n.name;
            if (!n.children || n.children.length === 0) {
                options.push({ id: n.id, name: currentPath });
            } else {
                traverse(n.children, currentPath);
            }
        });
    }
    traverse(qbankState.currentTree, "");

    if (options.length === 0) return alert("Chưa có thư mục lá nào để chuyển!");

    const currentPart = getQbankQuestionPart(q);
    const currentLevel = q.level || "nb";

    let selectHtml = `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">1. Chọn thư mục lưu trữ:</label><select id="move-qbank-folder" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700; color:#0f172a; outline:none;">`;
    options.forEach(o => {
        const isSel = o.id === q.folderId ? "selected" : "";
        selectHtml += `<option value="${o.id}" ${isSel}>${escapeQbankHtml(o.name)}</option>`;
    });
    selectHtml += `</select></div>`;

    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">2. Chọn Phần thi:</label><select id="move-qbank-part" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700; color:#0f172a; outline:none;">
        <option value="1" ${currentPart === 1 ? "selected" : ""}>Phần I: Trắc nghiệm 4 lựa chọn</option>
        <option value="2" ${currentPart === 2 ? "selected" : ""}>Phần II: Trắc nghiệm Đúng/Sai</option>
        <option value="3" ${currentPart === 3 ? "selected" : ""}>Phần III: Trả lời ngắn</option>
        <option value="4" ${currentPart === 4 ? "selected" : ""}>Phần IV: Tự luận ngắn</option>
    </select></div>`;

    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">3. Chọn Mức độ nhận thức:</label><select id="move-qbank-level" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700; color:#0f172a; outline:none;">
        <option value="nb" ${currentLevel === "nb" ? "selected" : ""}>Nhận biết (NB)</option>
        <option value="th" ${currentLevel === "th" ? "selected" : ""}>Thông hiểu (TH)</option>
        <option value="vdt" ${currentLevel === "vdt" ? "selected" : ""}>Vận dụng (VD)</option>
        <option value="vdc" ${currentLevel === "vdc" ? "selected" : ""}>Vận dụng cao (VDC)</option>
    </select></div>`;

    let div = document.createElement("div");
    div.className = "qbank-modal-overlay";
    div.id = "move-qbank-modal";
    div.style.display = "flex";
    div.innerHTML = `
        <div class="qbank-modal-container" style="width: 50vw; min-width: 320px; max-width: 520px; height: auto; padding: 22px; overflow:visible; background:#ffffff; box-shadow:0 25px 60px rgba(0,0,0,0.5);">
            <h3 style="margin-top:0; color:#0284c7; font-weight:900; font-size:17px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:14px;">🔄 CHUYỂN CÂU HỎI SANG MỤC KHÁC</h3>
            ${selectHtml}
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button onclick="document.getElementById('move-qbank-modal').remove()" style="flex:1; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:800; color:#475569; transition:0.15s;">✕ Hủy bỏ</button>
                <button onclick="executeMoveQbankQuestion('${qId}')" style="flex:1.5; padding:10px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; cursor:pointer; font-weight:900; box-shadow:0 4px 10px rgba(2,132,199,0.3); transition:0.15s;">🚀 Xác nhận chuyển</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

function executeMoveQbankQuestion(qId) {
    let folderSel = document.getElementById("move-qbank-folder");
    let partSel = document.getElementById("move-qbank-part");
    let levelSel = document.getElementById("move-qbank-level");

    if (!folderSel || !partSel || !levelSel) return;

    let targetFolderId = folderSel.value;
    let targetPart = parseInt(partSel.value, 10);
    let targetLevel = levelSel.value;

    let targetFolder = findNodeInTree(qbankState.currentTree, targetFolderId);
    let q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));

    if (q && targetFolder) {
        applyMatrixToQuestion(qId, targetFolderId, targetPart, targetLevel);
        const modal = document.getElementById("move-qbank-modal");
        if (modal) modal.remove();
    }
}

// ============================================================================
// 11.5. XUẤT FILE (PDF / WORD) THEO CÂY THƯ MỤC NGÂN HÀNG ĐỀ
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
        if (id === QBANK_EXPORT_UNASSIGNED_KEY) {
            if (hasUnassigned) cleaned.add(id);
        } else if (validIds.has(id)) {
            cleaned.add(id);
        }
    });
    qbankState.exportSelectedFolderIds = cleaned;
}

function toggleQbankExportPopover(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const popover = document.getElementById("qbank-export-popover");
    const triggerBtn = document.getElementById("btn-qbank-export-file");
    if (!popover || !triggerBtn) return;

    if (popover.classList.contains("show")) {
        closeQbankExportPopover();
        return;
    }

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
    let left = rect.left;
    if (left + popWidth > window.innerWidth - 12) {
        left = window.innerWidth - popWidth - 12;
    }
    if (left < 12) left = 12;

    let top = rect.bottom + 8;
    const approxHeight = Math.min(popover.offsetHeight || 420, window.innerHeight * 0.78);
    if (top + approxHeight > window.innerHeight - 12) {
        top = Math.max(12, window.innerHeight - approxHeight - 12);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
}

function closeQbankExportPopover() {
    const popover = document.getElementById("qbank-export-popover");
    const triggerBtn = document.getElementById("btn-qbank-export-file");
    const formatMenu = document.getElementById("qbank-export-format-menu");
    if (popover) popover.classList.remove("show");
    if (triggerBtn) triggerBtn.classList.remove("is-open");
    if (formatMenu) formatMenu.classList.remove("show", "open-upward");
}

function handleQbankExportPopoverInnerClick(event) {
    event.stopPropagation();
    const actionWrap = document.getElementById("qbank-export-action-wrapper");
    const formatMenu = document.getElementById("qbank-export-format-menu");
    if (formatMenu && formatMenu.classList.contains("show")) {
        if (!actionWrap || !actionWrap.contains(event.target)) {
            formatMenu.classList.remove("show", "open-upward");
        }
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
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (qbankState.exportCollapsedFolderIds.has(folderId)) {
        qbankState.exportCollapsedFolderIds.delete(folderId);
    } else {
        qbankState.exportCollapsedFolderIds.add(folderId);
    }
    renderQbankExportTree();
}

function getExportNodeCheckState(node) {
    const isLeaf = (!node.children || node.children.length === 0);
    if (isLeaf) {
        return {
            checked: qbankState.exportSelectedFolderIds.has(node.id),
            indeterminate: false
        };
    }

    const descendantIds = getAllDescendantFolderIds(node).filter(id => id !== node.id);
    if (descendantIds.length === 0) {
        return {
            checked: qbankState.exportSelectedFolderIds.has(node.id),
            indeterminate: false
        };
    }

    let selectedCount = 0;
    descendantIds.forEach(id => {
        if (qbankState.exportSelectedFolderIds.has(id)) selectedCount++;
    });

    if (selectedCount === descendantIds.length) {
        return { checked: true, indeterminate: false };
    }
    if (selectedCount > 0 || qbankState.exportSelectedFolderIds.has(node.id)) {
        return { checked: false, indeterminate: true };
    }
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
            const hasDirectQ = (qbankState.rawQuestions || []).some(q => q && q.folderId === anc.id);
            if (!hasDirectQ) {
                qbankState.exportSelectedFolderIds.delete(anc.id);
            }
        }
    }

    renderQbankExportTree();
    updateQbankExportFooterUI();
}

function toggleQbankExportUnassignedCheck(isChecked) {
    if (isChecked) {
        qbankState.exportSelectedFolderIds.add(QBANK_EXPORT_UNASSIGNED_KEY);
    } else {
        qbankState.exportSelectedFolderIds.delete(QBANK_EXPORT_UNASSIGNED_KEY);
    }
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
        const hasUnassigned = (qbankState.rawQuestions || []).some(q => q && !q.folderId);
        if (hasUnassigned) {
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
        if (q.folderId) {
            directCounts[q.folderId] = (directCounts[q.folderId] || 0) + 1;
        } else {
            unassignedCount++;
        }
    });

    function getSubtreeCount(node) {
        let sum = directCounts[node.id] || 0;
        if (node.children && node.children.length > 0) {
            node.children.forEach(c => { sum += getSubtreeCount(c); });
        }
        return sum;
    }

    const indeterminateIds = [];

    function buildExportNodeHtml(node) {
        const isLeaf = (!node.children || node.children.length === 0);
        const isCollapsed = !isLeaf && qbankState.exportCollapsedFolderIds.has(node.id);
        const count = getSubtreeCount(node);
        const state = getExportNodeCheckState(node);
        const nodeColor = node.color || "#0284c7";

        if (state.indeterminate) {
            indeterminateIds.push(node.id);
        }

        const toggleBtnHtml = !isLeaf
            ? `<button type="button" class="export-tree-toggle" onclick="toggleQbankExportNodeExpand('${node.id}', event)" title="${isCollapsed ? 'Mở rộng' : 'Thu gọn'}">${isCollapsed ? '▶' : '▼'}</button>`
            : `<span class="export-tree-toggle-spacer"></span>`;

        const childrenHtml = (!isLeaf && !isCollapsed)
            ? `<div class="export-tree-children">${node.children.map(c => buildExportNodeHtml(c)).join("")}</div>`
            : "";

        return `
            <div class="export-tree-node">
                <div class="export-tree-row ${count === 0 ? 'is-empty-folder' : ''}">
                    ${toggleBtnHtml}
                    <label class="export-tree-label">
                        <input type="checkbox" id="exp-chk-${node.id}" ${state.checked ? "checked" : ""} onchange="toggleQbankExportFolderCheck('${node.id}', this.checked)">
                        <span style="color:${nodeColor}; font-size:13px;">${isLeaf ? '📄' : '📁'}</span>
                        <span class="export-tree-name" style="color:${nodeColor};" title="${escapeQbankHtml(node.name)}">${escapeQbankHtml(node.name)}</span>
                        <span class="export-tree-count ${count === 0 ? 'zero' : ''}">${count} câu</span>
                    </label>
                </div>
                ${childrenHtml}
            </div>
        `;
    }

    let html = (qbankState.currentTree || []).map(root => buildExportNodeHtml(root)).join("");

    if (unassignedCount > 0) {
        const isUnassignedChecked = qbankState.exportSelectedFolderIds.has(QBANK_EXPORT_UNASSIGNED_KEY);
        const curTitle = qbankState.currentExamTitle ? ` (${escapeQbankHtml(qbankState.currentExamTitle)})` : "";
        html += `
            <div class="export-tree-divider">
                <div class="export-tree-row">
                    <span class="export-tree-toggle-spacer"></span>
                    <label class="export-tree-label">
                        <input type="checkbox" id="exp-chk-unassigned" ${isUnassignedChecked ? "checked" : ""} onchange="toggleQbankExportUnassignedCheck(this.checked)">
                        <span style="font-size:13px;">📥</span>
                        <span class="export-tree-name" style="color:#b45309;">Câu chưa xếp của đề gốc${curTitle}</span>
                        <span class="export-tree-count">${unassignedCount} câu</span>
                    </label>
                </div>
            </div>
        `;
    }

    if (!html) {
        html = `<div style="text-align:center; padding:24px; color:#94a3b8; font-size:12px;">Chưa có thư mục nào trong ngân hàng đề.</div>`;
    }

    container.innerHTML = html;

    indeterminateIds.forEach(id => {
        const chk = document.getElementById(`exp-chk-${id}`);
        if (chk) chk.indeterminate = true;
    });
}

function getSelectedQbankExportQuestions() {
    const selectedSet = qbankState.exportSelectedFolderIds;
    if (!selectedSet || selectedSet.size === 0) return [];

    const includeUnassigned = selectedSet.has(QBANK_EXPORT_UNASSIGNED_KEY);
    const list = (qbankState.rawQuestions || []).filter(q => {
        if (!q) return false;
        if (q.folderId) return selectedSet.has(q.folderId);
        return includeUnassigned;
    });

    const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };
    return [...list].sort((a, b) => {
        const pA = getQbankQuestionPart(a);
        const pB = getQbankQuestionPart(b);
        if (pA !== pB) return pA - pB;

        const lvlA = levelOrder[a.level || "nb"] || 1;
        const lvlB = levelOrder[b.level || "nb"] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;

        if (a.matrixSeq && b.matrixSeq && a.folderId === b.folderId) {
            return a.matrixSeq - b.matrixSeq;
        }
        return (a.origIndex || 0) - (b.origIndex || 0);
    });
}

function onQbankExportTitleManualInput() {
    qbankState.exportCustomTitleTouched = true;
}

function buildDefaultQbankExportTitle(questionCount) {
    const selectedNames = [];
    function collectSelectedLabels(nodes) {
        (nodes || []).forEach(n => {
            const st = getExportNodeCheckState(n);
            if (st.checked) {
                selectedNames.push(n.name);
            } else if (st.indeterminate && n.children && n.children.length > 0) {
                collectSelectedLabels(n.children);
            }
        });
    }
    collectSelectedLabels(qbankState.currentTree);

    if (qbankState.exportSelectedFolderIds.has(QBANK_EXPORT_UNASSIGNED_KEY)) {
        selectedNames.push(qbankState.currentExamTitle || "Đề gốc chưa xếp");
    }

    if (selectedNames.length === 1) {
        return `NGÂN HÀNG ĐỀ - ${selectedNames[0].toUpperCase()}`;
    }
    if (selectedNames.length > 1) {
        return `ĐỀ TRÍCH XUẤT NGÂN HÀNG (${selectedNames.length} MỤC - ${questionCount} CÂU)`;
    }
    return "ĐỀ TRÍCH XUẤT TỪ NGÂN HÀNG CÂU HỎI";
}

function updateQbankExportFooterUI() {
    const summaryEl = document.getElementById("qbank-export-summary");
    const emptyHintEl = document.getElementById("qbank-export-empty-hint");
    const actionWrap = document.getElementById("qbank-export-action-wrapper");
    const btnText = document.getElementById("btn-qbank-export-options-text");
    const formatMenu = document.getElementById("qbank-export-format-menu");
    const titleInput = document.getElementById("qbank-export-title-input");

    const selectedQuestions = getSelectedQbankExportQuestions();
    const qCount = selectedQuestions.length;

    let selectedLeafCount = 0;
    qbankState.exportSelectedFolderIds.forEach(id => {
        if (id === QBANK_EXPORT_UNASSIGNED_KEY) {
            selectedLeafCount++;
        } else {
            const node = findNodeInTree(qbankState.currentTree, id);
            if (node && (!node.children || node.children.length === 0)) {
                selectedLeafCount++;
            }
        }
    });
    const hasAnySelection = qbankState.exportSelectedFolderIds.size > 0;
    const displayFolderCount = selectedLeafCount > 0 ? selectedLeafCount : qbankState.exportSelectedFolderIds.size;

    if (summaryEl) {
        summaryEl.innerHTML = `Đã chọn: <b>${displayFolderCount}</b> mục • <b>${qCount}</b> câu`;
    }

    if (titleInput && !qbankState.exportCustomTitleTouched) {
        titleInput.value = hasAnySelection ? buildDefaultQbankExportTitle(qCount) : "";
    }

    if (hasAnySelection) {
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
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const menu = document.getElementById("qbank-export-format-menu");
    const btn = document.getElementById("btn-qbank-export-options");
    if (!menu || !btn) return;

    const willShow = !menu.classList.contains("show");
    if (!willShow) {
        menu.classList.remove("show", "open-upward");
        return;
    }

    const btnRect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    menu.classList.toggle("open-upward", spaceBelow < 145);
    menu.classList.add("show");
}

function normalizeQuestionForExamOutput(rawQ, idx, imagesMap) {
    const letters = ["A", "B", "C", "D"];
    const q = JSON.parse(JSON.stringify(rawQ));
    const p = getQbankQuestionPart(q);
    q.id = idx + 1;

    const imgKey = q.imageKey || `img_q_${rawQ.id}`;
    const resolvedImg = q.imageUrl || (imagesMap && imagesMap[imgKey]) || "";
    if (resolvedImg) {
        q.imageUrl = resolvedImg;
    }

    if (p === 1) {
        q.type = "multiple_choice";
        delete q.part;
        delete q.isPart4;
        q.options = Array.isArray(q.options) ? q.options.map(o => String(o ?? "")) : ["", "", "", ""];
        if (typeof q.correct === "string") {
            const cIdx = letters.indexOf(q.correct.trim().toUpperCase());
            q.correct = cIdx !== -1 ? cIdx : 0;
        } else if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) {
            q.correct = 0;
        }
    } else if (p === 2) {
        q.type = "true_false";
        delete q.part;
        delete q.isPart4;
        q.statements = Array.isArray(q.statements) ? q.statements.map((st, sIdx) => ({
            id: st.id || ["a", "b", "c", "d"][sIdx] || String(sIdx + 1),
            statement: String(st.statement ?? ""),
            correct: (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true")
        })) : [];
    } else if (p === 4) {
        q.type = "essay";
        q.correctAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : ""));
    } else {
        q.type = "short_answer";
        delete q.part;
        delete q.isPart4;
        q.correctAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : ""));
    }

    return q;
}

function executeQbankExport(format, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const exportQuestions = getSelectedQbankExportQuestions();
    if (exportQuestions.length === 0) {
        showQbankToast("⚠️ Các thư mục đang chọn hiện có 0 câu hỏi! Vui lòng chọn thư mục có câu hỏi để xuất.", "warning");
        return;
    }

    const titleInput = document.getElementById("qbank-export-title-input");
    const exportTitle = (titleInput && titleInput.value.trim())
        ? titleInput.value.trim()
        : buildDefaultQbankExportTitle(exportQuestions.length);

    const includeKeyChk = document.getElementById("qbank-export-include-key");
    const includeKey = includeKeyChk ? !!includeKeyChk.checked : true;

    const normalizedQuestions = exportQuestions.map((rawQ, idx) =>
        normalizeQuestionForExamOutput(rawQ, idx, qbankState.imagesMap)
    );

    const exportData = {
        title: exportTitle,
        maDe: "QBANK",
        timeLimitMinutes: 90,
        questions: normalizedQuestions,
        images: { ...(qbankState.imagesMap || {}) }
    };

    if (format === "pdf") {
        if (typeof exportExamToPDF !== "function") {
            alert("❌ Không tìm thấy bộ xuất PDF (portal-exam-printer.js)!");
            return;
        }
        closeQbankExportPopover();
        exportExamToPDF(exportData, exportTitle, "QBANK", 90, includeKey);
        showQbankToast(`📄 Đã mở bản xem in / Xuất PDF (${normalizedQuestions.length} câu)!`, "success");
    } else if (format === "word") {
        if (typeof exportExamToWord !== "function") {
            alert("❌ Không tìm thấy bộ xuất Word (portal-exam-printer.js)!");
            return;
        }
        closeQbankExportPopover();
        exportExamToWord(exportData, exportTitle, "QBANK", 90, includeKey);
        showQbankToast(`📝 Đã tải xuống file Word (.doc) gồm ${normalizedQuestions.length} câu!`, "success");
    }
}

// ============================================================================
// 12. CỘT 2: UPLOAD FILE JSON ĐỀ MỚI
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
    } catch (e) {}

    try {
        let scriptText = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, "return ");
        return new Function(scriptText)();
    } catch (e) {
        clean = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, "").trim();
        clean = clean.replace(/;?(\s*\/\*[\s\S]*?\*\/|\s*\/\/.*)*\s*$/, "").trim();
        if (clean.endsWith(";")) clean = clean.slice(0, -1).trim();
        try {
            return new Function("return (" + clean + ");")();
        } catch (e2) {
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
            let parsedImages = {};
            let examTitle = file.name.replace(/\.[^/.]+$/, "");

            if (Array.isArray(parsed)) {
                rawQ = parsed;
            } else if (parsed.questions && Array.isArray(parsed.questions)) {
                rawQ = parsed.questions;
                if (parsed.title && String(parsed.title).trim()) {
                    examTitle = String(parsed.title).trim();
                }
                if (parsed.images && typeof parsed.images === "object") {
                    parsedImages = parsed.images;
                }
            }

            if (rawQ.length === 0) {
                throw new Error("File đề thi không có câu hỏi nào!");
            }

            pushQbankUndoState(`Upload đề mới "${examTitle}"`);

            // GIỮ NGUYÊN 100% CÁC CÂU ĐÃ XẾP VÀO THƯ MỤC NGÂN HÀNG
            const keptAssignedQuestions = (qbankState.rawQuestions || []).filter(q => Boolean(q && q.folderId));
            const keptIds = new Set(keptAssignedQuestions.map(q => String(q.id)));

            const cleanedSelected = new Set();
            qbankState.selectedQuestionIds.forEach(id => {
                if (keptIds.has(String(id))) cleanedSelected.add(String(id));
            });
            qbankState.selectedQuestionIds = cleanedSelected;

            if (Object.keys(parsedImages).length > 0) {
                Object.assign(qbankState.imagesMap, parsedImages);
            }

            const nowTs = Date.now();
            const importedQuestions = rawQ.map((item, idx) => {
                const q = JSON.parse(JSON.stringify(item));
                q.id = `qb_${nowTs}_${idx + 1}`;
                q.origIndex = idx + 1;
                q.sourceExam = examTitle;
                q.folderId = null;
                q.folderName = "";
                q.matrixId = "";
                q.matrixSeq = 0;
                q.matrixPathSlug = "";
                delete q.assignedAt;
                if (!q.level) q.level = "nb";

                if (!q.imageUrl && q.imageKey && parsedImages[q.imageKey]) {
                    q.imageUrl = String(parsedImages[q.imageKey]).trim();
                }
                return q;
            });

            qbankState.rawQuestions = [...keptAssignedQuestions, ...importedQuestions];
            qbankState.currentExamTitle = examTitle;

            // BẬT CHẾ ĐỘ XẾP CÂU (HIỆN CÂU ĐÃ ĐÁNH ID LÊN TRÊN CÙNG, CÂU CHƯA XẾP Ở DƯỚI THEO THỨ TỰ)
            qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
            qbankState.activeFolderId = null;
            qbankState.activeFolderObj = null;
            qbankState.assignMode = true;
            qbankState.hideAssigned = false;

            recomputeAllMatrixIds();
            syncAssignModeButtonsUI();
            updateQbankDeleteSelectedButtonUI();
            saveQbankDraftState(false);

            renderQbankHeaderAndMidExamTitle();
            renderQbankTree();
            renderQbankQuestions();
            updateQbankMatrixStats();
            updateQbankBuilderStats();
            refreshQbankExportPopoverIfOpen();

            showQbankToast(
                `✅ Đã nạp đề "${examTitle}" (${importedQuestions.length} câu mới). Kéo thả vào thư mục để tự đánh ID và xếp lên đầu!`,
                "success"
            );
        } catch (err) {
            showQbankToast("❌ Lỗi nạp file: " + err.message, "error");
            alert("❌ Lỗi nạp file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================================================
// 13. BỘ LỌC & SẮP XẾP CÂU HỎI THÔNG MINH
//     - KHI Ở CHẾ ĐỘ XẾP CÂU: CÂU ĐÃ ĐÁNH SỐ ID LÊN TRÊN CÙNG (C1, C2...),
//       CÂU CHƯA XẾP GIỮ NGUYÊN THỨ TỰ NẰM PHÍA DƯỚI
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
        list = list.filter(q => {
            if (!q) return false;
            if (!q.folderId) return true;
            if (!curTitle || !q.sourceExam) return true;
            return q.sourceExam === curTitle;
        });
    }

    return list;
}

function sortAssignedQuestionsArray(arr) {
    const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };
    return [...arr].sort((a, b) => {
        const slugA = String(a.matrixPathSlug || a.folderName || "");
        const slugB = String(b.matrixPathSlug || b.folderName || "");
        const slugCmp = slugA.localeCompare(slugB, "vi");
        if (slugCmp !== 0) return slugCmp;

        const pA = getQbankQuestionPart(a);
        const pB = getQbankQuestionPart(b);
        if (pA !== pB) return pA - pB;

        const lvlA = levelOrder[a.level || "nb"] || 1;
        const lvlB = levelOrder[b.level || "nb"] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;

        const seqA = Number(a.matrixSeq) || 0;
        const seqB = Number(b.matrixSeq) || 0;
        if (seqA !== seqB) return seqA - seqB;

        return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
    });
}

function getFilteredAndSortedQuestions() {
    let list = getScopeQuestionsForMatrix();

    if (qbankState.activeFilter.part) {
        list = list.filter(q => getQbankQuestionPart(q) === qbankState.activeFilter.part);
    }

    if (qbankState.activeFilter.level) {
        list = list.filter(q => (q.level || "nb") === qbankState.activeFilter.level);
    }

    const assigned = list.filter(q => Boolean(q && q.folderId && q.matrixId));
    const unassigned = list.filter(q => Boolean(q && !(q.folderId && q.matrixId)));

    const sortedAssigned = sortAssignedQuestionsArray(assigned);
    // Câu chưa kéo thả (chưa có ID) giữ đúng thứ tự đề gốc
    const sortedUnassigned = [...unassigned].sort((a, b) => (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0));

    return [...sortedAssigned, ...sortedUnassigned];
}

function updateQbankMatrixStats() {
    const bar = document.getElementById("qbank-matrix-bar");
    if (!bar) return;

    const scopedQuestions = getScopeQuestionsForMatrix();
    if ((qbankState.rawQuestions || []).length === 0) {
        bar.innerHTML = `<span style="color:#64748b; font-style:italic;">Upload file JSON để xem ma trận thống kê 4 mức độ</span>`;
        return;
    }

    const stats = {
        1: { nb: 0, th: 0, vdt: 0, vdc: 0 },
        2: { nb: 0, th: 0, vdt: 0, vdc: 0 },
        3: { nb: 0, th: 0, vdt: 0, vdc: 0 },
        4: { nb: 0, th: 0, vdt: 0, vdc: 0 }
    };
    let total = 0;

    scopedQuestions.forEach(q => {
        const p = getQbankQuestionPart(q);
        const lvl = q.level || "nb";
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
            <div class="matrix-group ${isPartAct ? "active-filter" : ""}" onclick="filterByGlobalPart(${p})">
                <span class="matrix-title">Phần ${p} (${sumP})</span>
                <div class="matrix-row">
                    <span class="stat-pill nb ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "nb" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'nb')">NB: ${s.nb}</span>
                    <span class="stat-pill th ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "th" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'th')">TH: ${s.th}</span>
                    <span class="stat-pill vdt ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "vdt" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdt')">VD: ${s.vdt}</span>
                    <span class="stat-pill vdc ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "vdc" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdc')">VDC: ${s.vdc}</span>
                </div>
            </div>`;
        }
    });

    html += `<div style="margin-left:auto; font-weight:900; color:#0f172a; font-size:11.5px; white-space:nowrap;">Đang xem: ${total} câu</div>`;

    const hasFilter = qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned || qbankState.assignMode;
    if (hasFilter) {
        let filterLabels = [];
        if (qbankState.activeFilter.folderName) {
            filterLabels.push(`Thư mục: ${qbankState.activeFilter.folderName}`);
        } else if (qbankState.hideAssigned) {
            filterLabels.push("Đang ẩn câu đã xếp");
        } else if (qbankState.assignMode) {
            filterLabels.push("Chế độ Xếp câu (Đã đánh ID ở trên • Chưa xếp ở dưới)");
        }
        if (qbankState.activeFilter.part) filterLabels.push(`Phần ${qbankState.activeFilter.part}`);
        if (qbankState.activeFilter.level) {
            filterLabels.push(`Mức: ${getQbankLevelLabel(qbankState.activeFilter.level)}`);
        }

        html += `
            <div class="qbank-active-filter-bar" style="width: 100%;">
                <span>🔍 Đang xem: <b>${escapeQbankHtml(filterLabels.join(" • "))}</b></span>
                <button type="button" class="btn-clear-filter" onclick="clearQbankFilter()">✕ Hiện tất cả ngân hàng</button>
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

// ============================================================================
// 14. RENDER DANH SÁCH THẺ CÂU HỎI (ĐÃ ĐÁNH ID LÊN TRÊN, CHƯA XẾP Ở DƯỚI)
// ============================================================================
function renderQbankCardHtml(q, idx) {
    const letters = ["A", "B", "C", "D"];
    const isChecked = qbankState.selectedQuestionIds.has(String(q.id));
    const p = getQbankQuestionPart(q);
    const levelText = getQbankLevelLabel(q.level || "nb");

    const isAssigned = Boolean(q.folderId && q.matrixId);
    const displayIdText = isAssigned
        ? q.matrixId
        : `Câu ${q.origIndex || (idx + 1)} • Chưa xếp`;

    const imgKey = String(q.imageKey || `img_q_${q.id}`).replace(/'/g, "");
    let imgUrl = q.imageUrl || qbankState.imagesMap[imgKey] || "";

    const uploaderHtml = `
        <div class="qbank-img-tool-zone" id="zone-qbank-${q.id}" tabindex="0" title="Bấm vào vùng này rồi ấn Ctrl+V để dán ảnh" style="display:flex; align-items:center; gap:5px; background:#f8fafc; padding:3px 6px; border-radius:5px; border:1px dashed #cbd5e1; margin-top:4px;">
            <span style="font-size:10.5px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
            <button type="button" class="btn-qbank-img" onclick="triggerQBankPaste('${q.id}', '${imgKey}')">📋 Dán (Ctrl+V)</button>
            <input type="file" id="file-qbank-${q.id}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${q.id}', '${imgKey}')">
            <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbank-${q.id}').click()">📁 Tệp</button>
            ${imgUrl ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${q.id}', '${imgKey}')">🗑 Xóa</button>` : ""}
            <span id="status-qbank-${q.id}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
        </div>
        ${imgUrl ? `<div style="text-align:center; margin:4px 0;"><img src="${imgUrl}" style="max-height:140px; border-radius:6px; border:1px solid #cbd5e1;"></div>` : ""}
    `;

    let contentDetailsHtml = "";
    if (p === 1 && Array.isArray(q.options)) {
        let correctIdx = 0;
        if (typeof q.correct === "number") correctIdx = q.correct;
        else if (typeof q.correct === "string") correctIdx = letters.indexOf(q.correct.trim().toUpperCase());

        contentDetailsHtml = `
            <div class="qbank-options-preview">
                ${q.options.map((opt, oIdx) => `
                    <div class="qbank-opt-item ${oIdx === correctIdx ? "is-correct" : ""}">
                        <span class="qbank-opt-circle">${letters[oIdx] || ""}</span>
                        <span>${opt} ${oIdx === correctIdx ? "<b>✓</b>" : ""}</span>
                    </div>
                `).join("")}
            </div>
        `;
    } else if (p === 2 && Array.isArray(q.statements)) {
        contentDetailsHtml = `
            <div style="margin:4px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 6px;">
                ${q.statements.map(st => {
                    const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                    return `
                    <div style="font-size:11.5px; margin-bottom:2px; display:flex; justify-content:space-between;">
                        <span><b>${st.id})</b> ${st.statement}</span>
                        <b style="color:${isTrue ? "#16a34a" : "#dc2626"};">${isTrue ? "🟢 Đúng" : "🔴 Sai"}</b>
                    </div>`;
                }).join("")}
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
        </div>` : "";

    const folderTag = q.folderName
        ? `<span style="font-size:10px; color:#16a34a; background:#dcfce7; padding:1px 5px; border-radius:5px; border:1px solid #bbf7d0;">📁 ${escapeQbankHtml(q.folderName)}</span>`
        : "";

    const unassignBtnHtml = isAssigned
        ? `<button type="button" class="btn-soide-mini" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;" onclick="unassignQbankQuestion('${q.id}')" title="Trả câu này về mục Chưa xếp">↩️ Bỏ xếp</button>`
        : "";

    const formattedQText = (typeof formatQuestionText === "function")
        ? formatQuestionText(q.question || "")
        : (q.question || "");

    return `
        <div class="qbank-q-card ${isAssigned ? "is-assigned-card" : ""} ${isChecked ? "selected" : ""}" id="qbank-card-${q.id}" draggable="true" ondragstart="handleQuestionDragStart(event, '${q.id}')" ondragend="handleQuestionDragEnd()">
            <div class="qbank-q-header">
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    <span class="qbank-q-id-badge ${isAssigned ? "is-assigned" : "is-unassigned"}" title="${escapeQbankHtml(displayIdText)}">${escapeQbankHtml(displayIdText)}</span>
                    <span style="font-size:10.5px; font-weight:800; color:#059669; border:1px solid #10b981; padding:1px 5px; border-radius:5px; background:#ecfdf5;">Phần ${p} • ${levelText}</span>
                    ${folderTag}
                </div>
                
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    ${unassignBtnHtml}
                    <button type="button" class="btn-soide-mini" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;" onclick="promptMoveQuestion('${q.id}')" title="Chuyển sang mục khác">🔄 Chuyển</button>
                    <button type="button" class="btn-soide-mini" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;" onclick="deleteQbankQuestion('${q.id}')" title="Xóa câu hỏi này">🗑️ Xóa</button>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:900; font-size:11.5px; color:#0f172a;">
                        <input type="checkbox" style="width:16px; height:16px; accent-color:#10b981; cursor:pointer;" ${isChecked ? "checked" : ""} onchange="toggleSelectQuestion('${q.id}', this.checked)"> Chọn
                    </label>
                </div>
            </div>
            <div style="font-size:12.5px; font-weight:600; color:#1e293b; margin-bottom:3px; line-height:1.4;">${formattedQText}</div>
            ${uploaderHtml}
            ${contentDetailsHtml}
            ${explainHtml}
        </div>
    `;
}

function renderQbankQuestions() {
    recomputeAllMatrixIds();
    renderQbankHeaderAndMidExamTitle();

    const container = document.getElementById("qbank-questions-list");
    if (!container) return;

    const questions = getFilteredAndSortedQuestions();

    if (questions.length === 0) {
        const isFilterActive = qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned;
        const unassignedLeft = (qbankState.rawQuestions || []).filter(q => !q.folderId).length;
        const assignedTotal = (qbankState.rawQuestions || []).length - unassignedLeft;

        let emptyHeadline = "Chưa có câu hỏi nào trong danh sách.";
        let emptyHint = 'Nhấn nút "Upload file JSON đề" ở trên để nạp đề thi cần phân loại!';

        if (qbankState.hideAssigned && !qbankState.activeFilter.folderId && assignedTotal > 0 && unassignedLeft === 0) {
            emptyHeadline = "🎉 Đã xếp xong 100% câu hỏi của đề gốc vào ngân hàng!";
            emptyHint = `Hiện có <b>${assignedTotal} câu</b> trong các thư mục bên trái. Bấm <b>📦 Xếp câu</b> hoặc <b>🙈 Ẩn đã xếp</b> để xem lại.`;
        } else if (isFilterActive) {
            emptyHeadline = "Không tìm thấy câu hỏi nào phù hợp với bộ lọc này.";
            emptyHint = '<a href="javascript:void(0)" onclick="clearQbankFilter()" style="color:#0284c7; font-weight:800; text-decoration:underline;">Nhấn vào đây để hủy lọc và xem tất cả</a>';
        }

        container.innerHTML = `
            <div style="text-align:center; padding:40px 16px; color:#64748b;">
                <div style="font-size:36px; margin-bottom:8px;">${isFilterActive ? "🔍" : "📥"}</div>
                <b>${emptyHeadline}</b>
                <p style="font-size:11.5px; margin-top:6px;">${emptyHint}</p>
            </div>
        `;
        return;
    }

    const assignedQuestions = questions.filter(q => Boolean(q.folderId && q.matrixId));
    const unassignedQuestions = questions.filter(q => !Boolean(q.folderId && q.matrixId));

    let html = "";
    const showGroupHeaders = !qbankState.activeFilter.folderId && assignedQuestions.length > 0;

    if (showGroupHeaders) {
        html += `
            <div class="qbank-section-banner assigned-banner">
                <span>📌 CÂU ĐÃ XẾP VÀO THƯ MỤC &amp; ĐÁNH SỐ ID TỰ ĐỘNG (${assignedQuestions.length} câu)</span>
                <span style="font-size:10px; font-weight:700;">Xếp trên cùng</span>
            </div>
        `;
    }

    assignedQuestions.forEach((q, idx) => {
        html += renderQbankCardHtml(q, idx);
    });

    if (showGroupHeaders && unassignedQuestions.length > 0) {
        html += `
            <div class="qbank-section-banner unassigned-banner">
                <span>📥 CÂU CHƯA KÉO THẢ / CHƯA CÓ ID (${unassignedQuestions.length} câu)</span>
                <span style="font-size:10px; font-weight:700;">Giữ nguyên thứ tự đề gốc</span>
            </div>
        `;
    }

    unassignedQuestions.forEach((q, idx) => {
        html += renderQbankCardHtml(q, idx);
    });

    container.innerHTML = html;

    if (window.MathJax && MathJax.typesetPromise) {
        try { MathJax.typesetPromise([container]).catch(() => {}); } catch (e) {}
    }
}

function handleQuestionDragStart(e, qId) {
    qbankState.draggedQId = qId;
    e.dataTransfer.setData("text/plain", qId);
}

function handleQuestionDragEnd() {
    qbankState.draggedQId = null;
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

    updateQbankDeleteSelectedButtonUI();
    updateQbankBuilderStats();
}

function clearSelectedQuestions() {
    qbankState.selectedQuestionIds.clear();
    updateQbankDeleteSelectedButtonUI();
    renderQbankQuestions();
    updateQbankBuilderStats();
}

// ============================================================================
// 15. DÁN ẢNH & CHỌN TỆP CHO TỪNG CÂU HỎI
// ============================================================================
function triggerQBankPaste(qId, imgKey) {
    const zone = document.getElementById(`zone-qbank-${qId}`);
    if (zone) zone.focus();
    showQbankToast("📋 Hãy bấm phím Ctrl + V để dán ảnh chụp vào câu này!", "info");
}

document.addEventListener("paste", function(e) {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.id && activeEl.id.startsWith("zone-qbank-")) {
        const qId = activeEl.id.replace("zone-qbank-", "");
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;

        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
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
            reader.onload = () => res(reader.result.split(",")[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

        let directUrl = "";

        if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_")) {
            let fd = new FormData();
            fd.append("image", b64);
            let r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd }).then(x => x.json()).catch(() => null);
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
            }).then(x => x.json()).catch(() => null);

            if (r && r.fileUrl) {
                directUrl = (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(r.fileUrl) : r.fileUrl;
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

        saveQbankDraftState(false);
        renderQbankQuestions();
        showQbankToast("🖼️ Đã chèn ảnh cho câu hỏi thành công!", "success");
    } catch (e) {
        if (stEl) {
            stEl.style.color = "#dc2626";
            stEl.innerText = "❌ Lỗi";
        }
        showQbankToast("❌ Lỗi tải ảnh: " + e.message, "error");
    }
}

function deleteQBankImg(qId, imgKey) {
    if (!confirm("⚠️ Xóa ảnh minh họa của câu này?")) return;
    delete qbankState.imagesMap[imgKey];
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (q) q.imageUrl = "";
    saveQbankDraftState(false);
    renderQbankQuestions();
    showQbankToast("🗑️ Đã xóa ảnh của câu hỏi.", "info");
}

// ============================================================================
// 16. CỘT 3: TRÍCH XUẤT ĐỀ THI & LƯU VÀO NGÂN HÀNG
// ============================================================================
function updateQbankBuilderStats() {
    const container = document.getElementById("qbank-builder-stats");
    if (!container) return;

    const total = pruneStaleSelectedQuestionIds();
    if (total === 0) {
        container.innerHTML = `<p style="color:#64748b; font-style:italic;">Chưa chọn câu hỏi nào. Tích chọn (☑️) các câu ở cột giữa để đưa vào đề thi.</p>`;
        return;
    }

    const pCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const lvlCounts = { nb: 0, th: 0, vdt: 0, vdc: 0 };

    qbankState.rawQuestions.forEach(q => {
        if (qbankState.selectedQuestionIds.has(String(q.id))) {
            const p = getQbankQuestionPart(q);
            const lvl = q.level || "nb";
            if (pCounts[p] !== undefined) pCounts[p]++;
            if (lvlCounts[lvl] !== undefined) lvlCounts[lvl]++;
        }
    });

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
            <span style="font-weight:900; color:#10b981; font-size:13px;">🎯 Đã chọn: ${total} câu</span>
            <button type="button" onclick="clearSelectedQuestions()" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:5px; padding:2px 6px; font-size:10.5px; font-weight:800; cursor:pointer;">Bỏ chọn hết</button>
        </div>
        <div style="font-size:11px; color:#334155; margin-bottom:4px;">
            <b>Phần:</b> P1(${pCounts[1]}) • P2(${pCounts[2]}) • P3(${pCounts[3]}) • P4(${pCounts[4]})
        </div>
        <div style="font-size:11px; color:#334155; margin-bottom:4px;">
            <b>Mức độ:</b> NB(${lvlCounts.nb}) • TH(${lvlCounts.th}) • VD(${lvlCounts.vdt}) • VDC(${lvlCounts.vdc})
        </div>
        <div style="font-size:10.5px; color:#64748b;">Hệ thống sẽ tự động xếp lại câu từ 1 ➔ ${total} và bảo toàn đầy đủ phương án A,B,C,D & lời giải.</div>
    `;
}

async function saveExtractedExamToBank() {
    if (!requireQbankAdminOrPrompt()) return;

    const titleInp = document.getElementById("qbank-exam-name");
    const gradeSel = document.getElementById("qbank-exam-grade");

    const title = titleInp ? titleInp.value.trim() : "";
    const grade = gradeSel ? gradeSel.value : "Lop_11";

    if (!title) {
        alert("⚠️ Vui lòng nhập Tên đề thi mới!");
        if (titleInp) titleInp.focus();
        return;
    }

    const pickedRaw = qbankState.rawQuestions.filter(q => qbankState.selectedQuestionIds.has(String(q.id)));
    if (pickedRaw.length === 0) {
        updateQbankDeleteSelectedButtonUI();
        updateQbankBuilderStats();
        return alert("⚠️ Thầy chưa tích chọn câu hỏi nào ở cột giữa!");
    }

    // Chuẩn hóa và sắp xếp câu từ Phần I -> II -> III -> IV
    pickedRaw.sort((a, b) => getQbankQuestionPart(a) - getQbankQuestionPart(b));
    const selectedQ = pickedRaw.map((q, idx) => normalizeQuestionForExamOutput(q, idx, qbankState.imagesMap));

    const btn = document.getElementById("btn-save-extracted-exam");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang lưu đề...";
    }

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

        const client = (typeof getSupabaseClient === "function") ? getSupabaseClient() : supabaseClient;
        if (client) {
            await client.from("app_key_values").upsert({
                key: "qbank_saved_exams",
                value: qbankState.savedExams
            });
        }

        if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            const drivePath = `KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/${grade}`;
            const payload = {
                action: "saveQuestionBankData",
                path: drivePath,
                filename: `${title.replace(/\s/g, "_")}.json`,
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
    } catch (err) {
        alert("❌ Lỗi lưu đề: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "💾 Lưu đề vào Ngân hàng";
        }
    }
}

// ============================================================================
// 17. QUẢN LÝ NGÂN HÀNG ĐÃ LƯU & BỘ LỌC
// ============================================================================
async function loadSavedExamsList(doRender = true) {
    try {
        const local = localStorage.getItem("qbank_saved_exams");
        if (local) qbankState.savedExams = JSON.parse(local) || [];
    } catch (e) {}

    const client = (typeof getSupabaseClient === "function") ? getSupabaseClient() : supabaseClient;
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
            ? exam.assignedClasses.map(c => `<span class="exam-tag">✅ ${escapeQbankHtml(c)}</span>`).join("")
            : `<span style="font-size:10.5px; color:#94a3b8; font-style:italic;">Chưa chuyển</span>`;

        return `
            <div class="saved-exam-item">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:14px; font-weight:900; color:#0f172a;">📑 ${escapeQbankHtml(exam.title)}</div>
                    <div style="font-size:11.5px; color:#64748b; font-weight:600; margin-top:3px;">
                        ${exam.questionCount} câu • Khối: <b style="color:#0284c7;">${escapeQbankHtml(exam.grade)}</b> • Tạo: ${dateStr}
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

function previewSavedExam(examId) {
    if (!requireQbankAdminOrPrompt()) return;
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
            let cIdx = typeof q.correct === "number" ? q.correct : letters.indexOf(String(q.correct).toUpperCase());
            optionsHtml = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                    ${q.options.map((opt, oIdx) => `
                        <div style="padding:5px 8px; border-radius:5px; border:1px solid #cbd5e1; background:${oIdx === cIdx ? "#dcfce7" : "#f8fafc"}; font-size:12px; font-weight:${oIdx === cIdx ? "800" : "600"}; color:${oIdx === cIdx ? "#15803d" : "#1e293b"};">
                            <b>${letters[oIdx]}.</b> ${opt} ${oIdx === cIdx ? "✓" : ""}
                        </div>
                    `).join("")}
                </div>
            `;
        } else if (q.type === "true_false" && Array.isArray(q.statements)) {
            optionsHtml = `
                <div style="margin-top:5px; border:1px solid #e2e8f0; border-radius:5px; padding:5px; background:#f8fafc;">
                    ${q.statements.map(st => `
                        <div style="font-size:11.5px; margin-bottom:3px; display:flex; justify-content:space-between;">
                            <span><b>${st.id})</b> ${st.statement}</span>
                            <b style="color:${st.correct ? "#16a34a" : "#dc2626"};">${st.correct ? "🟢 Đúng" : "🔴 Sai"}</b>
                        </div>
                    `).join("")}
                </div>
            `;
        } else {
            optionsHtml = `
                <div style="margin-top:5px; font-size:12px; font-weight:800; color:#0d9488;">
                    🎯 Đáp số: <span style="color:#0f172a;">${q.correctAnswer || q.correct || "---"}</span>
                </div>
            `;
        }

        const expHtml = q.explanation ? `<div style="font-size:11px; color:#78350f; background:#fffbeb; padding:5px; border-radius:5px; margin-top:5px; border-left:3px solid #f59e0b;">💡 <b>Lời giải:</b> ${q.explanation}</div>` : "";
        const redIdBadge = q.matrixId ? `<span class="qbank-q-id-badge" style="margin-left:6px; font-size:10.5px;">${escapeQbankHtml(q.matrixId)}</span>` : "";

        html += `
            <div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed #cbd5e1;">
                <div style="font-size:13px; font-weight:700; color:#0f172a;">
                    <b style="color:#0284c7;">Câu ${idx + 1}:</b> ${q.question || ""} ${redIdBadge}
                </div>
                ${optionsHtml}
                ${expHtml}
            </div>
        `;
    });

    body.innerHTML = html;
    modal.style.display = "flex";

    if (window.MathJax && MathJax.typesetPromise) {
        try { MathJax.typesetPromise([body]).catch(() => {}); } catch (e) {}
    }
}

function openInSoiDeFromBank(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;

    if (typeof ensureSoiDeModalInDOM === "function") {
        ensureSoiDeModalInDOM();
    }

    if (typeof soiDeState !== "undefined") {
        soiDeState.examData = {
            id: exam.id,
            title: exam.title,
            maDe: "101",
            timeLimitMinutes: 90,
            images: { ...(exam.images || {}) },
            questions: JSON.parse(JSON.stringify(exam.questions || [])),
            scoringConfig: { mode: "option1" }
        };
        soiDeState.isFromQBank = false;

        if (typeof openSoiDeModal === "function") {
            closeSavedExamsModal();
            openSoiDeModal();
        }
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
    const checkedBoxes = Array.from(document.querySelectorAll("#transfer-class-list input:checked"));
    const checked = checkedBoxes.map(c => c.value);

    if (checked.length === 0) return alert("⚠️ Vui lòng chọn ít nhất 1 lớp!");

    const client = (typeof getSupabaseClient === "function") ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("❌ Chưa kết nối Supabase!");

    try {
        const quizId = "quiz_" + Date.now();
        const dateStr = new Date().toLocaleString("vi-VN");

        await client.from("quizzes").upsert({
            id: quizId,
            title: exam.title,
            made: "101",
            time_limit_minutes: 90,
            scoring_config: exam.scoringConfig || { mode: "option1" },
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
        await client.from("custom_links").insert(linkRows);

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
        await client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });

        alert(`🎉 ĐÃ CHUYỂN ĐỀ "${exam.title}" THÀNH CÔNG VÀO ${checked.length} LỚP!`);
        document.getElementById("modal-transfer-exam").style.display = "none";

        filterSavedExamsList(qbankState.savedExamFilter);
    } catch (err) {
        alert("❌ Lỗi chuyển đề: " + err.message);
    }
}

function downloadSavedExamJson(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    const blob = new Blob([JSON.stringify(exam, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exam.title.replace(/\s+/g, "_")}.json`;
    a.click();
}

function deleteSavedExam(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA đề thi này khỏi Ngân hàng đề không?")) return;

    qbankState.savedExams = qbankState.savedExams.filter(e => e.id !== examId);
    localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));

    const client = (typeof getSupabaseClient === "function") ? getSupabaseClient() : supabaseClient;
    if (client) {
        client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });
    }

    filterSavedExamsList(qbankState.savedExamFilter);
}

// ============================================================================
// 18. XUẤT TOÀN BỘ HÀM RA WINDOW SCOPE
// ============================================================================
window.isQbankAdminAuthorized = isQbankAdminAuthorized;
window.requireQbankAdminOrPrompt = requireQbankAdminOrPrompt;
window.showQbankToast = showQbankToast;
window.recomputeAllMatrixIds = recomputeAllMatrixIds;
window.undoQbankAction = undoQbankAction;
window.manualSaveQbankDraftState = manualSaveQbankDraftState;
window.saveQbankDraftState = saveQbankDraftState;
window.loadQbankDraftState = loadQbankDraftState;
window.resetQbankColWidths = resetQbankColWidths;
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
window.toggleQbankAssignMode = toggleQbankAssignMode;
window.toggleHideAssignedQuestions = toggleHideAssignedQuestions;
window.toggleLeafMatrixDisplay = toggleLeafMatrixDisplay;
window.handleLeafTreeDragOver = handleLeafTreeDragOver;
window.filterByGlobalPart = filterByGlobalPart;
window.filterByGlobalCell = filterByGlobalCell;

window.handleDropZoneOver = handleDropZoneOver;
window.handleDropZoneLeave = handleDropZoneLeave;
window.handleDropZoneDrop = handleDropZoneDrop;
window.assignSelectedQuestionsToMatrix = assignSelectedQuestionsToMatrix;
window.unassignQbankQuestion = unassignQbankQuestion;
window.handleQuestionDragStart = handleQuestionDragStart;
window.handleQuestionDragEnd = handleQuestionDragEnd;

window.deleteSelectedQbankQuestions = deleteSelectedQbankQuestions;
window.updateQbankDeleteSelectedButtonUI = updateQbankDeleteSelectedButtonUI;
window.deleteQbankQuestion = deleteQbankQuestion;
window.promptMoveQuestion = promptMoveQuestion;
window.executeMoveQbankQuestion = executeMoveQbankQuestion;

window.toggleQbankExportPopover = toggleQbankExportPopover;
window.closeQbankExportPopover = closeQbankExportPopover;
window.handleQbankExportPopoverInnerClick = handleQbankExportPopoverInnerClick;
window.toggleQbankExportNodeExpand = toggleQbankExportNodeExpand;
window.toggleQbankExportFolderCheck = toggleQbankExportFolderCheck;
window.toggleQbankExportUnassignedCheck = toggleQbankExportUnassignedCheck;
window.selectAllQbankExportFolders = selectAllQbankExportFolders;
window.onQbankExportTitleManualInput = onQbankExportTitleManualInput;
window.toggleQbankExportFormatMenu = toggleQbankExportFormatMenu;
window.executeQbankExport = executeQbankExport;

window.toggleSelectQuestion = toggleSelectQuestion;
window.clearSelectedQuestions = clearSelectedQuestions;
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
window.openSoiDeFromQBank = openSoiDeFromQBank;
