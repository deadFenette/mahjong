/* ============================================================
   RENDER.JS — Отрисовка фишек на доске
   Каждая фишка — DOM-элемент, позиционируется absolutely
   Размер фишек подстраивается под доску
   ============================================================ */

const Render = (function () {

  let boardEl = null;
  let tileEls = new Map(); // tile.id → DOM element
  let tileSize = { w: 56, h: 74 }; // текущий размер фишки
  let zLift = 4; // визуальный подъём верхних слоёв (px, только вверх)
  let gap = 2;   // зазор между фишками

  // ---------- Инициализация ----------
  function init(boardElement) {
    boardEl = boardElement;
  }

  // ---------- Рассчитать размер фишки под доску ----------
  function fitBoard(layout) {
    const wrap = boardEl.parentElement;
    const availW = wrap.clientWidth - 24;
    const availH = wrap.clientHeight - 24;

    const cols = layout.width;
    const rows = layout.height;
    const layers = layout.layers;

    // По ширине: cols фишек + (cols-1)*gap
    const wByWidth = (availW - (cols - 1) * gap) / cols;
    const hByWidth = wByWidth * 1.4;

    // По высоте: rows фишек + (rows-1)*gap + запас под z-lift
    const hByHeight = (availH - (rows - 1) * gap - (layers - 1) * zLift) / rows;
    const wByHeight = hByHeight / 1.4;

    let w = Math.min(wByWidth, wByHeight);
    w = Math.max(38, Math.min(w, 80));
    let h = w * 1.4;

    const sizeSetting = Storage.getSetting('tileSize', 'medium');
    const scale = sizeSetting === 'small' ? 0.85 : sizeSetting === 'large' ? 1.15 : 1.0;
    w *= scale; h *= scale;

    tileSize = { w: Math.round(w), h: Math.round(h) };

    const boardW = cols * tileSize.w + (cols - 1) * gap;
    const boardH = rows * tileSize.h + (rows - 1) * gap + (layers - 1) * zLift;
    boardEl.style.width = boardW + 'px';
    boardEl.style.height = boardH + 'px';
    return tileSize;
  }

  // ---------- Полная отрисовка доски ----------
  function renderFull() {
    const state = Game.getState();
    if (!state) return;

    boardEl.innerHTML = '';
    tileEls.clear();

    // Сортируем по z, потом по y, потом по x — чтобы нижние рендерились раньше верхних
    const sorted = state.tiles.slice().sort((a, b) =>
      a.z - b.z || a.y - b.y || a.x - b.x
    );

    sorted.forEach(tile => {
      const el = createTileEl(tile);
      boardEl.appendChild(el);
      tileEls.set(tile.id, el);
    });
  }

  // ---------- Создать DOM-элемент фишки ----------
  function createTileEl(tile) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.tileId = tile.id;
    el.dataset.suit = tile.suit;
    el.dataset.rank = tile.rank;
    el.innerHTML = tile.face;

    positionTile(el, tile);

    if (tile.removed) {
      el.classList.add('removed');
    }

    el.addEventListener('click', () => {
      App.onTileClick(tile);
    });

    return el;
  }

  // ---------- Позиционировать фишку ----------
  // X и Y — по сетке (целые, из layout-строк).
  // Z — только визуальный подъём вверх (фишка "выше" над столом).
  // Смещение пол-фишки для нечётных слоёв УБРАНО — оно путало пользователей
  // на больших раскладках. Теперь верхние слои лежат прямо над нижними.
  // Используем Math.round для пиксельных координат — убирает размытие SVG.
  function positionTile(el, tile) {
    const left = Math.round(tile.x * (tileSize.w + gap));
    const top = Math.round(tile.y * (tileSize.h + gap) - tile.z * zLift);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.width = tileSize.w + 'px';
    el.style.height = tileSize.h + 'px';
    el.style.zIndex = (tile.z + 1) * 100 + Math.round(tile.y);
  }

  // ---------- Обновить вид одной фишки ----------
  function updateTile(tile) {
    const el = tileEls.get(tile.id);
    if (!el) return;
    if (tile.removed) el.classList.add('removed');
    else el.classList.remove('removed');
  }

  // ---------- Подсветить выбранную ----------
  function setSelected(tile) {
    // Снять выделение со всех
    tileEls.forEach(el => el.classList.remove('selected'));
    if (tile) {
      const el = tileEls.get(tile.id);
      if (el) el.classList.add('selected');
    }
  }

  // ---------- Подсветить пару (hint) ----------
  function flashPair(pair) {
    if (!pair) return;
    pair.forEach(tile => {
      const el = tileEls.get(tile.id);
      if (el) {
        el.classList.add('hint');
        setTimeout(() => el.classList.remove('hint'), 2000);
      }
    });
  }

  // ---------- Анимация исчезновения ----------
  function animateRemove(tiles) {
    tiles.forEach(tile => {
      const el = tileEls.get(tile.id);
      if (el) {
        el.classList.add('removing');
        setTimeout(() => el.classList.add('removed'), 50);
      }
    });
  }

  // ---------- Подсветить все свободные ----------
  function highlightFree(enabled) {
    if (!enabled) { clearHighlight(); return; }
    const state = Game.getState();
    if (!state) return;
    const freeIds = new Set(Game.getFreeTiles().map(t => t.id));
    tileEls.forEach((el, id) => {
      if (freeIds.has(id)) el.classList.add('free');
      else el.classList.remove('free');
    });
  }

  // ---------- Очистить подсветку свободных ----------
  function clearHighlight() {
    tileEls.forEach(el => el.classList.remove('free'));
  }

  // ---------- Перерисовать позиции (после resize или shuffle) ----------
  function reposition() {
    const state = Game.getState();
    if (!state) return;
    fitBoard(state.layout);
    state.tiles.forEach(tile => {
      const el = tileEls.get(tile.id);
      if (el) positionTile(el, tile);
    });
  }

  // ---------- Получить текущий размер ----------
  function getTileSize() { return tileSize; }

  return {
    init,
    fitBoard,
    renderFull,
    updateTile,
    setSelected,
    flashPair,
    animateRemove,
    highlightFree,
    clearHighlight,
    reposition,
    getTileSize,
  };
})();
