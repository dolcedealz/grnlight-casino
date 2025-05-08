/**
 * miner.js - Компактная версия игры Майнер
 * Версия 3.3.0
 * 
 * Улучшения:
 * - Оптимизированный и компактный интерфейс
 * - Полная русификация элементов
 * - Улучшенная производительность
 * - Адаптивный дизайн для мобильных устройств
 * - Оптимизированные анимации
 */

// Предопределенные аудио файлы для предзагрузки
const AUDIO_FILES = {
    background: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    click: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
    reveal: 'https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3',
    explosion: 'https://assets.mixkit.co/sfx/preview/mixkit-explosion-with-rocks-fall-down-1699.mp3',
    win: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
    cashout: 'https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3',
    perfectWin: 'https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3'
};

// Предотвращаем конфликты и обеспечиваем изолированную среду
(function() {
    // Проверка наличия основного объекта приложения
    if (!window.GreenLightApp) {
        console.error('[Майнер] GreenLightApp не инициализирован!');
        window.GreenLightApp = {
            log: function(source, message, isError) {
                if (isError) console.error(`[${source}] ${message}`);
                else console.log(`[${source}] ${message}`);
            }
        };
    }
    
    const app = window.GreenLightApp;
    app.log('Майнер', 'Инициализация компактной версии игры Майнер v3.3.0');
    
    // Игровая логика в замыкании для изоляции
    const minerGame = (function() {
        // Элементы игры
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
        
        // Аудио элементы
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
        
        // Приватное хранилище данных мин (зашифрованное)
        let _minesData = null;
        
        // Состояние игры
        let state = {
            isPlaying: false,
            initialized: false,
            initializationStarted: false,
            animationsEnabled: true,
            gameData: {
                grid: [],
                revealedCells: [],
                totalCells: 25,  // Сетка 5x5
                minesCount: 3,
                currentMultiplier: 1,
                betAmount: 0,
                baseMultiplier: 1.0,
                maxMultiplier: 1000, // Максимальный множитель для баланса
                houseEdge: 0.05, // 5% преимущество казино для честной игры
                explosionAnimationActive: false
            }
        };
        
        // Конфигурация множителей для разного количества мин
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
         * Инициализация аудио системы
         */
        const initAudio = function() {
            if (audio.initialized) return;
            
            try {
                // Создаем контейнер для аудио
                const audioContainer = document.createElement('div');
                audioContainer.id = 'miner-audio-container';
                audioContainer.style.display = 'none';
                document.body.appendChild(audioContainer);
                
                // Инициализируем все аудио элементы
                for (const [key, url] of Object.entries(AUDIO_FILES)) {
                    const audioElement = document.createElement('audio');
                    audioElement.src = url;
                    audioElement.preload = 'auto';
                    
                    if (key === 'background') {
                        audioElement.loop = true;
                        audioElement.volume = 0.3; // Пониженная громкость для фоновой музыки
                    } else {
                        audioElement.volume = 0.5;
                    }
                    
                    audioContainer.appendChild(audioElement);
                    audio[key] = audioElement;
                }
                
                audio.initialized = true;
                app.log('Майнер', 'Аудио система успешно инициализирована');
                
            } catch (error) {
                app.log('Майнер', `Ошибка инициализации аудио: ${error.message}`, true);
            }
        };
        
        /**
         * Воспроизведение звукового эффекта
         */
        const playSound = function(sound) {
            if (!audio.initialized || audio.muted || !audio[sound]) return;
            
            try {
                // Останавливаем звук, если он уже воспроизводится
                audio[sound].pause();
                audio[sound].currentTime = 0;
                
                // Устанавливаем громкость и воспроизводим
                audio[sound].volume = audio.volume;
                audio[sound].play().catch(e => {
                    // Тихо ловим ошибки автовоспроизведения
                    app.log('Майнер', `Автовоспроизведение звука ${sound} предотвращено: ${e.message}`);
                });
            } catch (error) {
                app.log('Майнер', `Ошибка воспроизведения звука ${sound}: ${error.message}`, true);
            }
        };
        
        /**
         * Переключение фоновой музыки
         */
        const toggleMusic = function() {
            if (!audio.initialized) return;
            
            try {
                audio.musicMuted = !audio.musicMuted;
                
                if (audio.musicMuted) {
                    audio.background.pause();
                    
                    // Обновляем кнопку переключения музыки
                    if (elements.musicToggle) {
                        elements.musicToggle.innerHTML = '🔇';
                        elements.musicToggle.classList.add('muted');
                    }
                } else {
                    audio.background.play().catch(e => {
                        // Тихо ловим ошибки автовоспроизведения
                        app.log('Майнер', `Автовоспроизведение фоновой музыки предотвращено: ${e.message}`);
                    });
                    
                    // Обновляем кнопку переключения музыки
                    if (elements.musicToggle) {
                        elements.musicToggle.innerHTML = '🔊';
                        elements.musicToggle.classList.remove('muted');
                    }
                }
                
                app.log('Майнер', `Фоновая музыка ${audio.musicMuted ? 'отключена' : 'включена'}`);
            } catch (error) {
                app.log('Майнер', `Ошибка переключения музыки: ${error.message}`, true);
            }
        };
        
        /**
         * Переключение звуковых эффектов
         */
        const toggleSound = function() {
            try {
                audio.muted = !audio.muted;
                
                // Обновляем кнопку переключения звука
                if (elements.soundToggle) {
                    elements.soundToggle.innerHTML = audio.muted ? '🔇' : '🔊';
                    if (audio.muted) {
                        elements.soundToggle.classList.add('muted');
                    } else {
                        elements.soundToggle.classList.remove('muted');
                    }
                }
                
                app.log('Майнер', `Звуковые эффекты ${audio.muted ? 'отключены' : 'включены'}`);
            } catch (error) {
                app.log('Майнер', `Ошибка переключения звука: ${error.message}`, true);
            }
        };
        
        /**
         * Установка громкости аудио
         */
        const setVolume = function(value) {
            try {
                audio.volume = Math.max(0, Math.min(1, value));
                
                // Обновляем все аудио элементы
                for (const [key, element] of Object.entries(audio)) {
                    if (element && typeof element === 'object' && element.volume !== undefined) {
                        if (key === 'background') {
                            element.volume = audio.volume * 0.3; // Держим фоновую музыку тише
                        } else {
                            element.volume = audio.volume;
                        }
                    }
                }
                
                app.log('Майнер', `Громкость аудио установлена на ${audio.volume}`);
            } catch (error) {
                app.log('Майнер', `Ошибка установки громкости: ${error.message}`, true);
            }
        };
        
        /**
         * Создание эффекта частиц
         */
        const createParticleEffect = function(x, y, type) {
            try {
                // Создаем контейнер для частиц, если его нет
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
                
                // Настраиваем параметры частиц в зависимости от типа
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
                
                // Создаем частицы
                for (let i = 0; i < particleCount; i++) {
                    setTimeout(() => {
                        const particle = document.createElement('div');
                        
                        // Случайные свойства частиц
                        const color = particleColors[Math.floor(Math.random() * particleColors.length)];
                        const size = Math.random() * (particleSize.max - particleSize.min) + particleSize.min;
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * (particleSpeed.max - particleSpeed.min) + particleSpeed.min;
                        const life = Math.random() * (particleLife.max - particleLife.min) + particleLife.min;
                        
                        // Устанавливаем стили частиц
                        particle.style.position = 'absolute';
                        particle.style.left = `${x}px`;
                        particle.style.top = `${y}px`;
                        particle.style.width = `${size}px`;
                        particle.style.height = `${size}px`;
                        particle.style.borderRadius = type === 'confetti' ? '2px' : '50%';
                        particle.style.backgroundColor = color;
                        particle.style.opacity = '1';
                        particle.style.pointerEvents = 'none';
                        
                        // Даем некоторым частицам пользовательскую форму для разнообразия
                        if (type === 'confetti' && Math.random() > 0.5) {
                            particle.style.width = `${size / 2}px`;
                            particle.style.height = `${size * 2}px`;
                            particle.style.transform = `rotate(${Math.random() * 360}deg)`;
                        }
                        
                        particlesContainer.appendChild(particle);
                        
                        // Рассчитываем скорость
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        
                        // Переменные анимации
                        let posX = x;
                        let posY = y;
                        let opacity = 1;
                        let startTime = Date.now();
                        
                        // Анимируем частицу
                        const animateParticle = function() {
                            const elapsed = Date.now() - startTime;
                            if (elapsed >= life) {
                                if (particle.parentNode) {
                                    particle.parentNode.removeChild(particle);
                                }
                                return;
                            }
                            
                            // Обновляем позицию с эффектом гравитации
                            posX += vx;
                            posY += vy + (elapsed / life) * 5; // Добавляем эффект гравитации
                            
                            // Затухание
                            opacity = 1 - (elapsed / life);
                            
                            // Обновляем стили
                            particle.style.left = `${posX}px`;
                            particle.style.top = `${posY}px`;
                            particle.style.opacity = opacity.toString();
                            
                            // Продолжаем анимацию
                            requestAnimationFrame(animateParticle);
                        };
                        
                        // Запускаем анимацию
                        requestAnimationFrame(animateParticle);
                    }, Math.random() * 200); // Создаем частицы с задержкой
                }
            } catch (error) {
                app.log('Майнер', `Ошибка создания эффекта частиц: ${error.message}`, true);
            }
        };
        
        /**
         * Создание эффекта тряски экрана
         */
        const screenShake = function(intensity = 5, duration = 500) {
            if (!state.animationsEnabled) return;
            
            try {
                const minerScreen = document.getElementById('miner-screen');
                if (!minerScreen) return;
                
                // Сохраняем исходное значение transform
                const originalTransform = minerScreen.style.transform || '';
                
                // Переменные анимации
                let startTime = Date.now();
                
                // Функция анимации
                const shake = function() {
                    const elapsed = Date.now() - startTime;
                    if (elapsed >= duration) {
                        minerScreen.style.transform = originalTransform;
                        return;
                    }
                    
                    // Вычисляем интенсивность на основе оставшегося времени
                    const remaining = 1 - (elapsed / duration);
                    const currentIntensity = intensity * remaining;
                    
                    // Генерируем случайное смещение
                    const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
                    const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
                    
                    // Применяем трансформацию
                    minerScreen.style.transform = `${originalTransform} translate(${offsetX}px, ${offsetY}px)`;
                    
                    // Продолжаем анимацию
                    requestAnimationFrame(shake);
                };
                
                // Запускаем анимацию
                requestAnimationFrame(shake);
            } catch (error) {
                app.log('Майнер', `Ошибка создания тряски экрана: ${error.message}`, true);
            }
        };
        
        /**
         * Создание основного контейнера игры
         */
        const createGameContainer = function() {
            try {
                // Проверяем существование контейнера
                let container = document.querySelector('.miner-container');
                if (container) {
                    elements.container = container;
                    return container;
                }
                
                // Ищем игровой экран
                const minerScreen = document.getElementById('miner-screen');
                if (!minerScreen) {
                    app.log('Майнер', 'Игровой экран не найден', true);
                    return null;
                }
                
                // Создаем контейнер для игры
                container = document.createElement('div');
                container.className = 'miner-container game-container';
                minerScreen.appendChild(container);
                
                elements.container = container;
                app.log('Майнер', 'Основной контейнер игры создан');
                
                return container;
            } catch (error) {
                app.log('Майнер', `Ошибка создания контейнера: ${error.message}`, true);
                return null;
            }
        };
        
        /**
         * Создание игрового интерфейса
         */
        const createGameInterface = function() {
            try {
                const container = elements.container || createGameContainer();
                if (!container) {
                    app.log('Майнер', 'Невозможно создать интерфейс: контейнер не найден', true);
                    return false;
                }
                
                // Проверяем, существует ли уже интерфейс
                if (container.querySelector('#miner-grid')) {
                    app.log('Майнер', 'Интерфейс уже создан');
                    return true;
                }
                
                // Создаем HTML-разметку для игры
                container.innerHTML = `
                    <div class="miner-header">
                        <div class="game-info-panel">
                            <div class="info-item">
                                <span class="info-label">Множитель</span>
                                <span id="current-multiplier" class="info-value multiplier-value">1.00x</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Безопасных</span>
                                <span id="safe-count" class="info-value">0/25</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Выигрыш</span>
                                <span id="potential-win" class="info-value win-value">0 ⭐</span>
                            </div>
                        </div>
                        <div class="sound-controls">
                            <button id="sound-toggle" class="sound-btn" title="Звук">🔊</button>
                            <button id="music-toggle" class="sound-btn" title="Музыка">🔊</button>
                        </div>
                    </div>
                    
                    <div id="miner-grid" class="miner-grid">
                        <!-- Сетка будет создана динамически -->
                    </div>
                    
                    <div id="miner-result" class="result hidden"></div>
                    
                    <div class="miner-controls">
                        <div class="bet-settings">
                            <div class="control-group">
                                <label for="miner-bet">Ставка:</label>
                                <div class="bet-input-wrapper">
                                    <button class="bet-decrease-btn" aria-label="Уменьшить ставку">-</button>
                                    <input type="number" id="miner-bet" inputmode="numeric" min="1" max="1000" value="10" class="bet-input">
                                    <button class="bet-increase-btn" aria-label="Увеличить ставку">+</button>
                                </div>
                            </div>
                            
                            <div class="control-group">
                                <label for="mines-count">Мины:</label>
                                <select id="mines-count" class="mines-select">
                                    <option value="1">1 мина</option>
                                    <option value="3" selected>3 мины</option>
                                    <option value="5">5 мин</option>
                                    <option value="10">10 мин</option>
                                    <option value="15">15 мин</option>
                                    <option value="20">20 мин</option>
                                    <option value="24">24 мины</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="quick-bet-controls">
                            <button class="quick-bet-btn" data-amount="10">10</button>
                            <button class="quick-bet-btn" data-amount="20">20</button>
                            <button class="quick-bet-btn" data-amount="50">50</button>
                            <button class="quick-bet-btn" data-amount="100">100</button>
                        </div>
                        
                        <div class="game-buttons">
                            <button id="new-game-btn" class="action-btn primary-btn">НАЧАТЬ</button>
                            <button id="cashout-btn" class="action-btn secondary-btn" disabled>ЗАБРАТЬ</button>
                        </div>
                    </div>
                `;
                
                // Создаем стили, если их еще нет
                if (!document.getElementById('miner-styles')) {
                    const styleElement = document.createElement('style');
                    styleElement.id = 'miner-styles';
                    styleElement.textContent = `
                        .miner-container {
                            padding: 15px;
                            max-width: 500px;
                            margin: 0 auto;
                            font-family: 'Arial', sans-serif;
                            border-radius: 16px;
                            background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                            border: 1px solid rgba(255, 255, 255, 0.05);
                            overflow: hidden;
                        }
                        
                        .miner-header {
                            margin-bottom: 15px;
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 12px;
                            padding: 10px;
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
                            gap: 8px;
                        }
                        
                        .sound-controls {
                            display: flex;
                            gap: 8px;
                        }
                        
                        .sound-btn {
                            background: rgba(255, 255, 255, 0.1);
                            border: none;
                            border-radius: 50%;
                            width: 28px;
                            height: 28px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            transition: all 0.2s;
                            color: white;
                            font-size: 14px;
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
                            padding: 6px 10px;
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 8px;
                            text-align: center;
                            flex: 1;
                            min-width: 0;
                        }
                        
                        .info-label {
                            display: block;
                            font-size: 10px;
                            color: rgba(255, 255, 255, 0.7);
                            margin-bottom: 3px;
                            text-transform: uppercase;
                            font-weight: bold;
                            letter-spacing: 0.5px;
                        }
                        
                        .info-value {
                            font-size: 16px;
                            font-weight: bold;
                            color: white;
                            display: block;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
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
                            gap: 6px;
                            margin: 10px auto;
                            max-width: 400px;
                            perspective: 1000px;
                        }
                        
                        .grid-cell {
                            aspect-ratio: 1;
                            background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            cursor: pointer;
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            position: relative;
                            transform-style: preserve-3d;
                            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
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
                            margin-top: 15px;
                        }
                        
                        .bet-settings {
                            display: flex;
                            gap: 10px;
                            margin-bottom: 10px;
                            justify-content: center;
                            flex-wrap: wrap;
                        }
                        
                        .control-group {
                            display: flex;
                            flex-direction: column;
                            gap: 5px;
                        }
                        
                        .control-group label {
                            color: rgba(255, 255, 255, 0.8);
                            font-size: 12px;
                            font-weight: bold;
                            margin-bottom: 2px;
                        }
                        
                        .bet-input-wrapper {
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        }
                        
                        .bet-decrease-btn, .bet-increase-btn {
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            border: none;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            cursor: pointer;
                            background: var(--medium-gray, #444);
                            color: var(--white, #fff);
                            font-size: 14px;
                            font-weight: bold;
                            transition: all 0.2s;
                        }
                        
                        .bet-decrease-btn:hover, .bet-increase-btn:hover {
                            background: var(--primary-green, #4CAF50);
                            transform: scale(1.1);
                        }
                        
                        .bet-input, .mines-select {
                            padding: 6px 8px;
                            border-radius: 6px;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            background: rgba(0, 0, 0, 0.2);
                            color: white;
                            font-size: 14px;
                            font-weight: bold;
                            transition: all 0.2s;
                            width: 70px;
                            text-align: center;
                        }
                        
                        .mines-select {
                            width: 100px;
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
                        
                        .quick-bet-controls {
                            display: flex;
                            justify-content: center;
                            gap: 8px;
                            margin-bottom: 10px;
                            flex-wrap: wrap;
                        }
                        
                        .quick-bet-btn {
                            padding: 5px 10px;
                            background: rgba(0, 0, 0, 0.2);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 4px;
                            color: #fff;
                            font-size: 13px;
                            cursor: pointer;
                            transition: all 0.2s;
                        }
                        
                        .quick-bet-btn:hover {
                            background: rgba(76, 175, 80, 0.2);
                            border-color: rgba(76, 175, 80, 0.5);
                        }
                        
                        .game-buttons {
                            display: flex;
                            gap: 10px;
                            justify-content: center;
                        }
                        
                        .action-btn {
                            padding: 10px 0;
                            border-radius: 8px;
                            font-weight: bold;
                            font-size: 14px;
                            cursor: pointer;
                            transition: all 0.2s;
                            border: none;
                            min-width: 120px;
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
                            margin: 15px 0;
                            padding: 15px;
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
                            font-size: 32px;
                            margin-bottom: 10px;
                            display: inline-block;
                            animation: bounce 1s infinite alternate;
                        }
                        
                        .win-title, .lose-title {
                            font-size: 18px;
                            margin-bottom: 8px;
                        }
                        
                        .win-amount {
                            font-size: 22px;
                            color: #FFD700;
                            margin: 8px 0;
                            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                        }
                        
                        .win-multiplier {
                            font-size: 14px;
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
                            border-radius: 6px;
                        }
                        
                        .cell-front {
                            transform: rotateY(180deg);
                        }
                        
                        .revealed .cell-inner {
                            transform: rotateY(180deg);
                        }
                        
                        /* Улучшенные анимации */
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
                        
                        /* Цвета для прогрессивных множителей */
                        .multiplier-value.level-1 { color: #4CAF50; text-shadow: 0 0 10px rgba(76, 175, 80, 0.5); }
                        .multiplier-value.level-2 { color: #8BC34A; text-shadow: 0 0 10px rgba(139, 195, 74, 0.5); }
                        .multiplier-value.level-3 { color: #CDDC39; text-shadow: 0 0 10px rgba(205, 220, 57, 0.5); }
                        .multiplier-value.level-4 { color: #FFEB3B; text-shadow: 0 0 10px rgba(255, 235, 59, 0.5); }
                        .multiplier-value.level-5 { color: #FFC107; text-shadow: 0 0 10px rgba(255, 193, 7, 0.5); }
                        .multiplier-value.level-6 { color: #FF9800; text-shadow: 0 0 10px rgba(255, 152, 0, 0.5); }
                        .multiplier-value.level-7 { color: #FF5722; text-shadow: 0 0 10px rgba(255, 87, 34, 0.7); }
                        
                        /* Адаптивный дизайн */
                        @media (max-width: 480px) {
                            .miner-container {
                                padding: 10px;
                                border-radius: 10px;
                            }
                            
                            .miner-header {
                                padding: 8px;
                                margin-bottom: 10px;
                            }
                            
                            .info-item {
                                padding: 5px;
                            }
                            
                            .info-label {
                                font-size: 9px;
                                margin-bottom: 2px;
                            }
                            
                            .info-value {
                                font-size: 14px;
                            }
                            
                            .sound-btn {
                                width: 24px;
                                height: 24px;
                                font-size: 12px;
                            }
                            
                            .miner-grid {
                                gap: 4px;
                            }
                            
                            .grid-cell {
                                font-size: 20px;
                                border-radius: 5px;
                            }
                            
                            .bet-settings {
                                gap: 6px;
                            }
                            
                            .control-group label {
                                font-size: 11px;
                            }
                            
                            .bet-input, .mines-select {
                                padding: 5px;
                                font-size: 13px;
                                width: 60px;
                            }
                            
                            .mines-select {
                                width: 90px;
                            }
                            
                            .action-btn {
                                padding: 8px 0;
                                font-size: 13px;
                                min-width: 100px;
                            }
                        }
                    `;
                    document.head.appendChild(styleElement);
                }
                
                // Находим и добавляем обработчики событий для кнопок быстрой ставки
                const quickBetButtons = document.querySelectorAll('.quick-bet-btn');
                quickBetButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const amount = parseInt(this.dataset.amount);
                        if (elements.minerBet) {
                            elements.minerBet.value = amount;
                        }
                        // Проигрываем звук клика
                        playSound('click');
                    });
                });
                
                app.log('Майнер', 'Игровой интерфейс успешно создан');
                return true;
            } catch (error) {
                app.log('Майнер', `Ошибка создания интерфейса: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Инициализация игры
         * С защитой от повторной инициализации и таймаутом
         */
        const init = async function() {
            // Предотвращаем повторную инициализацию
            if (state.initialized || state.initializationStarted) {
                app.log('Майнер', 'Инициализация уже завершена или выполняется');
                return true;
            }
            
            state.initializationStarted = true;
            app.log('Майнер', 'Запуск инициализации игры');
            
            try {
                // Устанавливаем таймаут для инициализации
                const initPromise = new Promise(async (resolve) => {
                    try {
                        // Сначала создаем интерфейс
                        if (!createGameInterface()) {
                            app.log('Майнер', 'Не удалось создать игровой интерфейс', true);
                            resolve(false);
                            return;
                        }
                        
                        // Инициализируем аудио систему
                        initAudio();
                        
                        // Затем получаем DOM элементы
                        await findDOMElements();
                        
                        // Создаем игровую сетку
                        createGrid();
                        
                        // Обновляем потенциальный выигрыш
                        updatePotentialWin();
                        
                        // Добавляем обработчики событий
                        setupEventListeners();
                        
                        state.initialized = true;
                        app.log('Майнер', 'Инициализация успешно завершена');
                        resolve(true);
                    } catch (innerError) {
                        app.log('Майнер', `Ошибка в процессе инициализации: ${innerError.message}`, true);
                        resolve(false);
                    }
                });
                
                // Устанавливаем таймаут (3 секунды)
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        app.log('Майнер', 'Таймаут инициализации', true);
                        resolve(false);
                    }, 3000);
                });
                
                // Используем Promise.race для предотвращения зависания
                const result = await Promise.race([initPromise, timeoutPromise]);
                
                return result;
                
            } catch (error) {
                app.log('Майнер', `Критическая ошибка инициализации: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Поиск DOM элементов с защитой от null
         */
        const findDOMElements = async function() {
            // Используем Promise для асинхронности
            return new Promise((resolve, reject) => {
                try {
                    // Таймаут для ожидания готовности DOM
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
                        
                        // Проверка критических элементов и отчет о них
                        if (!elements.newGameBtn) {
                            app.log('Майнер', 'Предупреждение: элемент new-game-btn не найден', true);
                        } else {
                            app.log('Майнер', 'Элемент new-game-btn успешно найден');
                        }
                        
                        if (!elements.minerGrid) {
                            app.log('Майнер', 'Предупреждение: элемент miner-grid не найден', true);
                        } else {
                            app.log('Майнер', 'Элемент miner-grid успешно найден');
                        }
                        
                        resolve();
                    }, 100);
                } catch (error) {
                    app.log('Майнер', `Ошибка поиска DOM элементов: ${error.message}`, true);
                    resolve(); // Резолвим промис, чтобы не блокировать инициализацию
                }
            });
        };
        
        /**
         * Настройка обработчиков событий
         */
        const setupEventListeners = function() {
            try {
                // Кнопка новой игры
                if (elements.newGameBtn) {
                    // Очищаем текущие обработчики (предотвращение дублирования)
                    const newGameBtn = elements.newGameBtn.cloneNode(true);
                    if (elements.newGameBtn.parentNode) {
                        elements.newGameBtn.parentNode.replaceChild(newGameBtn, elements.newGameBtn);
                    }
                    elements.newGameBtn = newGameBtn;
                    
                    // Добавляем обработчик
                    elements.newGameBtn.addEventListener('click', startNewGame);
                    app.log('Майнер', 'Обработчик для кнопки новой игры установлен');
                } else {
                    app.log('Майнер', 'Невозможно установить обработчик: кнопка новой игры не найдена', true);
                }
                
                // Кнопка вывода
                if (elements.cashoutBtn) {
                    const cashoutBtn = elements.cashoutBtn.cloneNode(true);
                    if (elements.cashoutBtn.parentNode) {
                        elements.cashoutBtn.parentNode.replaceChild(cashoutBtn, elements.cashoutBtn);
                    }
                    elements.cashoutBtn = cashoutBtn;
                    
                    elements.cashoutBtn.addEventListener('click', cashout);
                    app.log('Майнер', 'Обработчик для кнопки вывода установлен');
                }
                
                // Выбор количества мин
                if (elements.minesCount) {
                    elements.minesCount.addEventListener('change', updateMineCount);
                    app.log('Майнер', 'Обработчик для выбора количества мин установлен');
                }
                
                // Изменение ставки
                if (elements.minerBet) {
                    elements.minerBet.addEventListener('input', updatePotentialWin);
                    app.log('Майнер', 'Обработчик для изменения ставки установлен');
                }
                
                // Кнопки +/- для ставки
                const decreaseBtn = document.querySelector('.bet-decrease-btn');
                const increaseBtn = document.querySelector('.bet-increase-btn');
                
                if (decreaseBtn) {
                    decreaseBtn.addEventListener('click', () => {
                        adjustBet(-1);
                    });
                }
                
                if (increaseBtn) {
                    increaseBtn.addEventListener('click', () => {
                        adjustBet(1);
                    });
                }
                
                // Переключатель звука
                if (elements.soundToggle) {
                    elements.soundToggle.addEventListener('click', toggleSound);
                    app.log('Майнер', 'Обработчик для переключателя звука установлен');
                }
                
                // Переключатель музыки
                if (elements.musicToggle) {
                    elements.musicToggle.addEventListener('click', toggleMusic);
                    app.log('Майнер', 'Обработчик для переключателя музыки установлен');
                }
                
                app.log('Майнер', 'Обработчики событий установлены');
            } catch (error) {
                app.log('Майнер', `Ошибка установки обработчиков: ${error.message}`, true);
            }
        };
        
        /**
         * Регулировка ставки
         */
        const adjustBet = function(change) {
            try {
                if (!elements.minerBet) return;
                
                // Получаем текущую ставку
                let currentBet = parseInt(elements.minerBet.value) || 10;
                
                // Общие значения ставок
                const commonBets = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
                
                if (change < 0) {
                    // Уменьшаем ставку
                    let newBet = currentBet;
                    
                    // Находим следующую меньшую общую ставку
                    for (let i = commonBets.length - 1; i >= 0; i--) {
                        if (commonBets[i] < currentBet) {
                            newBet = commonBets[i];
                            break;
                        }
                    }
                    
                    // Гарантируем минимальную ставку
                    currentBet = Math.max(1, newBet);
                } else {
                    // Увеличиваем ставку
                    let newBet = currentBet;
                    
                    // Находим следующую большую общую ставку
                    for (let i = 0; i < commonBets.length; i++) {
                        if (commonBets[i] > currentBet) {
                            newBet = commonBets[i];
                            break;
                        }
                    }
                    
                    // Гарантируем максимальную ставку
                    currentBet = Math.min(1000, newBet);
                }
                
                // Обновляем поле ввода
                elements.minerBet.value = currentBet;
                
                // Обновляем потенциальный выигрыш
                updatePotentialWin();
                
                // Проигрываем звук клика
                playSound('click');
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
            } catch (error) {
                app.log('Майнер', `Ошибка регулировки ставки: ${error.message}`, true);
            }
        };
        
        /**
         * Создание игровой сетки
         */
        const createGrid = function() {
            try {
                if (!elements.minerGrid) {
                    app.log('Майнер', 'Невозможно создать сетку: элемент minerGrid не найден', true);
                    return;
                }
                
                // Очищаем текущую сетку
                elements.minerGrid.innerHTML = '';
                
                // Создаем сетку 5x5
                for (let i = 0; i < 5; i++) {
                    for (let j = 0; j < 5; j++) {
                        const cell = document.createElement('div');
                        cell.className = 'grid-cell';
                        cell.dataset.row = i;
                        cell.dataset.col = j;
                        cell.dataset.index = i * 5 + j;
                        
                        // Создаем внутреннюю структуру ячейки
                        const cellInner = document.createElement('div');
                        cellInner.className = 'cell-inner';
                        
                        const cellBack = document.createElement('div');
                        cellBack.className = 'cell-back';
                        
                        const cellFront = document.createElement('div');
                        cellFront.className = 'cell-front';
                        
                        cellInner.appendChild(cellBack);
                        cellInner.appendChild(cellFront);
                        cell.appendChild(cellInner);
                        
                        // Добавляем обработчик только если игра активна
                        if (state.isPlaying) {
                            cell.addEventListener('click', () => revealCell(i * 5 + j));
                            cell.classList.add('active-cell');
                        }
                        
                        elements.minerGrid.appendChild(cell);
                    }
                }
                
                app.log('Майнер', 'Игровая сетка успешно создана');
            } catch (error) {
                app.log('Майнер', `Ошибка создания сетки: ${error.message}`, true);
            }
        };
        
        /**
         * Обновление количества мин
         */
        const updateMineCount = function() {
            try {
                // Если игра уже началась, не разрешаем менять количество мин
                if (state.isPlaying) {
                    // Возвращаем к предыдущему значению
                    if (elements.minesCount) {
                        elements.minesCount.value = state.gameData.minesCount;
                    }
                    if (window.casinoApp && window.casinoApp.showNotification) {
                        window.casinoApp.showNotification('Нельзя менять количество мин во время игры');
                    }
                    return;
                }
                
                if (!elements.minesCount) {
                    app.log('Майнер', 'Элемент minesCount не найден', true);
                    return;
                }
                
                state.gameData.minesCount = parseInt(elements.minesCount.value);
                
                // Обновляем конфигурацию в зависимости от выбранного количества мин
                const config = MULTIPLIER_CONFIG[state.gameData.minesCount] || MULTIPLIER_CONFIG[3];
                state.gameData.baseMultiplier = config.base;
                
                // Обновляем отображение
                updatePotentialWin();
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                // Проигрываем звук
                playSound('click');
                
                app.log('Майнер', `Количество мин обновлено: ${state.gameData.minesCount}`);
            } catch (error) {
                app.log('Майнер', `Ошибка обновления количества мин: ${error.message}`, true);
            }
        };
        
        /**
         * Вычисление множителя выигрыша
         * Использует вероятностную формулу для честного расчета
         */
        const calculateMultiplier = function(revealed, total, mines) {
            if (revealed === 0) return state.gameData.baseMultiplier;
            
            try {
                const safeSpots = total - mines;
                let probability = 1;
                
                // Вычисляем вероятность безопасного выбора для каждого хода
                for (let i = 0; i < revealed; i++) {
                    probability *= (safeSpots - i) / (total - i);
                }
                
                // Учитываем преимущество казино (5%)
                probability = probability * (1 - state.gameData.houseEdge);
                
                // Множитель = 1 / вероятность (с корректировкой для баланса)
                let multiplier = 1 / probability;
                
                // Применяем конфигурацию для баланса игры
                const config = MULTIPLIER_CONFIG[mines] || MULTIPLIER_CONFIG[3];
                
                // Прогрессивный рост множителя
                const progressFactor = Math.min(1, revealed / safeSpots * 2);
                const bonusMult = config.maxBonus * progressFactor;
                
                multiplier = config.base + (multiplier - 1) * config.growth * (1 + bonusMult);
                
                // Ограничиваем максимальный множитель
                multiplier = Math.min(multiplier, state.gameData.maxMultiplier);
                
                // Округляем до 2 десятичных знаков
                return Math.floor(multiplier * 100) / 100;
            } catch (error) {
                app.log('Майнер', `Ошибка вычисления множителя: ${error.message}`, true);
                return state.gameData.baseMultiplier;
            }
        };
        
        /**
         * Обновление отображения потенциального выигрыша
         */
        const updatePotentialWin = function() {
            try {
                if (!elements.potentialWin || !elements.minerBet) {
                    return;
                }
                
                const betAmt = parseInt(elements.minerBet.value) || 0;
                const revealedCount = state.gameData.revealedCells.length;
                
                // Вычисляем множитель
                const multiplier = calculateMultiplier(
                    revealedCount,
                    state.gameData.totalCells,
                    state.gameData.minesCount
                );
                
                // Вычисляем потенциальный выигрыш
                const potential = Math.floor(betAmt * multiplier);
                
                // Обновляем отображение
                elements.potentialWin.textContent = `${potential} ⭐`;
                
                if (elements.multiplierDisplay) {
                    elements.multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
                    
                    // Удаляем все классы уровней
                    elements.multiplierDisplay.className = 'info-value multiplier-value';
                    
                    // Добавляем визуальные эффекты для уровней множителя
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
                
                // Обновляем игровые данные
                state.gameData.currentMultiplier = multiplier;
                
                app.log('Майнер', `Потенциальный выигрыш обновлен: ${potential}, множитель: ${multiplier}`);
            } catch (error) {
                app.log('Майнер', `Ошибка обновления потенциального выигрыша: ${error.message}`, true);
            }
        };
        
        /**
         * Начало новой игры
         */
        const startNewGame = async function() {
            app.log('Майнер', 'Начало новой игры');
            
            // Проверяем инициализацию
            if (!state.initialized) {
                app.log('Майнер', 'Игра не инициализирована, запускаем инициализацию', true);
                await init();
                
                // Если инициализация не удалась, выходим
                if (!state.initialized) {
                    app.log('Майнер', 'Не удалось запустить игру: ошибка инициализации', true);
                    return;
                }
            }
            
            try {
                // Проверяем наличие casinoApp
                if (!window.casinoApp) {
                    app.log('Майнер', 'casinoApp не найден', true);
                    alert('Ошибка инициализации приложения');
                    return;
                }
                
                // Проверяем наличие элементов
                if (!elements.minerBet) {
                    app.log('Майнер', 'Элемент ставки не найден', true);
                    return;
                }
                
                // Получаем сумму ставки
                const betAmount = parseInt(elements.minerBet.value);
                
                // Проверяем ставку
                if (isNaN(betAmount) || betAmount <= 0) {
                    window.casinoApp.showNotification('Пожалуйста, введите корректную ставку');
                    return;
                }
                
                // Проверяем достаточность средств
                if (window.GreenLightApp && window.GreenLightApp.user && 
                    betAmount > window.GreenLightApp.user.balance) {
                    window.casinoApp.showNotification('Недостаточно средств для этой ставки');
                    return;
                }
                
                // Сбрасываем состояние игры
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
                
                // Очищаем предыдущие данные мин
                _minesData = null;
                
                // Размещаем мины
                placeMines();
                
                // Обновляем интерфейс
                createGrid();
                
                // Блокируем выбор количества мин
                if (elements.minesCount) {
                    elements.minesCount.disabled = true;
                }
                
                // Обновляем кнопки
                if (elements.cashoutBtn) {
                    elements.cashoutBtn.disabled = true; // Отключаем до открытия хотя бы одной ячейки
                }
                
                if (elements.newGameBtn) {
                    elements.newGameBtn.disabled = true;
                }
                
                // Скрываем результат
                if (elements.minerResult) {
                    elements.minerResult.className = 'result hidden';
                    elements.minerResult.textContent = '';
                }
                
                // Запускаем фоновую музыку, если не отключена
                if (audio.initialized && !audio.musicMuted) {
                    audio.background.currentTime = 0;
                    audio.background.play().catch(e => {
                        app.log('Майнер', `Автовоспроизведение фоновой музыки предотвращено: ${e.message}`);
                    });
                }
                
                // Проигрываем звук начала игры
                playSound('click');
                
                // Тактильная обратная связь
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('medium');
                }
                
                // Обрабатываем начальную ставку
                await window.casinoApp.processGameResult(
                    'miner',
                    betAmount,
                    'bet',
                    0,
                    { 
                        minesCount: state.gameData.minesCount
                    }
                );
                
                // Обновляем отображение потенциального выигрыша
                updatePotentialWin();
                
                app.log('Майнер', 'Новая игра успешно запущена');
            } catch (error) {
                app.log('Майнер', `Ошибка запуска новой игры: ${error.message}`, true);
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
         * Функция шифрования данных
         */
        const encodeData = function(data) {
            // Простое шифрование для маскировки данных
            return btoa(JSON.stringify(data).split('').map(c => 
                String.fromCharCode(c.charCodeAt(0) + 7)
            ).join(''));
        };
        
        /**
         * Функция дешифрования данных
         */
        const decodeData = function(encoded) {
            try {
                return JSON.parse(atob(encoded).split('').map(c => 
                    String.fromCharCode(c.charCodeAt(0) - 7)
                ).join(''));
            } catch (e) {
                return [];
            }
        };
        
        /**
         * Размещение мин (без вывода позиций в консоль)
         */
        const placeMines = function() {
            try {
                // Создаем новый массив для мин
                const mines = [];
                
                // Размещаем новые мины
                while (mines.length < state.gameData.minesCount) {
                    const randomIndex = Math.floor(Math.random() * state.gameData.totalCells);
                    
                    // Добавляем, только если еще не мина
                    if (!mines.includes(randomIndex)) {
                        mines.push(randomIndex);
                        state.gameData.grid[randomIndex] = 'mine';
                    }
                }
                
                // Шифруем позиции мин
                _minesData = encodeData(mines);
                
                // НЕ выводим позиции мин в консоль для безопасности
                app.log('Майнер', 'Мины размещены');
            } catch (error) {
                app.log('Майнер', `Ошибка размещения мин: ${error.message}`, true);
            }
        };
        
        /**
         * Проверка, является ли ячейка миной
         * Использует зашифрованные данные
         */
        const isMine = function(index) {
            if (!_minesData) return false;
            
            try {
                const mines = decodeData(_minesData);
                return mines.includes(index);
            } catch (error) {
                app.log('Майнер', `Ошибка проверки мины: ${error.message}`, true);
                return false;
            }
        };
        
        /**
         * Открытие ячейки
         */
        const revealCell = async function(index) {
            try {
                // Проверяем, открыта ли уже ячейка
                if (state.gameData.revealedCells.includes(index)) {
                    return;
                }
                
                // Проверяем, активна ли игра
                if (!state.isPlaying) {
                    return;
                }
                
                // Получаем элемент ячейки
                const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
                if (!cell) {
                    app.log('Майнер', `Ячейка с индексом ${index} не найдена`, true);
                    return;
                }
                
                // Проигрываем звук клика
                playSound('click');
                
                // Тактильная обратная связь
                if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('light');
                }
                
                // Проверяем, является ли ячейка миной (используя зашифрованные данные)
                if (isMine(index)) {
                    // Конец игры - найдена мина
                    revealAllMines();
                    
                    // Получаем позицию ячейки для эффекта взрыва
                    const cellRect = cell.getBoundingClientRect();
                    const explosionX = cellRect.left + cellRect.width / 2;
                    const explosionY = cellRect.top + cellRect.height / 2;
                    
                    // Проигрываем звук взрыва
                    playSound('explosion');
                    
                    // Создаем эффект частиц взрыва
                    createParticleEffect(explosionX, explosionY, 'explosion');
                    
                    // Эффект тряски экрана
                    screenShake(8, 800);
                    
                    // Обновляем интерфейс
                    cell.classList.add('mine', 'exploded');
                    const cellFront = cell.querySelector('.cell-front');
                    if (cellFront) {
                        cellFront.innerHTML = '💥';
                    } else {
                        cell.innerHTML = '💥';
                    }
                    
                    // Вибрация для взрыва
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('error');
                    }
                    
                    // Устанавливаем состояние игры
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
                    
                    // Показываем результат
                    if (elements.minerResult) {
                        elements.minerResult.innerHTML = `
                            <div class="lose-icon">💥</div>
                            <div class="lose-title">БУМ! Вы наткнулись на мину.</div>
                            <div class="lose-message">Игра окончена!</div>
                        `;
                        elements.minerResult.className = 'result lose';
                    }
                    
                    // Обрабатываем проигрыш (НЕ отправляем позиции мин на сервер)
                    if (window.casinoApp) {
                        await window.casinoApp.processGameResult(
                            'miner',
                            0, // Нет дополнительной ставки
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
                    
                    // Останавливаем фоновую музыку
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
                    // Безопасная ячейка
                    state.gameData.revealedCells.push(index);
                    
                    // Обновляем интерфейс с анимацией
                    cell.classList.add('revealed');
                    const cellFront = cell.querySelector('.cell-front');
                    if (cellFront) {
                        cellFront.innerHTML = '💰';
                    } else {
                        cell.innerHTML = '💰';
                    }
                    
                    // Проигрываем звук открытия
                    playSound('reveal');
                    
                    // Небольшие частицы для безопасной ячейки
                    const cellRect = cell.getBoundingClientRect();
                    const cellX = cellRect.left + cellRect.width / 2;
                    const cellY = cellRect.top + cellRect.height / 2;
                    createParticleEffect(cellX, cellY, 'coins');
                    
                    // Включаем кнопку вывода после первой открытой ячейки
                    if (state.gameData.revealedCells.length === 1 && elements.cashoutBtn) {
                        elements.cashoutBtn.disabled = false;
                    }
                    
                    // Обновляем множитель и потенциальный выигрыш
                    updatePotentialWin();
                    
                    // Тактильная обратная связь для безопасной ячейки
                    if (window.casinoApp && window.casinoApp.provideTactileFeedback) {
                        window.casinoApp.provideTactileFeedback('success');
                    }
                    
                    // Проверяем, открыты ли все безопасные ячейки (условие победы)
                    if (state.gameData.revealedCells.length === state.gameData.totalCells - state.gameData.minesCount) {
                        // Игрок открыл все безопасные ячейки
                        await automaticCashout();
                    }
                }
            } catch (error) {
                app.log('Майнер', `Ошибка открытия ячейки: ${error.message}`, true);
            }
        };
        
        /**
         * Показ всех мин
         */
        const revealAllMines = function() {
            try {
                if (!_minesData) return;
                
                const mines = decodeData(_minesData);
                
                mines.forEach(index => {
                    // Пропускаем взорвавшуюся мину
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
                        
                        // Небольшая задержка для каждой мины
                        const delay = Math.random() * 300;
                        setTimeout(() => {
                            cell.classList.add('mine-reveal');
                        }, delay);
                    }
                });
            } catch (error) {
                app.log('Майнер', `Ошибка показа всех мин: ${error.message}`, true);
            }
        };
        
        /**
         * Вывод выигрыша
         */
        const cashout = async function() {
            try {
                // Проверяем состояние игры
                if (!state.isPlaying || state.gameData.revealedCells.length === 0) {
                    return;
                }
                
                // Проверяем наличие casinoApp
                if (!window.casinoApp) {
                    return;
                }
                
                // Вычисляем выигрыш
                const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
                
                // Проигрываем звук вывода
                playSound('cashout');
                
                // Создаем эффект частиц конфетти
                const containerRect = elements.container.getBoundingClientRect();
                const centerX = containerRect.left + containerRect.width / 2;
                const centerY = containerRect.top + containerRect.height / 2;
                createParticleEffect(centerX, centerY, 'confetti');
                
                // Тактильная обратная связь
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                }
                
                // Обновляем интерфейс
                if (elements.minerResult) {
                    elements.minerResult.innerHTML = `
                        <div class="win-icon">🎉</div>
                        <div class="win-title">Вы выиграли ${winAmount} ⭐!</div>
                        <div class="win-multiplier">Множитель: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                    `;
                    elements.minerResult.className = 'result win';
                }
                
                // Сбрасываем состояние игры
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
                
                // Показываем все мины
                revealAllMines();
                
                // Обрабатываем выигрыш (НЕ отправляем позиции мин на сервер)
                await window.casinoApp.processGameResult(
                    'miner',
                    0, // Нет дополнительной ставки
                    'win',
                    winAmount,
                    {
                        revealedCells: state.gameData.revealedCells,
                        multiplier: state.gameData.currentMultiplier,
                        minesCount: state.gameData.minesCount
                    }
                );
                
                // Затухание фоновой музыки
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
                
                app.log('Майнер', `Успешный вывод: ${winAmount} с множителем ${state.gameData.currentMultiplier.toFixed(2)}`);
            } catch (error) {
                app.log('Майнер', `Ошибка вывода выигрыша: ${error.message}`, true);
            }
        };
        
        /**
         * Автоматический вывод при открытии всех безопасных ячеек
         */
        const automaticCashout = async function() {
            try {
                // Проверяем состояние игры
                if (!state.isPlaying) {
                    return;
                }
                
                // Проверяем наличие casinoApp
                if (!window.casinoApp) {
                    return;
                }
                
                // Вычисляем выигрыш
                const winAmount = Math.floor(state.gameData.betAmount * state.gameData.currentMultiplier);
                
                // Проигрываем звук идеального выигрыша
                playSound('perfectWin');
                
                // Создаем большой эффект частиц конфетти
                const containerRect = elements.container.getBoundingClientRect();
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const centerX = containerRect.left + Math.random() * containerRect.width;
                        const centerY = containerRect.top + Math.random() * containerRect.height;
                        createParticleEffect(centerX, centerY, 'confetti');
                    }, i * 300);
                }
                
                // Тактильная обратная связь - большой выигрыш
                if (window.casinoApp.provideTactileFeedback) {
                    window.casinoApp.provideTactileFeedback('success');
                    setTimeout(() => window.casinoApp.provideTactileFeedback('success'), 300);
                }
                
                // Обновляем интерфейс
                if (elements.minerResult) {
                    elements.minerResult.innerHTML = `
                        <div class="win-icon">🏆</div>
                        <div class="win-title">Идеально! Все безопасные ячейки открыты!</div>
                        <div class="win-amount">${winAmount} ⭐</div>
                        <div class="win-multiplier">Множитель: x${state.gameData.currentMultiplier.toFixed(2)}</div>
                    `;
                    elements.minerResult.className = 'result win big-win';
                }
                
                // Сбрасываем состояние игры
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
                
                // Показываем все мины
                revealAllMines();
                
                // Обрабатываем выигрыш
                await window.casinoApp.processGameResult(
                    'miner',
                    0, // Нет дополнительной ставки
                    'win',
                    winAmount,
                    {
                        revealedCells: state.gameData.revealedCells, // Добавлена запятая здесь
                        multiplier: state.gameData.currentMultiplier,
                        minesCount: state.gameData.minesCount,
                        perfectGame: true
                    }
                );
                
                // Затухание фоновой музыки
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
                
                app.log('Майнер', `Идеальная игра завершена с выигрышем ${winAmount}`);
            } catch (error) {
                app.log('Майнер', `Ошибка автоматического вывода: ${error.message}`, true);
            }
        };
        
        // Возвращаем публичный интерфейс
        return {
            // Основные методы
            init: init,
            startNewGame: startNewGame,
            cashout: cashout,
            
            // Управление звуком
            toggleSound: toggleSound,
            toggleMusic: toggleMusic,
            setVolume: setVolume,
            
            // Управление анимациями
            createParticleEffect: createParticleEffect,
            screenShake: screenShake,
            
            // Метод для проверки состояния
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
    
    // Регистрируем игру во всех форматах для максимальной совместимости
    try {
        // 1. Регистрация через новую систему
        if (window.registerGame) {
            window.registerGame('minerGame', minerGame);
            app.log('Майнер', 'Игра зарегистрирована через новую систему registerGame');
        }
        
        // 2. Экспорт в глобальное пространство имен (обратная совместимость)
        window.minerGame = minerGame;
        app.log('Майнер', 'Игра экспортирована в глобальное пространство имен');
        
        // 3. Логируем завершение загрузки модуля
        app.log('Майнер', 'Модуль успешно загружен и готов к инициализации');
        
        // 4. Автоматическая инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                    app.log('Майнер', 'Запуск автоматической инициализации');
                    minerGame.init();
                }
            }, 500);
        });
        
        // 5. Если DOM уже загружен, инициализируем немедленно
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                if (!minerGame.getStatus().initialized && !minerGame.getStatus().initializationStarted) {
                    app.log('Майнер', 'Запуск автоматической инициализации (DOM уже загружен)');
                    minerGame.init();
                }
            }, 500);
        }
        
    } catch (error) {
        app.log('Майнер', `Ошибка регистрации игры: ${error.message}`, true);
    }
})();