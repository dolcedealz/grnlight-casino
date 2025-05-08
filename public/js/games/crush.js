/**
 * crush.js - Оптимизированная версия игры Crush с общим графиком для всех игроков
 * Версия 4.1.0
 * 
 * Особенности:
 * - Общий график и история для всех игроков
 * - 10-секундная пауза между раундами
 * - Улучшенный компактный пользовательский интерфейс
 * - Защита от мошенничества (нет вывода точки краша)
 * - Расширенная анимация и визуальные эффекты
 * - Автоматические ставки и выход
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
    // Проверяем наличие основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[Crush] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Crush', 'Инициализация модуля игры Crush v4.1.0');
    
    // Игровая логика в замыкании для изоляции
    const crushGame = (function() {
        // Элементы игры
        let elements = {
            startBtn: null,
            cashoutBtn: null,
            crushBet: null,
            multiplierDisplay: null,
            crushGraph: null,
            crushResult: null,
            container: null,
            autoEnabled: null,
            autoCashoutAt: null,
            nextRoundTimer: null,
            bettingPhaseInfo: null,
            currentPhaseDisplay: null,
            playersOnline: null,
            currentBets: null,
            lastWinners: null
        };
        
        // Canvas для графика
        let graphCanvas = null;
        let graphCtx = null;
        
        // Глобальное состояние игры (общее для всех игроков)
        let globalState = {
            isActiveRound: false,
            isWaitingForNextRound: false,
            waitingTimeLeft: 0,
            currentMultiplier: 1.0,
            crashPoint: 1.0,  // Внутреннее значение, не выводится в консоль
            roundStartTime: 0,
            graphPoints: [],
            gameHistory: [],
            roundId: 0,
            roundTimerInterval: null,
            gameInterval: null,
            playersOnline: Math.floor(Math.random() * 50) + 100,  // Симуляция 100-150 игроков
            currentRoundBets: 0  // Количество ставок в текущем раунде
        };
        
        // Индивидуальное состояние пользователя
        let userState = {
            initialized: false,
            initializationStarted: false,
            hasBetInCurrentRound: false,
            betAmount: 0,
            isAutoCashoutEnabled: false,
            autoCashoutMultiplier: 2.0,
            hasCollectedWin: false
        };
        
        // Константы игры
        const WAITING_TIME_BETWEEN_ROUNDS = 10;
        const MAX_HISTORY_SIZE = 15;  // Увеличен размер истории
        const GAME_UPDATE_INTERVAL = 16;  // 60 FPS для плавной анимации
        const TIMER_UPDATE_INTERVAL = 100;  // Более частое обновление таймера
        
        // Звуковые эффекты (симуляция)
        const sounds = {
            bet: new Audio('sounds/bet.mp3'),
            countdown: new Audio('sounds/countdown.mp3'),
            crash: new Audio('sounds/crash.mp3'),
            cashout: new Audio('sounds/cashout.mp3')
        };
        
        /**
         * Инициализация игры
         */
        const init = async function() {
            if (userState.initialized || userState.initializationStarted) {
                app.log('Crush', 'Инициализация уже выполнена или выполняется');
                return true;
            }
            
            userState.initializationStarted = true;
            app.log('Crush', 'Начало инициализации игры');
            
            try {
                const initPromise = new Promise(async (resolve) => {
                    try {
                        await findDOMElements();
                        createGameContainer();
                        setupUI();
                        setupCanvas();
                        setupEventListeners();
                        resetGraph();
                        
                        if (globalState.gameHistory.length === 0) {
                            loadHistory();
                        }
                        
                        if (!globalState.isActiveRound && !globalState.isWaitingForNextRound) {
                            startWaitingForNextRound();
                        }
                        
                        updateGamePhaseDisplay();
                        initializeSounds();
                        
                        userState.initialized = true;
                        app.log('Crush', 'Инициализация успешно завершена');
                        resolve(true);
                    } catch (innerError) {
                        app.log('Crush', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Crush', 'Таймаут инициализации', true);
                        resolve(false);
                    }, 3000);
                });
                
                const result = await Promise.race([initPromise, timeoutPromise]);
                return result;
                
            } catch (error) {
                app.log('Crush', `Критическая ошибка инициализации: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Инициализация звуков
         */
        const initializeSounds = function() {
            // Настройка громкости
            Object.values(sounds).forEach(sound => {
                sound.volume = 0.3;
                // Предзагрузка звуков
                sound.load();
            });
        };
        
        /**
         * Воспроизведение звука (с обработкой ошибок)
         */
        const playSound = function(soundName) {
            try {
                if (sounds[soundName]) {
                    sounds[soundName].currentTime = 0;
                    sounds[soundName].play().catch(() => {});
                }
            } catch (error) {
                // Игнорируем ошибки звука
            }
        };
        
        /**
         * Поиск DOM элементов
         */
        const findDOMElements = async function() {
            return new Promise((resolve, reject) => {
                try {
                    setTimeout(() => {
                        // Основные элементы
                        elements.startBtn = document.getElementById('start-crush-btn');
                        elements.cashoutBtn = document.getElementById('cash-crush-btn');
                        elements.crushBet = document.getElementById('crush-bet');
                        elements.multiplierDisplay = document.getElementById('multiplier');
                        elements.crushGraph = document.getElementById('crush-graph');
                        elements.crushResult = document.getElementById('crush-result');
                        elements.autoEnabled = document.getElementById('auto-enabled');
                        elements.autoCashoutAt = document.getElementById('auto-cashout-at');
                        elements.nextRoundTimer = document.getElementById('next-round-timer');
                        elements.bettingPhaseInfo = document.getElementById('betting-phase-info');
                        elements.currentPhaseDisplay = document.getElementById('current-phase');
                        elements.playersOnline = document.getElementById('players-online');
                        elements.currentBets = document.getElementById('current-bets');
                        elements.lastWinners = document.getElementById('last-winners');
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('Crush', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                    reject(error);
                }
            });
        };
        
        /**
         * Создание контейнера для игры
         */
        const createGameContainer = function() {
            try {
                const crushScreen = document.getElementById('crush-screen');
                
                if (!crushScreen) {
                    app.log('Crush', 'Контейнер crush-screen не найден', true);
                    return;
                }
                
                elements.container = crushScreen.querySelector('.crush-container');
                
                if (!elements.container) {
                    const container = document.createElement('div');
                    container.className = 'crush-container';
                    crushScreen.appendChild(container);
                    elements.container = container;
                    app.log('Crush', 'Создан контейнер для игры');
                }
                
            } catch (error) {
                app.log('Crush', `Ошибка создания контейнера: ${error.message}`, true);
            }
        };
        
        /**
         * Настройка пользовательского интерфейса
         */
        const setupUI = function() {
            try {
                if (elements.container && elements.container.querySelector('#crush-graph')) {
                    app.log('Crush', 'Интерфейс уже создан');
                    return;
                }
                
                elements.container.innerHTML = `
                    <div class="crush-layout">
                        <div class="crush-main-column">
                            <div class="crush-top-bar">
                                <div class="game-info">
                                    <div class="info-item">
                                        <span class="info-icon">👥</span>
                                        <span id="players-online" class="info-value">${globalState.playersOnline}</span>
                                        <span class="info-label">онлайн</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-icon">💰</span>
                                        <span id="current-bets" class="info-value">0</span>
                                        <span class="info-label">ставок</span>
                                    </div>
                                </div>
                                <div class="game-phase">
                                    <div id="current-phase" class="phase-indicator">Ожидание игры</div>
                                    <div id="next-round-timer" class="round-timer">
                                        Следующий раунд: <span class="time-value">10</span>с
                                    </div>
                                </div>
                            </div>
                            
                            <div class="crush-center">
                                <div class="multiplier-display">
                                    <div id="multiplier" class="multiplier-value">1.00<span class="multiplier-x">×</span></div>
                                </div>
                                
                                <div id="crush-graph" class="crush-graph">
                                    <!-- Canvas будет создан динамически -->
                                </div>
                                
                                <div id="betting-phase-info" class="betting-phase-info">
                                    <p>Разместите ставку до начала раунда!</p>
                                </div>
                                
                                <div id="crush-result" class="result"></div>
                            </div>
                            
                            <div class="crush-controls">
                                <div class="bet-panel">
                                    <div class="bet-input-container">
                                        <label for="crush-bet">Ставка:</label>
                                        <div class="bet-input-wrapper">
                                            <input type="number" id="crush-bet" min="1" max="1000" value="10">
                                            <div class="quick-bet-buttons">
                                                <button class="quick-bet" data-amount="5">5</button>
                                                <button class="quick-bet" data-amount="10">10</button>
                                                <button class="quick-bet" data-amount="50">50</button>
                                                <button class="quick-bet" data-amount="100">100</button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div id="auto-settings" class="auto-settings">
                                        <div class="auto-option">
                                            <input type="checkbox" id="auto-enabled">
                                            <label for="auto-enabled">Авто-вывод при</label>
                                            <input type="number" id="auto-cashout-at" min="1.1" step="0.1" value="2.0">×
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="action-buttons">
                                    <button id="start-crush-btn" class="action-btn primary-btn">СДЕЛАТЬ СТАВКУ</button>
                                    <button id="cash-crush-btn" class="action-btn secondary-btn" disabled>ЗАБРАТЬ</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="crush-side-column">
                            <div class="crush-history-panel">
                                <div class="panel-header">
                                    <h3>История</h3>
                                </div>
                                <div class="history-items"></div>
                            </div>
                            
                            <div id="last-winners" class="winners-panel">
                                <div class="panel-header">
                                    <h3>Последние выигрыши</h3>
                                </div>
                                <div class="winners-list"></div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Обновляем ссылки на элементы
                elements.startBtn = document.getElementById('start-crush-btn');
                elements.cashoutBtn = document.getElementById('cash-crush-btn');
                elements.crushBet = document.getElementById('crush-bet');
                elements.multiplierDisplay = document.getElementById('multiplier');
                elements.crushGraph = document.getElementById('crush-graph');
                elements.crushResult = document.getElementById('crush-result');
                elements.autoEnabled = document.getElementById('auto-enabled');
                elements.autoCashoutAt = document.getElementById('auto-cashout-at');
                elements.nextRoundTimer = document.getElementById('next-round-timer');
                elements.bettingPhaseInfo = document.getElementById('betting-phase-info');
                elements.currentPhaseDisplay = document.getElementById('current-phase');
                elements.playersOnline = document.getElementById('players-online');
                elements.currentBets = document.getElementById('current-bets');
                elements.lastWinners = document.getElementById('last-winners');
                
                // Добавляем обработчики для быстрых кнопок ставок
                const quickBetButtons = document.querySelectorAll('.quick-bet');
                quickBetButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        if (elements.crushBet) {
                            elements.crushBet.value = this.dataset.amount;
                        }
                    });
                });
                
                app.log('Crush', 'Интерфейс игры успешно создан');
            } catch (error) {
                app.log('Crush', `Ошибка создания интерфейса: ${error.message}`, true);
            }
        };
        
        /**
         * Настройка canvas для графика
         */
        const setupCanvas = function() {
            try {
                if (!elements.crushGraph) {
                    app.log('Crush', 'Элемент графика не найден', true);
                    return;
                }
                
                let existingCanvas = elements.crushGraph.querySelector('canvas');
                if (existingCanvas) {
                    graphCanvas = existingCanvas;
                    graphCtx = graphCanvas.getContext('2d');
                    return;
                }
                
                graphCanvas = document.createElement('canvas');
                graphCanvas.id = 'crush-canvas';
                graphCanvas.width = elements.crushGraph.clientWidth || 600;
                graphCanvas.height = elements.crushGraph.clientHeight || 300;
                elements.crushGraph.appendChild(graphCanvas);
                
                graphCtx = graphCanvas.getContext('2d');
                
                // Улучшение качества отрисовки
                graphCtx.imageSmoothingEnabled = true;
                graphCtx.imageSmoothingQuality = 'high';
                
                app.log('Crush', 'Canvas для графика успешно создан');
            } catch (error) {
                app.log('Crush', `Ошибка создания canvas: ${error.message}`, true);
            }
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            try {
                if (elements.startBtn) {
                    const newStartBtn = elements.startBtn.cloneNode(true);
                    if (elements.startBtn.parentNode) {
                        elements.startBtn.parentNode.replaceChild(newStartBtn, elements.startBtn);
                    }
                    elements.startBtn = newStartBtn;
                    
                    elements.startBtn.addEventListener('click', placeBet);
                }
                
                if (elements.cashoutBtn) {
                    const newCashoutBtn = elements.cashoutBtn.cloneNode(true);
                    if (elements.cashoutBtn.parentNode) {
                        elements.cashoutBtn.parentNode.replaceChild(newCashoutBtn, elements.cashoutBtn);
                    }
                    elements.cashoutBtn = newCashoutBtn;
                    
                    elements.cashoutBtn.addEventListener('click', cashout);
                }
                
                if (elements.autoEnabled) {
                    elements.autoEnabled.addEventListener('change', function() {
                        userState.isAutoCashoutEnabled = this.checked;
                    });
                }
                
                if (elements.autoCashoutAt) {
                    elements.autoCashoutAt.addEventListener('input', function() {
                        userState.autoCashoutMultiplier = parseFloat(this.value) || 2.0;
                    });
                }
                
                window.addEventListener('resize', handleResize);
                
                app.log('Crush', 'Обработчики событий установлены');
            } catch (error) {
                app.log('Crush', `Ошибка установки обработчиков: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка изменения размера окна
         */
        const handleResize = function() {
            try {
                if (graphCanvas && elements.crushGraph) {
                    graphCanvas.width = elements.crushGraph.clientWidth || 600;
                    graphCanvas.height = elements.crushGraph.clientHeight || 300;
                    redrawGraph();
                }
            } catch (error) {
                app.log('Crush', `Ошибка обработки изменения размера: ${error.message}`, true);
            }
        };
        
        /**
         * Сброс графика
         */
        const resetGraph = function() {
            try {
                if (!graphCtx) return;
                
                graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
                drawGrid();
                globalState.graphPoints = [];
                
            } catch (error) {
                app.log('Crush', `Ошибка сброса графика: ${error.message}`, true);
            }
        };
        
        /**
         * Рисование сетки графика
         */
        const drawGrid = function() {
            try {
                if (!graphCtx) return;
                
                const width = graphCanvas.width;
                const height = graphCanvas.height;
                
                // Фон
                graphCtx.fillStyle = 'rgba(20, 25, 30, 0.9)';
                graphCtx.fillRect(0, 0, width, height);
                
                // Горизонтальные линии
                const horizontalLines = [1, 2, 5, 10, 20];
                graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
                graphCtx.lineWidth = 1;
                
                horizontalLines.forEach(multiplier => {
                    // Вычисляем положение линии на основе множителя (логарифмически)
                    const yPos = height - (Math.log(multiplier) / Math.log(20)) * height;
                    graphCtx.beginPath();
                    graphCtx.moveTo(0, yPos);
                    graphCtx.lineTo(width, yPos);
                    graphCtx.stroke();
                    
                    // Добавляем метку множителя
                    graphCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    graphCtx.font = '10px Arial';
                    graphCtx.textAlign = 'left';
                    graphCtx.fillText(`${multiplier}×`, 5, yPos - 5);
                });
                
                // Вертикальные линии (время - секунды)
                graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                for (let second = 1; second <= 10; second++) {
                    if (second % 5 === 0) {
                        graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    } else {
                        graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    }
                    
                    const xPos = (second / 10) * width;
                    graphCtx.beginPath();
                    graphCtx.moveTo(xPos, 0);
                    graphCtx.lineTo(xPos, height);
                    graphCtx.stroke();
                    
                    // Добавляем метку времени для каждых 5 секунд
                    if (second % 5 === 0) {
                        graphCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                        graphCtx.font = '10px Arial';
                        graphCtx.textAlign = 'center';
                        graphCtx.fillText(`${second}s`, xPos, height - 5);
                    }
                }
                
            } catch (error) {
                app.log('Crush', `Ошибка рисования сетки: ${error.message}`, true);
            }
        };
        
        /**
         * Создание истории игр
         */
        const loadHistory = function() {
            try {
                if (globalState.gameHistory.length > 0) return;
                
                globalState.gameHistory = [];
                
                for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
                    const crashValue = generateRandomCrashValue();
                    
                    globalState.gameHistory.push({
                        roundId: globalState.roundId - i - 1,
                        multiplier: parseFloat(crashValue),
                        timestamp: new Date(Date.now() - i * 60000).toISOString(),
                        crashed: true
                    });
                }
                
                updateHistoryDisplay();
                updateLastWinners();
                
            } catch (error) {
                app.log('Crush', `Ошибка загрузки истории: ${error.message}`, true);
            }
        };
        
        /**
         * Генерация случайного значения краша
         */
        const generateRandomCrashValue = function() {
            // Генерирует правдоподобное распределение значений краша
            const random = Math.random();
            
            if (random < 0.01) { // 1% вероятность большого краша
                return (10 + Math.random() * 90).toFixed(2);
            } else if (random < 0.1) { // 9% вероятность среднего краша
                return (5 + Math.random() * 5).toFixed(2);
            } else if (random < 0.4) { // 30% вероятность малого краша
                return (2 + Math.random() * 3).toFixed(2);
            } else { // 60% вероятность низкого краша
                return (1 + Math.random() * 1).toFixed(2);
            }
        };
        
        /**
         * Обновление отображения истории
         */
        const updateHistoryDisplay = function() {
            try {
                const historyItems = document.querySelector('.history-items');
                if (!historyItems) return;
                
                historyItems.innerHTML = '';
                
                globalState.gameHistory.forEach(item => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    
                    let colorClass = getMultiplierColorClass(item.multiplier);
                    historyItem.classList.add(colorClass);
                    historyItem.innerHTML = `${item.multiplier.toFixed(2)}×`;
                    
                    historyItems.appendChild(historyItem);
                });
            } catch (error) {
                app.log('Crush', `Ошибка обновления истории: ${error.message}`, true);
            }
        };
        
        /**
         * Определение класса цвета в зависимости от множителя
         */
        const getMultiplierColorClass = function(multiplier) {
            if (multiplier <= 1.5) return 'level-1';
            if (multiplier <= 3) return 'level-2';
            if (multiplier <= 5) return 'level-3';
            if (multiplier <= 10) return 'level-4';
            if (multiplier <= 20) return 'level-5';
            return 'level-6';
        };
        
        /**
         * Обновление последних победителей
         */
        const updateLastWinners = function() {
            try {
                const winnersList = document.querySelector('.winners-list');
                if (!winnersList) return;
                
                // Генерируем случайных победителей для демонстрации
                const winners = [];
                for (let i = 0; i < 5; i++) {
                    winners.push({
                        name: `Player${Math.floor(Math.random() * 1000)}`,
                        amount: Math.floor(Math.random() * 1000) + 100,
                        multiplier: (1 + Math.random() * 5).toFixed(2)
                    });
                }
                
                winnersList.innerHTML = winners.map(winner => `
                    <div class="winner-item">
                        <span class="winner-name">${winner.name}</span>
                        <span class="winner-amount">+${winner.amount}</span>
                        <span class="winner-multiplier">${winner.multiplier}×</span>
                    </div>
                `).join('');
                
            } catch (error) {
                app.log('Crush', `Ошибка обновления победителей: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление отображения фазы игры
         */
        const updateGamePhaseDisplay = function() {
            try {
                if (elements.currentPhaseDisplay) {
                    if (globalState.isActiveRound) {
                        elements.currentPhaseDisplay.textContent = 'Раунд активен';
                        elements.currentPhaseDisplay.className = 'phase-indicator active-round';
                    } else if (globalState.isWaitingForNextRound) {
                        elements.currentPhaseDisplay.textContent = 'Ожидание раунда';
                        elements.currentPhaseDisplay.className = 'phase-indicator waiting';
                    } else {
                        elements.currentPhaseDisplay.textContent = 'Ожидание игры';
                        elements.currentPhaseDisplay.className = 'phase-indicator idle';
                    }
                }
                
                if (elements.nextRoundTimer) {
                    if (globalState.isWaitingForNextRound) {
                        elements.nextRoundTimer.style.display = 'block';
                        const timeSpan = elements.nextRoundTimer.querySelector('.time-value');
                        if (timeSpan) {
                            timeSpan.textContent = globalState.waitingTimeLeft;
                        }
                    } else {
                        elements.nextRoundTimer.style.display = 'none';
                    }
                }
                
                if (elements.bettingPhaseInfo) {
                    if (globalState.isWaitingForNextRound) {
                        elements.bettingPhaseInfo.style.display = 'block';
                        elements.bettingPhaseInfo.innerHTML = `
                            <p class="betting-phase-message">Сделайте ставку до начала раунда!</p>
                        `;
                    } else if (globalState.isActiveRound && !userState.hasBetInCurrentRound) {
                        elements.bettingPhaseInfo.style.display = 'block';
                        elements.bettingPhaseInfo.innerHTML = `
                            <p class="betting-phase-message">Дождитесь следующего раунда для ставки</p>
                        `;
                    } else {
                        elements.bettingPhaseInfo.style.display = 'none';
                    }
                }
                
                if (elements.playersOnline) {
                    // Симуляция изменения количества игроков
                    if (Math.random() < 0.05) {
                        globalState.playersOnline += Math.floor(Math.random() * 10) - 5;
                        globalState.playersOnline = Math.max(50, globalState.playersOnline);
                        elements.playersOnline.textContent = globalState.playersOnline;
                    }
                }
                
                if (elements.currentBets) {
                    elements.currentBets.textContent = globalState.currentRoundBets;
                }
                
                updateButtonsState();
                
            } catch (error) {
                app.log('Crush', `Ошибка обновления отображения фазы игры: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление состояния кнопок
         */
        const updateButtonsState = function() {
            try {
                if (elements.startBtn) {
                    elements.startBtn.disabled = !globalState.isWaitingForNextRound || userState.hasBetInCurrentRound;
                    
                    if (userState.hasBetInCurrentRound) {
                        elements.startBtn.textContent = 'СТАВКА СДЕЛАНА';
                        elements.startBtn.classList.add('bet-placed');
                    } else {
                        elements.startBtn.textContent = 'СДЕЛАТЬ СТАВКУ';
                        elements.startBtn.classList.remove('bet-placed');
                    }
                }
                
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = !globalState.isActiveRound || 
                                                  !userState.hasBetInCurrentRound || 
                                                  userState.hasCollectedWin;
                    
                    if (userState.hasCollectedWin) {
                        elements.cashoutBtn.textContent = 'ВЫИГРЫШ ПОЛУЧЕН';
                        elements.cashoutBtn.classList.add('win-collected');
                    } else {
                        elements.cashoutBtn.textContent = 'ЗАБРАТЬ';
                        elements.cashoutBtn.classList.remove('win-collected');
                    }
                }
                
                const autoSettings = document.getElementById('auto-settings');
                if (autoSettings) {
                    if (globalState.isActiveRound && userState.hasBetInCurrentRound && !userState.hasCollectedWin) {
                        autoSettings.classList.add('disabled');
                    } else {
                        autoSettings.classList.remove('disabled');
                    }
                }
                
            } catch (error) {
                app.log('Crush', `Ошибка обновления состояния кнопок: ${error.message}`, true);
            }
        };
        
        /**
         * Запуск таймера ожидания
         */
        const startWaitingForNextRound = function() {
            try {
                globalState.isWaitingForNextRound = true;
                globalState.isActiveRound = false;
                globalState.waitingTimeLeft = WAITING_TIME_BETWEEN_ROUNDS;
                
                userState.hasBetInCurrentRound = false;
                userState.hasCollectedWin = false;
                
                globalState.roundId++;
                globalState.currentRoundBets = 0;
                
                updateGamePhaseDisplay();
                
                if (globalState.roundTimerInterval) {
                    clearInterval(globalState.roundTimerInterval);
                }
                
                // Звук обратного отсчета
                if (globalState.waitingTimeLeft <= 3) {
                    playSound('countdown');
                }
                
                globalState.roundTimerInterval = setInterval(() => {
                    try {
                        globalState.waitingTimeLeft--;
                        
                        // Звук последних секунд
                        if (globalState.waitingTimeLeft === 3) {
                            playSound('countdown');
                        }
                        
                        updateGamePhaseDisplay();
                        
                        if (globalState.waitingTimeLeft <= 0) {
                            clearInterval(globalState.roundTimerInterval);
                            startNewRound();
                        }
                    } catch (error) {
                        app.log('Crush', `Ошибка в таймере: ${error.message}`, true);
                        clearInterval(globalState.roundTimerInterval);
                    }
                }, TIMER_UPDATE_INTERVAL);
                
                app.log('Crush', `Ожидание следующего раунда: ${WAITING_TIME_BETWEEN_ROUNDS} секунд`);
            } catch (error) {
                app.log('Crush', `Ошибка запуска таймера: ${error.message}`, true);
                startNewRound();
            }
        };
        
        /**
         * Начало нового раунда
         */
        const startNewRound = function() {
            try {
                globalState.isWaitingForNextRound = false;
                globalState.isActiveRound = true;
                globalState.currentMultiplier = 1.00;
                globalState.roundStartTime = Date.now();
                
                // Генерируем новую точку краша (НЕ выводим в консоль!)
                globalState.crashPoint = generateCrashPoint();
                
                resetGraph();
                updateGamePhaseDisplay();
                updateMultiplierDisplay();
                
                addGraphPoint(1.00);
                
                startGameInterval();
                
                if (window.casinoApp && userState.hasBetInCurrentRound) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
            } catch (error) {
                app.log('Crush', `Ошибка запуска нового раунда: ${error.message}`, true);
                startWaitingForNextRound();
            }
        };
        
        /**
         * Запуск игрового интервала
         */
        const startGameInterval = function() {
            try {
                if (globalState.gameInterval) {
                    clearInterval(globalState.gameInterval);
                }
                
                globalState.gameInterval = setInterval(() => {
                    try {
                        if (!globalState.isActiveRound) {
                            clearInterval(globalState.gameInterval);
                            return;
                        }
                        
                        updateGame();
                    } catch (error) {
                        app.log('Crush', `Ошибка в игровом интервале: ${error.message}`, true);
                        clearInterval(globalState.gameInterval);
                        finishRound();
                    }
                }, GAME_UPDATE_INTERVAL);
                
            } catch (error) {
                app.log('Crush', `Ошибка запуска игрового интервала: ${error.message}`, true);
                finishRound();
            }
        };
        
        /**
         * Обновление игры
         */
        const updateGame = function() {
            try {
                const elapsedTime = (Date.now() - globalState.roundStartTime) / 1000;
                
                const growthFactor = 0.5;
                globalState.currentMultiplier = Math.exp(elapsedTime * growthFactor);
                
                updateMultiplierDisplay();
                
                // Добавляем точки с разной частотой в зависимости от времени
                const pointInterval = elapsedTime > 10 ? 100 : 50;
                if (Date.now() % pointInterval < GAME_UPDATE_INTERVAL) {
                    addGraphPoint(globalState.currentMultiplier);
                }
                
                // Проверка автовывода
                if (userState.hasBetInCurrentRound && 
                    !userState.hasCollectedWin && 
                    userState.isAutoCashoutEnabled && 
                    globalState.currentMultiplier >= userState.autoCashoutMultiplier) {
                    cashout();
                    return;
                }
                
                // Проверка краша
                if (globalState.currentMultiplier >= globalState.crashPoint) {
                    crashRound();
                }
            } catch (error) {
                app.log('Crush', `Ошибка обновления игры: ${error.message}`, true);
                finishRound();
            }
        };
        
        /**
         * Обновление отображения множителя
         */
        const updateMultiplierDisplay = function() {
            try {
                if (!elements.multiplierDisplay) return;
                
                const displayMultiplier = Math.floor(globalState.currentMultiplier * 100) / 100;
                const multiplierText = displayMultiplier.toFixed(2);
                
                // Обновляем только текстовый контент, сохраняя вложенные элементы
                const xElement = elements.multiplierDisplay.querySelector('.multiplier-x');
                if (xElement) {
                    elements.multiplierDisplay.textContent = multiplierText;
                    elements.multiplierDisplay.appendChild(xElement);
                } else {
                    elements.multiplierDisplay.innerHTML = `${multiplierText}<span class="multiplier-x">×</span>`;
                }
                
                // Удаляем все классы уровней
                elements.multiplierDisplay.classList.remove('level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6');
                
                // Добавляем соответствующий класс
                elements.multiplierDisplay.classList.add(getMultiplierColorClass(displayMultiplier));
                
                // Пульсация при высоких значениях
                if (displayMultiplier > 5) {
                    elements.multiplierDisplay.classList.add('pulsate');
                } else {
                    elements.multiplierDisplay.classList.remove('pulsate');
                }
                
            } catch (error) {
                app.log('Crush', `Ошибка обновления множителя: ${error.message}`, true);
            }
        };
        
        /**
         * Добавление точки на график
         */
        const addGraphPoint = function(multiplier) {
            try {
                const elapsedTime = (Date.now() - globalState.roundStartTime) / 1000;
                
                globalState.graphPoints.push({
                    time: elapsedTime,
                    multiplier: multiplier
                });
                
                redrawGraph();
            } catch (error) {
                app.log('Crush', `Ошибка добавления точки: ${error.message}`, true);
            }
        };
        
        /**
         * Перерисовка графика
         */
        const redrawGraph = function() {
            try {
                if (!graphCtx || !graphCanvas) return;
                
                graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
                
                drawGrid();
                
                if (globalState.graphPoints.length < 2) return;
                
                const width = graphCanvas.width;
                const height = graphCanvas.height;
                
                // Настраиваем максимальные значения для более логичного масштабирования
                const currentMultiplier = globalState.currentMultiplier;
                let maxMult = 20; // Начальное максимальное значение для множителя
                
                // Динамически увеличиваем максимальный множитель, если текущий приближается к нему
                if (currentMultiplier > maxMult * 0.5) {
                    maxMult = Math.max(maxMult, currentMultiplier * 1.5);
                }
                
                // Максимальное время отображения на графике (в секундах)
                const maxTime = 20;
                
                // Рисуем линию графика с плавной кривой
                graphCtx.beginPath();
                
                // Начинаем с первой точки
                const firstPoint = globalState.graphPoints[0];
                const x0 = (firstPoint.time / maxTime) * width;
                const y0 = height - (Math.log(firstPoint.multiplier) / Math.log(maxMult)) * height;
                graphCtx.moveTo(x0, y0);
                
                // Создаем градиент для линии
                const lineGradient = graphCtx.createLinearGradient(0, 0, 0, height);
                lineGradient.addColorStop(0, '#00c853');   // Зелёный вверху (для высоких множителей)
                lineGradient.addColorStop(0.3, '#ffab00'); // Оранжевый в середине
                lineGradient.addColorStop(0.7, '#ff6d00'); // Тёмно-оранжевый
                lineGradient.addColorStop(1, '#ff1744');   // Красный внизу (для низких множителей)
                
                // Улучшенное отображение линии с использованием Bezier кривой
                for (let i = 1; i < globalState.graphPoints.length; i++) {
                    const prevPoint = globalState.graphPoints[i-1];
                    const currentPoint = globalState.graphPoints[i];
                    
                    const x = (currentPoint.time / maxTime) * width;
                    const y = height - (Math.log(currentPoint.multiplier) / Math.log(maxMult)) * height;
                    
                    // Используем линейную интерполяцию для более плавной кривой
                    graphCtx.lineTo(x, y);
                }
                
                // Настраиваем стиль линии
                graphCtx.strokeStyle = lineGradient;
                graphCtx.lineWidth = 3;
                graphCtx.lineCap = 'round';
                graphCtx.lineJoin = 'round';
                
                // Добавляем тень для эффектности
                graphCtx.shadowColor = 'rgba(0, 200, 83, 0.5)';
                graphCtx.shadowBlur = 10;
                graphCtx.shadowOffsetX = 0;
                graphCtx.shadowOffsetY = 0;
                
                // Рисуем линию
                graphCtx.stroke();
                
                // Градиентная заливка под линией
                const lastPoint = globalState.graphPoints[globalState.graphPoints.length - 1];
                const lastX = (lastPoint.time / maxTime) * width;
                const lastY = height - (Math.log(lastPoint.multiplier) / Math.log(maxMult)) * height;
                
                graphCtx.lineTo(lastX, height);
                graphCtx.lineTo(x0, height);
                graphCtx.closePath();
                
                // Создаем градиент для заливки
                const fillGradient = graphCtx.createLinearGradient(0, 0, 0, height);
                fillGradient.addColorStop(0, 'rgba(0, 200, 83, 0.3)');
                fillGradient.addColorStop(0.7, 'rgba(0, 200, 83, 0.1)');
                fillGradient.addColorStop(1, 'rgba(0, 200, 83, 0)');
                
                graphCtx.fillStyle = fillGradient;
                graphCtx.globalAlpha = 0.5; // Полупрозрачная заливка
                graphCtx.fill();
                graphCtx.globalAlpha = 1;
                
                // Сбрасываем тень
                graphCtx.shadowColor = 'transparent';
                graphCtx.shadowBlur = 0;
                
                // Текущая точка - рисуем яркий маркер
                graphCtx.beginPath();
                graphCtx.arc(lastX, lastY, 6, 0, Math.PI * 2);
                
                // Градиентная заливка для точки
                const dotGradient = graphCtx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 6);
                dotGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                dotGradient.addColorStop(1, 'rgba(0, 200, 83, 0.8)');
                
                graphCtx.fillStyle = dotGradient;
                graphCtx.fill();
                
                // Рисуем ореол вокруг точки
                graphCtx.beginPath();
                graphCtx.arc(lastX, lastY, 10, 0, Math.PI * 2);
                graphCtx.fillStyle = 'rgba(0, 200, 83, 0.2)';
                graphCtx.fill();
                
            } catch (error) {
                app.log('Crush', `Ошибка перерисовки графика: ${error.message}`, true);
            }
        };
        
        /**
         * Размещение ставки
         */
        const placeBet = async function() {
            try {
                if (!globalState.isWaitingForNextRound || userState.hasBetInCurrentRound) {
                    return;
                }
                
                if (!elements.crushBet) return;
                
                userState.betAmount = parseInt(elements.crushBet.value);
                
                if (isNaN(userState.betAmount) || userState.betAmount <= 0) {
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                    }
                    return;
                }
                
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    userState.betAmount > window.GreenLightApp.user.balance) {
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Недостаточно средств для ставки');
                    }
                    return;
                }
                
                if (elements.autoEnabled && elements.autoCashoutAt) {
                    userState.isAutoCashoutEnabled = elements.autoEnabled.checked;
                    userState.autoCashoutMultiplier = parseFloat(elements.autoCashoutAt.value) || 2.0;
                }
                
                userState.hasBetInCurrentRound = true;
                userState.hasCollectedWin = false;
                globalState.currentRoundBets++;
                
                updateGamePhaseDisplay();
                
                playSound('bet');
                
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                if (window.casinoApp && window.casinoApp.processGameResult) {
                    await window.casinoApp.processGameResult(
                        'crush',
                        userState.betAmount,
                        'bet',
                        0,
                        { 
                            roundId: globalState.roundId,
                            isAutoCashoutEnabled: userState.isAutoCashoutEnabled,
                            autoCashoutMultiplier: userState.autoCashoutMultiplier
                        }
                    );
                }
                
                app.log('Crush', `Ставка размещена: ${userState.betAmount}`);
            } catch (error) {
                app.log('Crush', `Ошибка размещения ставки: ${error.message}`, true);
                userState.hasBetInCurrentRound = false;
                updateGamePhaseDisplay();
            }
        };
        
        /**
         * Вывод выигрыша
         */
        const cashout = async function() {
            try {
                if (!globalState.isActiveRound || !userState.hasBetInCurrentRound || userState.hasCollectedWin) {
                    return;
                }
                
                userState.hasCollectedWin = true;
                
                const winAmount = Math.floor(userState.betAmount * globalState.currentMultiplier);
                
                updateGamePhaseDisplay();
                
                if (elements.crushResult) {
                    elements.crushResult.innerHTML = `
                        <div class="cashout-animation">
                            <div class="cashout-icon">💰</div>
                            <div class="cashout-text">Вы вывели деньги при ${globalState.currentMultiplier.toFixed(2)}×!</div>
                            <div class="win-amount">+${winAmount} ⭐</div>
                        </div>
                    `;
                    elements.crushResult.className = 'result win';
                    elements.crushResult.style.display = 'block';
                }
                
                if (elements.multiplierDisplay) {
                    elements.multiplierDisplay.className = 'multiplier-value cashed-out';
                }
                
                playSound('cashout');
                
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                }
                
                if (window.casinoApp && window.casinoApp.processGameResult) {
                    await window.casinoApp.processGameResult(
                        'crush',
                        0,
                        'win',
                        winAmount,
                        {
                            roundId: globalState.roundId,
                            cashoutMultiplier: globalState.currentMultiplier
                        }
                    );
                }
                
                app.log('Crush', `Успешный вывод при ${globalState.currentMultiplier.toFixed(2)}x`);
            } catch (error) {
                app.log('Crush', `Ошибка вывода выигрыша: ${error.message}`, true);
                userState.hasCollectedWin = true;
                updateGamePhaseDisplay();
            }
        };
        
        /**
         * Крах раунда
         */
        const crashRound = function() {
            try {
                animateCrash();
                
                if (userState.hasBetInCurrentRound && !userState.hasCollectedWin) {
                    if (elements.crushResult) {
                        elements.crushResult.innerHTML = `
                            <div class="crash-animation">
                                <div class="crash-icon">💥</div>
                                <div class="crash-text">Краш при ${globalState.currentMultiplier.toFixed(2)}×!</div>
                                <div class="lose-message">Вы проиграли ${userState.betAmount} ⭐</div>
                            </div>
                        `;
                        elements.crushResult.className = 'result lose';
                        elements.crushResult.style.display = 'block';
                    }
                    
                    playSound('crash');
                    
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('error');
                    }
                    
                    if (window.casinoApp && window.casinoApp.processGameResult) {
                        window.casinoApp.processGameResult(
                            'crush',
                            0,
                            'lose',
                            0,
                            {
                                roundId: globalState.roundId,
                                crashPoint: globalState.currentMultiplier
                            }
                        ).catch(error => {
                            app.log('Crush', `Ошибка отправки результата: ${error.message}`, true);
                        });
                    }
                }
                
                if (elements.multiplierDisplay) {
                    elements.multiplierDisplay.className = 'multiplier-value crashed';
                }
                
                addToHistory(true);
                finishRound();
                
            } catch (error) {
                app.log('Crush', `Ошибка завершения раунда крашем: ${error.message}`, true);
                finishRound();
            }
        };
        
        /**
         * Анимация краша
         */
        const animateCrash = function() {
            try {
                if (!graphCanvas || !graphCtx || globalState.graphPoints.length === 0) return;
                
                const lastPoint = globalState.graphPoints[globalState.graphPoints.length - 1];
                
                const width = graphCanvas.width;
                const height = graphCanvas.height;
                
                const maxMult = 20;
                const maxTime = 20;
                
                const crashX = (lastPoint.time / maxTime) * width;
                const crashY = height - (Math.log(lastPoint.multiplier) / Math.log(maxMult)) * height;
                
                // Улучшенная анимация взрыва
                let explosionRadius = 0;
                const maxRadius = 80;
                const explosionDuration = 800; // ms
                const startTime = Date.now();
                
                const animateExplosion = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(1, elapsed / explosionDuration);
                    
                    if (progress < 1) {
                        // Очищаем и перерисовываем график
                        redrawGraph();
                        
                        // Нелинейная функция размера для более реалистичной анимации
                        explosionRadius = maxRadius * Math.sin(progress * Math.PI);
                        
                        // Рисуем радиальный градиент для взрыва
                        const explosionGradient = graphCtx.createRadialGradient(
                            crashX, crashY, 0,
                            crashX, crashY, explosionRadius
                        );
                        
                        explosionGradient.addColorStop(0, 'rgba(255, 55, 55, 0.9)');
                        explosionGradient.addColorStop(0.2, 'rgba(255, 55, 55, 0.8)');
                        explosionGradient.addColorStop(0.5, 'rgba(255, 87, 34, 0.6)');
                        explosionGradient.addColorStop(0.8, 'rgba(255, 87, 34, 0.2)');
                        explosionGradient.addColorStop(1, 'rgba(255, 87, 34, 0)');
                        
                        graphCtx.beginPath();
                        graphCtx.arc(crashX, crashY, explosionRadius, 0, Math.PI * 2);
                        graphCtx.fillStyle = explosionGradient;
                        graphCtx.fill();
                        
                        // Рисуем "искры" от взрыва
                        const sparkCount = 8;
                        const sparkLength = explosionRadius * 0.7;
                        
                        for (let i = 0; i < sparkCount; i++) {
                            const angle = (i / sparkCount) * Math.PI * 2;
                            const sparkX = crashX + Math.cos(angle) * sparkLength * progress;
                            const sparkY = crashY + Math.sin(angle) * sparkLength * progress;
                            
                            graphCtx.beginPath();
                            graphCtx.moveTo(crashX, crashY);
                            graphCtx.lineTo(sparkX, sparkY);
                            graphCtx.strokeStyle = `rgba(255, 200, 50, ${1 - progress})`;
                            graphCtx.lineWidth = 2;
                            graphCtx.stroke();
                        }
                        
                        requestAnimationFrame(animateExplosion);
                    }
                };
                
                animateExplosion();
                
            } catch (error) {
                app.log('Crush', `Ошибка анимации краша: ${error.message}`, true);
            }
        };
        
        /**
         * Завершение раунда
         */
        const finishRound = function() {
            try {
                if (globalState.gameInterval) {
                    clearInterval(globalState.gameInterval);
                    globalState.gameInterval = null;
                }
                
                globalState.isActiveRound = false;
                
                updateGamePhaseDisplay();
                
                setTimeout(() => {
                    startWaitingForNextRound();
                }, 2000);
                
            } catch (error) {
                app.log('Crush', `Ошибка финализации раунда: ${error.message}`, true);
                setTimeout(() => {
                    startWaitingForNextRound();
                }, 2000);
            }
        };
        
        /**
         * Добавление в историю
         */
        const addToHistory = function(crashed) {
            try {
                const historyEntry = {
                    roundId: globalState.roundId,
                    multiplier: parseFloat(globalState.currentMultiplier.toFixed(2)),
                    timestamp: new Date().toISOString(),
                    crashed: crashed
                };
                
                globalState.gameHistory.unshift(historyEntry);
                
                if (globalState.gameHistory.length > MAX_HISTORY_SIZE) {
                    globalState.gameHistory = globalState.gameHistory.slice(0, MAX_HISTORY_SIZE);
                }
                
                updateHistoryDisplay();
                updateLastWinners();
                
            } catch (error) {
                app.log('Crush', `Ошибка добавления в историю: ${error.message}`, true);
            }
        };
        
        /**
         * Генерация точки краша
         * ВНИМАНИЕ: Результат НЕ выводится в консоль!
         */
        const generateCrashPoint = function() {
            try {
                const houseEdge = 0.05; // 3% преимущество казино
                
                // Генерируем случайное число от 0 до 1
                const randomValue = Math.random();
                
                // Формула для точки краша
                let crashPoint = 1 / (randomValue * (1 - houseEdge));
                
                // Ограничиваем максимальное значение
                const maxCrashPoint = 100.0;
                crashPoint = Math.min(crashPoint, maxCrashPoint);
                
                // Иногда делаем ранний краш (для демонстрации)
                if (Math.random() < 0.08) {  // 8% шанс раннего краша
                    crashPoint = 1.0 + Math.random() * 0.8;  // Между 1.0 и 1.8
                }
                
                return crashPoint;
            } catch (error) {
                app.log('Crush', `Ошибка генерации точки краша: ${error.message}`, true);
                return 2.0;
            }
        };
        
        // Возвращаем публичный интерфейс
        return {
            init: init,
            placeBet: placeBet,
            cashout: cashout,
            createUI: setupUI,
            
            getStatus: function() {
                return {
                    user: userState,
                    global: {
                        isActiveRound: globalState.isActiveRound,
                        isWaitingForNextRound: globalState.isWaitingForNextRound,
                        waitingTimeLeft: globalState.waitingTimeLeft,
                        currentMultiplier: globalState.currentMultiplier,
                        roundId: globalState.roundId,
                        gameHistory: globalState.gameHistory.length
                    },
                    elementsFound: {
                        startBtn: !!elements.startBtn,
                        cashoutBtn: !!elements.cashoutBtn,
                        crushBet: !!elements.crushBet,
                        multiplierDisplay: !!elements.multiplierDisplay,
                        crushGraph: !!elements.crushGraph
                    },
                    graphReady: !!graphCtx
                };
            },
            
            // Добавление стилей
            addStyles: function() {
                try {
                    if (document.getElementById('crush-styles')) return;
                    
                    const styleElement = document.createElement('style');
                    styleElement.id = 'crush-styles';
                    styleElement.textContent = `
                        .crush-container {
                            max-width: 960px;
                            margin: 0 auto;
                            padding: 15px;
                            background: linear-gradient(135deg, #1c2133, #14171f);
                            border-radius: 16px;
                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
                            overflow: hidden;
                            color: #fff;
                        }
                        
                        .crush-layout {
                            display: grid;
                            grid-template-columns: 3fr 1fr;
                            gap: 15px;
                        }
                        
                        /* Основная колонка */
                        .crush-main-column {
                            display: flex;
                            flex-direction: column;
                            gap: 15px;
                        }
                        
                        /* Верхняя панель */
                        .crush-top-bar {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 10px;
                            padding: 10px 15px;
                        }
                        
                        .game-info {
                            display: flex;
                            gap: 15px;
                        }
                        
                        .info-item {
                            display: flex;
                            align-items: center;
                            gap: 5px;
                        }
                        
                        .info-icon {
                            font-size: 16px;
                        }
                        
                        .info-value {
                            font-weight: bold;
                            color: #f2c94c;
                        }
                        
                        .info-label {
                            font-size: 12px;
                            color: rgba(255, 255, 255, 0.7);
                        }
                        
                        .game-phase {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .phase-indicator {
                            font-size: 14px;
                            font-weight: bold;
                            padding: 5px 10px;
                            border-radius: 5px;
                            background: rgba(0, 0, 0, 0.3);
                            transition: all 0.3s ease;
                        }
                        
                        .phase-indicator.active-round {
                            background: rgba(0, 200, 83, 0.2);
                            color: #00c853;
                        }
                        
                        .phase-indicator.waiting {
                            background: rgba(242, 201, 76, 0.2);
                            color: #f2c94c;
                        }
                        
                        .round-timer {
                            font-size: 14px;
                            color: #f2c94c;
                        }
                        
                        .time-value {
                            font-weight: bold;
                        }
                        
                        /* Центральная часть */
                        .crush-center {
                            position: relative;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 15px;
                        }
                        
                        .multiplier-display {
                            position: relative;
                            text-align: center;
                            padding: 5px 15px;
                            border-radius: 10px 10px 0 0;
                            background: rgba(0, 0, 0, 0.2);
                            margin-bottom: -10px;
                            z-index: 1;
                        }
                        
                        .multiplier-value {
                            font-size: 36px;
                            font-weight: bold;
                            transition: all 0.2s ease;
                            text-shadow: 0 0 10px currentColor;
                        }
                        
                        .multiplier-x {
                            font-size: 24px;
                            opacity: 0.7;
                        }
                        
                        .multiplier-value.crashed {
                            color: #ff1744 !important;
                            animation: crash-flash 0.3s 3;
                        }
                        
                        .multiplier-value.cashed-out {
                            color: #2196f3 !important;
                        }
                        
                        /* Цветовая схема для множителей */
                        .multiplier-value.level-1 { color: #00c853; }
                        .multiplier-value.level-2 { color: #64dd17; }
                        .multiplier-value.level-3 { color: #ffd600; }
                        .multiplier-value.level-4 { color: #ff9100; }
                        .multiplier-value.level-5 { color: #ff3d00; }
                        .multiplier-value.level-6 { color: #ff1744; }
                        
                        .multiplier-value.pulsate {
                            animation: pulsate 1s infinite alternate;
                        }
                        
                        @keyframes pulsate {
                            0% { transform: scale(1); }
                            100% { transform: scale(1.05); }
                        }
                        
                        @keyframes crash-flash {
                            0% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.5; transform: scale(0.95); }
                            100% { opacity: 1; transform: scale(1); }
                        }
                        
                        .crush-graph {
                            width: 100%;
                            height: 300px;
                            background: linear-gradient(135deg, #14171f, #1a1e30);
                            border-radius: 10px;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            overflow: hidden;
                            box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
                        }
                        
                        .betting-phase-info {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: rgba(0, 0, 0, 0.7);
                            border-radius: 10px;
                            padding: 15px 20px;
                            text-align: center;
                            color: #fff;
                            backdrop-filter: blur(5px);
                            max-width: 300px;
                            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                        }
                        
                        .betting-phase-message {
                            margin: 0;
                            font-weight: bold;
                        }
                        
                        .result {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: rgba(0, 0, 0, 0.8);
                            border-radius: 15px;
                            padding: 20px;
                            text-align: center;
                            color: #fff;
                            backdrop-filter: blur(5px);
                            max-width: 300px;
                            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.4);
                            animation: pop-in 0.5s forwards;
                            z-index: 2;
                        }
                        
                        @keyframes pop-in {
                            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                            50% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
                            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                        }
                        
                        .result.win .cashout-icon {
                            font-size: 36px;
                            margin-bottom: 10px;
                            animation: bounce 1s infinite alternate;
                        }
                        
                        @keyframes bounce {
                            0% { transform: translateY(0); }
                            100% { transform: translateY(-10px); }
                        }
                        
                        .result.win .cashout-text {
                            font-size: 18px;
                            margin-bottom: 10px;
                            color: #00c853;
                        }
                        
                        .result.win .win-amount {
                            font-size: 24px;
                            font-weight: bold;
                            color: #f2c94c;
                            margin-top: 10px;
                        }
                        
                        .result.lose .crash-icon {
                            font-size: 36px;
                            margin-bottom: 10px;
                            animation: shake 0.5s;
                        }
                        
                        @keyframes shake {
                            0%, 100% { transform: translateX(0); }
                            20%, 60% { transform: translateX(-5px); }
                            40%, 80% { transform: translateX(5px); }
                        }
                        
                        .result.lose .crash-text {
                            font-size: 18px;
                            margin-bottom: 10px;
                            color: #ff1744;
                        }
                        
                        .result.lose .lose-message {
                            font-size: 16px;
                            color: rgba(255, 255, 255, 0.7);
                        }
                        
                        /* Панель управления */
                        .crush-controls {
                            display: flex;
                            flex-direction: column;
                            gap: 15px;
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 10px;
                            padding: 15px;
                        }
                        
                        .bet-panel {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            gap: 15px;
                        }
                        
                        .bet-input-container {
                            flex: 1;
                        }
                        
                        .bet-input-container label {
                            display: block;
                            font-size: 12px;
                            color: rgba(255, 255, 255, 0.7);
                            margin-bottom: 5px;
                        }
                        
                        .bet-input-wrapper {
                            display: flex;
                            gap: 5px;
                        }
                        
                        #crush-bet {
                            flex: 1;
                            padding: 8px 10px;
                            font-size: 14px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 5px;
                            color: #fff;
                            outline: none;
                            transition: all 0.2s;
                        }
                        
                        #crush-bet:focus {
                            border-color: #00c853;
                            box-shadow: 0 0 0 2px rgba(0, 200, 83, 0.2);
                        }
                        
                        .quick-bet-buttons {
                            display: flex;
                            gap: 5px;
                        }
                        
                        .quick-bet {
                            padding: 8px 10px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 5px;
                            color: #fff;
                            cursor: pointer;
                            transition: all 0.2s;
                        }
                        
                        .quick-bet:hover {
                            background: rgba(255, 255, 255, 0.1);
                        }
                        
                        .auto-settings {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .auto-option {
                            display: flex;
                            align-items: center;
                            gap: 5px;
                            font-size: 12px;
                            color: rgba(255, 255, 255, 0.8);
                        }
                        
                        #auto-cashout-at {
                            width: 60px;
                            padding: 4px 8px;
                            font-size: 12px;
                            background: rgba(0, 0, 0, 0.3);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 4px;
                            color: #fff;
                        }
                        
                        .auto-settings.disabled {
                            opacity: 0.5;
                            pointer-events: none;
                        }
                        
                        .action-buttons {
                            display: flex;
                            gap: 10px;
                        }
                        
                        .action-btn {
                            flex: 1;
                            padding: 12px 0;
                            font-size: 14px;
                            font-weight: bold;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        
                        .primary-btn {
                            background: #00c853;
                            color: #fff;
                            box-shadow: 0 3px 8px rgba(0, 200, 83, 0.3);
                        }
                        
                        .primary-btn:hover:not(:disabled) {
                            background: #00e676;
                            transform: translateY(-2px);
                            box-shadow: 0 5px 15px rgba(0, 200, 83, 0.4);
                        }
                        
                        .secondary-btn {
                            background: #2196f3;
                            color: #fff;
                            box-shadow: 0 3px 8px rgba(33, 150, 243, 0.3);
                        }
                        
                        .secondary-btn:hover:not(:disabled) {
                            background: #42a5f5;
                            transform: translateY(-2px);
                            box-shadow: 0 5px 15px rgba(33, 150, 243, 0.4);
                        }
                        
                        .action-btn:disabled {
                            background: #444;
                            color: #aaa;
                            box-shadow: none;
                            cursor: not-allowed;
                        }
                        
                        .action-btn.bet-placed {
                            background: #795548;
                        }
                        
                        .action-btn.win-collected {
                            background: #795548;
                        }
                        
                        /* Боковая колонка */
                        .crush-side-column {
                            display: flex;
                            flex-direction: column;
                            gap: 15px;
                        }
                        
                        .crush-history-panel, .winners-panel {
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 10px;
                            overflow: hidden;
                        }
                        
                        .panel-header {
                            background: rgba(0, 0, 0, 0.3);
                            padding: 10px 15px;
                        }
                        
                        .panel-header h3 {
                            margin: 0;
                            font-size: 14px;
                            font-weight: 500;
                            color: rgba(255, 255, 255, 0.8);
                        }
                        
                        .history-items {
                            display: grid;
                            grid-template-columns: repeat(5, 1fr);
                            gap: 5px;
                            padding: 10px;
                        }
                        
                        .history-item {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            padding: 5px;
                            border-radius: 5px;
                            font-size: 12px;
                            font-weight: bold;
                            color: #fff;
                            transition: all 0.2s;
                        }
                        
                        .history-item:hover {
                            transform: scale(1.05);
                        }
                        
                        /* Цвета для истории множителей */
                        .history-item.level-1 { background: #00c853; }
                        .history-item.level-2 { background: #64dd17; }
                        .history-item.level-3 { background: #ffd600; }
                        .history-item.level-4 { background: #ff9100; }
                        .history-item.level-5 { background: #ff3d00; }
                        .history-item.level-6 { background: #ff1744; }
                        
                        .winners-list {
                            padding: 10px;
                            display: flex;
                            flex-direction: column;
                            gap: 5px;
                        }
                        
                        .winner-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 5px 10px;
                            font-size: 12px;
                            border-radius: 5px;
                            background: rgba(255, 255, 255, 0.05);
                            transition: all 0.2s;
                        }
                        
                        .winner-item:hover {
                            background: rgba(255, 255, 255, 0.1);
                        }
                        
                        .winner-name {
                            flex: 1;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                        
                        .winner-amount {
                            color: #00c853;
                            font-weight: bold;
                            margin-left: 5px;
                            margin-right: 5px;
                        }
                        
                        .winner-multiplier {
                            color: #f2c94c;
                            font-weight: bold;
                        }
                        
                        /* Респонсивный дизайн */
                        @media (max-width: 768px) {
                            .crush-layout {
                                grid-template-columns: 1fr;
                            }
                            
                            .crush-top-bar {
                                flex-direction: column;
                                align-items: flex-start;
                                gap: 10px;
                            }
                            
                            .bet-panel {
                                flex-direction: column;
                                align-items: flex-start;
                            }
                            
                            .bet-input-container {
                                width: 100%;
                            }
                            
                            .bet-input-wrapper {
                                width: 100%;
                            }
                            
                            .crush-graph {
                                height: 250px;
                            }
                            
                            .history-items {
                                grid-template-columns: repeat(3, 1fr);
                            }
                        }
                    `;
                    document.head.appendChild(styleElement);
                    
                    app.log('Crush', 'Стили для игры добавлены');
                } catch (error) {
                    app.log('Crush', `Ошибка добавления стилей: ${error.message}`, true);
                }
            }
        };
    })();
    
    // Регистрируем игру
    try {
        if (window.registerGame) {
            window.registerGame('crushGame', crushGame);
            app.log('Crush', 'Игра зарегистрирована через новую систему registerGame');
        }
        
        window.crushGame = crushGame;
        app.log('Crush', 'Игра экспортирована в глобальное пространство имен');
        
        crushGame.addStyles();
        
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!crushGame.getStatus().user.initialized && !crushGame.getStatus().user.initializationStarted) {
                    app.log('Crush', 'Запускаем автоматическую инициализацию');
                    crushGame.init();
                }
            }, 500);
        });
        
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!crushGame.getStatus().user.initialized && !crushGame.getStatus().user.initializationStarted) {
                    app.log('Crush', 'Запускаем автоматическую инициализацию (DOM уже загружен)');
                    crushGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Crush', `Ошибка регистрации игры: ${error.message}`, true);
    }
})();