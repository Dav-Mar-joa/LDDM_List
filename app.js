const express = require('express');
const path = require('path');
require('dotenv').config();
const bodyParser = require('body-parser');
const webpush = require('web-push');

const { MongoClient, ObjectId } = require('mongodb');

const app = express();

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

// Config Web Push
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Envoyer un push à tous les abonnés sauf l'auteur
async function sendPushToAll(payload, excludeUser = null) {
    try {
        const subs = await db.collection('pushSubscriptions')
            .find(excludeUser ? { userName: { $ne: excludeUser } } : {})
            .toArray();

        const promises = subs.map(doc =>
            webpush.sendNotification(doc.subscription, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        db.collection('pushSubscriptions').deleteOne({ _id: doc._id });
                    }
                })
        );
        await Promise.all(promises);
    } catch (err) {
        console.error('Erreur envoi push :', err);
    }
}

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ─────────────────────────────────────────────
// WEB PUSH
// ─────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', async (req, res) => {
    const { subscription, userName } = req.body;
    if (!subscription || !userName) {
        return res.status(400).json({ error: 'Données manquantes' });
    }
    try {
        await db.collection('pushSubscriptions').updateOne(
            { userName },
            { $set: { subscription, userName, updatedAt: new Date() } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// TÂCHES
// ─────────────────────────────────────────────

// Ajouter une tâche
app.post('/', async (req, res) => {
    const dateJ = req.body.date ? new Date(req.body.date) : new Date();
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

        await sendPushToAll({
            title: '📋 Nouvelle tâche ajoutée',
            body: `${task.qui} a ajouté : "${task.name}"`,
            icon: '/icons/icon-192.png',
            url: '/'
        }, task.qui);

        res.redirect('/?success=true');
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la tâche :', err);
        res.status(500).send('Erreur lors de l\'ajout de la tâche');
    }
});

// Supprimer une tâche
app.delete('/delete-task/:id', async (req, res) => {
    const taskId = req.params.id;
    const qui = req.query.qui || 'Quelqu\'un';

    try {
        const collection = db.collection(process.env.MONGODB_COLLECTION);
        const task = await collection.findOne({ _id: new ObjectId(taskId) });
        await collection.deleteOne({ _id: new ObjectId(taskId) });

        if (task) {
            await sendPushToAll({
                title: '🗑️ Tâche supprimée',
                body: `${qui} a supprimé "${task.name}"`,
                icon: '/icons/icon-192.png',
                url: '/'
            }, qui);
        }

        res.status(200).send('Tâche supprimée avec succès');
    } catch (err) {
        console.error('Erreur lors de la suppression de la tâche :', err);
        res.status(500).send('Erreur lors de la suppression de la tâche');
    }
});

// ─────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────

// Ajouter une course
app.post('/Courses', async (req, res) => {
    const course = {
        name: req.body.buy,
        priority2: req.body.priority2
    };

    try {
        const collection = db.collection('Courses');
        await collection.insertOne(course);

        await sendPushToAll({
            title: '🛒 Course ajoutée',
            body: `"${course.name}" a été ajouté à la liste de courses`,
            icon: '/icons/icon-192.png',
            url: '/'
        });

        res.redirect('/?successCourse=true');
    } catch (err) {
        console.error('Erreur lors de l\'ajout de la course :', err);
        res.status(500).send('Erreur lors de l\'ajout de la course');
    }
});

// Modifier une course
app.put('/modify-course/:id', async (req, res) => {
    try {
        const collection = db.collection('Courses');
        const oldCourse = await collection.findOne({ _id: new ObjectId(req.params.id) });

        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { name: req.body.name } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: "Course non trouvée" });
        }

        await sendPushToAll({
            title: '✏️ Course modifiée',
            body: `"${oldCourse?.name}" → "${result.name}"`,
            icon: '/icons/icon-192.png',
            url: '/'
        });

        res.json({ name: result.name });
    } catch (err) {
        console.error("🔥 ERREUR MongoDB :", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Supprimer une course
app.delete('/delete-course/:id', async (req, res) => {
    const courseId = req.params.id;
    const qui = req.query.qui || 'Quelqu\'un';

    try {
        const collection = db.collection('Courses');
        const course = await collection.findOne({ _id: new ObjectId(courseId) });
        await collection.deleteOne({ _id: new ObjectId(courseId) });

        if (course) {
            await sendPushToAll({
                title: '🗑️ Course supprimée',
                body: `${qui} a supprimé "${course.name}"`,
                icon: '/icons/icon-192.png',
                url: '/'
            }, qui);
        }

        res.status(200).send('Course supprimée avec succès');
    } catch (err) {
        console.error('Erreur lors de la suppression de la course :', err);
        res.status(500).send('Erreur lors de la suppression de la course');
    }
});

// ─────────────────────────────────────────────
// AUTRES ROUTES
// ─────────────────────────────────────────────

app.get('/notifications-count', async (req, res) => {
    try {
        const tasksCollection = db.collection(process.env.MONGODB_COLLECTION);
        const coursesCollection = db.collection('Courses');
        const tasksCount = await tasksCollection.countDocuments();
        const coursesCount = await coursesCollection.countDocuments();
        res.json({ count: tasksCount + coursesCount });
    } catch (err) {
        console.error("Erreur lors du comptage des notifications :", err);
        res.status(500).json({ count: 0 });
    }
});

app.get('/', async (req, res) => {
    const success = req.query.success === 'true';
    const successCourse = req.query.successCourse === 'true';

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

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

app.get('/wake', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});