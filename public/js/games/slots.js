// public/js/games/slots.js

// Slots game implementation
const slotsGame = (() => {
    // Game elements
    const reels = [
      document.getElementById('reel1'),
      document.getElementById('reel2'),
      document.getElementById('reel3')
    ];
    const spinBtn = document.getElementById('spin-btn');
    const slotsResult = document.getElementById('slots-result');
    const slotsBet = document.getElementById('slots-bet');
    
    // Game state
    let isSpinning = false;
    let symbols = ['🍒', '🍋', '🍇', '🍊', '🍉', '💎', '7️⃣', '🤑'];
    
    // Symbol values (multipliers)
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
    
    // Init function
    function init() {
      // Add event listeners
      spinBtn.addEventListener('click', spin);
      
      // Initialize reels with random symbols
      populateReels();
    }
    
    // Fill reels with symbols
    function populateReels() {
      reels.forEach(reel => {
        // Clear current content
        reel.innerHTML = '';
        
        // Add a random symbol
        const symbol = getRandomSymbol();
        const symbolElement = document.createElement('div');
        symbolElement.className = 'symbol';
        symbolElement.textContent = symbol;
        reel.appendChild(symbolElement);
      });
    }
    
    // Get a random symbol
    function getRandomSymbol() {
      const randomIndex = Math.floor(Math.random() * symbols.length);
      return symbols[randomIndex];
    }
    
    // Spin the reels
    async function spin() {
      // Check if already spinning
      if (isSpinning) return;
      
      // Get bet amount
      const betAmount = parseInt(slotsBet.value);
      
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
      
      // Set spinning state
      isSpinning = true;
      spinBtn.disabled = true;
      slotsResult.textContent = '';
      slotsResult.className = 'result';
      
      // Animate reels
      const spinPromises = reels.map((reel, index) => animateReel(reel, index));
      
      try {
        // Wait for all reels to stop
        const finalSymbols = await Promise.all(spinPromises);
        
        // Check result
        const result = checkWin(finalSymbols);
        
        // Calculate win amount
        const winAmount = result.win ? betAmount * result.multiplier : 0;
        
        // Display result
        displayResult(result.win, winAmount);
        
        // Process game result with the server
        const gameData = {
          symbols: finalSymbols,
          multiplier: result.multiplier
        };
        
        await window.casinoApp.processGameResult(
          'slots',
          betAmount,
          result.win ? 'win' : 'lose',
          winAmount,
          gameData
        );
      } catch (error) {
        console.error('Error during slots game:', error);
        window.casinoApp.showNotification('An error occurred. Please try again.');
      } finally {
        // Reset state
        isSpinning = false;
        spinBtn.disabled = false;
      }
    }
    
    // Animate a single reel
    function animateReel(reel, index) {
      return new Promise(resolve => {
        // Number of spins
        const spins = 20 + index * 5; // More spins for later reels
        let counter = 0;
        
        // Store current symbol
        let currentSymbol = '';
        
        // Animation interval
        const interval = setInterval(() => {
          // Get new random symbol
          const symbol = getRandomSymbol();
          currentSymbol = symbol;
          
          // Update reel display
          reel.innerHTML = `<div class="symbol">${symbol}</div>`;
          
          // Add spinning effect
          reel.style.transform = `translateY(${Math.random() * 10 - 5}px)`;
          
          // Increment counter
          counter++;
          
          // Check if animation should stop
          if (counter >= spins) {
            clearInterval(interval);
            
            // Reset transform
            reel.style.transform = 'translateY(0)';
            
            // Resolve promise with final symbol
            resolve(currentSymbol);
          }
        }, 50);
      });
    }
    
    // Check if player won
    function checkWin(symbols) {
      // Check for all symbols the same (jackpot)
      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        return {
          win: true,
          multiplier: symbolValues[symbols[0]]
        };
      }
      
      // Check for two matching symbols
      if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
        // Find the symbol that appears at least twice
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
          multiplier: Math.floor(symbolValues[matchedSymbol] / 2) // Half value for two matching
        };
      }
      
      // No match
      return {
        win: false,
        multiplier: 0
      };
    }
    
    // Display result to the player
    function displayResult(isWin, amount) {
      if (isWin) {
        slotsResult.textContent = `You won ${amount} Stars! 🎉`;
        slotsResult.classList.add('win');
      } else {
        slotsResult.textContent = 'Better luck next time!';
        slotsResult.classList.add('lose');
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