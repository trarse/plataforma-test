// --- backend/importer.js ---
const mongoose = require('mongoose');

// Array de preguntas (solo una vez)
const ALL_TEST_QUESTIONS = [
    // --- Título Preliminar (20 PREGUNTAS ADICIONALES) ---
    {
        "q": "¿Qué Artículo de la Constitución establece que la soberanía nacional reside en el pueblo español?",
        "opts": ["Artículo 1.1", "Artículo 1.2", "Artículo 2", "Artículo 9.1"],
        "c": "Artículo 1.2",
        "s": "Constitución Española: Título Preliminar",
        "expl": "El Artículo 1.2 de la Constitución Española de 1978 establece textualmente que 'La soberanía nacional reside en el pueblo español, del que emanan los poderes del Estado'.",
        "repetida": false,
        "frecuencia": "Título Preliminar"
    },
    // ... (el resto de tus preguntas) ...
    {
        "q": "La 'Zona de Coexistencia' (no autoriza juegos), ¿a qué velocidad máxima pueden circular los vehículos?",
        "opts": ["A 10 km/h.", "A 20 km/h.", "A 30 km/h.", "A 50 km/h."],
        "c": "A 20 km/h.",
        "s": "Tema 15: Reglamento General de Circulación",
        "expl": "En la Zona de Coexistencia (donde conviven vehículos y peatones, pero no se autorizan juegos) el límite es 20 km/h [124, 125].",
        "repetida": true,
        "frecuencia": "Señalización"
    }
];

const MONGO_URI = 'mongodb://localhost:27017/oposicion_test';

const QuestionSchema = new mongoose.Schema({
    q: String, opts: [String], c: String, s: String, expl: String, repetida: Boolean, frecuencia: String
});
// Evita redeclarar el modelo si ya existe
const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

const importData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Conectado a MongoDB para importar...');
        await Question.deleteMany({});
        console.log('Preguntas antiguas eliminadas.');
        await Question.insertMany(ALL_TEST_QUESTIONS);
        console.log('✅ ¡Datos importados con éxito!');
        process.exit();
    } catch (error) {
        console.error('❌ Error durante la importación:', error);
        process.exit(1);
    }
};

importData();