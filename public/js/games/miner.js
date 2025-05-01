// public/js/games/miner.js

// Улучшенная игра Miner с динамическим изменением коэффициента
const minerGame = (() => {
  // Элементы игры - объявим как переменные, а не константы
  let newGameBtn;
  let cashoutBtn;
  let minerBet;
  let minesCount;
  let minerGrid;
  let potentialWin;
  let minerResult;
  
  // Состояние игры
  let isPlaying = false;
  let gameData = {
    grid: [],
    mines: [],
    revealedCells: [],
    totalCells: 25,  // 5x5 сетка
    minesCount: 3,
    currentMultiplier: 1,
    betAmount: 0,
    baseMultiplier: 1.2 // Базовый множитель, который будет увеличиваться с количеством мин
  };
  
  // Звуковые эффекты
  let clickSound, revealSound, explodeSound, cashoutSound;
  
  // Инициализация
  function init() {
    console.log('[Miner] Инициализация игры Miner');
    
    // Получаем элементы DOM с проверкой
    newGameBtn = document.getElementById('new-game-btn');
    cashoutBtn = document.getElementById('cashout-btn');
    minerBet = document.getElementById('miner-bet');
    minesCount = document.getElementById('mines-count');
    minerGrid = document.getElementById('miner-grid');
    potentialWin = document.getElementById('potential-win');
    minerResult = document.getElementById('miner-result');
    
    // Проверка наличия критических элементов
    if (!newGameBtn || !cashoutBtn || !minerBet || !minerGrid) {
      console.error('[Miner] Критические элементы игры не найдены в DOM');
      return false;
    }
    
    // Добавляем обработчики событий (с проверкой)
    if (newGameBtn) {
      newGameBtn.addEventListener('click', startNewGame);
      console.log('[Miner] Установлен обработчик для кнопки новой игры');
    }
    
    if (cashoutBtn) {
      cashoutBtn.addEventListener('click', cashout);
      console.log('[Miner] Установлен обработчик для кнопки кешаута');
    }
    
    if (minesCount) {
      minesCount.addEventListener('change', updateMineCount);
      console.log('[Miner] Установлен обработчик для выбора количества мин');
    }
    
    // Настраиваем звуки
    setupSounds();
    
    // Создаем сетку только если элемент существует
    if (minerGrid) {
      createGrid();
    }
    
    // Обновляем потенциальный выигрыш
    if (potentialWin) {
      updatePotentialWin();
    }
    
    console.log('[Miner] Инициализация завершена успешно');
    return true;
  }
  
  // Настройка звуков
  function setupSounds() {
    try {
      // Создаем аудио-контексты если поддерживаются
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        
        // Заглушка для локальной разработки
        clickSound = { play: () => console.log('[Miner] Звук клика') };
        revealSound = { play: () => console.log('[Miner] Звук открытия клетки') };
        explodeSound = { play: () => console.log('[Miner] Звук взрыва') };
        cashoutSound = { play: () => console.log('[Miner] Звук выигрыша') };
      }
    } catch (e) {
      console.log('[Miner] Аудио не поддерживается', e);
    }
  }
  
  // Создание игровой сетки
  function createGrid() {
    // Проверяем, что элемент существует
    if (!minerGrid) {
      console.error('[Miner] Элемент minerGrid не найден в DOM');
      return;
    }
    
    // Очищаем текущую сетку
    minerGrid.innerHTML = '';
    
    // Создаем сетку 5x5
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.row = i;
        cell.dataset.col = j;
        cell.dataset.index = i * 5 + j;
        
        // Добавляем обработчик только если игра активна
        if (isPlaying) {
          cell.addEventListener('click', () => revealCell(i * 5 + j));
          
          // Добавляем визуальный эффект при наведении
          cell.classList.add('active-cell');
        }
        
        minerGrid.appendChild(cell);
      }
    }
    
    console.log('[Miner] Игровая сетка создана успешно');
  }
  
  // Обновление количества мин и соответствующего коэффициента
  function updateMineCount() {
    // Проверяем наличие элемента
    if (!minesCount) {
      console.error('[Miner] Элемент minesCount не найден в DOM');
      return;
    }
    
    gameData.minesCount = parseInt(minesCount.value);
    
    // Устанавливаем базовый множитель в зависимости от количества мин
    // Чем больше мин, тем выше базовый множитель
    switch (gameData.minesCount) {
      case 3: 
        gameData.baseMultiplier = 1.2;
        break;
      case 5:
        gameData.baseMultiplier = 1.5;
        break;
      case 7:
        gameData.baseMultiplier = 2.0;
        break;
      case 10:
        gameData.baseMultiplier = 3.0;
        break;
      default:
        gameData.baseMultiplier = 1.2;
    }
    
    // Обновляем отображение только если элемент существует
    if (potentialWin) {
      updatePotentialWin();
    }
    
    // Добавляем тактильную обратную связь
    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('light');
    }
  }
  
  // Обновление отображения потенциального выигрыша
  function updatePotentialWin() {
    // Проверяем наличие элементов
    if (!potentialWin || !minerBet) {
      console.error('[Miner] Элементы potentialWin или minerBet не найдены в DOM');
      return;
    }
    
    const betAmt = parseInt(minerBet.value) || 0;
    
    // Используем улучшенную формулу для расчета множителя
    // Множитель растет экспоненциально с каждой открытой безопасной клеткой
    // И базируется на количестве мин
    const multiplier = calculateMultiplier(
      gameData.revealedCells.length,
      gameData.totalCells,
      gameData.minesCount,
      gameData.baseMultiplier
    );
    
    // Рассчитываем потенциальный выигрыш
    const potential = Math.floor(betAmt * multiplier);
    potentialWin.textContent = potential;
    
    // Обновляем игровые данные
    gameData.currentMultiplier = multiplier;
  }
  
  // Улучшенная функция расчета множителя
  function calculateMultiplier(revealed, total, mines, baseMultiplier) {
    if (revealed === 0) return baseMultiplier;
    
    // Базовое вычисление сложности (чем больше открыто и чем больше мин, тем сложнее)
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
  }
  
  // Старт новой игры
  function startNewGame() {
    // Проверка наличия элементов
    if (!minerBet) {
      console.error('[Miner] Элемент ставки не найден');
      return;
    }
    
    // Проверка доступности casinoApp
    if (!window.casinoApp) {
      console.error('[Miner] casinoApp не найден');
      alert('Ошибка инициализации приложения');
      return;
    }
    
    // Получаем размер ставки
    const betAmount = parseInt(minerBet.value);
    
    // Проверяем ставку
    if (isNaN(betAmount) || betAmount <= 0) {
      window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
      return;
    }
    
    // Проверяем баланс
    if (betAmount > window.casinoApp.currentUser.balance) {
      window.casinoApp.showNotification('Недостаточно средств');
      return;
    }
    
    // Сбрасываем игровое состояние
    isPlaying = true;
    gameData = {
      grid: Array(gameData.totalCells).fill('empty'),
      mines: [],
      revealedCells: [],
      totalCells: 25,
      minesCount: parseInt(minesCount ? minesCount.value : 3),
      currentMultiplier: gameData.baseMultiplier,
      betAmount: betAmount,
      baseMultiplier: gameData.baseMultiplier
    };
    
    // Размещаем мины
    placeMines();
    
    // Обновляем интерфейс
    createGrid();
    
    if (cashoutBtn) {
      cashoutBtn.disabled = false;
    }
    
    if (newGameBtn) {
      newGameBtn.disabled = true;
    }
    
    if (minerResult) {
      minerResult.textContent = '';
      minerResult.className = 'result';
    }
    
    // Тактильная обратная связь
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('medium');
    }
    
    // Обрабатываем начальную ставку
    window.casinoApp.processGameResult(
      'miner',
      betAmount,
      'bet',
      0,
      { 
        minesCount: gameData.minesCount,
        baseMultiplier: gameData.baseMultiplier 
      }
    );
    
    // Обновляем отображение потенциального выигрыша
    if (potentialWin) {
      updatePotentialWin();
    }
    
    console.log('[Miner] Новая игра начата');
  }
  
  // Размещение мин
  function placeMines() {
    // Очищаем существующие мины
    gameData.mines = [];
    
    // Размещаем новые мины
    while (gameData.mines.length < gameData.minesCount) {
      const randomIndex = Math.floor(Math.random() * gameData.totalCells);
      
      // Добавляем только если это не мина
      if (!gameData.mines.includes(randomIndex)) {
        gameData.mines.push(randomIndex);
        gameData.grid[randomIndex] = 'mine';
      }
    }
    
    console.log('[Miner] Мины размещены на позициях:', gameData.mines);
  }
  
  // Открытие ячейки
  async function revealCell(index) {
    // Проверяем, уже открыта ли ячейка
    if (gameData.revealedCells.includes(index)) {
      return;
    }
    
    // Проверяем, активна ли игра
    if (!isPlaying) {
      return;
    }
    
    // Получаем элемент ячейки
    const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
    if (!cell) {
      console.error(`[Miner] Ячейка с индексом ${index} не найдена`);
      return;
    }
    
    // Тактильная обратная связь
    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('light');
    }
    
    // Проверяем, является ли ячейка миной
    if (gameData.grid[index] === 'mine') {
      // Игра окончена
      revealAllMines();
      
      // Взрыв мины
      if (explodeSound) explodeSound.play();
      
      // Обновляем интерфейс
      cell.classList.add('mine', 'exploded');
      cell.innerHTML = '💥';
      
      // Анимация взрыва
      animateExplosion(cell);
      
      // Вибрация при взрыве
      if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
        window.casinoApp.provideTactileFeedback('error');
      }
      
      // Устанавливаем игровое состояние
      isPlaying = false;
      
      if (cashoutBtn) {
        cashoutBtn.disabled = true;
      }
      
      if (newGameBtn) {
        newGameBtn.disabled = false;
      }
      
      // Показываем результат
      if (minerResult) {
        minerResult.textContent = 'Бум! Вы наткнулись на мину. Игра окончена!';
        minerResult.classList.add('lose');
      }
      
      // Обрабатываем проигрыш
      if (window.casinoApp) {
        await window.casinoApp.processGameResult(
          'miner',
          0, // Нет дополнительной ставки
          'lose',
          0,
          {
            revealedCells: gameData.revealedCells,
            hitMine: index,
            mines: gameData.mines,
            finalMultiplier: gameData.currentMultiplier
          }
        );
      }
    } else {
      // Безопасная ячейка
      gameData.revealedCells.push(index);
      
      // Воспроизводим звук открытия
      if (revealSound) revealSound.play();
      
      // Обновляем интерфейс
      cell.classList.add('revealed');
      cell.innerHTML = '💰';
      
      // Анимация открытия
      animateReveal(cell);
      
      // Обновляем множитель и потенциальный выигрыш
      if (potentialWin) {
        updatePotentialWin();
      }
      
      // Проверяем, все ли безопасные ячейки открыты (условие победы)
      if (gameData.revealedCells.length === gameData.totalCells - gameData.minesCount) {
        // Игрок открыл все безопасные ячейки
        await automaticCashout();
      }
    }
  }
  
  // Анимация взрыва
  function animateExplosion(cell) {
    if (!cell) return;
    
    // Добавляем класс анимации
    cell.classList.add('explosion');
    
    // Создаем частицы для эффекта взрыва
    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('div');
      particle.className = 'explosion-particle';
      
      // Случайное положение и направление
      const angle = Math.random() * 360;
      const distance = 30 + Math.random() * 40;
      
      // Случайная задержка
      const delay = Math.random() * 0.2;
      
      // Устанавливаем стили
      particle.style.transform = `rotate(${angle}deg) translateX(${distance}px)`;
      particle.style.animationDelay = `${delay}s`;
      
      cell.appendChild(particle);
    }
    
    // Удаляем частицы после анимации
    setTimeout(() => {
      const particles = cell.querySelectorAll('.explosion-particle');
      particles.forEach(p => p.remove());
    }, 1500);
  }
  
  // Анимация открытия ячейки
  function animateReveal(cell) {
    if (!cell) return;
    
    // Добавляем класс анимации
    cell.classList.add('reveal-animation');
    
    // Удаляем класс через 0.5 секунды
    setTimeout(() => {
      cell.classList.remove('reveal-animation');
    }, 500);
  }
  
  // Открытие всех мин
  function revealAllMines() {
    gameData.mines.forEach(index => {
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
  }
  
  // Функция для вывода выигрыша
  async function cashout() {
    // Проверяем состояние игры
    if (!isPlaying || gameData.revealedCells.length === 0) {
      return;
    }
    
    // Проверяем наличие casinoApp
    if (!window.casinoApp) {
      console.error('[Miner] casinoApp не найден');
      return;
    }
    
    // Рассчитываем выигрыш
    const winAmount = Math.floor(gameData.betAmount * gameData.currentMultiplier);
    
    // Воспроизводим звук выигрыша
    if (cashoutSound) cashoutSound.play();
    
    // Тактильная обратная связь
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('success');
    }
    
    // Обновляем интерфейс
    if (minerResult) {
      minerResult.innerHTML = `
        <div class="win-icon">🎉</div>
        <div class="win-title">Вы выиграли ${winAmount} Stars!</div>
        <div class="win-multiplier">Множитель: x${gameData.currentMultiplier.toFixed(2)}</div>
      `;
      minerResult.classList.add('win');
    }
    
    // Сбрасываем игровое состояние
    isPlaying = false;
    
    if (cashoutBtn) {
      cashoutBtn.disabled = true;
    }
    
    if (newGameBtn) {
      newGameBtn.disabled = false;
    }
    
    // Показываем все мины
    revealAllMines();
    
    // Добавляем анимацию выигрыша
    animateWin();
    
    // Обрабатываем выигрыш
    await window.casinoApp.processGameResult(
      'miner',
      0, // Нет дополнительной ставки
      'win',
      winAmount,
      {
        revealedCells: gameData.revealedCells,
        multiplier: gameData.currentMultiplier,
        mines: gameData.mines
      }
    );
    
    console.log(`[Miner] Игра завершена - получен выигрыш ${winAmount} с множителем ${gameData.currentMultiplier.toFixed(2)}`);
  }
  
  // Анимация выигрыша
  function animateWin() {
    // Применяем анимацию к открытым ячейкам
    gameData.revealedCells.forEach((index, i) => {
      const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
      if (cell) {
        // Добавляем задержку для каждой ячейки
        setTimeout(() => {
          cell.classList.add('win-animation');
        }, i * 50);
      }
    });
  }
  
  // Автоматический вывод при открытии всех безопасных ячеек
  async function automaticCashout() {
    // Проверяем состояние игры
    if (!isPlaying) {
      return;
    }
    
    // Проверяем наличие casinoApp
    if (!window.casinoApp) {
      console.error('[Miner] casinoApp не найден');
      return;
    }
    
    // Рассчитываем максимальный выигрыш
    const winAmount = Math.floor(gameData.betAmount * gameData.currentMultiplier);
    
    // Воспроизводим звук большого выигрыша
    if (cashoutSound) {
      // Воспроизводим звук дважды для эффекта
      cashoutSound.play();
      setTimeout(() => cashoutSound.play(), 300);
    }
    
    // Тактильная обратная связь - большой выигрыш
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('success');
      setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
    }
    
    // Обновляем интерфейс
    if (minerResult) {
      minerResult.innerHTML = `
        <div class="win-icon">🏆</div>
        <div class="win-title">Идеально! Вы открыли все безопасные ячейки!</div>
        <div class="win-amount">Выигрыш: ${winAmount} ⭐</div>
        <div class="win-multiplier">Множитель: x${gameData.currentMultiplier.toFixed(2)}</div>
      `;
      minerResult.classList.add('win', 'big-win');
    }
    
    // Сбрасываем игровое состояние
    isPlaying = false;
    
    if (cashoutBtn) {
      cashoutBtn.disabled = true;
    }
    
    if (newGameBtn) {
      newGameBtn.disabled = false;
    }
    
    // Показываем все мины с анимацией
    revealAllMines();
    
    // Добавляем анимацию крупного выигрыша
    animateBigWin();
    
    // Обрабатываем выигрыш
    await window.casinoApp.processGameResult(
      'miner',
      0, // Нет дополнительной ставки
      'win',
      winAmount,
      {
        revealedCells: gameData.revealedCells,
        multiplier: gameData.currentMultiplier,
        mines: gameData.mines,
        perfectGame: true
      }
    );
    
    console.log(`[Miner] Идеальная игра завершена - получен выигрыш ${winAmount} с множителем ${gameData.currentMultiplier.toFixed(2)}`);
  }
  
  // Анимация большого выигрыша
  function animateBigWin() {
    // Создаем фейерверк
    const container = document.querySelector('.miner-container');
    if (container) {
      // Добавляем эффект фейерверка
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          const firework = document.createElement('div');
          firework.className = 'firework';
          
          // Случайная позиция
          firework.style.left = `${Math.random() * 100}%`;
          firework.style.top = `${Math.random() * 100}%`;
          
          // Случайный цвет
          const hue = Math.floor(Math.random() * 360);
          firework.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
          
          container.appendChild(firework);
          
          // Удаляем после анимации
          setTimeout(() => {
            firework.remove();
          }, 1000);
        }, i * 200);
      }
    }
    
    // Применяем анимацию к открытым ячейкам
    gameData.revealedCells.forEach((index, i) => {
      const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
      if (cell) {
        // Добавляем задержку для каждой ячейки
        setTimeout(() => {
          cell.classList.add('big-win-animation');
        }, i * 50);
      }
    });
  }
  
  // Инициализация при загрузке
  document.addEventListener('DOMContentLoaded', init);
  
  // Публичные методы
  return {
    init,
    startNewGame,
    cashout,
    updateMineCount
  };
})();
// Глобальный экспорт объекта игры
window.minerGame = minerGame;
console.log('[Miner] Экспорт игрового объекта в глобальную область видимости');