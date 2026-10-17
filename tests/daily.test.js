/* ============================================================
   TESTS/DAILY.TEST.JS — Daily Mahjong + оптимизация сейва (v21)
   Проверяем:
   - dailySeedFromDate(date): детерминирован, разные дни → разные seed
   - dailyLayoutIndex(seed, count): в диапазоне [0, count)
   - Storage.dailyTodayKey / addDailyResult / getDailyResult
   - newGame с daily seed — детерминированная партия (воспроизводимость)
   - saveCurrentGame НЕ пишет face (оптимизация localStorage)
   - restoreFace / restoreFaces: восстановление face из Tileset
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq, assertGte } = require('./runner');
const { loadGameModules } = require('./load');

const ROOT = path.join(__dirname, '..');

const { Game, Layouts, Tileset, Storage } = loadGameModules();

suite('Daily Mahjong — dailySeedFromDate (чистая функция)', () => {

  test('детерминирован: одна дата → один seed', () => {
    const date = new Date('2026-10-16T12:00:00Z');
    const a = Game.dailySeedFromDate(date);
    const b = Game.dailySeedFromDate(date);
    assertEq(a, b);
  });

  test('разные дни → разные seed', () => {
    const d1 = new Date('2026-10-16T12:00:00Z');
    const d2 = new Date('2026-10-17T12:00:00Z');
    assertOk(Game.dailySeedFromDate(d1) !== Game.dailySeedFromDate(d2),
      'два дня подряд должны давать разные seed');
  });

  test('разные годы в один день → разные seed', () => {
    const d1 = new Date('2025-01-01T12:00:00Z');
    const d2 = new Date('2026-01-01T12:00:00Z');
    assertOk(Game.dailySeedFromDate(d1) !== Game.dailySeedFromDate(d2),
      '1 января разных лет должны давать разные seed');
  });

  test('UTC: один день в разных часовых поясах → один seed', () => {
    // Москва UTC+3, Токио UTC+9. Если в Москве 16 октября 15:00,
    // в Токио 16 октября 21:00 — оба в один календарный день UTC.
    const moscow = new Date('2026-10-16T15:00:00Z');
    const tokyo = new Date('2026-10-16T21:00:00Z');
    assertEq(Game.dailySeedFromDate(moscow), Game.dailySeedFromDate(tokyo),
      'один календарный день UTC должен давать один seed');
  });

  test('мусор → текущая дата (не падает)', () => {
    const seed = Game.dailySeedFromDate(null);
    const todaySeed = Game.dailySeedFromDate(new Date());
    assertEq(seed, todaySeed);
  });

  test('возвращает целое число 0..2^32', () => {
    const seed = Game.dailySeedFromDate(new Date('2026-10-16T00:00:00Z'));
    assertOk(Number.isInteger(seed), `seed должен быть целым, получили ${typeof seed}`);
    assertOk(seed >= 0 && seed < 0x100000000, `seed вне диапазона: ${seed}`);
  });
});

suite('Daily Mahjong — dailyLayoutIndex (чистая функция)', () => {

  test('в диапазоне [0, layoutsCount)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const idx = Game.dailyLayoutIndex(seed, 16);
      assertOk(idx >= 0 && idx < 16, `seed=${seed} → idx=${idx} вне [0,16)`);
    }
  });

  test('детерминирован: один seed → один индекс', () => {
    const idx1 = Game.dailyLayoutIndex(42, 16);
    const idx2 = Game.dailyLayoutIndex(42, 16);
    assertEq(idx1, idx2);
  });

  test('разные seed могут давать один индекс (модуль)', () => {
    // seed 0 и 16 → индекс 0 (16 % 16)
    assertEq(Game.dailyLayoutIndex(0, 16), 0);
    assertEq(Game.dailyLayoutIndex(16, 16), 0);
  });

  test('мусор в layoutsCount → 0', () => {
    assertEq(Game.dailyLayoutIndex(42, 0), 0);
    assertEq(Game.dailyLayoutIndex(42, -1), 0);
    assertEq(Game.dailyLayoutIndex(42, 'мусор'), 0);
    assertEq(Game.dailyLayoutIndex(42, NaN), 0);
  });

  test('с реальным Layouts.all.length — индекс валиден', () => {
    const seed = Game.dailySeedFromDate(new Date());
    const idx = Game.dailyLayoutIndex(seed, Layouts.all.length);
    assertOk(idx >= 0 && idx < Layouts.all.length);
    assertOk(Layouts.all[idx], 'должна существовать раскладка по этому индексу');
  });
});

suite('Daily Mahjong — Storage (статистика по дням)', () => {

  test('dailyTodayKey — формат YYYY-MM-DD по UTC', () => {
    const date = new Date('2026-10-16T23:30:00Z');
    assertEq(Storage.dailyTodayKey(date), '2026-10-16');
  });

  test('addDailyResult — обновляет статистику за сегодня', () => {
    // Очистим daily-статистику для чистоты теста
    const s = Storage.getStats();
    s.daily = {};
    Storage.setStats(s);

    Storage.addDailyResult({ won: true, score: 100, time: 300 });
    const today = Storage.getDailyResult();
    assertOk(today, 'должна быть статистика за сегодня');
    assertEq(today.played, 1);
    assertEq(today.won, 1);
    assertEq(today.bestScore, 100);
    assertEq(today.bestTime, 300);
  });

  test('addDailyResult — лучший счёт и время обновляются', () => {
    const s = Storage.getStats();
    s.daily = {};
    Storage.setStats(s);

    Storage.addDailyResult({ won: true, score: 100, time: 300 });
    Storage.addDailyResult({ won: true, score: 150, time: 250 });
    Storage.addDailyResult({ won: true, score: 80,  time: 400 });

    const today = Storage.getDailyResult();
    assertEq(today.played, 3);
    assertEq(today.won, 3);
    assertEq(today.bestScore, 150, 'лучший счёт должен быть 150');
    assertEq(today.bestTime, 250, 'лучшее время должно быть 250');
  });

  test('addDailyResult — поражение не обновляет bestScore/bestTime', () => {
    const s = Storage.getStats();
    s.daily = {};
    Storage.setStats(s);

    Storage.addDailyResult({ won: false, score: 10, time: 60 });
    const today = Storage.getDailyResult();
    assertEq(today.played, 1);
    assertEq(today.won, 0);
    assertEq(today.bestScore, 0);
    assertEq(today.bestTime, null);
  });

  test('getDailyResult — null если сегодня не играл', () => {
    const s = Storage.getStats();
    s.daily = {};
    Storage.setStats(s);
    assertEq(Storage.getDailyResult(), null);
  });

  test('getDailyStreak — сколько разных дней игралось', () => {
    const s = Storage.getStats();
    s.daily = {
      '2026-10-14': { played: 1, won: 1, bestScore: 100, bestTime: 200 },
      '2026-10-15': { played: 2, won: 1, bestScore: 150, bestTime: 180 },
      '2026-10-16': { played: 1, won: 0, bestScore: 0, bestTime: null },
    };
    Storage.setStats(s);
    assertEq(Storage.getDailyStreak(), 3);
  });
});

suite('Daily Mahjong — детерминированная партия (воспроизводимость)', () => {

  test('один и тот же daily seed → одинаковая раздача', () => {
    const date = new Date('2026-10-16T12:00:00Z');
    const seed = Game.dailySeedFromDate(date);
    const idx = Game.dailyLayoutIndex(seed, Layouts.all.length);
    const layout = Layouts.all[idx];

    Game.newGame(layout, seed);
    const a = Game.getState().tiles.map(t => `${t.suit}:${t.rank}@${t.x},${t.y},${t.z}`).join('|');

    Game.newGame(layout, seed);
    const b = Game.getState().tiles.map(t => `${t.suit}:${t.rank}@${t.x},${t.y},${t.z}`).join('|');

    assertEq(a, b, 'та же дата → та же партия');
  });

  test('разные дни → разные раскладки ИЛИ разные раздачи', () => {
    // Хотя бы что-то отличается — либо раскладка, либо раздача
    const d1 = new Date('2026-10-16T12:00:00Z');
    const d2 = new Date('2026-10-17T12:00:00Z');
    const s1 = Game.dailySeedFromDate(d1);
    const s2 = Game.dailySeedFromDate(d2);

    const l1 = Layouts.all[Game.dailyLayoutIndex(s1, Layouts.all.length)];
    const l2 = Layouts.all[Game.dailyLayoutIndex(s2, Layouts.all.length)];

    // Если раскладка одна — раздача обязана быть разной
    if (l1.id === l2.id) {
      Game.newGame(l1, s1);
      const a = Game.getState().tiles.map(t => `${t.suit}:${t.rank}@${t.x},${t.y},${t.z}`).join('|');
      Game.newGame(l2, s2);
      const b = Game.getState().tiles.map(t => `${t.suit}:${t.rank}@${t.x},${t.y},${t.z}`).join('|');
      assertOk(a !== b, 'та же раскладка в разные дни — раздача должна быть разной');
    }
  });
});

suite('Оптимизация сейва — restoreFace / restoreFaces (v21-saveopt)', () => {

  test('restoreFace: фишка без face получает face из Tileset', () => {
    const tile = { id: 0, suit: 'dots', rank: 5, name: '5 точек' };
    const face = Game.restoreFace(tile);
    assertOk(typeof face === 'string' && face.length > 0, 'face должен быть непустой строкой');
    assertOk(face.startsWith('<svg'), 'face должен быть SVG');
  });

  test('restoreFace: фишка с face — оставляем как есть', () => {
    const tile = { id: 0, suit: 'dots', rank: 5, face: '<svg>existing</svg>' };
    const face = Game.restoreFace(tile);
    assertEq(face, '<svg>existing</svg>');
  });

  test('restoreFace: неизвестная suit/rank → пустая строка (не падает)', () => {
    const tile = { id: 0, suit: 'мусор', rank: 999 };
    const face = Game.restoreFace(tile);
    assertEq(face, '');
  });

  test('restoreFace: null/musor → пустая строка', () => {
    assertEq(Game.restoreFace(null), '');
    assertEq(Game.restoreFace(undefined), '');
    assertEq(Game.restoreFace('мусор'), '');
  });

  test('restoreFaces: восстанавливает face для всех фишек массива', () => {
    const tiles = [
      { id: 0, suit: 'dots', rank: 1 },
      { id: 1, suit: 'winds', rank: 'E' },
      { id: 2, suit: 'dragons', rank: 'R' },
    ];
    Game.restoreFaces(tiles);
    tiles.forEach(t => {
      assertOk(typeof t.face === 'string' && t.face.length > 0,
        `id=${t.id}: face должен быть восстановлен`);
      assertOk(t.face.startsWith('<svg'), `id=${t.id}: face должен быть SVG`);
    });
  });
});

suite('Оптимизация сейва — app.js НЕ пишет face в localStorage', () => {

  test('saveCurrentGame убирает face из tilesData', () => {
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    // Старый код писал face: t.face в tilesData — проверим что это убрано
    assertOk(!/face:\s*t\.face/.test(app),
      'face: t.face должен быть убран из saveCurrentGame');
    // Должен быть комментарий про оптимизацию
    assertOk(app.includes('v21-saveopt') || app.includes('face НЕ пишется'),
      'должен быть комментарий про оптимизацию сейва');
  });

  test('continueSaved вызывает restoreFaces после загрузки', () => {
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    assertOk(/Game\.restoreFaces\(state\.tiles\)/.test(app),
      'continueSaved должен вызывать Game.restoreFaces(state.tiles)');
  });

  test('game.js экспортирует restoreFace и restoreFaces', () => {
    const game = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
    assertOk(/restoreFace,/.test(game), 'restoreFace должен быть в exports');
    assertOk(/restoreFaces,/.test(game), 'restoreFaces должен быть в exports');
  });
});

suite('Daily Mahjong — интеграция с index.html и app.js', () => {

  test('index.html содержит кнопку #btn-daily', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assertOk(html.includes('id="btn-daily"'), 'должна быть кнопка #btn-daily');
    assertOk(html.includes('日'), 'должен быть иероглиф 日');
  });

  test('app.js содержит startDaily() и подключает кнопку', () => {
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    assertOk(/function\s+startDaily\s*\(/.test(app), 'startDaily должна быть определена');
    assertOk(/getElementById\(['"]btn-daily['"]\)/.test(app),
      'app.js должен подключать #btn-daily');
    assertOk(/startDaily/.test(app), 'startDaily должна вызываться');
  });

  test('game.js экспортирует dailySeedFromDate и dailyLayoutIndex', () => {
    const game = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
    assertOk(/dailySeedFromDate,/.test(game), 'dailySeedFromDate должен быть в exports');
    assertOk(/dailyLayoutIndex,/.test(game), 'dailyLayoutIndex должен быть в exports');
  });

  test('storage.js экспортирует Daily-функции', () => {
    const storage = fs.readFileSync(path.join(ROOT, 'js/storage.js'), 'utf8');
    assertOk(storage.includes('dailyTodayKey'), 'dailyTodayKey должен быть');
    assertOk(storage.includes('addDailyResult'), 'addDailyResult должен быть');
    assertOk(storage.includes('getDailyResult'), 'getDailyResult должен быть');
    assertOk(storage.includes('getDailyStreak'), 'getDailyStreak должен быть');
    assertOk(storage.includes('daily:'), 'поле daily должно быть в emptyStats');
  });

  test('handleWin пишет daily-результат для mode=daily', () => {
    const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    assertOk(/state\.mode === ['"]daily['"]/.test(app),
      'handleWin должен проверять mode === daily');
    assertOk(/Storage\.addDailyResult/.test(app),
      'handleWin должен вызывать Storage.addDailyResult');
  });
});
