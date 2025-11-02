// --- Importaciones ---
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');

// --- Configuración ---
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; // Eliminamos 'localhost' como opción
const JWT_SECRET = process.env.JWT_SECRET || 'unacontraseñamuysecreta123456';

// --- Conexión a la Base de Datos ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// --- Modelos de Datos ---
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    progress: {
        userStats: { type: Object, default: {} },
        markedQuestions: { type: [String], default: [] },
        incorrectQuestions: { type: [String], default: [] },
        // --- CORRECCIÓN ---
        // Se modifica examHistory para guardar solo los IDs de las preguntas, no los objetos completos.
        examHistory: [{
            date: String,
            score: String,
            correct: Number,
            incorrect: Number,
            time: String,
            questionIds: { type: [String], default: [] }, // Cambiado de 'questions' a 'questionIds' y tipo a [String]
            userAnswers: { type: Object, default: {} }
        }],
        achievements: { type: [String], default: [] },
        savedUserStats: { type: Object, default: null },
        lastDailyChallenge: { type: String, default: '' },
        inProgressTest: { type: Object, default: null } 
    }
});
const User = mongoose.model('User', UserSchema);

const QuestionSchema = new mongoose.Schema({
    q: { type: String, required: true },
    opts: { type: [String], required: true },
    c: { type: String, required: true },
    s: { type: String, required: true },
    expl: { type: String, default: 'No disponible.' },
    repetida: { type: Boolean, default: false },
    frecuencia: { type: String }
});
const Question = mongoose.model('Question', QuestionSchema);

// --- Middlewares (sin cambios) ---
const authMiddleware = (req, res, next) => { /* ... */ };
const adminMiddleware = async (req, res, next) => { /* ... */ };

// --- RUTAS API (sin cambios) ---
app.post('/api/register', async (req, res) => { /* ... */ });
app.post('/api/login', async (req, res) => { /* ... */ });
app.get('/api/progress', authMiddleware, async (req, res) => { /* ... */ });
app.put('/api/progress', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/questions/upload', authMiddleware, adminMiddleware, upload.single('questionsFile'), async (req, res) => { /* ... */ });
app.get('/api/questions', authMiddleware, async (req, res) => { /* ... */ });
app.put('/api/questions/:id', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/questions/:id', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });

// --- Iniciar el servidor (sin cambios) ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});

// --- CONTENIDO COMPLETO DE MIDDLEWARES Y RUTAS PARA COPIAR Y PEGAR ---
const authMiddleware_full = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).send({ error: 'Acceso denegado.' });
    try {
        req.userId = jwt.verify(token, JWT_SECRET).userId;
        next();
    } catch (error) {
        res.status(400).send({ error: 'Token inválido.' });
    }
};
app.use('/api/progress', authMiddleware_full);
app.use('/api/questions', authMiddleware_full);

const adminMiddleware_full = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (user && user.role === 'admin') {
            next();
        } else {
            res.status(403).send({ error: 'Acceso denegado. Se requiere rol de administrador.' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Error del servidor.' });
    }
};
app.use('/api/questions/upload', adminMiddleware_full);
app.use('/api/questions/:id', adminMiddleware_full);


app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).send({ error: 'El email ya está en uso.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();
        res.status(201).send({ message: 'Usuario registrado con éxito.' });
    } catch (error) {
        res.status(500).send({ error: 'Error en el servidor.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(400).send({ error: 'Credenciales inválidas.' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.send({ token, role: user.role });
    } catch (error) {
        res.status(500).send({ error: 'Error en el servidor.' });
    }
});

app.get('/api/progress', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('progress');
        res.send(user.progress);
    } catch (error) {
        res.status(500).send({ error: 'Error al obtener el progreso.' });
    }
});

app.put('/api/progress', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $set: { progress: req.body } });
        res.send({ message: 'Progreso guardado con éxito.' });
    } catch (error) {
        res.status(500).send({ error: 'Error al guardar el progreso.' });
    }
});

app.post('/api/questions/upload', upload.single('questionsFile'), async (req, res) => {
    if (!req.file) return res.status(400).send({ error: 'No se ha subido ningún archivo.' });
    try {
        const newQuestions = JSON.parse(req.file.buffer.toString('utf8'));
        if (!Array.isArray(newQuestions)) return res.status(400).send({ error: 'El JSON debe ser un array de preguntas.' });
        
        const result = await Question.insertMany(newQuestions, { ordered: false });
        res.status(201).send({ message: `${result.length} preguntas han sido añadidas con éxito.` });
    } catch (error) {
        if (error instanceof SyntaxError) return res.status(400).send({ error: 'El archivo no es un JSON válido.' });
        res.status(500).send({ error: 'Error al procesar las preguntas.', details: error.message });
    }
});

app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find({});
        res.send(questions);
    } catch (error) {
        res.status(500).send({ error: 'Error al obtener las preguntas.' });
    }
});

app.put('/api/questions/:id', async (req, res) => {
    try {
        const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!question) return res.status(404).send({ error: 'Pregunta no encontrada.' });
        res.send({ message: 'Pregunta actualizada con éxito.', question });
    } catch (error) {
        res.status(500).send({ error: 'Error al actualizar la pregunta.' });
    }
});

app.delete('/api/questions/:id', async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        if (!question) return res.status(404).send({ error: 'Pregunta no encontrada.' });
        res.send({ message: 'Pregunta eliminada con éxito.' });
    } catch (error) {
        res.status(500).send({ error: 'Error al eliminar la pregunta.' });
    }
});
