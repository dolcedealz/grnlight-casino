// public/js/main.js

// Initialize Telegram WebApp
const tgApp = window.Telegram.WebApp;
tgApp.expand();

// API base URL - динамически определяем на основе текущего хоста
const API_URL = `${window.location.origin}/api`;

// Отладочная информация
console.log('WebApp Info:', {
  API_URL,
  location: window.location.href,
  origin: window.location.origin
});

// Current user data
let currentUser = {
  telegramId: null,
  firstName: null,
  lastName: null,
  username: null,
  balance: 0
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  try {
    console.log('App initialization started');

    // Initialize user from Telegram WebApp
    if (tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
      const user = tgApp.initDataUnsafe.user;
      console.log('User data from Telegram:', user);
      
      // Set current user data
      currentUser.telegramId = user.id;
      currentUser.firstName = user.first_name;
      currentUser.lastName = user.last_name || '';
      currentUser.username = user.username || '';
      
      // Register/update user in our system
      await registerUser();
      
      // Update user interface
      updateUserInterface();
      
      // Load user balance and info
      await getUserProfile();
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
    
    // Re-select DOM elements to ensure they're available
    const screens = document.querySelectorAll('.screen');
    const gameCards = document.querySelectorAll('.game-card');
    const backButtons = document.querySelectorAll('.back-btn');
    
    console.log('DOM elements found:', {
      screens: screens.length,
      gameCards: gameCards.length,
      backButtons: backButtons.length
    });
    
    // Setup direct click handlers for game cards
    setupGameCardHandlers();
    
    // Add event listeners for other elements
    addEventListeners();
    
    console.log('App initialization completed');
  } catch (error) {
    console.error('Error during app initialization:', error);
    showNotification('Error initializing app. Please try again later.');
  }
}

// Setup direct handlers for game cards
function setupGameCardHandlers() {
  const gameCards = document.querySelectorAll('.game-card');
  console.log('Setting up handlers for', gameCards.length, 'game cards');
  
  gameCards.forEach(card => {
    const game = card.getAttribute('data-game');
    console.log('Setting up handler for game:', game);
    
    // Make card visibly clickable
    card.style.cursor = 'pointer';
    
    // Remove any existing handlers
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
    
    // Add onclick handler directly
    newCard.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Game card clicked:', game);
      showGameScreen(game);
    };
  });
}

// Function to show game screen
function showGameScreen(gameName) {
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
    console.log('Removed active class from:', screen.id);
  });
  
  // Show selected screen
  screenElement.classList.add('active');
  console.log('Added active class to:', screenId);
  
  // Update nav button
  updateActiveNavButton(document.getElementById('home-btn'));
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
    return null;
  }
}

// ===== UI Functions =====
function updateUserInterface() {
  // Get up-to-date elements
  const userName = document.getElementById('user-name');
  
  // Update user name display
  if (userName) {
    userName.textContent = currentUser.firstName;
  }
  
  // Update balance displays
  updateBalance();
}

function updateBalance() {
  const balanceDisplay = document.getElementById('balance-amount');
  const profileBalance = document.getElementById('profile-balance');
  
  if (balanceDisplay) {
    balanceDisplay.textContent = currentUser.balance;
  }
  
  if (profileBalance) {
    profileBalance.textContent = currentUser.balance;
  }
}

function updateHistoryList(historyData) {
  // Get fresh reference to element
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  
  // Clear the current list
  historyList.innerHTML = '';
  
  if (historyData.length === 0) {
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
    const date = new Date(item.createdAt);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    
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
}

function updateTransactionList(transactionData) {
  // Get fresh reference to element
  const transactionList = document.getElementById('transaction-list');
  if (!transactionList) return;
  
  // Clear the current list
  transactionList.innerHTML = '';
  
  if (transactionData.length === 0) {
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
    const date = new Date(item.createdAt);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    
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
}

function showNotification(message) {
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
}

// ===== Navigation Functions =====
function showScreen(screenId) {
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
  }
}

function showModal(modal) {
  if (!modal) {
    console.error('Modal not found');
    return;
  }
  
  modal.style.display = 'flex';
  
  // Add fade-in animation
  setTimeout(() => {
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.opacity = '1';
      content.style.transform = 'scale(1)';
    }
  }, 10);
}

function hideModal(modal) {
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
}

// ===== Event Listeners =====
function addEventListeners() {
  console.log('Adding event listeners');
  
  // Elements
  const backButtons = document.querySelectorAll('.back-btn');
  const homeBtn = document.getElementById('home-btn');
  const historyBtn = document.getElementById('history-btn');
  const profileBtn = document.getElementById('profile-btn');
  const historyModal = document.getElementById('history-modal');
  const profileModal = document.getElementById('profile-modal');
  const closeModalButtons = document.querySelectorAll('.close-modal');
  
  // Back button click events
  backButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log('Back button clicked');
      showScreen('welcome-screen');
    });
  });
  
  // Bottom navigation click events
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      console.log('Home button clicked');
      showScreen('welcome-screen');
      updateActiveNavButton(homeBtn);
    });
  }
  
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      console.log('History button clicked');
      getGameHistory();
      showModal(historyModal);
      updateActiveNavButton(historyBtn);
    });
  }
  
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      console.log('Profile button clicked');
      getTransactionHistory();
      showModal(profileModal);
      updateActiveNavButton(profileBtn);
    });
  }
  
  // Close modal buttons
  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log('Close modal button clicked');
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
}

function updateActiveNavButton(activeButton) {
  if (!activeButton) return;
  
  // Remove active class from all nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked button
  activeButton.classList.add('active');
}

// Make functions available globally for game scripts
window.casinoApp = {
  processGameResult,
  showNotification,
  currentUser,
  showScreen
};
