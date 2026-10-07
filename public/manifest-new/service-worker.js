// ─── LDDM List — Service Worker ───
// Stratégie : réseau d'abord (toujours les données à jour), cache en secours hors ligne.
// Les appels /api/* ne sont jamais mis en cache.
const CACHE = 'lddm-v3';
const SHELL = ['/', '/assets/css/app.css', '/js/app.js', '/manifest.json', '/assets/icons/icon192.png'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname === '/notifications-count' || url.pathname === '/wake') return;

    event.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then(hit => hit || caches.match('/')))
    );
});

// ─── PUSH NOTIFICATIONS ───
self.addEventListener('push', event => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'LDDM List', body: event.data ? event.data.text() : 'Nouvelle notification' };
    }
    event.waitUntil(self.registration.showNotification(data.title || 'LDDM List', {
        body: data.body || 'Nouvelle notification',
        icon: data.icon || '/assets/icons/icon192.png',
        badge: '/assets/icons/badge.png',
        vibrate: [200, 100, 200],
        tag: 'lddm-notification',
        renotify: true,
        data: { url: data.url || '/' }
    }));
});

// ─── CLIC SUR LA NOTIFICATION ───
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
            }
            return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
        })
    );
});
