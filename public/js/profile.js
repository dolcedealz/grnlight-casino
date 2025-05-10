/**
 * profile.js - Модуль для управления функционалом профиля
 * Версия 1.1.0 - С улучшенной безопасностью
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
    app.log('Profile', 'Инициализация модуля профиля v1.1.0');
    
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
                    // Валидация данных транзакции
                    const amount = parseFloat(e.detail.amount);
                    if (!isNaN(amount) && isFinite(amount)) {
                        // Обновляем дневной оборот только для положительных транзакций
                        if (amount > 0) {
                            updateDailyTurnover(amount);
                        }
                    } else {
                        app.log('Profile', `Получена транзакция с невалидной суммой: ${e.detail.amount}`, true);
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
                    let secureState;
                    
                    try {
                        secureState = JSON.parse(savedState);
                    } catch (parseError) {
                        throw new Error('Ошибка при парсинге данных состояния профиля');
                    }
                    
                    // Проверяем структуру данных
                    if (!secureState || typeof secureState !== 'object') {
                        throw new Error('Некорректный формат данных состояния');
                    }
                    
                    // Проверяем наличие всех необходимых полей
                    if (!secureState.data || !secureState.timestamp || !secureState.signature) {
                        throw new Error('Отсутствуют обязательные поля в данных состояния');
                    }
                    
                    // Проверяем актуальность данных (не старше 1 дня)
                    const now = Date.now();
                    if (now - secureState.timestamp > 86400000) {
                        throw new Error('Устаревшие данные состояния профиля');
                    }
                    
                    // Проверяем подпись для обеспечения целостности данных
                    const dataToSign = JSON.stringify(secureState.data) + secureState.timestamp;
                    const expectedSignature = generateDataSignature(dataToSign);
                    
                    if (expectedSignature !== secureState.signature) {
                        throw new Error('Нарушена целостность данных состояния профиля');
                    }
                    
                    // Проверяем значения на допустимые диапазоны
                    const data = secureState.data;
                    
                    // Безопасно извлекаем значения с проверкой типов и ограничениями
                    state.activityPoints = typeof data.activityPoints === 'number' && isFinite(data.activityPoints) && data.activityPoints >= 0 
                                        ? Math.min(data.activityPoints, 100000) // Разумное максимальное значение
                                        : 0;
                                        
                    state.dailyTurnover = typeof data.dailyTurnover === 'number' && isFinite(data.dailyTurnover) && data.dailyTurnover >= 0 
                                       ? Math.min(data.dailyTurnover, 1000000) // Разумное максимальное значение
                                       : 0;
                    
                    // Безопасно преобразуем дату
                    try {
                        const resetDate = new Date(data.lastActivityReset);
                        // Проверяем, что дата валидна
                        if (!isNaN(resetDate.getTime())) {
                            state.lastActivityReset = resetDate;
                        } else {
                            state.lastActivityReset = new Date();
                        }
                    } catch (dateError) {
                        state.lastActivityReset = new Date();
                    }
                    
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
                // Ограничиваем сохраняемые данные только необходимыми
                const stateToSave = {
                    activityPoints: state.activityPoints,
                    dailyTurnover: state.dailyTurnover,
                    lastActivityReset: state.lastActivityReset.toISOString()
                };
                
                // Добавляем подпись и временную метку для обеспечения целостности
                const timestamp = Date.now();
                const dataToSign = JSON.stringify(stateToSave) + timestamp;
                
                // Используем простую хеш-функцию для проверки целостности
                const signature = generateDataSignature(dataToSign);
                
                // Сохраняем с подписью и временной меткой
                const secureState = {
                    data: stateToSave,
                    timestamp: timestamp,
                    signature: signature
                };
                
                localStorage.setItem('profileState', JSON.stringify(secureState));
                app.log('Profile', 'Состояние профиля сохранено в хранилище');
            } catch (error) {
                app.log('Profile', `Ошибка сохранения состояния профиля: ${error.message}`, true);
            }
        };
        
        /**
         * Генерация подписи данных для проверки целостности
         * @param {string} data - Данные для подписи
         * @returns {string} - Хеш-подпись
         */
        function generateDataSignature(data) {
            // Простая хеш-функция для генерации подписи
            let hash = 0;
            const domain = window.location.hostname || 'greenlight-casino';
            const saltedData = data + '-' + domain;
            
            for (let i = 0; i < saltedData.length; i++) {
                const char = saltedData.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Преобразование в 32-битное целое
            }
            
            // Добавляем префикс для дополнительной защиты
            return 'gl-' + Math.abs(hash).toString(16);
        }
        
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
                if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
                    app.log('Profile', `Невалидное значение для обновления оборота: ${amount}`, true);
                    return;
                }
                
                // Устанавливаем разумные ограничения для предотвращения манипуляций
                const maxSingleTransaction = 100000; // Максимальная сумма для единичного обновления
                const safeAmount = Math.min(amount, maxSingleTransaction);
                
                // Увеличиваем дневной оборот
                state.dailyTurnover += safeAmount;
                
                // Ограничиваем максимальное значение дневного оборота
                const maxDailyTurnover = 1000000; // Разумный максимум
                state.dailyTurnover = Math.min(state.dailyTurnover, maxDailyTurnover);
                
                // Начисляем баллы активности (1 балл за каждые 100 звезд оборота)
                const newPoints = Math.floor(safeAmount / 100);
                if (newPoints > 0) {
                    // Ограничиваем максимальное количество баллов
                    const maxActivityPoints = 100000;
                    state.activityPoints = Math.min(state.activityPoints + newPoints, maxActivityPoints);
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
         * Обработка введенного промокода с улучшенной безопасностью
         */
        const processPromoCode = function(code) {
            // Валидация промокода
            if (!code || typeof code !== 'string' || code.trim() === '') {
                showNotification('Введите корректный промокод');
                return;
            }
            
            // Очистка и нормализация кода для безопасной обработки
            const normalizedCode = code.trim().toUpperCase();
            
            // Логируем попытку использования промокода
            app.log('Profile', `Обработка промокода: ${normalizedCode}`);
            
            // Добавим проверку максимальной длины промокода
            if (normalizedCode.length > 20) {
                showNotification('Слишком длинный промокод');
                return;
            }
            
            // Проверяем на наличие недопустимых символов
            if (!/^[A-Z0-9]+$/.test(normalizedCode)) {
                showNotification('Промокод может содержать только буквы и цифры');
                return;
            }
            
            // Проверяем, использовался ли промокод ранее
            const usedCodes = JSON.parse(localStorage.getItem('usedPromoCodes') || '[]');
            if (usedCodes.includes(normalizedCode)) {
                showNotification('Вы уже использовали этот промокод');
                return;
            }
            
            // Здесь должна быть логика проверки промокода на сервере
            // Для демо просто выводим уведомление
            
            // Пример обработки промокода (можно заменить на реальную логику API)
            if (normalizedCode === 'BONUS100') {
                // Начисляем 100 звезд
                if (window.GreenLightApp.user) {
                    // Устанавливаем лимит для бонуса
                    const maxBonus = 1000;
                    const bonusAmount = Math.min(100, maxBonus);
                    
                    window.GreenLightApp.user.balance += bonusAmount;
                    
                    // Обновляем интерфейс
                    updateUI();
                    
                    // Сохраняем использованный промокод
                    usedCodes.push(normalizedCode);
                    localStorage.setItem('usedPromoCodes', JSON.stringify(usedCodes));
                    
                    // Отправляем событие транзакции
                    const transactionEvent = new CustomEvent('transaction', {
                        detail: { amount: bonusAmount, type: 'promo' }
                    });
                    document.dispatchEvent(transactionEvent);
                    
                    showNotification(`Промокод активирован! +${bonusAmount} звезд`);
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
         * Показ уведомления с защитой от XSS
         */
        const showNotification = function(message) {
            // Безопасно экранируем сообщение
            const safeMessage = String(message)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
                
            // Используем существующую функцию уведомлений из основного приложения
            if (window.casinoApp && window.casinoApp.showNotification) {
                window.casinoApp.showNotification(safeMessage);
            } else {
                // Запасной вариант
                alert(safeMessage);
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