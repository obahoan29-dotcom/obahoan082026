// =========================================================
// FILE: portal-tuluan.js
// QUẢN LÝ NỘP BÀI TỰ LUẬN GOOGLE DRIVE 5TB & ĐỒNG BỘ 100% QUA SUPABASE
// ĐÃ FIX TRIỆT ĐỂ LỖI BUNG POPOVER, TỐI ƯU SIÊU GỌN VÀ LIGHTBOX ĐA TRANG
// =========================================================

// TỰ ĐỘNG NHÚNG CSS BẢNG TỰ LUẬN, KHÓA ẨN POPOVER VÀ LIGHTBOX ĐA TRANG
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
        .dapan-schedule-popover {
            display: none !important;
            position: absolute !important;
            background: #ffffff !important;
            border-radius: 12px !important;
            padding: 12px !important;
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
            z-index: 999999 !important;
            text-align: left !important;
            box-sizing: border-box !important;
            animation: popInBadge 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .student-pass-popover.show,
        .student-feedback-popover.show,
        .dapan-schedule-popover.show {
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

        /* HÀNG CHỌN LỚP, ĐỀ & NÚT CÔNG CỤ SIÊU GỌN */
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

        /* DÒNG ĐÁP ÁN ĐẦY ĐỦ RÚT GỌN TỐI ĐA */
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

        /* THANH TÌM KIẾM & BỘ LỌC RÚT GỌN */
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

        /* BẢNG DANH SÁCH HỌC SINH MỞ RỘNG TỐI ĐA */
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

        .tuluan-score-input {
            width: 70px !important;
            padding: 4px 5px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 7px !important;
            font-size: 12.5px !important;
            font-weight: 900 !important;
            text-align: center !important;
            outline: none !important;
            color: #0284c7 !important;
            background: #ffffff !important;
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

        /* Styling chi tiết trong Popover */
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
        .pass-popover-hint {
            font-size: 10.5px !important;
            color: #475569 !important;
            background: #f0f9ff !important;
            border: 1px solid #bae6fd !important;
            padding: 5px 7px !important;
            border-radius: 6px !important;
            margin-bottom: 7px !important;
            line-height: 1.35 !important;
        }
        .pass-input-row { margin-bottom: 6px !important; }
        .pass-input-row label {
            display: block !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
            color: #334155 !important;
            margin-bottom: 2px !important;
        }
        .pass-input-row input {
            width: 100% !important;
            padding: 5px 7px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 6px !important;
            font-size: 12.5px !important;
            font-weight: 700 !important;
            outline: none !important;
            box-sizing: border-box !important;
        }
        .pass-popover-actions {
            display: flex !important;
            gap: 5px !important;
            margin-top: 8px !important;
        }
        .btn-pass-cancel {
            flex: 1 !important;
            padding: 5px !important;
            background: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #475569 !important;
            cursor: pointer !important;
        }
        .btn-pass-save {
            flex: 1.5 !important;
            padding: 5px !important;
            background: linear-gradient(135deg, #16a34a, #15803d) !important;
            border: none !important;
            border-radius: 6px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            cursor: pointer !important;
        }

        .feedback-textarea {
            width: 100% !important;
            padding: 6px 8px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 6px !important;
            font-size: 12px !important;
            font-family: inherit !important;
            font-weight: 600 !important;
            box-sizing: border-box !important;
            margin-bottom: 5px !important;
            outline: none !important;
        }
        .dapan-sched-radio-item {
            display: flex !important;
            align-items: flex-start !important;
            gap: 6px !important;
            margin-bottom: 6px !important;
            cursor: pointer !important;
            font-size: 11.5px !important;
            font-weight: 700 !important;
        }
        .dapan-sched-input {
            width: 100% !important;
            padding: 5px 7px !important;
            border: 1.2px solid #cbd5e1 !important;
            border-radius: 6px !important;
            font-size: 11.5px !important;
            font-weight: 700 !important;
            outline: none !important;
            box-sizing: border-box !important;
        }
        .btn-quick-deadline {
            display: inline-flex !important;
            padding: 3px 6px !important;
            background: #fffbeb !important;
            border: 1px solid #fde68a !important;
            border-radius: 5px !important;
            font-size: 10.5px !important;
            font-weight: 800 !important;
            color: #b45309 !important;
            cursor: pointer !important;
            margin-top: 4px !important;
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
        /* 3. LIGHTBOX XEM ẢNH ĐA TRANG VỚI 2 NÚT TAM GIÁC & CẢM ỨNG VUỐT */
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
            max-width: 920px !important;
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
            padding: 8px 12px !important;
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
        .btn-lightbox-open-drive {
            background: #0284c7 !important;
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 8px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            text-decoration: none !important;
            transition: 0.15s !important;
            white-space: nowrap !important;
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
            touch-action: pan-y !important;
        }
        #lightbox-full-img {
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
            border-radius: 6px !important;
            transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
        }

        /* 2 NÚT TAM GIÁC LỚN BÊN TRÁI & PHẢI */
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
            padding: 6px 14px !important;
            background: #1e293b !important;
            border-top: 1.5px solid #334155 !important;
            font-size: 11.5px !important;
            color: #94a3b8 !important;
            font-weight: 700 !important;
            flex-shrink: 0 !important;
        }
        .lightbox-dots-container {
            display: flex !important;
            align-items: center !important;
            gap: 5px !important;
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
            width: 18px !important;
            border-radius: 8px !important;
        }

        @media (max-width: 640px) {
            .btn-lightbox-nav {
                width: 36px !important;
                height: 36px !important;
                font-size: 17px !important;
            }
            .btn-lightbox-nav.btn-nav-prev { left: 6px !important; }
            .btn-lightbox-nav.btn-nav-next { right: 6px !important; }
        }
    `;
    document.head.appendChild(style);
})();

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

// TRẠNG THÁI TRÌNH XEM ẢNH LIGHTBOX
let currentLightboxGallery = {
    studentName: "",
    images: [],
    currentIndex: 0,
    touchStartX: 0,
    touchStartY: 0
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
                    let base64 = rawResult.includes("base64,") ? rawResult.split("base64,")[1] : rawResult;
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

function ensureTuLuanModalDOM() {
    if (document.getElementById("modal-tuluan-submission")) return;
    const modalDiv = document.createElement("div");
    modalDiv.id = "modal-tuluan-submission";
    modalDiv.className = "move-modal-overlay";
    modalDiv.innerHTML = `
        <div class="tuluan-modal-card" onclick="event.stopPropagation()">
            <!-- HEADER SIÊU GỌN -->
            <div class="tuluan-modal-header">
                <div class="tuluan-header-title-box">
                    <span class="tuluan-icon-badge">📁</span>
                    <div style="min-width:0; flex:1;">
                        <h3 id="tuluan-modal-heading">📤 NỘP BÀI TỰ LUẬN</h3>
                        <div id="tuluan-modal-subheading">
                            Drive: <code id="tuluan-drive-folder-path" style="color:#0284c7; background:#e0f2fe; padding:1px 4px; border-radius:4px;">BAI_TAP_TU_LUAN</code>
                        </div>
                    </div>
                </div>
                <button type="button" class="btn-close-cleanup-modal" onclick="closeTuLuanModal(event)">✕</button>
            </div>

            <!-- THANH ĐIỀU HƯỚNG CHỌN LỚP, ĐÁP ÁN, HẸN GIỜ & CHỌN ĐỀ SÁT NHAU -->
            <div class="tuluan-select-bar">
                <div class="tuluan-select-group" style="flex-shrink:0;">
                    <label>🏫 Lớp:</label>
                    <select id="tuluan-class-selector" onchange="onTuLuanClassChanged(this.value)" class="tuluan-class-compact-select" title="Chọn lớp">
                        <option value="lop-11a">11A</option>
                        <option value="lop-11c">11C</option>
                        <option value="lop-10p">10P</option>
                        <option value="lop-11e">11E</option>
                        <option value="them-11">Thêm 11</option>
                        <option value="them-10">Thêm 10</option>
                        <option value="them-12">Thêm 12</option>
                        <option value="hsg-toan-11">HSG 11</option>
                    </select>
                </div>

                <div class="tuluan-dapan-mini-box" id="tuluan-dapan-mini-box">
                    <input type="file" id="tuluan-dapan-file-input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip,.rar,.xlsx" style="display:none;" onchange="handleUploadDapAnCham(this)">
                    <button type="button" class="btn-tuluan-upload-dapan" id="btn-up-dapan-cham" onclick="triggerUploadDapAnCham(event)" title="Tải file Đáp án chấm tự luận lên Drive">
                        📤 Đ.Á chấm
                    </button>

                    <div style="position:relative; display:inline-block;" id="box-schedule-dapan-wrap">
                        <button type="button" class="btn-tuluan-schedule-dapan" id="btn-schedule-dapan" onclick="toggleDapAnSchedulePopover(event)" title="Hẹn giờ tự động mở đáp án cho học sinh">
                            ⏰ Hẹn giờ
                        </button>

                        <div class="dapan-schedule-popover" id="dapan-schedule-popover" onclick="event.stopPropagation()">
                            <div class="pass-popover-header">
                                <span>⏰ Hẹn Giờ Mở Đáp Án Chấm</span>
                                <button type="button" class="btn-close-pass-pop" onclick="closeDapAnSchedulePopover(event)">✕</button>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-bottom:8px; line-height:1.4;">
                                Cài đặt thời điểm học sinh được phép xem đáp án. Trước thời điểm này, đáp án sẽ tự động khóa để bảo mật.
                            </div>

                            <label class="dapan-sched-radio-item">
                                <input type="radio" name="dapan-sched-mode" id="sched-mode-now" value="now" checked onchange="onDapAnScheduleModeChanged('now')">
                                <span>🔓 Mở ngay lập tức (Học sinh xem được luôn)</span>
                            </label>

                            <label class="dapan-sched-radio-item">
                                <input type="radio" name="dapan-sched-mode" id="sched-mode-auto" value="auto" onchange="onDapAnScheduleModeChanged('auto')">
                                <span>⏰ Tự động mở vào ngày & giờ quy định:</span>
                            </label>

                            <div id="sched-datetime-input-group" style="display:none; padding-left:20px; margin-bottom:8px;">
                                <input type="datetime-local" id="dapan-sched-datetime" class="dapan-sched-input">
                                <button type="button" class="btn-quick-deadline" onclick="setScheduleToExamDeadline()">
                                    ⚡ Lấy giờ đóng đề thi
                                </button>
                            </div>

                            <div class="pass-popover-actions">
                                <button type="button" class="btn-pass-cancel" onclick="closeDapAnSchedulePopover(event)">Hủy</button>
                                <button type="button" class="btn-pass-save" style="background:linear-gradient(135deg, #f59e0b, #d97706);" onclick="saveDapAnSchedule(event)">💾 Lưu hẹn giờ</button>
                            </div>
                        </div>
                    </div>

                    <div id="tuluan-dapan-badge-wrap" style="display:none; align-items:center; gap:3px;">
                        <a id="tuluan-dapan-badge-link" href="#" target="_blank" class="btn-dapan-badge-active" title="Mở file đáp án chấm">
                            <span class="badge-moi-mini" id="badge-moi-mini-text">MỚI</span>
                            <span id="tuluan-dapan-badge-filename" class="dapan-filename-truncate">Đáp án</span>
                        </a>
                        <button type="button" class="btn-del-dapan-mini" id="btn-del-dapan-mini" style="display:none;" onclick="deleteDapAnCham(event)" title="Xóa file đáp án chấm này">✕</button>
                    </div>
                </div>

                <div class="tuluan-select-group" style="flex:1; min-width:140px;">
                    <label>📝 Đề:</label>
                    <div style="display:flex; align-items:center; gap:3px; width:100%;">
                        <select id="tuluan-exam-selector" onchange="onTuLuanExamChanged(this.value)"></select>
                        <button type="button" class="btn-del-exam-selector" id="btn-del-current-exam" style="display:none;" onclick="deleteCurrentTuLuanExam(event)" title="Xóa đề này khỏi danh sách đề tự luận">
                            🗑️ Xóa đề
                        </button>
                    </div>
                </div>

                <div id="tuluan-admin-add-exam-box" style="display:none; align-items:center; gap:3px; flex-wrap:wrap;">
                    <button type="button" class="btn-tuluan-add-exam" onclick="promptAddNewTuLuanExam()">➕ Thêm đề</button>
                    <button type="button" class="btn-tuluan-approve-all" onclick="toggleApproveAllSubmissions(true)" title="Duyệt tất cả bài làm của đề này">✅ Duyệt hết</button>
                    <button type="button" class="btn-tuluan-export-excel" onclick="exportTuLuanToExcel(event)" title="Xuất Excel bài làm">📊 Xuất excel</button>
                </div>
            </div>

            <!-- DÒNG ĐÁP ÁN GỌN GÀNG -->
            <div id="tuluan-dapan-full-strip" class="tuluan-dapan-full-strip" style="display:none;">
                <div class="dapan-strip-content">
                    <span class="dapan-badge-new" id="strip-dapan-badge-tag">MỚI</span>
                    <a id="strip-dapan-link" href="#" target="_blank" class="dapan-strip-title" title="Bấm vào để mở xem file Đáp án chấm">
                        ĐÁP ÁN: <span id="strip-dapan-filename">...</span>
                    </a>
                    <span class="dapan-strip-time" id="strip-dapan-time">📅 ...</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <a id="strip-dapan-open-btn" href="#" target="_blank" class="btn-open-dapan-strip">🔗 Mở xem</a>
                    <button type="button" id="strip-dapan-del-btn" class="btn-del-dapan-strip" style="display:none;" onclick="deleteDapAnCham(event)" title="Xóa file đáp án này">🗑️</button>
                </div>
            </div>

            <!-- TOOLBAR TÌM KIẾM & BỘ LỌC GỌN -->
            <div class="tuluan-toolbar-bar">
                <input type="text" id="tuluan-search-student" class="tuluan-search-box" placeholder="🔍 Tìm tên hoặc SBD..." oninput="filterTuLuanStudentTable()">
                <div class="tuluan-filter-tabs">
                    <button type="button" class="tuluan-tab-pill active" id="tab-filter-all" onclick="filterTuLuanStatus('all')">Tất cả (<span id="count-all-st">0</span>)</button>
                    <button type="button" class="tuluan-tab-pill" id="tab-filter-submitted" onclick="filterTuLuanStatus('submitted')">✅ Đã nộp (<span id="count-sub-st">0</span>)</button>
                    <button type="button" class="tuluan-tab-pill" id="tab-filter-pending" onclick="filterTuLuanStatus('pending')">⏳ Chưa nộp (<span id="count-pen-st">0</span>)</button>
                </div>
            </div>

            <!-- BẢNG DANH SÁCH HỌC SINH -->
            <div class="tuluan-table-wrap">
                <table class="tuluan-table">
                    <thead>
                        <tr>
                            <th style="width: 36px; text-align: center;">STT</th>
                            <th style="width: 140px;">Họ và tên</th>
                            <th style="width: 70px; text-align: center;">SBD</th>
                            <th style="width: 130px;">Trạng thái / Ngày nộp</th>
                            <th style="width: 95px; text-align: center;">Phê duyệt</th>
                            <th style="min-width: 150px;">Ảnh bài làm đã nộp</th>
                            <th style="width: 95px; text-align: center;" title="Nhập điểm chấm chéo bài tự luận">Chấm chéo</th>
                            <th style="width: 95px; text-align: center;" title="Nhận xét bài làm">Nhận xét</th>
                            <th style="min-width: 160px; text-align: center;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="tuluan-students-tbody"></tbody>
                </table>
            </div>

            <div class="tuluan-modal-footer">
                <span style="font-size:10.5px; color:#64748b; font-style:italic;">
                    🔒 Học sinh xem được ảnh bài làm sau khi Giáo viên duyệt. Rê chuột vào ô điểm để xem người chấm.
                </span>
                <button type="button" class="btn-admin btn-cancel" style="padding: 3px 12px; font-size:11.5px;" onclick="closeTuLuanModal(event)">Đóng</button>
            </div>
        </div>

        <!-- LIGHTBOX XEM ẢNH ĐA TRANG VỚI 2 NÚT TAM GIÁC & CẢM ỨNG VUỐT -->
        <div id="tuluan-lightbox" class="tuluan-lightbox-overlay" onclick="closeTuLuanLightbox(event)">
            <div class="tuluan-lightbox-content" onclick="event.stopPropagation()">
                <div class="tuluan-lightbox-header">
                    <div class="lightbox-title-wrap">
                        <span id="lightbox-student-title">Ảnh bài làm</span>
                        <span class="lightbox-page-badge" id="lightbox-page-indicator">Tr 1/1</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <a id="lightbox-drive-link" href="#" target="_blank" class="btn-lightbox-open-drive">🔗 Drive</a>
                        <button type="button" class="btn-close-lightbox" onclick="closeTuLuanLightbox(event)">✕</button>
                    </div>
                </div>

                <!-- VÙNG ẢNH & 2 NÚT TAM GIÁC CHUYỂN TRANG -->
                <div class="tuluan-lightbox-img-box" id="lightbox-touch-area">
                    <button type="button" class="btn-lightbox-nav btn-nav-prev" id="btn-lightbox-prev" onclick="navigateLightbox(-1, event)" title="Xem trang trước (hoặc vuốt sang phải)">
                        ◀
                    </button>
                    <img id="lightbox-full-img" src="" alt="Ảnh bài làm tự luận">
                    <button type="button" class="btn-lightbox-nav btn-nav-next" id="btn-lightbox-next" onclick="navigateLightbox(1, event)" title="Xem trang sau (hoặc vuốt sang trái)">
                        ▶
                    </button>
                </div>

                <!-- THANH ĐIỀU HƯỚNG DƯỚI ĐÁY -->
                <div class="lightbox-bottom-bar">
                    <div class="lightbox-dots-container" id="lightbox-dots-container"></div>
                    <span style="font-size:11px;">💡 Bấm ◀ / ▶ hoặc lấy tay vuốt màn hình để chuyển trang</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    setupLightboxSwipeGestures();
}

function setupLightboxSwipeGestures() {
    const area = document.getElementById("lightbox-touch-area");
    if (!area) return;

    area.addEventListener("touchstart", function(e) {
        if (!e.touches || e.touches.length === 0) return;
        currentLightboxGallery.touchStartX = e.touches[0].clientX;
        currentLightboxGallery.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    area.addEventListener("touchend", function(e) {
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const diffX = endX - currentLightboxGallery.touchStartX;
        const diffY = endY - currentLightboxGallery.touchStartY;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
            if (diffX < 0) {
                navigateLightbox(1);
            } else {
                navigateLightbox(-1);
            }
        }
    }, { passive: true });

    document.addEventListener("keydown", function(e) {
        const lb = document.getElementById("tuluan-lightbox");
        if (lb && lb.style.display === "flex") {
            if (e.key === "ArrowLeft") navigateLightbox(-1);
            else if (e.key === "ArrowRight") navigateLightbox(1);
            else if (e.key === "Escape") closeTuLuanLightbox();
        }
    });
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

async function openTuLuanModal(classId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    ensureTuLuanModalDOM();

    let targetCat = classId;
    if (targetCat === "tu-luan-padlet" || !targetCat) {
        if (itemId && itemId.includes("11c")) targetCat = "lop-11c";
        else if (itemId && itemId.includes("10p")) targetCat = "lop-10p";
        else if (itemId && itemId.includes("11e")) targetCat = "lop-11e";
        else targetCat = "lop-11a";
    }

    currentTuLuanModalData.classId = targetCat;
    const classSelector = document.getElementById("tuluan-class-selector");
    if (classSelector) classSelector.value = targetCat;

    updateTuLuanAdminUI();

    document.getElementById("modal-tuluan-submission").style.display = "flex";
    await refreshTuLuanExamList(targetCat, itemId);
}

function closeTuLuanModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const modal = document.getElementById("modal-tuluan-submission");
    if (modal) modal.style.display = "none";
    
    if (tuLuanRealtimeChannel) {
        const client = getDbClient();
        if (client) {
            try { client.removeChannel(tuLuanRealtimeChannel); } catch(e) {}
        }
        tuLuanRealtimeChannel = null;
    }
}

async function refreshTuLuanExamList(targetCat, preferredExamId = null) {
    const selector = document.getElementById("tuluan-exam-selector");
    if (!selector) return;

    currentTuLuanModalData.classId = targetCat;
    selector.innerHTML = "<option value=''>⏳ Đang tải 5 đề mới nhất...</option>";

    let rawExams = [];
    const client = getDbClient();

    if (client) {
        try {
            const { data: linksData } = await client
                .from('custom_links')
                .select('*')
                .eq('category_id', targetCat);

            if (Array.isArray(linksData)) {
                linksData.forEach(item => {
                    if (item && item.title && String(item.title).trim() !== "") {
                        let t = item.timestamp || (typeof parseDateString === 'function' ? parseDateString(item.date) : 0) || 0;
                        rawExams.push({
                            id: (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(item) || item.id) : item.id,
                            title: item.title,
                            timestamp: t
                        });
                    }
                });
            }
        } catch(e) {
            console.warn("Lỗi tải đề từ Supabase custom_links:", e);
        }
    }

    const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
    const catObj = allCats.find(c => c.id === targetCat);
    if (catObj && Array.isArray(catObj.links)) {
        catObj.links.forEach(l => {
            if (l && l.title && String(l.title).trim() !== "") {
                let t = l.timestamp || (typeof parseDateString === 'function' ? parseDateString(l.date) : 0) || 0;
                rawExams.push({
                    id: (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(l) || l.id) : l.id,
                    title: l.title,
                    timestamp: t
                });
            }
        });
    }

    rawExams.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const uniqueExams = [];
    const seenTitles = new Set();
    rawExams.forEach(ex => {
        const norm = ex.title.trim().toLowerCase();
        if (!seenTitles.has(norm)) {
            seenTitles.add(norm);
            uniqueExams.push(ex);
        }
    });

    let top5Exams = uniqueExams.slice(0, 5);

    if (top5Exams.length === 0) {
        const driveClassClean = getCleanDriveClassName(targetCat);
        top5Exams.push({
            id: `DE_TU_LUAN_${driveClassClean}`,
            title: `Đề tự luận ${driveClassClean}`,
            timestamp: Date.now()
        });
    }

    currentTuLuanModalData.availableExams = top5Exams;
    selector.innerHTML = "";

    top5Exams.forEach((ex, idx) => {
        const opt = document.createElement("option");
        opt.value = ex.id;
        opt.innerText = `${idx + 1}. ${ex.title}`;
        opt.dataset.title = ex.title;
        selector.appendChild(opt);
    });

    let selectedExam = top5Exams[0];
    if (preferredExamId) {
        const found = top5Exams.find(e => e.id === preferredExamId || e.title === preferredExamId);
        if (found) selectedExam = found;
    }
    selector.value = selectedExam.id;

    updateTuLuanAdminUI();
    await switchTuLuanExam(selectedExam.id, selectedExam.title);
}

async function switchTuLuanExam(examId, examTitle) {
    const classSelector = document.getElementById("tuluan-class-selector");
    if (classSelector && classSelector.value) {
        currentTuLuanModalData.classId = classSelector.value;
    }

    currentTuLuanModalData.quizId = examId;
    currentTuLuanModalData.examTitle = examTitle;

    const folderKey = getUnifiedExamFolderKey(examTitle, "", examId);
    const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);

    const headTitle = document.getElementById("tuluan-modal-heading");
    const pathCode = document.getElementById("tuluan-drive-folder-path");
    if (headTitle) headTitle.innerText = `📤 NỘP BÀI TỰ LUẬN - ${examTitle}`;
    if (pathCode) pathCode.innerText = `BAI_TAP_TU_LUAN / ${driveClassName} / ${folderKey} / [STT_SBD_HỌ_TÊN]`;

    updateTuLuanAdminUI();

    await loadTuLuanSubmissionsFromSupabase();
    renderDapAnChamUI();
    renderTuLuanStudentsTable();
    startTuLuanRealtimeListener(examId);
}

function onTuLuanClassChanged(newClassId) {
    currentTuLuanModalData.classId = newClassId;
    refreshTuLuanExamList(newClassId);
}

function onTuLuanExamChanged(newExamId) {
    const selector = document.getElementById("tuluan-exam-selector");
    const selectedOpt = selector.options[selector.selectedIndex];
    const examTitle = selectedOpt ? selectedOpt.dataset.title : newExamId;
    switchTuLuanExam(newExamId, examTitle);
}

async function deleteCurrentTuLuanExam(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!checkCurrentIsAdmin()) {
        alert("⛔ Chỉ Giáo viên quản trị mới có quyền xóa đề thi!");
        return;
    }

    const classSelector = document.getElementById("tuluan-class-selector");
    const classId = (classSelector && classSelector.value) ? classSelector.value : (currentTuLuanModalData.classId || "lop-11a");
    const className = getCleanDriveClassName(classId);

    const selector = document.getElementById("tuluan-exam-selector");
    if (!selector || !selector.value) {
        alert("⚠️ Vui lòng chọn một đề để xóa!");
        return;
    }

    const examId = selector.value;
    const selectedOpt = selector.options[selector.selectedIndex];
    let examTitle = selectedOpt ? (selectedOpt.dataset.title || selectedOpt.innerText) : examId;
    examTitle = examTitle.replace(/^\d+\.\s*/, '').trim();

    if (!confirm(`⚠️ XÁC NHẬN XÓA ĐỀ TỰ LUẬN (ADMIN):\n\nThầy có chắc chắn muốn XÓA đề:\n"${examTitle}"\nkhỏi danh sách nộp bài của lớp ${className} không?\n\n(Hệ thống sẽ gỡ bỏ đề này khỏi lớp ${className} và cập nhật tức thì).`)) {
        return;
    }

    const btn = document.getElementById("btn-del-current-exam");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang xóa...";
    }

    try {
        const client = getDbClient();
        if (client) {
            await Promise.all([
                client.from('custom_links').delete().eq('category_id', classId).eq('id', examId),
                client.from('custom_links').delete().eq('category_id', classId).eq('title', examTitle),
                client.from('tu_luan_submissions').delete().eq('quiz_id', examId),
                client.from('app_key_values').delete().eq('key', 'dapan_' + examId)
            ]);
        }

        const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
        const catObj = allCats.find(c => c.id === classId);
        if (catObj && Array.isArray(catObj.links)) {
            catObj.links = catObj.links.filter(l => (l.id !== examId && l.firebaseId !== examId && l.title !== examTitle));
        }

        alert(`🗑️ Đã xóa đề "${examTitle}" của lớp ${className} thành công!`);
        await refreshTuLuanExamList(classId);
    } catch(err) {
        alert("❌ Lỗi khi xóa đề: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🗑️ Xóa đề";
        }
    }
}

async function promptAddNewTuLuanExam() {
    const inputTitle = prompt("➕ NHẬP TÊN ĐỀ THI TỰ LUẬN MỚI (VD: Đề 109 Giữa Kỳ 1, Đề 108 Toán 11...):");
    if (!inputTitle || !inputTitle.trim()) return;

    const examTitle = inputTitle.trim();
    const classSelector = document.getElementById("tuluan-class-selector");
    const classId = (classSelector && classSelector.value) ? classSelector.value : (currentTuLuanModalData.classId || "lop-11a");
    currentTuLuanModalData.classId = classId;

    const examId = "exam_" + Date.now();
    const folderKey = getUnifiedExamFolderKey(examTitle, "", examId);
    const driveClassName = getCleanDriveClassName(classId);

    try {
        const client = getDbClient();
        if (client) {
            await client.from('custom_links').upsert({
                id: examId,
                category_id: classId,
                title: examTitle,
                is_doc: true,
                badge_text: "MỚI",
                timestamp: Date.now(),
                date: new Date().toLocaleDateString("vi-VN"),
                url: "#"
            });
        }

        const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
            ? GOOGLE_DRIVE_TULUAN_GAS_URL 
            : GOOGLE_DRIVE_UPLOAD_GAS_URL;

        if (gasUrl && !gasUrl.includes("DÁN_URL")) {
            fetch(gasUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "createExamFolders",
                    rootFolder: "BAI_TAP_TU_LUAN",
                    className: driveClassName,
                    class: driveClassName,
                    lop: driveClassName,
                    classList: [driveClassName],
                    examTitle: folderKey,
                    folderKey: folderKey
                })
            }).catch(() => null);
        }

        alert(`✅ Đã thêm đề "${examTitle}" thành công cho lớp ${driveClassName}!`);
        await refreshTuLuanExamList(classId, examId);
    } catch(err) {
        alert("❌ Lỗi khi thêm đề: " + err.message);
    }
}

async function loadTuLuanSubmissionsFromSupabase() {
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    const client = getDbClient();
    if (!client) {
        currentTuLuanModalData.submissionsMap = {};
        currentTuLuanModalData.dapAnCham = null;
        return;
    }

    try {
        const [subsRes, passRes, dapanRes] = await Promise.all([
            client.from('tu_luan_submissions').select('*').eq('quiz_id', qId),
            client.from('app_key_values').select('value').eq('key', 'student_custom_passwords').single(),
            client.from('app_key_values').select('value').eq('key', 'dapan_' + qId).single()
        ]);

        let combined = {};
        if (subsRes && Array.isArray(subsRes.data)) {
            subsRes.data.forEach(row => {
                if (row && row.sbd) {
                    combined[row.sbd] = {
                        stt: row.stt,
                        sbd: row.sbd,
                        studentName: row.student_name,
                        className: row.class_name,
                        examTitle: row.exam_title,
                        lastSubmit: row.last_submit,
                        lastSubmitTime: row.last_submit_time,
                        count: row.count || (Array.isArray(row.images) ? row.images.length : 0),
                        images: Array.isArray(row.images) ? row.images : [],
                        crossScore: row.cross_score || "",
                        crossScoreBy: row.cross_score_by || "",
                        crossScoreTime: row.cross_score_time || "",
                        feedback: row.feedback || "",
                        feedbackTime: row.feedback_time || "",
                        isApproved: !!row.is_approved
                    };
                }
            });
        }
        currentTuLuanModalData.submissionsMap = combined;

        if (passRes && passRes.data && passRes.data.value) {
            currentTuLuanModalData.customPasswords = passRes.data.value;
        } else {
            currentTuLuanModalData.customPasswords = {};
        }

        if (dapanRes && dapanRes.data && dapanRes.data.value && dapanRes.data.value.fileUrl) {
            currentTuLuanModalData.dapAnCham = dapanRes.data.value;
        } else {
            currentTuLuanModalData.dapAnCham = null;
        }
    } catch(e) {
        console.warn("Lỗi đọc dữ liệu tự luận Supabase:", e);
        currentTuLuanModalData.submissionsMap = {};
        currentTuLuanModalData.dapAnCham = null;
    }
}

function startTuLuanRealtimeListener(quizId) {
    const client = getDbClient();
    if (!client || !quizId) return;

    if (tuLuanRealtimeChannel) {
        try { client.removeChannel(tuLuanRealtimeChannel); } catch(e) {}
        tuLuanRealtimeChannel = null;
    }

    try {
        tuLuanRealtimeChannel = client.channel(`tuluan_realtime_${quizId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tu_luan_submissions',
                filter: `quiz_id=eq.${quizId}`
            }, async () => {
                await loadTuLuanSubmissionsFromSupabase();
                renderDapAnChamUI();
                renderTuLuanStudentsTable();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'app_key_values',
                filter: `key=eq.dapan_${quizId}`
            }, async () => {
                await loadTuLuanSubmissionsFromSupabase();
                renderDapAnChamUI();
            })
            .subscribe();
    } catch(e) {
        console.warn("Lỗi kết nối Supabase Realtime channel:", e);
    }
}

function triggerUploadDapAnCham(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const fileIn = document.getElementById("tuluan-dapan-file-input");
    if (fileIn) {
        fileIn.value = "";
        fileIn.click();
    }
}

async function handleUploadDapAnCham(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    const btn = document.getElementById("btn-up-dapan-cham");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang gửi...";
    }

    const qId = currentTuLuanModalData.quizId || "quiz";
    const classId = currentTuLuanModalData.classId || "lop-11a";

    const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
        ? GOOGLE_DRIVE_TULUAN_GAS_URL 
        : GOOGLE_DRIVE_UPLOAD_GAS_URL;

    if (!gasUrl || gasUrl.includes("DÁN_URL")) {
        alert("⚠️ Chưa cấu hình GOOGLE_DRIVE_TULUAN_GAS_URL trong app-config.js!");
        if (btn) { btn.disabled = false; btn.innerText = "📤 Đ.Á chấm"; }
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                let rawResult = String(e.target.result || "");
                let base64Data = rawResult.includes("base64,") ? rawResult.split("base64,")[1] : rawResult;

                const payload = {
                    action: "uploadDapAnCham",
                    rootFolder: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO",
                    className: "Dap_an_cham_tu_luan",
                    class: "Dap_an_cham_tu_luan",
                    lop: "Dap_an_cham_tu_luan",
                    examTitle: "Dap_an_cham_tu_luan",
                    folderKey: "Dap_an_cham_tu_luan",
                    studentFolder: "Dap_an_cham_tu_luan",
                    filename: file.name,
                    mimeType: file.type || "application/octet-stream",
                    base64: base64Data
                };

                const result = await sendToGoogleDriveWithRetry(gasUrl, payload, 2, 75000);
                if (result && result.status === "success" && result.fileUrl) {
                    const now = new Date();
                    const pad = n => String(n).padStart(2, '0');
                    const uploadTimeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;

                    const directUrl = result.directUrl || (typeof toDirectGoogleDriveImageUrl === 'function' ? toDirectGoogleDriveImageUrl(result.fileUrl) : result.fileUrl);
                    const existingDapan = currentTuLuanModalData.dapAnCham || {};

                    const dapanData = {
                        quizId: qId,
                        classId: classId,
                        fileName: file.name,
                        fileUrl: result.fileUrl,
                        directUrl: directUrl,
                        fileId: result.fileId || "",
                        uploadedAt: uploadTimeStr,
                        timestamp: Date.now(),
                        scheduleTime: existingDapan.scheduleTime || null
                    };

                    const client = getDbClient();
                    if (client) {
                        await client.from('app_key_values').upsert({
                            key: 'dapan_' + qId,
                            value: dapanData
                        });
                    }

                    currentTuLuanModalData.dapAnCham = dapanData;
                    renderDapAnChamUI();
                    alert(`🎉 ĐÃ TẢI LÊN ĐÁP ÁN CHẤM THÀNH CÔNG!\n\n📁 Tên file: ${file.name}`);
                } else {
                    throw new Error(result.message || "Không thể lấy đường dẫn tệp từ Google Drive.");
                }
            } catch(upErr) {
                alert("❌ Lỗi khi tải file lên Drive: " + upErr.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = "📤 Đ.Á chấm";
                }
                fileInput.value = "";
            }
        };
        reader.readAsDataURL(file);
    } catch(err) {
        alert("❌ Lỗi đọc file từ máy: " + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📤 Đ.Á chấm";
        }
        fileInput.value = "";
    }
}

async function deleteDapAnCham(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!checkCurrentIsAdmin()) {
        alert("⛔ Chỉ Giáo viên quản trị mới có quyền xóa file Đáp án chấm!");
        return;
    }

    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA file Đáp án chấm của đề này không?")) return;

    const qId = currentTuLuanModalData.quizId;
    const curDapan = currentTuLuanModalData.dapAnCham;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('app_key_values').delete().eq('key', 'dapan_' + qId);
        }

        if (curDapan && curDapan.fileId) {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
                ? GOOGLE_DRIVE_TULUAN_GAS_URL 
                : GOOGLE_DRIVE_UPLOAD_GAS_URL;
            if (gasUrl && !gasUrl.includes("DÁN_URL")) {
                fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "deleteFile", fileId: curDapan.fileId })
                }).catch(() => null);
            }
        }

        currentTuLuanModalData.dapAnCham = null;
        renderDapAnChamUI();
        alert("🗑️ Đã xóa file Đáp án chấm thành công!");
    } catch(err) {
        alert("❌ Lỗi khi xóa: " + err.message);
    }
}

function toggleDapAnSchedulePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("dapan-schedule-popover");
    if (!pop) return;
    const isShown = pop.classList.contains("show");

    document.querySelectorAll(".student-pass-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".student-feedback-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".dapan-schedule-popover.show").forEach(p => p.classList.remove("show"));

    if (!isShown) {
        pop.classList.add("show");

        const curDapan = currentTuLuanModalData.dapAnCham;
        const radioNow = document.getElementById("sched-mode-now");
        const radioAuto = document.getElementById("sched-mode-auto");
        const dateInput = document.getElementById("dapan-sched-datetime");

        if (curDapan && curDapan.scheduleTime) {
            if (radioAuto) radioAuto.checked = true;
            onDapAnScheduleModeChanged('auto');
            if (dateInput) {
                const d = new Date(curDapan.scheduleTime);
                if (!isNaN(d.getTime()) && typeof toLocalDatetimeString === 'function') {
                    dateInput.value = toLocalDatetimeString(d);
                } else if (!isNaN(d.getTime())) {
                    const pad = n => String(n).padStart(2, '0');
                    dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
            }
        } else {
            if (radioNow) radioNow.checked = true;
            onDapAnScheduleModeChanged('now');
            if (dateInput) dateInput.value = "";
        }
    }
}

function closeDapAnSchedulePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("dapan-schedule-popover");
    if (pop) pop.classList.remove("show");
}

function onDapAnScheduleModeChanged(mode) {
    const inputGroup = document.getElementById("sched-datetime-input-group");
    if (inputGroup) {
        inputGroup.style.display = (mode === 'auto') ? 'block' : 'none';
        if (mode === 'auto') {
            const dateInput = document.getElementById("dapan-sched-datetime");
            if (dateInput && !dateInput.value) {
                setScheduleToExamDeadline();
            }
        }
    }
}

function setScheduleToExamDeadline() {
    const dateInput = document.getElementById("dapan-sched-datetime");
    if (!dateInput) return;

    let deadlineStr = null;
    const currentQuizId = currentTuLuanModalData.quizId;

    if (typeof examData !== 'undefined' && examData && examData.examEndTimeStr) {
        deadlineStr = examData.examEndTimeStr;
    } else {
        const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
        for (const cat of allCats) {
            if (Array.isArray(cat.links)) {
                const match = cat.links.find(l => (l.id === currentQuizId || l.firebaseId === currentQuizId));
                if (match && match.examEndTimeStr) {
                    deadlineStr = match.examEndTimeStr;
                    break;
                }
            }
        }
    }

    if (deadlineStr) {
        const d = new Date(deadlineStr);
        if (!isNaN(d.getTime()) && typeof toLocalDatetimeString === 'function') {
            dateInput.value = toLocalDatetimeString(d);
            return;
        }
    }

    const def = new Date();
    def.setHours(21, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    dateInput.value = `${def.getFullYear()}-${pad(def.getMonth() + 1)}-${pad(def.getDate())}T${pad(def.getHours())}:${pad(def.getMinutes())}`;
}

async function saveDapAnSchedule(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    const curDapan = currentTuLuanModalData.dapAnCham;
    if (!curDapan) {
        alert("⚠️ Vui lòng upload file Đáp án chấm trước khi thiết lập lịch hẹn giờ!");
        closeDapAnSchedulePopover();
        return;
    }

    const radioAuto = document.getElementById("sched-mode-auto");
    const isAuto = radioAuto && radioAuto.checked;
    let scheduleTimeISO = null;

    if (isAuto) {
        const dateInput = document.getElementById("dapan-sched-datetime");
        const val = dateInput ? dateInput.value : "";
        if (!val) {
            alert("⚠️ Vui lòng chọn ngày và giờ mở đáp án!");
            return;
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) {
            alert("⚠️ Thời gian hẹn không hợp lệ!");
            return;
        }
        scheduleTimeISO = d.toISOString();
    }

    curDapan.scheduleTime = scheduleTimeISO;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'dapan_' + qId,
                value: curDapan
            });
        }

        renderDapAnChamUI();
        closeDapAnSchedulePopover();

        if (scheduleTimeISO) {
            const formatted = new Date(scheduleTimeISO).toLocaleString("vi-VN");
            alert(`⏰ ĐÃ THIẾT LẬP HẸN GIỜ MỞ ĐÁP ÁN!\n\n- Đề thi: ${currentTuLuanModalData.examTitle}\n- Tự động mở: ${formatted}`);
        } else {
            alert("🔓 Đã mở đáp án tự do cho học sinh xem ngay lập tức!");
        }
    } catch(err) {
        alert("❌ Lỗi khi lưu hẹn giờ: " + err.message);
    }
}

function isDapAnUnlocked(dapan) {
    if (!dapan || !dapan.fileUrl) return false;
    if (checkCurrentIsAdmin()) return true;
    if (!dapan.scheduleTime) return true;
    const targetMs = new Date(dapan.scheduleTime).getTime();
    if (isNaN(targetMs)) return true;
    return Date.now() >= targetMs;
}

function formatRemainingLockTime(targetMs) {
    const diffSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    if (diffSec <= 0) return "Đang mở...";
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);

    if (days > 0) return `${days} ngày ${hours} giờ`;
    if (hours > 0) return `${hours} giờ ${mins} phút`;
    return `${mins} phút`;
}

function renderDapAnChamUI() {
    const dapan = currentTuLuanModalData.dapAnCham;
    const isAdmin = checkCurrentIsAdmin();

    const schedBtn = document.getElementById("btn-schedule-dapan");
    const badgeWrap = document.getElementById("tuluan-dapan-badge-wrap");
    const badgeLink = document.getElementById("tuluan-dapan-badge-link");
    const badgeFilename = document.getElementById("tuluan-dapan-badge-filename");
    const badgeMoiMini = document.getElementById("badge-moi-mini-text");
    const delMiniBtn = document.getElementById("btn-del-dapan-mini");

    const fullStrip = document.getElementById("tuluan-dapan-full-strip");
    const stripFilename = document.getElementById("strip-dapan-filename");
    const stripLink = document.getElementById("strip-dapan-link");
    const stripTime = document.getElementById("strip-dapan-time");
    const stripOpenBtn = document.getElementById("strip-dapan-open-btn");
    const stripDelBtn = document.getElementById("strip-dapan-del-btn");
    const stripBadgeTag = document.getElementById("strip-dapan-badge-tag");

    if (schedBtn) {
        if (dapan && dapan.scheduleTime) {
            schedBtn.classList.add("has-schedule");
            schedBtn.title = `Đang hẹn giờ mở lúc: ${new Date(dapan.scheduleTime).toLocaleString("vi-VN")}`;
            schedBtn.innerHTML = `⏰ Đã hẹn`;
        } else {
            schedBtn.classList.remove("has-schedule");
            schedBtn.title = "Hẹn giờ tự động mở đáp án cho học sinh";
            schedBtn.innerHTML = `⏰ Hẹn giờ`;
        }
    }

    if (dapan && dapan.fileUrl) {
        const directUrl = dapan.fileUrl;
        const name = dapan.fileName || "Đáp án chấm";
        const uploadTime = dapan.uploadedAt || "";
        const isUnlocked = isDapAnUnlocked(dapan);

        if (badgeWrap) badgeWrap.style.display = "inline-flex";
        if (badgeFilename) badgeFilename.innerText = name;

        if (badgeLink) {
            if (isUnlocked) {
                badgeLink.href = directUrl;
                badgeLink.classList.remove("is-locked");
                badgeLink.title = `Mở Đáp án: ${name} (${uploadTime})`;
                if (badgeMoiMini) {
                    badgeMoiMini.innerText = "MỚI";
                    badgeMoiMini.style.backgroundColor = "#0284c7";
                }
            } else {
                badgeLink.href = "javascript:void(0)";
                badgeLink.classList.add("is-locked");
                const remain = formatRemainingLockTime(new Date(dapan.scheduleTime).getTime());
                badgeLink.title = `🔒 Đáp án đang khóa! Sẽ mở sau: ${remain}`;
                if (badgeMoiMini) {
                    badgeMoiMini.innerText = "KHÓA";
                    badgeMoiMini.style.backgroundColor = "#ea580c";
                }
            }
        }
        if (delMiniBtn) delMiniBtn.style.display = isAdmin ? "inline-flex" : "none";

        if (fullStrip) {
            fullStrip.style.display = "flex";
            if (!isUnlocked) {
                fullStrip.classList.add("strip-locked");
            } else {
                fullStrip.classList.remove("strip-locked");
            }
        }

        if (isUnlocked) {
            if (stripBadgeTag) {
                stripBadgeTag.className = "dapan-badge-new";
                stripBadgeTag.innerText = "MỚI";
            }
            if (stripFilename) stripFilename.innerText = name;
            if (stripLink) {
                stripLink.href = directUrl;
                stripLink.style.pointerEvents = "auto";
            }
            if (stripTime) stripTime.innerText = `📅 ${uploadTime}`;
            if (stripOpenBtn) {
                stripOpenBtn.href = directUrl;
                stripOpenBtn.className = "btn-open-dapan-strip";
                stripOpenBtn.innerText = isAdmin ? "🔗 Mở xem (Admin)" : "🔗 Mở xem";
            }
        } else {
            const schedStr = new Date(dapan.scheduleTime).toLocaleString("vi-VN");
            const remain = formatRemainingLockTime(new Date(dapan.scheduleTime).getTime());

            if (stripBadgeTag) {
                stripBadgeTag.className = "dapan-badge-new badge-lock";
                stripBadgeTag.innerText = "HẸN GIỜ";
            }
            if (stripFilename) {
                stripFilename.innerText = `${name} [Mở lúc: ${schedStr} - Còn ${remain}]`;
            }
            if (stripTime) stripTime.innerText = `⏳ Đang khóa với học sinh`;

            if (isAdmin) {
                if (stripLink) {
                    stripLink.href = directUrl;
                    stripLink.style.pointerEvents = "auto";
                }
                if (stripOpenBtn) {
                    stripOpenBtn.href = directUrl;
                    stripOpenBtn.className = "btn-open-dapan-strip";
                    stripOpenBtn.innerText = "🔗 Mở xem (Admin)";
                }
            } else {
                if (stripLink) {
                    stripLink.href = "javascript:void(0)";
                    stripLink.style.pointerEvents = "none";
                }
                if (stripOpenBtn) {
                    stripOpenBtn.href = "javascript:void(0)";
                    stripOpenBtn.className = "btn-open-dapan-strip disabled-strip";
                    stripOpenBtn.innerText = "🔒 Đang khóa";
                }
            }
        }

        if (stripDelBtn) stripDelBtn.style.display = isAdmin ? "inline-flex" : "none";
    } else {
        if (badgeWrap) badgeWrap.style.display = "none";
        if (fullStrip) fullStrip.style.display = "none";
    }

    updateTuLuanAdminUI();
}

function renderTuLuanStudentsTable() {
    const tbody = document.getElementById("tuluan-students-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const students = getAccountsForCategory(currentTuLuanModalData.classId);
    const searchVal = (document.getElementById("tuluan-search-student")?.value || "").trim().toLowerCase();
    const subMap = currentTuLuanModalData.submissionsMap || {};
    const isAdmin = checkCurrentIsAdmin();

    const loggedStudentSbd = (safeLocal.getItem("saved_student_sbd") || "").trim().toLowerCase();

    let totalSt = students.length;
    let submittedCount = 0;

    students.forEach(st => {
        const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
        if (subMap[cleanSbd] && subMap[cleanSbd].images && subMap[cleanSbd].images.length > 0) {
            submittedCount++;
        }
    });

    const elTotal = document.getElementById("count-all-st");
    const elSub = document.getElementById("count-sub-st");
    const elPen = document.getElementById("count-pen-st");
    if (elTotal) elTotal.innerText = totalSt;
    if (elSub) elSub.innerText = submittedCount;
    if (elPen) elPen.innerText = (totalSt - submittedCount);

    students.forEach(st => {
        const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
        const record = subMap[cleanSbd];
        const hasSubmitted = Boolean(record && record.images && record.images.length > 0);
        const isApproved = Boolean(record && record.isApproved === true);

        if (currentTuLuanModalData.statusFilter === "submitted" && !hasSubmitted) return;
        if (currentTuLuanModalData.statusFilter === "pending" && hasSubmitted) return;

        if (searchVal) {
            const nameNorm = (typeof normalizeName === 'function') ? normalizeName(st.name) : st.name.toLowerCase();
            const sbdNorm = String(st.sbd || "").toLowerCase();
            if (!nameNorm.includes(searchVal) && !sbdNorm.includes(searchVal)) return;
        }

        const tr = document.createElement("tr");

        let statusHtml = `<span class="tuluan-status-badge pending">⏳ Chưa nộp</span>`;
        let thumbnailsHtml = `<span style="font-size:11px; color:#94a3b8; font-style:italic;">Chưa có ảnh</span>`;

        let approveHtml = "";
        if (!hasSubmitted) {
            approveHtml = `<span style="color:#cbd5e1; font-weight:700;">---</span>`;
        } else if (isAdmin) {
            approveHtml = `
                <label class="approve-switch-wrapper" title="Bật/Tắt duyệt bài cho học sinh này" onclick="event.stopPropagation()">
                    <span class="mini-switch">
                        <input type="checkbox" ${isApproved ? "checked" : ""} onchange="handleToggleApproveStudent('${cleanSbd}', this.checked)">
                        <span class="slider-toggle" style="${isApproved ? 'background-color:#10b981;' : ''}"></span>
                    </span>
                    <b class="approve-text ${isApproved ? 'approved' : 'pending'}">${isApproved ? 'Đã duyệt' : 'Chưa duyệt'}</b>
                </label>
            `;
        } else {
            approveHtml = isApproved 
                ? `<span class="tuluan-approved-badge yes">✅ Đã duyệt</span>`
                : `<span class="tuluan-approved-badge no">⏳ Chưa duyệt</span>`;
        }

        const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;
        const isSessionAuthed = (safeSession.getItem(sessionAuthKey) === "true");
        const isOwner = Boolean(
            (loggedStudentSbd && loggedStudentSbd === String(st.sbd).trim().toLowerCase()) ||
            isSessionAuthed
        );

        if (hasSubmitted) {
            const imgCount = record.images.length;
            const lastTime = record.lastSubmit || "Vừa xong";
            statusHtml = `
                <div class="tuluan-status-badge done">✅ Đã nộp ${imgCount} ảnh</div>
                <div style="font-size: 10.5px; color: #64748b; font-weight: 700; margin-top: 1px;">🕒 ${lastTime}</div>
            `;

            const canViewDetailed = (isAdmin || isApproved || isOwner);
            const canDeleteThisStudentImage = (isAdmin || isOwner);

            thumbnailsHtml = `
                <div class="tuluan-thumb-row">
                    ${record.images.map((im, idx) => `
                        <div class="tuluan-img-thumbnail-item ${!canViewDetailed ? 'locked-anti-cheat' : ''}" 
                             onclick="onThumbnailItemClicked('${cleanSbd}', ${idx}, ${canViewDetailed}, event)" 
                             title="${canViewDetailed ? `Bấm để xem ảnh phóng to (Trang ${idx + 1}/${record.images.length})` : '🔒 Bài làm đang chờ Thầy phê duyệt!'}">
                            <img src="${im.directUrl || im.fileUrl}" alt="Trang ${idx + 1}">
                            <span class="tuluan-thumb-page">Trang ${idx + 1}</span>
                            ${!canViewDetailed ? `<div class="lock-overlay-icon">🔒</div>` : ''}
                            
                            ${canDeleteThisStudentImage ? `
                                <button type="button" class="btn-del-single-thumb" 
                                    onclick="deleteSingleStudentImage('${cleanSbd}', ${idx}, '${st.name}', '${st.pass}', event)" 
                                    title="Xóa bức ảnh này">✕</button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const currentCrossScore = (record && record.crossScore !== undefined && record.crossScore !== null) ? record.crossScore : '';
        const crossScoreBy = (record && record.crossScoreBy) ? record.crossScoreBy : '';
        const crossScoreTime = (record && record.crossScoreTime) ? record.crossScoreTime : '';

        let scoreTooltip = "Nhập điểm chấm chéo";
        if (currentCrossScore !== "") {
            scoreTooltip = `🎯 Điểm: ${currentCrossScore}đ\n👤 Người chấm: ${crossScoreBy || "Chưa rõ"}${crossScoreTime ? `\n🕒 Lúc: ${crossScoreTime}` : ""}`;
        }

        const crossScoreHtml = `
            <input type="text" class="tuluan-score-input" id="cross-score-${cleanSbd}"
                   value="${currentCrossScore}" placeholder="VD: 8.5"
                   onchange="saveStudentCrossScore('${cleanSbd}', '${st.stt}', '${st.sbd}', '${st.name}', this.value)"
                   title="${scoreTooltip}">
        `;

        const currentFeedback = (record && record.feedback) ? record.feedback : '';
        const hasFeedback = Boolean(currentFeedback && currentFeedback.trim() !== "");
        const feedbackHtml = `
            <div style="position: relative; display: inline-block;">
                <button type="button" class="btn-tuluan-comment ${hasFeedback ? 'active' : ''}" 
                        onclick="toggleStudentFeedbackPopover('${cleanSbd}', event)" 
                        title="${hasFeedback ? ('Nhận xét: ' + currentFeedback) : 'Bấm để viết nhận xét bài làm'}">
                    ${hasFeedback ? '💬 Đã có NX' : '💬 Nhận xét'}
                </button>

                <div class="student-feedback-popover" id="feedback-popover-${cleanSbd}" onclick="event.stopPropagation()">
                    <div class="pass-popover-header">
                        <span>💬 Nhận Xét: <b>${st.name}</b></span>
                        <button type="button" class="btn-close-pass-pop" onclick="closeStudentFeedbackPopover('${cleanSbd}', event)">✕</button>
                    </div>
                    <textarea id="feedback-textarea-${cleanSbd}" rows="3" class="feedback-textarea" placeholder="Nhập nhận xét chi tiết...">${currentFeedback}</textarea>
                    <div class="pass-popover-actions">
                        <button type="button" class="btn-pass-cancel" onclick="closeStudentFeedbackPopover('${cleanSbd}', event)">Hủy</button>
                        <button type="button" class="btn-pass-save" style="background: linear-gradient(135deg, #d97706, #b45309);" onclick="saveStudentFeedback('${cleanSbd}', '${st.stt}', '${st.sbd}', '${st.name}', event)">💾 Lưu NX</button>
                    </div>
                </div>
            </div>
        `;

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 800; color: #475569;">${st.stt}</td>
            <td style="font-weight: 800; color: #0f172a;">${st.name}</td>
            <td style="text-align: center; font-weight: 800; color: #0284c7; font-family: monospace;">${st.sbd}</td>
            <td>${statusHtml}</td>
            <td style="text-align: center;">${approveHtml}</td>
            <td>${thumbnailsHtml}</td>
            <td style="text-align: center;">${crossScoreHtml}</td>
            <td style="text-align: center;">${feedbackHtml}</td>
            <td style="text-align: center; position: relative;">
                <div class="tuluan-action-btn-group">
                    <input type="file" id="tuluan-input-${cleanSbd}" accept="image/*" multiple style="display:none;" onchange="handleStudentEssayUploadPC('${st.stt}', '${st.sbd}', '${st.name}', this)">
                    <button type="button" class="btn-tuluan-upload-row" onclick="triggerStudentUpload('${st.stt}', '${st.sbd}', '${st.name}', '${st.pass}')" id="btn-up-${cleanSbd}" title="Tải ảnh bài làm">
                        📷 Tải ảnh
                    </button>
                    <button type="button" class="btn-tuluan-change-pass" onclick="toggleStudentPassPopover('${cleanSbd}', event)" title="Đổi mật khẩu nộp bài (4 số)">
                        🔑 Đổi MK
                    </button>
                    ${isAdmin ? `
                        <button type="button" class="btn-tuluan-reset-pass" onclick="resetStudentPasswordToDefault('${cleanSbd}', '${st.sbd}', '${st.name}', event)" title="[Admin] Reset mật khẩu (${st.sbd})">
                            ↺ Reset
                        </button>
                    ` : ''}
                </div>

                <div class="student-pass-popover" id="pass-popover-${cleanSbd}" onclick="event.stopPropagation()">
                    <div class="pass-popover-header">
                        <span>🔑 Đổi Mật Khẩu: <b>${st.name}</b></span>
                        <button type="button" class="btn-close-pass-pop" onclick="closeStudentPassPopover('${cleanSbd}', event)">✕</button>
                    </div>
                    <div class="pass-popover-hint">
                        💡 Mật khẩu gồm đúng <b>4 chữ số</b>.<br>
                        Mặc định ban đầu là Số báo danh (<b>${st.sbd}</b>).
                    </div>
                    <div class="pass-input-row">
                        <label>Dòng 1: Mật khẩu cũ (hoặc SBD):</label>
                        <input type="password" id="old-pass-${cleanSbd}" placeholder="Nhập mật khẩu cũ..." autocomplete="off">
                    </div>
                    <div class="pass-input-row">
                        <label>Dòng 2: Mật khẩu mới (4 số):</label>
                        <input type="password" id="new-pass-${cleanSbd}" placeholder="4 số, VD: 1234..." maxlength="4" pattern="[0-9]{4}" inputmode="numeric" autocomplete="new-password">
                    </div>
                    <div class="pass-popover-actions">
                        <button type="button" class="btn-pass-cancel" onclick="closeStudentPassPopover('${cleanSbd}', event)">Hủy</button>
                        <button type="button" class="btn-pass-save" onclick="saveStudentPasswordChange('${cleanSbd}', '${st.sbd}', '${st.name}', '${st.pass}', event)">💾 Lưu MK</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateTuLuanAdminUI();
}

// MỞ LIGHTBOX XEM ẢNH BÀI LÀM ĐA TRANG
function onThumbnailItemClicked(cleanSbd, imgIndex, canView, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!canView) {
        alert("🔒 BÀI LÀM ĐANG CHỜ THẦY PHÊ DUYỆT!\n\nSau khi Thầy phê duyệt, em sẽ được xem chi tiết để học hỏi nhé!");
        return;
    }

    const record = currentTuLuanModalData.submissionsMap[cleanSbd];
    if (!record || !Array.isArray(record.images) || record.images.length === 0) return;

    currentLightboxGallery.studentName = record.studentName || "Học sinh";
    currentLightboxGallery.images = record.images;
    currentLightboxGallery.currentIndex = Math.max(0, Math.min(imgIndex, record.images.length - 1));

    updateLightboxView();

    const lb = document.getElementById("tuluan-lightbox");
    if (lb) lb.style.display = "flex";
}

// CẬP NHẬT ẢNH & SỐ TRANG TRONG LIGHTBOX
function updateLightboxView() {
    const gallery = currentLightboxGallery;
    const total = gallery.images.length;
    const curIdx = gallery.currentIndex;
    const curImg = gallery.images[curIdx];
    if (!curImg) return;

    const fullImg = document.getElementById("lightbox-full-img");
    const titleEl = document.getElementById("lightbox-student-title");
    const pageBadge = document.getElementById("lightbox-page-indicator");
    const driveLink = document.getElementById("lightbox-drive-link");
    const btnPrev = document.getElementById("btn-lightbox-prev");
    const btnNext = document.getElementById("btn-lightbox-next");
    const dotsWrap = document.getElementById("lightbox-dots-container");

    const imgSrc = curImg.directUrl || curImg.fileUrl;
    if (fullImg) {
        fullImg.style.opacity = "0.4";
        fullImg.src = imgSrc;
        fullImg.onload = function() { fullImg.style.opacity = "1"; };
    }

    if (titleEl) titleEl.innerText = `${gallery.studentName} - Trang ${curIdx + 1}`;
    if (pageBadge) pageBadge.innerText = `Tr ${curIdx + 1}/${total}`;
    if (driveLink) driveLink.href = curImg.fileUrl || "#";

    // Cập nhật trạng thái hiển thị của 2 nút tam giác ◀ và ▶
    if (btnPrev) {
        btnPrev.classList.toggle("disabled", curIdx <= 0);
    }
    if (btnNext) {
        btnNext.classList.toggle("disabled", curIdx >= total - 1);
    }

    // Vẽ các chấm điều hướng dưới đáy
    if (dotsWrap) {
        dotsWrap.innerHTML = gallery.images.map((_, i) => `
            <div class="lightbox-dot-item ${i === curIdx ? 'active' : ''}" onclick="jumpToLightboxPage(${i}, event)"></div>
        `).join('');
    }
}

// BẤM NÚT TAM GIÁC HOẶC VUỐT ĐỂ CHUYỂN TRANG
function navigateLightbox(step, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const gallery = currentLightboxGallery;
    const newIdx = gallery.currentIndex + step;

    if (newIdx >= 0 && newIdx < gallery.images.length) {
        gallery.currentIndex = newIdx;
        updateLightboxView();
    }
}

function jumpToLightboxPage(targetIndex, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (targetIndex >= 0 && targetIndex < currentLightboxGallery.images.length) {
        currentLightboxGallery.currentIndex = targetIndex;
        updateLightboxView();
    }
}

function openTuLuanLightbox(imgSrc, driveUrl, title, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentLightboxGallery.studentName = title || "Ảnh bài làm";
    currentLightboxGallery.images = [{ directUrl: imgSrc, fileUrl: driveUrl }];
    currentLightboxGallery.currentIndex = 0;

    updateLightboxView();
    const lb = document.getElementById("tuluan-lightbox");
    if (lb) lb.style.display = "flex";
}

function closeTuLuanLightbox(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const lb = document.getElementById("tuluan-lightbox");
    if (lb) lb.style.display = "none";
}

// LƯU ĐIỂM CHẤM CHÉO NHAU
async function saveStudentCrossScore(cleanSbd, stt, sbd, studentName, scoreVal) {
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    const trimmedScore = String(scoreVal || "").trim();
    const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);

    let graderDisplay = "";
    let scoreTimeStr = "";
    if (trimmedScore !== "") {
        const graderInfo = getCurrentGraderInfo();
        graderDisplay = graderInfo.sbd && graderInfo.sbd !== "ADMIN" 
            ? `${graderInfo.name} (${graderInfo.sbd})` 
            : graderInfo.name;
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        scoreTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    }

    if (!currentTuLuanModalData.submissionsMap[cleanSbd]) {
        currentTuLuanModalData.submissionsMap[cleanSbd] = {
            stt: stt,
            sbd: sbd,
            studentName: studentName,
            className: driveClassName,
            count: 0,
            images: [],
            crossScore: trimmedScore,
            crossScoreBy: graderDisplay,
            crossScoreTime: scoreTimeStr
        };
    } else {
        currentTuLuanModalData.submissionsMap[cleanSbd].crossScore = trimmedScore;
        currentTuLuanModalData.submissionsMap[cleanSbd].crossScoreBy = graderDisplay;
        currentTuLuanModalData.submissionsMap[cleanSbd].crossScoreTime = scoreTimeStr;
    }

    try {
        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').upsert({
                quiz_id: qId,
                sbd: cleanSbd,
                stt: String(stt || "00"),
                student_name: studentName,
                class_name: driveClassName,
                exam_title: currentTuLuanModalData.examTitle || "Tự luận",
                cross_score: trimmedScore,
                cross_score_by: graderDisplay,
                cross_score_time: scoreTimeStr
            }, { onConflict: 'quiz_id,sbd' });
        }

        const scoreInput = document.getElementById(`cross-score-${cleanSbd}`);
        if (scoreInput) {
            scoreInput.style.borderColor = "#10b981";
            if (trimmedScore !== "") {
                scoreInput.title = `🎯 Điểm: ${trimmedScore}đ\n👤 Người chấm: ${graderDisplay}\n🕒 Lúc: ${scoreTimeStr}`;
            } else {
                scoreInput.title = "Nhập điểm chấm chéo";
            }
            setTimeout(() => { scoreInput.style.borderColor = "#cbd5e1"; }, 1500);
        }
    } catch(err) {
        console.error("Lỗi lưu điểm chấm chéo Supabase:", err);
    }
}

function toggleStudentFeedbackPopover(cleanSbd, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById(`feedback-popover-${cleanSbd}`);
    if (!pop) return;
    const isShown = pop.classList.contains("show");

    document.querySelectorAll(".student-pass-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".student-feedback-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".dapan-schedule-popover.show").forEach(p => p.classList.remove("show"));

    if (!isShown) {
        pop.classList.add("show");
        const textarea = document.getElementById(`feedback-textarea-${cleanSbd}`);
        if (textarea) textarea.focus();
    }
}

function closeStudentFeedbackPopover(cleanSbd, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById(`feedback-popover-${cleanSbd}`);
    if (pop) pop.classList.remove("show");
}

async function saveStudentFeedback(cleanSbd, stt, sbd, studentName, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const textarea = document.getElementById(`feedback-textarea-${cleanSbd}`);
    if (!textarea) return;

    const feedbackVal = textarea.value.trim();
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);

    if (!currentTuLuanModalData.submissionsMap[cleanSbd]) {
        currentTuLuanModalData.submissionsMap[cleanSbd] = {
            stt: stt,
            sbd: sbd,
            studentName: studentName,
            className: driveClassName,
            count: 0,
            images: [],
            feedback: feedbackVal,
            feedbackTime: new Date().toLocaleString("vi-VN")
        };
    } else {
        currentTuLuanModalData.submissionsMap[cleanSbd].feedback = feedbackVal;
        currentTuLuanModalData.submissionsMap[cleanSbd].feedbackTime = new Date().toLocaleString("vi-VN");
    }

    try {
        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').upsert({
                quiz_id: qId,
                sbd: cleanSbd,
                stt: String(stt || "00"),
                student_name: studentName,
                class_name: driveClassName,
                exam_title: currentTuLuanModalData.examTitle || "Tự luận",
                feedback: feedbackVal,
                feedback_time: new Date().toLocaleString("vi-VN")
            }, { onConflict: 'quiz_id,sbd' });
        }

        closeStudentFeedbackPopover(cleanSbd);
        renderTuLuanStudentsTable();
    } catch(err) {
        alert("❌ Lỗi khi lưu nhận xét: " + err.message);
    }
}

function exportTuLuanToExcel(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const students = getAccountsForCategory(currentTuLuanModalData.classId);
    if (!students || students.length === 0) {
        alert("⚠️ Không có dữ liệu học sinh để xuất Excel!");
        return;
    }

    const examTitle = currentTuLuanModalData.examTitle || "BAI_TAP_TU_LUAN";
    const driveClassName = getCleanDriveClassName(currentTuLuanModalData.classId);
    const subMap = currentTuLuanModalData.submissionsMap || {};

    let rowsHtml = "";
    students.forEach((st) => {
        const cleanSbd = String(st.sbd || "").trim().replace(/[^a-zA-Z0-9]/g, '_');
        const record = subMap[cleanSbd];

        const hasSub = Boolean(record && record.images && record.images.length > 0);
        const statusText = hasSub ? `Đã nộp (${record.images.length} ảnh) lúc ${record.lastSubmit || ''}` : "Chưa nộp";
        const isApprovedText = (record && record.isApproved === true) ? "Đã duyệt" : "Chưa duyệt";
        const scoreVal = (record && record.crossScore !== undefined) ? record.crossScore : "";
        const scoreBy = (record && record.crossScoreBy) ? record.crossScoreBy : "";
        const scoreTime = (record && record.crossScoreTime) ? record.crossScoreTime : "";
        const feedbackVal = (record && record.feedback) ? record.feedback : "";

        let imagesHtml = "Chưa có ảnh";
        if (hasSub && Array.isArray(record.images)) {
            imagesHtml = record.images.map((im, idx) => {
                const imgUrl = im.directUrl || im.fileUrl || "";
                const driveUrl = im.fileUrl || imgUrl;
                return `
                    <div style="display: inline-block; margin: 4px 6px; text-align: center; vertical-align: top;">
                        <img src="${imgUrl}" width="95" height="95" style="border: 1px solid #94a3b8; border-radius: 4px; object-fit: cover; display: block; margin-bottom: 3px;" alt="Trang ${idx + 1}"><br>
                        <a href="${driveUrl}" target="_blank" style="font-size: 10px; color: #0284c7; text-decoration: underline; font-weight: bold;">Trang ${idx + 1} [Drive]</a>
                    </div>
                `;
            }).join('');
        }

        rowsHtml += `
            <tr>
                <td style="text-align: center; font-weight: bold;">${st.stt}</td>
                <td style="font-weight: bold;">${st.name}</td>
                <td style="text-align: center; font-family: monospace; font-weight: bold;">${st.sbd}</td>
                <td>${statusText}</td>
                <td style="text-align: center;">${isApprovedText}</td>
                <td style="text-align: center; font-weight: bold; color: #0284c7; font-size: 13pt;">
                    ${scoreVal}
                    ${scoreBy ? `<br><span style="font-size:9pt; font-weight:normal; color:#64748b;">(Chấm bởi: ${scoreBy}${scoreTime ? ` - ${scoreTime}` : ''})</span>` : ''}
                </td>
                <td style="white-space: pre-wrap; word-break: break-word;">${feedbackVal}</td>
                <td style="min-width: 250px;">${imagesHtml}</td>
            </tr>
        `;
    });

    const excelCompleteHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>Diem_Tu_Luan_${driveClassName}</title>
        <style>
            body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 11pt; color: #0f172a; }
            h2, h3 { margin: 4px 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; }
            th { background-color: #0284c7; color: #ffffff; font-weight: bold; padding: 8px 10px; border: 1px solid #94a3b8; text-align: center; font-size: 11pt; }
            td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: middle; }
            tr:nth-child(even) td { background-color: #f8fafc; }
        </style>
    </head>
    <body>
        <h2>BẢNG ĐIỂM & NHẬN XÉT BÀI TẬP TỰ LUẬN</h2>
        <h3>Đề thi: ${examTitle}</h3>
        <p><b>Lớp:</b> ${driveClassName} &nbsp;|&nbsp; <b>Thời gian xuất:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}</p>
        <table>
            <thead>
                <tr>
                    <th style="width: 45px;">STT</th>
                    <th style="width: 170px;">Họ và tên</th>
                    <th style="width: 80px;">SBD</th>
                    <th style="width: 160px;">Trạng thái / Ngày nộp</th>
                    <th style="width: 100px;">Phê duyệt</th>
                    <th style="width: 140px;">Điểm chấm chéo (Người chấm)</th>
                    <th style="width: 220px;">Nhận xét bài làm</th>
                    <th style="width: 380px;">Ảnh bài làm đã nộp</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const blob = new Blob(['\ufeff', excelCompleteHtml], {
        type: 'application/vnd.ms-excel;charset=utf-8'
    });

    const safeExam = examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const fileName = `Diem_Tu_Luan_${driveClassName}_${safeExam}_${Date.now()}.xls`;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function toggleStudentPassPopover(cleanSbd, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById(`pass-popover-${cleanSbd}`);
    if (!pop) return;
    const isShown = pop.classList.contains("show");

    document.querySelectorAll(".student-pass-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".student-feedback-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".dapan-schedule-popover.show").forEach(p => p.classList.remove("show"));

    if (!isShown) {
        pop.classList.add("show");
        const oldIn = document.getElementById(`old-pass-${cleanSbd}`);
        const newIn = document.getElementById(`new-pass-${cleanSbd}`);
        if (oldIn) { oldIn.value = ""; oldIn.focus(); }
        if (newIn) newIn.value = "";
    }
}

function closeStudentPassPopover(cleanSbd, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById(`pass-popover-${cleanSbd}`);
    if (pop) pop.classList.remove("show");
}

async function saveStudentPasswordChange(cleanSbd, defaultSbd, studentName, defaultPass, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const oldPassInput = document.getElementById(`old-pass-${cleanSbd}`);
    const newPassInput = document.getElementById(`new-pass-${cleanSbd}`);
    if (!oldPassInput || !newPassInput) return;

    const oldVal = oldPassInput.value.trim();
    const newVal = newPassInput.value.trim();
    const effectiveOldPass = getEffectiveStudentPassword(cleanSbd, defaultSbd, defaultPass);

    if (!oldVal) {
        alert("⚠️ Vui lòng nhập Mật khẩu cũ (hoặc SBD) của em!");
        oldPassInput.focus();
        return;
    }

    const isOldOk = (oldVal.toLowerCase() === effectiveOldPass.toLowerCase()) ||
                    (oldVal.toLowerCase() === String(defaultSbd).trim().toLowerCase()) ||
                    (defaultPass && oldVal.toLowerCase() === String(defaultPass).trim().toLowerCase());

    if (!isOldOk) {
        alert("❌ Mật khẩu cũ không chính xác!");
        oldPassInput.focus();
        return;
    }

    if (!/^\d{4}$/.test(newVal)) {
        alert("⚠️ Mật khẩu mới phải gồm đúng 4 chữ số!");
        newPassInput.focus();
        return;
    }

    if (newVal === effectiveOldPass) {
        alert("⚠️ Mật khẩu mới không được trùng mật khẩu cũ!");
        newPassInput.focus();
        return;
    }

    try {
        currentTuLuanModalData.customPasswords = currentTuLuanModalData.customPasswords || {};
        currentTuLuanModalData.customPasswords[cleanSbd] = newVal;

        const client = getDbClient();
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'student_custom_passwords',
                value: currentTuLuanModalData.customPasswords
            });
        }

        const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;
        safeSession.setItem(sessionAuthKey, "true");

        closeStudentPassPopover(cleanSbd);
        alert(`🎉 ĐỔI MẬT KHẨU THÀNH CÔNG!\nMật khẩu mới của ${studentName} là: ${newVal}`);
        renderTuLuanStudentsTable();
    } catch(err) {
        alert("❌ Lỗi khi lưu mật khẩu: " + err.message);
    }
}

async function resetStudentPasswordToDefault(cleanSbd, defaultSbd, studentName, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const isAdmin = checkCurrentIsAdmin();
    if (!isAdmin) {
        alert("⛔ Chỉ Giáo viên quản trị mới có quyền Reset mật khẩu!");
        return;
    }

    if (!confirm(`⚠️ XÁC NHẬN RESET MẬT KHẨU (ADMIN):\n\nKhôi phục mật khẩu của [${studentName}] về mặc định (${defaultSbd})?`)) {
        return;
    }

    try {
        if (currentTuLuanModalData.customPasswords) {
            delete currentTuLuanModalData.customPasswords[cleanSbd];
        }

        const client = getDbClient();
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'student_custom_passwords',
                value: currentTuLuanModalData.customPasswords || {}
            });
        }

        const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;
        safeSession.removeItem(sessionAuthKey);

        alert(`✅ Đã reset mật khẩu của em [${studentName}] về: ${defaultSbd}.`);
        renderTuLuanStudentsTable();
    } catch(err) {
        alert("❌ Lỗi reset mật khẩu: " + err.message);
    }
}

async function deleteSingleStudentImage(cleanSbd, imgIndex, studentName, defaultPass, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const isAdmin = checkCurrentIsAdmin();
    const loggedStudentSbd = (safeLocal.getItem("saved_student_sbd") || "").trim().toLowerCase();
    const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;
    const isSessionAuthed = (safeSession.getItem(sessionAuthKey) === "true");
    const isOwner = Boolean(
        (loggedStudentSbd && loggedStudentSbd === cleanSbd.toLowerCase()) ||
        isSessionAuthed
    );

    if (!isAdmin && !isOwner) {
        const effectivePass = getEffectiveStudentPassword(cleanSbd, cleanSbd, defaultPass);
        const inputPass = prompt(`🔐 XÁC THỰC QUYỀN XÓA:\n\nNhập Mật khẩu hoặc SBD của em để xác nhận xóa:`);
        if (!inputPass) return;
        const trimmed = inputPass.trim().toLowerCase();
        const isPassOk = (trimmed === effectivePass.toLowerCase()) || (trimmed === cleanSbd.toLowerCase());
        if (!isPassOk) {
            alert("⛔ Sai mật khẩu! Không có quyền xóa ảnh.");
            return;
        }
        safeSession.setItem(sessionAuthKey, "true");
    }

    const record = currentTuLuanModalData.submissionsMap[cleanSbd];
    if (!record || !Array.isArray(record.images) || !record.images[imgIndex]) {
        alert("⚠️ Không tìm thấy ảnh này để xóa!");
        return;
    }

    if (!confirm(`⚠️ XÁC NHẬN XÓA ẢNH:\n\nXóa ảnh Trang ${imgIndex + 1} của học sinh [${studentName}]?`)) {
        return;
    }

    const qId = currentTuLuanModalData.quizId;
    const removedImg = record.images[imgIndex];
    record.images.splice(imgIndex, 1);
    record.count = record.images.length;

    try {
        const client = getDbClient();
        if (client) {
            if (record.images.length === 0) {
                delete currentTuLuanModalData.submissionsMap[cleanSbd];
                await client.from('tu_luan_submissions').delete().eq('quiz_id', qId).eq('sbd', cleanSbd);
            } else {
                currentTuLuanModalData.submissionsMap[cleanSbd] = record;
                await client.from('tu_luan_submissions').update({
                    images: record.images,
                    count: record.images.length
                }).eq('quiz_id', qId).eq('sbd', cleanSbd);
            }
        }

        if (removedImg && removedImg.fileId) {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
                ? GOOGLE_DRIVE_TULUAN_GAS_URL 
                : GOOGLE_DRIVE_UPLOAD_GAS_URL;
            if (gasUrl && !gasUrl.includes("DÁN_URL")) {
                fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "deleteFile", fileId: removedImg.fileId })
                }).catch(() => null);
            }
        }

        renderTuLuanStudentsTable();
        alert("🗑️ Đã xóa ảnh thành công!");
    } catch(err) {
        alert("❌ Lỗi khi xóa ảnh: " + err.message);
    }
}

async function handleToggleApproveStudent(cleanSbd, isChecked) {
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').update({
                is_approved: isChecked
            }).eq('quiz_id', qId).eq('sbd', cleanSbd);
        }

        if (currentTuLuanModalData.submissionsMap[cleanSbd]) {
            currentTuLuanModalData.submissionsMap[cleanSbd].isApproved = isChecked;
        }
        renderTuLuanStudentsTable();
    } catch(err) {
        alert("❌ Lỗi cập nhật phê duyệt: " + err.message);
    }
}

async function toggleApproveAllSubmissions(isApproved) {
    const qId = currentTuLuanModalData.quizId;
    const subMap = currentTuLuanModalData.submissionsMap || {};
    const keys = Object.keys(subMap);
    if (keys.length === 0) {
        alert("ℹ️ Chưa có bài nộp nào để phê duyệt!");
        return;
    }

    if (!confirm(`Bạn có chắc muốn ${isApproved ? 'PHÊ DUYỆT TẤT CẢ' : 'HỦY DUYỆT'} bài làm của đề này không?`)) return;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').update({
                is_approved: isApproved
            }).eq('quiz_id', qId);
        }

        keys.forEach(k => { if (subMap[k]) subMap[k].isApproved = isApproved; });
        renderTuLuanStudentsTable();
        alert(`✅ Đã cập nhật trạng thái phê duyệt cho ${keys.length} học sinh!`);
    } catch(e) {
        alert("❌ Lỗi duyệt bài: " + e.message);
    }
}

function filterTuLuanStudentTable() { renderTuLuanStudentsTable(); }
function filterTuLuanStatus(filterType) {
    currentTuLuanModalData.statusFilter = filterType;
    document.querySelectorAll(".tuluan-tab-pill").forEach(p => p.classList.remove("active"));
    const activeBtn = document.getElementById(`tab-filter-${filterType}`);
    if (activeBtn) activeBtn.classList.add("active");
    renderTuLuanStudentsTable();
}

function triggerStudentUpload(stt, sbd, studentName, defaultPass) {
    const cleanSbd = String(sbd).replace(/[^a-zA-Z0-9]/g, '_');
    const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;

    if (checkCurrentIsAdmin() || safeSession.getItem(sessionAuthKey) === "true") {
        document.getElementById(`tuluan-input-${cleanSbd}`).click();
        return;
    }

    const effectivePass = getEffectiveStudentPassword(cleanSbd, sbd, defaultPass);
    const inputPass = prompt(`🔐 XÁC NHẬN NỘP BÀI:\n\nEm đang nộp bài cho: [${stt}] ${studentName} (SBD: ${sbd}).\nNhập Mật khẩu (mặc định: SBD):`);
    if (inputPass === null) return;

    const trimmedInput = inputPass.trim().toLowerCase();
    const isPassOk = (trimmedInput === effectivePass.toLowerCase()) || 
                     (trimmedInput === String(sbd).trim().toLowerCase()) || 
                     (defaultPass && trimmedInput === String(defaultPass).trim().toLowerCase());

    if (isPassOk) {
        safeSession.setItem(sessionAuthKey, "true");
        document.getElementById(`tuluan-input-${cleanSbd}`).click();
    } else {
        alert("❌ Sai mật khẩu!");
    }
}

async function handleStudentEssayUploadPC(stt, sbd, studentName, fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;

    const files = Array.from(fileInput.files);
    const cleanSbd = String(sbd).replace(/[^a-zA-Z0-9]/g, '_');
    const upBtn = document.getElementById(`btn-up-${cleanSbd}`);

    if (upBtn) {
        upBtn.disabled = true;
        upBtn.innerText = "⏳ Đang gửi...";
    }

    const classSelector = document.getElementById("tuluan-class-selector");
    const classId = (classSelector && classSelector.value) ? classSelector.value : (currentTuLuanModalData.classId || "lop-11a");
    currentTuLuanModalData.classId = classId;

    const driveClassName = getCleanDriveClassName(classId);
    const quizId = currentTuLuanModalData.quizId || "quiz";
    const examTitle = currentTuLuanModalData.examTitle || "BAI_TAP_TU_LUAN";
    const unifiedFolder = getUnifiedExamFolderKey(examTitle, "", quizId);
    const studentFolderName = getStudentFolderKey(stt, sbd, studentName, classId);

    const currentSub = currentTuLuanModalData.submissionsMap[cleanSbd] || {};
    const existingImages = Array.isArray(currentSub.images) ? [...currentSub.images] : [];

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pageIdx = existingImages.length + i + 1;
        try {
            if (upBtn) upBtn.innerText = `⏳ Nén ${i + 1}/${files.length}...`;
            const compressed = await compressImageForTuLuanAsync(file, 2048, 0.82);

            if (upBtn) upBtn.innerText = `🚀 Lưu trang ${pageIdx}...`;

            const payload = {
                rootFolder: "BAI_TAP_TU_LUAN",
                className: driveClassName,
                class: driveClassName,
                lop: driveClassName,
                examTitle: unifiedFolder,
                folderKey: unifiedFolder,
                studentFolder: studentFolderName,
                stt: stt,
                sbd: sbd,
                studentName: studentName,
                filename: `Trang_${pageIdx}_${Date.now()}.jpg`,
                mimeType: "image/jpeg",
                base64: compressed.base64
            };

            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL)
                ? GOOGLE_DRIVE_TULUAN_GAS_URL
                : GOOGLE_DRIVE_UPLOAD_GAS_URL;

            const result = await sendToGoogleDriveWithRetry(gasUrl, payload, 2, 75000);
            if (result && result.status === "success" && result.fileId) {
                const directImgUrl = result.directUrl || (typeof toDirectGoogleDriveImageUrl === 'function' ? toDirectGoogleDriveImageUrl(result.fileUrl) : result.fileUrl);
                existingImages.push({
                    fileId: result.fileId,
                    fileUrl: result.fileUrl,
                    directUrl: directImgUrl,
                    fileName: payload.filename,
                    uploadedAt: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN")
                });
                successCount++;
            }
        } catch(err) {
            console.error(`Lỗi upload ảnh trang ${i + 1}:`, err);
            alert(`⚠️ Lỗi tải ảnh trang ${i + 1}: ${err.message}`);
        }
    }

    if (successCount > 0) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const submitDateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

        const subPayload = {
            quiz_id: quizId,
            sbd: cleanSbd,
            stt: String(stt || "00"),
            student_name: studentName,
            class_name: driveClassName,
            exam_title: examTitle,
            last_submit: submitDateStr,
            last_submit_time: Date.now(),
            count: existingImages.length,
            images: existingImages,
            cross_score: currentSub.crossScore || "",
            cross_score_by: currentSub.crossScoreBy || "",
            cross_score_time: currentSub.crossScoreTime || "",
            feedback: currentSub.feedback || "",
            feedback_time: currentSub.feedbackTime || "",
            is_approved: !!currentSub.isApproved
        };

        const client = getDbClient();
        if (client) {
            await client.from('tu_luan_submissions').upsert(subPayload, { onConflict: 'quiz_id,sbd' });
        }

        currentTuLuanModalData.submissionsMap[cleanSbd] = {
            stt: stt,
            sbd: sbd,
            studentName: studentName,
            className: driveClassName,
            examTitle: examTitle,
            lastSubmit: submitDateStr,
            lastSubmitTime: Date.now(),
            count: existingImages.length,
            images: existingImages,
            crossScore: currentSub.crossScore || "",
            crossScoreBy: currentSub.crossScoreBy || "",
            crossScoreTime: currentSub.crossScoreTime || "",
            feedback: currentSub.feedback || "",
            feedbackTime: currentSub.feedbackTime || "",
            isApproved: !!currentSub.isApproved
        };

        renderTuLuanStudentsTable();
        alert(`🎉 THÀNH CÔNG!\nĐã lưu ${successCount} ảnh bài làm lên Drive.`);
    }

    if (upBtn) {
        upBtn.disabled = false;
        upBtn.innerText = "📷 Tải ảnh";
    }
    fileInput.value = "";
}

async function triggerExamRoomDriveUpload(qId) {
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
    const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "";
    const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "";
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "";

    if (!sId || !sName) {
        alert("⚠️ Không xác định được thông tin học sinh đang làm bài!");
        return;
    }

    let input = document.getElementById(`drive-exam-input-${qId}`);
    if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = `drive-exam-input-${qId}`;
        input.accept = "image/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);

        input.onchange = async function() {
            if (!this.files || this.files.length === 0) return;
            const files = Array.from(this.files);

            const statusEl = document.getElementById(`drive-upload-status-${qId}`);
            if (statusEl) {
                statusEl.style.display = "inline-flex";
                statusEl.innerText = "⏳ Đang nén & lưu Drive...";
            }

            const urlParams = new URLSearchParams(window.location.search);
            const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "quiz";
            const examTitle = (typeof examData !== 'undefined' && examData && examData.title) 
                ? examData.title 
                : (typeof EXAM_NAME !== 'undefined' && EXAM_NAME !== 'Bài thi' ? EXAM_NAME : "BAI_TAP_TU_LUAN");
            
            const driveClassName = getCleanDriveClassName(sClass || currentCat);
            const unifiedFolder = getUnifiedExamFolderKey(examTitle, (typeof getMaDe === 'function' ? getMaDe() : ""), quizId);
            const studentFolderName = getStudentFolderKey("00", sId, sName, currentCat || sClass);
            const cleanSbd = sId.replace(/[^a-zA-Z0-9]/g, '_');

            let existingImages = [];
            const client = getDbClient();
            if (client) {
                try {
                    const { data } = await client.from('tu_luan_submissions').select('images').eq('quiz_id', quizId).eq('sbd', cleanSbd).single();
                    if (data && Array.isArray(data.images)) existingImages = data.images;
                } catch(e) {}
            }

            let successCount = 0;
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const pageIdx = existingImages.length + i + 1;
                try {
                    const comp = await compressImageForTuLuanAsync(f, 2048, 0.82);
                    const payload = {
                        rootFolder: "BAI_TAP_TU_LUAN",
                        className: driveClassName,
                        class: driveClassName,
                        lop: driveClassName,
                        examTitle: unifiedFolder,
                        folderKey: unifiedFolder,
                        studentFolder: studentFolderName,
                        stt: studentFolderName.split('_')[0] || "00",
                        sbd: sId,
                        studentName: sName,
                        filename: `Cau_${qId}_Trang_${pageIdx}_${Date.now()}.jpg`,
                        mimeType: "image/jpeg",
                        base64: comp.base64
                    };

                    const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL)
                        ? GOOGLE_DRIVE_TULUAN_GAS_URL
                        : GOOGLE_DRIVE_UPLOAD_GAS_URL;

                    const resJson = await sendToGoogleDriveWithRetry(gasUrl, payload, 2, 75000);
                    if (resJson && resJson.status === "success") {
                        existingImages.push({
                            fileId: resJson.fileId,
                            fileUrl: resJson.fileUrl,
                            directUrl: resJson.directUrl || resJson.fileUrl,
                            fileName: payload.filename,
                            uploadedAt: new Date().toLocaleTimeString("vi-VN")
                        });
                        successCount++;
                    }
                } catch(err) {
                    console.error("Lỗi upload ảnh tự luận trong phòng thi:", err);
                }
            }

            if (successCount > 0) {
                const submitRecord = {
                    quiz_id: quizId,
                    sbd: cleanSbd,
                    stt: studentFolderName.split('_')[0] || "00",
                    student_name: sName,
                    class_name: driveClassName,
                    exam_title: examTitle,
                    last_submit: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
                    last_submit_time: Date.now(),
                    count: existingImages.length,
                    images: existingImages,
                    is_approved: false
                };

                if (client) {
                    await client.from('tu_luan_submissions').upsert(submitRecord, { onConflict: 'quiz_id,sbd' });
                }

                if (statusEl) {
                    statusEl.className = "drive-up-status success";
                    statusEl.innerText = `✅ Đã lưu ${existingImages.length} ảnh!`;
                }
                alert(`✅ ĐÃ LƯU BÀI TỰ LUẬN THÀNH CÔNG!`);
            } else {
                if (statusEl) {
                    statusEl.className = "drive-up-status error";
                    statusEl.innerText = `❌ Lỗi gửi ảnh!`;
                }
            }
            this.value = "";
        };
    }
    input.click();
}

document.addEventListener("click", function(e) {
    if (!e.target.closest(".student-pass-popover") && 
        !e.target.closest(".student-feedback-popover") && 
        !e.target.closest(".dapan-schedule-popover") && 
        !e.target.closest(".btn-tuluan-change-pass") && 
        !e.target.closest(".btn-tuluan-comment") &&
        !e.target.closest("#btn-schedule-dapan")) {
        document.querySelectorAll(".student-pass-popover.show").forEach(p => p.classList.remove("show"));
        document.querySelectorAll(".student-feedback-popover.show").forEach(p => p.classList.remove("show"));
        document.querySelectorAll(".dapan-schedule-popover.show").forEach(p => p.classList.remove("show"));
    }
});

// ĐĂNG KÝ TOÀN CỤC CÁC HÀM
window.openTuLuanModal = openTuLuanModal;
window.closeTuLuanModal = closeTuLuanModal;
window.triggerStudentUpload = triggerStudentUpload;
window.handleStudentEssayUploadPC = handleStudentEssayUploadPC;
window.filterTuLuanStudentTable = filterTuLuanStudentTable;
window.filterTuLuanStatus = filterTuLuanStatus;
window.openTuLuanLightbox = openTuLuanLightbox;
window.closeTuLuanLightbox = closeTuLuanLightbox;
window.navigateLightbox = navigateLightbox;
window.jumpToLightboxPage = jumpToLightboxPage;
window.onThumbnailItemClicked = onThumbnailItemClicked;
window.triggerExamRoomDriveUpload = triggerExamRoomDriveUpload;
window.onTuLuanClassChanged = onTuLuanClassChanged;
window.onTuLuanExamChanged = onTuLuanExamChanged;
window.promptAddNewTuLuanExam = promptAddNewTuLuanExam;
window.deleteCurrentTuLuanExam = deleteCurrentTuLuanExam;
window.handleToggleApproveStudent = handleToggleApproveStudent;
window.toggleApproveAllSubmissions = toggleApproveAllSubmissions;
window.deleteSingleStudentImage = deleteSingleStudentImage;
window.getUnifiedExamFolderKey = getUnifiedExamFolderKey;
window.getCleanDriveClassName = getCleanDriveClassName;
window.getStudentFolderKey = getStudentFolderKey;
window.toggleStudentPassPopover = toggleStudentPassPopover;
window.closeStudentPassPopover = closeStudentPassPopover;
window.saveStudentPasswordChange = saveStudentPasswordChange;
window.resetStudentPasswordToDefault = resetStudentPasswordToDefault;
window.getEffectiveStudentPassword = getEffectiveStudentPassword;
window.getCurrentGraderInfo = getCurrentGraderInfo;
window.saveStudentCrossScore = saveStudentCrossScore;
window.toggleStudentFeedbackPopover = toggleStudentFeedbackPopover;
window.closeStudentFeedbackPopover = closeStudentFeedbackPopover;
window.saveStudentFeedback = saveStudentFeedback;
window.exportTuLuanToExcel = exportTuLuanToExcel;
window.triggerUploadDapAnCham = triggerUploadDapAnCham;
window.handleUploadDapAnCham = handleUploadDapAnCham;
window.deleteDapAnCham = deleteDapAnCham;
window.renderDapAnChamUI = renderDapAnChamUI;
window.toggleDapAnSchedulePopover = toggleDapAnSchedulePopover;
window.closeDapAnSchedulePopover = closeDapAnSchedulePopover;
window.onDapAnScheduleModeChanged = onDapAnScheduleModeChanged;
window.setScheduleToExamDeadline = setScheduleToExamDeadline;
window.saveDapAnSchedule = saveDapAnSchedule;
window.isDapAnUnlocked = isDapAnUnlocked;
