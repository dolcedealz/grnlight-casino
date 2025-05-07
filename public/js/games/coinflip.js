/**
 * coinflip.js - Улучшенная версия игры "Монетка"
 * Версия 2.0.0
 * 
 * Особенности:
 * - Современный дизайн с улучшенной анимацией
 * - Звуковые эффекты
 * - Оптимизированная инициализация
 * - Совместимость с системой регистрации игр
 * - Адаптивный дизайн
 * - Поддержка русского языка
 */

// Предотвращаем конфликты с другими модулями
(function() {
    // Проверяем наличие основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[CoinFlip] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('CoinFlip', 'Инициализация улучшенного модуля Монетка v2.0.0');
    
    // Игровая логика в замыкании для изоляции
    const coinFlipGame = (function() {
        // Элементы игры
        let elements = {
            flipBtn: null,
            coinBet: null,
            coinElement: null,
            coinResult: null,
            container: null,
            headsBtn: null,
            tailsBtn: null,
            backBtn: null,
            multiplierDisplay: null
        };
        
        // Состояние игры
        let state = {
            isFlipping: false,
            initialized: false,
            initializationStarted: false,
            chosenSide: null,
            betAmount: 10,
            soundEnabled: true
        };
        
        // Звуковые эффекты
        let sounds = {
            flip: null,
            win: null,
            lose: null,
            click: null
        };
        
        /**
         * Создание контейнера игры
         */
        const createGameContainer = function() {
            try {
                app.log('CoinFlip', 'Создание контейнера игры');
                
                // Проверяем наличие экрана для игры
                const gameScreen = document.getElementById('coinflip-screen');
                if (!gameScreen) {
                    // Ищем основной контейнер для создания экрана
                    const mainContent = document.querySelector('.main-content');
                    if (!mainContent) {
                        app.log('CoinFlip', 'Основной контейнер не найден', true);
                        return null;
                    }
                    
                    // Создаем новый экран для игры
                    const newScreen = document.createElement('div');
                    newScreen.id = 'coinflip-screen';
                    newScreen.className = 'screen';
                    mainContent.appendChild(newScreen);
                    
                    app.log('CoinFlip', 'Создан новый экран для игры');
                }
                
                // Получаем экран (существующий или новый)
                const screen = document.getElementById('coinflip-screen');
                
                // Проверяем наличие контейнера игры
                elements.container = screen.querySelector('.coinflip-container');
                if (!elements.container) {
                    elements.container = document.createElement('div');
                    elements.container.className = 'coinflip-container game-container';
                    screen.appendChild(elements.container);
                    
                    app.log('CoinFlip', 'Создан контейнер для игры');
                }
                
                // Добавляем карточку игры на главный экран
                addGameCard();
                
                return elements.container;
            } catch (error) {
                app.log('CoinFlip', `Ошибка создания контейнера: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Добавление карточки игры на главный экран
         */
        const addGameCard = function() {
            try {
                const gameGrid = document.querySelector('.game-grid');
                if (!gameGrid) {
                    app.log('CoinFlip', 'Сетка игр не найдена', true);
                    return;
                }
                
                // Проверяем, есть ли уже карточка
                if (gameGrid.querySelector('.game-card[data-game="coinflip"]')) {
                    return;
                }
                
                // Создаем карточку
                const card = document.createElement('div');
                card.className = 'game-card';
                card.setAttribute('data-game', 'coinflip');
                
                card.innerHTML = `
                    <div class="game-icon">🪙</div>
                    <div class="game-name">Монетка</div>
                `;
                
                // Добавляем в сетку
                gameGrid.appendChild(card);
                
                // Обновляем обработчики для всех карточек
                const gameCards = document.querySelectorAll('.game-card');
                gameCards.forEach(gameCard => {
                    gameCard.addEventListener('click', function() {
                        const game = this.getAttribute('data-game');
                        if (!game) return;
                        
                        // Тактильная обратная связь
                        if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                            window.casinoApp.provideTactileFeedback('light');
                        }
                        
                        // Переключаем экраны
                        document.querySelectorAll('.screen').forEach(screen => {
                            screen.classList.remove('active');
                        });
                        
                        const targetScreen = document.getElementById(`${game}-screen`);
                        if (targetScreen) {
                            targetScreen.classList.add('active');
                        }
                    });
                });
                
                app.log('CoinFlip', 'Карточка игры успешно добавлена');
            } catch (error) {
                app.log('CoinFlip', `Ошибка добавления карточки: ${error.message}`, true);
            }
        };
        
        /**
         * Создание интерфейса игры
         */
        const createGameInterface = function() {
            try {
                const container = elements.container || createGameContainer();
                if (!container) {
                    app.log('CoinFlip', 'Невозможно создать интерфейс: контейнер не найден', true);
                    return false;
                }
                
                // Проверяем, существует ли уже интерфейс
                if (container.querySelector('.coin-element')) {
                    app.log('CoinFlip', 'Интерфейс уже создан');
                    return true;
                }
                
                // Создаем разметку HTML для игры
                container.innerHTML = `
                    <div class="game-header">
                        <button class="back-btn">← Назад</button>
                        <h2>Монетка</h2>
                    </div>
                    
                    <div class="multiplier-container">
                        <span>Множитель:</span>
                        <span class="multiplier-value">2.0x</span>
                    </div>
                    
                    <div class="coin-container">
                        <div class="coin-element" id="coin">
                            <div class="coin-side heads"></div>
                            <div class="coin-side tails"></div>
                        </div>
                    </div>
                    
                    <div class="result-display" id="coin-result"></div>
                    
                    <div class="bet-section">
                        <div class="bet-controls">
                            <div class="bet-input-container">
                                <label for="coin-bet">Ставка:</label>
                                <div class="bet-input-wrapper">
                                    <button class="bet-decrease-btn">-</button>
                                    <input type="number" id="coin-bet" class="bet-input" min="1" max="1000" value="10">
                                    <button class="bet-increase-btn">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="coin-choice">
                        <div class="choice-label">Выберите сторону:</div>
                        <div class="choice-buttons">
                            <button id="choose-heads" class="choice-btn">
                                <span class="choice-icon">🔴</span>
                                <span class="choice-text">Орёл</span>
                            </button>
                            <button id="choose-tails" class="choice-btn">
                                <span class="choice-icon">⚪</span>
                                <span class="choice-text">Решка</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="control-buttons">
                        <button id="flip-btn" class="action-btn">ПОДБРОСИТЬ МОНЕТУ</button>
                        
                        <div class="secondary-controls">
                            <button id="toggle-sound" class="control-btn">
                                <span id="sound-icon">🔊</span>
                            </button>
                        </div>
                    </div>
                `;
                
                app.log('CoinFlip', 'Интерфейс игры успешно создан');
                return true;
            } catch (error) {
                app.log('CoinFlip', `Ошибка создания интерфейса: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Инициализация игры с защитой от повторной инициализации
         */
        const init = async function() {
            // Защита от повторной инициализации
            if (state.initialized || state.initializationStarted) {
                app.log('CoinFlip', 'Инициализация уже выполнена или выполняется');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('CoinFlip', 'Начало инициализации игры');
            
            try {
                // Устанавливаем таймаут для инициализации
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Сначала создаем интерфейс
                        if (!createGameInterface()) {
                            app.log('CoinFlip', 'Не удалось создать интерфейс игры', true);
                            resolve(false);
                            return;
                        }
                        
                        // Загружаем аудио
                        await loadAudio();
                        
                        // Получаем DOM элементы
                        await findDOMElements();
                        
                        // Проверяем UI элементы
                        app.log('CoinFlip', 'Проверка UI элементов');
                        
                        // Добавляем обработчики событий
                        setupEventListeners();
                        
                        state.initialized = true;
                        app.log('CoinFlip', 'Инициализация успешно завершена');
                        resolve(true);
                    } catch (innerError) {
                        app.log('CoinFlip', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                // Устанавливаем таймаут (3 секунды)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('CoinFlip', 'Таймаут инициализации', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Используем Promise.race для предотвращения зависания
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('CoinFlip', `Критическая ошибка инициализации: ${error.message}`, true);
                state.initializationStarted = false;
                return false;
            }
        };
        
        /**
         * Поиск DOM элементов с защитой от null
         */
        const findDOMElements = async function() {
            return new Promise((resolve) => {
                try {
                    // Таймаут для ожидания готовности DOM
                    setTimeout(() => {
                        elements.flipBtn = document.getElementById('flip-btn');
                        elements.coinBet = document.getElementById('coin-bet');
                        elements.coinElement = document.getElementById('coin');
                        elements.coinResult = document.getElementById('coin-result');
                        elements.headsBtn = document.getElementById('choose-heads');
                        elements.tailsBtn = document.getElementById('choose-tails');
                        elements.toggleSound = document.getElementById('toggle-sound');
                        elements.backBtn = document.querySelector('#coinflip-screen .back-btn');
                        elements.multiplierDisplay = document.querySelector('.multiplier-value');
                        elements.betDecreaseBtn = document.querySelector('.bet-decrease-btn');
                        elements.betIncreaseBtn = document.querySelector('.bet-increase-btn');
                        
                        // Проверка критических элементов
                        if (!elements.coinElement) {
                            app.log('CoinFlip', 'Элемент монетки не найден', true);
                        }
                        
                        if (!elements.flipBtn) {
                            app.log('CoinFlip', 'Кнопка броска не найдена', true);
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('CoinFlip', `Ошибка поиска DOM элементов: ${error.message}`, true);
                    resolve(); // Резолвим промис, чтобы не блокировать инициализацию
                }
            });
        };
        
        /**
         * Загрузка аудио файлов
         */
        const loadAudio = async function() {
            try {
                // Создаем аудио объекты
                sounds.flip = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-mechanical-bling-210.mp3');
                sounds.win = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3');
                sounds.lose = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-negative-tone-interface-tap-2301.mp3');
                sounds.click = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3');
                
                // Предзагрузка аудио
                const preloadPromises = [
                    preloadAudio(sounds.flip),
                    preloadAudio(sounds.win),
                    preloadAudio(sounds.lose),
                    preloadAudio(sounds.click)
                ];
                
                // Ждем предзагрузки с таймаутом
                await Promise.race([
                    Promise.all(preloadPromises),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]);
                
                app.log('CoinFlip', 'Аудио успешно загружено');
                return true;
            } catch (error) {
                app.log('CoinFlip', `Ошибка загрузки аудио: ${error.message}`, true);
                // Продолжаем без аудио
                return false;
            }
        };
        
        /**
         * Предзагрузка аудио с промисом
         */
        const preloadAudio = function(audioElement) {
            return new Promise((resolve) => {
                if (!audioElement) {
                    resolve();
                    return;
                }
                
                // Событие загрузки
                audioElement.addEventListener('canplaythrough', () => {
                    resolve();
                }, { once: true });
                
                // Событие ошибки
                audioElement.addEventListener('error', () => {
                    resolve();
                }, { once: true });
                
                // Попытка загрузки
                if (audioElement.readyState >= 3) {
                    resolve();
                } else {
                    audioElement.load();
                }
                
                // Таймаут безопасности
                setTimeout(resolve, 500);
            });
        };
        
        /**
         * Воспроизведение звукового эффекта с проверкой безопасности
         */
        const playSound = function(sound) {
            if (!state.soundEnabled || !sounds[sound]) return;
            
            try {
                // Сбрасываем в начало, если уже воспроизводится
                sounds[sound].currentTime = 0;
                sounds[sound].play().catch(error => {
                    // Игнорируем ошибки воспроизведения (частые на мобильных)
                    app.log('CoinFlip', `Ошибка воспроизведения аудио: ${error.message}`, false);
                });
            } catch (error) {
                // Игнорируем любые ошибки аудио
            }
        };
        
        /**
         * Включение/выключение звука
         */
        const toggleSound = function() {
            state.soundEnabled = !state.soundEnabled;
            
            // Обновляем иконку
            const soundIcon = document.getElementById('sound-icon');
            if (soundIcon) {
                soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
            }
            
            // Воспроизводим звук нажатия, если звук включен
            if (state.soundEnabled) {
                playSound('click');
            }
            
            app.log('CoinFlip', `Звук ${state.soundEnabled ? 'включен' : 'выключен'}`);
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            try {
                // Кнопка броска монеты
                if (elements.flipBtn) {
                    // Очищаем текущие обработчики
                    const newFlipBtn = elements.flipBtn.cloneNode(true);
                    if (elements.flipBtn.parentNode) {
                        elements.flipBtn.parentNode.replaceChild(newFlipBtn, elements.flipBtn);
                    }
                    elements.flipBtn = newFlipBtn;
                    
                    // Добавляем обработчик
                    elements.flipBtn.addEventListener('click', flipCoin);
                }
                
                // Кнопка выбора "Орёл"
                if (elements.headsBtn) {
                    elements.headsBtn.addEventListener('click', () => chooseOption('heads'));
                }
                
                // Кнопка выбора "Решка"
                if (elements.tailsBtn) {
                    elements.tailsBtn.addEventListener('click', () => chooseOption('tails'));
                }
                
                // Кнопка переключения звука
                if (elements.toggleSound) {
                    elements.toggleSound.addEventListener('click', toggleSound);
                }
                
                // Кнопка "Назад"
                if (elements.backBtn) {
                    elements.backBtn.addEventListener('click', () => {
                        playSound('click');
                        
                        // Тактильная обратная связь
                        if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                            window.casinoApp.provideTactileFeedback('light');
                        }
                        
                        // Возвращаемся на главный экран
                        document.querySelectorAll('.screen').forEach(screen => {
                            screen.classList.remove('active');
                        });
                        
                        const welcomeScreen = document.getElementById('welcome-screen');
                        if (welcomeScreen) {
                            welcomeScreen.classList.add('active');
                        }
                    });
                }
                
                // Кнопки для изменения ставки
                if (elements.betDecreaseBtn) {
                    elements.betDecreaseBtn.addEventListener('click', () => {
                        playSound('click');
                        adjustBet(-1);
                    });
                }
                
                if (elements.betIncreaseBtn) {
                    elements.betIncreaseBtn.addEventListener('click', () => {
                        playSound('click');
                        adjustBet(1);
                    });
                }
                
                // Обработчик для поля ввода ставки
                if (elements.coinBet) {
                    elements.coinBet.addEventListener('change', validateBetInput);
                }
                
                app.log('CoinFlip', 'Обработчики событий установлены');
            } catch (error) {
                app.log('CoinFlip', `Ошибка настройки обработчиков событий: ${error.message}`, true);
            }
        };
        
        /**
         * Выбор стороны монеты (орёл или решка)
         */
        const chooseOption = function(option) {
            try {
                state.chosenSide = option;
                
                // Воспроизводим звук нажатия
                playSound('click');
                
                // Обновляем UI
                if (elements.headsBtn) {
                    elements.headsBtn.classList.toggle('selected', option === 'heads');
                }
                
                if (elements.tailsBtn) {
                    elements.tailsBtn.classList.toggle('selected', option === 'tails');
                }
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                app.log('CoinFlip', `Выбрана сторона: ${option === 'heads' ? 'Орёл' : 'Решка'}`);
            } catch (error) {
                app.log('CoinFlip', `Ошибка выбора стороны: ${error.message}`, true);
            }
        };
        
        /**
         * Регулировка суммы ставки
         */
        const adjustBet = function(change) {
            try {
                if (!elements.coinBet) return;
                
                // Получаем текущую ставку
                let currentBet = parseInt(elements.coinBet.value) || 10;
                
                // Общие значения ставок
                const commonBets = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
                
                if (change < 0) {
                    // Уменьшаем ставку
                    let newBet = currentBet;
                    
                    // Находим следующую меньшую общую ставку
                    for (let i = commonBets.length - 1; i >= 0; i--) {
                        if (commonBets[i] < currentBet) {
                            newBet = commonBets[i];
                            break;
                        }
                    }
                    
                    // Гарантируем минимальную ставку
                    currentBet = Math.max(1, newBet);
                } else {
                    // Увеличиваем ставку
                    let newBet = currentBet;
                    
                    // Находим следующую большую общую ставку
                    for (let i = 0; i < commonBets.length; i++) {
                        if (commonBets[i] > currentBet) {
                            newBet = commonBets[i];
                            break;
                        }
                    }
                    
                    // Гарантируем максимальную ставку
                    currentBet = Math.min(1000, newBet);
                }
                
                // Обновляем состояние и поле ввода
                state.betAmount = currentBet;
                elements.coinBet.value = currentBet;
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
            } catch (error) {
                app.log('CoinFlip', `Ошибка регулировки ставки: ${error.message}`, true);
            }
        };
        
        /**
         * Проверка и валидация вводимой ставки
         */
        const validateBetInput = function() {
            try {
                if (!elements.coinBet) return;
                
                // Получаем введенное значение
                let value = parseInt(elements.coinBet.value);
                
                // Проверяем корректность числа
                if (isNaN(value)) {
                    value = 10;
                }
                
                // Ограничиваем диапазон
                value = Math.min(1000, Math.max(1, value));
                
                // Обновляем состояние и поле ввода
                state.betAmount = value;
                elements.coinBet.value = value;
            } catch (error) {
                app.log('CoinFlip', `Ошибка валидации ставки: ${error.message}`, true);
            }
        };
        
        /**
         * Проверка и инициализация объекта casinoApp если он отсутствует
         */
        const ensureCasinoApp = function() {
            if (window.casinoApp) return true;
            
            // Создаем минимальную реализацию casinoApp при отсутствии объекта
            app.log('CoinFlip', 'casinoApp не найден, создаем временную реализацию', true);
            window.casinoApp = {
                showNotification: function(message) {
                    alert(message);
                },
                provideTactileFeedback: function() {
                    // Заглушка для вибрации
                },
                processGameResult: function(gameType, bet, result, win, data) {
                    app.log('CoinFlip', `Игра: ${gameType}, Ставка: ${bet}, Результат: ${result}, Выигрыш: ${win}`, false);
                    return Promise.resolve({success: true});
                }
            };
            
            return true;
        };
        
        /**
         * Бросок монеты
         */
        const flipCoin = async function() {
            app.log('CoinFlip', 'Начинаем бросок монеты');
            
            // Проверяем инициализацию
            if (!state.initialized) {
                app.log('CoinFlip', 'Игра не инициализирована, запускаем инициализацию', true);
                await init();
                
                // Если инициализация неудачна, выходим
                if (!state.initialized) {
                    app.log('CoinFlip', 'Не удалось запустить игру: ошибка инициализации', true);
                    return;
                }
            }
            
            try {
                // Проверяем наличие casinoApp
                if (!ensureCasinoApp()) {
                    return;
                }
                
                // Проверяем, не производится ли уже бросок
                if (state.isFlipping) {
                    app.log('CoinFlip', 'Монета уже в процессе броска');
                    return;
                }
                
                // Проверяем, выбрана ли сторона
                if (!state.chosenSide) {
                    window.casinoApp.showNotification('Пожалуйста, выберите Орёл или Решку');
                    return;
                }
                
                // Получаем сумму ставки
                if (!elements.coinBet) {
                    app.log('CoinFlip', 'Элемент ставки не найден', true);
                    return;
                }
                
                state.betAmount = parseInt(elements.coinBet.value);
                
                // Проверяем ставку
                if (isNaN(state.betAmount) || state.betAmount <= 0) {
                    window.casinoApp.showNotification('Пожалуйста, введите корректную сумму ставки');
                    return;
                }
                
                // Проверяем достаточность средств
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    state.betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Недостаточно средств для этой ставки');
                    return;
                }
                
                // Устанавливаем состояние броска
                state.isFlipping = true;
                
                // Обновляем UI
                if (elements.flipBtn) {
                    elements.flipBtn.disabled = true;
                    elements.flipBtn.textContent = 'ПОДБРАСЫВАЕМ...';
                }
                
                if (elements.headsBtn) {
                    elements.headsBtn.disabled = true;
                }
                
                if (elements.tailsBtn) {
                    elements.tailsBtn.disabled = true;
                }
                
                if (elements.coinResult) {
                    elements.coinResult.className = 'result-display';
                    elements.coinResult.textContent = '';
                }
                
                // Тактильная обратная связь
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Обрабатываем ставку
                await window.casinoApp.processGameResult(
                    'coinflip',
                    state.betAmount,
                    'bet',
                    0,
                    { chosenSide: state.chosenSide }
                );
                
                // Воспроизводим звук броска
                playSound('flip');
                
                // Анимация броска монеты
                const result = await flipCoinWithAnimation();
                
                // Определяем выигрыш/проигрыш
                const isWin = result === state.chosenSide;
                
                // Рассчитываем сумму выигрыша (2x)
                const winAmount = isWin ? state.betAmount * 2 : 0;
                
                // Показываем результат
                displayResult(isWin, winAmount, result);
                
                // Тактильная обратная связь в зависимости от результата
                if (isWin) {
                    if (window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('success');
                    }
                    playSound('win');
                } else {
                    if (window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('warning');
                    }
                    playSound('lose');
                }
                
                // Обрабатываем результат игры
                await window.casinoApp.processGameResult(
                    'coinflip',
                    0, // Нет дополнительной ставки
                    isWin ? 'win' : 'lose',
                    winAmount,
                    {
                        chosenSide: state.chosenSide,
                        result: result,
                        betAmount: state.betAmount
                    }
                );
                
                // Сбрасываем состояние после задержки
                setTimeout(() => {
                    state.isFlipping = false;
                    
                    if (elements.flipBtn) {
                        elements.flipBtn.disabled = false;
                        elements.flipBtn.textContent = 'ПОДБРОСИТЬ МОНЕТУ';
                    }
                    
                    if (elements.headsBtn) {
                        elements.headsBtn.disabled = false;
                    }
                    
                    if (elements.tailsBtn) {
                        elements.tailsBtn.disabled = false;
                    }
                }, 2500);
                
            } catch (error) {
                app.log('CoinFlip', `Ошибка броска монеты: ${error.message}`, true);
                
                // Сбрасываем состояние при ошибке
                state.isFlipping = false;
                
                if (elements.flipBtn) {
                    elements.flipBtn.disabled = false;
                    elements.flipBtn.textContent = 'ПОДБРОСИТЬ МОНЕТУ';
                }
                
                if (elements.headsBtn) {
                    elements.headsBtn.disabled = false;
                }
                
                if (elements.tailsBtn) {
                    elements.tailsBtn.disabled = false;
                }
            }
        };
        
        /**
         * Анимация броска монеты
         */
        const flipCoinWithAnimation = function() {
            return new Promise((resolve) => {
                try {
                    const coin = elements.coinElement;
                    if (!coin) {
                        app.log('CoinFlip', 'Элемент монеты не найден для анимации', true);
                        // Возвращаем случайный результат в любом случае
                        setTimeout(() => {
                            resolve(Math.random() < 0.5 ? 'heads' : 'tails');
                        }, 1000);
                        return;
                    }
                    
                    // Генерируем случайный результат
                    const result = Math.random() < 0.5 ? 'heads' : 'tails';
                    
                    // Удаляем предыдущие классы
                    coin.className = 'coin-element';
                    
                    // Форсируем перерисовку
                    void coin.offsetWidth;
                    
                    // Добавляем класс для анимации
                    coin.classList.add('flipping');
                    
                    // По окончании анимации, устанавливаем финальное состояние
                    setTimeout(() => {
                        coin.className = 'coin-element';
                        coin.classList.add(result);
                        resolve(result);
                    }, 2000);
                    
                } catch (error) {
                    app.log('CoinFlip', `Ошибка анимации броска: ${error.message}`, true);
                    // Возвращаем результат даже при ошибке анимации
                    resolve(Math.random() < 0.5 ? 'heads' : 'tails');
                }
            });
        };
        
        /**
         * Отображение результата игры
         */
        const displayResult = function(isWin, amount, result) {
            try {
                if (!elements.coinResult) {
                    app.log('CoinFlip', 'Элемент отображения результата не найден', true);
                    return;
                }
                
                const resultElement = elements.coinResult;
                const resultLabel = result === 'heads' ? 'ОРЁЛ' : 'РЕШКА';
                
                if (isWin) {
                    resultElement.className = 'result-display win';
                    resultElement.innerHTML = `
                        <div class="win-icon">🎉</div>
                        <div class="win-title">Вы выиграли ${amount} ⭐!</div>
                        <div class="win-description">Выпало: ${resultLabel}</div>
                    `;
                } else {
                    resultElement.className = 'result-display lose';
                    resultElement.innerHTML = `
                        <div class="lose-icon">😢</div>
                        <div class="lose-title">Вы проиграли!</div>
                        <div class="lose-description">Выпало: ${resultLabel}</div>
                    `;
                }
                
            } catch (error) {
                app.log('CoinFlip', `Ошибка отображения результата: ${error.message}`, true);
            }
        };
        
        // Возвращаем публичный интерфейс
        return {
            // Основные методы
            init: init,
            flipCoin: flipCoin,
            
            // Проверка состояния
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isFlipping: state.isFlipping,
                    elementsFound: {
                        flipBtn: !!elements.flipBtn,
                        coinBet: !!elements.coinBet,
                        coinElement: !!elements.coinElement,
                        coinResult: !!elements.coinResult
                    },
                    soundEnabled: state.soundEnabled,
                    chosenSide: state.chosenSide
                };
            },
            
            // Добавление стилей
            addStyles: function() {
                if (document.getElementById('coinflip-styles')) return;
                
                const styleElement = document.createElement('style');
                styleElement.id = 'coinflip-styles';
                styleElement.textContent = `
                    .coinflip-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        max-width: 500px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    
                    .multiplier-container {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 20px;
                        font-size: 1.2rem;
                        background: rgba(0, 0, 0, 0.2);
                        padding: 10px 20px;
                        border-radius: 10px;
                        border: 1px solid rgba(242, 201, 76, 0.3);
                        color: var(--gold);
                    }
                    
                    .multiplier-value {
                        font-weight: bold;
                        color: var(--gold);
                        text-shadow: 0 0 5px rgba(242, 201, 76, 0.5);
                    }
                    
                    .coin-container {
                        width: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 40px 0;
                        position: relative;
                        perspective: 1000px;
                    }
                    
                    .coin-element {
                        width: 150px;
                        height: 150px;
                        position: relative;
                        transform-style: preserve-3d;
                        transition: transform 0.1s;
                    }
                    
                    .coin-element.flipping {
                        animation: flip-coin 2s linear;
                    }
                    
                    .coin-element.heads {
                        transform: rotateY(0deg);
                    }
                    
                    .coin-element.tails {
                        transform: rotateY(180deg);
                    }
                    
                    .coin-side {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        backface-visibility: hidden;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        font-size: 36px;
                        cursor: pointer;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    }
                    
                    .coin-side.heads {
                        background: radial-gradient(#FFD700, #B8860B);
                        z-index: 100;
                    }
                    
                    .coin-side.heads::before {
                        content: "O";
                    }
                    
                    .coin-side.tails {
                        background: radial-gradient(#C0C0C0, #808080);
                        transform: rotateY(180deg);
                    }
                    
                    .coin-side.tails::before {
                        content: "P";
                    }
                    
                    .bet-section {
                        width: 100%;
                        margin-bottom: 20px;
                    }
                    
                    .bet-controls {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                    }
                    
                    .bet-input-container {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }
                    
                    .bet-input-container label {
                        font-size: 0.9rem;
                        color: var(--light-gray);
                    }
                    
                    .bet-input-wrapper {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .bet-decrease-btn, .bet-increase-btn {
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        border: none;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        cursor: pointer;
                        background: var(--medium-gray);
                        color: var(--white);
                        font-size: 18px;
                        font-weight: bold;
                        transition: all 0.2s;
                    }
                    
                    .bet-decrease-btn:hover, .bet-increase-btn:hover {
                        background: var(--primary-green);
                    }
                    
                    .bet-input {
                        width: 80px;
                        padding: 5px 10px;
                        border-radius: 5px;
                        border: 1px solid rgba(242, 201, 76, 0.3);
                        background: rgba(0, 0, 0, 0.2);
                        color: var(--white);
                        text-align: center;
                        font-size: 16px;
                    }
                    
                    .coin-choice {
                        width: 100%;
                        margin-bottom: 20px;
                    }
                    
                    .choice-label {
                        text-align: center;
                        margin-bottom: 10px;
                        color: var(--light-gray);
                        font-size: 0.9rem;
                    }
                    
                    .choice-buttons {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                    }
                    
                    .choice-btn {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        padding: 15px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        background: rgba(30, 30, 30, 0.5);
                        cursor: pointer;
                        transition: all 0.2s;
                        max-width: 120px;
                    }
                    
                    .choice-btn:hover {
                        border-color: var(--primary-green);
                        background: rgba(30, 30, 30, 0.8);
                        transform: translateY(-3px);
                    }
                    
                    .choice-btn.selected {
                        border-color: var(--primary-green);
                        background: rgba(29, 185, 84, 0.2);
                        box-shadow: 0 0 10px rgba(29, 185, 84, 0.3);
                    }
                    
                    .choice-icon {
                        font-size: 24px;
                    }
                    
                    .choice-text {
                        font-size: 14px;
                        font-weight: bold;
                        color: var(--white);
                    }
                    
                    .control-buttons {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    .secondary-controls {
                        display: flex;
                        justify-content: flex-end;
                    }
                    
                    .control-btn {
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        border: none;
                        background: rgba(30, 30, 30, 0.5);
                        color: var(--white);
                        font-size: 20px;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    
                    .control-btn:hover {
                        background: rgba(30, 30, 30, 0.8);
                        transform: scale(1.1);
                    }
                    
                    .result-display {
                        min-height: 100px;
                        margin: 20px 0;
                        padding: 15px;
                        border-radius: 10px;
                        text-align: center;
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        transform: translateY(20px);
                        transition: all 0.3s ease;
                    }
                    
                    .result-display.win {
                        background: rgba(76, 217, 100, 0.1);
                        border: 1px solid var(--win-color);
                        color: var(--win-color);
                        opacity: 1;
                        transform: translateY(0);
                    }
                    
                    .result-display.lose {
                        background: rgba(255, 69, 58, 0.1);
                        border: 1px solid var(--lose-color);
                        color: var(--lose-color);
                        opacity: 1;
                        transform: translateY(0);
                    }
                    
                    .win-icon, .lose-icon {
                        font-size: 36px;
                        margin-bottom: 10px;
                    }
                    
                    .win-title, .lose-title {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    
                    .win-description, .lose-description {
                        font-size: 14px;
                        opacity: 0.8;
                    }
                    
                    /* Анимации */
                    @keyframes flip-coin {
                        0% { transform: rotateY(0) rotateX(0); }
                        100% { transform: rotateY(1800deg) rotateX(1800deg); }
                    }
                    
                    /* Адаптивный дизайн */
                    @media (max-width: 600px) {
                        .coin-element {
                            width: 120px;
                            height: 120px;
                        }
                        
                        .coin-container {
                            padding: 20px 0;
                        }
                        
                        .choice-btn {
                            padding: 10px;
                        }
                        
                        .choice-icon {
                            font-size: 20px;
                        }
                        
                        .choice-text {
                            font-size: 12px;
                        }
                    }
                `;
                document.head.appendChild(styleElement);
            }
        };
    })();
    
    // Регистрируем игру во всех форматах для максимальной совместимости
    try {
        // 1. Добавляем стили
        coinFlipGame.addStyles();
        
        // 2. Регистрация через новую систему
        if (window.registerGame) {
            window.registerGame('coinFlipGame', coinFlipGame);
            app.log('CoinFlip', 'Игра зарегистрирована через систему registerGame');
        }
        
        // 3. Экспорт в глобальное пространство имен (обратная совместимость)
        window.coinFlipGame = coinFlipGame;
        app.log('CoinFlip', 'Игра экспортирована в глобальное пространство имен');
        
        // 4. Отмечаем завершение загрузки модуля
        app.log('CoinFlip', 'Модуль загружен и готов к инициализации');
        
        // 5. Авто-инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!coinFlipGame.getStatus().initialized && !coinFlipGame.getStatus().initializationStarted) {
                    app.log('CoinFlip', 'Запуск автоматической инициализации');
                    coinFlipGame.init();
                }
            }, 500);
        });
        
        // 6. Если DOM уже загружен, инициализируем немедленно
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!coinFlipGame.getStatus().initialized && !coinFlipGame.getStatus().initializationStarted) {
                    app.log('CoinFlip', 'Запуск автоматической инициализации (DOM уже загружен)');
                    coinFlipGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('CoinFlip', `Ошибка регистрации игры: ${error.message}`, true);
    }
})();