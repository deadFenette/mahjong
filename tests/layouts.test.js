/* ============================================================
   TESTS/LAYOUTS.TEST.JS — Проверка геометрии всех раскладок
   Ловит: нечётное число фишек, дубли позиций, выход за границы,
   «висящие в воздухе» верхние слои, битую структуру слоёв.
   ============================================================ */

'use strict';

const { suite, test, assertOk, assertEq, assertGte } = require('./runner');
const { loadGameModules } = require('./load');

const { Layouts } = loadGameModules();

suite('Layouts — структура раскладок', () => {

  test('зарегистрированы все 28 раскладок (8 базовых + 8 канонических v18 + 4 v22 + 8 v28)', () => {
    assertEq(Layouts.all.length, 28);
  });

  test('у каждой раскладки есть имя и описание', () => {
    for (const l of Layouts.all) {
      assertOk(l.id && l.name && l.description, `нет метаданных: ${l.id}`);
      assertOk(['easy', 'normal', 'hard'].includes(l.difficulty), `битая сложность: ${l.id}`);
    }
  });

  for (const layout of Layouts.all) {
    suite(`«${layout.name}»`, () => {

      test('число фишек чётное (убираются парами) и достаточное', () => {
        assertEq(layout.tilesCount % 2, 0, 'нечётное число фишек — игра не решаема');
        assertGte(layout.tilesCount, 60, 'слишком мало фишек');
      });

      test('positions.length совпадает с tilesCount', () => {
        assertEq(layout.positions.length, layout.tilesCount);
      });

      test('нет двух фишек в одной позиции (x,y,z)', () => {
        const keys = new Set();
        for (const p of layout.positions) {
          const k = `${p.x},${p.y},${p.z}`;
          assertOk(!keys.has(k), `дубликат позиции ${k}`);
          keys.add(k);
        }
      });

      test('координаты внутри границ сетки', () => {
        for (const p of layout.positions) {
          assertOk(p.x >= 0 && p.x < layout.width,
            `x=${p.x} вне [0, ${layout.width})`);
          assertOk(p.y >= 0 && p.y < layout.height,
            `y=${p.y} вне [0, ${layout.height})`);
          assertOk(p.z >= 0 && p.z < layout.layers,
            `z=${p.z} вне [0, ${layout.layers})`);
        }
      });

      test('layers = max(z) + 1', () => {
        const maxZ = layout.positions.reduce((m, p) => Math.max(m, p.z), 0);
        assertEq(layout.layers, maxZ + 1);
      });

      test('каждая верхняя фишка опирается на нижний слой', () => {
        // Фишка z>0 обязана иметь под собой фишку z-1
        // (допуск ±0.5 — стандартный «полукирпичный» сдвиг).
        const lower = layout.positions.filter(p => p.z >= 1);
        for (const p of lower) {
          const support = layout.positions.some(q =>
            q.z === p.z - 1 &&
            Math.abs(q.x - p.x) <= 0.5 + 1e-9 &&
            Math.abs(q.y - p.y) <= 0.5 + 1e-9);
          assertOk(support,
            `фишка (${p.x},${p.y},${p.z}) висит в воздухе`);
        }
      });

      test('getById находит раскладку', () => {
        assertEq(Layouts.getById(layout.id).id, layout.id);
      });
    });
  }

  test('размеры сетки разумные (обычные 8–16, миксы до 32)', () => {
    for (const l of Layouts.all) {
      // Обычные раскладки: 8–16 по ширине, 6–14 по высоте
      // Миксы (isMix=true): до 32 по ширине (две раскладки бок о бок)
      const maxW = l.isMix ? 32 : 16;
      assertOk(l.width >= 8 && l.width <= maxW, `${l.id}: width=${l.width} > ${maxW}`);
      assertOk(l.height >= 6 && l.height <= 14, `${l.id}: height=${l.height} > 14`);
    }
  });
});

suite('Layouts — генератор миксов (v22)', () => {

  test('combineLayouts комбинирует 2 раскладки', () => {
    const a = Layouts.getById('pyramid');
    const b = Layouts.getById('star');
    const mix = Layouts.combineLayouts(a, b, { gap: 2 });
    assertOk(mix, 'микс должен быть создан');
    assertEq(mix.isMix, true);
    assertEq(mix.tilesCount, a.tilesCount + b.tilesCount);
    assertEq(mix.width, a.width + 2 + b.width);
    assertOk(mix.mixComponents.includes('pyramid'));
    assertOk(mix.mixComponents.includes('star'));
  });

  test('combineLayouts: чётное число фишек', () => {
    // Если A+B нечётное — добавляем 2 фишки в зазор
    const a = Layouts.getById('pyramid');  // 120
    const b = Layouts.getById('boat');     // 128
    const mix = Layouts.combineLayouts(a, b, { gap: 2 });
    assertEq(mix.tilesCount % 2, 0, 'микс должен иметь чётное число фишек');
  });

  test('combineLayouts: нет коллизий позиций', () => {
    const a = Layouts.getById('turtle');
    const b = Layouts.getById('flower');
    const mix = Layouts.combineLayouts(a, b, { gap: 2 });
    const keys = new Set();
    let collisions = 0;
    for (const p of mix.positions) {
      const k = `${p.x},${p.y},${p.z}`;
      if (keys.has(k)) collisions++;
      keys.add(k);
    }
    assertEq(collisions, 0, 'не должно быть коллизий позиций в миксе');
  });

  test('pickMixPair: 2 разные раскладки', () => {
    const [a, b] = Layouts.pickMixPair(42);
    assertOk(a && b, 'должны быть 2 раскладки');
    assertOk(a.id !== b.id, 'раскладки должны быть разные');
  });

  test('pickMixPair: детерминирован', () => {
    const [a1, b1] = Layouts.pickMixPair(100);
    const [a2, b2] = Layouts.pickMixPair(100);
    assertEq(a1.id, a2.id);
    assertEq(b1.id, b2.id);
  });

  test('getMixFromSeed: валидный микс', () => {
    const mix = Layouts.getMixFromSeed(999);
    assertOk(mix);
    assertEq(mix.isMix, true);
    assertEq(mix.tilesCount % 2, 0);
    assertOk(mix.width >= 8);
  });
});
