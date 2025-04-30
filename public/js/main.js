// main.js - Основной файл приложения Greenlight Casino
console.log('[Main] Запуск основного модуля приложения (v1.0.2)');

// Основная структура приложения
const casinoApp = (() => {
  // Состояние пользователя
  let currentUser = {
    telegramId: null,
    firstName: 'Guest',
    lastName: '',
    username: '',
    balance: 1000 // Дефолтный баланс для демо-режима
  };

  // API URL
  const API_URL = window.location.origin + '/api';
  
  // Telegram WebApp инстанс
  const tgApp = window.Telegram?.WebApp;
  
  // Флаг загрузки приложения
  let appInitialized = false;
  
  // Отслеживание инициализации игр
  const gamesInitialized = {
    slots: false,
    roulette: false,
    guessnumber: false, 
    miner: false,
    crush: false
  };
  
  // Инициализация приложения
  const init = async () => {
    console.log('[Main] Начало инициализации приложения');
    
    try {
      // Обновляем прогресс загрузки
      updateLoaderProgress(15);
      
      // Инициализация UI
      setupEventListeners();
      
      // Обновляем прогресс загрузки
      updateLoaderProgress(30);
      
      // Инициализация Telegram WebApp
      if (tgApp) {
        try {
          // Расширяем окно приложения
          tgApp.expand();
          console.log('[Main] Telegram WebApp расширен');
          
          // Получение данных пользователя из Telegram
          if (tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
            const user = tgApp.initDataUnsafe.user;
            currentUser.telegramId = user.id;
            currentUser.firstName = user.first_name || 'Player';
            currentUser.lastName = user.last_name || '';
            currentUser.username = user.username || '';
            
            console.log('[Main] Данные пользователя получены:', {
              id: currentUser.telegramId,
              name: currentUser.firstName
            });
            
            // Регистрация пользователя на сервере
            await registerUser();
            
            // Получение профиля пользователя
            await getUserProfile();
          }
        } catch (telegramError) {
          console.error('[Main] Ошибка Telegram WebApp:', telegramError);
        }
      } else {
        console.log('[Main] Telegram WebApp недоступен, использую демо-режим');
      }
      
      // Обновляем прогресс загрузки
      updateLoaderProgress(50);
      
      // Обновление интерфейса
      updateBalance();
      
      // Показываем главный экран
      activateWelcomeScreen();
      
      // Обновляем прогресс загрузки
      updateLoaderProgress(70);
      
      // Отмечаем успешную инициализацию
      appInitialized = true;
      console.log('[Main] Приложение инициализировано');
      
      // Инициализируем игры
      await initializeGames();
      
      // Обновляем прогресс загрузки до 100%
      updateLoaderProgress(100);
      
      // Выполняем финальные проверки для диагностики
      diagnoseGames();
      
      // Сообщаем загрузчику, что инициализация завершена
      notifyLoaderReady();
      
      return true;
    } catch (error) {
      console.error('[Main] Критическая ошибка инициализации:', error);
      showNotification('Ошибка при загрузке приложения');
      
      // Пытаемся показать приветственный экран в случае ошибки
      activateWelcomeScreen();
      
      // Обновляем прогресс загрузки и уведомляем загрузчик о завершении
      updateLoaderProgress(100); // Показываем 100% прогресса даже при ошибке
      notifyLoaderReady(); // Уведомляем загрузчик о необходимости показать интерфейс
      
      return false;
    }
  };
  
  // Обновление прогресса загрузки в loader.js
  const updateLoaderProgress = (percent) => {
    try {
      if (window.appLoader && typeof window.appLoader.updateProgress === 'function') {
        window.appLoader.updateProgress(percent);
      }
    } catch (error) {
      console.error('[Main] Ошибка обновления прогресса:', error);
    }
  };
  
  // Уведомляем загрузчик о готовности
  const notifyLoaderReady = () => {
    try {
      if (window.appLoader && typeof window.appLoader.mainReady === 'function') {
        window.appLoader.mainReady();
        console.log('[Main] Уведомлен загрузчик о завершении инициализации');
      } else {
        console.warn('[Main] Функция appLoader.mainReady не найдена');
        
        // Резервное удаление экрана загрузки напрямую
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
          loadingOverlay.style.opacity = '0';
          setTimeout(() => {
            loadingOverlay.style.display = 'none';
            
            // Показываем контент приложения 
            const appContent = document.getElementById('app-content');
            if (appContent) {
              appContent.classList.add('loaded');
            }
          }, 500);
        }
      }
    } catch (loaderError) {
      console.error('[Main] Ошибка при взаимодействии с загрузчиком:', loaderError);
      
      // Резервное удаление экрана загрузки при ошибке
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
          
          // Показываем контент приложения
          const appContent = document.getElementById('app-content');
          if (appContent) {
            appContent.classList.add('loaded');
          }
        }, 500);
      }
    }
  };
  
  // Активация приветственного экрана
  const activateWelcomeScreen = () => {
    try {
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        // Сначала скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        
        // Затем показываем приветственный экран
        welcomeScreen.classList.add('active');
        console.log('[Main] Приветственный экран активирован');
      } else {
        console.error('[Main] Элемент welcome-screen не найден!');
      }
    } catch (error) {
      console.error('[Main] Ошибка при активации welcome-screen:', error);
    }
  };
  
  // Инициализация игр - УЛУЧШЕННАЯ ВЕРСИЯ
  const initializeGames = async () => {
    console.log('[Main] Инициализация игр');
    
    // Обновляем прогресс загрузки
    updateLoaderProgress(75);
    
    // Функция для безопасной инициализации игры
    const safeInitGame = async (gameName, objectName) => {
      try {
        // Проверяем, существует ли объект в GreenLightGames (новый способ)
        if (window.GreenLightGames && window.GreenLightGames[objectName]) {
          const gameObject = window.GreenLightGames[objectName];
          if (typeof gameObject.init === 'function') {
            await gameObject.init();
            console.log(`[Main] Игра ${gameName} инициализирована через GreenLightGames`);
            gamesInitialized[gameName.toLowerCase()] = true;
            return true;
          }
        }
        
        // Проверяем, существует ли объект в глобальном пространстве (старый способ)
        if (window[objectName] && typeof window[objectName].init === 'function') {
          await window[objectName].init();
          console.log(`[Main] Игра ${gameName} инициализирована через глобальный объект`);
          gamesInitialized[gameName.toLowerCase()] = true;
          return true;
        }
        
        console.warn(`[Main] Игра ${gameName} не доступна для инициализации`);
        return false;
      } catch (error) {
        console.error(`[Main] Ошибка инициализации ${gameName}:`, error);
        return false;
      }
    };
    
    // Инициализируем каждую игру безопасно (даже если одна игра вызовет ошибку, остальные будут работать)
    try {
      // Используем Promise.allSettled для параллельной инициализации с обработкой ошибок
      await Promise.allSettled([
        safeInitGame('Slots', 'slotsGame'),
        safeInitGame('Roulette', 'rouletteGame'),
        safeInitGame('GuessNumber', 'guessNumberGame'),
        safeInitGame('Miner', 'minerGame'),
        safeInitGame('Crush', 'crushGame')
      ]);
      
      // Обновляем прогресс загрузки
      updateLoaderProgress(90);
      
      // Проверяем, инициализирована ли хотя бы одна игра
      const anyGameInitialized = Object.values(gamesInitialized).some(status => status === true);
      
      if (!anyGameInitialized) {
        console.warn('[Main] Ни одна из игр не была успешно инициализирована!');
        console.warn('[Main] Это может быть связано с проблемами в загрузке скриптов или доступностью DOM-элементов');
      } else {
        console.log('[Main] Игры успешно инициализированы');
      }
    } catch (error) {
      console.error('[Main] Общая ошибка при инициализации игр:', error);
    }
  };
  
  // Настройка обработчиков событий
  const setupEventListeners = () => {
    console.log('[Main] Настройка обработчиков событий');
    
    // Обработчики для карточек игр
    const gameCards = document.querySelectorAll('.game-card');
    gameCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const game = card.getAttribute('data-game');
        if (!game) return;
        
        console.log('[Main] Выбрана игра:', game);
        
        // Добавляем тактильную обратную связь
        provideTactileFeedback('light');
        
        // Анимация нажатия
        card.classList.add('card-pressed');
        setTimeout(() => {
          card.classList.remove('card-pressed');
        }, 150);
        
        // Переключаем экраны
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(`${game}-screen`);
        if (targetScreen) {
          targetScreen.classList.add('active');
        }
      });
    });
    
    // Обработчики для кнопок "Назад"
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(button => {
      button.addEventListener('click', () => {
        console.log('[Main] Нажата кнопка "Назад"');
        
        // Добавляем тактильную обратную связь
        provideTactileFeedback('light');
        
        // Анимация нажатия
        button.classList.add('btn-pressed');
        setTimeout(() => {
          button.classList.remove('btn-pressed');
        }, 150);
        
        // Возвращаемся на главный экран
        activateWelcomeScreen();
      });
    });
    
    // Нижняя навигация
    const homeBtn = document.getElementById('home-btn');
    const historyBtn = document.getElementById('history-btn');
    const profileBtn = document.getElementById('profile-btn');
    
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        console.log('[Main] Нажата кнопка "Home"');
        provideTactileFeedback('light');
        
        activateWelcomeScreen();
        updateActiveNavButton(homeBtn);
      });
    }
    
    if (historyBtn) {
      historyBtn.addEventListener('click', async () => {
        console.log('[Main] Нажата кнопка "History"');
        provideTactileFeedback('light');
        
        // Загружаем историю игр
        await getGameHistory();
        
        // Показываем модальное окно истории
        const historyModal = document.getElementById('history-modal');
        if (historyModal) {
          showModal(historyModal);
        }
        
        updateActiveNavButton(historyBtn);
      });
    }
    
    if (profileBtn) {
      profileBtn.addEventListener('click', async () => {
        console.log('[Main] Нажата кнопка "Profile"');
        provideTactileFeedback('light');
        
        // Загружаем историю транзакций
        await getTransactionHistory();
        
        // Показываем модальное окно профиля
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
          showModal(profileModal);
        }
        
        updateActiveNavButton(profileBtn);
      });
    }
    
    // Кнопки закрытия модальных окон
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        if (modal) {
          hideModal(modal);
          updateActiveNavButton(homeBtn);
        }
      });
    });
    
    // Закрытие модальных окон при клике вне содержимого
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          hideModal(modal);
          updateActiveNavButton(homeBtn);
        }
      });
    });
  };
  
  // Обновление активной кнопки навигации
  const updateActiveNavButton = (activeButton) => {
    if (!activeButton) return;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    activeButton.classList.add('active');
  };
  
  // Отображение модального окна
  const showModal = (modal) => {
    if (!modal) return;
    
    // Добавляем тактильную обратную связь
    provideTactileFeedback('light');
    
    modal.style.display = 'flex';
    
    // Анимация появления
    setTimeout(() => {
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.style.opacity = '1';
        content.style.transform = 'scale(1)';
      }
    }, 10);
  };
  
  // Скрытие модального окна
  const hideModal = (modal) => {
    if (!modal) return;
    
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.opacity = '0';
      content.style.transform = 'scale(0.9)';
    }
    
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  };
  
  // Диагностика состояния игр
  const diagnoseGames = () => {
    console.log('[Main] Финальная диагностика инициализации игр:');
    
    // Проверяем доступность игр в глобальной области
    const globalGames = {
      slotsGame: typeof window.slotsGame,
      rouletteGame: typeof window.rouletteGame,
      guessNumberGame: typeof window.guessNumberGame,
      minerGame: typeof window.minerGame,
      crushGame: typeof window.crushGame
    };
    
    console.log('[Main] Глобальные игровые объекты:', globalGames);
    console.log('[Main] Статус инициализации игр:', gamesInitialized);
    
    // Проверяем новую систему регистрации игр
    if (window.GreenLightGames) {
      console.log('[Main] GreenLightGames:', {
        slotsGame: typeof window.GreenLightGames.slotsGame,
        rouletteGame: typeof window.GreenLightGames.rouletteGame,
        guessNumberGame: typeof window.GreenLightGames.guessNumberGame,
        minerGame: typeof window.GreenLightGames.minerGame,
        crushGame: typeof window.GreenLightGames.crushGame
      });
    } else {
      console.warn('[Main] GreenLightGames не определено!');
    }
  };
  
  // Показ уведомления
  const showNotification = (message) => {
    console.log('[Main] Уведомление:', message);
    
    try {
      // Если доступен Telegram WebApp API, используем его
      if (tgApp && tgApp.showPopup) {
        tgApp.showPopup({
          title: 'Greenlight Casino',
          message: message,
          buttons: [{type: 'ok'}]
        });
      } else {
        // Иначе используем стандартный alert
        alert(message);
      }
    } catch (error) {
      console.error('[Main] Ошибка при показе уведомления:', error);
      // В случае ошибки используем alert
      alert(message);
    }
  };
  
  // Тактильная обратная связь
  const provideTactileFeedback = (type = 'light') => {
    try {
      // Используем HapticFeedback API если доступен
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
        // Используем Vibration API для браузеров
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
      console.error('[Main] Ошибка тактильной обратной связи:', error);
    }
  };
  
  // Обновление баланса
  const updateBalance = () => {
    try {
      const balanceAmount = document.getElementById('balance-amount');
      const profileBalance = document.getElementById('profile-balance');
      const userName = document.getElementById('user-name');
      
      if (balanceAmount) {
        balanceAmount.textContent = currentUser.balance;
        
        // Добавляем анимацию обновления
        balanceAmount.classList.add('balance-updated');
        setTimeout(() => {
          balanceAmount.classList.remove('balance-updated');
        }, 500);
      }
      
      if (profileBalance) {
        profileBalance.textContent = currentUser.balance;
      }
      
      if (userName) {
        userName.textContent = currentUser.firstName;
      }
    } catch (error) {
      console.error('[Main] Ошибка обновления баланса:', error);
    }
  };
  
  // API: Регистрация пользователя
  const registerUser = async () => {
    try {
      console.log('[API] Регистрация пользователя:', currentUser.telegramId);
      
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: currentUser.telegramId,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          username: currentUser.username
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка регистрации: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[API] Пользователь зарегистрирован:', data);
      
      return data;
    } catch (error) {
      console.error('[API] Ошибка регистрации пользователя:', error);
      
      // Продолжаем работу в демо-режиме
      return null;
    }
  };
  
  // API: Получение профиля пользователя
  const getUserProfile = async () => {
    try {
      console.log('[API] Запрос профиля пользователя:', currentUser.telegramId);
      
      const response = await fetch(`${API_URL}/users/profile/${currentUser.telegramId}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка получения профиля: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обновляем баланс
      currentUser.balance = data.balance;
      updateBalance();
      
      console.log('[API] Профиль пользователя получен:', data);
      
      return data;
    } catch (error) {
      console.error('[API] Ошибка получения профиля:', error);
      
      // Продолжаем работу с текущими данными
      return null;
    }
  };
  
  // API: Получение истории игр
  const getGameHistory = async () => {
    try {
      console.log('[API] Запрос истории игр:', currentUser.telegramId);
      
      const response = await fetch(`${API_URL}/games/history/${currentUser.telegramId}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка получения истории: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обновляем отображение истории
      updateHistoryList(data);
      
      console.log('[API] История игр получена:', data);
      
      return data;
    } catch (error) {
      console.error('[API] Ошибка получения истории игр:', error);
      
      // Показываем пустую историю
      updateHistoryList([]);
      
      return [];
    }
  };
  
  // API: Получение истории транзакций
  const getTransactionHistory = async () => {
    try {
      console.log('[API] Запрос истории транзакций:', currentUser.telegramId);
      
      const response = await fetch(`${API_URL}/users/transactions/${currentUser.telegramId}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка получения транзакций: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обновляем отображение транзакций
      updateTransactionList(data);
      
      console.log('[API] История транзакций получена:', data);
      
      return data;
    } catch (error) {
      console.error('[API] Ошибка получения истории транзакций:', error);
      
      // Показываем пустую историю транзакций
      updateTransactionList([]);
      
      return [];
    }
  };
  
  // API: Обработка результата игры
  const processGameResult = async (gameType, betAmount, outcome, winAmount, gameData) => {
    try {
      console.log('[API] Обработка результата игры:', {
        gameType, betAmount, outcome, winAmount
      });
      
      // Предварительное обновление UI для лучшего UX
      if (outcome === 'win') {
        currentUser.balance = currentUser.balance + winAmount;
        updateBalance();
      } else if (outcome === 'bet' || outcome === 'lose') {
        currentUser.balance = currentUser.balance - betAmount;
        updateBalance();
      }
      
      // Отправляем данные на сервер
      const response = await fetch(`${API_URL}/games/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(`Ошибка обработки результата: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обновляем баланс из ответа сервера
      currentUser.balance = data.user.balance;
      updateBalance();
      
      console.log('[API] Результат игры обработан:', data);
      
      return data;
    } catch (error) {
      console.error('[API] Ошибка обработки результата игры:', error);
      
      // В случае ошибки сервера, UI уже обновлен предварительно
      return null;
    }
  };
  
  // Обновление списка истории игр
  const updateHistoryList = (historyData) => {
    try {
      const historyList = document.getElementById('history-list');
      if (!historyList) return;
      
      // Очищаем текущий список
      historyList.innerHTML = '';
      
      if (!historyData || historyData.length === 0) {
        historyList.innerHTML = '<div class="empty-message">Нет истории игр</div>';
        return;
      }
      
      // Добавляем каждый элемент истории
      historyData.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // Получаем иконку игры
        let gameIcon = '🎮';
        switch (item.gameType) {
          case 'slots': gameIcon = '🎰'; break;
          case 'roulette': gameIcon = '🎲'; break;
          case 'guessnumber': gameIcon = '🔢'; break;
          case 'miner': gameIcon = '💣'; break;
          case 'crush': gameIcon = '📈'; break;
        }
        
        // Форматируем дату
        let formattedDate = 'Неизвестная дата';
        try {
          const date = new Date(item.createdAt);
          formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } catch (dateError) {
          console.error('[Main] Ошибка форматирования даты:', dateError);
        }
        
        historyItem.innerHTML = `
          <div class="history-game">
            <span class="game-icon">${gameIcon}</span>
            <span>${item.gameType.charAt(0).toUpperCase() + item.gameType.slice(1)}</span>
          </div>
          <div class="history-details">
            <div class="history-bet">Ставка: ${item.betAmount} ⭐</div>
            <div class="history-outcome ${item.winAmount > 0 ? 'win' : 'loss'}">
              ${item.winAmount > 0 ? `+${item.winAmount} ⭐` : '-' + item.betAmount + ' ⭐'}
            </div>
          </div>
          <div class="history-date">${formattedDate}</div>
        `;
        
        historyList.appendChild(historyItem);
      });
    } catch (error) {
      console.error('[Main] Ошибка обновления списка истории:', error);
      
      // Показываем сообщение об ошибке
      const historyList = document.getElementById('history-list');
      if (historyList) {
        historyList.innerHTML = '<div class="empty-message">Ошибка загрузки истории</div>';
      }
    }
  };
  
  // Обновление списка транзакций
  const updateTransactionList = (transactionData) => {
    try {
      const transactionList = document.getElementById('transaction-list');
      if (!transactionList) return;
      
      // Очищаем текущий список
      transactionList.innerHTML = '';
      
      if (!transactionData || transactionData.length === 0) {
        transactionList.innerHTML = '<div class="empty-message">Нет транзакций</div>';
        return;
      }
      
      // Добавляем каждую транзакцию
      transactionData.forEach(item => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        
        // Получаем иконку транзакции
        let transactionIcon = '💼';
        let transactionType = '';
        
        switch (item.type) {
          case 'deposit':
            transactionIcon = '⬇️';
            transactionType = 'Пополнение';
            break;
          case 'withdrawal':
            transactionIcon = '⬆️';
            transactionType = 'Вывод';
            break;
          case 'bet':
            transactionIcon = '🎮';
            transactionType = 'Ставка';
            break;
          case 'win':
            transactionIcon = '🏆';
            transactionType = 'Выигрыш';
            break;
          case 'admin_adjustment':
            transactionIcon = '⚙️';
            transactionType = 'Корректировка';
            break;
        }
        
        // Форматируем дату
        let formattedDate = 'Неизвестная дата';
        try {
          const date = new Date(item.createdAt);
          formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } catch (dateError) {
          console.error('[Main] Ошибка форматирования даты:', dateError);
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
      console.error('[Main] Ошибка обновления списка транзакций:', error);
      
      // Показываем сообщение об ошибке
      const transactionList = document.getElementById('transaction-list');
      if (transactionList) {
        transactionList.innerHTML = '<div class="empty-message">Ошибка загрузки транзакций</div>';
      }
    }
  };
  
  // Экспортируем публичные методы
  return {
    init,
    processGameResult,
    showNotification,
    provideTactileFeedback,
    currentUser,
    updateBalance
  };
})();

// Регистрируем casinoApp в глобальном пространстве имен
window.casinoApp = casinoApp;

// Запускаем инициализацию приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Main] DOM полностью загружен');
  
  // Сообщаем загрузчику о начале инициализации
  if (window.appLoader && typeof window.appLoader.updateProgress === 'function') {
    window.appLoader.updateProgress(5);
  }
  
  // Инициализируем приложение
  casinoApp.init().catch(error => {
    console.error('[Main] Ошибка при инициализации из DOMContentLoaded:', error);
    
    // В случае ошибки, принудительно удаляем экран загрузки через аварийный механизм
    if (window.appLoader && typeof window.appLoader.forceRemoveLoading === 'function') {
      window.appLoader.forceRemoveLoading();
    }
  });
});

// Дополнительный обработчик события загрузки для надежности
window.addEventListener('load', function() {
  console.log('[Main] Страница полностью загружена');
  
  // Если приложение ещё не инициализировано, запускаем инициализацию
  if (!window.casinoApp || !window.casinoApp.init) {
    console.error('[Main] casinoApp не найден к моменту загрузки страницы!');
    
    // Принудительно удаляем экран загрузки
    if (window.appLoader && typeof window.appLoader.forceRemoveLoading === 'function') {
      window.appLoader.forceRemoveLoading();
    } else {
      // Экстренное удаление экрана загрузки
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
          
          // Отображаем контент
          const appContent = document.getElementById('app-content');
          if (appContent) {
            appContent.classList.add('loaded');
          }
        }, 300);
      }
    }
  } else if (!window.casinoAppInitStarted) {
    // Резервная инициализация, если по какой-то причине приложение не запустилось
    console.log('[Main] Инициализация через событие load');
    window.casinoAppInitStarted = true;
    casinoApp.init().catch(error => {
      console.error('[Main] Ошибка при инициализации из window.load:', error);
      
      // В случае ошибки, принудительно удаляем экран загрузки через аварийный механизм
      if (window.appLoader && typeof window.appLoader.forceRemoveLoading === 'function') {
        window.appLoader.forceRemoveLoading();
      }
    });
  }
});