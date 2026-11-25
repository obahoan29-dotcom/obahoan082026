// =========================================================
// FILE: portal-results-table.js 
// BẢNG KẾT QUẢ THI: ĐÃ BỔ SUNG CẢM ỨNG 2 NGÓN TAY PHÓNG TO THU NHỎ
// ĐÃ FIX TRIỆT ĐỂ:
// 1. VỪA MÀN HIỂN THỊ ĐỦ 100% CẢ 17 CỘT TRÊN 1 MÀN HÌNH (KHÔNG TRÀN PHẢI)
// 2. PHÓNG TO CỠ CHỮ TỐI ĐA CÓ THỂ KHI Ở CHẾ ĐỘ VỪA MÀN (TỰ CẬP NHẬT KHI LỌC/RESIZE)
// 3. PORTAL MENU LẦN THI / XẾP HẠNG / SỐ ĐỀ THI RA DOCUMENT.BODY NỔI TRÊN CÙNG,
//    KHÔNG BAO GIỜ BỊ CHÌM SAU CÁC DÒNG HAY LỆCH VỊ TRÍ KHI BẬT VỪA MÀN / ZOOM
// =========================================================

let tableDisplaySettings = { fontSize: 13, rowPadding: 9 };
let _liveDoingTickerInterval = null;

let modalCustomZoomLevel = 1.0;
let isFitAllRowsActive = false;
let _fitResizeTimer = null;

(function injectAttemptDropdownStyles() {
    const styleId = "status-attempt-dropdown-styles";
    const oldStyle = document.getElementById(styleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        #btn-auto-collect-drafts {
            display: none !important;
        }

        .result-fullscreen-modal {
            overscroll-behavior: contain !important;
            touch-action: pan-x pan-y !important;
        }

        body.modal-backdrop-locked {
            overflow: hidden !important;
            touch-action: none !important;
            overscroll-behavior: contain !important;
        }

        .result-modal-header {
            padding: 2px 8px !important;
            min-height: 28px !important;
            height: 28px !important;
            max-height: 28px !important;
            gap: 4px !important;
            background: #ffffff !important;
            border-bottom: 1.5px solid #e2e8f0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            scrollbar-width: none !important;
        }
        .result-modal-header::-webkit-scrollbar { display: none; }

        .result-modal-title-box {
            gap: 5px !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
            height: 24px !important;
            display: flex !important;
            align-items: center !important;
        }

        #btn-result-back-action {
            padding: 1px 7px !important;
            font-size: 10.5px !important;
            border-radius: 5px !important;
            height: 22px !important;
            line-height: 1 !important;
            flex-shrink: 0 !important;
        }

        .result-modal-icon {
            display: none !important;
        }

        .result-modal-title-box > div:last-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 5px !important;
            min-width: 0 !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
        }

        .result-modal-title-box > div:last-child > div:first-child {
            font-size: 11px !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            color: #64748b !important;
            flex-shrink: 0 !important;
        }

        .result-modal-heading {
            font-size: 11.5px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 280px !important;
            display: inline-block !important;
        }

        .result-modal-subheading {
            display: none !important;
        }

        .result-modal-tools {
            gap: 3px !important;
            height: 24px !important;
            display: flex !important;
            align-items: center !important;
            flex-shrink: 0 !important;
        }

        .result-search-input {
            padding: 2px 7px !important;
            height: 22px !important;
            font-size: 11px !important;
            width: 105px !important;
            border-radius: 11px !important;
        }
        .result-search-input:focus {
            width: 130px !important;
        }

        #btn-toggle-autorefresh,
        .btn-refresh-result,
        .btn-regrade-exam,
        .btn-upload-json-backup,
        .btn-export-excel,
        .btn-fit-all-rows,
        .btn-temp-draft-capture {
            padding: 2px 7px !important;
            font-size: 10.5px !important;
            height: 22px !important;
            border-radius: 11px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
        }

        .btn-temp-draft-capture {
            background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%) !important;
            color: #ffffff !important;
            border: 1px solid #5eead4 !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            box-shadow: 0 1px 4px rgba(13, 148, 136, 0.25) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
            user-select: none !important;
            font-family: inherit !important;
        }
        .btn-temp-draft-capture:hover {
            filter: brightness(1.15) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 6px rgba(13, 148, 136, 0.35) !important;
        }
        .btn-temp-draft-capture:active {
            transform: translateY(1.5px) scale(0.96) !important;
        }

        .btn-table-settings,
        .btn-close-result-modal {
            width: 22px !important;
            height: 22px !important;
            font-size: 12px !important;
            line-height: 1 !important;
            padding: 0 !important;
            flex-shrink: 0 !important;
        }

        .result-modal-stats-bar {
            padding: 1px 8px !important;
            font-size: 10px !important;
            min-height: 20px !important;
            height: 22px !important;
            gap: 3px !important;
            background: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            box-sizing: border-box !important;
        }

        .result-modal-stats-bar .stat-badge-item {
            padding: 0px 4px !important;
            font-size: 9.5px !important;
            border-radius: 4px !important;
            height: 18px !important;
            display: inline-flex !important;
            align-items: center !important;
        }

        #btn-view-detailed-stats {
            padding: 1px 6px !important;
            font-size: 9.5px !important;
            height: 18px !important;
            border-radius: 9px !important;
        }

        .result-modal-body {
            padding: 2px 4px !important;
            transform-origin: top left !important;
            transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .result-table-card {
            border-radius: 6px !important;
        }

        .btn-fit-all-rows {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
            color: #ffffff !important;
            border: 1px solid #7dd3fc !important;
            border-radius: 11px !important;
            padding: 2px 7px !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            box-shadow: 0 1px 4px rgba(2, 132, 199, 0.25) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
            user-select: none !important;
            height: 22px !important;
            font-family: inherit !important;
        }
        .btn-fit-all-rows:hover {
            filter: brightness(1.12) !important;
            transform: translateY(-1px) !important;
        }
        .btn-fit-all-rows.is-fitted {
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%) !important;
            border-color: #fdba74 !important;
        }

        .modal-independent-zoom-control {
            display: inline-flex !important;
            align-items: center !important;
            gap: 1px !important;
            background: #1e293b !important;
            border: 1px solid #475569 !important;
            border-radius: 11px !important;
            padding: 1px 2px !important;
            user-select: none !important;
            height: 22px !important;
            box-sizing: border-box !important;
        }
        .btn-modal-zoom-step {
            width: 18px !important;
            height: 18px !important;
            border-radius: 50% !important;
            border: none !important;
            background: #334155 !important;
            color: #ffffff !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
            padding: 0 !important;
            line-height: 1 !important;
        }
        .btn-modal-zoom-step:hover {
            background: #0284c7 !important;
        }
        .modal-zoom-val-badge {
            font-size: 10px !important;
            font-weight: 800 !important;
            color: #38bdf8 !important;
            padding: 0 3px !important;
            min-width: 32px !important;
            text-align: center !important;
            font-family: 'Be Vietnam Pro', monospace !important;
            cursor: pointer !important;
        }

        /* ========================================================= */
        /* CHẾ ĐỘ VỪA MÀN: TỔNG 17 CỘT = ĐÚNG 100% CHIỀU RỘNG BẢNG  */
        /* ========================================================= */
        .result-table.table-fitted-compact {
            --table-row-padding-y: 0px !important;
            --table-row-padding-x: 2px !important;
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
        }
        .result-table.table-fitted-compact thead th {
            padding: 2px 2px !important;
            font-size: max(9px, calc(var(--table-font-size, 12px) - 1px)) !important;
            line-height: 1.15 !important;
            border-right: 1px solid #334155 !important;
            border-bottom: 1.5px solid #0284c7 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            min-width: 0 !important;
            max-width: none !important;
        }
        .result-table.table-fitted-compact thead th > *,
        .result-table.table-fitted-compact tbody td > * {
            max-width: 100% !important;
            min-width: 0 !important;
        }
        .result-table.table-fitted-compact tbody tr {
            height: auto !important;
        }
        .result-table.table-fitted-compact tbody td {
            padding: 1px 2px !important;
            font-size: var(--table-font-size, 12px) !important;
            line-height: 1.16 !important;
            border-right: 1px solid #cbd5e1 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            min-width: 0 !important;
            max-width: none !important;
        }
        .result-table.table-fitted-compact tbody td.td-attempt-cell-wrap {
            padding: 1px 2px !important;
        }

        /* Phân bổ chuẩn 100% cho toàn bộ 17 cột (tổng = 100.0%) */
        .result-table.table-fitted-compact th.td-stt,
        .result-table.table-fitted-compact th:nth-child(1) { width: 2.5% !important; }
        .result-table.table-fitted-compact th.td-exam-col,
        .result-table.table-fitted-compact th:nth-child(2) { width: 9.0% !important; }
        .result-table.table-fitted-compact th:nth-child(3) { width: 4.7% !important; }
        .result-table.table-fitted-compact th:nth-child(4) { width: 8.2% !important; }
        .result-table.table-fitted-compact th:nth-child(5) { width: 6.8% !important; }
        .result-table.table-fitted-compact th:nth-child(6) { width: 10.8% !important; }
        .result-table.table-fitted-compact th:nth-child(7) { width: 3.3% !important; }
        .result-table.table-fitted-compact th:nth-child(8) { width: 4.3% !important; }
        .result-table.table-fitted-compact th:nth-child(9) { width: 6.6% !important; }
        .result-table.table-fitted-compact th:nth-child(10) { width: 4.8% !important; }
        .result-table.table-fitted-compact th:nth-child(11) { width: 3.4% !important; }
        .result-table.table-fitted-compact th:nth-child(12) { width: 5.8% !important; }
        .result-table.table-fitted-compact th:nth-child(13) { width: 5.2% !important; }
        .result-table.table-fitted-compact th:nth-child(14) { width: 5.2% !important; }
        .result-table.table-fitted-compact th:nth-child(15) { width: 11.6% !important; }
        .result-table.table-fitted-compact th.th-force-submit-col,
        .result-table.table-fitted-compact th:nth-child(16) { width: 4.8% !important; }
        .result-table.table-fitted-compact th.th-row-action-col,
        .result-table.table-fitted-compact th:nth-child(17) { width: 3.0% !important; }

        /* Thu gọn các pill/nút bên trong ô khi bật Vừa màn để chữ phóng to được tối đa */
        .result-table.table-fitted-compact .btn-exam-picker,
        .result-table.table-fitted-compact .btn-rank-picker {
            padding: 1px 3px !important;
            font-size: 0.92em !important;
            line-height: 1.15 !important;
            border-radius: 5px !important;
            overflow: hidden !important;
            gap: 2px !important;
        }
        .result-table.table-fitted-compact .btn-force-submit-all-header {
            padding: 0px 3px !important;
            font-size: 0.78em !important;
            line-height: 1.15 !important;
            margin-top: 1px !important;
            border-radius: 4px !important;
        }
        .result-table.table-fitted-compact .btn-attempt-badge-multi,
        .result-table.table-fitted-compact .btn-attempt-badge-single {
            padding: 0px 5px !important;
            font-size: 0.9em !important;
            line-height: 1.22 !important;
            border-radius: 9px !important;
        }
        .result-table.table-fitted-compact .status-pill,
        .result-table.table-fitted-compact .status-doing-heartbeat,
        .result-table.table-fitted-compact .class-badge,
        .result-table.table-fitted-compact .score-pill-high,
        .result-table.table-fitted-compact .score-pill-mid,
        .result-table.table-fitted-compact .score-pill-low,
        .result-table.table-fitted-compact .tabs-warn,
        .result-table.table-fitted-compact .live-doing-timer-pill {
            padding: 0px 4px !important;
            font-size: 0.9em !important;
            line-height: 1.22 !important;
            border-width: 1px !important;
        }
        .result-table.table-fitted-compact .status-doing-heartbeat .heartbeat-icon {
            font-size: 0.95em !important;
        }
        .result-table.table-fitted-compact .btn-force-submit-item,
        .result-table.table-fitted-compact .btn-delete-result-row {
            padding: 0px 4px !important;
            font-size: 0.88em !important;
            line-height: 1.22 !important;
            border-radius: 4px !important;
        }
        .result-table.table-fitted-compact .tag-free-student {
            font-size: 0.78em !important;
            padding: 0px 3px !important;
            margin-left: 2px !important;
        }
        .result-table.table-fitted-compact td:nth-child(12) span {
            padding: 0px 4px !important;
            font-size: 0.9em !important;
            line-height: 1.22 !important;
            display: inline-block !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            vertical-align: middle !important;
        }

        .btn-force-submit-item {
            background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%) !important;
            color: #ffffff !important;
            border: 1px solid #f87171 !important;
            border-radius: 6px !important;
            padding: 2px 7px !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            box-shadow: 0 1px 4px rgba(239, 68, 68, 0.28) !important;
            transition: all 0.15s ease !important;
            user-select: none !important;
            white-space: nowrap !important;
        }
        .btn-force-submit-item:hover { filter: brightness(1.15) !important; transform: scale(1.04) !important; }
        .btn-force-submit-item:active { transform: translateY(1.5px) scale(0.96) !important; }

        .btn-force-submit-all-header {
            background: linear-gradient(135deg, #f97316 0%, #c2410c 100%) !important;
            color: #ffffff !important;
            border: 1px solid #fdba74 !important;
            border-radius: 6px !important;
            padding: 2px 5px !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            transition: 0.15s !important;
            margin-top: 2px !important;
        }
        .btn-force-submit-all-header:hover { filter: brightness(1.1) !important; }

        @keyframes heartbeatDoing {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.65), 0 0 10px rgba(192, 132, 252, 0.5); }
            14% { transform: scale(1.13); box-shadow: 0 0 18px 5px rgba(168, 85, 247, 0.85), 0 0 30px rgba(147, 51, 234, 0.7); }
            28% { transform: scale(1.02); box-shadow: 0 0 8px 2px rgba(168, 85, 247, 0.5), 0 0 16px rgba(192, 132, 252, 0.4); }
            42% { transform: scale(1.18); box-shadow: 0 0 22px 6px rgba(147, 51, 234, 0.95), 0 0 38px rgba(126, 34, 206, 0.8); }
            70% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0), 0 0 8px rgba(192, 132, 252, 0.25); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0), 0 0 8px rgba(192, 132, 252, 0.25); }
        }

        .status-doing-heartbeat {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 4px 13px !important;
            border-radius: 20px !important;
            background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%) !important;
            color: #6b21a8 !important;
            border: 1.8px solid #a855f7 !important;
            font-weight: 900 !important;
            font-size: 0.95em !important;
            animation: heartbeatDoing 1.35s infinite ease-in-out !important;
            white-space: nowrap !important;
            user-select: none !important;
            letter-spacing: -0.2px !important;
            text-shadow: 0 0 2px rgba(168, 85, 247, 0.4) !important;
        }
        .status-doing-heartbeat.free-mode {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%) !important;
            color: #92400e !important;
            border-color: #f59e0b !important;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.45) !important;
        }
        .status-doing-heartbeat.is-away {
            animation: none !important;
            background: #fff7ed !important;
            color: #c2410c !important;
            border-color: #fb923c !important;
            box-shadow: 0 1px 4px rgba(249, 115, 22, 0.25) !important;
        }
        .status-doing-heartbeat .heartbeat-icon { font-size: 15px !important; line-height: 1 !important; }

        tr.row-student-is-doing td { background-color: #faf5ff !important; }
        tr.row-student-is-doing:hover td { background-color: #f3e8ff !important; }
        tr.row-student-is-doing .td-stt { background-color: #e9d5ff !important; color: #581c87 !important; font-weight: 900 !important; }

        .live-doing-timer-pill {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            color: #7e22ce !important;
            font-weight: 900 !important;
            font-family: 'Courier New', Courier, monospace !important;
            background: #faf5ff !important;
            padding: 3px 8px !important;
            border-radius: 8px !important;
            border: 1.5px solid #d8b4fe !important;
            box-shadow: 0 1px 4px rgba(168, 85, 247, 0.2) !important;
            white-space: nowrap !important;
        }

        .td-attempt-cell-wrap {
            text-align: center !important;
            overflow: visible !important;
            position: relative !important;
            padding: 4px 6px !important;
        }

        .btn-attempt-badge-multi {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%) !important;
            color: #ffffff !important;
            border: none !important;
            padding: 3px 12px !important;
            border-radius: 14px !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            box-shadow: 0 2px 7px rgba(225, 29, 72, 0.35) !important;
            transition: all 0.15s ease !important;
            user-select: none !important;
            white-space: nowrap !important;
        }
        .btn-attempt-badge-single {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: #ffffff !important;
            color: #1e293b !important;
            border: 1.2px solid #cbd5e1 !important;
            padding: 3px 12px !important;
            border-radius: 14px !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
        }
        .attempt-picker-wrapper { position: relative !important; display: inline-block !important; }

        .attempt-dropdown-menu {
            display: none;
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            min-width: 255px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 14px 35px rgba(15, 23, 42, 0.28), 0 0 0 1.5px #cbd5e1;
            border: 1.5px solid #cbd5e1;
            padding: 8px 10px;
            z-index: 2147483641;
            animation: popInBadge 0.16s cubic-bezier(0.16, 1, 0.3, 1);
            text-align: left;
            white-space: nowrap;
        }
        .attempt-dropdown-menu.show { display: flex; flex-direction: column; gap: 4px; }
        .attempt-dropdown-header { font-size: 11px !important; font-weight: 900 !important; color: #334155 !important; text-align: center !important; margin-bottom: 5px !important; }
        .attempt-menu-item { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; padding: 6px 10px !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 700 !important; cursor: pointer !important; color: #0f172a !important; }
        .attempt-menu-item:hover { background: #f1f5f9 !important; }
        .attempt-menu-item.selected { background: #ede9fe !important; color: #6d28d9 !important; font-weight: 900 !important; }

        #result-floating-dropdown-portal {
            position: fixed !important;
            inset: 0 !important;
            pointer-events: none !important;
            z-index: 2147483640 !important;
            zoom: 1 !important;
            transform: none !important;
        }
        #result-floating-dropdown-portal > * {
            pointer-events: auto !important;
            box-sizing: border-box !important;
            position: fixed !important;
            z-index: 2147483641 !important;
            transform: none !important;
            margin: 0 !important;
            right: auto !important;
            bottom: auto !important;
            font-family: 'Be Vietnam Pro', sans-serif !important;
        }
        #result-floating-dropdown-portal .exam-picker-menu {
            display: flex !important;
            flex-direction: column !important;
            gap: 3px !important;
            max-width: min(380px, calc(100vw - 16px)) !important;
        }
        #result-floating-dropdown-portal .rank-picker-menu {
            display: block !important;
            max-width: min(230px, calc(100vw - 16px)) !important;
        }
        #result-floating-dropdown-portal .attempt-dropdown-menu {
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
            max-width: min(320px, calc(100vw - 16px)) !important;
        }
    `;
    document.head.appendChild(style);
})();

function ensureResultFloatingPortal() {
    let portal = document.getElementById("result-floating-dropdown-portal");
    if (!portal) {
        portal = document.createElement("div");
        portal.id = "result-floating-dropdown-portal";
        document.body.appendChild(portal);
    } else if (portal.parentNode !== document.body) {
        document.body.appendChild(portal);
    }
    return portal;
}

function restorePortaledDropdownElement(menu) {
    if (!menu) return;
    menu.classList.remove("show");

    if (menu.dataset.origStyle !== undefined) {
        menu.setAttribute("style", menu.dataset.origStyle);
        delete menu.dataset.origStyle;
    } else {
        menu.removeAttribute("style");
    }

    if (menu.id === "rank-sort-dropdown-menu") {
        menu.style.display = "none";
    }

    const origParent = menu._origParent;
    if (origParent && document.body.contains(origParent)) {
        if (menu._origNextSibling && menu._origNextSibling.parentNode === origParent) {
            origParent.insertBefore(menu, menu._origNextSibling);
        } else {
            origParent.appendChild(menu);
        }
    } else {
        menu.remove();
    }
    menu._origParent = null;
    menu._origNextSibling = null;
}

function closeAllResultFloatingDropdowns() {
    const portal = document.getElementById("result-floating-dropdown-portal");
    if (portal) {
        Array.from(portal.children).forEach(child => restorePortaledDropdownElement(child));
    }

    document.querySelectorAll('.attempt-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.exam-picker-menu.show').forEach(m => m.classList.remove('show'));
    const rankMenu = document.getElementById("rank-sort-dropdown-menu");
    if (rankMenu) {
        rankMenu.classList.remove('show');
        rankMenu.style.display = "none";
    }
    document.querySelectorAll('tr.has-active-attempt-menu').forEach(tr => tr.classList.remove('has-active-attempt-menu'));
    document.querySelectorAll('th.has-active-header-menu').forEach(th => th.classList.remove('has-active-header-menu'));
}

function portalAndPositionFloatingMenu(menu, anchorEl, opts = {}) {
    if (!menu || !anchorEl) return;
    const portal = ensureResultFloatingPortal();
    if (!portal) return;

    if (menu.dataset.origStyle === undefined) {
        menu.dataset.origStyle = menu.getAttribute("style") || "";
    }
    if (menu.parentNode !== portal) {
        menu._origParent = menu.parentNode;
        menu._origNextSibling = menu.nextSibling;
        portal.appendChild(menu);
    }

    const maxH = Math.min(340, Math.max(150, window.innerHeight - 24));
    const displayVal = (menu.id === "rank-sort-dropdown-menu") ? "block" : "flex";

    menu.style.setProperty("display", displayVal, "important");
    menu.style.setProperty("position", "fixed", "important");
    menu.style.setProperty("margin", "0", "important");
    menu.style.setProperty("transform", "none", "important");
    menu.style.setProperty("right", "auto", "important");
    menu.style.setProperty("bottom", "auto", "important");
    menu.style.setProperty("z-index", "2147483641", "important");
    menu.style.setProperty("max-height", maxH + "px", "important");
    menu.style.setProperty("overflow-y", "auto", "important");
    if (opts.minWidth) {
        menu.style.setProperty("min-width", Math.min(opts.minWidth, window.innerWidth - 16) + "px", "important");
    }

    menu.style.setProperty("top", "0px", "important");
    menu.style.setProperty("left", "0px", "important");

    const anchorRect = anchorEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuW = menuRect.width || opts.minWidth || 220;
    const menuH = Math.min(menuRect.height || 180, maxH);

    const spaceBelow = window.innerHeight - anchorRect.bottom - 8;
    const spaceAbove = anchorRect.top - 8;

    let top;
    if (spaceBelow >= menuH || spaceBelow >= spaceAbove) {
        top = Math.min(anchorRect.bottom + 4, window.innerHeight - menuH - 8);
    } else {
        top = Math.max(8, anchorRect.top - menuH - 4);
    }

    let left;
    if (opts.align === "center") {
        left = anchorRect.left + (anchorRect.width - menuW) / 2;
    } else if (opts.align === "right") {
        left = anchorRect.right - menuW;
    } else {
        left = anchorRect.left;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));

    menu.style.setProperty("top", Math.round(top) + "px", "important");
    menu.style.setProperty("left", Math.round(left) + "px", "important");
}

function attachTableScrollCloseListener() {
    const wrap = document.querySelector(".result-table-scroll-wrap");
    if (!wrap || wrap.dataset.hasFloatClose === "1") return;
    wrap.dataset.hasFloatClose = "1";
    let lastTop = wrap.scrollTop;
    let lastLeft = wrap.scrollLeft;
    wrap.addEventListener("scroll", () => {
        if (Math.abs(wrap.scrollTop - lastTop) > 3 || Math.abs(wrap.scrollLeft - lastLeft) > 3) {
            lastTop = wrap.scrollTop;
            lastLeft = wrap.scrollLeft;
            closeAllResultFloatingDropdowns();
        }
    }, { passive: true });
}

function formatAttemptDateTime(timestamp) {
    if (!timestamp) return "---";
    let d = new Date(timestamp);
    if (isNaN(d.getTime())) {
        let parsed = (typeof parseDateString === 'function') ? parseDateString(timestamp) : 0;
        if (parsed) d = new Date(parsed);
        else return String(timestamp);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function applyModalZoomLevel(newLevel) {
    modalCustomZoomLevel = Math.min(1.8, Math.max(0.40, Math.round(newLevel * 100) / 100));
    
    const mainView = document.getElementById("result-modal-main-view");
    const detailView = document.getElementById("result-detailed-stats-view");
    
    const applyToEl = (el) => {
        if (!el) return;
        if ('zoom' in el.style) {
            el.style.zoom = modalCustomZoomLevel !== 1 ? String(modalCustomZoomLevel) : "";
            el.style.width = "";
            el.style.transform = "";
        } else {
            el.style.transform = modalCustomZoomLevel !== 1 ? `scale(${modalCustomZoomLevel})` : "";
            el.style.transformOrigin = "top left";
            el.style.width = modalCustomZoomLevel !== 1 ? `${(100 / modalCustomZoomLevel).toFixed(3)}%` : "";
        }
    };

    applyToEl(mainView);
    applyToEl(detailView);

    const badge = document.getElementById("modal-zoom-display-val");
    if (badge) {
        badge.innerText = `${Math.round(modalCustomZoomLevel * 100)}%`;
        badge.title = `Nhấn vào để đưa về 100% gốc`;
    }
}

function adjustModalZoomStep(step) {
    closeAllResultFloatingDropdowns();
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Vừa màn";
        fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ 17 cột & học sinh trên 1 màn hình";
    }
    const table = document.getElementById("admin-result-table");
    if (table) {
        table.classList.remove("table-fitted-compact");
        table.style.fontSize = "";
    }
    applyTableSettings();
    applyModalZoomLevel(modalCustomZoomLevel + step);
}

function resetModalZoom() {
    closeAllResultFloatingDropdowns();
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Vừa màn";
        fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ 17 cột & học sinh trên 1 màn hình";
    }
    const table = document.getElementById("admin-result-table");
    if (table) {
        table.classList.remove("table-fitted-compact");
        table.style.fontSize = "";
    }
    applyTableSettings();
    applyModalZoomLevel(1.0);
}

function resetResultModalZoomOnClose() {
    closeAllResultFloatingDropdowns();
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Vừa màn";
        fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ 17 cột & học sinh trên 1 màn hình";
    }
    const table = document.getElementById("admin-result-table");
    if (table) {
        table.classList.remove("table-fitted-compact");
        table.style.fontSize = "";
    }
    applyModalZoomLevel(1.0);
}

// TÍNH TOÁN CHÍNH XÁC ĐỂ VỪA 100% CẢ 17 CỘT + TOÀN BỘ DÒNG VỚI CỠ CHỮ LỚN NHẤT CÓ THỂ
function computeAndApplyFitAllRows() {
    const scrollWrap = document.querySelector(".result-table-scroll-wrap");
    const table = document.getElementById("admin-result-table");
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (!scrollWrap || !table) return;

    table.classList.add("table-fitted-compact");
    applyModalZoomLevel(1.0);

    requestAnimationFrame(() => {
        const availH = scrollWrap.clientHeight;
        const availW = scrollWrap.clientWidth;
        if (availH <= 0 || availW <= 0) return;

        const maxFsByWidth = Math.min(18, Math.max(9.5, Math.floor((availW / 106) * 2) / 2));

        let chosenFs = 9.0;
        let chosenZoom = 1.0;
        let foundPerfect = false;

        for (let fs = maxFsByWidth; fs >= 8.5; fs -= 0.5) {
            table.style.setProperty("--table-font-size", fs + "px");
            table.style.fontSize = fs + "px";

            if (table.scrollHeight <= availH && table.scrollWidth <= availW + 1) {
                chosenFs = fs;
                chosenZoom = 1.0;
                foundPerfect = true;
                break;
            }
        }

        if (!foundPerfect) {
            chosenFs = Math.min(10.5, maxFsByWidth);
            table.style.setProperty("--table-font-size", chosenFs + "px");
            table.style.fontSize = chosenFs + "px";

            const unscaledH = Math.max(1, table.scrollHeight);
            const unscaledW = Math.max(1, table.scrollWidth);
            const reqZoomH = (availH - 2) / unscaledH;
            const reqZoomW = (availW - 2) / unscaledW;
            chosenZoom = Math.min(1.0, Math.max(0.40, Math.floor(Math.min(reqZoomH, reqZoomW) * 100) / 100));
        }

        table.style.setProperty("--table-font-size", chosenFs + "px");
        table.style.fontSize = chosenFs + "px";
        applyModalZoomLevel(chosenZoom);

        let guard = 0;
        while (
            (scrollWrap.scrollHeight > scrollWrap.clientHeight + 2 || scrollWrap.scrollWidth > scrollWrap.clientWidth + 2) &&
            modalCustomZoomLevel > 0.42 &&
            guard < 10
        ) {
            applyModalZoomLevel(modalCustomZoomLevel - 0.02);
            guard++;
        }

        scrollWrap.scrollTop = 0;
        scrollWrap.scrollLeft = 0;
        isFitAllRowsActive = true;

        if (fitBtn) {
            fitBtn.classList.add("is-fitted");
            fitBtn.innerHTML = "↺ 100%";
            fitBtn.title = `Đang bật Vừa màn (Chữ ${chosenFs}px • Tỷ lệ ${Math.round(modalCustomZoomLevel * 100)}%) — Bấm để quay lại chế độ thường`;
        }
    });
}

function reapplyFitAllRowsIfActive() {
    if (!isFitAllRowsActive) return;
    const modal = document.getElementById("result-fullscreen-modal");
    const mainView = document.getElementById("result-modal-main-view");
    if (!modal || modal.style.display !== "flex" || !mainView || mainView.style.display === "none") return;
    computeAndApplyFitAllRows();
}

function fitAllRowsInView(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    closeAllResultFloatingDropdowns();

    const scrollWrap = document.querySelector(".result-table-scroll-wrap");
    const table = document.getElementById("admin-result-table");
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (!scrollWrap || !table) return;

    if (isFitAllRowsActive) {
        isFitAllRowsActive = false;
        if (fitBtn) {
            fitBtn.classList.remove("is-fitted");
            fitBtn.innerHTML = "📐 Vừa màn";
            fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ 17 cột & học sinh trên 1 màn hình";
        }
        table.classList.remove("table-fitted-compact");
        table.style.fontSize = "";
        initTableSettings();
        applyModalZoomLevel(1.0);
        return;
    }

    computeAndApplyFitAllRows();
}

window.addEventListener("resize", () => {
    if (!isFitAllRowsActive) return;
    if (_fitResizeTimer) clearTimeout(_fitResizeTimer);
    _fitResizeTimer = setTimeout(() => {
        reapplyFitAllRowsIfActive();
    }, 150);
});

// BỔ SUNG NÚT "THU TẠM" & CÁC NÚT ĐIỀU KHIỂN VÀO HEADER MODAL
function ensureModalZoomControlsInHeader() {
    const toolsWrap = document.querySelector(".result-modal-tools");
    if (!toolsWrap) return;

    if (!document.getElementById("btn-temp-draft-capture")) {
        const tempBtn = document.createElement("button");
        tempBtn.type = "button";
        tempBtn.className = "btn-temp-draft-capture";
        tempBtn.id = "btn-temp-draft-capture";
        tempBtn.title = "Kích hoạt tạm chấm và xuất bản nháp của các em đang thi vào file điểm thi thu tạm trên Google Drive";
        tempBtn.innerHTML = "📋 Thu tạm";
        tempBtn.onclick = (e) => triggerCollectTempDraftsToDrive(e);

        const excelBtn = toolsWrap.querySelector(".btn-export-excel");
        if (excelBtn) {
            toolsWrap.insertBefore(tempBtn, excelBtn);
        } else {
            toolsWrap.appendChild(tempBtn);
        }
    }

    if (!document.getElementById("btn-fit-all-rows")) {
        const fitBtn = document.createElement("button");
        fitBtn.type = "button";
        fitBtn.className = "btn-fit-all-rows";
        fitBtn.id = "btn-fit-all-rows";
        fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ 17 cột & học sinh trên 1 màn hình mà không cần cuộn chuột";
        fitBtn.innerHTML = "📐 Vừa màn";
        fitBtn.onclick = (e) => fitAllRowsInView(e);

        const closeBtn = toolsWrap.querySelector(".btn-close-result-modal");
        if (closeBtn) {
            toolsWrap.insertBefore(fitBtn, closeBtn);
        } else {
            toolsWrap.appendChild(fitBtn);
        }
    }

    if (!document.getElementById("modal-independent-zoom-control")) {
        const zoomDiv = document.createElement("div");
        zoomDiv.className = "modal-independent-zoom-control";
        zoomDiv.id = "modal-independent-zoom-control";
        zoomDiv.title = "Phóng to / Thu nhỏ độc lập bảng kết quả (hoặc giữ Ctrl + lăn chuột)";
        zoomDiv.innerHTML = `
            <button type="button" class="btn-modal-zoom-step" onclick="adjustModalZoomStep(-0.1)" title="Thu nhỏ bảng điểm">−</button>
            <span class="modal-zoom-val-badge" id="modal-zoom-display-val" onclick="resetModalZoom()" title="Nhấp để về 100%">100%</span>
            <button type="button" class="btn-modal-zoom-step" onclick="adjustModalZoomStep(0.1)" title="Phóng to bảng điểm">+</button>
        `;

        const closeBtn = toolsWrap.querySelector(".btn-close-result-modal");
        if (closeBtn) {
            toolsWrap.insertBefore(zoomDiv, closeBtn);
        } else {
            toolsWrap.appendChild(zoomDiv);
        }
    }
}

async function triggerCollectTempDraftsToDrive(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    const quizId = currentItem ? (extractQuizIdFromItem(currentItem) || currentItem.id) : "";
    if (!quizId) return alert("⚠️ Không xác định được mã đề thi hiện tại!");

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("❌ Chưa kết nối máy chủ Supabase!");

    const btn = document.getElementById("btn-temp-draft-capture");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang thu..."; }

    try {
        const channelName = `exam_force_submit_${quizId}`;
        const tempChannel = client.channel(channelName);
        tempChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await tempChannel.send({
                    type: 'broadcast',
                    event: 'TEMP_DRAFT_CAPTURE',
                    payload: { quizId: quizId, timestamp: Date.now() }
                });
                try { client.removeChannel(tempChannel); } catch(e) {}
            }
        });

        const { data: drafts } = await client.from('live_drafts').select('*').eq('quiz_id', quizId);
        let sentCount = 0;

        if (drafts && drafts.length > 0) {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
                ? GOOGLE_DRIVE_TULUAN_GAS_URL 
                : ((typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined") ? GOOGLE_DRIVE_UPLOAD_GAS_URL : null);

            if (gasUrl && !gasUrl.includes("DÁN_URL")) {
                const now = new Date();
                const pad = n => String(n).padStart(2, '0');
                const captureTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;

                for (const d of drafts) {
                    const strictClassName = typeof getStrictStandardClassName === 'function' 
                        ? getStrictStandardClassName(d.class_name, d.sbd) 
                        : (d.class_name || "Lớp");
                    const exactExamTitle = (currentItem && currentItem.title) || d.exam_title || "Đề thi";

                    const driveDraftPayload = {
                        action: "saveLiveDraftToSheet",
                        rootFolder: "FILE_SHEET_AND_JSON_DU_PHONG",
                        className: strictClassName,
                        class: strictClassName,
                        lop: strictClassName,
                        examTitle: exactExamTitle,
                        saveDraftJson: true,
                        capturedAt: captureTimeStr,
                        draft: {
                            sbd: d.sbd,
                            student_name: d.student_name,
                            class_name: strictClassName,
                            score10: d.score10,
                            raw_score: d.raw_score,
                            correct_count: d.correct_count,
                            wrong_count: d.wrong_count,
                            completion_time: d.completion_time || "Đang thi...",
                            tab_switch_count: d.tab_switch_count || "0 lần",
                            data_string: (d.data_string || "") + ` | [Thu tạm lúc ${captureTimeStr}]`,
                            user_answers: d.user_answers || {}
                        }
                    };

                    if (typeof sendToDriveWithExponentialBackoff === 'function') {
                        sendToDriveWithExponentialBackoff(gasUrl, driveDraftPayload, 2, 35000).catch(() => null);
                    } else {
                        fetch(gasUrl, {
                            method: "POST",
                            headers: { "Content-Type": "text/plain;charset=utf-8" },
                            body: JSON.stringify(driveDraftPayload)
                        }).catch(() => null);
                    }
                    sentCount++;
                }
            }
        }

        alert(`📋 ĐÃ KÍCH HOẠT THU BÀI TẠM THỜI!\n\n1. Đã gửi lệnh tới toàn bộ thí sinh đang trong bài thi để tự động tạm tính điểm và gửi sang Drive.\n2. Đã quét ${sentCount} bản nháp từ Supabase để ghi vào Sheet thu tạm trên Google Drive.`);
        setTimeout(refreshCurrentExamResults, 1500);
    } catch(err) {
        alert("❌ Lỗi kích hoạt thu tạm: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "📋 Thu tạm"; }
    }
}

// BỘ NHẬN DIỆN ZOOM MỚI: HỖ TRỢ CẢ CTRL+WHEEL VÀ PINCH-TO-ZOOM (TOUCH 2 NGÓN TAY)
(function setupIsolatedWheelAndTouchZoom() {
    window.addEventListener("wheel", function(e) {
        const modal = document.getElementById("result-fullscreen-modal");
        if (!modal || modal.style.display !== "flex") return;

        if (e.ctrlKey && modal.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY < 0 ? 0.06 : -0.06;
            adjustModalZoomStep(delta);
        }
    }, { passive: false });

    let initialPinchDist = 0;
    let initialZoom = 1;

    window.addEventListener("touchstart", function(e) {
        const modal = document.getElementById("result-fullscreen-modal");
        if (!modal || modal.style.display !== "flex") return;

        if (e.touches && e.touches.length === 2 && modal.contains(e.target)) {
            if (e.target.closest('.result-table-card') || e.target.closest('#result-detailed-stats-view')) {
                if (e.cancelable) e.preventDefault();
            }
            initialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = modalCustomZoomLevel;
        }
    }, { passive: false });

    window.addEventListener("touchmove", function(e) {
        const modal = document.getElementById("result-fullscreen-modal");
        if (!modal || modal.style.display !== "flex") return;

        if (e.touches && e.touches.length === 2 && initialPinchDist > 0 && modal.contains(e.target)) {
            if (e.cancelable) e.preventDefault();
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scale = currentDist / initialPinchDist;
            let newZoom = initialZoom * scale;
            newZoom = Math.min(1.8, Math.max(0.40, newZoom));
            applyModalZoomLevel(newZoom);

            isFitAllRowsActive = false;
            const fitBtn = document.getElementById("btn-fit-all-rows");
            if (fitBtn) {
                fitBtn.classList.remove("is-fitted");
                fitBtn.innerHTML = "📐 Vừa màn";
            }
            const table = document.getElementById("admin-result-table");
            if (table) {
                table.classList.remove("table-fitted-compact");
                table.style.fontSize = "";
            }
        }
    }, { passive: false });

    window.addEventListener("touchend", function(e) {
        if (!e.touches || e.touches.length < 2) {
            initialPinchDist = 0;
        }
    });
})();

function initTableSettings() {
    try {
        const saved = safeLocal.getItem("admin_table_display_settings");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.fontSize) tableDisplaySettings.fontSize = parseInt(parsed.fontSize, 10);
            if (parsed.rowPadding !== undefined && parsed.rowPadding !== null) {
                tableDisplaySettings.rowPadding = parseInt(parsed.rowPadding, 10);
            }
        }
    } catch(e) {}
    applyTableSettings();
    
    const btn = document.getElementById("btn-toggle-autorefresh");
    if (btn) {
        btn.innerHTML = isAutoRefreshEnabled ? "🟢 Auto: BẬT" : "⚪ Auto: TẮT";
        btn.style.color = isAutoRefreshEnabled ? "#38bdf8" : "#94a3b8";
        btn.style.borderColor = isAutoRefreshEnabled ? "#38bdf8" : "#64748b";
    }
}

function applyTableSettings() {
    const table = document.getElementById("admin-result-table");
    if (table) {
        table.style.fontSize = "";
        table.style.setProperty("--table-font-size", tableDisplaySettings.fontSize + "px");
        table.style.setProperty("--table-row-padding-y", tableDisplaySettings.rowPadding + "px");
    }

    const sliderFont = document.getElementById("slider-font-size");
    const sliderPad = document.getElementById("slider-row-padding");
    const valFont = document.getElementById("val-font-size");
    const valPad = document.getElementById("val-row-padding");

    if (sliderFont) sliderFont.value = tableDisplaySettings.fontSize;
    if (sliderPad) sliderPad.value = tableDisplaySettings.rowPadding;
    if (valFont) valFont.innerText = tableDisplaySettings.fontSize + "px";
    if (valPad) valPad.innerText = tableDisplaySettings.rowPadding + "px";

    try { safeLocal.setItem("admin_table_display_settings", JSON.stringify(tableDisplaySettings)); } catch(e) {}
}

function exitFitModeForManualSettings() {
    if (!isFitAllRowsActive) return;
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Vừa màn";
        fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ 17 cột & học sinh trên 1 màn hình";
    }
    const table = document.getElementById("admin-result-table");
    if (table) {
        table.classList.remove("table-fitted-compact");
        table.style.fontSize = "";
    }
    applyModalZoomLevel(1.0);
}

function toggleTableSettingsPopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    closeAllResultFloatingDropdowns();
    if (typeof closeRegradeModal === "function") closeRegradeModal();

    const popover = document.getElementById("table-settings-popover");
    const btn = document.getElementById("btn-table-settings");
    if (!popover) return;
    if (popover.classList.contains("show")) {
        popover.classList.remove("show");
        if (btn) btn.classList.remove("active");
    } else {
        if (btn) {
            btn.classList.add("active");
            const rect = btn.getBoundingClientRect();
            popover.style.position = 'fixed';
            popover.style.top = (rect.bottom + 8) + 'px';
            popover.style.left = 'auto';
            popover.style.right = Math.max(10, (window.innerWidth - rect.right)) + 'px';
            popover.style.maxHeight = 'calc(100vh - 70px)';
            popover.style.overflowY = 'auto';
            popover.style.zIndex = '2147483002';
        }
        popover.classList.add("show");
    }
}

function closeTableSettingsPopover(event) {
    if (event) event.stopPropagation();
    const popover = document.getElementById("table-settings-popover");
    const btn = document.getElementById("btn-table-settings");
    if (popover) popover.classList.remove("show");
    if (btn) btn.classList.remove("active");
}

function onFontSizeChange(val) { exitFitModeForManualSettings(); tableDisplaySettings.fontSize = parseInt(val, 10); applyTableSettings(); }
function onRowPaddingChange(val) { exitFitModeForManualSettings(); tableDisplaySettings.rowPadding = parseInt(val, 10); applyTableSettings(); }

function adjustSetting(type, step) {
    exitFitModeForManualSettings();
    if (type === 'fontSize') { tableDisplaySettings.fontSize = Math.min(22, Math.max(10, tableDisplaySettings.fontSize + step)); } 
    else if (type === 'rowPadding') { tableDisplaySettings.rowPadding = Math.min(26, Math.max(0, tableDisplaySettings.rowPadding + step)); }
    applyTableSettings();
}

function applyFontSizePreset(size) { exitFitModeForManualSettings(); tableDisplaySettings.fontSize = size; applyTableSettings(); }
function applyRowPaddingPreset(pad) { exitFitModeForManualSettings(); tableDisplaySettings.rowPadding = pad; applyTableSettings(); }
function resetTableSettings() { exitFitModeForManualSettings(); tableDisplaySettings.fontSize = 13; tableDisplaySettings.rowPadding = 9; applyTableSettings(); }

function initTableResizable() {
    const table = document.getElementById("admin-result-table");
    if (!table) return;
    const headers = table.querySelectorAll("thead th");
    
    headers.forEach(th => {
        const oldResizer = th.querySelector(".resizer");
        if (oldResizer) oldResizer.remove();

        const resizer = document.createElement("div");
        resizer.className = "resizer";
        th.appendChild(resizer);

        let startX = 0, startWidth = 0;
        resizer.addEventListener("mousedown", function(e) {
            e.preventDefault(); e.stopPropagation();
            startX = e.pageX; startWidth = th.offsetWidth;
            resizer.classList.add("resizing");

            function onMouseMove(moveEvent) {
                const diff = moveEvent.pageX - startX;
                const newWidth = Math.max(40, startWidth + diff);
                th.style.width = newWidth + "px"; th.style.minWidth = newWidth + "px";
            }
            function onMouseUp() {
                resizer.classList.remove("resizing");
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            }
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    });
}

function toggleExamPickerMenu(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById("exam-picker-dropdown-list");
    if (!menu) return;
    const portal = ensureResultFloatingPortal();
    const wasShown = (portal && menu.parentNode === portal) || menu.classList.contains("show");

    closeAllResultFloatingDropdowns();
    closeTableSettingsPopover();
    if (typeof closeRegradeModal === "function") closeRegradeModal();

    if (!wasShown) {
        const btn = (event && event.currentTarget) ? event.currentTarget : document.querySelector(".btn-exam-picker");
        const th = btn ? btn.closest("th") : null;
        if (th) th.classList.add("has-active-header-menu");
        menu.classList.add("show");
        if (btn) portalAndPositionFloatingMenu(menu, btn, { align: "left", minWidth: 280 });
    }
}

function toggleRankSortMenu(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById("rank-sort-dropdown-menu");
    if (!menu) return;
    const portal = ensureResultFloatingPortal();
    const wasShown = (portal && menu.parentNode === portal) || menu.classList.contains("show");

    closeAllResultFloatingDropdowns();
    closeTableSettingsPopover();
    if (typeof closeRegradeModal === "function") closeRegradeModal();

    if (!wasShown) {
        const btn = (event && event.currentTarget) ? event.currentTarget : document.querySelector(".btn-rank-picker");
        const th = btn ? btn.closest("th") : null;
        if (th) th.classList.add("has-active-header-menu");
        menu.classList.add("show");
        if (btn) portalAndPositionFloatingMenu(menu, btn, { align: "center", minWidth: 195 });
    }
}

function changeRankSort(mode, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentRankSortMode = mode;
    closeAllResultFloatingDropdowns();
    const btnText = document.getElementById("rank-header-btn-text");
    if (btnText) {
        if (mode === 'desc') btnText.innerHTML = "🏅 Hạng: Cao ➔ Thấp";
        else if (mode === 'asc') btnText.innerHTML = "🏅 Hạng: Thấp ➔ Cao";
        else btnText.innerHTML = "🏅 Xếp hạng ▾";
    }
    filterResultTable();
}

function renderExamPickerDropdown() {
    closeAllResultFloatingDropdowns();
    const menu = document.getElementById("exam-picker-dropdown-list");
    if (!menu) return;
    menu.innerHTML = "";

    const currentCatId = currentExamResultData.categoryId || "them-11";
    let targetCat = DAY_THEM_CATEGORIES.find(c => c.id === currentCatId) || CHINH_KHOA_CATEGORIES.find(c => c.id === currentCatId);
    const examList = targetCat ? (targetCat.links || []).filter(l => !l.isDoc) : [];

    if (examList.length === 0) {
        menu.innerHTML = `<div style="padding:8px; color:#64748b; font-size:12px; font-style:italic;">Chưa có đề thi nào trong mục ${getCategoryDisplayName(currentCatId)}</div>`;
        return;
    }

    examList.forEach((exam, idx) => {
        const itemEl = document.createElement("div");
        itemEl.className = "exam-picker-item";
        const isCur = currentExamResultData.item && (currentExamResultData.item.firebaseId === exam.firebaseId || currentExamResultData.item.title === exam.title);
        if (isCur) itemEl.classList.add("selected");

        itemEl.innerHTML = `<span>${idx + 1}.</span> <span style="flex:1;">${exam.title}</span>`;
        itemEl.onclick = async (e) => {
            e.stopPropagation();
            closeAllResultFloatingDropdowns();
            await switchExamResult(exam);
        };
        menu.appendChild(itemEl);
    });
}

async function switchExamResult(examItem) {
    closeAllResultFloatingDropdowns();
    const preservedCat = currentExamResultData.categoryId || examItem.categoryId || "them-11";
    examItem.categoryId = preservedCat;
    currentExamResultData.item = examItem;
    currentExamResultData.categoryId = preservedCat;

    const headTitle = document.getElementById("result-modal-heading");
    const headSub = document.getElementById("result-modal-subheading");
    const currentExamBtnText = document.getElementById("current-selected-exam-name");

    const displayCatName = getCategoryDisplayName(preservedCat);
    const breadcrumbCat = document.getElementById("breadcrumb-category");
    if (breadcrumbCat) breadcrumbCat.innerText = displayCatName;

    if (headTitle) headTitle.innerText = `📊 Kết quả: ${examItem.title || "Bài thi"}`;
    if (headSub) headSub.innerText = `Chuyên mục: ${displayCatName} | Ngày cập nhật: ${examItem.date || "---"}`;
    if (currentExamBtnText) currentExamBtnText.innerText = `📑 ${examItem.title}`;

    const effectiveQuizId = extractQuizIdFromItem(examItem) || examItem.firebaseId || examItem.id;
    if (typeof startRealtimeSubmissionsListener === 'function') {
        startRealtimeSubmissionsListener(effectiveQuizId);
    }

    renderExamPickerDropdown();
    await refreshCurrentExamResults();
}

async function openExamResultModal(item, categoryIdOrEvent, maybeEvent) {
    let event = (categoryIdOrEvent && typeof categoryIdOrEvent === 'object' && categoryIdOrEvent.preventDefault) ? categoryIdOrEvent : maybeEvent;
    if (event) { event.preventDefault(); event.stopPropagation(); }

    closeAllResultFloatingDropdowns();
    if (typeof window.clearResultEnhancementFilter === "function") {
        window.clearResultEnhancementFilter(true);
    }

    let explicitCat = (typeof categoryIdOrEvent === 'string' && categoryIdOrEvent) ? categoryIdOrEvent : "";
    let catId = explicitCat || item.categoryId || "";

    if (!catId) {
        for (let cat of [...DAY_THEM_CATEGORIES, ...CHINH_KHOA_CATEGORIES]) {
            if (cat.links && cat.links.some(l => l.id === item.id || l.firebaseId === item.firebaseId || l.title === item.title)) {
                catId = cat.id; break;
            }
        }
    }
    catId = catId || "them-11";
    item.categoryId = catId;

    currentExamResultData.item = item;
    currentExamResultData.categoryId = catId;

    const searchInput = document.getElementById("result-search-input");
    if (searchInput) searchInput.value = "";

    const modal = document.getElementById("result-fullscreen-modal");
    const headTitle = document.getElementById("result-modal-heading");
    const headSub = document.getElementById("result-modal-subheading");
    const currentExamBtnText = document.getElementById("current-selected-exam-name");

    const displayCatName = getCategoryDisplayName(catId);
    const breadcrumbCat = document.getElementById("breadcrumb-category");
    if (breadcrumbCat) breadcrumbCat.innerText = displayCatName;

    window.history.pushState({ isViewingResult: true }, "", "#bang-ket-qua");
    document.body.classList.add("modal-backdrop-locked");

    modal.style.display = "flex";
    document.getElementById("result-modal-main-view").style.display = "flex";
    document.getElementById("result-detailed-stats-view").style.display = "none";
    document.getElementById("breadcrumb-current-view").innerText = "📊 Bảng kết quả";

    const statsBar = document.getElementById("result-modal-stats-bar");
    if (statsBar) statsBar.style.display = "flex";

    headTitle.innerText = `📊 Kết quả: ${item.title || "Bài thi"}`;
    headSub.innerText = `Chuyên mục: ${displayCatName} | Ngày cập nhật: ${item.date || "---"}`;
    if (currentExamBtnText) currentExamBtnText.innerText = `📑 ${item.title}`;

    ensureModalZoomControlsInHeader();
    resetResultModalZoomOnClose();
    initTableSettings();
    attachTableScrollCloseListener();

    const effectiveQuizId = extractQuizIdFromItem(item) || item.firebaseId || item.id || item.title;
    const cacheKey = `${catId}_${effectiveQuizId}`;
    if (_examResultsCache[cacheKey]) {
        const cached = _examResultsCache[cacheKey];
        renderExamResultTable(catId, cached.submissionsListRaw || cached.submissionsMap || [], cached.cheatingLogsData, cached.activeSessionsData, {}, item, cached.examMeta);
    } else {
        renderExamResultTable(catId, [], {}, {}, {}, item, { examTitle: item.title });
    }

    renderExamPickerDropdown();
    setTimeout(initTableResizable, 50);

    if (typeof startRealtimeSubmissionsListener === 'function') {
        startRealtimeSubmissionsListener(effectiveQuizId);
    }

    await fetchAndRenderExamResults(item, true);
    startAutoRefreshResult();
}

async function refreshCurrentExamResults() {
    if (!currentExamResultData.item) return;
    await fetchAndRenderExamResults(currentExamResultData.item, false);
    startAutoRefreshResult();
}

function calculateRanksForRows(rows) {
    const scores = [];
    rows.forEach(r => {
        if (r.allAttempts.length > 0) {
            let curSub = r.allAttempts[r.selectedAttemptIndex] || r.allAttempts[0];
            if (curSub && curSub.score10 !== undefined) {
                let sc = parseFloat(curSub.score10);
                if (!isNaN(sc)) scores.push(sc);
            }
        }
    });

    rows.forEach(r => {
        r.rank = null;
        if (r.allAttempts.length > 0) {
            let curSub = r.allAttempts[r.selectedAttemptIndex] || r.allAttempts[0];
            if (curSub && curSub.score10 !== undefined) {
                let sc = parseFloat(curSub.score10);
                if (!isNaN(sc)) r.rank = scores.filter(s => s > sc).length + 1;
            }
        }
    });
}

function toggleAttemptMenu(rowUid, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    const targetMenu = document.getElementById(`attempt-menu-${rowUid}`);
    if (!targetMenu) return;
    const portal = ensureResultFloatingPortal();
    const isShown = (portal && targetMenu.parentNode === portal) || targetMenu.classList.contains("show");

    closeAllResultFloatingDropdowns();
    closeTableSettingsPopover();
    if (typeof closeRegradeModal === "function") closeRegradeModal();

    if (!isShown) {
        const triggerBtn = (event && event.currentTarget) ? event.currentTarget : targetMenu.previousElementSibling;
        const tr = triggerBtn ? triggerBtn.closest('tr') : targetMenu.closest('tr');
        if (tr) tr.classList.add('has-active-attempt-menu');
        targetMenu.classList.add("show");
        if (triggerBtn) {
            portalAndPositionFloatingMenu(targetMenu, triggerBtn, { align: "left", minWidth: 255 });
        }
    }
}

function selectStudentAttempt(rowUid, attemptIdx, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    closeAllResultFloatingDropdowns();
    const row = currentExamResultData.rawRows.find(r => r._rowUid === rowUid);
    if (row && row.allAttempts && row.allAttempts[attemptIdx]) { 
        row.selectedAttemptIndex = attemptIdx; 
        const rawSbd = row.account?.sbd || "";
        const sbdKey = (typeof cleanSbdStandard === 'function')
            ? cleanSbdStandard(rawSbd)
            : String(rawSbd).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (sbdKey && typeof window._userSelectedAttemptsBySbd !== 'undefined') {
            window._userSelectedAttemptsBySbd[sbdKey] = attemptIdx;
        }
        calculateRanksForRows(currentExamResultData.rawRows);
        if (typeof updateStatsAndRenderTable === "function") {
            updateStatsAndRenderTable(currentExamResultData.rawRows);
        } else {
            filterResultTable();
        }
    }
}

function deleteResultRowPermanently(rowUid, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    closeAllResultFloatingDropdowns();
    const rIdx = currentExamResultData.rawRows.findIndex(r => r._rowUid === rowUid);
    if (rIdx === -1) return;
    currentExamResultData.rawRows.splice(rIdx, 1);
    calculateRanksForRows(currentExamResultData.rawRows);
    updateStatsAndRenderTable(currentExamResultData.rawRows);
}

async function sendForceSubmitCommand(targetSbd = 'all', studentName = '') {
    const currentItem = currentExamResultData.item;
    const quizId = currentItem ? (extractQuizIdFromItem(currentItem) || currentItem.id) : "";
    if (!quizId) {
        alert("⚠️ Không xác định được mã đề thi hiện tại!");
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) {
        alert("❌ Chưa kết nối máy chủ Supabase!");
        return;
    }

    const isAll = (targetSbd === 'all');
    const confirmPrompt = isAll
        ? "⚠️ CẢNH BÁO: BẠN CÓ CHẮC CHẮN MUỐN THU BÀI ÉP BUỘC TOÀN BỘ PHÒNG THI?\n\nTất cả học sinh đang làm bài sẽ tự động chấm điểm và nộp bài ngay lập tức!"
        : `⚡ BẠN CÓ MUỐN THU BÀI ÉP BUỘC ĐỐI VỚI:\n\n[${targetSbd}] - ${studentName || "Thí sinh"}?`;

    if (!confirm(confirmPrompt)) return;

    try {
        const cleanTarget = isAll ? 'all' : String(targetSbd).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        
        const channelName = `exam_force_submit_${quizId}`;
        const tempChannel = client.channel(channelName);
        
        tempChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await tempChannel.send({
                    type: 'broadcast',
                    event: 'FORCE_SUBMIT',
                    payload: {
                        targetSbd: cleanTarget,
                        sbd: cleanTarget,
                        quizId: quizId,
                        timestamp: Date.now()
                    }
                });

                try { client.removeChannel(tempChannel); } catch(e) {}

                alert(`🚀 ĐÃ GỬI LỆNH THU BÀI ÉP BUỘC TỚI ${isAll ? 'TẤT CẢ THÍ SINH' : `[${targetSbd}] ${studentName}`}!\n\nMáy học sinh sẽ tự động tính điểm và lưu kết quả là 'Thu ép' về máy chủ.`);
                setTimeout(refreshCurrentExamResults, 1200);
            }
        });
    } catch(err) {
        alert("❌ Lỗi khi gửi lệnh thu ép: " + err.message);
    }
}

function ensureActionColumnHeaders() {
    const table = document.getElementById("admin-result-table");
    if (!table) return; 
    const theadTr = table.querySelector("thead tr"); 
    if (!theadTr) return;

    let thForce = theadTr.querySelector(".th-force-submit-col");
    if (!thForce) {
        thForce = document.createElement("th");
        thForce.className = "th-force-submit-col";
        thForce.style.width = "72px";
        thForce.style.textAlign = "center";
        thForce.innerHTML = `
            <div>THU ÉP</div>
            <button type="button" class="btn-force-submit-all-header" onclick="sendForceSubmitCommand('all')" title="Gửi lệnh thu bài ép buộc tất cả các em đang thi trong phòng">
                ⚡ Thu hết
            </button>
        `;
        theadTr.appendChild(thForce);
    }

    let thDel = theadTr.querySelector(".th-row-action-col");
    if (!thDel) {
        thDel = document.createElement("th");
        thDel.className = "th-row-action-col";
        thDel.style.width = "42px";
        thDel.style.textAlign = "center";
        thDel.innerText = "XÓA";
        theadTr.appendChild(thDel);
    }
}

function stopLiveDoingTicker() {
    if (_liveDoingTickerInterval) {
        clearInterval(_liveDoingTickerInterval);
        _liveDoingTickerInterval = null;
    }
}

function startLiveDoingTicker() {
    stopLiveDoingTicker();
    _liveDoingTickerInterval = setInterval(() => {
        const timerEls = document.querySelectorAll(".live-doing-timer-val");
        if (!timerEls || timerEls.length === 0) return;
        timerEls.forEach(el => {
            const startMs = parseInt(el.dataset.starttime, 10);
            if (startMs && typeof formatElapsedDuration === "function") {
                el.innerText = formatElapsedDuration(startMs);
            }
        });
    }, 1000);
}

function handleClickStudentDetails(rowUid, event) {
    if (event) { event.stopPropagation(); }
    if (typeof window.openStudentDetailInspector === "function") {
        window.openStudentDetailInspector(rowUid, event);
        return;
    }
    const row = currentExamResultData.rawRows.find(r => r._rowUid === rowUid);
    const sub = row && row.allAttempts ? row.allAttempts[row.selectedAttemptIndex] : null;
    if (sub && sub.dataString) {
        alert(`📋 CHI TIẾT BÀI LÀM (LẦN ${(row.selectedAttemptIndex || 0) + 1}):\n\n` + sub.dataString.replace(/ \| /g, '\n'));
    }
}

function renderFilteredResultTable(rows) {
    closeAllResultFloatingDropdowns();
    ensureActionColumnHeaders();
    ensureModalZoomControlsInHeader();
    attachTableScrollCloseListener();

    const table = document.getElementById("admin-result-table");
    const tbody = document.getElementById("result-table-tbody"); 
    if (!tbody || !table) return; 
    tbody.innerHTML = "";

    if (isFitAllRowsActive) {
        table.classList.add("table-fitted-compact");
    }

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; font-weight:700; color:#64748b;">Không tìm thấy dữ liệu học sinh nào!</td></tr>`;
        if (typeof window.syncResultEnhancementUI === "function") window.syncResultEnhancementUI();
        reapplyFitAllRowsIfActive();
        return;
    }

    const currentExamTitle = (currentExamResultData.item && currentExamResultData.item.title) ? currentExamResultData.item.title : "Đề thi";

    let sortedRows = [...rows];
    if (currentRankSortMode === 'desc') {
        sortedRows.sort((a, b) => {
            let scA = (a.rank !== null && a.rank !== undefined) ? (a.allAttempts[a.selectedAttemptIndex]?.score10 ?? -1) : -999;
            let scB = (b.rank !== null && b.rank !== undefined) ? (b.allAttempts[b.selectedAttemptIndex]?.score10 ?? -1) : -999;
            if (scB !== scA) return scB - scA; return a.stt - b.stt;
        });
    } else if (currentRankSortMode === 'asc') {
        sortedRows.sort((a, b) => {
            let scA = (a.rank !== null && a.rank !== undefined) ? (a.allAttempts[a.selectedAttemptIndex]?.score10 ?? 999) : 9999;
            let scB = (b.rank !== null && b.rank !== undefined) ? (b.allAttempts[b.selectedAttemptIndex]?.score10 ?? 999) : 9999;
            if (scA !== scB) return scA - scB; return a.stt - b.stt;
        });
    } else { sortedRows.sort((a, b) => a.stt - b.stt); }

    const escJs = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");

    sortedRows.forEach((row, rowIdx) => {
        const tr = document.createElement("tr");
        const acc = row.account; 
        const attCount = Array.isArray(row.allAttempts) ? row.allAttempts.length : 0;
        
        if (attCount > 0) {
            if (row.selectedAttemptIndex === undefined || row.selectedAttemptIndex === null || row.selectedAttemptIndex >= attCount || row.selectedAttemptIndex < 0) {
                row.selectedAttemptIndex = 0;
            }
        } else {
            row.selectedAttemptIndex = 0;
        }

        const currentSub = attCount > 0 ? row.allAttempts[row.selectedAttemptIndex] : null;
        const uid = row._rowUid || `row_${acc.sbd || rowIdx}`;

        if (row.isDoing) {
            tr.classList.add("row-student-is-doing");
        }

        let col1_stt = row.stt;
        let col_examName = `<div class="td-exam-text" title="${currentExamTitle.replace(/"/g, '&quot;')}">${currentExamTitle}</div>`;
        let col_attemptCount = `<span class="status-not-submitted">---</span>`;

        if (attCount === 0) {
            if (row.isDoing) {
                col_attemptCount = row.isAwayApp 
                    ? `<span class="status-doing-heartbeat is-away" style="font-size:11px; padding:3px 8px;" title="Học sinh đang mở app khác">📱 Đang thi</span>`
                    : `<span class="status-doing-heartbeat" style="font-size:11px; padding:3px 8px;" title="Học sinh đang làm bài trên màn hình">💓 Đang thi</span>`;
            } else {
                col_attemptCount = `<span class="status-not-submitted">---</span>`;
            }
        } else {
            const isMulti = attCount >= 2;
            const btnClass = isMulti ? 'btn-attempt-badge-multi' : 'btn-attempt-badge-single';
            const btnText = `${attCount} lần`;

            let dropdownItemsHtml = "";
            row.allAttempts.forEach((at, aIdx) => {
                const isSelected = (aIdx === row.selectedAttemptIndex);
                const subDateMs = getSubmissionTimestamp(at);
                const timeFormatted = formatAttemptDateTime(subDateMs);
                let scoreText = (at.score10 !== undefined && at.score10 !== null) ? `${Number(at.score10)}đ` : "--đ";

                dropdownItemsHtml += `
                    <div class="attempt-menu-item ${isSelected ? 'selected' : ''}" onclick="selectStudentAttempt('${escJs(uid)}', ${aIdx}, event)">
                        <span class="attempt-item-left">
                            <span class="attempt-check-icon">${isSelected ? '✓' : ''}</span>
                            <span>Lần ${aIdx + 1} (${timeFormatted})</span>
                        </span>
                        <span class="attempt-item-score">${scoreText}</span>
                    </div>
                `;
            });

            col_attemptCount = `
                <div class="attempt-picker-wrapper">
                    <button type="button" class="${btnClass}" onclick="toggleAttemptMenu('${escJs(uid)}', event)" title="Bấm để chọn xem lần thi">
                        ${btnText}
                    </button>
                    <div class="attempt-dropdown-menu" id="attempt-menu-${uid}" onclick="event.stopPropagation()">
                        <div class="attempt-dropdown-header">CHỌN LẦN THI:</div>
                        ${dropdownItemsHtml}
                    </div>
                </div>
            `;
        }

        let col2_inTime = `<span class="status-not-submitted">---</span>`; 
        let col3_spentTime = `<span class="status-not-submitted">---</span>`;
        let col6_status = `<span class="status-pill status-pending">Chưa thi</span>`; 
        let col7_correct = `<span class="status-not-submitted">---</span>`;
        let col8_score = `<span class="status-not-submitted">---</span>`; 
        let col_rank = `<span class="status-not-submitted">---</span>`;
        let col9_tabs = `<span class="status-not-submitted">---</span>`; 
        let col10_cheatTime = `<span class="status-not-submitted">---</span>`;
        let col11_details = `<span class="status-not-submitted">---</span>`;

        if (currentSub) {
            let subDateMs = getSubmissionTimestamp(currentSub);
            col2_inTime = `<span style="font-family:monospace; font-weight:700; color:#0369a1;">${subDateMs ? formatDateTimeFull(subDateMs) : (currentSub.timestamp || "---")}</span>`;
            
            const spentText = currentSub.completionTime || `${currentSub.spentMins || 0} phút`;
            const isForceSubmittedText = String(spentText).includes("Thu ép");
            col3_spentTime = `<span style="color:${isForceSubmittedText ? '#dc2626' : '#0f766e'}; font-weight:800;">${spentText}</span>`;
            
            col6_status = `<span class="status-pill status-done">✓ Đã nộp bài</span>`;
            
            let cCount = (currentSub.correctCount !== undefined) ? currentSub.correctCount : 0;
            col7_correct = `<span style="font-weight:900; color:#15803d;">${cCount} câu</span>`;

            let sc = (currentSub.score10 !== undefined) ? currentSub.score10 : 0;
            let scNum = parseFloat(sc) || 0;
            let pillClass = scNum >= 8.0 ? 'score-pill-high' : (scNum >= 5.0 ? 'score-pill-mid' : 'score-pill-low');
            col8_score = `<span class="${pillClass}">${scNum}</span>`;

            if (row.rank !== null && row.rank !== undefined) {
                let rankNum = row.rank; 
                let rankBadge = "";
                if (rankNum === 1) { rankBadge = `<span style="background: linear-gradient(135deg, #fef08a, #fde047); color: #854d0e; border: 1.5px solid #eab308; padding: 2px 6px; border-radius: 10px; font-weight: 900; font-size: 0.95em; box-shadow: 0 1px 4px rgba(234,179,8,0.25);">🥇 Hạng 1</span>`; } 
                else if (rankNum === 2) { rankBadge = `<span style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); color: #334155; border: 1.5px solid #94a3b8; padding: 2px 6px; border-radius: 10px; font-weight: 900; font-size: 0.95em;">🥈 Hạng 2</span>`; } 
                else if (rankNum === 3) { rankBadge = `<span style="background: linear-gradient(135deg, #ffedd5, #fed7aa); color: #9a3412; border: 1.5px solid #fb923c; padding: 2px 6px; border-radius: 10px; font-weight: 900; font-size: 0.95em;">🥉 Hạng 3</span>`; } 
                else { rankBadge = `<span style="background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 8px; font-weight: 800; font-size: 0.92em;">Hạng ${rankNum}</span>`; }
                col_rank = rankBadge;
            }

            let rawSubTab = parseInt(currentSub.tabSwitchCount, 10) || 0;
            let dataStringTab = extractTabCountFromDataString(currentSub.dataString);
            let logTab = row.cheatLogsTabCount || 0;
            let finalTabCount = Math.max(rawSubTab, dataStringTab, logTab);

            col9_tabs = finalTabCount > 0 ? `<span class="tabs-warn">⚠️ ${finalTabCount} lần</span>` : `<span class="tabs-ok">0 lần</span>`;
            col10_cheatTime = row.cheatTimeString;

            if (currentSub.dataString) {
                let safeText = (currentSub.dataString || "").replace(/"/g, '&quot;');
                col11_details = `<span class="td-details" title="${safeText}" onclick="handleClickStudentDetails('${escJs(uid)}', event)">${currentSub.dataString}</span>`;
            }
        }

        if (row.isDoing) {
            let startMs = row.doingStartTime || Date.now();
            let formattedIn = formatDateTimeFull(startMs);
            let liveDuration = formatElapsedDuration(startMs);

            if (!currentSub) {
                col2_inTime = `<span style="color:#7e22ce; font-weight:800; font-family:monospace;">${formattedIn}</span>`;
                col3_spentTime = `<span class="live-doing-timer-pill" title="Thời gian đang thi (tự động đếm)"><span class="timer-clock-icon">⏱</span> <span class="live-doing-timer-val" data-starttime="${startMs}">${liveDuration}</span></span>`;
                
                if (row.isFreeDoing) {
                    col6_status = `<span class="status-doing-heartbeat free-mode"><span class="heartbeat-icon">💜</span> Đang thi-tự do</span>`;
                } else if (row.isAwayApp) {
                    col6_status = `<span class="status-doing-heartbeat is-away" title="Học sinh đang mở app khác (Zalo, máy tính, ...)"><span class="heartbeat-icon">📱</span> Đang thi (Tạm rời)</span>`;
                } else {
                    col6_status = `<span class="status-doing-heartbeat"><span class="heartbeat-icon">💓</span> Đang thi</span>`;
                }
            } else {
                col6_status = row.isAwayApp 
                    ? `<span class="status-doing-heartbeat is-away" title="Học sinh đang mở app khác"><span class="heartbeat-icon">📱</span> Đang thi Lần ${attCount + 1}</span>`
                    : `<span class="status-doing-heartbeat" title="Đang làm bài lần ${attCount + 1}"><span class="heartbeat-icon">💓</span> Đang thi Lần ${attCount + 1}</span>`;
            }

            let doingTabs = row.cheatLogsTabCount || 0;
            if (doingTabs > 0) col9_tabs = `<span class="tabs-warn">⚠️ ${doingTabs} lần</span>`;
            if (row.cheatTimeString !== "0s") col10_cheatTime = row.cheatTimeString;
        }

        let rawName = acc.name || (currentSub ? currentSub.studentName : "---");
        let freeTagHtml = (!row.isClassStudent) ? `<span class="tag-free-student">Tự do</span>` : '';
        let col4_name = `<span class="td-name">${rawName}</span>${freeTagHtml}`;
        let rawClass = acc.className || (currentSub ? (currentSub.studentClass || currentSub.className) : "") || "---";
        let col_class = `<span class="class-badge">${rawClass}</span>`;
        let col5_sbd = acc.sbd || (currentSub ? (currentSub.sbd || currentSub.studentId) : "---");
        let safeTitleCol10 = stripHtml(col10_cheatTime);
        let safeTitleCol6 = stripHtml(col6_status);
        let safeTitleRank = stripHtml(col_rank);
        
        let col_force_submit = `
            <button type="button" class="btn-force-submit-item" 
                    onclick="sendForceSubmitCommand('${escJs(col5_sbd)}', '${escJs(rawName)}')" 
                    title="Gửi lệnh ép nộp bài ngay lập tức tới máy em này">
                ⚡ Thu ép
            </button>
        `;

        let col_action = `<button type="button" class="btn-delete-result-row" onclick="deleteResultRowPermanently('${escJs(uid)}', event)" title="Ẩn tạm thời dòng này khỏi bảng" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:2px 6px; font-size:10.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:2px; transition:0.15s;">🗑️</button>`;

        tr.innerHTML = `
            <td class="td-stt">${col1_stt}</td>
            <td class="td-exam-col" title="${currentExamTitle.replace(/"/g, '&quot;')}">${col_examName}</td>
            <td class="td-attempt-cell-wrap">${col_attemptCount}</td>
            <td class="td-truncate" title="${stripHtml(col2_inTime)}">${col2_inTime}</td>
            <td class="td-truncate" title="${stripHtml(col3_spentTime)}">${col3_spentTime}</td>
            <td class="td-truncate" title="${String(rawName).replace(/"/g, '&quot;')}">${col4_name}</td>
            <td class="td-class td-truncate" title="${String(rawClass).replace(/"/g, '&quot;')}">${col_class}</td>
            <td class="td-sbd td-truncate" title="${String(col5_sbd).replace(/"/g, '&quot;')}">${col5_sbd}</td>
            <td style="text-align:center;" title="${safeTitleCol6.replace(/"/g, '&quot;')}">${col6_status}</td>
            <td style="text-align:center;" title="${stripHtml(col7_correct)}">${col7_correct}</td>
            <td class="td-score">${col8_score}</td>
            <td style="text-align:center;" title="${safeTitleRank.replace(/"/g, '&quot;')}">${col_rank}</td>
            <td class="td-tabs">${col9_tabs}</td>
            <td class="td-tab-times td-truncate" title="${safeTitleCol10.replace(/"/g, '&quot;')}">${col10_cheatTime}</td>
            <td class="td-truncate">${col11_details}</td>
            <td style="text-align:center;">${col_force_submit}</td>
            <td style="text-align:center;">${col_action}</td>
        `;
        tbody.appendChild(tr);
    });

    startLiveDoingTicker();
    if (typeof window.syncResultEnhancementUI === "function") {
        window.syncResultEnhancementUI();
    }
    reapplyFitAllRowsIfActive();
}

function filterResultTable() {
    const query = (document.getElementById("result-search-input")?.value || "").trim().toLowerCase();
    let filtered = currentExamResultData.rawRows || [];

    if (query) {
        filtered = filtered.filter(r => {
            let name = (r.account.name || "").toLowerCase(); 
            let sbd = String(r.account.sbd || "").toLowerCase(); 
            let cName = String(r.account.className || "").toLowerCase();
            let statusText = r.isDoing ? "đang thi" : (r.allAttempts.length > 0 ? "đã nộp bài" : (r.isFreeDoing ? "đang thi tự do" : "chưa thi"));
            let rankText = (r.rank !== null && r.rank !== undefined) ? `hạng ${r.rank}` : "";
            return name.includes(query) || sbd.includes(query) || cName.includes(query) || statusText.includes(query) || rankText.includes(query);
        });
    }

    if (typeof window.applyResultEnhancementFilter === "function") {
        filtered = window.applyResultEnhancementFilter(filtered);
    }

    renderFilteredResultTable(filtered);
}

document.addEventListener("click", function(event) {
    const inPortal = Boolean(event.target.closest('#result-floating-dropdown-portal'));
    const inAttemptBtn = Boolean(event.target.closest('.attempt-picker-wrapper'));
    const inExamBtn = Boolean(event.target.closest('.exam-picker-wrapper'));
    const inRankBtn = Boolean(event.target.closest('.rank-picker-wrapper'));

    if (!inPortal && !inAttemptBtn && !inExamBtn && !inRankBtn) {
        closeAllResultFloatingDropdowns();
    }
    
    if (!event.target.closest('.regrade-action-wrapper')) {
        const regradeDrop = document.getElementById("regrade-inline-dropdown");
        if (regradeDrop && regradeDrop.style.display === "block") {
            regradeDrop.style.display = "none";
        }
    }
    
    if (!event.target.closest('.table-settings-wrapper')) {
        const settingsDrop = document.getElementById("table-settings-popover");
        const settingsBtn = document.getElementById("btn-table-settings");
        if (settingsDrop && settingsDrop.classList.contains("show")) {
            settingsDrop.classList.remove("show");
            if (settingsBtn) settingsBtn.classList.remove("active");
        }
    }
});

window.closeAllResultFloatingDropdowns = closeAllResultFloatingDropdowns;
window.resetResultModalZoomOnClose = resetResultModalZoomOnClose;
window.stopLiveDoingTicker = stopLiveDoingTicker;
window.handleClickStudentDetails = handleClickStudentDetails;
window.toggleAttemptMenu = toggleAttemptMenu;
window.selectStudentAttempt = selectStudentAttempt;
window.toggleExamPickerMenu = toggleExamPickerMenu;
window.toggleRankSortMenu = toggleRankSortMenu;
window.changeRankSort = changeRankSort;
window.adjustModalZoomStep = adjustModalZoomStep;
window.resetModalZoom = resetModalZoom;
window.applyModalZoomLevel = applyModalZoomLevel;
window.fitAllRowsInView = fitAllRowsInView;
window.reapplyFitAllRowsIfActive = reapplyFitAllRowsIfActive;
window.renderFilteredResultTable = renderFilteredResultTable;
window.filterResultTable = filterResultTable;
window.sendForceSubmitCommand = sendForceSubmitCommand;
window.triggerCollectTempDraftsToDrive = triggerCollectTempDraftsToDrive;
