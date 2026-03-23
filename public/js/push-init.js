// public/js/push-init.js

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function saveSubscription(subscription, userName) {
    await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userName })
    });
}

async function activerNotifications() {
    const btn = document.getElementById('btn-notif');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.textContent = '❌ Non supporté sur ce navigateur';
        return;
    }

    // Récupérer le nom dans le select "Qui ?"
    const quiSelect = document.getElementById('qui');
    const userName = quiSelect?.value || localStorage.getItem('lddm_user') || '';

    if (!userName) {
        btn.textContent = '⚠️ Choisis ton nom d\'abord !';
        btn.style.backgroundColor = '#e67e22';
        setTimeout(() => {
            btn.textContent = '🔔 Activer les notifications';
            btn.style.backgroundColor = '#00aaff';
        }, 2500);
        return;
    }

    // Demander la permission système
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        btn.textContent = '🔕 Permission refusée';
        btn.style.backgroundColor = '#666';
        setTimeout(() => {
            btn.textContent = '🔔 Activer les notifications';
            btn.style.backgroundColor = '#00aaff';
        }, 3000);
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const { key } = await fetch('/api/vapid-public-key').then(r => r.json());

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key)
        });

        await saveSubscription(subscription, userName);

        // Mémoriser localement
        localStorage.setItem('lddm_user', userName);
        localStorage.setItem('lddm_push_accepted', 'true');

        // Feedback visuel vert puis cacher
        btn.textContent = '✅ Notifications activées !';
        btn.style.backgroundColor = '#25a244';
        btn.disabled = true;
        btn.style.display = 'none';

    } catch (err) {
        console.error('Erreur activation push :', err);
        alert('ERREUR: ' + err.message); // ← ajoute cette ligne
        btn.textContent = '❌ Erreur, réessaie';
        btn.disabled = false;
        setTimeout(() => {
            btn.textContent = '🔔 Activer les notifications';
            btn.style.backgroundColor = '#00aaff';
        }, 3000);
    }
}

// Au chargement : vérifier localStorage EN PREMIER avant d'afficher le bouton
document.addEventListener('DOMContentLoaded', async () => {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;

    // Restaurer le dernier nom sélectionné dans "Qui ?"
    const savedUser = localStorage.getItem('lddm_user');
    const quiSelect = document.getElementById('qui');
    if (savedUser && quiSelect) quiSelect.value = savedUser;

    // Si déjà accepté via localStorage → cacher immédiatement sans attendre
    if (localStorage.getItem('lddm_push_accepted') === 'true') {
        btn.style.display = 'none';
        return;
    }

    // Sinon afficher le bouton
    btn.style.display = 'block';
});