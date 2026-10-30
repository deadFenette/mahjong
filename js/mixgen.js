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
   • glyph («Иероглиф», v40) — доска в форме символа: иероглиф или
     до трёх букв (js/mixglyph.js, маски лежат в js/glyph-data.js).
   • surprise — случайный выбор из двух способов (scratch / blend).

   v40: ЛУЧШИЙ ИЗ 8. Генератор строит до CANDIDATES кандидатов,
   отбрасывает неразбираемые, измеряет красоту (MixMetrics.beauty) и —
   если задана «Жёсткость» — реальную жёсткость доски, и берёт лучшего.
   Номер выбранного кандидата пишется в mixSpec.pick, поэтому
   «Продолжить» не повторяет поиск. Спецификации старше v40 (без ver)
   восстанавливаются прежним алгоритмом (legacy), чтобы начатая партия
   не получила другую доску.

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
  // v45: «гигантские доски» — кап поднимается до 600, только когда в
  // спецификации стоит bigboard: true (галка внизу экрана Микса).
  // Без галки всё по-прежнему режется до 200: Daily и старые сохранения
  // не должны заметить изменений.
  const MAX_TILES_BIG = 600;
  const DEFAULT_TILES = 96;
  const MAX_LAYERS = 5;
  const METHODS = ['blend', 'scratch', 'surprise', 'glyph'];
  // none/mirror/quad — как раньше (индексы 0..2 использует Daily);
  // point — поворот на 180°, diag — «мандала»: зеркала + диагональ,
  // 8-кратная симметрия на квадратной сетке (доска получается высокой)
  const SYMMETRIES = ['none', 'mirror', 'quad', 'point', 'diag'];
  const VERSION = 2;
  const CANDIDATES = 8;
  const HARDNESS_WEIGHT = 0.15;   // штраф красоты за каждый пункт промаха

  const DEFAULTS = Object.freeze({
    method: 'surprise',
    tiles: DEFAULT_TILES,
    layers: 3,
    symmetry: 'mirror',
    stagger: false,
    hardness: 0,     // 0 — «любая», 1..10 — целевая жёсткость
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
  function clampEven(n, big) {
    let v = Math.round(Number(n));
    if (!Number.isFinite(v)) v = DEFAULT_TILES;
    const cap = big ? MAX_TILES_BIG : MAX_TILES;
    v = Math.max(MIN_TILES, Math.min(cap, v));
    return v - (v % 2);
  }

  function normalize(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const layers = Math.round(Number(o.layers));
    const hard = Math.round(Number(o.hardness));
    const pick = Math.round(Number(o.pick));
    const legacy = o.legacy === true;
    const big = o.bigboard === true;   // v45: галка «гигантская доска»
    const out = {
      seed: (Math.floor(Number(o.seed)) >>> 0) || 1,
      method: METHODS.includes(o.method) ? o.method : DEFAULTS.method,
      tiles: clampEven(o.tiles === undefined ? DEFAULT_TILES : o.tiles, big),
      layers: Number.isFinite(layers) ? Math.max(1, Math.min(MAX_LAYERS, layers)) : DEFAULTS.layers,
      symmetry: SYMMETRIES.includes(o.symmetry) ? o.symmetry : DEFAULTS.symmetry,
      stagger: o.stagger === true || o.stagger === 'true',
    };
    if (legacy) { out.legacy = true; return out; }   // v31-спецификация: прежние поля
    out.ver = VERSION;
    out.bigboard = big;
    out.hardness = Number.isFinite(hard) ? Math.max(0, Math.min(10, hard)) : 0;
    if (Number.isFinite(pick) && pick >= 0 && pick < CANDIDATES) out.pick = pick;
    // Символ хранится В спецификации: доска не зависит от шрифтов игрока
    if (o.glyph && MixGlyph.decode(o.glyph)) {
      out.glyph = { text: String(o.glyph.text || '').slice(0, 3), w: o.glyph.w, h: o.glyph.h, bits: o.glyph.bits };
    }
    return out;
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

  // Пробная разборка (v31, медленная O(n³)). Нужна ТОЛЬКО legacy-пути:
  // решения «принять/отклонить» должны совпасть с теми, что принимались
  // при создании старых сохранений. Новый код — MixMetrics.dismantlable.
  function isDismantlableLegacy(positions, rng) {
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
    // v45: кап зависит от галки «гигантская доска» в спецификации
    const cap = layout.mixSpec && layout.mixSpec.bigboard ? MAX_TILES_BIG : MAX_TILES;
    if (ps.length < MIN_TILES || ps.length > cap) errors.push('число фишек вне диапазона: ' + ps.length);
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
    if (sym === 'point') pts.push([W - 1 - x, H - 1 - y]);
    if (sym === 'diag') {
      // группа квадрата (8 элементов): сетка обязана быть квадратной (W == H)
      pts.push([W - 1 - x, y], [x, H - 1 - y], [W - 1 - x, H - 1 - y]);
      pts.push([y, x], [W - 1 - y, x], [y, W - 1 - x], [W - 1 - y, W - 1 - x]);
    }
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

  // v40: подгонка до N целыми ОРБИТАМИ симметрии. Одиночный growTo/shrinkTo
  // ломал симметрию (у «креста», «поворота», «мандалы» она почти не
  // сохранялась); здесь добавляется/снимается сразу весь «узор из копий».
  // Что не вошло по размеру орбиты — довершат одиночные growTo/shrinkTo.
  function fitSymmetric(ps, N, rng, sym, W, H, maxLayers) {
    const has = (x, y, z) => ps.some(o => o.z === z && Math.abs(o.x - x) < 0.01 && Math.abs(o.y - y) < 0.01);
    let guard = 0;
    while (ps.length > N && guard++ < 400) {
      const need = ps.length - N;
      let best = null;
      let bestScore = -Infinity;
      for (const t of ps) {
        if (hasAbove(ps, t)) continue;
        const orb = orbitOf(t.x, t.y, W, H, sym);
        const members = orb.map(([x, y]) => ps.find(o => o.z === t.z &&
          Math.abs(o.x - x) < 0.01 && Math.abs(o.y - y) < 0.01));
        if (members.some(m => !m || hasAbove(ps, m)) || members.length > need) continue;
        const d = Math.max(Math.abs(t.x - (W - 1) / 2) / Math.max(1, (W - 1) / 2),
          Math.abs(t.y - (H - 1) / 2) / Math.max(1, (H - 1) / 2));
        const score = d * 3 + t.z * 0.5 + members.length * 0.2 + rng() * 0.6;
        if (score > bestScore) { bestScore = score; best = members; }
      }
      if (!best) break;
      best.forEach(m => ps.splice(ps.indexOf(m), 1));
    }
    guard = 0;
    while (ps.length < N && guard++ < 400) {
      const need = N - ps.length;
      const spots = [];
      const seen = new Set();
      const consider = (x, y, z, w) => {
        const k = x + ',' + y + ',' + z;
        if (seen.has(k)) return;
        seen.add(k);
        const orb = orbitOf(x, y, W, H, sym);
        if (orb.length > need) return;
        const free = (a, b) => !ps.some(o => o.z === z && overlaps(o, { x: a, y: b }));
        const ok = orb.every(([a, b], i) =>
          a >= 0 && b >= 0 && a <= W - 1 && b <= H - 1 && free(a, b) &&
          (z === 0 || has(a, b, z - 1)) &&
          orb.every(([c, d], j) => j <= i || !overlaps({ x: a, y: b }, { x: c, y: d })));
        if (!ok) return;
        orb.forEach(([a, b]) => seen.add(a + ',' + b + ',' + z));
        spots.push({ orb, z, w: w * orb.length });
      };
      for (const g of ps.filter(p => p.z === 0)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nb = ps.filter(o => o.z === 0 &&
            Math.abs(o.x - (g.x + dx)) <= 1.01 && Math.abs(o.y - (g.y + dy)) <= 1.01).length;
          consider(g.x + dx, g.y + dy, 0, nb * nb);
        }
      }
      for (const t of ps) {
        if (t.z + 1 >= maxLayers) continue;
        const nbTop = ps.filter(o => o.z === t.z + 1 &&
          Math.abs(o.x - t.x) <= 1.01 && Math.abs(o.y - t.y) <= 1.01).length;
        consider(t.x, t.y, t.z + 1, 0.15 + 3 * nbTop);
      }
      if (!spots.length) break;
      let total = 0;
      spots.forEach(c => { total += c.w; });
      let r = rng() * total;
      let pick = spots[spots.length - 1];
      for (const c of spots) { r -= c.w; if (r <= 0) { pick = c; break; } }
      pick.orb.forEach(([a, b]) => ps.push({ x: a, y: b, z: pick.z }));
    }
  }

  // ov — необязательные рычаги формы (aspect, compact, gain, stagger),
  // которыми pickBest направляет кандидатов к целевой жёсткости
  function genScratch(o, rng, ov) {
    ov = ov || {};
    const stagger = ov.stagger !== undefined ? ov.stagger : o.stagger;
    const N = o.tiles;
    const sym = o.symmetry;
    const targets = layerTargets(N, o.layers, stagger);

    // Сетка основания: нечётные размеры — ось симметрии проходит через клетки
    const area = Math.max(40, targets[0] * (2.3 + rng() * 1.1));
    let aspect = 1.7 + rng() * 0.9;
    if (ov.aspect) aspect = ov.aspect;
    let H = Math.max(3, Math.round(Math.sqrt(area / aspect)));
    if (H % 2 === 0) H += 1;
    let W = Math.max(5, Math.round(H * aspect));
    if (W % 2 === 0) W += 1;
    while (W * H < targets[0] * 1.6) { W += 2; }
    if (sym === 'diag') {            // «мандала»: квадратная нечётная сетка
      let S = Math.max(W, H);
      if (S % 2 === 0) S += 1;
      while (S * S < targets[0] * 1.6) S += 2;
      W = S; H = S;
    }

    const cx = (W - 1) / 2;
    const cy = (H - 1) / 2;
    let compact = 1 + rng() * 1.8;     // 1 — рваная форма, 2.8 — плотное пятно
    if (ov.compact) compact = ov.compact;
    // «Притягивающие» точки: пятно тянется к ним лопастями (крест,
    // звезда, рукава). Они тоже подчиняются симметрии.
    const attract = [[cx, cy]];
    const nAttr = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < nAttr; i++) {
      const ax = Math.floor(rng() * W);
      const ay = Math.floor(rng() * H);
      orbitOf(ax, ay, W, H, sym).forEach(pt => attract.push(pt));
    }
    let gain = 1.2 + rng() * 2.6;      // насколько сильно лопасти вытягиваются
    if (ov.gain) gain = ov.gain;

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
      if (stagger) {
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
    if (!o.legacy && sym !== 'none' && all.length !== N) {
      fitSymmetric(all, N, rng, sym, W, H, Math.min(o.layers, MAX_LAYERS));
    }
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
  //  СПОСОБ 3: «ИЕРОГЛИФ» (v40)
  // ============================================================

  // variant 0..3 — разный порог чернил: даёт кандидатам чуть разную
  // толщину штрихов, из которых выбирается вернейший
  function genGlyph(o, variant) {
    const glyph = o.glyph || MixGlyph.dailyGlyph(o.seed);
    const r = MixGlyph.layoutFromGlyph(glyph, o.tiles, o.layers, variant);
    if (!r) return null;
    return { positions: r.positions, parts: [], fidelity: r.fidelity, glyph };
  }

  // ============================================================
  //  ТОЧКА ВХОДА
  // ============================================================

  const SYM_TEXT = {
    none: 'без симметрии', mirror: 'зеркальная', quad: 'крестом',
    point: 'поворот на 180°', diag: 'мандала (8 осей)',
  };

  function codeOf(seed) {
    return (seed >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  }

  // Старая оценка «по размеру» — только для legacy-спецификаций
  function difficultyFor(n) {
    return n <= 64 ? 'easy' : (n <= 120 ? 'normal' : 'hard');
  }
  // Новая — по измеренной жёсткости (шкала MixMetrics: 4–5 типично)
  function difficultyFromHardness(h) {
    return h <= 3.5 ? 'easy' : (h <= 6 ? 'normal' : 'hard');
  }

  // Рычаги формы для кандидата. Нужны только когда задана жёсткость:
  // первые два кандидата — «как получится», остальные тянутся к цели.
  // Что даёт каждый рычаг (измерено): вытянутая плотная форма и слои
  // «пирамидой» жёстче (7+); рваная лопастная — открытее (2.5–4).
  // Выводятся из (жёсткость, номер) — поэтому pick однозначно
  // восстанавливает кандидата.
  function steer(o, attempt) {
    if (!(o.hardness > 0) || attempt < 2 || o.method !== 'scratch') return {};
    const t = (o.hardness - 1) / 9;
    const j = makeRng((o.seed ^ 0x9e3779b9) + attempt * 131)();
    const lerp = (a, b, k) => a + (b - a) * k;
    const ov = {
      compact: lerp(1.0, 2.8, t),
      aspect: lerp(1.1, 6, t) * (0.85 + 0.3 * j),
      gain: lerp(3.8, 1.2, t),
    };
    if (t > 0.7) ov.stagger = true;
    return ov;
  }

  function buildCandidate(o, attempt, layoutsSource) {
    let r;
    if (o.method === 'glyph') {
      r = genGlyph(o, attempt);
      if (!r) r = genScratch(o, makeRng((o.seed + Math.imul(attempt, 7919)) >>> 0));
    } else {
      const rng = makeRng((o.seed + Math.imul(attempt, 7919)) >>> 0);
      r = o.method === 'blend' ? genBlend(o, rng, layoutsSource) : genScratch(o, rng, steer(o, attempt));
    }
    return { r, fin: finalize(r.positions) };
  }

  // Прежний алгоритм v31: первый удачный кандидат (для старых сохранений)
  function pickLegacy(o, layoutsSource) {
    let result = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const cand = buildCandidate(o, attempt, layoutsSource);
      result = cand;
      if (cand.r.positions.length === o.tiles &&
          isDismantlableLegacy(cand.fin.positions, makeRng(o.seed + attempt))) break;
    }
    return { cand: result, attempt: null, metrics: null };
  }

  // v40: лучший из CANDIDATES. Правильный кандидат = ровно N фишек и
  // разбираем до конца; из таких побеждает больший
  //   качество = красота − 0.15 · |жёсткость − цель|   (цель задана)
  // Если правильных нет — берём самый близкий по числу фишек.
  function pickBest(o, layoutsSource) {
    const attempts = o.pick !== undefined ? [o.pick] : Array.from({ length: CANDIDATES }, (_, i) => i);
    const symForScore = o.method === 'scratch' ? o.symmetry : 'none';
    let best = null;
    let fallback = null;
    for (const attempt of attempts) {
      const cand = buildCandidate(o, attempt, layoutsSource);
      const ps = cand.fin.positions;
      const closeness = -Math.abs(ps.length - o.tiles);
      if (!fallback || closeness > fallback.closeness) fallback = { cand, attempt, closeness };
      if (ps.length !== o.tiles) continue;
      if (!MixMetrics.dismantlable(ps, makeRng(o.seed + attempt))) continue;

      const beauty = MixMetrics.beauty(ps, symForScore, cand.fin.width, cand.fin.height);
      let score = beauty.score;
      if (o.method === 'glyph' && cand.r.fidelity !== undefined) {
        // у иероглифа главное — узнаваемость, а не гладкость силуэта
        score = 0.65 * cand.r.fidelity + 0.35 * beauty.parts.ratioScore;
      }
      let hard = null;
      if (o.hardness > 0) {
        hard = MixMetrics.measure(ps, o.seed + attempt);
        score -= HARDNESS_WEIGHT * Math.abs(hard.hardness - o.hardness);
      }
      if (!best || score > best.score) best = { cand, attempt, score, beauty, hard };
      // v45: гигантские доски (>200) — берём ПЕРВОГО годного кандидата.
      // Перебор всех восьмых на 600 фишках стоит десятки секунд
      // (сращивание дорожает квадратично), а первый валидный так же
      // детерминирован от seed — доски и сохранения воспроизводимы.
      // Доски ≤200 считаются как раньше: качество не тронуто.
      if (best && o.tiles > MAX_TILES) break;
    }
    if (!best) {
      const f = fallback;
      return { cand: f.cand, attempt: f.attempt, metrics: null };
    }
    const hard = best.hard || MixMetrics.measure(best.cand.fin.positions, o.seed + best.attempt);
    return {
      cand: best.cand,
      attempt: best.attempt,
      metrics: { beauty: best.beauty.score, hardness: hard.hardness, openness: hard.openness },
    };
  }

  function generate(opts, source) {
    const o = normalize(opts);
    const legacy = o.legacy === true;
    const layoutsSource = source || (typeof Layouts !== 'undefined' ? Layouts.all : []);

    // «Сюрприз» решаем один раз — в спецификации хранится уже готовый способ
    if (o.method === 'surprise') {
      o.method = makeRng(o.seed ^ 0x5bd1e995)() < 0.5 ? 'blend' : 'scratch';
    }
    if (o.method === 'blend' && layoutsSource.length < 2) o.method = 'scratch';
    // v45: на гигантах (>200) сращивание дорожает квадратично (секунды
    // генерации) — там строим «с нуля». Спецификация остаётся детерминированной.
    if (o.method === 'blend' && o.tiles > MAX_TILES) o.method = 'scratch';
    if (o.method === 'glyph' && !o.glyph && !MixGlyph.dailyGlyph(o.seed)) o.method = 'scratch';

    const picked = legacy ? pickLegacy(o, layoutsSource) : pickBest(o, layoutsSource);
    const { r, fin } = picked.cand;
    const count = fin.positions.length;
    const layers = fin.positions.reduce((m, p) => Math.max(m, p.z), 0) + 1;
    const code = codeOf(o.seed);
    if (!legacy && picked.attempt !== null) o.pick = picked.attempt;

    let name = 'Узор ' + code;
    let description;
    if (o.method === 'blend') {
      description = 'Сращена из «' + r.names[0] + '» и «' + r.names[1] + '»';
    } else if (o.method === 'glyph') {
      const text = (r.glyph && r.glyph.text) || '';
      name = 'Знак ' + text;
      description = 'Доска в форме знака «' + text + '»' + (layers > 1 ? ', слои — хребтом штрихов' : '');
      if (!o.glyph && r.glyph) o.glyph = { text: r.glyph.text, w: r.glyph.w, h: r.glyph.h, bits: r.glyph.bits };
    } else {
      description = 'Построена с нуля, ' + SYM_TEXT[o.symmetry] +
        (fin.positions.some(p => p.x % 1 || p.y % 1) ? ', слои пирамидой' : '');
    }
    const m = picked.metrics;
    return {
      id: 'mix_gen_' + o.seed,
      name,
      description,
      difficulty: m ? difficultyFromHardness(m.hardness) : difficultyFor(count),
      icon: '✦',
      tilesCount: count,
      positions: fin.positions,
      width: fin.width,
      height: fin.height,
      layers,
      isMix: true,
      mixComponents: r.parts,
      mixSpec: o,
      hardness: m ? m.hardness : null,
      beauty: m ? Math.round(m.beauty * 100) / 100 : null,
    };
  }

  return {
    generate, normalize, validate, makeRng, randomSeed,
    isDismantlable: (ps, rng) => MixMetrics.dismantlable(ps, rng),
    MIN_TILES, MAX_TILES, MAX_TILES_BIG, DEFAULT_TILES, MAX_LAYERS, METHODS, SYMMETRIES, DEFAULTS,
    CANDIDATES, VERSION,
  };
})();
