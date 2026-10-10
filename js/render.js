/* ============================================================
   RENDER.JS — Отрисовка фишек на доске
   Каждая фишка — DOM-элемент, позиционируется absolutely.

   ГЛАВНОЕ (v5): масштаб доски считается от РЕАЛЬНО доступного
   места на экране (.board-stage), а не от стола, который сам
   размеряется по содержимому. Лимит «80px» убран — фишки
   вырастают до максимума, который влезает в экран (режим
   «Максимальные» — для слабовидящих).

   v6: прозрачность закрытых фишек настраивается (слайдер
   «Прозрачность фишек», 0–50%). По умолчанию 0% — фишки
   плотные и больше не просвечивают друг сквозь друга.
   Чистая математика (computeFit / tilePosition / zIndexOf /
   clampTransparency / blockedAlphaFor) покрыта тестами
   (tests/render-math.test.js, tests/appearance.test.js).

   v8 (анимации):
   1. playDealAnimation — каскадная раздача: фишки падают
      на доску волной (задержка от координат — чистая
      функция dealDelayFor, покрыта тестами).
   2. animateRemove — парные фишки ПРИТЯГИВАЮТСЯ друг
      к другу (вектор сближения — чистая функция
      flyVectorFor, покрыта тестами) и растворяются,
      а в точке матча вспыхивают золотые искры.
   3. spawnScoreFloat — всплывающий «+N» над собранной парой.
   4. pulseTable — стол «вздрагивает» при перемешивании.
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

  // ---------- Прозрачность закрытых фишек (v6) ----------
  // 0% — фишки плотные (по умолчанию: ничего не просвечивает сквозь слои,
  // важно для слабовидящих). До 50% — «стеклянные» закрытые фишки.
  const TRANSPARENCY_MIN = 0;
  const TRANSPARENCY_MAX = 50;

  // ---------- Анимации (v8) ----------
  // Задержка каскадной раздачи: волна идёт по доске слева-направо и
  // снизу-вверх, верхние слои приезжают последними.
  const DEAL_STEP_XY = 14;  // мс на каждый шаг по сетке (x + y)
  const DEAL_STEP_Z = 55;   // мс на каждый слой
  const DEAL_MAX_DELAY = 750; // потолок задержки — не заставляем ждать
  let dealCleanupTimer = null;

  // Чистая функция: привести процент прозрачности к допустимому диапазону.
  // Строки из localStorage («25»), мусор («abc», NaN, undefined) — всё терпимо.
  function clampTransparency(pct) {
    const n = Math.round(Number(pct));
    if (!Number.isFinite(n)) return 0;
    return Math.max(TRANSPARENCY_MIN, Math.min(TRANSPARENCY_MAX, n));
  }

  // Чистая функция: процент → alpha элемента закрытой фишки.
  // 0% → 1 (непрозрачно), 50% → 0.5.
  function blockedAlphaFor(pct) {
    return 1 - clampTransparency(pct) / 100;
  }

  // Применить прозрачность к доске (CSS-переменная — её читают .tile:not(.free))
  function setTileTransparency(pct) {
    const clamped = clampTransparency(pct);
    if (boardEl) {
      boardEl.style.setProperty('--tile-blocked-alpha', String(blockedAlphaFor(clamped)));
    }
    return clamped;
  }

  // ============================================================
  //  ЧИСТАЯ МАТЕМАТИКА АНИМАЦИЙ (v8 — покрыта тестами)
  // ============================================================

  // ---------- Задержка каскадной раздачи для одной фишки ----------
  // Чем правее/ниже/выше фишка — тем позже она приземляется.
  // Мусор в координатах трактуется как 0 (никогда не NaN).
  function dealDelayFor(tile, opts) {
    const o = opts || {};
    const stepXY = o.stepXY !== undefined ? o.stepXY : DEAL_STEP_XY;
    const stepZ = o.stepZ !== undefined ? o.stepZ : DEAL_STEP_Z;
    const maxDelay = o.maxDelay !== undefined ? o.maxDelay : DEAL_MAX_DELAY;

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const tx = num(tile && tile.x);
    const ty = num(tile && tile.y);
    const tz = num(tile && tile.z);

    const raw = (tx + ty) * stepXY + tz * stepZ;
    return Math.max(0, Math.min(Math.round(raw), maxDelay));
  }

  // ---------- Вектор сближения пары при матче ----------
  // Каждая фишка подтягивается к другой на pull-долю расстояния,
  // но не дальше maxShift px (иначе близнецы-соседи слипаются).
  // Возвращает симметричные смещения: b = -a.
  function flyVectorFor(posA, posB, opts) {
    const o = opts || {};
    const pull = o.pull !== undefined ? o.pull : 0.22;
    const maxShift = o.maxShift !== undefined ? o.maxShift : Infinity;

    const ax = Number(posA && posA.left) || 0;
    const ay = Number(posA && posA.top) || 0;
    const bx = Number(posB && posB.left) || 0;
    const by = Number(posB && posB.top) || 0;

    let dx = (bx - ax) * pull;
    let dy = (by - ay) * pull;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxShift && dist > 0) {
      const k = maxShift / dist;
      dx *= k;
      dy *= k;
    }
    dx = Math.round(dx);
    dy = Math.round(dy);
    return {
      a: { dx, dy },
      b: { dx: -dx, dy: -dy },
    };
  }

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
      '--tile-w': fit.w + 'px',   // v8: для масштаба искр и «+N»
      '--tile-h': fit.h + 'px',   // v8: дальность падения в tile-deal
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

    // v8: после каскадной раздачи класс .enter снимается —
    // стили фишки возвращаются к естественным (hover, прозрачность)
    el.addEventListener('animationend', e => {
      if (e.animationName === 'tile-deal') el.classList.remove('enter');
    });

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
  // .removed (display:none) ставим ПОСЛЕ конца 450-мс анимации,
  // а не через 50 мс — раньше фишки «выскакивали» рывком.
  // v8: пара сначала ПРИТЯГИВАЕТСЯ друг к другу (tile-vanish читает
  // --fly-dx/--fly-dy), в точке матча вспыхивают золотые искры.
  function animateRemove(tiles) {
    const arr = Array.isArray(tiles) ? tiles : [];
    const pair = arr.slice(0, 2);

    // Вектор сближения — только если пара из двух фишек
    if (pair.length === 2) {
      const elA = tileEls.get(pair[0]);
      const elB = tileEls.get(pair[1]);
      if (elA && elB) {
        const vec = flyVectorFor(
          tilePosition(pair[0], { w: tileSize.w, h: tileSize.h, gap, zLift }),
          tilePosition(pair[1], { w: tileSize.w, h: tileSize.h, gap, zLift }),
          { pull: 0.22, maxShift: tileSize.w * 0.35 }
        );
        elA.style.setProperty('--fly-dx', vec.a.dx + 'px');
        elA.style.setProperty('--fly-dy', vec.a.dy + 'px');
        elB.style.setProperty('--fly-dx', vec.b.dx + 'px');
        elB.style.setProperty('--fly-dy', vec.b.dy + 'px');
        // Искры в середине пары
        spawnSparks(midpointOf(pair[0], pair[1]));
      }
    }

    arr.forEach(tile => {
      const el = tileEls.get(tile);
      if (!el) return;
      el.classList.add('removing');
      setTimeout(() => {
        el.classList.add('removed');
        el.classList.remove('removing');
      }, 480);
    });
  }

  // ---------- Середина между двумя фишками (в координатах доски) ----------
  function midpointOf(tileA, tileB) {
    const posA = tilePosition(tileA, { w: tileSize.w, h: tileSize.h, gap, zLift });
    const posB = tilePosition(tileB, { w: tileSize.w, h: tileSize.h, gap, zLift });
    return {
      x: (posA.left + posB.left) / 2 + tileSize.w / 2,
      y: (posA.top + posB.top) / 2 + tileSize.h / 2,
    };
  }

  // ---------- Золотые искры в точке матча (v8) ----------
  // Небольшой управляемый салют: 10–14 частиц разлетаются
  // из точки и гаснут. Элементы удаляются сами через 950 мс.
  function spawnSparks(point, count) {
    if (!boardEl || !point) return;
    const n = Math.max(1, Math.min(24, count || 12));
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'match-spark';
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
      const dist = 14 + Math.random() * 46;
      s.style.left = point.x + 'px';
      s.style.top = point.y + 'px';
      s.style.setProperty('--sx', Math.round(Math.cos(angle) * dist) + 'px');
      s.style.setProperty('--sy', Math.round(Math.sin(angle) * dist) + 'px');
      s.style.setProperty('--s-dur', (0.5 + Math.random() * 0.35).toFixed(2) + 's');
      s.style.setProperty('--s-delay', (Math.random() * 0.12).toFixed(2) + 's');
      const size = 5 + Math.random() * 5;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      boardEl.appendChild(s);
      setTimeout(() => s.remove(), 950);
    }
  }

  // ---------- Всплывающий «+N» над собранной парой (v8) ----------
  function spawnScoreFloat(text, tileA, tileB) {
    if (!boardEl || !tileA) return;
    const point = tileB
      ? midpointOf(tileA, tileB)
      : (() => {
          const p = tilePosition(tileA, { w: tileSize.w, h: tileSize.h, gap, zLift });
          return { x: p.left + tileSize.w / 2, y: p.top + tileSize.h / 2 };
        })();
    const el = document.createElement('div');
    el.className = 'score-float';
    el.textContent = text;
    el.style.left = point.x + 'px';
    el.style.top = point.y + 'px';
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  // ---------- Всплывающее «Комбо ×N» (v11) ----------
  // Крупнее и наряднее «+N»: золотой градиент, свечение,
  // поднимается выше. Встает чуть выше пары, чтобы не
  // сталкиваться с +N, который появляется одновременно.
  function spawnComboFloat(text, tileA, tileB) {
    if (!boardEl || !tileA) return;
    const point = tileB
      ? midpointOf(tileA, tileB)
      : (() => {
          const p = tilePosition(tileA, { w: tileSize.w, h: tileSize.h, gap, zLift });
          return { x: p.left + tileSize.w / 2, y: p.top + tileSize.h / 2 };
        })();
    const el = document.createElement('div');
    el.className = 'combo-float';
    el.textContent = text;
    el.style.left = point.x + 'px';
    el.style.top = (point.y - tileSize.h * 0.7) + 'px';
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ---------- Каскадная раздача фишек (v8) ----------
  // Вызывается после renderFull на старте партии, перемешивании
  // и отмене хода. opts.fast — укороченный вариант (для undo).
  function playDealAnimation(opts) {
    const state = Game.getState();
    if (!boardEl || !state) return;
    const fast = !!(opts && opts.fast);

    let maxDelay = 0;
    state.tiles.forEach(tile => {
      if (tile.removed) return;
      const el = tileEls.get(tile);
      if (!el) return;
      const delay = fast
        ? dealDelayFor(tile, { stepXY: 5, stepZ: 22, maxDelay: 240 })
        : dealDelayFor(tile);
      const rot = (Math.random() * 2 - 1) * (fast ? 2 : 3.5);
      const hadEnter = el.classList.contains('enter');
      if (hadEnter) {
        // Перезапуск уже идущей анимации — нужен reflow
        el.classList.remove('enter');
        void el.offsetWidth;
      }
      el.style.setProperty('--deal-delay', delay + 'ms');
      el.style.setProperty('--deal-rot', rot.toFixed(2) + 'deg');
      el.classList.add('enter');
      if (delay > maxDelay) maxDelay = delay;
    });

    // Страховочная очистка (если animationend не сработал)
    clearTimeout(dealCleanupTimer);
    dealCleanupTimer = setTimeout(() => {
      tileEls.forEach(el => el.classList.remove('enter'));
    }, maxDelay + 900);
  }

  // ---------- Стол «вздрагивает» при перемешивании (v8) ----------
  function pulseTable() {
    if (!tableEl) return;
    tableEl.classList.remove('table-shake');
    void tableEl.offsetWidth; // перезапуск анимации
    tableEl.classList.add('table-shake');
    setTimeout(() => tableEl.classList.remove('table-shake'), 600);
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
    // прозрачность закрытых фишек (v6)
    setTileTransparency,
    clampTransparency,
    blockedAlphaFor,
    TRANSPARENCY_MIN,
    TRANSPARENCY_MAX,
    // анимации (v8)
    playDealAnimation,
    spawnScoreFloat,
    spawnComboFloat,
    spawnSparks,
    pulseTable,
    dealDelayFor,
    flyVectorFor,
    DEAL_STEP_XY,
    DEAL_STEP_Z,
    DEAL_MAX_DELAY,
    // чистые функции — для тестов
    computeFit,
    tilePosition,
    zIndexOf,
    sizeScaleFor,
    SIZE_SCALES,
  };
})();
