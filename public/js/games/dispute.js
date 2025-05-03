/**
 * dispute.js - Модуль для игры "Спор" (подбрасывание монетки)
 * Версия 1.0.0
 */

(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[Dispute] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          }
      };
  }
  
  const app = window.GreenLightApp;
  app.log('Dispute', 'Инициализация модуля игры Dispute v1.0.0');
  
  // Игровая логика в замыкании для изоляции
  const disputeGame = (function() {
      // Элементы игры
      let elements = {
          disputeContainer: null,
          headsBtn: null,
          tailsBtn: null,
          flipBtn: null,
          coinAnimation: null,
          disputeResult: null,
          disputeInfo: null,
          opponentChoice: null,
          myChoice: null
      };
      
      // Состояние игры
      let state = {
          initialized: false,
          disputeId: null,
          myTelegramId: null,
          opponentTelegramId: null,
          disputeData: null,
          myChoice: null,
          isFlipping: false
      };
      
      /**
       * Инициализация игры
       */
      const init = async function() {
          if (state.initialized) {
              app.log('Dispute', 'Игра уже инициализирована');
              return true;
          }
          
          try {
              app.log('Dispute', 'Начало инициализации игры');
              
              // Получаем ID спора из URL
              const urlParams = new URLSearchParams(window.location.search);
              state.disputeId = urlParams.get('disputeId');
              
              if (!state.disputeId) {
                  app.log('Dispute', 'ID спора не найден в URL', true);
                  return false;
              }
              
              // Получаем данные текущего пользователя
              if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
                  state.myTelegramId = window.Telegram.WebApp.initDataUnsafe.user?.id;
              }
              
              // Получаем элементы DOM
              await findDOMElements();
              
              // Загружаем данные спора
              await loadDisputeData();
              
              // Настраиваем обработчики событий
              setupEventListeners();
              
              // Обновляем интерфейс
              updateUI();
              
              state.initialized = true;
              app.log('Dispute', 'Инициализация успешно завершена');
              return true;
              
          } catch (error) {
              app.log('Dispute', `Ошибка инициализации: ${error.message}`, true);
              return false;
          }
      };
      
      /**
       * Поиск DOM элементов
       */
      const findDOMElements = async function() {
          return new Promise((resolve) => {
              elements.disputeContainer = document.getElementById('dispute-container');
              elements.headsBtn = document.getElementById('heads-btn');
              elements.tailsBtn = document.getElementById('tails-btn');
              elements.flipBtn = document.getElementById('flip-btn');
              elements.coinAnimation = document.getElementById('coin-animation');
              elements.disputeResult = document.getElementById('dispute-result');
              elements.disputeInfo = document.getElementById('dispute-info');
              elements.opponentChoice = document.getElementById('opponent-choice');
              elements.myChoice = document.getElementById('my-choice');
              
              resolve();
          });
      };
      
      /**
       * Загрузка данных спора
       */
      const loadDisputeData = async function() {
          try {
              const response = await fetch(`/api/disputes/${state.disputeId}`);
              
              if (!response.ok) {
                  throw new Error('Ошибка загрузки данных спора');
              }
              
              const data = await response.json();
              state.disputeData = data.dispute;
              
              // Определяем, кто мы в этом споре
              if (state.myTelegramId === data.dispute.creatorId) {
                  state.opponentTelegramId = data.dispute.opponentId;
              } else {
                  state.opponentTelegramId = data.dispute.creatorId;
              }
              
              app.log('Dispute', 'Данные спора загружены успешно');
              
          } catch (error) {
              app.log('Dispute', `Ошибка загрузки данных: ${error.message}`, true);
              throw error;
          }
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
          if (elements.headsBtn) {
              elements.headsBtn.addEventListener('click', () => chooseSide('heads'));
          }
          
          if (elements.tailsBtn) {
              elements.tailsBtn.addEventListener('click', () => chooseSide('tails'));
          }
          
          if (elements.flipBtn) {
              elements.flipBtn.addEventListener('click', flipCoin);
          }
      };
      
      /**
       * Выбор стороны монеты
       */
      const chooseSide = async function(side) {
          if (state.myChoice) {
              app.log('Dispute', 'Сторона уже выбрана');
              return;
          }
          
          try {
              const response = await fetch(`/api/disputes/${state.disputeId}/choose-side`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      telegramId: state.myTelegramId,
                      side: side
                  })
              });
              
              if (!response.ok) {
                  throw new Error('Ошибка выбора стороны');
              }
              
              const data = await response.json();
              state.disputeData = data.dispute;
              state.myChoice = side;
              
              updateUI();
              
              // Проверяем, готовы ли оба игрока
              checkReadyToFlip();
              
          } catch (error) {
              app.log('Dispute', `Ошибка выбора стороны: ${error.message}`, true);
              if (window.casinoApp) {
                  window.casinoApp.showNotification('Ошибка выбора стороны');
              }
          }
      };
      
      /**
       * Проверка готовности к броску
       */
      const checkReadyToFlip = function() {
          if (state.disputeData.status === 'in_progress') {
              if (elements.flipBtn) {
                  elements.flipBtn.disabled = false;
                  elements.flipBtn.textContent = 'ПОДБРОСИТЬ МОНЕТУ';
              }
          }
      };
      
      /**
       * Подбрасывание монеты
       */
      const flipCoin = async function() {
          if (state.isFlipping) return;
          
          try {
              state.isFlipping = true;
              
              // Запускаем анимацию
              if (elements.coinAnimation) {
                  elements.coinAnimation.classList.add('flipping');
              }
              
              // Отправляем запрос на сервер
              const response = await fetch(`/api/disputes/${state.disputeId}/flip`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  }
              });
              
              if (!response.ok) {
                  throw new Error('Ошибка подбрасывания монеты');
              }
              
              const data = await response.json();
              
              // Ждем окончания анимации
              setTimeout(() => {
                  if (elements.coinAnimation) {
                      elements.coinAnimation.classList.remove('flipping');
                      elements.coinAnimation.classList.add(data.coinResult);
                  }
                  
                  // Показываем результат
                  showResult(data);
              }, 2000);
              
          } catch (error) {
              app.log('Dispute', `Ошибка подбрасывания монеты: ${error.message}`, true);
              state.isFlipping = false;
          }
      };
      
      /**
       * Показ результата
       */
      const showResult = function(data) {
          if (!elements.disputeResult) return;
          
          const isWinner = data.winnerId === state.myTelegramId;
          const resultText = isWinner ? 
              `🎉 Поздравляем! Вы выиграли ${data.winAmount} ⭐!` : 
              `😔 К сожалению, вы проиграли ${state.disputeData.amount} ⭐`;
          
          elements.disputeResult.innerHTML = `
              <div class="result-icon">${isWinner ? '🏆' : '❌'}</div>
              <div class="result-text">${resultText}</div>
              <div class="coin-result">Выпало: ${data.coinResult === 'heads' ? 'Орел' : 'Решка'}</div>
              <button class="action-btn" onclick="window.location.href='/'">Вернуться в казино</button>
          `;
          
          elements.disputeResult.classList.add(isWinner ? 'win' : 'lose');
          
          // Обновляем баланс
          if (window.GreenLightApp && window.GreenLightApp.user) {
              if (isWinner) {
                  window.GreenLightApp.user.balance += data.winAmount;
              } else {
                  window.GreenLightApp.user.balance -= state.disputeData.amount;
              }
              
              if (window.casinoApp && window.casinoApp.updateBalance) {
                  window.casinoApp.updateBalance();
              }
          }
      };
      
      /**
       * Обновление интерфейса
       */
      const updateUI = function() {
          if (!state.disputeData) return;
          
          // Обновляем информацию о споре
          if (elements.disputeInfo) {
              elements.disputeInfo.innerHTML = `
                  <div>Сумма спора: ${state.disputeData.amount} ⭐</div>
                  <div>Статус: ${getStatusText(state.disputeData.status)}</div>
              `;
          }
          
          // Показываем выбор игрока
          if (elements.myChoice && state.myChoice) {
              elements.myChoice.textContent = `Ваш выбор: ${state.myChoice === 'heads' ? 'Орел' : 'Решка'}`;
          }
          
          // Показываем выбор оппонента (если оба выбрали)
          if (elements.opponentChoice && state.disputeData.status === 'in_progress') {
              elements.opponentChoice.textContent = 'Оппонент сделал выбор';
          }
          
          // Обновляем кнопки
          if (state.myChoice) {
              if (elements.headsBtn) elements.headsBtn.disabled = true;
              if (elements.tailsBtn) elements.tailsBtn.disabled = true;
          }
          
          // Активируем кнопку броска если оба готовы
          if (state.disputeData.status === 'in_progress' && elements.flipBtn) {
              elements.flipBtn.disabled = false;
          }
      };
      
      /**
       * Получение текста статуса
       */
      const getStatusText = function(status) {
          switch (status) {
              case 'pending': return 'Ожидание оппонента';
              case 'accepted': return 'Выберите сторону монеты';
              case 'in_progress': return 'Готов к броску';
              case 'completed': return 'Завершен';
              default: return status;
          }
      };
      
      // Возвращаем публичный интерфейс
      return {
          init: init,
          getStatus: function() {
              return {
                  initialized: state.initialized,
                  disputeId: state.disputeId,
                  myChoice: state.myChoice,
                  isFlipping: state.isFlipping
              };
          }
      };
  })();
  
  // Регистрируем игру
  if (window.registerGame) {
      window.registerGame('disputeGame', disputeGame);
      app.log('Dispute', 'Игра зарегистрирована через систему registerGame');
  }
  
  window.disputeGame = disputeGame;
  app.log('Dispute', 'Модуль успешно загружен и готов к инициализации');
})();