// =========================================================
// FILE: portal-tuluan-core.js
// QUẢN LÝ BIẾN TOÀN CỤC, GIAO DIỆN CHÍNH, VÀ TIỆN ÍCH DÙNG CHUNG
// =========================================================

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

let currentLightboxGallery = {
    studentName: "",
    studentSbd: "",
    images: [],
    currentIndex: 0,
    currentQuestionCount: 40,
    componentScores: {}
};

let lightboxZoomState = {
    scale: 1, posX: 0, posY: 0, startX: 0, startY: 0,
    isDragging: false, initialDistance: 0, initialScale: 1,
    swipeStartX: 0, swipeStartY: 0, lastTapTime: 0
};

let tuLuanRealtimeChannel = null;

(function injectTuLuanButtonStyles() {
    const styleId = "tuluan-custom-delete-btn-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .student-pass-popover, .student-feedback-popover, .dapan-schedule-popover, .component-score-popover {
            display: none !important; position: absolute !important; background: #ffffff !important;
            border-radius: 12px !important; padding: 10px !important;
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.38), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
            z-index: 999999 !important; text-align: left !important; box-sizing: border-box !important;
            animation: popInBadge 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .student-pass-popover.show, .student-feedback-popover.show, .dapan-schedule-popover.show, .component-score-popover.show { display: block !important; }
        .dapan-schedule-popover { top: calc(100% + 4px) !important; left: 0 !important; width: 310px !important; border: 1.5px solid #f59e0b !important; }
        .student-feedback-popover { right: 0 !important; bottom: calc(100% + 4px) !important; top: auto !important; width: 290px !important; border: 1.5px solid #d97706 !important; }
        .student-pass-popover { right: 0 !important; bottom: calc(100% + 4px) !important; top: auto !important; width: 280px !important; border: 1.5px solid #0284c7 !important; }
        .component-score-popover { top: calc(100% + 6px) !important; right: 0 !important; left: auto !important; width: 420px !important; max-width: 95vw !important; max-height: 84vh !important; overflow-y: auto !important; border: 1.5px solid #0284c7 !important; padding: 10px 12px !important; background: #ffffff !important; }
        
        .tuluan-modal-card { background: #ffffff !important; border-radius: 14px !important; width: 96vw !important; max-width: 98vw !important; height: 94vh !important; max-height: 95vh !important; overflow: hidden !important; box-shadow: 0 25px 65px rgba(15, 23, 42, 0.45) !important; border: 1.5px solid #cbd5e1 !important; display: flex !important; flex-direction: column !important; animation: popInModal 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important; box-sizing: border-box !important; padding: 0 !important; }
        .tuluan-modal-header { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 4px 8px !important; border-bottom: 1px solid #e2e8f0 !important; background: #ffffff !important; flex-shrink: 0 !important; min-height: 32px !important; gap: 4px !important; }
        .tuluan-header-title-box { display: flex !important; align-items: center !important; gap: 6px !important; min-width: 0 !important; flex: 1 !important; }
        .tuluan-icon-badge { width: 24px !important; height: 24px !important; border-radius: 6px !important; background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%) !important; color: #fff !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; box-shadow: 0 1px 4px rgba(79, 70, 229, 0.25) !important; flex-shrink: 0 !important; }
        #tuluan-modal-heading { font-size: 12.5px !important; font-weight: 900 !important; line-height: 1.2 !important; margin: 0 !important; color: #0f172a !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        #tuluan-modal-subheading { font-size: 9.5px !important; margin-top: 1px !important; line-height: 1.15 !important; color: #64748b !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        .tuluan-select-bar { display: flex !important; align-items: center !important; gap: 4px !important; padding: 3px 6px !important; background: #f1f5f9 !important; border-bottom: 1px solid #cbd5e1 !important; flex-wrap: wrap !important; flex-shrink: 0 !important; }
        .tuluan-select-group { display: flex !important; align-items: center !important; gap: 4px !important; }
        .tuluan-select-group label { font-size: 10.5px !important; font-weight: 800 !important; color: #334155 !important; white-space: nowrap !important; }
        .tuluan-class-compact-select { width: 76px !important; max-width: 76px !important; padding: 2px 4px !important; font-size: 11px !important; font-weight: 800 !important; border-radius: 6px !important; border: 1.2px solid #cbd5e1 !important; background: #ffffff !important; color: #0f172a !important; height: 27px !important; cursor: pointer !important; }
        #tuluan-exam-selector { padding: 2px 6px !important; border: 1.2px solid #cbd5e1 !important; border-radius: 6px !important; font-size: 11.5px !important; font-weight: 700 !important; background: #ffffff !important; color: #0f172a !important; outline: none !important; cursor: pointer !important; height: 27px !important; flex: 1 !important; min-width: 110px !important; }
        .tuluan-dapan-mini-box { display: inline-flex !important; align-items: center !important; gap: 3px !important; flex-shrink: 0 !important; }
        .btn-tuluan-upload-dapan, .btn-tuluan-schedule-dapan, .btn-del-exam-selector, .btn-tuluan-add-exam, .btn-tuluan-approve-all, .btn-tuluan-export-excel { height: 27px !important; padding: 2px 7px !important; font-size: 10.5px !important; border-radius: 6px !important; font-weight: 800 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 2px !important; white-space: nowrap !important; cursor: pointer !important; }
        .btn-tuluan-upload-dapan { background: linear-gradient(135deg, #0284c7, #0369a1) !important; color: #fff !important; border: 1px solid #38bdf8 !important; }
        .btn-tuluan-schedule-dapan { background: linear-gradient(135deg, #f59e0b, #d97706) !important; color: #fff !important; border: 1px solid #fde68a !important; }
        .btn-tuluan-schedule-dapan.has-schedule { background: linear-gradient(135deg, #10b981, #059669) !important; border-color: #86efac !important; }
        .btn-del-exam-selector { background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #f87171 !important; }
        .btn-tuluan-add-exam { background: #e0f2fe !important; color: #0369a1 !important; border: 1px solid #7dd3fc !important; }
        .btn-tuluan-approve-all { background: #f0fdf4 !important; color: #166534 !important; border: 1px solid #86efac !important; }
        .btn-tuluan-export-excel { background: linear-gradient(135deg, #059669, #047857) !important; color: #fff !important; border: 1px solid #34d399 !important; }
        .btn-dapan-badge-active { height: 27px !important; padding: 2px 6px !important; font-size: 10.5px !important; border-radius: 6px !important; max-width: 120px !important; background: #f0fdf4 !important; border: 1px solid #86efac !important; color: #166534 !important; text-decoration: none !important; display: inline-flex !important; align-items: center !important; gap: 3px !important; overflow: hidden !important; white-space: nowrap !important; text-overflow: ellipsis !important; }
        .badge-moi-mini { background: #0284c7 !important; color: #fff !important; font-size: 9px !important; padding: 1px 4px !important; border-radius: 4px !important; font-weight: 900 !important; }
        .dapan-filename-truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
        .btn-del-dapan-mini { background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; border-radius: 50% !important; width: 18px !important; height: 18px !important; font-size: 9px !important; font-weight: 900 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; padding: 0 !important; }
        .tuluan-dapan-full-strip { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 6px !important; padding: 2px 8px !important; background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%) !important; border-bottom: 1px solid #bae6fd !important; flex-shrink: 0 !important; min-height: 28px !important; }
        .dapan-strip-content { display: flex !important; align-items: center !important; gap: 4px !important; min-width: 0 !important; flex: 1 !important; }
        .dapan-badge-new { font-size: 9px !important; font-weight: 900 !important; padding: 1px 5px !important; border-radius: 4px !important; background: #0284c7 !important; color: #fff !important; }
        .dapan-badge-new.badge-lock { background: #ea580c !important; }
        .dapan-strip-title { font-size: 11px !important; font-weight: 800 !important; color: #0369a1 !important; text-decoration: none !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        .dapan-strip-time { font-size: 10px !important; color: #64748b !important; }
        .btn-open-dapan-strip { padding: 2px 7px !important; font-size: 10.5px !important; border-radius: 5px !important; height: 24px !important; line-height: 20px !important; background: #0284c7 !important; color: #fff !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
        .btn-del-dapan-strip { padding: 2px 5px !important; font-size: 10px !important; border-radius: 5px !important; height: 24px !important; background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; cursor: pointer !important; font-weight: 800 !important; }
        .tuluan-toolbar-bar { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 4px !important; padding: 3px 6px !important; background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; flex-wrap: wrap !important; flex-shrink: 0 !important; }
        .tuluan-search-box { padding: 2px 8px !important; border: 1.2px solid #cbd5e1 !important; border-radius: 6px !important; font-size: 11.5px !important; font-weight: 600 !important; width: 145px !important; height: 27px !important; outline: none !important; }
        .tuluan-filter-tabs { display: flex !important; gap: 3px !important; }
        .tuluan-tab-pill { padding: 3px 6px !important; font-size: 10.5px !important; border-radius: 6px !important; line-height: 1.2 !important; height: 27px !important; border: 1px solid #cbd5e1 !important; background: #ffffff !important; color: #475569 !important; cursor: pointer !important; font-weight: 800 !important; }
        .tuluan-tab-pill.active { background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%) !important; color: #ffffff !important; border-color: #4f46e5 !important; }
        .tuluan-table-wrap { flex: 1 !important; height: 100% !important; max-height: none !important; overflow-y: auto !important; overflow-x: auto !important; background: #ffffff !important; -webkit-overflow-scrolling: touch !important; }
        .tuluan-table { width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; font-size: 12.5px !important; text-align: left !important; white-space: nowrap !important; }
        .tuluan-table thead th { padding: 6px 6px !important; font-size: 11px !important; position: sticky !important; top: 0 !important; z-index: 10 !important; background: #0f172a !important; color: #ffffff !important; font-weight: 800 !important; border-bottom: 2px solid #4f46e5 !important; }
        .tuluan-table tbody td { padding: 5px 6px !important; font-size: 12px !important; border-bottom: 1px solid #e2e8f0 !important; vertical-align: middle !important; position: relative !important; }
        .tuluan-status-badge { display: inline-flex !important; align-items: center !important; gap: 3px !important; padding: 2px 7px !important; border-radius: 10px !important; font-size: 10.5px !important; font-weight: 800 !important; }
        .tuluan-status-badge.done { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #86efac !important; }
        .tuluan-status-badge.pending { background: #fee2e2 !important; color: #b91c1c !important; border: 1px solid #fca5a5 !important; }
        .tuluan-thumb-row { display: flex !important; align-items: center !important; gap: 4px !important; flex-wrap: wrap !important; }
        .tuluan-img-thumbnail-item { position: relative !important; display: inline-block !important; width: 38px !important; height: 38px !important; border-radius: 6px !important; overflow: hidden !important; border: 1.2px solid #cbd5e1 !important; cursor: pointer !important; background: #f1f5f9 !important; }
        .tuluan-img-thumbnail-item img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        .tuluan-thumb-page { position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; background: rgba(15, 23, 42, 0.75) !important; color: #fff !important; font-size: 8px !important; font-weight: 800 !important; text-align: center !important; padding: 1px 0 !important; }
        .btn-del-single-thumb { position: absolute !important; top: 1px !important; right: 1px !important; width: 17px !important; height: 17px !important; background: #ef4444 !important; color: #ffffff !important; border: 1px solid #ffffff !important; border-radius: 50% !important; font-size: 9.5px !important; font-weight: 900 !important; line-height: 1 !important; display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; z-index: 20 !important; padding: 0 !important; user-select: none !important; transition: transform 0.15s ease !important; }
        .btn-del-single-thumb:hover { transform: scale(1.2) !important; background: #b91c1c !important; }
        .tuluan-score-input { width: 68px !important; padding: 4px 4px !important; border: 1.2px solid #cbd5e1 !important; border-radius: 7px !important; font-size: 12.5px !important; font-weight: 900 !important; text-align: center !important; outline: none !important; color: #0284c7 !important; background: #ffffff !important; }
        .tuluan-score-input.is-locked-for-student { background: #f8fafc !important; color: #0369a1 !important; border-color: #e2e8f0 !important; cursor: not-allowed !important; }
        .btn-tuluan-comment { background: #f8fafc !important; color: #475569 !important; border: 1.2px solid #cbd5e1 !important; border-radius: 7px !important; padding: 4px 7px !important; font-size: 10.5px !important; font-weight: 800 !important; cursor: pointer !important; }
        .btn-tuluan-comment.active { background: #fef3c7 !important; color: #b45309 !important; border-color: #fde68a !important; }
        .tuluan-action-btn-group { display: inline-flex !important; align-items: center !important; gap: 4px !important; }
        .btn-tuluan-upload-row { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important; color: #ffffff !important; border: none !important; border-radius: 6px !important; padding: 4px 8px !important; font-size: 11px !important; font-weight: 800 !important; cursor: pointer !important; height: 28px !important; }
        .btn-tuluan-change-pass { background: #f0fdf4 !important; color: #166534 !important; border: 1px solid #86efac !important; border-radius: 6px !important; padding: 4px 6px !important; font-size: 10.5px !important; font-weight: 800 !important; cursor: pointer !important; height: 28px !important; }
        .btn-tuluan-reset-pass { background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74 !important; border-radius: 6px !important; padding: 4px 6px !important; font-size: 10.5px !important; font-weight: 800 !important; cursor: pointer !important; height: 28px !important; }
        .pass-popover-header { display: flex !important; align-items: center !important; justify-content: space-between !important; font-size: 12px !important; font-weight: 900 !important; color: #0f172a !important; border-bottom: 1px solid #f1f5f9 !important; padding-bottom: 5px !important; margin-bottom: 7px !important; }
        .btn-close-pass-pop { background: none !important; border: none !important; font-size: 14px !important; font-weight: 900 !important; color: #94a3b8 !important; cursor: pointer !important; }
        .tuluan-modal-footer { padding: 3px 8px !important; min-height: 28px !important; background: #f8fafc !important; border-top: 1px solid #e2e8f0 !important; display: flex !important; align-items: center !important; justify-content: space-between !important; flex-shrink: 0 !important; }
        
        .tuluan-lightbox-overlay { position: fixed !important; inset: 0 !important; background: rgba(10, 15, 29, 0.94) !important; backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; z-index: 10000000 !important; display: none; align-items: center !important; justify-content: center !important; padding: 8px !important; animation: fadeInModal 0.2s ease-out !important; touch-action: none !important; user-select: none !important; }
        .tuluan-lightbox-content { background: #0f172a !important; border: 1.5px solid #334155 !important; border-radius: 16px !important; max-width: 95vw !important; width: 95vw !important; height: 95vh !important; max-height: 95vh !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6) !important; position: relative !important; }
        .tuluan-lightbox-header { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 6px 12px !important; background: #1e293b !important; border-bottom: 1.5px solid #334155 !important; flex-shrink: 0 !important; gap: 8px !important; }
        .lightbox-title-wrap { display: flex !important; align-items: center !important; gap: 6px !important; min-width: 0 !important; flex: 1 !important; }
        #lightbox-student-title { font-weight: 800 !important; font-size: 13.5px !important; color: #ffffff !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        .lightbox-page-badge { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important; color: #ffffff !important; border: 1px solid #38bdf8 !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 11px !important; font-weight: 900 !important; letter-spacing: 0.5px !important; flex-shrink: 0 !important; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4) !important; }
        .btn-lightbox-component-score { background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color: #ffffff !important; border: 1.2px solid #6ee7b7 !important; padding: 4px 10px !important; border-radius: 8px !important; font-size: 11.5px !important; font-weight: 900 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 4px !important; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35) !important; transition: all 0.15s ease !important; white-space: nowrap !important; }
        .btn-lightbox-component-score:hover { filter: brightness(1.1) !important; transform: translateY(-1px) !important; }
        .btn-lightbox-component-score:active { transform: scale(0.95) !important; }
        .btn-close-lightbox { background: #334155 !important; border: none !important; border-radius: 50% !important; color: #ffffff !important; width: 28px !important; height: 28px !important; font-size: 15px !important; font-weight: 900 !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
        .btn-close-lightbox:hover { background: #ef4444 !important; }
        .tuluan-lightbox-img-box { flex: 1 !important; position: relative !important; overflow: hidden !important; display: flex !important; align-items: center !important; justify-content: center !important; background: #070b14 !important; touch-action: none !important; user-select: none !important; cursor: grab !important; }
        .tuluan-lightbox-img-box.is-zoomed { cursor: move !important; }
        #lightbox-full-img { max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; border-radius: 6px !important; transform-origin: center center !important; will-change: transform !important; box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important; pointer-events: auto !important; }
        .btn-lightbox-nav { position: absolute !important; top: 50% !important; transform: translateY(-50%) !important; width: 44px !important; height: 44px !important; background: rgba(15, 23, 42, 0.72) !important; color: #ffffff !important; border: 1.5px solid rgba(255, 255, 255, 0.35) !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 20px !important; cursor: pointer !important; z-index: 100 !important; backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important; transition: all 0.18s ease !important; user-select: none !important; }
        .btn-lightbox-nav:hover { background: #0284c7 !important; border-color: #38bdf8 !important; transform: translateY(-50%) scale(1.12) !important; }
        .btn-lightbox-nav.btn-nav-prev { left: 12px !important; }
        .btn-lightbox-nav.btn-nav-next { right: 12px !important; }
        .btn-lightbox-nav.disabled { opacity: 0.25 !important; cursor: not-allowed !important; pointer-events: none !important; }
        .lightbox-bottom-bar { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 6px 12px !important; background: #1e293b !important; border-top: 1.5px solid #334155 !important; font-size: 11px !important; color: #94a3b8 !important; font-weight: 700 !important; flex-shrink: 0 !important; gap: 8px !important; }
        .lightbox-zoom-tools { display: flex !important; align-items: center !important; gap: 4px !important; flex-shrink: 0 !important; }
        .btn-zoom-tool { background: #334155 !important; color: #ffffff !important; border: 1px solid #475569 !important; border-radius: 6px !important; padding: 3px 7px !important; font-size: 11.5px !important; font-weight: 900 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; transition: all 0.15s ease !important; }
        .btn-zoom-tool:hover { background: #0284c7 !important; border-color: #38bdf8 !important; }
        .btn-zoom-tool:active { transform: scale(0.92) !important; }
        .lightbox-dots-container { display: flex !important; align-items: center !important; gap: 4px !important; }
        .lightbox-dot-item { width: 7px !important; height: 7px !important; border-radius: 50% !important; background: #475569 !important; transition: all 0.2s ease !important; cursor: pointer !important; }
        .lightbox-dot-item.active { background: #38bdf8 !important; width: 16px !important; border-radius: 8px !important; }
        .comp-score-grid-10 { display: grid !important; grid-template-columns: repeat(10, 1fr) !important; gap: 4px !important; background: #f8fafc !important; padding: 6px !important; border-radius: 8px !important; border: 1px solid #e2e8f0 !important; margin-bottom: 6px !important; }
        .comp-score-cell-box { display: flex !important; flex-direction: column !important; align-items: center !important; }
        .comp-score-cell-input { width: 100% !important; padding: 3px 1px !important; text-align: center !important; border: 1.2px solid #cbd5e1 !important; border-radius: 5px !important; font-size: 11px !important; font-weight: 800 !important; color: #0f172a !important; background: #ffffff !important; outline: none !important; box-sizing: border-box !important; }
        .comp-score-cell-input:focus { border-color: #10b981 !important; background: #ecfdf5 !important; box-shadow: 0 0 0 1.5px rgba(16, 185, 129, 0.3) !important; }
        .comp-score-cell-input::placeholder { color: #94a3b8 !important; font-weight: 600 !important; font-size: 9.5px !important; }
        .comp-score-footer-row { display: flex !important; align-items: center !important; justify-content: space-between !important; background: #f0fdf4 !important; border: 1.2px solid #86efac !important; border-radius: 8px !important; padding: 6px 8px !important; gap: 6px !important; flex-wrap: wrap !important; }
        .comp-score-kpi-item { display: inline-flex !important; align-items: center !important; gap: 4px !important; font-size: 11.5px !important; font-weight: 800 !important; color: #166534 !important; }
        .comp-score-kpi-val { background: #ffffff !important; border: 1px solid #86efac !important; padding: 2px 7px !important; border-radius: 6px !important; font-size: 13px !important; font-weight: 900 !important; color: #15803d !important; }

        @media (max-width: 640px) {
            .btn-lightbox-nav { width: 36px !important; height: 36px !important; font-size: 17px !important; }
            .btn-lightbox-nav.btn-nav-prev { left: 6px !important; }
            .btn-lightbox-nav.btn-nav-next { right: 6px !important; }
            .lightbox-bottom-bar span.lightbox-hint-text { display: none !important; }
            .comp-score-grid-10 { grid-template-columns: repeat(5, 1fr) !important; }
            
            .move-modal-overlay#modal-tuluan-submission {
                align-items: flex-start !important;
                padding-top: max(12px, env(safe-area-inset-top)) !important;
                padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
            }
            .tuluan-modal-card {
                margin: auto !important;
                padding: 0 !important;
                border-radius: 14px !important;
                width: 100vw !important;
                max-width: 100vw !important;
                height: auto !important;
                max-height: 100% !important;
                border: none !important;
            }
            .student-pass-popover, .student-feedback-popover {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                right: auto !important;
                bottom: auto !important;
                transform: translate(-50%, -50%) !important;
                width: min(340px, calc(100vw - 20px)) !important;
                max-width: calc(100vw - 20px) !important;
                z-index: 100000000 !important;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 2000px rgba(0, 0, 0, 0.45) !important;
            }
            .student-pass-popover.show, .student-feedback-popover.show {
                animation: popInModal 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }
            
            .tuluan-modal-header { padding: 6px 10px !important; }
            .tuluan-select-bar { padding: 6px 10px !important; gap: 5px !important; }
            .tuluan-select-group { flex: 1 1 auto; }
            .tuluan-select-group select { width: 100%; max-width: 100%; }
            .tuluan-toolbar-bar { padding: 6px 10px !important; gap: 6px !important; }
            .tuluan-search-box { width: 100% !important; height: 32px !important; font-size: 12.5px !important; }
            .tuluan-filter-tabs { width: 100% !important; display: flex; gap: 4px; }
            .tuluan-tab-pill { flex: 1; text-align: center; padding: 5px 2px !important; font-size: 10.5px !important; }
            .tuluan-table thead th:last-child { position: sticky; right: 0; background: #0f172a !important; z-index: 15; box-shadow: -3px 0 8px rgba(15, 23, 42, 0.25); }
            .tuluan-table tbody td:last-child { position: sticky; right: 0; background: #ffffff !important; z-index: 9; box-shadow: -3px 0 8px rgba(15, 23, 42, 0.12); }
            .tuluan-table tbody tr:nth-child(even) td:last-child { background: #f8fafc !important; }
            .tuluan-table tbody tr:hover td:last-child { background: #f0f9ff !important; }
            .btn-tuluan-upload-row { padding: 7px 12px !important; font-size: 12px !important; font-weight: 800 !important; min-height: 32px !important; }
            .btn-tuluan-change-pass, .btn-tuluan-reset-pass { padding: 6px 8px !important; font-size: 10.5px !important; min-height: 32px !important; }

            /* FIX CHO IPHONE: Đảm bảo header không bị tràn lên trên và bị che bởi viền/tai thỏ */
            .tuluan-lightbox-overlay {
                padding: 0 !important; /* Tràn viền trên mobile */
                align-items: flex-start !important; /* Không dùng center để tránh bị cắt phần đầu trên Safari */
            }
            .tuluan-lightbox-content {
                width: 100vw !important;
                max-width: 100vw !important;
                height: 100% !important; /* Dùng 100% thay vì 95vh */
                max-height: -webkit-fill-available !important; /* Sửa lỗi thanh địa chỉ Safari */
                border-radius: 0 !important;
                border: none !important;
            }
            .tuluan-lightbox-header {
                padding-top: max(8px, env(safe-area-inset-top)) !important; /* Cách tai thỏ/Dynamic Island */
                padding-left: 8px !important;
                padding-right: 8px !important;
            }
            .lightbox-bottom-bar {
                padding-bottom: max(6px, env(safe-area-inset-bottom)) !important; /* Cách thanh Home ảo */
            }
        }
    `;
    document.head.appendChild(style);
})();

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
                            <th style="width: 95px; text-align: center;" title="Điểm chấm chéo (Học sinh mở ảnh chấm Điểm thành phần)">Chấm chéo</th>
                            <th style="width: 95px; text-align: center;" title="Nhận xét bài làm">Nhận xét</th>
                            <th style="min-width: 160px; text-align: center;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="tuluan-students-tbody"></tbody>
                </table>
            </div>

            <div class="tuluan-modal-footer">
                <span style="font-size:10.5px; color:#64748b; font-style:italic;">
                    🔒 Ô điểm chấm chéo khóa với học sinh. Học sinh mở ảnh bấm "Điểm TP" để chấm từng câu công khai.
                </span>
                <button type="button" class="btn-admin btn-cancel" style="padding: 3px 12px; font-size:11.5px;" onclick="closeTuLuanModal(event)">Đóng</button>
            </div>
        </div>

        <!-- LIGHTBOX XEM ẢNH, NÚT "ĐIỂM TP" VÀ PINCH-ZOOM 2 NGÓN TAY -->
        <div id="tuluan-lightbox" class="tuluan-lightbox-overlay" onclick="closeTuLuanLightbox(event)">
            <div class="tuluan-lightbox-content" onclick="event.stopPropagation()">
                <div class="tuluan-lightbox-header">
                    <div class="lightbox-title-wrap">
                        <span id="lightbox-student-title">Ảnh bài làm</span>
                        <span class="lightbox-page-badge" id="lightbox-page-indicator">Tr 1/1</span>
                    </div>

                    <!-- NÚT ĐIỂM THÀNH PHẦN VÀ KHUNG POPOVER XÒE RA -->
                    <div style="display:flex; gap:6px; align-items:center; position:relative;">
                        <div style="position:relative; display:inline-block;">
                            <button type="button" class="btn-lightbox-component-score" id="btn-open-component-score" onclick="toggleComponentScorePopover(event)" title="Chấm điểm từng câu chi tiết">
                                📊 Điểm TP ▾
                            </button>

                            <!-- POPOVER BẢNG ĐIỂM THÀNH PHẦN NỔI LÊN (SIÊU NHỎ GỌN) -->
                            <div class="component-score-popover" id="component-score-popover" onclick="event.stopPropagation()">
                                <div class="pass-popover-header">
                                    <span style="color:#059669;">📊 Chấm Điểm Từng Câu: <b id="comp-score-st-name">Học sinh</b></span>
                                    <button type="button" class="btn-close-pass-pop" onclick="closeComponentScorePopover(event)">✕</button>
                                </div>

                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; gap:4px; font-size:11px; flex-wrap:wrap;">
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <b style="color:#334155;">Số câu của đề:</b>
                                        <input type="number" id="comp-score-q-count" min="1" max="120" value="40" 
                                               style="width:48px; padding:2px 4px; border:1px solid #cbd5e1; border-radius:5px; font-weight:800; text-align:center;"
                                               onchange="onComponentQuestionCountChanged(this.value)">
                                    </div>
                                    <div style="display:flex; gap:3px;">
                                        <button type="button" class="btn-quick-deadline" style="margin:0; padding:2px 5px;" onclick="setQuickQuestionCount(30)">30</button>
                                        <button type="button" class="btn-quick-deadline" style="margin:0; padding:2px 5px;" onclick="setQuickQuestionCount(36)">36</button>
                                        <button type="button" class="btn-quick-deadline" style="margin:0; padding:2px 5px;" onclick="setQuickQuestionCount(40)">40</button>
                                        <button type="button" class="btn-quick-deadline" style="margin:0; padding:2px 5px;" onclick="setQuickQuestionCount(50)">50</button>
                                    </div>
                                </div>

                                <!-- LƯỚI Ô NHẬP ĐIỂM SÁT SẠT NHAU -->
                                <div class="comp-score-grid-10" id="comp-score-grid-container"></div>

                                <div style="font-size:10px; color:#64748b; font-style:italic; margin-bottom:6px;">
                                    💡 Nhập dấu chấm (.) hoặc phẩy (,). Nhấn Enter để sang câu tiếp theo.
                                </div>

                                <!-- HÀNG THỨ 5: TỔNG ĐIỂM, THANG 10 VÀ LƯU -->
                                <div class="comp-score-footer-row">
                                    <div class="comp-score-kpi-item">
                                        <span>Tổng:</span>
                                        <span class="comp-score-kpi-val" id="comp-score-total-sum">0.0</span>
                                    </div>

                                    <div class="comp-score-kpi-item">
                                        <span>Thang 10:</span>
                                        <span class="comp-score-kpi-val" id="comp-score-scale10-val" style="color:#0284c7; border-color:#38bdf8;">0.0</span>
                                    </div>

                                    <div style="display:flex; gap:4px; margin-left:auto;">
                                        <select id="comp-score-apply-mode" style="font-size:10.5px; font-weight:700; border-radius:6px; border:1px solid #86efac; padding:2px 4px; background:#fff;" title="Chọn điểm đưa ra bảng ngoài">
                                            <option value="scale10">Điểm thang 10</option>
                                            <option value="raw">Điểm cộng dồn</option>
                                        </select>
                                        <button type="button" class="btn-pass-save" onclick="saveComponentScoresAction(event)" style="padding:4px 8px; font-size:11px;">
                                            💾 Lưu & Đưa ra bảng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="button" class="btn-close-lightbox" onclick="closeTuLuanLightbox(event)">✕</button>
                    </div>
                </div>

                <!-- VÙNG ẢNH HỖ TRỢ ZOOM 2 NGÓN TAY VÀ PAN -->
                <div class="tuluan-lightbox-img-box" id="lightbox-touch-area">
                    <button type="button" class="btn-lightbox-nav btn-nav-prev" id="btn-lightbox-prev" onclick="navigateLightbox(-1, event)" title="Xem trang trước (hoặc vuốt sang phải)">
                        ◀
                    </button>
                    <img id="lightbox-full-img" src="" alt="Ảnh bài làm tự luận">
                    <button type="button" class="btn-lightbox-nav btn-nav-next" id="btn-lightbox-next" onclick="navigateLightbox(1, event)" title="Xem trang sau (hoặc vuốt sang trái)">
                        ▶
                    </button>
                </div>

                <!-- THANH ĐIỀU HƯỚNG DƯỚI ĐÁY KÈM NÚT ZOOM TIỆN ÍCH -->
                <div class="lightbox-bottom-bar">
                    <div class="lightbox-zoom-tools">
                        <button type="button" class="btn-zoom-tool" onclick="zoomLightboxStep(-0.35, event)" title="Thu nhỏ ảnh">🔍−</button>
                        <button type="button" class="btn-zoom-tool" id="btn-zoom-reset" onclick="resetLightboxZoom(true, event)" title="Đưa về cỡ gốc">↺ 1x</button>
                        <button type="button" class="btn-zoom-tool" onclick="zoomLightboxStep(0.35, event)" title="Phóng to ảnh">🔍+</button>
                    </div>

                    <div class="lightbox-dots-container" id="lightbox-dots-container"></div>
                    <span class="lightbox-hint-text">💡 Dùng 2 ngón tay zoom to/nhỏ • Nhấp đúp phóng to • Kéo rê đọc bài</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    setupLightboxTouchAndZoom();
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
    
    // Khắc phục Lỗi 4: Đợi 260ms cho hiệu ứng CSS chạy mượt mà trước khi nạp dữ liệu nặng
    setTimeout(async () => {
        await refreshTuLuanExamList(targetCat, itemId);
    }, 260);
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

// BỘ ĐIỀU HƯỚNG PINCH-TO-ZOOM 2 NGÓN TAY, PAN KÉO RÊ & VUỐT CHUYỂN TRANG
function setupLightboxTouchAndZoom() {
    const area = document.getElementById("lightbox-touch-area");
    if (!area) return;

    function getDistance(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.hypot(dx, dy);
    }

    area.addEventListener("touchstart", function(e) {
        if (!e.touches) return;

        if (e.touches.length === 2) {
            lightboxZoomState.initialDistance = getDistance(e.touches[0], e.touches[1]);
            lightboxZoomState.initialScale = lightboxZoomState.scale;
            lightboxZoomState.isDragging = false;
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const now = Date.now();

            if (now - lightboxZoomState.lastTapTime < 280) {
                if (lightboxZoomState.scale > 1.1) {
                    resetLightboxZoom(true);
                } else {
                    lightboxZoomState.scale = 2.4;
                    lightboxZoomState.posX = 0;
                    lightboxZoomState.posY = 0;
                    applyImageTransform(true);
                }
                lightboxZoomState.lastTapTime = 0;
                return;
            }
            lightboxZoomState.lastTapTime = now;

            if (lightboxZoomState.scale > 1.05) {
                lightboxZoomState.isDragging = true;
                lightboxZoomState.startX = touch.clientX - lightboxZoomState.posX;
                lightboxZoomState.startY = touch.clientY - lightboxZoomState.posY;
            } else {
                lightboxZoomState.swipeStartX = touch.clientX;
                lightboxZoomState.swipeStartY = touch.clientY;
                lightboxZoomState.isDragging = false;
            }
        }
    }, { passive: false });

    area.addEventListener("touchmove", function(e) {
        if (!e.touches) return;

        if (e.touches.length === 2 && lightboxZoomState.initialDistance > 0) {
            e.preventDefault();
            const currentDist = getDistance(e.touches[0], e.touches[1]);
            const factor = currentDist / lightboxZoomState.initialDistance;
            let newScale = lightboxZoomState.initialScale * factor;
            newScale = Math.min(Math.max(1, newScale), 5);

            lightboxZoomState.scale = newScale;
            if (newScale === 1) {
                lightboxZoomState.posX = 0;
                lightboxZoomState.posY = 0;
            }
            applyImageTransform(false);
        } else if (e.touches.length === 1 && lightboxZoomState.isDragging && lightboxZoomState.scale > 1.05) {
            e.preventDefault();
            const touch = e.touches[0];
            lightboxZoomState.posX = touch.clientX - lightboxZoomState.startX;
            lightboxZoomState.posY = touch.clientY - lightboxZoomState.startY;
            applyImageTransform(false);
        }
    }, { passive: false });

    area.addEventListener("touchend", function(e) {
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            lightboxZoomState.startX = touch.clientX - lightboxZoomState.posX;
            lightboxZoomState.startY = touch.clientY - lightboxZoomState.posY;
            lightboxZoomState.isDragging = (lightboxZoomState.scale > 1.05);
            return;
        }

        if (!e.touches || e.touches.length === 0) {
            lightboxZoomState.isDragging = false;
            lightboxZoomState.initialDistance = 0;

            if (lightboxZoomState.scale <= 1.05 && e.changedTouches && e.changedTouches.length > 0) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const diffX = endX - lightboxZoomState.swipeStartX;
                const diffY = endY - lightboxZoomState.swipeStartY;

                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 38) {
                    if (diffX < 0) {
                        navigateLightbox(1);
                    } else {
                        navigateLightbox(-1);
                    }
                }
            }
        }
    }, { passive: true });

    area.addEventListener("wheel", function(e) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        zoomLightboxStep(delta);
    }, { passive: false });

    let isMouseDown = false;
    area.addEventListener("mousedown", function(e) {
        if (lightboxZoomState.scale > 1.05) {
            isMouseDown = true;
            lightboxZoomState.startX = e.clientX - lightboxZoomState.posX;
            lightboxZoomState.startY = e.clientY - lightboxZoomState.posY;
        }
    });

    window.addEventListener("mousemove", function(e) {
        if (isMouseDown && lightboxZoomState.scale > 1.05) {
            lightboxZoomState.posX = e.clientX - lightboxZoomState.startX;
            lightboxZoomState.posY = e.clientY - lightboxZoomState.startY;
            applyImageTransform(false);
        }
    });

    window.addEventListener("mouseup", function() { isMouseDown = false; });

    document.addEventListener("keydown", function(e) {
        const lb = document.getElementById("tuluan-lightbox");
        if (lb && lb.style.display === "flex") {
            if (e.key === "ArrowLeft") navigateLightbox(-1);
            else if (e.key === "ArrowRight") navigateLightbox(1);
            else if (e.key === "Escape") closeTuLuanLightbox();
        }
    });
}

function applyImageTransform(smooth = false) {
    const img = document.getElementById("lightbox-full-img");
    const area = document.getElementById("lightbox-touch-area");
    const resetBtn = document.getElementById("btn-zoom-reset");
    if (!img) return;

    if (smooth) {
        img.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
    } else {
        img.style.transition = "none";
    }

    img.style.transform = `translate3d(${lightboxZoomState.posX}px, ${lightboxZoomState.posY}px, 0) scale(${lightboxZoomState.scale})`;

    if (area) {
        area.classList.toggle("is-zoomed", lightboxZoomState.scale > 1.05);
    }
    if (resetBtn) {
        const roundScale = Math.round(lightboxZoomState.scale * 10) / 10;
        resetBtn.innerText = roundScale > 1 ? `↺ ${roundScale}x` : `↺ 1x`;
        resetBtn.style.color = roundScale > 1 ? "#38bdf8" : "#ffffff";
    }
}

function resetLightboxZoom(smooth = false, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    lightboxZoomState.scale = 1;
    lightboxZoomState.posX = 0;
    lightboxZoomState.posY = 0;
    applyImageTransform(smooth);
}

function zoomLightboxStep(step, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    let newScale = lightboxZoomState.scale + step;
    newScale = Math.min(Math.max(1, newScale), 5);
    lightboxZoomState.scale = Math.round(newScale * 100) / 100;
    if (lightboxZoomState.scale <= 1.02) {
        lightboxZoomState.scale = 1;
        lightboxZoomState.posX = 0;
        lightboxZoomState.posY = 0;
    }
    applyImageTransform(true);
}

document.addEventListener("click", function(e) {
    if (!e.target.closest(".student-pass-popover") && 
        !e.target.closest(".student-feedback-popover") && 
        !e.target.closest(".dapan-schedule-popover") && 
        !e.target.closest(".component-score-popover") &&
        !e.target.closest("#btn-open-component-score") &&
        !e.target.closest(".btn-tuluan-change-pass") && 
        !e.target.closest(".btn-tuluan-comment") &&
        !e.target.closest("#btn-schedule-dapan")) {
        document.querySelectorAll(".student-pass-popover.show").forEach(p => p.classList.remove("show"));
        document.querySelectorAll(".student-feedback-popover.show").forEach(p => p.classList.remove("show"));
        document.querySelectorAll(".dapan-schedule-popover.show").forEach(p => p.classList.remove("show"));
        document.querySelectorAll(".component-score-popover.show").forEach(p => p.classList.remove("show"));
    }
});

// ĐĂNG KÝ TOÀN CỤC
window.openTuLuanModal = openTuLuanModal;
window.closeTuLuanModal = closeTuLuanModal;
window.getDbClient = getDbClient;
window.checkCurrentIsAdmin = checkCurrentIsAdmin;
window.getCleanDriveClassName = getCleanDriveClassName;
window.getUnifiedExamFolderKey = getUnifiedExamFolderKey;
window.getStudentFolderKey = getStudentFolderKey;
window.getEffectiveStudentPassword = getEffectiveStudentPassword;
window.getCurrentGraderInfo = getCurrentGraderInfo;
window.detectExamQuestionCount = detectExamQuestionCount;
}