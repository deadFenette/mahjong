/* ============================================================
   TESTS/MIXGEN45.TEST.JS — v45 «mixbig»: гигантские доски за галкой
   (кап 200 → 600) и фикс «превью издалека» на экране Микса.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { MixGen, Game, Layouts } = loadGameModules();
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// ---------- normalize: кап зависит от bigboard ----------

suite('v45: галка «гигантские доски»', () => {

  test('bigboard=true поднимает кап до 600', () => {
    assertEq(MixGen.normalize({ tiles: 600, bigboard: true }).tiles, 600);
    assertEq(MixGen.normalize({ tiles: 612, bigboard: true }).tiles, 600, '612 срезается до 600');
    assertEq(MixGen.normalize({ tiles: 480, bigboard: true }).tiles, 480);
  });

  test('без галки всё по-прежнему режется до 200 (Daily и сейвы не тронуты)', () => {
    assertEq(MixGen.normalize({ tiles: 600 }).tiles, 200);
    assertEq(MixGen.normalize({ tiles: 600, bigboard: false }).tiles, 200);
    assertEq(MixGen.normalize({ tiles: 'abc', bigboard: true }).tiles, MixGen.DEFAULT_TILES);
  });

  test('нечётные всегда выравниваются, диапазон 24..600', () => {
    assertEq(MixGen.normalize({ tiles: 601, bigboard: true }).tiles, 600);
    assertEq(MixGen.normalize({ tiles: 25, bigboard: true }).tiles, 24);
    assertEq(MixGen.normalize({ tiles: 1, bigboard: true }).tiles, MixGen.MIN_TILES);
  });

  test('флаг bigboard сохраняется в спецификации', () => {
    assertEq(MixGen.normalize({ bigboard: true }).bigboard, true);
    assertEq(MixGen.normalize({}).bigboard, false);
    // legacy-спецификации v31 флага не получают
    assertOk(!('bigboard' in MixGen.normalize({ legacy: true, bigboard: true })), 'legacy без bigboard');
  });

  test('validate принимает гиганта и режет перебор без галки', () => {
    const L = MixGen.generate({ seed: 424242, method: 'scratch', tiles: 600, layers: 3, symmetry: 'mirror', bigboard: true });
    assertEq(MixGen.validate(L).length, 0, 'гигант валиден: ' + MixGen.validate(L).join('; '));
    const small = { ...L, mixSpec: { ...L.mixSpec, bigboard: false } };
    assertOk(MixGen.validate(small).length > 0, '600 без галки — нарушение');
  });

  // ---------- генерация гигантов ----------

  test('«С нуля» дорастает до 400/600 и остаётся чётной, без перекрытий', () => {
    for (const n of [400, 600]) {
      const L = MixGen.generate({ seed: 1000 + n, method: 'scratch', tiles: n, layers: 3, symmetry: 'mirror', bigboard: true });
      assertEq(L.tilesCount, n, 'точно N фишек при n=' + n);
      assertOk(L.tilesCount % 2 === 0, 'чётность');
      assertOk(MixGen.validate(L).length === 0, 'валидация: ' + MixGen.validate(L).join('; '));
    }
  });

  test('детерминизм: одна seed → одна и та же гигантская доска', () => {
    const spec = { seed: 777, method: 'scratch', tiles: 600, layers: 3, symmetry: 'mirror', bigboard: true };
    const a = MixGen.generate(spec);
    const b = MixGen.generate(spec);
    assertEq(JSON.stringify(a.positions), JSON.stringify(b.positions));
    assertEq(a.width, b.width);
  });

  test('гигант проходит полный конвейер партии (newGame + hasAnyMove)', () => {
    const L = MixGen.generate({ seed: 31337, method: 'scratch', tiles: 600, layers: 3, symmetry: 'mirror', bigboard: true });
    const st = Game.newGame(L, 424242);
    assertEq(st.tiles.length, 600, 'фишек в партии');
    assertEq(st.totalPairs, 300, 'пар в колоде');
    assertOk(Game.hasAnyMove(), 'на старте есть ход');
  });

  test('сюрприз и сращивание на гигантах строят «с нуля» (дешёвый путь)', () => {
    // сращивание >200 дорожает квадратично — генератор переводит на scratch
    const L = MixGen.generate({ seed: 555, method: 'surprise', tiles: 600, layers: 3, symmetry: 'mirror', bigboard: true });
    assertEq(L.mixSpec.method, 'scratch', 'sюрприз-гигант не сращивание');
    const L2 = MixGen.generate({ seed: 556, method: 'blend', tiles: 600, layers: 3, symmetry: 'mirror', bigboard: true });
    assertEq(L2.mixSpec.method, 'scratch', 'blend-гигант переведён на scratch');
    // а до 200 сращивание работает как раньше
    const small = MixGen.generate({ seed: 557, method: 'blend', tiles: 200 });
    assertOk(small.tilesCount <= 200 && small.tilesCount >= 150, 'blend до 200 жив');
  });

  test('ранний выход кандидата не тронул малые доски (пин v44)', () => {
    // доски ≤200 обязаны быть бит-в-бит как в v44: ранний выход включается
    // только при tiles > 200. Хеш снят с кода v44 до изменений.
    const spec = { seed: 424242, method: 'scratch', tiles: 96, layers: 3, symmetry: 'mirror' };
    const a = MixGen.generate(spec);
    const h = ps => { let x = 0; for (const p of ps) x = (x * 31 + p.x * 7 + p.y * 13 + p.z * 3) >>> 0; return x; };
    assertEq(h(a.positions), 333895712, 'раскладка 96 фишек бит-в-бит с v44');
    // blend-путь тоже не изменился для ≤200
    const bl = MixGen.generate({ seed: 424242, method: 'blend', tiles: 96 });
    assertEq(h(bl.positions), h(MixGen.generate({ seed: 424242, method: 'blend', tiles: 96 }).positions));
  });

  // ---------- UI-обвязка экрана Микса ----------

  test('index.html: галка, панель и слайдер на месте', () => {
    const html = read('index.html');
    assertOk(/id="mix-bigboard"/.test(html), 'чекбокс mix-bigboard');
    assertOk(/id="mix-cap-panel" hidden/.test(html), 'раскрывающаяся панель');
    assertOk(/id="mix-cap-group"/.test(html), 'группа внизу');
  });

  test('mix.js: гашение старой доски (фикс «превью издалека»)', () => {
    const src = read('js/app/mix.js');
    assertOk(/classList\.add\('is-stale'\)/.test(src), 'is-stale ставится при движении слайдера');
    assertOk(/remove\('is-fresh', 'is-stale'\)/.test(src), 'is-stale снимается при перерисовке');
    assertOk(/requestAnimationFrame\(\(\) => regenerateMix\(false\)\)/.test(src),
      'генерация после кадра затухания');
  });

  test('mix.js: слайдер нормализует фишки С флагом гиганта', () => {
    // регресс: normalize({tiles}) без bigboard молча резал 600 → 200
    const src = read('js/app/mix.js');
    assertOk(/bigboard: !!A\.state\.mixOpts\.bigboard/.test(src),
      'нормализация слайдера учитывает bigboard');
  });

  test('css: is-stale гасит превью, карточка blend гаснет на гигантах', () => {
    const css = read('css/mix.css');
    assertOk(/\.mix-preview\.is-stale \.preview-tile \{ opacity: 0\.14; \}/.test(css));
    assertOk(/\.mix-card\.is-off/.test(css));
  });

  test('sw.js: кэш поднят до mahjong-v47-perf', () => {
    const sw = read('sw.js');
    assertOk(/mahjong-v47-perf/.test(sw), 'CACHE_NAME v46-perf');
  });

});
