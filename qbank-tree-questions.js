// =========================================================
// FILE: qbank-tree-questions.js
// MODULE 2/4 CỦA HỆ THỐNG NGÂN HÀNG ĐỀ:
// - CỘT 1: CÂY THƯ MỤC KIẾN THỨC, NÚT SIÊU NHỎ ẨN/HIỆN NÚT CHỨC NĂNG & MA TRẬN 16 Ô KÉO THẢ
// - CỘT 2:
//   + NÚT "📥 Upload file JSON đề" XÒE RA 4 KHO CHỜ XẾP (10, 11, 12, HSG 11)
//   + DUYỆT THƯ MỤC 3 CẤP (THƯ MỤC GỐC 4 KHO -> KHO LỚP -> CHI TIẾT ĐỀ) + NÚT BACK
//   + ĐỀ MỚI LÊN TRÊN, ĐỀ CŨ XUỐNG DƯỚI, ĐỦ NÚT (CHUYỂN LỚP, LÊN, XUỐNG, ĐỔI TÊN, XÓA)
//   + GIỮ NGUYÊN THANH NÚT BẤM & MA TRẬN THỐNG KÊ SỐ CÂU Ở MỌI CỬA SỔ
//   + MENU XÓA NHIỀU CÂU 3 TÙY CHỌN & DÁN ẢNH CTRL+V (CHẶN TUYỆT ĐỐI BASE64 LỌT VÀO DB)
// - TRANG CHỦ 8 LỚP: NÚT "🏦 Chuyển ngân hàng đề" MỞ POPUP CHỌN 4 KHO CHỜ XẾP
// =========================================================

let _qbankLeafHoverTimer = null;
let _qbankLeafHoverFolderId = null;

const QBANK_TREE_VIS_STORAGE_KEY = "qbank_tree_vis_prefs_v1";
let _qbankTreeVisPrefs = null;

function cancelLeafAutoExpandTimer() {
    if (_qbankLeafHoverTimer) {
        clearTimeout(_qbankLeafHoverTimer);
        _qbankLeafHoverTimer = null;
    }
    _qbankLeafHoverFolderId = null;
}

// ============================================================================
// 0. TÙY CHỌN ẨN/HIỆN CÁC NÚT CHỨC NĂNG CUỐI MỖI THƯ MỤC (CỘT TRÁI)
// ============================================================================
function getQbankTreeVisPrefs() {
    if (_qbankTreeVisPrefs) return _qbankTreeVisPrefs;
    const prefs = { hideEditTools: false, hideMatrixBtn: false };
    try {
        const raw = localStorage.getItem(QBANK_TREE_VIS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                prefs.hideEditTools = Boolean(parsed.hideEditTools);
                prefs.hideMatrixBtn = Boolean(parsed.hideMatrixBtn);
            }
        }
    } catch (e) {}
    _qbankTreeVisPrefs = prefs;
    return _qbankTreeVisPrefs;
}

function saveQbankTreeVisPrefs(prefs) {
    _qbankTreeVisPrefs = {
        hideEditTools: Boolean(prefs && prefs.hideEditTools),
        hideMatrixBtn: Boolean(prefs && prefs.hideMatrixBtn)
    };
    try {
        localStorage.setItem(QBANK_TREE_VIS_STORAGE_KEY, JSON.stringify(_qbankTreeVisPrefs));
    } catch (e) {}
}

function ensureQbankTreeVisMenuInDOM() {
    let menu = document.getElementById("qbank-tree-vis-menu");
    if (menu) return menu;

    const host = document.getElementById("modal-qbank-creator") || document.body;
    if (!host) return null;

    menu = document.createElement("div");
    menu.id = "qbank-tree-vis-menu";
    menu.className = "qbank-tree-vis-menu";
    menu.onclick = function(e) { e.stopPropagation(); };
    menu.innerHTML = `
        <div class="qbank-tree-vis-header">
            <span>👁️ ẨN NÚT CUỐI THƯ MỤC</span>
            <button type="button" class="qbank-tree-vis-close" onclick="closeQbankTreeVisMenu()" title="Đóng">✕</button>
        </div>
        <label class="qbank-tree-vis-opt">
            <input type="checkbox" id="chk-tree-hide-edit-tools" onchange="setQbankTreeVisOption('hideEditTools', this.checked)">
            <div>
                <b>Ẩn Đổi màu, Sửa (✏️), +, Xóa (✕)</b>
                <small>Giúp tên chương / bài hiển thị rộng tối đa</small>
            </div>
        </label>
        <label class="qbank-tree-vis-opt">
            <input type="checkbox" id="chk-tree-hide-matrix-btn" onchange="setQbankTreeVisOption('hideMatrixBtn', this.checked)">
            <div>
                <b>Ẩn nút Ma trận 16 ô (⊞)</b>
                <small>Bấm vào tên bài hoặc kéo câu qua vẫn tự mở</small>
            </div>
        </label>
        <div class="qbank-tree-vis-footer">
            <button type="button" class="qbank-tree-vis-quick" onclick="setAllQbankTreeVisOptions(true)">🙈 Ẩn tất cả</button>
            <button type="button" class="qbank-tree-vis-quick is-show" onclick="setAllQbankTreeVisOptions(false)">👁️ Hiện tất cả</button>
        </div>
    `;
    host.appendChild(menu);
    return menu;
}

function syncQbankTreeVisMenuCheckboxes() {
    const prefs = getQbankTreeVisPrefs();
    const chkEdit = document.getElementById("chk-tree-hide-edit-tools");
    const chkMatrix = document.getElementById("chk-tree-hide-matrix-btn");
    if (chkEdit) chkEdit.checked = Boolean(prefs.hideEditTools);
    if (chkMatrix) chkMatrix.checked = Boolean(prefs.hideMatrixBtn);
}

function closeQbankTreeVisMenu() {
    const menu = document.getElementById("qbank-tree-vis-menu");
    const btn = document.getElementById("btn-qbank-tree-vis-toggle");
    if (menu) menu.classList.remove("show");
    if (btn) btn.classList.remove("is-open");
}

function toggleQbankTreeVisMenu(event) {
    const ev = event || window.event;
    if (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
    }
    const menu = ensureQbankTreeVisMenuInDOM();
    const btn = document.getElementById("btn-qbank-tree-vis-toggle");
    if (!menu || !btn) return;

    if (menu.classList.contains("show")) {
        closeQbankTreeVisMenu();
        return;
    }

    closeQbankDeleteMultiMenu();
    closeQbankUploadMenu();
    if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();

    syncQbankTreeVisMenuCheckboxes();
    menu.classList.add("show");
    btn.classList.add("is-open");

    const rect = btn.getBoundingClientRect();
    const menuW = Math.min(268, window.innerWidth - 20);
    const approxH = menu.offsetHeight || 160;
    let left = Math.max(10, Math.min(rect.left, window.innerWidth - menuW - 10));
    let top = rect.bottom + 5;
    if (top + approxH > window.innerHeight - 10 && rect.top > approxH + 10) {
        top = rect.top - approxH - 5;
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
}

function setQbankTreeVisOption(key, isChecked) {
    const prefs = { ...getQbankTreeVisPrefs() };
    prefs[key] = Boolean(isChecked);
    saveQbankTreeVisPrefs(prefs);
    syncQbankTreeVisMenuCheckboxes();
    renderQbankTree();
    const btn = document.getElementById("btn-qbank-tree-vis-toggle");
    const menu = document.getElementById("qbank-tree-vis-menu");
    if (btn && menu && menu.classList.contains("show")) btn.classList.add("is-open");
}

function setAllQbankTreeVisOptions(hideAll) {
    saveQbankTreeVisPrefs({ hideEditTools: Boolean(hideAll), hideMatrixBtn: Boolean(hideAll) });
    syncQbankTreeVisMenuCheckboxes();
    renderQbankTree();
    const btn = document.getElementById("btn-qbank-tree-vis-toggle");
    const menu = document.getElementById("qbank-tree-vis-menu");
    if (btn && menu && menu.classList.contains("show")) btn.classList.add("is-open");
}

// ============================================================================
// 1. CHUYỂN ĐỀ TỪ 8 LỚP NGOÀI TRANG CHỦ SANG 1 TRONG 4 KHO CHỜ XẾP
// ============================================================================
function findClassItemFallback(categoryId, itemId, quizId) {
    const allCats = [
        ...(typeof DAY_THEM_CATEGORIES !== "undefined" ? DAY_THEM_CATEGORIES : []),
        ...(typeof CHINH_KHOA_CATEGORIES !== "undefined" ? CHINH_KHOA_CATEGORIES : []),
        ...(typeof KHO_TAI_LIEU_FOLDER !== "undefined" ? [KHO_TAI_LIEU_FOLDER] : [])
    ];
    for (const c of allCats) {
        if (!c || !Array.isArray(c.links)) continue;
        if (categoryId && c.id !== categoryId) continue;
        const found = c.links.find(l => l && (l.id === itemId || l.firebaseId === itemId || l.id === quizId || l.firebaseId === quizId));
        if (found) return found;
    }
    return null;
}

function normalizeQuestionAnswerOnTransfer(q) {
    if (!q) return;
    const letters = ["A", "B", "C", "D"];
    const part = getQbankQuestionPart(q);
    q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");

    if (part === 1) {
        q.type = "multiple_choice";
        q.part = 1;
        q.isPart4 = false;
        let rawCorrect = q.correct !== undefined ? q.correct : (q.answer !== undefined ? q.answer : q.dapan);
        if (typeof rawCorrect === "string") {
            const u = rawCorrect.trim().toUpperCase();
            const idx = letters.indexOf(u);
            q.correct = idx !== -1 ? idx : (parseInt(u, 10) >= 0 && parseInt(u, 10) <= 3 ? parseInt(u, 10) : 0);
        } else if (typeof rawCorrect === "number" && rawCorrect >= 0 && rawCorrect <= 3) {
            q.correct = rawCorrect;
        } else if (q.correct === undefined) {
            q.correct = 0;
        }
    } else if (part === 2) {
        q.type = "true_false";
        q.part = 2;
        q.isPart4 = false;
        if (Array.isArray(q.statements)) {
            q.statements.forEach((st, sIdx) => {
                if (!st.id) st.id = ["a", "b", "c", "d"][sIdx] || String(sIdx + 1);
                let val = st.correct !== undefined ? st.correct : (st.answer !== undefined ? st.answer : st.dapan);
                st.correct = val !== undefined ? (val === true || String(val).toLowerCase() === "đúng" || String(val).toLowerCase() === "true") : true;
            });
        }
    } else {
        if (part === 4) {
            q.part = 4;
            q.isPart4 = true;
            if (q.type !== "essay" && q.type !== "essay_answer" && q.type !== "part4") {
                q.type = "short_answer";
            }
        } else {
            q.type = "short_answer";
            q.part = 3;
            q.isPart4 = false;
        }
        let ans = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer !== undefined ? q.correct_answer : (q.correct !== undefined ? q.correct : (q.answer !== undefined ? q.answer : q.dapan)));
        q.correctAnswer = (ans !== undefined && ans !== null) ? String(ans).trim() : "0";
    }
}

function closeClassTransferKhoPopover() {
    const overlay = document.getElementById("qbank-transfer-kho-overlay");
    if (overlay) overlay.remove();
}

function getKhoPendingStats(khoId) {
    const exams = (qbankState.pendingExams || []).filter(e => e.khoId === khoId);
    const examIds = new Set(exams.map(e => String(e.id)));
    let unassigned = 0;
    let assigned = 0;
    (qbankState.rawQuestions || []).forEach(q => {
        if (!q) return;
        const matchKho = (q.pendingKhoId === khoId) || (q.pendingExamId && examIds.has(String(q.pendingExamId)));
        if (!matchKho) return;
        if (q.folderId) assigned++;
        else unassigned++;
    });
    return { examCount: exams.length, unassigned, assigned, total: unassigned + assigned };
}

function transferClassExamToQBank(quizId, categoryId, itemId, event) {
    const ev = event || window.event;
    if (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
    }
    if (!requireQbankAdminOrPrompt()) return;

    closeClassTransferKhoPopover();

    const fallbackItem = findClassItemFallback(categoryId, itemId, quizId);
    const examTitle = (fallbackItem && fallbackItem.title && String(fallbackItem.title).trim()) || `Đề thi ${quizId}`;
    const suggestedKhoId = guessPendingKhoId(categoryId, examTitle);
    const catDisplayName = (typeof getCategoryDisplayName === "function") ? getCategoryDisplayName(categoryId) : (categoryId || "");

    const overlay = document.createElement("div");
    overlay.id = "qbank-transfer-kho-overlay";
    overlay.className = "qbank-transfer-kho-overlay";
    overlay.onclick = function(e) { if (e.target === overlay) closeClassTransferKhoPopover(); };

    const safeQ = safeQbankJsArg(quizId);
    const safeC = safeQbankJsArg(categoryId);
    const safeI = safeQbankJsArg(itemId);

    const khoCardsHtml = QBANK_PENDING_KHOS.map(kho => {
        const isSuggested = (kho.id === suggestedKhoId);
        const st = getKhoPendingStats(kho.id);
        return `
            <button type="button" class="qbank-transfer-kho-item ${isSuggested ? "is-suggested" : ""}" style="--kho-color:${kho.color}; --kho-bg:${kho.bg}; --kho-border:${kho.border};" onclick="executeTransferClassExamToKho('${safeQ}', '${safeC}', '${safeI}', '${safeQbankJsArg(kho.id)}', this)">
                <div class="qbank-tk-left">
                    <span class="qbank-tk-icon">${kho.icon}</span>
                    <div class="qbank-tk-text">
                        <b>${escapeQbankHtml(kho.name)}</b>
                        <small>${st.examCount} đề • ${st.unassigned} câu đang chờ xếp</small>
                    </div>
                </div>
                <div class="qbank-tk-right">
                    ${isSuggested ? `<span class="qbank-suggest-pill">✨ Gợi ý</span>` : ""}
                    <span class="qbank-tk-arrow">➔</span>
                </div>
            </button>
        `;
    }).join("");

    overlay.innerHTML = `
        <div class="qbank-transfer-kho-modal" onclick="event.stopPropagation()">
            <div class="qbank-tk-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:20px;">🏦</span>
                    <div>
                        <b>CHUYỂN ĐỀ VÀO KHO CHỜ XẾP</b>
                        <small>Nguồn: ${escapeQbankHtml(catDisplayName || "Lớp học")}</small>
                    </div>
                </div>
                <button type="button" class="qbank-tk-close" onclick="closeClassTransferKhoPopover()" title="Đóng">✕</button>
            </div>
            <div class="qbank-tk-exam-preview">
                <span>📄</span>
                <b title="${escapeQbankAttr(examTitle)}">${escapeQbankHtml(examTitle)}</b>
            </div>
            <div class="qbank-tk-subtitle">Chọn 1 trong 4 thư mục kho chờ xếp để chuyển thẳng đề vào đó:</div>
            <div class="qbank-tk-grid" id="qbank-tk-grid">
                ${khoCardsHtml}
            </div>
            <div class="qbank-tk-status" id="qbank-tk-status" style="display:none;"></div>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function executeTransferClassExamToKho(quizId, categoryId, itemId, targetKhoId, clickedBtn = null) {
    if (!requireQbankAdminOrPrompt()) return;
    const statusEl = document.getElementById("qbank-tk-status");
    const gridEl = document.getElementById("qbank-tk-grid");
    const khoMeta = getPendingKhoMeta(targetKhoId);

    if (gridEl) gridEl.querySelectorAll("button").forEach(b => { b.disabled = true; });
    if (clickedBtn) clickedBtn.classList.add("is-loading");
    if (statusEl) {
        statusEl.style.display = "block";
        statusEl.innerHTML = `⏳ Đang tải đề thi và chuyển vào <b>${escapeQbankHtml(khoMeta.name)}</b>...`;
    }

    try {
        const client = getQbankSupabaseClient();
        if (!client) throw new Error("Chưa kết nối được cơ sở dữ liệu Supabase!");

        let quizRecord = null;
        const candidateIds = Array.from(new Set([quizId, itemId].filter(v => v && String(v).trim() !== "")));
        for (const idVal of candidateIds) {
            const { data, error } = await client.from("quizzes").select("*").eq("id", idVal).maybeSingle();
            if (!error && data && Array.isArray(data.questions) && data.questions.length > 0) { quizRecord = data; break; }
        }
        if (!quizRecord) throw new Error("Không tìm thấy dữ liệu câu hỏi của đề thi này trên Supabase!");

        const fallbackItem = findClassItemFallback(categoryId, itemId, quizId);
        const examTitle = (quizRecord.title && String(quizRecord.title).trim()) || (fallbackItem && fallbackItem.title && String(fallbackItem.title).trim()) || `Đề thi ${quizId}`;
        const rawQuestions = Array.isArray(quizRecord.questions) ? quizRecord.questions : [];
        const rawImages = (quizRecord.images && typeof quizRecord.images === "object") ? quizRecord.images : {};

        await loadQbankDraftState();

        pushQbankUndoState(`Chuyển đề "${examTitle}" vào ${khoMeta.name}`);
        if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") qbankState.imagesMap = {};
        if (!Array.isArray(qbankState.pendingExams)) qbankState.pendingExams = [];

        const nowTs = Date.now();
        const newPendingExam = {
            id: `pexam_${nowTs}_${Math.floor(Math.random() * 10000)}`,
            title: examTitle,
            khoId: targetKhoId,
            createdAt: nowTs,
            sourceQuizId: quizRecord.id || quizId || "",
            sourceCategoryId: categoryId || ""
        };
        qbankState.pendingExams.unshift(newPendingExam);

        let transferredImageCount = 0;
        const importedQuestions = rawQuestions.map((item, idx) => {
            const q = JSON.parse(JSON.stringify(item));
            const resolvedImgUrl = resolveQbankImageUrl(q, rawImages);
            q.id = `qb_${nowTs}_${idx + 1}_${Math.floor(Math.random() * 1000)}`;
            q.origIndex = idx + 1;
            q.sourceExam = examTitle;
            q.sourceQuizId = quizRecord.id || quizId;
            q.sourceCategoryId = categoryId || "";
            q.pendingExamId = newPendingExam.id;
            q.pendingKhoId = targetKhoId;
            q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = "";
            delete q.assignedAt;
            q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
            normalizeQuestionAnswerOnTransfer(q);
            if (resolvedImgUrl && !isBase64DataUrl(resolvedImgUrl)) {
                const uniqueImgKey = `img_q_${q.id}`;
                q.imageUrl = resolvedImgUrl; q.imageKey = uniqueImgKey;
                qbankState.imagesMap[uniqueImgKey] = resolvedImgUrl;
                transferredImageCount++;
            } else {
                q.imageUrl = ""; q.imageKey = `img_q_${q.id}`;
            }
            return q;
        });

        qbankState.rawQuestions = [...(qbankState.rawQuestions || []), ...importedQuestions];
        qbankState.currentExamTitle = examTitle;
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
        qbankState.assignMode = true; qbankState.hideAssigned = false;
        qbankState.pendingNav = { mode: "kho", khoId: targetKhoId, examId: null };

        ensureQbankPendingExamsIntegrity();
        recomputeAllMatrixIds();
        await saveQbankDraftState(false);

        closeClassTransferKhoPopover();
        await openQbankCreatorModal({ skipDraftReload: true });

        const listEl = document.getElementById("qbank-questions-list");
        if (listEl) listEl.scrollTop = 0;
        showQbankToast(`✅ Đã chuyển "${examTitle}" (${importedQuestions.length} câu${transferredImageCount > 0 ? `, ${transferredImageCount} ảnh` : ""}) vào ${khoMeta.name}!`, "success");
    } catch (err) {
        if (gridEl) gridEl.querySelectorAll("button").forEach(b => { b.disabled = false; b.classList.remove("is-loading"); });
        if (statusEl) {
            statusEl.style.display = "block";
            statusEl.style.color = "#dc2626";
            statusEl.textContent = "❌ Lỗi: " + (err.message || err);
        }
        alert("❌ Lỗi chuyển đề sang Ngân hàng đề: " + (err.message || err));
    }
}

// ============================================================================
// 2. MENU XÒE 4 KHO Ở NÚT "📥 Upload file JSON đề" & ĐIỀU HƯỚNG 3 CẤP
// ============================================================================
function ensureQbankUploadDropdownInDOM() {
    const toolsRow = document.querySelector("#qbank-col-mid .qbank-tools-row");
    if (!toolsRow) return null;

    let btn = document.getElementById("btn-qbank-upload-json") ||
        Array.from(toolsRow.querySelectorAll("button")).find(b =>
            (b.getAttribute("onclick") || "").includes("triggerQbankUpload") ||
            (b.textContent || "").includes("Upload file JSON")
        );
    if (!btn) return null;
    btn.id = "btn-qbank-upload-json";
    if (!btn.dataset.caretAdded) {
        btn.dataset.caretAdded = "true";
        btn.innerHTML = `📥 Upload file JSON đề ▾`;
        btn.title = "Mở 4 Kho chờ xếp (Lớp 10, 11, 12, HSG 11) để chọn nơi upload và quản lý đề chờ xếp";
    }

    let wrapper = btn.closest(".qbank-upload-dropdown-wrapper");
    if (!wrapper && btn.parentNode) {
        wrapper = document.createElement("div");
        wrapper.className = "qbank-upload-dropdown-wrapper";
        wrapper.id = "qbank-upload-dropdown-wrapper";
        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
    }

    let menu = document.getElementById("qbank-upload-menu");
    if (!menu && wrapper) {
        menu = document.createElement("div");
        menu.id = "qbank-upload-menu";
        menu.className = "qbank-upload-menu";
        menu.onclick = function(e) { e.stopPropagation(); };

        const itemsHtml = QBANK_PENDING_KHOS.map(kho => `
            <div class="qbank-upload-menu-item" onclick="openPendingKhoFolder('${safeQbankJsArg(kho.id)}', event)">
                <div class="qbank-upload-item-left">
                    <span class="qbank-upload-item-icon">${kho.icon}</span>
                    <div class="qbank-upload-item-text">
                        <b>${escapeQbankHtml(kho.name)}</b>
                        <small>Mở thư mục &amp; tải file đề vào ${escapeQbankHtml(kho.shortName)}</small>
                    </div>
                </div>
                <span class="qbank-upload-kho-badge" id="qbank-upload-badge-${escapeQbankAttr(kho.id)}">0 đề</span>
            </div>
        `).join("");

        menu.innerHTML = `
            <div class="qbank-upload-menu-header">
                <span>📥 CHỌN KHO CHỜ XẾP</span>
                <button type="button" class="qbank-upload-root-btn" onclick="openPendingRootFolder(event)" title="Mở thư mục gốc chứa cả 4 kho">📂 Thư mục gốc</button>
            </div>
            ${itemsHtml}
        `;
        wrapper.appendChild(menu);
    }

    return menu;
}

function updateQbankUploadMenuCounts() {
    ensureQbankUploadDropdownInDOM();
    QBANK_PENDING_KHOS.forEach(kho => {
        const badge = document.getElementById(`qbank-upload-badge-${kho.id}`);
        if (!badge) return;
        const st = getKhoPendingStats(kho.id);
        badge.textContent = st.unassigned > 0 ? `${st.examCount} đề • ${st.unassigned} câu` : `${st.examCount} đề`;
        badge.classList.toggle("has-items", st.examCount > 0);
    });
}

function closeQbankUploadMenu() {
    const menu = document.getElementById("qbank-upload-menu");
    const btn = document.getElementById("btn-qbank-upload-json");
    if (menu) menu.classList.remove("show");
    if (btn) btn.classList.remove("is-open");
}

function toggleQbankUploadMenu(e) {
    const ev = e || window.event;
    if (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
    }
    const menu = ensureQbankUploadDropdownInDOM();
    const btn = document.getElementById("btn-qbank-upload-json");
    if (!menu || !btn) return;

    if (menu.classList.contains("show")) {
        closeQbankUploadMenu();
        return;
    }

    closeQbankDeleteMultiMenu();
    closeQbankTreeVisMenu();
    if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();
    updateQbankUploadMenuCounts();

    menu.classList.add("show");
    btn.classList.add("is-open");

    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.min(315, window.innerWidth * 0.92);
    let left = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10));
    const approxHeight = menu.offsetHeight || 255;
    let top = rect.bottom + 6;
    if (top + approxHeight > window.innerHeight - 10 && rect.top > approxHeight + 10) {
        top = rect.top - approxHeight - 6;
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
}

function triggerQbankUpload(e) {
    toggleQbankUploadMenu(e);
}

function openPendingRootFolder(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    closeQbankUploadMenu();
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null;
    qbankState.activeFolderObj = null;
    qbankState.pendingNav = { mode: "root", khoId: null, examId: null };
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function openPendingKhoFolder(khoId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    closeQbankUploadMenu();
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null;
    qbankState.activeFolderObj = null;
    qbankState.pendingNav = { mode: "kho", khoId: khoId, examId: null };
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function openPendingExamDetail(examId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const ex = (qbankState.pendingExams || []).find(e => e.id === examId);
    if (!ex) return;
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null;
    qbankState.activeFolderObj = null;
    qbankState.currentExamTitle = ex.title;
    qbankState.pendingNav = { mode: "exam", khoId: ex.khoId, examId: ex.id };
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    const listEl = document.getElementById("qbank-questions-list");
    if (listEl) listEl.scrollTop = 0;
}

function navigatePendingBack(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    const nav = qbankState.pendingNav || { mode: "none", khoId: null, examId: null };
    const hasPartOrLevelFilter = Boolean(qbankState.activeFilter.part || qbankState.activeFilter.level);
    if ((nav.mode === "root" || nav.mode === "kho") && hasPartOrLevelFilter) {
        qbankState.activeFilter.part = null;
        qbankState.activeFilter.level = null;
    } else if (nav.mode === "exam") {
        qbankState.pendingNav = { mode: "kho", khoId: nav.khoId, examId: null };
    } else if (nav.mode === "kho") {
        qbankState.pendingNav = { mode: "root", khoId: null, examId: null };
    } else {
        qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    }
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function exitPendingBrowserToAll(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    syncAssignModeButtonsUI();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
}

function triggerDirectKhoFileUpload(khoId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    let input = document.getElementById("qbank-kho-file-upload-input");
    if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = "qbank-kho-file-upload-input";
        input.accept = ".json,.js,.txt";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
    }
    input.onchange = function() {
        if (this.files && this.files.length > 0) {
            importFilesIntoPendingKho(this.files, input.dataset.targetKhoId || khoId);
        }
        this.value = "";
    };
    input.dataset.targetKhoId = khoId;
    input.value = "";
    input.click();
}

function handleKhoDropZoneDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget) e.currentTarget.classList.add("dragover");
}

function handleKhoDropZoneDragLeave(e) {
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    if (e.currentTarget) e.currentTarget.classList.remove("dragover");
}

function handleKhoDropZoneDrop(e, khoId) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget) e.currentTarget.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        importFilesIntoPendingKho(e.dataTransfer.files, khoId);
    }
}

async function importFilesIntoPendingKho(fileList, khoId) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;

    const khoMeta = getPendingKhoMeta(khoId);
    const readOneFile = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ file, text: e.target.result, error: null });
        reader.onerror = () => resolve({ file, text: null, error: "Không thể đọc file" });
        reader.readAsText(file);
    });

    const results = await Promise.all(files.map(readOneFile));
    const parsedBatch = [];
    const failedFiles = [];

    results.forEach(({ file, text, error }) => {
        if (error || !text) { failedFiles.push(file.name); return; }
        try {
            const parsed = parseUniversalExamText(text);
            if (!parsed) throw new Error("Cấu trúc không hợp lệ");
            let rawQ = [], parsedImages = {}, examTitle = file.name.replace(/\.[^/.]+$/, "");
            if (Array.isArray(parsed)) rawQ = parsed;
            else if (parsed.questions && Array.isArray(parsed.questions)) {
                rawQ = parsed.questions;
                if (parsed.title && String(parsed.title).trim()) examTitle = String(parsed.title).trim();
                if (parsed.images && typeof parsed.images === "object") parsedImages = parsed.images;
            }
            if (rawQ.length === 0) throw new Error("Không có câu hỏi");
            parsedBatch.push({ examTitle, rawQ, parsedImages });
        } catch (err) {
            failedFiles.push(`${file.name} (${err.message})`);
        }
    });

    if (parsedBatch.length === 0) {
        const msg = failedFiles.length > 0 ? failedFiles.join("\n") : "Không đọc được file hợp lệ!";
        showQbankToast("❌ Lỗi nạp file!", "error");
        alert("❌ Không thể nạp file đề:\n" + msg);
        return;
    }

    pushQbankUndoState(`Upload ${parsedBatch.length} đề vào ${khoMeta.name}`);
    if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") qbankState.imagesMap = {};
    if (!Array.isArray(qbankState.pendingExams)) qbankState.pendingExams = [];

    let totalImportedQ = 0;
    const baseNow = Date.now();
    parsedBatch.forEach((itemBatch, bIdx) => {
        const ts = baseNow + bIdx * 10;
        const pExam = {
            id: `pexam_${ts}_${Math.floor(Math.random() * 10000)}`,
            title: itemBatch.examTitle,
            khoId: khoId,
            createdAt: ts,
            sourceQuizId: "",
            sourceCategoryId: ""
        };
        qbankState.pendingExams.unshift(pExam);

        const importedQ = itemBatch.rawQ.map((item, idx) => {
            const q = JSON.parse(JSON.stringify(item));
            const resolvedImgUrl = resolveQbankImageUrl(q, itemBatch.parsedImages);
            q.id = `qb_${ts}_${idx + 1}_${Math.floor(Math.random() * 1000)}`;
            q.origIndex = idx + 1;
            q.sourceExam = itemBatch.examTitle;
            q.pendingExamId = pExam.id;
            q.pendingKhoId = khoId;
            q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = "";
            delete q.assignedAt;
            q.level = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
            normalizeQuestionAnswerOnTransfer(q);
            if (resolvedImgUrl && !isBase64DataUrl(resolvedImgUrl)) {
                const uniqueImgKey = `img_q_${q.id}`;
                q.imageUrl = resolvedImgUrl; q.imageKey = uniqueImgKey;
                qbankState.imagesMap[uniqueImgKey] = resolvedImgUrl;
            } else {
                q.imageUrl = ""; q.imageKey = `img_q_${q.id}`;
            }
            return q;
        });

        qbankState.rawQuestions.push(...importedQ);
        totalImportedQ += importedQ.length;
        qbankState.currentExamTitle = itemBatch.examTitle;
    });

    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
    qbankState.assignMode = true; qbankState.hideAssigned = false;
    qbankState.pendingNav = { mode: "kho", khoId: khoId, examId: null };

    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();
    syncAssignModeButtonsUI();
    updateQbankDeleteSelectedButtonUI();
    updateQbankUploadMenuCounts();
    saveQbankDraftState(false);

    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();

    if (failedFiles.length > 0) {
        alert(`⚠️ Một số file bị lỗi không nạp được:\n- ${failedFiles.join("\n- ")}`);
    }
    showQbankToast(`✅ Đã nạp ${parsedBatch.length} đề (${totalImportedQ} câu) vào ${khoMeta.name}!`, "success");
}

function movePendingExamOrder(examId, direction, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const allExams = qbankState.pendingExams || [];
    const curIdx = allExams.findIndex(e => e.id === examId);
    if (curIdx === -1) return;
    const targetKhoId = allExams[curIdx].khoId;

    let swapIdx = -1;
    if (direction < 0) {
        for (let i = curIdx - 1; i >= 0; i--) {
            if (allExams[i].khoId === targetKhoId) { swapIdx = i; break; }
        }
    } else {
        for (let i = curIdx + 1; i < allExams.length; i++) {
            if (allExams[i].khoId === targetKhoId) { swapIdx = i; break; }
        }
    }
    if (swapIdx === -1) return;

    pushQbankUndoState(`Đổi vị trí đề "${allExams[curIdx].title}"`);
    const tmp = allExams[curIdx];
    allExams[curIdx] = allExams[swapIdx];
    allExams[swapIdx] = tmp;

    saveQbankDraftState(false);
    renderQbankQuestions();
    showQbankToast(direction < 0 ? "▲ Đã đưa đề lên trên!" : "▼ Đã đưa đề xuống dưới!", "info");
}

function renamePendingExam(examId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const ex = (qbankState.pendingExams || []).find(e => e.id === examId);
    if (!ex) return;
    const newName = prompt("✏️ Nhập tên mới cho đề chờ xếp:", ex.title);
    if (!newName || !newName.trim() || newName.trim() === ex.title) return;

    pushQbankUndoState(`Đổi tên đề "${ex.title}"`);
    const trimmed = newName.trim();
    const oldName = ex.title;
    ex.title = trimmed;
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && String(q.pendingExamId) === String(examId)) q.sourceExam = trimmed;
    });
    if (qbankState.currentExamTitle === oldName) qbankState.currentExamTitle = trimmed;

    saveQbankDraftState(false);
    renderQbankHeaderAndMidExamTitle();
    renderQbankQuestions();
    showQbankToast(`✏️ Đã đổi tên thành "${trimmed}"!`, "success");
}

function deletePendingExam(examId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const ex = (qbankState.pendingExams || []).find(e => e.id === examId);
    if (!ex) return;

    const allInExam = (qbankState.rawQuestions || []).filter(q => q && String(q.pendingExamId) === String(examId));
    const unassignedInExam = allInExam.filter(q => !q.folderId);
    const assignedInExam = allInExam.filter(q => Boolean(q.folderId));

    const msg = assignedInExam.length > 0
        ? `⚠️ XÁC NHẬN XÓA ĐỀ CHỜ XẾP:\n\nĐề: "${ex.title}"\n• Sẽ XÓA ${unassignedInExam.length} câu chưa xếp của đề này.\n• Sẽ GIỮ NGUYÊN 100% ${assignedInExam.length} câu đã xếp vào cây thư mục bên trái!\n\n(Có thể bấm ↩️ Lùi nếu lỡ tay).`
        : `⚠️ XÁC NHẬN XÓA ĐỀ CHỜ XẾP:\n\nBạn có chắc chắn muốn xóa đề "${ex.title}" (${unassignedInExam.length} câu chưa xếp)?\n\n(Có thể bấm ↩️ Lùi nếu lỡ tay).`;

    if (!confirm(msg)) return;

    pushQbankUndoState(`Xóa đề chờ xếp "${ex.title}"`);

    const removeSet = new Set(unassignedInExam.map(q => String(q.id)));
    const deletedQuestions = (qbankState.rawQuestions || []).filter(q => q && removeSet.has(String(q.id)));
    qbankState.rawQuestions = (qbankState.rawQuestions || []).filter(q => {
        if (!q) return false;
        if (removeSet.has(String(q.id))) return false;
        if (String(q.pendingExamId) === String(examId)) {
            q.pendingExamId = "";
            q.pendingKhoId = "";
        }
        return true;
    });
    removeSet.forEach(id => qbankState.selectedQuestionIds.delete(id));
    cleanupOrphanedImagesInQbank(deletedQuestions);

    qbankState.pendingExams = (qbankState.pendingExams || []).filter(e => e.id !== examId);
    if (qbankState.pendingNav && qbankState.pendingNav.examId === examId) {
        qbankState.pendingNav = { mode: "kho", khoId: ex.khoId, examId: null };
    }

    recomputeAllMatrixIds();
    saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI();
    updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`🗑️ Đã xóa đề "${ex.title}" (bảo toàn ${assignedInExam.length} câu đã xếp)!`, "warning");
}

function openMovePendingExamKhoModal(examId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const ex = (qbankState.pendingExams || []).find(e => e.id === examId);
    if (!ex) return;

    const oldModal = document.getElementById("move-pending-exam-kho-modal");
    if (oldModal) oldModal.remove();

    const safeExamId = safeQbankJsArg(examId);
    const optionsHtml = QBANK_PENDING_KHOS.map(k => `
        <option value="${escapeQbankAttr(k.id)}" ${k.id === ex.khoId ? "selected" : ""}>${k.icon} ${escapeQbankHtml(k.name)}</option>
    `).join("");

    const div = document.createElement("div");
    div.className = "qbank-modal-overlay";
    div.id = "move-pending-exam-kho-modal";
    div.style.display = "flex";
    div.onclick = function(e) { if (e.target === div) div.remove(); };
    div.innerHTML = `
        <div class="qbank-modal-container" style="width:440px; max-width:92vw; height:auto; padding:20px; background:#fff;" onclick="event.stopPropagation()">
            <h3 style="margin:0 0 10px 0; color:#0284c7; font-weight:900; font-size:15.5px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px;">🔄 CHUYỂN LỚP KHO CHỜ XẾP</h3>
            <div style="font-size:12px; font-weight:700; color:#334155; background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px;">
                📄 Đề: <b style="color:#0f172a;">${escapeQbankHtml(ex.title)}</b>
            </div>
            <label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">Chọn kho chờ xếp đích:</label>
            <select id="move-pending-exam-target-kho" style="width:100%; padding:9px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:800; font-size:13px;">
                ${optionsHtml}
            </select>
            <div style="display:flex; gap:8px; margin-top:16px;">
                <button type="button" onclick="document.getElementById('move-pending-exam-kho-modal').remove()" style="flex:1; padding:9px; border-radius:8px; border:1.5px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:800;">✕ Hủy</button>
                <button type="button" onclick="executeMovePendingExamToKho('${safeExamId}')" style="flex:1.5; padding:9px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; cursor:pointer; font-weight:900;">🚀 Xác nhận chuyển</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

function executeMovePendingExamToKho(examId) {
    const sel = document.getElementById("move-pending-exam-target-kho");
    if (!sel) return;
    const newKhoId = sel.value;
    const exIdx = (qbankState.pendingExams || []).findIndex(e => e.id === examId);
    if (exIdx === -1) return;
    const ex = qbankState.pendingExams[exIdx];
    const modal = document.getElementById("move-pending-exam-kho-modal");

    if (ex.khoId === newKhoId) {
        if (modal) modal.remove();
        showQbankToast("ℹ️ Đề đã nằm sẵn trong kho này!", "info");
        return;
    }

    const newKhoMeta = getPendingKhoMeta(newKhoId);
    pushQbankUndoState(`Chuyển đề "${ex.title}" sang ${newKhoMeta.name}`);

    ex.khoId = newKhoId;
    qbankState.pendingExams.splice(exIdx, 1);
    qbankState.pendingExams.unshift(ex);

    (qbankState.rawQuestions || []).forEach(q => {
        if (q && String(q.pendingExamId) === String(examId)) q.pendingKhoId = newKhoId;
    });

    if (modal) modal.remove();
    saveQbankDraftState(false);
    updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle();
    renderQbankQuestions();
    updateQbankMatrixStats();
    showQbankToast(`✅ Đã chuyển "${ex.title}" sang ${newKhoMeta.name}!`, "success");
}

function selectAllQuestionsInActivePendingExam(selectAll) {
    const nav = qbankState.pendingNav || {};
    if (nav.mode !== "exam" || !nav.examId) return;
    const list = getFilteredAndSortedQuestions();
    list.forEach(q => {
        if (selectAll) qbankState.selectedQuestionIds.add(String(q.id));
        else qbankState.selectedQuestionIds.delete(String(q.id));
    });
    updateQbankDeleteSelectedButtonUI();
    renderQbankQuestions();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    showQbankToast(selectAll ? `☑️ Đã chọn ${list.length} câu trong đề!` : "⬜ Đã bỏ chọn các câu trong đề!", "info");
}

// ============================================================================
// 3. CỘT 1: CÂY THƯ MỤC & MA TRẬN 16 Ô
// ============================================================================
function toggleLeafMatrixDisplay(folderId, event) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (qbankState.expandedLeafMatrixIds.has(folderId)) qbankState.expandedLeafMatrixIds.delete(folderId);
    else qbankState.expandedLeafMatrixIds.add(folderId);
    renderQbankTree();
}

function handleLeafTreeDragOver(e, folderId, isLeaf) {
    if (!qbankState.draggedQId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (!isLeaf || qbankState.expandedLeafMatrixIds.has(folderId)) return;

    if (_qbankLeafHoverFolderId !== folderId) {
        cancelLeafAutoExpandTimer();
        _qbankLeafHoverFolderId = folderId;
        _qbankLeafHoverTimer = setTimeout(() => {
            if (qbankState.draggedQId && _qbankLeafHoverFolderId === folderId && !qbankState.expandedLeafMatrixIds.has(folderId)) {
                qbankState.expandedLeafMatrixIds.add(folderId);
                renderQbankTree();
            }
            cancelLeafAutoExpandTimer();
        }, 280);
    }
}

function handleLeafTreeDragLeave(e, folderId) {
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    if (_qbankLeafHoverFolderId === folderId) cancelLeafAutoExpandTimer();
}

function renderQbankTree() {
    const rootEl = document.getElementById("qbank-tree-root");
    if (!rootEl) return;

    const visPrefs = getQbankTreeVisPrefs();
    const hasAnyHidden = Boolean(visPrefs.hideEditTools || visPrefs.hideMatrixBtn);

    const directFolderCounts = {};
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && q.folderId) directFolderCounts[q.folderId] = (directFolderCounts[q.folderId] || 0) + 1;
    });

    function getSubtreeQuestionCount(node) {
        let sum = directFolderCounts[node.id] || 0;
        if (node.children && node.children.length > 0) node.children.forEach(c => { sum += getSubtreeQuestionCount(c); });
        return sum;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding-bottom:4px; border-bottom:1.5px solid #e2e8f0; gap:4px;">
            <b style="font-size:11.5px; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🌳 THƯ MỤC KIẾN THỨC:</b>
            <div style="display:flex; align-items:center; gap:3px; flex-shrink:0;">
                <button type="button" id="btn-qbank-tree-vis-toggle" class="btn-qbank-tree-vis-mini ${hasAnyHidden ? "has-hidden-active" : ""}" onclick="toggleQbankTreeVisMenu(event)" title="${hasAnyHidden ? "Đang ẩn bớt nút ở cuối thư mục — Nhấp để bật/tắt" : "Tùy chọn ẩn các nút cuối mỗi thư mục"}">${hasAnyHidden ? "🙈" : "⚙️"}</button>
                <button class="btn-qbank btn-qbank-primary" style="padding:2px 7px; font-size:10.5px;" onclick="promptAddRootFolder()">+ Thư mục gốc</button>
            </div>
        </div>
    `;

    function buildNodeHtml(node, depth = 0) {
        const isActive = (qbankState.activeFolderId === node.id && !qbankState.activeFilter.part);
        const nodeColor = node.color || "#0284c7";
        const isLeaf = (!node.children || node.children.length === 0);
        const subtreeCount = getSubtreeQuestionCount(node);
        const subHtml = !isLeaf ? `<div class="tree-children">${node.children.map(c => buildNodeHtml(c, depth + 1)).join("")}</div>` : "";
        const safeNodeId = safeQbankJsArg(node.id);

        const showMatrixBtn = isLeaf && !visPrefs.hideMatrixBtn;
        const showEditBtns = !visPrefs.hideEditTools;
        const rightActionsHtml = (showMatrixBtn || showEditBtns) ? `
            <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;" onclick="event.stopPropagation()">
                ${showMatrixBtn ? `<button class="btn-matrix-toggle ${qbankState.expandedLeafMatrixIds.has(node.id) ? "is-open" : ""}" onclick="toggleLeafMatrixDisplay('${safeNodeId}', event)" title="Mở/Đóng ma trận 16 ô">⊞</button>` : ""}
                ${showEditBtns ? `
                    <div class="tree-color-picker-dot" style="background:${nodeColor};" onclick="promptChangeFolderColor('${safeNodeId}')" title="Đổi màu"></div>
                    <button class="btn-rename-tree" onclick="promptRenameFolder('${safeNodeId}')" title="Đổi tên">✏️</button>
                    ${!isLeaf || depth < 2 ? `<button class="btn-add-tree" onclick="promptAddChildFolder('${safeNodeId}')" title="Thêm mục con">+</button>` : ""}
                    <button class="btn-add-tree" style="color:#ef4444;" onclick="promptDeleteFolder('${safeNodeId}')" title="Xóa">✕</button>
                ` : ""}
            </div>
        ` : "";

        let matrixDropHtml = "";
        const isMatrixOpen = isLeaf && qbankState.expandedLeafMatrixIds.has(node.id);
        if (isLeaf && isMatrixOpen) {
            const counts = { 1: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 2: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 3: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 4: { nb: 0, th: 0, vdt: 0, vdc: 0 } };
            (qbankState.rawQuestions || []).forEach(q => {
                if (q && q.folderId === node.id) {
                    const p = getQbankQuestionPart(q);
                    const lvl = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
                    if (counts[p] && counts[p][lvl] !== undefined) counts[p][lvl]++;
                }
            });

            matrixDropHtml = `
                <div class="leaf-matrix-container" onclick="event.stopPropagation()">
                    <div class="leaf-matrix-header-bar">
                        <span>📥 Ma trận 16 ô (${escapeQbankHtml(node.name)}):</span>
                        <button type="button" class="btn-clear-filter" onclick="toggleLeafMatrixDisplay('${safeNodeId}', event)">▲ Thu lại</button>
                    </div>
                    ${[1, 2, 3, 4].map(p => {
                        const isPartFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
                        return `
                        <div class="leaf-matrix-row">
                            <div class="leaf-matrix-lbl ${isPartFiltered ? "active-filter" : ""}" onclick="setFilterByNodePart('${safeNodeId}', ${p})" title="Xem câu Phần ${p}">P${p}</div>
                            ${["nb", "th", "vdt", "vdc"].map(lvl => {
                                const lblMap = { nb: "NB", th: "TH", vdt: "VD", vdc: "VDC" };
                                const isCellFiltered = (qbankState.activeFilter.folderId === node.id && qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl);
                                return `<div class="leaf-drop-zone ${isCellFiltered ? "active-filter" : ""}" ondragover="handleDropZoneOver(event)" ondragleave="handleDropZoneLeave(event)" ondrop="handleDropZoneDrop(event, '${safeNodeId}', ${p}, '${lvl}')" onclick="handleMatrixCellClick('${safeNodeId}', ${p}, '${lvl}')" title="Kéo thả hoặc Click lọc P${p}-${lblMap[lvl]}"><span style="pointer-events:none;">${lblMap[lvl]}</span><b style="pointer-events:none;">(${counts[p][lvl]})</b></div>`;
                            }).join("")}
                        </div>`;
                    }).join("")}
                </div>
            `;
        }

        return `
            <div class="tree-item-wrapper" style="margin-left:${depth > 0 ? 3 : 0}px;">
                <div class="tree-item ${isActive ? "active" : ""}" id="tree-node-${escapeQbankAttr(node.id)}" onclick="handleFolderNodeClick('${safeNodeId}')" ondragover="handleLeafTreeDragOver(event, '${safeNodeId}', ${isLeaf})" ondragleave="handleLeafTreeDragLeave(event, '${safeNodeId}')" style="border-left:3.5px solid transparent;">
                    <div style="display:flex; align-items:center; gap:5px; min-width:0; flex:1;">
                        <span style="color:${nodeColor}; font-size:13px;">${isLeaf ? "📄" : "📁"}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; color:${nodeColor}; font-weight:800;" title="${escapeQbankHtml(node.name)}">${escapeQbankHtml(node.name)}</span>
                        ${subtreeCount > 0 ? `<span class="tree-q-count">${subtreeCount}</span>` : ""}
                    </div>
                    ${rightActionsHtml}
                </div>
                ${matrixDropHtml}
                ${subHtml}
            </div>
        `;
    }

    html += qbankState.currentTree.map(r => buildNodeHtml(r, 0)).join("");
    rootEl.innerHTML = html;
}

function handleFolderNodeClick(folderId) {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    qbankState.activeFolderId = folderId;
    qbankState.activeFolderObj = findNodeInTree(qbankState.currentTree, folderId);
    qbankState.activeFilter = { folderId: folderId, folderName: qbankState.activeFolderObj ? qbankState.activeFolderObj.name : "", part: null, level: null };
    const node = qbankState.activeFolderObj;
    if (node && (!node.children || node.children.length === 0)) qbankState.expandedLeafMatrixIds.add(folderId);
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function setFilterByNodePart(folderId, part) {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    const node = findNodeInTree(qbankState.currentTree, folderId);
    qbankState.activeFolderId = folderId; qbankState.activeFolderObj = node;
    qbankState.activeFilter = { folderId: folderId, folderName: node ? node.name : "", part: part, level: null };
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function handleMatrixCellClick(folderId, part, level) {
    const selectedUnassigned = Array.from(qbankState.selectedQuestionIds).filter(qId => {
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        return q && !q.folderId;
    });
    if (selectedUnassigned.length > 0 && selectedUnassigned.length === qbankState.selectedQuestionIds.size) {
        assignSelectedQuestionsToMatrix(folderId, part, level);
    } else {
        if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
        qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
        const node = findNodeInTree(qbankState.currentTree, folderId);
        qbankState.activeFolderId = folderId; qbankState.activeFolderObj = node;
        qbankState.activeFilter = { folderId: folderId, folderName: node ? node.name : "", part: part, level: level };
        syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    }
}

function syncAssignModeButtonsUI() {
    const assignBtn = document.getElementById("btn-toggle-assigned");
    if (assignBtn) {
        const navMode = (qbankState.pendingNav && qbankState.pendingNav.mode) || "none";
        const isAssignActive = qbankState.assignMode && !qbankState.activeFilter.folderId && !qbankState.hideAssigned && navMode === "none";
        assignBtn.classList.toggle("is-active", isAssignActive);
        assignBtn.innerHTML = isAssignActive ? `<span>📦</span> <b>Xếp câu (Đang bật)</b>` : `<span>📦</span> <b>Xếp câu (Trên cùng)</b>`;
    }
    const hideBtn = document.getElementById("btn-qbank-hide-assigned");
    if (hideBtn) {
        hideBtn.classList.toggle("is-active", qbankState.hideAssigned);
        hideBtn.innerHTML = qbankState.hideAssigned ? `<span>👁️</span> <b>Đang ẩn đã xếp</b>` : `<span>🙈</span> <b>Ẩn đã xếp</b>`;
    }
}

function clearQbankFilter() {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
    qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    qbankState.assignMode = false; qbankState.hideAssigned = false;
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function toggleQbankAssignMode() {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    const navMode = (qbankState.pendingNav && qbankState.pendingNav.mode) || "none";
    if (navMode === "root" || navMode === "kho") {
        qbankState.pendingNav = { mode: "none", khoId: null, examId: null };
    }
    if (qbankState.activeFilter.folderId || qbankState.hideAssigned || !qbankState.assignMode) {
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
        qbankState.hideAssigned = false; qbankState.assignMode = true;
    } else {
        qbankState.assignMode = false;
    }
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function toggleHideAssignedQuestions() {
    if (qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") closeQbankMidEditMode(false);
    if (qbankState.activeFilter.folderId) {
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null; qbankState.hideAssigned = true;
    } else {
        qbankState.hideAssigned = !qbankState.hideAssigned;
    }
    syncAssignModeButtonsUI(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
}

function promptRenameFolder(folderId) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (!node) return;
    const newName = prompt("✏️ Đổi tên thư mục:", node.name);
    if (newName && newName.trim() && newName.trim() !== node.name) {
        pushQbankUndoState(`Đổi tên thư mục "${node.name}"`);
        node.name = newName.trim();
        if (qbankState.activeFilter.folderId === folderId) qbankState.activeFilter.folderName = node.name;
        recomputeAllMatrixIds(); saveQbankTreeData(); saveQbankDraftState(false);
        renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
        showQbankToast(`✏️ Đã đổi tên thành "${node.name}" & cập nhật ID!`, "success");
    }
}

function promptAddRootFolder() {
    const name = prompt("📁 Nhập tên thư mục gốc mới (VD: Lớp 10):");
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm thư mục gốc "${name.trim()}"`);
        qbankState.currentTree.push({ id: "node_" + Date.now(), name: name.trim(), color: QBANK_COLOR_PALETTE[Math.floor(Math.random() * QBANK_COLOR_PALETTE.length)], children: [] });
        saveQbankTreeData(); saveQbankDraftState(false); renderQbankTree();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
        showQbankToast(`📁 Đã tạo thư mục gốc "${name.trim()}" & đồng bộ Cloud!`, "success");
    }
}

function promptAddChildFolder(parentId) {
    const parent = findNodeInTree(qbankState.currentTree, parentId);
    if (!parent) return;
    const name = prompt(`📁 Thêm mục con vào [${parent.name}]:`);
    if (name && name.trim()) {
        pushQbankUndoState(`Thêm mục con "${name.trim()}"`);
        if (!parent.children) parent.children = [];
        parent.children.push({ id: "node_" + Date.now(), name: name.trim(), color: parent.color, children: [] });
        saveQbankTreeData(); saveQbankDraftState(false); renderQbankTree();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
        showQbankToast(`📁 Đã tạo mục "${name.trim()}" & đồng bộ Cloud!`, "success");
    }
}

function promptChangeFolderColor(folderId) {
    const oldModal = document.getElementById("color-picker-modal");
    if (oldModal) oldModal.remove();
    const safeFId = safeQbankJsArg(folderId);
    let colorHtml = `<div style="display:flex; gap:8px; justify-content:center; margin:10px 0;">`;
    QBANK_COLOR_PALETTE.forEach(c => { colorHtml += `<div onclick="applyFolderColorChange('${safeFId}', '${c}')" style="width:24px; height:24px; border-radius:50%; background:${c}; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`; });
    colorHtml += `</div>`;
    let div = document.createElement("div");
    div.className = "qbank-modal-overlay"; div.id = "color-picker-modal"; div.style.display = "flex";
    div.onclick = function(e) { if (e.target === div) div.remove(); };
    div.innerHTML = `<div class="qbank-modal-container" style="width:320px; height:auto; padding:22px; background:#fff; box-shadow:0 25px 60px rgba(0,0,0,0.5);" onclick="event.stopPropagation()"><h3 style="margin-top:0; color:#0f172a; font-weight:900; font-size:15px; text-align:center;">🎨 Chọn màu thư mục</h3>${colorHtml}<button onclick="document.getElementById('color-picker-modal').remove()" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; cursor:pointer; font-weight:800; color:#475569; margin-top:10px;">Đóng</button></div>`;
    document.body.appendChild(div);
}

window.applyFolderColorChange = function(folderId, newColor) {
    const node = findNodeInTree(qbankState.currentTree, folderId);
    if (node) {
        node.color = newColor;
        saveQbankTreeData();
        renderQbankTree();
        if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    }
    const modal = document.getElementById("color-picker-modal");
    if (modal) modal.remove();
};

function promptDeleteFolder(folderId) {
    const targetNode = findNodeInTree(qbankState.currentTree, folderId);
    if (!targetNode) return;
    if (!confirm(`⚠️ Xóa thư mục "${targetNode.name}" và tất cả mục con?\n(Câu hỏi bên trong sẽ trở về mục Chưa xếp).`)) return;
    pushQbankUndoState(`Xóa thư mục "${targetNode.name}"`);

    const deletedIds = new Set(getAllDescendantFolderIds(targetNode));
    (qbankState.rawQuestions || []).forEach(q => {
        if (q && q.folderId && deletedIds.has(q.folderId)) {
            q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = ""; delete q.assignedAt;
        }
    });

    const parent = findParentNodeInTree(qbankState.currentTree, folderId);
    if (parent) parent.children = parent.children.filter(c => c.id !== folderId);
    else qbankState.currentTree = qbankState.currentTree.filter(c => c.id !== folderId);

    if (qbankState.activeFolderId && deletedIds.has(qbankState.activeFolderId)) {
        qbankState.activeFolderId = null; qbankState.activeFolderObj = null;
        qbankState.activeFilter = { folderId: null, folderName: null, part: null, level: null };
    }
    deletedIds.forEach(id => qbankState.exportSelectedFolderIds.delete(id));

    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds(); saveQbankTreeData(); saveQbankDraftState(false);
    syncAssignModeButtonsUI(); updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`🗑️ Đã xóa thư mục "${targetNode.name}".`, "warning");
}

function selectQbankFolder(folderId) { handleFolderNodeClick(folderId); }

// ============================================================================
// 4. KÉO THẢ & GÁN VÀO MA TRẬN 16 Ô
// ============================================================================
function handleDropZoneOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    cancelLeafAutoExpandTimer();
    if (e.currentTarget) e.currentTarget.classList.add("drag-over");
}

function handleDropZoneLeave(e) {
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    if (e.currentTarget) e.currentTarget.classList.remove("drag-over");
}

function mutateQuestionMatrix(qId, folderId, part, level, assignedTimestamp = null) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return null;

    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");

    if (targetPart === 1) {
        q.type = "multiple_choice"; q.part = 1; q.isPart4 = false;
        if (!Array.isArray(q.options) || q.options.length === 0) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
        if (q.correct === undefined || q.correct === null) q.correct = 0;
    } else if (targetPart === 2) {
        q.type = "true_false"; q.part = 2; q.isPart4 = false;
        if (!Array.isArray(q.statements) || q.statements.length === 0) {
            q.statements = [
                { id: "a", statement: "", correct: true },
                { id: "b", statement: "", correct: false },
                { id: "c", statement: "", correct: true },
                { id: "d", statement: "", correct: false }
            ];
        }
    } else if (targetPart === 3) {
        q.type = "short_answer"; q.part = 3; q.isPart4 = false;
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
            q.correctAnswer = q.correct !== undefined ? String(q.correct) : "0";
        }
    } else if (targetPart === 4) {
        q.type = "short_answer"; q.part = 4; q.isPart4 = true;
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
            q.correctAnswer = q.correct !== undefined ? String(q.correct) : "0";
        }
    }

    q.level = targetLevel;
    q.folderId = folderId;
    q.assignedAt = assignedTimestamp || Date.now();
    const cur = findNodeInTree(qbankState.currentTree, folderId);
    q.folderName = cur ? cur.name : "";
    return q;
}

function handleDropZoneDrop(e, folderId, part, level) {
    e.preventDefault();
    e.stopPropagation();
    cancelLeafAutoExpandTimer();
    if (e.currentTarget) e.currentTarget.classList.remove("drag-over");

    const qId = (e.dataTransfer ? e.dataTransfer.getData("text/plain") : "") || qbankState.draggedQId;
    qbankState.draggedQId = null;
    if (!qId) return;

    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const isMultiDrag = qbankState.selectedQuestionIds.has(String(qId)) && qbankState.selectedQuestionIds.size > 1;
    const idsToMove = isMultiDrag ? Array.from(qbankState.selectedQuestionIds) : [String(qId)];

    pushQbankUndoState(`Xếp ${idsToMove.length} câu vào ${folderLabel} (P${targetPart} - ${getQbankLevelLabel(targetLevel)})`);
    const baseTs = Date.now();
    let lastMovedQ = null;
    idsToMove.forEach((id, idx) => { const m = mutateQuestionMatrix(id, folderId, targetPart, targetLevel, baseTs + idx); if (m) lastMovedQ = m; });
    if (isMultiDrag) { qbankState.selectedQuestionIds.clear(); updateQbankDeleteSelectedButtonUI(); }
    if (!lastMovedQ) return;

    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(idsToMove.length > 1 ? `✅ Đã xếp ${idsToMove.length} câu vào ${folderLabel} (${lastMovedQ.matrixId})` : `✅ Đã đánh số & xếp: ${lastMovedQ.matrixId}`, "success");
}

function assignSelectedQuestionsToMatrix(folderId, part, level) {
    if (qbankState.selectedQuestionIds.size === 0) return;
    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    const folderLabel = targetFolder ? targetFolder.name : "Thư mục";
    const count = qbankState.selectedQuestionIds.size;

    pushQbankUndoState(`Xếp ${count} câu vào ${folderLabel} (P${targetPart} - ${getQbankLevelLabel(targetLevel)})`);
    const baseTs = Date.now();
    let idx = 0;
    qbankState.selectedQuestionIds.forEach(qId => { mutateQuestionMatrix(qId, folderId, targetPart, targetLevel, baseTs + idx); idx++; });
    qbankState.selectedQuestionIds.clear();

    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`✅ Đã đánh số & xếp ${count} câu vào ${folderLabel}`, "success");
}

function applyMatrixToQuestion(qId, folderId, part, level) {
    const targetPart = parseInt(part, 10) || 1;
    const targetLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(level) : (level || "nb");
    const targetFolder = findNodeInTree(qbankState.currentTree, folderId);
    pushQbankUndoState(`Chuyển câu vào ${targetFolder ? targetFolder.name : "Thư mục"} (P${targetPart} - ${getQbankLevelLabel(targetLevel)})`);
    const q = mutateQuestionMatrix(qId, folderId, targetPart, targetLevel, Date.now());
    if (!q) return;
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(`✅ Đã chuyển câu: ${q.matrixId}`, "success");
}

function unassignQbankQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q || !q.folderId) return;
    pushQbankUndoState(`Bỏ xếp ${q.matrixId || "câu hỏi"}`);
    q.folderId = null; q.folderName = ""; q.matrixId = ""; q.matrixSeq = 0; q.matrixPathSlug = ""; q.rootClassId = ""; delete q.assignedAt;
    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast("↩️ Đã trả câu về mục Chưa xếp!", "info");
}

// ============================================================================
// 5. CHUYỂN, XÓA LẺ & MENU XÓA NHIỀU CÂU (3 TÙY CHỌN)
// ============================================================================
function pruneStaleSelectedQuestionIds() {
    const existingIds = new Set((qbankState.rawQuestions || []).map(q => String(q.id)));
    const cleaned = new Set();
    qbankState.selectedQuestionIds.forEach(id => { if (existingIds.has(String(id))) cleaned.add(String(id)); });
    qbankState.selectedQuestionIds = cleaned;
    return cleaned.size;
}

function cleanupOrphanedImagesInQbank(deletedQuestions) {
    if (!Array.isArray(deletedQuestions) || deletedQuestions.length === 0) return;
    if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") return;

    const activeImageKeys = new Set();
    (qbankState.rawQuestions || []).forEach(q => {
        if (!q) return;
        if (q.imageKey) activeImageKeys.add(String(q.imageKey));
        activeImageKeys.add(`img_q_${q.id}`);
    });

    deletedQuestions.forEach(dq => {
        if (!dq) return;
        const k1 = dq.imageKey ? String(dq.imageKey) : "";
        const k2 = `img_q_${dq.id}`;
        if (k1 && !activeImageKeys.has(k1)) delete qbankState.imagesMap[k1];
        if (k2 && !activeImageKeys.has(k2)) delete qbankState.imagesMap[k2];
    });
}

function ensureQbankDeleteMultiDropdownInDOM() {
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!btn) return null;

    let wrapper = btn.closest(".qbank-delete-dropdown-wrapper");
    if (!wrapper && btn.parentNode) {
        wrapper = document.createElement("div");
        wrapper.className = "qbank-delete-dropdown-wrapper";
        wrapper.id = "qbank-delete-dropdown-wrapper";
        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
    }

    let menu = document.getElementById("qbank-delete-multi-menu");
    if (!menu && wrapper) {
        menu = document.createElement("div");
        menu.id = "qbank-delete-multi-menu";
        menu.className = "qbank-delete-menu";
        menu.onclick = function(e) { e.stopPropagation(); };
        menu.innerHTML = `
            <div class="qbank-delete-menu-header">
                <span>🗑️ TÙY CHỌN XÓA CÂU HỎI</span>
                <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:none;">Có thể ↩️ Lùi</span>
            </div>
            <div class="qbank-delete-menu-item" id="qbank-del-opt-unassigned" onclick="executeQbankMultiDelete('unassigned', event)">
                <div class="qbank-delete-item-left">
                    <span class="qbank-delete-item-icon">📥</span>
                    <div class="qbank-delete-item-text">
                        <b>1. Xóa câu Chờ xếp</b>
                        <small>Xóa các câu chưa kéo vào thư mục</small>
                    </div>
                </div>
                <span class="del-count-badge" id="qbank-del-count-unassigned">0 câu</span>
            </div>
            <div class="qbank-delete-menu-item" id="qbank-del-opt-displayed" onclick="executeQbankMultiDelete('displayed', event)">
                <div class="qbank-delete-item-left">
                    <span class="qbank-delete-item-icon">👁️</span>
                    <div class="qbank-delete-item-text">
                        <b>2. Xóa các câu đang hiển thị</b>
                        <small id="qbank-del-sub-displayed">Xóa danh sách đang hiện ở cột giữa</small>
                    </div>
                </div>
                <span class="del-count-badge" id="qbank-del-count-displayed">0 câu</span>
            </div>
            <div class="qbank-delete-menu-item" id="qbank-del-opt-selected" onclick="executeQbankMultiDelete('selected', event)">
                <div class="qbank-delete-item-left">
                    <span class="qbank-delete-item-icon">☑️</span>
                    <div class="qbank-delete-item-text">
                        <b>3. Xóa câu tích chọn</b>
                        <small>Chỉ xóa các câu đã đánh dấu ☑️ Chọn</small>
                    </div>
                </div>
                <span class="del-count-badge" id="qbank-del-count-selected">0 câu</span>
            </div>
        `;
        wrapper.appendChild(menu);
    }

    return menu;
}

function updateQbankDeleteMenuCounts() {
    const allQ = qbankState.rawQuestions || [];
    const navMode = (qbankState.pendingNav && qbankState.pendingNav.mode) || "none";
    const hasPartOrLevelFilter = Boolean(qbankState.activeFilter.part || qbankState.activeFilter.level);
    const isFolderBrowserLevel = (navMode === "root" || navMode === "kho") && !qbankState.activeFilter.folderId && !hasPartOrLevelFilter;

    const unassignedCount = allQ.filter(q => Boolean(q && !q.folderId)).length;
    const displayedList = isFolderBrowserLevel ? [] : getFilteredAndSortedQuestions();
    const displayedCount = displayedList.length;
    const selectedCount = pruneStaleSelectedQuestionIds();

    const elUnassigned = document.getElementById("qbank-del-count-unassigned");
    const elDisplayed = document.getElementById("qbank-del-count-displayed");
    const elSelected = document.getElementById("qbank-del-count-selected");
    const subDisplayed = document.getElementById("qbank-del-sub-displayed");

    if (elUnassigned) elUnassigned.textContent = `${unassignedCount} câu`;
    if (elDisplayed) elDisplayed.textContent = isFolderBrowserLevel ? "Mở 1 đề" : `${displayedCount} câu`;
    if (elSelected) elSelected.textContent = `${selectedCount} câu`;
    if (subDisplayed) {
        subDisplayed.textContent = isFolderBrowserLevel
            ? "Mở vào chi tiết 1 Đề để xóa câu đang hiển thị"
            : "Xóa danh sách đang hiện ở cột giữa";
    }

    const optUnassigned = document.getElementById("qbank-del-opt-unassigned");
    const optDisplayed = document.getElementById("qbank-del-opt-displayed");
    const optSelected = document.getElementById("qbank-del-opt-selected");

    if (optUnassigned) optUnassigned.classList.toggle("is-disabled", unassignedCount === 0);
    if (optDisplayed) optDisplayed.classList.toggle("is-disabled", isFolderBrowserLevel || displayedCount === 0);
    if (optSelected) optSelected.classList.toggle("is-disabled", selectedCount === 0);
}

function updateQbankDeleteSelectedButtonUI() {
    ensureQbankDeleteMultiDropdownInDOM();
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!btn) return;
    const count = pruneStaleSelectedQuestionIds();
    btn.classList.toggle("has-selection", count > 0);
    btn.innerHTML = count > 0
        ? `<span>🗑️</span> <span>Xóa nhiều câu (${count}) ▾</span>`
        : `<span>🗑️</span> <span>Xóa nhiều câu ▾</span>`;
    updateQbankDeleteMenuCounts();
}

function closeQbankDeleteMultiMenu() {
    const menu = document.getElementById("qbank-delete-multi-menu");
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (menu) menu.classList.remove("show");
    if (btn) btn.classList.remove("is-open");
}

function toggleQbankDeleteMultiMenu(event) {
    const ev = event || window.event;
    if (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
    }
    const menu = ensureQbankDeleteMultiDropdownInDOM();
    const btn = document.getElementById("btn-qbank-delete-selected");
    if (!menu || !btn) return;

    if (menu.classList.contains("show")) {
        closeQbankDeleteMultiMenu();
        return;
    }

    closeQbankUploadMenu();
    closeQbankTreeVisMenu();
    if (typeof closeQbankExportPopover === "function") closeQbankExportPopover();
    updateQbankDeleteMenuCounts();

    menu.classList.add("show");
    btn.classList.add("is-open");

    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.min(288, window.innerWidth * 0.92);
    let left = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10));
    const approxHeight = menu.offsetHeight || 195;
    let top = rect.bottom + 6;
    if (top + approxHeight > window.innerHeight - 10 && rect.top > approxHeight + 10) {
        top = rect.top - approxHeight - 6;
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
}

function deleteSelectedQbankQuestions(event) {
    toggleQbankDeleteMultiMenu(event);
}

function executeQbankMultiDelete(mode, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const allQ = qbankState.rawQuestions || [];
    const navMode = (qbankState.pendingNav && qbankState.pendingNav.mode) || "none";
    const hasPartOrLevelFilter = Boolean(qbankState.activeFilter.part || qbankState.activeFilter.level);
    const isFolderBrowserLevel = (navMode === "root" || navMode === "kho") && !qbankState.activeFilter.folderId && !hasPartOrLevelFilter;
    let targets = [];
    let confirmMsg = "";
    let undoLabel = "";
    let toastMsg = "";

    if (mode === "unassigned") {
        targets = allQ.filter(q => Boolean(q && !q.folderId));
        if (targets.length === 0) {
            closeQbankDeleteMultiMenu();
            showQbankToast("ℹ️ Hiện không có câu Chờ xếp nào để xóa!", "info");
            return;
        }
        const assignedKeepCount = allQ.length - targets.length;
        confirmMsg = `⚠️ XÁC NHẬN XÓA CÂU CHỜ XẾP:\n\nBạn có chắc chắn muốn xóa toàn bộ ${targets.length} câu Chờ xếp (chưa gán vào thư mục)?\n\n(${assignedKeepCount} câu đã xếp trong thư mục vẫn được giữ nguyên 100% • Có thể bấm ↩️ Lùi nếu lỡ tay).`;
        undoLabel = `Xóa ${targets.length} câu Chờ xếp`;
        toastMsg = `🗑️ Đã xóa ${targets.length} câu Chờ xếp!`;
    } else if (mode === "displayed") {
        if (isFolderBrowserLevel) {
            closeQbankDeleteMultiMenu();
            showQbankToast("ℹ️ Hãy mở vào chi tiết 1 Đề trước khi xóa các câu đang hiển thị!", "info");
            return;
        }
        targets = getFilteredAndSortedQuestions();
        if (targets.length === 0) {
            closeQbankDeleteMultiMenu();
            showQbankToast("ℹ️ Hiện không có câu hỏi nào đang hiển thị ở cột giữa để xóa!", "info");
            return;
        }
        let scopeDesc = "danh sách đang hiển thị ở cột giữa";
        if (qbankState.activeFilter && qbankState.activeFilter.folderName) {
            scopeDesc = `thư mục "${qbankState.activeFilter.folderName}" đang hiển thị`;
        } else if (navMode === "exam" && qbankState.pendingNav.examId) {
            const ex = (qbankState.pendingExams || []).find(e => e.id === qbankState.pendingNav.examId);
            if (ex) scopeDesc = `đề "${ex.title}"`;
        }
        confirmMsg = `⚠️ XÁC NHẬN XÓA CÁC CÂU ĐANG HIỂN THỊ:\n\nBạn có chắc chắn muốn xóa toàn bộ ${targets.length} câu trong ${scopeDesc}?\n\n(Có thể bấm ↩️ Lùi hoặc Ctrl+Z để khôi phục ngay nếu cần).`;
        undoLabel = `Xóa ${targets.length} câu đang hiển thị`;
        toastMsg = `🗑️ Đã xóa ${targets.length} câu đang hiển thị!`;
    } else if (mode === "selected") {
        pruneStaleSelectedQuestionIds();
        const selSet = qbankState.selectedQuestionIds;
        targets = allQ.filter(q => q && selSet.has(String(q.id)));
        if (targets.length === 0) {
            closeQbankDeleteMultiMenu();
            showQbankToast("⚠️ Vui lòng tích chọn (☑️ Chọn) ít nhất 1 câu hỏi bên dưới!", "warning");
            return;
        }
        confirmMsg = `⚠️ XÁC NHẬN XÓA CÂU TÍCH CHỌN:\n\nBạn có chắc chắn muốn xóa ${targets.length} câu hỏi đã đánh dấu ☑️ Chọn?\n\n(Có thể bấm ↩️ Lùi hoặc Ctrl+Z nếu lỡ tay).`;
        undoLabel = `Xóa ${targets.length} câu tích chọn`;
        toastMsg = `🗑️ Đã xóa ${targets.length} câu tích chọn!`;
    } else {
        return;
    }

    closeQbankDeleteMultiMenu();
    if (!confirm(confirmMsg)) return;

    if (typeof qbankMidEditState !== "undefined" && qbankMidEditState.isActive && typeof closeQbankMidEditMode === "function") {
        closeQbankMidEditMode(true);
    }

    pushQbankUndoState(undoLabel);

    const idsToDelete = new Set(targets.map(q => String(q.id)));
    const deletedQuestions = allQ.filter(q => q && idsToDelete.has(String(q.id)));
    qbankState.rawQuestions = allQ.filter(q => q && !idsToDelete.has(String(q.id)));

    idsToDelete.forEach(id => qbankState.selectedQuestionIds.delete(id));
    cleanupOrphanedImagesInQbank(deletedQuestions);

    if (mode === "unassigned") {
        const remainingExamIds = new Set((qbankState.rawQuestions || []).map(q => q && q.pendingExamId).filter(Boolean));
        qbankState.pendingExams = (qbankState.pendingExams || []).filter(ex => remainingExamIds.has(ex.id));
        if ((qbankState.rawQuestions || []).filter(q => Boolean(q && !q.folderId)).length === 0) {
            qbankState.currentExamTitle = "";
        }
    }

    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();
    saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI();
    updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle();
    renderQbankTree();
    renderQbankQuestions();
    updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast(toastMsg, "warning");
}

document.addEventListener("click", function(e) {
    const delMenu = document.getElementById("qbank-delete-multi-menu");
    if (delMenu && delMenu.classList.contains("show")) {
        const wrapper = document.getElementById("qbank-delete-dropdown-wrapper");
        const btn = document.getElementById("btn-qbank-delete-selected");
        if (!(wrapper && wrapper.contains(e.target)) && !(btn && btn.contains(e.target)) && !delMenu.contains(e.target)) {
            closeQbankDeleteMultiMenu();
        }
    }

    const upMenu = document.getElementById("qbank-upload-menu");
    if (upMenu && upMenu.classList.contains("show")) {
        const upWrapper = document.getElementById("qbank-upload-dropdown-wrapper");
        const upBtn = document.getElementById("btn-qbank-upload-json");
        if (!(upWrapper && upWrapper.contains(e.target)) && !(upBtn && upBtn.contains(e.target)) && !upMenu.contains(e.target)) {
            closeQbankUploadMenu();
        }
    }

    const visMenu = document.getElementById("qbank-tree-vis-menu");
    if (visMenu && visMenu.classList.contains("show")) {
        const visBtn = document.getElementById("btn-qbank-tree-vis-toggle");
        if (!(visBtn && visBtn.contains(e.target)) && !visMenu.contains(e.target)) {
            closeQbankTreeVisMenu();
        }
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const delMenu = document.getElementById("qbank-delete-multi-menu");
        if (delMenu && delMenu.classList.contains("show")) closeQbankDeleteMultiMenu();
        const upMenu = document.getElementById("qbank-upload-menu");
        if (upMenu && upMenu.classList.contains("show")) closeQbankUploadMenu();
        const visMenu = document.getElementById("qbank-tree-vis-menu");
        if (visMenu && visMenu.classList.contains("show")) closeQbankTreeVisMenu();
        closeClassTransferKhoPopover();
    }
});

function deleteQbankQuestion(qId) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
    const target = qbankState.rawQuestions.find(q => String(q.id) === String(qId));
    pushQbankUndoState(`Xóa ${target && target.matrixId ? target.matrixId : "1 câu hỏi"}`);
    qbankState.rawQuestions = qbankState.rawQuestions.filter(q => String(q.id) !== String(qId));
    qbankState.selectedQuestionIds.delete(String(qId));
    if (target) cleanupOrphanedImagesInQbank([target]);
    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds(); saveQbankDraftState(false);
    updateQbankDeleteSelectedButtonUI(); updateQbankUploadMenuCounts();
    renderQbankHeaderAndMidExamTitle(); renderQbankTree(); renderQbankQuestions(); updateQbankMatrixStats();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
    if (typeof refreshQbankExportPopoverIfOpen === "function") refreshQbankExportPopoverIfOpen();
    showQbankToast("🗑️ Đã xóa câu hỏi.", "warning");
}

function promptMoveQuestion(qId) {
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (!q) return;

    const existingModal = document.getElementById("move-qbank-modal");
    if (existingModal) existingModal.remove();

    let options = [];
    function traverse(nodes, path) {
        (nodes || []).forEach(n => {
            let p = path ? path + " > " + n.name : n.name;
            if (!n.children || n.children.length === 0) options.push({ id: n.id, name: p });
            else traverse(n.children, p);
        });
    }
    traverse(qbankState.currentTree, "");
    if (options.length === 0) return alert("Chưa có thư mục lá nào để chuyển!");

    const currentPart = getQbankQuestionPart(q);
    const currentLevel = (typeof normalizeQbankLevel === "function") ? normalizeQbankLevel(q.level) : (q.level || "nb");
    let selectHtml = `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">1. Chọn thư mục lưu trữ:</label><select id="move-qbank-folder" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;">${options.map(o => `<option value="${escapeQbankAttr(o.id)}" ${o.id === q.folderId ? "selected" : ""}>${escapeQbankHtml(o.name)}</option>`).join("")}</select></div>`;
    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">2. Chọn Phần thi:</label><select id="move-qbank-part" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;"><option value="1" ${currentPart === 1 ? "selected" : ""}>Phần I: Trắc nghiệm 4 lựa chọn</option><option value="2" ${currentPart === 2 ? "selected" : ""}>Phần II: Trắc nghiệm Đúng/Sai</option><option value="3" ${currentPart === 3 ? "selected" : ""}>Phần III: Trả lời ngắn</option><option value="4" ${currentPart === 4 ? "selected" : ""}>Phần IV: Tự luận ngắn</option></select></div>`;
    selectHtml += `<div style="margin-bottom:12px;"><label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:4px;">3. Chọn Mức độ:</label><select id="move-qbank-level" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-weight:700;"><option value="nb" ${currentLevel === "nb" ? "selected" : ""}>Nhận biết (NB)</option><option value="th" ${currentLevel === "th" ? "selected" : ""}>Thông hiểu (TH)</option><option value="vdt" ${currentLevel === "vdt" ? "selected" : ""}>Vận dụng (VD)</option><option value="vdc" ${currentLevel === "vdc" ? "selected" : ""}>Vận dụng cao (VDC)</option></select></div>`;

    let div = document.createElement("div");
    div.className = "qbank-modal-overlay"; div.id = "move-qbank-modal"; div.style.display = "flex";
    div.onclick = function(e) { if (e.target === div) div.remove(); };
    div.innerHTML = `<div class="qbank-modal-container" style="width:50vw; min-width:320px; max-width:520px; height:auto; padding:22px; overflow:visible; background:#fff;" onclick="event.stopPropagation()"><h3 style="margin-top:0; color:#0284c7; font-weight:900; font-size:17px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:14px;">🔄 CHUYỂN CÂU HỎI SANG MỤC KHÁC</h3>${selectHtml}<div style="display:flex; gap:10px; margin-top:16px;"><button onclick="document.getElementById('move-qbank-modal').remove()" style="flex:1; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; background:#f8fafc; cursor:pointer; font-weight:800;">✕ Hủy</button><button onclick="executeMoveQbankQuestion('${safeQbankJsArg(qId)}')" style="flex:1.5; padding:10px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; cursor:pointer; font-weight:900;">🚀 Xác nhận chuyển</button></div></div>`;
    document.body.appendChild(div);
}

function executeMoveQbankQuestion(qId) {
    let f = document.getElementById("move-qbank-folder"), p = document.getElementById("move-qbank-part"), l = document.getElementById("move-qbank-level");
    if (!f || !p || !l) return;
    if (findNodeInTree(qbankState.currentTree, f.value) && qbankState.rawQuestions.find(x => String(x.id) === String(qId))) {
        applyMatrixToQuestion(qId, f.value, parseInt(p.value, 10), l.value);
        const modal = document.getElementById("move-qbank-modal");
        if (modal) modal.remove();
    }
}

// ============================================================================
// 6. LỌC, SẮP XẾP & RENDER CỘT GIỮA (3 CẤP THƯ MỤC + DANH SÁCH CÂU HỎI)
// ============================================================================
function getScopeQuestionsForMatrix() {
    let list = [...(qbankState.rawQuestions || [])];
    const nav = qbankState.pendingNav || { mode: "none", khoId: null, examId: null };

    if (qbankState.activeFilter.folderId) {
        const rootNode = findNodeInTree(qbankState.currentTree, qbankState.activeFilter.folderId);
        if (rootNode) {
            const allowedFolderIds = new Set(getAllDescendantFolderIds(rootNode));
            list = list.filter(q => q && q.folderId && allowedFolderIds.has(q.folderId));
        }
    } else if (nav.mode === "exam" && nav.examId) {
        list = list.filter(q => q && String(q.pendingExamId) === String(nav.examId));
        if (qbankState.hideAssigned) list = list.filter(q => !q.folderId);
    } else if (nav.mode === "kho" && nav.khoId) {
        const examIdsInKho = new Set((qbankState.pendingExams || []).filter(e => e.khoId === nav.khoId).map(e => String(e.id)));
        list = list.filter(q => q && (q.pendingKhoId === nav.khoId || (q.pendingExamId && examIdsInKho.has(String(q.pendingExamId)))));
        if (qbankState.hideAssigned) list = list.filter(q => !q.folderId);
    } else if (nav.mode === "root") {
        list = list.filter(q => q && (!q.folderId || q.pendingExamId));
        if (qbankState.hideAssigned) list = list.filter(q => !q.folderId);
    } else if (qbankState.hideAssigned) {
        list = list.filter(q => q && !q.folderId);
    } else if (qbankState.assignMode) {
        const curTitle = (qbankState.currentExamTitle || "").trim();
        list = list.filter(q => !q ? false : (!q.folderId || !curTitle || !q.sourceExam || q.sourceExam === curTitle));
    }
    return list;
}

function sortAssignedQuestionsArray(arr) {
    const levelOrder = { nb: 1, th: 2, vdt: 3, vdc: 4 };
    const { orderMap } = buildTreeOrderMap();
    return [...arr].sort((a, b) => {
        const orderA = orderMap[a.folderId] ?? 999999, orderB = orderMap[b.folderId] ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        const pA = getQbankQuestionPart(a), pB = getQbankQuestionPart(b);
        if (pA !== pB) return pA - pB;
        const lvlA = levelOrder[normalizeQbankLevel(a.level)] || 1, lvlB = levelOrder[normalizeQbankLevel(b.level)] || 1;
        if (lvlA !== lvlB) return lvlA - lvlB;
        const seqA = Number(a.matrixSeq) || 0, seqB = Number(b.matrixSeq) || 0;
        if (seqA !== seqB) return seqA - seqB;
        return (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0);
    });
}

function getFilteredAndSortedQuestions() {
    let list = getScopeQuestionsForMatrix();
    if (qbankState.activeFilter.part) list = list.filter(q => getQbankQuestionPart(q) === qbankState.activeFilter.part);
    if (qbankState.activeFilter.level) {
        const filterLvl = normalizeQbankLevel(qbankState.activeFilter.level);
        list = list.filter(q => normalizeQbankLevel(q.level) === filterLvl);
    }
    const assigned = list.filter(q => Boolean(q && q.folderId && q.matrixId));
    const unassigned = list.filter(q => Boolean(q && !(q.folderId && q.matrixId)));
    return [...sortAssignedQuestionsArray(assigned), ...[...unassigned].sort((a, b) => (Number(a.origIndex) || 0) - (Number(b.origIndex) || 0))];
}

function updateQbankMatrixStats() {
    const bar = document.getElementById("qbank-matrix-bar");
    if (!bar) return;

    const nav = qbankState.pendingNav || { mode: "none", khoId: null, examId: null };
    const scopedQuestions = getScopeQuestionsForMatrix();

    if ((qbankState.rawQuestions || []).length === 0 && nav.mode === "none") {
        bar.innerHTML = `<span style="color:#64748b; font-style:italic;">Bấm "Upload file JSON đề" (chọn 1 trong 4 kho) hoặc bấm "🏦 Chuyển ngân hàng đề" trên lớp để xem ma trận thống kê 4 mức độ</span>`;
        return;
    }

    const stats = { 1: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 2: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 3: { nb: 0, th: 0, vdt: 0, vdc: 0 }, 4: { nb: 0, th: 0, vdt: 0, vdc: 0 } };
    let total = 0;
    scopedQuestions.forEach(q => {
        const p = getQbankQuestionPart(q);
        const lvl = normalizeQbankLevel(q.level);
        if (stats[p] && stats[p][lvl] !== undefined) { stats[p][lvl]++; total++; }
    });

    let html = "";
    [1, 2, 3, 4].forEach(p => {
        const s = stats[p], sumP = s.nb + s.th + s.vdt + s.vdc;
        if (sumP > 0 || total === 0) {
            const isPartAct = (qbankState.activeFilter.part === p && !qbankState.activeFilter.level);
            html += `<div class="matrix-group ${isPartAct ? "active-filter" : ""}" onclick="filterByGlobalPart(${p})"><span class="matrix-title">Phần ${p} (${sumP})</span><div class="matrix-row"><span class="stat-pill nb ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "nb" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'nb')">NB: ${s.nb}</span><span class="stat-pill th ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "th" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'th')">TH: ${s.th}</span><span class="stat-pill vdt ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "vdt" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdt')">VD: ${s.vdt}</span><span class="stat-pill vdc ${qbankState.activeFilter.part === p && qbankState.activeFilter.level === "vdc" ? "active-filter" : ""}" onclick="event.stopPropagation(); filterByGlobalCell(${p}, 'vdc')">VDC: ${s.vdc}</span></div></div>`;
        }
    });
    html += `<div style="margin-left:auto; font-weight:900; color:#0f172a; font-size:10.5px; white-space:nowrap;">Đang xem: ${total} câu</div>`;

    let filterLabels = [];
    if (qbankState.activeFilter.folderName) {
        filterLabels.push(`Thư mục: ${qbankState.activeFilter.folderName}`);
    } else if (nav.mode === "root") {
        filterLabels.push("Kho chờ xếp (4 kho)");
    } else if (nav.mode === "kho" && nav.khoId) {
        filterLabels.push(getPendingKhoMeta(nav.khoId).name);
    } else if (nav.mode === "exam" && nav.examId) {
        const ex = (qbankState.pendingExams || []).find(e => e.id === nav.examId);
        filterLabels.push(`Đề: ${ex ? ex.title : "Đang chọn"}`);
    } else if (qbankState.hideAssigned) {
        filterLabels.push("Đang ẩn câu đã xếp");
    } else if (qbankState.assignMode) {
        filterLabels.push("Chế độ Xếp câu (Đã đánh ID ở trên • Chưa xếp ở dưới)");
    }

    if (qbankState.hideAssigned && (nav.mode !== "none" || qbankState.activeFilter.folderName)) {
        filterLabels.push("Đang ẩn đã xếp");
    }
    if (qbankState.activeFilter.part) filterLabels.push(`Phần ${qbankState.activeFilter.part}`);
    if (qbankState.activeFilter.level) filterLabels.push(`Mức: ${getQbankLevelLabel(qbankState.activeFilter.level)}`);

    if (filterLabels.length > 0) {
        html += `<div class="qbank-active-filter-bar" style="width:100%;"><span>🔍 Đang xem: <b>${escapeQbankHtml(filterLabels.join(" • "))}</b></span><button type="button" class="btn-clear-filter" onclick="clearQbankFilter()">✕ Hiện tất cả ngân hàng</button></div>`;
    }
    bar.innerHTML = html;
}

function filterByGlobalPart(p) {
    if (qbankState.activeFilter.part === p && !qbankState.activeFilter.level) qbankState.activeFilter.part = null;
    else { qbankState.activeFilter.part = p; qbankState.activeFilter.level = null; }
    renderQbankQuestions(); updateQbankMatrixStats();
}

function filterByGlobalCell(p, lvl) {
    if (qbankState.activeFilter.part === p && qbankState.activeFilter.level === lvl) { qbankState.activeFilter.part = null; qbankState.activeFilter.level = null; }
    else { qbankState.activeFilter.part = p; qbankState.activeFilter.level = lvl; }
    renderQbankQuestions(); updateQbankMatrixStats();
}

function buildPendingNavBarHtml(mode, khoId, examId) {
    const khoMeta = khoId ? getPendingKhoMeta(khoId) : null;
    const ex = examId ? (qbankState.pendingExams || []).find(e => e.id === examId) : null;
    const safeKhoId = safeQbankJsArg(khoId || "");

    let crumbsHtml = "";
    let rightActionsHtml = "";

    if (mode === "root") {
        crumbsHtml = `<span class="qbank-pending-crumb-current">🏠 Thư mục gốc (4 Kho chờ xếp)</span>`;
        rightActionsHtml = `
            <button type="button" class="btn-qbank-nav-mini" onclick="exitPendingBrowserToAll(event)" title="Quay về xem toàn bộ câu hỏi trong ngân hàng">📋 Xem tất cả ngân hàng</button>
        `;
    } else if (mode === "kho" && khoMeta) {
        crumbsHtml = `
            <button type="button" class="qbank-pending-crumb-link" onclick="openPendingRootFolder(event)">🏠 Thư mục gốc</button>
            <span class="qbank-pending-crumb-sep">›</span>
            <span class="qbank-pending-crumb-current" style="color:${khoMeta.color};">${khoMeta.icon} ${escapeQbankHtml(khoMeta.name)}</span>
        `;
        rightActionsHtml = `
            <button type="button" class="btn-qbank-nav-mini is-primary" onclick="triggerDirectKhoFileUpload('${safeKhoId}', event)">📥 Chọn file tải lên kho này</button>
        `;
    } else if (mode === "exam" && ex) {
        const km = getPendingKhoMeta(ex.khoId);
        const visibleCount = getFilteredAndSortedQuestions().length;
        crumbsHtml = `
            <button type="button" class="qbank-pending-crumb-link" onclick="openPendingRootFolder(event)">🏠 Gốc</button>
            <span class="qbank-pending-crumb-sep">›</span>
            <button type="button" class="qbank-pending-crumb-link" style="color:${km.color};" onclick="openPendingKhoFolder('${safeQbankJsArg(km.id)}', event)">${km.icon} ${escapeQbankHtml(km.shortName)}</button>
            <span class="qbank-pending-crumb-sep">›</span>
            <span class="qbank-pending-crumb-current" title="${escapeQbankAttr(ex.title)}">📄 ${escapeQbankHtml(ex.title)}</span>
        `;
        rightActionsHtml = `
            <button type="button" class="btn-qbank-nav-mini is-select" onclick="selectAllQuestionsInActivePendingExam(true)">☑️ Chọn hết (${visibleCount})</button>
            <button type="button" class="btn-qbank-nav-mini" onclick="selectAllQuestionsInActivePendingExam(false)">⬜ Bỏ chọn</button>
        `;
    }

    return `
        <div class="qbank-pending-nav-bar">
            <div class="qbank-pending-nav-left">
                <button type="button" class="btn-qbank-back" onclick="navigatePendingBack(event)" title="Quay lại thư mục trước đó">← Back</button>
                <div class="qbank-pending-breadcrumb">${crumbsHtml}</div>
            </div>
            <div class="qbank-pending-nav-actions">${rightActionsHtml}</div>
        </div>
    `;
}

function renderPendingRootView(container) {
    const cardsHtml = QBANK_PENDING_KHOS.map(kho => {
        const st = getKhoPendingStats(kho.id);
        return `
            <div class="qbank-kho-folder-card" style="--kho-color:${kho.color}; --kho-bg:${kho.bg}; --kho-border:${kho.border};" onclick="openPendingKhoFolder('${safeQbankJsArg(kho.id)}', event)">
                <div class="qbank-kho-card-top">
                    <span class="qbank-kho-card-icon">${kho.icon}</span>
                    <div class="qbank-kho-card-title">
                        <b>${escapeQbankHtml(kho.name)}</b>
                        <small>Nhấp để mở thư mục &amp; tải đề JSON</small>
                    </div>
                </div>
                <div class="qbank-kho-card-stats">
                    <span class="kho-stat-pill is-exams">📑 ${st.examCount} đề</span>
                    <span class="kho-stat-pill ${st.unassigned > 0 ? "is-pending" : "is-done"}">📥 Chờ xếp: ${st.unassigned}</span>
                    <span class="kho-stat-pill is-assigned">✅ Đã xếp: ${st.assigned}</span>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        ${buildPendingNavBarHtml("root", null, null)}
        <div class="qbank-kho-root-grid">${cardsHtml}</div>
    `;
}

function renderPendingKhoView(container, khoId) {
    const khoMeta = getPendingKhoMeta(khoId);
    const safeKhoId = safeQbankJsArg(khoId);
    const examsInKho = (qbankState.pendingExams || []).filter(e => e.khoId === khoId);

    let listHtml = "";
    if (examsInKho.length === 0) {
        listHtml = `
            <div class="qbank-kho-empty-box">
                <div style="font-size:32px; margin-bottom:6px;">${khoMeta.icon}</div>
                <b>${escapeQbankHtml(khoMeta.name)} hiện chưa có đề nào</b>
                <p>Hãy kéo thả file <b>.json / .js / .txt</b> vào khung phía trên hoặc bấm <b>📥 Chọn file tải lên kho này</b> (hoặc dùng nút <b>🏦 Chuyển ngân hàng đề</b> ở ngoài các lớp).</p>
            </div>
        `;
    } else {
        listHtml = `<div class="qbank-pending-exam-list">` + examsInKho.map((ex, idx) => {
            const qList = (qbankState.rawQuestions || []).filter(q => q && String(q.pendingExamId) === String(ex.id));
            const total = qList.length;
            const assigned = qList.filter(q => Boolean(q.folderId)).length;
            const unassigned = total - assigned;
            const isDone = (total > 0 && unassigned === 0);
            const safeExamId = safeQbankJsArg(ex.id);
            const isFirst = (idx === 0);
            const isLast = (idx === examsInKho.length - 1);

            const statusPill = isDone
                ? `<span class="qbank-pending-progress-pill is-done">✅ Xếp xong 100%</span>`
                : `<span class="qbank-pending-progress-pill is-pending">📥 Chờ xếp: ${unassigned} câu</span>`;

            return `
                <div class="qbank-pending-exam-card ${isDone ? "is-completed" : ""}" id="pending-exam-card-${escapeQbankAttr(ex.id)}">
                    <div class="qbank-pending-exam-main" onclick="openPendingExamDetail('${safeExamId}', event)" title="Nhấp vào tên đề để xòe ra toàn bộ câu hỏi của đề này">
                        <span class="qbank-pending-exam-icon">${isDone ? "✅" : "📄"}</span>
                        <div class="qbank-pending-exam-info">
                            <div class="qbank-pending-exam-title">${escapeQbankHtml(ex.title)}</div>
                            <div class="qbank-pending-exam-meta">
                                ${statusPill}
                                <span class="qbank-pending-count-text">Chờ xếp: <b>${unassigned}</b> • Đã xếp: <b style="color:#16a34a;">${assigned}</b> / Tổng: <b>${total}</b> câu</span>
                            </div>
                        </div>
                    </div>
                    <div class="qbank-pending-exam-actions" onclick="event.stopPropagation()">
                        <button type="button" class="btn-pending-exam-act btn-act-move-up" ${isFirst ? "disabled" : ""} onclick="movePendingExamOrder('${safeExamId}', -1, event)" title="Đưa đề lên trên">▲</button>
                        <button type="button" class="btn-pending-exam-act btn-act-move-down" ${isLast ? "disabled" : ""} onclick="movePendingExamOrder('${safeExamId}', 1, event)" title="Đưa đề xuống dưới">▼</button>
                        <button type="button" class="btn-pending-exam-act btn-act-transfer" onclick="openMovePendingExamKhoModal('${safeExamId}', event)" title="Chuyển đề này sang kho lớp khác">🔄 Chuyển lớp</button>
                        <button type="button" class="btn-pending-exam-act btn-act-rename" onclick="renamePendingExam('${safeExamId}', event)" title="Đổi tên đề">✏️ Đổi tên</button>
                        <button type="button" class="btn-pending-exam-act btn-act-delete" onclick="deletePendingExam('${safeExamId}', event)" title="Xóa vỏ đề & các câu chưa xếp (giữ 100% câu đã xếp)">🗑️ Xóa</button>
                    </div>
                </div>
            `;
        }).join("") + `</div>`;
    }

    container.innerHTML = `
        ${buildPendingNavBarHtml("kho", khoId, null)}
        <div class="qbank-kho-dropzone" style="--kho-color:${khoMeta.color}; --kho-bg:${khoMeta.bg}; --kho-border:${khoMeta.border};"
             ondragover="handleKhoDropZoneDragOver(event)"
             ondragleave="handleKhoDropZoneDragLeave(event)"
             ondrop="handleKhoDropZoneDrop(event, '${safeKhoId}')"
             onclick="triggerDirectKhoFileUpload('${safeKhoId}', event)">
            <div class="qbank-kho-dropzone-left">
                <span style="font-size:22px;">${khoMeta.icon}</span>
                <div>
                    <b>Tải đề thi vào ${escapeQbankHtml(khoMeta.name)}</b>
                    <small>Kéo thả nhiều file <b>.json / .js / .txt</b> vào đây hoặc bấm chọn file (đề mới tự xếp lên trên cùng)</small>
                </div>
            </div>
            <button type="button" class="btn-qbank btn-qbank-primary" style="flex-shrink:0;" onclick="event.stopPropagation(); triggerDirectKhoFileUpload('${safeKhoId}', event)">📥 Chọn file tải lên</button>
        </div>
        ${listHtml}
    `;
}

function renderQbankCardHtml(q, idx) {
    const letters = ["A", "B", "C", "D"];
    const isChecked = qbankState.selectedQuestionIds.has(String(q.id));
    const p = getQbankQuestionPart(q), levelText = getQbankLevelLabel(q.level || "nb");
    const isAssigned = Boolean(q.folderId && q.matrixId);
    const displayIdText = isAssigned ? q.matrixId : `Câu ${q.origIndex || (idx + 1)} • Chưa xếp`;
    const imgKey = String(q.imageKey || `img_q_${q.id}`).replace(/'/g, "");
    const imgUrl = resolveQbankImageUrl(q, qbankState.imagesMap);
    const safeQId = safeQbankJsArg(q.id);

    const uploaderHtml = `
        <div class="qbank-img-tool-zone" id="zone-qbank-${escapeQbankAttr(q.id)}" tabindex="0" title="Bấm vào đây rồi ấn Ctrl+V để dán ảnh" style="display:flex; align-items:center; gap:5px; background:#f8fafc; padding:3px 6px; border-radius:5px; border:1px dashed #cbd5e1; margin-top:4px;">
            <span style="font-size:10.5px; font-weight:800; color:#475569;">🖼️ Ảnh:</span>
            <button type="button" class="btn-qbank-img" onclick="triggerQBankPaste('${safeQId}', '${safeQbankJsArg(imgKey)}')">📋 Dán (Ctrl+V)</button>
            <input type="file" id="file-qbank-${escapeQbankAttr(q.id)}" accept="image/*" style="display:none;" onchange="handleQBankImgSelect(this, '${safeQId}', '${safeQbankJsArg(imgKey)}')">
            <button type="button" class="btn-qbank-img" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" onclick="document.getElementById('file-qbank-${safeQId}').click()">📁 Tệp</button>
            ${imgUrl ? `<button type="button" class="btn-qbank-img" style="background:#fee2e2; color:#dc2626;" onclick="deleteQBankImg('${safeQId}', '${safeQbankJsArg(imgKey)}')">🗑 Xóa</button>` : ""}
            <span id="status-qbank-${escapeQbankAttr(q.id)}" style="font-size:10px; font-weight:800; margin-left:auto;"></span>
        </div>
        ${imgUrl ? `<div style="text-align:center; margin:4px 0;"><img src="${escapeQbankAttr(imgUrl)}" onerror="handleQbankImgError(this)" style="max-height:140px; max-width:100%; border-radius:6px; border:1px solid #cbd5e1;" alt="Hình minh họa"></div>` : ""}
    `;

    let contentDetailsHtml = "";
    if (p === 1 && Array.isArray(q.options)) {
        let correctIdx = typeof q.correct === "number" ? q.correct : letters.indexOf(String(q.correct || "A").trim().toUpperCase());
        contentDetailsHtml = `<div class="qbank-options-preview">${q.options.map((opt, oIdx) => `<div class="qbank-opt-item ${oIdx === correctIdx ? "is-correct" : ""}"><span class="qbank-opt-circle">${letters[oIdx] || ""}</span><span>${opt} ${oIdx === correctIdx ? "<b>✓</b>" : ""}</span></div>`).join("")}</div>`;
    } else if (p === 2 && Array.isArray(q.statements)) {
        contentDetailsHtml = `<div style="margin:4px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 6px;">${q.statements.map(st => { const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true"); return `<div style="font-size:11.5px; margin-bottom:2px; display:flex; justify-content:space-between;"><span><b>${st.id})</b> ${st.statement}</span><b style="color:${isTrue ? "#16a34a" : "#dc2626"};">${isTrue ? "🟢 Đúng" : "🔴 Sai"}</b></div>`; }).join("")}</div>`;
    } else {
        contentDetailsHtml = `<div style="margin:4px 0; font-size:11.5px; font-weight:800; color:#0d9488; background:#f0fdfa; padding:3px 6px; border-radius:5px; border:1px solid #99f6e4;">🎯 Đáp số: <span style="color:#0f172a;">${q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || "0")}</span></div>`;
    }

    const explainHtml = q.explanation ? `<div style="font-size:11px; color:#78350f; background:#fffbeb; padding:4px 6px; border-radius:5px; border-left:3px solid #f59e0b; margin-top:4px;">💡 <b>Lời giải:</b> ${q.explanation}</div>` : "";
    const folderTag = q.folderName ? `<span style="font-size:10px; color:#16a34a; background:#dcfce7; padding:1px 5px; border-radius:5px; border:1px solid #bbf7d0;">📁 ${escapeQbankHtml(q.folderName)}</span>` : "";
    const unassignBtnHtml = isAssigned ? `<button type="button" class="btn-soide-mini" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;" onclick="unassignQbankQuestion('${safeQId}')">↩️ Bỏ xếp</button>` : "";

    return `
        <div class="qbank-q-card ${isAssigned ? "is-assigned-card" : ""} ${isChecked ? "selected" : ""}" id="qbank-card-${escapeQbankAttr(q.id)}" draggable="true" ondragstart="handleQuestionDragStart(event, '${safeQId}')" ondragend="handleQuestionDragEnd()">
            <div class="qbank-q-header">
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    <span class="qbank-q-id-badge ${isAssigned ? "is-assigned" : "is-unassigned"}">${escapeQbankHtml(displayIdText)}</span>
                    <span style="font-size:10.5px; font-weight:800; color:#059669; border:1px solid #10b981; padding:1px 5px; border-radius:5px; background:#ecfdf5;">Phần ${p} • ${levelText}</span>
                    ${folderTag}
                </div>
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    ${unassignBtnHtml}
                    <button type="button" class="btn-soide-mini" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;" onclick="promptMoveQuestion('${safeQId}')">🔄 Chuyển</button>
                    <button type="button" class="btn-soide-mini" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;" onclick="deleteQbankQuestion('${safeQId}')">🗑️ Xóa</button>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:900; font-size:11.5px; color:#0f172a;"><input type="checkbox" style="width:16px; height:16px; accent-color:#10b981; cursor:pointer;" ${isChecked ? "checked" : ""} onchange="toggleSelectQuestion('${safeQId}', this.checked)"> Chọn</label>
                </div>
            </div>
            <div style="font-size:12.5px; font-weight:600; color:#1e293b; margin-bottom:3px; line-height:1.4;">${qbFormatQuestionText(q.question || "")}</div>
            ${uploaderHtml}${contentDetailsHtml}${explainHtml}
        </div>
    `;
}

function renderQbankQuestions() {
    ensureQbankPendingExamsIntegrity();
    recomputeAllMatrixIds();
    renderQbankHeaderAndMidExamTitle();
    updateQbankDeleteSelectedButtonUI();
    updateQbankUploadMenuCounts();

    const container = document.getElementById("qbank-questions-list");
    if (!container) return;

    const nav = qbankState.pendingNav || { mode: "none", khoId: null, examId: null };
    const hasPartOrLevelFilter = Boolean(qbankState.activeFilter.part || qbankState.activeFilter.level);
    if (!qbankState.activeFilter.folderId && !hasPartOrLevelFilter) {
        if (nav.mode === "root") {
            renderPendingRootView(container);
            return;
        }
        if (nav.mode === "kho" && nav.khoId) {
            renderPendingKhoView(container, nav.khoId);
            return;
        }
    }

    const questions = getFilteredAndSortedQuestions();
    const topPendingNavHtml = (!qbankState.activeFilter.folderId && (nav.mode === "exam" || (hasPartOrLevelFilter && (nav.mode === "root" || nav.mode === "kho"))))
        ? buildPendingNavBarHtml(nav.mode, nav.khoId, nav.examId)
        : "";

    if (questions.length === 0) {
        const isFilterActive = qbankState.activeFilter.folderId || qbankState.activeFilter.part || qbankState.activeFilter.level || qbankState.hideAssigned;
        const unassignedLeft = (qbankState.rawQuestions || []).filter(q => !q.folderId).length;
        const assignedTotal = (qbankState.rawQuestions || []).length - unassignedLeft;
        let emptyHeadline = "Chưa có câu hỏi nào trong danh sách.";
        let emptyHint = 'Bấm "Upload file JSON đề" (chọn 1 trong 4 kho chờ xếp) hoặc bấm "🏦 Chuyển ngân hàng đề" trên lớp để nạp đề thi!';
        if (nav.mode === "exam" && nav.examId) {
            const ex = (qbankState.pendingExams || []).find(e => e.id === nav.examId);
            const allInEx = (qbankState.rawQuestions || []).filter(q => q && String(q.pendingExamId) === String(nav.examId));
            if (qbankState.hideAssigned && allInEx.length > 0 && allInEx.every(q => Boolean(q.folderId))) {
                emptyHeadline = `🎉 Đã xếp xong 100% câu hỏi của đề "${ex ? ex.title : ""}"!`;
                emptyHint = `Đề này có <b>${allInEx.length} câu</b> và toàn bộ đã nằm trong cây thư mục bên trái. Bấm <b>← Back</b> để quay về kho hoặc tắt <b>Đang ẩn đã xếp</b> để xem lại.`;
            } else if (allInEx.length === 0) {
                emptyHeadline = "Đề này hiện không còn câu hỏi nào.";
                emptyHint = 'Bấm <b>← Back</b> để quay về kho hoặc bấm <b>✏️ Sửa đề</b> để thêm câu mới.';
            }
        } else if (qbankState.hideAssigned && !qbankState.activeFilter.folderId && assignedTotal > 0 && unassignedLeft === 0) {
            emptyHeadline = "🎉 Đã xếp xong 100% câu hỏi của đề gốc vào ngân hàng!";
            emptyHint = `Hiện có <b>${assignedTotal} câu</b> trong các thư mục bên trái.`;
        } else if (isFilterActive) {
            emptyHeadline = "Không tìm thấy câu hỏi nào phù hợp với bộ lọc này.";
            emptyHint = '<a href="javascript:void(0)" onclick="clearQbankFilter()" style="color:#0284c7; font-weight:800; text-decoration:underline;">Nhấn vào đây để hủy lọc và xem tất cả</a>';
        }
        container.innerHTML = `${topPendingNavHtml}<div style="text-align:center; padding:40px 16px; color:#64748b;"><div style="font-size:36px; margin-bottom:8px;">${isFilterActive ? "🔍" : "📥"}</div><b>${emptyHeadline}</b><p style="font-size:11.5px; margin-top:6px;">${emptyHint}</p></div>`;
        return;
    }

    const assignedQuestions = questions.filter(q => Boolean(q.folderId && q.matrixId));
    const unassignedQuestions = questions.filter(q => !Boolean(q.folderId && q.matrixId));
    let html = topPendingNavHtml;
    const showGroupHeaders = !qbankState.activeFilter.folderId && assignedQuestions.length > 0;
    if (showGroupHeaders) html += `<div class="qbank-section-banner assigned-banner"><span>📌 CÂU ĐÃ XẾP VÀO THƯ MỤC &amp; ĐÁNH SỐ ID TỰ ĐỘNG (${assignedQuestions.length} câu)</span><span style="font-size:10px; font-weight:700;">Xếp trên cùng</span></div>`;
    assignedQuestions.forEach((q, idx) => { html += renderQbankCardHtml(q, idx); });
    if (showGroupHeaders && unassignedQuestions.length > 0) html += `<div class="qbank-section-banner unassigned-banner"><span>📥 CÂU CHƯA KÉO THẢ / CHƯA CÓ ID (${unassignedQuestions.length} câu)</span><span style="font-size:10px; font-weight:700;">Giữ nguyên thứ tự đề gốc</span></div>`;
    unassignedQuestions.forEach((q, idx) => { html += renderQbankCardHtml(q, idx); });
    container.innerHTML = html;
    if (window.MathJax && MathJax.typesetPromise) { try { MathJax.typesetPromise([container]).catch(() => {}); } catch (e) {} }
}

function handleQuestionDragStart(e, qId) {
    cancelLeafAutoExpandTimer();
    qbankState.draggedQId = qId;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", qId);
    }
}
function handleQuestionDragEnd() {
    cancelLeafAutoExpandTimer();
    qbankState.draggedQId = null;
    document.querySelectorAll(".leaf-drop-zone.drag-over").forEach(el => el.classList.remove("drag-over"));
}
function toggleSelectQuestion(qId, isChecked) {
    if (isChecked) qbankState.selectedQuestionIds.add(String(qId));
    else qbankState.selectedQuestionIds.delete(String(qId));
    const card = document.getElementById(`qbank-card-${qId}`);
    if (card) card.classList.toggle("selected", isChecked);
    updateQbankDeleteSelectedButtonUI();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
}
function clearSelectedQuestions() {
    qbankState.selectedQuestionIds.clear();
    updateQbankDeleteSelectedButtonUI(); renderQbankQuestions();
    if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
}

// ============================================================================
// 7. UPLOAD & DÁN ẢNH CHO CÂU HỎI (CTRL + V) - NÉN THÔNG MINH & CHẶN TUYỆT ĐỐI BASE64
// ============================================================================
function triggerQBankPaste(qId, imgKey) {
    const zone = document.getElementById(`zone-qbank-${qId}`);
    if (zone) zone.focus();
    showQbankToast("📋 Hãy bấm phím Ctrl + V để dán ảnh chụp vào câu này!", "info");
}

function compressQbankImageToBase64(file, maxDimension = 1600, quality = 0.86) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("Không có file ảnh!"));
        if (file.size && file.size <= 750 * 1024) {
            const reader = new FileReader();
            reader.onload = () => {
                const raw = String(reader.result || "");
                const b64 = raw.includes("base64,") ? raw.split("base64,")[1] : raw;
                resolve({ base64: b64, mimeType: file.type || "image/png", ext: "png" });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const objUrl = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(file) : null;
        const img = new Image();
        img.onload = () => {
            try {
                let w = img.naturalWidth || img.width || 1200;
                let h = img.naturalHeight || img.height || 900;
                if (w > maxDimension || h > maxDimension) {
                    if (w > h) { h = Math.round((h * maxDimension) / w); w = maxDimension; }
                    else { w = Math.round((w * maxDimension) / h); h = maxDimension; }
                }
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                const b64 = dataUrl.split(",")[1];
                if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                resolve({ base64: b64, mimeType: "image/jpeg", ext: "jpg" });
            } catch (err) {
                if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                reject(err);
            }
        };
        img.onerror = () => {
            if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
            const reader = new FileReader();
            reader.onload = () => {
                const raw = String(reader.result || "");
                const b64 = raw.includes("base64,") ? raw.split("base64,")[1] : raw;
                resolve({ base64: b64, mimeType: file.type || "image/png", ext: "png" });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        };
        if (objUrl) img.src = objUrl;
        else {
            const reader = new FileReader();
            reader.onload = () => { img.src = String(reader.result || ""); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }
    });
}

async function uploadImageToHostOrDrive(file, filenamePrefix = "qbank_img") {
    const compressed = await compressQbankImageToBase64(file, 1600, 0.86);
    const b64 = compressed.base64;
    if (!b64) throw new Error("Không đọc được dữ liệu hình ảnh!");

    let directUrl = "";

    if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_")) {
        const fd = new FormData();
        fd.append("image", b64);
        const controller = new AbortController();
        const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 6500);
        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd, signal: controller.signal });
            clearTimeout(timer);
            if (res && res.ok) {
                const r = await res.json().catch(() => null);
                if (r && r.data) directUrl = r.data.display_url || r.data.url || "";
            }
        } catch (e) {
            clearTimeout(timer);
        }
    }

    if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
        for (let attempt = 1; attempt <= 2 && !directUrl; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 45000);
            try {
                const res = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "uploadFile",
                        folderName: "Anh_Ngan_Hang_Cau_Hoi",
                        filename: `${filenamePrefix}_${Date.now()}.${compressed.ext}`,
                        mimeType: compressed.mimeType,
                        base64: b64
                    }),
                    signal: controller.signal
                });
                clearTimeout(timer);
                const r = await res.json().catch(() => null);
                if (r && r.fileUrl) {
                    directUrl = (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(r.fileUrl) : r.fileUrl;
                }
            } catch (e) {
                clearTimeout(timer);
                if (attempt < 2) await new Promise(res => setTimeout(res, 1000));
            }
        }
    }

    if (!directUrl || isBase64DataUrl(directUrl)) {
        throw new Error("Không thể tải ảnh lên ImgBB và Google Drive (mạng bận hoặc quá giờ). Đã chặn lưu Base64 để bảo vệ dung lượng Database! Vui lòng thử dán lại.");
    }

    return normalizeDriveImageLinkIfNeeded(directUrl);
}

document.addEventListener("paste", function(e) {
    const activeEl = document.activeElement;
    if (!activeEl || !activeEl.id) return;
    const items = (e.clipboardData || window.clipboardData)?.items;
    if (!items) return;

    if (activeEl.id.startsWith("zone-qbank-")) {
        const qId = activeEl.id.replace("zone-qbank-", "");
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) { e.preventDefault(); uploadQBankImage(items[i].getAsFile(), qId, imgKey); break; }
        }
    } else if (activeEl.id.startsWith("qb-edit-zone-")) {
        const qId = activeEl.id.replace("qb-edit-zone-", "");
        const q = (qbankMidEditState.questions || []).find(x => String(x.id) === String(qId));
        const imgKey = q ? (q.imageKey || `img_q_${q.id}`) : `img_q_${qId}`;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                e.preventDefault();
                if (typeof qbEditUploadImage === "function") qbEditUploadImage(items[i].getAsFile(), qId, imgKey);
                break;
            }
        }
    }
});

function handleQBankImgSelect(input, qId, imgKey) { if (input.files && input.files[0]) uploadQBankImage(input.files[0], qId, imgKey); }

async function uploadQBankImage(file, qId, imgKey) {
    const stEl = document.getElementById(`status-qbank-${qId}`);
    if (stEl) { stEl.style.color = "#0284c7"; stEl.innerText = "⏳ Đang tải..."; }
    try {
        const directUrl = await uploadImageToHostOrDrive(file, `qbank_img_${qId}`);
        if (!qbankState.imagesMap || typeof qbankState.imagesMap !== "object") qbankState.imagesMap = {};
        qbankState.imagesMap[imgKey] = directUrl;
        const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
        if (q) { q.imageUrl = directUrl; q.imageKey = imgKey; }
        saveQbankDraftState(false); renderQbankQuestions();
        showQbankToast("🖼️ Đã chèn ảnh (link URL) cho câu hỏi thành công!", "success");
    } catch (e) {
        if (stEl) { stEl.style.color = "#dc2626"; stEl.innerText = "❌ Lỗi"; }
        showQbankToast("❌ Lỗi tải ảnh: " + e.message, "error");
        alert("❌ Lỗi tải ảnh:\n" + e.message);
    }
}

function deleteQBankImg(qId, imgKey) {
    if (!confirm("⚠️ Xóa ảnh minh họa của câu này?")) return;
    if (qbankState.imagesMap) { delete qbankState.imagesMap[imgKey]; delete qbankState.imagesMap[`img_q_${qId}`]; }
    const q = qbankState.rawQuestions.find(x => String(x.id) === String(qId));
    if (q) q.imageUrl = "";
    saveQbankDraftState(false); renderQbankQuestions();
    showQbankToast("🗑️ Đã xóa ảnh của câu hỏi.", "info");
}

// Xuất ra window scope
window.toggleQbankTreeVisMenu = toggleQbankTreeVisMenu;
window.closeQbankTreeVisMenu = closeQbankTreeVisMenu;
window.setQbankTreeVisOption = setQbankTreeVisOption;
window.setAllQbankTreeVisOptions = setAllQbankTreeVisOptions;
window.normalizeQuestionAnswerOnTransfer = normalizeQuestionAnswerOnTransfer;
window.closeClassTransferKhoPopover = closeClassTransferKhoPopover;
window.transferClassExamToQBank = transferClassExamToQBank;
window.executeTransferClassExamToKho = executeTransferClassExamToKho;
window.ensureQbankUploadDropdownInDOM = ensureQbankUploadDropdownInDOM;
window.updateQbankUploadMenuCounts = updateQbankUploadMenuCounts;
window.closeQbankUploadMenu = closeQbankUploadMenu;
window.toggleQbankUploadMenu = toggleQbankUploadMenu;
window.triggerQbankUpload = triggerQbankUpload;
window.openPendingRootFolder = openPendingRootFolder;
window.openPendingKhoFolder = openPendingKhoFolder;
window.openPendingExamDetail = openPendingExamDetail;
window.navigatePendingBack = navigatePendingBack;
window.exitPendingBrowserToAll = exitPendingBrowserToAll;
window.triggerDirectKhoFileUpload = triggerDirectKhoFileUpload;
window.handleKhoDropZoneDragOver = handleKhoDropZoneDragOver;
window.handleKhoDropZoneDragLeave = handleKhoDropZoneDragLeave;
window.handleKhoDropZoneDrop = handleKhoDropZoneDrop;
window.movePendingExamOrder = movePendingExamOrder;
window.renamePendingExam = renamePendingExam;
window.deletePendingExam = deletePendingExam;
window.openMovePendingExamKhoModal = openMovePendingExamKhoModal;
window.executeMovePendingExamToKho = executeMovePendingExamToKho;
window.selectAllQuestionsInActivePendingExam = selectAllQuestionsInActivePendingExam;
window.toggleLeafMatrixDisplay = toggleLeafMatrixDisplay;
window.handleLeafTreeDragOver = handleLeafTreeDragOver;
window.handleLeafTreeDragLeave = handleLeafTreeDragLeave;
window.renderQbankTree = renderQbankTree;
window.handleFolderNodeClick = handleFolderNodeClick;
window.setFilterByNodePart = setFilterByNodePart;
window.handleMatrixCellClick = handleMatrixCellClick;
window.syncAssignModeButtonsUI = syncAssignModeButtonsUI;
window.clearQbankFilter = clearQbankFilter;
window.toggleQbankAssignMode = toggleQbankAssignMode;
window.toggleHideAssignedQuestions = toggleHideAssignedQuestions;
window.promptRenameFolder = promptRenameFolder;
window.promptAddRootFolder = promptAddRootFolder;
window.promptAddChildFolder = promptAddChildFolder;
window.promptChangeFolderColor = promptChangeFolderColor;
window.promptDeleteFolder = promptDeleteFolder;
window.selectQbankFolder = selectQbankFolder;
window.handleDropZoneOver = handleDropZoneOver;
window.handleDropZoneLeave = handleDropZoneLeave;
window.handleDropZoneDrop = handleDropZoneDrop;
window.assignSelectedQuestionsToMatrix = assignSelectedQuestionsToMatrix;
window.unassignQbankQuestion = unassignQbankQuestion;
window.pruneStaleSelectedQuestionIds = pruneStaleSelectedQuestionIds;
window.updateQbankDeleteSelectedButtonUI = updateQbankDeleteSelectedButtonUI;
window.toggleQbankDeleteMultiMenu = toggleQbankDeleteMultiMenu;
window.closeQbankDeleteMultiMenu = closeQbankDeleteMultiMenu;
window.executeQbankMultiDelete = executeQbankMultiDelete;
window.deleteSelectedQbankQuestions = deleteSelectedQbankQuestions;
window.deleteQbankQuestion = deleteQbankQuestion;
window.promptMoveQuestion = promptMoveQuestion;
window.executeMoveQbankQuestion = executeMoveQbankQuestion;
window.getFilteredAndSortedQuestions = getFilteredAndSortedQuestions;
window.updateQbankMatrixStats = updateQbankMatrixStats;
window.filterByGlobalPart = filterByGlobalPart;
window.filterByGlobalCell = filterByGlobalCell;
window.renderQbankQuestions = renderQbankQuestions;
window.handleQuestionDragStart = handleQuestionDragStart;
window.handleQuestionDragEnd = handleQuestionDragEnd;
window.toggleSelectQuestion = toggleSelectQuestion;
window.clearSelectedQuestions = clearSelectedQuestions;
window.triggerQBankPaste = triggerQBankPaste;
window.uploadImageToHostOrDrive = uploadImageToHostOrDrive;
window.handleQBankImgSelect = handleQBankImgSelect;
window.deleteQBankImg = deleteQBankImg;
