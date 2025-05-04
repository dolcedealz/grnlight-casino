/**
 * miner.js - Оптимизированная версия игры Miner
 * Версия 3.1.0
 * 
 * Улучшения:
 * - Удалена отладочная информация о расположении мин
 * - Добавлена дополнительная защита от читерства
 * - Зашифрована информация о минах в памяти
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
    // Проверяем наличие основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[Miner] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Miner', 'Инициализация модуля игры Miner v3.1.0');
    
    // Игровая логика в замыкании для изоляции
    const minerGame = (function() {
        // Элементы игры
        let elements = {
            newGameBtn: null,
            cashoutBtn: null,
            minerBet: null,
            minesCount: null,
            minerGrid: null,
            potentialWin: null,
            minerResult: null,
            container: null,
            multiplierDisplay: null,
            safeCountDisplay: null,
            infoPanel: null
        };
        
        // Приватное хранилище для мин (зашифрованное)
        let _minesData = null;
        
        // Функция шифрования
        const encodeData = function(data) {
            // Простое шифрование для обфускации данных
            return btoa(JSON.stringify(data).split('').map(c => 
                String.fromCharCode(c.charCodeAt(0) + 7)
            ).join(''));
        };
        
        // Функция дешифрования
        const decodeData = function(encoded) {
            try {
                return JSON.parse(atob(encoded).split('').map(c => 
                    String.fromCharCode(c.charCodeAt(0) - 7)
                ).join(''));
            } catch (e) {
                return [];
            }
        };
        
        // Состояние игры
        let state = {
            isPlaying: false,
            initialized: false,
            initializationStarted: false,
            gameData: {
                grid: [],
                revealedCells: [],
                totalCells: 25,  // 5x5 сетка
                minesCount: 3,
                currentMultiplier: 1,
                betAmount: 0,
                baseMultiplier: 1.0,
                maxMultiplier: 1000 // Максимальный множитель для баланса
            }
        };
        
        // Конфигурация множителей для разного количества мин
        const MULTIPLIER_CONFIG = {
            1: { base: 1.05, growth: 0.15 },
            3: { base: 1.12, growth: 0.25 },
            5: { base: 1.25, growth: 0.35 },
            10: { base: 1.5, growth: 0.5 },
            15: { base: 2.0, growth: 0.75 },
            20: { base: 3.0, growth: 1.0 },
            24: { base: 25.0, growth: 5.0 }
        };
  
        /**
         * Создание основного контейнера для игры
         */
        const createGameContainer = function() {
            try {
                // Проверяем, существует ли уже контейнер
                let container = document.querySelector('.miner-container');
                if (container) {
                    elements.container = container;
                    return container;
                }
                
                // Ищем экран игры
                const minerScreen = document.getElementById('miner-screen');
                if (!minerScreen) {
                    app.log('Miner', 'Экран игры не найден', true);
                    return null;
                }
                
                // Создаем контейнер для игры
                container = document.createElement('div');
                container.className = 'miner-container game-container';
                minerScreen.appendChild(container);
                
                elements.container = container;
                app.log('Miner', 'Создан основной контейнер для игры');
                
                return container;
            } catch (error) {
                app.log('Miner', `Ошибка создания контейнера: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Создание интерфейса игры
         */
        const createGameInterface = function() {
            try {
                const container = elements.container || createGameContainer();
                if (!container) {
                    app.log('Miner', 'Невозможно создать интерфейс: контейнер не найден', true);
                    return false;
                }
                
                // Проверяем, не создан ли уже интерфейс
                if (container.querySelector('#miner-grid')) {
                    app.log('Miner', 'Интерфейс уже создан');
                    return true;
                }
                
                // Создаем HTML разметку для игры
                container.innerHTML = `
                    <div class="miner-header">
                        <div class="game-info-panel">
                            <div class="info-item">
                                <span class="info-label">Множитель:</span>
                                <span id="current-multiplier" class="info-value multiplier-value">1.00x</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Безопасные:</span>
                                <span id="safe-count" class="info-value">0/25</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Потенциальный выигрыш:</span>
                                <span id="potential-win" class="info-value win-value">0 ⭐</span>
                            </div>
                        </div>
                    </div>
                    
                    <div id="miner-grid" class="miner-grid">
                        <!-- Сетка будет создана динамически -->
                    </div>
                    
                    <div id="miner-result" class="result hidden"></div>
                    
                    <div class="miner-controls">
                        <div class="bet-settings">
                            <div class="control-group">
                                <label for="miner-bet">Ставка:</label>
                                <input type="number" id="miner-bet" min="1" max="1000" value="10" class="bet-input">
                            </div>
                            
                            <div class="control-group">
                                <label for="mines-count">Мины:</label>
                                <select id="mines-count" class="mines-select">
                                    <option value="1">1 мина</option>
                                    <option value="3" selected>3 мины</option>
                                    <option value="5">5 мин</option>
                                    <option value="10">10 мин</option>
                                    <option value="15">15 мин</option>
                                    <option value="20">20 мин</option>
                                    <option value="24">24 мины</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="game-buttons">
                            <button id="new-game-btn" class="action-btn primary-btn">НОВАЯ ИГРА</button>
                            <button id="cashout-btn" class="action-btn secondary-btn" disabled>ЗАБРАТЬ</button>
                        </div>
                    </div>
                `;
                
                // Создаем стили, если их еще нет
                if (!document.getElementById('miner-styles')) {
                    const styleElement = document.createElement('style');
                    styleElement.id = 'miner-styles';
                    styleElement.textContent = `
                        .miner-container {
                            padding: 20px;
                            max-width: 600px;
                            margin: 0 auto;
                            font-family: 'Arial', sans-serif;
                        }
                        
                        .miner-header {
                            margin-bottom: 20px;
                            background: rgba(255, 255, 255, 0.05);
                            border-radius: 12px;
                            padding: 15px;
                        }
                        
                        .game-info-panel {
                            display: flex;
                            justify-content: space-around;
                            align-items: center;
                        }
                        
                        .info-item {
                            text-align: center;
                        }
                        
                        .info-label {
                            display: block;
                            font-size: 12px;
                            color: #888;
                            margin-bottom: 5px;
                        }
                        
                        .info-value {
                            font-size: 18px;
                            font-weight: bold;
                            color: white;
                        }
                        
                        .multiplier-value {
                            color: #4CAF50;
                        }
                        
                        .win-value {
                            color: #FFD700;
                        }
                        
                        .miner-grid {
                            display: grid;
                            grid-template-columns: repeat(5, 1fr);
                            gap: 8px;
                            margin: 20px auto;
                            max-width: 400px;
                            perspective: 1000px;
                        }
                        
                        .grid-cell {
                            aspect-ratio: 1;
                            background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            cursor: pointer;
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            position: relative;
                            transform-style: preserve-3d;
                        }
                        
                        .grid-cell:hover {
                            transform: translateY(-2px) scale(1.05);
                            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                            border-color: rgba(255, 255, 255, 0.2);
                        }
                        
                        .grid-cell.active-cell {
                            cursor: pointer;
                        }
                        
                        .grid-cell.active-cell:hover {
                            background: linear-gradient(135deg, #3a3a3a, #2a2a2a);
                        }
                        
                        .grid-cell.revealed {
                            background: linear-gradient(135deg, #4CAF50, #43A047);
                            transform: rotateY(180deg);
                            cursor: default;
                            border-color: #66BB6A;
                        }
                        
                        .grid-cell.mine {
                            background: linear-gradient(135deg, #333, #222);
                            cursor: default;
                        }
                        
                        .grid-cell.exploded {
                            background: linear-gradient(135deg, #F44336, #D32F2F);
                            animation: explode 0.5s ease-out;
                            border-color: #EF5350;
                        }
                        
                        .miner-controls {
                            margin-top: 20px;
                        }
                        
                        .bet-settings {
                            display: flex;
                            gap: 20px;
                            margin-bottom: 15px;
                            justify-content: center;
                        }
                        
                        .control-group {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .control-group label {
                            color: #888;
                            font-size: 14px;
                        }
                        
                        .bet-input, .mines-select {
                            padding: 8px 12px;
                            border-radius: 6px;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            background: rgba(255, 255, 255, 0.05);
                            color: white;
                            font-size: 14px;
                        }
                        
                        .mines-select:disabled {
                            opacity: 0.5;
                            cursor: not-allowed;
                        }
                        
                        .game-buttons {
                            display: flex;
                            gap: 15px;
                            justify-content: center;
                        }
                        
                        .action-btn {
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-weight: bold;
                            font-size: 16px;
                            cursor: pointer;
                            transition: all 0.2s;
                            border: none;
                            min-width: 140px;
                        }
                        
                        .primary-btn {
                            background: linear-gradient(135deg, #4CAF50, #43A047);
                            color: white;
                        }
                        
                        .primary-btn:hover:not(:disabled) {
                            transform: translateY(-1px);
                            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                        }
                        
                        .secondary-btn {
                            background: linear-gradient(135deg, #2196F3, #1E88E5);
                            color: white;
                        }
                        
                        .secondary-btn:hover:not(:disabled) {
                            transform: translateY(-1px);
                            box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
                        }
                        
                        .action-btn:disabled {
                            background: #555;
                            cursor: not-allowed;
                            opacity: 0.7;
                        }
                        
                        .result {
                            margin: 20px 0;
                            padding: 15px;
                            border-radius: 8px;
                            text-align: center;
                            font-weight: bold;
                            transition: all 0.3s;
                        }
                        
                        .result.hidden {
                            opacity: 0;
                            transform: translateY(-10px);
                            display: none;
                        }
                        
                        .result.win {
                            background: rgba(76, 175, 80, 0.2);
                            border: 1px solid #4CAF50;
                            color: #81C784;
                        }
                        
                        .result.lose {
                            background: rgba(244, 67, 54, 0.2);
                            border: 1px solid #F44336;
                            color: #E57373;
                        }
                        
                        @keyframes explode {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.2); }
                            100% { transform: scale(1); }
                        }
                        
                        .cell-back {
                            width: 100%;
                            height: 100%;
                            position: absolute;
                            backface-visibility: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        
                        .cell-front {
                            transform: rotateY(180deg);
                        }
                        
                        @keyframes pulse {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                            100% { transform: scale(1); }
                        }
                        
                        .pulse {
                            animation: pulse 1s infinite;
                        }
                    `;
                    document.head.appendChild(styleElement);
                }
                
                app.log('Miner', 'Интерфейс игры успешно создан');
                return true;
            } catch (error) {
                app.log('Miner', `Ошибка создания интерфейса: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Инициализация игры
         * С защитой от повторной инициализации и таймаутом
         */
        const init = async function() {
            // Предотвращаем повторную инициализацию
            if (state.initialized || state.initializationStarted) {
                app.log('Miner', 'Инициализация уже выполнена или выполняется');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Miner', 'Начало инициализации игры');
            
            try {
                // Устанавливаем таймаут для инициализации
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Сначала создаем интерфейс
                        if (!createGameInterface()) {
                            app.log('Miner', 'Не удалось создать интерфейс игры', true);
                            resolve(false);
                            return;
                        }
                        
                        // Затем получаем элементы DOM
                        await findDOMElements();
                        
                        // Создаем игровую сетку
                        createGrid();
                        
                        // Обновляем потенциальный выигрыш
                        updatePotentialWin();
                        
                        // Добавляем обработчики событий
                        setupEventListeners();
                        
                        state.initialized = true;
                        app.log('Miner', 'Инициализация успешно завершена');
                        resolve(true);
                    } catch (innerError) {
                        app.log('Miner', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                // Устанавливаем таймаут (3 секунды)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Miner', 'Таймаут инициализации', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Используем Promise.race для предотвращения зависания
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('Miner', `Критическая ошибка инициализации: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Поиск DOM элементов с защитой от null
         */
        const findDOMElements = async function() {
            // Используем Promise для асинхронности
            return new Promise((resolve, reject) => {
                try {
                    // Таймаут для ожидания готовности DOM
                    setTimeout(() => {
                        elements.newGameBtn = document.getElementById('new-game-btn');
                        elements.cashoutBtn = document.getElementById('cashout-btn');
                        elements.minerBet = document.getElementById('miner-bet');
                        elements.minesCount = document.getElementById('mines-count');
                        elements.minerGrid = document.getElementById('miner-grid');
                        elements.potentialWin = document.getElementById('potential-win');
                        elements.minerResult = document.getElementById('miner-result');
                        elements.multiplierDisplay = document.getElementById('current-multiplier');
                        elements.safeCountDisplay = document.getElementById('safe-count');
                        
                        // Проверяем критические элементы и сообщаем о них
                        if (!elements.newGameBtn) {
                            app.log('Miner', 'Предупреждение: элемент new-game-btn не найден', true);
                        } else {
                            app.log('Miner', 'Элемент new-game-btn найден успешно');
                        }
                        
                        if (!elements.minerGrid) {
                            app.log('Miner', 'Предупреждение: элемент miner-grid не найден', true);
                        } else {
                            app.log('Miner', 'Элемент miner-grid найден успешно');
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('Miner', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                    reject(error);
                }
            });
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            try {
                // Кнопка новой игры
                if (elements.newGameBtn) {
                    // Очищаем текущие обработчики (предотвращаем дублирование)
                    const newGameBtn = elements.newGameBtn.cloneNode(true);
                    if (elements.newGameBtn.parentNode) {
                        elements.newGameBtn.parentNode.replaceChild(newGameBtn, elements.newGameBtn);
                    }
                    elements.newGameBtn = newGameBtn;
                    
                    // Добавляем обработчик
                    elements.newGameBtn.addEventListener('click', startNewGame);
                    app.log('Miner', 'Обработчик для кнопки новой игры установлен');
                } else {
                    app.log('Miner', 'Невозможно установить обработчик: кнопка новой игры не найдена', true);
                }
                
                // Кнопка вывода выигрыша
                if (elements.cashoutBtn) {
                    const cashoutBtn = elements.cashoutBtn.cloneNode(true);
                    if (elements.cashoutBtn.parentNode) {
                        elements.cashoutBtn.parentNode.replaceChild(cashoutBtn, elements.cashoutBtn);
                    }
                    elements.cashoutBtn = cashoutBtn;
                    
                    elements.cashoutBtn.addEventListener('click', cashout);
                    app.log('Miner', 'Обработчик для кнопки вывода выигрыша установлен');
                }
                
                // Выбор количества мин
                if (elements.minesCount) {
                    elements.minesCount.addEventListener('change', updateMineCount);
                    app.log('Miner', 'Обработчик для выбора количества мин установлен');
                }
                
                // Изменение ставки
                if (elements.minerBet) {
                    elements.minerBet.addEventListener('input', updatePotentialWin);
                    app.log('Miner', 'Обработчик для изменения ставки установлен');
                }
                
                app.log('Miner', 'Обработчики событий установлены');
            } catch (error) {
                app.log('Miner', `Ошибка установки обработчиков: ${error.message}`, true);
            }
        };
        
        /**
         * Создание игровой сетки
         */
        const createGrid = function() {
            try {
                if (!elements.minerGrid) {
                    app.log('Miner', 'Невозможно создать сетку: элемент minerGrid не найден', true);
                    return;
                }
                
                // Очищаем текущую сетку
                elements.minerGrid.innerHTML = '';
                
                // Создаем сетку 5x5
                for (let i = 0; i < 5; i++) {
                    for (let j = 0; j < 5; j++) {
                        const cell = document.createElement('div');
                        cell.className = 'grid-cell';
                        cell.dataset.row = i;
                        cell.dataset.col = j;
                        cell.dataset.index = i * 5 + j;
                        
                        // Создаем внутреннюю структуру ячейки
                        const cellInner = document.createElement('div');
                        cellInner.className = 'cell-inner';
                        
                        const cellBack = document.createElement('div');
                        cellBack.className = 'cell-back';
                        
                        const cellFront = document.createElement('div');
                        cellFront.className = 'cell-front';
                        
                        cellInner.appendChild(cellBack);
                        cellInner.appendChild(cellFront);
                        cell.appendChild(cellInner);
                        
                        // Добавляем обработчик только если игра активна
                        if (state.isPlaying) {
                            cell.addEventListener('click', () => revealCell(i * 5 + j));
                            cell.classList.add('active-cell');
                        }
                        
                        elements.minerGrid.appendChild(cell);
                    }
                }
                
                app.log('Miner', 'Игровая сетка создана успешно');
            } catch (error) {
                app.log('Miner', `Ошибка создания сетки: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление количества мин
         */
        const updateMineCount = function() {
            try {
                // Если игра уже началась, не позволяем менять количество мин
                if (state.isPlaying) {
                    // Возвращаем предыдущее значение
                    if (elements.minesCount) {
                        elements.minesCount.value = state.gameData.minesCount;
                    }
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Нельзя изменить количество мин во время игры');
                    }
                    return;
                }
                
                if (!elements.minesCount) {
                    app.log('Miner', 'Элемент minesCount не найден', true);
                    return;
                }
                
                state.gameData.minesCount = parseInt(elements.minesCount.value);
                
                // Обновляем отображение
                updatePotentialWin();
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                app.log('Miner', `Количество мин обновлено: ${state.gameData.minesCount}`);
            } catch (error) {
                app.log('Miner', `Ошибка обновления количества мин: ${error.message}`, true);
            }
        };
        
        /**
         * Расчет множителя выигрыша
         * Используем вероятностную формулу для честного расчета
         */
        const calculateMultiplier = function(revealed, total, mines) {
            if (revealed === 0) return 1.0;
            
            try {
                const safeSpots = total - mines;
                let probability = 1;
                
                // Рассчитываем вероятность безопасного выбора для каждого хода
                for (let i = 0; i < revealed; i++) {
                    probability *= (safeSpots - i) / (total - i);
                }
                
                // Множитель = 1 / вероятность (с корректировкой для баланса)
                let multiplier = 1 / probability;
                
                // Применяем конфигурацию для баланса игры
                const config = MULTIPLIER_CONFIG[mines] || MULTIPLIER_CONFIG[3];
                multiplier = config.base + (multiplier - 1) * config.growth;
                
                // Ограничиваем максимальный множитель
                multiplier = Math.min(multiplier, state.gameData.maxMultiplier);
                
                // Округляем до 2 знаков после запятой
                return Math.floor(multiplier * 100) / 100;
            } catch (error) {
                app.log('Miner', `Ошибка расчета множителя: ${error.message}`, true);
                return 1.0;
            }
        };
        
        /**
         * Обновление отображения потенциального выигрыша
         */
        const updatePotentialWin = function() {
            try {
                if (!elements.potentialWin || !elements.minerBet) {
                    return;
                }
                
                const betAmt = parseInt(elements.minerBet.value) || 0;
                const revealedCount = state.gameData.revealedCells.length;
                
                // Рассчитываем множитель
                const multiplier = calculateMultiplier(
                    revealedCount,
                    state.gameData.totalCells,
                    state.gameData.minesCount
                );
                
                // Рассчитываем потенциальный выигрыш
                const potential = Math.floor(betAmt * multiplier);
                
                // Обновляем отображение
                elements.potentialWin.textContent = `${potential} ⭐`;
                
                if (elements.multiplierDisplay) {
                    elements.multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
                    
                    // Добавляем визуальные эффекты для больших множителей
                    if (multiplier >= 5) {
                        elements.multiplierDisplay.classList.add('pulse');
                    } else {
                        elements.multiplierDisplay.classList.remove('pulse');
                    }
                }
                
                if (elements.safeCountDisplay) {
                    const safeCells = state.gameData.totalCells - state.gameData.minesCount;
                    elements.safeCountDisplay.textContent = `${revealedCount}/${safeCells}`;
                }
                
                // Обновляем игровые данные
                state.gameData.currentMultiplier = multiplier;
                
                app.log('Miner', `Потенциальный выигрыш обновлен: ${potential}, множитель: ${multiplier}`);
            } catch (error) {
                app.log('Miner', `Ошибка обновления потенциального выигрыша: ${error.message}`, true);
            }
        };
        
        /**
         * Начало новой игры
         */
        const startNewGame = async function() {
            app.log('Miner', 'Запуск новой игры');
            
            // Проверяем инициализацию
            if (!state.initialized) {
                app.log('Miner', 'Игра не инициализирована, запускаем инициализацию', true);
                await init();
                
                // Если инициализация не удалась, выходим
                if (!state.initialized) {
                    app.log('Miner', 'Не удалось запустить игру: ошибка инициализации', true);
                    return;
                }
            }
            
            try {
                // Проверка наличия casinoApp
                if (!window.casinoApp) {
                    app.log('Miner', 'casinoApp не найден', true);
                    alert('Ошибка инициализации приложения');
                    return;
                }
                
                // Проверка наличия элементов
                if (!elements.minerBet) {
                    app.log('Miner', 'Элемент ставки не найден', true);
                    return;
                }
                
                // Получаем размер ставки
                const betAmount = parseInt(elements.minerBet.value);
                
                // Проверяем ставку
                if (isNaN(betAmount) || betAmount <= 0) {
                    window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                    return;
                }
                
                // Проверяем, достаточно ли средств (если есть информация о балансе)
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Недостаточно средств для ставки');
                    return;
                }
                
                // Сбрасываем игровое состояние
                state.isPlaying = true;
                state.gameData = {
                    grid: Array(state.gameData.totalCells).fill('empty'),
                    revealedCells: [],
                    totalCells: 25,
                    minesCount: parseInt(elements.minesCount ? elements.minesCount.value : 3),
                    currentMultiplier: 1.0,
                    betAmount: betAmount,
                    maxMultiplier: 1000
                };
                
                // Очищаем предыдущие данные о минах
                _minesData = null;
                
                // Размещаем мины
                placeMines();
                
                // Обновляем интерфейс
                createGrid();
                
                // Блокируем выбор количества мин
                if (elements.minesCount) {
                    elements.minesCount.disabled = true;
                }
                
                // Обновляем кнопки
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true; // Отключаем пока не откроем хотя бы одну ячейку
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = true;
                }
                
                // Скрываем результат
                if (elements.minerResult) {
                    elements.minerResult.className = 'result hidden';
                    elements.minerResult.textContent = '';
                }
                
                // Тактильная обратная связь
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Обрабатываем начальную ставку
                await window.casinoApp.processGameResult(
                    'miner',
                    betAmount,
                    'bet',
                    0,
                    { 
                        minesCount: state.gameData.minesCount
                    }
                );
                
                // Обновляем отображение потенциального выигрыша
                updatePotentialWin();
                
                app.log('Miner', 'Новая игра успешно начата');
            } catch (error) {
                app.log('Miner', `Ошибка запуска новой игры: ${error.message}`, true);
                state.isPlaying = false;
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = false;
                }
                
                if (elements.minesCount) {
                    elements.minesCount.disabled = false;
                }
            }
        };
        
        /**
         * Размещение мин (без вывода позиций в консоль)
         */
        const placeMines = function() {
            try {
                // Создаем новый массив для мин
                const mines = [];
                
                // Размещаем новые мины
                while (mines.length < state.gameData.minesCount) {
                    const randomIndex = Math.floor(Math.random() * state.gameData.totalCells);
                    
                    // Добавляем только если это не мина
                    if (!mines.includes(randomIndex)) {
                        mines.push(randomIndex);
                        state.gameData.grid[randomIndex] = 'mine';
                    }
                }
                
                // Зашифровываем позиции мин
                _minesData = encodeData(mines);
                
                // НЕ выводим позиции мин в консоль для безопасности
                app.log('Miner', 'Мины размещены');
            } catch (error) {
                app.log('Miner', `Ошибка размещения мин: ${error.message}`, true);
            }
        };
        
        /**
         * Проверка, является ли ячейка миной
         * Использует зашифрованные данные
         */
        const isMine = function(index) {
            if (!_minesData) return false;
            
            try {
                const mines = decodeData(_minesData);
                return mines.includes(index);
            } catch (error) {
                app.log('Miner', `Ошибка проверки мины: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Открытие ячейки
         */
        const revealCell = async function(index) {
            try {
                // Проверяем, уже открыта ли ячейка
                if (state.gameData.revealedCells.includes(index)) {
                    return;
                }
                
                // Проверяем, активна ли игра
                if (!state.isPlaying) {
                    return;
                }
                
                // Получаем элемент ячейки
                const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                if (!cell) {
                    app.log('Miner', `Ячейка с индексом ${index} не найдена`, true);
                    return;
                }
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                // Проверяем, является ли ячейка миной (используем зашифрованные данные)
                if (isMine(index)) {
                    // Игра окончена - нашли мину
                    revealAllMines();
                    
                    // Обновляем интерфейс
                    cell.classList.add('mine', 'exploded');
                    const cellFront = cell.querySelector('.cell-front');
                    if (cellFront) {
                        cellFront.innerHTML = '💥';
                    } else {
                        cell.innerHTML = '💥';
                    }
                    
                    // Вибрация при взрыве
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('error');
                    }
                    
                    // Устанавливаем игровое состояние
                    state.isPlaying = false;
                    
                    if (elements.cashoutBtn) {
                        elements.cashoutBtn.disabled = true;
                    }
                    
                    if (elements.newGameBtn) {
                        elements.newGameBtn.disabled = false;
                    }
                    
                    if (elements.minesCount) {
                        elements.minesCount.disabled = false;
                    }
                    
                    // Показываем результат
                    if (elements.minerResult) {
                        elements.minerResult.textContent = 'Бум! Вы наткнулись на мину. Игра окончена!';
                        elements.minerResult.className = 'result lose';
                    }
                    
                    // Обрабатываем проигрыш (НЕ отправляем позиции мин на сервер)
                    if (window.casinoApp) {
                        await window.casinoApp.processGameResult(
                            'miner',
                            0, // Нет дополнительной ставки
                            'lose',
                            0,
                            {
                                revealedCells: state.gameData.revealedCells,
                                hitMine: index,
                                finalMultiplier: state.gameData.currentMultiplier,
                                minesCount: state.gameData.minesCount
                            }
                        );
                    }
                } else {
                    // Безопасная ячейка
                    state.gameData.revealedCells.push(index);
                    
                    // Обновляем интерфейс
                    cell.classList.add('revealed');
                    const cellFront = cell.querySelector('.cell-front');
                    if (cellFront) {
                        cellFront.innerHTML = '💰';
                    } else {
                        cell.innerHTML = '💰';
                    }
                    
                    // Включаем кнопку вывода средств после первой открытой ячейки
                    if (state.gameData.revealedCells.length === 1 && elements.cashoutBtn) {
                        elements.cashoutBtn.disabled = false;
                    }
                    
                    // Обновляем множитель и потенциальный выигрыш
                    updatePotentialWin();
                    
                    // Тактильная обратная связь для безопасной ячейки
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('success');
                    }
                    
                    // Проверяем, все ли безопасные ячейки открыты (условие победы)
                    if (state.gameData.revealedCells.length === state.gameData.totalCells - state.gameData.minesCount) {
                        // Игрок открыл все безопасные ячейки
                        await automaticCashout();
                    }
                }
            } catch (error) {
                app.log('Miner', `Ошибка открытия ячейки: ${error.message}`, true);
            }
        };
        
        /**
         * Открытие всех мин
         */
        const revealAllMines = function() {
            try {
                if (!_minesData) return;
                
                const mines = decodeData(_minesData);
                
                mines.forEach(index => {
                    const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                    if (cell && !cell.classList.contains('exploded')) {
                        cell.classList.add('mine');
                        const cellFront = cell.querySelector('.cell-front');
                        if (cellFront) {
                            cellFront.innerHTML = '💣';
                        } else {
                            cell.innerHTML = '💣';
                        }
                        
                        // Небольшая задержка для каждой мины
                        const delay = Math.random() * 300;
                        setTimeout(() => {
                            cell.classList.add('mine-reveal');
                        }, delay);
                    }
                });
            } catch (error) {
                app.log('Miner', `Ошибка открытия всех мин: ${error.message}`, true);
            }
        };
        
        /**
         * Вывод выигрыша
         */
        const cashout = async function() {
            try {
                // Проверяем состояние игры
                if (!state.isPlaying || state.gameData.revealedCells.length === 0) {
                    return;
                }
                
                // Проверяем наличие casinoApp
                if (!window.casinoApp) {
                    return;
                }
                
                // Рассчитываем выигрыш
                const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
                
                // Тактильная обратная связь
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                }
                
                // Обновляем интерфейс
                if (elements.minerResult) {
                    elements.minerResult.innerHTML = `
                        <div class="win-icon">🎉</div>
                        <div class="win-title">Вы выиграли ${winAmount} Stars!</div>
                        <div class="win-multiplier">Множитель: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                    `;
                    elements.minerResult.className = 'result win';
                }
                
                // Сбрасываем игровое состояние
                state.isPlaying = false;
                
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true;
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = false;
                }
                
                if (elements.minesCount) {
                    elements.minesCount.disabled = false;
                }
                
                // Показываем все мины
                revealAllMines();
                
                // Обрабатываем выигрыш (НЕ отправляем позиции мин на сервер)
                await window.casinoApp.processGameResult(
                    'miner',
                    0, // Нет дополнительной ставки
                    'win',
                    winAmount,
                    {
                        revealedCells: state.gameData.revealedCells,
                        multiplier: state.gameData.currentMultiplier,
                        minesCount: state.gameData.minesCount
                    }
                );
                
                app.log('Miner', `Успешный вывод выигрыша: ${winAmount} с множителем ${state.gameData.currentMultiplier.toFixed(2)}`);
            } catch (error) {
                app.log('Miner', `Ошибка вывода выигрыша: ${error.message}`, true);
            }
        };
        
        /**
         * Автоматический вывод при открытии всех безопасных ячеек
         */
        const automaticCashout = async function() {
            try {
                // Проверяем состояние игры
                if (!state.isPlaying) {
                    return;
                }
                
                // Проверяем наличие casinoApp
                if (!window.casinoApp) {
                    return;
                }
                
                // Рассчитываем выигрыш
                const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
                
                // Тактильная обратная связь - большой выигрыш
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                    setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
                }
                
                // Обновляем интерфейс
                if (elements.minerResult) {
                    elements.minerResult.innerHTML = `
                        <div class="win-icon">🏆</div>
                        <div class="win-title">Идеально! Вы открыли все безопасные ячейки!</div>
                        <div class="win-amount">Выигрыш: ${winAmount} ⭐</div>
                        <div class="win-multiplier">Множитель: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                    `;
                    elements.minerResult.className = 'result win big-win';
                }
                
                // Сбрасываем игровое состояние
                state.isPlaying = false;
                
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true;
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = false;
                }
                
                if (elements.minesCount) {
                    elements.minesCount.disabled = false;
                }
                
                // Показываем все мины
                revealAllMines();
                
                // Обрабатываем выигрыш
                await window.casinoApp.processGameResult(
                    'miner',
                    0, // Нет дополнительной ставки
                    'win',
                    winAmount,
                    {
                        revealedCells: state.gameData.revealedCells,
                        multiplier: state.gameData.currentMultiplier,
                        minesCount: state.gameData.minesCount,
                        perfectGame: true
                    }
                );
                
                app.log('Miner', `Идеальная игра завершена с выигрышем ${winAmount}`);
            } catch (error) {
                app.log('Miner', `Ошибка автоматического вывода: ${error.message}`, true);
            }
        };
        
        // Возвращаем публичный интерфейс
        return {
            // Основные методы
            init: init,
            startNewGame: startNewGame,
            cashout: cashout,
            
            // Метод для проверки состояния
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isPlaying: state.isPlaying,
                    elementsFound: {
                        newGameBtn: !!elements.newGameBtn,
                        cashoutBtn: !!elements.cashoutBtn,
                        minerBet: !!elements.minerBet,
                        minerGrid: !!elements.minerGrid
                    },
                    gameState: {
                        minesCount: state.gameData.minesCount,
                        revealedCells: state.gameData.revealedCells.length,
                        currentMultiplier: state.gameData.currentMultiplier
                    }
                };
            }
        };
    })();
    
    // Регистрируем игру во всех форматах для максимальной совместимости
    try {
        // 1. Регистрация через новую систему
        if (window.registerGame) {
            window.registerGame('minerGame', minerGame);
            app.log('Miner', 'Игра зарегистрирована через новую систему registerGame');
        }
        
        // 2. Экспорт в глобальное пространство имен (обратная совместимость)
        window.minerGame = minerGame;
        app.log('Miner', 'Игра экспортирована в глобальное пространство имен');
        
        // 3. Сообщаем в лог о завершении загрузки модуля
        app.log('Miner', 'Модуль успешно загружен и готов к инициализации');
        
        // 4. Автоматическая инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                    app.log('Miner', 'Запускаем автоматическую инициализацию');
                    minerGame.init();
                }
            }, 500);
        });
        
        // 5. Если DOM уже загружен, запускаем инициализацию сразу
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                    app.log('Miner', 'Запускаем автоматическую инициализацию (DOM уже загружен)');
                    minerGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Miner', `Ошибка регистрации игры: ${error.message}`, true);
    }
  })();