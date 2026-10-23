// =========================================================
// FILE: portal-results-regrade.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG)
// =========================================================

function closeResultModal(triggerHistoryBack = true) {
    stopAutoRefreshResult();
    if (typeof stopRealtimeSubmissionsListener === 'function') stopRealtimeSubmissionsListener();
    const modal = document.getElementById("result-fullscreen-modal");
    if (modal) modal.style.display = "none";
    closeRegradeModal();
    if (triggerHistoryBack && window.location.hash.startsWith("#bang-ket-qua")) { window.history.back(); }
}

function startAutoRefreshResult() {
    stopAutoRefreshResult();
    if (!isAutoRefreshEnabled) return;
    // Tăng thời gian từ 12s lên 60s để bảo vệ tuyệt đối hạn mức
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
        const text = await readFileAsTextAsync(file); const parsed = parseScriptOrJson(text);
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
    if (!currentItem || !supabaseClient) return;

    let quizId = extractQuizIdFromItem(currentItem);
    btn.disabled = true; btn.innerText = "⏳ Đang nạp đề gốc...";

    try {
        const { data: quizObj, error: qErr } = await supabaseClient.from('quizzes').select('*').eq('id', quizId).single();
        if (qErr || !quizObj || !quizObj.questions) throw new Error("Không tìm thấy đề thi gốc!");

        if (_regradeFileParsedAnswers) {
            quizObj.questions = mergeQuestionsAndAnswers({ questions: quizObj.questions }, _regradeFileParsedAnswers).questions;
            await supabaseClient.from('quizzes').update({ questions: quizObj.questions }).match({ id: quizId });
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
        const { data: subs } = await supabaseClient.from('submissions').select('*').eq('quiz_id', quizId);
        let updatedCount = 0;

        if (Array.isArray(subs)) {
            for (const sub of subs) {
                const userAns = sub.user_answers || {};
                const scoreRes = calculateExamScoreWithConfig(quizObj.questions, userAns, newAnswerKey, scoringConfig);

                await supabaseClient.from('submissions').update({
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