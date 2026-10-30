/* ============================================================
   TESTS/SMOKE-DOM.JS — Дымовой тест в настоящем DOM (v33)

   Запуск:  npm i --no-save jsdom && node tests/smoke-dom.js
   (проект остаётся без зависимостей: jsdom нужен только для этого
   файла, основной набор `node tests/run.js` его не требует.)

   Поднимает index.html на локальном сервере, ждёт загрузки ВСЕХ
   скриптов (в том числе js/app/*.js), запускает партию, жмёт
   подсказку/перемешать/отмену, открывает паузу, настройки, все
   четыре скина, «Микс» и «Ежедневную» — и падает на любой ошибке JS.
   ============================================================ */

'use strict';
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(b); } });
});
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
(async () => {
  await new Promise(r => server.listen(0, r));
  const dom = await JSDOM.fromURL('http://127.0.0.1:' + server.address().port + '/', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  w.addEventListener('error', e => errors.push('window error: ' + e.message));
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 300));
  const d = w.document, ev = c => w.eval(c);
  const log = (...a) => console.log(...a);
  // v38: check нужен и блоку превью (идёт ниже), выносим выше
  const check = (name, cond) => { if (!cond) errors.push('CHECK FAILED: ' + name); log((cond ? 'ok   ' : 'FAIL ') + name); };
  log('screen after load:', d.body.dataset.screen);
  log('App keys:', Object.keys(ev('App')).length);
  // navigate: layouts gallery
  d.getElementById('btn-classic').click();
  await new Promise(r => setTimeout(r, 100));
  log('screen:', d.body.dataset.screen, 'layout cards:', d.querySelectorAll('#screen-layouts .layout-card, #layouts-grid > *').length);
  ev("App.startClassic('pyramid')");
  await new Promise(r => setTimeout(r, 600));
  log('screen:', d.body.dataset.screen, 'tiles in DOM:', d.querySelectorAll('#board .tile').length);
  // interaction: hint, shuffle, undo, zoom, pause
  ev('App.actHint()'); ev('App.actShuffle()'); ev('App.actUndo()'); ev('App.actZoom(1)');
  const st = ev('Game.getState()'); log('pairs/moves state ok:', !!st);
  // click a real matching pair
  const pair = ev(`(function(){const s=Game.getState();const f=Game.getFreeTiles?Game.getFreeTiles():null;return f?f.length:-1})()`);
  log('free tiles:', pair);
  d.getElementById('game-menu').click();
  await new Promise(r => setTimeout(r, 100));
  log('pause visible:', d.getElementById('pause-overlay').hidden === false);
  // settings + skins
  ev("App.showScreen('settings')");
  log('skin samples rendered:', Array.from(d.querySelectorAll('.skin-card')).map(c => c.querySelectorAll('.skin-sample-tile').length).join(','));
  for (const id of ['pictures', 'clear', 'ornate', 'classic']) {
    d.querySelector('.skin-card[data-skin="' + id + '"]').click();
    await new Promise(r => setTimeout(r, 50));
    log('skin', id, '→ active:', ev('Tileset.activeSkinId()'), 'card active:', d.querySelector('.skin-card.active').dataset.skin);
  }
  for (const t of ['jade', 'porcelain', 'imperial']) { const c = d.querySelector('.theme-card[data-theme="' + t + '"]'); if (c) c.click(); }
  // ---------- v38: живое превью на экране настроек ----------
  check('превью: сцена из 7 фишек собрана', d.querySelectorAll('#preview-board .tile').length === 7);
  check('превью: 5 подписей на сукне и легенда снизу',
    d.querySelectorAll('#preview-board .preview-label').length === 5 &&
    d.querySelectorAll('#preview-legend .preview-legend-row').length >= 5);
  const pvFreeN = () => d.querySelectorAll('#preview-board .tile.free').length;
  const pvTwin = d.querySelector('#preview-board .tile[data-role="twin"]');
  const pvHint = d.querySelector('#preview-board .tile[data-role="hintA"]');
  ev("App.applyChoice('highlightLevel','off',{silent:true})");
  check('превью: «Выкл» гасит подсветку всех фишек', pvFreeN() === 0);
  ev("App.applyChoice('highlightLevel','bold',{silent:true})");
  check('превью: «Яркая» подсвечивает свободные', pvFreeN() > 0);
  ev("App.applyChoice('hintStyle','bold',{silent:true})");
  check('превью: подсказка «Заметная» — рамка и линия', pvHint.classList.contains('hint-bold') && d.querySelectorAll('#preview-board .hint-link line').length === 2);
  ev("App.applyChoice('hintStyle','normal',{silent:true})");
  check('превью: обычная подсказка — без линии', !pvHint.classList.contains('hint-bold') && d.querySelectorAll('#preview-board .hint-link').length === 0);
  ev("App.applyToggle('showMatches', true, {silent:true})");
  check('превью: двойник обведён пунктиром', pvTwin.classList.contains('match-cand'));
  ev("App.applyToggle('showMatches', false, {silent:true})");
  check('превью: двойник без рамки', !pvTwin.classList.contains('match-cand'));
  // other screens
  ev("App.openMixScreen()"); await new Promise(r => setTimeout(r, 200)); log('mix screen:', d.body.dataset.screen);
  ev("App.showScreen('menu')");
  ev("App.startDaily()"); await new Promise(r => setTimeout(r, 400)); log('daily screen:', d.body.dataset.screen);
  // ---------- v34: подсветка, лупа, автомасштаб ----------
  // jsdom не считает раскладку: подсовываем столу «экранные» размеры
  const stage = d.getElementById('board-stage');
  Object.defineProperty(stage, 'clientWidth', { configurable: true, get: () => 1200 });
  Object.defineProperty(stage, 'clientHeight', { configurable: true, get: () => 640 });
  ev("App.applyTileSize('large')"); // выше нажимали «+» (xl = 118% стола, прокрутка там задумана)
  ev("App.showScreen('menu')");
  ev("App.startClassic('pyramid')");
  await new Promise(r => setTimeout(r, 300));
  ev('Render.reposition()');
  const w0 = ev('Render.getTileSize().w');
  check('размер фишек посчитан по подменённому столу (' + w0 + ' px)', w0 > 30);

  // настройки применяются и ложатся в body
  ev("App.applyChoice('highlightLevel','focus',{silent:true})");
  ev("App.applyChoice('selectStyle','bold',{silent:true})");
  check('data-hl и data-sel выставлены', d.body.dataset.hl === 'focus' && d.body.dataset.sel === 'bold');
  check('старый ключ highlight синхронизирован', ev("Storage.getSetting('highlight', null)") === true);
  ev("App.applyChoice('highlightLevel','off',{silent:true})");
  check('«Выкл» снимает подсветку свободных', d.querySelectorAll('#board .tile.free').length === 0 && ev("Storage.getSetting('highlight', null)") === false);
  ev("App.applyChoice('highlightLevel','bold',{silent:true})");
  check('«Яркая» снова подсвечивает свободные', d.querySelectorAll('#board .tile.free').length > 0);
  ev("App.applyChoice('hintStyle','nonsense',{silent:true})");
  check('мусорное значение → значение по умолчанию', ev("Storage.getSetting('hintStyle', null)") === 'normal');

  // подсказка «очень заметная»: рамка, линия, держится до хода
  ev("App.applyChoice('hintStyle','max',{silent:true})");
  ev('App.actHint()');
  check('подсказка: 2 фишки с .hint-max', d.querySelectorAll('#board .tile.hint.hint-max').length === 2);
  // v42: линий теперь 3 — ореол + бегущий пунктир + прорисовка (hint-link-draw)
  check('подсказка: линия между фишками нарисована', d.querySelectorAll('#board .hint-link line').length === 3);
  await new Promise(r => setTimeout(r, 2400));
  check('«очень заметная» не гаснет сама', d.querySelectorAll('#board .tile.hint-max').length === 2);
  ev('Render.clearHint()');
  check('clearHint снимает подсветку и линию', d.querySelectorAll('#board .tile.hint, #board .hint-link').length === 0);
  ev("App.applyChoice('hintStyle','normal',{silent:true})");
  ev('App.actHint()');
  check('«обычная» подсказка — без линии', d.querySelectorAll('#board .hint-link').length === 0 && d.querySelectorAll('#board .tile.hint').length === 2);
  ev('Render.clearHint()');

  // выбор фишки: двойники и лупа
  ev("App.applyToggle('showMatches', true, {silent:true})");
  ev('(function(){const p=Game.findHint();App.onTileClick(p[0]);})()');
  check('выбранная фишка получила .selected', d.querySelectorAll('#board .tile.selected').length === 1);
  check('её свободный двойник обведён (.match-cand)', d.querySelectorAll('#board .tile.match-cand').length >= 1);
  check('лупа показала выбранную фишку', !d.getElementById('loupe').classList.contains('empty') && d.querySelector('#loupe .loupe-card svg') !== null);
  ev('(function(){const t=Game.getState().selected;App.onTileClick(t);})()');
  check('снятие выбора убирает двойников', d.querySelectorAll('#board .tile.match-cand').length === 0);
  ev("App.applyToggle('showMatches', false, {silent:true})");

  // автомасштаб: играем почти до конца и смотрим, как растёт фишка
  ev("App.applyToggle('autozoom', true, {silent:true})");
  ev('Render.reposition()');
  const wStart = ev('Render.getTileSize().w');
  ev(`(function(){
    for (let guard = 0; guard < 200; guard++) {
      const st = Game.getState();
      if (st.tiles.filter(t => !t.removed).length <= 16) break;
      const p = Game.findHint(); if (!p) break;
      Game.selectTile(p[0]); Game.selectTile(p[1]);
    }
  })()`);
  const left = ev('Game.getState().tiles.filter(t => !t.removed).length');
  const grew = ev('Render.refit()');
  const wEnd = ev('Render.getTileSize().w');
  log('автомасштаб: фишек осталось', left, '| размер', wStart, '→', wEnd);
  check('к концу партии refit() увеличил фишки', grew === true && wEnd > wStart * 1.08);
  const rect = ev(`(function(){const b=document.getElementById('board');return [parseFloat(b.style.width),parseFloat(b.style.height)]})()`);
  log('board rect', rect.join('x'), JSON.stringify(ev('Render.activeBounds(Game.getState().tiles)')), JSON.stringify(ev('Render.getTileSize()')), 'gap', ev('Render.getGap()'), 'lift', ev('Render.getZLift()'));
  check('доска влезает в стол (1200×640)', rect[0] <= 1200 && rect[1] <= 640);
  const offscreen = ev(`(function(){
    const alive = new Set(Game.getState().tiles.filter(t => !t.removed).map(t => String(t.id)));
    return [...document.querySelectorAll('.tile')].filter(e => alive.has(e.dataset.tileId))
      .some(e => parseFloat(e.style.left) < -1 || parseFloat(e.style.top) < -1);
  })()`);
  check('ни одна оставшаяся фишка не уехала за левый/верхний край', offscreen === false);
  ev("App.applyToggle('autozoom', false, {silent:true})");
  check('при выключенном автомасштабе refit() ничего не делает', ev('Render.refit()') === false);
  ev("App.applyToggle('autozoom', true, {silent:true})");

  // отмена: фишки вернулись — размер не больше, чем нужно для рамки
  ev('App.actUndo()');
  const wUndo = ev('Render.getTileSize().w');
  check('после отмены фишки уменьшились до размера, влезающего в стол', wUndo <= wEnd);

  // пресеты и крупный интерфейс
  ev("App.applyPreset('bright')");
  check('пресет «Крупно и ярко»: hl=bold, sel=bold, подсказка max, ×1.2', d.body.dataset.hl === 'bold' && d.body.dataset.sel === 'bold' &&
    ev("Storage.getSetting('hintStyle', null)") === 'max' && d.documentElement.style.getPropertyValue('--ui-k') === '1.2');
  check('пресет включил крупный рисунок и двойников', ev("Storage.getSetting('bigSymbols', null)") === true && ev("Storage.getSetting('showMatches', null)") === true);
  ev("App.applyPreset('default')");
  check('пресет «Обычные» вернул всё', d.body.dataset.hl === 'soft' && d.documentElement.style.getPropertyValue('--ui-k') === '1' && ev("Storage.getSetting('bigSymbols', null)") === false);

  // крупный рисунок меняет поля на фишке
  const padNormal = parseInt(d.getElementById('board').style.getPropertyValue('--tile-face-pad'), 10);
  ev("App.applyToggle('bigSymbols', true, {silent:true})");
  await new Promise(r => setTimeout(r, 80));
  const padBig = parseInt(d.getElementById('board').style.getPropertyValue('--tile-face-pad'), 10);
  check('«Крупный рисунок» уменьшает поля вокруг символа (' + padNormal + ' → ' + padBig + ' px)', padBig < padNormal);
  ev("App.applyToggle('bigSymbols', false, {silent:true})");

  // экран выбора раскладки: размер фишки на карточке и сортировка
  ev("App.showScreen('layouts')");
  const badges = [...d.querySelectorAll('.layout-size')].map(e => e.textContent);
  check('на 28 карточках есть «фишка ≈ N px»', badges.length === 28 && badges.every(t => /≈ \d+ px/.test(t)));
  d.getElementById('layouts-sort').click();
  const sizes = [...d.querySelectorAll('.layout-size')].map(e => parseInt(e.textContent.match(/≈ (\d+)/)[1], 10));
  check('«Сначала крупные» сортирует по убыванию размера', sizes.every((v, i) => i === 0 || sizes[i - 1] >= v));
  d.getElementById('layouts-sort').click();

  // шрифты лежат в /fonts/ и не обязательны для логики (в урезанных копиях проекта их может не быть)
  const real = errors.filter(e => !/fonts/.test(e));
  log('ERRORS:', real.length); real.slice(0, 10).forEach(e => log(' -', e.slice(0, 300)));
  w.close(); server.close();
  process.exit(real.length ? 1 : 0);
})();
