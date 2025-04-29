// public/js/main.js

// Initialize Telegram WebApp
const tgApp = window.Telegram.WebApp;
tgApp.expand();

// API base URL
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : 'https://your-production-domain.com/api';

// Current user data
let currentUser = {
  telegramId: null,
  firstName: null,
  lastName: null,
  username: null,
  balance: 0
};

// Elements
const screens = document.querySelectorAll('.screen');
const backButtons = document.querySelectorAll('.back-btn');
const gameCards = document.querySelectorAll('.game-card');
const balanceDisplay = document.getElementById('balance-amount');
const homeBtn = document.getElementById('home-btn');
const historyBtn = document.getElementById('history-btn');
const profileBtn = document.getElementById('profile-btn');
const historyModal = document.getElementById('history-modal');
const profileModal = document.getElementById('profile-modal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const userName = document.getElementById('user-name');
const profileBalance = document.getElementById('profile-balance');
const historyList = document.getElementById('history-list');
const transactionList = document.getElementById('transaction-list');

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  // Initialize user from Telegram WebApp
  if (tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
    const user = tgApp.initDataUnsafe.user;
    
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
  
  // Add event listeners
  addEventListeners();
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
  // Update user name display
  userName.textContent = currentUser.firstName;
  
  // Update balance displays
  updateBalance();
}

function updateBalance() {
  balanceDisplay.textContent = currentUser.balance;
  profileBalance.textContent = currentUser.balance;
}

function updateHistoryList(historyData) {
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
  // Hide all screens
  screens.forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Show the selected screen
  document.getElementById(screenId).classList.add('active');
}

function showModal(modal) {
  modal.style.display = 'flex';
  
  // Add fade-in animation
  setTimeout(() => {
    modal.querySelector('.modal-content').style.opacity = '1';
    modal.querySelector('.modal-content').style.transform = 'scale(1)';
  }, 10);
}

function hideModal(modal) {
  // Add fade-out animation
  modal.querySelector('.modal-content').style.opacity = '0';
  modal.querySelector('.modal-content').style.transform = 'scale(0.9)';
  
  // Hide modal after animation
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// ===== Event Listeners =====
function addEventListeners() {
  // Game card click event
  gameCards.forEach(card => {
    card.addEventListener('click', () => {
      const game = card.getAttribute('data-game');
      showScreen(`${game}-screen`);
      
      // Update active nav button
      updateActiveNavButton(homeBtn);
    });
  });
  
  // Back button click events
  backButtons.forEach(button => {
    button.addEventListener('click', () => {
      showScreen('welcome-screen');
    });
  });
  
  // Bottom navigation click events
  homeBtn.addEventListener('click', () => {
    showScreen('welcome-screen');
    updateActiveNavButton(homeBtn);
  });
  
  historyBtn.addEventListener('click', () => {
    getGameHistory();
    showModal(historyModal);
    updateActiveNavButton(historyBtn);
  });
  
  profileBtn.addEventListener('click', () => {
    getTransactionHistory();
    showModal(profileModal);
    updateActiveNavButton(profileBtn);
  });
  
  // Close modal buttons
  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      hideModal(modal);
      updateActiveNavButton(homeBtn);
    });
  });
  
  // Close modal when clicking outside content
  window.addEventListener('click', (event) => {
    if (event.target === historyModal) {
      hideModal(historyModal);
      updateActiveNavButton(homeBtn);
    }
    if (event.target === profileModal) {
      hideModal(profileModal);
      updateActiveNavButton(homeBtn);
    }
  });
}

function updateActiveNavButton(activeButton) {
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
  currentUser
};