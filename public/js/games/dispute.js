/**
 * dispute.js - Улучшенная версия режима спора с монеткой
 * Версия 3.1.0
 * 
 * Особенности:
 * - Поддержка комнаты для двух участников спора
 * - Механизм готовности игроков
 * - Интеграция с Telegram для обновления сообщений
 * - Автоматический запуск монетки при готовности обоих участников
 * - Изолированный режим работы
 */

// Предотвращаем конфликты и обеспечиваем изолированную среду
(function() {
    // Проверяем наличие основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[Dispute] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Dispute', 'Инициализация модуля Dispute v3.1.0');
    
    // Игровая логика в замыкании для изоляции
    const disputeGame = (function() {
        // Элементы игры
        let elements = {
            disputeContainer: null,
            coin: null,
            readyBtn: null,
            coinResult: null,
            playersList: null,
            creatorInfo: null,
            opponentInfo: null,
            waitingMessage: null,
            resultMessage: null,
            disputeSubject: null,
            disputeAmount: null,
            closeBtn: null
        };
        
        // Глобальное состояние спора
        let state = {
            initialized: false,
            initializationStarted: false,
            isFlipping: false,
            disputeId: null,
            disputeData: null,
            roomId: null,
            playerSide: null,
            opponentSide: null,
            isCreator: false,
            playerReady: false,
            opponentReady: false,
            bothReady: false,
            result: null,
            hasFinished: false,
            soundEnabled: true,
            closed: false,
            userInteracted: false, // Флаг для отслеживания взаимодействия пользователя
            lastStatusUpdate: 0,   // Время последнего обновления статуса
            readyAttempts: 0       // Счетчик попыток отправки статуса готовности
        };
        
        // Звуковые эффекты
        let sounds = {
            flip: null,
            win: null,
            lose: null,
            click: null,
            ready: null
        };
        
        /**
         * Инициализация игры
         */
        const init = async function() {
            // Предотвращаем повторную инициализацию
            if (state.initialized || state.initializationStarted) {
                app.log('Dispute', 'Инициализация уже выполнена или выполняется');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Dispute', 'Начало инициализации режима спора');
            
            try {
                // Проверяем URL параметры для получения disputeId и roomId
                const disputeId = getUrlParameter('dispute');
                const roomId = getUrlParameter('room');
                const isCreatorParam = getUrlParameter('isCreator');
                
                if (!disputeId) {
                    app.log('Dispute', 'Отсутствует ID спора в URL', true);
                    return false;
                }
                
                state.disputeId = disputeId;
                state.roomId = roomId || generateRoomId();
                state.isCreator = isCreatorParam === 'true';
                
                app.log('Dispute', `Инициализация спора: ID=${disputeId}, isCreator=${state.isCreator}`);
                
                // Добавляем стили для режима спора
                addStyles();
                
                // Создаем UI элементы
                await createUI();
                
                // Находим DOM элементы
                await findDOMElements();
                
                // Загружаем данные спора
                await loadDisputeData(disputeId);
                
                // Настраиваем обработчики событий
                setupEventListeners();
                
                // Загружаем звуки
                loadSounds();
                
                // Подключаемся к комнате спора
                connectToDisputeRoom();
                
                state.initialized = true;
                app.log('Dispute', 'Инициализация завершена успешно');
                
                // Проверяем URL на наличие параметра автоматического запуска
                if (getUrlParameter('autostart') === 'true') {
                    startAutomaticMode();
                }
                
                // Активируем экран спора вместо основного меню
                activateDisputeScreen();
                
                // Запускаем частую проверку статуса
                startRoomStatusCheck();
                
                return true;
            } catch (error) {
                app.log('Dispute', `Ошибка инициализации: ${error.message}`, true);
                state.initializationStarted = false;
                return false;
            }
        };
        
        /**
         * Добавление стилей для режима спора
         */
        const addStyles = function() {
            if (document.getElementById('dispute-styles')) return;
            
            const styleElement = document.createElement('style');
            styleElement.id = 'dispute-styles';
            styleElement.textContent = `
                .dispute-container {
                    max-width: 500px;
                    margin: 0 auto;
                    padding: 20px;
                    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    color: white;
                    font-family: 'Arial', sans-serif;
                }
                
                .dispute-container.isolated-mode {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 9999;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                
                .dispute-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 9998;
                }
                
                .dispute-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .dispute-header h2 {
                    margin: 0;
                    color: #1db954;
                    font-size: 24px;
                }
                
                .dispute-id {
                    font-size: 12px;
                    color: #777;
                    margin-top: 5px;
                }
                
                .players-section {
                    margin-bottom: 20px;
                }
                
                .players-section h3 {
                    font-size: 18px;
                    margin-bottom: 10px;
                    color: #f2c94c;
                }
                
                .players-list {
                    display: flex;
                    gap: 15px;
                }
                
                .player-info {
                    flex: 1;
                    background: rgba(0, 0, 0, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .player-name {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .player-side {
                    margin-bottom: 10px;
                    color: #f2c94c;
                }
                
                .ready-status {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 5px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .ready-status.not-ready {
                    background-color: rgba(255, 69, 58, 0.2);
                    color: #ff453a;
                }
                
                .ready-status.ready {
                    background-color: rgba(76, 217, 100, 0.2);
                    color: #4cd964;
                }
                
                .dispute-content {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                
                .dispute-subject {
                    font-size: 18px;
                    margin-bottom: 10px;
                }
                
                .dispute-amount {
                    font-size: 24px;
                    color: #f2c94c;
                    font-weight: bold;
                }
                
                .waiting-message {
                    text-align: center;
                    padding: 15px;
                    margin-bottom: 20px;
                    background: rgba(242, 201, 76, 0.1);
                    border-radius: 10px;
                    color: #f2c94c;
                    font-weight: bold;
                }
                
                .coin-container {
                    position: relative;
                    height: 150px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin-bottom: 20px;
                    perspective: 1000px;
                }
                
                .coin {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    transform-style: preserve-3d;
                    transition: transform 0.5s;
                }
                
                .coin .heads,
                .coin .tails,
                .coin-side.heads,
                .coin-side.tails {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    backface-visibility: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 30px;
                    font-weight: bold;
                }
                
                .coin .heads,
                .coin-side.heads {
                    background: radial-gradient(#FFD700, #B8860B);
                    z-index: 2;
                }
                
                .coin .heads::before,
                .coin-side.heads::before {
                    content: "O";
                }
                
                .coin .tails,
                .coin-side.tails {
                    background: radial-gradient(#C0C0C0, #808080);
                    transform: rotateY(180deg);
                }
                
                .coin .tails::before,
                .coin-side.tails::before {
                    content: "P";
                }
                
                .coin.heads {
                    transform: rotateY(0deg);
                }
                
                .coin.tails {
                    transform: rotateY(180deg);
                }
                
                .coin.flipping {
                    animation: flip-coin 3s forwards;
                }
                
                @keyframes flip-coin {
                    0% { transform: rotateY(0); }
                    100% { transform: rotateY(1800deg); }
                }
                
                @keyframes flip-to-heads {
                    0% { transform: rotateY(0); }
                    100% { transform: rotateY(1800deg); }
                }
                
                @keyframes flip-to-tails {
                    0% { transform: rotateY(0); }
                    100% { transform: rotateY(1980deg); }
                }
                
                .coin.heads-result {
                    animation: flip-to-heads 3s forwards;
                }
                
                .coin.tails-result {
                    animation: flip-to-tails 3s forwards;
                }
                
                .result-message {
                    text-align: center;
                    padding: 15px;
                    margin-bottom: 20px;
                    border-radius: 10px;
                    font-weight: bold;
                    font-size: 18px;
                }
                
                .result-message.win {
                    background: rgba(76, 217, 100, 0.1);
                    color: #4cd964;
                }
                
                .result-message.lose {
                    background: rgba(255, 69, 58, 0.1);
                    color: #ff453a;
                }
                
                .result-message.hidden {
                    display: none;
                }
                
                .dispute-controls {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .action-btn, .action-btn.secondary {
                    flex: 1;
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .action-btn {
                    background: #1db954;
                    color: white;
                }
                
                .action-btn:hover {
                    background: #15ad49;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(29, 185, 84, 0.3);
                }
                
                .action-btn:active {
                    transform: translateY(1px);
                }
                
                .action-btn.disabled {
                    background: #888;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                .action-btn.secondary {
                    background: #333;
                    color: white;
                }
                
                .action-btn.secondary:hover {
                    background: #444;
                    transform: translateY(-2px);
                }
                
                .action-btn.secondary:active {
                    transform: translateY(1px);
                }
                
                .dispute-footer {
                    text-align: center;
                    font-size: 12px;
                    color: #777;
                }
            `;
            document.head.appendChild(styleElement);
            
            app.log('Dispute', 'Стили для режима спора добавлены');
        };
        
        /**
         * Активация экрана спора
         */
        const activateDisputeScreen = function() {
            try {
                app.log('Dispute', 'Активация экрана спора');
                
                // Создаем оверлей для изолированного режима
                const overlay = document.createElement('div');
                overlay.className = 'dispute-overlay';
                document.body.appendChild(overlay);
                
                // Скрываем основной контент приложения
                const appContent = document.getElementById('app-content');
                if (appContent) {
                    appContent.style.display = 'none';
                }
                
                // Скрываем все экраны
                document.querySelectorAll('.screen').forEach(screen => {
                    screen.classList.remove('active');
                    screen.style.display = 'none';
                });
                
                // Скрываем навигацию
                const bottomNav = document.querySelector('.bottom-nav');
                if (bottomNav) {
                    bottomNav.style.display = 'none';
                }
                
                // Отображаем контейнер спора
                if (elements.disputeContainer) {
                    elements.disputeContainer.style.display = 'block';
                    document.body.appendChild(elements.disputeContainer);
                }
                
                app.log('Dispute', 'Экран спора активирован');
            } catch (error) {
                app.log('Dispute', `Ошибка активации экрана спора: ${error.message}`, true);
            }
        };
        
        /**
         * Получение параметра из URL
         */
        const getUrlParameter = function(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        };
        
        /**
         * Генерация уникального ID комнаты
         */
        const generateRoomId = function() {
            return 'room_' + Math.random().toString(36).substr(2, 9);
        };
        
        /**
         * Загрузка звуковых эффектов
         */
        const loadSounds = function() {
            try {
                // Создаем аудио элементы для звуков
                sounds.flip = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-mechanical-bling-210.mp3');
                sounds.win = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3');
                sounds.lose = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-negative-tone-interface-tap-2301.mp3');
                sounds.click = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3');
                sounds.ready = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-quick-win-video-game-notification-269.mp3');
                
                // Предзагрузка звуков
                Object.values(sounds).forEach(sound => {
                    if (sound) {
                        sound.load();
                    }
                });
                
                app.log('Dispute', 'Звуки загружены успешно');
            } catch (error) {
                app.log('Dispute', `Ошибка загрузки звуков: ${error.message}`, true);
            }
        };
        
        /**
         * Воспроизведение звукового эффекта с проверкой безопасности
         */
        const playSound = function(sound) {
            if (!state.soundEnabled || !sounds[sound]) return;
            
            try {
                // Сбрасываем в начало, если уже воспроизводится
                sounds[sound].currentTime = 0;
                sounds[sound].play().catch(e => {
                    // Игнорируем ошибки автовоспроизведения (частые на мобильных)
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
            
            app.log('Dispute', `Звук ${state.soundEnabled ? 'включен' : 'выключен'}`);
        };
        
        /**
         * Создание пользовательского интерфейса
         */
        const createUI = async function() {
            return new Promise((resolve) => {
                try {
                    // Создаем основной контейнер
                    const disputeContainer = document.createElement('div');
                    disputeContainer.className = 'dispute-container isolated-mode';
                    disputeContainer.id = 'dispute-container';
                    
                    // Создаем HTML разметку
                    disputeContainer.innerHTML = `
                        <div class="dispute-header">
                            <h2>Разрешение спора</h2>
                            <div id="dispute-id" class="dispute-id"></div>
                        </div>
                        
                        <div class="players-section">
                            <h3>Участники</h3>
                            <div id="players-list" class="players-list">
                                <div id="creator-info" class="player-info">
                                    <div class="player-name">Создатель спора</div>
                                    <div class="player-side"></div>
                                    <div class="ready-status not-ready">Не готов</div>
                                </div>
                                <div id="opponent-info" class="player-info">
                                    <div class="player-name">Оппонент</div>
                                    <div class="player-side"></div>
                                    <div class="ready-status not-ready">Не готов</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="dispute-content">
                            <div id="dispute-subject" class="dispute-subject"></div>
                            <div id="dispute-amount" class="dispute-amount"></div>
                        </div>
                        
                        <div id="waiting-message" class="waiting-message">
                            Ожидание готовности обоих участников...
                        </div>
                        
                        <div class="coin-container">
                            <div id="dispute-coin" class="coin">
                                <div class="heads"></div>
                                <div class="tails"></div>
                            </div>
                        </div>
                        
                        <div id="result-message" class="result-message hidden"></div>
                        
                        <div class="dispute-controls">
                            <button id="ready-btn" class="action-btn">Я ГОТОВ</button>
                            <button id="close-btn" class="action-btn secondary">ЗАКРЫТЬ</button>
                        </div>
                        
                        <div class="dispute-footer">
                            <div class="dispute-note">
                                Подбрасывание монетки начнется автоматически, когда оба участника будут готовы
                            </div>
                        </div>
                    `;
                    
                    // Сохраняем контейнер в элементах
                    elements.disputeContainer = disputeContainer;
                    
                    // Добавляем контейнер в документ
                    document.body.appendChild(disputeContainer);
                    
                    app.log('Dispute', 'Интерфейс спора создан успешно');
                    resolve(true);
                } catch (error) {
                    app.log('Dispute', `Ошибка создания UI: ${error.message}`, true);
                    resolve(false);
                }
            });
        };
        
        /**
         * Поиск DOM элементов
         */
        const findDOMElements = async function() {
            return new Promise((resolve) => {
                setTimeout(() => {
                    try {
                        elements.disputeContainer = document.getElementById('dispute-container');
                        elements.coin = document.getElementById('dispute-coin');
                        elements.readyBtn = document.getElementById('ready-btn');
                        elements.closeBtn = document.getElementById('close-btn');
                        elements.playersList = document.getElementById('players-list');
                        elements.creatorInfo = document.getElementById('creator-info');
                        elements.opponentInfo = document.getElementById('opponent-info');
                        elements.waitingMessage = document.getElementById('waiting-message');
                        elements.resultMessage = document.getElementById('result-message');
                        elements.disputeSubject = document.getElementById('dispute-subject');
                        elements.disputeAmount = document.getElementById('dispute-amount');
                        elements.disputeId = document.getElementById('dispute-id');
                        
                        // Проверка важных элементов
                        if (!elements.coin) {
                            app.log('Dispute', 'Элемент монеты не найден', true);
                        }
                        
                        if (!elements.readyBtn) {
                            app.log('Dispute', 'Кнопка готовности не найдена', true);
                        }
                        
                        resolve(true);
                    } catch (error) {
                        app.log('Dispute', `Ошибка поиска DOM элементов: ${error.message}`, true);
                        resolve(false);
                    }
                }, 100);
            });
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            try {
                // Кнопка готовности
                if (elements.readyBtn) {
                    // Очищаем текущие обработчики
                    const newReadyBtn = elements.readyBtn.cloneNode(true);
                    elements.readyBtn.parentNode.replaceChild(newReadyBtn, elements.readyBtn);
                    elements.readyBtn = newReadyBtn;
                    
                    // Добавляем новый обработчик
                    elements.readyBtn.addEventListener('click', toggleReady);
                }
                
                // Кнопка закрытия
                if (elements.closeBtn) {
                    // Очищаем текущие обработчики
                    const newCloseBtn = elements.closeBtn.cloneNode(true);
                    elements.closeBtn.parentNode.replaceChild(newCloseBtn, elements.closeBtn);
                    elements.closeBtn = newCloseBtn;
                    
                    // Добавляем новый обработчик
                    elements.closeBtn.addEventListener('click', closeDispute);
                }
                
                // Обработчик сообщений от Telegram
                if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.onEvent('viewportChanged', updateLayout);
                    
                    // Обработчик внешних сообщений
                    window.addEventListener('message', handleExternalMessage);
                }
                
                app.log('Dispute', 'Обработчики событий установлены');
            } catch (error) {
                app.log('Dispute', `Ошибка настройки обработчиков: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка внешних сообщений
         */
        const handleExternalMessage = function(event) {
            try {
                // Проверяем источник сообщения
                if (event.origin !== window.location.origin) {
                    // Принимаем сообщения только от нашего домена
                    return;
                }
                
                const data = event.data;
                
                // Проверяем тип сообщения
                if (data && data.type) {
                    switch (data.type) {
                        case 'dispute_update':
                            handleDisputeUpdate(data);
                            break;
                        case 'player_ready':
                            handlePlayerReadyUpdate(data);
                            break;
                        case 'dispute_result':
                            handleDisputeResult(data);
                            break;
                    }
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обработки внешнего сообщения: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка обновления спора
         */
        const handleDisputeUpdate = function(data) {
            try {
                if (data.disputeId !== state.disputeId) {
                    return;
                }
                
                // Обновляем данные спора
                if (data.dispute) {
                    state.disputeData = data.dispute;
                    updateDisputeUI(data.dispute);
                }
                
                // Обновляем статусы готовности
                if (data.creatorReady !== undefined) {
                    const isCreatorUpdate = state.isCreator ? 'playerReady' : 'opponentReady';
                    const isOpponentUpdate = state.isCreator ? 'opponentReady' : 'playerReady';
                    
                    state[isCreatorUpdate] = data.creatorReady;
                    updatePlayerReadyStatus();
                }
                
                if (data.opponentReady !== undefined) {
                    const isCreatorUpdate = state.isCreator ? 'playerReady' : 'opponentReady';
                    const isOpponentUpdate = state.isCreator ? 'opponentReady' : 'playerReady';
                    
                    state[isOpponentUpdate] = data.opponentReady;
                    updateOpponentReadyStatus(state.opponentReady);
                }
                
                // Проверяем, готовы ли оба игрока
                if (data.bothReady) {
                    state.bothReady = true;
                    checkBothReady();
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обработки обновления спора: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка обновления статуса готовности игрока
         */
        const handlePlayerReadyUpdate = function(data) {
            try {
                if (data.disputeId !== state.disputeId) {
                    return;
                }
                
                if (data.isCreator !== state.isCreator) {
                    // Обновление от другого игрока
                    state.opponentReady = data.ready;
                    updateOpponentReadyStatus(state.opponentReady);
                    checkBothReady();
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обработки статуса готовности: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка результата спора
         */
        const handleDisputeResult = function(data) {
            try {
                if (data.disputeId !== state.disputeId) {
                    return;
                }
                
                state.result = data.result;
                flipCoinWithResult(data.result);
            } catch (error) {
                app.log('Dispute', `Ошибка обработки результата спора: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление макета при изменении размеров экрана
         */
        const updateLayout = function() {
            try {
                // Адаптируем размер контейнера к размеру окна
                if (elements.disputeContainer) {
                    const viewportHeight = window.innerHeight;
                    const viewportWidth = window.innerWidth;
                    
                    // Адаптируем размер монеты
                    if (elements.coin) {
                        if (viewportWidth < 400) {
                            elements.coin.style.width = '80px';
                            elements.coin.style.height = '80px';
                        } else {
                            elements.coin.style.width = '100px';
                            elements.coin.style.height = '100px';
                        }
                    }
                    
                    // Адаптируем высоту контейнера монетки
                    if (document.querySelector('.coin-container')) {
                        if (viewportHeight < 600) {
                            document.querySelector('.coin-container').style.height = '100px';
                        } else {
                            document.querySelector('.coin-container').style.height = '150px';
                        }
                    }
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обновления макета: ${error.message}`, true);
            }
        };
        
        /**
         * Загрузка данных спора с сервера
         */
        const loadDisputeData = async function(disputeId) {
            try {
                app.log('Dispute', `Загрузка данных спора ${disputeId}`);
                
                // Проверяем, есть ли API URL в глобальных переменных
                const apiUrl = window.GreenLightApp.apiUrl || '/api';
                
                // Запрос к API для получения данных спора
                const response = await fetch(`${apiUrl}/disputes/${disputeId}`);
                
                if (!response.ok) {
                    throw new Error(`Ошибка получения данных спора: ${response.status}`);
                }
                
                const disputeData = await response.json();
                state.disputeData = disputeData;
                
                // Обновляем информацию о пользователе
                updateUserInfo(disputeData);
                
                // Обновляем UI с данными спора
                updateDisputeUI(disputeData);
                
                app.log('Dispute', 'Данные спора загружены успешно');
                return disputeData;
            } catch (error) {
                app.log('Dispute', `Ошибка загрузки данных спора: ${error.message}`, true);
                
                // Для демонстрации используем тестовые данные
                const testData = {
                    _id: disputeId,
                    creator: {
                        telegramId: 123456789,
                        firstName: 'Пользователь1',
                        username: 'user1'
                    },
                    opponent: {
                        telegramId: 987654321,
                        firstName: 'Пользователь2',
                        username: 'user2'
                    },
                    creatorSide: 'heads',
                    opponentSide: 'tails',
                    bet: {
                        amount: 100
                    },
                    question: 'Кто выиграет матч?',
                    status: 'active'
                };
                
                state.disputeData = testData;
                updateUserInfo(testData);
                updateDisputeUI(testData);
                
                return testData;
            }
        };
        
        /**
         * Обновление данных спора из ответа сервера
         */
        const updateDisputeData = function(disputeData) {
            if (!disputeData) return;
            
            state.disputeData = disputeData;
            updateUserInfo(disputeData);
            updateDisputeUI(disputeData);
        };
        
        /**
         * Обновление UI с данными спора
         */
        const updateDisputeUI = function(disputeData) {
            try {
                if (!disputeData) return;
                
                // Обновляем ID спора
                if (elements.disputeId) {
                    elements.disputeId.textContent = `ID: ${disputeData._id}`;
                }
                
                // Обновляем тему спора
                if (elements.disputeSubject) {
                    elements.disputeSubject.textContent = disputeData.question;
                }
                
                // Обновляем сумму спора
                if (elements.disputeAmount) {
                    elements.disputeAmount.textContent = `${disputeData.bet.amount} ⭐`;
                }
                
                // Обновляем информацию о создателе
                if (elements.creatorInfo) {
                    const creatorName = elements.creatorInfo.querySelector('.player-name');
                    const creatorSide = elements.creatorInfo.querySelector('.player-side');
                    
                    if (creatorName) {
                        creatorName.textContent = disputeData.creator.firstName || disputeData.creator.username || 'Создатель';
                    }
                    
                    if (creatorSide) {
                        creatorSide.textContent = `Сторона: ${translateSide(disputeData.creatorSide)}`;
                    }
                }
                
                // Обновляем информацию об оппоненте
                if (elements.opponentInfo) {
                    const opponentName = elements.opponentInfo.querySelector('.player-name');
                    const opponentSide = elements.opponentInfo.querySelector('.player-side');
                    
                    if (opponentName) {
                        opponentName.textContent = disputeData.opponent ? 
                            (disputeData.opponent.firstName || disputeData.opponent.username || 'Оппонент') : 
                            'Ожидание оппонента...';
                    }
                    
                    if (opponentSide) {
                        opponentSide.textContent = `Сторона: ${translateSide(disputeData.opponentSide)}`;
                    }
                }
                
                app.log('Dispute', 'UI обновлен с данными спора');
            } catch (error) {
                app.log('Dispute', `Ошибка обновления UI: ${error.message}`, true);
            }
        };
        
        /**
         * Перевод стороны монеты на русский
         */
        const translateSide = function(side) {
            return side === 'heads' ? 'Орёл' : 'Решка';
        };
        
        /**
         * Обновление информации о пользователе
         */
        const updateUserInfo = function(disputeData) {
            try {
                if (!disputeData) return;
                
                // Получаем текущий telegramId пользователя
                let currentUserId = null;
                
                // Проверяем несколько источников telegramId
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                    currentUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
                } else if (window.GreenLightApp && window.GreenLightApp.user && window.GreenLightApp.user.telegramId) {
                    currentUserId = window.GreenLightApp.user.telegramId;
                }
                
                // Если ID не получен, используем демо-режим
                if (!currentUserId) {
                    app.log('Dispute', 'ID пользователя не найден, используем значение из URL');
                    
                    // В демо-режиме определяем роль из URL
                    const isCreatorParam = getUrlParameter('isCreator');
                    state.isCreator = isCreatorParam ? (isCreatorParam === 'true') : true;
                    
                    if (state.isCreator) {
                        state.playerSide = disputeData.creatorSide;
                        state.opponentSide = disputeData.opponentSide;
                    } else {
                        state.playerSide = disputeData.opponentSide;
                        state.opponentSide = disputeData.creatorSide;
                    }
                    
                    app.log('Dispute', `Демо-режим: ${state.isCreator ? 'создатель' : 'оппонент'}, сторона: ${state.playerSide}`);
                    return;
                }
                
                // Определяем, является ли пользователь создателем спора
                if (disputeData.creator && 
                    String(disputeData.creator.telegramId) === String(currentUserId)) {
                    state.isCreator = true;
                    state.playerSide = disputeData.creatorSide;
                    state.opponentSide = disputeData.opponentSide;
                } else if (disputeData.opponent && 
                           String(disputeData.opponent.telegramId) === String(currentUserId)) {
                    state.isCreator = false;
                    state.playerSide = disputeData.opponentSide;
                    state.opponentSide = disputeData.creatorSide;
                } else {
                    // Не является участником спора - предполагаем, что оппонент
                    state.isCreator = false;
                    state.playerSide = disputeData.opponentSide;
                    state.opponentSide = disputeData.creatorSide;
                    
                    app.log('Dispute', 'Пользователь не является участником спора, считаем его оппонентом', true);
                }
                
                app.log('Dispute', `Пользователь: ${state.isCreator ? 'создатель' : 'оппонент'}, сторона: ${state.playerSide}`);
            } catch (error) {
                app.log('Dispute', `Ошибка обновления информации о пользователе: ${error.message}`, true);
            }
        };
        
        /**
         * Подключение к комнате спора
         */
        const connectToDisputeRoom = function() {
            try {
                app.log('Dispute', `Подключение к комнате спора ${state.roomId}`);
                
                // Отправляем запрос на создание комнаты
                const apiUrl = window.GreenLightApp.apiUrl || '/api';
                
                // Отправляем запрос на создание комнаты
                fetch(`${apiUrl}/disputes/room/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        disputeId: state.disputeId,
                        roomId: state.roomId,
                        userTelegramId: window.GreenLightApp && window.GreenLightApp.user ? 
                            window.GreenLightApp.user.telegramId : null
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Ошибка создания комнаты: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    app.log('Dispute', 'Комната спора создана успешно');
                    
                    // Обновляем данные спора из ответа
                    if (data.dispute) {
                        updateDisputeData(data.dispute);
                    }
                    
                    // Запускаем проверку статуса комнаты
                    startRoomStatusCheck();
                })
                .catch(error => {
                    app.log('Dispute', `Ошибка создания комнаты: ${error.message}`, true);
                    
                    // Симулируем подключение к комнате в демо-режиме
                    simulateRoomConnection();
                });
            } catch (error) {
                app.log('Dispute', `Ошибка подключения к комнате: ${error.message}`, true);
                
                // Симулируем подключение к комнате в случае ошибки
                simulateRoomConnection();
            }
        };
        
        /**
         * Периодическая проверка статуса комнаты
         */
        const startRoomStatusCheck = function() {
            app.log('Dispute', 'Запуск проверки статуса комнаты');
            
            if (state.roomStatusInterval) {
                clearInterval(state.roomStatusInterval);
            }
            
            // ВАЖНО: Уменьшим интервал до 1 секунды для более частых проверок
            state.roomStatusInterval = setInterval(() => {
                checkRoomStatus();
            }, 1000); // Используем 1000 мс вместо 3000 мс
            
            // Запустим первую проверку сразу
            checkRoomStatus();
            
            // Добавим дополнительную проверку через 500 мс,
            // чтобы гарантировать получение первого ответа
            setTimeout(() => {
                checkRoomStatus();
            }, 500);
        };
        
        /**
         * Проверка статуса комнаты
         */
        const checkRoomStatus = function() {
            try {
                // Не проверяем, если игра уже завершена
                if (state.hasFinished) {
                    if (state.roomStatusInterval) {
                        clearInterval(state.roomStatusInterval);
                        state.roomStatusInterval = null;
                    }
                    return;
                }
                
                // Проверяем, есть ли API URL в глобальных переменных
                const apiUrl = window.GreenLightApp.apiUrl || '/api';
                
                // Добавляем метку времени и nocache параметр
                const timestamp = Date.now();
                const url = `${apiUrl}/disputes/room/${state.disputeId}?t=${timestamp}&nocache=true`;
                
                app.log('Dispute', `Запрос статуса комнаты: ${url}`);
                
                // Запрашиваем статус комнаты с принудительным обходом кэша
                fetch(url, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Ошибка получения статуса комнаты: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    app.log('Dispute', `Получен статус комнаты: ${JSON.stringify(data)}`);
                    
                    // Логируем текущее состояние перед обновлением
                    app.log('Dispute', `Текущее состояние: playerReady=${state.playerReady}, opponentReady=${state.opponentReady}, bothReady=${state.bothReady}`);
                    
                    // Получаем актуальные статусы в зависимости от роли
                    const serverPlayerReady = state.isCreator ? data.creatorReady : data.opponentReady;
                    const serverOpponentReady = state.isCreator ? data.opponentReady : data.creatorReady;
                    
                    // Проверяем, соответствует ли статус игрока на сервере
                    if (serverPlayerReady !== state.playerReady) {
                        app.log('Dispute', `КРИТИЧНО: Статус игрока на сервере (${serverPlayerReady}) не соответствует локальному (${state.playerReady})`);
                        
                        // Если на сервере не обновился статус, повторно отправляем
                        if (state.playerReady && !serverPlayerReady) {
                            app.log('Dispute', 'Повторная отправка статуса готовности на сервер');
                            sendReadyStatusViaAPI();
                        }
                    }
                    
                    // Обновляем статус оппонента если он изменился
                    if (serverOpponentReady !== state.opponentReady) {
                        app.log('Dispute', `Обновление статуса оппонента: ${state.opponentReady} -> ${serverOpponentReady}`);
                        state.opponentReady = serverOpponentReady;
                        updateOpponentReadyStatus(serverOpponentReady);
                    }
                    
                    // Проверяем статус bothReady (самый важный триггер)
                    if (data.bothReady && !state.bothReady) {
                        app.log('Dispute', '🔥 Сервер сообщает, что оба игрока готовы!');
                        state.bothReady = true;
                        checkBothReady();
                    } else if (state.playerReady && state.opponentReady && !state.bothReady) {
                        // Если локально оба готовы, но флаг не установлен
                        app.log('Dispute', '🔥 Локально оба игрока готовы, устанавливаем bothReady=true');
                        state.bothReady = true;
                        checkBothReady();
                    }
                    
                    // Проверяем результат спора
                    if (data.status === 'completed' && data.result && !state.hasFinished) {
                        app.log('Dispute', `Получен результат спора: ${data.result}`);
                        state.result = data.result;
                        flipCoinWithResult(data.result);
                    }
                })
                .catch(error => {
                    app.log('Dispute', `Ошибка проверки статуса комнаты: ${error.message}`, true);
                    
                    // При ошибке повторяем запрос через короткое время
                    setTimeout(checkRoomStatus, 500);
                });
            } catch (error) {
                app.log('Dispute', `Ошибка проверки статуса комнаты: ${error.message}`, true);
            }
        };
        
        /**
         * Принудительное обновление статуса
         */
        const triggerForcedStatusUpdate = function() {
            app.log('Dispute', 'Запуск принудительного обновления статуса');
            
            // Принудительно запрашиваем статус комнаты 3 раза с небольшими интервалами
            checkRoomStatus();
            
            setTimeout(() => {
                checkRoomStatus();
            }, 300);
            
            setTimeout(() => {
                checkRoomStatus();
            }, 700);
        };
        
        /**
         * Симуляция подключения к комнате (для демо-режима)
         */
        const simulateRoomConnection = function() {
            app.log('Dispute', 'Симуляция подключения к комнате');
            
            // Ждем 1 секунду и симулируем автоматическое подключение оппонента
            setTimeout(() => {
                updateOpponentStatus(true);
                
                // Проверяем статус готовности пользователя
                if (state.playerReady) {
                    // Если пользователь уже готов, оппонент тоже будет готов через 2 секунды
                    setTimeout(() => {
                        updateOpponentReadyStatus(true);
                        checkBothReady();
                    }, 2000);
                }
            }, 1000);
        };
        
        /**
         * Обновление статуса оппонента
         */
        const updateOpponentStatus = function(joined) {
            try {
                const opponentStatusEl = elements.opponentInfo.querySelector('.ready-status');
                if (opponentStatusEl) {
                    if (joined) {
                        opponentStatusEl.textContent = 'Не готов';
                        opponentStatusEl.className = 'ready-status not-ready';
                    } else {
                        opponentStatusEl.textContent = 'Не присоединился';
                        opponentStatusEl.className = 'ready-status not-ready';
                    }
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обновления статуса оппонента: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление статуса готовности оппонента
         */
        const updateOpponentReadyStatus = function(ready) {
            try {
                state.opponentReady = ready;
                
                const opponentStatusEl = elements.opponentInfo.querySelector('.ready-status');
                if (opponentStatusEl) {
                    if (ready) {
                        opponentStatusEl.textContent = 'Готов';
                        opponentStatusEl.className = 'ready-status ready';
                    } else {
                        opponentStatusEl.textContent = 'Не готов';
                        opponentStatusEl.className = 'ready-status not-ready';
                    }
                }
                
                app.log('Dispute', `Статус готовности оппонента: ${ready}`);
                
                // Проверяем, готовы ли оба игрока
                if (state.playerReady && state.opponentReady && !state.bothReady) {
                    app.log('Dispute', 'Оба игрока готовы после обновления статуса оппонента');
                    state.bothReady = true;
                    checkBothReady();
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обновления статуса готовности оппонента: ${error.message}`, true);
            }
        };
        
        /**
         * Переключение статуса готовности игрока
         */
        const toggleReady = function() {
            try {
                // Игнорируем, если подбрасывание уже началось
                if (state.isFlipping || state.bothReady) return;
                
                // Воспроизводим звук нажатия
                playSound('click');
                
                // Отмечаем, что пользователь взаимодействовал с готовностью
                state.userInteracted = true;
                
                // Инвертируем текущий статус
                state.playerReady = !state.playerReady;
                
                // Если статус изменился на "готов", воспроизводим соответствующий звук
                if (state.playerReady) {
                    playSound('ready');
                }
                
                // Обновляем UI
                updatePlayerReadyStatus();
                
                // Отправляем сообщение об изменении статуса
                sendReadyStatus();
                
                // ВАЖНО: Также немедленно проверяем, готовы ли оба игрока
                if (state.playerReady && state.opponentReady) {
                    app.log('Dispute', 'Оба игрока готовы по локальным данным, устанавливаем bothReady=true');
                    state.bothReady = true;
                    checkBothReady();
                }
                
                app.log('Dispute', `Статус готовности игрока: ${state.playerReady}`);
                
                // Запускаем дополнительную проверку через 1 секунду
                setTimeout(() => triggerForcedStatusUpdate(), 1000);
            } catch (error) {
                app.log('Dispute', `Ошибка переключения статуса готовности: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление статуса готовности игрока в UI
         */
        const updatePlayerReadyStatus = function() {
            try {
                const playerInfo = state.isCreator ? elements.creatorInfo : elements.opponentInfo;
                const playerStatusEl = playerInfo.querySelector('.ready-status');
                
                if (playerStatusEl) {
                    if (state.playerReady) {
                        playerStatusEl.textContent = 'Готов';
                        playerStatusEl.className = 'ready-status ready';
                        elements.readyBtn.textContent = 'ОТМЕНИТЬ ГОТОВНОСТЬ';
                    } else {
                        playerStatusEl.textContent = 'Не готов';
                        playerStatusEl.className = 'ready-status not-ready';
                        elements.readyBtn.textContent = 'Я ГОТОВ';
                    }
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обновления статуса готовности игрока: ${error.message}`, true);
            }
        };
        
        /**
         * Отправка статуса готовности
         */
        const sendReadyStatus = function() {
            try {
                // Отправляем сообщение в родительское окно Telegram
                if (window.Telegram && window.Telegram.WebApp) {
                    const readyData = {
                        type: 'player_ready',
                        disputeId: state.disputeId,
                        roomId: state.roomId,
                        isCreator: state.isCreator,
                        ready: state.playerReady
                    };
                    
                    window.Telegram.WebApp.sendData(JSON.stringify(readyData));
                    app.log('Dispute', `Отправлен статус готовности через Telegram WebApp: ${state.playerReady}`);
                    
                    // Дополнительно форсируем обновление статуса через API
                    // чтобы обойти проблему с отсутствием уведомлений
                    sendReadyStatusViaAPI();
                } else {
                    // В демо-режиме отправляем запрос через fetch
                    sendReadyStatusViaAPI();
                }
            } catch (error) {
                app.log('Dispute', `Ошибка отправки статуса готовности: ${error.message}`, true);
                // При ошибке пробуем отправить через API
                sendReadyStatusViaAPI();
            }
        };
        
        /**
         * Отправка статуса готовности через API напрямую
         */
        const sendReadyStatusViaAPI = function() {
            try {
                app.log('Dispute', 'Отправка статуса готовности через fetch API');
                
                // Ограничиваем количество попыток
                if (state.readyAttempts > 10) {
                    app.log('Dispute', 'Превышено максимальное количество попыток отправки статуса', true);
                    return;
                }
                
                state.readyAttempts++;
                
                // Проверяем, есть ли API URL в глобальных переменных
                const apiUrl = window.GreenLightApp.apiUrl || '/api';
                
                // Определяем ID пользователя
                let userTelegramId;
                
                if (state.isCreator && state.disputeData && state.disputeData.creator) {
                    userTelegramId = state.disputeData.creator.telegramId || state.disputeData.creatorTelegramId;
                } else if (!state.isCreator && state.disputeData && state.disputeData.opponent) {
                    userTelegramId = state.disputeData.opponent.telegramId || state.disputeData.opponentTelegramId;
                } else if (state.disputeData) {
                    // Резервный вариант
                    userTelegramId = state.isCreator ? 
                        state.disputeData.creatorTelegramId : 
                        state.disputeData.opponentTelegramId;
                }
                
                if (!userTelegramId) {
                    app.log('Dispute', 'Ошибка: не удалось определить telegramId пользователя', true);
                    return; // Прерываем выполнение, если нет ID
                }
                
                // Формируем данные с явными типами
                const readyData = {
                    disputeId: state.disputeId,
                    userTelegramId: String(userTelegramId),
                    ready: Boolean(state.playerReady)
                };
                
                // Добавляем метку времени для предотвращения кэширования
                const timestamp = Date.now();
                
                // Отображаем данные для отладки
                app.log('Dispute', `Отправка статуса на сервер: ${JSON.stringify(readyData)}`);
                
                // Отправляем запрос на обновление статуса готовности
                fetch(`${apiUrl}/disputes/room/ready?t=${timestamp}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store'
                    },
                    body: JSON.stringify(readyData)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Ошибка обновления статуса готовности: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    state.readyAttempts = 0; // Сброс счетчика при успехе
                    
                    if (data.success) {
                        app.log('Dispute', 'Статус готовности обновлен успешно');
                        app.log('Dispute', `Ответ сервера: ${JSON.stringify(data)}`);
                        
                        // Проверяем, что сервер действительно обновил статус
                        const serverReportedStatus = state.isCreator ? data.creatorReady : data.opponentReady;
                        
                        if (serverReportedStatus !== state.playerReady) {
                            app.log('Dispute', `ВНИМАНИЕ: Сервер вернул другой статус игрока (${serverReportedStatus}) чем отправили (${state.playerReady})`, true);
                            
                            // В случае несоответствия повторно отправляем статус
                            setTimeout(() => sendReadyStatusViaAPI(), 500);
                        }
                        
                        // Обновляем статус оппонента на основе данных с сервера
                        const opponentStatus = state.isCreator ? data.opponentReady : data.creatorReady;
                        if (opponentStatus !== state.opponentReady) {
                            app.log('Dispute', `Обновление статуса оппонента с сервера: ${opponentStatus}`);
                            state.opponentReady = opponentStatus;
                            updateOpponentReadyStatus(opponentStatus);
                        }
                        
                        // Проверяем на bothReady
                        if (data.bothReady) {
                            app.log('Dispute', 'Сервер сообщает, что оба игрока готовы!');
                            state.bothReady = true;
                            checkBothReady();
                        } else if (state.playerReady && state.opponentReady && !state.bothReady) {
                            // Двойная проверка
                            app.log('Dispute', 'Проверка: локально оба игрока готовы, но флаг bothReady не установлен');
                            state.bothReady = true;
                            checkBothReady();
                        }
                        
                        // ВАЖНО: Делаем принудительную проверку статуса через секунду
                        setTimeout(() => checkRoomStatus(), 1000);
                    } else {
                        app.log('Dispute', `Ошибка обновления статуса на сервере: ${data.message || 'Неизвестная ошибка'}`, true);
                        
                        // В случае ошибки повторяем попытку
                        setTimeout(() => sendReadyStatusViaAPI(), 1000);
                    }
                })
                .catch(error => {
                    app.log('Dispute', `Ошибка запроса обновления статуса: ${error.message}`, true);
                    
                    // Повторная попытка через секунду
                    setTimeout(() => sendReadyStatusViaAPI(), 1000);
                });
            } catch (error) {
                app.log('Dispute', `Ошибка в функции sendReadyStatusViaAPI: ${error.message}`, true);
            }
        };
        
        /**
         * Симуляция готовности оппонента (для демо-режима)
         */
        const simulateOpponentReady = function() {
            app.log('Dispute', 'Симуляция готовности оппонента');
            
            setTimeout(() => {
                if (state.playerReady) {
                    // Если игрок готов, оппонент тоже готов
                    updateOpponentReadyStatus(true);
                    checkBothReady();
                } else {
                    // Если игрок отменил готовность, оппонент тоже отменяет
                    updateOpponentReadyStatus(false);
                }
            }, 1500);
        };
        
        /**
         * Проверка готовности обоих игроков
         */
        const checkBothReady = function() {
            try {
                app.log('Dispute', `👀 Проверка готовности обоих игроков: Player=${state.playerReady}, Opponent=${state.opponentReady}, BothReady=${state.bothReady}`);
                
                // Принудительно запускаем подбрасывание, даже если другие условия не выполнены
                if (state.bothReady && !state.isFlipping) {
                    app.log('Dispute', '🎲 ЗАПУСК: Начинаем подбрасывание монетки!');
                    
                    // Обновляем UI
                    if (elements.waitingMessage) {
                        elements.waitingMessage.textContent = 'Оба игрока готовы! Подбрасываем монетку...';
                    }
                    
                    // Блокируем кнопку готовности
                    if (elements.readyBtn) {
                        elements.readyBtn.disabled = true;
                        elements.readyBtn.classList.add('disabled');
                    }
                    
                    // Начинаем подбрасывание монетки
                    setTimeout(() => {
                        startCoinFlip();
                    }, 500); // Небольшая задержка для обновления UI
                    
                    app.log('Dispute', 'Оба игрока готовы, начинаем подбрасывание');
                } else if (state.playerReady && state.opponentReady && !state.bothReady) {
                    // Также запускаем, если оба статуса готовности true,
                    // но для какой-то причины bothReady остался false
                    app.log('Dispute', '🎲 РЕЗЕРВНЫЙ ЗАПУСК: Начинаем подбрасывание монетки!');
                    state.bothReady = true;
                    
                    // Обновляем UI
                    if (elements.waitingMessage) {
                        elements.waitingMessage.textContent = 'Оба игрока готовы! Подбрасываем монетку...';
                    }
                    
                    // Блокируем кнопку готовности
                    if (elements.readyBtn) {
                        elements.readyBtn.disabled = true;
                        elements.readyBtn.classList.add('disabled');
                    }
                    
                    // Начинаем подбрасывание монетки с небольшой задержкой
                    setTimeout(() => {
                        startCoinFlip();
                    }, 500);
                    
                    app.log('Dispute', 'Оба игрока готовы (резервный запуск), начинаем подбрасывание');
                } else {
                    app.log('Dispute', 'Проверка готовности: условия не выполнены');
                }
            } catch (error) {
                app.log('Dispute', `Ошибка в checkBothReady: ${error.message}`, true);
                
                // Даже при ошибке пробуем запустить подбрасывание, если оба статуса готовности true
                if (state.playerReady && state.opponentReady && !state.isFlipping) {
                    app.log('Dispute', '🎲 АВАРИЙНЫЙ ЗАПУСК: Начинаем подбрасывание монетки!');
                    state.bothReady = true;
                    startCoinFlip();
                }
            }
        };
        
        /**
         * Запуск автоматического режима (для быстрой демонстрации)
         */
        const startAutomaticMode = function() {
            app.log('Dispute', 'Запуск автоматического режима');
            
            // Имитируем нажатие кнопки "Я готов"
            setTimeout(() => {
                if (elements.readyBtn) {
                    elements.readyBtn.click();
                }
            }, 1000);
        };
        
        /**
         * Начало подбрасывания монетки
         */
        const startCoinFlip = function() {
            try {
                // Устанавливаем флаг подбрасывания
                state.isFlipping = true;
                
                // Загружаем результат спора с сервера
                if (state.isCreator) {
                    // Создатель спора определяет результат подбрасывания
                    loadDisputeResult();
                } else {
                    // Оппонент ожидает результат от создателя
                    if (elements.waitingMessage) {
                        elements.waitingMessage.textContent = 'Ожидание определения результата...';
                    }
                }
            } catch (error) {
                app.log('Dispute', `Ошибка начала подбрасывания: ${error.message}`, true);
            }
        };
        
        /**
         * Загрузка результата спора с сервера
         */
        const loadDisputeResult = function() {
            try {
                app.log('Dispute', 'Загрузка результата спора');
                
                // Проверяем, есть ли API URL в глобальных переменных
                const apiUrl = window.GreenLightApp.apiUrl || '/api';
                
                // Запрос к API для получения результата спора
                fetch(`${apiUrl}/disputes/result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ disputeId: state.disputeId })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Ошибка получения результата: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Сохраняем результат
                    state.result = data.result;
                    
                    // Отправляем результат оппоненту
                    sendCoinResult(data.result);
                    
                    // Запускаем анимацию монетки
                    flipCoinWithResult(data.result);
                })
                .catch(error => {
                    app.log('Dispute', `Ошибка загрузки результата: ${error.message}`, true);
                    
                    // В случае ошибки генерируем случайный результат
                    const result = Math.random() < 0.5 ? 'heads' : 'tails';
                    state.result = result;
                    sendCoinResult(result);
                    flipCoinWithResult(result);
                });
            } catch (error) {
                app.log('Dispute', `Ошибка запроса результата: ${error.message}`, true);
                
                // В случае ошибки генерируем случайный результат
                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                state.result = result;
                sendCoinResult(result);
                flipCoinWithResult(result);
            }
        };
        
        /**
         * Отправка результата подбрасывания монетки оппоненту
         */
        const sendCoinResult = function(result) {
            try {
                // Отправляем сообщение через Telegram WebApp
                if (window.Telegram && window.Telegram.WebApp) {
                    const resultData = {
                        type: 'dispute_result',
                        disputeId: state.disputeId,
                        roomId: state.roomId,
                        result: result
                    };
                    
                    window.Telegram.WebApp.sendData(JSON.stringify(resultData));
                    app.log('Dispute', `Отправлен результат подбрасывания: ${result}`);
                }
            } catch (error) {
                app.log('Dispute', `Ошибка отправки результата: ${error.message}`, true);
            }
        };
        
        /**
         * Подбрасывание монетки с заданным результатом
         */
        const flipCoinWithResult = function(result) {
            try {
                app.log('Dispute', `Подбрасывание монетки с результатом: ${result}`);
                
                if (!elements.coin) {
                    app.log('Dispute', 'Элемент монетки не найден', true);
                    showResult(result);
                    return;
                }
                
                // Воспроизводим звук подбрасывания
                playSound('flip');
                
                // Убираем предыдущие классы результата
                elements.coin.classList.remove('heads-result', 'tails-result', 'heads', 'tails');
                
                // Сбрасываем стили для анимации
                elements.coin.style.animation = 'none';
                
                // Форсируем перерисовку
                void elements.coin.offsetWidth;
                
                // Добавляем класс для анимации
                elements.coin.classList.add(`${result}-result`);
                
                // Ждем окончания анимации
                setTimeout(() => {
                    // Останавливаем анимацию и устанавливаем финальное положение
                    elements.coin.style.animation = 'none';
                    elements.coin.classList.add(result);
                    
                    // Показываем результат
                    showResult(result);
                    
                    // Сбрасываем флаг подбрасывания
                    state.isFlipping = false;
                }, 3000);
            } catch (error) {
                app.log('Dispute', `Ошибка подбрасывания монетки: ${error.message}`, true);
                showResult(result);
            }
        };
        
        /**
         * Отображение результата подбрасывания
         */
        const showResult = function(result) {
            try {
                const playerWon = result === state.playerSide;
                
                // Воспроизводим звук результата
                playSound(playerWon ? 'win' : 'lose');
                
                // Показываем сообщение о результате
                if (elements.resultMessage) {
                    elements.resultMessage.innerHTML = playerWon 
                        ? `<div>Вы выиграли!</div><div>Выпал ${translateSide(result)}</div>` 
                        : `<div>Вы проиграли</div><div>Выпал ${translateSide(result)}</div>`;
                    
                    elements.resultMessage.className = `result-message ${playerWon ? 'win' : 'lose'}`;
                }
                
                // Скрываем сообщение ожидания
                if (elements.waitingMessage) {
                    elements.waitingMessage.style.display = 'none';
                }
                
                // Обновляем текст кнопки закрытия
                if (elements.closeBtn) {
                    elements.closeBtn.textContent = 'ЗАКРЫТЬ';
                }
                
                // Отмечаем спор как завершенный
                state.hasFinished = true;
                
                app.log('Dispute', `Результат: ${result}, игрок ${playerWon ? 'выиграл' : 'проиграл'}`);
                
                // Отправляем результат в Telegram, если мы in-app
                sendDisputeResultToTelegram(result, playerWon);
                
                // Автоматическое закрытие через 5 секунд
                setTimeout(() => {
                    if (!state.closed) {
                        closeDispute();
                    }
                }, 5000);
            } catch (error) {
                app.log('Dispute', `Ошибка отображения результата: ${error.message}`, true);
            }
        };
        
        /**
         * Отправка результата спора в Telegram
         */
        const sendDisputeResultToTelegram = function(result, playerWon) {
            try {
                if (window.Telegram && window.Telegram.WebApp) {
                    const resultData = {
                        type: 'dispute_result_final',
                        disputeId: state.disputeId,
                        result: result,
                        playerWon: playerWon
                    };
                    
                    window.Telegram.WebApp.sendData(JSON.stringify(resultData));
                    app.log('Dispute', 'Финальный результат отправлен в Telegram');
                }
            } catch (error) {
                app.log('Dispute', `Ошибка отправки результата в Telegram: ${error.message}`, true);
            }
        };
        
        /**
         * Закрытие спора
         */
        const closeDispute = function() {
            app.log('Dispute', 'Закрытие спора');
            
            state.closed = true;
            
            try {
                // Отправляем запрос на закрытие комнаты
                const apiUrl = window.GreenLightApp.apiUrl || '/api';
                
                fetch(`${apiUrl}/disputes/room/close`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        disputeId: state.disputeId,
                        userTelegramId: state.isCreator ? 
                            (state.disputeData.creator && state.disputeData.creator.telegramId) : 
                            (state.disputeData.opponent && state.disputeData.opponent.telegramId)
                    })
                }).catch(error => {
                    app.log('Dispute', `Ошибка закрытия комнаты: ${error.message}`, true);
                });
            } catch (error) {
                app.log('Dispute', `Ошибка запроса закрытия комнаты: ${error.message}`, true);
            }
            
            // Воспроизводим звук нажатия
            playSound('click');
            
            // Удаляем оверлей
            const overlay = document.querySelector('.dispute-overlay');
            if (overlay) {
                document.body.removeChild(overlay);
            }
            
            // Удаляем контейнер спора
            if (elements.disputeContainer) {
                document.body.removeChild(elements.disputeContainer);
            }
            
            // Восстанавливаем основной контент приложения
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.style.display = 'block';
            }
            
            // Восстанавливаем экраны
            document.querySelectorAll('.screen').forEach(screen => {
                screen.style.display = 'block';
            });
            
            // Восстанавливаем навигацию
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) {
                bottomNav.style.display = 'block';
            }
            
            // Активируем главный экран
            const welcomeScreen = document.getElementById('welcome-screen');
            if (welcomeScreen) {
                welcomeScreen.classList.add('active');
            }
            
            // Закрываем мини-приложение Telegram
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.close();
            }
        };
        
        // Публичный интерфейс
        return {
            // Основные методы
            init: init,
            closeDispute: closeDispute,
            
            // Геттер для текущего состояния
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    isFlipping: state.isFlipping,
                    disputeId: state.disputeId,
                    roomId: state.roomId,
                    playerSide: state.playerSide,
                    playerReady: state.playerReady,
                    opponentReady: state.opponentReady,
                    bothReady: state.bothReady,
                    result: state.result,
                    hasFinished: state.hasFinished
                };
            }
        };
    })();
    
    // Регистрируем игру в разных форматах для максимальной совместимости
    try {
        // 1. Регистрация через новую систему
        if (window.registerGame) {
            window.registerGame('disputeGame', disputeGame);
            app.log('Dispute', 'Игра зарегистрирована через систему registerGame');
        }
        
        // 2. Экспорт в глобальное пространство имен (обратная совместимость)
        window.disputeGame = disputeGame;
        app.log('Dispute', 'Игра экспортирована в глобальное пространство имен');
        
        // 3. Логирование завершения загрузки модуля
        app.log('Dispute', 'Модуль загружен и готов к инициализации');
        
        // 4. Автоматическая инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                // Проверяем наличие параметра dispute в URL
                const disputeId = new URLSearchParams(window.location.search).get('dispute');
                
                if (disputeId && !disputeGame.getStatus().initialized && !disputeGame.getStatus().initializationStarted) {
                    app.log('Dispute', 'Обнаружен параметр dispute в URL, начало автоматической инициализации');
                    disputeGame.init().then(success => {
                        if (success) {
                            app.log('Dispute', 'Автоматическая инициализация успешно завершена');
                        } else {
                            app.log('Dispute', 'Ошибка автоматической инициализации', true);
                        }
                    });
                }
            }, 500);
        });
        
        // 5. Если DOM уже загружен, инициализируем сразу
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                // Проверяем наличие параметра dispute в URL
                const disputeId = new URLSearchParams(window.location.search).get('dispute');
                
                if (disputeId && !disputeGame.getStatus().initialized && !disputeGame.getStatus().initializationStarted) {
                    app.log('Dispute', 'DOM уже загружен, обнаружен параметр dispute в URL, начало автоматической инициализации');
                    disputeGame.init().then(success => {
                        if (success) {
                            app.log('Dispute', 'Автоматическая инициализация успешно завершена');
                        } else {
                            app.log('Dispute', 'Ошибка автоматической инициализации', true);
                        }
                    });
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Dispute', `Ошибка регистрации игры: ${error.message}`, true);
    }
})();