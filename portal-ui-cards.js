// =========================================================
// FILE: portal-ui-cards.js
// QUẢN LÝ THẺ BÀI THI, TÀI LIỆU, CÔNG TẮC GẠT, BIỂU ĐIỂM & POPOVER AVATAR
// ĐÃ BỔ SUNG: NÚT "🏦 Chuyển ngân hàng đề" TRONG CHẾ ĐỘ ADMIN CHO MỖI ĐỀ THI
// =========================================================

(function injectTransferQbankButtonStyles() {
    const styleId = "transfer-qbank-btn-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .btn-transfer-qbank-admin {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #ffffff;
            border: 1px solid #fbbf24;
            border-radius: 10px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 3px 8px rgba(217, 119, 6, 0.28);
            transition: all 0.15s ease;
            user-select: none;
            font-family: inherit;
            white-space: nowrap;
            line-height: 1.2;
        }
        .btn-transfer-qbank-admin:hover:not(:disabled) {
            filter: brightness(1.08);
            transform: translateY(-1px);
            box-shadow: 0 5px 12px rgba(217, 119, 6, 0.38);
        }
        .btn-transfer-qbank-admin:active:not(:disabled) {
            transform: translateY(1px) scale(0.97);
        }
        .btn-transfer-qbank-admin:disabled {
            opacity: 0.72;
            cursor: wait;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            if (document.head && !document.getElementById(styleId)) {
                document.head.appendChild(style);
            }
        });
    }
})();

function createItemCardElement(item, categoryId) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildCardHtmlString(item, categoryId);
    return wrapper.firstElementChild;
}

function getItemDisplayDate(item) {
    if (!item) return "---";
    let rawDate = item.date || item.articleDate || "";
    if (rawDate && String(rawDate).trim() !== "" && String(rawDate).trim() !== "---") return String(rawDate).trim();
    if (item.articleTime && String(item.articleTime).trim() !== "") {
        let cleanTime = String(item.articleTime).trim();
        let m = cleanTime.match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:\s*-\s*\d{1,2}:\d{2})?)/);
        if (m) return m[1];
        return cleanTime;
    }
    if (item.timestamp && !isNaN(Number(item.timestamp))) {
        let d = new Date(Number(item.timestamp));
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (item.categoryId === "nhac-nho" || item.isDoc) {
        let d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return "---";
}

function testExamAsAdmin(quizId, categoryId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const targetCat = categoryId || "them-11";
    safeLocal.removeItem("last_submission_cleared");
    safeLocal.removeItem("saved_student_sbd");
    safeLocal.removeItem("saved_student_name");
    safeLocal.removeItem("saved_student_class");
    safeLocal.setItem("current_exam_student", JSON.stringify({ sbd: "Trying", name: "Obahoan29", className: "42", categoryId: targetCat }));
    safeLocal.setItem(`exam_allow_free_${quizId}`, "true");
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("exam_autosave_active_session_") && key.includes(quizId)) { safeLocal.removeItem(key); }
        }
    } catch(e) {}
    window.open(`./thi.html?id=${quizId}&cat=${encodeURIComponent(targetCat)}&sbd=Trying&name=Obahoan29&class=42&autostart=1&admin=1`, "_blank");
}

function buildCardHtmlString(item, categoryId) {
    const isReminder = (categoryId === "nhac-nho");
    const isDoc = isReminder || item.isDoc;
    const itemId = item.id || item.firebaseId || `item_${Date.now()}`;
    const quizId = (typeof extractQuizIdFromItem === 'function') ? (extractQuizIdFromItem(item) || itemId) : itemId;
    const badge = item.badgeText || (item.isHot ? "HOT" : "NONE");
    const avatar = (typeof toDirectGoogleDriveImageUrl === 'function') ? (toDirectGoogleDriveImageUrl(item.avatar) || PRESET_20_AVATARS[0]) : (item.avatar || PRESET_20_AVATARS[0]);
    const encodedData = encodeURIComponent(JSON.stringify(item));
    const isAllowFree = (item.allowFree !== false);
    const showOnlineCount = (item.showOnlineCount !== false);
    const allowExportExam = (item.allowExportExam === true);
    
    const displayDate = getItemDisplayDate(item);
    const avatarSize = parseInt(item.avatarSize, 10) || 48;

    const safeQuizIdArg = String(quizId || "").replace(/'/g, "\\'");
    const safeCategoryIdArg = String(categoryId || "").replace(/'/g, "\\'");
    const safeItemIdArg = String(itemId || "").replace(/'/g, "\\'");

    let badgeClass = "badge-empty";
    if (badge === "HOT") badgeClass = "b-hot";
    else if (badge === "NEW") badgeClass = "b-new";
    else if (badge === "MỚI") badgeClass = "b-moi";
    else if (badge === "LÀM NGAY") badgeClass = "b-lamngay";
    else if (badge === "CHÚ Ý" || badge === "WARNING") badgeClass = "b-warning";
    else if (badge === "BẮT ĐẦU") badgeClass = "b-start";

    let timeBoxHtml = "";
    if (!isDoc && (categoryId.includes("them") || categoryId.includes("lop") || categoryId.includes("hsg"))) {
        timeBoxHtml = `
            <div class="st-modal-time-box" id="time-box-${itemId}" style="margin: 6px 0 0 0; padding: 6px 10px; font-size: 11.5px; text-align: left;">
                ${buildTimeBoxHtml(item.timeLimitMinutes, item.examStartTimeStr, item.examEndTimeStr, item.date || displayDate)}
            </div>
        `;
    }

    let viewTestBtnHtml = "";
    if (!isDoc && isAdminLoggedIn) {
        viewTestBtnHtml = `
            <button type="button" class="btn-test-exam-admin" onclick="testExamAsAdmin('${safeQuizIdArg}', '${safeCategoryIdArg}', event)" title="Test thử đề thi & paste/upload ảnh trực tiếp">
                🚀 View đề & Đổi ảnh
            </button>
        `;
    }

    let transferQbankBtnHtml = "";
    if (!isDoc && isAdminLoggedIn) {
        transferQbankBtnHtml = `
            <button type="button" class="btn-transfer-qbank-admin" onclick="transferClassExamToQBank('${safeQuizIdArg}', '${safeCategoryIdArg}', '${safeItemIdArg}', event)" title="Chuyển toàn bộ đề thi (câu hỏi, đáp án, lời giải, hình vẽ) sang cột giữa của Ngân hàng đề">
                🏦 Chuyển ngân hàng đề
            </button>
        `;
    }

    let reviewBtnHtml = "";
    if (!isDoc && item.allowReviewOriginal) {
        reviewBtnHtml = `
            <a href="thi.html?id=${quizId}&review=1" target="_blank" onclick="event.stopPropagation()" class="btn-review-origin-tag">
                📖 Xem Đ.Á Gốc
            </a>
        `;
    }

    let exportExamBtnHtml = "";
    if (!isDoc && (allowExportExam || isAdminLoggedIn)) {
        exportExamBtnHtml = `
            <div class="exam-export-dropdown-wrapper" onclick="event.stopPropagation()">
                <button type="button" class="btn-export-exam-trigger" onclick="toggleExamExportMenu('${safeItemIdArg}', event)" title="Xuất đề thi ra bản in PDF hoặc file Word chuẩn đẹp">
                    📥 Xuất đề ▾
                </button>
                <div class="exam-export-menu" id="export-menu-${itemId}">
                    <div class="export-menu-header">📄 TÙY CHỌN XUẤT ĐỀ THI:</div>
                    <div class="export-menu-item" onclick="handleExportExamAction('${safeCategoryIdArg}', '${safeItemIdArg}', 'pdf', false, event)">
                        <span class="export-item-icon">📄</span>
                        <div class="export-item-text">
                            <b>Xuất PDF - Đề thi</b>
                            <span>In ấn / Phát đề kiểm tra A4 (không đáp án)</span>
                        </div>
                    </div>
                    <div class="export-menu-item" onclick="handleExportExamAction('${safeCategoryIdArg}', '${safeItemIdArg}', 'pdf', true, event)">
                        <span class="export-item-icon">📑</span>
                        <div class="export-item-text">
                            <b>Xuất PDF - Kèm Đáp án & Lời giải</b>
                            <span>Đề thi + Bảng đáp án + Lời giải chi tiết</span>
                        </div>
                    </div>
                    <div class="export-menu-divider"></div>
                    <div class="export-menu-item" onclick="handleExportExamAction('${safeCategoryIdArg}', '${safeItemIdArg}', 'word', false, event)">
                        <span class="export-item-icon">📝</span>
                        <div class="export-item-text">
                            <b>Xuất Word (.doc) - Đề thi</b>
                            <span>Mở trực tiếp trên MS Word để chỉnh sửa</span>
                        </div>
                    </div>
                    <div class="export-menu-item" onclick="handleExportExamAction('${safeCategoryIdArg}', '${safeItemIdArg}', 'word', true, event)">
                        <span class="export-item-icon">📘</span>
                        <div class="export-item-text">
                            <b>Xuất Word (.doc) - Kèm Lời giải</b>
                            <span>Soạn giáo án, đề thi hoàn chỉnh kèm đáp án</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    let tuLuanBtnHtml = `
        <button type="button" class="btn-tuluan-modal-trigger" onclick="openTuLuanModal('${safeCategoryIdArg}', '${safeItemIdArg}', event)" title="Mở bảng nộp bài tự luận 45 học sinh lên Google Drive">
            📝 Nộp tự luận Drive
        </button>
    `;

    let bottomActionButtonsHtml = `
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
            ${tuLuanBtnHtml}
            ${viewTestBtnHtml}
            ${exportExamBtnHtml}
            ${transferQbankBtnHtml}
            ${reviewBtnHtml}
        </div>
    `;

    let avatarPopoverHtml = "";
    if (isAdminLoggedIn) {
        avatarPopoverHtml = `
            <div class="avatar-selection-popover" id="avatar-popover-${itemId}" onclick="event.stopPropagation()">
                <div class="avatar-popover-header">
                    <span>🖼️ Cấu hình Avatar & Kích thước</span>
                    <button type="button" class="btn-close-popover-x" onclick="closeAvatarPopover('${safeItemIdArg}', event)">✕</button>
                </div>
                
                <div class="avatar-size-control-box">
                    <div class="size-control-label">📏 Kích cỡ hiển thị avatar:</div>
                    <div class="avatar-size-pills">
                        <button type="button" class="size-pill-btn ${avatarSize === 38 ? 'active' : ''}" onclick="changeAvatarSize('${safeCategoryIdArg}', '${safeItemIdArg}', 38, event)">🟢 Nhỏ (38px)</button>
                        <button type="button" class="size-pill-btn ${avatarSize === 48 ? 'active' : ''}" onclick="changeAvatarSize('${safeCategoryIdArg}', '${safeItemIdArg}', 48, event)">🔵 Vừa (48px)</button>
                        <button type="button" class="size-pill-btn ${avatarSize === 62 ? 'active' : ''}" onclick="changeAvatarSize('${safeCategoryIdArg}', '${safeItemIdArg}', 62, event)">🟠 To (62px)</button>
                        <button type="button" class="size-pill-btn ${avatarSize === 78 ? 'active' : ''}" onclick="changeAvatarSize('${safeCategoryIdArg}', '${safeItemIdArg}', 78, event)">🔴 Rất to (78px)</button>
                    </div>
                </div>

                <div class="avatar-palette-title">🎨 Chọn trong 20 Avatar mẫu:</div>
                <div class="avatar-grid-20">
                    ${PRESET_20_AVATARS.map((url, i) => `
                        <div class="avatar-thumb-wrapper ${avatar === url ? 'current-selected' : ''}" onclick="selectItemAvatar('${safeCategoryIdArg}', '${safeItemIdArg}', '${url}', event)">
                            <img src="${url}" class="avatar-mini-thumb" title="Avatar ${i+1}">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    let liveCountBadgeHtml = "";
    if (!isDoc && isAdminLoggedIn) {
        liveCountBadgeHtml = `
            <span class="admin-live-count-badge" id="live-count-${itemId}" onclick="fetchLiveCountForCard('${safeQuizIdArg}', '${safeItemIdArg}', event)" title="Bấm để đếm số học sinh đang làm bài thi này">
                👥 Đếm
            </span>
        `;
    }

    if (isAdminLoggedIn) {
        return `
        <div class="exam-card admin-card-mode" id="card-${itemId}">
            <div class="admin-card-top-row">
                <div class="left-admin-actions-col">
                    ${!isDoc ? `
                        <button type="button" class="btn-view-results-left" onclick="openExamResultModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${safeCategoryIdArg}', event)" title="Xem bảng điểm và nhật ký thi">
                            📊 Kết quả
                        </button>

                        <label class="free-student-toggle-wrap" title="Bật/Tắt chế độ thí sinh tự do" onclick="event.stopPropagation()">
                            <span class="free-toggle-lbl">Tự do:</span>
                            <span class="mini-switch">
                                <input type="checkbox" id="free-toggle-${itemId}" ${isAllowFree ? "checked" : ""} onchange="handleAllowFreeToggleChange('${safeCategoryIdArg}', '${safeItemIdArg}', this.checked, event)">
                                <span class="slider-toggle"></span>
                            </span>
                            <span class="free-toggle-status ${isAllowFree ? 'st-on' : 'st-off'}" id="free-status-txt-${itemId}">
                                ${isAllowFree ? 'BẬT' : 'TẮT'}
                            </span>
                        </label>

                        <label class="free-student-toggle-wrap" title="Bật/Tắt hiển thị sĩ số phòng thi cho học sinh" onclick="event.stopPropagation()">
                            <span class="free-toggle-lbl" style="color:#0284c7;">Sĩ số:</span>
                            <span class="mini-switch">
                                <input type="checkbox" id="online-toggle-${itemId}" ${showOnlineCount ? "checked" : ""} onchange="handleShowOnlineCountToggleChange('${safeCategoryIdArg}', '${safeItemIdArg}', '${safeQuizIdArg}', this.checked, event)">
                                <span class="slider-toggle" style="${showOnlineCount ? 'background-color:#0284c7;' : ''}"></span>
                            </span>
                            <span class="free-toggle-status ${showOnlineCount ? 'st-on' : 'st-off'}" id="online-status-txt-${itemId}" style="${showOnlineCount ? 'color:#0284c7;' : ''}">
                                ${showOnlineCount ? 'HIỆN' : 'ẨN'}
                            </span>
                        </label>
                        
                        <label class="free-student-toggle-wrap" title="Bật/Tắt chế độ cho học sinh xem đáp án gốc không cần thi" onclick="event.stopPropagation()">
                            <span class="free-toggle-lbl" style="color:#059669;">Xem Giải:</span>
                            <span class="mini-switch">
                                <input type="checkbox" id="review-toggle-${itemId}" ${item.allowReviewOriginal ? "checked" : ""} onchange="handleAllowReviewOriginalToggleChange('${safeCategoryIdArg}', '${safeItemIdArg}', this.checked, event)">
                                <span class="slider-toggle" style="${item.allowReviewOriginal ? 'background-color:#10b981;' : ''}"></span>
                            </span>
                            <span class="free-toggle-status ${item.allowReviewOriginal ? 'st-on' : 'st-off'}" id="review-status-txt-${itemId}">
                                ${item.allowReviewOriginal ? 'MỞ' : 'TẮT'}
                            </span>
                        </label>

                        <label class="free-student-toggle-wrap" title="Bật/Tắt hiển thị nút Xuất đề thi (PDF/Word) cho học sinh" onclick="event.stopPropagation()">
                            <span class="free-toggle-lbl" style="color:#047857;">Hiện xuất đề:</span>
                            <span class="mini-switch">
                                <input type="checkbox" id="export-toggle-${itemId}" ${allowExportExam ? "checked" : ""} onchange="handleAllowExportExamToggleChange('${safeCategoryIdArg}', '${safeItemIdArg}', '${safeQuizIdArg}', this.checked, event)">
                                <span class="slider-toggle" style="${allowExportExam ? 'background-color:#10b981;' : ''}"></span>
                            </span>
                            <span class="free-toggle-status ${allowExportExam ? 'st-on' : 'st-off'}" id="export-status-txt-${itemId}" style="${allowExportExam ? 'color:#16a34a;' : ''}">
                                ${allowExportExam ? 'HIỆN' : 'ẨN'}
                            </span>
                        </label>

                        <div class="left-sub-btns-row">
                            <button type="button" class="btn-time-sub-action btn-time-sub-minutes" onclick="openEditMinutesModal('${safeQuizIdArg}', '${safeItemIdArg}', event)" title="Đổi số phút làm bài">
                                ⏱ Đổi phút
                            </button>
                            <button type="button" class="btn-time-sub-action btn-time-sub-schedule" onclick="openEditScheduleModal('${safeQuizIdArg}', '${safeItemIdArg}', event)" title="Gia hạn thời gian đóng/mở đề">
                                📅 Gia hạn
                            </button>
                            <button type="button" class="btn-time-sub-action btn-time-sub-score" onclick="openGradingScaleModal('${safeQuizIdArg}', '${safeCategoryIdArg}', event)" title="Cấu hình thang điểm và phân bổ điểm cho đề thi">
                                🎯 Biểu điểm
                            </button>
                            
                            <div class="badge-wrapper" onclick="toggleResultModeMenu('${safeItemIdArg}', event)" style="margin-left: 2px;">
                                <button type="button" class="btn-time-sub-action" style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe; padding-right:12px;" title="Cấu hình hiển thị kết quả sau khi nộp bài">
                                    👁️ Công bố KQ ▾
                                </button>
                                <div class="badge-dropdown-menu" id="result-mode-menu-${itemId}" style="width: 265px; white-space: normal; padding: 6px;">
                                    <div class="b-item-btn ${item.resultMode === 'hide_all' ? 'b-hot' : 'b-none-btn'}" onclick="setResultMode('${safeCategoryIdArg}', '${safeItemIdArg}', '${safeQuizIdArg}', 'hide_all', event)" style="text-align:left; line-height:1.3; margin-bottom:5px;">
                                        <b>🚫 Tắt toàn bộ</b><br><span style="font-size:10.5px; font-weight:600;">Giấu điểm & đáp án (Chỉ báo nộp thành công)</span>
                                    </div>
                                    <div class="b-item-btn ${item.resultMode === 'score_only' ? 'b-moi' : 'b-none-btn'}" onclick="setResultMode('${safeCategoryIdArg}', '${safeItemIdArg}', '${safeQuizIdArg}', 'score_only', event)" style="text-align:left; line-height:1.3; margin-bottom:5px;">
                                        <b>🔢 Chỉ hiện điểm</b><br><span style="font-size:10.5px; font-weight:600;">Báo điểm số, giấu chi tiết đúng/sai từng câu</span>
                                    </div>
                                    <div class="b-item-btn ${(!item.resultMode || item.resultMode === 'show_all') ? 'b-start' : 'b-none-btn'}" onclick="setResultMode('${safeCategoryIdArg}', '${safeItemIdArg}', '${safeQuizIdArg}', 'show_all', event)" style="text-align:left; line-height:1.3;">
                                        <b>✅ Hiện tất cả (Mặc định)</b><br><span style="font-size:10.5px; font-weight:600;">Hiện điểm và giải thích chi tiết từng câu</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : (isReminder ? `
                        <button type="button" class="btn-edit-inline-title" onclick="openDantriArticleModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${safeCategoryIdArg}', event, true)" title="Mở trang soạn thảo bài viết phong cách Dân trí">
                            📰 Soạn thảo bài viết
                        </button>
                    ` : '')}
                </div>

                <div class="admin-link-tools">
                    ${!isDoc ? `
                        <span class="shuffle-label">Đảo:</span>
                        <label class="switch-toggle" title="Bật/Tắt đảo thứ tự câu hỏi và phương án">
                            <input type="checkbox" ${item.isShuffled !== false ? "checked" : ""} onchange="toggleShuffle('${safeCategoryIdArg}', '${safeItemIdArg}', this.checked, event)">
                            <span class="slider-toggle"></span>
                        </label>
                    ` : ''}
                    <button type="button" class="tool-btn tool-btn-up" onclick="moveItemOrder('${safeCategoryIdArg}', '${safeItemIdArg}', 'up', event)" title="Lên trên">▲</button>
                    <button type="button" class="tool-btn tool-btn-down" onclick="moveItemOrder('${safeCategoryIdArg}', '${safeItemIdArg}', 'down', event)" title="Xuống dưới">▼</button>
                    <button type="button" class="tool-btn tool-btn-copy" onclick="openCopyModal('${safeCategoryIdArg}', '${safeItemIdArg}', '${encodedData}', event)" title="Nhân bản sang lớp khác">📋</button>
                    <button type="button" class="tool-btn tool-btn-move" onclick="openMoveModal('${safeCategoryIdArg}', '${safeItemIdArg}', '${encodedData}', event)" title="Chuyển lớp">🔄</button>
                    <button type="button" class="tool-btn tool-btn-edit" onclick="${isReminder ? `openDantriArticleModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${safeCategoryIdArg}', event, true)` : `renameItem('${safeCategoryIdArg}', '${safeItemIdArg}', ${isDoc}, '${(item.title || "").replace(/'/g, "\\'")}', event)`}" title="Sửa bài">✏️</button>
                    <button type="button" class="tool-btn tool-btn-delete" onclick="deleteItem('${safeCategoryIdArg}', '${safeItemIdArg}', event)" title="Xóa vĩnh viễn">🗑️</button>
                </div>
            </div>

            <div class="admin-card-bottom-row" onclick="handleCardClick('${safeCategoryIdArg}', '${safeItemIdArg}', ${isDoc}, '${encodeURIComponent(item.url || '')}', '${encodedData}', event)">
                <div class="exam-thumb-box" onclick="openItemAvatarPicker('${safeItemIdArg}', event)" title="Ấn để chọn 20 Avatar mẫu, đổi kích thước từ nhỏ đến rất to" style="width: ${avatarSize}px; height: ${avatarSize}px; cursor: pointer;">
                    <img src="${avatar}" class="exam-thumb" alt="icon">
                    ${avatarPopoverHtml}
                </div>
                <div class="exam-info">
                    <div class="exam-header-row">
                        <div class="badge-wrapper" onclick="toggleBadgeMenu('${safeItemIdArg}', event)">
                            <span class="badge-item ${badgeClass}">${badge !== "NONE" ? badge : "+ Badge"}</span>
                            <div class="badge-dropdown-menu" id="badge-menu-${itemId}">
                                <div class="b-item-btn b-hot" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'HOT', event)">HOT</div>
                                <div class="b-item-btn b-new" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'NEW', event)">NEW</div>
                                <div class="b-item-btn b-moi" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'MỚI', event)">MỚI</div>
                                <div class="b-item-btn b-lamngay" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'LÀM NGAY', event)">LÀM NGAY</div>
                                <div class="b-item-btn b-warning" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'CHÚ Ý', event)">CHÚ Ý</div>
                                <div class="b-item-btn b-start" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'BẮT ĐẦU', event)">BẮT ĐẦU</div>
                                <div class="b-item-btn b-none-btn" onclick="selectBadgeOption('${safeCategoryIdArg}', '${safeItemIdArg}', 'NONE', event)">✕ Ẩn Badge</div>
                            </div>
                        </div>
                        <span class="exam-title-text">${item.title}</span>
                        ${liveCountBadgeHtml}
                        ${isReminder ? `
                            <button type="button" class="btn-edit-inline-title" onclick="openDantriArticleModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${safeCategoryIdArg}', event, true)" title="Chỉnh sửa bài viết">
                                ✏️ Sửa
                            </button>
                        ` : `
                            <button type="button" class="btn-edit-inline-title" onclick="renameItem('${safeCategoryIdArg}', '${safeItemIdArg}', ${isDoc}, '${(item.title || "").replace(/'/g, "\\'")}', event)" title="Sửa tên tiêu đề">
                                ✏️ Sửa
                            </button>
                        `}
                    </div>
                    <div class="exam-date">📅 ${displayDate}</div>
                    ${timeBoxHtml}
                    ${bottomActionButtonsHtml}
                </div>
                <div class="arrow">›</div>
            </div>
        </div>`;
    }

    return `
    <div class="exam-card" id="card-${itemId}" onclick="handleCardClick('${safeCategoryIdArg}', '${safeItemIdArg}', ${isDoc}, '${encodeURIComponent(item.url || '')}', '${encodedData}', event)">
        <div class="exam-thumb-box" style="width: ${avatarSize}px; height: ${avatarSize}px;">
            <img src="${avatar}" class="exam-thumb" alt="icon">
        </div>
        <div class="exam-info">
            <div class="exam-header-row">
                ${badge !== "NONE" ? `<span class="badge-item ${badgeClass}">${badge}</span>` : ''}
                <span class="exam-title-text">${item.title}</span>
            </div>
            <div class="exam-date">📅 ${displayDate}</div>
            ${timeBoxHtml}
            ${bottomActionButtonsHtml}
        </div>
        <div class="arrow">›</div>
    </div>`;
}

async function fetchLiveCountForCard(quizId, itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const badge = document.getElementById(`live-count-${itemId}`);
    if (!badge) return;
    badge.innerText = "⏳...";
    badge.style.pointerEvents = "none";

    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!client) throw new Error("Chưa kết nối");

        const activeThreshold = Date.now() - (3 * 60 * 1000);
        let { count, error } = await client
            .from('active_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('quiz_id', quizId)
            .gte('last_ping', activeThreshold);

        if (!error && count !== null) {
            badge.innerHTML = `👥 <b>${count}</b> đang thi`;
            badge.classList.add('updated');
            setTimeout(() => badge.classList.remove('updated'), 2000);
        } else {
            badge.innerText = "👥 Lỗi";
        }
    } catch(e) {
        badge.innerText = "👥 Lỗi";
    } finally {
        badge.style.pointerEvents = "auto";
    }
}

function handleCardClick(categoryId, itemId, isDoc, rawUrl, stringifiedData, event) {
    if (event) {
        if (event.target.closest('.exam-thumb-box') ||
            event.target.closest('.avatar-selection-popover') ||
            event.target.closest('.free-student-toggle-wrap') || 
            event.target.closest('.mini-switch') || 
            event.target.closest('.admin-link-tools') || 
            event.target.closest('.badge-wrapper') || 
            event.target.closest('.btn-view-results-left') || 
            event.target.closest('.left-sub-btns-row') ||
            event.target.closest('.btn-edit-inline-title') ||
            event.target.closest('.btn-test-exam-admin') ||
            event.target.closest('.btn-transfer-qbank-admin') ||
            event.target.closest('.exam-export-dropdown-wrapper') ||
            event.target.closest('.btn-tuluan-modal-trigger') ||
            event.target.closest('.admin-live-count-badge')) {
            return;
        }
    }

    const item = JSON.parse(decodeURIComponent(stringifiedData));

    if (categoryId === "nhac-nho") {
        openDantriArticleModal(item, categoryId, event, false);
        return;
    }

    const url = decodeURIComponent(rawUrl || item.url || "");
    if (isDoc || categoryId === "tu-luan-padlet" || categoryId === "kho-tai-lieu" || !url.includes("thi.html")) {
        if (url && url !== "#") window.open(url, "_blank");
        return;
    }

    openStudentLoginModal(item, categoryId, event);
}

async function handleAllowExportExamToggleChange(categoryId, itemId, quizId, isChecked, event) {
    if (event) event.stopPropagation();

    const txt = document.getElementById(`export-status-txt-${itemId}`);
    if (txt) {
        txt.innerText = isChecked ? 'HIỆN' : 'ẨN';
        txt.className = `free-toggle-status ${isChecked ? 'st-on' : 'st-off'}`;
        txt.style.color = isChecked ? '#16a34a' : '';
    }

    const slider = document.querySelector(`#export-toggle-${itemId} ~ .slider-toggle`);
    if (slider) slider.style.backgroundColor = isChecked ? '#10b981' : '#cbd5e1';

    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        await client.from('custom_links').update({ allow_export_exam: isChecked }).match({ id: itemId, category_id: categoryId });
        const effectiveQuizId = quizId || (itemId.startsWith('quiz_') ? itemId : null);
        if (effectiveQuizId) {
            await client.from('quizzes').update({ allow_export_exam: isChecked }).match({ id: effectiveQuizId });
        }
    } catch(e) {
        console.error("Lỗi cập nhật trạng thái xuất đề:", e);
    }
}

async function handleShowOnlineCountToggleChange(categoryId, itemId, quizId, isChecked, event) {
    if (event) event.stopPropagation();
    
    const txt = document.getElementById(`online-status-txt-${itemId}`);
    if (txt) {
        txt.innerText = isChecked ? 'HIỆN' : 'ẨN';
        txt.className = `free-toggle-status ${isChecked ? 'st-on' : 'st-off'}`;
        txt.style.color = isChecked ? '#0284c7' : '';
    }
    
    const slider = document.querySelector(`#online-toggle-${itemId} ~ .slider-toggle`);
    if (slider) slider.style.backgroundColor = isChecked ? '#0284c7' : '#cbd5e1';

    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        await client.from('custom_links').update({ show_online_count: isChecked }).match({ id: itemId, category_id: categoryId });
        if (quizId) {
            await client.from('quizzes').update({ show_online_count: isChecked }).match({ id: quizId });
        }
    } catch(e) { console.error(e); }
}

function toggleBadgeMenu(itemId, event) {
    if (!isAdminLoggedIn) return;
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`badge-menu-${itemId}`);
    if (!menu) return;
    document.querySelectorAll(".badge-dropdown-menu.show").forEach(m => { if (m !== menu) m.classList.remove("show"); });
    menu.classList.toggle("show");
}

async function selectBadgeOption(categoryId, itemId, badgeType, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`badge-menu-${itemId}`);
    if (menu) menu.classList.remove("show");
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        await client.from('custom_links').update({ badge_text: badgeType }).match({ id: itemId, category_id: categoryId });
        window.location.reload();
    } catch (e) { alert("Lỗi đổi badge!"); }
}

function toggleResultModeMenu(itemId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`result-mode-menu-${itemId}`); if (!menu) return;
    document.querySelectorAll(".badge-dropdown-menu.show").forEach(m => { if (m !== menu) m.classList.remove("show"); });
    menu.classList.toggle("show");
}

async function setResultMode(categoryId, itemId, quizId, mode, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById(`result-mode-menu-${itemId}`); if (menu) menu.classList.remove("show");
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        await client.from('custom_links').update({ result_mode: mode }).match({ id: itemId, category_id: categoryId });
        if (quizId && quizId !== itemId) {
            await client.from('quizzes').update({ result_mode: mode }).match({ id: quizId });
        } else if (itemId.startsWith('quiz_')) {
            await client.from('quizzes').update({ result_mode: mode }).match({ id: itemId });
        }
        alert("✅ Đã cập nhật chế độ hiển thị kết quả thành công!"); 
        window.location.reload();
    } catch(e) { alert("❌ Lỗi cập nhật: " + e.message); }
}

async function handleAllowReviewOriginalToggleChange(categoryId, itemId, isChecked, event) {
    if (event) event.stopPropagation();
    const txt = document.getElementById(`review-status-txt-${itemId}`);
    if (txt) { txt.innerText = isChecked ? 'MỞ' : 'TẮT'; txt.className = `free-toggle-status ${isChecked ? 'st-on' : 'st-off'}`; }
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        await client.from('custom_links').update({ allow_review_original: isChecked }).match({ id: itemId, category_id: categoryId });
        const quizId = itemId.startsWith('quiz_') ? itemId : null;
        if (quizId) {
            await client.from('quizzes').update({ allow_review_original: isChecked }).match({ id: quizId });
        }
    } catch(e) { console.error(e); }
}

document.addEventListener("click", function(event) {
    const adminWrapper = event.target.closest(".admin-controls-wrapper");
    if (!adminWrapper) {
        const authContainer = document.getElementById("auth-container");
        if (authContainer && authContainer.classList.contains("show")) { authContainer.classList.remove("show"); }
        if (typeof closeAdminPanel === "function") { closeAdminPanel(); }
    }
    const badgeWrapper = event.target.closest(".badge-wrapper");
    if (!badgeWrapper) { document.querySelectorAll(".badge-dropdown-menu.show").forEach(m => m.classList.remove("show")); }
    const avatarBox = event.target.closest(".exam-thumb-box");
    if (!avatarBox) {
        document.querySelectorAll(".avatar-selection-popover.show").forEach(p => p.classList.remove("show"));
        document.querySelectorAll(".exam-card.has-active-popover").forEach(c => c.classList.remove("has-active-popover"));
    }
    const exportWrapper = event.target.closest(".exam-export-dropdown-wrapper");
    if (!exportWrapper) {
        document.querySelectorAll(".exam-export-menu.show").forEach(m => m.classList.remove("show"));
        document.querySelectorAll(".exam-card.has-active-export").forEach(c => c.classList.remove("has-active-export"));
    }
    const visitModal = document.getElementById("visit-stats-modal");
    if (visitModal && visitModal.style.display === "flex") { if (event.target === visitModal) { closeVisitStatsModal(); } }
    const articleModal = document.getElementById("dantri-article-modal");
    if (articleModal && articleModal.style.display === "flex") { if (event.target.id === "dantri-article-modal") { closeArticleModal(); } }
});

window.fetchLiveCountForCard = fetchLiveCountForCard;
