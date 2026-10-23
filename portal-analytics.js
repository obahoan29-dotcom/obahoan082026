// =========================================================
// FILE: portal-analytics.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG)
// =========================================================

let siteVisitStatsCache = {
    todayCount: 0, yesterdayCount: 0, weekCount: 0, totalCount: 0,
    hourlyCounts: Array(24).fill(0), dailyCounts: []
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
    if (!supabaseClient) return;
    const todayKey = getVNDateKey(); 
    const currentHour = getVNHour();
    const sessionKey = `site_visit_logged_${todayKey}`;
    
    if (!safeSession.getItem(sessionKey)) { 
        safeSession.setItem(sessionKey, "true"); 
        await recordSiteVisit(todayKey, currentHour); 
    }
    await fetchAndRenderVisitStats();
}

async function recordSiteVisit(todayKey, hour) {
    try {
        const hourStr = String(hour).padStart(2, '0');
        const { data } = await supabaseClient.from('site_visits').select('*').eq('day_key', todayKey).single();

        let total = 1;
        let hours = {};
        if (data) {
            total = (data.total || 0) + 1;
            hours = data.hours || {};
            hours[hourStr] = (hours[hourStr] || 0) + 1;
        } else {
            hours[hourStr] = 1;
        }

        await supabaseClient.from('site_visits').upsert({
            day_key: todayKey,
            total: total,
            hours: hours
        });
    } catch(e) {}
}

async function fetchAndRenderVisitStats() {
    try {
        const todayKey = getVNDateKey();
        const { data: list } = await supabaseClient.from('site_visits').select('*').order('day_key', { ascending: false }).limit(30);

        let todayCount = 0;
        let allTime = 0;
        let hourly = Array(24).fill(0);

        if (Array.isArray(list)) {
            list.forEach(row => {
                allTime += (row.total || 0);
                if (row.day_key === todayKey) {
                    todayCount = row.total || 0;
                    if (row.hours) {
                        for (let h = 0; h < 24; h++) {
                            const hs = String(h).padStart(2, '0');
                            hourly[h] = row.hours[hs] || 0;
                        }
                    }
                }
            });
        }

        const badgeNumber = document.getElementById("visit-today-count");
        if (badgeNumber) badgeNumber.innerText = todayCount.toLocaleString("vi-VN");
        const kpiToday = document.getElementById("kpi-visit-today");
        if (kpiToday) kpiToday.innerText = todayCount.toLocaleString("vi-VN");
        const kpiTotal = document.getElementById("kpi-visit-alltime");
        if (kpiTotal) kpiTotal.innerText = allTime.toLocaleString("vi-VN");

        renderHourlyBars(hourly, getVNHour());
    } catch(e) {}
}