// =========================================================
// FILE: portal-soi-de.js
// CÔNG CỤ SOI ĐỀ, BIÊN TẬP VÀ XEM TRƯỚC THỜI GIAN THỰC (REALTIME)
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
    editorMode: "cards", // 'cards' hoặc 'raw'
    splitRatio: 50,      // % độ rộng nửa trái
    isDraggingSplit: false,
    debounceTimer: null,
    validationErrors: []
};

// 1. TIÊM TOÀN BỘ GIAO DIỆN VÀ CSS ĐẶC QUYỀN CỦA MODAL SOI ĐỀ
(function injectSoiDeStylesAndModal() {
    const styleId = "soi-de-modal-custom-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        /* MODAL OVERLAY 98% */
        .soide-modal-overlay {
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.82);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            z-index: 9999999; display: none; align-items: center; justify-content: center;
            padding: 1vh 1vw; box-sizing: border-box; font-family: 'Be Vietnam Pro', 'Inter', sans-serif;
            animation: fadeInSoiDe 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeInSoiDe { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }

        .soide-modal-card {
            width: 98vw !important; height: 98vh !important;
            max-width: 98vw !important; max-height: 98vh !important;
            background: #ffffff; border-radius: 18px; border: 1.5px solid #cbd5e1;
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.45);
            display: flex; flex-direction: column; overflow: hidden; position: relative;
        }

        /* HEADER */
        .soide-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 16px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff; border-bottom: 2px solid #10b981; flex-shrink: 0; gap: 10px;
        }
        .soide-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .soide-header-title { font-size: 15px; font-weight: 900; color: #34d399; display: flex; align-items: center; gap: 6px; }
        .soide-header-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

        .btn-soide-tool {
            padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 800;
            border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
            transition: all 0.15s ease; user-select: none;
        }
        .btn-soide-tool:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .btn-soide-tool:active { transform: translateY(2px) scale(0.96); }

        .btn-soide-upload { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35); }
        .btn-soide-download { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; }
        .btn-soide-add { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; }
        .btn-soide-switch { background: #334155; color: #cbd5e1; border: 1px solid #475569; }
        .btn-soide-switch.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
        .btn-soide-close { background: #334155; color: #f87171; border-radius: 50%; width: 28px; height: 28px; padding: 0; justify-content: center; font-size: 14px; font-weight: 900; }
        .btn-soide-close:hover { background: #ef4444; color: #ffffff; }

        /* BODY CHIA ĐÔI */
        .soide-split-body {
            flex: 1; display: flex; width: 100%; height: calc(100% - 50px);
            overflow: hidden; position: relative; user-select: none;
        }

        /* NỬA TRÁI: LIVE PREVIEW */
        .soide-left-pane {
            height: 100%; overflow-y: auto; overflow-x: hidden;
            background: #f8fafc; padding: 14px; box-sizing: border-box;
            border-right: 1px solid #cbd5e1; user-select: text;
        }

        /* VẠCH CHIA KÉO ĐỘ RỘNG */
        .soide-resizer {
            width: 8px; height: 100%; background: #e2e8f0; cursor: col-resize;
            flex-shrink: 0; position: relative; transition: background 0.15s;
            display: flex; align-items: center; justify-content: center; z-index: 10;
        }
        .soide-resizer::after {
            content: "⋮"; font-weight: 900; color: #64748b; font-size: 16px; line-height: 1;
        }
        .soide-resizer:hover, .soide-resizer.is-dragging { background: #10b981; }
        .soide-resizer:hover::after, .soide-resizer.is-dragging::after { color: #ffffff; }

        /* NỬA PHẢI: LATEX EDITOR */
        .soide-right-pane {
            height: 100%; overflow-y: auto; overflow-x: hidden;
            background: #ffffff; padding: 14px; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 10px; user-select: text;
        }

        /* KHU VỰC KÉO THẢ TỆP */
        .soide-drop-zone {
            border: 2px dashed #10b981; border-radius: 12px; padding: 12px 16px;
            background: #f0fdf4; display: flex; align-items: center; justify-content: space-between;
            gap: 10px; flex-wrap: wrap; transition: all 0.2s ease;
        }
        .soide-drop-zone.dragover {
            background: #dcfce7; border-color: #059669; transform: scale(1.01);
            box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
        }
        .soide-drop-text { font-size: 12.5px; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 6px; }

        /* CẢNH BÁO LỖI */
        .soide-alert-box {
            padding: 8px 12px; border-radius: 9px; font-size: 12px; font-weight: 700;
            display: none; align-items: center; gap: 8px; line-height: 1.4;
        }
        .soide-alert-box.has-errors {
            display: flex; background: #fef2f2; border: 1.5px solid #fecaca; color: #dc2626;
        }
        .soide-alert-box.is-valid {
            display: flex; background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a;
        }

        /* KHỐI BIÊN TẬP TỪNG CÂU (EDITOR CARDS) */
        .soide-editor-qcard {
            background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px;
            padding: 12px; display: flex; flex-direction: column; gap: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04); transition: border-color 0.15s ease;
        }
        .soide-editor-qcard:focus-within { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
        .soide-qcard-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .soide-qcard-num { font-weight: 900; font-size: 13px; color: #0284c7; display: flex; align-items: center; gap: 6px; }
        .soide-qcard-type { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; outline: none; }
        
        .soide-textarea-label { font-size: 11px; font-weight: 800; color: #334155; margin-bottom: 2px; display: flex; justify-content: space-between; }
        .soide-latex-input {
            width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 8px;
            font-family: 'Consolas', 'Courier New', monospace; font-size: 12.5px; line-height: 1.45;
            outline: none; box-sizing: border-box; resize: vertical; color: #0f172a; background: #ffffff;
        }
        .soide-latex-input:focus { border-color: #0284c7; background: #f8fafc; }

        .soide-options-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .soide-tf-editor-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .soide-tf-editor-table td { padding: 4px 6px; border: 1px solid #e2e8f0; }

        /* NÚT XÓA CÂU TẠI GÓC TRÊN BÊN PHẢI MỖI CÂU Ở NỬA TRÁI */
        .btn-soide-del-q-preview {
            position: absolute; top: 10px; right: 10px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: #ffffff !important; border: 1px solid #f87171;
            border-radius: 8px; padding: 4px 9px; font-size: 11px; font-weight: 900;
            cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35); transition: all 0.15s ease;
            z-index: 5; user-select: none;
        }
        .btn-soide-del-q-preview:hover { transform: scale(1.08); filter: brightness(1.15); }
        .btn-soide-del-q-preview:active { transform: translateY(2px) scale(0.95); }

        /* RAW CODE TEXTAREA */
        .soide-raw-textarea {
            width: 100%; flex: 1; min-height: 480px; padding: 12px;
            font-family: 'Consolas', 'Courier New', monospace; font-size: 12.5px;
            line-height: 1.5; border: 1.5px solid #cbd5e1; border-radius: 10px;
            outline: none; background: #0f172a; color: #f8fafc; box-sizing: border-box;
        }
    `;
    document.head.appendChild(style);

    const modalDiv = document.createElement("div");
    modalDiv.className = "soide-modal-overlay";
    modalDiv.id = "modal-soi-de";
    modalDiv.innerHTML = `
        <div class="soide-modal-card" onclick="event.stopPropagation()">
            <!-- HEADER -->
            <div class="soide-header">
                <div class="soide-header-left">
                    <span style="font-size: 20px;">🔬</span>
                    <div>
                        <div class="soide-header-title">CÔNG CỤ SOI ĐỀ THI & BIÊN SOẠN THỜI GIAN THỰC (REALTIME)</div>
                        <div style="font-size: 11px; color: #94a3b8;" id="soide-exam-subtext">Đề thi: Đang tải...</div>
                    </div>
                </div>
                <div class="soide-header-tools">
                    <button type="button" class="btn-soide-tool btn-soide-upload" onclick="triggerSoiDeUpload()">
                        📂 Upload Đề JSON/JS
                    </button>
                    <input type="file" id="soide-file-input" accept=".json,.js,.txt" style="display:none;" onchange="handleSoiDeFileSelected(this)">
                    
                    <button type="button" class="btn-soide-tool btn-soide-add" onclick="addNewQuestionToSoiDe()">
                        ➕ Thêm câu
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-download" onclick="downloadSoiDeJson()">
                        💾 Tải JSON đề
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-switch active" id="btn-mode-cards" onclick="setSoiDeEditorMode('cards')">
                        📑 Khối từng câu
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-switch" id="btn-mode-raw" onclick="setSoiDeEditorMode('raw')">
                        💻 Mã nguồn thô
                    </button>
                    <button type="button" class="btn-soide-tool btn-soide-close" onclick="closeSoiDeModal()" title="Đóng cửa sổ">✕</button>
                </div>
            </div>

            <!-- BODY SPLIT -->
            <div class="soide-split-body" id="soide-split-body">
                <!-- NỬA TRÁI: LIVE RENDER -->
                <div class="soide-left-pane" id="soide-left-pane" style="width: 50%;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 6px;">
                        <span style="font-size: 13.5px; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                            👁️ HÌNH ẢNH ĐỀ THI THỰC TẾ (<span id="soide-live-qcount" style="color:#0284c7;">0</span> câu)
                        </span>
                        <div id="soide-alert-box" class="soide-alert-box is-valid">✅ Cú pháp & công thức hợp lệ</div>
                    </div>

                    <div id="soide-live-preview-content"></div>
                </div>

                <!-- VẠCH CHIA KÉO ĐỘ RỘNG -->
                <div class="soide-resizer" id="soide-resizer" title="Giữ chuột và kéo sang trái/phải để chỉnh độ rộng"></div>

                <!-- NỬA PHẢI: LATEX EDITOR -->
                <div class="soide-right-pane" id="soide-right-pane" style="width: 50%;">
                    <!-- VÙNG KÉO THẢ TỆP -->
                    <div class="soide-drop-zone" id="soide-drop-zone">
                        <div class="soide-drop-text">
                            <span>📥</span> <span>Kéo thả file <b>.json / .js / .txt</b> vào đây hoặc bấm nút <b>Upload Đề JSON/JS</b> ở góc trên!</span>
                        </div>
                        <button type="button" class="btn-soide-tool btn-soide-upload" style="padding: 4px 10px; font-size: 11px;" onclick="triggerSoiDeUpload()">
                            📁 Chọn file
                        </button>
                    </div>

                    <!-- THÔNG TIN CHUNG ĐỀ THI -->
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 10px;">
                        <div>
                            <div class="soide-textarea-label">Tên đề thi:</div>
                            <input type="text" id="soide-meta-title" class="soide-latex-input" style="padding: 5px 8px;" oninput="updateSoiDeMeta()">
                        </div>
                        <div>
                            <div class="soide-textarea-label">Mã đề:</div>
                            <input type="text" id="soide-meta-made" class="soide-latex-input" style="padding: 5px 8px;" oninput="updateSoiDeMeta()">
                        </div>
                        <div>
                            <div class="soide-textarea-label">Số phút làm bài:</div>
                            <input type="number" id="soide-meta-minutes" class="soide-latex-input" style="padding: 5px 8px;" oninput="updateSoiDeMeta()">
                        </div>
                    </div>

                    <!-- KHỐI SOẠN THẢO DẠNG CARDS -->
                    <div id="soide-cards-container" style="display: flex; flex-direction: column; gap: 10px;"></div>

                    <!-- KHỐI SOẠN THẢO DẠNG RAW CODE -->
                    <div id="soide-raw-container" style="display: none; flex: 1; flex-direction: column;">
                        <textarea id="soide-raw-editor" class="soide-raw-textarea" spellcheck="false" oninput="handleSoiDeRawInput(this.value)"></textarea>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);

    setupSoiDeDragAndResize();
})();

// 2. MỞ VÀ ĐÓNG MODAL SOI ĐỀ
function openSoiDeModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const modal = document.getElementById("modal-soi-de");
    if (!modal) return;

    modal.style.display = "flex";

    // Khởi tạo đề mẫu nếu chưa có dữ liệu
    if (!soiDeState.examData || !Array.isArray(soiDeState.examData.questions) || soiDeState.examData.questions.length === 0) {
        initDefaultSoiDeExam();
    } else {
        renderSoiDeBothSides();
    }
}

function closeSoiDeModal() {
    const modal = document.getElementById("modal-soi-de");
    if (modal) modal.style.display = "none";
}

// 3. THIẾT LẬP KÉO THẢ VẠCH CHIA ĐÔI & KÉO THẢ TỆP
function setupSoiDeDragAndResize() {
    const resizer = document.getElementById("soide-resizer");
    const container = document.getElementById("soide-split-body");
    const leftPane = document.getElementById("soide-left-pane");
    const rightPane = document.getElementById("soide-right-pane");
    const dropZone = document.getElementById("soide-drop-zone");

    // Kéo vạch chia độ rộng
    let isDragging = false;

    resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        resizer.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging || !container) return;
        const rect = container.getBoundingClientRect();
        let offsetX = e.clientX - rect.left;
        let percent = (offsetX / rect.width) * 100;
        percent = Math.min(Math.max(15, percent), 85); // Giới hạn từ 15% đến 85%
        soiDeState.splitRatio = percent;
        leftPane.style.width = `${percent}%`;
        rightPane.style.width = `${100 - percent}%`;
    });

    window.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove("is-dragging");
        }
    });

    // Kéo thả tệp JSON / JS vào khu vực drop
    if (dropZone) {
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });
        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                readAndParseSoiDeFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Cho phép kéo thả trực tiếp lên toàn bộ nửa phải
    if (rightPane) {
        rightPane.addEventListener("dragover", (e) => e.preventDefault());
        rightPane.addEventListener("drop", (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                readAndParseSoiDeFile(e.dataTransfer.files[0]);
            }
        });
    }
}

// 4. KHỞI TẠO ĐỀ MẪU BAN ĐẦU
function initDefaultSoiDeExam() {
    soiDeState.examData = {
        title: "ĐỀ KIỂM TRA ĐỊNH KỲ TOÁN 11",
        maDe: "101",
        timeLimitMinutes: 90,
        images: {},
        questions: [
            {
                id: 1,
                type: "multiple_choice",
                question: "Cho hàm số $y = f(x)$ xác định trên $\\mathbb{R}$. Tìm nghiệm của phương trình $f'(x) = 0$?",
                options: ["$x = 1$", "$x = 2$", "$x = -1$", "$x = 0$"],
                correct: 0,
                explanation: "Ta có $f'(x) = 0 \\Leftrightarrow x = 1$."
            },
            {
                id: 2,
                type: "true_false",
                question: "Xét tính đúng sai của các mệnh đề sau:",
                statements: [
                    { id: "a", statement: "Hàm số đồng biến trên khoảng $(0; +\\infty)$.", correct: true },
                    { id: "b", statement: "Hàm số có giá trị cực tiểu bằng $-2$.", correct: false }
                ],
                explanation: "Mệnh đề a đúng, mệnh đề b sai."
            },
            {
                id: 3,
                type: "short_answer",
                question: "Tính đạo hàm của hàm số $y = x^2 - 3x + 2$ tại điểm $x = 2$.",
                correctAnswer: "1",
                explanation: "$y' = 2x - 3 \\Rightarrow y'(2) = 1$."
            }
        ]
    };
    renderSoiDeBothSides();
}

// 5. UPLOAD VÀ ĐỌC FILE JSON / JS / TXT
function triggerSoiDeUpload() {
    const input = document.getElementById("soide-file-input");
    if (input) {
        input.value = "";
        input.click();
    }
}

function handleSoiDeFileSelected(input) {
    if (input.files && input.files[0]) {
        readAndParseSoiDeFile(input.files[0]);
    }
}

function readAndParseSoiDeFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            let parsed = null;
            // 1. Thử parse dạng JSON chuẩn
            try {
                parsed = JSON.parse(text);
            } catch(jsonErr) {
                // 2. Thử parse dạng file JavaScript (const examData = {...})
                let clean = text.replace(/^\s*(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/, 'return ');
                clean = clean.replace(/;?\s*$/, '');
                try {
                    parsed = new Function(clean)();
                } catch(funcErr) {
                    throw new Error("Không thể phân tích cấu trúc file! Vui lòng đảm bảo file JSON hoặc JS đúng cú pháp.");
                }
            }

            if (!parsed) throw new Error("File rỗng hoặc không có dữ liệu!");

            // Chuẩn hóa cấu trúc
            if (Array.isArray(parsed)) {
                soiDeState.examData = {
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    maDe: "101",
                    timeLimitMinutes: 90,
                    images: {},
                    questions: parsed
                };
            } else if (typeof parsed === "object") {
                soiDeState.examData = {
                    title: parsed.title || file.name.replace(/\.[^/.]+$/, ""),
                    maDe: parsed.maDe || parsed.made || "101",
                    timeLimitMinutes: parseInt(parsed.timeLimitMinutes || parsed.time_limit_minutes, 10) || 90,
                    images: parsed.images || {},
                    questions: Array.isArray(parsed.questions) ? parsed.questions : []
                };
            }

            renderSoiDeBothSides();
            alert(`✅ ĐÃ NẠP THÀNH CÔNG ĐỀ THI!\n\n- Tên đề: ${soiDeState.examData.title}\n- Tổng số câu: ${soiDeState.examData.questions.length} câu.`);
        } catch(err) {
            alert("❌ Lỗi đọc file đề thi: " + err.message);
        }
    };
    reader.readAsText(file);
}

// 6. RENDER ĐỒNG THỜI CẢ 2 NỬA (TRÁI VÀ PHẢI)
function renderSoiDeBothSides() {
    renderSoiDeRightEditor();
    renderSoiDeLeftLivePreview();
}

// 7. CẬP NHẬT THÔNG TIN METADATA (TÊN ĐỀ, MÃ ĐỀ, PHÚT)
function updateSoiDeMeta() {
    const titleIn = document.getElementById("soide-meta-title");
    const madeIn = document.getElementById("soide-meta-made");
    const minIn = document.getElementById("soide-meta-minutes");
    const subText = document.getElementById("soide-exam-subtext");

    if (titleIn) soiDeState.examData.title = titleIn.value;
    if (madeIn) soiDeState.examData.maDe = madeIn.value;
    if (minIn) soiDeState.examData.timeLimitMinutes = parseInt(minIn.value, 10) || 90;
    if (subText) subText.innerText = `Đề: ${soiDeState.examData.title} | Mã: ${soiDeState.examData.maDe} | ${soiDeState.examData.timeLimitMinutes} phút`;

    debouncedLivePreview();
}

// 8. RENDER NỬA PHẢI: TRÌNH SOẠN THẢO (DẠNG CARDS HOẶC RAW)
function renderSoiDeRightEditor() {
    const metaTitle = document.getElementById("soide-meta-title");
    const metaMade = document.getElementById("soide-meta-made");
    const metaMin = document.getElementById("soide-meta-minutes");
    const subText = document.getElementById("soide-exam-subtext");

    if (metaTitle) metaTitle.value = soiDeState.examData.title || "";
    if (metaMade) metaMade.value = soiDeState.examData.maDe || "101";
    if (metaMin) metaMin.value = soiDeState.examData.timeLimitMinutes || 90;
    if (subText) subText.innerText = `Đề: ${soiDeState.examData.title} | Mã: ${soiDeState.examData.maDe} | ${soiDeState.examData.timeLimitMinutes} phút`;

    const cardsContainer = document.getElementById("soide-cards-container");
    if (!cardsContainer) return;
    cardsContainer.innerHTML = "";

    const questions = soiDeState.examData.questions || [];

    questions.forEach((q, qIdx) => {
        const card = document.createElement("div");
        card.className = "soide-editor-qcard";
        card.id = `soide-qcard-${q.id}`;

        let specificHtml = "";
        if (q.type === "multiple_choice") {
            const letters = ["A", "B", "C", "D"];
            const currentCorrect = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").toUpperCase();

            specificHtml = `
                <div class="soide-textarea-label">Các phương án lựa chọn (A, B, C, D):</div>
                <div class="soide-options-editor-grid">
                    ${(q.options || ["", "", "", ""]).map((opt, oIdx) => `
                        <div>
                            <span style="font-weight:900; font-size:11px; color:#0284c7;">Phương án ${letters[oIdx]}:</span>
                            <input type="text" class="soide-latex-input" value="${escapeHtmlForAttr(opt)}" oninput="updateSoiDeOption(${qIdx}, ${oIdx}, this.value)">
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                    <b style="font-size:11.5px; color:#15803d;">Đáp án đúng:</b>
                    <select class="soide-latex-input" style="width:70px; padding:3px 6px;" onchange="updateSoiDeCorrectMC(${qIdx}, this.value)">
                        ${letters.map(L => `<option value="${L}" ${L === currentCorrect ? 'selected' : ''}>${L}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (q.type === "true_false") {
            specificHtml = `
                <div class="soide-textarea-label">Các mệnh đề Đúng / Sai (a, b, c, d):</div>
                <table class="soide-tf-editor-table">
                    ${(q.statements || []).map((st, sIdx) => {
                        const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                        return `
                        <tr>
                            <td width="30" align="center"><b>${st.id})</b></td>
                            <td><input type="text" class="soide-latex-input" style="padding:4px 6px;" value="${escapeHtmlForAttr(st.statement)}" oninput="updateSoiDeStatementText(${qIdx}, ${sIdx}, this.value)"></td>
                            <td width="100" align="center">
                                <select class="soide-latex-input" style="padding:3px;" onchange="updateSoiDeStatementCorrect(${qIdx}, ${sIdx}, this.value)">
                                    <option value="Đúng" ${isTrue ? 'selected' : ''}>🟢 Đúng</option>
                                    <option value="Sai" ${!isTrue ? 'selected' : ''}>🔴 Sai</option>
                                </select>
                            </td>
                        </tr>`;
                    }).join('')}
                </table>
            `;
        } else {
            specificHtml = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <b style="font-size:11.5px; color:#0d9488;">Đáp số chính xác:</b>
                    <input type="text" class="soide-latex-input" style="width:160px; padding:4px 8px;" value="${escapeHtmlForAttr(q.correctAnswer || '')}" oninput="updateSoiDeShortAnswer(${qIdx}, this.value)">
                </div>
            `;
        }

        card.innerHTML = `
            <div class="soide-qcard-head">
                <div class="soide-qcard-num">
                    <span>Câu ${qIdx + 1} (ID: ${q.id})</span>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <select class="soide-qcard-type" onchange="changeSoiDeQuestionType(${qIdx}, this.value)">
                        <option value="multiple_choice" ${q.type === 'multiple_choice' && !q.part ? 'selected' : ''}>Phần I (Trắc nghiệm)</option>
                        <option value="true_false" ${q.type === 'true_false' ? 'selected' : ''}>Phần II (Đúng/Sai)</option>
                        <option value="short_answer" ${q.type === 'short_answer' && !q.part ? 'selected' : ''}>Phần III (Trả lời ngắn)</option>
                        <option value="part4" ${q.part === 4 || q.type === 'essay' || q.type === 'part4' ? 'selected' : ''}>Phần IV (Tự luận ngắn)</option>
                    </select>
                    <button type="button" class="btn-soide-tool" style="background:#fee2e2; color:#dc2626; padding:3px 7px;" onclick="deleteQuestionFromSoiDe(${qIdx})" title="Xóa câu hỏi này">
                        🗑️ Xóa
                    </button>
                </div>
            </div>

            <div>
                <div class="soide-textarea-label">
                    <span>Nội dung câu hỏi (hỗ trợ công thức LaTeX $...$):</span>
                </div>
                <textarea class="soide-latex-input" rows="2" oninput="updateSoiDeQuestionText(${qIdx}, this.value)">${escapeHtml(q.question || "")}</textarea>
            </div>

            ${specificHtml}

            <div>
                <div class="soide-textarea-label">Lời giải chi tiết:</div>
                <textarea class="soide-latex-input" rows="2" oninput="updateSoiDeExplanation(${qIdx}, this.value)">${escapeHtml(q.explanation || "")}</textarea>
            </div>
        `;

        cardsContainer.appendChild(card);
    });

    // Cập nhật Raw Editor
    updateRawTextFromState();
}

// 9. CÁC HÀM CẬP NHẬT TRƯỜNG CÂU HỎI
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
        const letters = ["A", "B", "C", "D"];
        q.correct = letters.indexOf(letter);
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

    if (newType === "multiple_choice") {
        q.type = "multiple_choice";
        delete q.part;
        if (!q.options) q.options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"];
        if (q.correct === undefined) q.correct = 0;
    } else if (newType === "true_false") {
        q.type = "true_false";
        delete q.part;
        if (!q.statements) {
            q.statements = [
                { id: "a", statement: "Mệnh đề a", correct: true },
                { id: "b", statement: "Mệnh đề b", correct: false },
                { id: "c", statement: "Mệnh đề c", correct: true },
                { id: "d", statement: "Mệnh đề d", correct: false }
            ];
        }
    } else if (newType === "short_answer") {
        q.type = "short_answer";
        delete q.part;
        if (!q.correctAnswer) q.correctAnswer = "0";
    } else if (newType === "part4") {
        q.type = "short_answer";
        q.part = 4;
        if (!q.correctAnswer) q.correctAnswer = "0";
    }

    renderSoiDeBothSides();
}

function addNewQuestionToSoiDe() {
    const questions = soiDeState.examData.questions || [];
    const newId = questions.length > 0 ? (Math.max(...questions.map(q => parseInt(q.id, 10) || 0)) + 1) : 1;

    questions.push({
        id: newId,
        type: "multiple_choice",
        question: `Câu hỏi số ${questions.length + 1}: Cho hàm số $y = f(x)$...`,
        options: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        correct: 0,
        explanation: "Lời giải chi tiết câu hỏi này..."
    });

    renderSoiDeBothSides();

    setTimeout(() => {
        const newCard = document.getElementById(`soide-qcard-${newId}`);
        if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// 10. HÀM XÓA CÂU HỎI (DÙNG ĐƯỢC TỪ CẢ GÓC PHẢI TRÊN Ở NỬA TRÁI LẪN NỬA PHẢI)
function deleteQuestionFromSoiDe(qIdx) {
    const q = soiDeState.examData.questions[qIdx];
    const qNum = qIdx + 1;
    if (!confirm(`⚠️ Bạn có chắc chắn muốn XÓA Câu ${qNum} không?`)) return;

    soiDeState.examData.questions.splice(qIdx, 1);
    renderSoiDeBothSides();
}

function deleteQuestionFromLeftPreview(qId) {
    const qIdx = soiDeState.examData.questions.findIndex(q => String(q.id) === String(qId));
    if (qIdx !== -1) {
        deleteQuestionFromSoiDe(qIdx);
    }
}

// 11. ĐIỀU KHIỂN CHẾ ĐỘ BIÊN SOẠN (KHỐI CARDS / RAW CODE)
function setSoiDeEditorMode(mode) {
    soiDeState.editorMode = mode;
    const btnCards = document.getElementById("btn-mode-cards");
    const btnRaw = document.getElementById("btn-mode-raw");
    const cardsBox = document.getElementById("soide-cards-container");
    const rawBox = document.getElementById("soide-raw-container");

    if (mode === 'cards') {
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
    if (rawEditor) {
        rawEditor.value = JSON.stringify(soiDeState.examData, null, 2);
    }
}

function handleSoiDeRawInput(text) {
    debouncedFunction(() => {
        try {
            const parsed = JSON.parse(text);
            if (parsed && Array.isArray(parsed.questions)) {
                soiDeState.examData = parsed;
                setValidationStatus(true, "✅ Cú pháp JSON hợp lệ!");
                renderSoiDeLeftLivePreview();
            } else {
                setValidationStatus(false, "⚠️ Cú pháp JSON cần có trường questions dạng mảng!");
            }
        } catch(e) {
            setValidationStatus(false, "❌ Lỗi cú pháp JSON: " + e.message);
        }
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

// 12. KIỂM TRA LỖI CÚ PHÁP VÀ ĐỒNG BỘ HIỂN THỊ CẢNH BÁO
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
            // Kiểm tra cân bằng dấu $
            const dollarMatches = q.question.match(/(^|[^\\])\$/g);
            if (dollarMatches && dollarMatches.length % 2 !== 0) {
                errors.push(`Câu ${qNum}: Dấu công thức toán '$' chưa đóng mở cân bằng!`);
            }
        }

        if (q.type === "multiple_choice") {
            if (!Array.isArray(q.options) || q.options.length < 2) {
                errors.push(`Câu ${qNum}: Cần có ít nhất 2 phương án lựa chọn!`);
            }
        } else if (q.type === "true_false") {
            if (!Array.isArray(q.statements) || q.statements.length === 0) {
                errors.push(`Câu ${qNum}: Thiếu danh sách mệnh đề đúng sai!`);
            }
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

// 13. RENDER NỬA TRÁI: LIVE RENDER CHI TIẾT TỪNG CÂU & KÈM NÚT XÓA CÂU
function renderSoiDeLeftLivePreview() {
    const previewContainer = document.getElementById("soide-live-preview-content");
    const countEl = document.getElementById("soide-live-qcount");
    if (!previewContainer) return;

    const questions = soiDeState.examData.questions || [];
    if (countEl) countEl.innerText = questions.length;

    // Kiểm tra lỗi
    const errors = validateExamSyntax(questions);
    if (errors.length > 0) {
        setValidationStatus(false, `⚠️ Có ${errors.length} cảnh báo: ${errors[0]}`);
    } else {
        setValidationStatus(true, "✅ Cú pháp & công thức hợp lệ");
    }

    if (questions.length === 0) {
        previewContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b; font-weight:700;">Chưa có câu hỏi nào. Hãy upload file hoặc bấm [➕ Thêm câu] bên phải!</div>`;
        return;
    }

    let html = "";
    const imageMap = soiDeState.examData.images || {};
    const letters = ["A", "B", "C", "D"];

    questions.forEach((q, idx) => {
        const displayIndex = idx + 1;
        const qId = q.id;

        // Trích xuất ảnh hiệu quả
        let imgUrl = "";
        if (q.imageUrl && q.imageUrl.trim()) imgUrl = q.imageUrl.trim();
        else if (q.imageKey && imageMap[q.imageKey]) imgUrl = imageMap[q.imageKey].trim();
        else if (imageMap[`img_q_${qId}`]) imgUrl = imageMap[`img_q_${qId}`].trim();

        const imgHtml = imgUrl ? `
            <div class="quiz-img-container" id="soide-img-box-${qId}">
                <div class="quiz-img-wrapper" style="position:relative; display:inline-block;">
                    <img src="${imgUrl}" class="quiz-img" style="max-height:260px;" alt="Hình câu ${displayIndex}">
                </div>
            </div>` : `<div class="quiz-img-container" id="soide-img-box-${qId}" style="display:none;"></div>`;

        // Khối Dán ảnh Snipping Tool (Ctrl+V) & Tải tệp ảnh trực tiếp
        const imgKey = q.imageKey || `img_q_${qId}`;
        const uploaderHtml = `
            <div class="admin-img-uploader-zone" id="zone-soide-${qId}" tabindex="0" title="Click vào đây và bấm Ctrl+V để dán ảnh chụp màn hình Snipping Tool" style="margin: 6px 0 10px 0; padding: 6px 10px;">
                <div class="admin-uploader-btn-group">
                    <button type="button" class="btn-admin-paste-img" onclick="triggerSoiDePastePrompt(${qId}, '${imgKey}')">
                        📋 Dán ảnh (Ctrl+V)
                    </button>
                    <button type="button" class="btn-admin-file-img" onclick="document.getElementById('file-soide-${qId}').click()">
                        📁 Tệp ảnh
                    </button>
                    ${imgUrl ? `
                    <button type="button" class="btn-admin-del-img" onclick="deleteSoiDeQuestionImage(${qId}, '${imgKey}')">
                        🗑️ Xóa ảnh
                    </button>` : ''}
                    <input type="file" id="file-soide-${qId}" accept="image/*" style="display:none;" onchange="handleSoiDeQuestionImageSelected(this, ${qId}, '${imgKey}')">
                </div>
                <span class="admin-uploader-status" id="status-soide-${qId}"></span>
            </div>
        `;

        let bodyHtml = "";

        if (q.type === "multiple_choice") {
            const correctLetter = (typeof q.correct === "number") ? letters[q.correct] : String(q.correct || "A").toUpperCase();
            bodyHtml = `
                <div class="options-list grid-2">
                    ${(q.options || []).map((opt, oIdx) => {
                        const L = letters[oIdx];
                        const isCorrect = (L === correctLetter);
                        return `
                            <div class="opt-label ${isCorrect ? 'selected' : ''}" style="cursor:default;">
                                <span class="opt-circle">${L}</span>
                                <span class="opt-text">${opt} ${isCorrect ? '<b style="color:#16a34a; margin-left:4px;">✓</b>' : ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (q.type === "true_false") {
            bodyHtml = `
                <div class="tf-table-box">
                    <table class="tf-table">
                        <thead>
                            <tr><th>Mệnh đề</th><th width="80" style="text-align:center;">Đáp án</th></tr>
                        </thead>
                        <tbody>
                            ${(q.statements || []).map(st => {
                                const isTrue = (st.correct === true || String(st.correct).toLowerCase() === "đúng");
                                return `
                                    <tr>
                                        <td><b>${st.id})</b> ${st.statement}</td>
                                        <td align="center" style="font-weight:900; color:${isTrue ? '#16a34a' : '#dc2626'};">
                                            ${isTrue ? '🟢 Đúng' : '🔴 Sai'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            bodyHtml = `
                <div style="background:#f0fdf4; border:1px solid #86efac; padding:8px 12px; border-radius:8px; font-weight:800; color:#166534; margin-top:6px; display:inline-block;">
                    🎯 Đáp số: <span style="font-size:1.1em; color:#0f172a;">${q.correctAnswer || '(Chưa nhập)'}</span>
                </div>
            `;
        }

        const explainHtml = q.explanation ? `
            <div class="explanation-box" style="margin-top:8px;">
                💡 <b>Lời giải chi tiết:</b> ${q.explanation}
            </div>` : "";

        html += `
            <div class="question-card" id="soide-preview-card-${qId}" data-qid="${qId}" style="position:relative; margin-bottom:14px;">
                <!-- NÚT XÓA CÂU TẠI GÓC TRÊN BÊN PHẢI -->
                <button type="button" class="btn-soide-del-q-preview" onclick="deleteQuestionFromLeftPreview(${qId})" title="Xóa câu ${displayIndex} này ngay lập tức">
                    🗑️ Xóa câu
                </button>

                <div class="q-header" style="padding-right: 90px;">
                    <div class="q-num-badge">${displayIndex}</div>
                    <div class="q-content-text">${formatQuestionText(q.question || "")}</div>
                </div>

                ${uploaderHtml}
                ${imgHtml}
                ${bodyHtml}
                ${explainHtml}
            </div>
        `;
    });

    previewContainer.innerHTML = html;

    // Gắn lắng nghe paste clipboard Snipping Tool cho nửa trái
    setupSoiDePasteListeners();

    // Render công thức LaTeX MathJax
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([previewContainer]).catch(() => {});
    }
}

// 14. XỬ LÝ DÁN ẢNH SNIPPING TOOL (CTRL+V) TRỰC TIẾP TRONG BẢNG SOI ĐỀ
function setupSoiDePasteListeners() {
    document.querySelectorAll('.soide-left-pane .question-card').forEach(card => {
        card.addEventListener('paste', function(e) {
            const qId = this.dataset.qid;
            const q = soiDeState.examData.questions.find(item => String(item.id) === String(qId));
            const imgKey = (q && q.imageKey) || `img_q_${qId}`;
            const clipboardItems = (e.clipboardData || window.clipboardData)?.items;
            if (!clipboardItems) return;

            for (let i = 0; i < clipboardItems.length; i++) {
                const item = clipboardItems[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    uploadSoiDeImage(blob, qId, imgKey);
                    break;
                }
            }
        });
    });
}

function triggerSoiDePastePrompt(qId, imgKey) {
    const zone = document.getElementById(`zone-soide-${qId}`);
    if (zone) zone.focus();
    alert(`📋 Em vừa quét ảnh bằng Snipping Tool?\nHãy click chuột vào ô này rồi nhấn Ctrl + V để dán ảnh ngay lập tức!`);
}

function handleSoiDeQuestionImageSelected(input, qId, imgKey) {
    if (input.files && input.files[0]) {
        uploadSoiDeImage(input.files[0], qId, imgKey);
    }
}

async function uploadSoiDeImage(file, qId, imgKey) {
    if (!file) return;
    const statusEl = document.getElementById(`status-soide-${qId}`);
    if (statusEl) {
        statusEl.className = "admin-uploader-status loading";
        statusEl.innerText = "⏳ Đang tải ảnh...";
    }

    try {
        // Tận dụng hàm upload có sẵn trong exam-img-uploader.js nếu có, hoặc tải ImgBB
        let directUrl = "";
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const b64 = await base64Promise;

        // Nếu có ImgBB Key
        if (typeof IMGBB_API_KEY !== "undefined" && IMGBB_API_KEY && !IMGBB_API_KEY.includes("THAY_API_KEY")) {
            const formData = new FormData();
            formData.append("image", b64);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const json = await res.json();
            if (json && json.success && json.data) {
                directUrl = json.data.display_url || json.data.url;
            }
        }

        // Nếu không có hoặc lỗi, dùng Google Drive GAS
        if (!directUrl && typeof GOOGLE_DRIVE_UPLOAD_GAS_URL !== "undefined" && GOOGLE_DRIVE_UPLOAD_GAS_URL) {
            const driveRes = await fetch(GOOGLE_DRIVE_UPLOAD_GAS_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ filename: `soide_cau_${qId}_${Date.now()}.png`, mimeType: file.type || "image/png", base64: b64 })
            }).then(r => r.json());
            if (driveRes && driveRes.fileUrl) {
                directUrl = (typeof toDirectGoogleDriveImageUrl === "function") ? toDirectGoogleDriveImageUrl(driveRes.fileUrl) : driveRes.fileUrl;
            }
        }

        if (!directUrl) {
            // Fallback lưu Data URI trực tiếp để xem được ngay
            directUrl = `data:${file.type || "image/png"};base64,${b64}`;
        }

        // Cập nhật vào cấu trúc đề
        if (!soiDeState.examData.images) soiDeState.examData.images = {};
        soiDeState.examData.images[imgKey] = directUrl;
        const targetQ = soiDeState.examData.questions.find(item => String(item.id) === String(qId));
        if (targetQ) targetQ.imageUrl = directUrl;

        renderSoiDeBothSides();

        if (statusEl) {
            statusEl.className = "admin-uploader-status success";
            statusEl.innerText = "✅ Đã gán ảnh!";
            setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 3000);
        }
    } catch(err) {
        if (statusEl) {
            statusEl.className = "admin-uploader-status error";
            statusEl.innerText = "❌ Lỗi: " + err.message;
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
    const targetQ = soiDeState.examData.questions.find(item => String(item.id) === String(qId));
    if (targetQ) targetQ.imageUrl = "";

    renderSoiDeBothSides();
}

// 15. XUẤT FILE JSON ĐỀ THI
function downloadSoiDeJson() {
    try {
        const jsonStr = JSON.stringify(soiDeState.examData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
        const safeTitle = (soiDeState.examData.title || "De_Thi").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
        const fileName = `${safeTitle}_Made_${soiDeState.examData.maDe || '101'}.json`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch(e) {
        alert("❌ Lỗi xuất file JSON: " + e.message);
    }
}

// CÁC HÀM TIỆN ÍCH TRÁNH XSS KHI ĐƯA VÀO ATTRIBUTE
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
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

// ĐĂNG KÝ TOÀN CỤC CÁC HÀM
window.openSoiDeModal = openSoiDeModal;
window.closeSoiDeModal = closeSoiDeModal;
window.triggerSoiDeUpload = triggerSoiDeUpload;
window.handleSoiDeFileSelected = handleSoiDeFileSelected;
window.addNewQuestionToSoiDe = addNewQuestionToSoiDe;
window.deleteQuestionFromSoiDe = deleteQuestionFromSoiDe;
window.deleteQuestionFromLeftPreview = deleteQuestionFromLeftPreview;
window.downloadSoiDeJson = downloadSoiDeJson;
window.setSoiDeEditorMode = setSoiDeEditorMode;
window.handleSoiDeRawInput = handleSoiDeRawInput;
window.updateSoiDeMeta = updateSoiDeMeta;
window.updateSoiDeQuestionText = updateSoiDeQuestionText;
window.updateSoiDeOption = updateSoiDeOption;
window.updateSoiDeCorrectMC = updateSoiDeCorrectMC;
window.updateSoiDeStatementText = updateSoiDeStatementText;
window.updateSoiDeStatementCorrect = updateSoiDeStatementCorrect;
window.updateSoiDeShortAnswer = updateSoiDeShortAnswer;
window.updateSoiDeExplanation = updateSoiDeExplanation;
window.changeSoiDeQuestionType = changeSoiDeQuestionType;
window.triggerSoiDePastePrompt = triggerSoiDePastePrompt;
window.handleSoiDeQuestionImageSelected = handleSoiDeQuestionImageSelected;
window.deleteSoiDeQuestionImage = deleteSoiDeQuestionImage;