/* ============================================================
   SW.JS — Service Worker для офлайн-режима
   Кэшируем все файлы при первой загрузке
   ============================================================ */

const CACHE_NAME = 'mahjong-v10-animations';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/tiles.css',
  './css/themes.css',
  './js/tileset.js',
  './js/layouts.js',
  './js/audio.js',
  './js/storage.js',
  './js/render.js',
  './js/game.js',
  './js/app.js',
  './js/sw-register.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
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
