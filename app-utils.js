// =========================================================
// FILE: app-utils.js (BỔ SUNG INDEXEDDB CHỐNG MẤT BÀI 100%)
// =========================================================

const safeLocal = {
    getItem(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch(e) {} }
};

const safeSession = {
    getItem(k) { try { return sessionStorage.getItem(k); } catch(e) { return null; } },
    setItem(k, v) { try { sessionStorage.setItem(k, v); } catch(e) {} },
    removeItem(k) { try { sessionStorage.removeItem(k); } catch(e) {} }
};

// =========================================================
// MODULE: examIndexedDB (LƯU TRỮ VĨNH VIỄN HÀNG TRĂM MB CHO HỌC SINH)
// =========================================================
const examIndexedDB = {
    dbName: 'ExamSecureOfflineDB',
    dbVersion: 2,
    _db: null,

    async getDB() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                resolve(null);
                return;
            }
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('exam_states')) {
                    db.createObjectStore('exam_states', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('pending_submissions')) {
                    db.createObjectStore('pending_submissions', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('exam_history')) {
                    db.createObjectStore('exam_history', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('live_drafts')) {
                    db.createObjectStore('live_drafts', { keyPath: 'key' });
                }
            };
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };
            request.onerror = (e) => {
                console.warn('Lỗi mở IndexedDB:', e);
                resolve(null);
            };
        });
    },

    async setItem(storeName, data) {
        try {
            const db = await this.getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).put(data);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    },

    async getItem(storeName, key) {
        try {
            const db = await this.getDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    },

    async removeItem(storeName, key) {
        try {
            const db = await this.getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    },

    async getAll(storeName) {
        try {
            const db = await this.getDB();
            if (!db) return [];
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch (e) {
            return [];
        }
    }
};

window.examIndexedDB = examIndexedDB;

function normalizeName(str) {
    if (!str) return "";
    return String(str).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function toTitleCaseName(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => {
        if (!word) return "";
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

function parseDateString(dateStr) {
    if (!dateStr) return 0;
    try {
        let parts = String(dateStr).split(' - ');
        let dParts = parts[0].split('/');
        let tParts = parts[1] ? parts[1].split(':') : ['00', '00'];
        return new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]).getTime();
    } catch(e) { return 0; }
}

function formatDateTimeFull(timestamp) {
    if (!timestamp) return "---";
    let d = new Date(timestamp);
    if (isNaN(d.getTime())) {
        let parsed = parseDateString(timestamp);
        if (parsed) d = new Date(parsed);
        else return String(timestamp);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

function formatElapsedDuration(startTimeMs) {
    if (!startTimeMs) return "Đang làm...";
    const diffSec = Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins === 0) return `${secs} giây`;
    return `${mins} phút ${secs} giây`;
}

function cleanExamCodeKey(code) {
    return String(code || "").trim().replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_');
}

function extractNormalizedExamCode(title) {
    if (!title) return "";
    let clean = String(title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toUpperCase();
    let m = clean.match(/(DE\s*(?:SO)?\s*\d+)/i);
    let p1 = m ? m[1].replace(/\s+/g, "").replace("SO", "") : "";
    let mToan = clean.match(/TOAN\s*(?:LOP\s*)?(\d+)/i);
    let p2 = mToan ? ("TOAN" + mToan[1]) : "";
    if (p1 && p2) return p1 + p2;
    if (p1) return p1;
    return clean.replace(/[^A-Z0-9]/g, "");
}

function getExamCandidateCodes(title, maDe, quizId) {
    let codes = new Set();
    if (quizId) codes.add(String(quizId).trim());
    if (maDe) {
        let cleanMd = cleanExamCodeKey(maDe);
        if (cleanMd) codes.add(cleanMd);
        let normMd = extractNormalizedExamCode(maDe);
        if (normMd) codes.add(normMd);
    }
    if (title) {
        let cleanT = cleanExamCodeKey(title);
        if (cleanT) codes.add(cleanT);
        let norm = extractNormalizedExamCode(title);
        if (norm) codes.add(norm);

        let mNum = String(title).match(/(?:đề|de)\s*(?:số|so)?\s*(\d+)/i);
        if (mNum) {
            let n = mNum[1];
            codes.add(n);
            codes.add("DE" + n);
            codes.add("DE_" + n);
            codes.add("DE" + n + "TOAN11");
            codes.add("DE" + n + "TOAN10");
            codes.add("DE" + n + "TOAN12");
        }
    }
    codes.add("101");
    return Array.from(codes);
}

function toDirectGoogleDriveImageUrl(url) {
    if (!url) return "";
    let cleanUrl = String(url).trim();
    let m = cleanUrl.match(/(?:file\/d\/|id=|open\?id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
    return cleanUrl;
}

function stripHtml(html) {
    let tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function extractQuizIdFromItem(item) {
    if (!item) return null;
    if (item.url && item.url.includes("?id=")) {
        try {
            let u = new URL(item.url, window.location.href);
            let qId = u.searchParams.get("id");
            if (qId && qId.trim() !== "") return qId.trim();
        } catch(e) {
            let m = item.url.match(/[?&]id=([^&#]+)/);
            if (m && m[1]) return decodeURIComponent(m[1]).trim();
        }
    }
    if (item.quizId && String(item.quizId).trim() !== "") return String(item.quizId).trim();
    if (item.firebaseId && String(item.firebaseId).trim() !== "") return String(item.firebaseId).trim();
    if (item.id && String(item.id).trim() !== "") return String(item.id).trim();
    return null;
}

function toLocalDatetimeString(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "";
    const pad = (n) => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
}

function formatScheduleDateTime(dtStr) {
    if (!dtStr) return "";
    let d = new Date(dtStr);
    if (isNaN(d.getTime())) {
        let p = parseDateString(dtStr);
        if (p) d = new Date(p);
        else return String(dtStr);
    }
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function buildTimeBoxHtml(timeLimitMinutes, startStr, endStr, fallbackDateStr = "") {
    let mins = parseInt(timeLimitMinutes, 10);
    if (isNaN(mins) || mins <= 0) mins = 120;

    let stFormatted = "";
    let etFormatted = "";

    if (startStr && endStr) {
        stFormatted = formatScheduleDateTime(startStr);
        etFormatted = formatScheduleDateTime(endStr);
    } else if (endStr) {
        let dEnd = new Date(endStr);
        let dStart = new Date(dEnd.getTime() - 7 * 24 * 3600 * 1000);
        stFormatted = formatScheduleDateTime(dStart);
        etFormatted = formatScheduleDateTime(endStr);
    } else {
        let baseDate = fallbackDateStr ? new Date(parseDateString(fallbackDateStr) || Date.now()) : new Date();
        if (isNaN(baseDate.getTime())) baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0);
        let endDate = new Date(baseDate.getTime() + 10 * 24 * 3600 * 1000);
        endDate.setHours(2, 58, 0, 0);
        stFormatted = formatScheduleDateTime(baseDate);
        etFormatted = formatScheduleDateTime(endDate);
    }

    return `
        <div class="time-row-limit">
            ⏱ Thời gian làm: <b>${mins} phút</b>
        </div>
        <div class="time-row-schedule">
            🗓️ Khung giờ: <b>${stFormatted} đến ${etFormatted}</b>
        </div>
    `;
}

function getCategoryDisplayName(catId) {
    const map = {
        "kho-tai-lieu": "Kho tài liệu PDF, Word, Ảnh",
        "nhac-nho": "Nhắc nhở quan trọng",
        "them-10": "Thêm 10",
        "them-11": "Thêm 11",
        "them-12": "Thêm 12",
        "lop-11a": "Lớp 11A",
        "lop-11c": "Lớp 11C",
        "lop-10p": "Lớp 10P",
        "lop-11e": "Lớp 11E",
        "hsg-toan-11": "HSG Toán 11",
        "tu-luan-padlet": "Tự luận Padlet"
    };
    return map[catId] || catId;
}

function detectCategoryFromSbd(rawSbd) {
    if (!rawSbd) return null;
    const s = String(rawSbd).trim().toLowerCase();
    
    if (s.startsWith("11a") || s.startsWith("11a_")) return "lop-11a";
    if (s.startsWith("11c") || s.startsWith("11c_")) return "lop-11c";
    if (s.startsWith("11e") || s.startsWith("11e_")) return "lop-11e";
    if (s.startsWith("10p") || s.startsWith("10p_")) return "lop-10p";
    if (s.startsWith("hsg")) return "hsg-toan-11";

    if (/^10\d{2}$/.test(s)) return "them-10";
    if (/^11\d{2}$/.test(s)) return "them-11";
    if (/^12\d{2}$/.test(s)) return "them-12";

    if (window.STUDENT_ACCOUNTS) {
        for (let cat in window.STUDENT_ACCOUNTS) {
            const list = window.STUDENT_ACCOUNTS[cat];
            if (Array.isArray(list)) {
                const found = list.find(acc => acc.sbd && String(acc.sbd).trim().toLowerCase() === s);
                if (found) return cat;
            }
        }
    }
    return null;
}

function getSbdPlaceholderForCategory(catId) {
    const c = String(catId || "").toLowerCase();
    if (c.includes("11a") || c === "lop-11a") return "Ví dụ: 11A01, 11A28, 11A45...";
    if (c.includes("11c") || c === "lop-11c") return "Ví dụ: 11C01, 11C14, 11C38...";
    if (c.includes("11e") || c === "lop-11e") return "Ví dụ: 11E01, 11E05, 11E28...";
    if (c.includes("10p") || c === "lop-10p") return "Ví dụ: 10p01, 10p14, 10p37...";
    if (c.includes("hsg") || c === "hsg-toan-11") return "Ví dụ: HSG1, HSG2, HSG6...";
    if (c.includes("them-10") || c === "them 10") return "Ví dụ: 1001, 1016, 1030...";
    if (c.includes("them-11") || c === "them 11") return "Ví dụ: 1101, 1114, 1137...";
    if (c.includes("them-12") || c === "them 12") return "Ví dụ: 1201, 1210, 1234...";
    return "Nhập số báo danh theo lớp của bạn...";
}

async function sha256Hash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}