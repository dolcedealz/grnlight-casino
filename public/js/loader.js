// Усовершенствованный loader.js с гарантированной загрузкой для Greenlight Casino
console.log('[Loader] Начало загрузки приложения');

(function() {
  // Отслеживание состояния загрузки
  let isLoaderRemoved = false;
  let jsScriptsLoaded = false;
  let domInitialized = false;
  
  // Базовые проверки проблем загрузки
  let checkInterval;
  let loadingTimeoutId;
  
  // Создание экрана загрузки (или использование существующего)
  const setupLoadingScreen = () => {
    console.log('[Loader] Настройка экрана загрузки');
    
    // Проверяем, существует ли уже экран загрузки
    let loadingOverlay = document.getElementById('loadingOverlay');
    
    if (!loadingOverlay) {
      console.log('[Loader] Создание экрана загрузки');
      
      // Создаем структуру загрузочного экрана
      loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.id = 'loadingOverlay';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      
      const loadingText = document.createElement('div');
      loadingText.className = 'loading-text';
      loadingText.textContent = 'Loading Greenlight Casino...';
      
      loadingOverlay.appendChild(spinner);
      loadingOverlay.appendChild(loadingText);
      
      // Добавляем в DOM, если body уже доступен
      if (document.body) {
        document.body.appendChild(loadingOverlay);
      } else {
        // Добавляем обработчик, если body еще не создан
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body && !document.getElementById('loadingOverlay')) {
            document.body.appendChild(loadingOverlay);
          }
        });
      }
    } else {
      console.log('[Loader] Экран загрузки уже существует');
    }
    
    return loadingOverlay;
  };
  
  // Удаление экрана загрузки
  const removeLoadingScreen = (reason) => {
    if (isLoaderRemoved) {
      console.log(`[Loader] Повторный вызов удаления (причина: ${reason}), игнорируем`);
      return;
    }
    
    console.log(`[Loader] Удаление экрана загрузки (причина: ${reason})`);
    isLoaderRemoved = true;
    
    try {
      // Очищаем все таймеры
      clearTimeout(loadingTimeoutId);
      clearInterval(checkInterval);
      
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        // Плавное скрытие
        loadingOverlay.style.opacity = '0';
        
        setTimeout(() => {
          try {
            if (loadingOverlay.parentNode) {
              loadingOverlay.parentNode.removeChild(loadingOverlay);
              console.log('[Loader] Экран загрузки успешно удален');
            }
          } catch (e) {
            console.error('[Loader] Ошибка при удалении экрана загрузки:', e);
            // Просто скрываем, если не можем удалить
            loadingOverlay.style.display = 'none';
          }
        }, 500);
      } else {
        console.warn('[Loader] Экран загрузки не найден при попытке удаления');
      }
      
      // Проверка видимости главного экрана и активация при необходимости
      activateMainScreen();
    } catch (error) {
      console.error('[Loader] Критическая ошибка при удалении экрана загрузки:', error);
      
      // Экстренное скрытие всех элементов с классом loading-overlay
      try {
        document.querySelectorAll('.loading-overlay').forEach(el => {
          el.style.display = 'none';
        });
      } catch (e) {
        // Ничего не делаем - последний рубеж защиты
      }
    }
  };
  
  // Проверка и активация основного экрана
  const activateMainScreen = () => {
    console.log('[Loader] Проверка основного экрана');
    
    try {
      const activeScreen = document.querySelector('.screen.active');
      
      if (!activeScreen) {
        console.warn('[Loader] Активный экран не найден, активируем welcome-screen');
        
        // Находим welcome-screen
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
          // Деактивируем все экраны
          document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
          });
          
          // Активируем welcome-screen
          welcomeScreen.classList.add('active');
          console.log('[Loader] welcome-screen активирован');
        } else {
          console.error('[Loader] welcome-screen не найден');
        }
      } else {
        console.log('[Loader] Активный экран найден:', activeScreen.id);
      }
    } catch (error) {
      console.error('[Loader] Ошибка при активации экрана:', error);
    }
  };
  
  // Проверка загрузки JS файлов
  const checkJsFilesLoaded = () => {
    console.log('[Loader] Проверка загрузки JS файлов');
    
    try {
      // Проверяем ключевые объекты
      const mainLoaded = typeof window.casinoApp !== 'undefined';
      const slotsLoaded = typeof window.slotsGame !== 'undefined';
      const rouletteLoaded = typeof window.rouletteGame !== 'undefined';
      const guessNumberLoaded = typeof window.guessNumberGame !== 'undefined';
      const minerLoaded = typeof window.minerGame !== 'undefined';
      const crushLoaded = typeof window.crushGame !== 'undefined';
      
      console.log('[Loader] Статус загрузки JS компонентов:', {
        main: mainLoaded,
        slots: slotsLoaded,
        roulette: rouletteLoaded,
        guessNumber: guessNumberLoaded,
        miner: minerLoaded,
        crush: crushLoaded
      });
      
      // Если основной объект casinoApp загружен, считаем это успехом
      if (mainLoaded) {
        jsScriptsLoaded = true;
        console.log('[Loader] Основной модуль приложения загружен');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Loader] Ошибка при проверке JS файлов:', error);
      return false;
    }
  };
  
  // Проверка инициализации DOM
  const isDomInitialized = () => {
    try {
      const welcomeScreen = document.getElementById('welcome-screen');
      const gameCards = document.querySelectorAll('.game-card');
      const balanceDisplay = document.getElementById('balance-amount');
      
      // Считаем DOM инициализированным, если найдены ключевые элементы
      const initialized = welcomeScreen && gameCards.length > 0 && balanceDisplay;
      
      if (initialized && !domInitialized) {
        domInitialized = true;
        console.log('[Loader] DOM инициализирован');
      }
      
      return initialized;
    } catch (error) {
      console.error('[Loader] Ошибка при проверке DOM:', error);
      return false;
    }
  };
  
  // Периодическая проверка загрузки
  const startLoadingChecks = () => {
    let checkCount = 0;
    
    checkInterval = setInterval(() => {
      checkCount++;
      
      // Проверяем инициализацию DOM и загрузку скриптов
      const domReady = isDomInitialized();
      const scriptsReady = checkJsFilesLoaded();
      
      console.log(`[Loader] Проверка #${checkCount}: DOM=${domReady}, Scripts=${scriptsReady}`);
      
      // Если всё готово, удаляем загрузчик
      if (domReady && scriptsReady) {
        removeLoadingScreen('check_success');
        clearInterval(checkInterval);
      }
      
      // Если что-то не загрузилось после 10 попыток, принимаем экстренные меры
      if (checkCount >= 10) {
        console.warn('[Loader] Достигнут лимит проверок, применяем экстренные меры');
        
        // Если основные сценарии загружены, но DOM не инициализирован, 
        // пытаемся активировать главный экран
        if (scriptsReady && !domReady) {
          activateMainScreen();
        }
        
        // В любом случае удаляем экран загрузки
        removeLoadingScreen('max_checks');
        clearInterval(checkInterval);
      }
    }, 1000); // Проверка каждую секунду
  };
  
  // Основная функция инициализации загрузчика
  const initializeLoader = () => {
    console.log('[Loader] Инициализация загрузчика');
    
    try {
      // Настраиваем экран загрузки
      setupLoadingScreen();
      
      // Устанавливаем максимальное время ожидания (8 секунд)
      console.log('[Loader] Установка таймера принудительного удаления (8 сек)');
      loadingTimeoutId = setTimeout(() => {
        console.log('[Loader] Сработал таймер максимального времени ожидания');
        removeLoadingScreen('timeout');
      }, 8000);
      
      // Запускаем периодические проверки загрузки
      startLoadingChecks();
      
      // Подписываемся на основные события загрузки
      window.addEventListener('load', () => {
        console.log('[Loader] Событие window.load сработало');
        
        // Через небольшую задержку проверяем состояние
        setTimeout(() => {
          if (!isLoaderRemoved) {
            console.log('[Loader] Проверка инициализации после window.load');
            const domReady = isDomInitialized();
            const scriptsReady = checkJsFilesLoaded();
            
            if (domReady && scriptsReady) {
              removeLoadingScreen('window_load_success');
            } else {
              // Даем еще 2 секунды и затем принудительно удаляем загрузчик
              setTimeout(() => {
                if (!isLoaderRemoved) {
                  removeLoadingScreen('window_load_timeout');
                }
              }, 2000);
            }
          }
        }, 1000);
      });
      
      // Обработка случаев, когда DOMContentLoaded произошел раньше
      if (document.readyState === 'interactive' || document.readyState === 'complete') {
        console.log('[Loader] Документ уже загружен, проверяем состояние');
        
        setTimeout(() => {
          if (!isLoaderRemoved) {
            const domReady = isDomInitialized();
            const scriptsReady = checkJsFilesLoaded();
            
            if (domReady && scriptsReady) {
              removeLoadingScreen('document_already_loaded');
            }
          }
        }, 1000);
      } else {
        // Подписываемся на событие загрузки DOM
        document.addEventListener('DOMContentLoaded', () => {
          console.log('[Loader] Событие DOMContentLoaded сработало');
          
          // Даем время для выполнения скриптов
          setTimeout(() => {
            if (!isLoaderRemoved) {
              const domReady = isDomInitialized();
              const scriptsReady = checkJsFilesLoaded();
              
              if (domReady && scriptsReady) {
                removeLoadingScreen('dom_content_loaded');
              }
            }
          }, 2000);
        });
      }
      
      // Обработка глобальных ошибок
      window.addEventListener('error', (event) => {
        console.error('[Loader] Перехвачена ошибка:', {
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno
        });
        
        // Не удаляем загрузчик при ошибках, позволяем таймеру сработать
      });
    } catch (error) {
      console.error('[Loader] Критическая ошибка при инициализации загрузчика:', error);
      
      // Устанавливаем таймер аварийного завершения
      setTimeout(() => {
        if (!isLoaderRemoved) {
          removeLoadingScreen('critical_error');
        }
      }, 5000);
    }
  };
  
  // Запуск загрузчика
  initializeLoader();
})();