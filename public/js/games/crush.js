// public/js/games/crush.js

// Улучшенная версия игры Crush с детальной анимацией и историей
const crushGame = (() => {
  // Элементы игры
  const startBtn = document.getElementById('start-crush-btn');
  const cashoutBtn = document.getElementById('cash-crush-btn');
  const crushBet = document.getElementById('crush-bet');
  const multiplierDisplay = document.getElementById('multiplier');
  const graphLine = document.getElementById('graph-line');
  const crushGraph = document.getElementById('crush-graph');
  const crushResult = document.getElementById('crush-result');
  
  // Новые элементы для улучшенной версии
  let gameStatsContainer;
  let crashHistoryContainer;
  
  // Состояние игры
  let isPlaying = false;
  let multiplier = 1.00;
  let gameInterval = null;
  let crashPoint = 1.00;
  let betAmount = 0;
  let graphPoints = [];
  let gameStartTime = 0;
  let gameHistory = [];
  const MAX_HISTORY = 10;
  let currentSpeedMultiplier = 1;
  
  // Звуки
  let startSound, tickSound, cashoutSound, crashSound;
  
  // Статистика
  let stats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highestMultiplier: 1.0,
    totalWinnings: 0,
    totalLosses: 0
  };
  
  // Инициализация
  function init() {
    console.log('Инициализация игры Crush');
    
    // Добавляем обработчики событий
    startBtn.addEventListener('click', startGame);
    cashoutBtn.addEventListener('click', cashout);
    
    // Создаем новые элементы интерфейса
    createNewElements();
    
    // Настраиваем звуки
    setupSounds();
    
    // Сбрасываем график
    resetGraph();
    
    // Загружаем историю
    loadHistory();
    
    // Загружаем статистику
    loadStats();
    
    // Скрываем результат
    if (crushResult) crushResult.style.display = 'none';
  }
  
  // Создание новых элементов
  function createNewElements() {
    const crushContainer = document.querySelector('.crush-container');
    if (!crushContainer) return;
    
    // 1. История крашей
    if (!document.querySelector('.crash-history')) {
      crashHistoryContainer = document.createElement('div');
      crashHistoryContainer.className = 'crash-history';
      crashHistoryContainer.innerHTML = `
        <h3>История крашей</h3>
        <div class="history-items"></div>
      `;
      
      // Вставляем после графика
      crushGraph.after(crashHistoryContainer);
    }
    
    // 2. Статистика игры
    if (!document.querySelector('.game-stats')) {
      gameStatsContainer = document.createElement('div');
      gameStatsContainer.className = 'game-stats';
      gameStatsContainer.innerHTML = `
        <div class="stats-header">Статистика</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Игр сыграно</div>
            <div class="stat-value" id="games-played">0</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Побед</div>
            <div class="stat-value" id="wins">0</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Поражений</div>
            <div class="stat-value" id="losses">0</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Рекорд</div>
            <div class="stat-value" id="highest-multiplier">1.00x</div>
          </div>
        </div>
      `;
      
      // Вставляем после истории крашей
      if (crushResult) {
        crushResult.after(gameStatsContainer);
      } else {
        crushContainer.appendChild(gameStatsContainer);
      }
    }
    
    // 3. Контроль скорости (замедление/ускорение)
    if (!document.querySelector('.speed-control')) {
      const speedControl = document.createElement('div');
      speedControl.className = 'speed-control';
      speedControl.innerHTML = `
        <div class="speed-label">Скорость:</div>
        <div class="speed-buttons">
          <button class="speed-btn" data-speed="0.5">0.5x</button>
          <button class="speed-btn active" data-speed="1">1x</button>
          <button class="speed-btn" data-speed="2">2x</button>
        </div>
      `;
      
      // Вставляем перед контролями ставки
      const crushControls = document.querySelector('.crush-controls');
      if (crushControls) {
        crushControls.prepend(speedControl);
        
        // Добавляем обработчики событий для кнопок скорости
        const speedButtons = speedControl.querySelectorAll('.speed-btn');
        speedButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            const speed = parseFloat(btn.getAttribute('data-speed'));
            setGameSpeed(speed);
            
            // Обновляем активную кнопку
            speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
      }
    }
  }
  
  // Настройка звуков
  function setupSounds() {
    try {
      // Создаем аудио-контексты если поддерживаются
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        
        // Заглушка для локальной разработки
        startSound = { play: () => console.log('Звук старта') };
        tickSound = { play: () => console.log('Звук тика') };
        cashoutSound = { play: () => console.log('Звук кешаута') };
        crashSound = { play: () => console.log('Звук краша') };
      }
    } catch (e) {
      console.log('Аудио не поддерживается', e);
    }
  }
  
  // Установка скорости игры
  function setGameSpeed(speed) {
    currentSpeedMultiplier = speed;
    console.log(`Скорость игры изменена на ${speed}x`);
  }
  
  // Сброс графика
  function resetGraph() {
    if (!graphLine) return;
    
    graphLine.style.strokeDasharray = '1000';
    graphLine.style.strokeDashoffset = '1000';
    graphPoints = [];
    updateGraph();
  }
  
  // Обновление графика с текущими точками
  function updateGraph() {
    if (!graphLine || graphPoints.length < 2) return;
    
    // Очищаем текущий путь
    graphLine.setAttribute('d', '');
    
    // Создаем SVG путь из точек
    let path = `M ${graphPoints[0].x} ${graphPoints[0].y}`;
    
    for (let i = 1; i < graphPoints.length; i++) {
      path += ` L ${graphPoints[i].x} ${graphPoints[i].y}`;
    }
    
    // Устанавливаем новый путь
    graphLine.setAttribute('d', path);
    
    // Анимируем отрисовку пути
    const length = graphLine.getTotalLength ? graphLine.getTotalLength() : 1000;
    graphLine.style.strokeDasharray = length;
    graphLine.style.strokeDashoffset = '0';
  }
  
  // Добавление точки на график
  function addGraphPoint(multiplier) {
    if (!crushGraph) return;
    
    const graphWidth = crushGraph.clientWidth;
    const graphHeight = crushGraph.clientHeight;
    
    // Вычисляем позицию x на основе прошедшего времени
    const timeElapsed = Date.now() - gameStartTime;
    // Учитываем множитель скорости (быстрее = точки ближе друг к другу)
    const x = Math.min((timeElapsed / (15000 / currentSpeedMultiplier)) * graphWidth, graphWidth - 10);
    
    // Вычисляем позицию y на основе множителя (инвертировано для SVG)
    // Используем логарифмическую шкалу для лучшей визуализации высоких множителей
    const logMultiplier = Math.log(multiplier) / Math.log(1.5);
    const y = graphHeight - (logMultiplier * graphHeight / 4);
    
    graphPoints.push({ x, y });
    updateGraph();
  }
  
  // Загрузка истории
  function loadHistory() {
    // Генерируем некоторые случайные данные истории для демонстрации
    gameHistory = [];
    
    for (let i = 0; i < 5; i++) {
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
  }
  
  // Загрузка статистики
  function loadStats() {
    // В реальном приложении здесь был бы запрос к API
    stats = {
      gamesPlayed: 12,
      wins: 5,
      losses: 7,
      highestMultiplier: 4.78,
      totalWinnings: 1200,
      totalLosses: 800
    };
    
    // Обновляем отображение статистики
    updateStatsDisplay();
  }
  
  // Обновление отображения истории
  function updateHistoryDisplay() {
    const historyItems = document.querySelector('.history-items');
    if (!historyItems) return;
    
    historyItems.innerHTML = '';
    
    // Добавляем элементы истории
    gameHistory.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = `history-item ${item.isCashedOut ? 'cashed-out' : 'crashed'}`;
      
      // Форматируем время
      const date = new Date(item.timestamp);
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      historyItem.innerHTML = `
        <div class="history-multiplier">${item.multiplier.toFixed(2)}x</div>
        <div class="history-status">${item.isCashedOut ? '💰' : '💥'}</div>
        <div class="history-time">${time}</div>
      `;
      
      historyItems.appendChild(historyItem);
    });
  }
  
  // Обновление отображения статистики
  function updateStatsDisplay() {
    // Обновляем значения статистики
    const gamesPlayedEl = document.getElementById('games-played');
    const winsEl = document.getElementById('wins');
    const lossesEl = document.getElementById('losses');
    const highestMultiplierEl = document.getElementById('highest-multiplier');
    
    if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed;
    if (winsEl) winsEl.textContent = stats.wins;
    if (lossesEl) lossesEl.textContent = stats.losses;
    if (highestMultiplierEl) highestMultiplierEl.textContent = stats.highestMultiplier.toFixed(2) + 'x';
  }
  
  // Старт игры
  function startGame() {
    // Получаем размер ставки
    betAmount = parseInt(crushBet.value);
    
    // Проверяем ставку
    if (isNaN(betAmount) || betAmount <= 0) {
      window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
      return;
    }
    
    // Проверяем, достаточно ли средств
    if (betAmount > window.casinoApp.currentUser.balance) {
      window.casinoApp.showNotification('Недостаточно средств для ставки');
      return;
    }
    
    // Сбрасываем состояние игры
    multiplier = 1.00;
    if (multiplierDisplay) multiplierDisplay.textContent = multiplier.toFixed(2);
    isPlaying = true;
    
    // Вычисляем точку краша (случайное число между 1.0 и 10.0, с большей вероятностью для меньших значений)
    // Используем экспоненциальное распределение для реалистичного поведения краша
    crashPoint = generateCrashPoint();
    console.log('Игра закончится на:', crashPoint.toFixed(2));
    
    // Обновляем интерфейс
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.classList.add('disabled');
    }
    
    if (cashoutBtn) {
      cashoutBtn.disabled = false;
      cashoutBtn.classList.remove('disabled');
      cashoutBtn.classList.add('active');
    }
    
    // Скрываем предыдущий результат с анимацией
    if (crushResult) {
      crushResult.style.opacity = '0';
      crushResult.style.transform = 'translateY(20px)';
      setTimeout(() => {
        crushResult.textContent = '';
        crushResult.className = 'result';
        crushResult.style.display = 'none';
      }, 300);
    }
    
    // Сбрасываем график
    resetGraph();
    gameStartTime = Date.now();
    addGraphPoint(multiplier);
    
    // Воспроизводим звук старта
    if (startSound) startSound.play();
    
    // Изменяем стиль множителя
    if (multiplierDisplay) {
      multiplierDisplay.classList.remove('crashed', 'cashed-out');
      multiplierDisplay.classList.add('active');
    }
    
    // Отправляем начальную ставку на сервер
    window.casinoApp.processGameResult(
      'crush',
      betAmount,
      'bet',
      0,
      { startMultiplier: multiplier }
    );
    
    // Запускаем интервал игры
    gameInterval = setInterval(updateGame, 100 / currentSpeedMultiplier);
  }
  
  // Генерация точки краша
  function generateCrashPoint() {
    // Базовое значение - от 1.0 до примерно 4.0-5.0 с экспоненциальным убыванием вероятности
    let randomBase = 1 + Math.random() * Math.random() * 4;
    
    // С небольшой вероятностью (примерно 1-2%) даем более высокие множители
    const luckyBonus = Math.random() > 0.98 ? 2 + Math.random() * 3 : 0;
    
    return randomBase + luckyBonus;
  }
  
  // Обновление состояния игры
  function updateGame() {
    if (!isPlaying) return;
    
    // Увеличиваем множитель (более быстрый рост с увеличением множителя)
    const growth = 0.01 * (1 + (multiplier - 1) / 10);
    multiplier += growth * currentSpeedMultiplier;
    
    // Обновляем отображение
    if (multiplierDisplay) {
      multiplierDisplay.textContent = multiplier.toFixed(2);
      
      // Добавляем визуальный эффект для больших множителей
      if (multiplier > 5) {
        multiplierDisplay.classList.add('high-multiplier');
      } else {
        multiplierDisplay.classList.remove('high-multiplier');
      }
    }
    
    // Добавляем точку на график каждые несколько обновлений
    if (Math.random() > 0.5) {
      addGraphPoint(multiplier);
    }
    
    // Воспроизводим звук тика при определенных множителях
    if (multiplier % 1 < 0.02 && tickSound) {
      tickSound.play();
    }
    
    // Проверяем, должна ли игра завершиться
    if (multiplier >= crashPoint) {
      gameCrash();
    }
  }
  
  // Обработка краша игры
  function gameCrash() {
    // Останавливаем игру
    clearInterval(gameInterval);
    isPlaying = false;
    
    // Воспроизводим звук краша
    if (crashSound) crashSound.play();
    
    // Обновляем интерфейс
    if (crushResult) {
      crushResult.innerHTML = `
        <div class="crash-icon">💥</div>
        <div class="crash-text">Crashed at ${multiplier.toFixed(2)}x!</div>
      `;
      crushResult.classList.add('lose');
      crushResult.style.display = 'block';
      setTimeout(() => {
        crushResult.style.opacity = '1';
        crushResult.style.transform = 'translateY(0)';
      }, 50);
    }
    
    if (multiplierDisplay) {
      multiplierDisplay.classList.remove('active', 'high-multiplier');
      multiplierDisplay.classList.add('crashed');
    }
    
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.classList.remove('disabled');
    }
    
    if (cashoutBtn) {
      cashoutBtn.disabled = true;
      cashoutBtn.classList.remove('active');
      cashoutBtn.classList.add('disabled');
    }
    
    // Добавляем финальную точку краша на график
    addGraphPoint(multiplier);
    
    // Обновляем историю
    gameHistory.unshift({
      multiplier: multiplier,
      timestamp: new Date().toISOString(),
      isCashedOut: false
    });
    
    // Обрезаем историю до максимального размера
    if (gameHistory.length > MAX_HISTORY) {
      gameHistory = gameHistory.slice(0, MAX_HISTORY);
    }
    
    // Обновляем отображение истории
    updateHistoryDisplay();
    
    // Обновляем статистику
    stats.gamesPlayed++;
    stats.losses++;
    stats.totalLosses += betAmount;
    if (multiplier > stats.highestMultiplier) {
      stats.highestMultiplier = multiplier;
    }
    updateStatsDisplay();
    
    // Отправляем проигрыш на сервер
    window.casinoApp.processGameResult(
      'crush',
      0, // Нет дополнительной ставки
      'lose',
      0,
      {
        crashPoint: multiplier,
        finalMultiplier: multiplier
      }
    );
    
    // Сбрасываем стиль множителя после задержки
    setTimeout(() => {
      if (multiplierDisplay) {
        multiplierDisplay.classList.remove('crashed');
      }
    }, 2000);
  }
  
  // Кешаут (досрочный выход)
  async function cashout() {
    if (!isPlaying) return;
    
    // Останавливаем игру
    clearInterval(gameInterval);
    isPlaying = false;
    
    // Воспроизводим звук кешаута
    if (cashoutSound) cashoutSound.play();
    
    // Вычисляем выигрыш
    const winAmount = Math.floor(betAmount * multiplier);
    
    // Обновляем интерфейс
    if (crushResult) {
      crushResult.innerHTML = `
        <div class="cashout-icon">💰</div>
        <div class="cashout-text">Cashed out at ${multiplier.toFixed(2)}x!</div>
        <div class="win-amount">+${winAmount} ⭐</div>
      `;
      crushResult.classList.add('win');
      crushResult.style.display = 'block';
      setTimeout(() => {
        crushResult.style.opacity = '1';
        crushResult.style.transform = 'translateY(0)';
      }, 50);
    }
    
    if (multiplierDisplay) {
      multiplierDisplay.classList.remove('active', 'high-multiplier');
      multiplierDisplay.classList.add('cashed-out');
    }
    
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.classList.remove('disabled');
    }
    
    if (cashoutBtn) {
      cashoutBtn.disabled = true;
      cashoutBtn.classList.remove('active');
      cashoutBtn.classList.add('disabled');
    }
    
    // Обновляем историю
    gameHistory.unshift({
      multiplier: multiplier,
      timestamp: new Date().toISOString(),
      isCashedOut: true
    });
    
    // Обрезаем историю до максимального размера
    if (gameHistory.length > MAX_HISTORY) {
      gameHistory = gameHistory.slice(0, MAX_HISTORY);
    }
    
    // Обновляем отображение истории
    updateHistoryDisplay();
    
    // Обновляем статистику
    stats.gamesPlayed++;
    stats.wins++;
    stats.totalWinnings += winAmount - betAmount;
    if (multiplier > stats.highestMultiplier) {
      stats.highestMultiplier = multiplier;
    }
    updateStatsDisplay();
    
    // Отправляем выигрыш на сервер
    await window.casinoApp.processGameResult(
      'crush',
      0, // Нет дополнительной ставки
      'win',
      winAmount,
      {
        cashoutMultiplier: multiplier,
        crashPoint: crashPoint
      }
    );
    
    // Продолжаем анимировать до краша для визуального эффекта
    let continueInterval = setInterval(() => {
      // Увеличиваем множитель
      const growth = 0.01 * (1 + (multiplier - 1) / 10);
      multiplier += growth * currentSpeedMultiplier;
      
      // Обновляем отображение (но не множитель игрока)
      if (multiplierDisplay) {
        multiplierDisplay.textContent = multiplier.toFixed(2);
      }
      
      // Добавляем точку на график
      if (Math.random() > 0.5) {
        addGraphPoint(multiplier);
      }
      
      // Проверяем, должна ли анимация закончиться
      if (multiplier >= crashPoint) {
        clearInterval(continueInterval);
        if (multiplierDisplay) {
          multiplierDisplay.classList.remove('cashed-out');
        }
        
        // Добавляем финальную точку краша на график
        addGraphPoint(multiplier);
        
        // Добавляем эффект краша для графика
        if (crushGraph) {
          crushGraph.classList.add('crashed-graph');
          setTimeout(() => {
            crushGraph.classList.remove('crashed-graph');
          }, 1000);
        }
      }
    }, 100 / currentSpeedMultiplier);
  }
  
  // Инициализация при загрузке
  document.addEventListener('DOMContentLoaded', init);
  
  // Возвращаем публичные методы
  return {
    init,
    startGame,
    cashout
  };
})();