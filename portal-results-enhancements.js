// =========================================================
// FILE: portal-results-enhancements.js
// MODULE NÂNG CẤP CHO MODAL KẾT QUẢ THI:
// 1. LỌC NHANH NGAY KHI BẤM VÀO CÁC BADGE KPI & PHÂN LOẠI ĐIỂM
// 2. CỬA SỔ XEM CHI TIẾT BÀI LÀM TRỰC QUAN (XANH/ĐỎ TỪNG CÂU)
// 3. CHUYỂN LẦN THI, COPY BÁO CÁO GỬI ZALO PHỤ HUYNH & XÓA RIÊNG 1 LẦN THI (ADMIN)
// 4. PHÍM TẮT ESC ĐÓNG POPUP THEO THỨ TỰ ƯU TIÊN
// =========================================================

let _activeResultKpiFilter = null; // { type: 'status'|'score', value: 'submitted'|'doing'|'unsubmitted'|'0-3'|... }
let _inspectorCurrentRowUid = null;

(function injectResultEnhancementStyles() {
    const styleId = "portal-results-enhancements-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        #result-modal-stats-bar .stat-badge-item.is-clickable-filter {
            cursor: pointer !important;
            transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease !important;
            user-select: none !important;
        }
        #result-modal-stats-bar .stat-badge-item.is-clickable-filter:hover {
            transform: translateY(-1px) !important;
            filter: brightness(0.96) !important;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.14) !important;
        }
        #result-modal-stats-bar .stat-badge-item.is-filter-active {
            outline: 2px solid #0284c7 !important;
            outline-offset: 1px !important;
            box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35) !important;
            font-weight: 900 !important;
        }
        .btn-clear-kpi-filter {
            background: #fee2e2 !important;
            color: #dc2626 !important;
            border: 1px solid #fca5a5 !important;
            border-radius: 10px !important;
            padding: 1px 7px !important;
            font-size: 9.5px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            margin-left: 4px !important;
            height: 18px !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            white-space: nowrap !important;
        }
        .btn-clear-kpi-filter:hover {
            background: #dc2626 !important;
            color: #ffffff !important;
        }

        /* MODAL XEM CHI TIẾT BÀI LÀM HỌC SINH */
        .st-inspector-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.72);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            z-index: 2147483050;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 14px;
            font-family: 'Be Vietnam Pro', sans-serif;
        }
        .st-inspector-overlay.show {
            display: flex;
            animation: fadeInModal 0.18s ease-out;
        }
        .st-inspector-card {
            background: #ffffff;
            width: min(820px, 96vw);
            max-height: 90vh;
            border-radius: 16px;
            border: 1.5px solid #cbd5e1;
            box-shadow: 0 25px 65px rgba(15, 23, 42, 0.45);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .st-inspector-header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 2px solid #0284c7;
        }
        .st-inspector-body {
            padding: 14px 16px;
            overflow-y: auto;
            flex: 1;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .st-inspector-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
            gap: 8px;
        }
        .st-ins-kpi {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 8px 10px;
        }
        .st-ins-kpi small {
            display: block;
            font-size: 10.5px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
        }
        .st-ins-kpi b {
            display: block;
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
        }
        .st-ins-attempts-bar {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .st-ins-att-btn {
            padding: 5px 11px;
            border-radius: 999px;
            border: 1.2px solid #cbd5e1;
            background: #ffffff;
            color: #334155;
            font-size: 11.5px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.14s ease;
        }
        .st-ins-att-btn:hover { border-color: #0284c7; color: #0284c7; }
        .st-ins-att-btn.active {
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: #ffffff;
            border-color: #0284c7;
            box-shadow: 0 2px 7px rgba(2, 132, 199, 0.3);
        }
        .st-ins-answers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
            gap: 7px;
        }
        .st-ins-ans-chip {
            padding: 7px 10px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #1e293b;
            word-break: break-word;
            line-height: 1.35;
        }
        .st-ins-ans-chip.is-right {
            background: #f0fdf4;
            border-color: #86efac;
            color: #15803d;
        }
        .st-ins-ans-chip.is-wrong {
            background: #fef2f2;
            border-color: #fca5a5;
            color: #b91c1c;
        }
        .st-ins-ans-chip.is-note {
            background: #fffbeb;
            border-color: #fde68a;
            color: #92400e;
        }
        .st-inspector-footer {
            padding: 10px 16px;
            background: #ffffff;
            border-top: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
        }
        .btn-ins-action {
            padding: 7px 13px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            border: 1px solid transparent;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            transition: all 0.14s ease;
            font-family: inherit;
        }
        .btn-ins-copy {
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: #ffffff;
        }
        .btn-ins-copy:hover { filter: brightness(1.08); }
        .btn-ins-delete-attempt {
            background: #fee2e2;
            color: #dc2626;
            border-color: #fca5a5;
        }
        .btn-ins-delete-attempt:hover {
            background: #dc2626;
            color: #ffffff;
        }
        .btn-ins-close {
            background: #f1f5f9;
            color: #334155;
            border-color: #cbd5e1;
        }
        .btn-ins-close:hover { background: #e2e8f0; }
    `;
    document.head.appendChild(style);
})();

// 1. BỘ LỌC TƯƠNG TÁC TRÊN THANH KPI & PHÂN LOẠI ĐIỂM
const KPI_FILTER_DEFS = [
    { id: "stat-submitted-students", type: "status", value: "submitted" },
    { id: "stat-doing-students",     type: "status", value: "doing" },
    { id: "stat-unsubmitted-students", type: "status", value: "unsubmitted" },
    { id: "stat-score-0-to-3",  type: "score", value: "0-3" },
    { id: "stat-score-3-to-5",  type: "score", value: "3-5" },
    { id: "stat-score-5-to-6",  type: "score", value: "5-6" },
    { id: "stat-score-6-to-7",  type: "score", value: "6-7" },
    { id: "stat-score-7-to-8",  type: "score", value: "7-8" },
    { id: "stat-score-8-to-9",  type: "score", value: "8-9" },
    { id: "stat-score-9-to-10", type: "score", value: "9-10" }
];

function setupStatsBarInteractiveFilters() {
    const bar = document.getElementById("result-modal-stats-bar");
    if (!bar || bar.dataset.hasKpiDelegate === "1") return;
    bar.dataset.hasKpiDelegate = "1";

    bar.addEventListener("click", function(e) {
        if (e.target.closest("#btn-clear-kpi-filter")) {
            clearResultEnhancementFilter(false);
            return;
        }
        const badge = e.target.closest(".stat-badge-item");
        if (!badge) return;

        const def = KPI_FILTER_DEFS.find(d => badge.querySelector(`#${d.id}`));
        if (!def) return;

        if (_activeResultKpiFilter && _activeResultKpiFilter.type === def.type && _activeResultKpiFilter.value === def.value) {
            _activeResultKpiFilter = null;
        } else {
            _activeResultKpiFilter = { type: def.type, value: def.value };
        }

        if (typeof filterResultTable === "function") filterResultTable();
        syncResultEnhancementUI();
    });
}

function syncResultEnhancementUI() {
    setupStatsBarInteractiveFilters();
    const bar = document.getElementById("result-modal-stats-bar");
    if (!bar) return;

    KPI_FILTER_DEFS.forEach(def => {
        const valEl = document.getElementById(def.id);
        const badge = valEl ? valEl.closest(".stat-badge-item") : null;
        if (!badge) return;
        badge.classList.add("is-clickable-filter");
        badge.title = "Nhấp để lọc nhanh danh sách học sinh theo nhóm này";
        const isActive = Boolean(_activeResultKpiFilter && _activeResultKpiFilter.type === def.type && _activeResultKpiFilter.value === def.value);
        badge.classList.toggle("is-filter-active", isActive);
    });

    const firstRow = bar.firstElementChild;
    let clearBtn = document.getElementById("btn-clear-kpi-filter");
    if (_activeResultKpiFilter) {
        if (!clearBtn && firstRow) {
            clearBtn = document.createElement("button");
            clearBtn.type = "button";
            clearBtn.id = "btn-clear-kpi-filter";
            clearBtn.className = "btn-clear-kpi-filter";
            clearBtn.innerHTML = "✕ Bỏ lọc";
            clearBtn.title = "Hiển thị lại toàn bộ danh sách";
            firstRow.appendChild(clearBtn);
        }
    } else if (clearBtn) {
        clearBtn.remove();
    }
}

function clearResultEnhancementFilter(silent = false) {
    _activeResultKpiFilter = null;
    syncResultEnhancementUI();
    if (!silent && typeof filterResultTable === "function") {
        filterResultTable();
    }
}

function applyResultEnhancementFilter(rows) {
    if (!_activeResultKpiFilter || !Array.isArray(rows)) return rows;
    const { type, value } = _activeResultKpiFilter;

    if (type === "status") {
        if (value === "submitted") return rows.filter(r => r.allAttempts.length > 0 && !r.isDoing);
        if (value === "doing") return rows.filter(r => r.isDoing);
        if (value === "unsubmitted") return rows.filter(r => r.allAttempts.length === 0 && !r.isDoing);
    }

    if (type === "score") {
        return rows.filter(r => {
            if (!r.allAttempts || r.allAttempts.length === 0) return false;
            const curSub = r.allAttempts[r.selectedAttemptIndex] || r.allAttempts[r.allAttempts.length - 1];
            if (!curSub || curSub.score10 === undefined || curSub.score10 === null) return false;
            const sc = Number(curSub.score10);
            if (isNaN(sc)) return false;
            if (value === "0-3") return sc < 3.0;
            if (value === "3-5") return sc >= 3.0 && sc < 5.0;
            if (value === "5-6") return sc >= 5.0 && sc <= 6.0;
            if (value === "6-7") return sc > 6.0 && sc <= 7.0;
            if (value === "7-8") return sc > 7.0 && sc <= 8.0;
            if (value === "8-9") return sc > 8.0 && sc <= 9.0;
            if (value === "9-10") return sc > 9.0;
            return true;
        });
    }

    return rows;
}

// 2. CỬA SỔ XEM CHI TIẾT BÀI LÀM HỌC SINH
function ensureStudentInspectorModal() {
    let modal = document.getElementById("student-detail-inspector-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "student-detail-inspector-modal";
    modal.className = "st-inspector-overlay";
    modal.onclick = (e) => { if (e.target === modal) closeStudentDetailInspector(); };
    modal.innerHTML = `
        <div class="st-inspector-card" onclick="event.stopPropagation()">
            <div class="st-inspector-header">
                <div>
                    <div style="font-size:15px; font-weight:900;" id="st-ins-title">📋 Chi tiết bài làm</div>
                    <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;" id="st-ins-subtitle">--</div>
                </div>
                <button type="button" onclick="closeStudentDetailInspector()" style="background:#334155; color:#fff; border:none; width:30px; height:30px; border-radius:50%; font-size:15px; font-weight:900; cursor:pointer;">✕</button>
            </div>
            <div class="st-inspector-body" id="st-ins-body"></div>
            <div class="st-inspector-footer" id="st-ins-footer"></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function escapeInsHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function openStudentDetailInspector(rowUid, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (typeof closeAllResultFloatingDropdowns === "function") closeAllResultFloatingDropdowns();

    const row = (currentExamResultData.rawRows || []).find(r => r._rowUid === rowUid);
    if (!row || !row.allAttempts || row.allAttempts.length === 0) return;

    _inspectorCurrentRowUid = rowUid;
    ensureStudentInspectorModal().classList.add("show");
    renderStudentInspectorContent(row);
}

function closeStudentDetailInspector() {
    const modal = document.getElementById("student-detail-inspector-modal");
    if (modal) modal.classList.remove("show");
    _inspectorCurrentRowUid = null;
}

function renderStudentInspectorContent(row) {
    const acc = row.account || {};
    const attIdx = Math.max(0, Math.min(row.selectedAttemptIndex || 0, row.allAttempts.length - 1));
    const sub = row.allAttempts[attIdx];
    if (!sub) return;

    const examTitle = (currentExamResultData.item && currentExamResultData.item.title) || "Bài kiểm tra";
    const sName = acc.name || sub.studentName || "Thí sinh";
    const sbd = acc.sbd || sub.sbd || "---";
    const sClass = acc.className || sub.studentClass || "---";

    document.getElementById("st-ins-title").innerText = `📋 ${sName} (${sbd})`;
    document.getElementById("st-ins-subtitle").innerText = `Lớp: ${sClass} • Đề: ${examTitle}`;

    const subDateMs = typeof getSubmissionTimestamp === "function" ? getSubmissionTimestamp(sub) : 0;
    const submitTimeStr = subDateMs && typeof formatDateTimeFull === "function" ? formatDateTimeFull(subDateMs) : (sub.timestamp || "---");
    const rawSubTab = parseInt(sub.tabSwitchCount, 10) || 0;
    const dataStrTab = typeof extractTabCountFromDataString === "function" ? extractTabCountFromDataString(sub.dataString) : 0;
    const finalTab = Math.max(rawSubTab, dataStrTab, row.cheatLogsTabCount || 0);

    let attemptsBarHtml = "";
    if (row.allAttempts.length > 1) {
        attemptsBarHtml = `
            <div class="st-ins-attempts-bar">
                <b style="font-size:12px; color:#334155;">Chọn lần thi:</b>
                ${row.allAttempts.map((a, idx) => `
                    <button type="button" class="st-ins-att-btn ${idx === attIdx ? 'active' : ''}" onclick="switchInspectorAttempt(${idx})">
                        Lần ${idx + 1} (${a.score10 ?? '--'}đ)
                    </button>
                `).join('')}
            </div>
        `;
    }

    const tokens = String(sub.dataString || "").split(/\s*\|\s*/).filter(Boolean);
    const chipsHtml = tokens.length > 0 ? tokens.map(tok => {
        let cls = "";
        if (tok.includes("[ĐÚNG]")) cls = "is-right";
        else if (tok.includes("[SAI")) cls = "is-wrong";
        else cls = "is-note";
        return `<div class="st-ins-ans-chip ${cls}">${escapeInsHtml(tok)}</div>`;
    }).join('') : `<div style="color:#64748b; font-style:italic;">Không có dữ liệu chi tiết từng câu.</div>`;

    const body = document.getElementById("st-ins-body");
    body.innerHTML = `
        ${attemptsBarHtml}
        <div class="st-inspector-summary-grid">
            <div class="st-ins-kpi"><small>Điểm lần ${attIdx + 1}</small><b style="color:#0284c7; font-size:17px;">${sub.score10 ?? 0} điểm</b></div>
            <div class="st-ins-kpi"><small>Số câu đúng</small><b style="color:#16a34a;">${sub.correctCount ?? 0} câu</b></div>
            <div class="st-ins-kpi"><small>Thời gian làm</small><b>${escapeInsHtml(sub.completionTime || "---")}</b></div>
            <div class="st-ins-kpi"><small>Chuyển tab</small><b style="color:${finalTab > 0 ? '#dc2626' : '#16a34a'};">${finalTab} lần (${escapeInsHtml(row.cheatTimeString || '0s')})</b></div>
            <div class="st-ins-kpi"><small>Thời điểm nộp</small><b style="font-size:12px;">${escapeInsHtml(submitTimeStr)}</b></div>
        </div>
        <div>
            <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-bottom:6px;">
                🔍 Chi tiết từng câu (${tokens.length} mục):
            </div>
            <div class="st-ins-answers-grid">${chipsHtml}</div>
        </div>
    `;

    const footer = document.getElementById("st-ins-footer");
    footer.innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-ins-action btn-ins-copy" onclick="copyStudentZaloReport()">📋 Copy báo cáo gửi Zalo</button>
            <button type="button" class="btn-ins-action btn-ins-delete-attempt" onclick="deleteSingleAttemptFromCloud('${escapeInsHtml(sub.id || '')}')">🗑️ Xóa lần thi ${attIdx + 1} trên máy chủ</button>
        </div>
        <button type="button" class="btn-ins-action btn-ins-close" onclick="closeStudentDetailInspector()">Đóng</button>
    `;
}

window.switchInspectorAttempt = function(attIdx) {
    if (!_inspectorCurrentRowUid) return;
    if (typeof selectStudentAttempt === "function") {
        selectStudentAttempt(_inspectorCurrentRowUid, attIdx);
    }
    const row = (currentExamResultData.rawRows || []).find(r => r._rowUid === _inspectorCurrentRowUid);
    if (row) renderStudentInspectorContent(row);
};

window.copyStudentZaloReport = function() {
    if (!_inspectorCurrentRowUid) return;
    const row = (currentExamResultData.rawRows || []).find(r => r._rowUid === _inspectorCurrentRowUid);
    if (!row || !row.allAttempts || row.allAttempts.length === 0) return;

    const acc = row.account || {};
    const attIdx = row.selectedAttemptIndex || 0;
    const sub = row.allAttempts[attIdx];
    const examTitle = (currentExamResultData.item && currentExamResultData.item.title) || "Bài kiểm tra";
    const tokens = String(sub.dataString || "").split(/\s*\|\s*/).filter(Boolean);
    const wrongList = tokens.filter(t => t.includes("[SAI")).slice(0, 12);

    const text = [
        `📊 KẾT QUẢ BÀI THI: ${examTitle}`,
        `👤 Học sinh: ${acc.name || sub.studentName} (SBD: ${acc.sbd || sub.sbd} - Lớp: ${acc.className || sub.studentClass})`,
        `🎯 Kết quả (Lần ${attIdx + 1}): ${sub.score10 ?? 0} điểm | Đúng: ${sub.correctCount ?? 0} câu | Thời gian: ${sub.completionTime || "---"}`,
        `⚠️ Chuyển tab: ${Math.max(parseInt(sub.tabSwitchCount, 10) || 0, row.cheatLogsTabCount || 0)} lần`,
        wrongList.length > 0 ? `❌ Các câu sai cần xem lại: ${wrongList.join("; ")}` : `✅ Làm bài rất tốt, không có câu sai!`
    ].join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert("✅ Đã sao chép báo cáo kết quả! Thầy có thể bấm Dán (Ctrl+V) gửi thẳng qua Zalo.");
        }).catch(() => prompt("Sao chép nội dung bên dưới:", text));
    } else {
        prompt("Sao chép nội dung bên dưới:", text);
    }
};

window.deleteSingleAttemptFromCloud = async function(subId) {
    if (!subId) return alert("⚠️ Không xác định được ID lần thi này!");
    if (!_inspectorCurrentRowUid) return;

    const row = (currentExamResultData.rawRows || []).find(r => r._rowUid === _inspectorCurrentRowUid);
    const sName = row ? (row.account?.name || "học sinh") : "học sinh";
    const attNum = (row ? (row.selectedAttemptIndex || 0) : 0) + 1;

    if (!confirm(`⚠️ XÁC NHẬN XÓA VĨNH VIỄN LẦN THI:\n\nBạn có chắc chắn muốn XÓA Lần ${attNum} của [${sName}] khỏi cơ sở dữ liệu Supabase không?\n(Thao tác này không thể hoàn tác!)`)) {
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return alert("❌ Chưa kết nối được máy chủ Supabase!");

    try {
        const { error } = await client.from("submissions").delete().eq("id", subId);
        if (error) throw error;

        if (row && Array.isArray(row.allAttempts)) {
            row.allAttempts = row.allAttempts.filter(a => String(a.id) !== String(subId));
            row.selectedAttemptIndex = 0;
        }
        closeStudentDetailInspector();

        if (typeof calculateRanksForRows === "function") calculateRanksForRows(currentExamResultData.rawRows);
        if (typeof updateStatsAndRenderTable === "function") updateStatsAndRenderTable(currentExamResultData.rawRows);
        alert(`🗑️ Đã xóa Lần ${attNum} của [${sName}] thành công!`);
    } catch (err) {
        alert("❌ Lỗi khi xóa lần thi: " + err.message);
    }
};

// 3. PHÍM TẮT ESC ĐÓNG POPUP THEO THỨ TỰ ƯU TIÊN
document.addEventListener("keydown", function(e) {
    if (e.key !== "Escape") return;
    const insModal = document.getElementById("student-detail-inspector-modal");
    if (insModal && insModal.classList.contains("show")) {
        closeStudentDetailInspector();
        return;
    }
    const resultModal = document.getElementById("result-fullscreen-modal");
    if (resultModal && resultModal.style.display === "flex") {
        if (typeof closeAllResultFloatingDropdowns === "function") closeAllResultFloatingDropdowns();
        if (typeof closeTableSettingsPopover === "function") closeTableSettingsPopover();
        if (typeof closeRegradeModal === "function") closeRegradeModal();
    }
});

document.addEventListener("DOMContentLoaded", setupStatsBarInteractiveFilters);

window.applyResultEnhancementFilter = applyResultEnhancementFilter;
window.syncResultEnhancementUI = syncResultEnhancementUI;
window.clearResultEnhancementFilter = clearResultEnhancementFilter;
window.openStudentDetailInspector = openStudentDetailInspector;
window.closeStudentDetailInspector = closeStudentDetailInspector;