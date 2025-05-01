/**
 * roulette.js - Оптимизированная версия игры Roulette
 * Версия 2.0.0
 * 
 * Особенности:
 * - Неблокирующая инициализация
 * - Улучшенная обработка ошибок
 * - Таймауты для всех асинхронных операций
 * - Совместимость с новой системой регистрации игр
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[Roulette] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Roulette', 'Инициализация модуля игры Roulette v2.0.0');
  
  // Игровая логика в замыкании для изоляции
  const rouletteGame = (function() {
      // Элементы игры
      let elements = {
          spinWheelBtn: null,
          rouletteBet: null,
          rouletteBetType: null,
          betColorContainer: null,
          betNumberContainer: null,
          betOddEvenContainer: null,
          rouletteNumber: null,
          colorBtns: [],
          oddEvenBtns: [],
          wheelInner: null,
          rouletteBall: null,
          rouletteResult: null
      };
      
      // Состояние игры
      let state = {
          isSpinning: false,
          initialized: false,
          initializationStarted: false,
          selectedBetType: 'color',
          selectedColor: null,
          selectedOddEven: null
      };
      
      // Числа на рулетке
      const numbers = [
          0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
      ];
      
      // Карта цветов для чисел
      const numberColors = {
          '0': 'green',
          '1': 'red',
          '2': 'black',
          '3': 'red',
          '4': 'black',
          '5': 'red',
          '6': 'black',
          '7': 'red',
          '8': 'black',
          '9': 'red',
          '10': 'black',
          '11': 'black',
          '12': 'red',
          '13': 'black',
          '14': 'red',
          '15': 'black',
          '16': 'red',
          '17': 'black',
          '18': 'red',
          '19': 'red',
          '20': 'black',
          '21': 'red',
          '22': 'black',
          '23': 'red',
          '24': 'black',
          '25': 'red',
          '26': 'black',
          '27': 'red',
          '28': 'black',
          '29': 'black',
          '30': 'red',
          '31': 'black',
          '32': 'red',
          '33': 'black',
          '34': 'red',
          '35': 'black',
          '36': 'red'
      };
      
      /**
       * Инициализация игры
       * С защитой от повторной инициализации и таймаутом
       */
      const init = async function() {
          // Предотвращаем повторную инициализацию
          if (state.initialized || state.initializationStarted) {
              app.log('Roulette', 'Инициализация уже выполнена или выполняется');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('Roulette', 'Начало инициализации игры');
          
          try {
              // Устанавливаем таймаут для инициализации
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Получаем элементы DOM (с проверкой наличия)
                      await findDOMElements();
                      
                      // Настраиваем рулетку
                      setupWheel();
                      
                      // Добавляем обработчики событий
                      setupEventListeners();
                      
                      state.initialized = true;
                      app.log('Roulette', 'Инициализация успешно завершена');
                      resolve(true);
                  } catch (innerError) {
                      app.log('Roulette', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Устанавливаем таймаут (3 секунды)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('Roulette', 'Таймаут инициализации', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Используем Promise.race для предотвращения зависания
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('Roulette', `Критическая ошибка инициализации: ${error.message}`, true);
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
                      elements.spinWheelBtn = document.getElementById('spin-wheel-btn');
                      elements.rouletteBet = document.getElementById('roulette-bet');
                      elements.rouletteBetType = document.getElementById('roulette-bet-type');
                      elements.betColorContainer = document.getElementById('bet-color-container');
                      elements.betNumberContainer = document.getElementById('bet-number-container');
                      elements.betOddEvenContainer = document.getElementById('bet-odd-even-container');
                      elements.rouletteNumber = document.getElementById('roulette-number');
                      elements.colorBtns = document.querySelectorAll('.color-btn');
                      elements.oddEvenBtns = document.querySelectorAll('.odd-even-btn');
                      elements.wheelInner = document.getElementById('wheel-inner');
                      elements.rouletteBall = document.getElementById('roulette-ball');
                      elements.rouletteResult = document.getElementById('roulette-result');
                      
                      // Проверяем критические элементы
                      if (!elements.spinWheelBtn) {
                          app.log('Roulette', 'Предупреждение: элемент spin-wheel-btn не найден', true);
                      }
                      
                      if (!elements.wheelInner) {
                          app.log('Roulette', 'Предупреждение: элемент wheel-inner не найден', true);
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('Roulette', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Настройка рулетки
       */
      const setupWheel = function() {
          try {
              if (!elements.wheelInner) {
                  app.log('Roulette', 'Невозможно настроить колесо: элемент wheel-inner не найден', true);
                  return;
              }
              
              // Очищаем текущее колесо
              elements.wheelInner.innerHTML = '';
              
              // Создаем числовые ячейки
              numbers.forEach((number, index) => {
                  // Вычисляем позицию на колесе
                  const angle = (index * 360 / numbers.length);
                  const color = numberColors[number.toString()];
                  
                  // Создаем элемент числа
                  const numberElement = document.createElement('div');
                  numberElement.className = `wheel-number ${color}`;
                  numberElement.textContent = number;
                  numberElement.style.transform = `rotate(${angle}deg) translateY(-110px)`;
                  
                  elements.wheelInner.appendChild(numberElement);
              });
              
              // Позиционируем шарик
              if (elements.rouletteBall) {
                  elements.rouletteBall.style.transform = 'rotate(0deg) translateY(-90px)';
              }
              
              app.log('Roulette', 'Колесо рулетки успешно настроено');
          } catch (error) {
              app.log('Roulette', `Ошибка настройки колеса: ${error.message}`, true);
          }
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
          try {
              // Кнопка вращения
              if (elements.spinWheelBtn) {
                  // Очищаем текущие обработчики (предотвращаем дублирование)
                  const newSpinBtn = elements.spinWheelBtn.cloneNode(true);
                  if (elements.spinWheelBtn.parentNode) {
                      elements.spinWheelBtn.parentNode.replaceChild(newSpinBtn, elements.spinWheelBtn);
                  }
                  elements.spinWheelBtn = newSpinBtn;
                  
                  // Добавляем обработчик
                  elements.spinWheelBtn.addEventListener('click', spin);
              }
              
              // Выбор типа ставки
              if (elements.rouletteBetType) {
                  elements.rouletteBetType.addEventListener('change', changeBetType);
              }
              
              // Кнопки выбора цвета
              elements.colorBtns.forEach(btn => {
                  btn.addEventListener('click', selectColor);
              });
              
              // Кнопки выбора четное/нечетное
              elements.oddEvenBtns.forEach(btn => {
                  btn.addEventListener('click', selectOddEven);
              });
              
              app.log('Roulette', 'Обработчики событий установлены');
          } catch (error) {
              app.log('Roulette', `Ошибка установки обработчиков: ${error.message}`, true);
          }
      };
      
      /**
       * Изменение типа ставки
       */
      const changeBetType = function() {
          try {
              if (!elements.rouletteBetType) return;
              
              state.selectedBetType = elements.rouletteBetType.value;
              
              // Скрываем все контейнеры
              if (elements.betColorContainer) {
                  elements.betColorContainer.classList.add('hidden');
              }
              
              if (elements.betNumberContainer) {
                  elements.betNumberContainer.classList.add('hidden');
              }
              
              if (elements.betOddEvenContainer) {
                  elements.betOddEvenContainer.classList.add('hidden');
              }
              
              // Показываем соответствующий контейнер
              switch (state.selectedBetType) {
                  case 'color':
                      if (elements.betColorContainer) {
                          elements.betColorContainer.classList.remove('hidden');
                      }
                      break;
                  case 'number':
                      if (elements.betNumberContainer) {
                          elements.betNumberContainer.classList.remove('hidden');
                      }
                      break;
                  case 'odd-even':
                      if (elements.betOddEvenContainer) {
                          elements.betOddEvenContainer.classList.remove('hidden');
                      }
                      break;
              }
              
              // Сбрасываем выбор
              state.selectedColor = null;
              state.selectedOddEven = null;
              
              elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
              elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
              
          } catch (error) {
              app.log('Roulette', `Ошибка изменения типа ставки: ${error.message}`, true);
          }
      };
      
      /**
       * Выбор цвета
       */
      const selectColor = function(event) {
          try {
              // Снимаем выделение со всех кнопок цвета
              elements.colorBtns.forEach(btn => btn.classList.remove('selected'));
              
              // Добавляем выделение выбранной кнопке
              event.target.classList.add('selected');
              
              // Сохраняем выбранный цвет
              state.selectedColor = event.target.getAttribute('data-color');
              
          } catch (error) {
              app.log('Roulette', `Ошибка выбора цвета: ${error.message}`, true);
          }
      };
      
      /**
       * Выбор четное/нечетное
       */
      const selectOddEven = function(event) {
          try {
              // Снимаем выделение со всех кнопок четное/нечетное
              elements.oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
              
              // Добавляем выделение выбранной кнопке
              event.target.classList.add('selected');
              
              // Сохраняем выбранный тип
              state.selectedOddEven = event.target.getAttribute('data-type');
              
          } catch (error) {
              app.log('Roulette', `Ошибка выбора четного/нечетного: ${error.message}`, true);
          }
      };
      
      /**
       * Вращение колеса
       */
      const spin = async function() {
          app.log('Roulette', 'Запуск вращения колеса');
          
          // Проверяем инициализацию
          if (!state.initialized) {
              app.log('Roulette', 'Игра не инициализирована, запускаем инициализацию', true);
              await init();
              
              // Если инициализация не удалась, выходим
              if (!state.initialized) {
                  app.log('Roulette', 'Не удалось запустить игру: ошибка инициализации', true);
                  return;
              }
          }
          
          try {
              // Проверка наличия casinoApp
              if (!window.casinoApp) {
                  app.log('Roulette', 'casinoApp не найден', true);
                  alert('Ошибка инициализации приложения');
                  return;
              }
              
              // Проверяем, не вращается ли уже колесо
              if (state.isSpinning) {
                  app.log('Roulette', 'Колесо уже вращается');
                  return;
              }
              
              // Проверка наличия элементов
              if (!elements.rouletteBet) {
                  app.log('Roulette', 'Элемент ставки не найден', true);
                  return;
              }
              
              // Получаем размер ставки
              const betAmount = parseInt(elements.rouletteBet.value);
              
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
              
              // Проверяем выбор типа ставки
              if (state.selectedBetType === 'color' && !state.selectedColor) {
                  window.casinoApp.showNotification('Пожалуйста, выберите цвет');
                  return;
              }
              
              if (state.selectedBetType === 'odd-even' && !state.selectedOddEven) {
                  window.casinoApp.showNotification('Пожалуйста, выберите четное или нечетное');
                  return;
              }
              
              if (state.selectedBetType === 'number' && !elements.rouletteNumber) {
                  window.casinoApp.showNotification('Ошибка элемента выбора числа');
                  return;
              }
              
              if (state.selectedBetType === 'number') {
                  const number = parseInt(elements.rouletteNumber.value);
                  if (isNaN(number) || number < 0 || number > 36) {
                      window.casinoApp.showNotification('Пожалуйста, введите число от 0 до 36');
                      return;
                  }
              }
              
              // Устанавливаем состояние вращения
              state.isSpinning = true;
              if (elements.spinWheelBtn) {
                  elements.spinWheelBtn.disabled = true;
              }
              
              if (elements.rouletteResult) {
                  elements.rouletteResult.textContent = '';
                  elements.rouletteResult.className = 'result';
              }
              
              // Тактильная обратная связь при запуске
              if (window.casinoApp.provideTactileFeedback) {
                  window.casinoApp.provideTactileFeedback('medium');
              }
              
              // Запускаем вращение с защитой от зависания
              try {
                  // Ограничиваем время ожидания анимации
                  const spinResult = await spinWheelWithTimeout();
                  
                  // Проверяем, выиграл ли игрок
                  const winResult = checkWin(spinResult);
                  
                  // Вычисляем выигрыш
                  const winAmount = winResult.win ? betAmount * winResult.multiplier : 0;
                  
                  // Отображаем результат
                  displayResult(winResult.win, winAmount, spinResult);
                  
                  // Тактильная обратная связь в зависимости от результата
                  if (winResult.win) {
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
                      number: spinResult,
                      color: numberColors[spinResult.toString()],
                      betType: state.selectedBetType,
                      selectedColor: state.selectedColor,
                      selectedNumber: state.selectedBetType === 'number' ? 
                          parseInt(elements.rouletteNumber.value) : null,
                      selectedOddEven: state.selectedOddEven
                  };
                  
                  await window.casinoApp.processGameResult(
                      'roulette',
                      betAmount,
                      winResult.win ? 'win' : 'lose',
                      winAmount,
                      gameData
                  );
                  
              } catch (error) {
                  app.log('Roulette', `Ошибка во время игры: ${error.message}`, true);
                  window.casinoApp.showNotification('Произошла ошибка. Пожалуйста, попробуйте снова.');
              } finally {
                  // Сбрасываем состояние в любом случае
                  state.isSpinning = false;
                  if (elements.spinWheelBtn) {
                      elements.spinWheelBtn.disabled = false;
                  }
              }
              
          } catch (error) {
              app.log('Roulette', `Ошибка запуска вращения: ${error.message}`, true);
              
              // Сбрасываем состояние в случае ошибки
              state.isSpinning = false;
              if (elements.spinWheelBtn) {
                  elements.spinWheelBtn.disabled = false;
              }
          }
      };
      
      /**
       * Анимация вращения колеса с таймаутом
       */
      const spinWheelWithTimeout = function() {
          return Promise.race([
              spinWheel(),
              new Promise((_, reject) => {
                  setTimeout(() => {
                      reject(new Error('Таймаут анимации вращения'));
                  }, 6000); // 6 секунд максимум для анимации
              })
          ]);
      };
      
      /**
       * Анимация вращения колеса
       */
      const spinWheel = function() {
          return new Promise((resolve) => {
              try {
                  // Получаем случайное число полных оборотов (3-6 оборотов)
                  const rotations = 3 + Math.floor(Math.random() * 3);
                  
                  // Получаем случайный результат
                  const randomIndex = Math.floor(Math.random() * numbers.length);
                  const winningNumber = numbers[randomIndex];
                  
                  // Вычисляем конечную позицию
                  const finalAngle = rotations * 360 + (randomIndex * 360 / numbers.length);
                  
                  if (!elements.wheelInner || !elements.rouletteBall) {
                      app.log('Roulette', 'Элементы колеса не найдены', true);
                      // Возвращаем результат даже без анимации
                      setTimeout(() => resolve(winningNumber), 1000);
                      return;
                  }
                  
                  // Анимируем колесо и шарик
                  elements.wheelInner.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                  elements.rouletteBall.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                  
                  elements.wheelInner.style.transform = `rotate(${-finalAngle}deg)`;
                  elements.rouletteBall.style.transform = `rotate(${finalAngle}deg) translateY(-90px)`;
                  
                  // Возвращаем результат после завершения анимации
                  setTimeout(() => {
                      resolve(winningNumber);
                  }, 4500);
              } catch (error) {
                  app.log('Roulette', `Ошибка анимации колеса: ${error.message}`, true);
                  // Генерируем случайное число даже в случае ошибки анимации
                  const fallbackNumber = numbers[Math.floor(Math.random() * numbers.length)];
                  resolve(fallbackNumber);
              }
          });
      };
      
      /**
       * Проверка выигрыша
       */
      const checkWin = function(result) {
          try {
              const resultColor = numberColors[result.toString()];
              const isOdd = result !== 0 && result % 2 === 1;
              
              switch (state.selectedBetType) {
                  case 'color':
                      if (state.selectedColor === resultColor) {
                          return {
                              win: true,
                              multiplier: resultColor === 'green' ? 36 : 2 // Green (0) pays 36:1, red/black pays 2:1
                          };
                      }
                      break;
                      
                  case 'number':
                      if (!elements.rouletteNumber) return { win: false, multiplier: 0 };
                      
                      const selectedNumber = parseInt(elements.rouletteNumber.value);
                      if (selectedNumber === result) {
                          return {
                              win: true,
                              multiplier: 36 // Straight up bet pays 36:1
                          };
                      }
                      break;
                      
                  case 'odd-even':
                      if (result === 0) {
                          // 0 is neither odd nor even in roulette rules
                          return { win: false, multiplier: 0 };
                      }
                      
                      if ((state.selectedOddEven === 'odd' && isOdd) || 
                          (state.selectedOddEven === 'even' && !isOdd)) {
                          return {
                              win: true,
                              multiplier: 2 // Odd/Even pays 2:1
                          };
                      }
                      break;
              }
              
              return { win: false, multiplier: 0 };
              
          } catch (error) {
              app.log('Roulette', `Ошибка проверки выигрыша: ${error.message}`, true);
              return { win: false, multiplier: 0 };
          }
      };
      
      /**
       * Отображение результата
       */
      const displayResult = function(isWin, amount, number) {
          try {
              if (!elements.rouletteResult) {
                  app.log('Roulette', 'Элемент результата не найден', true);
                  return;
              }
              
              if (isWin) {
                  elements.rouletteResult.textContent = `Number ${number} - You won ${amount} Stars! 🎉`;
                  elements.rouletteResult.classList.add('win');
              } else {
                  elements.rouletteResult.textContent = `Number ${number} - Better luck next time!`;
                  elements.rouletteResult.classList.add('lose');
              }
              
          } catch (error) {
              app.log('Roulette', `Ошибка отображения результата: ${error.message}`, true);
          }
      };
      
      // Возвращаем публичный интерфейс
      return {
          // Основные методы
          init: init,
          spin: spin,
          
          // Метод для проверки состояния
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isSpinning: state.isSpinning,
                  elementsFound: {
                      spinWheelBtn: !!elements.spinWheelBtn,
                      rouletteBet: !!elements.rouletteBet,
                      wheelInner: !!elements.wheelInner,
                      rouletteBall: !!elements.rouletteBall
                  }
              };
          }
      };
  })();
  
  // Регистрируем игру во всех форматах для максимальной совместимости
  try {
      // 1. Регистрация через новую систему
      if (window.registerGame) {
          window.registerGame('rouletteGame', rouletteGame);
          app.log('Roulette', 'Игра зарегистрирована через новую систему registerGame');
      }
      
      // 2. Экспорт в глобальное пространство имен (обратная совместимость)
      window.rouletteGame = rouletteGame;
      app.log('Roulette', 'Игра экспортирована в глобальное пространство имен');
      
      // 3. Сообщаем в лог о завершении загрузки модуля
      app.log('Roulette', 'Модуль успешно загружен и готов к инициализации');
      
  } catch (error) {
      app.log('Roulette', `Ошибка регистрации игры: ${error.message}`, true);
  }
})();