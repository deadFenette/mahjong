/* ============================================================
   TESTS/PREVIEW.TEST.JS — живое превью настроек (v38)

   Экран настроек стал широким: слева группы, справа «экранчик»
   с настоящими фишками. Здесь проверяем: разметку (settings-body,
   preview-board), подключение (preview.js/preview.css после
   фишечных стилей, кэш SW), поведение (слушает событие настроек,
   смена скина пересобирает лица, классы синхронизируются) и
   согласованность с таблицами options.js.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assertOk, assertEq } = require('./runner');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const html = read('index.html');
const sw = read('sw.js');
const css = read('css/preview.css');
const src = read('js/app/preview.js');

// options.js в песочнице — как в options.test.js (там таблицы значений)
function loadOptions() {
  const App = { state: {} };
  vm.runInNewContext(read('js/app/options.js'), { App, document: {}, Storage: {}, Render: {}, Game: {} });
  return App;
}
const OPT = loadOptions().optionTables;

suite('v38: разметка — настройки стали широким экраном', () => {

  test('settings-body оборачивает колонку групп и панель превью', () => {
    assertOk(html.includes('class="settings-body"'), 'нет .settings-body');
    assertOk(html.includes('id="settings-preview"'), 'нет панели превью');
    assertOk(html.includes('id="preview-board"'), 'нет мини-доски');
    assertOk(html.includes('id="preview-legend"'), 'нет легенды');
    // порядок: список групп раньше превью (на узких экранах превью сверху)
    const iList = html.indexOf('class="settings-list"');
    const iAside = html.indexOf('id="settings-preview"');
    assertOk(iList > 0 && iAside > iList, 'превью должно идти после списка в разметке');
  });

  test('панель превью — aside с доступной меткой', () => {
    assertOk(/<aside class="settings-preview"[^>]*aria-label="Живое превью/.test(html),
      'превью должно быть aside с aria-label');
  });

  test('превью не дублирует фишки в разметке — их собирает скрипт превью', () => {
    assertOk(/preview-board">\s*<!--/.test(html),
      'контейнер preview-board должен быть пустым — фишки ставит JS');
    assertOk(!/preview-board[^>]*>\s*<div class="tile"/.test(html), 'фишки не должны быть в HTML');
  });
});

suite('v38: подключение — порядок каскада и кэш', () => {

  test('preview.css после tiles.css и highlight.css, но до lite.css', () => {
    const at = f => html.indexOf('css/' + f + '.css');
    assertOk(at('tiles') < at('highlight'), 'highlight после tiles');
    assertOk(at('highlight') < at('preview'), 'preview после highlight (рамки из highlight.css работают)');
    assertOk(at('preview') < at('lite'), 'lite остаётся последним');
  });

  test('preview.js подключён после options.js и до init.js', () => {
    const at = f => html.indexOf('js/app/' + f + '.js');
    assertOk(at('settings') < at('options'), 'options после settings');
    assertOk(at('options') < at('preview'), 'preview после options (слушает его событие)');
    assertOk(at('preview') < at('init'), 'preview до init: сцена строится раньше App.init');
  });

  test('sw.js: кэш поднят до mahjong-v45-mixbig, новые файлы закэшированы', () => {
    assertOk(/mahjong-v45-mixbig/.test(sw), 'кэш должен быть mahjong-v45-mixbig');
    assertOk(sw.includes("'./css/preview.css'"), 'css/preview.css не в кэше');
    assertOk(sw.includes("'./js/app/preview.js'"), 'js/app/preview.js не в кэше');
  });

  test('структура модуля: IIFE над App, strict, не объявляет App', () => {
    assertOk(src.includes("})(App);"), 'нет (function (A) {...})(App)');
    assertOk(src.includes("'use strict'"), 'нет strict');
    assertOk(!/^const App\b/m.test(src), 'App объявляет только core.js');
    assertOk(src.split('\n').length <= 400, 'модуль больше 400 строк — пора резать');
  });
});

suite('v38: CSS — широкий экран и экранчик', () => {

  test('settings-body — две колонки, скролл переносится на тело', () => {
    assertOk(/\.settings-body \{[^}]*display: grid/.test(css), 'нет grid у settings-body');
    assertOk(/\.settings-body \{[^}]*overflow-y: auto/.test(css), 'скролл должен быть у тела');
    assertOk(/grid-template-columns: minmax\(0, 780px\) minmax\(400px, 480px\)/.test(css),
      'две колонки: группы + превью');
    assertOk(/\.settings-preview \{[^}]*position: sticky/.test(css), 'превью должно прилипать при скролле');
  });

  test('на узком экране колонки складываются, превью поднимается', () => {
    assertOk(/@media \(max-width: 1180px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/.test(css),
      'нет одноколоночного режима');
    assertOk(/@media \(max-width: 1180px\)[\s\S]*?order: -1/.test(css), 'превью не поднимается наверх');
  });

  test('мини-доска задаёт фишкам те же переменные, что игра', () => {
    assertOk(/\.preview-board \{[^}]*--tile-w: 50px/.test(css), 'нет --tile-w');
    assertOk(/\.preview-board \{[^}]*--tile-blocked-alpha: 1/.test(css), 'нет --tile-blocked-alpha');
    assertOk(/\.preview-board \{[^}]*--tile-face-pad/.test(css), 'нет --tile-face-pad');
    // сукно и ткани — как у игрового стола (тема меняет их целиком)
    assertOk(css.includes('var(--weave-cloth)') && css.includes('var(--mat-bg)'), 'сукно не из темы');
    assertOk(css.includes('var(--inlay)'), 'нет золотой вставки');
  });

  test('фишки превью неинтерактивны, «обычная» подсказка дышит вечно', () => {
    assertOk(/\.preview-board \.tile \{[^}]*pointer-events: none/.test(css), 'фишки должны быть некликабельны');
    assertOk(/\.preview-board \.tile\.hint \{[^}]*infinite/.test(css), 'hint-pulse должна быть бесконечной');
  });

  test('подписи и легенда оформлены', () => {
    assertOk(css.includes('.preview-label'), 'нет стилей подписей');
    assertOk(css.includes('.preview-legend-row'), 'нет стилей легенды');
    assertOk(css.includes('.preview-legend-key') && css.includes('.preview-legend-val'), 'нет пары ключ-значение');
  });

  test('лёгкий режим и «уменьшить анимацию» глушат пульсации превью', () => {
    assertOk(/prefers-reduced-motion[\s\S]*?\.preview-board \.tile\.hint[\s\S]*?animation: none/.test(css),
      'reduced-motion не гасит превью');
    assertOk(/html\[data-perf="lite"\] \.preview-board \.tile\.hint[\s\S]*?animation: none/.test(css),
      'lite-режим не гасит превью');
  });
});

suite('v38: preview.js — сцена и синхронизация', () => {

  test('в сцене есть все семь ролей', () => {
    for (const role of ['free', 'blocked', 'under', 'selected', 'twin', 'hintA', 'hintB']) {
      assertOk(src.includes("role: '" + role + "'"), 'нет роли ' + role);
    }
  });

  test('выбранная и двойник — разные копии одной фишки (без конфликтов id)', () => {
    const sel = src.match(/role: 'selected',[^}]*nth: (\d+)/);
    const twin = src.match(/role: 'twin',[^}]*nth: (\d+)/);
    assertOk(sel && twin, 'нет nth у selected/twin');
    assertOk(sel[1] !== twin[1], 'копии должны быть разными');
  });

  test('слушает событие настроек и пересобирает лица при смене скина', () => {
    assertOk(src.includes("addEventListener('mahjong:settings'"), 'нет подписки на событие');
    assertOk(/key === 'tileSkin'[\s\S]*?build\(\)/.test(src), 'смена скина должна пересобирать сцену');
    assertOk(src.includes("addEventListener('DOMContentLoaded', build)"), 'сцена строится при загрузке');
  });

  test('синхронизация повторяет игру: free/match-cand/hint и прозрачность', () => {
    assertOk(/classList\.toggle\('free', glow\)/.test(src), 'нет toggle free');
    assertOk(/classList\.toggle\('match-cand', showMatches\)/.test(src), 'нет toggle match-cand');
    assertOk(src.includes("classList.toggle('hint-bold'"), 'нет toggle hint-bold');
    assertOk(src.includes("classList.toggle('hint-max'"), 'нет toggle hint-max');
    assertOk(src.includes('--tile-blocked-alpha'), 'не ставится прозрачность');
    assertOk(src.includes('--tile-face-pad'), 'не ставится поле рисунка');
    assertOk(/drawLink\(hintStyle !== 'normal'\)/.test(src), 'линия подсказки не привязана к стилю');
  });

  test('значения подсказки согласованы с таблицей options.js', () => {
    const m = src.match(/const HINT_STYLES = \[([^\]]+)\]/);
    assertOk(m, 'нет списка HINT_STYLES');
    OPT.CHOICES.hintStyle.values.forEach(v => {
      assertOk(m[1].includes("'" + v + "'"), 'нет значения ' + v);
    });
  });

  test('лица берутся из текущего скина через Render.faceHtml', () => {
    assertOk(/Tileset\.tiles\.filter/.test(src), 'фишки ищутся в Tileset');
    assertOk(/Render\.faceHtml\(/.test(src), 'лица рисует Render.faceHtml');
    assertOk(/activeSkinId/.test(src), 'легенда называет активный скин');
  });

  test('модуль грузится в песочнице без DOM и не падает', () => {
    const App = { state: {} };
    const document = { addEventListener() {} };
    vm.runInNewContext(src, {
      App, document,
      Tileset: undefined, Render: undefined, Storage: undefined,
    });
    assertOk(typeof App.previewSync === 'function', 'нет App.previewSync');
    assertOk(typeof App.previewBuild === 'function', 'нет App.previewBuild');
  });
});

suite('v38: событие настроек рассылается из мест изменения', () => {

  test('core.js объявляет notifySettings', () => {
    const core = read('js/app/core.js');
    assertOk(/function notifySettings\(/.test(core), 'нет функции');
    assertOk(/CustomEvent\('mahjong:settings'/.test(core), 'нет CustomEvent');
    assertOk(/notifySettings,/.test(core), 'не экспортирована в App');
  });

  test('options.js извещает о выборах, тумблерах и пресетах', () => {
    const options = read('js/app/options.js');
    const n = (options.match(/A\.notifySettings\(/g) || []).length;
    assertEq(n, 3, 'должно быть 3 рассылки: выбор, тумблер, пресет (есть: ' + n + ')');
  });

  test('skins.js и settings.js извещают о скине и прозрачности', () => {
    const settings = read('js/app/settings.js');
    assertOk(read('js/app/skins.js').includes("A.notifySettings('tileSkin'"), 'нет рассылки о скине');
    assertOk(settings.includes("A.notifySettings('tileTransparency'"), 'нет рассылки о прозрачности');
  });
});

suite('v39: доработка экранчика и подсветки «выкл»', () => {

  test('highlight.css: при «выкл» все фишки плотные и не приглушены', () => {
    const css = read('css/highlight.css');
    assertOk(/body\[data-hl="off"\] \.tile:not\(\.free\)[^{]*\{[^}]*opacity: 1[^}]*filter: none/.test(css),
      'нет правила, снимающего стиль «закрытых» при подсветке «выкл»');
  });

  test('сцена: подписи одного ряда не наезжают друг на друга', () => {
    const src = read('js/app/preview.js');
    const re = /label: \['([^']+)', (\d+), (\d+)\]/g;
    const rows = {};
    let m;
    while ((m = re.exec(src))) {
      (rows[m[3]] = rows[m[3]] || []).push({ text: m[1], cx: +m[2] });
    }
    Object.keys(rows).forEach(y => {
      const r = rows[y].sort((a, b) => a.cx - b.cx);
      for (let i = 1; i < r.length; i++) {
        // подпись ≈ 6.2 px на букву + поля 16 px (шрифт 9px, uppercase)
        const w = (t) => t.length * 6.2 + 16;
        const gap = r[i].cx - r[i - 1].cx - (w(r[i].text) + w(r[i - 1].text)) / 2;
        assertOk(gap >= 0, 'подписи «' + r[i - 1].text + '» и «' + r[i].text + '» наезжают');
      }
    });
  });

  test('легенда: при «выкл» не обещает стеклянных закрытых фишек', () => {
    const src = read('js/app/preview.js');
    assertOk(src.includes("hl === 'off' ? 'как доступные"), 'легенда не учитывает подсветку «выкл»');
  });
});
