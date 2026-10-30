/* ============================================================
   TESTS/SOURCES.JS — Чтение разрезанных исходников (v33)

   css/main.css разрезан на модули (base, buttons, select, game, ...).
   Порядок подключения в index.html и есть порядок каскада, поэтому
   список берём ОТТУДА: тест читает ровно то, что получит браузер.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Файлы, которые раньше были одним main.css (всё, что подключено до tiles.css)
function mainCssFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"/g)].map(m => m[1]);
  const upTo = links.indexOf('css/tiles.css');
  return links.slice(links.indexOf('css/fonts.css') + 1, upTo);
}

function mainCss() {
  return mainCssFiles().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

// js/app.js разрезан на js/app/*.js — порядок берём из index.html
function appFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="(js\/app\/[^"]+)"/g)].map(m => m[1]);
}
function appSource() {
  return appFiles().map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

module.exports = { mainCss, mainCssFiles, appSource, appFiles };
