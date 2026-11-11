// =========================================================
// FILE: portal-results-table.js 
// (BẢN SIÊU HẸP HEADER - TÍCH HỢP NÚT THU BÀI TẠM THỜI QUA REALTIME & GAS)
// =========================================================

let tableDisplaySettings = { fontSize: 13, rowPadding: 9 };
let _liveDoingTickerInterval = null;

let modalCustomZoomLevel = 1.0;
let isFitAllRowsActive = false;

(function injectAttemptDropdownStyles() {
    const styleId = "status-attempt-dropdown-styles";
    if (document.getElementById(styleId)) return;
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
        }

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
        }

        /* NÚT THU BÀI TẠM THỜI RẤT NHỎ TRÊN TOOLBAR */
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
            transform-origin: top center !important;
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

        .result-table.table-fitted-compact {
            --table-row-padding-y: 0px !important;
            --table-row-padding-x: 2px !important;
            width: 100% !important;
        }
        .result-table.table-fitted-compact thead th {
            padding: 2px 2px !important;
            font-size: calc(var(--table-font-size, 12px) - 1px) !important;
            line-height: 1.15 !important;
            border-right: 1px solid #334155 !important;
            border-bottom: 1.5px solid #0284c7 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        .result-table.table-fitted-compact tbody tr {
            height: auto !important;
        }
        .result-table.table-fitted-compact tbody td {
            padding: 0px 2px !important;
            font-size: var(--table-font-size, 12px) !important;
            line-height: 1.15 !important;
            border-right: 1px solid #cbd5e1 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }

        .result-table.table-fitted-compact th.td-stt { width: 34px !important; }
        .result-table.table-fitted-compact th.td-exam-col,
        .result-table.table-fitted-compact th:nth-child(2) { width: 125px !important; }
        .result-table.table-fitted-compact th:nth-child(3) { width: 66px !important; }
        .result-table.table-fitted-compact th:nth-child(4) { width: 110px !important; }
        .result-table.table-fitted-compact th:nth-child(5) { width: 85px !important; }
        .result-table.table-fitted-compact th:nth-child(6) { width: 125px !important; }
        .result-table.table-fitted-compact th:nth-child(7) { width: 55px !important; }
        .result-table.table-fitted-compact th:nth-child(8) { width: 50px !important; }
        .result-table.table-fitted-compact th:nth-child(9) { width: 82px !important; }
        .result-table.table-fitted-compact th:nth-child(10) { width: 68px !important; }
        .result-table.table-fitted-compact th:nth-child(11) { width: 50px !important; }
        .result-table.table-fitted-compact th:nth-child(12) { width: 72px !important; }
        .result-table.table-fitted-compact th:nth-child(13) { width: 65px !important; }
        .result-table.table-fitted-compact th:nth-child(14) { width: 78px !important; }
        .result-table.table-fitted-compact th:nth-child(15) { width: 120px !important; }
        .result-table.table-fitted-compact th.th-force-submit-col { width: 68px !important; }
        .result-table.table-fitted-compact th.th-row-action-col { width: 42px !important; }

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
            display: none; position: absolute !important; top: calc(100% + 4px) !important; left: 0 !important;
            min-width: 255px !important; background: #ffffff !important; border-radius: 12px !important;
            box-shadow: 0 14px 35px rgba(15, 23, 42, 0.22), 0 0 0 1px #cbd5e1 !important;
            border: 1.5px solid #cbd5e1 !important; padding: 8px 10px !important; z-index: 9999999 !important;
            animation: popInBadge 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important; text-align: left !important; white-space: nowrap !important;
        }
        .attempt-dropdown-menu.show { display: flex !important; flex-direction: column !important; gap: 4px !important; }
        .attempt-dropdown-header { font-size: 11px !important; font-weight: 900 !important; color: #334155 !important; text-align: center !important; margin-bottom: 5px !important; }
        .attempt-menu-item { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; padding: 6px 10px !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 700 !important; cursor: pointer !important; }
        .attempt-menu-item:hover { background: #f1f5f9 !important; }
        .attempt-menu-item.selected { background: #ede9fe !important; color: #6d28d9 !important; font-weight: 900 !important; }
    `;
    document.head.appendChild(style);
})();

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
            el.style.zoom = modalCustomZoomLevel;
        } else {
            el.style.transform = `scale(${modalCustomZoomLevel})`;
            el.style.transformOrigin = "top center";
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
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Thu hiện đủ dòng";
    }
    const table = document.getElementById("admin-result-table");
    if (table) table.classList.remove("table-fitted-compact");
    applyModalZoomLevel(modalCustomZoomLevel + step);
}

function resetModalZoom() {
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Thu hiện đủ dòng";
    }
    const table = document.getElementById("admin-result-table");
    if (table) table.classList.remove("table-fitted-compact");
    applyModalZoomLevel(1.0);
}

function fitAllRowsInView(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const scrollWrap = document.querySelector(".result-table-scroll-wrap");
    const table = document.getElementById("admin-result-table");
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (!scrollWrap || !table) return;

    if (isFitAllRowsActive) {
        isFitAllRowsActive = false;
        if (fitBtn) {
            fitBtn.classList.remove("is-fitted");
            fitBtn.innerHTML = "📐 Thu hiện đủ dòng";
        }
        table.classList.remove("table-fitted-compact");
        resetTableSettings();
        applyModalZoomLevel(1.0);
        return;
    }

    table.classList.add("table-fitted-compact");
    tableDisplaySettings.rowPadding = 0;
    applyModalZoomLevel(1.0);

    setTimeout(() => {
        const availH = scrollWrap.clientHeight;
        if (availH <= 0) return;

        const fontCandidates = [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10];
        let chosenFs = 11;
        let chosenZoom = 1.0;
        let foundPerfect = false;

        for (let fs of fontCandidates) {
            table.style.setProperty("--table-font-size", fs + "px");
            table.style.fontSize = fs + "px";

            const unscaledH = table.scrollHeight;
            if (unscaledH <= availH) {
                chosenFs = fs;
                chosenZoom = 1.0;
                foundPerfect = true;
                break;
            }
        }

        if (!foundPerfect) {
            let maxEffectiveSize = 0;
            for (let fs of [12.5, 12, 11.5, 11, 10.5, 10]) {
                table.style.setProperty("--table-font-size", fs + "px");
                table.style.fontSize = fs + "px";
                const unscaledH = table.scrollHeight;
                const reqZoom = Math.floor(((availH - 2) / unscaledH) * 100) / 100;
                const effectiveSize = fs * reqZoom;
                if (effectiveSize > maxEffectiveSize) {
                    maxEffectiveSize = effectiveSize;
                    chosenFs = fs;
                    chosenZoom = Math.min(1.0, Math.max(0.40, reqZoom));
                }
            }
        }

        tableDisplaySettings.fontSize = chosenFs;
        table.style.setProperty("--table-font-size", chosenFs + "px");
        table.style.fontSize = chosenFs + "px";
        applyModalZoomLevel(chosenZoom);

        scrollWrap.scrollTop = 0;
        isFitAllRowsActive = true;

        if (fitBtn) {
            fitBtn.classList.add("is-fitted");
            fitBtn.innerHTML = "↺ Hiện 100%";
        }
    }, 40);
}

// BỔ SUNG NÚT "THU TẠM" & CÁC NÚT ĐIỀU KHIỂN VÀO HEADER MODAL
function ensureModalZoomControlsInHeader() {
    const toolsWrap = document.querySelector(".result-modal-tools");
    if (!toolsWrap) return;

    // 1. NÚT "📋 Thu tạm"
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

    // 2. NÚT "📐 Thu hiện đủ dòng"
    if (!document.getElementById("btn-fit-all-rows")) {
        const fitBtn = document.createElement("button");
        fitBtn.type = "button";
        fitBtn.className = "btn-fit-all-rows";
        fitBtn.id = "btn-fit-all-rows";
        fitBtn.title = "Tự động co tỷ lệ để hiển thị trọn vẹn toàn bộ học sinh trên 1 màn hình mà không cần cuộn chuột";
        fitBtn.innerHTML = "📐 Thu hiện đủ dòng";
        fitBtn.onclick = (e) => fitAllRowsInView(e);

        const closeBtn = toolsWrap.querySelector(".btn-close-result-modal");
        if (closeBtn) {
            toolsWrap.insertBefore(fitBtn, closeBtn);
        } else {
            toolsWrap.appendChild(fitBtn);
        }
    }

    // 3. BỘ ZOOM
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

// =========================================================================
// HÀM XỬ LÝ KHI BẤM NÚT "THU TẠM": GỬI LỆNH REALTIME VÀ PUSH SANG GAS
// =========================================================================
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
        // 1. Phát sóng Realtime TEMP_DRAFT_CAPTURE tới các máy học sinh đang thi
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

        // 2. Phía Admin: Quét đồng thời các bản nháp từ Supabase live_drafts để đẩy bù sang GAS
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

(function setupIsolatedWheelZoom() {
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
        btn.innerHTML = isAutoRefreshEnabled ? "🟢 Tự động: BẬT" : "⚪ Tự động: TẮT";
        btn.style.color = isAutoRefreshEnabled ? "#38bdf8" : "#94a3b8";
        btn.style.borderColor = isAutoRefreshEnabled ? "#38bdf8" : "#64748b";
    }
}

function applyTableSettings() {
    const table = document.getElementById("admin-result-table");
    if (table) {
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

function toggleTableSettingsPopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const popover = document.getElementById("table-settings-popover");
    const btn = document.getElementById("btn-table-settings");
    if (!popover) return;
    if (popover.classList.contains("show")) {
        popover.classList.remove("show");
        if (btn) btn.classList.remove("active");
    } else {
        popover.classList.add("show");
        if (btn) btn.classList.add("active");
    }
}

function closeTableSettingsPopover(event) {
    if (event) event.stopPropagation();
    const popover = document.getElementById("table-settings-popover");
    const btn = document.getElementById("btn-table-settings");
    if (popover) popover.classList.remove("show");
    if (btn) btn.classList.remove("active");
}

function onFontSizeChange(val) { tableDisplaySettings.fontSize = parseInt(val, 10); applyTableSettings(); }
function onRowPaddingChange(val) { tableDisplaySettings.rowPadding = parseInt(val, 10); applyTableSettings(); }

function adjustSetting(type, step) {
    if (type === 'fontSize') { tableDisplaySettings.fontSize = Math.min(22, Math.max(10, tableDisplaySettings.fontSize + step)); } 
    else if (type === 'rowPadding') { tableDisplaySettings.rowPadding = Math.min(26, Math.max(0, tableDisplaySettings.rowPadding + step)); }
    applyTableSettings();
}

function applyFontSizePreset(size) { tableDisplaySettings.fontSize = size; applyTableSettings(); }
function applyRowPaddingPreset(pad) { tableDisplaySettings.rowPadding = pad; applyTableSettings(); }
function resetTableSettings() { tableDisplaySettings.fontSize = 13; tableDisplaySettings.rowPadding = 9; applyTableSettings(); }

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
    if (menu) menu.classList.toggle("show");
}

function toggleRankSortMenu(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById("rank-sort-dropdown-menu");
    if (menu) { menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none"; }
}

function changeRankSort(mode, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    currentRankSortMode = mode;
    const menu = document.getElementById("rank-sort-dropdown-menu");
    if (menu) menu.style.display = "none";
    const btnText = document.getElementById("rank-header-btn-text");
    if (btnText) {
        if (mode === 'desc') btnText.innerHTML = "🏅 Hạng: Cao ➔ Thấp";
        else if (mode === 'asc') btnText.innerHTML = "🏅 Hạng: Thấp ➔ Cao";
        else btnText.innerHTML = "🏅 Xếp hạng ▾";
    }
    filterResultTable();
}

function renderExamPickerDropdown() {
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
            menu.classList.remove("show");
            await switchExamResult(exam);
        };
        menu.appendChild(itemEl);
    });
}

async function switchExamResult(examItem) {
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
    applyModalZoomLevel(modalCustomZoomLevel || 1.0);

    const cacheKey = `${catId}_${item.firebaseId || item.id || item.title}`;
    if (_examResultsCache[cacheKey]) {
        const cached = _examResultsCache[cacheKey];
        renderExamResultTable(catId, cached.submissionsListRaw || cached.submissionsMap || [], cached.cheatingLogsData, cached.activeSessionsData, {}, item, cached.examMeta);
    } else {
        renderExamResultTable(catId, [], {}, {}, {}, item, { examTitle: item.title });
    }

    applyTableSettings();
    renderExamPickerDropdown();
    setTimeout(initTableResizable, 50);

    const effectiveQuizId = extractQuizIdFromItem(item) || item.firebaseId || item.id;
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
    const isShown = targetMenu.classList.contains("show");
    
    document.querySelectorAll('.attempt-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('tr.has-active-attempt-menu').forEach(tr => tr.classList.remove('has-active-attempt-menu'));
    
    if (!isShown) {
        targetMenu.classList.add("show");
        const tr = targetMenu.closest('tr');
        if (tr) tr.classList.add('has-active-attempt-menu');
    }
}

function selectStudentAttempt(rowUid, attemptIdx, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    const row = currentExamResultData.rawRows.find(r => r._rowUid === rowUid);
    if (row && row.allAttempts && row.allAttempts[attemptIdx]) { 
        row.selectedAttemptIndex = attemptIdx; 
        const sbdKey = String(row.account?.sbd || "").trim().toLowerCase();
        if (sbdKey && typeof window._userSelectedAttemptsBySbd !== 'undefined') {
            window._userSelectedAttemptsBySbd[sbdKey] = attemptIdx;
        }
        calculateRanksForRows(currentExamResultData.rawRows); 
        filterResultTable(); 
    }
}

function deleteResultRowPermanently(rowUid, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
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

function startLiveDoingTicker() {
    if (_liveDoingTickerInterval) clearInterval(_liveDoingTickerInterval);
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

function renderFilteredResultTable(rows) {
    ensureActionColumnHeaders();
    ensureModalZoomControlsInHeader();
    const table = document.getElementById("admin-result-table");
    const tbody = document.getElementById("result-table-tbody"); 
    if (!tbody || !table) return; 
    tbody.innerHTML = "";

    if (isFitAllRowsActive) {
        table.classList.add("table-fitted-compact");
    }

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; font-weight:700; color:#64748b;">Không tìm thấy dữ liệu học sinh nào!</td></tr>`;
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
        let col_examName = `<div class="td-exam-text" title="${currentExamTitle}">${currentExamTitle}</div>`;
        let col_attemptCount = `<span class="status-not-submitted">---</span>`;

        if (attCount === 0) {
            if (row.isDoing) {
                col_attemptCount = `<span class="status-doing-heartbeat" style="font-size:11px; padding:3px 8px;" title="Học sinh đang trong phòng thi">💓 Đang thi</span>`;
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
                    <div class="attempt-menu-item ${isSelected ? 'selected' : ''}" onclick="selectStudentAttempt('${uid}', ${aIdx}, event)">
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
                    <button type="button" class="${btnClass}" onclick="toggleAttemptMenu('${uid}', event)" title="Bấm để chọn xem lần thi">
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
                col11_details = `<span class="td-details" title="${safeText}" onclick="alert('📋 CHI TIẾT BÀI LÀM (LẦN ${row.selectedAttemptIndex + 1}):\\n\\n' + this.title.replace(/ \\| /g, '\\n'))">${currentSub.dataString}</span>`;
            }
        }

        if (row.isDoing) {
            let startMs = row.doingStartTime || Date.now();
            let formattedIn = formatDateTimeFull(startMs);
            let liveDuration = formatElapsedDuration(startMs);

            if (!currentSub) {
                col2_inTime = `<span style="color:#7e22ce; font-weight:800; font-family:monospace;">${formattedIn}</span>`;
                col3_spentTime = `<span class="live-doing-timer-pill" title="Thời gian đang thi (tự động đếm)"><span class="timer-clock-icon">⏱</span> <span class="live-doing-timer-val" data-starttime="${startMs}">${liveDuration}</span></span>`;
                col6_status = row.isFreeDoing 
                    ? `<span class="status-doing-heartbeat free-mode"><span class="heartbeat-icon">💜</span> Đang thi-tự do</span>` 
                    : `<span class="status-doing-heartbeat"><span class="heartbeat-icon">💜</span> Đang thi</span>`;
            } else {
                col6_status = `<span class="status-doing-heartbeat" title="Đang làm bài lần ${attCount + 1}"><span class="heartbeat-icon">💜</span> Đang thi Lần ${attCount + 1}</span>`;
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
        
        let col_force_submit = `
            <button type="button" class="btn-force-submit-item" 
                    onclick="sendForceSubmitCommand('${col5_sbd}', '${rawName.replace(/'/g, "\\'")}')" 
                    title="Gửi lệnh ép nộp bài ngay lập tức tới máy em này">
                ⚡ Thu ép
            </button>
        `;

        let col_action = `<button type="button" class="btn-delete-result-row" onclick="deleteResultRowPermanently('${uid}', event)" title="Ẩn tạm thời dòng này khỏi bảng" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:2px 6px; font-size:10.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:2px; transition:0.15s;">🗑️</button>`;

        tr.innerHTML = `
            <td class="td-stt">${col1_stt}</td>
            <td class="td-exam-col" title="${currentExamTitle}">${col_examName}</td>
            <td class="td-attempt-cell-wrap">${col_attemptCount}</td>
            <td class="td-truncate" title="${stripHtml(col2_inTime)}">${col2_inTime}</td>
            <td class="td-truncate" title="${stripHtml(col3_spentTime)}">${col3_spentTime}</td>
            <td class="td-truncate" title="${rawName}">${col4_name}</td>
            <td class="td-class td-truncate" title="${rawClass}">${col_class}</td>
            <td class="td-sbd td-truncate" title="${col5_sbd}">${col5_sbd}</td>
            <td style="text-align:center;">${col6_status}</td>
            <td style="text-align:center;">${col7_correct}</td>
            <td class="td-score">${col8_score}</td>
            <td style="text-align:center;">${col_rank}</td>
            <td class="td-tabs">${col9_tabs}</td>
            <td class="td-tab-times td-truncate" title="${safeTitleCol10}">${col10_cheatTime}</td>
            <td class="td-truncate">${col11_details}</td>
            <td style="text-align:center;">${col_force_submit}</td>
            <td style="text-align:center;">${col_action}</td>
        `;
        tbody.appendChild(tr);
    });

    startLiveDoingTicker();
}

function filterResultTable() {
    const query = (document.getElementById("result-search-input").value || "").trim().toLowerCase();
    if (!query) { renderFilteredResultTable(currentExamResultData.rawRows); return; }

    const filtered = currentExamResultData.rawRows.filter(r => {
        let name = (r.account.name || "").toLowerCase(); 
        let sbd = String(r.account.sbd || "").toLowerCase(); 
        let cName = String(r.account.className || "").toLowerCase();
        let statusText = r.isDoing ? "đang thi" : (r.allAttempts.length > 0 ? "đã nộp bài" : (r.isFreeDoing ? "đang thi tự do" : "chưa thi"));
        let rankText = (r.rank !== null && r.rank !== undefined) ? `hạng ${r.rank}` : "";
        return name.includes(query) || sbd.includes(query) || cName.includes(query) || statusText.includes(query) || rankText.includes(query);
    });
    renderFilteredResultTable(filtered);
}

document.addEventListener("click", function(event) {
    if (!event.target.closest('.attempt-picker-wrapper')) {
        document.querySelectorAll('.attempt-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('tr.has-active-attempt-menu').forEach(tr => tr.classList.remove('has-active-attempt-menu'));
    }
});

window.toggleAttemptMenu = toggleAttemptMenu;
window.selectStudentAttempt = selectStudentAttempt;
window.adjustModalZoomStep = adjustModalZoomStep;
window.resetModalZoom = resetModalZoom;
window.applyModalZoomLevel = applyModalZoomLevel;
window.fitAllRowsInView = fitAllRowsInView;
window.renderFilteredResultTable = renderFilteredResultTable;
window.filterResultTable = filterResultTable;
window.sendForceSubmitCommand = sendForceSubmitCommand;
window.triggerCollectTempDraftsToDrive = triggerCollectTempDraftsToDrive;
