/* ============================================================
   TESTS/ANIMATIONS.TEST.JS — Математика анимаций (v8)

   Новые анимации v8 опираются на две чистые функции Render:
   dealDelayFor — задержка каскадной раздачи (волна идёт по
   доске, а не «всё разом»), flyVectorFor — вектор сближения
   пары при матче (фишки притягиваются друг к другу, но
   не дальше безопасного максимума).
   ============================================================ */

'use strict';

const { suite, test, assertOk, assertEq, assertGt, assertGte, assertLte } = require('./runner');
const { loadGameModules } = require('./load');

const { Render } = loadGameModules();

suite('Раздача: задержка каскада dealDelayFor', () => {

  test('фишка в левом-верхнем углу (0,0,0) стартует немедленно', () => {
    assertEq(Render.dealDelayFor({ x: 0, y: 0, z: 0 }), 0);
  });

  test('задержка монотонно растёт по сетке и по слоям', () => {
    const d1 = Render.dealDelayFor({ x: 0, y: 0, z: 0 });
    const d2 = Render.dealDelayFor({ x: 2, y: 1, z: 0 });
    const d3 = Render.dealDelayFor({ x: 4, y: 3, z: 2 });
    assertOk(d1 < d2 && d2 < d3, `ожидалась монотонность: ${d1} < ${d2} < ${d3}`);
  });

  test('верхние слои приезжают позже нижних в той же точке', () => {
    const bottom = Render.dealDelayFor({ x: 3, y: 3, z: 0 });
    const top = Render.dealDelayFor({ x: 3, y: 3, z: 2 });
    assertGt(top, bottom, 'слой z=2 должен приземляться позже z=0');
  });

  test('огромные координаты обрезаются потолком задержки', () => {
    assertEq(Render.dealDelayFor({ x: 9999, y: 9999, z: 99 }), Render.DEAL_MAX_DELAY);
    // и потолок разумный: партия не должна ждать минутами
    assertLte(Render.DEAL_MAX_DELAY, 2000);
  });

  test('мусорные координаты трактуются как 0 — никакого NaN', () => {
    assertEq(Render.dealDelayFor(null), 0);
    assertEq(Render.dealDelayFor({ x: 'abc', y: NaN, z: undefined }), 0);
    assertOk(Number.isFinite(Render.dealDelayFor({ x: Infinity })), 'Infinity должен давать конечную задержку');
  });

  test('быстрый режим (undo) заметно короче обычного', () => {
    const tile = { x: 12, y: 8, z: 3 };
    const normal = Render.dealDelayFor(tile);
    const fast = Render.dealDelayFor(tile, { stepXY: 5, stepZ: 22, maxDelay: 240 });
    assertOk(fast < normal, `fast ${fast} должен быть быстрее normal ${normal}`);
    assertLte(fast, 240);
  });

  test('кастомные шаги влияют на результат предсказуемо', () => {
    assertEq(Render.dealDelayFor({ x: 1, y: 0, z: 0 }, { stepXY: 100, stepZ: 0 }), 100);
    assertEq(Render.dealDelayFor({ x: 0, y: 0, z: 2 }, { stepXY: 0, stepZ: 50 }), 100);
  });
});

suite('Матч: вектор сближения flyVectorFor', () => {

  test('фишки тянутся ДРУГ К ДРУГУ (знаки направлены внутрь пары)', () => {
    const v = Render.flyVectorFor({ left: 0, top: 0 }, { left: 100, top: 0 }, { pull: 0.2 });
    assertGt(v.a.dx, 0, 'левая фишка должна смещаться вправо');
    assertOk(v.b.dx < 0, `правая фишка должна смещаться влево, получено dx=${v.b.dx}`);
  });

  test('вектора симметричны: смещение B = зеркальное A', () => {
    const v = Render.flyVectorFor({ left: 10, top: 30 }, { left: 210, top: 90 }, { pull: 0.25 });
    assertEq(v.a.dx, -v.b.dx);
    assertEq(v.a.dy, -v.b.dy);
    assertEq(v.a.dx, 50); // (210-10)*0.25
    assertEq(v.a.dy, 15); // (90-30)*0.25
  });

  test('совпадающие позиции — нулевой вектор (ничего не слипается)', () => {
    const v = Render.flyVectorFor({ left: 50, top: 70 }, { left: 50, top: 70 });
    assertEq(v.a.dx, 0);
    assertEq(v.a.dy, 0);
    assertEq(v.b.dx, 0);
    assertEq(v.b.dy, 0);
  });

  test('потолок смещения соблюдается — соседи-близнецы не влетают друг в друга', () => {
    const maxShift = 20;
    const v = Render.flyVectorFor(
      { left: 0, top: 0 },
      { left: 1000, top: 0 },
      { pull: 0.5, maxShift }
    );
    assertLte(v.a.dx, maxShift, `dx=${v.a.dx} превысил потолок ${maxShift}`);
    assertGte(v.a.dx, 1, 'но и нулевым быть не должен — pair притягивается');
  });

  test('потолок работает и по диагонали (норма вектора)', () => {
    const maxShift = 10;
    const v = Render.flyVectorFor(
      { left: 0, top: 0 },
      { left: 300, top: 400 },
      { pull: 0.5, maxShift }
    );
    const norm = Math.sqrt(v.a.dx * v.a.dx + v.a.dy * v.a.dy);
    assertLte(norm, maxShift + 1, 'норма вектора с округлением не должна заметно превышать потолок');
  });

  test('мусорные позиции не дают NaN', () => {
    const v = Render.flyVectorFor(null, { left: 'x', top: NaN });
    assertEq(v.a.dx, 0);
    assertEq(v.a.dy, 0);
    assertOk(Number.isFinite(v.b.dx) && Number.isFinite(v.b.dy));
  });

  test('умолчательный pull умеренный (не половина расстояния)', () => {
    const v = Render.flyVectorFor({ left: 0, top: 0 }, { left: 100, top: 0 });
    assertLte(Math.abs(v.a.dx), 40, 'по умолчанию сближение мягкое');
    assertGt(Math.abs(v.a.dx), 0);
  });
});

suite('Санитария: константы и экспорт анимаций', () => {

  test('новые функции экспортированы из Render', () => {
    assertOk(typeof Render.playDealAnimation === 'function');
    assertOk(typeof Render.spawnScoreFloat === 'function');
    assertOk(typeof Render.spawnSparks === 'function');
    assertOk(typeof Render.pulseTable === 'function');
    assertOk(typeof Render.dealDelayFor === 'function');
    assertOk(typeof Render.flyVectorFor === 'function');
  });

  test('шаги каскада положительны и конечны', () => {
    assertOk(Render.DEAL_STEP_XY > 0 && Number.isFinite(Render.DEAL_STEP_XY));
    assertOk(Render.DEAL_STEP_Z > 0 && Number.isFinite(Render.DEAL_STEP_Z));
  });

  test('задержки по всей доске «Крест» (202 фишки) остаются в разумных пределах', () => {
    const maxDelay = Render.dealDelayFor({ x: 30, y: 30, z: 6 });
    assertLte(maxDelay, Render.DEAL_MAX_DELAY);
    assertGte(maxDelay, 0);
  });
});
