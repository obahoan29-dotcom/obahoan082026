// =========================================================
// FILE: portal-results-cheat-inspector.js (FILE MỚI TINH - TỰ TÍCH HỢP)
// TRUNG TÂM GIÁM SÁT CHUYỂN TAB & CHỐNG GIAN LẬN TOÀN PHÒNG THI:
// 1. TỰ ĐỘNG THÊM NÚT "🕵️ Soi tab" TRÊN THANH CÔNG CỤ MODAL KẾT QUẢ
// 2. XẾP HẠNG HỌC SINH CHUYỂN TAB NHIỀU NHẤT + TỔNG THỜI GIAN RỜI PHÒNG
// 3. PHÂN LOẠI MỨC ĐỘ NGHI VẤN, COPY BÁO CÁO ZALO & XUẤT EXCEL RIÊNG
// =========================================================

(function initResultCheatInspectorModule() {
    if (typeof window === "undefined") return;

    function injectCheatInspectorStyles() {
        const styleId = "portal-cheat-inspector-styles";
        if (document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            .btn-cheat-inspector-trigger {
                background: linear-gradient(135deg, #e11d48 0%, #be123c 100%) !important;
                color: #ffffff !important;
                border: 1px solid #fda4af !important;
                border-radius: 11px !important;
                padding: 2px 8px !important;
                font-size: 10.5px !important;
                font-weight: 800 !important;
                height: 22px !important;
                line-height: 1 !important;
                cursor: pointer !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;
                white-space: nowrap !important;
                box-shadow: 0 1px 4px rgba(225, 29, 72, 0.3) !important;
                font-family: inherit !important;
                transition: all 0.15s ease !important;
            }
            .btn-cheat-inspector-trigger:hover {
                filter: brightness(1.1) !important;
                transform: translateY(-1px) !important;
            }
            .cheat-ins-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.76);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                z-index: 2147483060;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 14px;
                font-family: 'Be Vietnam Pro', sans-serif;
            }
            .cheat-ins-overlay.show {
                display: flex;
                animation: fadeInModal 0.18s ease-out;
            }
            .cheat-ins-card {
                background: #ffffff;
                width: min(940px, 96vw);
                max-height: 90vh;
                border-radius: 16px;
                border: 1.5px solid #cbd5e1;
                box-shadow: 0 25px 65px rgba(15, 23, 42, 0.45);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .cheat-ins-header {
                background: linear-gradient(135deg, #881337 0%, #be123c 100%);
                color: #ffffff;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            .cheat-ins-kpi-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 8px;
                padding: 12px 16px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            .cheat-ins-kpi-box {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 8px 10px;
            }
            .cheat-ins-kpi-box small {
                display: block;
                font-size: 10.5px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
            }
            .cheat-ins-kpi-box b {
                display: block;
                font-size: 15px;
                font-weight: 900;
                color: #0f172a;
                margin-top: 2px;
            }
            .cheat-ins-body {
                flex: 1;
                overflow: auto;
                padding: 12px 16px;
            }
            .cheat-ins-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12.5px;
            }
            .cheat-ins-table th {
                position: sticky;
                top: 0;
                background: #0f172a;
                color: #ffffff;
                padding: 8px 10px;
                text-align: left;
                font-weight: 800;
                font-size: 11.5px;
                z-index: 5;
            }
            .cheat-ins-table td {
                padding: 8px 10px;
                border-bottom: 1px solid #e2e8f0;
                vertical-align: middle;
            }
            .cheat-ins-table tr:nth-child(even) td {
                background: #f8fafc;
            }
            .cheat-level-pill {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
            }
            .cheat-level-high { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
            .cheat-level-mid { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
            .cheat-level-low { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .cheat-ins-footer {
                padding: 10px 16px;
                background: #ffffff;
                border-top: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: wrap;
            }
        `;
        document.head.appendChild(style);
    }

    function formatTotalSecondsReadable(totalSec) {
        const s = Math.max(0, Math.round(Number(totalSec) || 0));
        if (s === 0) return "0s";
        const m = Math.floor(s / 60);
        const rem = s % 60;
        if (m === 0) return `${rem}s`;
        return rem > 0 ? `${m}p ${rem}s` : `${m}p`;
    }

    function escapeCheatHtml(str) {
        return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function collectCheatInspectorRows() {
        const rawRows = (typeof currentExamResultData !== "undefined" && Array.isArray(currentExamResultData.rawRows))
            ? currentExamResultData.rawRows : [];

        const list = [];
        rawRows.forEach(r => {
            if (!r) return;
            const attCount = Array.isArray(r.allAttempts) ? r.allAttempts.length : 0;
            if (attCount === 0 && !r.isDoing) return;

            const curSub = attCount > 0 ? (r.allAttempts[r.selectedAttemptIndex || 0] || r.allAttempts[0]) : null;
            const stats = (typeof getAttemptCheatStats === "function")
                ? getAttemptCheatStats(r, curSub)
                : { tabCount: r.cheatLogsTabCount || 0, timeString: r.cheatTimeString || "0s", totalSeconds: 0 };

            const acc = r.account || {};
            list.push({
                rowUid: r._rowUid,
                stt: r.stt,
                sbd: acc.sbd || (curSub ? curSub.sbd : "---"),
                name: acc.name || (curSub ? curSub.studentName : "Thí sinh"),
                className: acc.className || (curSub ? curSub.studentClass : "---"),
                isDoing: Boolean(r.isDoing),
                score: curSub && curSub.score10 !== undefined ? Number(curSub.score10) : null,
                tabCount: Number(stats.tabCount) || 0,
                totalSeconds: Number(stats.totalSeconds) || 0,
                timeString: stats.timeString || "0s"
            });
        });

        list.sort((a, b) => {
            if (b.tabCount !== a.tabCount) return b.tabCount - a.tabCount;
            if (b.totalSeconds !== a.totalSeconds) return b.totalSeconds - a.totalSeconds;
            return (a.stt || 0) - (b.stt || 0);
        });

        return list;
    }

    function ensureCheatInspectorModalDOM() {
        injectCheatInspectorStyles();
        let modal = document.getElementById("cheat-inspector-modal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "cheat-inspector-modal";
        modal.className = "cheat-ins-overlay";
        modal.onclick = (e) => { if (e.target === modal) closeCheatInspectorModal(); };
        modal.innerHTML = `
            <div class="cheat-ins-card" onclick="event.stopPropagation()">
                <div class="cheat-ins-header">
                    <div>
                        <div style="font-size:15px; font-weight:900;">🕵️ GIÁM SÁT CHUYỂN TAB &amp; THỜI GIAN RỜI PHÒNG THI</div>
                        <div style="font-size:11.5px; color:#fecdd3; margin-top:2px;" id="cheat-ins-subtitle">--</div>
                    </div>
                    <button type="button" onclick="closeCheatInspectorModal()" style="background:rgba(255,255,255,0.2); color:#fff; border:none; width:30px; height:30px; border-radius:50%; font-size:15px; font-weight:900; cursor:pointer;">✕</button>
                </div>
                <div class="cheat-ins-kpi-row" id="cheat-ins-kpi-row"></div>
                <div class="cheat-ins-body" id="cheat-ins-body"></div>
                <div class="cheat-ins-footer">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn-ins-action btn-ins-copy" onclick="copyCheatInspectorZaloSummary()">📋 Copy danh sách cảnh báo Zalo</button>
                        <button type="button" class="btn-ins-action btn-ins-json" onclick="exportCheatInspectorExcel()">📥 Xuất Excel chuyển tab</button>
                    </div>
                    <button type="button" class="btn-ins-action btn-ins-close" onclick="closeCheatInspectorModal()">Đóng</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function renderCheatInspectorContent() {
        const items = collectCheatInspectorRows();
        const examTitle = (typeof currentExamResultData !== "undefined" && currentExamResultData.item && currentExamResultData.item.title) || "Bài kiểm tra";
        const subEl = document.getElementById("cheat-ins-subtitle");
        if (subEl) subEl.innerText = `Đề: ${examTitle} • Chỉ thống kê thí sinh đã thi / đang thi`;

        const switchedStudents = items.filter(i => i.tabCount > 0);
        const totalSwitches = switchedStudents.reduce((s, i) => s + i.tabCount, 0);
        const topSwitcher = switchedStudents[0] || null;
        const maxTimeItem = [...switchedStudents].sort((a, b) => b.totalSeconds - a.totalSeconds)[0] || null;

        const kpiRow = document.getElementById("cheat-ins-kpi-row");
        if (kpiRow) {
            kpiRow.innerHTML = `
                <div class="cheat-ins-kpi-box">
                    <small>HS có chuyển tab</small>
                    <b style="color:#dc2626;">${switchedStudents.length} / ${items.length} em</b>
                </div>
                <div class="cheat-ins-kpi-box">
                    <small>Tổng lượt rời tab</small>
                    <b style="color:#d97706;">${totalSwitches} lượt</b>
                </div>
                <div class="cheat-ins-kpi-box">
                    <small>Chuyển nhiều nhất</small>
                    <b style="font-size:13px;">${topSwitcher ? `${escapeCheatHtml(topSwitcher.name)} (${topSwitcher.tabCount} lần)` : "Không có"}</b>
                </div>
                <div class="cheat-ins-kpi-box">
                    <small>Tổng giây rời lâu nhất</small>
                    <b style="font-size:13px; color:#b91c1c;">${maxTimeItem && maxTimeItem.totalSeconds > 0 ? `${escapeCheatHtml(maxTimeItem.name)} (${formatTotalSecondsReadable(maxTimeItem.totalSeconds)})` : "Chưa có"}</b>
                </div>
            `;
        }

        const body = document.getElementById("cheat-ins-body");
        if (!body) return;

        if (items.length === 0) {
            body.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b; font-weight:700;">Chưa có học sinh nào thi đề này.</div>`;
            return;
        }

        const rowsHtml = items.map((it, idx) => {
            let levelBadge = `<span class="cheat-level-pill cheat-level-low">🟢 An toàn</span>`;
            if (it.tabCount >= 3 || it.totalSeconds >= 60) {
                levelBadge = `<span class="cheat-level-pill cheat-level-high">🔴 Nghi vấn cao</span>`;
            } else if (it.tabCount > 0) {
                levelBadge = `<span class="cheat-level-pill cheat-level-mid">🟡 Nhắc nhở</span>`;
            }

            const scoreDisplay = it.isDoing
                ? `<span style="color:#7e22ce; font-weight:800;">💓 Đang thi</span>`
                : (it.score !== null ? `<b>${it.score}đ</b>` : "---");

            return `
                <tr>
                    <td style="text-align:center; font-weight:800;">${idx + 1}</td>
                    <td><b>${escapeCheatHtml(it.name)}</b></td>
                    <td style="font-family:monospace; color:#0284c7; font-weight:800;">${escapeCheatHtml(it.sbd)}</td>
                    <td style="text-align:center;">${escapeCheatHtml(it.className)}</td>
                    <td style="text-align:center;">${scoreDisplay}</td>
                    <td style="text-align:center; font-weight:900; color:${it.tabCount > 0 ? '#dc2626' : '#16a34a'};">${it.tabCount} lần</td>
                    <td style="font-weight:800; color:#0f172a;">${formatTotalSecondsReadable(it.totalSeconds)}</td>
                    <td style="font-family:monospace; font-size:11.5px;">${escapeCheatHtml(it.timeString)}</td>
                    <td style="text-align:center;">${levelBadge}</td>
                </tr>
            `;
        }).join("");

        body.innerHTML = `
            <table class="cheat-ins-table">
                <thead>
                    <tr>
                        <th style="width:42px; text-align:center;">#</th>
                        <th>Họ và tên</th>
                        <th>SBD</th>
                        <th style="text-align:center;">Lớp</th>
                        <th style="text-align:center;">Điểm</th>
                        <th style="text-align:center;">Số lần</th>
                        <th>Tổng TG rời</th>
                        <th>Chi tiết từng lần</th>
                        <th style="text-align:center;">Mức độ</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;
    }

    function openCheatInspectorModal(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        if (typeof closeAllResultFloatingDropdowns === "function") closeAllResultFloatingDropdowns();
        const modal = ensureCheatInspectorModalDOM();
        modal.classList.add("show");
        renderCheatInspectorContent();
    }

    function closeCheatInspectorModal() {
        const modal = document.getElementById("cheat-inspector-modal");
        if (modal) modal.classList.remove("show");
    }

    function copyCheatInspectorZaloSummary() {
        const items = collectCheatInspectorRows().filter(i => i.tabCount > 0);
        const examTitle = (typeof currentExamResultData !== "undefined" && currentExamResultData.item && currentExamResultData.item.title) || "Bài kiểm tra";
        if (items.length === 0) {
            alert("✅ Phòng thi rất nghiêm túc, không có học sinh nào chuyển tab!");
            return;
        }
        const lines = items.map((it, i) =>
            `${i + 1}. ${it.name} (${it.sbd} - ${it.className}): ${it.tabCount} lần | Tổng ${formatTotalSecondsReadable(it.totalSeconds)} [${it.timeString}]`
        );
        const text = `⚠️ BÁO CÁO CHUYỂN TAB - ${examTitle}\n(Tổng ${items.length} học sinh có chuyển tab)\n` + lines.join("\n");

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert("✅ Đã sao chép báo cáo chuyển tab gửi Zalo!");
            }).catch(() => prompt("Sao chép nội dung bên dưới:", text));
        } else {
            prompt("Sao chép nội dung bên dưới:", text);
        }
    }

    function exportCheatInspectorExcel() {
        const items = collectCheatInspectorRows();
        if (items.length === 0) return alert("⚠️ Không có dữ liệu để xuất!");
        const examTitle = (typeof currentExamResultData !== "undefined" && currentExamResultData.item && currentExamResultData.item.title) || "BaiThi";
        const aoa = [["STT", "Họ và tên", "SBD", "Lớp", "Điểm", "Số lần chuyển tab", "Tổng thời gian rời (giây)", "Tổng TG hiển thị", "Chi tiết từng lần", "Đánh giá"]];
        items.forEach((it, idx) => {
            const evalTxt = (it.tabCount >= 3 || it.totalSeconds >= 60) ? "Nghi vấn cao" : (it.tabCount > 0 ? "Nhắc nhở" : "An toàn");
            aoa.push([
                idx + 1,
                it.name,
                it.sbd,
                it.className,
                it.isDoing ? "Đang thi" : (it.score ?? ""),
                it.tabCount,
                it.totalSeconds,
                formatTotalSecondsReadable(it.totalSeconds),
                it.timeString,
                evalTxt
            ]);
        });
        if (typeof XLSX !== "undefined") {
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "GiamSatChuyenTab");
            const safeTitle = examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, "_");
            XLSX.writeFile(wb, `GiamSat_ChuyenTab_${safeTitle}_${Date.now()}.xlsx`);
        } else {
            alert("⚠️ Chưa tải được thư viện XLSX!");
        }
    }

    function ensureCheatInspectorButtonInToolbar() {
        injectCheatInspectorStyles();
        const toolsWrap = document.querySelector(".result-modal-tools");
        if (!toolsWrap || document.getElementById("btn-cheat-inspector-trigger")) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = "btn-cheat-inspector-trigger";
        btn.className = "btn-cheat-inspector-trigger";
        btn.title = "Mở bảng tổng hợp giám sát học sinh chuyển tab & tổng thời gian rời phòng thi";
        btn.innerHTML = "🕵️ Soi tab";
        btn.onclick = openCheatInspectorModal;

        const excelBtn = toolsWrap.querySelector(".btn-export-excel");
        if (excelBtn) toolsWrap.insertBefore(btn, excelBtn);
        else toolsWrap.appendChild(btn);
    }

    document.addEventListener("DOMContentLoaded", ensureCheatInspectorButtonInToolbar);
    const _origRenderFn = window.renderFilteredResultTable;
    if (typeof _origRenderFn === "function") {
        window.renderFilteredResultTable = function(...args) {
            ensureCheatInspectorButtonInToolbar();
            return _origRenderFn.apply(this, args);
        };
    }

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            const m = document.getElementById("cheat-inspector-modal");
            if (m && m.classList.contains("show")) {
                closeCheatInspectorModal();
            }
        }
    });

    window.openCheatInspectorModal = openCheatInspectorModal;
    window.closeCheatInspectorModal = closeCheatInspectorModal;
    window.copyCheatInspectorZaloSummary = copyCheatInspectorZaloSummary;
    window.exportCheatInspectorExcel = exportCheatInspectorExcel;
})();