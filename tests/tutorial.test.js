/* ============================================================
   TESTS/TUTORIAL.TEST.JS — v12: обучение
   Каталог шагов и навигация (чистая логика Tutorial), флаг
   tutorialSeen в Storage, разметка index.html, стили main.css
   и кэш Service Worker.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq, assertGte } = require('./runner');
const { loadGameModules } = require('./load');

const { Tutorial, Storage } = loadGameModules();

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mainCss = fs.readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const swJs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// ============================================================
suite('Обучение — каталог шагов', () => {
  test('шагов не меньше пяти', () => {
    assertGte(Tutorial.slideCount(), 5);
    assertEq(Tutorial.SLIDES.length, Tutorial.slideCount());
  });

  test('каждый шаг: уникальный id, иконка, заголовок и текст', () => {
    const ids = new Set();
    Tutorial.SLIDES.forEach(s => {
      assertOk(s && typeof s === 'object', 'шаг — объект');
      assertOk(typeof s.id === 'string' && s.id.length > 0, 'id не пуст');
      assertOk(!ids.has(s.id), 'id уникален: ' + s.id);
      ids.add(s.id);
      assertOk(typeof s.icon === 'string' && s.icon.length > 0, 'иконка не пуста');
      assertOk(typeof s.title === 'string' && s.title.length > 0, 'заголовок не пуст');
      assertOk(typeof s.text === 'string' && s.text.length >= 20, 'текст содержательный');
    });
  });

  test('последний шаг — финал с приглашением играть', () => {
    const last = Tutorial.SLIDES[Tutorial.slideCount() - 1];
    assertEq(last.id, 'play');
  });

  test('есть шаг про свободные фишки и шаг про слои', () => {
    const ids = Tutorial.SLIDES.map(s => s.id);
    assertOk(ids.includes('free'), 'шаг «свободная фишка»');
    assertOk(ids.includes('layers'), 'шаг «как различать слои»');
    assertOk(ids.includes('pairs'), 'шаг «убирайте пары»');
  });
});

// ============================================================
suite('Обучение — навигация (чистая)', () => {
  const N = Tutorial.slideCount();
  const LAST = N - 1;

  test('clampIndex: границы прижимаются к краям', () => {
    assertEq(Tutorial.clampIndex(0), 0);
    assertEq(Tutorial.clampIndex(LAST), LAST);
    assertEq(Tutorial.clampIndex(-5), 0);
    assertEq(Tutorial.clampIndex(100), LAST);
  });

  test('clampIndex: мусор → шаг 0, дробное → floor', () => {
    assertEq(Tutorial.clampIndex(NaN), 0);
    assertEq(Tutorial.clampIndex('abc'), 0);
    assertEq(Tutorial.clampIndex(undefined), 0);
    assertEq(Tutorial.clampIndex(null), 0);
    assertEq(Tutorial.clampIndex({}), 0);
    assertEq(Tutorial.clampIndex(2.7), 2);
  });

  test('nextIndex растёт и упирается в последний шаг', () => {
    assertEq(Tutorial.nextIndex(0), 1);
    assertEq(Tutorial.nextIndex(LAST), LAST);
    assertEq(Tutorial.nextIndex(100), LAST);
  });

  test('prevIndex убывает и упирается в первый шаг', () => {
    assertEq(Tutorial.prevIndex(1), 0);
    assertEq(Tutorial.prevIndex(0), 0);
    assertEq(Tutorial.prevIndex(LAST), LAST - 1);
    assertEq(Tutorial.prevIndex(-3), 0);
  });

  test('isFirstIndex / isLastIndex', () => {
    assertOk(Tutorial.isFirstIndex(0));
    assertOk(!Tutorial.isFirstIndex(1));
    assertOk(Tutorial.isLastIndex(LAST));
    assertOk(!Tutorial.isLastIndex(LAST - 1));
    // Мусор считается первым шагом
    assertOk(Tutorial.isFirstIndex('x'));
  });

  test('stepLabel: «Шаг 1 из N», мусор → первый', () => {
    assertEq(Tutorial.stepLabel(0), 'Шаг 1 из ' + N);
    assertEq(Tutorial.stepLabel(LAST), 'Шаг ' + N + ' из ' + N);
    assertEq(Tutorial.stepLabel(NaN), 'Шаг 1 из ' + N);
  });
});

// ============================================================
suite('Обучение — флаг tutorialSeen (Storage)', () => {
  // Свежая песочница: чистый localStorage
  const { Tutorial: T, Storage: S } = loadGameModules();

  test('по умолчанию обучение НЕ показано (автопоказ у новичка)', () => {
    assertEq(S.getSetting('tutorialSeen', false), false);
    assertEq(T.isSeen(), false);
  });

  test('markSeen пишет настройку и isSeen становится true', () => {
    T.markSeen();
    assertEq(T.isSeen(), true);
    assertEq(S.getSetting('tutorialSeen', false), true);
  });

  test('чтение без fallback тоже даёт true (парсинг строки настройки)', () => {
    assertEq(S.getSetting('tutorialSeen'), true);
  });

  test('повторный markSeen безвреден', () => {
    T.markSeen();
    T.markSeen();
    assertEq(T.isSeen(), true);
  });
});

// ============================================================
suite('Обучение — разметка index.html', () => {
  test('кнопка «Обучение» в главном меню', () => {
    assertOk(indexHtml.includes('id="btn-tutorial"'), 'кнопка btn-tutorial');
    assertOk(indexHtml.includes('>Обучение</span>'), 'подпись «Обучение»');
  });

  test('оверлей туториала присутствует и скрыт по умолчанию', () => {
    assertOk(indexHtml.includes('id="tutorial-overlay"'), 'контейнер оверлея');
    const m = indexHtml.match(/id="tutorial-overlay"[^>]*/);
    assertOk(m && m[0].includes('hidden'), 'оверлей скрыт до открытия');
  });

  test('все служебные id на месте', () => {
    ['tutorial-step', 'tutorial-slides', 'tutorial-dots',
     'tutorial-prev', 'tutorial-next', 'tutorial-play', 'tutorial-skip']
      .forEach(id => assertOk(indexHtml.includes('id="' + id + '"'), 'id ' + id));
  });

  test('в разметке столько же слайдов, сколько в каталоге', () => {
    // Точное совпадение: container (.tutorial-slides) и иконки
    // (.tutorial-slide-icon) не должны попадать в подсчёт
    const count = (indexHtml.match(/class="tutorial-slide(?: active)?"/g) || []).length;
    assertEq(count, Tutorial.slideCount());
  });

  test('каждый слайд пронумерован data-slide и имеет h3+p', () => {
    Tutorial.SLIDES.forEach((s, i) => {
      const re = new RegExp('class="tutorial-slide[^"]*" data-slide="' + i + '"');
      assertOk(re.test(indexHtml), 'слайд ' + i + ' с data-slide');
    });
    assertOk(indexHtml.includes('<h3>Добро пожаловать!</h3>'));
    assertOk(indexHtml.includes('<h3>Как различать слои</h3>'));
  });

  test('схемы: мини-фишки, значки, вердикты', () => {
    ['tut-tile', 'tut-badge ok', 'tut-badge no', 'tut-verdict',
     'tut-pyramid', 'tut-pair', 'tut-covered', 'tut-stack', 'tut-chip']
      .forEach(cls => assertOk(indexHtml.includes(cls), 'класс ' + cls));
  });

  test('script tutorial.js подключён до app.js', () => {
    const iTut = indexHtml.indexOf('js/tutorial.js');
    const iApp = indexHtml.indexOf('js/app.js');
    assertOk(iTut !== -1, 'tutorial.js подключён');
    assertOk(iApp !== -1, 'app.js подключён');
    assertOk(iTut < iApp, 'tutorial.js раньше app.js');
  });
});

// ============================================================
suite('Обучение — стили main.css', () => {
  test('ключевые классы оформлены', () => {
    ['.tutorial-card', '.tutorial-slide.active', '.tutorial-step',
     '.tutorial-skip', '.tut-dot.active', '.tutorial-nav',
     '.tut-tile.dim', '.tut-tile.glow', '.tut-badge.ok', '.tut-badge.no',
     '.tut-scene', '.tut-chip.gold', '.tut-btn-icon']
      .forEach(sel => assertOk(mainCss.includes(sel), 'селектор ' + sel));
  });

  test('мини-фишки используют переменные тем (адаптация ко всем темам)', () => {
    const block = mainCss.slice(mainCss.indexOf('TUTORIAL (v12)'));
    assertOk(block.includes('var(--tile-bg)'), 'фон фишки из темы');
    assertOk(block.includes('var(--tile-border)'), 'рамка фишки из темы');
    assertOk(block.includes('var(--accent-gold-glow)'), 'свечение из темы');
    assertOk(block.includes('var(--bg-screen)'), 'фон карточки из темы');
  });

  test('скрытый слайд не отображается, активный — flex', () => {
    assertOk(/\.tutorial-slide\s*\{[^}]*display:\s*none/.test(mainCss),
      'базовый слайд скрыт');
    assertOk(/\.tutorial-slide\.active\s*\{[^}]*display:\s*flex/.test(mainCss),
      'активный слайд показывается');
  });

  test('есть мобильный адаптив туториала', () => {
    assertOk(/@media \(max-width:\s*480px\)[\s\S]*\.tut-tile/.test(mainCss),
      'медиазапрос с уменьшенными мини-фишками');
  });
});

// ============================================================
suite('Обучение — Service Worker', () => {
  test('кэш переименован под v12 (tutorial)', () => {
    assertOk(swJs.includes('mahjong-v14-tutorial'), 'CACHE_NAME обновлён');
    assertOk(!swJs.includes('mahjong-v13-combo'), 'старое имя кэша убрано');
  });

  test('tutorial.js попадает в офлайн-кэш', () => {
    assertOk(swJs.includes("'./js/tutorial.js'"), 'tutorial.js в ASSETS');
  });
});
