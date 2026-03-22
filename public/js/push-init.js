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

    console.log("dans inti notif");

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

        // Feedback visuel → puis le bouton disparaît en fondu
        btn.textContent = '✅ Notifications activées !';
        btn.style.backgroundColor = '#25a244';
        btn.disabled = true;

        setTimeout(() => {
            btn.style.transition = 'opacity 0.6s ease, max-height 0.6s ease, padding 0.6s ease, margin 0.6s ease';
            btn.style.opacity = '0';
            btn.style.maxHeight = '0';
            btn.style.padding = '0';
            btn.style.margin = '0';
            btn.style.overflow = 'hidden';
            setTimeout(() => btn.remove(), 700);
        }, 1500);

    } catch (err) {
        console.error('Erreur activation push :', err);
        btn.textContent = '❌ Erreur, réessaie';
        setTimeout(() => {
            btn.textContent = '🔔 Activer les notifications';
            btn.style.backgroundColor = '#00aaff';
        }, 3000);
    }
}

// // Au chargement : vérifier si déjà abonné → cacher le bouton
// document.addEventListener('DOMContentLoaded', async () => {
//     const btn = document.getElementById('btn-notif');
//     if (!btn) return;

//     // Restaurer le dernier nom sélectionné dans "Qui ?"
//     const savedUser = localStorage.getItem('lddm_user');
//     const quiSelect = document.getElementById('qui');
//     if (savedUser && quiSelect) quiSelect.value = savedUser;

//     // Si déjà abonné → supprimer le bouton silencieusement
//     if ('serviceWorker' in navigator && 'PushManager' in window) {
//         try {
//             const registration = await navigator.serviceWorker.ready;
//             const existing = await registration.pushManager.getSubscription();
//             if (existing && localStorage.getItem('lddm_push_accepted') === 'true') {
//                 btn.remove();
//                 return;
//             }
//         } catch (e) { /* silencieux */ }
//     }

//     // Sinon afficher le bouton
//     btn.style.display = 'block';
// });

document.addEventListener('DOMContentLoaded', async () => {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;

    // Restaurer le dernier nom sélectionné dans "Qui ?"
    const savedUser = localStorage.getItem('lddm_user');
    const quiSelect = document.getElementById('qui');
    if (savedUser && quiSelect) quiSelect.value = savedUser;

    // Afficher le bouton immédiatement
    btn.style.display = 'block';

    // Vérifier en arrière-plan si déjà abonné → cacher le bouton
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            if (existing && localStorage.getItem('lddm_push_accepted') === 'true') {
                btn.remove();
            }
        } catch (e) { /* silencieux */ }
    }
});
