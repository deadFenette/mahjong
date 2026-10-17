/* ============================================================
   TESTS/DEAL.TEST.JS — Раздача и перемешивание (v14)
   Баги пользователя:
   1) «в тупике всегда ровно одна пара для хода» — перемешивание
      брало первую же случайную расстановку с одним ходом, а
      Date.now() в качестве зерна давал одинаковые «случайные»
      расстановки в одну миллисекунду;
   2) «фишки ультра рандом» — колода не резалась на пары, в
      маленьких раскладках оставались фишки без пары.
   Теперь доска строится из настоящих пар и решаема по построению.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { Game, Layouts, Tileset } = loadGameModules();
const ROOT = path.join(__dirname, '..');

function keyOf(t) {
  return (t.suit === 'flowers' || t.suit === 'seasons') ? t.suit : t.suit + ':' + t.rank;
}

// Проигрываем «решение» по настоящим правилам игры (isFree/isMatch)
function replaySolution() {
  const st = Game.getState();
  for (const [a, b] of st.solution) {
    if (Game.selectTile(a) !== 'selected') return false;
    if (Game.selectTile(b) !== 'matched') return false;
  }
  return Game.isWon();
}

suite('Раздача — настоящие пары (v14)', () => {
  Layouts.all.forEach(layout => {
    test(`${layout.id}: каждая группа фишек чётная — пара есть у всех`, () => {
      Game.newGame(layout, 31337);
      const counts = {};
      Game.getState().tiles.forEach(t => { counts[keyOf(t)] = (counts[keyOf(t)] || 0) + 1; });
      Object.keys(counts).forEach(k => {
        assertEq(counts[k] % 2, 0, `у «${k}» нечётное число фишек: ${counts[k]}`);
      });
    });
  });

  test('одинаковый seed — одинаковая раздача', () => {
    const lay = Layouts.getById('pyramid');
    Game.newGame(lay, 555);
    const a = Game.getState().tiles.map(t => `${keyOf(t)}@${t.x},${t.y},${t.z}`).join('|');
    Game.newGame(lay, 555);
    const b = Game.getState().tiles.map(t => `${keyOf(t)}@${t.x},${t.y},${t.z}`).join('|');
    assertEq(a, b);
  });
});

suite('Раздача — доска всегда решаема (v14)', () => {
  Layouts.all.forEach(layout => {
    test(`${layout.id}: «решение» проходит по реальным правилам, 6 раздач`, () => {
      for (let i = 0; i < 6; i++) {
        Game.newGame(layout);
        assertOk(replaySolution(), `раздача ${i} не решилась`);
      }
    });
    test(`${layout.id}: на старте есть хотя бы 3 хода`, () => {
      for (let i = 0; i < 6; i++) {
        Game.newGame(layout);
        assertOk(Game.countAvailableMoves() >= 3,
          `ходов на старте: ${Game.countAvailableMoves()}`);
      }
    });
  });
});

suite('Перемешивание — решаемо и не «ровно один ход» (v14)', () => {
  function playRandomUntil(left) {
    const st = Game.getState();
    while (st.tiles.filter(t => !t.removed).length > left) {
      const free = Game.getFreeTiles();
      let done = false;
      for (const a of free) {
        const b = free.find(o => Tileset.isMatch(a, o));
        if (b) { Game.selectTile(a); Game.selectTile(b); done = true; break; }
      }
      if (!done) return;
    }
  }

  test('после перемешивания в середине партии оставшееся решаемо', () => {
    for (let i = 0; i < 12; i++) {
      Game.newGame(Layouts.getById('turtle'));
      playRandomUntil(80);
      assertOk(Game.shuffleBoard(false));
      assertOk(Game.hasAnyMove(), 'после перемешивания нет ходов');
      assertOk(replaySolution(), `перемешанная доска ${i} не решилась`);
    }
  });

  test('перемешивание даёт в среднем больше одного хода', () => {
    let total = 0;
    const N = 20;
    for (let i = 0; i < N; i++) {
      Game.newGame(Layouts.getById('spider'));
      playRandomUntil(100);
      Game.shuffleBoard(false);
      total += Game.countAvailableMoves();
    }
    assertOk(total / N >= 3, `в среднем ходов после перемешивания: ${total / N}`);
  });

  test('два перемешивания подряд дают разные расстановки', () => {
    Game.newGame(Layouts.getById('pyramid'));
    const snap = () => Game.getState().tiles.map(t => `${t.x},${t.y},${t.z}`).join('|');
    Game.shuffleBoard(false);
    const a = snap();
    Game.shuffleBoard(false);
    const b = snap();
    assertOk(a !== b, 'расстановки совпали — зерно не меняется');
  });

  test('две оставшиеся фишки, лежащие друг на друге, чинятся', () => {
    const STACK = { positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 3, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }] };
    Game.newGame(STACK, 7);
    assertOk(Game.shuffleBoard(false));
    assertOk(Game.hasAnyMove());
  });
});

suite('Слои — у каждого свой цвет (v14)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/tiles.css'), 'utf8');
  const render = fs.readFileSync(path.join(ROOT, 'js/render.js'), 'utf8');
  const maxLayers = Math.max(...Layouts.all.map(l => l.layers));

  test('render.js ставит data-layer', () => {
    assertOk(/dataset\.layer\s*=\s*tile\.z/.test(render));
  });

  test('для каждого слоя раскладок есть правило цвета', () => {
    for (let z = 0; z < maxLayers; z++) {
      assertOk(css.includes(`.tile[data-layer="${z}"]`), `нет цвета для слоя ${z}`);
    }
  });

  test('оттенки слоёв не повторяются', () => {
    const tints = [...css.matchAll(/\.tile\[data-layer="\d"\]\s*\{\s*--layer-tint:\s*([^;]+);/g)].map(m => m[1].trim());
    assertEq(new Set(tints).size, tints.length);
    assertOk(tints.length >= maxLayers);
  });
});
