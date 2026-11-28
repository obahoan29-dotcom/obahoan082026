// =========================================================================
// HỆ THỐNG CỨU HỘ ẢNH (DUAL-UPLOAD) VÀ TÍCH HỢP NÚT SỬA VÀO TỪNG CÂU HỎI
// =========================================================================

// 1. HÀM TỰ ĐỘNG CHỮA CHÁY (FALLBACK) KHI IMGBB BỊ LỖI MẤT ẢNH
window.rescueImageFromDrive = function(imgEl, driveUrl) {
    if (driveUrl && driveUrl.trim() !== "" && !driveUrl.includes("placeholder")) {
        if (imgEl.src !== driveUrl) {
            console.log("♻️ ImgBB lỗi! Đang khôi phục ảnh từ Google Drive dự phòng...");
            imgEl.src = driveUrl;
            imgEl.classList.add('img-saved-by-drive'); // Viền xanh lá báo hiệu ảnh được cứu
            imgEl.title = "Ảnh gốc bị lỗi, đã tự động tải ảnh dự phòng từ Google Drive 5TB!";
        }
    } else {
        // Cứu cánh cuối cùng nếu cả 2 đều hỏng
        imgEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="%23fee2e2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="%23dc2626" font-family="Arial,sans-serif">Ảnh đã bị xóa vĩnh viễn 😢</text></svg>';
    }
}

// 2. HÀM TIÊM NÚT "SỬA CÂU" & "ÚP ẢNH" VÀO TẤT CẢ CÁC THẺ CÂU HỎI
document.addEventListener("DOMContentLoaded", () => {
    // Đợi 2 giây để đảm bảo giao diện Ngân hàng đã render xong lần đầu
    setTimeout(injectActionButtonsToCards, 2000);
    
    // Lắng nghe mọi cú click trên thẻ để bắt sự kiện thay vì sửa tận gốc mã HTML cũ
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('.btn-card-edit')) {
            const btn = e.target.closest('.btn-card-edit');
            const qId = btn.getAttribute('data-qid');
            openEditorForSingleQuestion(qId);
        }
        if (e.target.closest('.btn-card-reupload')) {
            const btn = e.target.closest('.btn-card-reupload');
            const qId = btn.getAttribute('data-qid');
            triggerReuploadImage(qId);
        }
    });
});

// Hàm quan sát: Bất cứ khi nào thẻ câu hỏi được vẽ ra, nó sẽ mọc thêm 2 nút
function injectActionButtonsToCards() {
    const listWrap = document.getElementById('qbank-questions-list');
    if (!listWrap) return;
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.classList.contains('qbank-q-card')) {
                    appendButtonsToCard(node);
                    fixImageTagWithFallback(node);
                }
            });
        });
    });
    
    observer.observe(listWrap, { childList: true, subtree: true });
    
    // Xử lý các thẻ đã có sẵn
    document.querySelectorAll('.qbank-q-card').forEach(card => {
        appendButtonsToCard(card);
        fixImageTagWithFallback(card);
    });
}

function appendButtonsToCard(cardEl) {
    if (cardEl.querySelector('.qbank-card-local-actions')) return; 
    
    const cardId = cardEl.id || "";
    const qId = cardId.replace('qcard_', ''); 
    
    if(!qId) return;

    const actionDiv = document.createElement('div');
    actionDiv.className = 'qbank-card-local-actions';
    actionDiv.innerHTML = `
        <button type="button" class="btn-card-action btn-card-edit" data-qid="${qId}">
            ✏️ Sửa câu này
        </button>
        <button type="button" class="btn-card-action btn-card-reupload" data-qid="${qId}" title="Tự động nén và úp song song lên ImgBB + Google Drive">
            🖼️ Úp lại ảnh (Bền vững)
        </button>
    `;
    cardEl.appendChild(actionDiv);
}

function fixImageTagWithFallback(cardEl) {
    const imgEl = cardEl.querySelector('img:not(.q-num-badge)'); 
    if (imgEl) {
        const qId = cardEl.id.replace('qcard_', '');
        let driveBackup = "";
        try {
            if (window.allQbankQuestions) {
                const qData = window.allQbankQuestions.find(q => q.id === qId);
                if (qData && qData.raw && qData.raw.drive_url) {
                    driveBackup = qData.raw.drive_url;
                }
            }
        } catch(e) {}
        
        imgEl.setAttribute('onerror', `rescueImageFromDrive(this, '${driveBackup}')`);
    }
}

// 3. HÀM XỬ LÝ KHI BẤM NÚT [SỬA CÂU NÀY]
function openEditorForSingleQuestion(qId) {
    if (typeof openSoiDeModal === 'function') {
        openSoiDeModal(new Event('click'));
        setTimeout(() => {
            const editorCard = document.getElementById(`soide-card-${qId}`);
            if(editorCard) {
                editorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                editorCard.style.transition = "box-shadow 0.3s";
                editorCard.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.8)";
                setTimeout(() => { editorCard.style.boxShadow = ""; }, 2000);
            } else {
                alert("Đang tải dữ liệu sửa câu hỏi... Vui lòng thử lại!");
            }
        }, 500);
    } else {
        alert("Chức năng Sửa đang khởi động, vui lòng thử lại!");
    }
}

// 4. HÀM KÉP: ÚP ẢNH LÊN IMGBB VÀ GOOGLE DRIVE CÙNG LÚC THÔNG QUA GAS
function triggerReuploadImage(qId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/jpg, image/webp';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const toast = document.getElementById('qbank-toast');
        if (toast) {
            toast.innerText = "⏳ Đang tải ảnh lên ImgBB & Google Drive (Vui lòng đợi 3-5 giây)...";
            toast.className = "qbank-toast toast-warning show";
        }

        try {
            const base64 = await fileToBase64(file);
            
            const [imgbbUrl, driveUrl] = await Promise.all([
                uploadToImgBBDirect(base64),
                uploadToGoogleDriveBackup(base64, `Img_${qId}_${Date.now()}.jpg`, "Kho_Anh_Du_Phong")
            ]);

            if (!imgbbUrl && !driveUrl) {
                throw new Error("Cả 2 máy chủ ảnh đều từ chối!");
            }

            const finalImgbbUrl = imgbbUrl || driveUrl; 
            const finalDriveUrl = driveUrl || imgbbUrl;

            if (window.supabaseClient) {
                const { error } = await supabaseClient.from('qbank_questions')
                    .update({ 
                        image_url: finalImgbbUrl, 
                        drive_url: finalDriveUrl 
                    })
                    .eq('id', qId);
                    
                if (error) throw error;
                
                if (toast) {
                    toast.innerText = "✅ Úp ảnh thành công! Đã sao lưu vĩnh viễn trên Drive.";
                    toast.className = "qbank-toast toast-success show";
                    setTimeout(() => { toast.classList.remove('show'); }, 3000);
                }
                
                const cardEl = document.getElementById(`qcard_${qId}`);
                if (cardEl) {
                    let imgEl = cardEl.querySelector('img:not(.q-num-badge)');
                    if(!imgEl) {
                        const optWrap = cardEl.querySelector('.qbank-options-preview');
                        if (optWrap) {
                            imgEl = document.createElement('img');
                            imgEl.style.maxWidth = "100%";
                            imgEl.style.borderRadius = "8px";
                            imgEl.style.marginTop = "8px";
                            optWrap.parentNode.insertBefore(imgEl, optWrap);
                        }
                    }
                    if(imgEl) {
                        imgEl.src = finalImgbbUrl;
                        imgEl.setAttribute('onerror', `rescueImageFromDrive(this, '${finalDriveUrl}')`);
                    }
                }
            }

        } catch (err) {
            console.error(err);
            if (toast) {
                toast.innerText = "❌ Lỗi: " + err.message;
                toast.className = "qbank-toast toast-error show";
                setTimeout(() => { toast.classList.remove('show'); }, 4000);
            } else {
                alert("Lỗi tải ảnh: " + err.message);
            }
        }
    };
    input.click();
}

async function uploadToImgBBDirect(base64Data) {
    try {
        const cleanB64 = base64Data.split(',')[1];
        const formData = new FormData();
        formData.append("image", cleanB64);
        
        // Thầy thay khóa API ImgBB của Thầy vào đây
        const IMG_BB_API_KEY = "64f1d46bd860f4ebcc6df1966db9f5e9"; 
        
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMG_BB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (data && data.data && data.data.url) return data.data.url;
        return null;
    } catch (e) {
        return null;
    }
}

async function uploadToGoogleDriveBackup(base64Data, filename, folderName) {
    try {
        const payload = {
            action: "uploadFile",
            filename: filename,
            folderName: folderName,
            base64: base64Data,
            mimeType: "image/jpeg"
        };
        const res = await fetch(APP_CONFIG.GAS_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && data.status === "success") return data.directUrl || data.fileUrl;
        return null;
    } catch(e) {
        return null;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}