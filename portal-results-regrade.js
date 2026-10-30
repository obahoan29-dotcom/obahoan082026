// =========================================================
// FILE: portal-results-regrade.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG)
// BỔ SUNG: XỬ LÝ NẠP FILE JSON NỘP SÓT VÀ CHẤM BÙ TỰ ĐỘNG KHÔNG GHI ĐÈ
// =========================================================

function closeResultModal(triggerHistoryBack = true) {
    stopAutoRefreshResult();
    if (typeof stopRealtimeSubmissionsListener === 'function') stopRealtimeSubmissionsListener();
    const modal = document.getElementById("result-fullscreen-modal");
    if (modal) modal.style.display = "none";
    closeRegradeModal();
    
    // FIX LỖI: Nhả khóa cuộn màn hình để chuột có thể lăn được trang chính
    document.body.classList.remove("modal-backdrop-locked");
    
    if (triggerHistoryBack && window.location.hash.startsWith("#bang-ket-qua")) { window.history.back(); }
}

function startAutoRefreshResult() {
    stopAutoRefreshResult();
    if (!isAutoRefreshEnabled) return;
    // Chu kỳ hẹn giờ an toàn 60 giây dự phòng (Realtime đã xử lý tức thì 0s)
    autoRefreshTimer = setInterval(async () => {
        const modal = document.getElementById("result-fullscreen-modal");
        if (modal && modal.style.display === "flex" && currentExamResultData.item) {
            await fetchAndRenderExamResults(currentExamResultData.item, true);
        }
    }, 60000); 
}

function stopAutoRefreshResult() {
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
}

function toggleAutoRefresh(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    isAutoRefreshEnabled = !isAutoRefreshEnabled;
    const btn = document.getElementById("btn-toggle-autorefresh");
    if (isAutoRefreshEnabled) {
        if (btn) { btn.innerHTML = "🟢 Tự động: BẬT"; btn.style.color = "#38bdf8"; btn.style.borderColor = "#38bdf8"; }
        startAutoRefreshResult();
    } else {
        if (btn) { btn.innerHTML = "⚪ Tự động: TẮT"; btn.style.color = "#94a3b8"; btn.style.borderColor = "#64748b"; }
        stopAutoRefreshResult();
    }
}

function openRegradeModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const dropdown = document.getElementById("regrade-inline-dropdown");
    const preview = document.getElementById("regrade-file-preview-status");
    const fileInput = document.getElementById("regrade-answer-file");

    if (!dropdown) return;
    if (dropdown.style.display === "block") { dropdown.style.display = "none"; return; }

    if (fileInput) fileInput.value = "";
    if (preview) { preview.style.display = "none"; preview.innerText = ""; }
    _regradeFileParsedAnswers = null; 
    dropdown.style.display = "block";
}

function closeRegradeModal(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById("regrade-inline-dropdown");
    if (dropdown) dropdown.style.display = "none";
    _regradeFileParsedAnswers = null;
}

async function previewRegradeFile(input) {
    const preview = document.getElementById("regrade-file-preview-status");
    if (!input.files || input.files.length === 0) {
        if (preview) preview.style.display = "none";
        _regradeFileParsedAnswers = null; return;
    }
    const file = input.files[0];
    try {
        const text = file.text ? await file.text() : await readFileAsTextAsync(file); 
        const parsed = parseScriptOrJson(text);
        if (!parsed) throw new Error("Không thể phân tích file đáp án!");
        const answersMap = parsed.answers || parsed.dapan || parsed;
        const count = Object.keys(answersMap).length;

        _regradeFileParsedAnswers = parsed;
        if (preview) {
            preview.style.display = "block"; preview.style.color = "#0369a1";
            preview.innerHTML = `✅ Đã đọc thành công <b>${file.name}</b> (${count} câu). Bấm nút bên dưới để chấm lại!`;
        }
    } catch(err) {
        _regradeFileParsedAnswers = null;
        if (preview) {
            preview.style.display = "block"; preview.style.color = "#dc2626";
            preview.innerText = "❌ Lỗi: " + err.message;
        }
    }
}

// BỘ MÁY CHẤM LẠI BÀI QUA SUPABASE
async function processRegradeWithAnswers() {
    const btn = document.getElementById("btn-confirm-regrade");
    const currentItem = currentExamResultData.item;
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!currentItem || !client) return;

    let quizId = extractQuizIdFromItem(currentItem);
    btn.disabled = true; btn.innerText = "⏳ Đang nạp đề gốc...";

    try {
        const { data: quizObj, error: qErr } = await client.from('quizzes').select('*').eq('id', quizId).single();
        if (qErr || !quizObj || !quizObj.questions) throw new Error("Không tìm thấy đề thi gốc!");

        if (_regradeFileParsedAnswers) {
            quizObj.questions = mergeQuestionsAndAnswers({ questions: quizObj.questions }, _regradeFileParsedAnswers).questions;
            await client.from('quizzes').update({ questions: quizObj.questions }).match({ id: quizId });
        }

        const newAnswerKey = {}; const letters = ["A", "B", "C", "D"];
        quizObj.questions.forEach(q => {
            if (q.type === "multiple_choice" && q.correct !== undefined) {
                newAnswerKey[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
            } else if (q.type === "true_false" && q.statements) {
                q.statements.forEach(st => {
                    newAnswerKey[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                });
            } else if (q.correctAnswer !== undefined) {
                newAnswerKey[`q${q.id}`] = String(q.correctAnswer).trim();
            }
        });

        const scoringConfig = quizObj.scoring_config || { mode: 'option1' };

        // Lấy danh sách bài đã nộp của đề này
        const { data: subs } = await client.from('submissions').select('*').eq('quiz_id', quizId);
        let updatedCount = 0;

        if (Array.isArray(subs)) {
            for (const sub of subs) {
                const userAns = sub.user_answers || {};
                const scoreRes = calculateExamScoreWithConfig(quizObj.questions, userAns, newAnswerKey, scoringConfig);

                await client.from('submissions').update({
                    score10: scoreRes.finalScore,
                    raw_score: scoreRes.totalRawScore,
                    correct_count: scoreRes.correctCount,
                    wrong_count: scoreRes.wrongCount,
                    data_string: scoreRes.dataDetails.join(" | ")
                }).match({ id: sub.id });

                updatedCount++;
            }
        }

        alert(`🎉 CHẤM LẠI THÀNH CÔNG!\nĐã tính lại điểm chính xác cho ${updatedCount} bài làm.`);
        closeRegradeModal(); 
        await refreshCurrentExamResults();
    } catch(err) {
        alert("❌ Lỗi: " + err.message);
    } finally { 
        btn.disabled = false; btn.innerText = "🚀 Chấm lại ngay"; 
    }
}

// =========================================================================
// BỘ XỬ LÝ UPLOAD BÀI THI TỪ FILE JSON DỰ PHÒNG NỘP SÓT (BẢO TOÀN 100%)
// =========================================================================

function triggerUploadBackupJson(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const input = document.getElementById("input-upload-backup-json");
    if (!input) {
        alert("⚠️ Không tìm thấy ô tải tệp!");
        return;
    }
    input.value = "";
    input.click();
}

async function handleBackupJsonFileInput(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : supabaseClient;
    if (!client) {
        alert("❌ Chưa thể kết nối cơ sở dữ liệu Supabase!");
        return;
    }

    const currentItem = currentExamResultData.item;
    let targetQuizId = currentItem ? (extractQuizIdFromItem(currentItem) || currentItem.id) : "";

    const btn = document.getElementById("btn-upload-json-backup");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Đang nạp...";
    }

    try {
        const text = file.text ? await file.text() : await readFileAsTextAsync(file);
        let parsed = parseScriptOrJson(text);
        if (!parsed) throw new Error("Tệp chọn không đúng định dạng JSON chuẩn!");

        // Hỗ trợ cả file chứa 1 bài nộp (Object) hoặc nhiều bài nộp gộp chung (Array)
        const itemsToProcess = Array.isArray(parsed) ? parsed : [parsed];
        let successCount = 0;

        for (const data of itemsToProcess) {
            if (!data || typeof data !== 'object') continue;

            const effectiveQuizId = targetQuizId || data.quiz_id || data.quizId || "exam";
            const sbdClean = String(data.sbd || data.studentId || "user").replace(/[^a-zA-Z0-9]/g, '_');
            const nowTime = data.createdAt || Date.now();
            
            // FIX QUAN TRỌNG: Gắn mốc thời gian để không ghi đè bài thi trước
            const subId = data.id || `${effectiveQuizId}_${sbdClean}_${nowTime}`;
            const studentName = data.student_name || data.studentName || data.name || "Học sinh";
            const className = data.class_name || data.className || data.studentClass || "Lớp";
            const currentCat = data.category_id || data.categoryId || currentExamResultData.categoryId || "them-11";
            const examTitle = (currentItem && currentItem.title) || data.exam_title || data.examTitle || "Đề thi";
            const userAnswers = data.user_answers || data.userAnswers || {};

            let score10 = (data.score10 !== undefined && data.score10 !== null) ? parseFloat(data.score10) : null;
            let rawScore = (data.raw_score !== undefined || data.rawScore !== undefined) ? parseFloat(data.raw_score || data.rawScore) : null;
            let maxScale = parseFloat(data.max_scale || data.maxScale) || 10.0;
            let correctCount = (data.correct_count !== undefined || data.correctCount !== undefined) ? parseInt(data.correct_count || data.correctCount, 10) : null;
            let wrongCount = (data.wrong_count !== undefined || data.wrongCount !== undefined) ? parseInt(data.wrong_count || data.wrongCount, 10) : null;
            let dataString = data.data_string || data.dataString || "";

            // Nếu file JSON là bản lưu nháp chưa kịp tính điểm, tự động chấm điểm ngay theo đáp án đề gốc
            if ((score10 === null || isNaN(score10)) && Object.keys(userAnswers).length > 0) {
                try {
                    const { data: quizObj } = await client.from('quizzes').select('*').eq('id', effectiveQuizId).single();
                    if (quizObj && Array.isArray(quizObj.questions)) {
                        const answerKey = {};
                        const letters = ["A", "B", "C", "D"];
                        quizObj.questions.forEach(q => {
                            if (q.type === "multiple_choice" && q.correct !== undefined) {
                                answerKey[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
                            } else if (q.type === "true_false" && q.statements) {
                                q.statements.forEach(st => {
                                    answerKey[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                                });
                            } else if (q.correctAnswer !== undefined) {
                                answerKey[`q${q.id}`] = String(q.correctAnswer).trim();
                            }
                        });
                        const scoreRes = calculateExamScoreWithConfig(quizObj.questions, userAnswers, answerKey, quizObj.scoring_config || { mode: 'option1' });
                        score10 = scoreRes.finalScore;
                        rawScore = scoreRes.totalRawScore;
                        maxScale = scoreRes.maxScale;
                        correctCount = scoreRes.correctCount;
                        wrongCount = scoreRes.wrongCount;
                        dataString = scoreRes.dataDetails.join(" | ") + " | [TỰ ĐỘNG CHẤM TỪ BẢN LƯU NHÁP]";
                    }
                } catch(calcErr) {
                    console.warn("Không thể tính điểm tự động:", calcErr);
                }
            }

            if (score10 === null || isNaN(score10)) score10 = 0;
            if (rawScore === null || isNaN(rawScore)) rawScore = 0;
            if (correctCount === null || isNaN(correctCount)) correctCount = 0;
            if (wrongCount === null || isNaN(wrongCount)) wrongCount = 0;
            if (!dataString) dataString = "[NỘP BỔ SUNG TỪ FILE JSON]";

            const payloadRow = {
                id: subId,
                quiz_id: effectiveQuizId,
                sbd: sbdClean,
                student_name: studentName,
                class_name: className,
                score10: score10,
                raw_score: rawScore,
                max_scale: maxScale,
                correct_count: correctCount,
                wrong_count: wrongCount,
                completion_time: data.completion_time || data.completionTime || "Nộp bổ sung JSON",
                spent_mins: parseInt(data.spent_mins || data.spentMins, 10) || 0,
                tab_switch_count: String(data.tab_switch_count || data.tabSwitchCount || "0 lần"),
                data_string: dataString,
                user_answers: userAnswers,
                category_id: currentCat,
                is_free: !!(data.is_free || data.isFree),
                ma_de: data.ma_de || data.maDe || "101",
                exam_title: examTitle,
                created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
            };

            const { error: upsertErr } = await client.from('submissions').insert([payloadRow]);
            if (upsertErr) {
                // Nếu lỗi thì fallback sang upsert theo id
                await client.from('submissions').upsert(payloadRow, { onConflict: 'id' });
            }

            // Xóa phiên dở dang và bản nháp (nếu có)
            client.from('live_drafts').delete().match({ quiz_id: effectiveQuizId, sbd: sbdClean }).then();
            client.from('active_sessions').delete().match({ quiz_id: effectiveQuizId, sbd: sbdClean }).then();

            successCount++;
        }

        if (successCount > 0) {
            alert(`🎉 NẠP THÀNH CÔNG ${successCount} BÀI THI TỪ FILE JSON!\n\nDữ liệu đã được lưu chính thức lên máy chủ.`);
            await refreshCurrentExamResults();
        } else {
            alert("⚠️ Không tìm thấy bài làm hợp lệ trong file JSON!");
        }

    } catch(err) {
        alert("❌ Lỗi nạp bài thi từ file JSON: " + err.message);
    } finally {
        input.value = "";
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📥 Upload JSON nộp sót";
        }
    }
}

// Đăng ký toàn cục để các nút trên giao diện gọi trực tiếp
window.closeResultModal = closeResultModal;
window.startAutoRefreshResult = startAutoRefreshResult;
window.stopAutoRefreshResult = stopAutoRefreshResult;
window.toggleAutoRefresh = toggleAutoRefresh;
window.openRegradeModal = openRegradeModal;
window.closeRegradeModal = closeRegradeModal;
window.previewRegradeFile = previewRegradeFile;
window.processRegradeWithAnswers = processRegradeWithAnswers;
window.triggerUploadBackupJson = triggerUploadBackupJson;
window.handleBackupJsonFileInput = handleBackupJsonFileInput;
