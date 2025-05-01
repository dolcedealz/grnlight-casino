/**
 * roulette.js - Simple Roulette Game for Telegram WebApp
 * Version 1.0.0
 * 
 * Features:
 * - Simple bet input
 * - Realistic wheel animation
 * - Win calculation and display
 */

// Self-executing function to create closure and prevent variable conflicts
(function() {
    // Check for app environment
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
    app.log('Roulette', 'Initializing Roulette game module v1.0.0');
    
    // Main game implementation
    const rouletteGame = (function() {
        // DOM Elements
        let elements = {
            spinBtn: null,
            betInput: null,
            resultDisplay: null,
            wheel: null,
            ball: null,
            winningNumber: null,
            potentialWin: null,
            container: null
        };
        
        // Game state
        let state = {
            isSpinning: false,
            initialized: false,
            initializationStarted: false,
            lastResult: null
        };
        
        // Roulette configuration
        const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        
        // Color mapping for numbers
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
         * Initialize the roulette game
         * @returns {Promise<boolean>} True if initialization successful
         */
        const init = async function() {
            // Guard against multiple initialization
            if (state.initialized || state.initializationStarted) {
                app.log('Roulette', 'Initialization already completed or in progress');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Roulette', 'Starting game initialization');
            
            try {
                // Use Promise.race for timeout protection
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Find or create DOM elements
                        await findDOMElements();
                        
                        // Create wheel if needed
                        createRouletteWheel();
                        
                        // Set up event listeners
                        setupEventListeners();
                        
                        // Set up bet input change handler to update potential win
                        setupBetInputHandler();
                        
                        // Hide previous result
                        if (elements.resultDisplay) {
                            elements.resultDisplay.style.display = 'none';
                        }
                        
                        state.initialized = true;
                        app.log('Roulette', 'Initialization completed successfully');
                        resolve(true);
                    } catch (error) {
                        app.log('Roulette', `Error during initialization: ${error.message}`, true);
                        resolve(false);
                    }
                });
                
                // Timeout promise
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Roulette', 'Initialization timeout', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Race the promises
                const result = await Promise.race([initPromise, timeoutPromise]);
                return result;
                
            } catch (error) {
                app.log('Roulette', `Critical initialization error: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Find or create required DOM elements
         */
        const findDOMElements = async function() {
            return new Promise((resolve, reject) => {
                try {
                    // Use setTimeout for non-blocking operation
                    setTimeout(() => {
                        elements.spinBtn = document.getElementById('roulette-spin-btn');
                        elements.betInput = document.getElementById('roulette-bet');
                        elements.resultDisplay = document.getElementById('roulette-result');
                        elements.wheel = document.getElementById('roulette-wheel');
                        elements.ball = document.getElementById('roulette-ball');
                        elements.winningNumber = document.getElementById('winning-number');
                        elements.potentialWin = document.getElementById('potential-win');
                        elements.container = document.querySelector('.roulette-container');
                        
                        // Check for missing elements and create if needed
                        if (!elements.container) {
                            const mainContainer = document.querySelector('#roulette-screen') || 
                                                 document.querySelector('.main-content');
                            
                            if (mainContainer) {
                                const container = document.createElement('div');
                                container.className = 'roulette-container';
                                
                                // Create basic structure if missing
                                container.innerHTML = `
                                    <div class="bet-controls">
                                        <div class="bet-input">
                                            <label for="roulette-bet">Your Bet:</label>
                                            <input type="number" id="roulette-bet" min="1" max="1000" value="10">
                                        </div>
                                        <div class="potential-win">
                                            <span>Potential Win: <span id="potential-win">35</span> ⭐</span>
                                        </div>
                                        <button id="roulette-spin-btn" class="action-btn">SPIN</button>
                                    </div>
                                    
                                    <div id="roulette-wheel-container" class="wheel-container">
                                        <div id="roulette-wheel" class="wheel">
                                            <!-- Numbers will be added dynamically -->
                                        </div>
                                        <div id="roulette-ball" class="ball"></div>
                                    </div>
                                    
                                    <div id="roulette-result" class="result"></div>
                                `;
                                
                                mainContainer.appendChild(container);
                                elements.container = container;
                                
                                // Update references to newly created elements
                                elements.spinBtn = document.getElementById('roulette-spin-btn');
                                elements.betInput = document.getElementById('roulette-bet');
                                elements.resultDisplay = document.getElementById('roulette-result');
                                elements.wheel = document.getElementById('roulette-wheel');
                                elements.ball = document.getElementById('roulette-ball');
                                elements.potentialWin = document.getElementById('potential-win');
                                
                                app.log('Roulette', 'Created container and elements');
                            }
                        }
                        
                        // Log critical element status
                        if (!elements.spinBtn) {
                            app.log('Roulette', 'Warning: spin button not found', true);
                        }
                        
                        if (!elements.wheel) {
                            app.log('Roulette', 'Warning: wheel element not found', true);
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
         * Create the roulette wheel interface
         */
        const createRouletteWheel = function() {
            try {
                if (!elements.wheel) {
                    app.log('Roulette', 'Cannot create wheel: element not found', true);
                    return;
                }
                
                // Clear existing wheel
                elements.wheel.innerHTML = '';
                
                // Add the numbers to the wheel
                numbers.forEach((number, index) => {
                    const angle = (index * 360 / numbers.length);
                    const color = numberColors[number.toString()];
                    
                    const numberEl = document.createElement('div');
                    numberEl.className = `wheel-number ${color}`;
                    numberEl.textContent = number;
                    numberEl.style.transform = `rotate(${angle}deg) translateY(-120px)`;
                    
                    elements.wheel.appendChild(numberEl);
                });
                
                // Add CSS if not already present
                if (!document.getElementById('roulette-styles')) {
                    const style = document.createElement('style');
                    style.id = 'roulette-styles';
                    style.textContent = `
                        .roulette-container {
                            padding: 15px;
                            max-width: 500px;
                            margin: 0 auto;
                        }
                        
                        .bet-controls {
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                            margin-bottom: 20px;
                        }
                        
                        .bet-input {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .bet-input label {
                            min-width: 70px;
                        }
                        
                        .bet-input input {
                            flex: 1;
                            padding: 8px;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                        }
                        
                        .potential-win {
                            padding: 10px;
                            background: rgba(0, 168, 107, 0.1);
                            border-radius: 4px;
                            text-align: center;
                        }
                        
                        .wheel-container {
                            position: relative;
                            width: 300px;
                            height: 300px;
                            margin: 20px auto;
                            border-radius: 50%;
                            background: #333;
                            border: 4px solid #222;
                            overflow: hidden;
                        }
                        
                        .wheel {
                            position: relative;
                            width: 100%;
                            height: 100%;
                            transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
                        }
                        
                        .wheel-number {
                            position: absolute;
                            width: 30px;
                            height: 30px;
                            top: 50%;
                            left: 50%;
                            transform-origin: center;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                        }
                        
                        .wheel-number.red {
                            background-color: #e61c39;
                        }
                        
                        .wheel-number.black {
                            background-color: #1d1d1d;
                        }
                        
                        .wheel-number.green {
                            background-color: #00a86b;
                        }
                        
                        .ball {
                            position: absolute;
                            width: 12px;
                            height: 12px;
                            border-radius: 50%;
                            background: white;
                            top: 50%;
                            left: 50%;
                            margin: -6px 0 0 -6px;
                            transform: translateY(-130px);
                            transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
                            z-index: 10;
                        }
                        
                        .result {
                            margin-top: 20px;
                            padding: 15px;
                            text-align: center;
                            border-radius: 4px;
                            display: none;
                        }
                        
                        .result.win {
                            background-color: rgba(0, 168, 107, 0.2);
                            color: #00a86b;
                        }
                        
                        .result.lose {
                            background-color: rgba(230, 28, 57, 0.2);
                            color: #e61c39;
                        }
                    `;
                    
                    document.head.appendChild(style);
                }
                
                app.log('Roulette', 'Wheel created successfully');
            } catch (error) {
                app.log('Roulette', `Error creating wheel: ${error.message}`, true);
            }
        };
        
        /**
         * Set up event listeners
         */
        const setupEventListeners = function() {
            try {
                // Spin button
                if (elements.spinBtn) {
                    // Prevent duplicate listeners
                    const newBtn = elements.spinBtn.cloneNode(true);
                    if (elements.spinBtn.parentNode) {
                        elements.spinBtn.parentNode.replaceChild(newBtn, elements.spinBtn);
                    }
                    elements.spinBtn = newBtn;
                    
                    // Add click handler
                    elements.spinBtn.addEventListener('click', spinWheel);
                    app.log('Roulette', 'Spin button event listener set up');
                } else {
                    app.log('Roulette', 'Cannot set up event listener: spin button not found', true);
                }
            } catch (error) {
                app.log('Roulette', `Error setting up event listeners: ${error.message}`, true);
            }
        };
        
        /**
         * Set up bet input change handler
         */
        const setupBetInputHandler = function() {
            try {
                if (elements.betInput && elements.potentialWin) {
                    elements.betInput.addEventListener('input', updatePotentialWin);
                    // Initialize potential win display
                    updatePotentialWin();
                }
            } catch (error) {
                app.log('Roulette', `Error setting up bet input handler: ${error.message}`, true);
            }
        };
        
        /**
         * Update potential win amount when bet changes
         */
        const updatePotentialWin = function() {
            try {
                if (!elements.betInput || !elements.potentialWin) return;
                
                const betAmount = parseInt(elements.betInput.value) || 0;
                // Standard roulette straight-up bet pays 35:1
                const potential = betAmount * 35;
                
                elements.potentialWin.textContent = potential;
            } catch (error) {
                app.log('Roulette', `Error updating potential win: ${error.message}`, true);
            }
        };
        
        /**
         * Main game action - spin the wheel
         */
        const spinWheel = async function() {
            app.log('Roulette', 'Starting wheel spin');
            
            // Check if initialized
            if (!state.initialized) {
                app.log('Roulette', 'Game not initialized, starting initialization', true);
                await init();
                
                if (!state.initialized) {
                    app.log('Roulette', 'Failed to start game: initialization error', true);
                    return;
                }
            }
            
            try {
                // Check if casino app is available
                if (!window.casinoApp) {
                    app.log('Roulette', 'casinoApp not found', true);
                    alert('Application initialization error');
                    return;
                }
                
                // Check if already spinning
                if (state.isSpinning) {
                    app.log('Roulette', 'Wheel is already spinning');
                    return;
                }
                
                // Check for required elements
                if (!elements.betInput || !elements.wheel || !elements.ball) {
                    app.log('Roulette', 'Required elements not found', true);
                    window.casinoApp.showNotification('Game error: Missing UI elements');
                    return;
                }
                
                // Get bet amount
                const betAmount = parseInt(elements.betInput.value);
                
                // Validate bet
                if (isNaN(betAmount) || betAmount <= 0) {
                    window.casinoApp.showNotification('Please enter a valid bet amount');
                    return;
                }
                
                // Check if sufficient balance
                if (betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Insufficient balance for this bet');
                    return;
                }
                
                // Set spinning state
                state.isSpinning = true;
                if (elements.spinBtn) {
                    elements.spinBtn.disabled = true;
                }
                
                // Hide previous result
                if (elements.resultDisplay) {
                    elements.resultDisplay.style.display = 'none';
                }
                
                // Provide tactile feedback
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Process the bet with the server first
                await window.casinoApp.processGameResult(
                    'roulette',
                    betAmount,
                    'bet',
                    0,
                    { betType: 'straight-up' }
                );
                
                // Spin the wheel with timeout protection
                const result = await spinWheelWithTimeout();
                
                // Calculate win
                const winningNumber = result.number;
                const winningColor = numberColors[winningNumber.toString()];
                
                // Determine outcome
                const isWin = false; // In straight-up bet, all numbers lose by default
                const winAmount = isWin ? betAmount * 35 : 0;
                
                // Display the result
                displayResult(winningNumber, winningColor, isWin, winAmount);
                
                // Provide tactile feedback based on result
                if (window.casinoApp.provideTactileFeedback) {
                    if (isWin) {
                        window.casinoApp.provideTactileFeedback('success');
                    } else {
                        window.casinoApp.provideTactileFeedback('warning');
                    }
                }
                
                // Send result to server
                await window.casinoApp.processGameResult(
                    'roulette',
                    0, // No additional bet
                    isWin ? 'win' : 'lose',
                    winAmount,
                    {
                        number: winningNumber,
                        color: winningColor,
                        betType: 'straight-up'
                    }
                );
                
            } catch (error) {
                app.log('Roulette', `Error during spin: ${error.message}`, true);
                window.casinoApp.showNotification('An error occurred. Please try again.');
            } finally {
                // Reset state
                state.isSpinning = false;
                if (elements.spinBtn) {
                    elements.spinBtn.disabled = false;
                }
            }
        };
        
        /**
         * Spin wheel animation with timeout protection
         */
        const spinWheelWithTimeout = function() {
            return Promise.race([
                performSpinAnimation(),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Spin animation timeout'));
                    }, 6000); // 6 seconds max for animation
                })
            ]);
        };
        
        /**
         * Perform the wheel spin animation
         */
        const performSpinAnimation = function() {
            return new Promise((resolve) => {
                try {
                    // Generate a random outcome
                    const randomIndex = Math.floor(Math.random() * numbers.length);
                    const winningNumber = numbers[randomIndex];
                    
                    // Calculate rotation for animation
                    const rotations = 3 + Math.floor(Math.random() * 3); // 3-5 full rotations
                    const finalAngle = rotations * 360 + (randomIndex * 360 / numbers.length);
                    
                    // Animate the wheel and ball
                    if (elements.wheel && elements.ball) {
                        elements.wheel.style.transform = `rotate(${-finalAngle}deg)`;
                        elements.ball.style.transform = `rotate(${finalAngle}deg) translateY(-130px)`;
                        
                        // Wait for animation to complete
                        setTimeout(() => {
                            resolve({
                                number: winningNumber,
                                index: randomIndex
                            });
                        }, 4000); // Animation duration
                    } else {
                        // Fallback if elements not found
                        setTimeout(() => {
                            resolve({
                                number: winningNumber,
                                index: randomIndex
                            });
                        }, 1000);
                    }
                } catch (error) {
                    app.log('Roulette', `Animation error: ${error.message}`, true);
                    
                    // Generate a fallback result
                    const fallbackNumber = numbers[Math.floor(Math.random() * numbers.length)];
                    resolve({
                        number: fallbackNumber,
                        index: numbers.indexOf(fallbackNumber)
                    });
                }
            });
        };
        
        /**
         * Display the game result
         */
        const displayResult = function(number, color, isWin, amount) {
            try {
                if (!elements.resultDisplay) {
                    app.log('Roulette', 'Result display element not found', true);
                    return;
                }
                
                // Update result display content
                elements.resultDisplay.innerHTML = `
                    <div class="result-number ${color}">${number}</div>
                    <div class="result-text">
                        Ball landed on <strong>${number} ${color}</strong>
                    </div>
                    <div class="result-outcome">
                        ${isWin 
                            ? `<div class="win-message">You won ${amount} ⭐!</div>` 
                            : '<div class="lose-message">Better luck next time!</div>'}
                    </div>
                `;
                
                // Apply appropriate class for styling
                elements.resultDisplay.className = 'result';
                elements.resultDisplay.classList.add(isWin ? 'win' : 'lose');
                
                // Show the result with animation
                elements.resultDisplay.style.display = 'block';
                
                // Save the result
                state.lastResult = {
                    number,
                    color,
                    isWin,
                    amount
                };
                
            } catch (error) {
                app.log('Roulette', `Error displaying result: ${error.message}`, true);
            }
        };
        
        // Public API
        return {
            // Core methods
            init: init,
            spinWheel: spinWheel,
            
            // Helper method to get game status
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isSpinning: state.isSpinning,
                    elementsFound: {
                        spinBtn: !!elements.spinBtn,
                        betInput: !!elements.betInput,
                        wheel: !!elements.wheel,
                        ball: !!elements.ball,
                        resultDisplay: !!elements.resultDisplay
                    },
                    lastResult: state.lastResult
                };
            }
        };
    })();
    
    // Register game
    try {
        // Register with new system
        if (window.registerGame) {
            window.registerGame('rouletteGame', rouletteGame);
            app.log('Roulette', 'Game registered with registerGame system');
        }
        
        // Export to global namespace for compatibility
        window.rouletteGame = rouletteGame;
        app.log('Roulette', 'Game exported to global namespace');
        
        // Auto-initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!rouletteGame.getStatus().initialized && 
                    !rouletteGame.getStatus().initializationStarted) {
                    app.log('Roulette', 'Running automatic initialization');
                    rouletteGame.init();
                }
            }, 500);
        });
        
        // Initialize immediately if DOM is already loaded
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!rouletteGame.getStatus().initialized && 
                    !rouletteGame.getStatus().initializationStarted) {
                    app.log('Roulette', 'Running immediate initialization (DOM already loaded)');
                    rouletteGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Roulette', `Error registering game: ${error.message}`, true);
    }
  })();