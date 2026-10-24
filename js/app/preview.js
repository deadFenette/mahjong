/* ============================================================
   APP/PREVIEW.JS — Живое превью рамок фишек в настройках (v38)

   Справа от колонки настроек стоит «экранчик»: мини-стол с сукном
   и семью настоящими фишками. Это НЕ картинка-имитация: элементы
   получают те же классы и CSS-переменные, что фишки в игре
   (.free, .selected, .match-cand, .hint-bold, --tile-blocked-alpha…),
   поэтому превью показывает ровно то, что увидит игрок за столом.

   Сцена (кто показывает что):
     free     — свободная фишка: подсветка доступных (highlightLevel);
     blocked  — закрытая: приглушение и прозрачность (слайдер);
     under    — закрытая под верхней: читаемость слоёв;
     selected — выбранная: стиль выбора (selectStyle);
     twin     — её свободный двойник: пунктир (showMatches);
     hintA/B  — пара подсказки: стиль подсказки (hintStyle) и линия.

   Обновление: options.js / settings.js зовут App.notifySettings(key)
   после каждого изменения; preview слушает событие 'mahjong:settings'
   и синхронизирует сцену. При смене скина фишек лица перерисовываются.
   ============================================================ */

(function (A) {
  'use strict';

  // Размер сцены и фишек (соответствует CSS .preview-board)
  const TILE_W = 46;
  const TILE_H = 64;

  // Кто играет какую роль: suit/rank — лицо фишки (ищется в Tileset,
  // копии разные, чтобы SVG-градиенты не конфликтовали по id),
  // x/y — позиция на мини-столе, layer — слой (оттенок фишки),
  // label — [текст, x, y] таблички-подписи на сукне.
  const CAST = [
    { role: 'free',     suit: 'dragons',    rank: 'G', nth: 0, x: 6,   y: 54,  layer: 0, label: ['доступная', 1, 122] },
    { role: 'blocked',  suit: 'winds',      rank: 'E', nth: 0, x: 66,  y: 54,  layer: 0, label: ['закрытая', 80, 122] },
    { role: 'under',    suit: 'characters', rank: 5,   nth: 0, x: 126, y: 54,  layer: 0 },
    { role: 'selected', suit: 'dragons',    rank: 'R', nth: 0, x: 148, y: 24,  layer: 1, label: ['выбранная', 132, 2] },
    { role: 'twin',     suit: 'dragons',    rank: 'R', nth: 1, x: 266, y: 54,  layer: 0, label: ['двойник', 252, 122] },
    { role: 'hintA',    suit: 'dots',       rank: 1,   nth: 0, x: 86,  y: 152, layer: 0 },
    { role: 'hintB',    suit: 'dots',       rank: 1,   nth: 1, x: 172, y: 152, layer: 0, label: ['подсказка', 110, 222] },
  ];

  // Центры пары подсказки — для пунктирной линии между фишками
  const LINK_FROM = { x: 86 + TILE_W / 2, y: 152 + TILE_H / 2 };
  const LINK_TO = { x: 172 + TILE_W / 2, y: 152 + TILE_H / 2 };

  const HINT_STYLES = ['normal', 'bold', 'max'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let els = null;   // роль → элемент .tile

  // ---------- Найти лицо фишки в текущем скине ----------
  function findTile(slot) {
    if (typeof Tileset === 'undefined') return null;
    const list = Tileset.tiles.filter(t => t.suit === slot.suit && t.rank === slot.rank);
    return list.length ? list[slot.nth % list.length] : null;
  }

  // ---------- Пунктирная линия между фишками подсказки ----------
  // Классы .hint-link-* — из highlight.css: тёмный ореол + белый
  // бегущий пунктир. Как и в игре (Render.drawHintLink/clearHint),
  // элемент добавляется и убирается целиком, а не прячется.
  function drawLink(show) {
    const board = document.getElementById('preview-board');
    if (!board) return;
    const existing = board.querySelector('.hint-link');
    if (!show) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return; // уже стоит
    board.appendChild(buildLinkSvg());
  }

  function buildLinkSvg() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'hint-link');
    svg.setAttribute('aria-hidden', 'true');
    const mk = (cls, w) => {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('class', cls);
      l.setAttribute('x1', String(LINK_FROM.x));
      l.setAttribute('y1', String(LINK_FROM.y));
      l.setAttribute('x2', String(LINK_TO.x));
      l.setAttribute('y2', String(LINK_TO.y));
      l.setAttribute('stroke-width', String(w));
      return l;
    };
    svg.appendChild(mk('hint-link-halo', 7));
    svg.appendChild(mk('hint-link-line', 3));
    return svg;
  }

  // ---------- Табличка-подпись на сукне ----------
  function buildLabel(board, label) {
    const el = document.createElement('div');
    el.className = 'preview-label';
    el.textContent = label[0];
    el.style.left = label[1] + 'px';
    el.style.top = label[2] + 'px';
    el.setAttribute('aria-hidden', 'true'); // текст есть в легенде ниже
    board.appendChild(el);
  }

  // ---------- Собрать сцену ----------
  function build() {
    const board = document.getElementById('preview-board');
    if (!board || typeof Tileset === 'undefined' || typeof Render === 'undefined') return;
    board.innerHTML = '';
    els = {};

    CAST.forEach((slot, i) => {
      const tile = findTile(slot);
      const el = document.createElement('div');
      el.className = 'tile';
      el.dataset.role = slot.role;
      el.dataset.layer = String(slot.layer);
      el.setAttribute('aria-hidden', 'true');
      el.style.left = slot.x + 'px';
      el.style.top = slot.y + 'px';
      el.style.width = TILE_W + 'px';
      el.style.height = TILE_H + 'px';
      el.style.zIndex = String(10 + slot.layer * 10);
      if (tile) el.innerHTML = Render.faceHtml(tile, 'pv' + i);
      board.appendChild(el);
      els[slot.role] = el;
      if (slot.label) buildLabel(board, slot.label);
    });

    sync();
  }

  // ---------- Синхронизировать сцену с настройками ----------
  // Читает те же источники правды, что и игра: body[data-hl]/[data-sel]
  // ставит options.js, остальное — Storage. Дёшево, без состояния —
  // можно звать после каждого изменения любой настройки.
  function sync() {
    const board = document.getElementById('preview-board');
    if (!board || !els || !els.free) return;

    const body = document.body;
    const hl = body.dataset.hl || 'soft';
    const hintStyle = HINT_STYLES.indexOf(Storage.getSetting('hintStyle', 'normal')) >= 0
      ? Storage.getSetting('hintStyle', 'normal') : 'normal';
    const showMatches = Storage.getSetting('showMatches', false) === true;
    const transparency = Render.clampTransparency(Storage.getSetting('tileTransparency', 0));
    const bigSymbols = Storage.getSetting('bigSymbols', false) === true;

    // Прозрачность закрытых и поля вокруг рисунка — как на доске
    board.style.setProperty('--tile-blocked-alpha', String(Render.blockedAlphaFor(transparency)));
    board.style.setProperty('--tile-face-pad', bigSymbols ? '1px' : '4px');

    // Подсветка доступных: как Render.highlightFree в игре —
    // «выкл» снимает .free со всех, иначе свободные светятся
    const glow = hl !== 'off';
    ['free', 'twin', 'hintA', 'hintB', 'selected'].forEach(role => {
      els[role].classList.toggle('free', glow);
    });

    // Выбранная фишка всегда выбрана (это её сцена), стиль — body[data-sel];
    // двойник обводится пунктиром только при включённой настройке
    els.selected.classList.add('selected');
    els.twin.classList.toggle('match-cand', showMatches);

    // Пара подсказки: классы ставит и снимает только настройка
    ['hintA', 'hintB'].forEach(role => {
      const el = els[role];
      el.classList.add('hint');
      el.classList.toggle('hint-bold', hintStyle === 'bold');
      el.classList.toggle('hint-max', hintStyle === 'max');
    });
    drawLink(hintStyle !== 'normal');

    renderLegend(hl, hintStyle, showMatches, transparency);
  }

  // ---------- Легенда: что сейчас включено ----------
  function renderLegend(hl, hintStyle, showMatches, transparency) {
    const legend = document.getElementById('preview-legend');
    if (!legend) return;

    const HL_TEXT = {
      off: 'без подсветки',
      soft: 'мягкое свечение',
      bold: 'золотая рамка',
      focus: 'рамка, остальное притемнено',
    };
    const SEL_TEXT = {
      soft: 'золотое кольцо',
      bold: 'белая рамка, крупнее',
    };
    const HINT_TEXT = {
      normal: 'мягкие вспышки',
      bold: 'белая рамка + линия',
      max: 'рамка + линия, до вашего хода',
    };
    const sel = document.body.dataset.sel || 'soft';

    let skinName = 'Классический';
    if (typeof Tileset !== 'undefined') {
      const id = typeof Tileset.activeSkinId === 'function'
        ? Tileset.activeSkinId() : Storage.getSetting('tileSkin', 'classic');
      const known = Tileset.SKINS.find(k => k.id === id);
      if (known) skinName = known.name;
    }

    const rows = [
      ['Доступные фишки', HL_TEXT[hl] || HL_TEXT.soft],
      ['Выбранная фишка', SEL_TEXT[sel] || SEL_TEXT.soft],
      ['Двойники выбранной', showMatches ? 'пунктирная рамка' : 'не выделяются'],
      ['Подсказка', HINT_TEXT[hintStyle]],
      ['Закрытые фишки', transparency > 0 ? 'стеклянные, ' + transparency + '%' : 'плотные'],
      ['Скин фишек', skinName],
    ];
    legend.innerHTML = rows.map(r =>
      '<div class="preview-legend-row">' +
      '<dt class="preview-legend-key">' + r[0] + '</dt>' +
      '<dd class="preview-legend-val">' + r[1] + '</dd>' +
      '</div>').join('');
  }

  // ---------- Подписка на изменения настроек ----------
  // options.js / settings.js рассылают 'mahjong:settings' после каждого
  // изменения. Смена скина меняет лица — пересобираем сцену целиком,
  // остальное — дешёвая синхронизация классов.
  function onSettingsChanged(e) {
    const key = e && e.detail ? e.detail.key : null;
    if (key === 'tileSkin') build();
    else sync();
  }

  document.addEventListener('mahjong:settings', onSettingsChanged);
  // Строим сцену до App.init: наш слушатель DOMContentLoaded регистрируется
  // раньше (preview.js подключён до init.js), поэтому фишки уже стоят,
  // когда loadSettings начнёт рассылать события.
  document.addEventListener('DOMContentLoaded', build);

  Object.assign(A, {
    previewBuild: build,
    previewSync: sync,
  });
})(App);
