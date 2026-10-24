// =========================================================
// FILE: portal-ui-core.js (BẢN SUPABASE TỐI ƯU HIỂN THỊ TỨC THÌ 0s)
// =========================================================

let activeDayThemCatId = null; /* SỬA TẠI ĐÂY: Chuyển "them-11" thành null để mặc định thu gọn */
let activeChinhKhoaRow1CatId = null;
let activeChinhKhoaRow2CatId = null;
let activeDantriCatId = null;

let currentActiveArticleItem = null;
let currentActiveArticleCatId = "nhac-nho";
let currentTargetAvatarItemId = null;
let currentTargetAvatarCatId = "nhac-nho";

const categoryExpandedState = {};

const DEFAULT_PADLET_LINKS = [
    {
        id: "tuluan_11a",
        firebaseId: "tuluan_11a",
        categoryId: "tu-luan-padlet",
        title: "11A nộp bài tự luận Google Drive",
        date: "16/09/2026 - 10:00",
        timestamp: 1773630004,
        url: "#",
        badgeText: "HOT",
        isDoc: true,
        avatar: "https://cdn-icons-png.flaticon.com/512/3074/3074058.png"
    },
    {
        id: "tuluan_11c",
        firebaseId: "tuluan_11c",
        categoryId: "tu-luan-padlet",
        title: "11C nộp bài tự luận Google Drive",
        date: "16/09/2026 - 10:00",
        timestamp: 1773630003,
        url: "#",
        badgeText: "HOT",
        isDoc: true,
        avatar: "https://cdn-icons-png.flaticon.com/512/3074/3074058.png"
    },
    {
        id: "tuluan_10p",
        firebaseId: "tuluan_10p",
        categoryId: "tu-luan-padlet",
        title: "10P nộp bài tự luận Google Drive",
        date: "16/09/2026 - 10:00",
        timestamp: 1773630002,
        url: "#",
        badgeText: "HOT",
        isDoc: true,
        avatar: "https://cdn-icons-png.flaticon.com/512/3074/3074058.png"
    },
    {
        id: "tuluan_11e",
        firebaseId: "tuluan_11e",
        categoryId: "tu-luan-padlet",
        title: "11E nộp bài tự luận Google Drive",
        date: "16/09/2026 - 10:00",
        timestamp: 1773630001,
        url: "#",
        badgeText: "HOT",
        isDoc: true,
        avatar: "https://cdn-icons-png.flaticon.com/512/3074/3074058.png"
    }
];

document.addEventListener("DOMContentLoaded", async function() {
    initBannerAndAvatars();
    if (typeof initTableSettings === "function") initTableSettings();
    if (typeof initAvatarGrid === "function") initAvatarGrid();
    if (typeof checkAdminSessionValidity === "function") checkAdminSessionValidity();

    const padletCat = CHINH_KHOA_CATEGORIES.find(c => c.id === "tu-luan-padlet");
    if (padletCat) padletCat.links = [...DEFAULT_PADLET_LINKS];

    // 1. NẠP DỮ LIỆU TỪ CACHE (BỘ NHỚ ĐỆM) ĐỂ HIỂN THỊ NGAY LẬP TỨC 0s
    loadDataFromCache();
    refreshAllViews();

    // 2. NGẦM TẢI DỮ LIỆU MỚI TỪ SUPABASE (KHÔNG LÀM KHỰNG GIAO DIỆN)
    await loadDataFromSupabase();
    
    if (typeof initSiteVisitTracker === "function") initSiteVisitTracker();
});

function initBannerAndAvatars() {
    const topImg = document.getElementById("top-banner-img");
    const avatarImg = document.getElementById("web-avatar-img");
    const botImg = document.getElementById("bottom-banner-img");

    if (topImg) {
        topImg.src = TOP_BANNER_URL || "https://files.catbox.moe/cf5o9u.jpg";
        topImg.onerror = function() { this.src = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200"; };
    }
    if (avatarImg) {
        avatarImg.src = WEB_AVATAR_URL || "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=150";
        avatarImg.onerror = function() { this.src = "https://cdn-icons-png.flaticon.com/512/3135/3135768.png"; };
    }
    if (botImg) {
        botImg.src = BOTTOM_BANNER_URL || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1000";
        botImg.onerror = function() { this.src = "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1000"; };
    }
}

function sortLinksNewestFirst(linksArray) {
    if (!Array.isArray(linksArray)) return [];
    return linksArray.sort((a, b) => {
        let tA = a.timestamp || (typeof parseDateString === 'function' ? parseDateString(a.date) : 0) || 0;
        let tB = b.timestamp || (typeof parseDateString === 'function' ? parseDateString(b.date) : 0) || 0;
        if (tB !== tA) return tB - tA;
        return (a.title || "").localeCompare(b.title || "");
    });
}

// HÀM XỬ LÝ PHÂN LOẠI DỮ LIỆU DÙNG CHUNG CHO CACHE VÀ SUPABASE
function processLinksData(links) {
    if (!Array.isArray(links)) return;
    const grouped = {};
    links.forEach(item => {
        const cat = item.category_id || item.categoryId;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
            id: item.id,
            firebaseId: item.id,
            categoryId: cat,
            title: item.title,
            date: item.date,
            url: item.url,
            badgeText: item.badge_text || item.badgeText || "NONE",
            isHot: item.is_hot !== undefined ? item.is_hot : item.isHot,
            isDoc: item.is_doc !== undefined ? item.is_doc : item.isDoc,
            avatar: item.avatar,
            avatarSize: item.avatar_size || item.avatarSize || 48,
            timestamp: item.timestamp,
            isShuffled: item.is_shuffled !== undefined ? item.is_shuffled : item.isShuffled,
            allowFree: item.allow_free !== undefined ? item.allow_free : item.allowFree,
            scoringConfig: item.scoring_config || item.scoringConfig,
            timeLimitMinutes: item.time_limit_minutes || item.timeLimitMinutes,
            examStartTimeStr: item.exam_start_time_str || item.examStartTimeStr,
            examEndTimeStr: item.exam_end_time_str || item.examEndTimeStr,
            resultMode: item.result_mode || item.resultMode,
            allowReviewOriginal: item.allow_review_original !== undefined ? item.allow_review_original : item.allowReviewOriginal,
            showOnlineCount: item.show_online_count !== undefined ? item.show_online_count : item.showOnlineCount,
            allowExportExam: item.allow_export_exam !== undefined ? item.allow_export_exam : item.allowExportExam,
            articleTitle: item.article_title || item.articleTitle || item.title,
            author: item.author || "Thầy Hoan",
            articleTime: item.article_time || item.articleTime || "",
            sapo: item.sapo || "",
            articleImg: item.article_img || item.articleImg || "",
            articleImgCaption: item.article_img_caption || item.articleImgCaption || "",
            articleBody: item.article_body || item.articleBody || ""
        });
    });

    REMINDER_CATEGORY.links = grouped["nhac-nho"] ? sortLinksNewestFirst(grouped["nhac-nho"]) : [];
    KHO_TAI_LIEU_FOLDER.links = grouped["kho-tai-lieu"] ? sortLinksNewestFirst(grouped["kho-tai-lieu"]) : [];

    [...DAY_THEM_CATEGORIES, ...CHINH_KHOA_CATEGORIES].forEach(cat => {
        if (cat.id === "tu-luan-padlet") {
            cat.links = grouped[cat.id] && grouped[cat.id].length > 0 
                ? sortLinksNewestFirst(grouped[cat.id]) 
                : [...DEFAULT_PADLET_LINKS];
        } else {
            cat.links = grouped[cat.id] ? sortLinksNewestFirst(grouped[cat.id]) : [];
        }
    });
}

function loadDataFromCache() {
    try {
        const cachedLinks = safeLocal.getItem("cached_custom_links");
        if (cachedLinks) {
            processLinksData(JSON.parse(cachedLinks));
        }
    } catch (e) {}
}

// NẠP DỮ LIỆU TỪ SUPABASE
async function loadDataFromSupabase() {
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) {
        setTimeout(loadDataFromSupabase, 500);
        return;
    }

    try {
        const { data: links, error: lErr } = await client
            .from('custom_links')
            .select('*');

        if (lErr) {
            console.error("Lỗi đọc dữ liệu custom_links từ Supabase:", lErr.message);
            return;
        }

        if (Array.isArray(links)) {
            // Lưu dữ liệu vào LocalStorage để lần truy cập sau hiển thị ngay lập tức
            try { safeLocal.setItem("cached_custom_links", JSON.stringify(links)); } catch(e) {}
            
            processLinksData(links);
        }

        try {
            const { data: meta } = await client.from('app_key_values').select('value').eq('key', 'site_meta').single();
            if (meta && meta.value && meta.value.reminderTitle) {
                REMINDER_SECTION_TITLE = meta.value.reminderTitle;
            }
        } catch(e) {}

        // Đọc cấu hình chuyển hướng web dự phòng và cập nhật giao diện Admin
        try {
            const { data: redirectData } = await client.from('app_key_values').select('value').eq('key', 'site_redirect_config').single();
            if (redirectData && redirectData.value) {
                SITE_REDIRECT_CONFIG = {
                    enabled: !!redirectData.value.enabled,
                    targetUrl: redirectData.value.targetUrl || DEFAULT_BACKUP_WEB_URL
                };
            }
        } catch(e) {}

        if (typeof updateRedirectUIElements === 'function') {
            updateRedirectUIElements();
        }

        refreshAllViews();
    } catch(e) {
        console.warn("Lỗi nạp dữ liệu Supabase:", e);
    }
}

function refreshAllViews() {
    renderDantriNav();
    renderReminderSection();
    renderDayThemSection();
    renderChinhKhoaSection();
    renderKhoTaiLieuSection();
    renderNewsSection();

    const gear = document.getElementById("gear-btn");
    if (gear) {
        if (isAdminLoggedIn) gear.classList.add("active-gear");
        else gear.classList.remove("active-gear");
    }

    if (typeof updateRedirectUIElements === 'function') {
        updateRedirectUIElements();
    }
}

function renderDantriNav() {
    const bar = document.getElementById("dantri-nav-bar");
    if (!bar) return;
    bar.innerHTML = "";
    DANTRI_NAV_CATEGORIES.forEach(cat => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dantri-nav-btn" + (activeDantriCatId === cat.id ? " active" : "");
        btn.innerHTML = `<span>${cat.title}</span> <span class="caret-icon">▼</span>`;
        btn.onclick = () => toggleDantriCategory(cat.id);
        bar.appendChild(btn);
    });
    renderDantriDropdown();
}

function toggleDantriCategory(catId) {
    activeDantriCatId = (activeDantriCatId === catId) ? null : catId;
    renderDantriNav();
}

function renderDantriDropdown() {
    const panel = document.getElementById("dantri-dropdown-panel");
    const subTitle = document.getElementById("dantri-sub-title");
    const list = document.getElementById("dantri-news-list");
    if (!panel || !list) return;

    if (!activeDantriCatId) { panel.classList.remove("show"); return; }
    const cat = DANTRI_NAV_CATEGORIES.find(c => c.id === activeDantriCatId);
    if (!cat) { panel.classList.remove("show"); return; }

    subTitle.innerHTML = cat.subTitle || "📌 Tin tức nổi bật";
    list.innerHTML = "";

    (cat.news || []).forEach(n => {
        const item = document.createElement("a");
        item.href = n.url || "#";
        item.target = "_blank";
        item.className = "news-item";
        item.innerHTML = `
            <div class="news-content">
                <div class="news-title"><span style="color:#059669; font-weight:800;">[${n.tag || 'TIN'}]</span> ${n.title}</div>
                <div class="news-date">⏱ ${n.date || 'Hôm nay'}</div>
            </div>
            <div class="arrow">›</div>
        `;
        list.appendChild(item);
    });
    panel.classList.add("show");
}

function renderLinksWithFold(container, links, categoryId, visibleLimit = 2) {
    if (!container) return;
    container.innerHTML = "";

    if (!links || links.length === 0) {
        container.innerHTML = `<div class="empty-folder">Chưa có bài tập hoặc tài liệu nào trong mục này.</div>`;
        return;
    }

    const sortedLinks = sortLinksNewestFirst(links);
    const total = sortedLinks.length;
    const isReminder = (categoryId === "nhac-nho");

    const firstPortion = sortedLinks.slice(0, visibleLimit);
    firstPortion.forEach(item => {
        if (typeof createItemCardElement === 'function') {
            container.appendChild(createItemCardElement(item, categoryId));
        }
    });

    if (total > visibleLimit) {
        const remainingCount = total - visibleLimit;
        const remainingLinks = sortedLinks.slice(visibleLimit);
        const isExpanded = !!categoryExpandedState[categoryId];

        const foldWrapper = document.createElement("div");
        foldWrapper.className = "category-fold-wrapper";
        foldWrapper.style.width = "100%";

        const hiddenBox = document.createElement("div");
        hiddenBox.id = `fold-hidden-box-${categoryId}`;
        hiddenBox.className = "category-hidden-links";
        hiddenBox.style.display = isExpanded ? "flex" : "none";
        hiddenBox.style.flexDirection = "column";
        hiddenBox.style.gap = "8px";
        hiddenBox.style.marginTop = "8px";
        hiddenBox.style.width = "100%";

        remainingLinks.forEach(item => {
            if (typeof createItemCardElement === 'function') {
                hiddenBox.appendChild(createItemCardElement(item, categoryId));
            }
        });

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.id = `fold-btn-${categoryId}`;
        toggleBtn.className = "load-more-btn category-expand-toggle-btn";
        toggleBtn.style.display = "flex";
        toggleBtn.style.alignItems = "center";
        toggleBtn.style.justifyContent = "center";
        toggleBtn.style.gap = "6px";
        toggleBtn.style.margin = "8px 0 0 0";
        toggleBtn.style.padding = "9px 14px";
        toggleBtn.style.borderRadius = "12px";
        toggleBtn.style.fontWeight = "800";
        toggleBtn.style.fontSize = "13px";
        toggleBtn.style.cursor = "pointer";
        toggleBtn.style.transition = "all 0.15s ease";

        if (isReminder) {
            toggleBtn.innerHTML = isExpanded 
                ? `▲ Thu gọn bài viết (${remainingCount} bài)` 
                : `▼ Xem tiếp ${remainingCount} bài viết cũ hơn`;
        } else {
            toggleBtn.innerHTML = isExpanded 
                ? `▲ Thu gọn lại (${remainingCount} mục)` 
                : `▼ Ấn vào đây để xem tiếp ${remainingCount} mục còn lại`;
        }

        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            categoryExpandedState[categoryId] = !categoryExpandedState[categoryId];
            const nowExpanded = categoryExpandedState[categoryId];
            hiddenBox.style.display = nowExpanded ? "flex" : "none";
            if (isReminder) {
                toggleBtn.innerHTML = nowExpanded 
                    ? `▲ Thu gọn bài viết (${remainingCount} bài)` 
                    : `▼ Xem tiếp ${remainingCount} bài viết cũ hơn`;
            } else {
                toggleBtn.innerHTML = nowExpanded 
                    ? `▲ Thu gọn lại (${remainingCount} mục)` 
                    : `▼ Ấn vào đây để xem tiếp ${remainingCount} mục còn lại`;
            }
        };

        foldWrapper.appendChild(hiddenBox);
        foldWrapper.appendChild(toggleBtn);
        container.appendChild(foldWrapper);
    }
}

function renderDayThemSection() {
    const bar = document.getElementById("daythem-nav-bar");
    const panel = document.getElementById("daythem-dropdown-panel");
    const list = document.getElementById("daythem-links-container");
    if (!bar || !panel || !list) return;

    bar.innerHTML = "";
    DAY_THEM_CATEGORIES.forEach(cat => {
        const isActive = (activeDayThemCatId === cat.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `dantri-nav-btn cat-btn-${cat.id}` + (isActive ? " active" : "");
        btn.innerHTML = `<span>${cat.title}</span> <span class="caret-icon">${isActive ? "▲" : "▼"}</span>`;
        btn.onclick = () => {
            activeDayThemCatId = (activeDayThemCatId === cat.id) ? null : cat.id;
            renderDayThemSection();
        };
        bar.appendChild(btn);
    });

    list.innerHTML = "";
    if (!activeDayThemCatId) { 
        panel.className = "dantri-dropdown-panel";
        return; 
    }

    const activeCat = DAY_THEM_CATEGORIES.find(c => c.id === activeDayThemCatId);
    panel.className = `dantri-dropdown-panel show cat-theme-${activeDayThemCatId}`;

    if (activeCat && activeCat.links && activeCat.links.length > 0) {
        renderLinksWithFold(list, activeCat.links, activeCat.id, 2);
    } else {
        list.innerHTML = `<div class="empty-folder">Chưa có bài kiểm tra nào trong mục này.</div>`;
    }
}

function renderChinhKhoaSection() {
    const row1Bar = document.getElementById("chinhkhoa-row1-bar");
    const row1Panel = document.getElementById("chinhkhoa-row1-dropdown");
    const row1List = document.getElementById("chinhkhoa-row1-links");

    const row1Cats = CHINH_KHOA_CATEGORIES.filter(c => c.row === 1);
    if (row1Bar && row1Panel && row1List) {
        row1Bar.innerHTML = "";
        row1Cats.forEach(cat => {
            const isActive = (activeChinhKhoaRow1CatId === cat.id);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `dantri-nav-btn cat-btn-${cat.id}` + (isActive ? " active" : "");
            btn.innerHTML = `<span>${cat.title}</span> <span class="caret-icon">${isActive ? "▲" : "▼"}</span>`;
            btn.onclick = () => {
                activeChinhKhoaRow1CatId = (activeChinhKhoaRow1CatId === cat.id) ? null : cat.id;
                renderChinhKhoaSection();
            };
            row1Bar.appendChild(btn);
        });

        row1List.innerHTML = "";
        if (!activeChinhKhoaRow1CatId) {
            row1Panel.className = "dantri-dropdown-panel";
        } else {
            const activeCat1 = row1Cats.find(c => c.id === activeChinhKhoaRow1CatId);
            row1Panel.className = `dantri-dropdown-panel show cat-theme-${activeChinhKhoaRow1CatId}`;
            if (activeCat1 && activeCat1.links && activeCat1.links.length > 0) {
                renderLinksWithFold(row1List, activeCat1.links, activeCat1.id, 2);
            } else {
                row1List.innerHTML = `<div class="empty-folder">Chưa có bài tập cho lớp này.</div>`;
            }
        }
    }

    const row2Bar = document.getElementById("chinhkhoa-row2-bar");
    const row2Panel = document.getElementById("chinhkhoa-row2-dropdown");
    const row2List = document.getElementById("chinhkhoa-row2-links");

    const row2Cats = CHINH_KHOA_CATEGORIES.filter(c => c.row === 2);
    if (row2Bar && row2Panel && row2List) {
        row2Bar.innerHTML = "";
        row2Cats.forEach(cat => {
            const isActive = (activeChinhKhoaRow2CatId === cat.id);
            const btn = document.createElement("button");
            btn.type = "button";
            let customCls = ` cat-btn-${cat.id}`;
            if (cat.id === "lop-11e") customCls += " lop11e-btn";
            else if (cat.isGold) customCls += " hsg-gold-btn";
            else if (cat.isPurple) customCls += " padlet-purple-btn";

            btn.className = "dantri-nav-btn" + customCls + (isActive ? " active" : "");
            btn.innerHTML = `<span>${cat.title}</span> <span class="caret-icon">${isActive ? "▲" : "▼"}</span>`;
            btn.onclick = () => {
                activeChinhKhoaRow2CatId = (activeChinhKhoaRow2CatId === cat.id) ? null : cat.id;
                renderChinhKhoaSection();
            };
            row2Bar.appendChild(btn);
        });

        row2List.innerHTML = "";
        if (!activeChinhKhoaRow2CatId) {
            row2Panel.className = "dantri-dropdown-panel";
        } else {
            const activeCat2 = row2Cats.find(c => c.id === activeChinhKhoaRow2CatId);
            row2Panel.className = `dantri-dropdown-panel show cat-theme-${activeChinhKhoaRow2CatId}`;
            if (activeCat2 && activeCat2.links && activeCat2.links.length > 0) {
                renderLinksWithFold(row2List, activeCat2.links, activeCat2.id, 2);
            } else {
                row2List.innerHTML = `<div class="empty-folder">Chưa có nội dung trong chuyên mục này.</div>`;
            }
        }
    }
}

function renderKhoTaiLieuSection() {
    const container = document.getElementById("kho-tai-lieu-container");
    if (!container) return;

    container.innerHTML = `
        <details class="folder-section cat-theme-kho-tai-lieu" open>
            <summary class="folder-header">
                <img src="${KHO_TAI_LIEU_FOLDER.folderAvatar}" class="folder-avatar" alt="Kho tài liệu">
                <h3 class="folder-title">${KHO_TAI_LIEU_FOLDER.folderName}</h3>
                <span class="folder-arrow">▶</span>
            </summary>
            <div class="link-list" id="kho-tai-lieu-links-list"></div>
        </details>
    `;

    const subList = document.getElementById("kho-tai-lieu-links-list");
    if (subList) {
        renderLinksWithFold(subList, KHO_TAI_LIEU_FOLDER.links || [], "kho-tai-lieu", 2);
    }
}

function renderNewsSection() {
    const container = document.getElementById("news-container");
    if (!container) return;
    container.innerHTML = "";

    NEWS_DATA.forEach(n => {
        const a = document.createElement("a");
        a.className = "news-item";
        a.href = n.url || "#";
        a.target = n.url && n.url !== "#" ? "_blank" : "_self";
        a.innerHTML = `
            <div class="news-content">
                <div class="news-title">${n.title}</div>
                <div class="news-date">📅 ${n.date}</div>
            </div>
            <div class="news-img-box">
                <img class="news-img" src="${n.image}" alt="Tin tức">
            </div>
        `;
        container.appendChild(a);
    });
}
