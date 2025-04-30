// Enhanced loader.js - надежная система удаления загрузочного экрана
console.log('[Loader] Запущен улучшенный загрузчик');

(function() {
  // Настройки загрузчика
  const CONFIG = {
    // Время до принудительного удаления экрана загрузки (мс)
    EMERGENCY_TIMEOUT: 4000,
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
  
  // Экспортируем метод для вызова из main.js
  window.appLoader = {
    // Метод, который main.js может вызвать при успешной загрузке
    mainReady: function() {
      console.log('[Loader] Получено уведомление о готовности main.js');
      mainInitialized = true;
      removeLoadingScreen();
    },
    
    // Метод для обновления прогресса из main.js
    updateProgress: updateProgress
  };
  
  // Резервный таймер для удаления экрана загрузки
  function setupEmergencyTimer() {
    setTimeout(() => {
      if (!loadingRemoved) {
        console.warn('[Loader] Сработал аварийный таймер! main.js не смог завершить загрузку');
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