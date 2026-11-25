// =========================================================
// FILE: app-config.js (BẢN FIX TRIỆT ĐỂ CHUYỂN HƯỚNG, BẢO VỆ PHÒNG THI & TỐI ƯU BĂNG THÔNG)
// =========================================================

// THÔNG SỐ DỰ ÁN SUPABASE CỦA THẦY
const SUPABASE_URL = "https://vvjstcftecorvmepdkbi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pLAoa3B4c6Z0N19kbLA9NA_3_npZyaC";

// CẤU HÌNH WEB DỰ PHÒNG & CHUYỂN HƯỚNG TỰ ĐỘNG
const DEFAULT_BACKUP_WEB_URL = "https://obahoan2026.vercel.app/";
let SITE_REDIRECT_CONFIG = {
    enabled: false,
    targetUrl: DEFAULT_BACKUP_WEB_URL
};

// Khởi tạo Supabase Client an toàn
let supabaseClient = null;
function getSupabaseClient() {
    if (!supabaseClient && typeof window.supabase !== 'undefined' && window.supabase && window.supabase.createClient) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch(e) {
            console.error("Lỗi khởi tạo Supabase Client:", e);
        }
    }
    return supabaseClient;
}
getSupabaseClient();

// HÀM KIỂM TRA QUYỀN ADMIN (ADMIN KHÔNG BAO GIỜ BỊ CHUYỂN HƯỚNG)
function isSafeAdminBypass() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === '1' || window.location.hash.includes('admin')) return true;
        
        const logged = localStorage.getItem("adminLoggedInSession");
        const expiresAt = localStorage.getItem("admin_expires_at");
        if (logged === "true" && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
            return true;
        }
        if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) return true;
    } catch(e) {}
    return false;
}

// HÀM KIỂM TRA HỌC SINH CÓ ĐANG TRONG PHÒNG THI HAY KHÔNG
function isExamInProgress() {
    try {
        const currentPath = window.location.pathname.toLowerCase();
        const currentHref = window.location.href.toLowerCase();
        if (currentPath.includes("thi.html") || currentHref.includes("thi.html")) {
            return true;
        }
    } catch(e) {}
    return false;
}

// HÀM THỰC HIỆN CHUYỂN HƯỚNG SANG WEB DỰ PHÒNG CHO HỌC SINH
function executeStudentRedirect(targetUrl) {
    if (isSafeAdminBypass()) return;
    if (isExamInProgress()) return;
    
    let destination = targetUrl || DEFAULT_BACKUP_WEB_URL;
    if (!destination.startsWith("http://") && !destination.startsWith("https://")) {
        destination = "https://" + destination;
    }
    
    try {
        const currentSearch = window.location.search;
        if (currentSearch && destination.endsWith('/')) {
            destination = destination.slice(0, -1) + currentSearch;
        } else if (currentSearch) {
            destination = destination + currentSearch;
        }
    } catch(e) {}

    window.location.replace(destination);
}

// LẮNG NGHE & ĐỒNG BỘ CHUYỂN HƯỚNG TỪ SUPABASE (CHIA SẺ PROMISE + TẮT WEBSOCKET CHO HS)
function initGlobalSiteRedirectWatcher() {
    const isAdmin = isSafeAdminBypass();
    if (!isAdmin) {
        try {
            localStorage.removeItem("site_redirect_config");
        } catch(e) {}
    } else {
        try {
            const rawRedirect = localStorage.getItem("site_redirect_config");
            if (rawRedirect) {
                const parsed = JSON.parse(rawRedirect);
                if (parsed) {
                    SITE_REDIRECT_CONFIG = {
                        enabled: !!parsed.enabled,
                        targetUrl: parsed.targetUrl || DEFAULT_BACKUP_WEB_URL
                    };
                }
            }
        } catch(e) {}
    }

    const client = getSupabaseClient();
    if (!client) return Promise.resolve(SITE_REDIRECT_CONFIG);

    // Nếu học sinh đang trong phòng thi thi.html thì không cần tốn request kiểm tra chuyển hướng
    if (isExamInProgress() && !isAdmin) {
        return Promise.resolve(SITE_REDIRECT_CONFIG);
    }

    const fetchTask = (async () => {
        try {
            const { data, error } = await client
                .from('app_key_values')
                .select('value')
                .eq('key', 'site_redirect_config')
                .maybeSingle();

            if (!error && data && data.value) {
                SITE_REDIRECT_CONFIG = {
                    enabled: !!data.value.enabled,
                    targetUrl: data.value.targetUrl || DEFAULT_BACKUP_WEB_URL
                };

                if (isSafeAdminBypass()) {
                    try {
                        localStorage.setItem("site_redirect_config", JSON.stringify(SITE_REDIRECT_CONFIG));
                    } catch(e) {}
                }

                if (typeof updateRedirectUIElements === 'function') {
                    updateRedirectUIElements();
                }

                if (SITE_REDIRECT_CONFIG.enabled && !isSafeAdminBypass() && !isExamInProgress()) {
                    executeStudentRedirect(SITE_REDIRECT_CONFIG.targetUrl);
                }
            } else {
                SITE_REDIRECT_CONFIG.enabled = false;
                if (typeof updateRedirectUIElements === 'function') {
                    updateRedirectUIElements();
                }
            }
        } catch(e) {
            SITE_REDIRECT_CONFIG.enabled = false;
        }

        // Chỉ mở kênh Realtime cho Admin để tiết kiệm hàng trăm kết nối WebSocket mỗi ngày
        if (isSafeAdminBypass()) {
            try {
                client.channel('realtime_redirect_watcher')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'app_key_values',
                        filter: 'key=eq.site_redirect_config'
                    }, payload => {
                        const fresh = payload.new;
                        if (fresh && fresh.value) {
                            SITE_REDIRECT_CONFIG = {
                                enabled: !!fresh.value.enabled,
                                targetUrl: fresh.value.targetUrl || DEFAULT_BACKUP_WEB_URL
                            };
                            try {
                                localStorage.setItem("site_redirect_config", JSON.stringify(SITE_REDIRECT_CONFIG));
                            } catch(e) {}
                            if (typeof updateRedirectUIElements === 'function') {
                                updateRedirectUIElements();
                            }
                        }
                    })
                    .subscribe();
            } catch(e) {}
        }

        return SITE_REDIRECT_CONFIG;
    })();

    window.__siteRedirectPromise = fetchTask;
    return fetchTask;
}

initGlobalSiteRedirectWatcher();

// CẤU HÌNH GOOGLE DRIVE & IMGBB
const GOOGLE_DRIVE_UPLOAD_GAS_URL = "https://script.google.com/macros/s/AKfycbw7FcB-bU6IsHquCwbNeBsJ_ysoPDm-220dnQirzyHYwHwRmHcuxU-5WHogLpExHJMm/exec";
const GOOGLE_DRIVE_TULUAN_GAS_URL = "https://script.google.com/macros/s/AKfycbw7FcB-bU6IsHquCwbNeBsJ_ysoPDm-220dnQirzyHYwHwRmHcuxU-5WHogLpExHJMm/exec";
const IMGBB_API_KEY = "548b05b895acef8ad88e645fd274c574"; 

const TEACHER_ZALO_LINK = "https://zalo.me/0972952128";
const TEACHER_MESSENGER_LINK = "https://m.me/?locale=vi_VN";

let REMINDER_SECTION_TITLE = "📌 Nhắc nhở quan trọng";
let isAdminLoggedIn = false;
let selectedAvatarUrl = "";
let currentMoveData = { oldCategory: null, quizId: null, quizData: null };
let currentCopyData = { sourceCategory: null, itemId: null, itemData: null };

let activeStudentLogin = {
    targetUrl: "",
    examTitle: "",
    categoryId: "them-11",
    currentMode: "class"
};

// DANH SÁCH 50 ICON AVATAR MẪU
const PRESET_AVATARS = [
    "https://cdn-icons-png.flaticon.com/512/3771/3771417.png",
    "https://cdn-icons-png.flaticon.com/512/3755/3755251.png",
    "https://cdn-icons-png.flaticon.com/512/3062/3062279.png", 
    "https://cdn-icons-png.flaticon.com/512/4144/4144683.png",
    "https://cdn-icons-png.flaticon.com/512/4144/4144672.png", 
    "https://cdn-icons-png.flaticon.com/512/2996/2996841.png",
    "https://cdn-icons-png.flaticon.com/512/10061/10061805.png", 
    "https://cdn-icons-png.flaticon.com/512/9308/9308006.png",
    "https://cdn-icons-png.flaticon.com/512/9068/9068641.png", 
    "https://cdn-icons-png.flaticon.com/512/9181/9181285.png",
    "https://cdn-icons-png.flaticon.com/512/3074/3074058.png", 
    "https://cdn-icons-png.flaticon.com/512/4243/4243003.png",
    "https://cdn-icons-png.flaticon.com/512/3135/3135810.png", 
    "https://cdn-icons-png.flaticon.com/512/4144/4144724.png",
    "https://cdn-icons-png.flaticon.com/512/4144/4144773.png", 
    "https://cdn-icons-png.flaticon.com/512/4762/4762295.png",
    "https://cdn-icons-png.flaticon.com/512/6168/6168641.png", 
    "https://cdn-icons-png.flaticon.com/512/3253/3253258.png",
    "https://cdn-icons-png.flaticon.com/512/2275/2275069.png", 
    "https://cdn-icons-png.flaticon.com/512/4006/4006511.png",
    "https://cdn-icons-png.flaticon.com/512/3358/3358327.png", 
    "https://cdn-icons-png.flaticon.com/512/10061/10061732.png",
    "https://cdn-icons-png.flaticon.com/512/4539/4539472.png", 
    "https://cdn-icons-png.flaticon.com/512/3081/3081371.png",
    "https://cdn-icons-png.flaticon.com/512/864/864685.png", 
    "https://cdn-icons-png.flaticon.com/512/3143/3143657.png",
    "https://cdn-icons-png.flaticon.com/512/2072/2072138.png", 
    "https://cdn-icons-png.flaticon.com/512/4207/4207253.png",
    "https://cdn-icons-png.flaticon.com/512/1048/1048953.png", 
    "https://cdn-icons-png.flaticon.com/512/3135/3135768.png",
    "https://cdn-icons-png.flaticon.com/512/18551/18551183.png",
    "https://cdn-icons-png.flaticon.com/512/86/86489.png",
    "https://cdn-icons-png.flaticon.com/512/86/86511.png",
    "https://cdn-icons-png.flaticon.com/512/1610/1610724.png",
    "https://cdn-icons-png.flaticon.com/512/1352/1352423.png",
    "https://cdn-icons-png.flaticon.com/512/1388/1388527.png",
    "https://cdn-icons-png.flaticon.com/512/1538/1538432.png",
    "https://cdn-icons-png.flaticon.com/512/565/565524.png",
    "https://cdn-icons-png.flaticon.com/512/2211/2211242.png",
    "https://cdn-icons-png.flaticon.com/512/3840/3840525.png",
    "https://cdn-icons-png.flaticon.com/512/6349/6349658.png",
    "https://cdn-icons-png.flaticon.com/512/31/31069.png",
    "https://cdn-icons-png.flaticon.com/512/4762/4762314.png",
    "https://cdn-icons-png.flaticon.com/512/3070/3070648.png",
    "https://cdn-icons-png.flaticon.com/512/3059/3059870.png",
    "https://cdn-icons-png.flaticon.com/512/590/590685.png",
    "https://cdn-icons-png.flaticon.com/512/7231/7231355.png",
    "https://cdn-icons-png.flaticon.com/512/3594/3594663.png",
    "https://cdn-icons-png.flaticon.com/512/6667/6667735.png",
    "https://cdn-icons-png.flaticon.com/512/3042/3042510.png"
];
const PRESET_20_AVATARS = PRESET_AVATARS.slice(0, 20);

const TOP_BANNER_URL = "https://files.catbox.moe/cf5o9u.jpg"; 
const WEB_AVATAR_URL = "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=150";
const BOTTOM_BANNER_URL = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1000";

const DANTRI_NAV_CATEGORIES = [
    { id: "vui-vui", title: "🤣 Vui<br>vui", subTitle: "🎉 Thư giãn & Bản tin vui vẻ học đường", news: [ { tag: "GIẢI TRÍ", title: "Góc thư giãn: Những câu nói bất hủ của học sinh trong giờ kiểm tra Toán", date: "22/08/2026 - 10:00", url: "https://dantri.com.vn" }, { tag: "CƯỜI MẮT", title: "Chuyện lạ lớp học: Khi thầy giáo ra đề toán bằng thơ lục bát cực chất", date: "21/08/2026 - 18:20", url: "https://dantri.com.vn" } ] },
    { id: "thoi-su", title: "🔴 Thời<br>sự", subTitle: "📢 Thời sự & Sự kiện giáo dục nổi bật", news: [ { tag: "MỚI NHẤT", title: "Bộ GD&ĐT ban hành hướng dẫn cấu trúc đề thi Tốt nghiệp THPT 2026", date: "22/08/2026 - 08:30", url: "https://dantri.com.vn" } ] },
    { id: "giao-duc", title: "🏫 Giáo<br>đục", subTitle: "📚 Bản tin giáo dục & Trường học", news: [ { tag: "TIÊU ĐIỂM", title: "Phụ huynh chuẩn bị SGK và tài liệu ôn thi đầu năm học", date: "22/08/2026 - 07:45", url: "https://dantri.com.vn/giao-duc.htm" } ] },
    { id: "the-thao", title: "⚽ Thể<br>thao", subTitle: "🏆 Thể thao trong nước & Quốc tế", news: [ { tag: "BÓNG ĐÁ", title: "Tổng hợp các giải thể thao học sinh, sinh viên toàn quốc", date: "22/08/2026 - 10:15", url: "https://dantri.com.vn/the-thao.htm" } ] },
    { id: "me-xe", title: "🚗 Mê<br>xe", subTitle: "🚘 Thế giới xe & Công nghệ bốn bánh", news: [ { tag: "ĐÁNH GIÁ", title: "Phân tích các dòng xe gia đình 5 chỗ", date: "22/08/2026 - 08:20", url: "https://dantri.com.vn/o-to-xe-may.htm" } ] },
    { id: "the-gioi", title: "🌍 Thế<br>giới", subTitle: "🌐 Tin thế giới - Quân sự - Phân tích", news: [ { tag: "QUÂN SỰ", title: "Cập nhật diễn biến thời sự quốc tế", date: "22/08/2026 - 09:10", url: "https://dantri.com.vn/the-thao.htm" } ] },
    { id: "suc-khoe", title: "🩺 Sức<br>khỏe", subTitle: "💊 Bản tin sức khỏe", news: [ { tag: "TƯ VẤN", title: "Bí quyết giữ gìn sức khỏe mùa thi", date: "22/08/2026 - 09:00", url: "https://dantri.com.vn/suc-khoe.htm" } ] },
    { id: "du-lich", title: "✈️ Du<br>lịch", subTitle: "🏔️ Khám phá & Trải nghiệm du lịch", news: [ { tag: "KHÁM PHÁ", title: "Gợi ý các điểm du lịch ngoại khóa", date: "22/08/2026 - 08:00", url: "https://dantri.com.vn/du-lich.htm" } ] }
];

let REMINDER_CATEGORY = { id: "nhac-nho", links: [] };
let DAY_THEM_CATEGORIES = [
    { id: "them-10", title: "📐 Thêm 10", links: [] },
    { id: "them-11", title: "✍️ Thêm 11", links: [] },
    { id: "them-12", title: "🎓 Thêm 12", links: [] }
];
let CHINH_KHOA_CATEGORIES = [
    { id: "lop-11a", title: "🏫 Lớp 11A", row: 1, links: [] },
    { id: "lop-11c", title: "🏫 Lớp 11C", row: 1, links: [] },
    { id: "lop-10p", title: "🏫 Lớp 10P", row: 1, links: [] },
    { id: "lop-11e", title: "🏫 Lớp 11E", row: 2, links: [] },
    { id: "hsg-toan-11", title: "🏆 HSG Toán 11", isGold: true, row: 2, links: [] },
    { id: "tu-luan-padlet", title: "📁 Nộp tự luận Drive", isPurple: true, row: 2, links: [] }
];

const KHO_TAI_LIEU_FOLDER = { 
    id: "kho-tai-lieu", 
    folderName: "Kho tài liệu PDF, Word, Ảnh...", 
    folderAvatar: "https://cdn-icons-png.flaticon.com/512/1048/1048953.png", 
    links: [] 
};

const NEWS_DATA = [
    { title: "Lịch kiểm tra định kỳ môn Toán tuần tới các em chú ý ôn tập kỹ.", date: "04/08/2026 - 08:00", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300", url: "#" },
    { title: "Xem đáp án và điểm bài kiểm tra của em", date: "03/08/2026 - 12:00", image: "https://files.catbox.moe/jum4by.png", url: "#" }
];
```

---

#### File 2: `app-utils.js`

```javascript
// =========================================================
// FILE 1: app-utils.js (BẢN FIX TRIỆT ĐỂ CHO IPHONE TRONG MESSENGER,
// FALLBACK ẢNH ĐA TẦNG, TỐI ƯU ĐO BĂNG THÔNG & NẠP BỘ CỨU HỘ NỘP BÀI)
// =========================================================

const safeLocal = {
    getItem(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch(e) {} }
};

const safeSession = {
    getItem(k) { try { return sessionStorage.getItem(k); } catch(e) { return null; } },
    setItem(k, v) { try { sessionStorage.setItem(k, v); } catch(e) {} },
    removeItem(k) { try { sessionStorage.removeItem(k); } catch(e) {} }
};

// MODULE: examIndexedDB (ĐÃ BỔ SUNG TIMEOUT CHỐNG TREO 100% TRÊN IOS WEBKIT)
const examIndexedDB = {
    dbName: 'ExamSecureOfflineDB',
    dbVersion: 2,
    _db: null,

    async getDB() {
        if (this._db) return this._db;
        return new Promise((resolve) => {
            if (!('indexedDB' in window)) {
                resolve(null);
                return;
            }
            
            let hasResolved = false;
            const timeoutTimer = setTimeout(() => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve(null);
                }
            }, 500);

            try {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('exam_states')) {
                        db.createObjectStore('exam_states', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('pending_submissions')) {
                        db.createObjectStore('pending_submissions', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('exam_history')) {
                        db.createObjectStore('exam_history', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('live_drafts')) {
                        db.createObjectStore('live_drafts', { keyPath: 'key' });
                    }
                };
                request.onsuccess = (e) => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(timeoutTimer);
                        this._db = e.target.result;
                        resolve(this._db);
                    }
                };
                request.onerror = () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(timeoutTimer);
                        resolve(null);
                    }
                };
            } catch (err) {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(timeoutTimer);
                    resolve(null);
                }
            }
        });
    },

    async setItem(storeName, data) {
        try {
            const db = await this.getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).put(data);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    },

    async getItem(storeName, key) {
        try {
            const db = await this.getDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    },

    async removeItem(storeName, key) {
        try {
            const db = await this.getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    },

    async getAll(storeName) {
        try {
            const db = await this.getDB();
            if (!db) return [];
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch (e) {
            return [];
        }
    }
};

window.examIndexedDB = examIndexedDB;

function normalizeName(str) {
    if (!str) return "";
    return String(str).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function toTitleCaseName(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => {
        if (!word) return "";
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

function parseDateString(dateStr) {
    if (!dateStr) return 0;
    try {
        let parts = String(dateStr).split(' - ');
        let dParts = parts[0].split('/');
        let tParts = parts[1] ? parts[1].split(':') : ['00', '00'];
        return new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]).getTime();
    } catch(e) { return 0; }
}

function formatDateTimeFull(timestamp) {
    if (!timestamp) return "---";
    let d = new Date(timestamp);
    if (isNaN(d.getTime())) {
        let parsed = parseDateString(timestamp);
        if (parsed) d = new Date(parsed);
        else return String(timestamp);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

function formatElapsedDuration(startTimeMs) {
    if (!startTimeMs) return "Đang làm...";
    const diffSec = Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins === 0) return `${secs} giây`;
    return `${mins} phút ${secs} giây`;
}

function cleanExamCodeKey(code) {
    return String(code || "").trim().replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_');
}

function extractNormalizedExamCode(title) {
    if (!title) return "";
    let clean = String(title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toUpperCase();
    let m = clean.match(/(DE\s*(?:SO)?\s*\d+)/i);
    let p1 = m ? m[1].replace(/\s+/g, "").replace("SO", "") : "";
    let mToan = clean.match(/TOAN\s*(?:LOP\s*)?(\d+)/i);
    let p2 = mToan ? ("TOAN" + mToan[1]) : "";
    if (p1 && p2) return p1 + p2;
    if (p1) return p1;
    return clean.replace(/[^A-Z0-9]/g, "");
}

function getExamCandidateCodes(title, maDe, quizId) {
    let codes = new Set();
    if (quizId) codes.add(String(quizId).trim());
    if (maDe) {
        let cleanMd = cleanExamCodeKey(maDe);
        if (cleanMd) codes.add(cleanMd);
        let normMd = extractNormalizedExamCode(maDe);
        if (normMd) codes.add(normMd);
    }
    if (title) {
        let cleanT = cleanExamCodeKey(title);
        if (cleanT) codes.add(cleanT);
        let norm = extractNormalizedExamCode(title);
        if (norm) codes.add(norm);

        let mNum = String(title).match(/(?:đề|de)\s*(?:số|so)?\s*(\d+)/i);
        if (mNum) {
            let n = mNum[1];
            codes.add(n);
            codes.add("DE" + n);
            codes.add("DE_" + n);
            codes.add("DE" + n + "TOAN11");
            codes.add("DE" + n + "TOAN10");
            codes.add("DE" + n + "TOAN12");
        }
    }
    codes.add("101");
    return Array.from(codes);
}

// BỘ CHUYỂN ĐỔI LINK ẢNH GOOGLE DRIVE ĐA TẦNG CHỐNG CHẾT LINK VĨNH VIỄN
function extractGoogleDriveFileId(url) {
    if (!url) return "";
    let cleanUrl = String(url).trim();
    let m = cleanUrl.match(/(?:file\/d\/|id=|open\?id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
    return (m && m[1]) ? m[1] : "";
}

function toDirectGoogleDriveImageUrl(url) {
    if (!url) return "";
    let cleanUrl = String(url).trim();
    let fileId = extractGoogleDriveFileId(cleanUrl);
    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    return cleanUrl;
}

function getGoogleDriveFallbackUrls(url) {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return [];
    return [
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1400`,
        `https://lh3.googleusercontent.com/u/0/d/${fileId}`,
        `https://drive.google.com/uc?export=view&id=${fileId}`
    ];
}

function stripHtml(html) {
    let tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function extractQuizIdFromItem(item) {
    if (!item) return null;
    if (item.url && item.url.includes("?id=")) {
        try {
            let u = new URL(item.url, window.location.href);
            let qId = u.searchParams.get("id");
            if (qId && qId.trim() !== "") return qId.trim();
        } catch(e) {
            let m = item.url.match(/[?&]id=([^&#]+)/);
            if (m && m[1]) return decodeURIComponent(m[1]).trim();
        }
    }
    if (item.quizId && String(item.quizId).trim() !== "") return String(item.quizId).trim();
    if (item.firebaseId && String(item.firebaseId).trim() !== "") return String(item.firebaseId).trim();
    if (item.id && String(item.id).trim() !== "") return String(item.id).trim();
    return null;
}

function formatScheduleDateTime(dtStr) {
    if (!dtStr) return "";
    let d = new Date(dtStr);
    if (isNaN(d.getTime())) {
        let p = parseDateString(dtStr);
        if (p) d = new Date(p);
        else return String(dtStr);
    }
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function buildTimeBoxHtml(timeLimitMinutes, startStr, endStr, fallbackDateStr = "") {
    let mins = parseInt(timeLimitMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
        mins = 90;
    }

    let stFormatted = "";
    let etFormatted = "";

    if (startStr && endStr) {
        stFormatted = formatScheduleDateTime(startStr);
        etFormatted = formatScheduleDateTime(endStr);
    } else if (endStr) {
        let dEnd = new Date(endStr);
        let dStart = new Date(dEnd.getTime() - 7 * 24 * 3600 * 1000);
        stFormatted = formatScheduleDateTime(dStart);
        etFormatted = formatScheduleDateTime(endStr);
    } else {
        let baseDate = fallbackDateStr ? new Date(parseDateString(fallbackDateStr) || Date.now()) : new Date();
        if (isNaN(baseDate.getTime())) baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0);
        let endDate = new Date(baseDate.getTime() + 10 * 24 * 3600 * 1000);
        endDate.setHours(23, 59, 0, 0);
        stFormatted = formatScheduleDateTime(baseDate);
        etFormatted = formatScheduleDateTime(endDate);
    }

    return `
        <div class="time-row-limit">
            ⏱ Thời gian làm: <b>${mins} phút</b>
        </div>
        <div class="time-row-schedule">
            🗓️ Khung giờ: <b>${stFormatted} đến ${etFormatted}</b>
        </div>
    `;
}

function getCategoryDisplayName(catId) {
    const map = {
        "kho-tai-lieu": "Kho tài liệu PDF, Word, Ảnh",
        "nhac-nho": "Nhắc nhở quan trọng",
        "them-10": "Thêm 10",
        "them-11": "Thêm 11",
        "them-12": "Thêm 12",
        "lop-11a": "Lớp 11A",
        "lop-11c": "Lớp 11C",
        "lop-10p": "Lớp 10P",
        "lop-11e": "Lớp 11E",
        "hsg-toan-11": "HSG Toán 11",
        "tu-luan-padlet": "Tự luận Padlet"
    };
    return map[catId] || catId;
}

function detectCategoryFromSbd(rawSbd) {
    if (!rawSbd) return null;
    const s = String(rawSbd).trim().toLowerCase();
    
    if (s.startsWith("11a") || s.startsWith("11a_")) return "lop-11a";
    if (s.startsWith("11c") || s.startsWith("11c_")) return "lop-11c";
    if (s.startsWith("11e") || s.startsWith("11e_")) return "lop-11e";
    if (s.startsWith("10p") || s.startsWith("10p_")) return "lop-10p";
    if (s.startsWith("hsg")) return "hsg-toan-11";

    if (/^10\d{2}$/.test(s)) return "them-10";
    if (/^11\d{2}$/.test(s)) return "them-11";
    if (/^12\d{2}$/.test(s)) return "them-12";

    if (window.STUDENT_ACCOUNTS) {
        for (let cat in window.STUDENT_ACCOUNTS) {
            const list = window.STUDENT_ACCOUNTS[cat];
            if (Array.isArray(list)) {
                const found = list.find(acc => acc.sbd && String(acc.sbd).trim().toLowerCase() === s);
                if (found) return cat;
            }
        }
    }
    return null;
}

function isSbdBelongsToCategory(sbd, currentCatId) {
    if (!sbd || !currentCatId) return false;
    const detected = detectCategoryFromSbd(sbd);
    if (!detected) return true;
    return detected === currentCatId;
}

function getSbdPlaceholderForCategory(catId) {
    const c = String(catId || "").toLowerCase();
    if (c.includes("11a") || c === "lop-11a") return "Ví dụ: 11A01, 11A28, 11A45...";
    if (c.includes("11c") || c === "lop-11c") return "Ví dụ: 11C01, 11C14, 11C38...";
    if (c.includes("11e") || c === "lop-11e") return "Ví dụ: 11E01, 11E05, 11E28...";
    if (c.includes("10p") || c === "lop-10p") return "Ví dụ: 10p01, 10p14, 10p37...";
    if (c.includes("hsg") || c === "hsg-toan-11") return "Ví dụ: HSG1, HSG2, HSG6...";
    if (c.includes("them-10") || c === "them 10") return "Ví dụ: 1001, 1016, 1030...";
    if (c.includes("them-11") || c === "them 11") return "Ví dụ: 1101, 1114, 1137...";
    if (c.includes("them-12") || c === "them 12") return "Ví dụ: 1201, 1210, 1234...";
    return "Nhập số báo danh theo lớp của bạn...";
}

async function sha256Hash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// BỘ ĐO LƯỜNG BĂNG THÔNG SUPABASE TỐI ƯU (GOM MỖI 3 PHÚT ĐỂ GIẢM 90% RPC)
// ============================================================================
function getVNDateKeyShared(d = new Date()) {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch (e) {
        const vnMs = d.getTime() + (d.getTimezoneOffset() * 60000) + (7 * 3600 * 1000);
        const vn = new Date(vnMs);
        const pad = n => String(n).padStart(2, '0');
        return `${vn.getFullYear()}-${pad(vn.getMonth() + 1)}-${pad(vn.getDate())}`;
    }
}

(function initSupabaseBandwidthTracker() {
    if (typeof window === "undefined" || !window.fetch || window.__supaBwPatched) return;
    window.__supaBwPatched = true;

    const BW_PENDING_STORAGE_KEY = "supa_bw_pending_v1";
    const BW_LOCAL_DAILY_KEY = "supa_bw_local_daily_v1";
    let bwBuffer = { egress: 0, ingress: 0, reqs: 0 };
    let rpcMissingFlag = false;

    try {
        const savedPending = safeLocal.getItem(BW_PENDING_STORAGE_KEY);
        if (savedPending) {
            const p = JSON.parse(savedPending);
            if (p && typeof p === "object") {
                bwBuffer.egress = Number(p.egress) || 0;
                bwBuffer.ingress = Number(p.ingress) || 0;
                bwBuffer.reqs = Number(p.reqs) || 0;
            }
        }
    } catch (e) {}

    function recordToLocalDaily(dayKey, eg, ing, reqs) {
        try {
            const raw = safeLocal.getItem(BW_LOCAL_DAILY_KEY);
            const map = raw ? JSON.parse(raw) : {};
            if (!map[dayKey]) map[dayKey] = { egress_bytes: 0, ingress_bytes: 0, requests_count: 0 };
            map[dayKey].egress_bytes += eg;
            map[dayKey].ingress_bytes += ing;
            map[dayKey].requests_count += reqs;
            safeLocal.setItem(BW_LOCAL_DAILY_KEY, JSON.stringify(map));
        } catch (e) {}
    }

    function addBandwidthSample(egressBytes, ingressBytes) {
        const eg = Math.max(0, Math.round(egressBytes || 0));
        const ing = Math.max(0, Math.round(ingressBytes || 0));
        bwBuffer.egress += eg;
        bwBuffer.ingress += ing;
        bwBuffer.reqs += 1;

        recordToLocalDaily(getVNDateKeyShared(), eg, ing, 1);
        try { safeLocal.setItem(BW_PENDING_STORAGE_KEY, JSON.stringify(bwBuffer)); } catch (e) {}
    }

    async function flushBandwidthBuffer(force = false) {
        if (rpcMissingFlag) return;
        if (bwBuffer.reqs === 0 && bwBuffer.egress === 0 && bwBuffer.ingress === 0) return;
        // Chỉ đẩy định kỳ khi đã gom được >= 3 request (hoặc khi ẩn/rời trang/Admin đo thủ công)
        if (!force && bwBuffer.reqs < 3 && (bwBuffer.egress + bwBuffer.ingress) < 10240) return;

        const client = (typeof getSupabaseClient === 'function')
            ? getSupabaseClient()
            : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        if (!client) return;

        const snap = { ...bwBuffer };
        bwBuffer = { egress: 0, ingress: 0, reqs: 0 };
        safeLocal.removeItem(BW_PENDING_STORAGE_KEY);

        try {
            const { error } = await client.rpc('increment_daily_bandwidth', {
                p_day_key: getVNDateKeyShared(),
                p_egress: snap.egress,
                p_ingress: snap.ingress,
                p_reqs: snap.reqs
            });
            if (error) {
                const msg = String(error.message || "");
                if (error.code === "42883" || error.code === "PGRST202" || msg.includes("increment_daily_bandwidth")) {
                    rpcMissingFlag = true;
                } else {
                    bwBuffer.egress += snap.egress;
                    bwBuffer.ingress += snap.ingress;
                    bwBuffer.reqs += snap.reqs;
                    safeLocal.setItem(BW_PENDING_STORAGE_KEY, JSON.stringify(bwBuffer));
                }
            }
        } catch (e) {
            bwBuffer.egress += snap.egress;
            bwBuffer.ingress += snap.ingress;
            bwBuffer.reqs += snap.reqs;
            safeLocal.setItem(BW_PENDING_STORAGE_KEY, JSON.stringify(bwBuffer));
        }
    }

    const origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
        const urlStr = typeof input === "string" ? input : (input && input.url ? input.url : "");
        const supaBase = (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL) ? SUPABASE_URL : "";
        const isSupabaseApi = supaBase && urlStr.startsWith(supaBase);
        const isTrackerItself = urlStr.includes("increment_daily_bandwidth") || urlStr.includes("site_bandwidth_daily");

        const promise = origFetch(input, init);

        if (isSupabaseApi && !isTrackerItself) {
            let ingressEstimate = 380;
            try {
                if (init && init.body) {
                    ingressEstimate += (typeof init.body === "string") ? init.body.length : (init.body.size || 512);
                }
            } catch (e) {}

            promise.then(res => {
                try {
                    const cl = res.headers && res.headers.get("content-length");
                    if (cl && !isNaN(parseInt(cl, 10))) {
                        addBandwidthSample(parseInt(cl, 10) + 450, ingressEstimate);
                    } else {
                        res.clone().text().then(txt => {
                            const byteLen = txt ? txt.length : 0;
                            addBandwidthSample(byteLen + 450, ingressEstimate);
                        }).catch(() => {
                            addBandwidthSample(512, ingressEstimate);
                        });
                    }
                } catch (e) {}
            }).catch(() => {});
        }

        return promise;
    };

    // Tăng chu kỳ gửi thống kê băng thông lên 180s (3 phút) để giảm 90% RPC
    setInterval(() => flushBandwidthBuffer(false), 180000);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) flushBandwidthBuffer(true);
    });
    window.addEventListener("pagehide", () => { flushBandwidthBuffer(true); });
    window.flushSupabaseBandwidthNow = () => flushBandwidthBuffer(true);
})();

// Tự động nạp module cứu hộ nộp bài offline (không cần sửa HTML)
(function loadOfflineRescueModule() {
    try {
        if (typeof document === "undefined" || window.__offlineRescueLoaded) return;
        window.__offlineRescueLoaded = true;
        const inject = () => {
            if (document.querySelector('script[src*="offline-sync-rescue.js"]')) return;
            const s = document.createElement("script");
            s.src = "offline-sync-rescue.js";
            s.async = true;
            (document.head || document.documentElement).appendChild(s);
        };
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", inject);
        } else {
            inject();
        }
    } catch(e) {}
})();

window.safeLocal = safeLocal;
window.safeSession = safeSession;
window.extractGoogleDriveFileId = extractGoogleDriveFileId;
window.getGoogleDriveFallbackUrls = getGoogleDriveFallbackUrls;
window.toDirectGoogleDriveImageUrl = toDirectGoogleDriveImageUrl;
window.getVNDateKeyShared = getVNDateKeyShared;
