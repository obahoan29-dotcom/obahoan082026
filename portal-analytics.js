// =========================================================
// FILE: portal-analytics.js (BẢN SUPABASE HOÀN CHỈNH 100%)
// THEO DÕI LƯỢT TRUY CẬP, HIỂN THỊ MODAL VÀ BIỂU ĐỒ REALTIME
// =========================================================

let siteVisitStatsCache = {
    todayCount: 0,
    yesterdayCount: 0,
    weekCount: 0,
    totalCount: 0,
    hourlyCounts: Array(24).fill(0),
    dailyList: []
};

function getVNDateKey(d = new Date()) {
    const tzOffset = 7 * 60; 
    const localTime = d.getTime(); 
    const localOffset = d.getTimezoneOffset() * 60000;
    const vnTime = new Date(localTime + localOffset + (tzOffset * 60000));
    const pad = n => String(n).padStart(2, '0');
    return `${vnTime.getFullYear()}-${pad(vnTime.getMonth() + 1)}-${pad(vnTime.getDate())}`;
}

function getVNHour(d = new Date()) {
    const tzOffset = 7 * 60; 
    const localTime = d.getTime(); 
    const localOffset = d.getTimezoneOffset() * 60000;
    const vnTime = new Date(localTime + localOffset + (tzOffset * 60000));
    return vnTime.getHours();
}

async function initSiteVisitTracker() {
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    const todayKey = getVNDateKey(); 
    const currentHour = getVNHour();
    const sessionKey = `site_visit_logged_${todayKey}`;
    
    if (typeof safeSession !== 'undefined' && !safeSession.getItem(sessionKey)) { 
        safeSession.setItem(sessionKey, "true"); 
        await recordSiteVisit(todayKey, currentHour); 
    }
    await fetchAndRenderVisitStats();
}

async function recordSiteVisit(todayKey, hour) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!client) return;

        const hourStr = String(hour).padStart(2, '0');
        const { data } = await client.from('site_visits').select('*').eq('day_key', todayKey).single();

        let total = 1;
        let hours = {};
        if (data) {
            total = (data.total || 0) + 1;
            hours = data.hours || {};
            hours[hourStr] = (hours[hourStr] || 0) + 1;
        } else {
            hours[hourStr] = 1;
        }

        await client.from('site_visits').upsert({
            day_key: todayKey,
            total: total,
            hours: hours
        });
    } catch(e) {}
}

async function fetchAndRenderVisitStats() {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!client) return;

        const todayKey = getVNDateKey();
        const { data: list } = await client.from('site_visits').select('*').order('day_key', { ascending: false }).limit(30);

        let todayCount = 0;
        let yesterdayCount = 0;
        let weekCount = 0;
        let allTime = 0;
        let hourly = Array(24).fill(0);
        let dailyList = [];

        if (Array.isArray(list)) {
            dailyList = list;
            const yesterdayDate = new Date(Date.now() - 24 * 3600 * 1000);
            const yesterdayKey = getVNDateKey(yesterdayDate);

            list.forEach((row, idx) => {
                const rowTotal = Number(row.total) || 0;
                allTime += rowTotal;

                if (idx < 7) {
                    weekCount += rowTotal;
                }

                if (row.day_key === todayKey) {
                    todayCount = rowTotal;
                    if (row.hours) {
                        for (let h = 0; h < 24; h++) {
                            const hs = String(h).padStart(2, '0');
                            hourly[h] = Number(row.hours[hs]) || 0;
                        }
                    }
                } else if (row.day_key === yesterdayKey) {
                    yesterdayCount = rowTotal;
                }
            });
        }

        siteVisitStatsCache = {
            todayCount,
            yesterdayCount,
            weekCount,
            totalCount: allTime,
            hourlyCounts: hourly,
            dailyList: dailyList
        };

        // Cập nhật số trên Widget huy hiệu góc trên
        const badgeNumber = document.getElementById("visit-today-count");
        if (badgeNumber) badgeNumber.innerText = todayCount.toLocaleString("vi-VN");

        // Cập nhật các ô KPI trong Modal
        const kpiToday = document.getElementById("kpi-visit-today");
        if (kpiToday) kpiToday.innerText = todayCount.toLocaleString("vi-VN");

        const kpiYesterday = document.getElementById("kpi-visit-yesterday");
        if (kpiYesterday) kpiYesterday.innerText = yesterdayCount.toLocaleString("vi-VN");

        const kpiWeek = document.getElementById("kpi-visit-7days");
        if (kpiWeek) kpiWeek.innerText = weekCount.toLocaleString("vi-VN");

        const kpiTotal = document.getElementById("kpi-visit-alltime");
        if (kpiTotal) kpiTotal.innerText = allTime.toLocaleString("vi-VN");

        // Vẽ biểu đồ phân bố 24 giờ
        renderHourlyBars(hourly, getVNHour());
        renderWeeklyBars(dailyList);
    } catch(e) {
        console.warn("Lỗi fetch thống kê:", e);
    }
}

// HÀM MỞ / ĐÓNG MODAL THỐNG KÊ (ĐÃ KHẮC PHỤC LỖI BỊ ĐƠ)
function toggleVisitStatsModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const modal = document.getElementById("visit-stats-modal");
    if (!modal) return;

    const isVisible = (modal.style.display === "flex");
    if (isVisible) {
        closeVisitStatsModal();
    } else {
        modal.style.display = "flex";
        fetchAndRenderVisitStats();
    }
}

function closeVisitStatsModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const modal = document.getElementById("visit-stats-modal");
    if (modal) modal.style.display = "none";
}

// CHUYỂN ĐỔI TAB TRONG MODAL THỐNG KÊ (THEO GIỜ / THEO NGÀY)
function switchVisitStatsTab(tabName) {
    const tabHoursBtn = document.getElementById("tab-btn-hours");
    const tabWeekBtn = document.getElementById("tab-btn-week");
    const contentHours = document.getElementById("visit-tab-content-hours");
    const contentWeek = document.getElementById("visit-tab-content-week");

    if (tabName === 'hours') {
        if (tabHoursBtn) tabHoursBtn.classList.add("active");
        if (tabWeekBtn) tabWeekBtn.classList.remove("active");
        if (contentHours) contentHours.style.display = "block";
        if (contentWeek) contentWeek.style.display = "none";
    } else {
        if (tabHoursBtn) tabHoursBtn.classList.remove("active");
        if (tabWeekBtn) tabWeekBtn.classList.add("active");
        if (contentHours) contentHours.style.display = "none";
        if (contentWeek) contentWeek.style.display = "block";
    }
}

async function refreshVisitStatsData() {
    const btn = document.querySelector(".btn-refresh-visits");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang tải...";
    }
    await fetchAndRenderVisitStats();
    if (btn) {
        btn.disabled = false;
        btn.innerText = "🔄 Cập nhật";
    }
}

// VẼ CỘT LƯỢT TRUY CẬP 24 GIỜ TRONG NGÀY
function renderHourlyBars(hourlyArray, currentHour) {
    const container = document.getElementById("hourly-bars-container");
    if (!container) return;

    const hourBadge = document.getElementById("current-hour-badge");
    if (hourBadge) {
        hourBadge.innerText = `Hiện tại: ${String(currentHour).padStart(2, '0')}:00`;
    }

    const maxVal = Math.max(...hourlyArray, 1);
    let html = "";

    for (let h = 0; h < 24; h++) {
        const val = hourlyArray[h] || 0;
        const percent = Math.min(100, Math.max(4, Math.round((val / maxVal) * 100)));
        const isCur = (h === currentHour);

        html += `
            <div class="hourly-bar-col ${isCur ? 'is-current' : ''}">
                <div class="hourly-bar-val">${val > 0 ? val : ''}</div>
                <div class="hourly-bar-track" title="${h}h: ${val} lượt">
                    <div class="hourly-bar-fill" style="height: ${percent}%;"></div>
                </div>
                <div class="hourly-bar-hour">${h}h</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// VẼ DANH SÁCH CÁC NGÀY GẦN NHẤT
function renderWeeklyBars(dailyList) {
    const container = document.getElementById("weekly-bars-container");
    if (!container) return;

    if (!Array.isArray(dailyList) || dailyList.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#64748b; font-size:12px; padding:10px;">Chưa có dữ liệu thống kê các ngày qua.</div>`;
        return;
    }

    const todayKey = getVNDateKey();
    const top7 = dailyList.slice(0, 7);
    const maxVal = Math.max(...top7.map(r => Number(r.total) || 0), 1);
    let html = "";

    top7.forEach(row => {
        const count = Number(row.total) || 0;
        const percent = Math.min(100, Math.max(5, Math.round((count / maxVal) * 100)));
        const isToday = (row.day_key === todayKey);

        const dParts = String(row.day_key).split('-');
        const displayDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}` : row.day_key;

        html += `
            <div class="weekly-row-item ${isToday ? 'is-today' : ''}">
                <div class="weekly-row-day ${isToday ? 'is-today' : ''}">
                    ${isToday ? 'Hôm nay' : displayDate}
                </div>
                <div class="weekly-row-bar-wrap">
                    <div class="weekly-row-bar-fill" style="width: ${percent}%;"></div>
                </div>
                <div class="weekly-row-count">${count.toLocaleString("vi-VN")}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Đăng ký toàn cục để các thẻ HTML gọi không bao giờ bị undefined
window.initSiteVisitTracker = initSiteVisitTracker;
window.fetchAndRenderVisitStats = fetchAndRenderVisitStats;
window.toggleVisitStatsModal = toggleVisitStatsModal;
window.closeVisitStatsModal = closeVisitStatsModal;
window.switchVisitStatsTab = switchVisitStatsTab;
window.refreshVisitStatsData = refreshVisitStatsData;
window.renderHourlyBars = renderHourlyBars;
window.renderWeeklyBars = renderWeeklyBars;