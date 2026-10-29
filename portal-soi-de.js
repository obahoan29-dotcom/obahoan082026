// =========================================================
// FILE: portal-soi-de.js (BẢN FIX TỰ XẾP VÀO CUỐI TỪNG PHẦN & BỎ TÍCH CHỌN MẶC ĐỊNH)
// CÔNG CỤ SOI ĐỀ, BIÊN TẬP VÀ XEM TRƯỚC THỜI GIAN THỰC (REALTIME)
// TỰ ĐỘNG PHÂN LOẠI CÂU VÀO CUỐI PHẦN I, II, III, IV & ĐĂNG ĐỀ 8 LỚP
// =========================================================

let soiDeState = {
    examData: {
        title: "ĐỀ THI MỚI",
        maDe: "101",
        timeLimitMinutes: 90,
        images: {},
        questions: []
    },
    rawEditorText: "",
    editorMode: "cards", // 'cards' hoặc 'raw'
    splitRatio: 50,      // % độ rộng nửa trái
    isDraggingSplit: false,
    debounceTimer: null,
    validationErrors: [],
    rawEditingCardIds: new Set() // Lưu danh sách các câu đang bật khung mã thô
};

// DANH SÁCH 8 LỚP CHUẨN ĐỂ ĐĂNG ĐỀ
const SOI_DE_AVAILABLE_CLASSES = [
    { id: "lop-11a", name: "🏫 Lớp 11A" },
    { id: "lop-11c", name: "🏫 Lớp 11C" },
    { id: "lop-10p", name: "🏫 Lớp 10P" },
    { id: "lop-11e", name: "🏫 Lớp 11E" },
    { id: "them-10", name: "📐 Thêm 10" },
    { id: "them-11", name: "✍️ Thêm 11" },
    { id: "them-12", name: "🎓 Thêm 12" },
    { id: "hsg-toan-11", name: "🏆 HSG Toán 11" }
];

// BẢNG MÀU DỊU MẮT LUÂN PHIÊN (PASTEL THEME PALETTES) ĐỒNG BỘ CHO CẢ 2 CỘT
const SOI_DE_THEME_PALETTES = [
    { border: '#38bdf8', bg: '#f0f9ff', badgeBg: 'linear-gradient(135deg, #0284c7, #0369a1)', text: '#0369a1', lightBorder: '#bae6fd' }, // Xanh dương
    { border: '#34d399', bg: '#f0fdf4', badgeBg: 'linear-gradient(135deg, #059669, #047857)', text: '#065f46', lightBorder: '#a7f3d0' }, // Xanh ngọc
    { border: '#c084fc', bg: '#faf5ff', badgeBg: 'linear-gradient(135deg, #9333ea, #7c3aed)', text: '#6b21a8', lightBorder: '#e9d5ff' }, // Tím nhạt
    { border: '#fb923c', bg: '#fff7ed', badgeBg: 'linear-gradient(135deg, #ea580c, #c2410c)', text: '#9a3412', lightBorder: '#fed7aa' }, // Cam ấm
    { border: '#f472b6', bg: '#fdf2f8', badgeBg: 'linear-gradient(135deg, #db2777, #be185d)', text: '#9d174d', lightBorder: '#fbcfe8' }, // Hồng phấn
    { border: '#eab308', bg: '#fefce8', badgeBg: 'linear-gradient(135deg, #ca8a04, #a16207)', text: '#854d0e', lightBorder: '#fef08a' }  // Vàng mơ
];

// NHẬN DIỆN CÂU HỎI THUỘC PHẦN IV
function isPart4Question(q) {
    if (!q) return false;
    if (q.part === 4 || q.isPart4 === true) return true;
    if (q.type === "essay" || q.type === "essay_answer" || q.type === "part4") return true;
    const txt = String(q.question || "").toUpperCase();
    if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) {
        return true;
    }
    return false;
}

// XÁC ĐỊNH CHÍNH XÁC PHẦN CỦA CÂU HỎI (1, 2, 3, 4)
function getQuestionPartType(q) {
    if (!q) return 1;
    if (isPart4Question(q)) return 4;
    if (q.type === "true_false") return 2;
    if (q.type === "short_answer") return 3;
    return 1; // multiple_choice
}

// BỘ GOM VÀ TỰ ĐỘNG SẮP XẾP TOÀN BỘ CÂU HỎI THEO THỨ TỰ PHẦN I -> II -> III -> IV
function reorganizeAllQuestionsByParts(questionsList) {
    if (!Array.isArray(questionsList)) return [];
    const p1 = questionsList.filter(q => getQuestionPartType(q) === 1);
    const p2 = questionsList.filter(q => getQuestionPartType(q) === 2);
    const p3 = questionsList.filter(q => getQuestionPartType(q) === 3);
    const p4 = questionsList.filter(q => getQuestionPartType(q) === 4);
    return [...p1, ...p2, ...p3, ...p4];
}

// HÀM CHÈN DANH SÁCH CÂU MỚI VÀO ĐÚNG CUỐI TỪNG PHẦN TƯƠNG ỨNG
function insertQuestionsOrganizedByPart(newQuestions) {
    if (!Array.isArray(newQuestions) || newQuestions.length === 0) return [];
    let currentQuestions = soiDeState.examData.questions || [];

    let p1 = currentQuestions.filter(q => getQuestionPartType(q) === 1);
    let p2 = currentQuestions.filter(q => getQuestionPartType(q) === 2);
    let p3 = currentQuestions.filter(q => getQuestionPartType(q) === 3);
    let p4 = currentQuestions.filter(q => getQuestionPartType(q) === 4);

    newQuestions.forEach(newQ => {
        const pType = getQuestionPartType(newQ);
        if (pType === 1) p1.push(newQ);
        else if (pType === 2) p2.push(newQ);
        else if (pType === 3) p3.push(newQ);
        else p4.push(newQ);
    });

    soiDeState.examData.questions = [...p1, ...p2, ...p3, ...p4];
    return newQuestions;
}

// HÀM ĐỊNH DẠNG TEXT CÂU HỎI AN TOÀN
function formatQuestionText(text) {
    if (!text) return "";
    return text.replace(/(^|[^:])\/\/\s*([^\r\n<]+)/g, function(match, prefix, content) {
        return prefix + '<span style="color: #78350f; font-weight: 800;">// ' + content.trim() + '</span>';
    });
}

// TỰ ĐỘNG GIÃN CHIỀU CAO TEXTAREA
function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight + 4, 38) + 'px';
}

function autoResizeAllTextareas() {
    const textareas = document.querySelectorAll('#soide-cards-container textarea.soide-latex-input, #soide-cards-container textarea.soide-card-raw-textarea');
    textareas.forEach(t => autoResizeTextarea(t));
}

// 1. TIÊM CSS VÀO HEAD
function injectSoiDeStyles() {
    const styleId = "soi-de-modal-custom-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        /* MODAL OVERLAY */
        .soide-modal-overlay {
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            z-index: 10000005 !important; display: none; align-items: center; justify-content: center;
            padding: 1vh 1vw; box-sizing: border-box; font-family: 'Be Vietnam Pro', 'Inter', sans-serif;
            animation: fadeInSoiDe 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeInSoiDe { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }

        .soide-modal-card {
            width: 98vw !important; height: 98vh !important;
            max-width: 98vw !important; max-height: 98vh !important;
            background: #ffffff; border-radius: 18px; border: 1.5px solid #cbd5e1;
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.5);
            display: flex; flex-direction: column; overflow: hidden; position: relative;
        }

        /* HEADER CHÍNH */
        .soide-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 14px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff; border-bottom: 2px solid #10b981; flex-shrink: 0; gap: 8px;
        }
        .soide-header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .soide-header-title { font-size: 14px; font-weight: 900; color: #34d399; display: flex; align-items: center; gap: 6px; }
        .soide-header-tools { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; position: relative; }

        .btn-soide-tool {
            padding: 4px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 800;
            border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
            transition: all 0.15s ease; user-select: none; white-space: nowrap; font-family: inherit;
        }
        .btn-soide-tool:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .btn-soide-tool:active { transform: translateY(1.5px) scale(0.96); }

        .btn-soide-upload-class {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: #ffffff !important; box-shadow: 0 2px 7px rgba(14, 165, 233, 0.4);
            border: 1px solid #7dd3fc !important;
        }
        .btn-soide-upload { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35); }
        .btn-soide-download { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; }
        .btn-soide-add { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; }
        .btn-soide-switch { background: #334155; color: #cbd5e1; border: 1px solid #475569; }
        .btn-soide-switch.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
        .btn-soide-close { background: #334155; color: #f87171; border-radius: 50%; width: 28px; height: 28px; padding: 0; justify-content: center; font-size: 14px; font-weight: 900; }
        .btn-soide-close:hover { background: #ef4444; color: #ffffff; }

        /* DROPDOWN CHỌN 8 LỚP ĐĂNG ĐỀ */
        .soide-class-dropdown {
            position: absolute; top: calc(100% + 8px); right: 120px; width: 260px;
            background: #ffffff; border-radius: 14px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.45);
            border: 1.5px solid #0284c7; padding: 10px 12px; z-index: 9999999;
            display: none; flex-direction: column; gap: 8px; animation: popInBadge 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .soide-class-dropdown.show { display: flex; }
        .soide-class-list-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 220px; overflow-y: auto; padding: 4px 2px;
        }
        .soide-class-chk-item {
            display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700;
            color: #1e293b; background: #f8fafc; border: 1.2px solid #cbd5e1; border-radius: 7px;
            padding: 5px 6px; cursor: pointer; user-select: none; transition: 0.15s;
        }
        .soide-class-chk-item:hover { border-color: #0284c7; background: #f0f9ff; }
        .soide-class-chk-item.checked { border-color: #0284c7; background: #e0f2fe; color: #0369a1; }
        .soide-class-chk-item input { margin: 0; accent-color: #0284c7; cursor: pointer; }

        /* BODY SPLIT */
        .soide-split-body {
            flex: 1; display: flex; width: 100%; height: calc(100% - 46px);
            overflow: hidden; position: relative; user-select: none;
        }

        /* NỬA TRÁI: LIVE PREVIEW */
        .soide-left-pane {
            height: 100%; overflow-y: auto; overflow-x: hidden;
            background: #f8fafc; padding: 10px 12px; box-sizing: border-box;
            border-right: 1px solid #cbd5e1; user-select: text;
            scroll-behavior: smooth;
        }

        /* VẠCH KÉO CHIA ĐÔI */
        .soide-resizer {
            width: 8px; height: 100%; background: #e2e8f0; cursor: col-resize;
            flex-shrink: 0; position: relative; transition: background 0.15s;
            display: flex; align-items: center; justify-content: center; z-index: 10;
        }
        .soide-resizer::after {
            content: "⋮"; font-weight: 900; color: #64748b; font-size: 16px; line-height: 1;
        }
        .soide-resizer:hover, .soide-resizer.is-dragging { background: #10b981; }
        .soide-resizer:hover::after, .soide-resizer.is-dragging::after { color: #ffffff; }

        /* NỬA PHẢI: LATEX EDITOR */
        .soide-right-pane {
            height: 100%; overflow-y: auto; overflow-x: hidden;
            background: #ffffff; padding: 10px 12px; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 8px; user-select: text;
            scroll-behavior: smooth;
        }

        .soide-drop-zone {
            border: 1.5px dashed #10b981; border-radius: 10px; padding: 8px 12px;
            background: #f0fdf4; display: flex; align-items: center; justify-content: space-between;
            gap: 8px; flex-wrap: wrap; transition: all 0.2s ease;
        }
        .soide-drop-zone.dragover {
            background: #dcfce7; border-color: #059669; transform: scale(1.01);
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
        }
        .soide-drop-text { font-size: 12px; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 5px; }

        .soide-alert-box {
            padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700;
            display: none; align-items: center; gap: 6px; line-height: 1.3;
        }
        .soide-alert-box.has-errors {
            display: flex; background: #fef2f2; border: 1.2px solid #fecaca; color: #dc2626;
        }
        .soide-alert-box.is-valid {
            display: flex; background: #f0fdf4; border: 1.2px solid #bbf7d0; color: #16a34a;
        }

        /* KHỐI SOẠN THẢO BÊN PHẢI */
        .soide-editor-qcard {
            border-radius: 12px; padding: 8px 10px;
            display: flex; flex-direction: column; gap: 5px;
            box-shadow: 0 2px 7px rgba(0, 0, 0, 0.04);
            transition: all 0.15s ease; position: relative;
        }
        .soide-editor-qcard:focus-within {
            box-shadow: 0 0 0 2.5px rgba(2, 132, 199, 0.3) !important;
        }

        /* 2 VÙNG PASTE */
        .soide-paste-zones-row {
            display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 5px;
        }
        .soide-paste-box {
            border: 1.5px dashed #94a3b8; background: rgba(255, 255, 255, 0.65);
            border-radius: 7px; padding: 5px 8px; display: flex; align-items: center;
            justify-content: center; gap: 5px; font-size: 11.5px; font-weight: 700;
            color: #475569; cursor: pointer; user-select: none; transition: all 0.18s ease;
            outline: none; line-height: 1.3;
        }
        .soide-paste-box:hover {
            opacity: 1; background: #ffffff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        .soide-paste-box.zone-overwrite:hover, .soide-paste-box.zone-overwrite:focus {
            border-color: #0284c7; color: #0369a1; background: #e0f2fe;
            box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25);
        }
        .soide-paste-box.zone-insert:hover, .soide-paste-box.zone-insert:focus {
            border-color: #10b981; color: #047857; background: #dcfce7;
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
        }

        /* KHUNG NHẬP MÃ NGUỒN THÔ TẠI TỪNG CÂU */
        .soide-card-raw-box {
            background: #0f172a; border-radius: 9px; padding: 8px;
            display: flex; flex-direction: column; gap: 6px; border: 1.5px solid #38bdf8;
            margin-top: 4px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);
        }
        .soide-card-raw-header {
            display: flex; align-items: center; justify-content: space-between;
            font-size: 11.5px; font-weight: 800; color: #38bdf8;
        }
        .soide-card-raw-textarea {
            width: 100%; min-height: 110px; padding: 7px;
            font-family: 'Consolas', 'Courier New', monospace; font-size: 13.5px !important;
            font-weight: 600; line-height: 1.4; color: #f8fafc; background: #1e293b;
            border: 1px solid #475569; border-radius: 7px; outline: none; box-sizing: border-box;
            resize: vertical;
        }
        .soide-card-raw-textarea:focus { border-color: #38bdf8; }
        .soide-card-raw-btn-row {
            display: flex; align-items: center; justify-content: flex-end; gap: 6px;
        }

        .soide-qcard-head {
            display: flex; align-items: center; justify-content: space-between;
            gap: 6px; margin-bottom: 2px;
        }
        .soide-qcard-num {
            font-weight: 900; font-size: 13.5px; display: flex; align-items: center; gap: 5px;
        }

        .soide-head-actions {
            display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
        }
        .btn-soide-mini {
            padding: 3px 7px; border-radius: 6px; font-size: 11px; font-weight: 800;
            cursor: pointer; display: inline-flex; align-items: center; gap: 2px;
            border: none; transition: 0.15s; user-select: none; line-height: 1.2; font-family: inherit;
        }
        .btn-soide-mini:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .btn-soide-mini:active { transform: translateY(1px) scale(0.96); }

        .btn-soide-raw-toggle { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
        .btn-soide-raw-toggle:hover { background: #0284c7; color: #fff; border-color: #0284c7; }
        .btn-soide-add-inline { background: #e0f2fe; color: #0284c7; border: 1px solid #7dd3fc; }
        .btn-soide-del-inline { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
        
        .soide-part-select-mini {
            padding: 2px 5px; border-radius: 6px; font-size: 11px; font-weight: 900;
            background: #ffffff; color: #1e293b; border: 1.2px solid #cbd5e1; outline: none;
            cursor: pointer; height: 24px;
        }

        .soide-textarea-label {
            font-size: 11.5px; font-weight: 800; color: #475569; margin-bottom: 2px;
            display: flex; justify-content: space-between; line-height: 1.25;
        }

        .soide-latex-input {
            width: 100%; padding: 6px 9px; border: 1.5px solid #cbd5e1; border-radius: 7px;
            font-family: 'Consolas', 'Courier New', monospace; font-size: 15px !important;
            font-weight: 600; line-height: 1.45; outline: none; box-sizing: border-box; resize: vertical;
            color: #0f172a; background: #ffffff; field-sizing: content; min-height: 38px;
            overflow-y: hidden; transition: border-color 0.15s, background-color 0.15s;
        }
        .soide-latex-input:focus { border-color: #0284c7; background: #f8fafc; }

        .soide-options-editor-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
        }
        .soide-tf-editor-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .soide-tf-editor-table td { padding: 3px 4px; border: 1px solid #e2e8f0; vertical-align: middle; }

        /* PREVIEW CỘT TRÁI */
        .options-list.opt-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr) !important; gap: 8px; }
        .options-list.opt-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr) !important; gap: 7px; }
        .options-list.opt-grid-1 { display: grid; grid-template-columns: 1fr !important; gap: 5px; }

        .soide-preview-card {
            border-radius: 14px; padding: 10px 14px; margin-bottom: 11px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); position: relative; transition: all 0.25s ease;
        }
        .soide-preview-card.is-synced-active {
            box-shadow: 0 0 0 3px #0284c7, 0 6px 18px rgba(2, 132, 199, 0.28) !important;
            transform: scale(1.008);
        }
        .soide-preview-head-row {
            display: flex; align-items: center; justify-content: space-between;
            gap: 8px; margin-bottom: 6px; padding-bottom: 4px;
            border-bottom: 1px dashed rgba(100, 116, 139, 0.25);
        }
        .soide-preview-title-badge { font-size: 13.5px; font-weight: 900; line-height: 1.3; }

        /* MÃ NGUỒN THÔ TOÀN BỘ ĐỀ */
        .soide-raw-textarea {
            width: 100%; flex: 1; min-height: 480px; padding: 12px;
            font-family: 'Consolas', 'Courier New', monospace; font-size: 13.5px;
            line-height: 1.5; border: 1.5px solid #cbd5e1; border-radius: 10px;
            outline: none; background: #0f172a; color: #f8fafc; box-sizing: border-box;
        }
    `;
    document.head.appendChild(style);
}

// 2. KHỞI TẠO DOM CHO MODAL SOI ĐỀ
function ensureSoiDeModalInDOM() {
    injectSoiDeStyles();

    if (document.getElementById("modal-soi-de")) return document.getElementById("modal-soi-de");
    if (!document.body) return null;

    const modalDiv = document.createElement("div");
    modalDiv.className = "soide-modal-overlay";
    modalDiv.id = "modal-soi-de";
    modalDiv.innerHTML = `
        <div class="soide-modal-card" onclick="event.stopPropagation()">
            <!-- HEADER -->
            <div class="soide-header">
                <div class="soide-header-left">
                    <span style="font-size: 18px;">🔬</span>
                    <div>
                        <div class="soide-header-title">CÔNG CỤ SOI ĐỀ THI & BIÊN SOẠN THỜI GIAN THỰC (REALTIME)</div>
                        <div style="font-size: 11px; color: #94a3b8;" id="soide-exam-subtext">Đề thi: Đang nạp...</div>
                    </div>
                </div>
                <div class="soide-header-tools">
                    <!-- NÚT TẢI ĐỀ LÊN LỚP -->
                    <button type="button" class="btn-soide-tool btn-soide-upload-class" id="btn-soide-class-picker" onclick="toggleSoiDeClassDropdown(event)">
                        🚀 Tải đề lên lớp ▾
                    </button>

                    <!-- DROPDOWN 8 LỚP (ĐÃ BỎ TÍCH MẶC ĐỊNH THEO YÊU CẦU 2) -->
                    <div class="soide-class-dropdown" id="soide-class-dropdown" onclick="event.stopPropagation()">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:5px;">
                            <b style="font-size:12px; color:#0284c7;">🎯 Chọn lớp đăng đề:</b>
                            <div style="display:flex; gap:4px;">
                                <button type="button" class="btn-soide-mini" onclick="toggleAllSoiDeClasses(true)">Tất cả</button>
                                <button type="button" class="btn-soide-mini" onclick="toggleAllSoiDeClasses(false)">Bỏ</button>
                            </div>
                        </div>
                        <div class="soide-class-list-grid" id="soide-class-list-container">
                            ${SOI_DE_AVAILABLE_CLASSES.map(c => `
                                <label class="soide-class-chk-item" id="chk-label-${c.id}">
                                    <input type="checkbox" name="soide-target-class" value="${c.id}" onchange="handleSoiDeClassCheckChange(this)">
                                    <span>${c.name}</span>
                                </label>
                            `).join('')}
                        </div>
                        <button type="button" class="btn-soide-tool btn-soide-upload-class" id="btn-submit-upload-classes" onclick="submitExamToSelectedClasses()" style="width:100%; justify-content:center; padding:7px;">
                            🚀 Xác nhận đăng đề
                        </button>
                    </div>

                    <button type="button" class="btn-soide-tool btn-soide-upload" onclick="triggerSoiDeUpload()">
                        📂 Upload Đề
                    </button>
                    <input type="file" id="soide-file-input" accept=".json,.js,.txt" style="display:none;" onchange="handleSoiDeFileSelected(this)">
                    
                    <button type="button" class="btn-soide-tool btn-soide-add" onclick="addNewQuestionToSoiDe()">
                        ➕ Thêm câu mới
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-download" onclick="downloadSoiDeJson()">
                        💾 Tải JSON đề
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-switch active" id="btn-mode-cards" onclick="setSoiDeEditorMode('cards')">
                        📑 Khối từng câu
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-switch" id="btn-mode-raw" onclick="setSoiDeEditorMode('raw')">
                        💻 Mã nguồn thô
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-close" onclick="closeSoiDeModal()" title="Đóng cửa sổ">✕</button>
                </div>
            </div>

            <!-- BODY SPLIT -->
            <div class="soide-split-body" id="soide-split-body">
                <!-- NỬA TRÁI: LIVE RENDER -->
                <div class="soide-left-pane" id="soide-left-pane" style="width: 50%;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 5px;">
                        <span style="font-size: 13px; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                            👁️ HÌNH ẢNH ĐỀ THI THỰC TẾ (<span id="soide-live-qcount" style="color:#0284c7;">0</span> câu)
                        </span>
                        <div id="soide-alert-box" class="soide-alert-box is-valid">✅ Cú pháp & công thức hợp lệ</div>
                    </div>

                    <div id="soide-live-preview-content"></div>
                </div>

                <!-- VẠCH CHIA KÉO ĐỘ RỘNG -->
                <div class="soide-resizer" id="soide-resizer" title="Giữ chuột và kéo sang trái/phải để chỉnh độ rộng"></div>

                <!-- NỬA PHẢI: LATEX EDITOR -->
                <div class="soide-right-pane" id="soide-right-pane" style="width: 50%;">
                    <!-- VÙNG KÉO THẢ TỆP -->
                    <div class="soide-drop-zone" id="soide-drop-zone">
                        <div class="soide-drop-text">
                            <span>📥</span> <span>Kéo thả file <b>.json / .js / .txt</b> vào đây hoặc bấm nút <b>Upload Đề</b> ở góc trên!</span>
                        </div>
                        <button type="button" class="btn-soide-tool btn-soide-upload" style="padding: 3px 8px; font-size: 11px;" onclick="triggerSoiDeUpload()">
                            📁 Chọn file
                        </button>
                    </div>

                    <!-- THÔNG TIN CHUNG ĐỀ THI -->
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 9px;">
                        <div>
                            <div class="soide-textarea-label">Tên đề thi:</div>
                            <input type="text" id="soide-meta-title" class="soide-latex-input" style="font-size:13.5px !important; padding: 4px 6px; min-height:30px;" oninput="updateSoiDeMeta()">
                        </div>
                        <div>
                            <div class="soide-textarea-label">Mã đề:</div>
                            <input type="text" id="soide-meta-made" class="soide-latex-input" style="font-size:13.5px !important; padding: 4px 6px; min-height:30px;" oninput="updateSoiDeMeta()">
                        </div>
                        <div>
                            <div class="soide-textarea-label">Số phút:</div>
                            <input type="number" id="soide-meta-minutes" class="soide-latex-input" style="font-size:13.5px !important; padding: 4px 6px; min-height:30px;" oninput="updateSoiDeMeta()">
                        </div>
                    </div>

                    <!-- KHỐI SOẠN THẢO DẠNG CARDS -->
                    <div id="soide-cards-container" style="display: flex; flex-direction: column; gap: 7px;"></div>

                    <!-- KHỐI SOẠN THẢO DẠNG RAW CODE -->
                    <div id="soide-raw-container" style="display: none; flex: 1; flex-direction: column;">
                        <textarea id="soide-raw-editor" class="soide-raw-textarea" spellcheck="false" oninput="handleSoiDeRawInput(this.value)"></textarea>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    setupSoiDeDragAndResize();
    setupRightToLeftScrollSync();

    // Click ra ngoài tự đóng Dropdown chọn lớp
    document.addEventListener("click", function(e) {
        const drop = document.getElementById("soide-class-dropdown");
        const btn = document.getElementById("btn-soide-class-picker");
        if (drop && drop.classList.contains("show")) {
            if (!drop.contains(e.target) && e.target !== btn) {
                drop.classList.remove("show");
            }
        }
    });

    return modalDiv;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureSoiDeModalInDOM);
} else {
    ensureSoiDeModalInDOM();
}

// 3. MỞ VÀ ĐÓNG MODAL SOI ĐỀ
function openSoiDeModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    
    let modal = document.getElementById("modal-soi-de");
    if (!modal) modal = ensureSoiDeModalInDOM();
    if (!modal) return;

    modal.style.display = "flex";

    if (!soiDeState.examData || !Array.isArray(soiDeState.examData.questions) || soiDeState.examData.questions.length === 0) {
        initDefaultSoiDeExam();
    } else {
        renderSoiDeBothSides();
    }

    setTimeout(() => {
        autoResizeAllTextareas();
        setupRightToLeftScrollSync();
    }, 50);
}

function closeSoiDeModal() {
    const modal = document.getElementById("modal-soi-de");
    if (modal) modal.style.display = "none";
}

// 4. KÉO THẢ VẠCH CHIA & DROP ZONE
function setupSoiDeDragAndResize() {
    const resizer = document.getElementById("soide-resizer");
    const container = document.getElementById("soide-split-body");
    const leftPane = document.getElementById("soide-left-pane");
    const rightPane = document.getElementById("soide-right-pane");
    const dropZone = document.getElementById("soide-drop-zone");

    if (!resizer || !container || !leftPane || !rightPane) return;

    let isDragging = false;

    resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        resizer.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging || !container) return;
        const rect = container.getBoundingClientRect();
        let offsetX = e.clientX - rect.left;
        let percent = (offsetX / rect.width) * 100;
        percent = Math.min(Math.max(15, percent), 85);
        soiDeState.splitRatio = percent;
        leftPane.style.width = `${percent}%`;
        rightPane.style.width = `${100 - percent}%`;
    });

    window.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove("is-dragging");
            autoResizeAllTextareas();
        }
    });

    if (dropZone) {
        dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
        dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("dragover"); });
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                readAndParseSoiDeFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (rightPane) {
        rightPane.addEventListener("dragover", (e) => e.preventDefault());
        rightPane.addEventListener("drop", (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                readAndParseSoiDeFile(e.dataTransfer.files[0]);
            }
        });
    }
}

// 5. ĐỒNG BỘ CUỘN TỪ CỘT PHẢI SANG CỘT TRÁI
let lastSyncedQId = null;

function setupRightToLeftScrollSync() {
    const rightPane = document.getElementById("soide-right-pane");
    if (!rightPane || rightPane.dataset.hasScrollSync === "true") return;
    rightPane.dataset.hasScrollSync = "true";

    let syncTimer = null;
    rightPane.addEventListener("scroll", () => {
        if (soiDeState.editorMode !== 'cards') return;
        if (syncTimer) cancelAnimationFrame(syncTimer);
        syncTimer = requestAnimationFrame(() => {
            syncLeftPreviewFromRightScroll();
        });
    }, { passive: true });
}

function syncLeftPreviewFromRightScroll() {
    const rightPane = document.getElementById("soide-right-pane");
    const leftPane = document.getElementById("soide-left-pane");
    if (!rightPane || !leftPane) return;

    const rightPaneRect = rightPane.getBoundingClientRect();
    const rightCards = rightPane.querySelectorAll('.soide-editor-qcard');
    if (!rightCards || rightCards.length === 0) return;

    let targetCard = null;
    let minDistance = Infinity;
    const probeY = rightPaneRect.top + 75;

    for (let card of rightCards) {
        const rect = card.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) {
            targetCard = card;
            break;
        }
        const dist = Math.abs(rect.top - probeY);
        if (dist < minDistance) {
            minDistance = dist;
            targetCard = card;
        }
    }

    if (targetCard) {
        const qId = targetCard.id.replace('soide-qcard-', '');
        if (qId && qId !== lastSyncedQId) {
            lastSyncedQId = qId;
            scrollToLeftPreviewQuestion(qId, false);
        }
    }
}

function scrollToLeftPreviewQuestion(qId, triggerSmooth = true) {
    const leftPane = document.getElementById("soide-left-pane");
    const leftCard = document.getElementById(`soide-preview-card-${qId}`);
    if (!leftPane || !leftCard) return;

    const leftPaneRect = leftPane.getBoundingClientRect();
    const leftCardRect = leftCard.getBoundingClientRect();
    const currentScrollTop = leftPane.scrollTop;
    const offsetWithinPane = leftCardRect.top - leftPaneRect.top;
    const targetScrollTop = currentScrollTop + offsetWithinPane - 12;

    leftPane.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: triggerSmooth ? 'smooth' : 'auto'
    });

    document.querySelectorAll('.soide-preview-card.is-synced-active').forEach(c => c.classList.remove('is-synced-active'));
    leftCard.classList.add('is-synced-active');
}

function showSoiDeToast(msg) {
    let toast = document.getElementById("soide-mini-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "soide-mini-toast";
        toast.style.cssText = `
            position: absolute; top: 48px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #059669, #047857); color: #fff;
            padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 12px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.3); z-index: 99999;
            transition: all 0.22s ease; opacity: 0; pointer-events: none;
        `;
        const card = document.querySelector(".soide-modal-card");
        if (card) card.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(4px)";
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(0)";
    }, 2500);
}

// 6. BỘ PHÂN TÍCH THÔNG MINH CHO CÂU HỎI ĐƠN LẺ
function parseSmartSingleQuestion(text) {
    if (!text || typeof text !== 'string') return null;
    let cleanText = text.trim();

    // Loại bỏ tiền tố "// Câu x" hoặc "Câu x:" nếu có để phân tích
    cleanText = cleanText.replace(/^(?:\/\/|\s)*(?:Câu|Bài)\s*\d+[\s\:\.\-–—]*/i, "").trim();

    // 1. Nếu là JSON hoặc JS Object
    let parsed = robustParseExamScriptOrJson(cleanText);
    if (parsed) {
        if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
        if (typeof parsed === 'object' && parsed.question) {
            return {
                type: parsed.type || (parsed.statements ? 'true_false' : (parsed.options ? 'multiple_choice' : 'short_answer')),
                question: parsed.question,
                options: parsed.options || ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
                statements: parsed.statements || [],
                correct: parsed.correct !== undefined ? parsed.correct : 0,
                correctAnswer: parsed.correctAnswer || parsed.correct_answer || "",
                explanation: parsed.explanation || "",
                part: parsed.part
            };
        }
    }

    // 2. Tách Lời giải chi tiết nếu có
    let explanation = "";
    const explainMatch = cleanText.match(/(?:(?:Lời giải chi tiết|Hướng dẫn giải chi tiết|Hướng dẫn giải|Lời giải|HƯỚNG DẪN GIẢI|LỜI GIẢI|HDG|HD)\s*[:：\-]\s*)([\s\S]*)$/i);
    if (explainMatch) {
        explanation = explainMatch[1].trim();
        cleanText = cleanText.slice(0, explainMatch.index).trim();
    }

    let correctLetter = null;
    let shortAns = "";
    const correctMatch = cleanText.match(/(?:(?:Đáp án đúng|Đáp án chuẩn|Đáp án|Chọn|Đ\/A|ĐA)\s*[:：\-]?\s*)([A-D]|[a-d]|Đúng|Sai|[^\n\r]+)/i);
    if (correctMatch) {
        const rawAns = correctMatch[1].trim();
        if (/^[A-D]$/i.test(rawAns)) {
            correctLetter = rawAns.toUpperCase();
        } else {
            shortAns = rawAns;
        }
        cleanText = cleanText.replace(correctMatch[0], "").trim();
    }

    // Kiểm tra câu trắc nghiệm nhiều lựa chọn (A, B, C, D) -> PHẦN 1
    const optRegex = /(?:^|\n|\r)\s*([A-D])[\.\:\)]\s*([\s\S]*?)(?=(?:(?:^|\n|\r)\s*[A-D][\.\:\)])|$)/gi;
    const optMatches = [...cleanText.matchAll(optRegex)];
    if (optMatches.length >= 2) {
        const firstIndex = optMatches[0].index;
        let qText = cleanText.slice(0, firstIndex).trim();
        const options = ["", "", "", ""];
        const letters = ["A", "B", "C", "D"];
        optMatches.forEach(m => {
            const L = m[1].toUpperCase();
            const idx = letters.indexOf(L);
            if (idx !== -1) options[idx] = m[2].trim();
        });

        let correctIdx = 0;
        if (correctLetter && letters.indexOf(correctLetter) !== -1) {
            correctIdx = letters.indexOf(correctLetter);
        }

        return {
            type: "multiple_choice",
            question: qText || cleanText,
            options: options,
            correct: correctIdx,
            explanation: explanation
        };
    }

    // Kiểm tra câu Đúng / Sai (a, b, c, d) -> PHẦN 2
    const stRegex = /(?:^|\n|\r)\s*([a-d])[\)\.]\s*([\s\S]*?)(?=(?:(?:^|\n|\r)\s*[a-d][\)\.])|$)/gi;
    const stMatches = [...cleanText.matchAll(stRegex)];
    if (stMatches.length >= 2) {
        const firstIndex = stMatches[0].index;
        let qText = cleanText.slice(0, firstIndex).trim();
        const statements = [];
        stMatches.forEach(m => {
            const id = m[1].toLowerCase();
            let stText = m[2].trim();
            let isCorrect = true;
            const markMatch = stText.match(/[\(\[\{]\s*(Đúng|Sai|True|False)\s*[\)\]\}]/i);
            if (markMatch) {
                isCorrect = /^(Đúng|True)$/i.test(markMatch[1]);
                stText = stText.replace(markMatch[0], '').trim();
            }
            statements.push({ id, statement: stText, correct: isCorrect });
        });

        return {
            type: "true_false",
            question: qText || cleanText,
            statements: statements,
            explanation: explanation
        };
    }

    // Kiểm tra câu trả lời ngắn / Tự luận -> PHẦN 3 / PHẦN 4
    const isP4 = cleanText.toUpperCase().includes("PHẦN IV") || cleanText.toUpperCase().includes("PHẦN 4");
    if (shortAns || /^(?:Đáp số|Kết quả|KQ)/i.test(cleanText) || isP4) {
        let qText = cleanText;
        const ansMatch = cleanText.match(/(?:(?:Đáp số|Kết quả|KQ)\s*[:：\-]?\s*)([^\n\r]+)/i);
        let finalAns = shortAns;
        if (ansMatch) {
            if (!finalAns) finalAns = ansMatch[1].trim();
            qText = cleanText.replace(ansMatch[0], "").trim();
        }
        return {
            type: "short_answer",
            part: isP4 ? 4 : undefined,
            question: qText,
            correctAnswer: finalAns || "0",
            explanation: explanation
        };
    }

    return {
        type: "multiple_choice",
        question: cleanText,
        options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        correct: 0,
        explanation: explanation
    };
}

// BỘ TÁCH ĐA CÂU: BÓC ĐƯỢC CẢ 1 HOẶC NHIỀU CÂU HỎI KHI PASTE
function parseSmartQuestionOrQuestions(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.trim();

    // Thử parse cả cấu trúc JSON hoặc mảng đề thi
    const robust = robustParseExamScriptOrJson(cleanText);
    if (robust) {
        if (Array.isArray(robust)) return robust.map(q => parseSmartSingleQuestion(JSON.stringify(q)));
        if (robust.questions && Array.isArray(robust.questions)) return robust.questions.map(q => parseSmartSingleQuestion(JSON.stringify(q)));
    }

    // Tách bằng phân cách //------ hoặc "Câu x"
    const splitRegex = /(?:^|\n|\r)\s*(?:\/\/\s*-{3,}|\/\/\s*Câu\s*\d+|Câu\s*\d+[\.\:\-])/i;
    const parts = cleanText.split(splitRegex).map(s => s.trim()).filter(Boolean);

    if (parts.length > 1) {
        const list = [];
        parts.forEach(p => {
            const parsed = parseSmartSingleQuestion(p);
            if (parsed) list.push(parsed);
        });
        if (list.length > 0) return list;
    }

    // Nếu chỉ là 1 câu duy nhất
    const single = parseSmartSingleQuestion(cleanText);
    return single ? [single] : [];
}

// =========================================================================
// XỬ LÝ MỞ KHUNG MÃ NGUỒN THÔ & DÁN TỰ ĐỘNG XẾP VÀO CUỐI TỪNG PHẦN
// =========================================================================

function toggleCardRawBox(qId) {
    if (soiDeState.rawEditingCardIds.has(qId)) {
        soiDeState.rawEditingCardIds.delete(qId);
    } else {
        soiDeState.rawEditingCardIds.add(qId);
    }
    renderSoiDeRightEditor();
    setTimeout(() => {
        autoResizeAllTextareas();
        const box = document.getElementById(`soide-card-raw-box-${qId}`);
        if (box) {
            box.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const ta = document.getElementById(`soide-card-raw-text-${qId}`);
            if (ta) ta.focus();
        }
    }, 40);
}

// Khi click vào vùng dán: Paste đè hoặc Paste thêm mới (TỰ ĐỘNG XẾP VÀO CUỐI PHẦN TƯƠNG ỨNG)
async function handlePasteZoneClick(qIdx, mode) {
    let clipboardText = "";
    if (navigator.clipboard && navigator.clipboard.readText) {
        try {
            clipboardText = await navigator.clipboard.readText();
        } catch (e) {}
    }

    if (mode === 'overwrite') {
        const targetQ = soiDeState.examData.questions[qIdx];
        if (!targetQ) return;
        soiDeState.rawEditingCardIds.add(targetQ.id);

        renderSoiDeRightEditor();
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${targetQ.id}`);
            if (ta) {
                if (clipboardText && clipboardText.trim()) {
                    ta.value = clipboardText.trim();
                    showSoiDeToast(`📋 Đã nạp nội dung dán vào mã thô Câu ${qIdx + 1}!`);
                }
                ta.focus();
            }
            scrollToLeftPreviewQuestion(targetQ.id, true);
        }, 50);

    } else if (mode === 'insert') {
        const questions = soiDeState.examData.questions || [];
        let maxId = questions.length > 0 ? Math.max(...questions.map(q => parseInt(q.id, 10) || 0)) : 0;

        let parsedQuestions = [];
        if (clipboardText && clipboardText.trim()) {
            parsedQuestions = parseSmartQuestionOrQuestions(clipboardText);
        }

        if (parsedQuestions.length === 0) {
            maxId++;
            parsedQuestions = [{
                id: maxId,
                type: "multiple_choice",
                question: "Câu hỏi mới: ...",
                options: ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
                correct: 0,
                explanation: ""
            }];
        } else {
            parsedQuestions.forEach(q => {
                maxId++;
                q.id = maxId;
            });
        }

        // TỰ ĐỘNG XẾP CÁC CÂU NÀY VÀO CUỐI MỖI PHẦN TƯƠNG ỨNG (YÊU CẦU 1)
        insertQuestionsOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => soiDeState.rawEditingCardIds.add(q.id));

        renderSoiDeBothSides();
        
        const firstAddedId = parsedQuestions[0].id;
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${firstAddedId}`);
            if (ta && clipboardText && clipboardText.trim()) {
                ta.value = clipboardText.trim();
            }
            scrollToLeftPreviewQuestion(firstAddedId, true);
            const card = document.getElementById(`soide-qcard-${firstAddedId}`);
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });

            showSoiDeToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào CUỐI từng phần tương ứng!`);
        }, 70);
    }
}

// Bắt sự kiện Ctrl+V trực tiếp trên vùng dán
function handlePasteOnQuestion(event, qIdx, mode) {
    event.preventDefault();
    event.stopPropagation();
    const text = (event.clipboardData || window.clipboardData)?.getData('text');

    if (mode === 'overwrite') {
        const targetQ = soiDeState.examData.questions[qIdx];
        if (!targetQ) return;
        soiDeState.rawEditingCardIds.add(targetQ.id);
        renderSoiDeRightEditor();
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${targetQ.id}`);
            if (ta) {
                if (text) ta.value = text.trim();
                ta.focus();
            }
            showSoiDeToast(`📋 Đã dán vào mã thô Câu ${qIdx + 1}!`);
        }, 40);

    } else if (mode === 'insert') {
        const questions = soiDeState.examData.questions || [];
        let maxId = questions.length > 0 ? Math.max(...questions.map(q => parseInt(q.id, 10) || 0)) : 0;

        let parsedQuestions = parseSmartQuestionOrQuestions(text);
        if (parsedQuestions.length === 0) {
            maxId++;
            parsedQuestions = [{
                id: maxId,
                type: "multiple_choice",
                question: text || "Câu hỏi mới...",
                options: ["A", "B", "C", "D"],
                correct: 0,
                explanation: ""
            }];
        } else {
            parsedQuestions.forEach(q => {
                maxId++;
                q.id = maxId;
            });
        }

        // TỰ ĐỘNG XẾP VÀO CUỐI MỖI PHẦN TƯƠNG ỨNG
        insertQuestionsOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => soiDeState.rawEditingCardIds.add(q.id));

        renderSoiDeBothSides();

        const firstAddedId = parsedQuestions[0].id;
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${firstAddedId}`);
            if (ta && text) ta.value = text.trim();
            scrollToLeftPreviewQuestion(firstAddedId, true);
            showSoiDeToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào CUỐI từng phần tương ứng!`);
        }, 60);
    }
}

// Áp dụng nội dung từ khung mã nguồn thô của câu vào State & Sắp xếp vị trí
function applyCardRawInput(qIdx, qId) {
    const ta = document.getElementById(`soide-card-raw-text-${qId}`);
    if (!ta) return;
    const rawVal = ta.value.trim();
    if (!rawVal) {
        alert("⚠️ Vui lòng nhập nội dung câu hỏi!");
        return;
    }

    const qObj = parseSmartSingleQuestion(rawVal);
    if (!qObj) {
        alert("⚠️ Không nhận diện được cấu trúc câu hỏi!");
        return;
    }

    const targetQ = soiDeState.examData.questions[qIdx];
    if (targetQ) {
        targetQ.type = qObj.type;
        targetQ.question = qObj.question;
        if (qObj.options) targetQ.options = qObj.options;
        if (qObj.statements) targetQ.statements = qObj.statements;
        if (qObj.correct !== undefined) targetQ.correct = qObj.correct;
        if (qObj.correctAnswer !== undefined) targetQ.correctAnswer = qObj.correctAnswer;
        if (qObj.explanation !== undefined) targetQ.explanation = qObj.explanation;
        if (qObj.part) targetQ.part = qObj.part;
    }

    // Tự động sắp xếp lại đề theo thứ tự Phần 1 -> 2 -> 3 -> 4
    soiDeState.examData.questions = reorganizeAllQuestionsByParts(soiDeState.examData.questions);
    soiDeState.rawEditingCardIds.delete(qId);
    
    renderSoiDeBothSides();

    setTimeout(() => {
        autoResizeAllTextareas();
        scrollToLeftPreviewQuestion(qId, true);
    }, 40);

    showSoiDeToast(`✅ Đã nhận diện và sắp xếp chuẩn vào phần tương ứng!`);
}

// 7. KHỞI TẠO ĐỀ MẪU BAN ĐẦU
function initDefaultSoiDeExam() {
    soiDeState.examData = {
        title: "ĐỀ KIỂM TRA ĐỊNH KỲ TOÁN 12",
        maDe: "101",
        timeLimitMinutes: 90,
        images: {},
        questions: [
            {
                id: 1,
                type: "multiple_choice",
                question: "Cho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$. Tìm nghiệm của phương trình $f'(x) = 0$?",
                options: ["$x = 1$", "$x = 2$", "$x = -1$", "$x = 0$"],
                correct: 0,
                explanation: "Ta có $f'(x) = 0 \\Leftrightarrow x = 1$."
            },
            {
                id: 2,
                type: "true_false",
                question: "Xét tính đúng sai của các mệnh đề sau đây:",
                statements: [
                    { id: "a", statement: "Hàm số đồng biến trên khoảng $(0; +\\infty)$.", correct: true },
                    { id: "b", statement: "Hàm số có giá trị cực tiểu bằng $-2$.", correct: false },
                    { id: "c", statement: "Đồ thị hàm số có tiệm cận đứng $x = 1$.", correct: true },
                    { id: "d", statement: "Giá trị lớn nhất của hàm số trên $[1; 3]$ bằng $5$.", correct: true }
                ],
                explanation: "Mệnh đề a, c, d đúng; mệnh đề b sai."
            },
            {
                id: 3,
                type: "short_answer",
                question: "Tính đạo hàm của hàm số $y = x^2 - 3x + 2$ tại điểm $x = 2$.",
                correctAnswer: "1",
                explanation: "$y' = 2x - 3 \\Rightarrow y'(2) = 1$."
            }
        ]
    };
    renderSoiDeBothSides();
}

// 8. UPLOAD & PHÂN TÍCH ĐỀ
function triggerSoiDeUpload() {
    const input = document.getElementById("soide-file-input");
    if (input) { input.value = ""; input.click(); }
}

function handleSoiDeFileSelected(input) {
    if (input.files && input.files[0]) readAndParseSoiDeFile(input.files[0]);
}

function robustParseExamScriptOrJson(text) {
    if (!text) return null;
    let clean = String(text).trim();
    try { return JSON.parse(clean); } catch(e) {}
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

function readAndParseSoiDeFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            let parsed = robustParseExamScriptOrJson(text);
            if (!parsed) throw new Error("File rỗng hoặc không đúng cấu trúc!");

            let rawQuestions = [];
            if (Array.isArray(parsed)) {
                rawQuestions = parsed;
                soiDeState.examData = {
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    maDe: "101",
                    timeLimitMinutes: 90,
                    images: {},
                    questions: reorganizeAllQuestionsByParts(rawQuestions)
                };
            } else if (typeof parsed === "object") {
                rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
                soiDeState.examData = {
                    title: parsed.title || file.name.replace(/\.[^/.]+$/, ""),
                    maDe: parsed.maDe || parsed.made || "101",
                    timeLimitMinutes: parseInt(parsed.timeLimitMinutes || parsed.time_limit_minutes, 10) || 90,
                    images: parsed.images || {},
                    questions: reorganizeAllQuestionsByParts(rawQuestions)
                };
            }

            renderSoiDeBothSides();
            alert(`✅ ĐÃ NẠP THÀNH CÔNG ĐỀ THI!\n\n- Tên đề: ${soiDeState.examData.title}\n- Tổng số câu: ${soiDeState.examData.questions.length} câu (Đã xếp chuẩn 4 phần).`);
        } catch(err) {
            alert("❌ Lỗi đọc file đề thi: " + err.message);
        }
    };
    reader.readAsText(file);
}

// 9. RENDER ĐỒNG THỜI CẢ 2 NỬA
function renderSoiDeBothSides() {
    renderSoiDeRightEditor();
    renderSoiDeLeftLivePreview();
}

function updateSoiDeMeta() {
    const titleIn = document.getElementById("soide-meta-title");
    const madeIn = document.getElementById("soide-meta-made");
    const minIn = document.getElementById("soide-meta-minutes");
    const subText = document.getElementById("soide-exam-subtext");

    if (titleIn) soiDeState.examData.title = titleIn.value;
    if (madeIn) soiDeState.examData.maDe = madeIn.value;
    if (minIn) soiDeState.examData.timeLimitMinutes = parseInt(minIn.value, 10) || 90;
    if (subText) subText.innerText = `Đề: ${soiDeState.examData.title} | Mã: ${soiDeState.examData.maDe} | ${soiDeState.examData.timeLimitMinutes} phút`;

    debouncedLivePreview();
}

// 10. RENDER NỬA PHẢI: TRÌNH BIÊN TẬP
function renderSoiDeRightEditor() {
    const metaTitle = document.getElementById("soide-meta-title");
    const metaMade = document.getElementById("soide-meta-made");
    const metaMin = document.getElementById("soide-meta-minutes");
    const subText = document.getElementById("soide-exam-subtext");

    if (metaTitle) metaTitle.value = soiDeState.examData.title || "";
    if (metaMade) metaMade.value = soiDeState.examData.maDe || "101";
    if (metaMin) metaMin.value = soiDeState.examData.timeLimitMinutes || 90;
    if (subText) subText.innerText = `Đề: ${soiDeState.examData.title} | Mã: ${soiDeState.examData.maDe} | ${soiDeState.examData.timeLimitMinutes} phút`;

    const cardsContainer = document.getElementById("soide-cards-container");
    if (!cardsContainer) return;
    cardsContainer.innerHTML = "";

    const questions = soiDeState.examData.questions || [];

    questions.forEach((q, qIdx) => {
        const palette = SOI_DE_THEME_PALETTES[qIdx % SOI_DE_THEME_PALETTES.length];
        const card = document.createElement("div");
        card.className = "soide-editor-qcard";
        card.id = `soide-qcard-${q.id}`;
        card.style.background = palette.bg;
        card.style.border = `1.8px solid ${palette.border}`;

        card.addEventListener("focusin", function() {
            scrollToLeftPreviewQuestion(q.id, true);
        });

        let currentPartType = "multiple_choice";
        if (q.part === 4 || q.type === 'essay' || q.type === 'part4') currentPartType = "part4";
        else if (q.type === 'true_false') currentPartType = "true_false";
        else if (q.type === 'short_answer') currentPartType = "short_answer";

        const isRawEditing = soiDeState.rawEditingCardIds.has(q.id);

        let cardBodyHtml = "";

        if (isRawEditing) {
            // HIỂN THỊ KHUNG MÃ NGUỒN THÔ CHO CÂU NÀY
            const jsonTextOfQ = JSON.stringify(q, null, 2);
            cardBodyHtml = `
                <div class="soide-card-raw-box" id="soide-card-raw-box-${q.id}">
                    <div class="soide-card-raw-header">
                        <span>💻 Mã nguồn thô / Văn bản câu hỏi ${qIdx + 1}:</span>
                        <span>(Có thể dán JSON hoặc text Word thường)</span>
                    </div>
                    <textarea class="soide-card-raw-textarea" id="soide-card-raw-text-${q.id}" spellcheck="false">${escapeHtml(jsonTextOfQ)}</textarea>
                    <div class="soide-card-raw-btn-row">
                        <button type="button" class="btn-soide-mini" onclick="toggleCardRawBox(${q.id})" style="background:#475569; color:#fff;">✕ Thu gọn</button>
                        <button type="button" class="btn-soide-mini" onclick="applyCardRawInput(${qIdx}, ${q.id})" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-weight:900;">⚡ Nhận diện & Áp dụng</button>
                    </div>
                </div>
            `;
        } else {
            // HIỂN THỊ DẠNG THẺ (CARDS) BÌNH THƯỜNG
            let specificHtml = "";
            if (q.type === "multiple_choice" && !q.part) {
                const letters = ["A", "B", "C", "D"];
                const currentCorrect = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").toUpperCase();

                specificHtml = `
                    <div class="soide-textarea-label">Các phương án lựa chọn (A, B, C, D):</div>
                    <div class="soide-options-editor-grid">
                        ${(q.options || ["", "", "", ""]).map((opt, oIdx) => `
                            <div>
                                <span style="font-weight:900; font-size:11px; color:${palette.text};">${letters[oIdx]}:</span>
                                <textarea class="soide-latex-input" rows="1" style="min-height:36px;" oninput="autoResizeTextarea(this); updateSoiDeOption(${qIdx}, ${oIdx}, this.value)">${escapeHtml(opt)}</textarea>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                        <b style="font-size:11.5px; color:#15803d;">Đáp án đúng:</b>
                        <select class="soide-latex-input" style="width:65px; padding:2px 4px; font-size:13.5px !important; min-height:30px;" onchange="updateSoiDeCorrectMC(${qIdx}, this.value)">
                            ${letters.map(L => `<option value="${L}" ${L === currentCorrect ? 'selected' : ''}>${L}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else if (q.type === "true_false") {
                specificHtml = `
                    <div class="soide-textarea-label">Các mệnh đề Đúng / Sai (a, b, c, d):</div>
                    <table class="soide-tf-editor-table">
                        ${(q.statements || []).map((st, sIdx) => {
                            const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                            return `
                            <tr>
                                <td width="25" align="center"><b>${st.id})</b></td>
                                <td><textarea class="soide-latex-input" rows="1" style="padding:3px 6px; font-size:14px !important; min-height:32px;" oninput="autoResizeTextarea(this); updateSoiDeStatementText(${qIdx}, ${sIdx}, this.value)">${escapeHtml(st.statement)}</textarea></td>
                                <td width="90" align="center">
                                    <select class="soide-latex-input" style="padding:2px 4px; font-size:13px !important; min-height:30px;" onchange="updateSoiDeStatementCorrect(${qIdx}, ${sIdx}, this.value)">
                                        <option value="Đúng" ${isTrue ? 'selected' : ''}>🟢 Đúng</option>
                                        <option value="Sai" ${!isTrue ? 'selected' : ''}>🔴 Sai</option>
                                    </select>
                                </td>
                            </tr>`;
                        }).join('')}
                    </table>
                `;
            } else {
                specificHtml = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <b style="font-size:12px; color:#0d9488;">Đáp số chính xác:</b>
                        <input type="text" class="soide-latex-input" style="width:180px; padding:3px 6px; min-height:32px;" value="${escapeHtmlForAttr(q.correctAnswer || '')}" oninput="updateSoiDeShortAnswer(${qIdx}, this.value)">
                    </div>
                `;
            }

            cardBodyHtml = `
                <div>
                    <div class="soide-textarea-label">
                        <span>Nội dung câu hỏi (LaTeX $...$):</span>
                    </div>
                    <textarea class="soide-latex-input" rows="1" oninput="autoResizeTextarea(this); updateSoiDeQuestionText(${qIdx}, this.value)">${escapeHtml(q.question || "")}</textarea>
                </div>

                ${specificHtml}

                <div>
                    <div class="soide-textarea-label">Lời giải chi tiết:</div>
                    <textarea class="soide-latex-input" rows="1" oninput="autoResizeTextarea(this); updateSoiDeExplanation(${qIdx}, this.value)">${escapeHtml(q.explanation || "")}</textarea>
                </div>
            `;
        }

        card.innerHTML = `
            <!-- 2 VÙNG PASTE -->
            <div class="soide-paste-zones-row">
                <div class="soide-paste-box zone-overwrite" id="paste-zone-overwrite-${qIdx}" tabindex="0"
                     onclick="handlePasteZoneClick(${qIdx}, 'overwrite')"
                     onpaste="handlePasteOnQuestion(event, ${qIdx}, 'overwrite')"
                     title="Click vào đây rồi ấn Ctrl+V để mở mã thô và dán đè câu này">
                    <span>📋</span>
                    <span>Click & ấn <b>Ctrl+V</b> để <b>paste đè</b></span>
                </div>
                <div class="soide-paste-box zone-insert" id="paste-zone-insert-${qIdx}" tabindex="0"
                     onclick="handlePasteZoneClick(${qIdx}, 'insert')"
                     onpaste="handlePasteOnQuestion(event, ${qIdx}, 'insert')"
                     title="Click vào đây rồi ấn Ctrl+V để mở mã thô và tự động xếp vào cuối phần tương ứng">
                    <span>➕</span>
                    <span>Click & ấn <b>Ctrl+V</b> để <b>paste thêm mới</b></span>
                </div>
            </div>

            <!-- HEADER CÂU HỎI -->
            <div class="soide-qcard-head">
                <div class="soide-qcard-num" style="color:${palette.text};">
                    <span>Câu ${qIdx + 1}</span>
                    <span style="font-size:11px; opacity:0.85; font-weight:700;">(ID: ${q.id})</span>
                </div>
                <div class="soide-head-actions">
                    <button type="button" class="btn-soide-mini btn-soide-raw-toggle" onclick="toggleCardRawBox(${q.id})" title="Chuyển đổi giữa chế độ Form thẻ và Mã nguồn thô của câu này">
                        ${isRawEditing ? '👁️ Xem Form' : '💻 Mã thô'}
                    </button>

                    <select class="soide-part-select-mini" onchange="changeSoiDeQuestionType(${qIdx}, this.value)" title="Chuyển câu này sang phần khác">
                        <option value="multiple_choice" ${currentPartType === 'multiple_choice' ? 'selected' : ''}>Phần I (Trắc nghiệm)</option>
                        <option value="true_false" ${currentPartType === 'true_false' ? 'selected' : ''}>Phần II (Đúng/Sai)</option>
                        <option value="short_answer" ${currentPartType === 'short_answer' ? 'selected' : ''}>Phần III (Trả lời ngắn)</option>
                        <option value="part4" ${currentPartType === 'part4' ? 'selected' : ''}>Phần IV (Tự luận ngắn)</option>
                    </select>

                    <button type="button" class="btn-soide-mini btn-soide-add-inline" onclick="insertQuestionAfter(${qIdx})" title="Thêm ngay 1 câu hỏi mới liền kề">
                        ➕ Thêm
                    </button>
                    <button type="button" class="btn-soide-mini btn-soide-del-inline" onclick="deleteQuestionFromSoiDe(${qIdx})" title="Xóa câu hỏi này">
                        🗑️ Xóa
                    </button>
                </div>
            </div>

            ${cardBodyHtml}
        `;

        cardsContainer.appendChild(card);
    });

    updateRawTextFromState();
    setTimeout(autoResizeAllTextareas, 20);
    setupRightToLeftScrollSync();
}

// 11. CÁC HÀM CẬP NHẬT DỮ LIỆU
function updateSoiDeQuestionText(idx, val) {
    if (soiDeState.examData.questions[idx]) {
        soiDeState.examData.questions[idx].question = val;
        debouncedLivePreview();
    }
}

function updateSoiDeOption(qIdx, optIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q && Array.isArray(q.options)) {
        q.options[optIdx] = val;
        debouncedLivePreview();
    }
}

function updateSoiDeCorrectMC(qIdx, letter) {
    const q = soiDeState.examData.questions[qIdx];
    if (q) {
        const letters = ["A", "B", "C", "D"];
        q.correct = letters.indexOf(letter);
        debouncedLivePreview();
    }
}

function updateSoiDeStatementText(qIdx, sIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q && q.statements && q.statements[sIdx]) {
        q.statements[sIdx].statement = val;
        debouncedLivePreview();
    }
}

function updateSoiDeStatementCorrect(qIdx, sIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q && q.statements && q.statements[sIdx]) {
        q.statements[sIdx].correct = (val === "Đúng");
        debouncedLivePreview();
    }
}

function updateSoiDeShortAnswer(qIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q) {
        q.correctAnswer = val;
        debouncedLivePreview();
    }
}

function updateSoiDeExplanation(qIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q) {
        q.explanation = val;
        debouncedLivePreview();
    }
}

function changeSoiDeQuestionType(qIdx, newType) {
    const q = soiDeState.examData.questions[qIdx];
    if (!q) return;

    if (newType === "multiple_choice") {
        q.type = "multiple_choice";
        delete q.part;
        if (!q.options || q.options.length < 4) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
        if (q.correct === undefined) q.correct = 0;
    } else if (newType === "true_false") {
        q.type = "true_false";
        delete q.part;
        if (!q.statements || q.statements.length < 4) {
            q.statements = [
                { id: "a", statement: "Mệnh đề a", correct: true },
                { id: "b", statement: "Mệnh đề b", correct: false },
                { id: "c", statement: "Mệnh đề c", correct: true },
                { id: "d", statement: "Mệnh đề d", correct: false }
            ];
        }
    } else if (newType === "short_answer") {
        q.type = "short_answer";
        delete q.part;
        if (!q.correctAnswer) q.correctAnswer = "0";
    } else if (newType === "part4") {
        q.type = "short_answer";
        q.part = 4;
        if (!q.correctAnswer) q.correctAnswer = "0";
    }

    // Tự động sắp xếp lại đề để câu này rơi về cuối của phần mới vừa chọn
    soiDeState.examData.questions = reorganizeAllQuestionsByParts(soiDeState.examData.questions);
    renderSoiDeBothSides();
    showSoiDeToast(`✅ Đã chuyển câu sang phần mới và tự động xếp đúng vị trí!`);
}

function insertQuestionAfter(qIdx) {
    const questions = soiDeState.examData.questions || [];
    const maxId = questions.length > 0 ? Math.max(...questions.map(q => parseInt(q.id, 10) || 0)) : 0;
    const newId = maxId + 1;

    const currentQ = questions[qIdx];
    const currentPart = currentQ ? getQuestionPartType(currentQ) : 1;

    let newQuestion = {
        id: newId,
        type: "multiple_choice",
        question: `Câu hỏi mới: Cho hàm số $y = f(x)$...`,
        options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        correct: 0,
        explanation: "Lời giải chi tiết câu hỏi này..."
    };

    if (currentPart === 2) {
        newQuestion = {
            id: newId,
            type: "true_false",
            question: "Xét tính đúng sai của các mệnh đề sau:",
            statements: [
                { id: "a", statement: "Mệnh đề a", correct: true },
                { id: "b", statement: "Mệnh đề b", correct: false },
                { id: "c", statement: "Mệnh đề c", correct: true },
                { id: "d", statement: "Mệnh đề d", correct: false }
            ],
            explanation: ""
        };
    } else if (currentPart === 3) {
        newQuestion = {
            id: newId,
            type: "short_answer",
            question: "Tìm giá trị của biểu thức sau:",
            correctAnswer: "0",
            explanation: ""
        };
    } else if (currentPart === 4) {
        newQuestion = {
            id: newId,
            type: "short_answer",
            part: 4,
            question: "PHẦN IV. Tự luận ngắn:",
            correctAnswer: "0",
            explanation: ""
        };
    }

    // Tự động xếp vào cuối phần tương ứng
    insertQuestionsOrganizedByPart([newQuestion]);
    renderSoiDeBothSides();

    setTimeout(() => {
        autoResizeAllTextareas();
        scrollToLeftPreviewQuestion(newId, true);
        const newCard = document.getElementById(`soide-qcard-${newId}`);
        if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
}

function addNewQuestionToSoiDe() {
    const questions = soiDeState.examData.questions || [];
    const maxId = questions.length > 0 ? Math.max(...questions.map(q => parseInt(q.id, 10) || 0)) : 0;
    const newId = maxId + 1;

    const newQ = {
        id: newId,
        type: "multiple_choice",
        question: "Câu hỏi trắc nghiệm mới...",
        options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        correct: 0,
        explanation: ""
    };

    insertQuestionsOrganizedByPart([newQ]);
    renderSoiDeBothSides();

    setTimeout(() => {
        autoResizeAllTextareas();
        scrollToLeftPreviewQuestion(newId, true);
        const newCard = document.getElementById(`soide-qcard-${newId}`);
        if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showSoiDeToast(`➕ Đã thêm câu mới vào cuối Phần I!`);
    }, 80);
}

function deleteQuestionFromSoiDe(qIdx) {
    const qNum = qIdx + 1;
    if (!confirm(`⚠️ Bạn có chắc chắn muốn XÓA Câu ${qNum} không?`)) return;

    soiDeState.examData.questions.splice(qIdx, 1);
    renderSoiDeBothSides();
}

function deleteQuestionFromLeftPreview(qId) {
    const qIdx = soiDeState.examData.questions.findIndex(q => String(q.id) === String(qId));
    if (qIdx !== -1) deleteQuestionFromSoiDe(qIdx);
}

// 12. CHUYỂN CHẾ ĐỘ BIÊN SOẠN & ĐỊNH DẠNG MÃ NGUỒN THÔ NGĂN CÁCH //-----------
function setSoiDeEditorMode(mode) {
    soiDeState.editorMode = mode;
    const btnCards = document.getElementById("btn-mode-cards");
    const btnRaw = document.getElementById("btn-mode-raw");
    const cardsBox = document.getElementById("soide-cards-container");
    const rawBox = document.getElementById("soide-raw-container");

    if (mode === 'cards') {
        if (btnCards) btnCards.classList.add("active");
        if (btnRaw) btnRaw.classList.remove("active");
        if (cardsBox) cardsBox.style.display = "flex";
        if (rawBox) rawBox.style.display = "none";
        renderSoiDeRightEditor();
    } else {
        if (btnCards) btnCards.classList.remove("active");
        if (btnRaw) btnRaw.classList.add("active");
        if (cardsBox) cardsBox.style.display = "none";
        if (rawBox) rawBox.style.display = "flex";
        updateRawTextFromState();
    }
}

// TẠO CHUỖI MÃ NGUỒN THÔ VỚI CÁC DẢI //----------- NGĂN CÁCH TỪNG CÂU
function updateRawTextFromState() {
    const rawEditor = document.getElementById("soide-raw-editor");
    if (!rawEditor) return;

    const data = soiDeState.examData;
    const questions = data.questions || [];

    let scriptOutput = `const examData = {\n`;
    scriptOutput += `  title: ${JSON.stringify(data.title || "ĐỀ THI")},\n`;
    scriptOutput += `  maDe: ${JSON.stringify(data.maDe || "101")},\n`;
    scriptOutput += `  timeLimitMinutes: ${parseInt(data.timeLimitMinutes, 10) || 90},\n`;
    scriptOutput += `  images: ${JSON.stringify(data.images || {}, null, 4)},\n`;
    scriptOutput += `  questions: [\n`;

    questions.forEach((q, idx) => {
        const qJson = JSON.stringify(q, null, 4);
        const indentedQJson = qJson.split('\n').map(line => '    ' + line).join('\n');
        scriptOutput += `    //---------------------------------------- Câu ${idx + 1}\n`;
        scriptOutput += `${indentedQJson}${idx < questions.length - 1 ? ',' : ''}\n`;
    });

    scriptOutput += `    //---------------------------------------- HẾT ĐỀ\n`;
    scriptOutput += `  ]\n};`;

    rawEditor.value = scriptOutput;
}

function handleSoiDeRawInput(text) {
    debouncedFunction(() => {
        try {
            const parsed = robustParseExamScriptOrJson(text);
            if (parsed && Array.isArray(parsed.questions)) {
                soiDeState.examData = {
                    ...parsed,
                    questions: reorganizeAllQuestionsByParts(parsed.questions)
                };
                setValidationStatus(true, "✅ Cú pháp mã nguồn hợp lệ (Đã xếp 4 phần)!");
                renderSoiDeLeftLivePreview();
            } else if (Array.isArray(parsed)) {
                soiDeState.examData.questions = reorganizeAllQuestionsByParts(parsed);
                setValidationStatus(true, "✅ Cú pháp mảng câu hỏi hợp lệ (Đã xếp 4 phần)!");
                renderSoiDeLeftLivePreview();
            } else {
                setValidationStatus(false, "⚠️ Cần có biến examData chứa trường questions!");
            }
        } catch(e) {
            setValidationStatus(false, "❌ Lỗi cú pháp: " + e.message);
        }
    }, 400);
}

function debouncedLivePreview() {
    debouncedFunction(() => {
        renderSoiDeLeftLivePreview();
        updateRawTextFromState();
    }, 250);
}

function debouncedFunction(fn, delay = 250) {
    if (soiDeState.debounceTimer) clearTimeout(soiDeState.debounceTimer);
    soiDeState.debounceTimer = setTimeout(fn, delay);
}

// 13. KIỂM TRA LỖI CÚ PHÁP
function validateExamSyntax(questions) {
    const errors = [];
    if (!Array.isArray(questions) || questions.length === 0) {
        errors.push("Đề thi chưa có câu hỏi nào!");
        return errors;
    }

    questions.forEach((q, idx) => {
        const qNum = idx + 1;
        if (!q.question || !q.question.trim()) {
            errors.push(`Câu ${qNum}: Nội dung câu hỏi đang để trống!`);
        } else {
            const dollarMatches = q.question.match(/(^|[^\\])\$/g);
            if (dollarMatches && dollarMatches.length % 2 !== 0) {
                errors.push(`Câu ${qNum}: Dấu công thức toán '$' chưa đóng mở cân bằng!`);
            }
        }

        if (q.type === "multiple_choice") {
            if (!Array.isArray(q.options) || q.options.length < 2) {
                errors.push(`Câu ${qNum}: Cần có ít nhất 2 phương án lựa chọn!`);
            }
        } else if (q.type === "true_false") {
            if (!Array.isArray(q.statements) || q.statements.length === 0) {
                errors.push(`Câu ${qNum}: Thiếu danh sách mệnh đề đúng sai!`);
            }
        }
    });

    return errors;
}

function setValidationStatus(isValid, msg) {
    const alertBox = document.getElementById("soide-alert-box");
    if (!alertBox) return;
    if (isValid) {
        alertBox.className = "soide-alert-box is-valid";
        alertBox.innerText = msg || "✅ Cú pháp & công thức hợp lệ";
    } else {
        alertBox.className = "soide-alert-box has-errors";
        alertBox.innerText = msg;
    }
}

// 14. RENDER CỘT TRÁI: LIVE PREVIEW
function renderSoiDeLeftLivePreview() {
    const previewContainer = document.getElementById("soide-live-preview-content");
    const countEl = document.getElementById("soide-live-qcount");
    if (!previewContainer) return;

    const questions = soiDeState.examData.questions || [];
    if (countEl) countEl.innerText = questions.length;

    const errors = validateExamSyntax(questions);
    if (errors.length > 0) {
        setValidationStatus(false, `⚠️ Có ${errors.length} cảnh báo: ${errors[0]}`);
    } else {
        setValidationStatus(true, "✅ Cú pháp & công thức hợp lệ");
    }

    if (questions.length === 0) {
        previewContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b; font-weight:700;">Chưa có câu hỏi nào. Hãy upload file hoặc bấm [➕ Thêm câu mới] bên phải!</div>`;
        return;
    }

    let html = "";
    const imageMap = soiDeState.examData.images || {};
    const letters = ["A", "B", "C", "D"];

    questions.forEach((q, qIdx) => {
        const displayIndex = qIdx + 1;
        const qId = q.id;
        const palette = SOI_DE_THEME_PALETTES[qIdx % SOI_DE_THEME_PALETTES.length];

        let currentPartType = "multiple_choice";
        if (q.part === 4 || q.type === 'essay' || q.type === 'part4') currentPartType = "part4";
        else if (q.type === 'true_false') currentPartType = "true_false";
        else if (q.type === 'short_answer') currentPartType = "short_answer";

        let imgUrl = "";
        if (q.imageUrl && q.imageUrl.trim()) imgUrl = q.imageUrl.trim();
        else if (q.imageKey && imageMap[q.imageKey]) imgUrl = imageMap[q.imageKey].trim();
        else if (imageMap[`img_q_${qId}`]) imgUrl = imageMap[`img_q_${qId}`].trim();

        const imgHtml = imgUrl ? `
            <div class="quiz-img-container" id="soide-img-box-${qId}">
                <div class="quiz-img-wrapper" style="position:relative; display:inline-block;">
                    <img src="${imgUrl}" class="quiz-img" style="max-height:260px;" alt="Hình câu ${displayIndex}">
                </div>
            </div>` : `<div class="quiz-img-container" id="soide-img-box-${qId}" style="display:none;"></div>`;

        const imgKey = q.imageKey || `img_q_${qId}`;
        const uploaderHtml = `
            <div class="admin-img-uploader-zone" id="zone-soide-${qId}" tabindex="0" title="Click vào đây và bấm Ctrl+V để dán ảnh chụp màn hình Snipping Tool" style="margin: 4px 0 8px 0; padding: 5px 8px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                <div class="admin-uploader-btn-group">
                    <button type="button" class="btn-admin-paste-img" onclick="triggerSoiDePastePrompt(${qId}, '${imgKey}')">
                        📋 Dán ảnh (Ctrl+V)
                    </button>
                    <button type="button" class="btn-admin-file-img" onclick="document.getElementById('file-soide-${qId}').click()">
                        📁 Tệp ảnh
                    </button>
                    ${imgUrl ? `
                    <button type="button" class="btn-admin-del-img" onclick="deleteSoiDeQuestionImage(${qId}, '${imgKey}')">
                        🗑️ Xóa ảnh
                    </button>` : ''}
                    <input type="file" id="file-soide-${qId}" accept="image/*" style="display:none;" onchange="handleSoiDeQuestionImageSelected(this, ${qId}, '${imgKey}')">
                </div>
                <span class="admin-uploader-status" id="status-soide-${qId}"></span>
            </div>
        `;

        let bodyHtml = "";

        if (q.type === "multiple_choice" && !q.part) {
            const correctLetter = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").toUpperCase();
            const opts = q.options || [];

            const maxLen = opts.reduce((max, opt) => Math.max(max, String(opt || "").length), 0);
            let layoutClass = "opt-grid-4";
            if (maxLen > 55) layoutClass = "opt-grid-1";
            else if (maxLen > 22) layoutClass = "opt-grid-2";

            bodyHtml = `
                <div class="options-list ${layoutClass}">
                    ${opts.map((opt, oIdx) => {
                        const L = letters[oIdx];
                        const isCorrect = (L === correctLetter);
                        return `
                            <div class="opt-label ${isCorrect ? 'selected' : ''}" style="cursor:default; padding: 6px 9px;">
                                <span class="opt-circle" style="width:23px; height:23px; font-size:0.85rem;">${L}</span>
                                <span class="opt-text">${opt} ${isCorrect ? '<b style="color:#16a34a; margin-left:4px;">✓</b>' : ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (q.type === "true_false") {
            bodyHtml = `
                <div class="tf-table-box" style="margin-top:4px;">
                    <table class="tf-table">
                        <thead>
                            <tr><th>Mệnh đề</th><th width="75" style="text-align:center;">Đáp án</th></tr>
                        </thead>
                        <tbody>
                            ${(q.statements || []).map(st => {
                                const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                                return `
                                    <tr>
                                        <td><b>${st.id})</b> ${st.statement}</td>
                                        <td align="center" style="font-weight:900; color:${isTrue ? '#16a34a' : '#dc2626'};">
                                            ${isTrue ? '🟢 Đúng' : '🔴 Sai'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            bodyHtml = `
                <div style="background:#f0fdf4; border:1px solid #86efac; padding:6px 10px; border-radius:7px; font-weight:800; color:#166534; margin-top:4px; display:inline-block;">
                    🎯 Đáp số: <span style="font-size:1.1em; color:#0f172a;">${q.correctAnswer || '(Chưa nhập)'}</span>
                </div>
            `;
        }

        const explainHtml = q.explanation ? `
            <div class="explanation-box" style="margin-top:6px; padding:6px 10px; font-size:0.92rem;">
                💡 <b>Lời giải chi tiết:</b> ${q.explanation}
            </div>` : "";

        html += `
            <div class="soide-preview-card" id="soide-preview-card-${qId}" data-qid="${qId}" style="background:${palette.bg}; border:1.8px solid ${palette.border};">
                <div class="soide-preview-head-row">
                    <div class="soide-preview-title-badge" style="color:${palette.text};">
                        <b>Câu ${displayIndex}</b> <span style="font-size:11.5px; opacity:0.85; font-weight:700;">(ID: ${q.id})</span>
                    </div>

                    <div class="soide-head-actions">
                        <select class="soide-part-select-mini" onchange="changeSoiDeQuestionType(${qIdx}, this.value)" title="Chuyển câu này sang phần khác">
                            <option value="multiple_choice" ${currentPartType === 'multiple_choice' ? 'selected' : ''}>Phần I (Trắc nghiệm)</option>
                            <option value="true_false" ${currentPartType === 'true_false' ? 'selected' : ''}>Phần II (Đúng/Sai)</option>
                            <option value="short_answer" ${currentPartType === 'short_answer' ? 'selected' : ''}>Phần III (Trả lời ngắn)</option>
                            <option value="part4" ${currentPartType === 'part4' ? 'selected' : ''}>Phần IV (Tự luận ngắn)</option>
                        </select>

                        <button type="button" class="btn-soide-mini btn-soide-add-inline" onclick="insertQuestionAfter(${qIdx})" title="Thêm câu hỏi mới liền kề">
                            ➕ Thêm
                        </button>
                        <button type="button" class="btn-soide-mini btn-soide-del-inline" onclick="deleteQuestionFromLeftPreview(${qId})" title="Xóa câu ${displayIndex}">
                            🗑️ Xóa
                        </button>
                    </div>
                </div>

                <div class="q-content-text" style="margin-bottom:6px;">${formatQuestionText(q.question || "")}</div>

                ${uploaderHtml}
                ${imgHtml}
                ${bodyHtml}
                ${explainHtml}
            </div>
        `;
    });

    previewContainer.innerHTML = html;

    setupSoiDePasteListeners();

    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([previewContainer]).catch(() => {});
    }
}

// 15. DÁN ẢNH SNIPPING TOOL
function setupSoiDePasteListeners() {
    document.querySelectorAll('.soide-left-pane .soide-preview-card').forEach(card => {
        card.addEventListener('paste', function(e) {
            const qId = this.dataset.qid;
            const q = soiDeState.examData.questions.find(item => String(item.id) === String(qId));
            const imgKey = (q && q.imageKey) || `img_q_${qId}`;
            const clipboardItems = (e.clipboardData || window.clipboardData)?.items;
            if (!clipboardItems) return;

            for (let i = 0; i < clipboardItems.length; i++) {
                const item = clipboardItems[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    uploadSoiDeImage(blob, qId, imgKey);
                    break;
                }
            }
        });
    });
}

function triggerSoiDePastePrompt(qId, imgKey) {
    const zone = document.getElementById(`zone-soide-${qId}`);
    if (zone) zone.focus();
    alert(`📋 Em vừa quét ảnh bằng Snipping Tool?\nHãy click chuột vào ô này rồi nhấn Ctrl + V để dán ảnh ngay lập tức!`);
}

function handleSoiDeQuestionImageSelected(input, qId, imgKey) {
    if (input.files && input.files[0]) uploadSoiDeImage(input.files[0], qId, imgKey);
}

async function uploadSoiDeImage(file, qId, imgKey) {
    if (!file) return;
    const statusEl = document.getElementById(`status-soide-${qId}`);
    if (statusEl) {
        statusEl.className = "admin-uploader-status loading";
        statusEl.innerText = "⏳ Đang tải ảnh...";
    }

    try {
        let directUrl = "";
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const b64 = await base64Promise;

        if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_API_KEY")) {
            const formData = new FormData();
            formData.append("image", b64);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const json = await res.json();
            if (json && json.success && json.data) {
                directUrl = json.data.display_url || json.data.url;
            }
        }

        if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL) {
            const driveRes = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ filename: `soide_cau_${qId}_${Date.now()}.png`, mimeType: file.type || "image/png", base64: b64 })
            }).then(r => r.json());
            if (driveRes && driveRes.fileUrl) {
                directUrl = (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(driveRes.fileUrl) : driveRes.fileUrl;
            }
        }

        if (!directUrl) directUrl = `data:${file.type || "image/png"};base64,${b64}`;

        if (!soiDeState.examData.images) soiDeState.examData.images = {};
        soiDeState.examData.images[imgKey] = directUrl;
        const targetQ = soiDeState.examData.questions.find(item => String(item.id) === String(qId));
        if (targetQ) targetQ.imageUrl = directUrl;

        renderSoiDeBothSides();

        if (statusEl) {
            statusEl.className = "admin-uploader-status success";
            statusEl.innerText = "✅ Đã gán ảnh!";
            setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 3000);
        }
    } catch(err) {
        if (statusEl) {
            statusEl.className = "admin-uploader-status error";
            statusEl.innerText = "❌ Lỗi: " + err.message;
        }
        alert("Lỗi tải ảnh: " + err.message);
    }
}

function deleteSoiDeQuestionImage(qId, imgKey) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA ảnh của câu này không?")) return;
    if (soiDeState.examData.images) {
        delete soiDeState.examData.images[imgKey];
        delete soiDeState.examData.images[`img_q_${qId}`];
    }
    const targetQ = soiDeState.examData.questions.find(item => String(item.id) === String(qId));
    if (targetQ) targetQ.imageUrl = "";

    renderSoiDeBothSides();
}

// 16. XUẤT FILE JSON ĐỀ THI
function downloadSoiDeJson() {
    try {
        const jsonStr = JSON.stringify(soiDeState.examData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
        const safeTitle = (soiDeState.examData.title || "De_Thi").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
        const fileName = `${safeTitle}_Made_${soiDeState.examData.maDe || '101'}.json`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch(e) {
        alert("❌ Lỗi xuất file JSON: " + e.message);
    }
}

// =========================================================================
// 17. CHỨC NĂNG TẢI ĐỀ LÊN 8 LỚP
// =========================================================================

function toggleSoiDeClassDropdown(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const drop = document.getElementById("soide-class-dropdown");
    if (!drop) return;
    drop.classList.toggle("show");
}

function toggleAllSoiDeClasses(checkAll) {
    document.querySelectorAll('input[name="soide-target-class"]').forEach(cb => {
        cb.checked = checkAll;
        const parent = cb.closest('.soide-class-chk-item');
        if (parent) parent.classList.toggle('checked', checkAll);
    });
}

function handleSoiDeClassCheckChange(cb) {
    const parent = cb.closest('.soide-class-chk-item');
    if (parent) parent.classList.toggle('checked', cb.checked);
}

async function submitExamToSelectedClasses() {
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="soide-target-class"]:checked'));
    const selectedClasses = checkedBoxes.map(cb => cb.value);

    if (selectedClasses.length === 0) {
        alert("⚠️ Vui lòng tích chọn ít nhất 1 lớp để tải đề lên!");
        return;
    }

    const examData = soiDeState.examData;
    if (!examData || !Array.isArray(examData.questions) || examData.questions.length === 0) {
        alert("⚠️ Đề thi hiện chưa có câu hỏi nào để tải lên!");
        return;
    }

    const btn = document.getElementById("btn-submit-upload-classes");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang tải lên Supabase..."; }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) {
        alert("❌ Không tìm thấy Supabase Client kết nối máy chủ!");
        if (btn) { btn.disabled = false; btn.innerText = "🚀 Xác nhận đăng đề"; }
        return;
    }

    try {
        const quizId = "quiz_" + Date.now();
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const finalTimeLimit = parseInt(examData.timeLimitMinutes, 10) || 90;
        const examTitle = examData.title || `ĐỀ THI ${dateStr}`;
        const maDe = examData.maDe || "101";

        // Đảm bảo các câu hỏi đã được sắp xếp chuẩn 4 phần trước khi gửi lên máy chủ
        const cleanQuestions = reorganizeAllQuestionsByParts(examData.questions);

        // 1. Lưu vào bảng quizzes
        const { error: qErr } = await client.from('quizzes').insert([{
            id: quizId,
            title: examTitle,
            made: maDe,
            time_limit_minutes: finalTimeLimit,
            exam_start_time: null,
            exam_end_time: null,
            scoring_config: { mode: 'option1' },
            images: examData.images || {},
            questions: cleanQuestions
        }]);

        if (qErr) throw qErr;

        // 2. Lưu liên kết cho từng lớp được chọn vào custom_links
        const defaultAvatar = (typeof PRESET_AVATARS !== 'undefined' && PRESET_AVATARS[0]) 
            ? PRESET_AVATARS[0] 
            : "https://i.ibb.co/HTPxzDtT/khung-long-bao-chua.jpg";

        const linkRows = selectedClasses.map(cat => ({
            id: quizId,
            category_id: cat,
            title: examTitle,
            date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT",
            is_hot: true,
            is_doc: false,
            avatar: defaultAvatar,
            timestamp: Date.now(),
            is_shuffled: true,
            allow_free: true,
            time_limit_minutes: finalTimeLimit,
            scoring_config: { mode: 'option1' }
        }));

        const { error: cErr } = await client.from('custom_links').insert(linkRows);
        if (cErr) throw cErr;

        const classNames = selectedClasses.map(id => {
            const f = SOI_DE_AVAILABLE_CLASSES.find(c => c.id === id);
            return f ? f.name : id;
        }).join(', ');

        alert(`🎉 ĐÃ ĐĂNG ĐỀ THI LÊN ${selectedClasses.length} LỚP THÀNH CÔNG!\n\n📑 Đề: "${examTitle}" (${finalTimeLimit} phút)\n🏫 Danh sách lớp: ${classNames}`);
        
        const drop = document.getElementById("soide-class-dropdown");
        if (drop) drop.classList.remove("show");

        window.location.reload();
    } catch(err) {
        alert("❌ Lỗi khi đăng đề lên lớp: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "🚀 Xác nhận đăng đề"; }
    }
}

// CÁC HÀM TIỆN ÍCH TRÁNH XSS
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeHtmlForAttr(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ĐĂNG KÝ TOÀN CỤC CÁC HÀM
window.openSoiDeModal = openSoiDeModal;
window.closeSoiDeModal = closeSoiDeModal;
window.ensureSoiDeModalInDOM = ensureSoiDeModalInDOM;
window.autoResizeTextarea = autoResizeTextarea;
window.autoResizeAllTextareas = autoResizeAllTextareas;
window.handlePasteZoneClick = handlePasteZoneClick;
window.handlePasteOnQuestion = handlePasteOnQuestion;
window.toggleCardRawBox = toggleCardRawBox;
window.applyCardRawInput = applyCardRawInput;
window.scrollToLeftPreviewQuestion = scrollToLeftPreviewQuestion;
window.triggerSoiDeUpload = triggerSoiDeUpload;
window.handleSoiDeFileSelected = handleSoiDeFileSelected;
window.addNewQuestionToSoiDe = addNewQuestionToSoiDe;
window.insertQuestionAfter = insertQuestionAfter;
window.deleteQuestionFromSoiDe = deleteQuestionFromSoiDe;
window.deleteQuestionFromLeftPreview = deleteQuestionFromLeftPreview;
window.downloadSoiDeJson = downloadSoiDeJson;
window.setSoiDeEditorMode = setSoiDeEditorMode;
window.handleSoiDeRawInput = handleSoiDeRawInput;
window.updateSoiDeMeta = updateSoiDeMeta;
window.updateSoiDeQuestionText = updateSoiDeQuestionText;
window.updateSoiDeOption = updateSoiDeOption;
window.updateSoiDeCorrectMC = updateSoiDeCorrectMC;
window.updateSoiDeStatementText = updateSoiDeStatementText;
window.updateSoiDeStatementCorrect = updateSoiDeStatementCorrect;
window.updateSoiDeShortAnswer = updateSoiDeShortAnswer;
window.updateSoiDeExplanation = updateSoiDeExplanation;
window.changeSoiDeQuestionType = changeSoiDeQuestionType;
window.triggerSoiDePastePrompt = triggerSoiDePastePrompt;
window.handleSoiDeQuestionImageSelected = handleSoiDeQuestionImageSelected;
window.deleteSoiDeQuestionImage = deleteSoiDeQuestionImage;
window.toggleSoiDeClassDropdown = toggleSoiDeClassDropdown;
window.toggleAllSoiDeClasses = toggleAllSoiDeClasses;
window.handleSoiDeClassCheckChange = handleSoiDeClassCheckChange;
window.submitExamToSelectedClasses = submitExamToSelectedClasses;
