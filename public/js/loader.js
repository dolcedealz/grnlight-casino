// Улучшенный loader.js со стабильным поведением и подробным логированием

console.log('[Loader] Инициализация улучшенного загрузчика');

(function() {
  // Переменная для отслеживания состояния загрузчика
  let loaderRemoved = false;
  
  // Создание загрузочного экрана (если его еще нет)
  const createLoadingOverlay = () => {
    console.log('[Loader] Создание оверлея загрузки');
    
    // Проверяем, существует ли уже оверлей
    let overlay = document.getElementById('loadingOverlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.id = 'loadingOverlay';
      
      // Создаем спиннер
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      
      // Создаем текст загрузки
      const loadingText = document.createElement('div');
      loadingText.className = 'loading-text';
      loadingText.textContent = 'Loading Greenlight Casino...';
      
      // Добавляем элементы
      overlay.appendChild(spinner);
      overlay.appendChild(loadingText);
      
      // Убедимся, что body существует
      if (document.body) {
        document.body.appendChild(overlay);
        console.log('[Loader] Оверлей загрузки добавлен в DOM');
      } else {
        console.error('[Loader] Не могу найти body для добавления оверлея');
        // Попробуем добавить позже, когда DOM будет готов
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(overlay);
          console.log('[Loader] Оверлей загрузки добавлен в DOM после DOMContentLoaded');
        });
      }
    } else {
      console.log('[Loader] Оверлей загрузки уже существует');
    }
    
    return overlay;
  };
  
  // Удаление загрузочного экрана с доп. проверками
  const removeLoadingOverlay = (reason) => {
    if (loaderRemoved) {
      console.log(`[Loader] Попытка повторного удаления оверлея (причина: ${reason}), игнорирую`);
      return;
    }
    
    console.log(`[Loader] Удаление оверлея загрузки (причина: ${reason})`);
    
    // Помечаем, что мы уже запустили процесс удаления
    loaderRemoved = true;
    
    try {
      const overlay = document.getElementById('loadingOverlay');
      
      if (overlay) {
        // Скрываем сначала через opacity для плавного исчезновения
        overlay.style.opacity = '0';
        
        setTimeout(() => {
          try {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
              console.log('[Loader] Оверлей успешно удален');
            } else {
              console.warn('[Loader] У оверлея нет родителя, возможно он уже удален');
            }
          } catch (e) {
            console.error('[Loader] Ошибка при удалении оверлея:', e);
            
            // Крайний случай - просто скрываем его
            if (overlay) overlay.style.display = 'none';
          }
        }, 500);
      } else {
        console.warn('[Loader] Оверлей не найден при попытке удаления');
      }
      
      // Проверяем видимость главного экрана
      checkMainScreenVisibility();
    } catch (e) {
      console.error('[Loader] Критическая ошибка при удалении оверлея:', e);
      
      // Пытаемся в любом случае скрыть все элементы loading-overlay
      try {
        document.querySelectorAll('.loading-overlay').forEach(el => {
          el.style.display = 'none';
        });
      } catch (err) {
        // Ничего не делаем, это последняя попытка
      }
    }
  };
  
  // Проверка видимости главного экрана
  const checkMainScreenVisibility = () => {
    console.log('[Loader] Проверка видимости главного экрана');
    
    // Ищем активный экран
    const activeScreen = document.querySelector('.screen.active');
    
    if (!activeScreen) {
      console.warn('[Loader] Активный экран не найден, пытаюсь показать welcome-screen');
      
      // Пытаемся активировать welcome-screen
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        // Сначала скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        
        // Показываем welcome-screen
        welcomeScreen.classList.add('active');
        console.log('[Loader] welcome-screen активирован');
      } else {
        console.error('[Loader] welcome-screen не найден');
      }
    } else {
      console.log('[Loader] Активный экран найден:', activeScreen.id);
    }
  };
  
  // Инициализация обработчиков событий для удаления экрана загрузки
  const initRemovalHandlers = () => {
    console.log('[Loader] Инициализация обработчиков удаления');
    
    // 1. Гарантированное удаление после максимального времени загрузки (8 секунд)
    console.log('[Loader] Установка таймера принудительного удаления (8 сек)');
    const timeoutId = setTimeout(() => {
      console.log('[Loader] Сработал таймер максимального времени загрузки');
      removeLoadingOverlay('timeout');
    }, 8000);
    
    // 2. Удаление после события load
    console.log('[Loader] Установка обработчика события window.load');
    window.addEventListener('load', () => {
      console.log('[Loader] Событие window.load сработало');
      // Небольшая задержка для завершения инициализации компонентов
      setTimeout(() => {
        removeLoadingOverlay('window_load');
        clearTimeout(timeoutId); // Очищаем таймер максимального времени
      }, 1000);
    });
    
    // 3. Удаление после DOMContentLoaded + проверка активности экрана
    console.log('[Loader] Установка обработчика события DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Loader] Событие DOMContentLoaded сработало');
      
      // Даем время на инициализацию скриптов
      setTimeout(() => {
        if (!loaderRemoved) {
          console.log('[Loader] Проверка после DOMContentLoaded + 3 сек');
          const casinoApp = window.casinoApp;
          const activeScreen = document.querySelector('.screen.active');
          
          if (casinoApp && activeScreen) {
            console.log('[Loader] Приложение инициализировано, экран активен');
            removeLoadingOverlay('dom_ready_success');
          } else {
            console.warn('[Loader] После DOMContentLoaded: casinoApp:', !!casinoApp, 'активный экран:', !!activeScreen);
            
            // Если через 5 секунд после DOMContentLoaded по-прежнему нет активного экрана
            if (!activeScreen) {
              checkMainScreenVisibility();
            }
            
            // Но в любом случае удаляем загрузчик
            setTimeout(() => {
              if (!loaderRemoved) {
                console.warn('[Loader] Принудительное удаление после DOMContentLoaded + 5 сек');
                removeLoadingOverlay('dom_ready_forced');
              }
            }, 2000);
          }
        }
      }, 3000);
    });
    
    // 4. Слушаем ошибки и логируем их для отладки
    console.log('[Loader] Установка глобального обработчика ошибок');
    window.addEventListener('error', (event) => {
      console.error('[Loader] Перехвачена ошибка:', event.error);
      console.error('[Loader] Сообщение:', event.message);
      console.error('[Loader] Источник:', event.filename, 'Строка:', event.lineno, 'Символ:', event.colno);
      
      // Не удаляем загрузчик при ошибках, пусть сработает таймер
    });
  };
  
  // Проверка загрузки ключевых скриптов
  const checkScriptsLoaded = () => {
    console.log('[Loader] Проверка загрузки ключевых скриптов');
    
    // Создаем массив для отслеживания загрузки скриптов
    const scriptsToCheck = [
      { url: 'js/main.js', loaded: false },
      { url: 'js/games/slots.js', loaded: false },
      { url: 'js/games/roulette.js', loaded: false },
      { url: 'js/games/guessnumber.js', loaded: false },
      { url: 'js/games/miner.js', loaded: false },
      { url: 'js/games/crush.js', loaded: false }
    ];
    
    // Проверяем существующие скрипты в DOM
    const loadedScripts = Array.from(document.querySelectorAll('script')).map(s => s.src);
    console.log('[Loader] Загруженные скрипты:', loadedScripts);
    
    // Обновляем статус загрузки
    scriptsToCheck.forEach(script => {
      const isLoaded = loadedScripts.some(src => src.includes(script.url));
      script.loaded = isLoaded;
      console.log(`[Loader] Скрипт ${script.url} ${isLoaded ? 'загружен' : 'не загружен'}`);
    });
    
    // Проверяем загрузку всех скриптов
    const allLoaded = scriptsToCheck.every(script => script.loaded);
    console.log(`[Loader] Все скрипты ${allLoaded ? 'загружены' : 'не загружены'}`);
    
    return allLoaded;
  };
  
  // Инициализация загрузчика
  const initLoader = () => {
    console.log('[Loader] Инициализация загрузчика');
    
    try {
      // Создаем оверлей загрузки
      createLoadingOverlay();
      
      // Инициализируем обработчики для удаления оверлея
      initRemovalHandlers();
      
      // Дополнительная проверка загрузки скриптов после DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          checkScriptsLoaded();
        }, 1000);
      });
      
      console.log('[Loader] Загрузчик успешно инициализирован');
    } catch (error) {
      console.error('[Loader] Критическая ошибка при инициализации загрузчика:', error);
      
      // В случае критической ошибки, удаляем загрузчик через 10 секунд
      setTimeout(() => {
        if (!loaderRemoved) {
          console.warn('[Loader] Аварийное удаление загрузчика');
          removeLoadingOverlay('critical_error');
        }
      }, 10000);
    }
  };
  
  // Запускаем инициализацию загрузчика
  initLoader();
})();