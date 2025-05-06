/**
 * coinflip.js - Implementation of Coin Flip game
 * Version 1.0.0
 * 
 * Features:
 * - Non-blocking initialization
 * - Error handling
 * - Timeouts for all async operations
 * - Compatibility with the game registration system
 * - Dynamic DOM element creation if needed
 */

// Prevent potential conflicts and provide isolated environment
(function() {
    // Check for main app object
    if (!window.GreenLightApp) {
        console.error('[CoinFlip] GreenLightApp not initialized!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('CoinFlip', 'Initializing CoinFlip module v1.0.0');
    
    // Game logic in closure for isolation
    const coinFlipGame = (function() {
        // Game elements
        let elements = {
            flipBtn: null,
            coinBet: null,
            coinElement: null,
            coinChoice: null,
            coinResult: null,
            container: null
        };
        
        // Game state
        let state = {
            isFlipping: false,
            initialized: false,
            initializationStarted: false,
            chosenSide: null,
            betAmount: 0,
            soundEnabled: true
        };
        
        // Sound effects
        let sounds = {
            flip: null,
            win: null,
            lose: null
        };
        
        /**
         * Create main container for the game
         */
        const createGameContainer = function() {
            try {
                // Check if container already exists
                let container = document.querySelector('.coinflip-container');
                if (container) {
                    elements.container = container;
                    return container;
                }
                
                // Find placement area
                let gameArea = document.querySelector('.games-area');
                if (!gameArea) {
                    // If game area doesn't exist, create it
                    gameArea = document.createElement('div');
                    gameArea.className = 'games-area';
                    
                    // Find app container
                    const appContainer = document.querySelector('.app-container');
                    if (appContainer) {
                        appContainer.appendChild(gameArea);
                    } else {
                        // If no special container, add to body
                        document.body.appendChild(gameArea);
                    }
                    
                    app.log('CoinFlip', 'Created game area');
                }
                
                // Create game container
                container = document.createElement('div');
                container.className = 'coinflip-container game-container';
                gameArea.appendChild(container);
                
                elements.container = container;
                app.log('CoinFlip', 'Created main game container');
                
                return container;
            } catch (error) {
                app.log('CoinFlip', `Error creating container: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Create game interface
         */
        const createGameInterface = function() {
            try {
                const container = elements.container || createGameContainer();
                if (!container) {
                    app.log('CoinFlip', 'Cannot create interface: container not found', true);
                    return false;
                }
                
                // Check if interface already exists
                if (container.querySelector('#coin')) {
                    app.log('CoinFlip', 'Interface already created');
                    return true;
                }
                
                // Create HTML markup for the game
                container.innerHTML = `
                    <h2>Coin Flip</h2>
                    <div class="game-controls">
                        <div class="bet-control">
                            <label for="coin-bet">Bet Amount:</label>
                            <input type="number" id="coin-bet" min="1" max="1000" value="10">
                        </div>
                        
                        <div class="coin-choice">
                            <label>Choose your side:</label>
                            <div class="choice-buttons">
                                <button id="choose-heads" class="choice-btn">HEADS</button>
                                <button id="choose-tails" class="choice-btn">TAILS</button>
                            </div>
                        </div>
                        
                        <div class="flip-controls">
                            <button id="flip-btn" class="action-btn">FLIP COIN</button>
                        </div>
                        
                        <div class="sound-controls">
                            <button id="toggle-sound" class="toggle-btn">
                                <span id="sound-icon">🔊</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="coin-container">
                        <div id="coin">
                            <div class="heads"></div>
                            <div class="tails"></div>
                        </div>
                    </div>
                    
                    <div id="coin-result" class="result"></div>
                `;
                
                // Create styles if they don't exist yet
                if (!document.getElementById('coinflip-styles')) {
                    const styleElement = document.createElement('style');
                    styleElement.id = 'coinflip-styles';
                    styleElement.textContent = `
                        .coinflip-container {
                            padding: 15px;
                            margin: 10px auto;
                            border: 1px solid #ccc;
                            border-radius: 8px;
                            max-width: 500px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        }
                        
                        .game-controls {
                            margin-bottom: 15px;
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                        }
                        
                        .action-btn {
                            padding: 10px 15px;
                            background-color: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                            width: 100%;
                        }
                        
                        .action-btn:disabled {
                            background-color: #cccccc;
                            cursor: not-allowed;
                        }
                        
                        .choice-buttons {
                            display: flex;
                            justify-content: space-between;
                            gap: 10px;
                            margin-top: 5px;
                        }
                        
                        .choice-btn {
                            flex: 1;
                            padding: 8px;
                            border: 2px solid #ccc;
                            background-color: #f1f1f1;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                            color: #333;
                            transition: all 0.2s;
                        }
                        
                        .choice-btn.selected {
                            border-color: #4CAF50;
                            background-color: #e8f5e9;
                        }
                        
                        .coin-container {
                            height: 200px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin: 20px 0;
                            perspective: 1000px;
                        }
                        
                        #coin {
                            position: relative;
                            width: 150px;
                            height: 150px;
                            transform-style: preserve-3d;
                            transition: transform 1s ease-in;
                            cursor: pointer;
                        }
                        
                        #coin .heads, 
                        #coin .tails {
                            position: absolute;
                            width: 100%;
                            height: 100%;
                            border-radius: 50%;
                            backface-visibility: hidden;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            font-size: 48px;
                            color: #333;
                            user-select: none;
                        }
                        
                        #coin .heads {
                            background: radial-gradient(#FFD700, #B8860B);
                            z-index: 100;
                        }
                        
                        #coin .heads::before {
                            content: "H";
                        }
                        
                        #coin .tails {
                            background: radial-gradient(#C0C0C0, #808080);
                            transform: rotateY(180deg);
                        }
                        
                        #coin .tails::before {
                            content: "T";
                        }
                        
                        #coin.heads {
                            transform: rotateY(0deg);
                        }
                        
                        #coin.tails {
                            transform: rotateY(180deg);
                        }
                        
                        #coin.flipping {
                            animation: flip 2s ease-in-out;
                        }
                        
                        @keyframes flip {
                            0% { transform: rotateY(0); }
                            100% { transform: rotateY(1800deg); }
                        }
                        
                        .result {
                            margin-top: 15px;
                            padding: 10px;
                            border-radius: 4px;
                            text-align: center;
                            display: none;
                        }
                        
                        .result.win {
                            background-color: rgba(76, 175, 80, 0.2);
                            color: #4CAF50;
                            display: block;
                        }
                        
                        .result.lose {
                            background-color: rgba(244, 67, 54, 0.2);
                            color: #F44336;
                            display: block;
                        }
                        
                        .toggle-btn {
                            background: none;
                            border: none;
                            font-size: 24px;
                            cursor: pointer;
                            padding: 5px;
                            border-radius: 4px;
                            transition: background 0.2s;
                        }
                        
                        .toggle-btn:hover {
                            background: rgba(255, 255, 255, 0.1);
                        }
                        
                        .sound-controls {
                            display: flex;
                            justify-content: flex-end;
                        }
                    `;
                    document.head.appendChild(styleElement);
                }
                
                app.log('CoinFlip', 'Game interface successfully created');
                return true;
            } catch (error) {
                app.log('CoinFlip', `Error creating interface: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Initialize the game
         * With protection against repeated initialization and timeout
         */
        const init = async function() {
            // Prevent repeated initialization
            if (state.initialized || state.initializationStarted) {
                app.log('CoinFlip', 'Initialization already completed or in progress');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('CoinFlip', 'Starting game initialization');
            
            try {
                // Set timeout for initialization
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // First create interface
                        if (!createGameInterface()) {
                            app.log('CoinFlip', 'Failed to create game interface', true);
                            resolve(false);
                            return;
                        }
                        
                        // Load audio
                        await loadAudio();
                        
                        // Then get DOM elements
                        await findDOMElements();
                        
                        // Check UI elements
                        app.log('CoinFlip', 'Checking UI elements');
                        
                        // Add event listeners
                        setupEventListeners();
                        
                        state.initialized = true;
                        app.log('CoinFlip', 'Initialization completed successfully');
                        resolve(true);
                    } catch (innerError) {
                        app.log('CoinFlip', `Error during initialization: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                // Set timeout (3 seconds)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('CoinFlip', 'Initialization timeout', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Use Promise.race to prevent hanging
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('CoinFlip', `Critical initialization error: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Find DOM elements with null protection
         */
        const findDOMElements = async function() {
            // Use Promise for asynchronicity
            return new Promise((resolve, reject) => {
                try {
                    // Timeout for waiting for DOM to be ready
                    setTimeout(() => {
                        elements.flipBtn = document.getElementById('flip-btn');
                        elements.coinBet = document.getElementById('coin-bet');
                        elements.coinElement = document.getElementById('coin');
                        elements.coinResult = document.getElementById('coin-result');
                        elements.chooseHeads = document.getElementById('choose-heads');
                        elements.chooseTails = document.getElementById('choose-tails');
                        elements.toggleSound = document.getElementById('toggle-sound');
                        
                        // Check critical elements
                        if (!elements.coinElement) {
                            app.log('CoinFlip', 'Coin element not found', true);
                        }
                        
                        if (!elements.flipBtn) {
                            app.log('CoinFlip', 'Flip button not found', true);
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('CoinFlip', `Error finding DOM elements: ${error.message}`, true);
                    reject(error);
                }
            });
        };
        
        /**
         * Load audio files
         */
        const loadAudio = async function() {
            try {
                // Create audio objects
                sounds.flip = new Audio('sounds/flip.mp3');
                sounds.win = new Audio('sounds/win.mp3');
                sounds.lose = new Audio('sounds/lose.mp3');
                
                // Preload audio
                const preloadPromises = [
                    preloadAudio(sounds.flip),
                    preloadAudio(sounds.win),
                    preloadAudio(sounds.lose)
                ];
                
                // Wait for all preloads with a timeout
                await Promise.race([
                    Promise.all(preloadPromises),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]);
                
                app.log('CoinFlip', 'Audio loaded successfully');
                return true;
            } catch (error) {
                app.log('CoinFlip', `Error loading audio: ${error.message}`, true);
                // Continue without audio
                return false;
            }
        };
        
        /**
         * Preload audio with promise
         */
        const preloadAudio = function(audioElement) {
            return new Promise((resolve) => {
                if (!audioElement) {
                    resolve();
                    return;
                }
                
                audioElement.addEventListener('canplaythrough', () => {
                    resolve();
                }, { once: true });
                
                audioElement.addEventListener('error', () => {
                    resolve();
                }, { once: true });
                
                // Force load attempt
                if (audioElement.readyState >= 3) {
                    resolve();
                } else {
                    audioElement.load();
                }
                
                // Safety timeout
                setTimeout(resolve, 500);
            });
        };
        
        /**
         * Play sound effect with safety checks
         */
        const playSound = function(sound) {
            if (!state.soundEnabled || !sounds[sound]) return;
            
            try {
                // Reset to beginning if already playing
                sounds[sound].currentTime = 0;
                sounds[sound].play().catch(error => {
                    // Ignore play errors (common on mobile)
                    app.log('CoinFlip', `Audio play error: ${error.message}`, false);
                });
            } catch (error) {
                // Ignore any audio errors
            }
        };
        
        /**
         * Toggle sound on/off
         */
        const toggleSound = function() {
            state.soundEnabled = !state.soundEnabled;
            
            // Update icon
            const soundIcon = document.getElementById('sound-icon');
            if (soundIcon) {
                soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
            }
            
            app.log('CoinFlip', `Sound ${state.soundEnabled ? 'enabled' : 'disabled'}`);
        };
        
        /**
         * Set up event listeners
         */
        const setupEventListeners = function() {
            try {
                // Flip button
                if (elements.flipBtn) {
                    // Clear current listeners (prevent duplication)
                    const newFlipBtn = elements.flipBtn.cloneNode(true);
                    if (elements.flipBtn.parentNode) {
                        elements.flipBtn.parentNode.replaceChild(newFlipBtn, elements.flipBtn);
                    }
                    elements.flipBtn = newFlipBtn;
                    
                    // Add handler
                    elements.flipBtn.addEventListener('click', flipCoin);
                }
                
                // Choose heads button
                if (elements.chooseHeads) {
                    elements.chooseHeads.addEventListener('click', () => chooseOption('heads'));
                }
                
                // Choose tails button
                if (elements.chooseTails) {
                    elements.chooseTails.addEventListener('click', () => chooseOption('tails'));
                }
                
                // Toggle sound button
                if (elements.toggleSound) {
                    elements.toggleSound.addEventListener('click', toggleSound);
                }
                
                app.log('CoinFlip', 'Event listeners set up');
            } catch (error) {
                app.log('CoinFlip', `Error setting up event listeners: ${error.message}`, true);
            }
        };
        
        /**
         * Choose heads or tails
         */
        const chooseOption = function(option) {
            try {
                state.chosenSide = option;
                
                // Update UI
                if (elements.chooseHeads) {
                    elements.chooseHeads.classList.toggle('selected', option === 'heads');
                }
                
                if (elements.chooseTails) {
                    elements.chooseTails.classList.toggle('selected', option === 'tails');
                }
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                app.log('CoinFlip', `Option selected: ${option}`);
            } catch (error) {
                app.log('CoinFlip', `Error selecting option: ${error.message}`, true);
            }
        };
        
        /**
         * Check and initialize casinoApp object if it doesn't exist
         */
        const ensureCasinoApp = function() {
            if (window.casinoApp) return true;
            
            // Create minimal casinoApp implementation if object is missing
            app.log('CoinFlip', 'casinoApp not found, creating temporary implementation', true);
            window.casinoApp = {
                showNotification: function(message) {
                    alert(message);
                },
                provideTactileFeedback: function() {
                    // Vibration stub
                },
                processGameResult: function(gameType, bet, result, win, data) {
                    app.log('CoinFlip', `Game: ${gameType}, Bet: ${bet}, Result: ${result}, Win: ${win}`, false);
                    return Promise.resolve({success: true});
                }
            };
            
            return true;
        };
        
        /**
         * Flip the coin
         */
        const flipCoin = async function() {
            app.log('CoinFlip', 'Starting coin flip');
            
            // Check initialization
            if (!state.initialized) {
                app.log('CoinFlip', 'Game not initialized, starting initialization', true);
                await init();
                
                // If initialization failed, exit
                if (!state.initialized) {
                    app.log('CoinFlip', 'Failed to start game: initialization error', true);
                    return;
                }
            }
            
            try {
                // Check casinoApp presence
                if (!ensureCasinoApp()) {
                    return;
                }
                
                // Check if already flipping
                if (state.isFlipping) {
                    app.log('CoinFlip', 'Coin already flipping');
                    return;
                }
                
                // Check if side selected
                if (!state.chosenSide) {
                    window.casinoApp.showNotification('Please choose Heads or Tails first');
                    return;
                }
                
                // Get bet amount
                if (!elements.coinBet) {
                    app.log('CoinFlip', 'Bet element not found', true);
                    return;
                }
                
                state.betAmount = parseInt(elements.coinBet.value);
                
                // Check bet
                if (isNaN(state.betAmount) || state.betAmount <= 0) {
                    window.casinoApp.showNotification('Please enter a valid bet amount');
                    return;
                }
                
                // Check if enough funds
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    state.betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Insufficient funds for this bet');
                    return;
                }
                
                // Set flipping state
                state.isFlipping = true;
                
                // Update UI
                if (elements.flipBtn) {
                    elements.flipBtn.disabled = true;
                }
                
                if (elements.chooseHeads) {
                    elements.chooseHeads.disabled = true;
                }
                
                if (elements.chooseTails) {
                    elements.chooseTails.disabled = true;
                }
                
                if (elements.coinResult) {
                    elements.coinResult.className = 'result';
                    elements.coinResult.textContent = '';
                }
                
                // Tactile feedback
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Process bet
                await window.casinoApp.processGameResult(
                    'coinflip',
                    state.betAmount,
                    'bet',
                    0,
                    { chosenSide: state.chosenSide }
                );
                
                // Play flip sound
                playSound('flip');
                
                // Flip the coin with fair randomness
                const result = await flipCoinWithAnimation();
                
                // Determine win/lose
                const isWin = result === state.chosenSide;
                
                // Calculate win amount (2x for win)
                const winAmount = isWin ? state.betAmount * 2 : 0;
                
                // Show result
                displayResult(isWin, winAmount, result);
                
                // Tactile feedback based on result
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
                
                // Process game result
                await window.casinoApp.processGameResult(
                    'coinflip',
                    0, // No additional bet
                    isWin ? 'win' : 'lose',
                    winAmount,
                    {
                        chosenSide: state.chosenSide,
                        result: result,
                        betAmount: state.betAmount
                    }
                );
                
                // Reset state after a delay
                setTimeout(() => {
                    state.isFlipping = false;
                    
                    if (elements.flipBtn) {
                        elements.flipBtn.disabled = false;
                    }
                    
                    if (elements.chooseHeads) {
                        elements.chooseHeads.disabled = false;
                    }
                    
                    if (elements.chooseTails) {
                        elements.chooseTails.disabled = false;
                    }
                }, 2500);
                
            } catch (error) {
                app.log('CoinFlip', `Error flipping coin: ${error.message}`, true);
                
                // Reset state in case of error
                state.isFlipping = false;
                
                if (elements.flipBtn) {
                    elements.flipBtn.disabled = false;
                }
                
                if (elements.chooseHeads) {
                    elements.chooseHeads.disabled = false;
                }
                
                if (elements.chooseTails) {
                    elements.chooseTails.disabled = false;
                }
            }
        };
        
        /**
         * Animate the coin flip
         */
        const flipCoinWithAnimation = function() {
            return new Promise((resolve) => {
                try {
                    const coin = elements.coinElement;
                    if (!coin) {
                        app.log('CoinFlip', 'Coin element not found for animation', true);
                        // Return random result anyway
                        setTimeout(() => {
                            resolve(Math.random() < 0.5 ? 'heads' : 'tails');
                        }, 1000);
                        return;
                    }
                    
                    // Generate random result
                    const result = Math.random() < 0.5 ? 'heads' : 'tails';
                    
                    // Remove previous classes
                    coin.className = '';
                    
                    // Force reflow
                    void coin.offsetWidth;
                    
                    // Add flipping class
                    coin.classList.add('flipping');
                    
                    // After animation completes, set final state
                    setTimeout(() => {
                        coin.className = result;
                        resolve(result);
                    }, 2000);
                    
                } catch (error) {
                    app.log('CoinFlip', `Error in coin flip animation: ${error.message}`, true);
                    // Return result even if animation fails
                    resolve(Math.random() < 0.5 ? 'heads' : 'tails');
                }
            });
        };
        
        /**
         * Display game result
         */
        const displayResult = function(isWin, amount, result) {
            try {
                if (!elements.coinResult) {
                    app.log('CoinFlip', 'Result element not found', true);
                    return;
                }
                
                const resultElement = elements.coinResult;
                
                if (isWin) {
                    resultElement.className = 'result win';
                    resultElement.innerHTML = `
                        <div class="win-icon">🎉</div>
                        <div class="win-title">You won ${amount} Stars!</div>
                        <div class="win-description">The coin landed on ${result.toUpperCase()}</div>
                    `;
                } else {
                    resultElement.className = 'result lose';
                    resultElement.innerHTML = `
                        <div class="lose-icon">😢</div>
                        <div class="lose-title">You lost!</div>
                        <div class="lose-description">The coin landed on ${result.toUpperCase()}</div>
                    `;
                }
                
            } catch (error) {
                app.log('CoinFlip', `Error displaying result: ${error.message}`, true);
            }
        };
        
        // Return public interface
        return {
            // Main methods
            init: init,
            flipCoin: flipCoin,
            
            // Status check method
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
            }
        };
    })();
    
    // Register game in all formats for maximum compatibility
    try {
        // 1. Register through new system
        if (window.registerGame) {
            window.registerGame('coinFlipGame', coinFlipGame);
            app.log('CoinFlip', 'Game registered through registerGame system');
        }
        
        // 2. Export to global namespace (backward compatibility)
        window.coinFlipGame = coinFlipGame;
        app.log('CoinFlip', 'Game exported to global namespace');
        
        // 3. Log completion of module loading
        app.log('CoinFlip', 'Module loaded and ready for initialization');
        
        // 4. Auto-initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!coinFlipGame.getStatus().initialized && !coinFlipGame.getStatus().initializationStarted) {
                    app.log('CoinFlip', 'Starting automatic initialization');
                    coinFlipGame.init();
                }
            }, 500);
        });
        
        // 5. If DOM already loaded, initialize immediately
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!coinFlipGame.getStatus().initialized && !coinFlipGame.getStatus().initializationStarted) {
                    app.log('CoinFlip', 'Starting automatic initialization (DOM already loaded)');
                    coinFlipGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('CoinFlip', `Error registering game: ${error.message}`, true);
    }
  })();