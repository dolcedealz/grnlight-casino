// public/js/games/crush.js

// Улучшенная версия игры Crash с качественным графиком и лучшим интерфейсом
const crushGame = (() => {
  // Элементы игры
  const startBtn = document.getElementById('start-crush-btn');
  const cashoutBtn = document.getElementById('cash-crush-btn');
  const crushBet = document.getElementById('crush-bet');
  const multiplierDisplay = document.getElementById('multiplier');
  const crushGraph = document.getElementById('crush-graph');
  const crushResult = document.getElementById('crush-result');
  
  // Элементы для графика
  let graphCanvas;
  let graphCtx;
  
  // Состояние игры
  let isPlaying = false;
  let multiplier = 1.00;
  let gameInterval = null;
  let crashPoint = 1.00;
  let betAmount = 0;
  let gameStartTime = 0;
  let graphPoints = [];
  
  // История игр
  let gameHistory = [];
  const MAX_HISTORY = 10;
  
  // Звуки
  let startSound, tickSound, cashoutSound, crashSound;
  
  // Инициализация
  function init() {
    console.log('Инициализация игры Crash');
    
    // Создаем canvas для графика, если его еще нет
    if (!graphCanvas && crushGraph) {
      graphCanvas = document.createElement('canvas');
      graphCanvas.id = 'crush-canvas';
      graphCanvas.width = crushGraph.clientWidth;
      graphCanvas.height = crushGraph.clientHeight;
      crushGraph.appendChild(graphCanvas);
      
      // Получаем контекст
      graphCtx = graphCanvas.getContext('2d');
    }
    
    // Добавляем обработчики событий
    if (startBtn) {
      startBtn.addEventListener('click', startGame);
    }
    if (cashoutBtn) {
      cashoutBtn.addEventListener('click', cashout);
    }
    
    // Обработчик изменения размера окна
    window.addEventListener('resize', handleResize);
    
    // Настраиваем звуки
    setupSounds();
    
    // Сбрасываем график
    resetGraph();
    
    // Загружаем историю
    loadHistory();
    
    // Создаем интерфейс истории
    createHistoryUI();
    
    // Скрываем результат
    if (crushResult) {
      crushResult.style.display = 'none';
    }
  }
  
  // Обработка изменения размера окна
  function handleResize() {
    if (graphCanvas && crushGraph) {
      graphCanvas.width = crushGraph.clientWidth;
      graphCanvas.height = crushGraph.clientHeight;
      resetGraph();
      
      // Перерисовываем текущий график, если игра активна
      if (isPlaying && graphPoints.length > 0) {
        redrawGraph();
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
  
  // Создание интерфейса истории
  function createHistoryUI() {
    // Проверяем, существует ли контейнер игры
    const crushContainer = document.querySelector('.crush-container');
    if (!crushContainer) return;
    
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
      if (crushGraph) {
        crushGraph.after(historyContainer);
      } else {
        crushContainer.appendChild(historyContainer);
      }
    }
    
    // Обновляем содержимое истории
    updateHistoryDisplay();
  }
  
  // Сброс графика
  function resetGraph() {
    if (!graphCtx) return;
    
    // Очищаем холст
    graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    
    // Рисуем сетку
    drawGrid();
    
    // Сбрасываем точки
    graphPoints = [];
  }
  
  // Рисование сетки графика
  function drawGrid() {
    if (!graphCtx) return;
    
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
  }
  
  // Загрузка истории
  function loadHistory() {
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
      
      // Форматируем время
      const date = new Date(item.timestamp);
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      historyItem.classList.add(colorClass);
      historyItem.innerHTML = `
        <div class="history-multiplier">${item.multiplier.toFixed(2)}x</div>
      `;
      
      historyItems.appendChild(historyItem);
    });
  }
  
  // Старт игры
  async function startGame() {
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
    if (multiplierDisplay) {
      multiplierDisplay.textContent = multiplier.toFixed(2);
      multiplierDisplay.classList.remove('crashed', 'cashed-out');
      multiplierDisplay.classList.add('active');
    }
    
    isPlaying = true;
    
    // Вычисляем точку краша
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
    
    // Скрываем предыдущий результат
    if (crushResult) {
      crushResult.style.opacity = '0';
      crushResult.style.transform = 'translateY(20px)';
      setTimeout(() => {
        crushResult.textContent = '';
        crushResult.className = 'result';
        crushResult.style.display = 'none';
      }, 300);
    }
    
    // Тактильная обратная связь
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('medium');
    }
    
    // Сбрасываем график
    resetGraph();
    gameStartTime = Date.now();
    addGraphPoint(1.00); // Начальная точка
    
    // Воспроизводим звук старта
    if (startSound) startSound.play();
    
    // Отправляем начальную ставку на сервер
    await window.casinoApp.processGameResult(
      'crush',
      betAmount,
      'bet',
      0,
      { startMultiplier: multiplier }
    );
    
    // Запускаем интервал игры
    gameInterval = setInterval(updateGame, 50); // Более частое обновление для плавности
  }
  
  // Генерация точки краша
  function generateCrashPoint() {
    // Используем распределение с большей вероятностью малых значений
    // и редкой вероятностью больших значений
    
    // Базовое случайное число от 0 до 1
    const r = Math.random();
    
    // Формула для распределения, имитирующего экспоненциальный рост с возможностью редких больших значений
    // Обычно график будет крашиться между 1.0 и 2.0, но иногда может доходить до больших значений
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
  }
  
  // Обновление состояния игры
  function updateGame() {
    if (!isPlaying) return;
    
    const elapsedTime = (Date.now() - gameStartTime) / 1000;
    
    // Обновляем множитель (более естественный рост)
    // Формула обеспечивает экспоненциальный рост multiplier = e^(time * growthFactor)
    const growthFactor = 0.5;
    multiplier = Math.exp(elapsedTime * growthFactor);
    
    // Округляем до 2 знаков после запятой для отображения
    const displayMultiplier = Math.floor(multiplier * 100) / 100;
    
    // Обновляем отображение
    if (multiplierDisplay) {
      multiplierDisplay.textContent = displayMultiplier.toFixed(2);
      
      // Добавляем визуальный эффект для больших множителей
      multiplierDisplay.classList.remove('low', 'medium', 'high', 'extreme');
      
      if (displayMultiplier <= 1.5) {
        multiplierDisplay.classList.add('low');
      } else if (displayMultiplier <= 3) {
        multiplierDisplay.classList.add('medium');
      } else if (displayMultiplier <= 5) {
        multiplierDisplay.classList.add('high');
      } else {
        multiplierDisplay.classList.add('extreme');
      }
    }
    
    // Добавляем точку на график каждые 100мс для плавности
    if (Date.now() % 100 < 50) {
      addGraphPoint(displayMultiplier);
    }
    
    // Воспроизводим звук тика при определенных множителях
    if (Math.floor(multiplier * 2) / 2 === multiplier && tickSound) {
      tickSound.play();
    }
    
    // Проверяем, должна ли игра завершиться
    if (multiplier >= crashPoint) {
      gameCrash();
    }
  }
  
  // Добавление точки на график
  function addGraphPoint(mult) {
    const elapsedTimeMs = Date.now() - gameStartTime;
    const elapsedTimeSec = elapsedTimeMs / 1000;
    
    // Масштабирование по времени
    const timeScale = 2; // Сколько секунд должно помещаться по ширине графика
    
    // Сохраняем точку для возможного перерисовывания при ресайзе
    graphPoints.push({
      time: elapsedTimeSec,
      multiplier: mult
    });
    
    // Перерисовываем график
    redrawGraph();
  }
  
  // Перерисовка всего графика
  function redrawGraph() {
    if (!graphCtx || !graphCanvas) return;
    
    // Очищаем холст
    graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    
    // Рисуем сетку
    drawGrid();
    
    // Если нет точек или всего одна точка, выходим
    if (graphPoints.length < 2) return;
    
    const width = graphCanvas.width;
    const height = graphCanvas.height;
    
    // Находим максимальные значения для масштабирования
    const maxTime = Math.max(5, graphPoints[graphPoints.length - 1].time);
    const maxMult = Math.max(5, ...graphPoints.map(p => p.multiplier));
    
    // Начинаем рисовать линию
    graphCtx.beginPath();
    
    // Перемещаемся к первой точке
    const x0 = (graphPoints[0].time / maxTime) * width;
    const y0 = height - (graphPoints[0].multiplier / maxMult) * height;
    graphCtx.moveTo(x0, y0);
    
    // Добавляем остальные точки
    for (let i = 1; i < graphPoints.length; i++) {
      const x = (graphPoints[i].time / maxTime) * width;
      const y = height - (graphPoints[i].multiplier / maxMult) * height;
      
      // Используем кривую Безье для сглаживания
      if (i < graphPoints.length - 1) {
        // Контрольные точки для сглаживания
        const nextX = (graphPoints[i + 1].time / maxTime) * width;
        const nextY = height - (graphPoints[i + 1].multiplier / maxMult) * height;
        
        const cpx1 = x - (x - x0) / 2;
        const cpy1 = y;
        const cpx2 = x + (nextX - x) / 2;
        const cpy2 = y;
        
        graphCtx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x, y);
      } else {
        graphCtx.lineTo(x, y);
      }
      
      // Запоминаем текущую точку для следующей итерации
      x0 = x;
      y0 = y;
    }
    
    // Настройки линии
    graphCtx.strokeStyle = 'rgba(0, 168, 107, 0.8)';
    graphCtx.lineWidth = 3;
    graphCtx.shadowColor = 'rgba(0, 168, 107, 0.5)';
    graphCtx.shadowBlur = 10;
    graphCtx.stroke();
    
    // Добавляем заливку под линией графика
    graphCtx.lineTo(x0, height);
    graphCtx.lineTo(0, height);
    graphCtx.closePath();
    
    // Градиентная заливка
    const gradient = graphCtx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 168, 107, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 168, 107, 0)');
    graphCtx.fillStyle = gradient;
    graphCtx.fill();
    
    // Текущее значение множителя
    const lastPoint = graphPoints[graphPoints.length - 1];
    const lastX = (lastPoint.time / maxTime) * width;
    const lastY = height - (lastPoint.multiplier / maxMult) * height;
    
    // Рисуем точку на конце линии
    graphCtx.beginPath();
    graphCtx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    graphCtx.fillStyle = 'rgba(0, 168, 107, 1)';
    graphCtx.fill();
    graphCtx.strokeStyle = 'white';
    graphCtx.lineWidth = 2;
    graphCtx.stroke();
  }
  
  // Обработка краша игры
  async function gameCrash() {
    // Останавливаем игру
    clearInterval(gameInterval);
    isPlaying = false;
    
    // Воспроизводим звук краша
    if (crashSound) crashSound.play();
    
    // Тактильная обратная связь
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('error');
    }
    
    // Обновляем интерфейс
    if (crushResult) {
      crushResult.innerHTML = `
        <div class="crash-icon">💥</div>
        <div class="crash-text">Crash at ${multiplier.toFixed(2)}x!</div>
      `;
      crushResult.classList.add('lose');
      crushResult.style.display = 'block';
      setTimeout(() => {
        crushResult.style.opacity = '1';
        crushResult.style.transform = 'translateY(0)';
      }, 50);
    }
    
    if (multiplierDisplay) {
      multiplierDisplay.classList.remove('active', 'low', 'medium', 'high', 'extreme');
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
    
    // Анимация краша на графике
    animateCrash();
    
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
    
    // Отправляем проигрыш на сервер
    await window.casinoApp.processGameResult(
      'crush',
      0, // Нет дополнительной ставки
      'lose',
      0,
      {
        crashPoint: multiplier,
        finalMultiplier: multiplier
      }
    );
  }
  
  // Анимация краша
  function animateCrash() {
    if (!graphCanvas || !graphCtx) return;
    
    // Добавляем визуальный эффект взрыва
    const lastPoint = graphPoints[graphPoints.length - 1];
    
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
  }
  
  // Кешаут (досрочный выход)
  async function cashout() {
    if (!isPlaying) return;
    
    // Останавливаем игру
    clearInterval(gameInterval);
    isPlaying = false;
    
    // Воспроизводим звук кешаута
    if (cashoutSound) cashoutSound.play();
    
    // Тактильная обратная связь
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('success');
    }
    
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
      multiplierDisplay.classList.remove('active', 'low', 'medium', 'high', 'extreme');
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
    
    // Анимация кешаута на графике
    animateCashout();
    
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
    
    // Продолжаем показывать симуляцию графика до краша
    simulateContinuation();
  }
  
  // Анимация кешаута
  function animateCashout() {
    if (!graphCanvas || !graphCtx) return;
    
    // Добавляем визуальный эффект успешного кешаута
    const lastPoint = graphPoints[graphPoints.length - 1];
    
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
  }
  
  // Симуляция продолжения графика после кешаута
  function simulateContinuation() {
    const cashoutMultiplier = multiplier;
    const cashoutTime = (Date.now() - gameStartTime) / 1000;
    
    // Создаем интервал для симуляции продолжения графика
    let simulationInterval = setInterval(() => {
      // Вычисляем текущее время от начала игры
      const elapsedTime = (Date.now() - gameStartTime) / 1000;
      
      // Обновляем множитель (используем ту же формулу, что и в updateGame)
      const growthFactor = 0.5;
      const simulatedMultiplier = Math.exp(elapsedTime * growthFactor);
      const displayMultiplier = Math.floor(simulatedMultiplier * 100) / 100;
      
      // Добавляем точку на график
      if (Date.now() % 100 < 50) {
        addGraphPoint(displayMultiplier);
      }
      
      // Проверяем, достигли ли точки краша
      if (simulatedMultiplier >= crashPoint) {
        clearInterval(simulationInterval);
        
        // Воспроизводим звук краша (тише)
        if (crashSound) {
          // Уменьшаем громкость для симуляции
          crashSound.volume = 0.3;
          crashSound.play();
          crashSound.volume = 1.0; // Восстанавливаем громкость
        }
        
        // Анимация краша на графике
        animateCrash();
        
        // Показываем сообщение о том, что произошел бы краш
        if (crushResult && crushResult.classList.contains('win')) {
          const crashInfo = document.createElement('div');
          crashInfo.className = 'crash-info';
          crashInfo.textContent = `Would have crashed at ${crashPoint.toFixed(2)}x`;
          crushResult.appendChild(crashInfo);
        }
      }
    }, 50);
    
    // Останавливаем симуляцию через 5 секунд для экономии ресурсов
    setTimeout(() => {
      clearInterval(simulationInterval);
    }, 5000);
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
// Добавить в конец файла crush.js
// После строки: })();

// Глобальный экспорт объекта игры
window.crushGame = crushGame;
console.log('[Crush] Экспорт игрового объекта в глобальную область видимости');