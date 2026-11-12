// =========================================================
// FILE: app-config.js (BẢN FIX TRIỆT ĐỂ CHUYỂN HƯỚNG VÀ BẢO VỆ PHÒNG THI)
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
// (Bảo vệ tuyệt đối: Học sinh đang thi dở ở thi.html KHÔNG BAO GIỜ bị chuyển hướng làm hỏng bài thi)
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
    // 1. Thầy là Admin -> Không chuyển
    if (isSafeAdminBypass()) return;
    
    // 2. Học sinh đang trong phòng thi thi.html -> Không chuyển để không làm mất bài thi
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

// LẮNG NGHE & ĐỒNG BỘ CHUYỂN HƯỚNG TỪ SUPABASE (ĐÃ FIX: KHÔNG BỊ KẸT LOCALSTORAGE CŨ)
async function initGlobalSiteRedirectWatcher() {
    // Nếu không phải là Admin: Xóa ngay cache redirect cũ trong localStorage của học sinh
    // để tránh việc máy học sinh tự chuyển hướng khi Thầy đã tắt trên Supabase
    if (!isSafeAdminBypass()) {
        try {
            localStorage.removeItem("site_redirect_config");
        } catch(e) {}
    } else {
        // Nếu là Admin: đọc để hiển thị đúng vị trí công tắc trên bảng điều khiển
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
    if (!client) return;

    // Luôn truy vấn trực tiếp từ Supabase để lấy trạng thái mới nhất 100%
    try {
        const { data, error } = await client
            .from('app_key_values')
            .select('value')
            .eq('key', 'site_redirect_config')
            .single();

        if (!error && data && data.value) {
            SITE_REDIRECT_CONFIG = {
                enabled: !!data.value.enabled,
                targetUrl: data.value.targetUrl || DEFAULT_BACKUP_WEB_URL
            };

            // Lưu cache chỉ khi là Admin
            if (isSafeAdminBypass()) {
                try {
                    localStorage.setItem("site_redirect_config", JSON.stringify(SITE_REDIRECT_CONFIG));
                } catch(e) {}
            }

            if (typeof updateRedirectUIElements === 'function') {
                updateRedirectUIElements();
            }

            // CHỈ CHUYỂN HƯỚNG KHI MÁY CHỦ SUPABASE XÁC NHẬN LÀ ENABLED = TRUE
            if (SITE_REDIRECT_CONFIG.enabled && !isSafeAdminBypass() && !isExamInProgress()) {
                executeStudentRedirect(SITE_REDIRECT_CONFIG.targetUrl);
            }
        } else {
            // Nếu không có dữ liệu hoặc Thầy chưa cấu hình -> Luôn coi là TẮT
            SITE_REDIRECT_CONFIG.enabled = false;
            if (typeof updateRedirectUIElements === 'function') {
                updateRedirectUIElements();
            }
        }
    } catch(e) {
        SITE_REDIRECT_CONFIG.enabled = false;
    }

    // Lắng nghe Realtime: Khi Thầy gạt BẬT hoặc TẮT, máy học sinh cập nhật ngay
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

                    if (isSafeAdminBypass()) {
                        try {
                            localStorage.setItem("site_redirect_config", JSON.stringify(SITE_REDIRECT_CONFIG));
                        } catch(e) {}
                    }

                    if (typeof updateRedirectUIElements === 'function') {
                        updateRedirectUIElements();
                    }

                    // Nếu Thầy BẬT: Chỉ chuyển những ai đang ở trang chủ (index.html), không chuyển người đang thi
                    if (SITE_REDIRECT_CONFIG.enabled && !isSafeAdminBypass() && !isExamInProgress()) {
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

// =========================================================================
// DANH SÁCH 50 ICON AVATAR MẪU (30 CŨ + 20 MỚI: DORAEMON, SIÊU NHÂN, XE, MÁY BAY, QUÁI DỊ...)
// =========================================================================
const PRESET_AVATARS = [
    // 30 ICON GỐC
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

    // 20 ICON MỚI THÊM: DORAEMON, SIÊU NHÂN, NGƯỜI NHỆN, Ô TÔ, MÁY BAY, QUÁI DỊ...
    "https://cdn-icons-png.flaticon.com/512/18551/18551183.png", // 31. Mèo máy Doraemon
    "https://cdn-icons-png.flaticon.com/512/86/86489.png",         // 32. Mặt nạ Người nhện (Spider-Man)
    "https://cdn-icons-png.flaticon.com/512/86/86511.png",         // 33. Đầu Người nhện Spider-Man
    "https://cdn-icons-png.flaticon.com/512/1610/1610724.png",     // 34. Người dơi Batman
    "https://cdn-icons-png.flaticon.com/512/1352/1352423.png",     // 35. Khiên Siêu nhân (Superhero Shield)
    "https://cdn-icons-png.flaticon.com/512/1388/1388527.png",     // 36. Siêu nhân bay (Flying Hero)
    "https://cdn-icons-png.flaticon.com/512/1538/1538432.png",     // 37. Siêu nhân áo choàng
    "https://cdn-icons-png.flaticon.com/512/565/565524.png",       // 38. Xe ô tô thể thao đỏ
    "https://cdn-icons-png.flaticon.com/512/2211/2211242.png",     // 39. Xe ô tô đua tốc độ
    "https://cdn-icons-png.flaticon.com/512/3840/3840525.png",     // 40. Máy bay dân dụng (Airplane)
    "https://cdn-icons-png.flaticon.com/512/6349/6349658.png",     // 41. Máy bay phản lực du lịch
    "https://cdn-icons-png.flaticon.com/512/31/31069.png",         // 42. Máy bay phản lực siêu thanh
    "https://cdn-icons-png.flaticon.com/512/4762/4762314.png",     // 43. Robot trí tuệ nhân tạo AI
    "https://cdn-icons-png.flaticon.com/512/3070/3070648.png",     // 44. Đầu Robot tương lai
    "https://cdn-icons-png.flaticon.com/512/3059/3059870.png",     // 45. Ninja sát thủ bóng đêm
    "https://cdn-icons-png.flaticon.com/512/590/590685.png",       // 46. Khủng long bạo chúa T-Rex
    "https://cdn-icons-png.flaticon.com/512/7231/7231355.png",     // 47. Quái vật quái dị (Arcade Monster)
    "https://cdn-icons-png.flaticon.com/512/3594/3594663.png",     // 48. Người ngoài hành tinh (Alien)
    "https://cdn-icons-png.flaticon.com/512/6667/6667735.png",     // 49. Quái vật một mắt xanh
    "https://cdn-icons-png.flaticon.com/512/3042/3042510.png"      // 50. Hồn ma / Con ma Ghost quái dị
];
const PRESET_20_AVATARS = PRESET_AVATARS.slice(0, 20);

// BANNER TRÊN CÙNG: ẢNH 3 BẠN NHỎ ĐẠP XE TRÊN ĐƯỜNG QUÊ TUYỆT ĐẸP
const TOP_BANNER_URL = "./banner-top.jpg"; 
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
