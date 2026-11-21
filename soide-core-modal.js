// =========================================================
// FILE: soide-core-modal.js
// MODULE 1/3 CỦA HỆ THỐNG SOI ĐỀ THỜI GIAN THỰC:
// - QUẢN LÝ STATE soiDeState & BẢNG MÀU / DANH SÁCH LỚP
// - TIÊM CSS GIAO DIỆN & KHỞI TẠO MODAL SOI ĐỀ 2 CỘT
// - KÉO CHIA TỶ LỆ MÀN HÌNH & ĐỒNG BỘ CUỘN 2 CHIỀU TRÁI <-> PHẢI
// - NẠP ĐỀ TỪ PHÒNG THI (thi.html) & PHÂN TÍCH CÚ PHÁP THÔNG MINH
// =========================================================

let soiDeState = {
    examData: {
        title: "ĐỀ THI MỚI",
        maDe: "101",
        timeLimitMinutes: 90,
        images: {},
        questions: []
    },
    rawEditorText: "",
    editorMode: "cards",
    splitRatio: 50,
    isDraggingSplit: false,
    debounceTimer: null,
    validationErrors: [],
    rawEditingCardIds: new Set(),
    isFromExamRoom: false,
    isFromQBank: false
};

const SOI_DE_AVAILABLE_CLASSES = [
    { id: "lop-11a", name: "🏫 Lớp 11A" },
    { id: "lop-11c", name: "🏫 Lớp 11C" },
    { id: "lop-10p", name: "🏫 Lớp 10P" },
    { id: "lop-11e", name: "🏫 Lớp 11E" },
    { id: "them-10", name: "📐 Thêm 10" },
    { id: "them-11", name: "✍️ Thêm 11" },
    { id: "them-12", name: "🎓 Thêm 12" },
    { id: "hsg-toan-11", name: "🏆 HSG Toán 11" }
];

const SOI_DE_THEME_PALETTES = [
    { border: "#38bdf8", bg: "#f0f9ff", badgeBg: "linear-gradient(135deg, #0284c7, #0369a1)", text: "#0369a1", lightBorder: "#bae6fd" },
    { border: "#34d399", bg: "#f0fdf4", badgeBg: "linear-gradient(135deg, #059669, #047857)", text: "#065f46", lightBorder: "#a7f3d0" },
    { border: "#c084fc", bg: "#faf5ff", badgeBg: "linear-gradient(135deg, #9333ea, #7c3aed)", text: "#6b21a8", lightBorder: "#e9d5ff" },
    { border: "#fb923c", bg: "#fff7ed", badgeBg: "linear-gradient(135deg, #ea580c, #c2410c)", text: "#9a3412", lightBorder: "#fed7aa" },
    { border: "#f472b6", bg: "#fdf2f8", badgeBg: "linear-gradient(135deg, #db2777, #be185d)", text: "#9d174d", lightBorder: "#fbcfe8" },
    { border: "#eab308", bg: "#fefce8", badgeBg: "linear-gradient(135deg, #ca8a04, #a16207)", text: "#854d0e", lightBorder: "#fef08a" }
];

let lastSyncedQId_RightToLeft = null;
let lastSyncedQId_LeftToRight = null;
let activeScrollPane = null;

function safeSoiDeJsArg(val) {
    return String(val ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function checkIsAdminModeSafe() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("admin") === "1") return true;
        if (typeof safeLocal !== "undefined") {
            const logged = safeLocal.getItem("adminLoggedInSession");
            const expiresAt = safeLocal.getItem("admin_expires_at");
            if (logged === "true" && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
                return true;
            }
        }
    } catch (e) {}
    return false;
}

function isPart4Question(q) {
    if (!q) return false;
    if (q.part === 4 || q.isPart4 === true) return true;
    if (q.type === "essay" || q.type === "essay_answer" || q.type === "part4") return true;
    const txt = String(q.question || "").toUpperCase();
    if (txt.includes("PHẦN IV") || txt.includes("PHAN IV") || txt.includes("PHẦN 4") || txt.includes("PHAN 4")) {
        return true;
    }
    return false;
}

function getQuestionPartType(q) {
    if (!q) return 1;
    if (isPart4Question(q)) return 4;
    if (q.type === "true_false") return 2;
    if (q.type === "short_answer") return 3;
    return 1;
}

function reorganizeAllQuestionsByParts(questionsList) {
    if (!Array.isArray(questionsList)) return [];
    const p1 = questionsList.filter(q => getQuestionPartType(q) === 1);
    const p2 = questionsList.filter(q => getQuestionPartType(q) === 2);
    const p3 = questionsList.filter(q => getQuestionPartType(q) === 3);
    const p4 = questionsList.filter(q => getQuestionPartType(q) === 4);
    return [...p1, ...p2, ...p3, ...p4];
}

function insertQuestionsOrganizedByPart(newQuestions) {
    if (!Array.isArray(newQuestions) || newQuestions.length === 0) return [];
    const currentQuestions = soiDeState.examData.questions || [];
    const p1 = currentQuestions.filter(q => getQuestionPartType(q) === 1);
    const p2 = currentQuestions.filter(q => getQuestionPartType(q) === 2);
    const p3 = currentQuestions.filter(q => getQuestionPartType(q) === 3);
    const p4 = currentQuestions.filter(q => getQuestionPartType(q) === 4);

    newQuestions.forEach(newQ => {
        const pType = getQuestionPartType(newQ);
        if (pType === 1) p1.push(newQ);
        else if (pType === 2) p2.push(newQ);
        else if (pType === 3) p3.push(newQ);
        else p4.push(newQ);
    });

    soiDeState.examData.questions = [...p1, ...p2, ...p3, ...p4];
    return newQuestions;
}

function formatQuestionText(text) {
    if (!text) return "";
    let formatted = String(text).replace(/\\begin\{center\}/gi, '<div style="width:100%; overflow-x:auto; text-align:center; margin: 10px 0; padding-bottom: 5px;">');
    formatted = formatted.replace(/\\end\{center\}/gi, "</div>");
    formatted = formatted.replace(/\\begin\{tabular\}([\s\S]*?)\\end\{tabular\}/gi, function(match, tabularContent) {
        const cleanContent = tabularContent.replace(/\$/g, "").replace(/\\\(/g, "").replace(/\\\)/g, "");
        return "$$ \\begin{array}" + cleanContent + "\\end{array} $$";
    });
    return formatted.replace(/(^|[^:])\/\/\s*([^\r\n<]+)/g, function(match, prefix, content) {
        return prefix + '<span style="color: #78350f; font-weight: 800;">// ' + content.trim() + "</span>";
    });
}

function soideResolveImgUrl(q, imageMap) {
    if (typeof getEffectiveImageUrl === "function") return getEffectiveImageUrl(q, imageMap);
    if (!q) return "";
    const map = (imageMap && typeof imageMap === "object") ? imageMap : {};
    const toDirect = (u) => (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(u) : String(u).trim();
    if (q.imageUrl && String(q.imageUrl).trim() !== "") return toDirect(q.imageUrl);
    if (q.imageKey && map[q.imageKey] && String(map[q.imageKey]).trim() !== "") return toDirect(map[q.imageKey]);
    const qIdStr = String(q.id || "").trim();
    const candidates = [`img_q_${qIdStr}`, `q${qIdStr}`, qIdStr, `pbc_p1_c${qIdStr}`, `pbc_p2_c${qIdStr}`, `pbc_p3_c${qIdStr}`, `pbc_p4_c${qIdStr}`, `cau_${qIdStr}`, `cau${qIdStr}`];
    for (const k of candidates) {
        if (map[k] && String(map[k]).trim() !== "") return toDirect(map[k]);
    }
    return "";
}

function soideHandleImgError(imgEl) {
    if (typeof handleQuizImgError === "function") { handleQuizImgError(imgEl); return; }
    if (!imgEl || !imgEl.src) return;
    const currentSrc = imgEl.src;
    if (currentSrc.includes("googleusercontent.com") || currentSrc.includes("drive.google.com")) {
        const m = currentSrc.match(/(?:file\/d\/|id=|open\?id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
        if (m && m[1]) {
            const fileId = m[1];
            const triedLevel = parseInt(imgEl.dataset.fallbackLevel || "0", 10);
            if (triedLevel === 0) { imgEl.dataset.fallbackLevel = "1"; imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1400`; return; }
            if (triedLevel === 1) { imgEl.dataset.fallbackLevel = "2"; imgEl.src = `https://lh3.googleusercontent.com/u/0/d/${fileId}`; return; }
            if (triedLevel === 2) { imgEl.dataset.fallbackLevel = "3"; imgEl.src = `https://drive.google.com/uc?export=view&id=${fileId}`; return; }
        }
    }
    imgEl.style.display = "none";
}

function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight + 4, 38) + "px";
}

function autoResizeAllTextareas() {
    document.querySelectorAll("#soide-cards-container textarea.soide-latex-input, #soide-cards-container textarea.soide-card-raw-textarea").forEach(autoResizeTextarea);
}

function extractQuestionAnswersRobustly(q, fallbackVault = {}) {
    const letters = ["A", "B", "C", "D"];
    const qIdKey = `q${q.id}`;
    const result = { correct: 0, statementsCorrect: {}, correctAnswer: "", explanation: q.explanation || "" };

    if (q.type === "multiple_choice" && !isPart4Question(q)) {
        let rawVal;
        if (fallbackVault && fallbackVault[qIdKey] !== undefined) rawVal = fallbackVault[qIdKey];
        else if (q.correct !== undefined) rawVal = q.correct;
        else if (q.answer !== undefined) rawVal = q.answer;
        else if (q.dapan !== undefined) rawVal = q.dapan;

        if (typeof rawVal === "number" && rawVal >= 0 && rawVal <= 3) {
            result.correct = rawVal;
        } else if (typeof rawVal === "string") {
            const u = rawVal.trim().toUpperCase();
            result.correct = letters.indexOf(u) !== -1 ? letters.indexOf(u) : 0;
        } else {
            const match = String(q.question || "").match(/(?:đáp\s*án|chọn|đ\/a|đa)\s*[:：\-]?\s*([A-D])/i);
            result.correct = match ? letters.indexOf(match[1].toUpperCase()) : 0;
        }
    } else if (q.type === "true_false" && !isPart4Question(q)) {
        (q.statements || []).forEach(st => {
            const subKey = `q${q.id}_${st.id}`;
            let stVal;
            if (fallbackVault && fallbackVault[subKey] !== undefined) stVal = fallbackVault[subKey];
            else if (st.correct !== undefined) stVal = st.correct;
            else if (st.answer !== undefined) stVal = st.answer;
            else if (st.dapan !== undefined) stVal = st.dapan;

            if (stVal !== undefined) {
                result.statementsCorrect[st.id] = (stVal === true || String(stVal).toLowerCase() === "đúng" || String(stVal).toLowerCase() === "true");
            } else {
                const m = String(st.statement || "").match(/[\(\[\{]\s*(Đúng|Sai|True|False)\s*[\)\]\}]/i);
                result.statementsCorrect[st.id] = m ? /^(Đúng|True)$/i.test(m[1]) : true;
            }
        });
    } else {
        let ansVal;
        if (fallbackVault && fallbackVault[qIdKey] !== undefined) ansVal = fallbackVault[qIdKey];
        else if (q.correctAnswer !== undefined) ansVal = q.correctAnswer;
        else if (q.correct !== undefined) ansVal = q.correct;
        else if (q.answer !== undefined) ansVal = q.answer;
        else if (q.dapan !== undefined) ansVal = q.dapan;

        if (ansVal !== undefined && ansVal !== null && String(ansVal).trim() !== "") {
            result.correctAnswer = String(ansVal).trim();
        } else {
            const m = String(q.question || "").match(/(?:đáp\s*số|kết\s*quả|kq)\s*[:：\-]?\s*([^\n\r]+)/i);
            result.correctAnswer = m ? m[1].trim() : "0";
        }
    }

    if (!result.explanation && fallbackVault && fallbackVault[`exp_${q.id}`]) {
        result.explanation = fallbackVault[`exp_${q.id}`];
    }
    return result;
}

function robustParseExamScriptOrJson(text) {
    if (!text) return null;
    let clean = String(text).trim();
    try { return JSON.parse(clean); } catch (e) {}
    try {
        const scriptText = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, "return ");
        return new Function(scriptText)();
    } catch (e) {
        clean = clean.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, "").trim();
        clean = clean.replace(/;?(\s*\/\*[\s\S]*?\*\/|\s*\/\/.*)*\s*$/, "").trim();
        if (clean.endsWith(";")) clean = clean.slice(0, -1).trim();
        try { return new Function("return (" + clean + ");")(); } catch (e2) { return null; }
    }
}

function parseSmartSingleQuestion(text) {
    if (!text || typeof text !== "string") return null;
    let cleanText = text.trim();
    cleanText = cleanText.replace(/^(?:\/\/|\s)*(?:Câu|Bài)\s*\d+[\s\:\.\-–—]*/i, "").trim();

    let parsed = robustParseExamScriptOrJson(cleanText);
    if (parsed) {
        if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
        if (typeof parsed === "object" && parsed.question) {
            return {
                type: parsed.type || (parsed.statements ? "true_false" : (parsed.options ? "multiple_choice" : "short_answer")),
                question: parsed.question,
                options: parsed.options || ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
                statements: parsed.statements || [],
                correct: parsed.correct !== undefined ? parsed.correct : 0,
                correctAnswer: parsed.correctAnswer || parsed.correct_answer || "",
                explanation: parsed.explanation || "",
                part: parsed.part,
                imageUrl: parsed.imageUrl || "",
                imageKey: parsed.imageKey || ""
            };
        }
    }

    let explanation = "";
    const explainMatch = cleanText.match(/(?:(?:Lời giải chi tiết|Hướng dẫn giải chi tiết|Hướng dẫn giải|Lời giải|HƯỚNG DẪN GIẢI|LỜI GIẢI|HDG|HD)\s*[:：\-]\s*)([\s\S]*)$/i);
    if (explainMatch) {
        explanation = explainMatch[1].trim();
        cleanText = cleanText.slice(0, explainMatch.index).trim();
    }

    let correctLetter = null;
    let shortAns = "";
    const correctMatch = cleanText.match(/(?:(?:Đáp án đúng|Đáp án chuẩn|Đáp án|Chọn|Đ\/A|ĐA)\s*[:：\-]?\s*)([A-D]|[a-d]|Đúng|Sai|[^\n\r]+)/i);
    if (correctMatch) {
        const rawAns = correctMatch[1].trim();
        if (/^[A-D]$/i.test(rawAns)) correctLetter = rawAns.toUpperCase();
        else shortAns = rawAns;
        cleanText = cleanText.replace(correctMatch[0], "").trim();
    }

    const optRegex = /(?:^|\n|\r)\s*([A-D])[\.\:\)]\s*([\s\S]*?)(?=(?:(?:^|\n|\r)\s*[A-D][\.\:\)])|$)/gi;
    const optMatches = [...cleanText.matchAll(optRegex)];
    if (optMatches.length >= 2) {
        const qText = cleanText.slice(0, optMatches[0].index).trim();
        const options = ["", "", "", ""];
        const letters = ["A", "B", "C", "D"];
        optMatches.forEach(m => {
            const idx = letters.indexOf(m[1].toUpperCase());
            if (idx !== -1) options[idx] = m[2].trim();
        });
        const correctIdx = (correctLetter && letters.indexOf(correctLetter) !== -1) ? letters.indexOf(correctLetter) : 0;
        return { type: "multiple_choice", question: qText || cleanText, options, correct: correctIdx, explanation };
    }

    const stRegex = /(?:^|\n|\r)\s*([a-d])[\)\.]\s*([\s\S]*?)(?=(?:(?:^|\n|\r)\s*[a-d][\)\.])|$)/gi;
    const stMatches = [...cleanText.matchAll(stRegex)];
    if (stMatches.length >= 2) {
        const qText = cleanText.slice(0, stMatches[0].index).trim();
        const statements = [];
        stMatches.forEach(m => {
            const id = m[1].toLowerCase();
            let stText = m[2].trim();
            let isCorrect = true;
            const markMatch = stText.match(/[\(\[\{]\s*(Đúng|Sai|True|False)\s*[\)\]\}]/i);
            if (markMatch) {
                isCorrect = /^(Đúng|True)$/i.test(markMatch[1]);
                stText = stText.replace(markMatch[0], "").trim();
            }
            statements.push({ id, statement: stText, correct: isCorrect });
        });
        return { type: "true_false", question: qText || cleanText, statements, explanation };
    }

    const isP4 = cleanText.toUpperCase().includes("PHẦN IV") || cleanText.toUpperCase().includes("PHẦN 4");
    if (shortAns || /^(?:Đáp số|Kết quả|KQ)/i.test(cleanText) || isP4) {
        let qText = cleanText;
        const ansMatch = cleanText.match(/(?:(?:Đáp số|Kết quả|KQ)\s*[:：\-]?\s*)([^\n\r]+)/i);
        let finalAns = shortAns;
        if (ansMatch) {
            if (!finalAns) finalAns = ansMatch[1].trim();
            qText = cleanText.replace(ansMatch[0], "").trim();
        }
        return { type: "short_answer", part: isP4 ? 4 : undefined, question: qText, correctAnswer: finalAns || "0", explanation };
    }

    return { type: "multiple_choice", question: cleanText, options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], correct: 0, explanation };
}

function parseSmartQuestionOrQuestions(text) {
    if (!text || typeof text !== "string") return [];
    const cleanText = text.trim();
    const robust = robustParseExamScriptOrJson(cleanText);
    if (robust) {
        if (Array.isArray(robust)) return robust.map(q => parseSmartSingleQuestion(JSON.stringify(q)));
        if (robust.questions && Array.isArray(robust.questions)) return robust.questions.map(q => parseSmartSingleQuestion(JSON.stringify(q)));
    }
    const splitRegex = /(?:^|\n|\r)\s*(?:\/\/\s*-{3,}|\/\/\s*Câu\s*\d+|Câu\s*\d+[\.\:\-])/i;
    const parts = cleanText.split(splitRegex).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
        const list = [];
        parts.forEach(p => { const parsed = parseSmartSingleQuestion(p); if (parsed) list.push(parsed); });
        if (list.length > 0) return list;
    }
    const single = parseSmartSingleQuestion(cleanText);
    return single ? [single] : [];
}

function injectSoiDeStyles() {
    const styleId = "soi-de-modal-custom-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .soide-modal-overlay {
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            z-index: 10000005 !important; display: none; align-items: center; justify-content: center;
            padding: 1vh 1vw; box-sizing: border-box; font-family: 'Be Vietnam Pro', 'Inter', sans-serif;
            animation: fadeInSoiDe 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeInSoiDe { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }

        .soide-modal-card {
            width: 98vw !important; height: 98vh !important;
            max-width: 98vw !important; max-height: 98vh !important;
            background: #ffffff; border-radius: 18px; border: 1.5px solid #cbd5e1;
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.5);
            display: flex; flex-direction: column; overflow: hidden; position: relative;
        }
        .soide-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 14px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff; border-bottom: 2px solid #10b981; flex-shrink: 0; gap: 8px;
        }
        .soide-header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .soide-header-title { font-size: 14px; font-weight: 900; color: #34d399; display: flex; align-items: center; gap: 6px; }
        .soide-header-tools { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; position: relative; }

        .btn-soide-tool {
            padding: 4px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 800;
            border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
            transition: all 0.15s ease; user-select: none; white-space: nowrap; font-family: inherit;
        }
        .btn-soide-tool:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .btn-soide-tool:active { transform: translateY(1.5px) scale(0.96); }

        .btn-soide-update {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            color: #ffffff !important; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.45) !important;
            border: 1px solid #fde68a !important; font-weight: 900 !important;
            animation: pulseUpdateBtn 1.8s infinite;
        }
        @keyframes pulseUpdateBtn {
            0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
            50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2); }
        }
        .btn-soide-upload-class {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: #ffffff !important; box-shadow: 0 2px 7px rgba(14, 165, 233, 0.4);
            border: 1px solid #7dd3fc !important;
        }
        .btn-soide-upload { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35); }
        .btn-soide-download { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; }
        .btn-soide-add { background: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%); color: #fff; }
        .btn-soide-switch { background: #334155; color: #cbd5e1; border: 1px solid #475569; }
        .btn-soide-switch.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
        .btn-soide-close { background: #334155; color: #f87171; border-radius: 50%; width: 28px; height: 28px; padding: 0; justify-content: center; font-size: 14px; font-weight: 900; }
        .btn-soide-close:hover { background: #ef4444; color: #ffffff; }

        .soide-class-dropdown {
            position: absolute; top: calc(100% + 8px); right: 120px; width: 260px;
            background: #ffffff; border-radius: 14px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.45);
            border: 1.5px solid #0284c7; padding: 10px 12px; z-index: 9999999;
            display: none; flex-direction: column; gap: 8px; animation: popInBadge 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .soide-class-dropdown.show { display: flex; }
        .soide-class-list-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 220px; overflow-y: auto; padding: 4px 2px; }
        .soide-class-chk-item {
            display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700;
            color: #1e293b; background: #f8fafc; border: 1.2px solid #cbd5e1; border-radius: 7px;
            padding: 5px 6px; cursor: pointer; user-select: none; transition: 0.15s;
        }
        .soide-class-chk-item:hover { border-color: #0284c7; background: #f0f9ff; }
        .soide-class-chk-item.checked { border-color: #0284c7; background: #e0f2fe; color: #0369a1; }
        .soide-class-chk-item input { margin: 0; accent-color: #0284c7; cursor: pointer; }

        .soide-split-body { flex: 1; display: flex; width: 100%; height: calc(100% - 46px); overflow: hidden; position: relative; user-select: none; }
        .soide-left-pane { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f8fafc; padding: 10px 12px; box-sizing: border-box; border-right: 1px solid #cbd5e1; user-select: text; scroll-behavior: smooth; }
        .soide-resizer { width: 8px; height: 100%; background: #e2e8f0; cursor: col-resize; flex-shrink: 0; position: relative; transition: background 0.15s; display: flex; align-items: center; justify-content: center; z-index: 10; }
        .soide-resizer::after { content: "⋮"; font-weight: 900; color: #64748b; font-size: 16px; line-height: 1; }
        .soide-resizer:hover, .soide-resizer.is-dragging { background: #10b981; }
        .soide-resizer:hover::after, .soide-resizer.is-dragging::after { color: #ffffff; }
        .soide-right-pane { height: 100%; overflow-y: auto; overflow-x: hidden; background: #ffffff; padding: 10px 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; user-select: text; scroll-behavior: smooth; }

        .soide-drop-zone { border: 1.5px dashed #10b981; border-radius: 10px; padding: 8px 12px; background: #f0fdf4; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; transition: all 0.2s ease; }
        .soide-drop-zone.dragover { background: #dcfce7; border-color: #059669; transform: scale(1.01); box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); }
        .soide-drop-text { font-size: 12px; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 5px; }

        .soide-alert-box { padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; display: none; align-items: center; gap: 6px; line-height: 1.3; }
        .soide-alert-box.has-errors { display: flex; background: #fef2f2; border: 1.2px solid #fecaca; color: #dc2626; }
        .soide-alert-box.is-valid { display: flex; background: #f0fdf4; border: 1.2px solid #bbf7d0; color: #16a34a; }

        .soide-editor-qcard { border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; box-shadow: 0 2px 7px rgba(0, 0, 0, 0.04); transition: all 0.15s ease; position: relative; }
        .soide-editor-qcard:focus-within { box-shadow: 0 0 0 2.5px rgba(2, 132, 199, 0.3) !important; }
        .soide-editor-qcard.is-synced-active { box-shadow: 0 0 0 3px #10b981, 0 6px 18px rgba(16, 185, 129, 0.28) !important; transform: scale(1.008); border-color: #10b981 !important; }

        .soide-paste-zones-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 5px; }
        .soide-paste-box { border: 1.5px dashed #94a3b8; background: rgba(255, 255, 255, 0.65); border-radius: 7px; padding: 5px 8px; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #475569; cursor: pointer; user-select: none; transition: all 0.18s ease; outline: none; line-height: 1.3; }
        .soide-paste-box:hover { opacity: 1; background: #ffffff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); }
        .soide-paste-box.zone-overwrite:hover, .soide-paste-box.zone-overwrite:focus { border-color: #0284c7; color: #0369a1; background: #e0f2fe; box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25); }
        .soide-paste-box.zone-insert:hover, .soide-paste-box.zone-insert:focus { border-color: #10b981; color: #047857; background: #dcfce7; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25); }

        .soide-card-raw-box { background: #0f172a; border-radius: 9px; padding: 8px; display: flex; flex-direction: column; gap: 6px; border: 1.5px solid #38bdf8; margin-top: 4px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5); }
        .soide-card-raw-header { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 800; color: #38bdf8; }
        .soide-card-raw-textarea { width: 100%; min-height: 110px; padding: 7px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13.5px !important; font-weight: 600; line-height: 1.4; color: #f8fafc; background: #1e293b; border: 1px solid #475569; border-radius: 7px; outline: none; box-sizing: border-box; resize: vertical; }
        .soide-card-raw-textarea:focus { border-color: #38bdf8; }
        .soide-card-raw-btn-row { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

        .soide-qcard-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
        .soide-qcard-num { font-weight: 900; font-size: 13.5px; display: flex; align-items: center; gap: 5px; }
        .soide-head-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .btn-soide-mini { padding: 3px 7px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; border: none; transition: 0.15s; user-select: none; line-height: 1.2; font-family: inherit; }
        .btn-soide-mini:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .btn-soide-mini:active { transform: translateY(1px) scale(0.96); }
        .btn-soide-raw-toggle { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
        .btn-soide-raw-toggle:hover { background: #0284c7; color: #fff; border-color: #0284c7; }
        .btn-soide-add-inline { background: #e0f2fe; color: #0284c7; border: 1px solid #7dd3fc; }
        .btn-soide-del-inline { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
        .soide-part-select-mini { padding: 2px 5px; border-radius: 6px; font-size: 11px; font-weight: 900; background: #ffffff; color: #1e293b; border: 1.2px solid #cbd5e1; outline: none; cursor: pointer; height: 24px; }
        .soide-textarea-label { font-size: 11.5px; font-weight: 800; color: #475569; margin-bottom: 2px; display: flex; justify-content: space-between; line-height: 1.25; }
        .soide-latex-input { width: 100%; padding: 6px 9px; border: 1.5px solid #cbd5e1; border-radius: 7px; font-family: 'Consolas', 'Courier New', monospace; font-size: 15px !important; font-weight: 600; line-height: 1.45; outline: none; box-sizing: border-box; resize: vertical; color: #0f172a; background: #ffffff; field-sizing: content; min-height: 38px; overflow-y: hidden; transition: border-color 0.15s, background-color 0.15s; }
        .soide-latex-input:focus { border-color: #0284c7; background: #f8fafc; }
        .soide-options-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .soide-tf-editor-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .soide-tf-editor-table td { padding: 3px 4px; border: 1px solid #e2e8f0; vertical-align: middle; }

        .options-list.opt-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr) !important; gap: 8px; }
        .options-list.opt-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr) !important; gap: 7px; }
        .options-list.opt-grid-1 { display: grid; grid-template-columns: 1fr !important; gap: 5px; }

        .soide-preview-card { border-radius: 14px; padding: 10px 14px; margin-bottom: 11px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); position: relative; transition: all 0.25s ease; }
        .soide-preview-card.is-synced-active { box-shadow: 0 0 0 3px #0284c7, 0 6px 18px rgba(2, 132, 199, 0.28) !important; transform: scale(1.008); }
        .soide-preview-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed rgba(100, 116, 139, 0.25); }
        .soide-preview-title-badge { font-size: 13.5px; font-weight: 900; line-height: 1.3; }
        .soide-raw-textarea { width: 100%; flex: 1; min-height: 480px; padding: 12px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13.5px; line-height: 1.5; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; background: #0f172a; color: #f8fafc; box-sizing: border-box; }

        /* CSS PREVIEW DỰ PHÒNG KHI MỞ TRÊN index.html (NƠI KHÔNG NẠP thi-exam.css) */
        .soide-preview-card .q-content-text, .qb-edit-left-pane .q-content-text { font-size: 1.02rem; line-height: 1.45; color: #0f172a; font-weight: 600; white-space: pre-line; word-break: break-word; }
        .soide-preview-card .opt-label, .qb-edit-left-pane .opt-label { display: flex; align-items: center; gap: 8px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; }
        .soide-preview-card .opt-label.selected, .qb-edit-left-pane .opt-label.selected { border-color: #0d9488; background: #f0fdfa; }
        .soide-preview-card .opt-circle, .qb-edit-left-pane .opt-circle { border-radius: 50%; background: #f1f5f9; color: #334155; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1.5px solid #cbd5e1; }
        .soide-preview-card .opt-label.selected .opt-circle, .qb-edit-left-pane .opt-label.selected .opt-circle { background: #0d9488; color: #fff; border-color: #0d9488; }
        .soide-preview-card .opt-text, .qb-edit-left-pane .opt-text { font-size: 0.95rem; color: #1e293b; font-weight: 600; word-break: break-word; flex: 1; }
        .soide-preview-card .tf-table-box, .qb-edit-left-pane .tf-table-box { overflow-x: auto; border: 1.5px solid #cbd5e1; border-radius: 10px; }
        .soide-preview-card .tf-table, .qb-edit-left-pane .tf-table { width: 100%; border-collapse: collapse; background: #fff; }
        .soide-preview-card .tf-table th, .qb-edit-left-pane .tf-table th { background: #f8fafc; padding: 6px 8px; font-size: 11.5px; border-bottom: 1.5px solid #cbd5e1; text-align: left; }
        .soide-preview-card .tf-table td, .qb-edit-left-pane .tf-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; }
        .soide-preview-card .explanation-box, .qb-edit-left-pane .explanation-box { background: #fefce8; border-left: 4px solid #eab308; border-radius: 8px; color: #713f12; line-height: 1.45; font-weight: 600; }
        .soide-preview-card .quiz-img-container, .qb-edit-left-pane .quiz-img-container { text-align: center; margin: 6px 0; }
        .soide-preview-card .quiz-img, .qb-edit-left-pane .quiz-img { max-width: 100%; object-fit: contain; border-radius: 10px; border: 1.5px solid #cbd5e1; background: #fff; }
        .soide-preview-card .admin-img-uploader-zone, .qb-edit-left-pane .admin-img-uploader-zone { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; border: 1.5px dashed #c084fc; }
        .soide-preview-card .admin-uploader-btn-group, .qb-edit-left-pane .admin-uploader-btn-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .soide-preview-card .btn-admin-paste-img, .qb-edit-left-pane .btn-admin-paste-img { background: linear-gradient(135deg, #a855f7, #9333ea); color: #fff; border: none; border-radius: 7px; font-weight: 800; cursor: pointer; padding: 4px 10px; font-size: 11.5px; }
        .soide-preview-card .btn-admin-file-img, .qb-edit-left-pane .btn-admin-file-img { background: #fff; color: #7e22ce; border: 1.5px solid #d8b4fe; border-radius: 7px; font-weight: 800; cursor: pointer; padding: 4px 10px; font-size: 11.5px; }
        .soide-preview-card .btn-admin-del-img, .qb-edit-left-pane .btn-admin-del-img { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none; border-radius: 7px; font-weight: 800; cursor: pointer; padding: 4px 10px; font-size: 11.5px; }
        .soide-preview-card .admin-uploader-status, .qb-edit-left-pane .admin-uploader-status { font-size: 11.5px; font-weight: 800; }
    `;
    document.head.appendChild(style);
}

function ensureSoiDeModalInDOM() {
    injectSoiDeStyles();
    if (document.getElementById("modal-soi-de")) return document.getElementById("modal-soi-de");
    if (!document.body) return null;

    const modalDiv = document.createElement("div");
    modalDiv.className = "soide-modal-overlay";
    modalDiv.id = "modal-soi-de";
    modalDiv.innerHTML = `
        <div class="soide-modal-card" onclick="event.stopPropagation()">
            <div class="soide-header">
                <div class="soide-header-left">
                    <span style="font-size: 18px;">🔬</span>
                    <div>
                        <div class="soide-header-title">CÔNG CỤ SOI ĐỀ THI & BIÊN SOẠN THỜI GIAN THỰC (REALTIME)</div>
                        <div style="font-size: 11px; color: #94a3b8;" id="soide-exam-subtext">Đề thi: Đang nạp...</div>
                    </div>
                </div>
                <div class="soide-header-tools">
                    <button type="button" class="btn-soide-tool btn-soide-update" id="btn-soide-update-exam" onclick="updateExamFromSoiDe()" title="Cập nhật trực tiếp toàn bộ thay đổi">
                        ⚡ Update
                    </button>

                    <button type="button" class="btn-soide-tool btn-soide-upload-class" id="btn-soide-class-picker" onclick="toggleSoiDeClassDropdown(event)">
                        🚀 Tải đề lên lớp ▾
                    </button>

                    <div class="soide-class-dropdown" id="soide-class-dropdown" onclick="event.stopPropagation()">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:5px;">
                            <b style="font-size:12px; color:#0284c7;">🎯 Chọn lớp đăng đề:</b>
                            <div style="display:flex; gap:4px;">
                                <button type="button" class="btn-soide-mini" onclick="toggleAllSoiDeClasses(true)">Tất cả</button>
                                <button type="button" class="btn-soide-mini" onclick="toggleAllSoiDeClasses(false)">Bỏ</button>
                            </div>
                        </div>
                        <div class="soide-class-list-grid" id="soide-class-list-container">
                            ${SOI_DE_AVAILABLE_CLASSES.map(c => `
                                <label class="soide-class-chk-item" id="chk-label-${c.id}">
                                    <input type="checkbox" name="soide-target-class" value="${c.id}" onchange="handleSoiDeClassCheckChange(this)">
                                    <span>${c.name}</span>
                                </label>
                            `).join("")}
                        </div>
                        <button type="button" class="btn-soide-tool btn-soide-upload-class" id="btn-submit-upload-classes" onclick="submitExamToSelectedClasses()" style="width:100%; justify-content:center; padding:7px;">
                            🚀 Xác nhận đăng đề
                        </button>
                    </div>

                    <button type="button" class="btn-soide-tool btn-soide-upload" onclick="triggerSoiDeUpload()">📂 Upload Đề</button>
                    <input type="file" id="soide-file-input" accept=".json,.js,.txt" style="display:none;" onchange="handleSoiDeFileSelected(this)">
                    <button type="button" class="btn-soide-tool btn-soide-add" onclick="addNewQuestionToSoiDe()">➕ Thêm câu mới</button>
                    <button type="button" class="btn-soide-tool btn-soide-download" onclick="downloadSoiDeJson()">💾 Tải JSON đề</button>
                    <button type="button" class="btn-soide-tool btn-soide-switch active" id="btn-mode-cards" onclick="setSoiDeEditorMode('cards')">📑 Khối từng câu</button>
                    <button type="button" class="btn-soide-tool btn-soide-switch" id="btn-mode-raw" onclick="setSoiDeEditorMode('raw')">💻 Mã nguồn thô</button>
                    <button type="button" class="btn-soide-tool btn-soide-close" onclick="closeSoiDeModal()" title="Đóng cửa sổ">✕</button>
                </div>
            </div>

            <div class="soide-split-body" id="soide-split-body">
                <div class="soide-left-pane" id="soide-left-pane" style="width: 50%;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 5px;">
                        <span style="font-size: 13px; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                            👁️ HÌNH ẢNH ĐỀ THI THỰC TẾ (<span id="soide-live-qcount" style="color:#0284c7;">0</span> câu)
                        </span>
                        <div id="soide-alert-box" class="soide-alert-box is-valid">✅ Cú pháp &amp; công thức hợp lệ</div>
                    </div>
                    <div id="soide-live-preview-content"></div>
                </div>

                <div class="soide-resizer" id="soide-resizer" title="Giữ chuột và kéo sang trái/phải để chỉnh độ rộng"></div>

                <div class="soide-right-pane" id="soide-right-pane" style="width: 50%;">
                    <div class="soide-drop-zone" id="soide-drop-zone">
                        <div class="soide-drop-text">
                            <span>📥</span> <span>Kéo thả file <b>.json / .js / .txt</b> vào đây hoặc bấm nút <b>Upload Đề</b> ở góc trên!</span>
                        </div>
                        <button type="button" class="btn-soide-tool btn-soide-upload" style="padding: 3px 8px; font-size: 11px;" onclick="triggerSoiDeUpload()">📁 Chọn file</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 9px;">
                        <div><div class="soide-textarea-label">Tên đề thi:</div><input type="text" id="soide-meta-title" class="soide-latex-input" style="font-size:13.5px !important; padding: 4px 6px; min-height:30px;" oninput="updateSoiDeMeta()"></div>
                        <div><div class="soide-textarea-label">Mã đề:</div><input type="text" id="soide-meta-made" class="soide-latex-input" style="font-size:13.5px !important; padding: 4px 6px; min-height:30px;" oninput="updateSoiDeMeta()"></div>
                        <div><div class="soide-textarea-label">Số phút:</div><input type="number" id="soide-meta-minutes" class="soide-latex-input" style="font-size:13.5px !important; padding: 4px 6px; min-height:30px;" oninput="updateSoiDeMeta()"></div>
                    </div>

                    <div id="soide-cards-container" style="display: flex; flex-direction: column; gap: 7px;"></div>
                    <div id="soide-raw-container" style="display: none; flex: 1; flex-direction: column;">
                        <textarea id="soide-raw-editor" class="soide-raw-textarea" spellcheck="false" oninput="handleSoiDeRawInput(this.value)"></textarea>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    setupSoiDeDragAndResize();
    setupDualScrollSync();

    document.addEventListener("click", function(e) {
        const drop = document.getElementById("soide-class-dropdown");
        const btn = document.getElementById("btn-soide-class-picker");
        if (drop && drop.classList.contains("show")) {
            if (!drop.contains(e.target) && e.target !== btn) drop.classList.remove("show");
        }
    });

    window.addEventListener("keydown", function(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
            const modal = document.getElementById("modal-soi-de");
            if (modal && modal.style.display === "flex") {
                e.preventDefault();
                if (typeof updateExamFromSoiDe === "function") updateExamFromSoiDe();
            }
        }
    });

    return modalDiv;
}

function checkAndDisplayAdminSoiDeButton() {
    const btn = document.getElementById("btn-admin-switch-soide");
    if (!btn) return;
    btn.style.display = checkIsAdminModeSafe() ? "inline-flex" : "none";
}

async function switchToSoiDeFromExam() {
    if (typeof examData === "undefined" || !examData) {
        alert("⚠️ Không tìm thấy dữ liệu đề thi hiện tại!");
        return;
    }

    ensureSoiDeModalInDOM();
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get("id") || examData.id || "quiz";
    const currentMade = (typeof getMaDe === "function" ? getMaDe() : examData.made) || "101";

    let dbQuestions = null;
    let dbImages = {};
    try {
        const client = (typeof getSupabaseClient === "function") ? getSupabaseClient() : supabaseClient;
        if (client && quizId) {
            const { data } = await client.from("quizzes").select("questions, images").eq("id", quizId).single();
            if (data) {
                if (Array.isArray(data.questions)) dbQuestions = data.questions;
                if (data.images && typeof data.images === "object") dbImages = data.images;
            }
        }
    } catch (e) {}

    const sourceImages = { ...(examData.images || {}), ...dbImages };
    let sourceQuestions = [];
    if (dbQuestions && dbQuestions.length > 0) {
        sourceQuestions = dbQuestions;
    } else if (window.ORIGINAL_EXAM_DATA && window.ORIGINAL_EXAM_DATA.questions) {
        sourceQuestions = JSON.parse(JSON.stringify(window.ORIGINAL_EXAM_DATA.questions));
    } else if (examData.questions && examData.questions.length > 0) {
        sourceQuestions = [...examData.questions].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
    }

    const clonedQuestions = sourceQuestions.map(q => {
        const item = JSON.parse(JSON.stringify(q));
        const dbQ = dbQuestions ? dbQuestions.find(dq => String(dq.id) === String(q.id)) : null;
        const vaultAnswers = (window.SECURE_VAULT && window.SECURE_VAULT.answers) ? window.SECURE_VAULT.answers : {};
        const extracted = extractQuestionAnswersRobustly(dbQ || q, vaultAnswers);

        if (item.type === "multiple_choice" && !isPart4Question(item)) item.correct = extracted.correct;
        else if (item.type === "true_false" && !isPart4Question(item)) {
            if (Array.isArray(item.statements)) {
                item.statements.forEach(st => {
                    if (extracted.statementsCorrect[st.id] !== undefined) st.correct = extracted.statementsCorrect[st.id];
                });
            }
        } else {
            item.correctAnswer = extracted.correctAnswer;
        }
        if (extracted.explanation) item.explanation = extracted.explanation;

        const directUrl = soideResolveImgUrl(item, sourceImages);
        if (directUrl) {
            item.imageUrl = directUrl;
            item.imageKey = item.imageKey || `img_q_${item.id}`;
            sourceImages[item.imageKey] = directUrl;
        }
        return item;
    });

    soiDeState.examData = {
        id: quizId,
        title: examData.title || (typeof EXAM_NAME !== "undefined" ? EXAM_NAME : "ĐỀ THI"),
        maDe: currentMade,
        timeLimitMinutes: parseInt(examData.timeLimitMinutes || examData.time_limit_minutes, 10) || 90,
        images: sourceImages,
        questions: reorganizeAllQuestionsByParts(clonedQuestions),
        scoringConfig: examData.scoringConfig || { mode: "option1" }
    };
    soiDeState.isFromExamRoom = true;
    soiDeState.isFromQBank = false;

    openSoiDeModal();
    showSoiDeToast(`🔬 Đã nạp ${soiDeState.examData.questions.length} câu (KHÔI PHỤC ĐÚNG THỨ TỰ) kèm Đ.Á & ẢNH vào Soi đề!`);
}

function openSoiDeModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    let modal = document.getElementById("modal-soi-de");
    if (!modal) modal = ensureSoiDeModalInDOM();
    if (!modal) return;
    modal.style.display = "flex";

    if (!soiDeState.examData || !Array.isArray(soiDeState.examData.questions) || soiDeState.examData.questions.length === 0) {
        if (typeof initDefaultSoiDeExam === "function") initDefaultSoiDeExam();
    } else {
        if (typeof renderSoiDeBothSides === "function") renderSoiDeBothSides();
    }

    setTimeout(() => {
        autoResizeAllTextareas();
        setupDualScrollSync();
    }, 50);
}

function closeSoiDeModal() {
    const modal = document.getElementById("modal-soi-de");
    if (modal) modal.style.display = "none";
}

function setupSoiDeDragAndResize() {
    const resizer = document.getElementById("soide-resizer");
    const container = document.getElementById("soide-split-body");
    const leftPane = document.getElementById("soide-left-pane");
    const rightPane = document.getElementById("soide-right-pane");
    const dropZone = document.getElementById("soide-drop-zone");
    if (!resizer || !container || !leftPane || !rightPane) return;

    let isDragging = false;
    resizer.addEventListener("mousedown", (e) => { e.preventDefault(); isDragging = true; resizer.classList.add("is-dragging"); });
    window.addEventListener("mousemove", (e) => {
        if (!isDragging || !container) return;
        const rect = container.getBoundingClientRect();
        let percent = Math.min(Math.max(15, ((e.clientX - rect.left) / rect.width) * 100), 85);
        soiDeState.splitRatio = percent;
        leftPane.style.width = `${percent}%`;
        rightPane.style.width = `${100 - percent}%`;
    });
    window.addEventListener("mouseup", () => {
        if (isDragging) { isDragging = false; resizer.classList.remove("is-dragging"); autoResizeAllTextareas(); }
    });

    if (dropZone) {
        dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
        dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("dragover"); });
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault(); dropZone.classList.remove("dragover");
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0 && typeof readAndParseSoiDeFile === "function") {
                readAndParseSoiDeFile(e.dataTransfer.files[0]);
            }
        });
    }
    if (rightPane) {
        rightPane.addEventListener("dragover", (e) => e.preventDefault());
        rightPane.addEventListener("drop", (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0 && typeof readAndParseSoiDeFile === "function") {
                readAndParseSoiDeFile(e.dataTransfer.files[0]);
            }
        });
    }
}

function setupDualScrollSync() {
    const rightPane = document.getElementById("soide-right-pane");
    const leftPane = document.getElementById("soide-left-pane");
    if (!rightPane || !leftPane || rightPane.dataset.hasScrollSync === "true") return;
    rightPane.dataset.hasScrollSync = "true";

    const setLeftActive = () => { activeScrollPane = "left"; };
    const setRightActive = () => { activeScrollPane = "right"; };
    leftPane.addEventListener("mouseenter", setLeftActive);
    leftPane.addEventListener("touchstart", setLeftActive, { passive: true });
    rightPane.addEventListener("mouseenter", setRightActive);
    rightPane.addEventListener("touchstart", setRightActive, { passive: true });

    let syncRightTimer = null;
    rightPane.addEventListener("scroll", () => {
        if (activeScrollPane !== "right" || soiDeState.editorMode !== "cards") return;
        if (syncRightTimer) cancelAnimationFrame(syncRightTimer);
        syncRightTimer = requestAnimationFrame(syncLeftPreviewFromRightScroll);
    }, { passive: true });

    let syncLeftTimer = null;
    leftPane.addEventListener("scroll", () => {
        if (activeScrollPane !== "left" || soiDeState.editorMode !== "cards") return;
        if (syncLeftTimer) cancelAnimationFrame(syncLeftTimer);
        syncLeftTimer = requestAnimationFrame(syncRightEditorFromLeftScroll);
    }, { passive: true });
}

function syncLeftPreviewFromRightScroll() {
    const rightPane = document.getElementById("soide-right-pane");
    const leftPane = document.getElementById("soide-left-pane");
    if (!rightPane || !leftPane) return;
    const rightPaneRect = rightPane.getBoundingClientRect();
    const rightCards = rightPane.querySelectorAll(".soide-editor-qcard");
    if (!rightCards || rightCards.length === 0) return;

    let targetCard = null, minDistance = Infinity;
    const probeY = rightPaneRect.top + 75;
    for (const card of rightCards) {
        const rect = card.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) { targetCard = card; break; }
        const dist = Math.abs(rect.top - probeY);
        if (dist < minDistance) { minDistance = dist; targetCard = card; }
    }
    if (targetCard) {
        const qId = targetCard.dataset.qid || targetCard.id.replace("soide-qcard-", "");
        if (qId && String(qId) !== String(lastSyncedQId_RightToLeft)) {
            lastSyncedQId_RightToLeft = String(qId);
            scrollToLeftPreviewQuestion(qId, false);
        }
    }
}

function syncRightEditorFromLeftScroll() {
    const leftPane = document.getElementById("soide-left-pane");
    const rightPane = document.getElementById("soide-right-pane");
    if (!leftPane || !rightPane) return;
    const leftPaneRect = leftPane.getBoundingClientRect();
    const leftCards = leftPane.querySelectorAll(".soide-preview-card");
    if (!leftCards || leftCards.length === 0) return;

    let targetCard = null, minDistance = Infinity;
    const probeY = leftPaneRect.top + 75;
    for (const card of leftCards) {
        const rect = card.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) { targetCard = card; break; }
        const dist = Math.abs(rect.top - probeY);
        if (dist < minDistance) { minDistance = dist; targetCard = card; }
    }
    if (targetCard) {
        const qId = targetCard.dataset.qid;
        if (qId && String(qId) !== String(lastSyncedQId_LeftToRight)) {
            lastSyncedQId_LeftToRight = String(qId);
            scrollToRightEditorQuestion(qId, false);
        }
    }
}

function scrollToLeftPreviewQuestion(qId, triggerSmooth = true) {
    const leftPane = document.getElementById("soide-left-pane");
    const leftCard = document.getElementById(`soide-preview-card-${qId}`);
    if (!leftPane || !leftCard) return;
    const targetScrollTop = leftPane.scrollTop + (leftCard.getBoundingClientRect().top - leftPane.getBoundingClientRect().top) - 12;
    leftPane.scrollTo({ top: Math.max(0, targetScrollTop), behavior: triggerSmooth ? "smooth" : "auto" });
    document.querySelectorAll(".soide-preview-card.is-synced-active").forEach(c => c.classList.remove("is-synced-active"));
    leftCard.classList.add("is-synced-active");
    lastSyncedQId_LeftToRight = String(qId);
}

function scrollToRightEditorQuestion(qId, triggerSmooth = true) {
    const rightPane = document.getElementById("soide-right-pane");
    const rightCard = document.getElementById(`soide-qcard-${qId}`);
    if (!rightPane || !rightCard) return;
    const targetScrollTop = rightPane.scrollTop + (rightCard.getBoundingClientRect().top - rightPane.getBoundingClientRect().top) - 12;
    rightPane.scrollTo({ top: Math.max(0, targetScrollTop), behavior: triggerSmooth ? "smooth" : "auto" });
    document.querySelectorAll(".soide-editor-qcard.is-synced-active").forEach(c => c.classList.remove("is-synced-active"));
    rightCard.classList.add("is-synced-active");
    lastSyncedQId_RightToLeft = String(qId);
}

function showSoiDeToast(msg) {
    let toast = document.getElementById("soide-mini-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "soide-mini-toast";
        toast.style.cssText = `
            position: absolute; top: 48px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #059669, #047857); color: #fff;
            padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 12px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.3); z-index: 99999;
            transition: all 0.22s ease; opacity: 0; pointer-events: none;
        `;
        const card = document.querySelector(".soide-modal-card");
        if (card) card.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(4px)";
    setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(0)"; }, 2800);
}

document.addEventListener("DOMContentLoaded", function() {
    ensureSoiDeModalInDOM();
    checkAndDisplayAdminSoiDeButton();
    setTimeout(checkAndDisplayAdminSoiDeButton, 1000);
});

// Xuất ra window scope
window.soiDeState = soiDeState;
window.SOI_DE_AVAILABLE_CLASSES = SOI_DE_AVAILABLE_CLASSES;
window.SOI_DE_THEME_PALETTES = SOI_DE_THEME_PALETTES;
window.safeSoiDeJsArg = safeSoiDeJsArg;
window.checkIsAdminModeSafe = checkIsAdminModeSafe;
window.isPart4Question = isPart4Question;
window.getQuestionPartType = getQuestionPartType;
window.reorganizeAllQuestionsByParts = reorganizeAllQuestionsByParts;
window.insertQuestionsOrganizedByPart = insertQuestionsOrganizedByPart;
window.formatQuestionText = formatQuestionText;
window.soideResolveImgUrl = soideResolveImgUrl;
window.soideHandleImgError = soideHandleImgError;
window.autoResizeTextarea = autoResizeTextarea;
window.autoResizeAllTextareas = autoResizeAllTextareas;
window.extractQuestionAnswersRobustly = extractQuestionAnswersRobustly;
window.robustParseExamScriptOrJson = robustParseExamScriptOrJson;
window.parseSmartSingleQuestion = parseSmartSingleQuestion;
window.parseSmartQuestionOrQuestions = parseSmartQuestionOrQuestions;
window.ensureSoiDeModalInDOM = ensureSoiDeModalInDOM;
window.checkAndDisplayAdminSoiDeButton = checkAndDisplayAdminSoiDeButton;
window.switchToSoiDeFromExam = switchToSoiDeFromExam;
window.openSoiDeModal = openSoiDeModal;
window.closeSoiDeModal = closeSoiDeModal;
window.setupDualScrollSync = setupDualScrollSync;
window.scrollToLeftPreviewQuestion = scrollToLeftPreviewQuestion;
window.scrollToRightEditorQuestion = scrollToRightEditorQuestion;
window.showSoiDeToast = showSoiDeToast;