// =========================================================
// FILE: portal-exam-scoring.js (BẢN SUPABASE TỐI ƯU BĂNG THÔNG & NHẬN DIỆN PHẦN IV CHUẨN XÁC)
// =========================================================

let currentScoringQuizId = null;
let currentScoringQuizData = null;

(function injectScoringModalStyles() {
    const styleId = "exam-scoring-modal-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .btn-time-sub-score { background: #ecfdf5 !important; color: #047857 !important; border: 1px solid #6ee7b7 !important; }
        .btn-time-sub-score:hover { background: #10b981 !important; color: #ffffff !important; }
        .scoring-modal-card { max-width: 480px !important; width: min(480px, calc(100vw - 16px)) !important; max-height: calc(100vh - 28px) !important; overflow-y: auto !important; padding: 14px 16px !important; border-radius: 16px !important; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.35) !important; }
        .scoring-q-count-banner { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 10px; margin-bottom: 8px; font-size: 11px; font-weight: 700; color: #475569; }
        .scoring-q-badge { display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; border-radius: 6px; background: #ffffff; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a; font-size: 10.5px; }
        .scoring-option-card { border: 1.5px solid #e2e8f0; border-radius: 11px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer; background: #ffffff; }
        .scoring-option-card.selected { border-color: #0284c7; background: #f0f9ff; box-shadow: 0 0 0 1.5px rgba(2, 132, 199, 0.2); }
        .scoring-option-header { display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 12px; color: #0f172a; }
        .scoring-option-desc { font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 3px; padding-left: 22px; }
        .scoring-inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
        .scoring-part-box { background: #ffffff; border: 1.2px solid #cbd5e1; border-radius: 8px; padding: 5px 7px; }
        .scoring-part-label { font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 2px; }
        .scoring-part-input { width: 100%; padding: 4px 6px; border: 1.2px solid #cbd5e1; border-radius: 6px; font-weight: 800; font-size: 12px; outline: none; box-sizing: border-box; height: 28px; }
        .scoring-part-hint { font-size: 9.5px; font-weight: 700; color: #0284c7; margin-top: 2px; }
        .scoring-total-box { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.2px solid #86efac; border-radius: 9px; padding: 6px 10px; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; }
    `;
    document.head.appendChild(style);
})();

function ensureScoringModalInDOM() {
    if (document.getElementById("exam-scoring-modal")) return;
    const modalDiv = document.createElement("div");
    modalDiv.className = "move-modal-overlay";
    modalDiv.id = "exam-scoring-modal";
    modalDiv.innerHTML = `
    <div class="move-modal-box scoring-modal-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
            <h4 style="margin:0; font-size: 13.5px; font-weight: 900; color: #0f172a;">🎯 Cấu Hình Biểu Điểm Đề Thi</h4>
            <button type="button" onclick="closeGradingScaleModal()" style="background:none; border:none; font-size:16px; font-weight:900; color:#94a3b8; cursor:pointer;">✕</button>
        </div>
        <div style="font-size: 11.5px; font-weight: 700; color: #0284c7; margin-bottom: 6px;" id="scoring-modal-exam-title">📑 Đang nạp đề thi...</div>
        <div class="scoring-q-count-banner" id="scoring-q-count-banner">
            <span>Cấu trúc:</span>
            <span class="scoring-q-badge" id="badge-count-p1">P1: --</span>
            <span class="scoring-q-badge" id="badge-count-p2">P2: --</span>
            <span class="scoring-q-badge" id="badge-count-p3">P3: --</span>
            <span class="scoring-q-badge" id="badge-count-p4">P4: --</span>
            <span class="scoring-q-badge" style="background:#e0f2fe; color:#0369a1;" id="badge-count-total">Tổng: --</span>
        </div>
        <div class="scoring-option-card" id="card-scoring-opt1" onclick="handleScoringModeChange('option1')">
            <div class="scoring-option-header">
                <input type="radio" name="scoring-mode" id="scoring-mode-opt1" value="option1" checked onchange="handleScoringModeChange('option1')">
                <label for="scoring-mode-opt1">Lựa chọn 1: Mỗi câu 1 điểm (Quy thang 10)</label>
            </div>
            <div class="scoring-option-desc">P1, P3, P4 đúng được 1đ. P2: 0.1 - 0.25 - 0.5 - 1.0.</div>
        </div>
        <div class="scoring-option-card" id="card-scoring-opt3" onclick="handleScoringModeChange('option3')">
            <div class="scoring-option-header">
                <input type="radio" name="scoring-mode" id="scoring-mode-opt3" value="option3" onchange="handleScoringModeChange('option3')">
                <label for="scoring-mode-opt3">Lựa chọn 2: Chuẩn Bộ GD&ĐT (3 - 4 - 3 - 0)</label>
            </div>
            <div class="scoring-option-desc">P1: 3.0đ • P2: 4.0đ • P3: 3.0đ • P4: 0đ.</div>
        </div>
        <div class="scoring-option-card" id="card-scoring-opt2" onclick="handleScoringModeChange('option2')">
            <div class="scoring-option-header">
                <input type="radio" name="scoring-mode" id="scoring-mode-opt2" value="option2" onchange="handleScoringModeChange('option2')">
                <label for="scoring-mode-opt2">Lựa chọn 3: Tự nhập điểm từng phần</label>
            </div>
            <div class="scoring-inputs-grid" id="scoring-inputs-custom-view" style="display:none;">
                <div class="scoring-part-box"><input type="number" step="0.05" class="scoring-part-input" id="score-input-p1" oninput="updateScoringPreview()"><div class="scoring-part-hint" id="hint-p1">-- đ/câu</div></div>
                <div class="scoring-part-box"><input type="number" step="0.05" class="scoring-part-input" id="score-input-p2" oninput="updateScoringPreview()"><div class="scoring-part-hint" id="hint-p2">-- đ/câu</div></div>
                <div class="scoring-part-box"><input type="number" step="0.05" class="scoring-part-input" id="score-input-p3" oninput="updateScoringPreview()"><div class="scoring-part-hint" id="hint-p3">-- đ/câu</div></div>
                <div class="scoring-part-box"><input type="number" step="0.05" class="scoring-part-input" id="score-input-p4" oninput="updateScoringPreview()"><div class="scoring-part-hint" id="hint-p4">-- đ/câu</div></div>
            </div>
            <div class="scoring-total-box" id="scoring-total-box" style="display:none;">
                <span>🎯 TỔNG ĐIỂM:</span>
                <span id="scoring-total-preview-val">10.0 điểm</span>
            </div>
        </div>
        <div class="move-btn-row" style="margin-top: 8px;">
            <button type="button" class="move-btn-cancel" onclick="closeGradingScaleModal()">Hủy</button>
            <button type="button" class="move-btn-submit" id="btn-save-grading-scale" onclick="saveGradingScaleConfig()">💾 Lưu Biểu Điểm</button>
        </div>
    </div>`;
    document.body.appendChild(modalDiv);
}

// HÀM BỔ TRỢ: NHẬN DIỆN CÂU HỎI THUỘC PHẦN IV ĐỒNG BỘ 100% VỚI PHÒNG THI & SOI ĐỀ
function isPart4QuestionScoring(q) {
    if (!q) return false;
    if (typeof isPart4Question === 'function') return isPart4Question(q);
    if (q.part === 4 || q.isPart4 === true) return true;
    if (q.type === "essay" || q.type === "essay_answer" || q.type === "part4") return true;
    const txt = String(q.question || "").toUpperCase();
    if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) {
        return true;
    }
    return false;
}

// BỘ ĐẾM SỐ CÂU TỪNG PHẦN ĐÃ ĐƯỢC SỬA LỖI: TÁCH RIÊNG P3 VÀ P4 CHÍNH XÁC
function countQuestionsByPart(questions) {
    if (!Array.isArray(questions)) return { p1: 0, p2: 0, p3: 0, p4: 0, total: 0 };
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    questions.forEach(q => {
        if (!q) return;
        if (isPart4QuestionScoring(q)) {
            p4++;
        } else if (q.type === "multiple_choice") {
            p1++;
        } else if (q.type === "true_false") {
            p2++;
        } else {
            p3++;
        }
    });
    return { p1, p2, p3, p4, total: questions.length };
}

async function openGradingScaleModal(quizId, categoryId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    ensureScoringModalInDOM();
    currentScoringQuizId = quizId;

    const modal = document.getElementById("exam-scoring-modal");
    const titleEl = document.getElementById("scoring-modal-exam-title");
    if (titleEl) titleEl.innerText = "⏳ Đang tải thông tin đề thi...";
    if (modal) modal.style.display = "flex";

    try {
        const { data: qData, error } = await supabaseClient.from('quizzes').select('*').eq('id', quizId).single();
        if (error || !qData || !qData.questions) throw new Error("Không thể tải cấu trúc đề thi!");

        currentScoringQuizData = qData;
        if (titleEl) titleEl.innerText = `📑 Đề: ${qData.title || quizId}`;

        const counts = countQuestionsByPart(qData.questions);
        document.getElementById("badge-count-p1").innerText = `P1: ${counts.p1} câu`;
        document.getElementById("badge-count-p2").innerText = `P2: ${counts.p2} câu`;
        document.getElementById("badge-count-p3").innerText = `P3: ${counts.p3} câu`;
        document.getElementById("badge-count-p4").innerText = `P4: ${counts.p4} câu`;
        document.getElementById("badge-count-total").innerText = `Tổng: ${counts.total} câu`;

        const cfg = qData.scoring_config || { mode: 'option1' };
        document.getElementById("score-input-p1").value = cfg.p1Total !== undefined ? cfg.p1Total : 3.0;
        document.getElementById("score-input-p2").value = cfg.p2Total !== undefined ? cfg.p2Total : 4.0;
        document.getElementById("score-input-p3").value = cfg.p3Total !== undefined ? cfg.p3Total : 3.0;
        document.getElementById("score-input-p4").value = cfg.p4Total !== undefined ? cfg.p4Total : (counts.p4 > 0 ? 1.0 : 0);

        handleScoringModeChange(cfg.mode || 'option1');
        updateScoringPreview();
    } catch(err) {
        alert("❌ Lỗi: " + err.message);
        closeGradingScaleModal();
    }
}

function closeGradingScaleModal() {
    const modal = document.getElementById("exam-scoring-modal");
    if (modal) modal.style.display = "none";
    currentScoringQuizId = null;
    currentScoringQuizData = null;
}

function handleScoringModeChange(mode) {
    document.querySelectorAll("input[name='scoring-mode']").forEach(r => r.checked = (r.value === mode));
    ['opt1', 'opt2', 'opt3'].forEach(id => {
        const c = document.getElementById(`card-scoring-${id}`);
        if (c) c.classList.toggle("selected", id === (mode === 'option1' ? 'opt1' : (mode === 'option3' ? 'opt3' : 'opt2')));
    });

    const customInputsView = document.getElementById("scoring-inputs-custom-view");
    const totalBox = document.getElementById("scoring-total-box");

    if (mode === 'option1') {
        if (customInputsView) customInputsView.style.display = "none";
        if (totalBox) totalBox.style.display = "none";
    } else {
        if (customInputsView) customInputsView.style.display = "grid";
        if (totalBox) totalBox.style.display = "flex";
        if (mode === 'option3') {
            document.getElementById("score-input-p1").value = 3.0;
            document.getElementById("score-input-p2").value = 4.0;
            document.getElementById("score-input-p3").value = 3.0;
            document.getElementById("score-input-p4").value = 0;
        }
        updateScoringPreview();
    }
}

function updateScoringPreview() {
    if (!currentScoringQuizData || !currentScoringQuizData.questions) return;
    const counts = countQuestionsByPart(currentScoringQuizData.questions);

    const p1Val = parseFloat(document.getElementById("score-input-p1").value) || 0;
    const p2Val = parseFloat(document.getElementById("score-input-p2").value) || 0;
    const p3Val = parseFloat(document.getElementById("score-input-p3").value) || 0;
    const p4Val = parseFloat(document.getElementById("score-input-p4").value) || 0;

    const round3 = n => (Math.round(n * 1000) / 1000);
    const h1 = document.getElementById("hint-p1");
    const h2 = document.getElementById("hint-p2");
    const h3 = document.getElementById("hint-p3");
    const h4 = document.getElementById("hint-p4");

    if (h1) h1.innerText = counts.p1 > 0 ? `➔ ${round3(p1Val / counts.p1)} đ/câu` : "--";
    if (h2) h2.innerText = counts.p2 > 0 ? `➔ ${round3(p2Val / counts.p2)} đ/câu` : "--";
    if (h3) h3.innerText = counts.p3 > 0 ? `➔ ${round3(p3Val / counts.p3)} đ/câu` : "--";
    if (h4) h4.innerText = counts.p4 > 0 ? `➔ ${round3(p4Val / counts.p4)} đ/câu` : "--";

    const totalPreviewEl = document.getElementById("scoring-total-preview-val");
    if (totalPreviewEl) totalPreviewEl.innerText = `${round3(p1Val + p2Val + p3Val + p4Val)} điểm`;
}

async function saveGradingScaleConfig() {
    if (!currentScoringQuizId) return;
    const btn = document.getElementById("btn-save-grading-scale");
    btn.disabled = true; btn.innerText = "⏳ Đang lưu...";

    const selectedRadio = document.querySelector('input[name="scoring-mode"]:checked');
    const mode = selectedRadio ? selectedRadio.value : 'option1';

    const p1Val = parseFloat(document.getElementById("score-input-p1").value) || 0;
    const p2Val = parseFloat(document.getElementById("score-input-p2").value) || 0;
    const p3Val = parseFloat(document.getElementById("score-input-p3").value) || 0;
    const p4Val = parseFloat(document.getElementById("score-input-p4").value) || 0;

    const scoringPayload = {
        mode: mode,
        p1Total: p1Val,
        p2Total: p2Val,
        p3Total: p3Val,
        p4Total: p4Val,
        totalMaxScore: (mode === 'option1') ? 10.0 : (Math.round((p1Val + p2Val + p3Val + p4Val) * 100) / 100),
        updatedAt: Date.now()
    };

    try {
        await supabaseClient.from('quizzes').update({ scoring_config: scoringPayload }).match({ id: currentScoringQuizId });
        await supabaseClient.from('custom_links').update({ scoring_config: scoringPayload }).match({ id: currentScoringQuizId });

        alert("🎯 ĐÃ LƯU BIỂU ĐIỂM THÀNH CÔNG!\nBài thi từ giờ sẽ được chấm theo biểu điểm này.");
        closeGradingScaleModal();
    } catch(e) {
        alert("❌ Lỗi: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "💾 Lưu Biểu Điểm";
    }
}

// BỘ CHẤM ĐIỂM CHÍNH XÁC THEO BIỂU ĐIỂM ĐÃ SỬA: PHÂN BIỆT RÕ RÀNG P3 VÀ P4
function calculateExamScoreWithConfig(questions, userAnswers, answerVault, scoringConfig) {
    const cfg = scoringConfig || { mode: "option1" };
    const mode = cfg.mode || "option1";
    const counts = countQuestionsByPart(questions);
    const isOption1 = (mode === "option1");

    let p1PerQ = 1.0; let p2PerQ = 1.0; let p3PerQ = 1.0; let p4PerQ = 1.0;
    if (!isOption1) {
        p1PerQ = counts.p1 > 0 ? ((cfg.p1Total ?? 3.0) / counts.p1) : 0;
        p2PerQ = counts.p2 > 0 ? ((cfg.p2Total ?? 4.0) / counts.p2) : 0;
        p3PerQ = counts.p3 > 0 ? ((cfg.p3Total ?? 3.0) / counts.p3) : 0;
        p4PerQ = counts.p4 > 0 ? ((cfg.p4Total ?? 0) / counts.p4) : 0;
    }

    let correctCount = 0; let wrongCount = 0; let totalScore = 0; let maxScoreOfExam = 0; let dataDetails = [];

    questions.forEach(q => {
        const isP4 = isPart4QuestionScoring(q);
        
        if (q.type === "multiple_choice" && !isP4) {
            maxScoreOfExam += isOption1 ? 1.0 : p1PerQ;
            const uVal = userAnswers[`q${q.id}`] || "Chưa chọn";
            const cVal = answerVault[`q${q.id}`];
            if (cVal && String(uVal).trim().toUpperCase() === String(cVal).trim().toUpperCase()) {
                correctCount++; totalScore += isOption1 ? 1.0 : p1PerQ; dataDetails.push(`${q.id}-${uVal} [ĐÚNG]`);
            } else {
                wrongCount++; dataDetails.push(`${q.id}-${uVal} [SAI: ${cVal || "---"}]`);
            }
        } else if (q.type === "true_false" && !isP4) {
            maxScoreOfExam += isOption1 ? 1.0 : p2PerQ;
            let cSt = 0;
            (q.statements || []).forEach(st => {
                const subKey = `q${q.id}_${st.id}`;
                const uVal = userAnswers[subKey] || "Chưa chọn";
                const cVal = answerVault[subKey];
                if (cVal && uVal === cVal) {
                    cSt++; dataDetails.push(`${q.id}${st.id}-${uVal} [ĐÚNG]`);
                } else {
                    dataDetails.push(`${q.id}${st.id}-${uVal} [SAI]`);
                }
            });
            let qScore = 0;
            if (cSt === 1) qScore = 0.1 * (isOption1 ? 1.0 : p2PerQ);
            else if (cSt === 2) qScore = 0.25 * (isOption1 ? 1.0 : p2PerQ);
            else if (cSt === 3) qScore = 0.5 * (isOption1 ? 1.0 : p2PerQ);
            else if (cSt === 4) qScore = 1.0 * (isOption1 ? 1.0 : p2PerQ);
            totalScore += qScore;
            if (cSt === (q.statements ? q.statements.length : 4)) correctCount++; else wrongCount++;
        } else if (isP4) {
            // XỬ LÝ CHẤM RIÊNG CHO PHẦN IV
            maxScoreOfExam += isOption1 ? 1.0 : p4PerQ;
            const uVal = String(userAnswers[`q${q.id}`] || "").trim().replace(',', '.');
            const cVal = String(answerVault[`q${q.id}`] || "").trim().replace(',', '.');
            const isRight = (uVal !== "" && cVal !== "" && (uVal === cVal || Number(uVal) === Number(cVal)));
            if (isRight) {
                correctCount++; totalScore += isOption1 ? 1.0 : p4PerQ; dataDetails.push(`${q.id}-${uVal} [ĐÚNG]`);
            } else {
                wrongCount++; dataDetails.push(`${q.id}-${uVal || "Trống"} [SAI: ${cVal}]`);
            }
        } else {
            // XỬ LÝ CHẤM CHO PHẦN III
            maxScoreOfExam += isOption1 ? 1.0 : p3PerQ;
            const uVal = String(userAnswers[`q${q.id}`] || "").trim().replace(',', '.');
            const cVal = String(answerVault[`q${q.id}`] || "").trim().replace(',', '.');
            const isRight = (uVal !== "" && cVal !== "" && (uVal === cVal || Number(uVal) === Number(cVal)));
            if (isRight) {
                correctCount++; totalScore += isOption1 ? 1.0 : p3PerQ; dataDetails.push(`${q.id}-${uVal} [ĐÚNG]`);
            } else {
                wrongCount++; dataDetails.push(`${q.id}-${uVal || "Trống"} [SAI: ${cVal}]`);
            }
        }
    });

    let finalScore = isOption1 
        ? Math.round(((totalScore / (maxScoreOfExam || 1)) * 10) * 10) / 10 
        : Math.round(totalScore * 100) / 100;

    return {
        correctCount, wrongCount,
        totalRawScore: Math.round(totalScore * 100) / 100,
        maxTotalScore: Math.round(maxScoreOfExam * 100) / 100,
        finalScore: finalScore,
        maxScale: isOption1 ? 10.0 : (Math.round(maxScoreOfExam * 100) / 100),
        dataDetails
    };
}
