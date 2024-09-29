function updateClock() {
    const clock = document.getElementById('clock');
    const now = new Date();

    // Récupération de l'heure, des minutes et des secondes
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    // Ajouter un zéro devant les chiffres si nécessaire
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    // Mettre à jour l'affichage
    clock.textContent = `${hours}:${minutes}:${seconds}`;
}

// Mettre à jour l'horloge toutes les secondes
setInterval(updateClock, 1000);

// Appeler la fonction immédiatement pour ne pas attendre 1 seconde avant la première mise à jour
updateClock();
