#!/usr/bin/env node
/* ============================================================
   TESTS/RUN.JS — Точка входа тестов маджонга
   Запуск:  node tests/run.js
   Ноль зависимостей: только Node.js.
   Выход: код 0 — все тесты зелёные, 1 — есть падения.
   ============================================================ */

'use strict';

require('./layouts.test.js');
require('./tileset.test.js');
require('./game.test.js');
require('./render-math.test.js');
require('./storage.test.js');
require('./appearance.test.js');
require('./animations.test.js');
require('./improvements.test.js');
require('./music.test.js');
require('./combo.test.js');
require('./tutorial.test.js');

const { report } = require('./runner');
const ok = report();
process.exit(ok ? 0 : 1);
