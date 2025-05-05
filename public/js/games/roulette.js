/**
 * roulette.js - Optimized roulette game with improved UI
 * Version 2.0.0
 * 
 * Features:
 * - Non-blocking initialization
 * - Properly centered wheel and ball with improved animations
 * - Enhanced error handling and timeout protection
 * - Compatible with the game registration system
 * - Clean and intuitive user interface
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
    app.log('Roulette', 'Initializing roulette game module v2.0.0');
    
    // Game logic in closure for isolation
    const rouletteGame = (function() {
        // Game elements
        let elements = {
            spinWheelBtn: null,
            rouletteBet: null,
            rouletteBetType: null,
            betColorContainer: null,
            betNumberContainer: null,
            betOddEvenContainer: null,
            rouletteNumber: null,
            colorBtns: [],
            oddEvenBtns: [],
            wheelContainer: null,
            wheelOuter: null,
            wheelInner: null,
            rouletteBall: null,
            rouletteResult: null
        };
        
        // Game state
        let state = {
            isSpinning: false,
            initialized: false,
            initializationStarted: false,
            selectedBetType: 'color',
            selectedColor: null,
            selectedOddEven: null
        };
        
        // Roulette wheel configuration
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
                // Set timeout for initialization
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Find DOM elements (with availability check)
                        await findDOMElements();
                        
                        // Create game container if needed
                        createGameContainer();
                        
                        // Set up the wheel
                        setupWheel();
                        
                        // Add event listeners
                        setupEventListeners();
                        
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
         * Find DOM elements with null protection
         */
        const findDOMElements = async function() {
            // Use Promise for asynchronous behavior
            return new Promise((resolve, reject) => {
                try {
                    // Timeout to wait for DOM readiness
                    setTimeout(() => {
                        elements.spinWheelBtn = document.getElementById('spin-wheel-btn');
                        elements.rouletteBet = document.getElementById('roulette-bet');
                        elements.rouletteBetType = document.getElementById('roulette-bet-type');
                        elements.betColorContainer = document.getElementById('bet-color-container');
                        elements.betNumberContainer = document.getElementById('bet-number-container');
                        elements.betOddEvenContainer = document.getElementById('bet-odd-even-container');
                        elements.rouletteNumber = document.getElementById('roulette-number');
                        elements.colorBtns = document.querySelectorAll('.color-btn');
                        elements.oddEvenBtns = document.querySelectorAll('.odd-even-btn');
                        elements.wheelContainer = document.querySelector('.roulette-wheel');
                        elements.wheelOuter = document.querySelector('.wheel-outer');
                        elements.wheelInner = document.getElementById('wheel-inner');
                        elements.rouletteBall = document.getElementById('roulette-ball');
                        elements.rouletteResult = document.getElementById('roulette-result');
                        
                        // Check if roulette screen exists
                        const rouletteScreen = document.getElementById('roulette-screen');
                        if (rouletteScreen) {
                            elements.rouletteScreen = rouletteScreen;
                        }
                        
                        // Log found/missing critical elements
                        if (!elements.spinWheelBtn) {
                            app.log('Roulette', 'Warning: spin-wheel-btn element not found', true);
                        }
                        
                        if (!elements.wheelContainer || !elements.wheelInner) {
                            app.log('Roulette', 'Warning: wheel elements not found, will create dynamically', true);
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
         * Create game container and elements if needed
         */
        const createGameContainer = function() {
            try {
                // Check if we need to create the wheel container
                if (!elements.wheelContainer) {
                    // Find parent container (roulette screen or game area)
                    let parentContainer = elements.rouletteScreen;
                    if (!parentContainer) {
                        parentContainer = document.querySelector('.game-area');
                    }
                    if (!parentContainer) {
                        const mainContent = document.querySelector('.main-content');
                        if (mainContent) {
                            // Create the roulette screen if needed
                            const rouletteScreen = document.createElement('div');
                            rouletteScreen.id = 'roulette-screen';
                            rouletteScreen.className = 'screen';
                            
                            // Add header with back button
                            const gameHeader = document.createElement('div');
                            gameHeader.className = 'game-header';
                            gameHeader.innerHTML = `
                                <button class="back-btn">← Back</button>
                                <h2>Roulette</h2>
                            `;
                            rouletteScreen.appendChild(gameHeader);
                            
                            // Add screen to main content
                            mainContent.appendChild(rouletteScreen);
                            parentContainer = rouletteScreen;
                            elements.rouletteScreen = rouletteScreen;
                            
                            // Add back button functionality
                            const backBtn = gameHeader.querySelector('.back-btn');
                            if (backBtn) {
                                backBtn.addEventListener('click', () => {
                                    const welcomeScreen = document.getElementById('welcome-screen');
                                    if (welcomeScreen) {
                                        // Hide all screens
                                        document.querySelectorAll('.screen').forEach(screen => {
                                            screen.classList.remove('active');
                                        });
                                        // Show welcome screen
                                        welcomeScreen.classList.add('active');
                                    }
                                });
                            }
                        } else {
                            // Last resort - use body
                            parentContainer = document.body;
                        }
                    }
                    
                    // Create game container
                    const gameContainer = document.createElement('div');
                    gameContainer.className = 'roulette-container';
                    parentContainer.appendChild(gameContainer);
                    
                    // Create wheel container
                    const wheelContainer = document.createElement('div');
                    wheelContainer.className = 'roulette-wheel';
                    gameContainer.appendChild(wheelContainer);
                    elements.wheelContainer = wheelContainer;
                    
                    // Create wheel outer container
                    const wheelOuter = document.createElement('div');
                    wheelOuter.className = 'wheel-outer';
                    wheelContainer.appendChild(wheelOuter);
                    elements.wheelOuter = wheelOuter;
                    
                    // Create wheel inner and ball
                    const wheelInner = document.createElement('div');
                    wheelInner.id = 'wheel-inner';
                    wheelInner.className = 'wheel-inner';
                    wheelOuter.appendChild(wheelInner);
                    elements.wheelInner = wheelInner;
                    
                    const rouletteBall = document.createElement('div');
                    rouletteBall.id = 'roulette-ball';
                    rouletteBall.className = 'ball';
                    wheelOuter.appendChild(rouletteBall);
                    elements.rouletteBall = rouletteBall;
                    
                    // Create betting controls if not already present
                    createBettingControls(gameContainer);
                    
                    // Create result display if not already present
                    if (!elements.rouletteResult) {
                        const resultDisplay = document.createElement('div');
                        resultDisplay.id = 'roulette-result';
                        resultDisplay.className = 'result';
                        gameContainer.appendChild(resultDisplay);
                        elements.rouletteResult = resultDisplay;
                    }
                    
                    // Add custom CSS styles
                    addRouletteStyles();
                    
                    app.log('Roulette', 'Game container and elements created successfully');
                }
            } catch (error) {
                app.log('Roulette', `Error creating game container: ${error.message}`, true);
            }
        };
        
        /**
         * Create betting controls if not present
         */
        const createBettingControls = function(container) {
            if (!container) return;
            
            try {
                // Check if betting controls already exist
                if (elements.rouletteBet && elements.spinWheelBtn) {
                    return;
                }
                
                // Create betting controls container
                const controlsContainer = document.createElement('div');
                controlsContainer.className = 'betting-controls';
                
                // Add HTML for controls
                controlsContainer.innerHTML = `
                    <div class="bet-options">
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
                    
                    <button id="spin-wheel-btn" class="action-btn">SPIN</button>
                `;
                
                // Add to container
                container.appendChild(controlsContainer);
                
                // Update element references
                elements.spinWheelBtn = document.getElementById('spin-wheel-btn');
                elements.rouletteBet = document.getElementById('roulette-bet');
                elements.rouletteBetType = document.getElementById('roulette-bet-type');
                elements.betColorContainer = document.getElementById('bet-color-container');
                elements.betNumberContainer = document.getElementById('bet-number-container');
                elements.betOddEvenContainer = document.getElementById('bet-odd-even-container');
                elements.rouletteNumber = document.getElementById('roulette-number');
                elements.colorBtns = document.querySelectorAll('.color-btn');
                elements.oddEvenBtns = document.querySelectorAll('.odd-even-btn');
                
                app.log('Roulette', 'Betting controls created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating betting controls: ${error.message}`, true);
            }
        };
        
        /**
         * Add custom CSS styles for roulette game
         */
        const addRouletteStyles = function() {
            try {
                // Check if styles are already added
                if (document.getElementById('roulette-custom-styles')) {
                    return;
                }
                
                // Create style element
                const styleEl = document.createElement('style');
                styleEl.id = 'roulette-custom-styles';
                
                // Add CSS rules
                styleEl.textContent = `
                    /* Roulette Container */
                    .roulette-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 2rem;
                        width: 100%;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 1rem;
                    }
                    
                    /* Wheel Styling */
                    .roulette-wheel {
                        width: 300px;
                        height: 300px;
                        position: relative;
                        margin: 0 auto;
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
                        box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
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
                        font-size: 0.9rem;
                        font-weight: bold;
                        transform-origin: center;
                        color: white;
                        z-index: 2;
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
                        width: 14px;
                        height: 14px;
                        background: white;
                        border-radius: 50%;
                        transform-origin: center;
                        z-index: 5;
                        box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
                        left: calc(50% - 7px);
                        top: calc(50% - 7px);
                    }
                    
                    /* Betting Controls */
                    .betting-controls {
                        width: 100%;
                        max-width: 500px;
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 8px;
                        padding: 1.5rem;
                        margin-top: 1rem;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    
                    .bet-options {
                        display: flex;
                        gap: 1rem;
                        flex-wrap: wrap;
                        margin-bottom: 1.5rem;
                    }
                    
                    .bet-amount, .bet-type {
                        flex: 1;
                        min-width: 150px;
                    }
                    
                    .bet-option-container {
                        display: flex;
                        gap: 1rem;
                        margin-bottom: 1.5rem;
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                    
                    .bet-option-container.hidden {
                        display: none;
                    }
                    
                    .color-btn, .odd-even-btn {
                        padding: 0.7rem 1.5rem;
                        border-radius: 50px;
                        border: none;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.3s;
                        min-width: 100px;
                    }
                    
                    .color-btn:hover, .odd-even-btn:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                    }
                    
                    .color-btn.selected, .odd-even-btn.selected {
                        transform: translateY(-3px);
                        box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
                    }
                    
                    .red-btn {
                        background: linear-gradient(145deg, #D32F2F, #B71C1C);
                        color: white;
                    }
                    
                    .black-btn {
                        background: linear-gradient(145deg, #212121, #000000);
                        color: white;
                    }
                    
                    .green-btn {
                        background: linear-gradient(145deg, #00C853, #009624);
                        color: white;
                    }
                    
                    .action-btn {
                        background: linear-gradient(145deg, #FFD700, #FFC400);
                        color: #000;
                        border: none;
                        width: 100%;
                        padding: 1rem;
                        border-radius: 50px;
                        font-size: 1.1rem;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.3s;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-top: 1rem;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    }
                    
                    .action-btn:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                    }
                    
                    .action-btn:active {
                        transform: translateY(-1px);
                        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
                    }
                    
                    .action-btn:disabled {
                        background: #ccc;
                        cursor: not-allowed;
                        transform: none;
                        box-shadow: none;
                    }
                    
                    /* Result Display */
                    .result {
                        width: 100%;
                        max-width: 500px;
                        min-height: 50px;
                        margin: 1rem 0;
                        padding: 1.5rem;
                        text-align: center;
                        border-radius: 8px;
                        font-weight: bold;
                        font-size: 1.2rem;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                        opacity: 0;
                        transform: translateY(20px);
                        transition: opacity 0.3s, transform 0.3s;
                    }
                    
                    .result.visible {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    
                    .result.win {
                        background: rgba(76, 175, 80, 0.1);
                        border: 1px solid #4CAF50;
                        color: #4CAF50;
                    }
                    
                    .result.lose {
                        background: rgba(244, 67, 54, 0.1);
                        border: 1px solid #F44336;
                        color: #F44336;
                    }
                    
                    /* Input styling */
                    input[type="number"], select {
                        width: 100%;
                        padding: 0.8rem;
                        border-radius: 4px;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        background: rgba(0, 0, 0, 0.3);
                        color: #fff;
                        font-size: 1rem;
                        transition: border-color 0.3s;
                    }
                    
                    input[type="number"]:focus, select:focus {
                        border-color: #FFD700;
                        outline: none;
                        box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: bold;
                        color: #FFD700;
                    }
                    
                    /* Responsive adjustments */
                    @media screen and (max-width: 600px) {
                        .roulette-wheel {
                            width: 250px;
                            height: 250px;
                        }
                        
                        .wheel-number {
                            width: 25px;
                            height: 25px;
                            font-size: 0.8rem;
                        }
                        
                        .bet-options {
                            flex-direction: column;
                        }
                        
                        .bet-option-container {
                            flex-direction: column;
                            align-items: center;
                        }
                        
                        .color-btn, .odd-even-btn {
                            width: 100%;
                        }
                    }
                `;
                
                // Add to document head
                document.head.appendChild(styleEl);
                
                app.log('Roulette', 'Custom styles added successfully');
            } catch (error) {
                app.log('Roulette', `Error adding custom styles: ${error.message}`, true);
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
                
                // Calculate wheel radius and center for precise positioning
                const wheelRadius = 110; // Pixels from center to number position
                
                // Create number cells
                numbers.forEach((number, index) => {
                    // Calculate position on the wheel - precise angle calculation
                    const angle = (index * 360 / numbers.length);
                    const color = numberColors[number.toString()];
                    
                    // Create number element with fixed dimensions
                    const numberElement = document.createElement('div');
                    numberElement.className = `wheel-number ${color}`;
                    numberElement.textContent = number;
                    
                    // Position numbers in perfect circle without overlap
                    // Convert angle to radians for precise positioning
                    const radians = (angle - 90) * (Math.PI / 180);
                    const x = Math.cos(radians) * wheelRadius;
                    const y = Math.sin(radians) * wheelRadius;
                    
                    // Use translate3d for better performance and to ensure numbers stay in position
                    numberElement.style.position = 'absolute';
                    numberElement.style.left = '50%';
                    numberElement.style.top = '50%';
                    numberElement.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
                    numberElement.style.transformOrigin = 'center center';
                    
                    elements.wheelInner.appendChild(numberElement);
                });
                
                // Ensure the ball is properly visible and positioned
                if (elements.rouletteBall) {
                    // Make sure ball starts visible outside the wheel
                    elements.rouletteBall.style.display = 'block';
                    elements.rouletteBall.style.opacity = '1';
                    elements.rouletteBall.style.width = '14px';
                    elements.rouletteBall.style.height = '14px';
                    elements.rouletteBall.style.backgroundColor = 'white';
                    elements.rouletteBall.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.8)';
                    
                    // Position the ball at starting point
                    const ballRadius = 140; // Slightly larger than number radius
                    elements.rouletteBall.style.position = 'absolute';
                    elements.rouletteBall.style.left = '50%';
                    elements.rouletteBall.style.top = '50%';
                    elements.rouletteBall.style.transform = `translate(-50%, -50%) rotate(0deg) translateY(-${ballRadius}px)`;
                    elements.rouletteBall.style.transformOrigin = 'center center';
                    elements.rouletteBall.style.zIndex = '10';
                }
                
                app.log('Roulette', 'Wheel set up successfully with precise positioning');
            } catch (error) {
                app.log('Roulette', `Error setting up wheel: ${error.message}`, true);
            }
        };
        
        /**
         * Set up event listeners
         */
        const setupEventListeners = function() {
            try {
                // Spin button
                if (elements.spinWheelBtn) {
                    // Clear current event listeners (prevent duplication)
                    const newSpinBtn = elements.spinWheelBtn.cloneNode(true);
                    if (elements.spinWheelBtn.parentNode) {
                        elements.spinWheelBtn.parentNode.replaceChild(newSpinBtn, elements.spinWheelBtn);
                    }
                    elements.spinWheelBtn = newSpinBtn;
                    
                    // Add event listener
                    elements.spinWheelBtn.addEventListener('click', spin);
                }
                
                // Bet type selection
                if (elements.rouletteBetType) {
                    elements.rouletteBetType.addEventListener('change', changeBetType);
                }
                
                // Color buttons
                elements.colorBtns.forEach(btn => {
                    btn.addEventListener('click', selectColor);
                });
                
                // Odd/Even buttons
                elements.oddEvenBtns.forEach(btn => {
                    btn.addEventListener('click', selectOddEven);
                });
                
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
                if (!elements.rouletteBetType) return;
                
                state.selectedBetType = elements.rouletteBetType.value;
                
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
                
                elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
                elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
                
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
                elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
                
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
                elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
                
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
         * Spin the wheel
         */
        const spin = async function() {
            app.log('Roulette', 'Starting spin');
            
            // Check initialization
            if (!state.initialized) {
                app.log('Roulette', 'Game not initialized, starting initialization', true);
                await init();
                
                // If initialization failed, exit
                if (!state.initialized) {
                    app.log('Roulette', 'Could not start game: initialization error', true);
                    return;
                }
            }
            
            try {
                // Check for casinoApp
                if (!window.casinoApp) {
                    app.log('Roulette', 'casinoApp not found', true);
                    alert('Application initialization error');
                    return;
                }
                
                // Check if wheel is already spinning
                if (state.isSpinning) {
                    app.log('Roulette', 'Wheel is already spinning');
                    return;
                }
                
                // Check for needed elements
                if (!elements.rouletteBet) {
                    app.log('Roulette', 'Bet element not found', true);
                    return;
                }
                
                // Get bet amount
                const betAmount = parseInt(elements.rouletteBet.value);
                
                // Check bet
                if (isNaN(betAmount) || betAmount <= 0) {
                    window.casinoApp.showNotification('Please enter a valid bet amount');
                    return;
                }
                
                // Check if enough funds
                if (betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Insufficient funds for this bet');
                    return;
                }
                
                // Check bet type selection
                if (state.selectedBetType === 'color' && !state.selectedColor) {
                    window.casinoApp.showNotification('Please select a color');
                    return;
                }
                
                if (state.selectedBetType === 'odd-even' && !state.selectedOddEven) {
                    window.casinoApp.showNotification('Please select odd or even');
                    return;
                }
                
                if (state.selectedBetType === 'number' && !elements.rouletteNumber) {
                    window.casinoApp.showNotification('Error with number selection element');
                    return;
                }
                
                if (state.selectedBetType === 'number') {
                    const number = parseInt(elements.rouletteNumber.value);
                    if (isNaN(number) || number < 0 || number > 36) {
                        window.casinoApp.showNotification('Please enter a number from 0 to 36');
                        return;
                    }
                }
                
                // Set spinning state
                state.isSpinning = true;
                if (elements.spinWheelBtn) {
                    elements.spinWheelBtn.disabled = true;
                }
                
                if (elements.rouletteResult) {
                    elements.rouletteResult.textContent = '';
                    elements.rouletteResult.className = 'result';
                }
                
                // Tactile feedback
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Run spin with timeout protection
                try {
                    // Limit waiting time for animation
                    const spinResult = await spinWheelWithTimeout();
                    
                    // Check if the player won
                    const winResult = checkWin(spinResult);
                    
                    // Calculate winnings
                    const winAmount = winResult.win ? betAmount * winResult.multiplier : 0;
                    
                    // Display result
                    displayResult(winResult.win, winAmount, spinResult);
                    
                    // Tactile feedback based on result
                    if (winResult.win) {
                        if (window.casinoApp.provideTactileFeedback) {
                            window.casinoApp.provideTactileFeedback('success');
                        }
                    } else {
                        if (window.casinoApp.provideTactileFeedback) {
                            window.casinoApp.provideTactileFeedback('warning');
                        }
                    }
                    
                    // Send result to server
                    const gameData = {
                        number: spinResult,
                        color: numberColors[spinResult.toString()],
                        betType: state.selectedBetType,
                        selectedColor: state.selectedColor,
                        selectedNumber: state.selectedBetType === 'number' ? 
                            parseInt(elements.rouletteNumber.value) : null,
                        selectedOddEven: state.selectedOddEven
                    };
                    
                    await window.casinoApp.processGameResult(
                        'roulette',
                        betAmount,
                        winResult.win ? 'win' : 'lose',
                        winAmount,
                        gameData
                    );
                    
                } catch (error) {
                    app.log('Roulette', `Error during game: ${error.message}`, true);
                    window.casinoApp.showNotification('An error occurred. Please try again.');
                } finally {
                    // Reset state in any case
                    state.isSpinning = false;
                    if (elements.spinWheelBtn) {
                        elements.spinWheelBtn.disabled = false;
                    }
                }
                
            } catch (error) {
                app.log('Roulette', `Error starting spin: ${error.message}`, true);
                
                // Reset state in case of error
                state.isSpinning = false;
                if (elements.spinWheelBtn) {
                    elements.spinWheelBtn.disabled = false;
                }
            }
        };
        
        /**
         * Spin wheel animation with timeout
         */
        const spinWheelWithTimeout = function() {
            return Promise.race([
                spinWheel(),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Spin animation timeout'));
                    }, 6000); // 6 seconds max for animation
                })
            ]);
        };
        
        /**
         * Spin wheel animation
         */
        const spinWheel = function() {
            return new Promise((resolve) => {
                try {
                    // Get a random result from the wheel
                    const randomIndex = Math.floor(Math.random() * numbers.length);
                    const winningNumber = numbers[randomIndex];
                    
                    // Calculate the final position
                    const rotations = 3 + Math.floor(Math.random() * 3); // 3-5 full rotations
                    const finalAngle = rotations * 360 + (randomIndex * 360 / numbers.length);
                    
                    if (!elements.wheelInner || !elements.rouletteBall) {
                        app.log('Roulette', 'Wheel elements not found', true);
                        // Return result even without animation
                        setTimeout(() => resolve(winningNumber), 1000);
                        return;
                    }
                    
                    // Calculate ball movement parameters
                    const ballRadius = 140; // Same as in setupWheel
                    
                    // Make sure wheel and ball are visible
                    elements.wheelInner.style.opacity = '1';
                    elements.rouletteBall.style.opacity = '1';
                    elements.rouletteBall.style.display = 'block';
                    
                    // First reset positions to ensure clean animation
                    elements.wheelInner.style.transition = 'none';
                    elements.rouletteBall.style.transition = 'none';
                    elements.wheelInner.style.transform = 'rotate(0deg)';
                    elements.rouletteBall.style.transform = `translate(-50%, -50%) rotate(0deg) translateY(-${ballRadius}px)`;
                    
                    // Force reflow to apply immediate changes
                    void elements.wheelInner.offsetWidth;
                    void elements.rouletteBall.offsetWidth;
                    
                    // Then set up smooth animation
                    setTimeout(() => {
                        // Use enhanced easing for realistic physics
                        elements.wheelInner.style.transition = 'transform 4s cubic-bezier(0.32, 0.94, 0.60, 1)';
                        elements.rouletteBall.style.transition = 'transform 4s cubic-bezier(0.34, 0.82, 0.60, 1)';
                        
                        // Animate wheel counter-clockwise
                        elements.wheelInner.style.transform = `rotate(${-finalAngle}deg)`;
                        
                        // Animate ball in opposite direction (clockwise)
                        elements.rouletteBall.style.transform = `translate(-50%, -50%) rotate(${finalAngle}deg) translateY(-${ballRadius}px)`;
                        
                        // Add slight bounce effect to ball at the end
                        setTimeout(() => {
                            elements.rouletteBall.style.transition = 'transform 0.3s ease-out';
                            const bounceDistance = ballRadius - 5;
                            elements.rouletteBall.style.transform = `translate(-50%, -50%) rotate(${finalAngle}deg) translateY(-${bounceDistance}px)`;
                            
                            setTimeout(() => {
                                elements.rouletteBall.style.transition = 'transform 0.2s ease-in';
                                elements.rouletteBall.style.transform = `translate(-50%, -50%) rotate(${finalAngle}deg) translateY(-${ballRadius}px)`;
                            }, 300);
                        }, 3800);
                    }, 50);
                    
                    // Return result after animation completes
                    setTimeout(() => {
                        resolve(winningNumber);
                    }, 4500);
                } catch (error) {
                    app.log('Roulette', `Error during wheel animation: ${error.message}`, true);
                    // Generate random number even if animation fails
                    const fallbackNumber = numbers[Math.floor(Math.random() * numbers.length)];
                    resolve(fallbackNumber);
                }
            });
        };
        
        /**
         * Check if the bet is a winning bet
         */
        const checkWin = function(result) {
            try {
                const resultColor = numberColors[result.toString()];
                const isOdd = result !== 0 && result % 2 === 1;
                
                switch (state.selectedBetType) {
                    case 'color':
                        if (state.selectedColor === resultColor) {
                            return {
                                win: true,
                                multiplier: resultColor === 'green' ? 36 : 2 // Green (0) pays 36:1, red/black pays 2:1
                            };
                        }
                        break;
                        
                    case 'number':
                        if (!elements.rouletteNumber) return { win: false, multiplier: 0 };
                        
                        const selectedNumber = parseInt(elements.rouletteNumber.value);
                        if (selectedNumber === result) {
                            return {
                                win: true,
                                multiplier: 36 // Straight up bet pays 36:1
                            };
                        }
                        break;
                        
                    case 'odd-even':
                        if (result === 0) {
                            // 0 is neither odd nor even in roulette rules
                            return { win: false, multiplier: 0 };
                        }
                        
                        if ((state.selectedOddEven === 'odd' && isOdd) || 
                            (state.selectedOddEven === 'even' && !isOdd)) {
                            return {
                                win: true,
                                multiplier: 2 // Odd/Even pays 2:1
                            };
                        }
                        break;
                }
                
                return { win: false, multiplier: 0 };
                
            } catch (error) {
                app.log('Roulette', `Error checking win: ${error.message}`, true);
                return { win: false, multiplier: 0 };
            }
        };
        
        /**
         * Display the result
         */
        const displayResult = function(isWin, amount, number) {
            try {
                if (!elements.rouletteResult) {
                    app.log('Roulette', 'Result element not found', true);
                    return;
                }
                
                const color = numberColors[number.toString()];
                const isOdd = number !== 0 && number % 2 === 1;
                const resultText = `Number ${number} - ${color.toUpperCase()}${number !== 0 ? ` - ${isOdd ? 'ODD' : 'EVEN'}` : ''}`;
                
                if (isWin) {
                    elements.rouletteResult.innerHTML = `
                        <div class="result-icon">🎉</div>
                        <div class="result-number">${resultText}</div>
                        <div class="result-win">You won ${amount} Stars!</div>
                    `;
                    elements.rouletteResult.className = 'result win';
                } else {
                    elements.rouletteResult.innerHTML = `
                        <div class="result-icon">❌</div>
                        <div class="result-number">${resultText}</div>
                        <div class="result-lose">Better luck next time!</div>
                    `;
                    elements.rouletteResult.className = 'result lose';
                }
                
                // Show with animation
                setTimeout(() => {
                    elements.rouletteResult.classList.add('visible');
                }, 100);
                
            } catch (error) {
                app.log('Roulette', `Error displaying result: ${error.message}`, true);
            }
        };
        
        // Return public interface
        return {
            // Main methods
            init: init,
            spin: spin,
            
            // Get game status
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isSpinning: state.isSpinning,
                    elementsFound: {
                        spinWheelBtn: !!elements.spinWheelBtn,
                        rouletteBet: !!elements.rouletteBet,
                        wheelInner: !!elements.wheelInner,
                        rouletteBall: !!elements.rouletteBall
                    }
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