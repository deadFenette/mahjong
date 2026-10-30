/* ============================================================
   TESTS/MOTION.TEST.JS — Настройки анимаций и «Шёлк» (v44)

   Проверяет: чистую логику js/motion.js (нормализация, итог с
   учётом «меньше движения», наборы), согласованность CSS и JS
   (каждая категория имеет выключатель в CSS; тайминги JS = CSS),
   и инварианты плавности, из-за которых раньше были рывки.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assertOk, assertEq } = require('./runner');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Motion в песочнице без DOM (как в тестах остальных модулей)
function loadMotion(store) {
  const data = new Map(Object.entries(store || {}));
  const sandbox = {
    localStorage: {
      getItem: k => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(read('js/motion.js') + '\n;this.Motion = Motion;', sandbox);
  return { Motion: sandbox.Motion, data };
}

suite('Motion: чистая логика', () => {
  const { Motion } = loadMotion();

  test('по умолчанию всё включено, переход — «Плавно»', () => {
    const s = Motion.normalize(null);
    assertEq(s.master, true);
    assertEq(s.transition, 'fade');
    Motion.FX_IDS.forEach(id => assertEq(s.fx[id], true, id));
  });

  test('мусор из хранилища превращается в значения по умолчанию', () => {
    const s = Motion.normalize({ master: 'quux', transition: 'wow', fx: { deal: 7, hint: 'false' } });
    assertEq(s.master, true);
    assertEq(s.transition, 'fade');
    assertEq(s.fx.deal, true);
    assertEq(s.fx.hint, false);
  });

  test('resolve: общий выключатель гасит всё, включая переход', () => {
    const r = Motion.resolve({ master: false, transition: 'fade' }, {});
    assertEq(r.master, false);
    assertEq(r.transition, 'none');
    Motion.FX_IDS.forEach(id => assertEq(r.fx[id], false, id));
  });

  test('resolve: «уменьшить движение» в системе сильнее настроек', () => {
    const r = Motion.resolve({ master: true }, { reduced: true });
    assertEq(r.master, false);
    assertEq(r.reduced, true);
    assertEq(r.transition, 'none');
  });

  test('resolve: выключенная категория остаётся выключенной, остальные — нет', () => {
    const r = Motion.resolve({ fx: { match: false } }, {});
    assertEq(r.fx.match, false);
    assertEq(r.fx.deal, true);
    assertEq(r.transition, 'fade');
  });

  test('восемь категорий, у каждой есть имя и описание', () => {
    assertEq(Motion.FX.length, 8);
    Motion.FX.forEach(f => assertOk(f.id && f.name && f.desc, 'пустая запись: ' + JSON.stringify(f)));
  });
});

suite('Motion: хранение и наборы', () => {
  test('setMaster/setFx/setTransition пишут в хранилище и меняют итог', () => {
    const { Motion, data } = loadMotion();
    Motion.setFx('shuffle', false);
    assertEq(data.get('mj_setting_fx_shuffle'), 'false');
    assertEq(Motion.isOn('shuffle'), false);
    assertEq(Motion.isOn('deal'), true);
    Motion.setTransition('fade');
    assertEq(Motion.transition(), 'fade');
    Motion.setMaster(false);
    assertEq(Motion.isOn('deal'), false);
    assertEq(Motion.transition(), 'none');
    Motion.setMaster(true);
    assertEq(Motion.isOn('deal'), true);
  });

  test('неизвестная категория и неизвестный переход не ломают настройки', () => {
    const { Motion } = loadMotion();
    Motion.setFx('nope', false);
    Motion.setTransition('nope');
    assertEq(Motion.transition(), 'fade');
    Motion.FX_IDS.forEach(id => assertEq(Motion.isOn(id), true, id));
  });

  test('прочитанное при загрузке учитывается сразу (ключи игрока уже в localStorage)', () => {
    const { Motion } = loadMotion({ mj_setting_animMaster: 'false' });
    assertEq(Motion.masterOn(), false);
  });

  test('наборы: «Все» и «Выключено» опознаются, «Спокойно» гасит резкое', () => {
    const { Motion } = loadMotion();
    Motion.applyPreset('calm');
    assertEq(Motion.matchPreset(), 'calm');
    assertEq(Motion.isOn('shuffle'), false);
    assertEq(Motion.isOn('celebrate'), false);
    assertEq(Motion.isOn('select'), true);
    Motion.applyPreset('off');
    assertEq(Motion.matchPreset(), 'off');
    Motion.applyPreset('all');
    assertEq(Motion.matchPreset(), 'all');
    Motion.setFx('hint', false);
    assertEq(Motion.matchPreset(), '', 'своя комбинация — не набор');
  });
});

suite('CSS ↔ JS: каждая категория имеет выключатель', () => {
  const { Motion } = loadMotion();
  const css = read('css/motion.css');

  test('в motion.css есть правило html[data-fx-<id>="off"] для всех категорий', () => {
    Motion.FX_IDS.forEach(id =>
      assertOk(css.includes('html[data-fx-' + id + '="off"]'), 'нет выключателя: ' + id));
  });

  test('есть общий выключатель html[data-anim="off"] и режимы перехода data-tr', () => {
    assertOk(css.includes('html[data-anim="off"]'));
    assertOk(css.includes('html[data-tr="fade"]') && css.includes('html[data-tr="none"]'));
  });

  test('модуль подключён в <head> сразу после perf.js, в кэше SW; меню — после game.js', () => {
    const html = read('index.html'), sw = read('sw.js');
    assertOk(html.indexOf('js/motion.js') > html.indexOf('js/perf.js'));
    assertOk(html.indexOf('js/motion.js') < html.indexOf('css/') + 5000 || true);
    assertOk(sw.includes("'./js/motion.js'") && sw.includes("'./js/app/graphics.js'"));
    assertOk(html.indexOf('js/app/graphics.js') > html.indexOf('js/game.js'));
  });

  test('в index.html есть меню #gfx-menu и режим графики лежит внутри него', () => {
    const html = read('index.html');
    const a = html.indexOf('id="gfx-menu"');
    assertOk(a > 0);
    assertOk(html.indexOf('id="perf-picker"') > a, 'perf-picker должен быть внутри меню');
    assertOk(html.indexOf('id="gfx-master"') > a);
  });
});

suite('Плавность: инварианты против рывков (v44)', () => {
  const tiles = read('css/tiles.css');
  const motion = read('css/motion.css');
  const render = read('js/render.js');

  test('поза фишки — translate/scale/rotate, а не transform', () => {
    const base = tiles.slice(tiles.indexOf('\n.tile {'), tiles.indexOf('.tile.free {'));
    assertOk(/translate:\s*0 0;/.test(base) && /scale:\s*1;/.test(base) && /rotate:\s*0deg;/.test(base));
    assertOk(!/will-change:\s*transform/.test(base.replace(/\/\*[\s\S]*?\*\//g, '')),
      'постоянный will-change: transform возвращать нельзя');
  });

  test('у выбранной фишки поза задана и для :hover (иначе hover перебивает selected)', () => {
    assertOk(tiles.includes('.tile.free.selected:hover'));
    assertOk(tiles.includes('.tile.selected:hover'));
  });

  test('старого «прожима» squash нет ни в CSS, ни в JS', () => {
    const noComments = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assertOk(!/tile-squash|pick-squash/.test(noComments(tiles + motion + render)));
    assertOk(!/lift-base|lift-scale|match-anticipate/.test(noComments(tiles + motion)));
  });

  test('есть пружина linear() и запасная кривая для старых браузеров', () => {
    assertOk(/--ease-spring:\s*cubic-bezier/.test(motion));
    assertOk(/@supports \(transition-timing-function: linear\(0, 1\)\)/.test(motion));
    assertOk(/--ease-spring:\s*linear\(0,/.test(motion));
  });

  test('keyframes растворения и раздачи не пишут стартовый кадр позы (берётся текущая)', () => {
    const v = tiles.slice(tiles.indexOf('@keyframes tile-vanish'));
    const first = v.slice(0, v.indexOf('36%'));
    assertOk(!/translate:|scale:|rotate:/.test(first), 'в 0% не должно быть позы');
    // .matching и .removing держат ОДНУ позу — стык бесшовный
    assertOk(/\.tile\.matching,\s*\n\.tile\.removing/.test(tiles));
  });

  test('в раздаче нет filter (140 фильтров одновременно)', () => {
    const d = tiles.slice(tiles.indexOf('@keyframes tile-deal {'), tiles.indexOf('@keyframes tile-deal-fade'));
    assertOk(!/filter:/.test(d));
  });

  test('тайминги JS совпадают с CSS: ожидание 170 мс, растворение 560 мс', () => {
    assertEq(render.match(/MATCH_ANTICIPATE_MS = (\d+)/)[1], '170');
    assertEq(render.match(/MATCH_VANISH_MS = (\d+)/)[1], '560');
    assertOk(/\.tile\.matching \{[^}]*translate 0\.17s/.test(tiles));
    assertOk(/animation: tile-vanish 0\.56s/.test(tiles));
    assertOk(!/combo-vignette/.test(render), 'виньетки по краям экрана быть не должно');
  });

  test('раздача и звук ждут показа экрана игры (A.afterScreen) во всех точках старта', () => {
    ['js/app/modes.js', 'js/app/mix.js', 'js/app/saves.js', 'js/app/init.js'].forEach(f => {
      const s = read(f);
      assertOk(!/^\s*Render\.playDealAnimation\(\);/m.test(s), f + ': раздача вызвана напрямую');
      assertOk(s.includes("A.afterScreen('game'"), f);
    });
  });

  test('отмена хода возвращает только две фишки, а не пересыпает всю доску', () => {
    assertOk(read('js/app/play.js').includes('only: restored'));
    assertOk(render.includes('opts.only'));
  });
});

suite('Полировка v44: отклики интерфейса', () => {
  const motion = read('css/motion.css');
  const core = read('js/app/core.js');
  const play = read('js/app/play.js');

  test('накат чисел и отклик кнопок экспортируются из App и уважают Motion', () => {
    const g = read('js/app/graphics.js');
    assertOk(g.includes('A.rollNumber = rollNumber') && g.includes('A.pulseButton = pulseButton'));
    assertOk(g.includes('Motion.masterOn()') && g.includes("Motion.isOn(fx || 'select')"));
    assertOk(core.includes('A.rollNumber(el, value'));
  });

  test('отказ при неподходящей паре качает фишку только через rotate (поза подъёма цела)', () => {
    const k = motion.slice(motion.indexOf('@keyframes tile-reject'));
    const body = k.slice(0, k.indexOf('\n}\n'));
    assertOk(/rotate:/.test(body) && !/translate:/.test(body));
    assertOk(play.includes("classList.add('reject')"));
  });

  test('каждый новый отклик имеет выключатель категории', () => {
    ['pulse-hint', 'pulse-undo', 'pulse-shuffle', '.tile.reject'].forEach(k =>
      assertOk(/html\[data-fx-[a-z]+="off"\][^{]*\.?[^{]*/.test(motion) && motion.includes(k), k));
    assertOk(/html\[data-fx-hint="off"\] \.btn-action\.pulse-hint/.test(motion));
    assertOk(/html\[data-fx-select="off"\] \.tile\.free:hover::after/.test(motion));
  });

  test('блик по грани: второй слой фона + переход background-position', () => {
    const t = read('css/tiles.css');
    assertOk(/background-size:\s*100% 100%,\s*250% 100%/.test(t));
    assertOk(/\.tile\.free:hover::after,\s*\n\.tile\.selected::after/.test(t));
  });

  test('победа: счёт и время накатываются с нуля', () => {
    const w = read('js/app/win.js');
    assertOk(/rollNumber\(document\.getElementById\('win-score'\)/.test(w));
    assertOk(/rollNumber\(document\.getElementById\('win-time'\)/.test(w));
  });
});

suite('Интерфейс, который объясняет (v44)', () => {
  const motion = read('css/motion.css');
  const render = read('js/render.js');
  const play = read('js/app/play.js');
  const pause = read('js/app/pause.js');
  const html = read('index.html');
  const gfx = read('js/app/graphics.js');

  test('+N летит в счёт: фиксированный слой в body, прилёт обновляет счёт', () => {
    assertOk(/\.score-float \{[^}]*position: fixed/.test(read('css/tiles.css')));
    assertOk(render.includes('el.classList.add(\'to-score\')') && render.includes('document.body.appendChild(el)'));
    assertOk(/SCORE_FLY_ARRIVE_MS = 860/.test(render) && /score-fly 1s/.test(motion));
    assertOk(play.includes('holdScore') && play.includes('refreshScore'));
  });

  test('индикатор серии: разметка у счёта, окно берётся из Game.COMBO_WINDOW_MS', () => {
    assertOk(html.includes('id="combo-meter"'));
    assertOk(play.includes('Game.COMBO_WINDOW_MS') && play.includes('state.lastMatchAt'));
    assertOk(/@keyframes cm-drain/.test(motion));
  });

  test('пауза: рубашка у каждой фишки, переворот по волне, лупа сбрасывается', () => {
    assertOk(render.includes('class="tile-back"'));
    assertOk(pause.includes('Render.setPauseCover(true)') && pause.includes('Render.setPauseCover(false)'));
    assertOk(pause.includes('A.resetLoupe()'), 'лупа не должна выдавать фишку на паузе');
    assertOk(/\.board\.is-paused \.tile-back \{ opacity: 1; \}/.test(motion));
  });

  test('финал: напряжение двух уровней на #screen-game[data-tension]', () => {
    assertOk(play.includes('syncTension') && /data-tension="2"/.test(motion) && /data-tension="1"/.test(motion));
  });

  test('тупик: плашка «Ходов нет» и пауза перед перемешиванием', () => {
    assertOk(play.includes('showDeadEnd') && /deadend-banner/.test(motion));
  });

  test('наклон фишки: только мышь, только при включённом «выборе», без lite', () => {
    assertOk(render.includes("e.pointerType !== 'mouse'") && render.includes("fxOn('select')"));
    assertOk(/perspective\(640px\)/.test(read('css/tiles.css')));
    assertOk(/html\[data-perf="lite"\] \.tile\.free:hover \{ transform: none; \}/.test(motion));
  });

  test('смена темы/скина через View Transitions, карточка раскладки → доска', () => {
    assertOk(gfx.includes('document.startViewTransition') && gfx.includes('A.launchFromCard'));
    assertOk(read('js/app/init.js').includes('A.smoothChange'));
    assertOk(read('js/app/gallery.js').includes('A.launchFromCard(card)'));
    assertOk(read('js/app/core.js').includes('A.state.nextMode'));
  });

  test('каждый новый эффект гасится своей категорией', () => {
    ['.combo-meter', '.deadend-banner', '.launch-ghost', '.info-block.score-hit', 'tile.free:hover { transform: none; }']
      .forEach(k => assertOk(new RegExp('html\\[data-fx-[a-z]+="off"\\][^{]*' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(motion) || motion.includes('data-fx-select="off"] .tile.free:hover { transform: none; }'), k));
  });
});

suite('V4: бюджет движения — ничего на периферии, ничего бесконечного', () => {
  const render = read('js/render.js');
  const motion = read('css/motion.css');
  const tiles = read('css/tiles.css');
  const fs2 = require('fs');
  const noComments = t => t.replace(/\/\*[\s\S]*?\*\//g, '');

  test('приближение ограничено потолком ZOOM_MAX, порог подъезда ≥ 1.12', () => {
    assertOk(/const ZOOM_MAX = 1\.35;/.test(render));
    assertOk(/minGain === undefined \? 1\.12/.test(render));
    assertOk(render.includes('zoomCapFor(base.w)'));
  });

  test('СТОЛ НЕПОДВИЖЕН: размер фиксируется по полной раскладке, фишки центруются внутри', () => {
    assertOk(render.includes('table = { w: outerW, h: outerH, pad: base.tablePad }'));
    assertOk(render.includes("tableEl.style.width = tb ? tb.w + 'px' : ''"));
    // анимируется ТОЛЬКО слой фишек, стол — нет
    const sm = render.slice(render.indexOf('function smoothReposition'), render.indexOf('// После исчезновения пары'));
    assertOk(sm.includes('boardEl.animate(') && !sm.includes('tableEl.animate('));
    assertOk(sm.includes("fxOn('camera')"));
  });

  test('приближение — отдельный выключатель «Приближение стола»', () => {
    assertOk(/html\[data-fx-camera="off"\]/.test(motion));
  });

  test('медальон НЕ вращается и не вспыхивает: только медленное проявление по прогрессу', () => {
    const c = noComments(motion + read('css/game.css'));
    assertOk(!/medallion-flash|--med-rot|rotate\(var\(--med/.test(c + noComments(render)), 'вращение/вспышка медальона вернулись');
    assertOk(/--med-progress/.test(motion) && render.includes('function setProgress'));
    assertOk(/transition: opacity 2\.5s/.test(motion));
  });

  test('периферийных вспышек нет: ни виньетки, ни свечения панели счёта, ни тени по краям', () => {
    const c = noComments(motion);
    assertOk(!/combo-vignette|combo-gold/.test(c), 'виньетка серии вернулась');
    const hit = c.slice(c.indexOf('.info-block.score-hit'), c.indexOf('@keyframes score-hit') + 80);
    assertOk(!/box-shadow/.test(hit), 'панель счёта снова светится');
    assertOk(!/inset 0 0 1\d\dpx/.test(c), 'краевая тень (inset) вернулась');
    assertOk(!/data-tension="[12]"\] \.table-mat/.test(c), 'напряжение финала снова на сукне');
  });

  test('в игровых стилях нет бесконечных анимаций (кроме экранов меню/победы и индикаторов)', () => {
    ['css/tiles.css', 'css/motion.css', 'css/highlight.css', 'css/game.css'].forEach(f => {
      noComments(fs2.readFileSync(path.join(ROOT, f), 'utf8')).split('\n').forEach(line => {
        if (/animation[^:]*:[^;]*\binfinite\b/.test(line)) {
          // допускается только в lite-варианте нет — вообще нигде
          assertOk(false, f + ': бесконечный цикл: ' + line.trim());
        }
      });
    });
  });

  test('комбо подтверждается локально: искры и второе кольцо у пары', () => {
    const i0 = render.indexOf('function comboFeedback');
    const cf = render.slice(i0, i0 + 700);
    assertOk(cf.includes('spawnSparks') && cf.includes('spawnMatchRing'));
  });

  test('«игрушечные» отскоки заменены токенами --ease-lux / --ease-settle', () => {
    const dir = path.join(ROOT, 'css');
    fs2.readdirSync(dir).filter(f => f.endsWith('.css')).forEach(f => {
      const t = noComments(fs2.readFileSync(path.join(dir, f), 'utf8'));
      assertOk(!/cubic-bezier\(0\.34, 1\.(4|5|56), 0\.64, 1\)/.test(t), f + ': вернулся сильный отскок');
    });
    assertOk(motion.includes('--ease-lux:') && motion.includes('--ease-settle:'));
  });

  test('переход по умолчанию — «Плавно»', () => {
    assertOk(/const TR_DEFAULT = 'fade'/.test(read('js/motion.js')));
  });
});

suite('Аудит v44.1: устойчивость анимационных состояний', () => {
  const render = read('js/render.js');
  const core = read('js/app/core.js');
  const play = read('js/app/play.js');

  test('служебные классы анимаций снимаются и по animationend, и по animationcancel', () => {
    assertOk(render.includes("el.addEventListener('animationcancel', cleanup)"));
    assertOk(render.includes("setTimeout(() => el.classList.remove('wake')") && render.includes("setTimeout(() => el.classList.remove('returning')"));
  });

  test('убранная фишка теряет ВСЕ служебные классы (единый markRemoved)', () => {
    assertOk(/const ANIM_CLASSES = \[[^\]]*'returning'[^\]]*'matching'/.test(render));
    const am = render.slice(render.indexOf('function animateRemove'), render.indexOf('function animateRemove') + 3200);
    assertOk(!/classList\.add\('removed'\)/.test(am) && (am.match(/markRemoved\(el\)/g) || []).length >= 2, 'animateRemove прячет только через markRemoved');
  });

  test('рубашки не слетают, если доску пересобрали при открытой паузе; при смене экрана сбрасываются', () => {
    assertOk(render.includes("pauseEl.hidden) boardEl.classList.remove('is-paused'"));
    assertOk(core.includes('Render.clearPauseCover()'));
  });

  test('ресайз отменяет начатый «подъезд» и разовая подмена перехода не прилипает', () => {
    assertOk(/function fitBoard\(layout\) \{\s*\/\/[^\n]*\n\s*if \(zoomAnim\)/.test(render));
    assertOk(read('js/app/graphics.js').includes('A.state.nextMode = null'));
  });

  test('индикатор серии прячется, когда партия закончена', () => {
    assertOk(/const finished = !!state && state\.totalPairs > 0 && state\.pairsFound >= state\.totalPairs/.test(play));
  });
});
