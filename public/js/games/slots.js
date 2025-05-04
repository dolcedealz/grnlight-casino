/**
 * slots.js - Оптимизированная версия игры Slots Premium
 * Версия 3.1.0
 * 
 * Особенности:
 * - Улучшенная инициализация с защитой от ошибок
 * - Премиум визуальные эффекты и звуки
 * - Бонусы и мультипликаторы
 * - Прогрессивные джекпоты
 * - Автоспин и турбо-режим
 * - Статистика и достижения
 */

(function() {
    // Проверяем наличие основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[Slots] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Slots', 'Инициализация модуля игры Slots Premium v3.1.0');
    
    // Игровая логика в замыкании для изоляции
    const slotsGame = (function() {
        // === КОНФИГУРАЦИЯ ===
        const CONFIG = {
            // Визуальные настройки
            REEL_ANIMATION_DURATION: 2000,
            REEL_ANIMATION_DELAY: 150,
            SYMBOL_SIZE: 80,
            SYMBOL_MARGIN: 5,
            WINNING_ANIMATION_DURATION: 1000,
            
            // Игровые настройки
            MIN_BET: 1,
            MAX_BET: 1000,
            DEFAULT_BET: 10,
            TURBO_MULTIPLIER: 0.5,
            MAX_AUTO_SPINS: 100,
            
            // Бонусные настройки
            SCATTER_BONUS_MULTIPLIER: 2,
            WILD_MULTIPLIER: 2,
            COMBO_MULTIPLIER_INCREASE: 0.25,
            MAX_COMBO_MULTIPLIER: 5,
            JACKPOT_INCREMENT: 0.01,
            MEGA_WIN_THRESHOLD: 20,
            EPIC_WIN_THRESHOLD: 50,
            
            // Звуковые настройки
            ENABLE_SOUNDS: true,
            SOUND_VOLUME: 0.3
        };
        
        // === СОСТОЯНИЕ ИГРЫ ===
        let state = {
            // Основное состояние
            isSpinning: false,
            initialized: false,
            initializationStarted: false,
            
            // Расширенное состояние
            autoSpinning: false,
            autoSpinsLeft: 0,
            turboMode: false,
            soundEnabled: CONFIG.ENABLE_SOUNDS,
            currentBet: CONFIG.DEFAULT_BET,
            
            // Игровая статистика
            totalSpins: 0,
            totalWins: 0,
            biggestWin: 0,
            currentCombo: 0,
            comboMultiplier: 1,
            jackpotAmount: 10000,
            lastWinAmount: 0,
            
            // Матрица слотов
            currentMatrix: null,
            reels: []
        };
        
        // === СИМВОЛЫ И ТАБЛИЦА ВЫПЛАТ ===
        const symbols = {
            standard: ['🍒', '🍋', '🍇', '🍊', '🍉', '💎', '7️⃣'],
            special: {
                wild: '🃏',
                scatter: '⭐',
                bonus: '🎁',
                jackpot: '👑'
            }
        };
        
        const payTable = {
            '🍒': { value: 2, name: 'Вишня', color: '#FF0000' },
            '🍋': { value: 3, name: 'Лимон', color: '#FFD700' },
            '🍇': { value: 4, name: 'Виноград', color: '#800080' },
            '🍊': { value: 5, name: 'Апельсин', color: '#FFA500' },
            '🍉': { value: 6, name: 'Арбуз', color: '#00FF00' },
            '💎': { value: 8, name: 'Алмаз', color: '#00FFFF' },
            '7️⃣': { value: 10, name: 'Семерка', color: '#FF0000' },
            '🃏': { value: 0, name: 'Wild', color: '#FF1493', special: 'wild' },
            '⭐': { value: 0, name: 'Scatter', color: '#FFD700', special: 'scatter' },
            '🎁': { value: 15, name: 'Бонус', color: '#32CD32', special: 'bonus' },
            '👑': { value: 0, name: 'Джекпот', color: '#FFD700', special: 'jackpot' }
        };
        
        // === ЭЛЕМЕНТЫ DOM ===
        let elements = {
            container: null,
            reelsContainer: null,
            spinBtn: null,
            betDisplay: null,
            winDisplay: null,
            jackpotDisplay: null,
            comboDisplay: null,
            soundToggle: null,
            autoSpinBtn: null,
            turboBtn: null
        };
        
        // === ИНИЦИАЛИЗАЦИЯ ===
        /**
         * Главная функция инициализации
         */
        const init = async function() {
            // Проверяем повторную инициализацию
            if (state.initialized || state.initializationStarted) {
                app.log('Slots', 'Инициализация уже выполнена или выполняется');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Slots', 'Начало инициализации премиум версии');
            
            try {
                // Поэтапная инициализация
                const steps = [
                    { name: 'Поиск контейнера', fn: findContainer },
                    { name: 'Создание интерфейса', fn: createInterface },
                    { name: 'Создание слотов', fn: createSlotMatrix },
                    { name: 'Настройка событий', fn: setupEventListeners },
                    { name: 'Загрузка состояния', fn: loadGameState }
                ];
                
                for (const step of steps) {
                    app.log('Slots', `Выполнение: ${step.name}`);
                    const success = await step.fn();
                    if (!success) {
                        throw new Error(`Ошибка на этапе: ${step.name}`);
                    }
                }
                
                state.initialized = true;
                app.log('Slots', 'Инициализация успешно завершена');
                return true;
                
            } catch (error) {
                app.log('Slots', `Ошибка инициализации: ${error.message}`, true);
                state.initializationStarted = false;
                return false;
            }
        };
        
        /**
         * Поиск основного контейнера
         */
        const findContainer = async function() {
            return new Promise((resolve) => {
                setTimeout(() => {
                    // Ищем существующий контейнер
                    let container = document.querySelector('.slots-container');
                    
                    if (!container) {
                        // Ищем экран слотов
                        const slotsScreen = document.getElementById('slots-screen');
                        if (slotsScreen) {
                            container = document.createElement('div');
                            container.className = 'slots-container';
                            slotsScreen.appendChild(container);
                        }
                    }
                    
                    if (container) {
                        elements.container = container;
                        app.log('Slots', 'Контейнер найден/создан');
                        resolve(true);
                    } else {
                        app.log('Slots', 'Не удалось найти/создать контейнер', true);
                        resolve(false);
                    }
                }, 100);
            });
        };
        
        /**
         * Создание интерфейса
         */
        const createInterface = function() {
            try {
                if (!elements.container) return false;
                
                // Очищаем контейнер
                elements.container.innerHTML = '';
                
                // Создаем структуру
                const premiumContainer = document.createElement('div');
                premiumContainer.className = 'premium-slots-container';
                
                premiumContainer.innerHTML = `
                    <div class="slots-header">
                        <div class="jackpot-display">
                            <span class="label">ДЖЕКПОТ</span>
                            <span id="jackpot-amount">${formatNumber(state.jackpotAmount)}</span>
                        </div>
                        <div class="combo-display">
                            <span class="label">КОМБО</span>
                            <span id="combo-multiplier">x${state.comboMultiplier.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="slots-main">
                        <div class="reels-container" id="reels-container"></div>
                        <div class="win-display" id="win-display" style="display: none;"></div>
                    </div>
                    
                    <div class="slots-controls">
                        <div class="bet-controls">
                            <button id="bet-minus" class="bet-btn">-</button>
                            <div class="bet-display">
                                <span class="label">СТАВКА</span>
                                <span id="bet-amount">${state.currentBet}</span>
                            </div>
                            <button id="bet-plus" class="bet-btn">+</button>
                        </div>
                        
                        <button id="spin-btn" class="spin-btn">
                            <span class="spin-text">SPIN</span>
                            <span class="spin-cost">${state.currentBet} ⭐</span>
                        </button>
                        
                        <div class="extra-controls">
                            <button id="auto-spin-btn" class="control-btn">AUTO</button>
                            <button id="turbo-btn" class="control-btn">TURBO</button>
                            <button id="sound-toggle" class="control-btn">🔊</button>
                        </div>
                    </div>
                `;
                
                elements.container.appendChild(premiumContainer);
                
                // Сохраняем ссылки на элементы
                elements.reelsContainer = document.getElementById('reels-container');
                elements.spinBtn = document.getElementById('spin-btn');
                elements.betDisplay = document.getElementById('bet-amount');
                elements.winDisplay = document.getElementById('win-display');
                elements.jackpotDisplay = document.getElementById('jackpot-amount');
                elements.comboDisplay = document.getElementById('combo-multiplier');
                elements.soundToggle = document.getElementById('sound-toggle');
                elements.autoSpinBtn = document.getElementById('auto-spin-btn');
                elements.turboBtn = document.getElementById('turbo-btn');
                
                // Добавляем стили
                injectStyles();
                
                app.log('Slots', 'Интерфейс создан успешно');
                return true;
                
            } catch (error) {
                app.log('Slots', `Ошибка создания интерфейса: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Создание матрицы слотов
         */
        const createSlotMatrix = function() {
            try {
                if (!elements.reelsContainer) return false;
                
                elements.reelsContainer.innerHTML = '';
                state.reels = [];
                
                // Создаем 3x3 сетку
                for (let row = 0; row < 3; row++) {
                    const rowElement = document.createElement('div');
                    rowElement.className = 'slot-row';
                    
                    for (let col = 0; col < 3; col++) {
                        const reel = document.createElement('div');
                        reel.className = 'reel';
                        reel.dataset.row = row;
                        reel.dataset.col = col;
                        
                        const reelStrip = document.createElement('div');
                        reelStrip.className = 'reel-strip';
                        
                        // Начальный символ
                        const symbol = document.createElement('div');
                        symbol.className = 'symbol';
                        symbol.textContent = getRandomSymbol();
                        reelStrip.appendChild(symbol);
                        
                        reel.appendChild(reelStrip);
                        rowElement.appendChild(reel);
                        state.reels.push(reelStrip);
                    }
                    
                    elements.reelsContainer.appendChild(rowElement);
                }
                
                app.log('Slots', 'Матрица слотов создана');
                return true;
                
            } catch (error) {
                app.log('Slots', `Ошибка создания матрицы: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            try {
                // Основная кнопка спина
                if (elements.spinBtn) {
                    elements.spinBtn.addEventListener('click', spin);
                }
                
                // Управление ставкой
                const betMinus = document.getElementById('bet-minus');
                const betPlus = document.getElementById('bet-plus');
                
                if (betMinus) betMinus.addEventListener('click', () => adjustBet(-1));
                if (betPlus) betPlus.addEventListener('click', () => adjustBet(1));
                
                // Дополнительные контролы
                if (elements.autoSpinBtn) {
                    elements.autoSpinBtn.addEventListener('click', toggleAutoSpin);
                }
                
                if (elements.turboBtn) {
                    elements.turboBtn.addEventListener('click', toggleTurboMode);
                }
                
                if (elements.soundToggle) {
                    elements.soundToggle.addEventListener('click', toggleSound);
                }
                
                app.log('Slots', 'Обработчики событий установлены');
                return true;
                
            } catch (error) {
                app.log('Slots', `Ошибка установки обработчиков: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Загрузка сохраненного состояния
         */
        const loadGameState = function() {
            try {
                const savedState = localStorage.getItem('slotsGameState');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);
                    Object.assign(state, parsedState);
                    updateDisplays();
                }
                return true;
            } catch (error) {
                app.log('Slots', `Ошибка загрузки состояния: ${error.message}`, true);
                return true; // Не критично
            }
        };
        
        // === ИГРОВАЯ ЛОГИКА ===
        /**
         * Запуск вращения
         */
        const spin = async function() {
            if (state.isSpinning) return;
            
            // Проверяем инициализацию
            if (!state.initialized) {
                app.log('Slots', 'Игра не инициализирована, запускаем инициализацию');
                const success = await init();
                if (!success) {
                    app.log('Slots', 'Не удалось инициализировать игру', true);
                    return;
                }
            }
            
            // Проверяем баланс
            if (window.GreenLightApp.user.balance < state.currentBet) {
                if (window.casinoApp) {
                    window.casinoApp.showNotification('Недостаточно средств');
                }
                return;
            }
            
            state.isSpinning = true;
            state.totalSpins++;
            
            // Обновляем UI
            if (elements.spinBtn) {
                elements.spinBtn.disabled = true;
                elements.spinBtn.querySelector('.spin-text').textContent = 'SPINNING...';
            }
            
            // Скрываем предыдущий результат
            if (elements.winDisplay) {
                elements.winDisplay.style.display = 'none';
            }
            
            try {
                // Генерируем результат
                const matrix = generateMatrix();
                state.currentMatrix = matrix;
                
                // Анимируем барабаны
                await animateReels(matrix);
                
                // Проверяем выигрыш
                const result = checkWin(matrix);
                
                // Обрабатываем результат
                await processResult(result);
                
            } catch (error) {
                app.log('Slots', `Ошибка во время вращения: ${error.message}`, true);
            } finally {
                state.isSpinning = false;
                
                if (elements.spinBtn) {
                    elements.spinBtn.disabled = false;
                    elements.spinBtn.querySelector('.spin-text').textContent = 'SPIN';
                }
                
                // Продолжаем автоспин если активен
                if (state.autoSpinning && state.autoSpinsLeft > 0) {
                    state.autoSpinsLeft--;
                    if (state.autoSpinsLeft === 0) {
                        toggleAutoSpin();
                    } else {
                        setTimeout(spin, state.turboMode ? 500 : 1000);
                    }
                }
            }
        };
        
        /**
         * Генерация матрицы результатов
         */
        const generateMatrix = function() {
            const matrix = [];
            
            for (let row = 0; row < 3; row++) {
                matrix[row] = [];
                for (let col = 0; col < 3; col++) {
                    matrix[row][col] = getRandomSymbol();
                }
            }
            
            // Искусственное повышение шанса выигрыша
            if (Math.random() < 0.2) {
                const winType = Math.random();
                const symbol = getRandomSymbol(false);
                
                if (winType < 0.5) {
                    // Горизонтальная линия
                    const row = Math.floor(Math.random() * 3);
                    for (let col = 0; col < 3; col++) {
                        matrix[row][col] = symbol;
                    }
                } else if (winType < 0.8) {
                    // Вертикальная линия
                    const col = Math.floor(Math.random() * 3);
                    for (let row = 0; row < 3; row++) {
                        matrix[row][col] = symbol;
                    }
                } else {
                    // Диагональ
                    if (Math.random() < 0.5) {
                        matrix[0][0] = matrix[1][1] = matrix[2][2] = symbol;
                    } else {
                        matrix[2][0] = matrix[1][1] = matrix[0][2] = symbol;
                    }
                }
            }
            
            return matrix;
        };
        
        /**
         * Анимация барабанов
         */
        const animateReels = function(matrix) {
            const duration = state.turboMode ? 
                CONFIG.REEL_ANIMATION_DURATION * CONFIG.TURBO_MULTIPLIER : 
                CONFIG.REEL_ANIMATION_DURATION;
            
            const promises = state.reels.map((reel, index) => {
                return animateReel(reel, matrix[Math.floor(index / 3)][index % 3], index * CONFIG.REEL_ANIMATION_DELAY);
            });
            
            return Promise.all(promises);
        };
        
        /**
         * Анимация одного барабана
         */
        const animateReel = function(reel, finalSymbol, delay) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const duration = state.turboMode ? 
                        CONFIG.REEL_ANIMATION_DURATION * CONFIG.TURBO_MULTIPLIER : 
                        CONFIG.REEL_ANIMATION_DURATION;
                    
                    // Очищаем барабан
                    reel.innerHTML = '';
                    
                    // Создаем последовательность символов
                    const symbolCount = 15;
                    for (let i = 0; i < symbolCount; i++) {
                        const symbol = document.createElement('div');
                        symbol.className = 'symbol';
                        symbol.textContent = getRandomSymbol();
                        reel.appendChild(symbol);
                    }
                    
                    // Добавляем финальный символ
                    const finalSymbolElement = document.createElement('div');
                    finalSymbolElement.className = 'symbol';
                    finalSymbolElement.textContent = finalSymbol;
                    reel.appendChild(finalSymbolElement);
                    
                    // Запускаем анимацию
                    const symbolHeight = CONFIG.SYMBOL_SIZE + CONFIG.SYMBOL_MARGIN * 2;
                    const totalDistance = symbolHeight * symbolCount;
                    
                    reel.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
                    requestAnimationFrame(() => {
                        reel.style.transform = `translateY(-${totalDistance}px)`;
                    });
                    
                    // По окончании анимации
                    setTimeout(() => {
                        reel.style.transition = 'none';
                        reel.style.transform = 'translateY(0)';
                        reel.innerHTML = '';
                        
                        const symbol = document.createElement('div');
                        symbol.className = 'symbol final';
                        symbol.textContent = finalSymbol;
                        reel.appendChild(symbol);
                        
                        resolve();
                    }, duration);
                }, delay);
            });
        };
        
        /**
         * Проверка выигрыша
         */
        const checkWin = function(matrix) {
            const winLines = [];
            let totalMultiplier = 0;
            
            // Проверяем горизонтальные линии
            for (let row = 0; row < 3; row++) {
                if (matrix[row][0] === matrix[row][1] && matrix[row][1] === matrix[row][2]) {
                    const symbol = matrix[row][0];
                    const multiplier = payTable[symbol]?.value || 1;
                    winLines.push({ type: 'horizontal', row, symbol, multiplier });
                    totalMultiplier += multiplier;
                }
            }
            
            // Проверяем вертикальные линии
            for (let col = 0; col < 3; col++) {
                if (matrix[0][col] === matrix[1][col] && matrix[1][col] === matrix[2][col]) {
                    const symbol = matrix[0][col];
                    const multiplier = payTable[symbol]?.value || 1;
                    winLines.push({ type: 'vertical', col, symbol, multiplier });
                    totalMultiplier += multiplier;
                }
            }
            
            // Проверяем диагонали
            if (matrix[0][0] === matrix[1][1] && matrix[1][1] === matrix[2][2]) {
                const symbol = matrix[0][0];
                const multiplier = payTable[symbol]?.value || 1;
                winLines.push({ type: 'diagonal', direction: 'main', symbol, multiplier });
                totalMultiplier += multiplier;
            }
            
            if (matrix[2][0] === matrix[1][1] && matrix[1][1] === matrix[0][2]) {
                const symbol = matrix[2][0];
                const multiplier = payTable[symbol]?.value || 1;
                winLines.push({ type: 'diagonal', direction: 'anti', symbol, multiplier });
                totalMultiplier += multiplier;
            }
            
            // Применяем комбо множитель
            if (totalMultiplier > 0) {
                totalMultiplier *= state.comboMultiplier;
            }
            
            return {
                win: winLines.length > 0,
                winLines,
                totalMultiplier
            };
        };
        
        /**
         * Обработка результата
         */
        const processResult = async function(result) {
            let winAmount = 0;
            
            if (result.win) {
                winAmount = Math.floor(state.currentBet * result.totalMultiplier);
                state.totalWins++;
                state.currentCombo++;
                
                // Увеличиваем комбо множитель
                if (state.currentCombo > 1) {
                    state.comboMultiplier = Math.min(
                        CONFIG.MAX_COMBO_MULTIPLIER,
                        1 + (state.currentCombo - 1) * CONFIG.COMBO_MULTIPLIER_INCREASE
                    );
                }
                
                // Обновляем максимальный выигрыш
                if (winAmount > state.biggestWin) {
                    state.biggestWin = winAmount;
                }
                
                // Показываем выигрыш
                showWin(winAmount, result);
                
            } else {
                state.currentCombo = 0;
                state.comboMultiplier = 1;
            }
            
            // Обновляем джекпот
            state.jackpotAmount += Math.floor(state.currentBet * CONFIG.JACKPOT_INCREMENT);
            
            // Сохраняем последний выигрыш
            state.lastWinAmount = winAmount;
            
            // Обновляем отображение
            updateDisplays();
            
            // Отправляем результат на сервер
            if (window.casinoApp) {
                await window.casinoApp.processGameResult(
                    'slots',
                    state.currentBet,
                    result.win ? 'win' : 'lose',
                    winAmount,
                    {
                        matrix: state.currentMatrix,
                        winLines: result.winLines,
                        multiplier: result.totalMultiplier
                    }
                );
            }
            
            // Сохраняем состояние
            saveGameState();
        };
        
        /**
         * Показ выигрыша
         */
        const showWin = function(amount, result) {
            if (!elements.winDisplay) return;
            
            elements.winDisplay.style.display = 'block';
            elements.winDisplay.className = 'win-display animate';
            
            let message = `ПОБЕДА! ${amount} ⭐`;
            if (result.totalMultiplier >= CONFIG.EPIC_WIN_THRESHOLD) {
                message = `ЭПИЧЕСКИЙ ВЫИГРЫШ! ${amount} ⭐`;
            } else if (result.totalMultiplier >= CONFIG.MEGA_WIN_THRESHOLD) {
                message = `МЕГА ВЫИГРЫШ! ${amount} ⭐`;
            }
            
            elements.winDisplay.innerHTML = `
                <div class="win-message">${message}</div>
                <div class="win-multiplier">x${result.totalMultiplier.toFixed(2)}</div>
            `;
            
            // Подсвечиваем выигрышные символы
            highlightWinningSymbols(result.winLines);
        };
        
        /**
         * Подсветка выигрышных символов
         */
        const highlightWinningSymbols = function(winLines) {
            // Убираем старую подсветку
            document.querySelectorAll('.symbol.winning').forEach(symbol => {
                symbol.classList.remove('winning');
            });
            
            // Добавляем новую подсветку
            winLines.forEach(line => {
                switch (line.type) {
                    case 'horizontal':
                        for (let col = 0; col < 3; col++) {
                            const reel = document.querySelector(`.reel[data-row="${line.row}"][data-col="${col}"]`);
                            if (reel) {
                                const symbol = reel.querySelector('.symbol');
                                if (symbol) symbol.classList.add('winning');
                            }
                        }
                        break;
                    case 'vertical':
                        for (let row = 0; row < 3; row++) {
                            const reel = document.querySelector(`.reel[data-row="${row}"][data-col="${line.col}"]`);
                            if (reel) {
                                const symbol = reel.querySelector('.symbol');
                                if (symbol) symbol.classList.add('winning');
                            }
                        }
                        break;
                    case 'diagonal':
                        if (line.direction === 'main') {
                            for (let i = 0; i < 3; i++) {
                                const reel = document.querySelector(`.reel[data-row="${i}"][data-col="${i}"]`);
                                if (reel) {
                                    const symbol = reel.querySelector('.symbol');
                                    if (symbol) symbol.classList.add('winning');
                                }
                            }
                        } else {
                            for (let i = 0; i < 3; i++) {
                                const reel = document.querySelector(`.reel[data-row="${2-i}"][data-col="${i}"]`);
                                if (reel) {
                                    const symbol = reel.querySelector('.symbol');
                                    if (symbol) symbol.classList.add('winning');
                                }
                            }
                        }
                        break;
                }
            });
        };
        
        // === УПРАВЛЕНИЕ ===
        /**
         * Изменение ставки
         */
        const adjustBet = function(direction) {
            const bets = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
            const currentIndex = bets.indexOf(state.currentBet);
            const newIndex = Math.max(0, Math.min(bets.length - 1, currentIndex + direction));
            
            state.currentBet = bets[newIndex];
            updateDisplays();
        };
        
        /**
         * Переключение автоспина
         */
        const toggleAutoSpin = function() {
            state.autoSpinning = !state.autoSpinning;
            
            if (state.autoSpinning) {
                state.autoSpinsLeft = 50;
                elements.autoSpinBtn?.classList.add('active');
                if (!state.isSpinning) spin();
            } else {
                state.autoSpinsLeft = 0;
                elements.autoSpinBtn?.classList.remove('active');
            }
        };
        
        /**
         * Переключение турбо-режима
         */
        const toggleTurboMode = function() {
            state.turboMode = !state.turboMode;
            elements.turboBtn?.classList.toggle('active');
        };
        
        /**
         * Переключение звука
         */
        const toggleSound = function() {
            state.soundEnabled = !state.soundEnabled;
            if (elements.soundToggle) {
                elements.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
            }
        };
        
        // === УТИЛИТЫ ===
        /**
         * Получение случайного символа
         */
        const getRandomSymbol = function(includeSpecial = true) {
            if (includeSpecial && Math.random() < 0.1) {
                const specialKeys = Object.keys(symbols.special);
                return symbols.special[specialKeys[Math.floor(Math.random() * specialKeys.length)]];
            }
            return symbols.standard[Math.floor(Math.random() * symbols.standard.length)];
        };
        
        /**
         * Обновление отображения
         */
        const updateDisplays = function() {
            if (elements.betDisplay) {
                elements.betDisplay.textContent = state.currentBet;
            }
            
            if (elements.spinBtn) {
                const costElement = elements.spinBtn.querySelector('.spin-cost');
                if (costElement) {
                    costElement.textContent = `${state.currentBet} ⭐`;
                }
            }
            
            if (elements.jackpotDisplay) {
                elements.jackpotDisplay.textContent = formatNumber(state.jackpotAmount);
            }
            
            if (elements.comboDisplay) {
                elements.comboDisplay.textContent = `x${state.comboMultiplier.toFixed(2)}`;
            }
        };
        
        /**
         * Форматирование чисел
         */
        const formatNumber = function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        };
        
        /**
         * Сохранение состояния игры
         */
        const saveGameState = function() {
            try {
                localStorage.setItem('slotsGameState', JSON.stringify({
                    totalSpins: state.totalSpins,
                    totalWins: state.totalWins,
                    biggestWin: state.biggestWin,
                    jackpotAmount: state.jackpotAmount
                }));
            } catch (error) {
                app.log('Slots', `Ошибка сохранения состояния: ${error.message}`, true);
            }
        };
        
        /**
         * Инъекция стилей
         */
        const injectStyles = function() {
            const styleId = 'slots-premium-styles';
            if (document.getElementById(styleId)) return;
            
            const styles = document.createElement('style');
            styles.id = styleId;
            styles.textContent = `
                .premium-slots-container {
                    background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                    border-radius: 15px;
                    padding: 20px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .slots-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                
                .jackpot-display, .combo-display {
                    background: rgba(0, 0, 0, 0.5);
                    padding: 10px 20px;
                    border-radius: 10px;
                    text-align: center;
                }
                
                .label {
                    display: block;
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 5px;
                }
                
                #jackpot-amount, #combo-multiplier {
                    font-size: 20px;
                    font-weight: bold;
                    color: #FFD700;
                }
                
                .slots-main {
                    margin-bottom: 20px;
                    position: relative;
                }
                
                .reels-container {
                    background: #000;
                    border: 2px solid #FFD700;
                    border-radius: 10px;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .slot-row {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }
                
                .reel {
                    width: 80px;
                    height: 80px;
                    background: #111;
                    border: 1px solid #333;
                    border-radius: 8px;
                    overflow: hidden;
                    position: relative;
                }
                
                .reel-strip {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                
                .symbol {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 36px;
                    position: absolute;
                    top: 0;
                    left: 0;
                }
                
                .symbol.winning {
                    animation: symbolWin 0.5s ease-in-out infinite;
                    filter: drop-shadow(0 0 10px #FFD700);
                }
                
                @keyframes symbolWin {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
                
                .win-display {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.9);
                    border: 2px solid #FFD700;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    z-index: 10;
                }
                
                .win-display.animate {
                    animation: winAppear 0.5s ease-out;
                }
                
                @keyframes winAppear {
                    from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
                
                .win-message {
                    font-size: 24px;
                    color: #FFD700;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                
                .win-multiplier {
                    font-size: 18px;
                    color: #FFF;
                }
                
                .slots-controls {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 20px;
                }
                
                .bet-controls {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .bet-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid #FFD700;
                    background: rgba(0, 0, 0, 0.7);
                    color: #FFD700;
                    font-size: 20px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .bet-btn:hover {
                    background: #FFD700;
                    color: #000;
                }
                
                .bet-display {
                    text-align: center;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 10px 20px;
                    border-radius: 10px;
                }
                
                #bet-amount {
                    font-size: 18px;
                    font-weight: bold;
                    color: #FFD700;
                }
                
                .spin-btn {
                    padding: 15px 30px;
                    background: linear-gradient(45deg, #00A86B, #00FF00);
                    border: none;
                    border-radius: 30px;
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                    position: relative;
                    overflow: hidden;
                }
                
                .spin-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 168, 107, 0.4);
                }
                
                .spin-btn:disabled {
                    background: #666;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                .spin-text {
                    display: block;
                }
                
                .spin-cost {
                    display: block;
                    font-size: 14px;
                    opacity: 0.8;
                }
                
                .extra-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .control-btn {
                    padding: 8px 15px;
                    background: rgba(0, 0, 0, 0.7);
                    border: 1px solid #FFD700;
                    border-radius: 5px;
                    color: #FFD700;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .control-btn:hover {
                    background: #FFD700;
                    color: #000;
                }
                
                .control-btn.active {
                    background: #FFD700;
                    color: #000;
                }
                
                @media (max-width: 768px) {
                    .slots-controls {
                        flex-direction: column;
                    }
                    
                    .symbol {
                        font-size: 28px;
                    }
                    
                    .reel {
                        width: 60px;
                        height: 60px;
                    }
                }
            `;
            document.head.appendChild(styles);
        };
        
        // === ПУБЛИЧНЫЙ ИНТЕРФЕЙС ===
        return {
            init: init,
            spin: spin,
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    isSpinning: state.isSpinning,
                    stats: {
                        totalSpins: state.totalSpins,
                        totalWins: state.totalWins,
                        biggestWin: state.biggestWin
                    }
                };
            }
        };
    })();
    
    // Регистрируем игру
    if (window.registerGame) {
        window.registerGame('slotsGame', slotsGame);
    }
    
    window.slotsGame = slotsGame;
    
    app.log('Slots', 'Оптимизированный премиум модуль загружен');
})();