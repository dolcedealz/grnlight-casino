/**
 * crush.js - Оптимизированная версия игры Crush с общим графиком для всех игроков
 * Версия 4.0.0
 * 
 * Особенности:
 * - Общий график и история для всех игроков
 * - 10-секундная пауза между раундами
 * - Улучшенный пользовательский интерфейс
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
    app.log('Crush', 'Инициализация модуля игры Crush v4.0.0');
    
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
                    <div class="game-info-bar">
                        <div class="info-item">
                            <span class="info-icon">👥</span>
                            <span id="players-online" class="info-value">${globalState.playersOnline}</span>
                            <span class="info-label">игроков онлайн</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">💰</span>
                            <span id="current-bets" class="info-value">0</span>
                            <span class="info-label">ставок в раунде</span>
                        </div>
                    </div>
                    
                    <div class="game-phase-display">
                        <div id="current-phase" class="phase-indicator">Ожидание начала игры</div>
                        <div id="next-round-timer" class="round-timer">
                            Следующий раунд через: <span class="time-value">10</span> сек.
                        </div>
                    </div>
                    
                    <div class="game-controls">
                        <div class="bet-section">
                            <div class="bet-control">
                                <label for="crush-bet">Ставка:</label>
                                <div class="bet-input-group">
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
                                    <input type="number" id="auto-cashout-at" min="1.1" step="0.1" value="2.0">x
                                </div>
                            </div>
                        </div>
                        
                        <div class="multiplier-container">
                            <div class="multiplier-label">Множитель:</div>
                            <div id="multiplier" class="multiplier-value">1.00</div>
                            <div class="multiplier-suffix">x</div>
                        </div>
                        
                        <div id="betting-phase-info" class="betting-phase-info">
                            <p>Разместите вашу ставку до начала раунда!</p>
                        </div>
                        
                        <div class="crush-buttons">
                            <button id="start-crush-btn" class="action-btn">СДЕЛАТЬ СТАВКУ</button>
                            <button id="cash-crush-btn" class="action-btn cashout-btn" disabled>ЗАБРАТЬ</button>
                        </div>
                    </div>
                    
                    <div id="crush-graph" class="crush-graph">
                        <!-- Canvas будет создан динамически -->
                    </div>
                    
                    <div class="crush-side-panel">
                        <div class="crush-history">
                            <h3>История раундов</h3>
                            <div class="history-items"></div>
                        </div>
                        
                        <div id="last-winners" class="last-winners">
                            <h3>Последние выигрыши</h3>
                            <div class="winners-list"></div>
                        </div>
                    </div>
                    
                    <div id="crush-result" class="result"></div>
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
                graphCanvas.width = elements.crushGraph.clientWidth || 300;
                graphCanvas.height = elements.crushGraph.clientHeight || 200;
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
                    graphCanvas.width = elements.crushGraph.clientWidth || 300;
                    graphCanvas.height = elements.crushGraph.clientHeight || 200;
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
                
                // Стиль сетки
                graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                graphCtx.lineWidth = 1;
                
                // Горизонтальные линии
                for (let y = height; y >= 0; y -= height / 5) {
                    graphCtx.beginPath();
                    graphCtx.moveTo(0, y);
                    graphCtx.lineTo(width, y);
                    graphCtx.stroke();
                }
                
                // Вертикальные линии
                for (let x = 0; x < width; x += width / 10) {
                    graphCtx.beginPath();
                    graphCtx.moveTo(x, 0);
                    graphCtx.lineTo(x, height);
                    graphCtx.stroke();
                }
                
                // Рисуем метки множителей
                const multiples = [1, 2, 5, 10, 20];
                graphCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                graphCtx.font = '10px Arial';
                
                multiples.forEach(mult => {
                    const y = height - (mult / 20) * height;
                    graphCtx.fillText(`${mult}x`, 5, y);
                });
                
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
                    const isCrashed = Math.random() > 0.25;
                    const crashValue = isCrashed ? 
                        (1 + Math.random() * Math.random() * 3).toFixed(2) : 
                        (1 + Math.random() * Math.random() * 10).toFixed(2);
                    
                    globalState.gameHistory.push({
                        roundId: globalState.roundId - i - 1,
                        multiplier: parseFloat(crashValue),
                        timestamp: new Date(Date.now() - i * 60000).toISOString(),
                        crashed: isCrashed
                    });
                }
                
                updateHistoryDisplay();
                updateLastWinners();
                
            } catch (error) {
                app.log('Crush', `Ошибка загрузки истории: ${error.message}`, true);
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
                    historyItem.className = `history-item ${item.crashed ? 'crashed' : 'cashed-out'}`;
                    
                    let colorClass = '';
                    if (item.multiplier <= 1.5) {
                        colorClass = 'low';
                    } else if (item.multiplier <= 3) {
                        colorClass = 'medium';
                    } else if (item.multiplier <= 5) {
                        colorClass = 'high';
                    } else {
                        colorClass = 'extreme';
                    }
                    
                    historyItem.classList.add(colorClass);
                    historyItem.innerHTML = `
                        <div class="history-multiplier">${item.multiplier.toFixed(2)}x</div>
                    `;
                    
                    historyItems.appendChild(historyItem);
                });
            } catch (error) {
                app.log('Crush', `Ошибка обновления истории: ${error.message}`, true);
            }
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
                        <span class="winner-amount">+${winner.amount} ⭐</span>
                        <span class="winner-multiplier">${winner.multiplier}x</span>
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
                        elements.currentPhaseDisplay.textContent = 'Ожидание следующего раунда';
                        elements.currentPhaseDisplay.className = 'phase-indicator waiting';
                    } else {
                        elements.currentPhaseDisplay.textContent = 'Ожидание начала игры';
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
                            <p class="betting-phase-message">Сделайте ставку до начала следующего раунда!</p>
                        `;
                    } else if (globalState.isActiveRound && !userState.hasBetInCurrentRound) {
                        elements.bettingPhaseInfo.style.display = 'block';
                        elements.bettingPhaseInfo.innerHTML = `
                            <p class="betting-phase-message">Подождите начала следующего раунда для новой ставки.</p>
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
                
                elements.multiplierDisplay.textContent = displayMultiplier.toFixed(2);
                
                elements.multiplierDisplay.classList.remove('low', 'medium', 'high', 'extreme');
                
                if (displayMultiplier <= 1.5) {
                    elements.multiplierDisplay.classList.add('low');
                } else if (displayMultiplier <= 3) {
                    elements.multiplierDisplay.classList.add('medium');
                } else if (displayMultiplier <= 5) {
                    elements.multiplierDisplay.classList.add('high');
                } else {
                    elements.multiplierDisplay.classList.add('extreme');
                }
                
                // Пульсация при высоких значениях
                if (displayMultiplier > 5) {
                    elements.multiplierDisplay.style.transform = `scale(${1 + Math.sin(Date.now() / 100) * 0.05})`;
                } else {
                    elements.multiplierDisplay.style.transform = 'scale(1)';
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
                
                const maxTime = Math.max(10, globalState.graphPoints[globalState.graphPoints.length - 1].time);
                const maxMult = Math.max(5, ...globalState.graphPoints.map(p => p.multiplier));
                
                // Рисуем линию графика
                graphCtx.beginPath();
                
                const x0 = (globalState.graphPoints[0].time / maxTime) * width;
                const y0 = height - (globalState.graphPoints[0].multiplier / maxMult) * height;
                graphCtx.moveTo(x0, y0);
                
                for (let i = 1; i < globalState.graphPoints.length; i++) {
                    const x = (globalState.graphPoints[i].time / maxTime) * width;
                    const y = height - (globalState.graphPoints[i].multiplier / maxMult) * height;
                    graphCtx.lineTo(x, y);
                }
                
                // Настройки линии
                graphCtx.strokeStyle = 'rgba(0, 168, 107, 0.9)';
                graphCtx.lineWidth = 3;
                graphCtx.shadowColor = 'rgba(0, 168, 107, 0.5)';
                graphCtx.shadowBlur = 15;
                graphCtx.stroke();
                
                // Градиентная заливка под графиком
                const lastX = (globalState.graphPoints[globalState.graphPoints.length - 1].time / maxTime) * width;
                const lastY = height - (globalState.graphPoints[globalState.graphPoints.length - 1].multiplier / maxMult) * height;
                
                graphCtx.lineTo(lastX, height);
                graphCtx.lineTo(0, height);
                graphCtx.closePath();
                
                const gradient = graphCtx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, 'rgba(0, 168, 107, 0.3)');
                gradient.addColorStop(1, 'rgba(0, 168, 107, 0)');
                graphCtx.fillStyle = gradient;
                graphCtx.fill();
                
                // Текущая точка
                graphCtx.beginPath();
                graphCtx.arc(lastX, lastY, 8, 0, Math.PI * 2);
                graphCtx.fillStyle = 'rgba(0, 168, 107, 1)';
                graphCtx.fill();
                graphCtx.strokeStyle = 'white';
                graphCtx.lineWidth = 3;
                graphCtx.shadowBlur = 10;
                graphCtx.stroke();
                
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
                            <div class="cashout-text">Вы вывели деньги при ${globalState.currentMultiplier.toFixed(2)}x!</div>
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
                                <div class="crash-text">Краш при ${globalState.currentMultiplier.toFixed(2)}x!</div>
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
                
                const maxTime = Math.max(10, lastPoint.time);
                const maxMult = Math.max(5, lastPoint.multiplier);
                
                const crashX = (lastPoint.time / maxTime) * width;
                const crashY = height - (lastPoint.multiplier / maxMult) * height;
                
                // Анимация взрыва
                let explosionRadius = 0;
                const animateExplosion = () => {
                    if (explosionRadius < 50) {
                        explosionRadius += 5;
                        
                        graphCtx.beginPath();
                        graphCtx.arc(crashX, crashY, explosionRadius, 0, Math.PI * 2);
                        graphCtx.fillStyle = `rgba(255, 0, 0, ${0.8 - explosionRadius / 50})`;
                        graphCtx.fill();
                        
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
                const houseEdge = 0.03; // 3% преимущество казино
                
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
                            padding: 20px;
                            margin: 0 auto;
                            max-width: 900px;
                        }
                        
                        .game-info-bar {
                            display: flex;
                            justify-content: center;
                            gap: 50px;
                            padding: 15px;
                            background: rgba(0, 0, 0, 0.3);
                            border-radius: 10px;
                            margin-bottom: 20px;
                        }
                        
                        .info-item {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .info-icon {
                            font-size: 24px;
                        }
                        
                        .info-value {
                            font-size: 20px;
                            font-weight: bold;
                            color: var(--gold);
                        }
                        
                        .info-label {
                            font-size: 14px;
                            color: var(--light-gray);
                            margin-left: 5px;
                        }
                        
                        .game-phase-display {
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 10px;
                            padding: 15px;
                            margin-bottom: 20px;
                            text-align: center;
                            border: 1px solid var(--primary-green);
                        }
                        
                        .phase-indicator {
                            font-size: 20px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            transition: all 0.3s ease;
                        }
                        
                        .phase-indicator.active-round {
                            color: var(--primary-green);
                            text-shadow: 0 0 10px var(--primary-green);
                        }
                        
                        .phase-indicator.waiting {
                            color: var(--gold);
                            text-shadow: 0 0 10px var(--gold);
                        }
                        
                        .round-timer {
                            font-size: 16px;
                            color: var(--gold);
                        }
                        
                        .time-value {
                            font-weight: bold;
                            font-size: 20px;
                        }
                        
                        .bet-section {
                            display: flex;
                            gap: 20px;
                            margin-bottom: 20px;
                        }
                        
                        .bet-control {
                            flex: 1;
                        }
                        
                        .bet-input-group {
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                        }
                        
                        #crush-bet {
                            padding: 10px;
                            border-radius: 8px;
                            border: 1px solid var(--primary-green);
                            background: rgba(0, 0, 0, 0.3);
                            color: white;
                            font-size: 16px;
                        }
                        
                        .quick-bet-buttons {
                            display: flex;
                            gap: 10px;
                        }
                        
                        .quick-bet {
                            flex: 1;
                            padding: 8px;
                            border-radius: 6px;
                            border: 1px solid var(--gold);
                            background: rgba(0, 0, 0, 0.5);
                            color: var(--gold);
                            cursor: pointer;
                            transition: all 0.2s ease;
                        }
                        
                        .quick-bet:hover {
                            background: var(--gold);
                            color: black;
                        }
                        
                        .auto-settings {
                            padding: 10px;
                            border: 1px solid #333;
                            border-radius: 8px;
                            background: rgba(0, 0, 0, 0.2);
                        }
                        
                        .auto-settings.disabled {
                            opacity: 0.5;
                            pointer-events: none;
                        }
                        
                        .multiplier-container {
                            text-align: center;
                            margin: 20px 0;
                            padding: 20px;
                            background: rgba(0, 0, 0, 0.4);
                            border-radius: 12px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .multiplier-label {
                            font-size: 24px;
                            color: var(--light-gray);
                        }
                        
                        .multiplier-value {
                            font-size: 48px;
                            font-weight: bold;
                            transition: all 0.1s ease;
                            text-shadow: 0 0 10px currentColor;
                        }
                        
                        .multiplier-suffix {
                            font-size: 32px;
                            color: var(--light-gray);
                        }
                        
                        .multiplier-value.low {
                            color: var(--primary-green);
                        }
                        
                        .multiplier-value.medium {
                            color: var(--gold);
                        }
                        
                        .multiplier-value.high {
                            color: #FF9800;
                        }
                        
                        .multiplier-value.extreme {
                            color: var(--red);
                            animation: pulse 0.5s infinite;
                        }
                        
                        .multiplier-value.crashed {
                            color: var(--red);
                            animation: crash-flash 0.3s 3;
                        }
                        
                        .multiplier-value.cashed-out {
                            color: #2196F3;
                        }
                        
                        @keyframes pulse {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                            100% { transform: scale(1); }
                        }
                        
                        @keyframes crash-flash {
                            0% { opacity: 1; }
                            50% { opacity: 0.3; }
                            100% { opacity: 1; }
                        }
                        
                        .crush-buttons {
                            display: flex;
                            gap: 15px;
                            margin-top: 20px;
                        }
                        
                        .action-btn {
                            flex: 1;
                            padding: 15px;
                            font-size: 18px;
                            font-weight: bold;
                            border-radius: 10px;
                            border: none;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        }
                        
                        #start-crush-btn {
                            background: var(--primary-green);
                            color: white;
                        }
                        
                        #start-crush-btn:hover:not(:disabled) {
                            background: #00c77e;
                            transform: translateY(-2px);
                        }
                        
                        #start-crush-btn.bet-placed {
                            background: #666;
                        }
                        
                        #cash-crush-btn {
                            background: linear-gradient(45deg, #2196F3, #1976D2);
                            color: white;
                        }
                        
                        #cash-crush-btn:hover:not(:disabled) {
                            background: linear-gradient(45deg, #42A5F5, #1E88E5);
                            transform: translateY(-2px);
                        }
                        
                        #cash-crush-btn.win-collected {
                            background: #666;
                        }
                        
                        .action-btn:disabled {
                            opacity: 0.5;
                            cursor: not-allowed;
                            transform: none;
                        }
                        
                        .crush-graph {
                            width: 100%;
                            height: 300px;
                            border: 1px solid #333;
                            border-radius: 10px;
                            margin: 20px 0;
                            position: relative;
                            background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
                            overflow: hidden;
                        }
                        
                        .crush-side-panel {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 20px;
                            margin-top: 20px;
                        }
                        
                        .crush-history, .last-winners {
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 10px;
                            padding: 15px;
                        }
                        
                        .crush-history h3, .last-winners h3 {
                            margin-bottom: 15px;
                            color: var(--gold);
                            font-size: 18px;
                        }
                        
                        .history-items {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 8px;
                        }
                        
                        .history-item {
                            width: 60px;
                            height: 30px;
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                            transition: transform 0.2s ease;
                        }
                        
                        .history-item:hover {
                            transform: scale(1.1);
                        }
                        
                        .history-item.crashed {
                            background: #ef5350;
                        }
                        
                        .history-item.cashed-out {
                            background: #66bb6a;
                        }
                        
                        .history-item.low {
                            opacity: 0.8;
                        }
                        
                        .history-item.medium {
                            opacity: 0.9;
                        }
                        
                        .history-item.high {
                            opacity: 1;
                        }
                        
                        .history-item.extreme {
                            box-shadow: 0 0 5px currentColor;
                        }
                        
                        .winners-list {
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                        }
                        
                        .winner-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 8px 12px;
                            background: rgba(255, 255, 255, 0.05);
                            border-radius: 6px;
                        }
                        
                        .winner-name {
                            color: var(--light-gray);
                        }
                        
                        .winner-amount {
                            color: var(--primary-green);
                            font-weight: bold;
                        }
                        
                        .winner-multiplier {
                            color: var(--gold);
                            font-weight: bold;
                        }
                        
                        .result {
                            margin-top: 20px;
                            padding: 20px;
                            border-radius: 10px;
                            text-align: center;
                            animation: result-appear 0.5s ease;
                        }
                        
                        @keyframes result-appear {
                            from {
                                opacity: 0;
                                transform: translateY(20px);
                            }
                            to {
                                opacity: 1;
                                transform: translateY(0);
                            }
                        }
                        
                        .result.win {
                            background: rgba(76, 175, 80, 0.2);
                            border: 1px solid var(--primary-green);
                        }
                        
                        .result.lose {
                            background: rgba(244, 67, 54, 0.2);
                            border: 1px solid var(--red);
                        }
                        
                        .crash-animation, .cashout-animation {
                            animation: result-pop 0.5s ease;
                        }
                        
                        @keyframes result-pop {
                            0% { transform: scale(0.5); opacity: 0; }
                            80% { transform: scale(1.1); opacity: 0.8; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                        
                        .crash-icon, .cashout-icon {
                            font-size: 48px;
                            margin-bottom: 10px;
                        }
                        
                        .crash-text, .cashout-text {
                            font-size: 24px;
                            font-weight: bold;
                            margin-bottom: 10px;
                        }
                        
                        .win-amount {
                            font-size: 32px;
                            font-weight: bold;
                            color: var(--primary-green);
                        }
                        
                        .lose-message {
                            font-size: 20px;
                            color: var(--red);
                        }
                        
                        @media (max-width: 768px) {
                            .crush-side-panel {
                                grid-template-columns: 1fr;
                            }
                            
                            .game-info-bar {
                                flex-direction: column;
                                gap: 10px;
                            }
                            
                            .multiplier-container {
                                flex-direction: column;
                            }
                            
                            .crush-buttons {
                                flex-direction: column;
                            }
                            
                            .bet-section {
                                flex-direction: column;
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