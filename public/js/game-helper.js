// game-helper.js - Вспомогательный файл для регистрации игр и устранения проблем с загрузкой
console.log('[GameHelper] Загрузка вспомогательного модуля для игр');

(function() {
  // Проверка существования глобального хранилища игр
  if (!window.GreenLightGames) {
    console.log('[GameHelper] Создание глобального хранилища игр');
    
    window.GreenLightGames = {
      slotsGame: null,
      rouletteGame: null,
      guessNumberGame: null,
      minerGame: null,
      crushGame: null,
      loaded: {
        slots: false,
        roulette: false,
        guessnumber: false,
        miner: false,
        crush: false
      }
    };
  }
  
  // Регистрация игры в глобальном хранилище
  window.registerGame = function(name, gameObject) {
    if (!window.GreenLightGames) return;
    
    console.log(`[GameHelper] Регистрация игры: ${name}`);
    window.GreenLightGames[name] = gameObject;
    
    // Извлекаем имя игры без "Game" в конце
    const shortName = name.replace('Game', '').toLowerCase();
    window.GreenLightGames.loaded[shortName] = true;
    
    // Обновляем глобальный объект если он не существует (для обратной совместимости)
    if (!window[name]) {
      window[name] = gameObject;
      console.log(`[GameHelper] Экспортировал ${name} в глобальное пространство имен`);
    }
  };
  
  // Проверка готовности игр
  window.checkGamesReady = function() {
    // Проверяем готовность игр
    const gameStatus = {
      slots: typeof window.slotsGame === 'object' && window.slotsGame !== null,
      roulette: typeof window.rouletteGame === 'object' && window.rouletteGame !== null,
      guessnumber: typeof window.guessNumberGame === 'object' && window.guessNumberGame !== null,
      miner: typeof window.minerGame === 'object' && window.minerGame !== null,
      crush: typeof window.crushGame === 'object' && window.crushGame !== null
    };
    
    // Проверяем, загружена ли хотя бы одна игра
    return Object.values(gameStatus).some(status => status === true);
  };
  
  // Сообщаем, что GameHelper загружен
  console.log('[GameHelper] Вспомогательный модуль для игр загружен');
})();