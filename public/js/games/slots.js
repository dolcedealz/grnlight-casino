/**
 * slots.js - Премиум версия игры Slots
 * Версия 3.0.0
 * 
 * Особенности:
 * - Улучшенный дизайн и анимации
 * - Звуковые эффекты и визуальная обратная связь
 * - Система бонусов и мультипликаторов
 * - Прогрессивные джекпоты
 * - Комбо-система для последовательных выигрышей
 * - Автоспин и турбо-режим
 * - Мини-достижения и статистика
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
    app.log('Slots', 'Инициализация модуля игры Slots Premium v3.0.0');
    
    // Игровая логика в замыкании для изоляции
    const slotsGame = (function() {
        // === КОНФИГУРАЦИЯ ===
        const CONFIG = {
            // Визуальные настройки
            REEL_ANIMATION_DURATION: 2500,
            REEL_ANIMATION_DELAY: 200,
            SYMBOL_SIZE: 80,
            SYMBOL_MARGIN: 5,
            WINNING_ANIMATION_DURATION: 1000,
            ANTICIPATION_DURATION: 500,
            
            // Игровые настройки
            MIN_BET: 1,
            MAX_BET: 1000,
            DEFAULT_BET: 10,
            TURBO_MULTIPLIER: 0.5, // Скорость для турбо-режима
            MAX_AUTO_SPINS: 100,
            
            // Бонусные настройки
            SCATTER_BONUS_MULTIPLIER: 2,
            WILD_MULTIPLIER: 2,
            COMBO_MULTIPLIER_INCREASE: 0.25,
            MAX_COMBO_MULTIPLIER: 5,
            JACKPOT_INCREMENT: 0.01, // 1% от ставки идет в джекпот
            MEGA_WIN_THRESHOLD: 20, // x20 считается мега-выигрышем
            EPIC_WIN_THRESHOLD: 50, // x50 считается эпическим выигрышем
            
            // Звуковые настройки
            ENABLE_SOUNDS: true,
            SOUND_VOLUME: 0.3
        };
        
        // === ИГРОВЫЕ ЭЛЕМЕНТЫ ===
        let elements = {
            // Основные элементы
            spinBtn: null,
            slotsResult: null,
            slotsBet: null,
            slotsContainer: null,
            
            // Премиум элементы
            autoSpinBtn: null,
            turboModeBtn: null,
            betMaxBtn: null,
            betMinusBtn: null,
            betPlusBtn: null,
            soundToggleBtn: null,
            
            // Информационные элементы
            winDisplay: null,
            comboDisplay: null,
            jackpotDisplay: null,
            balanceDisplay: null,
            paylineDisplay: null,
            statsButton: null,
            statsModal: null
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
            
            // История игр
            lastResults: [],
            winningStreak: 0,
            losingStreak: 0
        };
        
        // === СИМВОЛЫ И ТАБЛИЦА ВЫПЛАТ ===
        const symbols = {
            standard: ['🍒', '🍋', '🍇', '🍊', '🍉', '💎', '7️⃣'],
            special: {
                wild: '🃏',      // Заменяет любой символ
                scatter: '⭐',   // Запускает бонусы
                bonus: '🎁',     // Бонусный символ
                jackpot: '👑'    // Джекпот символ
            }
        };
        
        const payTable = {
            // Стандартные символы
            '🍒': { value: 2, name: 'Вишня', color: '#FF0000' },
            '🍋': { value: 3, name: 'Лимон', color: '#FFD700' },
            '🍇': { value: 4, name: 'Виноград', color: '#800080' },
            '🍊': { value: 5, name: 'Апельсин', color: '#FFA500' },
            '🍉': { value: 6, name: 'Арбуз', color: '#00FF00' },
            '💎': { value: 8, name: 'Алмаз', color: '#00FFFF' },
            '7️⃣': { value: 10, name: 'Семерка', color: '#FF0000' },
            
            // Специальные символы
            '🃏': { value: 0, name: 'Wild', color: '#FF1493', special: 'wild' },
            '⭐': { value: 0, name: 'Scatter', color: '#FFD700', special: 'scatter' },
            '🎁': { value: 15, name: 'Бонус', color: '#32CD32', special: 'bonus' },
            '👑': { value: 0, name: 'Джекпот', color: '#FFD700', special: 'jackpot' }
        };
        
        // === ПРЕМИУМ ФУНКЦИИ ===
        
        /**
         * Создание улучшенного интерфейса
         */
        const createPremiumInterface = function() {
            if (!elements.slotsContainer) return;
            
            // Добавляем премиум контейнер
            const premiumContainer = document.createElement('div');
            premiumContainer.className = 'premium-slots-container';
            
            // Создаем верхнюю панель с информацией
            const topPanel = document.createElement('div');
            topPanel.className = 'slots-top-panel';
            topPanel.innerHTML = `
                <div class="jackpot-display">
                    <span class="jackpot-label">ДЖЕКПОТ</span>
                    <span id="jackpot-amount" class="jackpot-amount">${formatNumber(state.jackpotAmount)}</span>
                </div>
                <div class="combo-display">
                    <span class="combo-label">КОМБО</span>
                    <span id="combo-multiplier" class="combo-multiplier">x${state.comboMultiplier}</span>
                </div>
            `;
            
            // Создаем контейнер для барабанов с эффектами
            const reelsWrapper = document.createElement('div');
            reelsWrapper.className = 'reels-wrapper';
            
            // Добавляем декоративную рамку
            const reelsFrame = document.createElement('div');
            reelsFrame.className = 'reels-frame';
            reelsFrame.appendChild(elements.slotsContainer);
            reelsWrapper.appendChild(reelsFrame);
            
            // Создаем панель управления
            const controlPanel = document.createElement('div');
            controlPanel.className = 'slots-control-panel';
            controlPanel.innerHTML = `
                <div class="bet-controls">
                    <button id="bet-minus" class="bet-adjust-btn">-</button>
                    <div class="bet-display">
                        <span class="bet-label">СТАВКА</span>
                        <span id="current-bet">${state.currentBet}</span>
                    </div>
                    <button id="bet-plus" class="bet-adjust-btn">+</button>
                    <button id="bet-max" class="bet-max-btn">MAX</button>
                </div>
                
                <div class="spin-controls">
                    <button id="spin-btn" class="premium-spin-btn">
                        <span class="spin-text">SPIN</span>
                        <span class="spin-cost">${state.currentBet} ⭐</span>
                    </button>
                    <div class="advanced-controls">
                        <button id="auto-spin-btn" class="control-btn">AUTO</button>
                        <button id="turbo-mode-btn" class="control-btn">TURBO</button>
                        <button id="sound-toggle-btn" class="control-btn">${state.soundEnabled ? '🔊' : '🔇'}</button>
                    </div>
                </div>
                
                <div class="win-display">
                    <span class="win-label">ВЫИГРЫШ</span>
                    <span id="current-win" class="win-amount">0</span>
                </div>
            `;
            
            // Создаем панель с линиями выплат
            const paylinePanel = document.createElement('div');
            paylinePanel.className = 'payline-panel';
            paylinePanel.innerHTML = `
                <button id="stats-btn" class="stats-btn">📊 СТАТИСТИКА</button>
                <button id="paytable-btn" class="paytable-btn">💰 ТАБЛИЦА ВЫПЛАТ</button>
            `;
            
            // Собираем все элементы
            premiumContainer.appendChild(topPanel);
            premiumContainer.appendChild(reelsWrapper);
            premiumContainer.appendChild(controlPanel);
            premiumContainer.appendChild(paylinePanel);
            
            // Заменяем старый контейнер
            elements.slotsContainer.parentNode.replaceChild(premiumContainer, elements.slotsContainer);
            elements.slotsContainer = reelsFrame.querySelector('.slot-reels');
            
            // Создаем модальное окно для статистики
            createStatsModal();
            
            // Создаем таблицу выплат
            createPaytableModal();
            
            // Обновляем ссылки на элементы
            updateElementReferences();
            
            // Добавляем стили
            injectPremiumStyles();
        };
        
        /**
         * Создание модального окна статистики
         */
        const createStatsModal = function() {
            const modal = document.createElement('div');
            modal.className = 'slots-modal';
            modal.id = 'stats-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📊 Статистика игры</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">Всего вращений:</span>
                                <span class="stat-value" id="total-spins">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Всего выигрышей:</span>
                                <span class="stat-value" id="total-wins">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Самый большой выигрыш:</span>
                                <span class="stat-value" id="biggest-win">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Текущая серия:</span>
                                <span class="stat-value" id="current-streak">0</span>
                            </div>
                        </div>
                        <div class="recent-wins">
                            <h3>Последние выигрыши</h3>
                            <div id="recent-wins-list" class="recent-wins-list"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };
        
        /**
         * Создание таблицы выплат
         */
        const createPaytableModal = function() {
            const modal = document.createElement('div');
            modal.className = 'slots-modal';
            modal.id = 'paytable-modal';
            
            let symbolsHtml = '';
            for (const [symbol, data] of Object.entries(payTable)) {
                if (!data.special || data.special === 'bonus') {
                    symbolsHtml += `
                        <div class="paytable-item">
                            <span class="paytable-symbol">${symbol}</span>
                            <span class="paytable-name">${data.name}</span>
                            <span class="paytable-value">x${data.value}</span>
                        </div>
                    `;
                }
            }
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>💰 Таблица выплат</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="paytable-grid">
                            ${symbolsHtml}
                        </div>
                        <div class="special-symbols">
                            <h3>Специальные символы</h3>
                            <div class="special-symbol">
                                <span>${symbols.special.wild}</span>
                                <p>Wild - заменяет любой символ и удваивает выигрыш</p>
                            </div>
                            <div class="special-symbol">
                                <span>${symbols.special.scatter}</span>
                                <p>Scatter - 3+ символа дают бонусный множитель</p>
                            </div>
                            <div class="special-symbol">
                                <span>${symbols.special.jackpot}</span>
                                <p>Jackpot - 3 символа в линии дают джекпот!</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };
        
        /**
         * Обновление ссылок на элементы после создания премиум интерфейса
         */
        const updateElementReferences = function() {
            // Основные кнопки
            elements.spinBtn = document.getElementById('spin-btn');
            elements.autoSpinBtn = document.getElementById('auto-spin-btn');
            elements.turboModeBtn = document.getElementById('turbo-mode-btn');
            elements.soundToggleBtn = document.getElementById('sound-toggle-btn');
            
            // Кнопки ставок
            elements.betMinusBtn = document.getElementById('bet-minus');
            elements.betPlusBtn = document.getElementById('bet-plus');
            elements.betMaxBtn = document.getElementById('bet-max');
            
            // Дисплеи
            elements.winDisplay = document.getElementById('current-win');
            elements.comboDisplay = document.getElementById('combo-multiplier');
            elements.jackpotDisplay = document.getElementById('jackpot-amount');
            elements.betDisplay = document.getElementById('current-bet');
            
            // Модальные окна
            elements.statsButton = document.getElementById('stats-btn');
            elements.paytableButton = document.getElementById('paytable-btn');
            elements.statsModal = document.getElementById('stats-modal');
            elements.paytableModal = document.getElementById('paytable-modal');
        };
        
        /**
         * Инъекция премиум стилей
         */
        const injectPremiumStyles = function() {
            const styleId = 'slots-premium-styles';
            if (document.getElementById(styleId)) return;
            
            const styles = document.createElement('style');
            styles.id = styleId;
            styles.textContent = `
                /* Премиум контейнер */
                .premium-slots-container {
                    background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                    border-radius: 20px;
                    padding: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    position: relative;
                    overflow: hidden;
                }
                
                .premium-slots-container::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(0,168,107,0.1) 0%, transparent 70%);
                    animation: rotateGradient 10s linear infinite;
                }
                
                @keyframes rotateGradient {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* Верхняя панель */
                .slots-top-panel {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    position: relative;
                    z-index: 1;
                }
                
                .jackpot-display, .combo-display {
                    background: rgba(0, 0, 0, 0.5);
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: 1px solid var(--gold);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .jackpot-label, .combo-label {
                    font-size: 12px;
                    color: var(--gold);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                
                .jackpot-amount, .combo-multiplier {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--gold);
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                }
                
                /* Рамка барабанов */
                .reels-wrapper {
                    position: relative;
                    z-index: 1;
                    margin-bottom: 20px;
                }
                
                .reels-frame {
                    background: #000;
                    border: 3px solid var(--gold);
                    border-radius: 15px;
                    padding: 10px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 
                        inset 0 0 50px rgba(0, 0, 0, 0.5),
                        0 0 20px rgba(255, 215, 0, 0.3);
                }
                
                .reels-frame::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    animation: shimmer 3s infinite;
                }
                
                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                
                /* Панель управления */
                .slots-control-panel {
                    display: grid;
                    grid-template-columns: 1fr 2fr 1fr;
                    gap: 20px;
                    align-items: center;
                    position: relative;
                    z-index: 1;
                }
                
                .bet-controls {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .bet-adjust-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid var(--gold);
                    background: rgba(0, 0, 0, 0.7);
                    color: var(--gold);
                    font-size: 24px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .bet-adjust-btn:hover {
                    background: var(--gold);
                    color: #000;
                    transform: scale(1.1);
                }
                
                .bet-display {
                    text-align: center;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: 1px solid var(--gold);
                }
                
                .bet-label {
                    display: block;
                    font-size: 12px;
                    color: var(--gold);
                    text-transform: uppercase;
                }
                
                #current-bet {
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gold);
                }
                
                .bet-max-btn {
                    padding: 10px 15px;
                    background: linear-gradient(45deg, #FFD700, #FFA500);
                    border: none;
                    border-radius: 5px;
                    color: #000;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .bet-max-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);
                }
                
                /* Кнопка спина */
                .premium-spin-btn {
                    padding: 15px 30px;
                    background: linear-gradient(45deg, var(--primary-green), #00FF00);
                    border: none;
                    border-radius: 50px;
                    color: white;
                    font-size: 24px;
                    font-weight: bold;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s;
                    box-shadow: 0 5px 15px rgba(0, 168, 107, 0.4);
                }
                
                .premium-spin-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(0, 168, 107, 0.6);
                }
                
                .premium-spin-btn:active {
                    transform: translateY(0);
                }
                
                .premium-spin-btn::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
                    transform: rotate(45deg);
                    animation: spinBtnShine 3s infinite;
                }
                
                @keyframes spinBtnShine {
                    0% { left: -50%; }
                    100% { left: 150%; }
                }
                
                .spin-text {
                    display: block;
                    font-size: 20px;
                }
                
                .spin-cost {
                    display: block;
                    font-size: 14px;
                    opacity: 0.8;
                }
                
                /* Продвинутые контролы */
                .advanced-controls {
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                    justify-content: center;
                }
                
                .control-btn {
                    padding: 8px 15px;
                    background: rgba(0, 0, 0, 0.7);
                    border: 1px solid var(--gold);
                    border-radius: 5px;
                    color: var(--gold);
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .control-btn:hover {
                    background: var(--gold);
                    color: #000;
                }
                
                .control-btn.active {
                    background: var(--gold);
                    color: #000;
                    box-shadow: 0 0 10px var(--gold);
                }
                
                /* Дисплей выигрыша */
                .win-display {
                    text-align: center;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: 1px solid var(--gold);
                }
                
                .win-label {
                    display: block;
                    font-size: 12px;
                    color: var(--gold);
                    text-transform: uppercase;
                }
                
                .win-amount {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--gold);
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                }
                
                /* Анимация выигрыша */
                .win-amount.winning {
                    animation: winPulse 0.5s ease-in-out infinite;
                }
                
                @keyframes winPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); color: #FFD700; }
                    100% { transform: scale(1); }
                }
                
                /* Панель с кнопками информации */
                .payline-panel {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin-top: 20px;
                    position: relative;
                    z-index: 1;
                }
                
                .stats-btn, .paytable-btn {
                    padding: 10px 20px;
                    background: rgba(0, 0, 0, 0.7);
                    border: 1px solid var(--gold);
                    border-radius: 5px;
                    color: var(--gold);
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .stats-btn:hover, .paytable-btn:hover {
                    background: var(--gold);
                    color: #000;
                }
                
                /* Модальные окна */
                .slots-modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 1000;
                    justify-content: center;
                    align-items: center;
                }
                
                .slots-modal.active {
                    display: flex;
                }
                
                .modal-content {
                    background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                    border-radius: 15px;
                    padding: 20px;
                    max-width: 600px;
                    width: 90%;
                    border: 2px solid var(--gold);
                    position: relative;
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 1px solid var(--gold);
                    padding-bottom: 10px;
                }
                
                .modal-header h2 {
                    color: var(--gold);
                    margin: 0;
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    color: var(--gold);
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0 10px;
                }
                
                .modal-close:hover {
                    color: #fff;
                }
                
                /* Статистика */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .stat-item {
                    background: rgba(0, 0, 0, 0.5);
                    padding: 15px;
                    border-radius: 10px;
                    text-align: center;
                }
                
                .stat-label {
                    display: block;
                    font-size: 14px;
                    color: #888;
                    margin-bottom: 5px;
                }
                
                .stat-value {
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gold);
                }
                
                /* Таблица выплат */
                .paytable-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                
                .paytable-item {
                    display: flex;
                    align-items: center;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 10px;
                    border-radius: 5px;
                    gap: 10px;
                }
                
                .paytable-symbol {
                    font-size: 24px;
                }
                
                .paytable-name {
                    flex: 1;
                    color: #ccc;
                }
                
                .paytable-value {
                    color: var(--gold);
                    font-weight: bold;
                }
                
                .special-symbols {
                    margin-top: 20px;
                }
                
                .special-symbols h3 {
                    color: var(--gold);
                    margin-bottom: 15px;
                }
                
                .special-symbol {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 10px;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 5px;
                }
                
                .special-symbol span {
                    font-size: 24px;
                }
                
                .special-symbol p {
                    margin: 0;
                    color: #ccc;
                }
                
                /* Улучшенные барабаны */
                .reel {
                    background: linear-gradient(180deg, #111, #222);
                    border: 1px solid #333;
                    border-radius: 10px;
                    overflow: hidden;
                    position: relative;
                    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
                }
                
                .reel::before,
                .reel::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 30px;
                    pointer-events: none;
                    z-index: 2;
                }
                
                .reel::before {
                    top: 0;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
                }
                
                .reel::after {
                    bottom: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
                }
                
                .symbol {
                    font-size: 48px;
                    text-align: center;
                    padding: 10px;
                    user-select: none;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
                    transition: transform 0.3s;
                }
                
                .symbol.final {
                    animation: symbolLand 0.3s ease-out;
                }
                
                @keyframes symbolLand {
                    0% { transform: scale(1.2); }
                    50% { transform: scale(0.9); }
                    100% { transform: scale(1); }
                }
                
                .symbol.winning {
                    animation: symbolWin 0.5s ease-in-out infinite;
                    filter: drop-shadow(0 0 10px var(--gold));
                }
                
                @keyframes symbolWin {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
                
                /* Эффекты выигрыша */
                .mega-win-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%);
                    z-index: 999;
                    display: none;
                    justify-content: center;
                    align-items: center;
                    pointer-events: none;
                }
                
                .mega-win-overlay.active {
                    display: flex;
                    animation: megaWinFade 2s ease-out;
                }
                
                @keyframes megaWinFade {
                    0% { opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { opacity: 0; }
                }
                
                .mega-win-text {
                    font-size: 72px;
                    font-weight: bold;
                    color: var(--gold);
                    text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
                    animation: megaWinScale 1s ease-out;
                }
                
                @keyframes megaWinScale {
                    0% { transform: scale(0); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
                
                /* Линии выплат */
                .payline {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 10;
                }
                
                .payline-svg {
                    width: 100%;
                    height: 100%;
                }
                
                .payline-path {
                    fill: none;
                    stroke: var(--gold);
                    stroke-width: 4;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    filter: drop-shadow(0 0 8px var(--gold));
                    animation: paylineGlow 1s ease-in-out infinite;
                }
                
                @keyframes paylineGlow {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                
                /* Частицы и эффекты */
                .particle {
                    position: absolute;
                    pointer-events: none;
                    width: 10px;
                    height: 10px;
                    background: var(--gold);
                    border-radius: 50%;
                    opacity: 0;
                    animation: particle 1s ease-out forwards;
                }
                
                @keyframes particle {
                    0% {
                        transform: translate(0, 0) scale(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(var(--tx), var(--ty)) scale(1);
                        opacity: 0;
                    }
                }
                
                /* Адаптивность */
                @media (max-width: 768px) {
                    .slots-control-panel {
                        grid-template-columns: 1fr;
                        gap: 15px;
                    }
                    
                    .bet-controls {
                        justify-content: center;
                    }
                    
                    .win-display {
                        margin-top: 10px;
                    }
                    
                    .symbol {
                        font-size: 36px;
                    }
                }
            `;
            document.head.appendChild(styles);
        };
        
        // === ЗВУКОВЫЕ ЭФФЕКТЫ ===
        const sounds = {
            spin: null,
            win: null,
            bigWin: null,
            jackpot: null,
            click: null,
            coin: null,
            anticipation: null
        };
        
        /**
         * Инициализация звуков
         */
        const initSounds = function() {
            try {
                // Создаем аудио элементы
                sounds.spin = new Audio('data:audio/wav;base64,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');
                sounds.win = new Audio('data:audio/wav;base64,UklGRl9oAAAXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YW');
                
                // Настройка громкости
                Object.values(sounds).forEach(sound => {
                    if (sound) sound.volume = CONFIG.SOUND_VOLUME;
                });
            } catch (error) {
                app.log('Slots', `Ошибка инициализации звуков: ${error.message}`, true);
            }
        };
        
        /**
         * Воспроизведение звука
         */
        const playSound = function(soundName) {
            if (!state.soundEnabled || !sounds[soundName]) return;
            
            try {
                const sound = sounds[soundName];
                sound.currentTime = 0;
                sound.play().catch(err => {
                    app.log('Slots', `Ошибка воспроизведения звука ${soundName}: ${err.message}`, true);
                });
            } catch (error) {
                app.log('Slots', `Ошибка при попытке воспроизведения звука: ${error.message}`, true);
            }
        };
        
        // === АНИМАЦИИ И ЭФФЕКТЫ ===
        
        /**
         * Создание частиц для эффектов
         */
        const createParticles = function(x, y, count = 10) {
            const container = document.querySelector('.premium-slots-container');
            if (!container) return;
            
            for (let i = 0; i < count; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                const angle = (Math.PI * 2 * i) / count;
                const velocity = 50 + Math.random() * 50;
                
                particle.style.setProperty('--tx', `${Math.cos(angle) * velocity}px`);
                particle.style.setProperty('--ty', `${Math.sin(angle) * velocity}px`);
                particle.style.left = `${x}px`;
                particle.style.top = `${y}px`;
                
                container.appendChild(particle);
                
                // Удаляем частицу после анимации
                setTimeout(() => particle.remove(), 1000);
            }
        };
        
        /**
         * Анимация большого выигрыша
         */
        const showBigWinAnimation = function(amount, multiplier) {
            let overlay = document.querySelector('.mega-win-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'mega-win-overlay';
                document.body.appendChild(overlay);
            }
            
            let message = '';
            if (multiplier >= CONFIG.EPIC_WIN_THRESHOLD) {
                message = `EPIC WIN!<br>${amount} ⭐`;
                playSound('jackpot');
            } else if (multiplier >= CONFIG.MEGA_WIN_THRESHOLD) {
                message = `MEGA WIN!<br>${amount} ⭐`;
                playSound('bigWin');
            } else {
                message = `BIG WIN!<br>${amount} ⭐`;
                playSound('win');
            }
            
            overlay.innerHTML = `<div class="mega-win-text">${message}</div>`;
            overlay.classList.add('active');
            
            // Создаем множество частиц
            const rect = elements.slotsContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    createParticles(centerX, centerY, 20);
                }, i * 200);
            }
            
            setTimeout(() => {
                overlay.classList.remove('active');
            }, 2000);
        };
        
        /**
         * Анимация линий выплат
         */
        const animatePaylines = function(winLines) {
            // Удаляем старые линии
            const oldLines = document.querySelectorAll('.payline');
            oldLines.forEach(line => line.remove());
            
            winLines.forEach((line, index) => {
                setTimeout(() => {
                    drawPayline(line);
                }, index * 300);
            });
        };
        
        /**
         * Рисование линии выплаты
         */
        const drawPayline = function(winLine) {
            const container = elements.slotsContainer;
            if (!container) return;
            
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.classList.add('payline');
            svg.classList.add('payline-svg');
            
            const path = document.createElementNS(svgNS, "path");
            path.classList.add('payline-path');
            
            // Определяем координаты для линии
            const cells = [];
            if (winLine.type === 'horizontal') {
                for (let col = 0; col < 3; col++) {
                    cells.push({ row: winLine.row, col: col });
                }
            } else if (winLine.type === 'vertical') {
                for (let row = 0; row < 3; row++) {
                    cells.push({ row: row, col: winLine.col });
                }
            } else if (winLine.type === 'diagonal') {
                if (winLine.direction === 'main') {
                    cells.push({ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 });
                } else {
                    cells.push({ row: 2, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 2 });
                }
            }
            
            // Вычисляем путь
            const points = cells.map(cell => {
                const reel = document.querySelector(`.reel[data-row="${cell.row}"][data-col="${cell.col}"]`);
                if (!reel) return null;
                
                const rect = reel.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                return {
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top + rect.height / 2
                };
            }).filter(point => point !== null);
            
            if (points.length > 0) {
                let d = `M ${points[0].x} ${points[0].y}`;
                for (let i = 1; i < points.length; i++) {
                    d += ` L ${points[i].x} ${points[i].y}`;
                }
                
                path.setAttribute('d', d);
                svg.appendChild(path);
                container.appendChild(svg);
                
                // Удаляем линию через некоторое время
                setTimeout(() => svg.remove(), 3000);
            }
        };
        
        // === ИГРОВАЯ МЕХАНИКА ===
        
        /**
         * Улучшенная инициализация игры
         */
        const init = async function() {
            if (state.initialized || state.initializationStarted) {
                app.log('Slots', 'Инициализация уже выполнена или выполняется');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Slots', 'Начало инициализации премиум версии');
            
            try {
                // Базовая инициализация
                await findDOMElements();
                
                // Создаем премиум интерфейс
                createPremiumInterface();
                
                // Инициализируем звуки
                initSounds();
                
                // Настраиваем обработчики событий
                setupPremiumEventListeners();
                
                // Инициализируем матрицу
                createEnhancedSlotMatrix();
                
                // Загружаем сохраненное состояние
                loadGameState();
                
                // Обновляем отображение
                updateAllDisplays();
                
                state.initialized = true;
                app.log('Slots', 'Премиум инициализация успешно завершена');
                return true;
                
            } catch (error) {
                app.log('Slots', `Ошибка премиум инициализации: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Поиск DOM элементов
         */
        const findDOMElements = async function() {
            return new Promise((resolve) => {
                setTimeout(() => {
                    elements.slotsContainer = document.querySelector('.slot-reels');
                    
                    if (!elements.slotsContainer) {
                        // Создаем контейнер если его нет
                        const container = document.querySelector('.slots-container');
                        if (container) {
                            elements.slotsContainer = document.createElement('div');
                            elements.slotsContainer.className = 'slot-reels';
                            container.appendChild(elements.slotsContainer);
                        }
                    }
                    
                    resolve();
                }, 100);
            });
        };
        
        /**
         * Настройка премиум обработчиков событий
         */
        const setupPremiumEventListeners = function() {
            // Основная кнопка спина
            if (elements.spinBtn) {
                elements.spinBtn.addEventListener('click', enhancedSpin);
            }
            
            // Кнопки управления ставкой
            if (elements.betMinusBtn) {
                elements.betMinusBtn.addEventListener('click', () => adjustBet(-1));
            }
            
            if (elements.betPlusBtn) {
                elements.betPlusBtn.addEventListener('click', () => adjustBet(1));
            }
            
            if (elements.betMaxBtn) {
                elements.betMaxBtn.addEventListener('click', () => setBetMax());
            }
            
            // Дополнительные контролы
            if (elements.autoSpinBtn) {
                elements.autoSpinBtn.addEventListener('click', toggleAutoSpin);
            }
            
            if (elements.turboModeBtn) {
                elements.turboModeBtn.addEventListener('click', toggleTurboMode);
            }
            
            if (elements.soundToggleBtn) {
                elements.soundToggleBtn.addEventListener('click', toggleSound);
            }
            
            // Модальные окна
            if (elements.statsButton) {
                elements.statsButton.addEventListener('click', showStatsModal);
            }
            
            if (elements.paytableButton) {
                elements.paytableButton.addEventListener('click', showPaytableModal);
            }
            
            // Закрытие модальных окон
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modal = e.target.closest('.slots-modal');
                    if (modal) modal.classList.remove('active');
                });
            });
            
            // Клавиатурные сокращения
            document.addEventListener('keydown', handleKeyPress);
        };
        
        /**
         * Создание улучшенной матрицы слотов
         */
        const createEnhancedSlotMatrix = function() {
            if (!elements.slotsContainer) return;
            
            elements.slotsContainer.innerHTML = '';
            const reels = [];
            
            // Создаем 3x3 сетку
            for (let row = 0; row < 3; row++) {
                const rowElement = document.createElement('div');
                rowElement.className = 'slot-row';
                
                for (let col = 0; col < 3; col++) {
                    const reel = document.createElement('div');
                    reel.className = 'reel';
                    reel.dataset.row = row;
                    reel.dataset.col = col;
                    
                    // Создаем контейнер для символов
                    const reelStrip = document.createElement('div');
                    reelStrip.className = 'reel-strip';
                    
                    // Добавляем начальный символ
                    const symbol = document.createElement('div');
                    symbol.className = 'symbol';
                    symbol.textContent = getRandomSymbol();
                    reelStrip.appendChild(symbol);
                    
                    reel.appendChild(reelStrip);
                    rowElement.appendChild(reel);
                    reels.push(reelStrip);
                }
                
                elements.slotsContainer.appendChild(rowElement);
            }
            
            // Сохраняем ссылку на барабаны
            window.currentReels = reels;
        };
        
        /**
         * Обработка нажатий клавиш
         */
        const handleKeyPress = function(e) {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    if (!state.isSpinning) {
                        enhancedSpin();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    adjustBet(1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    adjustBet(-1);
                    break;
                case 'KeyA':
                    toggleAutoSpin();
                    break;
                case 'KeyT':
                    toggleTurboMode();
                    break;
                case 'KeyS':
                    toggleSound();
                    break;
            }
        };
        
        /**
         * Получение случайного символа (улучшенное)
         */
        const getRandomSymbol = function(includeSpecial = true) {
            // Проверяем, должны ли мы добавить специальный символ
            if (includeSpecial && Math.random() < 0.1) { // 10% шанс на спецсимвол
                const specialKeys = Object.keys(symbols.special);
                const randomSpecial = specialKeys[Math.floor(Math.random() * specialKeys.length)];
                return symbols.special[randomSpecial];
            }
            
            // Возвращаем обычный символ
            return symbols.standard[Math.floor(Math.random() * symbols.standard.length)];
        };
        
        /**
         * Улучшенный запуск вращения
         */
        const enhancedSpin = async function() {
            if (state.isSpinning) return;
            
            // Проверяем баланс
            if (window.GreenLightApp.user.balance < state.currentBet) {
                if (window.casinoApp) {
                    window.casinoApp.showNotification('Недостаточно средств для ставки');
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
            
            // Воспроизводим звук вращения
            playSound('spin');
            
            // Генерируем результат
            const result = generateSpinResult();
            
            // Анимируем барабаны
            await animateReels(result);
            
            // Проверяем выигрыш
            const winResult = checkEnhancedWin(result);
            
            // Обрабатываем результат
            await processSpinResult(winResult);
            
            state.isSpinning = false;
            
            // Обновляем UI
            if (elements.spinBtn) {
                elements.spinBtn.disabled = false;
                elements.spinBtn.querySelector('.spin-text').textContent = 'SPIN';
            }
            
            // Запуск автоспина, если активен
            if (state.autoSpinning && state.autoSpinsLeft > 0) {
                state.autoSpinsLeft--;
                if (state.autoSpinsLeft === 0) {
                    toggleAutoSpin();
                } else {
                    setTimeout(enhancedSpin, state.turboMode ? 500 : 1000);
                }
            }
        };
        
        /**
         * Генерация результата вращения
         */
        const generateSpinResult = function() {
            const matrix = [];
            
            // Генерируем матрицу 3x3
            for (let row = 0; row < 3; row++) {
                matrix[row] = [];
                for (let col = 0; col < 3; col++) {
                    matrix[row][col] = getRandomSymbol();
                }
            }
            
            // Иногда форсируем выигрышные комбинации
            if (Math.random() < 0.2) { // 20% шанс на выигрыш
                const winType = Math.random();
                
                if (winType < 0.5) {
                    // Горизонтальная линия
                    const row = Math.floor(Math.random() * 3);
                    const symbol = getRandomSymbol(false);
                    for (let col = 0; col < 3; col++) {
                        matrix[row][col] = symbol;
                    }
                } else if (winType < 0.8) {
                    // Вертикальная линия
                    const col = Math.floor(Math.random() * 3);
                    const symbol = getRandomSymbol(false);
                    for (let row = 0; row < 3; row++) {
                        matrix[row][col] = symbol;
                    }
                } else {
                    // Диагональ
                    const symbol = getRandomSymbol(false);
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
        const animateReels = async function(result) {
            const reels = window.currentReels || document.querySelectorAll('.reel-strip');
            const duration = state.turboMode ? CONFIG.REEL_ANIMATION_DURATION * CONFIG.TURBO_MULTIPLIER : CONFIG.REEL_ANIMATION_DURATION;
            const promises = [];
            
            reels.forEach((reel, index) => {
                const row = Math.floor(index / 3);
                const col = index % 3;
                const finalSymbol = result[row][col];
                
                promises.push(animateSingleReel(reel, finalSymbol, col * CONFIG.REEL_ANIMATION_DELAY));
            });
            
            await Promise.all(promises);
        };
        
        /**
         * Анимация одного барабана
         */
        const animateSingleReel = function(reel, finalSymbol, delay) {
            return new Promise((resolve) => {
                const duration = state.turboMode ? CONFIG.REEL_ANIMATION_DURATION * CONFIG.TURBO_MULTIPLIER : CONFIG.REEL_ANIMATION_DURATION;
                
                setTimeout(() => {
                    // Очищаем барабан
                    reel.innerHTML = '';
                    
                    // Создаем последовательность символов
                    const symbolCount = 20;
                    const symbols = [];
                    
                    for (let i = 0; i < symbolCount; i++) {
                        symbols.push(getRandomSymbol());
                    }
                    symbols.push(finalSymbol);
                    
                    // Добавляем символы на барабан
                    symbols.forEach(symbol => {
                        const symbolElement = document.createElement('div');
                        symbolElement.className = 'symbol';
                        symbolElement.textContent = symbol;
                        reel.appendChild(symbolElement);
                    });
                    
                    // Запускаем анимацию
                    const symbolHeight = CONFIG.SYMBOL_SIZE + CONFIG.SYMBOL_MARGIN * 2;
                    const totalHeight = symbolHeight * symbols.length;
                    
                    reel.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
                    reel.style.transform = `translateY(-${totalHeight - symbolHeight}px)`;
                    
                    // По окончании анимации оставляем только финальный символ
                    setTimeout(() => {
                        reel.style.transition = 'none';
                        reel.style.transform = 'translateY(0)';
                        reel.innerHTML = '';
                        
                        const finalSymbolElement = document.createElement('div');
                        finalSymbolElement.className = 'symbol final';
                        finalSymbolElement.textContent = finalSymbol;
                        reel.appendChild(finalSymbolElement);
                        
                        resolve();
                    }, duration);
                }, delay);
            });
        };
        
        /**
         * Улучшенная проверка выигрыша
         */
        const checkEnhancedWin = function(matrix) {
            const winLines = [];
            let totalMultiplier = 0;
            let hasWild = false;
            let scatterCount = 0;
            let jackpotCount = 0;
            
            // Подсчитываем специальные символы
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const symbol = matrix[row][col];
                    if (symbol === symbols.special.wild) hasWild = true;
                    if (symbol === symbols.special.scatter) scatterCount++;
                    if (symbol === symbols.special.jackpot) jackpotCount++;
                }
            }
            
            // Проверяем горизонтальные линии
            for (let row = 0; row < 3; row++) {
                const symbols = [matrix[row][0], matrix[row][1], matrix[row][2]];
                const winData = checkLine(symbols);
                
                if (winData) {
                    winLines.push({
                        type: 'horizontal',
                        row: row,
                        symbols: symbols,
                        multiplier: winData.multiplier
                    });
                    totalMultiplier += winData.multiplier;
                }
            }
            
            // Проверяем вертикальные линии
            for (let col = 0; col < 3; col++) {
                const symbols = [matrix[0][col], matrix[1][col], matrix[2][col]];
                const winData = checkLine(symbols);
                
                if (winData) {
                    winLines.push({
                        type: 'vertical',
                        col: col,
                        symbols: symbols,
                        multiplier: winData.multiplier
                    });
                    totalMultiplier += winData.multiplier;
                }
            }
            
            // Проверяем диагонали
            const mainDiagonal = [matrix[0][0], matrix[1][1], matrix[2][2]];
            const antiDiagonal = [matrix[2][0], matrix[1][1], matrix[0][2]];
            
            let winData = checkLine(mainDiagonal);
            if (winData) {
                winLines.push({
                    type: 'diagonal',
                    direction: 'main',
                    symbols: mainDiagonal,
                    multiplier: winData.multiplier
                });
                totalMultiplier += winData.multiplier;
            }
            
            winData = checkLine(antiDiagonal);
            if (winData) {
                winLines.push({
                    type: 'diagonal',
                    direction: 'anti',
                    symbols: antiDiagonal,
                    multiplier: winData.multiplier
                });
                totalMultiplier += winData.multiplier;
            }
            
            // Бонусы за специальные символы
            if (scatterCount >= 3) {
                totalMultiplier += CONFIG.SCATTER_BONUS_MULTIPLIER * scatterCount;
            }
            
            // Джекпот
            let isJackpot = false;
            if (jackpotCount === 3) {
                const jackpotLine = winLines.find(line => 
                    line.symbols.every(s => s === symbols.special.jackpot)
                );
                if (jackpotLine) {
                    isJackpot = true;
                }
            }
            
            // Применяем комбо множитель
            if (totalMultiplier > 0) {
                totalMultiplier *= state.comboMultiplier;
            }
            
            return {
                win: winLines.length > 0,
                winLines: winLines,
                totalMultiplier: totalMultiplier,
                isJackpot: isJackpot,
                scatterCount: scatterCount,
                hasWild: hasWild
            };
        };
        
        /**
         * Проверка линии на выигрыш
         */
        const checkLine = function(symbols) {
            // Проверяем, что все символы одинаковые (с учетом wild)
            let baseSymbol = null;
            let multiplier = 0;
            let hasWild = false;
            
            for (const symbol of symbols) {
                if (symbol === symbols.special.wild) {
                    hasWild = true;
                    continue;
                }
                
                if (baseSymbol === null) {
                    baseSymbol = symbol;
                } else if (symbol !== baseSymbol) {
                    return null; // Разные символы
                }
            }
            
            // Если все wild
            if (baseSymbol === null) {
                baseSymbol = symbols.special.wild;
            }
            
            // Получаем множитель
            const symbolData = payTable[baseSymbol];
            if (symbolData) {
                multiplier = symbolData.value || 1;
                
                // Удваиваем при наличии wild
                if (hasWild && baseSymbol !== symbols.special.wild) {
                    multiplier *= CONFIG.WILD_MULTIPLIER;
                }
            }
            
            return { symbol: baseSymbol, multiplier: multiplier };
        };
        
        /**
         * Обработка результата вращения
         */
        const processSpinResult = async function(result) {
            let winAmount = 0;
            
            if (result.win) {
                if (result.isJackpot) {
                    winAmount = state.jackpotAmount;
                    state.jackpotAmount = 10000; // Сброс джекпота
                    showBigWinAnimation(winAmount, 100);
                } else {
                    winAmount = Math.floor(state.currentBet * result.totalMultiplier);
                    
                    // Показываем анимацию большого выигрыша
                    if (result.totalMultiplier >= CONFIG.MEGA_WIN_THRESHOLD) {
                        showBigWinAnimation(winAmount, result.totalMultiplier);
                    } else {
                        playSound('win');
                    }
                }
                
                // Обновляем статистику
                state.totalWins++;
                state.winningStreak++;
                state.losingStreak = 0;
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
                
                // Анимируем линии выплат
                animatePaylines(result.winLines);
            } else {
                state.winningStreak = 0;
                state.losingStreak++;
                state.currentCombo = 0;
                state.comboMultiplier = 1;
            }
            
            // Обновляем джекпот
            state.jackpotAmount += Math.floor(state.currentBet * CONFIG.JACKPOT_INCREMENT);
            
            // Обновляем отображение
            updateAllDisplays();
            
            // Отправляем результат на сервер
            if (window.casinoApp) {
                await window.casinoApp.processGameResult(
                    'slots',
                    state.currentBet,
                    result.win ? 'win' : 'lose',
                    winAmount,
                    {
                        matrix: result.matrix,
                        winLines: result.winLines,
                        multiplier: result.totalMultiplier,
                        isJackpot: result.isJackpot
                    }
                );
            }
            
            // Сохраняем состояние игры
            saveGameState();
        };
        
        /**
         * Управление ставкой
         */
        const adjustBet = function(direction) {
            const bets = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
            const currentIndex = bets.indexOf(state.currentBet);
            const newIndex = currentIndex + direction;
            
            if (newIndex >= 0 && newIndex < bets.length) {
                state.currentBet = bets[newIndex];
                updateBetDisplay();
                playSound('click');
            }
        };
        
        const setBetMax = function() {
            state.currentBet = CONFIG.MAX_BET;
            updateBetDisplay();
            playSound('click');
        };
        
        /**
         * Переключение автоспина
         */
        const toggleAutoSpin = function() {
            state.autoSpinning = !state.autoSpinning;
            
            if (state.autoSpinning) {
                state.autoSpinsLeft = 50; // По умолчанию 50 спинов
                elements.autoSpinBtn.classList.add('active');
                if (!state.isSpinning) {
                    enhancedSpin();
                }
            } else {
                state.autoSpinsLeft = 0;
                elements.autoSpinBtn.classList.remove('active');
            }
            
            playSound('click');
        };
        
        /**
         * Переключение турбо-режима
         */
        const toggleTurboMode = function() {
            state.turboMode = !state.turboMode;
            
            if (state.turboMode) {
                elements.turboModeBtn.classList.add('active');
            } else {
                elements.turboModeBtn.classList.remove('active');
            }
            
            playSound('click');
        };
        
        /**
         * Переключение звука
         */
        const toggleSound = function() {
            state.soundEnabled = !state.soundEnabled;
            
            if (elements.soundToggleBtn) {
                elements.soundToggleBtn.textContent = state.soundEnabled ? '🔊' : '🔇';
            }
            
            playSound('click');
        };
        
        /**
         * Обновление всех дисплеев
         */
        const updateAllDisplays = function() {
            updateBetDisplay();
            updateWinDisplay();
            updateComboDisplay();
            updateJackpotDisplay();
            updateBalanceDisplay();
        };
        
        const updateBetDisplay = function() {
            if (elements.betDisplay) {
                elements.betDisplay.textContent = state.currentBet;
            }
            
            if (elements.spinBtn) {
                const costElement = elements.spinBtn.querySelector('.spin-cost');
                if (costElement) {
                    costElement.textContent = `${state.currentBet} ⭐`;
                }
            }
        };
        
        const updateWinDisplay = function() {
            if (elements.winDisplay) {
                elements.winDisplay.textContent = formatNumber(state.lastWinAmount || 0);
            }
        };
        
        const updateComboDisplay = function() {
            if (elements.comboDisplay) {
                elements.comboDisplay.textContent = `x${state.comboMultiplier.toFixed(2)}`;
            }
        };
        
        const updateJackpotDisplay = function() {
            if (elements.jackpotDisplay) {
                elements.jackpotDisplay.textContent = formatNumber(state.jackpotAmount);
            }
        };
        
        const updateBalanceDisplay = function() {
            const balanceElement = document.getElementById('balance-amount');
            if (balanceElement && window.GreenLightApp.user) {
                balanceElement.textContent = window.GreenLightApp.user.balance;
            }
        };
        
        /**
         * Показ модальных окон
         */
        const showStatsModal = function() {
            const modal = document.getElementById('stats-modal');
            if (!modal) return;
            
            // Обновляем статистику
            document.getElementById('total-spins').textContent = state.totalSpins;
            document.getElementById('total-wins').textContent = state.totalWins;
            document.getElementById('biggest-win').textContent = formatNumber(state.biggestWin);
            document.getElementById('current-streak').textContent = 
                state.winningStreak > 0 ? `Win streak: ${state.winningStreak}` : 
                state.losingStreak > 0 ? `Loss streak: ${state.losingStreak}` : 'None';
            
            modal.classList.add('active');
            playSound('click');
        };
        
        const showPaytableModal = function() {
            const modal = document.getElementById('paytable-modal');
            if (modal) {
                modal.classList.add('active');
                playSound('click');
            }
        };
        
        /**
         * Сохранение и загрузка состояния игры
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
        
        const loadGameState = function() {
            try {
                const savedState = localStorage.getItem('slotsGameState');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);
                    Object.assign(state, parsedState);
                }
            } catch (error) {
                app.log('Slots', `Ошибка загрузки состояния: ${error.message}`, true);
            }
        };
        
        /**
         * Утилиты
         */
        const formatNumber = function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        };
        
        // === ПУБЛИЧНЫЙ ИНТЕРФЕЙС ===
        return {
            init: init,
            spin: enhancedSpin,
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    isSpinning: state.isSpinning,
                    currentBet: state.currentBet,
                    jackpot: state.jackpotAmount,
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
    
    app.log('Slots', 'Премиум модуль успешно загружен');
  })();