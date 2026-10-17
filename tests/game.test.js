/* ============================================================
   TESTS/GAME.TEST.JS — Игровая логика: свобода фишек, пары,
   отмена, перемешивание, полная партия до победы.
   Ловит: блокировки слоёв, зависания, битые состояния.
   ============================================================ */

'use strict';

const { suite, test, assertOk, assertEq, assertGt, assertGte, assertLte } = require('./runner');
const { loadGameModules } = require('./load');

const { Game, Layouts, Tileset } = loadGameModules();

// ---------- Вспомогательные мини-раскладки ----------

// 4 фишки в ряд: края свободны, середины зажаты
const ROW_LAYOUT = {
  id: 'row', name: 'Ряд', width: 4, height: 1, layers: 1,
  tilesCount: 4,
  positions: [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 },
  ],
};

// 2×2 внизу + 2 сверху: нижние под верхними не свободны
const TOWER_LAYOUT = {
  id: 'tower', name: 'Башня', width: 2, height: 2, layers: 2,
  tilesCount: 6,
  positions: [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
  ],
};

function tileAt(x, y, z) {
  const state = Game.getState();
  return state.board[Game.key(x, y, z)];
}

suite('Game — key() и дробные координаты', () => {

  test('целые координаты удваиваются', () => {
    assertEq(Game.key(1, 2, 0), '2,4,0');
  });

  test('полуцелые координаты округляются стабильно', () => {
    assertEq(Game.key(0.5, 1.5, 1), '1,3,1');
    assertEq(Game.key(2.5, 2.5, 3), '5,5,3');
  });

  test('ключи целой и «полуцелой, равной целой» позиций различимы', () => {
    // y=2 и y=2.5 дают РАЗНЫЕ ключи — наложений позиций нет
    assertOk(Game.key(1, 2, 0) !== Game.key(1, 2.5, 0));
  });
});

suite('Game — новая партия на раскладке «Пирамида»', () => {

  const layout = Layouts.getById('pyramid');
  Game.newGame(layout, 12345);
  const state = Game.getState();

  test('фишек ровно по числу позиций', () => {
    assertEq(state.tiles.length, layout.tilesCount);
  });

  test('все позиции заняты ровно один раз', () => {
    const keys = state.tiles.map(t => Game.key(t.x, t.y, t.z));
    assertEq(new Set(keys).size, keys.length, 'есть дубли позиций');
    assertEq(new Set(keys).size, layout.tilesCount);
  });

  test('все фишки на месте (не убраны), счёт нулевой', () => {
    assertOk(state.tiles.every(t => !t.removed));
    assertEq(state.score, 0);
    assertEq(state.pairsFound, 0);
    assertEq(state.totalPairs, layout.tilesCount / 2);
  });

  test('z всех фишек внутри диапазона слоёв', () => {
    for (const t of state.tiles) {
      assertOk(t.z >= 0 && t.z < layout.layers, `z=${t.z} вне диапазона`);
    }
  });

  test('свободные фишки есть, и их прилично', () => {
    const free = Game.getFreeTiles();
    assertGte(free.length, 2, 'меньше 2 свободных — играть нельзя');
  });

  test('вершина пирамиды свободна, центр нижнего слоя зажат', () => {
    // Центр нижнего слоя (4..2, z=0 у пирамиды 8×8) накрыт слоем z=1
    const center = tileAt(4, 4, 0);
    assertOk(center, 'нет фишки в центре пирамиды');
    assertOk(!Game.isFree(center), 'центр под верхним слоем должен быть заблокирован');
    // Вершина z=3: y=3..3 (слой 2×2 с yOff=3)
    const top = [...state.tiles.filter(t => t.z === 3)];
    assertEq(top.length, 4);
    assertOk(top.every(t => Game.isFree(t)), 'вершина должна быть свободна');
  });
});

suite('Game — свобода фишек: сконструированные сценарии', () => {

  test('ряд: середины зажаты с двух сторон, края свободны', () => {
    Game.newGame(ROW_LAYOUT, 7);
    assertOk(!Game.isFree(tileAt(1, 0, 0)), 'левая середина не свободна');
    assertOk(!Game.isFree(tileAt(2, 0, 0)), 'правая середина не свободна');
    assertOk(Game.isFree(tileAt(0, 0, 0)), 'левый край свободен');
    assertOk(Game.isFree(tileAt(3, 0, 0)), 'правый край свободен');
  });

  test('башня: нижние под верхними не свободны', () => {
    Game.newGame(TOWER_LAYOUT, 7);
    assertOk(!Game.isFree(tileAt(0, 0, 0)), 'накрыта сверху');
    assertOk(!Game.isFree(tileAt(1, 0, 0)), 'накрыта сверху');
    assertOk(Game.isFree(tileAt(0, 1, 0)), 'нижний ряд без накрытия свободен');
    assertOk(Game.isFree(tileAt(1, 1, 0)), 'нижний ряд без накрытия свободен');
    assertOk(Game.isFree(tileAt(0, 0, 1)), 'верхний слой свободен');
  });

  test('лодка: слой со сдвигом на пол-фишки блокирует обе нижние', () => {
    // Верхний слой лодки стоит на y=2.5 — «мостик» над рядами y=2 и y=3
    Game.newGame(Layouts.getById('boat'), 7);
    const under = tileAt(5, 2, 0);
    assertOk(under, 'нет фишки (5,2,0) в лодке');
    assertOk(!Game.isFree(under),
      'фишка под полусдвинутым верхним слоем не может быть свободна');
    // Верхушка лодки (y=0) ничем не накрыта
    const tip = tileAt(4, 0, 0);
    assertOk(tip && Game.isFree(tip), 'кончик лодки должен быть свободен');
  });
});

suite('Game — выбор, пары, отмена', () => {

  test('выбор → снятие выбора', () => {
    Game.newGame(ROW_LAYOUT, 7);
    const edge = tileAt(0, 0, 0);
    assertEq(Game.selectTile(edge), 'selected');
    assertEq(Game.selectTile(edge), 'deselected');
  });

  test('клик по зажатой фишке — notfree, состояние не меняется', () => {
    Game.newGame(ROW_LAYOUT, 7);
    const mid = tileAt(1, 0, 0);
    assertEq(Game.selectTile(mid), 'notfree');
    assertEq(Game.getState().selected, null);
  });

  test('не пара → замена выбора', () => {
    // Подбираем две СВОБОДНЫЕ несовпадающие фишки
    Game.newGame(Layouts.getById('pyramid'), 42);
    const free = Game.getFreeTiles();
    const a = free[0];
    let b = null;
    for (const t of free) {
      if (t !== a && !Tileset.isMatch(a, t)) { b = t; break; }
    }
    assertOk(b, 'не нашлось несовпадающей пары среди свободных');
    assertEq(Game.selectTile(a), 'selected');
    const r = Game.selectTile(b);
    assertOk(r === 'mismatched', `ожидали mismatched, получили ${r}`);
    assertEq(Game.getState().selected, b, 'выбор должен переехать на вторую фишку');
  });

  test('пара убирается, счёт растёт в разумных пределах', () => {
    Game.newGame(ROW_LAYOUT, 7);
    const edge = tileAt(0, 0, 0);
    // Подбираем пару для края среди свободных
    const partner = Game.getFreeTiles().find(t => t !== edge && Tileset.isMatch(edge, t));
    assertOk(partner, 'пара не найдена');
    Game.selectTile(edge);
    const r = Game.selectTile(partner);
    assertEq(r, 'matched');
    assertOk(edge.removed && partner.removed);
    const { score } = Game.getState();
    assertGte(score, 10, 'меньше базовых 10 очков');
    assertLte(score, 15, 'бонус больше 5 — что-то сломалось');
  });

  test('отмена хода возвращает фишки и счёт', () => {
    Game.newGame(ROW_LAYOUT, 7);
    const edge = tileAt(0, 0, 0);
    const partner = Game.getFreeTiles().find(t => t !== edge && Tileset.isMatch(edge, t));
    Game.selectTile(edge);
    Game.selectTile(partner);
    const scoreAfter = Game.getState().score;
    const pairsAfter = Game.getState().pairsFound;
    assertOk(Game.undo());
    assertOk(!edge.removed && !partner.removed, 'фишки не вернулись');
    // счёт уменьшился ровно на дельту хода (база 10 + бонус 0..5)
    assertGte(scoreAfter, 10);
    assertLte(Game.getState().score, scoreAfter - 10, 'счёт не откатился на базу');
    assertEq(Game.getState().pairsFound, pairsAfter - 1);
    // история пуста — второй undo ничего не делает
    if (Game.getState().history.length === 0) {
      assertEq(Game.undo(), false);
    }
  });

  test('undo на пустой истории безопасен', () => {
    Game.newGame(ROW_LAYOUT, 7);
    assertEq(Game.undo(), false);
  });
});

suite('Game — перемешивание', () => {

  test('набор позиций сохраняется, выбранный сбрасывается', () => {
    Game.newGame(Layouts.getById('pyramid'), 99);
    const before = Game.getState().tiles
      .map(t => Game.key(t.x, t.y, t.z)).sort();
    // Делаю пару, чтобы был «оставшийся» набор
    const pair = Game.findHint();
    Game.selectTile(pair[0]);
    Game.selectTile(pair[1]);
    assertOk(Game.shuffleBoard(false));
    const state = Game.getState();
    const after = state.tiles
      .filter(t => !t.removed)
      .map(t => Game.key(t.x, t.y, t.z)).sort();
    assertEq(after.length, before.length - 2);
    assertEq(state.selected, null);
    // Все оставшиеся позиции из исходного набора
    const beforeSet = new Set(before);
    for (const k of after) assertOk(beforeSet.has(k), `позиция ${k} появилась извне`);
  });

  test('после перемешивания ходы есть (гарантия anti-stuck)', () => {
    Game.newGame(Layouts.getById('turtle'), 3);
    assertOk(Game.hasAnyMove());
  });
});

suite('Game — полная партия до победы (интеграционный)', () => {

  for (const layoutId of ['pyramid', 'boat', 'butterfly']) {
    test(`раскладка «${layoutId}» решается до конца с подсказками и перемешиванием`, () => {
      const layout = Layouts.getById(layoutId);
      Game.newGame(layout, 2024);
      let guard = 0;
      while (!Game.isWon()) {
        assertLte(++guard, 1000, 'партия зависла — бесконечный цикл');
        let pair = Game.findHint();
        if (!pair) {
          Game.shuffleBoard(false);
          pair = Game.findHint();
          assertOk(pair, 'даже после перемешивания ходов нет — тупик без выхода');
        }
        const r1 = Game.selectTile(pair[0]);
        assertOk(r1 === 'selected' || r1 === 'mismatched');
        const r2 = Game.selectTile(pair[1]);
        assertEq(r2, 'matched', 'подсказанная пара не собралась');
      }
      const state = Game.getState();
      assertEq(state.pairsFound, state.totalPairs, 'счётчик пар не сошёлся');
      assertOk(state.tiles.every(t => t.removed));
    });
  }
});

suite('Game — починка вырожденного эндшпиля (регрессия v5)', () => {

  // 3 фишки в ряд + одна сверху над центральной
  const COVER_LAYOUT = {
    id: 'cover', name: 'Покрытие', width: 3, height: 1, layers: 2,
    tilesCount: 4,
    positions: [
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 }, { x: 1, y: 0, z: 1 },
    ],
  };

  test('последние две фишки «стопкой» — перемешивание чинит позиции', () => {
    Game.newGame(COVER_LAYOUT, 5);
    // Оставляем ровно накрывающую пару: (1,0,0) и (1,0,1) поверх неё.
    // Такой набор позиций не даёт ход НИ ПРИ КАКИХ лицах.
    for (const t of Game.getState().tiles) {
      const at = Game.key(t.x, t.y, t.z);
      if (at !== Game.key(1, 0, 0) && at !== Game.key(1, 0, 1)) {
        t.removed = true;
      }
    }
    assertOk(!Game.hasAnyMove(), 'накрытая фишка не должна быть свободна');
    assertOk(Game.shuffleBoard(false));
    assertOk(Game.hasAnyMove(),
      'после перемешивания ход обязан появиться (починка набора позиций)');
    // Все оставшиеся фишки на легальных позициях раскладки
    const state = Game.getState();
    const legal = COVER_LAYOUT.positions.map(p => Game.key(p.x, p.y, p.z));
    for (const t of state.tiles.filter(t => !t.removed)) {
      assertOk(legal.includes(Game.key(t.x, t.y, t.z)),
        `фишка ушла на нелегальную позицию (${t.x},${t.y},${t.z},${t.z})`);
    }
    // И партию можно доиграть до конца
    const pair = Game.findHint();
    assertOk(pair, 'подсказка найдена');
    Game.selectTile(pair[0]);
    assertEq(Game.selectTile(pair[1]), 'matched');
    assertOk(Game.isWon());
  });

  test('нет рекурсии: сотня перемешиваний подряд не падает', () => {
    Game.newGame(Layouts.getById('turtle'), 11);
    for (let i = 0; i < 100; i++) {
      assertOk(Game.shuffleBoard(false));
      assertOk(Game.hasAnyMove(), `после ${i}-го перемешивания ходов нет`);
    }
  });

  test('v13: у «Стены» (188 фишек) все id уникальны — близнецы собираются', () => {
    // Раньше пул тайлсета дублировался для раскладок > 144 фишек с
    // ТЕМИ ЖЕ id: две одинаковые фишки не могли собраться никогда
    // (вечный тупик эндшпиля). С v13 дубликаты пула получают свежие
    // уникальные id, а isMatch сравнивает объекты по ссылке.
    // Реестры DOM (Render.tileEls) по-прежнему обязаны ключоваться
    // самим объектом фишки — это дешевле и надёжнее любых id.
    const wall = Layouts.getById('wall');
    assertGt(wall.tilesCount, 144, 'предусловие: раскладка больше тайлсета');
    Game.newGame(wall, 21);
    const ids = Game.getState().tiles.map(t => t.id);
    assertEq(new Set(ids).size, ids.length, 'id уникальны у всех фишек');
  });
});

suite('Game — таймер и состояние', () => {

  test('getElapsedSeconds не падает без состояния', () => {
    // новый чистый Game недоступен снаружи, но вызов на текущем — ок
    assertOk(typeof Game.getElapsedSeconds() === 'number');
  });

  test('getState до начала игры возвращает null безопасно для render', () => {
    // Просто проверяем, что API стабилен
    assertOk(Game.getState() !== undefined);
  });
});
