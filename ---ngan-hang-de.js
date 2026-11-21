// =========================================================
// FILE: ngan-hang-de.js
// BẢN HOÀN THIỆN 100%:
// 1. CHỈ MỞ ĐƯỢC TRONG CHẾ ĐỘ ADMIN
// 2. ĐỒNG BỘ 2 CHIỀU PC <-> ĐIỆN THOẠI QUA SUPABASE (CÂY THƯ MỤC + CÂU HỎI + ẢNH)
//    VÀ TỰ ĐỘNG BACKUP DRIVE KHI BẤM LƯU DỮ LIỆU
// 3. ĐÁNH SỐ ID TỰ ĐỘNG LIÊN TỤC TRONG CÙNG 1 LỚP:
//    ID.L10-Ch1-Bai1-P1-Nhận biết-C1, C2... -> hết NB -> TH -> VD -> VDC -> P2...
// 4. NÚT "✏️ Sửa đề" TRONG CỘT GIỮA: CHIA ĐÔI MÀN HÌNH ĐẦY ĐỦ CHỨC NĂNG NHƯ SOI ĐỀ
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
    treeUpdatedAt: 0,
    draftUpdatedAt: 0,
    expandedLeafMatrixIds: new Set(),
    activeFilter: { folderId: null, folderName: null, part: null, level: null },
    assignMode: true,
    hideAssigned: false,
    undoStack: [],
    exportSelectedFolderIds: new Set(),
    exportCollapsedFolderIds: new Set(),
    exportCustomTitleTouched: false
};

let qbankMidEditState = {
    isActive: false,
    title: "NGÂN HÀNG ĐỀ",
    maDe: "101",
    timeLimitMinutes: 90,
    questions: [],
    images: {},
    editingSourceIds: new Set(),
    editorMode: "cards",
    splitRatio: 50,
    rawEditingCardIds: new Set(),
    debounceTimer: null,
    isDirty: false
};

const QBANK_COLOR_PALETTE = ["#0284c7", "#059669", "#7c3aed", "#ea580c", "#dc2626", "#0891b2", "#ca8a04", "#475569"];
const QBANK_EDIT_THEME_PALETTES = [
    { border: "#38bdf8", bg: "#f0f9ff", text: "#0369a1" },
    { border: "#34d399", bg: "#f0fdf4", text: "#065f46" },
    { border: "#c084fc", bg: "#faf5ff", text: "#6b21a8" },
    { border: "#fb923c", bg: "#fff7ed", text: "#9a3412" },
    { border: "#f472b6", bg: "#fdf2f8", text: "#9d174d" },
    { border: "#eab308", bg: "#fefce8", text: "#854d0e" }
];
const QBANK_MAX_UNDO = 40;
const QBANK_EXPORT_UNASSIGNED_KEY = "__UNASSIGNED__";
const QBANK_CLOUD_TREE_KEY = "qbank_tree_structure";
const QBANK_CLOUD_DRAFT_KEY = "qbank_workspace_draft";

let _qbankToastTimer = null;
let _qbankResizersInitialized = false;
let _qbankCloudTreeSyncTimer = null;
let _qbankCloudDraftSyncTimer = null;
let _qbEditResizerInitialized = false;
let _qbEditScrollSyncActivePane = null;
let _qbEditLastSyncedRightToLeft = null;
let _qbEditLastSyncedLeftToRight = null;

// ============================================================================
// 0. KIỂM TRA QUYỀN ADMIN
// ============================================================================
function isQbankAdminAuthorized() {
    try {
        if (typeof isAdminLoggedIn !== "undefined" && isAdminLoggedIn === true) return true;
        if (typeof checkAdminSessionValidity === "function" && checkAdminSessionValidity()) return true;
        const logged = (typeof safeLocal !== "undefined") ? safeLocal.getItem("adminLoggedInSession") : localStorage.getItem("adminLoggedInSession");
        const expiresAt = (typeof safeLocal !== "undefined") ? safeLocal.getItem("admin_expires_at") : localStorage.getItem("admin_expires_at");
        if (logged === "true" && expiresAt && Date.now() < parseInt(expiresAt, 10)) return true;
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

function getQbankSupabaseClient() {
    if (typeof getSupabaseClient === "function") return getSupabaseClient();
    if (typeof supabaseClient !== "undefined" && supabaseClient) return supabaseClient;
    return null;
}

// ============================================================================
// 1. TOAST & TIỆN ÍCH XỬ LÝ CHUỖI / ẢNH
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
    _qbankToastTimer = setTimeout(() => { toast.classList.remove("show"); }, 3500);
}

function escapeQbankHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeQbankAttr(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeQbankJsArg(val) {
    return String(val ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function qbFormatQuestionText(text) {
    if (typeof formatQuestionText === "function") return formatQuestionText(text);
    if (!text) return "";
    let formatted = String(text).replace(/\\begin\{center\}/gi, '<div style="width:100%; overflow-x:auto; text-align:center; margin: 10px 0; padding-bottom: 5px;">');
    formatted = formatted.replace(/\\end\{center\}/gi, "</div>");
    formatted = formatted.replace(/\\begin\{tabular\}([\s\S]*?)\\end\{tabular\}/gi, function(m, c) {
        return "$$ \\begin{array}" + c.replace(/\$/g, "").replace(/\\\(/g, "").replace(/\\\)/g, "") + "\\end{array} $$";
    });
    return formatted.replace(/(^|[^:])\/\/\s*([^\r\n<]+)/g, (m, p, c) => p + '<span style="color: #78350f; font-weight: 800;">// ' + c.trim() + "</span>");
}

function normalizeDriveImageLinkIfNeeded(rawUrl) {
    if (!rawUrl) return "";
    const clean = String(rawUrl).trim();
    if (!clean) return "";
    if (clean.startsWith("data:")) return clean;
    if (typeof toDirectGoogleDriveImageUrl === "function") return toDirectGoogleDriveImageUrl(clean);
    return clean;
}

function resolveQbankImageUrl(q, imageMap) {
    if (!q) return "";
    const map = (imageMap && typeof imageMap === "object") ? imageMap : {};
    if (q.imageUrl && String(q.imageUrl).trim() !== "") return normalizeDriveImageLinkIfNeeded(q.imageUrl);
    if (q.imageKey && map[q.imageKey] && String(map[q.imageKey]).trim() !== "") return normalizeDriveImageLinkIfNeeded(map[q.imageKey]);

    const qIdStr = String(q.id || "").trim();
    const origIdStr = String(q.origIndex || "").trim();
    const idCandidates = [];
    if (qIdStr) idCandidates.push(qIdStr);
    if (origIdStr && origIdStr !== qIdStr) idCandidates.push(origIdStr);

    for (const idVal of idCandidates) {
        const possibleKeys = [
            `img_q_${idVal}`, `q${idVal}`, `${idVal}`,
            `pbc_p1_c${idVal}`, `pbc_p2_c${idVal}`, `pbc_p3_c${idVal}`, `pbc_p4_c${idVal}`,
            `dh_p1_c${idVal}`, `dh_p2_c${idVal}`, `dh_p3_c${idVal}`,
            `hy_p1_c${idVal}`, `hy_p2_c${idVal}`, `hy_p3_c${idVal}`,
            `dethem_p1_c${idVal}`, `dethem_p2_c${idVal}`, `dethem_p3_c${idVal}`,
            `cau_${idVal}`, `cau${idVal}`
        ];
        for (const k of possibleKeys) {
            if (map[k] && String(map[k]).trim() !== "") return normalizeDriveImageLinkIfNeeded(map[k]);
        }
    }

    if (q.imageKey) {
        const lowerKey = String(q.imageKey).toLowerCase();
        for (const mKey in map) {
            if (mKey.toLowerCase() === lowerKey && map[mKey] && String(map[mKey]).trim() !== "") {
                return normalizeDriveImageLinkIfNeeded(map[mKey]);
            }
        }
    }
    return "";
}

function handleQbankImgError(imgEl) {
    if (!imgEl || !imgEl.src) return;
    const currentSrc = imgEl.src;
    if (currentSrc.includes("googleusercontent.com") || currentSrc.includes("drive.google.com")) {
        const m = currentSrc.match(/(?:file\/d\/|id=|open\?id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
        if (m && m[1]) {
            const fileId = m[1];
            const triedLevel = parseInt(imgEl.dataset.fallbackLevel || "0", 10);
            if (triedLevel === 0) { imgEl.dataset.fallbackLevel = "1"; imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1400`; return; }
            if (triedLevel === 1) { imgEl.dataset.fallbackLevel = "2"; imgEl.src = `https://lh3.googleusercontent.com/u/0/d/${fileId}`; return; }
            if (triedLevel === 2) { imgEl.dataset.fallbackLevel = "3"; imgEl.src = `https://drive.google.com/uc?export=view&id=${fileId}`; return; }
        }
    }
    imgEl.style.display = "none";
}

// ============================================================================
// 2. ĐÁNH SỐ ID TỰ ĐỘNG LIÊN TỤC TRONG CÙNG 1 LỚP
//    VD: ID.L10-Ch1-Bai1-P1-Nhận biết-C1, C2... -> hết NB -> TH -> VD -> VDC -> P2...
// ============================================================================
function getQbankQuestionPart(q) {
    if (!q) return 1;
    if (q.part === 4 || q.isPart4 === true || q.type === "essay" || q.type === "essay_answer" || q.type === "part4") return 4;
    const txt = String(q.question || "").toUpperCase();
    if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) return 4;
    if (q.type === "true_false") return 2;
    if (q.type === "short_answer") return 3;
    return q.part ? parseInt(q.part, 10) || 1 : 1;
}

function getQbankLevelLabel(level) {
    const map = { nb: "Nhận biết", th: "Thông hiểu", vdt: "Vận dụng", vdc: "Vận dụng cao" };
    return map[level || "nb"] || "Nhận biết";
}

function formatNodeSlugForId(name) {
    const raw = String(name || "").trim();
    if (!raw) return "M";
    const norm = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d");
    const lower = norm.toLowerCase();

    const mHsg = lower.match(/(?:lop|khoi)?\s*hsg\s*(?:toan\s*)?(\d+)?/);
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
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("").substring(0, 10);
}

function getFolderPathNodes(targetId) {
    if (!targetId) return [];
    let foundPath = [];
    function traverse(nodes, currentPath) {
        for (let n of nodes) {
            const nextPath = [...currentPath, n];
            if (n.id === targetId) { foundPath = nextPath; return true; }
            if (n.children && n.children.length > 0 && traverse(n.children, nextPath)) return true;
        }
        return false;
    }
    traverse(qbankState.currentTree, []);
    return foundPath;
}

function buildTreeOrderMap() {
    const orderMap = {};
    const rootOfMap = {};
    let counter = 0;
    function walk(nodes, rootId) {
        (nodes || []).forEach(n => {
            const rId = rootId || n.id;
            orderMap[n.id] = counter++;
            rootOfMap[n.id] = rId;
            if (n.children && n.children.length > 0) walk(n.children, rId);
        });
    }
    walk(qbankState.currentTree, null);
    return { orderMap, rootOfMap };
}

function recomputeAllMatrixIds() {
    const { orderMap, rootOfMap } = buildTreeOrderMap();
    const classCounters = {};
    const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };
    const questions = qbankState.rawQuestions || [];

    const assignedQuestions = [];
    questions.forEach(q => {
        if (!q) return;
        if (!q.folderId || orderMap[q.folderId] === undefined) {
            q.folderId = null;
            q.folderName = "";
            q.matrixId = "";
            q.matrixSeq = 0;
            q.matrixPathSlug = "";
            q.rootClassId = "";
            delete q.assignedAt;
        } else {
            assignedQuestions.push(q);
        }
    });

    assignedQuestions.sort((a, b) => {
        const orderA = orderMap[a.folderId] ?? 999999;
        const orderB = orderMap[b.folderId] ?? 999999;
        if (orderA !== orderB) return orderA - orderB;

        const pA = getQbankQuestionPart(a);
        const pB = getQbankQuestionPart(b);
        if (pA !== pB) return pA - pB;

        const lvlA = levelOrder[a.level || "nb"] || 1;
        const lvlB = levelOrder[b.level || "nb"] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;

        const atA = Number(a.assignedAt) || 0;
        const atB = Number(b.assignedAt) || 0;
        if (atA !== atB) return atA - atB;

        return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
    });

    assignedQuestions.forEach(q => {
        const pathNodes = getFolderPathNodes(q.folderId);
        if (pathNodes.length === 0) {
            q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = "";
            return;
        }

        const rootClassNode = pathNodes[0];
        const lastNode = pathNodes[pathNodes.length - 1];
        const rootClassId = rootOfMap[q.folderId] || rootClassNode.id;

        q.folderName = lastNode.name;
        q.rootClassId = rootClassId;

        const pathSlug = pathNodes.map(n => formatNodeSlugForId(n.name)).join("-");
        const part = getQbankQuestionPart(q);
        const levelKey = q.level || "nb";
        const levelLabel = getQbankLevelLabel(levelKey);

        classCounters[rootClassId] = (classCounters[rootClassId] || 0) + 1;
        const seqNum = classCounters[rootClassId];

        q.matrixSeq = seqNum;
        q.matrixPathSlug = pathSlug;
        q.matrixId = `ID.${pathSlug}-P${part}-${levelLabel}-C${seqNum}`;
    });
}

// ============================================================================
// 3. UNDO (CTRL+Z)
// ============================================================================
function pushQbankUndoState(actionLabel = "Thao tác") {
    try {
        const snapshot = {
            label: actionLabel,
            rawQuestions: JSON.parse(JSON.stringify(qbankState.rawQuestions || [])),
            imagesMap: JSON.parse(JSON.stringify(qbankState.imagesMap || {})),
            currentTree: JSON.parse(JSON.stringify(qbankState.currentTree || [])),
            currentExamTitle: qbankState.currentExamTitle || "",
            selectedQuestionIds: Array.from(qbankState.selectedQuestionIds || []),
            assignMode: !!qbankState.assignMode,
            hideAssigned: !!qbankState.hideAssigned,
            activeFilter: JSON.parse(JSON.stringify(qbankState.activeFilter || {}))
        };
        qbankState.undoStack.push(snapshot);
        if (qbankState.undoStack.length > QBANK_MAX_UNDO) qbankState.undoStack.shift();
        updateQbankUndoButtonUI();
    } catch (e) {}
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
    if (prev.imagesMap) qbankState.imagesMap = prev.imagesMap;
    qbankState.currentTree = prev.currentTree || qbankState.currentTree;
    qbankState.currentExamTitle = prev.currentExamTitle || "";
    qbankState.selectedQuestionIds = new Set(prev.selectedQuestionIds || []);
    qbankState.assignMode = prev.assignMode !== undefined ? !!prev.assignMode : true;
    qbankState.hideAssigned = !!prev.hideAssigned;
    qbankState.activeFilter = prev.activeFilter || { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = qbankState.activeFilter.folderId || null;
    qbankState.activeFolderObj = qbankState.activeFolderId ? findNodeInTree(qbankState.currentTree, qbankState.activeFolderId) : null;

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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && qbankMidEditState.isActive) {
        e.preventDefault();
        commitQbankMidEditChanges(true);
        return;
    }
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoQbankAction();
    }
});

// ============================================================================
// 4. ĐỒNG BỘ 2 CHIỀU CLOUD (SUPABASE + LOCAL + INDEXEDDB + DRIVE BACKUP)
// ============================================================================
async function syncQbankTreeToCloud() {
    const client = getQbankSupabaseClient();
    if (!client) return false;
    try {
        const ts = qbankState.treeUpdatedAt || Date.now();
        qbankState.treeUpdatedAt = ts;
        const { error } = await client.from("app_key_values").upsert({
            key: QBANK_CLOUD_TREE_KEY,
            value: { tree: qbankState.currentTree, updatedAt: ts }
        });
        return !error;
    } catch (e) { return false; }
}

async function syncQbankDraftToCloud() {
    const client = getQbankSupabaseClient();
    if (!client) return false;
    try {
        const ts = qbankState.draftUpdatedAt || Date.now();
        qbankState.draftUpdatedAt = ts;
        const { error } = await client.from("app_key_values").upsert({
            key: QBANK_CLOUD_DRAFT_KEY,
            value: {
                questions: qbankState.rawQuestions || [],
                images: qbankState.imagesMap || {},
                currentExamTitle: qbankState.currentExamTitle || "",
                updatedAt: ts
            }
        });
        return !error;
    } catch (e) { return false; }
}

function scheduleQbankTreeCloudSync() {
    if (_qbankCloudTreeSyncTimer) clearTimeout(_qbankCloudTreeSyncTimer);
    _qbankCloudTreeSyncTimer = setTimeout(() => { syncQbankTreeToCloud(); }, 350);
}

function scheduleQbankDraftCloudSync() {
    if (_qbankCloudDraftSyncTimer) clearTimeout(_qbankCloudDraftSyncTimer);
    _qbankCloudDraftSyncTimer = setTimeout(() => { syncQbankDraftToCloud(); }, 450);
}

function writeQbankTreeLocalStorage(ts) {
    try {
        localStorage.setItem("qbank_tree_structure", JSON.stringify(qbankState.currentTree));
        localStorage.setItem("qbank_tree_updated_at", String(ts));
    } catch (e) {}
}

async function writeQbankDraftLocalStorages(ts) {
    let savedLocal = false;
    let savedIDB = false;
    try {
        localStorage.setItem("qbank_draft_questions", JSON.stringify(qbankState.rawQuestions || []));
        localStorage.setItem("qbank_draft_images", JSON.stringify(qbankState.imagesMap || {}));
        localStorage.setItem("qbank_draft_exam_title", qbankState.currentExamTitle || "");
        localStorage.setItem("qbank_draft_updated_at", String(ts));
        savedLocal = true;
    } catch (e) {}
    if (typeof examIndexedDB !== "undefined") {
        try {
            savedIDB = await examIndexedDB.setItem("exam_states", {
                key: "qbank_draft_state_v1",
                questions: qbankState.rawQuestions || [],
                images: qbankState.imagesMap || {},
                currentExamTitle: qbankState.currentExamTitle || "",
                currentTree: qbankState.currentTree,
                updatedAt: ts
            });
        } catch (e) {}
    }
    return savedLocal || savedIDB;
}

function saveQbankTreeData() {
    const ts = Date.now();
    qbankState.treeUpdatedAt = ts;
    writeQbankTreeLocalStorage(ts);
    scheduleQbankTreeCloudSync();
}

function loadQbankTreeData() {
    try {
        const local = localStorage.getItem("qbank_tree_structure");
        const localTs = parseInt(localStorage.getItem("qbank_tree_updated_at") || "0", 10) || 0;
        if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
                qbankState.currentTree = parsed;
                qbankState.treeUpdatedAt = localTs > 0 ? localTs : 1;
                return true;
            }
        }
    } catch (e) {}
    qbankState.treeUpdatedAt = 0;
    return false;
}

async function saveQbankDraftState(showFeedback = false) {
    recomputeAllMatrixIds();
    const ts = Date.now();
    qbankState.draftUpdatedAt = ts;
    qbankState.treeUpdatedAt = Math.max(qbankState.treeUpdatedAt || 0, ts);

    writeQbankTreeLocalStorage(qbankState.treeUpdatedAt);
    const savedOffline = await writeQbankDraftLocalStorages(ts);

    let syncedCloud = false;
    if (showFeedback) {
        const [treeOk, draftOk] = await Promise.all([syncQbankTreeToCloud(), syncQbankDraftToCloud()]);
        syncedCloud = treeOk && draftOk;
    } else {
        scheduleQbankTreeCloudSync();
        scheduleQbankDraftCloudSync();
    }

    if (showFeedback) {
        const total = (qbankState.rawQuestions || []).length;
        const assignedCount = (qbankState.rawQuestions || []).filter(q => Boolean(q.folderId)).length;
        const unassignedCount = total - assignedCount;
        if (syncedCloud) {
            showQbankToast(`✅ Đã lưu & đồng bộ đám mây thành công! (Ngân hàng: ${assignedCount} câu • Chờ xếp: ${unassignedCount} câu)`, "success");
        } else if (savedOffline) {
            showQbankToast(`⚠️ Đã lưu trên máy (chưa đồng bộ Cloud). Ngân hàng: ${assignedCount} • Chờ xếp: ${unassignedCount}.`, "warning");
        } else {
            showQbankToast("⚠️ Bộ nhớ trình duyệt hạn chế, hãy xuất JSON dự phòng!", "warning");
        }
    }
    return savedOffline || syncedCloud;
}

async function manualSaveQbankDraftState(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const btn = document.getElementById("btn-qbank-save-draft");
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Đang lưu..."; }

    const ok = await saveQbankDraftState(true);

    if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
        try {
            fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "saveQuestionBankData",
                    path: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/Workspace_Backup",
                    filename: "NganHangCauHoi_Workspace.json",
                    data: {
                        updatedAt: qbankState.draftUpdatedAt,
                        currentExamTitle: qbankState.currentExamTitle,
                        currentTree: qbankState.currentTree,
                        questions: qbankState.rawQuestions,
                        images: qbankState.imagesMap
                    }
                })
            }).catch(() => {});
        } catch (e) {}
    }

    if (btn) {
        btn.innerHTML = ok ? "✅ Đã lưu!" : "💾 Lưu dữ liệu";
        setTimeout(() => { btn.innerHTML = "💾 Lưu dữ liệu"; btn.disabled = false; }, ok ? 1500 : 0);
    }
}

async function loadQbankDraftState() {
    let hasLocalTree = loadQbankTreeData();
    let localQuestions = [];
    let localImages = {};
    let localTitle = "";
    let localDraftTs = parseInt(localStorage.getItem("qbank_draft_updated_at") || "0", 10) || 0;

    if (typeof examIndexedDB !== "undefined") {
        try {
            const data = await examIndexedDB.getItem("exam_states", "qbank_draft_state_v1");
            if (data && Array.isArray(data.questions)) {
                localQuestions = data.questions;
                localImages = data.images || {};
                if (data.currentExamTitle) localTitle = data.currentExamTitle;
                if (data.updatedAt && data.updatedAt > localDraftTs) localDraftTs = data.updatedAt;
                if (!hasLocalTree && Array.isArray(data.currentTree) && data.currentTree.length > 0) {
                    qbankState.currentTree = data.currentTree;
                    hasLocalTree = true;
                }
            }
        } catch (e) {}
    }

    if (localQuestions.length === 0) {
        try {
            const q = localStorage.getItem("qbank_draft_questions");
            const img = localStorage.getItem("qbank_draft_images");
            const title = localStorage.getItem("qbank_draft_exam_title");
            if (q) { const pq = JSON.parse(q); if (Array.isArray(pq)) localQuestions = pq; }
            if (img) { const pi = JSON.parse(img); if (pi && typeof pi === "object") localImages = pi; }
            if (title) localTitle = title;
        } catch (e) {}
    }

    if (localQuestions.length > 0 && localDraftTs === 0) localDraftTs = 1;

    qbankState.rawQuestions = localQuestions;
    qbankState.imagesMap = localImages;
    qbankState.currentExamTitle = localTitle;
    qbankState.draftUpdatedAt = localDraftTs;

    const client = getQbankSupabaseClient();
    if (client) {
        try {
            const { data: rows } = await client
                .from("app_key_values")
                .select("key, value")
                .in("key", [QBANK_CLOUD_TREE_KEY, QBANK_CLOUD_DRAFT_KEY]);

            const treeRow = Array.isArray(rows) ? rows.find(r => r.key === QBANK_CLOUD_TREE_KEY) : null;
            const draftRow = Array.isArray(rows) ? rows.find(r => r.key === QBANK_CLOUD_DRAFT_KEY) : null;

            const cloudTreeVal = treeRow ? treeRow.value : null;
            const cloudTree = Array.isArray(cloudTreeVal)
                ? cloudTreeVal
                : (cloudTreeVal && Array.isArray(cloudTreeVal.tree) ? cloudTreeVal.tree : null);
            const cloudTreeTs = (cloudTreeVal && !Array.isArray(cloudTreeVal) && cloudTreeVal.updatedAt)
                ? Number(cloudTreeVal.updatedAt) || 0 : (cloudTree ? 1 : 0);

            if (cloudTree && cloudTree.length > 0) {
                if (!hasLocalTree || cloudTreeTs > (qbankState.treeUpdatedAt || 0)) {
                    qbankState.currentTree = cloudTree;
                    qbankState.treeUpdatedAt = cloudTreeTs || Date.now();
                    writeQbankTreeLocalStorage(qbankState.treeUpdatedAt);
                } else if ((qbankState.treeUpdatedAt || 0) > cloudTreeTs) {
                    syncQbankTreeToCloud();
                }
            } else if (hasLocalTree) {
                qbankState.treeUpdatedAt = Date.now();
                writeQbankTreeLocalStorage(qbankState.treeUpdatedAt);
                await syncQbankTreeToCloud();
            }

            const cloudDraft = draftRow ? draftRow.value : null;
            const cloudQuestions = (cloudDraft && Array.isArray(cloudDraft.questions)) ? cloudDraft.questions : null;
            const cloudDraftTs = (cloudDraft && cloudDraft.updatedAt) ? Number(cloudDraft.updatedAt) || 0 : 0;

            if (cloudQuestions) {
                const shouldTakeCloud = (localQuestions.length === 0 && cloudQuestions.length > 0) || (cloudDraftTs > (qbankState.draftUpdatedAt || 0));
                if (shouldTakeCloud) {
                    qbankState.rawQuestions = cloudQuestions;
                    qbankState.imagesMap = (cloudDraft.images && typeof cloudDraft.images === "object") ? cloudDraft.images : {};
                    qbankState.currentExamTitle = cloudDraft.currentExamTitle || "";
                    qbankState.draftUpdatedAt = cloudDraftTs || Date.now();
                    await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                } else if (localQuestions.length > 0 && (qbankState.draftUpdatedAt || 0) > cloudDraftTs) {
                    await syncQbankDraftToCloud();
                }
            } else if (localQuestions.length > 0) {
                qbankState.draftUpdatedAt = Date.now();
                await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                await syncQbankDraftToCloud();
            }
        } catch (err) {
            console.warn("Không thể đồng bộ Ngân hàng đề từ Supabase:", err);
        }
    }

    recomputeAllMatrixIds();
}

// ============================================================================
// 5. HIỂN THỊ TÊN ĐỀ GỐC & CO GIÃN 3 CỘT
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

function applySavedQbankColWidths() {
    const leftCol = document.getElementById("qbank-col-left");
    const rightCol = document.getElementById("qbank-col-right");
    if (!leftCol || !rightCol) return;
    try {
        const saved = JSON.parse(localStorage.getItem("qbank_col_widths") || "null");
        if (saved) {
            if (saved.left >= 210 && saved.left <= window.innerWidth * 0.55) { leftCol.style.flex = `0 0 ${saved.left}px`; leftCol.style.width = `${saved.left}px`; }
            if (saved.right >= 210 && saved.right <= window.innerWidth * 0.45) { rightCol.style.flex = `0 0 ${saved.right}px`; rightCol.style.width = `${saved.right}px`; }
        }
    } catch (e) {}
}

function resetQbankColWidths() {
    const leftCol = document.getElementById("qbank-col-left");
    const rightCol = document.getElementById("qbank-col-right");
    if (leftCol) { leftCol.style.flex = "0 0 330px"; leftCol.style.width = "330px"; }
    if (rightCol) { rightCol.style.flex = "0 0 310px"; rightCol.style.width = "310px"; }
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

    let activeSide = null, startX = 0, startLeftWidth = 0, startRightWidth = 0;
    const getClientX = (e) => (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    function startDrag(side, e) {
        if (window.innerWidth <= 900) return;
        e.preventDefault(); activeSide = side; startX = getClientX(e);
        startLeftWidth = leftCol.getBoundingClientRect().width;
        startRightWidth = rightCol.getBoundingClientRect().width;
        container.classList.add("is-resizing");
        (side === "left" ? resizerLeft : resizerRight).classList.add("is-dragging");
    }
    function onMove(e) {
        if (!activeSide) return;
        const containerWidth = container.getBoundingClientRect().width;
        const minCol = 210, minMid = 260, resizersTotal = 14, dx = getClientX(e) - startX;
        if (activeSide === "left") {
            const maxLeft = Math.max(minCol, containerWidth - rightCol.getBoundingClientRect().width - minMid - resizersTotal);
            const newLeft = Math.round(Math.min(Math.max(minCol, startLeftWidth + dx), maxLeft));
            leftCol.style.flex = `0 0 ${newLeft}px`; leftCol.style.width = `${newLeft}px`;
        } else {
            const maxRight = Math.max(minCol, containerWidth - leftCol.getBoundingClientRect().width - minMid - resizersTotal);
            const newRight = Math.round(Math.min(Math.max(minCol, startRightWidth - dx), maxRight));
            rightCol.style.flex = `0 0 ${newRight}px`; rightCol.style.width = `${newRight}px`;
        }
    }
    function endDrag() {
        if (!activeSide) return;
        container.classList.remove("is-resizing"); resizerLeft.classList.remove("is-dragging"); resizerRight.classList.remove("is-dragging"); activeSide = null;
        try { localStorage.setItem("qbank_col_widths", JSON.stringify({ left: Math.round(leftCol.getBoundingClientRect().width), right: Math.round(rightCol.getBoundingClientRect().width) })); } catch (e) {}
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
// 6. MENU & MỞ MODAL NGÂN HÀNG ĐỀ + KHỞI TẠO KHUNG SỬA ĐỀ CỘT GIỮA
// ============================================================================
function toggleQbankMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!requireQbankAdminOrPrompt()) return;
    const btn = document.getElementById("qbank-btn");
    const menu = document.getElementById("qbank-dropdown-menu");
    if (!btn || !menu) return;
    if (menu.classList.contains("show")) { menu.classList.remove("show"); return; }

    const adminPanel = document.getElementById("admin-popover-panel");
    if (adminPanel) adminPanel.classList.remove("show");

    const rect = btn.getBoundingClientRect(), menuWidth = 285;
    let left = Math.max(10, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 10));
    if (window.innerHeight - rect.bottom < 180 && rect.top > 180) {
        menu.style.top = "auto"; menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
        menu.style.bottom = "auto"; menu.style.top = `${rect.bottom + 6}px`;
    }
    menu.style.left = `${left}px`;
    menu.classList.add("show");
}

document.addEventListener("click", function(e) {
    const wrap = e.target.closest(".qbank-dropdown-wrapper");
    const menu = document.getElementById("qbank-dropdown-menu");
    if (!wrap && menu && menu.classList.contains("show")) menu.classList.remove("show");

    const exportPop = document.getElementById("qbank-export-popover");
    const exportTrigger = document.getElementById("btn-qbank-export-file");
    if (exportPop && exportPop.classList.contains("show")) {
        if (!exportPop.contains(e.target) && !(exportTrigger && exportTrigger.contains(e.target))) closeQbankExportPopover();
    }
});

function ensureQbankMidEditControlsInDOM() {
    const toolsRow = document.querySelector("#qbank-col-mid .qbank-tools-row");
    if (toolsRow && !document.getElementById("btn-qbank-toggle-edit-mode")) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn-qbank btn-qbank-edit-mid";
        editBtn.id = "btn-qbank-toggle-edit-mode";
        editBtn.onclick = () => toggleQbankMidEditMode();
        editBtn.title = "Chia đôi cột giữa để sửa đề trực tiếp giống công cụ Soi đề";
        editBtn.innerHTML = `<span>✏️</span> <span>Sửa đề</span>`;
        const soiDeBtn = Array.from(toolsRow.querySelectorAll("button")).find(b => (b.textContent || "").includes("Soi đề"));
        if (soiDeBtn && soiDeBtn.parentNode) soiDeBtn.parentNode.insertBefore(editBtn, soiDeBtn.nextSibling);
        else toolsRow.appendChild(editBtn);
    }

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

async function openQbankCreatorModal(options = {}) {
    if (!requireQbankAdminOrPrompt()) return;
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");
    const modal = document.getElementById("modal-qbank-creator");
    if (modal) {
        modal.style.display = "flex";
        ensureQbankMidEditControlsInDOM();
        if (qbankMidEditState.isActive) closeQbankMidEditMode(true);
        if (!options || !options.skipDraftReload) await loadQbankDraftState();
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
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
    const modal = document.getElementById("modal-qbank-creator");
    if (modal) modal.style.display = "none";
}

function openSavedExamsModal() {
    if (!requireQbankAdminOrPrompt()) return;
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");
    const modal = document.getElementById("modal-qbank-saved");
    if (modal) { modal.style.display = "flex"; loadSavedExamsList(); }
}

function closeSavedExamsModal() {
    const modal = document.getElementById("modal-qbank-saved");
    if (modal) modal.style.display = "none";
}

function toggleStorageLocation(selectEl) { qbankState.storageTarget = selectEl.value; }

// ============================================================================
// 7.5. CHUYỂN ĐỀ TỪ LỚP SANG CỘT GIỮA NGÂN HÀNG ĐỀ
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
    const letters = ["A", "B", "C", "D"];
    const part = getQbankQuestionPart(q);
    if (part === 1) {
        q.type = "multiple_choice";
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
        if (Array.isArray(q.statements)) {
            q.statements.forEach((st, sIdx) => {
                if (!st.id) st.id = ["a", "b", "c", "d"][sIdx] || String(sIdx + 1);
                let val = st.correct !== undefined ? st.correct : (st.answer !== undefined ? st.answer : st.dapan);
                st.correct = val !== undefined ? (val === true || String(val).toLowerCase() === "đúng" || String(val).toLowerCase() === "true") : true;
            });
        }
    } else {
        if (part === 4) {
            if (!q.part && q.type !== "essay" && q.type !== "essay_answer" && q.type !== "part4") q.part = 4;
        } else {
            q.type = "short_answer";
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
            if (!q.level) q.level = "nb";
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

function openSoiDeFromQBank() {
    if (!requireQbankAdminOrPrompt()) return;
    if (qbankState.rawQuestions.length === 0) return alert("⚠️ Ngân hàng đề đang trống. Vui lòng thêm câu hỏi trước khi Soi đề!");
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
// 8. CỘT 1: CÂY THƯ MỤC & MA TRẬN 16 Ô
// ============================================================================
function findNodeInTree(nodes, id) {
    for (let n of nodes) {
        if (n.id === id) return n;
        if (n.children && n.children.length > 0) { const f = findNodeInTree(n.children, id); if (f) return f; }
    }
    return null;
}

function findParentNodeInTree(nodes, childId) {
    for (let n of nodes) {
        if (n.children && n.children.some(c => c.id === childId)) return n;
        if (n.children && n.children.length > 0) { const f = findParentNodeInTree(n.children, childId); if (f) return f; }
    }
    return null;
}

function getAllDescendantFolderIds(node) {
    let ids = [node.id];
    if (node.children && node.children.length > 0) node.children.forEach(c => { ids = ids.concat(getAllDescendantFolderIds(c)); });
    return ids;
}

function generatePrefixSlug(name) { return formatNodeSlugForId(name); }
function getHierarchicalPrefix(targetId) { return getFolderPathNodes(targetId).map(n => formatNodeSlugForId(n.name)).join("-"); }

function toggleLeafMatrixDisplay(folderId, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (qbankState.expandedLeafMatrixIds.has(folderId)) qbankState.expandedLeafMatrixIds.delete(folderId);
    else qbankState.expandedLeafMatrixIds.add(folderId);
    renderQbankTree();
}

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

        let matrixDropHtml = "";
        const isMatrixOpen = isLeaf && qbankState.expandedLeafMatrixIds.has(node.id);
        if (isLeaf && isMatrixOpen) {
            const counts = { 1: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 2: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 3: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 4: { nb: 0, th: 0, vdt: 0, vdc: 0 } };
            (qbankState.rawQuestions || []).forEach(q => {
                if (q && q.folderId === node.id) {
                    const p = getQbankQuestionPart(q), lvl = q.level || "nb";
                    if (counts[p] && counts[p][lvl] !== undefined) counts[p][lvl]++;
                }
            });

            matrixDropHtml = `
                <div class="leaf-matrix-container" onclick="event.stopPropagation()">
                    <div class="leaf-matrix-header-bar">
                        <span>📥 Ma trận 16 ô (${escapeQbankHtml(node.name)}):</span>
                        <button type="button" class="btn-clear-filter" onclick="toggleLeafMatrixDisplay('${node.id}', event)">▲ Thu lại</button>
                    </div>
                    ${[1, 2, 3, 4].map(p => {
                        const isPartFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
                        return `
                        <div class="leaf-matrix-row">
                            <div class="leaf-matrix-lbl ${isPartFiltered ? "active-filter" : ""}" onclick="setFilterByNodePart('${node.id}', ${p})" title="Xem câu Phần ${p}">P${p}</div>
                            ${["nb", "th", "vdt", "vdc"].map(lvl => {
                                const lblMap = { nb: "NB", th: "TH", vdt: "VD", vdc: "VDC" };
                                const isCellFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl);
                                return `<div class="leaf-drop-zone ${isCellFiltered ? "active-filter" : ""}" ondragover="handleDropZoneOver(event)" ondragleave="handleDropZoneLeave(event)" ondrop="handleDropZoneDrop(event, '${node.id}', ${p}, '${lvl}')" onclick="handleMatrixCellClick('${node.id}', ${p}, '${lvl}')" title="Kéo thả hoặc Click lọc P${p}-${lblMap[lvl]}"><span>${lblMap[lvl]}</span><b>(${counts[p][lvl]})</b></div>`;
                            }).join("")}
                        </div>`;
                    }).join("")}
                </div>
            `;
        }

        return `
            <div class="tree-item-wrapper" style="margin-left:${depth > 0 ? 3 : 0}px;">
                <div class="tree-item ${isActive ? "active" : ""}" id="tree-node-${node.id}" onclick="handleFolderNodeClick('${node.id}')" ondragover="handleLeafTreeDragOver(event, '${node.id}', ${isLeaf})" style="border-left:3.5px solid transparent;">
                    <div style="display:flex; align-items:center; gap:5px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:13px;">${isLeaf ? "📄" : "📁"}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; color:${nodeColor}; font-weight:800;" title="${escapeQbankHtml(node.name)}">${escapeQbankHtml(node.name)}</span>
                        ${subtreeCount > 0 ? `<span class="tree-q-count">${subtreeCount}</span>` : ""}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;" onclick="event.stopPropagation()">
                        ${isLeaf ? `<button class="btn-matrix-toggle ${isMatrixOpen ? "is-open" : ""}" onclick="toggleLeafMatrixDisplay('${node.id}', event)" title="Mở/Đóng ma trận 16 ô">⊞</button>` : ""}
                        <div class="tree-color-picker-dot" style="background:${nodeColor};" onclick="promptChangeFolderColor('${node.id}')" title="Đổi màu"></div>
                        <button class="btn-rename-tree" onclick="promptRenameFolder('${node.id}')" title="Đổi tên">✏️</button>
                        ${!isLeaf || depth < 2 ? `<button class="btn-add-tree" onclick="promptAddChildFolder('${node.id}')" title="Thêm mục con">+</button>` : ""}
                        <button class="btn-add-tree" style="color:#ef4444;" onclick="promptDeleteFolder('${node.id}')" title="Xóa">✕</button>
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
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);
    qbankState.activeFilter = { folderId: folderId, folderName: qbankState.activeFolderObj ? qbankState.activeFolderObj.name : "", part: null, level: null };
    const node = qbankState.activeFolderObj;
    if (node && (!node.children || node.children.length === 0)) qbankState.expandedLeafMatrixIds.add(folderId);
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function setFilterByNodePart(folderId, part) {
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
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
        if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
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
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
    qbankState.assignMode = false; qbankState.hideAssigned = false;
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function toggleQbankAssignMode() {
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
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
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
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
        renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); refreshQbankExportPopoverIfOpen();
        showQbankToast(`✏️ Đã đổi tên thành "${node.name}" & cập nhật ID!`, "success");
    }
}

function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Lớp 10):");
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm thư mục gốc "${name.trim()}"`);
        qbankState.currentTree.push({ id: "node_" + Date.now(), name: name.trim(), color: QBANK_COLOR_PALETTE[Math.floor(Math.random() * QBANK_COLOR_PALETTE.length)], children: [] });
        saveQbankTreeData(); saveQbankDraftState(false); renderQbankTree(); refreshQbankExportPopoverIfOpen();
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
        saveQbankTreeData(); saveQbankDraftState(false); renderQbankTree(); refreshQbankExportPopoverIfOpen();
        showQbankToast(`📁 Đã tạo mục "${name.trim()}" & đồng bộ Cloud!`, "success");
    }
}

function promptChangeFolderColor(folderId) {
    let colorHtml = `<div style="display:flex; gap:8px; justify-content:center; margin:10px 0;">`;
    QBANK_COLOR_PALETTE.forEach(c => { colorHtml += `<div onclick="applyFolderColorChange('${folderId}', '${c}')" style="width:24px; height:24px; border-radius:50%; background:${c}; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`; });
    colorHtml += `</div>`;
    let div = document.createElement("div");
    div.className = "qbank-modal-overlay"; div.id = "color-picker-modal"; div.style.display = "flex";
    div.innerHTML = `<div class="qbank-modal-container" style="width:320px; height:auto; padding:22px; background:#fff; box-shadow:0 25px 60px rgba(0,0,0,0.5);"><h3 style="margin-top:0; color:#0f172a; font-weight:900; font-size:15px; text-align:center;">🎨 Chọn màu thư mục</h3>${colorHtml}<button onclick="document.getElementById('color-picker-modal').remove()" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; cursor:pointer; font-weight:800; color:#475569; margin-top:10px;">Đóng</button></div>`;
    document.body.appendChild(div);
}

window.applyFolderColorChange = function(folderId, newColor) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (node) { node.color = newColor; saveQbankTreeData(); renderQbankTree(); refreshQbankExportPopoverIfOpen(); }
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
    syncAssignModeButtonsUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast(`🗑️ Đã xóa thư mục "${targetNode.name}".`, "warning");
}

function selectQbankFolder(folderId) { handleFolderNodeClick(folderId); }

// ============================================================================
// 9. KÉO THẢ & GÁN VÀO MA TRẬN 16 Ô
// ============================================================================
function handleDropZoneOver(e) { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }
function handleDropZoneLeave(e) { e.currentTarget.classList.remove("drag-over"); }

function mutateQuestionMatrix(qId, folderId, part, level, assignedTimestamp = null) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return null;
    if (part === 1) { q.type = "multiple_choice"; delete q.part; delete q.isPart4; if (!q.options) q.options = ["A", "B", "C", "D"]; }
    else if (part === 2) { q.type = "true_false"; delete q.part; delete q.isPart4; if (!q.statements) q.statements = [{ id: "a", statement: "", correct: true }]; }
    else if (part === 3) { q.type = "short_answer"; delete q.part; delete q.isPart4; }
    else if (part === 4) { q.type = "short_answer"; q.part = 4; }
    q.level = level; q.folderId = folderId; q.assignedAt = assignedTimestamp || Date.now();
    const cur = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = cur ? cur.name : "";
    return q;
}

function handleDropZoneDrop(e, folderId, part, level) {
    e.preventDefault(); e.currentTarget.classList.remove("drag-over");
    const qId = e.dataTransfer.getData("text/plain") || qbankState.draggedQId;
    qbankState.draggedQId = null;
    if (!qId) return;

    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const isMultiDrag = qbankState.selectedQuestionIds.has(String(qId)) && qbankState.selectedQuestionIds.size > 1;
    const idsToMove = isMultiDrag ? Array.from(qbankState.selectedQuestionIds) : [String(qId)];

    pushQbankUndoState(`Xếp ${idsToMove.length} câu vào ${folderLabel} (P${part} - ${getQbankLevelLabel(level)})`);
    const baseTs = Date.now();
    let lastMovedQ = null;
    idsToMove.forEach((id, idx) => { const m = mutateQuestionMatrix(id, folderId, part, level, baseTs + idx); if (m) lastMovedQ = m; });
    if (isMultiDrag) { qbankState.selectedQuestionIds.clear(); updateQbankDeleteSelectedButtonUI(); }
    if (!lastMovedQ) return;

    recomputeAllMatrixIds(); saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast(idsToMove.length > 1 ? `✅ Đã xếp ${idsToMove.length} câu vào ${folderLabel} (${lastMovedQ.matrixId})` : `✅ Đã đánh số & xếp: ${lastMovedQ.matrixId}`, "success");
}

function assignSelectedQuestionsToMatrix(folderId, part, level) {
    if (qbankState.selectedQuestionIds.size === 0) return;
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const count = qbankState.selectedQuestionIds.size;

    pushQbankUndoState(`Xếp ${count} câu vào ${folderLabel} (P${part} - ${getQbankLevelLabel(level)})`);
    const baseTs = Date.now();
    let idx = 0;
    qbankState.selectedQuestionIds.forEach(qId => { mutateQuestionMatrix(qId, folderId, part, level, baseTs + idx); idx++; });
    qbankState.selectedQuestionIds.clear();

    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast(`✅ Đã đánh số & xếp ${count} câu vào ${folderLabel}`, "success");
}

function applyMatrixToQuestion(qId, folderId, part, level) {
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    pushQbankUndoState(`Chuyển câu vào ${targetFolder ? targetFolder.name : "Thư mục"}`);
    const q = mutateQuestionMatrix(qId, folderId, part, level, Date.now());
    if (!q) return;
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast(`✅ Đã chuyển câu: ${q.matrixId}`, "success");
}

function unassignQbankQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q || !q.folderId) return;
    pushQbankUndoState(`Bỏ xếp ${q.matrixId || "câu hỏi"}`);
    q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = ""; delete q.assignedAt;
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast("↩️ Đã trả câu về mục Chưa xếp!", "info");
}

// ============================================================================
// 10. CHUYỂN, XÓA LẺ & XÓA NHIỀU CÂU
// ============================================================================
function pruneStaleSelectedQuestionIds() {
    const existingIds = new Set((qbankState.rawQuestions || []).map(q => String(q.id)));
    const cleaned = new Set();
    qbankState.selectedQuestionIds.forEach(id => { if (existingIds.has(String(id))) cleaned.add(String(id)); });
    qbankState.selectedQuestionIds = cleaned;
    return cleaned.size;
}

function updateQbankDeleteSelectedButtonUI() {
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!btn) return;
    const count = pruneStaleSelectedQuestionIds();
    btn.classList.toggle("has-selection", count > 0);
    btn.innerHTML = count > 0 ? `<span>🗑️</span> <span>Xóa nhiều câu (${count})</span>` : `<span>🗑️</span> <span>Xóa nhiều câu</span>`;
}

function deleteSelectedQbankQuestions() {
    const count = pruneStaleSelectedQuestionIds();
    if (count === 0) return showQbankToast("⚠️ Vui lòng tích chọn (☑️) câu hỏi trước khi xóa!", "warning");
    if (!confirm(`⚠️ XÓA ${count} câu hỏi đã tích chọn?\n(Có thể bấm ↩️ Lùi nếu lỡ tay).`)) return;
    pushQbankUndoState(`Xóa ${count} câu đã chọn`);
    const idsToDelete = new Set(qbankState.selectedQuestionIds);
    qbankState.rawQuestions = (qbankState.rawQuestions || []).filter(q => !idsToDelete.has(String(q.id)));
    qbankState.selectedQuestionIds.clear();
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast(`🗑️ Đã xóa ${count} câu hỏi!`, "warning");
}

function deleteQbankQuestion(qId) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
    const target = qbankState.rawQuestions.find(q => String(q.id) === String(qId));
    pushQbankUndoState(`Xóa ${target && target.matrixId ? target.matrixId : "1 câu hỏi"}`);
    qbankState.rawQuestions = qbankState.rawQuestions.filter(q => String(q.id) !== String(qId));
    qbankState.selectedQuestionIds.delete(String(qId));
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
    showQbankToast("🗑️ Đã xóa câu hỏi.", "warning");
}

function promptMoveQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;
    let options = [];
    function traverse(nodes, path) {
        nodes.forEach(n => {
            let p = path ? path + " > " + n.name : n.name;
            if (!n.children || n.children.length === 0) options.push({ id: n.id, name: p });
            else traverse(n.children, p);
        });
    }
    traverse(qbankState.currentTree, "");
    if (options.length === 0) return alert("Chưa có thư mục lá nào để chuyển!");

    const currentPart = getQbankQuestionPart(q), currentLevel = q.level || "nb";
    let selectHtml = `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">1. Chọn thư mục lưu trữ:</label><select id="move-qbank-folder" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;">${options.map(o => `<option value="${o.id}" ${o.id === q.folderId ? "selected" : ""}>${escapeQbankHtml(o.name)}</option>`).join("")}</select></div>`;
    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">2. Chọn Phần thi:</label><select id="move-qbank-part" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;"><option value="1" ${currentPart === 1 ? "selected" : ""}>Phần I: Trắc nghiệm 4 lựa chọn</option><option value="2" ${currentPart === 2 ? "selected" : ""}>Phần II: Trắc nghiệm Đúng/Sai</option><option value="3" ${currentPart === 3 ? "selected" : ""}>Phần III: Trả lời ngắn</option><option value="4" ${currentPart === 4 ? "selected" : ""}>Phần IV: Tự luận ngắn</option></select></div>`;
    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">3. Chọn Mức độ:</label><select id="move-qbank-level" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;"><option value="nb" ${currentLevel === "nb" ? "selected" : ""}>Nhận biết (NB)</option><option value="th" ${currentLevel === "th" ? "selected" : ""}>Thông hiểu (TH)</option><option value="vdt" ${currentLevel === "vdt" ? "selected" : ""}>Vận dụng (VD)</option><option value="vdc" ${currentLevel === "vdc" ? "selected" : ""}>Vận dụng cao (VDC)</option></select></div>`;

    let div = document.createElement("div");
    div.className = "qbank-modal-overlay"; div.id = "move-qbank-modal"; div.style.display = "flex";
    div.innerHTML = `<div class="qbank-modal-container" style="width:50vw; min-width:320px; max-width:520px; height:auto; padding:22px; overflow:visible; background:#fff;"><h3 style="margin-top:0; color:#0284c7; font-weight:900; font-size:17px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:14px;">🔄 CHUYỂN CÂU HỎI SANG MỤC KHÁC</h3>${selectHtml}<div style="display:flex; gap:10px; margin-top:16px;"><button onclick="document.getElementById('move-qbank-modal').remove()" style="flex:1; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:800;">✕ Hủy</button><button onclick="executeMoveQbankQuestion('${safeQbankJsArg(qId)}')" style="flex:1.5; padding:10px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; cursor:pointer; font-weight:900;">🚀 Xác nhận chuyển</button></div></div>`;
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
// 11. XUẤT FILE (PDF / WORD) THEO CÂY THƯ MỤC
// ============================================================================
function syncExportSelectedFolderIds() {
    const validIds = new Set();
    function collectIds(nodes) { (nodes || []).forEach(n => { validIds.add(n.id); if (n.children && n.children.length > 0) collectIds(n.children); }); }
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
    const popover = document.getElementById("qbank-export-popover"), triggerBtn = document.getElementById("btn-qbank-export-file");
    if (!popover || !triggerBtn) return;
    if (popover.classList.contains("show")) { closeQbankExportPopover(); return; }

    syncExportSelectedFolderIds();
    qbankState.exportCustomTitleTouched = false;
    renderQbankExportTree();
    updateQbankExportFooterUI();
    const formatMenu = document.getElementById("qbank-export-format-menu");
    if (formatMenu) formatMenu.classList.remove("show", "open-upward");

    popover.classList.add("show"); triggerBtn.classList.add("is-open");
    const rect = triggerBtn.getBoundingClientRect(), popWidth = Math.min(450, window.innerWidth * 0.94);
    let left = Math.max(12, Math.min(rect.left, window.innerWidth - popWidth - 12));
    const approxHeight = Math.min(popover.offsetHeight || 420, window.innerHeight * 0.78);
    let top = rect.bottom + 8;
    if (top + approxHeight > window.innerHeight - 12) top = Math.max(12, window.innerHeight - approxHeight - 12);
    popover.style.left = `${Math.round(left)}px`; popover.style.top = `${Math.round(top)}px`;
}

function closeQbankExportPopover() {
    const p = document.getElementById("qbank-export-popover"), b = document.getElementById("btn-qbank-export-file"), m = document.getElementById("qbank-export-format-menu");
    if (p) p.classList.remove("show"); if (b) b.classList.remove("is-open"); if (m) m.classList.remove("show", "open-upward");
}

function handleQbankExportPopoverInnerClick(event) {
    event.stopPropagation();
    const actionWrap = document.getElementById("qbank-export-action-wrapper"), formatMenu = document.getElementById("qbank-export-format-menu");
    if (formatMenu && formatMenu.classList.contains("show") && (!actionWrap || !actionWrap.contains(event.target))) formatMenu.classList.remove("show", "open-upward");
}

function refreshQbankExportPopoverIfOpen() {
    const popover = document.getElementById("qbank-export-popover");
    if (popover && popover.classList.contains("show")) { syncExportSelectedFolderIds(); renderQbankExportTree(); updateQbankExportFooterUI(); }
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
    if (isChecked) allIds.forEach(id => qbankState.exportSelectedFolderIds.add(id));
    else {
        allIds.forEach(id => qbankState.exportSelectedFolderIds.delete(id));
        const path = getFolderPathNodes(folderId);
        for (let i = 0; i < path.length - 1; i++) {
            const anc = path[i];
            if (!(qbankState.rawQuestions || []).some(q => q && q.folderId === anc.id)) qbankState.exportSelectedFolderIds.delete(anc.id);
        }
    }
    renderQbankExportTree(); updateQbankExportFooterUI();
}

function toggleQbankExportUnassignedCheck(isChecked) {
    if (isChecked) qbankState.exportSelectedFolderIds.add(QBANK_EXPORT_UNASSIGNED_KEY);
    else qbankState.exportSelectedFolderIds.delete(QBANK_EXPORT_UNASSIGNED_KEY);
    updateQbankExportFooterUI();
}

function selectAllQbankExportFolders(selectAll) {
    if (!selectAll) qbankState.exportSelectedFolderIds.clear();
    else {
        function addAll(nodes) { (nodes || []).forEach(n => { qbankState.exportSelectedFolderIds.add(n.id); if (n.children && n.children.length > 0) addAll(n.children); }); }
        addAll(qbankState.currentTree);
        if ((qbankState.rawQuestions || []).some(q => q && !q.folderId)) qbankState.exportSelectedFolderIds.add(QBANK_EXPORT_UNASSIGNED_KEY);
    }
    renderQbankExportTree(); updateQbankExportFooterUI();
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
        const count = getSubtreeCount(node), state = getExportNodeCheckState(node), nodeColor = node.color || "#0284c7";
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
    indeterminateIds.forEach(id => { const chk = document.getElementById(`exp-chk-${id}`); if (chk) chk.indeterminate = true; });
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
    const summaryEl = document.getElementById("qbank-export-summary"), emptyHintEl = document.getElementById("qbank-export-empty-hint");
    const actionWrap = document.getElementById("qbank-export-action-wrapper"), btnText = document.getElementById("btn-qbank-export-options-text");
    const formatMenu = document.getElementById("qbank-export-format-menu"), titleInput = document.getElementById("qbank-export-title-input");
    const qCount = getSelectedQbankExportQuestions().length;
    let selectedLeafCount = 0;
    qbankState.exportSelectedFolderIds.forEach(id => {
        if (id === QBANK_EXPORT_UNASSIGNED_KEY) selectedLeafCount++;
        else { const n = findNodeInTree(qbankState.currentTree, id); if (n && (!n.children || n.children.length === 0)) selectedLeafCount++; }
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
    const menu = document.getElementById("qbank-export-format-menu"), btn = document.getElementById("btn-qbank-export-options");
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
        q.imageUrl = resolvedImg; q.imageKey = `img_q_${q.id}`;
        if (imagesMap && typeof imagesMap === "object") imagesMap[q.imageKey] = resolvedImg;
    }
    if (p === 1) {
        q.type = "multiple_choice"; delete q.part; delete q.isPart4;
        q.options = Array.isArray(q.options) ? q.options.map(o => String(o ?? "")) : ["", "", "", ""];
        if (typeof q.correct === "string") { const cIdx = letters.indexOf(q.correct.trim().toUpperCase()); q.correct = cIdx !== -1 ? cIdx : 0; }
        else if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) q.correct = 0;
    } else if (p === 2) {
        q.type = "true_false"; delete q.part; delete q.isPart4;
        q.statements = Array.isArray(q.statements) ? q.statements.map((st, sIdx) => ({
            id: st.id || ["a", "b", "c", "d"][sIdx] || String(sIdx + 1),
            statement: String(st.statement ?? ""),
            correct: (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true")
        })) : [];
    } else if (p === 4) {
        q.type = "essay"; q.correctAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : ""));
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
        closeQbankExportPopover(); exportExamToPDF(exportData, exportTitle, "QBANK", 90, includeKey);
        showQbankToast(`📄 Đã mở bản xem in / Xuất PDF (${normalizedQuestions.length} câu)!`, "success");
    } else if (format === "word") {
        if (typeof exportExamToWord !== "function") return alert("❌ Không tìm thấy bộ xuất Word!");
        closeQbankExportPopover(); exportExamToWord(exportData, exportTitle, "QBANK", 90, includeKey);
        showQbankToast(`📝 Đã tải file Word (.doc) gồm ${normalizedQuestions.length} câu!`, "success");
    }
}

// ============================================================================
// 12. UPLOAD JSON ĐỀ MỚI
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

function parseUniversalExamText(text) {
    if (!text) return null;
    let clean = String(text).trim();
    try { return JSON.parse(clean); } catch (e) {}
    try {
        let scriptText = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, "return ");
        return new Function(scriptText)();
    } catch (e) {
        clean = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, "").trim().replace(/;?(\s*\/\*[\s\S]*?\*\/|\s*\/\/.*)*\s*$/, "").trim();
        if (clean.endsWith(";")) clean = clean.slice(0, -1).trim();
        try { return new Function("return (" + clean + ");")(); } catch (e2) { return null; }
    }
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
                if (!q.level) q.level = "nb";
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
            if (qbankMidEditState.isActive) closeQbankMidEditMode(true);

            recomputeAllMatrixIds(); syncAssignModeButtonsUI(); updateQbankDeleteSelectedButtonUI(); saveQbankDraftState(false);
            renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats(); refreshQbankExportPopoverIfOpen();
            showQbankToast(`✅ Đã nạp đề "${examTitle}" (${importedQuestions.length} câu mới)!`, "success");
        } catch (err) {
            showQbankToast("❌ Lỗi nạp file: " + err.message, "error");
            alert("❌ Lỗi nạp file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================================================
// 13. LỌC, SẮP XẾP & RENDER THẺ CÂU HỎI CỘT GIỮA
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
        const lvlA = levelOrder[a.level || "nb"] || 1, lvlB = levelOrder[b.level || "nb"] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;
        const seqA = Number(a.matrixSeq) || 0, seqB = Number(b.matrixSeq) || 0;
        if (seqA !== seqB) return seqA - seqB;
        return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
    });
}

function getFilteredAndSortedQuestions() {
    let list = getScopeQuestionsForMatrix();
    if (qbankState.activeFilter.part) list = list.filter(q => getQbankQuestionPart(q) === qbankState.activeFilter.part);
    if (qbankState.activeFilter.level) list = list.filter(q => (q.level || "nb") === qbankState.activeFilter.level);
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
        const p = getQbankQuestionPart(q), lvl = q.level || "nb";
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
        contentDetailsHtml = `<div style="margin:4px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 6px;">${q.statements.map(st => { const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng"); return `<div style="font-size:11.5px; margin-bottom:2px; display:flex; justify-content:space-between;"><span><b>${st.id})</b> ${st.statement}</span><b style="color:${isTrue ? "#16a34a" : "#dc2626"};">${isTrue ? "🟢 Đúng" : "🔴 Sai"}</b></div>`; }).join("")}</div>`;
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

function handleQuestionDragStart(e, qId) { qbankState.draggedQId = qId; e.dataTransfer.setData("text/plain", qId); }
function handleQuestionDragEnd() { qbankState.draggedQId = null; }
function toggleSelectQuestion(qId, isChecked) {
    if (isChecked) qbankState.selectedQuestionIds.add(String(qId));
    else qbankState.selectedQuestionIds.delete(String(qId));
    const card = document.getElementById(`qbank-card-${qId}`);
    if (card) card.classList.toggle("selected", isChecked);
    updateQbankDeleteSelectedButtonUI(); updateQbankBuilderStats();
}
function clearSelectedQuestions() {
    qbankState.selectedQuestionIds.clear();
    updateQbankDeleteSelectedButtonUI(); renderQbankQuestions(); updateQbankBuilderStats();
}

// ============================================================================
// 14. UPLOAD & DÁN ẢNH CHO CÂU HỎI
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
            if (items[i].type.indexOf("image") !== -1) { e.preventDefault(); qbEditUploadImage(items[i].getAsFile(), qId, imgKey); break; }
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

// ============================================================================
// 15. CHẾ ĐỘ "✏️ SỬA ĐỀ" CHIA ĐÔI NGAY TRONG CỘT GIỮA (GIỐNG HỆT BÊN SOI ĐỀ)
// ============================================================================
function toggleQbankMidEditMode() {
    if (qbankMidEditState.isActive) closeQbankMidEditMode(false);
    else openQbankMidEditMode();
}

function openQbankMidEditMode() {
    if (!requireQbankAdminOrPrompt()) return;
    ensureQbankMidEditControlsInDOM();
    const visibleList = getFilteredAndSortedQuestions();
    const clonedQ = JSON.parse(JSON.stringify(visibleList));

    qbankMidEditState.isActive = true;
    qbankMidEditState.questions = clonedQ;
    qbankMidEditState.images = JSON.parse(JSON.stringify(qbankState.imagesMap || {}));
    qbankMidEditState.editingSourceIds = new Set(clonedQ.map(q => String(q.id)));
    qbankMidEditState.title = qbankState.currentExamTitle || qbankState.activeFilter.folderName || "NGÂN HÀNG ĐỀ";
    qbankMidEditState.maDe = "QBANK";
    qbankMidEditState.timeLimitMinutes = 90;
    qbankMidEditState.editorMode = "cards";
    qbankMidEditState.rawEditingCardIds = new Set();
    qbankMidEditState.isDirty = false;

    const btnToggle = document.getElementById("btn-qbank-toggle-edit-mode");
    if (btnToggle) { btnToggle.classList.add("is-active"); btnToggle.innerHTML = `<span>←</span> <span>Đóng sửa đề</span>`; }

    const midExamBar = document.getElementById("qbank-mid-exam-bar"), matrixBar = document.getElementById("qbank-matrix-bar");
    const qList = document.getElementById("qbank-questions-list"), ws = document.getElementById("qbank-mid-edit-workspace");
    if (midExamBar) midExamBar.style.display = "none";
    if (matrixBar) matrixBar.style.display = "none";
    if (qList) qList.style.display = "none";
    if (ws) ws.classList.add("show");

    qbEditSetMode("cards");
    qbEditRenderBothSides();
    setTimeout(qbEditAutoResizeAllTextareas, 60);
    showQbankToast(`✏️ Đã mở chế độ Sửa đề chia đôi màn hình (${clonedQ.length} câu)!`, "info");
}

async function closeQbankMidEditMode(forceSkipPrompt = false) {
    if (!qbankMidEditState.isActive) return;
    if (qbankMidEditState.isDirty && !forceSkipPrompt) {
        if (confirm("💾 Bạn vừa có chỉnh sửa trong chế độ Sửa đề.\n\nBấm [OK] để LƯU các thay đổi vào Ngân hàng đề trước khi đóng.\nBấm [Cancel] để đóng không lưu.")) {
            await commitQbankMidEditChanges(false);
            return;
        }
    }
    qbankMidEditState.isActive = false; qbankMidEditState.isDirty = false;
    const btnToggle = document.getElementById("btn-qbank-toggle-edit-mode");
    if (btnToggle) { btnToggle.classList.remove("is-active"); btnToggle.innerHTML = `<span>✏️</span> <span>Sửa đề</span>`; }

    const midExamBar = document.getElementById("qbank-mid-exam-bar"), matrixBar = document.getElementById("qbank-matrix-bar");
    const qList = document.getElementById("qbank-questions-list"), ws = document.getElementById("qbank-mid-edit-workspace");
    if (ws) ws.classList.remove("show");
    if (midExamBar) midExamBar.style.display = "";
    if (matrixBar) matrixBar.style.display = "";
    if (qList) qList.style.display = "flex";

    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats(); updateQbankBuilderStats();
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
    const fId = qbankState.activeFilter.folderId;
    if (fId) {
        const node = findNodeInTree(qbankState.currentTree, fId);
        if (node && (!node.children || node.children.length === 0)) {
            newQ.folderId = node.id; newQ.folderName = node.name;
            newQ.level = qbankState.activeFilter.level || "nb"; newQ.assignedAt = Date.now();
            return;
        }
    }
    newQ.folderId = null; newQ.folderName = ""; newQ.level = newQ.level || "nb";
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

        let currentPartType = "multiple_choice";
        if (qbEditGetPartType(q) === 4) currentPartType = "part4";
        else if (q.type === "true_false") currentPartType = "true_false";
        else if (q.type === "short_answer") currentPartType = "short_answer";

        const safeQId = safeQbankJsArg(q.id);
        const isRawEditing = qbankMidEditState.rawEditingCardIds.has(String(q.id));
        let cardBodyHtml = "";

        if (isRawEditing) {
            cardBodyHtml = `
                <div class="soide-card-raw-box" id="qb-edit-card-raw-box-${escapeQbankAttr(q.id)}">
                    <div class="soide-card-raw-header"><span>💻 Mã nguồn thô câu ${qIdx + 1}:</span><span>(Dán JSON hoặc text Word)</span></div>
                    <textarea class="soide-card-raw-textarea" id="qb-edit-card-raw-text-${escapeQbankAttr(q.id)}" spellcheck="false">${escapeQbankHtml(JSON.stringify(q, null, 2))}</textarea>
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
                        const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
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
        let currentPartType = "multiple_choice";
        if (qbEditGetPartType(q) === 4) currentPartType = "part4";
        else if (q.type === "true_false") currentPartType = "true_false";
        else if (q.type === "short_answer") currentPartType = "short_answer";

        const imgUrl = resolveQbankImageUrl(q, imageMap), imgKey = q.imageKey || `img_q_${qId}`, safeImgKey = safeQbankJsArg(imgKey);
        const imgHtml = imgUrl ? `<div class="quiz-img-container" id="qb-edit-img-box-${escapeQbankAttr(qId)}"><div class="quiz-img-wrapper" style="position:relative; display:inline-block;"><img src="${escapeQbankAttr(imgUrl)}" class="quiz-img" style="max-height:220px;" onerror="handleQbankImgError(this)" alt="Hình câu ${displayIndex}"></div></div>` : `<div class="quiz-img-container" id="qb-edit-img-box-${escapeQbankAttr(qId)}" style="display:none;"></div>`;
        const uploaderHtml = `
            <div class="admin-img-uploader-zone" id="qb-edit-zone-${escapeQbankAttr(qId)}" tabindex="0" style="margin:4px 0 6px 0; padding:4px 7px; background:rgba(255,255,255,0.75); border-radius:7px;">
                <div class="admin-uploader-btn-group">
                    <button type="button" class="btn-admin-paste-img" style="padding:3px 9px; font-size:11px;" onclick="qbEditTriggerPastePrompt('${safeQId}', '${safeImgKey}')">📋 Dán ảnh (Ctrl+V)</button>
                    <button type="button" class="btn-admin-file-img" style="padding:3px 9px; font-size:11px;" onclick="document.getElementById('qb-edit-img-file-${safeQId}').click()">📁 Tệp ảnh</button>
                    ${imgUrl ? `<button type="button" class="btn-admin-del-img" style="padding:3px 9px; font-size:11px;" onclick="qbEditDeleteQuestionImage('${safeQId}', '${safeImgKey}')">🗑️ Xóa ảnh</button>` : ""}
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
                const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
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
                if (clipboardItems[i].type.indexOf("image") !== -1) { e.preventDefault(); qbEditUploadImage(clipboardItems[i].getAsFile(), qId, imgKey); break; }
            }
        });
    });
}

function qbEditTriggerPastePrompt(qId) { const z = document.getElementById(`qb-edit-zone-${qId}`); if (z) z.focus(); showQbankToast("📋 Click vào khung này rồi nhấn Ctrl + V để dán ảnh!", "info"); }
function qbEditHandleImageSelected(input, qId, imgKey) { if (input.files && input.files[0]) qbEditUploadImage(input.files[0], qId, imgKey); }

async function qbEditUploadImage(file, qId, imgKey) {
    if (!file) return;
    const statusEl = document.getElementById(`qb-edit-img-status-${qId}`);
    if (statusEl) { statusEl.className = "admin-uploader-status loading"; statusEl.innerText = "⏳ Đang tải ảnh..."; }
    try {
        const directUrl = await uploadImageToHostOrDrive(file, `qbank_edit_${qId}`);
        if (!qbankMidEditState.images) qbankMidEditState.images = {};
        qbankMidEditState.images[imgKey] = directUrl;
        const targetQ = (qbankMidEditState.questions || []).find(item => String(item.id) === String(qId));
        if (targetQ) { targetQ.imageUrl = directUrl; targetQ.imageKey = imgKey; }
        qbankMidEditState.isDirty = true;
        qbEditRenderBothSides();
        showQbankToast("🖼️ Đã chèn ảnh thành công! Bấm ⚡ Update để lưu.", "success");
    } catch (err) {
        if (statusEl) { statusEl.className = "admin-uploader-status error"; statusEl.innerText = "❌ Lỗi: " + err.message; }
        showQbankToast("❌ Lỗi tải ảnh: " + err.message, "error");
    }
}

function qbEditDeleteQuestionImage(qId, imgKey) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA ảnh của câu này không?")) return;
    if (qbankMidEditState.images) { delete qbankMidEditState.images[imgKey]; delete qbankMidEditState.images[`img_q_${qId}`]; }
    const targetQ = (qbankMidEditState.questions || []).find(item => String(item.id) === String(qId));
    if (targetQ) targetQ.imageUrl = "";
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
}

function qbEditDebouncedLivePreview() {
    if (qbankMidEditState.debounceTimer) clearTimeout(qbankMidEditState.debounceTimer);
    qbankMidEditState.debounceTimer = setTimeout(() => { qbEditRenderLeftLivePreview(); qbEditUpdateRawTextFromState(); }, 220);
}

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
    if (newType === "multiple_choice") { q.type = "multiple_choice"; delete q.part; delete q.isPart4; if (!q.options || q.options.length < 4) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"]; if (q.correct === undefined) q.correct = 0; }
    else if (newType === "true_false") { q.type = "true_false"; delete q.part; delete q.isPart4; if (!q.statements || q.statements.length < 4) q.statements = [{ id: "a", statement: "Mệnh đề a", correct: true }, { id: "b", statement: "Mệnh đề b", correct: false }, { id: "c", statement: "Mệnh đề c", correct: true }, { id: "d", statement: "Mệnh đề d", correct: false }]; }
    else if (newType === "short_answer") { q.type = "short_answer"; delete q.part; delete q.isPart4; if (!q.correctAnswer) q.correctAnswer = "0"; }
    else if (newType === "part4") { q.type = "short_answer"; q.part = 4; if (!q.correctAnswer) q.correctAnswer = "0"; }
    qbankMidEditState.questions = qbEditReorganizeQuestions(qbankMidEditState.questions);
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    showQbankToast("✅ Đã chuyển câu sang phần mới!", "info");
}

function qbEditInsertQuestionAfter(qIdx) {
    const currentQ = qbankMidEditState.questions[qIdx], currentPart = currentQ ? qbEditGetPartType(currentQ) : 1;
    const newId = qbEditGenerateNewUniqueId();
    let newQuestion = { id: newId, type: "multiple_choice", question: "Câu hỏi mới: Cho hàm số $y = f(x)$...", options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], correct: 0, explanation: "" };
    if (currentPart === 2) newQuestion = { id: newId, type: "true_false", question: "Xét tính đúng sai của các mệnh đề sau:", statements: [{ id: "a", statement: "Mệnh đề a", correct: true }, { id: "b", statement: "Mệnh đề b", correct: false }, { id: "c", statement: "Mệnh đề c", correct: true }, { id: "d", statement: "Mệnh đề d", correct: false }], explanation: "" };
    else if (currentPart === 3) newQuestion = { id: newId, type: "short_answer", question: "Tìm giá trị của biểu thức sau:", correctAnswer: "0", explanation: "" };
    else if (currentPart === 4) newQuestion = { id: newId, type: "short_answer", part: 4, question: "PHẦN IV. Tự luận ngắn:", correctAnswer: "0", explanation: "" };
    qbEditInheritActiveFolderMeta(newQuestion);
    qbEditInsertOrganizedByPart([newQuestion]);
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    setTimeout(() => { qbEditAutoResizeAllTextareas(); qbEditScrollToLeftPreview(newId, true); const card = document.getElementById(`qb-edit-qcard-${newId}`); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
}

function qbEditAddNewQuestion() {
    const newId = qbEditGenerateNewUniqueId();
    const newQ = { id: newId, type: "multiple_choice", question: "Câu hỏi trắc nghiệm mới...", options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], correct: 0, explanation: "" };
    qbEditInheritActiveFolderMeta(newQ);
    qbEditInsertOrganizedByPart([newQ]);
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    setTimeout(() => { qbEditAutoResizeAllTextareas(); qbEditScrollToLeftPreview(newId, true); const card = document.getElementById(`qb-edit-qcard-${newId}`); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); showQbankToast("➕ Đã thêm câu mới vào Phần I!", "info"); }, 60);
}

function qbEditDeleteQuestion(qIdx) {
    if (!confirm(`⚠️ Bạn có chắc chắn muốn XÓA Câu ${qIdx + 1} không?`)) return;
    qbankMidEditState.questions.splice(qIdx, 1);
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
            if (ta) { if (clipboardText && clipboardText.trim()) { ta.value = clipboardText.trim(); showQbankToast(`📋 Đã nạp nội dung dán vào mã thô Câu ${qIdx + 1}!`, "info"); } ta.focus(); }
            qbEditScrollToLeftPreview(targetQ.id, true);
        }, 50);
    } else if (mode === "insert") {
        let parsedQuestions = (clipboardText && clipboardText.trim()) ? qbEditParseMultipleQuestions(clipboardText) : [];
        if (parsedQuestions.length === 0) parsedQuestions = [{ type: "multiple_choice", question: "Câu hỏi mới: ...", options: ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], correct: 0, explanation: "" }];
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
        setTimeout(() => { const ta = document.getElementById(`qb-edit-card-raw-text-${targetQ.id}`); if (ta) { if (text) ta.value = text.trim(); ta.focus(); } showQbankToast(`📋 Đã dán vào mã thô Câu ${qIdx + 1}!`, "info"); }, 40);
    } else if (mode === "insert") {
        let parsedQuestions = qbEditParseMultipleQuestions(text);
        if (parsedQuestions.length === 0) parsedQuestions = [{ type: "multiple_choice", question: text || "Câu hỏi mới...", options: ["A", "B", "C", "D"], correct: 0, explanation: "" }];
        parsedQuestions.forEach(q => { q.id = qbEditGenerateNewUniqueId(); qbEditInheritActiveFolderMeta(q); });
        qbEditInsertOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => qbankMidEditState.rawEditingCardIds.add(String(q.id)));
        qbankMidEditState.isDirty = true;
        qbEditRenderBothSides();
        const firstId = parsedQuestions[0].id;
        setTimeout(() => { const ta = document.getElementById(`qb-edit-card-raw-text-${firstId}`); if (ta && text) ta.value = text.trim(); qbEditScrollToLeftPreview(firstId, true); showQbankToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào cuối từng phần!`, "success"); }, 60);
    }
}

function qbEditApplyCardRawInput(qIdx, qId) {
    const ta = document.getElementById(`qb-edit-card-raw-text-${qId}`);
    if (!ta) return;
    const rawVal = ta.value.trim();
    if (!rawVal) return alert("⚠️ Vui lòng nhập nội dung câu hỏi!");
    const qObj = qbEditParseSingleQuestion(rawVal);
    if (!qObj) return alert("⚠️ Không nhận diện được cấu trúc câu hỏi!");

    const targetQ = qbankMidEditState.questions[qIdx];
    if (targetQ) {
        targetQ.type = qObj.type; targetQ.question = qObj.question;
        if (qObj.options) targetQ.options = qObj.options;
        if (qObj.statements) targetQ.statements = qObj.statements;
        if (qObj.correct !== undefined) targetQ.correct = qObj.correct;
        if (qObj.correctAnswer !== undefined) targetQ.correctAnswer = qObj.correctAnswer;
        if (qObj.explanation !== undefined) targetQ.explanation = qObj.explanation;
        if (qObj.part) targetQ.part = qObj.part; else if (targetQ.type !== "short_answer" || !qObj.part) delete targetQ.part;
        if (qObj.imageUrl) targetQ.imageUrl = qObj.imageUrl;
        if (qObj.imageKey) targetQ.imageKey = qObj.imageKey;
    }

    qbankMidEditState.questions = qbEditReorganizeQuestions(qbankMidEditState.questions);
    qbankMidEditState.rawEditingCardIds.delete(String(qId));
    qbankMidEditState.isDirty = true;
    qbEditRenderBothSides();
    setTimeout(() => { qbEditAutoResizeAllTextareas(); qbEditScrollToLeftPreview(qId, true); }, 40);
    showQbankToast("✅ Đã nhận diện và áp dụng câu hỏi thành công!", "success");
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

function qbEditHandleRawInput(text) {
    qbankMidEditState.isDirty = true;
    if (qbankMidEditState.debounceTimer) clearTimeout(qbankMidEditState.debounceTimer);
    qbankMidEditState.debounceTimer = setTimeout(() => {
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
            } else if (Array.isArray(parsed)) {
                qbankMidEditState.questions = qbEditReorganizeQuestions(parsed);
                qbEditSetValidationStatus(true, "✅ Cú pháp mảng câu hỏi hợp lệ!");
                qbEditRenderLeftLivePreview();
            } else {
                qbEditSetValidationStatus(false, "⚠️ Cần có biến examData chứa trường questions!");
            }
        } catch (e) { qbEditSetValidationStatus(false, "❌ Lỗi cú pháp: " + e.message); }
    }, 350);
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
    const editedQuestions = qbankMidEditState.questions || [];
    const errors = qbEditValidateSyntax(editedQuestions);
    if (errors.length > 0 && !confirm(`⚠️ Có ${errors.length} cảnh báo cú pháp (VD: ${errors[0]}).\nTiếp tục lưu?`)) return;

    const btn = document.getElementById("btn-qb-edit-save");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang lưu..."; }

    try {
        pushQbankUndoState("Cập nhật từ trình Sửa đề");
        const mergedImages = { ...(qbankState.imagesMap || {}), ...(qbankMidEditState.images || {}) };
        const usedOutsideIds = new Set();
        (qbankState.rawQuestions || []).forEach(q => { if (q && !qbankMidEditState.editingSourceIds.has(String(q.id))) usedOutsideIds.add(String(q.id)); });

        const normalizedEdited = editedQuestions.map((rawQ, idx) => {
            const q = JSON.parse(JSON.stringify(rawQ));
            if (!q.id || usedOutsideIds.has(String(q.id))) q.id = qbEditGenerateNewUniqueId();
            if (!q.origIndex) q.origIndex = idx + 1;
            normalizeQuestionAnswerOnTransfer(q);
            const resolvedImg = resolveQbankImageUrl(q, mergedImages);
            if (resolvedImg) { const key = q.imageKey || `img_q_${q.id}`; q.imageUrl = resolvedImg; q.imageKey = key; mergedImages[key] = resolvedImg; }
            else q.imageUrl = "";
            return q;
        });

        const untouchedQuestions = (qbankState.rawQuestions || []).filter(q => q && !qbankMidEditState.editingSourceIds.has(String(q.id)));
        qbankState.rawQuestions = [...untouchedQuestions, ...normalizedEdited];
        qbankState.imagesMap = mergedImages;
        if (!qbankState.activeFilter.folderId && qbankMidEditState.title && qbankMidEditState.title.trim()) qbankState.currentExamTitle = qbankMidEditState.title.trim();

        qbankMidEditState.questions = JSON.parse(JSON.stringify(normalizedEdited));
        qbankMidEditState.images = JSON.parse(JSON.stringify(mergedImages));
        qbankMidEditState.editingSourceIds = new Set(normalizedEdited.map(q => String(q.id)));
        qbankMidEditState.isDirty = false;

        recomputeAllMatrixIds();
        await saveQbankDraftState(false);

        renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankBuilderStats(); updateQbankDeleteSelectedButtonUI(); refreshQbankExportPopoverIfOpen();

        if (keepOpen) {
            const freshMap = new Map((qbankState.rawQuestions || []).map(q => [String(q.id), q]));
            qbankMidEditState.questions = qbankMidEditState.questions.map(q => freshMap.get(String(q.id)) || q);
            qbEditRenderBothSides();
            showQbankToast(`⚡ Đã cập nhật ${normalizedEdited.length} câu hỏi & đồng bộ Cloud thành công!`, "success");
        } else {
            await closeQbankMidEditMode(true);
            showQbankToast(`⚡ Đã lưu ${normalizedEdited.length} câu hỏi vào Ngân hàng đề!`, "success");
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

// ============================================================================
// 16. CỘT 3: TRÍCH XUẤT ĐỀ THI & NGÂN HÀNG ĐÃ LƯU
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
    const titleInp = document.getElementById("qbank-exam-name"), gradeSel = document.getElementById("qbank-exam-grade");
    const title = titleInp ? titleInp.value.trim() : "", grade = gradeSel ? gradeSel.value : "Lop_11";
    if (!title) { alert("⚠️ Vui lòng nhập Tên đề thi mới!"); if (titleInp) titleInp.focus(); return; }

    const pickedRaw = qbankState.rawQuestions.filter(q => qbankState.selectedQuestionIds.has(String(q.id)));
    if (pickedRaw.length === 0) { updateQbankDeleteSelectedButtonUI(); updateQbankBuilderStats(); return alert("⚠️ Thầy chưa tích chọn câu hỏi nào ở cột giữa!"); }

    pickedRaw.sort((a, b) => getQbankQuestionPart(a) - getQbankQuestionPart(b));
    const examImagesMap = {};
    const selectedQ = pickedRaw.map((q, idx) => {
        const resolved = resolveQbankImageUrl(q, qbankState.imagesMap);
        const normalized = normalizeQuestionForExamOutput(q, idx, examImagesMap);
        if (resolved) { normalized.imageUrl = resolved; normalized.imageKey = `img_q_${normalized.id}`; examImagesMap[normalized.imageKey] = resolved; }
        return normalized;
    });

    const btn = document.getElementById("btn-save-extracted-exam");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang lưu đề..."; }

    const newExam = { id: "exam_bank_" + Date.now(), title, grade, questionCount: selectedQ.length, createdAt: new Date().toISOString(), assignedClasses: [], questions: selectedQ, images: examImagesMap, scoringConfig: { mode: "option1" } };

    try {
        await loadSavedExamsList(false);
        qbankState.savedExams.unshift(newExam);
        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        const client = getQbankSupabaseClient();
        if (client) await client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });

        if (qbankState.storageTarget === "drive" && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "saveQuestionBankData", path: `KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/${grade}`, filename: `${title.replace(/\s/g, "_")}.json`, data: newExam })
            }).catch(() => {});
        }
        alert(`🎉 ĐÃ LƯU ĐỀ "${title}" VÀO NGÂN HÀNG THÀNH CÔNG!`);
        closeQbankCreatorModal(); openSavedExamsModal();
    } catch (err) { alert("❌ Lỗi lưu đề: " + err.message); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "💾 Lưu đề vào Ngân hàng"; } }
}

async function loadSavedExamsList(doRender = true) {
    try { const local = localStorage.getItem("qbank_saved_exams"); if (local) qbankState.savedExams = JSON.parse(local) || []; } catch (e) {}
    const client = getQbankSupabaseClient();
    if (client) {
        try {
            const { data } = await client.from("app_key_values").select("value").eq("key", "qbank_saved_exams").single();
            if (data && Array.isArray(data.value)) { qbankState.savedExams = data.value; localStorage.setItem("qbank_saved_exams", JSON.stringify(data.value)); }
        } catch (e) {}
    }
    if (doRender) { const filterSel = document.getElementById("qbank-filter-grade"); filterSavedExamsList(filterSel ? filterSel.value : "all"); }
}

function filterSavedExamsList(gradeVal) {
    qbankState.savedExamFilter = gradeVal;
    const container = document.getElementById("qbank-saved-list");
    if (!container) return;
    let list = qbankState.savedExams || [];
    if (gradeVal !== "all") list = list.filter(e => e.grade === gradeVal);
    if (list.length === 0) { container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b; font-size:12px;">Chưa có đề thi nào trong phân loại này.</div>`; return; }

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
        modal = document.createElement("div"); modal.id = "modal-qbank-preview"; modal.className = "qbank-modal-overlay";
        modal.innerHTML = `<div class="qbank-modal-container" style="width:820px; height:85vh; max-width:95vw;"><div class="qbank-header"><div style="font-size:14.5px; font-weight:900; display:flex; align-items:center; gap:8px;"><span>👁️</span> <span id="qbank-preview-title">Xem trước đề</span></div><button onclick="document.getElementById('modal-qbank-preview').style.display='none'" style="background:none; border:none; color:#fff; font-size:20px; font-weight:900; cursor:pointer;">✕</button></div><div id="qbank-preview-body" style="flex:1; overflow-y:auto; padding:14px; background:#ffffff;"></div></div>`;
        document.body.appendChild(modal);
    }
    document.getElementById("qbank-preview-title").innerText = `📑 ${exam.title} (${exam.questionCount} câu)`;
    const body = document.getElementById("qbank-preview-body"), letters = ["A", "B", "C", "D"], examImages = exam.images || {};
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
        html += `<div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed #cbd5e1;"><div style="font-size:13px; font-weight:700; color:#0f172a;"><b style="color:#0284c7;">Câu ${idx + 1}:</b> ${q.question || ""} ${redIdBadge}</div>${imgHtml}${optionsHtml}${expHtml}</div>`;
    });
    body.innerHTML = html; modal.style.display = "flex";
    if (window.MathJax && MathJax.typesetPromise) { try { MathJax.typesetPromise([body]).catch(() => {}); } catch (e) {} }
}

function openInSoiDeFromBank(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    if (typeof ensureSoiDeModalInDOM === "function") ensureSoiDeModalInDOM();
    if (typeof soiDeState !== "undefined") {
        soiDeState.examData = { id: exam.id, title: exam.title, maDe: "101", timeLimitMinutes: 90, images: { ...(exam.images || {}) }, questions: JSON.parse(JSON.stringify(exam.questions || [])), scoringConfig: { mode: "option1" } };
        soiDeState.isFromQBank = false;
        if (typeof openSoiDeModal === "function") { closeSavedExamsModal(); openSoiDeModal(); }
    } else alert("⚠️ Không tìm thấy công cụ Soi đề trên trang này!");
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
    const div = document.createElement("div"); div.id = "modal-transfer-exam"; div.className = "qbank-modal-overlay";
    div.innerHTML = `<div class="qbank-modal-container" style="width:480px; height:auto; padding:18px;"><div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:10px;"><h3 style="font-size:14.5px; font-weight:900; color:#0284c7;">🚀 CHUYỂN ĐỀ SANG LỚP</h3><button onclick="document.getElementById('modal-transfer-exam').style.display='none'" style="background:none; border:none; font-size:18px; font-weight:900; cursor:pointer;">✕</button></div><div style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:10px;" id="transfer-exam-title">...</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:14px;" id="transfer-class-list"><label class="cat-checkbox-item"><input type="checkbox" value="lop-11a"> <span>🏫 Lớp 11A</span></label><label class="cat-checkbox-item"><input type="checkbox" value="lop-11c"> <span>🏫 Lớp 11C</span></label><label class="cat-checkbox-item"><input type="checkbox" value="lop-10p"> <span>🏫 Lớp 10P</span></label><label class="cat-checkbox-item"><input type="checkbox" value="lop-11e"> <span>🏫 Lớp 11E</span></label><label class="cat-checkbox-item"><input type="checkbox" value="them-10"> <span>📐 Thêm 10</span></label><label class="cat-checkbox-item"><input type="checkbox" value="them-11" checked> <span>✍️ Thêm 11</span></label><label class="cat-checkbox-item"><input type="checkbox" value="them-12"> <span>🎓 Thêm 12</span></label><label class="cat-checkbox-item"><input type="checkbox" value="hsg-toan-11"> <span>🏆 HSG Toán 11</span></label></div><div style="display:flex; gap:6px;"><button class="btn-qbank" style="flex:1; background:#f1f5f9; color:#475569;" onclick="document.getElementById('modal-transfer-exam').style.display='none'">Hủy</button><button class="btn-qbank btn-qbank-success" style="flex:1.5;" onclick="confirmTransferExamToClasses()">🚀 Xác nhận chuyển</button></div></div>`;
    document.body.appendChild(div);
}

async function confirmTransferExamToClasses() {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.currentExamToTransfer;
    const checked = Array.from(document.querySelectorAll("#transfer-class-list input:checked")).map(c => c.value);
    if (checked.length === 0) return alert("⚠️ Vui lòng chọn ít nhất 1 lớp!");
    const client = getQbankSupabaseClient();
    if (!client) return alert("❌ Chưa kết nối Supabase!");

    try {
        const quizId = "quiz_" + Date.now(), dateStr = new Date().toLocaleString("vi-VN");
        await client.from("quizzes").upsert({ id: quizId, title: exam.title, made: "101", time_limit_minutes: 90, scoring_config: exam.scoringConfig || { mode: "option1" }, questions: exam.questions, images: exam.images || {} });
        await client.from("custom_links").insert(checked.map(cat => ({ id: quizId, category_id: cat, title: exam.title, date: dateStr, url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`, badge_text: "HOT", is_hot: true, timestamp: Date.now() })));

        const classNamesMap = { "lop-11a": "Lớp 11A", "lop-11c": "Lớp 11C", "lop-10p": "Lớp 10P", "lop-11e": "Lớp 11E", "them-10": "Thêm 10", "them-11": "Thêm 11", "them-12": "Thêm 12", "hsg-toan-11": "HSG Toán 11" };
        if (!exam.assignedClasses) exam.assignedClasses = [];
        checked.map(c => classNamesMap[c] || c).forEach(c => { if (!exam.assignedClasses.includes(c)) exam.assignedClasses.push(c); });

        localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams));
        await client.from("app_key_values").upsert({ key: "qbank_saved_exams", value: qbankState.savedExams });

        alert(`🎉 ĐÃ CHUYỂN ĐỀ "${exam.title}" THÀNH CÔNG VÀO ${checked.length} LỚP!`);
        document.getElementById("modal-transfer-exam").style.display = "none";
        filterSavedExamsList(qbankState.savedExamFilter);
    } catch (err) { alert("❌ Lỗi chuyển đề: " + err.message); }
}

function downloadSavedExamJson(examId) {
    if (!requireQbankAdminOrPrompt()) return;
    const exam = qbankState.savedExams.find(e => e.id === examId);
    if (!exam) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exam, null, 2)], { type: "application/json" }));
    a.download = `${exam.title.replace(/\s+/g, "_")}.json`;
    a.click();
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

// ============================================================================
// 17. XUẤT TOÀN BỘ HÀM RA WINDOW SCOPE
// ============================================================================
window.isQbankAdminAuthorized = isQbankAdminAuthorized;
window.requireQbankAdminOrPrompt = requireQbankAdminOrPrompt;
window.showQbankToast = showQbankToast;
window.handleQbankImgError = handleQbankImgError;
window.resolveQbankImageUrl = resolveQbankImageUrl;
window.transferClassExamToQBank = transferClassExamToQBank;
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

window.toggleQbankMidEditMode = toggleQbankMidEditMode;
window.openQbankMidEditMode = openQbankMidEditMode;
window.closeQbankMidEditMode = closeQbankMidEditMode;
window.commitQbankMidEditChanges = commitQbankMidEditChanges;
window.qbEditTriggerUpload = qbEditTriggerUpload;
window.qbEditHandleFileSelected = qbEditHandleFileSelected;
window.qbEditAddNewQuestion = qbEditAddNewQuestion;
window.qbEditDownloadJson = qbEditDownloadJson;
window.qbEditSetMode = qbEditSetMode;
window.qbEditHandleRawInput = qbEditHandleRawInput;
window.qbEditUpdateMeta = qbEditUpdateMeta;
window.qbEditAutoResizeTextarea = qbEditAutoResizeTextarea;
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
window.qbEditDeleteQuestionImage = qbEditDeleteQuestionImage;

window.saveExtractedExamToBank = saveExtractedExamToBank;
window.filterSavedExamsList = filterSavedExamsList;
window.previewSavedExam = previewSavedExam;
window.openInSoiDeFromBank = openInSoiDeFromBank;
window.openTransferExamModal = openTransferExamModal;
window.confirmTransferExamToClasses = confirmTransferExamToClasses;
window.downloadSavedExamJson = downloadSavedExamJson;
window.deleteSavedExam = deleteSavedExam;
window.openSoiDeFromQBank = openSoiDeFromQBank;
