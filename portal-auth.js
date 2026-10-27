// =========================================================
// FILE: portal-auth.js
// QUẢN TRỊ VIÊN XÁC THỰC, PHÂN QUYỀN VÀ ĐỔI MẬT KHẨU ADMIN
// (Toàn bộ đăng nhập học sinh đã được chuyển sang student-exam-flow.js)
// =========================================================

function checkAdminSessionValidity() {
    try {
        const logged = safeLocal.getItem("adminLoggedInSession");
        const expiresAt = safeLocal.getItem("admin_expires_at");
        if (logged === "true" && expiresAt) {
            if (Date.now() < parseInt(expiresAt, 10)) {
                isAdminLoggedIn = true;
                return true;
            } else {
                logoutAdmin();
            }
        }
    } catch(e) {}
    isAdminLoggedIn = false;
    return false;
}

function parseExpiryDurationMs(val) {
    switch (val) {
        case '1h': return 1 * 60 * 60 * 1000;
        case '2h': return 2 * 60 * 60 * 1000;
        case '4h': return 4 * 60 * 60 * 1000;
        case '8h': return 8 * 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        case '3d': return 3 * 24 * 60 * 60 * 1000;
        case '7d': return 7 * 24 * 60 * 60 * 1000;
        case '30d': return 30 * 24 * 60 * 60 * 1000;
        default: return 24 * 60 * 60 * 1000;
    }
}

async function checkAdminPassword() {
    const inputEl = document.getElementById("admin-pass-input");
    const rawPass = (inputEl ? inputEl.value : "").trim();

    if (!rawPass) {
        alert("⚠️ Vui lòng nhập mật khẩu quản trị!");
        return;
    }

    const authBtn = document.querySelector(".auth-btn");
    if(authBtn) { authBtn.innerText = "⏳..."; authBtn.disabled = true; }

    try {
        const inputHash = await sha256Hash(rawPass);
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
        
        // Gọi hàm kiểm tra ngầm trên Supabase (RPC)
        const { data: isMatched, error } = await client.rpc('verify_admin_password', { input_hash: inputHash });

        if (error) throw error;

        if (isMatched) {
            isAdminLoggedIn = true;
            const durationVal = document.getElementById("admin-expiry-select") ? document.getElementById("admin-expiry-select").value : "1d";
            const durationMs = parseExpiryDurationMs(durationVal);
            const expiresAt = Date.now() + durationMs;

            safeLocal.setItem("adminLoggedInSession", "true");
            safeLocal.setItem("admin_expires_at", String(expiresAt));
            safeLocal.setItem("admin_duration_choice", durationVal);
            safeSession.setItem("adminLoggedInSession", "true");

            document.getElementById("auth-container").classList.remove("show");
            document.getElementById("admin-popover-panel").classList.add("show");
            document.getElementById("gear-btn").classList.add("active-gear");
            inputEl.value = "";
            refreshAllViews();
        } else {
            alert("❌ Sai mật khẩu quản trị viên!");
        }
    } catch(err) {
        alert("❌ Lỗi kết nối: " + err.message);
    } finally {
        if(authBtn) { authBtn.innerText = "VÀO"; authBtn.disabled = false; }
    }
}

async function changeAdminPassword(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    
    const oldPass = prompt("🔐 Nhập mật khẩu HIỆN TẠI của quản trị viên:");
    if (!oldPass) return;

    const newPass = prompt("🔑 Nhập mật khẩu MỚI muốn thay đổi:");
    if (!newPass) return;

    const confirmPass = prompt("🔑 Xác nhận lại mật khẩu MỚI:");
    if (newPass !== confirmPass) {
        alert("❌ Mật khẩu xác nhận không khớp!");
        return;
    }

    try {
        const oldHash = await sha256Hash(oldPass);
        const newHash = await sha256Hash(newPass);
        const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;

        // Gọi hàm đổi mật khẩu ngầm trên Supabase
        const { data: isSuccess, error } = await client.rpc('change_admin_password', { 
            old_hash: oldHash, 
            new_hash: newHash 
        });

        if (error) throw error;

        if (isSuccess) {
            alert("🎉 ĐỔI MẬT KHẨU THÀNH CÔNG!\nVui lòng sử dụng mật khẩu mới cho lần đăng nhập sau.");
        } else {
            alert("❌ Đổi mật khẩu thất bại! Mật khẩu hiện tại không đúng.");
        }
    } catch(err) {
        alert("❌ Lỗi hệ thống: " + err.message);
    }
}

function logoutAdmin(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    isAdminLoggedIn = false;
    safeLocal.removeItem("adminLoggedInSession");
    safeLocal.removeItem("admin_expires_at");
    safeSession.removeItem("adminLoggedInSession");
    closeAdminPanel();
    const gear = document.getElementById("gear-btn");
    if (gear) gear.classList.remove("active-gear");
    refreshAllViews();
    alert("🔒 Đã khóa quyền quản trị thành công!");
}

function closeAdminPanel() {
    const panel = document.getElementById("admin-popover-panel");
    const gear = document.getElementById("gear-btn");
    if (panel) panel.classList.remove("show");
    if (gear && !isAdminLoggedIn) gear.classList.remove("active-gear");
}

function toggleAdminPanel(e) {
    if (e) e.stopPropagation();
    const authContainer = document.getElementById("auth-container");
    const panel = document.getElementById("admin-popover-panel");
    const gear = document.getElementById("gear-btn");

    if (checkAdminSessionValidity()) {
        if (panel.classList.contains("show")) { closeAdminPanel(); } 
        else { panel.classList.add("show"); gear.classList.add("active-gear"); }
    } else {
        authContainer.classList.toggle("show");
        if (authContainer.classList.contains("show")) document.getElementById("admin-pass-input").focus();
    }
}

function handleEnter(e) { if (e.key === 'Enter') checkAdminPassword(); }

function togglePasswordVisibility() {
    const input = document.getElementById("admin-pass-input");
    const btn = document.getElementById("eye-toggle-btn");
    if (input.type === "password") {
        input.type = "text";
        btn.innerText = "🙈"; btn.title = "Ẩn";
    } else {
        input.type = "password";
        btn.innerText = "👁️"; btn.title = "Hiện";
    }
}