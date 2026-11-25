// =========================================================
// FILE: offline-sync-rescue.js (FILE MỚI TINH)
// BỘ GIẢI CỨU & ĐỒNG BỘ TỰ ĐỘNG BÀI THI BỊ KẸT DO RỚT MẠNG
// HOẠT ĐỘNG TRÊN CẢ TRANG CHỦ (index.html) & PHÒNG THI (thi.html)
// KHÔNG PHỤ THUỘC SERVICE WORKER -> CHẠY MƯỢT 100% TRÊN IPHONE / SAFARI / MESSENGER
// =========================================================

(function initOfflineSyncRescue() {
    if (typeof window === "undefined" || window.__offlineRescueInitialized) return;
    window.__offlineRescueInitialized = true;

    let _isRescuingOfflineSubs = false;

    function showOfflineRescueBanner(message, isSuccess = true) {
        try {
            if (typeof showTimeChangeToast === "function") {
                showTimeChangeToast(message);
                return;
            }
            let banner = document.getElementById("offline-rescue-toast");
            if (!banner) {
                banner = document.createElement("div");
                banner.id = "offline-rescue-toast";
                banner.style.cssText = `
                    position: fixed;
                    bottom: 18px;
                    right: 18px;
                    max-width: min(390px, calc(100vw - 32px));
                    padding: 11px 16px;
                    border-radius: 12px;
                    font-family: 'Be Vietnam Pro', system-ui, sans-serif;
                    font-size: 12.5px;
                    font-weight: 800;
                    color: #ffffff;
                    z-index: 2147483600;
                    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.35);
                    transition: opacity 0.25s ease, transform 0.25s ease;
                    line-height: 1.4;
                `;
                document.body.appendChild(banner);
            }
            banner.style.background = isSuccess
                ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                : "linear-gradient(135deg, #d97706 0%, #b45309 100%)";
            banner.style.opacity = "1";
            banner.style.transform = "translateY(0)";
            banner.textContent = message;

            setTimeout(() => {
                if (banner) {
                    banner.style.opacity = "0";
                    banner.style.transform = "translateY(10px)";
                }
            }, 6000);
        } catch (e) {}
    }

    async function pushSingleRescuePayload(client, payload, gasUrl) {
        if (!client || !payload || !payload.quiz_id || !payload.sbd) return false;

        let submitOk = false;
        try {
            const { error: err1 } = await client.from("submissions").insert([payload]);
            if (!err1) {
                submitOk = true;
            } else {
                const msg = String(err1.message || "");
                const isDupId = msg.includes("submissions_pkey") || (err1.code === "23505" && msg.includes("id"));
                const isConstraint = msg.includes("idx_submissions_quiz_sbd") || msg.includes("unique constraint") || msg.includes("duplicate key");

                if (isDupId) {
                    // Bản ghi với đúng id này đã có trên Supabase rồi -> coi như đã lưu an toàn
                    submitOk = true;
                } else if (isConstraint) {
                    const fallbackPayload = {
                        ...payload,
                        id: `${payload.id}_rescue_${Date.now()}`,
                        sbd: `${payload.sbd}_lan_bu`
                    };
                    const { error: errBranch } = await client.from("submissions").insert([fallbackPayload]);
                    if (!errBranch) submitOk = true;
                }
            }
        } catch (e) {
            return false;
        }

        if (!submitOk) return false;

        // Dọn dẹp active_sessions & live_drafts
        try {
            client.from("live_drafts").delete().match({ quiz_id: payload.quiz_id, sbd: payload.sbd }).then();
            client.from("active_sessions").delete().match({ quiz_id: payload.quiz_id, sbd: payload.sbd }).then();
        } catch (e) {}

        // Gửi bản sao lưu dự phòng sang Google Drive (nếu có GAS URL)
        const targetGasUrl = gasUrl ||
            (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) ||
            (typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL) || "";

        if (targetGasUrl && !targetGasUrl.includes("DÁN_URL")) {
            try {
                if (typeof sendSubmissionJsonToGoogleDriveFolder === "function") {
                    sendSubmissionJsonToGoogleDriveFolder(payload);
                } else {
                    fetch(targetGasUrl, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({
                            action: "backupSubmissionRecord",
                            submission: payload
                        })
                    }).catch(() => {});
                }
            } catch (e) {}
        }

        // Ghi vào lịch sử làm bài trên máy học sinh nếu chưa có
        try {
            const storageKey = `exam_history_${payload.quiz_id}_${payload.sbd}`;
            const rawHist = safeLocal.getItem(storageKey);
            let hist = rawHist ? JSON.parse(rawHist) : [];
            if (!Array.isArray(hist)) hist = [];
            const alreadyInHist = hist.some(h => h && h.payload && h.payload.id === payload.id);
            if (!alreadyInHist) {
                const attemptIdx = hist.length + 1;
                hist.push({
                    id: `${storageKey}_attempt_${attemptIdx}`,
                    attempt: attemptIdx,
                    timestamp: Date.now(),
                    dateStr: new Date().toLocaleString("vi-VN"),
                    payload: payload
                });
                safeLocal.setItem(storageKey, JSON.stringify(hist));
            }
        } catch (e) {}

        return true;
    }

    async function checkAndRescuePendingSubmissions() {
        if (_isRescuingOfflineSubs) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        // Không chạy khi học sinh đang trong quá trình bấm nộp trực tiếp
        if (typeof isSubmittingInProgress !== "undefined" && isSubmittingInProgress) return;

        const client = (typeof getSupabaseClient === "function")
            ? getSupabaseClient()
            : (typeof supabaseClient !== "undefined" ? supabaseClient : null);
        if (!client) return;

        _isRescuingOfflineSubs = true;
        let rescuedCount = 0;

        try {
            const queueItems = [];
            const seenIds = new Set();

            // 1. Đọc từ localStorage
            try {
                const rawPending = safeLocal.getItem("pending_exam_submission");
                if (rawPending) {
                    const parsed = JSON.parse(rawPending);
                    if (parsed && parsed.quiz_id && parsed.sbd) {
                        const keyId = String(parsed.id || `${parsed.quiz_id}_${parsed.sbd}`);
                        seenIds.add(keyId);
                        queueItems.push({ source: "ls", id: keyId, payload: parsed, gasUrl: "" });
                    }
                }
            } catch (e) {}

            // 2. Đọc từ IndexedDB
            if (typeof examIndexedDB !== "undefined") {
                try {
                    const idbItems = await examIndexedDB.getAll("pending_submissions");
                    if (Array.isArray(idbItems)) {
                        idbItems.forEach(entry => {
                            if (entry && entry.payload && entry.payload.quiz_id && entry.payload.sbd) {
                                const keyId = String(entry.id || entry.payload.id);
                                if (!seenIds.has(keyId)) {
                                    seenIds.add(keyId);
                                    queueItems.push({ source: "idb", id: keyId, payload: entry.payload, gasUrl: entry.gasUrl || "" });
                                }
                            }
                        });
                    }
                } catch (e) {}
            }

            if (queueItems.length === 0) return;

            for (const item of queueItems) {
                const ok = await pushSingleRescuePayload(client, item.payload, item.gasUrl);
                if (ok) {
                    rescuedCount++;
                    try {
                        const lsRaw = safeLocal.getItem("pending_exam_submission");
                        if (lsRaw) {
                            const lsParsed = JSON.parse(lsRaw);
                            if (lsParsed && (lsParsed.id === item.payload.id || lsParsed.quiz_id === item.payload.quiz_id)) {
                                safeLocal.removeItem("pending_exam_submission");
                            }
                        }
                    } catch (e) {}
                    if (typeof examIndexedDB !== "undefined") {
                        examIndexedDB.removeItem("pending_submissions", item.id).catch(() => {});
                    }
                }
            }

            if (rescuedCount > 0) {
                if (typeof window.updateTopBackupStatus === "function") {
                    window.updateTopBackupStatus(true);
                }
                if (typeof window.renderStudentSubmissionHistoryButtons === "function") {
                    window.renderStudentSubmissionHistoryButtons();
                }
                showOfflineRescueBanner(
                    `🎉 Đã tự động nộp bù thành công ${rescuedCount} bài thi bị kẹt do mất mạng trước đó!`,
                    true
                );
            }
        } catch (err) {
            console.warn("Lỗi tự động giải cứu bài kẹt:", err);
        } finally {
            _isRescuingOfflineSubs = false;
        }
    }

    window.checkAndRescuePendingSubmissions = checkAndRescuePendingSubmissions;

    // Tự động kiểm tra sau khi tải trang 2.5s và mỗi khi kết nối Internet bật lại
    setTimeout(checkAndRescuePendingSubmissions, 2500);
    window.addEventListener("online", () => {
        setTimeout(checkAndRescuePendingSubmissions, 800);
    });
})();