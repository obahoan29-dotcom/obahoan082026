// =========================================================
// FILE: app-config.js
// CẤU HÌNH HỆ THỐNG VÀ KẾT NỐI SUPABASE CHÍNH XÁC 100%
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

// Đọc ngay cấu hình đã lưu trong LocalStorage để tránh độ trễ mạng
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

// HÀM KIỂM TRA QUYỀN ADMIN AN TOÀN TRƯỚC KHI CHUYỂN HƯỚNG
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

// HÀM THỰC HIỆN CHUYỂN HƯỚNG SANG WEB DỰ PHÒNG CHO HỌC SINH
function executeStudentRedirect(targetUrl) {
    if (isSafeAdminBypass()) return;
    
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

// LẮNG NGHE & ĐỒNG BỘ CHUYỂN HƯỚNG TỪ SUPABASE
async function initGlobalSiteRedirectWatcher() {
    const client = getSupabaseClient();

    if (SITE_REDIRECT_CONFIG && SITE_REDIRECT_CONFIG.enabled) {
        executeStudentRedirect(SITE_REDIRECT_CONFIG.targetUrl);
    }

    if (!client) return;

    try {
        const { data } = await client.from('app_key_values').select('value').eq('key', 'site_redirect_config').single();
        if (data && data.value) {
            SITE_REDIRECT_CONFIG = {
                enabled: !!data.value.enabled,
                targetUrl: data.value.targetUrl || DEFAULT_BACKUP_WEB_URL
            };

            try {
                localStorage.setItem("site_redirect_config", JSON.stringify(SITE_REDIRECT_CONFIG));
            } catch(e) {}

            if (typeof updateRedirectUIElements === 'function') {
                updateRedirectUIElements();
            }

            if (SITE_REDIRECT_CONFIG.enabled) {
                executeStudentRedirect(SITE_REDIRECT_CONFIG.targetUrl);
            }
        }
    } catch(e) {}

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

                    if (SITE_REDIRECT_CONFIG.enabled) {
                        executeStudentRedirect(SITE_REDIRECT_CONFIG.targetUrl);
                    }
                }
            })
            .subscribe();
    } catch(e) {}
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

const PRESET_AVATARS = [
    "https://i.ibb.co/HTPxzDtT/khung-long-bao-chua.jpg", "https://cdn-icons-png.flaticon.com/512/3755/3755251.png",
    "https://cdn-icons-png.flaticon.com/512/3062/3062279.png", "https://cdn-icons-png.flaticon.com/512/4144/4144683.png",
    "https://cdn-icons-png.flaticon.com/512/4144/4144672.png", "https://cdn-icons-png.flaticon.com/512/2996/2996841.png",
    "https://cdn-icons-png.flaticon.com/512/10061/10061805.png", "https://cdn-icons-png.flaticon.com/512/9308/9308006.png",
    "https://cdn-icons-png.flaticon.com/512/9068/9068641.png", "https://cdn-icons-png.flaticon.com/512/9181/9181285.png",
    "https://cdn-icons-png.flaticon.com/512/3074/3074058.png", "https://cdn-icons-png.flaticon.com/512/4243/4243003.png",
    "https://cdn-icons-png.flaticon.com/512/3135/3135810.png", "https://cdn-icons-png.flaticon.com/512/4144/4144724.png",
    "https://cdn-icons-png.flaticon.com/512/4144/4144773.png", "https://cdn-icons-png.flaticon.com/512/4762/4762295.png",
    "https://cdn-icons-png.flaticon.com/512/6168/6168641.png", "https://cdn-icons-png.flaticon.com/512/3253/3253258.png",
    "https://cdn-icons-png.flaticon.com/512/2275/2275069.png", "https://cdn-icons-png.flaticon.com/512/4006/4006511.png",
    "https://cdn-icons-png.flaticon.com/512/3358/3358327.png", "https://cdn-icons-png.flaticon.com/512/10061/10061732.png",
    "https://cdn-icons-png.flaticon.com/512/4539/4539472.png", "https://cdn-icons-png.flaticon.com/512/3081/3081371.png",
    "https://cdn-icons-png.flaticon.com/512/864/864685.png", "https://cdn-icons-png.flaticon.com/512/3143/3143657.png",
    "https://cdn-icons-png.flaticon.com/512/2072/2072138.png", "https://cdn-icons-png.flaticon.com/512/4207/4207253.png",
    "https://cdn-icons-png.flaticon.com/512/1048/1048953.png", "https://cdn-icons-png.flaticon.com/512/3135/3135768.png"
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
