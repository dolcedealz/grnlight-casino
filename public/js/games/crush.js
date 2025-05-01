/**
 * crush.js - Enhanced version of the Crush game for proper integration
 * Version 2.1.0
 * 
 * Improvements:
 * - Better integration with the casino UI framework
 * - Proper screen management
 * - Fixed element targeting
 * - Enhanced error handling
 */

// Create an isolated environment for the game
(function() {
  // Ensure GreenLightApp exists
  if (!window.GreenLightApp) {
      console.error('[Crush] GreenLightApp not initialized!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Crush', 'Initializing Crush game module v2.1.0');
  
  // Game logic in closure for isolation
  const crushGame = (function() {
      // Game elements - IMPORTANT: Now targeting elements in the crush-screen
      let elements = {
          startBtn: null,
          cashoutBtn: null,
          crushBet: null,
          multiplierDisplay: null,
          crushGraph: null,
          crushResult: null,
          // Reference to the game's screen container
          screenContainer: null
      };
      
      // Canvas elements for the graph
      let graphCanvas = null;
      let graphCtx = null;
      
      // Game state
      let state = {
          isPlaying: false,
          initialized: false,
          initializationStarted: false,
          multiplier: 1.00,
          gameInterval: null,
          crashPoint: 1.00,
          betAmount: 0,
          gameStartTime: 0,
          graphPoints: []
      };
      
      // Game history
      let gameHistory = [];
      const MAX_HISTORY = 10;

      /**
       * Initialize the game
       * With protection against repeated initialization and timeout
       */
      const init = async function() {
          // Prevent repeated initialization
          if (state.initialized || state.initializationStarted) {
              app.log('Crush', 'Initialization already completed or in progress');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('Crush', 'Starting game initialization');
          
          try {
              // Set a timeout for initialization
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // IMPORTANT CHANGE: Find the game screen container first
                      elements.screenContainer = document.getElementById('crush-screen');
                      if (!elements.screenContainer) {
                          app.log('Crush', 'Critical error: crush-screen not found', true);
                          resolve(false);
                          return;
                      }
                      
                      // Create the game UI
                      createGameInterface();
                      
                      // Find DOM elements
                      await findDOMElements();
                      
                      // Setup canvas for the graph
                      setupCanvas();
                      
                      // Add event listeners
                      setupEventListeners();
                      
                      // Reset the graph
                      resetGraph();
                      
                      // Load history
                      loadHistory();
                      
                      // Create history UI
                      createHistoryUI();
                      
                      // Hide the result
                      if (elements.crushResult) {
                          elements.crushResult.style.display = 'none';
                      }
                      
                      state.initialized = true;
                      app.log('Crush', 'Initialization completed successfully');
                      resolve(true);
                  } catch (innerError) {
                      app.log('Crush', `Error during initialization: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Set timeout (3 seconds)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('Crush', 'Initialization timeout', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Use Promise.race to prevent hanging
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('Crush', `Critical initialization error: ${error.message}`, true);
              return false;
          }
      };
      
      /**
       * Create the game interface inside the crush-screen
       */
      const createGameInterface = function() {
          try {
              if (!elements.screenContainer) {
                  app.log('Crush', 'Cannot create interface: screen container not found', true);
                  return false;
              }
              
              // Check if the interface already exists
              if (elements.screenContainer.querySelector('.crush-container')) {
                  app.log('Crush', 'Interface already exists');
                  return true;
              }
              
              // Create main game container
              const gameContainer = document.createElement('div');
              gameContainer.className = 'crush-container';
              
              // Create HTML markup for the game
              gameContainer.innerHTML = `
                  <div class="game-controls">
                      <div class="bet-control">
                          <label for="crush-bet">Bet Amount:</label>
                          <input type="number" id="crush-bet" min="1" max="1000" value="10">
                      </div>
                      
                      <div class="multiplier-container">
                          <span>Multiplier: <span id="multiplier">1.00</span>x</span>
                      </div>
                      
                      <div class="crush-buttons">
                          <button id="start-crush-btn" class="action-btn">START</button>
                          <button id="cash-crush-btn" class="action-btn" disabled>CASH OUT</button>
                      </div>
                  </div>
                  
                  <div id="crush-graph" class="crush-graph">
                      <!-- Canvas will be created dynamically -->
                  </div>
                  
                  <div class="crush-history">
                      <h3>History</h3>
                      <div class="history-items"></div>
                  </div>
                  
                  <div id="crush-result" class="result"></div>
              `;
              
              // Add the container to the screen
              // Make sure we position it after the header but before any possible footer
              const header = elements.screenContainer.querySelector('.game-header');
              if (header) {
                  header.after(gameContainer);
              } else {
                  elements.screenContainer.appendChild(gameContainer);
              }
              
              app.log('Crush', 'Game interface created successfully');
              return true;
          } catch (error) {
              app.log('Crush', `Error creating interface: ${error.message}`, true);
              return false;
          }
      };
      
      /**
       * Find DOM elements with protection against null
       */
      const findDOMElements = async function() {
          // Use Promise for asynchronicity
          return new Promise((resolve, reject) => {
              try {
                  // Timeout to wait for DOM readiness
                  setTimeout(() => {
                      // IMPORTANT: Look for elements within the screen container
                      if (elements.screenContainer) {
                          elements.startBtn = elements.screenContainer.querySelector('#start-crush-btn');
                          elements.cashoutBtn = elements.screenContainer.querySelector('#cash-crush-btn');
                          elements.crushBet = elements.screenContainer.querySelector('#crush-bet');
                          elements.multiplierDisplay = elements.screenContainer.querySelector('#multiplier');
                          elements.crushGraph = elements.screenContainer.querySelector('#crush-graph');
                          elements.crushResult = elements.screenContainer.querySelector('#crush-result');
                      } else {
                          app.log('Crush', 'Screen container is not available', true);
                      }
                      
                      // Check critical elements and log their status
                      if (!elements.startBtn) {
                          app.log('Crush', 'Warning: start-crush-btn element not found', true);
                      } else {
                          app.log('Crush', 'start-crush-btn element found successfully');
                      }
                      
                      if (!elements.crushGraph) {
                          app.log('Crush', 'Warning: crush-graph element not found', true);
                      } else {
                          app.log('Crush', 'crush-graph element found successfully');
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('Crush', `Error finding DOM elements: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Setup canvas for the graph
       */
      const setupCanvas = function() {
          try {
              if (!elements.crushGraph) {
                  app.log('Crush', 'Graph element not found, cannot setup canvas', true);
                  return;
              }
              
              // Check if canvas already exists
              let existingCanvas = elements.crushGraph.querySelector('canvas');
              if (existingCanvas) {
                  graphCanvas = existingCanvas;
                  graphCtx = graphCanvas.getContext('2d');
                  app.log('Crush', 'Using existing canvas');
                  return;
              }
              
              // Create new canvas
              graphCanvas = document.createElement('canvas');
              graphCanvas.id = 'crush-canvas';
              graphCanvas.width = elements.crushGraph.clientWidth || 300;
              graphCanvas.height = elements.crushGraph.clientHeight || 200;
              elements.crushGraph.appendChild(graphCanvas);
              
              // Get context
              graphCtx = graphCanvas.getContext('2d');
              
              app.log('Crush', 'Canvas for graph created successfully');
          } catch (error) {
              app.log('Crush', `Error creating canvas: ${error.message}`, true);
          }
      };
      
      /**
       * Setup event listeners
       */
      const setupEventListeners = function() {
          try {
              // Start button
              if (elements.startBtn) {
                  // Clear current listeners (prevent duplication)
                  const newStartBtn = elements.startBtn.cloneNode(true);
                  if (elements.startBtn.parentNode) {
                      elements.startBtn.parentNode.replaceChild(newStartBtn, elements.startBtn);
                  }
                  elements.startBtn = newStartBtn;
                  
                  // Add listener
                  elements.startBtn.addEventListener('click', startGame);
                  app.log('Crush', 'Event listener set for start button');
              } else {
                  app.log('Crush', 'Cannot set listener: start button not found', true);
              }
              
              // Cash out button
              if (elements.cashoutBtn) {
                  const newCashoutBtn = elements.cashoutBtn.cloneNode(true);
                  if (elements.cashoutBtn.parentNode) {
                      elements.cashoutBtn.parentNode.replaceChild(newCashoutBtn, elements.cashoutBtn);
                  }
                  elements.cashoutBtn = newCashoutBtn;
                  
                  elements.cashoutBtn.addEventListener('click', cashout);
                  app.log('Crush', 'Event listener set for cash out button');
              } else {
                  app.log('Crush', 'Cannot set listener: cash out button not found', true);
              }
              
              // Window resize handler
              window.addEventListener('resize', handleResize);
              
              app.log('Crush', 'Event listeners set up');
          } catch (error) {
              app.log('Crush', `Error setting up event listeners: ${error.message}`, true);
          }
      };
      
      /**
       * Handle window resize
       */
      const handleResize = function() {
          try {
              if (graphCanvas && elements.crushGraph) {
                  graphCanvas.width = elements.crushGraph.clientWidth || 300;
                  graphCanvas.height = elements.crushGraph.clientHeight || 200;
                  resetGraph();
                  
                  // Redraw current graph if game is active
                  if (state.isPlaying && state.graphPoints.length > 0) {
                      redrawGraph();
                  }
              }
          } catch (error) {
              app.log('Crush', `Error handling resize: ${error.message}`, true);
          }
      };
      
      /**
       * Create history UI
       */
      const createHistoryUI = function() {
          try {
              if (!elements.screenContainer) {
                  app.log('Crush', 'Game screen container not found', true);
                  return;
              }
              
              // Check if history container already exists
              let historyContainer = elements.screenContainer.querySelector('.crush-history');
              
              if (!historyContainer) {
                  // Create container for history
                  historyContainer = document.createElement('div');
                  historyContainer.className = 'crush-history';
                  historyContainer.innerHTML = `
                      <h3>History</h3>
                      <div class="history-items"></div>
                  `;
                  
                  // Add after graph
                  if (elements.crushGraph) {
                      elements.crushGraph.after(historyContainer);
                  } else {
                      const gameContainer = elements.screenContainer.querySelector('.crush-container');
                      if (gameContainer) {
                          gameContainer.appendChild(historyContainer);
                      }
                  }
              }
              
              // Update history content
              updateHistoryDisplay();
              
              app.log('Crush', 'History UI created successfully');
          } catch (error) {
              app.log('Crush', `Error creating history UI: ${error.message}`, true);
          }
      };
      
      /**
       * Reset the graph
       */
      const resetGraph = function() {
          try {
              if (!graphCtx) {
                  app.log('Crush', 'graphCtx not available, cannot reset graph', true);
                  return;
              }
              
              // Clear canvas
              graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
              
              // Draw grid
              drawGrid();
              
              // Reset points
              state.graphPoints = [];
              
              app.log('Crush', 'Graph reset successfully');
          } catch (error) {
              app.log('Crush', `Error resetting graph: ${error.message}`, true);
          }
      };
      
      /**
       * Draw graph grid
       */
      const drawGrid = function() {
          try {
              if (!graphCtx) {
                  app.log('Crush', 'graphCtx not available, cannot draw grid', true);
                  return;
              }
              
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Grid style
              graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              graphCtx.lineWidth = 1;
              
              // Horizontal lines
              for (let y = height; y >= 0; y -= height / 4) {
                  graphCtx.beginPath();
                  graphCtx.moveTo(0, y);
                  graphCtx.lineTo(width, y);
                  graphCtx.stroke();
              }
              
              // Vertical lines
              for (let x = 0; x < width; x += width / 5) {
                  graphCtx.beginPath();
                  graphCtx.moveTo(x, 0);
                  graphCtx.lineTo(x, height);
                  graphCtx.stroke();
              }
          } catch (error) {
              app.log('Crush', `Error drawing grid: ${error.message}`, true);
          }
      };
      
      /**
       * Load game history
       */
      const loadHistory = function() {
          try {
              // Generate random history for demonstration
              gameHistory = [];
              
              for (let i = 0; i < 10; i++) {
                  const isCrash = Math.random() > 0.3; // 70% crash probability
                  const crashMultiplier = isCrash ? 
                      (1 + Math.random() * Math.random() * 4).toFixed(2) : 
                      (1 + Math.random() * Math.random() * 8).toFixed(2);
                  
                  gameHistory.push({
                      multiplier: parseFloat(crashMultiplier),
                      timestamp: new Date(Date.now() - i * 60000).toISOString(),
                      isCashedOut: !isCrash
                  });
              }
              
              // Update history display
              updateHistoryDisplay();
              
              app.log('Crush', `History loaded: ${gameHistory.length} entries`);
          } catch (error) {
              app.log('Crush', `Error loading history: ${error.message}`, true);
          }
      };
      
      /**
       * Update history display
       */
      const updateHistoryDisplay = function() {
          try {
              const historyItems = elements.screenContainer.querySelector('.history-items');
              if (!historyItems) {
                  app.log('Crush', 'history-items element not found', true);
                  return;
              }
              
              historyItems.innerHTML = '';
              
              // Add history items
              gameHistory.forEach(item => {
                  const historyItem = document.createElement('div');
                  historyItem.className = `history-item ${item.isCashedOut ? 'cashed-out' : 'crashed'}`;
                  
                  // Determine color based on multiplier
                  let colorClass = '';
                  if (item.multiplier <= 1.5) {
                      colorClass = 'low';
                  } else if (item.multiplier <= 3) {
                      colorClass = 'medium';
                  } else if (item.multiplier <= 5) {
                      colorClass = 'high';
                  } else {
                      colorClass = 'extreme';
                  }
                  
                  historyItem.classList.add(colorClass);
                  historyItem.innerHTML = `
                      <div class="history-multiplier">${item.multiplier.toFixed(2)}x</div>
                  `;
                  
                  historyItems.appendChild(historyItem);
              });
          } catch (error) {
              app.log('Crush', `Error updating history display: ${error.message}`, true);
          }
      };
      
      /**
       * Check and create casinoApp object if it's missing
       */
      const ensureCasinoApp = function() {
          if (window.casinoApp) return true;
          
          // Create minimal casinoApp implementation if object is missing
          app.log('Crush', 'casinoApp not found, creating temporary implementation', true);
          window.casinoApp = {
              showNotification: function(message) {
                  alert(message);
              },
              provideTactileFeedback: function() {
                  // Vibration placeholder
              },
              processGameResult: function(gameType, bet, result, win, data) {
                  app.log('Crush', `Game: ${gameType}, Bet: ${bet}, Result: ${result}, Win: ${win}`, false);
                  return Promise.resolve({success: true});
              }
          };
          
          return true;
      };
      
      /**
       * Start the game
       */
      const startGame = async function() {
          app.log('Crush', 'Starting game');
          
          // Check initialization
          if (!state.initialized) {
              app.log('Crush', 'Game not initialized, starting initialization', true);
              await init();
              
              // If initialization failed, exit
              if (!state.initialized) {
                  app.log('Crush', 'Failed to start game: initialization error', true);
                  return;
              }
          }
          
          try {
              // Check casinoApp existence
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Check element existence
              if (!elements.crushBet) {
                  app.log('Crush', 'Bet element not found', true);
                  return;
              }
              
              // Check if game is already running
              if (state.isPlaying) {
                  app.log('Crush', 'Game already running');
                  return;
              }
              
              // Get bet amount
              state.betAmount = parseInt(elements.crushBet.value);
              
              // Check bet
              if (isNaN(state.betAmount) || state.betAmount <= 0) {
                  window.casinoApp.showNotification('Please enter a valid bet amount');
                  return;
              }
              
              // Check if enough funds (if balance info available)
              if (window.GreenLightApp && window.GreenLightApp.user && 
                  state.betAmount > window.GreenLightApp.user.balance) {
                  window.casinoApp.showNotification('Insufficient funds for this bet');
                  return;
              }
              
              // Reset game state
              state.multiplier = 1.00;
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.textContent = state.multiplier.toFixed(2);
                  elements.multiplierDisplay.classList.remove('crashed', 'cashed-out');
                  elements.multiplierDisplay.classList.add('active');
              }
              
              state.isPlaying = true;
              
              // Calculate crash point
              state.crashPoint = generateCrashPoint();
              app.log('Crush', `Game will end at: ${state.crashPoint.toFixed(2)}`);
              
              // Update interface
              if (elements.startBtn) {
                  elements.startBtn.disabled = true;
                  elements.startBtn.classList.add('disabled');
              }
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = false;
                  elements.cashoutBtn.classList.remove('disabled');
                  elements.cashoutBtn.classList.add('active');
              }
              
              // Hide previous result
              if (elements.crushResult) {
                  elements.crushResult.style.opacity = '0';
                  elements.crushResult.style.transform = 'translateY(20px)';
                  setTimeout(() => {
                      elements.crushResult.textContent = '';
                      elements.crushResult.className = 'result';
                      elements.crushResult.style.display = 'none';
                  }, 300);
              }
              
              // Tactile feedback
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
              
              // Reset graph
              resetGraph();
              state.gameStartTime = Date.now();
              addGraphPoint(1.00); // Initial point
              
              // Send initial bet to server
              await window.casinoApp.processGameResult(
                  'crush',
                  state.betAmount,
                  'bet',
                  0,
                  { startMultiplier: state.multiplier }
              );
              
              // Start game interval with hang protection
              startGameInterval();
              
              app.log('Crush', 'Game started successfully');
          } catch (error) {
              app.log('Crush', `Error starting game: ${error.message}`, true);
              
              // Reset state in case of error
              state.isPlaying = false;
              if (elements.startBtn) {
                  elements.startBtn.disabled = false;
                  elements.startBtn.classList.remove('disabled');
              }
          }
      };
      
      /**
       * Start game interval with hang protection
       */
      const startGameInterval = function() {
          try {
              // Set maximum game time
              const maxGameTime = 60000; // 60 seconds maximum
              const gameStartMs = Date.now();
              
              // Start interval
              state.gameInterval = setInterval(() => {
                  // Check if maximum time exceeded
                  if (Date.now() - gameStartMs > maxGameTime) {
                      app.log('Crush', 'Maximum game time exceeded', true);
                      clearInterval(state.gameInterval);
                      gameCrash(); // Forced crash
                      return;
                  }
                  
                  // Update game
                  updateGame();
              }, 50);
              
              app.log('Crush', 'Game interval started successfully');
          } catch (error) {
              app.log('Crush', `Error starting game interval: ${error.message}`, true);
              
              // In case of error, force stop the game
              state.isPlaying = false;
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
          }
      };
      
      /**
       * Generate crash point
       */
      const generateCrashPoint = function() {
          try {
              // Use distribution with higher probability of small values
              // and rare probability of large values
              
              // Base random number from 0 to 1
              const r = Math.random();
              
              // Distribution formula
              let crash = 1.0;
              
              if (r < 0.5) {
                  // 50% chance of crash between 1.0 and 2.0
                  crash = 1.0 + r;
              } else if (r < 0.8) {
                  // 30% chance of crash between 2.0 and 4.0
                  crash = 2.0 + (r - 0.5) * 6.67;
              } else if (r < 0.95) {
                  // 15% chance of crash between 4.0 and 8.0
                  crash = 4.0 + (r - 0.8) * 26.67;
              } else {
                  // 5% chance of crash between 8.0 and 100.0 (rare large multipliers)
                  crash = 8.0 + (r - 0.95) * 1840;
              }
              
              // Limit maximum value for safety
              return Math.min(crash, 100.0);
          } catch (error) {
              app.log('Crush', `Error generating crash point: ${error.message}`, true);
              return 2.0; // Safe default value
          }
      };
      
      /**
       * Update game state
       */
      const updateGame = function() {
          try {
              if (!state.isPlaying) return;
              
              const elapsedTime = (Date.now() - state.gameStartTime) / 1000;
              
              // Update multiplier
              const growthFactor = 0.5;
              state.multiplier = Math.exp(elapsedTime * growthFactor);
              
              // Round to 2 decimal places for display
              const displayMultiplier = Math.floor(state.multiplier * 100) / 100;
              
              // Update display
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.textContent = displayMultiplier.toFixed(2);
                  
                  // Add visual effect for large multipliers
                  elements.multiplierDisplay.classList.remove('low', 'medium', 'high', 'extreme');
                  
                  if (displayMultiplier <= 1.5) {
                      elements.multiplierDisplay.classList.add('low');
                  } else if (displayMultiplier <= 3) {
                      elements.multiplierDisplay.classList.add('medium');
                  } else if (displayMultiplier <= 5) {
                      elements.multiplierDisplay.classList.add('high');
                  } else {
                      elements.multiplierDisplay.classList.add('extreme');
                  }
              }
              
              // Add point to graph every 100ms for smoothness
              if (Date.now() % 100 < 50) {
                  addGraphPoint(displayMultiplier);
              }
              
              // Check if game should end
              if (state.multiplier >= state.crashPoint) {
                  gameCrash();
              }
          } catch (error) {
              app.log('Crush', `Error updating game: ${error.message}`, true);
              
              // In case of error, stop the game
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
              gameCrash();
          }
      };
      
      /**
       * Add point to graph
       */
      const addGraphPoint = function(mult) {
          try {
              const elapsedTimeMs = Date.now() - state.gameStartTime;
              const elapsedTimeSec = elapsedTimeMs / 1000;
              
              // Save point for possible redrawing on resize
              state.graphPoints.push({
                  time: elapsedTimeSec,
                  multiplier: mult
              });
              
              // Redraw graph
              redrawGraph();
          } catch (error) {
              app.log('Crush', `Error adding point to graph: ${error.message}`, true);
          }
      };
      
      /**
       * Redraw entire graph
       */
      const redrawGraph = function() {
          try {
              if (!graphCtx || !graphCanvas) {
                  app.log('Crush', 'Cannot redraw graph - graphics context not available', true);
                  return;
              }
              
              // Clear canvas
              graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
              
              // Draw grid
              drawGrid();
              
              // If no points or just one point, exit
              if (state.graphPoints.length < 2) return;
              
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Find maximum values for scaling
              const maxTime = Math.max(5, state.graphPoints[state.graphPoints.length - 1].time);
              const maxMult = Math.max(5, ...state.graphPoints.map(p => p.multiplier));
              
              // Start drawing line
              graphCtx.beginPath();
              
              // Move to first point
              const x0 = (state.graphPoints[0].time / maxTime) * width;
              const y0 = height - (state.graphPoints[0].multiplier / maxMult) * height;
              graphCtx.moveTo(x0, y0);
              
              // Add remaining points
              for (let i = 1; i < state.graphPoints.length; i++) {
                  const x = (state.graphPoints[i].time / maxTime) * width;
                  const y = height - (state.graphPoints[i].multiplier / maxMult) * height;
                  
                  // Use Bezier curve for smoothing
                  if (i < state.graphPoints.length - 1) {
                      // Control points for smoothing
                      const nextX = (state.graphPoints[i + 1].time / maxTime) * width;
                      const nextY = height - (state.graphPoints[i + 1].multiplier / maxMult) * height;
                      
                      const cpx1 = x - (x - x0) / 2;
                      const cpy1 = y;
                      const cpx2 = x + (nextX - x) / 2;
                      const cpy2 = y;
                      
                      graphCtx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x, y);
                  } else {
                      graphCtx.lineTo(x, y);
                  }
              }
              
              // Line settings
              graphCtx.strokeStyle = 'rgba(0, 168, 107, 0.8)';
              graphCtx.lineWidth = 3;
              graphCtx.shadowColor = 'rgba(0, 168, 107, 0.5)';
              graphCtx.shadowBlur = 10;
              graphCtx.stroke();
              
              // Add fill under graph line
              const lastX = (state.graphPoints[state.graphPoints.length - 1].time / maxTime) * width;
              graphCtx.lineTo(lastX, height);
              graphCtx.lineTo(0, height);
              graphCtx.closePath();
              
              // Gradient fill
              const gradient = graphCtx.createLinearGradient(0, 0, 0, height);
              gradient.addColorStop(0, 'rgba(0, 168, 107, 0.5)');
              gradient.addColorStop(1, 'rgba(0, 168, 107, 0)');
              graphCtx.fillStyle = gradient;
              graphCtx.fill();
              
              // Current multiplier value
              const lastPoint = state.graphPoints[state.graphPoints.length - 1];
              const lastY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Draw point at line end
              graphCtx.beginPath();
              graphCtx.arc(lastX, lastY, 6, 0, Math.PI * 2);
              graphCtx.fillStyle = 'rgba(0, 168, 107, 1)';
              graphCtx.fill();
              graphCtx.strokeStyle = 'white';
              graphCtx.lineWidth = 2;
              graphCtx.stroke();
          } catch (error) {
              app.log('Crush', `Error redrawing graph: ${error.message}`, true);
          }
      };
      
      /**
       * Game crash handling
       */
      const gameCrash = async function() {
          try {
              // Check game state
              if (!state.isPlaying) return;
              
              // Check if casinoApp exists
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Stop the game
              clearInterval(state.gameInterval);
              state.isPlaying = false;
              
              // Tactile feedback
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('error');
              }
              
              // Update interface
              if (elements.crushResult) {
                  elements.crushResult.innerHTML = `
                      <div class="crash-icon">💥</div>
                      <div class="crash-text">Crash at ${state.multiplier.toFixed(2)}x!</div>
                  `;
                  elements.crushResult.classList.add('lose');
                  elements.crushResult.style.display = 'block';
                  setTimeout(() => {
                      elements.crushResult.style.opacity = '1';
                      elements.crushResult.style.transform = 'translateY(0)';
                  }, 50);
              }
              
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.classList.remove('active', 'low', 'medium', 'high', 'extreme');
                  elements.multiplierDisplay.classList.add('crashed');
              }
              
              if (elements.startBtn) {
                  elements.startBtn.disabled = false;
                  elements.startBtn.classList.remove('disabled');
              }
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
                  elements.cashoutBtn.classList.remove('active');
                  elements.cashoutBtn.classList.add('disabled');
              }
              
              // Crash animation
              animateCrash();
              
              // Update history
              gameHistory.unshift({
                  multiplier: state.multiplier,
                  timestamp: new Date().toISOString(),
                  isCashedOut: false
              });
              
              // Limit history size
              if (gameHistory.length > MAX_HISTORY) {
                  gameHistory = gameHistory.slice(0, MAX_HISTORY);
              }
              
              // Update history display
              updateHistoryDisplay();
              
              // Send loss to server
              await window.casinoApp.processGameResult(
                  'crush',
                  0, // No additional bet
                  'lose',
                  0,
                  {
                      crashPoint: state.multiplier,
                      finalMultiplier: state.multiplier
                  }
              );
              
              app.log('Crush', `Game ended with crash at multiplier ${state.multiplier.toFixed(2)}`);
          } catch (error) {
              app.log('Crush', `Error handling crash: ${error.message}`, true);
              
              // Reset state in any case
              state.isPlaying = false;
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
          }
      };
      
      /**
       * Crash animation
       */
      const animateCrash = function() {
          try {
              if (!graphCanvas || !graphCtx) {
                  app.log('Crush', 'Cannot animate crash - graphics context not available', true);
                  return;
              }
              
              // Add visual explosion effect
              const lastPoint = state.graphPoints[state.graphPoints.length - 1];
              
              // Find position of last point on graph
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Maximum values for scaling
              const maxTime = Math.max(5, lastPoint.time);
              const maxMult = Math.max(5, lastPoint.multiplier);
              
              const crashX = (lastPoint.time / maxTime) * width;
              const crashY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Draw explosion
              const explosionRadius = 20;
              const explosionColors = [
                  'rgba(255, 0, 0, 0.8)',
                  'rgba(255, 165, 0, 0.8)',
                  'rgba(255, 255, 0, 0.8)'
              ];
              
              for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                      if (!graphCtx) return;
                      
                      graphCtx.beginPath();
                      graphCtx.arc(crashX, crashY, explosionRadius * (i + 1), 0, Math.PI * 2);
                      graphCtx.fillStyle = explosionColors[i];
                      graphCtx.fill();
                      
                      // Redraw after small delay
                      setTimeout(redrawGraph, 150);
                  }, i * 100);
              }
          } catch (error) {
              app.log('Crush', `Error in crash animation: ${error.message}`, true);
          }
      };
      
      /**
       * Cash out - take winnings
       */
      const cashout = async function() {
          try {
              // Check game state
              if (!state.isPlaying) return;
              
              // Check if casinoApp exists
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Stop the game
              clearInterval(state.gameInterval);
              state.isPlaying = false;
              
              // Tactile feedback
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
              }
              
              // Calculate winnings
              const winAmount = Math.floor(state.betAmount * state.multiplier);
              
              // Update interface
              if (elements.crushResult) {
                  elements.crushResult.innerHTML = `
                      <div class="cashout-icon">💰</div>
                      <div class="cashout-text">Cashed out at ${state.multiplier.toFixed(2)}x!</div>
                      <div class="win-amount">+${winAmount} ⭐</div>
                  `;
                  elements.crushResult.classList.add('win');
                  elements.crushResult.style.display = 'block';
                  setTimeout(() => {
                      elements.crushResult.style.opacity = '1';
                      elements.crushResult.style.transform = 'translateY(0)';
                  }, 50);
              }
              
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.classList.remove('active', 'low', 'medium', 'high', 'extreme');
                  elements.multiplierDisplay.classList.add('cashed-out');
              }
              
              if (elements.startBtn) {
                  elements.startBtn.disabled = false;
                  elements.startBtn.classList.remove('disabled');
              }
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
                  elements.cashoutBtn.classList.remove('active');
                  elements.cashoutBtn.classList.add('disabled');
              }
              
              // Cash out animation
              animateCashout();
              
              // Update history
              gameHistory.unshift({
                  multiplier: state.multiplier,
                  timestamp: new Date().toISOString(),
                  isCashedOut: true
              });
              
              // Limit history size
              if (gameHistory.length > MAX_HISTORY) {
                  gameHistory = gameHistory.slice(0, MAX_HISTORY);
              }
              
              // Update history display
              updateHistoryDisplay();
              
              // Send win to server
              await window.casinoApp.processGameResult(
                  'crush',
                  0, // No additional bet
                  'win',
                  winAmount,
                  {
                      cashoutMultiplier: state.multiplier,
                      crashPoint: state.crashPoint
                  }
              );
              
              // Continue showing graph simulation until crash
              simulateContinuation();
              
              app.log('Crush', `Successfully cashed out at multiplier ${state.multiplier.toFixed(2)}, win: ${winAmount}`);
          } catch (error) {
              app.log('Crush', `Error in cashout: ${error.message}`, true);
              
              // Reset state in any case
              state.isPlaying = false;
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
          }
      };
      
      /**
       * Cash out animation
       */
      const animateCashout = function() {
          try {
              if (!graphCanvas || !graphCtx) {
                  app.log('Crush', 'Cannot animate cashout - graphics context not available', true);
                  return;
              }
              
              // Add visual effect for successful cashout
              const lastPoint = state.graphPoints[state.graphPoints.length - 1];
              
              // Find position of last point on graph
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Maximum values for scaling
              const maxTime = Math.max(5, lastPoint.time);
              const maxMult = Math.max(5, lastPoint.multiplier);
              
              const cashoutX = (lastPoint.time / maxTime) * width;
              const cashoutY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Draw successful cashout effect
              for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                      if (!graphCtx) return;
                      
                      graphCtx.beginPath();
                      graphCtx.arc(cashoutX, cashoutY, 15 - i * 3, 0, Math.PI * 2);
                      graphCtx.strokeStyle = 'rgba(0, 255, 0, ' + (0.8 - i * 0.2) + ')';
                      graphCtx.lineWidth = 3;
                      graphCtx.stroke();
                      
                      // Mark cashout point on graph
                      graphCtx.beginPath();
                      graphCtx.arc(cashoutX, cashoutY, 8, 0, Math.PI * 2);
                      graphCtx.fillStyle = 'rgba(0, 255, 0, 0.8)';
                      graphCtx.fill();
                      graphCtx.strokeStyle = 'white';
                      graphCtx.lineWidth = 2;
                      graphCtx.stroke();
                  }, i * 100);
              }
          } catch (error) {
              app.log('Crush', `Error in cashout animation: ${error.message}`, true);
          }
      };
      
      /**
       * Simulate graph continuation after cashout
       */
      const simulateContinuation = function() {
          try {
              const cashoutMultiplier = state.multiplier;
              const cashoutTime = (Date.now() - state.gameStartTime) / 1000;
              
              // Create interval for graph continuation simulation
              let simulationTimeout = null;
              let lastTime = Date.now();
              let simulationInterval = setInterval(() => {
                  try {
                      // Calculate current time from game start
                      const elapsedTime = (Date.now() - state.gameStartTime) / 1000;
                      
                      // Update multiplier (using same formula as in updateGame)
                      const growthFactor = 0.5;
                      const simulatedMultiplier = Math.exp(elapsedTime * growthFactor);
                      const displayMultiplier = Math.floor(simulatedMultiplier * 100) / 100;
                      
                      // Add point to graph
                      if (Date.now() - lastTime > 100) {
                          addGraphPoint(displayMultiplier);
                          lastTime = Date.now();
                      }
                      
                      // Check if crash point reached
                      if (simulatedMultiplier >= state.crashPoint) {
                          clearInterval(simulationInterval);
                          
                          // Crash animation
                          animateCrash();
                          
                          // Show message about would-be crash
                          if (elements.crushResult && elements.crushResult.classList.contains('win')) {
                              const crashInfo = document.createElement('div');
                              crashInfo.className = 'crash-info';
                              crashInfo.textContent = `Would have crashed at ${state.crashPoint.toFixed(2)}x`;
                              elements.crushResult.appendChild(crashInfo);
                          }
                      }
                  } catch (simError) {
                      app.log('Crush', `Error in simulation: ${simError.message}`, true);
                      clearInterval(simulationInterval);
                  }
              }, 50);
              
              // Stop simulation after 5 seconds to save resources
              simulationTimeout = setTimeout(() => {
                  clearInterval(simulationInterval);
              }, 5000);
              
              // Memory leak protection
              window.addEventListener('beforeunload', () => {
                  if (simulationInterval) clearInterval(simulationInterval);
                  if (simulationTimeout) clearTimeout(simulationTimeout);
              });
          } catch (error) {
              app.log('Crush', `Error simulating continuation: ${error.message}`, true);
          }
      };
      
      // Return public interface
      return {
          // Main methods
          init: init,
          startGame: startGame,
          cashout: cashout,
          
          // Status check method
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isPlaying: state.isPlaying,
                  elementsFound: {
                      startBtn: !!elements.startBtn,
                      cashoutBtn: !!elements.cashoutBtn,
                      crushBet: !!elements.crushBet,
                      multiplierDisplay: !!elements.multiplierDisplay,
                      crushGraph: !!elements.crushGraph
                  },
                  graphReady: !!graphCtx,
                  gameState: {
                      multiplier: state.multiplier,
                      crashPoint: state.crashPoint,
                      graphPoints: state.graphPoints.length
                  }
              };
          }
      };
  })();
  
  // Register game in all formats for maximum compatibility
  try {
      // 1. Register through new system
      if (window.registerGame) {
          window.registerGame('crushGame', crushGame);
          app.log('Crush', 'Game registered through new registerGame system');
      }
      
      // 2. Export to global namespace (backward compatibility)
      window.crushGame = crushGame;
      app.log('Crush', 'Game exported to global namespace');
      
      // 3. Log module completion
      app.log('Crush', 'Module successfully loaded and ready for initialization');
      
      // 4. Automatic initialization on page load
      document.addEventListener('DOMContentLoaded', function() {
          setTimeout(() => {
              if (!crushGame.getStatus().initialized && !crushGame.getStatus().initializationStarted) {
                  app.log('Crush', 'Starting automatic initialization');
                  crushGame.init();
              }
          }, 500);
      });
      
      // 5. If DOM already loaded, start initialization immediately
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(() => {
              if (!crushGame.getStatus().initialized && !crushGame.getStatus().initializationStarted) {
                  app.log('Crush', 'Starting automatic initialization (DOM already loaded)');
                  crushGame.init();
              }
          }, 500);
      }
      
  } catch (error) {
      app.log('Crush', `Error registering game: ${error.message}`, true);
  }
})();