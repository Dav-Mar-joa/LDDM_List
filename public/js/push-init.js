// public/js/push-init.js

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function activerNotifications() {
    const btn = document.getElementById('btn-notif');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.textContent = '❌ Non supporté sur ce navigateur';
        return;
    }

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
        btn.textContent = '⏳ Activation...';
        btn.disabled = true;

        const registration = await navigator.serviceWorker.ready;
        const { key } = await fetch('/api/vapid-public-key').then(r => r.json());

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key)
        });

        await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription, userName })
        });

        // Mémoriser que c'est activé
        localStorage.setItem('lddm_user', userName);
        localStorage.setItem('lddm_push_accepted', 'true');

        // Cacher le bouton définitivement
        btn.textContent = '✅ Notifications activées !';
        btn.style.backgroundColor = '#25a244';
        btn.style.display = 'none';

    } catch (err) {
        console.error('Erreur activation push :', err);
        btn.textContent = '❌ Erreur, réessaie';
        btn.disabled = false;
        btn.style.backgroundColor = '#dc3545';
        setTimeout(() => {
            btn.textContent = '🔔 Activer les notifications';
            btn.style.backgroundColor = '#00aaff';
        }, 3000);
    }
}

// Au chargement : cacher le bouton si déjà activé
document.addEventListener('DOMContentLoaded', async () => {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;

    // Restaurer le dernier nom sélectionné
    const savedUser = localStorage.getItem('lddm_user');
    const quiSelect = document.getElementById('qui');
    if (savedUser && quiSelect) quiSelect.value = savedUser;

    // Si déjà activé → cacher immédiatement
    if (localStorage.getItem('lddm_push_accepted') === 'true') {
        btn.style.display = 'none';
        return;
    }

    // Sinon afficher le bouton
    btn.style.display = 'block';
});