/* ============================================================
   MIXGLYPH.JS — Раскладка в форме иероглифа или букв (v40)

   Идея: нарисовать символ жирным шрифтом, превратить в маску
   и посадить на неё фишки. Две части, намеренно разделённые:

   1. ЧИСТАЯ часть (работает и в Node, поэтому тестируется):
      битмап {w, h, bits} → позиции фишек. Битмап — 1 бит на
      пиксель, строка за строкой, hex. Это единственный вход
      генератора; шрифты и canvas ему не нужны.

   2. БРАУЗЕРНАЯ часть: rasterize(text) рисует текст на canvas
      и выдаёт такой же битмап.

   ПОЧЕМУ ТАК. Растеризация шрифта различается между браузерами,
   ОС и версиями шрифта на уровне пикселей. Если раскладка
   строилась бы из canvas «на лету», то у двух игроков «иероглиф
   дня» мог бы получиться разным, а «Продолжить» после обновления
   шрифта — другим. Поэтому:
     • курируемые символы лежат готовыми битмапами (js/glyph-data.js,
       сняты с Noto Sans CJK SC Black) — общий дейли у всех одинаков;
     • произвольный текст растеризуется один раз, а битмап
       сохраняется В СПЕЦИФИКАЦИИ раскладки — доска воспроизводима.

   Сетка: фишка 5:7, поэтому для «квадратного» символа нужно
   в 1.4 раза больше колонок, чем рядов. Число рядов подбирается
   так, чтобы после слоёв получилось ровно N фишек.
   ============================================================ */

const MixGlyph = (function () {

  const SIZE = 48;                 // сторона эталонного битмапа
  const TILE_RATIO = 1.4;          // высота фишки / ширина
  const MAX_CHARS = 3;
  const MAX_ROWS = 40;
  const LAYER_RATIO = 0.6;         // каждый верхний слой ≈ 60% нижнего
  const THRESHOLDS = [0.5, 0.4, 0.6, 0.45];   // варианты кандидатов

  // ---------- Битмап ----------
  function decode(g) {
    if (!g || !(g.w > 0) || !(g.h > 0) || typeof g.bits !== 'string') return null;
    if (g.w > SIZE * MAX_CHARS || g.h > SIZE * MAX_CHARS) return null;
    if (g.bits.length < Math.ceil(g.w * g.h / 4)) return null;
    const px = new Uint8Array(g.w * g.h);
    let ink = 0;
    for (let i = 0; i < px.length; i++) {
      const v = parseInt(g.bits[i >> 2], 16);
      if (Number.isNaN(v)) return null;
      px[i] = (v >> (3 - (i & 3))) & 1;
      ink += px[i];
    }
    if (ink === 0) return null;
    return { w: g.w, h: g.h, px, ink };
  }

  function encode(px, w, h) {
    let hex = '';
    let acc = 0;
    let n = 0;
    for (let i = 0; i < w * h; i++) {
      acc = (acc << 1) | (px[i] ? 1 : 0);
      if (++n === 4) { hex += acc.toString(16); acc = 0; n = 0; }
    }
    if (n) hex += (acc << (4 - n)).toString(16);
    return hex;
  }

  // ---------- Покрытие ячеек сетки C × R (доля чернил, 0..1) ----------
  function coverage(bm, C, R) {
    // интегральное изображение — покрытие любой ячейки за O(1)
    const W1 = bm.w + 1;
    const I = new Int32Array(W1 * (bm.h + 1));
    for (let y = 0; y < bm.h; y++) {
      let row = 0;
      for (let x = 0; x < bm.w; x++) {
        row += bm.px[y * bm.w + x];
        I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row;
      }
    }
    const sum = (x0, y0, x1, y1) => I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
    const cov = new Float64Array(C * R);
    for (let r = 0; r < R; r++) {
      const y0 = Math.floor(r * bm.h / R);
      const y1 = Math.max(y0 + 1, Math.floor((r + 1) * bm.h / R));
      for (let c = 0; c < C; c++) {
        const x0 = Math.floor(c * bm.w / C);
        const x1 = Math.max(x0 + 1, Math.floor((c + 1) * bm.w / C));
        cov[r * C + c] = sum(x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0));
      }
    }
    return cov;
  }

  function gridFor(bm, R) {
    const aspect = bm.w / bm.h;
    return { R, C: Math.max(1, Math.round(TILE_RATIO * aspect * R)) };
  }

  // «Глубина» клетки: расстояние (по 4 соседям) до края силуэта
  function depthMap(sel, C, R) {
    const d = new Int16Array(C * R);
    const q = [];
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        if (!sel[i]) continue;
        const edge = c === 0 || r === 0 || c === C - 1 || r === R - 1 ||
          !sel[i - 1] || !sel[i + 1] || !sel[i - C] || !sel[i + C];
        if (edge) { d[i] = 1; q.push(i); }
      }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const c = i % C;
      const r = (i - c) / C;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= C || rr >= R) continue;
        const j = rr * C + cc;
        if (sel[j] && !d[j]) { d[j] = d[i] + 1; q.push(j); }
      }
    }
    return d;
  }

  // Сколько фишек получится на масштабе R: основание + верхние слои
  function capacity(bm, R, th, layers) {
    const { C } = gridFor(bm, R);
    const cov = coverage(bm, C, R);
    const sel = new Uint8Array(C * R);
    let ground = 0;
    for (let i = 0; i < cov.length; i++) if (cov[i] >= th) { sel[i] = 1; ground += 1; }
    const d = depthMap(sel, C, R);
    const caps = [];
    for (let z = 1; z < layers; z++) {
      let n = 0;
      for (let i = 0; i < d.length; i++) if (d[i] >= z + 1) n += 1;
      caps.push(n);
    }
    let total = ground;
    let want = ground;
    for (let z = 1; z < layers; z++) {
      want *= LAYER_RATIO;
      total += Math.min(caps[z - 1], Math.round(want));
    }
    return { C, cov, sel, d, ground, caps, total };
  }

  // ---------- Битмап → позиции фишек ----------
  // Возвращает { positions, cols, rows, fidelity } или null.
  function layoutFromGlyph(glyph, N, layers, variant) {
    const bm = decode(glyph);
    if (!bm) return null;
    const th = THRESHOLDS[(variant || 0) % THRESHOLDS.length];
    const L = Math.max(1, layers);

    // Наименьший масштаб, на котором вмещается N фишек (по оценке ёмкости)
    let R = 3;
    let cap = capacity(bm, R, th, L);
    while (cap.total < N && R < MAX_ROWS) { R += 1; cap = capacity(bm, R, th, L); }

    // Оценка ёмкости оптимистична: верхние слои строятся по уже урезанному
    // основанию. Не набралось ровно N — укрупняем сетку и строим заново.
    let res = buildAt(bm, R, th, L, N, cap);
    while (res.positions.length < N && R < MAX_ROWS) {
      R += 1;
      res = buildAt(bm, R, th, L, N, capacity(bm, R, th, L));
    }
    return res.positions.length === N ? res : null;
  }

  // Построить доску на масштабе R: основание по рангу покрытия + «хребет»
  function buildAt(bm, R, th, L, N, cap) {
    const { C, cov, caps } = cap;
    // Основание: клетки по убыванию покрытия; при равенстве — ближе к центру
    const cx = (C - 1) / 2;
    const cy = (R - 1) / 2;
    const order = Array.from({ length: C * R }, (_, i) => i).sort((a, b) => {
      if (cov[b] !== cov[a]) return cov[b] - cov[a];
      const da = Math.hypot(a % C - cx, Math.floor(a / C) - cy);
      const db = Math.hypot(b % C - cx, Math.floor(b / C) - cy);
      return da - db || a - b;
    });

    // Разделить N между слоями пропорционально ёмкости
    const wants = [cap.ground];
    let w = cap.ground;
    for (let z = 1; z < L; z++) { w *= LAYER_RATIO; wants.push(Math.min(caps[z - 1], Math.round(w))); }
    const totalWant = wants.reduce((a, b) => a + b, 0);
    const scale = Math.min(1, N / totalWant);
    const upper = wants.slice(1).map(v => Math.floor(v * scale));
    const ground = Math.min(C * R, N - upper.reduce((a, b) => a + b, 0));

    const chosen = new Uint8Array(C * R);
    order.slice(0, ground).forEach(i => { chosen[i] = 1; });
    const positions = [];
    for (let i = 0; i < chosen.length; i++) {
      if (chosen[i]) positions.push({ x: i % C, y: Math.floor(i / C), z: 0 });
    }

    // Верхние слои — «хребет» штрихов: самые глубокие клетки под ними
    let below = chosen;
    for (let z = 1; z < L; z++) {
      const want = upper[z - 1];
      if (!want) break;
      const depth = depthMap(below, C, R);
      const cand = [];
      for (let i = 0; i < below.length; i++) if (below[i] && depth[i] >= 2) cand.push(i);
      cand.sort((a, b) => depth[b] - depth[a] || cov[b] - cov[a] || a - b);
      const next = new Uint8Array(C * R);
      cand.slice(0, want).forEach(i => { next[i] = 1; positions.push({ x: i % C, y: Math.floor(i / C), z }); });
      below = next;
    }

    // Верхним слоям не хватило клеток — добираем основание по рангу
    for (const i of order) {
      if (positions.length >= N) break;
      if (!chosen[i]) { chosen[i] = 1; positions.push({ x: i % C, y: Math.floor(i / C), z: 0 }); }
    }

    // Верность: насколько выбранное основание совпадает с чернилами символа
    let diff = 0;
    for (let i = 0; i < cov.length; i++) diff += Math.abs(cov[i] - (chosen[i] ? 1 : 0));
    const fidelity = 1 - diff / cov.length;

    return { positions, cols: C, rows: R, fidelity };
  }

  // ---------- Курируемые символы и «Иероглиф дня» ----------
  function curated() {
    return typeof GlyphData !== 'undefined' ? GlyphData : null;
  }

  function fromChar(ch) {
    const gd = curated();
    const g = gd && gd.list[ch];
    return g ? { text: ch, w: g.w, h: g.h, bits: g.bits } : null;
  }

  function dailyGlyph(seed) {
    const gd = curated();
    if (!gd || !gd.order.length) return null;
    const ch = gd.order[(Math.floor(Number(seed)) >>> 0) % gd.order.length];
    return fromChar(ch);
  }

  // ---------- Браузер: произвольный текст → битмап ----------
  // Ждёт загрузки шрифта, рисует до трёх символов, обрезает поля
  // и ужимает до SIZE по высоте. Возвращает Promise<glyph|null>.
  const FONT_STACK = '"Noto Sans CJK SC Black","Noto Sans SC","Noto Sans CJK SC",' +
    '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Segoe UI",Arial,sans-serif';

  function rasterize(text) {
    if (typeof document === 'undefined') return Promise.resolve(null);
    const chars = Array.from(String(text || '').replace(/\s+/g, '')).slice(0, MAX_CHARS);
    if (!chars.length) return Promise.resolve(null);
    const font = '900 240px ' + FONT_STACK;
    const ready = document.fonts && document.fonts.load
      ? document.fonts.load(font, chars.join('')).catch(() => null)
      : Promise.resolve();
    return ready.then(() => {
      // Одна строка с естественными интервалами шрифта (а не по ячейке
      // на букву — узкие «A», «I» разъезжались бы широкими зазорами)
      const PX = 320;
      const cv = document.createElement('canvas');
      const probe = cv.getContext('2d');
      probe.font = font;
      const textW = Math.ceil(probe.measureText(chars.join('')).width);
      cv.width = textW + 80;
      cv.height = Math.round(PX * 1.3);
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#000';
      cx.font = font;
      cx.textAlign = 'center';
      cx.textBaseline = 'alphabetic';
      cx.fillText(chars.join(''), cv.width / 2, PX);
      const data = cx.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
      for (let y = 0; y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          if (data[(y * cv.width + x) * 4 + 3] > 127) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      const sc = Math.min(SIZE / bh, SIZE * chars.length / bw);
      const w = Math.max(1, Math.round(bw * sc));
      const h = Math.max(1, Math.round(bh * sc));
      const t = document.createElement('canvas');
      t.width = w;
      t.height = h;
      const tx = t.getContext('2d', { willReadFrequently: true });
      tx.imageSmoothingQuality = 'high';
      tx.drawImage(cv, x0, y0, bw, bh, 0, 0, w, h);
      const td = tx.getImageData(0, 0, w, h).data;
      const px = new Uint8Array(w * h);
      for (let i = 0; i < px.length; i++) px[i] = td[i * 4 + 3] > 127 ? 1 : 0;
      return { text: chars.join(''), w, h, bits: encode(px, w, h) };
    });
  }

  return {
    SIZE, MAX_CHARS, THRESHOLDS,
    decode, encode, coverage, layoutFromGlyph,
    fromChar, dailyGlyph, rasterize,
  };
})();
