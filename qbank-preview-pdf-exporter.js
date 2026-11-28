// =========================================================
// FILE: qbank-preview-pdf-exporter.js
// QUẢN LÝ ĐỘC LẬP CHỨC NĂNG XUẤT PDF TRONG MODAL "XEM THỬ ĐỀ":
// 1. MENU XÒE 4 CHẾ ĐỘ XUẤT PDF + CHỌN SỐ TRANG, CỠ CHỮ & KHỔ GIẤY / BỐ CỤC IN:
//    - Khổ giấy: A4 dọc | A5 dọc | A4 ngang ghép 2 trang/tờ | A4 ngang đóng sách gập đôi (Booklet)
//    (1) Xuất đề PDF (chỉ đề)
//    (2) Đề PDF kèm lời giải & bảng đáp án
//    (3) Xuất PDF đề kèm khoảng trống dưới mỗi câu (dòng kẻ chấm .... hợp lý theo độ khó)
//    (4) Xuất PDF chia 2 cột: Nút tự chỉnh tỷ lệ % Đề | % Trình bày theo ý muốn (mặc định 40% - 60%)
// 2. Ô CHỌN "✨ TRANG TRÍ" XÒE RA ĐẦY ĐỦ TÙY CHỌN:
//    - 2 dòng kẻ trang trí trên cùng & dưới cùng mỗi trang
//    - Tên tác giả lề trên & dưới (kèm logo, ô nhập tên, chọn bo viền nhãn)
//    - Bo viền 4 cạnh từng trang
//    - Bo viền luân phiên 3 cạnh (Trang lẻ: Trên-Dưới-Trái | Trang chẵn: Trên-Dưới-Phải)
//    - Chọn 4 kiểu nét viền (Đôi cổ điển, Bo góc thanh lịch, Góc chữ L, Nét đứt), 5 màu, số trang, watermark
//    - Chọn độ rộng 4 lề trang PDF (Trên / Dưới / Trái / Phải theo mm)
// 3. TẶNG MỖI ĐỀ XUẤT RA 1 LOGO SVG NGHỆ THUẬT SINH NGẪU NHIÊN
// 4. PHÂN TRANG CHUẨN XÁC CHO MỌI CHẾ ĐỘ + GIÀN ĐỀU CHIỀU DỌC CHỐNG THỪA GIẤY TRẮNG
// 5. TỰ ĐỘNG CO HÌNH ẢNH VỪA KHÍT CỠ CHỮ & ĐỘ RỘNG CỘT (CHỐNG CHE/CẮT ẢNH)
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

    const SPLIT_RATIO_PRESETS = [30, 35, 40, 50, 60, 65];

    const VALID_PAPER_LAYOUTS = new Set(["a4_portrait", "a5_portrait", "a4_2up", "a4_booklet"]);

    const DEFAULT_DECOR_PREFS = {
        twoLines: false,
        showAuthor: false,
        authorName: "Thầy Phạm Công Hoan",
        authorWithLogo: true,
        authorBorder: "rounded",   // none | rounded | double | pill
        pageBorderMode: "none",    // none | all4 | alt3
        borderStyle: "double",     // double | rounded | corner | dashed
        borderColor: "#1e293b",    // #1e293b | #0369a1 | #0f766e | #6d28d9 | #b91c1c
        marginPreset: "default",   // default | compact | narrow | ultra | custom
        marginTop: 12,
        marginBottom: 12,
        marginLeft: 12,
        marginRight: 12,
        showPageNum: true,
        watermark: false,
        splitLeftPct: 40,          // Tỷ lệ cột Đề bên trái (%) trong chế độ chia 2 cột
        paperLayout: "a4_portrait" // a4_portrait | a5_portrait | a4_2up | a4_booklet
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

    function clampSplitLeftPct(val, fallback = 40) {
        const n = parseInt(String(val ?? ""), 10);
        if (isNaN(n)) return fallback;
        return Math.max(25, Math.min(75, n));
    }

    function normalizePaperLayout(val) {
        const v = String(val || "a4_portrait").trim();
        return VALID_PAPER_LAYOUTS.has(v) ? v : "a4_portrait";
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
        loaded.splitLeftPct = clampSplitLeftPct(loaded.splitLeftPct, 40);
        loaded.paperLayout = normalizePaperLayout(loaded.paperLayout);
        _decorPrefs = loaded;
        return _decorPrefs;
    }

    function saveDecorPrefs(nextPrefs) {
        const merged = { ...DEFAULT_DECOR_PREFS, ...nextPrefs };
        merged.marginTop = clampMarginMm(merged.marginTop, 12);
        merged.marginBottom = clampMarginMm(merged.marginBottom, 12);
        merged.marginLeft = clampMarginMm(merged.marginLeft, 12);
        merged.marginRight = clampMarginMm(merged.marginRight, 12);
        merged.splitLeftPct = clampSplitLeftPct(merged.splitLeftPct, 40);
        merged.paperLayout = normalizePaperLayout(merged.paperLayout);
        _decorPrefs = merged;
        try {
            localStorage.setItem(DECOR_PREFS_STORAGE_KEY, JSON.stringify(_decorPrefs));
        } catch (e) {}
        updateDecorTriggerSummaryUI();
    }

    // =========================================================================
    // 1. TIÊM CSS CHO MENU XÒE XUẤT PDF, KHỔ GIẤY, PANEL TRANG TRÍ & TỶ LỆ 2 CỘT
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
                width: 432px;
                max-width: 95vw;
                max-height: 89vh;
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
            .qb-pdf-layout-hint {
                display: none;
                font-size: 10px;
                font-weight: 700;
                color: #0369a1;
                background: #e0f2fe;
                border: 1px solid #bae6fd;
                border-radius: 6px;
                padding: 4px 7px;
                margin-top: 4px;
                line-height: 1.3;
            }
            .qb-pdf-layout-hint.show { display: block; }

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

            /* KHỐI MỤC 4 KÈM NÚT TỰ CHỈNH TỶ LỆ CHIA 2 CỘT */
            .qb-pdf-mode4-wrap {
                display: flex;
                flex-direction: column;
                border: 1.3px solid #cbd5e1;
                border-radius: 10px;
                background: #f8fafc;
                overflow: hidden;
                transition: border-color 0.14s ease, box-shadow 0.14s ease;
            }
            .qb-pdf-mode4-wrap:hover {
                border-color: #9333ea;
                box-shadow: 0 3px 10px rgba(147, 51, 234, 0.13);
            }
            .qb-pdf-mode4-wrap .qb-pdf-mode-btn {
                border: none;
                border-radius: 0;
                background: transparent;
                box-shadow: none;
            }
            .qb-pdf-mode4-wrap .qb-pdf-mode-btn:hover {
                background: #faf5ff;
                transform: none;
                box-shadow: none;
            }
            .qb-pdf-split-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                padding: 5px 10px;
                background: #f3e8ff;
                border-top: 1px dashed #d8b4fe;
            }
            .qb-pdf-split-toggle-btn {
                width: 100%;
                border: 1.2px solid #c084fc;
                background: #ffffff;
                color: #6b21a8;
                border-radius: 7px;
                padding: 4px 9px;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                transition: all 0.13s ease;
            }
            .qb-pdf-split-toggle-btn:hover,
            .qb-pdf-split-toggle-btn.is-open {
                background: #7c3aed;
                color: #ffffff;
                border-color: #6d28d9;
            }
            .qb-pdf-split-panel {
                display: none;
                flex-direction: column;
                gap: 7px;
                padding: 8px 10px 9px 10px;
                background: #ffffff;
                border-top: 1px solid #e9d5ff;
                animation: popInQbank 0.14s ease-out;
            }
            .qb-pdf-split-panel.show {
                display: flex;
            }
            .qb-split-presets-row {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 4px;
            }
            .qb-split-preset-pill {
                border: 1.2px solid #cbd5e1;
                background: #f8fafc;
                color: #334155;
                border-radius: 6px;
                padding: 4px 2px;
                font-size: 10.5px;
                font-weight: 800;
                cursor: pointer;
                text-align: center;
                font-family: inherit;
                transition: all 0.12s;
            }
            .qb-split-preset-pill:hover {
                border-color: #9333ea;
                background: #faf5ff;
                color: #6b21a8;
            }
            .qb-split-preset-pill.active {
                background: #7c3aed;
                color: #ffffff;
                border-color: #6d28d9;
            }
            .qb-split-slider-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .qb-split-slider-row input[type="range"] {
                flex: 1;
                accent-color: #7c3aed;
                cursor: pointer;
                height: 6px;
            }
            .qb-split-inputs-grid {
                display: grid;
                grid-template-columns: 1fr 1fr auto;
                gap: 6px;
                align-items: end;
            }
            .qb-split-num-box label {
                display: block;
                font-size: 10px;
                font-weight: 800;
                color: #581c87;
                margin-bottom: 2px;
            }
            .qb-split-num-box input {
                width: 100%;
                padding: 4px 6px;
                border: 1.3px solid #c084fc;
                border-radius: 6px;
                font-size: 11.5px;
                font-weight: 900;
                text-align: center;
                color: #0f172a;
                font-family: inherit;
                outline: none;
            }
            .qb-split-num-box input:focus {
                border-color: #7c3aed;
                box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
            }
            .qb-split-run-now-btn {
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
                color: #ffffff;
                border: none;
                border-radius: 7px;
                padding: 6px 10px;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                font-family: inherit;
                white-space: nowrap;
            }
            .qb-split-run-now-btn:hover { filter: brightness(1.1); }
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
    // 3. UI MENU XÒE CỦA NÚT "📄 Xuất PDF ▾", KHỔ GIẤY, "✨ TRANG TRÍ" & TỶ LỆ 2 CỘT
    // =========================================================================
    function syncSplitRatioUI() {
        const prefs = loadDecorPrefs();
        const leftPct = clampSplitLeftPct(prefs.splitLeftPct, 40);
        const rightPct = 100 - leftPct;

        const mode4Title = document.getElementById("qb-pdf-mode4-title");
        if (mode4Title) {
            mode4Title.innerHTML = `4. Xuất PDF chia 2 cột (${leftPct}% Đề | ${rightPct}% Trình bày) <span class="qb-pdf-mode-tag is-purple">2 cột</span>`;
        }
        const splitBtnLbl = document.getElementById("qb-pdf-split-btn-label");
        if (splitBtnLbl) {
            splitBtnLbl.textContent = `🎛️ Tự chỉnh tỷ lệ chia cột: ${leftPct}% Đề | ${rightPct}% Trình bày`;
        }
        const rangeEl = document.getElementById("qb-split-range-input");
        const leftIn = document.getElementById("qb-split-left-input");
        const rightIn = document.getElementById("qb-split-right-input");
        if (rangeEl) rangeEl.value = String(leftPct);
        if (leftIn && document.activeElement !== leftIn) leftIn.value = String(leftPct);
        if (rightIn && document.activeElement !== rightIn) rightIn.value = String(rightPct);

        document.querySelectorAll(".qb-split-preset-pill").forEach(btn => {
            btn.classList.toggle("active", parseInt(btn.dataset.left, 10) === leftPct);
        });
    }

    function syncPaperLayoutUI() {
        const prefs = loadDecorPrefs();
        const layout = normalizePaperLayout(prefs.paperLayout);
        const selLayout = document.getElementById("qb-pdf-paper-layout");
        const hintEl = document.getElementById("qb-pdf-layout-hint");

        if (selLayout) selLayout.value = layout;
        if (hintEl) {
            if (layout === "a4_2up") {
                hintEl.classList.add("show");
                hintEl.innerHTML = "📰 <b>Ghép 2 trang/tờ A4 ngang:</b> Tự ghép sẵn cặp [1|2], [3|4]... Khi bấm In chỉ cần giữ <b>1 trang/tờ</b>!";
            } else if (layout === "a4_booklet") {
                hintEl.classList.add("show");
                hintEl.innerHTML = "📖 <b>Đóng sách gập đôi (Booklet):</b> In 2 mặt (chọn <b>Lật cạnh ngắn / Flip on short edge</b>) rồi gập đôi thành quyển!";
            } else if (layout === "a5_portrait") {
                hintEl.classList.add("show");
                hintEl.innerHTML = "🗒️ <b>Khổ A5 dọc (148×210 mm):</b> Cỡ chữ &amp; hình ảnh tự động co vừa khít khổ giấy A5.";
            } else {
                hintEl.classList.remove("show");
                hintEl.innerHTML = "";
            }
        }
    }

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

        syncPaperLayoutUI();
        syncSplitRatioUI();
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

        const splitPresetsHtml = SPLIT_RATIO_PRESETS.map(p =>
            `<button type="button" class="qb-split-preset-pill" data-left="${p}" onclick="selectQbSplitPreset(${p}, event)">${p}/${100 - p}</button>`
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
                        <label for="qb-pdf-target-pages">📑 Số trang xuất:</label>
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
                            <option value="">Mặc định (Tự chuẩn)</option>
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

                <!-- CHỌN KHỔ GIẤY & BỐ CỤC IN (A4 DỌC / A5 DỌC / A4 GHÉP 2 / BOOKLET) -->
                <div class="qb-pdf-field">
                    <label for="qb-pdf-paper-layout">📐 Khổ giấy &amp; Bố cục in:</label>
                    <select id="qb-pdf-paper-layout" onchange="onQbPdfPaperLayoutChange(this.value)">
                        <option value="a4_portrait">📄 A4 dọc (1 trang/tờ - Mặc định)</option>
                        <option value="a5_portrait">🗒️ A5 dọc (148×210 mm - Khổ nhỏ)</option>
                        <option value="a4_2up">📰 A4 ngang — Ghép sẵn 2 trang/tờ</option>
                        <option value="a4_booklet">📖 A4 ngang — Đóng sách gập đôi (Booklet)</option>
                    </select>
                    <div class="qb-pdf-layout-hint" id="qb-pdf-layout-hint"></div>
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

                        <div class="qb-decor-section-title">🖼️ Bo viền khung từng trang:</div>
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
                    <span>💡 Tự động giàn đều câu hỏi kín trang &amp; co ảnh vừa khung.</span>
                    <button type="button" class="qb-pdf-reset-btn" onclick="resetPreviewPdfOptions()">↺ Mặc định</button>
                </div>
            </div>

            <div class="qb-pdf-modes-list">
                <button type="button" class="qb-pdf-mode-btn" onclick="runPreviewPdfExport('exam_only', event)">
                    <span class="qb-pdf-mode-icon">📄</span>
                    <div class="qb-pdf-mode-text">
                        <b>1. Xuất đề PDF <span class="qb-pdf-mode-tag">Chỉ đề</span></b>
                        <span>Đề kiểm tra sạch đẹp (không đáp án), tự co chữ &amp; giàn đều kín trang</span>
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

                <!-- MỤC 4: CHIA 2 CỘT + NÚT TỰ CHỈNH TỶ LỆ THEO Ý MUỐN -->
                <div class="qb-pdf-mode4-wrap">
                    <button type="button" class="qb-pdf-mode-btn" onclick="runPreviewPdfExport('two_col_40_60', event)">
                        <span class="qb-pdf-mode-icon">▥</span>
                        <div class="qb-pdf-mode-text">
                            <b id="qb-pdf-mode4-title">4. Xuất PDF chia 2 cột (40% Đề | 60% Trình bày) <span class="qb-pdf-mode-tag is-purple">2 cột</span></b>
                            <span>Trái: Đề từng câu (ảnh tự co vừa cột) | Phải: Khoảng trống dòng kẻ ....</span>
                        </div>
                    </button>

                    <div class="qb-pdf-split-bar" onclick="event.stopPropagation()">
                        <button type="button" class="qb-pdf-split-toggle-btn" id="qb-pdf-split-toggle-btn" onclick="toggleQbPdfSplitPanel(event)" title="Nhấp để tự chỉnh tỷ lệ % phần Đề và phần Trình bày theo ý muốn">
                            <span id="qb-pdf-split-btn-label">🎛️ Tự chỉnh tỷ lệ chia cột: 40% Đề | 60% Trình bày</span>
                            <span id="qb-pdf-split-caret">▾</span>
                        </button>
                    </div>

                    <div class="qb-pdf-split-panel" id="qb-pdf-split-panel" onclick="event.stopPropagation()">
                        <div class="qb-split-presets-row">${splitPresetsHtml}</div>
                        <div class="qb-split-slider-row">
                            <span style="font-size:10px; font-weight:800; color:#6b21a8;">Đề</span>
                            <input type="range" id="qb-split-range-input" min="25" max="75" step="1" value="40" oninput="onQbSplitRatioChange('left', this.value, false)" onchange="onQbSplitRatioChange('left', this.value, true)">
                            <span style="font-size:10px; font-weight:800; color:#047857;">Bài làm</span>
                        </div>
                        <div class="qb-split-inputs-grid">
                            <div class="qb-split-num-box">
                                <label for="qb-split-left-input">% Phần Đề (Trái):</label>
                                <input type="number" id="qb-split-left-input" min="25" max="75" step="1" value="40" oninput="onQbSplitRatioChange('left', this.value, false)" onchange="onQbSplitRatioChange('left', this.value, true)">
                            </div>
                            <div class="qb-split-num-box">
                                <label for="qb-split-right-input">% Trình bày (Phải):</label>
                                <input type="number" id="qb-split-right-input" min="25" max="75" step="1" value="60" oninput="onQbSplitRatioChange('right', this.value, false)" onchange="onQbSplitRatioChange('right', this.value, true)">
                            </div>
                            <button type="button" class="qb-split-run-now-btn" onclick="runPreviewPdfExport('two_col_40_60', event)" title="Xuất PDF ngay với tỷ lệ vừa chỉnh">🚀 Xuất 2 cột</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(pop);
        syncDecorControlsWithPrefs();
        return pop;
    }

    function onQbPdfPaperLayoutChange(val) {
        const cur = loadDecorPrefs();
        saveDecorPrefs({ ...cur, paperLayout: normalizePaperLayout(val) });
        syncPaperLayoutUI();
    }

    function toggleQbPdfSplitPanel(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const panel = document.getElementById("qb-pdf-split-panel");
        const btn = document.getElementById("qb-pdf-split-toggle-btn");
        const caret = document.getElementById("qb-pdf-split-caret");
        if (!panel || !btn) return;
        const willShow = !panel.classList.contains("show");
        panel.classList.toggle("show", willShow);
        btn.classList.toggle("is-open", willShow);
        if (caret) caret.textContent = willShow ? "▲" : "▾";
        if (willShow) syncSplitRatioUI();
    }

    function selectQbSplitPreset(leftPct, event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const cur = loadDecorPrefs();
        saveDecorPrefs({ ...cur, splitLeftPct: clampSplitLeftPct(leftPct, 40) });
        syncSplitRatioUI();
    }

    function onQbSplitRatioChange(side, rawVal, commitAndSync = false) {
        const cur = loadDecorPrefs();
        const trimmed = String(rawVal ?? "").trim();
        if (!trimmed) {
            if (commitAndSync) syncSplitRatioUI();
            return;
        }
        const n = parseInt(trimmed, 10);
        if (isNaN(n)) {
            if (commitAndSync) syncSplitRatioUI();
            return;
        }
        const rawLeft = (side === "right") ? (100 - n) : n;
        const clampedLeft = clampSplitLeftPct(rawLeft, cur.splitLeftPct || 40);
        saveDecorPrefs({ ...cur, splitLeftPct: clampedLeft });
        if (commitAndSync || rawLeft === clampedLeft) {
            syncSplitRatioUI();
        }
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
        const popW = Math.min(432, window.innerWidth - 16);
        const popH = Math.min(pop.offsetHeight || 560, window.innerHeight - 20);
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

    function computeBlankLinesCount(q, mode, splitLeftPct = 40) {
        const lvl = (q && q.level) || "nb";
        const p = (q && q.part) || 1;

        if (mode === "two_col_40_60") {
            const baseMap = { nb: 5, th: 7, vdt: 10, vdc: 13 };
            let lines = baseMap[lvl] || 6;
            if (p === 2) lines += 2;
            else if (p === 4) lines += 3;
            const rightPct = 100 - clampSplitLeftPct(splitLeftPct, 40);
            if (rightPct < 45) lines += 2;
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

    function buildSingleQuestionInnerHtml(q, qNum, mode, includeKey, imagesMap, splitLeftPct = 40) {
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
                if (splitLeftPct >= 58) {
                    optLayoutClass = maxOptLen > 34 ? "opt-grid-1" : (maxOptLen > 14 ? "opt-grid-2" : "opt-grid-4");
                } else {
                    optLayoutClass = maxOptLen > 22 ? "opt-grid-1" : "opt-grid-2";
                }
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

    function buildPrintableExamBodyHtml(examTitle, gradeText, maDe, timeLimit, questions, imagesMap, mode, logoSvg, splitLeftPct = 40) {
        const includeKey = (mode === "with_solution");
        const p1List = questions.filter(q => q.part === 1);
        const p2List = questions.filter(q => q.part === 2);
        const p3List = questions.filter(q => q.part === 3);
        const p4List = questions.filter(q => q.part === 4);

        const safeLeftPct = clampSplitLeftPct(splitLeftPct, 40);
        const safeRightPct = 100 - safeLeftPct;

        const modeLabelMap = {
            exam_only: "ĐỀ THI CHÍNH THỨC",
            with_solution: "ĐỀ THI KÈM ĐÁP ÁN & LỜI GIẢI",
            blank_below: "PHIẾU ĐỀ THI & BÀI LÀM TỰ LUẬN",
            two_col_40_60: `ĐỀ THI 2 CỘT (${safeLeftPct}% ĐỀ | ${safeRightPct}% BÀI LÀM)`
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
                const parts = buildSingleQuestionInnerHtml(q, curNum, mode, includeKey, imagesMap, safeLeftPct);
                const levelText = getLevelShortLabel(q.level);

                if (mode === "blank_below") {
                    const lineCount = computeBlankLinesCount(q, mode, safeLeftPct);
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
                    const lineCount = computeBlankLinesCount(q, mode, safeLeftPct);
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
                    <td class="hdr-logo-cell" style="width: 54px; vertical-align: middle; text-align: center;">
                        <div id="exam-logo-slot" title="Logo ngẫu nhiên tặng kèm đề thi">${logoSvg}</div>
                    </td>
                    <td style="width: 44%; text-align: center; vertical-align: middle;">
                        <div class="hdr-org">SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
                        <div class="hdr-school">NGÂN HÀNG ĐỀ THI CHẤT LƯỢNG CAO</div>
                        <div class="hdr-sub">${escapePdfHtml(gradeText)} • Đề gồm ${questions.length} câu</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                        <div class="hdr-org" id="hdr-mode-label">${escapePdfHtml(modeLabelMap[mode] || "ĐỀ KIỂM TRA")}</div>
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
    // 5. MỞ CỬA SỔ XUẤT PDF (A4 DỌC, A5 DỌC, A4 GHÉP 2, BOOKLET + GIÀN ĐỀU + CO ẢNH)
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
        const initialPaperLayout = normalizePaperLayout(decorPrefs.paperLayout);
        const isSmallPaperInit = (initialPaperLayout !== "a4_portrait");

        const mTopInit = clampMarginMm(decorPrefs.marginTop, 12);
        const mRightInit = clampMarginMm(decorPrefs.marginRight, 12);
        const mBottomInit = clampMarginMm(decorPrefs.marginBottom, 12);
        const mLeftInit = clampMarginMm(decorPrefs.marginLeft, 12);
        const splitLeftInit = clampSplitLeftPct(decorPrefs.splitLeftPct, 40);
        const splitRightInit = 100 - splitLeftInit;

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
            questions, collected.imagesMap, mode, logoInfo.svg, splitLeftInit
        );

        const win = window.open("", "_blank");
        if (!win) {
            alert("⚠️ Trình duyệt đã chặn cửa sổ bật lên (Pop-up). Vui lòng cho phép pop-up để xem & lưu PDF!");
            return;
        }

        closePreviewPdfExporterMenu();

        const initialPt = fontSizePt || (isSmallPaperInit ? 8.8 : DEFAULT_FONT_PT);
        const safeDecorColor = /^#[0-9a-f]{3,8}$/i.test(decorPrefs.borderColor || "") ? decorPrefs.borderColor : "#1e293b";
        const initialPageRule = initialPaperLayout === "a5_portrait"
            ? "A5 portrait"
            : ((initialPaperLayout === "a4_2up" || initialPaperLayout === "a4_booklet") ? "A4 landscape" : "A4 portrait");

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
        @page { size: ${initialPageRule}; margin: 0; }
    </style>
    <style>
        :root {
            --doc-font-pt: ${initialPt}pt;
            --doc-line-height: 1.42;
            --doc-q-gap: 10px;
            --doc-img-max-h: 205px;
            --doc-col-img-max-h: 175px;
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
            --col-left-pct: ${splitLeftInit}%;
            --col-right-pct: ${splitRightInit}%;
            --logic-w-mm: 210mm;
            --logic-h-mm: 296.4mm;
        }
        *, *::before, *::after { box-sizing: border-box; }
        body {
            font-family: 'Be Vietnam Pro', 'Times New Roman', serif;
            font-size: var(--doc-font-pt);
            line-height: var(--doc-line-height);
            color: #0f172a;
            background: #e2e8f0;
            margin: 0;
            padding: 62px 12px 30px 12px;
        }
        .exam-doc-page.is-staging-hidden {
            position: fixed !important;
            left: -99999px !important;
            top: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
        }
        #a4-sheets-output {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            width: 100%;
            overflow-x: auto;
        }
        .a4-sheet {
            width: var(--logic-w-mm);
            height: var(--logic-h-mm);
            background: #ffffff;
            padding: var(--sheet-margin-top) var(--sheet-margin-right) var(--sheet-margin-bottom) var(--sheet-margin-left);
            box-shadow: 0 12px 34px rgba(15, 23, 42, 0.24);
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
        }

        /* TỜ A4 NẰM NGANG GHÉP 2 TRANG CON (2-UP HOẶC BOOKLET) */
        .a4-landscape-sheet {
            width: 297mm;
            height: 209.4mm;
            background: #ffffff;
            box-shadow: 0 12px 34px rgba(15, 23, 42, 0.28);
            border-radius: 4px;
            display: grid;
            grid-template-columns: 148.5mm 148.5mm;
            overflow: hidden;
            position: relative;
            flex-shrink: 0;
        }
        .a4-landscape-sheet .a4-sheet {
            width: 148.5mm !important;
            height: 209.4mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
        }
        .a4-landscape-sheet.has-center-guide::after {
            content: "";
            position: absolute;
            top: 4mm;
            bottom: 4mm;
            left: 50%;
            border-left: 0.6pt dashed #cbd5e1;
            pointer-events: none;
            z-index: 20;
        }
        .a4-sheet.is-blank-filler {
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
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
        body.is-small-paper .a4-watermark span {
            font-size: 28pt;
        }

        .a4-page-top-band,
        .a4-page-bottom-band {
            flex-shrink: 0;
            position: relative;
            z-index: 2;
        }
        .a4-page-top-band { margin-bottom: 5px; }
        .a4-page-bottom-band { margin-top: auto; padding-top: 4px; }

        .a4-meta-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            font-size: 8.6pt;
            color: #334155;
        }
        body.is-small-paper .a4-meta-row { font-size: 7.4pt; }
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
            width: 15px;
            height: 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .a4-mini-logo svg { width: 100%; height: 100%; display: block; }

        .a4-exam-running-title {
            font-size: 8pt;
            font-weight: 700;
            color: #64748b;
            font-style: italic;
            max-width: 55%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .a4-page-num-badge {
            font-size: 8.4pt;
            font-weight: 800;
            color: var(--decor-color);
            white-space: nowrap;
        }

        .a4-double-rule {
            width: 100%;
            height: 4px;
            margin: 2px 0 1px 0;
        }
        .a4-double-rule.top-rule {
            border-top: 1.8px solid var(--decor-color);
            border-bottom: 0.75px solid var(--decor-color);
        }
        .a4-double-rule.bottom-rule {
            margin: 1px 0 2px 0;
            border-top: 0.75px solid var(--decor-color);
            border-bottom: 1.8px solid var(--decor-color);
        }

        .a4-page-body {
            flex: 1;
            min-height: 0;
            position: relative;
            z-index: 2;
            overflow: hidden;
        }

        /* THANH ĐIỀU KHIỂN XEM TRƯỚC PDF */
        .no-print-bar {
            position: fixed;
            top: 0; left: 0; right: 0;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(8px);
            color: #ffffff;
            padding: 6px 12px;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
            border-bottom: 2px solid #0d9488;
            font-family: 'Be Vietnam Pro', sans-serif;
            font-size: 11.5px;
        }
        .no-print-status {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .np-badge {
            background: #1e293b;
            border: 1px solid #475569;
            color: #38bdf8;
            padding: 2px 8px;
            border-radius: 999px;
            font-weight: 800;
            font-size: 11px;
        }
        .np-badge.is-ok { border-color: #22c55e; color: #4ade80; }
        .np-badge.is-warn { border-color: #f59e0b; color: #fbbf24; }
        .no-print-actions {
            display: flex;
            align-items: center;
            gap: 5px;
            flex-wrap: wrap;
        }
        .np-split-ctrl, .np-layout-ctrl {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            background: #1e293b;
            border: 1px solid #7c3aed;
            padding: 2px 6px;
            border-radius: 8px;
        }
        .np-layout-ctrl {
            border-color: #0284c7;
        }
        .np-layout-select {
            background: #0f172a;
            color: #38bdf8;
            border: none;
            font-family: inherit;
            font-size: 11px;
            font-weight: 800;
            outline: none;
            cursor: pointer;
            padding: 2px 4px;
        }
        .btn-np {
            border: none;
            border-radius: 7px;
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            font-family: inherit;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
        }
        .btn-np-logo { background: #7c3aed; }
        .btn-np-step { background: #334155; border: 1px solid #64748b; padding: 4px 8px; }
        .btn-np-justify { background: #0f766e; border: 1px solid #2dd4bf; }
        .btn-np-justify.is-off { background: #475569; border-color: #64748b; color: #cbd5e1; }
        .btn-np-print { background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.45); }
        .btn-np:hover { filter: brightness(1.12); }

        /* TIÊU ĐỀ & LOGO */
        .exam-doc-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: var(--doc-header-pad);
            border-bottom: 1.5px solid #0f172a;
        }
        .exam-doc-header-table td { padding-bottom: 4px; }
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
        .hdr-org { font-size: 0.94em; font-weight: 800; text-transform: uppercase; line-height: 1.22; }
        .hdr-school { font-size: 0.96em; font-weight: 900; text-transform: uppercase; color: #0369a1; line-height: 1.22; }
        .hdr-subject { font-size: 0.98em; font-weight: 900; color: #b91c1c; text-transform: uppercase; line-height: 1.22; }
        .hdr-sub { font-size: 0.86em; color: #334155; font-style: italic; margin-top: 1px; }

        body.is-small-paper .hdr-logo-cell { width: 40px !important; }
        body.is-small-paper .exam-doc-header-table td { font-size: 0.88em; }
        body.is-small-paper .exam-student-info-box { font-size: 0.84em; padding: 4px 7px; }

        .exam-doc-banner-title { text-align: center; margin: var(--doc-header-pad) 0; }
        .exam-doc-banner-title h2 { margin: 0; font-size: 1.18em; font-weight: 900; text-transform: uppercase; color: #0f172a; line-height: 1.24; }
        .exam-doc-made-badge {
            display: inline-block;
            border: 1.3px solid #0f172a;
            padding: 1px 10px;
            font-weight: 900;
            font-size: 0.9em;
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
            gap: 6px;
            flex-wrap: wrap;
        }
        .part-header-box {
            background: #f1f5f9;
            border-left: 4px solid #0284c7;
            padding: 4px 8px;
            font-size: 0.96em;
            margin: var(--doc-part-gap) 0 6px 0;
            page-break-after: avoid;
            break-after: avoid;
        }

        /* THẺ CÂU HỎI & CO HÌNH TỰ ĐỘNG KHÔNG BỊ CHE MẤT */
        .doc-question-card {
            margin-bottom: var(--doc-q-gap);
            page-break-inside: avoid;
            break-inside: avoid;
            text-align: justify;
        }
        .doc-q-title { font-size: 1em; line-height: var(--doc-line-height); white-space: pre-line; overflow-wrap: break-word; }
        .doc-img-container {
            width: 100%;
            max-width: 100%;
            text-align: center;
            margin: 4px 0;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
        }
        .doc-q-img {
            display: block;
            margin: 0 auto;
            width: auto !important;
            height: auto !important;
            max-width: 100% !important;
            max-height: var(--doc-img-max-h);
            object-fit: contain;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
        }

        mjx-container[jax="SVG"] { max-width: 100% !important; }
        mjx-container[jax="SVG"] > svg { max-width: 100% !important; height: auto !important; }

        .doc-options-wrapper { display: grid; gap: 3px 10px; margin-top: 4px; }
        .opt-grid-4 { grid-template-columns: repeat(4, 1fr); }
        .opt-grid-2 { grid-template-columns: repeat(2, 1fr); }
        .opt-grid-1 { grid-template-columns: 1fr; }
        .doc-option-item { font-size: 0.98em; padding: 1px 0; line-height: var(--doc-line-height); min-width: 0; overflow-wrap: break-word; }
        .correct-highlight { color: #15803d; font-weight: 800; }
        .key-mark { color: #16a34a; font-weight: 900; }

        .doc-statements-list { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
        .doc-statement-row { display: flex; align-items: baseline; gap: 5px; font-size: 0.98em; line-height: var(--doc-line-height); }
        .st-letter { flex-shrink: 0; min-width: 18px; }
        .st-content { flex: 1; min-width: 0; overflow-wrap: break-word; }
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
            overflow-wrap: break-word;
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

        /* CHẾ ĐỘ 4: CHIA 2 CỘT TÙY CHỈNH TỶ LỆ */
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
            width: var(--col-left-pct, 40%);
            vertical-align: top;
            padding-right: 8px;
            border-right: 1.2px solid #94a3b8;
            word-wrap: break-word;
            overflow-wrap: break-word;
            min-width: 0;
            overflow: hidden;
        }
        .col-right-60 {
            width: var(--col-right-pct, 60%);
            vertical-align: top;
            padding-left: 8px;
            min-width: 0;
        }
        .col-right-60-inner {
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            padding: 4px 7px 6px 7px;
            background: #fcfcfd;
            min-height: 100%;
        }
        .col-left-40 .doc-q-img {
            max-width: 100% !important;
            max-height: var(--doc-col-img-max-h);
        }
        .col-left-40 mjx-container[jax="SVG"] { font-size: 94% !important; }

        .exam-end-mark { text-align: center; margin: 10px 0 6px 0; font-weight: 800; font-style: italic; }
        .doc-key-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 0.9em; text-align: center; }
        .doc-key-table td { border: 1px solid #0f172a; padding: 3px 5px; }

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
            #a4-sheets-output {
                display: block !important;
                gap: 0 !important;
                overflow: visible !important;
            }
            .a4-sheet, .a4-landscape-sheet {
                margin: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                page-break-after: always;
                break-after: page;
            }
            .a4-landscape-sheet .a4-sheet {
                page-break-after: auto !important;
                break-after: auto !important;
            }
            .a4-sheet:last-child, .a4-landscape-sheet:last-child {
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
<body class="${isSmallPaperInit ? "is-small-paper" : ""}">
    <div id="mm-ruler"></div>

    <div class="no-print-bar">
        <div class="no-print-status">
            <span style="font-weight:900; color:#34d399;">📄 XEM TRƯỚC IN PDF</span>
            <span class="np-badge" id="np-page-stat">Đang phân trang &amp; giàn đều...</span>
            <span class="np-badge" id="np-font-stat">Cỡ chữ: ${initialPt}pt</span>
            <span class="np-badge" id="np-margin-stat">Lề: ${mTopInit}-${mBottomInit}-${mLeftInit}-${mRightInit}mm</span>
        </div>
        <div class="no-print-actions">
            <div class="np-layout-ctrl" title="Chọn khổ giấy &amp; bố cục in trực tiếp">
                <span>📐</span>
                <select id="np-paper-layout" class="np-layout-select" onchange="changePaperLayoutLive(this.value)">
                    <option value="a4_portrait" ${initialPaperLayout === "a4_portrait" ? "selected" : ""}>A4 dọc</option>
                    <option value="a5_portrait" ${initialPaperLayout === "a5_portrait" ? "selected" : ""}>A5 dọc</option>
                    <option value="a4_2up" ${initialPaperLayout === "a4_2up" ? "selected" : ""}>A4 ghép 2 trang</option>
                    <option value="a4_booklet" ${initialPaperLayout === "a4_booklet" ? "selected" : ""}>Sách gập đôi (Booklet)</option>
                </select>
            </div>
            ${mode === "two_col_40_60" ? `
            <div class="np-split-ctrl" title="Tự chỉnh tỷ lệ cột Đề (trái) và cột Trình bày (phải)">
                <span style="font-size:10.5px; font-weight:800; color:#c4b5fd;">▥</span>
                <button type="button" class="btn-np btn-np-step" style="padding:2px 6px;" onclick="stepSplitRatio(-5)">−</button>
                <span id="np-split-val" style="font-size:11px; font-weight:900; color:#facc15; min-width:58px; text-align:center;">${splitLeftInit}%/${splitRightInit}%</span>
                <button type="button" class="btn-np btn-np-step" style="padding:2px 6px;" onclick="stepSplitRatio(5)">+</button>
                <button type="button" class="btn-np btn-np-step" style="padding:2px 6px;" onclick="setSplitRatioExact(30)">30/70</button>
                <button type="button" class="btn-np btn-np-step" style="padding:2px 6px;" onclick="setSplitRatioExact(40)">40/60</button>
                <button type="button" class="btn-np btn-np-step" style="padding:2px 6px;" onclick="setSplitRatioExact(50)">50/50</button>
            </div>` : ""}
            <button type="button" class="btn-np btn-np-justify" id="btn-np-justify" onclick="toggleJustifyMode()" title="Bật/Tắt tự động giàn đều câu hỏi chiếm hết chiều dọc trang giấy">📐 Giàn đều: BẬT</button>
            <button type="button" class="btn-np btn-np-logo" onclick="changeRandomExamLogo()">🎨 Đổi logo</button>
            <button type="button" class="btn-np btn-np-step" onclick="manualStepFont(-0.5)" title="Giảm cỡ chữ 0.5pt">A−</button>
            <button type="button" class="btn-np btn-np-step" onclick="manualStepFont(0.5)" title="Tăng cỡ chữ 0.5pt">A+</button>
            <button type="button" class="btn-np btn-np-print" onclick="window.print()">🖨️ In / Lưu PDF (Ctrl + P)</button>
        </div>
    </div>

    ${bodyHtml}
    <div id="a4-sheets-output"></div>

    <script>
        const TARGET_PAGES = ${targetPages ? Number(targetPages) : "null"};
        const REQUESTED_FONT_PT = ${fontSizePt ? Number(fontSizePt) : "null"};
        const EXPORT_MODE = ${JSON.stringify(mode)};
        const USE_DECOR_SHEETS = ${useDecorSheets ? "true" : "false"};
        const HAS_CUSTOM_MARGINS = ${useCustomMargins ? "true" : "false"};
        const DECOR_CFG = ${JSON.stringify(decorPrefs)};
        const EXAM_SHORT_TITLE = ${JSON.stringify(examTitle)};
        const EXAM_MA_DE = ${JSON.stringify(maDe)};
        let currentPaperLayout = ${JSON.stringify(initialPaperLayout)};
        let currentFontPt = ${initialPt};
        let currentSplitLeftPct = ${splitLeftInit};
        let isJustifyEnabled = true;
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
                    if (lvl === 1) { imgEl.dataset.fb = "2"; imgEl.src = "https://lh3.googleusercontent.com/u/0/d/" + fid; return; }
                }
            }
            imgEl.style.display = "none";
        }

        function getPxPerMM() {
            const ruler = document.getElementById("mm-ruler");
            return ruler && ruler.offsetHeight > 0 ? (ruler.offsetHeight / 100) : 3.779527559;
        }

        function isSmallPaperLayout() {
            return currentPaperLayout !== "a4_portrait";
        }

        function getLogicPageDimensionsMm() {
            if (currentPaperLayout === "a5_portrait") {
                return { w: 148, h: 209.4, pageSizeCss: "A5 portrait", isPaired: false };
            }
            if (currentPaperLayout === "a4_2up" || currentPaperLayout === "a4_booklet") {
                return { w: 148.5, h: 209.4, pageSizeCss: "A4 landscape", isPaired: true };
            }
            return { w: 210, h: 296.4, pageSizeCss: "A4 portrait", isPaired: false };
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
            if (isSmallPaperLayout()) {
                const mV = Math.max(5, Math.min(8, cfg.marginV * 0.72));
                const mH = Math.max(5, Math.min(8, cfg.marginH * 0.72));
                return { top: Math.round(mV * 10) / 10, right: Math.round(mH * 10) / 10, bottom: Math.round(mV * 10) / 10, left: Math.round(mH * 10) / 10 };
            }
            if (USE_DECOR_SHEETS) {
                const mV = Math.max(7, Math.min(12, cfg.marginV));
                const mH = Math.max(7, Math.min(12, cfg.marginH));
                return { top: mV, right: mH, bottom: mV, left: mH };
            }
            return { top: cfg.marginV, right: cfg.marginH, bottom: cfg.marginV, left: cfg.marginH };
        }

        function resolveFramePaddingMm(margins) {
            const hasBorder = (USE_DECOR_SHEETS && DECOR_CFG.pageBorderMode && DECOR_CFG.pageBorderMode !== "none");
            if (!hasBorder) return { padV: 0, padH: 0 };
            const minM = Math.min(margins.top, margins.right, margins.bottom, margins.left);
            if (isSmallPaperLayout()) return { padV: 2.0, padH: 2.5 };
            if (HAS_CUSTOM_MARGINS && minM <= 3.5) return { padV: 1.8, padH: 2.2 };
            if (HAS_CUSTOM_MARGINS && minM <= 6) return { padV: 2.5, padH: 3.2 };
            return { padV: 4.0, padH: 5.0 };
        }

        function computeAutoImageMaxHeight(cfg) {
            const dim = getLogicPageDimensionsMm();
            const paperScale = Math.min(1.0, dim.h / 296.4);
            const baseH = (cfg.imgMaxH || 205) * paperScale;
            const refFont = isSmallPaperLayout() ? 8.8 : 10.5;
            const fontScale = Math.min(1.25, Math.max(0.55, cfg.fontPt / refFont));
            const fullImgH = Math.round(Math.min(255, Math.max(68, baseH * (0.35 + 0.65 * fontScale))));
            const colRatioScale = Math.min(1.0, Math.max(0.52, currentSplitLeftPct / 50));
            const colImgH = Math.round(Math.max(62, fullImgH * 0.85 * colRatioScale));
            return { fullImgH, colImgH };
        }

        function applyLayoutParams(cfg) {
            lastAppliedCfg = cfg;
            const root = document.documentElement;
            const dim = getLogicPageDimensionsMm();
            document.body.classList.toggle("is-small-paper", isSmallPaperLayout());

            const dynPageStyle = document.getElementById("dynamic-page-style");
            if (dynPageStyle) {
                dynPageStyle.textContent = "@page { size: " + dim.pageSizeCss + "; margin: 0; }";
            }

            currentFontPt = cfg.fontPt;
            const imgHeights = computeAutoImageMaxHeight(cfg);
            const logoSz = isSmallPaperLayout() ? Math.round((cfg.logoSize || 48) * 0.72) : (cfg.logoSize || 48);

            root.style.setProperty("--logic-w-mm", dim.w + "mm");
            root.style.setProperty("--logic-h-mm", dim.h + "mm");
            root.style.setProperty("--doc-font-pt", cfg.fontPt + "pt");
            root.style.setProperty("--doc-line-height", String(cfg.lineHeight));
            root.style.setProperty("--doc-q-gap", cfg.qGap + "px");
            root.style.setProperty("--doc-img-max-h", imgHeights.fullImgH + "px");
            root.style.setProperty("--doc-col-img-max-h", imgHeights.colImgH + "px");
            root.style.setProperty("--doc-dot-h", cfg.dotH + "px");
            root.style.setProperty("--doc-header-pad", cfg.headerPad + "px");
            root.style.setProperty("--doc-part-gap", cfg.partGap + "px");
            root.style.setProperty("--doc-logo-size", logoSz + "px");
            root.style.setProperty("--col-left-pct", currentSplitLeftPct + "%");
            root.style.setProperty("--col-right-pct", (100 - currentSplitLeftPct) + "%");

            const m = resolveEffectiveMargins(cfg);
            const hasBorder = (USE_DECOR_SHEETS && DECOR_CFG.pageBorderMode && DECOR_CFG.pageBorderMode !== "none");
            const fp = resolveFramePaddingMm(m);

            root.style.setProperty("--sheet-margin-top", m.top + "mm");
            root.style.setProperty("--sheet-margin-right", m.right + "mm");
            root.style.setProperty("--sheet-margin-bottom", m.bottom + "mm");
            root.style.setProperty("--sheet-margin-left", m.left + "mm");
            root.style.setProperty("--frame-pad-v", fp.padV + "mm");
            root.style.setProperty("--frame-pad-h", fp.padH + "mm");

            const pageEl = document.getElementById("exam-doc-page");
            if (pageEl) {
                pageEl.classList.add("is-staging-hidden");
                const framePadH_total = hasBorder ? (2 * fp.padH) : 0;
                const borderThicknessH = hasBorder ? (DECOR_CFG.borderStyle === "double" ? 2 : 1) : 0;
                const bodyWidthMm = Math.max(92, dim.w - (m.left + m.right) - framePadH_total - borderThicknessH);
                pageEl.style.width = bodyWidthMm + "mm";
                pageEl.style.padding = "0";
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

            document.querySelectorAll("#exam-doc-page .doc-q-img").forEach(img => {
                img.style.maxHeight = "";
            });
        }

        function buildAuthorBadgeHtml() {
            if (!USE_DECOR_SHEETS || !DECOR_CFG.showAuthor) return "";
            const nameTxt = escHtml((DECOR_CFG.authorName || "").trim() || "Tác giả");
            const borderCls = "author-border-" + (DECOR_CFG.authorBorder || "none");
            const logoHtml = (DECOR_CFG.authorWithLogo !== false)
                ? '<span class="a4-mini-logo js-mini-logo-slot">' + currentLogoSvg + '</span>'
                : "";
            return '<span class="a4-author-pill ' + borderCls + '">' + logoHtml + '<span>' + nameTxt + '</span></span>';
        }

        function buildTopBandHtml() {
            if (!USE_DECOR_SHEETS) return "";
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
            if (!USE_DECOR_SHEETS) return "";
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
            const dim = getLogicPageDimensionsMm();
            const hasBorder = (DECOR_CFG.pageBorderMode && DECOR_CFG.pageBorderMode !== "none");
            const m = resolveEffectiveMargins(cfg);
            const fp = resolveFramePaddingMm(m);
            const borderThicknessV = hasBorder ? (DECOR_CFG.borderStyle === "double" ? 2.5 : 1) : 0;
            const frameOverheadV = hasBorder ? (((2 * fp.padV) + borderThicknessV) * pxPerMM) : 0;

            const probe = document.createElement("div");
            probe.style.cssText = "position:fixed; left:-99999px; top:0; visibility:hidden; width:" + Math.max(92, dim.w - 24) + "mm;";
            probe.innerHTML = buildTopBandHtml() + buildBottomBandHtml(1, 10);
            document.body.appendChild(probe);

            const topEl = probe.querySelector(".a4-page-top-band");
            const botEl = probe.querySelector(".a4-page-bottom-band");
            const topH = topEl ? (topEl.offsetHeight + 5) : 0;
            const bottomH = botEl ? (botEl.offsetHeight + 4) : 0;
            document.body.removeChild(probe);

            return { topH, bottomH, frameOverheadV };
        }

        function getUsableBodyHeightPx(cfg) {
            const pxPerMM = getPxPerMM();
            const dim = getLogicPageDimensionsMm();
            const m = resolveEffectiveMargins(cfg);
            const { topH, bottomH, frameOverheadV } = measureDecorBandsHeightPx(cfg);
            const totalSheetH = dim.h * pxPerMM;
            return Math.max(150, totalSheetH - ((m.top + m.bottom) * pxPerMM) - frameOverheadV - topH - bottomH - 4);
        }

        function clampOversizedStagingImages(usableBodyH) {
            const cards = document.querySelectorAll("#exam-doc-page .doc-question-card");
            cards.forEach(card => {
                const imgs = card.querySelectorAll(".doc-q-img");
                if (!imgs || imgs.length === 0) return;

                const maxAllowedCardH = usableBodyH - 10;
                let guard = 0;
                while (card.offsetHeight > maxAllowedCardH && guard < 10) {
                    const excess = card.offsetHeight - maxAllowedCardH;
                    const stepReduce = Math.max(10, Math.ceil(excess / imgs.length) + 4);
                    let changed = false;
                    imgs.forEach(img => {
                        if (img.style.display === "none") return;
                        const curH = img.offsetHeight || parseInt(getComputedStyle(img).maxHeight, 10) || 150;
                        const nextH = Math.max(48, curH - stepReduce);
                        if (nextH < curH) {
                            img.style.maxHeight = nextH + "px";
                            changed = true;
                        }
                    });
                    if (!changed) break;
                    guard++;
                }
            });
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
            const usableBodyH = getUsableBodyHeightPx(cfg);
            clampOversizedStagingImages(usableBodyH);

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
            return { pages, usableBodyH };
        }

        function measureContentBottomOffset(bodySlot) {
            const children = Array.from(bodySlot.children);
            if (children.length === 0) return 0;
            const bodyTop = bodySlot.getBoundingClientRect().top;
            const lastEl = children[children.length - 1];
            return lastEl.getBoundingClientRect().bottom - bodyTop;
        }

        function ensureImagesInsidePageBounds(bodySlot, availH) {
            const imgs = bodySlot.querySelectorAll(".doc-q-img");
            imgs.forEach(img => {
                if (img.style.display === "none") return;
                const colParent = img.closest(".col-left-40, .doc-img-container");
                if (colParent) {
                    const maxW = colParent.clientWidth;
                    if (maxW > 20 && img.getBoundingClientRect().width > maxW + 1) {
                        img.style.maxWidth = maxW + "px";
                    }
                }
            });

            let guard = 0;
            while (measureContentBottomOffset(bodySlot) > availH && guard < 12) {
                const curOverflow = measureContentBottomOffset(bodySlot) - availH;
                const pageImgs = Array.from(bodySlot.querySelectorAll(".doc-q-img")).filter(im => im.style.display !== "none" && im.offsetHeight > 50);
                if (pageImgs.length === 0) break;
                let tallest = pageImgs[0];
                pageImgs.forEach(im => { if (im.offsetHeight > tallest.offsetHeight) tallest = im; });
                const step = Math.max(8, Math.ceil(curOverflow) + 4);
                tallest.style.maxHeight = Math.max(48, tallest.offsetHeight - step) + "px";
                guard++;
            }
        }

        function justifySinglePageBody(bodySlot, isLastPage) {
            const availH = bodySlot.clientHeight || 0;
            if (availH <= 0) return;

            ensureImagesInsidePageBounds(bodySlot, availH);

            const children = Array.from(bodySlot.children);
            if (children.length === 0) return;

            let usedH = measureContentBottomOffset(bodySlot);
            let slack = availH - usedH;

            if (slack < -0.5) {
                let shrinkGuard = 0;
                while (measureContentBottomOffset(bodySlot) > availH && shrinkGuard < 24) {
                    let shrunkAny = false;
                    for (let i = 0; i < children.length; i++) {
                        const el = children[i];
                        const curMb = parseFloat(getComputedStyle(el).marginBottom) || 0;
                        if (curMb > 1) {
                            el.style.marginBottom = Math.max(0, curMb - 1.5) + "px";
                            shrunkAny = true;
                        }
                    }
                    if (!shrunkAny) break;
                    shrinkGuard++;
                }
                return;
            }

            if (!isJustifyEnabled || slack <= 4) return;

            const fillRatio = usedH / availH;
            const shouldFillFull = !isLastPage || (fillRatio >= 0.42);
            const targetFillSlack = shouldFillFull
                ? Math.max(0, slack - 2)
                : Math.min(slack * 0.28, Math.max(0, children.length - 1) * 14);

            if (targetFillSlack <= 3) return;

            if (EXPORT_MODE === "blank_below" || EXPORT_MODE === "two_col_40_60") {
                const dotsWraps = Array.from(bodySlot.querySelectorAll(".pdf-dots-wrap"));
                if (dotsWraps.length > 0) {
                    const maxHAfterDots = usedH + targetFillSlack * 0.48;
                    const lvlWeight = { vdc: 4, vdt: 3, th: 2, nb: 1 };
                    const sortedWraps = [...dotsWraps].sort((a, b) => {
                        const ca = a.closest(".doc-question-card");
                        const cb = b.closest(".doc-question-card");
                        const wa = lvlWeight[(ca && ca.dataset.level) || "nb"] || 1;
                        const wb = lvlWeight[(cb && cb.dataset.level) || "nb"] || 1;
                        return wb - wa;
                    });

                    let addedGuard = 0;
                    while (measureContentBottomOffset(bodySlot) < maxHAfterDots && addedGuard < 20) {
                        let addedInRound = false;
                        for (let i = 0; i < sortedWraps.length; i++) {
                            const w = sortedWraps[i];
                            const line = document.createElement("div");
                            line.className = "pdf-dot-line";
                            w.appendChild(line);
                            if (measureContentBottomOffset(bodySlot) > availH - 4) {
                                w.removeChild(line);
                                return;
                            }
                            addedInRound = true;
                            if (measureContentBottomOffset(bodySlot) >= maxHAfterDots) break;
                        }
                        if (!addedInRound) break;
                        addedGuard++;
                    }
                }
            }

            const remUsed = measureContentBottomOffset(bodySlot);
            const remSlack = availH - remUsed;
            if (remSlack <= 2) return;

            const finalTarget = shouldFillFull
                ? Math.max(0, remSlack - 2)
                : Math.min(remSlack * 0.28, Math.max(0, children.length - 1) * 12);

            if (finalTarget <= 2) return;

            const gapTargets = [];
            for (let i = 0; i < children.length - 1; i++) {
                const el = children[i];
                const weight = (el.classList && el.classList.contains("part-header-box")) ? 0.25 : 1.0;
                gapTargets.push({ el, weight });
            }

            const totalWeight = gapTargets.reduce((s, item) => s + item.weight, 0);
            if (totalWeight > 0) {
                gapTargets.forEach(item => {
                    const curMb = parseFloat(getComputedStyle(item.el).marginBottom) || 0;
                    const extra = (finalTarget * item.weight) / totalWeight;
                    item.el.style.marginBottom = (curMb + extra).toFixed(2) + "px";
                });
            }

            let safeGuard = 0;
            while (measureContentBottomOffset(bodySlot) > availH && safeGuard < 25) {
                for (let i = 0; i < gapTargets.length; i++) {
                    const el = gapTargets[i].el;
                    const curMb = parseFloat(getComputedStyle(el).marginBottom) || 0;
                    if (curMb > 1) {
                        el.style.marginBottom = Math.max(0, curMb - 1) + "px";
                    }
                }
                safeGuard++;
            }
        }

        function createBlankFillerSheet() {
            const filler = document.createElement("div");
            filler.className = "a4-sheet is-blank-filler border-mode-none";
            return filler;
        }

        function assemblePairedLandscapeSheets(output, sheetList) {
            const showCenterGuide = !(USE_DECOR_SHEETS && DECOR_CFG.pageBorderMode === "alt3");
            const pairedSheets = [];

            if (currentPaperLayout === "a4_2up") {
                for (let i = 0; i < sheetList.length; i += 2) {
                    const wrap = document.createElement("div");
                    wrap.className = "a4-landscape-sheet" + (showCenterGuide ? " has-center-guide" : "");
                    wrap.appendChild(sheetList[i]);
                    wrap.appendChild(sheetList[i + 1] ? sheetList[i + 1] : createBlankFillerSheet());
                    pairedSheets.push(wrap);
                }
            } else if (currentPaperLayout === "a4_booklet") {
                const n = sheetList.length;
                const P = Math.max(4, Math.ceil(n / 4) * 4);
                const padded = [...sheetList];
                while (padded.length < P) padded.push(createBlankFillerSheet());

                const pairCount = P / 4;
                for (let k = 0; k < pairCount; k++) {
                    // Mặt trước: [P - 2k | 2k + 1]
                    const front = document.createElement("div");
                    front.className = "a4-landscape-sheet" + (showCenterGuide ? " has-center-guide" : "");
                    front.appendChild(padded[P - 2 * k - 1]);
                    front.appendChild(padded[2 * k]);
                    pairedSheets.push(front);

                    // Mặt sau: [2k + 2 | P - 2k - 1]
                    const back = document.createElement("div");
                    back.className = "a4-landscape-sheet" + (showCenterGuide ? " has-center-guide" : "");
                    back.appendChild(padded[2 * k + 1]);
                    back.appendChild(padded[P - 2 * k - 2]);
                    pairedSheets.push(back);
                }
            }

            output.innerHTML = "";
            pairedSheets.forEach(ps => output.appendChild(ps));
            return pairedSheets.length;
        }

        function buildSheetsFromCurrentCfg(cfg) {
            const output = document.getElementById("a4-sheets-output");
            const staging = document.getElementById("exam-doc-page");
            if (!output || !staging) return { logicPages: 1, physicalSheets: 1 };

            staging.classList.add("is-staging-hidden");
            const { pages: pageGroups } = paginateBlocksIntoPageGroups(cfg);
            const totalPages = Math.max(1, pageGroups.length);

            const bModeClass = USE_DECOR_SHEETS ? ("border-mode-" + (DECOR_CFG.pageBorderMode || "none")) : "border-mode-none";
            const bStyleClass = USE_DECOR_SHEETS ? ("border-style-" + (DECOR_CFG.borderStyle || "double")) : "border-style-none";
            const wmText = escHtml((DECOR_CFG.authorName || "").trim() || EXAM_SHORT_TITLE);
            const wmHtml = (USE_DECOR_SHEETS && DECOR_CFG.watermark) ? '<div class="a4-watermark"><span>' + wmText + '</span></div>' : "";

            output.innerHTML = "";
            const createdSheets = [];

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
                justifySinglePageBody(bodySlot, pageNum === totalPages);
                createdSheets.push(sheet);
            });

            let physicalSheets = totalPages;
            if (currentPaperLayout === "a4_2up" || currentPaperLayout === "a4_booklet") {
                physicalSheets = assemblePairedLandscapeSheets(output, createdSheets);
            }

            return { logicPages: totalPages, physicalSheets };
        }

        function estimatePagesCount(cfg) {
            const { pages } = paginateBlocksIntoPageGroups(cfg);
            return pages.length;
        }

        function updateTopStatusBadges(resObj, noteText = "") {
            const estPages = (typeof resObj === "object" && resObj) ? resObj.logicPages : (resObj || 1);
            const physSheets = (typeof resObj === "object" && resObj) ? resObj.physicalSheets : estPages;

            const pEl = document.getElementById("np-page-stat");
            const fEl = document.getElementById("np-font-stat");
            const mEl = document.getElementById("np-margin-stat");
            const sEl = document.getElementById("np-split-val");
            const jBtn = document.getElementById("btn-np-justify");
            const lSel = document.getElementById("np-paper-layout");

            const unitName = isSmallPaperLayout() ? "trang A5" : "trang A4";

            if (pEl) {
                let extraSheetTxt = "";
                if (currentPaperLayout === "a4_2up") {
                    extraSheetTxt = " (" + physSheets + " tờ A4 ngang)";
                } else if (currentPaperLayout === "a4_booklet") {
                    extraSheetTxt = " (" + (physSheets / 2) + " tờ in 2 mặt)";
                }

                if (TARGET_PAGES) {
                    const isExact = (estPages <= TARGET_PAGES);
                    pEl.className = "np-badge " + (isExact ? "is-ok" : "is-warn");
                    pEl.textContent = estPages + " / " + TARGET_PAGES + " " + unitName + extraSheetTxt + (noteText ? " (" + noteText + ")" : "");
                } else {
                    pEl.className = "np-badge is-ok";
                    pEl.textContent = estPages + " " + unitName + extraSheetTxt + (isJustifyEnabled ? " • Giàn đều" : "");
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
            if (sEl) {
                sEl.textContent = currentSplitLeftPct + "%/" + (100 - currentSplitLeftPct) + "%";
            }
            if (jBtn) {
                jBtn.textContent = isJustifyEnabled ? "📐 Giàn đều: BẬT" : "📐 Giàn đều: TẮT";
                jBtn.classList.toggle("is-off", !isJustifyEnabled);
            }
            if (lSel && lSel.value !== currentPaperLayout) {
                lSel.value = currentPaperLayout;
            }
        }

        function getDefaultFontForCurrentPaper() {
            if (REQUESTED_FONT_PT) return REQUESTED_FONT_PT;
            return isSmallPaperLayout() ? 8.8 : ${DEFAULT_FONT_PT};
        }

        function fitDocumentToTargetPages() {
            const defaultFont = getDefaultFontForCurrentPaper();
            if (!TARGET_PAGES) {
                const baseCfg = {
                    fontPt: defaultFont,
                    lineHeight: isSmallPaperLayout() ? 1.32 : 1.42,
                    qGap: isSmallPaperLayout() ? 7 : 10,
                    imgMaxH: 205,
                    dotH: isSmallPaperLayout() ? 14 : 17,
                    headerPad: isSmallPaperLayout() ? 4 : 6,
                    partGap: isSmallPaperLayout() ? 6 : 10,
                    logoSize: 48,
                    marginV: 12,
                    marginH: 12,
                    lineRatio: 1
                };
                applyLayoutParams(baseCfg);
                const res = buildSheetsFromCurrentCfg(baseCfg);
                updateTopStatusBadges(res);
                return res.logicPages;
            }

            const startFont = defaultFont;
            const candidates = [];

            const spacingPresets = [
                { lineHeight: 1.35, qGap: 8, imgMaxH: 195, dotH: 15, headerPad: 5, partGap: 8, logoSize: 46, marginV: 11, marginH: 11, lineRatio: 1.0 },
                { lineHeight: 1.26, qGap: 6, imgMaxH: 170, dotH: 13.5, headerPad: 4, partGap: 6, logoSize: 42, marginV: 9,  marginH: 9,  lineRatio: 0.9 },
                { lineHeight: 1.18, qGap: 4, imgMaxH: 145, dotH: 12.5, headerPad: 3, partGap: 5, logoSize: 38, marginV: 7,  marginH: 8,  lineRatio: 0.8 },
                { lineHeight: 1.12, qGap: 3, imgMaxH: 120, dotH: 11, headerPad: 2, partGap: 4, logoSize: 34, marginV: 6, marginH: 7, lineRatio: 0.7 }
            ];
            spacingPresets.forEach(sp => candidates.push({ fontPt: startFont, ...sp }));

            for (let f = Math.round((startFont - 0.5) * 10) / 10; f >= 6.4; f = Math.round((f - 0.4) * 10) / 10) {
                candidates.push({
                    fontPt: f,
                    lineHeight: f >= 9 ? 1.22 : 1.12,
                    qGap: f >= 9 ? 5 : 3,
                    imgMaxH: f >= 9 ? 150 : 112,
                    dotH: f >= 9 ? 13 : 10.5,
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
                estPages = estimatePagesCount(candidates[i]);
                chosen = candidates[i];
                if (estPages <= TARGET_PAGES) {
                    break;
                }
            }

            if (estPages < TARGET_PAGES) {
                const looseCfg = {
                    fontPt: REQUESTED_FONT_PT ? Math.max(REQUESTED_FONT_PT, 10.5) : (isSmallPaperLayout() ? 9.8 : 11.5),
                    lineHeight: 1.56,
                    qGap: 14,
                    imgMaxH: 230,
                    dotH: 18,
                    headerPad: 8,
                    partGap: 12,
                    logoSize: 50,
                    marginV: 12,
                    marginH: 12,
                    lineRatio: 1.2
                };
                applyLayoutParams(looseCfg);
                const looseEst = estimatePagesCount(looseCfg);
                if (looseEst <= TARGET_PAGES) {
                    chosen = looseCfg;
                    estPages = looseEst;
                } else {
                    applyLayoutParams(chosen);
                }
            }

            const finalRes = buildSheetsFromCurrentCfg(chosen);

            const note = (REQUESTED_FONT_PT && chosen.fontPt < REQUESTED_FONT_PT)
                ? "Co từ " + REQUESTED_FONT_PT + "pt -> " + chosen.fontPt + "pt"
                : "";
            updateTopStatusBadges(finalRes, note);
            return finalRes.logicPages;
        }

        function manualStepFont(delta) {
            const nextPt = Math.max(6.2, Math.min(18, Math.round((currentFontPt + delta) * 10) / 10));
            const baseCfg = lastAppliedCfg ? { ...lastAppliedCfg, fontPt: nextPt } : {
                fontPt: nextPt,
                lineHeight: isSmallPaperLayout() ? 1.32 : 1.42,
                qGap: isSmallPaperLayout() ? 7 : 10,
                imgMaxH: 205,
                dotH: 16,
                headerPad: 6,
                partGap: 9,
                logoSize: 48,
                marginV: TARGET_PAGES ? 8 : 12,
                marginH: TARGET_PAGES ? 8 : 12
            };
            applyLayoutParams(baseCfg);
            const res = buildSheetsFromCurrentCfg(baseCfg);
            updateTopStatusBadges(res, "Chỉnh tay");
        }

        function setSplitRatioExact(newLeftPct) {
            currentSplitLeftPct = Math.max(25, Math.min(75, parseInt(newLeftPct, 10) || 40));
            const hdrMode = document.getElementById("hdr-mode-label");
            if (hdrMode && EXPORT_MODE === "two_col_40_60") {
                hdrMode.textContent = "ĐỀ THI 2 CỘT (" + currentSplitLeftPct + "% ĐỀ | " + (100 - currentSplitLeftPct) + "% BÀI LÀM)";
            }
            const cfg = lastAppliedCfg || {
                fontPt: currentFontPt,
                lineHeight: 1.4,
                qGap: 9,
                imgMaxH: 205,
                dotH: 16,
                headerPad: 6,
                partGap: 9,
                logoSize: 48,
                marginV: TARGET_PAGES ? 8 : 12,
                marginH: TARGET_PAGES ? 8 : 12
            };
            applyLayoutParams(cfg);
            const res = buildSheetsFromCurrentCfg(cfg);
            updateTopStatusBadges(res, "2 cột " + currentSplitLeftPct + "/" + (100 - currentSplitLeftPct));
        }

        function stepSplitRatio(delta) {
            setSplitRatioExact(currentSplitLeftPct + delta);
        }

        function changePaperLayoutLive(newLayout) {
            currentPaperLayout = newLayout || "a4_portrait";
            fitDocumentToTargetPages();
        }

        function toggleJustifyMode() {
            isJustifyEnabled = !isJustifyEnabled;
            const cfg = lastAppliedCfg || {
                fontPt: currentFontPt,
                lineHeight: 1.4,
                qGap: 9,
                imgMaxH: 205,
                dotH: 16,
                headerPad: 6,
                partGap: 9,
                logoSize: 48,
                marginV: TARGET_PAGES ? 8 : 12,
                marginH: TARGET_PAGES ? 8 : 12
            };
            applyLayoutParams(cfg);
            const res = buildSheetsFromCurrentCfg(cfg);
            updateTopStatusBadges(res);
        }

        function waitAllImagesLoaded(maxWaitMs = 2800) {
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
                await waitAllImagesLoaded(2500);
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
    window.onQbPdfPaperLayoutChange = onQbPdfPaperLayoutChange;
    window.toggleQbPdfSplitPanel = toggleQbPdfSplitPanel;
    window.selectQbSplitPreset = selectQbSplitPreset;
    window.onQbSplitRatioChange = onQbSplitRatioChange;
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
