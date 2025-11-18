const express = require('express');
const path = require('path');
require('dotenv').config();
const bodyParser = require('body-parser');

const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// Connexion à MongoDB
// const connectionString = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}`;
const connectionString = process.env.MONGODB_URI;
const client = new MongoClient(connectionString);
const dbName = process.env.MONGODB_DBNAME;

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('Connecté à la base de données MongoDB');
    } catch (err) {
        console.error('Erreur de connexion à la base de données :', err);
    }
}

connectDB();

// Définir Pug comme moteur de vues
app.set('view engine', 'pug');

// Définir le chemin du dossier 'views'
app.set('views', path.join(__dirname, 'views'));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser les données du formulaire
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Route pour soumettre des tâches
app.post('/', async (req, res) => {
    const dateJ = req.body.date ? new Date(req.body.date) : new Date()
    const task = {
        name: req.body.task,
        date: dateJ,
        description: req.body.description,
        priority: req.body.priority,
        qui: req.body.qui
    };

    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        await collection.insertOne(task);
        res.redirect('/?success=true'); // Redirection avec un paramètre de succès
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la tâche :', err);
        res.status(500).send('Erreur lors de l\'ajout de la tâche');
    }
});

app.post('/Courses', async (req, res) => {
    const course = {
        name: req.body.buy,
        priority2: req.body.priority2
    };

    try {
        const collection = db.collection('Courses'); // Utiliser la collection "courses"
        await collection.insertOne(course);
        res.redirect('/?successCourse=true'); // Redirection avec un paramètre de succès pour les courses
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la course :', err);
        res.status(500).send('Erreur lors de l\'ajout de la course');
    }
});
// Route pour récupérer le nombre de tâches et courses non complétées
app.get('/notifications-count', async (req, res) => {
    try {
        const tasksCollection = db.collection(process.env.MONGODB_COLLECTION);
        const coursesCollection = db.collection('Courses');

        const tasksCount = await tasksCollection.countDocuments();
        const coursesCount = await coursesCollection.countDocuments();

        res.json({ count: tasksCount + coursesCount }); // Envoie le total des tâches/courses
    } catch (err) {
        console.error("Erreur lors du comptage des notifications :", err);
        res.status(500).json({ count: 0 });
    }
});

// Route pour la page d'accueil
app.get('/', async (req, res) => {
    const success = req.query.success === 'true'; // Vérification du paramètre de succès
    const successCourse = req.query.successCourse === 'true';
     

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        console.log('Today:', today);
        console.log('Tomorrow:', tomorrow);

        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const collectionCourses = db.collection('Courses');
        const tasks = await collection.find({}).sort({ date: -1 }).toArray();
        const courses = await collectionCourses.find({}).toArray();
        tasks.forEach(task => {
          console.log('Original Date:', task.date.toString().slice(0, 10));
          
        });

        res.render('index', { 
            title: 'Mon site', 
            message: 'Bienvenue sur ma montre digitale', 
            tasks: tasks || [], 
            courses: courses || [],
            successCourse,
            success 
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des tâches :', err);
        res.status(500).send('Erreur lors de la récupération des tâches');
    }
});
app.delete('/delete-task/:id', async (req, res) => {
    const taskId = req.params.id;
    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        await collection.deleteOne({ _id: new ObjectId(taskId) });
        res.status(200).send('Tâche supprimée avec succès');
    } catch (err) {
        console.error('Erreur lors de la suppression de la tâche :', err);
        res.status(500).send('Erreur lors de la suppression de la tâche');
    }
});
app.put('/modify-course/:id', async (req, res) => {
    console.log("=== PUT /modify-course CALLED ===");
    console.log("ID reçu :", req.params.id);
    console.log("BODY reçu :", req.body);

    try {
        const collection = db.collection('Courses');

        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },  
            { $set: { name: req.body.name } },     
            { returnDocument: 'after' }            
        );

        console.log("Result VALUE :", result);

        if (!result) {
            return res.status(404).json({ error: "Course non trouvée" });
        }
        console.log("bonjour")
        console.log("UPDATED :", result);
        
        // renvoyer uniquement ce qui est utile au front
        res.json({ 
     // toujours string pour le front
    name: result.name 
});
    } catch (err) {
        console.error("🔥 ERREUR MongoDB :", err.message);
        res.status(500).json({ error: err.message });
    }
});
app.delete('/delete-course/:id', async (req, res) => {
    const courseId = req.params.id;
    try {
        const collection = db.collection('Courses');
        await collection.deleteOne({ _id: new ObjectId(courseId) });
        res.status(200).send('Course supprimée avec succès');
    } catch (err) {
        console.error('Erreur lors de la suppression de la course :', err);
        res.status(500).send('Erreur lors de la suppression de la course');
    }
})
// Démarrer le serveur sur le port spécifié dans .env ou sur 4000 par défaut
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
