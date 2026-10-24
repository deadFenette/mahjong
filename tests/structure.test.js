/* ============================================================
   TESTS/STRUCTURE.TEST.JS — Модульность исходников (v33)

   js/app.js и css/main.css разрезаны на модули. Эти тесты не дают
   им снова разрастись в монолиты и следят, чтобы всё было подключено.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { mainCssFiles, appFiles } = require('./sources');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const lines = f => read(f).split('\n').length;
const html = read('index.html');
const sw = read('sw.js');

suite('Модули app: js/app/*.js', () => {
  const files = appFiles();

  test('старого монолита js/app.js нет, модулей — не меньше 10', () => {
    assertOk(!fs.existsSync(path.join(ROOT, 'js/app.js')), 'js/app.js должен быть удалён');
    assertOk(files.length >= 10, 'модулей: ' + files.length);
  });

  test('core.js подключён первым, init.js — последним', () => {
    assertEq(files[0], 'js/app/core.js');
    assertEq(files[files.length - 1], 'js/app/init.js');
  });

  test('все модули лежат на диске, в service worker и подключены после game.js', () => {
    const iGame = html.indexOf('js/game.js');
    for (const f of files) {
      assertOk(fs.existsSync(path.join(ROOT, f)), f + ' отсутствует');
      assertOk(sw.includes("'./" + f + "'"), f + ' не в кэше SW');
      assertOk(html.indexOf(f) > iGame, f + ' раньше game.js');
    }
  });

  test('каждый модуль ≤ 400 строк (иначе пора резать дальше)', () => {
    for (const f of files) assertOk(lines(f) <= 400, `${f}: ${lines(f)} строк`);
  });

  test('каждый модуль — IIFE над общим App и в strict-режиме; App объявлен один раз (core)', () => {
    for (const f of files) {
      const src = read(f);
      assertOk(src.includes("})(App);"), f + ': нет (function (A) {...})(App)');
      assertOk(src.includes("'use strict'"), f + ': нет strict');
      const declares = /^const App\b/m.test(src);
      assertEq(declares, f === 'js/app/core.js', f + ': объявление App');
    }
  });

  test('init.js запускает приложение на DOMContentLoaded', () => {
    assertOk(/addEventListener\('DOMContentLoaded', App\.init\)/.test(read('js/app/init.js')));
  });

  test('публичный API: App.init и App.onTileClick (его зовёт Render) экспортируются', () => {
    assertOk(/Object\.assign\(A, \{[^}]*\binit,/.test(read('js/app/init.js')));
    assertOk(/Object\.assign\(A, \{[^}]*\bonTileClick,/.test(read('js/app/play.js')));
  });

  test('общее состояние лежит в App.state (core.js) и не дублируется локально', () => {
    const core = read('js/app/core.js');
    for (const k of ['currentScreen', 'hintTimer', 'lastActionTime', 'endlessLayouts', 'mixOpts']) {
      assertOk(new RegExp('^    ' + k + ':', 'm').test(core), k + ' не в App.state');
      for (const f of files) {
        assertOk(!new RegExp('^  let ' + k + '\\b', 'm').test(read(f)), `${f}: локальный let ${k}`);
      }
    }
  });
});

suite('Модули CSS: css/*.css', () => {
  const files = mainCssFiles();

  test('старого монолита css/main.css нет, модулей — не меньше 10', () => {
    assertOk(!fs.existsSync(path.join(ROOT, 'css/main.css')), 'css/main.css должен быть удалён');
    assertOk(files.length >= 10, 'модулей: ' + files.length);
  });

  test('все CSS-модули лежат на диске и закэшированы service worker', () => {
    for (const f of files) {
      assertOk(fs.existsSync(path.join(ROOT, f)), f + ' отсутствует');
      assertOk(sw.includes("'./" + f + "'"), f + ' не в кэше SW');
    }
  });

  test('каждый CSS-модуль ≤ 400 строк', () => {
    for (const f of files) assertOk(lines(f) <= 400, `${f}: ${lines(f)} строк`);
  });

  test('base.css первым, lite.css по-прежнему последним (перебивает всё)', () => {
    assertEq(files[0], 'css/base.css');
    const links = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"/g)].map(m => m[1]);
    assertEq(links[links.length - 1], 'css/lite.css');
  });
});

suite('Скрипты скинов — зависимости', () => {
  test('tileset-core.js нужен pictures/clear и подключён раньше них', () => {
    const at = f => html.indexOf('js/' + f + '.js');
    assertOk(at('tileset-core') < at('tileset-pictures') && at('tileset-core') < at('tileset-clear'));
  });
});
