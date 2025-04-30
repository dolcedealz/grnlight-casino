// public/js/games/guessnumber.js

// Guess the Number game implementation
const guessNumberGame = (() => {
    // Game elements
    const guessBtn = document.getElementById('guess-btn');
    const guessBet = document.getElementById('guess-bet');
    const guessInput = document.getElementById('guess-input');
    const guessResult = document.getElementById('guess-result');
    const minRange = document.getElementById('min-range');
    const maxRange = document.getElementById('max-range');
    
    // Game state
    let isProcessing = false;
    let minNumber = 1;
    let maxNumber = 100;
    
    // Init function
    function init() {
      // Add event listeners
      guessBtn.addEventListener('click', makeGuess);
      
      // Set range display
      minRange.textContent = minNumber;
      maxRange.textContent = maxNumber;
      
      // Set input limits
      guessInput.min = minNumber;
      guessInput.max = maxNumber;
      guessInput.value = Math.floor((minNumber + maxNumber) / 2);
    }
    
    // Make a guess
    async function makeGuess() {
      // Check if already processing
      if (isProcessing) return;
      
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
      guessBtn.disabled = true;
      guessResult.textContent = '';
      guessResult.className = 'result';
      
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
      } catch (error) {
        console.error('Error during guess number game:', error);
        window.casinoApp.showNotification('An error occurred. Please try again.');
      } finally {
        // Reset state
        isProcessing = false;
        guessBtn.disabled = false;
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
    
    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
    
    // Return public methods
    return {
      init,
      makeGuess
    };
  })();
  // Добавить в конец файла guessnumber.js
// После строки: })();

// Глобальный экспорт объекта игры
window.guessNumberGame = guessNumberGame;
console.log('[GuessNumber] Экспорт игрового объекта в глобальную область видимости');