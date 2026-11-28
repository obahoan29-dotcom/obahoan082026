// =========================================================
// FILE: soide-actions-cloud.js
// MODULE 3/3 CỦA HỆ THỐNG SOI ĐỀ THỜI GIAN THỰC:
// - UPLOAD / ĐỌC FILE ĐỀ (.JSON / .JS / .TXT)
// - DÁN ẢNH 2 TẦNG (IMGBB + NGẦM DRIVE 5TB) & XÓA ẢNH (CHẶN BASE64)
// - NÚT ⚡ UPDATE LƯU NGƯỢC VỀ SUPABASE / NGÂN HÀNG CÂU HỎI / PHÒNG THI
// - TẢI FILE .JSON & ĐĂNG ĐỀ TRỰC TIẾP LÊN CÁC LỚP
// =========================================================

function triggerSoiDeUpload() {
    const input = document.getElementById("soide-file-input");
    if (input) { input.value = ""; input.click(); }
}

function handleSoiDeFileSelected(input) {
    if (input.files && input.files[0]) readAndParseSoiDeFile(input.files[0]);
}

function readAndParseSoiDeFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            const parsed = robustParseExamScriptOrJson(text);
            if (!parsed) throw new Error("File rỗng hoặc không đúng cấu trúc!");

            let rawQuestions = [];
            let rawImages = {};

            if (Array.isArray(parsed)) {
                rawQuestions = parsed;
                soiDeState.examData = {
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    maDe: "101",
                    timeLimitMinutes: 90,
                    images: {},
                    questions: reorganizeAllQuestionsByParts(rawQuestions)
                };
            } else if (typeof parsed === "object") {
                rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
                rawImages = (parsed.images && typeof parsed.images === "object") ? parsed.images : {};

                if (typeof synchronizeExamQuestionsAndImages === "function") {
                    rawQuestions = synchronizeExamQuestionsAndImages(rawQuestions, rawImages);
                } else {
                    rawQuestions.forEach(q => {
                        if (!q) return;
                        const directUrl = soideResolveImgUrl(q, rawImages);
                        if (directUrl) {
                            q.imageUrl = directUrl;
                            q.imageKey = q.imageKey || `img_q_${q.id}`;
                            if (!rawImages[q.imageKey]) rawImages[q.imageKey] = directUrl;
                        }
                    });
                }

                soiDeState.examData = {
                    title: parsed.title || file.name.replace(/\.[^/.]+$/, ""),
                    maDe: parsed.maDe || parsed.made || "101",
                    timeLimitMinutes: parseInt(parsed.timeLimitMinutes || parsed.time_limit_minutes, 10) || 90,
                    images: rawImages,
                    questions: reorganizeAllQuestionsByParts(rawQuestions)
                };
            }

            soiDeState.isFromQBank = false;
            renderSoiDeBothSides();
            alert(`✅ ĐÃ NẠP THÀNH CÔNG ĐỀ THI!\n\n- Tên đề: ${soiDeState.examData.title}\n- Tổng số câu: ${soiDeState.examData.questions.length} câu.`);
        } catch (err) {
            alert("❌ Lỗi đọc file đề thi: " + err.message);
        }
    };
    reader.readAsText(file);
}

function triggerSoiDePastePrompt(qId, imgKey) {
    const zone = document.getElementById(`zone-soide-${qId}`);
    if (zone) zone.focus();
    showSoiDeToast("📋 Đã chọn ô dán ảnh! Hãy nhấn Ctrl + V để dán ảnh chụp ngay.");
}

function handleSoiDeQuestionImageSelected(input, qId, imgKey) {
    if (input.files && input.files[0]) uploadSoiDeImage(input.files[0], qId, imgKey);
}

async function uploadSoiDeImage(file, qId, imgKey) {
    if (!file) return;
    const statusEl = document.getElementById(`status-soide-${qId}`);
    if (statusEl) {
        statusEl.className = "admin-uploader-status loading";
        statusEl.innerText = "⏳ Đang tải ảnh...";
    }

    const targetQ = (soiDeState.examData.questions || []).find(item => String(item.id) === String(qId));

    try {
        let directUrl = "";

        if (typeof window.uploadDualQuestionImage === "function" && targetQ) {
            const dualRes = await window.uploadDualQuestionImage(file, targetQ, {
                contextTitle: (soiDeState.examData && soiDeState.examData.title) || "SoiDe",
                imgKey: imgKey,
                onStatus: (msg) => {
                    const el = document.getElementById(`status-soide-${qId}`);
                    if (el) { el.className = "admin-uploader-status loading"; el.innerText = msg; }
                },
                onBackupComplete: () => {
                    showSoiDeToast("☁️ Đã sao lưu ngầm ảnh sang Google Drive 5TB!");
                }
            });
            directUrl = dualRes.primaryUrl;
        } else {
            let b64 = "";
            let mimeType = file.type || "image/png";

            if (typeof compressQbankImageToBase64 === "function") {
                const comp = await compressQbankImageToBase64(file, 1600, 0.86);
                b64 = comp.base64;
                mimeType = comp.mimeType;
            } else {
                b64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_API_KEY")) {
                const controller = new AbortController();
                const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 6500);
                try {
                    const formData = new FormData();
                    formData.append("image", b64);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                        method: "POST",
                        body: formData,
                        signal: controller.signal
                    });
                    clearTimeout(timer);
                    if (res && res.ok) {
                        const json = await res.json().catch(() => null);
                        if (json && json.success && json.data) {
                            directUrl = json.data.display_url || json.data.url || "";
                        }
                    }
                } catch (imgErr) {
                    clearTimeout(timer);
                }
            }

            if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL && !GOOGLE_DRIVE_UPLOAD_GAS_URL.includes("DÁN_URL")) {
                const controller = new AbortController();
                const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 45000);
                try {
                    const driveRes = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({
                            action: "uploadQuestionImageBackup",
                            path: "KHO_TAI_LIEU_PDF_WORD_ANH_VIDEO/Kho_anh_de_thi/Soi_De",
                            filename: `soide_cau_${qId}_${Date.now()}.png`,
                            mimeType: mimeType,
                            base64: b64
                        }),
                        signal: controller.signal
                    }).then(r => r.json());
                    clearTimeout(timer);
                    if (driveRes && (driveRes.directUrl || driveRes.fileUrl)) {
                        directUrl = (typeof toDirectGoogleDriveImageUrl === "function")
                            ? toDirectGoogleDriveImageUrl(driveRes.directUrl || driveRes.fileUrl)
                            : (driveRes.directUrl || driveRes.fileUrl);
                    }
                } catch (driveErr) {
                    clearTimeout(timer);
                }
            }

            if (!directUrl || /^\s*data:/i.test(directUrl)) {
                throw new Error("Không thể tải ảnh lên ImgBB và Google Drive (lỗi mạng hoặc quá giờ). Đã chặn lưu Base64 để tránh làm đầy Database!");
            }
        }

        if (!soiDeState.examData.images) soiDeState.examData.images = {};
        soiDeState.examData.images[imgKey] = directUrl;
        if (targetQ) {
            targetQ.imageUrl = directUrl;
            targetQ.imageKey = imgKey;
        }

        renderSoiDeBothSides();

        const freshStatusEl = document.getElementById(`status-soide-${qId}`);
        if (freshStatusEl) {
            freshStatusEl.className = "admin-uploader-status success";
            freshStatusEl.innerText = "✅ Đã gán ảnh!";
            setTimeout(() => { if (freshStatusEl) freshStatusEl.innerText = ""; }, 3000);
        }
        showSoiDeToast("🖼️ Đã chèn ảnh thành công! Nhấn ⚡ Update để lưu.");
    } catch (err) {
        const freshStatusEl = document.getElementById(`status-soide-${qId}`);
        if (freshStatusEl) {
            freshStatusEl.className = "admin-uploader-status error";
            freshStatusEl.innerText = "❌ Lỗi: " + err.message;
        }
        alert("Lỗi tải ảnh: " + err.message);
    }
}

function deleteSoiDeQuestionImage(qId, imgKey) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA ảnh của câu này không?")) return;
    if (soiDeState.examData.images) {
        delete soiDeState.examData.images[imgKey];
        delete soiDeState.examData.images[`img_q_${qId}`];
    }
    const targetQ = (soiDeState.examData.questions || []).find(item => String(item.id) === String(qId));
    if (targetQ) {
        targetQ.imageUrl = "";
        targetQ.imageBackupUrl = "";
        targetQ.imageDriveFileId = "";
        targetQ.imageDriveUrl = "";
        targetQ.imageDriveFolderUrl = "";
        targetQ.imageDrivePath = "";
        targetQ.imageDriveFilename = "";
    }
    renderSoiDeBothSides();
    showSoiDeToast("🗑️ Đã xóa ảnh của câu hỏi.");
}

function downloadSoiDeJson() {
    if (soiDeState.editorMode === "raw") {
        const rawEditor = document.getElementById("soide-raw-editor");
        if (rawEditor) syncSoiDeFromRawText(rawEditor.value);
    }
    try {
        const jsonStr = JSON.stringify(soiDeState.examData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
        const safeTitle = (soiDeState.examData.title || "De_Thi").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, "_");
        const fileName = `${safeTitle}_Made_${soiDeState.examData.maDe || "101"}.json`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) {
        alert("❌ Lỗi xuất file JSON: " + e.message);
    }
}

function flushOpenRawCardEditorsInSoiDe() {
    if (soiDeState.editorMode !== "cards" || !soiDeState.rawEditingCardIds || soiDeState.rawEditingCardIds.size === 0) return;
    const questions = soiDeState.examData.questions || [];
    Array.from(soiDeState.rawEditingCardIds).forEach(qId => {
        const ta = document.getElementById(`soide-card-raw-text-${qId}`);
        if (!ta) return;
        const rawVal = (ta.value || "").trim();
        if (!rawVal) return;
        const idx = questions.findIndex(item => String(item.id) === String(qId));
        if (idx === -1) return;

        const targetQ = questions[idx];
        const parsedJson = robustParseExamScriptOrJson(rawVal);
        if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson) && parsedJson.question) {
            const merged = { ...targetQ, ...parsedJson };
            const explicitPart = parseInt(parsedJson.part, 10);
            if (explicitPart >= 1 && explicitPart <= 4) {
                merged.part = explicitPart;
                merged.isPart4 = (explicitPart === 4);
            } else if (parsedJson.isPart4 !== undefined) {
                merged.isPart4 = !!parsedJson.isPart4;
                merged.part = merged.isPart4 ? 4 : (merged.type === "multiple_choice" ? 1 : (merged.type === "true_false" ? 2 : 3));
            }
            questions[idx] = merged;
        } else {
            const parsedSmart = parseSmartSingleQuestion(rawVal);
            if (parsedSmart) {
                targetQ.type = parsedSmart.type;
                targetQ.question = parsedSmart.question;
                if (parsedSmart.options) targetQ.options = parsedSmart.options;
                if (parsedSmart.statements) targetQ.statements = parsedSmart.statements;
                if (parsedSmart.correct !== undefined) targetQ.correct = parsedSmart.correct;
                if (parsedSmart.correctAnswer !== undefined) targetQ.correctAnswer = parsedSmart.correctAnswer;
                if (parsedSmart.explanation !== undefined) targetQ.explanation = parsedSmart.explanation;
                const explicitPart = parseInt(parsedSmart.part, 10);
                if (explicitPart >= 1 && explicitPart <= 4) {
                    targetQ.part = explicitPart;
                    targetQ.isPart4 = (explicitPart === 4);
                }
            }
        }
    });
}

async function updateExamFromSoiDe() {
    if (soiDeState.editorMode === "raw") {
        const rawEditor = document.getElementById("soide-raw-editor");
        if (rawEditor && !syncSoiDeFromRawText(rawEditor.value)) {
            alert("❌ Mã nguồn thô đang bị lỗi cú pháp! Vui lòng kiểm tra lại trước khi Update.");
            return;
        }
    } else {
        flushOpenRawCardEditorsInSoiDe();
    }

    const btn = document.getElementById("btn-soide-update-exam");
    if (!soiDeState.examData || !Array.isArray(soiDeState.examData.questions) || soiDeState.examData.questions.length === 0) {
        alert("⚠️ Đề thi hiện chưa có câu hỏi nào để cập nhật!");
        return;
    }

    const errors = validateExamSyntax(soiDeState.examData.questions);
    if (errors.length > 0) {
        if (!confirm(`⚠️ Có ${errors.length} cảnh báo cú pháp (VD: ${errors[0]}).\nBạn có muốn tiếp tục lưu không?`)) {
            return;
        }
    }

    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang cập nhật..."; }

    try {
        const imagesMap = { ...(soiDeState.examData.images || {}) };
        const letters = ["A", "B", "C", "D"];

        const cleanQuestions = reorganizeAllQuestionsByParts(soiDeState.examData.questions).map((q, idx) => {
            const item = JSON.parse(JSON.stringify(q));
            if (!soiDeState.isFromQBank) item.id = item.id || (idx + 1);

            const pType = (typeof getQuestionPartType === "function")
                ? getQuestionPartType(item)
                : (isPart4Question(item) ? 4 : (item.type === "true_false" ? 2 : (item.type === "short_answer" ? 3 : 1)));

            item.part = pType;
            item.isPart4 = (pType === 4);

            if (pType === 1) {
                item.type = "multiple_choice";
                if (typeof item.correct === "string") {
                    const u = item.correct.trim().toUpperCase();
                    item.correct = letters.indexOf(u) !== -1 ? letters.indexOf(u) : 0;
                } else if (item.correct === undefined || item.correct === null) {
                    item.correct = 0;
                }
            } else if (pType === 2) {
                item.type = "true_false";
                if (Array.isArray(item.statements)) {
                    item.statements.forEach(st => {
                        st.correct = (st.correct === true || String(st.correct).toLowerCase() === "đúng" || String(st.correct).toLowerCase() === "true");
                    });
                }
            } else {
                if (pType === 3) item.type = "short_answer";
                else if (item.type !== "essay" && item.type !== "essay_answer" && item.type !== "part4") item.type = "short_answer";

                if (item.correctAnswer === undefined || item.correctAnswer === null) {
                    item.correctAnswer = String(item.correct || item.answer || "0").trim();
                } else {
                    item.correctAnswer = String(item.correctAnswer).trim();
                }
            }

            const directUrl = soideResolveImgUrl(item, imagesMap);
            if (directUrl && !/^\s*data:/i.test(directUrl)) {
                item.imageUrl = directUrl;
                item.imageKey = item.imageKey || `img_q_${item.id}`;
                imagesMap[item.imageKey] = directUrl;
            }
            return item;
        });

        if (soiDeState.isFromQBank) {
            if (typeof qbankState !== "undefined") {
                if (typeof pushQbankUndoState === "function") pushQbankUndoState("Cập nhật từ công cụ Soi đề");
                const updatedMap = new Map(cleanQuestions.map(q => [String(q.id), q]));
                const existingIds = new Set((qbankState.rawQuestions || []).map(q => String(q.id)));

                qbankState.rawQuestions = (qbankState.rawQuestions || []).map(origQ => {
                    return updatedMap.has(String(origQ.id)) ? updatedMap.get(String(origQ.id)) : origQ;
                });
                cleanQuestions.forEach(cq => {
                    if (!existingIds.has(String(cq.id))) qbankState.rawQuestions.push(cq);
                });

                qbankState.imagesMap = { ...(qbankState.imagesMap || {}), ...imagesMap };
                if (typeof recomputeAllMatrixIds === "function") recomputeAllMatrixIds();
                if (typeof saveQbankDraftState === "function") await saveQbankDraftState(false);
                if (typeof renderQbankHeaderAndMidExamTitle === "function") renderQbankHeaderAndMidExamTitle();
                if (typeof renderQbankTree === "function") renderQbankTree();
                if (typeof renderQbankQuestions === "function") renderQbankQuestions();
                if (typeof updateQbankMatrixStats === "function") updateQbankMatrixStats();
                if (typeof updateQbankBuilderStats === "function") updateQbankBuilderStats();
            }
            alert(`🎉 ĐÃ LƯU TRỞ LẠI NGÂN HÀNG ĐỀ THÀNH CÔNG!\n\nĐã cập nhật chuẩn xác ${cleanQuestions.length} câu hỏi.`);
            closeSoiDeModal();
            return;
        }

        const client = (typeof getSupabaseClient === "function")
            ? getSupabaseClient()
            : (typeof supabaseClient !== "undefined" ? supabaseClient : null);
        if (!client) {
            alert("❌ Chưa kết nối được máy chủ Supabase! Vui lòng kiểm tra lại app-config.js.");
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        let quizId = soiDeState.examData.id || urlParams.get("id") || (typeof examData !== "undefined" && examData ? examData.id : null);
        if (!quizId) {
            quizId = "quiz_" + Date.now();
            soiDeState.examData.id = quizId;
        }

        const finalTitle = soiDeState.examData.title || "ĐỀ THI TRẮC NGHIỆM";
        const finalMade = soiDeState.examData.maDe || "101";
        const finalMinutes = parseInt(soiDeState.examData.timeLimitMinutes, 10) || 90;

        if (String(quizId).startsWith("exam_bank_") && typeof qbankState !== "undefined" && Array.isArray(qbankState.savedExams)) {
            const bankIdx = qbankState.savedExams.findIndex(e => String(e.id) === String(quizId));
            if (bankIdx !== -1) {
                qbankState.savedExams[bankIdx] = {
                    ...qbankState.savedExams[bankIdx],
                    title: finalTitle,
                    questionCount: cleanQuestions.length,
                    questions: cleanQuestions,
                    images: imagesMap
                };
                try { localStorage.setItem("qbank_saved_exams", JSON.stringify(qbankState.savedExams)); } catch (e) {}
                const { error: bankErr } = await client
                    .from("app_key_values")
                    .upsert({ key: "qbank_saved_exams", value: qbankState.savedExams }, { onConflict: "key" });
                if (bankErr) throw bankErr;

                if (typeof filterSavedExamsList === "function") filterSavedExamsList(qbankState.savedExamFilter || "all");
                soiDeState.examData.questions = cleanQuestions;
                soiDeState.examData.images = imagesMap;
                soiDeState.rawEditingCardIds.clear();
                renderSoiDeBothSides();
                alert(`🎉 ĐÃ CẬP NHẬT ĐỀ "${finalTitle}" TRONG NGÂN HÀNG ĐỀ ĐÃ LƯU (${cleanQuestions.length} câu)!`);
                return;
            }
        }

        const { error: qErr } = await client.from("quizzes").upsert({
            id: quizId,
            title: finalTitle,
            made: finalMade,
            time_limit_minutes: finalMinutes,
            questions: cleanQuestions,
            images: imagesMap,
            scoring_config: soiDeState.examData.scoringConfig || { mode: "option1" }
        }, { onConflict: "id" });

        if (qErr) throw qErr;

        try {
            await client.from("custom_links").update({
                title: finalTitle,
                time_limit_minutes: finalMinutes
            }).eq("id", quizId);
        } catch (cErr) {}

        if (typeof window.SECURE_VAULT !== "undefined") {
            window.SECURE_VAULT.answers = window.SECURE_VAULT.answers || {};
            window.SECURE_VAULT.explanations = window.SECURE_VAULT.explanations || {};

            cleanQuestions.forEach(q => {
                const qKey = `q${q.id}`;
                if (q.type === "multiple_choice" && !isPart4Question(q)) {
                    window.SECURE_VAULT.answers[qKey] = typeof q.correct === "number" ? letters[q.correct] : String(q.correct).trim().toUpperCase();
                } else if (q.type === "true_false" && !isPart4Question(q)) {
                    (q.statements || []).forEach(st => {
                        window.SECURE_VAULT.answers[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === "đúng") ? "Đúng" : "Sai";
                    });
                } else {
                    window.SECURE_VAULT.answers[qKey] = String(q.correctAnswer || "").trim();
                }
                if (q.explanation) window.SECURE_VAULT.explanations[qKey] = q.explanation;
            });
        }

        if (typeof examData !== "undefined" && examData) {
            const clonedQuestions = JSON.parse(JSON.stringify(cleanQuestions));
            const clonedImages = JSON.parse(JSON.stringify(imagesMap));

            window.ORIGINAL_EXAM_DATA = JSON.parse(JSON.stringify({
                ...examData,
                title: finalTitle,
                made: finalMade,
                time_limit_minutes: finalMinutes,
                questions: clonedQuestions,
                images: clonedImages
            }));

            examData.title = finalTitle;
            examData.made = finalMade;
            examData.timeLimitMinutes = finalMinutes;
            examData.time_limit_minutes = finalMinutes;
            examData.questions = clonedQuestions;
            examData.images = clonedImages;

            if (typeof EXAM_NAME !== "undefined") EXAM_NAME = finalTitle;
            const bannerTitle = document.getElementById("banner-title");
            if (bannerTitle) bannerTitle.innerText = finalTitle;
            const navCodeText = document.getElementById("nav-exam-code-text");
            if (navCodeText) navCodeText.innerText = `Đề: ${finalMade}`;

            try {
                if (typeof getExamCode === "function" && typeof safeLocal !== "undefined") {
                    safeLocal.setItem(`shuffled_exam_${quizId}_${getExamCode()}`, JSON.stringify(clonedQuestions));
                    safeLocal.setItem(`shuffled_exam_${getExamCode()}`, JSON.stringify(clonedQuestions));
                }
            } catch (e) {}

            if (typeof renderQuizLayout === "function") {
                renderQuizLayout(clonedQuestions, clonedImages);
                if (typeof reapplySavedAnswers === "function") reapplySavedAnswers();
                if (typeof updateProgress === "function") updateProgress();
            }
            if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise().catch(() => {});
        }

        soiDeState.examData.questions = cleanQuestions;
        soiDeState.examData.images = imagesMap;
        soiDeState.rawEditingCardIds.clear();
        renderSoiDeBothSides();

        alert(`🎉 ĐÃ CẬP NHẬT (UPDATE) ĐỀ THI VÀ ĐÁP ÁN THÀNH CÔNG!\n\n📑 Tên đề: "${finalTitle}"\n🔢 Tổng số: ${cleanQuestions.length} câu hỏi\n⏱ Thời gian: ${finalMinutes} phút\n\nToàn bộ hình ảnh, phần câu hỏi và đáp án đã được đồng bộ chuẩn xác!`);
    } catch (err) {
        alert("❌ Lỗi khi cập nhật đề thi: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "⚡ Update"; }
    }
}

function toggleSoiDeClassDropdown(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const drop = document.getElementById("soide-class-dropdown");
    if (drop) drop.classList.toggle("show");
}

function toggleAllSoiDeClasses(checkAll) {
    document.querySelectorAll('input[name="soide-target-class"]').forEach(cb => {
        cb.checked = checkAll;
        const parent = cb.closest(".soide-class-chk-item");
        if (parent) parent.classList.toggle("checked", checkAll);
    });
}

function handleSoiDeClassCheckChange(cb) {
    const parent = cb.closest(".soide-class-chk-item");
    if (parent) parent.classList.toggle("checked", cb.checked);
}

async function submitExamToSelectedClasses() {
    if (soiDeState.editorMode === "raw") {
        const rawEditor = document.getElementById("soide-raw-editor");
        if (rawEditor && !syncSoiDeFromRawText(rawEditor.value)) {
            alert("❌ Mã nguồn thô đang bị lỗi cú pháp! Vui lòng kiểm tra lại trước khi đăng đề.");
            return;
        }
    } else {
        flushOpenRawCardEditorsInSoiDe();
    }

    const checkedBoxes = Array.from(document.querySelectorAll('input[name="soide-target-class"]:checked'));
    const selectedClasses = checkedBoxes.map(cb => cb.value);

    if (selectedClasses.length === 0) {
        alert("⚠️ Vui lòng tích chọn ít nhất 1 lớp để tải đề lên!");
        return;
    }

    const currentData = soiDeState.examData;
    if (!currentData || !Array.isArray(currentData.questions) || currentData.questions.length === 0) {
        alert("⚠️ Đề thi hiện chưa có câu hỏi nào để tải lên!");
        return;
    }

    const btn = document.getElementById("btn-submit-upload-classes");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang tải lên Supabase..."; }

    const client = (typeof getSupabaseClient === "function")
        ? getSupabaseClient()
        : (typeof supabaseClient !== "undefined" ? supabaseClient : null);
    if (!client) {
        alert("❌ Không tìm thấy Supabase Client kết nối máy chủ!");
        if (btn) { btn.disabled = false; btn.innerText = "🚀 Xác nhận đăng đề"; }
        return;
    }

    try {
        const quizId = "quiz_" + Date.now();
        const now = new Date();
        const pad = n => String(n).padStart(2, "0");
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const finalTimeLimit = parseInt(currentData.timeLimitMinutes, 10) || 90;
        const examTitle = currentData.title || `ĐỀ THI ${dateStr}`;
        const maDe = currentData.maDe || "101";

        let cleanQuestions = reorganizeAllQuestionsByParts(currentData.questions).map(q => {
            const item = JSON.parse(JSON.stringify(q));
            const pType = (typeof getQuestionPartType === "function") ? getQuestionPartType(item) : (isPart4Question(item) ? 4 : 1);
            item.part = pType;
            item.isPart4 = (pType === 4);
            return item;
        });
        const imagesMap = { ...(currentData.images || {}) };

        if (typeof synchronizeExamQuestionsAndImages === "function") {
            cleanQuestions = synchronizeExamQuestionsAndImages(cleanQuestions, imagesMap);
        } else {
            cleanQuestions.forEach(q => {
                if (!q) return;
                const directUrl = soideResolveImgUrl(q, imagesMap);
                if (directUrl) {
                    q.imageUrl = directUrl;
                    q.imageKey = q.imageKey || `img_q_${q.id}`;
                    imagesMap[q.imageKey] = directUrl;
                }
            });
        }

        const { error: qErr } = await client.from("quizzes").insert([{
            id: quizId,
            title: examTitle,
            made: maDe,
            time_limit_minutes: finalTimeLimit,
            exam_start_time: null,
            exam_end_time: null,
            scoring_config: { mode: "option1" },
            images: imagesMap,
            questions: cleanQuestions
        }]);
        if (qErr) throw qErr;

        const defaultAvatar = (typeof PRESET_AVATARS !== "undefined" && PRESET_AVATARS[0])
            ? PRESET_AVATARS[0]
            : "https://i.ibb.co/HTPxzDtT/khung-long-bao-chua.jpg";

        const linkRows = selectedClasses.map(cat => ({
            id: quizId,
            category_id: cat,
            title: examTitle,
            date: dateStr,
            url: `./thi.html?id=${quizId}&cat=${encodeURIComponent(cat)}`,
            badge_text: "HOT",
            is_hot: true,
            is_doc: false,
            avatar: defaultAvatar,
            timestamp: Date.now(),
            is_shuffled: true,
            allow_free: true,
            time_limit_minutes: finalTimeLimit,
            scoring_config: { mode: "option1" }
        }));

        const { error: cErr } = await client.from("custom_links").insert(linkRows);
        if (cErr) throw cErr;

        const classNames = selectedClasses.map(id => {
            const f = SOI_DE_AVAILABLE_CLASSES.find(c => c.id === id);
            return f ? f.name : id;
        }).join(", ");

        alert(`🎉 ĐÃ ĐĂNG ĐỀ THI LÊN ${selectedClasses.length} LỚP THÀNH CÔNG!\n\n📑 Đề: "${examTitle}" (${finalTimeLimit} phút)\n🏫 Danh sách lớp: ${classNames}`);

        const drop = document.getElementById("soide-class-dropdown");
        if (drop) drop.classList.remove("show");
        window.location.reload();
    } catch (err) {
        alert("❌ Lỗi khi đăng đề lên lớp: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "🚀 Xác nhận đăng đề"; }
    }
}

// Xuất ra window scope
window.triggerSoiDeUpload = triggerSoiDeUpload;
window.handleSoiDeFileSelected = handleSoiDeFileSelected;
window.readAndParseSoiDeFile = readAndParseSoiDeFile;
window.triggerSoiDePastePrompt = triggerSoiDePastePrompt;
window.handleSoiDeQuestionImageSelected = handleSoiDeQuestionImageSelected;
window.uploadSoiDeImage = uploadSoiDeImage;
window.deleteSoiDeQuestionImage = deleteSoiDeQuestionImage;
window.downloadSoiDeJson = downloadSoiDeJson;
window.updateExamFromSoiDe = updateExamFromSoiDe;
window.toggleSoiDeClassDropdown = toggleSoiDeClassDropdown;
window.toggleAllSoiDeClasses = toggleAllSoiDeClasses;
window.handleSoiDeClassCheckChange = handleSoiDeClassCheckChange;
window.submitExamToSelectedClasses = submitExamToSelectedClasses;
