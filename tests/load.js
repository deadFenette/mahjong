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
  // v19-skins: tileset-classic.js + tileset-ornate.js + tileset.js (фасад)
  const files = [
    'js/tileset-classic.js',
    'js/tileset-ornate.js',
    'js/tileset.js',
    'js/layouts.js',
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
  // v19: добавлены TilesetClassic и TilesetOrnate для тестов скинов
  source += `\n;globalThis.__modules = { Tileset, TilesetClassic, TilesetOrnate, Layouts, Music, Storage, Achievements, Tutorial, Render, Game };`;

  vm.runInContext(source, context, { filename: 'mahjong-bundle.js' });
  return context.__modules;
}

module.exports = { loadGameModules, makeLocalStorageShim };
