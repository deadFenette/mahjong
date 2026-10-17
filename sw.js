/* ============================================================
   SW.JS — Service Worker для офлайн-режима
   Кэшируем все файлы при первой загрузке
   ============================================================ */

const CACHE_NAME = 'mahjong-v25-sounds';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/tiles.css',
  './css/menu.css',
  './css/themes.css',
  './css/fonts.css',
  // v20-offline: самохостинг шрифтов (раньше тянулись с Google Fonts,
  // в офлайне срабатывал системный фолбэк и тема проседала)
  './fonts/mashanzheng.ttf',
  './fonts/notoserifsc-400.woff2',
  './fonts/notoserifsc-600.woff2',
  './fonts/notoserifsc-700.woff2',
  './fonts/notoserifsc-900.woff2',
  './fonts/notosanssc-400.woff2',
  './fonts/notosanssc-500.woff2',
  './fonts/notosanssc-700.woff2',
  './fonts/zcoolxiaowei.woff2',
  './js/tileset-classic.js',
  './js/tileset-ornate.js',
  './js/tileset.js',
  './js/layouts.js',
  // v25-sounds: модульные звуковые эффекты — каждый звук в отдельном файле
  './js/sounds/init.js',
  './js/sounds/click.js',
  './js/sounds/match.js',
  './js/sounds/combo.js',
  './js/sounds/mismatch.js',
  './js/sounds/hint.js',
  './js/sounds/win.js',
  './js/sounds/shuffle.js',
  './js/sounds/hover.js',
  './js/sounds/index.js',
  './js/audio.js',
  './js/music.js',
  './js/storage.js',
  './js/achievements.js',
  './js/tutorial.js',
  './js/render.js',
  './js/game.js',
  './js/app.js',
  './js/sw-register.js',
  // v20-offline: фавиконки тоже в кэш — раньше терялись в офлайне
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.ico',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        // Если часть файлов не закэшировалась — всё равно ставим SW
        console.warn('SW: не всё закэшировано', err);
        return Promise.allSettled(ASSETS.map(a => cache.add(a)));
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Только GET
  if (event.request.method !== 'GET') return;

  // Сначала пытаемся из кэша, потом — сеть (cache-first)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Кэшируем новые ресурсы (только наши)
        const url = new URL(event.request.url);
        if (url.origin === location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Офлайн и нет в кэше — отдаём index.html для навигации
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
