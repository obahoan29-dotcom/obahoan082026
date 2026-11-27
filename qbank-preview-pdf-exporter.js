// =========================================================
// FILE: qbank-preview-pdf-exporter.js
// QUẢN LÝ ĐỘC LẬP CHỨC NĂNG XUẤT PDF TRONG MODAL "XEM THỬ ĐỀ":
// 1. MENU XÒE 4 CHẾ ĐỘ XUẤT PDF + CHỌN SỐ TRANG & CỠ CHỮ:
//    (1) Xuất đề PDF (chỉ đề)
//    (2) Đề PDF kèm lời giải & bảng đáp án
//    (3) Xuất PDF đề kèm khoảng trống dưới mỗi câu (dòng kẻ chấm .... hợp lý theo độ khó)
//    (4) Xuất PDF chia 2 cột: Trái 40% Đề | Phải 60% Khoảng trống trình bày (dòng kẻ chấm ....)
// 2. Ô CHỌN "✨ TRANG TRÍ" XÒE RA ĐẦY ĐỦ TÙY CHỌN:
//    - 2 dòng kẻ trang trí trên cùng & dưới cùng mỗi trang
//    - Tên tác giả lề trên & dưới (kèm logo, ô nhập tên, chọn bo viền nhãn)
//    - Bo viền 4 cạnh từng trang
//    - Bo viền luân phiên 3 cạnh (Trang lẻ: Trên-Dưới-Trái | Trang chẵn: Trên-Dưới-Phải)
//    - Chọn 4 kiểu nét viền (Đôi cổ điển, Bo góc thanh lịch, Góc chữ L, Nét đứt), 5 màu, số trang, watermark
//    - Chọn độ rộng 4 lề trang PDF (Trên / Dưới / Trái / Phải theo mm) để giảm lề, mở rộng vùng chữ
// 3. TẶNG MỖI ĐỀ XUẤT RA 1 LOGO SVG NGHỆ THUẬT SINH NGẪU NHIÊN
// 4. PHÂN TRANG TỪNG TỜ A4 THỰC TẾ KHI BẬT TRANG TRÍ & CO GIÃN ĐO TRANG SAU KHI MATHJAX RENDER
// =========================================================

(function initQbankPreviewPdfExporter() {
    if (typeof window === "undefined") return;

    const DEFAULT_FONT_PT = 10.5;
    const DECOR_PREFS_STORAGE_KEY = "qb_pdf_decor_prefs_v1";

    const MARGIN_PRESETS = {
        default: { top: 12, bottom: 12, left: 12, right: 12 },
        compact: { top: 7, bottom: 7, left: 7, right: 7 },
        narrow:  { top: 4, bottom: 4, left: 5, right: 5 },
        ultra:   { top: 2.5, bottom: 2.5, left: 3, right: 3 }
    };

    const DEFAULT_DECOR_PREFS = {
        twoLines: false,
        showAuthor: false,
        authorName: "Thầy Phạm Công Hoan",
        authorWithLogo: true,
        authorBorder: "rounded", // none | rounded | double | pill
        pageBorderMode: "none",  // none | all4 | alt3
        borderStyle: "double",   // double | rounded | corner | dashed
        borderColor: "#1e293b",  // #1e293b | #0369a1 | #0f766e | #6d28d9 | #b91c1c
        marginPreset: "default", // default | compact | narrow | ultra | custom
        marginTop: 12,
        marginBottom: 12,
        marginLeft: 12,
        marginRight: 12,
        showPageNum: true,
        watermark: false
    };

    const DECOR_COLOR_SWATCHES = [
        { hex: "#1e293b", name: "Đen mực in (Sắc nét khi photo)" },
        { hex: "#0369a1", name: "Xanh dương học thuật" },
        { hex: "#0f766e", name: "Xanh ngọc thanh lịch" },
        { hex: "#6d28d9", name: "Tím hoàng gia" },
        { hex: "#b91c1c", name: "Đỏ đô nổi bật" }
    ];

    let _decorPrefs = null;

    function clampMarginMm(val, fallback = 12) {
        const n = parseFloat(String(val ?? "").replace(",", "."));
        if (isNaN(n)) return fallback;
        return Math.round(Math.max(0, Math.min(35, n)) * 10) / 10;
    }

    function hasCustomMarginConfig(prefs) {
        const p = prefs || loadDecorPrefs();
        if (p.marginPreset && p.marginPreset !== "default") return true;
        return (
            clampMarginMm(p.marginTop, 12) !== 12 ||
            clampMarginMm(p.marginBottom, 12) !== 12 ||
            clampMarginMm(p.marginLeft, 12) !== 12 ||
            clampMarginMm(p.marginRight, 12) !== 12
        );
    }

    function loadDecorPrefs() {
        if (_decorPrefs) return _decorPrefs;
        let loaded = { ...DEFAULT_DECOR_PREFS };
        try {
            const raw = localStorage.getItem(DECOR_PREFS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    loaded = { ...DEFAULT_DECOR_PREFS, ...parsed };
                }
            }
        } catch (e) {}
        loaded.marginTop = clampMarginMm(loaded.marginTop, 12);
        loaded.marginBottom = clampMarginMm(loaded.marginBottom, 12);
        loaded.marginLeft = clampMarginMm(loaded.marginLeft, 12);
        loaded.marginRight = clampMarginMm(loaded.marginRight, 12);
        _decorPrefs = loaded;
        return _decorPrefs;
    }

    function saveDecorPrefs(nextPrefs) {
        const merged = { ...DEFAULT_DECOR_PREFS, ...nextPrefs };
        merged.marginTop = clampMarginMm(merged.marginTop, 12);
        merged.marginBottom = clampMarginMm(merged.marginBottom, 12);
        merged.marginLeft = clampMarginMm(merged.marginLeft, 12);
        merged.marginRight = clampMarginMm(merged.marginRight, 12);
        _decorPrefs = merged;
        try {
            localStorage.setItem(DECOR_PREFS_STORAGE_KEY, JSON.stringify(_decorPrefs));
        } catch (e) {}
        updateDecorTriggerSummaryUI();
    }

    // =========================================================================
    // 1. TIÊM CSS CHO MENU XÒE XUẤT PDF & PANEL TRANG TRÍ
    // =========================================================================
    function injectPreviewPdfExporterStyles() {
        const styleId = "qb-preview-pdf-exporter-styles";
        if (document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            .qb-pdf-export-popover {
                display: none;
                position: fixed !important;
                width: 418px;
                max-width: 95vw;
                max-height: 88vh;
                overflow-y: auto;
                background: #ffffff;
                border-radius: 14px;
                border: 1.8px solid #0d9488;
                box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(13, 148, 136, 0.2);
                z-index: 10000095 !important;
                font-family: 'Be Vietnam Pro', sans-serif;
                flex-direction: column;
                animation: popInQbank 0.16s cubic-bezier(0.16, 1, 0.3, 1);
                box-sizing: border-box;
            }
            .qb-pdf-export-popover.show {
                display: flex !important;
            }
            .qb-pdf-pop-head {
                background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
                color: #ffffff;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: 0.2px;
                flex-shrink: 0;
                position: sticky;
                top: 0;
                z-index: 5;
            }
            .qb-pdf-pop-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: #ffffff;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                font-size: 12px;
                font-weight: 900;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .qb-pdf-pop-close:hover { background: #ef4444; }

            .qb-pdf-config-box {
                background: #f0fdfa;
                border-bottom: 1.2px solid #ccfbf1;
                padding: 9px 11px;
                display: flex;
                flex-direction: column;
                gap: 7px;
            }
            .qb-pdf-config-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            .qb-pdf-field label {
                display: block;
                font-size: 10.5px;
                font-weight: 800;
                color: #115e59;
                margin-bottom: 3px;
            }
            .qb-pdf-field select,
            .qb-pdf-field input {
                width: 100%;
                padding: 5px 7px;
                border: 1.3px solid #99f6e4;
                border-radius: 7px;
                background: #ffffff;
                color: #0f172a;
                font-size: 11.5px;
                font-weight: 800;
                font-family: inherit;
                outline: none;
                box-sizing: border-box;
            }
            .qb-pdf-field select:focus,
            .qb-pdf-field input:focus {
                border-color: #0d9488;
                box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.18);
            }

            /* Ô CHỌN TRANG TRÍ */
            .qb-pdf-decor-wrap {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .qb-pdf-decor-trigger {
                width: 100%;
                padding: 6px 9px;
                border-radius: 8px;
                border: 1.4px solid #5eead4;
                background: #ffffff;
                color: #0f766e;
                font-size: 11.5px;
                font-weight: 800;
                font-family: inherit;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                text-align: left;
                transition: all 0.14s ease;
            }
            .qb-pdf-decor-trigger:hover {
                border-color: #0d9488;
                background: #ffffff;
                box-shadow: 0 2px 7px rgba(13, 148, 136, 0.14);
            }
            .qb-pdf-decor-trigger.is-active {
                background: linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%);
                border-color: #0284c7;
                color: #0369a1;
            }
            .qb-pdf-decor-trigger-left {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
                flex: 1;
            }
            .qb-pdf-decor-summary-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: 800;
            }
            .qb-pdf-decor-caret {
                font-size: 10px;
                transition: transform 0.16s ease;
                flex-shrink: 0;
            }
            .qb-pdf-decor-trigger.is-open .qb-pdf-decor-caret {
                transform: rotate(180deg);
            }

            /* PANEL XÒE RA CỦA TRANG TRÍ */
            .qb-pdf-decor-panel {
                display: none;
                background: #ffffff;
                border: 1.4px solid #7dd3fc;
                border-radius: 10px;
                padding: 9px 10px;
                flex-direction: column;
                gap: 7px;
                box-shadow: 0 6px 18px rgba(2, 132, 199, 0.12);
                animation: popInQbank 0.15s ease-out;
            }
            .qb-pdf-decor-panel.show {
                display: flex;
            }
            .qb-decor-check-row {
                display: flex;
                align-items: flex-start;
                gap: 7px;
                font-size: 11.5px;
                font-weight: 700;
                color: #0f172a;
                cursor: pointer;
                user-select: none;
                padding: 4px 6px;
                border-radius: 7px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                transition: background 0.12s, border-color 0.12s;
            }
            .qb-decor-check-row:hover {
                background: #f0f9ff;
                border-color: #bae6fd;
            }
            .qb-decor-check-row input[type="checkbox"],
            .qb-decor-check-row input[type="radio"] {
                width: 15px;
                height: 15px;
                margin-top: 1px;
                accent-color: #0284c7;
                cursor: pointer;
                flex-shrink: 0;
            }
            .qb-decor-sub-box {
                margin-left: 10px;
                padding: 7px 8px;
                background: #f0f9ff;
                border: 1px dashed #7dd3fc;
                border-radius: 8px;
                display: none;
                flex-direction: column;
                gap: 6px;
            }
            .qb-decor-sub-box.show {
                display: flex;
            }
            .qb-decor-sub-box input[type="text"],
            .qb-decor-sub-box select {
                width: 100%;
                padding: 5px 7px;
                border: 1.2px solid #93c5fd;
                border-radius: 6px;
                background: #ffffff;
                font-size: 11.5px;
                font-weight: 700;
                color: #0f172a;
                font-family: inherit;
                outline: none;
                box-sizing: border-box;
            }
            .qb-decor-sub-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
            }
            .qb-decor-section-title {
                font-size: 10.5px;
                font-weight: 900;
                color: #0369a1;
                text-transform: uppercase;
                letter-spacing: 0.25px;
                margin-top: 2px;
            }
            .qb-decor-radio-pills {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 4px;
            }
            .qb-decor-radio-pill {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 5px 4px;
                border-radius: 7px;
                border: 1.3px solid #cbd5e1;
                background: #f8fafc;
                cursor: pointer;
                font-size: 10.5px;
                font-weight: 800;
                color: #334155;
                user-select: none;
                transition: all 0.13s;
                line-height: 1.25;
            }
            .qb-decor-radio-pill input {
                display: none;
            }
            .qb-decor-radio-pill:hover {
                border-color: #38bdf8;
                background: #f0f9ff;
            }
            .qb-decor-radio-pill.active {
                border-color: #0284c7;
                background: #e0f2fe;
                color: #0369a1;
                box-shadow: 0 0 0 1px #0284c7;
            }
            .qb-decor-alt3-hint {
                font-size: 10px;
                font-weight: 700;
                color: #0369a1;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 6px;
                padding: 4px 7px;
                line-height: 1.35;
                display: none;
            }
            .qb-decor-alt3-hint.show {
                display: block;
            }
            .qb-decor-color-row {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .qb-decor-swatch {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid #ffffff;
                box-shadow: 0 0 0 1.5px #cbd5e1;
                cursor: pointer;
                transition: transform 0.13s;
                padding: 0;
            }
            .qb-decor-swatch:hover {
                transform: scale(1.15);
            }
            .qb-decor-swatch.active {
                box-shadow: 0 0 0 2.5px #0f172a;
                transform: scale(1.14);
            }

            /* Ô CHỌN ĐỘ RỘNG 4 LỀ TRANG (MM) */
            .qb-decor-margin-box {
                background: #f8fafc;
                border: 1.2px solid #cbd5e1;
                border-radius: 8px;
                padding: 7px 8px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .qb-decor-margin-top-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
            }
            .qb-decor-margin-top-row select {
                flex: 1;
                padding: 4px 6px;
                border: 1.2px solid #93c5fd;
                border-radius: 6px;
                background: #ffffff;
                font-size: 11px;
                font-weight: 800;
                color: #0f172a;
                font-family: inherit;
                outline: none;
            }
            .qb-decor-margin-top-row select:focus {
                border-color: #0284c7;
            }
            .qb-decor-margin-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 5px;
            }
            .qb-decor-margin-cell {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .qb-decor-margin-cell label {
                font-size: 10px;
                font-weight: 800;
                color: #475569;
                text-align: center;
            }
            .qb-decor-margin-cell input {
                width: 100%;
                padding: 4px 3px;
                border: 1.2px solid #cbd5e1;
                border-radius: 6px;
                background: #ffffff;
                font-size: 11.5px;
                font-weight: 800;
                color: #0f172a;
                text-align: center;
                font-family: inherit;
                outline: none;
                box-sizing: border-box;
            }
            .qb-decor-margin-cell input:focus {
                border-color: #0284c7;
                box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.16);
            }
            .qb-decor-margin-hint {
                font-size: 9.8px;
                font-weight: 600;
                color: #64748b;
                line-height: 1.25;
            }

            .qb-pdf-config-hint-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                font-size: 10px;
                font-weight: 700;
                color: #0f766e;
            }
            .qb-pdf-reset-btn {
                background: #ffffff;
                border: 1px solid #99f6e4;
                color: #0f766e;
                border-radius: 6px;
                padding: 2px 7px;
                font-size: 10px;
                font-weight: 800;
                cursor: pointer;
                font-family: inherit;
                white-space: nowrap;
            }
            .qb-pdf-reset-btn:hover { background: #ccfbf1; }

            .qb-pdf-modes-list {
                padding: 7px;
                display: flex;
                flex-direction: column;
                gap: 5px;
                background: #ffffff;
            }
            .qb-pdf-mode-btn {
                width: 100%;
                text-align: left;
                background: #f8fafc;
                border: 1.3px solid #cbd5e1;
                border-radius: 10px;
                padding: 8px 10px;
                cursor: pointer;
                display: flex;
                align-items: flex-start;
                gap: 9px;
                font-family: inherit;
                transition: all 0.14s ease;
            }
            .qb-pdf-mode-btn:hover {
                background: #f0f9ff;
                border-color: #0284c7;
                transform: translateX(2px);
                box-shadow: 0 3px 10px rgba(2, 132, 199, 0.14);
            }
            .qb-pdf-mode-btn:active { transform: scale(0.985); }
            .qb-pdf-mode-icon {
                font-size: 20px;
                line-height: 1.1;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .qb-pdf-mode-text {
                flex: 1;
                min-width: 0;
            }
            .qb-pdf-mode-text b {
                display: block;
                font-size: 12px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.25;
            }
            .qb-pdf-mode-btn:hover .qb-pdf-mode-text b {
                color: #0369a1;
            }
            .qb-pdf-mode-text span {
                display: block;
                font-size: 10.5px;
                font-weight: 600;
                color: #64748b;
                margin-top: 2px;
                line-height: 1.3;
            }
            .qb-pdf-mode-tag {
                display: inline-block;
                font-size: 9.5px;
                font-weight: 900;
                padding: 1px 6px;
                border-radius: 999px;
                background: #e0f2fe;
                color: #0369a1;
                border: 1px solid #bae6fd;
                margin-left: 4px;
                vertical-align: middle;
            }
            .qb-pdf-mode-tag.is-green {
                background: #dcfce7;
                color: #15803d;
                border-color: #86efac;
            }
            .qb-pdf-mode-tag.is-purple {
                background: #f3e8ff;
                color: #6b21a8;
                border-color: #d8b4fe;
            }
            .qb-pdf-mode-tag.is-amber {
                background: #fef3c7;
                color: #b45309;
                border-color: #fcd34d;
            }
            .btn-qb-preview-pdf-trigger.is-open {
                box-shadow: 0 0 0 2.5px rgba(45, 212, 191, 0.55) !important;
                filter: brightness(1.08);
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // 2. BỘ SINH LOGO SVG NGHỆ THUẬT NGẪU NHIÊN CHO MỖI ĐỀ XUẤT RA
    // =========================================================================
    const LOGO_PALETTES = [
        { name: "Xanh Đại Dương", c1: "#0284c7", c2: "#2563eb", accent: "#facc15", bg: "#eff6ff" },
        { name: "Ngọc Lục Bảo",   c1: "#059669", c2: "#0d9488", accent: "#fde047", bg: "#ecfdf5" },
        { name: "Tím Hoàng Gia",  c1: "#7c3aed", c2: "#4f46e5", accent: "#fbbf24", bg: "#f5f3ff" },
        { name: "Cam Bình Minh",  c1: "#ea580c", c2: "#dc2626", accent: "#fef08a", bg: "#fff7ed" },
        { name: "Hồng Ruby",      c1: "#db2777", c2: "#9333ea", accent: "#fde68a", bg: "#fdf2f8" },
        { name: "Xanh Lam Ngọc",  c1: "#0891b2", c2: "#0369a1", accent: "#fcd34d", bg: "#ecfeff" },
        { name: "Vàng Kim Học Thuật", c1: "#b45309", c2: "#d97706", accent: "#fef08a", bg: "#fffbeb" },
        { name: "Chàm Cổ Điển",   c1: "#1e293b", c2: "#0f766e", accent: "#38bdf8", bg: "#f8fafc" }
    ];

    function buildRandomExamLogosBank() {
        return [
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="92" height="92" rx="22" fill="${p.bg}" stroke="url(#lg_${uid})" stroke-width="4"/>
                    <polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="url(#lg_${uid})" opacity="0.16" stroke="url(#lg_${uid})" stroke-width="3.2" stroke-linejoin="round"/>
                    <polyline points="18,32 50,50 82,32" fill="none" stroke="url(#lg_${uid})" stroke-width="3.2" stroke-linejoin="round"/>
                    <line x1="50" y1="50" x2="50" y2="86" stroke="url(#lg_${uid})" stroke-width="3.2"/>
                    <circle cx="50" cy="14" r="5" fill="${p.accent}" stroke="${p.c2}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="4.5" fill="${p.accent}" stroke="${p.c2}" stroke-width="2"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#lg_${uid})"/>
                    <circle cx="50" cy="50" r="39" fill="none" stroke="${p.accent}" stroke-width="2" stroke-dasharray="4 3"/>
                    <path d="M27,64 C20,52 21,36 30,26 M73,64 C80,52 79,36 70,26" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>
                    <path d="M32,37 L68,37 M41,37 L38,67 M58,37 L58,61 C58,66 64,67 67,63" fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <polygon points="50,11 53,18 60,18 54,22 56,29 50,25 44,29 46,22 40,18 47,18" fill="${p.accent}"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <rect x="5" y="5" width="90" height="90" rx="20" fill="${p.bg}" stroke="url(#lg_${uid})" stroke-width="4"/>
                    <line x1="16" y1="76" x2="84" y2="76" stroke="${p.c2}" stroke-width="2.5" stroke-linecap="round"/>
                    <line x1="50" y1="16" x2="50" y2="84" stroke="${p.c2}" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M22,26 Q50,92 78,26" fill="none" stroke="url(#lg_${uid})" stroke-width="5" stroke-linecap="round"/>
                    <circle cx="50" cy="59" r="5" fill="${p.accent}" stroke="${p.c1}" stroke-width="2.5"/>
                    <circle cx="29" cy="40" r="4" fill="${p.c1}"/>
                    <circle cx="71" cy="40" r="4" fill="${p.c1}"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <path d="M50,6 L88,20 L88,48 C88,71 71,86 50,94 C29,86 12,71 12,48 L12,20 Z" fill="url(#lg_${uid})" stroke="${p.accent}" stroke-width="3"/>
                    <path d="M64,31 L36,31 L54,50 L36,69 L65,69" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="50" cy="17" r="3.5" fill="${p.accent}"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="${p.bg}" stroke="url(#lg_${uid})" stroke-width="4"/>
                    <path d="M18,68 L18,40 Q34,36 50,46 Q66,36 82,40 L82,68 Q66,64 50,74 Q34,64 18,68 Z" fill="#ffffff" stroke="url(#lg_${uid})" stroke-width="3.5" stroke-linejoin="round"/>
                    <line x1="50" y1="46" x2="50" y2="74" stroke="url(#lg_${uid})" stroke-width="3"/>
                    <path d="M50,15 C58,24 60,33 50,39 C40,33 42,24 50,15 Z" fill="${p.accent}" stroke="${p.c1}" stroke-width="2.5"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="44" fill="url(#lg_${uid})"/>
                    <g fill="none" stroke="#ffffff" stroke-width="2.6" opacity="0.92">
                        <ellipse cx="50" cy="50" rx="34" ry="13" transform="rotate(0 50 50)"/>
                        <ellipse cx="50" cy="50" rx="34" ry="13" transform="rotate(60 50 50)"/>
                        <ellipse cx="50" cy="50" rx="34" ry="13" transform="rotate(120 50 50)"/>
                    </g>
                    <circle cx="50" cy="50" r="9" fill="${p.accent}" stroke="#ffffff" stroke-width="2.5"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <polygon points="50,6 92,32 76,84 24,84 8,32" fill="${p.bg}" stroke="url(#lg_${uid})" stroke-width="4" stroke-linejoin="round"/>
                    <polygon points="22,64 26,34 40,48 50,26 60,48 74,34 78,64" fill="url(#lg_${uid})" stroke="${p.c2}" stroke-width="2.5" stroke-linejoin="round"/>
                    <rect x="24" y="68" width="52" height="7" rx="3.5" fill="${p.accent}" stroke="${p.c2}" stroke-width="2"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="44" fill="${p.bg}" stroke="url(#lg_${uid})" stroke-width="4.5"/>
                    <circle cx="50" cy="50" r="35" fill="none" stroke="${p.c1}" stroke-width="1.6" stroke-dasharray="3 3"/>
                    <path d="M58,24 C49,21 49,33 50,50 C51,67 51,79 42,76" fill="none" stroke="url(#lg_${uid})" stroke-width="6.5" stroke-linecap="round"/>
                    <circle cx="62" cy="26" r="4.5" fill="${p.accent}" stroke="${p.c2}" stroke-width="1.8"/>
                    <circle cx="38" cy="74" r="4.5" fill="${p.accent}" stroke="${p.c2}" stroke-width="1.8"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <rect x="5" y="5" width="90" height="90" rx="24" fill="url(#lg_${uid})"/>
                    <path d="M50,14 C65,28 66,52 58,68 L42,68 C34,52 35,28 50,14 Z" fill="#ffffff"/>
                    <circle cx="50" cy="40" r="7" fill="${p.c1}"/>
                    <path d="M40,56 L27,68 L39,69 Z M60,56 L73,68 L61,69 Z" fill="${p.accent}"/>
                    <path d="M45,70 L50,86 L55,70 Z" fill="${p.accent}"/>
                </svg>`,
            (p, uid) => `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="exam-random-logo-svg">
                    <defs>
                        <linearGradient id="lg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${p.c1}"/>
                            <stop offset="100%" stop-color="${p.c2}"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="44" fill="${p.bg}" stroke="url(#lg_${uid})" stroke-width="4"/>
                    <polygon points="50,15 83,74 17,74" fill="url(#lg_${uid})" opacity="0.2" stroke="url(#lg_${uid})" stroke-width="3.5" stroke-linejoin="round"/>
                    <line x1="50" y1="15" x2="50" y2="74" stroke="url(#lg_${uid})" stroke-width="2.5" stroke-dasharray="4 3"/>
                    <ellipse cx="50" cy="74" rx="33" ry="8" fill="none" stroke="${p.c2}" stroke-width="2.5"/>
                    <circle cx="50" cy="48" r="6" fill="${p.accent}" stroke="${p.c2}" stroke-width="2"/>
                </svg>`
        ];
    }

    function generateRandomExamLogoSvg(seedIdx = null, seedPalIdx = null) {
        const templates = buildRandomExamLogosBank();
        const tIdx = (seedIdx !== null && seedIdx >= 0) ? (seedIdx % templates.length) : Math.floor(Math.random() * templates.length);
        const pIdx = (seedPalIdx !== null && seedPalIdx >= 0) ? (seedPalIdx % LOGO_PALETTES.length) : Math.floor(Math.random() * LOGO_PALETTES.length);
        const uid = `${Date.now().toString(36)}_${Math.floor(Math.random() * 99999)}`;
        return {
            svg: templates[tIdx](LOGO_PALETTES[pIdx], uid),
            tIdx,
            pIdx
        };
    }

    // =========================================================================
    // 3. UI MENU XÒE CỦA NÚT "📄 Xuất PDF ▾" & Ô CHỌN "✨ TRANG TRÍ"
    // =========================================================================
    function syncDecorControlsWithPrefs() {
        const prefs = loadDecorPrefs();

        const chkTwoLines = document.getElementById("qb-decor-two-lines");
        const chkAuthor = document.getElementById("qb-decor-show-author");
        const subAuthorBox = document.getElementById("qb-decor-author-sub");
        const inAuthorName = document.getElementById("qb-decor-author-name");
        const chkAuthorLogo = document.getElementById("qb-decor-author-logo");
        const selAuthorBorder = document.getElementById("qb-decor-author-border");
        const selBorderStyle = document.getElementById("qb-decor-border-style");
        const selMarginPreset = document.getElementById("qb-decor-margin-preset");
        const inMarginTop = document.getElementById("qb-decor-margin-top");
        const inMarginBottom = document.getElementById("qb-decor-margin-bottom");
        const inMarginLeft = document.getElementById("qb-decor-margin-left");
        const inMarginRight = document.getElementById("qb-decor-margin-right");
        const chkPageNum = document.getElementById("qb-decor-page-num");
        const chkWatermark = document.getElementById("qb-decor-watermark");
        const alt3Hint = document.getElementById("qb-decor-alt3-hint");
        const styleColorWrap = document.getElementById("qb-decor-style-color-wrap");

        if (chkTwoLines) chkTwoLines.checked = !!prefs.twoLines;
        if (chkAuthor) chkAuthor.checked = !!prefs.showAuthor;
        if (subAuthorBox) subAuthorBox.classList.toggle("show", !!prefs.showAuthor);
        if (inAuthorName) inAuthorName.value = prefs.authorName || "";
        if (chkAuthorLogo) chkAuthorLogo.checked = prefs.authorWithLogo !== false;
        if (selAuthorBorder) selAuthorBorder.value = prefs.authorBorder || "rounded";
        if (selBorderStyle) selBorderStyle.value = prefs.borderStyle || "double";
        if (selMarginPreset) selMarginPreset.value = prefs.marginPreset || "default";
        if (inMarginTop && document.activeElement !== inMarginTop) inMarginTop.value = prefs.marginTop;
        if (inMarginBottom && document.activeElement !== inMarginBottom) inMarginBottom.value = prefs.marginBottom;
        if (inMarginLeft && document.activeElement !== inMarginLeft) inMarginLeft.value = prefs.marginLeft;
        if (inMarginRight && document.activeElement !== inMarginRight) inMarginRight.value = prefs.marginRight;
        if (chkPageNum) chkPageNum.checked = prefs.showPageNum !== false;
        if (chkWatermark) chkWatermark.checked = !!prefs.watermark;

        document.querySelectorAll('input[name="qb-decor-border-mode"]').forEach(r => {
            const matched = (r.value === (prefs.pageBorderMode || "none"));
            r.checked = matched;
            const pill = r.closest(".qb-decor-radio-pill");
            if (pill) pill.classList.toggle("active", matched);
        });

        if (alt3Hint) alt3Hint.classList.toggle("show", prefs.pageBorderMode === "alt3");
        if (styleColorWrap) {
            const needStyle = !!prefs.twoLines || (prefs.pageBorderMode && prefs.pageBorderMode !== "none") || !!prefs.showAuthor;
            styleColorWrap.style.display = needStyle ? "flex" : "none";
        }

        document.querySelectorAll(".qb-decor-swatch").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.color === prefs.borderColor);
        });

        updateDecorTriggerSummaryUI();
    }

    function updateDecorTriggerSummaryUI() {
        const prefs = loadDecorPrefs();
        const trigger = document.getElementById("qb-pdf-decor-trigger");
        const sumEl = document.getElementById("qb-pdf-decor-summary");
        if (!trigger || !sumEl) return;

        const tags = [];
        if (prefs.twoLines) tags.push("2 dòng kẻ");
        if (prefs.showAuthor) tags.push("Tác giả");
        if (prefs.pageBorderMode === "all4") tags.push("Viền 4 cạnh");
        else if (prefs.pageBorderMode === "alt3") tags.push("Viền 3 cạnh luân phiên");
        if (hasCustomMarginConfig(prefs)) {
            const { marginTop: t, marginBottom: b, marginLeft: l, marginRight: r } = prefs;
            tags.push((t === b && t === l && t === r) ? `Lề ${t}mm` : `Lề ${t}-${b}-${l}-${r}mm`);
        }
        if (prefs.watermark) tags.push("Watermark");

        const hasDecor = tags.length > 0;
        trigger.classList.toggle("is-active", hasDecor);
        sumEl.textContent = hasDecor ? `Đã chọn: ${tags.join(" • ")}` : "Mặc định (Không trang trí)";
    }

    function hasAnyPageDecorationActive(prefs) {
        const p = prefs || loadDecorPrefs();
        return Boolean(
            p.twoLines ||
            p.showAuthor ||
            (p.pageBorderMode && p.pageBorderMode !== "none") ||
            p.watermark
        );
    }

    function ensurePreviewPdfExporterMenuDOM() {
        injectPreviewPdfExporterStyles();
        let pop = document.getElementById("qb-pdf-export-popover");
        if (pop) return pop;

        const colorSwatchesHtml = DECOR_COLOR_SWATCHES.map(c =>
            `<button type="button" class="qb-decor-swatch" data-color="${escapePdfAttr(c.hex)}" style="background:${escapePdfAttr(c.hex)};" title="${escapePdfAttr(c.name)}" onclick="onQbDecorColorSelect('${escapePdfAttr(c.hex)}')"></button>`
        ).join("");

        pop = document.createElement("div");
        pop.id = "qb-pdf-export-popover";
        pop.className = "qb-pdf-export-popover";
        pop.onclick = (e) => e.stopPropagation();
        pop.innerHTML = `
            <div class="qb-pdf-pop-head">
                <span>📄 TÙY CHỌN XUẤT PDF ĐỀ THI</span>
                <button type="button" class="qb-pdf-pop-close" onclick="closePreviewPdfExporterMenu(event)" title="Đóng">✕</button>
            </div>

            <div class="qb-pdf-config-box">
                <div class="qb-pdf-config-grid">
                    <div class="qb-pdf-field">
                        <label for="qb-pdf-target-pages">📑 Số trang xuất (A4):</label>
                        <select id="qb-pdf-target-pages" onchange="onQbPdfPagesSelectChange(this.value)">
                            <option value="">Mặc định (Tự nhiên)</option>
                            <option value="1">1 trang</option>
                            <option value="2">2 trang</option>
                            <option value="3">3 trang</option>
                            <option value="4">4 trang</option>
                            <option value="5">5 trang</option>
                            <option value="6">6 trang</option>
                            <option value="8">8 trang</option>
                            <option value="10">10 trang</option>
                            <option value="12">12 trang</option>
                            <option value="custom">Nhập số trang...</option>
                        </select>
                        <input type="number" id="qb-pdf-custom-pages" min="1" max="80" placeholder="Nhập số trang (VD: 7)" style="display:none; margin-top:4px;">
                    </div>

                    <div class="qb-pdf-field">
                        <label for="qb-pdf-font-size">🔤 Cỡ chữ (pt):</label>
                        <select id="qb-pdf-font-size" onchange="onQbPdfFontSelectChange(this.value)">
                            <option value="">Mặc định (10.5pt)</option>
                            <option value="8">8 pt (Siêu gọn)</option>
                            <option value="8.5">8.5 pt (Rất nhỏ)</option>
                            <option value="9">9 pt (Nhỏ)</option>
                            <option value="9.5">9.5 pt (Hơi nhỏ)</option>
                            <option value="10">10 pt (Gọn)</option>
                            <option value="10.5">10.5 pt (Chuẩn)</option>
                            <option value="11">11 pt (Vừa lớn)</option>
                            <option value="12">12 pt (Lớn)</option>
                            <option value="13">13 pt (Rất lớn)</option>
                            <option value="14">14 pt (Cực lớn)</option>
                            <option value="custom">Nhập cỡ chữ...</option>
                        </select>
                        <input type="number" id="qb-pdf-custom-font" min="6.5" max="18" step="0.5" placeholder="VD: 9.2" style="display:none; margin-top:4px;">
                    </div>
                </div>

                <!-- Ô CHỌN TRANG TRÍ XÒE RA -->
                <div class="qb-pdf-decor-wrap">
                    <button type="button" class="qb-pdf-decor-trigger" id="qb-pdf-decor-trigger" onclick="toggleQbPdfDecorPanel(event)" title="Bấm để xòe ra các tùy chọn trang trí: 2 dòng kẻ, tên tác giả + logo, bo viền 4 cạnh hoặc luân phiên 3 cạnh, chỉnh độ rộng 4 lề">
                        <span class="qb-pdf-decor-trigger-left">
                            <span>✨</span>
                            <span>Trang trí:</span>
                            <span class="qb-pdf-decor-summary-text" id="qb-pdf-decor-summary">Mặc định (Không trang trí)</span>
                        </span>
                        <span class="qb-pdf-decor-caret">▾</span>
                    </button>

                    <div class="qb-pdf-decor-panel" id="qb-pdf-decor-panel">
                        <label class="qb-decor-check-row">
                            <input type="checkbox" id="qb-decor-two-lines" onchange="onQbDecorFieldChange()">
                            <span>1. Thêm <b>2 dòng kẻ trang trí</b> trên cùng &amp; dưới cùng mỗi trang</span>
                        </label>

                        <label class="qb-decor-check-row">
                            <input type="checkbox" id="qb-decor-show-author" onchange="onQbDecorFieldChange()">
                            <span>2. Thêm <b>tên tác giả</b> vào lề trên &amp; lề dưới (kèm logo &amp; bo viền)</span>
                        </label>

                        <div class="qb-decor-sub-box" id="qb-decor-author-sub">
                            <div>
                                <label style="display:block; font-size:10px; font-weight:800; color:#0369a1; margin-bottom:2px;">✏️ Nhập tên tác giả / đơn vị:</label>
                                <input type="text" id="qb-decor-author-name" placeholder="VD: Thầy Phạm Công Hoan • Toán THPT" oninput="onQbDecorFieldChange()">
                            </div>
                            <div class="qb-decor-sub-grid">
                                <div>
                                    <label style="display:block; font-size:10px; font-weight:800; color:#0369a1; margin-bottom:2px;">🖼️ Bo viền tên tác giả:</label>
                                    <select id="qb-decor-author-border" onchange="onQbDecorFieldChange()">
                                        <option value="rounded">Bo góc thanh lịch</option>
                                        <option value="double">Viền đôi cổ điển</option>
                                        <option value="pill">Nhãn viên thuốc (Pill)</option>
                                        <option value="none">Không bo viền</option>
                                    </select>
                                </div>
                                <label style="display:flex; align-items:center; gap:5px; font-size:11px; font-weight:800; color:#0f172a; padding-top:14px; cursor:pointer;">
                                    <input type="checkbox" id="qb-decor-author-logo" checked onchange="onQbDecorFieldChange()" style="width:14px; height:14px; accent-color:#0284c7;">
                                    <span>Kèm logo đi kèm</span>
                                </label>
                            </div>
                        </div>

                        <div class="qb-decor-section-title">🖼️ Bo viền khung từng trang A4:</div>
                        <div class="qb-decor-radio-pills">
                            <label class="qb-decor-radio-pill" onclick="onQbDecorBorderModeClick('none', event)">
                                <input type="radio" name="qb-decor-border-mode" value="none">
                                <span>⬜ Không viền</span>
                            </label>
                            <label class="qb-decor-radio-pill" onclick="onQbDecorBorderModeClick('all4', event)">
                                <input type="radio" name="qb-decor-border-mode" value="all4">
                                <span>🔲 3. Bo viền 4 cạnh</span>
                            </label>
                            <label class="qb-decor-radio-pill" onclick="onQbDecorBorderModeClick('alt3', event)">
                                <input type="radio" name="qb-decor-border-mode" value="alt3">
                                <span>📖 4. Luân phiên 3 cạnh</span>
                            </label>
                        </div>

                        <div class="qb-decor-alt3-hint" id="qb-decor-alt3-hint">
                            📖 <b>Luân phiên 3 cạnh:</b> Trang 1, 3, 5... bo <b>Trên - Dưới - Trái</b> | Trang 2, 4, 6... bo <b>Trên - Dưới - Phải</b> (ghép 2 trang / 1 mặt giấy thành 1 khung lớn cực đẹp!).
                        </div>

                        <div id="qb-decor-style-color-wrap" style="display:none; flex-direction:column; gap:6px; padding-top:2px; border-top:1px dashed #e2e8f0;">
                            <div class="qb-decor-sub-grid" style="align-items:center;">
                                <div>
                                    <label style="display:block; font-size:10px; font-weight:800; color:#334155; margin-bottom:2px;">✨ Kiểu nét viền:</label>
                                    <select id="qb-decor-border-style" onchange="onQbDecorFieldChange()" style="width:100%; padding:4px 6px; border:1.2px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:800; font-family:inherit; background:#fff;">
                                        <option value="double">Đôi cổ điển (Double)</option>
                                        <option value="rounded">Bo góc thanh lịch</option>
                                        <option value="corner">4 góc chữ L học thuật</option>
                                        <option value="dashed">Nét đứt mỹ thuật</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display:block; font-size:10px; font-weight:800; color:#334155; margin-bottom:4px;">🎨 Màu sắc viền:</label>
                                    <div class="qb-decor-color-row">${colorSwatchesHtml}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Ô CHỌN ĐỘ RỘNG 4 LỀ TRANG PDF -->
                        <div class="qb-decor-margin-box">
                            <div class="qb-decor-margin-top-row">
                                <span class="qb-decor-section-title" style="margin-top:0; white-space:nowrap;">📏 Độ rộng 4 lề (mm):</span>
                                <select id="qb-decor-margin-preset" onchange="onQbDecorMarginPresetChange(this.value)">
                                    <option value="default">Mặc định (12 - 12 - 12 - 12 mm)</option>
                                    <option value="compact">Gọn vừa (7 - 7 - 7 - 7 mm)</option>
                                    <option value="narrow">Lề bé (4 - 4 - 5 - 5 mm)</option>
                                    <option value="ultra">Siêu bé (2.5 - 2.5 - 3 - 3 mm)</option>
                                    <option value="custom">Tùy chỉnh 4 lề riêng...</option>
                                </select>
                            </div>
                            <div class="qb-decor-margin-grid">
                                <div class="qb-decor-margin-cell">
                                    <label for="qb-decor-margin-top">Trên</label>
                                    <input type="number" id="qb-decor-margin-top" min="0" max="35" step="0.5" value="12" oninput="onQbDecorMarginInputChange(false)" onchange="onQbDecorMarginInputChange(true)">
                                </div>
                                <div class="qb-decor-margin-cell">
                                    <label for="qb-decor-margin-bottom">Dưới</label>
                                    <input type="number" id="qb-decor-margin-bottom" min="0" max="35" step="0.5" value="12" oninput="onQbDecorMarginInputChange(false)" onchange="onQbDecorMarginInputChange(true)">
                                </div>
                                <div class="qb-decor-margin-cell">
                                    <label for="qb-decor-margin-left">Trái</label>
                                    <input type="number" id="qb-decor-margin-left" min="0" max="35" step="0.5" value="12" oninput="onQbDecorMarginInputChange(false)" onchange="onQbDecorMarginInputChange(true)">
                                </div>
                                <div class="qb-decor-margin-cell">
                                    <label for="qb-decor-margin-right">Phải</label>
                                    <input type="number" id="qb-decor-margin-right" min="0" max="35" step="0.5" value="12" oninput="onQbDecorMarginInputChange(false)" onchange="onQbDecorMarginInputChange(true)">
                                </div>
                            </div>
                            <div class="qb-decor-margin-hint">💡 Giảm lề xuống <b>3–5mm</b> giúp vùng chữ rộng rãi, đỡ xuống dòng.</div>
                        </div>

                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding-top:3px; border-top:1px dashed #e2e8f0;">
                            <label style="display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#334155; cursor:pointer;">
                                <input type="checkbox" id="qb-decor-page-num" checked onchange="onQbDecorFieldChange()" style="width:14px; height:14px; accent-color:#0284c7;">
                                <span>🔢 Đánh số trang (Trang i/N)</span>
                            </label>
                            <label style="display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#334155; cursor:pointer;">
                                <input type="checkbox" id="qb-decor-watermark" onchange="onQbDecorFieldChange()" style="width:14px; height:14px; accent-color:#0284c7;">
                                <span>💧 Chữ chìm (Watermark)</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="qb-pdf-config-hint-row">
                    <span>💡 Không chọn gì = xuất chuẩn mặc định.</span>
                    <button type="button" class="qb-pdf-reset-btn" onclick="resetPreviewPdfOptions()">↺ Mặc định</button>
                </div>
            </div>

            <div class="qb-pdf-modes-list">
                <button type="button" class="qb-pdf-mode-btn" onclick="runPreviewPdfExport('exam_only', event)">
                    <span class="qb-pdf-mode-icon">📄</span>
                    <div class="qb-pdf-mode-text">
                        <b>1. Xuất đề PDF <span class="qb-pdf-mode-tag">Chỉ đề</span></b>
                        <span>Đề kiểm tra sạch đẹp (không đáp án), tự co dòng vừa khít số trang đã chọn</span>
                    </div>
                </button>

                <button type="button" class="qb-pdf-mode-btn" onclick="runPreviewPdfExport('with_solution', event)">
                    <span class="qb-pdf-mode-icon">📑</span>
                    <div class="qb-pdf-mode-text">
                        <b>2. Đề PDF kèm giải <span class="qb-pdf-mode-tag is-green">Có đáp án</span></b>
                        <span>Đề thi + Đánh dấu đáp án đúng + Lời giải chi tiết &amp; bảng đáp án tổng hợp</span>
                    </div>
                </button>

                <button type="button" class="qb-pdf-mode-btn" onclick="runPreviewPdfExport('blank_below', event)">
                    <span class="qb-pdf-mode-icon">📝</span>
                    <div class="qb-pdf-mode-text">
                        <b>3. Đề PDF kèm khoảng trống dưới mỗi câu <span class="qb-pdf-mode-tag is-amber">Dòng chấm ...</span></b>
                        <span>Chừa khoảng trống có dòng kẻ ngang dạng .... hợp lý theo độ khó câu</span>
                    </div>
                </button>

                <button type="button" class="qb-pdf-mode-btn" onclick="runPreviewPdfExport('two_col_40_60', event)">
                    <span class="qb-pdf-mode-icon">▥</span>
                    <div class="qb-pdf-mode-text">
                        <b>4. Xuất PDF chia 2 cột (40% Đề | 60% Trình bày) <span class="qb-pdf-mode-tag is-purple">2 cột</span></b>
                        <span>Trái 40% đề từng câu | Phải 60% khoảng trống dòng kẻ .... theo độ khó</span>
                    </div>
                </button>
            </div>
        `;
        document.body.appendChild(pop);
        syncDecorControlsWithPrefs();
        return pop;
    }

    function toggleQbPdfDecorPanel(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const panel = document.getElementById("qb-pdf-decor-panel");
        const trigger = document.getElementById("qb-pdf-decor-trigger");
        if (!panel || !trigger) return;
        const willShow = !panel.classList.contains("show");
        panel.classList.toggle("show", willShow);
        trigger.classList.toggle("is-open", willShow);
        if (willShow) syncDecorControlsWithPrefs();
    }

    function onQbDecorBorderModeClick(mode, event) {
        if (event) event.stopPropagation();
        const cur = loadDecorPrefs();
        saveDecorPrefs({ ...cur, pageBorderMode: mode });
        syncDecorControlsWithPrefs();
    }

    function onQbDecorColorSelect(hex) {
        const cur = loadDecorPrefs();
        saveDecorPrefs({ ...cur, borderColor: hex });
        syncDecorControlsWithPrefs();
    }

    function onQbDecorMarginPresetChange(presetKey) {
        const cur = loadDecorPrefs();
        if (presetKey === "custom") {
            saveDecorPrefs({ ...cur, marginPreset: "custom" });
            syncDecorControlsWithPrefs();
            const topIn = document.getElementById("qb-decor-margin-top");
            if (topIn) { topIn.focus(); topIn.select(); }
            return;
        }
        const preset = MARGIN_PRESETS[presetKey] || MARGIN_PRESETS.default;
        saveDecorPrefs({
            ...cur,
            marginPreset: presetKey,
            marginTop: preset.top,
            marginBottom: preset.bottom,
            marginLeft: preset.left,
            marginRight: preset.right
        });
        syncDecorControlsWithPrefs();
    }

    function onQbDecorMarginInputChange(commitAndSync = false) {
        const cur = loadDecorPrefs();
        const inTop = document.getElementById("qb-decor-margin-top");
        const inBottom = document.getElementById("qb-decor-margin-bottom");
        const inLeft = document.getElementById("qb-decor-margin-left");
        const inRight = document.getElementById("qb-decor-margin-right");
        const selPreset = document.getElementById("qb-decor-margin-preset");

        const parseRaw = (el, fallback) => {
            if (!el) return fallback;
            const raw = String(el.value || "").trim().replace(",", ".");
            if (raw === "" || raw === "." || raw.endsWith(".")) {
                return commitAndSync ? fallback : null;
            }
            const n = parseFloat(raw);
            if (isNaN(n)) return commitAndSync ? fallback : null;
            return clampMarginMm(n, fallback);
        };

        const t = parseRaw(inTop, cur.marginTop);
        const b = parseRaw(inBottom, cur.marginBottom);
        const l = parseRaw(inLeft, cur.marginLeft);
        const r = parseRaw(inRight, cur.marginRight);

        const nextTop = (t !== null) ? t : cur.marginTop;
        const nextBottom = (b !== null) ? b : cur.marginBottom;
        const nextLeft = (l !== null) ? l : cur.marginLeft;
        const nextRight = (r !== null) ? r : cur.marginRight;

        let matchedPreset = "custom";
        for (const pKey in MARGIN_PRESETS) {
            const p = MARGIN_PRESETS[pKey];
            if (p.top === nextTop && p.bottom === nextBottom && p.left === nextLeft && p.right === nextRight) {
                matchedPreset = pKey;
                break;
            }
        }

        if (selPreset) selPreset.value = matchedPreset;

        saveDecorPrefs({
            ...cur,
            marginPreset: matchedPreset,
            marginTop: nextTop,
            marginBottom: nextBottom,
            marginLeft: nextLeft,
            marginRight: nextRight
        });

        if (commitAndSync) {
            syncDecorControlsWithPrefs();
        }
    }

    function onQbDecorFieldChange() {
        const cur = loadDecorPrefs();
        const chkTwoLines = document.getElementById("qb-decor-two-lines");
        const chkAuthor = document.getElementById("qb-decor-show-author");
        const inAuthorName = document.getElementById("qb-decor-author-name");
        const chkAuthorLogo = document.getElementById("qb-decor-author-logo");
        const selAuthorBorder = document.getElementById("qb-decor-author-border");
        const selBorderStyle = document.getElementById("qb-decor-border-style");
        const chkPageNum = document.getElementById("qb-decor-page-num");
        const chkWatermark = document.getElementById("qb-decor-watermark");

        saveDecorPrefs({
            ...cur,
            twoLines: chkTwoLines ? !!chkTwoLines.checked : cur.twoLines,
            showAuthor: chkAuthor ? !!chkAuthor.checked : cur.showAuthor,
            authorName: inAuthorName ? inAuthorName.value : cur.authorName,
            authorWithLogo: chkAuthorLogo ? !!chkAuthorLogo.checked : cur.authorWithLogo,
            authorBorder: selAuthorBorder ? selAuthorBorder.value : cur.authorBorder,
            borderStyle: selBorderStyle ? selBorderStyle.value : cur.borderStyle,
            showPageNum: chkPageNum ? !!chkPageNum.checked : cur.showPageNum,
            watermark: chkWatermark ? !!chkWatermark.checked : cur.watermark
        });
        syncDecorControlsWithPrefs();
    }

    function onQbPdfPagesSelectChange(val) {
        const customIn = document.getElementById("qb-pdf-custom-pages");
        if (!customIn) return;
        customIn.style.display = (val === "custom") ? "block" : "none";
        if (val === "custom") customIn.focus();
    }

    function onQbPdfFontSelectChange(val) {
        const customIn = document.getElementById("qb-pdf-custom-font");
        if (!customIn) return;
        customIn.style.display = (val === "custom") ? "block" : "none";
        if (val === "custom") customIn.focus();
    }

    function resetPreviewPdfOptions() {
        const selPages = document.getElementById("qb-pdf-target-pages");
        const cusPages = document.getElementById("qb-pdf-custom-pages");
        const selFont = document.getElementById("qb-pdf-font-size");
        const cusFont = document.getElementById("qb-pdf-custom-font");
        if (selPages) selPages.value = "";
        if (cusPages) { cusPages.value = ""; cusPages.style.display = "none"; }
        if (selFont) selFont.value = "";
        if (cusFont) { cusFont.value = ""; cusFont.style.display = "none"; }

        saveDecorPrefs({ ...DEFAULT_DECOR_PREFS });
        syncDecorControlsWithPrefs();
    }

    function getConfiguredPreviewPdfOptions() {
        const selPages = document.getElementById("qb-pdf-target-pages");
        const cusPages = document.getElementById("qb-pdf-custom-pages");
        const selFont = document.getElementById("qb-pdf-font-size");
        const cusFont = document.getElementById("qb-pdf-custom-font");

        let targetPages = null;
        if (selPages) {
            if (selPages.value === "custom" && cusPages) {
                const n = parseInt(cusPages.value, 10);
                if (!isNaN(n) && n >= 1) targetPages = Math.min(80, n);
            } else if (selPages.value !== "") {
                const n = parseInt(selPages.value, 10);
                if (!isNaN(n) && n >= 1) targetPages = n;
            }
        }

        let fontSizePt = null;
        if (selFont) {
            if (selFont.value === "custom" && cusFont) {
                const f = parseFloat(String(cusFont.value).replace(",", "."));
                if (!isNaN(f) && f >= 6 && f <= 20) fontSizePt = f;
            } else if (selFont.value !== "") {
                const f = parseFloat(selFont.value);
                if (!isNaN(f) && f >= 6 && f <= 20) fontSizePt = f;
            }
        }

        return { targetPages, fontSizePt, decorPrefs: { ...loadDecorPrefs() } };
    }

    function closePreviewPdfExporterMenu(event) {
        if (event) event.stopPropagation();
        const pop = document.getElementById("qb-pdf-export-popover");
        const btn = document.getElementById("btn-qb-preview-export-pdf");
        if (pop) pop.classList.remove("show");
        if (btn) btn.classList.remove("is-open");
    }

    function togglePreviewPdfExporterMenu(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const pop = ensurePreviewPdfExporterMenuDOM();
        const btn = document.getElementById("btn-qb-preview-export-pdf") || (event && event.currentTarget);
        if (!pop || !btn) return;

        if (pop.classList.contains("show")) {
            closePreviewPdfExporterMenu();
            return;
        }

        syncDecorControlsWithPrefs();
        pop.classList.add("show");
        btn.classList.add("is-open");

        const rect = btn.getBoundingClientRect();
        const popW = Math.min(418, window.innerWidth - 16);
        const popH = Math.min(pop.offsetHeight || 520, window.innerHeight - 20);
        let left = Math.max(8, Math.min(rect.left, window.innerWidth - popW - 8));
        let top = rect.bottom + 8;
        if (top + popH > window.innerHeight - 8) {
            top = Math.max(8, window.innerHeight - popH - 8);
        }
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(top)}px`;
    }

    document.addEventListener("click", function(e) {
        const pop = document.getElementById("qb-pdf-export-popover");
        const btn = document.getElementById("btn-qb-preview-export-pdf");
        if (pop && pop.classList.contains("show")) {
            if (!pop.contains(e.target) && !(btn && btn.contains(e.target))) {
                closePreviewPdfExporterMenu();
            }
        }
    });

    // =========================================================================
    // 4. CHUẨN HÓA DỮ LIỆU ĐỀ & TÍNH KHOẢNG TRỐNG HỢP LÝ THEO ĐỘ KHÓ
    // =========================================================================
    function collectPreviewQuestionsSafely() {
        if (typeof qbankState === "undefined") return { imagesMap: {}, questions: [] };
        const pickedRaw = (qbankState.rawQuestions || []).filter(q => q && qbankState.selectedQuestionIds.has(String(q.id)));
        const { orderMap } = (typeof buildTreeOrderMap === "function") ? buildTreeOrderMap() : { orderMap: {} };
        const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };

        const ordered = [...pickedRaw].sort((a, b) => {
            const pA = (typeof getQbankQuestionPart === "function") ? getQbankQuestionPart(a) : 1;
            const pB = (typeof getQbankQuestionPart === "function") ? getQbankQuestionPart(b) : 1;
            if (pA !== pB) return pA - pB;

            const ordA = a.folderId ? (orderMap[a.folderId] ?? 999999) : 999999;
            const ordB = b.folderId ? (orderMap[b.folderId] ?? 999999) : 999999;
            if (ordA !== ordB) return ordA - ordB;

            const lA = levelOrder[(typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(a.level) : "nb"] || 1;
            const lB = levelOrder[(typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(b.level) : "nb"] || 1;
            if (lA !== lB) return lA - lB;

            if (a.matrixSeq && b.matrixSeq) return a.matrixSeq - b.matrixSeq;
            return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
        });

        const letters = ["A", "B", "C", "D"];
        const imagesMap = { ...(qbankState.imagesMap || {}) };

        return {
            imagesMap,
            questions: ordered.map((rawQ, idx) => {
                const q = JSON.parse(JSON.stringify(rawQ));
                const p = (typeof getQbankQuestionPart === "function") ? getQbankQuestionPart(q) : 1;
                q.id = idx + 1;
                q.part = p;
                q.isPart4 = (p === 4);
                q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(rawQ.level) : (rawQ.level || "nb");

                const imgUrl = (typeof resolveQbankImageUrl === "function")
                    ? resolveQbankImageUrl(rawQ, imagesMap)
                    : (rawQ.imageUrl || "");
                if (imgUrl) {
                    q.imageUrl = imgUrl;
                    q.imageKey = `img_q_${q.id}`;
                    imagesMap[q.imageKey] = imgUrl;
                }

                if (p === 1) {
                    q.type = "multiple_choice";
                    q.options = Array.isArray(q.options) ? q.options.map(o => String(o ?? "")) : ["", "", "", ""];
                    if (typeof q.correct === "string") {
                        const cIdx = letters.indexOf(q.correct.trim().toUpperCase());
                        q.correct = cIdx !== -1 ? cIdx : (parseInt(q.correct, 10) || 0);
                    } else if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) {
                        q.correct = 0;
                    }
                } else if (p === 2) {
                    q.type = "true_false";
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
                    q.correctAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct !== undefined ? q.correct : ""));
                }
                return q;
            })
        };
    }

    function escapePdfHtml(str) {
        return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function escapePdfAttr(str) {
        return String(str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function formatPdfQuestionText(text) {
        if (typeof formatQuestionText === "function") return formatQuestionText(text);
        if (!text) return "";
        let formatted = String(text).replace(/\\begin\{center\}/gi, '<div style="width:100%; overflow-x:auto; text-align:center; margin:6px 0;">');
        formatted = formatted.replace(/\\end\{center\}/gi, "</div>");
        formatted = formatted.replace(/\\begin\{tabular\}([\s\S]*?)\\end\{tabular\}/gi, function(m, c) {
            return "$$ \\begin{array}" + c.replace(/\$/g, "").replace(/\\\(/g, "").replace(/\\\)/g, "") + "\\end{array} $$";
        });
        return formatted.replace(/(^|[^:])\/\/\s*([^\r\n<]+)/g, (m, p, c) => p + '<span style="color:#78350f; font-weight:800;">// ' + c.trim() + "</span>");
    }

    function computeBlankLinesCount(q, mode) {
        const lvl = (q && q.level) || "nb";
        const p = (q && q.part) || 1;

        if (mode === "two_col_40_60") {
            const baseMap = { nb: 5, th: 7, vdt: 10, vdc: 13 };
            let lines = baseMap[lvl] || 6;
            if (p === 2) lines += 2;
            else if (p === 4) lines += 3;
            return lines;
        }

        const belowMap = { nb: 3, th: 4, vdt: 6, vdc: 9 };
        let lines = belowMap[lvl] || 4;
        if (p === 2) lines += 1;
        else if (p === 4) lines += 2;
        return lines;
    }

    function getLevelShortLabel(lvl) {
        const m = { nb: "Nhận biết", th: "Thông hiểu", vdt: "Vận dụng", vdc: "Vận dụng cao" };
        return m[lvl] || "Nhận biết";
    }

    function buildDotLinesHtml(count) {
        let html = "";
        for (let i = 0; i < count; i++) {
            html += `<div class="pdf-dot-line"></div>`;
        }
        return html;
    }

    function buildSingleQuestionInnerHtml(q, qNum, mode, includeKey, imagesMap) {
        const letters = ["A", "B", "C", "D"];
        const p = q.part || 1;
        const imgUrl = q.imageUrl || (q.imageKey && imagesMap[q.imageKey]) || "";
        const imgHtml = imgUrl
            ? `<div class="doc-img-container"><img src="${escapePdfAttr(imgUrl)}" class="doc-q-img" onerror="handlePdfImgFallback(this)" alt="Hình câu ${qNum}"></div>`
            : "";

        let answerPartHtml = "";
        if (p === 1) {
            const maxOptLen = Math.max(0, ...(q.options || []).map(o => String(o || "").length));
            let optLayoutClass = "opt-grid-4";
            if (mode === "two_col_40_60") {
                optLayoutClass = maxOptLen > 24 ? "opt-grid-1" : "opt-grid-2";
            } else {
                optLayoutClass = maxOptLen > 52 ? "opt-grid-1" : (maxOptLen > 22 ? "opt-grid-2" : "opt-grid-4");
            }
            const optsHtml = (q.options || []).map((opt, oIdx) => {
                const L = letters[oIdx] || "";
                const isCorrect = includeKey && (q.correct === oIdx);
                return `<div class="doc-option-item ${isCorrect ? "correct-highlight" : ""}"><b>${L}.</b> <span>${opt}</span>${isCorrect ? '<b class="key-mark"> ✓</b>' : ""}</div>`;
            }).join("");
            answerPartHtml = `<div class="doc-options-wrapper ${optLayoutClass}">${optsHtml}</div>`;
        } else if (p === 2) {
            const stRows = (q.statements || []).map(st => {
                const keyStr = (includeKey && st.correct !== undefined)
                    ? `<span class="st-key-box"><span class="tf-badge ${st.correct ? "tf-true" : "tf-false"}">${st.correct ? "ĐÚNG" : "SAI"}</span></span>`
                    : (mode === "two_col_40_60" ? "" : `<span class="st-blank-box">[&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;]</span>`);
                return `<div class="doc-statement-row"><span class="st-letter"><b>${escapePdfHtml(st.id)})</b></span><span class="st-content">${st.statement}</span>${keyStr}</div>`;
            }).join("");
            answerPartHtml = `<div class="doc-statements-list">${stRows}</div>`;
        } else {
            const label = p === 4 ? "Kết quả:" : "Đáp số:";
            answerPartHtml = (includeKey && q.correctAnswer !== undefined)
                ? `<div class="doc-short-answer-line"><b>${label}</b> <span class="correct-short-ans">${escapePdfHtml(q.correctAnswer)}</span></div>`
                : `<div class="doc-short-answer-line"><b>${label}</b> <span class="doc-inline-dots"></span></div>`;
        }

        const explainHtml = (includeKey && q.explanation)
            ? `<div class="doc-explanation-box">💡 <b>Lời giải:</b> ${q.explanation}</div>`
            : "";

        return {
            titleHtml: `<div class="doc-q-title"><b>Câu ${qNum}.</b> ${formatPdfQuestionText(q.question || "")}</div>`,
            imgHtml,
            answerPartHtml,
            explainHtml
        };
    }

    function buildPrintableExamBodyHtml(examTitle, gradeText, maDe, timeLimit, questions, imagesMap, mode, logoSvg) {
        const includeKey = (mode === "with_solution");
        const p1List = questions.filter(q => q.part === 1);
        const p2List = questions.filter(q => q.part === 2);
        const p3List = questions.filter(q => q.part === 3);
        const p4List = questions.filter(q => q.part === 4);

        const modeLabelMap = {
            exam_only: "ĐỀ THI CHÍNH THỨC",
            with_solution: "ĐỀ THI KÈM ĐÁP ÁN & LỜI GIẢI",
            blank_below: "PHIẾU ĐỀ THI & BÀI LÀM TỰ LUẬN",
            two_col_40_60: "ĐỀ THI 2 CỘT (40% ĐỀ | 60% BÀI LÀM)"
        };

        let qNum = 1;
        let questionsHtml = "";

        const renderPartGroup = (list, headerText) => {
            if (!list || list.length === 0) return;
            const startNum = qNum;
            const endNum = qNum + list.length - 1;
            questionsHtml += `<div class="part-header-box">${headerText.replace("{RANGE}", `từ câu ${startNum} đến câu ${endNum}`)}</div>`;

            list.forEach(q => {
                const curNum = qNum++;
                const parts = buildSingleQuestionInnerHtml(q, curNum, mode, includeKey, imagesMap);
                const levelText = getLevelShortLabel(q.level);

                if (mode === "blank_below") {
                    const lineCount = computeBlankLinesCount(q, mode);
                    questionsHtml += `
                        <div class="doc-question-card has-blank-below" data-level="${escapePdfAttr(q.level)}" data-base-lines="${lineCount}">
                            ${parts.titleHtml}
                            ${parts.imgHtml}
                            ${parts.answerPartHtml}
                            <div class="doc-answer-space-below">
                                <div class="doc-space-label"><span>✍️ Bài làm Câu ${curNum}</span><span class="doc-space-lvl">${levelText}</span></div>
                                <div class="pdf-dots-wrap" data-lines="${lineCount}">${buildDotLinesHtml(lineCount)}</div>
                            </div>
                        </div>`;
                } else if (mode === "two_col_40_60") {
                    const lineCount = computeBlankLinesCount(q, mode);
                    questionsHtml += `
                        <div class="doc-question-card is-two-col-card" data-level="${escapePdfAttr(q.level)}" data-base-lines="${lineCount}">
                            <table class="doc-split-40-60-table">
                                <tr>
                                    <td class="col-left-40">
                                        ${parts.titleHtml}
                                        ${parts.imgHtml}
                                        ${parts.answerPartHtml}
                                    </td>
                                    <td class="col-right-60">
                                        <div class="col-right-60-inner">
                                            <div class="doc-space-label"><span>✍️ Trình bày Câu ${curNum}</span><span class="doc-space-lvl">${levelText}</span></div>
                                            <div class="pdf-dots-wrap" data-lines="${lineCount}">${buildDotLinesHtml(lineCount)}</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </div>`;
                } else {
                    questionsHtml += `
                        <div class="doc-question-card">
                            ${parts.titleHtml}
                            ${parts.imgHtml}
                            ${parts.answerPartHtml}
                            ${parts.explainHtml}
                        </div>`;
                }
            });
        };

        renderPartGroup(p1List, "<b>PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</b> Thí sinh trả lời {RANGE}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.");
        renderPartGroup(p2List, "<b>PHẦN II. Câu trắc nghiệm đúng sai.</b> Thí sinh trả lời {RANGE}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.");
        renderPartGroup(p3List, "<b>PHẦN III. Câu trắc nghiệm trả lời ngắn.</b> Thí sinh trả lời {RANGE}.");
        renderPartGroup(p4List, "<b>PHẦN IV. Câu tự luận ngắn.</b> Thí sinh trả lời {RANGE}.");

        let summaryKeyTableHtml = "";
        if (includeKey && p1List.length > 0) {
            const letters = ["A", "B", "C", "D"];
            let cells = "";
            p1List.forEach((q, idx) => {
                const ans = (typeof q.correct === "number" && letters[q.correct]) ? letters[q.correct] : "--";
                cells += `<td><b>${idx + 1}</b></td><td>${ans}</td>`;
                if ((idx + 1) % 10 === 0 && (idx + 1) < p1List.length) cells += `</tr><tr>`;
            });
            summaryKeyTableHtml = `
                <div class="doc-summary-key-section">
                    <h4 style="text-align:center; color:#0369a1; margin:10px 0 6px 0; text-transform:uppercase;">BẢNG ĐÁP ÁN PHẦN I - MÃ ĐỀ ${escapePdfHtml(maDe)}</h4>
                    <table class="doc-key-table"><tr>${cells}</tr></table>
                </div>`;
        }

        return `
        <div class="exam-doc-page" id="exam-doc-page">
            <table class="exam-doc-header-table">
                <tr>
                    <td class="hdr-logo-cell" style="width: 58px; vertical-align: middle; text-align: center;">
                        <div id="exam-logo-slot" title="Logo ngẫu nhiên tặng kèm đề thi">${logoSvg}</div>
                    </td>
                    <td style="width: 44%; text-align: center; vertical-align: middle;">
                        <div class="hdr-org">SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
                        <div class="hdr-school">NGÂN HÀNG ĐỀ THI CHẤT LƯỢNG CAO</div>
                        <div class="hdr-sub">${escapePdfHtml(gradeText)} • Đề gồm ${questions.length} câu</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                        <div class="hdr-org">${escapePdfHtml(modeLabelMap[mode] || "ĐỀ KIỂM TRA")}</div>
                        <div class="hdr-subject">MÔN: TOÁN HỌC</div>
                        <div class="hdr-sub"><b>Thời gian làm bài: ${timeLimit} phút</b></div>
                    </td>
                </tr>
            </table>

            <div class="exam-doc-banner-title">
                <h2>${escapePdfHtml(examTitle)}</h2>
                <div class="exam-doc-made-badge">MÃ ĐỀ THI: ${escapePdfHtml(maDe)}</div>
            </div>

            <div class="exam-student-info-box">
                <span>Họ và tên thí sinh: ....................................................................................</span>
                <span class="st-info-right">SBD: ........................... Lớp: ..............</span>
            </div>

            <div class="exam-questions-content" id="exam-questions-content">
                ${questionsHtml}
            </div>

            <div class="exam-end-mark">---------- HẾT ----------</div>
            ${summaryKeyTableHtml}
        </div>`;
    }

    // =========================================================================
    // 5. MỞ CỬA SỔ XUẤT PDF (HỖ TRỢ ĐẦY ĐỦ TRANG TRÍ TỪNG TRANG A4, 4 LỀ TÙY CHỌN & CO GIÃN ĐÚNG N TRANG)
    // =========================================================================
    function openPreviewPdfWindow(mode) {
        const collected = collectPreviewQuestionsSafely();
        const questions = collected.questions || [];
        if (questions.length === 0) {
            alert("⚠️ Không có câu hỏi nào được chọn để xuất PDF!");
            return;
        }

        const { targetPages, fontSizePt, decorPrefs } = getConfiguredPreviewPdfOptions();
        const useDecorSheets = hasAnyPageDecorationActive(decorPrefs);
        const useCustomMargins = hasCustomMarginConfig(decorPrefs);

        const mTopInit = clampMarginMm(decorPrefs.marginTop, 12);
        const mRightInit = clampMarginMm(decorPrefs.marginRight, 12);
        const mBottomInit = clampMarginMm(decorPrefs.marginBottom, 12);
        const mLeftInit = clampMarginMm(decorPrefs.marginLeft, 12);

        const titleInp = document.getElementById("qbank-exam-name");
        const gradeSel = document.getElementById("qbank-exam-grade");
        const examTitle = (titleInp && titleInp.value.trim()) ? titleInp.value.trim() : `ĐỀ KIỂM TRA (${questions.length} CÂU)`;
        const gradeText = (gradeSel && gradeSel.options[gradeSel.selectedIndex]) ? gradeSel.options[gradeSel.selectedIndex].text : "Khối Lớp 11";
        const maDe = String(Math.floor(101 + Math.random() * 890));
        const timeLimit = 90;

        const logoInfo = generateRandomExamLogoSvg();
        const allLogoComboBuilder = `
            const _PALETTES = ${JSON.stringify(LOGO_PALETTES)};
            const _TEMPLATES = [${buildRandomExamLogosBank().map(fn => fn.toString()).join(",")}];
            let currentLogoSvg = ${JSON.stringify(logoInfo.svg)};
            function changeRandomExamLogo() {
                const tIdx = Math.floor(Math.random() * _TEMPLATES.length);
                const pIdx = Math.floor(Math.random() * _PALETTES.length);
                const uid = Date.now().toString(36) + "_" + Math.floor(Math.random() * 9999);
                currentLogoSvg = _TEMPLATES[tIdx](_PALETTES[pIdx], uid);
                const slot = document.getElementById("exam-logo-slot");
                if (slot) slot.innerHTML = currentLogoSvg;
                document.querySelectorAll(".js-mini-logo-slot, .a4-page-body #exam-logo-slot").forEach(el => {
                    el.innerHTML = currentLogoSvg;
                });
            }
        `;

        const bodyHtml = buildPrintableExamBodyHtml(
            examTitle, gradeText, maDe, timeLimit,
            questions, collected.imagesMap, mode, logoInfo.svg
        );

        const win = window.open("", "_blank");
        if (!win) {
            alert("⚠️ Trình duyệt đã chặn cửa sổ bật lên (Pop-up). Vui lòng cho phép pop-up để xem & lưu PDF!");
            return;
        }

        closePreviewPdfExporterMenu();

        const initialPt = fontSizePt || DEFAULT_FONT_PT;
        const safeDecorColor = /^#[0-9a-f]{3,8}$/i.test(decorPrefs.borderColor || "") ? decorPrefs.borderColor : "#1e293b";
        const initialPageRule = useDecorSheets ? "0" : `${mTopInit}mm ${mRightInit}mm ${mBottomInit}mm ${mLeftInit}mm`;

        win.document.open();
        win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>${escapePdfHtml(examTitle)} - Mã đề ${maDe}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script>
        window.MathJax = {
            tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']], processEscapes: true },
            svg: { scale: 1.03, fontCache: 'global' },
            options: { enableMenu: false }
        };
    <\/script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script>
    <style id="dynamic-page-style">
        @page { size: A4; margin: ${initialPageRule}; }
    </style>
    <style>
        :root {
            --doc-font-pt: ${initialPt}pt;
            --doc-line-height: 1.42;
            --doc-q-gap: 10px;
            --doc-img-max-h: 215px;
            --doc-dot-h: 17px;
            --doc-header-pad: 6px;
            --doc-part-gap: 10px;
            --doc-logo-size: 48px;
            --decor-color: ${safeDecorColor};
            --sheet-margin-top: ${mTopInit}mm;
            --sheet-margin-right: ${mRightInit}mm;
            --sheet-margin-bottom: ${mBottomInit}mm;
            --sheet-margin-left: ${mLeftInit}mm;
            --frame-pad-v: 4mm;
            --frame-pad-h: 5mm;
        }
        *, *::before, *::after { box-sizing: border-box; }
        body {
            font-family: 'Be Vietnam Pro', 'Times New Roman', serif;
            font-size: var(--doc-font-pt);
            line-height: var(--doc-line-height);
            color: #0f172a;
            background: #e2e8f0;
            margin: 0;
            padding: 54px 12px 30px 12px;
        }
        .exam-doc-page {
            width: 210mm;
            max-width: 100%;
            margin: 0 auto;
            background: #ffffff;
            padding: ${mTopInit}mm ${mRightInit}mm ${mBottomInit}mm ${mLeftInit}mm;
            box-shadow: 0 10px 35px rgba(15, 23, 42, 0.22);
            border-radius: 6px;
        }

        /* CHẾ ĐỘ PHÂN TRANG A4 THỰC TẾ KHI BẬT TRANG TRÍ */
        body.use-a4-sheets .exam-doc-page.is-staging-hidden {
            position: fixed !important;
            left: -99999px !important;
            top: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        #a4-sheets-output {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            width: 100%;
        }
        .a4-sheet {
            width: 210mm;
            height: 296.4mm;
            background: #ffffff;
            padding: var(--sheet-margin-top) var(--sheet-margin-right) var(--sheet-margin-bottom) var(--sheet-margin-left);
            box-shadow: 0 12px 34px rgba(15, 23, 42, 0.24);
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
        }
        .a4-frame-outer {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            position: relative;
        }
        .a4-frame-inner {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            position: relative;
            padding: var(--frame-pad-v) var(--frame-pad-h);
            overflow: hidden;
        }
        .a4-sheet.border-mode-none .a4-frame-inner {
            padding: 0;
        }

        /* 1. VIỀN 4 CẠNH */
        .a4-sheet.border-mode-all4.border-style-double .a4-frame-outer {
            border: 2px solid var(--decor-color);
            padding: 3px;
        }
        .a4-sheet.border-mode-all4.border-style-double .a4-frame-inner {
            border: 0.85px solid var(--decor-color);
        }
        .a4-sheet.border-mode-all4.border-style-rounded .a4-frame-outer {
            border: 1.6px solid var(--decor-color);
            border-radius: 10px;
        }
        .a4-sheet.border-mode-all4.border-style-dashed .a4-frame-outer {
            border: 1.5px dashed var(--decor-color);
            border-radius: 6px;
        }
        .a4-sheet.border-mode-all4.border-style-corner .a4-frame-outer {
            border: 0.85px solid var(--decor-color);
        }

        /* 2. VIỀN LUÂN PHIÊN 3 CẠNH: TRANG LẺ (1,3,5...) TRÊN-DƯỚI-TRÁI | TRANG CHẴN (2,4,6...) TRÊN-DƯỚI-PHẢI */
        .a4-sheet.border-mode-alt3.is-odd.border-style-double .a4-frame-outer {
            border-top: 2px solid var(--decor-color);
            border-bottom: 2px solid var(--decor-color);
            border-left: 2px solid var(--decor-color);
            border-right: none;
            padding: 3px 0 3px 3px;
        }
        .a4-sheet.border-mode-alt3.is-odd.border-style-double .a4-frame-inner {
            border-top: 0.85px solid var(--decor-color);
            border-bottom: 0.85px solid var(--decor-color);
            border-left: 0.85px solid var(--decor-color);
            border-right: none;
            padding-right: 2mm;
        }
        .a4-sheet.border-mode-alt3.is-even.border-style-double .a4-frame-outer {
            border-top: 2px solid var(--decor-color);
            border-bottom: 2px solid var(--decor-color);
            border-right: 2px solid var(--decor-color);
            border-left: none;
            padding: 3px 3px 3px 0;
        }
        .a4-sheet.border-mode-alt3.is-even.border-style-double .a4-frame-inner {
            border-top: 0.85px solid var(--decor-color);
            border-bottom: 0.85px solid var(--decor-color);
            border-right: 0.85px solid var(--decor-color);
            border-left: none;
            padding-left: 2mm;
        }

        .a4-sheet.border-mode-alt3.is-odd.border-style-rounded .a4-frame-outer {
            border-top: 1.7px solid var(--decor-color);
            border-bottom: 1.7px solid var(--decor-color);
            border-left: 1.7px solid var(--decor-color);
            border-right: none;
            border-radius: 11px 0 0 11px;
        }
        .a4-sheet.border-mode-alt3.is-even.border-style-rounded .a4-frame-outer {
            border-top: 1.7px solid var(--decor-color);
            border-bottom: 1.7px solid var(--decor-color);
            border-right: 1.7px solid var(--decor-color);
            border-left: none;
            border-radius: 0 11px 11px 0;
        }

        .a4-sheet.border-mode-alt3.is-odd.border-style-dashed .a4-frame-outer {
            border-top: 1.5px dashed var(--decor-color);
            border-bottom: 1.5px dashed var(--decor-color);
            border-left: 1.5px dashed var(--decor-color);
            border-right: none;
            border-radius: 6px 0 0 6px;
        }
        .a4-sheet.border-mode-alt3.is-even.border-style-dashed .a4-frame-outer {
            border-top: 1.5px dashed var(--decor-color);
            border-bottom: 1.5px dashed var(--decor-color);
            border-right: 1.5px dashed var(--decor-color);
            border-left: none;
            border-radius: 0 6px 6px 0;
        }

        .a4-sheet.border-mode-alt3.is-odd.border-style-corner .a4-frame-outer {
            border-top: 0.85px solid var(--decor-color);
            border-bottom: 0.85px solid var(--decor-color);
            border-left: 0.85px solid var(--decor-color);
            border-right: none;
        }
        .a4-sheet.border-mode-alt3.is-even.border-style-corner .a4-frame-outer {
            border-top: 0.85px solid var(--decor-color);
            border-bottom: 0.85px solid var(--decor-color);
            border-right: 0.85px solid var(--decor-color);
            border-left: none;
        }

        /* 4 GÓC HOA VĂN CHỮ L (CHỈ HIỆN KHI CHỌN BORDER STYLE = CORNER) */
        .a4-corner {
            display: none;
            position: absolute;
            width: 15px;
            height: 15px;
            pointer-events: none;
            z-index: 4;
        }
        .a4-sheet.border-mode-all4.border-style-corner .a4-corner { display: block; }
        .a4-sheet.border-mode-alt3.is-odd.border-style-corner .a4-corner.c-tl,
        .a4-sheet.border-mode-alt3.is-odd.border-style-corner .a4-corner.c-bl { display: block; }
        .a4-sheet.border-mode-alt3.is-even.border-style-corner .a4-corner.c-tr,
        .a4-sheet.border-mode-alt3.is-even.border-style-corner .a4-corner.c-br { display: block; }

        .a4-corner.c-tl { top: 2px; left: 2px; border-top: 2.8px solid var(--decor-color); border-left: 2.8px solid var(--decor-color); }
        .a4-corner.c-tr { top: 2px; right: 2px; border-top: 2.8px solid var(--decor-color); border-right: 2.8px solid var(--decor-color); }
        .a4-corner.c-bl { bottom: 2px; left: 2px; border-bottom: 2.8px solid var(--decor-color); border-left: 2.8px solid var(--decor-color); }
        .a4-corner.c-br { bottom: 2px; right: 2px; border-bottom: 2.8px solid var(--decor-color); border-right: 2.8px solid var(--decor-color); }

        /* WATERMARK CHÌM */
        .a4-watermark {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
        }
        .a4-watermark span {
            font-size: 40pt;
            font-weight: 900;
            color: var(--decor-color);
            opacity: 0.055;
            transform: rotate(-32deg);
            text-transform: uppercase;
            white-space: nowrap;
            letter-spacing: 3px;
            user-select: none;
        }

        /* DẢI LỀ TRÊN & LỀ DƯỚI (2 DÒNG KẺ + TÊN TÁC GIẢ + LOGO + SỐ TRANG) */
        .a4-page-top-band,
        .a4-page-bottom-band {
            flex-shrink: 0;
            position: relative;
            z-index: 2;
        }
        .a4-page-top-band { margin-bottom: 6px; }
        .a4-page-bottom-band { margin-top: auto; padding-top: 5px; }

        .a4-meta-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            font-size: 8.8pt;
            color: #334155;
        }
        .a4-sheet.border-mode-alt3.is-even .a4-meta-row {
            flex-direction: row-reverse;
        }

        .a4-author-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-weight: 800;
            color: var(--decor-color);
            line-height: 1.2;
        }
        .a4-author-pill.author-border-rounded {
            border: 1px solid var(--decor-color);
            border-radius: 5px;
            padding: 2px 7px;
            background: rgba(248, 250, 252, 0.9);
        }
        .a4-author-pill.author-border-double {
            border: 2.5px double var(--decor-color);
            border-radius: 4px;
            padding: 2px 8px;
            background: rgba(248, 250, 252, 0.9);
        }
        .a4-author-pill.author-border-pill {
            border: 1.1px solid var(--decor-color);
            border-radius: 999px;
            padding: 2px 9px;
            background: rgba(248, 250, 252, 0.9);
        }
        .a4-mini-logo {
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .a4-mini-logo svg { width: 100%; height: 100%; display: block; }

        .a4-exam-running-title {
            font-size: 8.2pt;
            font-weight: 700;
            color: #64748b;
            font-style: italic;
            max-width: 55%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .a4-page-num-badge {
            font-size: 8.6pt;
            font-weight: 800;
            color: var(--decor-color);
            white-space: nowrap;
        }

        /* 2 DÒNG KẺ TRANG TRÍ TRÊN CÙNG & DƯỚI CÙNG MỖI TRANG */
        .a4-double-rule {
            width: 100%;
            height: 4.5px;
            margin: 3px 0 1px 0;
        }
        .a4-double-rule.top-rule {
            border-top: 1.8px solid var(--decor-color);
            border-bottom: 0.75px solid var(--decor-color);
        }
        .a4-double-rule.bottom-rule {
            margin: 1px 0 3px 0;
            border-top: 0.75px solid var(--decor-color);
            border-bottom: 1.8px solid var(--decor-color);
        }

        .a4-page-body {
            flex: 1;
            min-height: 0;
            position: relative;
            z-index: 2;
        }

        /* THANH ĐIỀU KHIỂN XEM TRƯỚC PDF (KHÔNG IN RA GIẤY) */
        .no-print-bar {
            position: fixed;
            top: 0; left: 0; right: 0;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(8px);
            color: #ffffff;
            padding: 7px 14px;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            border-bottom: 2px solid #0d9488;
            font-family: 'Be Vietnam Pro', sans-serif;
            font-size: 12px;
        }
        .no-print-status {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .np-badge {
            background: #1e293b;
            border: 1px solid #475569;
            color: #38bdf8;
            padding: 3px 9px;
            border-radius: 999px;
            font-weight: 800;
            font-size: 11.5px;
        }
        .np-badge.is-ok { border-color: #22c55e; color: #4ade80; }
        .np-badge.is-warn { border-color: #f59e0b; color: #fbbf24; }
        .no-print-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .btn-np {
            border: none;
            border-radius: 8px;
            padding: 6px 11px;
            font-size: 11.5px;
            font-weight: 800;
            cursor: pointer;
            font-family: inherit;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .btn-np-logo { background: #7c3aed; }
        .btn-np-step { background: #334155; border: 1px solid #64748b; padding: 5px 9px; }
        .btn-np-print { background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.45); }
        .btn-np:hover { filter: brightness(1.12); }

        /* TIÊU ĐỀ & LOGO NGẪU NHIÊN */
        .exam-doc-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: var(--doc-header-pad);
            border-bottom: 1.5px solid #0f172a;
        }
        .exam-doc-header-table td { padding-bottom: 5px; }
        #exam-logo-slot {
            width: var(--doc-logo-size);
            height: var(--doc-logo-size);
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .exam-random-logo-svg {
            width: 100%;
            height: 100%;
            display: block;
        }
        .hdr-org { font-size: 0.96em; font-weight: 800; text-transform: uppercase; line-height: 1.25; }
        .hdr-school { font-size: 0.98em; font-weight: 900; text-transform: uppercase; color: #0369a1; line-height: 1.25; }
        .hdr-subject { font-size: 1em; font-weight: 900; color: #b91c1c; text-transform: uppercase; line-height: 1.25; }
        .hdr-sub { font-size: 0.88em; color: #334155; font-style: italic; margin-top: 1px; }

        .exam-doc-banner-title { text-align: center; margin: var(--doc-header-pad) 0; }
        .exam-doc-banner-title h2 { margin: 0; font-size: 1.2em; font-weight: 900; text-transform: uppercase; color: #0f172a; line-height: 1.25; }
        .exam-doc-made-badge {
            display: inline-block;
            border: 1.4px solid #0f172a;
            padding: 1px 10px;
            font-weight: 900;
            font-size: 0.92em;
            border-radius: 4px;
            margin-top: 3px;
        }
        .exam-student-info-box {
            border: 1px dashed #475569;
            padding: 5px 10px;
            border-radius: 5px;
            margin-bottom: var(--doc-part-gap);
            font-size: 0.92em;
            display: flex;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
        }
        .part-header-box {
            background: #f1f5f9;
            border-left: 4px solid #0284c7;
            padding: 4px 9px;
            font-size: 0.98em;
            margin: var(--doc-part-gap) 0 7px 0;
            page-break-after: avoid;
            break-after: avoid;
        }

        /* THẺ CÂU HỎI & NỘI DUNG */
        .doc-question-card {
            margin-bottom: var(--doc-q-gap);
            page-break-inside: avoid;
            break-inside: avoid;
            text-align: justify;
        }
        .doc-q-title { font-size: 1em; line-height: var(--doc-line-height); white-space: pre-line; }
        .doc-img-container { text-align: center; margin: 5px 0; page-break-inside: avoid; break-inside: avoid; }
        .doc-q-img { max-width: 92%; max-height: var(--doc-img-max-h); object-fit: contain; border: 1px solid #cbd5e1; border-radius: 5px; }

        .doc-options-wrapper { display: grid; gap: 3px 12px; margin-top: 4px; }
        .opt-grid-4 { grid-template-columns: repeat(4, 1fr); }
        .opt-grid-2 { grid-template-columns: repeat(2, 1fr); }
        .opt-grid-1 { grid-template-columns: 1fr; }
        .doc-option-item { font-size: 0.98em; padding: 1px 0; line-height: var(--doc-line-height); }
        .correct-highlight { color: #15803d; font-weight: 800; }
        .key-mark { color: #16a34a; font-weight: 900; }

        .doc-statements-list { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
        .doc-statement-row { display: flex; align-items: baseline; gap: 5px; font-size: 0.98em; line-height: var(--doc-line-height); }
        .st-letter { flex-shrink: 0; min-width: 18px; }
        .st-content { flex: 1; }
        .st-blank-box { flex-shrink: 0; font-family: monospace; color: #475569; }
        .tf-badge { font-weight: 800; font-size: 0.84em; padding: 0 5px; border-radius: 4px; border: 1px solid #0f172a; }
        .tf-true { background: #dcfce7; color: #15803d; }
        .tf-false { background: #fee2e2; color: #b91c1c; }

        .doc-short-answer-line { margin-top: 4px; font-size: 0.98em; display: flex; align-items: flex-end; gap: 6px; }
        .doc-inline-dots { flex: 1; max-width: 240px; border-bottom: 1.1pt dotted #475569; height: 1em; display: inline-block; }
        .correct-short-ans { font-weight: 900; color: #15803d; background: #dcfce7; padding: 1px 7px; border-radius: 4px; }

        .doc-explanation-box {
            background: #fffbeb;
            border-left: 3px solid #f59e0b;
            padding: 4px 8px;
            font-size: 0.92em;
            margin-top: 4px;
            color: #78350f;
            line-height: var(--doc-line-height);
        }

        /* CHẾ ĐỘ 3: KHOẢNG TRỐNG & DÒNG KẺ CHẤM DƯỚI MỖI CÂU */
        .doc-answer-space-below {
            margin-top: 5px;
            padding: 4px 8px 6px 8px;
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            background: #fcfcfd;
        }
        .doc-space-label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.8em;
            font-weight: 800;
            color: #64748b;
            margin-bottom: 2px;
        }
        .doc-space-lvl {
            font-size: 0.9em;
            background: #f1f5f9;
            padding: 0 5px;
            border-radius: 4px;
            color: #475569;
        }
        .pdf-dot-line {
            width: 100%;
            height: var(--doc-dot-h);
            border-bottom: 1.05pt dotted #64748b;
        }

        /* CHẾ ĐỘ 4: CHIA 2 CỘT 40% ĐỀ | 60% TRÌNH BÀY */
        .doc-question-card.is-two-col-card {
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 5px;
        }
        .doc-split-40-60-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .col-left-40 {
            width: 40%;
            vertical-align: top;
            padding-right: 9px;
            border-right: 1.2px solid #94a3b8;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .col-right-60 {
            width: 60%;
            vertical-align: top;
            padding-left: 10px;
        }
        .col-right-60-inner {
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            padding: 4px 8px 6px 8px;
            background: #fcfcfd;
            min-height: 100%;
        }
        .col-left-40 .doc-q-img { max-width: 100%; max-height: calc(var(--doc-img-max-h) * 0.82); }
        .col-left-40 mjx-container[jax="SVG"] { max-width: 100% !important; font-size: 95% !important; }
        .col-left-40 mjx-container[jax="SVG"][display="true"] > svg { max-width: 100% !important; height: auto !important; }

        .exam-end-mark { text-align: center; margin: 12px 0 8px 0; font-weight: 800; font-style: italic; }
        .doc-key-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 0.9em; text-align: center; }
        .doc-key-table td { border: 1px solid #0f172a; padding: 3px 5px; }

        /* THƯỚC ĐO MM THỰC TẾ CỦA TRÌNH DUYỆT */
        #mm-ruler {
            position: fixed;
            left: -9999px;
            top: 0;
            width: 100mm;
            height: 100mm;
            pointer-events: none;
            visibility: hidden;
        }

        @media print {
            .no-print-bar { display: none !important; }
            body { background: #ffffff !important; padding: 0 !important; margin: 0 !important; }
            .exam-doc-page {
                width: 100% !important;
                max-width: none !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
            }
            #a4-sheets-output {
                display: block !important;
                gap: 0 !important;
            }
            .a4-sheet {
                width: 210mm !important;
                height: 296.4mm !important;
                margin: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                page-break-after: always;
                break-after: page;
            }
            .a4-sheet:last-child {
                page-break-after: auto;
                break-after: auto;
            }
            .doc-answer-space-below, .col-right-60-inner {
                background: #ffffff !important;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body class="${useDecorSheets ? "use-a4-sheets" : ""}">
    <div id="mm-ruler"></div>

    <div class="no-print-bar">
        <div class="no-print-status">
            <span style="font-weight:900; color:#34d399;">📄 XEM TRƯỚC IN PDF</span>
            <span class="np-badge" id="np-page-stat">Đang tính số trang...</span>
            <span class="np-badge" id="np-font-stat">Cỡ chữ: ${initialPt}pt</span>
            <span class="np-badge" id="np-margin-stat">Lề: ${mTopInit}-${mBottomInit}-${mLeftInit}-${mRightInit}mm</span>
        </div>
        <div class="no-print-actions">
            <button type="button" class="btn-np btn-np-logo" onclick="changeRandomExamLogo()">🎨 Đổi logo khác</button>
            <button type="button" class="btn-np btn-np-step" onclick="manualStepFont(-0.5)" title="Giảm cỡ chữ 0.5pt">A−</button>
            <button type="button" class="btn-np btn-np-step" onclick="manualStepFont(0.5)" title="Tăng cỡ chữ 0.5pt">A+</button>
            <button type="button" class="btn-np btn-np-print" onclick="window.print()">🖨️ In / Lưu PDF (Ctrl + P)</button>
        </div>
    </div>

    ${bodyHtml}
    ${useDecorSheets ? '<div id="a4-sheets-output"></div>' : ""}

    <script>
        const TARGET_PAGES = ${targetPages ? Number(targetPages) : "null"};
        const REQUESTED_FONT_PT = ${fontSizePt ? Number(fontSizePt) : "null"};
        const EXPORT_MODE = ${JSON.stringify(mode)};
        const USE_DECOR_SHEETS = ${useDecorSheets ? "true" : "false"};
        const HAS_CUSTOM_MARGINS = ${useCustomMargins ? "true" : "false"};
        const DECOR_CFG = ${JSON.stringify(decorPrefs)};
        const EXAM_SHORT_TITLE = ${JSON.stringify(examTitle)};
        const EXAM_MA_DE = ${JSON.stringify(maDe)};
        let currentFontPt = ${initialPt};
        let lastAppliedCfg = null;

        ${allLogoComboBuilder}

        function escHtml(s) {
            return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        }

        function handlePdfImgFallback(imgEl) {
            if (!imgEl || !imgEl.src) return;
            const src = imgEl.src;
            if (src.includes("googleusercontent.com") || src.includes("drive.google.com")) {
                const m = src.match(/(?:file\\/d\\/|id=|open\\?id=|\\/d\\/)([a-zA-Z0-9_-]{25,})/);
                if (m && m[1]) {
                    const fid = m[1];
                    const lvl = parseInt(imgEl.dataset.fb || "0", 10);
                    if (lvl === 0) { imgEl.dataset.fb = "1"; imgEl.src = "https://drive.google.com/thumbnail?id=" + fid + "&sz=w1400"; return; }
                    if (lvl === 1) { imgEl.dataset.fb = "2"; imgEl.src = "https://drive.google.com/uc?export=view&id=" + fid; return; }
                }
            }
            imgEl.style.display = "none";
        }

        function getPxPerMM() {
            const ruler = document.getElementById("mm-ruler");
            return ruler && ruler.offsetHeight > 0 ? (ruler.offsetHeight / 100) : 3.779527559;
        }

        function resolveEffectiveMargins(cfg) {
            if (HAS_CUSTOM_MARGINS) {
                const clampM = (v, fb) => {
                    const n = parseFloat(v);
                    return (!isNaN(n) && n >= 0 && n <= 35) ? n : fb;
                };
                return {
                    top: clampM(DECOR_CFG.marginTop, 12),
                    right: clampM(DECOR_CFG.marginRight, 12),
                    bottom: clampM(DECOR_CFG.marginBottom, 12),
                    left: clampM(DECOR_CFG.marginLeft, 12)
                };
            }
            if (USE_DECOR_SHEETS) {
                const mV = Math.max(7, Math.min(12, cfg.marginV));
                const mH = Math.max(7, Math.min(12, cfg.marginH));
                return { top: mV, right: mH, bottom: mV, left: mH };
            }
            return { top: cfg.marginV, right: cfg.marginH, bottom: cfg.marginV, left: cfg.marginH };
        }

        function resolveFramePaddingMm(margins) {
            const hasBorder = (DECOR_CFG.pageBorderMode && DECOR_CFG.pageBorderMode !== "none");
            if (!hasBorder) return { padV: 0, padH: 0 };
            const minM = Math.min(margins.top, margins.right, margins.bottom, margins.left);
            if (HAS_CUSTOM_MARGINS && minM <= 3.5) return { padV: 1.8, padH: 2.2 };
            if (HAS_CUSTOM_MARGINS && minM <= 6) return { padV: 2.5, padH: 3.2 };
            return { padV: 4.0, padH: 5.0 };
        }

        function applyLayoutParams(cfg) {
            lastAppliedCfg = cfg;
            const root = document.documentElement;
            currentFontPt = cfg.fontPt;
            root.style.setProperty("--doc-font-pt", cfg.fontPt + "pt");
            root.style.setProperty("--doc-line-height", String(cfg.lineHeight));
            root.style.setProperty("--doc-q-gap", cfg.qGap + "px");
            root.style.setProperty("--doc-img-max-h", cfg.imgMaxH + "px");
            root.style.setProperty("--doc-dot-h", cfg.dotH + "px");
            root.style.setProperty("--doc-header-pad", cfg.headerPad + "px");
            root.style.setProperty("--doc-part-gap", cfg.partGap + "px");
            root.style.setProperty("--doc-logo-size", cfg.logoSize + "px");

            const m = resolveEffectiveMargins(cfg);

            if (USE_DECOR_SHEETS) {
                const hasBorder = (DECOR_CFG.pageBorderMode && DECOR_CFG.pageBorderMode !== "none");
                const fp = resolveFramePaddingMm(m);
                root.style.setProperty("--sheet-margin-top", m.top + "mm");
                root.style.setProperty("--sheet-margin-right", m.right + "mm");
                root.style.setProperty("--sheet-margin-bottom", m.bottom + "mm");
                root.style.setProperty("--sheet-margin-left", m.left + "mm");
                root.style.setProperty("--frame-pad-v", fp.padV + "mm");
                root.style.setProperty("--frame-pad-h", fp.padH + "mm");

                const pageEl = document.getElementById("exam-doc-page");
                if (pageEl) {
                    const framePadH_total = hasBorder ? (2 * fp.padH) : 0;
                    const borderThicknessH = hasBorder ? (DECOR_CFG.borderStyle === "double" ? 2 : 1) : 0;
                    const bodyWidthMm = Math.max(135, 210 - (m.left + m.right) - framePadH_total - borderThicknessH);
                    pageEl.style.width = bodyWidthMm + "mm";
                    pageEl.style.padding = "0";
                }
            } else {
                const dynPageStyle = document.getElementById("dynamic-page-style");
                if (dynPageStyle) {
                    dynPageStyle.textContent = "@page { size: A4; margin: " + m.top + "mm " + m.right + "mm " + m.bottom + "mm " + m.left + "mm; }";
                }
                const pageEl = document.getElementById("exam-doc-page");
                if (pageEl) {
                    pageEl.style.padding = m.top + "mm " + m.right + "mm " + m.bottom + "mm " + m.left + "mm";
                }
            }

            if (cfg.lineRatio !== undefined) {
                document.querySelectorAll("#exam-doc-page .pdf-dots-wrap").forEach(wrap => {
                    const base = parseInt(wrap.dataset.lines || "4", 10);
                    const targetLines = Math.max(2, Math.round(base * cfg.lineRatio));
                    if (wrap.children.length !== targetLines) {
                        let h = "";
                        for (let i = 0; i < targetLines; i++) h += '<div class="pdf-dot-line"></div>';
                        wrap.innerHTML = h;
                    }
                });
            }
        }

        function buildAuthorBadgeHtml() {
            if (!DECOR_CFG.showAuthor) return "";
            const nameTxt = escHtml((DECOR_CFG.authorName || "").trim() || "Tác giả");
            const borderCls = "author-border-" + (DECOR_CFG.authorBorder || "none");
            const logoHtml = (DECOR_CFG.authorWithLogo !== false)
                ? '<span class="a4-mini-logo js-mini-logo-slot">' + currentLogoSvg + '</span>'
                : "";
            return '<span class="a4-author-pill ' + borderCls + '">' + logoHtml + '<span>' + nameTxt + '</span></span>';
        }

        function buildTopBandHtml() {
            const needTop = Boolean(DECOR_CFG.twoLines || DECOR_CFG.showAuthor);
            if (!needTop) return "";
            let metaRow = "";
            if (DECOR_CFG.showAuthor) {
                metaRow = '<div class="a4-meta-row">' +
                    buildAuthorBadgeHtml() +
                    '<span class="a4-exam-running-title">' + escHtml(EXAM_SHORT_TITLE) + ' • Mã ' + escHtml(EXAM_MA_DE) + '</span>' +
                '</div>';
            }
            const ruleHtml = DECOR_CFG.twoLines ? '<div class="a4-double-rule top-rule"></div>' : "";
            return '<div class="a4-page-top-band">' + metaRow + ruleHtml + '</div>';
        }

        function buildBottomBandHtml(pageIdx, totalPages) {
            const needPageNum = DECOR_CFG.showPageNum !== false;
            const needBottom = Boolean(DECOR_CFG.twoLines || DECOR_CFG.showAuthor || needPageNum);
            if (!needBottom) return "";
            const ruleHtml = DECOR_CFG.twoLines ? '<div class="a4-double-rule bottom-rule"></div>' : "";
            const authorHtml = DECOR_CFG.showAuthor ? buildAuthorBadgeHtml() : '<span></span>';
            const pageNumHtml = needPageNum
                ? '<span class="a4-page-num-badge">Trang ' + pageIdx + ' / ' + totalPages + '</span>'
                : '<span></span>';
            const metaRow = (DECOR_CFG.showAuthor || needPageNum)
                ? '<div class="a4-meta-row">' + authorHtml + pageNumHtml + '</div>'
                : "";
            return '<div class="a4-page-bottom-band">' + ruleHtml + metaRow + '</div>';
        }

        function measureDecorBandsHeightPx(cfg) {
            if (!USE_DECOR_SHEETS) return { topH: 0, bottomH: 0, frameOverheadV: 0 };
            const pxPerMM = getPxPerMM();
            const hasBorder = (DECOR_CFG.pageBorderMode && DECOR_CFG.pageBorderMode !== "none");
            const m = resolveEffectiveMargins(cfg);
            const fp = resolveFramePaddingMm(m);
            const borderThicknessV = hasBorder ? (DECOR_CFG.borderStyle === "double" ? 2.5 : 1) : 0;
            const frameOverheadV = hasBorder ? (((2 * fp.padV) + borderThicknessV) * pxPerMM) : 0;

            const probe = document.createElement("div");
            probe.style.cssText = "position:fixed; left:-99999px; top:0; visibility:hidden; width:175mm;";
            probe.innerHTML = buildTopBandHtml() + buildBottomBandHtml(1, 10);
            document.body.appendChild(probe);

            const topEl = probe.querySelector(".a4-page-top-band");
            const botEl = probe.querySelector(".a4-page-bottom-band");
            const topH = topEl ? (topEl.offsetHeight + 6) : 0;
            const bottomH = botEl ? (botEl.offsetHeight + 5) : 0;
            document.body.removeChild(probe);

            return { topH, bottomH, frameOverheadV };
        }

        function getOrderedFlowBlocks() {
            const pageEl = document.getElementById("exam-doc-page");
            if (!pageEl) return [];
            const blocks = [];
            Array.from(pageEl.children).forEach(ch => {
                if (ch.id === "exam-questions-content") {
                    Array.from(ch.children).forEach(qChild => blocks.push(qChild));
                } else {
                    blocks.push(ch);
                }
            });
            return blocks;
        }

        function paginateBlocksIntoPageGroups(cfg) {
            const pxPerMM = getPxPerMM();
            const m = resolveEffectiveMargins(cfg);
            const { topH, bottomH, frameOverheadV } = measureDecorBandsHeightPx(cfg);
            const totalSheetH = (USE_DECOR_SHEETS ? 296.4 : 297) * pxPerMM;
            const usableBodyH = Math.max(180, totalSheetH - ((m.top + m.bottom) * pxPerMM) - frameOverheadV - topH - bottomH - 8);

            const blocks = getOrderedFlowBlocks();
            const pages = [];
            let curPage = [];
            let curUsedH = 0;

            for (let i = 0; i < blocks.length; i++) {
                const el = blocks[i];
                const cs = getComputedStyle(el);
                const h = el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);

                if (curPage.length > 0 && (curUsedH + h > usableBodyH)) {
                    const lastInPage = curPage[curPage.length - 1];
                    if (lastInPage && lastInPage.classList && lastInPage.classList.contains("part-header-box") && curPage.length > 1) {
                        const popped = curPage.pop();
                        pages.push(curPage);
                        const popCs = getComputedStyle(popped);
                        const popH = popped.offsetHeight + (parseFloat(popCs.marginTop) || 0) + (parseFloat(popCs.marginBottom) || 0);
                        curPage = [popped, el];
                        curUsedH = popH + h;
                    } else {
                        pages.push(curPage);
                        curPage = [el];
                        curUsedH = h;
                    }
                } else {
                    curPage.push(el);
                    curUsedH += h;
                }
            }
            if (curPage.length > 0) pages.push(curPage);
            return pages;
        }

        function buildA4DecoratedSheets(cfg) {
            const output = document.getElementById("a4-sheets-output");
            const staging = document.getElementById("exam-doc-page");
            if (!output || !staging) return 1;

            staging.classList.add("is-staging-hidden");
            const pageGroups = paginateBlocksIntoPageGroups(cfg);
            const totalPages = Math.max(1, pageGroups.length);

            const bModeClass = "border-mode-" + (DECOR_CFG.pageBorderMode || "none");
            const bStyleClass = "border-style-" + (DECOR_CFG.borderStyle || "double");
            const wmText = escHtml((DECOR_CFG.authorName || "").trim() || EXAM_SHORT_TITLE);
            const wmHtml = DECOR_CFG.watermark ? '<div class="a4-watermark"><span>' + wmText + '</span></div>' : "";

            output.innerHTML = "";
            pageGroups.forEach((nodes, idx) => {
                const pageNum = idx + 1;
                const parityClass = (pageNum % 2 === 1) ? "is-odd" : "is-even";

                const sheet = document.createElement("div");
                sheet.className = "a4-sheet " + parityClass + " " + bModeClass + " " + bStyleClass;
                sheet.dataset.page = String(pageNum);

                sheet.innerHTML =
                    '<div class="a4-frame-outer">' +
                        '<div class="a4-frame-inner">' +
                            '<span class="a4-corner c-tl"></span>' +
                            '<span class="a4-corner c-tr"></span>' +
                            '<span class="a4-corner c-bl"></span>' +
                            '<span class="a4-corner c-br"></span>' +
                            wmHtml +
                            buildTopBandHtml() +
                            '<div class="a4-page-body"></div>' +
                            buildBottomBandHtml(pageNum, totalPages) +
                        '</div>' +
                    '</div>';

                const bodySlot = sheet.querySelector(".a4-page-body");
                nodes.forEach(n => {
                    bodySlot.appendChild(n.cloneNode(true));
                });

                output.appendChild(sheet);
            });

            return totalPages;
        }

        function estimateA4PagesCount(cfg) {
            if (USE_DECOR_SHEETS) {
                return paginateBlocksIntoPageGroups(cfg).length;
            }
            const m = resolveEffectiveMargins(cfg);
            const pxPerMM = getPxPerMM();
            const usablePageHeightPx = Math.max(200, (297 - (m.top + m.bottom) - 2) * pxPerMM);
            const pageEl = document.getElementById("exam-doc-page");
            if (!pageEl) return 1;

            const qContainer = document.getElementById("exam-questions-content");
            const headerOffset = qContainer ? (qContainer.offsetTop - pageEl.offsetTop) : 130;
            let curPageUsed = headerOffset;
            let pages = 1;

            const blocks = Array.from(qContainer ? qContainer.children : []);
            for (let i = 0; i < blocks.length; i++) {
                const el = blocks[i];
                const cs = getComputedStyle(el);
                const h = el.offsetHeight + (parseFloat(cs.marginBottom) || 0);
                if (curPageUsed + h > usablePageHeightPx && curPageUsed > 40) {
                    pages++;
                    curPageUsed = h;
                } else {
                    curPageUsed += h;
                }
            }

            const endMark = document.querySelector("#exam-doc-page .exam-end-mark");
            const keyTbl = document.querySelector("#exam-doc-page .doc-summary-key-section");
            const tailH = (endMark ? endMark.offsetHeight + 12 : 0) + (keyTbl ? keyTbl.offsetHeight + 16 : 0);
            if (tailH > 0 && curPageUsed + tailH > usablePageHeightPx) {
                pages++;
            }
            return pages;
        }

        function updateTopStatusBadges(estPages, noteText = "") {
            const pEl = document.getElementById("np-page-stat");
            const fEl = document.getElementById("np-font-stat");
            const mEl = document.getElementById("np-margin-stat");
            if (pEl) {
                if (TARGET_PAGES) {
                    const isExact = (estPages <= TARGET_PAGES);
                    pEl.className = "np-badge " + (isExact ? "is-ok" : "is-warn");
                    pEl.textContent = (USE_DECOR_SHEETS ? "Số trang: " : "Dự kiến: ") + estPages + " / " + TARGET_PAGES + " trang A4" + (noteText ? " (" + noteText + ")" : "");
                } else {
                    pEl.className = "np-badge" + (USE_DECOR_SHEETS ? " is-ok" : "");
                    pEl.textContent = (USE_DECOR_SHEETS ? "Số trang: " : "Dự kiến: ") + estPages + " trang A4" + (USE_DECOR_SHEETS ? " (Đã trang trí)" : " (Mặc định)");
                }
            }
            if (fEl) {
                fEl.textContent = "Cỡ chữ: " + currentFontPt + "pt";
            }
            if (mEl && lastAppliedCfg) {
                const m = resolveEffectiveMargins(lastAppliedCfg);
                mEl.className = "np-badge" + (HAS_CUSTOM_MARGINS ? " is-ok" : "");
                mEl.textContent = (m.top === m.bottom && m.top === m.left && m.top === m.right)
                    ? ("Lề: " + m.top + "mm")
                    : ("Lề: " + m.top + "-" + m.bottom + "-" + m.left + "-" + m.right + "mm");
            }
        }

        function fitDocumentToTargetPages() {
            if (!TARGET_PAGES) {
                const baseCfg = {
                    fontPt: REQUESTED_FONT_PT || ${DEFAULT_FONT_PT},
                    lineHeight: 1.42,
                    qGap: 10,
                    imgMaxH: 215,
                    dotH: 17,
                    headerPad: 6,
                    partGap: 10,
                    logoSize: 48,
                    marginV: 12,
                    marginH: 12,
                    lineRatio: 1
                };
                applyLayoutParams(baseCfg);
                const est = USE_DECOR_SHEETS ? buildA4DecoratedSheets(baseCfg) : estimateA4PagesCount(baseCfg);
                updateTopStatusBadges(est);
                return est;
            }

            const startFont = REQUESTED_FONT_PT || ${DEFAULT_FONT_PT};
            const candidates = [];

            const spacingPresets = [
                { lineHeight: 1.38, qGap: 9, imgMaxH: 200, dotH: 16, headerPad: 5, partGap: 8, logoSize: 46, marginV: 11, marginH: 11, lineRatio: 1.0 },
                { lineHeight: 1.28, qGap: 6, imgMaxH: 175, dotH: 14, headerPad: 4, partGap: 6, logoSize: 42, marginV: 9,  marginH: 9,  lineRatio: 0.9 },
                { lineHeight: 1.20, qGap: 4, imgMaxH: 150, dotH: 13, headerPad: 3, partGap: 5, logoSize: 38, marginV: 7,  marginH: 8,  lineRatio: 0.8 },
                { lineHeight: 1.13, qGap: 3, imgMaxH: 125, dotH: 11.5, headerPad: 2, partGap: 4, logoSize: 34, marginV: 6, marginH: 7, lineRatio: 0.7 }
            ];
            spacingPresets.forEach(sp => candidates.push({ fontPt: startFont, ...sp }));

            for (let f = Math.round((startFont - 0.5) * 10) / 10; f >= 6.8; f = Math.round((f - 0.4) * 10) / 10) {
                candidates.push({
                    fontPt: f,
                    lineHeight: f >= 9 ? 1.22 : 1.13,
                    qGap: f >= 9 ? 5 : 3,
                    imgMaxH: f >= 9 ? 155 : 115,
                    dotH: f >= 9 ? 13 : 11,
                    headerPad: 3,
                    partGap: 5,
                    logoSize: f >= 9 ? 38 : 34,
                    marginV: f >= 9 ? 8 : 6,
                    marginH: f >= 9 ? 8 : 7,
                    lineRatio: f >= 9 ? 0.82 : 0.65
                });
            }

            let chosen = candidates[candidates.length - 1];
            let estPages = 999;

            for (let i = 0; i < candidates.length; i++) {
                applyLayoutParams(candidates[i]);
                estPages = estimateA4PagesCount(candidates[i]);
                chosen = candidates[i];
                if (estPages <= TARGET_PAGES) {
                    break;
                }
            }

            if (estPages < TARGET_PAGES) {
                const looseCfg = {
                    fontPt: REQUESTED_FONT_PT ? Math.max(REQUESTED_FONT_PT, 11) : 11.5,
                    lineHeight: 1.65,
                    qGap: 18,
                    imgMaxH: 240,
                    dotH: 21,
                    headerPad: 10,
                    partGap: 14,
                    logoSize: 52,
                    marginV: 14,
                    marginH: 14,
                    lineRatio: 1.25
                };
                applyLayoutParams(looseCfg);
                const looseEst = estimateA4PagesCount(looseCfg);
                if (looseEst <= TARGET_PAGES) {
                    chosen = looseCfg;
                    estPages = looseEst;
                } else {
                    applyLayoutParams(chosen);
                }
            }

            if (USE_DECOR_SHEETS) {
                estPages = buildA4DecoratedSheets(chosen);
            }

            const note = (REQUESTED_FONT_PT && chosen.fontPt < REQUESTED_FONT_PT)
                ? "Co từ " + REQUESTED_FONT_PT + "pt -> " + chosen.fontPt + "pt"
                : "";
            updateTopStatusBadges(estPages, note);
            return estPages;
        }

        function manualStepFont(delta) {
            const nextPt = Math.max(6.5, Math.min(18, Math.round((currentFontPt + delta) * 10) / 10));
            const baseCfg = lastAppliedCfg ? { ...lastAppliedCfg, fontPt: nextPt } : {
                fontPt: nextPt,
                lineHeight: 1.42,
                qGap: 10,
                imgMaxH: 215,
                dotH: 17,
                headerPad: 6,
                partGap: 10,
                logoSize: 48,
                marginV: TARGET_PAGES ? 8 : 12,
                marginH: TARGET_PAGES ? 8 : 12
            };
            applyLayoutParams(baseCfg);
            const est = USE_DECOR_SHEETS ? buildA4DecoratedSheets(baseCfg) : estimateA4PagesCount(baseCfg);
            updateTopStatusBadges(est, "Chỉnh tay");
        }

        function waitAllImagesLoaded(maxWaitMs = 2500) {
            const imgs = Array.from(document.querySelectorAll("img"));
            if (imgs.length === 0) return Promise.resolve();
            return new Promise(resolve => {
                let done = 0;
                const finish = () => { if (++done >= imgs.length) resolve(); };
                imgs.forEach(img => {
                    if (img.complete) finish();
                    else {
                        img.addEventListener("load", finish, { once: true });
                        img.addEventListener("error", finish, { once: true });
                    }
                });
                setTimeout(resolve, maxWaitMs);
            });
        }

        window.addEventListener("load", function() {
            let started = false;
            const runAfterTypeset = async () => {
                if (started) return;
                started = true;
                try {
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        await window.MathJax.typesetPromise();
                    }
                } catch (e) {}
                await waitAllImagesLoaded(2000);
                fitDocumentToTargetPages();
                setTimeout(() => { window.print(); }, 480);
            };

            const poll = setInterval(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    clearInterval(poll);
                    runAfterTypeset();
                }
            }, 150);

            setTimeout(() => {
                clearInterval(poll);
                runAfterTypeset();
            }, 4500);
        });
    <\/script>
</body>
</html>`);
        win.document.close();
    }

    function runPreviewPdfExport(mode, event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        openPreviewPdfWindow(mode);
    }

    // Xuất các hàm ra window scope
    window.togglePreviewPdfExporterMenu = togglePreviewPdfExporterMenu;
    window.closePreviewPdfExporterMenu = closePreviewPdfExporterMenu;
    window.toggleQbPdfDecorPanel = toggleQbPdfDecorPanel;
    window.onQbDecorBorderModeClick = onQbDecorBorderModeClick;
    window.onQbDecorColorSelect = onQbDecorColorSelect;
    window.onQbDecorMarginPresetChange = onQbDecorMarginPresetChange;
    window.onQbDecorMarginInputChange = onQbDecorMarginInputChange;
    window.onQbDecorFieldChange = onQbDecorFieldChange;
    window.onQbPdfPagesSelectChange = onQbPdfPagesSelectChange;
    window.onQbPdfFontSelectChange = onQbPdfFontSelectChange;
    window.resetPreviewPdfOptions = resetPreviewPdfOptions;
    window.runPreviewPdfExport = runPreviewPdfExport;
})();
