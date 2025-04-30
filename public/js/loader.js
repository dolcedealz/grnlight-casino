// Исправленный JavaScript файл для устранения проблемы белого экрана/бесконечной загрузки
// Разместите этот код в начале вашего main.js или создайте новый файл loader.js и включите его первым

// Функция для обнаружения и исправления бесконечной загрузки
(function() {
  // Добавляем класс loading к body
  document.body.classList.add('loading');
  
  // Создаем индикатор загрузки
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  document.body.appendChild(spinner);
  
  // Устанавливаем таймаут для автоматического восстановления
  const loadTimeout = setTimeout(() => {
    // Если страница не загрузилась через 10 секунд, выполним аварийное восстановление
    console.log('Вынужденное восстановление после тайм-аута');
    initializeEmergencyRecovery();
  }, 10000);
  
  // Проверка успешной загрузки
  window.addEventListener('load', () => {
    clearTimeout(loadTimeout);
    console.log('Страница загружена успешно');
    
    // Удаляем класс loading и спиннер с задержкой
    setTimeout(() => {
      document.body.classList.remove('loading');
      if (spinner && spinner.parentNode) {
        spinner.parentNode.removeChild(spinner);
      }
      
      // Добавляем класс loaded к app-container
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.add('loaded');
      }
    }, 500);
  });
  
  // Функция аварийного восстановления
  function initializeEmergencyRecovery() {
    console.log('Запуск аварийного восстановления...');
    
    // Удаляем класс loading
    document.body.classList.remove('loading');
    
    // Удаляем спиннер
    if (spinner && spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
    
    // Проверяем, отображается ли что-то на странице
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.classList.add('loaded');
      
      // Проверяем, видны ли экраны
      const screens = document.querySelectorAll('.screen');
      let anyScreenVisible = false;
      
      screens.forEach(screen => {
        if (screen.classList.contains('active')) {
          anyScreenVisible = true;
        }
      });
      
      // Если ни один экран не виден, показываем welcome-screen
      if (!anyScreenVisible) {
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
          welcomeScreen.classList.add('active');
        }
      }
    }
    
    // Пробуем запустить приложение
    try {
      console.log('Инициализация упрощенного интерфейса...');
      initializeMinimalUI();
    } catch (error) {
      console.error('Не удалось инициализировать интерфейс:', error);
      showErrorMessage();
    }
  }
  
  // Функция инициализации минимального UI
  function initializeMinimalUI() {
    // Добавляем базовый функционал
    const gameCards = document.querySelectorAll('.game-card');
    const backButtons = document.querySelectorAll('.back-btn');
    const navButtons = document.querySelectorAll('.nav-btn');
    
    // Настройка игровых карточек
    gameCards.forEach(card => {
      card.addEventListener('click', function() {
        const game = this.getAttribute('data-game');
        if (!game) return;
        
        const targetScreen = document.getElementById(`${game}-screen`);
        if (!targetScreen) return;
        
        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        
        // Показываем выбранный экран
        targetScreen.classList.add('active');
      });
    });
    
    // Настройка кнопок "назад"
    backButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        
        // Показываем начальный экран
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
          welcomeScreen.classList.add('active');
        }
      });
    });
    
    // Настройка навигационных кнопок
    navButtons.forEach(button => {
      button.addEventListener('click', function() {
        const targetId = this.id;
        
        // Обновляем активную кнопку
        navButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        if (targetId === 'home-btn') {
          // Показываем начальный экран
          document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
          });
          
          const welcomeScreen = document.getElementById('welcome-screen');
          if (welcomeScreen) {
            welcomeScreen.classList.add('active');
          }
        }
        // Обработка других навигационных кнопок (profile, history)
        // ...
      });
    });
  }
  
  // Функция показа сообщения об ошибке
  function showErrorMessage() {
    // Создаем сообщение об ошибке
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.innerHTML = `
      <h2>Что-то пошло не так</h2>
      <p>Не удалось загрузить приложение. Пожалуйста, обновите страницу.</p>
      <button onclick="window.location.reload()">Обновить страницу</button>
    `;
    
    // Стилизуем сообщение
    errorMessage.style.position = 'fixed';
    errorMessage.style.top = '50%';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translate(-50%, -50%)';
    errorMessage.style.background = 'rgba(0, 0, 0, 0.8)';
    errorMessage.style.color = 'white';
    errorMessage.style.padding = '2rem';
    errorMessage.style.borderRadius = '10px';
    errorMessage.style.textAlign = 'center';
    errorMessage.style.zIndex = '10000';
    
    // Стилизуем кнопку
    const button = errorMessage.querySelector('button');
    button.style.background = '#00A86B';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.padding = '0.5rem 1rem';
    button.style.borderRadius = '5px';
    button.style.marginTop = '1rem';
    button.style.cursor = 'pointer';
    
    // Добавляем на страницу
    document.body.appendChild(errorMessage);
  }
})();

// Основной код инициализации приложения
document.addEventListener('DOMContentLoaded', function() {
  // Здесь будет ваш оригинальный код инициализации
  console.log('DOMContentLoaded: приложение инициализируется');
  
  // Проверка, что важные элементы существуют
  const elementsToCheck = [
    '.app-container',
    '.header',
    '.main-content',
    '#welcome-screen',
    '.game-card',
    '.bottom-nav'
  ];
  
  let allElementsExist = true;
  
  elementsToCheck.forEach(selector => {
    if (!document.querySelector(selector)) {
      console.error(`Элемент ${selector} не найден`);
      allElementsExist = false;
    }
  });
  
  if (!allElementsExist) {
    console.warn('Некоторые элементы отсутствуют, инициализация может быть неполной');
  }
  
  // Инициализация с задержкой для гарантии загрузки DOM
  setTimeout(() => {
    try {
      console.log('Безопасная инициализация с задержкой');
      
      // Базовая инициализация для показа главного экрана
      const welcomeScreen = document.getElementById('welcome-screen');
      if (welcomeScreen && !welcomeScreen.classList.contains('active')) {
        document.querySelectorAll('.screen').forEach(screen => {
          screen.classList.remove('active');
        });
        welcomeScreen.classList.add('active');
      }
      
      // Инициализация игровых карточек (минимальная функциональность)
      const gameCards = document.querySelectorAll('.game-card');
      gameCards.forEach(card => {
        card.addEventListener('click', function() {
          const game = this.getAttribute('data-game');
          if (!game) return;
          
          const targetScreen = document.getElementById(`${game}-screen`);
          if (!targetScreen) return;
          
          // Скрываем все экраны
          document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
          });
          
          // Показываем выбранный экран
          targetScreen.classList.add('active');
        });
      });
    } catch (error) {
      console.error('Ошибка при безопасной инициализации:', error);
    }
  }, 1000);
});