/**
 * slots.js - Enhanced Slots Game with Premium Features
 * Version 3.1.0
 */

(function() {
    // Check for main app object
    if (!window.GreenLightApp) {
        console.error('[Slots] GreenLightApp not initialized!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Slots', 'Initializing Enhanced Slots Game v3.1.0');
    
    // Game logic in closure for isolation
    const slotsGame = (function() {
        // Configuration
        const CONFIG = {
            // Animation settings
            REEL_ANIMATION_DURATION: 2000,
            REEL_ANIMATION_DELAY: 200,
            WINNING_ANIMATION_DURATION: 1500,
            JACKPOT_ANIMATION_DURATION: 3000,
            
            // Game settings
            MIN_BET: 1,
            MAX_BET: 1000,
            DEFAULT_BET: 10,
            AUTO_SPIN_OPTIONS: [5, 10, 25, 50, 100],
            TURBO_SPEED_MULTIPLIER: 0.5,
            
            // Payouts and chances
            SYMBOL_WEIGHTS: {
                '🍒': 15,  // Cherry - common
                '🍋': 12,  // Lemon - common
                '🍇': 10,  // Grapes - uncommon
                '🍊': 10,  // Orange - uncommon
                '🍉': 8,   // Watermelon - uncommon
                '💎': 5,   // Diamond - rare
                '7️⃣': 3,   // Seven - very rare
                '🤑': 2,   // Money Face - very rare
                '🃏': 1,   // Wild - extremely rare
                '👑': 0.5  // Crown (jackpot) - extremely rare
            },
            
            PAYOUTS: {
                '🍒': 2,  // Cherry
                '🍋': 3,  // Lemon
                '🍇': 4,  // Grapes
                '🍊': 5,  // Orange
                '🍉': 6,  // Watermelon
                '💎': 10, // Diamond
                '7️⃣': 15, // Seven
                '🤑': 20, // Money Face
                '🃏': 25, // Wild (joker)
                '👑': 50  // Crown (jackpot)
            },
            
            // Special features
            NEW_PLAYER_BONUS_SPINS: 10,
            NEW_PLAYER_WIN_BOOST: 1.5, // 50% higher chance to win
            
            // Sound settings
            ENABLE_SOUNDS: true,
            DEFAULT_VOLUME: 0.5,
            SOUNDS: {
                SPIN: 'spin_sound',
                WIN: 'win_sound',
                BIG_WIN: 'big_win_sound',
                JACKPOT: 'jackpot_sound',
                BUTTON_CLICK: 'click_sound',
                BACKGROUND: 'background_music'
            }
        };
        
        // Game state
        let state = {
            initialized: false,
            initializationStarted: false,
            isSpinning: false,
            autoSpinning: false,
            autoSpinsLeft: 0,
            turboMode: false,
            soundEnabled: CONFIG.ENABLE_SOUNDS,
            musicPlaying: false,
            
            // Player data
            currentBet: CONFIG.DEFAULT_BET,
            isNewPlayer: true,
            spinsPlayed: 0,
            
            // Current game data
            matrix: [],
            winningLines: [],
            lastWin: 0,
            totalWin: 0
        };
        
        // DOM elements
        let elements = {
            container: null,
            reelsContainer: null,
            spinBtn: null,
            autoSpinBtn: null,
            turboBtn: null,
            soundBtn: null,
            betInput: null,
            betDecreaseBtn: null,
            betIncreaseBtn: null,
            resultDisplay: null,
            autoSpinMenu: null,
            autoSpinOptions: null,
            keyboardHideBtn: null
        };
        
        // Audio elements
        let sounds = {};
        
        // Initialize the game
        const init = async function() {
            // Prevent duplicate initialization
            if (state.initialized || state.initializationStarted) {
                app.log('Slots', 'Initialization already completed or in progress');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Slots', 'Beginning game initialization');
            
            try {
                // Initialize with timeout protection
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Find or create container
                        await findDOMElements();
                        
                        // Create UI
                        createInterface();
                        
                        // Create slot reels
                        createReels();
                        
                        // Load sounds
                        loadSounds();
                        
                        // Setup event listeners
                        setupEventListeners();
                        
                        state.initialized = true;
                        app.log('Slots', 'Initialization completed successfully');
                        resolve(true);
                    } catch (error) {
                        app.log('Slots', `Error during initialization: ${error.message}`, true);
                        resolve(false);
                    }
                });
                
                // Set timeout (3 seconds)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Slots', 'Initialization timeout', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Race to prevent hanging
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('Slots', `Critical initialization error: ${error.message}`, true);
                state.initializationStarted = false;
                return false;
            }
        };
        
        // Find DOM elements
        const findDOMElements = async function() {
            return new Promise((resolve, reject) => {
                try {
                    // Try to find existing container
                    setTimeout(() => {
                        elements.container = document.querySelector('.slots-container');
                        
                        if (!elements.container) {
                            // Try to find slots screen
                            const slotsScreen = document.getElementById('slots-screen');
                            if (slotsScreen) {
                                // Create container if not found
                                app.log('Slots', 'Creating new slots container');
                                elements.container = document.createElement('div');
                                elements.container.className = 'slots-container';
                                slotsScreen.appendChild(elements.container);
                            } else {
                                app.log('Slots', 'Slots screen not found, searching for main content', true);
                                // Try to find main content as fallback
                                const mainContent = document.querySelector('.main-content');
                                if (mainContent) {
                                    elements.container = document.createElement('div');
                                    elements.container.className = 'slots-container';
                                    mainContent.appendChild(elements.container);
                                }
                            }
                        }
                        
                        if (elements.container) {
                            app.log('Slots', 'Container found/created successfully');
                            resolve(true);
                        } else {
                            app.log('Slots', 'Could not find or create container', true);
                            reject(new Error('Container not found'));
                        }
                    }, 100);
                } catch (error) {
                    app.log('Slots', `Error finding DOM elements: ${error.message}`, true);
                    reject(error);
                }
            });
        };
        
        // Create user interface
        const createInterface = function() {
            try {
                if (!elements.container) {
                    app.log('Slots', 'Container not found, cannot create interface', true);
                    return false;
                }
                
                // Add CSS styles
                addStyles();
                
                // Clear container
                elements.container.innerHTML = '';
                
                // Create main structure
                elements.container.innerHTML = `
                    <div class="slots-premium">
                        <div class="slots-header">
                            <div class="jackpot-display">
                                <div class="jackpot-label">JACKPOT</div>
                                <div class="jackpot-amount">50,000</div>
                            </div>
                            <div class="win-display">
                                <div class="win-label">WIN</div>
                                <div class="win-amount">0</div>
                            </div>
                        </div>
                        
                        <div class="reels-container" id="reels-container">
                            <!-- Reels will be created dynamically -->
                        </div>
                        
                        <div class="slots-controls">
                            <div class="bet-controls">
                                <div class="compact-bet-input-wrapper">
                                    <button class="bet-btn decrease" id="bet-decrease">-</button>
                                    <div class="bet-input-container">
                                        <span class="bet-label">BET</span>
                                        <input type="number" class="bet-input" id="bet-input" min="${CONFIG.MIN_BET}" max="${CONFIG.MAX_BET}" value="${CONFIG.DEFAULT_BET}" pattern="[0-9]*" inputmode="numeric">
                                    </div>
                                    <button class="bet-btn increase" id="bet-increase">+</button>
                                    <button class="keyboard-hide-btn" id="keyboard-hide-btn">✓</button>
                                </div>
                                <div class="quick-bet-btns">
                                    <button class="quick-bet-btn" data-amount="10">10</button>
                                    <button class="quick-bet-btn" data-amount="20">20</button>
                                    <button class="quick-bet-btn" data-amount="50">50</button>
                                    <button class="quick-bet-btn" data-amount="100">100</button>
                                </div>
                            </div>
                            
                            <div class="action-controls">
                                <button class="spin-btn" id="spin-btn">
                                    <span class="spin-text">SPIN</span>
                                </button>
                                
                                <div class="secondary-controls">
                                    <button class="control-btn auto-spin" id="auto-spin-btn">
                                        <span class="btn-icon">🔄</span>
                                        <span class="btn-text">AUTO</span>
                                    </button>
                                    <button class="control-btn turbo" id="turbo-btn">
                                        <span class="btn-icon">⚡</span>
                                        <span class="btn-text">TURBO</span>
                                    </button>
                                    <button class="control-btn sound" id="sound-btn">
                                        <span class="btn-icon">🔊</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="auto-spin-menu hidden" id="auto-spin-menu">
                            <div class="menu-header">
                                <h3>Auto Spins</h3>
                                <button class="close-btn" id="close-auto-menu">×</button>
                            </div>
                            <div class="auto-spin-options" id="auto-spin-options">
                                ${CONFIG.AUTO_SPIN_OPTIONS.map(count => 
                                    `<button class="auto-spin-option" data-count="${count}">${count}</button>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                `;
                
                // Create separate result display element outside the main container
                const resultDisplay = document.createElement('div');
                resultDisplay.id = 'result-display';
                resultDisplay.className = 'result-display';
                document.body.appendChild(resultDisplay);
                
                // Get references to created elements
                elements.reelsContainer = document.getElementById('reels-container');
                elements.spinBtn = document.getElementById('spin-btn');
                elements.autoSpinBtn = document.getElementById('auto-spin-btn');
                elements.turboBtn = document.getElementById('turbo-btn');
                elements.soundBtn = document.getElementById('sound-btn');
                elements.betInput = document.getElementById('bet-input');
                elements.betDecreaseBtn = document.getElementById('bet-decrease');
                elements.betIncreaseBtn = document.getElementById('bet-increase');
                elements.resultDisplay = document.getElementById('result-display');
                elements.autoSpinMenu = document.getElementById('auto-spin-menu');
                elements.autoSpinOptions = document.getElementById('auto-spin-options');
                elements.closeAutoMenu = document.getElementById('close-auto-menu');
                elements.keyboardHideBtn = document.getElementById('keyboard-hide-btn');
                
                // Initialize potential win
                updatePotentialWin();
                
                app.log('Slots', 'Interface created successfully');
                return true;
            } catch (error) {
                app.log('Slots', `Error creating interface: ${error.message}`, true);
                return false;
            }
        };
        
        // Create reels for slot machine
        const createReels = function() {
            try {
                if (!elements.reelsContainer) {
                    app.log('Slots', 'Reels container not found', true);
                    return false;
                }
                
                elements.reelsContainer.innerHTML = '';
                
                // Create 3x3 grid of slots
                for (let row = 0; row < 3; row++) {
                    const rowEl = document.createElement('div');
                    rowEl.className = 'reel-row';
                    
                    for (let col = 0; col < 3; col++) {
                        const reel = document.createElement('div');
                        reel.className = 'reel';
                        reel.dataset.row = row;
                        reel.dataset.col = col;
                        
                        // Create reel strip (will hold symbols)
                        const reelStrip = document.createElement('div');
                        reelStrip.className = 'reel-strip';
                        
                        // Add initial symbol
                        const symbol = document.createElement('div');
                        symbol.className = 'symbol';
                        symbol.textContent = getRandomSymbol();
                        reelStrip.appendChild(symbol);
                        
                        reel.appendChild(reelStrip);
                        rowEl.appendChild(reel);
                    }
                    
                    elements.reelsContainer.appendChild(rowEl);
                }
                
                app.log('Slots', 'Reels created successfully');
                return true;
            } catch (error) {
                app.log('Slots', `Error creating reels: ${error.message}`, true);
                return false;
            }
        };
        
        // Load sound effects
        const loadSounds = function() {
            try {
                if (!CONFIG.ENABLE_SOUNDS) return true;
                
                // Create audio elements
                const soundEffects = {
                    [CONFIG.SOUNDS.SPIN]: {
                        src: 'https://assets.codepen.io/21542/Slot-machine-sound-effect.mp3',
                        loop: false
                    },
                    [CONFIG.SOUNDS.WIN]: {
                        src: 'https://assets.codepen.io/21542/slot-win.mp3',
                        loop: false
                    },
                    [CONFIG.SOUNDS.BIG_WIN]: {
                        src: 'https://assets.codepen.io/21542/big-win.mp3',
                        loop: false
                    },
                    [CONFIG.SOUNDS.JACKPOT]: {
                        src: 'https://assets.codepen.io/21542/jackpot.mp3',
                        loop: false
                    },
                    [CONFIG.SOUNDS.BUTTON_CLICK]: {
                        src: 'https://assets.codepen.io/21542/click.mp3',
                        loop: false
                    },
                    [CONFIG.SOUNDS.BACKGROUND]: {
                        src: 'https://assets.codepen.io/21542/casino-background.mp3',
                        loop: true
                    }
                };
                
                // Create and configure audio elements
                Object.entries(soundEffects).forEach(([key, sound]) => {
                    // Create audio element
                    const audio = new Audio();
                    audio.src = sound.src;
                    audio.volume = CONFIG.DEFAULT_VOLUME;
                    audio.loop = sound.loop;
                    audio.preload = 'auto';
                    
                    // Store in sounds object
                    sounds[key] = audio;
                });
                
                app.log('Slots', 'Sound effects loaded successfully');
                return true;
            } catch (error) {
                app.log('Slots', `Error loading sounds: ${error.message}`, true);
                state.soundEnabled = false;
                return false;
            }
        };
        
        // Setup event listeners
        const setupEventListeners = function() {
            try {
                // Spin button
                if (elements.spinBtn) {
                    elements.spinBtn.addEventListener('click', () => {
                        playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                        spin();
                    });
                }
                
                // Bet adjustment buttons
                if (elements.betDecreaseBtn) {
                    elements.betDecreaseBtn.addEventListener('click', () => {
                        playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                        adjustBet(-1);
                    });
                }
                
                if (elements.betIncreaseBtn) {
                    elements.betIncreaseBtn.addEventListener('click', () => {
                        playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                        adjustBet(1);
                    });
                }
                
                // Bet input field
                if (elements.betInput) {
                    elements.betInput.addEventListener('change', validateBetInput);
                    
                    // Фокус на поле ввода (для мобильных устройств)
                    elements.betInput.addEventListener('focus', function() {
                        // Добавляем класс для отображения кнопки скрытия клавиатуры
                        document.querySelector('.keyboard-hide-btn').classList.add('visible');
                    });
                    
                    // Блюр при нажатии Enter
                    elements.betInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') {
                            this.blur();
                        }
                    });
                }
                
                // Кнопка скрытия клавиатуры
                if (elements.keyboardHideBtn) {
                    elements.keyboardHideBtn.addEventListener('click', function() {
                        if (elements.betInput) {
                            elements.betInput.blur();
                        }
                        this.classList.remove('visible');
                    });
                }
                
                // Auto spin button
                if (elements.autoSpinBtn) {
                    elements.autoSpinBtn.addEventListener('click', () => {
                        playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                        toggleAutoSpinMenu();
                    });
                }
                
                // Close auto spin menu
                if (elements.closeAutoMenu) {
                    elements.closeAutoMenu.addEventListener('click', () => {
                        elements.autoSpinMenu.classList.add('hidden');
                    });
                }
                
                // Auto spin options
                if (elements.autoSpinOptions) {
                    const options = elements.autoSpinOptions.querySelectorAll('.auto-spin-option');
                    options.forEach(option => {
                        option.addEventListener('click', (e) => {
                            playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                            const count = parseInt(e.target.dataset.count);
                            startAutoSpin(count);
                        });
                    });
                }
                
                // Turbo mode button
                if (elements.turboBtn) {
                    elements.turboBtn.addEventListener('click', () => {
                        playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                        toggleTurboMode();
                    });
                }
                
                // Sound button
                if (elements.soundBtn) {
                    elements.soundBtn.addEventListener('click', () => {
                        toggleSound();
                    });
                }
                
                // Быстрые ставки
                const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
                quickBetBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        if (elements.betInput) {
                            const amount = parseInt(this.dataset.amount);
                            elements.betInput.value = amount;
                            validateBetInput();
                            playSound(CONFIG.SOUNDS.BUTTON_CLICK);
                        }
                    });
                });
                
                // Добавляем обработчик для клика по документу (скрытие клавиатуры)
                document.addEventListener('click', function(e) {
                    // Если клик не на элементе ввода и не на кнопках ставки
                    if (elements.betInput && 
                        e.target !== elements.betInput && 
                        !e.target.closest('.bet-controls')) {
                        elements.betInput.blur();
                        const keyboardHideBtn = document.querySelector('.keyboard-hide-btn');
                        if (keyboardHideBtn) {
                            keyboardHideBtn.classList.remove('visible');
                        }
                    }
                });
                
                app.log('Slots', 'Event listeners setup complete');
                return true;
            } catch (error) {
                app.log('Slots', `Error setting up event listeners: ${error.message}`, true);
                return false;
            }
        };
        
        // Main spin function
        const spin = async function() {
            // Check if already spinning
            if (state.isSpinning) return;
            
            // Check if initialized
            if (!state.initialized) {
                app.log('Slots', 'Game not initialized, initializing now');
                const initialized = await init();
                if (!initialized) {
                    app.log('Slots', 'Failed to initialize game', true);
                    return;
                }
            }
            
            // Get current bet
            const betAmount = state.currentBet;
            
            // Check if bet is valid
            if (isNaN(betAmount) || betAmount < CONFIG.MIN_BET || betAmount > CONFIG.MAX_BET) {
                app.log('Slots', 'Invalid bet amount', true);
                showNotification('Please enter a valid bet amount');
                return;
            }
            
            // Check if player has enough balance
            if (window.GreenLightApp.user && window.GreenLightApp.user.balance < betAmount) {
                app.log('Slots', 'Insufficient balance', true);
                showNotification('Insufficient balance');
                return;
            }
            
            try {
                // Update state
                state.isSpinning = true;
                state.spinsPlayed++;
                state.lastWin = 0;
                
                // Update UI
                updateUI('spinning');
                
                // Play spin sound
                playSound(CONFIG.SOUNDS.SPIN);
                
                // Generate result with weighted randomization
                const result = generateSpinResult();
                state.matrix = result.matrix;
                
                // Animate reels
                await animateReels(result.matrix);
                
                // Check for wins
                const winResult = checkWins(result.matrix);
                state.winningLines = winResult.winningLines;
                
                // Calculate total win
                let totalWin = 0;
                if (winResult.winningLines.length > 0) {
                    // Calculate win amount based on bet and win multiplier
                    totalWin = Math.floor(betAmount * winResult.totalMultiplier);
                    state.lastWin = totalWin;
                    state.totalWin += totalWin;
                }
                
                // If win, show animation and play sound
                if (totalWin > 0) {
                    // Different animations based on win size
                    if (winResult.isJackpot) {
                        showJackpotWin(totalWin);
                    } else if (winResult.totalMultiplier >= 15) {
                        showBigWin(totalWin);
                    } else {
                        showWin(totalWin);
                    }
                    
                    // Highlight winning lines
                    highlightWinningLines(winResult.winningLines);
                } else {
                    // Show "no win" message
                    showNoWin();
                }
                
                // Process the game result with the casino backend
                if (window.casinoApp && window.casinoApp.processGameResult) {
                    await window.casinoApp.processGameResult(
                        'slots',
                        betAmount,
                        totalWin > 0 ? 'win' : 'lose',
                        totalWin,
                        {
                            matrix: result.matrix,
                            winningLines: winResult.winningLines,
                            multiplier: winResult.totalMultiplier
                        }
                    );
                }
                
                // Check if player is no longer new
                if (state.isNewPlayer && state.spinsPlayed > CONFIG.NEW_PLAYER_BONUS_SPINS) {
                    state.isNewPlayer = false;
                }
                
                // Update UI
                updateUI('idle');
                
            } catch (error) {
                app.log('Slots', `Error during spin: ${error.message}`, true);
                updateUI('error');
            } finally {
                // Set spinning state to false
                state.isSpinning = false;
                
                // Continue auto-spinning if enabled
                if (state.autoSpinning && state.autoSpinsLeft > 0) {
                    state.autoSpinsLeft--;
                    
                    // Update auto spin display
                    elements.autoSpinBtn.querySelector('.btn-text').textContent = 
                        state.autoSpinsLeft > 0 ? state.autoSpinsLeft : 'AUTO';
                    
                    // If no more auto spins, disable auto spinning
                    if (state.autoSpinsLeft === 0) {
                        state.autoSpinning = false;
                        elements.autoSpinBtn.classList.remove('active');
                    } else {
                        // Wait before next spin
                        const delay = state.turboMode ? 300 : 1000;
                        setTimeout(() => spin(), delay);
                    }
                }
            }
        };
        
        // Generate spin result with weighted randomization
        const generateSpinResult = function() {
            // Create empty matrix
            const matrix = Array(3).fill().map(() => Array(3).fill(null));
            
            // For new players, increase chance of winning
            const isNewPlayerSpin = state.isNewPlayer && state.spinsPlayed <= CONFIG.NEW_PLAYER_BONUS_SPINS;
            const winChanceModifier = isNewPlayerSpin ? CONFIG.NEW_PLAYER_WIN_BOOST : 1;
            
            // Determine if this spin should be a win
            const shouldWin = Math.random() < (0.3 * winChanceModifier);
            
            if (shouldWin) {
                // Create a winning combination
                const winType = Math.random();
                const symbol = getWeightedRandomSymbol(false); // Get a random symbol, no jackpot
                
                if (winType < 0.5) {
                    // Horizontal line win - pick a random row
                    const row = Math.floor(Math.random() * 3);
                    for (let col = 0; col < 3; col++) {
                        matrix[row][col] = symbol;
                    }
                    
                    // Fill remaining positions with random symbols
                    for (let r = 0; r < 3; r++) {
                        if (r === row) continue;
                        for (let c = 0; c < 3; c++) {
                            matrix[r][c] = getWeightedRandomSymbol();
                        }
                    }
                } else if (winType < 0.8) {
                    // Vertical line win - pick a random column
                    const col = Math.floor(Math.random() * 3);
                    for (let row = 0; row < 3; row++) {
                        matrix[row][col] = symbol;
                    }
                    
                    // Fill remaining positions with random symbols
                    for (let r = 0; r < 3; r++) {
                        for (let c = 0; c < 3; c++) {
                            if (c === col) continue;
                            matrix[r][c] = getWeightedRandomSymbol();
                        }
                    }
                } else {
                    // Diagonal win
                    if (Math.random() < 0.5) {
                        // Main diagonal (top-left to bottom-right)
                        matrix[0][0] = symbol;
                        matrix[1][1] = symbol;
                        matrix[2][2] = symbol;
                    } else {
                        // Anti-diagonal (bottom-left to top-right)
                        matrix[2][0] = symbol;
                        matrix[1][1] = symbol;
                        matrix[0][2] = symbol;
                    }
                    
                    // Fill remaining positions with random symbols
                    for (let r = 0; r < 3; r++) {
                        for (let c = 0; c < 3; c++) {
                            if (matrix[r][c] === null) {
                                matrix[r][c] = getWeightedRandomSymbol();
                            }
                        }
                    }
                }
            } else {
                // No win - fill with random symbols ensuring no winning lines
                fillNoWinMatrix(matrix);
            }
            
            return { matrix };
        };
        
        // Fill matrix with random symbols ensuring no winning combinations
        const fillNoWinMatrix = function(matrix) {
            let attempts = 0;
            const maxAttempts = 50;
            
            // Keep generating matrices until we find one with no wins
            while (attempts < maxAttempts) {
                attempts++;
                
                // Fill matrix with random symbols
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 3; col++) {
                        matrix[row][col] = getWeightedRandomSymbol();
                    }
                }
                
                // Check if matrix has no winning lines
                const result = checkWins(matrix);
                if (result.winningLines.length === 0) {
                    return true;
                }
            }
            
            // If we reached max attempts, ensure no wins by breaking any found
            const result = checkWins(matrix);
            if (result.winningLines.length > 0) {
                // For each winning line, replace one symbol to break the line
                result.winningLines.forEach(line => {
                    if (line.type === 'horizontal') {
                        // Break horizontal line by changing middle symbol
                        let newSymbol;
                        do {
                            newSymbol = getWeightedRandomSymbol();
                        } while (newSymbol === matrix[line.row][0]);
                        matrix[line.row][1] = newSymbol;
                    } else if (line.type === 'vertical') {
                        // Break vertical line by changing middle symbol
                        let newSymbol;
                        do {
                            newSymbol = getWeightedRandomSymbol();
                        } while (newSymbol === matrix[0][line.col]);
                        matrix[1][line.col] = newSymbol;
                    } else if (line.type === 'diagonal') {
                        // Break diagonal by changing middle symbol
                        let newSymbol;
                        do {
                            newSymbol = getWeightedRandomSymbol();
                        } while (newSymbol === matrix[0][0] || newSymbol === matrix[2][2]);
                        matrix[1][1] = newSymbol;
                    }
                });
            }
            
            return true;
        };
        
        // Get random symbol based on weights
        const getWeightedRandomSymbol = function(includeJackpot = true) {
            // Calculate total weight
            const weights = CONFIG.SYMBOL_WEIGHTS;
            let totalWeight = 0;
            
            // If jackpot should be excluded, skip it in the calculation
            Object.entries(weights).forEach(([symbol, weight]) => {
                if (includeJackpot || symbol !== '👑') {
                    totalWeight += weight;
                }
            });
            
            // Generate a random number between 0 and totalWeight
            let random = Math.random() * totalWeight;
            
            // Find symbol based on weight
            for (const [symbol, weight] of Object.entries(weights)) {
                if (!includeJackpot && symbol === '👑') continue;
                
                random -= weight;
                if (random <= 0) {
                    return symbol;
                }
            }
            
            // Fallback to first symbol
            return Object.keys(weights)[0];
        };
        
        // Get a truly random symbol (equal distribution)
        const getRandomSymbol = function() {
            const symbols = Object.keys(CONFIG.SYMBOL_WEIGHTS);
            const index = Math.floor(Math.random() * symbols.length);
            return symbols[index];
        };
        
        // Animate reels with spinning effect
        const animateReels = async function(matrix) {
            // Get all reel strip elements
            const reelElements = document.querySelectorAll('.reel-strip');
            if (reelElements.length < 9) {
                app.log('Slots', 'Not enough reel elements found', true);
                return Promise.reject(new Error('Reel elements not found'));
            }
            
            // Calculate animation duration based on turbo mode
            const duration = state.turboMode ? 
                CONFIG.REEL_ANIMATION_DURATION * CONFIG.TURBO_SPEED_MULTIPLIER :
                CONFIG.REEL_ANIMATION_DURATION;
            
            // Create animation promises for each reel
            const promises = [];
            reelElements.forEach((reel, index) => {
                // Calculate matrix position
                const row = Math.floor(index / 3);
                const col = index % 3;
                
                // Get final symbol for this position
                const finalSymbol = matrix[row][col];
                
                // Add delay based on position (column)
                const delay = col * CONFIG.REEL_ANIMATION_DELAY;
                
                // Add to promises
                promises.push(animateReel(reel, finalSymbol, delay, duration));
            });
            
            // Wait for all animations to finish
            return Promise.all(promises);
        };
        
        // Animate a single reel
        const animateReel = function(reelElement, finalSymbol, delay, duration) {
            return new Promise(resolve => {
                setTimeout(() => {
                    try {
                        // Save parent reel reference and dimensions
                        const parentReel = reelElement.parentElement;
                        const reelHeight = parentReel.offsetHeight;
                        
                        // Set fixed height to prevent layout shifts
                        parentReel.style.height = `${reelHeight}px`;
                        
                        // Clear existing content
                        reelElement.innerHTML = '';
                        
                        // Create random symbols for animation (reduced count)
                        const symbolCount = 15;
                        
                        // Use document fragment for better performance
                        const fragment = document.createDocumentFragment();
                        
                        // Add symbols for animation
                        for (let i = 0; i < symbolCount; i++) {
                            const symbolEl = document.createElement('div');
                            symbolEl.className = 'symbol';
                            symbolEl.textContent = getRandomSymbol();
                            fragment.appendChild(symbolEl);
                        }
                        
                        // Add final symbol at the end
                        const finalSymbolEl = document.createElement('div');
                        finalSymbolEl.className = 'symbol final';
                        finalSymbolEl.textContent = finalSymbol;
                        fragment.appendChild(finalSymbolEl);
                        
                        // Append all at once
                        reelElement.appendChild(fragment);
                        
                        // Set symbol height
                        const symbolHeight = 80;
                        
                        // Reset transform before animation
                        reelElement.style.transition = 'none';
                        reelElement.style.transform = 'translateY(0)';
                        
                        // Force reflow
                        void reelElement.offsetWidth;
                        
                        // Start animation
                        reelElement.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
                        reelElement.style.transform = `translateY(-${symbolCount * symbolHeight}px)`;
                        
                        // After animation completes
                        setTimeout(() => {
                            // Reset position and show only final symbol
                            reelElement.style.transition = 'none';
                            reelElement.style.transform = 'translateY(0)';
                            reelElement.innerHTML = '';
                            
                            // Add only the final symbol
                            const symbolEl = document.createElement('div');
                            symbolEl.className = 'symbol';
                            symbolEl.textContent = finalSymbol;
                            reelElement.appendChild(symbolEl);
                            
                            // Add data attribute for symbol type
                            parentReel.dataset.symbol = finalSymbol;
                            
                            // Remove fixed height after animation
                            setTimeout(() => {
                                parentReel.style.height = '';
                            }, 50);
                            
                            // Resolve promise
                            resolve();
                        }, duration + 50);
                    } catch (error) {
                        app.log('Slots', `Error animating reel: ${error.message}`, true);
                        resolve(); // Resolve anyway to prevent hanging
                    }
                }, delay);
            });
        };
        
        // Check for winning combinations
        const checkWins = function(matrix) {
            const winningLines = [];
            let totalMultiplier = 0;
            let isJackpot = false;
            
            // Check for horizontal wins
            for (let row = 0; row < 3; row++) {
                if (matrix[row][0] === matrix[row][1] && matrix[row][1] === matrix[row][2]) {
                    const symbol = matrix[row][0];
                    const multiplier = CONFIG.PAYOUTS[symbol] || 1;
                    
                    winningLines.push({
                        type: 'horizontal', 
                        row: row,
                        symbol: symbol,
                        multiplier: multiplier
                    });
                    
                    totalMultiplier += multiplier;
                    
                    // Check for jackpot
                    if (symbol === '👑') {
                        isJackpot = true;
                    }
                }
            }
            
            // Check for vertical wins
            for (let col = 0; col < 3; col++) {
                if (matrix[0][col] === matrix[1][col] && matrix[1][col] === matrix[2][col]) {
                    const symbol = matrix[0][col];
                    const multiplier = CONFIG.PAYOUTS[symbol] || 1;
                    
                    winningLines.push({
                        type: 'vertical',
                        col: col,
                        symbol: symbol,
                        multiplier: multiplier
                    });
                    
                    totalMultiplier += multiplier;
                    
                    // Check for jackpot
                    if (symbol === '👑') {
                        isJackpot = true;
                    }
                }
            }
            
            // Check for diagonal wins - main diagonal (top-left to bottom-right)
            if (matrix[0][0] === matrix[1][1] && matrix[1][1] === matrix[2][2]) {
                const symbol = matrix[0][0];
                const multiplier = CONFIG.PAYOUTS[symbol] || 1;
                
                winningLines.push({
                    type: 'diagonal',
                    direction: 'main',
                    symbol: symbol,
                    multiplier: multiplier
                });
                
                totalMultiplier += multiplier;
                
                // Check for jackpot
                if (symbol === '👑') {
                    isJackpot = true;
                }
            }
            
            // Check for diagonal wins - secondary diagonal (bottom-left to top-right)
            if (matrix[2][0] === matrix[1][1] && matrix[1][1] === matrix[0][2]) {
                const symbol = matrix[2][0];
                const multiplier = CONFIG.PAYOUTS[symbol] || 1;
                
                winningLines.push({
                    type: 'diagonal',
                    direction: 'secondary',
                    symbol: symbol,
                    multiplier: multiplier
                });
                
                totalMultiplier += multiplier;
                
                // Check for jackpot
                if (symbol === '👑') {
                    isJackpot = true;
                }
            }
            
            return {
                winningLines: winningLines,
                totalMultiplier: totalMultiplier,
                isJackpot: isJackpot
            };
        };
        
        // Highlight winning lines
        const highlightWinningLines = function(winningLines) {
            // Remove previous highlights
            document.querySelectorAll('.symbol.highlight').forEach(symbol => {
                symbol.classList.remove('highlight');
            });
            
            // Add highlights to winning lines
            winningLines.forEach(line => {
                switch (line.type) {
                    case 'horizontal':
                        for (let col = 0; col < 3; col++) {
                            highlightSymbol(line.row, col);
                        }
                        break;
                        
                    case 'vertical':
                        for (let row = 0; row < 3; row++) {
                            highlightSymbol(row, line.col);
                        }
                        break;
                        
                    case 'diagonal':
                        if (line.direction === 'main') {
                            // Top-left to bottom-right
                            for (let i = 0; i < 3; i++) {
                                highlightSymbol(i, i);
                            }
                        } else {
                            // Bottom-left to top-right
                            for (let i = 0; i < 3; i++) {
                                highlightSymbol(2 - i, i);
                            }
                        }
                        break;
                }
            });
        };
        
        // Add highlight class to symbol at specified position
        const highlightSymbol = function(row, col) {
            const reel = document.querySelector(`.reel[data-row="${row}"][data-col="${col}"]`);
            if (reel) {
                const symbol = reel.querySelector('.symbol');
                if (symbol) {
                    symbol.classList.add('highlight');
                }
            }
        };
        
        // Show win display
        const showWin = function(amount) {
            // Update win display
            const winDisplay = document.querySelector('.win-amount');
            if (winDisplay) {
                winDisplay.textContent = amount;
                winDisplay.classList.add('win-animate');
                setTimeout(() => winDisplay.classList.remove('win-animate'), 2000);
            }
            
            // Show result display
            if (elements.resultDisplay) {
                elements.resultDisplay.innerHTML = `
                    <div class="win-message">
                        <div class="win-icon">🎉</div>
                        <div class="win-text">WIN!</div>
                        <div class="win-amount">${amount}</div>
                    </div>
                `;
                elements.resultDisplay.className = 'result-display win-result';
                
                // Add animation
                elements.resultDisplay.style.animation = 'none';
                setTimeout(() => {
                    elements.resultDisplay.style.animation = 'winPulse 1s ease-in-out infinite';
                }, 10);
            }
            
            // Play win sound
            playSound(CONFIG.SOUNDS.WIN);
        };
        
        // Show big win display with special effects
        const showBigWin = function(amount) {
            // Update win display
            const winDisplay = document.querySelector('.win-amount');
            if (winDisplay) {
                winDisplay.textContent = amount;
                winDisplay.classList.add('big-win-animate');
                setTimeout(() => winDisplay.classList.remove('big-win-animate'), 3000);
            }
            
            // Show result display with big win animation
            if (elements.resultDisplay) {
                elements.resultDisplay.innerHTML = `
                    <div class="big-win-message">
                        <div class="win-icon">💰</div>
                        <div class="big-win-text">BIG WIN!</div>
                        <div class="big-win-amount">${amount}</div>
                    </div>
                `;
                elements.resultDisplay.className = 'result-display big-win-result';
                
                // Add animation
                elements.resultDisplay.style.animation = 'none';
                setTimeout(() => {
                    elements.resultDisplay.style.animation = 'bigWinPulse 1.5s ease-in-out infinite';
                }, 10);
                
                // Add particle effects
                createWinParticles(elements.resultDisplay, 50);
            }
            
            // Play big win sound
            playSound(CONFIG.SOUNDS.BIG_WIN);
        };
        
        // Show jackpot win display with epic effects
        const showJackpotWin = function(amount) {
            // Update win display
            const winDisplay = document.querySelector('.win-amount');
            if (winDisplay) {
                winDisplay.textContent = amount;
                winDisplay.classList.add('jackpot-win-animate');
                setTimeout(() => winDisplay.classList.remove('jackpot-win-animate'), 4000);
            }
            
            // Show result display with jackpot animation
            if (elements.resultDisplay) {
                elements.resultDisplay.innerHTML = `
                    <div class="jackpot-win-message">
                        <div class="win-icon">👑</div>
                        <div class="jackpot-win-text">JACKPOT!</div>
                        <div class="jackpot-win-amount">${amount}</div>
                    </div>
                `;
                elements.resultDisplay.className = 'result-display jackpot-win-result';
                
                // Add animation
                elements.resultDisplay.style.animation = 'none';
                setTimeout(() => {
                    elements.resultDisplay.style.animation = 'jackpotWinPulse 2s ease-in-out infinite';
                }, 10);
                
                // Add particle effects
                createWinParticles(elements.resultDisplay, 100);
            }
            
            // Play jackpot sound
            playSound(CONFIG.SOUNDS.JACKPOT);
        };
        
        // Show no win display
        const showNoWin = function() {
            // Reset win display
            const winDisplay = document.querySelector('.win-amount');
            if (winDisplay) {
                winDisplay.textContent = '0';
            }
            
            // Show result display
            if (elements.resultDisplay) {
                elements.resultDisplay.innerHTML = '';
                elements.resultDisplay.className = 'result-display';
            }
        };
        
        // Create particle effects for big wins
        const createWinParticles = function(container, count) {
            if (!container) return;
            
            // Clear existing particles
            const existingParticles = container.querySelectorAll('.win-particle');
            existingParticles.forEach(p => p.remove());
            
            // Create particles
            for (let i = 0; i < count; i++) {
                const particle = document.createElement('div');
                particle.className = 'win-particle';
                
                // Random position
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                
                // Random size
                const size = 5 + Math.random() * 15;
                
                // Random animation delay
                const delay = Math.random() * 2;
                
                // Random color
                const colors = ['#FFD700', '#00A86B', '#FF5722', '#2196F3', '#9C27B0'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                // Apply styles
                particle.style.left = `${left}%`;
                particle.style.top = `${top}%`;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.backgroundColor = color;
                particle.style.animationDelay = `${delay}s`;
                
                // Add to container
                container.appendChild(particle);
                
                // Remove after animation
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 3000);
            }
        };
        
        // Adjust bet amount
        const adjustBet = function(change) {
            // Common bet values
            const commonBets = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
            
            if (change < 0) {
                // Decrease bet
                let newBet = state.currentBet;
                
                // Find the next lower common bet
                for (let i = commonBets.length - 1; i >= 0; i--) {
                    if (commonBets[i] < state.currentBet) {
                        newBet = commonBets[i];
                        break;
                    }
                }
                
                // Ensure minimum bet
                state.currentBet = Math.max(CONFIG.MIN_BET, newBet);
            } else {
                // Increase bet
                let newBet = state.currentBet;
                
                // Find the next higher common bet
                for (let i = 0; i < commonBets.length; i++) {
                    if (commonBets[i] > state.currentBet) {
                        newBet = commonBets[i];
                        break;
                    }
                }
                
                // Ensure maximum bet
                state.currentBet = Math.min(CONFIG.MAX_BET, newBet);
            }
            
            // Update bet input
            if (elements.betInput) {
                elements.betInput.value = state.currentBet;
            }
        };
        
        // Validate bet input
        const validateBetInput = function() {
            if (!elements.betInput) return;
            
            // Get input value
            let value = parseInt(elements.betInput.value);
            
            // Check if valid number
            if (isNaN(value)) {
                value = CONFIG.DEFAULT_BET;
            }
            
            // Clamp within valid range
            value = Math.min(CONFIG.MAX_BET, Math.max(CONFIG.MIN_BET, value));
            
            // Update state and input
            state.currentBet = value;
            elements.betInput.value = value;
        };
        
        // Toggle turbo mode
        const toggleTurboMode = function() {
            state.turboMode = !state.turboMode;
            
            // Update UI
            if (elements.turboBtn) {
                elements.turboBtn.classList.toggle('active', state.turboMode);
            }
        };
        
        // Toggle sound
        const toggleSound = function() {
            state.soundEnabled = !state.soundEnabled;
            
            // Update UI
            if (elements.soundBtn) {
                const icon = elements.soundBtn.querySelector('.btn-icon');
                if (icon) {
                    icon.textContent = state.soundEnabled ? '🔊' : '🔇';
                }
                elements.soundBtn.classList.toggle('active', state.soundEnabled);
            }
            
            // Mute/unmute all sounds
            Object.values(sounds).forEach(sound => {
                sound.muted = !state.soundEnabled;
            });
            
            // Play click sound
            if (state.soundEnabled) {
                playSound(CONFIG.SOUNDS.BUTTON_CLICK);
            }
        };
        
        // Toggle auto spin menu
        const toggleAutoSpinMenu = function() {
            if (!elements.autoSpinMenu) return;
            
            if (state.autoSpinning) {
                // Stop auto spin if already running
                state.autoSpinning = false;
                state.autoSpinsLeft = 0;
                elements.autoSpinBtn.classList.remove('active');
                elements.autoSpinBtn.querySelector('.btn-text').textContent = 'AUTO';
            } else {
                // Show/hide auto spin menu
                elements.autoSpinMenu.classList.toggle('hidden');
            }
        };
        
        // Start auto spinning
        const startAutoSpin = function(count) {
            // Set auto spin state
            state.autoSpinning = true;
            state.autoSpinsLeft = count;
            
            // Update UI
            elements.autoSpinBtn.classList.add('active');
            elements.autoSpinBtn.querySelector('.btn-text').textContent = count;
            
            // Hide menu
            elements.autoSpinMenu.classList.add('hidden');
            
            // Start spinning if not already spinning
            if (!state.isSpinning) {
                spin();
            }
        };
        
        // Play sound effect
        const playSound = function(soundName) {
            if (!state.soundEnabled) return;
            
            try {
                const sound = sounds[soundName];
                if (sound) {
                    // Reset sound to start
                    sound.pause();
                    sound.currentTime = 0;
                    
                    // Play sound
                    sound.play().catch(err => {
                        // Ignore autoplay errors
                        app.log('Slots', `Sound play error: ${err.message}`, true);
                    });
                }
            } catch (error) {
                app.log('Slots', `Error playing sound: ${error.message}`, true);
            }
        };
        
        // Update UI based on state
        const updateUI = function(state) {
            switch (state) {
                case 'spinning':
                    // Disable controls
                    if (elements.spinBtn) {
                        elements.spinBtn.disabled = true;
                        elements.spinBtn.querySelector('.spin-text').textContent = 'SPINNING...';
                    }
                    if (elements.betInput) {
                        elements.betInput.disabled = true;
                    }
                    if (elements.betDecreaseBtn) {
                        elements.betDecreaseBtn.disabled = true;
                    }
                    if (elements.betIncreaseBtn) {
                        elements.betIncreaseBtn.disabled = true;
                    }
                    
                    // Clear result display
                    if (elements.resultDisplay) {
                        elements.resultDisplay.innerHTML = '';
                        elements.resultDisplay.className = 'result-display';
                    }
                    break;
                    
                case 'idle':
                    // Enable controls
                    if (elements.spinBtn) {
                        elements.spinBtn.disabled = false;
                        elements.spinBtn.querySelector('.spin-text').textContent = 'SPIN';
                    }
                    if (elements.betInput) {
                        elements.betInput.disabled = false;
                    }
                    if (elements.betDecreaseBtn) {
                        elements.betDecreaseBtn.disabled = false;
                    }
                    if (elements.betIncreaseBtn) {
                        elements.betIncreaseBtn.disabled = false;
                    }
                    break;
                    
                case 'error':
                    // Reset to idle state
                    updateUI('idle');
                    
                    // Show error message
                    showNotification('An error occurred. Please try again.');
                    break;
            }
        };
        
        // Show notification message
        const showNotification = function(message) {
            if (window.casinoApp && window.casinoApp.showNotification) {
                window.casinoApp.showNotification(message);
                return;
            }
            
            // Fallback notification if casinoApp not available
            const notification = document.createElement('div');
            notification.className = 'slots-notification';
            notification.textContent = message;
            
            // Add to container
            if (elements.container) {
                elements.container.appendChild(notification);
                
                // Auto-remove after delay
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 3000);
            }
        };
        
        // Calculate potential win based on current bet
        const updatePotentialWin = function() {
            // In a real implementation, this would calculate potential winnings
            // based on paytable and current bet
        };
        
        // Add CSS styles
        const addStyles = function() {
            // Create style element if not exists
            if (!document.getElementById('enhanced-slots-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'enhanced-slots-styles';
                
                // Add CSS rules
                styleEl.textContent = `
                    /* Основной контейнер */
                    .slots-premium {
                        background: linear-gradient(to bottom, #1a2a3a, #0a1520);
                        padding: 20px;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                        color: white;
                        max-width: 600px;
                        margin: 0 auto;
                        position: relative;
                        overflow: hidden;
                        box-sizing: border-box;
                    }
                    
                    /* Header with jackpot and win display */
                    .slots-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        gap: 20px;
                    }
                    
                    .jackpot-display, .win-display {
                        flex: 1;
                        background: rgba(0, 0, 0, 0.5);
                        padding: 10px;
                        border-radius: 8px;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                        border: 1px solid rgba(255, 215, 0, 0.3);
                    }
                    
                    .jackpot-label, .win-label {
                        font-size: 12px;
                        text-transform: uppercase;
                        opacity: 0.7;
                        margin-bottom: 5px;
                    }
                    
                    .jackpot-amount, .win-amount {
                        font-size: 24px;
                        font-weight: bold;
                        color: #FFD700;
                        text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                    }
                    
                    /* Animation for win amount */
                    .win-amount.win-animate {
                        animation: winPulse 1s ease-in-out;
                    }
                    
                    .win-amount.big-win-animate {
                        animation: bigWinPulse 2s ease-in-out;
                    }
                    
                    .win-amount.jackpot-win-animate {
                        animation: jackpotWinPulse 3s ease-in-out;
                    }
                    
                    /* Reels container */
                    .reels-container {
                        position: relative;
                        background: #000;
                        padding: 15px;
                        border-radius: 10px;
                        margin-bottom: 10px;
                        border: 2px solid #FFD700;
                        box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
                        overflow: hidden;
                        height: auto;
                    }
                    
                    .reel-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 10px;
                        margin-bottom: 10px;
                        height: auto;
                        max-height: 100px;
                    }
                    
                    .reel-row:last-child {
                        margin-bottom: 0;
                    }
                    
                    .reel {
                        flex: 1;
                        aspect-ratio: 1;
                        background: linear-gradient(145deg, #1e1e1e, #111);
                        border-radius: 8px;
                        overflow: hidden;
                        position: relative;
                        border: 1px solid #333;
                        min-height: 80px;
                        height: 80px;
                    }
                    
                    .reel-strip {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        transform-origin: center center;
                        will-change: transform;
                    }
                    
                    .symbol {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        font-size: 36px;
                        top: 0;
                        left: 0;
                        transition: transform 0.3s ease;
                    }
                    
                    /* Symbol highlight animation */
                    .symbol.highlight {
                        animation: symbolHighlight 1s ease-in-out infinite alternate;
                        z-index: 10;
                        transform: scale(1.1);
                        will-change: transform;
                    }
                    
                    @keyframes symbolHighlight {
                        0% {
                            transform: scale(1);
                            filter: brightness(1);
                        }
                        100% {
                            transform: scale(1.1);
                            filter: brightness(1.5) drop-shadow(0 0 10px gold);
                        }
                    }
                    
                    /* Result display */
                    .result-display {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                        z-index: 9999;
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 0.3s ease;
                        max-width: 300px;
                    }
                    
                    /* Активный стиль для result-display */
                    .result-display.win-result,
                    .result-display.big-win-result, 
                    .result-display.jackpot-win-result {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    .win-message, .big-win-message, .jackpot-win-message, .no-win-message {
                        padding: 15px 30px;
                        border-radius: 10px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        background: rgba(0, 0, 0, 0.9);
                        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.7);
                        backdrop-filter: blur(8px);
                        border: 3px solid;
                    }
                    
                    .win-message {
                        border-color: #00A86B;
                    }
                    
                    .big-win-message {
                        border-color: #FFD700;
                    }
                    
                    .jackpot-win-message {
                        border-color: #FF4500;
                    }
                    
                    .no-win-message {
                        color: #aaa;
                        border-color: #555;
                        padding: 10px 20px;
                    }
                    
                    .win-icon {
                        font-size: 30px;
                        margin-bottom: 5px;
                    }
                    
                    .win-text {
                        font-size: 24px;
                        font-weight: bold;
                        color: #00A86B;
                        margin-bottom: 5px;
                    }
                    
                    .big-win-text {
                        font-size: 28px;
                        font-weight: bold;
                        color: #FFD700;
                        text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                        margin-bottom: 5px;
                    }
                    
                    .jackpot-win-text {
                        font-size: 32px;
                        font-weight: bold;
                        color: #FF4500;
                        text-shadow: 0 0 15px rgba(255, 69, 0, 0.7);
                        margin-bottom: 5px;
                    }
                    
                    .win-amount, .big-win-amount, .jackpot-win-amount {
                        font-size: 20px;
                        font-weight: bold;
                    }
                    
                    .no-win-text {
                        font-size: 18px;
                        opacity: 0.7;
                    }
                    
                    /* Win particles (confetti) */
                    .win-particle {
                        position: absolute;
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        animation: particle 3s ease-out forwards;
                    }
                    
                    @keyframes particle {
                        0% {
                            transform: translateY(0) scale(0) rotate(0deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateY(-100px) scale(1) rotate(360deg);
                            opacity: 0;
                        }
                    }
                    
                    /* Controls section */
                    .slots-controls {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    /* Bet controls */
                    .bet-controls {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    .compact-bet-input-wrapper {
                        display: flex;
                        align-items: center;
                        background: rgba(20, 20, 20, 0.5);
                        border-radius: 8px;
                        padding: 8px 12px;
                        position: relative;
                    }
                    
                    .bet-btn {
                        width: 36px;
                        height: 36px;
                        background: linear-gradient(145deg, #333, #222);
                        border: none;
                        border-radius: 50%;
                        color: #FFD700;
                        font-size: 18px;
                        font-weight: bold;
                        cursor: pointer;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        transition: all 0.2s ease;
                    }
                    
                    .bet-btn:hover {
                        background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
                        transform: scale(1.05);
                    }
                    
                    .bet-btn:active {
                        transform: translateY(1px);
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                    }
                    
                    .bet-btn:disabled {
                        opacity: 0.7;
                        cursor: not-allowed;
                    }
                    
                    .bet-input-container {
                        position: relative;
                        margin: 0 10px;
                    }
                    
                    .bet-input {
                        width: 80px;
                        text-align: center;
                        font-size: 20px;
                        font-weight: bold;
                        background: transparent;
                        border: none;
                        color: #FFD700;
                        padding: 5px 0;
                    }
                    
                    .bet-input:focus {
                        outline: none;
                    }
                    
                    .bet-label {
                        position: absolute;
                        top: -15px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.7);
                        text-transform: uppercase;
                    }
                    
                    .keyboard-hide-btn {
                        position: absolute;
                        right: 10px;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 28px;
                        height: 28px;
                        background: rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        color: #fff;
                        font-size: 14px;
                        cursor: pointer;
                        display: none;
                        justify-content: center;
                        align-items: center;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    
                    .keyboard-hide-btn.visible {
                        display: flex;
                        opacity: 1;
                    }
                    
                    .quick-bet-btns {
                        display: flex;
                        justify-content: center;
                        gap: 8px;
                        margin-top: 5px;
                    }
                    
                    .quick-bet-btn {
                        padding: 6px 12px;
                        background: rgba(20, 20, 20, 0.5);
                        border: 1px solid rgba(255, 215, 0, 0.3);
                        border-radius: 5px;
                        color: #FFD700;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .quick-bet-btn:hover {
                        background: rgba(40, 40, 40, 0.5);
                        border-color: #FFD700;
                    }
                    
                    /* Action controls */
                    .action-controls {
                        display: flex;
                        justify-content: space-between;
                        gap: 15px;
                    }
                    
                    .spin-btn {
                        flex: 1;
                        padding: 15px 0;
                        background: linear-gradient(145deg, #00A86B, #008B57);
                        border: none;
                        border-radius: 30px;
                        color: white;
                        font-size: 18px;
                        font-weight: bold;
                        text-transform: uppercase;
                        cursor: pointer;
                        box-shadow: 0 5px 15px rgba(0, 168, 107, 0.3);
                        transition: all 0.2s ease;
                    }
                    
                    .spin-btn:hover {
                        background: linear-gradient(145deg, #00C480, #00A86B);
                        transform: translateY(-2px);
                        box-shadow: 0 7px 20px rgba(0, 168, 107, 0.4);
                    }
                    
                    .spin-btn:active {
                        transform: translateY(1px);
                        box-shadow: 0 3px 10px rgba(0, 168, 107, 0.3);
                    }
                    
                    .spin-btn:disabled {
                        background: #555;
                        cursor: not-allowed;
                        transform: none;
                        box-shadow: none;
                    }
                    
                    .secondary-controls {
                        display: flex;
                        gap: 10px;
                    }
                    
                    .control-btn {
                        padding: 10px;
                        background: linear-gradient(145deg, #2a2a2a, #222);
                        border: none;
                        border-radius: 10px;
                        color: white;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    /* Увеличиваем ширину кнопок Турбо и Авто */
                    .control-btn.auto-spin,
                    .control-btn.turbo {
                        min-width: 80px;
                        padding: 10px 18px;
                    }
                    
                    /* Оставляем кнопку звука как есть */
                    .control-btn.sound {
                        padding: 10px;
                        min-width: auto;
                    }
                    
                    .control-btn:hover {
                        background: linear-gradient(145deg, #333, #2a2a2a);
                    }
                    
                    .control-btn.active {
                        background: linear-gradient(145deg, #FFD700, #FFC107);
                        color: #000;
                    }
                    
                    .btn-icon {
                        font-size: 18px;
                        margin-bottom: 2px;
                    }
                    
                    .btn-text {
                        font-size: 10px;
                        text-transform: uppercase;
                    }
                    
                    /* Auto spin menu */
                    .auto-spin-menu {
                        position: absolute;
                        bottom: 80px;
                        right: 20px;
                        background: rgba(0, 0, 0, 0.9);
                        border: 1px solid #FFD700;
                        border-radius: 10px;
                        padding: 15px;
                        z-index: 100;
                        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
                        min-width: 200px;
                    }
                    
                    .menu-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                    }
                    
                    .menu-header h3 {
                        margin: 0;
                        font-size: 16px;
                        color: #FFD700;
                    }
                    
                    .close-btn {
                        background: none;
                        border: none;
                        color: white;
                        font-size: 18px;
                        cursor: pointer;
                    }
                    
                    .auto-spin-options {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px;
                    }
                    
                    .auto-spin-option {
                        padding: 10px;
                        background: #333;
                        border: none;
                        border-radius: 5px;
                        color: white;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .auto-spin-option:hover {
                        background: #444;
                    }
                    
                    /* Animations */
                    @keyframes winPulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.2); }
                        100% { transform: scale(1); }
                    }
                    
                    @keyframes bigWinPulse {
                        0% { transform: scale(1); filter: hue-rotate(0deg); }
                        25% { transform: scale(1.1); filter: hue-rotate(90deg); }
                        50% { transform: scale(1.2); filter: hue-rotate(180deg); }
                        75% { transform: scale(1.1); filter: hue-rotate(270deg); }
                        100% { transform: scale(1); filter: hue-rotate(360deg); }
                    }
                    
                    @keyframes jackpotWinPulse {
                        0% { transform: scale(1) rotate(0deg); filter: hue-rotate(0deg); }
                        25% { transform: scale(1.2) rotate(-5deg); filter: hue-rotate(90deg); }
                        50% { transform: scale(1.4) rotate(0deg); filter: hue-rotate(180deg); }
                        75% { transform: scale(1.2) rotate(5deg); filter: hue-rotate(270deg); }
                        100% { transform: scale(1) rotate(0deg); filter: hue-rotate(360deg); }
                    }
                    
                    /* Notification */
                    .slots-notification {
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        z-index: 1000;
                        animation: notification 3s forwards;
                    }
                    
                    @keyframes notification {
                        0% { opacity: 0; transform: translate(-50%, -20px); }
                        10% { opacity: 1; transform: translate(-50%, 0); }
                        90% { opacity: 1; transform: translate(-50%, 0); }
                        100% { opacity: 0; transform: translate(-50%, -20px); }
                    }
                    
                    /* Utility classes */
                    .hidden {
                        display: none !important;
                    }
                    
                    /* Media Queries */
                    @media (max-width: 576px) {
                        .slots-premium {
                            box-sizing: border-box;
                        }
                        
                        .jackpot-amount, .win-amount {
                            font-size: 18px;
                        }
                        
                        .reel {
                            aspect-ratio: 0.9;
                        }
                        
                        .symbol {
                            font-size: 32px;
                        }
                        
                        .bet-input {
                            width: 60px;
                            font-size: 18px;
                        }
                        
                        .bet-btn {
                            width: 32px;
                            height: 32px;
                            font-size: 16px;
                        }
                        
                        .quick-bet-btns {
                            flex-wrap: wrap;
                        }
                        
                        .quick-bet-btn {
                            flex: 1;
                            min-width: calc(25% - 8px);
                            text-align: center;
                        }
                        
                        .action-controls {
                            flex-wrap: wrap;
                        }
                        
                        .spin-btn {
                            width: 100%;
                            order: -1;
                        }
                        
                        .secondary-controls {
                            width: 100%;
                            justify-content: space-between;
                        }
                    }
                `;
                
                document.head.appendChild(styleEl);
            }
        };
        
        // Public interface
        return {
            // Initialize game
            init: init,
            
            // Start a spin
            spin: spin,
            
            // Start auto spin with count
            autoSpin: startAutoSpin,
            
            // Toggle turbo mode
            toggleTurbo: toggleTurboMode,
            
            // Toggle sound
            toggleSound: toggleSound,
            
            // Get game status
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    isSpinning: state.isSpinning,
                    autoSpinning: state.autoSpinning,
                    autoSpinsLeft: state.autoSpinsLeft,
                    turboMode: state.turboMode,
                    soundEnabled: state.soundEnabled,
                    currentBet: state.currentBet,
                    isNewPlayer: state.isNewPlayer,
                    spinsPlayed: state.spinsPlayed,
                    lastWin: state.lastWin,
                    totalWin: state.totalWin
                };
            }
        };
    })();
    
    // Register game in different formats for maximum compatibility
    try {
        // 1. Register through new system
        if (window.registerGame) {
            window.registerGame('slotsGame', slotsGame);
            app.log('Slots', 'Game registered through registerGame system');
        }
        
        // 2. Export to global namespace (backward compatibility)
        window.slotsGame = slotsGame;
        app.log('Slots', 'Game exported to global namespace');
        
        // 3. Auto-initialization when DOM is ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!slotsGame.getStatus().initialized) {
                    app.log('Slots', 'Auto-initializing game (DOM already loaded)');
                    slotsGame.init().catch(error => {
                        app.log('Slots', `Auto-initialization error: ${error.message}`, true);
                    });
                }
            }, 1000);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    if (!slotsGame.getStatus().initialized) {
                        app.log('Slots', 'Auto-initializing game on DOMContentLoaded');
                        slotsGame.init().catch(error => {
                            app.log('Slots', `Auto-initialization error: ${error.message}`, true);
                        });
                    }
                }, 1000);
            });
        }
        
    } catch (error) {
        app.log('Slots', `Error registering game: ${error.message}`, true);
    }
})();