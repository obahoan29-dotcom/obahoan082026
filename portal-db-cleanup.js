// =========================================================
// FILE: portal-db-cleanup.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG)
// =========================================================

function openDbCleanupModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (confirm("🧹 DỌN PHIÊN LÀM BÀI TẠM THỜI:\n\nBạn có muốn làm sạch trạng thái 'Đang làm bài' đối với các học sinh đã thoát ngang không? (Điểm số và đề thi được bảo vệ 100%)")) {
        cleanActiveSessions();
    }
}

async function cleanActiveSessions() {
    try {
        await supabaseClient.from('active_sessions').delete().neq('sbd', 'KEEP_ALL');
        alert("✅ Đã làm sạch toàn bộ phiên tạm thời thành công!");
    } catch(e) {
        alert("Lỗi: " + e.message);
    }
}