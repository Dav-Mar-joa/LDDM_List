self.addEventListener('install', function(event) {
    event.waitUntil(
      caches.open('v1').then(function(cache) {
        return cache.addAll([
          '/',
          '/index.html',
          '/assets/css/styles.css',
          '/assets/icons/icon192.png',
          '/assets/icons/icon512.png'
        ]);
      })
    );
  });
  
  self.addEventListener('fetch', function(event) {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request);
      })
    );
  });

  // Ajouter un événement pour envoyer un message à la page principale
self.addEventListener('message', function(event) {
  if (event.data.action === 'updateBadge') {
    // Ajoutez ici la logique pour calculer le nombre de tâches non lues ou autres données
    const numberOfTasks = 5; // Exemple, remplacez par votre logique pour obtenir ce nombre

    // Envoyer un message au client pour mettre à jour le badge
    event.ports[0].postMessage({ action: 'setBadge', count: numberOfTasks });
  }
});

self.addEventListener('push', function(event) {
  var options = {
    body: event.data ? event.data.text() : 'Notification par défaut',
    icon: '/assets/icons/icon192.png',
    badge: '/assets/icons/icon192.png', // Le badge qui apparaîtra sur l'icône
    vibrate: [200, 100, 200],
    tag: 'task-notification',
    actions: [
      {
        action: 'explore',
        title: 'Voir les tâches',
        icon: '/assets/icons/icon192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Nouvelle Tâche', options)
  );
});
  