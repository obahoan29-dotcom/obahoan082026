// =========================================================
// FILE: portal-results-core.js (BẢN SUPABASE TỐI ƯU & QUÉT ĐA MÃ ĐỀ)
// =========================================================

let currentExamResultData = {
    item: null, title: "", examCode: "", categoryId: "them-11", rawRows: []
};

let autoRefreshTimer = null;
let isAutoRefreshEnabled = true;
let scoreChartInstance = null;
const _examResultsCache = {};
let _regradeFileParsedAnswers = null;
let currentRankSortMode = 'default';

let realtimeSubmissionsChannel = null;

function normalizeCategoryKey(cat) {
    if (!cat) return "";
    return String(cat).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function identifyOfficialStudentCategory(sbd, name) {
    if (!window.STUDENT_ACCOUNTS) return null;
    const cleanSbd = String(sbd || "").trim().toLowerCase();

    if (cleanSbd && cleanSbd.length >= 3 && cleanSbd !== "---" && cleanSbd !== "free" && cleanSbd !== "chuanhap") {
        for (let catId in window.STUDENT_ACCOUNTS) {
            const list = window.STUDENT_ACCOUNTS[catId];
            if (!Array.isArray(list)) continue;
            if (list.some(acc => String(acc.sbd || "").trim().toLowerCase() === cleanSbd)) {
                return catId;
            }
        }
    }
    return null;
}

function isSubmissionMatchingCategory(sub, targetCatId) {
    if (!targetCatId) return true;
    const normTarget = normalizeCategoryKey(targetCatId);
    const subSbdClean = String(sub.sbd || sub.studentId || "").trim().toLowerCase();

    const officialCat = identifyOfficialStudentCategory(sub.sbd || sub.studentId, sub.studentName || sub.name);
    if (officialCat) return normalizeCategoryKey(officialCat) === normTarget;

    const classAccounts = getAccountsForCategory(targetCatId);
    if (classAccounts.some(acc => String(acc.sbd || "").trim().toLowerCase() === subSbdClean)) return true;

    const rawSubCat = normalizeCategoryKey(sub.categoryId || sub.category_id || sub.cat || "");
    const rawClass = normalizeCategoryKey(sub.studentClass || sub.class_name || "");

    const isClass11C = rawClass.includes("11c") || subSbdClean.startsWith("11c");
    const isClass11A = (rawClass.includes("11a") || subSbdClean.startsWith("11a")) && !subSbdClean.startsWith("hsg");
    const isClass11E = rawClass.includes("11e") || subSbdClean.startsWith("11e");
    const isClass10P = rawClass.includes("10p") || subSbdClean.startsWith("10p");
    const isClassHSG = rawClass.includes("hsg") || subSbdClean.startsWith("hsg") || rawSubCat.includes("hsg");

    if (isClassHSG && normTarget !== "hsgtoan11" && !normTarget.includes("hsg")) return false;
    if (isClass11C && normTarget !== "lop11c") return false;
    if (isClass11A && normTarget !== "lop11a") return false;
    if (isClass11E && normTarget !== "lop11e") return false;
    if (isClass10P && normTarget !== "lop10p") return false;

    if (normTarget === "lop11c" && !isClass11C) return false;
    if (normTarget === "lop11a" && !isClass11A) return false;
    if (normTarget === "lop11e" && !isClass11E) return false;
    if (normTarget === "lop10p" && !isClass10P) return false;
    if ((normTarget === "hsgtoan11" || normTarget.includes("hsg")) && !isClassHSG) return false;

    if (rawSubCat && rawSubCat === normTarget) return true;
    return !normTarget.startsWith("lop") && !normTarget.includes("hsg");
}

function getExamPossibleQuizIds(examItem, examMeta) {
    const ids = new Set();
    if (examMeta && examMeta.quizId) ids.add(String(examMeta.quizId).trim());
    if (examItem) {
        let extracted = extractQuizIdFromItem(examItem);
        if (extracted) ids.add(String(extracted).trim());
        if (examItem.id) ids.add(String(examItem.id).trim());
        if (examItem.firebaseId) ids.add(String(examItem.firebaseId).trim());
    }
    return Array.from(ids).filter(Boolean);
}

function sortDataString(str) {
    if (!str) return "";
    let parts = str.split(/\s*\|\s*/);
    parts.sort((a, b) => {
        let isTabA = a.toLowerCase().includes("tab switch");
        let isTabB = b.toLowerCase().includes("tab switch");
        if (isTabA && !isTabB) return 1;
        if (!isTabA && isTabB) return -1;
        return a.localeCompare(b);
    });
    return parts.join(" | ");
}

function extractTabCountFromDataString(dataStr) {
    if (!dataStr) return 0;
    let m = dataStr.match(/tab\s*switch\s*:\s*(\d+)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
}

function deduplicateAttempts(attempts) {
    if (!attempts || attempts.length <= 1) return attempts || [];
    let unique = [];
    attempts.forEach(sub => {
        let subTime = getSubmissionTimestamp(sub);
        let subScore = (sub.score10 !== undefined) ? String(sub.score10) : "";
        let isDup = unique.some(existing => {
            let exTime = getSubmissionTimestamp(existing);
            let exScore = (existing.score10 !== undefined) ? String(existing.score10) : "";
            return (subTime > 0 && exTime > 0 && Math.abs(subTime - exTime) < 30000 && subScore === exScore);
        });
        if (!isDup) unique.push(sub);
    });
    return unique;
}

function getSubmissionTimestamp(sub) {
    if (!sub) return 0;
    if (sub.created_at) return new Date(sub.created_at).getTime();
    if (typeof sub.createdAt === 'number') return sub.createdAt;
    return parseDateString(sub.timestamp) || 0;
}

function startRealtimeSubmissionsListener(quizId) {
    stopRealtimeSubmissionsListener();
    if (!quizId || !supabaseClient) return;

    realtimeSubmissionsChannel = supabaseClient.channel(`admin_realtime_${quizId}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'submissions', 
            filter: `quiz_id=eq.${quizId}` 
        }, () => {
            if (currentExamResultData.item) {
                fetchAndRenderExamResults(currentExamResultData.item, true);
            }
        })
        .subscribe();
}

function stopRealtimeSubmissionsListener() {
    if (realtimeSubmissionsChannel && supabaseClient) {
        supabaseClient.removeChannel(realtimeSubmissionsChannel);
        realtimeSubmissionsChannel = null;
    }
}

// TẢI KẾT QUẢ ĐÚNG ĐỀ ĐANG XEM (QUÉT TOÀN DIỆN DANH SÁCH MÃ ĐỀ LIÊN QUAN)
async function fetchAndRenderExamResults(item, isSilent = false) {
    if (!item || !supabaseClient) return;

    let quizId = extractQuizIdFromItem(item) || item.id || "";
    let maDe = "";
    let examTitle = item.title || "";

    try {
        const { data: qData } = await supabaseClient.from('quizzes').select('made, title').eq('id', quizId).single();
        if (qData) {
            maDe = qData.made || "";
            if (qData.title) examTitle = qData.title;
        }
    } catch(e) {}

    const candidateIds = Array.from(new Set([
        quizId,
        cleanExamCodeKey(maDe),
        cleanExamCodeKey(examTitle),
        item.id,
        item.firebaseId
    ].filter(Boolean)));

    try {
        const [subRes, cheatRes, activeRes] = await Promise.all([
            supabaseClient.from('submissions').select('*').in('quiz_id', candidateIds),
            supabaseClient.from('cheating_logs').select('*').in('quiz_id', candidateIds),
            supabaseClient.from('active_sessions').select('*').in('quiz_id', candidateIds)
        ]);

        const rawSubs = (subRes.data || []).map(r => ({
            ...r,
            studentName: r.student_name,
            studentClass: r.class_name,
            score10: r.score10,
            rawScore: r.raw_score,
            correctCount: r.correct_count,
            wrongCount: r.wrong_count,
            completionTime: r.completion_time,
            spentMins: r.spent_mins,
            tabSwitchCount: r.tab_switch_count,
            dataString: r.data_string,
            userAnswers: r.user_answers,
            timestamp: formatDateTimeFull(new Date(r.created_at).getTime()),
            createdAt: new Date(r.created_at).getTime()
        }));

        const cheatingLogsMap = {};
        (cheatRes.data || []).forEach(c => {
            cheatingLogsMap[c.id] = {
                sbd: c.sbd,
                studentName: c.student_name,
                durationStr: c.duration_str,
                switchCount: c.switch_count
            };
        });

        const activeSessionsMap = {};
        (activeRes.data || []).forEach(a => {
            activeSessionsMap[a.sbd] = {
                sbd: a.sbd,
                name: a.name,
                className: a.class_name,
                startTime: a.start_time,
                lastPing: a.last_ping
            };
        });

        const targetCatId = item.categoryId || currentExamResultData.categoryId || "them-11";
        const examMeta = { quizId, maDe, examTitle };

        renderExamResultTable(targetCatId, rawSubs, cheatingLogsMap, activeSessionsMap, item, examMeta);

        const searchInput = document.getElementById("result-search-input");
        if (searchInput && searchInput.value.trim() !== "") filterResultTable();

    } catch(err) {
        console.error("Lỗi nạp bảng điểm Supabase:", err);
    }
}

function renderExamResultTable(categoryId, submissionsListRaw, cheatingMap, activeSessionsMap, examItem, examMeta = {}) {
    const classAccounts = getAccountsForCategory(categoryId);
    const targetCatId = String(categoryId || "").trim();

    const cheatHistoryBySbd = {};
    const maxCheatCountBySbd = {};

    for (let k in cheatingMap) {
        let log = cheatingMap[k];
        if (!log) continue;
        let sbdKey = String(log.sbd || "").trim().toLowerCase();
        let dur = String(log.durationStr || "").trim();
        if (!dur || dur.toLowerCase() === "bắt đầu") continue;

        let shortDur = dur.replace(/phút/g, 'p').replace(/giây/g, 's').replace(/\s+/g, '');
        let sCount = parseInt(log.switchCount, 10) || 0;

        if (sbdKey && sbdKey !== "---") {
            if (!cheatHistoryBySbd[sbdKey]) cheatHistoryBySbd[sbdKey] = [];
            cheatHistoryBySbd[sbdKey].push(shortDur);
            maxCheatCountBySbd[sbdKey] = Math.max(maxCheatCountBySbd[sbdKey] || 0, sCount);
        }
    }

    let submissionsList = [];
    for (let sub of (Array.isArray(submissionsListRaw) ? submissionsListRaw : [])) {
        if (!sub) continue;
        if (!isSubmissionMatchingCategory(sub, targetCatId)) continue;
        if (sub.dataString) sub.dataString = sortDataString(sub.dataString);
        submissionsList.push(sub);
    }
    submissionsList.sort((a, b) => getSubmissionTimestamp(a) - getSubmissionTimestamp(b));

    const activeUsersMap = {};
    const nowMs = Date.now();
    for (let rawKey in activeSessionsMap) {
        let sess = activeSessionsMap[rawKey];
        if (!sess) continue;
        let lastPing = sess.lastPing || 0;
        if (nowMs - lastPing < 360000) {
            let sessSbd = String(sess.sbd || "").trim().toLowerCase();
            if (sessSbd) activeUsersMap[sessSbd] = sess;
        }
    }

    const finalRows = [];
    const usedSbdSet = new Set();
    const usedSubIds = new Set();

    classAccounts.forEach((acc, idx) => {
        const accSbdLower = String(acc.sbd || "").trim().toLowerCase();
        let matchedSubs = [];
        for (let sub of submissionsList) {
            let subSbd = String(sub.sbd || "").trim().toLowerCase();
            if (accSbdLower && subSbd && subSbd === accSbdLower) {
                matchedSubs.push(sub);
                usedSubIds.add(sub.id);
            }
        }

        matchedSubs = deduplicateAttempts(matchedSubs);

        let isDoing = false; let doingStartTime = null;
        let activeSess = activeUsersMap[accSbdLower];
        if (matchedSubs.length === 0 && activeSess) {
            isDoing = true; 
            doingStartTime = activeSess.startTime || Date.now();
        }

        if (matchedSubs.length > 0) usedSbdSet.add(accSbdLower);

        let cheatDurations = cheatHistoryBySbd[accSbdLower] || [];
        let cheatLogsTabCount = maxCheatCountBySbd[accSbdLower] || cheatDurations.length;
        let cheatTimeString = cheatDurations.length > 0 ? cheatDurations.join(" | ") : "0s";
        let selectedAttemptIndex = matchedSubs.length > 0 ? (matchedSubs.length - 1) : 0;

        finalRows.push({
            _rowUid: 'row_cls_' + (acc.sbd || idx) + '_' + Math.random().toString(36).substring(2, 7),
            stt: acc.stt || (idx + 1), isClassStudent: true, account: acc, allAttempts: matchedSubs,
            selectedAttemptIndex: selectedAttemptIndex, isDoing: isDoing, doingStartTime: doingStartTime,
            isFreeDoing: false, cheatTimeString: cheatTimeString, cheatLogsTabCount: cheatLogsTabCount
        });
    });

    // Bổ sung thí sinh tự do
    let freeSttCounter = classAccounts.length + 1;
    for (let sub of submissionsList) {
        if (usedSubIds.has(sub.id)) continue;
        const subSbd = String(sub.sbd || "free").trim().toLowerCase();
        const freeAcc = {
            sbd: sub.sbd || "---",
            name: sub.studentName || "Thí sinh tự do",
            className: sub.studentClass || "Tự do"
        };
        finalRows.push({
            _rowUid: 'row_free_' + sub.id + '_' + Math.random().toString(36).substring(2, 7),
            stt: freeSttCounter++, isClassStudent: false, account: freeAcc, allAttempts: [sub],
            selectedAttemptIndex: 0, isDoing: false, doingStartTime: null,
            isFreeDoing: false, cheatTimeString: "0s", cheatLogsTabCount: 0
        });
    }

    if (typeof calculateRanksForRows === 'function') calculateRanksForRows(finalRows);
    currentExamResultData.rawRows = finalRows;
    if (typeof updateStatsAndRenderTable === 'function') updateStatsAndRenderTable(finalRows);
}

// THU BÀI TỰ ĐỘNG TỪ BẢN NHÁP SUPABASE
async function triggerAutoCollectDrafts(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const currentItem = currentExamResultData.item;
    if (!currentItem || !supabaseClient) return;

    const quizId = extractQuizIdFromItem(currentItem);
    if (!quizId) { alert("⚠️ Không tìm thấy ID đề thi!"); return; }

    if (!confirm("⚡ BẠN CÓ CHẮC MUỐN THU BÀI TỰ ĐỘNG?\nHệ thống sẽ tính điểm và nộp bài chính thức cho các em chưa kịp nộp.")) return;

    const btn = document.getElementById("btn-auto-collect-drafts");
    if (btn) { btn.disabled = true; btn.innerText = "⏳ Đang thu..."; }

    try {
        const [draftsRes, quizRes, subsRes] = await Promise.all([
            supabaseClient.from('live_drafts').select('*').eq('quiz_id', quizId),
            supabaseClient.from('quizzes').select('*').eq('id', quizId).single(),
            supabaseClient.from('submissions').select('sbd').eq('quiz_id', quizId)
        ]);

        const drafts = draftsRes.data || [];
        const quizObj = quizRes.data;
        const submittedSbds = new Set((subsRes.data || []).map(s => s.sbd));

        if (drafts.length === 0) {
            alert("ℹ️ Hiện không có bản nháp nào cần thu!");
            return;
        }

        const answerVault = {};
        const letters = ["A", "B", "C", "D"];
        (quizObj.questions || []).forEach(q => {
            if (q.type === "multiple_choice" && q.correct !== undefined) {
                answerVault[`q${q.id}`] = typeof q.correct === 'number' ? letters[q.correct] : String(q.correct).trim().toUpperCase();
            } else if (q.type === "true_false" && q.statements) {
                q.statements.forEach(st => {
                    answerVault[`q${q.id}_${st.id}`] = (st.correct === true || String(st.correct).toLowerCase() === 'đúng') ? "Đúng" : "Sai";
                });
            } else if (q.correctAnswer !== undefined) {
                answerVault[`q${q.id}`] = String(q.correctAnswer).trim();
            }
        });

        const scoringConfig = quizObj.scoring_config || { mode: "option1" };
        let collectedCount = 0;

        for (const draft of drafts) {
            if (submittedSbds.has(draft.sbd)) continue;

            const scoreResult = calculateExamScoreWithConfig(quizObj.questions, draft.user_answers, answerVault, scoringConfig);
            const submissionId = `${quizId}_${draft.sbd}`;

            await supabaseClient.from('submissions').upsert({
                id: submissionId,
                quiz_id: quizId,
                sbd: draft.sbd,
                student_name: draft.student_name || "Học sinh",
                class_name: draft.class_name || "Lớp học",
                score10: scoreResult.finalScore,
                raw_score: scoreResult.totalRawScore,
                max_scale: scoreResult.maxScale,
                correct_count: scoreResult.correctCount,
                wrong_count: scoreResult.wrongCount,
                completion_time: "Thu tự động",
                spent_mins: quizObj.time_limit_minutes || 90,
                tab_switch_count: "0 lần",
                data_string: scoreResult.dataDetails.join(" | ") + " | [THU TỰ ĐỘNG TỪ BẢN NHÁP]",
                user_answers: draft.user_answers,
                category_id: draft.category_id || "them-11",
                is_free: false,
                ma_de: quizObj.made || "101",
                exam_title: quizObj.title || "Đề thi"
            });

            await supabaseClient.from('live_drafts').delete().match({ quiz_id: quizId, sbd: draft.sbd });
            collectedCount++;
        }

        alert(`🎉 THU BÀI THÀNH CÔNG!\nĐã thu bài và tính điểm cho ${collectedCount} học sinh.`);
        await refreshCurrentExamResults();
    } catch(err) {
        alert("❌ Lỗi: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "⚡ Thu bài tự động"; }
    }
}

window.triggerAutoCollectDrafts = triggerAutoCollectDrafts;
window.startRealtimeSubmissionsListener = startRealtimeSubmissionsListener;
window.stopRealtimeSubmissionsListener = stopRealtimeSubmissionsListener;