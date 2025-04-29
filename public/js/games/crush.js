// public/js/games/crush.js

// Crush game implementation
const crushGame = (() => {
    // Game elements
    const startBtn = document.getElementById('start-crush-btn');
    const cashoutBtn = document.getElementById('cash-crush-btn');
    const crushBet = document.getElementById('crush-bet');
    const multiplierDisplay = document.getElementById('multiplier');
    const graphLine = document.getElementById('graph-line');
    const crushGraph = document.getElementById('crush-graph');
    const crushResult = document.getElementById('crush-result');
    
    // Game state
    let isPlaying = false;
    let multiplier = 1.00;
    let gameInterval = null;
    let crashPoint = 1.00;
    let betAmount = 0;
    let graphPoints = [];
    let gameStartTime = 0;
    
    // Init function
    function init() {
      // Add event listeners
      startBtn.addEventListener('click', startGame);
      cashoutBtn.addEventListener('click', cashout);
      
      // Reset graph
      resetGraph();
    }
    
    // Reset the graph
    function resetGraph() {
      graphLine.style.strokeDasharray = '1000';
      graphLine.style.strokeDashoffset = '1000';
      graphPoints = [];
      updateGraph();
    }
    
    // Update the graph with current points
    function updateGraph() {
      if (graphPoints.length < 2) return;
      
      // Clear current path
      graphLine.setAttribute('d', '');
      
      // Create SVG path from points
      let path = `M ${graphPoints[0].x} ${graphPoints[0].y}`;
      
      for (let i = 1; i < graphPoints.length; i++) {
        path += ` L ${graphPoints[i].x} ${graphPoints[i].y}`;
      }
      
      // Set the new path
      graphLine.setAttribute('d', path);
      
      // Animate the path drawing
      const length = graphLine.getTotalLength();
      graphLine.style.strokeDasharray = length;
      graphLine.style.strokeDashoffset = '0';
    }
    
    // Add a point to the graph
    function addGraphPoint(multiplier) {
      const graphWidth = crushGraph.clientWidth;
      const graphHeight = crushGraph.clientHeight;
      
      // Calculate x position based on time elapsed
      const timeElapsed = Date.now() - gameStartTime;
      const x = Math.min((timeElapsed / 10000) * graphWidth, graphWidth - 10);
      
      // Calculate y position based on multiplier (inverted for SVG)
      // We'll use a log scale to better visualize higher multipliers
      const logMultiplier = Math.log(multiplier) / Math.log(1.5);
      const y = graphHeight - (logMultiplier * graphHeight / 4);
      
      graphPoints.push({ x, y });
      updateGraph();
    }
    
    // Start the game
    function startGame() {
      // Get bet amount
      betAmount = parseInt(crushBet.value);
      
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
      multiplier = 1.00;
      multiplierDisplay.textContent = multiplier.toFixed(2);
      isPlaying = true;
      
      // Calculate crash point (random between 1.0 and 10.0, with higher probability for lower values)
      // Using exponential distribution for realistic crash behavior
      crashPoint = 1 + Math.random() * Math.random() * 9;
      console.log('Game will crash at:', crashPoint.toFixed(2));
      
      // Update UI
      startBtn.disabled = true;
      cashoutBtn.disabled = false;
      crushResult.textContent = '';
      crushResult.className = 'result';
      
      // Reset and start graph
      resetGraph();
      gameStartTime = Date.now();
      addGraphPoint(multiplier);
      
      // Process initial bet with server
      window.casinoApp.processGameResult(
        'crush',
        betAmount,
        'bet',
        0,
        { startMultiplier: multiplier }
      );
      
      // Start the game interval
      gameInterval = setInterval(updateGame, 100);
    }
    
    // Update the game state
    function updateGame() {
      if (!isPlaying) return;
      
      // Increase multiplier (faster growth as multiplier gets higher)
      const growth = 0.01 * (1 + (multiplier - 1) / 10);
      multiplier += growth;
      
      // Update display
      multiplierDisplay.textContent = multiplier.toFixed(2);
      
      // Add point to graph every few updates
      if (Math.random() > 0.5) {
        addGraphPoint(multiplier);
      }
      
      // Check if game should crash
      if (multiplier >= crashPoint) {
        gameCrash();
      }
    }
    
    // Handle game crash
    function gameCrash() {
      // End the game
      clearInterval(gameInterval);
      isPlaying = false;
      
      // Update UI
      crushResult.textContent = 'Crashed! Better luck next time!';
      crushResult.classList.add('lose');
      multiplierDisplay.classList.add('crashed');
      
      startBtn.disabled = false;
      cashoutBtn.disabled = true;
      
      // Add final crash point to graph
      addGraphPoint(multiplier);
      
      // Process loss with server if player hasn't cashed out
      window.casinoApp.processGameResult(
        'crush',
        0, // No additional bet
        'lose',
        0,
        {
          crashPoint: multiplier,
          finalMultiplier: multiplier
        }
      );
      
      // Reset multiplier display style after a delay
      setTimeout(() => {
        multiplierDisplay.classList.remove('crashed');
      }, 1500);
    }
    
    // Cashout
    async function cashout() {
      if (!isPlaying) return;
      
      // End the game
      clearInterval(gameInterval);
      isPlaying = false;
      
      // Calculate win amount
      const winAmount = Math.floor(betAmount * multiplier);
      
      // Update UI
      crushResult.textContent = `Cashed out at ${multiplier.toFixed(2)}x! You won ${winAmount} Stars! 🎉`;
      crushResult.classList.add('win');
      multiplierDisplay.classList.add('cashed-out');
      
      startBtn.disabled = false;
      cashoutBtn.disabled = true;
      
      // Process win with server
      await window.casinoApp.processGameResult(
        'crush',
        0, // No additional bet
        'win',
        winAmount,
        {
          cashoutMultiplier: multiplier,
          crashPoint: crashPoint
        }
      );
      
      // Continue animating until crash for visual effect
      let continueInterval = setInterval(() => {
        // Increase multiplier
        const growth = 0.01 * (1 + (multiplier - 1) / 10);
        multiplier += growth;
        
        // Update display (but not the player's multiplier)
        multiplierDisplay.textContent = multiplier.toFixed(2);
        
        // Add point to graph
        if (Math.random() > 0.5) {
          addGraphPoint(multiplier);
        }
        
        // Check if animation should end
        if (multiplier >= crashPoint) {
          clearInterval(continueInterval);
          multiplierDisplay.classList.remove('cashed-out');
          
          // Add final crash point to graph
          addGraphPoint(multiplier);
        }
      }, 100);
    }
    
    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
    
    // Return public methods
    return {
      init,
      startGame,
      cashout
    };
  })();