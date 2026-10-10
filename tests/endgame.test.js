/* ============================================================
   TESTS/ENDGAME.TEST.JS — Регрессия эндшпиля (v13)
   Баг пользователя: «если остаётся 2 фишки, их не убрать».
   КОРЕНЬ: у раскладок >144 фишек (Черепаха 156, Стена 188,
   Крест 202) пул тайлсета дублируется; у двух РАЗНЫХ экземпляров
   одной фишки оказывался одинаковый id, а isMatch считала
   «a.id === b.id» признаком той же фишки → пара не собиралась
   НИКОГДА, даже после перемешивания. Плюс: сейв писался до
   отложенного авто-перемешивания, а при загрузке сейва тупик
   не проверялся — восстановленная доска могла быть без ходов.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { Game, Layouts, Tileset } = loadGameModules();

const ROOT = path.join(__dirname, '..');

// Мини-раскладка: две соседние позиции в ряд
const PAIR_LAYOUT = {
  id: 'endgame-pair', name: 'Пара', width: 2, height: 1, layers: 1,
  tilesCount: 2,
  positions: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
};

// Мини-раскладка: стек из двух + свободные места в стороне
// (реалистичная форма эндшпиля: после перемешивания накрытой
// фишке есть куда переехать)
const STACK_LAYOUT = {
  id: 'endgame-stack', name: 'Стек', width: 6, height: 5, layers: 2,
  tilesCount: 2,
  positions: [
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    { x: 4, y: 4, z: 0 }, { x: 5, y: 4, z: 0 },
  ],
};

// Привести две фишки текущей партии к виду «близнецы»
// (одинаковые масть/ранг/лицо; id оставляем как есть либо выравниваем)
function makeTwins(a, b, sameId) {
  a.suit = 'bamboo'; a.rank = 1; a.name = '1 бамбук';
  b.suit = 'bamboo'; b.rank = 1; b.name = '1 бамбук';
  b.face = a.face;
  if (sameId) b.id = a.id;
}

suite('isMatch — v13: сравнение по ссылке, а не по id', () => {

  test('та же фишка (тот же объект) — не пара', () => {
    const t = Tileset.tiles[0];
    assertOk(!Tileset.isMatch(t, t));
  });

  test('два РАЗНЫХ экземпляра с одинаковым id — ПАРА (корень бага)', () => {
    // Так выглядела последняя пара фишек на раскладках >144:
    // визуально одинаковые, id совпал из-за дублирования пула
    const a = { id: 7, suit: 'bamboo', rank: 1 };
    const b = { id: 7, suit: 'bamboo', rank: 1 };
    assertOk(a !== b);
    assertOk(Tileset.isMatch(a, b), 'близнецы с одинаковым id должны собираться');
  });

  test('разные экземпляры с разными id, одна масть — пара', () => {
    const a = { id: 7, suit: 'bamboo', rank: 1 };
    const b = { id: 99, suit: 'bamboo', rank: 1 };
    assertOk(Tileset.isMatch(a, b));
  });

  test('мусор и разные масти — не пара', () => {
    assertOk(!Tileset.isMatch(null, { id: 1, suit: 'bamboo', rank: 1 }));
    assertOk(!Tileset.isMatch({ id: 1, suit: 'bamboo', rank: 1 }, undefined));
    assertOk(!Tileset.isMatch(
      { id: 1, suit: 'bamboo', rank: 1 }, { id: 2, suit: 'bamboo', rank: 2 }));
    assertOk(!Tileset.isMatch(
      { id: 1, suit: 'bamboo', rank: 1 }, { id: 2, suit: 'dots', rank: 1 }));
    assertOk(!Tileset.isMatch(
      { id: 1, suit: 'flowers', rank: 1 }, { id: 2, suit: 'seasons', rank: 1 }));
  });

  test('цветы и сезоны по-прежнему собираются между собой', () => {
    const flowers = Tileset.tiles.filter(t => t.suit === 'flowers');
    const seasons = Tileset.tiles.filter(t => t.suit === 'seasons');
    assertOk(Tileset.isMatch(flowers[0], flowers[3]));
    assertOk(Tileset.isMatch(seasons[0], seasons[3]));
  });
});

suite('newGame — все id на доске уникальны (v13)', () => {

  for (const layout of Layouts.all) {
    test(`раскладка «${layout.name}» (${layout.tilesCount} фишек)`, () => {
      Game.newGame(layout, 4242);
      const st = Game.getState();
      const ids = st.tiles.map(t => t.id);
      assertEq(new Set(ids).size, ids.length,
        `дубликаты id: ${ids.length - new Set(ids).size}`);
    });
  }

  test('у Черепахи близнецы одной масти реально собираются', () => {
    Game.newGame(Layouts.getById('turtle'), 777);
    const st = Game.getState();
    // Находим группу одинаковых масть/ранг из ≥2 экземпляров
    const byKind = new Map();
    st.tiles.forEach(t => {
      const k = t.suit + '/' + t.rank;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k).push(t);
    });
    let checked = 0;
    for (const group of byKind.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          checked++;
          assertOk(Tileset.isMatch(group[i], group[j]),
            `любые два из группы ${group[0].suit}/${group[0].rank} должны быть парой`);
        }
      }
      break;
    }
    assertOk(checked > 0, 'у Черепахи должны быть группы одинаковых фишек');
  });
});

suite('Эндшпиль — сценарий «последние 2 фишки»', () => {

  test('близнецы с одинаковым id (легаси-сейв) собираются кликами', () => {
    // Симуляция восстановления СТАРОГО сейва: у двух фишек совпадает id
    Game.newGame(PAIR_LAYOUT, 11);
    const st = Game.getState();
    makeTwins(st.tiles[0], st.tiles[1], true); // sameId = true

    assertEq(Game.selectTile(st.tiles[0]), 'selected');
    assertEq(Game.selectTile(st.tiles[1]), 'matched',
      'пара близнецов обязана собираться (раньше — вечный тупик)');
    assertOk(Game.isWon());
  });

  test('соседние фишки одного слоя: обе свободны, пара собирается', () => {
    Game.newGame(PAIR_LAYOUT, 5);
    const st = Game.getState();
    makeTwins(st.tiles[0], st.tiles[1], false);
    assertOk(Game.isFree(st.tiles[0]), 'левая свободна (правый край занят, левый открыт)');
    assertOk(Game.isFree(st.tiles[1]), 'правая свободна (левый край занят, правый открыт)');
    assertOk(Game.hasAnyMove());
  });

  test('стек: накрытая не свободна, перемешивание создаёт ход', () => {
    Game.newGame(STACK_LAYOUT, 9);
    const st = Game.getState();
    // Две фишки считаем уже собранными — остаются две живые
    st.tiles[2].removed = true;
    st.tiles[3].removed = true;
    const [a, b] = st.tiles;
    // Сгоняем живые в стек
    a.x = 0; a.y = 0; a.z = 0;
    b.x = 0; b.y = 0; b.z = 1;
    Object.keys(st.board).forEach(k => delete st.board[k]);
    st.board[Game.key(a.x, a.y, a.z)] = a;
    st.board[Game.key(b.x, b.y, b.z)] = b;
    makeTwins(a, b, false);

    const live = () => st.tiles.filter(t => !t.removed);
    assertEq(live().length, 2, 'на доске две живые фишки');
    assertOk(!Game.isFree(a), 'накрытая снизу не свободна');
    assertOk(Game.isFree(b), 'верхняя свободна');
    assertOk(!Game.hasAnyMove(), 'тупик: ходов нет');

    Game.shuffleBoard(false); // то же, что делает авто-перемешивание
    assertOk(Game.hasAnyMove(), 'после перемешивания ход обязан появиться');
    assertOk(live().every(t => Game.isFree(t)), 'обе живые фишки должны быть свободны');
  });

  test('стек из РАЗНЫХ фишек: перемешивание чинит (rescue + перестановка)', () => {
    Game.newGame(STACK_LAYOUT, 21);
    const st = Game.getState();
    st.tiles[2].removed = true;
    st.tiles[3].removed = true;
    const [a, b] = st.tiles;
    a.x = 0; a.y = 0; a.z = 0;
    b.x = 0; b.y = 0; b.z = 1;
    Object.keys(st.board).forEach(k => delete st.board[k]);
    st.board[Game.key(a.x, a.y, a.z)] = a;
    st.board[Game.key(b.x, b.y, b.z)] = b;
    // Гарантированно разные
    const other = Tileset.tiles.find(t =>
      t.suit !== a.suit || t.rank !== a.rank);
    b.suit = other.suit; b.rank = other.rank; b.name = other.name; b.face = other.face;

    const live = () => st.tiles.filter(t => !t.removed);
    assertEq(live().length, 2);
    assertOk(!Game.hasAnyMove());
    Game.shuffleBoard(false);
    assertOk(Game.hasAnyMove(), 'rescue-копирование личности должно дать ход');
  });
});

suite('Стресс — партии по протоколу приложения доигрываются до победы', () => {
  // Протокол app.js: матч → isWon? → нет ходов? → shuffleBoard(false).
  // Раньше часть партий упиралась в неустранимый тупик из-за
  // дубликатов id; теперь каждая партия обязана доходить до победы.

  const SEEDS_PER_LAYOUT = 6;

  for (const layout of Layouts.all) {
    test(`«${layout.name}»: ${SEEDS_PER_LAYOUT} партий — все до победы`, () => {
      for (let seed = 1; seed <= SEEDS_PER_LAYOUT; seed++) {
        Game.newGame(layout, seed * 7919 + 13);
        let guard = 0;
        let deadlocks = 0;
        while (guard++ < 5000) {
          let pair = Game.findHint();
          if (!pair) {
            deadlocks++;
            Game.shuffleBoard(false); // как app.js
            assertOk(Game.hasAnyMove(),
              `перемешивание обязано создавать ход (${layout.id}, seed ${seed})`);
            pair = Game.findHint();
            assertOk(pair, `после перемешивания обязана быть пара (${layout.id}, seed ${seed})`);
          }
          const r1 = Game.selectTile(pair[0]);
          assertEq(r1, 'selected');
          const r2 = Game.selectTile(pair[1]);
          assertEq(r2, 'matched',
            `матч обязан состояться (${layout.id}, seed ${seed}, ход ${guard})`);
          if (Game.isWon()) break;
        }
        assertOk(Game.isWon(),
          `партия ${layout.id} seed ${seed} не доиграна (тупик или зависание)`);
        assertOk(deadlocks < 5000);
      }
    });
  }
});

suite('app.js — единая проверка тупика (v13)', () => {

  const src = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

  test('функция ensureMovesAvailable существует', () => {
    assertOk(/function ensureMovesAvailable\(\)/.test(src));
  });

  test('вызывается после матча, после загрузки сейва и после отмены', () => {
    // 1 определение + 3 вызова
    const calls = src.match(/ensureMovesAvailable\(\)/g) || [];
    assertEq(calls.length, 4, 'ожидается определение + 3 вызова');
  });

  test('после загрузки сейва проверка идёт до отрисовки доски', () => {
    const region = src.slice(src.indexOf('function continueSaved'));
    const at = region.indexOf('ensureMovesAvailable()');
    const render = region.indexOf('Render.fitBoard(layout)');
    assertOk(at > -1 && render > -1 && at < render,
      'ensureMovesAvailable должен вызываться до Render.fitBoard в continueSaved');
  });

  test('авто-перемешивание защищено от устаревшего состояния', () => {
    assertOk(/Game\.getState\(\) !== stateAtSchedule/.test(src),
      'колбэк перемешивания должен проверять, что партия не сменилась');
  });

  test('починенная доска пересохраняется в сейв', () => {
    assertOk(/saveCurrentGame\(\); \/\/ v13/.test(src),
      'после авто-перемешивания доска должна попасть в сейв');
  });
});

suite('sw.js — кэш поднят до v15', () => {

  test('имя кэша обновлено', () => {
    const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assertOk(/mahjong-v15-endgame/.test(src), 'ожидался кэш mahjong-v15-endgame*');
  });
});
