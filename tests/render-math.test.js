/* ============================================================
   TESTS/RENDER-MATH.TEST.JS — Чистая математика масштабирования
   Главные проверки бага v4:
   - «Максимальные» заполняют доступную область ПОЛНОСТЬЮ и
     НИКОГДА не вылезают за неё (раньше фишки stuck на 80px,
     а «Большие» вызывали прокрутку);
   - чем больше экран, тем больше фишки;
   - зазор и подъём слоёв растут вместе с фишками;
   - z-index слоёв монотонный, дробные y не конфликтуют.
   ============================================================ */

'use strict';

const { suite, test, assertOk, assertEq, assertGt, assertGte, assertLte } = require('./runner');
const { loadGameModules } = require('./load');

const { Render, Layouts } = loadGameModules();

const VIEWPORTS = [
  { name: '4K 2560×1440', w: 2560, h: 1440 },
  { name: 'FullHD 1920×1080', w: 1920, h: 1080 },
  { name: 'ноут 1366×768', w: 1366, h: 768 },
  { name: 'планшет 1024×768', w: 1024, h: 768 },
  { name: 'маленькое окно 800×600', w: 800, h: 600 },
  { name: 'телефон 390×844', w: 390, h: 844 },
];

function fit(layout, vp, sizeScale) {
  return Render.computeFit({
    stageW: vp.w, stageH: vp.h,
    cols: layout.width, rows: layout.height, layers: layout.layers,
    sizeScale,
  });
}

suite('computeFit — баг v4 починен: масштаб по экрану', () => {

  for (const layout of Layouts.all) {
    for (const vp of VIEWPORTS) {
      test(`«${layout.name}» @ ${vp.name}: максимум не вылезает за экран`, () => {
        const f = fit(layout, vp, 1.0);
        // Если сработал защитный минимум — экран безнадёжно мал,
        // скролл допустим. Иначе доска обязана влезть.
        if (f.w > 30) {
          assertLte(f.boardW, vp.w, `ширина доски ${f.boardW} > экрана ${vp.w}`);
          assertLte(f.boardH, vp.h, `высота доски ${f.boardH} > экрана ${vp.h}`);
        }
      });

      test(`«${layout.name}» @ ${vp.name}: максимум ЗАПОЛНЯЕТ экран`, () => {
        const f = fit(layout, vp, 1.0);
        if (f.w <= 30 || f.w >= 260) return; // клампы — не наш случай
        // Хотя бы одно измерение заполнено почти целиком
        const fillW = f.boardW / vp.w;
        const fillH = f.boardH / vp.h;
        assertGt(Math.max(fillW, fillH), 0.9,
          `доска занимает лишь ${Math.round(Math.max(fillW, fillH) * 100)}% экрана`);
      });

      test(`«${layout.name}» @ ${vp.name}: small < medium < large`, () => {
        const s = fit(layout, vp, Render.sizeScaleFor('small'));
        const m = fit(layout, vp, Render.sizeScaleFor('medium'));
        const l = fit(layout, vp, Render.sizeScaleFor('large'));
        assertLte(s.w, m.w, 'small крупнее medium');
        assertLte(m.w, l.w, 'medium крупнее large');
      });
    }
  }

  test('на большом экране фишки крупнее, чем на маленьком', () => {
    const pyramid = Layouts.getById('pyramid');
    const big = fit(pyramid, { w: 1920, h: 1080 }, 1.0);
    const small = fit(pyramid, { w: 800, h: 600 }, 1.0);
    assertGt(big.w, small.w, 'размер фишки не зависит от экрана — регрессия v4');
  });

  test('регрессия v4: на FullHD фишки — истинный максимум, а не застрявший минимум', () => {
    // v4: фишки застревали на ~38–44px (замер от стола + лимит 80px).
    // Истинный максимум для 8 рядов на 1080p ≈ 86px ширины (120px высоты):
    // 8 рядов × 1.4 + зазоры + подъём слоёв ≈ 12.4 ширины фишки на высоту.
    const pyramid = Layouts.getById('pyramid');
    const f = fit(pyramid, { w: 1920, h: 1080 }, 1.0);
    assertGt(f.w, 70, `фишка ${f.w}px — «максимум» не дотягивает до истинного`);
    // И обязательно крупнее «застрявшего» размера v4
    assertGt(f.w, Math.ceil(44 * 1.05), `фишка ${f.w}px — почти как сломанный v4`);
  });

  test('пропорция фишки 1:1.4 сохраняется', () => {
    for (const layout of Layouts.all) {
      const f = fit(layout, { w: 1440, h: 900 }, 1.0);
      assertEq(f.h, Math.round(f.w * 1.4), `${layout.id}: битая пропорция`);
    }
  });

  test('зазор и подъём слоёв растут вместе с фишками', () => {
    const pyramid = Layouts.getById('pyramid');
    const small = fit(pyramid, { w: 800, h: 600 }, 0.7);
    const big = fit(pyramid, { w: 2560, h: 1440 }, 1.0);
    assertGt(big.gap, small.gap, 'зазор не масштабируется — слои слипнутся');
    assertGt(big.zLift, small.zLift, 'подъём не масштабируется — слои слипнутся');
  });

  test('подъём слоя пропорционален высоте фишки (~7.5%)', () => {
    const f = fit(Layouts.getById('turtle'), { w: 1920, h: 1080 }, 1.0);
    assertOk(Math.abs(f.zLift - f.h * 0.075) <= 1.5,
      `zLift=${f.zLift} при высоте ${f.h}`);
  });

  test('отступы стола разумные при любом размере', () => {
    for (const layout of Layouts.all) {
      for (const vp of VIEWPORTS) {
        const f = fit(layout, vp, 1.0);
        assertGte(f.tablePad, 10, 'стол слился с фишками');
        assertLte(f.tablePad, 80, 'стол съел весь экран');
      }
    }
  });

  test('нулевые/битые входы не ломают расчёт', () => {
    const f = Render.computeFit({
      stageW: 0, stageH: 0, cols: 8, rows: 8, layers: 4,
    });
    assertEq(f.w, 28, 'минимальный защитный размер');
  });

  test('неизвестная настройка размера трактуется как максимум', () => {
    assertEq(Render.sizeScaleFor('huge'), 1.0);
    assertEq(Render.sizeScaleFor(undefined), 1.0);
    assertEq(Render.sizeScaleFor('large'), 1.0);
    assertEq(Render.sizeScaleFor('medium'), 0.85);
    assertEq(Render.sizeScaleFor('small'), 0.7);
  });
});

suite('tilePosition / zIndexOf — наложения слоёв', () => {

  const SIZE = { w: 100, h: 140, gap: 5, zLift: 10 };

  test('позиция считается по сетке с учётом зазора и подъёма', () => {
    const p = Render.tilePosition({ x: 3, y: 2, z: 1 }, SIZE);
    assertEq(p.left, Math.round(3 * 105));
    assertEq(p.top, Math.round(2 * 145 - 1 * 10));
  });

  test('дробные координаты округляются до целых пикселей (нет размытия)', () => {
    const p = Render.tilePosition({ x: 2.5, y: 4.5, z: 2 }, SIZE);
    assertEq(p.left, Math.round(2.5 * 105));
    assertEq(p.top, Math.round(4.5 * 145 - 20));
    assertEq(p.left % 1, 0);
    assertEq(p.top % 1, 0);
  });

  test('слой выше — всегда z-index выше (главный приоритет)', () => {
    for (let z = 0; z < 5; z++) {
      const bottom = Render.zIndexOf({ x: 0, y: 99, z });
      const top = Render.zIndexOf({ x: 99, y: 0, z: z + 1 });
      assertLte(bottom, top, `z=${z} должен быть под z=${z + 1}`);
    }
  });

  test('внутри слоя нижние ряды перекрывают верхние', () => {
    assertGt(
      Render.zIndexOf({ x: 0, y: 5, z: 1 }),
      Render.zIndexOf({ x: 0, y: 4, z: 1 })
    );
  });

  test('полуцелый ряд не конфликтует с целыми (y×2)', () => {
    const half = Render.zIndexOf({ x: 0, y: 2.5, z: 1 });
    const whole2 = Render.zIndexOf({ x: 0, y: 2, z: 1 });
    const whole3 = Render.zIndexOf({ x: 0, y: 3, z: 1 });
    assertGt(half, whole2, 'y=2.5 должен быть выше y=2');
    assertLte(half, whole3, 'y=2.5 должен быть не выше y=3');
    assertOk(half !== whole2 && half !== whole3, 'коллизия z-index');
  });

  test('верхний слой перекрывает нижний в одной и той же ячейке', () => {
    // Фишка z=1 лежит ровно на фишке z=0 той же ячейки —
    // её z-index обязан быть больше, иначе слой «провалится»
    const under = Render.tilePosition({ x: 4, y: 3, z: 0 }, SIZE);
    const over = Render.tilePosition({ x: 4, y: 3, z: 1 }, SIZE);
    assertGt(over.zIndex, under.zIndex, 'слой провалился под нижний');
    assertGt(under.top, over.top, 'верхний слой должен визуально подниматься');
  });
});
