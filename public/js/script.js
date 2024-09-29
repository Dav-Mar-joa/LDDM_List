

function affichageHeure(){
    let jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    let mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    let date = new Date()
    let hour = date.getHours()
    let min = date.getMinutes()
    let sec = date.getSeconds()
    let day = date.getDay()
    let numberDay = date.getDate()
    let month = date.getMonth()

    console.log("date "+date)
    console.log("heure "+hour)
    console.log("min "+min)
    console.log("sec "+sec)
    console.log("day "+jours[day])
    console.log("month "+month)
    console.log("number Day "+numberDay)


    hour = hour < 10 ? '0' + hour : hour;
    min = min < 10 ? '0'+min : min;
    sec = sec < 10 ? '0' + sec : sec

    const clock = hour + ":" +min + ":" + sec
    const dateDay = jours[day] + " "+ numberDay + " " + mois[month]

    console.log("clock"+ clock)
    const heure = document.getElementById("heure")
    heure.innerText = clock

    const dateJour = document.getElementById("dateJour")
    dateJour.innerText = dateDay
}

setInterval(() => {affichageHeure(); }, 1000)

// affichageHeure()

function deleteTask(button) {
    const taskElement = button.closest('.task');
    const taskId = taskElement.getAttribute('data-task-id');
    
    fetch(`/delete-task/${taskId}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            taskElement.remove();  // Suppression de l'élément DOM après suppression réussie
        }
    }).catch(error => console.error('Erreur lors de la suppression de la tâche :', error));
}
function deleteCourse(button) {
    const courseElement = button.closest('.purchase-item');
    const courseId = courseElement.getAttribute('data-course-id');
    
    fetch(`/delete-course/${courseId}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            courseElement.remove();
        }
    }).catch(error => console.error('Erreur lors de la suppression de la course :', error));
}