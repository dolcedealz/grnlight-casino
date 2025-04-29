// public/js/games/miner.js

// Miner game implementation
const minerGame = (() => {
    // Game elements
    const newGameBtn = document.getElementById('new-game-btn');
    const cashoutBtn = document.getElementById('cashout-btn');
    const minerBet = document.getElementById('miner-bet');
    const minesCount = document.getElementById('mines-count');
    const minerGrid = document.getElementById('miner-grid');
    const potentialWin = document.getElementById('potential-win');
    const minerResult = document.getElementById('miner-result');
    
    // Game state
    let isPlaying = false;
    let gameData = {
      grid: [],
      mines: [],
      revealedCells: [],
      totalCells: 25,  // 5x5 grid
      minesCount: 3,
      currentMultiplier: 1,
      betAmount: 0
    };
    
    // Multiplier formula (simplified)
    // The more cells revealed, the higher the multiplier
    function calculateMultiplier(revealed, total, mines) {
      const riskFactor = (total - mines) / (total - mines - revealed);
      return Math.floor(riskFactor * 100) / 100;
    }
    
    // Init function
    function init() {
      // Add event listeners
      newGameBtn.addEventListener('click', startNewGame);
      cashoutBtn.addEventListener('click', cashout);
      minesCount.addEventListener('change', updateMineCount);
      
      // Create the initial grid
      createGrid();
      
      // Update UI elements
      updatePotentialWin();
    }
    
    // Create the game grid
    function createGrid() {
      // Clear current grid
      minerGrid.innerHTML = '';
      
      // Create 5x5 grid
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.dataset.row = i;
          cell.dataset.col = j;
          cell.dataset.index = i * 5 + j;
          
          // Add click event only if we're playing
          if (isPlaying) {
            cell.addEventListener('click', () => revealCell(i * 5 + j));
          }
          
          minerGrid.appendChild(cell);
        }
      }
    }
    
    // Update the mine count when selector changes
    function updateMineCount() {
      gameData.minesCount = parseInt(minesCount.value);
      updatePotentialWin();
    }
    
    // Update potential win display
    function updatePotentialWin() {
      const betAmt = parseInt(minerBet.value) || 0;
      const multiplier = calculateMultiplier(
        gameData.revealedCells.length,
        gameData.totalCells,
        gameData.minesCount
      );
      
      const potential = Math.floor(betAmt * multiplier);
      potentialWin.textContent = potential;
      
      // Also update game data
      gameData.currentMultiplier = multiplier;
    }
    
    // Start a new game
    function startNewGame() {
      // Get bet amount
      const betAmount = parseInt(minerBet.value);
      
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
      
      // Reset game state
      isPlaying = true;
      gameData = {
        grid: Array(gameData.totalCells).fill('empty'),
        mines: [],
        revealedCells: [],
        totalCells: 25,
        minesCount: parseInt(minesCount.value),
        currentMultiplier: 1,
        betAmount: betAmount
      };
      
      // Place mines
      placeMines();
      
      // Update UI
      createGrid();
      cashoutBtn.disabled = false;
      newGameBtn.disabled = true;
      minerResult.textContent = '';
      minerResult.className = 'result';
      
      // Process initial bet with server
      window.casinoApp.processGameResult(
        'miner',
        betAmount,
        'bet',
        0,
        { minesCount: gameData.minesCount }
      );
      
      // Update UI elements
      updatePotentialWin();
    }
    
    // Place mines randomly on the grid
    function placeMines() {
      // Clear existing mines
      gameData.mines = [];
      
      // Place new mines
      while (gameData.mines.length < gameData.minesCount) {
        const randomIndex = Math.floor(Math.random() * gameData.totalCells);
        
        // Only add if not already a mine
        if (!gameData.mines.includes(randomIndex)) {
          gameData.mines.push(randomIndex);
          gameData.grid[randomIndex] = 'mine';
        }
      }
      
      console.log('Mines placed at:', gameData.mines);
    }
    
    // Reveal a cell
    async function revealCell(index) {
      // Check if already revealed
      if (gameData.revealedCells.includes(index)) {
        return;
      }
      
      // Check if game is active
      if (!isPlaying) {
        return;
      }
      
      // Get the cell element
      const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
      
      // Check if it's a mine
      if (gameData.grid[index] === 'mine') {
        // Game over
        revealAllMines();
        
        // Update UI
        cell.classList.add('mine', 'exploded');
        cell.innerHTML = '💥';
        
        // Set game state
        isPlaying = false;
        cashoutBtn.disabled = true;
        newGameBtn.disabled = false;
        
        // Show result
        minerResult.textContent = 'Boom! You hit a mine. Game over!';
        minerResult.classList.add('lose');
        
        // Process loss with server
        await window.casinoApp.processGameResult(
          'miner',
          0, // No additional bet
          'lose',
          0,
          {
            revealedCells: gameData.revealedCells,
            hitMine: index,
            mines: gameData.mines
          }
        );
      } else {
        // Safe cell
        gameData.revealedCells.push(index);
        
        // Update UI
        cell.classList.add('revealed');
        cell.innerHTML = '💰';
        
        // Update multiplier and potential win
        updatePotentialWin();
        
        // Check if all safe cells are revealed (win condition)
        if (gameData.revealedCells.length === gameData.totalCells - gameData.minesCount) {
          // Player revealed all safe cells
          await automaticCashout();
        }
      }
    }
    
    // Reveal all mines
    function revealAllMines() {
      gameData.mines.forEach(index => {
        const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
        cell.classList.add('mine');
        cell.innerHTML = '💣';
      });
    }
    
    // Cashout
    async function cashout() {
      if (!isPlaying || gameData.revealedCells.length === 0) {
        return;
      }
      
      // Calculate win amount
      const winAmount = Math.floor(gameData.betAmount * gameData.currentMultiplier);
      
      // Update UI
      minerResult.textContent = `You won ${winAmount} Stars! 🎉`;
      minerResult.classList.add('win');
      
      // Reset game state
      isPlaying = false;
      cashoutBtn.disabled = true;
      newGameBtn.disabled = false;
      
      // Reveal all mines
      revealAllMines();
      
      // Process win with server
      await window.casinoApp.processGameResult(
        'miner',
        0, // No additional bet
        'win',
        winAmount,
        {
          revealedCells: gameData.revealedCells,
          multiplier: gameData.currentMultiplier,
          mines: gameData.mines
        }
      );
    }
    
    // Automatic cashout (when all safe cells revealed)
    async function automaticCashout() {
      // Calculate win amount - max multiplier for revealing all safe cells
      const winAmount = gameData.betAmount * gameData.currentMultiplier;
      
      // Update UI
      minerResult.textContent = `Perfect! You revealed all safe cells! You won ${winAmount} Stars! 🎉`;
      minerResult.classList.add('win');
      
      // Reset game state
      isPlaying = false;
      cashoutBtn.disabled = true;
      newGameBtn.disabled = false;
      
      // Reveal all mines
      revealAllMines();
      
      // Process win with server
      await window.casinoApp.processGameResult(
        'miner',
        0, // No additional bet
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
    
    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
    
    // Return public methods
    return {
      init,
      startNewGame,
      cashout
    };
  })();