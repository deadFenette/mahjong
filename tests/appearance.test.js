/* ============================================================
   TESTS/APPEARANCE.TEST.JS — Оформление: прозрачность фишек (v6)

   Главный регрессионный баг v5: у закрытых фишек был жёстко
   прописан opacity 0.88 — сквозь них просвечивали нижние слои,
   «не ясно кто и где». В v6 фишки по умолчанию ПЛОТНЫЕ
   (alpha = 1), а прозрачность настраивается слайдером
   «Прозрачность фишек» (0–50%) и применяется через
   CSS-переменную --tile-blocked-alpha.
   ============================================================ */

'use strict';

const { suite, test, assertOk, assertEq, assertAlmostEq, assertGte, assertLte, assertThrows } = require('./runner');
const { loadGameModules } = require('./load');

const { Render, Storage } = loadGameModules();

suite('Прозрачность: чистая математика clampTransparency', () => {

  test('0% и 50% — границы диапазона проходят как есть', () => {
    assertEq(Render.clampTransparency(0), 0);
    assertEq(Render.clampTransparency(50), 50);
  });

  test('значения внутри диапазона не искажаются', () => {
    assertEq(Render.clampTransparency(15), 15);
    assertEq(Render.clampTransparency(35), 35);
  });

  test('выше 50% — обрезается до 50 (фишки не могут стать призраками)', () => {
    assertEq(Render.clampTransparency(60), 50);
    assertEq(Render.clampTransparency(100), 50);
    assertEq(Render.clampTransparency(100500), 50);
  });

  test('отрицательные — обрезаются до 0', () => {
    assertEq(Render.clampTransparency(-5), 0);
    assertEq(Render.clampTransparency(-100), 0);
  });

  test('строки из localStorage понимаются («25» → 25)', () => {
    assertEq(Render.clampTransparency('25'), 25);
    assertEq(Render.clampTransparency('0'), 0);
    assertEq(Render.clampTransparency('50'), 50);
  });

  test('мусор трактуется как «плотные фишки» (0%)', () => {
    assertEq(Render.clampTransparency('abc'), 0);
    assertEq(Render.clampTransparency(NaN), 0);
    assertEq(Render.clampTransparency(undefined), 0);
    assertEq(Render.clampTransparency(null), 0);
    assertEq(Render.clampTransparency(''), 0);
  });

  test('дробные значения округляются до целого процента', () => {
    assertEq(Render.clampTransparency(24.4), 24);
    assertEq(Render.clampTransparency(24.6), 25);
  });
});

suite('Прозрачность: alpha закрытых фишек blockedAlphaFor', () => {

  test('по умолчанию (0%) фишки ПОЛНОСТЬЮ непрозрачны — регрессия v5', () => {
    // v5: opacity 0.88 — сквозь слои просвечивало. Теперь 0% → alpha 1.
    assertEq(Render.blockedAlphaFor(0), 1);
  });

  test('шкала: 25% → 0.75, 50% → 0.5', () => {
    assertAlmostEq(Render.blockedAlphaFor(25), 0.75, 1e-9);
    assertAlmostEq(Render.blockedAlphaFor(50), 0.5, 1e-9);
  });

  test('alpha никогда не выходит из диапазона [0.5 … 1]', () => {
    for (const pct of [-100, 0, 10, 30, 50, 80, 1000, 'abc']) {
      const a = Render.blockedAlphaFor(pct);
      assertGte(a, 0.5, `alpha ${a} при ${pct}% — слишком прозрачные`);
      assertLte(a, 1, `alpha ${a} при ${pct}% — больше единицы`);
    }
  });

  test('мусорный ввод даёт непрозрачные фишки', () => {
    assertEq(Render.blockedAlphaFor('мусор'), 1);
    assertEq(Render.blockedAlphaFor(NaN), 1);
  });
});

suite('Прозрачность: константы и хранение настройки', () => {

  test('диапазон слайдера — [0 … 50]', () => {
    assertEq(Render.TRANSPARENCY_MIN, 0);
    assertEq(Render.TRANSPARENCY_MAX, 50);
  });

  test('настройка по умолчанию — 0% (плотные фишки, для слабовидящих)', () => {
    assertEq(Storage.getSetting('tileTransparency', 0), 0);
  });

  test('настройка сохраняется и читается обратно', () => {
    Storage.setSetting('tileTransparency', 30);
    assertEq(Storage.getSetting('tileTransparency', 0), '30');
    // И корректно проходит через клампер (строка → число)
    assertEq(Render.clampTransparency(Storage.getSetting('tileTransparency', 0)), 30);
    assertAlmostEq(Render.blockedAlphaFor(Storage.getSetting('tileTransparency', 0)), 0.7, 1e-9);
  });

  test('полный цикл: слайдер → хранение → alpha', () => {
    Storage.setSetting('tileTransparency', Render.clampTransparency(45));
    const pct = Render.clampTransparency(Storage.getSetting('tileTransparency', 0));
    assertEq(pct, 45);
    assertAlmostEq(Render.blockedAlphaFor(pct), 0.55, 1e-9);
  });

  test('перезапись значения работает', () => {
    Storage.setSetting('tileTransparency', 40);
    Storage.setSetting('tileTransparency', 10);
    assertEq(Render.clampTransparency(Storage.getSetting('tileTransparency', 0)), 10);
  });
});
