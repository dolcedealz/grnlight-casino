/**
 * roulette.js - Premium European Roulette with Canvas-based Wheel
 * Version 2.0.0
 * 
 * Features:
 * - Non-blocking initialization
 * - Perfect canvas-based wheel implementation
 * - Proper European roulette wheel layout (37 numbers)
 * - Responsive design that always maintains perfect square aspect ratio
 * - Advanced animations with proper physics
 * - Enhanced error handling and timeout protection
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
    app.log('Roulette', 'Initializing premium roulette game module v2.0.0');
    
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
            canvasContainer: null,
            wheelCanvas: null,
            ballCanvas: null,
            rouletteResult: null
        };
        
        // Canvas contexts
        let wheelCtx = null;
        let ballCtx = null;
        
        // Animation frames
        let wheelAnimationFrame = null;
        let ballAnimationFrame = null;
        
        // Game state
        let state = {
            isSpinning: false,
            initialized: false,
            initializationStarted: false,
            selectedBetType: 'color',
            selectedColor: null,
            selectedOddEven: null,
            wheelAngle: 0,
            ballAngle: 0,
            canvasSize: 0,
            lastTimestamp: 0,
            spinStartTime: 0,
            spinDuration: 0,
            finalWheelAngle: 0,
            finalBallPosition: null,
            winningNumber: null,
            winningIndex: -1
        };
        
        // Roulette wheel configuration - standard European roulette
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
        
        // Wheel visual configuration
        const wheelConfig = {
            // Border colors
            outerBorderColor: "#FFD700", // Gold
            innerBorderColor: "#444444",
            sectorBorderColor: "#222222",
            
            // Fill colors
            centerColor: "#121212",
            greenSectorColor: "#00A86B", // Green
            redSectorColor: "#D32F2F",   // Red
            blackSectorColor: "#212121", // Black
            
            // Font settings
            fontSize: 12,
            fontFamily: "Courier, monospace",
            fontColor: "#FFFFFF",
            
            // Dimensions
            outerBorderWidth: 3,
            innerBorderWidth: 2,
            sectorBorderWidth: 2,
            
            // Animation settings
            wheelSpinningTime: 5000, // ms
            minSpins: 3,
            maxSpins: 5
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
                        
                        // Add custom styles for proper wheel visualization
                        addRouletteStyles();
                        
                        // Set up canvases for wheel and ball
                        setupCanvases();
                        
                        // Add event listeners
                        setupEventListeners();
                        
                        // Draw initial wheel
                        drawWheel();
                        
                        // Handle window resize
                        window.addEventListener('resize', handleResize);
                        
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
                        elements.canvasContainer = document.querySelector('.roulette-wheel');
                        elements.rouletteResult = document.getElementById('roulette-result');
                        
                        // Find roulette screen
                        const rouletteScreen = document.getElementById('roulette-screen');
                        if (rouletteScreen) {
                            elements.rouletteScreen = rouletteScreen;
                        }
                        
                        // Log found/missing critical elements
                        if (!elements.spinWheelBtn) {
                            app.log('Roulette', 'Warning: spin-wheel-btn element not found', true);
                        }
                        
                        if (!elements.canvasContainer) {
                            app.log('Roulette', 'Warning: wheel container not found, will create dynamically', true);
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
                // Find parent container (roulette screen or game area)
                let parentContainer = elements.rouletteScreen;
                if (!parentContainer) {
                    parentContainer = document.querySelector('#roulette-screen');
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
                
                // Create game container if it doesn't exist
                let gameContainer = parentContainer.querySelector('.roulette-container');
                if (!gameContainer) {
                    gameContainer = document.createElement('div');
                    gameContainer.className = 'roulette-container';
                    parentContainer.appendChild(gameContainer);
                }
                
                // Create canvas container if it doesn't exist
                if (!elements.canvasContainer) {
                    const canvasContainer = document.createElement('div');
                    canvasContainer.className = 'roulette-wheel';
                    gameContainer.appendChild(canvasContainer);
                    elements.canvasContainer = canvasContainer;
                }
                
                // Create result display if it doesn't exist
                if (!elements.rouletteResult) {
                    const resultDisplay = document.createElement('div');
                    resultDisplay.id = 'roulette-result';
                    resultDisplay.className = 'result';
                    gameContainer.appendChild(resultDisplay);
                    elements.rouletteResult = resultDisplay;
                }
                
                // Create betting controls if they don't exist
                if (!elements.spinWheelBtn || !elements.rouletteBet) {
                    createBettingControls(gameContainer);
                }
                
                app.log('Roulette', 'Game container and elements created successfully');
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
                
                // Add CSS rules for proper wheel visualization
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
                        position: relative;
                        width: 100%;
                        max-width: 400px;
                        margin: 0 auto;
                        aspect-ratio: 1/1; /* Force square aspect ratio */
                    }
                    
                    /* Canvas layering */
                    .wheel-canvas {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                    }
                    
                    .ball-canvas {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        pointer-events: none;
                        z-index: 10;
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
                        background: linear-gradient(145deg, #00A86B, #007F4E);
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
                `;
                
                // Add to document head
                document.head.appendChild(styleEl);
                
                app.log('Roulette', 'Custom styles added successfully');
            } catch (error) {
                app.log('Roulette', `Error adding custom styles: ${error.message}`, true);
            }
        };
        
        /**
         * Set up canvases for wheel and ball
         */
        const setupCanvases = function() {
            try {
                if (!elements.canvasContainer) {
                    app.log('Roulette', 'Cannot set up canvases: container not found', true);
                    return;
                }
                
                // Create wheel canvas
                let wheelCanvas = elements.canvasContainer.querySelector('.wheel-canvas');
                if (!wheelCanvas) {
                    wheelCanvas = document.createElement('canvas');
                    wheelCanvas.className = 'wheel-canvas';
                    elements.canvasContainer.appendChild(wheelCanvas);
                }
                elements.wheelCanvas = wheelCanvas;
                
                // Create ball canvas (separate layer for ball animation)
                let ballCanvas = elements.canvasContainer.querySelector('.ball-canvas');
                if (!ballCanvas) {
                    ballCanvas = document.createElement('canvas');
                    ballCanvas.className = 'ball-canvas';
                    elements.canvasContainer.appendChild(ballCanvas);
                }
                elements.ballCanvas = ballCanvas;
                
                // Get the contexts
                wheelCtx = elements.wheelCanvas.getContext('2d');
                ballCtx = elements.ballCanvas.getContext('2d');
                
                // Resize canvases to fit container
                resizeCanvases();
                
                app.log('Roulette', 'Canvases set up successfully');
            } catch (error) {
                app.log('Roulette', `Error setting up canvases: ${error.message}`, true);
            }
        };
        
        /**
         * Resize canvases to maintain proper aspect ratio and resolution
         */
        const resizeCanvases = function() {
            try {
                if (!elements.canvasContainer || !elements.wheelCanvas || !elements.ballCanvas) {
                    return;
                }
                
                // Get container dimensions
                const containerWidth = elements.canvasContainer.clientWidth;
                const containerHeight = elements.canvasContainer.clientHeight;
                
                // Calculate canvas size (always square)
                const size = Math.min(containerWidth, containerHeight);
                state.canvasSize = size;
                
                // Set wheel canvas dimensions
                elements.wheelCanvas.width = size;
                elements.wheelCanvas.height = size;
                
                // Set ball canvas dimensions
                elements.ballCanvas.width = size;
                elements.ballCanvas.height = size;
                
                // Adjust font size based on canvas size
                wheelConfig.fontSize = Math.max(10, Math.floor(size / 30));
                
                app.log('Roulette', `Canvases resized to ${size}x${size}px`);
            } catch (error) {
                app.log('Roulette', `Error resizing canvases: ${error.message}`, true);
            }
        };
        
        /**
         * Handle window resize event
         */
        const handleResize = function() {
            try {
                clearTimeout(state.resizeTimeout);
                
                // Debounce to avoid too many redraws
                state.resizeTimeout = setTimeout(() => {
                    resizeCanvases();
                    drawWheel();
                    
                    // If ball position exists, update ball
                    if (state.finalBallPosition) {
                        drawBall(state.ballAngle);
                    }
                }, 200);
            } catch (error) {
                app.log('Roulette', `Error handling resize: ${error.message}`, true);
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
         * Draw the roulette wheel
         * This creates a perfect wheel with 37 equal sectors in the standard European roulette order
         */
        const drawWheel = function() {
            try {
                if (!wheelCtx || !elements.wheelCanvas) {
                    app.log('Roulette', 'Cannot draw wheel: context or canvas missing', true);
                    return;
                }
                
                // Clear the canvas
                wheelCtx.clearRect(0, 0, elements.wheelCanvas.width, elements.wheelCanvas.height);
                
                const canvas = elements.wheelCanvas;
                const ctx = wheelCtx;
                const size = canvas.width; // Always square
                const centerX = size / 2;
                const centerY = size / 2;
                const outerRadius = size * 0.48; // 96% of half canvas width
                
                // Apply current wheel rotation
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(state.wheelAngle * Math.PI / 180);
                ctx.translate(-centerX, -centerY);
                
                // Draw outer border (gold)
                ctx.beginPath();
                ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
                ctx.lineWidth = wheelConfig.outerBorderWidth;
                ctx.strokeStyle = wheelConfig.outerBorderColor;
                ctx.stroke();
                
                // Draw wheel background
                ctx.beginPath();
                ctx.arc(centerX, centerY, outerRadius - wheelConfig.outerBorderWidth / 2, 0, 2 * Math.PI);
                ctx.fillStyle = wheelConfig.centerColor;
                ctx.fill();
                
                // Draw sectors
                const sectorAngle = 2 * Math.PI / numbers.length;
                const sectorRadius = outerRadius - wheelConfig.outerBorderWidth;
                
                for (let i = 0; i < numbers.length; i++) {
                    const number = numbers[i];
                    const color = numberColors[number.toString()];
                    
                    // Start and end angles for this sector
                    const startAngle = i * sectorAngle;
                    const endAngle = (i + 1) * sectorAngle;
                    
                    // Draw sector
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.arc(centerX, centerY, sectorRadius, startAngle, endAngle);
                    ctx.closePath();
                    
                    // Fill with appropriate color
                    switch (color) {
                        case 'green':
                            ctx.fillStyle = wheelConfig.greenSectorColor;
                            break;
                        case 'red':
                            ctx.fillStyle = wheelConfig.redSectorColor;
                            break;
                        case 'black':
                            ctx.fillStyle = wheelConfig.blackSectorColor;
                            break;
                    }
                    ctx.fill();
                    
                    // Draw sector border
                    ctx.lineWidth = wheelConfig.sectorBorderWidth;
                    ctx.strokeStyle = wheelConfig.sectorBorderColor;
                    ctx.stroke();
                    
                    // Calculate position for number (about 75% out from center)
                    const textRadius = sectorRadius * 0.75;
                    const textAngle = startAngle + sectorAngle / 2;
                    const textX = centerX + Math.cos(textAngle) * textRadius;
                    const textY = centerY + Math.sin(textAngle) * textRadius;
                    
                    // Draw number
                    ctx.save();
                    ctx.translate(textX, textY);
                    
                    // Always keep text upright
                    if (textAngle > Math.PI / 2 && textAngle < Math.PI * 3/2) {
                        ctx.rotate(textAngle + Math.PI);
                    } else {
                        ctx.rotate(textAngle);
                    }
                    
                    ctx.fillStyle = wheelConfig.fontColor;
                    ctx.font = `bold ${wheelConfig.fontSize}px ${wheelConfig.fontFamily}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(number.toString(), 0, 0);
                    ctx.restore();
                }
                
                // Draw inner circle
                const innerRadius = sectorRadius * 0.2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
                ctx.fillStyle = wheelConfig.centerColor;
                ctx.fill();
                ctx.lineWidth = wheelConfig.innerBorderWidth;
                ctx.strokeStyle = wheelConfig.innerBorderColor;
                ctx.stroke();
                
                // Restore context
                ctx.restore();
                
            } catch (error) {
                app.log('Roulette', `Error drawing wheel: ${error.message}`, true);
            }
        };
        
        /**
         * Draw the ball at specified angle
         */
        const drawBall = function(angle) {
            try {
                if (!ballCtx || !elements.ballCanvas) {
                    app.log('Roulette', 'Cannot draw ball: context or canvas missing', true);
                    return;
                }
                
                // Clear the ball canvas
                ballCtx.clearRect(0, 0, elements.ballCanvas.width, elements.ballCanvas.height);
                
                const canvas = elements.ballCanvas;
                const ctx = ballCtx;
                const size = canvas.width; // Always square
                const centerX = size / 2;
                const centerY = size / 2;
                
                // Calculate ball position - ball runs on the outer edge of the wheel
                const ballRadius = size * 0.48 * 0.92; // Slightly inside the outer border
                const ballSize = Math.max(6, size / 40); // Scale ball with wheel
                
                const ballAngleRad = angle * Math.PI / 180;
                const ballX = centerX + Math.cos(ballAngleRad) * ballRadius;
                const ballY = centerY + Math.sin(ballAngleRad) * ballRadius;
                
                // Draw ball
                ctx.beginPath();
                ctx.arc(ballX, ballY, ballSize, 0, 2 * Math.PI);
                ctx.fillStyle = 'white';
                ctx.fill();
                
                // Draw shadow/highlight effect for 3D appearance
                const gradient = ctx.createRadialGradient(
                    ballX - ballSize/3,
                    ballY - ballSize/3,
                    0,
                    ballX,
                    ballY,
                    ballSize
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                gradient.addColorStop(1, 'rgba(200, 200, 200, 0.8)');
                
                ctx.beginPath();
                ctx.arc(ballX, ballY, ballSize, 0, 2 * Math.PI);
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Small reflection highlight
                ctx.beginPath();
                ctx.arc(ballX - ballSize/3, ballY - ballSize/3, ballSize/3, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fill();
                
            } catch (error) {
                app.log('Roulette', `Error drawing ball: ${error.message}`, true);
            }
        };
        
        /**
         * Animate wheel rotation
         */
        const animateWheel = function(timestamp) {
            if (!state.lastTimestamp) {
                state.lastTimestamp = timestamp;
            }
            
            try {
                // Calculate elapsed time
                const elapsed = timestamp - state.spinStartTime;
                const deltaTime = timestamp - state.lastTimestamp;
                state.lastTimestamp = timestamp;
                
                // Check if animation should end
                if (elapsed >= state.spinDuration) {
                    // Final position
                    state.wheelAngle = state.finalWheelAngle % 360;
                    drawWheel();
                    
                    // Cancel this animation loop
                    cancelAnimationFrame(wheelAnimationFrame);
                    wheelAnimationFrame = null;
                    return;
                }
                
                // Calculate current angle based on easing function
                const progress = elapsed / state.spinDuration;
                const easedProgress = easeOutCubic(progress);
                
                // Calculate new wheel angle
                const angleDiff = state.finalWheelAngle - state.wheelAngle;
                const step = angleDiff * easedProgress * deltaTime / 16; // Normalized for 60fps
                state.wheelAngle += step;
                
                // Draw wheel at new angle
                drawWheel();
                
                // Continue animation
                wheelAnimationFrame = requestAnimationFrame(animateWheel);
            } catch (error) {
                app.log('Roulette', `Error animating wheel: ${error.message}`, true);
                
                // Cancel animation in case of error
                cancelAnimationFrame(wheelAnimationFrame);
                wheelAnimationFrame = null;
            }
        };
        
        /**
         * Animate ball movement
         */
        const animateBall = function(timestamp) {
            if (!state.lastBallTimestamp) {
                state.lastBallTimestamp = timestamp;
            }
            
            try {
                // Calculate elapsed time
                const elapsed = timestamp - state.spinStartTime;
                state.lastBallTimestamp = timestamp;
                
                // Different timing for the ball animation (starts fast, slows down)
                const ballDuration = state.spinDuration * 1.1; // Ball stops after wheel
                
                // Check if animation should end
                if (elapsed >= ballDuration) {
                    // Final position - ball should stop at winning number
                    state.ballAngle = state.finalBallPosition;
                    drawBall(state.ballAngle);
                    
                    // Cancel this animation loop
                    cancelAnimationFrame(ballAnimationFrame);
                    ballAnimationFrame = null;
                    
                    // Wait a short time then show result
                    setTimeout(() => {
                        showResult();
                    }, 500);
                    
                    return;
                }
                
                // Ball animation has three phases:
                // 1. Fast counterclockwise rotation
                // 2. Gradual slowing
                // 3. Final bounce to position
                
                let ballAngle;
                const ballProgress = elapsed / ballDuration;
                
                if (ballProgress < 0.6) {
                    // Phase 1: Fast rotation in direction opposite to wheel
                    const phase1Progress = ballProgress / 0.6;
                    const speed = 1 - phase1Progress; // Gradually slowing
                    
                    // Ball completes more rotations than wheel
                    const rotations = -5 * 360; // Negative for counterclockwise
                    ballAngle = rotations * phase1Progress * speed;
                    
                } else if (ballProgress < 0.9) {
                    // Phase 2: Gradual approach to final position
                    const phase2Progress = (ballProgress - 0.6) / 0.3;
                    const eased = easeOutQuint(phase2Progress);
                    
                    // Gradually move toward winning position
                    const startPos = -5 * 360 * 0.6;
                    const endPos = state.finalBallPosition - 30; // Approach position
                    ballAngle = startPos + (endPos - startPos) * eased;
                    
                } else {
                    // Phase 3: Final bounce to exact position
                    const phase3Progress = (ballProgress - 0.9) / 0.1;
                    const bounce = easeOutBounce(phase3Progress);
                    
                    // Bounce into final position
                    const approachPos = state.finalBallPosition - 30;
                    ballAngle = approachPos + (state.finalBallPosition - approachPos) * bounce;
                }
                
                // Store current angle and draw ball
                state.ballAngle = ballAngle;
                drawBall(ballAngle);
                
                // Continue animation
                ballAnimationFrame = requestAnimationFrame(animateBall);
            } catch (error) {
                app.log('Roulette', `Error animating ball: ${error.message}`, true);
                
                // Cancel animation in case of error
                cancelAnimationFrame(ballAnimationFrame);
                ballAnimationFrame = null;
            }
        };
        
        /**
         * Easing functions for animations
         */
        const easeOutCubic = function(x) {
            return 1 - Math.pow(1 - x, 3);
        };
        
        const easeOutQuint = function(x) {
            return 1 - Math.pow(1 - x, 5);
        };
        
        const easeOutBounce = function(x) {
            const n1 = 7.5625;
            const d1 = 2.75;
            
            if (x < 1 / d1) {
                return n1 * x * x;
            } else if (x < 2 / d1) {
                return n1 * (x -= 1.5 / d1) * x + 0.75;
            } else if (x < 2.5 / d1) {
                return n1 * (x -= 2.25 / d1) * x + 0.9375;
            } else {
                return n1 * (x -= 2.625 / d1) * x + 0.984375;
            }
        };
        
        /**
         * Calculate final position of ball based on winning number
         */
        const calculateBallPosition = function(winningIndex) {
            // Convert winning index to angle (degrees)
            const sectorAngle = 360 / numbers.length;
            const baseAngle = winningIndex * sectorAngle;
            
            // Slightly randomize position within the sector
            const randomOffset = (Math.random() * 0.6 + 0.2) * sectorAngle; // 20%-80% of sector
            
            return baseAngle + randomOffset;
        };
        
        /**
         * Show the result of the spin
         */
        const showResult = function() {
            try {
                if (!state.winningNumber) {
                    app.log('Roulette', 'No winning number found', true);
                    return;
                }
                
                // Check if the player won
                const winResult = checkWin(state.winningNumber);
                
                // Calculate winnings
                const betAmount = parseInt(elements.rouletteBet.value);
                const winAmount = winResult.win ? betAmount * winResult.multiplier : 0;
                
                // Display result
                displayResult(winResult.win, winAmount, state.winningNumber);
                
                // Tactile feedback based on result
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    if (winResult.win) {
                        window.casinoApp.provideTactileFeedback('success');
                    } else {
                        window.casinoApp.provideTactileFeedback('warning');
                    }
                }
                
                // Send result to server
                if (window.casinoApp && window.casinoApp.processGameResult) {
                    const gameData = {
                        number: state.winningNumber,
                        color: numberColors[state.winningNumber.toString()],
                        betType: state.selectedBetType,
                        selectedColor: state.selectedColor,
                        selectedNumber: state.selectedBetType === 'number' ? 
                            parseInt(elements.rouletteNumber.value) : null,
                        selectedOddEven: state.selectedOddEven
                    };
                    
                    window.casinoApp.processGameResult(
                        'roulette',
                        betAmount,
                        winResult.win ? 'win' : 'lose',
                        winAmount,
                        gameData
                    ).catch(error => {
                        app.log('Roulette', `Error processing game result: ${error.message}`, true);
                    });
                }
                
                // Reset state
                setTimeout(() => {
                    state.isSpinning = false;
                    if (elements.spinWheelBtn) {
                        elements.spinWheelBtn.disabled = false;
                    }
                }, 1000); // Short delay to prevent rapid clicking
                
            } catch (error) {
                app.log('Roulette', `Error showing result: ${error.message}`, true);
                
                // Reset state in case of error
                state.isSpinning = false;
                if (elements.spinWheelBtn) {
                    elements.spinWheelBtn.disabled = false;
                }
            }
        };
        
        /**
         * Spin the wheel - main game function
         */
        const spin = async function() {
            app.log('Roulette', 'Starting wheel spin');
            
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
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    betAmount > window.GreenLightApp.user.balance) {
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
                
                // Determine the winning number and position
                // Get random result
                state.winningIndex = Math.floor(Math.random() * numbers.length);
                state.winningNumber = numbers[state.winningIndex];
                
                app.log('Roulette', `Winning number: ${state.winningNumber}`);
                
                // Calculate number of full rotations plus final position
                const rotations = wheelConfig.minSpins + Math.random() * (wheelConfig.maxSpins - wheelConfig.minSpins);
                const sectorAngle = 360 / numbers.length;
                
                // Final wheel angle (wheel spins clockwise, numbers go counterclockwise)
                state.finalWheelAngle = rotations * 360 + state.winningIndex * sectorAngle;
                
                // Calculate final ball position based on winning number
                state.finalBallPosition = calculateBallPosition(state.winningIndex);
                
                // Set animation parameters
                state.spinStartTime = performance.now();
                state.spinDuration = wheelConfig.wheelSpinningTime;
                state.lastTimestamp = null;
                state.lastBallTimestamp = null;
                
                // Start animations
                wheelAnimationFrame = requestAnimationFrame(animateWheel);
                ballAnimationFrame = requestAnimationFrame(animateBall);
                
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
        
        /**
         * Clean up resources when game is unloaded
         */
        const cleanup = function() {
            try {
                // Cancel animations
                if (wheelAnimationFrame) {
                    cancelAnimationFrame(wheelAnimationFrame);
                    wheelAnimationFrame = null;
                }
                
                if (ballAnimationFrame) {
                    cancelAnimationFrame(ballAnimationFrame);
                    ballAnimationFrame = null;
                }
                
                // Remove event listeners
                window.removeEventListener('resize', handleResize);
                
                app.log('Roulette', 'Cleaned up game resources');
            } catch (error) {
                app.log('Roulette', `Error during cleanup: ${error.message}`, true);
            }
        };
        
        // Return public interface
        return {
            // Main methods
            init: init,
            spin: spin,
            cleanup: cleanup,
            
            // Method for checking game state
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isSpinning: state.isSpinning,
                    elementsFound: {
                        spinWheelBtn: !!elements.spinWheelBtn,
                        rouletteBet: !!elements.rouletteBet,
                        wheelCanvas: !!elements.wheelCanvas,
                        ballCanvas: !!elements.ballCanvas
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
        
        // 6. Clean up on window unload to prevent memory leaks
        window.addEventListener('beforeunload', () => {
            if (rouletteGame.cleanup && typeof rouletteGame.cleanup === 'function') {
                rouletteGame.cleanup();
            }
        });
        
    } catch (error) {
        app.log('Roulette', `Error registering game: ${error.message}`, true);
    }
})();