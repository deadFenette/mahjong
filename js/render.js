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
  // v34: начало координат доски. Без автомасштаба — (0,0,0); с ним — левый
  // верхний угол ОСТАВШИХСЯ фишек (x, y — клетки, z — максимальный слой).
  let origin = { x: 0, y: 0, z: 0 };
  const elToTile = new WeakMap(); // v34: элемент → фишка (для лупы)
  let medallionEl = null;         // v42: медальон для импульсов прогресса

  // ---------- Константы пропорций ----------
  const ASPECT = 1.4;     // высота фишки = ширина × ASPECT
  const GAP_RATIO = 0.05; // зазор между фишками, доля ширины фишки
  const PAD_RATIO = 0.06; // отступ доски от края сукна (с каждой стороны), доля ширины
                          // v33: было 0.28 — стол теперь на весь экран, отступ минимален
  const LIFT_RATIO = 0.1; // подъём на слой, доля ВЫСОТЫ фишки
  const MIN_W = 28;  // ниже — только на совсем маленьких экранах (появится скролл)
  const MAX_W = 320; // защитный потолок для гигантских мониторов / xl-размера

  // Настройка размера = доля доступной области, которую занимает доска.
  // v19: 5 градаций вместо 3 — мелкая (на больших экранах), средняя,
  // крупная (по умолчанию), максимальная, и «огромная» для 4K-мониторов
  // и слабовидящих. Границы подобраны так, чтобы на любом экране
  // доска ВЛЕЗЛА и при этом читалась.
  const SIZE_SCALES = {
    tiny:   0.55,  // для гигантских раскладок на маленьких экранах
    small:  0.70,
    medium: 0.85,
    large:  1.00,  // по умолчанию — фишки занимают весь экран
    xl:     1.18,  // для слабовидящих / 4K-мониторов
  };

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

  // v42 (эксперимент): раздача «по ветрам» — Восток → Юг → Запад → Север.
  // v43: в обычной раздаче НЕ используется (вернулась плавная волна v8),
  // но функция dealDelayWindsFor осталась экспортом — её проверяют тесты.
  const WIND_STEP_MS = 110;      // мс между секторами (экспорт; см. dealDelayWindsFor)
  const DEAL_WINDS_STEP_XY = 10; // шаг волны внутри сектора (мягче обычного)
  const DEAL_WINDS_STEP_Z = 40;  // шаг по слоям внутри сектора
  // v43: па перед матчем мягче и длиннее — 90 мс читались как щелчок
  // v44: совпадает с transition .matching в tiles.css (0.17s) и длиной
  // tile-vanish (0.56s) — тайминги JS и CSS обязаны идти вместе.
  const MATCH_ANTICIPATE_MS = 170;
  const MATCH_VANISH_MS = 560;
  // v44: «+N» летит в счёт 1.0 с (css score-fly); «прилёт» — на 86% пути
  const SCORE_FLY_MS = 1000;
  const SCORE_FLY_ARRIVE_MS = 860;

  // v44: включена ли категория анимаций (настройки «Графика и анимации»).
  // Без модуля Motion (тесты, старый кэш) считаем, что всё включено.
  function fxOn(id) {
    return typeof Motion === 'undefined' ? true : Motion.isOn(id);
  }

  // Чистая функция: сектор фишки относительно центра доски.
  // 0 = Восток (право), 1 = Юг (низ), 2 = Запад (лево), 3 = Север (верх).
  // Границы: если |dx| > |dy| — горизонтальный сектор, иначе вертикальный.
  function windSectorRank(x, y, cx, cy) {
    const nx = Number(x), ny = Number(y), ncx = Number(cx), ncy = Number(cy);
    if (![nx, ny, ncx, ncy].every(Number.isFinite)) return 0;
    const dx = nx - ncx, dy = ny - ncy;
    if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 1 : 3;
  }

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

  // ---------- Задержка раздачи «по ветрам» (v42) ----------
  // Канонический порядок раздачи в маджонге — против часовой:
  // Восток → Юг → Запад → Север. Фишки в правом секторе ложатся
  // первыми, в верхнем — последними; внутри сектора бежит прежняя
  // волна (dealDelayFor, не тронута — её проверяют тесты v8).
  // Мусорные координаты — просто базовая задержка, без ветра.
  function dealDelayWindsFor(tile, opts) {
    const o = opts || {};
    const maxDelay = o.maxDelay !== undefined ? o.maxDelay : DEAL_MAX_DELAY;
    const windStep = o.windStep !== undefined ? o.windStep : WIND_STEP_MS;
    const base = dealDelayFor(tile, {
      stepXY: o.stepXY !== undefined ? o.stepXY : DEAL_WINDS_STEP_XY,
      stepZ: o.stepZ !== undefined ? o.stepZ : DEAL_WINDS_STEP_Z,
      maxDelay,
    });
    const t = tile && typeof tile === 'object' ? tile : {};
    const tx = Number(t.x), ty = Number(t.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return base;
    const cx = Number(o.cx), cy = Number(o.cy);
    const ccx = Number.isFinite(cx) ? cx : 0;
    const ccy = Number.isFinite(cy) ? cy : 0;
    const rank = windSectorRank(tx + 0.5, ty + 0.5, ccx, ccy);
    return Math.min(base + rank * windStep, maxDelay);
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
    const tablePad = Math.max(6, Math.round(w * padRatio));

    const boardW = cols * w + (cols - 1) * gap;
    const boardH = rows * h + (rows - 1) * gap + (layers - 1) * zLift;

    return { w, h, gap, zLift, tablePad, boardW, boardH };
  }

  // ---------- Границы ОСТАВШИХСЯ фишек (v34, автомасштаб) ----------
  // Доска по ходу партии пустеет, а размер фишек считался по полной
  // раскладке — к концу партии на экране оставалась горстка мелких фишек
  // посреди пустого стола. Теперь фишки растут вместе с освободившимся
  // местом: размер считается по рамке, описанной вокруг оставшихся.
  // Возвращает null, если фишек не осталось.
  function activeBounds(tiles) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = 0, n = 0;
    for (const t of tiles || []) {
      if (!t || t.removed) continue;
      n++;
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
      if (t.z > maxZ) maxZ = t.z;
    }
    if (!n) return null;
    return {
      minX, minY,
      cols: maxX - minX + 1,
      rows: maxY - minY + 1,
      layers: maxZ + 1,
      count: n,
    };
  }

  // ---------- Нужно ли пересчитывать размер после хода? (v34) ----------
  // Дёргать доску после каждой пары — раздражает. Поэтому растим фишки
  // только когда выигрыш заметен (≥ minGain), а уменьшаем — всегда,
  // когда иначе фишки вылезли бы за экран (отмена хода вернула края).
  // v44: потолок приближения — доля от размера на полной раскладке
  const ZOOM_MAX = 1.35;
  function zoomCapFor(baseW) {
    return Math.max(MIN_W, Math.floor(baseW * ZOOM_MAX));
  }

  function shouldRefit(currentW, targetW, minGain) {
    // v44: порог 1.08 → 1.12: «подъезды» реже, но каждый заметнее и плавнее
    const gain = minGain === undefined ? 1.12 : minGain;
    if (!(currentW > 0) || !(targetW > 0)) return false;
    if (targetW < currentW) return true;
    return targetW >= currentW * gain - 1e-9;   // запас на ошибку float (50 * 1.12 = 56.00000000000001)
  }

  // ---------- Оценка размера фишек для экрана выбора раскладки (v34) ----------
  // Игровой экран ещё не показан и мерить его нельзя, поэтому повторяем
  // геометрию CSS (рама, боковые планки, шапка). Нужна, чтобы ПОКАЗАТЬ
  // человеку цену выбора: «эта раскладка — фишка 40 px, а эта — 62 px».
  function estimateStage(vw, vh, opts) {
    const o = opts || {};
    const k = o.uiScale || 1;
    const railMode = vw >= 720 && vw / vh >= 1.6;
    const narrow = vw <= 700;
    const rim = narrow ? 5 : 8, pad = narrow ? 4 : 6;
    if (railMode) {
      const rail = Math.min(108, Math.max(84, vw * 0.074)) * k;
      const railL = (o.loupe === false || vh < 640) ? rail : rail * 1.3;
      return { stageW: vw - rail - railL - 2 * pad, stageH: vh - 2 * rim - 2 * pad, railMode };
    }
    const header = (vh <= 820 ? 52 : 58) * (narrow ? 0.85 : 1) * k;
    return { stageW: vw - 2 * rim - 2 * pad, stageH: vh - header - rim - 2 * pad, railMode };
  }

  function estimateTileWidth(layout, vw, vh, opts) {
    const st = estimateStage(vw, vh, opts);
    return computeFit({
      stageW: st.stageW, stageH: st.stageH,
      cols: layout.width, rows: layout.height,
      layers: Math.max(1, layout.layers),
    }).w;
  }

  // ---------- Позиция и z-index фишки — чистая математика ----------
  // X, Y — координаты сетки (могут быть дробными при центрировании слоёв).
  // Z — только визуальный подъём вверх. Math.round убирает размытие.
  function tilePosition(tile, size) {
    const { w, h, gap, zLift } = size;
    // v34: ox/oy/oz — начало доски (автомасштаб). По умолчанию 0 = как раньше.
    const ox = size.ox || 0, oy = size.oy || 0, oz = size.oz || 0;
    return {
      left: Math.round((tile.x - ox) * (w + gap)),
      top: Math.round((tile.y - oy) * (h + gap) - (tile.z - oz) * zLift),
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
    // v42: медальон на сукне (импульсы прогресса) — ищется один раз
    medallionEl = null;
    if (boardEl) {
      const surface = boardEl.closest('.table-surface');
      if (surface) medallionEl = surface.querySelector('.table-medallion');
      bindTilt();
    }
  }

  // ---------- Наклон фишки под курсором (v44) ----------
  // Только мышь и только свободная фишка под курсором: она слегка
  // поворачивается к указателю (до ±7°, перспектива 520px) — как стекло
  // под лампой. Положение курсора внутри фишки пишем в --tilt-x/--tilt-y
  // (−1…1), сам поворот и его возврат — CSS transition (tiles.css).
  // События с тачскринов (pointerType !== 'mouse') и lite-режим игнорируем.
  let tiltEl = null;
  let tiltBound = false;
  let tiltRaf = 0;
  function resetTilt() {
    if (!tiltEl) return;
    tiltEl.style.removeProperty('--tilt-x');
    tiltEl.style.removeProperty('--tilt-y');
    tiltEl = null;
  }
  function bindTilt() {
    if (tiltBound || !boardEl || typeof boardEl.addEventListener !== 'function') return;
    tiltBound = true;
    boardEl.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!fxOn('select') || (typeof Perf !== 'undefined' && Perf.isLite && Perf.isLite())) { resetTilt(); return; }
      const target = e.target && e.target.closest ? e.target.closest('.tile.free') : null;
      if (tiltEl && tiltEl !== target) resetTilt();
      if (!target) return;
      cancelAnimationFrame(tiltRaf);
      tiltRaf = requestAnimationFrame(() => {
        const r = target.getBoundingClientRect();
        if (!r.width || !r.height) return;
        tiltEl = target;
        const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
        const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
        target.style.setProperty('--tilt-x', nx.toFixed(2));
        target.style.setProperty('--tilt-y', ny.toFixed(2));
      });
    });
    boardEl.addEventListener('pointerleave', () => { cancelAnimationFrame(tiltRaf); resetTilt(); });
  }

  // ---------- Рубашки на паузе (v44) ----------
  // Пауза не должна давать «подумать»: фишки по волне переворачиваются
  // рубашкой вверх (squeeze по X + смена лицо/рубашка ровно посередине),
  // при выходе из паузы — обратно. Состояние держит .is-paused на доске;
  // .pausing/.unpausing — только на время переворота.
  let coverTimer = null;
  // Мгновенно, без переворота: экран игры закрывают, пауза «растворилась» вместе с ним
  function clearPauseCover() {
    clearTimeout(coverTimer);
    if (boardEl) boardEl.classList.remove('is-paused', 'pausing', 'unpausing');
  }
  function setPauseCover(on) {
    if (!boardEl) return;
    clearTimeout(coverTimer);
    boardEl.classList.remove('pausing', 'unpausing');
    if (fxOn('deal')) {
      tileEls.forEach((el, tile) => {
        if (tile.removed) return;
        el.style.setProperty('--flip-delay',
          dealDelayFor(tile, { stepXY: 5, stepZ: 0, maxDelay: 220 }) + 'ms');
      });
      void boardEl.offsetWidth;
      boardEl.classList.add(on ? 'pausing' : 'unpausing');
      coverTimer = setTimeout(() => boardEl.classList.remove('pausing', 'unpausing'), 950);
    }
    boardEl.classList.toggle('is-paused', !!on);
  }

  // ---------- Размер области без учёта паддингов ----------
  function stageContentSize() {
    if (!stageEl) return { w: 0, h: 0, pad: 0 };
    const cs = window.getComputedStyle(stageEl);
    const w = stageEl.clientWidth -
      (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const h = stageEl.clientHeight -
      (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    return { w, h, pad: parseFloat(cs.paddingLeft) || 0 };
  }

  // ---------- План подгонки: размер + начало доски (v34) ----------
  // Без автомасштаба — по размерам раскладки (как раньше). С ним — по
  // рамке оставшихся фишек; начало доски сдвигается к их левому-верхнему
  // углу, а z-подъём отсчитывается от верхнего оставшегося слоя.
  function planFit(layout, stageW, stageH, scale) {
    let dims = { cols: layout.width, rows: layout.height, layers: Math.max(1, layout.layers) };
    let org = { x: 0, y: 0, z: 0 };
    const state = Game.getState();
    if (Storage.getSetting('autozoom', true) !== false && state && state.tiles) {
      const b = activeBounds(state.tiles);
      if (b) {
        dims = { cols: b.cols, rows: b.rows, layers: b.layers };
        org = { x: b.minX, y: b.minY, z: b.layers - 1 };
      }
    }
    let fit = computeFit({ stageW, stageH, sizeScale: scale, ...dims });
    // v44: «камера» не должна подлетать слишком близко. Фишки при автомасштабе
    // растут не более чем в ZOOM_MAX раз от размера полной раскладки: так
    // финал партии остаётся спокойным, края не упираются в рамку, а резкого
    // «рывка в лицо» на последних парах нет.
    // v44 V4: СТОЛ НЕ ДВИЖЕТСЯ. Рамка и сукно держат размер полной раскладки
    // всю партию, а фишки подрастают ВНУТРИ него (до ZOOM_MAX и не дальше
    // полезной площади). Раньше растил и двигал весь стол — крупное движение
    // на всё поле зрения (это и укачивало). Теперь двигается только то,
    // на что игрок смотрит: фишки.
    let table = null;
    const state2 = Game.getState();
    if (state2 && state2.tiles && Storage.getSetting('autozoom', true) !== false) {
      const base = computeFit({ stageW, stageH, sizeScale: scale,
        cols: layout.width, rows: layout.height, layers: Math.max(1, layout.layers) });
      const outerW = base.boardW + 2 * base.tablePad;
      const outerH = base.boardH + 2 * base.tablePad;
      const cap = zoomCapFor(base.w);
      fit = computeFit({ stageW: (outerW + 2) / scale, stageH: (outerH + 2) / scale,
        sizeScale: scale, ...dims, maxW: cap });
      table = { w: outerW, h: outerH, pad: base.tablePad };
    }
    return { fit, origin: org, dims, table };
  }

  // ---------- Рассчитать размер фишек под экран ----------
  // Множитель интерфейса (--ui-k, app/options.js) — для оценки по окну
  function uiScaleK() {
    const v = Storage.getSetting('uiScale', 'normal');
    return v === 'large' ? 1.2 : v === 'xlarge' ? 1.4 : 1;
  }

  function fitBoard(layout) {
    // ресайз/смена раскладки посреди «подъезда»: старая анимация уже неверна
    if (zoomAnim) { zoomAnim.cancel(); zoomAnim = null; if (boardEl) boardEl.style.transformOrigin = ''; }
    if (!boardEl || !layout) return tileSize;

    let { w: stageW, h: stageH } = stageContentSize();

    // Экран скрыт (display:none) → мерить нечего.
    // v46 (оптимизация + фикс «прыжка размера»): раньше оставляли СТАРЫЙ
    // размер фишек — новая партия (например, Микс на 24 фишки после
    // гиганта на 600) рисовалась первый кадр «как бы издалека», и только
    // reposition после показа экрана всё чинил. Теперь размер ОЦЕНИВАЕМ
    // по окну (estimateStage — та же геометрия, что в галерее раскладок),
    // и первый кадр уже правильный.
    if (!(stageW > 0 && stageH > 0)) {
      const est = estimateStage(window.innerWidth, window.innerHeight, {
        uiScale: uiScaleK(),
        loupe: Storage.getSetting('loupe', true) !== false,
      });
      stageW = est.stageW;
      stageH = est.stageH;
    }
    if (!(stageW > 0 && stageH > 0)) return tileSize;

    const setting = Storage.getSetting('tileSize', 'large');
    const scale = sizeScaleFor(setting);

    const plan = planFit(layout, stageW, stageH, scale);
    const fit = plan.fit;
    origin = plan.origin;

    gap = fit.gap;
    zLift = fit.zLift;
    tileSize = { w: fit.w, h: fit.h };

    // Стол — отступы растут вместе с фишками (без автомасштаба);
    // v44 V4: с автомасштабом стол неподвижен, фишки центруются внутри него
    if (tableEl) {
      const tb = plan.table;
      const pad = tb ? tb.pad : fit.tablePad;
      tableEl.style.padding = pad + 'px';
      // v31: оформление стола (рамка, сукно, угловые накладки) масштабируется от отступа
      tableEl.style.setProperty('--tp', pad + 'px');
      tableEl.style.boxSizing = tb ? 'border-box' : '';
      tableEl.style.width = tb ? tb.w + 'px' : '';
      tableEl.style.height = tb ? tb.h + 'px' : '';
      tableEl.style.display = tb ? 'flex' : '';
      tableEl.style.alignItems = tb ? 'center' : '';
      tableEl.style.justifyContent = tb ? 'center' : '';
      boardEl.style.flexShrink = tb ? '0' : '';
    }

    // CSS-переменные — объём фишек масштабируется вместе с ними
    // (толщина грани, радиус, внутренние рамки, подъём при hover)
    const depth = Math.max(2, Math.min(12, Math.round(fit.h * 0.05)));
    const big = Storage.getSetting('bigSymbols', false) === true;
    const vars = {
      '--tile-depth': depth + 'px',
      '--tile-w': fit.w + 'px',   // v8: для масштаба искр и «+N»
      '--tile-h': fit.h + 'px',   // v8: дальность падения в tile-deal
      '--tile-radius': Math.max(4, Math.min(16, Math.round(fit.w * 0.11))) + 'px',
      // v34: «Крупный рисунок» — поля вокруг рисунка почти убираем (+15–20% к символу)
      '--tile-face-pad': (big ? Math.max(1, Math.round(fit.w * 0.02)) : Math.max(4, Math.round(fit.w * 0.08))) + 'px',
      '--tile-inner-inset': (big ? Math.max(2, Math.round(fit.w * 0.035)) : Math.max(3, Math.round(fit.w * 0.07))) + 'px',
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

    clearHint();
    boardEl.innerHTML = '';
    tileEls.clear();
    lastFreeSet = null;   // новая/пересобранная доска — «пробуждения» не нужны
    // v46: ссылки на элементы умерли вместе с DOM — сбрасываем трекинг выбора
    selectedEl = null;
    candEls = [];
    // новая доска — лицом вверх, НО не если пауза открыта (пересборка во время
    // паузы, например смена скина, не должна открывать фишки за оверлеем)
    const pauseEl = typeof document !== 'undefined' ? document.getElementById('pause-overlay') : null;
    if (!pauseEl || pauseEl.hidden) boardEl.classList.remove('is-paused', 'pausing', 'unpausing');

    // v42: новая партия (пар ещё нет) — медальон возвращается в исходную ориентацию
    if (!state.pairsFound) resetMedallion();

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
    elToTile.set(el, tile);
    el.dataset.tileId = tile.id;
    el.dataset.suit = tile.suit;
    el.dataset.rank = tile.rank;
    // Делаем id градиентов внутри SVG уникальными для каждого экземпляра:
    // 4 копии одной фишки разделяют одну строку face, и дубликаты id
    // (url(#dot1)) по спецификации разрешаются в первый элемент документа.
    el.innerHTML = makeFaceUnique(tile.face, tile.id) +
      '<i class="tile-back" aria-hidden="true"></i>';   // v44: рубашка для паузы

    positionTile(el, tile);

    if (tile.removed) {
      el.classList.add('removed');
    }

    // v8: после каскадной раздачи класс .enter снимается —
    // стили фишки возвращаются к естественным (hover, прозрачность)
    // v44: служебные классы анимаций саморасчищаются по animationend
    // Слушаем И animationend, И animationcancel: если поверх анимации легла другая
    // (например, .hint поверх .wake) или элемент спрятали, браузер шлёт cancel, а не
    // end — класс остался бы висеть и сыграл заново, когда помеха уйдёт.
    const cleanup = e => {
      if (e.target !== el) return;   // события от ауры-ребёнка не наши
      if (e.animationName === 'tile-deal') el.classList.remove('enter');
      if (e.animationName === 'tile-return') el.classList.remove('returning');
      if (e.animationName === 'tile-wake') el.classList.remove('wake');
    };
    el.addEventListener('animationend', cleanup);
    el.addEventListener('animationcancel', cleanup);

    el.addEventListener('click', () => {
      App.onTileClick(tile);
    });

    // v18: лёгкий «tap» при наведении мышью — обратная связь.
    // Только для mouse-устройств (на touch mouseenter не сработает).
    // v26: звук только над СВОБОДНЫМИ фишками — он сам подсказывает,
    // что фишку можно взять. Над заблокированными — тишина.
    el.addEventListener('mouseenter', () => {
      if (typeof Audio2 === 'undefined' || !Audio2.hover) return;
      try {
        if (typeof Game !== 'undefined' && Game.isFree && !Game.isFree(tile)) return;
      } catch (e) { /* нет партии — играем как обычно */ }
      Audio2.hover();
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
      ox: origin.x, oy: origin.y, oz: origin.z,
    });
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    // v46: размер пишем только если изменился — на reposition гигантской
    // доски это убирает до 1200 лишних записей стиля (600 фишек × 2)
    const wStyle = tileSize.w + 'px', hStyle = tileSize.h + 'px';
    if (el.style.width !== wStyle) el.style.width = wStyle;
    if (el.style.height !== hStyle) el.style.height = hStyle;
    el.style.zIndex = pos.zIndex;
    // v14: номер слоя → CSS красит каждый слой своим оттенком (tiles.css)
    el.dataset.layer = tile.z;
  }

  // ---------- Обновить вид одной фишки ----------
  function updateTile(tile) {
    const el = tileEls.get(tile);
    if (!el) return;
    if (tile.removed) el.classList.add('removed');
    else el.classList.remove('removed');
  }

  // ---------- Подсветить выбранную ----------
  // v34: если включено «Показывать пару выбранной» — свободные двойники
  // выбранной фишки получают пульсирующую рамку (.match-cand).
  // v42: при выборе фишка «прожимается» (squash) — глаз видит,
  // что клик принят, ещё до подъёма рамки.
  // v44: никакого squash. Выбор — это переход позы по пружине (tiles.css),
  // он сам перенацеливается из текущей позы при быстрых кликах.
  // Аура-ребёнок .tile-halo создаётся один раз на фишку и дышит opacity.
  function ensureHalo(el) {
    if (el.querySelector(':scope > .tile-halo')) return;
    const halo = document.createElement('i');
    halo.className = 'tile-halo';
    halo.setAttribute('aria-hidden', 'true');
    el.appendChild(halo);
  }

  // v46 (оптимизация): вместо прохода по ВСЕМ фишкам на каждый клик
  // (2×N проверок classList при 200–600 фишках) помним прошлый выбор
  // и прошлых двойников — снимаем классы только с них. Ссылки сбрасываются
  // в renderFull (DOM пересобран — старых элементов больше нет).
  let selectedEl = null;   // элемент прошлой выбранной фишки
  let candEls = [];        // элементы прошлых подсвеченных двойников
  function setSelected(tile) {
    if (selectedEl) selectedEl.classList.remove('selected', 'match-cand');
    for (let i = 0; i < candEls.length; i++) candEls[i].classList.remove('match-cand');
    candEls = [];
    selectedEl = null;
    if (!tile) return;
    const el = tileEls.get(tile);
    if (el) {
      selectedEl = el;
      ensureHalo(el);
      el.classList.add('selected');
    }
    if (Storage.getSetting('showMatches', false) === true) {
      Game.getFreeTiles().forEach(t => {
        if (t !== tile && Tileset.isMatch(tile, t)) {
          const te = tileEls.get(t);
          if (te) { te.classList.add('match-cand'); candEls.push(te); }
        }
      });
    }
  }

  // ---------- Подсветить пару (hint) ----------
  // v34: три стиля («Подсказка» в настройках):
  //   normal — как раньше: три мягких пульса, 2 с;
  //   bold   — толстая рамка, подпрыгивание и линия между фишками, 5 с;
  //   max    — то же, но держится, пока человек не сделает ход (clearHint).
  // Таймеры хранятся по элементам: повторная подсказка не сносит
  // подсветку предыдущей раньше времени.
  const HINT_MS = { normal: 2100, bold: 5000, max: 0 };
  const hintTimers = new Map();
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function clearHint() {
    hintTimers.forEach((timer, el) => {
      clearTimeout(timer);
      el.classList.remove('hint', 'hint-bold', 'hint-max', 'hint-pair-a', 'hint-pair-b');
    });
    hintTimers.clear();
    tileEls.forEach(el => el.classList.remove('hint', 'hint-bold', 'hint-max', 'hint-pair-a', 'hint-pair-b'));
    const old = boardEl ? boardEl.querySelector('.hint-link') : null;
    if (old) old.remove();
  }

  // Линия между двумя подсвеченными фишками — на маленьком экране пару
  // иначе приходится искать глазами по всей доске.
  function drawHintLink(a, b) {
    const ea = tileEls.get(a), eb = tileEls.get(b);
    if (!ea || !eb || !boardEl) return;
    const c = el => ({
      x: (parseFloat(el.style.left) || 0) + tileSize.w / 2,
      y: (parseFloat(el.style.top) || 0) + tileSize.h / 2,
    });
    const p = c(ea), q = c(eb);
    const sw = Math.max(3, Math.round(tileSize.w * 0.07));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'hint-link');
    svg.setAttribute('aria-hidden', 'true');
    const mk = (cls, w) => {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('class', cls);
      l.setAttribute('x1', p.x); l.setAttribute('y1', p.y);
      l.setAttribute('x2', q.x); l.setAttribute('y2', q.y);
      l.setAttribute('stroke-width', w);
      return l;
    };
    svg.appendChild(mk('hint-link-halo', sw + 4));
    svg.appendChild(mk('hint-link-line', sw));
    // v42 «Intent»: линия СНАЧАЛА прорисовывается от первой фишки ко второй
    // (stroke-dashoffset = длина → 0, 0.38 с), затем гаснет, оставляя
    // бегущий пунктир. Взгляд игрока ведётся вдоль линии — пару видно мгновенно.
    const len = Math.round(Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y))) + 2;
    const draw = document.createElementNS(SVG_NS, 'line');
    draw.setAttribute('class', 'hint-link-draw');
    draw.setAttribute('x1', p.x); draw.setAttribute('y1', p.y);
    draw.setAttribute('x2', q.x); draw.setAttribute('y2', q.y);
    draw.setAttribute('stroke-width', Math.max(2, sw - 1));
    draw.style.setProperty('--draw-len', String(len));
    svg.appendChild(draw);
    boardEl.appendChild(svg);
  }

  function flashPair(pair, styleOverride) {
    if (!pair) return;
    clearHint();
    let style = styleOverride || Storage.getSetting('hintStyle', 'normal');
    if (!(style in HINT_MS)) style = 'normal';
    const ms = HINT_MS[style];

    pair.forEach(tile => {
      const el = tileEls.get(tile);
      if (!el) return;
      el.classList.add('hint');
      if (style !== 'normal') el.classList.add('hint-' + style);
      if (ms > 0) {
        hintTimers.set(el, setTimeout(() => {
          el.classList.remove('hint', 'hint-bold', 'hint-max', 'hint-pair-a', 'hint-pair-b');
          hintTimers.delete(el);
          if (hintTimers.size === 0) {
            const l = boardEl.querySelector('.hint-link');
            if (l) l.remove();
          }
        }, ms));
      } else {
        // max: без таймера — снимет clearHint() при следующем действии
        hintTimers.set(el, 0);
      }
    });
    // v42: «дыхание навстречу» — каждой фишке свой вектор к партнёру
    // (--pair-dx/--pair-dy), вторая фишка в противофазе (hint-pair-b).
    if (style !== 'normal' && pair.length === 2) {
      const ea = tileEls.get(pair[0]);
      const eb = tileEls.get(pair[1]);
      if (ea && eb) {
        const cpos = el => ({
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
        });
        const pa = cpos(ea), pb = cpos(eb);
        let vx = pb.x - pa.x, vy = pb.y - pa.y;
        const d = Math.sqrt(vx * vx + vy * vy) || 1;
        const reach = Math.max(6, Math.round(tileSize.w * 0.16));
        vx = Math.round(vx / d * reach);
        vy = Math.round(vy / d * reach);
        ea.style.setProperty('--pair-dx', vx + 'px');
        ea.style.setProperty('--pair-dy', vy + 'px');
        eb.style.setProperty('--pair-dx', (-vx) + 'px');
        eb.style.setProperty('--pair-dy', (-vy) + 'px');
        ea.classList.add('hint-pair-a');
        eb.classList.add('hint-pair-b');
      }
      drawHintLink(pair[0], pair[1]);
    }
  }

  // ---------- Анимация исчезновения ----------
  // .removed (display:none) ставим ПОСЛЕ конца 500-мс анимации,
  // а не через 50 мс — раньше фишки «выскакивали» рывком.
  // v8: пара сначала ПРИТЯГИВАЕТСЯ друг к другу (tile-vanish читает
  // --fly-dx/--fly-dy), в точке матча вспыхивают золотые искры.
  // v42 «Intent»: перед растворением фишки наклоняются друг к
  // другу (знак --tilt-a считает знак к партнёру), затем
  // вспышка-кольцо и растворение. Движение объясняет, ЧТО произошло:
  // «эти двое нашли друг друга».
  // v43: 150 мс вместо 90 (читается, а не щёлкает), и запоминаем
  // ПОЗУ каждой фишки (--lift-base/--lift-scale): выбранная фишка
  // стоит «поднятой», второй близнец — нет. Раньше vanish стартовал
  // из нулевой позы и выбранная фишка проваливалась на ~7px.
  // Фишка убрана: прячем и снимаем ВСЕ служебные классы анимаций.
  // У скрытого (display:none) элемента animationend не приходит, и классы
  // вроде .returning/.enter оставались бы висеть (пара собрана → отмена →
  // снова собрана быстрее, чем доиграл «возврат»).
  const ANIM_CLASSES = ['enter', 'returning', 'wake', 'matching', 'removing', 'reject', 'shake', 'scatter'];
  function markRemoved(el) {
    el.classList.remove(...ANIM_CLASSES);
    el.classList.add('removed');
  }

  function applyAnticipation(el, posSelf, posOther) {
    const dx = posOther.left - posSelf.left;
    const dy = posOther.top - posSelf.top;
    let tilt;
    if (Math.abs(dx) >= Math.abs(dy)) tilt = dx >= 0 ? 4 : -4;   // партнёр сбоку
    else tilt = dy >= 0 ? 3 : -3;                                 // партнёр сверху/снизу
    el.style.setProperty('--tilt-a', tilt + 'deg');
    // v44: поза ожидания = класс .matching (подъём + наклон по transition
    // из ТЕКУЩЕЙ позы); .removing держит ту же позу — стык бесшовный.
    el.classList.add('matching');
  }

  function animateRemove(tiles) {
    const arr = Array.isArray(tiles) ? tiles : [];
    const pair = arr.slice(0, 2);

    // «Эффекты пары» выключены: фишки просто убираем, без движения
    if (!fxOn('match')) {
      arr.forEach(tile => {
        const el = tileEls.get(tile);
        if (el) markRemoved(el);
      });
      return;
    }

    // Вектор сближения + наклон — только если пара из двух фишек
    if (pair.length === 2) {
      const elA = tileEls.get(pair[0]);
      const elB = tileEls.get(pair[1]);
      if (elA && elB) {
        const posA = tilePosition(pair[0], { w: tileSize.w, h: tileSize.h, gap, zLift });
        const posB = tilePosition(pair[1], { w: tileSize.w, h: tileSize.h, gap, zLift });
        const vec = flyVectorFor(posA, posB, { pull: 0.22, maxShift: tileSize.w * 0.35 });
        elA.style.setProperty('--fly-dx', vec.a.dx + 'px');
        elA.style.setProperty('--fly-dy', vec.a.dy + 'px');
        elB.style.setProperty('--fly-dx', vec.b.dx + 'px');
        elB.style.setProperty('--fly-dy', vec.b.dy + 'px');
        applyAnticipation(elA, posA, posB);
        applyAnticipation(elB, posB, posA);
        // Кольцо + искры — когда пара сошлась (≈ середина сближения)
        setTimeout(() => {
          const mid = midpointOf(pair[0], pair[1]);
          spawnMatchRing(mid);
          spawnSparks(mid);
        }, MATCH_ANTICIPATE_MS + 90);
      }
    }

    arr.forEach(tile => {
      const el = tileEls.get(tile);
      if (!el) return;
      setTimeout(() => {
        el.classList.add('removing');
        el.classList.remove('matching');
      }, MATCH_ANTICIPATE_MS);
      setTimeout(() => markRemoved(el), MATCH_ANTICIPATE_MS + MATCH_VANISH_MS + 20);
    });
  }

  // ---------- Кольцо-вспышка в точке матча (v42) ----------
  // Тонкое золотое кольцо раскрывается 0.3 → 1.6 и гаснет.
  // Ставится в момент, когда пара сорвалась с места.
  function spawnMatchRing(point) {
    if (!boardEl || !point || !fxOn('match')) return;
    const el = document.createElement('span');
    el.className = 'match-ring';
    el.style.left = point.x + 'px';
    el.style.top = point.y + 'px';
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 700);
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
    if (!boardEl || !point || !fxOn('match')) return;
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
  // v44: «+N» не гаснет на месте, а ЛЕТИТ в табло счёта — связка «я собрал
  // пару → очки пришли сюда». Плавает в <body> (position: fixed), потому что
  // сукно обрезает всё за своими краями. Возвращает true, если полетит
  // (тогда onArrive вызовется в момент «прилёта» и счёт обновит вызывающий);
  // false — анимации пары выключены или счёта не видно: обновлять сразу.
  function spawnScoreFloat(text, tileA, tileB, onArrive) {
    if (!boardEl || !tileA) return false;
    const point = tileB
      ? midpointOf(tileA, tileB)
      : (() => {
          const p = tilePosition(tileA, { w: tileSize.w, h: tileSize.h, gap, zLift });
          return { x: p.left + tileSize.w / 2, y: p.top + tileSize.h / 2 };
        })();
    const br = boardEl.getBoundingClientRect();
    const sx = br.left + point.x, sy = br.top + point.y;
    const el = document.createElement('div');
    el.className = 'score-float';
    el.textContent = text;
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    const target = typeof document !== 'undefined' ? document.getElementById('game-score') : null;
    const tr = target && target.getBoundingClientRect ? target.getBoundingClientRect() : null;
    const fly = !!(fxOn('match') && tr && tr.width > 0 && typeof onArrive === 'function');
    if (fly) {
      el.style.setProperty('--fly-x', Math.round(tr.left + tr.width / 2 - sx) + 'px');
      el.style.setProperty('--fly-y', Math.round(tr.top + tr.height / 2 - sy) + 'px');
      el.classList.add('to-score');
      setTimeout(onArrive, SCORE_FLY_ARRIVE_MS);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), fly ? SCORE_FLY_MS + 80 : 1100);
    return fly;
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

  // ---------- Каскадная раздача фишек (v8, волна возвращена в v43) ----------
  // Вызывается после renderFull на старте партии, перемешивании
  // и отмене хода. opts.fast — укороченный вариант (для undo).
  // v43: обычная раздача снова идёт ПРЕЖНЕЙ плавной диагональной
  // волной (dealDelayFor: x+y → задержка, слои приезжают последними).
  // Эксперимент v42 «по ветрам» (секторами В→Ю→З→С) дал пятнистую
  // волну с пачками на потолке задержки — вернули то, что нравилось.
  // Функция dealDelayWindsFor осталась экспортом (тесты v42).
  function playDealAnimation(opts) {
    const state = Game.getState();
    if (!boardEl || !state) return;
    const fast = !!(opts && opts.fast);
    // v44: opts.only — вернуть только эти фишки (отмена хода): остальная
    // доска не «пересыпается» заново, падают лишь вернувшиеся.
    const only = opts && Array.isArray(opts.only) ? new Set(opts.only) : null;
    if (!fxOn('deal')) return;

    if (only) {
      only.forEach(tile => {
        const el = tileEls.get(tile);
        if (!el) return;
        el.style.setProperty('--deal-rot', ((Math.random() * 2 - 1) * 2).toFixed(2) + 'deg');
        el.classList.remove('returning');
        void el.offsetWidth;
        el.classList.add('returning');
        setTimeout(() => el.classList.remove('returning'), 700);   // страховка (0.55 с)
      });
      return;
    }

    let maxDelay = 0;
    state.tiles.forEach(tile => {
      if (tile.removed) return;
      const el = tileEls.get(tile);
      if (!el) return;
      const delay = fast
        ? dealDelayFor(tile, { stepXY: 5, stepZ: 22, maxDelay: 240 })
        : dealDelayFor(tile); // классическая диагональная волна (14/55, потолок 750)
      const rot = (Math.random() * 2 - 1) * (fast ? 1.6 : 2.5); // v43: крутка тише
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
    if (!tableEl || !fxOn('shuffle')) return;
    tableEl.classList.remove('table-shake');
    void tableEl.offsetWidth; // перезапуск анимации
    tableEl.classList.add('table-shake');
    setTimeout(() => tableEl.classList.remove('table-shake'), 600);
  }

  // ---------- Разлёт фишек перед перемешиванием (v42 «Intent») ----------
  // Верхний слой (+ случайная треть остальных) разлетается на 18–32px,
  // стол трясётся, и только потом доска пересыпается каскадом заново.
  // cb — что сделать после разлёта (renderFull + раздача).
  // Деградация: reduced-motion / лёгкий режим — сразу cb.
  let scatterTimer = null;
  function scatterTiles(cb) {
    const done = typeof cb === 'function' ? cb : function () {};
    const reduce = typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!boardEl || reduce || !fxOn('shuffle') || (typeof Perf !== 'undefined' && Perf.isLite && Perf.isLite())) {
      done();
      return;
    }
    const state = Game.getState();
    if (!state) { done(); return; }

    let maxZ = 0;
    state.tiles.forEach(t => { if (!t.removed && t.z > maxZ) maxZ = t.z; });

    let scattered = 0;
    tileEls.forEach((el, tile) => {
      if (tile.removed) return;
      // Верхний слой — весь, нижние — каждое третье: разлёт живой, но не хаос
      if (tile.z < maxZ && Math.random() > 0.34) return;
      const ang = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 14; // 18–32px
      el.style.setProperty('--sc-dx', Math.round(Math.cos(ang) * dist) + 'px');
      el.style.setProperty('--sc-dy', Math.round(Math.sin(ang) * dist) + 'px');
      // v43: лёгкая крутка — фишки «взметаются», а не дёргаются
      el.style.setProperty('--sc-rot', ((Math.random() * 2 - 1) * 5).toFixed(2) + 'deg');
      el.classList.remove('scatter');
      void el.offsetWidth;
      el.classList.add('scatter');
      scattered++;
    });

    if (!scattered) { done(); return; }
    clearTimeout(scatterTimer);
    scatterTimer = setTimeout(() => {
      tileEls.forEach(el => el.classList.remove('scatter'));
      done();
    }, 380);
  }

  // ---------- Медальон: прогресс без движения (v44 V4) ----------
  // Раньше на порогах 25/50/75/100% медальон крутился и вспыхивал — большое
  // движение на заднем плане, которое утомляло и укачивало. Теперь медальон
  // НЕ движется: его яркость медленно «проявляется» вместе с прогрессом
  // (setProgress → --med-progress, transition 2.5 с в motion.css). За весь
  // матч это ±12% непрозрачности: ни вспышек, ни событий, только фон,
  // который к финалу становится чуть выразительнее.
  function pulseMedallion() { /* совместимость: порог пройден, визуала нет */ }
  function medallionMat() {
    return medallionEl && medallionEl.closest ? medallionEl.closest('.table-mat') : null;
  }
  function setProgress(frac) {
    const mat = medallionMat();
    if (!mat) return;
    const f = Math.max(0, Math.min(1, Number(frac) || 0));
    mat.style.setProperty('--med-progress', f.toFixed(3));
  }
  function resetMedallion() {
    setProgress(0);
  }

  // ---------- Комбо: ЛОКАЛЬНАЯ обратная связь (v44 V4) ----------
  // Только там, куда смотрит игрок, — у самой пары: искры, а на ×4, ×8, ×12…
  // ещё и второе, чуть запоздавшее кольцо. Никаких виньеток, вспышек по краям
  // экрана и подсветки панелей: периферийные вспышки утомляют и не нужны —
  // «×N» уже написано рядом с парой и в индикаторе серии.
  function comboFeedback(combo, point) {
    const c = Math.round(Number(combo) || 0);
    if (c < 2) return;
    if (point) spawnSparks(point, c >= 8 ? 12 : 8);
    if (point && c >= 4 && c % 4 === 0) setTimeout(() => spawnMatchRing(point), 150);
  }

  // ---------- Подсветить все свободные ----------
  // v44: «пробуждение» — фишка, ставшая свободной после хода, коротко
  // вспыхивает. Только при включённой подсветке свободных (иначе анимация
  // выдавала бы то, что игрок скрыл) и только для уже стоявшей доски.
  let lastFreeSet = null;
  function highlightFree(enabled) {
    if (!enabled) { clearHighlight(); return; }
    const state = Game.getState();
    if (!state) return;
    const freeSet = new Set(Game.getFreeTiles()); // объекты фишек
    const wakeOn = lastFreeSet && fxOn('match');
    tileEls.forEach((el, tile) => {
      if (freeSet.has(tile)) {
        if (wakeOn && !lastFreeSet.has(tile) && !el.classList.contains('enter') &&
            !el.classList.contains('returning')) {
          el.classList.remove('wake');
          void el.offsetWidth;
          el.classList.add('wake');
          setTimeout(() => el.classList.remove('wake'), 1000);   // страховка (0.9 с)
        }
        el.classList.add('free');
      } else el.classList.remove('free');
    });
    lastFreeSet = freeSet;
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
    // v34: линия подсказки привязана к пикселям — перерисуем под новый размер
    const link = boardEl ? boardEl.querySelector('.hint-link') : null;
    if (link) {
      const hinted = [...tileEls.keys()].filter(t => tileEls.get(t).classList.contains('hint'));
      link.remove();
      if (hinted.length === 2) drawHintLink(hinted[0], hinted[1]);
    }
  }

  // ---------- Автомасштаб после хода (v34) ----------
  // Считает, какого размера были бы фишки по оставшимся, и если выигрыш
  // заметен (или фишки иначе не влезут) — плавно «подъезжает» к новому
  // размеру. Возвращает true, если размер поменялся.
  // v44: классов .rezoom больше нет — см. smoothReposition
  function refit() {
    const state = Game.getState();
    if (!state || !boardEl || !state.layout) return false;
    if (Storage.getSetting('autozoom', true) === false) return false;
    const { w: stageW, h: stageH } = stageContentSize();
    if (!(stageW > 0 && stageH > 0)) return false;
    const scale = sizeScaleFor(Storage.getSetting('tileSize', 'large'));
    const plan = planFit(state.layout, stageW, stageH, scale);
    if (!shouldRefit(tileSize.w, plan.fit.w)) return false;
    smoothReposition();
    return true;
  }

  // ---------- Плавное приближение фишек (v44, V4) ----------
  // Доска пересобирается один раз в конечный размер, а плавность даёт ОДНА
  // анимация слоя фишек (translate + scale на композиторе, FLIP). Стол
  // (рамка и сукно) НЕ участвует — он неподвижен всю партию. Повторный
  // подъезд подхватывает текущую картинку и идёт без скачка. Выключатель —
  // категория «Приближение стола»: выкл → размер меняется шагом, мгновенно.
  let zoomAnim = null;
  function pickAnchor() {
    for (const [tile, el] of tileEls) {
      if (tile.removed) continue;
      const c = el.classList;
      if (c.contains('removed') || c.contains('removing') || c.contains('matching')) continue;
      return el;
    }
    return null;
  }
  // Центр и ширина фишки в координатах окна — по ЛАЙАУТУ (offsetLeft/Top),
  // а не по её анимированной позе (подъём, наклон), но с учётом масштаба стола
  function anchorGeometry(el) {
    const br = boardEl.getBoundingClientRect();
    const sc = boardEl.offsetWidth ? br.width / boardEl.offsetWidth : 1;
    return {
      x: br.left + (el.offsetLeft + el.offsetWidth / 2) * sc,
      y: br.top + (el.offsetTop + el.offsetHeight / 2) * sc,
      w: el.offsetWidth * sc,
    };
  }
  function smoothReposition() {
    const lite = typeof Perf !== 'undefined' && Perf.isLite && Perf.isLite();
    const canAnimate = fxOn('camera') && !lite && boardEl && typeof boardEl.animate === 'function';
    const anchor = canAnimate ? pickAnchor() : null;
    const before = anchor ? anchorGeometry(anchor) : null;
    if (zoomAnim) { zoomAnim.cancel(); zoomAnim = null; boardEl.style.transformOrigin = ''; }
    reposition();
    if (!before || !anchor || !(before.w > 0)) return;
    const after = anchorGeometry(anchor);
    const k = before.w / after.w;
    if (!isFinite(k) || k <= 0 || Math.abs(k - 1) < 0.01) return;
    const t = boardEl.getBoundingClientRect();
    const dx = before.x - t.left - k * (after.x - t.left);
    const dy = before.y - t.top - k * (after.y - t.top);
    // V4: подъезд короче и ровнее (стол не двигается — амплитуда видна только на фишках)
    const ms = Math.round(520 + Math.min(280, Math.abs(Math.log(k)) * 1400));
    boardEl.style.transformOrigin = '0 0';
    const anim = boardEl.animate(
      [{ translate: dx + 'px ' + dy + 'px', scale: String(k) }, { translate: '0px 0px', scale: '1' }],
      { duration: ms, easing: 'cubic-bezier(0.3, 0, 0.15, 1)' });
    zoomAnim = anim;
    const done = () => { if (zoomAnim === anim) { zoomAnim = null; boardEl.style.transformOrigin = ''; } };
    anim.onfinish = done;
    anim.oncancel = done;
  }

  // После исчезновения пары (анимация 450 мс) — не раньше, чтобы
  // фишки не «ехали» под ещё улетающей парой
  let refitTimer = null;
  function scheduleRefit(delay) {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(refit, delay === undefined ? 520 : delay);
  }

  // Лицо фишки с уникальными id (для лупы: второй экземпляр на странице)
  function faceHtml(tile, key) { return makeFaceUnique(tile.face, key + tile.id); }

  // Фишка по её DOM-элементу (лупа показывает фишку под курсором)
  function tileOf(el) {
    const t = el && el.closest ? el.closest('.tile') : null;
    return t ? (elToTile.get(t) || null) : null;
  }

  // v47-perf: элемент фишки по объекту фишки — O(1) по карте вместо
  // document.querySelector по всему документу в клик-пути (play.js).
  // Возвращает null, если фишки нет на доске (например, экран настроек).
  function getTileEl(tile) {
    return tile ? (tileEls.get(tile) || null) : null;
  }

  // v47-perf: элемент ТЕКУЩЕЙ выбранной фишки — заменяет
  // querySelector('#board .tile.selected') в play.js; трекинг уже
  // вёлся для v46-оптимизации setSelected, теперь им пользуется и клик-путь
  function getSelectedEl() {
    return selectedEl;
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
    // v34
    clearHint,
    refit,
    scheduleRefit,
    tileOf,
    faceHtml,
    estimateStage,
    estimateTileWidth,
    activeBounds,
    shouldRefit,
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
    // анимации v42 «Intent»
    spawnMatchRing,
    scatterTiles,
    pulseMedallion,
    setProgress,
    resetMedallion,
    comboFeedback,
    dealDelayWindsFor,
    windSectorRank,
    WIND_STEP_MS,
    DEAL_WINDS_STEP_XY,
    DEAL_WINDS_STEP_Z,
    MATCH_ANTICIPATE_MS,
    MATCH_VANISH_MS,
    SCORE_FLY_MS,
    SCORE_FLY_ARRIVE_MS,
    setPauseCover,
    clearPauseCover,
    // чистые функции — для тестов
    computeFit,
    zoomCapFor,
    ZOOM_MAX,
    tilePosition,
    zIndexOf,
    sizeScaleFor,
    SIZE_SCALES,
    // v47-perf: быстрый доступ к элементам фишек (клик-путь play.js)
    getTileEl,
    getSelectedEl,
  };
})();
