/**
 * miner.js - Optimized version of the Miner game
 * Version 2.0.3
 */

// Create a safer scope
(function() {
  // Check for main app object
  if (!window.GreenLightApp) {
    console.error('[Miner] GreenLightApp is not initialized!');
    window.GreenLightApp = {
      log: function(source, message, isError) {
        if (isError) console.error(`[${source}] ${message}`);
        else console.log(`[${source}] ${message}`);
      }
    };
  }
  
  const app = window.GreenLightApp;
  app.log('Miner', 'Initializing Miner game module v2.0.3');
  
  // Game logic
  const minerGame = (function() {
    // Game elements
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
        betAmount: 0,
        baseMultiplier: 1.2 // Base multiplier
      }
    };
    
    /**
     * Create game container
     */
    function createGameContainer() {
      try {
        // Check if container already exists
        let container = document.querySelector('.miner-container');
        if (container) {
          elements.container = container;
          return container;
        }
        
        // Look for game area
        let gameArea = document.querySelector('.games-area');
        if (!gameArea) {
          gameArea = document.createElement('div');
          gameArea.className = 'games-area';
          
          const appContainer = document.querySelector('.app-container');
          if (appContainer) {
            appContainer.appendChild(gameArea);
          } else {
            document.body.appendChild(gameArea);
          }
          
          app.log('Miner', 'Created general game area');
        }
        
        // Create container
        container = document.createElement('div');
        container.className = 'miner-container game-container';
        gameArea.appendChild(container);
        
        elements.container = container;
        app.log('Miner', 'Created main game container');
        
        return container;
      } catch (error) {
        app.log('Miner', `Error creating container: ${error.message}`, true);
        return null;
      }
    }
    
    /**
     * Create game interface
     */
    function createGameInterface() {
      try {
        const container = elements.container || createGameContainer();
        if (!container) {
          app.log('Miner', 'Cannot create interface: container not found', true);
          return false;
        }
        
        // Check if interface already exists
        if (container.querySelector('#miner-grid')) {
          app.log('Miner', 'Interface already created');
          return true;
        }
        
        // Create HTML markup
        container.innerHTML = `
          <h2>Miner</h2>
          <div class="game-controls">
            <div class="bet-control">
              <label for="miner-bet">Bet:</label>
              <input type="number" id="miner-bet" min="1" max="1000" value="10">
            </div>
            
            <div class="mines-control">
              <label for="mines-count">Number of mines:</label>
              <select id="mines-count">
                <option value="3">3 mines</option>
                <option value="5">5 mines</option>
                <option value="7">7 mines</option>
                <option value="10">10 mines</option>
              </select>
            </div>
            
            <div class="potential-win-container">
              <span>Potential win: <span id="potential-win">0</span> ⭐</span>
            </div>
            
            <div class="miner-buttons">
              <button id="new-game-btn" class="action-btn">NEW GAME</button>
              <button id="cashout-btn" class="action-btn" disabled>CASH OUT</button>
            </div>
          </div>
          
          <div id="miner-grid" class="miner-grid">
            <!-- Grid will be filled dynamically -->
          </div>
          
          <div id="miner-result" class="result"></div>
        `;
        
        // Create styles if needed
        if (!document.getElementById('miner-styles')) {
          const styleElement = document.createElement('style');
          styleElement.id = 'miner-styles';
          styleElement.textContent = `
            .miner-container {
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
            }
            
            .action-btn:disabled {
              background-color: #cccccc;
              cursor: not-allowed;
            }
            
            .miner-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              max-width: 350px;
              margin: 0 auto;
            }
            
            .grid-cell {
              width: 60px;
              height: 60px;
              background-color: #f1f1f1;
              border-radius: 5px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .active-cell:hover {
              background-color: #e0e0e0;
              transform: scale(1.05);
            }
            
            .grid-cell.revealed {
              background-color: #c8e6c9;
            }
            
            .grid-cell.mine {
              background-color: #ffcdd2;
            }
            
            .grid-cell.exploded {
              background-color: #ef5350;
              animation: explode 0.5s;
            }
            
            .result {
              margin-top: 15px;
              padding: 10px;
              border-radius: 4px;
              text-align: center;
            }
            
            .result.win {
              background-color: rgba(76, 175, 80, 0.2);
              color: #4CAF50;
            }
            
            .result.lose {
              background-color: rgba(244, 67, 54, 0.2);
              color: #F44336;
            }
            
            @keyframes explode {
              0% { transform: scale(1); }
              50% { transform: scale(1.2); }
              100% { transform: scale(1); }
            }
          `;
          document.head.appendChild(styleElement);
        }
        
        app.log('Miner', 'Game interface successfully created');
        return true;
      } catch (error) {
        app.log('Miner', `Error creating interface: ${error.message}`, true);
        return false;
      }
    }
    
    /**
     * Find DOM elements
     */
    async function findDOMElements() {
      return new Promise((resolve, reject) => {
        try {
          setTimeout(() => {
            elements.newGameBtn = document.getElementById('new-game-btn');
            elements.cashoutBtn = document.getElementById('cashout-btn');
            elements.minerBet = document.getElementById('miner-bet');
            elements.minesCount = document.getElementById('mines-count');
            elements.minerGrid = document.getElementById('miner-grid');
            elements.potentialWin = document.getElementById('potential-win');
            elements.minerResult = document.getElementById('miner-result');
            
            if (!elements.newGameBtn) {
              app.log('Miner', 'Warning: element new-game-btn not found', true);
            }
            
            if (!elements.minerGrid) {
              app.log('Miner', 'Warning: element miner-grid not found', true);
            }
            
            resolve();
          }, 100);
        } catch (error) {
          app.log('Miner', `Error finding DOM elements: ${error.message}`, true);
          reject(error);
        }
      });
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
      try {
        // New game button
        if (elements.newGameBtn) {
          const newGameBtn = elements.newGameBtn.cloneNode(true);
          if (elements.newGameBtn.parentNode) {
            elements.newGameBtn.parentNode.replaceChild(newGameBtn, elements.newGameBtn);
          }
          elements.newGameBtn = newGameBtn;
          
          elements.newGameBtn.addEventListener('click', startNewGame);
          app.log('Miner', 'Handler for new game button set up');
        }
        
        // Cash out button
        if (elements.cashoutBtn) {
          const cashoutBtn = elements.cashoutBtn.cloneNode(true);
          if (elements.cashoutBtn.parentNode) {
            elements.cashoutBtn.parentNode.replaceChild(cashoutBtn, elements.cashoutBtn);
          }
          elements.cashoutBtn = cashoutBtn;
          
          elements.cashoutBtn.addEventListener('click', cashout);
        }
        
        // Mines count selection
        if (elements.minesCount) {
          elements.minesCount.addEventListener('change', updateMineCount);
        }
        
        app.log('Miner', 'Event handlers set up');
      } catch (error) {
        app.log('Miner', `Error setting up event handlers: ${error.message}`, true);
      }
    }
    
    /**
     * Create game grid
     */
    function createGrid() {
      try {
        if (!elements.minerGrid) {
          app.log('Miner', 'Cannot create grid: minerGrid element not found', true);
          return;
        }
        
        elements.minerGrid.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.dataset.index = i * 5 + j;
            
            if (state.isPlaying) {
              cell.addEventListener('click', () => revealCell(i * 5 + j));
              cell.classList.add('active-cell');
            }
            
            elements.minerGrid.appendChild(cell);
          }
        }
        
        app.log('Miner', 'Game grid created successfully');
      } catch (error) {
        app.log('Miner', `Error creating grid: ${error.message}`, true);
      }
    }
    
    /**
     * Update number of mines
     */
    function updateMineCount() {
      try {
        if (!elements.minesCount) return;
        
        state.gameData.minesCount = parseInt(elements.minesCount.value);
        
        // Set base multiplier
        switch (state.gameData.minesCount) {
          case 3: 
            state.gameData.baseMultiplier = 1.2;
            break;
          case 5:
            state.gameData.baseMultiplier = 1.5;
            break;
          case 7:
            state.gameData.baseMultiplier = 2.0;
            break;
          case 10:
            state.gameData.baseMultiplier = 3.0;
            break;
          default:
            state.gameData.baseMultiplier = 1.2;
        }
        
        updatePotentialWin();
        
        // Tactile feedback
        if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
          window.casinoApp.provideTactileFeedback('light');
        }
        
        app.log('Miner', `Number of mines updated: ${state.gameData.minesCount}`);
      } catch (error) {
        app.log('Miner', `Error updating number of mines: ${error.message}`, true);
      }
    }
    
    /**
     * Update potential win display
     */
    function updatePotentialWin() {
      try {
        if (!elements.potentialWin || !elements.minerBet) return;
        
        const betAmt = parseInt(elements.minerBet.value) || 0;
        
        const multiplier = calculateMultiplier(
          state.gameData.revealedCells.length,
          state.gameData.totalCells,
          state.gameData.minesCount,
          state.gameData.baseMultiplier
        );
        
        const potential = Math.floor(betAmt * multiplier);
        elements.potentialWin.textContent = potential;
        
        state.gameData.currentMultiplier = multiplier;
        
      } catch (error) {
        app.log('Miner', `Error updating potential win: ${error.message}`, true);
      }
    }
    
    /**
     * Calculate win multiplier
     */
    function calculateMultiplier(revealed, total, mines, baseMultiplier) {
      if (revealed === 0) return baseMultiplier;
      
      try {
        const safeCells = total - mines;
        const remainingSafe = safeCells - revealed;
        
        let multiplier = baseMultiplier * Math.pow(safeCells / remainingSafe, 1.2);
        
        const maxMultiplier = 50;
        multiplier = Math.min(multiplier, maxMultiplier);
        
        return Math.floor(multiplier * 100) / 100;
      } catch (error) {
        app.log('Miner', `Error calculating multiplier: ${error.message}`, true);
        return baseMultiplier;
      }
    }
    
    /**
     * Check and initialize casinoApp object
     */
    function ensureCasinoApp() {
      if (window.casinoApp) return true;
      
      app.log('Miner', 'casinoApp not found, creating temporary implementation', true);
      window.casinoApp = {
        showNotification: function(message) {
          alert(message);
        },
        provideTactileFeedback: function() {
          // Vibration stub
        },
        processGameResult: function(gameType, bet, result, win, data) {
          app.log('Miner', `Game: ${gameType}, Bet: ${bet}, Result: ${result}, Win: ${win}`, false);
          return Promise.resolve({success: true});
        }
      };
      
      return true;
    }
    
    /**
     * Place mines
     */
    function placeMines() {
      try {
        state.gameData.mines = [];
        
        while (state.gameData.mines.length < state.gameData.minesCount) {
          const randomIndex = Math.floor(Math.random() * state.gameData.totalCells);
          
          if (!state.gameData.mines.includes(randomIndex)) {
            state.gameData.mines.push(randomIndex);
            state.gameData.grid[randomIndex] = 'mine';
          }
        }
        
        app.log('Miner', `Mines placed: ${state.gameData.mines.join(', ')}`);
      } catch (error) {
        app.log('Miner', `Error placing mines: ${error.message}`, true);
      }
    }
    
    /**
     * Reveal all mines
     */
    function revealAllMines() {
      try {
        state.gameData.mines.forEach(index => {
          const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
          if (cell && !cell.classList.contains('exploded')) {
            cell.classList.add('mine');
            cell.innerHTML = '💣';
            
            const delay = Math.random() * 300;
            setTimeout(() => {
              cell.classList.add('mine-reveal');
            }, delay);
          }
        });
      } catch (error) {
        app.log('Miner', `Error revealing all mines: ${error.message}`, true);
      }
    }
    
    /**
     * Initialize game
     */
    async function init() {
      if (state.initialized || state.initializationStarted) {
        return true;
      }
      
      state.initializationStarted = true;
      app.log('Miner', 'Starting game initialization');
      
      try {
        const initPromise = new Promise(async (resolve) => {
          try {
            if (!createGameInterface()) {
              resolve(false);
              return;
            }
            
            await findDOMElements();
            createGrid();
            updatePotentialWin();
            setupEventListeners();
            
            state.initialized = true;
            app.log('Miner', 'Initialization completed successfully');
            resolve(true);
          } catch (error) {
            app.log('Miner', `Error during initialization: ${error.message}`, true);
            resolve(false);
          }
        });
        
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            app.log('Miner', 'Initialization timeout', true);
            resolve(false);
          }, 3000);
        });
        
        return await Promise.race([initPromise, timeoutPromise]);
        
      } catch (error) {
        app.log('Miner', `Critical initialization error: ${error.message}`, true);
        return false;
      }
    }
    
    /**
     * Start new game
     */
    async function startNewGame() {
      app.log('Miner', 'Starting new game');
      
      if (!state.initialized) {
        await init();
        
        if (!state.initialized) {
          app.log('Miner', 'Failed to start game: initialization error', true);
          return;
        }
      }
      
      try {
        if (!ensureCasinoApp()) return;
        
        if (!elements.minerBet) {
          app.log('Miner', 'Bet element not found', true);
          return;
        }
        
        const betAmount = parseInt(elements.minerBet.value);
        
        if (isNaN(betAmount) || betAmount <= 0) {
          window.casinoApp.showNotification('Please enter a valid bet');
          return;
        }
        
        if (window.GreenLightApp && window.GreenLightApp.user && 
            betAmount > window.GreenLightApp.user.balance) {
          window.casinoApp.showNotification('Insufficient funds for bet');
          return;
        }
        
        state.isPlaying = true;
        state.gameData = {
          grid: Array(state.gameData.totalCells).fill('empty'),
          mines: [],
          revealedCells: [],
          totalCells: 25,
          minesCount: parseInt(elements.minesCount ? elements.minesCount.value : 3),
          currentMultiplier: state.gameData.baseMultiplier,
          betAmount: betAmount,
          baseMultiplier: state.gameData.baseMultiplier
        };
        
        placeMines();
        createGrid();
        
        if (elements.cashoutBtn) {
          elements.cashoutBtn.disabled = false;
        }
        
        if (elements.newGameBtn) {
          elements.newGameBtn.disabled = true;
        }
        
        if (elements.minerResult) {
          elements.minerResult.textContent = '';
          elements.minerResult.className = 'result';
        }
        
        if (window.casinoApp.provideTactileFeedback) {
          window.casinoApp.provideTactileFeedback('medium');
        }
        
        await window.casinoApp.processGameResult(
          'miner',
          betAmount,
          'bet',
          0,
          { 
            minesCount: state.gameData.minesCount,
            baseMultiplier: state.gameData.baseMultiplier 
          }
        );
        
        updatePotentialWin();
        
        app.log('Miner', 'New game started successfully');
      } catch (error) {
        app.log('Miner', `Error starting new game: ${error.message}`, true);
        state.isPlaying = false;
        
        if (elements.newGameBtn) {
          elements.newGameBtn.disabled = false;
        }
      }
    }
    
    /**
     * Reveal cell
     */
    async function revealCell(index) {
      try {
        if (state.gameData.revealedCells.includes(index)) return;
        if (!state.isPlaying) return;
        
        const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
        if (!cell) {
          app.log('Miner', `Cell with index ${index} not found`, true);
          return;
        }
        
        if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
          window.casinoApp.provideTactileFeedback('light');
        }
        
        if (state.gameData.mines.includes(index)) {
          // Game over - hit a mine
          revealAllMines();
          
          cell.classList.add('mine', 'exploded');
          cell.innerHTML = '💥';
          
          if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
            window.casinoApp.provideTactileFeedback('error');
          }
          
          state.isPlaying = false;
          
          if (elements.cashoutBtn) {
            elements.cashoutBtn.disabled = true;
          }
          
          if (elements.newGameBtn) {
            elements.newGameBtn.disabled = false;
          }
          
          if (elements.minerResult) {
            elements.minerResult.textContent = 'Boom! You hit a mine. Game over!';
            elements.minerResult.classList.add('lose');
          }
          
          if (window.casinoApp) {
            await window.casinoApp.processGameResult(
              'miner',
              0,
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
          
          cell.classList.add('revealed');
          cell.innerHTML = '💰';
          
          updatePotentialWin();
          
          const safeCellsCount = state.gameData.totalCells - state.gameData.mines.length;
          if (state.gameData.revealedCells.length === safeCellsCount) {
            await automaticCashout();
          }
        }
      } catch (error) {
        app.log('Miner', `Error revealing cell: ${error.message}`, true);
      }
    }
    
    /**
     * Cash out
     */
    async function cashout() {
      try {
        if (!state.isPlaying || state.gameData.revealedCells.length === 0) return;
        if (!ensureCasinoApp()) return;
        
        const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
        
        if (window.casinoApp.provideTactileFeedback) {
          window.casinoApp.provideTactileFeedback('success');
        }
        
        if (elements.minerResult) {
          elements.minerResult.innerHTML = `
            <div class="win-icon">🎉</div>
            <div class="win-title">You won ${winAmount} Stars!</div>
            <div class="win-multiplier">Multiplier: x${state.gameData.currentMultiplier.toFixed(2)}</div>
          `;
          elements.minerResult.classList.add('win');
        }
        
        state.isPlaying = false;
        
        if (elements.cashoutBtn) {
          elements.cashoutBtn.disabled = true;
        }
        
        if (elements.newGameBtn) {
          elements.newGameBtn.disabled = false;
        }
        
        revealAllMines();
        
        await window.casinoApp.processGameResult(
          'miner',
          0,
          'win',
          winAmount,
          {
            revealedCells: state.gameData.revealedCells,
            multiplier: state.gameData.currentMultiplier,
            mines: state.gameData.mines
          }
        );
        
        app.log('Miner', `Successful cash out: ${winAmount}`);
      } catch (error) {
        app.log('Miner', `Error cashing out: ${error.message}`, true);
      }
    }
    
    /**
     * Automatic cash out when all safe cells are revealed
     */
    async function automaticCashout() {
      try {
        if (!state.isPlaying) return;
        if (!ensureCasinoApp()) return;
        
        const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
        
        if (window.casinoApp.provideTactileFeedback) {
          window.casinoApp.provideTactileFeedback('success');
          setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
        }
        
        if (elements.minerResult) {
          elements.minerResult.innerHTML = `
            <div class="win-icon">🏆</div>
            <div class="win-title">Perfect! You revealed all safe cells!</div>
            <div class="win-amount">Win: ${winAmount} ⭐</div>
            <div class="win-multiplier">Multiplier: x${state.gameData.currentMultiplier.toFixed(2)}</div>
          `;
          elements.minerResult.classList.add('win', 'big-win');
        }
        
        state.isPlaying = false;
        
        if (elements.cashoutBtn) {
          elements.cashoutBtn.disabled = true;
        }
        
        if (elements.newGameBtn) {
          elements.newGameBtn.disabled = false;
        }
        
        revealAllMines();
        
        await window.casinoApp.processGameResult(
          'miner',
          0,
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
        app.log('Miner', `Error in automatic cash out: ${error.message}`, true);
      }
    }
    
    // Return public interface
    return {
      init: init,
      startNewGame: startNewGame,
      cashout: cashout,
      updateMineCount: updateMineCount,
      
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
  
  // Register the game in all formats for maximum compatibility
  try {
    // 1. Register through the new system
    if (window.registerGame) {
      window.registerGame('minerGame', minerGame);
      app.log('Miner', 'Game registered through the new registerGame system');
    }
    
    // 2. Export to global namespace (backward compatibility)
    window.minerGame = minerGame;
    app.log('Miner', 'Game exported to global namespace');
    
    // 3. Log completion
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
    
    // 5. If DOM is already loaded, start initialization immediately
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