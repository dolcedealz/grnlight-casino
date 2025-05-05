/**
 * main.js - Core module of Greenlight Casino
 * Version 2.1.0 - Improved architecture with error resilience
 */

// Check for main application object
if (!window.GreenLightApp) {
    console.error('GreenLightApp not initialized!');
    window.GreenLightApp = {
        log: function(source, message, isError) {
            if (isError) console.error(`[${source}] ${message}`);
            else console.log(`[${source}] ${message}`);
        },
        loading: {},
        games: {},
        user: {
            telegramId: null,
            firstName: 'Player',
            lastName: '',
            username: '',
            balance: 1000
        }
    };
}

// Get reference to global application object
const app = window.GreenLightApp;
app.log('Main', 'Starting core application module v2.1.0');

// Main application structure - casinoApp module
const casinoApp = (function() {
    // API URL for backend interaction
    const API_URL = window.location.origin + '/api';
    
    // Reference to Telegram WebApp
    let tgApp = null;
    
    // Initialization flags
    let initialized = false;
    let uiInitialized = false;
    let telegramInitialized = false;
    
    // Supported games
    const supportedGames = ['slots', 'roulette', 'guessnumber', 'miner', 'crush'];
    
    // Initialize the application - main entry point
    const init = async function() {
        app.log('Main', 'Starting application initialization');
        
        try {
            // Report loading progress
            updateProgress(30);
            
            // IMPORTANT: Start critical processes in parallel
            const uiPromise = initUI();
            const telegramPromise = initTelegram();
            
            // Wait for UI initialization (critical)
            await uiPromise;
            
            // UI ready - notify loader
            if (window.appLoader && typeof window.appLoader.uiReady === 'function') {
                window.appLoader.uiReady();
            }
            
            // Update progress
            updateProgress(60);
            
            // IMPORTANT: Don't wait for initTelegram to complete to avoid blocking
            // Just set up completion handler
            telegramPromise
                .then(function() {
                    app.log('Main', 'Telegram API initialized successfully');
                    telegramInitialized = true;
                    app.loading.telegramInitialized = true;
                    updateBalance(); // Update balance after receiving data
                })
                .catch(function(error) {
                    app.log('Main', `Telegram initialization error: ${error.message}`, true);
                    // Continue in demo mode even after Telegram error
                });
            
            // Mark main initialization as complete
            initialized = true;
            app.loading.mainInitialized = true;
            
            // Notify loader of completion
            notifyLoaderReady();
            
            // Start NON-CRITICAL game loading (in background)
            initGamesBackground();
            
            // Return success
            return true;
            
        } catch (error) {
            app.log('Main', `Critical initialization error: ${error.message}`, true);
            
            // Try to show interface even on error
            showEmergencyUI();
            
            // Notify loader of completion
            notifyLoaderReady();
            
            return false;
        }
    };
    
    // UI initialization
    const initUI = async function() {
        app.log('Main', 'Initializing user interface');
        
        try {
            // Set up event handlers
            setupEventListeners();
            
            // Activate initial screen
            activateWelcomeScreen();
            
            // Initial balance update
            updateBalance();
            
            // Mark UI initialization as successful
            uiInitialized = true;
            app.loading.uiReady = true;
            
            app.log('Main', 'User interface successfully initialized');
            return true;
            
        } catch (error) {
            app.log('Main', `UI initialization error: ${error.message}`, true);
            throw error; // Propagate error as UI is critical
        }
    };
    
    // Telegram WebApp initialization
    const initTelegram = async function() {
        app.log('Main', 'Initializing Telegram WebApp');
        
        try {
            // Check Telegram API availability
            if (!window.Telegram || !window.Telegram.WebApp) {
                app.log('Main', 'Telegram WebApp API unavailable, using demo mode');
                return false;
            }
            
            // Save reference to Telegram WebApp
            tgApp = window.Telegram.WebApp;
            
            // Expand application window
            tgApp.expand();
            app.log('Main', 'Telegram WebApp expanded');
            
            // Get Telegram user data
            if (tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
                const user = tgApp.initDataUnsafe.user;
                
                // Update user data
                app.user.telegramId = user.id;
                app.user.firstName = user.first_name || 'Player';
                app.user.lastName = user.last_name || '';
                app.user.username = user.username || '';
                
                app.log('Main', `Telegram user: ${app.user.firstName} (${app.user.telegramId})`);
                
                // Limit API operation wait time
                const registerPromise = Promise.race([
                    registerUser(),
                    new Promise(function(_, reject) {
                        setTimeout(function() {
                            reject(new Error('Timeout'));
                        }, 5000);
                    })
                ]);
                
                try {
                    // Register user and get profile
                    await registerPromise;
                    await getUserProfile();
                } catch (apiError) {
                    app.log('Main', `API error: ${apiError.message}. Using local data.`, true);
                }
            } else {
                app.log('Main', 'Telegram user data unavailable, using defaults');
            }
            
            // Mark Telegram initialization as successful
            telegramInitialized = true;
            app.loading.telegramInitialized = true;
            
            return true;
            
        } catch (error) {
            app.log('Main', `Telegram WebApp error: ${error.message}`, true);
            // Return false but don't throw error - continue in demo mode
            return false;
        }
    };
    
    // Background game initialization (doesn't block main thread)
    const initGamesBackground = function() {
        app.log('Main', 'Starting background game initialization');
        
        // Run in timeout to let UI update
        setTimeout(function() {
            try {
                supportedGames.forEach(function(gameType) {
                    const objectName = gameType + 'Game';
                    
                    // Safely initialize game
                    safeInitGame(gameType, objectName)
                        .then(function(success) {
                            if (success) {
                                app.log('Main', `Game ${gameType} successfully initialized`);
                            } else {
                                app.log('Main', `Game ${gameType} not initialized`, true);
                            }
                        })
                        .catch(function(error) {
                            app.log('Main', `Error initializing ${gameType}: ${error.message}`, true);
                        });
                });
                
                app.loading.gamesInitialized = true;
                
            } catch (error) {
                app.log('Main', `General game initialization error: ${error.message}`, true);
            }
        }, 1000);
    };
    
    // Safe game initialization with timeout
    const safeInitGame = async function(gameName, objectName) {
        app.log('Main', `Attempting to initialize game ${gameName}`);
        
        // Set maximum wait time
        return Promise.race([
            // Main initialization process
            (async function() {
                try {
                    // Check new format game storage
                    if (app.games[gameName] && app.games[gameName].instance) {
                        const gameObject = app.games[gameName].instance;
                        if (typeof gameObject.init === 'function') {
                            await gameObject.init();
                            app.log('Main', `Game ${gameName} initialized via app.games`);
                            return true;
                        }
                    }
                    
                    // Check GreenLightGames (old format)
                    if (window.GreenLightGames && window.GreenLightGames[objectName]) {
                        const gameObject = window.GreenLightGames[objectName];
                        if (typeof gameObject.init === 'function') {
                            await gameObject.init();
                            app.log('Main', `Game ${gameName} initialized via GreenLightGames`);
                            return true;
                        }
                    }
                    
                    // Check global namespace
                    if (window[objectName] && typeof window[objectName].init === 'function') {
                        await window[objectName].init();
                        app.log('Main', `Game ${gameName} initialized via global object`);
                        return true;
                    }
                    
                    app.log('Main', `Game ${gameName} not found or has no init method`);
                    return false;
                    
                } catch (error) {
                    app.log('Main', `Error initializing ${gameName}: ${error.message}`, true);
                    return false;
                }
            })(),
            
            // Initialization timeout
            new Promise(function(resolve) {
                setTimeout(function() {
                    app.log('Main', `Game initialization timeout for ${gameName}`, true);
                    resolve(false);
                }, 5000); // 5 seconds maximum
            })
        ]);
    };
    
    // Set up event listeners
    const setupEventListeners = function() {
        app.log('Main', 'Setting up event listeners');
        
        try {
            // Event handlers for game cards
            const gameCards = document.querySelectorAll('.game-card');
            gameCards.forEach(function(card) {
                card.addEventListener('click', function(e) {
                    const game = card.getAttribute('data-game');
                    if (!game) return;
                    
                    // Ignore non-supported games
                    if (!supportedGames.includes(game)) {
                        app.log('Main', `Game ${game} is not supported`, true);
                        showNotification('This game is not available');
                        return;
                    }
                    
                    app.log('Main', `Selected game: ${game}`);
                    
                    // Tactile feedback
                    provideTactileFeedback('light');
                    
                    // Press animation
                    card.classList.add('card-pressed');
                    setTimeout(function() {
                        card.classList.remove('card-pressed');
                    }, 150);
                    
                    // Switch screens
                    document.querySelectorAll('.screen').forEach(function(screen) {
                        screen.classList.remove('active');
                    });
                    
                    const targetScreen = document.getElementById(`${game}-screen`);
                    if (targetScreen) {
                        targetScreen.classList.add('active');
                    } else {
                        app.log('Main', `Screen for ${game} not found`, true);
                        showNotification('Game screen not found');
                    }
                });
            });
            
            // Handlers for "Back" buttons
            const backButtons = document.querySelectorAll('.back-btn');
            backButtons.forEach(function(button) {
                button.addEventListener('click', function() {
                    app.log('Main', 'Back button clicked');
                    
                    // Tactile feedback
                    provideTactileFeedback('light');
                    
                    // Return to main screen
                    activateWelcomeScreen();
                });
            });
            
            // Bottom navigation
            const homeBtn = document.getElementById('home-btn');
            const historyBtn = document.getElementById('history-btn');
            const profileBtn = document.getElementById('profile-btn');
            
            if (homeBtn) {
                homeBtn.addEventListener('click', function() {
                    app.log('Main', 'Home button clicked');
                    provideTactileFeedback('light');
                    
                    activateWelcomeScreen();
                    updateActiveNavButton(homeBtn);
                });
            }
            
            if (historyBtn) {
                historyBtn.addEventListener('click', function() {
                    app.log('Main', 'History button clicked');
                    provideTactileFeedback('light');
                    
                    // Load game history
                    getGameHistory()
                        .catch(function(error) {
                            app.log('Main', `Error loading history: ${error.message}`, true);
                        });
                    
                    // Show history modal
                    const historyModal = document.getElementById('history-modal');
                    if (historyModal) {
                        showModal(historyModal);
                    }
                    
                    updateActiveNavButton(historyBtn);
                });
            }
            
            if (profileBtn) {
                profileBtn.addEventListener('click', function() {
                    app.log('Main', 'Profile button clicked');
                    provideTactileFeedback('light');
                    
                    // Load transaction history
                    getTransactionHistory()
                        .catch(function(error) {
                            app.log('Main', `Error loading transactions: ${error.message}`, true);
                        });
                    
                    // Show profile modal
                    const profileModal = document.getElementById('profile-modal');
                    if (profileModal) {
                        showModal(profileModal);
                    }
                    
                    updateActiveNavButton(profileBtn);
                });
            }
            
            // Modal close handlers
            const closeButtons = document.querySelectorAll('.close-modal');
            closeButtons.forEach(function(button) {
                button.addEventListener('click', function() {
                    const modal = button.closest('.modal');
                    if (modal) {
                        hideModal(modal);
                        updateActiveNavButton(homeBtn);
                    }
                });
            });
            
            // Close modals when clicking outside content
            const modals = document.querySelectorAll('.modal');
            modals.forEach(function(modal) {
                modal.addEventListener('click', function(event) {
                    if (event.target === modal) {
                        hideModal(modal);
                        updateActiveNavButton(homeBtn);
                    }
                });
            });
            
            app.log('Main', 'Event listeners set up successfully');
            
        } catch (error) {
            app.log('Main', `Error setting up event handlers: ${error.message}`, true);
            // Continue even with handler errors
        }
    };
    
    // Activate welcome screen
    const activateWelcomeScreen = function() {
        try {
            const welcomeScreen = document.getElementById('welcome-screen');
            if (welcomeScreen) {
                // First hide all screens
                document.querySelectorAll('.screen').forEach(function(screen) {
                    screen.classList.remove('active');
                });
                
                // Then show welcome screen
                welcomeScreen.classList.add('active');
                app.log('Main', 'Welcome screen activated');
            } else {
                app.log('Main', 'Welcome-screen element not found!', true);
            }
        } catch (error) {
            app.log('Main', `Error activating welcome-screen: ${error.message}`, true);
        }
    };
    
    // Show emergency UI for critical errors
    const showEmergencyUI = function() {
        app.log('Main', 'Activating emergency UI');
        
        try {
            // Activate welcome screen
            activateWelcomeScreen();
            
            // Show application
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.classList.add('loaded');
            }
            
            // Update balance
            updateBalance();
            
            app.log('Main', 'Emergency UI activated successfully');
            
        } catch (error) {
            app.log('Main', `Error activating emergency UI: ${error.message}`, true);
        }
    };
    
    // Update active navigation button
    const updateActiveNavButton = function(activeButton) {
        if (!activeButton) return;
        
        document.querySelectorAll('.nav-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        
        activeButton.classList.add('active');
    };
    
    // Show modal window
    const showModal = function(modal) {
        if (!modal) return;
        
        // Add tactile feedback
        provideTactileFeedback('light');
        
        modal.style.display = 'flex';
        
        // Appearance animation
        setTimeout(function() {
            const content = modal.querySelector('.modal-content');
            if (content) {
                content.style.opacity = '1';
                content.style.transform = 'scale(1)';
            }
        }, 10);
    };
    
    // Hide modal window
    const hideModal = function(modal) {
        if (!modal) return;
        
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.opacity = '0';
            content.style.transform = 'scale(0.9)';
        }
        
        setTimeout(function() {
            modal.style.display = 'none';
        }, 300);
    };
    
    // Update loading progress
    const updateProgress = function(percent) {
        try {
            if (window.appLoader && typeof window.appLoader.updateProgress === 'function') {
                window.appLoader.updateProgress(percent);
            }
        } catch (error) {
            app.log('Main', `Error updating progress: ${error.message}`, true);
        }
    };
    
    // Notify loader of readiness
    const notifyLoaderReady = function() {
        try {
            app.log('Main', 'Notifying loader of core module readiness');
            
            if (window.appLoader && typeof window.appLoader.mainReady === 'function') {
                window.appLoader.mainReady();
            } else {
                app.log('Main', 'appLoader.mainReady not found, removing loading screen directly', true);
                
                // Emergency removal of loading screen
                const loadingOverlay = document.getElementById('loadingOverlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(function() {
                        loadingOverlay.style.display = 'none';
                        
                        // Show application content
                        const appContent = document.getElementById('app-content');
                        if (appContent) {
                            appContent.classList.add('loaded');
                        }
                    }, 300);
                }
            }
        } catch (error) {
            app.log('Main', `Error notifying loader: ${error.message}`, true);
            
            // Emergency removal of loading screen on error
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.classList.add('loaded');
            }
        }
    };
    
    // Update user balance
    const updateBalance = function() {
        try {
            const balanceAmount = document.getElementById('balance-amount');
            const profileBalance = document.getElementById('profile-balance');
            const userName = document.getElementById('user-name');
            
            if (balanceAmount) {
                balanceAmount.textContent = app.user.balance;
                
                // Add update animation
                balanceAmount.classList.add('balance-updated');
                setTimeout(function() {
                    balanceAmount.classList.remove('balance-updated');
                }, 500);
            }
            
            if (profileBalance) {
                profileBalance.textContent = app.user.balance;
            }
            
            if (userName) {
                userName.textContent = app.user.firstName;
            }
        } catch (error) {
            app.log('Main', `Error updating balance: ${error.message}`, true);
        }
    };
    
    // Show notification
    const showNotification = function(message) {
        app.log('Main', `Notification: ${message}`);
        
        try {
            // If Telegram WebApp API is available, use it
            if (tgApp && tgApp.showPopup) {
                tgApp.showPopup({
                    title: 'Greenlight Casino',
                    message: message,
                    buttons: [{type: 'ok'}]
                });
            } else {
                // Otherwise use standard alert
                alert(message);
            }
        } catch (error) {
            app.log('Main', `Error showing notification: ${error.message}`, true);
            // Use alert in case of error
            alert(message);
        }
    };
    
    // Tactile feedback
    const provideTactileFeedback = function(type) {
        type = type || 'light';
        
        try {
            // Use HapticFeedback API if available
            if (tgApp && tgApp.HapticFeedback) {
                switch (type) {
                    case 'light':
                        tgApp.HapticFeedback.impactOccurred('light');
                        break;
                    case 'medium':
                        tgApp.HapticFeedback.impactOccurred('medium');
                        break;
                    case 'heavy':
                        tgApp.HapticFeedback.impactOccurred('heavy');
                        break;
                    case 'success':
                        tgApp.HapticFeedback.notificationOccurred('success');
                        break;
                    case 'warning':
                        tgApp.HapticFeedback.notificationOccurred('warning');
                        break;
                    case 'error':
                        tgApp.HapticFeedback.notificationOccurred('error');
                        break;
                }
            } else if ('vibrate' in navigator) {
                // Use Vibration API for browsers
                switch (type) {
                    case 'light':
                        navigator.vibrate(5);
                        break;
                    case 'medium':
                        navigator.vibrate(10);
                        break;
                    case 'heavy':
                        navigator.vibrate(15);
                        break;
                    case 'success':
                        navigator.vibrate([10, 50, 10]);
                        break;
                    case 'warning':
                        navigator.vibrate([10, 50, 10, 50, 10]);
                        break;
                    case 'error':
                        navigator.vibrate([50, 100, 50]);
                        break;
                }
            }
        } catch (error) {
            app.log('Main', `Tactile feedback error: ${error.message}`, true);
        }
    };
    
    // ===== API Methods =====
    
    // User registration
    const registerUser = async function() {
        try {
            app.log('Main', `Registering user: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramId: app.user.telegramId,
                    firstName: app.user.firstName,
                    lastName: app.user.lastName,
                    username: app.user.username
                })
            });
            
            if (!response.ok) {
                throw new Error(`Registration error: ${response.status}`);
            }
            
            const data = await response.json();
            app.log('Main', 'User registered successfully');
            
            return data;
        } catch (error) {
            app.log('Main', `User registration error: ${error.message}`, true);
            // Continue in demo mode
            return null;
        }
    };
    
    // Get user profile
    const getUserProfile = async function() {
        try {
            app.log('Main', `Requesting user profile: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/users/profile/${app.user.telegramId}`);
            
            if (!response.ok) {
                throw new Error(`Error getting profile: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update balance
            app.user.balance = data.balance;
            updateBalance();
            
            app.log('Main', 'User profile retrieved successfully');
            
            return data;
        } catch (error) {
            app.log('Main', `Error getting profile: ${error.message}`, true);
            // Continue with current data
            return null;
        }
    };
    
    // Get game history
    const getGameHistory = async function() {
        try {
            app.log('Main', `Requesting game history: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/games/history/${app.user.telegramId}`);
            
            if (!response.ok) {
                throw new Error(`Error getting history: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update history display
            updateHistoryList(data);
            
            app.log('Main', 'Game history retrieved successfully');
            
            return data;
        } catch (error) {
            app.log('Main', `Error getting game history: ${error.message}`, true);
            
            // Show empty history
            updateHistoryList([]);
            
            return [];
        }
    };
    
    // Get transaction history
    const getTransactionHistory = async function() {
        try {
            app.log('Main', `Requesting transaction history: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/users/transactions/${app.user.telegramId}`);
            
            if (!response.ok) {
                throw new Error(`Error getting transactions: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update transaction display
            updateTransactionList(data);
            
            app.log('Main', 'Transaction history retrieved successfully');
            
            return data;
        } catch (error) {
            app.log('Main', `Error getting transaction history: ${error.message}`, true);
            
            // Show empty transaction history
            updateTransactionList([]);
            
            return [];
        }
    };
    
    // Process game result
    const processGameResult = async function(gameType, betAmount, outcome, winAmount, gameData) {
        try {
            app.log('Main', `Processing game result: ${gameType}, outcome: ${outcome}`);
            
            // Preliminary UI update for better UX
            if (outcome === 'win') {
                app.user.balance = app.user.balance + winAmount;
                updateBalance();
            } else if (outcome === 'bet' || outcome === 'lose') {
                app.user.balance = app.user.balance - betAmount;
                updateBalance();
            }
            
            // Send data to server with timeout limit
            const responsePromise = Promise.race([
                fetch(`${API_URL}/games/play`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegramId: app.user.telegramId,
                        gameType,
                        betAmount,
                        outcome,
                        winAmount,
                        gameData
                    })
                }),
                new Promise(function(_, reject) {
                    setTimeout(function() {
                        reject(new Error('API Timeout'));
                    }, 5000);
                })
            ]);
            
            const response = await responsePromise;
            
            if (!response.ok) {
                throw new Error(`Error processing result: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update balance from server response
            app.user.balance = data.user.balance;
            updateBalance();
            
            app.log('Main', 'Game result processed successfully');
            
            return data;
        } catch (error) {
            app.log('Main', `Error processing game result: ${error.message}`, true);
            
            // In case of server error, UI already updated preliminarily
            return null;
        }
    };
    
    // Update game history list
    const updateHistoryList = function(historyData) {
        try {
            const historyList = document.getElementById('history-list');
            if (!historyList) return;
            
            // Clear current list
            historyList.innerHTML = '';
            
            if (!historyData || historyData.length === 0) {
                historyList.innerHTML = '<div class="empty-message">No game history</div>';
                return;
            }
            
            // Add each history item
            historyData.forEach(function(item) {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                // Get game icon
                let gameIcon = '🎮';
                switch (item.gameType) {
                    case 'slots': gameIcon = '🎰'; break;
                    case 'roulette': gameIcon = '🎲'; break;
                    case 'guessnumber': gameIcon = '🔢'; break;
                    case 'miner': gameIcon = '💣'; break;
                    case 'crush': gameIcon = '📈'; break;
                }
                
                // Format date
                let formattedDate = 'Unknown date';
                try {
                    const date = new Date(item.createdAt);
                    formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                } catch (dateError) {
                    app.log('Main', `Date formatting error: ${dateError.message}`, true);
                }
                
                historyItem.innerHTML = `
                    <div class="history-game">
                        <span class="game-icon">${gameIcon}</span>
                        <span>${item.gameType.charAt(0).toUpperCase() + item.gameType.slice(1)}</span>
                    </div>
                    <div class="history-details">
                        <div class="history-bet">Bet: ${item.betAmount} ⭐</div>
                        <div class="history-outcome ${item.winAmount > 0 ? 'win' : 'loss'}">
                            ${item.winAmount > 0 ? `+${item.winAmount} ⭐` : '-' + item.betAmount + ' ⭐'}
                        </div>
                    </div>
                    <div class="history-date">${formattedDate}</div>
                `;
                
                historyList.appendChild(historyItem);
            });
        } catch (error) {
            app.log('Main', `Error updating history list: ${error.message}`, true);
            
            // Show error message
            const historyList = document.getElementById('history-list');
            if (historyList) {
                historyList.innerHTML = '<div class="empty-message">Error loading history</div>';
            }
        }
    };
    
    // Update transaction list
    const updateTransactionList = function(transactionData) {
        try {
            const transactionList = document.getElementById('transaction-list');
            if (!transactionList) return;
            
            // Clear current list
            transactionList.innerHTML = '';
            
            if (!transactionData || transactionData.length === 0) {
                transactionList.innerHTML = '<div class="empty-message">No transactions</div>';
                return;
            }
            
            // Add each transaction
            transactionData.forEach(function(item) {
                const transactionItem = document.createElement('div');
                transactionItem.className = 'transaction-item';
                
                // Get transaction icon
                let transactionIcon = '💼';
                let transactionType = '';
                
                switch (item.type) {
                    case 'deposit':
                        transactionIcon = '⬇️';
                        transactionType = 'Deposit';
                        break;
                    case 'withdrawal':
                        transactionIcon = '⬆️';
                        transactionType = 'Withdrawal';
                        break;
                    case 'bet':
                        transactionIcon = '🎮';
                        transactionType = 'Bet';
                        break;
                    case 'win':
                        transactionIcon = '🏆';
                        transactionType = 'Win';
                        break;
                    case 'admin_adjustment':
                        transactionIcon = '⚙️';
                        transactionType = 'Adjustment';
                        break;
                }
                
                // Format date
                let formattedDate = 'Unknown date';
                try {
                    const date = new Date(item.createdAt);
                    formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                } catch (dateError) {
                    app.log('Main', `Date formatting error: ${dateError.message}`, true);
                }
                
                transactionItem.innerHTML = `
                    <div class="transaction-type">
                        <span class="transaction-icon">${transactionIcon}</span>
                        <span>${transactionType}</span>
                    </div>
                    <div class="transaction-amount ${item.amount >= 0 ? 'positive' : 'negative'}">
                        ${item.amount >= 0 ? '+' : ''}${item.amount} ⭐
                    </div>
                    <div class="transaction-date">${formattedDate}</div>
                `;
                
                transactionList.appendChild(transactionItem);
            });
        } catch (error) {
            app.log('Main', `Error updating transaction list: ${error.message}`, true);
            
            // Show error message
            const transactionList = document.getElementById('transaction-list');
            if (transactionList) {
                transactionList.innerHTML = '<div class="empty-message">Error loading transactions</div>';
            }
        }
    };
    
    // Export public methods and properties
    return {
        init: init,
        processGameResult: processGameResult,
        showNotification: showNotification,
        provideTactileFeedback: provideTactileFeedback,
        updateBalance: updateBalance,
        
        // Method to check application state
        getStatus: function() {
            return {
                initialized: initialized,
                uiInitialized: uiInitialized,
                telegramInitialized: telegramInitialized,
                gamesLoaded: app.loading.gamesInitialized
            };
        }
    };
})();

// Register casinoApp in global namespace
window.casinoApp = casinoApp;

// Start application initialization automatically
// (with safe error handling)
setTimeout(function() {
    try {
        app.log('Main', 'Automatic initialization start');
        
        casinoApp.init().catch(function(error) {
            app.log('Main', `Initialization error: ${error.message}`, true);
            
            // In case of error, forcibly remove loading screen
            if (window.appLoader && typeof window.appLoader.forceRemoveLoading === 'function') {
                window.appLoader.forceRemoveLoading();
            }
        });
    } catch (error) {
        app.log('Main', `Unhandled initialization error: ${error.message}`, true);
        
        // Last resort - remove loading screen directly
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.classList.add('loaded');
        }
    }
}, 100); // Small delay to complete DOM loading