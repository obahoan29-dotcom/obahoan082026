// =========================================================
// FILE: sw.js - SERVICE WORKER BẢO LƯU BÀI THI & BACKGROUND SYNC
// =========================================================

const CACHE_NAME = 'exam-engine-cache-v2026';
const ASSETS_TO_CACHE = [
    './thi.html',
    './thi-layout.css',
    './thi-exam.css',
    './style-modals.css',
    './app-config.js',
    './app-utils.js',
    './student-exam-flow.js',
    './exam-engine-core.js',
    './exam-export.js',
    './exam-api.js',
    './exam-render.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Tự động kích hoạt khi có mạng trở lại (Background Sync API)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pending-submissions') {
        event.waitUntil(syncPendingSubmissionsFromIndexedDB());
    }
});

// Helper đọc IndexedDB ngay bên trong Service Worker
function openSWDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ExamSecureOfflineDB', 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('pending_submissions')) {
                db.createObjectStore('pending_submissions', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('exam_history')) {
                db.createObjectStore('exam_history', { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function syncPendingSubmissionsFromIndexedDB() {
    try {
        const db = await openSWDatabase();
        const tx = db.transaction('pending_submissions', 'readwrite');
        const store = tx.objectStore('pending_submissions');
        const getAllReq = store.getAll();

        getAllReq.onsuccess = async () => {
            const items = getAllReq.result || [];
            for (const item of items) {
                if (item && item.payload) {
                    try {
                        // Thử gửi sang Google Apps Script dự phòng
                        if (item.gasUrl) {
                            await fetch(item.gasUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                body: JSON.stringify({
                                    action: 'backupSubmissionRecord',
                                    submission: item.payload
                                })
                            });
                        }
                        // Sau khi đồng bộ thành công thì gỡ khỏi hàng đợi pending
                        const delTx = db.transaction('pending_submissions', 'readwrite');
                        delTx.objectStore('pending_submissions').delete(item.id);
                    } catch(err) {}
                }
            }
        };
    } catch(e) {}
}

self.addEventListener('fetch', (event) => {
    // Không chặn các request API Supabase / GAS, ưu tiên mạng
    if (event.request.url.includes('supabase.co') || event.request.url.includes('script.google.com')) {
        return;
    }
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});