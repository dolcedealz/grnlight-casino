// loader.js - Add this file to your public/js directory

(function() {
  console.log('Loader script initialized');
  
  // Create loading overlay
  const createLoadingOverlay = () => {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    
    // Create spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    // Create loading text
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Loading Greenlight Casino...';
    
    // Append elements
    overlay.appendChild(spinner);
    overlay.appendChild(loadingText);
    document.body.appendChild(overlay);
    
    console.log('Loading overlay created');
    return overlay;
  };
  
  // Remove loading overlay
  const removeLoadingOverlay = () => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        console.log('Loading overlay removed');
      }, 500);
    }
  };
  
  // Create the loading overlay
  const overlay = createLoadingOverlay();
  
  // Set multiple fallback mechanisms to ensure loading screen is removed
  
  // Fallback 1: Remove after maximum time (15 seconds)
  const maxLoadingTimeout = setTimeout(() => {
    console.log('Maximum loading time reached, forcing removal');
    removeLoadingOverlay();
    initializeEmergencyUI();
  }, 15000);
  
  // Fallback 2: Remove after load event with a reasonable delay
  window.addEventListener('load', () => {
    console.log('Window load event fired');
    setTimeout(() => {
      clearTimeout(maxLoadingTimeout);
      removeLoadingOverlay();
    }, 1000);
  });
  
  // Fallback 3: Try to detect DOM content loaded and then check app state
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded event fired');
    
    // Set a timer to check if app has initialized properly
    setTimeout(() => {
      const appContainer = document.querySelector('.app-container');
      const anyScreenVisible = document.querySelector('.screen.active');
      
      // If no screen is active after 5 seconds, we might have a problem
      if (appContainer && !anyScreenVisible) {
        console.log('No active screen detected after DOM loaded - attempting recovery');
        
        try {
          // Try to show the welcome screen
          const welcomeScreen = document.getElementById('welcome-screen');
          if (welcomeScreen) {
            document.querySelectorAll('.screen').forEach(screen => {
              screen.classList.remove('active');
            });
            welcomeScreen.classList.add('active');
          }
          
          // Remove loading overlay
          clearTimeout(maxLoadingTimeout);
          removeLoadingOverlay();
        } catch (error) {
          console.error('Recovery attempt failed:', error);
        }
      }
    }, 5000);
  });
  
  // Emergency UI initialization in case of main UI failure
  function initializeEmergencyUI() {
    console.log('Initializing emergency UI');
    
    try {
      // Show welcome screen
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen) {
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        welcomeScreen.classList.add('active');
      }
      
      // Initialize minimal version of game card handlers
      const gameCards = document.querySelectorAll('.game-card');
      gameCards.forEach(card => {
        card.onclick = function() {
          const game = this.getAttribute('data-game');
          if (!game) return;
          
          const targetScreen = document.getElementById(`${game}-screen`);
          if (!targetScreen) return;
          
          document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
          });
          
          targetScreen.classList.add('active');
        };
      });
      
      // Setup back buttons
      const backButtons = document.querySelectorAll('.back-btn');
      backButtons.forEach(button => {
        button.onclick = function() {
          document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
          });
          
          const welcomeScreen = document.getElementById('welcome-screen');
          if (welcomeScreen) {
            welcomeScreen.classList.add('active');
          }
        };
      });
      
      console.log('Emergency UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize emergency UI:', error);
      
      // Last resort - show error message to user
      const errorMessage = document.createElement('div');
      errorMessage.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); 
                   display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10000;">
          <h2 style="color: white; margin-bottom: 20px;">Unable to load Greenlight Casino</h2>
          <p style="color: white; margin-bottom: 20px;">Please try refreshing the page.</p>
          <button onclick="window.location.reload()" 
                  style="background: #00A86B; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      `;
      document.body.appendChild(errorMessage);
    }
  }
})();