/* ============================================================
   RENDER.JS — Отрисовка фишек на доске
   Каждая фишка — DOM-элемент, позиционируется absolutely.

   ГЛАВНОЕ (v5): масштаб доски считается от РЕАЛЬНО доступного
   места на экране (.board-stage), а не от стола, который сам
   размеряется по содержимому. Лимит «80px» убран — фишки
   вырастают до максимума, который влезает в экран (режим
   «Максимальные» — для слабовидящих).

   Все пропорции (зазор, подъём слоёв, толщина фишки, отступы
   стола) масштабируются вместе с размером фишки.

   Чистая математика вынесена в computeFit / tilePosition /
   zIndexOf — она покрыта тестами (tests/render-math.test.js).
   ============================================================ */

const Render = (function () {

  let boardEl = null;
  let stageEl = null;   // .board-stage — контейнер с реальным размером экрана
  let tableEl = null;   // .board-table — деревянная подложка
  // Ключ — сам ОБЪЕКТ фишки, а не tile.id! Для раскладок больше 144 фишек
  // (Стена — 188, Крест — 202) пул тайлсета дублируется и id повторяются:
  // Map по id затирал элементы, и половина доски переставала
  // обновляться при рескейле/подсветке/удалении.
  let tileEls = new Map();

  let tileSize = { w: 56, h: 78 }; // текущий размер фишки
  let gap = 3;   // зазор между фишками (px)
  let zLift = 5; // визуальный подъём верхних слоёв (px, только вверх)

  // ---------- Константы пропорций ----------
  const ASPECT = 1.4;     // высота фишки = ширина × ASPECT
  const GAP_RATIO = 0.05; // зазор между фишками, доля ширины фишки
  const PAD_RATIO = 0.28; // внутренний отступ стола (с каждой стороны), доля ширины
  const LIFT_RATIO = 0.075; // подъём на слой, доля ВЫСОТЫ фишки
  const MIN_W = 28;  // ниже — только на совсем маленьких экранах (появится скролл)
  const MAX_W = 260; // защитный потолок для гигантских мониторов

  // Настройка размера = доля доступной области, которую занимает доска.
  // 'large' — доска занимает ВСЁ место (максимально возможные фишки),
  // и никогда не вылезает за экран: скролла и обрезки нет.
  const SIZE_SCALES = { small: 0.7, medium: 0.85, large: 1.0 };

  function sizeScaleFor(setting) {
    return SIZE_SCALES[setting] !== undefined ? SIZE_SCALES[setting] : 1.0;
  }

  // ============================================================
  //  ЧИСТАЯ МАТЕМАТИКА (без DOM — покрыта тестами)
  // ============================================================

  // ---------- Максимальный размер фишки, влезающий в область ----------
  // Всё пропорционально: зазоры, отступы стола и подъём слоёв растут
  // вместе с фишкой, поэтому решается в одну формулу.
  //
  // Ширина:  w × (cols + (cols-1)×gapRatio + 2×padRatio) ≤ availW
  // Высота:  w × (aspect×rows + (rows-1)×gapRatio
  //                + (layers-1)×liftRatio×aspect + 2×padRatio) ≤ availH
  function computeFit(opts) {
    const {
      stageW, stageH,
      cols, rows, layers,
      sizeScale = 1,
      aspect = ASPECT,
      gapRatio = GAP_RATIO,
      padRatio = PAD_RATIO,
      liftRatio = LIFT_RATIO,
      minW = MIN_W,
      maxW = MAX_W,
    } = opts;

    const availW = Math.max(0, stageW) * sizeScale - 2; // −2 на рамку стола
    const availH = Math.max(0, stageH) * sizeScale - 2;

    const wByWidth = availW / (cols + (cols - 1) * gapRatio + 2 * padRatio);
    const wByHeight = availH /
      (aspect * rows + (rows - 1) * gapRatio +
        (layers - 1) * liftRatio * aspect + 2 * padRatio);

    let w = Math.min(wByWidth, wByHeight);
    w = Math.max(minW, Math.min(w, maxW));
    w = Math.floor(w);

    const h = Math.round(w * aspect);
    const gap = Math.max(1, Math.round(w * gapRatio));
    const zLift = Math.max(2, Math.round(h * liftRatio));
    const tablePad = Math.max(10, Math.round(w * padRatio));

    const boardW = cols * w + (cols - 1) * gap;
    const boardH = rows * h + (rows - 1) * gap + (layers - 1) * zLift;

    return { w, h, gap, zLift, tablePad, boardW, boardH };
  }

  // ---------- Позиция и z-index фишки — чистая математика ----------
  // X, Y — координаты сетки (могут быть дробными при центрировании слоёв).
  // Z — только визуальный подъём вверх. Math.round убирает размытие.
  function tilePosition(tile, size) {
    const { w, h, gap, zLift } = size;
    return {
      left: Math.round(tile.x * (w + gap)),
      top: Math.round(tile.y * (h + gap) - tile.z * zLift),
      zIndex: zIndexOf(tile),
    };
  }

  // ---------- Порядок наложений (z-index) ----------
  // Слой — главный приоритет (шаг 1000). Внутри слоя фишки нижних рядов
  // перекрывают верхние (y × 2 — чтобы дробные y=2.5 не сталкивались
  // с целыми y=2 и y=3).
  function zIndexOf(tile) {
    return (tile.z + 1) * 1000 + Math.round(tile.y * 2);
  }

  // ============================================================
  //  DOM
  // ============================================================

  // ---------- Инициализация ----------
  function init(boardElement) {
    boardEl = boardElement;
    stageEl = boardEl ? boardEl.closest('.board-stage') : null;
    tableEl = boardEl ? boardEl.closest('.board-table') : null;
  }

  // ---------- Размер области без учёта паддингов ----------
  function stageContentSize() {
    if (!stageEl) return { w: 0, h: 0 };
    const cs = window.getComputedStyle(stageEl);
    const w = stageEl.clientWidth -
      (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const h = stageEl.clientHeight -
      (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    return { w, h };
  }

  // ---------- Рассчитать размер фишек под экран ----------
  function fitBoard(layout) {
    if (!boardEl || !layout) return tileSize;

    const { w: stageW, h: stageH } = stageContentSize();

    // Экран скрыт (display:none) → мерить нечего, оставляем старый размер.
    // Реальную подгонку сделает reposition после показа экрана.
    if (!(stageW > 0 && stageH > 0)) return tileSize;

    const setting = Storage.getSetting('tileSize', 'large');
    const scale = sizeScaleFor(setting);

    const fit = computeFit({
      stageW, stageH,
      cols: layout.width,
      rows: layout.height,
      layers: Math.max(1, layout.layers),
      sizeScale: scale,
    });

    gap = fit.gap;
    zLift = fit.zLift;
    tileSize = { w: fit.w, h: fit.h };

    // Стол — отступы растут вместе с фишками
    if (tableEl) tableEl.style.padding = fit.tablePad + 'px';

    // CSS-переменные — объём фишек масштабируется вместе с ними
    // (толщина грани, радиус, внутренние рамки, подъём при hover)
    const depth = Math.max(2, Math.min(12, Math.round(fit.h * 0.05)));
    const vars = {
      '--tile-depth': depth + 'px',
      '--tile-radius': Math.max(4, Math.min(16, Math.round(fit.w * 0.11))) + 'px',
      '--tile-face-pad': Math.max(4, Math.round(fit.w * 0.08)) + 'px',
      '--tile-inner-inset': Math.max(3, Math.round(fit.w * 0.07)) + 'px',
      '--tile-hover-lift': Math.max(3, Math.round(fit.h * 0.05)) + 'px',
      '--tile-sel-lift': Math.max(4, Math.round(fit.h * 0.07)) + 'px',
      '--tile-hint-lift': Math.max(2, Math.round(fit.h * 0.025)) + 'px',
    };
    Object.keys(vars).forEach(k => boardEl.style.setProperty(k, vars[k]));

    boardEl.style.width = fit.boardW + 'px';
    boardEl.style.height = fit.boardH + 'px';

    return tileSize;
  }

  // ---------- Полная отрисовка доски ----------
  function renderFull() {
    const state = Game.getState();
    if (!state || !boardEl) return;

    boardEl.innerHTML = '';
    tileEls.clear();

    // Сортируем по z, потом по y, потом по x — чтобы нижние рендерились раньше верхних
    const sorted = state.tiles.slice().sort((a, b) =>
      a.z - b.z || a.y - b.y || a.x - b.x
    );

    const frag = document.createDocumentFragment();
    sorted.forEach(tile => {
      const el = createTileEl(tile);
      frag.appendChild(el);
      tileEls.set(tile, el); // ключ — объект фишки (id могут дублироваться)
    });
    boardEl.appendChild(frag);
  }

  // ---------- Создать DOM-элемент фишки ----------
  function createTileEl(tile) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.tileId = tile.id;
    el.dataset.suit = tile.suit;
    el.dataset.rank = tile.rank;
    // Делаем id градиентов внутри SVG уникальными для каждого экземпляра:
    // 4 копии одной фишки разделяют одну строку face, и дубликаты id
    // (url(#dot1)) по спецификации разрешаются в первый элемент документа.
    el.innerHTML = makeFaceUnique(tile.face, tile.id);

    positionTile(el, tile);

    if (tile.removed) {
      el.classList.add('removed');
    }

    el.addEventListener('click', () => {
      App.onTileClick(tile);
    });

    return el;
  }

  // ---------- Уникальные id внутри SVG-лица фишки ----------
  function makeFaceUnique(face, uniqueKey) {
    if (face.indexOf('id="') === -1 && face.indexOf('url(#') === -1) return face;
    return face
      .replace(/id="([A-Za-z0-9_-]+)"/g, (m, id) => `id="${id}-t${uniqueKey}"`)
      .replace(/url\(#([A-Za-z0-9_-]+)\)/g, (m, id) => `url(#${id}-t${uniqueKey})`);
  }

  // ---------- Позиционировать фишку ----------
  function positionTile(el, tile) {
    const pos = tilePosition(tile, {
      w: tileSize.w, h: tileSize.h, gap, zLift,
    });
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.style.width = tileSize.w + 'px';
    el.style.height = tileSize.h + 'px';
    el.style.zIndex = pos.zIndex;
  }

  // ---------- Обновить вид одной фишки ----------
  function updateTile(tile) {
    const el = tileEls.get(tile);
    if (!el) return;
    if (tile.removed) el.classList.add('removed');
    else el.classList.remove('removed');
  }

  // ---------- Подсветить выбранную ----------
  function setSelected(tile) {
    tileEls.forEach(el => el.classList.remove('selected'));
    if (tile) {
      const el = tileEls.get(tile);
      if (el) el.classList.add('selected');
    }
  }

  // ---------- Подсветить пару (hint) ----------
  // Таймеры хранятся по элементам: повторная подсказка не сносит
  // подсветку предыдущей раньше времени.
  const hintTimers = new Map();
  function flashPair(pair) {
    if (!pair) return;
    // Убираем предыдущую подсказку, чтобы таймеры не конфликтовали
    hintTimers.forEach((timer, el) => {
      clearTimeout(timer);
      el.classList.remove('hint');
    });
    hintTimers.clear();

    pair.forEach(tile => {
      const el = tileEls.get(tile);
      if (!el) return;
      el.classList.add('hint');
      hintTimers.set(el, setTimeout(() => {
        el.classList.remove('hint');
        hintTimers.delete(el);
      }, 2100));
    });
  }

  // ---------- Анимация исчезновения ----------
  // .removed (display:none) ставим ПОСЛЕ конца 400-мс анимации,
  // а не через 50 мс — раньше фишки «выскакивали» рывком.
  function animateRemove(tiles) {
    tiles.forEach(tile => {
      const el = tileEls.get(tile);
      if (!el) return;
      el.classList.add('removing');
      setTimeout(() => {
        el.classList.add('removed');
        el.classList.remove('removing');
      }, 430);
    });
  }

  // ---------- Подсветить все свободные ----------
  function highlightFree(enabled) {
    if (!enabled) { clearHighlight(); return; }
    const state = Game.getState();
    if (!state) return;
    const freeSet = new Set(Game.getFreeTiles()); // объекты фишек
    tileEls.forEach((el, tile) => {
      if (freeSet.has(tile)) el.classList.add('free');
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
      const el = tileEls.get(tile);
      if (el) positionTile(el, tile);
    });
  }

  // ---------- Получить текущий размер ----------
  function getTileSize() { return tileSize; }
  function getGap() { return gap; }
  function getZLift() { return zLift; }

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
    getGap,
    getZLift,
    // чистые функции — для тестов
    computeFit,
    tilePosition,
    zIndexOf,
    sizeScaleFor,
    SIZE_SCALES,
  };
})();
