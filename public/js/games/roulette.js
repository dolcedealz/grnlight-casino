/**
 * roulette.js - Optimized version of the Roulette game with proper tab isolation
 * Version 2.1.0
 */

// Create a safer scope
(function() {
    // Check for main app object
    if (!window.GreenLightApp) {
      console.error('[Roulette] GreenLightApp is not initialized!');
      window.GreenLightApp = {
        log: function(source, message, isError) {
          if (isError) console.error(`[${source}] ${message}`);
          else console.log(`[${source}] ${message}`);
        }
      };
    }
    
    const app = window.GreenLightApp;
    app.log('Roulette', 'Initializing Roulette game module v2.1.0');
    
    // Game logic
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
        wheelInner: null,
        rouletteBall: null,
        rouletteResult: null,
        container: null
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
      
      // Numbers on the roulette wheel
      const numbers = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
        5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
      ];
      
      // Color map for numbers
      const numberColors = {
        '0': 'green',
        '1': 'red', '2': 'black', '3': 'red', '4': 'black', '5': 'red',
        '6': 'black', '7': 'red', '8': 'black', '9': 'red', '10': 'black',
        '11': 'black', '12': 'red', '13': 'black', '14': 'red', '15': 'black',
        '16': 'red', '17': 'black', '18': 'red', '19': 'red', '20': 'black',
        '21': 'red', '22': 'black', '23': 'red', '24': 'black', '25': 'red',
        '26': 'black', '27': 'red', '28': 'black', '29': 'black', '30': 'red',
        '31': 'black', '32': 'red', '33': 'black', '34': 'red', '35': 'black',
        '36': 'red'
      };
      
      /**
       * Check if the roulette tab is currently active
       */
      function isRouletteTabActive() {
        const rouletteScreen = document.getElementById('roulette-screen');
        return rouletteScreen && rouletteScreen.classList.contains('active');
      }
      
      /**
       * Create game container - FIXED to only work on roulette screen
       */
      function createGameContainer() {
        try {
          // IMPORTANT: Only create the container if we're on the roulette screen
          const rouletteScreen = document.getElementById('roulette-screen');
          if (!rouletteScreen || !rouletteScreen.classList.contains('active')) {
            app.log('Roulette', 'Not on roulette screen, skipping container creation');
            return null;
          }
          
          // Check if container already exists within the roulette screen
          let container = rouletteScreen.querySelector('.roulette-container');
          if (container) {
            elements.container = container;
            return container;
          }
          
          // Create container directly inside the roulette screen
          container = document.createElement('div');
          container.className = 'roulette-container game-container';
          rouletteScreen.appendChild(container);
          
          elements.container = container;
          app.log('Roulette', 'Created main game container within roulette screen');
          
          return container;
        } catch (error) {
          app.log('Roulette', `Error creating container: ${error.message}`, true);
          return null;
        }
      }
      
      /**
       * Create game interface
       */
      function createGameInterface() {
        try {
          // First ensure we're on the roulette tab
          if (!isRouletteTabActive()) {
            app.log('Roulette', 'Not on roulette tab, skipping interface creation');
            return false;
          }
          
          const container = elements.container || createGameContainer();
          if (!container) {
            app.log('Roulette', 'Cannot create interface: container not found', true);
            return false;
          }
          
          // Check if interface already exists
          if (container.querySelector('#wheel-inner')) {
            app.log('Roulette', 'Interface already created');
            return true;
          }
          
          // Create HTML markup
          container.innerHTML = `
            <div class="roulette-wheel-container">
              <div class="roulette-wheel">
                <div class="wheel-outer">
                  <div id="wheel-inner" class="wheel-inner"></div>
                  <div id="roulette-ball" class="ball"></div>
                </div>
              </div>
            </div>
            
            <div id="roulette-result" class="result"></div>
            
            <div class="bet-controls">
              <div class="bet-type">
                <label for="roulette-bet-type">Bet Type:</label>
                <select id="roulette-bet-type">
                  <option value="color">Color</option>
                  <option value="number">Number</option>
                  <option value="odd-even">Odd/Even</option>
                </select>
              </div>
              
              <div id="bet-color-container" class="bet-options">
                <button class="color-btn red" data-color="red">Red</button>
                <button class="color-btn black" data-color="black">Black</button>
                <button class="color-btn green" data-color="green">Green (0)</button>
              </div>
              
              <div id="bet-number-container" class="bet-options hidden">
                <label for="roulette-number">Choose a number (0-36):</label>
                <input type="number" id="roulette-number" min="0" max="36" value="0">
              </div>
              
              <div id="bet-odd-even-container" class="bet-options hidden">
                <button class="odd-even-btn" data-type="odd">Odd</button>
                <button class="odd-even-btn" data-type="even">Even</button>
              </div>
              
              <div class="bet-amount">
                <label for="roulette-bet">Bet Amount:</label>
                <input type="number" id="roulette-bet" min="1" value="10">
              </div>
              
              <button id="spin-wheel-btn" class="action-btn">SPIN</button>
            </div>
          `;
          
          // Create styles if needed
          if (!document.getElementById('roulette-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'roulette-styles';
            styleElement.textContent = `
              .roulette-container {
                padding: 15px;
                margin: 10px auto;
                border: 1px solid var(--primary-green);
                border-radius: 8px;
                max-width: 600px;
                background: var(--medium-gray);
              }
              
              .roulette-wheel-container {
                display: flex;
                justify-content: center;
                margin-bottom: 20px;
              }
              
              .roulette-wheel {
                width: 280px;
                height: 280px;
                position: relative;
                margin: 0 auto;
              }
              
              .wheel-outer {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: var(--medium-gray);
                display: flex;
                justify-content: center;
                align-items: center;
                border: 3px solid var(--gold);
                overflow: hidden;
              }
              
              .wheel-inner {
                width: 90%;
                height: 90%;
                border-radius: 50%;
                background-color: var(--dark-gray);
                position: relative;
                transform-origin: center;
                transition: transform 4s ease-out;
                border: 3px solid #444;
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
              }
              
              .wheel-number.red {
                background: var(--lose-color);
              }
              
              .wheel-number.black {
                background: var(--black);
              }
              
              .wheel-number.green {
                background: var(--primary-green);
              }
              
              .ball {
                position: absolute;
                width: 10px;
                height: 10px;
                background: white;
                border-radius: 50%;
                transform-origin: center;
                transition: transform 4s ease-out;
                z-index: 2;
              }
              
              .bet-controls {
                display: flex;
                flex-direction: column;
                gap: 15px;
                max-width: 400px;
                margin: 0 auto;
              }
              
              .bet-type {
                display: flex;
                flex-direction: column;
                gap: 5px;
              }
              
              .bet-options {
                display: flex;
                justify-content: center;
                gap: 10px;
              }
              
              .color-btn, .odd-even-btn {
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                color: white;
              }
              
              .color-btn.red {
                background-color: #e53935;
              }
              
              .color-btn.black {
                background-color: #212121;
              }
              
              .color-btn.green {
                background-color: #43a047;
              }
              
              .odd-even-btn {
                background-color: var(--primary-green);
                flex: 1;
              }
              
              .color-btn.selected, .odd-even-btn.selected {
                box-shadow: 0 0 0 2px white, 0 0 0 4px var(--gold);
              }
              
              .bet-amount {
                display: flex;
                flex-direction: column;
                gap: 5px;
              }
              
              .hidden {
                display: none !important;
              }
              
              .action-btn {
                background: var(--primary-green);
                color: white;
                border: none;
                padding: 12px;
                border-radius: 4px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.3s;
              }
              
              .action-btn:hover {
                background: #018d5a;
              }
              
              .action-btn:disabled {
                background: #888;
                cursor: not-allowed;
              }
              
              .result {
                margin: 15px 0;
                padding: 15px;
                text-align: center;
                border-radius: 4px;
                font-size: 1.1rem;
              }
              
              .result.win {
                background: rgba(76, 175, 80, 0.1);
                color: var(--win-color);
                border: 1px solid var(--win-color);
              }
              
              .result.lose {
                background: rgba(244, 67, 54, 0.1);
                color: var(--lose-color);
                border: 1px solid var(--lose-color);
              }
            `;
            document.head.appendChild(styleElement);
          }
          
          app.log('Roulette', 'Game interface successfully created');
          return true;
        } catch (error) {
          app.log('Roulette', `Error creating interface: ${error.message}`, true);
          return false;
        }
      }
      
      /**
       * Find DOM elements
       */
      async function findDOMElements() {
        return new Promise((resolve, reject) => {
          try {
            // Only search for elements if on the roulette tab
            if (!isRouletteTabActive()) {
              app.log('Roulette', 'Not on roulette tab, skipping DOM element search');
              resolve(false);
              return;
            }
            
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
              elements.wheelInner = document.getElementById('wheel-inner');
              elements.rouletteBall = document.getElementById('roulette-ball');
              elements.rouletteResult = document.getElementById('roulette-result');
              
              // Check critical elements
              if (!elements.spinWheelBtn) {
                app.log('Roulette', 'Warning: element spin-wheel-btn not found', true);
              }
              
              if (!elements.wheelInner) {
                app.log('Roulette', 'Warning: element wheel-inner not found', true);
              }
              
              resolve(true);
            }, 100);
          } catch (error) {
            app.log('Roulette', `Error finding DOM elements: ${error.message}`, true);
            reject(error);
          }
        });
      }
      
      /**
       * Setup the roulette wheel
       */
      function setupWheel() {
        try {
          if (!elements.wheelInner) {
            app.log('Roulette', 'Cannot setup wheel: wheel-inner element not found', true);
            return;
          }
          
          // Clear current wheel
          elements.wheelInner.innerHTML = '';
          
          // Create number cells
          numbers.forEach((number, index) => {
            // Calculate position on wheel
            const angle = (index * 360 / numbers.length);
            const color = numberColors[number.toString()];
            
            // Create number element
            const numberElement = document.createElement('div');
            numberElement.className = `wheel-number ${color}`;
            numberElement.textContent = number;
            numberElement.style.transform = `rotate(${angle}deg) translateY(-110px)`;
            
            elements.wheelInner.appendChild(numberElement);
          });
          
          // Position the ball
          if (elements.rouletteBall) {
            elements.rouletteBall.style.transform = 'rotate(0deg) translateY(-90px)';
          }
          
          app.log('Roulette', 'Roulette wheel successfully setup');
        } catch (error) {
          app.log('Roulette', `Error setting up wheel: ${error.message}`, true);
        }
      }
      
      /**
       * Set up event listeners
       */
      function setupEventListeners() {
        try {
          // Spin button
          if (elements.spinWheelBtn) {
            const newSpinBtn = elements.spinWheelBtn.cloneNode(true);
            if (elements.spinWheelBtn.parentNode) {
              elements.spinWheelBtn.parentNode.replaceChild(newSpinBtn, elements.spinWheelBtn);
            }
            elements.spinWheelBtn = newSpinBtn;
            
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
          
          // Add observer for tab changes to reinitialize if needed
          setupTabChangeObserver();
          
          app.log('Roulette', 'Event handlers set up');
        } catch (error) {
          app.log('Roulette', `Error setting up event handlers: ${error.message}`, true);
        }
      }
      
      /**
       * Setup observer to watch for tab changes
       */
      function setupTabChangeObserver() {
        try {
          // Find roulette screen element
          const rouletteScreen = document.getElementById('roulette-screen');
          if (!rouletteScreen) return;
          
          // Create a mutation observer to watch for class changes
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.attributeName === 'class') {
                const isActive = rouletteScreen.classList.contains('active');
                app.log('Roulette', `Roulette tab active state changed to: ${isActive}`);
                
                // If tab became active and game not initialized, initialize it
                if (isActive && !state.initialized && !state.initializationStarted) {
                  app.log('Roulette', 'Tab became active, initializing game');
                  init();
                }
              }
            });
          });
          
          // Start observing
          observer.observe(rouletteScreen, { attributes: true });
          app.log('Roulette', 'Tab change observer set up');
        } catch (error) {
          app.log('Roulette', `Error setting up tab observer: ${error.message}`, true);
        }
      }
      
      /**
       * Change bet type
       */
      function changeBetType() {
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
          
          // Reset selection
          state.selectedColor = null;
          state.selectedOddEven = null;
          
          elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
          elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
          
        } catch (error) {
          app.log('Roulette', `Error changing bet type: ${error.message}`, true);
        }
      }
      
      /**
       * Select color
       */
      function selectColor(event) {
        try {
          // Remove selection from all color buttons
          elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
          
          // Add selection to clicked button
          event.target.classList.add('selected');
          
          // Save selected color
          state.selectedColor = event.target.getAttribute('data-color');
          
          // Tactile feedback
          if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
            window.casinoApp.provideTactileFeedback('light');
          }
          
        } catch (error) {
          app.log('Roulette', `Error selecting color: ${error.message}`, true);
        }
      }
      
      /**
       * Select odd/even
       */
      function selectOddEven(event) {
        try {
          // Remove selection from all odd/even buttons
          elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
          
          // Add selection to clicked button
          event.target.classList.add('selected');
          
          // Save selected type
          state.selectedOddEven = event.target.getAttribute('data-type');
          
          // Tactile feedback
          if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
            window.casinoApp.provideTactileFeedback('light');
          }
          
        } catch (error) {
          app.log('Roulette', `Error selecting odd/even: ${error.message}`, true);
        }
      }
      
      /**
       * Check and initialize casinoApp object
       */
      function ensureCasinoApp() {
        if (window.casinoApp) return true;
        
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
          }
        };
        
        return true;
      }
      
      /**
       * Initialize game
       */
      async function init() {
        // First check if we're on the roulette tab
        if (!isRouletteTabActive()) {
          app.log('Roulette', 'Not on roulette tab, postponing initialization');
          return false;
        }
        
        // Prevent duplicate initialization
        if (state.initialized || state.initializationStarted) {
          return true;
        }
        
        state.initializationStarted = true;
        app.log('Roulette', 'Starting game initialization');
        
        try {
          const initPromise = new Promise(async (resolve) => {
            try {
              if (!createGameInterface()) {
                resolve(false);
                return;
              }
              
              const elementsFound = await findDOMElements();
              if (!elementsFound) {
                resolve(false);
                return;
              }
              
              setupWheel();
              setupEventListeners();
              
              state.initialized = true;
              app.log('Roulette', 'Initialization completed successfully');
              resolve(true);
            } catch (error) {
              app.log('Roulette', `Error during initialization: ${error.message}`, true);
              resolve(false);
            }
          });
          
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
              app.log('Roulette', 'Initialization timeout', true);
              resolve(false);
            }, 3000);
          });
          
          return await Promise.race([initPromise, timeoutPromise]);
          
        } catch (error) {
          app.log('Roulette', `Critical initialization error: ${error.message}`, true);
          return false;
        }
      }
      
      /**
       * Spin the wheel with timeout protection
       */
      function spinWheelWithTimeout() {
        return Promise.race([
          spinWheel(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Wheel animation timeout'));
            }, 6000); // 6 seconds max for animation
          })
        ]);
      }
      
      /**
       * Wheel spinning animation
       */
      function spinWheel() {
        return new Promise((resolve) => {
          try {
            // Random number of full rotations (3-6)
            const rotations = 3 + Math.floor(Math.random() * 3);
            
            // Get random result
            const randomIndex = Math.floor(Math.random() * numbers.length);
            const winningNumber = numbers[randomIndex];
            
            // Calculate final position
            const finalAngle = rotations * 360 + (randomIndex * 360 / numbers.length);
            
            if (!elements.wheelInner || !elements.rouletteBall) {
              app.log('Roulette', 'Wheel elements not found', true);
              // Return result even without animation
              setTimeout(() => resolve(winningNumber), 1000);
              return;
            }
            
            // Animate wheel and ball
            elements.wheelInner.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
            elements.rouletteBall.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
            
            elements.wheelInner.style.transform = `rotate(${-finalAngle}deg)`;
            elements.rouletteBall.style.transform = `rotate(${finalAngle}deg) translateY(-90px)`;
            
            // Return result after animation completes
            setTimeout(() => {
              resolve(winningNumber);
            }, 4500);
          } catch (error) {
            app.log('Roulette', `Wheel animation error: ${error.message}`, true);
            // Generate random number even if animation fails
            const fallbackNumber = numbers[Math.floor(Math.random() * numbers.length)];
            resolve(fallbackNumber);
          }
        });
      }
      
      /**
       * Check if the player won
       */
      function checkWin(result) {
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
      }
      
      /**
       * Display result
       */
      function displayResult(isWin, amount, number) {
        try {
          if (!elements.rouletteResult) {
            app.log('Roulette', 'Result element not found', true);
            return;
          }
          
          if (isWin) {
            elements.rouletteResult.textContent = `Number ${number} - You won ${amount} Stars! 🎉`;
            elements.rouletteResult.classList.add('win');
            elements.rouletteResult.classList.remove('lose');
          } else {
            elements.rouletteResult.textContent = `Number ${number} - Better luck next time!`;
            elements.rouletteResult.classList.add('lose');
            elements.rouletteResult.classList.remove('win');
          }
          
        } catch (error) {
          app.log('Roulette', `Error displaying result: ${error.message}`, true);
        }
      }
      
      /**
       * Spin the wheel
       */
      async function spin() {
        app.log('Roulette', 'Starting wheel spin');
        
        if (!state.initialized) {
          await init();
          
          if (!state.initialized) {
            app.log('Roulette', 'Failed to start game: initialization error', true);
            return;
          }
        }
        
        try {
          if (!ensureCasinoApp()) return;
          
          if (state.isSpinning) {
            app.log('Roulette', 'Wheel is already spinning');
            return;
          }
          
          if (!elements.rouletteBet) {
            app.log('Roulette', 'Bet element not found', true);
            return;
          }
          
          const betAmount = parseInt(elements.rouletteBet.value);
          
          if (isNaN(betAmount) || betAmount <= 0) {
            window.casinoApp.showNotification('Please enter a valid bet amount');
            return;
          }
          
          // Check if enough funds (if user object available)
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
            window.casinoApp.showNotification('Number input error');
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
          
          // Tactile feedback on start
          if (window.casinoApp.provideTactileFeedback) {
            window.casinoApp.provideTactileFeedback('medium');
          }
          
          try {
            // Process initial bet with server
            await window.casinoApp.processGameResult(
              'roulette',
              betAmount,
              'bet',
              0,
              {
                betType: state.selectedBetType,
                selectedColor: state.selectedColor,
                selectedNumber: state.selectedBetType === 'number' ? 
                  parseInt(elements.rouletteNumber.value) : null,
                selectedOddEven: state.selectedOddEven
              }
            );
            
            // Start wheel animation with timeout protection
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
              0, // No additional bet
              winResult.win ? 'win' : 'lose',
              winAmount,
              gameData
            );
            
          } catch (error) {
            app.log('Roulette', `Error during game: ${error.message}`, true);
            window.casinoApp.showNotification('An error occurred. Please try again.');
          } finally {
            // Reset state regardless of errors
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
      }
      
      // Return public interface
      return {
        // Main methods
        init: init,
        spin: spin,
        
        // Method to check game status
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
    
    // Register game in all formats for maximum compatibility
    try {
      // 1. Register through new system
      if (window.registerGame) {
        window.registerGame('rouletteGame', rouletteGame);
        app.log('Roulette', 'Game registered through new registerGame system');
      }
      
      // 2. Export to global namespace (backward compatibility)
      window.rouletteGame = rouletteGame;
      app.log('Roulette', 'Game exported to global namespace');
      
      // 3. Log successful module loading
      app.log('Roulette', 'Module successfully loaded and ready for initialization');
      
      // 4. Automatic initialization when document is ready
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
          const rouletteScreen = document.getElementById('roulette-screen');
          if (rouletteScreen && rouletteScreen.classList.contains('active')) {
            app.log('Roulette', 'Roulette tab is active, starting automatic initialization');
            rouletteGame.init();
          } else {
            app.log('Roulette', 'Roulette tab not active, initialization deferred');
          }
        }, 500);
      });
      
      // 5. Initialize immediately if DOM already loaded and on roulette tab
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
          const rouletteScreen = document.getElementById('roulette-screen');
          if (rouletteScreen && rouletteScreen.classList.contains('active')) {
            app.log('Roulette', 'Roulette tab is active (DOM already loaded), starting automatic initialization');
            rouletteGame.init();
          }
        }, 500);
      }
      
    } catch (error) {
      app.log('Roulette', `Error registering game: ${error.message}`, true);
    }
  })();