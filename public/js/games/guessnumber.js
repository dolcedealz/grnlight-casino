// public/js/games/guessnumber.js

// Guess the Number game implementation
const guessNumberGame = (() => {
  // Game elements
  let guessBtn;
  let guessBet;
  let guessInput;
  let guessResult;
  let minRange;
  let maxRange;
  
  // Game state
  let isProcessing = false;
  let minNumber = 1;
  let maxNumber = 100;
  
  // Init function
  function init() {
    console.log('[GuessNumber] Инициализация игры Guess Number');
    
    // Получаем элементы DOM
    guessBtn = document.getElementById('guess-btn');
    guessBet = document.getElementById('guess-bet');
    guessInput = document.getElementById('guess-input');
    guessResult = document.getElementById('guess-result');
    minRange = document.getElementById('min-range');
    maxRange = document.getElementById('max-range');
    
    // Проверяем наличие основных элементов
    if (!guessBtn || !guessInput) {
      console.error('[GuessNumber] Критические элементы игры не найдены в DOM');
      return false;
    }
    
    // Add event listeners
    guessBtn.addEventListener('click', makeGuess);
    console.log('[GuessNumber] Установлен обработчик для кнопки угадывания');
    
    // Set range display
    if (minRange && maxRange) {
      minRange.textContent = minNumber;
      maxRange.textContent = maxNumber;
    } else {
      console.warn('[GuessNumber] Элементы диапазона не найдены');
    }
    
    // Set input limits
    if (guessInput) {
      guessInput.min = minNumber;
      guessInput.max = maxNumber;
      guessInput.value = Math.floor((minNumber + maxNumber) / 2);
    }
    
    console.log('[GuessNumber] Инициализация завершена успешно');
    return true;
  }
  
  // Make a guess
  async function makeGuess() {
    console.log('[GuessNumber] Попытка угадывания числа');
    
    // Проверка доступности casinoApp
    if (!window.casinoApp) {
      console.error('[GuessNumber] casinoApp не найден');
      alert('Ошибка инициализации приложения');
      return;
    }
    
    // Check if already processing
    if (isProcessing) {
      console.log('[GuessNumber] Запрос игнорирован: уже обрабатывается предыдущий запрос');
      return;
    }
    
    // Проверка наличия элементов
    if (!guessBet || !guessInput) {
      console.error('[GuessNumber] Элементы ставки или ввода не найдены');
      window.casinoApp.showNotification('Ошибка инициализации игры');
      return;
    }
    
    // Get bet amount
    const betAmount = parseInt(guessBet.value);
    
    // Validate bet
    if (isNaN(betAmount) || betAmount <= 0) {
      window.casinoApp.showNotification('Please enter a valid bet amount');
      return;
    }
    
    // Check balance
    if (betAmount > window.casinoApp.currentUser.balance) {
      window.casinoApp.showNotification('Insufficient balance');
      return;
    }
    
    // Get player's guess
    const playerGuess = parseInt(guessInput.value);
    
    // Validate guess
    if (isNaN(playerGuess) || playerGuess < minNumber || playerGuess > maxNumber) {
      window.casinoApp.showNotification(`Please enter a number between ${minNumber} and ${maxNumber}`);
      return;
    }
    
    // Set processing state
    isProcessing = true;
    if (guessBtn) {
      guessBtn.disabled = true;
    }
    
    if (guessResult) {
      guessResult.textContent = '';
      guessResult.className = 'result';
    }
    
    try {
      // Generate winning number and check result
      const result = processGuess(playerGuess);
      
      // Calculate win amount
      const winAmount = result.win ? betAmount * result.multiplier : 0;
      
      // Display result
      displayResult(result.win, winAmount, result.number, playerGuess);
      
      // Process game result with the server
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
      
      console.log(`[GuessNumber] Игра завершена: загадано ${result.number}, игрок выбрал ${playerGuess}, ${result.win ? 'победа' : 'проигрыш'}`);
    } catch (error) {
      console.error('[GuessNumber] Ошибка во время игры:', error);
      window.casinoApp.showNotification('An error occurred. Please try again.');
    } finally {
      // Reset state
      isProcessing = false;
      if (guessBtn) {
        guessBtn.disabled = false;
      }
    }
  }
  
  // Process the guess and determine results
  function processGuess(playerGuess) {
    // Generate random number between min and max (inclusive)
    const winningNumber = Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber;
    
    // Calculate difference
    const difference = Math.abs(winningNumber - playerGuess);
    
    // Determine win and multiplier
    if (difference === 0) {
      // Exact match
      return {
        win: true,
        multiplier: 10,
        number: winningNumber
      };
    } else if (difference <= 5) {
      // Close (within 5)
      return {
        win: true,
        multiplier: 3,
        number: winningNumber
      };
    } else if (difference <= 10) {
      // Getting warmer (within 10)
      return {
        win: true,
        multiplier: 1.5,
        number: winningNumber
      };
    } else {
      // Loss
      return {
        win: false,
        multiplier: 0,
        number: winningNumber
      };
    }
  }
  
  // Display result to the player
  function displayResult(isWin, amount, winningNumber, playerGuess) {
    if (!guessResult) {
      console.error('[GuessNumber] Элемент результата не найден');
      return;
    }
    
    if (isWin) {
      if (winningNumber === playerGuess) {
        guessResult.textContent = `Exact match! Number was ${winningNumber}. You won ${amount} Stars! 🎉`;
      } else {
        guessResult.textContent = `Close! Number was ${winningNumber}. You won ${amount} Stars! 🎉`;
      }
      guessResult.classList.add('win');
    } else {
      guessResult.textContent = `Not close enough. Number was ${winningNumber}. Better luck next time!`;
      guessResult.classList.add('lose');
    }
  }
  
  // Return public methods
  return {
    init,
    makeGuess
  };
})();

// Экспорт в глобальное пространство имен
window.guessNumberGame = guessNumberGame;

// Регистрация в центральном хранилище игр
if (window.registerGame) {
  window.registerGame('guessNumberGame', guessNumberGame);
  console.log('[GuessNumber] Игра зарегистрирована в центральном хранилище');
} else {
  console.warn('[GuessNumber] Функция registerGame не найдена, используется только глобальный экспорт');
}

console.log('[GuessNumber] Экспорт игрового объекта в глобальную область видимости');