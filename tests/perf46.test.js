/* ============================================================
   TESTS/PERF46.TEST.JS — Оптимизация больших досок (v46-perf)
   Сторожим главные правила производительности, чтобы тяжёлое
   не вернулось: у фишки не анимируются box-shadow/filter в базе,
   setSelected не ходит по всем фишкам, счётчик ходов в шапке —
   быстрый (Game.countAvailableMoves), fitBoard при скрытом экране
   оценивает размер по окну, в лёгком режиме SVG-лицо без фильтра.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk } = require('./runner');
const { loadGameModules } = require('./load');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const tilesCss = stripComments(read('css/tiles.css'));
const liteCss = read('css/lite.css');
const renderJs = read('js/render.js');
const playJs = read('js/app/play.js');

suite('v46-perf: тяжёлое не вернулось', () => {
  test('базовый transition .tile — без box-shadow и filter', () => {
    const base = tilesCss.match(/\.tile\s*\{[^}]*\}/s);
    assertOk(base, 'нет правила .tile');
    const tr = base[0].match(/transition:[^;]+;/s);
    assertOk(tr, 'у .tile нет transition');
    assertOk(!/box-shadow/.test(tr[0]),
      'transition на box-shadow вернулся — статтер после каждого матча');
    assertOk(!/filter/.test(tr[0]),
      'transition на filter вернулся — статтер после каждого матча');
    assertOk(/translate/.test(tr[0]) && /opacity/.test(tr[0]),
      'в transition пропали поза или прозрачность');
  });

  test('у .tile нет will-change — постоянных GPU-слоёв быть не должно', () => {
    const base = tilesCss.match(/\.tile\s*\{[^}]*\}/s);
    assertOk(base && !base[0].includes('will-change'),
      'will-change вернулся на все фишки — сотни постоянных слоёв');
  });

  test('setSelected не ходит по всем фишкам на каждый клик', () => {
    const fn = renderJs.match(/function setSelected\(tile\) \{[\s\S]*?\n  \}/);
    assertOk(fn, 'setSelected пропал');
    assertOk(!fn[0].includes('tileEls.forEach'),
      'setSelected снова проходит по tileEls целиком — O(N) на каждый клик');
    assertOk(fn[0].includes('selectedEl') && fn[0].includes('candEls'),
      'трекинг прошлого выбора потерялся');
  });

  test('renderFull сбрасывает трекинг выбора (иначе классы утекут)', () => {
    const fn = renderJs.match(/function renderFull\(\) \{[\s\S]*?\n  \}/);
    assertOk(fn, 'renderFull пропал');
    assertOk(fn[0].includes('selectedEl = null') && fn[0].includes('candEls = []'),
      'renderFull не сбрасывает selectedEl/candEls');
  });

  test('счётчик ходов в шапке — быстрый (Game.countAvailableMoves)', () => {
    assertOk(playJs.includes('Game.countAvailableMoves()'),
      'шапка считает ходы не через Game.countAvailableMoves');
    assertOk(!/function countAvailableMoves/.test(playJs),
      'в play.js вернулся свой O(free²) счётчик ходов');
  });

  test('fitBoard при скрытом экране оценивает размер по окну (без прыжка «издалека»)', () => {
    const fn = renderJs.match(/function fitBoard\(layout\) \{[\s\S]*?\n  \}/);
    assertOk(fn, 'fitBoard пропал');
    assertOk(fn[0].includes('estimateStage(window.innerWidth'),
      'fitBoard не использует estimateStage при нулевой стадии');
    assertOk(renderJs.includes('function uiScaleK('),
      'нет помощника uiScaleK для оценки');
  });

  test('в лёгком режиме SVG-лицо фишки без drop-shadow', () => {
    assertOk(/html\[data-perf="lite"\] \.tile \.tile-face-svg\s*\{\s*filter:\s*none;\s*\}/.test(liteCss),
      'lite.css не гасит drop-shadow на .tile-face-svg');
  });

  test('positionTile пишет размер только при изменении', () => {
    const fn = renderJs.match(/function positionTile\(el, tile\) \{[\s\S]*?\n  \}/);
    assertOk(fn, 'positionTile пропал');
    assertOk(fn[0].includes("if (el.style.width !== wStyle)") &&
             fn[0].includes("if (el.style.height !== hStyle)"),
      'positionTile снова пишет width/height безусловно');
  });
});
