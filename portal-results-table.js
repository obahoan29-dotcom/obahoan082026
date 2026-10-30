// =========================================================
// FILE: portal-results-table.js 
// (BẢN TỐI ƯU HIỂN THỊ ĐỦ SỐ LẦN THI, DROPDOWN XÒE TỪNG LẦN & ĐIỂM, XEM CHI TIẾT LẦN CHỌN)
// =========================================================

let tableDisplaySettings = { fontSize: 13, rowPadding: 9 };
let _liveDoingTickerInterval = null;

let modalCustomZoomLevel = 1.0;
let isFitAllRowsActive = false;

(function injectHeartbeatDoingStyles() {
    const styleId = "status-doing-heartbeat-styles";
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
            padding: 4px 12px !important;
            min-height: 36px !important;
            gap: 6px !important;
            background: #ffffff !important;
            border-bottom: 1.5px solid #e2e8f0 !important;
        }

        .result-modal-title-box {
            gap: 6px !important;
            min-width: 0 !important;
            flex: 1 !important;
        }

        #btn-result-back-action {
            padding: 3px 8px !important;
            font-size: 11px !important;
            border-radius: 7px !important;
            height: 26px !important;
        }

        .result-modal-icon {
            width: 26px !important;
            height: 26px !important;
            font-size: 14px !important;
            border-radius: 6px !important;
        }

        .result-modal-heading {
            font-size: 13px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
            font-weight: 900 !important;
        }

        .result-modal-subheading {
            font-size: 10px !important;
            line-height: 1.15 !important;
            margin-top: 1px !important;
            color: #64748b !important;
        }

        .result-modal-tools {
            gap: 4px !important;
        }

        .result-search-input {
            padding: 3px 8px !important;
            height: 26px !important;
            font-size: 11px !important;
            width: 125px !important;
            border-radius: 14px !important;
        }
        .result-search-input:focus {
            width: 150px !important;
        }

        #btn-toggle-autorefresh,
        .btn-refresh-result,
        .btn-regrade-exam,
        .btn-upload-json-backup,
        .btn-export-excel {
            padding: 3px 8px !important;
            font-size: 11px !important;
            height: 26px !important;
            border-radius: 14px !important;
        }

        .btn-table-settings,
        .btn-close-result-modal {
            width: 26px !important;
            height: 26px !important;
            font-size: 14px !important;
        }

        .result-modal-stats-bar {
            padding: 2px 10px !important;
            font-size: 10.5px !important;
            min-height: 24px !important;
            gap: 4px !important;
            background: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
        }

        .result-modal-stats-bar .stat-badge-item {
            padding: 1px 5px !important;
            font-size: 10px !important;
            border-radius: 6px !important;
        }

        #btn-view-detailed-stats {
            padding: 2px 8px !important;
            font-size: 10px !important;
            border-radius: 10px !important;
        }

        .result-modal-body {
            padding: 4px 6px !important;
            transform-origin: top center !important;
            transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .result-table-card {
            border-radius: 8px !important;
        }

        .btn-fit-all-rows {
            background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%) !important;
            color: #ffffff !important;
            border: 1px solid #5eead4 !important;
            border-radius: 14px !important;
            padding: 3px 9px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            box-shadow: 0 2px 6px rgba(13, 148, 136, 0.25) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
            user-select: none !important;
            height: 26px !important;
            font-family: inherit !important;
        }
        .btn-fit-all-rows:hover {
            filter: brightness(1.12) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 10px rgba(13, 148, 136, 0.4) !important;
        }
        .btn-fit-all-rows:active {
            transform: translateY(1.5px) scale(0.96) !important;
        }
        .btn-fit-all-rows.is-fitted {
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%) !important;
            border-color: #fdba74 !important;
            box-shadow: 0 2px 6px rgba(234, 88, 12, 0.35) !important;
        }

        .modal-independent-zoom-control {
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            background: #1e293b !important;
            border: 1.5px solid #475569 !important;
            border-radius: 20px !important;
            padding: 2px 4px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
            user-select: none !important;
            height: 26px !important;
            box-sizing: border-box !important;
        }
        .btn-modal-zoom-step {
            width: 20px !important;
            height: 20px !important;
            border-radius: 50% !important;
            border: none !important;
            background: #334155 !important;
            color: #ffffff !important;
            font-size: 12px !important;
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
            transform: scale(1.1) !important;
        }
        .btn-modal-zoom-step:active {
            transform: scale(0.92) !important;
        }
        .modal-zoom-val-badge {
            font-size: 10.5px !important;
            font-weight: 800 !important;
            color: #38bdf8 !important;
            padding: 0 5px !important;
            min-width: 38px !important;
            text-align: center !important;
            font-family: 'Be Vietnam Pro', monospace !important;
            cursor: pointer !important;
        }
        .modal-zoom-val-badge:hover {
            text-decoration: underline !important;
        }

        @keyframes heartbeatDoing {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.65), 0 0 10px rgba(192, 132, 252, 0.5); }
            14% { transform: scale(1.13); box-shadow: 0 0 18px 5px rgba(168, 85, 247, 0.85), 0 0 30px rgba(147, 51, 234, 0.7); }
            28% { transform: scale(1.02); box-shadow: 0 0 8px 2px rgba(168, 85, 247, 0.5), 0 0 16px rgba(192, 132, 252, 0.4); }
            42% { transform: scale(1.18); box-shadow: 0 0 22px 6px rgba(147, 51, 234, 0.95), 0 0 38px rgba(126, 34, 206, 0.8); }
            70% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0), 0 0 8px rgba(192, 132, 252, 0.25); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0), 0 0 8px rgba(192, 132, 252, 0.25); }
        }

        @keyframes heartIconRotate {
            0%, 100% { transform: scale(1) rotate(0deg); }
            14% { transform: scale(1.3) rotate(-12deg); }
            28% { transform: scale(1.05) rotate(0deg); }
            42% { transform: scale(1.35) rotate(12deg); }
            70% { transform: scale(1) rotate(0deg); }
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

        .status-doing-heartbeat .heartbeat-icon {
            display: inline-block !important;
            font-size: 15px !important;
            line-height: 1 !important;
            animation: heartIconRotate 1.35s infinite ease-in-out !important;
            filter: drop-shadow(0 0 5px rgba(168, 85, 247, 0.85)) !important;
        }

        tr.row-student-is-doing td { background-color: #faf5ff !important; }
        tr.row-student-is-doing:hover td { background-color: #f3e8ff !important; }
        tr.row-student-is-doing .td-stt {
            background-color: #e9d5ff !important;
            color: #581c87 !important;
            font-weight: 900 !important;
        }

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
        .live-doing-timer-pill .timer-clock-icon {
            font-size: 12.5px !important;
            line-height: 1 !important;
            animation: heartIconRotate 2s infinite ease-in-out !important;
        }
        .live-doing-timer-val {
            font-variant-numeric: tabular-nums !important;
            letter-spacing: 0.2px !important;
        }

        .attempt-badge-doing {
            display: inline-block !important;
            background: #faf5ff !important;
            color: #6b21a8 !important;
            border: 1.2px solid #c084fc !important;
            padding: 3px 8px !important;
            border-radius: 12px !important;
            font-size: 0.9em !important;
            font-weight: 800 !important;
        }

        .btn-force-submit-row {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            color: #ffffff !important;
            border: 1px solid #fde68a !important;
            border-radius: 8px !important;
            padding: 3px 7px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            box-shadow: 0 1px 4px rgba(245, 158, 11, 0.3) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
        }
        .btn-force-submit-row:hover { filter: brightness(1.12) !important; transform: translateY(-1px) !important; }
        .btn-force-submit-row:active { transform: translateY(2px) scale(0.95) !important; }

        .btn-force-submit-header {
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%) !important;
            color: #ffffff !important;
            border: 1px solid #fdba74 !important;
            border-radius: 7px !important;
            padding: 2px 6px !important;
            font-size: 10px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
            text-transform: none !important;
        }
        .btn-force-submit-header:hover { filter: brightness(1.15) !important; }

        /* NÂNG CẤP MENU DROPDOWN CHỌN LẦN THI ĐA DÒNG */
        .td-attempt-cell-wrap {
            position: relative !important;
            overflow: visible !important;
            z-index: 50 !important;
        }
        .btn-attempt-trigger {
            background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important;
            color: #ffffff !important;
            border: 1.2px solid #a5b4fc !important;
            padding: 3px 9px !important;
            border-radius: 12px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25) !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            transition: all 0.15s ease !important;
        }
        .btn-attempt-trigger:hover {
            filter: brightness(1.15) !important;
            transform: translateY(-1px) !important;
        }
        .attempt-dropdown-menu {
            display: none;
            position: absolute;
            top: calc(100% + 4px);
            left: 50%;
            transform: translateX(-50%);
            min-width: 210px;
            background: #ffffff;
            border: 1.5px solid #818cf8;
            border-radius: 12px;
            box-shadow: 0 16px 36px rgba(15, 23, 42, 0.35);
            padding: 6px;
            z-index: 9999999 !important;
            text-align: left;
            animation: popInBadge 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .attempt-dropdown-menu.show {
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
        }
        .attempt-menu-item {
            padding: 7px 10px !important;
            border-radius: 8px !important;
            font-size: 11.5px !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            transition: 0.15s !important;
            border: 1px solid transparent !important;
        }
        .attempt-menu-item:hover {
            background: #f0fdf4 !important;
            border-color: #86efac !important;
            color: #166534 !important;
        }
        .attempt-menu-item.selected {
            background: #e0f2fe !important;
            border-color: #38bdf8 !important;
            color: #0369a1 !important;
            font-weight: 900 !important;
        }
    `;
    document.head.appendChild(style);
})();

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
    applyModalZoomLevel(modalCustomZoomLevel + step);
}

function resetModalZoom() {
    isFitAllRowsActive = false;
    const fitBtn = document.getElementById("btn-fit-all-rows");
    if (fitBtn) {
        fitBtn.classList.remove("is-fitted");
        fitBtn.innerHTML = "📐 Thu hiện đủ dòng";
    }
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
        resetTableSettings();
        applyModalZoomLevel(1.0);
        return;
    }

    tableDisplaySettings.rowPadding = 2;
    tableDisplaySettings.fontSize = 11;
    applyTableSettings();

    setTimeout(() => {
        const availH = scrollWrap.clientHeight;
        const currentZoom = modalCustomZoomLevel || 1.0;
        const unscaledH = table.scrollHeight / currentZoom;

        if (availH > 0 && unscaledH > 0) {
            let targetZoom = Math.floor(((availH - 4) / unscaledH) * 100) / 100;
            targetZoom = Math.min(1.0, Math.max(0.40, targetZoom));
            applyModalZoomLevel(targetZoom);
            scrollWrap.scrollTop = 0;
            isFitAllRowsActive = true;
            if (fitBtn) {
                fitBtn.classList.add("is-fitted");
                fitBtn.innerHTML = "↺ Hiện 100%";
            }
        }
    }, 40);
}

function ensureModalZoomControlsInHeader() {
    const toolsWrap = document.querySelector(".result-modal-tools");
    if (!toolsWrap) return;

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
            let curSub = r.allAttempts[r.selectedAttemptIndex] || r.allAttempts[r.allAttempts.length - 1];
            if (curSub && curSub.score10 !== undefined) {
                let sc = parseFloat(curSub.score10);
                if (!isNaN(sc)) scores.push(sc);
            }
        }
    });

    rows.forEach(r => {
        r.rank = null;
        if (r.allAttempts.length > 0) {
            let curSub = r.allAttempts[r.selectedAttemptIndex] || r.allAttempts[r.allAttempts.length - 1];
            if (curSub && curSub.score10 !== undefined) {
                let sc = parseFloat(curSub.score10);
                if (!isNaN(sc)) r.rank = scores.filter(s => s > sc).length + 1;
            }
        }
    });
}

// BỘ CHỌN LẦN THI VÀ CẬP NHẬT TỨC THÌ DÒNG HỌC SINH ĐÓ
function selectStudentAttempt(rowUid, attemptIdx, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    const row = currentExamResultData.rawRows.find(r => r._rowUid === rowUid);
    if (row && row.allAttempts && row.allAttempts[attemptIdx]) { 
        row.selectedAttemptIndex = attemptIdx; 
        calculateRanksForRows(currentExamResultData.rawRows); 
        filterResultTable(); 
    }
}

function toggleAttemptMenu(rowUid, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    const menu = document.getElementById(`attempt-menu-${rowUid}`); 
    const btn = document.getElementById(`attempt-btn-${rowUid}`);
    const isShown = menu && menu.classList.contains("show");
    
    document.querySelectorAll('.attempt-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.btn-attempt-trigger.active').forEach(b => b.classList.remove('active'));
    
    if (!isShown && menu) { 
        menu.classList.add("show"); 
        if (btn) btn.classList.add("active"); 
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

function ensureActionColumnHeaders() {
    const table = document.getElementById("admin-result-table");
    if (!table) return; 
    const theadTr = table.querySelector("thead tr"); 
    if (!theadTr) return;

    let thForce = theadTr.querySelector(".th-force-submit-col");
    let thDel = theadTr.querySelector(".th-row-action-col");

    if (!thDel) {
        thDel = document.createElement("th");
        thDel.className = "th-row-action-col";
        thDel.style.width = "75px";
        thDel.style.textAlign = "center";
        thDel.innerText = "XÓA";
        theadTr.appendChild(thDel);
    }

    if (!thForce) {
        thForce = document.createElement("th");
        thForce.className = "th-force-submit-col";
        thForce.style.width = "95px";
        thForce.style.textAlign = "center";
        thForce.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span style="font-size:11px;">Thu ép</span>
                <button type="button" class="btn-force-submit-header" onclick="forceSubmitAllDoingStudents(event)" title="Thu ép bài toàn bộ thí sinh đang thi ngay lập tức">
                    ⚡ Thu tất cả
                </button>
            </div>
        `;
        theadTr.insertBefore(thForce, thDel);
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

// BỘ VẼ BẢNG KẾT QUẢ: HỌC SINH THI MẤY LẦN HIỆN RÕ BẤY NHIÊU LẦN, CLICK LẦN NÀO HIỆN CHI TIẾT LẦN ĐÓ
function renderFilteredResultTable(rows) {
    ensureActionColumnHeaders();
    ensureModalZoomControlsInHeader();
    const tbody = document.getElementById("result-table-tbody"); 
    if (!tbody) return; 
    tbody.innerHTML = "";

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
        
        // Đảm bảo selectedAttemptIndex luôn hợp lệ
        if (attCount > 0) {
            if (row.selectedAttemptIndex === undefined || row.selectedAttemptIndex === null || row.selectedAttemptIndex >= attCount || row.selectedAttemptIndex < 0) {
                row.selectedAttemptIndex = attCount - 1;
            }
        } else {
            row.selectedAttemptIndex = 0;
        }

        const currentSub = attCount > 0 ? row.allAttempts[row.selectedAttemptIndex] : null;
        const uid = row._rowUid || `row_${rowIdx}`;

        if (row.isDoing) {
            tr.classList.add("row-student-is-doing");
        }

        let col1_stt = row.stt;
        let col_examName = `<div class="td-exam-text" title="${currentExamTitle}">${currentExamTitle}</div>`;
        let col_attemptCount = `<span class="status-not-submitted">Chưa thi</span>`;

        // 1. TẠO GIAO DIỆN CỘT "SỐ LẦN THI": NẾU THI >= 1 LẦN THÌ HIỆN DROPDOWN XÒE RA TỪNG LẦN KÈM ĐIỂM
        if (attCount === 0) {
            if (row.isDoing) {
                col_attemptCount = `<span class="attempt-badge-doing">Đang thi Lần 1</span>`;
            } else {
                col_attemptCount = `<span class="status-not-submitted">Chưa thi</span>`;
            }
        } else if (attCount === 1 && !row.isDoing) {
            // Thi đúng 1 lần và không đang thi tiếp
            col_attemptCount = `<span class="attempt-badge-single" title="Đã thi 1 lần">1 lần</span>`;
        } else {
            // Thi từ 2 lần trở lên (hoặc 1 lần + đang thi lần 2)
            let menuItemsHtml = "";
            row.allAttempts.forEach((at, aIdx) => {
                let sc = at.score10 !== undefined ? at.score10 : "--";
                let tm = at.timestamp ? (at.timestamp.split(' - ')[1] || at.timestamp) : `Lần ${aIdx + 1}`;
                let isSel = aIdx === row.selectedAttemptIndex;
                menuItemsHtml += `
                    <div class="attempt-menu-item ${isSel ? 'selected' : ''}" onclick="selectStudentAttempt('${uid}', ${aIdx}, event)" title="Bấm để xem chi tiết bài làm lần ${aIdx + 1}">
                        <span>${isSel ? '✓ ' : ''}<b>Lần ${aIdx + 1}</b> (${tm})</span>
                        <span style="color:#0284c7; font-weight:900; background:#f0f9ff; padding:2px 6px; border-radius:6px; border:1px solid #bae6fd;">${sc}đ</span>
                    </div>
                `;
            });

            const doingBadgeText = row.isDoing ? ` (Đang thi Lần ${attCount + 1})` : "";
            col_attemptCount = `
                <div class="td-attempt-cell">
                    <button type="button" class="btn-attempt-trigger" id="attempt-btn-${uid}" onclick="toggleAttemptMenu('${uid}', event)" title="Nhấn vào để xem danh sách ${attCount} lần thi và chọn lần muốn xem">
                        <b>${attCount} lần</b>${doingBadgeText} ▾
                    </button>
                    <div class="attempt-dropdown-menu" id="attempt-menu-${uid}">
                        <div style="font-size:11px; font-weight:800; color:#475569; padding:4px 8px; border-bottom:1.5px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                            <span>📑 CÁC LẦN THI ĐÃ NỘP:</span>
                            <span style="color:#6366f1;">(Đang xem Lần ${row.selectedAttemptIndex + 1})</span>
                        </div>
                        ${menuItemsHtml}
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
        let col_forceSubmit = `<span style="color:#cbd5e1; font-weight:700;">---</span>`;

        // 2. HIỂN THỊ DỮ LIỆU CỦA LẦN ĐANG ĐƯỢC CHỌN (selectedAttemptIndex)
        if (currentSub) {
            let subDateMs = getSubmissionTimestamp(currentSub);
            col2_inTime = `<span style="font-family:monospace; font-weight:700; color:#0369a1;">${subDateMs ? formatDateTimeFull(subDateMs) : (currentSub.timestamp || "---")}</span>`;
            col3_spentTime = `<span style="color:#0f766e; font-weight:700;">${currentSub.completionTime || `${currentSub.spentMins || 0} phút`}</span>`;
            
            const attemptLabel = attCount > 1 ? ` (Lần ${row.selectedAttemptIndex + 1})` : "";
            col6_status = `<span class="status-pill status-done">✓ Đã nộp${attemptLabel}</span>`;
            
            let cCount = (currentSub.correctCount !== undefined) ? currentSub.correctCount : 0;
            col7_correct = `<span style="font-weight:900; color:#15803d;">${cCount} câu</span>`;

            let sc = (currentSub.score10 !== undefined) ? currentSub.score10 : 0;
            let scNum = parseFloat(sc) || 0;
            let pillClass = scNum >= 8.0 ? 'score-pill-high' : (scNum >= 5.0 ? 'score-pill-mid' : 'score-pill-low');
            col8_score = `<span class="${pillClass}">${scNum.toFixed(1)}</span>`;

            if (row.rank !== null && row.rank !== undefined) {
                let rankNum = row.rank; 
                let rankBadge = "";
                if (rankNum === 1) { rankBadge = `<span style="background: linear-gradient(135deg, #fef08a, #fde047); color: #854d0e; border: 1.5px solid #eab308; padding: 3px 8px; border-radius: 12px; font-weight: 900; font-size: 0.95em; box-shadow: 0 2px 6px rgba(234,179,8,0.25);">🥇 Hạng 1</span>`; } 
                else if (rankNum === 2) { rankBadge = `<span style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); color: #334155; border: 1.5px solid #94a3b8; padding: 3px 8px; border-radius: 12px; font-weight: 900; font-size: 0.95em; box-shadow: 0 2px 6px rgba(148,163,184,0.2);">🥈 Hạng 2</span>`; } 
                else if (rankNum === 3) { rankBadge = `<span style="background: linear-gradient(135deg, #ffedd5, #fed7aa); color: #9a3412; border: 1.5px solid #fb923c; padding: 3px 8px; border-radius: 12px; font-weight: 900; font-size: 0.95em; box-shadow: 0 2px 6px rgba(251,146,60,0.2);">🥉 Hạng 3</span>`; } 
                else { rankBadge = `<span style="background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 10px; font-weight: 800; font-size: 0.92em;">Hạng ${rankNum}</span>`; }
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

        // 3. NẾU ĐANG LÀM BÀI TRONG PHÒNG THI THÌ BỔ SUNG TRẠNG THÁI "ĐANG THI" VÀ NÚT THU ÉP
        if (row.isDoing) {
            let startMs = row.doingStartTime || Date.now();
            let formattedIn = formatDateTimeFull(startMs);
            let liveDuration = formatElapsedDuration(startMs);

            // Nếu chưa có bài nộp nào thì mới gán thời gian đang làm vào cột chính
            if (!currentSub) {
                col2_inTime = `<span style="color:#7e22ce; font-weight:800; font-family:monospace;">${formattedIn}</span>`;
                col3_spentTime = `<span class="live-doing-timer-pill" title="Thời gian đang thi (tự động đếm)"><span class="timer-clock-icon">⏱</span> <span class="live-doing-timer-val" data-starttime="${startMs}">${liveDuration}</span></span>`;
                col6_status = row.isFreeDoing 
                    ? `<span class="status-doing-heartbeat free-mode"><span class="heartbeat-icon">💜</span> Đang thi-tự do</span>` 
                    : `<span class="status-doing-heartbeat"><span class="heartbeat-icon">💜</span> Đang thi</span>`;
            } else {
                // Đã có bài nộp cũ và đang thi lần tiếp theo: hiển thị trạng thái đang thi ở tình trạng
                col6_status = `<span class="status-doing-heartbeat" title="Đang làm bài lần ${attCount + 1}"><span class="heartbeat-icon">💜</span> Đang thi Lần ${attCount + 1}</span>`;
            }

            let doingTabs = row.cheatLogsTabCount || 0;
            if (doingTabs > 0) col9_tabs = `<span class="tabs-warn">⚠️ ${doingTabs} lần</span>`;
            if (row.cheatTimeString !== "0s") col10_cheatTime = row.cheatTimeString;

            col_forceSubmit = `<button type="button" class="btn-force-submit-row" onclick="forceSubmitSingleStudent('${uid}', event)" title="Thu ép bài học sinh này ngay lập tức">⚡ Thu ép</button>`;
        }

        let rawName = acc.name || (currentSub ? currentSub.studentName : "---");
        let freeTagHtml = (!row.isClassStudent) ? `<span class="tag-free-student">Tự do</span>` : '';
        let col4_name = `<span class="td-name">${rawName}</span>${freeTagHtml}`;
        let rawClass = acc.className || (currentSub ? (currentSub.studentClass || currentSub.className) : "") || "---";
        let col_class = `<span class="class-badge">${rawClass}</span>`;
        let col5_sbd = acc.sbd || (currentSub ? (currentSub.sbd || currentSub.studentId) : "---");
        let safeTitleCol10 = stripHtml(col10_cheatTime);
        let col_action = `<button type="button" class="btn-delete-result-row" onclick="deleteResultRowPermanently('${uid}', event)" title="Ẩn tạm thời dòng này khỏi bảng" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:8px; padding:3px 8px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:2px; transition:0.15s; box-shadow:0 1px 3px rgba(239,68,68,0.15);">🗑️ Xóa</button>`;

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
            <td style="text-align:center;">${col_forceSubmit}</td>
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

// BỘ ĐÓNG DROPDOWN KHI CLICK RA NGOÀI BẢNG
document.addEventListener("click", function(event) {
    if (!event.target.closest('.td-attempt-cell')) {
        document.querySelectorAll('.attempt-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.btn-attempt-trigger.active').forEach(b => b.classList.remove('active'));
    }
});

// ĐĂNG KÝ HÀM TOÀN CỤC
window.selectStudentAttempt = selectStudentAttempt;
window.toggleAttemptMenu = toggleAttemptMenu;
window.adjustModalZoomStep = adjustModalZoomStep;
window.resetModalZoom = resetModalZoom;
window.applyModalZoomLevel = applyModalZoomLevel;
window.fitAllRowsInView = fitAllRowsInView;
window.renderFilteredResultTable = renderFilteredResultTable;
window.filterResultTable = filterResultTable;
