/* ============================================================
   MIXMETRICS.JS — Измерения раскладки: жёсткость и красота (v40)

   Два независимых измерения готовой доски (список {x, y, z}):

   1. ЖЁСТКОСТЬ (hardness, 1..10) — «насколько доска сопротивляется».
      Считается по пробным разборкам (случайные пары свободных фишек).
      Две составляющие:
      • ТЕСНОТА: средняя «открытость» c = f / √r, где f — число
        свободных фишек, r — сколько осталось. У компактной фигуры
        периметр растёт как √площади, поэтому c не зависит от размера:
        низкое c — мало свободных фишек для такой массы (тощая, глубоко
        вложенная доска), высокое — доска «раскрыта».
      • ЛОВУШКИ: доля пробных разборок, закончившихся тупиком
        (осталась одна свободная фишка) — «неумолимость» порядка.
      ВАЖНО (проверено измерением, см. tests/mixmetrics.test.js): сырые
      «минимум/среднее число свободных пар» почти целиком определяются
      размером доски (корреляция с числом фишек 0.65…0.94), поэтому для
      «жёсткости независимо от размера» не годятся — берём нормированное c.
      Шкала: готовые раскладки занимают ≈1–8, медиана ≈4; концы шкалы
      подогнаны под то, что умеет строить генератор.

   2. КРАСОТА (beauty, 0..1) — эвристика для best-of-N: компактность,
      гладкость границы, отсутствие «дыр» и обрывков, точность
      заявленной симметрии, пропорции под экран 16:9. Это не истина,
      а вкус: веса подобраны на глаз по контактным листам.

   Всё детерминировано: те же фишки и seed → те же числа.
   ============================================================ */

const MixMetrics = (function () {

  // ---------- Сетка фишек в полклетках ----------
  // Все координаты игры лежат на сетке 0.5, поэтому свободность
  // проверяется за O(1) по индексу, а не перебором всех фишек.
  function buildGrid(ps) {
    let hx = 0, hy = 0, hz = 0;
    for (const p of ps) {
      hx = Math.max(hx, Math.round(p.x * 2));
      hy = Math.max(hy, Math.round(p.y * 2));
      hz = Math.max(hz, p.z);
    }
    const PAD = 4;                       // запас под соседей за краем
    const X = hx + 1 + PAD * 2;
    const Y = hy + 1 + PAD * 2;
    const Z = hz + 2;
    const cells = new Int32Array(X * Y * Z).fill(-1);
    const at = (z, x, y) => (z * Y + (y + PAD)) * X + (x + PAD);
    ps.forEach((p, i) => { cells[at(p.z, Math.round(p.x * 2), Math.round(p.y * 2))] = i; });
    return { cells, at, Z, hx, hy };
  }

  // Свободна ли живая фишка i (копия правил Game.spotIsFree)
  function isFree(g, ps, alive, i) {
    const p = ps[i];
    const x = Math.round(p.x * 2);
    const y = Math.round(p.y * 2);
    if (p.z + 1 < g.Z) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = g.cells[g.at(p.z + 1, x + dx, y + dy)];
          if (j >= 0 && alive[j]) return false;
        }
      }
    }
    let left = false;
    let right = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = 1; dx <= 3; dx++) {
        const r = g.cells[g.at(p.z, x + dx, y + dy)];
        if (r >= 0 && alive[r]) right = true;
        const l = g.cells[g.at(p.z, x - dx, y + dy)];
        if (l >= 0 && alive[l]) left = true;
      }
    }
    return !(left && right);
  }

  // ---------- Одна пробная разборка ----------
  // Возвращает { ok, trace: [[free, remaining], ...] }.
  // Каждый шаг убирает две случайные свободные фишки.
  function simulate(ps, rng, grid) {
    const n = ps.length;
    const g = grid || buildGrid(ps);
    const alive = new Uint8Array(n).fill(1);
    const inFree = new Int32Array(n).fill(-1);   // позиция в списке свободных
    const free = [];
    const add = i => { inFree[i] = free.length; free.push(i); };
    const drop = i => {
      const k = inFree[i];
      if (k < 0) return;
      const last = free.pop();
      if (last !== i) { free[k] = last; inFree[last] = k; }
      inFree[i] = -1;
    };
    for (let i = 0; i < n; i++) if (isFree(g, ps, alive, i)) add(i);

    const trace = [];
    let remaining = n;
    while (remaining > 0) {
      if (free.length < 2) return { ok: false, trace };
      trace.push([free.length, remaining]);
      const i = Math.floor(rng() * free.length);
      let j = Math.floor(rng() * (free.length - 1));
      if (j >= i) j += 1;
      const a = free[i];
      const b = free[j];
      for (const t of [a, b]) { alive[t] = 0; drop(t); }
      remaining -= 2;
      // Освободиться могли только соседи убранных фишек
      for (const t of [a, b]) {
        const p = ps[t];
        const x = Math.round(p.x * 2);
        const y = Math.round(p.y * 2);
        for (let dz = -1; dz <= 0; dz++) {
          const z = p.z + dz;
          if (z < 0) continue;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const k = g.cells[g.at(z, x + dx, y + dy)];
              if (k >= 0 && alive[k] && inFree[k] < 0 && isFree(g, ps, alive, k)) add(k);
            }
          }
        }
      }
    }
    return { ok: true, trace };
  }

  // Можно ли разобрать до конца (до 12 случайных попыток)
  function dismantlable(ps, rng) {
    const g = buildGrid(ps);
    for (let attempt = 0; attempt < 12; attempt++) {
      if (simulate(ps, rng, g).ok) return true;
    }
    return false;
  }

  // ---------- Жёсткость ----------
  // c ≈ 1.9 (тощие «Рыба», «Корона») … 3.7 (раскрытые «Пагода», «Квадрат»);
  // границы шкалы выбраны так, чтобы её концы были ДОСТИЖИМЫ генератором
  // (иначе слайдер «10» обещал бы то, чего он не умеет построить);
  // тупик при случайной игре у готовых раскладок бывает до ~0.3.
  //   raw = 0.7 · теснота(c) + 0.3 · ловушки(stuck)
  const CAL = { cOpen: 3.2, cTight: 2.15, stuckMax: 0.25 };
  const RUNS = 24;

  function hardnessOf(c, stuck) {
    const tight = Math.max(0, Math.min(1, (CAL.cOpen - c) / (CAL.cOpen - CAL.cTight)));
    const traps = Math.max(0, Math.min(1, stuck / CAL.stuckMax));
    const raw = 0.7 * tight + 0.3 * traps;
    return Math.round((1 + 9 * raw) * 10) / 10;
  }

  // Измерить доску. seed делает результат воспроизводимым.
  function measure(ps, seed, runs) {
    const R = runs || RUNS;
    const base = (Math.floor(Number(seed)) >>> 0) || 1;
    const g = buildGrid(ps);
    const N = ps.length;
    const floor = Math.max(12, Math.round(N * 0.3));   // середина партии
    let stuck = 0, sum = 0, cnt = 0;
    for (let k = 0; k < R; k++) {
      const res = simulate(ps, rngFor(base + k * 104729), g);
      if (!res.ok) stuck += 1;
      for (const [f, r] of res.trace) {
        if (r < floor) continue;
        sum += f / Math.sqrt(r);
        cnt += 1;
      }
    }
    const c = cnt ? sum / cnt : 3;
    const stuckRate = stuck / R;
    return { openness: c, stuck: stuckRate, hardness: hardnessOf(c, stuckRate) };
  }

  // Тот же mulberry32, что и в MixGen (чтобы модуль не зависел от него)
  function rngFor(seed) {
    let s = (Math.floor(Number(seed)) >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Красота ----------
  // Все составляющие в 0..1 (1 — лучше). Считаются по нижнему слою
  // (силуэт) и по всей доске (пропорции, симметрия).
  function beauty(ps, sym, W, H) {
    const ground = ps.filter(p => p.z === 0);
    if (!ground.length) return { score: 0, parts: {} };
    const key = (x, y) => x + ',' + y;
    const cells = new Set(ground.map(p => key(p.x, p.y)));
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // Периметр: число открытых граней клеток силуэта
    let perim = 0;
    for (const p of ground) {
      for (const [dx, dy] of N4) if (!cells.has(key(p.x + dx, p.y + dy))) perim += 1;
    }
    // Изопериметрическая компактность: круг-подобный силуэт ≈ 1,
    // «рваный» — к 0. Для квадрата n×n: 4n / (4·n) → нормируем на квадрат.
    const minPerim = 4 * Math.sqrt(ground.length);
    const smooth = Math.max(0, Math.min(1, minPerim / perim));

    // Заполненность прямоугольника: пустой «воздух» в углах — не плохо
    // (фигуры бывают круглыми), поэтому вес мал; штрафуем лишь крайности
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of ground) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const fill = ground.length / (bw * bh);
    const fillScore = Math.max(0, Math.min(1, (fill - 0.25) / 0.45));

    // Связность: сколько кусков (4-соседство) и нет ли одиночек
    const seen = new Set();
    let comps = 0, singles = 0, biggest = 0;
    for (const p of ground) {
      const k0 = key(p.x, p.y);
      if (seen.has(k0)) continue;
      comps += 1;
      let size = 0;
      const stack = [p];
      seen.add(k0);
      while (stack.length) {
        const c = stack.pop();
        size += 1;
        for (const [dx, dy] of N4) {
          const k = key(c.x + dx, c.y + dy);
          if (cells.has(k) && !seen.has(k)) { seen.add(k); stack.push({ x: c.x + dx, y: c.y + dy }); }
        }
      }
      if (size === 1) singles += 1;
      if (size > biggest) biggest = size;
    }
    const connected = Math.max(0, 1 - (comps - 1) * 0.12 - singles * 0.12);

    // Дыры: пустые клетки внутри bbox, окружённые со всех 4 сторон
    let holes = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (cells.has(key(x, y))) continue;
        if (N4.every(([dx, dy]) => cells.has(key(x + dx, y + dy)))) holes += 1;
      }
    }
    const holeScore = Math.max(0, 1 - holes * 0.25);

    // Симметрия: доля фишек (по всем слоям), чей двойник на месте
    let symScore = 1;
    if (sym && sym !== 'none') {
      const all = new Set(ps.map(p => p.z + ':' + key(p.x, p.y)));
      const maps = mapsFor(sym, minX, maxX, minY, maxY);
      let ok = 0;
      for (const p of ps) {
        if (maps.every(f => { const q = f(p.x, p.y); return all.has(p.z + ':' + key(q[0], q[1])); })) ok += 1;
      }
      symScore = ok / ps.length;
    }

    // Пропорции: физический размер доски (фишка 5:7) против экрана 16:9.
    // Идеал — шире высоты; «башня» на широком мониторе мельчит фишки.
    const physW = (W || bw) * 5;
    const physH = (H || bh) * 7;
    const aspect = physW / physH;
    const ratioScore = aspect >= 1.1 && aspect <= 1.9 ? 1
      : aspect < 1.1 ? Math.max(0, 1 - (1.1 - aspect) * 1.6)
      : Math.max(0, 1 - (aspect - 1.9) * 0.8);

    const parts = { smooth, fillScore, connected, holeScore, symScore, ratioScore };
    const score =
      0.26 * smooth + 0.10 * fillScore + 0.20 * connected +
      0.10 * holeScore + 0.22 * symScore + 0.12 * ratioScore;
    return { score, parts, comps, holes, singles, biggest };
  }

  // Преобразования симметрии для измерения погрешности
  function mapsFor(sym, minX, maxX, minY, maxY) {
    const fx = (x, y) => [minX + maxX - x, y];
    const fy = (x, y) => [x, minY + maxY - y];
    const fxy = (x, y) => [minX + maxX - x, minY + maxY - y];
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const ft = (x, y) => [cx + (y - cy), cy + (x - cx)];
    if (sym === 'mirror') return [fx];
    if (sym === 'quad') return [fx, fy, fxy];
    if (sym === 'point') return [fxy];
    if (sym === 'diag') return [fx, fy, fxy, ft];
    return [];
  }

  return { buildGrid, isFree, simulate, dismantlable, measure, beauty, rngFor, CAL, RUNS };
})();
