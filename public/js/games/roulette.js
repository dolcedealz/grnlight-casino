/**
 * roulette.js - Improved roulette game with continuous spin cycle
 * Version 3.0.1
 * 
 * Features:
 * - Non-blocking initialization
 * - Continuous spin cycle with configurable betting windows
 * - Shared game state for all players
 * - Improved error handling and timeout protection
 * - Compatible with the game registration system
 */

// Prevent potential conflicts and provide an isolated environment
(function() {
    // Check for main application object
    if (!window.GreenLightApp) {
        console.error('[Roulette] GreenLightApp not initialized!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Roulette', 'Initializing continuous roulette game module v3.0.1');
    
    // Game logic in closure for isolation
    const rouletteGame = (function() {
        // Game elements
        let elements = {
            placeBetBtn: null,
            clearBetBtn: null,
            rouletteBet: null,
            betTypeSelect: null,
            betColorContainer: null,
            betNumberContainer: null,
            betOddEvenContainer: null,
            rouletteNumber: null,
            colorBtns: [],
            oddEvenBtns: [],
            wheelInner: null,
            rouletteBall: null,
            rouletteResult: null,
            timerDisplay: null,
            nextSpinTime: null,
            betsList: null,
            historyContainer: null,
            gameContainer: null
        };
        
        // Game state
        let state = {
            initialized: false,
            initializationStarted: false,
            currentPhase: 'waiting', // 'waiting', 'betting', 'spinning', 'results'
            timeRemaining: 0,
            gameInterval: null,
            nextSpinTimestamp: 0,
            selectedBetType: 'color',
            selectedColor: null,
            selectedOddEven: null,
            selectedNumber: null,
            activeBets: [],
            lastResult: null,
            lastResults: []
        };
        
        // Roulette numbers
        const numbers = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        
        // Color map for numbers
        const numberColors = {
            '0': 'green',
            '1': 'red',
            '2': 'black',
            '3': 'red',
            '4': 'black',
            '5': 'red',
            '6': 'black',
            '7': 'red',
            '8': 'black',
            '9': 'red',
            '10': 'black',
            '11': 'black',
            '12': 'red',
            '13': 'black',
            '14': 'red',
            '15': 'black',
            '16': 'red',
            '17': 'black',
            '18': 'red',
            '19': 'red',
            '20': 'black',
            '21': 'red',
            '22': 'black',
            '23': 'red',
            '24': 'black',
            '25': 'red',
            '26': 'black',
            '27': 'red',
            '28': 'black',
            '29': 'black',
            '30': 'red',
            '31': 'black',
            '32': 'red',
            '33': 'black',
            '34': 'red',
            '35': 'black',
            '36': 'red'
        };
        
        // Configuration
        const config = {
            bettingPhaseDuration: { min: 15, max: 30 }, // seconds
            spinningPhaseDuration: 8, // seconds
            resultsPhaseDuration: 5, // seconds
            maxHistory: 10 // number of last results to keep
        };
        
        /**
         * Initialize the game
         * With protection against repeated initialization and timeout
         */
        const init = async function() {
            // Prevent repeated initialization
            if (state.initialized || state.initializationStarted) {
                app.log('Roulette', 'Initialization already completed or in progress');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Roulette', 'Starting game initialization');
            
            try {
                // Set initialization timeout
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Create game container if needed
                        await createGameContainer();
                        
                        // Add game styles
                        addGameStyles();
                        
                        // Find DOM elements (with availability check)
                        await findDOMElements();
                        
                        // Set up the wheel
                        setupWheel();
                        
                        // Add event listeners
                        setupEventListeners();
                        
                        // Create history container
                        createHistoryContainer();
                        
                        // Start the game cycle
                        startGameCycle();
                        
                        state.initialized = true;
                        app.log('Roulette', 'Initialization completed successfully');
                        resolve(true);
                    } catch (innerError) {
                        app.log('Roulette', `Error during initialization: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                // Set timeout (3 seconds)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Roulette', 'Initialization timeout', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Use Promise.race to prevent hanging
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('Roulette', `Critical initialization error: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Create the main game container if it doesn't exist
         */
        const createGameContainer = function() {
            return new Promise((resolve) => {
                try {
                    // Check if container already exists
                    let container = document.querySelector('.roulette-container');
                    if (container) {
                        elements.gameContainer = container;
                        resolve();
                        return;
                    }
                    
                    // Check if there's a roulette screen to add to
                    const rouletteScreen = document.getElementById('roulette-screen');
                    if (rouletteScreen) {
                        container = document.createElement('div');
                        container.className = 'roulette-container';
                        
                        // Create a basic structure
                        container.innerHTML = `
                            <div class="roulette-game-area">
                                <div class="roulette-wheel">
                                    <!-- Wheel will be created here -->
                                </div>
                                <!-- Controls and other elements will be added dynamically -->
                            </div>
                        `;
                        
                        rouletteScreen.appendChild(container);
                        elements.gameContainer = container;
                        app.log('Roulette', 'Game container created inside roulette-screen');
                        resolve();
                        return;
                    }
                    
                    // If no roulette screen, try to find main content
                    const mainContent = document.querySelector('.main-content');
                    if (mainContent) {
                        container = document.createElement('div');
                        container.className = 'roulette-container';
                        container.innerHTML = `
                            <div class="game-header">
                                <button class="back-btn">← Back</button>
                                <h2>Roulette</h2>
                            </div>
                            <div class="roulette-game-area">
                                <div class="roulette-wheel">
                                    <!-- Wheel will be created here -->
                                </div>
                                <!-- Controls and other elements will be added dynamically -->
                            </div>
                        `;
                        
                        mainContent.appendChild(container);
                        elements.gameContainer = container;
                        
                        // Add back button functionality
                        const backBtn = container.querySelector('.back-btn');
                        if (backBtn) {
                            backBtn.addEventListener('click', () => {
                                if (typeof window.activateWelcomeScreen === 'function') {
                                    window.activateWelcomeScreen();
                                } else {
                                    container.style.display = 'none';
                                }
                            });
                        }
                        
                        app.log('Roulette', 'Game container created in main content');
                        resolve();
                        return;
                    }
                    
                    // Last resort - add to body
                    container = document.createElement('div');
                    container.className = 'roulette-container';
                    container.innerHTML = `
                        <h2>Roulette</h2>
                        <div class="roulette-game-area">
                            <div class="roulette-wheel">
                                <!-- Wheel will be created here -->
                            </div>
                            <!-- Controls and other elements will be added dynamically -->
                        </div>
                    `;
                    
                    document.body.appendChild(container);
                    elements.gameContainer = container;
                    app.log('Roulette', 'Game container created in body');
                    resolve();
                    
                } catch (error) {
                    app.log('Roulette', `Error creating game container: ${error.message}`, true);
                    // Continue even if we can't create the container
                    resolve();
                }
            });
        };
        
        /**
         * Find DOM elements with null protection
         */
        const findDOMElements = async function() {
            // Use Promise for asynchronous behavior
            return new Promise((resolve, reject) => {
                try {
                    // Timeout to wait for DOM readiness
                    setTimeout(() => {
                        elements.placeBetBtn = document.getElementById('place-bet-btn');
                        elements.clearBetBtn = document.getElementById('clear-bet-btn');
                        elements.rouletteBet = document.getElementById('roulette-bet');
                        elements.betTypeSelect = document.getElementById('roulette-bet-type');
                        elements.betColorContainer = document.getElementById('bet-color-container');
                        elements.betNumberContainer = document.getElementById('bet-number-container');
                        elements.betOddEvenContainer = document.getElementById('bet-odd-even-container');
                        elements.rouletteNumber = document.getElementById('roulette-number');
                        elements.colorBtns = document.querySelectorAll('.color-btn');
                        elements.oddEvenBtns = document.querySelectorAll('.odd-even-btn');
                        elements.wheelInner = document.getElementById('wheel-inner');
                        elements.rouletteBall = document.getElementById('roulette-ball');
                        elements.rouletteResult = document.getElementById('roulette-result');
                        elements.timerDisplay = document.getElementById('timer-display');
                        elements.nextSpinTime = document.getElementById('next-spin-time');
                        elements.betsList = document.getElementById('bets-list');
                        elements.historyContainer = document.querySelector('.history-container');
                        
                        // Check critical elements
                        if (!elements.wheelInner || !elements.rouletteBall) {
                            app.log('Roulette', 'Wheel elements not found, creating them', true);
                            
                            // Try to find the container and create wheel if possible
                            const container = document.querySelector('.roulette-wheel');
                            if (container) {
                                createWheel(container);
                            }
                        }
                        
                        // Check for bet controls and create if needed
                        if (!elements.betTypeSelect || !elements.placeBetBtn) {
                            app.log('Roulette', 'Betting controls not found, creating them', true);
                            createBettingControls();
                        }
                        
                        // Create timer display if not found
                        if (!elements.timerDisplay) {
                            app.log('Roulette', 'Creating timer display', true);
                            createTimerDisplay();
                        }
                        
                        // Create results display if not found
                        if (!elements.rouletteResult) {
                            app.log('Roulette', 'Creating results display', true);
                            createResultsDisplay();
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('Roulette', `Error finding DOM elements: ${error.message}`, true);
                    reject(error);
                }
            });
        };
        
        /**
         * Create wheel and its elements if they don't exist
         */
        const createWheel = function(container) {
            try {
                if (!container) {
                    app.log('Roulette', 'Cannot create wheel: container not found', true);
                    return;
                }
                
                // Create wheel structure
                const wheelHtml = `
                    <div class="wheel-outer">
                        <div id="wheel-inner" class="wheel-inner"></div>
                        <div id="roulette-ball" class="ball"></div>
                    </div>
                `;
                
                container.innerHTML = wheelHtml;
                elements.wheelInner = document.getElementById('wheel-inner');
                elements.rouletteBall = document.getElementById('roulette-ball');
                
                app.log('Roulette', 'Wheel created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating wheel: ${error.message}`, true);
            }
        };
        
        /**
         * Create betting controls if they don't exist
         */
        const createBettingControls = function() {
            try {
                const container = elements.gameContainer || document.querySelector('.roulette-container');
                if (!container) {
                    app.log('Roulette', 'Cannot create betting controls: container not found', true);
                    return;
                }
                
                // Create betting controls HTML
                const controlsHtml = `
                    <div class="betting-controls">
                        <div class="bet-section">
                            <div class="bet-amount">
                                <label for="roulette-bet">Bet Amount:</label>
                                <input type="number" id="roulette-bet" min="1" value="10">
                            </div>
                            
                            <div class="bet-type">
                                <label for="roulette-bet-type">Bet Type:</label>
                                <select id="roulette-bet-type">
                                    <option value="color">Color</option>
                                    <option value="number">Number</option>
                                    <option value="odd-even">Odd/Even</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="bet-color-container" class="bet-option-container">
                            <button class="color-btn red-btn" data-color="red">Red</button>
                            <button class="color-btn black-btn" data-color="black">Black</button>
                            <button class="color-btn green-btn" data-color="green">Green (0)</button>
                        </div>
                        
                        <div id="bet-number-container" class="bet-option-container hidden">
                            <label for="roulette-number">Choose Number (0-36):</label>
                            <input type="number" id="roulette-number" min="0" max="36" value="0">
                        </div>
                        
                        <div id="bet-odd-even-container" class="bet-option-container hidden">
                            <button class="odd-even-btn" data-type="odd">Odd</button>
                            <button class="odd-even-btn" data-type="even">Even</button>
                        </div>
                        
                        <div class="betting-buttons">
                            <button id="place-bet-btn" class="action-btn">Place Bet</button>
                            <button id="clear-bet-btn" class="action-btn">Clear Bet</button>
                        </div>
                    </div>
                    
                    <div id="bets-list" class="active-bets">
                        <h3>Your Active Bets</h3>
                        <div class="bets-container"></div>
                    </div>
                `;
                
                // Create a wrapper and insert it into the container
                const controlsWrapper = document.createElement('div');
                controlsWrapper.className = 'betting-controls-wrapper';
                controlsWrapper.innerHTML = controlsHtml;
                
                // Insert after the wheel or at the beginning
                const wheel = container.querySelector('.roulette-wheel');
                if (wheel) {
                    wheel.after(controlsWrapper);
                } else {
                    container.prepend(controlsWrapper);
                }
                
                // Update element references
                elements.placeBetBtn = document.getElementById('place-bet-btn');
                elements.clearBetBtn = document.getElementById('clear-bet-btn');
                elements.rouletteBet = document.getElementById('roulette-bet');
                elements.betTypeSelect = document.getElementById('roulette-bet-type');
                elements.betColorContainer = document.getElementById('bet-color-container');
                elements.betNumberContainer = document.getElementById('bet-number-container');
                elements.betOddEvenContainer = document.getElementById('bet-odd-even-container');
                elements.rouletteNumber = document.getElementById('roulette-number');
                elements.colorBtns = document.querySelectorAll('.color-btn');
                elements.oddEvenBtns = document.querySelectorAll('.odd-even-btn');
                elements.betsList = document.getElementById('bets-list');
                
                app.log('Roulette', 'Betting controls created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating betting controls: ${error.message}`, true);
            }
        };
        
        /**
         * Create timer display if it doesn't exist
         */
        const createTimerDisplay = function() {
            try {
                const container = elements.gameContainer || document.querySelector('.roulette-container');
                if (!container) {
                    app.log('Roulette', 'Cannot create timer display: container not found', true);
                    return;
                }
                
                // Create timer display HTML
                const timerHtml = `
                    <div class="timer-container">
                        <div class="timer-status">
                            <div class="game-phase">
                                <span>Status: </span>
                                <span id="game-phase-display">Waiting for next round</span>
                            </div>
                            <div class="time-remaining">
                                <span>Time: </span>
                                <span id="timer-display">00:00</span>
                            </div>
                            <div class="next-spin">
                                <span>Next spin: </span>
                                <span id="next-spin-time">--:--</span>
                            </div>
                        </div>
                    </div>
                `;
                
                // Create a wrapper and insert it into the container
                const timerWrapper = document.createElement('div');
                timerWrapper.className = 'timer-wrapper';
                timerWrapper.innerHTML = timerHtml;
                
                // Insert at the top of the container
                container.prepend(timerWrapper);
                
                // Update element references
                elements.timerDisplay = document.getElementById('timer-display');
                elements.nextSpinTime = document.getElementById('next-spin-time');
                elements.gamePhaseDisplay = document.getElementById('game-phase-display');
                
                app.log('Roulette', 'Timer display created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating timer display: ${error.message}`, true);
            }
        };
        
        /**
         * Create results display if it doesn't exist
         */
        const createResultsDisplay = function() {
            try {
                const container = elements.gameContainer || document.querySelector('.roulette-container');
                if (!container) {
                    app.log('Roulette', 'Cannot create results display: container not found', true);
                    return;
                }
                
                // Create results display HTML
                const resultsHtml = `
                    <div id="roulette-result" class="result"></div>
                `;
                
                // Find appropriate location to insert
                const bettingControls = container.querySelector('.betting-controls-wrapper');
                const resultsElement = document.createElement('div');
                resultsElement.className = 'results-container';
                resultsElement.innerHTML = resultsHtml;
                
                if (bettingControls) {
                    bettingControls.after(resultsElement);
                } else {
                    const wheel = container.querySelector('.roulette-wheel');
                    if (wheel) {
                        wheel.after(resultsElement);
                    } else {
                        container.appendChild(resultsElement);
                    }
                }
                
                // Update element reference
                elements.rouletteResult = document.getElementById('roulette-result');
                
                app.log('Roulette', 'Results display created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating results display: ${error.message}`, true);
            }
        };
        
        /**
         * Create history container if it doesn't exist
         */
        const createHistoryContainer = function() {
            try {
                const container = elements.gameContainer || document.querySelector('.roulette-container');
                if (!container) {
                    app.log('Roulette', 'Cannot create history container: container not found', true);
                    return;
                }
                
                // Check if history container already exists
                if (elements.historyContainer) {
                    return;
                }
                
                // Create history HTML
                const historyHtml = `
                    <div class="history-section">
                        <h3>Previous Results</h3>
                        <div class="history-container"></div>
                    </div>
                `;
                
                // Create element and add to container
                const historyElement = document.createElement('div');
                historyElement.className = 'history-wrapper';
                historyElement.innerHTML = historyHtml;
                
                // Find appropriate location
                const resultsContainer = container.querySelector('.results-container');
                if (resultsContainer) {
                    resultsContainer.after(historyElement);
                } else {
                    container.appendChild(historyElement);
                }
                
                // Update element reference
                elements.historyContainer = historyElement.querySelector('.history-container');
                
                app.log('Roulette', 'History container created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating history container: ${error.message}`, true);
            }
        };
        
        /**
         * Set up wheel with numbers
         */
        const setupWheel = function() {
            try {
                if (!elements.wheelInner) {
                    app.log('Roulette', 'Cannot set up wheel: wheel-inner element not found', true);
                    return;
                }
                
                // Clear current wheel
                elements.wheelInner.innerHTML = '';
                
                // Create number cells
                const fragment = document.createDocumentFragment();
                
                numbers.forEach((number, index) => {
                    // Calculate position on the wheel
                    const angle = (index * 360 / numbers.length);
                    const color = numberColors[number.toString()];
                    
                    // Create number element
                    const numberElement = document.createElement('div');
                    numberElement.className = `wheel-number ${color}`;
                    numberElement.textContent = number;
                    numberElement.style.transform = `rotate(${angle}deg) translateY(-110px)`;
                    
                    fragment.appendChild(numberElement);
                });
                
                elements.wheelInner.appendChild(fragment);
                
                // Position the ball
                if (elements.rouletteBall) {
                    elements.rouletteBall.style.transform = 'rotate(0deg) translateY(-90px)';
                }
                
                app.log('Roulette', 'Wheel set up successfully');
            } catch (error) {
                app.log('Roulette', `Error setting up wheel: ${error.message}`, true);
            }
        };
        
        /**
         * Set up event listeners
         */
        const setupEventListeners = function() {
            try {
                // Bet type selector
                if (elements.betTypeSelect) {
                    elements.betTypeSelect.addEventListener('change', changeBetType);
                }
                
                // Color selection buttons
                if (elements.colorBtns && elements.colorBtns.length > 0) {
                    elements.colorBtns.forEach(btn => {
                        btn.addEventListener('click', selectColor);
                    });
                }
                
                // Odd/Even selection buttons
                if (elements.oddEvenBtns && elements.oddEvenBtns.length > 0) {
                    elements.oddEvenBtns.forEach(btn => {
                        btn.addEventListener('click', selectOddEven);
                    });
                }
                
                // Place bet button
                if (elements.placeBetBtn) {
                    const newPlaceBetBtn = elements.placeBetBtn.cloneNode(true);
                    if (elements.placeBetBtn.parentNode) {
                        elements.placeBetBtn.parentNode.replaceChild(newPlaceBetBtn, elements.placeBetBtn);
                    }
                    elements.placeBetBtn = newPlaceBetBtn;
                    elements.placeBetBtn.addEventListener('click', placeBet);
                }
                
                // Clear bet button
                if (elements.clearBetBtn) {
                    const newClearBetBtn = elements.clearBetBtn.cloneNode(true);
                    if (elements.clearBetBtn.parentNode) {
                        elements.clearBetBtn.parentNode.replaceChild(newClearBetBtn, elements.clearBetBtn);
                    }
                    elements.clearBetBtn = newClearBetBtn;
                    elements.clearBetBtn.addEventListener('click', clearBet);
                }
                
                app.log('Roulette', 'Event listeners set up successfully');
            } catch (error) {
                app.log('Roulette', `Error setting up event listeners: ${error.message}`, true);
            }
        };
        
        /**
         * Change bet type handler
         */
        const changeBetType = function() {
            try {
                if (!elements.betTypeSelect) return;
                
                state.selectedBetType = elements.betTypeSelect.value;
                
                // Hide all containers
                if (elements.betColorContainer) {
                    elements.betColorContainer.classList.add('hidden');
                }
                
                if (elements.betNumberContainer) {
                    elements.betNumberContainer.classList.add('hidden');
                }
                
                if (elements.betOddEvenContainer) {
                    elements.betOddEvenContainer.classList.add('hidden');
                }
                
                // Show appropriate container
                switch (state.selectedBetType) {
                    case 'color':
                        if (elements.betColorContainer) {
                            elements.betColorContainer.classList.remove('hidden');
                        }
                        break;
                    case 'number':
                        if (elements.betNumberContainer) {
                            elements.betNumberContainer.classList.remove('hidden');
                        }
                        break;
                    case 'odd-even':
                        if (elements.betOddEvenContainer) {
                            elements.betOddEvenContainer.classList.remove('hidden');
                        }
                        break;
                }
                
                // Reset selections
                state.selectedColor = null;
                state.selectedOddEven = null;
                
                if (elements.colorBtns) {
                    elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
                }
                
                if (elements.oddEvenBtns) {
                    elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
                }
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
            } catch (error) {
                app.log('Roulette', `Error changing bet type: ${error.message}`, true);
            }
        };
        
        /**
         * Select color handler
         */
        const selectColor = function(event) {
            try {
                // Remove selection from all color buttons
                if (elements.colorBtns) {
                    elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
                }
                
                // Add selection to the clicked button
                event.currentTarget.classList.add('selected');
                
                // Save selected color
                state.selectedColor = event.currentTarget.getAttribute('data-color');
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
            } catch (error) {
                app.log('Roulette', `Error selecting color: ${error.message}`, true);
            }
        };
        
        /**
         * Select odd/even handler
         */
        const selectOddEven = function(event) {
            try {
                // Remove selection from all odd/even buttons
                if (elements.oddEvenBtns) {
                    elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
                }
                
                // Add selection to the clicked button
                event.currentTarget.classList.add('selected');
                
                // Save selected type
                state.selectedOddEven = event.currentTarget.getAttribute('data-type');
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
            } catch (error) {
                app.log('Roulette', `Error selecting odd/even: ${error.message}`, true);
            }
        };
        
        /**
       * Place bet handler
       */
      const placeBet = function() {
        try {
            // Check if betting is allowed
            if (state.currentPhase !== 'betting') {
                window.casinoApp.showNotification('Betting is currently closed. Please wait for the next round.');
                return;
            }
            
            // Check casino app
            if (!ensureCasinoApp()) {
                return;
            }
            
            // Get bet amount
            if (!elements.rouletteBet) {
                app.log('Roulette', 'Bet input not found', true);
                return;
            }
            
            const betAmount = parseInt(elements.rouletteBet.value);
            
            // Validate bet amount
            if (isNaN(betAmount) || betAmount <= 0) {
                window.casinoApp.showNotification('Please enter a valid bet amount');
                return;
            }
            
            // Check if user has enough funds
            if (window.GreenLightApp && window.GreenLightApp.user && 
                betAmount > window.GreenLightApp.user.balance) {
                window.casinoApp.showNotification('Insufficient funds for this bet');
                return;
            }
            
            // Validate bet selection
            let betTarget = null;
            let betDescription = '';
            
            switch (state.selectedBetType) {
                case 'color':
                    if (!state.selectedColor) {
                        window.casinoApp.showNotification('Please select a color');
                        return;
                    }
                    betTarget = state.selectedColor;
                    betDescription = capitalizeFirstLetter(state.selectedColor);
                    break;
                    
                case 'number':
                    if (!elements.rouletteNumber) {
                        window.casinoApp.showNotification('Number selection is not available');
                        return;
                    }
                    
                    const number = parseInt(elements.rouletteNumber.value);
                    if (isNaN(number) || number < 0 || number > 36) {
                        window.casinoApp.showNotification('Please enter a number between 0 and 36');
                        return;
                    }
                    
                    betTarget = number;
                    betDescription = `Number ${number}`;
                    break;
                    
                case 'odd-even':
                    if (!state.selectedOddEven) {
                        window.casinoApp.showNotification('Please select odd or even');
                        return;
                    }
                    betTarget = state.selectedOddEven;
                    betDescription = capitalizeFirstLetter(state.selectedOddEven);
                    break;
                    
                default:
                    window.casinoApp.showNotification('Please select a valid bet type');
                    return;
            }
            
            // Create bet object
            const bet = {
                id: Date.now() + Math.random().toString(36).substr(2, 5),
                amount: betAmount,
                type: state.selectedBetType,
                target: betTarget,
                description: betDescription,
                userId: window.GreenLightApp?.user?.telegramId || 'guest'
            };
            
            // Add to active bets
            state.activeBets.push(bet);
            
            // Update UI
            updateActiveBets();
            
            // Process bet transaction
            window.casinoApp.processGameResult(
                'roulette',
                betAmount,
                'bet',
                0,
                {
                    betType: state.selectedBetType,
                    betTarget: betTarget
                }
            );
            
            // Clear bet inputs (optional)
            clearBet();
            
            // Tactile feedback
            if (window.casinoApp.provideTactileFeedback) {
                window.casinoApp.provideTactileFeedback('medium');
            }
            
            app.log('Roulette', `Bet placed: ${betAmount} on ${betDescription}`);
            
            // Show notification
            window.casinoApp.showNotification(`Bet placed: ${betAmount} on ${betDescription}`);
            
        } catch (error) {
            app.log('Roulette', `Error placing bet: ${error.message}`, true);
        }
    };
    
    /**
     * Clear bet inputs
     */
    const clearBet = function() {
        try {
            // Reset selections
            state.selectedColor = null;
            state.selectedOddEven = null;
            
            // Reset UI elements
            if (elements.colorBtns) {
                elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
            }
            
            if (elements.oddEvenBtns) {
                elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
            }
            
            // Reset number input
            if (elements.rouletteNumber) {
                elements.rouletteNumber.value = 0;
            }
            
            // Tactile feedback
            if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                window.casinoApp.provideTactileFeedback('light');
            }
            
        } catch (error) {
            app.log('Roulette', `Error clearing bet: ${error.message}`, true);
        }
    };
    
    /**
     * Update active bets display
     */
    const updateActiveBets = function() {
        try {
            if (!elements.betsList) return;
            
            const betsContainer = elements.betsList.querySelector('.bets-container');
            if (!betsContainer) return;
            
            // Clear container
            betsContainer.innerHTML = '';
            
            // Check if there are active bets
            if (state.activeBets.length === 0) {
                betsContainer.innerHTML = '<div class="no-bets">No active bets</div>';
                return;
            }
            
            // Create fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Add each bet
            state.activeBets.forEach(bet => {
                const betElement = document.createElement('div');
                betElement.className = 'bet-item';
                
                // Determine icon based on bet type
                let icon = '🎯';
                switch (bet.type) {
                    case 'color':
                        if (bet.target === 'red') icon = '🔴';
                        else if (bet.target === 'black') icon = '⚫';
                        else if (bet.target === 'green') icon = '🟢';
                        break;
                    case 'odd-even':
                        icon = bet.target === 'odd' ? '1️⃣' : '2️⃣';
                        break;
                    case 'number':
                        icon = '🔢';
                        break;
                }
                
                betElement.innerHTML = `
                    <div class="bet-info">
                        <span class="bet-icon">${icon}</span>
                        <span class="bet-description">${bet.description}</span>
                    </div>
                    <div class="bet-amount">${bet.amount} ⭐</div>
                `;
                
                fragment.appendChild(betElement);
            });
            
            betsContainer.appendChild(fragment);
            
        } catch (error) {
            app.log('Roulette', `Error updating active bets: ${error.message}`, true);
        }
    };
    
    /**
     * Start the continuous game cycle
     */
    const startGameCycle = function() {
        try {
            app.log('Roulette', 'Starting continuous game cycle');
            
            // Schedule the first round
            scheduleBettingPhase();
            
            // Set up game interval for updating the timer
            state.gameInterval = setInterval(updateGameTimer, 1000);
            
        } catch (error) {
            app.log('Roulette', `Error starting game cycle: ${error.message}`, true);
        }
    };
    
    /**
     * Schedule the betting phase
     */
    const scheduleBettingPhase = function() {
        try {
            // Set the current phase
            state.currentPhase = 'betting';
            
            // Generate a random betting phase duration between min and max
            const bettingDuration = getRandomInRange(
                config.bettingPhaseDuration.min, 
                config.bettingPhaseDuration.max
            );
            
            // Calculate when the next spin will happen
            const nextSpinTimestamp = Date.now() + (bettingDuration * 1000);
            state.nextSpinTimestamp = nextSpinTimestamp;
            
            // Set time remaining
            state.timeRemaining = bettingDuration;
            
            // Update UI
            updatePhaseDisplay('Betting Open');
            updateNextSpinTime(nextSpinTimestamp);
            
            // Schedule the spinning phase
            setTimeout(() => {
                scheduleSpinningPhase();
            }, bettingDuration * 1000);
            
            app.log('Roulette', `Betting phase started, duration: ${bettingDuration}s, next spin at: ${new Date(nextSpinTimestamp).toLocaleTimeString()}`);
            
        } catch (error) {
            app.log('Roulette', `Error scheduling betting phase: ${error.message}`, true);
            
            // Emergency recovery - try again in 5 seconds
            setTimeout(scheduleBettingPhase, 5000);
        }
    };
    
    /**
     * Schedule the spinning phase
     */
    const scheduleSpinningPhase = function() {
        try {
            // Set the current phase
            state.currentPhase = 'spinning';
            
            // Update UI
            updatePhaseDisplay('Wheel Spinning');
            
            // Disable betting controls
            disableBettingControls();
            
            // Spin the wheel
            spinWheel()
                .then(result => {
                    // Process the result
                    processSpinResult(result);
                    
                    // Move to results phase
                    setTimeout(() => {
                        scheduleResultsPhase();
                    }, 1000);
                })
                .catch(error => {
                    app.log('Roulette', `Error during wheel spin: ${error.message}`, true);
                    
                    // Emergency recovery - move to results with a random result
                    const emergencyResult = numbers[Math.floor(Math.random() * numbers.length)];
                    processSpinResult(emergencyResult);
                    setTimeout(() => {
                        scheduleResultsPhase();
                    }, 1000);
                });
            
        } catch (error) {
            app.log('Roulette', `Error scheduling spinning phase: ${error.message}`, true);
            
            // Emergency recovery - go directly to results phase
            setTimeout(() => {
                scheduleResultsPhase();
            }, 2000);
        }
    };
    
    /**
     * Schedule the results phase
     */
    const scheduleResultsPhase = function() {
        try {
            // Set the current phase
            state.currentPhase = 'results';
            
            // Update UI
            updatePhaseDisplay('Showing Results');
            
            // Show results for a set duration
            setTimeout(() => {
                // Start a new round
                scheduleBettingPhase();
                
                // Reset the wheel position with a delay
                setTimeout(() => {
                    resetWheel();
                }, 1000);
                
                // Enable betting controls
                enableBettingControls();
                
            }, config.resultsPhaseDuration * 1000);
            
        } catch (error) {
            app.log('Roulette', `Error scheduling results phase: ${error.message}`, true);
            
            // Emergency recovery - start a new round
            setTimeout(scheduleBettingPhase, 5000);
        }
    };
    
    /**
     * Update the game timer every second
     */
    const updateGameTimer = function() {
        try {
            if (state.currentPhase === 'betting') {
                // Decrement time remaining
                state.timeRemaining = Math.max(0, state.timeRemaining - 1);
                
                // Update timer display
                updateTimerDisplay(state.timeRemaining);
                
                // Flash the timer when time is running out (less than 5 seconds)
                if (state.timeRemaining <= 5 && elements.timerDisplay) {
                    elements.timerDisplay.classList.toggle('flashing');
                } else if (elements.timerDisplay) {
                    elements.timerDisplay.classList.remove('flashing');
                }
            }
        } catch (error) {
            app.log('Roulette', `Error updating game timer: ${error.message}`, true);
        }
    };
    
    /**
     * Update the timer display
     */
    const updateTimerDisplay = function(seconds) {
        try {
            if (!elements.timerDisplay) return;
            
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            elements.timerDisplay.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            
        } catch (error) {
            app.log('Roulette', `Error updating timer display: ${error.message}`, true);
        }
    };
    
    /**
     * Update the next spin time display
     */
    const updateNextSpinTime = function(timestamp) {
        try {
            if (!elements.nextSpinTime) return;
            
            const date = new Date(timestamp);
            elements.nextSpinTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
        } catch (error) {
            app.log('Roulette', `Error updating next spin time: ${error.message}`, true);
        }
    };
    
    /**
     * Update the phase display
     */
    const updatePhaseDisplay = function(phase) {
        try {
            const phaseDisplay = document.getElementById('game-phase-display');
            if (!phaseDisplay) return;
            
            phaseDisplay.textContent = phase;
            
            // Add appropriate styling based on the phase
            phaseDisplay.className = '';
            
            switch (phase) {
                case 'Betting Open':
                    phaseDisplay.classList.add('phase-betting');
                    break;
                case 'Wheel Spinning':
                    phaseDisplay.classList.add('phase-spinning');
                    break;
                case 'Showing Results':
                    phaseDisplay.classList.add('phase-results');
                    break;
                default:
                    phaseDisplay.classList.add('phase-waiting');
            }
            
        } catch (error) {
            app.log('Roulette', `Error updating phase display: ${error.message}`, true);
        }
    };
    
    /**
     * Enable betting controls
     */
    const enableBettingControls = function() {
        try {
            if (elements.placeBetBtn) {
                elements.placeBetBtn.disabled = false;
                elements.placeBetBtn.classList.remove('disabled');
            }
            
            if (elements.clearBetBtn) {
                elements.clearBetBtn.disabled = false;
                elements.clearBetBtn.classList.remove('disabled');
            }
            
            if (elements.betTypeSelect) {
                elements.betTypeSelect.disabled = false;
            }
            
            if (elements.rouletteBet) {
                elements.rouletteBet.disabled = false;
            }
            
            if (elements.rouletteNumber) {
                elements.rouletteNumber.disabled = false;
            }
            
            // Enable color buttons
            if (elements.colorBtns) {
                elements.colorBtns.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('disabled');
                });
            }
            
            // Enable odd/even buttons
            if (elements.oddEvenBtns) {
                elements.oddEvenBtns.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('disabled');
                });
            }
            
        } catch (error) {
            app.log('Roulette', `Error enabling betting controls: ${error.message}`, true);
        }
    };
    
    /**
     * Disable betting controls
     */
    const disableBettingControls = function() {
        try {
            if (elements.placeBetBtn) {
                elements.placeBetBtn.disabled = true;
                elements.placeBetBtn.classList.add('disabled');
            }
            
            if (elements.clearBetBtn) {
                elements.clearBetBtn.disabled = true;
                elements.clearBetBtn.classList.add('disabled');
            }
            
            if (elements.betTypeSelect) {
                elements.betTypeSelect.disabled = true;
            }
            
            if (elements.rouletteBet) {
                elements.rouletteBet.disabled = true;
            }
            
            if (elements.rouletteNumber) {
                elements.rouletteNumber.disabled = true;
            }
            
            // Disable color buttons
            if (elements.colorBtns) {
                elements.colorBtns.forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                });
            }
            
            // Disable odd/even buttons
            if (elements.oddEvenBtns) {
                elements.oddEvenBtns.forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                });
            }
            
        } catch (error) {
            app.log('Roulette', `Error disabling betting controls: ${error.message}`, true);
        }
    };
    
    /**
     * Spin the wheel with animation
     * Returns a Promise that resolves with the result number
     */
    const spinWheel = function() {
        return new Promise((resolve, reject) => {
            try {
                app.log('Roulette', 'Spinning wheel');
                
                // Check wheel elements
                if (!elements.wheelInner || !elements.rouletteBall) {
                    app.log('Roulette', 'Wheel elements not found', true);
                    reject(new Error('Wheel elements not found'));
                    return;
                }
                
                // Get a random result from the wheel
                const randomIndex = Math.floor(Math.random() * numbers.length);
                const winningNumber = numbers[randomIndex];
                
                // Get the required rotations for the animation
                const rotations = 3 + Math.floor(Math.random() * 3); // 3-5 full rotations
                const finalAngle = rotations * 360 + (randomIndex * 360 / numbers.length);
                
                // Animate the wheel and the ball
                elements.wheelInner.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                elements.rouletteBall.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                
                elements.wheelInner.style.transform = `rotate(${-finalAngle}deg)`;
                elements.rouletteBall.style.transform = `rotate(${finalAngle}deg) translateY(-90px)`;
                
                // Sound effect if available
                if (window.casinoApp && window.casinoApp.playSound) {
                    window.casinoApp.playSound('roulette-spin');
                }
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Set timeouts for animation completion and result
                let spinTimeout, resultTimeout;
                
                // Set a timeout for the animation
                spinTimeout = setTimeout(() => {
                    app.log('Roulette', 'Spin animation timeout', true);
                    if (resultTimeout) clearTimeout(resultTimeout);
                    resolve(winningNumber);
                }, 5000); // 5 seconds max for the animation
                
                // Set a timeout for the result
                resultTimeout = setTimeout(() => {
                    if (spinTimeout) clearTimeout(spinTimeout);
                    
                    app.log('Roulette', `Spin complete! Result: ${winningNumber}`);
                    
                    // Save the result
                    state.lastResult = {
                        number: winningNumber,
                        color: numberColors[winningNumber.toString()],
                        isOdd: winningNumber !== 0 && winningNumber % 2 === 1,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Add to history
                    addToHistory(state.lastResult);
                    
                    // Resolve with the winning number
                    resolve(winningNumber);
                    
                }, config.spinningPhaseDuration * 1000 - 500); // Just before the end of the spinning phase
                
            } catch (error) {
                app.log('Roulette', `Error spinning wheel: ${error.message}`, true);
                reject(error);
            }
        });
    };
    
    /**
     * Process the spin result and determine winners
     */
    const processSpinResult = function(resultNumber) {
        try {
            if (!state.lastResult) {
                app.log('Roulette', 'No result to process', true);
                return;
            }
            
            app.log('Roulette', `Processing result: ${resultNumber}, color: ${state.lastResult.color}`);
            
            // Display the result
            displayResult(resultNumber);
            
            // Process each active bet
            state.activeBets.forEach(bet => {
                let isWin = false;
                let multiplier = 1;
                
                // Check if the bet is a winner
                switch (bet.type) {
                    case 'color':
                        isWin = bet.target === state.lastResult.color;
                        multiplier = bet.target === 'green' ? 36 : 2; // Green (0) pays 36:1, red/black pays 2:1
                        break;
                        
                    case 'number':
                        isWin = parseInt(bet.target) === resultNumber;
                        multiplier = 36; // Straight up bet pays 36:1
                        break;
                        
                    case 'odd-even':
                        // 0 is neither odd nor even in roulette rules
                        if (resultNumber === 0) {
                            isWin = false;
                        } else {
                            isWin = (bet.target === 'odd' && state.lastResult.isOdd) || 
                                    (bet.target === 'even' && !state.lastResult.isOdd);
                        }
                        multiplier = 2; // Odd/Even pays 2:1
                        break;
                }
                
                // Calculate win amount
                const winAmount = isWin ? bet.amount * multiplier : 0;
                
                // Process the result with the server
                if (window.casinoApp) {
                    window.casinoApp.processGameResult(
                        'roulette',
                        0, // No additional bet
                        isWin ? 'win' : 'lose',
                        winAmount,
                        {
                            betType: bet.type,
                            betTarget: bet.target,
                            resultNumber: resultNumber,
                            resultColor: state.lastResult.color
                        }
                    ).catch(err => {
                        app.log('Roulette', `Error processing game result: ${err.message}`, true);
                    });
                }
                
                // Display individual bet results
                displayBetResult(bet, isWin, winAmount);
            });
            
            // Clear active bets for next round
            state.activeBets = [];
            updateActiveBets();
            
        } catch (error) {
            app.log('Roulette', `Error processing result: ${error.message}`, true);
        }
    };
    
    /**
     * Add result to history
     */
    const addToHistory = function(result) {
        try {
            // Add to the beginning of the array
            state.lastResults.unshift(result);
            
            // Limit the history size
            if (state.lastResults.length > config.maxHistory) {
                state.lastResults = state.lastResults.slice(0, config.maxHistory);
            }
            
            // Update history display
            updateHistoryDisplay();
            
        } catch (error) {
            app.log('Roulette', `Error adding to history: ${error.message}`, true);
        }
    };
    
    /**
     * Update history display
     */
    const updateHistoryDisplay = function() {
        try {
            const historyContainer = document.querySelector('.history-container');
            if (!historyContainer) return;
            
            // Clear container
            historyContainer.innerHTML = '';
            
            // Create fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Add each result
            state.lastResults.forEach(result => {
                const resultElement = document.createElement('div');
                resultElement.className = `history-item ${result.color}`;
                resultElement.textContent = result.number;
                
                fragment.appendChild(resultElement);
            });
            
            historyContainer.appendChild(fragment);
            
        } catch (error) {
            app.log('Roulette', `Error updating history display: ${error.message}`, true);
        }
    };
    
    /**
     * Display the spin result
     */
    const displayResult = function(resultNumber) {
        try {
            if (!elements.rouletteResult) return;
            
            const result = state.lastResult;
            
            // Create result HTML
            let resultHtml = '';
            
            // Add appropriate icon based on color
            let resultIcon = '⚫';
            if (result.color === 'red') {
                resultIcon = '🔴';
            } else if (result.color === 'green') {
                resultIcon = '🟢';
            }
            
            resultHtml = `
                <div class="result-icon">${resultIcon}</div>
                <div class="result-number">${resultNumber}</div>
                <div class="result-color">${capitalizeFirstLetter(result.color)}</div>
                <div class="result-parity">${resultNumber === 0 ? 'Zero' : (result.isOdd ? 'Odd' : 'Even')}</div>
            `;
            
            // Update the result element
            elements.rouletteResult.innerHTML = resultHtml;
            elements.rouletteResult.className = `result ${result.color}`;
            elements.rouletteResult.style.display = 'block';
            
            // Animation effect
            elements.rouletteResult.classList.add('pulse');
            setTimeout(() => {
                if (elements.rouletteResult) {
                    elements.rouletteResult.classList.remove('pulse');
                }
            }, 1000);
            
        } catch (error) {
            app.log('Roulette', `Error displaying result: ${error.message}`, true);
        }
    };
    
    /**
     * Display individual bet result
     */
    const displayBetResult = function(bet, isWin, winAmount) {
        try {
            // Find the bet element in the list
            const betsContainer = elements.betsList?.querySelector('.bets-container');
            if (!betsContainer) return;
            
            // Create a result notification
            const resultElement = document.createElement('div');
            resultElement.className = `bet-result ${isWin ? 'win' : 'lose'}`;
            
            resultElement.innerHTML = `
                <div class="bet-result-info">
                    <span class="bet-description">${bet.description}</span>
                    <span class="bet-amount">${bet.amount} ⭐</span>
                </div>
                <div class="bet-result-outcome">
                    ${isWin ? 
                        `<span class="win-icon">🎉</span> <span class="win-amount">+${winAmount} ⭐</span>` : 
                        '<span class="lose-icon">❌</span>'}
                </div>
            `;
            
            // Add to the container
            betsContainer.appendChild(resultElement);
            
            // Animate the result
            resultElement.classList.add('animate-in');
            
            // Tactile feedback
            if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                if (isWin) {
                    window.casinoApp.provideTactileFeedback('success');
                } else {
                    window.casinoApp.provideTactileFeedback('warning');
                }
            }
            
        } catch (error) {
            app.log('Roulette', `Error displaying bet result: ${error.message}`, true);
        }
    };
    
    /**
     * Reset wheel position
     */
    const resetWheel = function() {
        try {
            if (!elements.wheelInner || !elements.rouletteBall) return;
            
            // Remove transition temporarily
            elements.wheelInner.style.transition = 'none';
            elements.rouletteBall.style.transition = 'none';
            
            // Reset positions
            elements.wheelInner.style.transform = 'rotate(0deg)';
            elements.rouletteBall.style.transform = 'rotate(0deg) translateY(-90px)';
            
            // Force reflow to apply changes immediately
            void elements.wheelInner.offsetWidth;
            void elements.rouletteBall.offsetWidth;
            
            // Restore transition
            setTimeout(() => {
                if (elements.wheelInner && elements.rouletteBall) {
                    elements.wheelInner.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    elements.rouletteBall.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                }
            }, 50);
            
        } catch (error) {
            app.log('Roulette', `Error resetting wheel: ${error.message}`, true);
        }
    };
    
    /**
     * Generate a random number in a range (inclusive)
     */
    const getRandomInRange = function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    
    /**
     * Capitalize the first letter of a string
     */
    const capitalizeFirstLetter = function(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    
   /**
     * Ensure casinoApp exists
     */
   const ensureCasinoApp = function() {
    if (window.casinoApp) return true;
    
    // Create minimal casinoApp implementation if missing
    app.log('Roulette', 'casinoApp not found, creating temporary implementation', true);
    window.casinoApp = {
        showNotification: function(message) {
            alert(message);
        },
        provideTactileFeedback: function() {
            // Vibration stub
        },
        processGameResult: function(gameType, bet, result, win, data) {
            app.log('Roulette', `Game: ${gameType}, Bet: ${bet}, Result: ${result}, Win: ${win}`, false);
            return Promise.resolve({success: true});
        },
        playSound: function(soundName) {
            // Sound stub
        }
    };
    
    return true;
};

/**
 * Add game styles if needed
 */
const addGameStyles = function() {
    // Check if styles already exist
    if (document.getElementById('roulette-styles')) return;
    
    try {
        // Create style element
        const styleElement = document.createElement('style');
        styleElement.id = 'roulette-styles';
        
        // Set CSS content
        styleElement.textContent = `
            /* Roulette container */
            .roulette-container {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                padding: 1.5rem;
                max-width: 800px;
                margin: 0 auto;
            }
            
            /* Timer area */
            .timer-container {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 1rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 1rem;
            }
            
            .timer-status {
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            
            .timer-status > div {
                padding: 0.5rem;
                border-radius: 4px;
                background: rgba(0, 0, 0, 0.1);
            }
            
            #game-phase-display {
                font-weight: bold;
            }
            
            .phase-betting {
                color: #4CAF50;
            }
            
            .phase-spinning {
                color: #FF9800;
            }
            
            .phase-results {
                color: #2196F3;
            }
            
            .phase-waiting {
                color: #9E9E9E;
            }
            
            #timer-display.flashing {
                animation: flash 0.5s infinite alternate;
            }
            
            @keyframes flash {
                from { color: #FFF; }
                to { color: #FF5722; }
            }
            
            /* Wheel area */
            .roulette-wheel {
                width: 300px;
                height: 300px;
                position: relative;
                margin: 0 auto 2rem;
            }
            
            .wheel-outer {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: #333;
                display: flex;
                justify-content: center;
                align-items: center;
                border: 4px solid #FFD700;
                overflow: hidden;
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
            }
            
            .wheel-inner {
                width: 90%;
                height: 90%;
                border-radius: 50%;
                background-color: #222;
                position: relative;
                transform-origin: center;
                border: 2px solid #444;
            }
            
            .wheel-number {
                position: absolute;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 0.8rem;
                font-weight: bold;
                transform-origin: center;
                color: white;
            }
            
            .wheel-number.red {
                background: #D32F2F;
            }
            
            .wheel-number.black {
                background: #212121;
            }
            
            .wheel-number.green {
                background: #00C853;
            }
            
            .ball {
                position: absolute;
                width: 12px;
                height: 12px;
                background: white;
                border-radius: 50%;
                transform-origin: center;
                z-index: 2;
                box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
            }
            
            /* Betting controls */
            .betting-controls {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 1.5rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .bet-section {
                display: flex;
                gap: 1rem;
                margin-bottom: 1rem;
                flex-wrap: wrap;
            }
            
            .bet-amount, .bet-type {
                flex: 1;
                min-width: 150px;
            }
            
            .bet-option-container {
                display: flex;
                gap: 1rem;
                margin: 1rem 0;
                flex-wrap: wrap;
            }
            
            .bet-option-container.hidden {
                display: none;
            }
            
            .color-btn, .odd-even-btn {
                padding: 0.7rem 1.5rem;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s;
            }
            
            .color-btn.selected, .odd-even-btn.selected {
                transform: scale(1.05);
                box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            }
            
            .color-btn.disabled, .odd-even-btn.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .red-btn {
                background: #D32F2F;
                color: white;
            }
            
            .black-btn {
                background: #212121;
                color: white;
            }
            
            .green-btn {
                background: #00C853;
                color: white;
            }
            
            .betting-buttons {
                display: flex;
                gap: 1rem;
                margin-top: 1.5rem;
            }
            
            .action-btn {
                padding: 0.7rem 1.5rem;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-weight: bold;
                background: #4CAF50;
                color: white;
                flex: 1;
                transition: all 0.2s;
            }
            
            .action-btn:hover {
                background: #388E3C;
            }
            
            .action-btn.disabled, .action-btn:disabled {
                background: #9E9E9E;
                cursor: not-allowed;
            }
            
            /* Active bets */
            .active-bets {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 1.5rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .bets-container {
                margin-top: 1rem;
            }
            
            .bet-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.7rem 1rem;
                border-radius: 4px;
                background: rgba(0, 0, 0, 0.2);
                margin-bottom: 0.5rem;
            }
            
            .bet-info {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .no-bets {
                text-align: center;
                padding: 1rem;
                color: #9E9E9E;
                font-style: italic;
            }
            
            /* Results */
            .result {
                text-align: center;
                padding: 1.5rem;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.1);
                margin: 1rem 0;
            }
            
            .result.pulse {
                animation: pulse 0.5s;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .result-icon {
                font-size: 2rem;
                margin-bottom: 0.5rem;
            }
            
            .result-number {
                font-size: 2.5rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            
            .result.red {
                background: rgba(211, 47, 47, 0.2);
                border-color: #D32F2F;
            }
            
            .result.black {
                background: rgba(33, 33, 33, 0.2);
                border-color: #212121;
            }
            
            .result.green {
                background: rgba(0, 200, 83, 0.2);
                border-color: #00C853;
            }
            
            /* Bet results */
            .bet-result {
                padding: 0.7rem 1rem;
                border-radius: 4px;
                margin-bottom: 0.5rem;
                animation: fadeIn 0.5s;
            }
            
            .bet-result.win {
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid #4CAF50;
            }
            
            .bet-result.lose {
                background: rgba(244, 67, 54, 0.2);
                border: 1px solid #F44336;
            }
            
            .bet-result-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
            }
            
            .bet-result-outcome {
                text-align: right;
                font-weight: bold;
            }
            
            .win-amount {
                color: #4CAF50;
            }
            
            .animate-in {
                animation: slideIn 0.3s;
            }
            
            @keyframes slideIn {
                from { transform: translateY(-10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* History display */
            .history-section {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 1.5rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .history-container {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-top: 1rem;
            }
            
            .history-item {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
            }
            
            .history-item.red {
                background: #D32F2F;
            }
            
            .history-item.black {
                background: #212121;
            }
            
            .history-item.green {
                background: #00C853;
            }
            
            /* Responsive design */
            @media (max-width: 600px) {
                .roulette-wheel {
                    width: 250px;
                    height: 250px;
                }
                
                .wheel-number {
                    width: 25px;
                    height: 25px;
                    font-size: 0.7rem;
                }
                
                .bet-section {
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .timer-status {
                    flex-direction: column;
                }
            }
        `;
        
        // Add to document head
        document.head.appendChild(styleElement);
        
        app.log('Roulette', 'Game styles added successfully');
    } catch (error) {
        app.log('Roulette', `Error adding game styles: ${error.message}`, true);
    }
};

// Return public interface
return {
    // Main methods
    init: init,
    
    // Betting methods
    placeBet: placeBet,
    clearBet: clearBet,
    
    // Get game status
    getStatus: function() {
        return {
            initialized: state.initialized,
            initializationStarted: state.initializationStarted,
            currentPhase: state.currentPhase,
            timeRemaining: state.timeRemaining,
            activeBets: state.activeBets.length,
            lastResult: state.lastResult,
            resultsHistory: state.lastResults.length
        };
    }
};
})();

// Register the game in all formats for maximum compatibility
try {
// 1. Register through the new system
if (window.registerGame) {
    window.registerGame('rouletteGame', rouletteGame);
    app.log('Roulette', 'Game registered through new registerGame system');
}

// 2. Export to global namespace (backward compatibility)
window.rouletteGame = rouletteGame;
app.log('Roulette', 'Game exported to global namespace');

// 3. Log completion of module loading
app.log('Roulette', 'Module successfully loaded and ready for initialization');

// 4. Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!rouletteGame.getStatus().initialized && !rouletteGame.getStatus().initializationStarted) {
            app.log('Roulette', 'Starting automatic initialization');
            rouletteGame.init();
        }
    }, 500);
});

// 5. If DOM is already loaded, initialize immediately
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        if (!rouletteGame.getStatus().initialized && !rouletteGame.getStatus().initializationStarted) {
            app.log('Roulette', 'Starting automatic initialization (DOM already loaded)');
            rouletteGame.init();
        }
    }, 500);
}

} catch (error) {
app.log('Roulette', `Error registering game: ${error.message}`, true);
}
})();