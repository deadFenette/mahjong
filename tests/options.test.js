/* ============================================================
   TESTS/OPTIONS.TEST.JS — подсветка, масштаб, лупа (v34 → в v38 превью живое)
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assertOk, assertEq, assertGt, assertGte, assertLte } = require('./runner');
const { loadGameModules } = require('./load');
const { mainCss } = require('./sources');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { Render, Layouts, TilesetPictures } = loadGameModules();

const html = read('index.html');
const hlCss = read('css/highlight.css');
const allCss = mainCss() + '\n' + hlCss;

// options.js выполняем в песочнице: при загрузке он только описывает функции
function loadOptions() {
  const App = { state: {} };
  vm.runInNewContext(read('js/app/options.js'), { App, document: {}, Storage: {}, Render: {}, Game: {} });
  return App;
}
const OPT = loadOptions().optionTables;

const tile = (x, y, z, removed) => ({ x, y, z, removed: !!removed });

suite('v34: автомасштаб — границы оставшихся фишек', () => {

  test('activeBounds: рамка, число колонок/рядов/слоёв', () => {
    const b = Render.activeBounds([tile(2, 1, 0), tile(5, 4, 1), tile(3, 2, 2)]);
    assertEq(b.minX, 2); assertEq(b.minY, 1);
    assertEq(b.cols, 4); assertEq(b.rows, 4); assertEq(b.layers, 3); assertEq(b.count, 3);
  });

  test('activeBounds: убранные фишки не считаются; пусто → null', () => {
    const b = Render.activeBounds([tile(0, 0, 0, true), tile(7, 5, 0, true), tile(3, 3, 1)]);
    assertEq(b.cols, 1); assertEq(b.rows, 1); assertEq(b.minX, 3);
    assertEq(Render.activeBounds([tile(0, 0, 0, true)]), null);
    assertEq(Render.activeBounds([]), null);
    assertEq(Render.activeBounds(undefined), null);
  });

  test('меньшая рамка → фишки не меньше, а обычно крупнее', () => {
    for (const l of Layouts.all) {
      const stage = { stageW: 1188, stageH: 628 };
      const full = Render.computeFit({ ...stage, cols: l.width, rows: l.height, layers: Math.max(1, l.layers) });
      const half = Render.computeFit({ ...stage, cols: Math.ceil(l.width / 2), rows: Math.ceil(l.height / 2), layers: 1 });
      assertGte(half.w, full.w, l.id);
    }
    const l = Layouts.getById('turtle');
    const full = Render.computeFit({ stageW: 1188, stageH: 628, cols: l.width, rows: l.height, layers: l.layers });
    const part = Render.computeFit({ stageW: 1188, stageH: 628, cols: 5, rows: 4, layers: 2 });
    assertGt(part.w, full.w * 1.3, 'на пустеющем столе выигрыш должен быть заметным');
  });

  test('shouldRefit: растим от +12%, уменьшаем всегда, мелочь не трогаем', () => {
    assertEq(Render.shouldRefit(50, 55), false, '+10% — не стоит дёргать доску (v44: порог 12%)');
    assertEq(Render.shouldRefit(50, 56), true, '+12% — стоит');
    assertEq(Render.shouldRefit(50, 50), false);
    assertEq(Render.shouldRefit(50, 49), true, 'иначе фишки вылезут за экран');
    assertEq(Render.shouldRefit(0, 60), false);
    assertEq(Render.shouldRefit(50, 0), false);
  });

  test('tilePosition с началом доски: левый верхний оставшийся — в нуле, подъём от верхнего слоя', () => {
    const size = { w: 50, h: 70, gap: 3, zLift: 6, ox: 4, oy: 2, oz: 2 };
    assertEq(Render.tilePosition({ x: 4, y: 2, z: 2 }, size).left, 0);
    assertEq(Render.tilePosition({ x: 4, y: 2, z: 2 }, size).top, 0);
    // фишка слоем ниже сидит на 6 px ниже верхней — вверх никто не вылезает
    assertEq(Render.tilePosition({ x: 4, y: 2, z: 1 }, size).top, 6);
    assertEq(Render.tilePosition({ x: 5, y: 3, z: 2 }, size).left, 53);
    assertEq(Render.tilePosition({ x: 5, y: 3, z: 2 }, size).top, 73);
  });

  test('tilePosition без начала доски — как раньше (обратная совместимость)', () => {
    const size = { w: 50, h: 70, gap: 3, zLift: 6 };
    const p = Render.tilePosition({ x: 2, y: 1, z: 1 }, size);
    assertEq(p.left, 106); assertEq(p.top, 73 - 6);
  });
});

suite('v34: оценка размера фишки для экрана выбора раскладки', () => {

  test('широкий экран — боковые планки, высокий — шапка', () => {
    assertEq(Render.estimateStage(1366, 768).railMode, true);
    assertEq(Render.estimateStage(1024, 768).railMode, false);
    assertEq(Render.estimateStage(390, 844).railMode, false);
  });

  test('оценка совпадает с реальной подгонкой в пределах пары пикселей (рама = стол)', () => {
    const l = Layouts.getById('turtle');
    const st = Render.estimateStage(1366, 768);
    const direct = Render.computeFit({ stageW: st.stageW, stageH: st.stageH, cols: l.width, rows: l.height, layers: l.layers }).w;
    assertEq(Render.estimateTileWidth(l, 1366, 768), direct);
  });

  test('лупа и крупный интерфейс сужают стол → фишки не крупнее', () => {
    const l = Layouts.getById('pyramid');
    const base = Render.estimateTileWidth(l, 1366, 768, { loupe: false, uiScale: 1 });
    assertLte(Render.estimateTileWidth(l, 1366, 768, { loupe: true, uiScale: 1 }), base);
    assertLte(Render.estimateTileWidth(l, 1366, 768, { loupe: true, uiScale: 1.4 }), base);
  });

  test('меньше фишек на раскладке → фишка на этом экране крупнее', () => {
    const sorted = Layouts.all.slice().sort((a, b) => a.tilesCount - b.tilesCount);
    const small = Render.estimateTileWidth(sorted[0], 1280, 720);
    const big = Render.estimateTileWidth(sorted[sorted.length - 1], 1280, 720);
    assertGte(small, big);
  });
});

suite('v34: таблицы настроек согласованы с HTML и CSS', () => {

  test('для каждого варианта выбора есть карточка в настройках', () => {
    for (const [key, c] of Object.entries(OPT.CHOICES)) {
      for (const v of c.values) {
        assertOk(html.includes(`data-opt="${key}" data-value="${v}"`), `нет карточки ${key}=${v}`);
      }
      assertOk(c.values.includes(c.def), `${key}: значение по умолчанию вне списка`);
    }
  });

  test('для каждого тумблера есть чекбокс', () => {
    for (const key of Object.keys(OPT.TOGGLES)) {
      assertOk(new RegExp(`class="toggle opt-toggle" data-opt="${key}"`).test(html), 'нет тумблера ' + key);
    }
  });

  test('пресеты ссылаются только на существующие настройки и значения', () => {
    for (const [name, p] of Object.entries(OPT.PRESETS)) {
      assertOk(html.includes(`data-preset="${name}"`), 'нет кнопки пресета ' + name);
      for (const [k, v] of Object.entries(p.choices)) assertOk(OPT.CHOICES[k].values.includes(v), `${name}: ${k}=${v}`);
      for (const k of Object.keys(p.toggles)) assertOk(k in OPT.TOGGLES, `${name}: ${k}`);
    }
  });

  test('«Крупно и ярко» включает всё, что помогает глазам', () => {
    const p = OPT.PRESETS.bright;
    assertEq(p.choices.highlightLevel, 'bold');
    assertEq(p.choices.hintStyle, 'max');
    assertEq(p.choices.selectStyle, 'bold');
    assertOk(p.toggles.showMatches && p.toggles.bigSymbols && p.toggles.loupe && p.toggles.autozoom);
    assertGt(OPT.UI_K[p.choices.uiScale], 1);
  });

  test('CSS: правила для каждого режима подсветки, выбора и подсказки', () => {
    for (const v of ['bold', 'focus']) assertOk(hlCss.includes(`body[data-hl="${v}"]`), 'hl=' + v);
    assertOk(hlCss.includes('body[data-sel="bold"] .tile.selected'));
    assertOk(hlCss.includes('.tile.match-cand'));
    assertOk(hlCss.includes('.tile.hint-bold') && hlCss.includes('.tile.hint-max'));
    assertOk(hlCss.includes('.hint-link-line') && hlCss.includes('@keyframes hint-dash'));
    assertOk(!hlCss.includes('.board.rezoom'), 'v44: подъезд — одна анимация стола, не переходы фишек');
  });

  test('CSS: подсветка уважает «уменьшить анимацию» и лёгкий режим', () => {
    assertOk(/prefers-reduced-motion[\s\S]*match-cand[\s\S]*animation: none/.test(hlCss));
    assertOk(hlCss.includes('html[data-perf="lite"]'));
  });

  test('CSS: масштаб интерфейса и лупа', () => {
    assertOk(allCss.includes('--ui-k'), 'нет --ui-k');
    assertOk(/zoom: var\(--ui-k/.test(allCss), 'нет zoom от --ui-k');
    assertOk(allCss.includes('.loupe-card') && allCss.includes('body:not([data-loupe="off"])'));
  });

  test('highlight.css подключён после tiles.css и до lite.css, закэширован SW', () => {
    const at = f => html.indexOf(`css/${f}.css`);
    assertOk(at('tiles') < at('highlight') && at('highlight') < at('lite'));
    assertOk(read('sw.js').includes("'./css/highlight.css'"));
    assertOk(read('sw.js').includes("'./js/app/options.js'"));
  });

  test('options.js подключён между settings.js и init.js', () => {
    const at = f => html.indexOf(`js/app/${f}.js`);
    assertOk(at('settings') < at('options') && at('options') < at('init'));
  });

  test('на экране раскладок есть кнопка «Сначала крупные», в разметке игры — лупа', () => {
    assertOk(html.includes('id="layouts-sort"'));
    assertOk(html.includes('id="loupe"') && html.includes('class="loupe-card"'));
  });
});

suite('v34: названия фишек в скине «Картинки» (их показывает лупа)', () => {
  test('вместо «3 точки» — «Вишни», и т. д.; 9+9+9+4+3 названий', () => {
    const by = (s, r) => TilesetPictures.tiles.find(t => t.suit === s && t.rank === r).name;
    assertEq(by('dots', 3), 'Вишни');
    assertEq(by('bamboo', 3), 'Тюльпан');
    assertEq(by('characters', 3), 'Сова');
    assertEq(by('winds', 'N'), 'Снежинка');
    assertEq(by('dragons', 'G'), 'Лягушка');
    const kinds = new Set(TilesetPictures.tiles.filter(t => t.suit !== 'flowers' && t.suit !== 'seasons').map(t => t.name));
    assertEq(kinds.size, 34, 'у всех 34 видов фишек свои названия');
  });
});
