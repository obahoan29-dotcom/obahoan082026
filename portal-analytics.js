// =========================================================
// FILE: portal-analytics.js (BẢN TỐI ƯU BĂNG THÔNG 95% & ĐỦ 7 NGÀY)
// =========================================================

let siteVisitStatsCache = {
    todayCount: 0,
    yesterdayCount: 0,
    weekCount: 0,
    totalCount: 0,
    hourlyCounts: Array(24).fill(0),
    dailyList: []
};

function getVNDate(d = new Date()) {
    try {
        const vnTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
        return new Date(vnTimeStr);
    } catch(e) {
        const vnMs = d.getTime() + (d.getTimezoneOffset() * 60000) + (7 * 3600 * 1000);
        return new Date(vnMs);
    }
}

function getVNDateKey(d = new Date()) {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch(e) {
        const vn = getVNDate(d);
        const pad = n => String(n).padStart(2, '0');
        return `${vn.getFullYear()}-${pad(vn.getMonth() + 1)}-${pad(vn.getDate())}`;
    }
}

function getVNHour(d = new Date()) {
    try {
        const hourStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            hour12: false
        }).format(d);
        return parseInt(hourStr, 10);
    } catch(e) {
        const vn = getVNDate(d);
        return vn.getHours();
    }
}

function standardizeDayKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return null;
    const str = rawKey.trim();
    const lower = str.toLowerCase();

    if (['summary', 'days', 'total', 'visits', 'all', 'undefined', 'null'].includes(lower)) {
        return null;
    }

    const mIso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (mIso) {
        return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
    }

    const mSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mSlash) {
        const p1 = parseInt(mSlash[1], 10);
        const p2 = parseInt(mSlash[2], 10);
        const year = mSlash[3];
        let month = p1;
        let day = p2;
        if (p1 > 12) { day = p1; month = p2; }
        else if (p2 > 12) { month = p1; day = p2; }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
        return getVNDateKey(d);
    }

    return null;
}

async function initSiteVisitTracker() {
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    const todayKey = getVNDateKey(); 
    const currentHour = getVNHour();
    const sessionKey = `site_visit_logged_${todayKey}`;
    
    let didRecordNow = false;
    if (typeof safeSession !== 'undefined' && !safeSession.getItem(sessionKey)) { 
        safeSession.setItem(sessionKey, "true"); 
        await recordSiteVisit(todayKey, currentHour); 
        didRecordNow = true;
    }
    await fetchAndRenderVisitStats(false, didRecordNow);
}

async function recordSiteVisit(todayKey, hour) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!client) return;

        const hourStr = String(hour).padStart(2, '0');
        const { data } = await client.from('site_visits').select('*').eq('day_key', todayKey).maybeSingle();

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

// loadFullHistory = false: chỉ tải 1 dòng ngày hôm nay cho badge ngoài trang chủ (tiết kiệm 95% băng thông!)
// loadFullHistory = true: tải đầy đủ lịch sử khi bấm mở popup Thống kê
async function fetchAndRenderVisitStats(loadFullHistory = false, bypassCache = false) {
    try {
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        if (!client) return;

        const todayKey = getVNDateKey();

        // Cache 60 giây trên trang chủ nếu chỉ hiển thị badge "Hôm nay"
        if (!loadFullHistory && !bypassCache && typeof safeSession !== 'undefined') {
            try {
                const cachedRaw = safeSession.getItem("visit_badge_cache_v1");
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (cached && cached.dayKey === todayKey && (Date.now() - cached.savedAt) < 60000) {
                        const badgeNumber = document.getElementById("visit-today-count");
                        if (badgeNumber) badgeNumber.innerText = Number(cached.todayCount || 0).toLocaleString("vi-VN");
                        return;
                    }
                }
            } catch(e) {}
        }

        if (!loadFullHistory) {
            const { data: todayRow } = await client
                .from('site_visits')
                .select('day_key, total')
                .eq('day_key', todayKey)
                .maybeSingle();

            const todayCount = todayRow ? (Number(todayRow.total) || 0) : 0;
            const badgeNumber = document.getElementById("visit-today-count");
            if (badgeNumber) badgeNumber.innerText = todayCount.toLocaleString("vi-VN");

            if (typeof safeSession !== 'undefined') {
                safeSession.setItem("visit_badge_cache_v1", JSON.stringify({
                    dayKey: todayKey,
                    todayCount: todayCount,
                    savedAt: Date.now()
                }));
            }
            return;
        }

        const [visitsRes, metaRes] = await Promise.all([
            client.from('site_visits').select('*'),
            client.from('app_key_values').select('value').eq('key', 'site_meta').maybeSingle()
        ]);

        const rawList = visitsRes.data || [];
        const visitsByDate = {};
        const garbageKeys = [];
        let legacyHistoricalVisits = 0;

        if (metaRes && metaRes.data && metaRes.data.value) {
            const metaVal = metaRes.data.value;
            legacyHistoricalVisits = Math.max(
                legacyHistoricalVisits,
                Number(metaVal.totalVisits || metaVal.visits || metaVal.allTimeVisits || metaVal.total_visits || metaVal.total || 0)
            );
        }

        rawList.forEach(row => {
            if (!row) return;
            const rawKey = String(row.day_key || "").trim();
            const stdKey = standardizeDayKey(rawKey);

            if (!stdKey) {
                garbageKeys.push(rawKey);
                if (rawKey.toLowerCase() === 'summary' && Number(row.total) > 0) {
                    legacyHistoricalVisits = Math.max(legacyHistoricalVisits, Number(row.total));
                }
                return;
            }

            const rowTotal = Number(row.total) || 0;
            if (!visitsByDate[stdKey]) {
                visitsByDate[stdKey] = {
                    day_key: stdKey,
                    total: rowTotal,
                    hours: (row.hours && typeof row.hours === 'object') ? { ...row.hours } : {}
                };
            } else {
                visitsByDate[stdKey].total += rowTotal;
                if (row.hours && typeof row.hours === 'object') {
                    for (let h in row.hours) {
                        const hs = String(h).padStart(2, '0');
                        visitsByDate[stdKey].hours[hs] = (visitsByDate[stdKey].hours[hs] || 0) + (Number(row.hours[h]) || 0);
                    }
                }
            }

            if (rawKey !== stdKey) {
                garbageKeys.push(rawKey);
            }
        });

        if (garbageKeys.length > 0 && typeof isSafeAdminBypass === 'function' && isSafeAdminBypass()) {
            client.from('site_visits').delete().in('day_key', garbageKeys).then();
            if (visitsByDate[todayKey]) {
                client.from('site_visits').upsert(visitsByDate[todayKey]).then();
            }
        }

        const vnNow = getVNDate();
        const last7Days = [];
        const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
        let weekSum = 0;

        for (let i = 0; i < 7; i++) {
            const curDate = new Date(vnNow);
            curDate.setDate(vnNow.getDate() - i);

            const k = getVNDateKey(curDate);
            const dayOfWeek = curDate.getDay();
            const dStr = String(curDate.getDate()).padStart(2, '0');
            const mStr = String(curDate.getMonth() + 1).padStart(2, '0');
            const shortDate = `${dStr}/${mStr}`;

            let label = "";
            if (i === 0) label = `Hôm nay (${shortDate})`;
            else if (i === 1) label = `Hôm qua (${shortDate})`;
            else label = `${dayNames[dayOfWeek]} (${shortDate})`;

            const dayCount = visitsByDate[k] ? (Number(visitsByDate[k].total) || 0) : 0;
            weekSum += dayCount;

            last7Days.push({
                day_key: k,
                label: label,
                isToday: (i === 0),
                total: dayCount
            });
        }

        const todayCount = last7Days[0].total;
        const yesterdayCount = last7Days[1].total;
        const weekCount = weekSum;

        const allDbDaysSum = Object.values(visitsByDate).reduce((sum, r) => sum + (Number(r.total) || 0), 0);
        let finalAllTime = Math.max(allDbDaysSum, legacyHistoricalVisits);
        if (legacyHistoricalVisits > 0 && allDbDaysSum < legacyHistoricalVisits) {
            finalAllTime = legacyHistoricalVisits + todayCount;
        }

        const hourly = Array(24).fill(0);
        const todayRecord = visitsByDate[todayKey];
        if (todayRecord && todayRecord.hours) {
            for (let h = 0; h < 24; h++) {
                const hs = String(h).padStart(2, '0');
                hourly[h] = Number(todayRecord.hours[hs]) || 0;
            }
        }

        siteVisitStatsCache = {
            todayCount,
            yesterdayCount,
            weekCount,
            totalCount: finalAllTime,
            hourlyCounts: hourly,
            dailyList: last7Days
        };

        const badgeNumber = document.getElementById("visit-today-count");
        if (badgeNumber) badgeNumber.innerText = todayCount.toLocaleString("vi-VN");

        const kpiToday = document.getElementById("kpi-visit-today");
        if (kpiToday) kpiToday.innerText = todayCount.toLocaleString("vi-VN");

        const kpiYesterday = document.getElementById("kpi-visit-yesterday");
        if (kpiYesterday) kpiYesterday.innerText = yesterdayCount.toLocaleString("vi-VN");

        const kpiWeek = document.getElementById("kpi-visit-7days");
        if (kpiWeek) kpiWeek.innerText = weekCount.toLocaleString("vi-VN");

        const kpiTotal = document.getElementById("kpi-visit-alltime");
        if (kpiTotal) kpiTotal.innerText = finalAllTime.toLocaleString("vi-VN");

        renderHourlyBars(hourly, getVNHour());
        renderWeeklyBars(last7Days);

    } catch(e) {
        console.warn("Lỗi fetch thống kê:", e);
    }
}

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
        fetchAndRenderVisitStats(true, true);
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

        const container = document.getElementById("hourly-bars-container");
        if (container) {
            const curBar = container.querySelector('.hourly-bar-col.is-current');
            if (curBar) {
                container.scrollTo({
                    left: curBar.offsetLeft - (container.clientWidth / 2) + (curBar.clientWidth / 2),
                    behavior: 'smooth'
                });
            }
        }
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
    await fetchAndRenderVisitStats(true, true);
    if (btn) {
        btn.disabled = false;
        btn.innerText = "🔄 Cập nhật";
    }
}

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

    setTimeout(() => {
        const curBar = container.querySelector('.hourly-bar-col.is-current');
        if (curBar) {
            container.scrollTo({
                left: curBar.offsetLeft - (container.clientWidth / 2) + (curBar.clientWidth / 2),
                behavior: 'smooth'
            });
        }
    }, 100);
}

function renderWeeklyBars(last7DaysList) {
    const container = document.getElementById("weekly-bars-container");
    if (!container) return;

    if (!Array.isArray(last7DaysList) || last7DaysList.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#64748b; font-size:12px; padding:10px;">Chưa có dữ liệu thống kê tuần.</div>`;
        return;
    }

    const maxVal = Math.max(...last7DaysList.map(r => r.total), 1);
    let html = "";

    last7DaysList.forEach(item => {
        const count = Number(item.total) || 0;
        const percent = count > 0 ? Math.min(100, Math.max(6, Math.round((count / maxVal) * 100))) : 0;

        html += `
            <div class="weekly-row-item ${item.isToday ? 'is-today' : ''}">
                <div class="weekly-row-day ${item.isToday ? 'is-today' : ''}" style="width: 130px; min-width: 130px;">
                    ${item.label}
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

window.initSiteVisitTracker = initSiteVisitTracker;
window.fetchAndRenderVisitStats = fetchAndRenderVisitStats;
window.toggleVisitStatsModal = toggleVisitStatsModal;
window.closeVisitStatsModal = closeVisitStatsModal;
window.switchVisitStatsTab = switchVisitStatsTab;
window.refreshVisitStatsData = refreshVisitStatsData;
window.renderHourlyBars = renderHourlyBars;
window.renderWeeklyBars = renderWeeklyBars;
