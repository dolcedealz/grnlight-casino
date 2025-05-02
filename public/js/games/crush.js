/**
 * crush.js - Оптимизированная версия игры Crush с общим графиком для всех игроков
 * Версия 3.5.0
 * 
 * Особенности:
 * - Общий график и история для всех игроков
 * - 10-секундная пауза между раундами
 * - Неблокирующая инициализация (стандартная система)
 * - Улучшенная обработка ошибок с таймаутами
 * - Изолированное состояние игры
 * - Автоматические ставки и выход
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[Crush] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Crush', 'Инициализация модуля игры Crush v3.5.0 с общим графиком');
  
  // Игровая логика в замыкании для изоляции
  const crushGame = (function() {
      // Элементы игры
      let elements = {
          startBtn: null,
          cashoutBtn: null,
          crushBet: null,
          multiplierDisplay: null,
          crushGraph: null,
          crushResult: null,
          container: null,
          autoEnabled: null,
          autoCashoutAt: null,
          nextRoundTimer: null,
          bettingPhaseInfo: null,
          currentPhaseDisplay: null
      };
      
      // Canvas для графика
      let graphCanvas = null;
      let graphCtx = null;
      
      // Глобальное состояние игры (общее для всех игроков)
      let globalState = {
          isActiveRound: false,        // Активен ли в данный момент раунд игры
          isWaitingForNextRound: false, // Ожидание следующего раунда
          waitingTimeLeft: 0,          // Оставшееся время ожидания в секундах
          currentMultiplier: 1.0,      // Текущий множитель (общий для всех)
          crashPoint: 1.0,             // Точка краша (общая для всех)
          roundStartTime: 0,           // Время начала текущего раунда
          graphPoints: [],             // Точки графика (общие для всех)
          gameHistory: [],             // История игр (общая для всех)
          roundId: 0,                  // Идентификатор текущего раунда
          roundTimerInterval: null,    // Интервал для обновления таймера между раундами
          gameInterval: null           // Интервал для обновления игры
      };
      
      // Индивидуальное состояние пользователя
      let userState = {
          initialized: false,           // Инициализирована ли игра
          initializationStarted: false, // Начата ли инициализация
          hasBetInCurrentRound: false,  // Сделана ли ставка в текущем раунде
          betAmount: 0,                 // Размер ставки пользователя
          isAutoCashoutEnabled: false,  // Включен ли автоматический выход
          autoCashoutMultiplier: 2.0,   // Множитель для автоматического выхода
          hasCollectedWin: false        // Собран ли выигрыш в текущем раунде
      };
      
      // Константы игры
      const WAITING_TIME_BETWEEN_ROUNDS = 10; // 10 секунд между раундами
      const MAX_HISTORY_SIZE = 10;            // Максимальный размер истории
      const GAME_UPDATE_INTERVAL = 30;        // Интервал обновления игры (мс)
      const TIMER_UPDATE_INTERVAL = 500;      // Интервал обновления таймера (мс)
      
      /**
       * Инициализация игры
       * С защитой от повторной инициализации и таймаутом
       */
      const init = async function() {
          // Предотвращаем повторную инициализацию
          if (userState.initialized || userState.initializationStarted) {
              app.log('Crush', 'Инициализация уже выполнена или выполняется');
              return true;
          }
          
          userState.initializationStarted = true;
          app.log('Crush', 'Начало инициализации игры');
          
          try {
              // Устанавливаем таймаут для инициализации
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Получаем элементы DOM (с проверкой наличия)
                      await findDOMElements();
                      
                      // Создаем контейнер для игры, если он не существует
                      createGameContainer();
                      
                      // Создаем необходимые элементы UI
                      setupUI();
                      
                      // Настраиваем canvas для графика
                      setupCanvas();
                      
                      // Добавляем обработчики событий
                      setupEventListeners();
                      
                      // Сбрасываем график
                      resetGraph();
                      
                      // Генерируем начальную историю игр, если она пуста
                      if (globalState.gameHistory.length === 0) {
                          loadHistory();
                      }
                      
                      // Инициализируем таймер между раундами, если игра не активна
                      if (!globalState.isActiveRound && !globalState.isWaitingForNextRound) {
                          startWaitingForNextRound();
                      }
                      
                      // Скрываем результат
                      if (elements.crushResult) {
                          elements.crushResult.style.display = 'none';
                      }
                      
                      // Обновляем отображение текущего состояния игры
                      updateGamePhaseDisplay();
                      
                      userState.initialized = true;
                      app.log('Crush', 'Инициализация успешно завершена');
                      resolve(true);
                  } catch (innerError) {
                      app.log('Crush', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Устанавливаем таймаут (3 секунды)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('Crush', 'Таймаут инициализации', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Используем Promise.race для предотвращения зависания
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('Crush', `Критическая ошибка инициализации: ${error.message}`, true);
              return false;
          }
      };
      
      /**
       * Поиск DOM элементов с защитой от null
       */
      const findDOMElements = async function() {
          // Используем Promise для асинхронности
          return new Promise((resolve, reject) => {
              try {
                  // Таймаут для ожидания готовности DOM
                  setTimeout(() => {
                      // Ищем существующие элементы
                      elements.startBtn = document.getElementById('start-crush-btn');
                      elements.cashoutBtn = document.getElementById('cash-crush-btn');
                      elements.crushBet = document.getElementById('crush-bet');
                      elements.multiplierDisplay = document.getElementById('multiplier');
                      elements.crushGraph = document.getElementById('crush-graph');
                      elements.crushResult = document.getElementById('crush-result');
                      elements.autoEnabled = document.getElementById('auto-enabled');
                      elements.autoCashoutAt = document.getElementById('auto-cashout-at');
                      elements.nextRoundTimer = document.getElementById('next-round-timer');
                      elements.bettingPhaseInfo = document.getElementById('betting-phase-info');
                      elements.currentPhaseDisplay = document.getElementById('current-phase');
                      
                      // Проверяем критические элементы
                      if (!elements.startBtn) {
                          app.log('Crush', 'Предупреждение: элемент start-crush-btn не найден', true);
                      }
                      
                      if (!elements.crushGraph) {
                          app.log('Crush', 'Предупреждение: элемент crush-graph не найден', true);
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('Crush', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Создание контейнера для игры (если необходимо)
       */
      const createGameContainer = function() {
          try {
              // Ищем существующий контейнер для игры Crush
              const crushScreen = document.getElementById('crush-screen');
              
              if (!crushScreen) {
                  app.log('Crush', 'Контейнер crush-screen не найден, не можем создать игру', true);
                  return;
              }
              
              // Проверяем, есть ли в нем уже контейнер для игры
              elements.container = crushScreen.querySelector('.crush-container');
              
              if (!elements.container) {
                  // Создаем контейнер для игры
                  const container = document.createElement('div');
                  container.className = 'crush-container';
                  crushScreen.appendChild(container);
                  elements.container = container;
                  app.log('Crush', 'Создан контейнер для игры');
              }
              
          } catch (error) {
              app.log('Crush', `Ошибка создания контейнера: ${error.message}`, true);
          }
      };
      
      /**
       * Настройка пользовательского интерфейса
       */
      const setupUI = function() {
          try {
              // Проверяем, создан ли уже интерфейс
              if (elements.container && elements.container.querySelector('#crush-graph')) {
                  app.log('Crush', 'Интерфейс уже создан');
                  return;
              }
              
              // Создаем HTML разметку для игры
              elements.container.innerHTML = `
                  <div class="game-phase-display">
                      <div id="current-phase" class="phase-indicator">Ожидание начала игры</div>
                      <div id="next-round-timer" class="round-timer">Следующий раунд через: <span class="time-value">10</span> сек.</div>
                  </div>
                  
                  <div class="game-controls">
                      <div class="bet-control">
                          <label for="crush-bet">Ставка:</label>
                          <input type="number" id="crush-bet" min="1" max="1000" value="10">
                      </div>
                      
                      <div class="multiplier-container">
                          <span>Множитель: <span id="multiplier" class="multiplier-value">1.00</span>x</span>
                      </div>
                      
                      <div id="betting-phase-info" class="betting-phase-info">
                          <p>Разместите вашу ставку до начала раунда!</p>
                      </div>
                      
                      <div id="auto-settings" class="auto-settings">
                          <div class="auto-option">
                              <input type="checkbox" id="auto-enabled">
                              <label for="auto-enabled">Авто-вывод при</label>
                              <input type="number" id="auto-cashout-at" min="1.1" step="0.1" value="2.0">x
                          </div>
                      </div>
                      
                      <div class="crush-buttons">
                          <button id="start-crush-btn" class="action-btn">СДЕЛАТЬ СТАВКУ</button>
                          <button id="cash-crush-btn" class="action-btn" disabled>ЗАБРАТЬ</button>
                      </div>
                  </div>
                  
                  <div id="crush-graph" class="crush-graph">
                      <!-- Canvas будет создан динамически -->
                  </div>
                  
                  <div class="crush-history">
                      <h3>История</h3>
                      <div class="history-items"></div>
                  </div>
                  
                  <div id="crush-result" class="result"></div>
              `;
              
              // Обновляем ссылки на элементы
              elements.startBtn = document.getElementById('start-crush-btn');
              elements.cashoutBtn = document.getElementById('cash-crush-btn');
              elements.crushBet = document.getElementById('crush-bet');
              elements.multiplierDisplay = document.getElementById('multiplier');
              elements.crushGraph = document.getElementById('crush-graph');
              elements.crushResult = document.getElementById('crush-result');
              elements.autoEnabled = document.getElementById('auto-enabled');
              elements.autoCashoutAt = document.getElementById('auto-cashout-at');
              elements.nextRoundTimer = document.getElementById('next-round-timer');
              elements.bettingPhaseInfo = document.getElementById('betting-phase-info');
              elements.currentPhaseDisplay = document.getElementById('current-phase');
              
              app.log('Crush', 'Интерфейс игры успешно создан');
          } catch (error) {
              app.log('Crush', `Ошибка создания интерфейса: ${error.message}`, true);
          }
      };
      
      /**
       * Настройка canvas для графика
       */
      const setupCanvas = function() {
          try {
              if (!elements.crushGraph) {
                  app.log('Crush', 'Элемент графика не найден, невозможно настроить canvas', true);
                  return;
              }
              
              // Проверяем, существует ли уже canvas
              let existingCanvas = elements.crushGraph.querySelector('canvas');
              if (existingCanvas) {
                  graphCanvas = existingCanvas;
                  graphCtx = graphCanvas.getContext('2d');
                  app.log('Crush', 'Использован существующий canvas');
                  return;
              }
              
              // Создаем новый canvas
              graphCanvas = document.createElement('canvas');
              graphCanvas.id = 'crush-canvas';
              graphCanvas.width = elements.crushGraph.clientWidth || 300;
              graphCanvas.height = elements.crushGraph.clientHeight || 200;
              elements.crushGraph.appendChild(graphCanvas);
              
              // Получаем контекст
              graphCtx = graphCanvas.getContext('2d');
              
              app.log('Crush', 'Canvas для графика успешно создан');
          } catch (error) {
              app.log('Crush', `Ошибка создания canvas: ${error.message}`, true);
          }
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
          try {
              // Кнопка ставки
              if (elements.startBtn) {
                  // Очищаем текущие обработчики (предотвращаем дублирование)
                  const newStartBtn = elements.startBtn.cloneNode(true);
                  if (elements.startBtn.parentNode) {
                      elements.startBtn.parentNode.replaceChild(newStartBtn, elements.startBtn);
                  }
                  elements.startBtn = newStartBtn;
                  
                  // Добавляем обработчик
                  elements.startBtn.addEventListener('click', placeBet);
                  app.log('Crush', 'Обработчик для кнопки ставки установлен');
              } else {
                  app.log('Crush', 'Невозможно установить обработчик: кнопка ставки не найдена', true);
              }
              
              // Кнопка вывода
              if (elements.cashoutBtn) {
                  const newCashoutBtn = elements.cashoutBtn.cloneNode(true);
                  if (elements.cashoutBtn.parentNode) {
                      elements.cashoutBtn.parentNode.replaceChild(newCashoutBtn, elements.cashoutBtn);
                  }
                  elements.cashoutBtn = newCashoutBtn;
                  
                  elements.cashoutBtn.addEventListener('click', cashout);
                  app.log('Crush', 'Обработчик для кнопки вывода установлен');
              }
              
              // Обработчик для авто-вывода
              if (elements.autoEnabled) {
                  elements.autoEnabled.addEventListener('change', function() {
                      userState.isAutoCashoutEnabled = this.checked;
                  });
              }
              
              // Обработчик для значения авто-вывода
              if (elements.autoCashoutAt) {
                  elements.autoCashoutAt.addEventListener('input', function() {
                      userState.autoCashoutMultiplier = parseFloat(this.value) || 2.0;
                  });
              }
              
              // Обработчик изменения размера окна
              window.addEventListener('resize', handleResize);
              
              app.log('Crush', 'Обработчики событий установлены');
          } catch (error) {
              app.log('Crush', `Ошибка установки обработчиков: ${error.message}`, true);
          }
      };
      
      /**
       * Обработка изменения размера окна
       */
      const handleResize = function() {
          try {
              if (graphCanvas && elements.crushGraph) {
                  graphCanvas.width = elements.crushGraph.clientWidth || 300;
                  graphCanvas.height = elements.crushGraph.clientHeight || 200;
                  redrawGraph();
              }
          } catch (error) {
              app.log('Crush', `Ошибка обработки изменения размера: ${error.message}`, true);
          }
      };
      
      /**
       * Сброс графика
       */
      const resetGraph = function() {
          try {
              if (!graphCtx) {
                  app.log('Crush', 'graphCtx не доступен, невозможно сбросить график', true);
                  return;
              }
              
              // Очищаем холст
              graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
              
              // Рисуем сетку
              drawGrid();
              
              // Сбрасываем точки графика
              globalState.graphPoints = [];
              
              app.log('Crush', 'График сброшен успешно');
          } catch (error) {
              app.log('Crush', `Ошибка сброса графика: ${error.message}`, true);
          }
      };
      
      /**
       * Рисование сетки графика
       */
      const drawGrid = function() {
          try {
              if (!graphCtx) {
                  app.log('Crush', 'graphCtx не доступен, невозможно нарисовать сетку', true);
                  return;
              }
              
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Стиль сетки
              graphCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              graphCtx.lineWidth = 1;
              
              // Горизонтальные линии
              for (let y = height; y >= 0; y -= height / 4) {
                  graphCtx.beginPath();
                  graphCtx.moveTo(0, y);
                  graphCtx.lineTo(width, y);
                  graphCtx.stroke();
              }
              
              // Вертикальные линии
              for (let x = 0; x < width; x += width / 5) {
                  graphCtx.beginPath();
                  graphCtx.moveTo(x, 0);
                  graphCtx.lineTo(x, height);
                  graphCtx.stroke();
              }
          } catch (error) {
              app.log('Crush', `Ошибка рисования сетки: ${error.message}`, true);
          }
      };
      
      /**
       * Создание случайной истории игр (только при первой инициализации)
       */
      const loadHistory = function() {
          try {
              // Генерируем случайную историю только если она пуста
              if (globalState.gameHistory.length > 0) {
                  return;
              }
              
              globalState.gameHistory = [];
              
              for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
                  const isCrashed = Math.random() > 0.3; // 70% вероятность краша
                  const crashValue = isCrashed ? 
                      (1 + Math.random() * Math.random() * 4).toFixed(2) : 
                      (1 + Math.random() * Math.random() * 8).toFixed(2);
                  
                  globalState.gameHistory.push({
                      roundId: globalState.roundId - i - 1, // Предыдущие раунды
                      multiplier: parseFloat(crashValue),
                      timestamp: new Date(Date.now() - i * 60000).toISOString(),
                      crashed: isCrashed
                  });
              }
              
              // Обновляем отображение истории
              updateHistoryDisplay();
              
              app.log('Crush', `История загружена: ${globalState.gameHistory.length} записей`);
          } catch (error) {
              app.log('Crush', `Ошибка загрузки истории: ${error.message}`, true);
          }
      };
      
      /**
       * Обновление отображения истории
       */
      const updateHistoryDisplay = function() {
          try {
              const historyItems = document.querySelector('.history-items');
              if (!historyItems) {
                  app.log('Crush', 'Элемент history-items не найден', true);
                  return;
              }
              
              historyItems.innerHTML = '';
              
              // Добавляем элементы истории
              globalState.gameHistory.forEach(item => {
                  const historyItem = document.createElement('div');
                  historyItem.className = `history-item ${item.crashed ? 'crashed' : 'cashed-out'}`;
                  
                  // Определяем цвет в зависимости от множителя
                  let colorClass = '';
                  if (item.multiplier <= 1.5) {
                      colorClass = 'low';
                  } else if (item.multiplier <= 3) {
                      colorClass = 'medium';
                  } else if (item.multiplier <= 5) {
                      colorClass = 'high';
                  } else {
                      colorClass = 'extreme';
                  }
                  
                  historyItem.classList.add(colorClass);
                  historyItem.innerHTML = `
                      <div class="history-multiplier">${item.multiplier.toFixed(2)}x</div>
                  `;
                  
                  historyItems.appendChild(historyItem);
              });
          } catch (error) {
              app.log('Crush', `Ошибка обновления отображения истории: ${error.message}`, true);
          }
      };
      
      /**
       * Обновление отображения текущей фазы игры
       */
      const updateGamePhaseDisplay = function() {
          try {
              // Обновляем отображение фазы
              if (elements.currentPhaseDisplay) {
                  if (globalState.isActiveRound) {
                      elements.currentPhaseDisplay.textContent = 'Раунд активен';
                      elements.currentPhaseDisplay.className = 'phase-indicator active-round';
                  } else if (globalState.isWaitingForNextRound) {
                      elements.currentPhaseDisplay.textContent = 'Ожидание следующего раунда';
                      elements.currentPhaseDisplay.className = 'phase-indicator waiting';
                  } else {
                      elements.currentPhaseDisplay.textContent = 'Ожидание начала игры';
                      elements.currentPhaseDisplay.className = 'phase-indicator idle';
                  }
              }
              
              // Обновляем отображение таймера
              if (elements.nextRoundTimer) {
                  if (globalState.isWaitingForNextRound) {
                      elements.nextRoundTimer.style.display = 'block';
                      const timeSpan = elements.nextRoundTimer.querySelector('.time-value');
                      if (timeSpan) {
                          timeSpan.textContent = globalState.waitingTimeLeft;
                      }
                  } else {
                      elements.nextRoundTimer.style.display = 'none';
                  }
              }
              
              // Обновляем информацию о фазе ставок
              if (elements.bettingPhaseInfo) {
                  if (globalState.isWaitingForNextRound) {
                      elements.bettingPhaseInfo.style.display = 'block';
                      elements.bettingPhaseInfo.innerHTML = `
                          <p class="betting-phase-message">Сделайте ставку до начала следующего раунда!</p>
                      `;
                  } else if (globalState.isActiveRound && !userState.hasBetInCurrentRound) {
                      elements.bettingPhaseInfo.style.display = 'block';
                      elements.bettingPhaseInfo.innerHTML = `
                          <p class="betting-phase-message">Подождите начала следующего раунда для новой ставки.</p>
                      `;
                  } else {
                      elements.bettingPhaseInfo.style.display = 'none';
                  }
              }
              
              // Обновляем доступность кнопок
              updateButtonsState();
              
          } catch (error) {
              app.log('Crush', `Ошибка обновления отображения фазы игры: ${error.message}`, true);
          }
      };
      
      /**
       * Обновление состояния кнопок в зависимости от фазы игры
       */
      const updateButtonsState = function() {
          try {
              // Кнопка ставки
              if (elements.startBtn) {
                  // Активна только во время фазы ожидания и если ставка не сделана
                  elements.startBtn.disabled = !globalState.isWaitingForNextRound || userState.hasBetInCurrentRound;
              }
              
              // Кнопка вывода
              if (elements.cashoutBtn) {
                  // Активна только во время активного раунда и если ставка сделана и не собран выигрыш
                  elements.cashoutBtn.disabled = !globalState.isActiveRound || 
                                                !userState.hasBetInCurrentRound || 
                                                userState.hasCollectedWin;
              }
              
              // Настройки авто-вывода
              const autoSettings = document.getElementById('auto-settings');
              if (autoSettings) {
                  if (globalState.isActiveRound && userState.hasBetInCurrentRound && !userState.hasCollectedWin) {
                      autoSettings.classList.add('disabled');
                  } else {
                      autoSettings.classList.remove('disabled');
                  }
              }
              
          } catch (error) {
              app.log('Crush', `Ошибка обновления состояния кнопок: ${error.message}`, true);
          }
      };
      
      /**
       * Запуск таймера ожидания следующего раунда
       */
      const startWaitingForNextRound = function() {
          try {
              // Устанавливаем состояние
              globalState.isWaitingForNextRound = true;
              globalState.isActiveRound = false;
              globalState.waitingTimeLeft = WAITING_TIME_BETWEEN_ROUNDS;
              
              // Сбрасываем состояние пользователя для нового раунда
              userState.hasBetInCurrentRound = false;
              userState.hasCollectedWin = false;
              
              // Инкрементируем ID раунда
              globalState.roundId++;
              
              // Обновляем отображение
              updateGamePhaseDisplay();
              
              // Очищаем предыдущий интервал, если есть
              if (globalState.roundTimerInterval) {
                  clearInterval(globalState.roundTimerInterval);
              }
              
              // Запускаем интервал для обновления таймера
              globalState.roundTimerInterval = setInterval(() => {
                  try {
                      // Уменьшаем время
                      globalState.waitingTimeLeft--;
                      
                      // Обновляем отображение
                      updateGamePhaseDisplay();
                      
                      // Проверяем, закончилось ли время ожидания
                      if (globalState.waitingTimeLeft <= 0) {
                          clearInterval(globalState.roundTimerInterval);
                          startNewRound();
                      }
                  } catch (error) {
                      app.log('Crush', `Ошибка в интервале таймера: ${error.message}`, true);
                      clearInterval(globalState.roundTimerInterval);
                  }
              }, TIMER_UPDATE_INTERVAL);
              
              app.log('Crush', `Начато ожидание следующего раунда: ${WAITING_TIME_BETWEEN_ROUNDS} секунд`);
          } catch (error) {
              app.log('Crush', `Ошибка запуска таймера: ${error.message}`, true);
              
              // В случае ошибки аварийно запускаем следующий раунд
              startNewRound();
          }
      };
      
      /**
       * Начало нового раунда игры
       */
      const startNewRound = function() {
          try {
              // Прекращаем ожидание
              globalState.isWaitingForNextRound = false;
              
              // Запускаем активный раунд
              globalState.isActiveRound = true;
              
              // Сбрасываем множитель
              globalState.currentMultiplier = 1.00;
              
              // Запоминаем время начала
              globalState.roundStartTime = Date.now();
              
              // Генерируем новую точку краша
              globalState.crashPoint = generateCrashPoint();
              app.log('Crush', `Начат новый раунд #${globalState.roundId}. Точка краша: ${globalState.crashPoint.toFixed(2)}`);
              
              // Сбрасываем график
              resetGraph();
              
              // Обновляем отображение
              updateGamePhaseDisplay();
              updateMultiplierDisplay();
              
              // Добавляем начальную точку графика
              addGraphPoint(1.00);
              
              // Запускаем интервал игры
              startGameInterval();
              
              // Тактильная обратная связь при начале раунда
              if (window.casinoApp && userState.hasBetInCurrentRound) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
          } catch (error) {
              app.log('Crush', `Ошибка запуска нового раунда: ${error.message}`, true);
              
              // В случае ошибки запускаем ожидание следующего раунда
              startWaitingForNextRound();
          }
      };
      
      /**
       * Запуск игрового интервала для обновления игры
       */
      const startGameInterval = function() {
          try {
              // Очищаем предыдущий интервал, если есть
              if (globalState.gameInterval) {
                  clearInterval(globalState.gameInterval);
              }
              
              // Создаем интервал для обновления игры
              globalState.gameInterval = setInterval(() => {
                  try {
                      // Проверяем, активен ли раунд
                      if (!globalState.isActiveRound) {
                          clearInterval(globalState.gameInterval);
                          return;
                      }
                      
                      // Обновляем игру
                      updateGame();
                  } catch (error) {
                      app.log('Crush', `Ошибка в игровом интервале: ${error.message}`, true);
                      clearInterval(globalState.gameInterval);
                      
                      // В случае ошибки завершаем раунд
                      finishRound();
                  }
              }, GAME_UPDATE_INTERVAL);
              
              app.log('Crush', 'Игровой интервал запущен');
          } catch (error) {
              app.log('Crush', `Ошибка запуска игрового интервала: ${error.message}`, true);
              finishRound();
          }
      };
      
      /**
       * Обновление игры
       */
      const updateGame = function() {
          try {
              // Вычисляем прошедшее время
              const elapsedTime = (Date.now() - globalState.roundStartTime) / 1000;
              
              // Обновляем множитель по экспоненциальной формуле
              const growthFactor = 0.5; // Настраиваемый параметр скорости роста
              globalState.currentMultiplier = Math.exp(elapsedTime * growthFactor);
              
              // Обновляем отображение
              updateMultiplierDisplay();
              
              // Добавляем точку на график
              if (Date.now() % 50 < 30) {
                  addGraphPoint(globalState.currentMultiplier);
              }
              
              // Проверяем автоматический выход для пользователя
              if (userState.hasBetInCurrentRound && 
                  !userState.hasCollectedWin && 
                  userState.isAutoCashoutEnabled && 
                  globalState.currentMultiplier >= userState.autoCashoutMultiplier) {
                  cashout();
                  return;
              }
              
              // Проверяем, не достигнута ли точка краша
              if (globalState.currentMultiplier >= globalState.crashPoint) {
                  // Завершаем раунд крашем
                  crashRound();
              }
          } catch (error) {
              app.log('Crush', `Ошибка обновления игры: ${error.message}`, true);
              finishRound();
          }
      };
      
      /**
       * Обновление отображения множителя
       */
      const updateMultiplierDisplay = function() {
          try {
              if (!elements.multiplierDisplay) return;
              
              // Округляем до 2 знаков после запятой для отображения
              const displayMultiplier = Math.floor(globalState.currentMultiplier * 100) / 100;
              
              // Обновляем отображение множителя
              elements.multiplierDisplay.textContent = displayMultiplier.toFixed(2);
              
              // Добавляем визуальные эффекты в зависимости от величины множителя
              elements.multiplierDisplay.classList.remove('low', 'medium', 'high', 'extreme');
              
              if (displayMultiplier <= 1.5) {
                  elements.multiplierDisplay.classList.add('low');
              } else if (displayMultiplier <= 3) {
                  elements.multiplierDisplay.classList.add('medium');
              } else if (displayMultiplier <= 5) {
                  elements.multiplierDisplay.classList.add('high');
              } else {
                  elements.multiplierDisplay.classList.add('extreme');
              }
          } catch (error) {
              app.log('Crush', `Ошибка обновления отображения множителя: ${error.message}`, true);
          }
      };
      
      /**
       * Добавление точки на график
       */
      const addGraphPoint = function(multiplier) {
          try {
              // Вычисляем прошедшее время от начала раунда
              const elapsedTime = (Date.now() - globalState.roundStartTime) / 1000;
              
              // Сохраняем точку в глобальное состояние
              globalState.graphPoints.push({
                  time: elapsedTime,
                  multiplier: multiplier
              });
              
              // Перерисовываем график
              redrawGraph();
          } catch (error) {
              app.log('Crush', `Ошибка добавления точки на график: ${error.message}`, true);
          }
      };
      
      /**
       * Перерисовка графика
       */
      const redrawGraph = function() {
          try {
              if (!graphCtx || !graphCanvas) {
                  app.log('Crush', 'Невозможно перерисовать график - графический контекст не доступен', true);
                  return;
              }
              
              // Очищаем холст
              graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
              
              // Рисуем сетку
              drawGrid();
              
              // Если нет точек или всего одна точка, выходим
              if (globalState.graphPoints.length < 2) return;
              
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Находим максимальные значения для масштабирования
              const maxTime = Math.max(5, globalState.graphPoints[globalState.graphPoints.length - 1].time);
              const maxMult = Math.max(5, ...globalState.graphPoints.map(p => p.multiplier));
              
              // Начинаем рисовать линию
              graphCtx.beginPath();
              
              // Перемещаемся к первой точке
              const x0 = (globalState.graphPoints[0].time / maxTime) * width;
              const y0 = height - (globalState.graphPoints[0].multiplier / maxMult) * height;
              graphCtx.moveTo(x0, y0);
              
              // Добавляем остальные точки с использованием сглаживания Безье для плавности
              for (let i = 1; i < globalState.graphPoints.length; i++) {
                  const x = (globalState.graphPoints[i].time / maxTime) * width;
                  const y = height - (globalState.graphPoints[i].multiplier / maxMult) * height;
                  
                  // Используем кривую Безье для сглаживания
                  if (i < globalState.graphPoints.length - 1) {
                      // Контрольные точки для сглаживания
                      const nextX = (globalState.graphPoints[i + 1].time / maxTime) * width;
                      const nextY = height - (globalState.graphPoints[i + 1].multiplier / maxMult) * height;
                      
                      const cpx1 = x - (x - x0) / 2;
                      const cpy1 = y;
                      const cpx2 = x + (nextX - x) / 2;
                      const cpy2 = y;
                      
                      graphCtx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x, y);
                  } else {
                      graphCtx.lineTo(x, y);
                  }
              }
              
              // Настройки линии
              graphCtx.strokeStyle = 'rgba(0, 168, 107, 0.8)';
              graphCtx.lineWidth = 3;
              graphCtx.shadowColor = 'rgba(0, 168, 107, 0.5)';
              graphCtx.shadowBlur = 10;
              graphCtx.stroke();
              
              // Добавляем заливку под линией графика
              const lastX = (globalState.graphPoints[globalState.graphPoints.length - 1].time / maxTime) * width;
              const lastY = height - (globalState.graphPoints[globalState.graphPoints.length - 1].multiplier / maxMult) * height;
              
              graphCtx.lineTo(lastX, height);
              graphCtx.lineTo(0, height);
              graphCtx.closePath();
              
              // Градиентная заливка
              const gradient = graphCtx.createLinearGradient(0, 0, 0, height);
              gradient.addColorStop(0, 'rgba(0, 168, 107, 0.5)');
              gradient.addColorStop(1, 'rgba(0, 168, 107, 0)');
              graphCtx.fillStyle = gradient;
              graphCtx.fill();
              
              // Рисуем точку в конце линии
              graphCtx.beginPath();
              graphCtx.arc(lastX, lastY, 6, 0, Math.PI * 2);
              graphCtx.fillStyle = 'rgba(0, 168, 107, 1)';
              graphCtx.fill();
              graphCtx.strokeStyle = 'white';
              graphCtx.lineWidth = 2;
              graphCtx.stroke();
              
          } catch (error) {
              app.log('Crush', `Ошибка перерисовки графика: ${error.message}`, true);
          }
      };
      
      /**
       * Размещение ставки
       */
      const placeBet = async function() {
          try {
              // Проверяем возможность размещения ставки
              if (!globalState.isWaitingForNextRound || userState.hasBetInCurrentRound) {
                  app.log('Crush', 'Невозможно разместить ставку: неверная фаза игры');
                  return;
              }
              
              // Проверяем наличие элементов
              if (!elements.crushBet) {
                  app.log('Crush', 'Элемент ставки не найден', true);
                  return;
              }
              
              // Получаем размер ставки
              userState.betAmount = parseInt(elements.crushBet.value);
              
              // Проверяем ставку
              if (isNaN(userState.betAmount) || userState.betAmount <= 0) {
                  if (window.casinoApp && window.casinoApp.showNotification) {
                      window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                  } else {
                      alert('Пожалуйста, введите корректную ставку');
                  }
                  return;
              }
              
              // Проверяем, достаточно ли средств (если есть информация о балансе)
              if (window.GreenLightApp && window.GreenLightApp.user && 
                  userState.betAmount > window.GreenLightApp.user.balance) {
                  if (window.casinoApp && window.casinoApp.showNotification) {
                      window.casinoApp.showNotification('Недостаточно средств для ставки');
                  } else {
                      alert('Недостаточно средств для ставки');
                  }
                  return;
              }
              
              // Обновляем настройки автовывода
              if (elements.autoEnabled && elements.autoCashoutAt) {
                  userState.isAutoCashoutEnabled = elements.autoEnabled.checked;
                  userState.autoCashoutMultiplier = parseFloat(elements.autoCashoutAt.value) || 2.0;
              }
              
              // Отмечаем, что ставка размещена
              userState.hasBetInCurrentRound = true;
              userState.hasCollectedWin = false;
              
              // Обновляем отображение
              updateGamePhaseDisplay();
              
              // Тактильная обратная связь
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('light');
              }
              
              // Отправляем ставку на сервер (если доступно)
              if (window.casinoApp && window.casinoApp.processGameResult) {
                  await window.casinoApp.processGameResult(
                      'crush',
                      userState.betAmount,
                      'bet',
                      0,
                      { 
                          roundId: globalState.roundId,
                          isAutoCashoutEnabled: userState.isAutoCashoutEnabled,
                          autoCashoutMultiplier: userState.autoCashoutMultiplier
                      }
                  );
              }
              
              app.log('Crush', `Ставка размещена: ${userState.betAmount}, авто-вывод: ${userState.isAutoCashoutEnabled ? userState.autoCashoutMultiplier + 'x' : 'выключен'}`);
          } catch (error) {
              app.log('Crush', `Ошибка размещения ставки: ${error.message}`, true);
              
              // Отменяем ставку в случае ошибки
              userState.hasBetInCurrentRound = false;
              updateGamePhaseDisplay();
          }
      };
      
      /**
       * Вывод выигрыша
       */
      const cashout = async function() {
          try {
              // Проверяем возможность вывода
              if (!globalState.isActiveRound || !userState.hasBetInCurrentRound || userState.hasCollectedWin) {
                  app.log('Crush', 'Невозможно вывести выигрыш: неверная фаза игры или выигрыш уже собран');
                  return;
              }
              
              // Отмечаем, что выигрыш собран
              userState.hasCollectedWin = true;
              
              // Вычисляем выигрыш
              const winAmount = Math.floor(userState.betAmount * globalState.currentMultiplier);
              
              // Обновляем отображение
              updateGamePhaseDisplay();
              
              // Показываем результат
              if (elements.crushResult) {
                  elements.crushResult.innerHTML = `
                      <div class="cashout-icon">💰</div>
                      <div class="cashout-text">Вы вывели деньги при ${globalState.currentMultiplier.toFixed(2)}x!</div>
                      <div class="win-amount">+${winAmount} ⭐</div>
                  `;
                  elements.crushResult.className = 'result win';
                  elements.crushResult.style.display = 'block';
              }
              
              // Подсвечиваем множитель
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.className = 'multiplier-value cashed-out';
              }
              
              // Тактильная обратная связь
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
              }
              
              // Отправляем результат на сервер (если доступно)
              if (window.casinoApp && window.casinoApp.processGameResult) {
                  await window.casinoApp.processGameResult(
                      'crush',
                      0, // Не новая ставка
                      'win',
                      winAmount,
                      {
                          roundId: globalState.roundId,
                          cashoutMultiplier: globalState.currentMultiplier,
                          crashPoint: globalState.crashPoint
                      }
                  );
              }
              
              app.log('Crush', `Успешный вывод при ${globalState.currentMultiplier.toFixed(2)}x, выигрыш: ${winAmount}`);
          } catch (error) {
              app.log('Crush', `Ошибка вывода выигрыша: ${error.message}`, true);
              
              // В случае ошибки все равно помечаем выигрыш как собранный
              userState.hasCollectedWin = true;
              updateGamePhaseDisplay();
          }
      };
      
      /**
       * Завершение раунда крашем
       */
      const crashRound = function() {
          try {
              // Анимация краша
              animateCrash();
              
              // Показываем результат для игрока, если он участвовал в раунде
              if (userState.hasBetInCurrentRound && !userState.hasCollectedWin) {
                  if (elements.crushResult) {
                      elements.crushResult.innerHTML = `
                          <div class="crash-icon">💥</div>
                          <div class="crash-text">Краш при ${globalState.currentMultiplier.toFixed(2)}x!</div>
                          <div class="lose-message">Вы проиграли ${userState.betAmount} ⭐</div>
                      `;
                      elements.crushResult.className = 'result lose';
                      elements.crushResult.style.display = 'block';
                  }
                  
                  // Тактильная обратная связь
                  if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                      window.casinoApp.provideTactileFeedback('error');
                  }
                  
                  // Отправляем результат на сервер (если доступно)
                  if (window.casinoApp && window.casinoApp.processGameResult) {
                      window.casinoApp.processGameResult(
                          'crush',
                          0, // Не новая ставка
                          'lose',
                          0,
                          {
                              roundId: globalState.roundId,
                              crashPoint: globalState.currentMultiplier
                          }
                      ).catch(error => {
                          app.log('Crush', `Ошибка отправки результата: ${error.message}`, true);
                      });
                  }
              }
              
              // Подсвечиваем множитель
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.className = 'multiplier-value crashed';
              }
              
              // Обновляем историю
              addToHistory(true);
              
              // Финализируем раунд
              finishRound();
              
              app.log('Crush', `Раунд завершился крашем при ${globalState.currentMultiplier.toFixed(2)}x`);
          } catch (error) {
              app.log('Crush', `Ошибка завершения раунда крашем: ${error.message}`, true);
              finishRound();
          }
      };
      
      /**
       * Анимация краша
       */
      const animateCrash = function() {
          try {
              if (!graphCanvas || !graphCtx || globalState.graphPoints.length === 0) {
                  return;
              }
              
              // Получаем последнюю точку графика
              const lastPoint = globalState.graphPoints[globalState.graphPoints.length - 1];
              
              // Находим позицию последней точки на графике
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Максимальные значения для масштабирования
              const maxTime = Math.max(5, lastPoint.time);
              const maxMult = Math.max(5, lastPoint.multiplier);
              
              const crashX = (lastPoint.time / maxTime) * width;
              const crashY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Рисуем взрыв
              const explosionColors = [
                  'rgba(255, 0, 0, 0.8)',
                  'rgba(255, 165, 0, 0.8)',
                  'rgba(255, 255, 0, 0.8)'
              ];
              
              // Последовательная анимация взрыва
              for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                      if (!graphCtx) return;
                      
                      const explosionRadius = 10 + i * 10;
                      
                      graphCtx.beginPath();
                      graphCtx.arc(crashX, crashY, explosionRadius, 0, Math.PI * 2);
                      graphCtx.fillStyle = explosionColors[i];
                      graphCtx.fill();
                  }, i * 100);
              }
          } catch (error) {
              app.log('Crush', `Ошибка анимации краша: ${error.message}`, true);
          }
      };
      
      /**
       * Завершение раунда (общая функция)
       */
      const finishRound = function() {
          try {
              // Останавливаем игровой интервал
              if (globalState.gameInterval) {
                  clearInterval(globalState.gameInterval);
                  globalState.gameInterval = null;
              }
              
              // Обновляем состояние игры
              globalState.isActiveRound = false;
              
              // Обновляем отображение
              updateGamePhaseDisplay();
              
              // Запускаем ожидание следующего раунда через небольшую задержку
              setTimeout(() => {
                  startWaitingForNextRound();
              }, 2000);
              
          } catch (error) {
              app.log('Crush', `Ошибка финализации раунда: ${error.message}`, true);
              
              // В случае ошибки запускаем ожидание следующего раунда
              setTimeout(() => {
                  startWaitingForNextRound();
              }, 2000);
          }
      };
      
      /**
       * Добавление результата раунда в историю
       */
      const addToHistory = function(crashed) {
          try {
              // Создаем запись о текущем раунде
              const historyEntry = {
                  roundId: globalState.roundId,
                  multiplier: globalState.currentMultiplier,
                  timestamp: new Date().toISOString(),
                  crashed: crashed
              };
              
              // Добавляем в начало истории
              globalState.gameHistory.unshift(historyEntry);
              
              // Ограничиваем размер истории
              if (globalState.gameHistory.length > MAX_HISTORY_SIZE) {
                  globalState.gameHistory = globalState.gameHistory.slice(0, MAX_HISTORY_SIZE);
              }
              
              // Обновляем отображение истории
              updateHistoryDisplay();
              
          } catch (error) {
              app.log('Crush', `Ошибка добавления в историю: ${error.message}`, true);
          }
      };
      
      /**
       * Генерация точки краша с учетом дома (edge)
       */
      const generateCrashPoint = function() {
          try {
              // Коэффициент преимущества казино (house edge)
              // RTP 97% => house edge 3%
              const houseEdge = 0.03;
              
              // Генерируем случайное число в диапазоне от 0 до 1
              const randomValue = Math.random();
              
              // Формула для краш-точки с учетом преимущества казино
              let crashPoint = 1 / (randomValue * (1 - houseEdge));
              
              // Ограничиваем максимальную точку краша для безопасности
              const maxCrashPoint = 1000.0;
              crashPoint = Math.min(crashPoint, maxCrashPoint);
              
              // Для тестирования и демонстрации иногда делаем ранний краш
              if (Math.random() < 0.05) {  // 5% шанс раннего краша
                  crashPoint = 1.0 + Math.random() * 0.5;  // Между 1.0 и 1.5
              }
              
              return crashPoint;
          } catch (error) {
              app.log('Crush', `Ошибка генерации точки краша: ${error.message}`, true);
              return 2.0; // Безопасное значение по умолчанию
          }
      };
      
      /**
       * Проверка и создание объекта casinoApp, если он отсутствует
       */
      const ensureCasinoApp = function() {
          if (window.casinoApp) return true;
          
          // Создаем минимальную реализацию casinoApp, если объект отсутствует
          app.log('Crush', 'casinoApp не найден, создаем временную реализацию', true);
          window.casinoApp = {
              showNotification: function(message) {
                  alert(message);
              },
              provideTactileFeedback: function() {
                  // Заглушка для вибрации
              },
              processGameResult: function(gameType, bet, result, win, data) {
                  app.log('Crush', `Игра: ${gameType}, Ставка: ${bet}, Результат: ${result}, Выигрыш: ${win}`, false);
                  return Promise.resolve({success: true});
              }
          };
          
          return true;
      };
      
      // Возвращаем публичный интерфейс
      return {
          // Основные методы
          init: init,
          placeBet: placeBet,
          cashout: cashout,
          
          // Метод для создания интерфейса при необходимости
          createUI: setupUI,
          
          // Ручные методы для управления игрой (для отладки)
          startWaitingForNextRound: startWaitingForNextRound,
          startNewRound: startNewRound,
          crashRound: crashRound,
          
          // Метод для проверки состояния
          getStatus: function() {
              return {
                  user: userState,
                  global: globalState,
                  elementsFound: {
                      startBtn: !!elements.startBtn,
                      cashoutBtn: !!elements.cashoutBtn,
                      crushBet: !!elements.crushBet,
                      multiplierDisplay: !!elements.multiplierDisplay,
                      crushGraph: !!elements.crushGraph,
                      nextRoundTimer: !!elements.nextRoundTimer
                  },
                  graphReady: !!graphCtx
              };
          },
          
          // Стилизация для игры (добавляется динамически, если необходимо)
          addStyles: function() {
              try {
                  // Проверяем, добавлены ли уже стили
                  if (document.getElementById('crush-styles')) {
                      return;
                  }
                  
                  // Создаем тег стилей
                  const styleElement = document.createElement('style');
                  styleElement.id = 'crush-styles';
                  styleElement.textContent = `
                      .crush-container {
                          padding: 15px;
                          margin: 10px auto;
                          max-width: 500px;
                      }
                      
                      .game-phase-display {
                          background-color: rgba(0, 0, 0, 0.2);
                          border-radius: 8px;
                          padding: 10px;
                          margin-bottom: 15px;
                          text-align: center;
                          border: 1px solid var(--primary-green);
                      }
                      
                      .phase-indicator {
                          font-size: 18px;
                          font-weight: bold;
                          margin-bottom: 5px;
                      }
                      
                      .phase-indicator.active-round {
                          color: var(--primary-green);
                      }
                      
                      .phase-indicator.waiting {
                          color: var(--gold);
                      }
                      
                      .phase-indicator.idle {
                          color: var(--light-gray);
                      }
                      
                      .round-timer {
                          font-size: 16px;
                          color: var(--gold);
                      }
                      
                      .time-value {
                          font-weight: bold;
                      }
                      
                      .betting-phase-info {
                          background-color: rgba(255, 215, 0, 0.1);
                          border-radius: 8px;
                          padding: 10px;
                          margin: 10px 0;
                          border: 1px solid var(--gold);
                      }
                      
                      .betting-phase-message {
                          color: var(--gold);
                          text-align: center;
                          margin: 0;
                          font-weight: bold;
                      }
                      
                      .multiplier-container {
                          font-size: 18px;
                          font-weight: bold;
                          text-align: center;
                          margin: 10px 0;
                      }
                      
                      .multiplier-value {
                          transition: color 0.3s ease;
                      }
                      
                      .multiplier-value.crashed {
                          color: var(--red);
                      }
                      
                      .multiplier-value.cashed-out {
                          color: #2196F3;
                      }
                      
                      .multiplier-value.low {
                          color: var(--primary-green);
                      }
                      
                      .multiplier-value.medium {
                          color: var(--gold);
                      }
                      
                      .multiplier-value.high {
                          color: #FF9800;
                      }
                      
                      .multiplier-value.extreme {
                          color: var(--red);
                      }
                      
                      .crush-graph {
                          width: 100%;
                          height: 200px;
                          border: 1px solid #333;
                          border-radius: 8px;
                          margin: 15px 0;
                          position: relative;
                          background-color: rgba(0, 0, 0, 0.2);
                          overflow: hidden;
                      }
                      
                      .crush-history {
                          margin-top: 20px;
                      }
                      
                      .history-items {
                          display: flex;
                          flex-wrap: wrap;
                          gap: 5px;
                          margin-top: 10px;
                      }
                      
                      .history-item {
                          width: 50px;
                          height: 25px;
                          border-radius: 4px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-size: 12px;
                          font-weight: bold;
                          color: white;
                      }
                      
                      .history-item.crashed {
                          background-color: #ef5350;
                      }
                      
                      .history-item.cashed-out {
                          background-color: #66bb6a;
                      }
                      
                      .auto-settings {
                          margin: 10px 0;
                          padding: 10px;
                          border: 1px solid #333;
                          border-radius: 8px;
                          background-color: rgba(0, 0, 0, 0.1);
                      }
                      
                      .auto-settings.disabled {
                          opacity: 0.5;
                          pointer-events: none;
                      }
                      
                      .auto-option {
                          display: flex;
                          align-items: center;
                          gap: 5px;
                      }
                      
                      .auto-option input[type="number"] {
                          width: 60px;
                          padding: 5px;
                          border-radius: 4px;
                      }
                      
                      .win-amount {
                          font-size: 18px;
                          font-weight: bold;
                          color: var(--primary-green);
                          margin-top: 10px;
                      }
                      
                      .lose-message {
                          font-size: 16px;
                          color: var(--red);
                          margin-top: 10px;
                      }
                  `;
                  document.head.appendChild(styleElement);
                  
                  app.log('Crush', 'Стили для игры добавлены');
              } catch (error) {
                  app.log('Crush', `Ошибка добавления стилей: ${error.message}`, true);
              }
          }
      };
  })();
  
  // Регистрируем игру во всех форматах для максимальной совместимости
  try {
      // 1. Регистрация через новую систему
      if (window.registerGame) {
          window.registerGame('crushGame', crushGame);
          app.log('Crush', 'Игра зарегистрирована через новую систему registerGame');
      }
      
      // 2. Экспорт в глобальное пространство имен (обратная совместимость)
      window.crushGame = crushGame;
      app.log('Crush', 'Игра экспортирована в глобальное пространство имен');
      
      // 3. Сообщаем в лог о завершении загрузки модуля
      app.log('Crush', 'Модуль успешно загружен и готов к инициализации');
      
      // 4. Добавляем стили для игры
      crushGame.addStyles();
      
      // 5. Запускаем автоматическую инициализацию при загрузке страницы
      document.addEventListener('DOMContentLoaded', function() {
          setTimeout(() => {
              if (!crushGame.getStatus().user.initialized && !crushGame.getStatus().user.initializationStarted) {
                  app.log('Crush', 'Запускаем автоматическую инициализацию');
                  crushGame.init();
              }
          }, 500);
      });
      
      // 6. Если DOM уже загружен, запускаем инициализацию сразу
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(() => {
              if (!crushGame.getStatus().user.initialized && !crushGame.getStatus().user.initializationStarted) {
                  app.log('Crush', 'Запускаем автоматическую инициализацию (DOM уже загружен)');
                  crushGame.init();
              }
          }, 500);
      }
      
  } catch (error) {
      app.log('Crush', `Ошибка регистрации игры: ${error.message}`, true);
  }
})();