/* ============================================================
   SW-REGISTER.JS — Регистрация Service Worker'а
   ============================================================ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW зарегистрирован:', reg.scope);
    }).catch(err => {
      console.warn('SW не зарегистрирован:', err);
    });
  });
}

// Подсказка для установки PWA (когда браузер считает, что можно установить)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Можно показать свою кнопку "Установить как приложение"
  // Но мы полагаемся на стандартное меню Chrome → "Установить приложение"
});

window.addEventListener('appinstalled', () => {
  console.log('Приложение установлено');
});
