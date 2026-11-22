// =========================================================
// FILE: soide-editor-preview.js
// MODULE 2/3 CỦA HỆ THỐNG SOI ĐỀ THỜI GIAN THỰC:
// - KHUNG SOẠN THẢO BÊN PHẢI (FORM THẺ TỪNG CÂU, PASTE ĐÈ/THÊM, MÃ NGUỒN THÔ)
// - KHUNG XEM TRƯỚC MATHJAX THỜI GIAN THỰC BÊN TRÁI
// - KIỂM TRA CÚ PHÁP LATEX & ĐỒNG BỘ DỮ LIỆU MÃ NGUỒN THÔ
// =========================================================

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlForAttr(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function generateSoiDeNewId(questionsList) {
    const questions = questionsList || soiDeState.examData.questions || [];
    const used = new Set(questions.map(q => String(q.id)));
    const maxNumeric = questions.reduce((max, q) => {
        const n = /^\d+$/.test(String(q.id || "")) ? parseInt(q.id, 10) : 0;
        return Math.max(max, n);
    }, 0);
    let candidate = maxNumeric + 1;
    while (used.has(String(candidate))) candidate++;
    return candidate;
}

function initDefaultSoiDeExam() {
    soiDeState.examData = {
        title: "ĐỀ KIỂM TRA ĐỊNH KỲ TOÁN 12",
        maDe: "101",
        timeLimitMinutes: 90,
        images: {},
        questions: [
            {
                id: 1,
                type: "multiple_choice",
                part: 1,
                isPart4: false,
                question: "Cho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$. Tìm nghiệm của phương trình $f'(x) = 0$?",
                options: ["$x = 1$", "$x = 2$", "$x = -1$", "$x = 0$"],
                correct: 0,
                explanation: "Ta có $f'(x) = 0 \\Leftrightarrow x = 1$."
            },
            {
                id: 2,
                type: "true_false",
                part: 2,
                isPart4: false,
                question: "Xét tính đúng sai của các mệnh đề sau đây:",
                statements: [
                    { id: "a", statement: "Hàm số đồng biến trên khoảng $(0; +\\infty)$.", correct: true },
                    { id: "b", statement: "Hàm số có giá trị cực tiểu bằng $-2$.", correct: false },
                    { id: "c", statement: "Đồ thị hàm số có tiệm cận đứng $x = 1$.", correct: true },
                    { id: "d", statement: "Giá trị lớn nhất của hàm số trên $[1; 3]$ bằng $5$.", correct: true }
                ],
                explanation: "Mệnh đề a, c, d đúng; mệnh đề b sai."
            },
            {
                id: 3,
                type: "short_answer",
                part: 3,
                isPart4: false,
                question: "Tính đạo hàm của hàm số $y = x^2 - 3x + 2$ tại điểm $x = 2$.",
                correctAnswer: "1",
                explanation: "$y' = 2x - 3 \\Rightarrow y'(2) = 1$."
            }
        ]
    };
    renderSoiDeBothSides();
}

function renderSoiDeBothSides() {
    renderSoiDeRightEditor();
    renderSoiDeLeftLivePreview();
}

function updateSoiDeMeta() {
    const titleIn = document.getElementById("soide-meta-title");
    const madeIn = document.getElementById("soide-meta-made");
    const minIn = document.getElementById("soide-meta-minutes");
    const subText = document.getElementById("soide-exam-subtext");

    if (titleIn) soiDeState.examData.title = titleIn.value;
    if (madeIn) soiDeState.examData.maDe = madeIn.value;
    if (minIn) soiDeState.examData.timeLimitMinutes = parseInt(minIn.value, 10) || 90;
    if (subText) {
        subText.innerText = `Đề: ${soiDeState.examData.title} | Mã: ${soiDeState.examData.maDe} | ${soiDeState.examData.timeLimitMinutes} phút`;
    }
    debouncedLivePreview();
}

function renderSoiDeRightEditor() {
    const metaTitle = document.getElementById("soide-meta-title");
    const metaMade = document.getElementById("soide-meta-made");
    const metaMin = document.getElementById("soide-meta-minutes");
    const subText = document.getElementById("soide-exam-subtext");

    if (metaTitle) metaTitle.value = soiDeState.examData.title || "";
    if (metaMade) metaMade.value = soiDeState.examData.maDe || "101";
    if (metaMin) metaMin.value = soiDeState.examData.timeLimitMinutes || 90;
    if (subText) {
        subText.innerText = `Đề: ${soiDeState.examData.title} | Mã: ${soiDeState.examData.maDe} | ${soiDeState.examData.timeLimitMinutes} phút`;
    }

    const cardsContainer = document.getElementById("soide-cards-container");
    if (!cardsContainer) return;
    cardsContainer.innerHTML = "";

    const questions = soiDeState.examData.questions || [];

    questions.forEach((q, qIdx) => {
        const palette = SOI_DE_THEME_PALETTES[qIdx % SOI_DE_THEME_PALETTES.length];
        const card = document.createElement("div");
        card.className = "soide-editor-qcard";
        card.id = `soide-qcard-${q.id}`;
        card.dataset.qid = String(q.id);
        card.style.background = palette.bg;
        card.style.border = `1.8px solid ${palette.border}`;

        card.addEventListener("focusin", function() {
            scrollToLeftPreviewQuestion(q.id, true);
        });

        let currentPartType = "multiple_choice";
        if (getQuestionPartType(q) === 4) currentPartType = "part4";
        else if (q.type === "true_false") currentPartType = "true_false";
        else if (q.type === "short_answer") currentPartType = "short_answer";

        const safeQId = safeSoiDeJsArg(q.id);
        const attrQId = escapeHtmlForAttr(q.id);
        const isRawEditing = soiDeState.rawEditingCardIds.has(String(q.id));
        let cardBodyHtml = "";

        if (isRawEditing) {
            const jsonTextOfQ = JSON.stringify(q, null, 2);
            cardBodyHtml = `
                <div class="soide-card-raw-box" id="soide-card-raw-box-${attrQId}">
                    <div class="soide-card-raw-header">
                        <span>💻 Mã nguồn thô / Văn bản câu hỏi ${qIdx + 1}:</span>
                        <span>(Có thể dán JSON hoặc text Word thường)</span>
                    </div>
                    <textarea class="soide-card-raw-textarea" id="soide-card-raw-text-${attrQId}" spellcheck="false">${escapeHtml(jsonTextOfQ)}</textarea>
                    <div class="soide-card-raw-btn-row">
                        <button type="button" class="btn-soide-mini" onclick="toggleCardRawBox('${safeQId}')" style="background:#475569; color:#fff;">✕ Thu gọn</button>
                        <button type="button" class="btn-soide-mini" onclick="applyCardRawInput(${qIdx}, '${safeQId}')" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-weight:900;">⚡ Nhận diện &amp; Áp dụng</button>
                    </div>
                </div>
            `;
        } else {
            let specificHtml = "";
            if (currentPartType === "multiple_choice") {
                const letters = ["A", "B", "C", "D"];
                const currentCorrect = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").trim().toUpperCase();

                specificHtml = `
                    <div class="soide-textarea-label">Các phương án lựa chọn (A, B, C, D):</div>
                    <div class="soide-options-editor-grid">
                        ${(q.options || ["", "", "", ""]).map((opt, oIdx) => `
                            <div>
                                <span style="font-weight:900; font-size:11px; color:${palette.text};">${letters[oIdx] || ""}:</span>
                                <textarea class="soide-latex-input" rows="1" style="min-height:36px;" oninput="autoResizeTextarea(this); updateSoiDeOption(${qIdx}, ${oIdx}, this.value)">${escapeHtml(opt)}</textarea>
                            </div>
                        `).join("")}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                        <b style="font-size:11.5px; color:#15803d;">Đáp án đúng:</b>
                        <select class="soide-latex-input" style="width:65px; padding:2px 4px; font-size:13.5px !important; min-height:30px;" onchange="updateSoiDeCorrectMC(${qIdx}, this.value)">
                            ${letters.map(L => `<option value="${L}" ${L === currentCorrect ? "selected" : ""}>${L}</option>`).join("")}
                        </select>
                    </div>
                `;
            } else if (currentPartType === "true_false") {
                specificHtml = `
                    <div class="soide-textarea-label">Các mệnh đề Đúng / Sai (a, b, c, d):</div>
                    <table class="soide-tf-editor-table">
                        ${(q.statements || []).map((st, sIdx) => {
                            const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                            return `
                            <tr>
                                <td width="25" align="center"><b>${escapeHtml(st.id)})</b></td>
                                <td><textarea class="soide-latex-input" rows="1" style="padding:3px 6px; font-size:14px !important; min-height:32px;" oninput="autoResizeTextarea(this); updateSoiDeStatementText(${qIdx}, ${sIdx}, this.value)">${escapeHtml(st.statement)}</textarea></td>
                                <td width="90" align="center">
                                    <select class="soide-latex-input" style="padding:2px 4px; font-size:13px !important; min-height:30px;" onchange="updateSoiDeStatementCorrect(${qIdx}, ${sIdx}, this.value)">
                                        <option value="Đúng" ${isTrue ? "selected" : ""}>🟢 Đúng</option>
                                        <option value="Sai" ${!isTrue ? "selected" : ""}>🔴 Sai</option>
                                    </select>
                                </td>
                            </tr>`;
                        }).join("")}
                    </table>
                `;
            } else {
                specificHtml = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <b style="font-size:12px; color:#0d9488;">Đáp số chính xác:</b>
                        <input type="text" class="soide-latex-input" style="width:180px; padding:3px 6px; min-height:32px;" value="${escapeHtmlForAttr(q.correctAnswer || "")}" oninput="updateSoiDeShortAnswer(${qIdx}, this.value)">
                    </div>
                `;
            }

            cardBodyHtml = `
                <div>
                    <div class="soide-textarea-label">
                        <span>Nội dung câu hỏi (LaTeX $...$):</span>
                    </div>
                    <textarea class="soide-latex-input" rows="1" oninput="autoResizeTextarea(this); updateSoiDeQuestionText(${qIdx}, this.value)">${escapeHtml(q.question || "")}</textarea>
                </div>
                ${specificHtml}
                <div>
                    <div class="soide-textarea-label">Lời giải chi tiết:</div>
                    <textarea class="soide-latex-input" rows="1" oninput="autoResizeTextarea(this); updateSoiDeExplanation(${qIdx}, this.value)">${escapeHtml(q.explanation || "")}</textarea>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="soide-paste-zones-row">
                <div class="soide-paste-box zone-overwrite" id="paste-zone-overwrite-${qIdx}" tabindex="0"
                     onclick="handlePasteZoneClick(${qIdx}, 'overwrite')"
                     onpaste="handlePasteOnQuestion(event, ${qIdx}, 'overwrite')"
                     title="Click vào đây rồi ấn Ctrl+V để mở mã thô và dán đè câu này">
                    <span>📋</span>
                    <span>Click &amp; ấn <b>Ctrl+V</b> để <b>paste đè</b></span>
                </div>
                <div class="soide-paste-box zone-insert" id="paste-zone-insert-${qIdx}" tabindex="0"
                     onclick="handlePasteZoneClick(${qIdx}, 'insert')"
                     onpaste="handlePasteOnQuestion(event, ${qIdx}, 'insert')"
                     title="Click vào đây rồi ấn Ctrl+V để mở mã thô và tự động xếp vào cuối phần tương ứng">
                    <span>➕</span>
                    <span>Click &amp; ấn <b>Ctrl+V</b> để <b>paste thêm mới</b></span>
                </div>
            </div>

            <div class="soide-qcard-head">
                <div class="soide-qcard-num" style="color:${palette.text};">
                    <span>Câu ${qIdx + 1}</span>
                    <span style="font-size:11px; opacity:0.85; font-weight:700;">(ID: ${escapeHtml(q.id)})</span>
                </div>
                <div class="soide-head-actions">
                    <button type="button" class="btn-soide-mini btn-soide-raw-toggle" onclick="toggleCardRawBox('${safeQId}')" title="Chuyển đổi giữa chế độ Form thẻ và Mã nguồn thô của câu này">
                        ${isRawEditing ? "👁️ Xem Form" : "💻 Mã thô"}
                    </button>

                    <select class="soide-part-select-mini" onchange="changeSoiDeQuestionType(${qIdx}, this.value)" title="Chuyển câu này sang phần khác">
                        <option value="multiple_choice" ${currentPartType === "multiple_choice" ? "selected" : ""}>Phần I (Trắc nghiệm)</option>
                        <option value="true_false" ${currentPartType === "true_false" ? "selected" : ""}>Phần II (Đúng/Sai)</option>
                        <option value="short_answer" ${currentPartType === "short_answer" ? "selected" : ""}>Phần III (Trả lời ngắn)</option>
                        <option value="part4" ${currentPartType === "part4" ? "selected" : ""}>Phần IV (Tự luận ngắn)</option>
                    </select>

                    <button type="button" class="btn-soide-mini btn-soide-add-inline" onclick="insertQuestionAfter(${qIdx})" title="Thêm ngay 1 câu hỏi mới liền kề">
                        ➕ Thêm
                    </button>
                    <button type="button" class="btn-soide-mini btn-soide-del-inline" onclick="deleteQuestionFromSoiDe(${qIdx})" title="Xóa câu hỏi này">
                        🗑️ Xóa
                    </button>
                </div>
            </div>

            ${cardBodyHtml}
        `;

        cardsContainer.appendChild(card);
    });

    updateRawTextFromState();
    setTimeout(autoResizeAllTextareas, 20);
    setupDualScrollSync();
}

function updateSoiDeQuestionText(idx, val) {
    if (soiDeState.examData.questions[idx]) {
        soiDeState.examData.questions[idx].question = val;
        debouncedLivePreview();
    }
}

function updateSoiDeOption(qIdx, optIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q && Array.isArray(q.options)) {
        q.options[optIdx] = val;
        debouncedLivePreview();
    }
}

function updateSoiDeCorrectMC(qIdx, letter) {
    const q = soiDeState.examData.questions[qIdx];
    if (q) {
        q.correct = ["A", "B", "C", "D"].indexOf(letter);
        debouncedLivePreview();
    }
}

function updateSoiDeStatementText(qIdx, sIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q && q.statements && q.statements[sIdx]) {
        q.statements[sIdx].statement = val;
        debouncedLivePreview();
    }
}

function updateSoiDeStatementCorrect(qIdx, sIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q && q.statements && q.statements[sIdx]) {
        q.statements[sIdx].correct = (val === "Đúng");
        debouncedLivePreview();
    }
}

function updateSoiDeShortAnswer(qIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q) {
        q.correctAnswer = val;
        debouncedLivePreview();
    }
}

function updateSoiDeExplanation(qIdx, val) {
    const q = soiDeState.examData.questions[qIdx];
    if (q) {
        q.explanation = val;
        debouncedLivePreview();
    }
}

function changeSoiDeQuestionType(qIdx, newType) {
    const q = soiDeState.examData.questions[qIdx];
    if (!q) return;
    const targetId = q.id;

    if (newType === "multiple_choice") {
        q.type = "multiple_choice";
        q.part = 1;
        q.isPart4 = false;
        if (!q.options || q.options.length < 4) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
        if (q.correct === undefined || q.correct === null) q.correct = 0;
    } else if (newType === "true_false") {
        q.type = "true_false";
        q.part = 2;
        q.isPart4 = false;
        if (!q.statements || q.statements.length < 4) {
            q.statements = [
                { id: "a", statement: "Mệnh đề a", correct: true },
                { id: "b", statement: "Mệnh đề b", correct: false },
                { id: "c", statement: "Mệnh đề c", correct: true },
                { id: "d", statement: "Mệnh đề d", correct: false }
            ];
        }
    } else if (newType === "short_answer") {
        q.type = "short_answer";
        q.part = 3;
        q.isPart4 = false;
        if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === "") q.correctAnswer = "0";
    } else if (newType === "part4") {
        q.type = "short_answer";
        q.part = 4;
        q.isPart4 = true;
        if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === "") q.correctAnswer = "0";
    }

    soiDeState.examData.questions = reorganizeAllQuestionsByParts(soiDeState.examData.questions);
    renderSoiDeBothSides();
    setTimeout(() => {
        autoResizeAllTextareas();
        if (typeof scrollToLeftPreviewQuestion === "function") scrollToLeftPreviewQuestion(targetId, true);
        if (typeof scrollToRightEditorQuestion === "function") scrollToRightEditorQuestion(targetId, true);
    }, 40);
    showSoiDeToast("✅ Đã chuyển câu sang phần mới! Bấm ⚡ Update để lưu.");
}

function insertQuestionAfter(qIdx) {
    const questions = soiDeState.examData.questions || [];
    const newId = generateSoiDeNewId(questions);
    const currentQ = questions[qIdx];
    const currentPart = currentQ ? getQuestionPartType(currentQ) : 1;

    let newQuestion = {
        id: newId,
        type: "multiple_choice",
        part: 1,
        isPart4: false,
        question: "Câu hỏi mới: Cho hàm số $y = f(x)$...",
        options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        correct: 0,
        explanation: "Lời giải chi tiết câu hỏi này..."
    };

    if (currentPart === 2) {
        newQuestion = {
            id: newId,
            type: "true_false",
            part: 2,
            isPart4: false,
            question: "Xét tính đúng sai của các mệnh đề sau:",
            statements: [
                { id: "a", statement: "Mệnh đề a", correct: true },
                { id: "b", statement: "Mệnh đề b", correct: false },
                { id: "c", statement: "Mệnh đề c", correct: true },
                { id: "d", statement: "Mệnh đề d", correct: false }
            ],
            explanation: ""
        };
    } else if (currentPart === 3) {
        newQuestion = { id: newId, type: "short_answer", part: 3, isPart4: false, question: "Tìm giá trị của biểu thức sau:", correctAnswer: "0", explanation: "" };
    } else if (currentPart === 4) {
        newQuestion = { id: newId, type: "short_answer", part: 4, isPart4: true, question: "PHẦN IV. Tự luận ngắn:", correctAnswer: "0", explanation: "" };
    }

    insertQuestionsOrganizedByPart([newQuestion]);
    renderSoiDeBothSides();

    setTimeout(() => {
        autoResizeAllTextareas();
        scrollToLeftPreviewQuestion(newId, true);
        const newCard = document.getElementById(`soide-qcard-${newId}`);
        if (newCard) newCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
}

function addNewQuestionToSoiDe() {
    const questions = soiDeState.examData.questions || [];
    const newId = generateSoiDeNewId(questions);

    const newQ = {
        id: newId,
        type: "multiple_choice",
        part: 1,
        isPart4: false,
        question: "Câu hỏi trắc nghiệm mới...",
        options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        correct: 0,
        explanation: ""
    };

    insertQuestionsOrganizedByPart([newQ]);
    renderSoiDeBothSides();

    setTimeout(() => {
        autoResizeAllTextareas();
        scrollToLeftPreviewQuestion(newId, true);
        const newCard = document.getElementById(`soide-qcard-${newId}`);
        if (newCard) newCard.scrollIntoView({ behavior: "smooth", block: "center" });
        showSoiDeToast("➕ Đã thêm câu mới vào cuối Phần I!");
    }, 80);
}

function deleteQuestionFromSoiDe(qIdx) {
    const qNum = qIdx + 1;
    if (!confirm(`⚠️ Bạn có chắc chắn muốn XÓA Câu ${qNum} không?`)) return;
    soiDeState.examData.questions.splice(qIdx, 1);
    renderSoiDeBothSides();
}

function deleteQuestionFromLeftPreview(qId) {
    const qIdx = soiDeState.examData.questions.findIndex(q => String(q.id) === String(qId));
    if (qIdx !== -1) deleteQuestionFromSoiDe(qIdx);
}

function toggleCardRawBox(qId) {
    const key = String(qId);
    if (soiDeState.rawEditingCardIds.has(key)) soiDeState.rawEditingCardIds.delete(key);
    else soiDeState.rawEditingCardIds.add(key);
    renderSoiDeRightEditor();
    setTimeout(() => {
        autoResizeAllTextareas();
        const box = document.getElementById(`soide-card-raw-box-${key}`);
        if (box) {
            box.scrollIntoView({ behavior: "smooth", block: "center" });
            const ta = document.getElementById(`soide-card-raw-text-${key}`);
            if (ta) ta.focus();
        }
    }, 40);
}

async function handlePasteZoneClick(qIdx, mode) {
    let clipboardText = "";
    if (navigator.clipboard && navigator.clipboard.readText) {
        try { clipboardText = await navigator.clipboard.readText(); } catch (e) {}
    }

    if (mode === "overwrite") {
        const targetQ = soiDeState.examData.questions[qIdx];
        if (!targetQ) return;
        const key = String(targetQ.id);
        soiDeState.rawEditingCardIds.add(key);

        renderSoiDeRightEditor();
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${key}`);
            if (ta) {
                if (clipboardText && clipboardText.trim()) {
                    ta.value = clipboardText.trim();
                    showSoiDeToast(`📋 Đã nạp nội dung dán vào mã thô Câu ${qIdx + 1}!`);
                }
                ta.focus();
            }
            scrollToLeftPreviewQuestion(targetQ.id, true);
        }, 50);
    } else if (mode === "insert") {
        const questions = soiDeState.examData.questions || [];
        let parsedQuestions = [];
        if (clipboardText && clipboardText.trim()) parsedQuestions = parseSmartQuestionOrQuestions(clipboardText);

        if (parsedQuestions.length === 0) {
            parsedQuestions = [{
                id: generateSoiDeNewId(questions),
                type: "multiple_choice",
                part: 1,
                isPart4: false,
                question: "Câu hỏi mới: ...",
                options: ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
                correct: 0,
                explanation: ""
            }];
        } else {
            const tempUsed = [...questions];
            parsedQuestions.forEach(q => {
                q.id = generateSoiDeNewId(tempUsed);
                tempUsed.push(q);
            });
        }

        insertQuestionsOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => soiDeState.rawEditingCardIds.add(String(q.id)));
        renderSoiDeBothSides();

        const firstAddedId = parsedQuestions[0].id;
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${firstAddedId}`);
            if (ta && clipboardText && clipboardText.trim()) ta.value = clipboardText.trim();
            scrollToLeftPreviewQuestion(firstAddedId, true);
            const card = document.getElementById(`soide-qcard-${firstAddedId}`);
            if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
            showSoiDeToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào CUỐI từng phần tương ứng!`);
        }, 70);
    }
}

function handlePasteOnQuestion(event, qIdx, mode) {
    event.preventDefault();
    event.stopPropagation();
    const text = (event.clipboardData || window.clipboardData)?.getData("text");

    if (mode === "overwrite") {
        const targetQ = soiDeState.examData.questions[qIdx];
        if (!targetQ) return;
        const key = String(targetQ.id);
        soiDeState.rawEditingCardIds.add(key);
        renderSoiDeRightEditor();
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${key}`);
            if (ta) { if (text) ta.value = text.trim(); ta.focus(); }
            showSoiDeToast(`📋 Đã dán vào mã thô Câu ${qIdx + 1}!`);
        }, 40);
    } else if (mode === "insert") {
        const questions = soiDeState.examData.questions || [];
        let parsedQuestions = parseSmartQuestionOrQuestions(text);
        if (parsedQuestions.length === 0) {
            parsedQuestions = [{
                id: generateSoiDeNewId(questions),
                type: "multiple_choice",
                part: 1,
                isPart4: false,
                question: text || "Câu hỏi mới...",
                options: ["A", "B", "C", "D"],
                correct: 0,
                explanation: ""
            }];
        } else {
            const tempUsed = [...questions];
            parsedQuestions.forEach(q => {
                q.id = generateSoiDeNewId(tempUsed);
                tempUsed.push(q);
            });
        }

        insertQuestionsOrganizedByPart(parsedQuestions);
        parsedQuestions.forEach(q => soiDeState.rawEditingCardIds.add(String(q.id)));
        renderSoiDeBothSides();

        const firstAddedId = parsedQuestions[0].id;
        setTimeout(() => {
            const ta = document.getElementById(`soide-card-raw-text-${firstAddedId}`);
            if (ta && text) ta.value = text.trim();
            scrollToLeftPreviewQuestion(firstAddedId, true);
            showSoiDeToast(`✅ Đã tự động xếp ${parsedQuestions.length} câu vào CUỐI từng phần tương ứng!`);
        }, 60);
    }
}

function applyCardRawInput(qIdx, qId) {
    const ta = document.getElementById(`soide-card-raw-text-${qId}`);
    if (!ta) return;
    const rawVal = ta.value.trim();
    if (!rawVal) { alert("⚠️ Vui lòng nhập nội dung câu hỏi!"); return; }

    const qObj = parseSmartSingleQuestion(rawVal);
    if (!qObj) { alert("⚠️ Không nhận diện được cấu trúc câu hỏi!"); return; }

    const targetQ = (soiDeState.examData.questions || []).find(x => String(x.id) === String(qId)) || soiDeState.examData.questions[qIdx];
    if (targetQ) {
        targetQ.type = qObj.type;
        targetQ.question = qObj.question;
        if (qObj.options) targetQ.options = qObj.options;
        if (qObj.statements) targetQ.statements = qObj.statements;
        if (qObj.correct !== undefined) targetQ.correct = qObj.correct;
        if (qObj.correctAnswer !== undefined) targetQ.correctAnswer = qObj.correctAnswer;
        if (qObj.explanation !== undefined) targetQ.explanation = qObj.explanation;

        const explicitPart = parseInt(qObj.part, 10);
        if (explicitPart >= 1 && explicitPart <= 4) {
            targetQ.part = explicitPart;
            targetQ.isPart4 = (explicitPart === 4);
        } else if (qObj.isPart4 !== undefined) {
            targetQ.isPart4 = !!qObj.isPart4;
            targetQ.part = targetQ.isPart4 ? 4 : (qObj.type === "multiple_choice" ? 1 : (qObj.type === "true_false" ? 2 : 3));
        } else if (qObj.type === "essay" || qObj.type === "essay_answer" || qObj.type === "part4") {
            targetQ.part = 4;
            targetQ.isPart4 = true;
        } else if (qObj.type === "multiple_choice") {
            targetQ.part = 1;
            targetQ.isPart4 = false;
        } else if (qObj.type === "true_false") {
            targetQ.part = 2;
            targetQ.isPart4 = false;
        } else {
            const isTextP4 = /PH[ẦA]N\s*(IV|4)/i.test(String(qObj.question || ""));
            targetQ.part = isTextP4 ? 4 : 3;
            targetQ.isPart4 = isTextP4;
        }

        if (qObj.imageUrl !== undefined && qObj.imageUrl !== "") targetQ.imageUrl = qObj.imageUrl;
        if (qObj.imageKey !== undefined && qObj.imageKey !== "") targetQ.imageKey = qObj.imageKey;
    }

    soiDeState.examData.questions = reorganizeAllQuestionsByParts(soiDeState.examData.questions);
    soiDeState.rawEditingCardIds.delete(String(qId));
    renderSoiDeBothSides();

    setTimeout(() => {
        autoResizeAllTextareas();
        scrollToLeftPreviewQuestion(qId, true);
    }, 40);

    showSoiDeToast("✅ Đã nhận diện và sắp xếp chuẩn vào phần tương ứng!");
}

function setSoiDeEditorMode(mode) {
    soiDeState.editorMode = mode;
    const btnCards = document.getElementById("btn-mode-cards");
    const btnRaw = document.getElementById("btn-mode-raw");
    const cardsBox = document.getElementById("soide-cards-container");
    const rawBox = document.getElementById("soide-raw-container");

    if (mode === "cards") {
        if (btnCards) btnCards.classList.add("active");
        if (btnRaw) btnRaw.classList.remove("active");
        if (cardsBox) cardsBox.style.display = "flex";
        if (rawBox) rawBox.style.display = "none";
        renderSoiDeRightEditor();
    } else {
        if (btnCards) btnCards.classList.remove("active");
        if (btnRaw) btnRaw.classList.add("active");
        if (cardsBox) cardsBox.style.display = "none";
        if (rawBox) rawBox.style.display = "flex";
        updateRawTextFromState();
    }
}

function updateRawTextFromState() {
    const rawEditor = document.getElementById("soide-raw-editor");
    if (!rawEditor) return;

    const data = soiDeState.examData;
    const questions = data.questions || [];

    let scriptOutput = `const examData = {\n`;
    scriptOutput += `  title: ${JSON.stringify(data.title || "ĐỀ THI")},\n`;
    scriptOutput += `  maDe: ${JSON.stringify(data.maDe || "101")},\n`;
    scriptOutput += `  timeLimitMinutes: ${parseInt(data.timeLimitMinutes, 10) || 90},\n`;
    scriptOutput += `  images: ${JSON.stringify(data.images || {}, null, 4)},\n`;
    scriptOutput += `  questions: [\n`;

    questions.forEach((q, idx) => {
        const qJson = JSON.stringify(q, null, 4);
        const indentedQJson = qJson.split("\n").map(line => "    " + line).join("\n");
        scriptOutput += `    //---------------------------------------- Câu ${idx + 1}\n`;
        scriptOutput += `${indentedQJson}${idx < questions.length - 1 ? "," : ""}\n`;
    });

    scriptOutput += `    //---------------------------------------- HẾT ĐỀ\n`;
    scriptOutput += `  ]\n};`;
    rawEditor.value = scriptOutput;
}

function syncSoiDeFromRawText(text) {
    try {
        const parsed = robustParseExamScriptOrJson(text);
        if (parsed && Array.isArray(parsed.questions)) {
            soiDeState.examData = {
                ...soiDeState.examData,
                ...parsed,
                questions: reorganizeAllQuestionsByParts(parsed.questions)
            };
            setValidationStatus(true, "✅ Cú pháp mã nguồn hợp lệ (Đã xếp 4 phần)!");
            renderSoiDeLeftLivePreview();
            return true;
        } else if (Array.isArray(parsed)) {
            soiDeState.examData.questions = reorganizeAllQuestionsByParts(parsed);
            setValidationStatus(true, "✅ Cú pháp mảng câu hỏi hợp lệ (Đã xếp 4 phần)!");
            renderSoiDeLeftLivePreview();
            return true;
        } else {
            setValidationStatus(false, "⚠️ Cần có biến examData chứa trường questions!");
            return false;
        }
    } catch (e) {
        setValidationStatus(false, "❌ Lỗi cú pháp: " + e.message);
        return false;
    }
}

function handleSoiDeRawInput(text) {
    debouncedFunction(() => {
        syncSoiDeFromRawText(text);
    }, 400);
}

function debouncedLivePreview() {
    debouncedFunction(() => {
        renderSoiDeLeftLivePreview();
        updateRawTextFromState();
    }, 250);
}

function debouncedFunction(fn, delay = 250) {
    if (soiDeState.debounceTimer) clearTimeout(soiDeState.debounceTimer);
    soiDeState.debounceTimer = setTimeout(fn, delay);
}

function validateExamSyntax(questions) {
    const errors = [];
    if (!Array.isArray(questions) || questions.length === 0) {
        errors.push("Đề thi chưa có câu hỏi nào!");
        return errors;
    }

    questions.forEach((q, idx) => {
        const qNum = idx + 1;
        if (!q.question || !q.question.trim()) {
            errors.push(`Câu ${qNum}: Nội dung câu hỏi đang để trống!`);
        } else {
            const dollarMatches = q.question.match(/(^|[^\\])\$/g);
            if (dollarMatches && dollarMatches.length % 2 !== 0) {
                errors.push(`Câu ${qNum}: Dấu công thức toán '$' chưa đóng mở cân bằng!`);
            }
        }
        if (q.type === "multiple_choice" && !isPart4Question(q)) {
            if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`Câu ${qNum}: Cần có ít nhất 2 phương án lựa chọn!`);
        } else if (q.type === "true_false" && !isPart4Question(q)) {
            if (!Array.isArray(q.statements) || q.statements.length === 0) errors.push(`Câu ${qNum}: Thiếu danh sách mệnh đề đúng sai!`);
        }
    });
    return errors;
}

function setValidationStatus(isValid, msg) {
    const alertBox = document.getElementById("soide-alert-box");
    if (!alertBox) return;
    if (isValid) {
        alertBox.className = "soide-alert-box is-valid";
        alertBox.innerText = msg || "✅ Cú pháp & công thức hợp lệ";
    } else {
        alertBox.className = "soide-alert-box has-errors";
        alertBox.innerText = msg;
    }
}

function renderSoiDeLeftLivePreview() {
    const previewContainer = document.getElementById("soide-live-preview-content");
    const countEl = document.getElementById("soide-live-qcount");
    if (!previewContainer) return;

    const questions = soiDeState.examData.questions || [];
    if (countEl) countEl.innerText = questions.length;

    const errors = validateExamSyntax(questions);
    if (errors.length > 0) setValidationStatus(false, `⚠️ Có ${errors.length} cảnh báo: ${errors[0]}`);
    else setValidationStatus(true, "✅ Cú pháp & công thức hợp lệ");

    if (questions.length === 0) {
        previewContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b; font-weight:700;">Chưa có câu hỏi nào. Hãy upload file hoặc bấm [➕ Thêm câu mới] bên phải!</div>`;
        return;
    }

    let html = "";
    const imageMap = soiDeState.examData.images || {};
    const letters = ["A", "B", "C", "D"];

    questions.forEach((q, qIdx) => {
        const displayIndex = qIdx + 1;
        const qId = q.id;
        const safeQId = safeSoiDeJsArg(qId);
        const attrQId = escapeHtmlForAttr(qId);
        const palette = SOI_DE_THEME_PALETTES[qIdx % SOI_DE_THEME_PALETTES.length];

        let currentPartType = "multiple_choice";
        if (getQuestionPartType(q) === 4) currentPartType = "part4";
        else if (q.type === "true_false") currentPartType = "true_false";
        else if (q.type === "short_answer") currentPartType = "short_answer";

        const imgUrl = soideResolveImgUrl(q, imageMap);
        const imgHtml = imgUrl ? `
            <div class="quiz-img-container" id="soide-img-box-${attrQId}">
                <div class="quiz-img-wrapper" style="position:relative; display:inline-block;">
                    <img src="${escapeHtmlForAttr(imgUrl)}" class="quiz-img" style="max-height:260px;" onerror="soideHandleImgError(this)" alt="Hình câu ${displayIndex}">
                </div>
            </div>` : `<div class="quiz-img-container" id="soide-img-box-${attrQId}" style="display:none;"></div>`;

        const imgKey = q.imageKey || `img_q_${qId}`;
        const safeImgKey = safeSoiDeJsArg(imgKey);
        const uploaderHtml = `
            <div class="admin-img-uploader-zone" id="zone-soide-${attrQId}" tabindex="0" title="Click vào đây và bấm Ctrl+V để dán ảnh chụp màn hình Snipping Tool" style="margin: 4px 0 8px 0; padding: 5px 8px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                <div class="admin-uploader-btn-group">
                    <button type="button" class="btn-admin-paste-img" onclick="triggerSoiDePastePrompt('${safeQId}', '${safeImgKey}')">
                        📋 Dán ảnh (Ctrl+V)
                    </button>
                    <button type="button" class="btn-admin-file-img" onclick="document.getElementById('file-soide-${safeQId}').click()">
                        📁 Tệp ảnh
                    </button>
                    ${imgUrl ? `
                    <button type="button" class="btn-admin-del-img" onclick="deleteSoiDeQuestionImage('${safeQId}', '${safeImgKey}')">
                        🗑️ Xóa ảnh
                    </button>` : ""}
                    <input type="file" id="file-soide-${attrQId}" accept="image/*" style="display:none;" onchange="handleSoiDeQuestionImageSelected(this, '${safeQId}', '${safeImgKey}')">
                </div>
                <span class="admin-uploader-status" id="status-soide-${attrQId}"></span>
            </div>
        `;

        let bodyHtml = "";
        if (currentPartType === "multiple_choice") {
            const correctLetter = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").trim().toUpperCase();
            const opts = q.options || [];
            const maxLen = opts.reduce((max, opt) => Math.max(max, String(opt || "").length), 0);
            let layoutClass = "opt-grid-4";
            if (maxLen > 55) layoutClass = "opt-grid-1";
            else if (maxLen > 22) layoutClass = "opt-grid-2";

            bodyHtml = `
                <div class="options-list ${layoutClass}">
                    ${opts.map((opt, oIdx) => {
                        const L = letters[oIdx] || "";
                        const isCorrect = (L === correctLetter);
                        return `
                            <div class="opt-label ${isCorrect ? "selected" : ""}" style="cursor:default; padding: 6px 9px;">
                                <span class="opt-circle" style="width:23px; height:23px; font-size:0.85rem;">${L}</span>
                                <span class="opt-text">${opt} ${isCorrect ? '<b style="color:#16a34a; margin-left:4px;">✓</b>' : ""}</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        } else if (currentPartType === "true_false") {
            bodyHtml = `
                <div class="tf-table-box" style="margin-top:4px;">
                    <table class="tf-table">
                        <thead>
                            <tr><th>Mệnh đề</th><th width="75" style="text-align:center;">Đáp án</th></tr>
                        </thead>
                        <tbody>
                            ${(q.statements || []).map(st => {
                                const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                                return `
                                    <tr>
                                        <td><b>${escapeHtml(st.id)})</b> ${st.statement}</td>
                                        <td align="center" style="font-weight:900; color:${isTrue ? "#16a34a" : "#dc2626"};">
                                            ${isTrue ? "🟢 Đúng" : "🔴 Sai"}
                                        </td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            bodyHtml = `
                <div style="background:#f0fdf4; border:1px solid #86efac; padding:6px 10px; border-radius:7px; font-weight:800; color:#166534; margin-top:4px; display:inline-block;">
                    🎯 Đáp số: <span style="font-size:1.1em; color:#0f172a;">${escapeHtml(q.correctAnswer || "(Chưa nhập)")}</span>
                </div>
            `;
        }

        const explainHtml = q.explanation ? `
            <div class="explanation-box" style="margin-top:6px; padding:6px 10px; font-size:0.92rem;">
                💡 <b>Lời giải chi tiết:</b> ${q.explanation}
            </div>` : "";

        html += `
            <div class="soide-preview-card" id="soide-preview-card-${attrQId}" data-qid="${attrQId}" style="background:${palette.bg}; border:1.8px solid ${palette.border};">
                <div class="soide-preview-head-row">
                    <div class="soide-preview-title-badge" style="color:${palette.text};">
                        <b>Câu ${displayIndex}</b> <span style="font-size:11.5px; opacity:0.85; font-weight:700;">(ID: ${escapeHtml(q.id)})</span>
                    </div>

                    <div class="soide-head-actions">
                        <select class="soide-part-select-mini" onchange="changeSoiDeQuestionType(${qIdx}, this.value)" title="Chuyển câu này sang phần khác">
                            <option value="multiple_choice" ${currentPartType === "multiple_choice" ? "selected" : ""}>Phần I (Trắc nghiệm)</option>
                            <option value="true_false" ${currentPartType === "true_false" ? "selected" : ""}>Phần II (Đúng/Sai)</option>
                            <option value="short_answer" ${currentPartType === "short_answer" ? "selected" : ""}>Phần III (Trả lời ngắn)</option>
                            <option value="part4" ${currentPartType === "part4" ? "selected" : ""}>Phần IV (Tự luận ngắn)</option>
                        </select>

                        <button type="button" class="btn-soide-mini btn-soide-add-inline" onclick="insertQuestionAfter(${qIdx})" title="Thêm câu hỏi mới liền kề">
                            ➕ Thêm
                        </button>
                        <button type="button" class="btn-soide-mini btn-soide-del-inline" onclick="deleteQuestionFromLeftPreview('${safeQId}')" title="Xóa câu ${displayIndex}">
                            🗑️ Xóa
                        </button>
                    </div>
                </div>

                <div class="q-content-text" style="margin-bottom:6px;">${formatQuestionText(q.question || "")}</div>

                ${uploaderHtml}
                ${imgHtml}
                ${bodyHtml}
                ${explainHtml}
            </div>
        `;
    });

    previewContainer.innerHTML = html;
    setupSoiDePasteListeners();

    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([previewContainer]).catch(() => {});
    }
}

function setupSoiDePasteListeners() {
    document.querySelectorAll(".soide-left-pane .soide-preview-card").forEach(card => {
        card.addEventListener("paste", function(e) {
            const qId = this.dataset.qid;
            const q = (soiDeState.examData.questions || []).find(item => String(item.id) === String(qId));
            const imgKey = (q && q.imageKey) || `img_q_${qId}`;
            const clipboardItems = (e.clipboardData || window.clipboardData)?.items;
            if (!clipboardItems) return;

            for (let i = 0; i < clipboardItems.length; i++) {
                const item = clipboardItems[i];
                if (item.type.indexOf("image") !== -1) {
                    e.preventDefault();
                    if (typeof uploadSoiDeImage === "function") {
                        uploadSoiDeImage(item.getAsFile(), qId, imgKey);
                    }
                    break;
                }
            }
        });
    });
}

// Xuất ra window scope
window.escapeHtml = escapeHtml;
window.escapeHtmlForAttr = escapeHtmlForAttr;
window.generateSoiDeNewId = generateSoiDeNewId;
window.initDefaultSoiDeExam = initDefaultSoiDeExam;
window.renderSoiDeBothSides = renderSoiDeBothSides;
window.renderSoiDeRightEditor = renderSoiDeRightEditor;
window.renderSoiDeLeftLivePreview = renderSoiDeLeftLivePreview;
window.updateSoiDeMeta = updateSoiDeMeta;
window.updateSoiDeQuestionText = updateSoiDeQuestionText;
window.updateSoiDeOption = updateSoiDeOption;
window.updateSoiDeCorrectMC = updateSoiDeCorrectMC;
window.updateSoiDeStatementText = updateSoiDeStatementText;
window.updateSoiDeStatementCorrect = updateSoiDeStatementCorrect;
window.updateSoiDeShortAnswer = updateSoiDeShortAnswer;
window.updateSoiDeExplanation = updateSoiDeExplanation;
window.changeSoiDeQuestionType = changeSoiDeQuestionType;
window.insertQuestionAfter = insertQuestionAfter;
window.addNewQuestionToSoiDe = addNewQuestionToSoiDe;
window.deleteQuestionFromSoiDe = deleteQuestionFromSoiDe;
window.deleteQuestionFromLeftPreview = deleteQuestionFromLeftPreview;
window.toggleCardRawBox = toggleCardRawBox;
window.handlePasteZoneClick = handlePasteZoneClick;
window.handlePasteOnQuestion = handlePasteOnQuestion;
window.applyCardRawInput = applyCardRawInput;
window.setSoiDeEditorMode = setSoiDeEditorMode;
window.updateRawTextFromState = updateRawTextFromState;
window.syncSoiDeFromRawText = syncSoiDeFromRawText;
window.handleSoiDeRawInput = handleSoiDeRawInput;
window.debouncedLivePreview = debouncedLivePreview;
window.debouncedFunction = debouncedFunction;
window.validateExamSyntax = validateExamSyntax;
window.setValidationStatus = setValidationStatus;
