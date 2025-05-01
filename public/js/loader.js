/**
 * loader.js - Улучшенная система управления экраном загрузки 
 * Версия 2.0.0
 */

(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Loader', 'Инициализация улучшенной системы загрузки v2.0.0');
  
  // Конфигурация загрузчика
  const CONFIG = {
      // Максимальное время загрузки (мс)
      MAX_LOADING_TIME: 10000,
      
      // Интервал проверки состояния (мс)
      CHECK_INTERVAL: 1000,
      
      // Время анимации скрытия (мс)
      FADE_DURATION: 300,
      
      // Минимальное время показа экрана загрузки (мс)
      MIN_DISPLAY_TIME: 1000
  };
  
  // Элементы DOM
  let elements = {
      loadingOverlay: null,
      progressBar: null,
      appContent: null,
      welcomeScreen: null,
      loadingDebug: null
  };
  
  // Состояние загрузчика
  let state = {
      loadingRemoved: false,
      startTime: Date.now(),
      lastPercent: 0,
      checkInterval: null,
      emergencyTimeout: null
  };
  
  // Инициализация загрузчика
  function init() {
      try {
          app.log('Loader', 'Инициализация компонентов загрузчика');
          
          // Получаем ссылки на DOM элементы
          elements.loadingOverlay = document.getElementById('loadingOverlay');
          elements.progressBar = document.getElementById('progress-bar');
          elements.appContent = document.getElementById('app-content');
          elements.welcomeScreen = document.getElementById('welcome-screen');
          elements.loadingDebug = document.getElementById('loading-debug');
          
          // Проверяем наличие критических элементов
          if (!elements.loadingOverlay) {
              app.log('Loader', 'Критическая ошибка: элемент loadingOverlay не найден', true);
              return false;
          }
          
          if (!elements.progressBar) {
              app.log('Loader', 'Предупреждение: элемент progress-bar не найден');
          }
          
          // Устанавливаем начальную позицию прогресса
          updateProgress(20);
          
          // Устанавливаем интервал для проверки состояния загрузки
          setupStatusChecker();
          
          // Устанавливаем аварийный таймер
          setupEmergencyRemoval();
          
          return true;
          
      } catch (error) {
          app.log('Loader', `Ошибка инициализации загрузчика: ${error.message}`, true);
          // Аварийное удаление загрузочного экрана
          forceRemoveLoadingScreen();
          return false;
      }
  }
  
  // Установка интервала проверки состояния
  function setupStatusChecker() {
      state.checkInterval = setInterval(() => {
          try {
              const elapsedTime = Date.now() - state.startTime;
              
              // Обновляем отладочную информацию
              if (elements.loadingDebug) {
                  const loadingStatus = {
                      time: Math.round(elapsedTime / 1000) + 'c',
                      scripts: app.loading.scriptsLoaded ? 'OK' : 'Loading',
                      main: app.loading.mainInitialized ? 'OK' : 'Pending',
                      tg: app.loading.telegramInitialized ? 'OK' : 'Pending'
                  };
                  
                  elements.loadingDebug.textContent = 
                      `Время: ${loadingStatus.time} | ` +
                      `Скрипты: ${loadingStatus.scripts} | ` +
                      `Осн. модуль: ${loadingStatus.main} | ` +
                      `Telegram: ${loadingStatus.tg}`;
              }
              
              // Автоматическое обновление прогресса на основе состояния
              autoUpdateProgress();
              
              // Проверяем, пора ли удалить экран загрузки
              if (app.loading.mainInitialized && app.loading.uiReady) {
                  app.log('Loader', 'Основной модуль и UI готовы, удаляем экран загрузки');
                  clearInterval(state.checkInterval);
                  hideLoadingScreen();
              }
              
              // Проверяем, не истекло ли максимальное время
              if (elapsedTime > CONFIG.MAX_LOADING_TIME) {
                  app.log('Loader', 'Превышено максимальное время загрузки', true);
                  clearInterval(state.checkInterval);
                  forceRemoveLoadingScreen();
              }
          } catch (error) {
              app.log('Loader', `Ошибка в интервале проверки: ${error.message}`, true);
              clearInterval(state.checkInterval);
          }
      }, CONFIG.CHECK_INTERVAL);
  }
  
  // Установка аварийного таймера
  function setupEmergencyRemoval() {
      state.emergencyTimeout = setTimeout(() => {
          if (!state.loadingRemoved) {
              app.log('Loader', 'Сработал аварийный таймер удаления', true);
              forceRemoveLoadingScreen();
          }
      }, CONFIG.MAX_LOADING_TIME);
  }
  
  // Автоматическое обновление прогресса
  function autoUpdateProgress() {
      let percent = 0;
      
      // Добавляем прогресс за счет времени (максимум 50%)
      const elapsedTime = Date.now() - state.startTime;
      const timePercent = Math.min(50, Math.floor((elapsedTime / CONFIG.MAX_LOADING_TIME) * 100));
      percent += timePercent;
      
      // Добавляем прогресс за этапы загрузки
      if (app.loading.scriptsLoaded) percent += 10;
      if (app.loading.telegramInitialized) percent += 10;
      if (app.loading.mainInitialized) percent += 20;
      if (app.loading.uiReady) percent += 10;
      
      // Не уменьшаем процент
      percent = Math.max(state.lastPercent, percent);
      state.lastPercent = percent;
      
      // Обновляем индикатор прогресса
      updateProgress(percent);
  }
  
  // Обновление индикатора прогресса
  function updateProgress(percent) {
      if (!elements.progressBar) return;
      
      try {
          elements.progressBar.style.width = Math.min(100, percent) + '%';
      } catch (error) {
          app.log('Loader', `Ошибка обновления прогресса: ${error.message}`, true);
      }
  }
  
  // Плавное скрытие экрана загрузки
  function hideLoadingScreen() {
      if (state.loadingRemoved) return;
      
      try {
          app.log('Loader', 'Начинаем плавное удаление экрана загрузки');
          
          state.loadingRemoved = true;
          clearTimeout(state.emergencyTimeout);
          
          // Проверяем минимальное время отображения
          const elapsedTime = Date.now() - state.startTime;
          const remainingTime = Math.max(0, CONFIG.MIN_DISPLAY_TIME - elapsedTime);
          
          // Показываем 100% прогресс
          updateProgress(100);
          
          setTimeout(() => {
              try {
                  // Запускаем анимацию скрытия
                  if (elements.loadingOverlay) {
                      elements.loadingOverlay.style.opacity = '0';
                      
                      setTimeout(() => {
                          try {
                              // Полностью скрываем элемент
                              if (elements.loadingOverlay) {
                                  elements.loadingOverlay.style.display = 'none';
                              }
                              
                              // Показываем содержимое приложения
                              if (elements.appContent) {
                                  elements.appContent.classList.add('loaded');
                              }
                              
                              app.log('Loader', 'Экран загрузки успешно удален');
                              
                          } catch (fadeError) {
                              app.log('Loader', `Ошибка финальной фазы скрытия: ${fadeError.message}`, true);
                              forceRemoveLoadingScreen();
                          }
                      }, CONFIG.FADE_DURATION);
                  }
              } catch (error) {
                  app.log('Loader', `Ошибка анимации скрытия: ${error.message}`, true);
                  forceRemoveLoadingScreen();
              }
          }, remainingTime);
          
      } catch (error) {
          app.log('Loader', `Общая ошибка скрытия экрана загрузки: ${error.message}`, true);
          forceRemoveLoadingScreen();
      }
  }
  
  // Принудительное удаление экрана загрузки
  function forceRemoveLoadingScreen() {
      try {
          app.log('Loader', 'Принудительное удаление экрана загрузки');
          
          // Предотвращаем повторное выполнение
          if (state.loadingRemoved) return;
          state.loadingRemoved = true;
          
          // Очищаем все таймеры
          clearInterval(state.checkInterval);
          clearTimeout(state.emergencyTimeout);
          
          // Скрываем загрузочный экран без анимации
          if (elements.loadingOverlay) {
              elements.loadingOverlay.style.display = 'none';
          }
          
          // Показываем контент приложения
          if (elements.appContent) {
              elements.appContent.classList.add('loaded');
          }
          
          // Активируем welcome-screen
          if (elements.welcomeScreen) {
              document.querySelectorAll('.screen').forEach(screen => {
                  screen.classList.remove('active');
              });
              elements.welcomeScreen.classList.add('active');
          }
          
          app.log('Loader', 'Загрузочный экран принудительно удален');
          
      } catch (error) {
          app.log('Loader', `Ошибка в принудительном удалении: ${error.message}`, true);
          
          // Крайнее аварийное удаление без обработки ошибок
          const loadingEl = document.getElementById('loadingOverlay');
          const contentEl = document.getElementById('app-content');
          
          if (loadingEl) loadingEl.style.display = 'none';
          if (contentEl) contentEl.classList.add('loaded');
      }
  }
  
  // Публичные методы
  window.appLoader = {
      // Уведомление о готовности основного модуля
      mainReady: function() {
          app.log('Loader', 'Получено уведомление о готовности основного модуля');
          app.loading.mainInitialized = true;
          
          updateProgress(70);
          
          // Проверяем, готовы ли все компоненты
          if (app.loading.uiReady) {
              hideLoadingScreen();
          }
      },
      
      // Уведомление о готовности UI
      uiReady: function() {
          app.log('Loader', 'Получено уведомление о готовности UI');
          app.loading.uiReady = true;
          
          updateProgress(80);
          
          // Проверяем, готовы ли все компоненты
          if (app.loading.mainInitialized) {
              hideLoadingScreen();
          }
      },
      
      // Обновление прогресса из других модулей
      updateProgress: updateProgress,
      
      // Принудительное скрытие экрана загрузки
      forceRemoveLoading: forceRemoveLoadingScreen,
      
      // Статус загрузчика
      getStatus: function() {
          return {
              initialized: !!elements.loadingOverlay,
              loadingRemoved: state.loadingRemoved,
              elapsedTime: Date.now() - state.startTime
          };
      }
  };
  
  // Запускаем инициализацию загрузчика
  if (!init()) {
      app.log('Loader', 'Ошибка инициализации, принудительное удаление через 1 секунду', true);
      setTimeout(forceRemoveLoadingScreen, 1000);
  }
  
})();