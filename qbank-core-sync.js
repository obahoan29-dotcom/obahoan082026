// =========================================================
// FILE: qbank-core-sync.js
// MODULE 1/4 CỦA HỆ THỐNG NGÂN HÀNG ĐỀ (BẢN NÂNG CẤP CHO 3.000 - 10.000+ CÂU):
// - LƯU MỖI CÂU HỎI = 1 DÒNG TRONG BẢNG RIÊNG qbank_questions (PHÂN TRANG + DIFF SYNC)
// - TỰ ĐỘNG DI TRÚ TỪ DÒNG JSON CŨ (qbank_workspace_draft) SANG qbank_questions
// - CHẶN TRIỆT ĐỂ ẢNH BASE64 LỌT VÀO SUPABASE
// - BỔ SUNG THANH TIẾN TRÌNH LOAD NGANG THÔNG MINH KHỚP TỐC ĐỘ TẢI THỰC TẾ
// =========================================================

const QBANK_PENDING_KHOS = [
    { id: "pending_10",    name: "Kho lớp 10 chờ xếp",     shortName: "Lớp 10", icon: "📐", color: "#0284c7", bg: "#f0f9ff", border: "#7dd3fc" },
    { id: "pending_11",    name: "Kho lớp 11 chờ xếp",     shortName: "Lớp 11", icon: "✍️", color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
    { id: "pending_12",    name: "Kho lớp 12 chờ xếp",     shortName: "Lớp 12", icon: "🎓", color: "#9333ea", bg: "#faf5ff", border: "#d8b4fe" },
    { id: "pending_hsg11", name: "Kho lớp HSG 11 chờ xếp", shortName: "HSG 11", icon: "🏆", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" }
];

let qbankState = {
    storageTarget: "drive",
    savedExamFilter: "all",
    currentExamTitle: "",
    useDedicatedTable: false,
    currentMidPage: 1,
    pageSize: 50,
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
    pendingExams: [],
    pendingNav: { mode: "none", khoId: null, examId: null },
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
    pendingExamId: null,
    pendingKhoId: null,
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
const QBANK_CLOUD_META_KEY = "qbank_workspace_meta";

let _qbankToastTimer = null;
let _qbankResizersInitialized = false;
let _qbankCloudTreeSyncTimer = null;
let _qbankCloudDraftSyncTimer = null;
let _qbankSyncedFingerprints = new Map();

// ============================================================================
// 0. TIỆN ÍCH 4 KHO CHỜ XẾP, LỌC CHẶN BASE64 & BẢO TOÀN DỮ LIỆU CŨ
// ============================================================================
function getPendingKhoMeta(khoId) {
    return QBANK_PENDING_KHOS.find(k => k.id === khoId) || QBANK_PENDING_KHOS[1];
}

function guessPendingKhoId(categoryId = "", title = "") {
    const cat = String(categoryId || "").toLowerCase().trim();
    const txt = String(title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (cat.includes("hsg") || txt.includes("hsg")) return "pending_hsg11";
    if (cat.includes("10") || /\b(toan\s*10|lop\s*10|them\s*10|10p)\b/.test(txt)) return "pending_10";
    if (cat.includes("12") || /\b(toan\s*12|lop\s*12|them\s*12)\b/.test(txt)) return "pending_12";
    return "pending_11";
}

function isBase64DataUrl(val) {
    return typeof val === "string" && /^\s*data:/i.test(val);
}

function sanitizeImagesMapNoBase64(map) {
    const clean = {};
    let removedCount = 0;
    if (map && typeof map === "object") {
        for (const k in map) {
            const v = map[k];
            if (!v || typeof v !== "string") continue;
            if (isBase64DataUrl(v)) {
                removedCount++;
                continue;
            }
            clean[k] = v.trim();
        }
    }
    return { clean, removedCount };
}

function stripBase64FromQuestions(questions) {
    let removedCount = 0;
    (questions || []).forEach(q => {
        if (!q) return;
        if (q.imageUrl && isBase64DataUrl(q.imageUrl)) {
            q.imageUrl = "";
            removedCount++;
        }
    });
    return removedCount;
}

function ensureQbankPendingExamsIntegrity() {
    if (!Array.isArray(qbankState.pendingExams)) qbankState.pendingExams = [];
    const validKhoIds = new Set(QBANK_PENDING_KHOS.map(k => k.id));

    const examMap = new Map();
    const cleanedExams = [];
    qbankState.pendingExams.forEach((ex, idx) => {
        if (!ex || typeof ex !== "object") return;
        const id = String(ex.id || `pexam_legacy_${idx}_${Date.now()}`);
        if (examMap.has(id)) return;
        const khoId = validKhoIds.has(ex.khoId) ? ex.khoId : guessPendingKhoId(ex.sourceCategoryId, ex.title);
        const normalized = {
            id,
            title: String(ex.title || "Đề chưa đặt tên").trim() || "Đề chưa đặt tên",
            khoId,
            createdAt: Number(ex.createdAt) || (Date.now() - idx * 1000),
            sourceQuizId: ex.sourceQuizId || "",
            sourceCategoryId: ex.sourceCategoryId || ""
        };
        examMap.set(id, normalized);
        cleanedExams.push(normalized);
    });
    qbankState.pendingExams = cleanedExams;

    const legacyGroups = new Map();
    (qbankState.rawQuestions || []).forEach(q => {
        if (!q) return;
        if (q.pendingExamId && examMap.has(String(q.pendingExamId))) {
            const ex = examMap.get(String(q.pendingExamId));
            q.pendingExamId = ex.id;
            q.pendingKhoId = ex.khoId;
            return;
        }
        if (!q.folderId) {
            const title = String(q.sourceExam || qbankState.currentExamTitle || "Đề chờ xếp (Dữ liệu cũ)").trim() || "Đề chờ xếp (Dữ liệu cũ)";
            const khoId = validKhoIds.has(q.pendingKhoId) ? q.pendingKhoId : guessPendingKhoId(q.sourceCategoryId, title);
            const gKey = `${khoId}::${title.toLowerCase()}`;
            let targetExam = legacyGroups.get(gKey);
            if (!targetExam) {
                targetExam = qbankState.pendingExams.find(ex => ex.khoId === khoId && ex.title.toLowerCase() === title.toLowerCase());
                if (!targetExam) {
                    targetExam = {
                        id: `pexam_mig_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                        title,
                        khoId,
                        createdAt: Date.now(),
                        sourceQuizId: q.sourceQuizId || "",
                        sourceCategoryId: q.sourceCategoryId || ""
                    };
                    qbankState.pendingExams.unshift(targetExam);
                    examMap.set(targetExam.id, targetExam);
                }
                legacyGroups.set(gKey, targetExam);
            }
            q.pendingExamId = targetExam.id;
            q.pendingKhoId = targetExam.khoId;
            q.sourceExam = targetExam.title;
        }
    });

    if (!qbankState.pendingNav || typeof qbankState.pendingNav !== "object") {
        qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    }
    if (qbankState.pendingNav.mode === "kho" && !validKhoIds.has(qbankState.pendingNav.khoId)) {
        qbankState.pendingNav = { mode: "root", khoId: null, examId: null };
    } else if (qbankState.pendingNav.mode === "exam") {
        const foundEx = examMap.get(String(qbankState.pendingNav.examId || ""));
        if (!foundEx) {
            if (validKhoIds.has(qbankState.pendingNav.khoId)) {
                qbankState.pendingNav = { mode: "kho", khoId: qbankState.pendingNav.khoId, examId: null };
            } else {
                qbankState.pendingNav = { mode: "root", khoId: null, examId: null };
            }
        } else {
            qbankState.pendingNav.khoId = foundEx.khoId;
        }
    }
}

// ============================================================================
// 1. KIỂM TRA QUYỀN ADMIN
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
// 2. TOAST & TIỆN ÍCH XỬ LÝ CHUỖI / ẢNH
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
    if (isBase64DataUrl(clean)) return "";
    if (typeof toDirectGoogleDriveImageUrl === "function") return toDirectGoogleDriveImageUrl(clean);
    return clean;
}

function resolveQbankImageUrl(q, imageMap) {
    if (!q) return "";
    const map = (imageMap && typeof imageMap === "object") ? imageMap : {};
    if (q.imageUrl && String(q.imageUrl).trim() !== "" && !isBase64DataUrl(q.imageUrl)) return normalizeDriveImageLinkIfNeeded(q.imageUrl);
    if (q.imageKey && map[q.imageKey] && String(map[q.imageKey]).trim() !== "" && !isBase64DataUrl(map[q.imageKey])) return normalizeDriveImageLinkIfNeeded(map[q.imageKey]);

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
            if (map[k] && String(map[k]).trim() !== "" && !isBase64DataUrl(map[k])) return normalizeDriveImageLinkIfNeeded(map[k]);
        }
    }

    if (q.imageKey) {
        const lowerKey = String(q.imageKey).toLowerCase();
        for (const mKey in map) {
            if (mKey.toLowerCase() === lowerKey && map[mKey] && String(map[mKey]).trim() !== "" && !isBase64DataUrl(map[mKey])) {
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

// ============================================================================
// 3. ĐÁNH SỐ ID TỰ ĐỘNG LIÊN TỤC TRONG CÙNG 1 LỚP
// ============================================================================
function normalizeQbankLevel(level) {
    const raw = String(level || "nb").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (raw === "th" || raw.includes("thong hieu")) return "th";
    if (raw === "vdc" || raw.includes("van dung cao")) return "vdc";
    if (raw === "vdt" || raw === "vd" || raw.includes("van dung")) return "vdt";
    return "nb";
}

function getQbankQuestionPart(q) {
    if (!q) return 1;
    const explicitPart = parseInt(q.part, 10);
    if (explicitPart >= 1 && explicitPart <= 4) return explicitPart;
    if (q.isPart4 === true || q.type === "essay" || q.type === "essay_answer" || q.type === "part4") return 4;
    if (q.type === "multiple_choice") return 1;
    if (q.type === "true_false") return 2;
    if (q.isPart4 !== false) {
        const txt = String(q.question || "").toUpperCase();
        if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) return 4;
    }
    if (q.type === "short_answer") return 3;
    return 1;
}

if (typeof window !== "undefined") {
    window.isPart4Question = function(q) {
        if (!q) return false;
        const explicitPart = parseInt(q.part, 10);
        if (explicitPart >= 1 && explicitPart <= 4) return explicitPart === 4;
        if (q.isPart4 === true) return true;
        if (q.isPart4 === false) return false;
        if (q.type === "essay" || q.type === "essay_answer" || q.type === "part4") return true;
        if (q.type === "multiple_choice" || q.type === "true_false") return false;
        const txt = String(q.question || "").toUpperCase();
        if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) return true;
        return false;
    };
}

function getQbankLevelLabel(level) {
    const map = { nb: "Nhận biết", th: "Thông hiểu", vdt: "Vận dụng", vdc: "Vận dụng cao" };
    return map[normalizeQbankLevel(level)] || "Nhận biết";
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

function findNodeInTree(nodes, id) {
    for (let n of (nodes || [])) {
        if (n.id === id) return n;
        if (n.children && n.children.length > 0) {
            const f = findNodeInTree(n.children, id);
            if (f) return f;
        }
    }
    return null;
}

function findParentNodeInTree(nodes, childId) {
    for (let n of (nodes || [])) {
        if (n.children && n.children.some(c => c.id === childId)) return n;
        if (n.children && n.children.length > 0) {
            const f = findParentNodeInTree(n.children, childId);
            if (f) return f;
        }
    }
    return null;
}

function getAllDescendantFolderIds(node) {
    if (!node) return [];
    let ids = [node.id];
    if (node.children && node.children.length > 0) {
        node.children.forEach(c => { ids = ids.concat(getAllDescendantFolderIds(c)); });
    }
    return ids;
}

function getFolderPathNodes(targetId) {
    if (!targetId) return [];
    let foundPath = [];
    function traverse(nodes, currentPath) {
        for (let n of (nodes || [])) {
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
        q.level = normalizeQbankLevel(q.level);
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

        const lvlA = levelOrder[normalizeQbankLevel(a.level)] || 1;
        const lvlB = levelOrder[normalizeQbankLevel(b.level)] || 1;
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
        const levelKey = normalizeQbankLevel(q.level);
        q.level = levelKey;
        const levelLabel = getQbankLevelLabel(levelKey);

        classCounters[rootClassId] = (classCounters[rootClassId] || 0) + 1;
        const seqNum = classCounters[rootClassId];

        q.matrixSeq = seqNum;
        q.matrixPathSlug = pathSlug;
        q.matrixId = `ID.${pathSlug}-P${part}-${levelLabel}-C${seqNum}`;
    });
}

// ============================================================================
// 4. BỘ MÁY UNDO (CTRL + Z)
// ============================================================================
function pushQbankUndoState(actionLabel = "Thao tác") {
    try {
        const snapshot = {
            label: actionLabel,
            rawQuestions: JSON.parse(JSON.stringify(qbankState.rawQuestions || [])),
            pendingExams: JSON.parse(JSON.stringify(qbankState.pendingExams || [])),
            pendingNav: JSON.parse(JSON.stringify(qbankState.pendingNav || { mode: "none", khoId: null, examId: null })),
            imagesMap: JSON.parse(JSON.stringify(qbankState.imagesMap || {})),
            currentTree: JSON.parse(JSON.stringify(qbankState.currentTree || [])),
            currentExamTitle: qbankState.currentExamTitle || "",
            selectedQuestionIds: Array.from(qbankState.selectedQuestionIds || []),
            assignMode: !!qbankState.assignMode,
            hideAssigned: !!qbankState.hideAssigned,
            currentMidPage: qbankState.currentMidPage || 1,
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
    qbankState.pendingExams = Array.isArray(prev.pendingExams) ? prev.pendingExams : [];
    qbankState.pendingNav = prev.pendingNav || { mode: "none", khoId: null, examId: null };
    if (prev.imagesMap) qbankState.imagesMap = prev.imagesMap;
    qbankState.currentTree = prev.currentTree || qbankState.currentTree;
    qbankState.currentExamTitle = prev.currentExamTitle || "";
    qbankState.selectedQuestionIds = new Set(prev.selectedQuestionIds || []);
    qbankState.assignMode = prev.assignMode !== undefined ? !!prev.assignMode : true;
    qbankState.hideAssigned = !!prev.hideAssigned;
    qbankState.currentMidPage = prev.currentMidPage || 1;
    qbankState.activeFilter = prev.activeFilter || { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = qbankState.activeFilter.folderId || null;
    qbankState.activeFolderObj = qbankState.activeFolderId ? findNodeInTree(qbankState.currentTree, qbankState.activeFolderId) : null;

    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();
    saveQbankTreeData();
    saveQbankDraftState(false);

    if (typeof syncAssignModeButtonsUI === "function") syncAssignModeButtonsUI();
    updateQbankUndoButtonUI();
    if (typeof updateQbankDeleteSelectedButtonUI === "function") updateQbankDeleteSelectedButtonUI();
    if (typeof updateQbankUploadMenuCounts === "function") updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle();
    if (typeof renderQbankTree === "function") renderQbankTree();
    if (typeof renderQbankQuestions === "function") renderQbankQuestions();
    if (typeof updateQbankMatrixStats === "function") updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    if (typeof refreshQbankExamPreviewModalIfOpen === "function") refreshQbankExamPreviewModalIfOpen();
    showQbankToast(`↩️ Đã lùi lại: ${prev.label}`, "warning");
}

document.addEventListener("keydown", function(e) {
    const modal = document.getElementById("modal-qbank-creator");
    if (!modal || modal.style.display !== "flex") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && qbankMidEditState.isActive) {
        e.preventDefault();
        if (typeof commitQbankMidEditChanges === "function") commitQbankMidEditChanges(true);
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
// 5. ĐỒNG BỘ 2 CHIỀU CLOUD TỐI ƯU BẢNG RIÊNG qbank_questions (3.000 - 10.000+ CÂU)
// ============================================================================
function serializeQbankQuestionRow(q) {
    const part = getQbankQuestionPart(q);
    const level = normalizeQbankLevel(q.level);
    const qCopy = JSON.parse(JSON.stringify(q));
    if (qCopy.imageUrl && isBase64DataUrl(qCopy.imageUrl)) {
        qCopy.imageUrl = "";
    }
    qCopy.part = part;
    qCopy.isPart4 = (part === 4);
    qCopy.level = level;

    return {
        id: String(q.id),
        folder_id: q.folderId ? String(q.folderId) : null,
        folder_name: q.folderName ? String(q.folderName) : "",
        root_class_id: q.rootClassId ? String(q.rootClassId) : "",
        pending_exam_id: q.pendingExamId ? String(q.pendingExamId) : null,
        pending_kho_id: q.pendingKhoId ? String(q.pendingKhoId) : null,
        source_exam: q.sourceExam ? String(q.sourceExam) : "",
        source_quiz_id: q.sourceQuizId ? String(q.sourceQuizId) : "",
        source_category_id: q.sourceCategoryId ? String(q.sourceCategoryId) : "",
        part: part,
        level: level,
        matrix_id: q.matrixId ? String(q.matrixId) : "",
        matrix_seq: Number(q.matrixSeq) || 0,
        matrix_path_slug: q.matrixPathSlug ? String(q.matrixPathSlug) : "",
        orig_index: Number(q.origIndex) || 0,
        assigned_at: q.assignedAt ? Number(q.assignedAt) : null,
        question_data: qCopy,
        updated_at: new Date().toISOString()
    };
}

function deserializeQbankQuestionRow(row) {
    if (!row) return null;
    const base = (row.question_data && typeof row.question_data === "object") ? { ...row.question_data } : {};
    base.id = String(row.id || base.id);
    base.folderId = row.folder_id || null;
    base.folderName = row.folder_name || "";
    base.rootClassId = row.root_class_id || "";
    base.pendingExamId = row.pending_exam_id || "";
    base.pendingKhoId = row.pending_kho_id || "";
    base.sourceExam = row.source_exam || base.sourceExam || "";
    base.sourceQuizId = row.source_quiz_id || base.sourceQuizId || "";
    base.sourceCategoryId = row.source_category_id || base.sourceCategoryId || "";
    base.part = Number(row.part) || getQbankQuestionPart(base);
    base.isPart4 = (base.part === 4);
    base.level = normalizeQbankLevel(row.level || base.level || "nb");
    base.matrixId = row.matrix_id || "";
    base.matrixSeq = Number(row.matrix_seq) || 0;
    base.matrixPathSlug = row.matrix_path_slug || "";
    base.origIndex = Number(row.orig_index) || Number(base.origIndex) || 0;
    if (row.assigned_at) base.assignedAt = Number(row.assigned_at);
    else delete base.assignedAt;

    if (base.imageUrl && isBase64DataUrl(base.imageUrl)) {
        base.imageUrl = "";
    }
    return base;
}

function computeQbankRowFingerprint(row) {
    if (!row) return "";
    const { updated_at, ...rest } = row;
    return JSON.stringify(rest);
}

function rebuildSyncedFingerprintsFromState() {
    const map = new Map();
    (qbankState.rawQuestions || []).forEach(q => {
        if (!q || !q.id) return;
        const row = serializeQbankQuestionRow(q);
        map.set(row.id, computeQbankRowFingerprint(row));
    });
    _qbankSyncedFingerprints = map;
}

async function fetchAllQbankQuestionsFromTable(client, onProgress = null) {
    const allRows = [];
    let from = 0;
    const pageSize = 1000;
    let totalCount = 0;
    let chunkIdx = 0;

    while (true) {
        const query = client
            .from("qbank_questions")
            .select("*", from === 0 ? { count: "exact" } : undefined)
            .order("orig_index", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);

        const { data, error, count } = await query;
        if (error) return { ok: false, error, rows: [] };

        if (from === 0 && typeof count === "number" && count >= 0) {
            totalCount = count;
        }

        if (!data || data.length === 0) break;
        allRows.push(...data);
        chunkIdx++;

        if (typeof onProgress === "function") {
            const pct = totalCount > 0
                ? Math.min(88, 32 + Math.round((allRows.length / totalCount) * 56))
                : Math.min(86, 38 + chunkIdx * 16);
            const totalLabel = totalCount > 0 ? totalCount.toLocaleString("vi-VN") : `${allRows.length.toLocaleString("vi-VN")}+`;
            onProgress(pct, `Đang tải từ Supabase: ${allRows.length.toLocaleString("vi-VN")} / ${totalLabel} câu hỏi...`);
        }

        if (data.length < pageSize) break;
        from += pageSize;
    }
    return { ok: true, error: null, rows: allRows };
}

async function syncQbankTreeToCloud() {
    const client = getQbankSupabaseClient();
    if (!client) return false;
    try {
        const ts = qbankState.treeUpdatedAt || Date.now();
        qbankState.treeUpdatedAt = ts;
        const { error } = await client.from("app_key_values").upsert({
            key: QBANK_CLOUD_TREE_KEY,
            value: { tree: qbankState.currentTree, updatedAt: ts }
        }, { onConflict: "key" });
        return !error;
    } catch (e) { return false; }
}

async function syncQbankDraftToCloud() {
    const client = getQbankSupabaseClient();
    if (!client) return false;
    try {
        const ts = qbankState.draftUpdatedAt || Date.now();
        qbankState.draftUpdatedAt = ts;

        const { clean: cleanImagesMap } = sanitizeImagesMapNoBase64(qbankState.imagesMap || {});
        qbankState.imagesMap = cleanImagesMap;
        stripBase64FromQuestions(qbankState.rawQuestions || []);

        // 1. NẾU BẢNG RIÊNG qbank_questions SẴN SÀNG -> CHỈ GỬI DIFF (TỪNG DÒNG THAY ĐỔI)
        if (qbankState.useDedicatedTable) {
            const currentIdSet = new Set();
            const upsertMap = new Map();
            const nextFingerprints = new Map();

            (qbankState.rawQuestions || []).forEach(q => {
                if (!q || !q.id) return;
                const row = serializeQbankQuestionRow(q);
                const fp = computeQbankRowFingerprint(row);
                currentIdSet.add(row.id);
                nextFingerprints.set(row.id, fp);

                if (_qbankSyncedFingerprints.get(row.id) !== fp) {
                    upsertMap.set(row.id, row);
                }
            });

            const toUpsert = Array.from(upsertMap.values());
            const toDeleteIds = [];
            _qbankSyncedFingerprints.forEach((_, oldId) => {
                if (!currentIdSet.has(oldId)) toDeleteIds.push(oldId);
            });

            for (let i = 0; i < toUpsert.length; i += 200) {
                const chunk = toUpsert.slice(i, i + 200);
                const { error: upErr } = await client.from("qbank_questions").upsert(chunk, { onConflict: "id" });
                if (upErr) throw upErr;
            }

            for (let i = 0; i < toDeleteIds.length; i += 200) {
                const chunk = toDeleteIds.slice(i, i + 200);
                const { error: delErr } = await client.from("qbank_questions").delete().in("id", chunk);
                if (delErr) throw delErr;
            }

            _qbankSyncedFingerprints = nextFingerprints;

            // Lưu phần metadata gọn nhẹ vào app_key_values
            const { error: metaErr } = await client.from("app_key_values").upsert({
                key: QBANK_CLOUD_META_KEY,
                value: {
                    pendingExams: qbankState.pendingExams || [],
                    images: cleanImagesMap,
                    currentExamTitle: qbankState.currentExamTitle || "",
                    updatedAt: ts,
                    questionCount: currentIdSet.size
                }
            }, { onConflict: "key" });
            return !metaErr;
        }

        // 2. CHẾ ĐỘ TƯƠNG THÍCH CŨ (KHI CHƯA CHẠY SQL TẠO BẢNG qbank_questions)
        const { error } = await client.from("app_key_values").upsert({
            key: QBANK_CLOUD_DRAFT_KEY,
            value: {
                questions: qbankState.rawQuestions || [],
                pendingExams: qbankState.pendingExams || [],
                images: cleanImagesMap,
                currentExamTitle: qbankState.currentExamTitle || "",
                updatedAt: ts
            }
        }, { onConflict: "key" });
        return !error;
    } catch (e) {
        console.warn("Lỗi syncQbankDraftToCloud:", e);
        return false;
    }
}

function scheduleQbankTreeCloudSync() {
    if (_qbankCloudTreeSyncTimer) clearTimeout(_qbankCloudTreeSyncTimer);
    _qbankCloudTreeSyncTimer = setTimeout(() => { syncQbankTreeToCloud(); }, 350);
}

function scheduleQbankDraftCloudSync() {
    if (_qbankCloudDraftSyncTimer) clearTimeout(_qbankCloudDraftSyncTimer);
    _qbankCloudDraftSyncTimer = setTimeout(() => { syncQbankDraftToCloud(); }, 400);
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
        localStorage.setItem("qbank_draft_pending_exams", JSON.stringify(qbankState.pendingExams || []));
        localStorage.setItem("qbank_draft_images", JSON.stringify(qbankState.imagesMap || {}));
        localStorage.setItem("qbank_draft_exam_title", qbankState.currentExamTitle || "");
        localStorage.setItem("qbank_draft_updated_at", String(ts));
        savedLocal = true;
    } catch (e) {
        try {
            localStorage.removeItem("qbank_draft_questions");
            localStorage.removeItem("qbank_draft_images");
            localStorage.removeItem("qbank_draft_pending_exams");
            localStorage.setItem("qbank_draft_updated_at", String(ts));
        } catch (e2) {}
    }
    if (typeof examIndexedDB !== "undefined") {
        try {
            savedIDB = await examIndexedDB.setItem("exam_states", {
                key: "qbank_draft_state_v1",
                questions: qbankState.rawQuestions || [],
                pendingExams: qbankState.pendingExams || [],
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
    ensureQbankPendingExamsIntegrity();
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
        const tableBadge = qbankState.useDedicatedTable ? " [Bảng riêng qbank_questions]" : "";
        if (syncedCloud) {
            showQbankToast(`✅ Đã lưu & đồng bộ đám mây${tableBadge}! (Ngân hàng: ${assignedCount} • Chờ xếp: ${unassignedCount})`, "success");
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
                        pendingExams: qbankState.pendingExams,
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

async function loadQbankDraftState(onProgress = null) {
    const report = (pct, text) => {
        if (typeof onProgress === "function") onProgress(pct, text);
    };

    report(8, "Đang đọc bộ nhớ đệm & IndexedDB trên máy...");
    let hasLocalTree = loadQbankTreeData();
    let localQuestions = [];
    let localPendingExams = [];
    let localImages = {};
    let localTitle = "";
    const lsRawQ = localStorage.getItem("qbank_draft_questions");
    const lsDraftTs = parseInt(localStorage.getItem("qbank_draft_updated_at") || "0", 10) || 0;
    let localDraftTs = lsDraftTs;
    let hasLoadedDraftFromIDB = false;

    if (typeof examIndexedDB !== "undefined") {
        try {
            const data = await examIndexedDB.getItem("exam_states", "qbank_draft_state_v1");
            if (data && Array.isArray(data.questions)) {
                const idbTs = Number(data.updatedAt) || 0;
                if (!lsRawQ || idbTs >= lsDraftTs) {
                    hasLoadedDraftFromIDB = true;
                    localQuestions = data.questions;
                    if (Array.isArray(data.pendingExams)) localPendingExams = data.pendingExams;
                    localImages = data.images || {};
                    if (data.currentExamTitle) localTitle = data.currentExamTitle;
                    if (idbTs > localDraftTs) localDraftTs = idbTs;
                }
                if (!hasLocalTree && Array.isArray(data.currentTree) && data.currentTree.length > 0) {
                    qbankState.currentTree = data.currentTree;
                    hasLocalTree = true;
                }
            }
        } catch (e) {}
    }

    if (!hasLoadedDraftFromIDB) {
        try {
            const pe = localStorage.getItem("qbank_draft_pending_exams");
            const img = localStorage.getItem("qbank_draft_images");
            const title = localStorage.getItem("qbank_draft_exam_title");
            if (lsRawQ) { const pq = JSON.parse(lsRawQ); if (Array.isArray(pq)) localQuestions = pq; }
            if (pe) { const ppe = JSON.parse(pe); if (Array.isArray(ppe)) localPendingExams = ppe; }
            if (img) { const pi = JSON.parse(img); if (pi && typeof pi === "object") localImages = pi; }
            if (title) localTitle = title;
        } catch (e) {}
    } else if (localPendingExams.length === 0) {
        try {
            const pe = localStorage.getItem("qbank_draft_pending_exams");
            if (pe) { const ppe = JSON.parse(pe); if (Array.isArray(ppe)) localPendingExams = ppe; }
        } catch (e) {}
    }

    if ((localQuestions.length > 0 || localPendingExams.length > 0) && localDraftTs === 0) localDraftTs = 1;

    stripBase64FromQuestions(localQuestions);
    localImages = sanitizeImagesMapNoBase64(localImages).clean;

    qbankState.rawQuestions = localQuestions;
    qbankState.pendingExams = localPendingExams;
    qbankState.imagesMap = localImages;
    qbankState.currentExamTitle = localTitle;
    qbankState.draftUpdatedAt = localDraftTs;
    _qbankSyncedFingerprints = new Map();

    report(22, localQuestions.length > 0
        ? `Đã đọc ${localQuestions.length.toLocaleString("vi-VN")} câu cục bộ, đang đồng bộ Cloud...`
        : "Đang kết nối máy chủ Supabase...");

    const client = getQbankSupabaseClient();
    if (client) {
        try {
            const [tableRes, kvRes] = await Promise.all([
                fetchAllQbankQuestionsFromTable(client, onProgress),
                client.from("app_key_values").select("key, value").in("key", [QBANK_CLOUD_TREE_KEY, QBANK_CLOUD_META_KEY, QBANK_CLOUD_DRAFT_KEY])
            ]);

            report(90, "Đang đối chiếu & hợp nhất cây thư mục...");

            const rows = (kvRes && Array.isArray(kvRes.data)) ? kvRes.data : [];
            const treeRow = rows.find(r => r.key === QBANK_CLOUD_TREE_KEY);
            const metaRow = rows.find(r => r.key === QBANK_CLOUD_META_KEY);
            const draftRow = rows.find(r => r.key === QBANK_CLOUD_DRAFT_KEY);

            // 1. ĐỒNG BỘ CÂY THƯ MỤC
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

            // 2. ĐỒNG BỘ CÂU HỎI TỪ BẢNG RIÊNG qbank_questions
            if (tableRes && tableRes.ok) {
                qbankState.useDedicatedTable = true;
                const metaVal = (metaRow && metaRow.value) ? metaRow.value : {};
                const legacyDraft = (draftRow && draftRow.value) ? draftRow.value : null;
                const cloudMetaTs = Number(metaVal.updatedAt) || 0;

                if (tableRes.rows.length > 0) {
                    const cloudQuestions = tableRes.rows.map(deserializeQbankQuestionRow).filter(Boolean);
                    const cloudImages = sanitizeImagesMapNoBase64(metaVal.images || {}).clean;
                    cloudQuestions.forEach(q => {
                        if (q.imageUrl && !isBase64DataUrl(q.imageUrl)) {
                            const k = q.imageKey || `img_q_${q.id}`;
                            if (!cloudImages[k]) cloudImages[k] = q.imageUrl;
                        }
                    });

                    const localTsNow = qbankState.draftUpdatedAt || 0;
                    const shouldTakeCloud = (localTsNow === 0) || (cloudMetaTs >= localTsNow);

                    if (shouldTakeCloud) {
                        qbankState.rawQuestions = cloudQuestions;
                        qbankState.pendingExams = Array.isArray(metaVal.pendingExams) ? metaVal.pendingExams : [];
                        qbankState.imagesMap = cloudImages;
                        qbankState.currentExamTitle = metaVal.currentExamTitle || "";
                        qbankState.draftUpdatedAt = cloudMetaTs || Date.now();
                        rebuildSyncedFingerprintsFromState();
                        await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                    } else {
                        const tmpMap = new Map();
                        tableRes.rows.forEach(r => tmpMap.set(String(r.id), computeQbankRowFingerprint(r)));
                        _qbankSyncedFingerprints = tmpMap;
                        await syncQbankDraftToCloud();
                    }
                } else {
                    const legacyQuestions = (legacyDraft && Array.isArray(legacyDraft.questions)) ? legacyDraft.questions : [];
                    const legacyTs = Number(legacyDraft && legacyDraft.updatedAt) || 0;

                    if (legacyQuestions.length > 0 && legacyTs >= (qbankState.draftUpdatedAt || 0)) {
                        stripBase64FromQuestions(legacyQuestions);
                        qbankState.rawQuestions = legacyQuestions;
                        qbankState.pendingExams = Array.isArray(legacyDraft.pendingExams) ? legacyDraft.pendingExams : [];
                        qbankState.imagesMap = sanitizeImagesMapNoBase64(legacyDraft.images || {}).clean;
                        qbankState.currentExamTitle = legacyDraft.currentExamTitle || "";
                        qbankState.draftUpdatedAt = legacyTs || Date.now();
                        ensureQbankPendingExamsIntegrity();
                        recomputeAllMatrixIds();
                        await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                        const migrated = await syncQbankDraftToCloud();
                        if (migrated) {
                            client.from("app_key_values").upsert({
                                key: QBANK_CLOUD_DRAFT_KEY,
                                value: { migratedToTable: true, updatedAt: qbankState.draftUpdatedAt }
                            }, { onConflict: "key" }).then(() => {});
                            showQbankToast(`🚀 Đã di trú tự động ${legacyQuestions.length} câu sang bảng riêng qbank_questions!`, "success");
                        }
                    } else if ((qbankState.rawQuestions || []).length > 0 || (qbankState.pendingExams || []).length > 0) {
                        qbankState.draftUpdatedAt = Date.now();
                        await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                        await syncQbankDraftToCloud();
                    }
                }
            } else {
                // 3. FALLBACK TƯƠNG THÍCH CŨ
                qbankState.useDedicatedTable = false;
                const cloudDraft = draftRow ? draftRow.value : null;
                const cloudQuestions = (cloudDraft && Array.isArray(cloudDraft.questions)) ? cloudDraft.questions : null;
                const cloudPendingExams = (cloudDraft && Array.isArray(cloudDraft.pendingExams)) ? cloudDraft.pendingExams : null;
                const cloudDraftTs = (cloudDraft && cloudDraft.updatedAt) ? Number(cloudDraft.updatedAt) || 0 : 0;

                if (cloudQuestions) {
                    const localTsNow = qbankState.draftUpdatedAt || 0;
                    const shouldTakeCloud = (localTsNow === 0 && (cloudQuestions.length > 0 || (cloudPendingExams && cloudPendingExams.length > 0))) || (cloudDraftTs > localTsNow);
                    if (shouldTakeCloud) {
                        stripBase64FromQuestions(cloudQuestions);
                        qbankState.rawQuestions = cloudQuestions;
                        qbankState.pendingExams = Array.isArray(cloudPendingExams) ? cloudPendingExams : [];
                        qbankState.imagesMap = sanitizeImagesMapNoBase64(cloudDraft.images || {}).clean;
                        qbankState.currentExamTitle = cloudDraft.currentExamTitle || "";
                        qbankState.draftUpdatedAt = cloudDraftTs || Date.now();
                        await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                    } else if (localTsNow > cloudDraftTs) {
                        await syncQbankDraftToCloud();
                    }
                } else if (localQuestions.length > 0 || localPendingExams.length > 0) {
                    qbankState.draftUpdatedAt = Date.now();
                    await writeQbankDraftLocalStorages(qbankState.draftUpdatedAt);
                    await syncQbankDraftToCloud();
                }
            }
        } catch (err) {
            console.warn("Không thể đồng bộ Ngân hàng đề từ Supabase:", err);
        }
    }

    report(95, "Đang đánh số ID ma trận & chia trang...");
    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();
}

// ============================================================================
// 5.5. SAO LƯU & KHÔI PHỤC TỪ FILE BACKUP DRIVE / JSON (1 CÚ BẤM)
// ============================================================================
function downloadQbankFullBackupJson(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!requireQbankAdminOrPrompt()) return;

    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();

    const backupObj = {
        format: "obahoan_qbank_workspace_backup_v2",
        exportedAt: new Date().toISOString(),
        updatedAt: qbankState.draftUpdatedAt || Date.now(),
        currentExamTitle: qbankState.currentExamTitle || "",
        currentTree: qbankState.currentTree || [],
        pendingExams: qbankState.pendingExams || [],
        questions: qbankState.rawQuestions || [],
        images: qbankState.imagesMap || {}
    };

    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NganHangCauHoi_Workspace_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showQbankToast(`💾 Đã tải xuống file Backup (${backupObj.questions.length} câu)!`, "success");
}

function openQbankRestoreModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!requireQbankAdminOrPrompt()) return;
    const modal = document.getElementById("modal-qbank-restore");
    const status = document.getElementById("qbank-restore-status");
    const fileIn = document.getElementById("qbank-restore-file-input");
    if (status) { status.style.display = "none"; status.textContent = ""; }
    if (fileIn) fileIn.value = "";
    if (modal) modal.style.display = "flex";
}

function closeQbankRestoreModal() {
    const modal = document.getElementById("modal-qbank-restore");
    if (modal) modal.style.display = "none";
}

function getSelectedQbankRestoreMode() {
    const checked = document.querySelector('input[name="qbank-restore-mode"]:checked');
    return checked ? checked.value : "overwrite";
}

async function applyQbankBackupPayload(parsed, sourceLabel = "Backup") {
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Dữ liệu Backup không hợp lệ!");
    }

    const incomingQuestions = Array.isArray(parsed.questions)
        ? parsed.questions
        : (Array.isArray(parsed) ? parsed : null);

    if (!incomingQuestions) {
        throw new Error("File không chứa mảng questions hợp lệ!");
    }

    const mode = getSelectedQbankRestoreMode();
    pushQbankUndoState(`Khôi phục ${sourceLabel} (${mode === "merge" ? "Gộp thêm" : "Ghi đè"})`);

    const incomingTree = Array.isArray(parsed.currentTree) && parsed.currentTree.length > 0 ? parsed.currentTree : null;
    const incomingPendingExams = Array.isArray(parsed.pendingExams) ? parsed.pendingExams : [];
    const incomingImages = sanitizeImagesMapNoBase64(parsed.images || {}).clean;
    const strippedInQ = stripBase64FromQuestions(incomingQuestions);

    if (mode === "overwrite") {
        if (incomingTree) qbankState.currentTree = incomingTree;
        qbankState.rawQuestions = incomingQuestions;
        qbankState.pendingExams = incomingPendingExams;
        qbankState.imagesMap = incomingImages;
        qbankState.currentExamTitle = parsed.currentExamTitle || "";
        qbankState.selectedQuestionIds.clear();
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null;
        qbankState.activeFolderObj = null;
        qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
        qbankState.currentMidPage = 1;
    } else {
        if (incomingTree && qbankState.currentTree.length === 0) {
            qbankState.currentTree = incomingTree;
        }
        const existingQMap = new Map((qbankState.rawQuestions || []).map(q => [String(q.id), q]));
        incomingQuestions.forEach(iq => {
            if (!iq || !iq.id) return;
            if (!existingQMap.has(String(iq.id))) {
                qbankState.rawQuestions.push(iq);
                existingQMap.set(String(iq.id), iq);
            }
        });

        const existingExamIds = new Set((qbankState.pendingExams || []).map(e => String(e.id)));
        incomingPendingExams.forEach(pe => {
            if (pe && pe.id && !existingExamIds.has(String(pe.id))) {
                qbankState.pendingExams.push(pe);
                existingExamIds.add(String(pe.id));
            }
        });

        qbankState.imagesMap = { ...(qbankState.imagesMap || {}), ...incomingImages };
    }

    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();
    saveQbankTreeData();
    await saveQbankDraftState(true);

    if (typeof syncAssignModeButtonsUI === "function") syncAssignModeButtonsUI();
    updateQbankUndoButtonUI();
    if (typeof updateQbankDeleteSelectedButtonUI === "function") updateQbankDeleteSelectedButtonUI();
    if (typeof updateQbankUploadMenuCounts === "function") updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle();
    if (typeof renderQbankTree === "function") renderQbankTree();
    if (typeof renderQbankQuestions === "function") renderQbankQuestions();
    if (typeof updateQbankMatrixStats === "function") updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();

    closeQbankRestoreModal();
    const extraWarn = strippedInQ > 0 ? ` (Đã tự động lọc bỏ ${strippedInQ} ảnh Base64 quá cỡ)` : "";
    showQbankToast(`🎉 Khôi phục thành công ${qbankState.rawQuestions.length} câu từ ${sourceLabel}!${extraWarn}`, "success");
}

async function restoreQbankFromDriveGAS() {
    const statusEl = document.getElementById("qbank-restore-status");
    const btn = document.getElementById("btn-qbank-restore-drive");
    if (typeof GOOGLE_DRIVE_UPLOAD_GAS_URL === "undefined" || !GOOGLE_DRIVE_UPLOAD_GAS_URL || GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
        alert("⚠️ Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL trong app-config.js!");
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "⏳ Đang tải từ Drive 5TB..."; }
    if (statusEl) {
        statusEl.style.display = "block";
        statusEl.style.color = "#0284c7";
        statusEl.textContent = "⏳ Đang kết nối Google Drive 5TB để đọc NganHangCauHoi_Workspace.json...";
    }

    try {
        const res = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "loadQuestionBankData",
                path: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_ngan_hang_cau_hoi/Workspace_Backup",
                filename: "NganHangCauHoi_Workspace.json"
            })
        });
        const json = await res.json();
        if (!json || json.status !== "success" || !json.data) {
            throw new Error((json && json.message) || "Không tìm thấy file NganHangCauHoi_Workspace.json trên Drive (hoặc chưa deploy bản Code.gs mới).");
        }
        await applyQbankBackupPayload(json.data, "Google Drive 5TB");
    } catch (err) {
        if (statusEl) {
            statusEl.style.display = "block";
            statusEl.style.color = "#dc2626";
            statusEl.textContent = "❌ " + err.message;
        }
        alert("❌ Không tải được từ Drive: " + err.message + "\n\n💡 Thầy có thể chọn file NganHangCauHoi_Workspace.json từ máy tính ở ô bên dưới.");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "☁️ Tải thẳng từ Google Drive 5TB"; }
    }
}

function handleRestoreQbankFileSelected(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusEl = document.getElementById("qbank-restore-status");
    if (statusEl) {
        statusEl.style.display = "block";
        statusEl.style.color = "#0284c7";
        statusEl.textContent = `⏳ Đang đọc tệp ${file.name}...`;
    }
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const parsed = parseUniversalExamText(e.target.result);
            await applyQbankBackupPayload(parsed, `tệp ${file.name}`);
        } catch (err) {
            if (statusEl) {
                statusEl.style.display = "block";
                statusEl.style.color = "#dc2626";
                statusEl.textContent = "❌ " + err.message;
            }
            alert("❌ Lỗi khôi phục file Backup: " + err.message);
        } finally {
            input.value = "";
        }
    };
    reader.readAsText(file);
}

// ============================================================================
// 6. HIỂN THỊ TÊN ĐỀ GỐC, MENU & CO GIÃN 3 CỘT
// ============================================================================
function renderQbankHeaderAndMidExamTitle() {
    const headerBadge = document.getElementById("qbank-header-exam-title");
    const midNameEl = document.getElementById("qbank-mid-exam-name");
    const midCounterEl = document.getElementById("qbank-mid-exam-counter");

    const nav = qbankState.pendingNav || { mode: "none", khoId: null, examId: null };
    const allQ = qbankState.rawQuestions || [];
    const assignedCount = allQ.filter(q => Boolean(q && q.folderId)).length;
    const unassignedCount = allQ.length - assignedCount;

    let displayTitle = (qbankState.currentExamTitle || "").trim();
    if (nav.mode === "exam" && nav.examId) {
        const ex = (qbankState.pendingExams || []).find(e => e.id === nav.examId);
        if (ex) displayTitle = ex.title;
    } else if (nav.mode === "kho" && nav.khoId) {
        const kho = getPendingKhoMeta(nav.khoId);
        const khoExamsCount = (qbankState.pendingExams || []).filter(e => e.khoId === nav.khoId).length;
        displayTitle = `${kho.name} (${khoExamsCount} đề)`;
    } else if (nav.mode === "root") {
        displayTitle = `Kho đề chờ xếp (${(qbankState.pendingExams || []).length} đề trong 4 kho)`;
    }

    if (headerBadge) {
        if (displayTitle) {
            headerBadge.classList.add("has-exam");
            headerBadge.title = `Đang xử lý: ${displayTitle}`;
            headerBadge.innerHTML = `<span>📄</span> <span>Đề đang xử lý: ${escapeQbankHtml(displayTitle)}</span>`;
        } else {
            headerBadge.classList.remove("has-exam");
            headerBadge.title = "Chưa nạp đề gốc";
            headerBadge.innerHTML = `<span>📄</span> <span>Chưa nạp đề gốc</span>`;
        }
    }
    if (midNameEl) {
        midNameEl.textContent = displayTitle || "Chưa nạp đề gốc (Bấm Upload file JSON đề)";
        midNameEl.title = displayTitle || "";
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
        if (!exportPop.contains(e.target) && !(exportTrigger && exportTrigger.contains(e.target))) {
            if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();
        }
    }
});

async function openQbankCreatorModal(options = {}) {
    if (!requireQbankAdminOrPrompt()) return;
    const menu = document.getElementById("qbank-dropdown-menu");
    if (menu) menu.classList.remove("show");
    const modal = document.getElementById("modal-qbank-creator");
    if (!modal) return;

    modal.style.display = "flex";
    if (typeof ensureQbankMidEditControlsInDOM === "function") ensureQbankMidEditControlsInDOM();
    if (typeof ensureQbankUploadDropdownInDOM === "function") ensureQbankUploadDropdownInDOM();
    if (typeof ensureQbankPreviewAndPaginationUI === "function") ensureQbankPreviewAndPaginationUI();
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(true);

    initQbankColumnResizers();

    const loadStartTime = performance.now();
    if (typeof startQbankProgressBar === "function") {
        startQbankProgressBar(
            options && options.skipDraftReload
                ? "Đang chuẩn bị giao diện làm việc..."
                : "Đang khởi tạo & đồng bộ dữ liệu Ngân hàng câu hỏi..."
        );
    }

    try {
        if (!options || !options.skipDraftReload) {
            await loadQbankDraftState((pct, label) => {
                if (typeof updateQbankProgressBar === "function") updateQbankProgressBar(pct, label);
            });
        } else {
            if (typeof updateQbankProgressBar === "function") updateQbankProgressBar(75, "Đang sắp xếp ma trận câu hỏi...");
        }

        if (typeof updateQbankProgressBar === "function") updateQbankProgressBar(96, "Đang dựng cây thư mục & phân trang 50 câu/trang...");

        if (typeof syncAssignModeButtonsUI === "function") syncAssignModeButtonsUI();
        updateQbankUndoButtonUI();
        if (typeof updateQbankDeleteSelectedButtonUI === "function") updateQbankDeleteSelectedButtonUI();
        if (typeof updateQbankUploadMenuCounts === "function") updateQbankUploadMenuCounts();
        renderQbankHeaderAndMidExamTitle();
        if (typeof renderQbankTree === "function") renderQbankTree();
        if (typeof renderQbankQuestions === "function") renderQbankQuestions();
        if (typeof updateQbankMatrixStats === "function") updateQbankMatrixStats();
        if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();

        if (typeof finishQbankProgressBar === "function") {
            const elapsedSec = ((performance.now() - loadStartTime) / 1000).toFixed(2);
            const totalQ = (qbankState.rawQuestions || []).length;
            finishQbankProgressBar(totalQ, elapsedSec);
        }
    } catch (err) {
        if (typeof finishQbankProgressBar === "function") {
            finishQbankProgressBar((qbankState.rawQuestions || []).length, "0.00", true);
        }
    }
}

function closeQbankCreatorModal() {
    if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();
    if (typeof closeQbankDeleteMultiMenu === "function") closeQbankDeleteMultiMenu();
    if (typeof closeQbankUploadMenu === "function") closeQbankUploadMenu();
    if (typeof closeClassTransferKhoPopover === "function") closeClassTransferKhoPopover();
    if (typeof closeQbankExamPreviewModal === "function") closeQbankExamPreviewModal();
    closeQbankRestoreModal();
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
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
        if (typeof loadSavedExamsList === "function") loadSavedExamsList();
    }
}

function closeSavedExamsModal() {
    const modal = document.getElementById("modal-qbank-saved");
    if (modal) modal.style.display = "none";
}

function toggleStorageLocation(selectEl) { qbankState.storageTarget = selectEl.value; }

function openSoiDeFromQBank() {
    if (!requireQbankAdminOrPrompt()) return;
    if (qbankState.rawQuestions.length === 0) return alert("⚠️ Ngân hàng đề đang trống. Vui lòng thêm câu hỏi trước khi Soi đề!");
    if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();
    if (typeof closeQbankUploadMenu === "function") closeQbankUploadMenu();

    let targetQuestions = (typeof getFilteredAndSortedQuestions === "function") ? getFilteredAndSortedQuestions() : qbankState.rawQuestions;
    if (!targetQuestions || targetQuestions.length === 0) targetQuestions = qbankState.rawQuestions;

    if (targetQuestions.length > 200) {
        if (!confirm(`⚠️ Đang có ${targetQuestions.length} câu hỏi trong vùng đang xem.\nMở tất cả cùng lúc trong Soi đề có thể khiến trình duyệt tải công thức toán chậm.\n\nBạn nên lọc riêng 1 thư mục hoặc 1 đề rồi bấm Soi đề, hoặc bấm [OK] để tiếp tục mở ${targetQuestions.length} câu.`)) {
            return;
        }
    }

    if (typeof soiDeState !== "undefined") {
        soiDeState.examData = {
            id: "qbank_preview_" + Date.now(),
            title: qbankState.activeFilter.folderName || qbankState.currentExamTitle || "NGÂN HÀNG CÂU HỎI",
            maDe: "QBANK",
            timeLimitMinutes: 120,
            images: JSON.parse(JSON.stringify(qbankState.imagesMap)),
            questions: JSON.parse(JSON.stringify(targetQuestions)),
            scoringConfig: { mode: "option1" }
        };
        soiDeState.isFromQBank = true;
        if (typeof ensureSoiDeModalInDOM === "function") ensureSoiDeModalInDOM();
        if (typeof openSoiDeModal === "function") openSoiDeModal();
    } else {
        alert("⚠️ Lỗi: Không tìm thấy công cụ Soi Đề!");
    }
}

window.QBANK_PENDING_KHOS = QBANK_PENDING_KHOS;
window.getPendingKhoMeta = getPendingKhoMeta;
window.guessPendingKhoId = guessPendingKhoId;
window.isBase64DataUrl = isBase64DataUrl;
window.sanitizeImagesMapNoBase64 = sanitizeImagesMapNoBase64;
window.stripBase64FromQuestions = stripBase64FromQuestions;
window.ensureQbankPendingExamsIntegrity = ensureQbankPendingExamsIntegrity;
window.isQbankAdminAuthorized = isQbankAdminAuthorized;
window.requireQbankAdminOrPrompt = requireQbankAdminOrPrompt;
window.getQbankSupabaseClient = getQbankSupabaseClient;
window.showQbankToast = showQbankToast;
window.escapeQbankHtml = escapeQbankHtml;
window.escapeQbankAttr = escapeQbankAttr;
window.safeQbankJsArg = safeQbankJsArg;
window.qbFormatQuestionText = qbFormatQuestionText;
window.normalizeDriveImageLinkIfNeeded = normalizeDriveImageLinkIfNeeded;
window.resolveQbankImageUrl = resolveQbankImageUrl;
window.handleQbankImgError = handleQbankImgError;
window.parseUniversalExamText = parseUniversalExamText;
window.normalizeQbankLevel = normalizeQbankLevel;
window.getQbankQuestionPart = getQbankQuestionPart;
window.getQbankLevelLabel = getQbankLevelLabel;
window.formatNodeSlugForId = formatNodeSlugForId;
window.findNodeInTree = findNodeInTree;
window.findParentNodeInTree = findParentNodeInTree;
window.getAllDescendantFolderIds = getAllDescendantFolderIds;
window.getFolderPathNodes = getFolderPathNodes;
window.buildTreeOrderMap = buildTreeOrderMap;
window.recomputeAllMatrixIds = recomputeAllMatrixIds;
window.pushQbankUndoState = pushQbankUndoState;
window.updateQbankUndoButtonUI = updateQbankUndoButtonUI;
window.undoQbankAction = undoQbankAction;
window.saveQbankTreeData = saveQbankTreeData;
window.loadQbankTreeData = loadQbankTreeData;
window.saveQbankDraftState = saveQbankDraftState;
window.manualSaveQbankDraftState = manualSaveQbankDraftState;
window.loadQbankDraftState = loadQbankDraftState;
window.downloadQbankFullBackupJson = downloadQbankFullBackupJson;
window.openQbankRestoreModal = openQbankRestoreModal;
window.closeQbankRestoreModal = closeQbankRestoreModal;
window.restoreQbankFromDriveGAS = restoreQbankFromDriveGAS;
window.handleRestoreQbankFileSelected = handleRestoreQbankFileSelected;
window.renderQbankHeaderAndMidExamTitle = renderQbankHeaderAndMidExamTitle;
window.resetQbankColWidths = resetQbankColWidths;
window.initQbankColumnResizers = initQbankColumnResizers;
window.toggleQbankMenu = toggleQbankMenu;
window.openQbankCreatorModal = openQbankCreatorModal;
window.closeQbankCreatorModal = closeQbankCreatorModal;
window.openSavedExamsModal = openSavedExamsModal;
window.closeSavedExamsModal = closeSavedExamsModal;
window.toggleStorageLocation = toggleStorageLocation;
window.openSoiDeFromQBank = openSoiDeFromQBank;
