/* ============================================================
   TESTS/TILESET.TEST.JS — Проверка набора фишек и правил совпадения
   Ловит: битые SVG-лица, несбалансированный набор, ошибки isMatch,
   несамосогласованные градиенты (url(#id) без id="id").
   ============================================================ */

'use strict';

const { suite, test, assertOk, assertEq, assertGte, assertLte } = require('./runner');
const { loadGameModules } = require('./load');

const { Tileset } = loadGameModules();

suite('Tileset — состав набора', () => {

  test('ровно 144 фишки по канону', () => {
    assertEq(Tileset.tiles.length, 144);
  });

  test('мастные фишки — ровно 4 копии каждая (цветы/сезоны — по одной)', () => {
    const counts = new Map();
    for (const t of Tileset.tiles) {
      const k = `${t.suit}/${t.rank}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    for (const [k, n] of counts) {
      const suit = k.split('/')[0];
      if (suit === 'flowers' || suit === 'seasons') {
        assertEq(n, 1, `${k}: цветы/сезоны существуют в единственном экземпляре`);
      } else {
        assertEq(n, 4, `${k}: должно быть ровно 4 копии`);
      }
    }
  });

  test('цветы и сезоны — по одному экземпляру (4 вида)', () => {
    const flowers = Tileset.tiles.filter(t => t.suit === 'flowers');
    const seasons = Tileset.tiles.filter(t => t.suit === 'seasons');
    assertEq(flowers.length, 4);
    assertEq(seasons.length, 4);
    assertEq(new Set(flowers.map(f => f.rank)).size, 4, 'ранги цветов повторяются');
    assertEq(new Set(seasons.map(s => s.rank)).size, 4, 'ранги сезонов повторяются');
  });

  test('id фишек уникальны', () => {
    const ids = new Set(Tileset.tiles.map(t => t.id));
    assertEq(ids.size, Tileset.tiles.length);
  });

  test('у каждой фишки есть человекочитаемое имя', () => {
    for (const t of Tileset.tiles) {
      assertOk(typeof t.name === 'string' && t.name.length > 0, `id=${t.id} без имени`);
    }
  });
});

suite('Tileset — SVG-лица фишек', () => {

  test('лицо — корректная обёртка <svg viewBox>', () => {
    for (const t of Tileset.tiles) {
      const f = t.face;
      assertOk(f.startsWith('<svg'), `id=${t.id}: не начинается с <svg>`);
      assertOk(f.includes('viewBox='), `id=${t.id}: нет viewBox`);
      assertOk(f.includes('class="tile-face-svg"'), `id=${t.id}: нет класса`);
      assertOk(f.trim().endsWith('</svg>'), `id=${t.id}: не закрывается </svg>`);
    }
  });

  test('лица не содержат мусора (undefined, NaN, [object)', () => {
    for (const t of Tileset.tiles) {
      for (const bad of ['undefined', 'NaN', '[object']) {
        assertOk(!t.face.includes(bad), `id=${t.id}: содержит ${bad}`);
      }
    }
  });

  test('каждый url(#x) имеет парный id="x" в том же лице', () => {
    // Иначе градиент разрешится в чужой/несуществующий элемент
    const idRe = /id="([^"]+)"/g;
    const urlRe = /url\(#([^)]+)\)/g;
    for (const t of Tileset.tiles) {
      const ids = new Set();
      let m;
      while ((m = idRe.exec(t.face))) ids.add(m[1]);
      while ((m = urlRe.exec(t.face))) {
        assertOk(ids.has(m[1]), `id=${t.id}: url(#${m[1]}) без определения`);
      }
    }
  });

  test('текстовые лица используют подключённый шрифт', () => {
    for (const t of Tileset.tiles) {
      if (!t.face.includes('<text')) continue;
      assertOk(t.face.includes('font-family'),
        `id=${t.id}: <text> без font-family`);
    }
  });
});

suite('Tileset — правила совпадения isMatch', () => {

  const bySR = (suit, rank) =>
    Tileset.tiles.filter(t => t.suit === suit && t.rank === rank);

  test('одинаковые масть+ранг — совпадение', () => {
    const [a, b] = bySR('dots', 5);
    assertOk(Tileset.isMatch(a, b));
  });

  test('одна и та же фишка с собой — НЕ совпадение', () => {
    const a = bySR('dots', 5)[0];
    assertOk(!Tileset.isMatch(a, a));
  });

  test('разные ранги одного мастя — не совпадение', () => {
    assertOk(!Tileset.isMatch(bySR('dots', 2)[0], bySR('dots', 3)[0]));
  });

  test('разные масти — не совпадение', () => {
    assertOk(!Tileset.isMatch(bySR('dots', 2)[0], bySR('bamboo', 2)[0]));
  });

  test('ветры: одинаковые совпадают, разные нет', () => {
    assertOk(Tileset.isMatch(bySR('winds', 'E')[0], bySR('winds', 'E')[1]));
    assertOk(!Tileset.isMatch(bySR('winds', 'E')[0], bySR('winds', 'S')[0]));
  });

  test('драконы: одинаковые совпадают, разные нет', () => {
    assertOk(Tileset.isMatch(bySR('dragons', 'R')[0], bySR('dragons', 'R')[1]));
    assertOk(!Tileset.isMatch(bySR('dragons', 'R')[0], bySR('dragons', 'G')[0]));
  });

  test('любой цветок совпадает с любым цветком', () => {
    const flowers = Tileset.tiles.filter(t => t.suit === 'flowers');
    for (let i = 0; i < flowers.length; i++) {
      for (let j = i + 1; j < flowers.length; j++) {
        assertOk(Tileset.isMatch(flowers[i], flowers[j]),
          `цветы ${i}/${j} должны совпадать`);
      }
    }
    assertOk(!Tileset.isMatch(flowers[0], Tileset.tiles[0]));
  });

  test('любой сезон совпадает с любым сезоном', () => {
    const seasons = Tileset.tiles.filter(t => t.suit === 'seasons');
    for (let i = 0; i < seasons.length; i++) {
      for (let j = i + 1; j < seasons.length; j++) {
        assertOk(Tileset.isMatch(seasons[i], seasons[j]),
          `сезоны ${i}/${j} должны совпадать`);
      }
    }
  });

  test('null-аргументы безопасны', () => {
    assertOk(!Tileset.isMatch(null, Tileset.tiles[0]));
    assertOk(!Tileset.isMatch(Tileset.tiles[0], null));
    assertOk(!Tileset.isMatch(null, null));
  });
});
