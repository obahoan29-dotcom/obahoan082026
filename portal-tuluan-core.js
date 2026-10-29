// =========================================================
// FILE: portal-tuluan-core.js (BẢN CHUẨN HÓA LỚP & SỬA LỖI UI ĐIỆN THOẠI)
// =========================================================

let currentTuLuanModalData = {
    classId: "lop-11a",
    quizId: "",
    examTitle: "",
    submissionsMap: {},
    availableExams: [],
    customPasswords: {},
    statusFilter: "all",
    dapAnCham: null,
    dapAnChamList: []
};

let currentLightboxGallery = {
    studentName: "",
    studentSbd: "",
    images: [],
    currentIndex: 0,
    currentQuestionCount: 30,
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
        /* THÊM MỚI: NÚT X MÀU ĐỎ ĐỂ XÓA ẢNH TRỰC TIẾP TRÊN THUMBNAIL */
        .btn-del-single-thumb {
            position: absolute !important; 
            top: -4px !important; 
            right: -4px !important;
            background: #ef4444 !important; 
            color: #ffffff !important; 
            border: 1.5px solid #b91c1c !important;
            border-radius: 50% !important; 
            width: 20px !important; 
            height: 20px !important;
            font-size: 11px !important; 
            font-weight: 900 !important; 
            line-height: 1 !important;
            cursor: pointer !important; 
            display: flex !important; 
            align-items: center !important; 
            justify-content: center !important;
            z-index: 20 !important; 
            box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
            transition: all 0.15s ease !important;
            padding: 0 !important;
        }
        .btn-del-single-thumb:hover { 
            background: #dc2626 !important; 
            transform: scale(1.15) !important; 
        }

        /* THÊM MỚI: LÀM RÕ TÊN HỌC SINH VÀ SỐ TRANG TRÊN LIGHTBOX */
        .lightbox-title-wrap { 
            display: flex !important; 
            align-items: center !important; 
            gap: 8px !important; 
            flex-wrap: wrap !important; 
        }
        #lightbox-student-title { 
            color: #facc15 !important; 
            font-size: 15px !important; 
            font-weight: 900 !important; 
            text-transform: uppercase !important; 
            text-shadow: 0 1px 3px rgba(0,0,0,0.5) !important; 
        }
        .lightbox-page-badge { 
            background: #3b82f6 !important; 
            color: #ffffff !important; 
            padding: 3px 8px !important; 
            border-radius: 12px !important; 
            font-size: 12px !important; 
            font-weight: 800 !important; 
            border: 1px solid #93c5fd !important; 
        }

        .student-pass-popover, .student-feedback-popover, .dapan-schedule-popover, .component-score-popover {
            display: none !important; position: absolute !important; background: #ffffff !important;
            border-radius: 16px !important; padding: 14px 16px !important;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35), 0 0 0 1.5px rgba(0, 0, 0, 0.08) !important;
            z-index: 999999 !important; text-align: left !important; box-sizing: border-box !important;
            animation: popInBadge 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .student-pass-popover.show, .student-feedback-popover.show, .dapan-schedule-popover.show, .component-score-popover.show { display: block !important; }
        
        .dapan-schedule-popover { top: calc(100% + 6px) !important; left: 0 !important; width: 310px !important; border: 1.5px solid #f59e0b !important; }
        .student-feedback-popover { right: 0 !important; top: calc(100% + 8px) !important; bottom: auto !important; width: 320px !important; border: 1.5px solid #d97706 !important; }
        .student-pass-popover { right: 0 !important; top: calc(100% + 8px) !important; bottom: auto !important; width: 300px !important; border: 1.5px solid #0284c7 !important; }
        
        /* CẤU HÌNH POPOVER ĐIỂM THÀNH PHẦN CHUẨN TRÊN PC */
        .component-score-popover {
            top: calc(100% + 6px) !important;
            right: 0 !important;
            left: auto !important;
            width: 580px !important;
            max-width: 95vw !important;
            max-height: 88vh !important;
            overflow-y: auto !important;
            border: 1.8px solid #059669 !important;
            padding: 14px 18px !important;
            background: #ffffff !important;
            border-radius: 18px !important;
        }
        
        /* MA TRẬN 10 CỘT Ô VUÔNG ĐIỂM TỪNG CÂU TRÊN MÁY TÍNH */
        .comp-score-grid-10 {
            display: grid !important;
            grid-template-columns: repeat(10, 1fr) !important;
            gap: 6px !important;
            margin: 12px 0 10px 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }
        .comp-score-cell-box {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
        }
        .comp-score-cell-input {
            width: 100% !important;
            height: 38px !important;
            text-align: center !important;
            font-size: 13.5px !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            background: #ffffff !important;
            border: 1.6px solid #cbd5e1 !important;
            border-radius: 8px !important;
            outline: none !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            transition: all 0.15s ease !important;
        }
        .comp-score-cell-input:focus {
            border-color: #059669 !important;
            box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.2) !important;
            background: #f0fdf4 !important;
        }

        /* KHUNG CHÂN ĐIỂM TỔNG & THANG 10 */
        .comp-score-footer-box {
            background: #ffffff !important;
            border: 1.8px solid #86efac !important;
            border-radius: 12px !important;
            padding: 10px 14px !important;
            margin-top: 10px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            box-shadow: 0 2px 8px rgba(34, 197, 94, 0.08) !important;
        }
        .comp-score-kpi-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
        }
        .comp-score-kpi-badge {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
        }
        .comp-score-kpi-pill {
            display: inline-block !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 8px !important;
            padding: 4px 14px !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            min-width: 45px !important;
            text-align: center !important;
            background: #ffffff !important;
        }
        .comp-score-kpi-pill.pill-green {
            color: #059669 !important;
        }

        .btn-quick-count-pill {
            background: #ffffff !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 8px !important;
            padding: 4px 10px !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            color: #334155 !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
        }
        .btn-quick-count-pill:hover, .btn-quick-count-pill.active {
            border-color: #059669 !important;
            background: #f0fdf4 !important;
            color: #059669 !important;
        }

        .pass-popover-hint { font-size: 11.5px !important; color: #334155 !important; background: #f0f9ff !important; padding: 8px 10px !important; border-radius: 8px !important; margin-bottom: 12px !important; border: 1px solid #bae6fd !important; line-height: 1.45 !important; }
        .pass-input-row { margin-bottom: 10px !important; text-align: left !important; }
        .pass-input-row label { display: block !important; font-size: 11px !important; font-weight: 800 !important; color: #0f172a !important; margin-bottom: 4px !important; }
        .pass-input-row input { width: 100% !important; padding: 8px 12px !important; border: 1.5px solid #cbd5e1 !important; border-radius: 8px !important; font-size: 13px !important; font-weight: 700 !important; outline: none !important; transition: 0.2s !important; box-sizing: border-box !important; color: #0f172a !important; }
        .pass-input-row input:focus { border-color: #0284c7 !important; box-shadow: 0 0 0 3px rgba(2,132,199,0.15) !important; }
        .pass-popover-actions { display: flex !important; gap: 8px !important; margin-top: 14px !important; }
        .btn-pass-cancel { flex: 1 !important; padding: 8px !important; background: #f8fafc !important; border: 1.5px solid #cbd5e1 !important; border-radius: 8px !important; font-size: 11.5px !important; font-weight: 800 !important; color: #475569 !important; cursor: pointer !important; transition: 0.15s !important; }
        .btn-pass-cancel:hover { background: #e2e8f0 !important; color: #0f172a !important; }
        .btn-pass-save { flex: 1.5 !important; padding: 8px !important; background: linear-gradient(135deg, #0284c7, #0369a1) !important; border: none !important; border-radius: 8px !important; font-size: 11.5px !important; font-weight: 800 !important; color: #fff !important; cursor: pointer !important; box-shadow: 0 3px 10px rgba(2,132,199,0.3) !important; transition: 0.15s !important; }
        .btn-pass-save:hover { filter: brightness(1.1) !important; transform: translateY(-1px) !important; }
        .btn-pass-save:active { transform: translateY(2px) scale(0.95) !important; }
        .feedback-textarea { width: 100% !important; padding: 10px !important; border: 1.5px solid #cbd5e1 !important; border-radius: 8px !important; font-size: 13px !important; font-weight: 600 !important; outline: none !important; resize: vertical !important; min-height: 90px !important; margin-bottom: 6px !important; font-family: inherit !important; box-sizing: border-box !important; color: #0f172a !important; }
        .feedback-textarea:focus { border-color: #d97706 !important; box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15) !important; }

        .tuluan-modal-card { background: #ffffff !important; border-radius: 14px !important; width: 96vw !important; max-width: 98vw !important; height: 94vh !important; max-height: 95vh !important; overflow: hidden !important; box-shadow: 0 25px 65px rgba(15, 23, 42, 0.45) !important; border: 1.5px solid #cbd5e1 !important; display: flex !important; flex-direction: column !important; animation: popInModal 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important; box-sizing: border-box !important; padding: 0 !important; }
        .tuluan-modal-header { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 4px 8px !important; border-bottom: 1px solid #e2e8f0 !important; background: #ffffff !important; flex-shrink: 0 !important; min-height: 32px !important; gap: 4px !important; }
        .tuluan-header-title-box { display: flex !important; align-items: center !important; gap: 6px !important; min-width: 0 !important; flex: 1 !important; }
        .tuluan-icon-badge { width: 24px !important; height: 24px !important; border-radius: 6px !important; background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%) !important; color: #fff !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; box-shadow: 0 1px 4px rgba(79, 70, 229, 0.25) !important; flex-shrink: 0 !important; }
        #tuluan-modal-heading { font-size: 12.5px !important; font-weight: 900 !important; line-height: 1.2 !important; margin: 0 !important; color: #0f172a !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        #tuluan-modal-subheading { font-size: 9.5px !important; margin-top: 1px !important; line-height: 1.15 !important; color: #64748b !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        .tuluan-select-bar { display: flex !important; align-items: center !important; gap: 4px !important; padding: 3px 6px !important; background: #f1f5f9 !important; border-bottom: 1px solid #cbd5e1 !important; flex-wrap: wrap !important; flex-shrink: 0 !important; }
        .tuluan-select-group { display: flex !important; align-items: center !important; gap: 4px !important; }
        .tuluan-select-group label { font-size: 10.5px !important; font-weight: 800 !important; color: #334155 !important; white-space: nowrap !important; }
        .tuluan-class-compact-select { width: 85px !important; max-width: 85px !important; padding: 2px 4px !important; font-size: 11px !important; font-weight: 800 !important; border-radius: 6px !important; border: 1.2px solid #cbd5e1 !important; background: #ffffff !important; color: #0f172a !important; height: 27px !important; cursor: pointer !important; }
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
        
        .tuluan-table-wrap { flex: 1 !important; height: 100% !important; max-height: none !important; overflow-y: auto !important; overflow-x: auto !important; background: #ffffff !important; -webkit-overflow-scrolling: touch !important; padding-bottom: 180px !important; }
        .tuluan-table { width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; font-size: 12.5px !important; text-align: left !important; white-space: nowrap !important; }
        .tuluan-table thead th { padding: 6px 6px !important; font-size: 11px !important; position: sticky !important; top: 0 !important; z-index: 10 !important; background: #0f172a !important; color: #ffffff !important; font-weight: 800 !important; border-bottom: 2px solid #4f46e5 !important; }
        .tuluan-table tbody td { padding: 5px 6px !important; font-size: 12px !important; border-bottom: 1px solid #e2e8f0 !important; vertical-align: middle !important; position: relative !important; }

        /* TỐI ƯU GIAO DIỆN BẢNG ĐIỂM THÀNH PHẦN TRÊN MOBILE */
        @media (max-width: 640px) {
            .component-score-popover {
                width: 95vw !important;
                padding: 12px 10px !important;
            }
            .comp-score-grid-10 {
                grid-template-columns: repeat(5, 1fr) !important;
                gap: 4px !important;
            }
            .comp-score-cell-input {
                font-size: 12px !important;
                height: 32px !important;
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
    if (!rawClass) return "Lớp 11A";
    let str = String(rawClass).trim().toLowerCase();

    if (str.includes("11c")) return "Lớp 11C";
    if (str.includes("11a") && !str.includes("hsg")) return "Lớp 11A";
    if (str.includes("10p")) return "Lớp 10P";
    if (str.includes("11e")) return "Lớp 11E";

    if (str.includes("them-10") || str.includes("thêm 10") || str.includes("them 10")) return "Thêm 10";
    if (str.includes("them-11") || str.includes("thêm 11") || str.includes("them 11")) return "Thêm 11";
    if (str.includes("them-12") || str.includes("thêm 12") || str.includes("them 12")) return "Thêm 12";

    return "Thêm 11";
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
    return 30;
}

function ensureTuLuanModalDOM() {
    if (document.getElementById("modal-tuluan-submission")) return;
    const modalDiv = document.createElement("div");
    modalDiv.id = "modal-tuluan-submission";
    modalDiv.className = "move-modal-overlay";
    modalDiv.innerHTML = `
        <div class="tuluan-modal-card" onclick="event.stopPropagation()">
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

            <div class="tuluan-select-bar">
                <div class="tuluan-select-group" style="flex-shrink:0;">
                    <label>🏫 Lớp:</label>
                    <select id="tuluan-class-selector" onchange="onTuLuanClassChanged(this.value)" class="tuluan-class-compact-select" title="Chọn lớp">
                        <option value="lop-11a">Lớp 11A</option>
                        <option value="lop-11c">Lớp 11C</option>
                        <option value="lop-10p">Lớp 10P</option>
                        <option value="lop-11e">Lớp 11E</option>
                        <option value="them-11">Thêm 11</option>
                        <option value="them-10">Thêm 10</option>
                        <option value="them-12">Thêm 12</option>
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

                            <label class="dapan-sched-radio-item" style="display:flex; align-items:center; gap:6px; margin-bottom:6px; cursor:pointer;">
                                <input type="radio" name="dapan-sched-mode" id="sched-mode-now" value="now" checked onchange="onDapAnScheduleModeChanged('now')" style="width:14px; height:14px;">
                                <span style="font-size:11.5px; font-weight:700;">🔓 Mở ngay lập tức</span>
                            </label>

                            <label class="dapan-sched-radio-item" style="display:flex; align-items:center; gap:6px; margin-bottom:6px; cursor:pointer;">
                                <input type="radio" name="dapan-sched-mode" id="sched-mode-auto" value="auto" onchange="onDapAnScheduleModeChanged('auto')" style="width:14px; height:14px;">
                                <span style="font-size:11.5px; font-weight:700;">⏰ Tự động mở vào ngày & giờ quy định:</span>
                            </label>

                            <div id="sched-datetime-input-group" style="display:none; padding-left:20px; margin-bottom:8px;">
                                <input type="datetime-local" id="dapan-sched-datetime" class="dapan-sched-input" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; font-size:11px; font-weight:600; margin-bottom:6px;">
                                <button type="button" class="btn-quick-deadline" onclick="setScheduleToExamDeadline()" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:6px; padding:4px 8px; font-size:10.5px; font-weight:700; cursor:pointer; width:100%;">
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

            <div class="tuluan-toolbar-bar">
                <input type="text" id="tuluan-search-student" class="tuluan-search-box" placeholder="🔍 Tìm tên hoặc SBD..." oninput="filterTuLuanStudentTable()">
                <div class="tuluan-filter-tabs">
                    <button type="button" class="tuluan-tab-pill active" id="tab-filter-all" onclick="filterTuLuanStatus('all')">Tất cả (<span id="count-all-st">0</span>)</button>
                    <button type="button" class="tuluan-tab-pill" id="tab-filter-submitted" onclick="filterTuLuanStatus('submitted')">✅ Đã nộp (<span id="count-sub-st">0</span>)</button>
                    <button type="button" class="tuluan-tab-pill" id="tab-filter-pending" onclick="filterTuLuanStatus('pending')">⏳ Chưa nộp (<span id="count-pen-st">0</span>)</button>
                </div>
            </div>

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
                            <th style="width: 95px; text-align: center;" title="Điểm chấm chéo">Chấm chéo</th>
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

        <!-- LIGHTBOX XEM ẢNH VÀ CHẤM ĐIỂM THÀNH PHẦN -->
        <div id="tuluan-lightbox" class="tuluan-lightbox-overlay" onclick="closeTuLuanLightbox(event)">
            <div class="tuluan-lightbox-content" onclick="event.stopPropagation()">
                <div class="tuluan-lightbox-header">
                    <div class="lightbox-title-wrap">
                        <span id="lightbox-student-title">Ảnh bài làm</span>
                        <span class="lightbox-page-badge" id="lightbox-page-indicator">Tr 1/1</span>
                    </div>

                    <div style="display:flex; gap:6px; align-items:center; position:relative;">
                        <div style="position:relative; display:inline-block;">
                            <button type="button" class="btn-lightbox-component-score" id="btn-open-component-score" onclick="toggleComponentScorePopover(event)" title="Chấm điểm từng câu chi tiết" style="background:#059669; color:#fff; border:none; padding:5px 12px; border-radius:8px; font-weight:800; cursor:pointer;">
                                📊 Điểm TP ▾
                            </button>

                            <div class="component-score-popover" id="component-score-popover" onclick="event.stopPropagation()">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; border-bottom:1.5px solid #f1f5f9; padding-bottom:6px;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="font-size:18px;">📊</span>
                                        <span style="font-size:14px; font-weight:900; color:#059669;">
                                            Chấm Điểm Từng Câu: <span id="comp-score-st-name" style="text-transform:uppercase; color:#065f46;">HỌC SINH</span>
                                        </span>
                                    </div>
                                    <button type="button" onclick="closeComponentScorePopover(event)" style="background:none; border:none; font-size:18px; font-weight:900; color:#94a3b8; cursor:pointer; padding:0 4px;">✕</button>
                                </div>

                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:8px;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <b style="color:#0f172a; font-size:13.5px;">Số câu của đề:</b>
                                        <input type="number" id="comp-score-q-count" min="1" max="120" value="30" 
                                               style="width:58px; height:32px; padding:2px 4px; border:1.8px solid #cbd5e1; border-radius:8px; font-weight:900; text-align:center; font-size:14px; outline:none;"
                                               onchange="onComponentQuestionCountChanged(this.value)">
                                    </div>
                                    <div style="display:flex; gap:5px;">
                                        <button type="button" class="btn-quick-count-pill active" id="btn-count-30" onclick="setQuickQuestionCount(30)">30</button>
                                        <button type="button" class="btn-quick-count-pill" id="btn-count-36" onclick="setQuickQuestionCount(36)">36</button>
                                        <button type="button" class="btn-quick-count-pill" id="btn-count-40" onclick="setQuickQuestionCount(40)">40</button>
                                        <button type="button" class="btn-quick-count-pill" id="btn-count-50" onclick="setQuickQuestionCount(50)">50</button>
                                    </div>
                                </div>

                                <!-- MA TRẬN LƯỚI 10 HOẶC 5 CỘT TÙY MÀN HÌNH -->
                                <div class="comp-score-grid-10" id="comp-score-grid-container"></div>

                                <div style="font-size:12px; color:#475569; font-weight:600; margin:8px 0 10px 0; display:flex; align-items:center; gap:4px;">
                                    <span>💡</span> <span>Nhập dấu chấm (.) hoặc phẩy (,). Nhấn Enter để sang câu tiếp theo.</span>
                                </div>

                                <div class="comp-score-footer-box">
                                    <div class="comp-score-kpi-row">
                                        <div class="comp-score-kpi-badge">
                                            <span>Tổng:</span>
                                            <span class="comp-score-kpi-pill" id="comp-score-total-sum">0.0</span>
                                        </div>

                                        <div class="comp-score-kpi-badge">
                                            <span>Thang 10:</span>
                                            <span class="comp-score-kpi-pill pill-green" id="comp-score-scale10-val">0.0</span>
                                        </div>
                                    </div>

                                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:2px;">
                                        <select id="comp-score-apply-mode" style="padding:6px 12px; border:1.5px solid #cbd5e1; border-radius:9px; font-weight:800; font-size:12.5px; outline:none; background:#ffffff; color:#0f172a; cursor:pointer;">
                                            <option value="scale10" selected>Điểm thang 10</option>
                                            <option value="raw">Điểm cộng dồn</option>
                                        </select>

                                        <button type="button" onclick="saveComponentScoresAction(event)" style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); color:#1e293b; border:1.5px solid #cbd5e1; border-radius:9px; padding:7px 16px; font-weight:900; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(0,0,0,0.06); transition:all 0.15s ease;">
                                            <span>💾</span> <span>Lưu & Đưa ra bảng</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="button" class="btn-close-lightbox" onclick="closeTuLuanLightbox(event)">✕</button>
                    </div>
                </div>

                <div class="tuluan-lightbox-img-box" id="lightbox-touch-area">
                    <button type="button" class="btn-lightbox-nav btn-nav-prev" id="btn-lightbox-prev" onclick="navigateLightbox(-1, event)" title="Xem trang trước (hoặc vuốt sang phải)">
                        ◀
                    </button>
                    <img id="lightbox-full-img" src="" alt="Ảnh bài làm tự luận">
                    <button type="button" class="btn-lightbox-nav btn-nav-next" id="btn-lightbox-next" onclick="navigateLightbox(1, event)" title="Xem trang sau (hoặc vuốt sang trái)">
                        ▶
                    </button>
                </div>

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
    if (typeof refreshTuLuanExamList === 'function') {
        await refreshTuLuanExamList(targetCat, itemId);
    }
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
                        if (typeof navigateLightbox === 'function') navigateLightbox(1);
                    } else {
                        if (typeof navigateLightbox === 'function') navigateLightbox(-1);
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
            if (e.key === "ArrowLeft" && typeof navigateLightbox === 'function') navigateLightbox(-1);
            else if (e.key === "ArrowRight" && typeof navigateLightbox === 'function') navigateLightbox(1);
            else if (e.key === "Escape" && typeof closeTuLuanLightbox === 'function') closeTuLuanLightbox();
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

// ĐĂNG KÝ TOÀN CỤC CÁC HÀM CỐT LÕI
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
window.resetLightboxZoom = resetLightboxZoom;
window.zoomLightboxStep = zoomLightboxStep;
window.setupLightboxTouchAndZoom = setupLightboxTouchAndZoom;
