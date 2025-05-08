/**
 * crush.js - Оптимизированная версия игры Crush с общим графиком для всех игроков
 * Версия 4.3.5
 * 
 * Особенности:
 * - Общий график и история для всех игроков
 * - 15-секундная пауза между раундами
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
    app.log('Crush', 'Инициализация модуля игры Crush v4.3.5');
    
    // Игровая логика в замыкании для изоляции
    const crushGame = (function() {
        // Элементы игры
        let elements = {
            startBtn: null,
            cashoutBtn: null,
            crushBet: null,
            multiplierDisplay: null,
            potentialWinDisplay: null,
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
        const WAITING_TIME_BETWEEN_ROUNDS = 15; // 15 секунд ожидания между раундами
        const MAX_HISTORY_SIZE = 15;  // Размер истории
        const GAME_UPDATE_INTERVAL = 16;  // 60 FPS для плавной анимации
        const TIMER_UPDATE_INTERVAL = 1000;  // 1 секунда для более точного отсчета таймера
        
        // Звуковые эффекты (предзагрузка для лучшей производительности)
        const sounds = {
            bet: null,
            countdown: null,
            crash: null,
            cashout: null
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
                        // Создаем контейнер игры
                        createGameContainer();
                        
                        // Добавляем стили
                        addStyles();
                        
                        // Настраиваем UI
                        setupUI();
                        
                        // Находим DOM элементы
                        await findDOMElements();
                        
                        // Настраиваем Canvas
                        setupCanvas();
                        
                        // Настраиваем обработчики событий
                        setupEventListeners();
                        
                        // Инициализируем звуки
                        initializeSounds();
                        
                        // Сбрасываем график
                        resetGraph();
                        
                        // Загружаем историю, если она пуста
                        if (globalState.gameHistory.length === 0) {
                            loadHistory();
                        }
                        
                        // Запускаем ожидание нового раунда, если игра не активна
                        if (!globalState.isActiveRound && !globalState.isWaitingForNextRound) {
                            startWaitingForNextRound();
                        }
                        
                        // Обновляем отображение фазы игры
                        updateGamePhaseDisplay();
                        
                        // Применяем оптимизацию после создания UI
                        optimizePerformance();
                        
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
                userState.initializationStarted = false;
                return false;
            }
        };
        
        /**
         * Добавление стилей для игры
         */
        const addStyles = function() {
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
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    /* Верхняя панель */
                    .crush-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 10px;
                        padding: 10px 15px;
                        margin-bottom: 10px;
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
                    
                    /* Основная область с графиком и коэффициентом */
                    .crush-main {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    /* Панель коэффициента и текущего выигрыша */
                    .multiplier-row {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        padding: 10px;
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 10px;
                    }
                    
                    .multiplier-container {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .multiplier-label {
                        font-size: 14px;
                        color: rgba(255, 255, 255, 0.7);
                        margin-bottom: 3px;
                    }
                    
                    .multiplier-display {
                        position: relative;
                    }
                    
                    .multiplier-value {
                        font-size: 42px;
                        font-weight: bold;
                        transition: all 0.2s ease;
                        text-shadow: 0 0 10px currentColor;
                    }
                    
                    .multiplier-x {
                        font-size: 28px;
                        opacity: 0.8;
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
                    
                    /* Текущий выигрыш */
                    .current-win-container {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        margin-left: 20px;
                        border-left: 1px solid rgba(255, 255, 255, 0.1);
                        padding-left: 20px;
                        flex-grow: 1;
                    }
                    
                    .current-win-label {
                        font-size: 14px;
                        color: rgba(255, 255, 255, 0.7);
                        margin-bottom: 3px;
                    }
                    
                    .potential-value {
                        font-size: 32px;
                        font-weight: bold;
                        color: #f2c94c;
                        text-shadow: 0 0 10px rgba(242, 201, 76, 0.5);
                    }
                    
                    /* График игры */
                    .crush-graph-container {
                        position: relative;
                    }
                    
                    .crush-graph {
                        width: 100%;
                        height: 400px;
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
                        background: rgba(0, 0, 0, 0.8);
                        border-radius: 12px;
                        padding: 20px 25px;
                        text-align: center;
                        color: #fff;
                        backdrop-filter: blur(5px);
                        max-width: 400px;
                        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4);
                        z-index: 10;
                        border: 1px solid rgba(242, 201, 76, 0.3);
                    }
                    
                    .betting-phase-message {
                        margin: 0;
                        font-size: 16px;
                        line-height: 1.5;
                        font-weight: 500;
                        color: #FFD54F;
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
                        z-index: 20;
                    }
                    
                    .result.hidden {
                        display: none;
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
                        margin-top: 10px;
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
                    
                    #crush-bet:disabled {
                        opacity: 0.7;
                        cursor: not-allowed;
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
                    
                    /* История и последние победители */
                    .panels-row {
                        display: flex;
                        gap: 15px;
                        margin-top: 10px;
                    }
                    
                    .crush-history-panel, .winners-panel {
                        flex: 1;
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
                        padding: 6px;
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
                    
                    .winner-bet {
                        color: #fff;
                        margin-right: 5px;
                    }
                    
                    .winner-multiplier {
                        color: #f2c94c;
                        font-weight: bold;
                        min-width: 50px;
                        text-align: right;
                    }
                    
                    .winner-amount {
                        color: #00c853;
                        font-weight: bold;
                        margin-left: 10px;
                        min-width: 60px;
                        text-align: right;
                    }
                    
                    /* Улучшенная заметность сообщения об ожидании */
                    @keyframes pulse-message {
                        0% { background-color: rgba(0, 0, 0, 0.7); }
                        50% { background-color: rgba(10, 15, 30, 0.75); }
                        100% { background-color: rgba(0, 0, 0, 0.7); }
                    }
                    
                    .betting-phase-message {
                        animation: pulse-message 2s infinite;
                        color: #ffeb3b;
                        text-shadow: 0 0 5px rgba(255, 235, 59, 0.5);
                    }
                    
                    /* Адаптивный дизайн */
                    @media (max-width: 768px) {
                        .panels-row {
                            flex-direction: column;
                        }
                        
                        .crush-header {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 10px;
                        }
                        
                        .multiplier-row {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        
                        .current-win-container {
                            margin-left: 0;
                            border-left: none;
                            padding-left: 0;
                            margin-top: 10px;
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
                            height: 300px;
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
        };
        
        /**
         * Оптимизация производительности
         */
        const optimizePerformance = function() {
            try {
                // Используем requestAnimationFrame для анимаций вместо setInterval где возможно
                // Применяем технику дросселирования (throttling) для тяжелых функций
                // Минимизируем операции с DOM
                
                // Дебаунс функция для обработчиков событий
                const debounce = function(func, delay) {
                    let timer;
                    return function(...args) {
                        clearTimeout(timer);
                        timer = setTimeout(() => func.apply(this, args), delay);
                    };
                };
                
                // Применяем дебаунс к обработчику изменения размера окна
                window.removeEventListener('resize', handleResize);
                window.addEventListener('resize', debounce(handleResize, 200));
                
                // Оптимизация отрисовки графика
                if (graphCanvas && elements.crushGraph) {
                    // Устанавливаем оптимальный размер canvas для лучшей производительности
                    const containerWidth = elements.crushGraph.clientWidth || 600;
                    const containerHeight = elements.crushGraph.clientHeight || 300;
                    
                    // Учитываем pixel ratio для ретина дисплеев
                    const dpr = window.devicePixelRatio || 1;
                    graphCanvas.width = containerWidth * dpr;
                    graphCanvas.height = containerHeight * dpr;
                    graphCanvas.style.width = `${containerWidth}px`;
                    graphCanvas.style.height = `${containerHeight}px`;
                    
                    if (graphCtx) {
                        graphCtx.scale(dpr, dpr);
                    }
                }
                
                // Обновление потенциального выигрыша при изменении ставки
                if (elements.crushBet) {
                    elements.crushBet.addEventListener('input', updatePotentialWin);
                }
                
                app.log('Crush', 'Оптимизация производительности применена');
            } catch (error) {
                app.log('Crush', `Ошибка оптимизации: ${error.message}`, true);
            }
        };
        
        /**
         * Инициализация звуков
         */
        const initializeSounds = function() {
            try {
                // Создаем и настраиваем аудио элементы
                sounds.bet = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3');
                sounds.countdown = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-tick-tock-clock-timer-1045.mp3');
                sounds.crash = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-explosion-impact-1682.mp3');
                sounds.cashout = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3');
                
                // Настройка громкости
                Object.values(sounds).forEach(sound => {
                    if (sound) {
                        sound.volume = 0.3;
                        // Предзагрузка звуков
                        sound.load();
                    }
                });
                
                app.log('Crush', 'Звуки инициализированы успешно');
            } catch (error) {
                app.log('Crush', `Ошибка инициализации звуков: ${error.message}`, true);
            }
        };
        
        /**
         * Воспроизведение звука (с обработкой ошибок)
         */
        const playSound = function(soundName) {
            try {
                if (sounds[soundName]) {
                    sounds[soundName].currentTime = 0;
                    sounds[soundName].play().catch(() => {
                        // Игнорируем ошибки автовоспроизведения
                    });
                }
            } catch (error) {
                // Игнорируем ошибки звука
            }
        };
        
        /**
         * Поиск DOM элементов
         */
        const findDOMElements = async function() {
            return new Promise((resolve) => {
                try {
                    setTimeout(() => {
                        // Основные элементы
                        elements.startBtn = document.getElementById('start-crush-btn');
                        elements.cashoutBtn = document.getElementById('cash-crush-btn');
                        elements.crushBet = document.getElementById('crush-bet');
                        elements.multiplierDisplay = document.getElementById('multiplier');
                        elements.potentialWinDisplay = document.getElementById('potential-win');
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
                        
                        // Проверка критических элементов
                        if (!elements.crushGraph) {
                            app.log('Crush', 'Элемент графика не найден', true);
                        }
                        if (!elements.startBtn) {
                            app.log('Crush', 'Кнопка ставки не найдена', true);
                        }
                        if (!elements.cashoutBtn) {
                            app.log('Crush', 'Кнопка забрать не найдена', true);
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('Crush', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                    resolve(); // Всё равно резолвим, чтобы продолжить инициализацию
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
                    app.log('Crush', 'Контейнер crush-screen не найден, создаем новый', true);
                    
                    // Пытаемся найти основной контейнер приложения
                    const mainContent = document.querySelector('.main-content');
                    if (mainContent) {
                        // Создаем новый экран
                        const newScreen = document.createElement('div');
                        newScreen.id = 'crush-screen';
                        newScreen.className = 'screen';
                        mainContent.appendChild(newScreen);
                        
                        // Используем новый экран
                        elements.container = document.createElement('div');
                        elements.container.className = 'crush-container';
                        newScreen.appendChild(elements.container);
                        
                        app.log('Crush', 'Создан новый экран и контейнер для игры');
                        return;
                    } else {
                        app.log('Crush', 'Не найден контейнер .main-content', true);
                        return;
                    }
                }
                
                elements.container = crushScreen.querySelector('.crush-container');
                
                if (!elements.container) {
                    elements.container = document.createElement('div');
                    elements.container.className = 'crush-container';
                    crushScreen.appendChild(elements.container);
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
                if (!elements.container) {
                    app.log('Crush', 'Контейнер игры не найден для настройки UI', true);
                    return;
                }
                
                if (elements.container.querySelector('#crush-graph')) {
                    app.log('Crush', 'Интерфейс уже создан');
                    return;
                }
                
                elements.container.innerHTML = `
                    <div class="crush-layout">
                        <!-- Верхняя панель с информацией -->
                        <div class="crush-header">
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
                        
                        <!-- Основная область с графиком -->
                        <div class="crush-main">
                            <!-- Панель коэффициента и текущего выигрыша -->
                            <div class="multiplier-row">
                                <div class="multiplier-container">
                                    <div class="multiplier-label">Текущий коэффициент</div>
                                    <div class="multiplier-display">
                                        <div id="multiplier" class="multiplier-value">1.00<span class="multiplier-x">×</span></div>
                                    </div>
                                </div>
                                
                                <div class="current-win-container">
                                    <div class="current-win-label">Потенциальный выигрыш</div>
                                    <div id="potential-win" class="potential-value">0 ⭐</div>
                                </div>
                            </div>
                            
                            <!-- График игры -->
                            <div class="crush-graph-container">
                                <div id="crush-graph" class="crush-graph">
                                    <!-- Canvas будет создан динамически -->
                                </div>
                                
                                <div id="betting-phase-info" class="betting-phase-info">
                                    <p class="betting-phase-message">Период размещения ставок. Сделайте вашу ставку до начала следующего раунда.</p>
                                </div>
                                
                                <div id="crush-result" class="result hidden"></div>
                            </div>
                        </div>
                        
                        <!-- Панель управления -->
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
                        
                        <!-- История и победители (внизу) -->
                        <div class="panels-row">
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
                elements.potentialWinDisplay = document.getElementById('potential-win');
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
                            // Обновляем потенциальный выигрыш при изменении ставки
                            updatePotentialWin();
                        }
                    });
                });
                
                // Инициализируем потенциальный выигрыш
                updatePotentialWin();
                
                app.log('Crush', 'Интерфейс игры успешно создан');
            } catch (error) {
                app.log('Crush', `Ошибка создания интерфейса: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление отображения потенциального выигрыша
         */
        const updatePotentialWin = function() {
            try {
                if (!elements.crushBet || !elements.potentialWinDisplay) return;
                
                const betAmount = parseInt(elements.crushBet.value) || 0;
                const potentialWin = Math.floor(betAmount * globalState.currentMultiplier);
                
                elements.potentialWinDisplay.textContent = `${potentialWin} ⭐`;
            } catch (error) {
                app.log('Crush', `Ошибка обновления потенциального выигрыша: ${error.message}`, true);
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
                
                // Очищаем существующее содержимое
                elements.crushGraph.innerHTML = '';
                
                // Создаем новый canvas с учетом pixel ratio
                const dpr = window.devicePixelRatio || 1;
                const containerWidth = elements.crushGraph.clientWidth || 600;
                const containerHeight = elements.crushGraph.clientHeight || 300;
                
                graphCanvas = document.createElement('canvas');
                graphCanvas.id = 'crush-canvas';
                graphCanvas.width = containerWidth * dpr;
                graphCanvas.height = containerHeight * dpr;
                graphCanvas.style.width = `${containerWidth}px`;
                graphCanvas.style.height = `${containerHeight}px`;
                elements.crushGraph.appendChild(graphCanvas);
                
                graphCtx = graphCanvas.getContext('2d');
                if (!graphCtx) {
                    app.log('Crush', 'Не удалось получить контекст для canvas', true);
                    return;
                }
                
                graphCtx.scale(dpr, dpr);
                
                // Улучшение качества отрисовки
                graphCtx.imageSmoothingEnabled = true;
                graphCtx.imageSmoothingQuality = 'high';
                
                // Сразу рисуем начальную сетку
                drawGrid();
                
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
                    // Очищаем текущие обработчики для предотвращения дублирования
                    const newStartBtn = elements.startBtn.cloneNode(true);
                    if (elements.startBtn.parentNode) {
                        elements.startBtn.parentNode.replaceChild(newStartBtn, elements.startBtn);
                    }
                    elements.startBtn = newStartBtn;
                    
                    elements.startBtn.addEventListener('click', placeBet);
                }
                
                if (elements.cashoutBtn) {
                    // Очищаем текущие обработчики для предотвращения дублирования
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
                
                // Обновление потенциального выигрыша при изменении ставки
                if (elements.crushBet) {
                    elements.crushBet.addEventListener('input', updatePotentialWin);
                }
                
                // Используем debounce для обработчика изменения размера
                const debounce = function(func, delay) {
                    let timer;
                    return function(...args) {
                        clearTimeout(timer);
                        timer = setTimeout(() => func.apply(this, args), delay);
                    };
                };
                
                const debouncedResize = debounce(handleResize, 200);
                window.addEventListener('resize', debouncedResize);
                
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
                    const dpr = window.devicePixelRatio || 1;
                    const containerWidth = elements.crushGraph.clientWidth || 600;
                    const containerHeight = elements.crushGraph.clientHeight || 300;
                    
                    graphCanvas.width = containerWidth * dpr;
                    graphCanvas.height = containerHeight * dpr;
                    graphCanvas.style.width = `${containerWidth}px`;
                    graphCanvas.style.height = `${containerHeight}px`;
                    
                    graphCtx.setTransform(1, 0, 0, 1, 0, 0); // Сбрасываем трансформацию
                    graphCtx.scale(dpr, dpr); // Применяем новый масштаб
                    
                    // Перерисовываем график с текущими данными
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
                if (!graphCtx || !graphCanvas) {
                    app.log('Crush', 'Canvas недоступен для сброса графика', true);
                    return;
                }
                
                const dpr = window.devicePixelRatio || 1;
                graphCtx.clearRect(0, 0, graphCanvas.width / dpr, graphCanvas.height / dpr);
                drawGrid();
                globalState.graphPoints = [];
                
                app.log('Crush', 'График успешно сброшен');
            } catch (error) {
                app.log('Crush', `Ошибка сброса графика: ${error.message}`, true);
            }
        };
        
        /**
         * Рисование сетки графика с улучшенным визуальным представлением
         */
        const drawGrid = function() {
            try {
                if (!graphCtx || !graphCanvas) {
                    app.log('Crush', 'Canvas недоступен для рисования сетки', true);
                    return;
                }
                
                const dpr = window.devicePixelRatio || 1;
                const width = graphCanvas.width / dpr;
                const height = graphCanvas.height / dpr;
                
                // Фон с более тонким градиентом для глубины
                const bgGradient = graphCtx.createLinearGradient(0, 0, 0, height);
                bgGradient.addColorStop(0, 'rgba(22, 28, 36, 0.95)');
                bgGradient.addColorStop(1, 'rgba(18, 22, 30, 0.95)');
                graphCtx.fillStyle = bgGradient;
                graphCtx.fillRect(0, 0, width, height);
                
                // Добавляем тонкий внешний край для глубины
                graphCtx.strokeStyle = 'rgba(30, 40, 50, 0.8)';
                graphCtx.lineWidth = 1;
                graphCtx.strokeRect(0, 0, width, height);
                
                // Горизонтальные линии с более адаптивным распределением
                // Рисуем линии на важных уровнях множителя
                const horizontalLines = [1, 1.5, 2, 3, 5, 10, 20, 50];
                graphCtx.lineWidth = 1;
                
                horizontalLines.forEach(multiplier => {
                    // Нормализация позиции для лучшей видимости
                    // В начале графика (малые множители) - линейная шкала
                    // Для больших значений - логарифмическая
                    let yPos;
                    if (multiplier <= 2) {
                        // Линейная шкала для малых значений (1-2) занимает верхние 40% графика
                        const normalizedMult = (multiplier - 1) / 1; // от 0 до 1
                        yPos = height - normalizedMult * height * 0.4;
                    } else {
                        // Логарифмическая шкала для больших значений (2-50) занимает нижние 60% графика
                        const logValue = Math.log(multiplier / 2) / Math.log(25); // от 0 до 1
                        yPos = height * 0.6 - logValue * height * 0.6;
                    }
                    
                    // Разная прозрачность для разных уровней
                    const opacity = multiplier === 1 ? 0.15 : 
                                   (multiplier === 2 || multiplier === 5 || multiplier === 10) ? 0.12 : 0.07;
                    graphCtx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    
                    graphCtx.beginPath();
                    graphCtx.moveTo(0, yPos);
                    graphCtx.lineTo(width, yPos);
                    graphCtx.stroke();
                    
                    // Добавляем метку множителя (только для основных уровней) с увеличенным шрифтом
                    if (multiplier === 1 || multiplier === 2 || multiplier === 5 || 
                        multiplier === 10 || multiplier === 20) {
                        graphCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                        graphCtx.font = 'bold 13px Arial'; // Увеличиваем размер шрифта
                        graphCtx.textAlign = 'left';
                        graphCtx.fillText(`${multiplier}×`, 5, yPos - 5);
                    }
                });
                
                // Вертикальные линии (время - секунды)
                // Адаптируем под меньший временной диапазон 
                for (let second = 0; second <= 15; second++) {
                    // Рисуем более заметные линии каждые 5 секунд и тонкие каждую секунду
                    const opacity = second % 5 === 0 ? 0.1 : 0.05;
                    graphCtx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    
                    const xPos = (second / 15) * width;
                    graphCtx.beginPath();
                    graphCtx.moveTo(xPos, 0);
                    graphCtx.lineTo(xPos, height);
                    graphCtx.stroke();
                    
                    // Добавляем метку времени каждые 5 секунд с увеличенным шрифтом
                    if (second % 5 === 0 && second > 0) {
                        graphCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                        graphCtx.font = 'bold 13px Arial'; // Увеличиваем размер шрифта
                        graphCtx.textAlign = 'center';
                        graphCtx.fillText(`${second}с`, xPos, height - 5);
                    }
                }
                
                // Добавляем метку 0с в начале
                graphCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                graphCtx.font = 'bold 13px Arial'; // Увеличиваем размер шрифта
                graphCtx.textAlign = 'left';
                graphCtx.fillText('0с', 5, height - 5);
                
                app.log('Crush', 'Сетка графика успешно нарисована');
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
                
                app.log('Crush', 'История игр успешно загружена');
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
                    const bet = Math.floor(Math.random() * 500) + 50;
                    const multiplier = (1 + Math.random() * 5).toFixed(2);
                    
                    winners.push({
                        name: `Player${Math.floor(Math.random() * 1000)}`,
                        amount: Math.floor(bet * parseFloat(multiplier)),
                        bet: bet,
                        multiplier: multiplier
                    });
                }
                
                winnersList.innerHTML = winners.map(winner => `
                    <div class="winner-item">
                        <span class="winner-name">${winner.name}</span>
                        <span class="winner-bet">${winner.bet}</span>
                        <span class="winner-multiplier">${winner.multiplier}×</span>
                        <span class="winner-amount">+${winner.amount}</span>
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
                
                // Обновленное поведение для сообщения о ставке
                if (elements.bettingPhaseInfo) {
                    if (globalState.isWaitingForNextRound) {
                        // Только во время паузы показываем сообщение
                        elements.bettingPhaseInfo.style.display = 'block';
                    } else {
                        // Во время активного раунда скрываем сообщение полностью
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
                
                // Обновляем потенциальный выигрыш
                updatePotentialWin();
                
                // Обновляем состояние кнопок
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
                
                // Обработка поля ввода ставки
                if (elements.crushBet) {
                    elements.crushBet.disabled = globalState.isActiveRound && userState.hasBetInCurrentRound;
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
         * Запуск таймера ожидания - теперь использует ровно 1 секунду на шаг для более точного отсчета
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
                
                // Сбрасываем результат предыдущего раунда
                if (elements.crushResult) {
                    elements.crushResult.style.display = 'none';
                    elements.crushResult.innerHTML = '';
                    elements.crushResult.className = 'result hidden';
                }
                
                // Явно показываем сообщение о ставке
                if (elements.bettingPhaseInfo) {
                    elements.bettingPhaseInfo.style.display = 'block';
                }
                
                // Сбрасываем множитель
                globalState.currentMultiplier = 1.0;
                updateMultiplierDisplay();
                updatePotentialWin();
                
                // Обновляем отображение фазы игры
                updateGamePhaseDisplay();
                
                // Очищаем существующий интервал
                if (globalState.roundTimerInterval) {
                    clearInterval(globalState.roundTimerInterval);
                }
                
                // Звук обратного отсчета для последних секунд
                if (globalState.waitingTimeLeft <= 3) {
                    playSound('countdown');
                }
                
                // Используем интервал в 1 секунду для более точного отсчета
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
                }, TIMER_UPDATE_INTERVAL); // Интервал 1000 мс (1 секунда)
                
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
                
                // Явно скрываем сообщение о ставке
                if (elements.bettingPhaseInfo) {
                    elements.bettingPhaseInfo.style.display = 'none';
                }
                
                // Сбрасываем график
                resetGraph();
                
                // Обновляем отображение фазы игры
                updateGamePhaseDisplay();
                
                // Обновляем множитель
                updateMultiplierDisplay();
                
                // Добавляем начальную точку на график
                addGraphPoint(1.00);
                
                // Запускаем игровой интервал
                startGameInterval();
                
                // Тактильная обратная связь для игрока, сделавшего ставку
                if (window.casinoApp && userState.hasBetInCurrentRound) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                app.log('Crush', 'Новый раунд успешно начат');
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
                // Очищаем существующий интервал
                if (globalState.gameInterval) {
                    clearInterval(globalState.gameInterval);
                }
                
                // Запускаем новый интервал
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
                
                app.log('Crush', 'Игровой интервал успешно запущен');
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
                
                // Новая функция роста: медленно в начале, затем быстрее
                // Используем комбинацию степенной и экспоненциальной функции
                // для более плавного начала и ускорения в дальнейшем
                const baseGrowth = Math.pow(elapsedTime, 1.2) * 0.1; // Начальный медленный рост
                const expGrowth = Math.exp(elapsedTime * 0.2) - 1;   // Экспоненциальный рост позже
                
                // Комбинируем два вида роста с весами, зависящими от времени
                const timeFactor = Math.min(1, elapsedTime / 5); // Коэффициент перехода
                const combinedGrowth = baseGrowth * (1 - timeFactor) + expGrowth * timeFactor;
                
                // Добавляем 1, чтобы множитель всегда начинался с 1.00
                globalState.currentMultiplier = 1 + combinedGrowth;
                
                // Обновляем отображение множителя
                updateMultiplierDisplay();
                
                // Обновляем потенциальный выигрыш
                updatePotentialWin();
                
                // Добавляем точки с разной частотой в зависимости от времени
                // Чаще точки в начале для лучшей детализации
                const pointInterval = elapsedTime > 5 ? 80 : 40;
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
         * Перерисовка графика с улучшенным визуальным представлением
         */
        const redrawGraph = function() {
            try {
                if (!graphCtx || !graphCanvas) {
                    app.log('Crush', 'Canvas недоступен для перерисовки графика', true);
                    return;
                }
                
                const dpr = window.devicePixelRatio || 1;
                const width = graphCanvas.width / dpr;
                const height = graphCanvas.height / dpr;
                
                // Очищаем холст
                graphCtx.clearRect(0, 0, width, height);
                
                // Рисуем сетку
                drawGrid();
                
                // Если недостаточно точек для рисования линии, выходим
                if (globalState.graphPoints.length < 2) return;
                
                // Приближаем график, фокусируясь на меньшем диапазоне значений множителя
                // и меньшем временном отрезке для более детальной визуализации
                const currentMultiplier = globalState.currentMultiplier;
                
                // Динамическое масштабирование оси Y (множителя)
                // Начинаем с небольшого значения для лучшей детализации начала
                // Улучшено для более наглядного отображения
                let maxMult = 4; // Уменьшаем начальное значение для лучшей видимости малых множителей
                
                // Автоматически увеличиваем масштаб по мере роста множителя
                if (currentMultiplier > maxMult * 0.6) {
                    maxMult = Math.max(maxMult, currentMultiplier * 1.3);
                }
                
                // Масштабирование временной оси - показываем до 15 секунд
                // но для начальной фазы показываем более короткий отрезок времени
                const elapsedTime = (Date.now() - globalState.roundStartTime) / 1000;
                // Используем более короткий интервал времени для лучшей детализации
                const maxTime = Math.min(12, Math.max(4, elapsedTime * 1.3));
                
                // Рисуем линию графика с плавной кривой
                graphCtx.beginPath();
                
                // Начинаем с первой точки
                const firstPoint = globalState.graphPoints[0];
                const x0 = (firstPoint.time / maxTime) * width;
                // Используем квадратичное преобразование для начальных значений для лучшей детализации
                // и логарифмическое для высоких множителей
                const y0 = height - ((firstPoint.multiplier - 1) / (maxMult - 1)) * height * 0.98;
                graphCtx.moveTo(x0, y0);
                
                // Создаем градиент для линии
                const lineGradient = graphCtx.createLinearGradient(0, 0, 0, height);
                lineGradient.addColorStop(0, '#00c853');    // Зелёный вверху
                lineGradient.addColorStop(0.4, '#ffab00');  // Оранжевый в середине
                lineGradient.addColorStop(0.7, '#ff6d00');  // Тёмно-оранжевый
                lineGradient.addColorStop(1, '#ff1744');    // Красный внизу
                
                // Создаем более плавную кривую, используя точки и bezier-кривые
                let prevX = x0;
                let prevY = y0;
                
                for (let i = 1; i < globalState.graphPoints.length; i++) {
                    const currentPoint = globalState.graphPoints[i];
                    
                    const x = (currentPoint.time / maxTime) * width;
                    
                    // Используем нелинейное преобразование для лучшей детализации
                    // Для малых значений - линейное, для больших - логарифмическое
                    const normalizedMult = (currentPoint.multiplier - 1) / (maxMult - 1);
                    const y = height - normalizedMult * height * 0.98;
                    
                    // Более плавная кривая с контрольными точками
                    if (i % 3 === 1) { // Делаем кривую Безье через каждые 3 точки для оптимизации
                        const cpX1 = prevX + (x - prevX) / 3;
                        const cpY1 = prevY;
                        const cpX2 = x - (x - prevX) / 3;
                        const cpY2 = y;
                        
                        graphCtx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
                    } else {
                        graphCtx.lineTo(x, y);
                    }
                    
                    prevX = x;
                    prevY = y;
                }
                
                // Настраиваем стиль линии
                graphCtx.strokeStyle = lineGradient;
                graphCtx.lineWidth = 5; // Увеличиваем толщину для лучшей видимости
                graphCtx.lineCap = 'round';
                graphCtx.lineJoin = 'round';
                
                // Добавляем тень для эффектности
                graphCtx.shadowColor = 'rgba(0, 200, 83, 0.6)';
                graphCtx.shadowBlur = 12;
                graphCtx.shadowOffsetX = 0;
                graphCtx.shadowOffsetY = 0;
                
                // Рисуем линию
                graphCtx.stroke();
                
                // Градиентная заливка под линией
                const lastPoint = globalState.graphPoints[globalState.graphPoints.length - 1];
                const lastX = (lastPoint.time / maxTime) * width;
                const normalizedLastMult = (lastPoint.multiplier - 1) / (maxMult - 1);
                const lastY = height - normalizedLastMult * height * 0.98;
                
                graphCtx.lineTo(lastX, height);
                graphCtx.lineTo(x0, height);
                graphCtx.closePath();
                
                // Создаем градиент для заливки
                const fillGradient = graphCtx.createLinearGradient(0, 0, 0, height);
                fillGradient.addColorStop(0, 'rgba(0, 200, 83, 0.3)');
                fillGradient.addColorStop(0.7, 'rgba(0, 200, 83, 0.1)');
                fillGradient.addColorStop(1, 'rgba(0, 200, 83, 0)');
                
                graphCtx.fillStyle = fillGradient;
                graphCtx.globalAlpha = 0.6; // Увеличим непрозрачность для лучшей видимости
                graphCtx.fill();
                graphCtx.globalAlpha = 1;
                
                // Сбрасываем тень
                graphCtx.shadowColor = 'transparent';
                graphCtx.shadowBlur = 0;
                
                // Текущая точка - рисуем яркий маркер
                graphCtx.beginPath();
                graphCtx.arc(lastX, lastY, 8, 0, Math.PI * 2); // Больше для заметности
                
                // Градиентная заливка для точки
                const dotGradient = graphCtx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 8);
                dotGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                dotGradient.addColorStop(1, 'rgba(0, 200, 83, 0.8)');
                
                graphCtx.fillStyle = dotGradient;
                graphCtx.fill();
                
                // Рисуем внешний ореол
                graphCtx.beginPath();
                graphCtx.arc(lastX, lastY, 16, 0, Math.PI * 2);
                graphCtx.fillStyle = 'rgba(0, 200, 83, 0.2)';
                graphCtx.fill();
                
                // Рисуем пульсирующий ореол на текущей точке
                const pulseSize = 16 + 5 * Math.sin(Date.now() / 200);
                graphCtx.beginPath();
                graphCtx.arc(lastX, lastY, pulseSize, 0, Math.PI * 2);
                graphCtx.fillStyle = 'rgba(0, 200, 83, 0.1)';
                graphCtx.fill();
                
                // Рисуем метку текущего множителя над точкой,
                if (lastPoint.multiplier > 1.3) {
                    const fontSize = 16; // Увеличиваем размер шрифта
                    graphCtx.font = `bold ${fontSize}px Arial`;
                    graphCtx.fillStyle = '#fff';
                    graphCtx.textAlign = 'center';
                    graphCtx.fillText(`${lastPoint.multiplier.toFixed(2)}×`, lastX, lastY - 20);
                }
                
                app.log('Crush', 'График успешно перерисован');
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
                    } else {
                        alert('Пожалуйста, введите корректную ставку');
                    }
                    return;
                }
                
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    userState.betAmount > window.GreenLightApp.user.balance) {
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Недостаточно средств для ставки');
                    } else {
                        alert('Недостаточно средств для ставки');
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
                
                const dpr = window.devicePixelRatio || 1;
                const width = graphCanvas.width / dpr;
                const height = graphCanvas.height / dpr;
                
                // Используем тот же метод расчета координат, что и в функции redrawGraph
                let maxMult = 4;
                if (lastPoint.multiplier > maxMult * 0.6) {
                    maxMult = Math.max(maxMult, lastPoint.multiplier * 1.3);
                }
                
                const elapsedTime = (Date.now() - globalState.roundStartTime) / 1000;
                const maxTime = Math.min(12, Math.max(4, elapsedTime * 1.3));
                
                const crashX = (lastPoint.time / maxTime) * width;
                const normalizedMult = (lastPoint.multiplier - 1) / (maxMult - 1);
                const crashY = height - normalizedMult * height * 0.98;
                
                // Расширенная анимация взрыва с несколькими фазами
                const explosionDuration = 1000; // ms
                const startTime = Date.now();
                
                // Добавляем камеру-шейк эффект
                const shakeCanvas = () => {
                    const intensity = 5;
                    const shakeX = (Math.random() - 0.5) * intensity;
                    const shakeY = (Math.random() - 0.5) * intensity;
                    graphCanvas.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
                };
                
                // Анимация восстановления после тряски
                const resetShake = () => {
                    graphCanvas.style.transform = 'translate(0, 0)';
                    graphCanvas.style.transition = 'transform 0.3s ease-out';
                    setTimeout(() => {
                        graphCanvas.style.transition = '';
                    }, 300);
                };
                
                // Основная анимация взрыва
                const animateExplosion = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(1, elapsed / explosionDuration);
                    
                    if (progress < 1) {
                        // Очищаем и перерисовываем график
                        redrawGraph();
                        
                        // Тряска канваса в начале взрыва
                        if (progress < 0.3) {
                            shakeCanvas();
                        } else if (progress < 0.35) {
                            resetShake();
                        }
                        
                        // Комплексная нелинейная функция размера для эффектной анимации
                        // Быстрый рост, затем замедление и исчезновение
                        let explosionPhase;
                        if (progress < 0.3) {
                            // Фаза 1: быстрое расширение
                            explosionPhase = progress / 0.3;
                            const explosionRadius = 120 * Math.pow(explosionPhase, 0.6);
                            
                            // Яркий центральный взрыв
                            const explosionGradient = graphCtx.createRadialGradient(
                                crashX, crashY, 0,
                                crashX, crashY, explosionRadius
                            );
                            
                            explosionGradient.addColorStop(0, 'rgba(255, 80, 80, 1.0)');
                            explosionGradient.addColorStop(0.2, 'rgba(255, 70, 60, 0.95)');
                            explosionGradient.addColorStop(0.4, 'rgba(255, 100, 40, 0.8)');
                            explosionGradient.addColorStop(0.7, 'rgba(255, 120, 30, 0.4)');
                            explosionGradient.addColorStop(1, 'rgba(255, 140, 30, 0)');
                            
                            graphCtx.beginPath();
                            graphCtx.arc(crashX, crashY, explosionRadius, 0, Math.PI * 2);
                            graphCtx.fillStyle = explosionGradient;
                            graphCtx.fill();
                            
                            // Внутреннее кольцо взрыва
                            const innerRadius = explosionRadius * 0.6;
                            const innerGradient = graphCtx.createRadialGradient(
                                crashX, crashY, innerRadius * 0.5,
                                crashX, crashY, innerRadius
                            );
                            
                            innerGradient.addColorStop(0, 'rgba(255, 255, 100, 0.9)');
                            innerGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
                            
                            graphCtx.beginPath();
                            graphCtx.arc(crashX, crashY, innerRadius, 0, Math.PI * 2);
                            graphCtx.fillStyle = innerGradient;
                            graphCtx.fill();
                        } else {
                            // Фаза 2: затухание и остаточное свечение
                            const fadeProgress = (progress - 0.3) / 0.7; // От 0 до 1
                            const fadeRadius = 120 * (1 - fadeProgress * 0.5);
                            
                            // Затухающий градиент
                            const fadeGradient = graphCtx.createRadialGradient(
                                crashX, crashY, 0,
                                crashX, crashY, fadeRadius
                            );
                            
                            const opacity = 0.9 * (1 - fadeProgress);
                            fadeGradient.addColorStop(0, `rgba(255, 70, 70, ${opacity * 0.8})`);
                            fadeGradient.addColorStop(0.3, `rgba(255, 100, 40, ${opacity * 0.6})`);
                            fadeGradient.addColorStop(0.7, `rgba(255, 120, 30, ${opacity * 0.3})`);
                            fadeGradient.addColorStop(1, `rgba(255, 140, 20, 0)`);
                            
                            graphCtx.beginPath();
                            graphCtx.arc(crashX, crashY, fadeRadius, 0, Math.PI * 2);
                            graphCtx.fillStyle = fadeGradient;
                            graphCtx.fill();
                            
                            // Мерцание остаточное
                            if (Math.random() > 0.5) {
                                const flickerRadius = fadeRadius * 0.7 * (0.8 + Math.random() * 0.4);
                                const flickerGradient = graphCtx.createRadialGradient(
                                    crashX, crashY, 0,
                                    crashX, crashY, flickerRadius
                                );
                                
                                const flickerOpacity = opacity * 0.4 * Math.random();
                                flickerGradient.addColorStop(0, `rgba(255, 220, 150, ${flickerOpacity})`);
                                flickerGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
                                
                                graphCtx.beginPath();
                                graphCtx.arc(crashX, crashY, flickerRadius, 0, Math.PI * 2);
                                graphCtx.fillStyle = flickerGradient;
                                graphCtx.fill();
                            }
                        }
                        
                        // Искры и осколки, разлетающиеся от центра
                        const sparkCount = 12;
                        const baseSparkLength = progress < 0.3 ? 
                                                170 * Math.pow(progress / 0.3, 0.8) : 
                                                170 * (1 - (progress - 0.3) / 0.7 * 0.7);
                        
                        for (let i = 0; i < sparkCount; i++) {
                            const angle = (i / sparkCount) * Math.PI * 2;
                            
                            // Вариации длины и угла для каждой искры
                            const lengthVariation = 0.5 + Math.random() * 1;
                            const angleVariation = angle + (Math.random() - 0.5) * 0.3;
                            const sparkLength = baseSparkLength * lengthVariation;
                            
                            const sparkEndX = crashX + Math.cos(angleVariation) * sparkLength;
                            const sparkEndY = crashY + Math.sin(angleVariation) * sparkLength;
                            
                            // Начало искры немного смещено от центра
                            const sparkStartDistance = 5 + Math.random() * 15;
                            const sparkStartX = crashX + Math.cos(angleVariation) * sparkStartDistance;
                            const sparkStartY = crashY + Math.sin(angleVariation) * sparkStartDistance;
                            
                            // Градиент цвета для искры от ярко-желтого до красного
                            const sparkGradient = graphCtx.createLinearGradient(
                                sparkStartX, sparkStartY, sparkEndX, sparkEndY
                            );
                            
                            sparkGradient.addColorStop(0, `rgba(255, 255, 100, ${1 - progress * 0.7})`);
                            sparkGradient.addColorStop(0.5, `rgba(255, 150, 50, ${0.8 - progress * 0.7})`);
                            sparkGradient.addColorStop(1, `rgba(255, 50, 30, 0)`);
                            
                            graphCtx.beginPath();
                            graphCtx.moveTo(sparkStartX, sparkStartY);
                            graphCtx.lineTo(sparkEndX, sparkEndY);
                            graphCtx.strokeStyle = sparkGradient;
                            graphCtx.lineWidth = 2 + Math.random() * 1.5;
                            graphCtx.stroke();
                        }
                        
                        // Текст "CRASH" появляется при взрыве - увеличенный
                        if (progress > 0.1) {
                            const textOpacity = progress < 0.4 ? 
                                                progress / 0.4 : 
                                                1 - (progress - 0.4) / 0.6;
                            
                            const textSize = 50 + Math.sin(progress * Math.PI * 4) * 5; // Увеличенный размер
                            
                            graphCtx.font = `bold ${textSize}px Arial`;
                            graphCtx.textAlign = 'center';
                            graphCtx.textBaseline = 'middle';
                            
                            // Тень текста
                            graphCtx.shadowColor = 'rgba(255, 0, 0, 0.8)';
                            graphCtx.shadowBlur = 15;
                            graphCtx.shadowOffsetX = 2;
                            graphCtx.shadowOffsetY = 2;
                            
                            // Градиент для текста
                            const textGradient = graphCtx.createLinearGradient(
                                crashX - 60, crashY, crashX + 60, crashY
                            );
                            textGradient.addColorStop(0, '#ff5a5a');
                            textGradient.addColorStop(0.5, '#ffcc00');
                            textGradient.addColorStop(1, '#ff5a5a');
                            
                            graphCtx.fillStyle = textGradient;
                            graphCtx.fillText("CRASH", crashX, crashY - 60);
                            
                            // Отображение значения краша - увеличенное
                            graphCtx.font = `bold 30px Arial`; // Увеличенный размер
                            graphCtx.fillStyle = '#ffffff';
                            graphCtx.shadowBlur = 5;
                            graphCtx.fillText(`${lastPoint.multiplier.toFixed(2)}×`, crashX, crashY + 60);
                            
                            // Сброс тени
                            graphCtx.shadowColor = 'transparent';
                            graphCtx.shadowBlur = 0;
                            graphCtx.shadowOffsetX = 0;
                            graphCtx.shadowOffsetY = 0;
                        }
                        
                        requestAnimationFrame(animateExplosion);
                    } else {
                        // Конец анимации - стабилизируем канвас
                        resetShake();
                    }
                };
                
                // Запускаем анимацию
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
         * Важно: результат НЕ выводится в консоль для защиты от мошенничества
         */
        const generateCrashPoint = function() {
            try {
                const houseEdge = 0.03; // 3% преимущество казино
                
                // Генерируем случайное число от 0 до 1
                const randomValue = Math.random();
                
                // Формула для точки краша с распределением, имитирующим реальные игры
                let crashPoint;
                
                // Используем поведение, близкое к реальным казино - 
                // множество ранних крашей и несколько редких высоких значений
                if (randomValue < 0.15) {
                    // 15% шанс ранних крашей (1.00 - 1.50)
                    crashPoint = 1.00 + Math.random() * 0.50;
                } else if (randomValue < 0.40) {
                    // 25% шанс низких крашей (1.50 - 2.00)
                    crashPoint = 1.50 + Math.random() * 0.50;
                } else if (randomValue < 0.70) {
                    // 30% шанс средне-низких крашей (2.00 - 3.00)
                    crashPoint = 2.00 + Math.random() * 1.00;
                } else if (randomValue < 0.85) {
                    // 15% шанс средних крашей (3.00 - 5.00)
                    crashPoint = 3.00 + Math.random() * 2.00;
                } else if (randomValue < 0.95) {
                    // 10% шанс высоких крашей (5.00 - 10.00)
                    crashPoint = 5.00 + Math.random() * 5.00;
                } else {
                    // 5% шанс редких очень высоких значений
                    const highRandomValue = Math.random();
                    
                    if (highRandomValue < 0.80) {
                        // 80% из 5% = 4% шанс крашей 10.00 - 20.00
                        crashPoint = 10.00 + Math.random() * 10.00;
                    } else if (highRandomValue < 0.95) {
                        // 15% из 5% = 0.75% шанс крашей 20.00 - 50.00
                        crashPoint = 20.00 + Math.random() * 30.00;
                    } else {
                        // 5% из 5% = 0.25% шанс крашей 50.00 - 100.00
                        crashPoint = 50.00 + Math.random() * 50.00;
                    }
                }
                
                // Добавляем небольшие случайные дробные части для естественности
                crashPoint += Math.random() * 0.10;
                
                // Ограничиваем максимальное значение
                const maxCrashPoint = 100.0;
                crashPoint = Math.min(crashPoint, maxCrashPoint);
                
                return crashPoint;
            } catch (error) {
                app.log('Crush', `Ошибка генерации точки краша: ${error.message}`, true);
                return 2.0; // Возвращаем безопасное значение при ошибке
            }
        };
        
        // Возвращаем публичный интерфейс
        return {
            init: init,
            placeBet: placeBet,
            cashout: cashout,
            
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
            addStyles: addStyles
        };
    })();
    
    // Регистрируем игру во всех форматах для максимальной совместимости
    try {
        // 1. Добавляем стили
        crushGame.addStyles();
        
        // 2. Регистрация через систему registerGame
        if (window.registerGame) {
            window.registerGame('crushGame', crushGame);
            app.log('Crush', 'Игра зарегистрирована через систему registerGame');
        }
        
        // 3. Экспорт в глобальное пространство имен (для обратной совместимости)
        window.crushGame = crushGame;
        app.log('Crush', 'Игра экспортирована в глобальное пространство имен');
        
        // 4. Автоматическая инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!crushGame.getStatus().user.initialized && !crushGame.getStatus().user.initializationStarted) {
                    app.log('Crush', 'Запуск автоматической инициализации');
                    crushGame.init();
                }
            }, 500);
        });
        
        // 5. Если DOM уже загружен, инициализируем немедленно
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!crushGame.getStatus().user.initialized && !crushGame.getStatus().user.initializationStarted) {
                    app.log('Crush', 'Запуск автоматической инициализации (DOM уже загружен)');
                    crushGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Crush', `Ошибка регистрации игры: ${error.message}`, true);
    }
})();