/* ============================================================
   TESTS/MIXGEN.TEST.JS — Генератор раскладки для режима «Микс» (v31)
   Ловит: нечётное/огромное число фишек, перекрытия, фишки в воздухе,
   недетерминированность, нерешаемые доски, поломку сохранения.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { MixGen, Layouts, Game, Storage } = loadGameModules();
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const samePositions = (a, b) =>
  a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y && p.z === b[i].z);

suite('MixGen — ограничения на число фишек', () => {

  test('число фишек всегда чётное и в диапазоне 24..200', () => {
    for (const asked of [-5, 0, 1, 23, 25, 55, 97, 199, 200, 201, 400, 600, 5000, NaN, 'abc']) {
      const o = MixGen.normalize({ tiles: asked });
      assertEq(o.tiles % 2, 0, `нечётное для ${asked}`);
      assertOk(o.tiles >= MixGen.MIN_TILES && o.tiles <= MixGen.MAX_TILES, `вне диапазона для ${asked}: ${o.tiles}`);
    }
  });

  test('запрос 600+ фишек даёт не больше 200', () => {
    const l = MixGen.generate({ seed: 5, tiles: 640, method: 'scratch' });
    assertOk(l.tilesCount <= 200, 'раздулось: ' + l.tilesCount);
  });

  test('сгенерированная раскладка содержит ровно столько фишек, сколько просили', () => {
    for (const method of ['scratch', 'blend']) {
      for (const tiles of [24, 50, 96, 150, 200]) {
        const l = MixGen.generate({ seed: tiles * 31 + 7, method, tiles });
        assertEq(l.tilesCount, tiles, `${method} ${tiles}`);
        assertEq(l.positions.length, tiles);
      }
    }
  });

  test('слоёв не больше MAX_LAYERS даже при запросе 99', () => {
    const o = MixGen.normalize({ layers: 99 });
    assertEq(o.layers, MixGen.MAX_LAYERS);
  });
});

suite('MixGen — правила раскладки', () => {

  const combos = [];
  for (const method of ['scratch', 'blend']) {
    for (const symmetry of ['none', 'mirror', 'quad']) {
      for (const stagger of [false, true]) {
        for (const tiles of [24, 70, 120, 200]) {
          for (const layers of [1, 3, 5]) combos.push({ method, symmetry, stagger, tiles, layers });
        }
      }
    }
  }

  test(`${combos.length} комбинаций настроек: нет перекрытий, висящих фишек и выхода за границы`, () => {
    combos.forEach((c, i) => {
      const l = MixGen.generate({ ...c, seed: 1000 + i * 17 });
      const errs = MixGen.validate(l);
      assertEq(errs.length, 0, JSON.stringify(c) + ' → ' + errs.join('; '));
    });
  });

  test('любую сгенерированную доску можно разобрать парами до конца', () => {
    for (let i = 0; i < 40; i++) {
      const l = MixGen.generate({ seed: 777 + i * 13, method: 'surprise', tiles: 40 + (i % 8) * 20 });
      assertOk(MixGen.isDismantlable(l.positions, MixGen.makeRng(i + 1)), 'нерешаемая доска, seed ' + (777 + i * 13));
    }
  });

  test('«Из двух раскладок»: источники — две РАЗНЫЕ существующие раскладки', () => {
    for (let i = 0; i < 20; i++) {
      const l = MixGen.generate({ seed: 31 + i * 101, method: 'blend', tiles: 90 });
      assertEq(l.mixComponents.length, 2);
      assertOk(l.mixComponents[0] !== l.mixComponents[1], 'одинаковые источники');
      l.mixComponents.forEach(id => assertOk(Layouts.getById(id), 'нет раскладки ' + id));
    }
  });

  test('«С нуля» с симметрией «зеркало»: без подгонки форма зеркальна', () => {
    // Нечётная ширина сетки + нужное число фишек — ось проходит через клетки.
    // Допускаем отклонение у пары фишек (подгонка числа), но не больше.
    let symmetricEnough = 0;
    for (let i = 0; i < 20; i++) {
      const l = MixGen.generate({ seed: 4000 + i, method: 'scratch', symmetry: 'mirror', tiles: 96, layers: 3 });
      const W = l.width;
      const keys = new Set(l.positions.map(p => `${p.x},${p.y},${p.z}`));
      const unmatched = l.positions.filter(p => !keys.has(`${W - 1 - p.x},${p.y},${p.z}`)).length;
      if (unmatched <= 6) symmetricEnough++;
    }
    assertOk(symmetricEnough >= 14, 'зеркальность потеряна: ' + symmetricEnough + '/20');
  });

  test('«слои пирамидой»: у верхних слоёв дробные координаты', () => {
    const l = MixGen.generate({ seed: 91, method: 'scratch', stagger: true, tiles: 100, layers: 4, symmetry: 'quad' });
    assertOk(l.positions.some(p => p.z > 0 && (p.x % 1 !== 0 || p.y % 1 !== 0)), 'смещения нет');
  });
});

suite('MixGen — воспроизводимость', () => {

  test('одинаковые параметры и seed → одна и та же раскладка', () => {
    const o = { seed: 123456, method: 'scratch', symmetry: 'quad', tiles: 88, layers: 4, stagger: true };
    const a = MixGen.generate(o);
    const b = MixGen.generate({ ...o });
    assertEq(a.name, b.name);
    assertOk(samePositions(a.positions, b.positions), 'раскладки различаются');
  });

  test('разные seed → разные раскладки', () => {
    const seen = new Set();
    for (let s = 1; s <= 30; s++) {
      const l = MixGen.generate({ seed: s * 99991, method: 'scratch', tiles: 96 });
      seen.add(JSON.stringify(l.positions));
    }
    assertOk(seen.size >= 28, 'слишком много повторов: ' + seen.size + '/30');
  });

  test('mixSpec из раскладки воссоздаёт её точно (так работает «Продолжить»)', () => {
    for (const method of ['surprise', 'blend', 'scratch']) {
      const l = MixGen.generate({ seed: 8080 + method.length, method, tiles: 110 });
      assertOk(l.mixSpec, 'нет mixSpec');
      assertOk(['blend', 'scratch'].includes(l.mixSpec.method), '«Сюрприз» должен быть решён в спецификации');
      const again = MixGen.generate(JSON.parse(JSON.stringify(l.mixSpec)));
      assertOk(samePositions(l.positions, again.positions), 'раскладка не воспроизвелась: ' + method);
      assertEq(again.id, l.id);
    }
  });

  test('«Сюрприз» умеет давать оба способа', () => {
    const methods = new Set();
    for (let s = 1; s < 60; s++) methods.add(MixGen.generate({ seed: s * 7, method: 'surprise', tiles: 40 }).mixSpec.method);
    assertEq(methods.size, 2);
  });
});

suite('MixGen — интеграция с игрой', () => {

  test('Game.newGame раздаёт сгенерированную раскладку: все фишки парами', () => {
    const l = MixGen.generate({ seed: 2468, method: 'scratch', tiles: 130, layers: 4, symmetry: 'quad' });
    const st = Game.newGame(l, 99);
    assertEq(st.tiles.length, l.tilesCount);
    assertEq(st.totalPairs, l.tilesCount / 2);
    assertEq(st.solution.length, l.tilesCount / 2);
    assertOk(Game.hasAnyMove(), 'на свежей доске нет ходов');
  });

  test('сгенерированная раскладка помечена как микс', () => {
    const l = MixGen.generate({ seed: 5 });
    assertEq(l.isMix, true);
    assertOk(/^mix_/.test(l.id));
    assertOk(l.width >= 3 && l.height >= 3);
  });

  test('победа на сгенерированном миксе не засоряет «коллекцию раскладок»', () => {
    const l = MixGen.generate({ seed: 31337 });
    const stats = Storage.addResult({ won: true, score: 100, time: 60, pairs: 10, layoutId: l.id, mode: 'mix' });
    assertEq(Object.keys(stats.layouts || {}).filter(k => /^mix_/.test(k)).length, 0);
  });
});

suite('MixGen — подключение в приложении', () => {

  test('index.html: скрипт mixgen.js после layouts.js и до app.js', () => {
    const html = read('index.html');
    const iL = html.indexOf('<script src="js/layouts.js">');
    const iM = html.indexOf('<script src="js/mixgen.js">');
    const iA = html.indexOf('<script src="js/app/core.js">');
    assertOk(iL > 0 && iM > iL && iA > iM, 'неверный порядок скриптов');
  });

  test('index.html: экран «Микс» со всеми элементами управления', () => {
    const html = read('index.html');
    for (const id of ['screen-mix', 'mix-preview', 'mix-tiles', 'mix-layers', 'mix-stagger',
      'mix-methods', 'mix-symmetry', 'mix-reroll', 'mix-play', 'back-mix']) {
      assertOk(html.includes(`id="${id}"`), 'нет #' + id);
    }
  });

  test('карточки «Микса» не используют класс .skin-card (на нём висит смена скина фишек)', () => {
    const html = read('index.html');
    const a = html.indexOf('id="screen-mix"');
    const seg = html.slice(a, html.indexOf('</section>', a));
    assertOk(!/skin-card/.test(seg), 'класс skin-card внутри экрана микса');
  });

  test('sw.js кэширует mixgen.js', () => {
    assertOk(read('sw.js').includes('./js/mixgen.js'));
  });

  test('app.js: экран mix зарегистрирован, сохранение хранит mixSpec', () => {
    const app = require('./sources').appSource();
    assertOk(/screens: \[[^\]]*'mix'/.test(app), 'экран mix не в списке screens');
    assertOk(/mixSpec: state\.layout\.mixSpec/.test(app), 'mixSpec не пишется в сейв');
    assertOk(/MixGen\.generate\(saved\.mixSpec\)/.test(app), 'сейв микса не восстанавливается');
  });
});
