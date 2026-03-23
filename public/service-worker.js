// ─── CACHE ───
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open('v1').then(function(cache) {
            return cache.addAll([

                '/assets/css/styles.css',
                '/assets/icons/icon192.png',
                '/assets/icons/icon512.png'
            ]);
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});

// ─── BADGE ───
self.addEventListener('message', function(event) {
    if (event.data.action === 'updateBadge') {
        const numberOfTasks = 5;
        event.ports[0].postMessage({ action: 'setBadge', count: numberOfTasks });
    }
});

// ─── PUSH NOTIFICATIONS ───
self.addEventListener('push', function(event) {
    // Essayer de parser en JSON (envoyé par web-push)
    // Sinon fallback sur le texte brut
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch(e) {
        data = { 
            title: 'LDDM', 
            body: event.data ? event.data.text() : 'Nouvelle notification'
        };
    }

    const options = {
        body: data.body || 'Nouvelle notification',
        icon: '/assets/icons/icon192.png',
        badge: '/assets/icons/badge.png',
        vibrate: [200, 100, 200],
        tag: 'lddm-notification',
        data: { url: data.url || '/' },
        actions: [
            {
                action: 'explore',
                title: 'Voir la liste',
                icon: '/assets/icons/icon192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'LDDM', options)
    );
});

// ─── CLIC SUR LA NOTIFICATION ───
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});