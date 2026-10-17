/* ============================================================
   TESTS/COMBO.TEST.JS — v11: комбо-серия + достижения
   Чистые функции comboMultiplierFor/comboBonusOf, живая партия
   с серией матчей, каталог и логика достижений, хранение в
   Storage, разметка и стили.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq, assertGte, assertLte } = require('./runner');
const { loadGameModules } = require('./load');

const { Game, Layouts, Tileset, Storage, Achievements } = loadGameModules();

// ---------- Хелпер: первая свободная пара на доске ----------
function findFreePair() {
  const free = Game.getFreeTiles();
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (Tileset.isMatch(free[i], free[j])) return [free[i], free[j]];
    }
  }
  return null;
}

function matchOne(nowMs) {
  // Снять выделение, если осталось с прошлого шага — иначе
  // selectTile(pair[0]) вернёт 'deselected' и пара не соберётся
  const st = Game.getState();
  if (st.selected) Game.selectTile(st.selected);
  const pair = findFreePair();
  assertOk(pair, 'на доске должна быть свободная пара');
  Game.selectTile(pair[0]);
  return Game.selectTile(pair[1], nowMs);
}

// ============================================================
suite('Комбо — comboMultiplierFor (чистая)', () => {
  const W = Game.COMBO_WINDOW_MS;

  test('первый матч (lastMatchAt null) → ×1', () => {
    assertEq(Game.comboMultiplierFor(null, 1000, 5), 1);
    assertEq(Game.comboMultiplierFor(undefined, 1000, 5), 1);
  });

  test('второй матч в окне → ×2', () => {
    assertEq(Game.comboMultiplierFor(1000, 1000 + W, 1), 2);
  });

  test('ровно на границе окна ещё засчитывается', () => {
    assertEq(Game.comboMultiplierFor(1000, 1000 + W + 0, 1), 2);
  });

  test('через миллисекунду после окна → сброс на ×1', () => {
    assertEq(Game.comboMultiplierFor(1000, 1000 + W + 1, 1), 1);
  });

  test('серия растёт: ×3, ×7', () => {
    assertEq(Game.comboMultiplierFor(1000, 2000, 2), 3);
    assertEq(Game.comboMultiplierFor(1000, 2000, 6), 7);
  });

  test('потолок COMBO_MAX=8', () => {
    assertEq(Game.comboMultiplierFor(1000, 2000, 7), 8);
    assertEq(Game.comboMultiplierFor(1000, 2000, 99), 8);
  });

  test('мусор в lastMatchAt → ×1', () => {
    assertEq(Game.comboMultiplierFor('abc', 2000, 3), 1);
    assertEq(Game.comboMultiplierFor(NaN, 2000, 3), 1);
    assertEq(Game.comboMultiplierFor({}, 2000, 3), 1);
  });

  test('мусор в now → ×1', () => {
    assertEq(Game.comboMultiplierFor(1000, 'abc', 3), 1);
    assertEq(Game.comboMultiplierFor(1000, undefined, 3), 1);
  });

  test('перескок часов назад (diff < 0) → ×1', () => {
    assertEq(Game.comboMultiplierFor(5000, 4000, 3), 1);
  });

  test('мусор в prevCombo трактуется как ×1 база → в окне даст ×2', () => {
    assertEq(Game.comboMultiplierFor(1000, 2000, 'x'), 2);
    assertEq(Game.comboMultiplierFor(1000, 2000, NaN), 2);
    assertEq(Game.comboMultiplierFor(1000, 2000, 2.5), 2);
    assertEq(Game.comboMultiplierFor(1000, 2000, 0), 2);
  });

  test('кастомное окно (для тестов/будущих настроек)', () => {
    // diff = 31000-1000 = 30000 — ровно на границе окна 30с
    assertEq(Game.comboMultiplierFor(1000, 31000, 4, 30000), 5);
    assertEq(Game.comboMultiplierFor(1000, 31001, 4, 30000), 1);
  });

  test('мусор в windowMs → стандартные 5 секунд', () => {
    assertEq(Game.comboMultiplierFor(1000, 1000 + W, 1, 'abc'), 2);
    assertEq(Game.comboMultiplierFor(1000, 1000 + W + 1, 1, 'abc'), 1);
  });

  test('константы экспортированы: окно 5с, потолок 8', () => {
    assertEq(Game.COMBO_WINDOW_MS, 5000);
    assertEq(Game.COMBO_MAX, 8);
  });
});

// ============================================================
suite('Комбо — comboBonusOf (чистая)', () => {
  test('×1 → 0 бонуса', () => {
    assertEq(Game.comboBonusOf(1), 0);
  });

  test('×2 → +5, ×3 → +10, ×8 → +35', () => {
    assertEq(Game.comboBonusOf(2), 5);
    assertEq(Game.comboBonusOf(3), 10);
    assertEq(Game.comboBonusOf(8), 35);
  });

  test('мусор → 0', () => {
    assertEq(Game.comboBonusOf('abc'), 0);
    assertEq(Game.comboBonusOf(NaN), 0);
    assertEq(Game.comboBonusOf(undefined), 0);
    assertEq(Game.comboBonusOf(2.5), 0);
  });

  test('отрицательный и ноль → 0', () => {
    assertEq(Game.comboBonusOf(0), 0);
    assertEq(Game.comboBonusOf(-3), 0);
  });

  test('свыше потолка — как ×8', () => {
    assertEq(Game.comboBonusOf(99), 35);
  });
});

// ============================================================
suite('Комбо — живая партия', () => {
  test('матч подряд наращивает серию и бонус, пауза сбрасывает', () => {
    Game.newGame(Layouts.getById('pyramid'));
    const st = Game.getState();
    const t = st.playedMs + Date.now();

    // Первый матч: ×1, без комбо-бонуса
    assertEq(matchOne(t), 'matched');
    const h1 = st.history[st.history.length - 1];
    assertEq(h1.combo, 1);
    assertEq(h1.scoreDelta, 10 + Math.max(0, 5 - st.hintsUsed * 2 - st.shufflesUsed * 3));

    // Второй сразу: ×2, бонус +5
    assertEq(matchOne(t + 1000), 'matched');
    const h2 = st.history[st.history.length - 1];
    assertEq(h2.combo, 2);
    assertEq(h2.scoreDelta, 10 + Math.max(0, 5 - st.hintsUsed * 2 - st.shufflesUsed * 3) + 5);

    // Третий через 6 секунд: окно истекло → ×1, без бонуса
    assertEq(matchOne(t + 1000 + 6000), 'matched');
    const h3 = st.history[st.history.length - 1];
    assertEq(h3.combo, 1);
    assertEq(h3.scoreDelta, 10 + Math.max(0, 5 - st.hintsUsed * 2 - st.shufflesUsed * 3));
  });

  test('серия доходит до потолка ×8 и бонус 35', () => {
    Game.newGame(Layouts.getById('pyramid'));
    const st = Game.getState();
    const t = Date.now();
    // 9 матчей подряд → серия должна упереться в 8
    for (let i = 0; i < 9; i++) {
      assertEq(matchOne(t + i * 100), 'matched', 'матч №' + (i + 1));
    }
    assertEq(st.combo, 8);
    const last = st.history[st.history.length - 1];
    assertEq(last.combo, 8);
    assertEq(Game.comboBonusOf(last.combo), 35);
  });

  test('undo сбрасывает серию и считает отмены', () => {
    Game.newGame(Layouts.getById('pyramid'));
    const st = Game.getState();
    const t = Date.now();

    assertEq(matchOne(t), 'matched');
    assertEq(matchOne(t + 500), 'matched');
    assertEq(st.combo, 2);
    const scoreBefore = st.score;
    const pairsBefore = st.pairsFound;
    const lastDelta = st.history[st.history.length - 1].scoreDelta;

    assertOk(Game.undo(), 'undo должен сработать');
    assertEq(st.combo, 0);
    assertEq(st.lastMatchAt, null);
    assertEq(st.undosUsed, 1);
    assertEq(st.score, scoreBefore - lastDelta);
    assertEq(st.pairsFound, pairsBefore - 1);
    // undo съел комбо: следующий матч в окне снова ×1 → без бонуса
    assertEq(matchOne(t + 900), 'matched');
    assertEq(st.history[st.history.length - 1].combo, 1);
  });

  test('mismatch НЕ сбивает серию (только время решает)', () => {
    Game.newGame(Layouts.getById('pyramid'));
    const st = Game.getState();
    const t = Date.now();

    assertEq(matchOne(t), 'matched');
    // Не совпали: две свободные фишки подряд
    const free = Game.getFreeTiles();
    assertOk(free.length >= 2, 'нужны свободные фишки');
    Game.selectTile(free[0]);
    const r = Game.selectTile(free[1], t + 300);
    if (r === 'matched') {
      // редкий случай: они оказались парой — серия уже ×2
      assertEq(st.history[st.history.length - 1].combo, 2);
    } else {
      // серия жива: следующий матч в окне даст ×2
      assertEq(matchOne(t + 800), 'matched');
      assertEq(st.history[st.history.length - 1].combo, 2);
    }
  });

  test('новая партия начинает серию с нуля', () => {
    Game.newGame(Layouts.getById('pyramid'));
    const st = Game.getState();
    matchOne(Date.now());
    matchOne(Date.now() + 100);
    assertEq(st.combo, 2);
    Game.newGame(Layouts.getById('pyramid'));
    const fresh = Game.getState(); // новое состояние — не старая ссылка
    assertEq(fresh.combo, 0);
    assertEq(fresh.lastMatchAt, null);
    assertEq(fresh.undosUsed, 0);
  });
});

// ============================================================
suite('Достижения — каталог', () => {
  test('8 достижений, уникальные id, полные описания', () => {
    assertEq(Achievements.LIST.length, 8);
    const ids = new Set(Achievements.LIST.map(a => a.id));
    assertEq(ids.size, 8, 'id должны быть уникальны');
    Achievements.LIST.forEach(a => {
      assertOk(a.id && a.name && a.desc && a.icon,
        'неполное достижение: ' + JSON.stringify(a));
    });
  });

  test('getById: существующий → объект, мусор → null', () => {
    assertEq(Achievements.getById('first-win').name, 'Первая победа');
    assertEq(Achievements.getById('nope'), null);
    assertEq(Achievements.getById(undefined), null);
    assertEq(Achievements.getById(''), null);
  });
});

// ============================================================
suite('Достижения — evaluateWin', () => {
  const freshStats = () => ({
    played: 0, won: 1, bestScore: 0, bestTime: null,
    totalPairs: 72, layouts: {}, achievements: {},
  });
  const cleanEv = (over = {}) => ({
    hintsUsed: 0, shufflesUsed: 0, undosUsed: 0,
    timeSec: 120, layoutId: 'pyramid', mode: 'classic', endlessLevel: 0,
    ...over,
  });

  test('первая чистая быстрая победа → three at once', () => {
    const got = Achievements.evaluateWin(freshStats(), cleanEv());
    assertEq(got, ['first-win', 'clean-win', 'fast-win']);
  });

  test('нечистая партия (подсказка) → без clean-win', () => {
    const got = Achievements.evaluateWin(freshStats(), cleanEv({ hintsUsed: 1 }));
    assertEq(got, ['first-win', 'fast-win']);
  });

  test('перемешивание и отмена тоже ломают чистоту', () => {
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ shufflesUsed: 1 })).includes('clean-win'));
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ undosUsed: 2 })).includes('clean-win'));
  });

  test('граница «Молнии»: 300с — да, 301с — нет', () => {
    assertOk(Achievements.evaluateWin(freshStats(),
      cleanEv({ timeSec: 300 })).includes('fast-win'));
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ timeSec: 301 })).includes('fast-win'));
  });

  test('мусорное время не даёт «Молнию»', () => {
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ timeSec: 'abc' })).includes('fast-win'));
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ timeSec: 0 })).includes('fast-win'));
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ timeSec: -5 })).includes('fast-win'));
  });

  test('«Ветеран» на 10 победах, «Марафонец» на 25', () => {
    const s10 = { ...freshStats(), won: 10 };
    const got10 = Achievements.evaluateWin(s10, cleanEv());
    assertOk(got10.includes('veteran'), '10 побед → ветеран');
    assertOk(!got10.includes('marathon'), '10 побед — ещё не марафон');

    const s25 = { ...freshStats(), won: 25, achievements: { veteran: 1 } };
    const got25 = Achievements.evaluateWin(s25, cleanEv());
    assertOk(got25.includes('marathon'), '25 побед → марафонец');
    assertOk(!got25.includes('veteran'), 'ветеран уже был — не дублируется');
  });

  test('«Коллекционер»: 5 разных раскладок', () => {
    const four = { ...freshStats(),
      layouts: { pyramid: 1, turtle: 2, wall: 1, boat: 3 } };
    assertOk(!Achievements.evaluateWin(four, cleanEv()).includes('collector'));

    const five = { ...freshStats(),
      layouts: { pyramid: 1, turtle: 2, wall: 1, boat: 3, cross: 1 } };
    assertOk(Achievements.evaluateWin(five, cleanEv()).includes('collector'));
  });

  test('«Бесконечность»: третий уровень endless (индекс 2)', () => {
    assertOk(Achievements.evaluateWin(freshStats(),
      cleanEv({ mode: 'endless', endlessLevel: 2 })).includes('endless-3'));
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ mode: 'endless', endlessLevel: 1 })).includes('endless-3'));
    assertOk(!Achievements.evaluateWin(freshStats(),
      cleanEv({ mode: 'classic', endlessLevel: 5 })).includes('endless-3'));
  });

  test('уже разблокированные не приходят второй раз', () => {
    const s = freshStats();
    s.achievements = { 'first-win': 1, 'clean-win': 2, 'fast-win': 3 };
    assertEq(Achievements.evaluateWin(s, cleanEv()), []);
  });

  test('мусор в stats/ev не роняет — хотя бы first-win', () => {
    const got = Achievements.evaluateWin(null, undefined);
    assertOk(got.includes('first-win'));
    const got2 = Achievements.evaluateWin({ won: 1 }, 'garbage');
    assertOk(got2.includes('first-win'));
    assertOk(!got2.includes('clean-win'));
  });
});

// ============================================================
suite('Достижения — evaluateCombo', () => {
  const stats = () => ({ achievements: {} });

  test('×5 и выше → combo-5', () => {
    assertEq(Achievements.evaluateCombo(stats(), 5), ['combo-5']);
    assertEq(Achievements.evaluateCombo(stats(), 8), ['combo-5']);
  });

  test('ниже ×5 → пусто', () => {
    assertEq(Achievements.evaluateCombo(stats(), 4), []);
    assertEq(Achievements.evaluateCombo(stats(), 1), []);
    assertEq(Achievements.evaluateCombo(stats(), 0), []);
  });

  test('мусор → пусто', () => {
    assertEq(Achievements.evaluateCombo(stats(), 'x'), []);
    assertEq(Achievements.evaluateCombo(stats(), NaN), []);
    assertEq(Achievements.evaluateCombo(stats(), 2.5), []);
    assertEq(Achievements.evaluateCombo(null, 9), []);
  });

  test('уже разблокировано → не повторяется', () => {
    const s = { achievements: { 'combo-5': 123 } };
    assertEq(Achievements.evaluateCombo(s, 6), []);
  });

  test('порог COMBO_TARGET = 5', () => {
    assertEq(Achievements.COMBO_TARGET, 5);
  });
});

// ============================================================
suite('Storage — достижения', () => {
  test('пустая статистика содержит achievements {}', () => {
    Storage.resetStats();
    const s = Storage.getStats();
    assertOk(s.achievements && typeof s.achievements === 'object');
    assertEq(Object.keys(s.achievements).length, 0);
  });

  test('unlockAchievements пишет timestamp', () => {
    Storage.resetStats();
    const s = Storage.unlockAchievements(['first-win', 'combo-5']);
    assertOk(Number.isFinite(Number(s.achievements['first-win'])));
    assertOk(Number.isFinite(Number(s.achievements['combo-5'])));
    // пережила перечитывание из localStorage
    const again = Storage.getStats();
    assertEq(Number(again.achievements['first-win']), Number(s.achievements['first-win']));
  });

  test('повторный unlock не перезаписывает timestamp', () => {
    Storage.resetStats();
    Storage.setStats({ played: 0, won: 0, bestScore: 0, bestTime: null,
      totalPairs: 0, layouts: {}, achievements: { 'first-win': 12345 } });
    Storage.unlockAchievements(['first-win']);
    assertEq(Storage.getStats().achievements['first-win'], 12345);
  });

  test('мусор в списке молча пропускается', () => {
    Storage.resetStats();
    Storage.unlockAchievements([null, 42, '', { a: 1 }, 'ok-ach']);
    const s = Storage.getStats();
    assertEq(Object.keys(s.achievements), ['ok-ach']);
  });

  test('легаси-статистика без achievements чинится на лету', () => {
    Storage.setStats({ played: 3, won: 1, bestScore: 100, bestTime: 200,
      totalPairs: 72, layouts: {} }); // без achievements
    const s = Storage.getStats();
    assertOk(s.achievements && typeof s.achievements === 'object' &&
      !Array.isArray(s.achievements));
    // сломанные типы тоже чинятся
    Storage.setStats({ played: 3, won: 1, bestScore: 100, bestTime: 200,
      totalPairs: 72, layouts: {}, achievements: ['bad'] });
    assertOk(!Array.isArray(Storage.getStats().achievements));
  });

  test('resetStats стирает достижения', () => {
    Storage.resetStats();
    Storage.unlockAchievements(['first-win']);
    Storage.resetStats();
    assertEq(Storage.getStats().achievements, {});
  });
});

// ============================================================
suite('Комбо и достижения — разметка и стили', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'), 'utf8');
  const mainCss = fs.readFileSync(
    path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
  const tilesCss = fs.readFileSync(
    path.join(__dirname, '..', 'css', 'tiles.css'), 'utf8');

  test('модуль achievements.js подключён в index.html', () => {
    assertOk(html.includes('<script src="js/achievements.js">'),
      'нет тега подключения js/achievements.js');
  });

  test('на экране победы есть контейнер ачивок', () => {
    assertOk(html.includes('id="win-achievements"'),
      'нет #win-achievements на экране победы');
  });

  test('ачивки стилизованы (main.css)', () => {
    assertOk(mainCss.includes('.win-achievements'), 'нет .win-achievements');
    assertOk(mainCss.includes('.win-achievements[hidden]'), 'нет скрытия контейнера');
    assertOk(mainCss.includes('.win-ach-new'), 'нет подсветки новых');
    assertOk(mainCss.includes('.win-ach-tag'), 'нет метки «новое»');
    assertOk(mainCss.includes('ach-pop'), 'нет анимации ach-pop');
  });

  test('комбо-бейдж стилизован (tiles.css)', () => {
    assertOk(tilesCss.includes('.combo-float'), 'нет .combo-float');
    assertOk(tilesCss.includes('combo-float-up'), 'нет анимации combo-float-up');
  });
});
