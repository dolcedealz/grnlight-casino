/**
 * slots.js - Оптимизированная версия игры Slots
 * Версия 2.0.0
 * 
 * Особенности:
 * - Неблокирующая инициализация
 * - Улучшенная обработка ошибок
 * - Совместимость с новой системой регистрации игр
 * - Timeout защита для анимаций
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[Slots] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Slots', 'Инициализация модуля игры Slots v2.0.0');
  
  // Игровая логика в замыкании для изоляции
  const slotsGame = (function() {
      // Элементы игры
      let elements = {
          spinBtn: null,
          slotsResult: null,
          slotsBet: null,
          slotsContainer: null
      };
      
      // Барабаны (будут созданы динамически)
      let reels = [];
      
      // Состояние игры
      let state = {
          isSpinning: false,
          initialized: false,
          initializationStarted: false
      };
      
      // Игровые параметры
      const symbols = ['🍒', '🍋', '🍇', '🍊', '🍉', '💎', '7️⃣', '🤑'];
      
      // Матрица 3x3
      const rowCount = 3;
      const colCount = 3;
      let slotMatrix = [];
      
      // Значения символов (множители)
      const symbolValues = {
          '🍒': 2,
          '🍋': 2,
          '🍇': 3,
          '🍊': 3,
          '🍉': 4,
          '💎': 5,
          '7️⃣': 10,
          '🤑': 15
      };
      
      // Описания выигрышных комбинаций
      const winDescriptions = {
          horizontalLine: 'Горизонтальная линия! x{multiplier} выигрыш!',
          verticalLine: 'Вертикальная линия! x{multiplier} выигрыш!',
          diagonal: 'Диагональная линия! x{multiplier} выигрыш!',
          fullMatch: 'Джекпот! Все символы совпадают! x{multiplier} выигрыш!'
      };
      
      /**
       * Инициализация игры
       * С защитой от повторной инициализации и таймаутом
       */
      const init = async function() {
          // Предотвращаем повторную инициализацию
          if (state.initialized || state.initializationStarted) {
              app.log('Slots', 'Инициализация уже выполнена или выполняется');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('Slots', 'Начало инициализации игры');
          
          try {
              // Устанавливаем таймаут для инициализации
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Получаем элементы DOM (с проверкой наличия)
                      await findDOMElements();
                      
                      // Создаем контейнер для слотов
                      createSlotsContainer();
                      
                      // Заполняем начальными символами
                      populateSlots();
                      
                      // Добавляем обработчики событий
                      setupEventListeners();
                      
                      // Скрываем результат
                      if (elements.slotsResult) {
                          elements.slotsResult.style.display = 'none';
                      }
                      
                      state.initialized = true;
                      app.log('Slots', 'Инициализация успешно завершена');
                      resolve(true);
                  } catch (innerError) {
                      app.log('Slots', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Устанавливаем таймаут (3 секунды)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('Slots', 'Таймаут инициализации', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Используем Promise.race для предотвращения зависания
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('Slots', `Критическая ошибка инициализации: ${error.message}`, true);
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
                      elements.spinBtn = document.getElementById('spin-btn');
                      elements.slotsResult = document.getElementById('slots-result');
                      elements.slotsBet = document.getElementById('slots-bet');
                      elements.slotsContainer = document.querySelector('.slot-reels');
                      
                      // Проверяем критические элементы
                      if (!elements.spinBtn) {
                          app.log('Slots', 'Предупреждение: элемент spin-btn не найден', true);
                      }
                      
                      if (!elements.slotsContainer) {
                          app.log('Slots', 'Предупреждение: контейнер слотов не найден', true);
                          
                          // Пытаемся найти родительский контейнер и создать внутри него
                          const container = document.querySelector('.slots-container');
                          if (container) {
                              elements.slotsContainer = document.createElement('div');
                              elements.slotsContainer.className = 'slot-reels';
                              container.prepend(elements.slotsContainer);
                              app.log('Slots', 'Создан новый контейнер для слотов');
                          }
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('Slots', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
          if (!elements.spinBtn) {
              app.log('Slots', 'Невозможно установить обработчики: кнопка не найдена', true);
              return;
          }
          
          try {
              // Очищаем текущие обработчики (предотвращаем дублирование)
              const newSpinBtn = elements.spinBtn.cloneNode(true);
              if (elements.spinBtn.parentNode) {
                  elements.spinBtn.parentNode.replaceChild(newSpinBtn, elements.spinBtn);
              }
              elements.spinBtn = newSpinBtn;
              
              // Добавляем обработчик для кнопки вращения
              elements.spinBtn.addEventListener('click', spin);
              app.log('Slots', 'Обработчики событий установлены');
              
          } catch (error) {
              app.log('Slots', `Ошибка установки обработчиков: ${error.message}`, true);
          }
      };
      
      /**
       * Создание контейнера для слотов 3x3
       */
      const createSlotsContainer = function() {
          // Очищаем массив барабанов
          reels = [];
          
          // Проверяем наличие контейнера
          if (!elements.slotsContainer) {
              app.log('Slots', 'Невозможно создать сетку: контейнер не найден', true);
              return;
          }
          
          try {
              // Очищаем контейнер
              elements.slotsContainer.innerHTML = '';
              
              // Создаем сетку 3x3
              for (let row = 0; row < rowCount; row++) {
                  const rowElement = document.createElement('div');
                  rowElement.className = 'slot-row';
                  
                  for (let col = 0; col < colCount; col++) {
                      const reel = document.createElement('div');
                      reel.className = 'reel';
                      reel.dataset.row = row;
                      reel.dataset.col = col;
                      
                      // Создаем контейнер для символов (лента)
                      const reelStrip = document.createElement('div');
                      reelStrip.className = 'reel-strip';
                      reel.appendChild(reelStrip);
                      
                      rowElement.appendChild(reel);
                      reels.push(reelStrip);
                  }
                  
                  elements.slotsContainer.appendChild(rowElement);
              }
              
              app.log('Slots', `Создана сетка ${rowCount}x${colCount}, барабанов: ${reels.length}`);
              
          } catch (error) {
              app.log('Slots', `Ошибка создания сетки: ${error.message}`, true);
          }
      };
      
      /**
       * Заполнение слотов начальными символами
       */
      const populateSlots = function() {
          try {
              reels.forEach(reel => {
                  // Очищаем ленту
                  reel.innerHTML = '';
                  
                  // Добавляем случайный символ
                  const symbolElement = document.createElement('div');
                  symbolElement.className = 'symbol';
                  symbolElement.textContent = getRandomSymbol();
                  
                  reel.appendChild(symbolElement);
              });
          } catch (error) {
              app.log('Slots', `Ошибка заполнения слотов: ${error.message}`, true);
          }
      };
      
      /**
       * Получение случайного символа
       */
      const getRandomSymbol = function() {
          const randomIndex = Math.floor(Math.random() * symbols.length);
          return symbols[randomIndex];
      };
      
      /**
       * Получение взвешенного случайного символа с лучшим распределением
       */
      const getWeightedRandomSymbol = function() {
          // Веса символов (вероятности выпадения)
          const weights = {
              '🍒': 25, // 25% шанс
              '🍋': 20, // 20% шанс
              '🍇': 15, // 15% шанс
              '🍊': 15, // 15% шанс
              '🍉': 10, // 10% шанс
              '💎': 8,  // 8% шанс
              '7️⃣': 5,  // 5% шанс
              '🤑': 2   // 2% шанс
          };
          
          // Вычисляем общий вес
          const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
          
          // Генерируем случайное число от 0 до totalWeight
          let random = Math.random() * totalWeight;
          
          // Находим символ, соответствующий случайному числу
          for (const symbol in weights) {
              random -= weights[symbol];
              if (random <= 0) {
                  return symbol;
              }
          }
          
          // На всякий случай, если что-то пошло не так
          return symbols[0];
      };
      
      /**
       * Запуск вращения барабанов
       */
      const spin = async function() {
          app.log('Slots', 'Запуск вращения');
          
          // Проверяем инициализацию
          if (!state.initialized) {
              app.log('Slots', 'Игра не инициализирована, запускаем инициализацию', true);
              await init();
              
              // Если инициализация не удалась, выходим
              if (!state.initialized) {
                  app.log('Slots', 'Не удалось запустить игру: ошибка инициализации', true);
                  return;
              }
          }
          
          try {
              // Проверка наличия casinoApp
              if (!window.casinoApp) {
                  app.log('Slots', 'casinoApp не найден', true);
                  alert('Ошибка инициализации приложения');
                  return;
              }
              
              // Проверяем, не вращаются ли уже барабаны
              if (state.isSpinning) {
                  app.log('Slots', 'Барабаны уже вращаются');
                  return;
              }
              
              // Проверка наличия элементов
              if (!elements.slotsBet) {
                  app.log('Slots', 'Элемент ставки не найден', true);
                  return;
              }
              
              // Получаем размер ставки
              const betAmount = parseInt(elements.slotsBet.value);
              
              // Проверяем ставку
              if (isNaN(betAmount) || betAmount <= 0) {
                  window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                  return;
              }
              
              // Проверяем, достаточно ли средств
              if (betAmount > window.GreenLightApp.user.balance) {
                  window.casinoApp.showNotification('Недостаточно средств для ставки');
                  return;
              }
              
              // Устанавливаем состояние вращения
              state.isSpinning = true;
              if (elements.spinBtn) {
                  elements.spinBtn.disabled = true;
                  elements.spinBtn.textContent = 'ВРАЩЕНИЕ...';
              }
              
              // Тактильная обратная связь при запуске
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
              
              // Скрываем предыдущий результат
              if (elements.slotsResult) {
                  elements.slotsResult.style.opacity = '0';
                  elements.slotsResult.style.transform = 'translateY(20px)';
                  setTimeout(() => {
                      elements.slotsResult.textContent = '';
                      elements.slotsResult.className = 'result';
                      elements.slotsResult.style.display = 'none';
                  }, 300);
              }
              
              // Генерируем символы для матрицы 3x3
              slotMatrix = [];
              for (let row = 0; row < rowCount; row++) {
                  slotMatrix[row] = [];
                  for (let col = 0; col < colCount; col++) {
                      slotMatrix[row][col] = getWeightedRandomSymbol();
                  }
              }
              
              // Устанавливаем задержку чтобы убедиться, что UI обновился
              setTimeout(async () => {
                  try {
                      // Анимируем барабаны с разными задержками
                      const spinPromises = [];
                      
                      for (let i = 0; i < reels.length; i++) {
                          // Проверяем наличие барабана
                          if (!reels[i]) {
                              app.log('Slots', `Барабан ${i} не найден`, true);
                              continue;
                          }
                          
                          const row = Math.floor(i / colCount);
                          const col = i % colCount;
                          
                          // Добавляем таймаут для анимации
                          const animPromise = animateReelWithTimeout(
                              reels[i], 
                              slotMatrix[row][col], 
                              col * 400 + row * 100 // Задержка для каждого барабана
                          );
                          
                          spinPromises.push(animPromise);
                      }
                      
                      // Ждем окончания анимации всех барабанов
                      await Promise.all(spinPromises);
                      
                      // Проверяем результат
                      const result = checkWin(slotMatrix);
                      
                      // Рассчитываем выигрыш
                      const winAmount = result.win ? Math.floor(betAmount * result.multiplier) : 0;
                      
                      // Отображаем результат
                      displayResult(result.win, winAmount, result.description);
                      
                      // Тактильная обратная связь в зависимости от результата
                      if (result.win) {
                          if (window.casinoApp.provideTactileFeedback) {
                              window.casinoApp.provideTactileFeedback('success');
                          }
                      } else {
                          if (window.casinoApp.provideTactileFeedback) {
                              window.casinoApp.provideTactileFeedback('warning');
                          }
                      }
                      
                      // Отправляем результат на сервер
                      const gameData = {
                          matrix: slotMatrix,
                          winLines: result.winLines,
                          multiplier: result.multiplier,
                          description: result.description
                      };
                      
                      await window.casinoApp.processGameResult(
                          'slots',
                          betAmount,
                          result.win ? 'win' : 'lose',
                          winAmount,
                          gameData
                      );
                      
                  } catch (error) {
                      app.log('Slots', `Ошибка во время игры: ${error.message}`, true);
                      window.casinoApp.showNotification('Произошла ошибка. Пожалуйста, попробуйте снова.');
                  } finally {
                      // Сбрасываем состояние в любом случае
                      state.isSpinning = false;
                      if (elements.spinBtn) {
                          elements.spinBtn.disabled = false;
                          elements.spinBtn.textContent = 'КРУТИТЬ';
                      }
                  }
              }, 100);
              
          } catch (error) {
              app.log('Slots', `Ошибка запуска вращения: ${error.message}`, true);
              
              // Сбрасываем состояние в случае ошибки
              state.isSpinning = false;
              if (elements.spinBtn) {
                  elements.spinBtn.disabled = false;
                  elements.spinBtn.textContent = 'КРУТИТЬ';
              }
          }
      };
      
      /**
       * Анимация вращения барабана с таймаутом для предотвращения зависаний
       */
      const animateReelWithTimeout = function(reel, finalSymbol, delay) {
          return new Promise((resolve) => {
              // Добавляем таймаут для защиты от зависания
              const timeout = setTimeout(() => {
                  app.log('Slots', 'Таймаут анимации барабана', true);
                  
                  // В случае таймаута, показываем конечный символ без анимации
                  try {
                      reel.innerHTML = '';
                      const finalSymbolElement = document.createElement('div');
                      finalSymbolElement.className = 'symbol final';
                      finalSymbolElement.textContent = finalSymbol;
                      reel.appendChild(finalSymbolElement);
                  } catch (e) {
                      app.log('Slots', `Ошибка при аварийном отображении символа: ${e.message}`, true);
                  }
                  
                  resolve();
              }, 5000); // 5 секунд максимум для анимации
              
              try {
                  // Удаляем существующие символы
                  reel.innerHTML = '';
                  
                  // Создаем ленту символов для анимации
                  const symbolCount = 20 + Math.floor(Math.random() * 10);
                  
                  // Добавляем финальный символ в конец
                  const symbols = [];
                  for (let i = 0; i < symbolCount; i++) {
                      symbols.push(getRandomSymbol());
                  }
                  symbols.push(finalSymbol);
                  
                  // Создаем ленту символов для анимации
                  for (let i = 0; i < symbols.length; i++) {
                      const symbolElement = document.createElement('div');
                      symbolElement.className = 'symbol';
                      symbolElement.textContent = symbols[i];
                      reel.appendChild(symbolElement);
                  }
                  
                  // Запускаем анимацию с соответствующей задержкой
                  setTimeout(() => {
                      // Устанавливаем CSS переход для анимации прокрутки
                      reel.style.transition = 'transform 3s cubic-bezier(.17,.67,.83,1.3)';
                      
                      // Вычисляем высоту для прокрутки (до последнего символа)
                      const symbolHeight = 60; // Примерная высота символа
                      const scrollDistance = -(symbols.length - 1) * symbolHeight;
                      
                      // Запускаем прокрутку
                      reel.style.transform = `translateY(${scrollDistance}px)`;
                      
                      // Завершаем анимацию
                      setTimeout(() => {
                          clearTimeout(timeout); // Отменяем таймаут
                          
                          // Очищаем ленту и оставляем только конечный символ
                          reel.style.transition = 'none';
                          reel.style.transform = 'translateY(0)';
                          reel.innerHTML = '';
                          
                          const finalSymbolElement = document.createElement('div');
                          finalSymbolElement.className = 'symbol final';
                          finalSymbolElement.textContent = finalSymbol;
                          reel.appendChild(finalSymbolElement);
                          
                          // Добавляем эффект свечения для финального символа
                          finalSymbolElement.classList.add('glow');
                          
                          resolve(finalSymbol);
                      }, 3000);
                  }, delay);
                  
              } catch (error) {
                  app.log('Slots', `Ошибка анимации барабана: ${error.message}`, true);
                  clearTimeout(timeout); // Отменяем таймаут
                  resolve(); // Продолжаем выполнение даже при ошибке
              }
          });
      };
      
      /**
       * Проверка выигрыша для матрицы 3x3
       */
      const checkWin = function(matrix) {
          try {
              const winLines = [];
              let highestMultiplier = 0;
              let bestWinDescription = '';
              
              // Проверка горизонтальных линий
              for (let row = 0; row < rowCount; row++) {
                  // Если все символы в ряду одинаковые
                  if (matrix[row][0] === matrix[row][1] && matrix[row][1] === matrix[row][2]) {
                      const symbol = matrix[row][0];
                      const multiplier = symbolValues[symbol] * 1.5; // Увеличенный множитель для линии
                      
                      winLines.push({
                          type: 'horizontal',
                          row: row,
                          symbol: symbol,
                          multiplier: multiplier
                      });
                      
                      if (multiplier > highestMultiplier) {
                          highestMultiplier = multiplier;
                          bestWinDescription = winDescriptions.horizontalLine.replace('{multiplier}', multiplier);
                      }
                  }
              }
              
              // Проверка вертикальных линий
              for (let col = 0; col < colCount; col++) {
                  // Если все символы в столбце одинаковые
                  if (matrix[0][col] === matrix[1][col] && matrix[1][col] === matrix[2][col]) {
                      const symbol = matrix[0][col];
                      const multiplier = symbolValues[symbol] * 1.5; // Увеличенный множитель для линии
                      
                      winLines.push({
                          type: 'vertical',
                          col: col,
                          symbol: symbol,
                          multiplier: multiplier
                      });
                      
                      if (multiplier > highestMultiplier) {
                          highestMultiplier = multiplier;
                          bestWinDescription = winDescriptions.verticalLine.replace('{multiplier}', multiplier);
                      }
                  }
              }
              
              // Проверка диагонали сверху слева вниз справа
              if (matrix[0][0] === matrix[1][1] && matrix[1][1] === matrix[2][2]) {
                  const symbol = matrix[0][0];
                  const multiplier = symbolValues[symbol] * 2; // Увеличенный множитель для диагонали
                  
                  winLines.push({
                      type: 'diagonal',
                      direction: 'main',
                      symbol: symbol,
                      multiplier: multiplier
                  });
                  
                  if (multiplier > highestMultiplier) {
                      highestMultiplier = multiplier;
                      bestWinDescription = winDescriptions.diagonal.replace('{multiplier}', multiplier);
                  }
              }
              
              // Проверка диагонали снизу слева вверх справа
              if (matrix[2][0] === matrix[1][1] && matrix[1][1] === matrix[0][2]) {
                  const symbol = matrix[2][0];
                  const multiplier = symbolValues[symbol] * 2; // Увеличенный множитель для диагонали
                  
                  winLines.push({
                      type: 'diagonal',
                      direction: 'anti',
                      symbol: symbol,
                      multiplier: multiplier
                  });
                  
                  if (multiplier > highestMultiplier) {
                      highestMultiplier = multiplier;
                      bestWinDescription = winDescriptions.diagonal.replace('{multiplier}', multiplier);
                  }
              }
              
              // Проверка полного совпадения (все 9 символов одинаковые)
              let allSame = true;
              const firstSymbol = matrix[0][0];
              
              for (let row = 0; row < rowCount && allSame; row++) {
                  for (let col = 0; col < colCount && allSame; col++) {
                      if (matrix[row][col] !== firstSymbol) {
                          allSame = false;
                      }
                  }
              }
              
              if (allSame) {
                  const jackpotMultiplier = symbolValues[firstSymbol] * 5; // Большой множитель для джекпота
                  
                  winLines.push({
                      type: 'jackpot',
                      symbol: firstSymbol,
                      multiplier: jackpotMultiplier
                  });
                  
                  highestMultiplier = jackpotMultiplier;
                  bestWinDescription = winDescriptions.fullMatch.replace('{multiplier}', jackpotMultiplier);
              }
              
              // Возвращаем результат
              return {
                  win: winLines.length > 0,
                  multiplier: highestMultiplier,
                  winLines: winLines,
                  description: bestWinDescription || 'Повезет в следующий раз!'
              };
              
          } catch (error) {
              app.log('Slots', `Ошибка проверки выигрыша: ${error.message}`, true);
              return { win: false, multiplier: 0, winLines: [], description: 'Ошибка проверки выигрыша' };
          }
      };
      
      /**
       * Отображение результата игры
       */
      const displayResult = function(isWin, amount, description) {
          try {
              if (!elements.slotsResult) {
                  app.log('Slots', 'Элемент результата не найден', true);
                  return;
              }
              
              // Обновляем текст результата
              if (isWin) {
                  elements.slotsResult.innerHTML = `
                      <div class="win-icon">🎉</div>
                      <div class="win-title">Вы выиграли ${amount} ⭐!</div>
                      <div class="win-description">${description}</div>
                  `;
                  elements.slotsResult.classList.add('win');
                  elements.slotsResult.classList.remove('lose');
                  
                  // Подсвечиваем выигрышные линии
                  highlightWinLines();
              } else {
                  elements.slotsResult.innerHTML = `
                      <div class="lose-icon">😢</div>
                      <div class="lose-title">Не повезло</div>
                      <div class="lose-description">${description}</div>
                  `;
                  elements.slotsResult.classList.add('lose');
                  elements.slotsResult.classList.remove('win');
              }
              
              // Показываем результат с анимацией
              elements.slotsResult.style.display = 'block';
              setTimeout(() => {
                  elements.slotsResult.style.opacity = '1';
                  elements.slotsResult.style.transform = 'translateY(0)';
              }, 50);
              
          } catch (error) {
              app.log('Slots', `Ошибка отображения результата: ${error.message}`, true);
          }
      };
      
      /**
       * Подсветка выигрышных линий
       */
      const highlightWinLines = function() {
          try {
              const reelElements = document.querySelectorAll('.reel');
              reelElements.forEach(reel => {
                  const row = parseInt(reel.dataset.row);
                  const col = parseInt(reel.dataset.col);
                  
                  // Проверяем, входит ли этот символ в выигрышную линию
                  let isWinningSymbol = false;
                  
                  // Горизонтальные линии
                  if (row < rowCount && col < colCount && 
                      slotMatrix[row][0] === slotMatrix[row][1] && 
                      slotMatrix[row][1] === slotMatrix[row][2]) {
                      isWinningSymbol = true;
                  }
                  
                  // Вертикальные линии
                  if (row < rowCount && col < colCount && 
                      slotMatrix[0][col] === slotMatrix[1][col] && 
                      slotMatrix[1][col] === slotMatrix[2][col]) {
                      isWinningSymbol = true;
                  }
                  
                  // Главная диагональ
                  if (row === col && 
                      slotMatrix[0][0] === slotMatrix[1][1] && 
                      slotMatrix[1][1] === slotMatrix[2][2]) {
                      isWinningSymbol = true;
                  }
                  
                  // Побочная диагональ
                  if (row + col === 2 && 
                      slotMatrix[2][0] === slotMatrix[1][1] && 
                      slotMatrix[1][1] === slotMatrix[0][2]) {
                      isWinningSymbol = true;
                  }
                  
                  // Подсвечиваем выигрышные символы
                  if (isWinningSymbol) {
                      const symbolElement = reel.querySelector('.symbol');
                      if (symbolElement) {
                          symbolElement.classList.add('winning');
                      }
                  }
              });
          } catch (error) {
              app.log('Slots', `Ошибка подсветки линий: ${error.message}`, true);
          }
      };
      
      // Возвращаем публичный интерфейс
      return {
          // Основные методы
          init: init,
          spin: spin,
          
          // Метод для ручного создания контейнера (для отладки)
          createContainer: createSlotsContainer,
          
          // Метод для проверки состояния
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isSpinning: state.isSpinning,
                  elementsFound: {
                      spinBtn: !!elements.spinBtn,
                      slotsResult: !!elements.slotsResult,
                      slotsBet: !!elements.slotsBet,
                      slotsContainer: !!elements.slotsContainer
                  },
                  reelsCount: reels.length
              };
          }
      };
  })();
  
  // Регистрируем игру во всех форматах для максимальной совместимости
  try {
      // 1. Регистрация через новую систему
      if (window.registerGame) {
          window.registerGame('slotsGame', slotsGame);
          app.log('Slots', 'Игра зарегистрирована через новую систему registerGame');
      }
      
      // 2. Экспорт в глобальное пространство имен (обратная совместимость)
      window.slotsGame = slotsGame;
      app.log('Slots', 'Игра экспортирована в глобальное пространство имен');
      
      // 3. Сообщаем в лог о завершении загрузки модуля
      app.log('Slots', 'Модуль успешно загружен и готов к инициализации');
      
  } catch (error) {
      app.log('Slots', `Ошибка регистрации игры: ${error.message}`, true);
  }
})();