// public/js/games/slots.js

// Улучшенная версия игры Slots с анимациями и обратной связью
const slotsGame = (() => {
  // Элементы игры
  const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];
  const spinBtn = document.getElementById('spin-btn');
  const slotsResult = document.getElementById('slots-result');
  const slotsBet = document.getElementById('slots-bet');
  
  // Состояние игры
  let isSpinning = false;
  let symbols = ['🍒', '🍋', '🍇', '🍊', '🍉', '💎', '7️⃣', '🤑'];
  
  // Аудио эффекты
  let spinSound, winSound, loseSound;
  
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
    fullMatch: {
      '🍒': 'Три вишни! Х2 выигрыш!',
      '🍋': 'Три лимона! Х2 выигрыш!',
      '🍇': 'Три винограда! Х3 выигрыш!',
      '🍊': 'Три апельсина! Х3 выигрыш!',
      '🍉': 'Три арбуза! Х4 выигрыш!',
      '💎': 'Три алмаза! Х5 выигрыш!',
      '7️⃣': 'Джекпот! Три семерки! Х10 выигрыш!',
      '🤑': 'Большой джекпот! Х15 выигрыш!'
    },
    partialMatch: 'Частичное совпадение! Получаете половину выигрыша!'
  };
  
  // Функция инициализации
  function init() {
    console.log('Инициализация игры Slots');
    
    // Добавляем обработчики событий
    spinBtn.addEventListener('click', spin);
    
    // Инициализируем барабаны случайными символами
    populateReels();
    
    // Настраиваем звуки (если поддерживаются)
    setupSounds();
    
    // Скрываем результат
    if (slotsResult) slotsResult.style.display = 'none';
  }
  
  // Настройка звуков
  function setupSounds() {
    try {
      // Создаем аудио-контексты если поддерживаются
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        
        // Заглушка для локальной разработки
        // В реальном приложении здесь были бы реальные звуковые файлы
        spinSound = { play: () => console.log('Звук вращения') };
        winSound = { play: () => console.log('Звук выигрыша') };
        loseSound = { play: () => console.log('Звук проигрыша') };
      }
    } catch (e) {
      console.log('Аудио не поддерживается', e);
    }
  }
  
  // Заполнение барабанов символами
  function populateReels() {
    reels.forEach(reel => {
      // Очищаем текущее содержимое
      reel.innerHTML = '';
      
      // Добавляем случайный символ с эффектом блеска
      const symbolElement = document.createElement('div');
      symbolElement.className = 'symbol';
      symbolElement.textContent = getRandomSymbol();
      
      // Добавляем внутренний контейнер для эффекта блеска
      const symbolContainer = document.createElement('div');
      symbolContainer.className = 'symbol-container';
      symbolContainer.appendChild(symbolElement);
      
      reel.appendChild(symbolContainer);
    });
  }
  
  // Получение случайного символа
  function getRandomSymbol() {
    const randomIndex = Math.floor(Math.random() * symbols.length);
    return symbols[randomIndex];
  }
  
  // Функция для получения взвешенного случайного символа
  // Более редкие символы имеют меньший шанс выпадения
  function getWeightedRandomSymbol() {
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
  
  // Вращение барабанов
  async function spin() {
    // Проверяем, не вращаются ли уже барабаны
    if (isSpinning) return;
    
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
    spinBtn.disabled = true;
    spinBtn.textContent = 'ВРАЩЕНИЕ...';
    
    // Скрываем предыдущий результат с анимацией
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
    
    // Анимируем барабаны
    const spinPromises = reels.map((reel, index) => animateReel(reel, index));
    
    try {
      // Ждем, пока все барабаны остановятся
      const finalSymbols = await Promise.all(spinPromises);
      
      // Проверяем результат
      const result = checkWin(finalSymbols);
      
      // Вычисляем выигрыш
      const winAmount = result.win ? Math.floor(betAmount * result.multiplier) : 0;
      
      // Отображаем результат с анимацией
      displayResult(result.win, winAmount, result.description);
      
      // Воспроизводим звук победы или поражения
      if (result.win && winSound) {
        winSound.play();
      } else if (!result.win && loseSound) {
        loseSound.play();
      }
      
      // Отправляем результат на сервер
      const gameData = {
        symbols: finalSymbols,
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
      spinBtn.disabled = false;
      spinBtn.textContent = 'КРУТИТЬ';
    }
  }
  
  // Анимация вращения барабана
  function animateReel(reel, index) {
    return new Promise(resolve => {
      // Количество вращений увеличивается с индексом барабана
      // Это создает эффект последовательной остановки барабанов
      const spins = 15 + index * 5;
      let counter = 0;
      
      // Сохраняем текущий символ
      let currentSymbol = '';
      
      // Создаем массив символов для анимации
      let symbolsArray = [];
      for (let i = 0; i < spins; i++) {
        symbolsArray.push(getWeightedRandomSymbol());
      }
      
      // Последний символ - это результат
      // Мы можем манипулировать им для нужной вероятности выигрыша
      currentSymbol = symbolsArray[symbolsArray.length - 1];
      
      // Интервал анимации
      const interval = setInterval(() => {
        if (counter >= symbolsArray.length) {
          clearInterval(interval);
          
          // Добавляем класс для анимации остановки
          const symbolContainer = reel.querySelector('.symbol-container');
          if (symbolContainer) {
            symbolContainer.classList.add('stopped');
          }
          
          // Сбрасываем transform
          reel.style.transform = 'translateY(0)';
          
          // Добавляем небольшую задержку для визуального эффекта
          setTimeout(() => {
            resolve(currentSymbol);
          }, 200);
          
          return;
        }
        
        // Обновляем символ
        const symbolElement = reel.querySelector('.symbol');
        if (symbolElement) {
          const newSymbol = symbolsArray[counter];
          symbolElement.textContent = newSymbol;
          currentSymbol = newSymbol;
        }
        
        // Добавляем эффект дрожания
        const randomOffset = Math.random() * 10 - 5;
        reel.style.transform = `translateY(${randomOffset}px)`;
        
        // Увеличиваем счетчик
        counter++;
      }, 100 - (index * 10)); // Скорость зависит от индекса барабана
    });
  }
  
  // Проверка выигрыша
  function checkWin(symbols) {
    // Проверяем все символы на совпадение (джекпот)
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      return {
        win: true,
        multiplier: symbolValues[symbols[0]],
        description: winDescriptions.fullMatch[symbols[0]]
      };
    }
    
    // Проверяем совпадение двух символов
    if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
      // Находим символ, который встречается как минимум дважды
      let matchedSymbol;
      
      if (symbols[0] === symbols[1]) {
        matchedSymbol = symbols[0];
      } else if (symbols[1] === symbols[2]) {
        matchedSymbol = symbols[1];
      } else {
        matchedSymbol = symbols[0];
      }
      
      return {
        win: true,
        multiplier: Math.floor(symbolValues[matchedSymbol] / 2), // Половина стоимости за две совпадающие
        description: winDescriptions.partialMatch
      };
    }
    
    // Нет совпадений
    return {
      win: false,
      multiplier: 0,
      description: 'Повезет в следующий раз!'
    };
  }
  
  // Отображение результата игроку
  function displayResult(isWin, amount, description) {
    if (!slotsResult) return;
    
    // Обновляем текст результата
    if (isWin) {
      slotsResult.innerHTML = `
        <div class="win-icon">🎉</div>
        <div class="win-title">Вы выиграли ${amount} ⭐!</div>
        <div class="win-description">${description}</div>
      `;
      slotsResult.classList.add('win');
      slotsResult.classList.remove('lose');
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
  
  // Инициализация при загрузке
  document.addEventListener('DOMContentLoaded', init);
  
  // Возвращаем публичные методы
  return {
    init,
    spin
  };
})();