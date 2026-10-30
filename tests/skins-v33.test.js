/* ============================================================
   TESTS/SKINS-V33.TEST.JS — новые скины «Картинки» и «Контраст» (v33)
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assertOk, assertEq, assertLte } = require('./runner');
const { loadGameModules } = require('./load');

const ROOT = path.join(__dirname, '..');
const { TilesetClassic, TilesetPictures, TilesetClear } = loadGameModules();

// Тот же набор файлов, что в index.html, но с заданным скином в localStorage
function loadWithSkin(skin) {
  const store = new Map();
  if (skin) store.set('mj_setting_tileSkin', skin);
  const ctx = vm.createContext({
    console, Math, JSON, Set, Map,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); },
    },
  });
  let src = '';
  for (const f of ['js/tileset-core.js', 'js/tileset.js', ...require('./load').skinFiles()]) {
    src += fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n';
  }
  vm.runInContext(src + ';globalThis.__T = Tileset;', ctx);
  return ctx.__T;
}

const SKINS = { pictures: TilesetPictures, clear: TilesetClear };

for (const [id, set] of Object.entries(SKINS)) {
  suite(`Скин «${id}» — состав и SVG`, () => {

    test('144 фишки, состав как у классического (масть/ранг)', () => {
      assertEq(set.tiles.length, 144);
      const sig = ts => ts.map(t => `${t.suit}/${t.rank}`).sort().join('|');
      assertEq(sig(set.tiles), sig(TilesetClassic.tiles));
    });

    test('id фишек уникальны', () => {
      assertEq(new Set(set.tiles.map(t => t.id)).size, 144);
    });

    test('лица — валидный <svg> без мусора', () => {
      for (const t of set.tiles) {
        assertOk(t.face.startsWith('<svg') && t.face.endsWith('</svg>'), `id=${t.id}: не svg`);
        assertOk(t.face.includes('viewBox="0 0 100 120"'), `id=${t.id}: viewBox`);
        assertOk(t.face.includes('class="tile-face-svg"'), `id=${t.id}: класс`);
        for (const bad of ['undefined', 'NaN', '[object']) {
          assertOk(!t.face.includes(bad), `id=${t.id}: содержит ${bad}`);
        }
      }
    });

    test('каждый url(#x) имеет парный id="x"; <use> не используется', () => {
      for (const t of set.tiles) {
        const ids = new Set([...t.face.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
        for (const m of t.face.matchAll(/url\(#([^)]+)\)/g)) {
          assertOk(ids.has(m[1]), `id=${t.id}: url(#${m[1]}) без определения`);
        }
        assertOk(!t.face.includes('<use'), `id=${t.id}: <use> ломается при удалении фишки`);
      }
    });

    test('<text> везде с font-family', () => {
      for (const t of set.tiles) {
        if (t.face.includes('<text')) assertOk(t.face.includes('font-family'), `id=${t.id}`);
      }
    });

    test('лёгкие: лицо < 4 КБ, без фильтров и градиентов', () => {
      for (const t of set.tiles) {
        assertLte(t.face.length, 4000, `id=${t.id}: лицо тяжелее 4 КБ`);
        for (const bad of ['<filter', 'Gradient', '<image', 'foreignObject']) {
          assertOk(!t.face.includes(bad), `id=${t.id}: ${bad}`);
        }
      }
    });

    test('все 34 «обычных» вида фишек выглядят по-разному', () => {
      const seen = new Map();
      for (const t of set.tiles) {
        if (t.suit === 'flowers' || t.suit === 'seasons') continue;
        const k = `${t.suit}/${t.rank}`;
        if (!seen.has(k)) seen.set(k, t.face);
      }
      assertEq(seen.size, 34);
      assertEq(new Set(seen.values()).size, 34, 'два разных вида фишек нарисованы одинаково');
    });

    test('цветы и сезоны различаются между группами', () => {
      const f = set.tiles.find(t => t.suit === 'flowers').face;
      const s = set.tiles.find(t => t.suit === 'seasons').face;
      assertOk(f !== s, 'цветы и сезоны не должны выглядеть одинаково');
    });
  });
}

suite('Скин «Контраст» — различим без цвета', () => {

  test('только чёрное и белое: никаких других цветов в лицах', () => {
    const allowed = new Set(['#111', '#fff']);
    for (const t of TilesetClear.tiles) {
      for (const m of t.face.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) {
        assertOk(allowed.has(m[0].toLowerCase()), `id=${t.id}: цвет ${m[0]}`);
      }
      assertOk(!/rgb|hsl/i.test(t.face), `id=${t.id}: rgb/hsl`);
    }
  });

  test('цифра фишки читается из лица: 1–9 в каждой из трёх мастей', () => {
    for (const suit of ['dots', 'bamboo', 'characters']) {
      for (let n = 1; n <= 9; n++) {
        const t = TilesetClear.tiles.find(x => x.suit === suit && x.rank === n);
        assertOk(new RegExp('>' + n + '</text>').test(t.face), `${suit} ${n}: нет цифры`);
      }
    }
  });

  test('у 6 и 9 есть подчёркивание, у остальных цифр — нет', () => {
    for (let n = 1; n <= 9; n++) {
      const t = TilesetClear.tiles.find(x => x.suit === 'dots' && x.rank === n);
      const has = t.face.includes('stroke-width="4" fill="none"');
      assertEq(has, n === 6 || n === 9, `цифра ${n}`);
    }
  });

  test('масти различаются формой рамки (круг / стебель / квадрат)', () => {
    const f = s => TilesetClear.tiles.find(t => t.suit === s && t.rank === 5).face;
    assertOk(f('dots').includes('<circle cx="50" cy="60" r="43"'));
    assertOk(f('bamboo').includes('rx="24"'));
    assertOk(f('characters').includes('width="78" height="78"'));
  });

  test('ветры: у каждой стороны света свой указатель и своя буква', () => {
    const faces = ['E', 'S', 'W', 'N'].map(c => TilesetClear.tiles.find(t => t.suit === 'winds' && t.rank === c).face);
    assertEq(new Set(faces).size, 4);
    ['В', 'Ю', 'З', 'С'].forEach((ch, i) => assertOk(faces[i].includes('>' + ch + '</text>'), 'нет буквы ' + ch));
  });

  test('драконы: чёрный / штриховка / пустой', () => {
    const d = c => TilesetClear.tiles.find(t => t.suit === 'dragons' && t.rank === c).face;
    assertOk(d('R').includes('fill="#111"'));
    assertOk(d('G').includes('url(#hatch)'));
    assertOk(d('W').includes('stroke-width="2"'), 'у белого дракона — двойная рамка');
    assertOk(!d('W').includes('<path d="M50 8L92 34L92 86L50 112L8 86L8 34Z" fill="#111"'), 'белый не должен быть залит');
  });

  test('все 4 цветка выглядят одинаково (и все 4 сезона тоже)', () => {
    const fl = TilesetClear.tiles.filter(t => t.suit === 'flowers').map(t => t.face);
    const se = TilesetClear.tiles.filter(t => t.suit === 'seasons').map(t => t.face);
    assertEq(new Set(fl).size, 1);
    assertEq(new Set(se).size, 1);
  });
});

suite('Скин «Картинки» — знакомые картинки', () => {

  test('4 цветка и 4 сезона нарисованы по-разному', () => {
    const fl = TilesetPictures.tiles.filter(t => t.suit === 'flowers').map(t => t.face);
    const se = TilesetPictures.tiles.filter(t => t.suit === 'seasons').map(t => t.face);
    assertEq(new Set(fl).size, 4);
    assertEq(new Set(se).size, 4);
  });

  test('без текста и иероглифов: только рисунок', () => {
    for (const t of TilesetPictures.tiles) assertOk(!t.face.includes('<text'), `id=${t.id}`);
  });

  test('у бонусных фишек есть звезда и цветное кольцо группы', () => {
    const f = TilesetPictures.tiles.find(t => t.suit === 'flowers').face;
    const s = TilesetPictures.tiles.find(t => t.suit === 'seasons').face;
    assertOk(f.includes('#d6336c') && s.includes('#2c7be5'));
    assertOk(f.includes('#f7c600') && s.includes('#f7c600'), 'нет звезды');
  });
});

suite('Фасад Tileset — четыре скина', () => {

  test('SKINS содержит все четыре', () => {
    const T = loadWithSkin(null);
    assertEq(T.SKINS.map(s => s.id).join(','), 'classic,ornate,pictures,clear');
  });

  for (const id of ['classic', 'ornate', 'pictures', 'clear']) {
    test(`localStorage tileSkin=${id} → активен ${id} и отдаёт 144 фишки`, () => {
      const T = loadWithSkin(id);
      assertEq(T.activeSkinId(), id);
      assertEq(T.tiles.length, 144);
    });
  }

  test('неизвестный скин → classic', () => {
    assertEq(loadWithSkin('nope').activeSkinId(), 'classic');
  });

  test('pictures и clear действительно отдают свои лица', () => {
    assertOk(loadWithSkin('pictures').tiles[0].face.includes('#d9322b'), 'яблоко');
    assertOk(loadWithSkin('clear').tiles[0].face.includes('class="ct"'), 'крупная цифра');
  });

  test('sampleFaces: три образца у каждого скина', () => {
    const T = loadWithSkin(null);
    for (const s of T.SKINS) assertEq(T.sampleFaces(s.id).length, 3, s.id);
  });

  test('isMatch одинаков во всех скинах (цветок↔цветок, сезон↔сезон)', () => {
    for (const id of ['pictures', 'clear']) {
      const T = loadWithSkin(id);
      const fl = T.tiles.filter(t => t.suit === 'flowers');
      const se = T.tiles.filter(t => t.suit === 'seasons');
      assertOk(T.isMatch(fl[0], fl[3]) && T.isMatch(se[1], se[2]));
      assertOk(!T.isMatch(fl[0], se[0]));
    }
  });
});

suite('Разметка и подключение скинов', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  test('в настройках пустой контейнер #skin-picker: карточки строит js/app/skins.js из реестра', () => {
    assertOk(/<div class="skin-picker" id="skin-picker"><\/div>/.test(html));
    assertEq((html.match(/class="skin-card/g) || []).length, 0, 'в HTML не должно быть зашитых карточек');
  });

  test('скрипты подключены в правильном порядке (core → реестр → скины)', () => {
    const at = f => html.indexOf(`js/${f}.js`);
    assertOk(at('tileset-core') > 0 && at('tileset-core') < at('tileset'));
    assertOk(at('tileset') > 0 && at('tileset') < at('skins/classic'), 'реестр до скинов');
    assertOk(at('skins/pictures') > at('skins/ornate') && at('skins/clear') > at('skins/pictures'));
  });

  test('service worker кэширует реестр и скины', () => {
    for (const f of ['tileset-core', 'tileset', 'skins/pictures', 'skins/clear']) assertOk(sw.includes(`./js/${f}.js`), f);
  });
});
