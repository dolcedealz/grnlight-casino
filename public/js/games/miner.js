// public/js/games/miner.js

// Улучшенная игра Miner с динамическим изменением коэффициента
const minerGame = (() => {
  // Элементы игры
  const newGameBtn = document.getElementById('new-game-btn');
  const cashoutBtn = document.getElementById('cashout-btn');
  const minerBet = document.getElementById('miner-bet');
  const minesCount = document.getElementById('mines-count');
  const minerGrid = document.getElementById('miner-grid');
  const potentialWin = document.getElementById('potential-win');
  const minerResult = document.getElementById('miner-result');
  
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
    console.log('Инициализация игры Miner');
    
    // Добавляем обработчики событий
    newGameBtn.addEventListener('click', startNewGame);
    cashoutBtn.addEventListener('click', cashout);
    minesCount.addEventListener('change', updateMineCount);
    
    // Настраиваем звуки
    setupSounds();
    
    // Создаем сетку
    createGrid();
    
    // Обновляем потенциальный выигрыш
    updatePotentialWin();
  }
  
  // Настройка звуков
  function setupSounds() {
    try {
      // Создаем аудио-контексты если поддерживаются
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        
        // Заглушка для локальной разработки
        clickSound = { play: () => console.log('Звук клика') };
        revealSound = { play: () => console.log('Звук открытия клетки') };
        explodeSound = { play: () => console.log('Звук взрыва') };
        cashoutSound = { play: () => console.log('Звук выигрыша') };
      }
    } catch (e) {
      console.log('Аудио не поддерживается', e);
    }
  }
  
  // Создание игровой сетки
  function createGrid() {
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
  }
  
  // Обновление количества мин и соответствующего коэффициента
  function updateMineCount() {
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
    
    // Обновляем отображение
    updatePotentialWin();
    
    // Добавляем тактильную обратную связь
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('light');
    }
  }
  
  // Обновление отображения потенциального выигрыша
  function updatePotentialWin() {
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
      minesCount: parseInt(minesCount.value),
      currentMultiplier: gameData.baseMultiplier,
      betAmount: betAmount,
      baseMultiplier: gameData.baseMultiplier
    };
    
    // Размещаем мины
    placeMines();
    
    // Обновляем интерфейс
    createGrid();
    cashoutBtn.disabled = false;
    newGameBtn.disabled = true;
    minerResult.textContent = '';
    minerResult.className = 'result';
    
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
    updatePotentialWin();
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
    
    console.log('Мины размещены на позициях:', gameData.mines);
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
    
    // Тактильная обратная связь
    if (window.casinoApp.provideTactileFeedback) {
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
      if (window.casinoApp.provideTactileFeedback) {
        window.casinoApp.provideTactileFeedback('error');
      }
      
      // Устанавливаем игровое состояние
      isPlaying = false;
      cashoutBtn.disabled = true;
      newGameBtn.disabled = false;
      
      // Показываем результат
      minerResult.textContent = 'Бум! Вы наткнулись на мину. Игра окончена!';
      minerResult.classList.add('lose');
      
      // Обрабатываем проигрыш
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
      updatePotentialWin();
      
      // Проверяем, все ли безопасные ячейки открыты (условие победы)
      if (gameData.revealedCells.length === gameData.totalCells - gameData.minesCount) {
        // Игрок открыл все безопасные ячейки
        await automaticCashout();
      }
    }
  }
  
  // Анимация взрыва
  function animateExplosion(cell) {
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
    if (!isPlaying || gameData.revealedCells.length === 0) {
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
    minerResult.innerHTML = `
      <div class="win-icon">🎉</div>
      <div class="win-title">Вы выиграли ${winAmount} Stars!</div>
      <div class="win-multiplier">Множитель: x${gameData.currentMultiplier.toFixed(2)}</div>
    `;
    minerResult.classList.add('win');
    
    // Сбрасываем игровое состояние
    isPlaying = false;
    cashoutBtn.disabled = true;
    newGameBtn.disabled = false;
    
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
    // Рассчитываем максимальный выигрыш
    const winAmount = gameData.betAmount * gameData.currentMultiplier;
    
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
    minerResult.innerHTML = `
      <div class="win-icon">🏆</div>
      <div class="win-title">Идеально! Вы открыли все безопасные ячейки!</div>
      <div class="win-amount">Выигрыш: ${winAmount} ⭐</div>
      <div class="win-multiplier">Множитель: x${gameData.currentMultiplier.toFixed(2)}</div>
    `;
    minerResult.classList.add('win', 'big-win');
    
    // Сбрасываем игровое состояние
    isPlaying = false;
    cashoutBtn.disabled = true;
    newGameBtn.disabled = false;
    
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