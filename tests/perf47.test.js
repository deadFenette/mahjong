/* ============================================================
   TESTS/PERF47.TEST.JS — сторожа оптимизации v47-perf
   1. GOLDEN-доски: раздачи newGame бит-в-бит как ДО рефакторинга
      (тот же порядок вызовов rng; хэши сняты на v46-коде).
   2. Кеш свободных фишек: предикат по z-бакетам совпадает с
      наивным O(N) сканированием (копией исходного isFree),
      кеш инвалидируется при матче/отмене/перемешивании.
   3. hasAnyMove группировкой ≡ попарной проверке isMatch.
   4. Шрифты по кнопке: каталог файлов, чистые функции css2-парсера,
      отсутствие бинарников шрифтов в репозитории.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const ROOT = path.join(__dirname, '..');

// ============================================================
//  Чистые копии исходных алгоритмов (эталон для сверки)
// ============================================================

// Исходный isFree (до v47) — честное O(N) сканирование всей доски
function naiveIsFree(tiles, inst) {
  if (!inst || inst.removed) return false;
  const { x, y, z } = inst;
  for (const t of tiles) {
    if (t.removed) continue;
    if (t.z !== z + 1) continue;
    if (Math.abs(t.x - x) < 0.75 && Math.abs(t.y - y) < 0.75) return false;
  }
  let leftBlocked = false;
  let rightBlocked = false;
  for (const t of tiles) {
    if (t.removed) continue;
    if (t.z !== z) continue;
    if (Math.abs(t.y - y) > 0.75) continue;
    const dx = t.x - x;
    if (dx < -0.25 && dx > -1.75) leftBlocked = true;
    else if (dx > 0.25 && dx < 1.75) rightBlocked = true;
    if (leftBlocked && rightBlocked) return false;
  }
  return true;
}

function naiveFree(tiles) {
  return tiles.filter(t => !t.removed && naiveIsFree(tiles, t));
}

// FNV-1a 32-bit — те же хэши, что в golden-снапшотах
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ============================================================
//  1. GOLDEN: раздачи не изменились
// ============================================================

const GOLDEN = [
  { layout: "pyramid", seed: 1, board: '7fa7a9d6', moves: 13, hasMove: true },
  { layout: "pyramid", seed: 42, board: '451e75e7', moves: 13, hasMove: true },
  { layout: "pyramid", seed: 20261030, board: '8de62e8f', moves: 13, hasMove: true },
  { layout: "turtle", seed: 1, board: '2dda9f23', moves: 13, hasMove: true },
  { layout: "turtle", seed: 42, board: 'c63ee2b6', moves: 15, hasMove: true },
  { layout: "turtle", seed: 20261030, board: '4b5117cd', moves: 13, hasMove: true },
  { layout: "wall", seed: 1, board: 'b9fa2c0f', moves: 13, hasMove: true },
  { layout: "wall", seed: 42, board: '50432500', moves: 17, hasMove: true },
  { layout: "wall", seed: 20261030, board: 'e1258f51', moves: 15, hasMove: true },
  { layout: "cross", seed: 1, board: '0d97aa18', moves: 7, hasMove: true },
  { layout: "cross", seed: 42, board: '47e186a3', moves: 7, hasMove: true },
  { layout: "cross", seed: 20261030, board: '5c62c8f1', moves: 7, hasMove: true },
  { layout: "spider", seed: 1, board: 'c26b3c1b', moves: 15, hasMove: true },
  { layout: "spider", seed: 42, board: '680385c3', moves: 16, hasMove: true },
  { layout: "spider", seed: 20261030, board: 'f9d315a2', moves: 16, hasMove: true },
  { layout: "fortress", seed: 1, board: 'e1301063', moves: 16, hasMove: true },
  { layout: "fortress", seed: 42, board: '6dec925b', moves: 16, hasMove: true },
  { layout: "fortress", seed: 20261030, board: 'd1cf37df', moves: 14, hasMove: true },
  { layout: "mix600", mix: { ver: 45, kind: 'blob', seed: 20261030, tiles: 600, layers: 4, bigboard: true, symmetry: 'none', pick: null }, mixPos: '39fbcaf3', seed: 777, board: '4f0f7546', moves: 80, hasMove: true },
  { layout: "mix600", mix: { ver: 45, kind: 'blob', seed: 20261030, tiles: 600, layers: 4, bigboard: true, symmetry: 'none', pick: null }, stage: 'после 8 матчей', board: '89a78c6e', moves: 75, free: 168 },
  { layout: "mix600", mix: { ver: 45, kind: 'blob', seed: 20261030, tiles: 600, layers: 4, bigboard: true, symmetry: 'none', pick: null }, stage: 'после отмены', board: 'bfecebd0', moves: 74, free: 167 },
  { layout: "cross", stage: 'после 1 матча', board: 'b9a76b23', moves: 8, free: 25 },
];

suite('v47-perf: golden-доски', () => {
  const M = loadGameModules();
  const { Game, Layouts, MixGen, Tileset } = M;

  function boardFnv() {
    const s = Game.getState();
    return fnv(JSON.stringify(s.tiles.map(t =>
      [t.id, t.x, t.y, t.z, t.suit, t.rank, t.removed ? 1 : 0])));
  }

  // Воспроизводим последовательности снапшотов (порядок важен!)
  const mix600 = MixGen.generate({
    ver: 45, kind: 'blob', seed: 20261030, tiles: 600, layers: 4,
    bigboard: true, symmetry: 'none', pick: null,
  });

  test('раскладка Микса-600 та же', () => {
    assertEq(fnv(JSON.stringify(mix600.positions.map(p => [p.x, p.y, p.z]))), GOLDEN[18].mixPos);
  });

  for (const g of GOLDEN.slice(0, 19)) {
    test(`${g.layout} seed=${g.seed}: доска/ходы бит-в-бит`, () => {
      if (g.layout === 'mix600') Game.newGame(mix600, g.seed);
      else Game.newGame(Layouts.getById(g.layout), g.seed);
      assertEq(boardFnv(), g.board, `доска ${g.layout}/${g.seed}`);
      assertEq(Game.countAvailableMoves(), g.moves, `ходы ${g.layout}/${g.seed}`);
      assertEq(Game.hasAnyMove(), g.hasMove, `hasAnyMove ${g.layout}/${g.seed}`);
    });
  }

  test('mix-600: серия из 8 матчей и отмена — как до рефакторинга', () => {
    Game.newGame(mix600, 777);
    const pick = () => {
      const free = Game.getFreeTiles();
      for (let i = 0; i < free.length; i++)
        for (let j = i + 1; j < free.length; j++)
          if (Tileset.isMatch(free[i], free[j])) return [free[i], free[j]];
      return null;
    };
    for (let k = 0; k < 8; k++) {
      const p = pick();
      if (!p) break;
      Game.selectTile(p[0]);
      Game.selectTile(p[1]);
    }
    const s1 = GOLDEN[19];
    assertEq(boardFnv(), s1.board, 'доска после 8 матчей');
    assertEq(Game.countAvailableMoves(), s1.moves);
    assertEq(Game.getFreeTiles().length, s1.free);
    Game.undo();
    const s2 = GOLDEN[20];
    assertEq(boardFnv(), s2.board, 'доска после отмены');
    assertEq(Game.countAvailableMoves(), s2.moves);
    assertEq(Game.getFreeTiles().length, s2.free);
  });

  test('cross: матч → пересчёт свободных совпадает', () => {
    Game.newGame(Layouts.getById('cross'), 42);
    const free = naiveFree(Game.getState().tiles);
    Game.selectTile(free[0]);
    for (const t of naiveFree(Game.getState().tiles)) {
      if (t !== free[0] && Tileset.isMatch(free[0], t)) { Game.selectTile(t); break; }
    }
    const s3 = GOLDEN[21];
    assertEq(boardFnv(), s3.board, 'доска после матча');
    assertEq(Game.countAvailableMoves(), s3.moves);
    assertEq(Game.getFreeTiles().length, s3.free);
  });
});

// ============================================================
//  2. Кеш свободных фишек: эквивалентность + инвалидация
// ============================================================

suite('v47-perf: кеш свободных фишек', () => {
  const M = loadGameModules();
  const { Game, Layouts, MixGen, Tileset } = M;

  function checkAgainstNaive(label) {
    const tiles = Game.getState().tiles;
    const cached = Game.getFreeTiles();
    const naive = naiveFree(tiles);
    assertEq(cached.length, naive.length, `${label}: длина`);
    for (let i = 0; i < naive.length; i++) {
      assertOk(cached[i] === naive[i], `${label}: порядок и состав свободных`);
    }
  }

  test('свободные после newGame ≡ наивному сканированию (6 раскладок)', () => {
    for (const id of ['pyramid', 'turtle', 'wall', 'cross', 'spider', 'fortress']) {
      Game.newGame(Layouts.getById(id), 42);
      checkAgainstNaive(id);
    }
  });

  test('свободные на гиганте ≡ наивному сканированию', () => {
    const big = MixGen.generate({
      ver: 45, kind: 'blob', seed: 20261030, tiles: 600, layers: 4,
      bigboard: true, symmetry: 'none', pick: null,
    });
    Game.newGame(big, 777);
    checkAgainstNaive('mix-600 старт');
    // немного матчей
    for (let k = 0; k < 15; k++) {
      const free = naiveFree(Game.getState().tiles);
      let found = false;
      for (let i = 0; i < free.length && !found; i++)
        for (let j = i + 1; j < free.length && !found; j++)
          if (Tileset.isMatch(free[i], free[j])) {
            Game.selectTile(free[i]); Game.selectTile(free[j]); found = true;
          }
      if (!found) break;
    }
    checkAgainstNaive('mix-600 после 15 матчей');
  });

  test('кеш: повторный вызов возвращает ТОТ ЖЕ массив, после матча — новый', () => {
    Game.newGame(Layouts.getById('cross'), 42);
    const a = Game.getFreeTiles();
    const b = Game.getFreeTiles();
    assertOk(a === b, 'без мутаций кеш переиспользуется');
    // матч
    let done = false;
    for (let i = 0; i < a.length && !done; i++)
      for (let j = i + 1; j < a.length && !done; j++)
        if (Tileset.isMatch(a[i], a[j])) {
          Game.selectTile(a[i]); Game.selectTile(a[j]); done = true;
        }
    assertOk(done, 'нашлась пара');
    const c = Game.getFreeTiles();
    assertOk(a !== c, 'после матча кеш пересобран');
    // Длина может И вырасти (освоились накрытые фишки), и упасть —
    // важна эквивалентность наивному пересчёту, а не направление сдвига
    const naive = naiveFree(Game.getState().tiles);
    assertEq(c.length, naive.length, 'длина ≡ наивной');
    for (let i = 0; i < naive.length; i++) assertOk(c[i] === naive[i], 'состав ≡ наивному');
    // отмена
    Game.undo();
    const d = Game.getFreeTiles();
    assertOk(c !== d, 'после отмены кеш пересобран');
    const naive2 = naiveFree(Game.getState().tiles);
    assertEq(d.length, naive2.length, 'после отмены длина ≡ наивной');
  });

  test('кеш: перемешивание пересобирает свободные (позиции меняются)', () => {
    Game.newGame(Layouts.getById('cross'), 42);
    const before = Game.getFreeTiles().map(t => t.id).join(',');
    Game.shuffleBoard(true);
    const after = Game.getFreeTiles();
    checkAgainstNaive('после shuffleBoard');
    assertOk(Array.isArray(after), 'список свободных валиден');
    assertOk(typeof before === 'string');
  });

  test('Game.invalidateFreeCache экспортирован', () => {
    assertEq(typeof Game.invalidateFreeCache, 'function');
    Game.invalidateFreeCache();
    const tiles = Game.getState().tiles;
    const naive = naiveFree(tiles);
    assertEq(Game.getFreeTiles().length, naive.length, 'после явного сброса пересчёт корректен');
  });
});

// ============================================================
//  3. hasAnyMove группировкой ≡ попарной проверке
// ============================================================

suite('v47-perf: hasAnyMove через группировку', () => {
  const M = loadGameModules();
  const { Game, Layouts, MixGen, Tileset } = M;

  function naiveHasAnyMove() {
    const free = naiveFree(Game.getState().tiles);
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++)
        if (Tileset.isMatch(free[i], free[j])) return true;
    return false;
  }

  test('эквивалентность на 6 раскладках и в эндшпиле', () => {
    for (const id of ['pyramid', 'turtle', 'wall', 'cross', 'spider', 'fortress']) {
      Game.newGame(Layouts.getById(id), 7);
      assertEq(Game.hasAnyMove(), naiveHasAnyMove(), id);
      // доигрываем до конца — эквивалентность должна держаться всю партию
      for (let guard = 0; guard < 4000; guard++) {
        if (Game.isWon()) break;
        const free = naiveFree(Game.getState().tiles);
        let found = false;
        for (let i = 0; i < free.length && !found; i++)
          for (let j = i + 1; j < free.length && !found; j++)
            if (Tileset.isMatch(free[i], free[j])) {
              Game.selectTile(free[i]); Game.selectTile(free[j]); found = true;
            }
        if (!found) break;
        assertEq(Game.hasAnyMove(), naiveHasAnyMove(), `${id} ход ${guard}`);
      }
    }
  });
});

// ============================================================
//  4. Шрифты по кнопке
// ============================================================

suite('v47-perf: шрифты по кнопке (js/fonts.js)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'fonts.js'), 'utf8');
  const sandbox = {};
  const GameFonts = new Function(src + '\n;return GameFonts;').call(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');

  test('модуль загружается без DOM и отдаёт чистые функции', () => {
    assertEq(typeof GameFonts.parseCssFontFaces, 'function');
    assertEq(typeof GameFonts.rangesIntersect, 'function');
    assertEq(typeof GameFonts.parseUnicodeRange, 'function');
    assertOk(Array.isArray(GameFonts.USED_RANGES) && GameFonts.USED_RANGES.length > 100);
  });

  test('CSS2_URL синтаксически корректен (регресс: было css2&family вместо css2?family)', () => {
    assertOk(/css2\?family=/.test(GameFonts.CSS2_URL), 'должен быть ? после css2');
    assertOk(!/css2&/.test(GameFonts.CSS2_URL), 'не должно быть css2&');
    for (const fam of ['Ma+Shan+Zheng', 'ZCOOL+XiaoWei', 'Noto+Serif+SC', 'Noto+Sans+SC']) {
      assertOk(GameFonts.CSS2_URL.includes('family=' + fam), 'семейство ' + fam);
    }
    assertOk(GameFonts.CSS2_URL.endsWith('display=swap'), 'display=swap в конце');
  });

  test('каталог: 9 файлов, уникальные имена, правильные гарнитуры и веса', () => {
    const files = GameFonts.FILES.map(f => f.file);
    assertEq(files.length, 9);
    assertEq(new Set(files).size, 9);
    const fams = {};
    for (const f of GameFonts.FILES) {
      fams[f.family] = fams[f.family] || [];
      fams[f.family].push(Number(f.weight));
    }
    assertEq(fams['Ma Shan Zheng'].join(','), '400');
    assertEq(fams['ZCOOL XiaoWei'].join(','), '400');
    assertEq(fams['Noto Serif SC'].sort((a, b) => a - b).join(','), '400,600,700,900');
    assertEq(fams['Noto Sans SC'].sort((a, b) => a - b).join(','), '400,500,700');
    for (const f of files) assertOk(/^[a-z0-9-]+\.woff2$/.test(f), 'имя файла шрифта');
  });

  test('parseCssFontFaces разбирает css2-ответ', () => {
    const css = [
      '@font-face {',
      "  font-family: 'Noto Serif SC';",
      '  font-style: normal;',
      '  font-weight: 700;',
      '  font-display: swap;',
      '  src: url(https://fonts.gstatic.com/s/x/v1/a.woff2) format(\'woff2\');',
      '  unicode-range: U+4e00-4eff, U+20-7e;',
      '}',
    ].join('\n');
    const blocks = GameFonts.parseCssFontFaces(css);
    assertEq(blocks.length, 1);
    assertEq(blocks[0].family, 'Noto Serif SC');
    assertEq(blocks[0].weight, '700');
    assertEq(blocks[0].url, 'https://fonts.gstatic.com/s/x/v1/a.woff2');
    assertOk(blocks[0].unicodeRange.includes('4e00-4eff'));
    const httpBlock = GameFonts.parseCssFontFaces(
      "@font-face{font-family:'X';font-weight:400;src:url(http://local/mock.woff2);unicode-range:U+20-7e;}" );
    assertEq(httpBlock.length, 1, 'http:// тоже парсится (браузер сам блокирует mixed-content)');
    assertEq(httpBlock[0].url, 'http://local/mock.woff2');
    assertEq(GameFonts.parseCssFontFaces('мусор').length, 0);
  });

  test('rangesIntersect и parseUnicodeRange', () => {
    const R = GameFonts.rangesIntersect, P = GameFonts.parseUnicodeRange;
    assertEq(R([[0x20, 0x7e]], P('U+50-60')), true, 'внутри');
    assertEq(R([[0x20, 0x7e]], P('U+80-ff')), false, 'справа');
    assertEq(R([[0x20, 0x7e]], P('U+10-19')), false, 'слева');
    assertEq(R([[0x20, 0x7e]], P('U+10-25')), true, 'пересечение слева');
    assertEq(R([[0x20, 0x7e]], P('U+70-ff')), true, 'пересечение справа');
    assertEq(R([[0x4e00, 0x4e00]], P('U+4e00')), true, 'одиночный');
    assertEq(P('U+1f004')[0][0], 0x1f004, '5-значный код');
    assertEq(P('U+ff??')[0][0], 0xff00, 'подстановочный низ');
    assertEq(P('U+ff??')[0][1], 0xffff, 'подстановочный верх');
  });

  test('в наборе символов есть кириллица, плиточные иероглифы и 福寿', () => {
    const has = cp => GameFonts.USED_RANGES.some(([a, b]) => cp >= a && cp <= b);
    assertOk(has(0x0410), 'А кириллическое');
    assertOk(has(0x4e07), '万');
    assertOk(has(0x6771), '東');
    assertOk(has(0x767c), '發');
    assertOk(has(0x798f), '福');
    assertOk(has(0x5bff), '寿');
    assertOk(!has(0x9fff), 'экзотика не нужна');
  });

  test('index.html: кнопки и скрипт на месте, css/fonts.css ушёл', () => {
    assertOk(html.includes('id="btn-fonts"'), 'кнопка в меню');
    assertOk(html.includes('id="btn-fonts-settings"'), 'кнопка в настройках');
    assertOk(html.includes('id="fonts-setting-status"'), 'статус в настройках');
    assertOk(html.includes('<script src="js/fonts.js"></script>'), 'скрипт подключён');
    assertOk(!html.includes('css/fonts.css'), 'мёртвая ссылка на css/fonts.css удалена');
  });

  test('sw.js: загрузчик в кэше, бинарников шрифтов нет', () => {
    assertOk(sw.includes("'./js/fonts.js'"), 'js/fonts.js в ASSETS');
    assertOk(!sw.includes('./fonts/'), 'fonts/ в ASSETS быть не должно');
    assertOk(!sw.includes('css/fonts.css'), 'css/fonts.css в ASSETS быть не должно');
  });

  test('.gitignore защищает fonts/', () => {
    assertOk(/^fonts\/$/m.test(gitignore), 'fonts/ в .gitignore');
  });

  test('в репозитории нет файлов шрифтов', () => {
    const fontsDir = path.join(ROOT, 'fonts');
    assertOk(!fs.existsSync(fontsDir), 'папки fonts/ быть не должно');
    assertOk(!fs.existsSync(path.join(ROOT, 'css', 'fonts.css')), 'css/fonts.css быть не должно');
  });
});
