/**
 * dispute.js - Модуль для игры "Спор" (споры с вопросами и голосованием)
 * Версия 2.0.0
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
    app.log('Dispute', 'Инициализация модуля игры Dispute v2.0.0');
    
    // Игровая логика в замыкании для изоляции
    const disputeGame = (function() {
      // Элементы игры
      let elements = {
        // Основные контейнеры
        disputeContainer: null,
        disputeQuestion: null,
        disputeInfo: null,
        
        // Элементы выбора
        yesBtn: null,
        noBtn: null,
        myChoiceDisplay: null,
        opponentChoiceDisplay: null,
        
        // Элементы голосования
        votingContainer: null,
        voteCreatorBtn: null,
        voteOpponentBtn: null,
        votingResults: null,
        
        // Результаты
        disputeResult: null,
        
        // Табы и списки
        createTab: null,
        activeTab: null,
        pendingTab: null,
        historyTab: null,
        
        createContent: null,
        activeContent: null,
        pendingContent: null,
        historyContent: null,
        
        // Форма создания
        createForm: null,
        opponentUsername: null,
        disputeBet: null,
        disputeQuestionInput: null,
        createDisputeBtn: null,
        
        // Списки
        activeDisputesList: null,
        pendingDisputesList: null,
        historyDisputesList: null
      };
      
      // Состояние игры
      let state = {
        initialized: false,
        currentTab: 'create',
        disputeId: null,
        disputeData: null,
        myChoice: null,
        isProcessing: false,
        disputes: {
          active: [],
          pending: [],
          history: []
        }
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
          
          // Получаем элементы DOM
          await findDOMElements();
          
          // Настраиваем обработчики событий
          setupEventListeners();
          
          // Проверяем, есть ли ID спора в URL
          const urlParams = new URLSearchParams(window.location.search);
          state.disputeId = urlParams.get('disputeId');
          
          if (state.disputeId) {
            // Если есть ID, загружаем конкретный спор
            await loadDispute(state.disputeId);
          } else {
            // Иначе показываем основной интерфейс
            showTab('create');
            await loadAllDisputes();
          }
          
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
          // Основные контейнеры
          elements.disputeContainer = document.getElementById('dispute-container');
          elements.disputeQuestion = document.getElementById('dispute-question');
          elements.disputeInfo = document.getElementById('dispute-info');
          
          // Элементы выбора
          elements.yesBtn = document.getElementById('yes-btn');
          elements.noBtn = document.getElementById('no-btn');
          elements.myChoiceDisplay = document.getElementById('my-choice-display');
          elements.opponentChoiceDisplay = document.getElementById('opponent-choice-display');
          
          // Элементы голосования
          elements.votingContainer = document.getElementById('voting-container');
          elements.voteCreatorBtn = document.getElementById('vote-creator-btn');
          elements.voteOpponentBtn = document.getElementById('vote-opponent-btn');
          elements.votingResults = document.getElementById('voting-results');
          
          // Результаты
          elements.disputeResult = document.getElementById('dispute-result');
          
          // Табы
          elements.createTab = document.getElementById('create-dispute-tab');
          elements.activeTab = document.getElementById('active-disputes-tab');
          elements.pendingTab = document.getElementById('pending-disputes-tab');
          elements.historyTab = document.getElementById('history-disputes-tab');
          
          // Контент табов
          elements.createContent = document.getElementById('create-dispute-content');
          elements.activeContent = document.getElementById('active-disputes-content');
          elements.pendingContent = document.getElementById('pending-disputes-content');
          elements.historyContent = document.getElementById('history-disputes-content');
          
          // Форма создания
          elements.createForm = document.querySelector('.dispute-form');
          elements.opponentUsername = document.getElementById('opponent-username');
          elements.disputeBet = document.getElementById('dispute-bet');
          elements.disputeQuestionInput = document.getElementById('dispute-question');
          elements.createDisputeBtn = document.getElementById('create-dispute-btn');
          
          // Списки
          elements.activeDisputesList = document.getElementById('active-disputes-list');
          elements.pendingDisputesList = document.getElementById('pending-disputes-list');
          elements.historyDisputesList = document.getElementById('history-disputes-list');
          
          resolve();
        });
      };
      
      /**
       * Настройка обработчиков событий
       */
      const setupEventListeners = function() {
        // Обработчики табов
        if (elements.createTab) {
          elements.createTab.addEventListener('click', () => showTab('create'));
        }
        
        if (elements.activeTab) {
          elements.activeTab.addEventListener('click', () => showTab('active'));
        }
        
        if (elements.pendingTab) {
          elements.pendingTab.addEventListener('click', () => showTab('pending'));
        }
        
        if (elements.historyTab) {
          elements.historyTab.addEventListener('click', () => showTab('history'));
        }
        
        // Кнопка создания спора
        if (elements.createDisputeBtn) {
          elements.createDisputeBtn.addEventListener('click', createDispute);
        }
        
        // Кнопки выбора ответа
        if (elements.yesBtn) {
          elements.yesBtn.addEventListener('click', () => makeChoice(true));
        }
        
        if (elements.noBtn) {
          elements.noBtn.addEventListener('click', () => makeChoice(false));
        }
        
        // Кнопки голосования
        if (elements.voteCreatorBtn) {
          elements.voteCreatorBtn.addEventListener('click', () => vote('creator'));
        }
        
        if (elements.voteOpponentBtn) {
          elements.voteOpponentBtn.addEventListener('click', () => vote('opponent'));
        }
      };
      
      /**
       * Показ таба
       */
      const showTab = async function(tabName) {
        state.currentTab = tabName;
        
        // Обновляем классы табов
        document.querySelectorAll('.tab-btn').forEach(tab => {
          tab.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Активируем нужный таб
        const tabElement = document.getElementById(`${tabName}-dispute-tab`);
        const contentElement = document.getElementById(`${tabName}-dispute-content`);
        
        if (tabElement) tabElement.classList.add('active');
        if (contentElement) contentElement.classList.add('active');
        
        // Загружаем данные для таба
        switch (tabName) {
          case 'active':
            await loadActiveDisputes();
            break;
          case 'pending':
            await loadPendingDisputes();
            break;
          case 'history':
            await loadHistoryDisputes();
            break;
        }
      };
      
      /**
       * Создание нового спора
       */
      const createDispute = async function() {
        if (state.isProcessing) return;
        
        try {
          state.isProcessing = true;
          
          const opponent = elements.opponentUsername.value.trim();
          const amount = parseInt(elements.disputeBet.value);
          const question = elements.disputeQuestionInput.value.trim();
          
          // Валидация
          if (!opponent.startsWith('@')) {
            throw new Error('Username должен начинаться с @');
          }
          
          if (!amount || amount <= 0) {
            throw new Error('Укажите корректную сумму');
          }
          
          if (!question) {
            throw new Error('Введите вопрос спора');
          }
          
          // Отправляем запрос
          const response = await fetch('/api/disputes/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              creatorId: window.GreenLightApp.user.telegramId,
              opponentUsername: opponent.substring(1), // убираем @
              amount: amount,
              question: question,
              createdVia: 'web'
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка создания спора');
          }
          
          // Очищаем форму
          elements.opponentUsername.value = '';
          elements.disputeBet.value = '';
          elements.disputeQuestionInput.value = '';
          
          // Показываем уведомление и переключаемся на активные споры
          if (window.casinoApp) {
            window.casinoApp.showNotification('Спор создан! Ожидаем ответа оппонента.');
          }
          
          showTab('active');
          
        } catch (error) {
          app.log('Dispute', `Ошибка создания спора: ${error.message}`, true);
          if (window.casinoApp) {
            window.casinoApp.showNotification(error.message);
          }
        } finally {
          state.isProcessing = false;
        }
      };
      
      /**
       * Загрузка конкретного спора
       */
      const loadDispute = async function(disputeId) {
        try {
          const response = await fetch(`/api/disputes/${disputeId}`);
          
          if (!response.ok) {
            throw new Error('Ошибка загрузки спора');
          }
          
          const dispute = await response.json();
          state.disputeData = dispute;
          
          // Отображаем спор
          displayDispute(dispute);
          
        } catch (error) {
          app.log('Dispute', `Ошибка загрузки спора: ${error.message}`, true);
        }
      };
      
      /**
       * Отображение спора
       */
      const displayDispute = function(dispute) {
        // Показываем вопрос
        if (elements.disputeQuestion) {
          elements.disputeQuestion.textContent = dispute.question;
        }
        
        // Показываем информацию
        if (elements.disputeInfo) {
          elements.disputeInfo.innerHTML = `
            <div>Ставка: ${dispute.bet.amount} ⭐</div>
            <div>Статус: ${getStatusText(dispute.status)}</div>
          `;
        }
        
        // Определяем, являемся ли мы создателем
        const isCreator = window.GreenLightApp.user.telegramId === dispute.creator.telegramId;
        const myChoice = isCreator ? dispute.bet.creatorChoice : dispute.bet.opponentChoice;
        const opponentChoice = isCreator ? dispute.bet.opponentChoice : dispute.bet.creatorChoice;
        
        // Показываем выбор
        if (myChoice !== null && elements.myChoiceDisplay) {
          elements.myChoiceDisplay.textContent = `Ваш выбор: ${myChoice ? 'Да' : 'Нет'}`;
          elements.myChoiceDisplay.style.display = 'block';
        }
        
        if (opponentChoice !== null && elements.opponentChoiceDisplay) {
          elements.opponentChoiceDisplay.textContent = 'Оппонент сделал выбор';
          elements.opponentChoiceDisplay.style.display = 'block';
        }
        
        // Управление кнопками выбора
        if (myChoice === null && dispute.status === 'active') {
          if (elements.yesBtn) elements.yesBtn.disabled = false;
          if (elements.noBtn) elements.noBtn.disabled = false;
        } else {
          if (elements.yesBtn) elements.yesBtn.disabled = true;
          if (elements.noBtn) elements.noBtn.disabled = true;
        }
        
        // Управление голосованием
        if (dispute.status === 'voting' && elements.votingContainer) {
          elements.votingContainer.style.display = 'block';
          
          // Проверяем, голосовали ли мы
          const hasVoted = dispute.voting.votes.some(vote => 
            vote.voter.telegramId === window.GreenLightApp.user.telegramId
          );
          
          if (hasVoted) {
            displayVotingResults(dispute);
          } else {
            if (elements.voteCreatorBtn) {
              elements.voteCreatorBtn.textContent = `Голосовать за @${dispute.creator.username}`;
              elements.voteCreatorBtn.disabled = false;
            }
            
            if (elements.voteOpponentBtn) {
              elements.voteOpponentBtn.textContent = `Голосовать за @${dispute.opponent.username}`;
              elements.voteOpponentBtn.disabled = false;
            }
          }
        }
        
        // Показываем результат
        if (dispute.status === 'resolved' && elements.disputeResult) {
          displayResult(dispute);
        }
      };
      
      /**
       * Сделать выбор
       */
      const makeChoice = async function(choice) {
        if (state.isProcessing || !state.disputeData) return;
        
        try {
          state.isProcessing = true;
          
          const response = await fetch(`/api/disputes/${state.disputeData._id}/choose`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: window.GreenLightApp.user.telegramId,
              choice: choice
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка выбора');
          }
          
          const updatedDispute = await response.json();
          state.disputeData = updatedDispute;
          displayDispute(updatedDispute);
          
          if (window.casinoApp) {
            window.casinoApp.showNotification('Ваш выбор принят!');
          }
          
        } catch (error) {
          app.log('Dispute', `Ошибка выбора: ${error.message}`, true);
          if (window.casinoApp) {
            window.casinoApp.showNotification(error.message);
          }
        } finally {
          state.isProcessing = false;
        }
      };
      
      /**
       * Голосование
       */
      const vote = async function(voteFor) {
        if (state.isProcessing || !state.disputeData) return;
        
        try {
          state.isProcessing = true;
          
          const voteForId = voteFor === 'creator' ? 
            state.disputeData.creator.telegramId : 
            state.disputeData.opponent.telegramId;
          
          const response = await fetch(`/api/disputes/${state.disputeData._id}/vote`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              voterId: window.GreenLightApp.user.telegramId,
              voteFor: voteForId
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка голосования');
          }
          
          if (window.casinoApp) {
            window.casinoApp.showNotification('Ваш голос принят!');
          }
          
          // Перезагружаем спор
          await loadDispute(state.disputeData._id);
          
        } catch (error) {
          app.log('Dispute', `Ошибка голосования: ${error.message}`, true);
          if (window.casinoApp) {
            window.casinoApp.showNotification(error.message);
          }
        } finally {
          state.isProcessing = false;
        }
      };
      
      /**
       * Отображение результатов голосования
       */
      const displayVotingResults = function(dispute) {
        if (!elements.votingResults) return;
        
        const votesForCreator = dispute.voting.votes.filter(v => 
          v.voteFor._id === dispute.creator._id
        ).length;
        
        const votesForOpponent = dispute.voting.votes.filter(v => 
          v.voteFor._id === dispute.opponent._id
        ).length;
        
        elements.votingResults.innerHTML = `
          <div class="voting-stats">
            <div>Голосов за @${dispute.creator.username}: ${votesForCreator}</div>
            <div>Голосов за @${dispute.opponent.username}: ${votesForOpponent}</div>
            <div>Всего голосов: ${dispute.voting.totalVotes}</div>
          </div>
        `;
        
        if (elements.voteCreatorBtn) elements.voteCreatorBtn.disabled = true;
        if (elements.voteOpponentBtn) elements.voteOpponentBtn.disabled = true;
      };
      
      /**
       * Отображение результата
       */
      const displayResult = function(dispute) {
        if (!elements.disputeResult) return;
        
        let resultHTML = '';
        
        if (dispute.result.isDraw) {
          resultHTML = `
            <div class="result-icon">🤝</div>
            <div class="result-text">Ничья! Средства возвращены участникам.</div>
          `;
        } else if (dispute.result.winner) {
          const isWinner = dispute.result.winner._id === window.GreenLightApp.user._id;
          resultHTML = `
            <div class="result-icon">${isWinner ? '🏆' : '😔'}</div>
            <div class="result-text">
              ${isWinner ? 
                `Поздравляем! Вы выиграли ${dispute.bet.amount * 2} ⭐!` : 
                `К сожалению, вы проиграли ${dispute.bet.amount} ⭐`}
            </div>
          `;
          
          elements.disputeResult.classList.add(isWinner ? 'win' : 'lose');
        }
        
        elements.disputeResult.innerHTML = resultHTML;
        elements.disputeResult.style.display = 'block';
      };
      
      /**
       * Загрузка активных споров
       */
      const loadActiveDisputes = async function() {
        try {
          const response = await fetch(`/api/disputes/user/${window.GreenLightApp.user.telegramId}`);
          
          if (!response.ok) {
            throw new Error('Ошибка загрузки споров');
          }
          
          const disputes = await response.json();
          const activeDisputes = disputes.filter(d => d.status === 'active' || d.status === 'voting');
          
          displayDisputesList(activeDisputes, elements.activeDisputesList);
          
        } catch (error) {
          app.log('Dispute', `Ошибка загрузки активных споров: ${error.message}`, true);
        }
      };
      
      /**
       * Загрузка ожидающих споров
       */
      const loadPendingDisputes = async function() {
        try {
          const response = await fetch(`/api/disputes/user/${window.GreenLightApp.user.telegramId}`);
          
          if (!response.ok) {
            throw new Error('Ошибка загрузки споров');
          }
          
          const disputes = await response.json();
          const pendingDisputes = disputes.filter(d => d.status === 'pending');
          
          displayDisputesList(pendingDisputes, elements.pendingDisputesList);
          
        } catch (error) {
          app.log('Dispute', `Ошибка загрузки ожидающих споров: ${error.message}`, true);
        }
      };
      
      /**
       * Загрузка истории споров
       */
      const loadHistoryDisputes = async function() {
        try {
          const response = await fetch(`/api/disputes/user/${window.GreenLightApp.user.telegramId}`);
          
          if (!response.ok) {
            throw new Error('Ошибка загрузки споров');
          }
          
          const disputes = await response.json();
          const historyDisputes = disputes.filter(d => d.status === 'resolved' || d.status === 'cancelled');
          
          displayDisputesList(historyDisputes, elements.historyDisputesList);
          
        } catch (error) {
          app.log('Dispute', `Ошибка загрузки истории споров: ${error.message}`, true);
        }
      };
      
      /**
       * Отображение списка споров
       */
      const displayDisputesList = function(disputes, container) {
        if (!container) return;
        
        if (disputes.length === 0) {
          container.innerHTML = '<div class="empty-message">Нет споров</div>';
          return;
        }
        
        const disputesHTML = disputes.map(dispute => `
          <div class="dispute-item" onclick="window.disputeGame.openDispute('${dispute._id}')">
            <div class="dispute-header">
              <span class="dispute-status ${dispute.status}">${getStatusText(dispute.status)}</span>
              <span class="dispute-amount">${dispute.bet.amount} ⭐</span>
            </div>
            <div class="dispute-question">${dispute.question}</div>
            <div class="dispute-info">
              <span>vs @${dispute.creator._id === window.GreenLightApp.user._id ? 
                dispute.opponent.username : dispute.creator.username}</span>
              <span>${formatDate(dispute.createdAt)}</span>
            </div>
          </div>
        `).join('');
        
        container.innerHTML = disputesHTML;
      };
      
      /**
       * Открытие спора
       */
      const openDispute = function(disputeId) {
        window.location.href = `?disputeId=${disputeId}`;
      };
      
      /**
       * Загрузка всех споров
       */
      const loadAllDisputes = async function() {
        await Promise.all([
          loadActiveDisputes(),
          loadPendingDisputes(),
          loadHistoryDisputes()
        ]);
      };
      
      /**
       * Получение текста статуса
       */
      const getStatusText = function(status) {
        const statusMap = {
          'pending': 'Ожидание',
          'active': 'Активный',
          'voting': 'Голосование',
          'resolved': 'Завершен',
          'cancelled': 'Отменен'
        };
        
        return statusMap[status] || status;
      };
      
      /**
       * Форматирование даты
       */
      const formatDate = function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
      };
      
      // Возвращаем публичный интерфейс
      return {
        init: init,
        openDispute: openDispute,
        getStatus: function() {
          return {
            initialized: state.initialized,
            currentTab: state.currentTab,
            disputeId: state.disputeId,
            isProcessing: state.isProcessing
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