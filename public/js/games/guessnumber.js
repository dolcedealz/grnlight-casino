/**
 * guessnumber.js - Enhanced version of Guess the Number game with casino edge
 * Version 3.0.0
 * 
 * Features:
 * - Tab-isolated implementation
 * - Non-blocking initialization
 * - Advanced error handling
 * - Casino edge to ensure long-term profit
 * - Compatible with the casino app system
 */

// Create a safer scope
(function() {
    // Check for main app object
    if (!window.GreenLightApp) {
      console.error('[GuessNumber] GreenLightApp is not initialized!');
      window.GreenLightApp = {
        log: function(source, message, isError) {
          if (isError) console.error(`[${source}] ${message}`);
          else console.log(`[${source}] ${message}`);
        }
      };
    }
    
    const app = window.GreenLightApp;
    app.log('GuessNumber', 'Initializing Guess Number game module v3.0.0');
    
    // Game logic
    const guessNumberGame = (function() {
      // Game elements
      let elements = {
        guessBtn: null,
        guessBet: null,
        guessInput: null,
        guessResult: null,
        minRange: null,
        maxRange: null,
        container: null
      };
      
      // Game state
      let state = {
        isProcessing: false,
        initialized: false,
        initializationStarted: false,
        minNumber: 1,
        maxNumber: 100,
        // House edge and player statistics
        playerStats: {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          totalBet: 0,
          totalWon: 0
        }
      };
      
      /**
       * Check if the guess number tab is currently active
       */
      function isGuessNumberTabActive() {
        const guessNumberScreen = document.getElementById('guessnumber-screen');
        return guessNumberScreen && guessNumberScreen.classList.contains('active');
      }
      
      /**
       * Create game container - Only in the guess number screen
       */
      function createGameContainer() {
        try {
          // Only create container if on the guess number screen
          const guessNumberScreen = document.getElementById('guessnumber-screen');
          if (!guessNumberScreen || !guessNumberScreen.classList.contains('active')) {
            app.log('GuessNumber', 'Not on guess number screen, skipping container creation');
            return null;
          }
          
          // Check if container already exists
          let container = guessNumberScreen.querySelector('.guessnumber-container');
          if (container) {
            elements.container = container;
            return container;
          }
          
          // Create container directly inside the guess number screen
          container = document.createElement('div');
          container.className = 'guessnumber-container game-container';
          guessNumberScreen.appendChild(container);
          
          elements.container = container;
          app.log('GuessNumber', 'Created main game container within guess number screen');
          
          return container;
        } catch (error) {
          app.log('GuessNumber', `Error creating container: ${error.message}`, true);
          return null;
        }
      }
      
      /**
       * Create game interface
       */
      function createGameInterface() {
        try {
          // First ensure we're on the guess number tab
          if (!isGuessNumberTabActive()) {
            app.log('GuessNumber', 'Not on guess number tab, skipping interface creation');
            return false;
          }
          
          const container = elements.container || createGameContainer();
          if (!container) {
            app.log('GuessNumber', 'Cannot create interface: container not found', true);
            return false;
          }
          
          // Check if interface already exists
          if (container.querySelector('#guess-btn')) {
            app.log('GuessNumber', 'Interface already created');
            return true;
          }
          
          // Create HTML markup
          container.innerHTML = `
            <div class="number-range">
              <p>Guess a number between <span id="min-range">${state.minNumber}</span> and <span id="max-range">${state.maxNumber}</span></p>
            </div>
            
            <div class="guess-input">
              <input type="number" id="guess-input" min="${state.minNumber}" max="${state.maxNumber}" value="${Math.floor((state.minNumber + state.maxNumber) / 2)}">
            </div>
            
            <div id="guess-result" class="result"></div>
            
            <div class="bet-controls">
              <div class="bet-amount">
                <label for="guess-bet">Bet Amount:</label>
                <input type="number" id="guess-bet" min="1" value="10">
              </div>
              
              <button id="guess-btn" class="action-btn">GUESS</button>
            </div>
            
            <div class="reward-info">
              <h3>Rewards:</h3>
              <ul>
                <li>Exact match: 10x your bet</li>
                <li>Within 5 numbers: 3x your bet</li>
                <li>Within 10 numbers: 1.5x your bet</li>
              </ul>
            </div>
          `;
          
          // Create styles if needed
          if (!document.getElementById('guessnumber-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'guessnumber-styles';
            styleElement.textContent = `
              .guessnumber-container {
                padding: 15px;
                margin: 10px auto;
                border: 1px solid var(--primary-green);
                border-radius: 8px;
                max-width: 500px;
                background: var(--medium-gray);
              }
              
              .number-range {
                text-align: center;
                padding: 15px;
                margin-bottom: 20px;
                background: var(--dark-gray);
                border-radius: 8px;
                border: 1px solid var(--primary-green);
              }
              
              .number-range span {
                color: var(--gold);
                font-weight: bold;
              }
              
              .guess-input {
                display: flex;
                justify-content: center;
                margin-bottom: 20px;
              }
              
              .guess-input input {
                width: 150px;
                text-align: center;
                font-size: 24px;
                padding: 10px;
                border-radius: 8px;
                border: 2px solid var(--primary-green);
                background: var(--dark-gray);
                color: var(--gold);
              }
              
              .bet-controls {
                display: flex;
                flex-direction: column;
                gap: 15px;
                max-width: 400px;
                margin: 20px auto;
              }
              
              .bet-amount {
                display: flex;
                flex-direction: column;
                gap: 5px;
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
                display: none;
              }
              
              .result.visible {
                display: block;
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
              
              .reward-info {
                margin-top: 20px;
                background: var(--dark-gray);
                padding: 15px;
                border-radius: 8px;
              }
              
              .reward-info h3 {
                color: var(--gold);
                margin-top: 0;
                margin-bottom: 10px;
              }
              
              .reward-info ul {
                padding-left: 20px;
              }
              
              .reward-info li {
                margin-bottom: 5px;
              }
            `;
            document.head.appendChild(styleElement);
          }
          
          app.log('GuessNumber', 'Game interface successfully created');
          return true;
        } catch (error) {
          app.log('GuessNumber', `Error creating interface: ${error.message}`, true);
          return false;
        }
      }
      
      /**
       * Find DOM elements with protection from null
       */
      async function findDOMElements() {
        return new Promise((resolve, reject) => {
          try {
            // Only search for elements if on the guess number tab
            if (!isGuessNumberTabActive()) {
              app.log('GuessNumber', 'Not on guess number tab, skipping DOM element search');
              resolve(false);
              return;
            }
            
            setTimeout(() => {
              elements.guessBtn = document.getElementById('guess-btn');
              elements.guessBet = document.getElementById('guess-bet');
              elements.guessInput = document.getElementById('guess-input');
              elements.guessResult = document.getElementById('guess-result');
              elements.minRange = document.getElementById('min-range');
              elements.maxRange = document.getElementById('max-range');
              
              // Check critical elements
              if (!elements.guessBtn) {
                app.log('GuessNumber', 'Warning: element guess-btn not found', true);
              }
              
              if (!elements.guessInput) {
                app.log('GuessNumber', 'Warning: element guess-input not found', true);
              }
              
              resolve(true);
            }, 100);
          } catch (error) {
            app.log('GuessNumber', `Error finding DOM elements: ${error.message}`, true);
            reject(error);
          }
        });
      }
      
      /**
       * Setup event listeners
       */
      function setupEventListeners() {
        try {
          if (!elements.guessBtn) {
            app.log('GuessNumber', 'Cannot set up event handlers: button not found', true);
            return;
          }
          
          // Clear current handlers (prevent duplication)
          const newGuessBtn = elements.guessBtn.cloneNode(true);
          if (elements.guessBtn.parentNode) {
            elements.guessBtn.parentNode.replaceChild(newGuessBtn, elements.guessBtn);
          }
          elements.guessBtn = newGuessBtn;
          
          // Add handler for guess button
          elements.guessBtn.addEventListener('click', makeGuess);
          
          // Add observer for tab changes to reinitialize if needed
          setupTabChangeObserver();
          
          app.log('GuessNumber', 'Event handlers set up');
        } catch (error) {
          app.log('GuessNumber', `Error setting up event handlers: ${error.message}`, true);
        }
      }
      
      /**
       * Setup observer to watch for tab changes
       */
      function setupTabChangeObserver() {
        try {
          // Find guess number screen element
          const guessNumberScreen = document.getElementById('guessnumber-screen');
          if (!guessNumberScreen) return;
          
          // Create a mutation observer to watch for class changes
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.attributeName === 'class') {
                const isActive = guessNumberScreen.classList.contains('active');
                app.log('GuessNumber', `GuessNumber tab active state changed to: ${isActive}`);
                
                // If tab became active and game not initialized, initialize it
                if (isActive && !state.initialized && !state.initializationStarted) {
                  app.log('GuessNumber', 'Tab became active, initializing game');
                  init();
                }
              }
            });
          });
          
          // Start observing
          observer.observe(guessNumberScreen, { attributes: true });
          app.log('GuessNumber', 'Tab change observer set up');
        } catch (error) {
          app.log('GuessNumber', `Error setting up tab observer: ${error.message}`, true);
        }
      }
      
      /**
       * Check and initialize casinoApp object
       */
      function ensureCasinoApp() {
        if (window.casinoApp) return true;
        
        app.log('GuessNumber', 'casinoApp not found, creating temporary implementation', true);
        window.casinoApp = {
          showNotification: function(message) {
            alert(message);
          },
          provideTactileFeedback: function() {
            // Vibration stub
          },
          processGameResult: function(gameType, bet, result, win, data) {
            app.log('GuessNumber', `Game: ${gameType}, Bet: ${bet}, Result: ${result}, Win: ${win}`, false);
            return Promise.resolve({success: true});
          }
        };
        
        return true;
      }
      
      /**
       * Initialize game
       */
      async function init() {
        // First check if we're on the guess number tab
        if (!isGuessNumberTabActive()) {
          app.log('GuessNumber', 'Not on guess number tab, postponing initialization');
          return false;
        }
        
        // Prevent duplicate initialization
        if (state.initialized || state.initializationStarted) {
          return true;
        }
        
        state.initializationStarted = true;
        app.log('GuessNumber', 'Starting game initialization');
        
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
              
              setupEventListeners();
              
              state.initialized = true;
              app.log('GuessNumber', 'Initialization completed successfully');
              resolve(true);
            } catch (error) {
              app.log('GuessNumber', `Error during initialization: ${error.message}`, true);
              resolve(false);
            }
          });
          
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
              app.log('GuessNumber', 'Initialization timeout', true);
              resolve(false);
            }, 3000);
          });
          
          return await Promise.race([initPromise, timeoutPromise]);
          
        } catch (error) {
          app.log('GuessNumber', `Critical initialization error: ${error.message}`, true);
          return false;
        }
      }
      
      /**
       * Process guess with timeout protection
       */
      function processGuessWithTimeout(playerGuess, betAmount) {
        return Promise.race([
          processGuess(playerGuess, betAmount),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Guess processing timeout'));
            }, 3000); // 3 seconds max for processing
          })
        ]);
      }
      
      /**
       * Process guess and determine result
       * Implements casino edge to ensure house profit over time
       */
      function processGuess(playerGuess, betAmount) {
        return new Promise((resolve) => {
          try {
            // Update player statistics
            state.playerStats.gamesPlayed++;
            state.playerStats.totalBet += betAmount;
            
            // Calculate target house edge (5-10%)
            const targetHouseEdge = 0.07; // 7% house edge
            
            // Calculate current player advantage
            let currentPlayerAdvantage = 0;
            if (state.playerStats.totalBet > 0) {
              currentPlayerAdvantage = state.playerStats.totalWon / state.playerStats.totalBet - 1;
            }
            
            // Determine if we need to adjust win probability
            const standardWinProb = 0.15; // 15% normal win chance (exact + close guesses)
            let adjustedWinProb = standardWinProb;
            
            // If player is winning too much, reduce win probability
            if (currentPlayerAdvantage > -targetHouseEdge) {
              adjustedWinProb = standardWinProb * (1 - (currentPlayerAdvantage + targetHouseEdge));
              adjustedWinProb = Math.max(0.05, adjustedWinProb); // Minimum 5% win chance
            }
            // If player is losing too much, increase win probability slightly
            else if (currentPlayerAdvantage < -(targetHouseEdge * 2)) {
              adjustedWinProb = standardWinProb * 1.2; // 20% increase in win probability
              adjustedWinProb = Math.min(0.25, adjustedWinProb); // Maximum 25% win chance
            }
            
            // Log the adjustment for debugging
            app.log('GuessNumber', `Win probability adjustment: standard=${standardWinProb}, adjusted=${adjustedWinProb}`);
            app.log('GuessNumber', `Player stats: played=${state.playerStats.gamesPlayed}, advantage=${currentPlayerAdvantage}`);
            
            // Generate winning number
            let winningNumber;
            let result;
            
            // For new players (first 3 games), slightly higher win chance to encourage play
            if (state.playerStats.gamesPlayed <= 3) {
              // Generate a number closer to the player's guess for new players
              const range = state.maxNumber - state.minNumber;
              const closeness = Math.random() < 0.3 ? 5 : 15; // 30% chance of being within 5, otherwise within 15
              const minDiff = Math.max(state.minNumber, playerGuess - closeness);
              const maxDiff = Math.min(state.maxNumber, playerGuess + closeness);
              winningNumber = Math.floor(Math.random() * (maxDiff - minDiff + 1)) + minDiff;
            } else {
              // Random number for regular players, with adjusted win probability
              const random = Math.random();
              if (random < adjustedWinProb * 0.2) { // 20% of win probability for exact match
                // Exact match (rare)
                winningNumber = playerGuess;
              } else if (random < adjustedWinProb * 0.6) { // 40% of win probability for close match
                // Close match (within 5)
                const direction = Math.random() < 0.5 ? -1 : 1;
                const offset = Math.floor(Math.random() * 5) + 1;
                winningNumber = playerGuess + (direction * offset);
                // Ensure within range
                winningNumber = Math.max(state.minNumber, Math.min(state.maxNumber, winningNumber));
              } else if (random < adjustedWinProb) { // 40% of win probability for closer match
                // Somewhat close match (within 6-10)
                const direction = Math.random() < 0.5 ? -1 : 1;
                const offset = Math.floor(Math.random() * 5) + 6;
                winningNumber = playerGuess + (direction * offset);
                // Ensure within range
                winningNumber = Math.max(state.minNumber, Math.min(state.maxNumber, winningNumber));
              } else {
                // Not close (loss)
                let offset;
                do {
                  offset = Math.floor(Math.random() * (state.maxNumber - state.minNumber)) + 1;
                } while (Math.abs(offset) <= 10);
                
                const direction = Math.random() < 0.5 ? -1 : 1;
                winningNumber = playerGuess + (direction * offset);
                // Ensure within range
                winningNumber = Math.max(state.minNumber, Math.min(state.maxNumber, winningNumber));
              }
            }
            
            // Calculate final difference
            const difference = Math.abs(winningNumber - playerGuess);
            
            // Determine win and multiplier
            if (difference === 0) {
              // Exact match
              result = {
                win: true,
                multiplier: 10,
                number: winningNumber
              };
              
              state.playerStats.wins++;
              state.playerStats.totalWon += betAmount * 10;
            } else if (difference <= 5) {
              // Close (within 5)
              result = {
                win: true,
                multiplier: 3,
                number: winningNumber
              };
              
              state.playerStats.wins++;
              state.playerStats.totalWon += betAmount * 3;
            } else if (difference <= 10) {
              // Warmer (within 10)
              result = {
                win: true,
                multiplier: 1.5,
                number: winningNumber
              };
              
              state.playerStats.wins++;
              state.playerStats.totalWon += betAmount * 1.5;
            } else {
              // Loss
              result = {
                win: false,
                multiplier: 0,
                number: winningNumber
              };
              
              state.playerStats.losses++;
            }
            
            // Add small delay for better UX
            setTimeout(() => {
              resolve(result);
            }, 800);
            
          } catch (error) {
            app.log('GuessNumber', `Error processing guess: ${error.message}`, true);
            
            // Fallback in case of error
            const fallbackNumber = Math.floor(Math.random() * (state.maxNumber - state.minNumber + 1)) + state.minNumber;
            resolve({
              win: false,
              multiplier: 0,
              number: fallbackNumber
            });
          }
        });
      }
      
      /**
       * Display game result
       */
      function displayResult(isWin, amount, winningNumber, playerGuess) {
        try {
          if (!elements.guessResult) {
            app.log('GuessNumber', 'Result element not found', true);
            return;
          }
          
          elements.guessResult.style.display = 'block';
          
          if (isWin) {
            if (winningNumber === playerGuess) {
              elements.guessResult.innerHTML = `
                <div class="win-icon">🎯</div>
                <div class="win-title">Perfect match!</div>
                <div>Number was ${winningNumber}. You won ${amount} Stars! 🎉</div>
              `;
            } else {
              elements.guessResult.innerHTML = `
                <div class="win-icon">🎉</div>
                <div class="win-title">Close enough!</div>
                <div>Number was ${winningNumber}. You won ${amount} Stars!</div>
              `;
            }
            elements.guessResult.classList.add('win');
            elements.guessResult.classList.remove('lose');
          } else {
            elements.guessResult.innerHTML = `
              <div class="lose-icon">❌</div>
              <div class="lose-title">Not close enough.</div>
              <div>Number was ${winningNumber}. Better luck next time!</div>
            `;
            elements.guessResult.classList.add('lose');
            elements.guessResult.classList.remove('win');
          }
          
          elements.guessResult.classList.add('visible');
          
        } catch (error) {
          app.log('GuessNumber', `Error displaying result: ${error.message}`, true);
        }
      }
      
      /**
       * Make a guess
       */
      async function makeGuess() {
        app.log('GuessNumber', 'Starting guess process');
        
        if (!state.initialized) {
          await init();
          
          if (!state.initialized) {
            app.log('GuessNumber', 'Failed to start game: initialization error', true);
            return;
          }
        }
        
        try {
          if (!ensureCasinoApp()) return;
          
          if (state.isProcessing) {
            app.log('GuessNumber', 'Request already processing');
            return;
          }
          
          if (!elements.guessBet || !elements.guessInput) {
            app.log('GuessNumber', 'Required elements not found', true);
            window.casinoApp.showNotification('Game initialization error');
            return;
          }
          
          const betAmount = parseInt(elements.guessBet.value);
          
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
          
          // Get player's guess
          const playerGuess = parseInt(elements.guessInput.value);
          
          if (isNaN(playerGuess) || playerGuess < state.minNumber || playerGuess > state.maxNumber) {
            window.casinoApp.showNotification(`Please enter a number from ${state.minNumber} to ${state.maxNumber}`);
            return;
          }
          
          // Set processing state
          state.isProcessing = true;
          if (elements.guessBtn) {
            elements.guessBtn.disabled = true;
          }
          
          if (elements.guessResult) {
            elements.guessResult.textContent = '';
            elements.guessResult.className = 'result';
            elements.guessResult.style.display = 'none';
          }
          
          // Tactile feedback on start
          if (window.casinoApp.provideTactileFeedback) {
            window.casinoApp.provideTactileFeedback('medium');
          }
          
          try {
            // Process initial bet with server
            await window.casinoApp.processGameResult(
              'guessnumber',
              betAmount,
              'bet',
              0,
              { playerGuess }
            );
            
            // Process guess with timeout protection
            const result = await processGuessWithTimeout(playerGuess, betAmount);
            
            // Calculate winnings
            const winAmount = result.win ? betAmount * result.multiplier : 0;
            
            // Display result
            displayResult(result.win, winAmount, result.number, playerGuess);
            
            // Tactile feedback based on result
            if (result.win) {
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
              playerGuess,
              winningNumber: result.number,
              difference: Math.abs(result.number - playerGuess)
            };
            
            await window.casinoApp.processGameResult(
              'guessnumber',
              0, // No additional bet
              result.win ? 'win' : 'lose',
              winAmount,
              gameData
            );
            
          } catch (error) {
            app.log('GuessNumber', `Error during game: ${error.message}`, true);
            window.casinoApp.showNotification('An error occurred. Please try again.');
          } finally {
            // Reset state regardless of errors
            state.isProcessing = false;
            if (elements.guessBtn) {
              elements.guessBtn.disabled = false;
            }
          }
          
        } catch (error) {
          app.log('GuessNumber', `Error starting guess: ${error.message}`, true);
          
          // Reset state in case of error
          state.isProcessing = false;
          if (elements.guessBtn) {
            elements.guessBtn.disabled = false;
          }
        }
      }
      
      // Return public interface
      return {
        // Main methods
        init: init,
        makeGuess: makeGuess,
        
        // Method to check game status
        getStatus: function() {
          return {
            initialized: state.initialized,
            initializationStarted: state.initializationStarted,
            isProcessing: state.isProcessing,
            elementsFound: {
              guessBtn: !!elements.guessBtn,
              guessBet: !!elements.guessBet,
              guessInput: !!elements.guessInput,
              guessResult: !!elements.guessResult
            },
            playerStats: {
              gamesPlayed: state.playerStats.gamesPlayed,
              winRate: state.playerStats.gamesPlayed > 0 ? 
                state.playerStats.wins / state.playerStats.gamesPlayed : 0,
              houseEdge: state.playerStats.totalBet > 0 ?
                1 - (state.playerStats.totalWon / state.playerStats.totalBet) : 0
            }
          };
        }
      };
    })();
    
    // Register game in all formats for maximum compatibility
    try {
      // 1. Register through new system
      if (window.registerGame) {
        window.registerGame('guessNumberGame', guessNumberGame);
        app.log('GuessNumber', 'Game registered through new registerGame system');
      }
      
      // 2. Export to global namespace (backward compatibility)
      window.guessNumberGame = guessNumberGame;
      app.log('GuessNumber', 'Game exported to global namespace');
      
      // 3. Log successful module loading
      app.log('GuessNumber', 'Module successfully loaded and ready for initialization');
      
      // 4. Automatic initialization when document is ready
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
          const guessNumberScreen = document.getElementById('guessnumber-screen');
          if (guessNumberScreen && guessNumberScreen.classList.contains('active')) {
            app.log('GuessNumber', 'GuessNumber tab is active, starting automatic initialization');
            guessNumberGame.init();
          } else {
            app.log('GuessNumber', 'GuessNumber tab not active, initialization deferred');
          }
        }, 500);
      });
      
      // 5. Initialize immediately if DOM already loaded and on guess number tab
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
          const guessNumberScreen = document.getElementById('guessnumber-screen');
          if (guessNumberScreen && guessNumberScreen.classList.contains('active')) {
            app.log('GuessNumber', 'GuessNumber tab is active (DOM already loaded), starting automatic initialization');
            guessNumberGame.init();
          }
        }, 500);
      }
      
    } catch (error) {
      app.log('GuessNumber', `Error registering game: ${error.message}`, true);
    }
  })();