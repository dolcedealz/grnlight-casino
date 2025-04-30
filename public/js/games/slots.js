// public/js/games/slots.js

// Улучшенная версия игры Slots с матрицей 3x3 и реалистичным вращением
const slotsGame = (() => {
  // Элементы игры
  let spinBtn;
  let slotsResult;
  let slotsBet;
  
  // Контейнер для слотов (будет создан динамически)
  let slotsContainer;
  let reels = [];
  
  // Состояние игры
  let isSpinning = false;
  const symbols = ['🍒', '🍋', '🍇', '🍊', '🍉', '💎', '7️⃣', '🤑'];
  
  // Новые переменные для управления 3x3 матрицей
  const rowCount = 3;
  const colCount = 3;
  let slotMatrix = []; // Хранит конечный результат
  
  // Звуки
  let spinSound, stopSound, winSound, loseSound;
  
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
    // Горизонтальные линии
    horizontalLine: 'Горизонтальная линия! x{multiplier} выигрыш!',
    // Вертикальные линии
    verticalLine: 'Вертикальная линия! x{multiplier} выигрыш!',
    // Диагонали
    diagonal: 'Диагональная линия! x{multiplier} выигрыш!',
    // Полное совпадение всех символов
    fullMatch: 'Джекпот! Все символы совпадают! x{multiplier} выигрыш!'
  };
  
  // Инициализация
  function init() {
    console.log('Инициализация игры Slots');
    
    // Получаем элементы DOM
    spinBtn = document.getElementById('spin-btn');
    slotsResult = document.getElementById('slots-result');
    slotsBet = document.getElementById('slots-bet');
    slotsContainer = document.querySelector('.slot-reels');
    
    // Создаем новый контейнер для слотов 3x3
    createSlotsContainer();
    
    // Добавляем обработчики событий
    if (spinBtn) {
      spinBtn.addEventListener('click', spin);
      console.log('Slots: обработчик spin-btn установлен');
    } else {
      console.warn('Slots: spin-btn не найден в DOM');
    }
    
    // Настраиваем звуки
    setupSounds();
    
    // Заполняем слоты начальными символами
    populateSlots();
    
    // Скрываем результат
    if (slotsResult) {
      slotsResult.style.display = 'none';
    }
    
    console.log('Slots: инициализация завершена успешно');
    return true;
  }
  
  // Создание контейнера для слотов 3x3
  function createSlotsContainer() {
    // Очищаем массив барабанов
    reels = [];
    
    // Проверяем наличие контейнера
    if (!slotsContainer) {
      console.error('Slots: не найден контейнер для слотов');
      slotsContainer = document.querySelector('.slot-reels');
      
      if (!slotsContainer) {
        console.error('Slots: контейнер all-slot-reels также не найден');
        return;
      }
    }
    
    // Очищаем контейнер
    slotsContainer.innerHTML = '';
    console.log('Slots: очистка контейнера');
    
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
      
      slotsContainer.appendChild(rowElement);
    }
    
    console.log('Slots: создано барабанов:', reels.length);
  }
  
  // Настройка звуков
  function setupSounds() {
    try {
      // Создаем аудио-контексты если поддерживаются
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        
        // Заглушка для локальной разработки
        spinSound = { play: () => console.log('Звук вращения') };
        stopSound = { play: () => console.log('Звук остановки') };
        winSound = { play: () => console.log('Звук выигрыша') };
        loseSound = { play: () => console.log('Звук проигрыша') };
      }
    } catch (e) {
      console.log('Аудио не поддерживается', e);
    }
  }
  
  // Заполнение слотов случайными символами
  function populateSlots() {
    reels.forEach(reel => {
      // Очищаем ленту
      reel.innerHTML = '';
      
      // Добавляем случайный символ
      const symbolElement = document.createElement('div');
      symbolElement.className = 'symbol';
      symbolElement.textContent = getRandomSymbol();
      
      reel.appendChild(symbolElement);
    });
  }
  
  // Получение случайного символа
  function getRandomSymbol() {
    const randomIndex = Math.floor(Math.random() * symbols.length);
    return symbols[randomIndex];
  }
  
  // Получение взвешенного случайного символа
  function getWeightedRandomSymbol() {
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
  }
  
  // Запуск вращения
  async function spin() {
    console.log('Slots: запуск вращения');
    
    // Проверка наличия casinoApp
    if (!window.casinoApp) {
      console.error('Slots: casinoApp не найден');
      alert('Ошибка инициализации приложения');
      return;
    }
    
    // Проверяем, не вращаются ли уже барабаны
    if (isSpinning) {
      console.log('Slots: барабаны уже вращаются');
      return;
    }
    
    // Проверка наличия элементов
    if (!slotsBet) {
      console.error('Slots: элемент ставки не найден');
      return;
    }
    
    // Получаем размер ставки
    const betAmount = parseInt(slotsBet.value);
    
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
    
    // Устанавливаем состояние вращения
    isSpinning = true;
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.textContent = 'ВРАЩЕНИЕ...';
    }
    
    // Тактильная обратная связь при запуске
    if (window.casinoApp.provideTactileFeedback) {
      window.casinoApp.provideTactileFeedback('medium');
    }
    
    // Скрываем предыдущий результат
    if (slotsResult) {
      slotsResult.style.opacity = '0';
      slotsResult.style.transform = 'translateY(20px)';
      setTimeout(() => {
        slotsResult.textContent = '';
        slotsResult.className = 'result';
        slotsResult.style.display = 'none';
      }, 300);
    }
    
    // Воспроизводим звук вращения
    if (spinSound) spinSound.play();
    
    // Генерируем результаты для каждого барабана
    // Определяем символы для матрицы 3x3
    slotMatrix = [];
    for (let row = 0; row < rowCount; row++) {
      slotMatrix[row] = [];
      for (let col = 0; col < colCount; col++) {
        slotMatrix[row][col] = getWeightedRandomSymbol();
      }
    }
    
    try {
      // Запускаем вращение барабанов с разными задержками для всех 9 позиций
      const spinPromises = [];
      for (let i = 0; i < reels.length; i++) {
        const row = Math.floor(i / colCount);
        const col = i % colCount;
        
        // Проверяем наличие барабана
        if (!reels[i]) {
          console.error(`Slots: барабан ${i} не найден`);
          continue;
        }
        
        // Вращение с задержкой в зависимости от столбца
        const promise = animateReel(reels[i], 
                                   slotMatrix[row][col], 
                                   col * 400 + row * 100); // Задержка для каждого барабана
        spinPromises.push(promise);
      }
      
      // Ждем окончания вращения всех барабанов
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
        if (winSound) winSound.play();
      } else {
        if (window.casinoApp.provideTactileFeedback) {
          window.casinoApp.provideTactileFeedback('warning');
        }
        if (loseSound) loseSound.play();
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
      console.error('Ошибка во время игры в слоты:', error);
      window.casinoApp.showNotification('Произошла ошибка. Пожалуйста, попробуйте снова.');
    } finally {
      // Сбрасываем состояние
      isSpinning = false;
      if (spinBtn) {
        spinBtn.disabled = false;
        spinBtn.textContent = 'КРУТИТЬ';
      }
    }
  }
  
  // Анимация вращения барабана с задержкой
  function animateReel(reel, finalSymbol, delay) {
    return new Promise(resolve => {
      // Удаляем существующие символы
      reel.innerHTML = '';
      
      // Создаем ленту символов для анимации (виртуальное вращение)
      // Добавляем много случайных символов, последний будет итоговым
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
        
        // Воспроизводим звук остановки с задержкой
        setTimeout(() => {
          if (stopSound) stopSound.play();
        }, 2800); // Немного раньше завершения анимации
        
        // Завершаем анимацию
        setTimeout(() => {
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
    });
  }
  
  // Проверка выигрыша с новой логикой для матрицы 3x3
  function checkWin(matrix) {
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
  }
  
  // Отображение результата игры
  function displayResult(isWin, amount, description) {
    if (!slotsResult) {
      console.error('Slots: элемент slotsResult не найден');
      return;
    }
    
    // Обновляем текст результата
    if (isWin) {
      slotsResult.innerHTML = `
        <div class="win-icon">🎉</div>
        <div class="win-title">Вы выиграли ${amount} ⭐!</div>
        <div class="win-description">${description}</div>
      `;
      slotsResult.classList.add('win');
      slotsResult.classList.remove('lose');
      
      // Подсвечиваем выигрышные линии
      highlightWinLines();
    } else {
      slotsResult.innerHTML = `
        <div class="lose-icon">😢</div>
        <div class="lose-title">Не повезло</div>
        <div class="lose-description">${description}</div>
      `;
      slotsResult.classList.add('lose');
      slotsResult.classList.remove('win');
    }
    
    // Показываем результат с анимацией
    slotsResult.style.display = 'block';
    setTimeout(() => {
      slotsResult.style.opacity = '1';
      slotsResult.style.transform = 'translateY(0)';
    }, 50);
  }
  
  // Подсветка выигрышных линий
  function highlightWinLines() {
    // Здесь можно добавить визуальное выделение выигрышных линий
    // Например, добавить подсветку символов, которые составляют выигрышную комбинацию
    
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
  }
  
  // Возвращаем публичные методы
  return {
    init,
    spin
  };
})();

// Глобальный экспорт объекта игры
window.slotsGame = slotsGame;

// Регистрация в новой структуре
if (window.registerGame) {
  window.registerGame('slotsGame', slotsGame);
  console.log('[Slots] Игра зарегистрирована в центральном хранилище');
} else {
  console.warn('[Slots] Функция registerGame не найдена, используем только глобальный экспорт');
}

console.log('[Slots] Экспорт игрового объекта завершен');