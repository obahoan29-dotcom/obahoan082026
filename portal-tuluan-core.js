--- START OF FILE text/javascript ---

// =========================================================
// FILE: portal-tuluan-core.js
// QUẢN LÝ GIAO DIỆN CƠ SỞ, BIẾN TRẠNG THÁI, NÉN ẢNH & KẾT NỐI DRIVE
// SỬA LỖI: BỔ SUNG HÀM ensureTuLuanModalDOM ĐỂ TẠO GIAO DIỆN MODAL
// =========================================================

// TỰ ĐỘNG NHÚNG CSS BẢNG TỰ LUẬN, KHÓA ẨN POPOVER VÀ BẢNG ĐIỂM THÀNH PHẦN
(function injectTuLuanButtonStyles() {
    const styleId = "tuluan-custom-delete-btn-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        /* ============================================================ */
        /* 1. KHÓA ẨN TUYỆT ĐỐI CÁC POPOVER (CHỈ HIỆN KHI CÓ CLASS .show)*/
        /* ============================================================ */
        .student-pass-popover,
        .student-feedback-popover,
        .dapan-schedule-popover,
        .component-score-popover {
            display: none !important;
            position: absolute !important;
            background: #ffffff !important;
            border-radius: 12px !important;
            padding: 10px !important;
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.38), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
            z-index: 999999 !important;
            text-align: left !important;
            box-sizing: border-box !important;
            animation: popInBadge 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .student-pass-popover.show,
        .student-feedback-popover.show,
        .dapan-schedule-popover.show,
        .component-score-popover.show {
            display: block !important;
        }

        /* Vị trí riêng của Popover Hẹn Giờ */
        .dapan-schedule-popover {
            top: calc(100% + 4px) !important;
            left: 0 !important;
            width: 310px !important;
            border: 1.5px solid #f59e0b !important;
        }

        /* Vị trí riêng của Popover Nhận Xét */
        .student-feedback-popover {
            right: 0 !important;
            bottom: calc(100% + 4px) !important;
            top: auto !important;
            width: 290px !important;
            border: 1.5px solid #d97706 !important;
        }

        /* Vị trí riêng của Popover Đổi Mật Khẩu */
        .student-pass-popover {
            right: 0 !important;
            bottom: calc(100% + 4px) !important;
            top: auto !important;
            width: 280px !important;
            border: 1.5px solid #0284c7 !important;
        }

        /* POPOVER BẢNG ĐIỂM THÀNH PHẦN (DESKTOP) */
        .component-score-popover {
            top: calc(100% + 6px) !important;
            right: 0 !important;
            left: auto !important;
            width: 420px !important;
            max-width: 95vw !important;
            max-height: 84vh !important;
            overflow-y: auto !important;
            border: 1.5px solid #0284c7 !important;
            padding: 10px 12px !important;
            background: #ffffff !important;
        }

        /* FIX CHUẨN 100% TRÊN MÀN HÌNH ĐIỆN THOẠI: GHIM CĂN GIỮA KHÔNG LỆCH LỀ */
        @media (max-width: 640px) {
            .component-score-popover {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                right: auto !important;
                bottom: auto !important;
                transform: translate(-50%, -50%) !important;
                width: min(390px, calc(100vw - 16px)) !important;
                max-width: calc(100vw - 16px) !important;
                max-height: 88vh !important;
                border-radius: 14px !important;
                z-index: 100000000 !important;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 2000px rgba(0, 0, 0, 0.45) !important;
                padding: 12px !important;
            }
        }

        /* ============================================================ */
        /* 2. THU GỌN TỐI ĐA CHIỀU CAO CÁC THANH CÔNG CỤ TRÊN CÙNG       */
        /* ============================================================ */
        .tuluan-modal-card {
            background: #ffffff !important;
            border-radius: 14px !important;
            width: 96vw !important;
            max-width: 98vw !important;
            height: 94vh !important;
            max-height: 95vh !important;
            overflow: hidden !important;
            box-shadow: 0 25px 65px rgba(15, 23, 42, 0.45) !important;
            border: 1.5px solid #cbd5e1 !important;
            display: flex !important;
            flex-direction: column !important;
            animation: popInModal 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
            box-sizing: border-box !important;
            padding: 0 !important;
        }

        .tuluan-modal-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 4px 8px !important;
            border-bottom: 1px solid #e2e8f0 !important;
            background: #ffffff !important;
            flex-shrink: 0 !important;
            min-height: 32px !important;
            gap: 4px !important;
        }
        .tuluan-header-title-box {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            min-width: 0 !important;
            flex: 1 !important;
        }
        .tuluan-icon-badge {
            width: 24px !important;
            height: 24px !important;
            border-radius: 6px !important;
            background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%) !important;
            color: #fff !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 13px !important;
            box-shadow: 0 1px 4px rgba(79, 70, 229, 0.25) !important;
            flex-shrink: 0 !important;
        }
        #tuluan-modal-heading {
            font-size: 12.5px !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
            margin: 0 !important;
            color: #0f172a !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        #tuluan-modal-subheading {
            font-size: 9.5px !important;
            margin-top: 1px !important;
            line-height: 1.15 !important;
            color: #64748b !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }

        .tuluan-select-bar {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            padding: 3px 6px !important;
            background: #f1f5f9 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            flex-wrap: wrap !important;
            flex-shrink: 0 !important;
        }
        .tuluan-select-group {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
        }
        .tuluan-select-group label {
            font-size: 10.5px !important;
            font-weight: 800 !important;
            color: #334155 !important;
            white-space: nowrap !important;
        }
        .tuluan-class-compact-select {
            width: 76px !important;
            max-width: 76px !important;
            padding: 2px 4px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            border-radius: 6px !important;
            border: 1.2px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            height: 27px !important;
            cursor: pointer !important;
        }
        #tuluan-exam-selector {
            padding: 2px 6px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 6px !important;
            font-size: 11.5px !important;
            font-weight: 700 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            outline: none !important;
            cursor: pointer !important;
            height: 27px !important;
            flex: 1 !important;
            min-width: 110px !important;
        }

        .tuluan-dapan-mini-box {
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            flex-shrink: 0 !important;
        }

        .btn-tuluan-upload-dapan,
        .btn-tuluan-schedule-dapan,
        .btn-del-exam-selector,
        .btn-tuluan-add-exam,
        .btn-tuluan-approve-all,
        .btn-tuluan-export-excel {
            height: 27px !important;
            padding: 2px 7px !important;
            font-size: 10.5px !important;
            border-radius: 6px !important;
            font-weight: 800 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 2px !important;
            white-space: nowrap !important;
            cursor: pointer !important;
        }

        .btn-tuluan-upload-dapan {
            background: linear-gradient(135deg, #0284c7, #0369a1) !important;
            color: #fff !important;
            border: 1px solid #38bdf8 !important;
        }
        .btn-tuluan-schedule-dapan {
            background: linear-gradient(135deg, #f59e0b, #d97706) !important;
            color: #fff !important;
            border: 1px solid #fde68a !important;
        }
        .btn-tuluan-schedule-dapan.has-schedule {
            background: linear-gradient(135deg, #10b981, #059669) !important;
            border-color: #86efac !important;
        }

        .btn-del-exam-selector {
            background: #fee2e2 !important;
            color: #dc2626 !important;
            border: 1px solid #f87171 !important;
        }
        .btn-tuluan-add-exam {
            background: #e0f2fe !important;
            color: #0369a1 !important;
            border: 1px solid #7dd3fc !important;
        }
        .btn-tuluan-approve-all {
            background: #f0fdf4 !important;
            color: #166534 !important;
            border: 1px solid #86efac !important;
        }
        .btn-tuluan-export-excel {
            background: linear-gradient(135deg, #059669, #047857) !important;
            color: #fff !important;
            border: 1px solid #34d399 !important;
        }

        .btn-dapan-badge-active {
            height: 27px !important;
            padding: 2px 6px !important;
            font-size: 10.5px !important;
            border-radius: 6px !important;
            max-width: 120px !important;
            background: #f0fdf4 !important;
            border: 1px solid #86efac !important;
            color: #166534 !important;
            text-decoration: none !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
        }
        .badge-moi-mini {
            background: #0284c7 !important;
            color: #fff !important;
            font-size: 9px !important;
            padding: 1px 4px !important;
            border-radius: 4px !important;
            font-weight: 900 !important;
        }
        .dapan-filename-truncate {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        .btn-del-dapan-mini {
            background: #fee2e2 !important;
            color: #dc2626 !important;
            border: 1px solid #fca5a5 !important;
            border-radius: 50% !important;
            width: 18px !important;
            height: 18px !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            padding: 0 !important;
        }

        .tuluan-dapan-full-strip {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 6px !important;
            padding: 2px 8px !important;
            background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%) !important;
            border-bottom: 1px solid #bae6fd !important;
            flex-shrink: 0 !important;
            min-height: 28px !important;
        }
        .dapan-strip-content {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            min-width: 0 !important;
            flex: 1 !important;
        }
        .dapan-badge-new {
            font-size: 9px !important;
            font-weight: 900 !important;
            padding: 1px 5px !important;
            border-radius: 4px !important;
            background: #0284c7 !important;
            color: #fff !important;
        }
        .dapan-badge-new.badge-lock {
            background: #ea580c !important;
        }
        .dapan-strip-title {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #0369a1 !important;
            text-decoration: none !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        .dapan-strip-time {
            font-size: 10px !important;
            color: #64748b !important;
        }
        .btn-open-dapan-strip {
            padding: 2px 7px !important;
            font-size: 10.5px !important;
            border-radius: 5px !important;
            height: 24px !important;
            line-height: 20px !important;
            background: #0284c7 !important;
            color: #fff !important;
            text-decoration: none !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
        }
        .btn-del-dapan-strip {
            padding: 2px 5px !important;
            font-size: 10px !important;
            border-radius: 5px !important;
            height: 24px !important;
            background: #fee2e2 !important;
            color: #dc2626 !important;
            border: 1px solid #fca5a5 !important;
            cursor: pointer !important;
            font-weight: 800 !important;
        }

        .tuluan-toolbar-bar {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 4px !important;
            padding: 3px 6px !important;
            background: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            flex-wrap: wrap !important;
            flex-shrink: 0 !important;
        }
        .tuluan-search-box {
            padding: 2px 8px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 6px !important;
            font-size: 11.5px !important;
            font-weight: 600 !important;
            width: 145px !important;
            height: 27px !important;
            outline: none !important;
        }
        .tuluan-filter-tabs {
            display: flex !important;
            gap: 3px !important;
        }
        .tuluan-tab-pill {
            padding: 3px 6px !important;
            font-size: 10.5px !important;
            border-radius: 6px !important;
            line-height: 1.2 !important;
            height: 27px !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #475569 !important;
            cursor: pointer !important;
            font-weight: 800 !important;
        }
        .tuluan-tab-pill.active {
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%) !important;
            color: #ffffff !important;
            border-color: #4f46e5 !important;
        }

        .tuluan-table-wrap {
            flex: 1 !important;
            height: 100% !important;
            max-height: none !important;
            overflow-y: auto !important;
            overflow-x: auto !important;
            background: #ffffff !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .tuluan-table {
            width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            font-size: 12.5px !important;
            text-align: left !important;
            white-space: nowrap !important;
        }
        .tuluan-table thead th {
            padding: 6px 6px !important;
            font-size: 11px !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 10 !important;
            background: #0f172a !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            border-bottom: 2px solid #4f46e5 !important;
        }
        .tuluan-table tbody td {
            padding: 5px 6px !important;
            font-size: 12px !important;
            border-bottom: 1px solid #e2e8f0 !important;
            vertical-align: middle !important;
            position: relative !important;
        }

        .tuluan-status-badge {
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            padding: 2px 7px !important;
            border-radius: 10px !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
        }
        .tuluan-status-badge.done { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #86efac !important; }
        .tuluan-status-badge.pending { background: #fee2e2 !important; color: #b91c1c !important; border: 1px solid #fca5a5 !important; }

        .tuluan-thumb-row {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            flex-wrap: wrap !important;
        }
        .tuluan-img-thumbnail-item {
            position: relative !important;
            display: inline-block !important;
            width: 38px !important;
            height: 38px !important;
            border-radius: 6px !important;
            overflow: hidden !important;
            border: 1.2px solid #cbd5e1 !important;
            cursor: pointer !important;
            background: #f1f5f9 !important;
        }
        .tuluan-img-thumbnail-item img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
        }
        .tuluan-thumb-page {
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            background: rgba(15, 23, 42, 0.75) !important;
            color: #fff !important;
            font-size: 8px !important;
            font-weight: 800 !important;
            text-align: center !important;
            padding: 1px 0 !important;
        }
        .btn-del-single-thumb {
            position: absolute !important;
            top: 1px !important;
            right: 1px !important;
            width: 17px !important;
            height: 17px !important;
            background: #ef4444 !important;
            color: #ffffff !important;
            border: 1px solid #ffffff !important;
            border-radius: 50% !important;
            font-size: 9.5px !important;
            font-weight: 900 !important;
            line-height: 1 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            z-index: 20 !important;
            padding: 0 !important;
            user-select: none !important;
            transition: transform 0.15s ease !important;
        }
        .btn-del-single-thumb:hover { transform: scale(1.2) !important; background: #b91c1c !important; }

        /* Ô NHẬP ĐIỂM CHẤM CHÉO NGOÀI BẢNG (KHÓA VỚI HỌC SINH) */
        .tuluan-score-input {
            width: 68px !important;
            padding: 4px 4px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 7px !important;
            font-size: 12.5px !important;
            font-weight: 900 !important;
            text-align: center !important;
            outline: none !important;
            color: #0284c7 !important;
            background: #ffffff !important;
        }
        .tuluan-score-input.is-locked-for-student {
            background: #f8fafc !important;
            color: #0369a1 !important;
            border-color: #e2e8f0 !important;
            cursor: not-allowed !important;
        }

        .btn-tuluan-comment {
            background: #f8fafc !important;
            color: #475569 !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 7px !important;
            padding: 4px 7px !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
        }
        .btn-tuluan-comment.active {
            background: #fef3c7 !important;
            color: #b45309 !important;
            border-color: #fde68a !important;
        }

        .tuluan-action-btn-group {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
        }
        .btn-tuluan-upload-row {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
            color: #ffffff !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 4px 8px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            height: 28px !important;
        }
        .btn-tuluan-change-pass {
            background: #f0fdf4 !important;
            color: #166534 !important;
            border: 1px solid #86efac !important;
            border-radius: 6px !important;
            padding: 4px 6px !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            height: 28px !important;
        }
        .btn-tuluan-reset-pass {
            background: #fff7ed !important;
            color: #c2410c !important;
            border: 1px solid #fdba74 !important;
            border-radius: 6px !important;
            padding: 4px 6px !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            height: 28px !important;
        }

        .pass-popover-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            border-bottom: 1px solid #f1f5f9 !important;
            padding-bottom: 5px !important;
            margin-bottom: 7px !important;
        }
        .btn-close-pass-pop {
            background: none !important;
            border: none !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            color: #94a3b8 !important;
            cursor: pointer !important;
        }

        .tuluan-modal-footer {
            padding: 3px 8px !important;
            min-height: 28px !important;
            background: #f8fafc !important;
            border-top: 1px solid #e2e8f0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-shrink: 0 !important;
        }

        /* ============================================================ */
        /* 3. LIGHTBOX XEM ẢNH, NÚT "ĐIỂM TP" VÀ CẢM ỨNG PINCH-ZOOM     */
        /* ============================================================ */
        .tuluan-lightbox-overlay {
            position: fixed !important;
            inset: 0 !important;
            background: rgba(10, 15, 29, 0.94) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
            z-index: 10000000 !important;
            display: none;
            align-items: center !important;
            justify-content: center !important;
            padding: 8px !important;
            animation: fadeInModal 0.2s ease-out !important;
            touch-action: none !important;
            user-select: none !important;
        }
        .tuluan-lightbox-content {
            background: #0f172a !important;
            border: 1.5px solid #334155 !important;
            border-radius: 16px !important;
            max-width: 940px !important;
            width: 100% !important;
            height: 94vh !important;
            max-height: 96vh !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6) !important;
            position: relative !important;
        }
        .tuluan-lightbox-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 6px 12px !important;
            background: #1e293b !important;
            border-bottom: 1.5px solid #334155 !important;
            flex-shrink: 0 !important;
            gap: 8px !important;
        }
        .lightbox-title-wrap {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            min-width: 0 !important;
            flex: 1 !important;
        }
        #lightbox-student-title {
            font-weight: 800 !important;
            font-size: 13.5px !important;
            color: #ffffff !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        .lightbox-page-badge {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
            color: #ffffff !important;
            border: 1px solid #38bdf8 !important;
            padding: 2px 8px !important;
            border-radius: 12px !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            letter-spacing: 0.5px !important;
            flex-shrink: 0 !important;
            box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4) !important;
        }

        /* NÚT "ĐIỂM TP" THAY THẾ CHO NÚT DRIVE */
        .btn-lightbox-component-score {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            color: #ffffff !important;
            border: 1.2px solid #6ee7b7 !important;
            padding: 4px 10px !important;
            border-radius: 8px !important;
            font-size: 11.5px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
        }
        .btn-lightbox-component-score:hover {
            filter: brightness(1.1) !important;
            transform: translateY(-1px) !important;
        }
        .btn-lightbox-component-score:active {
            transform: scale(0.95) !important;
        }

        .btn-close-lightbox {
            background: #334155 !important;
            border: none !important;
            border-radius: 50% !important;
            color: #ffffff !important;
            width: 28px !important;
            height: 28px !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        }
        .btn-close-lightbox:hover { background: #ef4444 !important; }

        .tuluan-lightbox-img-box {
            flex: 1 !important;
            position: relative !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: #070b14 !important;
            touch-action: none !important;
            user-select: none !important;
            cursor: grab !important;
        }
        .tuluan-lightbox-img-box.is-zoomed { cursor: move !important; }
        #lightbox-full-img {
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
            border-radius: 6px !important;
            transform-origin: center center !important;
            will-change: transform !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            pointer-events: auto !important;
        }

        .btn-lightbox-nav {
            position: absolute !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: 44px !important;
            height: 44px !important;
            background: rgba(15, 23, 42, 0.72) !important;
            color: #ffffff !important;
            border: 1.5px solid rgba(255, 255, 255, 0.35) !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 20px !important;
            cursor: pointer !important;
            z-index: 100 !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
            transition: all 0.18s ease !important;
            user-select: none !important;
        }
        .btn-lightbox-nav:hover {
            background: #0284c7 !important;
            border-color: #38bdf8 !important;
            transform: translateY(-50%) scale(1.12) !important;
        }
        .btn-lightbox-nav.btn-nav-prev { left: 12px !important; }
        .btn-lightbox-nav.btn-nav-next { right: 12px !important; }
        .btn-lightbox-nav.disabled {
            opacity: 0.25 !important;
            cursor: not-allowed !important;
            pointer-events: none !important;
        }

        .lightbox-bottom-bar {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 6px 12px !important;
            background: #1e293b !important;
            border-top: 1.5px solid #334155 !important;
            font-size: 11px !important;
            color: #94a3b8 !important;
            font-weight: 700 !important;
            flex-shrink: 0 !important;
            gap: 8px !important;
        }
        .lightbox-zoom-tools {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            flex-shrink: 0 !important;
        }
        .btn-zoom-tool {
            background: #334155 !important;
            color: #ffffff !important;
            border: 1px solid #475569 !important;
            border-radius: 6px !important;
            padding: 3px 7px !important;
            font-size: 11.5px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.15s ease !important;
        }
        .btn-zoom-tool:hover { background: #0284c7 !important; border-color: #38bdf8 !important; }
        .btn-zoom-tool:active { transform: scale(0.92) !important; }

        .lightbox-dots-container {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
        }
        .lightbox-dot-item {
            width: 7px !important;
            height: 7px !important;
            border-radius: 50% !important;
            background: #475569 !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
        }
        .lightbox-dot-item.active {
            background: #38bdf8 !important;
            width: 16px !important;
            border-radius: 8px !important;
        }

        /* LƯỚI Ô NHẬP ĐIỂM THÀNH PHẦN (SIÊU GỌN 10 CỘT) */
        .comp-score-grid-10 {
            display: grid !important;
            grid-template-columns: repeat(10, 1fr) !important;
            gap: 4px !important;
            background: #f8fafc !important;
            padding: 6px !important;
            border-radius: 8px !important;
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 6px !important;
        }
        .comp-score-cell-box {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
        }
        .comp-score-cell-input {
            width: 100% !important;
            padding: 3px 1px !important;
            text-align: center !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 5px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            background: #ffffff !important;
            outline: none !important;
            box-sizing: border-box !important;
        }
        .comp-score-cell-input:focus {
            border-color: #10b981 !important;
            background: #ecfdf5 !important;
            box-shadow: 0 0 0 1.5px rgba(16, 185, 129, 0.3) !important;
        }
        .comp-score-cell-input::placeholder {
            color: #94a3b8 !important;
            font-weight: 600 !important;
            font-size: 9.5px !important;
        }

        .comp-score-footer-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            background: #f0fdf4 !important;
            border: 1.2px solid #86efac !important;
            border-radius: 8px !important;
            padding: 6px 8px !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
        }
        .comp-score-kpi-item {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            font-size: 11.5px !important;
            font-weight: 800 !important;
            color: #166534 !important;
        }
        .comp-score-kpi-val {
            background: #ffffff !important;
            border: 1px solid #86efac !important;
            padding: 2px 7px !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            color: #15803d !important;
        }

        @media (max-width: 640px) {
            .btn-lightbox-nav {
                width: 36px !important;
                height: 36px !important;
                font-size: 17px !important;
            }
            .btn-lightbox-nav.btn-nav-prev { left: 6px !important; }
            .btn-lightbox-nav.btn-nav-next { right: 6px !important; }
            .lightbox-bottom-bar span.lightbox-hint-text { display: none !important; }
            .comp-score-grid-10 { grid-template-columns: repeat(5, 1fr) !important; }
        }
    `;
    document.head.appendChild(style);
})();

// BỔ SUNG HÀM TẠO MODAL ĐỂ KHÔNG BỊ NULL
function ensureTuLuanModalDOM() {
    if (document.getElementById("modal-tuluan-submission")) return;
    
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
    <!-- MODAL NỘP TỰ LUẬN CHÍNH -->
    <div class="move-modal-overlay" id="modal-tuluan-submission" style="z-index: 1000000;" onclick="if(event.target===this) closeTuLuanModal(event);">
        <div class="tuluan-modal-card" onclick="event.stopPropagation();">
            
            <div class="tuluan-modal-header">
                <div class="tuluan-header-title-box">
                    <div class="tuluan-icon-badge">📁</div>
                    <div style="min-width:0; flex:1;">
                        <h3 id="tuluan-modal-heading">📤 NỘP BÀI TỰ LUẬN</h3>
                        <div id="tuluan-modal-subheading">Hệ thống đồng bộ trực tiếp lên Google Drive 5TB</div>
                    </div>
                </div>
                <button type="button" class="btn-close-pass-pop" onclick="closeTuLuanModal(event)">✕</button>
            </div>

            <div class="tuluan-select-bar">
                <div class="tuluan-select-group">
                    <label>Lớp:</label>
                    <select class="tuluan-class-compact-select" id="tuluan-class-selector" onchange="onTuLuanClassChanged(this.value)">
                        <option value="lop-11a">11A</option>
                        <option value="lop-11c">11C</option>
                        <option value="lop-10p">10P</option>
                        <option value="lop-11e">11E</option>
                    </select>
                </div>
                <div class="tuluan-select-group" style="flex:1;">
                    <label>Đề:</label>
                    <select id="tuluan-exam-selector" onchange="onTuLuanExamChanged(this.value)"></select>
                </div>
                <div class="tuluan-select-group" id="tuluan-admin-add-exam-box" style="display:none;">
                    <button type="button" class="btn-del-exam-selector" id="btn-del-current-exam" onclick="deleteCurrentTuLuanExam(event)" title="Xóa đề này khỏi danh sách">🗑️ Xóa đề</button>
                    <button type="button" class="btn-tuluan-add-exam" onclick="promptAddNewTuLuanExam()" title="Thêm đề tự luận mới vào danh sách">➕ Thêm đề</button>
                    <input type="file" id="tuluan-dapan-file-input" style="display:none;" onchange="handleUploadDapAnCham(this)">
                    <button type="button" class="btn-tuluan-upload-dapan" id="btn-up-dapan-cham" onclick="triggerUploadDapAnCham(event)" title="Tải file PDF/Ảnh đáp án lên cho học sinh tự chấm điểm">📤 Đ.Á chấm</button>
                    <div style="position:relative; display:inline-block;" id="box-schedule-dapan-wrap">
                        <button type="button" class="btn-tuluan-schedule-dapan" id="btn-schedule-dapan" onclick="toggleDapAnSchedulePopover(event)">⏰ Hẹn giờ</button>
                        
                        <!-- POPOVER HẸN GIỜ ĐÁP ÁN -->
                        <div class="dapan-schedule-popover" id="dapan-schedule-popover" onclick="event.stopPropagation()">
                            <div class="pass-popover-header">
                                <span>⏰ Hẹn giờ mở Đáp án</span>
                                <button type="button" class="btn-close-pass-pop" onclick="closeDapAnSchedulePopover(event)">✕</button>
                            </div>
                            <div style="font-size:11px; color:#475569; margin-bottom:10px; line-height:1.4;">
                                Hệ thống sẽ khóa file Đáp án và tự động mở khóa cho học sinh xem vào thời điểm Thầy cài đặt bên dưới.
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
                                <label style="font-size:12px; font-weight:800; display:flex; align-items:center; gap:5px; cursor:pointer;">
                                    <input type="radio" name="dapan-sched-mode" id="sched-mode-now" value="now" checked onchange="onDapAnScheduleModeChanged('now')"> Mở ngay lập tức
                                </label>
                                <label style="font-size:12px; font-weight:800; display:flex; align-items:center; gap:5px; cursor:pointer;">
                                    <input type="radio" name="dapan-sched-mode" id="sched-mode-auto" value="auto" onchange="onDapAnScheduleModeChanged('auto')"> Tự động mở theo lịch hẹn
                                </label>
                            </div>
                            <div id="sched-datetime-input-group" style="display:none; margin-bottom:10px;">
                                <label style="display:block; font-size:11px; font-weight:700; margin-bottom:4px; color:#334155;">Chọn ngày và giờ mở khóa:</label>
                                <input type="datetime-local" id="dapan-sched-datetime" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-family:inherit;">
                                <button type="button" onclick="setScheduleToExamDeadline()" style="margin-top:6px; font-size:10px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:3px 6px; cursor:pointer; font-weight:700;">🕒 Lấy theo hạn chót nộp bài</button>
                            </div>
                            <div class="pass-popover-actions" style="display:flex; gap:6px; margin-top:10px;">
                                <button type="button" style="flex:1; padding:6px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:800; cursor:pointer;" onclick="closeDapAnSchedulePopover(event)">Hủy</button>
                                <button type="button" style="flex:1; padding:6px; border-radius:8px; border:none; background:linear-gradient(135deg, #10b981, #059669); color:white; font-weight:800; cursor:pointer;" onclick="saveDapAnSchedule(event)">💾 Lưu thiết lập</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- THANH STRIP ĐÁP ÁN CHẤM GẮN LIỀN -->
            <div class="tuluan-dapan-full-strip" id="tuluan-dapan-full-strip" style="display:none;">
                <div class="dapan-strip-content">
                    <span class="dapan-badge-new" id="strip-dapan-badge-tag">MỚI</span>
                    <span class="dapan-strip-title" id="strip-dapan-filename">Đáp án chấm...</span>
                    <span class="dapan-strip-time" id="strip-dapan-time">📅 --/--/----</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <a href="#" target="_blank" class="btn-open-dapan-strip" id="strip-dapan-open-btn">🔗 Mở xem</a>
                    <button type="button" class="btn-del-dapan-strip" id="strip-dapan-del-btn" onclick="deleteDapAnCham(event)" style="display:none;">✕ Xóa</button>
                </div>
            </div>

            <div class="tuluan-toolbar-bar">
                <input type="text" id="tuluan-search-student" class="tuluan-search-box" placeholder="🔍 Tìm kiếm SBD, Họ tên..." oninput="filterTuLuanStudentTable()">
                <div class="tuluan-filter-tabs">
                    <button type="button" class="tuluan-tab-pill active" id="tab-filter-all" onclick="filterTuLuanStatus('all')">Tất cả (<span id="count-all-st">0</span>)</button>
                    <button type="button" class="tuluan-tab-pill" id="tab-filter-submitted" onclick="filterTuLuanStatus('submitted')">Đã nộp (<span id="count-sub-st">0</span>)</button>
                    <button type="button" class="tuluan-tab-pill" id="tab-filter-pending" onclick="filterTuLuanStatus('pending')">Chưa nộp (<span id="count-pen-st">0</span>)</button>
                </div>
            </div>

            <div class="tuluan-table-wrap">
                <table class="tuluan-table">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">STT</th>
                            <th style="width: 155px;">Họ và Tên</th>
                            <th style="width: 65px; text-align: center;">SBD</th>
                            <th style="width: 110px;">Trạng thái</th>
                            <th style="width: 100px; text-align: center;">Phê duyệt</th>
                            <th style="width: 280px;">Ảnh bài làm</th>
                            <th style="width: 90px; text-align: center;">Điểm số</th>
                            <th style="width: 115px; text-align: center;">Nhận xét</th>
                            <th style="width: 155px; text-align: center;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="tuluan-students-tbody"></tbody>
                </table>
            </div>

            <div class="tuluan-modal-footer">
                <div style="font-size: 10.5px; font-weight: 700; color: #64748b;" id="tuluan-drive-folder-path">Path: BAI_TAP_TU_LUAN / ...</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn-tuluan-approve-all" onclick="toggleApproveAllSubmissions(true)">✅ Duyệt toàn bộ</button>
                    <button type="button" class="btn-tuluan-export-excel" onclick="exportTuLuanToExcel(event)">📥 Tải Excel</button>
                </div>
            </div>
        </div>
    </div>

    <!-- LIGHTBOX CHẤM BÀI -->
    <div class="tuluan-lightbox-overlay" id="tuluan-lightbox">
        <div class="tuluan-lightbox-content">
            <div class="tuluan-lightbox-header">
                <div class="lightbox-title-wrap">
                    <span class="lightbox-page-badge" id="lightbox-page-indicator">Tr 1/1</span>
                    <span id="lightbox-student-title">Học sinh - Trang 1</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="position: relative;">
                        <button type="button" class="btn-lightbox-component-score" id="btn-open-component-score" onclick="toggleComponentScorePopover(event)">
                            📊 Điểm TP ▾
                        </button>

                        <!-- POPOVER NHẬP ĐIỂM THÀNH PHẦN TỪNG CÂU -->
                        <div class="component-score-popover" id="component-score-popover" onclick="event.stopPropagation()">
                            <div class="pass-popover-header" style="border-bottom: 2px solid #e2e8f0; margin-bottom: 10px; padding-bottom: 6px;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="font-size:16px;">📊</span>
                                    <div style="display:flex; flex-direction:column;">
                                        <span style="font-size:13px; font-weight:900; color:#0f172a;">Nhập điểm thành phần</span>
                                        <span style="font-size:10px; color:#64748b; font-weight:600;" id="comp-score-st-name">Học sinh</span>
                                    </div>
                                </div>
                                <button type="button" class="btn-close-pass-pop" onclick="closeComponentScorePopover(event)">✕</button>
                            </div>
                            
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:8px;">
                                <div style="font-size:11.5px; font-weight:800; color:#334155; display:flex; align-items:center; gap:6px;">
                                    <span>Số lượng câu tự luận:</span>
                                    <input type="number" id="comp-score-q-count" value="40" min="1" max="120" style="width:48px; padding:2px 4px; border:1px solid #cbd5e1; border-radius:5px; font-size:12px; font-weight:800; text-align:center;" onchange="onComponentQuestionCountChanged(this.value)">
                                </div>
                                <div style="display:flex; gap:3px;">
                                    <button type="button" class="preset-btn" style="padding:2px 6px; font-size:10px;" onclick="setQuickQuestionCount(5)">5</button>
                                    <button type="button" class="preset-btn" style="padding:2px 6px; font-size:10px;" onclick="setQuickQuestionCount(10)">10</button>
                                    <button type="button" class="preset-btn" style="padding:2px 6px; font-size:10px;" onclick="setQuickQuestionCount(40)">40</button>
                                    <button type="button" class="preset-btn" style="padding:2px 6px; font-size:10px;" onclick="setQuickQuestionCount(50)">50</button>
                                </div>
                            </div>

                            <div id="comp-score-grid-container" class="comp-score-grid-10">
                                <!-- JS sẽ sinh ra các ô nhập điểm ở đây -->
                            </div>

                            <div class="comp-score-footer-row">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div class="comp-score-kpi-item">Tổng: <span class="comp-score-kpi-val" id="comp-score-total-sum" style="color:#b45309; border-color:#fde047;">0</span></div>
                                    <div class="comp-score-kpi-item">Thang 10: <span class="comp-score-kpi-val" id="comp-score-scale10-val" style="color:#15803d; border-color:#86efac;">0</span></div>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <select id="comp-score-apply-mode" style="padding:4px 6px; font-size:11px; font-weight:800; border-radius:6px; border:1px solid #cbd5e1; outline:none;">
                                        <option value="scale10">Lấy điểm thang 10</option>
                                        <option value="raw">Lấy điểm tổng</option>
                                    </select>
                                    <button type="button" onclick="saveComponentScoresAction(event)" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:900; cursor:pointer; box-shadow:0 2px 6px rgba(16,185,129,0.3);">💾 Lưu ra bảng</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="button" class="btn-close-lightbox" onclick="closeTuLuanLightbox(event)">✕</button>
                </div>
            </div>

            <div class="tuluan-lightbox-img-box" id="lightbox-touch-area">
                <img id="lightbox-full-img" src="" alt="Full size">
            </div>

            <button type="button" class="btn-lightbox-nav btn-nav-prev" id="btn-lightbox-prev" onclick="navigateLightbox(-1, event)">❮</button>
            <button type="button" class="btn-lightbox-nav btn-nav-next" id="btn-lightbox-next" onclick="navigateLightbox(1, event)">❯</button>

            <div class="lightbox-bottom-bar">
                <span class="lightbox-hint-text">💡 Pinch (2 ngón tay) / Cuộn chuột để Zoom. Kéo thả để xem chi tiết. Vuốt / Phím mũi tên để chuyển trang.</span>
                <div class="lightbox-dots-container" id="lightbox-dots-container"></div>
                <div class="lightbox-zoom-tools">
                    <button type="button" class="btn-zoom-tool" onclick="zoomLightboxStep(-0.25, event)">➖</button>
                    <button type="button" class="btn-zoom-tool" id="btn-zoom-reset" onclick="resetLightboxZoom(true, event)">↺ 1x</button>
                    <button type="button" class="btn-zoom-tool" onclick="zoomLightboxStep(0.25, event)">➕</button>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.appendChild(wrapper);
    
    // Khởi tạo tính năng zoom cho lightbox luôn
    if (typeof setupLightboxTouchAndZoom === 'function') {
        setupLightboxTouchAndZoom();
    }
}
// EXPOSE GLOBALLY ĐỂ GỌI TỪ NƠI KHÁC
window.ensureTuLuanModalDOM = ensureTuLuanModalDOM;

let currentTuLuanModalData = {
    classId: "lop-11a",
    quizId: "",
    examTitle: "",
    submissionsMap: {},
    availableExams: [],
    customPasswords: {},
    statusFilter: "all",
    dapAnCham: null
};

// TRẠNG THÁI LIGHTBOX VÀ CƠ CHẾ ZOOM 2 NGÓN TAY + PAN
let currentLightboxGallery = {
    studentName: "",
    studentSbd: "",
    images: [],
    currentIndex: 0,
    currentQuestionCount: 40,
    componentScores: {}
};

let lightboxZoomState = {
    scale: 1,
    posX: 0,
    posY: 0,
    startX: 0,
    startY: 0,
    isDragging: false,
    initialDistance: 0,
    initialScale: 1,
    swipeStartX: 0,
    swipeStartY: 0,
    lastTapTime: 0
};

let tuLuanRealtimeChannel = null;

function getDbClient() {
    if (typeof getSupabaseClient === 'function') {
        const c = getSupabaseClient();
        if (c) return c;
    }
    if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) return window.supabaseClient;
    return null;
}

function checkCurrentIsAdmin() {
    if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) return true;
    if (typeof checkAdminSessionValidity === 'function' && checkAdminSessionValidity()) return true;
    try {
        if (typeof safeLocal !== 'undefined') {
            const logged = safeLocal.getItem("adminLoggedInSession");
            const exp = safeLocal.getItem("admin_expires_at");
            if (logged === "true" && exp && Date.now() < parseInt(exp, 10)) {
                return true;
            }
        }
    } catch(e) {}
    return false;
}

function getCleanDriveClassName(rawClass) {
    if (!rawClass) return "11A";
    let str = String(rawClass).trim().toLowerCase();

    if (str.includes("11c")) return "11C";
    if (str.includes("11a") && !str.includes("hsg")) return "11A";
    if (str.includes("10p")) return "10P";
    if (str.includes("11e")) return "11E";
    if (str.includes("hsg")) return "HSG_TOAN_11";
    if (str.includes("them-11") || str.includes("them 11")) return "THEM_11";
    if (str.includes("them-10") || str.includes("them 10")) return "THEM_10";
    if (str.includes("them-12") || str.includes("them 12")) return "THEM_12";

    str = str.replace(/^(?:lớp|lop)[_\-\s]*/i, "");
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    str = str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim().toUpperCase();
    return str || "11A";
}

function getUnifiedExamFolderKey(title, maDe, quizId) {
    let key = (title || maDe || quizId || "BAI_TAP_TU_LUAN").trim();
    return key
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[\\\/\:\*\?\"<>\|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_');
}

function getStudentFolderKey(stt, sbd, name, categoryId = "") {
    let finalStt = stt;
    const cleanSbd = String(sbd || "").trim();
    const cleanName = String(name || "").trim();

    if (window.STUDENT_ACCOUNTS) {
        let found = null;
        if (categoryId) {
            const list = (typeof getAccountsForCategory === 'function') 
                ? getAccountsForCategory(categoryId) 
                : window.STUDENT_ACCOUNTS[categoryId];
            if (Array.isArray(list)) {
                found = list.find(a => 
                    (cleanSbd && String(a.sbd || "").trim().toLowerCase() === cleanSbd.toLowerCase()) ||
                    (cleanName && typeof normalizeName === 'function' && normalizeName(a.name) === normalizeName(cleanName))
                );
            }
        }
        if (!found) {
            for (let cat in window.STUDENT_ACCOUNTS) {
                const list = window.STUDENT_ACCOUNTS[cat];
                if (Array.isArray(list)) {
                    found = list.find(a => 
                        (cleanSbd && String(a.sbd || "").trim().toLowerCase() === cleanSbd.toLowerCase()) ||
                        (cleanName && typeof normalizeName === 'function' && normalizeName(a.name) === normalizeName(cleanName))
                    );
                    if (found) break;
                }
            }
        }
        if (found && found.stt !== undefined && found.stt !== null) {
            finalStt = found.stt;
        }
    }

    if (!finalStt || finalStt === "0" || finalStt === "00" || isNaN(parseInt(finalStt, 10))) {
        finalStt = (finalStt && !isNaN(parseInt(finalStt, 10))) ? finalStt : "00";
    }

    const padStt = String(finalStt).padStart(2, '0');
    const safeSbd = cleanSbd.replace(/[^a-zA-Z0-9]/g, '_') || "NOSBD";
    const safeName = cleanName
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .toUpperCase() || "HOC_SINH";

    return `${padStt}_${safeSbd}_${safeName}`;
}

function getEffectiveStudentPassword(cleanSbd, defaultSbd, defaultPass) {
    const customPass = currentTuLuanModalData.customPasswords && currentTuLuanModalData.customPasswords[cleanSbd];
    if (customPass && String(customPass).trim() !== "") {
        return String(customPass).trim();
    }
    return String(defaultSbd || defaultPass || "").trim();
}

function getCurrentGraderInfo() {
    if (checkCurrentIsAdmin()) {
        return { name: "Giáo viên (Admin)", sbd: "ADMIN" };
    }

    try {
        const raw = safeLocal.getItem("current_exam_student");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.name || parsed.sbd)) {
                return { name: parsed.name || parsed.sbd, sbd: parsed.sbd || "" };
            }
        }
    } catch(e) {}

    const sName = safeLocal.getItem("saved_student_name");
    const sSbd = safeLocal.getItem("saved_student_sbd");
    if (sName || sSbd) {
        return { name: sName || sSbd, sbd: sSbd || "" };
    }

    const sessionGrader = safeSession.getItem("current_peer_grader");
    if (sessionGrader) {
        try { return JSON.parse(sessionGrader); } catch(e) {}
    }

    const inputIdentify = prompt("👤 NHẬP DANH TÍNH NGƯỜI CHẤM:\n\nVui lòng nhập Họ tên hoặc SBD của em để hệ thống ghi nhận người chấm chéo bài này:");
    if (inputIdentify && inputIdentify.trim()) {
        const cleanInput = inputIdentify.trim();
        const classStudents = (typeof getAccountsForCategory === 'function') 
            ? getAccountsForCategory(currentTuLuanModalData.classId) 
            : [];
        const matched = classStudents.find(st => 
            String(st.sbd).toLowerCase() === cleanInput.toLowerCase() ||
            (typeof normalizeName === 'function' && normalizeName(st.name) === normalizeName(cleanInput))
        );
        const graderObj = matched 
            ? { name: matched.name, sbd: matched.sbd }
            : { name: cleanInput, sbd: "" };
        
        safeSession.setItem("current_peer_grader", JSON.stringify(graderObj));
        return graderObj;
    }

    return { name: "Học sinh trong lớp", sbd: "" };
}

function compressImageForTuLuanAsync(file, maxDimension = 2048, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("Không tìm thấy tệp được chọn!"));

        const mime = String(file.type || "").toLowerCase();
        const name = String(file.name || "").toLowerCase();
        const isImageMime = mime.startsWith("image/");
        const isImageExt = /\.(jpe?g|png|webp|bmp|gif|heic|heif|jfif|svg)$/i.test(name);

        if (!isImageMime && !isImageExt && mime !== "" && mime !== "application/octet-stream") {
            return reject(new Error("Tệp chọn không phải là hình ảnh!"));
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    let width = img.width || 1200;
                    let height = img.height || 900;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        } else {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL("image/jpeg", quality);
                    const base64 = dataUrl.split(",")[1];
                    resolve({ base64, dataUrl, mimeType: "image/jpeg" });
                } catch(canvasErr) {
                    let rawResult = String(e.target.result || "");
                    let base64 = rawResult.includes("base64,") ? rawResult.split("base64,")[1] : rawResult.split(",")[1];
                    resolve({ base64, dataUrl: rawResult, mimeType: file.type || "image/jpeg" });
                }
            };
            img.onerror = function() {
                let rawResult = String(e.target.result || "");
                if (rawResult.includes("base64,")) {
                    let base64 = rawResult.split("base64,")[1];
                    resolve({ base64, dataUrl: rawResult, mimeType: file.type || "image/jpeg" });
                } else {
                    reject(new Error("Không thể giải mã tệp ảnh này. Vui lòng chọn ảnh chụp JPG/PNG!"));
                }
            };
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Lỗi đọc tệp từ thiết bị!"));
        reader.readAsDataURL(file);
    });
}

async function sendToGoogleDriveWithRetry(gasUrl, payload, maxRetries = 2, timeoutMs = 75000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            try { controller.abort(); } catch(e) {}
        }, timeoutMs);

        try {
            const res = await fetch(gasUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timer);
            const result = await res.json();
            if (result && result.status === "success") {
                return result;
            }
            throw new Error(result.message || "Máy chủ Drive không phản hồi đường dẫn tệp.");
        } catch(err) {
            clearTimeout(timer);
            lastError = err;
            if (err.name === 'AbortError' || String(err.message).includes('abort')) {
                lastError = new Error(`Thời gian tải lên Drive quá ${timeoutMs / 1000}s.`);
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    throw lastError;
}

// HÀM TRÍCH XUẤT SỐ LƯỢNG CÂU CỦA ĐỀ THI HIỆN TẠI
function detectExamQuestionCount() {
    const title = currentTuLuanModalData.examTitle || "";

    const match = title.match(/(\d{1,3})\s*(?:câu|cau)/i);
    if (match && match[1]) {
        const count = parseInt(match[1], 10);
        if (count >= 5 && count <= 120) return count;
    }

    if (typeof examData !== 'undefined' && examData && Array.isArray(examData.questions) && examData.questions.length > 0) {
        return examData.questions.length;
    }

    return 40;
}

function updateTuLuanAdminUI() {
    const isAdmin = checkCurrentIsAdmin();
    const adminBox = document.getElementById("tuluan-admin-add-exam-box");
    if (adminBox) {
        adminBox.style.setProperty("display", isAdmin ? "flex" : "none", "important");
    }
    const delExamBtn = document.getElementById("btn-del-current-exam");
    if (delExamBtn) {
        delExamBtn.style.setProperty("display", isAdmin ? "inline-flex" : "none", "important");
    }
    const upDapanBtn = document.getElementById("btn-up-dapan-cham");
    if (upDapanBtn) {
        upDapanBtn.style.setProperty("display", isAdmin ? "inline-flex" : "none", "important");
    }
    const schedWrap = document.getElementById("box-schedule-dapan-wrap");
    if (schedWrap) {
        schedWrap.style.setProperty("display", isAdmin ? "inline-block" : "none", "important");
    }
    const delDapanMini = document.getElementById("btn-del-dapan-mini");
    const delDapanStrip = document.getElementById("strip-dapan-del-btn");
    if (delDapanMini) delDapanMini.style.display = isAdmin ? "inline-flex" : "none";
    if (delDapanStrip) delDapanStrip.style.display = isAdmin ? "inline-flex" : "none";
}
--- START OF FILE text/javascript ---
