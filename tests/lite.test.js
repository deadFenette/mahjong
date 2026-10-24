/* ============================================================
   TESTS/LITE.TEST.JS — SVG-иконки и «лёгкий режим» (v32)
   Ловит возвращение эмодзи в интерфейс (на Windows 7 они —
   пустые квадраты), потерянные иконки, сбои автоопределения
   слабого ПК и забытые тяжёлые эффекты в lite.css.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { Icons, Perf, Achievements, Tutorial } = loadGameModules();
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const stripComments = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Эмодзи и «символы-картинки», которых нет в шрифтах Windows 7
const PICTO = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\u23E9-\u23FF\u2300-\u23FF\u25A0-\u25FF\u221E\uFE0F]/u;

const UA = {
  win7chrome109: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  win7firefox:   'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
  winXP:         'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36',
  vista:         'Mozilla/5.0 (Windows NT 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0 Safari/537.36',
  win10chrome:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  win81chrome:   'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  macSafari:     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  oldChrome:     'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Safari/537.36',
  oldFirefox:    'Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0',
};

suite('Icons — векторные иконки вместо эмодзи', () => {

  test('у каждой иконки есть непустой SVG с viewBox и без текста-символов', () => {
    Icons.names.forEach(n => {
      const svg = Icons.get(n);
      assertOk(/^<svg [^>]*viewBox="0 0 \d+ \d+"/.test(svg), 'нет viewBox у ' + n);
      assertOk(svg.length > 120, 'слишком короткая иконка ' + n);
      assertOk(!PICTO.test(svg), 'в SVG «' + n + '» попал символ шрифта');
    });
  });

  test('есть все иконки, нужные интерфейсу (в т.ч. карточки бесконечного режима)', () => {
    ['leaf', 'bamboo', 'maple', 'back', 'next', 'check', 'cross', 'play', 'skip', 'note',
      'star', 'gem', 'spark', 'combo', 'rosette', 'flower', 'infinity', 'flag', 'layers']
      .forEach(n => assertOk(Icons.names.includes(n), 'нет иконки ' + n));
  });

  test('старые символы и эмодзи сопоставлены с новыми иконками (алиасы)', () => {
    for (const [glyph, name] of Object.entries(Icons.ALIAS)) {
      assertOk(Icons.names.includes(name), `алиас ${glyph} → ${name}: такой иконки нет`);
      assertOk(Icons.get(glyph).startsWith('<svg'), 'алиас не даёт SVG: ' + glyph);
    }
  });

  test('неизвестное имя даёт пустую строку, а не поломанную разметку', () => {
    assertEq(Icons.get('нет-такой'), '');
    assertEq(Icons.has('нет-такой'), false);
  });

  test('все data-icon в index.html существуют', () => {
    const html = read('index.html');
    const names = [...html.matchAll(/data-icon="([^"]+)"/g)].map(m => m[1]);
    assertOk(names.length >= 20, 'иконок в разметке подозрительно мало: ' + names.length);
    names.forEach(n => assertOk(Icons.has(n), 'в index.html неизвестная иконка: ' + n));
  });

  test('hydrate подставляет SVG во все элементы с data-icon', () => {
    const els = ['leaf', 'next', 'нет-такой'].map(n => {
      const classes = new Set();
      return { html: '', classes, getAttribute: a => (a === 'data-icon' ? n : null),
        set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; },
        classList: { add: c => classes.add(c) } };
    });
    const count = Icons.hydrate({ querySelectorAll: () => els });
    assertEq(count, 2);
    assertOk(els[0].html.startsWith('<svg') && els[1].html.startsWith('<svg'));
    assertEq(els[2].html, '', 'неизвестная иконка не должна ничего вставлять');
  });

  test('в видимой разметке index.html нет эмодзи и символов-картинок', () => {
    const html = stripComments(read('index.html'));
    const body = html.slice(html.indexOf('<body'));
    const bad = [];
    body.split('\n').forEach((line, i) => { if (PICTO.test(line)) bad.push((i + 1) + ': ' + line.trim().slice(0, 70)); });
    assertEq(bad.length, 0, 'эмодзи в разметке: ' + bad.join(' | '));
  });

  test('достижения и обучение используют имена иконок, а не символы', () => {
    Achievements.LIST.forEach(a => {
      assertOk(Icons.has(a.icon), 'достижение «' + a.id + '»: неизвестная иконка ' + a.icon);
      assertOk(!PICTO.test(a.icon), 'символ вместо имени иконки: ' + a.id);
    });
    // Приветственный слайд показывает иероглиф «как на фишке» — это не эмодзи,
    // а тот же шрифт, что рисует сами фишки; допустимы имя иконки или один иероглиф.
    Tutorial.SLIDES.forEach(s => assertOk(Icons.has(s.icon) || /^[\u4e00-\u9fff]$/.test(s.icon),
      'слайд «' + s.id + '»: иконка ' + s.icon));
  });

  test('строки интерфейса в app.js не содержат эмодзи', () => {
    const lines = require('./sources').appSource().split('\n');
    const bad = [];
    lines.forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, '');
      if (PICTO.test(code)) bad.push((i + 1) + ': ' + l.trim().slice(0, 60));
    });
    assertEq(bad.length, 0, 'эмодзи в app.js: ' + bad.join(' | '));
  });
});

suite('Perf — автоопределение слабого компьютера', () => {

  test('Windows XP / Vista / 7 — слабая среда', () => {
    [UA.win7chrome109, UA.win7firefox, UA.winXP, UA.vista].forEach(ua =>
      assertEq(Perf.isLowEnd({ ua }), true, ua.slice(0, 50)));
  });

  test('Windows 8.1 / 10 и свежие браузеры — не слабая среда', () => {
    [UA.win10chrome, UA.win81chrome, UA.macSafari].forEach(ua =>
      assertEq(Perf.isLowEnd({ ua, cores: 8, memory: 8 }), false, ua.slice(0, 50)));
  });

  test('старые Chrome и Firefox — слабая среда', () => {
    assertEq(Perf.isLowEnd({ ua: UA.oldChrome }), true);
    assertEq(Perf.isLowEnd({ ua: UA.oldFirefox }), true);
  });

  test('≤2 ядер или ≤2 ГБ памяти — слабая среда; неизвестное железо — нет', () => {
    assertEq(Perf.isLowEnd({ ua: UA.win10chrome, cores: 2 }), true);
    assertEq(Perf.isLowEnd({ ua: UA.win10chrome, cores: 8, memory: 2 }), true);
    assertEq(Perf.isLowEnd({ ua: UA.win10chrome }), false);
    assertEq(Perf.isLowEnd({}), false);
    assertEq(Perf.isLowEnd(), false);
  });

  test('resolve: явный выбор игрока важнее автоопределения', () => {
    assertEq(Perf.resolve('lite', false, false), 'lite');
    assertEq(Perf.resolve('full', true, true), 'full');
    assertEq(Perf.resolve('auto', true, false), 'lite');
    assertEq(Perf.resolve('auto', false, true), 'lite');
    assertEq(Perf.resolve('auto', false, false), 'full');
    assertEq(Perf.resolve('мусор', false, false), 'full');
  });

  test('normalizeMode: неизвестное значение → auto', () => {
    assertEq(Perf.normalizeMode('lite'), 'lite');
    assertEq(Perf.normalizeMode('xyz'), 'auto');
    assertEq(Perf.normalizeMode(null), 'auto');
  });

  test('fpsFromDeltas: считает кадры в секунду', () => {
    assertEq(Math.round(Perf.fpsFromDeltas([16.67, 16.67, 16.67])), 60);
    assertEq(Math.round(Perf.fpsFromDeltas([50, 50, 50, 50])), 20);
    assertEq(Perf.fpsFromDeltas([]), 60);
  });

  test('setMode сохраняет выбор и переключает режим', () => {
    assertEq(Perf.setMode('lite'), 'lite');
    assertEq(Perf.isLite(), true);
    assertEq(Perf.getMode(), 'lite');
    assertEq(Perf.setMode('full'), 'full');
    assertEq(Perf.isLite(), false);
    Perf.setMode('auto');
    assertEq(Perf.getMode(), 'auto');
  });
});

suite('Лёгкий режим — CSS и подключение', () => {

  const lite = read('css/lite.css');
  const main = require('./sources').mainCss();
  const html = read('index.html');

  test('lite.css подключён ПОСЛЕДНИМ из стилей (перебивает остальные)', () => {
    const links = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"/g)].map(m => m[1]);
    assertEq(links[links.length - 1], 'css/lite.css');
  });

  test('perf.js грузится в <head> до стилей — режим применяется до первой отрисовки', () => {
    const iPerf = html.indexOf('<script src="js/perf.js">');
    const iCss = html.indexOf('<link rel="stylesheet"');
    const iBody = html.indexOf('<body');
    assertOk(iPerf > 0 && iPerf < iCss && iPerf < iBody, 'perf.js должен быть первым в head');
  });

  test('каждый селектор с backdrop-filter из main.css отключён в lite.css', () => {
    const sels = [];
    const re = /([^{}]+)\{[^{}]*backdrop-filter[^{}]*\}/g;
    let m;
    while ((m = re.exec(stripComments(main))) !== null) {
      m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => sels.push(s));
    }
    assertOk(sels.length >= 5, 'не нашли селекторов с blur: ' + sels.length);
    sels.forEach(s => assertOk(lite.includes('html[data-perf="lite"] ' + s),
      'blur остался включённым в лёгком режиме: ' + s));
  });

  test('бесконечные анимации меню выключены в лёгком режиме', () => {
    ['.dust-mote', '.menu-decor-cloud', '.menu-lantern', '.menu-dust'].forEach(s =>
      assertOk(lite.includes('html[data-perf="lite"] ' + s), 'не отключено: ' + s));
  });

  test('у фишек в лёгком режиме нет filter и размытых теней', () => {
    const tileRules = lite.match(/html\[data-perf="lite"\] \.tile[^{]*\{[^}]*\}/g) || [];
    assertOk(tileRules.length >= 6, 'мало правил для фишек');
    tileRules.forEach(r => {
      assertOk(!/blur\(/.test(r) && !/drop-shadow/.test(r), 'тяжёлый эффект: ' + r.slice(0, 60));
      const shadows = r.match(/\d+px\s+(\d+px)\s+\d+px\s+var\(--shadow/g) || [];
      assertEq(shadows.length, 0, 'размытая тень у фишки: ' + r.slice(0, 60));
    });
  });

  test('SVG-шум (feTurbulence) отключается в лёгком режиме', () => {
    assertOk(/--grain-wood:\s*none/.test(lite) && /--noise-cloth:\s*none/.test(lite));
  });

  test('запасной фон для браузеров без color-mix (Chrome < 111)', () => {
    const i = main.indexOf('color-mix(');
    assertOk(i > 0);
    const before = main.slice(Math.max(0, i - 400), i);
    assertOk(/rgba\(212, 169, 85/.test(before), 'нет запасной строки перед color-mix');
  });

  test('настройка «Графика»: три режима, обработчик и сторож кадров подключены', () => {
    assertEq((html.match(/data-perf-mode="(auto|lite|full)"/g) || []).length, 3);
    const app = require('./sources').appSource();
    assertOk(app.includes('Perf.setMode'), 'нет Perf.setMode');
    assertOk(app.includes('Perf.watch'), 'нет сторожа кадров');
    assertOk(app.includes('Icons.hydrate()'), 'иконки не подставляются при запуске');
  });

  test('в лёгком режиме реверберация короче', () => {
    assertOk(/Perf\.isLite\(\)\) \? 1\.2 : 2\.8/.test(read('js/music.js')));
    assertOk(/Perf\.isLite\(\)\) \? 0\.6 : 1\.4/.test(read('js/audio.js')));
  });

  test('sw.js кэширует новые файлы', () => {
    const sw = read('sw.js');
    ['./css/lite.css', './js/icons.js', './js/perf.js'].forEach(f =>
      assertOk(sw.includes(f), 'нет в кэше: ' + f));
  });
});
