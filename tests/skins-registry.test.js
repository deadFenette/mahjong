/* ============================================================
   TESTS/SKINS-REGISTRY.TEST.JS — Реестр скинов (v44)

   Что гарантирует: новый скин добавляется одним файлом + двумя строками,
   а забыть подключение или сломать контракт не получится — тест упадёт.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assertOk, assertEq } = require('./runner');
const { loadGameModules, skinFiles } = require('./load');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { Tileset } = loadGameModules();

// «Чистый» реестр в песочнице: проверяем регистрацию, не трогая настоящие скины
function freshRegistry(extra) {
  const ctx = vm.createContext({ console: { error() {} }, localStorage: { getItem: () => null } });
  vm.runInContext(read('js/tileset-core.js') + '\n' + read('js/tileset.js') + '\n' + (extra || '') +
    ';globalThis.__T = Tileset;', ctx);
  freshRegistry.ctx = ctx;
  return ctx.__T;
}

const okFace = "face: (s, r) => TilesetCore.svg('<text>' + s + r + '</text>')";

suite('Реестр: регистрация', () => {
  test('скин из одной функции face() собирается в 144 валидные фишки', () => {
    const T = freshRegistry("Tileset.register({ id: 'neon', name: 'Неон', desc: 'd', order: 5, " + okFace + " });");
    assertEq(T.SKINS.map(s => s.id).join(), 'neon');
    assertEq(T.get('neon').tiles.length, 144);
    assertEq(T.validate('neon').length, 0, T.validate('neon').join('; '));
  });

  test('порядок в списке — по order, при равенстве — по порядку регистрации', () => {
    const T = freshRegistry(
      "Tileset.register({ id: 'b', name: 'B', order: 20, " + okFace + " });" +
      "Tileset.register({ id: 'a', name: 'A', order: 10, " + okFace + " });" +
      "Tileset.register({ id: 'c', name: 'C', order: 20, " + okFace + " });");
    assertEq(T.SKINS.map(s => s.id).join(), 'a,b,c');
  });

  test('неверный id, дубликат, пустое имя и отсутствие face/create отвергаются', () => {
    const T = freshRegistry("Tileset.register({ id: 'ok', name: 'Ok', " + okFace + " });");
    const bad = [
      { id: 'Bad Id', name: 'x', face() {} },
      { id: 'ok', name: 'dup', face() {} },
      { id: 'noname', face() {} },
      { id: 'nofn', name: 'x' },
      null,
    ];
    bad.forEach(def => {
      let threw = false;
      try { T.register(def); } catch (e) { threw = true; }
      assertOk(threw, 'должен отвергнуть ' + JSON.stringify(def && def.id));
    });
    assertEq(T.SKINS.length, 1);
  });

  test('набор строится лениво: create() не вызывается до первого обращения и ровно один раз', () => {
    const T = freshRegistry("globalThis.__calls = 0; Tileset.register({ id: 'lazy', name: 'L', create() { globalThis.__calls++; return TilesetCore.build(() => TilesetCore.svg('')); } });");
    const calls = () => freshRegistry.ctx.__calls;
    assertEq(calls(), 0, 'при регистрации набор не строится');
    T.get('lazy'); T.get('lazy'); T.sampleFaces('lazy'); T.validate('lazy');
    assertEq(calls(), 1, 'после нескольких обращений — одна сборка (кэш)');
  });

  test('сломанный скин не роняет игру: пропадает из списка, активным становится скин по умолчанию', () => {
    const T = freshRegistry(
      "Tileset.register({ id: 'classic', name: 'C', order: 1, " + okFace + " });" +
      "Tileset.register({ id: 'boom', name: 'Boom', order: 2, create() { throw new Error('oops'); } });");
    assertEq(T.get('boom'), null);
    assertOk(!T.SKINS.some(s => s.id === 'boom'), 'сломанный скин убран из списка');
    assertEq(T.activeSkinId(), 'classic');
    assertEq(T.tiles.length, 144);
  });

  test('validate находит типичные ошибки автора скина', () => {
    const T = freshRegistry("Tileset.register({ id: 'few', name: 'F', create() { const s = TilesetCore.build(() => TilesetCore.svg('')); s.tiles = s.tiles.slice(0, 100); return s; } });" +
      "Tileset.register({ id: 'evil', name: 'E', face: () => TilesetCore.svg('<script>alert(1)</script>') });");
    assertOk(T.validate('few').some(p => /144/.test(p)));
    assertOk(T.validate('evil').some(p => /скрипт/.test(p)));
    assertOk(T.validate('nope').length > 0);
  });
});

suite('Реестр: настоящие скины', () => {
  const ids = Tileset.SKINS.map(s => s.id);

  test('все скины из js/skins/ зарегистрированы, id совпадает с именем файла', () => {
    const files = skinFiles().map(f => path.basename(f, '.js'));
    assertEq(files.slice().sort().join(), ids.slice().sort().join());
  });

  test('каждый скин проходит validate() без замечаний', () => {
    ids.forEach(id => assertEq(Tileset.validate(id).length, 0, id + ': ' + Tileset.validate(id).join('; ')));
  });

  test('у каждого скина есть название и подпись для карточки', () => {
    Tileset.SKINS.forEach(s => assertOk(s.name && s.desc, s.id));
  });

  test('скин по умолчанию — classic', () => {
    assertEq(Tileset.defaultSkinId(), 'classic');
  });
});

suite('Реестр: подключение (нельзя забыть строки)', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const files = skinFiles();

  test('каждый js/skins/<id>.js есть в index.html ПОСЛЕ реестра и в sw.js', () => {
    const iReg = html.indexOf('js/tileset.js');
    assertOk(iReg > 0);
    files.forEach(f => {
      assertOk(html.indexOf(f) > iReg, f + ': нет в index.html после js/tileset.js');
      assertOk(sw.includes('./' + f), f + ': нет в sw.js (офлайн-кэш)');
    });
  });

  test('в index.html и sw.js нет подключённых скинов, которых нет на диске', () => {
    [...html.matchAll(/src="(js\/skins\/[^"]+)"/g), ...sw.matchAll(/'\.\/(js\/skins\/[^']+)'/g)]
      .forEach(m => assertOk(fs.existsSync(path.join(ROOT, m[1])), m[1] + ' подключён, но файла нет'));
  });

  test('в коде нет зашитых списков скинов: ни switch по id, ни карточек в разметке, ни имён в UI-коде', () => {
    assertOk(!/case 'ornate'|case 'pictures'|case 'clear'/.test(read('js/tileset.js')), 'switch по id в реестре');
    assertOk(!/data-skin="/.test(html), 'карточки скинов не должны быть в index.html');
    // названия и id скинов живут ТОЛЬКО в js/skins/*.js
    const names = Tileset.SKINS.flatMap(sk => [sk.name, "'" + sk.id + "'"]).filter(n => n !== "'classic'");
    ['js/app/skins.js', 'js/app/settings.js', 'js/app/init.js', 'js/app/preview.js', 'js/tileset.js'].forEach(f => {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      names.forEach(n => assertOk(!code.includes(n), f + ' содержит зашитое «' + n + '»'));
    });
  });

  test('карточки строятся из реестра (js/app/skins.js) и подключены в index/sw', () => {
    assertOk(read('js/app/skins.js').includes('Tileset.SKINS.forEach'));
    assertOk(html.includes('js/app/skins.js') && sw.includes('./js/app/skins.js'));
    assertOk(html.indexOf('js/app/skins.js') < html.indexOf('js/app/init.js'), 'skins.js до init.js');
  });

  test('шаблон _template.js и README лежат рядом и не подключены', () => {
    assertOk(fs.existsSync(path.join(ROOT, 'js/skins/_template.js')));
    assertOk(fs.existsSync(path.join(ROOT, 'js/skins/README.md')));
    assertOk(!html.includes('_template') && !sw.includes('_template'));
  });
});
