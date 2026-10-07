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

  test('зарегистрированы все 8 раскладок', () => {
    assertEq(Layouts.all.length, 8);
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

  test('размеры сетки разумные (8–16 клеток)', () => {
    for (const l of Layouts.all) {
      assertOk(l.width >= 8 && l.width <= 16, `${l.id}: width=${l.width}`);
      assertOk(l.height >= 6 && l.height <= 14, `${l.id}: height=${l.height}`);
    }
  });
});
