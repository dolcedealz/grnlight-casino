/**
 * game-helper.js - Улучшенная система управления играми
 * Версия 2.0.0
 * 
 * Обеспечивает унифицированный интерфейс для регистрации и взаимодействия с играми.
 * Устраняет проблемы с загрузкой и зависимостями между модулями.
 */

// Создание безопасного окружения для игр
(function() {
  // Проверяем наличие основного объекта приложения
  if (!window.GreenLightApp) {
      console.error('[GameHelper] GreenLightApp не инициализирован!');
      window.GreenLightApp = {
          log: function(source, message, isError) {
              if (isError) console.error(`[${source}] ${message}`);
              else console.log(`[${source}] ${message}`);
          },
          games: {}
      };
  }
  
  const app = window.GreenLightApp;
  app.log('GameHelper', 'Инициализация улучшенной системы управления играми v2.0.0');
  
  // Проверяем и инициализируем хранилище игр, если оно не существует
  if (!app.games) {
      app.games = {
          slots: { loaded: false, instance: null },
          roulette: { loaded: false, instance: null },
          guessnumber: { loaded: false, instance: null },
          miner: { loaded: false, instance: null },
          crush: { loaded: false, instance: null }
      };
  }
  
  // Поддержка обратной совместимости - создаем GreenLightGames если не существует
  if (!window.GreenLightGames) {
      app.log('GameHelper', 'Создание совместимого интерфейса GreenLightGames');
      
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
  
  /**
   * Улучшенная функция регистрации игры
   * Поддерживает множественные форматы для обратной совместимости
   * 
   * @param {string} name - Имя игры ('slotsGame', 'rouletteGame', и т.д.)
   * @param {object} gameObject - Объект игры с методами init, play, и т.д.
   * @returns {boolean} - Успех регистрации
   */
  window.registerGame = function(name, gameObject) {
      if (!name || !gameObject) {
          app.log('GameHelper', 'Ошибка регистрации игры: имя или объект не указаны', true);
          return false;
      }
      
      app.log('GameHelper', `Регистрация игры: ${name}`);
      
      try {
          // Опеределяем короткое имя (без "Game" в конце)
          const shortName = name.replace('Game', '').toLowerCase();
          
          // Регистрируем в новом формате через GreenLightApp
          if (app.games && app.games[shortName]) {
              app.games[shortName].loaded = true;
              app.games[shortName].instance = gameObject;
              app.log('GameHelper', `Игра ${name} зарегистрирована в GreenLightApp.games`);
          }
          
          // Поддержка обратной совместимости - регистрируем в GreenLightGames
          if (window.GreenLightGames) {
              window.GreenLightGames[name] = gameObject;
              
              // Обновляем флаг загрузки
              if (window.GreenLightGames.loaded && shortName in window.GreenLightGames.loaded) {
                  window.GreenLightGames.loaded[shortName] = true;
              }
              
              app.log('GameHelper', `Игра ${name} зарегистрирована в GreenLightGames`);
          }
          
          // Экспортируем в глобальное пространство имен (для обратной совместимости)
          if (!window[name]) {
              window[name] = gameObject;
              app.log('GameHelper', `Игра ${name} экспортирована в глобальное пространство имен`);
          }
          
          return true;
          
      } catch (error) {
          app.log('GameHelper', `Ошибка при регистрации игры ${name}: ${error.message}`, true);
          
          // В случае ошибки, все равно пытаемся экспортировать в глобальное пространство имен
          try {
              window[name] = gameObject;
          } catch (globalError) {
              app.log('GameHelper', `Не удалось экспортировать игру ${name} в глобальное пространство`, true);
          }
          
          return false;
      }
  };
  
  /**
   * Проверка доступности игр
   * 
   * @returns {object} - Состояние доступности игр
   */
  window.checkGamesReady = function() {
      app.log('GameHelper', 'Проверка доступности игр');
      
      // Проверяем доступность игр в новом формате
      const newFormatStatus = {};
      let newFormatGamesCount = 0;
      
      if (app.games) {
          for (const game in app.games) {
              newFormatStatus[game] = app.games[game].loaded && !!app.games[game].instance;
              if (newFormatStatus[game]) newFormatGamesCount++;
          }
      }
      
      // Проверяем доступность игр в старом формате
      const oldFormatStatus = {
          slots: typeof window.slotsGame === 'object' && window.slotsGame !== null,
          roulette: typeof window.rouletteGame === 'object' && window.rouletteGame !== null,
          guessnumber: typeof window.guessNumberGame === 'object' && window.guessNumberGame !== null,
          miner: typeof window.minerGame === 'object' && window.minerGame !== null,
          crush: typeof window.crushGame === 'object' && window.crushGame !== null
      };
      
      let oldFormatGamesCount = 0;
      for (const game in oldFormatStatus) {
          if (oldFormatStatus[game]) oldFormatGamesCount++;
      }
      
      app.log('GameHelper', `Доступно игр в новом формате: ${newFormatGamesCount}/5`);
      app.log('GameHelper', `Доступно игр в старом формате: ${oldFormatGamesCount}/5`);
      
      // Объединяем статусы
      const combinedStatus = {};
      for (const game in newFormatStatus) {
          combinedStatus[game] = newFormatStatus[game] || oldFormatStatus[game] || false;
      }
      
      return {
          newFormat: newFormatStatus,
          oldFormat: oldFormatStatus,
          combined: combinedStatus,
          anyGameAvailable: newFormatGamesCount > 0 || oldFormatGamesCount > 0
      };
  };
  
  /**
   * Безопасное получение экземпляра игры
   * Поддерживает оба формата - новый и старый
   * 
   * @param {string} gameName - Имя игры (без "Game", например 'slots')
   * @returns {object|null} - Объект игры или null если игра не найдена
   */
  window.getGameInstance = function(gameName) {
      if (!gameName) return null;
      
      try {
          const fullName = gameName.endsWith('Game') ? gameName : gameName + 'Game';
          const shortName = gameName.replace('Game', '').toLowerCase();
          
          // Проверяем новый формат
          if (app.games && app.games[shortName] && app.games[shortName].instance) {
              return app.games[shortName].instance;
          }
          
          // Проверяем GreenLightGames
          if (window.GreenLightGames && window.GreenLightGames[fullName]) {
              return window.GreenLightGames[fullName];
          }
          
          // Проверяем глобальное пространство имен
          if (window[fullName]) {
              return window[fullName];
          }
          
          return null;
          
      } catch (error) {
          app.log('GameHelper', `Ошибка при получении игры ${gameName}: ${error.message}`, true);
          return null;
      }
  };
  
  /**
   * Диагностическая функция для вывода информации об играх
   * 
   * @returns {object} - Диагностическая информация
   */
  window.diagnoseGames = function() {
      const diagnosis = {
          newFormat: {},
          oldFormat: {},
          global: {}
      };
      
      // Проверяем новый формат
      if (app.games) {
          for (const game in app.games) {
              diagnosis.newFormat[game] = {
                  exists: !!app.games[game],
                  loaded: app.games[game] ? app.games[game].loaded : false,
                  hasInstance: app.games[game] ? !!app.games[game].instance : false,
                  hasInit: app.games[game] && app.games[game].instance ? 
                      typeof app.games[game].instance.init === 'function' : false
              };
          }
      }
      
      // Проверяем GreenLightGames
      if (window.GreenLightGames) {
          diagnosis.oldFormat = {
              slotsGame: {
                  exists: !!window.GreenLightGames.slotsGame,
                  hasInit: window.GreenLightGames.slotsGame ? 
                      typeof window.GreenLightGames.slotsGame.init === 'function' : false
              },
              rouletteGame: {
                  exists: !!window.GreenLightGames.rouletteGame,
                  hasInit: window.GreenLightGames.rouletteGame ? 
                      typeof window.GreenLightGames.rouletteGame.init === 'function' : false
              },
              guessNumberGame: {
                  exists: !!window.GreenLightGames.guessNumberGame,
                  hasInit: window.GreenLightGames.guessNumberGame ? 
                      typeof window.GreenLightGames.guessNumberGame.init === 'function' : false
              },
              minerGame: {
                  exists: !!window.GreenLightGames.minerGame,
                  hasInit: window.GreenLightGames.minerGame ? 
                      typeof window.GreenLightGames.minerGame.init === 'function' : false
              },
              crushGame: {
                  exists: !!window.GreenLightGames.crushGame,
                  hasInit: window.GreenLightGames.crushGame ? 
                      typeof window.GreenLightGames.crushGame.init === 'function' : false
              }
          };
      }
      
      // Проверяем глобальное пространство имен
      diagnosis.global = {
          slotsGame: {
              exists: typeof window.slotsGame === 'object' && window.slotsGame !== null,
              hasInit: window.slotsGame ? typeof window.slotsGame.init === 'function' : false
          },
          rouletteGame: {
              exists: typeof window.rouletteGame === 'object' && window.rouletteGame !== null,
              hasInit: window.rouletteGame ? typeof window.rouletteGame.init === 'function' : false
          },
          guessNumberGame: {
              exists: typeof window.guessNumberGame === 'object' && window.guessNumberGame !== null,
              hasInit: window.guessNumberGame ? typeof window.guessNumberGame.init === 'function' : false
          },
          minerGame: {
              exists: typeof window.minerGame === 'object' && window.minerGame !== null,
              hasInit: window.minerGame ? typeof window.minerGame.init === 'function' : false
          },
          crushGame: {
              exists: typeof window.crushGame === 'object' && window.crushGame !== null,
              hasInit: window.crushGame ? typeof window.crushGame.init === 'function' : false
          }
      };
      
      app.log('GameHelper', 'Диагностика игр завершена');
      
      return diagnosis;
  };
  
  // Экспортируем GameHelper
  window.GameHelper = {
      version: '2.0.0',
      register: window.registerGame,
      checkReady: window.checkGamesReady,
      getGame: window.getGameInstance,
      diagnose: window.diagnoseGames
  };
  
  app.log('GameHelper', 'Модуль успешно инициализирован');
})();