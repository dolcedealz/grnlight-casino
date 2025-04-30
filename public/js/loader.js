// Enhanced loader.js - улучшенная система удаления загрузочного экрана
console.log('[Loader] Запущен улучшенный загрузчик v1.0.2');

(function() {
  // Настройки загрузчика
  const CONFIG = {
    // Время до принудительного удаления экрана загрузки (мс)
    EMERGENCY_TIMEOUT: 6000,
    // Время анимации исчезновения (мс)
    FADE_DURATION: 300,
    // Минимальное время показа экрана загрузки (мс)
    MIN_DISPLAY_TIME: 1000,
    // Промежуточный прогресс, который показываем в любом случае
    INITIAL_PROGRESS: 30
  };

  // Флаги состояния
  let loadingRemoved = false;
  let mainInitialized = false;
  let startTime = Date.now();
  
  // Элементы, с которыми будем работать
  let loadingOverlay, progressBar, appContent, welcomeScreen;

  // Инициализируем loader
  function initLoader() {
    try {
      console.log('[Loader] Инициализация загрузчика');
      
      // Получаем ссылки на элементы
      loadingOverlay = document.getElementById('loadingOverlay');
      progressBar = document.getElementById('progress-bar');
      appContent = document.getElementById('app-content');
      welcomeScreen = document.getElementById('welcome-screen');
      
      // Проверяем наличие необходимых элементов
      if (!loadingOverlay) {
        console.error('[Loader] Не найден элемент loadingOverlay');
        return false;
      }
      
      // Устанавливаем начальный прогресс
      updateProgress(CONFIG.INITIAL_PROGRESS);
      
      return true;
    } catch (error) {
      console.error('[Loader] Ошибка инициализации:', error);
      return false;
    }
  }
  
  // Обновление индикатора прогресса
  function updateProgress(percent) {
    try {
      if (progressBar) {
        progressBar.style.width = percent + '%';
      }
    } catch (error) {
      console.error('[Loader] Ошибка обновления прогресса:', error);
    }
  }
  
  // Плавное скрытие экрана загрузки
  function removeLoadingScreen() {
    try {
      if (loadingRemoved) return; // Предотвращаем повторное выполнение
      
      loadingRemoved = true;
      console.log('[Loader] Удаление экрана загрузки');
      
      // Убедимся, что прошло минимальное время отображения
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, CONFIG.MIN_DISPLAY_TIME - elapsedTime);
      
      // Показываем 100% прогресс при любых обстоятельствах
      updateProgress(100);
      
      // Проверяем готовность игровых объектов
      const gamesReady = checkGamesReady();
      console.log(`[Loader] Статус игровых объектов перед удалением: ${gamesReady ? 'готовы' : 'не готовы'}`);
      
      // Ждем минимальное время перед скрытием
      setTimeout(() => {
        try {
          // Плавно скрываем загрузочный экран
          if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            
            setTimeout(() => {
              try {
                // Полностью скрываем после завершения анимации
                if (loadingOverlay) {
                  loadingOverlay.style.display = 'none';
                }
                
                // Показываем контент приложения
                if (appContent) {
                  appContent.classList.add('loaded');
                }
                
                // Проверяем, нужно ли активировать welcome-screen
                if (welcomeScreen && !welcomeScreen.classList.contains('active')) {
                  // Сначала скрываем все экраны
                  document.querySelectorAll('.screen').forEach(screen => {
                    screen.classList.remove('active');
                  });
                  
                  // Затем показываем приветственный экран
                  welcomeScreen.classList.add('active');
                }
                
                console.log('[Loader] Загрузочный экран успешно удален, приложение отображено');
                
                // Дополнительная проверка инициализации игр
                setTimeout(() => {
                  const gamesReadyAfter = checkGamesReady();
                  console.log(`[Loader] Статус игровых объектов после удаления: ${gamesReadyAfter ? 'готовы' : 'не готовы'}`);
                }, 500);
              } catch (innerError) {
                console.error('[Loader] Ошибка финальной обработки:', innerError);
              }
            }, CONFIG.FADE_DURATION);
          }
        } catch (timeoutError) {
          console.error('[Loader] Ошибка в таймауте удаления:', timeoutError);
          
          // Аварийное удаление загрузочного экрана при ошибке
          if (loadingOverlay) loadingOverlay.style.display = 'none';
          if (appContent) appContent.classList.add('loaded');
        }
      }, remainingTime);
    } catch (error) {
      console.error('[Loader] Ошибка удаления экрана загрузки:', error);
      
      // Аварийное удаление при любой ошибке
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (appContent) appContent.classList.add('loaded');
    }
  }
  
  // Проверка готовности игровых объектов
  function checkGamesReady() {
    // Проверяем наличие глобального хранилища игр
    if (window.GreenLightGames) {
      // Проверяем, зарегистрированы ли игры
      let gamesCount = 0;
      if (window.GreenLightGames.slotsGame) gamesCount++;
      if (window.GreenLightGames.rouletteGame) gamesCount++;
      if (window.GreenLightGames.guessNumberGame) gamesCount++;
      if (window.GreenLightGames.minerGame) gamesCount++;
      if (window.GreenLightGames.crushGame) gamesCount++;
      
      console.log(`[Loader] Зарегистрировано игр: ${gamesCount}/5`);
      
      // Если хотя бы одна игра зарегистрирована, считаем что всё в порядке
      return gamesCount > 0;
    }
    
    // Проверка старым способом (обратная совместимость)
    const oldStyleGames = [
      { name: 'slotsGame', obj: window.slotsGame },
      { name: 'rouletteGame', obj: window.rouletteGame },
      { name: 'guessNumberGame', obj: window.guessNumberGame },
      { name: 'minerGame', obj: window.minerGame },
      { name: 'crushGame', obj: window.crushGame }
    ];
    
    const availableGames = oldStyleGames.filter(game => typeof game.obj === 'object' && game.obj !== null);
    console.log(`[Loader] Доступно игр (старый стиль): ${availableGames.length}/5`);
    
    // Если хотя бы одна игра доступна, считаем что всё в порядке
    return availableGames.length > 0;
  }
  
  // Метод для вывода диагностики игр  
  function logGamesDiagnostics() {
    console.log('[Loader] Диагностика игровых объектов:');
    
    // Проверяем новый стиль
    if (window.GreenLightGames) {
      console.log('GreenLightGames:', {
        slotsGame: !!window.GreenLightGames.slotsGame,
        rouletteGame: !!window.GreenLightGames.rouletteGame,
        guessNumberGame: !!window.GreenLightGames.guessNumberGame,
        minerGame: !!window.GreenLightGames.minerGame,
        crushGame: !!window.GreenLightGames.crushGame
      });
    } else {
      console.log('GreenLightGames: не определено');
    }
    
    // Проверяем старый стиль
    console.log('Старый стиль:', {
      slotsGame: typeof window.slotsGame,
      rouletteGame: typeof window.rouletteGame,
      guessNumberGame: typeof window.guessNumberGame,
      minerGame: typeof window.minerGame,
      crushGame: typeof window.crushGame
    });
  }
  
  // Экспортируем методы для вызова из main.js и других скриптов
  window.appLoader = {
    // Метод, который main.js может вызвать при успешной загрузке
    mainReady: function() {
      console.log('[Loader] Получено уведомление о готовности main.js');
      mainInitialized = true;
      
      // Выводим диагностику перед удалением экрана загрузки
      logGamesDiagnostics();
      
      // Удаляем экран загрузки
      removeLoadingScreen();
    },
    
    // Метод для обновления прогресса из main.js
    updateProgress: updateProgress,
    
    // Метод для ручной проверки игровых объектов
    checkGames: function() {
      console.log('[Loader] Запрошена проверка доступности игровых объектов');
      const status = checkGamesReady();
      logGamesDiagnostics();
      return status;
    },
    
    // Метод для принудительного удаления экрана загрузки
    forceRemoveLoading: function() {
      console.log('[Loader] Принудительное удаление экрана загрузки');
      removeLoadingScreen();
    }
  };
  
  // Резервный таймер для удаления экрана загрузки
  function setupEmergencyTimer() {
    setTimeout(() => {
      if (!loadingRemoved) {
        console.warn('[Loader] Сработал аварийный таймер! main.js не смог завершить загрузку');
        logGamesDiagnostics(); // Выводим диагностику перед принудительным удалением
        removeLoadingScreen();
      }
    }, CONFIG.EMERGENCY_TIMEOUT);
  }
  
  // Начинаем процесс загрузки
  function startLoading() {
    if (initLoader()) {
      console.log('[Loader] Запуск контрольного таймера:', CONFIG.EMERGENCY_TIMEOUT + 'мс');
      setupEmergencyTimer();
      
      // Обработка события полной загрузки страницы
      window.addEventListener('load', function() {
        console.log('[Loader] Событие window.load получено');
        
        // Даем дополнительное время для работы main.js
        setTimeout(() => {
          if (!loadingRemoved) {
            console.warn('[Loader] Экран загрузки все еще присутствует после window.load');
            logGamesDiagnostics(); // Выводим диагностику перед удалением экрана
            removeLoadingScreen();
          }
        }, 1000); // Дополнительная секунда для main.js
      });
    } else {
      // Если не получилось инициализировать, просто запускаем таймер
      console.error('[Loader] Аварийная инициализация');
      setupEmergencyTimer();
    }
  }
  
  // Запускаем загрузчик
  startLoading();
})();