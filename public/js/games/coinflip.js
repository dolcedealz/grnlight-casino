/**
 * coinflip.js - Optimized Coin Flip game with dispute functionality
 * Version 1.0.0
 * 
 * Features:
 * - Standard coin flip game
 * - Dispute resolution system
 * - Telegram Mini App integration
 * - Animation and tactile feedback
 */

// Prevent conflicts with isolated environment
(function() {
    // Check for app object
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
        // UI elements
        let elements = {
            coinFlipContainer: null,
            coin: null,
            headsBtn: null,
            tailsBtn: null,
            flipBtn: null,
            betAmount: null,
            resultDisplay: null,
            balanceDisplay: null
        };
        
        // Game state
        let state = {
            isFlipping: false,
            initialized: false,
            initializationStarted: false,
            selectedSide: null, // 'heads' or 'tails'
            disputeId: null,    // If game is running as part of a dispute
            disputeData: null,  // Dispute data if available
            playerSide: null,   // Player's side in dispute ('heads' or 'tails')
            opponentSide: null  // Opponent's side in dispute
        };
        
        /**
         * Game initialization
         * Protected from repeated initialization and with timeout
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
                        // Create UI elements if they don't exist
                        ensureUIElements();
                        
                        // Get DOM elements
                        await findDOMElements();
                        
                        // Check URL parameters for dispute
                        checkDisputeParams();
                        
                        // Set up event listeners
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
         * Check URL parameters for dispute ID
         */
        const checkDisputeParams = function() {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const disputeId = urlParams.get('dispute');
                
                if (disputeId) {
                    state.disputeId = disputeId;
                    app.log('CoinFlip', `Dispute ID found: ${disputeId}`);
                    
                    // Load dispute data
                    loadDisputeData(disputeId).then(dispute => {
                        if (dispute) {
                            setupDisputeMode(dispute);
                        }
                    });
                }
            } catch (error) {
                app.log('CoinFlip', `Error checking URL parameters: ${error.message}`, true);
            }
        };
        
        /**
         * Load dispute data from server
         */
        const loadDisputeData = async function(disputeId) {
            try {
                app.log('CoinFlip', `Loading dispute data for ${disputeId}`);
                
                // In real implementation, this would be an API call
                // For demo, using static data
                const disputeData = {
                    id: disputeId,
                    creator: {
                        telegramId: 123456789,
                        username: 'user1',
                        side: 'heads'
                    },
                    opponent: {
                        telegramId: 987654321,
                        username: 'user2',
                        side: 'tails'
                    },
                    amount: 100,
                    subject: 'Who will win the match?',
                    status: 'accepted',
                    result: null
                };
                
                // Store data in state
                state.disputeData = disputeData;
                
                return disputeData;
            } catch (error) {
                app.log('CoinFlip', `Error loading dispute data: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Configure dispute mode
         */
        const setupDisputeMode = function(dispute) {
            try {
                app.log('CoinFlip', 'Setting up dispute mode');
                
                // Determine player's side
                const currentUserId = window.GreenLightApp.user.telegramId;
                const isCreator = currentUserId === dispute.creator.telegramId;
                
                state.playerSide = isCreator ? dispute.creator.side : dispute.opponent.side;
                state.opponentSide = isCreator ? dispute.opponent.side : dispute.creator.side;
                
                // Update UI
                if (elements.coinFlipContainer) {
                    // Add class for dispute mode
                    elements.coinFlipContainer.classList.add('dispute-mode');
                    
                    // Add dispute info
                    const disputeInfo = document.createElement('div');
                    disputeInfo.className = 'dispute-info';
                    disputeInfo.innerHTML = `
                        <h3>Dispute: ${dispute.subject}</h3>
                        <div class="dispute-details">
                            <p>Amount: ${dispute.amount} ⭐</p>
                            <p>Your side: ${state.playerSide === 'heads' ? 'Heads' : 'Tails'}</p>
                            <p>Opponent: @${isCreator ? dispute.opponent.username : dispute.creator.username}</p>
                        </div>
                    `;
                    
                    // Insert before coin
                    if (elements.coin) {
                        elements.coin.parentNode.insertBefore(disputeInfo, elements.coin);
                    } else {
                        elements.coinFlipContainer.prepend(disputeInfo);
                    }
                    
                    // Fix side selection
                    state.selectedSide = state.playerSide;
                    
                    // Disable side selection buttons
                    if (elements.headsBtn) {
                        elements.headsBtn.disabled = true;
                        if (state.playerSide === 'heads') {
                            elements.headsBtn.classList.add('selected');
                        }
                    }
                    
                    if (elements.tailsBtn) {
                        elements.tailsBtn.disabled = true;
                        if (state.playerSide === 'tails') {
                            elements.tailsBtn.classList.add('selected');
                        }
                    }
                    
                    // Set bet amount
                    if (elements.betAmount) {
                        elements.betAmount.value = dispute.amount;
                        elements.betAmount.disabled = true;
                    }
                }
                
            } catch (error) {
                app.log('CoinFlip', `Error setting up dispute mode: ${error.message}`, true);
            }
        };
        
        /**
         * Ensure UI elements exist
         */
        const ensureUIElements = function() {
            try {
                app.log('CoinFlip', 'Checking UI elements');
                
                // Find or create main game container
                let container = document.getElementById('coinflip-screen');
                
                if (!container) {
                    app.log('CoinFlip', 'Creating game container');
                    
                    // Find insertion point
                    const mainContent = document.querySelector('.main-content');
                    
                    if (!mainContent) {
                        app.log('CoinFlip', 'main-content container not found', true);
                        return;
                    }
                    
                    // Create game screen
                    container = document.createElement('div');
                    container.id = 'coinflip-screen';
                    container.className = 'screen';
                    
                    // Add HTML markup
                    container.innerHTML = `
                        <div class="game-header">
                            <button class="back-btn">← Back</button>
                            <h2>Coin Flip</h2>
                        </div>
                        <div class="coinflip-container">
                            <div class="coin-wrapper">
                                <div id="coin" class="coin">
                                    <div class="heads-side">
                                        <div class="coin-design">
                                            <span>H</span>
                                        </div>
                                    </div>
                                    <div class="tails-side">
                                        <div class="coin-design">
                                            <span>T</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="result-display" class="result"></div>
                            
                            <div class="selection-buttons">
                                <button id="heads-btn" class="side-btn">Heads</button>
                                <button id="tails-btn" class="side-btn">Tails</button>
                            </div>
                            
                            <div class="bet-controls">
                                <div class="bet-amount">
                                    <label for="coinflip-bet">Bet Amount:</label>
                                    <input type="number" id="coinflip-bet" min="1" value="10">
                                </div>
                                <button id="flip-btn" class="action-btn">FLIP</button>
                            </div>
                        </div>
                    `;
                    
                    // Add to DOM
                    mainContent.appendChild(container);
                    
                    // Add game card to main screen
                    addGameCard();
                    
                    // Add styles
                    addStyles();
                }
            } catch (error) {
                app.log('CoinFlip', `Error checking interface: ${error.message}`, true);
            }
        };
        
        /**
         * Add game card to main screen
         */
        const addGameCard = function() {
            try {
                const gameGrid = document.querySelector('.game-grid');
                
                if (!gameGrid) {
                    app.log('CoinFlip', 'Game grid not found', true);
                    return;
                }
                
                // Check if card already exists
                if (document.querySelector('.game-card[data-game="coinflip"]')) {
                    return;
                }
                
                // Create card
                const card = document.createElement('div');
                card.className = 'game-card';
                card.setAttribute('data-game', 'coinflip');
                
                card.innerHTML = `
                    <div class="game-icon">🪙</div>
                    <div class="game-name">Coin Flip</div>
                `;
                
                // Add to grid
                gameGrid.appendChild(card);
                
                // Update card handlers
                const gameCards = document.querySelectorAll('.game-card');
                gameCards.forEach(card => {
                    card.addEventListener('click', (e) => {
                        const game = card.getAttribute('data-game');
                        if (!game) return;
                        
                        // Tactile feedback
                        if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                            window.casinoApp.provideTactileFeedback('light');
                        }
                        
                        // Pressed animation
                        card.classList.add('card-pressed');
                        setTimeout(() => {
                            card.classList.remove('card-pressed');
                        }, 150);
                        
                        // Switch screens
                        document.querySelectorAll('.screen').forEach(screen => {
                            screen.classList.remove('active');
                        });
                        
                        const targetScreen = document.getElementById(`${game}-screen`);
                        if (targetScreen) {
                            targetScreen.classList.add('active');
                        }
                    });
                });
            } catch (error) {
                app.log('CoinFlip', `Error adding card: ${error.message}`, true);
            }
        };
        
        /**
         * Add styles for the game
         */
        const addStyles = function() {
            try {
                // Check if styles already exist
                if (document.getElementById('coinflip-styles')) {
                    return;
                }
                
                // Create style element
                const style = document.createElement('style');
                style.id = 'coinflip-styles';
                
                // Add CSS
                style.textContent = `
                    .coinflip-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 2rem;
                        width: 100%;
                        max-width: 500px;
                        margin: 0 auto;
                        padding: 1rem;
                    }
                    
                    .coin-wrapper {
                        perspective: 800px;
                        width: 200px;
                        height: 200px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        margin: 2rem 0;
                    }
                    
                    .coin {
                        position: relative;
                        width: 150px;
                        height: 150px;
                        transform-style: preserve-3d;
                        transition: transform 1s ease-in-out;
                    }
                    
                    .coin.flipping {
                        animation: flip-coin 3s forwards;
                    }
                    
                    .coin .heads-side,
                    .coin .tails-side {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        backface-visibility: hidden;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        font-size: 2rem;
                        font-weight: bold;
                    }
                    
                    .coin .heads-side {
                        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
                        z-index: 2;
                    }
                    
                    .coin .tails-side {
                        background: linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%);
                        transform: rotateY(180deg);
                    }
                    
                    .coin-design {
                        width: 80%;
                        height: 80%;
                        border-radius: 50%;
                        border: 3px solid rgba(0,0,0,0.2);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        color: rgba(0,0,0,0.6);
                    }
                    
                    .selection-buttons {
                        display: flex;
                        gap: 1rem;
                        margin-bottom: 1rem;
                    }
                    
                    .side-btn {
                        padding: 0.8rem 2rem;
                        border: 2px solid var(--primary-green);
                        background: var(--dark-gray);
                        color: var(--white);
                        border-radius: 50px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.3s;
                    }
                    
                    .side-btn:hover {
                        background: rgba(0, 168, 107, 0.2);
                    }
                    
                    .side-btn.selected {
                        background: var(--primary-green);
                        color: var(--white);
                    }
                    
                    .bet-controls {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                    }
                    
                    .dispute-info {
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 10px;
                        padding: 1rem;
                        margin-bottom: 1rem;
                        border: 1px solid var(--primary-green);
                        width: 100%;
                    }
                    
                    .dispute-details {
                        margin-top: 0.5rem;
                        font-size: 0.9rem;
                    }
                    
                    @keyframes flip-coin {
                        0% {
                            transform: rotateY(0);
                        }
                        100% {
                            transform: rotateY(1800deg);
                        }
                    }
                    
                    @keyframes flip-to-heads {
                        0% {
                            transform: rotateY(0);
                        }
                        100% {
                            transform: rotateY(1800deg);
                        }
                    }
                    
                    @keyframes flip-to-tails {
                        0% {
                            transform: rotateY(0);
                        }
                        100% {
                            transform: rotateY(1980deg);
                        }
                    }
                    
                    .coin.heads-result {
                        animation: flip-to-heads 3s forwards;
                    }
                    
                    .coin.tails-result {
                        animation: flip-to-tails 3s forwards;
                    }
                `;
                
                // Add to DOM
                document.head.appendChild(style);
                
            } catch (error) {
                app.log('CoinFlip', `Error adding styles: ${error.message}`, true);
            }
        };
        
        /**
         * Find DOM elements
         */
        const findDOMElements = async function() {
            return new Promise((resolve) => {
                setTimeout(() => {
                    elements.coinFlipContainer = document.querySelector('.coinflip-container');
                    elements.coin = document.getElementById('coin');
                    elements.headsBtn = document.getElementById('heads-btn');
                    elements.tailsBtn = document.getElementById('tails-btn');
                    elements.flipBtn = document.getElementById('flip-btn');
                    elements.betAmount = document.getElementById('coinflip-bet');
                    elements.resultDisplay = document.getElementById('result-display');
                    
                    // Check if elements exist
                    if (!elements.coin) {
                        app.log('CoinFlip', 'Coin element not found', true);
                    }
                    
                    if (!elements.flipBtn) {
                        app.log('CoinFlip', 'Flip button not found', true);
                    }
                    
                    resolve();
                }, 100);
            });
        };
        
        /**
         * Set up event listeners
         */
        const setupEventListeners = function() {
            try {
                // Heads button
                if (elements.headsBtn) {
                    elements.headsBtn.addEventListener('click', () => selectSide('heads'));
                }
                
                // Tails button
                if (elements.tailsBtn) {
                    elements.tailsBtn.addEventListener('click', () => selectSide('tails'));
                }
                
                // Flip button
                if (elements.flipBtn) {
                    const newFlipBtn = elements.flipBtn.cloneNode(true);
                    if (elements.flipBtn.parentNode) {
                        elements.flipBtn.parentNode.replaceChild(newFlipBtn, elements.flipBtn);
                    }
                    elements.flipBtn = newFlipBtn;
                    
                    elements.flipBtn.addEventListener('click', flipCoin);
                }
                
                // Back button handler
                const backBtn = document.querySelector('#coinflip-screen .back-btn');
                if (backBtn) {
                    backBtn.addEventListener('click', () => {
                        if (state.disputeId) {
                            // If this is a dispute, return to bot
                            if (window.Telegram && window.Telegram.WebApp) {
                                window.Telegram.WebApp.close();
                            }
                        } else {
                            // Otherwise return to main screen
                            document.querySelectorAll('.screen').forEach(screen => {
                                screen.classList.remove('active');
                            });
                            
                            const welcomeScreen = document.getElementById('welcome-screen');
                            if (welcomeScreen) {
                                welcomeScreen.classList.add('active');
                            }
                        }
                    });
                }
                
                app.log('CoinFlip', 'Event listeners set up');
            } catch (error) {
                app.log('CoinFlip', `Error setting up event listeners: ${error.message}`, true);
            }
        };
        
        /**
         * Select coin side
         */
        const selectSide = function(side) {
            try {
                // Check if side change is allowed
                if (state.disputeId) {
                    return; // In dispute mode, side is fixed
                }
                
                state.selectedSide = side;
                
                // Update visual display
                if (elements.headsBtn) {
                    elements.headsBtn.classList.toggle('selected', side === 'heads');
                }
                
                if (elements.tailsBtn) {
                    elements.tailsBtn.classList.toggle('selected', side === 'tails');
                }
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                app.log('CoinFlip', `Side selected: ${side}`);
            } catch (error) {
                app.log('CoinFlip', `Error selecting side: ${error.message}`, true);
            }
        };
        
        /**
         * Flip coin
         */
        const flipCoin = async function() {
            try {
                // Check if already flipping
                if (state.isFlipping) {
                    return;
                }
                
                // Check if side is selected
                if (!state.selectedSide && !state.disputeId) {
                    app.log('CoinFlip', 'No side selected');
                    
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Please select Heads or Tails');
                    } else {
                        alert('Please select Heads or Tails');
                    }
                    return;
                }
                
                // Get bet amount
                const bet = parseInt(elements.betAmount.value);
                
                // Check bet validity
                if (isNaN(bet) || bet <= 0) {
                    app.log('CoinFlip', 'Invalid bet', true);
                    
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Please enter a valid bet amount');
                    } else {
                        alert('Please enter a valid bet amount');
                    }
                    return;
                }
                
                // Check balance
                if (window.GreenLightApp && window.GreenLightApp.user && bet > window.GreenLightApp.user.balance) {
                    app.log('CoinFlip', 'Insufficient funds', true);
                    
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Insufficient funds for this bet');
                    } else {
                        alert('Insufficient funds for this bet');
                    }
                    return;
                }
                
                // Set state
                state.isFlipping = true;
                
                // Disable buttons during flip
                if (elements.flipBtn) elements.flipBtn.disabled = true;
                if (elements.headsBtn) elements.headsBtn.disabled = true;
                if (elements.tailsBtn) elements.tailsBtn.disabled = true;
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Clear previous result
                if (elements.resultDisplay) {
                    elements.resultDisplay.textContent = '';
                    elements.resultDisplay.classList.remove('win', 'lose');
                    elements.resultDisplay.style.display = 'none';
                }
                
                // Start coin animation
                if (elements.coin) {
                    // Remove previous result classes
                    elements.coin.classList.remove('heads-result', 'tails-result');
                    
                    // Determine flip result
                    const result = await determineResult();
                    
                    // Add appropriate class for animation
                    elements.coin.classList.add(`${result}-result`);
                    
                    // Show result after 3 seconds
                    setTimeout(() => {
                        showResult(result);
                    }, 3000);
                } else {
                    // If coin element not found, just get result
                    const result = await determineResult();
                    showResult(result);
                }
                
            } catch (error) {
                app.log('CoinFlip', `Error flipping coin: ${error.message}`, true);
                
                // Reset state
                state.isFlipping = false;
                if (elements.flipBtn) elements.flipBtn.disabled = false;
                if (elements.headsBtn) elements.headsBtn.disabled = false;
                if (elements.tailsBtn) elements.tailsBtn.disabled = false;
            }
        };
        
        /**
         * Determine flip result
         */
        const determineResult = async function() {
            try {
                // In dispute mode, result is preset
                if (state.disputeId && state.disputeData) {
                    const expectedResult = await getPresetResult(state.disputeId);
                    if (expectedResult) {
                        return expectedResult;
                    }
                }
                
                // Generate random result
                return Math.random() < 0.5 ? 'heads' : 'tails';
            } catch (error) {
                app.log('CoinFlip', `Error determining result: ${error.message}`, true);
                return Math.random() < 0.5 ? 'heads' : 'tails';
            }
        };
        
        /**
         * Get preset result for dispute
         */
        const getPresetResult = async function(disputeId) {
            try {
                // In real implementation, this would be an API call
                // For demo, using random value
                return Math.random() < 0.5 ? 'heads' : 'tails';
            } catch (error) {
                app.log('CoinFlip', `Error getting preset result: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Show result
         */
        const showResult = async function(result) {
            try {
                // Reset state
                state.isFlipping = false;
                
                // Enable buttons
                if (elements.flipBtn) elements.flipBtn.disabled = false;
                
                // In dispute mode, side selection buttons remain disabled
                if (!state.disputeId) {
                    if (elements.headsBtn) elements.headsBtn.disabled = false;
                    if (elements.tailsBtn) elements.tailsBtn.disabled = false;
                }
                
                // Get bet amount
                const bet = parseInt(elements.betAmount.value);
                
                // Determine if player won
                let isWin = false;
                let winAmount = 0;
                
                if (state.disputeId) {
                    // In dispute mode, compare with player's side
                    isWin = (state.playerSide === result);
                    winAmount = isWin ? Math.floor(bet * 2 * 0.95) : 0; // Account for 5% commission
                } else {
                    // In regular mode, compare with selected side
                    isWin = (state.selectedSide === result);
                    winAmount = isWin ? bet * 2 : 0;
                }
                
                // Process game result
                await processGameResult(bet, isWin, winAmount, result);
                
                // Show result
                if (elements.resultDisplay) {
                    elements.resultDisplay.innerHTML = isWin ? 
                        `<div class="win-title">You won ${winAmount} ⭐!</div>` : 
                        '<div class="lose-title">You lost. Try again!</div>';
                    
                    elements.resultDisplay.classList.add(isWin ? 'win' : 'lose');
                    elements.resultDisplay.style.display = 'block';
                }
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    if (isWin) {
                        window.casinoApp.provideTactileFeedback('success');
                    } else {
                        window.casinoApp.provideTactileFeedback('warning');
                    }
                }
                
                // Update dispute data if applicable
                if (state.disputeId) {
                    updateDisputeResult(result, isWin);
                }
                
                app.log('CoinFlip', `Result: ${result}, Win: ${isWin}`);
            } catch (error) {
                app.log('CoinFlip', `Error showing result: ${error.message}`, true);
            }
        };
        
        /**
         * Process game result
         */
        const processGameResult = async function(bet, isWin, winAmount, result) {
            try {
                // Check for casinoApp
                if (!window.casinoApp || !window.casinoApp.processGameResult) {
                    app.log('CoinFlip', 'casinoApp.processGameResult not found', true);
                    return;
                }
                
                // Send result to casinoApp
                await window.casinoApp.processGameResult(
                    'coinflip',
                    bet,
                    isWin ? 'win' : 'lose',
                    winAmount,
                    {
                        selectedSide: state.selectedSide || state.playerSide,
                        result: result,
                        isDispute: !!state.disputeId,
                        disputeId: state.disputeId
                    }
                );
                
                // Update balance locally
                if (window.GreenLightApp && window.GreenLightApp.user) {
                    if (isWin) {
                        window.GreenLightApp.user.balance += winAmount - bet;
                    } else {
                        window.GreenLightApp.user.balance -= bet;
                    }
                    
                    // Update balance display
                    if (window.casinoApp && window.casinoApp.updateBalance) {
                        window.casinoApp.updateBalance();
                    }
                }
                
            } catch (error) {
                app.log('CoinFlip', `Error processing game result: ${error.message}`, true);
            }
        };
        
        /**
         * Update dispute result
         */
        const updateDisputeResult = async function(result, isWin) {
            try {
                if (!state.disputeId) return;
                
                app.log('CoinFlip', `Updating dispute result ${state.disputeId}`);
                
                // In real implementation, this would be an API call
                const disputeResult = {
                    disputeId: state.disputeId,
                    result: result,
                    winnerId: isWin ? window.GreenLightApp.user.telegramId : 
                        (state.disputeData.creator.telegramId === window.GreenLightApp.user.telegramId ? 
                            state.disputeData.opponent.telegramId : 
                            state.disputeData.creator.telegramId)
                };
                
                // Close mini-app after 5 seconds
                setTimeout(() => {
                    if (window.Telegram && window.Telegram.WebApp) {
                        window.Telegram.WebApp.close();
                    }
                }, 5000);
                
            } catch (error) {
                app.log('CoinFlip', `Error updating dispute result: ${error.message}`, true);
            }
        };
        
        // Return public interface
        return {
            // Main methods
            init: init,
            flipCoin: flipCoin,
            selectSide: selectSide,
            
            // Status check method
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isFlipping: state.isFlipping,
                    selectedSide: state.selectedSide,
                    disputeId: state.disputeId,
                    disputeMode: !!state.disputeId,
                    elementsFound: {
                        coin: !!elements.coin,
                        flipBtn: !!elements.flipBtn,
                        headsBtn: !!elements.headsBtn,
                        tailsBtn: !!elements.tailsBtn
                    }
                };
            }
        };
    })();
    
    // Register game in all formats for compatibility
    try {
        // 1. Register through new system
        if (window.registerGame) {
            window.registerGame('coinFlipGame', coinFlipGame);
            app.log('CoinFlip', 'Game registered through registerGame system');
        }
        
        // 2. Export to global namespace (backward compatibility)
        window.coinFlipGame = coinFlipGame;
        app.log('CoinFlip', 'Game exported to global namespace');
        
        // 3. Log module loading completion
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