/* ============================================================
   TESTS/IMPROVEMENTS.TEST.JS — v9 «разные улучшения»
   1. Игровые часы: пауза честно останавливает время
      (elapsedSecondsOf — чистая функция + живое состояние).
   2. История отмены: сериализация в сейв и обратно.
   3. Статистика: победы по раскладкам (бейджи «✓ N»).
   4. themes.css: паритет переменных между всеми темами —
      регрессия после инцидента с «потерянной» --card-border.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { Game, Layouts, Storage } = loadGameModules();

// ============================================================
//  1. Игровые часы
// ============================================================

suite('Часы — elapsedSecondsOf (чистая функция)', () => {

  test('пауза (resumedAt = null) останавливает счёт', () => {
    assertEq(Game.elapsedSecondsOf(65000, null, 99999999), 65);
    assertEq(Game.elapsedSecondsOf(65000, null, 0), 65);
  });

  test('идущие часы: playedMs + (now − resumedAt)', () => {
    assertEq(Game.elapsedSecondsOf(30000, 1000000, 1030000), 60);
    assertEq(Game.elapsedSecondsOf(0, 1000000, 1000500), 0);
    assertEq(Game.elapsedSecondsOf(0, 1000000, 1000999), 0);
    assertEq(Game.elapsedSecondsOf(0, 1000000, 1010000), 10);
  });

  test('дробные секунды отбрасываются (floor от суммы)', () => {
    assertEq(Game.elapsedSecondsOf(1500, 2000, 2999), 2); // 2.499
    assertEq(Game.elapsedSecondsOf(1500, 2000, 3500), 3); // ровно 3.000
    assertEq(Game.elapsedSecondsOf(1500, 2000, 3499), 2); // 2.999
  });

  test('мусор в аргументах трактуется как ноль — не NaN', () => {
    assertEq(Game.elapsedSecondsOf('abc', null, 1000), 0);
    assertEq(Game.elapsedSecondsOf(undefined, undefined, undefined), 0);
    assertEq(Game.elapsedSecondsOf(NaN, 'x', 'y'), 0);
    assertEq(Game.elapsedSecondsOf(-5000, null, 100), 0);
  });

  test('отрицательный текущий отрезок игнорируется', () => {
    assertEq(Game.elapsedSecondsOf(5000, 10000, 9000), 5);
  });
});

suite('Часы — живое состояние (pause/resume/setElapsedMs)', () => {

  const layout = Layouts.getById('pyramid');

  test('новая партия: часы идут, накопленное время нулевое', () => {
    Game.newGame(layout, 777);
    const st = Game.getState();
    assertEq(st.playedMs, 0);
    assertOk(st.resumedAt !== null, 'resumedAt должен быть установлен');
    assertOk(!st.paused);
    assertOk(Game.getElapsedSeconds() >= 0);
  });

  test('pause() замораживает время', () => {
    Game.pause();
    const st = Game.getState();
    assertOk(st.paused, 'paused=true после pause()');
    assertEq(st.resumedAt, null, 'resumedAt снят');
    const t1 = Game.getElapsedSeconds();
    const t2 = Game.getElapsedSeconds();
    assertEq(t1, t2, 'время под паузой не течёт');
  });

  test('resume() запускает часы снова', () => {
    Game.resume();
    const st = Game.getState();
    assertOk(!st.paused);
    assertOk(st.resumedAt !== null);
    assertOk(Game.getElapsedMs() >= 0);
  });

  test('setElapsedMs задаёт накопленное время (сейв → продолжение)', () => {
    Game.setElapsedMs(120000);
    // Часы стоят (resumedAt = null) — время ровно 2 минуты
    assertEq(Game.getElapsedSeconds(), 120);
    Game.resume();
    assertOk(Game.getElapsedSeconds() >= 120, 'после resume время не откатывается');
  });

  test('мусор в setElapsedMs сбрасывает время в 0, а не ломает игру', () => {
    Game.setElapsedMs('мусор');
    assertOk(Game.getElapsedMs() >= 0);
    assertOk(Number.isFinite(Game.getElapsedMs()));
  });

  test('повторный pause()/resume() — идемпотентны', () => {
    Game.pause();
    Game.pause(); // второй вызов — no-op
    const st = Game.getState();
    assertEq(st.resumedAt, null);
    Game.resume();
    Game.resume(); // второй вызов — no-op
    assertOk(st.resumedAt !== null);
  });
});

// ============================================================
//  2. История отмены: сериализация для сейва
// ============================================================

suite('История отмены — serialize/deserialize', () => {

  const tiles = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const hist = [
    { tile1: tiles[0], tile2: tiles[3], scoreDelta: 15 },
    { tile1: tiles[2], tile2: tiles[1], scoreDelta: 12 },
  ];

  test('roundtrip сохраняет ссылки и бонус', () => {
    const ser = Game.serializeHistory(hist, tiles);
    assertEq(ser.length, 2);
    assertEq(ser[0].a, 0);
    assertEq(ser[0].b, 3);
    assertEq(ser[0].d, 15);
    assertEq(ser[1].a, 2);
    assertEq(ser[1].b, 1);
    const back = Game.deserializeHistory(ser, tiles);
    assertEq(back.length, 2);
    assertOk(back[0].tile1 === tiles[0], 'tile1 восстанавливается по ссылке');
    assertOk(back[0].tile2 === tiles[3], 'tile2 восстанавливается по ссылке');
    assertEq(back[1].scoreDelta, 12);
  });

  test('мусор фильтруется: строки, выход за границы, самопары', () => {
    const bad = [
      null,
      'мусор',
      { a: 'x', b: 1, d: 5 },       // не-индекс
      { a: 0, b: 99, d: 5 },        // выход за границу
      { a: -1, b: 2, d: 5 },        // отрицательный
      { a: 1, b: 1, d: 5 },         // самопара
      { a: 0.5, b: 2, d: 5 },       // дробный индекс
      { a: 0, b: 2 },               // без d — дефолт 10
    ];
    const back = Game.deserializeHistory(bad, tiles);
    assertEq(back.length, 1, 'выживает только валидная запись');
    assertOk(back[0].tile1 === tiles[0]);
    assertOk(back[0].tile2 === tiles[2]);
    assertEq(back[0].scoreDelta, 10);
  });

  test('не-массивы дают пустую историю', () => {
    assertEq(Game.deserializeHistory(null, tiles).length, 0);
    assertEq(Game.deserializeHistory('мусор', tiles).length, 0);
    assertEq(Game.deserializeHistory(undefined, undefined).length, 0);
    assertEq(Game.serializeHistory(null, tiles).length, 0);
  });

  test('живой цикл: матч → serialize → новая партия → restore → undo', () => {
    // Играем матч на маленькой раскладке и переносим историю в новую партию
    const row = {
      id: 'row-undo', name: 'Ряд-undo', width: 4, height: 1, layers: 1,
      tilesCount: 4,
      positions: [
        { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 },
      ],
    };
    Game.newGame(row, 42);
    // Подбираем свободные совпадающие фишки (края ряда)
    const free = Game.getFreeTiles();
    let matched = false;
    outer:
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const r = Game.selectTile(free[i]);
        if (r === 'selected' && Game.selectTile(free[j]) === 'matched') {
          matched = true;
          break outer;
        }
        Game.undo(); // не совпало — откат и следующая пара
      }
    }
    assertOk(matched, 'тест-приготовление: матч должен случиться');
    const st = Game.getState();
    assertEq(st.history.length, 1);

    // Сейв → новая партия с тем же сидом → восстановление
    const ser = Game.serializeHistory(st.history, st.tiles);
    Game.newGame(row, 42);
    Game.restoreHistory(ser);
    const st2 = Game.getState();
    assertEq(st2.history.length, 1, 'история восстановлена');
    assertOk(Game.undo(), 'undo работает после восстановления');
    assertEq(st2.history.length, 0);
    assertEq(st2.score, 0);
    assertOk(st2.tiles.every(t => !t.removed), 'фишки матча возвращены');
  });
});

// ============================================================
//  3. Статистика: победы по раскладкам
// ============================================================

suite('Storage — победы по раскладкам (бейджи «✓ N»)', () => {

  test('addResult копит победы per-layout в классике', () => {
    Storage.resetStats();
    Storage.addResult({ won: true, score: 100, time: 300, pairs: 10, layoutId: 'pyramid', mode: 'classic' });
    Storage.addResult({ won: true, score: 150, time: 200, pairs: 10, layoutId: 'pyramid', mode: 'classic' });
    Storage.addResult({ won: true, score: 90, time: 400, pairs: 8, layoutId: 'turtle', mode: 'classic' });
    const s = Storage.getStats();
    assertEq(s.layouts['pyramid'], 2);
    assertEq(s.layouts['turtle'], 1);
    assertEq(s.bestScore, 150);
    assertEq(s.bestTime, 200);
    assertEq(s.won, 3);
  });

  test('бесконечный режим не пишет в победы раскладок', () => {
    Storage.addResult({ won: true, score: 50, time: 100, pairs: 6, layoutId: 'pyramid', mode: 'endless' });
    assertEq(Storage.getStats().layouts['pyramid'], 2);
  });

  test('поражение не увеличивает счётчик раскладки', () => {
    Storage.addResult({ won: false, score: 10, time: 60, pairs: 2, layoutId: 'cross', mode: 'classic' });
    const s = Storage.getStats();
    assertEq(s.layouts['cross'], undefined);
    assertEq(s.played, 5, 'но в «Сыграно» партия входит');
  });

  test('легаси-статистика без поля layouts чинится на лету', () => {
    Storage.setStats({ played: 3, won: 1, bestScore: 40, bestTime: 120, totalPairs: 9 });
    Storage.addResult({ won: true, score: 60, time: 110, pairs: 9, layoutId: 'wall', mode: 'classic' });
    const s = Storage.getStats();
    assertEq(s.layouts['wall'], 1);
    assertEq(s.played, 4);
    assertEq(s.bestScore, 60);
  });

  test('resetStats обнуляет и победы раскладок', () => {
    Storage.resetStats();
    const s = Storage.getStats();
    assertEq(s.layouts, {});
    assertEq(s.played, 0);
  });
});

// ============================================================
//  4. themes.css — паритет переменных между темами
// ============================================================

suite('themes.css — паритет переменных (регрессия --card-border)', () => {

  const css = fs.readFileSync(
    path.join(__dirname, '..', 'css', 'themes.css'), 'utf8');

  const blocks = {};
  const re = /body\[data-theme="([a-z]+)"\]\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(css)) !== null) blocks[m[1]] = m[2];
  const themes = Object.keys(blocks);

  test('все четыре темы объявлены', () => {
    assertEq(themes.length, 4);
    ['traditional', 'jade', 'porcelain', 'night'].forEach(t =>
      assertOk(themes.includes(t), `нет темы ${t}`));
  });

  test('каждая тема определяет все переменные эталона (traditional)', () => {
    const ref = new Set(blocks.traditional.match(/--[\w-]+/g) || []);
    assertOk(ref.size > 30, 'эталон должен содержать полный набор переменных');
    themes.forEach(t => {
      const own = new Set(blocks[t].match(/--[\w-]+/g) || []);
      ref.forEach(v => assertOk(own.has(v), `тема «${t}»: нет переменной ${v}`));
    });
  });

  test('в ночную тему попали критичные для интерфейса переменные', () => {
    ['--card-border', '--tile-edge', '--btn-bg', '--card-bg',
     '--table-bg', '--text-main', '--accent-gold'].forEach(v =>
      assertOk(blocks.night.includes(v), `в night нет ${v}`));
  });

  test('превью ночной темы есть в main.css и index.html', () => {
    const mainCss = fs.readFileSync(
      path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
    const html = fs.readFileSync(
      path.join(__dirname, '..', 'index.html'), 'utf8');
    assertOk(mainCss.includes('.theme-preview-night'), 'нет превью в main.css');
    assertOk(html.includes('data-theme="night"'), 'нет карточки темы в index.html');
  });
});
