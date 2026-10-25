// =========================================================
// FILE: portal-tuluan-upload.js (BẢN TỐI ƯU 100% CHO IPHONE / SAFARI / ANDROID / PC)
// XỬ LÝ UPLOAD ẢNH TỰ LUẬN, CHUẨN NÉN ẢNH, GỬI GOOGLE DRIVE
// =========================================================

// HÀM TIỆN ÍCH CHUYỂN ARRAYBUFFER SANG BASE64 AN TOÀN TRÊN IPHONE (CHỐNG TRÀN STACK)
function arrayBufferToBase64Safe(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000; // 32KB mỗi khối, tránh lỗi Maximum call stack size exceeded trên iOS
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

// HÀM ĐỌC FILE RA BASE64 ĐA TẦNG (KHÔNG PHỤ THUỘC VÀO FILEREADER CỦA SAFARI)
async function readFileAsBase64UniversalAsync(file) {
    // 1. Ưu tiên số 1: Dùng arrayBuffer() - chuẩn hiện đại 100% hỗ trợ trên mọi iOS Safari & Android
    if (file && typeof file.arrayBuffer === "function") {
        try {
            const buf = await file.arrayBuffer();
            return arrayBufferToBase64Safe(buf);
        } catch(e) {}
    }

    // 2. Dự phòng: Kiểm tra an toàn window.FileReader hoặc self.FileReader
    const SafeFR = (typeof window !== "undefined" && window.FileReader) 
        ? window.FileReader 
        : ((typeof self !== "undefined" && self.FileReader) ? self.FileReader : (typeof FileReader !== "undefined" ? FileReader : null));

    if (SafeFR) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new SafeFR();
                reader.onload = () => {
                    let res = String(reader.result || "");
                    if (res.includes("base64,")) res = res.split("base64,")[1];
                    resolve(res);
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            } catch(frErr) {
                reject(frErr);
            }
        });
    }

    throw new Error("Trình duyệt không hỗ trợ đọc tệp ảnh này!");
}

// BỘ NÉN ẢNH TỰ LUẬN DÙNG CREATEOBJECTURL (SIÊU NHẸ RAM CHO IPHONE, KHÔNG CẦN FILEREADER)
function compressImageForTuLuanAsync(file, maxDimension = 2048, quality = 0.82) {
    return new Promise(async (resolve, reject) => {
        if (!file) return reject(new Error("Không tìm thấy tệp được chọn!"));

        // Tạo ObjectURL trực tiếp từ bộ nhớ native của thiết bị
        let objectUrl = null;
        let createdUrl = false;
        if (typeof window !== "undefined" && window.URL && typeof window.URL.createObjectURL === "function") {
            try {
                objectUrl = window.URL.createObjectURL(file);
                createdUrl = true;
            } catch(e) {}
        }

        const cleanUpUrl = () => {
            if (createdUrl && objectUrl && typeof window.URL.revokeObjectURL === "function") {
                try { window.URL.revokeObjectURL(objectUrl); } catch(e) {}
            }
        };

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = function() {
            try {
                let width = img.naturalWidth || img.width || 1200;
                let height = img.naturalHeight || img.height || 900;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                // Tô nền trắng tránh ảnh PNG trong suốt hoặc HEIC bị đen nền khi sang JPEG
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                const base64 = dataUrl.split(",")[1];
                cleanUpUrl();
                resolve({ base64, dataUrl, mimeType: "image/jpeg" });
            } catch(canvasErr) {
                cleanUpUrl();
                // Nếu canvas bị lỗi giới hạn phần cứng, fallback đọc Base64 nhị phân
                readFileAsBase64UniversalAsync(file).then(b64 => {
                    resolve({ base64: b64, dataUrl: `data:${file.type || "image/jpeg"};base64,${b64}`, mimeType: file.type || "image/jpeg" });
                }).catch(err => reject(err));
            }
        };

        img.onerror = function() {
            cleanUpUrl();
            // Nếu không load được qua objectUrl (định dạng đặc thù), fallback đọc trực tiếp
            readFileAsBase64UniversalAsync(file).then(b64 => {
                resolve({ base64: b64, dataUrl: `data:${file.type || "image/jpeg"};base64,${b64}`, mimeType: file.type || "image/jpeg" });
            }).catch(err => reject(new Error("Không thể giải mã tệp ảnh này trên thiết bị. Vui lòng chọn ảnh chụp JPG/PNG!")));
        };

        if (objectUrl) {
            img.src = objectUrl;
        } else {
            // Trường hợp trình duyệt cũ không hỗ trợ createObjectURL
            try {
                const b64 = await readFileAsBase64UniversalAsync(file);
                img.src = `data:${file.type || "image/jpeg"};base64,${b64}`;
            } catch(err) {
                reject(err);
            }
        }
    });
}

async function sendToGoogleDriveWithRetry(gasUrl, payload, maxRetries = 2, timeoutMs = 75000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => { try { controller.abort(); } catch(e) {} }, timeoutMs);

        try {
            const res = await fetch(gasUrl, {
                method: "POST", 
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload), 
                signal: controller.signal
            });
            clearTimeout(timer);
            const result = await res.json();
            if (result && result.status === "success") return result;
            throw new Error(result.message || "Máy chủ Drive không phản hồi đường dẫn tệp.");
        } catch(err) {
            clearTimeout(timer); 
            lastError = err;
            if (err.name === 'AbortError' || String(err.message).includes('abort')) {
                lastError = new Error(`Thời gian tải lên Drive quá ${timeoutMs / 1000}s.`);
            }
            if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1500));
        }
    }
    throw lastError;
}

function triggerStudentUpload(stt, sbd, studentName, defaultPass) {
    const cleanSbd = String(sbd).replace(/[^a-zA-Z0-9]/g, '_');
    const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;

    if (checkCurrentIsAdmin() || safeSession.getItem(sessionAuthKey) === "true") {
        document.getElementById(`tuluan-input-${cleanSbd}`).click();
        return;
    }

    const effectivePass = getEffectiveStudentPassword(cleanSbd, sbd, defaultPass);
    const inputPass = prompt(`🔐 XÁC NHẬN NỘP BÀI:\n\nEm đang nộp bài cho: [${stt}] ${studentName} (SBD: ${sbd}).\nNhập Mật khẩu (mặc định: SBD):`);
    if (inputPass === null) return;

    const trimmedInput = inputPass.trim().toLowerCase();
    const isPassOk = (trimmedInput === effectivePass.toLowerCase()) || (trimmedInput === String(sbd).trim().toLowerCase()) || (defaultPass && trimmedInput === String(defaultPass).trim().toLowerCase());

    if (isPassOk) {
        safeSession.setItem(sessionAuthKey, "true");
        document.getElementById(`tuluan-input-${cleanSbd}`).click();
    } else { 
        alert("❌ Sai mật khẩu!"); 
    }
}

async function handleStudentEssayUploadPC(stt, sbd, studentName, fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const files = Array.from(fileInput.files);
    const cleanSbd = String(sbd).replace(/[^a-zA-Z0-9]/g, '_');
    const upBtn = document.getElementById(`btn-up-${cleanSbd}`);

    if (upBtn) { upBtn.disabled = true; upBtn.innerText = "⏳ Đang gửi..."; }

    const classSelector = document.getElementById("tuluan-class-selector");
    const classId = (classSelector && classSelector.value) ? classSelector.value : (currentTuLuanModalData.classId || "lop-11a");
    currentTuLuanModalData.classId = classId;

    const driveClassName = getCleanDriveClassName(classId);
    const quizId = currentTuLuanModalData.quizId || "quiz";
    const examTitle = currentTuLuanModalData.examTitle || "BAI_TAP_TU_LUAN";
    const unifiedFolder = getUnifiedExamFolderKey(examTitle, "", quizId);
    const studentFolderName = getStudentFolderKey(stt, sbd, studentName, classId);

    const currentSub = currentTuLuanModalData.submissionsMap[cleanSbd] || {};
    const existingImages = Array.isArray(currentSub.images) ? [...currentSub.images] : [];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pageIdx = existingImages.length + i + 1;
        try {
            if (upBtn) upBtn.innerText = `⏳ Nén ${i + 1}/${files.length}...`;
            const compressed = await compressImageForTuLuanAsync(file, 2048, 0.82);

            if (upBtn) upBtn.innerText = `🚀 Lưu trang ${pageIdx}...`;
            const payload = {
                rootFolder: "BAI_TAP_TU_LUAN", 
                className: driveClassName, 
                class: driveClassName,
                lop: driveClassName, 
                examTitle: unifiedFolder, 
                folderKey: unifiedFolder,
                studentFolder: studentFolderName, 
                stt: stt, 
                sbd: sbd, 
                studentName: studentName,
                filename: `Trang_${pageIdx}_${Date.now()}.jpg`, 
                mimeType: "image/jpeg", 
                base64: compressed.base64
            };

            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ? GOOGLE_DRIVE_TULUAN_GAS_URL : GOOGLE_DRIVE_UPLOAD_GAS_URL;
            const result = await sendToGoogleDriveWithRetry(gasUrl, payload, 2, 75000);
            
            if (result && result.status === "success" && result.fileId) {
                const directImgUrl = result.directUrl || (typeof toDirectGoogleDriveImageUrl === 'function' ? toDirectGoogleDriveImageUrl(result.fileUrl) : result.fileUrl);
                existingImages.push({
                    fileId: result.fileId, 
                    fileUrl: result.fileUrl, 
                    directUrl: directImgUrl,
                    fileName: payload.filename, 
                    uploadedAt: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN")
                });
                successCount++;
            }
        } catch(err) { 
            alert(`⚠️ Lỗi tải ảnh trang ${i + 1}: ${err.message}`); 
        }
    }

    if (successCount > 0) {
        const now = new Date(); 
        const pad = n => String(n).padStart(2, '0');
        const submitDateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

        const subPayload = {
            quiz_id: quizId, 
            sbd: cleanSbd, 
            stt: String(stt || "00"), 
            student_name: studentName,
            class_name: driveClassName, 
            exam_title: examTitle, 
            last_submit: submitDateStr, 
            last_submit_time: Date.now(),
            count: existingImages.length, 
            images: existingImages, 
            cross_score: currentSub.crossScore || "",
            cross_score_by: currentSub.crossScoreBy || "", 
            cross_score_time: currentSub.crossScoreTime || "",
            feedback: currentSub.feedback || "", 
            feedback_time: currentSub.feedbackTime || "", 
            is_approved: !!currentSub.isApproved
        };

        const client = getDbClient();
        if (client) await client.from('tu_luan_submissions').upsert(subPayload, { onConflict: 'quiz_id,sbd' });

        currentTuLuanModalData.submissionsMap[cleanSbd] = { ...subPayload, detailScores: currentSub.detailScores || {} };
        renderTuLuanStudentsTable();
        alert(`🎉 THÀNH CÔNG!\nĐã lưu ${successCount} ảnh bài làm lên Drive.`);
    }

    if (upBtn) { upBtn.disabled = false; upBtn.innerText = "📷 Tải ảnh"; }
    fileInput.value = "";
}

async function triggerExamRoomDriveUpload(qId) {
    const sId = document.getElementById("student-id")?.value.trim() || safeLocal.getItem("saved_student_sbd") || "";
    const sName = document.getElementById("student-name")?.value.trim() || safeLocal.getItem("saved_student_name") || "";
    const sClass = document.getElementById("student-class")?.value.trim() || safeLocal.getItem("saved_student_class") || "";
    const currentCat = typeof getExamCategory === 'function' ? getExamCategory() : "";

    if (!sId || !sName) { alert("⚠️ Không xác định được thông tin học sinh đang làm bài!"); return; }

    let input = document.getElementById(`drive-exam-input-${qId}`);
    if (!input) {
        input = document.createElement("input");
        input.type = "file"; 
        input.id = `drive-exam-input-${qId}`; 
        input.accept = "image/*"; 
        input.multiple = true; 
        input.style.display = "none";
        document.body.appendChild(input);
        
        input.onchange = async function() {
            if (!this.files || this.files.length === 0) return;
            const files = Array.from(this.files);
            const statusEl = document.getElementById(`drive-upload-status-${qId}`);
            if (statusEl) { statusEl.style.display = "inline-flex"; statusEl.innerText = "⏳ Đang nén & lưu Drive..."; }

            const urlParams = new URLSearchParams(window.location.search);
            const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData && examData.id) || "quiz";
            const examTitle = (typeof examData !== 'undefined' && examData && examData.title) ? examData.title : (typeof EXAM_NAME !== 'undefined' && EXAM_NAME !== 'Bài thi' ? EXAM_NAME : "BAI_TAP_TU_LUAN");
            const driveClassName = getCleanDriveClassName(sClass || currentCat);
            const unifiedFolder = getUnifiedExamFolderKey(examTitle, (typeof getMaDe === 'function' ? getMaDe() : ""), quizId);
            const studentFolderName = getStudentFolderKey("00", sId, sName, currentCat || sClass);
            const cleanSbd = sId.replace(/[^a-zA-Z0-9]/g, '_');

            let existingImages = []; 
            const client = getDbClient();
            if (client) {
                try {
                    const { data } = await client.from('tu_luan_submissions').select('images').eq('quiz_id', quizId).eq('sbd', cleanSbd).single();
                    if (data && Array.isArray(data.images)) existingImages = data.images;
                } catch(e) {}
            }

            let successCount = 0;
            for (let i = 0; i < files.length; i++) {
                const f = files[i]; 
                const pageIdx = existingImages.length + i + 1;
                try {
                    const comp = await compressImageForTuLuanAsync(f, 2048, 0.82);
                    const payload = {
                        rootFolder: "BAI_TAP_TU_LUAN", 
                        className: driveClassName, 
                        class: driveClassName, 
                        lop: driveClassName,
                        examTitle: unifiedFolder, 
                        folderKey: unifiedFolder, 
                        studentFolder: studentFolderName,
                        stt: studentFolderName.split('_')[0] || "00", 
                        sbd: sId, 
                        studentName: sName,
                        filename: `Cau_${qId}_Trang_${pageIdx}_${Date.now()}.jpg`, 
                        mimeType: "image/jpeg", 
                        base64: comp.base64
                    };
                    const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ? GOOGLE_DRIVE_TULUAN_GAS_URL : GOOGLE_DRIVE_UPLOAD_GAS_URL;
                    const resJson = await sendToGoogleDriveWithRetry(gasUrl, payload, 2, 75000);
                    
                    if (resJson && resJson.status === "success") {
                        existingImages.push({ 
                            fileId: resJson.fileId, 
                            fileUrl: resJson.fileUrl, 
                            directUrl: resJson.directUrl || resJson.fileUrl, 
                            fileName: payload.filename, 
                            uploadedAt: new Date().toLocaleTimeString("vi-VN") 
                        });
                        successCount++;
                    }
                } catch(err) { 
                    console.error("Lỗi upload ảnh tự luận:", err); 
                }
            }

            if (successCount > 0) {
                if (client) {
                    await client.from('tu_luan_submissions').upsert({
                        quiz_id: quizId, 
                        sbd: cleanSbd, 
                        stt: studentFolderName.split('_')[0] || "00", 
                        student_name: sName,
                        class_name: driveClassName, 
                        exam_title: examTitle, 
                        last_submit: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
                        last_submit_time: Date.now(), 
                        count: existingImages.length, 
                        images: existingImages, 
                        is_approved: false
                    }, { onConflict: 'quiz_id,sbd' });
                }
                if (statusEl) { statusEl.className = "drive-up-status success"; statusEl.innerText = `✅ Đã lưu ${existingImages.length} ảnh!`; }
                alert(`✅ ĐÃ LƯU BÀI TỰ LUẬN THÀNH CÔNG!`);
            } else {
                if (statusEl) { statusEl.className = "drive-up-status error"; statusEl.innerText = `❌ Lỗi gửi ảnh!`; }
            }
            this.value = "";
        };
    }
    input.click();
}

async function deleteSingleStudentImage(cleanSbd, imgIndex, studentName, defaultPass, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const isAdmin = checkCurrentIsAdmin();
    const loggedStudentSbd = (safeLocal.getItem("saved_student_sbd") || "").trim().toLowerCase();
    const sessionAuthKey = `tuluan_authed_${currentTuLuanModalData.quizId}_${cleanSbd}`;
    const isSessionAuthed = (safeSession.getItem(sessionAuthKey) === "true");
    const isOwner = Boolean((loggedStudentSbd && loggedStudentSbd === cleanSbd.toLowerCase()) || isSessionAuthed);

    if (!isAdmin && !isOwner) {
        const effectivePass = getEffectiveStudentPassword(cleanSbd, cleanSbd, defaultPass);
        const inputPass = prompt(`🔐 XÁC THỰC QUYỀN XÓA:\n\nNhập Mật khẩu hoặc SBD của em để xác nhận xóa:`);
        if (!inputPass) return;
        const trimmed = inputPass.trim().toLowerCase();
        if ((trimmed !== effectivePass.toLowerCase()) && (trimmed !== cleanSbd.toLowerCase())) { 
            alert("⛔ Sai mật khẩu! Không có quyền xóa ảnh."); 
            return; 
        }
        safeSession.setItem(sessionAuthKey, "true");
    }

    const record = currentTuLuanModalData.submissionsMap[cleanSbd];
    if (!record || !Array.isArray(record.images) || !record.images[imgIndex]) { 
        alert("⚠️ Không tìm thấy ảnh này để xóa!"); 
        return; 
    }
    if (!confirm(`⚠️ XÁC NHẬN XÓA ẢNH:\n\nXóa ảnh Trang ${imgIndex + 1} của học sinh [${studentName}]?`)) return;

    const qId = currentTuLuanModalData.quizId;
    const removedImg = record.images[imgIndex];
    record.images.splice(imgIndex, 1);
    record.count = record.images.length;

    try {
        const client = getDbClient();
        if (client) {
            if (record.images.length === 0) {
                delete currentTuLuanModalData.submissionsMap[cleanSbd];
                await client.from('tu_luan_submissions').delete().eq('quiz_id', qId).eq('sbd', cleanSbd);
            } else {
                currentTuLuanModalData.submissionsMap[cleanSbd] = record;
                await client.from('tu_luan_submissions').update({ images: record.images, count: record.images.length }).eq('quiz_id', qId).eq('sbd', cleanSbd);
            }
        }
        if (removedImg && removedImg.fileId) {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ? GOOGLE_DRIVE_TULUAN_GAS_URL : GOOGLE_DRIVE_UPLOAD_GAS_URL;
            if (gasUrl && !gasUrl.includes("DÁN_URL")) { 
                fetch(gasUrl, { 
                    method: "POST", 
                    headers: { "Content-Type": "text/plain;charset=utf-8" }, 
                    body: JSON.stringify({ action: "deleteFile", fileId: removedImg.fileId }) 
                }).catch(() => null); 
            }
        }
        renderTuLuanStudentsTable();
        alert("🗑️ Đã xóa ảnh thành công!");
    } catch(err) { 
        alert("❌ Lỗi khi xóa ảnh: " + err.message); 
    }
}

window.triggerStudentUpload = triggerStudentUpload;
window.handleStudentEssayUploadPC = handleStudentEssayUploadPC;
window.triggerExamRoomDriveUpload = triggerExamRoomDriveUpload;
window.deleteSingleStudentImage = deleteSingleStudentImage;
