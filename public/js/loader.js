// Emergency loader.js - гарантированно удаляет экран загрузки
console.log('[Emergency Loader] Запущен экстренный загрузчик');

// Немедленно скрываем оверлей загрузки через 3 секунды, без дополнительных проверок
setTimeout(function() {
  console.log('[Emergency Loader] Принудительное удаление экрана загрузки');
  try {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
    
    // Показываем welcome-screen
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.classList.add('active');
    }
    
    console.log('[Emergency Loader] Загрузочный экран удален, welcome-screen активирован');
  } catch (error) {
    console.error('[Emergency Loader] Ошибка:', error);
    
    // Аварийная мера - скрываем все с классом loading-overlay
    document.querySelectorAll('.loading-overlay').forEach(el => {
      el.style.display = 'none';
    });
  }
}, 3000); // Всего 3 секунды ожидания

// Резервная мера - если предыдущий способ не сработал
window.addEventListener('load', function() {
  setTimeout(function() {
    document.querySelectorAll('.loading-overlay').forEach(el => {
      el.style.display = 'none';
    });
    
    console.log('[Emergency Loader] Резервное удаление экрана загрузки после window.load');
  }, 2000);
});