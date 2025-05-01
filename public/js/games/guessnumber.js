/**
 * guessnumber.js - Оптимизированная версия игры Guess the Number
 * Версия 2.0.0
 * 
 * Особенности:
 * - Неблокирующая инициализация
 * - Улучшенная обработка ошибок
 * - Совместимость с новой системой регистрации игр
 */

// Предотвращаем возможные конфликты и обеспечиваем изолированную среду
(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[GuessNumber] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('GuessNumber', 'Инициализация модуля игры Guess Number v2.0.0');
  
  // Игровая логика в замыкании для изоляции
  const guessNumberGame = (function() {
      // Элементы игры
      let elements = {
          guessBtn: null,
          guessBet: null,
          guessInput: null,
          guessResult: null,
          minRange: null,
          maxRange: null
      };
      
      // Состояние игры
      let state = {
          isProcessing: false,
          initialized: false,
          initializationStarted: false,
          minNumber: 1,
          maxNumber: 100
      };
      
      /**
       * Инициализация игры
       * С защитой от повторной инициализации и таймаутом
       */
      const init = async function() {
          // Предотвращаем повторную инициализацию
          if (state.initialized || state.initializationStarted) {
              app.log('GuessNumber', 'Инициализация уже выполнена или выполняется');
              return true;
          }
          
          state.initializationStarted = true;
          app.log('GuessNumber', 'Начало инициализации игры');
          
          try {
              // Устанавливаем таймаут для инициализации
              const initPromise = new Promise(async (resolve) => {
                  try {
                      // Получаем элементы DOM (с проверкой наличия)
                      await findDOMElements();
                      
                      // Настраиваем диапазон и отображение
                      setupRangeDisplay();
                      
                      // Добавляем обработчики событий
                      setupEventListeners();
                      
                      state.initialized = true;
                      app.log('GuessNumber', 'Инициализация успешно завершена');
                      resolve(true);
                  } catch (innerError) {
                      app.log('GuessNumber', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                      resolve(false);
                  }
              });
              
              // Устанавливаем таймаут (3 секунды)
              const timeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                      app.log('GuessNumber', 'Таймаут инициализации', true);
                      resolve(false);
                  }, 3000);
              });
              
              // Используем Promise.race для предотвращения зависания
              const result = await Promise.race([initPromise, timeoutPromise]);
              
              return result;
              
          } catch (error) {
              app.log('GuessNumber', `Критическая ошибка инициализации: ${error.message}`, true);
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
                      elements.guessBtn = document.getElementById('guess-btn');
                      elements.guessBet = document.getElementById('guess-bet');
                      elements.guessInput = document.getElementById('guess-input');
                      elements.guessResult = document.getElementById('guess-result');
                      elements.minRange = document.getElementById('min-range');
                      elements.maxRange = document.getElementById('max-range');
                      
                      // Проверяем критические элементы
                      if (!elements.guessBtn) {
                          app.log('GuessNumber', 'Предупреждение: элемент guess-btn не найден', true);
                      }
                      
                      if (!elements.guessInput) {
                          app.log('GuessNumber', 'Предупреждение: элемент guess-input не найден', true);
                      }
                      
                      resolve();
                  }, 100);
              } catch (error) {
                  app.log('GuessNumber', `Ошибка при поиске DOM элементов: ${error.message}`, true);
                  reject(error);
              }
          });
      };
      
      /**
       * Настройка отображения диапазона чисел
       */
      const setupRangeDisplay = function() {
          try {
              // Устанавливаем диапазон отображения
              if (elements.minRange) {
                  elements.minRange.textContent = state.minNumber;
              }
              
              if (elements.maxRange) {
                  elements.maxRange.textContent = state.maxNumber;
              }
              
              // Устанавливаем ограничения ввода
              if (elements.guessInput) {
                  elements.guessInput.min = state.minNumber;
                  elements.guessInput.max = state.maxNumber;
                  elements.guessInput.value = Math.floor((state.minNumber + state.maxNumber) / 2);
              }
              
              app.log('GuessNumber', 'Диапазон чисел настроен');
          } catch (error) {
              app.log('GuessNumber', `Ошибка настройки диапазона: ${error.message}`, true);
          }
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
          try {
              if (!elements.guessBtn) {
                  app.log('GuessNumber', 'Невозможно установить обработчики: кнопка не найдена', true);
                  return;
              }
              
              // Очищаем текущие обработчики (предотвращаем дублирование)
              const newGuessBtn = elements.guessBtn.cloneNode(true);
              if (elements.guessBtn.parentNode) {
                  elements.guessBtn.parentNode.replaceChild(newGuessBtn, elements.guessBtn);
              }
              elements.guessBtn = newGuessBtn;
              
              // Добавляем обработчик для кнопки угадывания
              elements.guessBtn.addEventListener('click', makeGuess);
              
              app.log('GuessNumber', 'Обработчики событий установлены');
          } catch (error) {
              app.log('GuessNumber', `Ошибка установки обработчиков: ${error.message}`, true);
          }
      };
      
      /**
       * Угадывание числа
       */
      const makeGuess = async function() {
          app.log('GuessNumber', 'Попытка угадывания числа');
          
          // Проверяем инициализацию
          if (!state.initialized) {
              app.log('GuessNumber', 'Игра не инициализирована, запускаем инициализацию', true);
              await init();
              
              // Если инициализация не удалась, выходим
              if (!state.initialized) {
                  app.log('GuessNumber', 'Не удалось запустить игру: ошибка инициализации', true);
                  return;
              }
          }
          
          try {
              // Проверка наличия casinoApp
              if (!window.casinoApp) {
                  app.log('GuessNumber', 'casinoApp не найден', true);
                  alert('Ошибка инициализации приложения');
                  return;
              }
              
              // Проверяем, не обрабатывается ли уже запрос
              if (state.isProcessing) {
                  app.log('GuessNumber', 'Запрос уже обрабатывается');
                  return;
              }
              
              // Проверка наличия элементов
              if (!elements.guessBet || !elements.guessInput) {
                  app.log('GuessNumber', 'Необходимые элементы не найдены', true);
                  window.casinoApp.showNotification('Ошибка инициализации игры');
                  return;
              }
              
              // Получаем размер ставки
              const betAmount = parseInt(elements.guessBet.value);
              
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
              
              // Получаем предположение игрока
              const playerGuess = parseInt(elements.guessInput.value);
              
              // Проверяем предположение
              if (isNaN(playerGuess) || playerGuess < state.minNumber || playerGuess > state.maxNumber) {
                  window.casinoApp.showNotification(`Пожалуйста, введите число от ${state.minNumber} до ${state.maxNumber}`);
                  return;
              }
              
              // Устанавливаем состояние обработки
              state.isProcessing = true;
              if (elements.guessBtn) {
                  elements.guessBtn.disabled = true;
              }
              
              if (elements.guessResult) {
                  elements.guessResult.textContent = '';
                  elements.guessResult.className = 'result';
              }
              
              try {
                  // Тактильная обратная связь при старте
                  if (window.casinoApp.provideTactileFeedback) {
                      window.casinoApp.provideTactileFeedback('medium');
                  }
                  
                  // Обрабатываем угадывание с таймаутом
                  const result = await processGuessWithTimeout(playerGuess);
                  
                  // Вычисляем выигрыш
                  const winAmount = result.win ? betAmount * result.multiplier : 0;
                  
                  // Отображаем результат
                  displayResult(result.win, winAmount, result.number, playerGuess);
                  
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
                      playerGuess,
                      winningNumber: result.number,
                      difference: Math.abs(result.number - playerGuess)
                  };
                  
                  await window.casinoApp.processGameResult(
                      'guessnumber',
                      betAmount,
                      result.win ? 'win' : 'lose',
                      winAmount,
                      gameData
                  );
                  
              } catch (error) {
                  app.log('GuessNumber', `Ошибка во время игры: ${error.message}`, true);
                  window.casinoApp.showNotification('Произошла ошибка. Пожалуйста, попробуйте снова.');
              } finally {
                  // Сбрасываем состояние в любом случае
                  state.isProcessing = false;
                  if (elements.guessBtn) {
                      elements.guessBtn.disabled = false;
                  }
              }
              
          } catch (error) {
              app.log('GuessNumber', `Ошибка угадывания числа: ${error.message}`, true);
              
              // Сбрасываем состояние в случае ошибки
              state.isProcessing = false;
              if (elements.guessBtn) {
                  elements.guessBtn.disabled = false;
              }
          }
      };
      
      /**
       * Обработка угадывания с таймаутом
       */
      const processGuessWithTimeout = function(playerGuess) {
          return Promise.race([
              processGuess(playerGuess),
              new Promise((_, reject) => {
                  setTimeout(() => {
                      reject(new Error('Таймаут обработки угадывания'));
                  }, 3000); // 3 секунды максимум для обработки
              })
          ]);
      };
      
      /**
       * Обработка угадывания и определение результата
       */
      const processGuess = function(playerGuess) {
          return new Promise((resolve) => {
              try {
                  // Генерируем случайное число между минимальным и максимальным (включительно)
                  const winningNumber = Math.floor(Math.random() * (state.maxNumber - state.minNumber + 1)) + state.minNumber;
                  
                  // Вычисляем разницу
                  const difference = Math.abs(winningNumber - playerGuess);
                  
                  // Определяем выигрыш и множитель
                  let result;
                  
                  if (difference === 0) {
                      // Точное совпадение
                      result = {
                          win: true,
                          multiplier: 10,
                          number: winningNumber
                      };
                  } else if (difference <= 5) {
                      // Близко (в пределах 5)
                      result = {
                          win: true,
                          multiplier: 3,
                          number: winningNumber
                      };
                  } else if (difference <= 10) {
                      // Теплее (в пределах 10)
                      result = {
                          win: true,
                          multiplier: 1.5,
                          number: winningNumber
                      };
                  } else {
                      // Проигрыш
                      result = {
                          win: false,
                          multiplier: 0,
                          number: winningNumber
                      };
                  }
                  
                  // Добавляем небольшую задержку для лучшего UX
                  setTimeout(() => {
                      resolve(result);
                  }, 500);
                  
              } catch (error) {
                  app.log('GuessNumber', `Ошибка обработки угадывания: ${error.message}`, true);
                  
                  // В случае ошибки возвращаем проигрыш
                  const fallbackNumber = Math.floor(Math.random() * (state.maxNumber - state.minNumber + 1)) + state.minNumber;
                  resolve({
                      win: false,
                      multiplier: 0,
                      number: fallbackNumber
                  });
              }
          });
      };
      
      /**
       * Отображение результата
       */
      const displayResult = function(isWin, amount, winningNumber, playerGuess) {
          try {
              if (!elements.guessResult) {
                  app.log('GuessNumber', 'Элемент результата не найден', true);
                  return;
              }
              
              if (isWin) {
                  if (winningNumber === playerGuess) {
                      elements.guessResult.textContent = `Exact match! Number was ${winningNumber}. You won ${amount} Stars! 🎉`;
                  } else {
                      elements.guessResult.textContent = `Close! Number was ${winningNumber}. You won ${amount} Stars! 🎉`;
                  }
                  elements.guessResult.classList.add('win');
              } else {
                  elements.guessResult.textContent = `Not close enough. Number was ${winningNumber}. Better luck next time!`;
                  elements.guessResult.classList.add('lose');
              }
              
          } catch (error) {
              app.log('GuessNumber', `Ошибка отображения результата: ${error.message}`, true);
          }
      };
      
      // Возвращаем публичный интерфейс
      return {
          // Основные методы
          init: init,
          makeGuess: makeGuess,
          
          // Метод для проверки состояния
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  initializationStarted: state.initializationStarted,
                  isProcessing: state.isProcessing,
                  elementsFound: {
                      guessBtn: !!elements.guessBtn,
                      guessBet: !!elements.guessBet,
                      guessInput: !!elements.guessInput,
                      guessResult: !!elements.guessResult
                  }
              };
          }
      };
  })();
  
  // Регистрируем игру во всех форматах для максимальной совместимости
  try {
      // 1. Регистрация через новую систему
      if (window.registerGame) {
          window.registerGame('guessNumberGame', guessNumberGame);
          app.log('GuessNumber', 'Игра зарегистрирована через новую систему registerGame');
      }
      
      // 2. Экспорт в глобальное пространство имен (обратная совместимость)
      window.guessNumberGame = guessNumberGame;
      app.log('GuessNumber', 'Игра экспортирована в глобальное пространство имен');
      
      // 3. Сообщаем в лог о завершении загрузки модуля
      app.log('GuessNumber', 'Модуль успешно загружен и готов к инициализации');
      
  } catch (error) {
      app.log('GuessNumber', `Ошибка регистрации игры: ${error.message}`, true);
  }
})();