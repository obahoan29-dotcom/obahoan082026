// =========================================================
// FILE: qbank-preview-pagination.js
// BỔ SUNG 3 NÂNG CẤP CHO MODAL NGÂN HÀNG CÂU HỎI & ĐỀ THI:
// 1. THANH CHẠY NGANG LOAD TRANG THÔNG MINH (TỰ KHỚP TỐC ĐỘ NHANH / CHẬM THỰC TẾ)
// 2. PHÂN TRANG 50 CÂU / TRANG Ở DÒNG CUỐI CỘT GIỮA (SỐ TRANG NHỎ GỌN, ĐÁNH DẤU RÕ RÀNG)
// 3. NÚT "👁️ Xem thử đề" Ở CỘT PHẢI (NGAY TRÊN NÚT LƯU ĐỀ) + MODAL XEM THỬ ĐỀ ĐẦY ĐỦ
//    CÓ ĐỦ CÁC NÚT CHỨC NĂNG TỪNG CÂU, TẢI LẠI ẢNH / DRIVE & NÚT CHỌN TÍCH SẴN
// =========================================================

(function initQbankPreviewAndPaginationModule() {
    if (typeof window === "undefined") return;

    const QBANK_DEFAULT_PAGE_SIZE = 50;
    let _qbProgressHideTimer = null;
    let _qbProgressSmoothTimer = null;
    let _qbCurrentPct = 0;
    let _qbBuilderHookInstalled = false;
    let _qbPreviewRemovedUndoStack = []; // Lưu tạm các câu vừa bỏ tích trong modal Xem thử đề để hoàn tác nhanh

    // =========================================================================
    // 0. TIÊM CSS RIÊNG CHO THANH LOAD, PHÂN TRANG & MODAL XEM THỬ ĐỀ
    // =========================================================================
    function injectQbankPreviewPaginationStyles() {
        const styleId = "qbank-preview-pagination-styles";
        if (document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            /* 1. THANH CHẠY NGANG LOAD TRANG */
            .qbank-top-progress-wrap {
                background: linear-gradient(90deg, #f0f9ff 0%, #f0fdf4 100%);
                border-bottom: 1.5px solid #bae6fd;
                padding: 4px 10px 5px 10px;
                display: none;
                flex-direction: column;
                gap: 3px;
                flex-shrink: 0;
                z-index: 30;
                transition: opacity 0.25s ease;
            }
            .qbank-top-progress-wrap.show {
                display: flex;
                opacity: 1;
            }
            .qbank-top-progress-wrap.is-done {
                background: linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%);
                border-bottom-color: #86efac;
            }
            .qbank-top-progress-meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-size: 11px;
                font-weight: 800;
                color: #0369a1;
                line-height: 1.2;
            }
            .qbank-top-progress-wrap.is-done .qbank-top-progress-meta {
                color: #15803d;
            }
            .qbank-top-progress-track {
                width: 100%;
                height: 6px;
                background: #e2e8f0;
                border-radius: 999px;
                overflow: hidden;
                position: relative;
                box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.1);
            }
            .qbank-top-progress-fill {
                height: 100%;
                width: 0%;
                border-radius: 999px;
                background: linear-gradient(90deg, #0284c7, #10b981, #38bdf8);
                background-size: 200% 100%;
                animation: qbProgressShimmer 1.3s linear infinite;
                transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .qbank-top-progress-wrap.is-done .qbank-top-progress-fill {
                background: linear-gradient(90deg, #16a34a, #22c55e);
                animation: none;
            }
            @keyframes qbProgressShimmer {
                0% { background-position: 100% 0; }
                100% { background-position: -100% 0; }
            }

            /* 2. THANH PHÂN TRANG SIÊU NHỎ DÒNG CUỐI CỘT GIỮA */
            .qbank-mid-pagination-bar {
                display: none;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                padding: 3px 8px;
                min-height: 25px;
                background: #ffffff;
                border-top: 1.5px solid #cbd5e1;
                flex-shrink: 0;
                font-size: 10.5px;
                font-weight: 700;
                color: #475569;
                z-index: 15;
                flex-wrap: wrap;
            }
            .qbank-mid-pagination-bar.show {
                display: flex;
            }
            #qbank-col-mid:has(#qbank-mid-edit-workspace.show) #qbank-mid-pagination-bar {
                display: none !important;
            }
            .qbank-page-info-txt {
                font-size: 10px;
                font-weight: 800;
                color: #334155;
                white-space: nowrap;
            }
            .qbank-page-info-txt b {
                color: #0284c7;
            }
            .qbank-page-btns-row {
                display: flex;
                align-items: center;
                gap: 2.5px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .qbank-page-btn {
                min-width: 21px;
                height: 20px;
                padding: 0 5px;
                border-radius: 5px;
                border: 1px solid #cbd5e1;
                background: #f8fafc;
                color: #334155;
                font-size: 10px;
                font-weight: 800;
                line-height: 1;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.12s ease;
                font-family: inherit;
                user-select: none;
            }
            .qbank-page-btn:hover:not(:disabled):not(.is-active) {
                background: #e0f2fe;
                border-color: #38bdf8;
                color: #0369a1;
            }
            .qbank-page-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .qbank-page-btn.is-active {
                background: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%) !important;
                color: #ffffff !important;
                border-color: #1e40af !important;
                box-shadow: 0 2px 6px rgba(2, 132, 199, 0.42) !important;
                font-weight: 900 !important;
                transform: scale(1.08);
            }
            .qbank-page-ellipsis {
                font-size: 10px;
                color: #94a3b8;
                font-weight: 900;
                padding: 0 2px;
                user-select: none;
            }

            /* 3. NÚT XEM THỬ ĐỀ Ở CỘT PHẢI */
            .btn-qbank-preview-extracted {
                background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%) !important;
                color: #ffffff !important;
                border: 1.5px solid #7dd3fc !important;
                padding: 10px 12px !important;
                font-size: 13px !important;
                font-weight: 900 !important;
                width: 100% !important;
                justify-content: center !important;
                margin-bottom: 8px !important;
                box-shadow: 0 3px 10px rgba(2, 132, 199, 0.28) !important;
                border-radius: 8px !important;
            }
            .btn-qbank-preview-extracted.is-empty {
                background: #f1f5f9 !important;
                color: #64748b !important;
                border: 1.5px dashed #cbd5e1 !important;
                box-shadow: none !important;
            }

            /* 4. MODAL XEM THỬ ĐỀ DẠNG ĐỀ ĐẦY ĐỦ */
            .qb-preview-overlay {
                position: fixed !important;
                inset: 0 !important;
                background: rgba(15, 23, 42, 0.85) !important;
                backdrop-filter: blur(7px) !important;
                -webkit-backdrop-filter: blur(7px) !important;
                z-index: 10000040 !important;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 10px;
                font-family: 'Be Vietnam Pro', sans-serif;
            }
            .qb-preview-overlay.show {
                display: flex !important;
                animation: fadeInModal 0.18s ease-out;
            }
            .qb-preview-modal-card {
                background: #f1f5f9;
                width: min(1020px, 96vw);
                height: 94vh;
                border-radius: 16px;
                border: 1.8px solid #38bdf8;
                box-shadow: 0 28px 75px rgba(0, 0, 0, 0.55);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .qb-preview-header {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #ffffff;
                padding: 8px 14px;
                border-bottom: 2.5px solid #0284c7;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: wrap;
                flex-shrink: 0;
            }
            .qb-preview-header-left {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
                flex: 1;
            }
            .qb-preview-title-text {
                font-size: 14px;
                font-weight: 900;
                color: #38bdf8;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .qb-preview-sub-pill {
                background: rgba(16, 185, 129, 0.2);
                border: 1px solid #34d399;
                color: #a7f3d0;
                border-radius: 999px;
                padding: 2px 9px;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
            }
            .qb-preview-header-tools {
                display: flex;
                align-items: center;
                gap: 5px;
                flex-wrap: wrap;
            }
            .qb-preview-body {
                flex: 1;
                overflow-y: auto;
                padding: 14px 18px 28px 18px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .qb-preview-exam-paper-head {
                background: #ffffff;
                border: 1.5px solid #cbd5e1;
                border-top: 4px solid #0284c7;
                border-radius: 12px;
                padding: 12px 16px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
            }
            .qb-preview-exam-paper-head h2 {
                margin: 0;
                font-size: 16px;
                font-weight: 900;
                color: #0f172a;
                text-transform: uppercase;
            }
            .qb-preview-part-banner {
                background: linear-gradient(135deg, #0284c7, #2563eb);
                color: #ffffff;
                padding: 8px 14px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 900;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 4px;
                box-shadow: 0 3px 10px rgba(37, 99, 235, 0.18);
            }
            .qb-preview-part-banner.part-2 { background: linear-gradient(135deg, #7c3aed, #4f46e5); }
            .qb-preview-part-banner.part-3 { background: linear-gradient(135deg, #0d9488, #059669); }
            .qb-preview-part-banner.part-4 { background: linear-gradient(135deg, #ea580c, #c2410c); }

            .qb-preview-qcard {
                background: #ffffff;
                border: 1.5px solid #cbd5e1;
                border-left: 4.5px solid #10b981;
                border-radius: 12px;
                padding: 12px 14px;
                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
                transition: opacity 0.18s ease, transform 0.18s ease, border-color 0.15s ease;
            }
            .qb-preview-qcard:hover {
                border-color: #38bdf8;
                box-shadow: 0 5px 14px rgba(2, 132, 199, 0.12);
            }
            .qb-preview-qcard.is-removing {
                opacity: 0;
                transform: translateX(16px) scale(0.98);
                pointer-events: none;
            }
            .qb-preview-qcard-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                flex-wrap: wrap;
                border-bottom: 1px dashed #e2e8f0;
                padding-bottom: 6px;
                margin-bottom: 8px;
            }
            .qb-preview-qnum-pill {
                background: linear-gradient(135deg, #0284c7, #0369a1);
                color: #ffffff;
                padding: 2px 9px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 900;
            }
            .qb-preview-check-pill {
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-weight: 900;
                font-size: 11.5px;
                color: #065f46;
                background: #dcfce7;
                border: 1.3px solid #4ade80;
                padding: 2px 9px;
                border-radius: 999px;
                user-select: none;
                transition: all 0.14s ease;
            }
            .qb-preview-check-pill:hover {
                background: #fee2e2;
                border-color: #fca5a5;
                color: #b91c1c;
            }
            .qb-preview-check-pill input {
                width: 15px;
                height: 15px;
                accent-color: #10b981;
                cursor: pointer;
                margin: 0;
            }
            .qb-preview-footer {
                background: #ffffff;
                border-top: 1.5px solid #cbd5e1;
                padding: 8px 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: wrap;
                flex-shrink: 0;
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // 1. THANH CHẠY NGANG LOAD TRANG (TỰ KHỚP TỐC ĐỘ NHANH / CHẬM)
    // =========================================================================
    function ensureQbankProgressBarDOM() {
        injectQbankPreviewPaginationStyles();
        const colMid = document.getElementById("qbank-col-mid");
        if (!colMid) return null;

        let wrap = document.getElementById("qbank-top-progress-wrap");
        if (!wrap) {
            wrap = document.createElement("div");
            wrap.id = "qbank-top-progress-wrap";
            wrap.className = "qbank-top-progress-wrap";
            wrap.innerHTML = `
                <div class="qbank-top-progress-meta">
                    <span id="qbank-top-progress-label">⏳ Đang tải ngân hàng câu hỏi...</span>
                    <span id="qbank-top-progress-pct">0%</span>
                </div>
                <div class="qbank-top-progress-track">
                    <div class="qbank-top-progress-fill" id="qbank-top-progress-fill"></div>
                </div>
            `;
            colMid.insertBefore(wrap, colMid.firstChild);
        }
        return wrap;
    }

    function setProgressVisual(pct, label) {
        const clamped = Math.max(0, Math.min(100, Math.round(pct)));
        _qbCurrentPct = clamped;
        const fill = document.getElementById("qbank-top-progress-fill");
        const pctEl = document.getElementById("qbank-top-progress-pct");
        const lblEl = document.getElementById("qbank-top-progress-label");
        if (fill) fill.style.width = `${clamped}%`;
        if (pctEl) pctEl.textContent = `${clamped}%`;
        if (lblEl && label) lblEl.textContent = label;
    }

    function startQbankProgressBar(initialLabel = "⏳ Đang nạp dữ liệu...") {
        const wrap = ensureQbankProgressBarDOM();
        if (!wrap) return;
        if (_qbProgressHideTimer) { clearTimeout(_qbProgressHideTimer); _qbProgressHideTimer = null; }
        if (_qbProgressSmoothTimer) { clearInterval(_qbProgressSmoothTimer); _qbProgressSmoothTimer = null; }

        wrap.classList.remove("is-done");
        wrap.classList.add("show");
        setProgressVisual(6, `⏳ ${initialLabel}`);

        _qbProgressSmoothTimer = setInterval(() => {
            if (_qbCurrentPct < 28) {
                setProgressVisual(_qbCurrentPct + 2, null);
            } else {
                clearInterval(_qbProgressSmoothTimer);
                _qbProgressSmoothTimer = null;
            }
        }, 120);
    }

    function updateQbankProgressBar(pct, label = "") {
        const wrap = ensureQbankProgressBarDOM();
        if (!wrap) return;
        if (!wrap.classList.contains("show")) wrap.classList.add("show");
        if (_qbProgressSmoothTimer && pct >= 28) {
            clearInterval(_qbProgressSmoothTimer);
            _qbProgressSmoothTimer = null;
        }
        const safePct = Math.max(_qbCurrentPct, Math.min(99, Number(pct) || 0));
        setProgressVisual(safePct, label ? `⏳ ${label}` : null);
    }

    function finishQbankProgressBar(totalQuestions = 0, elapsedSec = "0.20", hasError = false) {
        const wrap = ensureQbankProgressBarDOM();
        if (!wrap) return;
        if (_qbProgressSmoothTimer) { clearInterval(_qbProgressSmoothTimer); _qbProgressSmoothTimer = null; }

        wrap.classList.add("is-done");
        const qCountText = Number(totalQuestions || 0).toLocaleString("vi-VN");
        const msg = hasError
            ? `⚠️ Đã hoàn tất nạp cục bộ (${qCountText} câu)`
            : `✅ Hoàn tất tải ${qCountText} câu hỏi (${elapsedSec}s)`;

        setProgressVisual(100, msg);

        if (_qbProgressHideTimer) clearTimeout(_qbProgressHideTimer);
        _qbProgressHideTimer = setTimeout(() => {
            wrap.classList.remove("show");
            wrap.classList.remove("is-done");
        }, 900);
    }

    // =========================================================================
    // 2. PHÂN TRANG 50 CÂU / TRANG Ở DÒNG CUỐI CỘT GIỮA
    // =========================================================================
    function ensureQbankPaginationFooterDOM() {
        injectQbankPreviewPaginationStyles();
        const colMid = document.getElementById("qbank-col-mid");
        if (!colMid) return null;

        let bar = document.getElementById("qbank-mid-pagination-bar");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "qbank-mid-pagination-bar";
            bar.className = "qbank-mid-pagination-bar";
            const qList = document.getElementById("qbank-questions-list");
            if (qList && qList.parentNode === colMid) {
                colMid.insertBefore(bar, qList.nextSibling);
            } else {
                colMid.appendChild(bar);
            }
        }
        return bar;
    }

    function paginateQbankQuestionsList(questions) {
        const list = Array.isArray(questions) ? questions : [];
        const pageSize = (typeof qbankState !== "undefined" && qbankState.pageSize > 0)
            ? qbankState.pageSize
            : QBANK_DEFAULT_PAGE_SIZE;
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        let curPage = (typeof qbankState !== "undefined" && parseInt(qbankState.currentMidPage, 10)) || 1;
        if (curPage < 1) curPage = 1;
        if (curPage > totalPages) curPage = totalPages;
        if (typeof qbankState !== "undefined") {
            qbankState.currentMidPage = curPage;
            qbankState.pageSize = pageSize;
        }

        const startIdx = (curPage - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, total);
        return {
            items: list.slice(startIdx, endIdx),
            page: curPage,
            pageSize: pageSize,
            total: total,
            totalPages: totalPages,
            startIdx: startIdx,
            endIdx: endIdx
        };
    }

    function buildCompactPageSequence(currentPage, totalPages) {
        if (totalPages <= 9) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = new Set([1, 2, totalPages - 1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
        const sorted = Array.from(pages).filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
        const result = [];
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
            result.push(sorted[i]);
        }
        return result;
    }

    function renderQbankPaginationFooter(totalItems, currentPage = 1, pageSize = QBANK_DEFAULT_PAGE_SIZE) {
        const bar = ensureQbankPaginationFooterDOM();
        if (!bar) return;

        if (!totalItems || totalItems <= 0) {
            bar.classList.remove("show");
            bar.innerHTML = "";
            return;
        }

        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const safePage = Math.max(1, Math.min(currentPage, totalPages));
        const fromItem = (safePage - 1) * pageSize + 1;
        const toItem = Math.min(safePage * pageSize, totalItems);
        const seq = buildCompactPageSequence(safePage, totalPages);

        const pagesHtml = seq.map(item => {
            if (item === "...") return `<span class="qbank-page-ellipsis">…</span>`;
            const isAct = (item === safePage);
            return `<button type="button" class="qbank-page-btn ${isAct ? "is-active" : ""}" onclick="goToQbankMidPage(${item})" title="Chuyển tới Trang ${item}">${item}</button>`;
        }).join("");

        bar.classList.add("show");
        bar.innerHTML = `
            <span class="qbank-page-info-txt">Trang <b>${safePage}/${totalPages}</b> • Hiển thị <b>${fromItem}–${toItem}</b> / ${totalItems.toLocaleString("vi-VN")} câu (${pageSize}/trang)</span>
            <div class="qbank-page-btns-row">
                <button type="button" class="qbank-page-btn" ${safePage <= 1 ? "disabled" : ""} onclick="goToQbankMidPage(${safePage - 1})" title="Trang trước">◀</button>
                ${pagesHtml}
                <button type="button" class="qbank-page-btn" ${safePage >= totalPages ? "disabled" : ""} onclick="goToQbankMidPage(${safePage + 1})" title="Trang sau">▶</button>
            </div>
        `;
    }

    function goToQbankMidPage(pageNum) {
        if (typeof qbankState === "undefined") return;
        const target = parseInt(pageNum, 10) || 1;
        qbankState.currentMidPage = Math.max(1, target);
        if (typeof renderQbankQuestions === "function") {
            renderQbankQuestions();
        }
        const listEl = document.getElementById("qbank-questions-list");
        if (listEl) listEl.scrollTo({ top: 0, behavior: "smooth" });
    }

    // =========================================================================
    // 3. NÚT "👁️ Xem thử đề" CỘT PHẢI & MODAL XEM THỬ ĐỀ ĐẦY ĐỦ TƯƠNG TÁC
    // =========================================================================
    function ensurePreviewButtonInRightColumn() {
        injectQbankPreviewPaginationStyles();
        const rightCol = document.getElementById("qbank-col-right");
        const saveBtn = document.getElementById("btn-save-extracted-exam");
        if (!rightCol || !saveBtn) return null;

        let prevBtn = document.getElementById("btn-qbank-preview-extracted");
        if (!prevBtn) {
            prevBtn = document.createElement("button");
            prevBtn.type = "button";
            prevBtn.id = "btn-qbank-preview-extracted";
            prevBtn.className = "btn-qbank btn-qbank-preview-extracted is-empty";
            prevBtn.onclick = openQbankExamPreviewModal;
            prevBtn.title = "Mở xem trước toàn bộ đề vừa chọn với đầy đủ công thức, hình vẽ và nút chức năng từng câu";
            prevBtn.innerHTML = `👁️ Xem thử đề (0 câu)`;
            saveBtn.parentNode.insertBefore(prevBtn, saveBtn);
        }
        updatePreviewExtractedButtonUI();
        return prevBtn;
    }

    function updatePreviewExtractedButtonUI() {
        const prevBtn = document.getElementById("btn-qbank-preview-extracted");
        if (!prevBtn || typeof qbankState === "undefined") return;
        const count = (typeof pruneStaleSelectedQuestionIds === "function")
            ? pruneStaleSelectedQuestionIds()
            : qbankState.selectedQuestionIds.size;
        prevBtn.classList.toggle("is-empty", count === 0);
        prevBtn.innerHTML = count > 0
            ? `<span>👁️</span> <span>Xem thử đề (${count} câu)</span>`
            : `<span>👁️</span> <span>Xem thử đề</span>`;
    }

    function hookUpdateQbankBuilderStats() {
        if (_qbBuilderHookInstalled || typeof window.updateQbankBuilderStats !== "function") return;
        _qbBuilderHookInstalled = true;
        const origFn = window.updateQbankBuilderStats;
        window.updateQbankBuilderStats = function(...args) {
            const res = origFn.apply(this, args);
            ensurePreviewButtonInRightColumn();
            updatePreviewExtractedButtonUI();
            return res;
        };
    }

    function ensureQbankPreviewAndPaginationUI() {
        ensureQbankProgressBarDOM();
        ensureQbankPaginationFooterDOM();
        ensurePreviewButtonInRightColumn();
        hookUpdateQbankBuilderStats();
    }

    function ensureQbankExamPreviewModalDOM() {
        injectQbankPreviewPaginationStyles();
        let modal = document.getElementById("modal-qbank-exam-preview");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "modal-qbank-exam-preview";
        modal.className = "qb-preview-overlay";
        modal.onclick = function(e) { if (e.target === modal) closeQbankExamPreviewModal(); };
        modal.innerHTML = `
            <div class="qb-preview-modal-card" onclick="event.stopPropagation()">
                <div class="qb-preview-header">
                    <div class="qb-preview-header-left">
                        <span style="font-size:20px;">👁️</span>
                        <span class="qb-preview-title-text" id="qb-preview-modal-title">XEM THỬ ĐỀ ĐÃ TRÍCH XUẤT</span>
                        <span class="qb-preview-sub-pill" id="qb-preview-modal-count-pill">0 câu</span>
                    </div>
                    <div class="qb-preview-header-tools">
                        <button type="button" class="btn-qbank btn-qbank-warning" id="btn-qb-preview-undo-remove" onclick="undoRemoveInExamPreviewModal()" style="display:none; padding:5px 10px; font-size:11.5px;" title="Hoàn tác bỏ chọn câu vừa rút khỏi đề">
                            ↩️ Hoàn tác bỏ câu
                        </button>
                        <button type="button" id="btn-qb-preview-export-pdf" class="btn-qbank btn-qb-preview-pdf-trigger" style="background:#0d9488; padding:5px 10px; font-size:11.5px;" onclick="typeof togglePreviewPdfExporterMenu==='function' ? togglePreviewPdfExporterMenu(event) : exportFromExamPreviewModal('pdf')" title="Mở tùy chọn Xuất PDF (4 chế độ, chọn số trang & cỡ chữ)">
                            📄 Xuất PDF ▾
                        </button>
                        <button type="button" class="btn-qbank btn-qbank-primary" style="padding:5px 10px; font-size:11.5px;" onclick="exportFromExamPreviewModal('word')" title="Tải file Word (.doc) đề đang xem">
                            📝 Xuất Word
                        </button>
                        <button type="button" class="btn-qbank btn-qbank-success" style="padding:5px 10px; font-size:11.5px;" onclick="saveExamDirectlyFromPreviewModal()" title="Lưu đề này vào Ngân hàng đề (Đã lưu)">
                            💾 Lưu đề vào Ngân hàng
                        </button>
                        <button type="button" onclick="closeQbankExamPreviewModal()" style="background:#334155; color:#fff; border:none; width:28px; height:28px; border-radius:50%; font-size:15px; font-weight:900; cursor:pointer;">✕</button>
                    </div>
                </div>

                <div class="qb-preview-body" id="qb-preview-modal-body"></div>

                <div class="qb-preview-footer">
                    <span style="font-size:11.5px; font-weight:700; color:#475569;">
                        💡 Tại mỗi câu đều có đầy đủ nút chức năng. Bỏ dấu tích <b>☑️ Chọn</b> câu nào, câu đó sẽ tự rút khỏi đề ngay lập tức!
                    </span>
                    <button type="button" class="btn-qbank" style="background:#64748b;" onclick="closeQbankExamPreviewModal()">Đóng</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function getOrderedSelectedPreviewQuestions() {
        if (typeof qbankState === "undefined") return [];
        const pickedRaw = (qbankState.rawQuestions || []).filter(q => q && qbankState.selectedQuestionIds.has(String(q.id)));
        const { orderMap } = (typeof buildTreeOrderMap === "function") ? buildTreeOrderMap() : { orderMap: {} };
        const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };

        return [...pickedRaw].sort((a, b) => {
            const pA = getQbankQuestionPart(a);
            const pB = getQbankQuestionPart(b);
            if (pA !== pB) return pA - pB;

            const ordA = a.folderId ? (orderMap[a.folderId] ?? 999999) : 999999;
            const ordB = b.folderId ? (orderMap[b.folderId] ?? 999999) : 999999;
            if (ordA !== ordB) return ordA - ordB;

            const lA = levelOrder[normalizeQbankLevel(a.level)] || 1;
            const lB = levelOrder[normalizeQbankLevel(b.level)] || 1;
            if (lA !== lB) return lA - lB;

            if (a.matrixSeq && b.matrixSeq) return a.matrixSeq - b.matrixSeq;
            return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
        });
    }

    function buildPreviewDriveBadgeHtml(q, imgUrl, safeQId) {
        const hasDriveBackup = Boolean(q.imageDriveFileId || q.imageBackupUrl || (q.imageDrivePath && q.imageDriveFilename));
        if (hasDriveBackup) {
            const openUrl = q.imageDriveFolderUrl || q.imageDriveUrl || q.imageBackupUrl || "";
            const tip = `Đã sao lưu dự phòng lên Google Drive 5TB\n📁 Đường dẫn: ${q.imageDrivePath || "Kho_anh_ngan_hang_cau_hoi"}\n📄 Tên file: ${q.imageDriveFilename || "Đã lưu"}`;
            if (openUrl) {
                return `<a href="${escapeQbankAttr(openUrl)}" target="_blank" class="btn-qbank-img" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; text-decoration:none;" title="${escapeQbankAttr(tip)}">☁️ Đã lưu Drive</a>`;
            }
            return `<span class="btn-qbank-img" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; cursor:default;" title="${escapeQbankAttr(tip)}">☁️ Đã lưu Drive</span>`;
        }
        if (imgUrl) {
            return `<button type="button" class="btn-qbank-img" style="background:#fef3c7; color:#b45309; border:1px solid #fcd34d;" onclick="backupSingleQbankImageToDrive('${safeQId}')" title="Câu này mới chỉ có link ngoài (ImgBB/Web). Bấm để tạo bản sao lưu vĩnh viễn lên Google Drive 5TB!">☁️ Lưu Drive</button>`;
        }
        return "";
    }

    function buildPreviewQuestionCardHtml(q, displayNum) {
        const letters = ["A", "B", "C", "D"];
        const p = getQbankQuestionPart(q);
        const levelText = getQbankLevelLabel(q.level || "nb");
        const isAssigned = Boolean(q.folderId && q.matrixId);
        const displayIdText = isAssigned ? q.matrixId : `ID gốc: ${q.origIndex || displayNum} • Chưa xếp`;
        const imgKey = String(q.imageKey || `img_q_${q.id}`).replace(/'/g, "");
        const imgUrl = resolveQbankImageUrl(q, qbankState.imagesMap);
        const safeQId = safeQbankJsArg(q.id);
        const attrQId = escapeQbankAttr(q.id);
        const hasAnyImgOrDrive = Boolean(imgUrl || q.imageDriveFileId || q.imageBackupUrl || (q.imageDrivePath && q.imageDriveFilename));
        const driveBadgeHtml = buildPreviewDriveBadgeHtml(q, imgUrl, safeQId);

        const uploaderHtml = `
            <div class="qbank-img-tool-zone" id="zone-qbpreview-${attrQId}" tabindex="0" title="Bấm vào đây rồi ấn Ctrl+V để dán ảnh" style="display:flex; align-items:center; flex-wrap:wrap; gap:5px; background:#f8fafc; padding:3px 7px; border-radius:6px; border:1px dashed #cbd5e1; margin:5px 0;">
                <span style="font-size:10.5px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
                <button type="button" class="btn-qbank-img" onclick="triggerQbPreviewPaste('${safeQId}')">📋 Dán (Ctrl+V)</button>
                <input type="file" id="file-qbpreview-${attrQId}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${safeQId}', '${safeQbankJsArg(imgKey)}')">
                <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbpreview-${safeQId}').click()">📁 Tệp</button>
                ${hasAnyImgOrDrive ? `<button type="button" class="btn-qbank-img" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;" onclick="reloadQBankImg('${safeQId}')" title="Truy cập Google Drive / làm mới lại hình ảnh của câu này">🔄 Tải lại ảnh</button>` : ""}
                ${driveBadgeHtml}
                ${hasAnyImgOrDrive ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${safeQId}', '${safeQbankJsArg(imgKey)}')">🗑 Xóa</button>` : ""}
                <span id="status-qbpreview-${attrQId}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
            </div>
            ${imgUrl ? `<div style="text-align:center; margin:6px 0;"><img src="${escapeQbankAttr(imgUrl)}" onerror="handleQbankImgError(this, '${safeQId}')" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid #cbd5e1;" alt="Hình câu ${displayNum}"></div>` : ""}
        `;

        let contentDetailsHtml = "";
        if (p === 1 && Array.isArray(q.options)) {
            const correctIdx = typeof q.correct === "number" ? q.correct : letters.indexOf(String(q.correct || "A").trim().toUpperCase());
            contentDetailsHtml = `<div class="qbank-options-preview">${q.options.map((opt, oIdx) => `<div class="qbank-opt-item ${oIdx === correctIdx ? "is-correct" : ""}"><span class="qbank-opt-circle">${letters[oIdx] || ""}</span><span>${opt} ${oIdx === correctIdx ? "<b>✓</b>" : ""}</span></div>`).join("")}</div>`;
        } else if (p === 2 && Array.isArray(q.statements)) {
            contentDetailsHtml = `<div style="margin:6px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:6px 8px;">${q.statements.map(st => { const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true"); return `<div style="font-size:12.5px; margin-bottom:3px; display:flex; justify-content:space-between; gap:8px;"><span><b>${st.id})</b> ${st.statement}</span><b style="color:${isTrue ? "#16a34a" : "#dc2626"}; white-space:nowrap;">${isTrue ? "🟢 Đúng" : "🔴 Sai"}</b></div>`; }).join("")}</div>`;
        } else {
            contentDetailsHtml = `<div style="margin:6px 0; font-size:12.5px; font-weight:800; color:#0d9488; background:#f0fdfa; padding:5px 9px; border-radius:7px; border:1px solid #99f6e4; display:inline-block;">🎯 Đáp số: <span style="color:#0f172a;">${escapeQbankHtml(q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || "0"))}</span></div>`;
        }

        const explainHtml = q.explanation ? `<div style="font-size:12px; color:#78350f; background:#fffbeb; padding:6px 9px; border-radius:7px; border-left:3.5px solid #f59e0b; margin-top:6px;">💡 <b>Lời giải:</b> ${q.explanation}</div>` : "";
        const folderTag = q.folderName ? `<span style="font-size:10.5px; color:#16a34a; background:#dcfce7; padding:1px 6px; border-radius:6px; border:1px solid #bbf7d0; font-weight:800;">📁 ${escapeQbankHtml(q.folderName)}</span>` : "";
        const unassignBtnHtml = isAssigned ? `<button type="button" class="btn-soide-mini" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;" onclick="unassignQbankQuestion('${safeQId}')">↩️ Bỏ xếp</button>` : "";

        return `
            <div class="qb-preview-qcard" id="qb-preview-qcard-${attrQId}" data-qid="${attrQId}">
                <div class="qb-preview-qcard-top">
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                        <span class="qb-preview-qnum-pill">Câu ${displayNum}</span>
                        <span class="qbank-q-id-badge ${isAssigned ? "is-assigned" : "is-unassigned"}" style="font-size:10.5px;">${escapeQbankHtml(displayIdText)}</span>
                        <span style="font-size:10.5px; font-weight:800; color:#059669; border:1px solid #10b981; padding:1px 6px; border-radius:6px; background:#ecfdf5;">Phần ${p} • ${levelText}</span>
                        ${folderTag}
                    </div>
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                        ${unassignBtnHtml}
                        <button type="button" class="btn-soide-mini" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;" onclick="promptMoveQuestion('${safeQId}')">🔄 Chuyển</button>
                        <button type="button" class="btn-soide-mini" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;" onclick="deleteQbankQuestion('${safeQId}')">🗑️ Xóa</button>
                        <label class="qb-preview-check-pill" title="Đang chọn trong đề — Bỏ tích để rút câu này khỏi đề">
                            <input type="checkbox" checked onchange="onPreviewCardToggleSelect('${safeQId}', this.checked, this)">
                            <span>Chọn</span>
                        </label>
                    </div>
                </div>
                <div style="font-size:13.5px; font-weight:600; color:#0f172a; line-height:1.48; margin-bottom:4px;">${qbFormatQuestionText(q.question || "")}</div>
                ${uploaderHtml}${contentDetailsHtml}${explainHtml}
            </div>
        `;
    }

    function renderQbankExamPreviewModalBody(preserveScroll = false) {
        const body = document.getElementById("qb-preview-modal-body");
        const titleEl = document.getElementById("qb-preview-modal-title");
        const countPill = document.getElementById("qb-preview-modal-count-pill");
        const undoBtn = document.getElementById("btn-qb-preview-undo-remove");
        if (!body) return;

        const prevScrollTop = preserveScroll ? body.scrollTop : 0;
        const examNameInput = document.getElementById("qbank-exam-name");
        const gradeSel = document.getElementById("qbank-exam-grade");
        const examTitle = (examNameInput && examNameInput.value.trim()) ? examNameInput.value.trim() : "ĐỀ THI XEM THỬ TỪ NGÂN HÀNG";
        const gradeText = (gradeSel && gradeSel.options[gradeSel.selectedIndex]) ? gradeSel.options[gradeSel.selectedIndex].text : "Khối Lớp 11";

        const ordered = getOrderedSelectedPreviewQuestions();
        const p1 = ordered.filter(q => getQbankQuestionPart(q) === 1);
        const p2 = ordered.filter(q => getQbankQuestionPart(q) === 2);
        const p3 = ordered.filter(q => getQbankQuestionPart(q) === 3);
        const p4 = ordered.filter(q => getQbankQuestionPart(q) === 4);

        if (titleEl) titleEl.textContent = `👁️ XEM THỬ ĐỀ: ${examTitle}`;
        if (countPill) countPill.textContent = `${ordered.length} câu (P1:${p1.length} • P2:${p2.length} • P3:${p3.length} • P4:${p4.length})`;
        if (undoBtn) {
            if (_qbPreviewRemovedUndoStack.length > 0) {
                undoBtn.style.display = "inline-flex";
                undoBtn.innerHTML = `↩️ Hoàn tác bỏ câu (${_qbPreviewRemovedUndoStack.length})`;
            } else {
                undoBtn.style.display = "none";
            }
        }

        if (ordered.length === 0) {
            body.innerHTML = `
                <div style="background:#fff; border:1.5px dashed #cbd5e1; border-radius:14px; padding:42px 20px; text-align:center; color:#64748b;">
                    <div style="font-size:40px; margin-bottom:8px;">📭</div>
                    <b style="font-size:15px; color:#0f172a; display:block;">Đề xem thử hiện không còn câu hỏi nào!</b>
                    <p style="font-size:12.5px; margin-top:6px;">Bạn đã rút hết toàn bộ câu khỏi đề. Hãy đóng cửa sổ để tích chọn thêm ở cột giữa hoặc bấm <b>↩️ Hoàn tác bỏ câu</b>.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="qb-preview-exam-paper-head">
                <h2>${escapeQbankHtml(examTitle)}</h2>
                <div style="font-size:12px; color:#475569; font-weight:700; margin-top:4px;">
                    ${escapeQbankHtml(gradeText)} &nbsp;•&nbsp; Tổng số: <b>${ordered.length} câu</b>
                    (Phần I: ${p1.length} • Phần II: ${p2.length} • Phần III: ${p3.length} • Phần IV: ${p4.length})
                </div>
            </div>
        `;

        let qNum = 1;
        if (p1.length > 0) {
            html += `<div class="qb-preview-part-banner part-1"><span>📑 PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN</span><span>${p1.length} câu</span></div>`;
            p1.forEach(q => { html += buildPreviewQuestionCardHtml(q, qNum++); });
        }
        if (p2.length > 0) {
            html += `<div class="qb-preview-part-banner part-2"><span>⚖️ PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI</span><span>${p2.length} câu</span></div>`;
            p2.forEach(q => { html += buildPreviewQuestionCardHtml(q, qNum++); });
        }
        if (p3.length > 0) {
            html += `<div class="qb-preview-part-banner part-3"><span>✍️ PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN</span><span>${p3.length} câu</span></div>`;
            p3.forEach(q => { html += buildPreviewQuestionCardHtml(q, qNum++); });
        }
        if (p4.length > 0) {
            html += `<div class="qb-preview-part-banner part-4"><span>📝 PHẦN IV. CÂU TỰ LUẬN NGẮN</span><span>${p4.length} câu</span></div>`;
            p4.forEach(q => { html += buildPreviewQuestionCardHtml(q, qNum++); });
        }

        body.innerHTML = html;
        if (preserveScroll) body.scrollTop = prevScrollTop;

        if (window.MathJax && MathJax.typesetPromise) {
            try { MathJax.typesetPromise([body]).catch(() => {}); } catch (e) {}
        }
    }

    function openQbankExamPreviewModal() {
        if (typeof requireQbankAdminOrPrompt === "function" && !requireQbankAdminOrPrompt()) return;
        const count = (typeof pruneStaleSelectedQuestionIds === "function")
            ? pruneStaleSelectedQuestionIds()
            : qbankState.selectedQuestionIds.size;

        if (count === 0) {
            if (typeof showQbankToast === "function") {
                showQbankToast("⚠️ Chưa tích chọn câu hỏi nào ở cột giữa để xem thử đề!", "warning");
            } else {
                alert("⚠️ Thầy chưa tích chọn câu hỏi nào ở cột giữa!");
            }
            return;
        }

        _qbPreviewRemovedUndoStack = [];
        const modal = ensureQbankExamPreviewModalDOM();
        renderQbankExamPreviewModalBody(false);
        modal.classList.add("show");
    }

    function closeQbankExamPreviewModal() {
        if (typeof closePreviewPdfExporterMenu === "function") closePreviewPdfExporterMenu();
        const modal = document.getElementById("modal-qbank-exam-preview");
        if (modal) modal.classList.remove("show");
        _qbPreviewRemovedUndoStack = [];
    }

    function refreshQbankExamPreviewModalIfOpen() {
        const modal = document.getElementById("modal-qbank-exam-preview");
        if (modal && modal.classList.contains("show")) {
            renderQbankExamPreviewModalBody(true);
        }
    }

    function triggerQbPreviewPaste(qId) {
        const z = document.getElementById(`zone-qbpreview-${qId}`);
        if (z) z.focus();
        if (typeof showQbankToast === "function") {
            showQbankToast("📋 Hãy nhấn Ctrl + V để dán ảnh chụp vào câu này!", "info");
        }
    }

    function onPreviewCardToggleSelect(qId, isChecked, checkboxEl) {
        const idStr = String(qId);
        if (isChecked) return;

        _qbPreviewRemovedUndoStack.push(idStr);
        qbankState.selectedQuestionIds.delete(idStr);

        const midCard = document.getElementById(`qbank-card-${idStr}`);
        if (midCard) {
            midCard.classList.remove("selected");
            const midChk = midCard.querySelector('.qbank-q-header input[type="checkbox"]');
            if (midChk) midChk.checked = false;
        }
        if (typeof updateQbankDeleteSelectedButtonUI === "function") updateQbankDeleteSelectedButtonUI();
        if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();

        const previewCard = checkboxEl ? checkboxEl.closest(".qb-preview-qcard") : document.getElementById(`qb-preview-qcard-${idStr}`);
        if (previewCard) previewCard.classList.add("is-removing");

        setTimeout(() => {
            renderQbankExamPreviewModalBody(true);
            if (typeof showQbankToast === "function") {
                showQbankToast("↩️ Đã rút 1 câu khỏi đề! (Có thể bấm Hoàn tác bỏ câu nếu cần)", "info");
            }
        }, 170);
    }

    function undoRemoveInExamPreviewModal() {
        if (_qbPreviewRemovedUndoStack.length === 0) return;
        const idStr = _qbPreviewRemovedUndoStack.pop();
        const exists = (qbankState.rawQuestions || []).some(q => q && String(q.id) === idStr);
        if (exists) {
            qbankState.selectedQuestionIds.add(idStr);
            const midCard = document.getElementById(`qbank-card-${idStr}`);
            if (midCard) {
                midCard.classList.add("selected");
                const midChk = midCard.querySelector('.qbank-q-header input[type="checkbox"]');
                if (midChk) midChk.checked = true;
            }
            if (typeof updateQbankDeleteSelectedButtonUI === "function") updateQbankDeleteSelectedButtonUI();
            if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
            renderQbankExamPreviewModalBody(true);
            if (typeof showQbankToast === "function") showQbankToast("✅ Đã khôi phục câu vừa rút vào đề!", "success");
        }
    }

    function exportFromExamPreviewModal(format) {
        const ordered = getOrderedSelectedPreviewQuestions();
        if (ordered.length === 0) return alert("⚠️ Đề không có câu nào để xuất!");
        const titleInp = document.getElementById("qbank-exam-name");
        const exportTitle = (titleInp && titleInp.value.trim()) ? titleInp.value.trim() : `ĐỀ TRÍCH XUẤT (${ordered.length} CÂU)`;
        const includeKey = confirm(`Xuất "${exportTitle}" ra ${format === "pdf" ? "PDF" : "Word"}:\n\n• Bấm [OK] để xuất KÈM ĐÁP ÁN & LỜI GIẢI\n• Bấm [Cancel] để xuất CHỈ ĐỀ THI (không đáp án)`);

        const exportImagesMap = { ...(qbankState.imagesMap || {}) };
        const normalizedQuestions = ordered.map((rawQ, idx) =>
            typeof normalizeQuestionForExamOutput === "function"
                ? normalizeQuestionForExamOutput(rawQ, idx, exportImagesMap)
                : rawQ
        );
        const exportData = { title: exportTitle, maDe: "101", timeLimitMinutes: 90, questions: normalizedQuestions, images: exportImagesMap };

        if (format === "pdf") {
            if (typeof exportExamToPDF !== "function") return alert("❌ Không tìm thấy bộ xuất PDF!");
            exportExamToPDF(exportData, exportTitle, "101", 90, includeKey);
        } else {
            if (typeof exportExamToWord !== "function") return alert("❌ Không tìm thấy bộ xuất Word!");
            exportExamToWord(exportData, exportTitle, "101", 90, includeKey);
        }
    }

    async function saveExamDirectlyFromPreviewModal() {
        if (typeof saveExtractedExamToBank !== "function") return;
        const titleInp = document.getElementById("qbank-exam-name");
        if (titleInp && !titleInp.value.trim()) {
            const inputName = prompt("✏️ Nhập Tên đề thi mới trước khi lưu vào Ngân hàng:", "Đề kiểm tra trích xuất");
            if (!inputName || !inputName.trim()) return;
            titleInp.value = inputName.trim();
        }
        closeQbankExamPreviewModal();
        await saveExtractedExamToBank();
    }

    document.addEventListener("keydown", function(e) {
        if (e.key !== "Escape") return;
        const pdfPop = document.getElementById("qb-pdf-export-popover");
        if (pdfPop && pdfPop.classList.contains("show")) {
            e.stopPropagation();
            if (typeof closePreviewPdfExporterMenu === "function") closePreviewPdfExporterMenu();
            return;
        }
        const prevModal = document.getElementById("modal-qbank-exam-preview");
        if (prevModal && prevModal.classList.contains("show")) {
            e.stopPropagation();
            closeQbankExamPreviewModal();
        }
    }, true);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensureQbankPreviewAndPaginationUI);
    } else {
        ensureQbankPreviewAndPaginationUI();
    }

    window.ensureQbankPreviewAndPaginationUI = ensureQbankPreviewAndPaginationUI;
    window.startQbankProgressBar = startQbankProgressBar;
    window.updateQbankProgressBar = updateQbankProgressBar;
    window.finishQbankProgressBar = finishQbankProgressBar;
    window.paginateQbankQuestionsList = paginateQbankQuestionsList;
    window.renderQbankPaginationFooter = renderQbankPaginationFooter;
    window.goToQbankMidPage = goToQbankMidPage;
    window.openQbankExamPreviewModal = openQbankExamPreviewModal;
    window.closeQbankExamPreviewModal = closeQbankExamPreviewModal;
    window.refreshQbankExamPreviewModalIfOpen = refreshQbankExamPreviewModalIfOpen;
    window.triggerQbPreviewPaste = triggerQbPreviewPaste;
    window.onPreviewCardToggleSelect = onPreviewCardToggleSelect;
    window.undoRemoveInExamPreviewModal = undoRemoveInExamPreviewModal;
    window.exportFromExamPreviewModal = exportFromExamPreviewModal;
    window.saveExamDirectlyFromPreviewModal = saveExamDirectlyFromPreviewModal;
})();
