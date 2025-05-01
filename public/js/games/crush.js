/**
 * crush.js - Оптимизированная версия игры Crush
 * Версия 2.0.1
 * 
 * Особенности:
 * - Неблокирующая инициализация
 * - Улучшенная обработка ошибок
 * - Таймауты для всех асинхронных операций
 * - Совместимость с новой системой регистрации игр
 * - Динамическое создание необходимых DOM-элементов
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
  app.log('Crush', 'Инициализация модуля игры Crush v2.0.1');
  
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
          container: null
      };
      
      // Элементы для графика
      let graphCanvas = null;
      let graphCtx = null;
      
      // Состояние игры
      let state = {
          isPlaying: false,
          initialized: false,
          initializationStarted: false,
          multiplier: 1.00,
          gameInterval: null,
          crashPoint: 1.00,
          betAmount: 0,
          gameStartTime: 0,
          graphPoints: []
      };
      
      // История игр
      let gameHistory = [];
      const MAX_HISTORY = 10;

      /**
       * Создание основного контейнера для игры
       */
      const createGameContainer = function() {
          try {
              // Проверяем, существует ли уже контейнер
              let container = document.querySelector('.crush-container');
              if (container) {
                  elements.container = container;
                  return container;
              }
              
              // Ищем место для размещения контейнера
              let gameArea = document.querySelector('.games-area');
              if (!gameArea) {
                  // Если игровой зоны нет, создаем её
                  gameArea = document.createElement('div');
                  gameArea.className = 'games-area';
                  
                  // Ищем основной контейнер приложения
                  const appContainer = document.querySelector('.app-container');
                  if (appContainer) {
                      appContainer.appendChild(gameArea);
                  } else {
                      // Если нет специального контейнера, добавляем в body
                      document.body.appendChild(gameArea);
                  }
                  
                  app.log('Crush', 'Создана общая игровая зона');
              }
              
              // Создаем контейнер для игры
              container = document.createElement('div');
              container.className = 'crush-container game-container';
              gameArea.appendChild(container);
              
              elements.container = container;
              app.log('Crush', 'Создан основной контейнер для игры');
              
              return container;
          } catch (error) {
              app.log('Crush', `Ошибка создания контейнера: ${error.message}`, true);
              return null;
          }
      };
      
      /**
       * Создание интерфейса игры
       */
      const createGameInterface = function() {
          try {
              const container = elements.container || createGameContainer();
              if (!container) {
                  app.log('Crush', 'Невозможно создать интерфейс: контейнер не найден', true);
                  return false;
              }
              
              // Проверяем, не создан ли уже интерфейс
              if (container.querySelector('#crush-graph')) {
                  app.log('Crush', 'Интерфейс уже создан');
                  return true;
              }
              
              // Создаем HTML разметку для игры
              container.innerHTML = `
                  <h2>Crush</h2>
                  <div class="game-controls">
                      <div class="bet-control">
                          <label for="crush-bet">Ставка:</label>
                          <input type="number" id="crush-bet" min="1" max="1000" value="10">
                      </div>
                      
                      <div class="multiplier-container">
                          <span>Множитель: <span id="multiplier">1.00</span>x</span>
                      </div>
                      
                      <div class="crush-buttons">
                          <button id="start-crush-btn" class="action-btn">СТАРТ</button>
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
              
              // Создаем стили, если их еще нет
              if (!document.getElementById('crush-styles')) {
                  const styleElement = document.createElement('style');
                  styleElement.id = 'crush-styles';
                  styleElement.textContent = `
                      .crush-container {
                          padding: 15px;
                          margin: 10px auto;
                          border: 1px solid #ccc;
                          border-radius: 8px;
                          max-width: 500px;
                          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                      }
                      
                      .game-controls {
                          margin-bottom: 15px;
                          display: flex;
                          flex-direction: column;
                          gap: 10px;
                      }
                      
                      .action-btn {
                          padding: 10px 15px;
                          background-color: #4CAF50;
                          color: white;
                          border: none;
                          border-radius: 4px;
                          cursor: pointer;
                          font-weight: bold;
                      }
                      
                      .action-btn:disabled {
                          background-color: #cccccc;
                          cursor: not-allowed;
                      }
                      
                      .action-btn.disabled {
                          background-color: #cccccc;
                          cursor: not-allowed;
                      }
                      
                      .multiplier-container {
                          font-size: 18px;
                          font-weight: bold;
                          text-align: center;
                          margin: 10px 0;
                      }
                      
                      #multiplier.active {
                          color: #4CAF50;
                      }
                      
                      #multiplier.crashed {
                          color: #F44336;
                      }
                      
                      #multiplier.cashed-out {
                          color: #2196F3;
                      }
                      
                      #multiplier.low {
                          color: #4CAF50;
                      }
                      
                      #multiplier.medium {
                          color: #FFC107;
                      }
                      
                      #multiplier.high {
                          color: #FF9800;
                      }
                      
                      #multiplier.extreme {
                          color: #F44336;
                      }
                      
                      .crush-graph {
                          width: 100%;
                          height: 200px;
                          border: 1px solid #ccc;
                          border-radius: 4px;
                          margin: 15px 0;
                          position: relative;
                          background-color: #f9f9f9;
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
                      
                      .history-item.low {
                          opacity: 0.7;
                      }
                      
                      .history-item.medium {
                          opacity: 0.8;
                      }
                      
                      .history-item.high {
                          opacity: 0.9;
                      }
                      
                      .history-item.extreme {
                          opacity: 1;
                      }
                      
                      .result {
                          margin-top: 15px;
                          padding: 10px;
                          border-radius: 4px;
                          text-align: center;
                      }
                      
                      .result.win {
                          background-color: rgba(76, 175, 80, 0.2);
                          color: #4CAF50;
                      }
                      
                      .result.lose {
                          background-color: rgba(244, 67, 54, 0.2);
                          color: #F44336;
                      }
                      
                      .crash-info {
                          margin-top: 10px;
                          font-size: 14px;
                          color: #757575;
                      }
                  `;
                  document.head.appendChild(styleElement);
              }
              
              app.log('Crush', 'Интерфейс игры успешно создан');
              return true;
          } catch (error) {
              app.log('Crush', `Ошибка создания интерфейса: ${error.message}`, true);
              return false;
          }
      };
      
      /**
       * Инициализация игры
       * С защитой от повторной инициализации и таймаутом
       */
      const init = async function() {
          // Предотвращаем повторную инициализацию
          if (state.initialized || state.initializationStarted) {
              app.log('Crush', 'Инициализация уже выполнена или выполняется');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('Crush', 'Начало инициализации игры');
          
          try {
              // Устанавливаем таймаут для инициализации
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Сначала создаем интерфейс
                      if (!createGameInterface()) {
                          app.log('Crush', 'Не удалось создать интерфейс игры', true);
                          resolve(false);
                          return;
                      }
                      
                      // Затем получаем элементы DOM
                      await findDOMElements();
                      
                      // Создаем canvas для графика
                      setupCanvas();
                      
                      // Добавляем обработчики событий
                      setupEventListeners();
                      
                      // Сбрасываем график
                      resetGraph();
                      
                      // Загружаем историю
                      loadHistory();
                      
                      // Создаем интерфейс истории
                      createHistoryUI();
                      
                      // Скрываем результат
                      if (elements.crushResult) {
                          elements.crushResult.style.display = 'none';
                      }
                      
                      state.initialized = true;
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
                      elements.startBtn = document.getElementById('start-crush-btn');
                      elements.cashoutBtn = document.getElementById('cash-crush-btn');
                      elements.crushBet = document.getElementById('crush-bet');
                      elements.multiplierDisplay = document.getElementById('multiplier');
                      elements.crushGraph = document.getElementById('crush-graph');
                      elements.crushResult = document.getElementById('crush-result');
                      
                      // Проверяем критические элементы и логируем их статус
                      if (!elements.startBtn) {
                          app.log('Crush', 'Предупреждение: элемент start-crush-btn не найден', true);
                      } else {
                          app.log('Crush', 'Элемент start-crush-btn найден успешно');
                      }
                      
                      if (!elements.crushGraph) {
                          app.log('Crush', 'Предупреждение: элемент crush-graph не найден', true);
                      } else {
                          app.log('Crush', 'Элемент crush-graph найден успешно');
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
              // Кнопка старта
              if (elements.startBtn) {
                  // Очищаем текущие обработчики (предотвращаем дублирование)
                  const newStartBtn = elements.startBtn.cloneNode(true);
                  if (elements.startBtn.parentNode) {
                      elements.startBtn.parentNode.replaceChild(newStartBtn, elements.startBtn);
                  }
                  elements.startBtn = newStartBtn;
                  
                  // Добавляем обработчик
                  elements.startBtn.addEventListener('click', startGame);
                  app.log('Crush', 'Обработчик для кнопки старта установлен');
              } else {
                  app.log('Crush', 'Невозможно установить обработчик: кнопка старта не найдена', true);
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
              } else {
                  app.log('Crush', 'Невозможно установить обработчик: кнопка вывода не найдена', true);
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
                  resetGraph();
                  
                  // Перерисовываем текущий график, если игра активна
                  if (state.isPlaying && state.graphPoints.length > 0) {
                      redrawGraph();
                  }
              }
          } catch (error) {
              app.log('Crush', `Ошибка обработки изменения размера: ${error.message}`, true);
          }
      };
      
      /**
       * Создание интерфейса истории
       */
      const createHistoryUI = function() {
          try {
              // Проверяем, существует ли контейнер игры
              const crushContainer = elements.container || document.querySelector('.crush-container');
              if (!crushContainer) {
                  app.log('Crush', 'Контейнер игры не найден', true);
                  return;
              }
              
              // Проверяем, существует ли уже контейнер истории
              let historyContainer = document.querySelector('.crush-history');
              
              if (!historyContainer) {
                  // Создаем контейнер для истории
                  historyContainer = document.createElement('div');
                  historyContainer.className = 'crush-history';
                  historyContainer.innerHTML = `
                      <h3>История</h3>
                      <div class="history-items"></div>
                  `;
                  
                  // Добавляем после графика
                  if (elements.crushGraph) {
                      elements.crushGraph.after(historyContainer);
                  } else {
                      crushContainer.appendChild(historyContainer);
                  }
              }
              
              // Обновляем содержимое истории
              updateHistoryDisplay();
              
              app.log('Crush', 'Интерфейс истории создан успешно');
          } catch (error) {
              app.log('Crush', `Ошибка создания интерфейса истории: ${error.message}`, true);
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
              
              // Сбрасываем точки
              state.graphPoints = [];
              
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
       * Загрузка истории
       */
      const loadHistory = function() {
          try {
              // В реальном приложении здесь был бы запрос к API
              // Для демонстрации генерируем случайную историю
              gameHistory = [];
              
              for (let i = 0; i < 10; i++) {
                  const isCrash = Math.random() > 0.3; // 70% вероятность краша
                  const crashMultiplier = isCrash ? 
                      (1 + Math.random() * Math.random() * 4).toFixed(2) : 
                      (1 + Math.random() * Math.random() * 8).toFixed(2);
                  
                  gameHistory.push({
                      multiplier: parseFloat(crashMultiplier),
                      timestamp: new Date(Date.now() - i * 60000).toISOString(),
                      isCashedOut: !isCrash
                  });
              }
              
              // Обновляем отображение истории
              updateHistoryDisplay();
              
              app.log('Crush', `История загружена: ${gameHistory.length} записей`);
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
              gameHistory.forEach(item => {
                  const historyItem = document.createElement('div');
                  historyItem.className = `history-item ${item.isCashedOut ? 'cashed-out' : 'crashed'}`;
                  
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
      
      /**
       * Начало игры
       */
      const startGame = async function() {
          app.log('Crush', 'Запуск игры');
          
          // Проверяем инициализацию
          if (!state.initialized) {
              app.log('Crush', 'Игра не инициализирована, запускаем инициализацию', true);
              await init();
              
              // Если инициализация не удалась, выходим
              if (!state.initialized) {
                  app.log('Crush', 'Не удалось запустить игру: ошибка инициализации', true);
                  return;
              }
          }
          
          try {
              // Проверка наличия casinoApp
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Проверка наличия элементов
              if (!elements.crushBet) {
                  app.log('Crush', 'Элемент ставки не найден', true);
                  return;
              }
              
              // Проверяем, не запущена ли уже игра
              if (state.isPlaying) {
                  app.log('Crush', 'Игра уже запущена');
                  return;
              }
              
              // Получаем размер ставки
              state.betAmount = parseInt(elements.crushBet.value);
              
              // Проверяем ставку
              if (isNaN(state.betAmount) || state.betAmount <= 0) {
                  window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                  return;
              }
              
              // Проверяем, достаточно ли средств (если есть информация о балансе)
              if (window.GreenLightApp && window.GreenLightApp.user && 
                  state.betAmount > window.GreenLightApp.user.balance) {
                  window.casinoApp.showNotification('Недостаточно средств для ставки');
                  return;
              }
              
              // Сбрасываем состояние игры
              state.multiplier = 1.00;
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.textContent = state.multiplier.toFixed(2);
                  elements.multiplierDisplay.classList.remove('crashed', 'cashed-out');
                  elements.multiplierDisplay.classList.add('active');
              }
              
              state.isPlaying = true;
              
              // Вычисляем точку краша
              state.crashPoint = generateCrashPoint();
              app.log('Crush', `Игра закончится на: ${state.crashPoint.toFixed(2)}`);
              
              // Обновляем интерфейс
              if (elements.startBtn) {
                  elements.startBtn.disabled = true;
                  elementselements.startBtn.disabled = true;
                  elements.startBtn.classList.add('disabled');
              }
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = false;
                  elements.cashoutBtn.classList.remove('disabled');
                  elements.cashoutBtn.classList.add('active');
              }
              
              // Скрываем предыдущий результат
              if (elements.crushResult) {
                  elements.crushResult.style.opacity = '0';
                  elements.crushResult.style.transform = 'translateY(20px)';
                  setTimeout(() => {
                      elements.crushResult.textContent = '';
                      elements.crushResult.className = 'result';
                      elements.crushResult.style.display = 'none';
                  }, 300);
              }
              
              // Тактильная обратная связь
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
              
              // Сбрасываем график
              resetGraph();
              state.gameStartTime = Date.now();
              addGraphPoint(1.00); // Начальная точка
              
              // Отправляем начальную ставку на сервер
              await window.casinoApp.processGameResult(
                  'crush',
                  state.betAmount,
                  'bet',
                  0,
                  { startMultiplier: state.multiplier }
              );
              
              // Запускаем интервал игры с защитой от зависания
              startGameInterval();
              
              app.log('Crush', 'Игра запущена успешно');
          } catch (error) {
              app.log('Crush', `Ошибка запуска игры: ${error.message}`, true);
              
              // Сбрасываем состояние в случае ошибки
              state.isPlaying = false;
              if (elements.startBtn) {
                  elements.startBtn.disabled = false;
                  elements.startBtn.classList.remove('disabled');
              }
          }
      };
      
      /**
       * Запуск игрового интервала с защитой от зависания
       */
      const startGameInterval = function() {
          try {
              // Устанавливаем максимальное время игры
              const maxGameTime = 60000; // 60 секунд максимум
              const gameStartMs = Date.now();
              
              // Запускаем интервал
              state.gameInterval = setInterval(() => {
                  // Проверяем, не превышено ли максимальное время
                  if (Date.now() - gameStartMs > maxGameTime) {
                      app.log('Crush', 'Превышено максимальное время игры', true);
                      clearInterval(state.gameInterval);
                      gameCrash(); // Принудительный крах
                      return;
                  }
                  
                  // Обновляем игру
                  updateGame();
              }, 50);
              
              app.log('Crush', 'Игровой интервал запущен успешно');
          } catch (error) {
              app.log('Crush', `Ошибка запуска игрового интервала: ${error.message}`, true);
              
              // В случае ошибки, принудительно останавливаем игру
              state.isPlaying = false;
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
          }
      };
      
      /**
       * Генерация точки краша
       */
      const generateCrashPoint = function() {
          try {
              // Используем распределение с большей вероятностью малых значений
              // и редкой вероятностью больших значений
              
              // Базовое случайное число от 0 до 1
              const r = Math.random();
              
              // Формула для распределения
              let crash = 1.0;
              
              if (r < 0.5) {
                  // 50% шанс краша между 1.0 и 2.0
                  crash = 1.0 + r;
              } else if (r < 0.8) {
                  // 30% шанс краша между 2.0 и 4.0
                  crash = 2.0 + (r - 0.5) * 6.67;
              } else if (r < 0.95) {
                  // 15% шанс краша между 4.0 и 8.0
                  crash = 4.0 + (r - 0.8) * 26.67;
              } else {
                  // 5% шанс краша между 8.0 и 100.0 (редкие крупные множители)
                  crash = 8.0 + (r - 0.95) * 1840;
              }
              
              // Ограничиваем максимальное значение для безопасности
              return Math.min(crash, 100.0);
          } catch (error) {
              app.log('Crush', `Ошибка генерации точки краша: ${error.message}`, true);
              return 2.0; // Безопасное значение по умолчанию
          }
      };
      
      /**
       * Обновление состояния игры
       */
      const updateGame = function() {
          try {
              if (!state.isPlaying) return;
              
              const elapsedTime = (Date.now() - state.gameStartTime) / 1000;
              
              // Обновляем множитель
              const growthFactor = 0.5;
              state.multiplier = Math.exp(elapsedTime * growthFactor);
              
              // Округляем до 2 знаков после запятой для отображения
              const displayMultiplier = Math.floor(state.multiplier * 100) / 100;
              
              // Обновляем отображение
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.textContent = displayMultiplier.toFixed(2);
                  
                  // Добавляем визуальный эффект для больших множителей
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
              }
              
              // Добавляем точку на график каждые 100мс для плавности
              if (Date.now() % 100 < 50) {
                  addGraphPoint(displayMultiplier);
              }
              
              // Проверяем, должна ли игра завершиться
              if (state.multiplier >= state.crashPoint) {
                  gameCrash();
              }
          } catch (error) {
              app.log('Crush', `Ошибка обновления игры: ${error.message}`, true);
              
              // В случае ошибки, прекращаем игру
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
              gameCrash();
          }
      };
      
      /**
       * Добавление точки на график
       */
      const addGraphPoint = function(mult) {
          try {
              const elapsedTimeMs = Date.now() - state.gameStartTime;
              const elapsedTimeSec = elapsedTimeMs / 1000;
              
              // Сохраняем точку для возможного перерисовывания при ресайзе
              state.graphPoints.push({
                  time: elapsedTimeSec,
                  multiplier: mult
              });
              
              // Перерисовываем график
              redrawGraph();
          } catch (error) {
              app.log('Crush', `Ошибка добавления точки на график: ${error.message}`, true);
          }
      };
      
      /**
       * Перерисовка всего графика
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
              if (state.graphPoints.length < 2) return;
              
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Находим максимальные значения для масштабирования
              const maxTime = Math.max(5, state.graphPoints[state.graphPoints.length - 1].time);
              const maxMult = Math.max(5, ...state.graphPoints.map(p => p.multiplier));
              
              // Начинаем рисовать линию
              graphCtx.beginPath();
              
              // Перемещаемся к первой точке
              const x0 = (state.graphPoints[0].time / maxTime) * width;
              const y0 = height - (state.graphPoints[0].multiplier / maxMult) * height;
              graphCtx.moveTo(x0, y0);
              
              // Добавляем остальные точки
              for (let i = 1; i < state.graphPoints.length; i++) {
                  const x = (state.graphPoints[i].time / maxTime) * width;
                  const y = height - (state.graphPoints[i].multiplier / maxMult) * height;
                  
                  // Используем кривую Безье для сглаживания
                  if (i < state.graphPoints.length - 1) {
                      // Контрольные точки для сглаживания
                      const nextX = (state.graphPoints[i + 1].time / maxTime) * width;
                      const nextY = height - (state.graphPoints[i + 1].multiplier / maxMult) * height;
                      
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
              const lastX = (state.graphPoints[state.graphPoints.length - 1].time / maxTime) * width;
              graphCtx.lineTo(lastX, height);
              graphCtx.lineTo(0, height);
              graphCtx.closePath();
              
              // Градиентная заливка
              const gradient = graphCtx.createLinearGradient(0, 0, 0, height);
              gradient.addColorStop(0, 'rgba(0, 168, 107, 0.5)');
              gradient.addColorStop(1, 'rgba(0, 168, 107, 0)');
              graphCtx.fillStyle = gradient;
              graphCtx.fill();
              
              // Текущее значение множителя
              const lastPoint = state.graphPoints[state.graphPoints.length - 1];
              const lastY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Рисуем точку на конце линии
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
       * Обработка краша игры
       */
      const gameCrash = async function() {
          try {
              // Проверяем состояние игры
              if (!state.isPlaying) return;
              
              // Проверяем наличие casinoApp
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Останавливаем игру
              clearInterval(state.gameInterval);
              state.isPlaying = false;
              
              // Тактильная обратная связь
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('error');
              }
              
              // Обновляем интерфейс
              if (elements.crushResult) {
                  elements.crushResult.innerHTML = `
                      <div class="crash-icon">💥</div>
                      <div class="crash-text">Crash at ${state.multiplier.toFixed(2)}x!</div>
                  `;
                  elements.crushResult.classList.add('lose');
                  elements.crushResult.style.display = 'block';
                  setTimeout(() => {
                      elements.crushResult.style.opacity = '1';
                      elements.crushResult.style.transform = 'translateY(0)';
                  }, 50);
              }
              
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.classList.remove('active', 'low', 'medium', 'high', 'extreme');
                  elements.multiplierDisplay.classList.add('crashed');
              }
              
              if (elements.startBtn) {
                  elements.startBtn.disabled = false;
                  elements.startBtn.classList.remove('disabled');
              }
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
                  elements.cashoutBtn.classList.remove('active');
                  elements.cashoutBtn.classList.add('disabled');
              }
              
              // Анимация краша на графике
              animateCrash();
              
              // Обновляем историю
              gameHistory.unshift({
                  multiplier: state.multiplier,
                  timestamp: new Date().toISOString(),
                  isCashedOut: false
              });
              
              // Обрезаем историю до максимального размера
              if (gameHistory.length > MAX_HISTORY) {
                  gameHistory = gameHistory.slice(0, MAX_HISTORY);
              }
              
              // Обновляем отображение истории
              updateHistoryDisplay();
              
              // Отправляем проигрыш на сервер
              await window.casinoApp.processGameResult(
                  'crush',
                  0, // Нет дополнительной ставки
                  'lose',
                  0,
                  {
                      crashPoint: state.multiplier,
                      finalMultiplier: state.multiplier
                  }
              );
              
              app.log('Crush', `Игра завершена крашем на множителе ${state.multiplier.toFixed(2)}`);
          } catch (error) {
              app.log('Crush', `Ошибка обработки краша: ${error.message}`, true);
              
              // Сбрасываем состояние в любом случае
              state.isPlaying = false;
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
          }
      };
      
      /**
       * Анимация краша
       */
      const animateCrash = function() {
          try {
              if (!graphCanvas || !graphCtx) {
                  app.log('Crush', 'Невозможно анимировать краш - графический контекст не доступен', true);
                  return;
              }
              
              // Добавляем визуальный эффект взрыва
              const lastPoint = state.graphPoints[state.graphPoints.length - 1];
              
              // Находим позицию последней точки на графике
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Максимальные значения для масштабирования
              const maxTime = Math.max(5, lastPoint.time);
              const maxMult = Math.max(5, lastPoint.multiplier);
              
              const crashX = (lastPoint.time / maxTime) * width;
              const crashY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Рисуем взрыв
              const explosionRadius = 20;
              const explosionColors = [
                  'rgba(255, 0, 0, 0.8)',
                  'rgba(255, 165, 0, 0.8)',
                  'rgba(255, 255, 0, 0.8)'
              ];
              
              for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                      if (!graphCtx) return;
                      
                      graphCtx.beginPath();
                      graphCtx.arc(crashX, crashY, explosionRadius * (i + 1), 0, Math.PI * 2);
                      graphCtx.fillStyle = explosionColors[i];
                      graphCtx.fill();
                      
                      // Перерисовываем через небольшую задержку
                      setTimeout(redrawGraph, 150);
                  }, i * 100);
              }
          } catch (error) {
              app.log('Crush', `Ошибка анимации краша: ${error.message}`, true);
          }
      };
      
      /**
       * Вывод выигрыша
       */
      const cashout = async function() {
          try {
              // Проверяем состояние игры
              if (!state.isPlaying) return;
              
              // Проверяем наличие casinoApp
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Останавливаем игру
              clearInterval(state.gameInterval);
              state.isPlaying = false;
              
              // Тактильная обратная связь
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
              }
              
              // Вычисляем выигрыш
              const winAmount = Math.floor(state.betAmount * state.multiplier);
              
              // Обновляем интерфейс
              if (elements.crushResult) {
                  elements.crushResult.innerHTML = `
                      <div class="cashout-icon">💰</div>
                      <div class="cashout-text">Cashed out at ${state.multiplier.toFixed(2)}x!</div>
                      <div class="win-amount">+${winAmount} ⭐</div>
                  `;
                  elements.crushResult.classList.add('win');
                  elements.crushResult.style.display = 'block';
                  setTimeout(() => {
                      elements.crushResult.style.opacity = '1';
                      elements.crushResult.style.transform = 'translateY(0)';
                  }, 50);
              }
              
              if (elements.multiplierDisplay) {
                  elements.multiplierDisplay.classList.remove('active', 'low', 'medium', 'high', 'extreme');
                  elements.multiplierDisplay.classList.add('cashed-out');
              }
              
              if (elements.startBtn) {
                  elements.startBtn.disabled = false;
                  elements.startBtn.classList.remove('disabled');
              }
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
                  elements.cashoutBtn.classList.remove('active');
                  elements.cashoutBtn.classList.add('disabled');
              }
              
              // Анимация кешаута на графике
              animateCashout();
              
              // Обновляем историю
              gameHistory.unshift({
                  multiplier: state.multiplier,
                  timestamp: new Date().toISOString(),
                  isCashedOut: true
              });
              
              // Обрезаем историю до максимального размера
              if (gameHistory.length > MAX_HISTORY) {
                  gameHistory = gameHistory.slice(0, MAX_HISTORY);
              }
              
              // Обновляем отображение истории
              updateHistoryDisplay();
              
              // Отправляем выигрыш на сервер
              await window.casinoApp.processGameResult(
                  'crush',
                  0, // Нет дополнительной ставки
                  'win',
                  winAmount,
                  {
                      cashoutMultiplier: state.multiplier,
                      crashPoint: state.crashPoint
                  }
              );
              
              // Продолжаем показывать симуляцию графика до краша
              simulateContinuation();
              
              app.log('Crush', `Успешный кешаут на множителе ${state.multiplier.toFixed(2)}, выигрыш: ${winAmount}`);
          } catch (error) {
              app.log('Crush', `Ошибка кешаута: ${error.message}`, true);
              
              // Сбрасываем состояние в любом случае
              state.isPlaying = false;
              if (state.gameInterval) {
                  clearInterval(state.gameInterval);
              }
          }
      };
      
      /**
       * Анимация кешаута
       */
      const animateCashout = function() {
          try {
              if (!graphCanvas || !graphCtx) {
                  app.log('Crush', 'Невозможно анимировать кешаут - графический контекст не доступен', true);
                  return;
              }
              
              // Добавляем визуальный эффект успешного кешаута
              const lastPoint = state.graphPoints[state.graphPoints.length - 1];
              
              // Находим позицию последней точки на графике
              const width = graphCanvas.width;
              const height = graphCanvas.height;
              
              // Максимальные значения для масштабирования
              const maxTime = Math.max(5, lastPoint.time);
              const maxMult = Math.max(5, lastPoint.multiplier);
              
              const cashoutX = (lastPoint.time / maxTime) * width;
              const cashoutY = height - (lastPoint.multiplier / maxMult) * height;
              
              // Рисуем эффект успешного кешаута
              for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                      if (!graphCtx) return;
                      
                      graphCtx.beginPath();
                      graphCtx.arc(cashoutX, cashoutY, 15 - i * 3, 0, Math.PI * 2);
                      graphCtx.strokeStyle = 'rgba(0, 255, 0, ' + (0.8 - i * 0.2) + ')';
                      graphCtx.lineWidth = 3;
                      graphCtx.stroke();
                      
                      // Отмечаем точку кешаута на графике
                      graphCtx.beginPath();
                      graphCtx.arc(cashoutX, cashoutY, 8, 0, Math.PI * 2);
                      graphCtx.fillStyle = 'rgba(0, 255, 0, 0.8)';
                      graphCtx.fill();
                      graphCtx.strokeStyle = 'white';
                      graphCtx.lineWidth = 2;
                      graphCtx.stroke();
                  }, i * 100);
              }
          } catch (error) {
              app.log('Crush', `Ошибка анимации кешаута: ${error.message}`, true);
          }
      };
      
      /**
       * Симуляция продолжения графика после кешаута
       */
      const simulateContinuation = function() {
          try {
              const cashoutMultiplier = state.multiplier;
              const cashoutTime = (Date.now() - state.gameStartTime) / 1000;
              
              // Создаем интервал для симуляции продолжения графика
              let simulationTimeout = null;
              let lastTime = Date.now();
              let simulationInterval = setInterval(() => {
                  try {
                      // Вычисляем текущее время от начала игры
                      const elapsedTime = (Date.now() - state.gameStartTime) / 1000;
                      
                      // Обновляем множитель (используем ту же формулу, что и в updateGame)
                      const growthFactor = 0.5;
                      const simulatedMultiplier = Math.exp(elapsedTime * growthFactor);
                      const displayMultiplier = Math.floor(simulatedMultiplier * 100) / 100;
                      
                      // Добавляем точку на график
                      if (Date.now() - lastTime > 100) {
                          addGraphPoint(displayMultiplier);
                          lastTime = Date.now();
                      }
                      
                      // Проверяем, достигли ли точки краша
                      if (simulatedMultiplier >= state.crashPoint) {
                          clearInterval(simulationInterval);
                          
                          // Анимация краша на графике
                          animateCrash();
                          
                          // Показываем сообщение о том, что произошел бы краш
                          if (elements.crushResult && elements.crushResult.classList.contains('win')) {
                              const crashInfo = document.createElement('div');
                              crashInfo.className = 'crash-info';
                              crashInfo.textContent = `Would have crashed at ${state.crashPoint.toFixed(2)}x`;
                              elements.crushResult.appendChild(crashInfo);
                          }
                      }
                  } catch (simError) {
                      app.log('Crush', `Ошибка в симуляции: ${simError.message}`, true);
                      clearInterval(simulationInterval);
                  }
              }, 50);
              
              // Останавливаем симуляцию через 5 секунд для экономии ресурсов
              simulationTimeout = setTimeout(() => {
                  clearInterval(simulationInterval);
              }, 5000);
              
              // Защита от утечек памяти
              window.addEventListener('beforeunload', () => {
                  if (simulationInterval) clearInterval(simulationInterval);
                  if (simulationTimeout) clearTimeout(simulationTimeout);
              });
          } catch (error) {
              app.log('Crush', `Ошибка симуляции продолжения: ${error.message}`, true);
          }
      };
      
      // Возвращаем публичный интерфейс
      return {
          // Основные методы
          init: init,
          startGame: startGame,
          cashout: cashout,
          
          // Метод для проверки состояния
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isPlaying: state.isPlaying,
                  elementsFound: {
                      startBtn: !!elements.startBtn,
                      cashoutBtn: !!elements.cashoutBtn,
                      crushBet: !!elements.crushBet,
                      multiplierDisplay: !!elements.multiplierDisplay,
                      crushGraph: !!elements.crushGraph
                  },
                  graphReady: !!graphCtx,
                  gameState: {
                      multiplier: state.multiplier,
                      crashPoint: state.crashPoint,
                      graphPoints: state.graphPoints.length
                  }
              };
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
      
      // 4. Автоматическая инициализация при загрузке страницы
      document.addEventListener('DOMContentLoaded', function() {
          setTimeout(() => {
              if (!crushGame.getStatus().initialized && !crushGame.getStatus().initializationStarted) {
                  app.log('Crush', 'Запускаем автоматическую инициализацию');
                  crushGame.init();
              }
          }, 500);
      });
      
      // 5. Если DOM уже загружен, запускаем инициализацию сразу
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(() => {
              if (!crushGame.getStatus().initialized && !crushGame.getStatus().initializationStarted) {
                  app.log('Crush', 'Запускаем автоматическую инициализацию (DOM уже загружен)');
                  crushGame.init();
              }
          }, 500);
      }
      
  } catch (error) {
      app.log('Crush', `Ошибка регистрации игры: ${error.message}`, true);
  }
})();