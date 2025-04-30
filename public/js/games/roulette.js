// public/js/games/roulette.js

// Roulette game implementation
const rouletteGame = (() => {
    // Game elements
    const spinWheelBtn = document.getElementById('spin-wheel-btn');
    const rouletteBet = document.getElementById('roulette-bet');
    const rouletteBetType = document.getElementById('roulette-bet-type');
    const betColorContainer = document.getElementById('bet-color-container');
    const betNumberContainer = document.getElementById('bet-number-container');
    const betOddEvenContainer = document.getElementById('bet-odd-even-container');
    const rouletteNumber = document.getElementById('roulette-number');
    const colorBtns = document.querySelectorAll('.color-btn');
    const oddEvenBtns = document.querySelectorAll('.odd-even-btn');
    const wheelInner = document.getElementById('wheel-inner');
    const rouletteBall = document.getElementById('roulette-ball');
    const rouletteResult = document.getElementById('roulette-result');
    
    // Game state
    let isSpinning = false;
    let selectedBetType = 'color';
    let selectedColor = null;
    let selectedOddEven = null;
    
    // Roulette numbers
    const numbers = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    
    // Map of colors for each number
    const numberColors = {
      '0': 'green',
      '1': 'red',
      '2': 'black',
      '3': 'red',
      '4': 'black',
      '5': 'red',
      '6': 'black',
      '7': 'red',
      '8': 'black',
      '9': 'red',
      '10': 'black',
      '11': 'black',
      '12': 'red',
      '13': 'black',
      '14': 'red',
      '15': 'black',
      '16': 'red',
      '17': 'black',
      '18': 'red',
      '19': 'red',
      '20': 'black',
      '21': 'red',
      '22': 'black',
      '23': 'red',
      '24': 'black',
      '25': 'red',
      '26': 'black',
      '27': 'red',
      '28': 'black',
      '29': 'black',
      '30': 'red',
      '31': 'black',
      '32': 'red',
      '33': 'black',
      '34': 'red',
      '35': 'black',
      '36': 'red'
    };
    
    // Init function
    function init() {
      // Add event listeners
      spinWheelBtn.addEventListener('click', spin);
      rouletteBetType.addEventListener('change', changeBetType);
      
      // Color button listeners
      colorBtns.forEach(btn => {
        btn.addEventListener('click', selectColor);
      });
      
      // Odd/Even button listeners
      oddEvenBtns.forEach(btn => {
        btn.addEventListener('click', selectOddEven);
      });
      
      // Initialize the wheel
      setupWheel();
    }
    
    // Setup the roulette wheel
    function setupWheel() {
      // Clear any existing numbers
      wheelInner.innerHTML = '';
      
      // Create number slots
      numbers.forEach((number, index) => {
        // Calculate position on the wheel
        const angle = (index * 360 / numbers.length);
        const color = numberColors[number.toString()];
        
        // Create number element
        const numberElement = document.createElement('div');
        numberElement.className = `wheel-number ${color}`;
        numberElement.textContent = number;
        numberElement.style.transform = `rotate(${angle}deg) translateY(-110px)`;
        
        wheelInner.appendChild(numberElement);
      });
      
      // Position the ball
      rouletteBall.style.transform = 'rotate(0deg) translateY(-90px)';
    }
    
    // Change bet type
    function changeBetType() {
      selectedBetType = rouletteBetType.value;
      
      // Hide all containers
      betColorContainer.classList.add('hidden');
      betNumberContainer.classList.add('hidden');
      betOddEvenContainer.classList.add('hidden');
      
      // Show the appropriate container
      switch (selectedBetType) {
        case 'color':
          betColorContainer.classList.remove('hidden');
          break;
        case 'number':
          betNumberContainer.classList.remove('hidden');
          break;
        case 'odd-even':
          betOddEvenContainer.classList.remove('hidden');
          break;
      }
      
      // Reset selections
      selectedColor = null;
      selectedOddEven = null;
      colorBtns.forEach(btn => btn.classList.remove('selected'));
      oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
    }
    
    // Select color
    function selectColor(event) {
      // Remove selected class from all
      colorBtns.forEach(btn => btn.classList.remove('selected'));
      
      // Add selected class to clicked
      event.target.classList.add('selected');
      
      // Store selected color
      selectedColor = event.target.getAttribute('data-color');
    }
    
    // Select odd/even
    function selectOddEven(event) {
      // Remove selected class from all
      oddEvenBtns.forEach(btn => btn.classList.remove('selected'));
      
      // Add selected class to clicked
      event.target.classList.add('selected');
      
      // Store selected type
      selectedOddEven = event.target.getAttribute('data-type');
    }
    
    // Spin the wheel
    async function spin() {
      // Check if already spinning
      if (isSpinning) return;
      
      // Get bet amount
      const betAmount = parseInt(rouletteBet.value);
      
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
      
      // Validate bet type selection
      if (selectedBetType === 'color' && !selectedColor) {
        window.casinoApp.showNotification('Please select a color');
        return;
      }
      
      if (selectedBetType === 'odd-even' && !selectedOddEven) {
        window.casinoApp.showNotification('Please select odd or even');
        return;
      }
      
      if (selectedBetType === 'number') {
        const number = parseInt(rouletteNumber.value);
        if (isNaN(number) || number < 0 || number > 36) {
          window.casinoApp.showNotification('Please enter a valid number between 0 and 36');
          return;
        }
      }
      
      // Set spinning state
      isSpinning = true;
      spinWheelBtn.disabled = true;
      rouletteResult.textContent = '';
      rouletteResult.className = 'result';
      
      try {
        // Spin the wheel
        const result = await spinWheel();
        
        // Check if player won
        const winResult = checkWin(result);
        
        // Calculate win amount
        const winAmount = winResult.win ? betAmount * winResult.multiplier : 0;
        
        // Display result
        displayResult(winResult.win, winAmount, result);
        
        // Process game result with the server
        const gameData = {
          number: result,
          color: numberColors[result.toString()],
          betType: selectedBetType,
          selectedColor,
          selectedNumber: selectedBetType === 'number' ? parseInt(rouletteNumber.value) : null,
          selectedOddEven
        };
        
        await window.casinoApp.processGameResult(
          'roulette',
          betAmount,
          winResult.win ? 'win' : 'lose',
          winAmount,
          gameData
        );
      } catch (error) {
        console.error('Error during roulette game:', error);
        window.casinoApp.showNotification('An error occurred. Please try again.');
      } finally {
        // Reset state
        isSpinning = false;
        spinWheelBtn.disabled = false;
      }
    }
    
    // Spin the wheel animation
    function spinWheel() {
      return new Promise(resolve => {
        // Get random number of full rotations (3-6 rotations)
        const rotations = 3 + Math.floor(Math.random() * 3);
        
        // Get random result
        const randomIndex = Math.floor(Math.random() * numbers.length);
        const winningNumber = numbers[randomIndex];
        
        // Calculate the final position
        const finalAngle = rotations * 360 + (randomIndex * 360 / numbers.length);
        
        // Animate the wheel and ball
        wheelInner.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        rouletteBall.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        
        wheelInner.style.transform = `rotate(${-finalAngle}deg)`;
        rouletteBall.style.transform = `rotate(${finalAngle}deg) translateY(-90px)`;
        
        // Resolve after animation completes
        setTimeout(() => {
          resolve(winningNumber);
        }, 4500);
      });
    }
    
    // Check if player won
    function checkWin(result) {
      const resultColor = numberColors[result.toString()];
      const isOdd = result !== 0 && result % 2 === 1;
      
      switch (selectedBetType) {
        case 'color':
          if (selectedColor === resultColor) {
            return {
              win: true,
              multiplier: resultColor === 'green' ? 36 : 2 // Green (0) pays 36:1, red/black pays 2:1
            };
          }
          break;
          
        case 'number':
          const selectedNumber = parseInt(rouletteNumber.value);
          if (selectedNumber === result) {
            return {
              win: true,
              multiplier: 36 // Straight up bet pays 36:1
            };
          }
          break;
          
        case 'odd-even':
          if (result === 0) {
            // 0 is neither odd nor even in roulette rules
            return { win: false, multiplier: 0 };
          }
          
          if ((selectedOddEven === 'odd' && isOdd) || 
              (selectedOddEven === 'even' && !isOdd)) {
            return {
              win: true,
              multiplier: 2 // Odd/Even pays 2:1
            };
          }
          break;
      }
      
      return { win: false, multiplier: 0 };
    }
    
    // Display result to the player
    function displayResult(isWin, amount, number) {
      if (isWin) {
        rouletteResult.textContent = `Number ${number} - You won ${amount} Stars! 🎉`;
        rouletteResult.classList.add('win');
      } else {
        rouletteResult.textContent = `Number ${number} - Better luck next time!`;
        rouletteResult.classList.add('lose');
      }
    }
    
    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
    
    // Return public methods
    return {
      init,
      spin
    };
  })();
  // Добавить в конец файла roulette.js
// После строки: })();

// Глобальный экспорт объекта игры
window.rouletteGame = rouletteGame;
console.log('[Roulette] Экспорт игрового объекта в глобальную область видимости');