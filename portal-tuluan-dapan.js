// =========================================================
// FILE: portal-tuluan-dapan.js
// QUẢN LÝ UPLOAD ĐÁP ÁN CHẤM, HẸN GIỜ TỰ ĐỘNG & BANNER DÂN TRÍ
// =========================================================

function triggerUploadDapAnCham(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const fileIn = document.getElementById("tuluan-dapan-file-input");
    if (fileIn) {
        fileIn.value = "";
        fileIn.click();
    }
}

async function handleUploadDapAnCham(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    const btn = document.getElementById("btn-up-dapan-cham");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang gửi...";
    }

    const qId = currentTuLuanModalData.quizId || "quiz";
    const classId = currentTuLuanModalData.classId || "lop-11a";

    const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
        ? GOOGLE_DRIVE_TULUAN_GAS_URL 
        : GOOGLE_DRIVE_UPLOAD_GAS_URL;

    if (!gasUrl || gasUrl.includes("DÁN_URL")) {
        alert("⚠️ Chưa cấu hình GOOGLE_DRIVE_TULUAN_GAS_URL trong app-config.js!");
        if (btn) { btn.disabled = false; btn.innerText = "📤 Đ.Á chấm"; }
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                let rawResult = String(e.target.result || "");
                let base64Data = rawResult.includes("base64,") ? rawResult.split("base64,")[1] : rawResult.split(",")[1];

                const payload = {
                    action: "uploadDapAnCham",
                    rootFolder: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO",
                    className: "Dap_an_cham_tu_luan",
                    class: "Dap_an_cham_tu_luan",
                    lop: "Dap_an_cham_tu_luan",
                    examTitle: "Dap_an_cham_tu_luan",
                    folderKey: "Dap_an_cham_tu_luan",
                    studentFolder: "Dap_an_cham_tu_luan",
                    filename: file.name,
                    mimeType: file.type || "application/octet-stream",
                    base64: base64Data
                };

                const result = await sendToGoogleDriveWithRetry(gasUrl, payload, 2, 75000);
                if (result && result.status === "success" && result.fileUrl) {
                    const now = new Date();
                    const pad = n => String(n).padStart(2, '0');
                    const uploadTimeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;

                    const directUrl = result.directUrl || (typeof toDirectGoogleDriveImageUrl === 'function' ? toDirectGoogleDriveImageUrl(result.fileUrl) : result.fileUrl);
                    const existingDapan = currentTuLuanModalData.dapAnCham || {};

                    const dapanData = {
                        quizId: qId,
                        classId: classId,
                        fileName: file.name,
                        fileUrl: result.fileUrl,
                        directUrl: directUrl,
                        fileId: result.fileId || "",
                        uploadedAt: uploadTimeStr,
                        timestamp: Date.now(),
                        scheduleTime: existingDapan.scheduleTime || null
                    };

                    const client = getDbClient();
                    if (client) {
                        await client.from('app_key_values').upsert({
                            key: 'dapan_' + qId,
                            value: dapanData
                        });
                    }

                    currentTuLuanModalData.dapAnCham = dapanData;
                    renderDapAnChamUI();
                    alert(`🎉 ĐÃ TẢI LÊN ĐÁP ÁN CHẤM THÀNH CÔNG!\n\n📁 Tên file: ${file.name}`);
                } else {
                    throw new Error(result.message || "Không thể lấy đường dẫn tệp từ Google Drive.");
                }
            } catch(upErr) {
                alert("❌ Lỗi khi tải file lên Drive: " + upErr.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = "📤 Đ.Á chấm";
                }
                fileInput.value = "";
            }
        };
        reader.readAsDataURL(file);
    } catch(err) {
        alert("❌ Lỗi đọc file từ máy: " + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📤 Đ.Á chấm";
        }
        fileInput.value = "";
    }
}

async function deleteDapAnCham(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!checkCurrentIsAdmin()) {
        alert("⛔ Chỉ Giáo viên quản trị mới có quyền xóa file Đáp án chấm!");
        return;
    }

    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA file Đáp án chấm của đề này không?")) return;

    const qId = currentTuLuanModalData.quizId;
    const curDapan = currentTuLuanModalData.dapAnCham;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('app_key_values').delete().eq('key', 'dapan_' + qId);
        }

        if (curDapan && curDapan.fileId) {
            const gasUrl = (typeof GOOGLE_DRIVE_TULUAN_GAS_URL !== "undefined" && GOOGLE_DRIVE_TULUAN_GAS_URL) 
                ? GOOGLE_DRIVE_TULUAN_GAS_URL 
                : GOOGLE_DRIVE_UPLOAD_GAS_URL;
            if (gasUrl && !gasUrl.includes("DÁN_URL")) {
                fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "deleteFile", fileId: curDapan.fileId })
                }).catch(() => null);
            }
        }

        currentTuLuanModalData.dapAnCham = null;
        renderDapAnChamUI();
        alert("🗑️ Đã xóa file Đáp án chấm thành công!");
    } catch(err) {
        alert("❌ Lỗi khi xóa: " + err.message);
    }
}

function toggleDapAnSchedulePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("dapan-schedule-popover");
    if (!pop) return;
    const isShown = pop.classList.contains("show");

    document.querySelectorAll(".student-pass-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".student-feedback-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".dapan-schedule-popover.show").forEach(p => p.classList.remove("show"));
    document.querySelectorAll(".component-score-popover.show").forEach(p => p.classList.remove("show"));

    if (!isShown) {
        pop.classList.add("show");

        const curDapan = currentTuLuanModalData.dapAnCham;
        const radioNow = document.getElementById("sched-mode-now");
        const radioAuto = document.getElementById("sched-mode-auto");
        const dateInput = document.getElementById("dapan-sched-datetime");

        if (curDapan && curDapan.scheduleTime) {
            if (radioAuto) radioAuto.checked = true;
            onDapAnScheduleModeChanged('auto');
            if (dateInput) {
                const d = new Date(curDapan.scheduleTime);
                if (!isNaN(d.getTime()) && typeof toLocalDatetimeString === 'function') {
                    dateInput.value = toLocalDatetimeString(d);
                } else if (!isNaN(d.getTime())) {
                    const pad = n => String(n).padStart(2, '0');
                    dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
            }
        } else {
            if (radioNow) radioNow.checked = true;
            onDapAnScheduleModeChanged('now');
            if (dateInput) dateInput.value = "";
        }
    }
}

function closeDapAnSchedulePopover(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const pop = document.getElementById("dapan-schedule-popover");
    if (pop) pop.classList.remove("show");
}

function onDapAnScheduleModeChanged(mode) {
    const inputGroup = document.getElementById("sched-datetime-input-group");
    if (inputGroup) {
        inputGroup.style.display = (mode === 'auto') ? 'block' : 'none';
        if (mode === 'auto') {
            const dateInput = document.getElementById("dapan-sched-datetime");
            if (dateInput && !dateInput.value) {
                setScheduleToExamDeadline();
            }
        }
    }
}

function setScheduleToExamDeadline() {
    const dateInput = document.getElementById("dapan-sched-datetime");
    if (!dateInput) return;

    let deadlineStr = null;
    const currentQuizId = currentTuLuanModalData.quizId;

    if (typeof examData !== 'undefined' && examData && examData.examEndTimeStr) {
        deadlineStr = examData.examEndTimeStr;
    } else {
        const allCats = [...(window.DAY_THEM_CATEGORIES || []), ...(window.CHINH_KHOA_CATEGORIES || [])];
        for (const cat of allCats) {
            if (Array.isArray(cat.links)) {
                const match = cat.links.find(l => (l.id === currentQuizId || l.firebaseId === currentQuizId));
                if (match && match.examEndTimeStr) {
                    deadlineStr = match.examEndTimeStr;
                    break;
                }
            }
        }
    }

    if (deadlineStr) {
        const d = new Date(deadlineStr);
        if (!isNaN(d.getTime()) && typeof toLocalDatetimeString === 'function') {
            dateInput.value = toLocalDatetimeString(d);
            return;
        }
    }

    const def = new Date();
    def.setHours(21, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    dateInput.value = `${def.getFullYear()}-${pad(def.getMonth() + 1)}-${pad(def.getDate())}T${pad(def.getHours())}:${pad(def.getMinutes())}`;
}

async function saveDapAnSchedule(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const qId = currentTuLuanModalData.quizId;
    if (!qId) return;

    const curDapan = currentTuLuanModalData.dapAnCham;
    if (!curDapan) {
        alert("⚠️ Vui lòng upload file Đáp án chấm trước khi thiết lập lịch hẹn giờ!");
        closeDapAnSchedulePopover();
        return;
    }

    const radioAuto = document.getElementById("sched-mode-auto");
    const isAuto = radioAuto && radioAuto.checked;
    let scheduleTimeISO = null;

    if (isAuto) {
        const dateInput = document.getElementById("dapan-sched-datetime");
        const val = dateInput ? dateInput.value : "";
        if (!val) {
            alert("⚠️ Vui lòng chọn ngày và giờ mở đáp án!");
            return;
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) {
            alert("⚠️ Thời gian hẹn không hợp lệ!");
            return;
        }
        scheduleTimeISO = d.toISOString();
    }

    curDapan.scheduleTime = scheduleTimeISO;

    try {
        const client = getDbClient();
        if (client) {
            await client.from('app_key_values').upsert({
                key: 'dapan_' + qId,
                value: curDapan
            });
        }

        renderDapAnChamUI();
        closeDapAnSchedulePopover();

        if (scheduleTimeISO) {
            const formatted = new Date(scheduleTimeISO).toLocaleString("vi-VN");
            alert(`⏰ ĐÃ THIẾT LẬP HẸN GIỜ MỞ ĐÁP ÁN!\n\n- Đề thi: ${currentTuLuanModalData.examTitle}\n- Tự động mở: ${formatted}`);
        } else {
            alert("🔓 Đã mở đáp án tự do cho học sinh xem ngay lập tức!");
        }
    } catch(err) {
        alert("❌ Lỗi khi lưu hẹn giờ: " + err.message);
    }
}

function isDapAnUnlocked(dapan) {
    if (!dapan || !dapan.fileUrl) return false;
    if (checkCurrentIsAdmin()) return true;
    if (!dapan.scheduleTime) return true;
    const targetMs = new Date(dapan.scheduleTime).getTime();
    if (isNaN(targetMs)) return true;
    return Date.now() >= targetMs;
}

function formatRemainingLockTime(targetMs) {
    const diffSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    if (diffSec <= 0) return "Đang mở...";
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);

    if (days > 0) return `${days} ngày ${hours} giờ`;
    if (hours > 0) return `${hours} giờ ${mins} phút`;
    return `${mins} phút`;
}

function renderDapAnChamUI() {
    const dapan = currentTuLuanModalData.dapAnCham;
    const isAdmin = checkCurrentIsAdmin();

    const schedBtn = document.getElementById("btn-schedule-dapan");
    const badgeWrap = document.getElementById("tuluan-dapan-badge-wrap");
    const badgeLink = document.getElementById("tuluan-dapan-badge-link");
    const badgeFilename = document.getElementById("tuluan-dapan-badge-filename");
    const badgeMoiMini = document.getElementById("badge-moi-mini-text");
    const delMiniBtn = document.getElementById("btn-del-dapan-mini");

    const fullStrip = document.getElementById("tuluan-dapan-full-strip");
    const stripFilename = document.getElementById("strip-dapan-filename");
    const stripLink = document.getElementById("strip-dapan-link");
    const stripTime = document.getElementById("strip-dapan-time");
    const stripOpenBtn = document.getElementById("strip-dapan-open-btn");
    const stripDelBtn = document.getElementById("strip-dapan-del-btn");
    const stripBadgeTag = document.getElementById("strip-dapan-badge-tag");

    if (schedBtn) {
        if (dapan && dapan.scheduleTime) {
            schedBtn.classList.add("has-schedule");
            schedBtn.title = `Đang hẹn giờ mở lúc: ${new Date(dapan.scheduleTime).toLocaleString("vi-VN")}`;
            schedBtn.innerHTML = `⏰ Đã hẹn`;
        } else {
            schedBtn.classList.remove("has-schedule");
            schedBtn.title = "Hẹn giờ tự động mở đáp án cho học sinh";
            schedBtn.innerHTML = `⏰ Hẹn giờ`;
        }
    }

    if (dapan && dapan.fileUrl) {
        const directUrl = dapan.fileUrl;
        const name = dapan.fileName || "Đáp án chấm";
        const uploadTime = dapan.uploadedAt || "";
        const isUnlocked = isDapAnUnlocked(dapan);

        if (badgeWrap) badgeWrap.style.display = "inline-flex";
        if (badgeFilename) badgeFilename.innerText = name;

        if (badgeLink) {
            if (isUnlocked) {
                badgeLink.href = directUrl;
                badgeLink.classList.remove("is-locked");
                badgeLink.title = `Mở Đáp án: ${name} (${uploadTime})`;
                if (badgeMoiMini) {
                    badgeMoiMini.innerText = "MỚI";
                    badgeMoiMini.style.backgroundColor = "#0284c7";
                }
            } else {
                badgeLink.href = "javascript:void(0)";
                badgeLink.classList.add("is-locked");
                const remain = formatRemainingLockTime(new Date(dapan.scheduleTime).getTime());
                badgeLink.title = `🔒 Đáp án đang khóa! Sẽ mở sau: ${remain}`;
                if (badgeMoiMini) {
                    badgeMoiMini.innerText = "KHÓA";
                    badgeMoiMini.style.backgroundColor = "#ea580c";
                }
            }
        }
        if (delMiniBtn) delMiniBtn.style.display = isAdmin ? "inline-flex" : "none";

        if (fullStrip) {
            fullStrip.style.display = "flex";
            if (!isUnlocked) {
                fullStrip.classList.add("strip-locked");
            } else {
                fullStrip.classList.remove("strip-locked");
            }
        }

        if (isUnlocked) {
            if (stripBadgeTag) {
                stripBadgeTag.className = "dapan-badge-new";
                stripBadgeTag.innerText = "MỚI";
            }
            if (stripFilename) stripFilename.innerText = name;
            if (stripLink) {
                stripLink.href = directUrl;
                stripLink.style.pointerEvents = "auto";
            }
            if (stripTime) stripTime.innerText = `📅 ${uploadTime}`;
            if (stripOpenBtn) {
                stripOpenBtn.href = directUrl;
                stripOpenBtn.className = "btn-open-dapan-strip";
                stripOpenBtn.innerText = isAdmin ? "🔗 Mở xem (Admin)" : "🔗 Mở xem";
            }
        } else {
            const schedStr = new Date(dapan.scheduleTime).toLocaleString("vi-VN");
            const remain = formatRemainingLockTime(new Date(dapan.scheduleTime).getTime());

            if (stripBadgeTag) {
                stripBadgeTag.className = "dapan-badge-new badge-lock";
                stripBadgeTag.innerText = "HẸN GIỜ";
            }
            if (stripFilename) {
                stripFilename.innerText = `${name} [Mở lúc: ${schedStr} - Còn ${remain}]`;
            }
            if (stripTime) stripTime.innerText = `⏳ Đang khóa với học sinh`;

            if (isAdmin) {
                if (stripLink) {
                    stripLink.href = directUrl;
                    stripLink.style.pointerEvents = "auto";
                }
                if (stripOpenBtn) {
                    stripOpenBtn.href = directUrl;
                    stripOpenBtn.className = "btn-open-dapan-strip";
                    stripOpenBtn.innerText = "🔗 Mở xem (Admin)";
                }
            } else {
                if (stripLink) {
                    stripLink.href = "javascript:void(0)";
                    stripLink.style.pointerEvents = "none";
                }
                if (stripOpenBtn) {
                    stripOpenBtn.href = "javascript:void(0)";
                    stripOpenBtn.className = "btn-open-dapan-strip disabled-strip";
                    stripOpenBtn.innerText = "🔒 Đang khóa";
                }
            }
        }

        if (stripDelBtn) stripDelBtn.style.display = isAdmin ? "inline-flex" : "none";
    } else {
        if (badgeWrap) badgeWrap.style.display = "none";
        if (fullStrip) fullStrip.style.display = "none";
    }

    updateTuLuanAdminUI();
}