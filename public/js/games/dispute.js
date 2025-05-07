/**
 * dispute.js - Улучшенная версия режима спора с монеткой
 * Версия 2.0.0
 * 
 * Особенности:
 * - Поддержка комнаты для двух участников спора
 * - Механизм готовности игроков
 * - Интеграция с Telegram для обновления сообщений
 * - Автоматический запуск монетки при готовности обоих участников
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
    app.log('Dispute', 'Инициализация модуля Dispute v2.0.0');
    
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
            resultMessage: null
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
            hasFinished: false
        };
        
        // Звуковые эффекты
        let sounds = {
            flip: null,
            win: null,
            lose: null
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
                
                if (!disputeId) {
                    app.log('Dispute', 'Отсутствует ID спора в URL', true);
                    return false;
                }
                
                state.disputeId = disputeId;
                state.roomId = roomId || generateRoomId();
                
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
                
                return true;
            } catch (error) {
                app.log('Dispute', `Ошибка инициализации: ${error.message}`, true);
                return false;
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
                sounds.flip = new Audio('sounds/flip.mp3');
                sounds.win = new Audio('sounds/win.mp3');
                sounds.lose = new Audio('sounds/lose.mp3');
                
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
         * Воспроизведение звука
         */
        const playSound = function(soundName) {
            try {
                const sound = sounds[soundName];
                if (sound) {
                    sound.currentTime = 0;
                    sound.play().catch(e => {
                        // Игнорируем ошибки автовоспроизведения
                    });
                }
            } catch (error) {
                app.log('Dispute', `Ошибка воспроизведения звука: ${error.message}`, true);
            }
        };
        
        /**
         * Создание пользовательского интерфейса
         */
        const createUI = async function() {
            return new Promise((resolve) => {
                try {
                    // Находим контейнер для игры
                    let disputeContainer = document.getElementById('dispute-container');
                    
                    // Если контейнер не существует, создаем его
                    if (!disputeContainer) {
                        disputeContainer = document.createElement('div');
                        disputeContainer.id = 'dispute-container';
                        document.body.appendChild(disputeContainer);
                    }
                    
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
                            <button id="ready-btn" class="ready-btn">Я ГОТОВ</button>
                            <button id="close-btn" class="close-btn">ЗАКРЫТЬ</button>
                        </div>
                        
                        <div class="dispute-footer">
                            <div class="dispute-note">
                                Подбрасывание монетки начнется автоматически, когда оба участника будут готовы
                            </div>
                        </div>
                    `;
                    
                    // Добавляем стили, если их нет
                    if (!document.getElementById('dispute-styles')) {
                        const styleElement = document.createElement('style');
                        styleElement.id = 'dispute-styles';
                        styleElement.textContent = `
                            #dispute-container {
                                max-width: 500px;
                                margin: 0 auto;
                                padding: 20px;
                                background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                                border-radius: 15px;
                                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                                color: white;
                                font-family: 'Arial', sans-serif;
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
                            .coin .tails {
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
                            
                            .coin .heads {
                                background: radial-gradient(#FFD700, #B8860B);
                                z-index: 2;
                            }
                            
                            .coin .heads::before {
                                content: "H";
                            }
                            
                            .coin .tails {
                                background: radial-gradient(#C0C0C0, #808080);
                                transform: rotateY(180deg);
                            }
                            
                            .coin .tails::before {
                                content: "T";
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
                            
                            .ready-btn, .close-btn {
                                flex: 1;
                                padding: 15px;
                                border: none;
                                border-radius: 10px;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.3s;
                            }
                            
                            .ready-btn {
                                background: #1db954;
                                color: white;
                            }
                            
                            .ready-btn:hover {
                                background: #15ad49;
                                transform: translateY(-2px);
                                box-shadow: 0 5px 15px rgba(29, 185, 84, 0.3);
                            }
                            
                            .ready-btn:active {
                                transform: translateY(1px);
                            }
                            
                            .ready-btn.disabled {
                                background: #888;
                                cursor: not-allowed;
                                transform: none;
                                box-shadow: none;
                            }
                            
                            .close-btn {
                                background: #333;
                                color: white;
                            }
                            
                            .close-btn:hover {
                                background: #444;
                                transform: translateY(-2px);
                            }
                            
                            .close-btn:active {
                                transform: translateY(1px);
                            }
                            
                            .dispute-footer {
                                text-align: center;
                                font-size: 12px;
                                color: #777;
                            }
                        `;
                        document.head.appendChild(styleElement);
                    }
                    
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
                    elements.readyBtn.addEventListener('click', toggleReady);
                }
                
                // Кнопка закрытия
                if (elements.closeBtn) {
                    elements.closeBtn.addEventListener('click', closeDispute);
                }
                
                // Обработчик сообщений от Telegram
                if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.onEvent('message', handleTelegramMessage);
                }
                
                app.log('Dispute', 'Обработчики событий установлены');
            } catch (error) {
                app.log('Dispute', `Ошибка настройки обработчиков: ${error.message}`, true);
            }
        };
        
        /**
         * Загрузка данных спора с сервера
         */
        const loadDisputeData = async function(disputeId) {
            try {
                app.log('Dispute', `Загрузка данных спора ${disputeId}`);
                
                // Запрос к API для получения данных спора
                const response = await fetch(`/api/disputes/${disputeId}`);
                
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
                        creatorName.textContent = disputeData.creator.firstName || disputeData.creator.username;
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
                        opponentName.textContent = disputeData.opponent.firstName || disputeData.opponent.username;
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
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                    currentUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
                } else if (window.GreenLightApp && window.GreenLightApp.user) {
                    currentUserId = window.GreenLightApp.user.telegramId;
                }
                
                // Если ID не получен, используем демо-режим
                if (!currentUserId) {
                    app.log('Dispute', 'ID пользователя не найден, используем демо-режим');
                    // В демо-режиме считаем пользователя создателем
                    state.isCreator = true;
                    state.playerSide = disputeData.creatorSide;
                    state.opponentSide = disputeData.opponentSide;
                    return;
                }
                
                // Определяем, является ли пользователь создателем спора
                if (disputeData.creator.telegramId === currentUserId) {
                    state.isCreator = true;
                    state.playerSide = disputeData.creatorSide;
                    state.opponentSide = disputeData.opponentSide;
                } else {
                    state.isCreator = false;
                    state.playerSide = disputeData.opponentSide;
                    state.opponentSide = disputeData.creatorSide;
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
                
                // Отправляем сообщение в родительское окно Telegram
                if (window.Telegram && window.Telegram.WebApp) {
                    const connectData = {
                        type: 'connect_dispute_room',
                        disputeId: state.disputeId,
                        roomId: state.roomId,
                        isCreator: state.isCreator
                    };
                    
                    window.Telegram.WebApp.sendData(JSON.stringify(connectData));
                    app.log('Dispute', 'Отправлен запрос на подключение к комнате');
                } else {
                    // В демо-режиме симулируем подключение
                    app.log('Dispute', 'Демо-режим: симуляция подключения к комнате');
                    simulateRoomConnection();
                }
            } catch (error) {
                app.log('Dispute', `Ошибка подключения к комнате: ${error.message}`, true);
            }
        };
        
        /**
         * Симуляция подключения к комнате (для демо-режима)
         */
        const simulateRoomConnection = function() {
            setTimeout(() => {
                // Симулируем автоматическое подключение оппонента через 2 секунды
                updateOpponentStatus(!state.isCreator);
            }, 2000);
        };
        
        /**
         * Обработка сообщений от Telegram
         */
        const handleTelegramMessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                app.log('Dispute', `Получено сообщение: ${data.type}`);
                
                switch (data.type) {
                    case 'player_ready':
                        // Оппонент готов
                        if (data.isCreator !== state.isCreator) {
                            updateOpponentReadyStatus(true);
                            checkBothReady();
                        }
                        break;
                        
                    case 'player_joined':
                        // Оппонент присоединился к комнате
                        if (data.isCreator !== state.isCreator) {
                            updateOpponentStatus(true);
                        }
                        break;
                        
                    case 'coin_result':
                        // Получен результат подбрасывания монетки
                        if (data.disputeId === state.disputeId) {
                            handleCoinResult(data.result);
                        }
                        break;
                }
            } catch (error) {
                app.log('Dispute', `Ошибка обработки сообщения: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка результата подбрасывания монетки
         */
        const handleCoinResult = function(result) {
            state.result = result;
            flipCoinWithResult(result);
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
                
                // Инвертируем текущий статус
                state.playerReady = !state.playerReady;
                
                // Обновляем UI
                updatePlayerReadyStatus();
                
                // Отправляем сообщение об изменении статуса
                sendReadyStatus();
                
                // Проверяем, готовы ли оба игрока
                checkBothReady();
                
                app.log('Dispute', `Статус готовности игрока: ${state.playerReady}`);
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
                    app.log('Dispute', `Отправлен статус готовности: ${state.playerReady}`);
                } else {
                    // В демо-режиме симулируем ответ оппонента
                    app.log('Dispute', 'Демо-режим: симуляция ответа оппонента');
                    simulateOpponentReady();
                }
            } catch (error) {
                app.log('Dispute', `Ошибка отправки статуса готовности: ${error.message}`, true);
            }
        };
        
        /**
         * Симуляция готовности оппонента (для демо-режима)
         */
        const simulateOpponentReady = function() {
            setTimeout(() => {
                if (state.playerReady) {
                    // Если игрок готов, симулируем готовность оппонента
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
            if (state.playerReady && state.opponentReady && !state.bothReady) {
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
                
                // Начинаем подбрасывание монетки
                startCoinFlip();
                
                app.log('Dispute', 'Оба игрока готовы, начинаем подбрасывание');
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
                
                // Запрос к API для получения результата спора
                fetch('/api/disputes/result', {
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
                // Отправляем сообщение в Telegram
                if (window.Telegram && window.Telegram.WebApp) {
                    const resultData = {
                        type: 'coin_result',
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
         * Закрытие спора
         */
        const closeDispute = function() {
            app.log('Dispute', 'Закрытие спора');
            
            state.closed = true;
            
            // Закрываем мини-приложение
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.close();
            } else {
                // В демо-режиме просто перенаправляем на главную
                window.location.href = '/';
            }
        };
        
        // Публичный интерфейс
        return {
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
                if (!disputeGame.getStatus().initialized && !disputeGame.getStatus().initializationStarted) {
                    app.log('Dispute', 'Начало автоматической инициализации');
                    disputeGame.init();
                }
            }, 500);
        });
        
        // 5. Если DOM уже загружен, инициализируем сразу
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!disputeGame.getStatus().initialized && !disputeGame.getStatus().initializationStarted) {
                    app.log('Dispute', 'Начало автоматической инициализации (DOM уже загружен)');
                    disputeGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Dispute', `Ошибка регистрации игры: ${error.message}`, true);
    }
})();