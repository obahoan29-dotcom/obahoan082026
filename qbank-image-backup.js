// =========================================================
// FILE: qbank-image-backup.js
// HỆ THỐNG LƯU ẢNH 2 TẦNG BẤT TỬ (IMGBB NHANH + SAO LƯU NGẦM BẮT BUỘC GOOGLE DRIVE 5TB)
// - ƯU TIÊN UPLOAD IMGBB LÀM LINK CHÍNH NHANH & TỰ ĐỘNG SAO LƯU NGẦM BẮT BUỘC VÀO GOOGLE DRIVE (RETRY + BACKOFF)
// - SAO LƯU ẢNH CŨ ĐA TẦNG CHỐNG LỖI CORS (FETCH BLOB -> CANVAS -> TẢI TRỰC TIẾP TỪ MÁY CHỦ GAS)
// - ĐẶT TÊN FILE TRÙNG SỐ CÂU + MÃ ID + MÔ TẢ CÂU & GẮN NÚT TRẠNG THÁI "✅ Đã lưu Drive"
// =========================================================

(function initQbankImageBackupModule() {
    if (typeof window === "undefined") return;

    function injectQbankAutoDriveStyles() {
        const styleId = "qbank-autosave-drive-styles";
        if (document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            .btn-qbank-autosave-drive {
                background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%) !important;
                color: #ffffff !important;
                border: 1.2px solid #7dd3fc !important;
                box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
                transition: all 0.16s ease !important;
            }
            .btn-qbank-autosave-drive.is-running {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
                border-color: #fde68a !important;
                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35) !important;
            }
            .btn-qbank-autosave-drive.is-all-saved {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
                border-color: #6ee7b7 !important;
                box-shadow: 0 2px 6px rgba(16, 185, 129, 0.28) !important;
            }
            .btn-drive-saved-status {
                background: #dcfce7 !important;
                color: #15803d !important;
                border: 1px solid #4ade80 !important;
                font-weight: 800 !important;
                text-decoration: none !important;
                cursor: pointer !important;
            }
            .btn-drive-saved-status:hover {
                background: #bbf7d0 !important;
                color: #14532d !important;
                border-color: #22c55e !important;
            }
            .btn-drive-saving-status {
                background: #e0f2fe !important;
                color: #0369a1 !important;
                border: 1px solid #7dd3fc !important;
                font-weight: 800 !important;
                cursor: wait !important;
            }
        `;
        if (document.head) document.head.appendChild(style);
        else document.addEventListener("DOMContentLoaded", () => {
            if (document.head && !document.getElementById(styleId)) document.head.appendChild(style);
        });
    }
    injectQbankAutoDriveStyles();

    function getBackupGasUrl() {
        if (typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            return GOOGLE_DRIVE_UPLOAD_GAS_URL;
        }
        if (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL && !GOOGLE_DRIVE_TULUAN_GAS_URL.includes("DÁN_URL")) {
            return GOOGLE_DRIVE_TULUAN_GAS_URL;
        }
        return "";
    }

    function isDataUrl(val) {
        return typeof val === "string" && /^\s*data:/i.test(val);
    }

    function normalizeDriveDirect(url) {
        if (!url) return "";
        const clean = String(url).trim();
        if (!clean || isDataUrl(clean)) return "";
        if (typeof toDirectGoogleDriveImageUrl === "function") {
            return toDirectGoogleDriveImageUrl(clean);
        }
        return clean;
    }

    function isQuestionImageBackedUpOnDrive(q) {
        if (!q) return false;
        return Boolean(
            (q.imageDriveFileId && String(q.imageDriveFileId).trim() !== "") ||
            (q.imageBackupUrl && !isDataUrl(q.imageBackupUrl) && String(q.imageBackupUrl).trim() !== "") ||
            (q.imageDrivePath && q.imageDriveFilename)
        );
    }

    function sanitizeDriveSegment(str, maxLen = 55) {
        if (!str) return "";
        return String(str)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .replace(/[^a-zA-Z0-9_\-. ]+/g, "_")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, maxLen) || "Chung";
    }

    function buildQuestionDescSlug(text, maxLen = 40) {
        if (!text) return "";
        const plain = String(text)
            .replace(/<[^>]+>/g, " ")
            .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " ")
            .replace(/\\[a-zA-Z]+/g, " ")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .replace(/[^a-zA-Z0-9\s]+/g, " ")
            .trim()
            .replace(/\s+/g, "_");
        return plain.slice(0, maxLen).replace(/^_+|_+$/g, "");
    }

    function buildQuestionImageDriveMeta(q, contextTitle = "", ext = "png") {
        const safeQ = q || {};
        const qNum = safeQ.matrixSeq || safeQ.origIndex || safeQ.id || "0";
        const qIdStr = String(safeQ.id || Date.now());
        const codePart = safeQ.matrixId ? sanitizeDriveSegment(safeQ.matrixId, 48) : sanitizeDriveSegment(`ID_${qIdStr}`, 32);
        const shortIdTail = qIdStr.slice(-6).replace(/[^a-zA-Z0-9]/g, "") || "0";
        const descSlug = buildQuestionDescSlug(safeQ.question || "", 38);

        const isQBankQuestion = Boolean(
            safeQ.matrixId || safeQ.folderId || safeQ.pendingExamId || safeQ.pendingKhoId ||
            String(qIdStr).startsWith("qb_")
        );

        const folderLabel = safeQ.folderName || safeQ.sourceExam || contextTitle || (isQBankQuestion ? "NganHangCauHoi" : "DeThi");
        const folderSlug = sanitizeDriveSegment(folderLabel, 55);
        const rootBase = isQBankQuestion
            ? "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_anh_ngan_hang_cau_hoi"
            : "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_anh_de_thi";

        const folderPath = `${rootBase}/${folderSlug}`;
        const safeExt = String(ext || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
        const filename = `Cau_${sanitizeDriveSegment(String(qNum), 12)}__${codePart}_${shortIdTail}${descSlug ? "__" + descSlug : ""}.${safeExt}`;

        const plainSnippet = String(safeQ.question || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
        const description = `Câu ${qNum} | Mã: ${safeQ.matrixId || qIdStr} | Thư mục/Đề: ${folderLabel} | Nội dung: ${plainSnippet}`;

        return {
            folderPath,
            filename,
            description,
            questionRef: `Câu ${qNum} (${safeQ.matrixId || qIdStr})`
        };
    }

    function compressImageSmartForBackup(file, maxDimension = 1600, quality = 0.86) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error("Không tìm thấy tệp ảnh!"));

            const readRaw = () => {
                const reader = new FileReader();
                reader.onload = () => {
                    const raw = String(reader.result || "");
                    const b64 = raw.includes("base64,") ? raw.split("base64,")[1] : raw;
                    const mime = file.type || "image/png";
                    const ext = mime.includes("png") ? "png" : (mime.includes("webp") ? "webp" : "jpg");
                    resolve({ base64: b64, mimeType: mime, ext });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            };

            if (file.size && file.size <= 750 * 1024) {
                readRaw();
                return;
            }

            const objUrl = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(file) : null;
            const img = new Image();
            img.onload = () => {
                try {
                    let w = img.naturalWidth || img.width || 1200;
                    let h = img.naturalHeight || img.height || 900;
                    if (w > maxDimension || h > maxDimension) {
                        if (w > h) { h = Math.round((h * maxDimension) / w); w = maxDimension; }
                        else { w = Math.round((w * maxDimension) / h); h = maxDimension; }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL("image/jpeg", quality);
                    const b64 = dataUrl.split(",")[1];
                    if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                    resolve({ base64: b64, mimeType: "image/jpeg", ext: "jpg" });
                } catch (err) {
                    if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                    readRaw();
                }
            };
            img.onerror = () => {
                if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                readRaw();
            };
            if (objUrl) img.src = objUrl;
            else readRaw();
        });
    }

    async function uploadToImgBBFast(base64Data, timeoutMs = 7000) {
        if (typeof IMGBB_API_KEY === "undefined" || !IMGBB_API_KEY || IMGBB_API_KEY.includes("THAY_")) {
            return "";
        }
        const controller = new AbortController();
        const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, timeoutMs);
        try {
            const fd = new FormData();
            fd.append("image", base64Data);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: fd,
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!res || !res.ok) return "";
            const json = await res.json().catch(() => null);
            if (json && json.success && json.data) {
                return json.data.display_url || json.data.url || "";
            }
        } catch (e) {
            clearTimeout(timer);
        }
        return "";
    }

    async function postBackupPayloadToGAS(gasUrl, requestBody, maxRetries = 4, timeoutMs = 45000) {
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, timeoutMs);
            try {
                const res = await fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                clearTimeout(timer);
                const json = await res.json().catch(() => null);
                if (json && json.status === "success" && (json.directUrl || json.fileUrl || json.fileId)) {
                    const directUrl = normalizeDriveDirect(json.directUrl || json.fileUrl || `https://lh3.googleusercontent.com/d/${json.fileId}`);
                    return {
                        fileId: json.fileId || "",
                        fileUrl: json.fileUrl || "",
                        directUrl: directUrl,
                        folderUrl: json.folderUrl || "",
                        folderPath: json.folderPath || requestBody.path || "",
                        filename: json.filename || requestBody.filename || ""
                    };
                }
                if (json && json.status === "busy") {
                    throw new Error("GAS đang xử lý lượt khác (busy)");
                }
                if (json && json.status === "ignored") {
                    const errIgn = new Error(json.message || "Máy chủ GAS chưa hỗ trợ tác vụ này (cần cập nhật Code.gs).");
                    errIgn.isUnsupportedAction = true;
                    throw errIgn;
                }
                throw new Error((json && json.message) || "Google Drive GAS không phản hồi thành công.");
            } catch (err) {
                clearTimeout(timer);
                lastErr = err;
                if (err && err.isUnsupportedAction) throw err;
                if (attempt < maxRetries) {
                    const backoffMs = 1200 + attempt * 900 + Math.floor(Math.random() * 800);
                    await new Promise(r => setTimeout(r, backoffMs));
                }
            }
        }
        throw lastErr || new Error("Không thể tải ảnh lên Google Drive.");
    }

    async function uploadImageToDriveBackupGAS(comp, driveMeta, maxRetries = 4, timeoutMs = 45000) {
        const gasUrl = getBackupGasUrl();
        if (!gasUrl) throw new Error("Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL trong app-config.js!");

        return postBackupPayloadToGAS(gasUrl, {
            action: "uploadQuestionImageBackup",
            path: driveMeta.folderPath,
            folderName: driveMeta.folderPath,
            filename: driveMeta.filename,
            mimeType: comp.mimeType || "image/png",
            base64: comp.base64,
            description: driveMeta.description || ""
        }, maxRetries, timeoutMs);
    }

    async function backupImageUrlViaGAS(imageUrl, driveMeta, maxRetries = 3, timeoutMs = 45000) {
        const gasUrl = getBackupGasUrl();
        if (!gasUrl) throw new Error("Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL trong app-config.js!");

        return postBackupPayloadToGAS(gasUrl, {
            action: "backupImageUrlToDrive",
            imageUrl: imageUrl,
            path: driveMeta.folderPath,
            folderName: driveMeta.folderPath,
            filename: driveMeta.filename,
            description: driveMeta.description || ""
        }, maxRetries, timeoutMs);
    }

    function applyBackupMetadataToQuestion(q, imgKey, primaryUrl, driveRes, driveMeta) {
        if (!q) return;
        if (primaryUrl && !isDataUrl(primaryUrl)) {
            q.imageUrl = primaryUrl;
        }
        if (imgKey) q.imageKey = imgKey;
        if (driveRes) {
            q.imageBackupUrl = driveRes.directUrl || q.imageBackupUrl || "";
            q.imageDriveFileId = driveRes.fileId || q.imageDriveFileId || "";
            q.imageDriveUrl = driveRes.fileUrl || q.imageDriveUrl || "";
            q.imageDriveFolderUrl = driveRes.folderUrl || q.imageDriveFolderUrl || "";
            q.imageDrivePath = driveRes.folderPath || (driveMeta && driveMeta.folderPath) || q.imageDrivePath || "";
            q.imageDriveFilename = driveRes.filename || (driveMeta && driveMeta.filename) || q.imageDriveFilename || "";
            q.imageBackedUpAt = Date.now();
        }
    }

    // HÀM UPLOAD 2 TẦNG CHÍNH: IMGBB NHANH + TỰ ĐỘNG SAO LƯU NGẦM BẮT BUỘC SANG GOOGLE DRIVE 5TB
    async function uploadDualQuestionImage(file, q, options = {}) {
        if (!file) throw new Error("Không tìm thấy file ảnh!");
        const onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
        const onBackupComplete = typeof options.onBackupComplete === "function" ? options.onBackupComplete : null;
        const onBackupFailed = typeof options.onBackupFailed === "function" ? options.onBackupFailed : null;
        const contextTitle = options.contextTitle || "";
        const imgKey = options.imgKey || (q && q.imageKey) || `img_q_${(q && q.id) || Date.now()}`;

        onStatus("⏳ Đang nén và chuẩn bị ảnh...");
        const comp = await compressImageSmartForBackup(file, 1600, 0.86);
        const driveMeta = buildQuestionImageDriveMeta(q, contextTitle, comp.ext);

        // Xóa dấu vết Drive cũ của bức ảnh trước (nếu có) để không báo nhầm đã sao lưu ảnh mới
        if (q) {
            q.imageBackupUrl = "";
            q.imageDriveFileId = "";
            q.imageDriveUrl = "";
            q.imageDriveFolderUrl = "";
            q.imageDrivePath = "";
            q.imageDriveFilename = "";
        }

        onStatus("⏳ Đang tải nhanh lên ImgBB...");
        const imgbbUrl = await uploadToImgBBFast(comp.base64, 7000);

        if (imgbbUrl && !isDataUrl(imgbbUrl)) {
            applyBackupMetadataToQuestion(q, imgKey, imgbbUrl, null, driveMeta);

            // BẮT BUỘC TỰ ĐỘNG SAO LƯU NGẦM SANG GOOGLE DRIVE 5TB (RETRY TỐI ĐA 4 LẦN)
            const gasUrl = getBackupGasUrl();
            if (gasUrl) {
                if (q) q._driveBackingUp = true;
                uploadImageToDriveBackupGAS(comp, driveMeta, 4, 45000).then(driveRes => {
                    if (q) q._driveBackingUp = false;
                    applyBackupMetadataToQuestion(q, imgKey, imgbbUrl, driveRes, driveMeta);
                    if (onBackupComplete) onBackupComplete(q, driveRes, driveMeta);
                }).catch(err => {
                    if (q) q._driveBackingUp = false;
                    console.warn("Sao lưu ngầm Drive chưa thành công sau các lần thử:", err);
                    if (onBackupFailed) onBackupFailed(q, err, driveMeta);
                });
            }

            return {
                primaryUrl: imgbbUrl,
                backupUrl: "",
                driveRes: null,
                driveMeta,
                source: "ImgBB"
            };
        }

        // NẾU IMGBB LỖI / CHẬM -> TẢI THẲNG LÊN GOOGLE DRIVE LÀM CẢ LINK CHÍNH LẪN DỰ PHÒNG
        onStatus("⚡ ImgBB bận, đang lưu thẳng lên Google Drive 5TB...");
        if (q) q._driveBackingUp = true;
        try {
            const driveRes = await uploadImageToDriveBackupGAS(comp, driveMeta, 4, 45000);
            if (q) q._driveBackingUp = false;
            applyBackupMetadataToQuestion(q, imgKey, driveRes.directUrl, driveRes, driveMeta);
            if (onBackupComplete) onBackupComplete(q, driveRes, driveMeta);

            return {
                primaryUrl: driveRes.directUrl,
                backupUrl: driveRes.directUrl,
                driveRes,
                driveMeta,
                source: "Google Drive"
            };
        } catch (err) {
            if (q) q._driveBackingUp = false;
            throw err;
        }
    }

    async function readUrlAsBase64ClientSide(currentUrl) {
        // Cách 1: Thử fetch Blob trực tiếp (giữ nguyên định dạng PNG/JPG gốc)
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 12000);
            const res = await fetch(currentUrl, { mode: "cors", signal: controller.signal });
            clearTimeout(timer);
            if (res && res.ok) {
                const blob = await res.blob();
                if (blob && blob.size > 100 && (!blob.type || !blob.type.includes("text/html"))) {
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const raw = String(reader.result || "");
                            resolve(raw.includes("base64,") ? raw.split("base64,")[1] : raw);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
                    const ext = mime.includes("png") ? "png" : (mime.includes("webp") ? "webp" : "jpg");
                    return { base64, mimeType: mime, ext };
                }
            }
        } catch (e) {}

        // Cách 2: Thử qua <img crossOrigin="anonymous"> -> Canvas
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            const timer = setTimeout(() => reject(new Error("Quá thời gian đọc ảnh CORS")), 12000);
            img.onload = () => {
                clearTimeout(timer);
                try {
                    const w = img.naturalWidth || img.width || 800;
                    const h = img.naturalHeight || img.height || 600;
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                    resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg", ext: "jpg" });
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => {
                clearTimeout(timer);
                reject(new Error("Trình duyệt bị chặn CORS khi đọc ảnh nguồn."));
            };
            img.src = currentUrl;
        });
    }

    // SAO LƯU TỪ LINK ẢNH HIỆN CÓ (IMGBB / WEB / DRIVE CŨ) SANG GOOGLE DRIVE 5TB (CHỐNG CORS 100%)
    async function backupExistingImageToDrive(q, contextTitle = "") {
        if (!q) throw new Error("Không tìm thấy dữ liệu câu hỏi!");
        const currentUrl = (typeof resolveQbankImageUrl === "function" && typeof qbankState !== "undefined")
            ? resolveQbankImageUrl(q, qbankState.imagesMap)
            : (q.imageUrl || "");

        if (!currentUrl || isDataUrl(currentUrl)) {
            throw new Error("Câu này chưa có link ảnh hợp lệ để sao lưu!");
        }

        const driveMeta = buildQuestionImageDriveMeta(q, contextTitle, "png");
        let driveRes = null;

        // Tầng 1: Đọc ảnh từ client (nếu server ảnh hỗ trợ CORS) -> uploadQuestionImageBackup
        try {
            const comp = await readUrlAsBase64ClientSide(currentUrl);
            const metaWithExt = buildQuestionImageDriveMeta(q, contextTitle, comp.ext);
            driveRes = await uploadImageToDriveBackupGAS(comp, metaWithExt, 3, 45000);
            applyBackupMetadataToQuestion(q, q.imageKey || `img_q_${q.id}`, currentUrl, driveRes, metaWithExt);
            return driveRes;
        } catch (clientErr) {
            // Tầng 2: Nhờ máy chủ Google Apps Script tự tải URL ảnh về Drive 5TB (không bị CORS trình duyệt)
            try {
                driveRes = await backupImageUrlViaGAS(currentUrl, driveMeta, 3, 45000);
                applyBackupMetadataToQuestion(q, q.imageKey || `img_q_${q.id}`, currentUrl, driveRes, driveMeta);
                return driveRes;
            } catch (gasErr) {
                if (gasErr && gasErr.isUnsupportedAction) {
                    throw new Error("Ảnh bị chặn CORS từ trình duyệt và Code.gs trên Google Apps Script chưa cập nhật hàm 'backupImageUrlToDrive'. Vui lòng deploy lại bản Code.gs mới!");
                }
                throw gasErr;
            }
        }
    }

    // TRUY CẬP GOOGLE DRIVE QUA GAS ĐỂ LẤY LẠI ẢNH (PHỤC VỤ NÚT 🔄 TẢI LẠI ẢNH)
    async function fetchDriveImageViaGAS(q) {
        const gasUrl = getBackupGasUrl();
        if (!gasUrl) throw new Error("Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL!");

        const fileId = (q && q.imageDriveFileId) ||
            (typeof extractGoogleDriveFileId === "function" ? extractGoogleDriveFileId((q && (q.imageBackupUrl || q.imageDriveUrl || q.imageUrl)) || "") : "");
        const folderPath = (q && q.imageDrivePath) || "";
        const filename = (q && q.imageDriveFilename) || "";

        if (!fileId && !(folderPath && filename)) {
            return null;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 25000);
        try {
            const res = await fetch(gasUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "fetchDriveImageBase64",
                    fileId: fileId,
                    path: folderPath,
                    filename: filename
                }),
                signal: controller.signal
            });
            clearTimeout(timer);
            const json = await res.json().catch(() => null);
            if (json && json.status === "success") {
                return json;
            }
            return null;
        } catch (e) {
            clearTimeout(timer);
            return null;
        }
    }

    function buildSmartImageFallbackList(q, currentSrc = "") {
        const urls = [];
        const addUrl = (u) => {
            if (!u || isDataUrl(u)) return;
            const clean = String(u).trim();
            if (clean && clean !== currentSrc && !urls.includes(clean)) urls.push(clean);
        };

        if (
Citations

https://github.com/jays-visionAI/visionchain
Model 1:17 AM
ThinkingThoughts
Expand to view model thoughts

Dưới đây là **toàn bộ phần tiếp theo đầy đủ 100%** bắt đầu từ file `qbank-image-backup.js` (giữ nguyên phần đã viết ở trên và viết hoàn chỉnh đến hết file) cùng toàn bộ các file còn lại (`qbank-tree-questions.js`, `qbank-core-sync.js`, `qbank-mid-editor.js`, `Code.gs`) và kết quả kiểm tra giả lập toàn web.

---

#### 2. File `qbank-image-backup.js` (100% đầy đủ — ghép nối y nguyên phần trên và viết hết file)

```javascript
// =========================================================
// FILE: qbank-image-backup.js
// HỆ THỐNG LƯU ẢNH 2 TẦNG BẤT TỬ (IMGBB NHANH + SAO LƯU NGẦM BẮT BUỘC GOOGLE DRIVE 5TB)
// - ƯU TIÊN UPLOAD IMGBB LÀM LINK CHÍNH NHANH & TỰ ĐỘNG SAO LƯU NGẦM BẮT BUỘC VÀO GOOGLE DRIVE (RETRY + BACKOFF)
// - SAO LƯU ẢNH CŨ ĐA TẦNG CHỐNG LỖI CORS (FETCH BLOB -> CANVAS -> TẢI TRỰC TIẾP TỪ MÁY CHỦ GAS)
// - ĐẶT TÊN FILE TRÙNG SỐ CÂU + MÃ ID + MÔ TẢ CÂU & GẮN NÚT TRẠNG THÁI "✅ Đã lưu Drive"
// =========================================================

(function initQbankImageBackupModule() {
    if (typeof window === "undefined") return;

    function injectQbankAutoDriveStyles() {
        const styleId = "qbank-autosave-drive-styles";
        if (document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            .btn-qbank-autosave-drive {
                background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%) !important;
                color: #ffffff !important;
                border: 1.2px solid #7dd3fc !important;
                box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
                transition: all 0.16s ease !important;
            }
            .btn-qbank-autosave-drive.is-running {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
                border-color: #fde68a !important;
                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35) !important;
            }
            .btn-qbank-autosave-drive.is-all-saved {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
                border-color: #6ee7b7 !important;
                box-shadow: 0 2px 6px rgba(16, 185, 129, 0.28) !important;
            }
            .btn-drive-saved-status {
                background: #dcfce7 !important;
                color: #15803d !important;
                border: 1px solid #4ade80 !important;
                font-weight: 800 !important;
                text-decoration: none !important;
                cursor: pointer !important;
            }
            .btn-drive-saved-status:hover {
                background: #bbf7d0 !important;
                color: #14532d !important;
                border-color: #22c55e !important;
            }
            .btn-drive-saving-status {
                background: #e0f2fe !important;
                color: #0369a1 !important;
                border: 1px solid #7dd3fc !important;
                font-weight: 800 !important;
                cursor: wait !important;
            }
        `;
        if (document.head) document.head.appendChild(style);
        else document.addEventListener("DOMContentLoaded", () => {
            if (document.head && !document.getElementById(styleId)) document.head.appendChild(style);
        });
    }
    injectQbankAutoDriveStyles();

    function getBackupGasUrl() {
        if (typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
            return GOOGLE_DRIVE_UPLOAD_GAS_URL;
        }
        if (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL && !GOOGLE_DRIVE_TULUAN_GAS_URL.includes("DÁN_URL")) {
            return GOOGLE_DRIVE_TULUAN_GAS_URL;
        }
        return "";
    }

    function isDataUrl(val) {
        return typeof val === "string" && /^\s*data:/i.test(val);
    }

    function normalizeDriveDirect(url) {
        if (!url) return "";
        const clean = String(url).trim();
        if (!clean || isDataUrl(clean)) return "";
        if (typeof toDirectGoogleDriveImageUrl === "function") {
            return toDirectGoogleDriveImageUrl(clean);
        }
        return clean;
    }

    function isQuestionImageBackedUpOnDrive(q) {
        if (!q) return false;
        return Boolean(
            (q.imageDriveFileId && String(q.imageDriveFileId).trim() !== "") ||
            (q.imageBackupUrl && !isDataUrl(q.imageBackupUrl) && String(q.imageBackupUrl).trim() !== "") ||
            (q.imageDrivePath && q.imageDriveFilename)
        );
    }

    function sanitizeDriveSegment(str, maxLen = 55) {
        if (!str) return "";
        return String(str)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .replace(/[^a-zA-Z0-9_\-. ]+/g, "_")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, maxLen) || "Chung";
    }

    function buildQuestionDescSlug(text, maxLen = 40) {
        if (!text) return "";
        const plain = String(text)
            .replace(/<[^>]+>/g, " ")
            .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " ")
            .replace(/\\[a-zA-Z]+/g, " ")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .replace(/[^a-zA-Z0-9\s]+/g, " ")
            .trim()
            .replace(/\s+/g, "_");
        return plain.slice(0, maxLen).replace(/^_+|_+$/g, "");
    }

    function buildQuestionImageDriveMeta(q, contextTitle = "", ext = "png") {
        const safeQ = q || {};
        const qNum = safeQ.matrixSeq || safeQ.origIndex || safeQ.id || "0";
        const qIdStr = String(safeQ.id || Date.now());
        const codePart = safeQ.matrixId ? sanitizeDriveSegment(safeQ.matrixId, 48) : sanitizeDriveSegment(`ID_${qIdStr}`, 32);
        const shortIdTail = qIdStr.slice(-6).replace(/[^a-zA-Z0-9]/g, "") || "0";
        const descSlug = buildQuestionDescSlug(safeQ.question || "", 38);

        const isQBankQuestion = Boolean(
            safeQ.matrixId || safeQ.folderId || safeQ.pendingExamId || safeQ.pendingKhoId ||
            String(qIdStr).startsWith("qb_")
        );

        const folderLabel = safeQ.folderName || safeQ.sourceExam || contextTitle || (isQBankQuestion ? "NganHangCauHoi" : "DeThi");
        const folderSlug = sanitizeDriveSegment(folderLabel, 55);
        const rootBase = isQBankQuestion
            ? "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_anh_ngan_hang_cau_hoi"
            : "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_anh_de_thi";

        const folderPath = `${rootBase}/${folderSlug}`;
        const safeExt = String(ext || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
        const filename = `Cau_${sanitizeDriveSegment(String(qNum), 12)}__${codePart}_${shortIdTail}${descSlug ? "__" + descSlug : ""}.${safeExt}`;

        const plainSnippet = String(safeQ.question || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
        const description = `Câu ${qNum} | Mã: ${safeQ.matrixId || qIdStr} | Thư mục/Đề: ${folderLabel} | Nội dung: ${plainSnippet}`;

        return {
            folderPath,
            filename,
            description,
            questionRef: `Câu ${qNum} (${safeQ.matrixId || qIdStr})`
        };
    }

    function compressImageSmartForBackup(file, maxDimension = 1600, quality = 0.86) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error("Không tìm thấy tệp ảnh!"));

            const readRaw = () => {
                const reader = new FileReader();
                reader.onload = () => {
                    const raw = String(reader.result || "");
                    const b64 = raw.includes("base64,") ? raw.split("base64,")[1] : raw;
                    const mime = file.type || "image/png";
                    const ext = mime.includes("png") ? "png" : (mime.includes("webp") ? "webp" : "jpg");
                    resolve({ base64: b64, mimeType: mime, ext });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            };

            if (file.size && file.size <= 750 * 1024) {
                readRaw();
                return;
            }

            const objUrl = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(file) : null;
            const img = new Image();
            img.onload = () => {
                try {
                    let w = img.naturalWidth || img.width || 1200;
                    let h = img.naturalHeight || img.height || 900;
                    if (w > maxDimension || h > maxDimension) {
                        if (w > h) { h = Math.round((h * maxDimension) / w); w = maxDimension; }
                        else { w = Math.round((w * maxDimension) / h); h = maxDimension; }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL("image/jpeg", quality);
                    const b64 = dataUrl.split(",")[1];
                    if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                    resolve({ base64: b64, mimeType: "image/jpeg", ext: "jpg" });
                } catch (err) {
                    if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                    readRaw();
                }
            };
            img.onerror = () => {
                if (objUrl) try { window.URL.revokeObjectURL(objUrl); } catch (e) {}
                readRaw();
            };
            if (objUrl) img.src = objUrl;
            else readRaw();
        });
    }

    async function uploadToImgBBFast(base64Data, timeoutMs = 7000) {
        if (typeof IMGBB_API_KEY === "undefined" || !IMGBB_API_KEY || IMGBB_API_KEY.includes("THAY_")) {
            return "";
        }
        const controller = new AbortController();
        const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, timeoutMs);
        try {
            const fd = new FormData();
            fd.append("image", base64Data);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: fd,
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!res || !res.ok) return "";
            const json = await res.json().catch(() => null);
            if (json && json.success && json.data) {
                return json.data.display_url || json.data.url || "";
            }
        } catch (e) {
            clearTimeout(timer);
        }
        return "";
    }

    async function postBackupPayloadToGAS(gasUrl, requestBody, maxRetries = 4, timeoutMs = 45000) {
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, timeoutMs);
            try {
                const res = await fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                clearTimeout(timer);
                const json = await res.json().catch(() => null);
                if (json && json.status === "success" && (json.directUrl || json.fileUrl || json.fileId)) {
                    const directUrl = normalizeDriveDirect(json.directUrl || json.fileUrl || `https://lh3.googleusercontent.com/d/${json.fileId}`);
                    return {
                        fileId: json.fileId || "",
                        fileUrl: json.fileUrl || "",
                        directUrl: directUrl,
                        folderUrl: json.folderUrl || "",
                        folderPath: json.folderPath || requestBody.path || "",
                        filename: json.filename || requestBody.filename || ""
                    };
                }
                if (json && json.status === "busy") {
                    throw new Error("GAS đang xử lý lượt khác (busy)");
                }
                if (json && json.status === "ignored") {
                    const errIgn = new Error(json.message || "Máy chủ GAS chưa hỗ trợ tác vụ này (cần cập nhật Code.gs).");
                    errIgn.isUnsupportedAction = true;
                    throw errIgn;
                }
                throw new Error((json && json.message) || "Google Drive GAS không phản hồi thành công.");
            } catch (err) {
                clearTimeout(timer);
                lastErr = err;
                if (err && err.isUnsupportedAction) throw err;
                if (attempt < maxRetries) {
                    const backoffMs = 1200 + attempt * 900 + Math.floor(Math.random() * 800);
                    await new Promise(r => setTimeout(r, backoffMs));
                }
            }
        }
        throw lastErr || new Error("Không thể tải ảnh lên Google Drive.");
    }

    async function uploadImageToDriveBackupGAS(comp, driveMeta, maxRetries = 4, timeoutMs = 45000) {
        const gasUrl = getBackupGasUrl();
        if (!gasUrl) throw new Error("Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL trong app-config.js!");

        return postBackupPayloadToGAS(gasUrl, {
            action: "uploadQuestionImageBackup",
            path: driveMeta.folderPath,
            folderName: driveMeta.folderPath,
            filename: driveMeta.filename,
            mimeType: comp.mimeType || "image/png",
            base64: comp.base64,
            description: driveMeta.description || ""
        }, maxRetries, timeoutMs);
    }

    async function backupImageUrlViaGAS(imageUrl, driveMeta, maxRetries = 3, timeoutMs = 45000) {
        const gasUrl = getBackupGasUrl();
        if (!gasUrl) throw new Error("Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL trong app-config.js!");

        return postBackupPayloadToGAS(gasUrl, {
            action: "backupImageUrlToDrive",
            imageUrl: imageUrl,
            path: driveMeta.folderPath,
            folderName: driveMeta.folderPath,
            filename: driveMeta.filename,
            description: driveMeta.description || ""
        }, maxRetries, timeoutMs);
    }

    function applyBackupMetadataToQuestion(q, imgKey, primaryUrl, driveRes, driveMeta) {
        if (!q) return;
        if (primaryUrl && !isDataUrl(primaryUrl)) {
            q.imageUrl = primaryUrl;
        }
        if (imgKey) q.imageKey = imgKey;
        if (driveRes) {
            q.imageBackupUrl = driveRes.directUrl || q.imageBackupUrl || "";
            q.imageDriveFileId = driveRes.fileId || q.imageDriveFileId || "";
            q.imageDriveUrl = driveRes.fileUrl || q.imageDriveUrl || "";
            q.imageDriveFolderUrl = driveRes.folderUrl || q.imageDriveFolderUrl || "";
            q.imageDrivePath = driveRes.folderPath || (driveMeta && driveMeta.folderPath) || q.imageDrivePath || "";
            q.imageDriveFilename = driveRes.filename || (driveMeta && driveMeta.filename) || q.imageDriveFilename || "";
            q.imageBackedUpAt = Date.now();
        }
    }

    // HÀM UPLOAD 2 TẦNG CHÍNH: IMGBB NHANH + TỰ ĐỘNG SAO LƯU NGẦM BẮT BUỘC SANG GOOGLE DRIVE 5TB
    async function uploadDualQuestionImage(file, q, options = {}) {
        if (!file) throw new Error("Không tìm thấy file ảnh!");
        const onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
        const onBackupComplete = typeof options.onBackupComplete === "function" ? options.onBackupComplete : null;
        const onBackupFailed = typeof options.onBackupFailed === "function" ? options.onBackupFailed : null;
        const contextTitle = options.contextTitle || "";
        const imgKey = options.imgKey || (q && q.imageKey) || `img_q_${(q && q.id) || Date.now()}`;

        onStatus("⏳ Đang nén và chuẩn bị ảnh...");
        const comp = await compressImageSmartForBackup(file, 1600, 0.86);
        const driveMeta = buildQuestionImageDriveMeta(q, contextTitle, comp.ext);

        // Xóa dấu vết Drive cũ của bức ảnh trước (nếu có) để không báo nhầm đã sao lưu ảnh mới
        if (q) {
            q.imageBackupUrl = "";
            q.imageDriveFileId = "";
            q.imageDriveUrl = "";
            q.imageDriveFolderUrl = "";
            q.imageDrivePath = "";
            q.imageDriveFilename = "";
        }

        onStatus("⏳ Đang tải nhanh lên ImgBB...");
        const imgbbUrl = await uploadToImgBBFast(comp.base64, 7000);

        if (imgbbUrl && !isDataUrl(imgbbUrl)) {
            applyBackupMetadataToQuestion(q, imgKey, imgbbUrl, null, driveMeta);

            // BẮT BUỘC TỰ ĐỘNG SAO LƯU NGẦM SANG GOOGLE DRIVE 5TB (RETRY TỐI ĐA 4 LẦN)
            const gasUrl = getBackupGasUrl();
            if (gasUrl) {
                if (q) q._driveBackingUp = true;
                uploadImageToDriveBackupGAS(comp, driveMeta, 4, 45000).then(driveRes => {
                    if (q) q._driveBackingUp = false;
                    applyBackupMetadataToQuestion(q, imgKey, imgbbUrl, driveRes, driveMeta);
                    if (onBackupComplete) onBackupComplete(q, driveRes, driveMeta);
                }).catch(err => {
                    if (q) q._driveBackingUp = false;
                    console.warn("Sao lưu ngầm Drive chưa thành công sau các lần thử:", err);
                    if (onBackupFailed) onBackupFailed(q, err, driveMeta);
                });
            }

            return {
                primaryUrl: imgbbUrl,
                backupUrl: "",
                driveRes: null,
                driveMeta,
                source: "ImgBB"
            };
        }

        // NẾU IMGBB LỖI / CHẬM -> TẢI THẲNG LÊN GOOGLE DRIVE LÀM CẢ LINK CHÍNH LẪN DỰ PHÒNG
        onStatus("⚡ ImgBB bận, đang lưu thẳng lên Google Drive 5TB...");
        if (q) q._driveBackingUp = true;
        try {
            const driveRes = await uploadImageToDriveBackupGAS(comp, driveMeta, 4, 45000);
            if (q) q._driveBackingUp = false;
            applyBackupMetadataToQuestion(q, imgKey, driveRes.directUrl, driveRes, driveMeta);
            if (onBackupComplete) onBackupComplete(q, driveRes, driveMeta);

            return {
                primaryUrl: driveRes.directUrl,
                backupUrl: driveRes.directUrl,
                driveRes,
                driveMeta,
                source: "Google Drive"
            };
        } catch (err) {
            if (q) q._driveBackingUp = false;
            throw err;
        }
    }

    async function readUrlAsBase64ClientSide(currentUrl) {
        // Cách 1: Thử fetch Blob trực tiếp (giữ nguyên định dạng PNG/JPG gốc)
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 12000);
            const res = await fetch(currentUrl, { mode: "cors", signal: controller.signal });
            clearTimeout(timer);
            if (res && res.ok) {
                const blob = await res.blob();
                if (blob && blob.size > 100 && (!blob.type || !blob.type.includes("text/html"))) {
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const raw = String(reader.result || "");
                            resolve(raw.includes("base64,") ? raw.split("base64,")[1] : raw);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
                    const ext = mime.includes("png") ? "png" : (mime.includes("webp") ? "webp" : "jpg");
                    return { base64, mimeType: mime, ext };
                }
            }
        } catch (e) {}

        // Cách 2: Thử qua <img crossOrigin="anonymous"> -> Canvas
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            const timer = setTimeout(() => reject(new Error("Quá thời gian đọc ảnh CORS")), 12000);
            img.onload = () => {
                clearTimeout(timer);
                try {
                    const w = img.naturalWidth || img.width || 800;
                    const h = img.naturalHeight || img.height || 600;
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                    resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg", ext: "jpg" });
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => {
                clearTimeout(timer);
                reject(new Error("Trình duyệt bị chặn CORS khi đọc ảnh nguồn."));
            };
            img.src = currentUrl;
        });
    }

    // SAO LƯU TỪ LINK ẢNH HIỆN CÓ (IMGBB / WEB / DRIVE CŨ) SANG GOOGLE DRIVE 5TB (CHỐNG CORS 100%)
    async function backupExistingImageToDrive(q, contextTitle = "") {
        if (!q) throw new Error("Không tìm thấy dữ liệu câu hỏi!");
        const currentUrl = (typeof resolveQbankImageUrl === "function" && typeof qbankState !== "undefined")
            ? resolveQbankImageUrl(q, qbankState.imagesMap)
            : (q.imageUrl || "");

        if (!currentUrl || isDataUrl(currentUrl)) {
            throw new Error("Câu này chưa có link ảnh hợp lệ để sao lưu!");
        }

        const driveMeta = buildQuestionImageDriveMeta(q, contextTitle, "png");
        let driveRes = null;

        // Tầng 1: Đọc ảnh từ client (nếu server ảnh hỗ trợ CORS) -> uploadQuestionImageBackup
        try {
            const comp = await readUrlAsBase64ClientSide(currentUrl);
            const metaWithExt = buildQuestionImageDriveMeta(q, contextTitle, comp.ext);
            driveRes = await uploadImageToDriveBackupGAS(comp, metaWithExt, 3, 45000);
            applyBackupMetadataToQuestion(q, q.imageKey || `img_q_${q.id}`, currentUrl, driveRes, metaWithExt);
            return driveRes;
        } catch (clientErr) {
            // Tầng 2: Nhờ máy chủ Google Apps Script tự tải URL ảnh về Drive 5TB (không bị CORS trình duyệt)
            try {
                driveRes = await backupImageUrlViaGAS(currentUrl, driveMeta, 3, 45000);
                applyBackupMetadataToQuestion(q, q.imageKey || `img_q_${q.id}`, currentUrl, driveRes, driveMeta);
                return driveRes;
            } catch (gasErr) {
                if (gasErr && gasErr.isUnsupportedAction) {
                    throw new Error("Ảnh bị chặn CORS từ trình duyệt và Code.gs trên Google Apps Script chưa cập nhật hàm 'backupImageUrlToDrive'. Vui lòng deploy lại bản Code.gs mới!");
                }
                throw gasErr;
            }
        }
    }

    // TRUY CẬP GOOGLE DRIVE QUA GAS ĐỂ LẤY LẠI ẢNH (PHỤC VỤ NÚT 🔄 TẢI LẠI ẢNH)
    async function fetchDriveImageViaGAS(q) {
        const gasUrl = getBackupGasUrl();
        if (!gasUrl) throw new Error("Chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL!");

        const fileId = (q && q.imageDriveFileId) ||
            (typeof extractGoogleDriveFileId === "function" ? extractGoogleDriveFileId((q && (q.imageBackupUrl || q.imageDriveUrl || q.imageUrl)) || "") : "");
        const folderPath = (q && q.imageDrivePath) || "";
        const filename = (q && q.imageDriveFilename) || "";

        if (!fileId && !(folderPath && filename)) {
            return null;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 25000);
        try {
            const res = await fetch(gasUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "fetchDriveImageBase64",
                    fileId: fileId,
                    path: folderPath,
                    filename: filename
                }),
                signal: controller.signal
            });
            clearTimeout(timer);
            const json = await res.json().catch(() => null);
            if (json && json.status === "success") {
                return json;
            }
            return null;
        } catch (e) {
            clearTimeout(timer);
            return null;
        }
    }

    function buildSmartImageFallbackList(q, currentSrc = "") {
        const urls = [];
        const addUrl = (u) => {
            if (!u || isDataUrl(u)) return;
            const clean = String(u).trim();
            if (clean && clean !== currentSrc && !urls.includes(clean)) urls.push(clean);
        };

        if (q) {
            addUrl(q.imageBackupUrl);
            if (q.imageDriveFileId) {
                addUrl(`https://lh3.googleusercontent.com/d/${q.imageDriveFileId}`);
                addUrl(`https://drive.google.com/thumbnail?id=${q.imageDriveFileId}&sz=w1400`);
                addUrl(`https://lh3.googleusercontent.com/u/0/d/${q.imageDriveFileId}`);
                addUrl(`https://drive.google.com/uc?export=view&id=${q.imageDriveFileId}`);
            }
            if (typeof getGoogleDriveFallbackUrls === "function") {
                getGoogleDriveFallbackUrls(q.imageBackupUrl || q.imageDriveUrl || q.imageUrl || "").forEach(addUrl);
            }
            addUrl(q.imageUrl);
        } else if (typeof getGoogleDriveFallbackUrls === "function") {
            getGoogleDriveFallbackUrls(currentSrc).forEach(addUrl);
        }
        return urls;
    }

    // XỬ LÝ TỰ ĐỘNG PHỤC HỒI KHI THẺ <IMG> GẶP LỖI
    async function handleSmartQuestionImgError(imgEl, qObj, opts = {}) {
        if (!imgEl) return;
        const currentSrc = imgEl.src || "";
        if (isDataUrl(currentSrc)) return; // Data URL đã là luồng trực tiếp cuối cùng

        const candidates = buildSmartImageFallbackList(qObj, currentSrc);
        const triedIdx = parseInt(imgEl.dataset.smartTryIdx || "0", 10);

        if (triedIdx < candidates.length) {
            imgEl.dataset.smartTryIdx = String(triedIdx + 1);
            imgEl.src = candidates[triedIdx];
            return;
        }

        // TẦNG CUỐI: TỰ ĐỘNG ĐỌC QUA GOOGLE APPS SCRIPT NẾU CÓ FILE ID HOẶC ĐƯỜNG DẪN DRIVE
        const hasDriveRef = Boolean(qObj && (qObj.imageDriveFileId || (qObj.imageDrivePath && qObj.imageDriveFilename) ||
            (typeof extractGoogleDriveFileId === "function" && extractGoogleDriveFileId(qObj.imageBackupUrl || qObj.imageUrl || ""))));

        if (hasDriveRef && imgEl.dataset.gasTried !== "1") {
            imgEl.dataset.gasTried = "1";
            try {
                const gasData = await fetchDriveImageViaGAS(qObj);
                if (gasData && gasData.dataUrl) {
                    imgEl.src = gasData.dataUrl;
                    imgEl.style.display = "inline-block";
                    return;
                }
            } catch (e) {}
        }

        // NẾU MỌI TẦNG ĐỀU LỖI: HIỂN THỊ HỘP PHỤC HỒI KÈM NÚT TẢI LẠI ẢNH (KHÔNG ẨN MẤT IM LẶNG)
        imgEl.style.display = "none";
        const parent = imgEl.parentElement;
        if (parent && !parent.querySelector(".img-recovery-box")) {
            const box = document.createElement("div");
            box.className = "img-recovery-box";
            box.style.cssText = "padding:8px 10px; background:#fff1f2; border:1.5px dashed #fda4af; border-radius:8px; color:#be123c; font-size:11.5px; font-weight:700; text-align:center; margin:4px 0; display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;";
            const qIdArg = String((qObj && qObj.id) || opts.qId || "").replace(/'/g, "\\'");
            const reloadFn = opts.reloadFnName || "reloadQBankImg";
            const driveLink = (qObj && (qObj.imageDriveUrl || qObj.imageDriveFolderUrl)) || "";
            box.innerHTML = `
                <span>⚠️ Ảnh chưa tải được từ link hiện tại.</span>
                <button type="button" onclick="${reloadFn}('${qIdArg}')" style="background:#0284c7; color:#fff; border:none; border-radius:6px; padding:4px 9px; font-size:11px; font-weight:800; cursor:pointer;">🔄 Tải lại ảnh</button>
                ${driveLink ? `<a href="${String(driveLink).replace(/"/g, "&quot;")}" target="_blank" style="background:#16a34a; color:#fff; text-decoration:none; border-radius:6px; padding:4px 9px; font-size:11px; font-weight:800;">☁️ Mở Drive</a>` : ""}
            `;
            parent.appendChild(box);
        }
    }

    // HÀM CHUNG CHO NÚT "🔄 TẢI LẠI ẢNH"
    async function reloadQuestionImageAction(qObj, opts = {}) {
        if (!qObj) return { ok: false, message: "Không tìm thấy câu hỏi!" };
        const onStatus = typeof opts.onStatus === "function" ? opts.onStatus : () => {};
        const onSuccess = typeof opts.onSuccess === "function" ? opts.onSuccess : () => {};

        onStatus("⏳ Đang kết nối Google Drive lấy lại ảnh...", "#0284c7");

        // 1. Thử đọc qua GAS từ Drive trước (nếu có Drive FileId hoặc Path + Filename)
        const gasRes = await fetchDriveImageViaGAS(qObj);
        if (gasRes && (gasRes.dataUrl || gasRes.directUrl)) {
            const freshDirect = normalizeDriveDirect(gasRes.directUrl || gasRes.fileUrl || "");
            if (freshDirect) {
                qObj.imageBackupUrl = freshDirect;
                if (!qObj.imageUrl || opts.replacePrimaryWithDrive) {
                    qObj.imageUrl = freshDirect;
                }
            }
            if (gasRes.fileId) qObj.imageDriveFileId = gasRes.fileId;
            if (gasRes.fileUrl) qObj.imageDriveUrl = gasRes.fileUrl;
            if (gasRes.folderUrl) qObj.imageDriveFolderUrl = gasRes.folderUrl;

            onSuccess({
                displaySrc: gasRes.dataUrl || freshDirect,
                directUrl: freshDirect,
                fromDrive: true,
                gasRes
            });
            onStatus("✅ Đã tải lại từ Google Drive!", "#16a34a");
            return { ok: true, fromDrive: true, displaySrc: gasRes.dataUrl || freshDirect, directUrl: freshDirect };
        }

        // 2. Nếu chưa từng lưu Drive, thử tải lại link hiện tại (bỏ qua cache trình duyệt)
        const curUrl = qObj.imageUrl || qObj.imageBackupUrl || "";
        if (!curUrl) {
            onStatus("⚠️ Câu này chưa có link ảnh!", "#d97706");
            return { ok: false, message: "Câu hỏi chưa có ảnh hoặc bản sao lưu Drive!" };
        }

        const sep = curUrl.includes("?") ? "&" : "?";
        const bustUrl = `${curUrl}${sep}_r=${Date.now()}`;
        const loadedOk = await new Promise(resolve => {
            const testImg = new Image();
            testImg.onload = () => resolve(true);
            testImg.onerror = () => resolve(false);
            testImg.src = bustUrl;
        });

        if (loadedOk) {
            onSuccess({ displaySrc: bustUrl, directUrl: curUrl, fromDrive: false });
            onStatus("✅ Đã làm mới ảnh!", "#16a34a");
            return { ok: true, fromDrive: false, displaySrc: bustUrl, directUrl: curUrl };
        }

        onStatus("❌ Link ảnh cũ đã hỏng & chưa có bản Drive!", "#dc2626");
        return {
            ok: false,
            message: "Link ảnh ngoài (ImgBB cũ) đã bị xóa trên máy chủ nguồn và câu này trước đó chưa được sao lưu sang Google Drive.\n\n👉 Vui lòng bấm Ctrl+V dán lại ảnh vào câu này — từ giờ ảnh sẽ tự động sao lưu vĩnh viễn vào Google Drive 5TB!"
        };
    }

    window.getBackupGasUrl = getBackupGasUrl;
    window.isQuestionImageBackedUpOnDrive = isQuestionImageBackedUpOnDrive;
    window.applyBackupMetadataToQuestion = applyBackupMetadataToQuestion;
    window.buildQuestionImageDriveMeta = buildQuestionImageDriveMeta;
    window.compressImageSmartForBackup = compressImageSmartForBackup;
    window.uploadDualQuestionImage = uploadDualQuestionImage;
    window.backupExistingImageToDrive = backupExistingImageToDrive;
    window.fetchDriveImageViaGAS = fetchDriveImageViaGAS;
    window.handleSmartQuestionImgError = handleSmartQuestionImgError;
    window.reloadQuestionImageAction = reloadQuestionImageAction;
})();
