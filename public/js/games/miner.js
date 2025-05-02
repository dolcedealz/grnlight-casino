/**
 * miner.js - Improved version of the Miner game
 * Version 3.0.0
 * 
 * Features:
 * - Non-blocking initialization matching the slots game pattern
 * - Enhanced error handling with timeouts
 * - Improved multiplier calculation based on probability formula
 * - Dynamic grid with configurable number of mines
 * - Cashout functionality at any time
 */

// Prevent possible conflicts and provide isolated environment
(function() {
  // Check for the existence of the main app object
  if (!window.GreenLightApp) {
      console.error('[Miner] GreenLightApp not initialized!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Miner', 'Initializing Miner game module v3.0.0');
  
  // Game logic in closure for isolation
  const minerGame = (function() {
      // Game UI elements
      let elements = {
          newGameBtn: null,
          cashoutBtn: null,
          minerBet: null,
          minesCount: null,
          minerGrid: null,
          potentialWin: null,
          minerResult: null,
          container: null
      };
      
      // Game state
      let state = {
          isPlaying: false,
          initialized: false,
          initializationStarted: false,
          gameData: {
              grid: [],
              mines: [],
              revealedCells: [],
              totalCells: 25,  // 5x5 grid
              minesCount: 3,
              currentMultiplier: 1,
              betAmount: 0
          }
      };

      /**
       * Game initialization
       * With protection against repeated initialization and timeout
       */
      const init = async function() {
          // Prevent repeated initialization
          if (state.initialized || state.initializationStarted) {
              app.log('Miner', 'Initialization already completed or in progress');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('Miner', 'Starting game initialization');
          
          try {
              // Set initialization timeout
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Get DOM elements (with null checks)
                      await findDOMElements();
                      
                      // Create the game container if needed
                      if (!elements.container) {
                          elements.container = createGameContainer();
                      }
                      
                      // Create game interface
                      createGameInterface();
                      
                      // Create game grid
                      createGrid();
                      
                      // Update potential win display
                      updatePotentialWin();
                      
                      // Set up event listeners
                      setupEventListeners();
                      
                      state.initialized = true;
                      app.log('Miner', 'Initialization successfully completed');
                      resolve(true);
                  } catch (innerError) {
                      app.log('Miner', `Error during initialization: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Set timeout (3 seconds)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('Miner', 'Initialization timeout', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Use Promise.race to prevent hanging
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('Miner', `Critical initialization error: ${error.message}`, true);
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
                  // Timeout for DOM readiness
                  setTimeout(() => {
                      elements.newGameBtn = document.getElementById('new-game-btn');
                      elements.cashoutBtn = document.getElementById('cash-out-btn');
                      elements.minerBet = document.getElementById('miner-bet');
                      elements.minesCount = document.getElementById('mines-count');
                      elements.minerGrid = document.getElementById('miner-grid');
                      elements.potentialWin = document.getElementById('potential-win');
                      elements.minerResult = document.getElementById('miner-result');
                      
                      // Check critical elements
                      if (!elements.minerGrid) {
                          app.log('Miner', 'Warning: miner-grid element not found', true);
                      }
                      
                      if (!elements.newGameBtn) {
                          app.log('Miner', 'Warning: new-game-btn element not found', true);
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('Miner', `Error finding DOM elements: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Create game container if it doesn't exist
       */
      const createGameContainer = function() {
          try {
              // Check if container already exists
              let container = document.querySelector('.miner-container');
              if (container) {
                  return container;
              }
              
              // Look for game area to place container
              const minerScreen = document.getElementById('miner-screen');
              if (!minerScreen) {
                  app.log('Miner', 'Miner screen not found, creating in body', true);
                  container = document.createElement('div');
                  container.className = 'miner-container';
                  document.body.appendChild(container);
                  return container;
              }
              
              // Create container in miner screen
              container = document.createElement('div');
              container.className = 'miner-container';
              minerScreen.appendChild(container);
              
              app.log('Miner', 'Game container created successfully');
              return container;
          } catch (error) {
              app.log('Miner', `Error creating game container: ${error.message}`, true);
              // Create fallback container
              const fallbackContainer = document.createElement('div');
              fallbackContainer.className = 'miner-container';
              document.body.appendChild(fallbackContainer);
              return fallbackContainer;
          }
      };
      
      /**
       * Create game interface
       */
      const createGameInterface = function() {
          try {
              if (!elements.container) {
                  app.log('Miner', 'Cannot create interface: container not found', true);
                  return false;
              }
              
              // Create HTML markup for the game
              elements.container.innerHTML = `
                  <div class="miner-info">
                      <div class="mines-count">
                          <span>Mines: </span>
                          <select id="mines-count">
                              <option value="1">1 mine</option>
                              <option value="3" selected>3 mines</option>
                              <option value="5">5 mines</option>
                              <option value="10">10 mines</option>
                              <option value="15">15 mines</option>
                              <option value="20">20 mines</option>
                          </select>
                      </div>
                      <div class="potential-win">
                          <span>Potential Win: </span>
                          <span id="potential-win">0</span> ⭐
                      </div>
                  </div>
                  
                  <div id="miner-grid" class="miner-grid">
                      <!-- Grid will be created dynamically -->
                  </div>
                  
                  <div id="miner-result" class="result"></div>
                  
                  <div class="bet-controls">
                      <div class="bet-amount">
                          <label for="miner-bet">Bet Amount:</label>
                          <input type="number" id="miner-bet" min="1" value="10">
                      </div>
                      <div class="control-buttons">
                          <button id="new-game-btn" class="action-btn">NEW GAME</button>
                          <button id="cash-out-btn" class="action-btn" disabled>CASH OUT</button>
                      </div>
                  </div>
              `;
              
              // Re-acquire elements after creating them
              elements.newGameBtn = document.getElementById('new-game-btn');
              elements.cashoutBtn = document.getElementById('cash-out-btn');
              elements.minerBet = document.getElementById('miner-bet');
              elements.minesCount = document.getElementById('mines-count');
              elements.minerGrid = document.getElementById('miner-grid');
              elements.potentialWin = document.getElementById('potential-win');
              elements.minerResult = document.getElementById('miner-result');
              
              app.log('Miner', 'Game interface created successfully');
              return true;
          } catch (error) {
              app.log('Miner', `Error creating game interface: ${error.message}`, true);
              return false;
          }
      };
      
      /**
       * Set up event listeners
       */
      const setupEventListeners = function() {
          try {
              // New game button
              if (elements.newGameBtn) {
                  // Clear current handlers (prevent duplication)
                  const newBtn = elements.newGameBtn.cloneNode(true);
                  elements.newGameBtn.parentNode.replaceChild(newBtn, elements.newGameBtn);
                  elements.newGameBtn = newBtn;
                  
                  // Add handler
                  elements.newGameBtn.addEventListener('click', startNewGame);
              }
              
              // Cash out button
              if (elements.cashoutBtn) {
                  const newCashoutBtn = elements.cashoutBtn.cloneNode(true);
                  elements.cashoutBtn.parentNode.replaceChild(newCashoutBtn, elements.cashoutBtn);
                  elements.cashoutBtn = newCashoutBtn;
                  
                  elements.cashoutBtn.addEventListener('click', cashout);
              }
              
              // Mines count selector
              if (elements.minesCount) {
                  elements.minesCount.addEventListener('change', function() {
                      state.gameData.minesCount = parseInt(elements.minesCount.value);
                      updatePotentialWin();
                  });
              }
              
              app.log('Miner', 'Event listeners set up successfully');
          } catch (error) {
              app.log('Miner', `Error setting up event listeners: ${error.message}`, true);
          }
      };
      
      /**
       * Create game grid
       */
      const createGrid = function() {
          try {
              if (!elements.minerGrid) {
                  app.log('Miner', 'Cannot create grid: minerGrid element not found', true);
                  return;
              }
              
              // Clear current grid
              elements.minerGrid.innerHTML = '';
              
              // Create 5x5 grid
              for (let i = 0; i < 5; i++) {
                  for (let j = 0; j < 5; j++) {
                      const cell = document.createElement('div');
                      cell.className = 'grid-cell';
                      cell.dataset.row = i;
                      cell.dataset.col = j;
                      cell.dataset.index = i * 5 + j;
                      
                      // Add click handler only if game is active
                      if (state.isPlaying) {
                          cell.addEventListener('click', function() {
                              revealCell(parseInt(cell.dataset.index));
                          });
                          cell.classList.add('active-cell');
                      }
                      
                      elements.minerGrid.appendChild(cell);
                  }
              }
              
              app.log('Miner', 'Game grid created successfully');
          } catch (error) {
              app.log('Miner', `Error creating grid: ${error.message}`, true);
          }
      };
      
      /**
       * Update potential win display based on current state
       */
      const updatePotentialWin = function() {
          try {
              if (!elements.potentialWin || !elements.minerBet) {
                  return;
              }
              
              const betAmount = parseInt(elements.minerBet.value) || 0;
              const revealedCount = state.gameData.revealedCells.length;
              const minesCount = state.gameData.minesCount;
              const totalCells = state.gameData.totalCells;
              
              // Calculate multiplier based on the formula
              const multiplier = calculateMultiplier(revealedCount, totalCells, minesCount);
              
              // Calculate potential win
              const potentialWin = Math.floor(betAmount * multiplier);
              
              // Update display
              elements.potentialWin.textContent = potentialWin;
              
              // Store current multiplier
              state.gameData.currentMultiplier = multiplier;
              
              app.log('Miner', `Potential win updated: ${potentialWin}, multiplier: ${multiplier.toFixed(2)}`);
          } catch (error) {
              app.log('Miner', `Error updating potential win: ${error.message}`, true);
          }
      };
      
      /**
       * Calculate multiplier based on probability formula
       * K(k;N,M) = ∏(i=0 to k-1) (N-M-i)/(N-i)
       * 
       * @param {number} revealed - Number of revealed safe cells
       * @param {number} total - Total number of cells
       * @param {number} mines - Number of mines
       * @returns {number} - Calculated multiplier
       */
      const calculateMultiplier = function(revealed, total, mines) {
          if (revealed === 0) return 1.0;
          
          try {
              let multiplier = 1.0;
              
              for (let i = 0; i < revealed; i++) {
                  const numerator = total - mines - i;
                  const denominator = total - i;
                  multiplier *= denominator / numerator;
              }
              
              // Round to 2 decimal places
              return Math.round(multiplier * 100) / 100;
          } catch (error) {
              app.log('Miner', `Error calculating multiplier: ${error.message}`, true);
              return 1.0;
          }
      };
      
      /**
       * Start a new game
       */
      const startNewGame = async function() {
          app.log('Miner', 'Starting new game');
          
          // Check initialization
          if (!state.initialized) {
              app.log('Miner', 'Game not initialized, starting initialization', true);
              await init();
              
              // If initialization failed, exit
              if (!state.initialized) {
                  app.log('Miner', 'Failed to start game: initialization error', true);
                  return;
              }
          }
          
          try {
              // Check casinoApp existence
              if (!window.casinoApp) {
                  app.log('Miner', 'casinoApp not found', true);
                  alert('Application initialization error');
                  return;
              }
              
              // Get bet amount
              const betAmount = parseInt(elements.minerBet.value);
              
              // Validate bet
              if (isNaN(betAmount) || betAmount <= 0) {
                  window.casinoApp.showNotification('Please enter a valid bet amount');
                  return;
              }
              
              // Check if player has enough funds
              if (window.GreenLightApp.user && betAmount > window.GreenLightApp.user.balance) {
                  window.casinoApp.showNotification('Insufficient funds for this bet');
                  return;
              }
              
              // Get mines count
              const minesCount = parseInt(elements.minesCount.value);
              
              // Reset game state
              state.isPlaying = true;
              state.gameData = {
                  grid: Array(state.gameData.totalCells).fill('empty'),
                  mines: [],
                  revealedCells: [],
                  totalCells: 25,
                  minesCount: minesCount,
                  currentMultiplier: 1.0,
                  betAmount: betAmount
              };
              
              // Place mines randomly
              placeMines();
              
              // Create grid with active cells
              createGrid();
              
              // Make cells clickable
              activateGridCells();
              
              // Update UI
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = false;
              }
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = true;
              }
              
              // Clear result
              if (elements.minerResult) {
                  elements.minerResult.textContent = '';
                  elements.minerResult.className = 'result';
              }
              
              // Tactile feedback
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
              
              // Process initial bet
              await window.casinoApp.processGameResult(
                  'miner',
                  betAmount,
                  'bet',
                  0,
                  { 
                      minesCount: state.gameData.minesCount,
                      totalCells: state.gameData.totalCells
                  }
              );
              
              // Update potential win display
              updatePotentialWin();
              
              app.log('Miner', `New game started: ${minesCount} mines, bet: ${betAmount}`);
          } catch (error) {
              app.log('Miner', `Error starting new game: ${error.message}`, true);
              state.isPlaying = false;
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = false;
              }
          }
      };
      
      /**
       * Make grid cells clickable
       */
      const activateGridCells = function() {
          try {
              const cells = document.querySelectorAll('.grid-cell');
              cells.forEach(cell => {
                  cell.addEventListener('click', function() {
                      if (!state.isPlaying) return;
                      revealCell(parseInt(cell.dataset.index));
                  });
                  cell.classList.add('active-cell');
              });
              
              app.log('Miner', 'Grid cells activated');
          } catch (error) {
              app.log('Miner', `Error activating grid cells: ${error.message}`, true);
          }
      };
      
      /**
       * Place mines randomly on the grid
       */
      const placeMines = function() {
          try {
              // Clear existing mines
              state.gameData.mines = [];
              
              // Place new mines
              while (state.gameData.mines.length < state.gameData.minesCount) {
                  const randomIndex = Math.floor(Math.random() * state.gameData.totalCells);
                  
                  // Add only if not already a mine
                  if (!state.gameData.mines.includes(randomIndex)) {
                      state.gameData.mines.push(randomIndex);
                      state.gameData.grid[randomIndex] = 'mine';
                  }
              }
              
              app.log('Miner', `Mines placed: ${state.gameData.mines.join(', ')}`);
          } catch (error) {
              app.log('Miner', `Error placing mines: ${error.message}`, true);
              
              // Emergency fallback - place mines deterministically
              state.gameData.mines = [];
              const minesNeeded = Math.min(state.gameData.minesCount, state.gameData.totalCells - 1);
              for (let i = 0; i < minesNeeded; i++) {
                  state.gameData.mines.push(i);
                  state.gameData.grid[i] = 'mine';
              }
          }
      };
      
      /**
       * Reveal a cell
       */
      const revealCell = async function(index) {
          try {
              // Check if cell is already revealed
              if (state.gameData.revealedCells.includes(index)) {
                  return;
              }
              
              // Check if game is active
              if (!state.isPlaying) {
                  return;
              }
              
              // Get cell element
              const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
              if (!cell) {
                  app.log('Miner', `Cell with index ${index} not found`, true);
                  return;
              }
              
              // Tactile feedback
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('light');
              }
              
              // Check if cell is a mine
              if (state.gameData.mines.includes(index)) {
                  // Game over - hit a mine
                  revealAllMines();
                  
                  // Update UI
                  cell.classList.add('mine', 'exploded');
                  cell.innerHTML = '💥';
                  
                  // Vibration for explosion
                  if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                      window.casinoApp.provideTactileFeedback('error');
                  }
                  
                  // Set game state
                  state.isPlaying = false;
                  
                  if (elements.cashoutBtn) {
                      elements.cashoutBtn.disabled = true;
                  }
                  
                  if (elements.newGameBtn) {
                      elements.newGameBtn.disabled = false;
                  }
                  
                  // Show result
                  if (elements.minerResult) {
                      elements.minerResult.textContent = 'Boom! You hit a mine. Game over!';
                      elements.minerResult.classList.add('lose');
                  }
                  
                  // Process loss
                  if (window.casinoApp) {
                      await window.casinoApp.processGameResult(
                          'miner',
                          0, // No additional bet
                          'lose',
                          0,
                          {
                              revealedCells: state.gameData.revealedCells,
                              hitMine: index,
                              mines: state.gameData.mines,
                              finalMultiplier: state.gameData.currentMultiplier
                          }
                      );
                  }
              } else {
                  // Safe cell
                  state.gameData.revealedCells.push(index);
                  
                  // Update UI
                  cell.classList.add('revealed');
                  cell.innerHTML = '💰';
                  
                  // Update multiplier and potential win
                  updatePotentialWin();
                  
                  // Check if all safe cells are revealed (win condition)
                  const safeCellsCount = state.gameData.totalCells - state.gameData.minesCount;
                  if (state.gameData.revealedCells.length === safeCellsCount) {
                      // Player revealed all safe cells - automatic cashout
                      await automaticCashout();
                  }
              }
          } catch (error) {
              app.log('Miner', `Error revealing cell: ${error.message}`, true);
          }
      };
      
      /**
       * Reveal all mines
       */
      const revealAllMines = function() {
          try {
              state.gameData.mines.forEach(index => {
                  const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                  if (cell && !cell.classList.contains('exploded')) {
                      cell.classList.add('mine');
                      cell.innerHTML = '💣';
                      
                      // Small delay for each mine
                      const delay = Math.random() * 300;
                      setTimeout(() => {
                          cell.classList.add('mine-reveal');
                      }, delay);
                  }
              });
          } catch (error) {
              app.log('Miner', `Error revealing all mines: ${error.message}`, true);
          }
      };
      
      /**
       * Cash out winnings
       */
      const cashout = async function() {
          try {
              // Check game state
              if (!state.isPlaying || state.gameData.revealedCells.length === 0) {
                  return;
              }
              
              // Calculate winnings
              const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
              
              // Tactile feedback
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
              }
              
              // Update UI
              if (elements.minerResult) {
                  elements.minerResult.innerHTML = `
                      <div class="win-icon">🎉</div>
                      <div class="win-title">You won ${winAmount} Stars!</div>
                      <div class="win-multiplier">Multiplier: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                  `;
                  elements.minerResult.classList.add('win');
              }
              
              // Reset game state
              state.isPlaying = false;
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
              }
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = false;
              }
              
              // Show all mines
              revealAllMines();
              
              // Process win
              await window.casinoApp.processGameResult(
                  'miner',
                  0, // No additional bet
                  'win',
                  winAmount,
                  {
                      revealedCells: state.gameData.revealedCells,
                      multiplier: state.gameData.currentMultiplier,
                      mines: state.gameData.mines
                  }
              );
              
              app.log('Miner', `Successful cashout: ${winAmount} with multiplier ${state.gameData.currentMultiplier.toFixed(2)}`);
          } catch (error) {
              app.log('Miner', `Error cashing out: ${error.message}`, true);
          }
      };
      
      /**
       * Automatic cashout when all safe cells are revealed
       */
      const automaticCashout = async function() {
          try {
              // Check game state
              if (!state.isPlaying) {
                  return;
              }
              
              // Calculate winnings
              const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
              
              // Tactile feedback - big win
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
                  setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
              }
              
              // Update UI
              if (elements.minerResult) {
                  elements.minerResult.innerHTML = `
                      <div class="win-icon">🏆</div>
                      <div class="win-title">Perfect! You revealed all safe cells!</div>
                      <div class="win-amount">Win: ${winAmount} ⭐</div>
                      <div class="win-multiplier">Multiplier: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                  `;
                  elements.minerResult.classList.add('win', 'big-win');
              }
              
              // Reset game state
              state.isPlaying = false;
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
              }
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = false;
              }
              
              // Show all mines
              revealAllMines();
              
              // Process win
              await window.casinoApp.processGameResult(
                  'miner',
                  0, // No additional bet
                  'win',
                  winAmount,
                  {
                      revealedCells: state.gameData.revealedCells,
                      multiplier: state.gameData.currentMultiplier,
                      mines: state.gameData.mines,
                      perfectGame: true
                  }
              );
              
              app.log('Miner', `Perfect game completed with win ${winAmount}`);
          } catch (error) {
              app.log('Miner', `Error in automatic cashout: ${error.message}`, true);
          }
      };
      
      // Return public interface
      return {
          // Main methods
          init: init,
          startNewGame: startNewGame,
          cashout: cashout,
          
          // Method for checking state
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isPlaying: state.isPlaying,
                  elementsFound: {
                      newGameBtn: !!elements.newGameBtn,
                      cashoutBtn: !!elements.cashoutBtn,
                      minerBet: !!elements.minerBet,
                      minerGrid: !!elements.minerGrid
                  },
                  gameState: {
                      minesCount: state.gameData.minesCount,
                      revealedCells: state.gameData.revealedCells.length,
                      currentMultiplier: state.gameData.currentMultiplier
                  }
              };
          }
      };
  })();
  
  // Register game in all formats for maximum compatibility
  try {
      // 1. Registration through new system
      if (window.registerGame) {
          window.registerGame('minerGame', minerGame);
          app.log('Miner', 'Game registered through the new registerGame system');
      }
      
      // 2. Export to global namespace (backward compatibility)
      window.minerGame = minerGame;
      app.log('Miner', 'Game exported to global namespace');
      
      // 3. Log module load completion
      app.log('Miner', 'Module successfully loaded and ready for initialization');
      
      // 4. Automatic initialization when page loads
      document.addEventListener('DOMContentLoaded', function() {
          setTimeout(() => {
              if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                  app.log('Miner', 'Starting automatic initialization');
                  minerGame.init();
              }
          }, 500);
      });
      
      // 5. If DOM is already loaded, initialize immediately
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(() => {
              if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                  app.log('Miner', 'Starting automatic initialization (DOM already loaded)');
                  minerGame.init();
              }
          }, 500);
      }
      
  } catch (error) {
      app.log('Miner', `Error registering game: ${error.message}`, true);
  }
})();