/* ============================================================
   MIXGEN.JS — Генератор уникальной раскладки для режима «Микс» (v31)

   Один вызов MixGen.generate(opts) создаёт ОДНУ новую раскладку.
   Результат полностью определяется параметрами и seed: те же
   параметры → та же доска (на этом держится «Продолжить партию»
   и Ежедневный микс — раскладка не хранится, а пересоздаётся).

   Два способа:
   • scratch («С нуля») — «пятно» растёт от центра по сетке, затем
     поверх строятся слои меньшего размера. Можно задать симметрию
     (нет / зеркало / крест) и смещение слоёв пирамидой.
   • blend («Из двух раскладок») — берём две готовые раскладки
     близкого размера и сращиваем их по волнистому шву
     (вертикальному, горизонтальному или диагональному).
   • surprise — случайный выбор из двух способов.

   ПРАВИЛА, которые гарантирует генератор (проверяются тестами):
   1. Число фишек ЧЁТНОЕ, не меньше MIN_TILES и не больше
      MAX_TILES — доска никогда не раздувается до сотен фишек.
   2. В одном слое фишки не перекрываются (расстояние ≥ 1 клетки).
   3. Каждая фишка верхнего слоя опирается на фишку слоя ниже.
   4. Слоёв не больше MAX_LAYERS.
   5. Доску можно разобрать до конца парами (проверяется
      пробной разборкой; сама раздача в game.js всё равно
      строится «задом наперёд», так что партия решаема).
   6. Координаты неотрицательны и вписаны в width × height.
   ============================================================ */

const MixGen = (function () {

  const MIN_TILES = 24;
  const MAX_TILES = 200;
  const DEFAULT_TILES = 96;
  const MAX_LAYERS = 5;
  const METHODS = ['blend', 'scratch', 'surprise'];
  const SYMMETRIES = ['none', 'mirror', 'quad'];

  const DEFAULTS = Object.freeze({
    method: 'surprise',
    tiles: DEFAULT_TILES,
    layers: 3,
    symmetry: 'mirror',
    stagger: false,
  });

  // ---------- Генератор случайных чисел (mulberry32) ----------
  // Собственный, а не Math.random: результат обязан быть
  // одинаковым у всех игроков и после перезапуска.
  function makeRng(seed) {
    let s = (Math.floor(Number(seed)) >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
  }

  // ---------- Параметры ----------
  function clampEven(n) {
    let v = Math.round(Number(n));
    if (!Number.isFinite(v)) v = DEFAULT_TILES;
    v = Math.max(MIN_TILES, Math.min(MAX_TILES, v));
    return v - (v % 2);
  }

  function normalize(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const layers = Math.round(Number(o.layers));
    return {
      seed: (Math.floor(Number(o.seed)) >>> 0) || 1,
      method: METHODS.includes(o.method) ? o.method : DEFAULTS.method,
      tiles: clampEven(o.tiles === undefined ? DEFAULT_TILES : o.tiles),
      layers: Number.isFinite(layers) ? Math.max(1, Math.min(MAX_LAYERS, layers)) : DEFAULTS.layers,
      symmetry: SYMMETRIES.includes(o.symmetry) ? o.symmetry : DEFAULTS.symmetry,
      stagger: o.stagger === true || o.stagger === 'true',
    };
  }

  // ---------- Геометрия (та же, что в game.js) ----------
  const overlaps = (a, b) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;

  // Фишка свободна: сверху ничего нет и открыт левый или правый бок.
  // Копия Game.spotIsFree — генератор не должен зависеть от game.js.
  function spotIsFree(spots, spot) {
    const covered = spots.some(o =>
      o !== spot && o.z === spot.z + 1 &&
      Math.abs(o.x - spot.x) < 0.75 && Math.abs(o.y - spot.y) < 0.75);
    if (covered) return false;
    let left = false;
    let right = false;
    for (const o of spots) {
      if (o === spot || o.z !== spot.z) continue;
      if (Math.abs(o.y - spot.y) > 0.75) continue;
      const dx = o.x - spot.x;
      if (dx < -0.25 && dx > -1.75) left = true;
      else if (dx > 0.25 && dx < 1.75) right = true;
    }
    return !(left && right);
  }

  // Пробная разборка: можно ли убрать всё парами свободных фишек.
  function isDismantlable(positions, rng) {
    for (let attempt = 0; attempt < 12; attempt++) {
      let rest = positions.slice();
      let ok = true;
      while (rest.length > 0) {
        const free = rest.filter(p => spotIsFree(rest, p));
        if (free.length < 2) { ok = false; break; }
        const i = Math.floor(rng() * free.length);
        let j = Math.floor(rng() * (free.length - 1));
        if (j >= i) j += 1;
        const a = free[i];
        const b = free[j];
        rest = rest.filter(p => p !== a && p !== b);
      }
      if (ok) return true;
    }
    return false;
  }

  // ---------- Проверка правил (используют и тесты) ----------
  // Возвращает список нарушений; пустой список — раскладка корректна.
  function validate(layout) {
    const errors = [];
    const ps = layout.positions;
    if (ps.length % 2 !== 0) errors.push('нечётное число фишек');
    if (ps.length < MIN_TILES || ps.length > MAX_TILES) errors.push('число фишек вне диапазона: ' + ps.length);
    if (layout.tilesCount !== ps.length) errors.push('tilesCount не совпадает');
    const maxZ = ps.reduce((m, p) => Math.max(m, p.z), 0);
    if (maxZ + 1 > MAX_LAYERS) errors.push('слишком много слоёв');
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.x < 0 || p.y < 0 || p.x + 1 > layout.width + 1e-9 || p.y + 1 > layout.height + 1e-9) {
        errors.push('фишка вне границ');
        break;
      }
    }
    for (let i = 0; i < ps.length && errors.length < 6; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        if (ps[i].z === ps[j].z && overlaps(ps[i], ps[j])) { errors.push('перекрытие фишек в слое'); i = ps.length; break; }
      }
    }
    for (const p of ps) {
      if (p.z > 0 && !ps.some(q => q.z === p.z - 1 && overlaps(p, q))) { errors.push('фишка висит в воздухе'); break; }
    }
    return errors;
  }

  // ============================================================
  //  ОБЩИЕ ИНСТРУМЕНТЫ: подгонка до точного числа фишек
  // ============================================================

  function bounds(ps) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ps) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  function hasAbove(ps, t) {
    return ps.some(o => o.z === t.z + 1 && overlaps(o, t));
  }

  // Убрать лишние фишки: только те, на которых ничего не лежит.
  // Сначала уходят края (форма «усыхает» равномерно), а не одни
  // верхние слои.
  function shrinkTo(ps, N, rng) {
    while (ps.length > N) {
      const b = bounds(ps);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const hw = Math.max(1, (b.maxX - b.minX) / 2 + 0.5);
      const hh = Math.max(1, (b.maxY - b.minY) / 2 + 0.5);
      let best = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < ps.length; i++) {
        const t = ps[i];
        if (hasAbove(ps, t)) continue;
        const d = Math.max(Math.abs(t.x - cx) / hw, Math.abs(t.y - cy) / hh);
        const score = d * 3 + t.z * 0.5 + rng() * 0.6;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) break;
      ps.splice(best, 1);
    }
  }

  // Добавить недостающие фишки: на землю рядом с существующими
  // (форма растёт) или на вершину имеющихся (растёт высота).
  function growTo(ps, N, rng, maxLayers, canvas) {
    let guard = 0;
    while (ps.length < N && guard++ < 4000) {
      const ground = ps.filter(p => p.z === 0);
      const cand = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const seen = new Set();
      for (const g of ground) {
        for (const [dx, dy] of dirs) {
          const x = g.x + dx;
          const y = g.y + dy;
          if (x < canvas.minX || y < canvas.minY || x > canvas.maxX || y > canvas.maxY) continue;
          const k = x + ',' + y;
          if (seen.has(k)) continue;
          seen.add(k);
          const spot = { x, y, z: 0 };
          if (ground.some(o => overlaps(o, spot))) continue;
          const nb = ground.filter(o =>
            Math.abs(o.x - x) <= 1.01 && Math.abs(o.y - y) <= 1.01).length;
          cand.push({ x, y, z: 0, w: nb * nb });
        }
      }
      const tops = [];
      for (const t of ps) {
        if (t.z + 1 >= maxLayers) continue;
        const spot = { x: t.x, y: t.y, z: t.z + 1 };
        if (ps.some(o => o.z === spot.z && overlaps(o, spot))) continue;
        const nbTop = ps.filter(o => o.z === spot.z &&
          Math.abs(o.x - spot.x) <= 1.01 && Math.abs(o.y - spot.y) <= 1.01).length;
        tops.push({ x: spot.x, y: spot.y, z: spot.z, w: 0.15 + 3 * nbTop });
      }
      let pool;
      if (cand.length && tops.length) pool = rng() < 0.65 ? cand : tops;
      else pool = cand.length ? cand : tops;
      if (!pool.length) break;
      let total = 0;
      pool.forEach(c => { total += c.w; });
      let r = rng() * total;
      let pick = pool[pool.length - 1];
      for (const c of pool) { r -= c.w; if (r <= 0) { pick = c; break; } }
      ps.push({ x: pick.x, y: pick.y, z: pick.z });
    }
  }

  // Сдвинуть в (0,0) и посчитать размеры
  function finalize(ps) {
    const b = bounds(ps);
    const out = ps.map(p => ({ x: p.x - b.minX, y: p.y - b.minY, z: p.z }));
    const nb = bounds(out);
    return {
      positions: out,
      width: Math.ceil(nb.maxX) + 1,
      height: Math.ceil(nb.maxY) + 1,
    };
  }

  // ============================================================
  //  СПОСОБ 1: «С НУЛЯ»
  // ============================================================

  function orbitOf(x, y, W, H, sym) {
    const pts = [[x, y]];
    if (sym === 'mirror' || sym === 'quad') pts.push([W - 1 - x, y]);
    if (sym === 'quad') { pts.push([x, H - 1 - y]); pts.push([W - 1 - x, H - 1 - y]); }
    const seen = new Set();
    return pts.filter(([a, b]) => {
      const k = a + ',' + b;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // Доля фишек по слоям: каждый следующий слой меньше предыдущего
  function layerTargets(N, layers, stagger) {
    const r = stagger ? 0.5 : 0.6;
    let L = layers;
    for (;;) {
      const w = [];
      let sum = 0;
      for (let z = 0; z < L; z++) { w.push(Math.pow(r, z)); sum += w[z]; }
      const t = w.map(v => Math.round(N * v / sum));
      if (L === 1 || Math.min(...t) >= 4) {
        t[0] += N - t.reduce((a, b) => a + b, 0);
        return t;
      }
      L -= 1; // слишком мало фишек на верхний слой — убираем слой
    }
  }

  function genScratch(o, rng) {
    const N = o.tiles;
    const sym = o.symmetry;
    const targets = layerTargets(N, o.layers, o.stagger);

    // Сетка основания: нечётные размеры — ось симметрии проходит через клетки
    const area = Math.max(40, targets[0] * (2.3 + rng() * 1.1));
    const aspect = 1.7 + rng() * 0.9;
    let H = Math.max(3, Math.round(Math.sqrt(area / aspect)));
    if (H % 2 === 0) H += 1;
    let W = Math.max(5, Math.round(H * aspect));
    if (W % 2 === 0) W += 1;
    while (W * H < targets[0] * 1.6) { W += 2; }

    const cx = (W - 1) / 2;
    const cy = (H - 1) / 2;
    const compact = 1 + rng() * 1.8;   // 1 — рваная форма, 2.8 — плотное пятно
    // «Притягивающие» точки: пятно тянется к ним лопастями (крест,
    // звезда, рукава). Они тоже подчиняются симметрии.
    const attract = [[cx, cy]];
    const nAttr = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < nAttr; i++) {
      const ax = Math.floor(rng() * W);
      const ay = Math.floor(rng() * H);
      orbitOf(ax, ay, W, H, sym).forEach(pt => attract.push(pt));
    }
    const gain = 1.2 + rng() * 2.6;    // насколько сильно лопасти вытягиваются

    // --- Слой 0: растим пятно ---
    const base = new Map();
    const addOrbit = (x, y) => {
      const orb = orbitOf(x, y, W, H, sym);
      orb.forEach(([a, b]) => base.set(a + ',' + b, { x: a, y: b, z: 0 }));
    };
    addOrbit(cx, cy);
    let guard = 0;
    while (base.size < targets[0] && guard++ < 2000) {
      const remaining = targets[0] - base.size;
      const cand = [];
      const seen = new Set();
      for (const c of base.values()) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = c.x + dx;
          const y = c.y + dy;
          if (x < 0 || y < 0 || x > W - 1 || y > H - 1) continue;
          const k = x + ',' + y;
          if (base.has(k) || seen.has(k)) continue;
          seen.add(k);
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .filter(([ax, ay]) => base.has((x + ax) + ',' + (y + ay))).length;
          const orbSize = orbitOf(x, y, W, H, sym).filter(([a, b]) => !base.has(a + ',' + b)).length;
          if (orbSize > remaining) continue;
          let dmin = Infinity;
          for (const [qx, qy] of attract) {
            const d = Math.hypot((x - qx) / Math.max(1, cx), (y - qy) / Math.max(1, cy));
            if (d < dmin) dmin = d;
          }
          cand.push({ x, y, w: Math.pow(nb, compact) * Math.exp(-dmin * gain) + 0.005 });
        }
      }
      if (!cand.length) break;
      let total = 0;
      cand.forEach(c => { total += c.w; });
      let r = rng() * total;
      let pick = cand[cand.length - 1];
      for (const c of cand) { r -= c.w; if (r <= 0) { pick = c; break; } }
      addOrbit(pick.x, pick.y);
    }

    let layerCells = Array.from(base.values());
    const all = layerCells.map(c => ({ x: c.x, y: c.y, z: 0 }));

    // --- Верхние слои: самые «глубокие» клетки нижнего слоя ---
    for (let z = 1; z < targets.length; z++) {
      const prev = new Map(layerCells.map(c => [c.x + ',' + c.y, c]));
      let cands = [];
      if (o.stagger) {
        // центры полностью заполненных блоков 2×2 — классическая «пирамида»
        for (const c of layerCells) {
          if (prev.has((c.x + 1) + ',' + c.y) && prev.has(c.x + ',' + (c.y + 1)) &&
              prev.has((c.x + 1) + ',' + (c.y + 1))) {
            cands.push({ x: c.x + 0.5, y: c.y + 0.5 });
          }
        }
      } else {
        cands = layerCells.map(c => ({ x: c.x, y: c.y }));
      }
      if (!cands.length) break;
      const cmap = new Map(cands.map(c => [c.x + ',' + c.y, c]));
      const step = 1;
      cands.forEach(c => {
        const nb = [[step, 0], [-step, 0], [0, step], [0, -step]]
          .filter(([ax, ay]) => cmap.has((c.x + ax) + ',' + (c.y + ay))).length;
        c.score = nb + rng() * 1.1;
      });
      cands.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);

      const chosen = new Map();
      const want = Math.min(targets[z], cands.length);
      for (const c of cands) {
        if (chosen.size >= want) break;
        if (chosen.has(c.x + ',' + c.y)) continue;
        const orb = orbitOf(c.x, c.y, W, H, sym)
          .filter(([a, b]) => cmap.has(a + ',' + b) && !chosen.has(a + ',' + b));
        if (chosen.size + orb.length > want) continue;
        orb.forEach(([a, b]) => chosen.set(a + ',' + b, { x: a, y: b }));
      }
      layerCells = Array.from(chosen.values());
      if (!layerCells.length) break;
      layerCells.forEach(c => all.push({ x: c.x, y: c.y, z }));
    }

    const canvas = { minX: 0, minY: 0, maxX: W - 1, maxY: H - 1 };
    if (all.length > N) shrinkTo(all, N, rng);
    if (all.length < N) growTo(all, N, rng, Math.min(o.layers, MAX_LAYERS), canvas);
    return { positions: all, parts: [] };
  }

  // ============================================================
  //  СПОСОБ 2: «ИЗ ДВУХ РАСКЛАДОК»
  // ============================================================

  // Берём раскладки, близкие по размеру к цели: так форма
  // почти не страдает при подгонке до нужного числа фишек.
  function pickPair(N, rng, source) {
    const list = source.slice().sort((a, b) =>
      Math.abs(a.tilesCount - N) - Math.abs(b.tilesCount - N) || (a.id < b.id ? -1 : 1));
    const pool = list.slice(0, Math.min(10, list.length));
    const i = Math.floor(rng() * pool.length);
    let j = Math.floor(rng() * (pool.length - 1));
    if (j >= i) j += 1;
    return [pool[i], pool[j]];
  }

  function genBlend(o, rng, source) {
    const N = o.tiles;
    const [A, B] = pickPair(N, rng, source);
    const W = Math.max(A.width, B.width);
    const H = Math.max(A.height, B.height);
    const flipB = rng() < 0.5;
    const flipBY = rng() < 0.5;

    // Центрируем обе раскладки на общем холсте
    const place = (L, flip, flipY) => L.positions.map(p => ({
      x: Math.floor((W - L.width) / 2) + (flip ? (L.width - 1 - p.x) : p.x),
      y: (H - L.height) / 2 + (flipY ? (L.height - 1 - p.y) : p.y),
      z: p.z,
    }));
    const pa = place(A, false, false);
    const pb = place(B, flipB, flipBY);

    // Шов: волнистая линия, делящая холст на «часть A» и «часть B»
    const mode = ['vertical', 'horizontal', 'diagonal'][Math.floor(rng() * 3)];
    const t0 = 0.4 + rng() * 0.2;
    const amp = rng() * 0.14;
    const freq = 0.6 + rng() * 1.4;
    const phase = rng();
    const side = p => {
      const u = (p.x + 0.5) / W;
      const v = (p.y + 0.5) / H;
      let main, other;
      if (mode === 'vertical') { main = u; other = v; }
      else if (mode === 'horizontal') { main = v; other = u; }
      else { main = (u + v) / 2; other = (u - v) / 2 + 0.5; }
      return main - t0 + amp * Math.sin(Math.PI * 2 * (freq * other + phase));
    };

    const kept = pa.filter(p => side(p) < 0);
    pb.filter(p => side(p) >= 0).forEach(p => {
      if (!kept.some(q => q.z === p.z && overlaps(p, q))) kept.push(p);
    });

    // Убираем фишки, повисшие в воздухе после разреза (снизу вверх)
    const maxZ = kept.reduce((m, p) => Math.max(m, p.z), 0);
    let ps = kept.filter(p => p.z === 0);
    for (let z = 1; z <= maxZ; z++) {
      const lower = ps.filter(q => q.z === z - 1);
      kept.filter(p => p.z === z && lower.some(q => overlaps(p, q))).forEach(p => ps.push(p));
    }

    const canvas = { minX: 0, minY: 0, maxX: W - 1, maxY: H - 1 };
    if (ps.length > N) shrinkTo(ps, N, rng);
    if (ps.length < N) growTo(ps, N, rng, Math.min(MAX_LAYERS, Math.max(2, maxZ + 1)), canvas);
    return { positions: ps, parts: [A.id, B.id], names: [A.name, B.name] };
  }

  // ============================================================
  //  ТОЧКА ВХОДА
  // ============================================================

  const SYM_TEXT = { none: 'без симметрии', mirror: 'зеркальная', quad: 'крестом' };

  function codeOf(seed) {
    return (seed >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  }

  function difficultyFor(n) {
    return n <= 64 ? 'easy' : (n <= 120 ? 'normal' : 'hard');
  }

  function generate(opts, source) {
    const o = normalize(opts);
    const layoutsSource = source || (typeof Layouts !== 'undefined' ? Layouts.all : []);

    // «Сюрприз» решаем один раз — в спецификации хранится уже готовый способ
    if (o.method === 'surprise') {
      o.method = makeRng(o.seed ^ 0x5bd1e995)() < 0.5 ? 'blend' : 'scratch';
    }
    if (o.method === 'blend' && layoutsSource.length < 2) o.method = 'scratch';

    let result = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const rng = makeRng((o.seed + Math.imul(attempt, 7919)) >>> 0);
      const r = o.method === 'blend' ? genBlend(o, rng, layoutsSource) : genScratch(o, rng);
      const fin = finalize(r.positions);
      const cand = { r, fin };
      result = cand;
      if (r.positions.length === o.tiles && isDismantlable(fin.positions, makeRng(o.seed + attempt))) break;
    }

    const { r, fin } = result;
    const count = fin.positions.length;
    const layers = fin.positions.reduce((m, p) => Math.max(m, p.z), 0) + 1;
    const code = codeOf(o.seed);
    let description;
    if (o.method === 'blend') {
      description = 'Сращена из «' + r.names[0] + '» и «' + r.names[1] + '»';
    } else {
      description = 'Построена с нуля, ' + SYM_TEXT[o.symmetry] +
        (o.stagger ? ', слои пирамидой' : '');
    }
    return {
      id: 'mix_gen_' + o.seed,
      name: 'Узор ' + code,
      description,
      difficulty: difficultyFor(count),
      icon: '✦',
      tilesCount: count,
      positions: fin.positions,
      width: fin.width,
      height: fin.height,
      layers,
      isMix: true,
      mixComponents: r.parts,
      mixSpec: o,
    };
  }

  return {
    generate, normalize, validate, isDismantlable, makeRng, randomSeed,
    MIN_TILES, MAX_TILES, DEFAULT_TILES, MAX_LAYERS, METHODS, SYMMETRIES, DEFAULTS,
  };
})();
