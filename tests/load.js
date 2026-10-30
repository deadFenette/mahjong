/* ============================================================
   TESTS/LOAD.JS — Загрузчик игровых модулей в песочнице Node
   Склеивает исходники (как это делает index.html) и исполняет
   их в одном vm-контексте с шимами браузера (localStorage).
   DOM-контроллер app.js не загружается — он тестируется
   браузерной проверкой.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---------- Шим localStorage ----------
function makeLocalStorageShim() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

// ---------- Загрузка и исполнение модулей ----------
function loadGameModules({ seedStorage = true } = {}) {
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    Set,
    Map,
    Promise,
    setTimeout: () => 0,     // таймеры в тестах не нужны
    clearTimeout: () => {},
    setInterval: () => 0,    // планировщик музыки в тестах не запускается
    clearInterval: () => {},
    performance: { now: () => Date.now() },
  };
  if (seedStorage) sandbox.localStorage = makeLocalStorageShim();

  const context = vm.createContext(sandbox);

  // Порядок как в index.html (без audio.js, app.js и sw-register.js;
  // music.js в песочнице безопасен — рантайм-код без window не выполняется)
  // v44: реестр tileset.js + скины js/skins/*.js
  // v44: реестр Tileset грузится ДО скинов; сами скины — все файлы js/skins/*.js
  const files = [
    'js/tileset-core.js',
    'js/tileset.js',
    ...skinFiles(),
    'js/perf.js',
    'js/layouts.js',
    'js/glyph-data.js',
    'js/mixmetrics.js',
    'js/mixglyph.js',
    'js/mixgen.js',
    'js/icons.js',
    'js/music.js',
    'js/storage.js',
    'js/achievements.js',
    'js/tutorial.js',
    'js/render.js',
    'js/game.js',
  ];

  let source = '';
  for (const f of files) {
    source += `\n/* ==== ${f} ==== */\n`;
    source += fs.readFileSync(path.join(ROOT, f), 'utf8');
  }

  // Экспортируем глобальные модули из области видимости скрипта
  // v44: скины больше не глобальные переменные — они лежат в реестре Tileset.
  // Старые имена (TilesetClassic…) оставлены как удобные псевдонимы для тестов.
  source += `\n;globalThis.__modules = { Tileset, TilesetClassic: Tileset.get('classic'), TilesetOrnate: Tileset.get('ornate'), TilesetPictures: Tileset.get('pictures'), TilesetClear: Tileset.get('clear'), TilesetCore, Layouts, MixGen, MixMetrics, MixGlyph, GlyphData, Icons, Perf, Music, Storage, Achievements, Tutorial, Render, Game };`;

  vm.runInContext(source, context, { filename: 'mahjong-bundle.js' });
  return context.__modules;
}

// Файлы скинов: все js/skins/*.js, кроме служебных (имя с «_»)
function skinFiles() {
  return fs.readdirSync(path.join(ROOT, 'js', 'skins'))
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .sort()
    .map(f => 'js/skins/' + f);
}

module.exports = { loadGameModules, makeLocalStorageShim, skinFiles };
