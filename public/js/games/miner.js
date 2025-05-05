/**
 * miner.js - Enhanced version of the Miner game
 * Version 3.2.0
 * 
 * Improvements:
 * - Enhanced visual design with animations and effects
 * - Added sound effects and background music
 * - Improved coefficient system with balanced formulas
 * - Added particle effects for explosions
 * - Implemented progressive multiplier growth
 */

// Predefined audio files to preload
const AUDIO_FILES = {
    background: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    click: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
    reveal: 'https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3',
    explosion: 'https://assets.mixkit.co/sfx/preview/mixkit-explosion-with-rocks-fall-down-1699.mp3',
    win: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
    cashout: 'https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3',
    perfectWin: 'https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3'
};

// Prevent conflicts and ensure isolated environment
(function() {
    // Check for GreenLightApp object
    if (!window.GreenLightApp) {
        console.error('[Miner] GreenLightApp not initialized!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Miner', 'Initializing enhanced Miner game module v3.2.0');
    
    // Game logic in closure for isolation
    const minerGame = (function() {
        // Game elements
        let elements = {
            newGameBtn: null,
            cashoutBtn: null,
            minerBet: null,
            minesCount: null,
            minerGrid: null,
            potentialWin: null,
            minerResult: null,
            container: null,
            multiplierDisplay: null,
            safeCountDisplay: null,
            infoPanel: null,
            soundToggle: null,
            musicToggle: null,
            volumeControl: null
        };
        
        // Audio elements
        let audio = {
            background: null,
            click: null,
            reveal: null,
            explosion: null,
            win: null,
            cashout: null,
            perfectWin: null,
            initialized: false,
            muted: false,
            musicMuted: false,
            volume: 0.5
        };
        
        // Private mine data storage (encrypted)
        let _minesData = null;
        
        // Data encryption function
        const encodeData = function(data) {
            // Simple encryption to obfuscate data
            return btoa(JSON.stringify(data).split('').map(c => 
                String.fromCharCode(c.charCodeAt(0) + 7)
            ).join(''));
        };
        
        // Data decryption function
        const decodeData = function(encoded) {
            try {
                return JSON.parse(atob(encoded).split('').map(c => 
                    String.fromCharCode(c.charCodeAt(0) - 7)
                ).join(''));
            } catch (e) {
                return [];
            }
        };
        
        // Game state
        let state = {
            isPlaying: false,
            initialized: false,
            initializationStarted: false,
            animationsEnabled: true,
            gameData: {
                grid: [],
                revealedCells: [],
                totalCells: 25,  // 5x5 grid
                minesCount: 3,
                currentMultiplier: 1,
                betAmount: 0,
                baseMultiplier: 1.0,
                maxMultiplier: 1000, // Maximum multiplier for balance
                houseEdge: 0.05, // 5% house edge for fair gameplay
                explosionAnimationActive: false
            }
        };
        
        // Multiplier configuration for different mine counts
        const MULTIPLIER_CONFIG = {
            1: { base: 1.05, growth: 0.15, maxBonus: 1.5 },
            3: { base: 1.15, growth: 0.25, maxBonus: 2.0 },
            5: { base: 1.30, growth: 0.35, maxBonus: 2.5 },
            10: { base: 1.60, growth: 0.50, maxBonus: 3.0 },
            15: { base: 2.10, growth: 0.75, maxBonus: 4.0 },
            20: { base: 3.50, growth: 1.20, maxBonus: 6.0 },
            24: { base: 30.0, growth: 6.00, maxBonus: 15.0 }
        };
        
        /**
         * Initialize audio system
         */
        const initAudio = function() {
            if (audio.initialized) return;
            
            try {
                // Create audio container
                const audioContainer = document.createElement('div');
                audioContainer.id = 'miner-audio-container';
                audioContainer.style.display = 'none';
                document.body.appendChild(audioContainer);
                
                // Initialize all audio elements
                for (const [key, url] of Object.entries(AUDIO_FILES)) {
                    const audioElement = document.createElement('audio');
                    audioElement.src = url;
                    audioElement.preload = 'auto';
                    
                    if (key === 'background') {
                        audioElement.loop = true;
                        audioElement.volume = 0.3; // Lower volume for background music
                    } else {
                        audioElement.volume = 0.5;
                    }
                    
                    audioContainer.appendChild(audioElement);
                    audio[key] = audioElement;
                }
                
                audio.initialized = true;
                app.log('Miner', 'Audio system initialized successfully');
                
            } catch (error) {
                app.log('Miner', `Error initializing audio: ${error.message}`, true);
            }
        };
        
        /**
         * Play sound effect
         */
        const playSound = function(sound) {
            if (!audio.initialized || audio.muted || !audio[sound]) return;
            
            try {
                // Stop the sound if it's already playing
                audio[sound].pause();
                audio[sound].currentTime = 0;
                
                // Set volume and play
                audio[sound].volume = audio.volume;
                audio[sound].play().catch(e => {
                    // Silently catch autoplay errors
                    app.log('Miner', `Autoplay prevented for ${sound}: ${e.message}`);
                });
            } catch (error) {
                app.log('Miner', `Error playing sound ${sound}: ${error.message}`, true);
            }
        };
        
        /**
         * Toggle background music
         */
        const toggleMusic = function() {
            if (!audio.initialized) return;
            
            try {
                audio.musicMuted = !audio.musicMuted;
                
                if (audio.musicMuted) {
                    audio.background.pause();
                    
                    // Update music toggle button
                    if (elements.musicToggle) {
                        elements.musicToggle.innerHTML = '🔇';
                        elements.musicToggle.classList.add('muted');
                    }
                } else {
                    audio.background.play().catch(e => {
                        // Silently catch autoplay errors
                        app.log('Miner', `Autoplay prevented for background music: ${e.message}`);
                    });
                    
                    // Update music toggle button
                    if (elements.musicToggle) {
                        elements.musicToggle.innerHTML = '🔊';
                        elements.musicToggle.classList.remove('muted');
                    }
                }
                
                app.log('Miner', `Background music ${audio.musicMuted ? 'muted' : 'enabled'}`);
            } catch (error) {
                app.log('Miner', `Error toggling music: ${error.message}`, true);
            }
        };
        
        /**
         * Toggle sound effects
         */
        const toggleSound = function() {
            try {
                audio.muted = !audio.muted;
                
                // Update sound toggle button
                if (elements.soundToggle) {
                    elements.soundToggle.innerHTML = audio.muted ? '🔇' : '🔊';
                    if (audio.muted) {
                        elements.soundToggle.classList.add('muted');
                    } else {
                        elements.soundToggle.classList.remove('muted');
                    }
                }
                
                app.log('Miner', `Sound effects ${audio.muted ? 'muted' : 'enabled'}`);
            } catch (error) {
                app.log('Miner', `Error toggling sound: ${error.message}`, true);
            }
        };
        
        /**
         * Set audio volume
         */
        const setVolume = function(value) {
            try {
                audio.volume = Math.max(0, Math.min(1, value));
                
                // Update all audio elements
                for (const [key, element] of Object.entries(audio)) {
                    if (element && typeof element === 'object' && element.volume !== undefined) {
                        if (key === 'background') {
                            element.volume = audio.volume * 0.3; // Keep background music quieter
                        } else {
                            element.volume = audio.volume;
                        }
                    }
                }
                
                app.log('Miner', `Audio volume set to ${audio.volume}`);
            } catch (error) {
                app.log('Miner', `Error setting volume: ${error.message}`, true);
            }
        };
        
        /**
         * Create particle effect
         */
        const createParticleEffect = function(x, y, type) {
            try {
                // Create particles container if it doesn't exist
                let particlesContainer = document.getElementById('particles-container');
                if (!particlesContainer) {
                    particlesContainer = document.createElement('div');
                    particlesContainer.id = 'particles-container';
                    particlesContainer.style.position = 'fixed';
                    particlesContainer.style.top = '0';
                    particlesContainer.style.left = '0';
                    particlesContainer.style.width = '100%';
                    particlesContainer.style.height = '100%';
                    particlesContainer.style.pointerEvents = 'none';
                    particlesContainer.style.zIndex = '9999';
                    document.body.appendChild(particlesContainer);
                }
                
                // Define particle settings based on type
                let particleCount, particleColors, particleSize, particleSpeed, particleLife;
                
                switch(type) {
                    case 'explosion':
                        particleCount = 50;
                        particleColors = ['#FF5252', '#FF9800', '#FFEB3B', '#FFC107', '#FF7043'];
                        particleSize = { min: 5, max: 15 };
                        particleSpeed = { min: 3, max: 10 };
                        particleLife = { min: 500, max: 1000 };
                        break;
                    case 'coins':
                        particleCount = 30;
                        particleColors = ['#FFD700', '#FFC107', '#FFEB3B', '#F9A825', '#FBC02D'];
                        particleSize = { min: 8, max: 15 };
                        particleSpeed = { min: 2, max: 8 };
                        particleLife = { min: 800, max: 1500 };
                        break;
                    case 'confetti':
                        particleCount = 100;
                        particleColors = ['#4CAF50', '#2196F3', '#9C27B0', '#E91E63', '#FFEB3B', '#FF9800'];
                        particleSize = { min: 5, max: 10 };
                        particleSpeed = { min: 2, max: 6 };
                        particleLife = { min: 1000, max: 2000 };
                        break;
                    default:
                        particleCount = 20;
                        particleColors = ['#FFFFFF', '#EEEEEE', '#DDDDDD'];
                        particleSize = { min: 3, max: 8 };
                        particleSpeed = { min: 1, max: 5 };
                        particleLife = { min: 500, max: 1000 };
                }
                
                // Create particles
                for (let i = 0; i < particleCount; i++) {
                    setTimeout(() => {
                        const particle = document.createElement('div');
                        
                        // Random particle properties
                        const color = particleColors[Math.floor(Math.random() * particleColors.length)];
                        const size = Math.random() * (particleSize.max - particleSize.min) + particleSize.min;
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * (particleSpeed.max - particleSpeed.min) + particleSpeed.min;
                        const life = Math.random() * (particleLife.max - particleLife.min) + particleLife.min;
                        
                        // Set particle styles
                        particle.style.position = 'absolute';
                        particle.style.left = `${x}px`;
                        particle.style.top = `${y}px`;
                        particle.style.width = `${size}px`;
                        particle.style.height = `${size}px`;
                        particle.style.borderRadius = type === 'confetti' ? '2px' : '50%';
                        particle.style.backgroundColor = color;
                        particle.style.opacity = '1';
                        particle.style.pointerEvents = 'none';
                        
                        // Give some particles a custom shape for variety
                        if (type === 'confetti' && Math.random() > 0.5) {
                            particle.style.width = `${size / 2}px`;
                            particle.style.height = `${size * 2}px`;
                            particle.style.transform = `rotate(${Math.random() * 360}deg)`;
                        }
                        
                        particlesContainer.appendChild(particle);
                        
                        // Calculate velocity
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        
                        // Animation variables
                        let posX = x;
                        let posY = y;
                        let opacity = 1;
                        let startTime = Date.now();
                        
                        // Animate particle
                        const animateParticle = function() {
                            const elapsed = Date.now() - startTime;
                            if (elapsed >= life) {
                                if (particle.parentNode) {
                                    particle.parentNode.removeChild(particle);
                                }
                                return;
                            }
                            
                            // Update position with gravity effect
                            posX += vx;
                            posY += vy + (elapsed / life) * 5; // Add gravity effect
                            
                            // Fade out
                            opacity = 1 - (elapsed / life);
                            
                            // Update styles
                            particle.style.left = `${posX}px`;
                            particle.style.top = `${posY}px`;
                            particle.style.opacity = opacity.toString();
                            
                            // Continue animation
                            requestAnimationFrame(animateParticle);
                        };
                        
                        // Start animation
                        requestAnimationFrame(animateParticle);
                    }, Math.random() * 200); // Stagger particle creation
                }
            } catch (error) {
                app.log('Miner', `Error creating particle effect: ${error.message}`, true);
            }
        };
        
        /**
         * Create screen shake effect
         */
        const screenShake = function(intensity = 5, duration = 500) {
            if (!state.animationsEnabled) return;
            
            try {
                const minerScreen = document.getElementById('miner-screen');
                if (!minerScreen) return;
                
                // Save original transform
                const originalTransform = minerScreen.style.transform || '';
                
                // Animation variables
                let startTime = Date.now();
                
                // Animation function
                const shake = function() {
                    const elapsed = Date.now() - startTime;
                    if (elapsed >= duration) {
                        minerScreen.style.transform = originalTransform;
                        return;
                    }
                    
                    // Calculate intensity based on remaining time
                    const remaining = 1 - (elapsed / duration);
                    const currentIntensity = intensity * remaining;
                    
                    // Generate random offset
                    const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
                    const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
                    
                    // Apply transform
                    minerScreen.style.transform = `${originalTransform} translate(${offsetX}px, ${offsetY}px)`;
                    
                    // Continue animation
                    requestAnimationFrame(shake);
                };
                
                // Start animation
                requestAnimationFrame(shake);
            } catch (error) {
                app.log('Miner', `Error creating screen shake: ${error.message}`, true);
            }
        };
        
        /**
         * Create main game container
         */
        const createGameContainer = function() {
            try {
                // Check if container already exists
                let container = document.querySelector('.miner-container');
                if (container) {
                    elements.container = container;
                    return container;
                }
                
                // Find game screen
                const minerScreen = document.getElementById('miner-screen');
                if (!minerScreen) {
                    app.log('Miner', 'Game screen not found', true);
                    return null;
                }
                
                // Create container for the game
                container = document.createElement('div');
                container.className = 'miner-container game-container';
                minerScreen.appendChild(container);
                
                elements.container = container;
                app.log('Miner', 'Main game container created');
                
                return container;
            } catch (error) {
                app.log('Miner', `Error creating container: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Create game interface
         */
        const createGameInterface = function() {
            try {
                const container = elements.container || createGameContainer();
                if (!container) {
                    app.log('Miner', 'Cannot create interface: container not found', true);
                    return false;
                }
                
                // Check if interface already exists
                if (container.querySelector('#miner-grid')) {
                    app.log('Miner', 'Interface already created');
                    return true;
                }
                
                // Create HTML markup for the game
                container.innerHTML = `
                    <div class="miner-header">
                        <div class="game-info-panel">
                            <div class="info-item">
                                <span class="info-label">Multiplier</span>
                                <span id="current-multiplier" class="info-value multiplier-value">1.00x</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Safe Cells</span>
                                <span id="safe-count" class="info-value">0/25</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Potential Win</span>
                                <span id="potential-win" class="info-value win-value">0 ⭐</span>
                            </div>
                        </div>
                        <div class="sound-controls">
                            <button id="sound-toggle" class="sound-btn" title="Toggle Sound Effects">🔊</button>
                            <button id="music-toggle" class="sound-btn" title="Toggle Music">🔊</button>
                        </div>
                    </div>
                    
                    <div id="miner-grid" class="miner-grid">
                        <!-- Grid will be created dynamically -->
                    </div>
                    
                    <div id="miner-result" class="result hidden"></div>
                    
                    <div class="miner-controls">
                        <div class="bet-settings">
                            <div class="control-group">
                                <label for="miner-bet">Bet:</label>
                                <input type="number" id="miner-bet" min="1" max="1000" value="10" class="bet-input">
                            </div>
                            
                            <div class="control-group">
                                <label for="mines-count">Mines:</label>
                                <select id="mines-count" class="mines-select">
                                    <option value="1">1 mine</option>
                                    <option value="3" selected>3 mines</option>
                                    <option value="5">5 mines</option>
                                    <option value="10">10 mines</option>
                                    <option value="15">15 mines</option>
                                    <option value="20">20 mines</option>
                                    <option value="24">24 mines</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="game-buttons">
                            <button id="new-game-btn" class="action-btn primary-btn">NEW GAME</button>
                            <button id="cashout-btn" class="action-btn secondary-btn" disabled>CASH OUT</button>
                        </div>
                    </div>
                `;
                
                // Create styles if they don't exist
                if (!document.getElementById('miner-styles')) {
                    const styleElement = document.createElement('style');
                    styleElement.id = 'miner-styles';
                    styleElement.textContent = `
                        .miner-container {
                            padding: 20px;
                            max-width: 600px;
                            margin: 0 auto;
                            font-family: 'Arial', sans-serif;
                            border-radius: 16px;
                            background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                            border: 1px solid rgba(255, 255, 255, 0.05);
                            overflow: hidden;
                        }
                        
                        .miner-header {
                            margin-bottom: 20px;
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 12px;
                            padding: 15px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                        }
                        
                        .game-info-panel {
                            display: flex;
                            justify-content: space-around;
                            align-items: center;
                            flex: 1;
                        }
                        
                        .sound-controls {
                            display: flex;
                            gap: 10px;
                        }
                        
                        .sound-btn {
                            background: rgba(255, 255, 255, 0.1);
                            border: none;
                            border-radius: 50%;
                            width: 32px;
                            height: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            transition: all 0.2s;
                            color: white;
                            font-size: 16px;
                        }
                        
                        .sound-btn:hover {
                            background: rgba(255, 255, 255, 0.2);
                            transform: scale(1.1);
                        }
                        
                        .sound-btn.muted {
                            background: rgba(255, 0, 0, 0.2);
                            color: rgba(255, 255, 255, 0.7);
                        }
                        
                        .info-item {
                            text-align: center;
                            background: rgba(0, 0, 0, 0.2);
                            padding: 8px 12px;
                            border-radius: 8px;
                            min-width: 120px;
                        }
                        
                        .info-label {
                            display: block;
                            font-size: 12px;
                            color: rgba(255, 255, 255, 0.7);
                            margin-bottom: 5px;
                            text-transform: uppercase;
                            font-weight: bold;
                            letter-spacing: 1px;
                        }
                        
                        .info-value {
                            font-size: 18px;
                            font-weight: bold;
                            color: white;
                            display: block;
                        }
                        
                        .multiplier-value {
                            color: #4CAF50;
                            text-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
                            transition: all 0.3s;
                        }
                        
                        .win-value {
                            color: #FFD700;
                            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                        }
                        
                        .miner-grid {
                            display: grid;
                            grid-template-columns: repeat(5, 1fr);
                            gap: 8px;
                            margin: 20px auto;
                            max-width: 400px;
                            perspective: 1000px;
                        }
                        
                        .grid-cell {
                            aspect-ratio: 1;
                            background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            cursor: pointer;
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            position: relative;
                            transform-style: preserve-3d;
                            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                            overflow: hidden;
                        }
                        
                        .grid-cell:hover {
                            transform: translateY(-2px) scale(1.05);
                            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4), 0 0 10px rgba(76, 175, 80, 0.3);
                            border-color: rgba(76, 175, 80, 0.3);
                        }
                        
                        .grid-cell.active-cell {
                            cursor: pointer;
                        }
                        
                        .grid-cell.active-cell:hover {
                            background: linear-gradient(135deg, #3a3a3a, #2a2a2a);
                        }
                        
                        .grid-cell.revealed {
                            background: linear-gradient(135deg, #4CAF50, #43A047);
                            transform: rotateY(180deg);
                            cursor: default;
                            border-color: #66BB6A;
                            box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
                        }
                        
                        .grid-cell.mine {
                            background: linear-gradient(135deg, #333, #222);
                            cursor: default;
                        }
                        
                        .grid-cell.exploded {
                            background: linear-gradient(135deg, #F44336, #D32F2F);
                            animation: explode 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97);
                            border-color: #E57373;
                            box-shadow: 0 0 20px rgba(244, 67, 54, 0.7);
                            z-index: 10;
                        }
                        
                        .miner-controls {
                            margin-top: 20px;
                        }
                        
                        .bet-settings {
                            display: flex;
                            gap: 20px;
                            margin-bottom: 15px;
                            justify-content: center;
                        }
                        
                        .control-group {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .control-group label {
                            color: rgba(255, 255, 255, 0.8);
                            font-size: 14px;
                            font-weight: bold;
                        }
                        
                        .bet-input, .mines-select {
                            padding: 8px 12px;
                            border-radius: 6px;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            background: rgba(0, 0, 0, 0.2);
                            color: white;
                            font-size: 14px;
                            font-weight: bold;
                            transition: all 0.2s;
                        }
                        
                        .bet-input:focus, .mines-select:focus {
                            border-color: rgba(76, 175, 80, 0.5);
                            outline: none;
                            box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
                        }
                        
                        .mines-select:disabled {
                            opacity: 0.5;
                            cursor: not-allowed;
                        }
                        
                        .game-buttons {
                            display: flex;
                            gap: 15px;
                            justify-content: center;
                        }
                        
                        .action-btn {
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-weight: bold;
                            font-size: 16px;
                            cursor: pointer;
                            transition: all 0.2s;
                            border: none;
                            min-width: 140px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            position: relative;
                            overflow: hidden;
                        }
                        
                        .action-btn::after {
                            content: '';
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            width: 5px;
                            height: 5px;
                            background: rgba(255, 255, 255, 0.5);
                            opacity: 0;
                            border-radius: 100%;
                            transform: scale(1, 1) translate(-50%, -50%);
                            transform-origin: 50% 50%;
                        }
                        
                        .action-btn:focus:not(:active)::after {
                            animation: ripple 1s ease-out;
                        }
                        
                        .primary-btn {
                            background: linear-gradient(135deg, #4CAF50, #43A047);
                            color: white;
                            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                        }
                        
                        .primary-btn:hover:not(:disabled) {
                            transform: translateY(-2px);
                            box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
                        }
                        
                        .secondary-btn {
                            background: linear-gradient(135deg, #2196F3, #1E88E5);
                            color: white;
                            box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3);
                        }
                        
                        .secondary-btn:hover:not(:disabled) {
                            transform: translateY(-2px);
                            box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
                        }
                        
                        .action-btn:disabled {
                            background: linear-gradient(135deg, #555, #444);
                            cursor: not-allowed;
                            opacity: 0.7;
                            box-shadow: none;
                        }
                        
                        .result {
                            margin: 20px 0;
                            padding: 20px;
                            border-radius: 12px;
                            text-align: center;
                            font-weight: bold;
                            transition: all 0.3s;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                            transform: translateY(0);
                            opacity: 1;
                        }
                        
                        .result.hidden {
                            opacity: 0;
                            transform: translateY(-20px);
                            height: 0;
                            padding: 0;
                            margin: 0;
                            overflow: hidden;
                        }
                        
                        .result.win {
                            background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(67, 160, 71, 0.2));
                            border: 1px solid rgba(76, 175, 80, 0.5);
                            color: #81C784;
                        }
                        
                        .result.lose {
                            background: linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(211, 47, 47, 0.2));
                            border: 1px solid rgba(244, 67, 54, 0.5);
                            color: #E57373;
                        }
                        
                        .win-icon, .lose-icon {
                            font-size: 36px;
                            margin-bottom: 10px;
                            display: inline-block;
                            animation: bounce 1s infinite alternate;
                        }
                        
                        .win-title, .lose-title {
                            font-size: 20px;
                            margin-bottom: 10px;
                        }
                        
                        .win-amount {
                            font-size: 24px;
                            color: #FFD700;
                            margin: 10px 0;
                            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                        }
                        
                        .win-multiplier {
                            font-size: 16px;
                            color: #81C784;
                            margin-top: 5px;
                        }
                        
                        .cell-inner {
                            width: 100%;
                            height: 100%;
                            position: relative;
                            transform-style: preserve-3d;
                            transition: transform 0.6s;
                        }
                        
                        .cell-back, .cell-front {
                            width: 100%;
                            height: 100%;
                            position: absolute;
                            backface-visibility: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 8px;
                        }
                        
                        .cell-front {
                            transform: rotateY(180deg);
                        }
                        
                        .revealed .cell-inner {
                            transform: rotateY(180deg);
                        }
                        
                        /* Enhanced animations */
                        @keyframes explode {
                            0% { transform: scale3d(1, 1, 1); }
                            10%, 20% { transform: scale3d(0.9, 0.9, 0.9) rotate3d(0, 0, 1, -5deg); }
                            30%, 50%, 70%, 90% { transform: scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 5deg); }
                            40%, 60%, 80% { transform: scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -5deg); }
                            100% { transform: scale3d(1, 1, 1); }
                        }
                        
                        @keyframes pulse {
                            0% { transform: scale(1); box-shadow: 0 0 5px rgba(76, 175, 80, 0.5); }
                            50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(76, 175, 80, 0.8); }
                            100% { transform: scale(1); box-shadow: 0 0 5px rgba(76, 175, 80, 0.5); }
                        }
                        
                        @keyframes bounce {
                            from { transform: translateY(0); }
                            to { transform: translateY(-10px); }
                        }
                        
                        @keyframes ripple {
                            0% {
                                transform: scale(0, 0);
                                opacity: 1;
                            }
                            20% {
                                transform: scale(25, 25);
                                opacity: 1;
                            }
                            100% {
                                opacity: 0;
                                transform: scale(40, 40);
                            }
                        }
                        
                        .pulse {
                            animation: pulse 1.5s infinite;
                        }
                        
                        /* Progressive multiplier colors */
                        .multiplier-value.level-1 { color: #4CAF50; text-shadow: 0 0 10px rgba(76, 175, 80, 0.5); }
                        .multiplier-value.level-2 { color: #8BC34A; text-shadow: 0 0 10px rgba(139, 195, 74, 0.5); }
                        .multiplier-value.level-3 { color: #CDDC39; text-shadow: 0 0 10px rgba(205, 220, 57, 0.5); }
                        .multiplier-value.level-4 { color: #FFEB3B; text-shadow: 0 0 10px rgba(255, 235, 59, 0.5); }
                        .multiplier-value.level-5 { color: #FFC107; text-shadow: 0 0 10px rgba(255, 193, 7, 0.5); }
                        .multiplier-value.level-6 { color: #FF9800; text-shadow: 0 0 10px rgba(255, 152, 0, 0.5); }
                        .multiplier-value.level-7 { color: #FF5722; text-shadow: 0 0 10px rgba(255, 87, 34, 0.7); }
                        
                        /* Responsive design */
                        @media (max-width: 600px) {
                            .miner-header {
                                flex-direction: column;
                                gap: 15px;
                            }
                            
                            .game-info-panel {
                                flex-wrap: wrap;
                                gap: 10px;
                            }
                            
                            .bet-settings {
                                flex-direction: column;
                                align-items: center;
                            }
                            
                            .info-item {
                                min-width: 100px;
                            }
                        }
                    `;
                    document.head.appendChild(styleElement);
                }
                
                app.log('Miner', 'Game interface successfully created');
                return true;
            } catch (error) {
                app.log('Miner', `Error creating interface: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Initialize the game
         * With protection against repeated initialization and timeout
         */
        const init = async function() {
            // Prevent repeated initialization
            if (state.initialized || state.initializationStarted) {
                app.log('Miner', 'Initialization already complete or in progress');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Miner', 'Starting game initialization');
            
            try {
                // Set timeout for initialization
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // First create interface
                        if (!createGameInterface()) {
                            app.log('Miner', 'Failed to create game interface', true);
                            resolve(false);
                            return;
                        }
                        
                        // Initialize audio system
                        initAudio();
                        
                        // Then get DOM elements
                        await findDOMElements();
                        
                        // Create game grid
                        createGrid();
                        
                        // Update potential win
                        updatePotentialWin();
                        
                        // Add event listeners
                        setupEventListeners();
                        
                        state.initialized = true;
                        app.log('Miner', 'Initialization successfully completed');
                        resolve(true);
                    } catch (innerError) {
                        app.log('Miner', `Error during initialization process: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                // Set timeout (3 seconds)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Miner', 'Initialization timeout', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Use Promise.race to prevent hanging
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('Miner', `Critical initialization error: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Find DOM elements with null protection
         */
        const findDOMElements = async function() {
            // Use Promise for asynchronicity
            return new Promise((resolve, reject) => {
                try {
                    // Timeout for waiting for DOM readiness
                    setTimeout(() => {
                        elements.newGameBtn = document.getElementById('new-game-btn');
                        elements.cashoutBtn = document.getElementById('cashout-btn');
                        elements.minerBet = document.getElementById('miner-bet');
                        elements.minesCount = document.getElementById('mines-count');
                        elements.minerGrid = document.getElementById('miner-grid');
                        elements.potentialWin = document.getElementById('potential-win');
                        elements.minerResult = document.getElementById('miner-result');
                        elements.multiplierDisplay = document.getElementById('current-multiplier');
                        elements.safeCountDisplay = document.getElementById('safe-count');
                        elements.soundToggle = document.getElementById('sound-toggle');
                        elements.musicToggle = document.getElementById('music-toggle');
                        
                        // Check critical elements and report on them
                        if (!elements.newGameBtn) {
                            app.log('Miner', 'Warning: element new-game-btn not found', true);
                        } else {
                            app.log('Miner', 'Element new-game-btn found successfully');
                        }
                        
                        if (!elements.minerGrid) {
                            app.log('Miner', 'Warning: element miner-grid not found', true);
                        } else {
                            app.log('Miner', 'Element miner-grid found successfully');
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('Miner', `Error finding DOM elements: ${error.message}`, true);
                    reject(error);
                }
            });
        };
        
        /**
         * Setup event listeners
         */
        const setupEventListeners = function() {
            try {
                // New game button
                if (elements.newGameBtn) {
                    // Clear current handlers (prevent duplication)
                    const newGameBtn = elements.newGameBtn.cloneNode(true);
                    if (elements.newGameBtn.parentNode) {
                        elements.newGameBtn.parentNode.replaceChild(newGameBtn, elements.newGameBtn);
                    }
                    elements.newGameBtn = newGameBtn;
                    
                    // Add handler
                    elements.newGameBtn.addEventListener('click', startNewGame);
                    app.log('Miner', 'Handler for new game button set');
                } else {
                    app.log('Miner', 'Cannot set handler: new game button not found', true);
                }
                
                // Cashout button
                if (elements.cashoutBtn) {
                    const cashoutBtn = elements.cashoutBtn.cloneNode(true);
                    if (elements.cashoutBtn.parentNode) {
                        elements.cashoutBtn.parentNode.replaceChild(cashoutBtn, elements.cashoutBtn);
                    }
                    elements.cashoutBtn = cashoutBtn;
                    
                    elements.cashoutBtn.addEventListener('click', cashout);
                    app.log('Miner', 'Handler for cashout button set');
                }
                
                // Mine count selection
                if (elements.minesCount) {
                    elements.minesCount.addEventListener('change', updateMineCount);
                    app.log('Miner', 'Handler for mine count selection set');
                }
                
                // Bet change
                if (elements.minerBet) {
                    elements.minerBet.addEventListener('input', updatePotentialWin);
                    app.log('Miner', 'Handler for bet change set');
                }
                
                // Sound toggle
                if (elements.soundToggle) {
                    elements.soundToggle.addEventListener('click', toggleSound);
                    app.log('Miner', 'Handler for sound toggle set');
                }
                
                // Music toggle
                if (elements.musicToggle) {
                    elements.musicToggle.addEventListener('click', toggleMusic);
                    app.log('Miner', 'Handler for music toggle set');
                }
                
                app.log('Miner', 'Event handlers set');
            } catch (error) {
                app.log('Miner', `Error setting handlers: ${error.message}`, true);
            }
        };
        
        /**
         * Create game grid
         */
        const createGrid = function() {
            try {
                if (!elements.minerGrid) {
                    app.log('Miner', 'Cannot create grid: element minerGrid not found', true);
                    return;
                }
                
                // Clear current grid
                elements.minerGrid.innerHTML = '';
                
                // Create 5x5 grid
                for (let i = 0; i < 5; i++) {
                    for (let j = 0; j < 5; j++) {
                        const cell = document.createElement('div');
                        cell.className = 'grid-cell';
                        cell.dataset.row = i;
                        cell.dataset.col = j;
                        cell.dataset.index = i * 5 + j;
                        
                        // Create inner cell structure
                        const cellInner = document.createElement('div');
                        cellInner.className = 'cell-inner';
                        
                        const cellBack = document.createElement('div');
                        cellBack.className = 'cell-back';
                        
                        const cellFront = document.createElement('div');
                        cellFront.className = 'cell-front';
                        
                        cellInner.appendChild(cellBack);
                        cellInner.appendChild(cellFront);
                        cell.appendChild(cellInner);
                        
                        // Add handler only if game is active
                        if (state.isPlaying) {
                            cell.addEventListener('click', () => revealCell(i * 5 + j));
                            cell.classList.add('active-cell');
                        }
                        
                        elements.minerGrid.appendChild(cell);
                    }
                }
                
                app.log('Miner', 'Game grid successfully created');
            } catch (error) {
                app.log('Miner', `Error creating grid: ${error.message}`, true);
            }
        };
        
        /**
         * Update mine count
         */
        const updateMineCount = function() {
            try {
                // If game has already started, don't allow changing mine count
                if (state.isPlaying) {
                    // Return to previous value
                    if (elements.minesCount) {
                        elements.minesCount.value = state.gameData.minesCount;
                    }
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Cannot change mine count during game');
                    }
                    return;
                }
                
                if (!elements.minesCount) {
                    app.log('Miner', 'Element minesCount not found', true);
                    return;
                }
                
                state.gameData.minesCount = parseInt(elements.minesCount.value);
                
                // Update config based on selected mine count
                const config = MULTIPLIER_CONFIG[state.gameData.minesCount] || MULTIPLIER_CONFIG[3];
                state.gameData.baseMultiplier = config.base;
                
                // Update display
                updatePotentialWin();
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                // Play sound
                playSound('click');
                
                app.log('Miner', `Mine count updated: ${state.gameData.minesCount}`);
            } catch (error) {
                app.log('Miner', `Error updating mine count: ${error.message}`, true);
            }
        };
        
        /**
         * Calculate win multiplier
         * Using probabilistic formula for fair calculation
         */
        const calculateMultiplier = function(revealed, total, mines) {
            if (revealed === 0) return state.gameData.baseMultiplier;
            
            try {
                const safeSpots = total - mines;
                let probability = 1;
                
                // Calculate probability of safe choice for each move
                for (let i = 0; i < revealed; i++) {
                    probability *= (safeSpots - i) / (total - i);
                }
                
                // Apply house edge (5%)
                probability = probability * (1 - state.gameData.houseEdge);
                
                // Multiplier = 1 / probability (with adjustment for balance)
                let multiplier = 1 / probability;
                
                // Apply configuration for game balance
                const config = MULTIPLIER_CONFIG[mines] || MULTIPLIER_CONFIG[3];
                
                // Progressive multiplier growth
                const progressFactor = Math.min(1, revealed / safeSpots * 2);
                const bonusMult = config.maxBonus * progressFactor;
                
                multiplier = config.base + (multiplier - 1) * config.growth * (1 + bonusMult);
                
                // Limit maximum multiplier
                multiplier = Math.min(multiplier, state.gameData.maxMultiplier);
                
                // Round to 2 decimal places
                return Math.floor(multiplier * 100) / 100;
            } catch (error) {
                app.log('Miner', `Error calculating multiplier: ${error.message}`, true);
                return state.gameData.baseMultiplier;
            }
        };
        
        /**
         * Update potential win display
         */
        const updatePotentialWin = function() {
            try {
                if (!elements.potentialWin || !elements.minerBet) {
                    return;
                }
                
                const betAmt = parseInt(elements.minerBet.value) || 0;
                const revealedCount = state.gameData.revealedCells.length;
                
                // Calculate multiplier
                const multiplier = calculateMultiplier(
                    revealedCount,
                    state.gameData.totalCells,
                    state.gameData.minesCount
                );
                
                // Calculate potential win
                const potential = Math.floor(betAmt * multiplier);
                
                // Update display
                elements.potentialWin.textContent = `${potential} ⭐`;
                
                if (elements.multiplierDisplay) {
                    elements.multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
                    
                    // Remove all level classes
                    elements.multiplierDisplay.className = 'info-value multiplier-value';
                    
                    // Add visual effects for multiplier levels
                    if (multiplier >= 50) {
                        elements.multiplierDisplay.classList.add('level-7', 'pulse');
                    } else if (multiplier >= 20) {
                        elements.multiplierDisplay.classList.add('level-6', 'pulse');
                    } else if (multiplier >= 10) {
                        elements.multiplierDisplay.classList.add('level-5', 'pulse');
                    } else if (multiplier >= 5) {
                        elements.multiplierDisplay.classList.add('level-4');
                    } else if (multiplier >= 3) {
                        elements.multiplierDisplay.classList.add('level-3');
                    } else if (multiplier >= 2) {
                        elements.multiplierDisplay.classList.add('level-2');
                    } else {
                        elements.multiplierDisplay.classList.add('level-1');
                    }
                }
                
                if (elements.safeCountDisplay) {
                    const safeCells = state.gameData.totalCells - state.gameData.minesCount;
                    elements.safeCountDisplay.textContent = `${revealedCount}/${safeCells}`;
                }
                
                // Update game data
                state.gameData.currentMultiplier = multiplier;
                
                app.log('Miner', `Potential win updated: ${potential}, multiplier: ${multiplier}`);
            } catch (error) {
                app.log('Miner', `Error updating potential win: ${error.message}`, true);
            }
        };
        
        /**
         * Start new game
         */
        const startNewGame = async function() {
            app.log('Miner', 'Starting new game');
            
            // Check initialization
            if (!state.initialized) {
                app.log('Miner', 'Game not initialized, starting initialization', true);
                await init();
                
                // If initialization failed, exit
                if (!state.initialized) {
                    app.log('Miner', 'Failed to start game: initialization error', true);
                    return;
                }
            }
            
            try {
                // Check for casinoApp
                if (!window.casinoApp) {
                    app.log('Miner', 'casinoApp not found', true);
                    alert('Application initialization error');
                    return;
                }
                
                // Check for elements
                if (!elements.minerBet) {
                    app.log('Miner', 'Bet element not found', true);
                    return;
                }
                
                // Get bet amount
                const betAmount = parseInt(elements.minerBet.value);
                
                // Check bet
                if (isNaN(betAmount) || betAmount <= 0) {
                    window.casinoApp.showNotification('Please enter a valid bet');
                    return;
                }
                
                // Check if enough funds
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Insufficient funds for this bet');
                    return;
                }
                
                // Reset game state
                state.isPlaying = true;
                state.gameData = {
                    grid: Array(state.gameData.totalCells).fill('empty'),
                    revealedCells: [],
                    totalCells: 25,
                    minesCount: parseInt(elements.minesCount ? elements.minesCount.value : 3),
                    currentMultiplier: calculateMultiplier(0, 25, parseInt(elements.minesCount.value)),
                    betAmount: betAmount,
                    maxMultiplier: 1000,
                    houseEdge: 0.05
                };
                
                // Clear previous mine data
                _minesData = null;
                
                // Place mines
                placeMines();
                
                // Update interface
                createGrid();
                
                // Lock mine count selection
                if (elements.minesCount) {
                    elements.minesCount.disabled = true;
                }
                
                // Update buttons
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true; // Disable until at least one cell is opened
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = true;
                }
                
                // Hide result
                if (elements.minerResult) {
                    elements.minerResult.className = 'result hidden';
                    elements.minerResult.textContent = '';
                }
                
                // Start background music if not muted
                if (audio.initialized && !audio.musicMuted) {
                    audio.background.currentTime = 0;
                    audio.background.play().catch(e => {
                        app.log('Miner', `Autoplay prevented for background music: ${e.message}`);
                    });
                }
                
                // Play game start sound
                playSound('click');
                
                // Tactile feedback
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Process initial bet
                await window.casinoApp.processGameResult(
                    'miner',
                    betAmount,
                    'bet',
                    0,
                    { 
                        minesCount: state.gameData.minesCount
                    }
                );
                
                // Update potential win display
                updatePotentialWin();
                
                app.log('Miner', 'New game successfully started');
            } catch (error) {
                app.log('Miner', `Error starting new game: ${error.message}`, true);
                state.isPlaying = false;
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = false;
                }
                
                if (elements.minesCount) {
                    elements.minesCount.disabled = false;
                }
            }
        };
        
        /**
         * Place mines (without logging positions to console)
         */
        const placeMines = function() {
            try {
                // Create new array for mines
                const mines = [];
                
                // Place new mines
                while (mines.length < state.gameData.minesCount) {
                    const randomIndex = Math.floor(Math.random() * state.gameData.totalCells);
                    
                    // Add only if not already a mine
                    if (!mines.includes(randomIndex)) {
                        mines.push(randomIndex);
                        state.gameData.grid[randomIndex] = 'mine';
                    }
                }
                
                // Encrypt mine positions
                _minesData = encodeData(mines);
                
                // DO NOT log mine positions to console for security
                app.log('Miner', 'Mines placed');
            } catch (error) {
                app.log('Miner', `Error placing mines: ${error.message}`, true);
            }
        };
        
        /**
         * Check if cell is a mine
         * Uses encrypted data
         */
        const isMine = function(index) {
            if (!_minesData) return false;
            
            try {
                const mines = decodeData(_minesData);
                return mines.includes(index);
            } catch (error) {
                app.log('Miner', `Error checking mine: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Reveal cell
         */
        const revealCell = async function(index) {
            try {
                // Check if cell already opened
                if (state.gameData.revealedCells.includes(index)) {
                    return;
                }
                
                // Check if game is active
                if (!state.isPlaying) {
                    return;
                }
                
                // Get cell element
                const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                if (!cell) {
                    app.log('Miner', `Cell with index ${index} not found`, true);
                    return;
                }
                
                // Play click sound
                playSound('click');
                
                // Tactile feedback
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                // Check if cell is a mine (using encrypted data)
                if (isMine(index)) {
                    // Game over - mine found
                    revealAllMines();
                    
                    // Get cell position for explosion effect
                    const cellRect = cell.getBoundingClientRect();
                    const explosionX = cellRect.left + cellRect.width / 2;
                    const explosionY = cellRect.top + cellRect.height / 2;
                    
                    // Play explosion sound
                    playSound('explosion');
                    
                    // Create explosion particle effect
                    createParticleEffect(explosionX, explosionY, 'explosion');
                    
                    // Screen shake effect
                    screenShake(8, 800);
                    
                    // Update interface
                    cell.classList.add('mine', 'exploded');
                    const cellFront = cell.querySelector('.cell-front');
                    if (cellFront) {
                        cellFront.innerHTML = '💥';
                    } else {
                        cell.innerHTML = '💥';
                    }
                    
                    // Vibration for explosion
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('error');
                    }
                    
                    // Set game state
                    state.isPlaying = false;
                    
                    if (elements.cashoutBtn) {
                        elements.cashoutBtn.disabled = true;
                    }
                    
                    if (elements.newGameBtn) {
                        elements.newGameBtn.disabled = false;
                    }
                    
                    if (elements.minesCount) {
                        elements.minesCount.disabled = false;
                    }
                    
                    // Show result
                    if (elements.minerResult) {
                        elements.minerResult.textContent = 'BOOM! You hit a mine. Game over!';
                        elements.minerResult.className = 'result lose';
                    }
                    
                    // Process loss (DO NOT send mine positions to server)
                    if (window.casinoApp) {
                        await window.casinoApp.processGameResult(
                            'miner',
                            0, // No additional bet
                            'lose',
                            0,
                            {
                                revealedCells: state.gameData.revealedCells,
                                hitMine: index,
                                finalMultiplier: state.gameData.currentMultiplier,
                                minesCount: state.gameData.minesCount
                            }
                        );
                    }
                    
                    // Stop background music
                    if (audio.initialized && audio.background) {
                        const fadeOutInterval = setInterval(() => {
                            if (audio.background.volume > 0.05) {
                                audio.background.volume -= 0.05;
                            } else {
                                audio.background.pause();
                                clearInterval(fadeOutInterval);
                            }
                        }, 100);
                    }
                } else {
                    // Safe cell
                    state.gameData.revealedCells.push(index);
                    
                    // Update interface with animation
                    cell.classList.add('revealed');
                    const cellFront = cell.querySelector('.cell-front');
                    if (cellFront) {
                        cellFront.innerHTML = '💰';
                    } else {
                        cell.innerHTML = '💰';
                    }
                    
                    // Play reveal sound
                    playSound('reveal');
                    
                    // Small particles for safe cell
                    const cellRect = cell.getBoundingClientRect();
                    const cellX = cellRect.left + cellRect.width / 2;
                    const cellY = cellRect.top + cellRect.height / 2;
                    createParticleEffect(cellX, cellY, 'coins');
                    
                    // Enable cashout button after first opened cell
                    if (state.gameData.revealedCells.length === 1 && elements.cashoutBtn) {
                        elements.cashoutBtn.disabled = false;
                    }
                    
                    // Update multiplier and potential win
                    updatePotentialWin();
                    
                    // Tactile feedback for safe cell
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('success');
                    }
                    
                    // Check if all safe cells are open (win condition)
                    if (state.gameData.revealedCells.length === state.gameData.totalCells - state.gameData.minesCount) {
                        // Player opened all safe cells
                        await automaticCashout();
                    }
                }
            } catch (error) {
                app.log('Miner', `Error revealing cell: ${error.message}`, true);
            }
        };
        
        /**
         * Reveal all mines
         */
        const revealAllMines = function() {
            try {
                if (!_minesData) return;
                
                const mines = decodeData(_minesData);
                
                mines.forEach(index => {
                    // Skip the exploded mine
                    if (document.querySelector(`.grid-cell[data-index="${index}"].exploded`)) {
                        return;
                    }
                    
                    const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                    if (cell && !cell.classList.contains('exploded')) {
                        cell.classList.add('mine');
                        const cellFront = cell.querySelector('.cell-front');
                        if (cellFront) {
                            cellFront.innerHTML = '💣';
                        } else {
                            cell.innerHTML = '💣';
                        }
                        
                        // Small delay for each mine
                        const delay = Math.random() * 300;
                        setTimeout(() => {
                            cell.classList.add('mine-reveal');
                        }, delay);
                    }
                });
            } catch (error) {
                app.log('Miner', `Error revealing all mines: ${error.message}`, true);
            }
        };
        
        /**
         * Cash out
         */
        const cashout = async function() {
            try {
                // Check game state
                if (!state.isPlaying || state.gameData.revealedCells.length === 0) {
                    return;
                }
                
                // Check for casinoApp
                if (!window.casinoApp) {
                    return;
                }
                
                // Calculate win
                const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
                
                // Play cashout sound
                playSound('cashout');
                
                // Create confetti particle effect
                const containerRect = elements.container.getBoundingClientRect();
                const centerX = containerRect.left + containerRect.width / 2;
                const centerY = containerRect.top + containerRect.height / 2;
                createParticleEffect(centerX, centerY, 'confetti');
                
                // Tactile feedback
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                }
                
                // Update interface
                if (elements.minerResult) {
                    elements.minerResult.innerHTML = `
                        <div class="win-icon">🎉</div>
                        <div class="win-title">You won ${winAmount} Stars!</div>
                        <div class="win-multiplier">Multiplier: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                    `;
                    elements.minerResult.className = 'result win';
                }
                
                // Reset game state
                state.isPlaying = false;
                
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true;
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = false;
                }
                
                if (elements.minesCount) {
                    elements.minesCount.disabled = false;
                }
                
                // Show all mines
                revealAllMines();
                
                // Process win (DO NOT send mine positions to server)
                await window.casinoApp.processGameResult(
                    'miner',
                    0, // No additional bet
                    'win',
                    winAmount,
                    {
                        revealedCells: state.gameData.revealedCells,
                        multiplier: state.gameData.currentMultiplier,
                        minesCount: state.gameData.minesCount
                    }
                );
                
                // Fade out background music
                if (audio.initialized && audio.background) {
                    const fadeOutInterval = setInterval(() => {
                        if (audio.background.volume > 0.05) {
                            audio.background.volume -= 0.05;
                        } else {
                            audio.background.pause();
                            clearInterval(fadeOutInterval);
                        }
                    }, 100);
                }
                
                app.log('Miner', `Successful cashout: ${winAmount} with multiplier ${state.gameData.currentMultiplier.toFixed(2)}`);
            } catch (error) {
                app.log('Miner', `Error cashing out: ${error.message}`, true);
            }
        };
        
        /**
         * Automatic cashout when all safe cells are opened
         */
        const automaticCashout = async function() {
            try {
                // Check game state
                if (!state.isPlaying) {
                    return;
                }
                
                // Check for casinoApp
                if (!window.casinoApp) {
                    return;
                }
                
                // Calculate win
                const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
                
                // Play perfect win sound
                playSound('perfectWin');
                
                // Create big confetti particle effect
                const containerRect = elements.container.getBoundingClientRect();
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const centerX = containerRect.left + Math.random() * containerRect.width;
                        const centerY = containerRect.top + Math.random() * containerRect.height;
                        createParticleEffect(centerX, centerY, 'confetti');
                    }, i * 300);
                }
                
                // Tactile feedback - big win
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                    setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
                }
                
                // Update interface
                if (elements.minerResult) {
                    elements.minerResult.innerHTML = `
                        <div class="win-icon">🏆</div>
                        <div class="win-title">Perfect! You revealed all safe cells!</div>
                        <div class="win-amount">${winAmount} ⭐</div>
                        <div class="win-multiplier">Multiplier: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                    `;
                    elements.minerResult.className = 'result win big-win';
                }
                
                // Reset game state
                state.isPlaying = false;
                
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true;
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = false;
                }
                
                if (elements.minesCount) {
                    elements.minesCount.disabled = false;
                }
                
                // Show all mines
                revealAllMines();
                
                // Process win
                await window.casinoApp.processGameResult(
                    'miner',
                    0, // No additional bet
                    'win',
                    winAmount,
                    {
                        revealedCells: state.gameData.revealedCells,
                        multiplier: state.gameData.currentMultiplier,
                        minesCount: state.gameData.minesCount,
                        perfectGame: true
                    }
                );
                
                // Fade out background music
                if (audio.initialized && audio.background) {
                    const fadeOutInterval = setInterval(() => {
                        if (audio.background.volume > 0.05) {
                            audio.background.volume -= 0.05;
                        } else {
                            audio.background.pause();
                            clearInterval(fadeOutInterval);
                        }
                    }, 100);
                }
                
                app.log('Miner', `Perfect game completed with win ${winAmount}`);
            } catch (error) {
                app.log('Miner', `Error with automatic cashout: ${error.message}`, true);
            }
        };
        
        // Return public interface
        return {
            // Main methods
            init: init,
            startNewGame: startNewGame,
            cashout: cashout,
            
            // Sound controls
            toggleSound: toggleSound,
            toggleMusic: toggleMusic,
            setVolume: setVolume,
            
            // Animation controls
            createParticleEffect: createParticleEffect,
            screenShake: screenShake,
            
            // Method for checking state
            getStatus: function() {
                return {
                    initialized: state.initialized,
                    initializationStarted: state.initializationStarted,
                    isPlaying: state.isPlaying,
                    elementsFound: {
                        newGameBtn: !!elements.newGameBtn,
                        cashoutBtn: !!elements.cashoutBtn,
                        minerBet: !!elements.minerBet,
                        minerGrid: !!elements.minerGrid
                    },
                    audio: {
                        initialized: audio.initialized,
                        muted: audio.muted,
                        musicMuted: audio.musicMuted
                    },
                    gameState: {
                        minesCount: state.gameData.minesCount,
                        revealedCells: state.gameData.revealedCells.length,
                        currentMultiplier: state.gameData.currentMultiplier
                    }
                };
            }
        };
    })();
    
    // Register game in all formats for maximum compatibility
    try {
        // 1. Registration using new system
        if (window.registerGame) {
            window.registerGame('minerGame', minerGame);
            app.log('Miner', 'Game registered through new registerGame system');
        }
        
        // 2. Export to global namespace (backward compatibility)
        window.minerGame = minerGame;
        app.log('Miner', 'Game exported to global namespace');
        
        // 3. Log completion of module loading
        app.log('Miner', 'Module successfully loaded and ready for initialization');
        
        // 4. Automatic initialization when page loads
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                    app.log('Miner', 'Starting automatic initialization');
                    minerGame.init();
                }
            }, 500);
        });
        
        // 5. If DOM already loaded, initialize immediately
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                    app.log('Miner', 'Starting automatic initialization (DOM already loaded)');
                    minerGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Miner', `Error registering game: ${error.message}`, true);
    }
})();