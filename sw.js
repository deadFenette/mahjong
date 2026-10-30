/* ============================================================
   SW.JS — Service Worker для офлайн-режима
   Кэшируем все файлы при первой загрузке
   ============================================================ */

const CACHE_NAME = 'mahjong-v45-mixbig';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/buttons.css',
  './css/select.css',
  './css/game.css',
  './css/pause.css',
  './css/win.css',
  './css/settings.css',
  './css/common.css',
  './css/tutorial.css',
  './css/minitiles.css',
  './css/mix.css',
  './css/icons.css',
  './css/tiles.css',
  './css/highlight.css',
  './css/preview.css',
  './css/menu.css',
  // v42: пакет анимаций «Intent»
  './css/motion.css',
  './css/themes.css',
  './css/lite.css',
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
  './js/tileset-core.js',
  './js/tileset.js',
  // скины: новый файл js/skins/<id>.js добавляется сюда строкой (тест следит)
  './js/skins/classic.js',
  './js/skins/ornate.js',
  './js/skins/pictures.js',
  './js/skins/clear.js',
  './js/layouts.js',
  './js/glyph-data.js',
  './js/mixmetrics.js',
  './js/mixglyph.js',
  './js/mixgen.js',
  './js/icons.js',
  './js/perf.js',
  './js/motion.js',
  // v26-audio: модульные звуковые эффекты — каждый звук в отдельном файле
  './js/sounds/init.js',
  './js/sounds/hover.js',
  './js/sounds/click.js',
  './js/sounds/deselect.js',
  './js/sounds/blocked.js',
  './js/sounds/match.js',
  './js/sounds/combo.js',
  './js/sounds/mismatch.js',
  './js/sounds/hint.js',
  './js/sounds/undo.js',
  './js/sounds/shuffle.js',
  './js/sounds/deal.js',
  './js/sounds/win.js',
  // v42: «шлепок печати» достижений
  './js/sounds/stamp.js',
  './js/sounds/index.js',
  './js/audio.js',
  './js/music.js',
  './js/storage.js',
  './js/achievements.js',
  './js/tutorial.js',
  './js/render.js',
  './js/game.js',
  './js/app/core.js',
  './js/app/modes.js',
  './js/app/mix.js',
  './js/app/play.js',
  './js/app/win.js',
  './js/app/saves.js',
  './js/app/gallery.js',
  './js/app/settings.js',
  './js/app/skins.js',
  './js/app/options.js',
  './js/app/graphics.js',
  './js/app/preview.js',
  './js/app/pause.js',
  './js/app/init.js',
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
