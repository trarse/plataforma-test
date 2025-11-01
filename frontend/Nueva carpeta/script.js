// =================================================================================
// --- 1. VARIABLES GLOBALES Y DE ESTADO ---
// =================================================================================
let ALL_TEST_QUESTIONS = [];
let currentQuestions = [];
let userAnswers = {};
let currentPage = 0;
const questionsPerPage = 10;
let timerInterval;
let seconds = 0;
let isTimerRunning = false;
let currentTestType = '';
let currentTheme = '';
let isExamMode = false;
let examEndTime;
let userStats = {};
let markedQuestions = [];
let incorrectQuestions = [];
let savedUserStats = null;
let examHistory = [];
let lastDailyChallenge = '';
let authToken = localStorage.getItem('authToken') || null;
const API_URL = 'http://localhost:3000/api';
let examScoreChartInstance = null;
let themeBreakdownChartInstance = null;
let testStateInterval = null;

// =================================================================================
// --- 2. COMUNICACIÓN CON EL SERVIDOR (API) ---
// =================================================================================
async function apiRequest(endpoint, method = 'GET', body = null) { const headers = { 'Content-Type': 'application/json' }; if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; } const config = { method, headers }; if (body) { config.body = JSON.stringify(body); } try { const response = await fetch(`${API_URL}/${endpoint}`, config); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Error en la petición'); } if (response.status === 204 || response.headers.get("content-length") === "0") { return null; } return await response.json(); } catch (error) { console.error(`API Error en ${endpoint}:`, error); const authErrorEl = document.getElementById('auth-error'); if (authErrorEl) authErrorEl.textContent = error.message; return null; } }
async function saveProgressToServer() { if (!authToken) return; const progressPayload = { userStats, markedQuestions, incorrectQuestions, examHistory, savedUserStats, lastDailyChallenge, inProgressTest: null }; await apiRequest('progress', 'PUT', progressPayload); console.log('Progreso guardado en el servidor.'); }
function logout() { authToken = null; localStorage.removeItem('authToken'); localStorage.removeItem('userRole'); location.reload(); }

// =================================================================================
// --- 3. INICIALIZACIÓN DE LA APLICACIÓN ---
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupAuthForm();
    setupUI();
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        document.getElementById('auth-modal-overlay').style.display = 'none';
        loadInitialData();
    } else {
        document.getElementById('auth-modal-overlay').style.display = 'flex';
    }
});

async function loadInitialData() {
    const [progress, questions] = await Promise.all([
        apiRequest('progress'),
        apiRequest('questions')
    ]);

    if (!progress || !questions) {
        logout();
        return;
    }
    
    userStats = progress.userStats || {};
    markedQuestions = progress.markedQuestions || [];
    incorrectQuestions = progress.incorrectQuestions || [];
    examHistory = progress.examHistory || [];
    savedUserStats = progress.savedUserStats || null;
    lastDailyChallenge = progress.lastDailyChallenge || '';
    ALL_TEST_QUESTIONS = questions;
    
    initializeApp();

    if (progress.inProgressTest) {
        showContinueTestModal(progress.inProgressTest);
    }
}

function initializeApp() {
    setupNavigation();
    setupButtons();
    initializeStats();
    generateThemeMenu();
    populateRandomTestSourceCheckboxes();
    updateDailyChallengeStatus();
    setupAdminPanel();
    showSection('inicio');
}

function setupAuthForm() { const form = document.getElementById('auth-form'); const toggleLink = document.getElementById('auth-toggle-link'); const authTitle = document.getElementById('auth-title'); const submitButton = document.getElementById('auth-submit-button'); const toggleText = document.getElementById('auth-toggle-text'); let isLogin = true; const updateForm = () => { authTitle.textContent = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'; submitButton.textContent = isLogin ? 'Entrar' : 'Registrarse'; toggleText.innerHTML = isLogin ? '¿No tienes cuenta? <a href="#" id="auth-toggle-link">Regístrate</a>' : '¿Ya tienes cuenta? <a href="#" id="auth-toggle-link">Inicia Sesión</a>'; const newToggleLink = document.getElementById('auth-toggle-link'); if (newToggleLink) { newToggleLink.addEventListener('click', (ev) => { ev.preventDefault(); isLogin = !isLogin; updateForm(); }); } }; updateForm(); if (form) { form.addEventListener('submit', async (e) => { e.preventDefault(); const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-password').value; const errorEl = document.getElementById('auth-error'); if(errorEl) errorEl.textContent = ''; if (isLogin) { const result = await apiRequest('login', 'POST', { email, password }); if (result && result.token) { authToken = result.token; localStorage.setItem('authToken', authToken); localStorage.setItem('userRole', result.role); location.reload(); } } else { const result = await apiRequest('register', 'POST', { email, password }); if (result) { alert('¡Registro completado! Ahora inicia sesión con tus datos.'); isLogin = true; updateForm(); } } }); } }
function setupAdminPanel() { const adminPanel = document.getElementById('admin-panel'); const userRole = localStorage.getItem('userRole'); if (userRole !== 'admin') { if (adminPanel) adminPanel.style.display = 'none'; return; } if (adminPanel) adminPanel.style.display = 'block'; const uploadInput = document.getElementById('json-upload-input'); const uploadButton = document.getElementById('json-upload-button'); const uploadStatus = document.getElementById('upload-status'); if (uploadButton) { uploadButton.addEventListener('click', async () => { const file = uploadInput.files[0]; if (!file) { alert('Por favor, selecciona un archivo .json primero.'); return; } uploadStatus.textContent = 'Subiendo archivo...'; const formData = new FormData(); formData.append('questionsFile', file); try { const response = await fetch(`${API_URL}/questions/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData }); const result = await response.json(); if (!response.ok) { throw new Error(result.error || 'Error desconocido'); } uploadStatus.textContent = `✅ Éxito: ${result.message}`; alert(`¡Éxito! ${result.message}\nLa página se recargará para incluir las nuevas preguntas.`); location.reload(); } catch (error) { console.error('Error en la subida:', error); uploadStatus.textContent = `❌ Error: ${error.message}`; alert(`Error en la subida: ${error.message}`); } }); } }
function setupUI() { const themeToggle = document.getElementById('theme-toggle'); if (themeToggle) { if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); themeToggle.checked = true; } themeToggle.addEventListener('change', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }); } let currentFontSize = parseFloat(localStorage.getItem('fontSize')) || 16; document.body.style.setProperty('--font-size', `${currentFontSize}px`); const increaseFontBtn = document.getElementById('increase-font'); if (increaseFontBtn) { increaseFontBtn.addEventListener('click', () => { if (currentFontSize < 24) currentFontSize += 1; updateFontSize(); }); } const decreaseFontBtn = document.getElementById('decrease-font'); if (decreaseFontBtn) { decreaseFontBtn.addEventListener('click', () => { if (currentFontSize > 12) currentFontSize -= 1; updateFontSize(); }); } function updateFontSize() { document.body.style.setProperty('--font-size', `${currentFontSize}px`); localStorage.setItem('fontSize', currentFontSize); } }
function setupNavigation() { const sidebar = document.getElementById('sidebar'); const menuToggle = document.getElementById('menu-toggle'); const homeButton = document.getElementById('home-button'); const statsButton = document.getElementById('stats-button'); if (menuToggle && sidebar) { menuToggle.addEventListener('click', () => sidebar.classList.toggle('active')); } if (homeButton) { homeButton.addEventListener('click', () => { clearInterval(testStateInterval); clearInProgressTest(); showSection('inicio'); }); } if (statsButton) { statsButton.addEventListener('click', () => { showSection('estadisticas-tema'); updateThemeStats(); displaySavedProgress(); updateExamHistory(); }); } }
function setupButtons() { const addClickListener = (id, callback) => { const element = document.getElementById(id); if (element) { element.addEventListener('click', callback); } else { console.warn(`Elemento con ID '${id}' no encontrado.`); } }; const addChangeListener = (id, callback) => { const element = document.getElementById(id); if (element) { element.addEventListener('change', callback); } else { console.warn(`Elemento con ID '${id}' no encontrado.`); } }; addClickListener('test-completo-button', loadAllQuestions); addClickListener('repaso-repetidas-button', loadRepeatedQuestions); addClickListener('repaso-marcadas-button', loadMarkedQuestions); addClickListener('repaso-fallos-button', loadIncorrectQuestions); addClickListener('exam-mode-button', startExamMode); addClickListener('start-daily-challenge', startDailyChallenge); addClickListener('search-button', searchQuestions); addClickListener('generar-test-button', generateRandomTest); addClickListener('reset-stats-button', resetAllStats); addClickListener('reset-stats-button-2', resetAllStats); addClickListener('select-all-btn', () => toggleAllCheckboxes(true)); addClickListener('clear-all-btn', () => toggleAllCheckboxes(false)); addClickListener('save-progress-button', saveProgress); addClickListener('delete-saved-progress-button', deleteSavedProgress); addClickListener('export-progress-button', exportProgress); addClickListener('logout-button', logout); addClickListener('back-to-stats-button', () => showSection('estadisticas-tema')); addClickListener('finish-normal-test-button', finishNormalTest); addChangeListener('import-progress-input', importProgress); }

// =================================================================================
// --- 4. LÓGICA DE LA APLICACIÓN ---
// =================================================================================
function generateThemeMenu() {
    const menuList = document.getElementById('menu-list');
    if (!menuList) return;
    menuList.innerHTML = '';

    ['Test Completo', 'Preguntas Más Repetidas'].forEach(text => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = text;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            if (text === 'Test Completo') loadAllQuestions();
            else loadRepeatedQuestions();
        });
        li.appendChild(a);
        menuList.appendChild(li);
    });
    menuList.appendChild(document.createElement('hr'));

    const menuStructure = new Map();
    ALL_TEST_QUESTIONS.forEach(q => {
        const subject = q.s || 'Sin Clasificar';
        const parts = subject.split(':').map(p => p.trim());
        const group = parts.length > 1 ? parts[0] : subject;

        if (!menuStructure.has(group)) {
            menuStructure.set(group, new Set());
        }
        menuStructure.get(group).add(subject);
    });

    const sortedGroups = Array.from(menuStructure.keys()).sort();

    sortedGroups.forEach(group => {
        const topics = Array.from(menuStructure.get(group)).sort();
        
        if (topics.length === 1 && topics[0] === group) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = group;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                loadQuestionsByTheme(group);
            });
            li.appendChild(a);
            menuList.appendChild(li);
        } else {
            const mainTopicLi = document.createElement('li');
            const topicToggle = document.createElement('strong');
            topicToggle.className = 'main-topic-toggle';
            topicToggle.textContent = group;
            const subMenu = document.createElement('ul');
            subMenu.className = 'sub-menu';
            topicToggle.addEventListener('click', () => {
                subMenu.classList.toggle('open');
                topicToggle.classList.toggle('open');
            });

            mainTopicLi.appendChild(topicToggle);

            topics.forEach(fullTopicName => {
                const subLi = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.textContent = fullTopicName.includes(':') ? fullTopicName.split(':')[1].trim() : fullTopicName;
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadQuestionsByTheme(fullTopicName);
                });
                subLi.appendChild(a);
                subMenu.appendChild(subLi);
            });

            mainTopicLi.appendChild(subMenu);
            menuList.appendChild(mainTopicLi);
        }
    });
}
function showSection(sectionId) { document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active')); const activeSection = document.getElementById(sectionId); if (activeSection) activeSection.classList.add('active'); window.scrollTo(0, 0); }
function loadQuestions(questions, title, type, theme = '') { isExamMode = false; currentQuestions = questions; currentTestType = type; currentTheme = theme; userAnswers = {}; startNewTest(title); }
function loadQuestionsByTheme(theme) { const questions = ALL_TEST_QUESTIONS.filter(q => q.s === theme); loadQuestions(questions, `Test: ${theme}`, 'tema', theme); }
function loadAllQuestions() { loadQuestions([...ALL_TEST_QUESTIONS], 'Test Completo', 'completo'); }
function loadMarkedQuestions() { const questions = ALL_TEST_QUESTIONS.filter(q => markedQuestions.includes(q._id)); if (questions.length === 0) return alert('No tienes preguntas marcadas.'); loadQuestions(questions, `Repaso de Preguntas Marcadas (${questions.length})`, 'marcadas'); }
function loadIncorrectQuestions() { const questions = ALL_TEST_QUESTIONS.filter(q => incorrectQuestions.includes(q._id)); if (questions.length === 0) return alert('No tienes preguntas falladas.'); loadQuestions(questions, `Repaso de Preguntas Falladas (${questions.length})`, 'fallos'); }
function loadRepeatedQuestions() { const questions = ALL_TEST_QUESTIONS.filter(q => q.repetida); loadQuestions(questions, `Preguntas Más Repetidas (${questions.length})`, 'repetidas'); }
function startDailyChallenge() { const today = new Date().toISOString().split('T')[0]; const questions = [...ALL_TEST_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, 10); lastDailyChallenge = today; saveProgressToServer(); updateDailyChallengeStatus(); loadQuestions(questions, '🎯 Reto Diario', 'diario'); }
function updateDailyChallengeStatus() { const today = new Date().toISOString().split('T')[0]; const btn = document.getElementById('start-daily-challenge'); const p = document.getElementById('daily-challenge-p'); if (!btn || !p) return; if (lastDailyChallenge === today) { btn.disabled = true; btn.textContent = 'Reto Completado Hoy'; p.textContent = '¡Buen trabajo! Vuelve mañana para un nuevo reto.'; } else { btn.disabled = false; btn.textContent = 'Empezar Reto'; p.textContent = '¡Ponte a prueba con 10 preguntas aleatorias! Una forma rápida de repasar cada día.'; } }
function searchQuestions() { const query = document.getElementById('search-input').value.toLowerCase().trim(); if (query.length < 3) return alert('La búsqueda debe tener al menos 3 caracteres.'); const results = ALL_TEST_QUESTIONS.filter(q => q.q.toLowerCase().includes(query) || (q.expl && q.expl.toLowerCase().includes(query))); if (results.length === 0) return alert(`No se encontraron preguntas para "${query}".`); loadQuestions(results, `Resultados de búsqueda: "${query}" (${results.length})`, 'busqueda'); }
function generateRandomTest() { const numPreguntas = parseInt(document.getElementById('num-preguntas').value); const checkedBoxes = document.querySelectorAll('input[name="random-source"]:checked'); if (checkedBoxes.length === 0 || isNaN(numPreguntas) || numPreguntas < 1) return alert('Selecciona al menos una fuente y un número válido de preguntas.'); let sourceQuestions = new Map(); checkedBoxes.forEach(checkbox => { let questionsFromSource = []; switch (checkbox.value) { case 'all': questionsFromSource = ALL_TEST_QUESTIONS; break; case 'failed': questionsFromSource = ALL_TEST_QUESTIONS.filter(q => incorrectQuestions.includes(q._id)); break; case 'marked': questionsFromSource = ALL_TEST_QUESTIONS.filter(q => markedQuestions.includes(q._id)); break; case 'repeated': questionsFromSource = ALL_TEST_QUESTIONS.filter(q => q.repetida); break; default: questionsFromSource = ALL_TEST_QUESTIONS.filter(q => q.s === checkbox.value); break; } questionsFromSource.forEach(q => { if (!sourceQuestions.has(q._id)) sourceQuestions.set(q._id, q); }); }); let finalSource = Array.from(sourceQuestions.values()); if (finalSource.length === 0) return alert('Las fuentes seleccionadas no contienen preguntas.'); let numFinal = Math.min(numPreguntas, finalSource.length); const questions = finalSource.sort(() => 0.5 - Math.random()).slice(0, numFinal); loadQuestions(questions, `Test Aleatorio (${questions.length} preguntas)`, 'aleatorio'); }
function startNewTest(title) { document.getElementById('test-title').textContent = title; showSection('test-completo'); renderTest(); clearInterval(testStateInterval); testStateInterval = setInterval(saveCurrentTestState, 30000); if (!isExamMode) { startTimer(); if (seconds === 0) resetTimer(); } }
function startExamMode() { if (!confirm('Vas a empezar un simulacro de examen.\nTendrás 90 minutos para 100 preguntas.\nLas preguntas NO se corregirán al instante.\n¿Estás listo?')) return; isExamMode = true; currentQuestions = [...ALL_TEST_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, 100); userAnswers = {}; currentTestType = 'examen'; startNewTest(`Simulacro de Examen (100 preguntas)`); clearInterval(timerInterval); const examDuration = 90 * 60; examEndTime = Date.now() + examDuration * 1000; timerInterval = setInterval(updateCountdown, 1000); updateCountdown(); document.getElementById('timer-display').classList.add('countdown-timer'); }
function updateCountdown() { const remaining = examEndTime - Date.now(); if (remaining <= 0) { clearInterval(timerInterval); document.getElementById('timer-display').innerHTML = '<span>Tiempo: 00:00:00</span>'; alert('¡Tiempo agotado! El examen ha finalizado.'); finishExam(); return; } const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24); const minutes = Math.floor((remaining / 1000 / 60) % 60); const seconds = Math.floor((remaining / 1000) % 60); document.getElementById('timer-display').innerHTML = `<span>Tiempo: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</span>`; }
function finishExam() { isExamMode = false; clearInterval(timerInterval); clearInterval(testStateInterval); document.getElementById('timer-display').classList.remove('countdown-timer'); let correctCount = 0; let incorrectCount = 0; currentQuestions.forEach((q, index) => { const userAnswerIndex = userAnswers[index]; if (userAnswerIndex !== undefined) { const isCorrect = q.opts[userAnswerIndex] === q.c; const theme = q.s; if (isCorrect) { correctCount++; if (userStats.themes[theme]) userStats.themes[theme].correct++; } else { incorrectCount++; if (userStats.themes[theme]) userStats.themes[theme].incorrect++; if (!incorrectQuestions.includes(q._id)) incorrectQuestions.push(q._id); } } }); const totalAnswered = correctCount + incorrectCount; const totalQuestions = currentQuestions.length; const finalNetScore = calculateNetScore(correctCount, incorrectCount, totalQuestions); const timeTaken = examEndTime ? (90 * 60) - Math.floor((examEndTime - Date.now()) / 1000) : seconds; const examResult = { date: new Date().toLocaleString(), score: finalNetScore, correct: correctCount, incorrect: incorrectCount, time: `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`, questionIds: currentQuestions.map(q => q._id), userAnswers: userAnswers }; examHistory.push(examResult); document.getElementById('test-area').innerHTML = ''; document.getElementById('pagination').innerHTML = ''; const resultsPage = document.getElementById('test-results-page'); resultsPage.innerHTML = `<h3>Resultados del Simulacro</h3><div class="stats-container"><div class="stat-card"><h4>Nota Neta</h4><div class="stat-value stat-net-score">${finalNetScore}</div></div><div class="stat-card"><h4>Aciertos</h4><div class="stat-value stat-correct">${correctCount}</div></div><div class="stat-card"><h4>Fallos</h4><div class="stat-value stat-incorrect">${incorrectCount}</div></div><div class="stat-card"><h4>Sin Responder</h4><div class="stat-value">${totalQuestions - totalAnswered}</div></div></div><p style="text-align: center; margin-top: 20px;">El resultado ha sido guardado en tu historial. Puedes revisarlo en la sección de Estadísticas.</p>`; const endButton = document.getElementById('end-exam-button'); if (endButton) endButton.remove(); document.getElementById('check-page-button').style.display = 'none'; document.getElementById('reset-page-button').style.display = 'none'; document.getElementById('finish-normal-test-button').style.display = 'none'; clearInProgressTest(); }
function renderTest() { const testArea = document.getElementById('test-area'); const pagination = document.getElementById('pagination'); testArea.innerHTML = ''; pagination.innerHTML = ''; currentPage = 0; document.getElementById('test-results-page').textContent = ''; document.getElementById('check-page-button').style.display = isExamMode ? 'none' : 'block'; document.getElementById('reset-page-button').style.display = isExamMode ? 'none' : 'block'; document.getElementById('finish-normal-test-button').style.display = isExamMode ? 'none' : 'block'; const controls = document.getElementById('test-controls'); const oldEndButton = document.getElementById('end-exam-button'); if (oldEndButton) oldEndButton.remove(); if (isExamMode) { document.getElementById('check-page-button').style.display = 'none'; document.getElementById('reset-page-button').style.display = 'none'; document.getElementById('finish-normal-test-button').style.display = 'none'; const endExamBtn = document.createElement('button'); endExamBtn.id = 'end-exam-button'; endExamBtn.className = 'control-button'; endExamBtn.textContent = 'FINALIZAR EXAMEN Y CORREGIR'; endExamBtn.addEventListener('click', () => { if (confirm('¿Seguro que quieres finalizar el examen? Se corregirá con las respuestas que hayas marcado.')) { finishExam(); } }); controls.prepend(endExamBtn); } if (currentQuestions.length === 0) { testArea.innerHTML = '<p>No hay preguntas para este test.</p>'; return; } const totalPages = Math.ceil(currentQuestions.length / questionsPerPage); for (let i = 0; i < totalPages; i++) { const pageDiv = document.createElement('div'); pageDiv.className = 'test-page'; if (i === 0) pageDiv.classList.add('active'); testArea.appendChild(pageDiv); const pageIndicator = document.createElement('span'); pageIndicator.className = 'page-indicator'; if (i === 0) pageIndicator.classList.add('current'); pageIndicator.textContent = i + 1; pageIndicator.addEventListener('click', () => showPage(i)); pagination.appendChild(pageIndicator); } loadPageContent(0); updateCounters(); }
function createQuestionHTML(question, questionIndex) { const originalId = question._id; const questionDiv = document.createElement('div'); questionDiv.className = 'test-question'; questionDiv.id = `question-${questionIndex}`; if (question.repetida) questionDiv.classList.add('repetida-question'); if (markedQuestions.includes(originalId)) questionDiv.classList.add('marked-question'); const isAdmin = localStorage.getItem('userRole') === 'admin'; const adminButtons = isAdmin ? `<div class="admin-question-controls"><button class="edit-btn" data-question-id="${originalId}">Editar</button><button class="delete-btn" data-question-id="${originalId}">Borrar</button></div>` : ''; questionDiv.innerHTML = `${adminButtons}<h3>Pregunta ${questionIndex + 1} ${question.repetida ? '<span class="repetidas-badge">Repetida</span>' : ''}</h3><p>${question.q}</p><div class="test-options">${question.opts.map((opt, optIndex) => `<button data-question-index="${questionIndex}" data-option-index="${optIndex}">${opt}</button>`).join('')}</div><span class="mark-icon" title="Marcar para repasar">${markedQuestions.includes(originalId) ? '🔳' : '🔲'}</span><div class="explanation" id="explanation-${questionIndex}" style="display: none;"></div>`; questionDiv.querySelector('.mark-icon').addEventListener('click', () => toggleMarkQuestion(questionIndex, originalId)); questionDiv.querySelectorAll('.test-options button').forEach(button => { button.addEventListener('click', () => selectOption(button)); }); if (isAdmin) { questionDiv.querySelector('.edit-btn').addEventListener('click', () => openEditModal(originalId)); questionDiv.querySelector('.delete-btn').addEventListener('click', () => deleteQuestion(originalId)); } if (isExamMode && userAnswers[questionIndex] !== undefined) { const selectedBtn = questionDiv.querySelector(`button[data-option-index="${userAnswers[questionIndex]}"]`); if (selectedBtn) selectedBtn.setAttribute('data-selected', 'true'); } return questionDiv; }
function showPage(pageIndex) { if (pageIndex === currentPage) return; document.querySelectorAll('.test-page.active').forEach(p => p.classList.remove('active')); document.querySelectorAll('.page-indicator.current').forEach(p => p.classList.remove('current')); const targetPage = document.querySelector(`.test-page:nth-child(${pageIndex + 1})`); const targetIndicator = document.querySelector(`.page-indicator:nth-child(${pageIndex + 1})`); loadPageContent(pageIndex); targetPage.classList.add('active'); targetIndicator.classList.add('current'); currentPage = pageIndex; if (!isExamMode) updatePageResultsDisplay(); }
function loadPageContent(pageIndex) { const pageDiv = document.querySelector(`.test-page:nth-child(${pageIndex + 1})`); if (pageDiv.innerHTML !== '') return; const startIndex = pageIndex * questionsPerPage; const endIndex = Math.min(startIndex + questionsPerPage, currentQuestions.length); for (let j = startIndex; j < endIndex; j++) { const question = currentQuestions[j]; pageDiv.appendChild(createQuestionHTML(question, j)); } }
function selectOption(button) { const questionIndex = parseInt(button.dataset.questionIndex); const optionButtons = button.parentElement.querySelectorAll('button'); if (isExamMode) { const selectedIndex = parseInt(button.dataset.optionIndex); userAnswers[questionIndex] = selectedIndex; optionButtons.forEach(btn => btn.removeAttribute('data-selected')); button.setAttribute('data-selected', 'true'); updateCounters(); } else { if (optionButtons[0].disabled) return; const selectedIndex = parseInt(button.dataset.optionIndex); const question = currentQuestions[questionIndex]; const originalId = question._id; const theme = question.s; const isCorrect = question.opts[selectedIndex] === question.c; if (!userStats.themes) userStats.themes = {}; if (!userStats.themes[theme]) userStats.themes[theme] = { correct: 0, incorrect: 0 }; if (isCorrect) { userStats.themes[theme].correct++; } else { userStats.themes[theme].incorrect++; if (!incorrectQuestions.includes(originalId)) { incorrectQuestions.push(originalId); } } optionButtons.forEach((optBtn, optIdx) => { if (question.opts[optIdx] === question.c) optBtn.classList.add('correct'); else if (optIdx === selectedIndex) optBtn.classList.add('incorrect'); optBtn.disabled = true; }); userAnswers[questionIndex] = selectedIndex; const explanationDiv = button.closest('.test-question').querySelector('.explanation'); explanationDiv.innerHTML = `<strong>Explicación:</strong> ${question.expl || 'No disponible.'}`; explanationDiv.style.display = 'block'; saveProgressToServer(); updateCounters(); updatePageResultsDisplay(); } }
function toggleMarkQuestion(questionIndex, originalId) { const isMarked = markedQuestions.includes(originalId); if (isMarked) { markedQuestions = markedQuestions.filter(id => id !== originalId); } else { markedQuestions.push(originalId); } const questionDiv = document.getElementById(`question-${questionIndex}`); if (questionDiv) { const markIcon = questionDiv.querySelector('.mark-icon'); if (isMarked) { markIcon.textContent = '🔲'; questionDiv.classList.remove('marked-question'); } else { markIcon.textContent = '🔳'; questionDiv.classList.add('marked-question'); } } saveProgressToServer(); }
function calculateNetScore(correct, incorrect, total, maxScore = 10) { if (total === 0) return "0.00"; const netCorrect = correct - (incorrect / 3); const score = (netCorrect / total) * maxScore; return Math.max(0, score).toFixed(2); }
function startTimer() { if (isTimerRunning && !isExamMode) return; clearInterval(timerInterval); isTimerRunning = true; timerInterval = setInterval(() => { seconds++; updateTimerDisplay(); }, 1000); }
function resetPage() { if (isExamMode) return; const startIndex = currentPage * questionsPerPage; const endIndex = Math.min(startIndex + questionsPerPage, currentQuestions.length); for (let i = startIndex; i < endIndex; i++) { const question = currentQuestions[i]; if (!question) continue; const originalId = question._id; const questionDiv = document.getElementById(`question-${i}`); if (!questionDiv) continue; const theme = question.s; const userAnswerIndex = userAnswers[i]; if (userAnswerIndex !== undefined) { const isCorrect = question.opts[userAnswerIndex] === question.c; if (isCorrect) { userStats.themes[theme].correct--; } else { userStats.themes[theme].incorrect--; const incorrectIdx = incorrectQuestions.indexOf(originalId); if (incorrectIdx > -1) incorrectQuestions.splice(incorrectIdx, 1); } } const optionButtons = questionDiv.querySelectorAll('.test-options button'); optionButtons.forEach(btn => { btn.classList.remove('correct', 'incorrect'); btn.disabled = false; }); const explanationDiv = document.getElementById(`explanation-${i}`); if (explanationDiv) explanationDiv.style.display = 'none'; delete userAnswers[i]; } saveProgressToServer(); updateCounters(); updatePageResultsDisplay(); }
function updateCounters() { const answeredCount = Object.keys(userAnswers).length; document.getElementById('questions-counter').innerHTML = `<span>Preguntas: ${answeredCount}/${currentQuestions.length}</span>`; updateProgressBar(answeredCount, currentQuestions.length); }
function updateProgressBar(answered, total) { const progress = total > 0 ? (answered / total) * 100 : 0; document.getElementById('progress-fill').style.width = `${progress}%`; }
function updatePageResultsDisplay() { if (isExamMode) { document.getElementById('test-results-page').innerHTML = ''; return; } const resultsDiv = document.getElementById('test-results-page'); const startIndex = currentPage * questionsPerPage; const endIndex = Math.min(startIndex + questionsPerPage, currentQuestions.length); let pageCorrect = 0, pageIncorrect = 0, pageAnswered = 0; for (let i = startIndex; i < endIndex; i++) { const questionDiv = document.getElementById(`question-${i}`); if (questionDiv && questionDiv.querySelector('.test-options button:disabled')) { pageAnswered++; if (questionDiv.querySelector('.test-options button.incorrect')) { pageIncorrect++; } else { pageCorrect++; } } } const pageNetScore = calculateNetScore(pageCorrect, pageIncorrect, pageAnswered); let totalCorrect = 0, totalIncorrect = 0; const answeredIndices = Object.keys(userAnswers); const totalAnswered = answeredIndices.length; answeredIndices.forEach(questionIndex => { const question = currentQuestions[parseInt(questionIndex)]; const userAnswerIndex = userAnswers[questionIndex]; if (question && userAnswerIndex !== undefined) { if (question.opts[userAnswerIndex] === question.c) { totalCorrect++; } else { totalIncorrect++; } } }); const totalNetScore = calculateNetScore(totalCorrect, totalIncorrect, totalAnswered); resultsDiv.innerHTML = `<strong>Resultados de la Página:</strong> <span class="stat-correct">Aciertos: ${pageCorrect}</span> | <span class="stat-incorrect">Fallos: ${pageIncorrect}</span> | <strong>Nota: ${pageNetScore}</strong><hr style="margin: 5px 0;"><strong>Resultados Totales del Test:</strong> <span class="stat-correct">Aciertos: ${totalCorrect}</span> | <span class="stat-incorrect">Fallos: ${totalIncorrect}</span> (${totalAnswered}/${currentQuestions.length} respondidas) | <strong>Nota: ${totalNetScore}</strong>`; }
function resetTimer() { if (isExamMode) return; seconds = 0; updateTimerDisplay(); }
function updateTimerDisplay() { const minutes = Math.floor(seconds / 60); const remSeconds = seconds % 60; const timerContent = `<span>Tiempo: ${String(minutes).padStart(2, '0')}:${String(remSeconds).padStart(2, '0')}</span>`; const resetButtonHTML = `<button id="reset-timer-button" class="control-button" style="padding: 5px 10px; font-size: 0.8em;">🔄 Reiniciar</button>`; const timerDisplay = document.getElementById('timer-display'); if(timerDisplay) { timerDisplay.innerHTML = timerContent + resetButtonHTML; const resetButton = timerDisplay.querySelector('#reset-timer-button'); if (resetButton) { resetButton.addEventListener('click', resetTimer); } } }
function initializeStats() { if (!userStats.themes) userStats.themes = {}; const simplifiedThemes = [...new Set(ALL_TEST_QUESTIONS.map(q => q.s))]; simplifiedThemes.forEach(theme => { if (!userStats.themes[theme]) { userStats.themes[theme] = { correct: 0, incorrect: 0 }; } }); }
function resetAllStats() { if (confirm('¿Estás seguro de que quieres resetear tus estadísticas actuales? Tu progreso guardado, historial de exámenes y logros NO se borrarán.')) { userStats = {}; markedQuestions = []; incorrectQuestions = []; initializeStats(); saveProgressToServer(); if (document.getElementById('estadisticas-tema').classList.contains('active')) { updateThemeStats(); } alert('Tus estadísticas actuales han sido reseteadas.'); } }
function updateThemeStats() { const container = document.getElementById('theme-stats-container'); const globalContainer = document.getElementById('global-stats-container'); container.innerHTML = ''; globalContainer.innerHTML = ''; if (!userStats.themes) { globalContainer.innerHTML = '<p>No hay estadísticas para mostrar. ¡Empieza a hacer tests!</p>'; return; } let totalC = 0, totalI = 0; Object.keys(userStats.themes).forEach(theme => { const stats = userStats.themes[theme]; totalC += stats.correct; totalI += stats.incorrect; }); const totalAnswered = totalC + totalI; const overallCorrectP = totalAnswered > 0 ? Math.round((totalC / totalAnswered) * 100) : 0; const overallNetScore = calculateNetScore(totalC, totalI, totalAnswered); globalContainer.innerHTML = `<div class="stat-card"><h4>Total Preguntas</h4><div class="stat-value">${ALL_TEST_QUESTIONS.length}</div></div><div class="stat-card"><h4>Total Respondidas</h4><div class="stat-value">${totalAnswered}</div></div><div class="stat-card"><h4>Aciertos</h4><div class="stat-value stat-correct">${totalC}</div></div><div class="stat-card"><h4>Fallos</h4><div class="stat-value stat-incorrect">${totalI}</div></div><div class="stat-card"><h4>% Acierto Global</h4><div class="stat-value stat-correct">${overallCorrectP}%</div></div><div class="stat-card"><h4>Nota Neta Global</h4><div class="stat-value stat-net-score">${overallNetScore}</div></div>`; const menuStructure = new Map(); ALL_TEST_QUESTIONS.forEach(q => { const subject = q.s || 'Sin Clasificar'; const parts = subject.split(':').map(p => p.trim()); const group = parts.length > 1 ? parts[0] : subject; if (!menuStructure.has(group)) { menuStructure.set(group, new Set()); } menuStructure.get(group).add(subject); }); const sortedGroups = Array.from(menuStructure.keys()).sort(); sortedGroups.forEach(group => { const topics = Array.from(menuStructure.get(group)).sort(); let blockCorrect = 0, blockIncorrect = 0, blockTotal = 0; topics.forEach(topic => { const stats = userStats.themes[topic] || { correct: 0, incorrect: 0 }; blockCorrect += stats.correct; blockIncorrect += stats.incorrect; blockTotal += ALL_TEST_QUESTIONS.filter(q => q.s === topic).length; }); const blockAnswered = blockCorrect + blockIncorrect; const blockProgress = blockTotal > 0 ? Math.round((blockAnswered / blockTotal) * 100) : 0; const blockCorrectP = blockAnswered > 0 ? Math.round((blockCorrect / blockAnswered) * 100) : 0; const blockNetScore = calculateNetScore(blockCorrect, blockIncorrect, blockAnswered); const blockContainer = document.createElement('div'); blockContainer.className = 'theme-block-stat'; const blockHeader = document.createElement('div'); blockHeader.className = 'theme-block-header'; blockHeader.innerHTML = `<h3>${group}</h3><div class="theme-stat-progress"><div class="theme-stat-progress-fill" style="width: ${blockProgress}%;"></div></div><div class="theme-stat-details"><span>Progreso: ${blockProgress}%</span><span class="theme-stat-correct">${blockCorrectP}% acierto</span><span class="net-score-value">Nota Bloque: ${blockNetScore}</span></div>`; const subStatsContainer = document.createElement('div'); subStatsContainer.className = 'sub-stats-container'; blockHeader.addEventListener('click', () => { subStatsContainer.classList.toggle('open'); blockHeader.classList.toggle('open'); }); topics.forEach(topic => { const stats = userStats.themes[topic] || { correct: 0, incorrect: 0 }; const totalInTheme = ALL_TEST_QUESTIONS.filter(q => q.s === topic).length; const netScore = calculateNetScore(stats.correct, stats.incorrect, stats.correct + stats.incorrect); subStatsContainer.innerHTML += `<div class="theme-stat-card-inner"><h4>${topic.includes(':') ? topic.split(':')[1].trim() : topic}</h4><div class="theme-stat-details"><span class="theme-stat-correct">A: ${stats.correct}</span><span class="theme-stat-incorrect">F: ${stats.incorrect}</span><span>Total: ${totalInTheme}</span><span class="net-score-value">Nota: ${netScore}</span></div></div>`; }); blockContainer.appendChild(blockHeader); blockContainer.appendChild(subStatsContainer); container.appendChild(blockContainer); }); renderCharts(); }
function saveProgress() { if (confirm('¿Quieres guardar una instantánea de tu progreso actual para compararla en el futuro?')) { savedUserStats = JSON.parse(JSON.stringify(userStats)); saveProgressToServer(); alert('Progreso guardado.'); displaySavedProgress(); } }
function deleteSavedProgress() { if (confirm('¿Estás seguro de que quieres borrar tu progreso guardado? Esta acción no se puede deshacer.')) { savedUserStats = null; saveProgressToServer(); alert('Progreso guardado eliminado.'); displaySavedProgress(); } }
function displaySavedProgress() { const displayDiv = document.getElementById('saved-stats-display'); const deleteBtn = document.getElementById('delete-saved-progress-button'); if (!savedUserStats || !savedUserStats.themes) { displayDiv.innerHTML = '<p>No hay ningún progreso guardado para comparar.</p>'; deleteBtn.style.display = 'none'; return; } deleteBtn.style.display = 'inline-block'; let totalC = 0, totalI = 0; Object.values(savedUserStats.themes).forEach(stats => { totalC += stats.correct; totalI += stats.incorrect; }); const totalAnswered = totalC + totalI; const overallCorrectP = totalAnswered > 0 ? Math.round((totalC / totalAnswered) * 100) : 0; const overallNetScore = calculateNetScore(totalC, totalI, totalAnswered); displayDiv.innerHTML = `<p><strong>Resumen de tu progreso guardado:</strong></p><div class="stats-container"><div class="stat-card"><h4>Respondidas</h4><div class="stat-value">${totalAnswered} / ${ALL_TEST_QUESTIONS.length}</div></div><div class="stat-card"><h4>% Acierto</h4><div class="stat-value stat-correct">${overallCorrectP}%</div></div><div class="stat-card"><h4>Nota Neta</h4><div class="stat-value stat-net-score">${overallNetScore}</div></div></div>`; }
function createCheckbox(container, value, text, name) { const label = document.createElement('label'); label.innerHTML = `<input type="checkbox" name="${name}" value="${value}"> ${text}`; container.appendChild(label); }
function populateRandomTestSourceCheckboxes() { const container = document.getElementById('random-test-source-container'); container.innerHTML = ''; const generalsContainer = document.createElement('div'); generalsContainer.innerHTML = '<strong>Generales</strong>'; createCheckbox(generalsContainer, 'all', 'Todas las preguntas', 'random-source'); createCheckbox(generalsContainer, 'failed', 'Repaso de Fallos', 'random-source'); createCheckbox(generalsContainer, 'marked', 'Repaso de Marcadas', 'random-source'); createCheckbox(generalsContainer, 'repeated', 'Preguntas Repetidas', 'random-source'); container.appendChild(generalsContainer); const menuStructure = new Map(); ALL_TEST_QUESTIONS.forEach(q => { const subject = q.s || 'Sin Clasificar'; const parts = subject.split(':').map(p => p.trim()); const group = parts.length > 1 ? parts[0] : subject; if (!menuStructure.has(group)) { menuStructure.set(group, new Set()); } menuStructure.get(group).add(subject); }); const sortedGroups = Array.from(menuStructure.keys()).sort(); sortedGroups.forEach(group => { const topics = Array.from(menuStructure.get(group)).sort(); const blockContainer = document.createElement('div'); blockContainer.style.marginTop = '15px'; const blockLabel = document.createElement('label'); blockLabel.style.fontWeight = 'bold'; blockLabel.style.color = 'var(--primary-color)'; blockLabel.style.cursor = 'pointer'; const blockCheckbox = document.createElement('input'); blockCheckbox.type = 'checkbox'; blockLabel.appendChild(blockCheckbox); blockLabel.appendChild(document.createTextNode(` ${group}`)); blockContainer.appendChild(blockLabel); blockCheckbox.addEventListener('change', (event) => { const isChecked = event.target.checked; const associatedTopics = Array.from(menuStructure.get(group)); const allThemeCheckboxes = container.querySelectorAll('input[name="random-source"]'); allThemeCheckboxes.forEach(themeCheckbox => { if (associatedTopics.includes(themeCheckbox.value)) { themeCheckbox.checked = isChecked; } }); }); const themesDiv = document.createElement('div'); themesDiv.style.paddingLeft = '25px'; topics.forEach(topic => { const topicName = topic.includes(':') ? topic.split(':')[1].trim() : topic; createCheckbox(themesDiv, topic, topicName, 'random-source'); }); blockContainer.appendChild(themesDiv); container.appendChild(blockContainer); }); }
function toggleAllCheckboxes(state) { document.querySelectorAll('#random-test-source-container input[type="checkbox"]').forEach(cb => cb.checked = state); }
function updateExamHistory() {
    const tbody = document.getElementById('exam-history-body');
    const deleteContainer = document.getElementById('delete-history-container');
    tbody.innerHTML = '';

    if (!examHistory || examHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No has completado ningún simulacro.</td></tr>';
        if (deleteContainer) deleteContainer.style.display = 'none';
        return;
    }

    if (deleteContainer) deleteContainer.style.display = 'block';
    
    const reversedHistory = [...examHistory].reverse();
    
    reversedHistory.forEach((exam, reversedIndex) => {
        const originalIndex = examHistory.length - 1 - reversedIndex;
        const row = `<tr>
            <td><input type="checkbox" class="history-checkbox" data-exam-index="${originalIndex}"></td>
            <td>${exam.date}</td>
            <td>${exam.score}</td>
            <td class="stat-correct">${exam.correct}</td>
            <td class="stat-incorrect">${exam.incorrect}</td>
            <td>${exam.time}</td>
            <td><button class="control-button review-exam-btn" data-exam-index="${originalIndex}">Revisar</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.querySelectorAll('.review-exam-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const examIndex = parseInt(e.target.dataset.examIndex);
            displayExamReview(examHistory[examIndex]);
        });
    });

    const selectAllCheckbox = document.getElementById('select-all-history');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            document.querySelectorAll('.history-checkbox').forEach(cb => cb.checked = e.target.checked);
        });
    }

    const deleteBtn = document.getElementById('delete-history-btn');
    if (deleteBtn) {
        deleteBtn.onclick = deleteSelectedHistory;
    }
}


function deleteSelectedHistory() {
    const checkedBoxes = document.querySelectorAll('.history-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('No has seleccionado ningún simulacro para borrar.');
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres borrar ${checkedBoxes.length} entrada(s) del historial? Esta acción no se puede deshacer.`)) {
        return;
    }

    const indicesToDelete = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.examIndex));
    
    examHistory = examHistory.filter((_, index) => !indicesToDelete.includes(index));

    saveProgressToServer();
    updateExamHistory();
    alert('Las entradas seleccionadas han sido borradas.');
}

// =================================================================================
// --- 5. NUEVAS FUNCIONALIDADES Y CORRECCIONES ---
// =================================================================================
function renderCharts() { if (examScoreChartInstance) examScoreChartInstance.destroy(); if (themeBreakdownChartInstance) themeBreakdownChartInstance.destroy(); const examCtx = document.getElementById('examScoreChart').getContext('2d'); if (examHistory && examHistory.length > 0) { const labels = examHistory.map((_, index) => `Simulacro ${index + 1}`); const data = examHistory.map(exam => parseFloat(exam.score)); examScoreChartInstance = new Chart(examCtx, { type: 'line', data: { labels, datasets: [{ label: 'Nota Neta', data, borderColor: 'var(--primary-color)', backgroundColor: 'rgba(0, 77, 64, 0.2)', fill: true, tension: 0.1 }] }, options: { scales: { y: { beginAtZero: true, max: 10 } } } }); } const themeCtx = document.getElementById('themeBreakdownChart').getContext('2d'); if (userStats && userStats.themes) { const blockData = { labels: [], correct: [], incorrect: [] }; const menuStructure = new Map(); ALL_TEST_QUESTIONS.forEach(q => { const subject = q.s || 'Sin Clasificar'; const parts = subject.split(':').map(p => p.trim()); const group = parts.length > 1 ? parts[0] : subject; if (!menuStructure.has(group)) { menuStructure.set(group, new Set()); } menuStructure.get(group).add(subject); }); const sortedGroups = Array.from(menuStructure.keys()).sort(); sortedGroups.forEach(group => { const topics = Array.from(menuStructure.get(group)); let groupCorrect = 0, groupIncorrect = 0; topics.forEach(topic => { const stats = userStats.themes[topic]; if (stats) { groupCorrect += stats.correct; groupIncorrect += stats.incorrect; } }); if (groupCorrect > 0 || groupIncorrect > 0) { blockData.labels.push(group); blockData.correct.push(groupCorrect); blockData.incorrect.push(groupIncorrect); } }); themeBreakdownChartInstance = new Chart(themeCtx, { type: 'bar', data: { labels: blockData.labels, datasets: [{ label: 'Aciertos', data: blockData.correct, backgroundColor: 'var(--correct-color)' }, { label: 'Fallos', data: blockData.incorrect, backgroundColor: 'var(--error-color)' }] }, options: { scales: { x: { stacked: true }, y: { stacked: true } }, responsive: true } }); } }
function displayExamReview(examData) {
    showSection('exam-review');
    document.getElementById('review-title').textContent = `Revisión del Simulacro (${examData.date})`;
    const reviewArea = document.getElementById('review-area');
    reviewArea.innerHTML = '';
    const questionsMap = new Map(ALL_TEST_QUESTIONS.map(q => [q._id, q]));
    const questionsInExam = examData.questionIds.map(id => questionsMap.get(id)).filter(Boolean);

    questionsInExam.forEach((q, index) => {
        const userAnswerIndex = examData.userAnswers[index];
        const userAnswerText = userAnswerIndex !== undefined ? q.opts[userAnswerIndex] : "Sin responder";
        const isCorrect = userAnswerText === q.c;
        const questionDiv = document.createElement('div');
        questionDiv.className = 'test-question';
        let optionsHTML = q.opts.map((opt, optIdx) => {
            let className = '';
            if (opt === q.c) className = 'correct';
            else if (optIdx === userAnswerIndex) className = 'incorrect';
            return `<button class="${className}" disabled>${opt}</button>`;
        }).join('');

        questionDiv.innerHTML = `
            <h3>Pregunta ${index + 1}</h3> <p>${q.q}</p>
            <div class="test-options">${optionsHTML}</div>
            <div class="explanation" style="display: block;">
                <strong>Tu respuesta:</strong> <span class="${isCorrect ? 'stat-correct' : 'stat-incorrect'}">${userAnswerText}</span><br>
                <strong>Explicación:</strong> ${q.expl || 'No disponible.'}
            </div>`;
        reviewArea.appendChild(questionDiv);
    });
}
function showContinueTestModal(testState) {
    const modal = document.getElementById('continue-test-modal-overlay');
    modal.style.display = 'flex';
    document.getElementById('resume-test-yes').onclick = () => { modal.style.display = 'none'; resumeTest(testState); };
    document.getElementById('resume-test-no').onclick = async () => { modal.style.display = 'none'; await clearInProgressTest(); initializeApp(); };
    document.getElementById('finish-test-now').onclick = async () => { modal.style.display = 'none'; await finishInProgressTest(testState); };
}
async function clearInProgressTest() { const progress = { userStats, markedQuestions, incorrectQuestions, examHistory, savedUserStats, lastDailyChallenge, inProgressTest: null }; await apiRequest('progress', 'PUT', progress); }
function saveCurrentTestState() { if (!currentQuestions.length || !document.getElementById('test-completo').classList.contains('active')) return; const testState = { questionIds: currentQuestions.map(q => q._id), userAnswers: userAnswers, seconds: seconds, testType: currentTestType, theme: currentTheme, title: document.getElementById('test-title').textContent, isExamMode: isExamMode, examEndTime: isExamMode ? examEndTime : null }; const progress = { userStats, markedQuestions, incorrectQuestions, examHistory, savedUserStats, lastDailyChallenge, inProgressTest: testState }; apiRequest('progress', 'PUT', progress); }
function resumeTest(testState) { const questionsMap = new Map(ALL_TEST_QUESTIONS.map(q => [q._id, q])); currentQuestions = testState.questionIds.map(id => questionsMap.get(id)).filter(Boolean); userAnswers = testState.userAnswers; seconds = testState.seconds; currentTestType = testState.testType; currentTheme = testState.theme; isExamMode = testState.isExamMode; if (isExamMode) examEndTime = testState.examEndTime; initializeApp(); startNewTest(testState.title); Object.keys(userAnswers).forEach(qIndex => { const questionDiv = document.getElementById(`question-${qIndex}`); if (questionDiv) { const button = questionDiv.querySelector(`.test-options button[data-option-index="${userAnswers[qIndex]}"]`); if (button) { button.setAttribute('data-selected', 'true'); } } }); }
function finishNormalTest() {
    if (!isExamMode && !confirm('¿Seguro que quieres finalizar este test de práctica? Se corregirá con las respuestas marcadas.')) {
        return;
    }

    clearInterval(timerInterval);
    clearInterval(testStateInterval);

    let correctCount = 0;
    let incorrectCount = 0;
    let answeredCount = 0;

    currentQuestions.forEach((q, index) => {
        const userAnswerIndex = userAnswers[index];
        if (userAnswerIndex !== undefined) {
            answeredCount++;
            if (q.opts[userAnswerIndex] === q.c) {
                correctCount++;
            } else {
                incorrectCount++;
            }
        }
    });

    const totalQuestions = currentQuestions.length;
    const finalNetScore = calculateNetScore(correctCount, incorrectCount, answeredCount);

    document.getElementById('test-area').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    const resultsPage = document.getElementById('test-results-page');
    resultsPage.innerHTML = `
        <h3>Resultados del Test de Práctica</h3>
        <div class="stats-container">
            <div class="stat-card"><h4>Nota Neta (sobre respondidas)</h4><div class="stat-value stat-net-score">${finalNetScore}</div></div>
            <div class="stat-card"><h4>Aciertos</h4><div class="stat-value stat-correct">${correctCount}</div></div>
            <div class="stat-card"><h4>Fallos</h4><div class="stat-value stat-incorrect">${incorrectCount}</div></div>
            <div class="stat-card"><h4>Sin Responder</h4><div class="stat-value">${totalQuestions - answeredCount}</div></div>
        </div>
        <p style="text-align: center; margin-top: 20px;">Este resultado NO se guarda en el historial. Para ello, realiza un Simulacro de Examen.</p>`;
    
    document.getElementById('check-page-button').style.display = 'none';
    document.getElementById('reset-page-button').style.display = 'none';
    document.getElementById('finish-normal-test-button').style.display = 'none';
    
    clearInProgressTest();
}
async function finishInProgressTest(testState) {
    const questionsMap = new Map(ALL_TEST_QUESTIONS.map(q => [q._id, q]));
    currentQuestions = testState.questionIds.map(id => questionsMap.get(id)).filter(Boolean);
    userAnswers = testState.userAnswers || {};
    isExamMode = testState.isExamMode;
    examEndTime = testState.examEndTime;
    seconds = testState.seconds;

    if (isExamMode) {
        finishExam();
        alert('El simulacro de examen incompleto ha sido finalizado y guardado en tu historial.');
    } else {
        finishNormalTest();
        showSection('test-completo');
        alert('El test de práctica incompleto ha sido finalizado y corregido.');
    }
}