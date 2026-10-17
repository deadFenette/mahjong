/* ============================================================
   TESTS/SKINS.TEST.JS — Переключатель скинов фишек (v19-skins)
   Проверяем:
   - Tileset экспортирует tiles/groups/isMatch/activeSkinId/SKINS
   - classic-скин: 144 фишки, валидные SVG, нет золотых рамок
   - ornate-скин: 144 фишки, валидные SVG, есть золотые рамки
   - оба скина дают одинаковые имена/id (правила совпадения не зависят от скина)
   - isMatch работает одинаково для обоих скинов
   - Storage.getSetting('tileSkin', ...) → 'classic' по умолчанию
   - tileset.js фасад: при localStorage 'mj_setting_tileSkin=ornate'
     отдаёт ornate, иначе classic
   - index.html: переключатель .skin-card в настройках
   - app.js: applyTileSkin() + skin-card listeners
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq, assertGte } = require('./runner');
const { loadGameModules } = require('./load');

const ROOT = path.join(__dirname, '..');

// Загружаем с ПУСТЫМ localStorage (seedStorage=true даёт пустой shim)
// → tileSkin = 'classic' по умолчанию
const { Tileset, TilesetClassic, TilesetOrnate, Storage } = loadGameModules();

// Хелпер: загрузить с конкретным tileSkin в localStorage
function loadWithSkin(skin) {
  // loadGameModules принимает { seedStorage: true/false }; нам нужно
  // предварительно положить 'mj_setting_tileSkin' в localStorage.
  // Перехватываем через свой шим.
  const vm = require('vm');
  const fs2 = require('fs');
  const storage = new Map();
  if (skin) storage.set('mj_setting_tileSkin', skin);

  const sandbox = {
    console, Math, Date, JSON, Set, Map, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => Date.now() },
    localStorage: {
      getItem: (k) => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => { storage.set(String(k), String(v)); },
      removeItem: (k) => { storage.delete(k); },
      clear: () => { storage.clear(); },
      key: (i) => Array.from(storage.keys())[i] ?? null,
      get length() { return storage.size; },
    },
  };
  const context = vm.createContext(sandbox);
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
    source += fs2.readFileSync(path.join(ROOT, f), 'utf8');
  }
  source += `\n;globalThis.__modules = { Tileset, TilesetClassic, TilesetOrnate, Storage };`;
  vm.runInContext(source, context, { filename: 'mahjong-skin-bundle.js' });
  return context.__modules;
}

suite('Tileset — фасад скинов', () => {

  test('Tileset экспортирует нужный API', () => {
    assertOk(Array.isArray(Tileset.tiles), 'tiles должен быть массивом');
    assertOk(typeof Tileset.isMatch === 'function');
    assertOk(typeof Tileset.activeSkinId === 'function');
    assertOk(Array.isArray(Tileset.SKINS));
    assertGte(Tileset.SKINS.length, 2, 'должно быть ≥2 скина');
  });

  test('SKINS содержит classic и ornate', () => {
    const ids = Tileset.SKINS.map(s => s.id);
    assertOk(ids.includes('classic'), 'classic должен быть в SKINS');
    assertOk(ids.includes('ornate'), 'ornate должен быть в SKINS');
  });

  test('по умолчанию (пустой localStorage) activeSkinId = classic', () => {
    assertEq(Tileset.activeSkinId(), 'classic');
  });

  test('Storage.getSetting("tileSkin") → "classic" по умолчанию', () => {
    assertEq(Storage.getSetting('tileSkin', 'classic'), 'classic');
  });
});

suite('TilesetClassic — классический скин', () => {

  test('144 фишки', () => {
    assertEq(TilesetClassic.tiles.length, 144);
  });

  test('все лица — валидные SVG', () => {
    for (const t of TilesetClassic.tiles) {
      assertOk(t.face.startsWith('<svg'), `id=${t.id}: нет <svg>`);
      assertOk(t.face.includes('viewBox='), `id=${t.id}: нет viewBox`);
      assertOk(t.face.trim().endsWith('</svg>'), `id=${t.id}: нет </svg>`);
    }
  });

  test('каждый url(#x) имеет парный id="x"', () => {
    const idRe = /id="([^"]+)"/g;
    const urlRe = /url\(#([^)]+)\)/g;
    for (const t of TilesetClassic.tiles) {
      const ids = new Set();
      let m;
      while ((m = idRe.exec(t.face))) ids.add(m[1]);
      while ((m = urlRe.exec(t.face))) {
        assertOk(ids.has(m[1]), `id=${t.id}: url(#${m[1]}) без определения`);
      }
    }
  });

  test('classic-скин НЕ имеет золотых рамок-гравюр', () => {
    // В classic нет decorFrame → нет 'goldFrame' / 'goldInner' / 'жемчужин'
    let hasGold = false;
    for (const t of TilesetClassic.tiles) {
      if (t.face.includes('goldFrame') || t.face.includes('goldInner')) {
        hasGold = true; break;
      }
    }
    assertOk(!hasGold, 'classic-скин не должен содержать goldFrame/goldInner');
  });
});

suite('TilesetOrnate — богатый скин', () => {

  test('144 фишки', () => {
    assertEq(TilesetOrnate.tiles.length, 144);
  });

  test('все лица — валидные SVG', () => {
    for (const t of TilesetOrnate.tiles) {
      assertOk(t.face.startsWith('<svg'), `id=${t.id}: нет <svg>`);
      assertOk(t.face.includes('viewBox='), `id=${t.id}: нет viewBox`);
      assertOk(t.face.trim().endsWith('</svg>'), `id=${t.id}: нет </svg>`);
    }
  });

  test('каждый url(#x) имеет парный id="x"', () => {
    const idRe = /id="([^"]+)"/g;
    const urlRe = /url\(#([^)]+)\)/g;
    for (const t of TilesetOrnate.tiles) {
      const ids = new Set();
      let m;
      while ((m = idRe.exec(t.face))) ids.add(m[1]);
      while ((m = urlRe.exec(t.face))) {
        assertOk(ids.has(m[1]), `id=${t.id}: url(#${m[1]}) без определения`);
      }
    }
  });

  test('ornate-скин ИМЕЕТ золотые рамки-гравюры', () => {
    let hasGold = false;
    for (const t of TilesetOrnate.tiles) {
      if (t.face.includes('goldFrame') || t.face.includes('goldInner')) {
        hasGold = true; break;
      }
    }
    assertOk(hasGold, 'ornate-скин должен содержать goldFrame/goldInner');
  });
});

suite('Скины — согласованность', () => {

  test('оба скина дают одинаковые id и имена фишек', () => {
    // Правила совпадения не зависят от скина → масти/ранги/имена одинаковые
    assertEq(TilesetClassic.tiles.length, TilesetOrnate.tiles.length);
    for (let i = 0; i < TilesetClassic.tiles.length; i++) {
      const c = TilesetClassic.tiles[i];
      const o = TilesetOrnate.tiles[i];
      assertEq(c.id, o.id, `позиция ${i}: id не совпадает`);
      assertEq(c.suit, o.suit, `позиция ${i}: suit не совпадает`);
      assertEq(c.rank, o.rank, `позиция ${i}: rank не совпадает`);
      assertEq(c.name, o.name, `позиция ${i}: name не совпадает`);
    }
  });

  test('isMatch работает одинаково для обоих скинов', () => {
    const c = TilesetClassic.tiles;
    const o = TilesetOrnate.tiles;
    // Проверяем несколько пар
    for (const pair of [[0, 1], [0, 2], [0, 36], [0, 72]]) {
      const [i, j] = pair;
      assertEq(TilesetClassic.isMatch(c[i], c[j]),
               TilesetOrnate.isMatch(o[i], o[j]));
    }
  });

  test('лица РАЗНЫЕ — это действительно разные скины', () => {
    // Хоть бы одна фишка отличается
    let anyDiff = false;
    for (let i = 0; i < TilesetClassic.tiles.length; i++) {
      if (TilesetClassic.tiles[i].face !== TilesetOrnate.tiles[i].face) {
        anyDiff = true; break;
      }
    }
    assertOk(anyDiff, 'лица должны отличаться между скинами');
  });
});

suite('Tileset фасад — переключение по localStorage', () => {

  test('localStorage "mj_setting_tileSkin=ornate" → activeSkinId=ornate', () => {
    const m = loadWithSkin('ornate');
    assertEq(m.Tileset.activeSkinId(), 'ornate');
    // И tiles содержат goldFrame (значит, выбран ornate)
    let hasGold = false;
    for (const t of m.Tileset.tiles) {
      if (t.face.includes('goldFrame')) { hasGold = true; break; }
    }
    assertOk(hasGold, 'tiles должны быть ornate');
  });

  test('localStorage без tileSkin → activeSkinId=classic', () => {
    const m = loadWithSkin(null);
    assertEq(m.Tileset.activeSkinId(), 'classic');
    // И tiles НЕ содержат goldFrame (значит, выбран classic)
    let hasGold = false;
    for (const t of m.Tileset.tiles) {
      if (t.face.includes('goldFrame')) { hasGold = true; break; }
    }
    assertOk(!hasGold, 'tiles должны быть classic');
  });

  test('мусор в localStorage → fallback на classic', () => {
    const m = loadWithSkin('garbage');
    assertEq(m.Tileset.activeSkinId(), 'classic');
  });
});

suite('Скины — интеграция с index.html и app.js', () => {

  test('index.html содержит переключатель .skin-card', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assertOk(html.includes('class="skin-card"'), 'должна быть кнопка .skin-card');
    assertOk(html.includes('data-skin="classic"'), 'должен быть data-skin="classic"');
    assertOk(html.includes('data-skin="ornate"'), 'должен быть data-skin="ornate"');
  });

  test('index.html подключает tileset-classic.js и tileset-ornate.js ДО tileset.js', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const iClassic = html.indexOf('js/tileset-classic.js');
    const iOrnate = html.indexOf('js/tileset-ornate.js');
    const iFacade = html.indexOf('js/tileset.js');
    assertOk(iClassic > -1 && iOrnate > -1 && iFacade > -1);
    assertOk(iClassic < iFacade, 'classic должен быть ДО facade');
    assertOk(iOrnate < iFacade, 'ornate должен быть ДО facade');
  });

  test('app.js содержит applyTileSkin() и skin-card listeners', () => {
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    assertOk(/function\s+applyTileSkin\s*\(/.test(app), 'applyTileSkin должна быть определена');
    assertOk(/querySelectorAll\(['"]\.skin-card['"]\)/.test(app), 'app.js должен слушать .skin-card');
    assertOk(/applyTileSkin\(/.test(app), 'applyTileSkin должна вызываться');
  });

  test('storage.js содержит tileSkin в DEFAULT_SETTINGS', () => {
    const storage = fs.readFileSync(path.join(ROOT, 'js/storage.js'), 'utf8');
    assertOk(storage.includes("tileSkin: 'classic'"), 'tileSkin должен быть в DEFAULT_SETTINGS');
  });

  test('sw.js кэширует tileset-classic.js и tileset-ornate.js', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assertOk(sw.includes('js/tileset-classic.js'), 'sw должен кэшировать tileset-classic.js');
    assertOk(sw.includes('js/tileset-ornate.js'), 'sw должен кэшировать tileset-ornate.js');
    // v22: кэш поднят до mahjong-v25-sounds (4 новые раскладки + миксы)
    assertOk(/mahjong-v25-sounds/.test(sw), 'кэш должен быть mahjong-v25-sounds');
  });
});
