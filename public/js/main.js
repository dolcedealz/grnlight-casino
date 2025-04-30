// public/js/main.js

// Initialize Telegram WebApp safely
const tgApp = window.Telegram?.WebApp;
if (tgApp) {
  try {
    tgApp.expand();
    console.log('Telegram WebApp expanded successfully');
  } catch (error) {
    console.error('Error expanding Telegram WebApp:', error);
  }
}

// API base URL - динамически определяем на основе текущего хоста
const API_URL = `${window.location.origin}/api`;

// Отладочная информация
console.log('WebApp Info:', {
  API_URL,
  location: window.location.href,
  origin: window.location.origin,
  telegramAvailable: !!tgApp
});

// Current user data with default values
let currentUser = {
  telegramId: null,
  firstName: 'Guest',
  lastName: '',
  username: '',
  balance: 0
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  try {
    console.log('App initialization started');
    
    // Initialize UI first so user sees something immediately
    setupGameCardHandlers();
    addEventListeners();
    applyMobileStyles();
    
    // Ensure the welcome screen is visible right away
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });
      welcomeScreen.classList.add('active');
    }
    
    // Remove any loading overlay that might exist
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        if (loadingOverlay.parentNode) {
          loadingOverlay.parentNode.removeChild(loadingOverlay);
        }
      }, 500);
    }

    // Initialize user from Telegram WebApp with error handling
    if (tgApp && tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
      try {
        const user = tgApp.initDataUnsafe.user;
        console.log('User data from Telegram:', user);
        
        // Set current user data
        currentUser.telegramId = user.id;
        currentUser.firstName = user.first_name || 'Player';
        currentUser.lastName = user.last_name || '';
        currentUser.username = user.username || '';
        
        // Register/update user in our system
        await safeApiCall(() => registerUser());
        
        // Update user interface
        updateUserInterface();
        
        // Load user balance and info
        await safeApiCall(() => getUserProfile());
      } catch (telegramError) {
        console.error('Error initializing from Telegram:', telegramError);
        // Continue with default user in case of error
      }
    } else {
      // For testing locally without Telegram
      console.log('Running in development mode without Telegram WebApp');
      
      // Use test user for development
      currentUser.telegramId = 123456789;
      currentUser.firstName = 'Test';
      currentUser.lastName = 'User';
      currentUser.username = 'testuser';
      currentUser.balance = 500;
      
      updateUserInterface();
    }
    
    console.log('App initialization completed');
  } catch (error) {
    console.error('Error during app initialization:', error);
    showNotification('Error initializing app. Please try again later.');
    
    // Ensure we still have a visible UI even if there was an error
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.classList.add('active');
    }
  }
}

// Improved API handling with timeouts and fallbacks
async function safeApiCall(apiFunction, fallbackValue = null) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('API request timeout')), 10000);
  });
  
  try {
    return await Promise.race([apiFunction(), timeoutPromise]);
  } catch (error) {
    console.error('API error:', error);
    return fallbackValue;
  }
}

// Функция для применения стилей для мобильных устройств
function applyMobileStyles() {
  try {
    // Проверяем, является ли устройство мобильным
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Увеличиваем размер кнопок и отступы для более удобного нажатия
      const actionButtons = document.querySelectorAll('.action-btn');
      const navButtons = document.querySelectorAll('.nav-btn');
      
      actionButtons.forEach(button => {
        button.style.padding = '1rem 2rem';
        button.style.fontSize = '1.1rem';
      });
      
      navButtons.forEach(button => {
        button.style.padding = '0.8rem 1.5rem';
      });
      
      // Настраиваем размер игровых карточек
      const gameCards = document.querySelectorAll('.game-card');
      gameCards.forEach(card => {
        card.style.minHeight = '140px';
      });
    }
  } catch (error) {
    console.error('Error applying mobile styles:', error);
    // Non-critical error, continue execution
  }
}

// Функция тактильной обратной связи
function provideTactileFeedback(type = 'light') {
  try {
    // Проверяем доступность API вибрации в Telegram WebApp
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
      // Если API Telegram недоступно, используем стандартный Web Vibration API
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
    console.error('Error providing tactile feedback:', error);
    // Non-critical error, continue execution
  }
}

// Setup direct handlers for game cards - improved version
function setupGameCardHandlers() {
  try {
    const gameCards = document.querySelectorAll('.game-card');
    console.log('Setting up handlers for', gameCards.length, 'game cards');
    
    gameCards.forEach(card => {
      try {
        const game = card.getAttribute('data-game');
        if (!game) return;
        
        console.log('Setting up handler for game:', game);
        
        // Make card visibly clickable
        card.style.cursor = 'pointer';
        
        // Add onclick handler directly
        card.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Game card clicked:', game);
          
          // Добавляем тактильную обратную связь
          provideTactileFeedback('medium');
          
          // Добавляем визуальный эффект нажатия
          this.classList.add('card-pressed');
          setTimeout(() => {
            this.classList.remove('card-pressed');
          }, 150);
          
          showGameScreen(game);
        };
      } catch (cardError) {
        console.error('Error setting up game card handler:', cardError);
      }
    });
  } catch (error) {
    console.error('Error setting up game cards:', error);
  }
}

// Function to show game screen
function showGameScreen(gameName) {
  try {
    const screenId = `${gameName}-screen`;
    console.log('Attempting to show game screen:', screenId);
    
    // Get the screen element
    const screenElement = document.getElementById(screenId);
    
    if (!screenElement) {
      console.error('Game screen not found:', screenId);
      return;
    }
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Show selected screen
    screenElement.classList.add('active');
    console.log('Added active class to:', screenId);
    
    // Update nav button
    updateActiveNavButton(document.getElementById('home-btn'));
  } catch (error) {
    console.error('Error showing game screen:', error);
    
    // Fallback to welcome screen in case of error
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });
      welcomeScreen.classList.add('active');
    }
  }
}

// ===== API Functions =====
async function registerUser() {
  try {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to register user');
    }
    
    const data = await response.json();
    console.log('User registered/updated:', data);
  } catch (error) {
    console.error('Error registering user:', error);
    showNotification('Error connecting to server. Please try again later.');
  }
}

async function getUserProfile() {
  try {
    const response = await fetch(`${API_URL}/users/profile/${currentUser.telegramId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }
    
    const data = await response.json();
    
    // Update current user data
    currentUser.balance = data.balance;
    
    // Update balance display
    updateBalance();
    
    console.log('User profile loaded:', data);
  } catch (error) {
    console.error('Error getting user profile:', error);
    showNotification('Error loading profile. Please try again later.');
  }
}

async function getGameHistory() {
  try {
    const response = await fetch(`${API_URL}/games/history/${currentUser.telegramId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get game history');
    }
    
    const data = await response.json();
    
    // Update history list
    updateHistoryList(data);
    
    console.log('Game history loaded:', data);
  } catch (error) {
    console.error('Error getting game history:', error);
    showNotification('Error loading game history. Please try again later.');
    
    // Show empty history in case of error
    updateHistoryList([]);
  }
}

async function getTransactionHistory() {
  try {
    const response = await fetch(`${API_URL}/users/transactions/${currentUser.telegramId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get transaction history');
    }
    
    const data = await response.json();
    
    // Update transaction list
    updateTransactionList(data);
    
    console.log('Transaction history loaded:', data);
  } catch (error) {
    console.error('Error getting transaction history:', error);
    showNotification('Error loading transactions. Please try again later.');
    
    // Show empty transactions in case of error
    updateTransactionList([]);
  }
}

// Function to process game results
async function processGameResult(gameType, betAmount, outcome, winAmount, gameData) {
  try {
    // Validate bet amount
    betAmount = parseInt(betAmount);
    if (isNaN(betAmount) || betAmount <= 0) {
      showNotification('Please enter a valid bet amount');
      return null;
    }
    
    // Check if user has enough balance
    if (betAmount > currentUser.balance) {
      showNotification('Insufficient balance');
      return null;
    }
    
    // Предоставляем тактильную обратную связь в зависимости от результата
    if (outcome === 'win') {
      provideTactileFeedback('success');
    } else if (outcome === 'lose') {
      provideTactileFeedback('warning');
    } else {
      provideTactileFeedback('light');
    }
    
    const response = await fetch(`${API_URL}/games/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegramId: currentUser.telegramId,
        gameType,
        betAmount,
        outcome,
        winAmount,
        gameData
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to process game result');
    }
    
    const data = await response.json();
    
    // Update current user balance
    currentUser.balance = data.user.balance;
    updateBalance();
    
    console.log('Game result processed:', data);
    return data;
  } catch (error) {
    console.error('Error processing game result:', error);
    showNotification('Error connecting to server. Please try again later.');
    
    // Update UI with expected result in case of server error
    if (outcome === 'win' && winAmount > 0) {
      // Optimistically update the balance
      currentUser.balance += winAmount - betAmount;
      updateBalance();
    } else if (outcome === 'bet' || outcome === 'lose') {
      // Optimistically update the balance
      currentUser.balance -= betAmount;
      updateBalance();
    }
    
    return null;
  }
}

// ===== UI Functions =====
function updateUserInterface() {
  try {
    // Get up-to-date elements
    const userName = document.getElementById('user-name');
    
    // Update user name display
    if (userName) {
      userName.textContent = currentUser.firstName;
    }
    
    // Update balance displays
    updateBalance();
  } catch (error) {
    console.error('Error updating user interface:', error);
  }
}

function updateBalance() {
  try {
    const balanceDisplay = document.getElementById('balance-amount');
    const profileBalance = document.getElementById('profile-balance');
    
    if (balanceDisplay) {
      balanceDisplay.textContent = currentUser.balance;
      
      // Добавляем анимацию обновления баланса
      balanceDisplay.classList.add('balance-updated');
      setTimeout(() => {
        balanceDisplay.classList.remove('balance-updated');
      }, 500);
    }
    
    if (profileBalance) {
      profileBalance.textContent = currentUser.balance;
    }
  } catch (error) {
    console.error('Error updating balance:', error);
  }
}

function updateHistoryList(historyData) {
  try {
    // Get fresh reference to element
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    // Clear the current list
    historyList.innerHTML = '';
    
    if (!historyData || historyData.length === 0) {
      historyList.innerHTML = '<div class="empty-message">No game history yet</div>';
      return;
    }
    
    // Add each history item
    historyData.forEach(item => {
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
        console.error('Error formatting date:', dateError);
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
    console.error('Error updating history list:', error);
    
    // Show fallback message
    const historyList = document.getElementById('history-list');
    if (historyList) {
      historyList.innerHTML = '<div class="empty-message">Error loading history</div>';
    }
  }
}

function updateTransactionList(transactionData) {
  try {
    // Get fresh reference to element
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) return;
    
    // Clear the current list
    transactionList.innerHTML = '';
    
    if (!transactionData || transactionData.length === 0) {
      transactionList.innerHTML = '<div class="empty-message">No transactions yet</div>';
      return;
    }
    
    // Add each transaction item
    transactionData.forEach(item => {
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
          transactionType = 'Admin Adjustment';
          break;
      }
      
      // Format date
      let formattedDate = 'Unknown date';
      try {
        const date = new Date(item.createdAt);
        formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      } catch (dateError) {
        console.error('Error formatting date:', dateError);
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
    console.error('Error updating transaction list:', error);
    
    // Show fallback message
    const transactionList = document.getElementById('transaction-list');
    if (transactionList) {
      transactionList.innerHTML = '<div class="empty-message">Error loading transactions</div>';
    }
  }
}

function showNotification(message) {
  try {
    // Show a notification to the user
    if (tgApp && tgApp.showPopup) {
      tgApp.showPopup({
        title: 'Greenlight Casino',
        message: message,
        buttons: [{type: 'ok'}]
      });
    } else {
      alert(message);
    }
  } catch (error) {
    console.error('Error showing notification:', error);
    // Fallback to console log
    console.log('Notification:', message);
  }
}

// ===== Navigation Functions =====
function showScreen(screenId) {
  try {
    console.log('Showing screen:', screenId);
    
    // Get fresh references to screens
    const screens = document.querySelectorAll('.screen');
    
    // Hide all screens
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Show the selected screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
    } else {
      console.error('Screen not found:', screenId);
      // Show welcome screen as fallback
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        welcomeScreen.classList.add('active');
      }
    }
  } catch (error) {
    console.error('Error showing screen:', error);
    
    // Fallback to welcome screen
    try {
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        welcomeScreen.classList.add('active');
      }
    } catch (fallbackError) {
      console.error('Error showing fallback screen:', fallbackError);
    }
  }
}

function showModal(modal) {
  try {
    if (!modal) {
      console.error('Modal not found');
      return;
    }
    
    // Тактильная обратная связь при открытии модального окна
    provideTactileFeedback('light');
    
    modal.style.display = 'flex';
    
    // Add fade-in animation
    setTimeout(() => {
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }
    }, 10);
  } catch (error) {
    console.error('Error showing modal:', error);
  }
}

function hideModal(modal) {
  try {
    if (!modal) {
      console.error('Modal not found');
      return;
    }
    
    // Add fade-out animation
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.opacity = '0';
      content.style.transform = 'scale(0.9)';
    }
    
    // Hide modal after animation
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  } catch (error) {
    console.error('Error hiding modal:', error);
    // Force hide modal
    if (modal) {
      modal.style.display = 'none';
    }
  }
}

// ===== Event Listeners =====
function addEventListeners() {
  try {
    console.log('Adding event listeners');
    
    // Elements
    const backButtons = document.querySelectorAll('.back-btn');
    const homeBtn = document.getElementById('home-btn');
    const historyBtn = document.getElementById('history-btn');
    const profileBtn = document.getElementById('profile-btn');
    const historyModal = document.getElementById('history-modal');
    const profileModal = document.getElementById('profile-modal');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    const actionButtons = document.querySelectorAll('.action-btn');
    
    // Добавляем тактильную обратную связь для всех кнопок действий
    actionButtons.forEach(button => {
      button.addEventListener('click', () => {
        provideTactileFeedback('medium');
      });
    });
    
    // Back button click events
    backButtons.forEach(button => {
      button.addEventListener('click', () => {
        console.log('Back button clicked');
        provideTactileFeedback('light');
        
        // Добавляем визуальный эффект нажатия
        button.classList.add('btn-pressed');
        setTimeout(() => {
          button.classList.remove('btn-pressed');
        }, 150);
        
        showScreen('welcome-screen');
      });
    });
    
    // Bottom navigation click events
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        console.log('Home button clicked');
        provideTactileFeedback('light');
        showScreen('welcome-screen');
        updateActiveNavButton(homeBtn);
      });
    }
    
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        console.log('History button clicked');
        provideTactileFeedback('light');
        getGameHistory();
        showModal(historyModal);
        updateActiveNavButton(historyBtn);
      });
    }
    
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        console.log('Profile button clicked');
        provideTactileFeedback('light');
        getTransactionHistory();
        showModal(profileModal);
        updateActiveNavButton(profileBtn);
      });
    }
    
    // Close modal buttons
    closeModalButtons.forEach(button => {
      button.addEventListener('click', () => {
        console.log('Close modal button clicked');
        provideTactileFeedback('light');
        const modal = button.closest('.modal');
        hideModal(modal);
        updateActiveNavButton(homeBtn);
      });
    });
    
    // Close modal when clicking outside content
    if (historyModal) {
      historyModal.addEventListener('click', (event) => {
        if (event.target === historyModal) {
          hideModal(historyModal);
          updateActiveNavButton(homeBtn);
        }
      });
    }
    
    if (profileModal) {
      profileModal.addEventListener('click', (event) => {
        if (event.target === profileModal) {
          hideModal(profileModal);
          updateActiveNavButton(homeBtn);
        }
      });
    }
    
    console.log('Event listeners added successfully');
  } catch (error) {
    console.error('Error adding event listeners:', error);
  }
}

function updateActiveNavButton(activeButton) {
  try {
    if (!activeButton) return;
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    activeButton.classList.add('active');
  } catch (error) {
    console.error('Error updating active nav button:', error);
  }
}

// Make functions available globally for game scripts
window.casinoApp = {
  processGameResult,
  showNotification,
  currentUser,
  showScreen,
  provideTactileFeedback // Экспортируем функцию тактильной обратной связи
};