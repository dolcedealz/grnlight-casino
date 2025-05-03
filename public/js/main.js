/**
 * main.js - Основной модуль приложения Greenlight Casino
 * Версия 2.0.0 - Улучшенная архитектура с отказоустойчивостью
 */

// Проверяем наличие основного объекта приложения
if (!window.GreenLightApp) {
    console.error('GreenLightApp не инициализирован!');
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
  
  // Получаем ссылку на глобальный объект приложения
  const app = window.GreenLightApp;
  app.log('Main', 'Запуск основного модуля приложения v2.0.0');
  
  // Основная структура приложения - модуль casinoApp
  const casinoApp = (() => {
    // API URL для взаимодействия с бэкендом
    const API_URL = window.location.origin + '/api';
    
    // Ссылка на Telegram WebApp
    let tgApp = null;
    
    // Флаги инициализации
    let initialized = false;
    let uiInitialized = false;
    let telegramInitialized = false;
    
    // Инициализация приложения - основная точка входа
    const init = async () => {
        app.log('Main', 'Начало инициализации приложения');
        
        try {
            // Сообщаем о прогрессе загрузки
            updateProgress(30);
            
            // ВАЖНО: Сразу запускаем параллельно важные процессы
            const uiPromise = initUI();
            const telegramPromise = initTelegram();
            
            // Ждем завершения инициализации UI (критично)
            await uiPromise;
            
            // UI готов - сообщаем загрузчику
            if (window.appLoader && typeof window.appLoader.uiReady === 'function') {
                window.appLoader.uiReady();
            }
            
            // Обновляем прогресс
            updateProgress(60);
            
            // ВАЖНО: Не ожидаем завершения initTelegram, чтобы не блокировать загрузку
            // Только устанавливаем обработчик завершения
            telegramPromise
                .then(() => {
                    app.log('Main', 'Telegram API инициализирован успешно');
                    telegramInitialized = true;
                    app.loading.telegramInitialized = true;
                    updateBalance(); // Обновляем баланс после получения данных
                })
                .catch(error => {
                    app.log('Main', `Ошибка инициализации Telegram: ${error.message}`, true);
                    // Продолжаем работу в демо-режиме даже при ошибке Telegram
                });
            
            // Отмечаем завершение основной инициализации
            initialized = true;
            app.loading.mainInitialized = true;
            
            // Сообщаем загрузчику о завершении инициализации
            notifyLoaderReady();
            
            // Запускаем НЕКРИТИЧНУЮ загрузку игр (в фоновом режиме)
            initGamesBackground();
            
            // Возвращаем успешный результат
            return true;
            
        } catch (error) {
            app.log('Main', `Критическая ошибка инициализации: ${error.message}`, true);
            
            // Даже при ошибке пытаемся показать интерфейс
            showEmergencyUI();
            
            // Уведомляем загрузчик о завершении
            notifyLoaderReady();
            
            return false;
        }
    };
    
    // Инициализация пользовательского интерфейса
    const initUI = async () => {
        app.log('Main', 'Инициализация пользовательского интерфейса');
        
        try {
            // Настройка обработчиков событий
            setupEventListeners();
            
            // Активация начального экрана
            activateWelcomeScreen();
            
            // Начальное обновление баланса
            updateBalance();
            
            // Отмечаем успешную инициализацию UI
            uiInitialized = true;
            app.loading.uiReady = true;
            
            app.log('Main', 'Пользовательский интерфейс успешно инициализирован');
            return true;
            
        } catch (error) {
            app.log('Main', `Ошибка инициализации UI: ${error.message}`, true);
            throw error; // Пробрасываем ошибку, так как UI критичен
        }
    };
    
    // Инициализация Telegram WebApp
    const initTelegram = async () => {
        app.log('Main', 'Инициализация Telegram WebApp');
        
        try {
            // Проверяем доступность Telegram API
            if (!window.Telegram || !window.Telegram.WebApp) {
                app.log('Main', 'Telegram WebApp API не доступен, используем демо-режим');
                return false;
            }
            
            // Сохраняем ссылку на Telegram WebApp
            tgApp = window.Telegram.WebApp;
            
            // Расширяем окно приложения
            tgApp.expand();
            app.log('Main', 'Telegram WebApp расширен');
            
            // Получаем данные пользователя Telegram
            if (tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
                const user = tgApp.initDataUnsafe.user;
                
                // Обновляем данные пользователя
                app.user.telegramId = user.id;
                app.user.firstName = user.first_name || 'Player';
                app.user.lastName = user.last_name || '';
                app.user.username = user.username || '';
                
                app.log('Main', `Пользователь Telegram: ${app.user.firstName} (${app.user.telegramId})`);
                
                // Ограничиваем время ожидания API операций
                const registerPromise = Promise.race([
                    registerUser(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    )
                ]);
                
                try {
                    // Регистрируем пользователя и получаем его профиль
                    await registerPromise;
                    await getUserProfile();
                } catch (apiError) {
                    app.log('Main', `Ошибка API: ${apiError.message}. Используем локальные данные.`, true);
                }
            } else {
                app.log('Main', 'Данные пользователя Telegram недоступны, используем дефолтные');
            }
            
            // Отмечаем успех инициализации Telegram
            telegramInitialized = true;
            app.loading.telegramInitialized = true;
            
            return true;
            
        } catch (error) {
            app.log('Main', `Ошибка Telegram WebApp: ${error.message}`, true);
            // Возвращаем false, но не выбрасываем ошибку - продолжаем в демо-режиме
            return false;
        }
    };
    
    // Фоновая инициализация игр (не блокирует основной поток)
    const initGamesBackground = () => {
        app.log('Main', 'Запуск фоновой инициализации игр');
        
        // Запускаем в таймауте, чтобы UI успел обновиться
        setTimeout(() => {
            try {
                const gameTypes = ['slots', 'roulette', 'guessnumber', 'miner', 'crush', 'dispute']; // Добавлен dispute
                
                // Проверяем каждую игру
                gameTypes.forEach(gameType => {
                    const objectName = gameType + 'Game';
                    
                    // Безопасно инициализируем игру
                    safeInitGame(gameType, objectName)
                        .then(success => {
                            if (success) {
                                app.log('Main', `Игра ${gameType} успешно инициализирована`);
                            } else {
                                app.log('Main', `Игра ${gameType} не инициализирована`, true);
                            }
                        })
                        .catch(error => {
                            app.log('Main', `Ошибка инициализации ${gameType}: ${error.message}`, true);
                        });
                });
                
                app.loading.gamesInitialized = true;
                
            } catch (error) {
                app.log('Main', `Общая ошибка инициализации игр: ${error.message}`, true);
            }
        }, 1000);
    };
    
    // Безопасная инициализация игры с таймаутом
    const safeInitGame = async (gameName, objectName) => {
        app.log('Main', `Попытка инициализации игры ${gameName}`);
        
        // Устанавливаем максимальное время ожидания
        return Promise.race([
            // Основной процесс инициализации
            (async () => {
                try {
                    // Проверяем новый формат хранения игры
                    if (app.games[gameName] && app.games[gameName].instance) {
                        const gameObject = app.games[gameName].instance;
                        if (typeof gameObject.init === 'function') {
                            await gameObject.init();
                            app.log('Main', `Игра ${gameName} инициализирована через app.games`);
                            return true;
                        }
                    }
                    
                    // Проверяем GreenLightGames (старый формат)
                    if (window.GreenLightGames && window.GreenLightGames[objectName]) {
                        const gameObject = window.GreenLightGames[objectName];
                        if (typeof gameObject.init === 'function') {
                            await gameObject.init();
                            app.log('Main', `Игра ${gameName} инициализирована через GreenLightGames`);
                            return true;
                        }
                    }
                    
                    // Проверяем глобальное пространство имен
                    if (window[objectName] && typeof window[objectName].init === 'function') {
                        await window[objectName].init();
                        app.log('Main', `Игра ${gameName} инициализирована через глобальный объект`);
                        return true;
                    }
                    
                    app.log('Main', `Игра ${gameName} не найдена или не имеет метода init`);
                    return false;
                    
                } catch (error) {
                    app.log('Main', `Ошибка инициализации ${gameName}: ${error.message}`, true);
                    return false;
                }
            })(),
            
            // Таймаут инициализации
            new Promise(resolve => {
                setTimeout(() => {
                    app.log('Main', `Превышено время инициализации игры ${gameName}`, true);
                    resolve(false);
                }, 5000); // 5 секунд максимум
            })
        ]);
    };
    
    // Настройка обработчиков событий
    const setupEventListeners = () => {
        app.log('Main', 'Настройка обработчиков событий');
        
        try {
            // Обработчики для карточек игр
            const gameCards = document.querySelectorAll('.game-card');
            gameCards.forEach(card => {
                card.addEventListener('click', (e) => {
                    const game = card.getAttribute('data-game');
                    if (!game) return;
                    
                    app.log('Main', `Выбрана игра: ${game}`);
                    
                    // Тактильная обратная связь
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
                    app.log('Main', 'Нажата кнопка "Назад"');
                    
                    // Тактильная обратная связь
                    provideTactileFeedback('light');
                    
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
                    app.log('Main', 'Нажата кнопка "Home"');
                    provideTactileFeedback('light');
                    
                    activateWelcomeScreen();
                    updateActiveNavButton(homeBtn);
                });
            }
            
            if (historyBtn) {
                historyBtn.addEventListener('click', () => {
                    app.log('Main', 'Нажата кнопка "History"');
                    provideTactileFeedback('light');
                    
                    // Загружаем историю игр
                    getGameHistory()
                        .catch(error => {
                            app.log('Main', `Ошибка загрузки истории: ${error.message}`, true);
                        });
                    
                    // Показываем модальное окно истории
                    const historyModal = document.getElementById('history-modal');
                    if (historyModal) {
                        showModal(historyModal);
                    }
                    
                    updateActiveNavButton(historyBtn);
                });
            }
            
            if (profileBtn) {
                profileBtn.addEventListener('click', () => {
                    app.log('Main', 'Нажата кнопка "Profile"');
                    provideTactileFeedback('light');
                    
                    // Загружаем историю транзакций
                    getTransactionHistory()
                        .catch(error => {
                            app.log('Main', `Ошибка загрузки транзакций: ${error.message}`, true);
                        });
                    
                    // Показываем модальное окно профиля
                    const profileModal = document.getElementById('profile-modal');
                    if (profileModal) {
                        showModal(profileModal);
                    }
                    
                    updateActiveNavButton(profileBtn);
                });
            }
            
            // Обработчики закрытия модальных окон
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
            
            app.log('Main', 'Обработчики событий успешно настроены');
            
        } catch (error) {
            app.log('Main', `Ошибка настройки обработчиков: ${error.message}`, true);
            // Продолжаем работу даже при ошибке обработчиков
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
                app.log('Main', 'Приветственный экран активирован');
            } else {
                app.log('Main', 'Элемент welcome-screen не найден!', true);
            }
        } catch (error) {
            app.log('Main', `Ошибка при активации welcome-screen: ${error.message}`, true);
        }
    };
    
    // Показ аварийного UI при критических ошибках
    const showEmergencyUI = () => {
        app.log('Main', 'Активация аварийного UI');
        
        try {
            // Активируем приветственный экран
            activateWelcomeScreen();
            
            // Отображаем приложение
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.classList.add('loaded');
            }
            
            // Обновляем баланс
            updateBalance();
            
            app.log('Main', 'Аварийный UI успешно активирован');
            
        } catch (error) {
            app.log('Main', `Ошибка при активации аварийного UI: ${error.message}`, true);
        }
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
    
    // Обновление прогресса загрузки
    const updateProgress = (percent) => {
        try {
            if (window.appLoader && typeof window.appLoader.updateProgress === 'function') {
                window.appLoader.updateProgress(percent);
            }
        } catch (error) {
            app.log('Main', `Ошибка обновления прогресса: ${error.message}`, true);
        }
    };
    
    // Уведомление загрузчика о готовности
    const notifyLoaderReady = () => {
        try {
            app.log('Main', 'Уведомление загрузчика о готовности основного модуля');
            
            if (window.appLoader && typeof window.appLoader.mainReady === 'function') {
                window.appLoader.mainReady();
            } else {
                app.log('Main', 'appLoader.mainReady не найден, удаляем экран загрузки напрямую', true);
                
                // Аварийное удаление экрана загрузки
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
                    }, 300);
                }
            }
        } catch (error) {
            app.log('Main', `Ошибка уведомления загрузчика: ${error.message}`, true);
            
            // Аварийное удаление экрана загрузки при ошибке
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
    
    // Обновление баланса пользователя
    const updateBalance = () => {
        try {
            const balanceAmount = document.getElementById('balance-amount');
            const profileBalance = document.getElementById('profile-balance');
            const userName = document.getElementById('user-name');
            
            if (balanceAmount) {
                balanceAmount.textContent = app.user.balance;
                
                // Добавляем анимацию обновления
                balanceAmount.classList.add('balance-updated');
                setTimeout(() => {
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
            app.log('Main', `Ошибка обновления баланса: ${error.message}`, true);
        }
    };
    
    // Показ уведомления
    const showNotification = (message) => {
        app.log('Main', `Уведомление: ${message}`);
        
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
            app.log('Main', `Ошибка при показе уведомления: ${error.message}`, true);
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
            app.log('Main', `Ошибка тактильной обратной связи: ${error.message}`, true);
        }
    };
    
    // ===== API Методы =====
    
    // Регистрация пользователя
    const registerUser = async () => {
        try {
            app.log('Main', `Регистрация пользователя: ${app.user.telegramId}`);
            
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
                throw new Error(`Ошибка регистрации: ${response.status}`);
            }
            
            const data = await response.json();
            app.log('Main', 'Пользователь зарегистрирован успешно');
            
            return data;
        } catch (error) {
            app.log('Main', `Ошибка регистрации пользователя: ${error.message}`, true);
            // Продолжаем работу в демо-режиме
            return null;
        }
    };
    
    // Получение профиля пользователя
    const getUserProfile = async () => {
        try {
            app.log('Main', `Запрос профиля пользователя: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/users/profile/${app.user.telegramId}`);
            
            if (!response.ok) {
                throw new Error(`Ошибка получения профиля: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Обновляем баланс
            app.user.balance = data.balance;
            updateBalance();
            
            app.log('Main', 'Профиль пользователя получен успешно');
            
            return data;
        } catch (error) {
            app.log('Main', `Ошибка получения профиля: ${error.message}`, true);
            // Продолжаем работу с текущими данными
            return null;
        }
    };
    
    // Получение истории игр
    const getGameHistory = async () => {
        try {
            app.log('Main', `Запрос истории игр: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/games/history/${app.user.telegramId}`);
            
            if (!response.ok) {
                throw new Error(`Ошибка получения истории: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Обновляем отображение истории
            updateHistoryList(data);
            
            app.log('Main', 'История игр получена успешно');
            
            return data;
        } catch (error) {
            app.log('Main', `Ошибка получения истории игр: ${error.message}`, true);
            
            // Показываем пустую историю
            updateHistoryList([]);
            
            return [];
        }
    };
    
    // Получение истории транзакций
    const getTransactionHistory = async () => {
        try {
            app.log('Main', `Запрос истории транзакций: ${app.user.telegramId}`);
            
            const response = await fetch(`${API_URL}/users/transactions/${app.user.telegramId}`);
            
            if (!response.ok) {
                throw new Error(`Ошибка получения транзакций: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Обновляем отображение транзакций
            updateTransactionList(data);
            
            app.log('Main', 'История транзакций получена успешно');
            
            return data;
        } catch (error) {
            app.log('Main', `Ошибка получения истории транзакций: ${error.message}`, true);
            
            // Показываем пустую историю транзакций
            updateTransactionList([]);
            
            return [];
        }
    };
    
    // Обработка результата игры
    const processGameResult = async (gameType, betAmount, outcome, winAmount, gameData) => {
        try {
            app.log('Main', `Обработка результата игры: ${gameType}, исход: ${outcome}`);
            
            // Предварительное обновление UI для лучшего UX
         if (outcome === 'win') {
            app.user.balance = app.user.balance + winAmount;
            updateBalance();
        } else if (outcome === 'bet' || outcome === 'lose') {
            app.user.balance = app.user.balance - betAmount;
            updateBalance();
        }
        
        // Отправляем данные на сервер с ограничением времени ожидания
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
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Таймаут API')), 5000)
            )
        ]);
        
        const response = await responsePromise;
        
        if (!response.ok) {
            throw new Error(`Ошибка обработки результата: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Обновляем баланс из ответа сервера
        app.user.balance = data.user.balance;
        updateBalance();
        
        app.log('Main', 'Результат игры обработан успешно');
        
        return data;
    } catch (error) {
        app.log('Main', `Ошибка обработки результата игры: ${error.message}`, true);
        
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
                case 'dispute': gameIcon = '⚔️'; break; // Добавлена иконка для dispute
            }
            
            // Форматируем дату
            let formattedDate = 'Неизвестная дата';
            try {
                const date = new Date(item.createdAt);
                formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } catch (dateError) {
                app.log('Main', `Ошибка форматирования даты: ${dateError.message}`, true);
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
        app.log('Main', `Ошибка обновления списка истории: ${error.message}`, true);
        
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
                app.log('Main', `Ошибка форматирования даты: ${dateError.message}`, true);
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
        app.log('Main', `Ошибка обновления списка транзакций: ${error.message}`, true);
        
        // Показываем сообщение об ошибке
        const transactionList = document.getElementById('transaction-list');
        if (transactionList) {
            transactionList.innerHTML = '<div class="empty-message">Ошибка загрузки транзакций</div>';
        }
    }
};

// Экспортируем публичные методы и свойства
return {
    init,
    processGameResult,
    showNotification,
    provideTactileFeedback,
    updateBalance,
    
    // Метод для проверки состояния приложения
    getStatus: function() {
        return {
            initialized,
            uiInitialized,
            telegramInitialized,
            gamesLoaded: app.loading.gamesInitialized
        };
    }
};
})();

// Регистрируем casinoApp в глобальном пространстве имен
window.casinoApp = casinoApp;

// Запускаем инициализацию приложения автоматически
// (с безопасной обработкой ошибок)
setTimeout(() => {
try {
    app.log('Main', 'Автоматический запуск инициализации');
    
    casinoApp.init().catch(error => {
        app.log('Main', `Ошибка при инициализации: ${error.message}`, true);
        
        // В случае ошибки, принудительно удаляем экран загрузки
        if (window.appLoader && typeof window.appLoader.forceRemoveLoading === 'function') {
            window.appLoader.forceRemoveLoading();
        }
    });
} catch (error) {
    app.log('Main', `Необработанная ошибка инициализации: ${error.message}`, true);
    
    // Крайний случай - удаляем экран загрузки напрямую
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.classList.add('loaded');
    }
}
}, 100); // Небольшая задержка для завершения загрузки DOM