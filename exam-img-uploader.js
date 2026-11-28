// =========================================================
// FILE: exam-img-uploader.js
// BẢN FIX TRIỆT ĐỂ MẤT ẢNH: UPLOAD 2 TẦNG (IMGBB + NGẦM DRIVE),
// FALLBACK ĐA TẦNG & NÚT TẢI LẠI ẢNH TRỰC TIẾP TỪ DRIVE
// =========================================================

let imageSyncChannel = null;

(function injectAdminUploaderStyles() {
    const styleId = "admin-img-uploader-custom-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .btn-admin-del-img {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: #ffffff !important;
            border: none; padding: 6px 12px; border-radius: 8px;
            font-weight: 800; font-size: 0.82rem; cursor: pointer;
            display: inline-flex; align-items: center; gap: 4px;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
            transition: transform 0.15s ease, filter 0.15s ease; user-select: none;
        }
        .btn-admin-del-img:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-admin-del-img:active { transform: translateY(2px) scale(0.96); }
        .admin-badge-has-img {
            background: #fef2f2; color: #dc2626; border: 1.5px solid #f87171;
            border-radius: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: 900;
            display: inline-flex; align-items: center; gap: 5px;
            box-shadow: 0 1px 4px rgba(239, 68, 68, 0.18); letter-spacing: -0.2px; user-select: none;
        }
        .quiz-img-wrapper {
            position: relative; display: inline-block; max-width: 100%;
        }
        .img-source-badge {
            position: absolute; top: 7px; right: 7px;
            background: rgba(15, 23, 42, 0.82); color: #ffffff;
            font-size: 10.5px; font-weight: 800; padding: 2px 8px;
            border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.35);
            backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); pointer-events: none;
            z-index: 5; letter-spacing: 0.2px; line-height: 1.3;
        }
        .img-source-badge.badge-imgbb { color: #38bdf8; border-color: #0284c7; }
        .img-source-badge.badge-drive { color: #4ade80; border-color: #16a34a; }
    `;
    document.head.appendChild(style);
})();

function checkIsAdminPreviewMode() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === '1') return true;
        if (typeof safeLocal !== 'undefined') {
            const logged = safeLocal.getItem("adminLoggedInSession");
            const expiresAt = safeLocal.getItem("admin_expires_at");
            if (logged === "true" && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
                return true;
            }
        }
    } catch(e) {}
    return false;
}

function fileToBase64Async(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            let res = String(reader.result || "");
            if (res.includes("base64,")) res = res.split("base64,")[1];
            resolve(res);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

function detectImageSource(url) {
    if (!url) return { text: "", cls: "" };
    const u = String(url).toLowerCase();
    if (u.includes("ibb.co") || u.includes("imgbb")) {
        return { text: "ImgBB", cls: "badge-imgbb" };
    }
    if (u.includes("drive.google") || u.includes("googleusercontent") || u.includes("script.google")) {
        return { text: "Google Drive", cls: "badge-drive" };
    }
    return { text: "Kho ảnh", cls: "" };
}

function getEffectiveImageUrl(q, imageMap) {
    if (!q) return "";
    if (!imageMap || typeof imageMap !== 'object') imageMap = {};

    if (q.imageUrl && String(q.imageUrl).trim() !== "") {
        let clean = String(q.imageUrl).trim();
        return (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(clean) : clean;
    }

    if (q.imageKey && imageMap[q.imageKey] && String(imageMap[q.imageKey]).trim() !== "") {
        let clean = String(imageMap[q.imageKey]).trim();
        return (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(clean) : clean;
    }

    if (q.imageBackupUrl && String(q.imageBackupUrl).trim() !== "") {
        let clean = String(q.imageBackupUrl).trim();
        return (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(clean) : clean;
    }
    if (q.imageDriveFileId && String(q.imageDriveFileId).trim() !== "") {
        return `https://lh3.googleusercontent.com/d/${String(q.imageDriveFileId).trim()}`;
    }

    const qIdStr = String(q.id || "").trim();
    const possibleKeys = [
        `img_q_${qIdStr}`, `q${qIdStr}`, `${qIdStr}`,
        `pbc_p1_c${qIdStr}`, `pbc_p2_c${qIdStr}`, `pbc_p3_c${qIdStr}`, `pbc_p4_c${qIdStr}`,
        `dh_p1_c${qIdStr}`, `dh_p2_c${qIdStr}`, `dh_p3_c${qIdStr}`,
        `hy_p1_c${qIdStr}`, `hy_p2_c${qIdStr}`, `hy_p3_c${qIdStr}`,
        `dethem_p1_c${qIdStr}`, `dethem_p2_c${qIdStr}`, `dethem_p3_c${qIdStr}`,
        `cau_${qIdStr}`, `cau${qIdStr}`
    ];

    for (let k of possibleKeys) {
        if (imageMap[k] && String(imageMap[k]).trim() !== "") {
            let clean = String(imageMap[k]).trim();
            return (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(clean) : clean;
        }
    }

    if (q.imageKey) {
        const lowerKey = String(q.imageKey).toLowerCase();
        for (let mKey in imageMap) {
            if (mKey.toLowerCase() === lowerKey && imageMap[mKey] && String(imageMap[mKey]).trim() !== "") {
                let clean = String(imageMap[mKey]).trim();
                return (typeof toDirectGoogleDriveImageUrl === 'function') ? toDirectGoogleDriveImageUrl(clean) : clean;
            }
        }
    }

    return "";
}

function findQuizQuestionByDisplayKey(rawKey) {
    if (!rawKey || typeof examData === "undefined" || !examData || !Array.isArray(examData.questions)) return null;
    const cleanId = String(rawKey).replace(/^(?:rev_|orig_|img-display-)/, "");
    return examData.questions.find(q => q && String(q.id) === cleanId) || null;
}

function handleQuizImgError(imgEl, qIdParam = "") {
    if (!imgEl || !imgEl.src) return;
    const rawKey = qIdParam || imgEl.dataset.qid || imgEl.id || "";
    const qObj = findQuizQuestionByDisplayKey(rawKey);

    if (typeof window.handleSmartQuestionImgError === "function") {
        window.handleSmartQuestionImgError(imgEl, qObj, {
            qId: rawKey,
            reloadFnName: "reloadQuizQuestionImg"
        });
        return;
    }

    const currentSrc = imgEl.src;
    if (currentSrc.includes('googleusercontent.com') || currentSrc.includes('drive.google.com')) {
        let m = currentSrc.match(/(?:file\/d\/|id=|open\?id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
        if (m && m[1]) {
            const fileId = m[1];
            const triedLevel = parseInt(imgEl.dataset.fallbackLevel || "0", 10);
            if (triedLevel === 0) {
                imgEl.dataset.fallbackLevel = "1";
                imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1400`;
                return;
            } else if (triedLevel === 1) {
                imgEl.dataset.fallbackLevel = "2";
                imgEl.src = `https://lh3.googleusercontent.com/u/0/d/${fileId}`;
                return;
            } else if (triedLevel === 2) {
                imgEl.dataset.fallbackLevel = "3";
                imgEl.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                return;
            }
        }
    }

    imgEl.style.display = "none";
    const parent = imgEl.closest('.quiz-img-container');
    if (parent && !parent.querySelector('.img-load-fail-notice')) {
        const notice = document.createElement('div');
        notice.className = 'img-load-fail-notice';
        notice.style.cssText = 'padding:8px 12px; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; color:#be123c; font-size:12px; font-weight:700; text-align:center; margin:6px 0;';
        notice.innerHTML = `⚠️ Hình vẽ minh họa tải chậm. <a href="${currentSrc}" target="_blank" style="color:#0284c7; text-decoration:underline;">Nhấn vào đây để xem ảnh gốc</a>`;
        parent.appendChild(notice);
    }
}

async function reloadQuizQuestionImg(rawKey) {
    const qObj = findQuizQuestionByDisplayKey(rawKey);
    const imgEl = document.getElementById(`img-display-${rawKey}`);
    if (!qObj || typeof window.reloadQuestionImageAction !== "function") return;

    const statusEl = document.getElementById(`img-status-${qObj.id}`);
    const res = await window.reloadQuestionImageAction(qObj, {
        onStatus: (msg) => {
            if (statusEl) { statusEl.className = "admin-uploader-status loading"; statusEl.innerText = msg; }
        },
        onSuccess: (info) => {
            if (imgEl) {
                const box = imgEl.parentElement && imgEl.parentElement.querySelector(".img-recovery-box");
                if (box) box.remove();
                imgEl.style.display = "inline-block";
                imgEl.src = info.displaySrc;
            }
            if (statusEl) {
                statusEl.className = "admin-uploader-status success";
                statusEl.innerText = info.fromDrive ? "✅ Đã tải lại từ Drive!" : "✅ Đã làm mới!";
            }
        }
    });
    if (res && !res.ok && res.message) alert(res.message);
}

function buildImgHtml(imgUrl, qId) {
    const cleanUrl = imgUrl ? String(imgUrl).trim() : "";
    const hasUrl = Boolean(cleanUrl !== "");
    const srcInfo = detectImageSource(cleanUrl);
    const safeQId = String(qId ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    return `
    <div class="quiz-img-container" id="img-container-${qId}" style="${hasUrl ? '' : 'display:none;'}">
        <div class="quiz-img-wrapper">
            <img src="${cleanUrl}" class="quiz-img" id="img-display-${qId}" data-qid="${qId}" onerror="handleQuizImgError(this, '${safeQId}')" alt="Hình minh họa">
            <span class="img-source-badge ${srcInfo.cls}" id="img-source-${qId}" style="${hasUrl ? '' : 'display:none;'}">${srcInfo.text}</span>
        </div>
    </div>`;
}

function startImageSyncWatcher(quizId) {
    if (!quizId) return;

    const cfg = window.CURRENT_RT_CONFIG || {};
    if (cfg.watchImageSync === false) {
        return;
    }

    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;

    if (imageSyncChannel) {
        client.removeChannel(imageSyncChannel);
        imageSyncChannel = null;
    }

    imageSyncChannel = client.channel(`image_sync_${quizId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'quizzes',
            filter: `id=eq.${quizId}`
        }, payload => {
            const fresh = payload.new;
            if (fresh && fresh.images && examData) {
                examData.images = fresh.images;
                if (Array.isArray(fresh.questions)) {
                    examData.questions = fresh.questions;
                    fresh.questions.forEach(q => {
                        const directUrl = getEffectiveImageUrl(q, fresh.images);
                        applyRealtimeImageUpdate({
                            qId: q.id,
                            imageKey: q.imageKey || `img_q_${q.id}`,
                            imageUrl: directUrl,
                            action: directUrl ? "set" : "delete"
                        });
                    });
                }
            }
        })
        .subscribe();
}

function applyRealtimeImageUpdate(syncData) {
    const qId = syncData.qId;
    const action = syncData.action;
    const newUrl = syncData.imageUrl || "";
    const imgKey = syncData.imageKey || `img_q_${qId}`;
    const isDeleteAction = (action === "delete" || !newUrl);

    if (examData) {
        if (!examData.images) examData.images = {};
        if (isDeleteAction) {
            delete examData.images[imgKey];
            delete examData.images[`img_q_${qId}`];
            delete examData.images[`q${qId}`];
            delete examData.images[`${qId}`];
            if (syncData.origKey) delete examData.images[syncData.origKey];
        } else {
            examData.images[imgKey] = newUrl;
        }

        if (Array.isArray(examData.questions)) {
            const targetQ = examData.questions.find(item => item && String(item.id) === String(qId));
            if (targetQ) {
                targetQ.imageUrl = isDeleteAction ? "" : newUrl;
                targetQ.imageKey = imgKey;
                if (isDeleteAction) {
                    targetQ.imageBackupUrl = "";
                    targetQ.imageDriveFileId = "";
                    targetQ.imageDriveUrl = "";
                    targetQ.imageDriveFolderUrl = "";
                    targetQ.imageDrivePath = "";
                    targetQ.imageDriveFilename = "";
                    if (targetQ.imageKey) delete examData.images[targetQ.imageKey];
                }
            }
        }
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const quizId = urlParams.get('id') || (typeof examData !== 'undefined' && examData ? examData.id : "");
        const examCode = typeof getExamCode === 'function' ? getExamCode() : "";
        
        const candidateKeys = [
            `shuffled_exam_${quizId}_${examCode}`,
            `shuffled_exam_${examCode}`
        ];

        candidateKeys.forEach(k => {
            const rawCached = safeLocal.getItem(k);
            if (rawCached) {
                const parsedList = JSON.parse(rawCached);
                if (Array.isArray(parsedList)) {
                    const qInCache = parsedList.find(item => item && String(item.id) === String(qId));
                    if (qInCache) {
                        qInCache.imageUrl = isDeleteAction ? "" : newUrl;
                        qInCache.imageKey = imgKey;
                        safeLocal.setItem(k, JSON.stringify(parsedList));
                    }
                }
            }
        });
    } catch(e) {}

    const containerEl = document.getElementById(`img-container-${qId}`);
    let imgEl = document.getElementById(`img-display-${qId}`);
    const badgeSrcEl = document.getElementById(`img-source-${qId}`);
    const delBtn = document.getElementById(`btn-del-img-${qId}`);
    const badgeEl = document.getElementById(`badge-has-img-${qId}`);
    const safeQId = String(qId ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    if (isDeleteAction) {
        if (imgEl) { imgEl.src = ""; imgEl.style.display = "none"; }
        if (badgeSrcEl) { badgeSrcEl.innerText = ""; badgeSrcEl.style.display = "none"; }
        if (containerEl) containerEl.style.display = "none";
        if (delBtn) delBtn.style.display = "none";
        if (badgeEl) badgeEl.style.display = "none";
    } else {
        const srcInfo = detectImageSource(newUrl);
        if (containerEl) {
            containerEl.style.display = "block";
            if (!imgEl) {
                containerEl.innerHTML = `
                    <div class="quiz-img-wrapper">
                        <img src="${newUrl}" class="quiz-img" id="img-display-${qId}" data-qid="${qId}" onerror="handleQuizImgError(this, '${safeQId}')" alt="Hình minh họa">
                        <span class="img-source-badge ${srcInfo.cls}" id="img-source-${qId}">${srcInfo.text}</span>
                    </div>`;
            } else {
                const box = imgEl.parentElement && imgEl.parentElement.querySelector(".img-recovery-box");
                if (box) box.remove();
                imgEl.src = newUrl;
                imgEl.style.display = "inline-block";
                delete imgEl.dataset.fallbackLevel;
                delete imgEl.dataset.smartTryIdx;
                delete imgEl.dataset.gasTried;
            }
        }
        if (badgeSrcEl) {
            badgeSrcEl.innerText = srcInfo.text;
            badgeSrcEl.className = `img-source-badge ${srcInfo.cls}`;
            badgeSrcEl.style.display = "inline-block";
        }
        if (delBtn) delBtn.style.display = "inline-flex";
        if (badgeEl) badgeEl.style.display = "inline-flex";
    }
}

async function saveQuestionImageMetadataToQuizSupabase(quizId, qId, effectiveKey, directImgUrl, targetQ) {
    if (!quizId) return;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) return;
    try {
        const { data: currentQ } = await client.from('quizzes').select('images, questions').eq('id', quizId).single();
        if (currentQ) {
            const updatedImages = { ...(currentQ.images || {}) };
            if (directImgUrl) updatedImages[effectiveKey] = directImgUrl;
            let updatedQuestions = currentQ.questions || [];
            if (Array.isArray(updatedQuestions)) {
                const targetIdx = updatedQuestions.findIndex(item => item && String(item.id) === String(qId));
                if (targetIdx !== -1) {
                    updatedQuestions[targetIdx].imageUrl = directImgUrl;
                    updatedQuestions[targetIdx].imageKey = effectiveKey;
                    if (targetQ) {
                        if (targetQ.imageBackupUrl) updatedQuestions[targetIdx].imageBackupUrl = targetQ.imageBackupUrl;
                        if (targetQ.imageDriveFileId) updatedQuestions[targetIdx].imageDriveFileId = targetQ.imageDriveFileId;
                        if (targetQ.imageDriveUrl) updatedQuestions[targetIdx].imageDriveUrl = targetQ.imageDriveUrl;
                        if (targetQ.imageDriveFolderUrl) updatedQuestions[targetIdx].imageDriveFolderUrl = targetQ.imageDriveFolderUrl;
                        if (targetQ.imageDrivePath) updatedQuestions[targetIdx].imageDrivePath = targetQ.imageDrivePath;
                        if (targetQ.imageDriveFilename) updatedQuestions[targetIdx].imageDriveFilename = targetQ.imageDriveFilename;
                    }
                }
            }
            await client.from('quizzes').update({
                images: updatedImages,
                questions: updatedQuestions
            }).eq('id', quizId);
        }
    } catch(supaErr) {
        console.warn("Lỗi lưu ảnh lên Supabase quizzes:", supaErr);
    }
}

async function uploadQuestionImageToImgBB(file, qId, imageKey, qIndex) {
    if (!file) return;
    const statusEl = document.getElementById(`img-status-${qId}`);
    const zoneEl = document.getElementById(`zone-q-${qId}`);

    if (zoneEl) zoneEl.style.pointerEvents = "none";

    if (statusEl) {
        statusEl.className = "admin-uploader-status loading";
        statusEl.innerText = "⏳ Đang đọc và chuẩn bị gửi ảnh...";
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const quizId = urlParams.get('id');
        const effectiveKey = imageKey || `img_q_${qId}`;
        const targetQ = (typeof examData !== "undefined" && examData && Array.isArray(examData.questions))
            ? examData.questions.find(item => item && String(item.id) === String(qId))
            : { id: qId, origIndex: (qIndex || 0) + 1, imageKey: effectiveKey };

        if (typeof window.uploadDualQuestionImage === "function") {
            const dualRes = await window.uploadDualQuestionImage(file, targetQ, {
                contextTitle: (typeof examData !== "undefined" && examData && examData.title) || (typeof EXAM_NAME !== "undefined" ? EXAM_NAME : "DeThi"),
                imgKey: effectiveKey,
                onStatus: (msg) => {
                    if (statusEl) { statusEl.className = "admin-uploader-status loading"; statusEl.innerText = msg; }
                },
                onBackupComplete: async (updatedQ) => {
                    await saveQuestionImageMetadataToQuizSupabase(quizId, qId, effectiveKey, updatedQ.imageUrl, updatedQ);
                    if (statusEl) {
                        statusEl.className = "admin-uploader-status success";
                        statusEl.innerText = "☁️ Đã sao lưu dự phòng vào Google Drive!";
                        setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 3500);
                    }
                }
            });

            applyRealtimeImageUpdate({
                qId: qId,
                imageKey: effectiveKey,
                imageUrl: dualRes.primaryUrl,
                action: "set"
            });

            await saveQuestionImageMetadataToQuizSupabase(quizId, qId, effectiveKey, dualRes.primaryUrl, targetQ);

            if (statusEl) {
                statusEl.className = "admin-uploader-status success";
                statusEl.innerText = `✅ Đã lưu (${dualRes.source}) & đang sao lưu Drive!`;
                setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 4000);
            }
            return;
        }

        // Fallback nguyên bản nếu không có module kép
        const base64Data = await fileToBase64Async(file);
        let directImgUrl = "";
        let uploadSource = "ImgBB";
        const hasValidImgbbKey = Boolean(IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_API_KEY"));
        const hasDriveGasUrl = Boolean(typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL"));

        let imgbbSuccess = false;
        if (hasValidImgbbKey) {
            const imgbbAbortController = new AbortController();
            const timeoutId = setTimeout(() => { try { imgbbAbortController.abort(); } catch(e) {} }, 7000);
            try {
                const formData = new FormData();
                formData.append("image", base64Data);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData, signal: imgbbAbortController.signal });
                clearTimeout(timeoutId);
                if (res && res.ok) {
                    const json = await res.json().catch(() => null);
                    if (json && json.success && json.data && (json.data.display_url || json.data.url)) {
                        directImgUrl = json.data.display_url || json.data.url;
                        imgbbSuccess = true;
                    }
                }
            } catch (imgbbErr) { clearTimeout(timeoutId); }
        }

        if (!imgbbSuccess) {
            if (!hasDriveGasUrl) throw new Error("ImgBB không phản hồi và chưa cấu hình GOOGLE_DRIVE_UPLOAD_GAS_URL!");
            uploadSource = "Google Drive";
            const driveRes = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "uploadQuestionImageBackup",
                    path: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_anh_de_thi/Chung",
                    filename: `cau_${qId}_${Date.now()}.png`,
                    mimeType: file.type || "image/png",
                    base64: base64Data
                })
            });
            const driveJson = await driveRes.json();
            if (driveJson && driveJson.status === "success" && (driveJson.directUrl || driveJson.fileUrl)) {
                directImgUrl = (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(driveJson.directUrl || driveJson.fileUrl) : (driveJson.directUrl || driveJson.fileUrl);
            } else {
                throw new Error((driveJson && driveJson.message) || "Máy chủ Google Drive không phản hồi đường dẫn.");
            }
        }

        applyRealtimeImageUpdate({ qId, imageKey: effectiveKey, imageUrl: directImgUrl, action: "set" });
        await saveQuestionImageMetadataToQuizSupabase(quizId, qId, effectiveKey, directImgUrl, targetQ);

        if (statusEl) {
            statusEl.className = "admin-uploader-status success";
            statusEl.innerText = `✅ Đã lưu (${uploadSource}) & đồng bộ tức thì!`;
            setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 4000);
        }
    } catch(err) {
        let errMsg = err.message || "";
        if (err.name === 'AbortError' || errMsg.includes('abort')) {
            errMsg = "Quá thời gian kết nối máy chủ (mạng yếu hoặc máy chủ bận). Vui lòng thử lại!";
        }
        if (statusEl) {
            statusEl.className = "admin-uploader-status error";
            statusEl.innerText = "❌ Lỗi: " + errMsg;
        }
        alert("❌ Lỗi tải ảnh: " + errMsg);
    } finally {
        if (zoneEl) zoneEl.style.pointerEvents = "auto";
    }
}

async function deleteQuestionImage(qId, imageKey, qIdx) {
    const targetQ = examData && examData.questions ? examData.questions.find(item => item && String(item.id) === String(qId)) : null;
    const origKey = targetQ ? targetQ.imageKey : "";
    const effectiveKey = imageKey || origKey || `img_q_${qId}`;

    const statusEl = document.getElementById(`img-status-${qId}`);
    const imgEl = document.getElementById(`img-display-${qId}`);

    const currentImgUrl = (imgEl && imgEl.src && imgEl.style.display !== "none") 
        ? imgEl.src 
        : (examData && examData.images && (examData.images[effectiveKey] || (origKey && examData.images[origKey])));

    if (!currentImgUrl) {
        alert("⚠️ Câu này hiện tại không có ảnh để xóa!");
        return;
    }

    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA ảnh của câu này không?")) return;

    if (statusEl) {
        statusEl.className = "admin-uploader-status loading";
        statusEl.innerText = "⏳ Đang xóa ảnh & đồng bộ máy học sinh...";
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const quizId = urlParams.get('id');

        applyRealtimeImageUpdate({
            qId: qId,
            imageKey: effectiveKey,
            origKey: origKey,
            imageUrl: "",
            action: "delete"
        });

        if (quizId) {
            const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
            if (client) {
                try {
                    const { data: currentQ } = await client.from('quizzes').select('images, questions').eq('id', quizId).single();
                    if (currentQ) {
                        const updatedImages = { ...(currentQ.images || {}) };
                        delete updatedImages[effectiveKey];
                        if (origKey) delete updatedImages[origKey];

                        let updatedQuestions = currentQ.questions || [];
                        if (Array.isArray(updatedQuestions)) {
                            const targetIdx = updatedQuestions.findIndex(item => item && String(item.id) === String(qId));
                            if (targetIdx !== -1) {
                                updatedQuestions[targetIdx].imageUrl = "";
                                updatedQuestions[targetIdx].imageBackupUrl = "";
                                updatedQuestions[targetIdx].imageDriveFileId = "";
                                updatedQuestions[targetIdx].imageDriveUrl = "";
                                updatedQuestions[targetIdx].imageDriveFolderUrl = "";
                                updatedQuestions[targetIdx].imageDrivePath = "";
                                updatedQuestions[targetIdx].imageDriveFilename = "";
                            }
                        }
                        await client.from('quizzes').update({
                            images: updatedImages,
                            questions: updatedQuestions
                        }).eq('id', quizId);
                    }
                } catch(supaErr) {
                    console.warn("Lỗi xóa ảnh trên Supabase quizzes:", supaErr);
                }
            }
        }

        if (statusEl) {
            statusEl.className = "admin-uploader-status success";
            statusEl.innerText = "🗑️ Đã xóa ảnh & đồng bộ tới học sinh!";
            setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 3500);
        }
    } catch(err) {
        if (statusEl) {
            statusEl.className = "admin-uploader-status error";
            statusEl.innerText = "❌ Lỗi xóa ảnh: " + err.message;
        }
        alert("❌ Lỗi khi xóa ảnh: " + err.message);
    }
}

function setupAdminClipboardPasteListener() {
    document.querySelectorAll('.question-card').forEach(card => {
        card.addEventListener('paste', function(e) {
            const qId = this.dataset.qid;
            const imgKey = this.dataset.imgkey || `img_q_${qId}`;
            const qIdx = parseInt(this.dataset.qidx, 10);
            const clipboardItems = (e.clipboardData || window.clipboardData)?.items;
            if (!clipboardItems) return;

            for (let i = 0; i < clipboardItems.length; i++) {
                const item = clipboardItems[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    uploadQuestionImageToImgBB(blob, qId, imgKey, qIdx);
                    break;
                }
            }
        });

        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('dragover'); });
        card.addEventListener('dragleave', () => { card.classList.remove('dragover'); });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('dragover');
            const qId = card.dataset.qid;
            const imgKey = card.dataset.imgkey || `img_q_${qId}`;
            const qIdx = parseInt(card.dataset.qidx, 10);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                uploadQuestionImageToImgBB(e.dataTransfer.files[0], qId, imgKey, qIdx);
            }
        });
    });
}

window.triggerPastePrompt = function(qId, imgKey) {
    const zone = document.getElementById(`zone-q-${qId}`);
    if (zone) zone.focus();
    if (typeof showTimeChangeToast === 'function') {
        showTimeChangeToast(`📋 Bạn vừa quét ảnh bằng Snipping Tool? Hãy bấm Ctrl + V để dán ngay cho Câu ${qId}!`);
    }
};

window.handleAdminFileSelected = function(input, qId, imgKey, qIdx) {
    if (input.files && input.files[0]) {
        uploadQuestionImageToImgBB(input.files[0], qId, imgKey, qIdx);
    }
};

window.getEffectiveImageUrl = getEffectiveImageUrl;
window.handleQuizImgError = handleQuizImgError;
window.reloadQuizQuestionImg = reloadQuizQuestionImg;
window.buildImgHtml = buildImgHtml;
window.startImageSyncWatcher = startImageSyncWatcher;
window.applyRealtimeImageUpdate = applyRealtimeImageUpdate;
window.deleteQuestionImage = deleteQuestionImage;
