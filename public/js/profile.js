/**
 * profile.js - Модуль для управления функционалом профиля
 * Версия 1.0.0
 */

(function() {
    // Проверяем наличие основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[Profile] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Profile', 'Инициализация модуля профиля v1.0.0');
    
    // Профильный модуль
    const profileModule = (function() {
        // Элементы профиля
        let elements = {
            profileScreen: null,
            profileBalance: null,
            activityPoints: null,
            activityProgressBar: null,
            promoCodeInput: null,
            telegramLink: null
        };
        
        // Состояние профиля
        let state = {
            initialized: false,
            activityPoints: 0,
            dailyTurnover: 0,
            maxDailyTurnover: 15000, // 15 тысяч звезд для заполнения шкалы
            lastActivityReset: null   // Дата последнего сброса активности
        };
        
        /**
         * Инициализация модуля профиля
         */
        const init = async function() {
            app.log('Profile', 'Начало инициализации профиля');
            
            try {
                // Получаем элементы DOM
                findElements();
                
                // Устанавливаем обработчики событий
                setupEventListeners();
                
                // Загружаем состояние профиля из локального хранилища
                loadProfileState();
                
                // Проверяем, нужно ли сбросить активность на новый день
                checkActivityReset();
                
                // Обновляем интерфейс
                updateUI();
                
                state.initialized = true;
                app.log('Profile', 'Профиль успешно инициализирован');
                
                return true;
            } catch (error) {
                app.log('Profile', `Ошибка инициализации профиля: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Поиск DOM элементов
         */
        const findElements = function() {
            elements.profileScreen = document.getElementById('profile-screen');
            elements.profileBalance = document.getElementById('profile-balance');
            elements.activityPoints = document.getElementById('activity-points');
            elements.activityProgressBar = document.getElementById('activity-progress-bar');
            elements.promoCodeInput = document.getElementById('promo-code-input');
            elements.telegramLink = document.querySelector('.telegram-link');
            
            // Проверка наличия критических элементов
            if (!elements.profileScreen) {
                app.log('Profile', 'Экран профиля не найден!', true);
            }
            
            if (!elements.activityProgressBar) {
                app.log('Profile', 'Элемент шкалы активности не найден!', true);
            }
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            // Обработчик для ввода промокода
            if (elements.promoCodeInput) {
                elements.promoCodeInput.addEventListener('keyup', function(event) {
                    if (event.key === 'Enter') {
                        processPromoCode(elements.promoCodeInput.value);
                    }
                });
            }
            
            // Вибрация при клике на ссылку телеграмм
            if (elements.telegramLink) {
                elements.telegramLink.addEventListener('click', function() {
                    provideTactileFeedback('medium');
                });
            }
            
            // Обновляем профиль при каждой транзакции
            document.addEventListener('transaction', function(e) {
                if (e.detail && e.detail.amount) {
                    // Обновляем дневной оборот только для положительных транзакций
                    if (e.detail.amount > 0) {
                        updateDailyTurnover(e.detail.amount);
                    }
                }
            });
        };
        
        /**
         * Загрузка состояния профиля из локального хранилища
         */
        const loadProfileState = function() {
            try {
                const savedState = localStorage.getItem('profileState');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);
                    
                    // Обновляем состояние из сохранения
                    state.activityPoints = parsedState.activityPoints || 0;
                    state.dailyTurnover = parsedState.dailyTurnover || 0;
                    state.lastActivityReset = parsedState.lastActivityReset ? new Date(parsedState.lastActivityReset) : new Date();
                    
                    app.log('Profile', 'Состояние профиля загружено из хранилища');
                }
            } catch (error) {
                app.log('Profile', `Ошибка загрузки состояния профиля: ${error.message}`, true);
                
                // Устанавливаем значения по умолчанию
                state.activityPoints = 0;
                state.dailyTurnover = 0;
                state.lastActivityReset = new Date();
            }
        };
        
        /**
         * Сохранение состояния профиля в локальное хранилище
         */
        const saveProfileState = function() {
            try {
                const stateToSave = {
                    activityPoints: state.activityPoints,
                    dailyTurnover: state.dailyTurnover,
                    lastActivityReset: state.lastActivityReset.toISOString()
                };
                
                localStorage.setItem('profileState', JSON.stringify(stateToSave));
                app.log('Profile', 'Состояние профиля сохранено в хранилище');
            } catch (error) {
                app.log('Profile', `Ошибка сохранения состояния профиля: ${error.message}`, true);
            }
        };
        
        /**
         * Проверка необходимости сброса дневной активности
         */
        const checkActivityReset = function() {
            try {
                const now = new Date();
                const lastReset = state.lastActivityReset || now;
                
                // Проверяем, наступил ли новый день
                if (now.getDate() !== lastReset.getDate() || 
                    now.getMonth() !== lastReset.getMonth() || 
                    now.getFullYear() !== lastReset.getFullYear()) {
                    
                    app.log('Profile', 'Обнаружен новый день, сбрасываем дневную активность');
                    
                    // Сбрасываем дневной оборот
                    state.dailyTurnover = 0;
                    state.lastActivityReset = now;
                    
                    // Сохраняем состояние
                    saveProfileState();
                }
            } catch (error) {
                app.log('Profile', `Ошибка проверки сброса активности: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление дневного оборота и начисление баллов активности
         */
        const updateDailyTurnover = function(amount) {
            try {
                // Увеличиваем дневной оборот
                state.dailyTurnover += amount;
                
                // Начисляем баллы активности (1 балл за каждые 100 звезд оборота)
                const newPoints = Math.floor(amount / 100);
                if (newPoints > 0) {
                    state.activityPoints += newPoints;
                    app.log('Profile', `Начислено ${newPoints} баллов активности`);
                }
                
                // Сохраняем состояние
                saveProfileState();
                
                // Обновляем интерфейс
                updateUI();
            } catch (error) {
                app.log('Profile', `Ошибка обновления дневного оборота: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление интерфейса профиля
         */
        const updateUI = function() {
            try {
                // Обновляем баланс
                if (elements.profileBalance && window.GreenLightApp.user) {
                    elements.profileBalance.textContent = window.GreenLightApp.user.balance.toFixed(2);
                }
                
                // Обновляем баллы активности
                if (elements.activityPoints) {
                    elements.activityPoints.textContent = state.activityPoints;
                }
                
                // Обновляем шкалу активности
                if (elements.activityProgressBar) {
                    // Рассчитываем процент заполнения шкалы (максимум 100%)
                    const progressPercent = Math.min(100, (state.dailyTurnover / state.maxDailyTurnover) * 100);
                    elements.activityProgressBar.style.width = `${progressPercent}%`;
                    
                    // Добавляем классы в зависимости от уровня заполнения
                    elements.activityProgressBar.classList.remove('low', 'medium', 'high', 'complete');
                    
                    if (progressPercent >= 100) {
                        elements.activityProgressBar.classList.add('complete');
                    } else if (progressPercent >= 70) {
                        elements.activityProgressBar.classList.add('high');
                    } else if (progressPercent >= 30) {
                        elements.activityProgressBar.classList.add('medium');
                    } else {
                        elements.activityProgressBar.classList.add('low');
                    }
                }
            } catch (error) {
                app.log('Profile', `Ошибка обновления интерфейса: ${error.message}`, true);
            }
        };
        
        /**
         * Обработка введенного промокода
         */
        const processPromoCode = function(code) {
            if (!code || code.trim() === '') {
                showNotification('Введите промокод');
                return;
            }
            
            app.log('Profile', `Обработка промокода: ${code}`);
            
            // Здесь должна быть логика проверки промокода на сервере
            // Для демо просто выводим уведомление
            
            // Пример обработки промокода (можно заменить на реальную логику API)
            if (code === 'BONUS100') {
                // Начисляем 100 звезд
                if (window.GreenLightApp.user) {
                    window.GreenLightApp.user.balance += 100;
                    
                    // Обновляем интерфейс
                    updateUI();
                    
                    // Отправляем событие транзакции
                    const transactionEvent = new CustomEvent('transaction', {
                        detail: { amount: 100, type: 'promo' }
                    });
                    document.dispatchEvent(transactionEvent);
                    
                    showNotification('Промокод активирован! +100 звезд');
                    provideTactileFeedback('success');
                }
            } else {
                showNotification('Промокод не найден или уже использован');
                provideTactileFeedback('error');
            }
            
            // Очищаем поле ввода
            if (elements.promoCodeInput) {
                elements.promoCodeInput.value = '';
            }
        };
        
        /**
         * Показ уведомления
         */
        const showNotification = function(message) {
            // Используем существующую функцию уведомлений из основного приложения
            if (window.casinoApp && window.casinoApp.showNotification) {
                window.casinoApp.showNotification(message);
            } else {
                // Запасной вариант
                alert(message);
            }
        };
        
        /**
         * Тактильная обратная связь
         */
        const provideTactileFeedback = function(type) {
            // Используем существующую функцию вибрации из основного приложения
            if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                window.casinoApp.provideTactileFeedback(type);
            } else if ('vibrate' in navigator) {
                // Запасной вариант
                switch (type) {
                    case 'light': navigator.vibrate(10); break;
                    case 'medium': navigator.vibrate(20); break;
                    case 'heavy': navigator.vibrate(30); break;
                    case 'success': navigator.vibrate([10, 50, 10]); break;
                    case 'error': navigator.vibrate([50, 100, 50]); break;
                    default: navigator.vibrate(10);
                }
            }
        };
        
        // Возвращаем публичный API модуля
        return {
            init: init,
            updateUI: updateUI,
            processPromoCode: processPromoCode,
            getActivityPoints: function() { return state.activityPoints; },
            getDailyTurnover: function() { return state.dailyTurnover; }
        };
    })();
    
    // Автоматическая инициализация при загрузке DOM
    document.addEventListener('DOMContentLoaded', function() {
        profileModule.init();
    });
    
    // Если DOM уже загружен, инициализируем сразу
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(profileModule.init, 100);
    }
    
    // Регистрируем модуль в глобальном пространстве имен
    window.profileModule = profileModule;
    
})();