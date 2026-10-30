/* ============================================================
   TESTS/MIXGEN40.TEST.JS — Генератор v40: иероглифы, симметрии,
   жёсткость, лучший из 8 (честные измерения, не только «не падает»)
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules } = require('./load');

const { MixGen, MixMetrics, MixGlyph, GlyphData, Layouts } = loadGameModules();
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const hash = ps => {
  let h = 2166136261;
  for (const p of ps) for (const v of [p.x * 2, p.y * 2, p.z]) { h ^= Math.round(v) + 7; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16);
};
const corr = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
};

// Эталоны: хэши досок, построенных генератором v39 (до best-of-8).
// Спецификации без ver обязаны воспроизводить именно их.
const GOLDEN = [{"spec": {"seed": 12345, "method": "scratch", "tiles": 96, "layers": 3, "symmetry": "mirror", "stagger": false}, "tiles": 96, "hash": "dc74d578"}, {"spec": {"seed": 777, "method": "scratch", "tiles": 60, "layers": 2, "symmetry": "quad", "stagger": true}, "tiles": 60, "hash": "8afc4705"}, {"spec": {"seed": 4242, "method": "blend", "tiles": 120, "layers": 3, "symmetry": "none", "stagger": false}, "tiles": 120, "hash": "adca57b6"}, {"spec": {"seed": 99, "method": "surprise", "tiles": 150, "layers": 4, "symmetry": "mirror", "stagger": false}, "tiles": 150, "hash": "d483ef15"}, {"spec": {"seed": 31337, "method": "scratch", "tiles": 44, "layers": 1, "symmetry": "none", "stagger": false}, "tiles": 44, "hash": "f0c4cba3"}];

suite('v40: старые сохранения (legacy)', () => {
  test('спецификация без ver воспроизводит доски v39 бит-в-бит', () => {
    for (const g of GOLDEN) {
      const l = MixGen.generate(Object.assign({}, g.spec, { legacy: true }));
      assertEq(l.tilesCount, g.tiles, 'число фишек ' + JSON.stringify(g.spec));
      assertEq(hash(l.positions), g.hash, 'доска изменилась: ' + JSON.stringify(g.spec));
      assertOk(!l.mixSpec.ver, 'legacy-спецификация не должна получать ver');
    }
  });

  test('новая спецификация помечена ver и пересоздаётся той же доской по pick', () => {
    for (const method of ['scratch', 'blend', 'glyph']) {
      const a = MixGen.generate({ seed: 4242, method, tiles: 100, layers: 2, symmetry: 'quad', hardness: 5 });
      assertEq(a.mixSpec.ver, MixGen.VERSION);
      assertOk(a.mixSpec.pick >= 0, 'pick не записан');
      const b = MixGen.generate(a.mixSpec);
      assertEq(hash(b.positions), hash(a.positions), method + ': доска из сохранённой спецификации другая');
    }
  });

  test('спецификацию можно сохранить как JSON (с битмапом знака) и восстановить', () => {
    const a = MixGen.generate({ seed: 55, method: 'glyph', tiles: 120, layers: 2, glyph: MixGlyph.fromChar('王') });
    const b = MixGen.generate(JSON.parse(JSON.stringify(a.mixSpec)));
    assertEq(hash(b.positions), hash(a.positions));
  });
});

suite('v40: быстрая симуляция', () => {
  const slowFree = (spots, spot) => {
    if (spots.some(o => o !== spot && o.z === spot.z + 1 && Math.abs(o.x - spot.x) < 0.75 && Math.abs(o.y - spot.y) < 0.75)) return false;
    let l = false, r = false;
    for (const o of spots) {
      if (o === spot || o.z !== spot.z || Math.abs(o.y - spot.y) > 0.75) continue;
      const dx = o.x - spot.x;
      if (dx < -0.25 && dx > -1.75) l = true; else if (dx > 0.25 && dx < 1.75) r = true;
    }
    return !(l && r);
  };

  test('индексная проверка «свободна ли фишка» совпадает с игровым правилом', () => {
    const boards = Layouts.all.slice(0, 10).map(L => L.positions)
      .concat([MixGen.generate({ seed: 3, method: 'scratch', stagger: true, layers: 4, tiles: 90 }).positions]);
    for (const ps of boards) {
      const g = MixMetrics.buildGrid(ps);
      const alive = new Uint8Array(ps.length).fill(1);
      const rng = MixGen.makeRng(9);
      let rest = ps.map((_, i) => i);
      for (let step = 0; step < 25 && rest.length > 2; step++) {
        const sub = rest.map(i => ps[i]);
        rest.forEach(i => assertEq(MixMetrics.isFree(g, ps, alive, i), slowFree(sub, ps[i]), 'расхождение правил'));
        const k = Math.floor(rng() * rest.length);
        alive[rest[k]] = 0;
        rest.splice(k, 1);
      }
    }
  });
});

suite('v40: жёсткость', () => {
  const built = Layouts.all.map(L => ({ n: L.tilesCount, m: MixMetrics.measure(L.positions, 7) }));

  test('жёсткость НЕ зависит от размера доски (|корреляция с числом фишек| < 0.45)', () => {
    const r = corr(built.map(b => b.n), built.map(b => b.m.hardness));
    assertOk(Math.abs(r) < 0.45, 'корреляция с размером: ' + r.toFixed(2));
  });

  test('шкала различает готовые раскладки: разброс ≥ 4 пунктов, медиана 3…6', () => {
    const h = built.map(b => b.m.hardness).sort((a, b) => a - b);
    assertOk(h[h.length - 1] - h[0] >= 4, 'разброс ' + (h[h.length - 1] - h[0]).toFixed(1));
    const med = h[Math.floor(h.length / 2)];
    assertOk(med >= 3 && med <= 6, 'медиана ' + med);
  });

  test('измерение детерминировано', () => {
    const ps = Layouts.all[3].positions;
    assertEq(MixMetrics.measure(ps, 11).hardness, MixMetrics.measure(ps, 11).hardness);
  });

  test('слайдер жёсткости работает: цель 2 даёт заметно более лёгкие доски, чем цель 8', () => {
    const run = target => mean(Array.from({ length: 10 }, (_, i) =>
      MixGen.generate({ seed: 9000 + i * 53, method: 'scratch', tiles: [72, 100, 130][i % 3], layers: 1 + (i % 4), symmetry: 'mirror', hardness: target }).hardness));
    const easy = run(2);
    const hard = run(8);
    assertOk(hard - easy >= 2.5, 'разница лёгкой и жёсткой: ' + (hard - easy).toFixed(1));
  });

  test('измеренная жёсткость и красота записаны в раскладку', () => {
    const l = MixGen.generate({ seed: 5, method: 'scratch', tiles: 80 });
    assertOk(l.hardness >= 1 && l.hardness <= 10, 'hardness ' + l.hardness);
    assertOk(l.beauty > 0 && l.beauty <= 1, 'beauty ' + l.beauty);
  });
});

suite('v40: лучший из 8 (красота)', () => {
  test('выбранный кандидат в среднем красивее первого', () => {
    const first = [], best = [];
    for (let i = 0; i < 24; i++) {
      const o = { seed: 7000 + i * 31, method: 'scratch', symmetry: ['none', 'mirror', 'quad', 'point'][i % 4], tiles: [60, 96, 140][i % 3], layers: 1 + (i % 4) };
      const sc = l => MixMetrics.beauty(l.positions, o.symmetry, l.width, l.height).score;
      best.push(sc(MixGen.generate(o)));
      first.push(sc(MixGen.generate(Object.assign({}, o, { pick: 0 }))));
    }
    assertOk(mean(best) > mean(first) + 0.02, `best ${mean(best).toFixed(3)} vs first ${mean(first).toFixed(3)}`);
  });
});

suite('v40: новые симметрии', () => {
  const symOf = (l, sym) => MixMetrics.beauty(l.positions, sym, l.width, l.height).parts.symScore;

  test('«поворот» и «мандала» — допустимые значения и проходят проверку правил', () => {
    assertOk(MixGen.SYMMETRIES.includes('point') && MixGen.SYMMETRIES.includes('diag'));
    assertEq(MixGen.SYMMETRIES.slice(0, 3).join(), 'none,mirror,quad', 'индексы 0..2 использует Daily');
    for (const symmetry of ['point', 'diag']) {
      for (const [tiles, layers, stagger] of [[48, 1, false], [96, 3, false], [96, 3, true], [160, 4, false]]) {
        const l = MixGen.generate({ seed: tiles * 7 + layers, method: 'scratch', symmetry, tiles, layers, stagger });
        assertEq(MixGen.validate(l).length, 0, symmetry + ' ' + tiles + ': ' + MixGen.validate(l).join('; '));
        assertEq(l.tilesCount, tiles);
      }
    }
  });

  test('«мандала» строится на квадратной сетке', () => {
    for (let i = 0; i < 6; i++) {
      const l = MixGen.generate({ seed: 100 + i, method: 'scratch', symmetry: 'diag', tiles: 80 + i * 10, layers: 2 });
      assertEq(l.width, l.height, 'сетка не квадратная ' + l.width + '×' + l.height);
    }
  });

  test('симметрия соблюдается: в среднем ≥ 97% фишек имеют двойников', () => {
    for (const sym of ['mirror', 'quad', 'point', 'diag']) {
      const s = mean(Array.from({ length: 12 }, (_, i) =>
        symOf(MixGen.generate({ seed: 3000 + i * 17, method: 'scratch', symmetry: sym, tiles: [48, 72, 96, 128][i % 4], layers: 1 + (i % 3) }), sym)));
      assertOk(s >= 0.97, sym + ': ' + s.toFixed(3));
    }
  });
});

suite('v40: раскладка-иероглиф', () => {
  test('битмап: кодирование и разбор взаимно обратны', () => {
    const px = new Uint8Array(7 * 5).map((_, i) => (i * 7 % 3 === 0 ? 1 : 0));
    const g = { w: 7, h: 5, bits: MixGlyph.encode(px, 7, 5) };
    const d = MixGlyph.decode(g);
    assertEq(Array.from(d.px).join(''), Array.from(px).join(''));
  });

  test('повреждённый и пустой битмап отклоняются', () => {
    assertEq(MixGlyph.decode({ w: 4, h: 4, bits: '0000' }), null, 'пустой');
    assertEq(MixGlyph.decode({ w: 4, h: 4, bits: 'zz' }), null, 'короткий');
    assertEq(MixGlyph.decode({ w: 4, h: 4, bits: 'xxxx' }), null, 'не hex');
    assertEq(MixGlyph.decode(null), null);
  });

  test('все курируемые знаки: ровно N фишек, правила соблюдены, разбираются', () => {
    for (const ch of GlyphData.order) {
      for (const [tiles, layers] of [[120, 1], [120, 3], [200, 2]]) {
        const l = MixGen.generate({ seed: 1, method: 'glyph', tiles, layers, glyph: MixGlyph.fromChar(ch) });
        assertEq(l.tilesCount, tiles, ch + ' ' + tiles);
        assertEq(MixGen.validate(l).length, 0, ch + ': ' + MixGen.validate(l).join('; '));
        assertOk(MixMetrics.dismantlable(l.positions, MixGen.makeRng(2)), ch + ' неразбираем');
        assertEq(l.mixSpec.method, 'glyph', ch + ': способ подменился');
      }
    }
  });

  test('знаки узнаваемы: сетка воспроизводит ≥ 78% чернил на 120 фишках', () => {
    for (const ch of GlyphData.order) {
      const r = MixGlyph.layoutFromGlyph(MixGlyph.fromChar(ch), 120, 1, 0);
      assertOk(r.fidelity >= 0.78, ch + ': верность ' + r.fidelity.toFixed(2));
    }
  });

  test('«Иероглиф дня» детерминирован и обходит все знаки по кругу', () => {
    assertEq(MixGlyph.dailyGlyph(20000).text, MixGlyph.dailyGlyph(20000).text);
    const seen = new Set();
    for (let d = 0; d < GlyphData.order.length; d++) seen.add(MixGlyph.dailyGlyph(20000 + d).text);
    assertEq(seen.size, GlyphData.order.length);
  });

  test('данные знаков целы: все битмапы разбираются и не пусты', () => {
    for (const ch of GlyphData.order) assertOk(MixGlyph.decode(GlyphData.list[ch]), 'битмап ' + ch);
  });

  test('без знака глиф-способ не падает: берётся знак дня', () => {
    const l = MixGen.generate({ seed: 77, method: 'glyph', tiles: 100, layers: 1 });
    assertEq(l.tilesCount, 100);
    assertOk(l.mixSpec.glyph && l.mixSpec.glyph.bits, 'знак не записан в спецификацию');
  });
});

suite('v40: подключение', () => {
  test('index.html: порядок скриптов data → metrics → glyph → mixgen', () => {
    const html = read('index.html');
    const idx = f => html.indexOf('<script src="js/' + f + '">');
    assertOk(idx('glyph-data.js') > 0 && idx('glyph-data.js') < idx('mixmetrics.js'));
    assertOk(idx('mixmetrics.js') < idx('mixglyph.js') && idx('mixglyph.js') < idx('mixgen.js'));
  });

  test('sw.js кэширует новые файлы', () => {
    const sw = read('sw.js');
    for (const f of ['glyph-data.js', 'mixmetrics.js', 'mixglyph.js']) assertOk(sw.includes('./js/' + f), f);
  });

  test('Daily: «Иероглиф дня» подключён, сохранения старого образца идут через legacy', () => {
    const app = require('./sources').appSource();
    assertOk(/method: 'glyph'/.test(app) && /MixGlyph\.dailyGlyph/.test(app), 'нет Иероглифа дня');
    assertOk(/legacy: true/.test(app), 'нет legacy-ветки в восстановлении');
  });

  test('экран Микс: слайдер жёсткости, ввод знака, 5 симметрий', () => {
    const html = read('index.html');
    for (const id of ['mix-hardness', 'mix-glyph-text', 'mix-glyph-chips', 'mix-hardness-fact']) assertOk(html.includes('id="' + id + '"'), id);
    for (const s of ['none', 'mirror', 'quad', 'point', 'diag']) assertOk(html.includes('data-mix-sym="' + s + '"'), s);
    assertOk(html.includes('data-mix-method="glyph"'));
  });
});
