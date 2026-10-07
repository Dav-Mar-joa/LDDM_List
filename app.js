const express = require('express');
const path = require('path');
require('dotenv').config();
const webpush = require('web-push');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

const client = new MongoClient(process.env.MONGODB_URI);
const dbName = process.env.MONGODB_DBNAME;
let db;

const tasksCol = () => db.collection(process.env.MONGODB_COLLECTION);
const coursesCol = () => db.collection('Courses');

async function connectDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('Connecté à la base de données MongoDB');
    } catch (err) {
        console.error('Erreur de connexion à la base de données :', err);
        process.exit(1);
    }
}

// ─────────────────────────────────────────────
// WEB PUSH
// ─────────────────────────────────────────────
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Envoie un push à tous les abonnés, sauf à la personne qui a fait l'action
async function sendPushToAll(payload, excludeUser = null) {
    try {
        const subs = await db.collection('pushSubscriptions')
            .find(excludeUser ? { userName: { $ne: excludeUser } } : {})
            .toArray();

        await Promise.all(subs.map(doc =>
            webpush.sendNotification(doc.subscription, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        db.collection('pushSubscriptions').deleteOne({ _id: doc._id });
                    }
                })
        ));
    } catch (err) {
        console.error('Erreur envoi push :', err);
    }
}

const ICON = '/assets/icons/icon192.png';

// ─────────────────────────────────────────────
// MIDDLEWARES & HELPERS
// ─────────────────────────────────────────────
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

const PRIORITIES = ['haute', 'moyenne', 'faible'];
const PEOPLE = ['Lola', 'David', 'Les 2'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const wrap = fn => (req, res) =>
    fn(req, res).catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    });

function getId(req, res) {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        res.status(400).json({ error: 'Identifiant invalide' });
        return null;
    }
    return new ObjectId(req.params.id);
}

// Nettoie et valide les données d'une tâche
function parseTask(body = {}) {
    const name = str(body.name, 200);
    if (!name) return null;
    let date = null;
    if (body.date) {
        const d = new Date(body.date);
        if (!isNaN(d)) date = d;
    }
    return {
        name,
        date,
        description: str(body.description, 2000),
        priority: PRIORITIES.includes(body.priority) ? body.priority : '',
        qui: PEOPLE.includes(body.qui) ? body.qui : ''
    };
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// Un abonnement par appareil (clé = endpoint), pour qu'une même personne
// puisse recevoir les notifications sur son téléphone ET son PC
app.post('/api/subscribe', wrap(async (req, res) => {
    const { subscription, userName } = req.body;
    if (!subscription?.endpoint || !userName) {
        return res.status(400).json({ error: 'Données manquantes' });
    }
    await db.collection('pushSubscriptions').updateOne(
        { 'subscription.endpoint': subscription.endpoint },
        { $set: { subscription, userName: str(userName, 40), updatedAt: new Date() } },
        { upsert: true }
    );
    res.json({ success: true });
}));

// État complet (utilisé au rafraîchissement automatique)
app.get('/api/state', wrap(async (req, res) => {
    const [tasks, courses] = await Promise.all([
        tasksCol().find({}).sort({ date: 1 }).toArray(),
        coursesCol().find({}).sort({ _id: 1 }).toArray()
    ]);
    res.json({ tasks, courses });
}));

// ── Tâches ──
app.post('/api/tasks', wrap(async (req, res) => {
    const task = parseTask(req.body);
    if (!task) return res.status(400).json({ error: 'Le titre est obligatoire' });

    const doc = { ...task, date: task.date || new Date(), done: false, createdAt: new Date() };
    const { insertedId } = await tasksCol().insertOne(doc);

    const by = str(req.body.by, 40) || doc.qui;
    await sendPushToAll({
        title: '📋 Nouvelle tâche',
        body: `${by ? by + ' a ajouté' : 'Ajout'} : « ${doc.name} »`,
        icon: ICON, url: '/'
    }, by);

    res.status(201).json({ ...doc, _id: insertedId });
}));

app.put('/api/tasks/:id', wrap(async (req, res) => {
    const _id = getId(req, res); if (!_id) return;
    const task = parseTask(req.body);
    if (!task) return res.status(400).json({ error: 'Le titre est obligatoire' });

    const $set = { ...task, updatedAt: new Date() };
    if (!$set.date) delete $set.date; // on conserve l'ancienne date si aucune n'est fournie

    const updated = await tasksCol().findOneAndUpdate({ _id }, { $set }, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ error: 'Tâche introuvable' });

    const by = str(req.body.by, 40);
    await sendPushToAll({
        title: '✏️ Tâche modifiée',
        body: `${by ? by + ' a modifié' : 'Modifiée'} : « ${updated.name} »`,
        icon: ICON, url: '/'
    }, by);

    res.json(updated);
}));

app.patch('/api/tasks/:id/done', wrap(async (req, res) => {
    const _id = getId(req, res); if (!_id) return;
    const done = req.body.done === true;
    const updated = await tasksCol().findOneAndUpdate(
        { _id }, { $set: { done, updatedAt: new Date() } }, { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Tâche introuvable' });

    if (done) {
        const by = str(req.body.by, 40);
        await sendPushToAll({
            title: '✅ Tâche terminée',
            body: `${by ? by + ' a terminé' : 'Terminée'} : « ${updated.name} »`,
            icon: ICON, url: '/'
        }, by);
    }
    res.json(updated);
}));

app.delete('/api/tasks/:id', wrap(async (req, res) => {
    const _id = getId(req, res); if (!_id) return;
    const by = str(req.query.qui, 40);
    const task = await tasksCol().findOneAndDelete({ _id });
    if (task) {
        await sendPushToAll({
            title: '🗑️ Tâche supprimée',
            body: `${by || 'Quelqu\'un'} a supprimé « ${task.name} »`,
            icon: ICON, url: '/'
        }, by);
    }
    res.json({ success: true });
}));

// ── Courses ──
app.post('/api/courses', wrap(async (req, res) => {
    const name = str(req.body.name, 200);
    if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' });

    const doc = { name, checked: false, createdAt: new Date() };
    const { insertedId } = await coursesCol().insertOne(doc);

    const by = str(req.body.by, 40);
    await sendPushToAll({
        title: '🛒 Course ajoutée',
        body: `« ${name} » a été ajouté à la liste`,
        icon: ICON, url: '/'
    }, by);

    res.status(201).json({ ...doc, _id: insertedId });
}));

app.put('/api/courses/:id', wrap(async (req, res) => {
    const _id = getId(req, res); if (!_id) return;
    const name = str(req.body.name, 200);
    if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' });

    const old = await coursesCol().findOne({ _id });
    const updated = await coursesCol().findOneAndUpdate(
        { _id }, { $set: { name, updatedAt: new Date() } }, { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Course introuvable' });

    await sendPushToAll({
        title: '✏️ Course modifiée',
        body: `« ${old?.name} » → « ${updated.name} »`,
        icon: ICON, url: '/'
    }, str(req.body.by, 40));

    res.json(updated);
}));

app.patch('/api/courses/:id/checked', wrap(async (req, res) => {
    const _id = getId(req, res); if (!_id) return;
    const updated = await coursesCol().findOneAndUpdate(
        { _id }, { $set: { checked: req.body.checked === true } }, { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Course introuvable' });
    res.json(updated);
}));

app.delete('/api/courses/:id', wrap(async (req, res) => {
    const _id = getId(req, res); if (!_id) return;
    const by = str(req.query.qui, 40);
    const course = await coursesCol().findOneAndDelete({ _id });
    if (course) {
        await sendPushToAll({
            title: '🗑️ Course supprimée',
            body: `${by || 'Quelqu\'un'} a supprimé « ${course.name} »`,
            icon: ICON, url: '/'
        }, by);
    }
    res.json({ success: true });
}));

// Supprime toutes les courses cochées
app.delete('/api/courses', wrap(async (req, res) => {
    const { deletedCount } = await coursesCol().deleteMany({ checked: true });
    res.json({ deletedCount });
}));

// ─────────────────────────────────────────────
// PAGES & DIVERS
// ─────────────────────────────────────────────

// Compteur pour le badge de l'application (tâches à faire + courses à acheter)
app.get('/notifications-count', wrap(async (req, res) => {
    const [t, c] = await Promise.all([
        tasksCol().countDocuments({ done: { $ne: true } }),
        coursesCol().countDocuments({ checked: { $ne: true } })
    ]);
    res.json({ count: t + c });
}));

app.get('/', async (req, res) => {
    try {
        const [tasks, courses] = await Promise.all([
            tasksCol().find({}).sort({ date: 1 }).toArray(),
            coursesCol().find({}).sort({ _id: 1 }).toArray()
        ]);
        // Données initiales injectées dans la page (< échappé pour éviter toute injection)
        const initialData = JSON.stringify({ tasks, courses }).replace(/</g, '\\u003c');
        res.render('index', { initialData });
    } catch (err) {
        console.error('Erreur lors du chargement de la page :', err);
        res.status(500).send('Erreur lors du chargement de la page');
    }
});

app.get('/wake', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
connectDB().then(() => {
    app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
});
