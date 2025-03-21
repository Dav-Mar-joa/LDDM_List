// Fonction pour afficher l'heure et la date
function affichageHeure() {
    let jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    let mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    let date = new Date();
    let hour = date.getHours();
    let min = date.getMinutes();
    let sec = date.getSeconds();
    let day = date.getDay();
    let numberDay = date.getDate();
    let month = date.getMonth();

    hour = hour < 10 ? '0' + hour : hour;
    min = min < 10 ? '0' + min : min;
    sec = sec < 10 ? '0' + sec : sec;

    const clock = `${hour}:${min}:${sec}`;
    const dateDay = `${jours[day]} ${numberDay} ${mois[month]}`;

    // Afficher l'heure et la date
    document.getElementById("heure").innerText = clock;
    document.getElementById("dateJour").innerText = dateDay;
}

// Mise à jour de l'heure toutes les secondes
setInterval(affichageHeure, 1000);

// Fonction pour supprimer une tâche
function deleteTask(button) {
    const taskElement = button.closest('.task');
    const taskId = taskElement.getAttribute('data-task-id');
    
    fetch(`/delete-task/${taskId}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            taskElement.remove();  // Suppression de l'élément DOM après suppression réussie
            // alert("Tâche supprimée avec succès !");
        } else {
            // alert("Échec de la suppression de la tâche.");
        }
    }).catch(error => console.error('Erreur lors de la suppression de la tâche :', error));
}

// Fonction pour supprimer une course
function deleteCourse(button) {
    const courseElement = button.closest('.purchase-item');
    const courseId = courseElement.getAttribute('data-course-id');
    
    fetch(`/delete-course/${courseId}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            courseElement.remove();
            // alert("Course supprimée avec succès !");
        } else {
            // alert("Échec de la suppression de la course.");
        }
    }).catch(error => console.error('Erreur lors de la suppression de la course :', error));
}

// Mise à jour du badge d'application
async function updateBadge() {
    if ('setAppBadge' in navigator) {
        try {
            const response = await fetch('/notifications-count');
            const data = await response.json();
            if (data.count > 0) {
                navigator.setAppBadge(data.count);
            } else {
                navigator.clearAppBadge();
            }
        } catch (error) {
            console.error("Erreur lors de la mise à jour du badge :", error);
        }
    }
}

// Mettre à jour le badge au chargement de la page
document.addEventListener('DOMContentLoaded', updateBadge);

// Mettre à jour le badge après chaque ajout de tâche/course
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
        setTimeout(updateBadge, 1000); // Attendre un peu pour que la tâche/course soit ajoutée
    });
});

function updateTitleBadge(count) {
    if (count > 0) {
        document.title = `(${count}) Tâches du jour`;
    } else {
        document.title = "Tâches du jour";
    }
}

// async function updateBadge() {
//     try {
//         const response = await fetch('/notifications-count');
//         const data = await response.json();
        
//         if ('setAppBadge' in navigator) {
//             if (data.count > 0) {
//                 navigator.setAppBadge(data.count);
//             } else {
//                 navigator.clearAppBadge();
//             }
//         } else {
//             updateTitleBadge(data.count);
//         }
//     } catch (error) {
//         console.error("Erreur lors de la mise à jour du badge :", error);
//     }
// }
if ('setAppBadge' in navigator) {
    async function updateAppBadge(count) {
        try {
            if (count > 0) {
                await navigator.setAppBadge(count);
            } else {
                await navigator.clearAppBadge();
            }
        } catch (error) {
            console.error('Impossible de mettre à jour le badge', error);
        }
    }

    // Exemple d'appel pour mettre à jour le badge avec le nombre de notifications
    fetch('/notifications-count')
        .then(response => response.json())
        .then(data => updateAppBadge(data.count));
}

function updateBadge(count) {
    const badge = document.getElementById("badge");
    if (!badge) return; // Sécurité si l'élément n'existe pas
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = "block";
    } else {
        badge.style.display = "none";
    }
}
