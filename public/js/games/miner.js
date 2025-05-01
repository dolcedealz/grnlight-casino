/**
 * miner.js - Оптимизированная версия игры Miner
 * Версия 2.0.2
 * 
 * Особенности:
 * - Неблокирующая инициализация
 * - Улучшенная обработка ошибок
 * - Таймауты для всех асинхронных операций
 * - Совместимость с новой системой регистрации игр
 * - Создание DOM-элементов при их отсутствии
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[Miner] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Miner', 'Инициализация модуля игры Miner v2.0.2');
  
  // Игровая логика в замыкании для изоляции
  const minerGame = (function() {
      // Элементы игры
      let elements = {
          newGameBtn: null,
          cashoutBtn: null,
          minerBet: null,
          minesCount: null,
          minerGrid: null,
          potentialWin: null,
          minerResult: null,
          container: null
      };
      
      // Возвращаем публичный интерфейс
      return {
          // Основные методы
          init: init,
          startNewGame: startNewGame,
          cashout: cashout,
          updateMineCount: updateMineCount,
          
          // Метод для проверки состояния
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isPlaying: state.isPlaying,
                  elementsFound: {
                      newGameBtn: !!elements.newGameBtn,
                      cashoutBtn: !!elements.cashoutBtn,
                      minerBet: !!elements.minerBet,
                      minerGrid: !!elements.minerGrid
                  },
                  gameState: {
                      minesCount: state.gameData.minesCount,
                      revealedCells: state.gameData.revealedCells.length,
                      currentMultiplier: state.gameData.currentMultiplier
                  }
              };
          }
      };
  })();
  
  // Регистрируем игру во всех форматах для максимальной совместимости
  try {
      // 1. Регистрация через новую систему
      if (window.registerGame) {
          window.registerGame('minerGame', minerGame);
          app.log('Miner', 'Игра зарегистрирована через новую систему registerGame');
      }
      
      // 2. Экспорт в глобальное пространство имен (обратная совместимость)
      window.minerGame = minerGame;
      app.log('Miner', 'Игра экспортирована в глобальное пространство имен');
      
      // 3. Сообщаем в лог о завершении загрузки модуля
      app.log('Miner', 'Модуль успешно загружен и готов к инициализации');
      
      // 4. Автоматическая инициализация при загрузке страницы
      document.addEventListener('DOMContentLoaded', function() {
          setTimeout(() => {
              if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                  app.log('Miner', 'Запускаем автоматическую инициализацию');
                  minerGame.init();
              }
          }, 500);
      });
      
      // 5. Если DOM уже загружен, запускаем инициализацию сразу
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(() => {
              if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                  app.log('Miner', 'Запускаем автоматическую инициализацию (DOM уже загружен)');
                  minerGame.init();
              }
          }, 500);
      }
      
  } catch (error) {
      app.log('Miner', `Ошибка регистрации игры: ${error.message}`, true);
  }
})();
      /**
       * Автоматический вывод при открытии всех безопасных ячеек
       */
      const automaticCashout = async function() {
          try {
              // Проверяем состояние игры
              if (!state.isPlaying) {
                  return;
              }
              
              // Проверяем наличие casinoApp
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Рассчитываем выигрыш
              const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
              
              // Тактильная обратная связь - большой выигрыш
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
                  setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
              }
              
              // Обновляем интерфейс
              if (elements.minerResult) {
                  elements.minerResult.innerHTML = `
                      <div class="win-icon">🏆</div>
                      <div class="win-title">Идеально! Вы открыли все безопасные ячейки!</div>
                      <div class="win-amount">Выигрыш: ${winAmount} ⭐</div>
                      <div class="win-multiplier">Множитель: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                  `;
                  elements.minerResult.classList.add('win', 'big-win');
              }
              
              // Сбрасываем игровое состояние
              state.isPlaying = false;
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
              }
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = false;
              }
              
              // Показываем все мины
              revealAllMines();
              
              // Обрабатываем выигрыш
              await window.casinoApp.processGameResult(
                  'miner',
                  0, // Нет дополнительной ставки
                  'win',
                  winAmount,
                  {
                      revealedCells: state.gameData.revealedCells,
                      multiplier: state.gameData.currentMultiplier,
                      mines: state.gameData.mines,
                      perfectGame: true
                  }
              );
              
              app.log('Miner', `Идеальная игра завершена с выигрышем ${winAmount}`);
          } catch (error) {
              app.log('Miner', `Ошибка автоматического вывода: ${error.message}`, true);
          }
      };
      
      // Состояние игры
      let state = {
          isPlaying: false,
          initialized: false,
          initializationStarted: false,
          gameData: {
              grid: [],
              mines: [],
              revealedCells: [],
              totalCells: 25,  // 5x5 сетка
              minesCount: 3,
              currentMultiplier: 1,
              betAmount: 0,
              baseMultiplier: 1.2 // Базовый множитель
          }
      };
      
      /**
       * Создание основного контейнера для игры
       */
      const createGameContainer = function() {
          try {
              // Проверяем, существует ли уже контейнер
              let container = document.querySelector('.miner-container');
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
                  
                  app.log('Miner', 'Создана общая игровая зона');
              }
              
              // Создаем контейнер для игры
              container = document.createElement('div');
              container.className = 'miner-container game-container';
              gameArea.appendChild(container);
              
              elements.container = container;
              app.log('Miner', 'Создан основной контейнер для игры');
              
              return container;
          } catch (error) {
              app.log('Miner', `Ошибка создания контейнера: ${error.message}`, true);
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
                  app.log('Miner', 'Невозможно создать интерфейс: контейнер не найден', true);
                  return false;
              }
              
              // Проверяем, не создан ли уже интерфейс
              if (container.querySelector('#miner-grid')) {
                  app.log('Miner', 'Интерфейс уже создан');
                  return true;
              }
              
              // Создаем HTML разметку для игры
              container.innerHTML = `
                  <h2>Miner</h2>
                  <div class="game-controls">
                      <div class="bet-control">
                          <label for="miner-bet">Ставка:</label>
                          <input type="number" id="miner-bet" min="1" max="1000" value="10">
                      </div>
                      
                      <div class="mines-control">
                          <label for="mines-count">Количество мин:</label>
                          <select id="mines-count">
                              <option value="3">3 мины</option>
                              <option value="5">5 мин</option>
                              <option value="7">7 мин</option>
                              <option value="10">10 мин</option>
                          </select>
                      </div>
                      
                      <div class="potential-win-container">
                          <span>Потенциальный выигрыш: <span id="potential-win">0</span> ⭐</span>
                      </div>
                      
                      <div class="miner-buttons">
                          <button id="new-game-btn" class="action-btn">НОВАЯ ИГРА</button>
                          <button id="cashout-btn" class="action-btn" disabled>ЗАБРАТЬ</button>
                      </div>
                  </div>
                  
                  <div id="miner-grid" class="miner-grid">
                      <!-- Сетка будет заполнена динамически -->
                  </div>
                  
                  <div id="miner-result" class="result"></div>
              `;
              
              // Создаем стили, если их еще нет
              if (!document.getElementById('miner-styles')) {
                  const styleElement = document.createElement('style');
                  styleElement.id = 'miner-styles';
                  styleElement.textContent = `
                      .miner-container {
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
                      
                      .miner-grid {
                          display: grid;
                          grid-template-columns: repeat(5, 1fr);
                          gap: 8px;
                          max-width: 350px;
                          margin: 0 auto;
                      }
                      
                      .grid-cell {
                          width: 60px;
                          height: 60px;
                          background-color: #f1f1f1;
                          border-radius: 5px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-size: 24px;
                          cursor: pointer;
                          transition: all 0.2s;
                      }
                      
                      .active-cell:hover {
                          background-color: #e0e0e0;
                          transform: scale(1.05);
                      }
                      
                      .grid-cell.revealed {
                          background-color: #c8e6c9;
                      }
                      
                      .grid-cell.mine {
                          background-color: #ffcdd2;
                      }
                      
                      .grid-cell.exploded {
                          background-color: #ef5350;
                          animation: explode 0.5s;
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
                      
                      @keyframes explode {
                          0% { transform: scale(1); }
                          50% { transform: scale(1.2); }
                          100% { transform: scale(1); }
                      }
                  `;
                  document.head.appendChild(styleElement);
              }
              
              app.log('Miner', 'Интерфейс игры успешно создан');
              return true;
          } catch (error) {
              app.log('Miner', `Ошибка создания интерфейса: ${error.message}`, true);
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
              app.log('Miner', 'Инициализация уже выполнена или выполняется');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('Miner', 'Начало инициализации игры');
          
          try {
              // Устанавливаем таймаут для инициализации
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Сначала создаем интерфейс
                      if (!createGameInterface()) {
                          app.log('Miner', 'Не удалось создать интерфейс игры', true);
                          resolve(false);
                          return;
                      }
                      
                      // Затем получаем элементы DOM
                      await findDOMElements();
                      
                      // Создаем игровую сетку
                      createGrid();
                      
                      // Обновляем потенциальный выигрыш
                      updatePotentialWin();
                      
                      // Добавляем обработчики событий
                      setupEventListeners();
                      
                      state.initialized = true;
                      app.log('Miner', 'Инициализация успешно завершена');
                      resolve(true);
                  } catch (innerError) {
                      app.log('Miner', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Устанавливаем таймаут (3 секунды)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('Miner', 'Таймаут инициализации', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Используем Promise.race для предотвращения зависания
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('Miner', `Критическая ошибка инициализации: ${error.message}`, true);
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
                      elements.newGameBtn = document.getElementById('new-game-btn');
                      elements.cashoutBtn = document.getElementById('cashout-btn');
                      elements.minerBet = document.getElementById('miner-bet');
                      elements.minesCount = document.getElementById('mines-count');
                      elements.minerGrid = document.getElementById('miner-grid');
                      elements.potentialWin = document.getElementById('potential-win');
                      elements.minerResult = document.getElementById('miner-result');
                      
                      // Проверяем критические элементы и сообщаем о них
                      if (!elements.newGameBtn) {
                          app.log('Miner', 'Предупреждение: элемент new-game-btn не найден', true);
                      } else {
                          app.log('Miner', 'Элемент new-game-btn найден успешно');
                      }
                      
                      if (!elements.minerGrid) {
                          app.log('Miner', 'Предупреждение: элемент miner-grid не найден', true);
                      } else {
                          app.log('Miner', 'Элемент miner-grid найден успешно');
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('Miner', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
          try {
              // Кнопка новой игры
              if (elements.newGameBtn) {
                  // Очищаем текущие обработчики (предотвращаем дублирование)
                  const newGameBtn = elements.newGameBtn.cloneNode(true);
                  if (elements.newGameBtn.parentNode) {
                      elements.newGameBtn.parentNode.replaceChild(newGameBtn, elements.newGameBtn);
                  }
                  elements.newGameBtn = newGameBtn;
                  
                  // Добавляем обработчик
                  elements.newGameBtn.addEventListener('click', startNewGame);
                  app.log('Miner', 'Обработчик для кнопки новой игры установлен');
              } else {
                  app.log('Miner', 'Невозможно установить обработчик: кнопка новой игры не найдена', true);
              }
              
              // Кнопка вывода выигрыша
              if (elements.cashoutBtn) {
                  const cashoutBtn = elements.cashoutBtn.cloneNode(true);
                  if (elements.cashoutBtn.parentNode) {
                      elements.cashoutBtn.parentNode.replaceChild(cashoutBtn, elements.cashoutBtn);
                  }
                  elements.cashoutBtn = cashoutBtn;
                  
                  elements.cashoutBtn.addEventListener('click', cashout);
                  app.log('Miner', 'Обработчик для кнопки вывода выигрыша установлен');
              }
              
              // Выбор количества мин
              if (elements.minesCount) {
                  elements.minesCount.addEventListener('change', updateMineCount);
                  app.log('Miner', 'Обработчик для выбора количества мин установлен');
              }
              
              app.log('Miner', 'Обработчики событий установлены');
          } catch (error) {
              app.log('Miner', `Ошибка установки обработчиков: ${error.message}`, true);
          }
      };
      
      /**
       * Создание игровой сетки
       */
      const createGrid = function() {
          try {
              if (!elements.minerGrid) {
                  app.log('Miner', 'Невозможно создать сетку: элемент minerGrid не найден', true);
                  return;
              }
              
              // Очищаем текущую сетку
              elements.minerGrid.innerHTML = '';
              
              // Создаем сетку 5x5
              for (let i = 0; i < 5; i++) {
                  for (let j = 0; j < 5; j++) {
                      const cell = document.createElement('div');
                      cell.className = 'grid-cell';
                      cell.dataset.row = i;
                      cell.dataset.col = j;
                      cell.dataset.index = i * 5 + j;
                      
                      // Добавляем обработчик только если игра активна
                      if (state.isPlaying) {
                          cell.addEventListener('click', () => revealCell(i * 5 + j));
                          // Добавляем визуальный эффект при наведении
                          cell.classList.add('active-cell');
                      }
                      
                      elements.minerGrid.appendChild(cell);
                  }
              }
              
              app.log('Miner', 'Игровая сетка создана успешно');
          } catch (error) {
              app.log('Miner', `Ошибка создания сетки: ${error.message}`, true);
          }
      };
      
      /**
       * Обновление количества мин
       */
      const updateMineCount = function() {
          try {
              if (!elements.minesCount) {
                  app.log('Miner', 'Элемент minesCount не найден', true);
                  return;
              }
              
              state.gameData.minesCount = parseInt(elements.minesCount.value);
              
              // Устанавливаем базовый множитель в зависимости от количества мин
              switch (state.gameData.minesCount) {
                  case 3: 
                      state.gameData.baseMultiplier = 1.2;
                      break;
                  case 5:
                      state.gameData.baseMultiplier = 1.5;
                      break;
                  case 7:
                      state.gameData.baseMultiplier = 2.0;
                      break;
                  case 10:
                      state.gameData.baseMultiplier = 3.0;
                      break;
                  default:
                      state.gameData.baseMultiplier = 1.2;
              }
              
              // Обновляем отображение
              updatePotentialWin();
              
              // Тактильная обратная связь
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('light');
              }
              
              app.log('Miner', `Количество мин обновлено: ${state.gameData.minesCount}, множитель: ${state.gameData.baseMultiplier}`);
          } catch (error) {
              app.log('Miner', `Ошибка обновления количества мин: ${error.message}`, true);
          }
      };
      
      /**
       * Обновление отображения потенциального выигрыша
       */
      const updatePotentialWin = function() {
          try {
              if (!elements.potentialWin || !elements.minerBet) {
                  return;
              }
              
              const betAmt = parseInt(elements.minerBet.value) || 0;
              
              // Используем улучшенную формулу для расчета множителя
              const multiplier = calculateMultiplier(
                  state.gameData.revealedCells.length,
                  state.gameData.totalCells,
                  state.gameData.minesCount,
                  state.gameData.baseMultiplier
              );
              
              // Рассчитываем потенциальный выигрыш
              const potential = Math.floor(betAmt * multiplier);
              elements.potentialWin.textContent = potential;
              
              // Обновляем игровые данные
              state.gameData.currentMultiplier = multiplier;
              
              app.log('Miner', `Потенциальный выигрыш обновлен: ${potential}, множитель: ${multiplier}`);
          } catch (error) {
              app.log('Miner', `Ошибка обновления потенциального выигрыша: ${error.message}`, true);
          }
      };
      
      /**
       * Расчет множителя выигрыша
       */
      const calculateMultiplier = function(revealed, total, mines, baseMultiplier) {
          if (revealed === 0) return baseMultiplier;
          
          try {
              // Базовое вычисление сложности
              const safeCells = total - mines;
              const remainingSafe = safeCells - revealed;
              
              // Базовый множитель зависит от количества мин
              // и растет экспоненциально с каждой открытой клеткой
              let multiplier = baseMultiplier * Math.pow(safeCells / remainingSafe, 1.2);
              
              // Ограничиваем максимальный множитель для баланса
              const maxMultiplier = 50;
              multiplier = Math.min(multiplier, maxMultiplier);
              
              // Округляем до 2 знаков после запятой
              return Math.floor(multiplier * 100) / 100;
          } catch (error) {
              app.log('Miner', `Ошибка расчета множителя: ${error.message}`, true);
              return baseMultiplier; // Возвращаем базовый множитель в случае ошибки
          }
      };
      
      /**
       * Проверка и инициализация объекта casinoApp
       */
      const ensureCasinoApp = function() {
          if (window.casinoApp) return true;
          
          // Создаем минимальную реализацию casinoApp, если объект отсутствует
          app.log('Miner', 'casinoApp не найден, создаем временную реализацию', true);
          window.casinoApp = {
              showNotification: function(message) {
                  alert(message);
              },
              provideTactileFeedback: function() {
                  // Заглушка для вибрации
              },
              processGameResult: function(gameType, bet, result, win, data) {
                  app.log('Miner', `Игра: ${gameType}, Ставка: ${bet}, Результат: ${result}, Выигрыш: ${win}`, false);
                  return Promise.resolve({success: true});
              }
          };
          
          return true;
      };
      
      /**
       * Начало новой игры
       */
      const startNewGame = async function() {
          app.log('Miner', 'Запуск новой игры');
          
          // Проверяем инициализацию
          if (!state.initialized) {
              app.log('Miner', 'Игра не инициализирована, запускаем инициализацию', true);
              await init();
              
              // Если инициализация не удалась, выходим
              if (!state.initialized) {
                  app.log('Miner', 'Не удалось запустить игру: ошибка инициализации', true);
                  return;
              }
          }
          
          try {
              // Проверка наличия casinoApp
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Проверка наличия элементов
              if (!elements.minerBet) {
                  app.log('Miner', 'Элемент ставки не найден', true);
                  return;
              }
              
              // Получаем размер ставки
              const betAmount = parseInt(elements.minerBet.value);
              
              // Проверяем ставку
              if (isNaN(betAmount) || betAmount <= 0) {
                  window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                  return;
              }
              
              // Проверяем, достаточно ли средств (если есть объект пользователя)
              if (window.GreenLightApp && window.GreenLightApp.user && 
                  betAmount > window.GreenLightApp.user.balance) {
                  window.casinoApp.showNotification('Недостаточно средств для ставки');
                  return;
              }
              
              // Сбрасываем игровое состояние
              state.isPlaying = true;
              state.gameData = {
                  grid: Array(state.gameData.totalCells).fill('empty'),
                  mines: [],
                  revealedCells: [],
                  totalCells: 25,
                  minesCount: parseInt(elements.minesCount ? elements.minesCount.value : 3),
                  currentMultiplier: state.gameData.baseMultiplier,
                  betAmount: betAmount,
                  baseMultiplier: state.gameData.baseMultiplier
              };
              
              // Размещаем мины
              placeMines();
              
              // Обновляем интерфейс
              createGrid();
              
              // Обновляем кнопки
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = false;
              }
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = true;
              }
              
              // Очищаем результат
              if (elements.minerResult) {
                  elements.minerResult.textContent = '';
                  elements.minerResult.className = 'result';
              }
              
              // Тактильная обратная связь
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
              
              // Обрабатываем начальную ставку
              await window.casinoApp.processGameResult(
                  'miner',
                  betAmount,
                  'bet',
                  0,
                  { 
                      minesCount: state.gameData.minesCount,
                      baseMultiplier: state.gameData.baseMultiplier 
                  }
              );
              
              // Обновляем отображение потенциального выигрыша
              updatePotentialWin();
              
              app.log('Miner', 'Новая игра успешно начата');
          } catch (error) {
              app.log('Miner', `Ошибка запуска новой игры: ${error.message}`, true);
              state.isPlaying = false;
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = false;
              }
          }
      };
      
      /**
       * Размещение мин
       */
      const placeMines = function() {
          try {
              // Очищаем существующие мины
              state.gameData.mines = [];
              // Сначала очищаем сетку
              state.gameData.grid = Array(state.gameData.totalCells).fill('empty');
              
              // Размещаем новые мины
              while (state.gameData.mines.length < state.gameData.minesCount) {
                  const randomIndex = Math.floor(Math.random() * state.gameData.totalCells);
                  
                  // Добавляем только если это не мина
                  if (!state.gameData.mines.includes(randomIndex)) {
                      state.gameData.mines.push(randomIndex);
                      state.gameData.grid[randomIndex] = 'mine';
                  }
              }
              
              app.log('Miner', `Мины размещены: ${state.gameData.mines.join(', ')}`);
          } catch (error) {
              app.log('Miner', `Ошибка размещения мин: ${error.message}`, true);
          }
      };
      
      /**
       * Открытие ячейки
       */
      const revealCell = async function(index) {
          try {
              // Проверяем, уже открыта ли ячейка
              if (state.gameData.revealedCells.includes(index)) {
                  return;
              }
              
              // Проверяем, активна ли игра
              if (!state.isPlaying) {
                  return;
              }
              
              // Получаем элемент ячейки
              const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
              if (!cell) {
                  app.log('Miner', `Ячейка с индексом ${index} не найдена`, true);
                  return;
              }
              
              // Тактильная обратная связь
              if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('light');
              }
              
              // Проверяем, является ли ячейка миной
              if (state.gameData.mines.includes(index)) {
                  // Игра окончена - нашли мину
                  revealAllMines();
                  
                  // Обновляем интерфейс
                  cell.classList.add('mine', 'exploded');
                  cell.innerHTML = '💥';
                  
                  // Вибрация при взрыве
                  if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                      window.casinoApp.provideTactileFeedback('error');
                  }
                  
                  // Устанавливаем игровое состояние
                  state.isPlaying = false;
                  
                  if (elements.cashoutBtn) {
                      elements.cashoutBtn.disabled = true;
                  }
                  
                  if (elements.newGameBtn) {
                      elements.newGameBtn.disabled = false;
                  }
                  
                  // Показываем результат
                  if (elements.minerResult) {
                      elements.minerResult.textContent = 'Бум! Вы наткнулись на мину. Игра окончена!';
                      elements.minerResult.classList.add('lose');
                  }
                  
                  // Обрабатываем проигрыш
                  if (window.casinoApp) {
                      await window.casinoApp.processGameResult(
                          'miner',
                          0, // Нет дополнительной ставки
                          'lose',
                          0,
                          {
                              revealedCells: state.gameData.revealedCells,
                              hitMine: index,
                              mines: state.gameData.mines,
                              finalMultiplier: state.gameData.currentMultiplier
                          }
                      );
                  }
              } else {
                  // Безопасная ячейка
                  state.gameData.revealedCells.push(index);
                  
                  // Обновляем интерфейс
                  cell.classList.add('revealed');
                  cell.innerHTML = '💰';
                  
                  // Обновляем множитель и потенциальный выигрыш
                  updatePotentialWin();
                  
                  // Проверяем, все ли безопасные ячейки открыты (условие победы)
                  const safeCellsCount = state.gameData.totalCells - state.gameData.mines.length;
                  if (state.gameData.revealedCells.length === safeCellsCount) {
                      // Игрок открыл все безопасные ячейки
                      await automaticCashout();
                  }
              }
          } catch (error) {
              app.log('Miner', `Ошибка открытия ячейки: ${error.message}`, true);
          }
      };
      
      /**
       * Открытие всех мин
       */
      const revealAllMines = function() {
          try {
              state.gameData.mines.forEach(index => {
                  const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                  if (cell && !cell.classList.contains('exploded')) {
                      cell.classList.add('mine');
                      cell.innerHTML = '💣';
                      
                      // Небольшая задержка для каждой мины
                      const delay = Math.random() * 300;
                      setTimeout(() => {
                          cell.classList.add('mine-reveal');
                      }, delay);
                  }
              });
          } catch (error) {
              app.log('Miner', `Ошибка открытия всех мин: ${error.message}`, true);
          }
      };
      
      /**
       * Вывод выигрыша
       */
      const cashout = async function() {
          try {
              // Проверяем состояние игры
              if (!state.isPlaying || state.gameData.revealedCells.length === 0) {
                  return;
              }
              
              // Проверяем наличие casinoApp
              if (!ensureCasinoApp()) {
                  return;
              }
              
              // Рассчитываем выигрыш
              const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
              
              // Тактильная обратная связь
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('success');
              }
              
              // Обновляем интерфейс
              if (elements.minerResult) {
                  elements.minerResult.innerHTML = `
                      <div class="win-icon">🎉</div>
                      <div class="win-title">Вы выиграли ${winAmount} Stars!</div>
                      <div class="win-multiplier">Множитель: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                  `;
                  elements.minerResult.classList.add('win');
              }
              
              // Сбрасываем игровое состояние
              state.isPlaying = false;
              
              if (elements.cashoutBtn) {
                  elements.cashoutBtn.disabled = true;
              }
              
              if (elements.newGameBtn) {
                  elements.newGameBtn.disabled = false;
              }
              
              // Показываем все мины
              revealAllMines();
              
              // Обрабатываем выигрыш
              await window.casinoApp.processGameResult(
                  'miner',
                  0, // Нет дополнительной ставки
                  'win',
                  winAmount,
                  {
                      revealedCells: state.gameData.revealedCells,
                      multiplier: state.gameData.currentMultiplier,
                      mines: state.gameData.mines
                  }
              );
              
              app.log('Miner', `Успешный вывод выигрыша: ${winAmount} с множителем ${state.gameData.currentMultiplier.toFixed(2)}`);
          } catch (error) {
              app.log('Miner', `Ошибка вывода выигрыша: ${error.message}`, true);
          }
      };