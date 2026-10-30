/* ============================================================
   APP/MIX.JS — Экран «Микс» — генератор раскладки и запуск партии на ней (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Режим «Микс» (v31: генератор) ----------
  // Экран с превью: игрок выбирает способ, число фишек и параметры формы —
  // генератор (MixGen) строит ОДНУ новую раскладку. Превью — это в точности
  // та доска, на которой начнётся игра (раскладка детерминирована от seed).
  let mixLayout = null;   // сгенерированная раскладка, показанная в превью
  let mixTimer = null;    // debounce перегенерации при движении слайдера

  function loadMixOpts() {
    let saved = null;
    try { saved = JSON.parse(Storage.getSetting('mixOpts', 'null')); } catch (e) { saved = null; }
    const o = MixGen.normalize(saved || MixGen.DEFAULTS);
    o.seed = MixGen.randomSeed();
    return reconcileMixOpts(o);
  }

  // v45: сращивание на гигантах дорожает квадратично — там строят «с нуля»
  function reconcileMixOpts(o) {
    if (o.bigboard && o.method === 'blend') o.method = 'surprise';
    return o;
  }

  function persistMixOpts() {
    const o = Object.assign({}, A.state.mixOpts);
    delete o.seed;
    Storage.setSetting('mixOpts', JSON.stringify(o));
  }

  function mixTilesHint(n) {
    const minutes = Math.max(1, Math.round(n / 2 * 6 / 60));
    let kind = 'Короткая партия';
    if (n > 152) kind = 'Марафон';
    else if (n > 104) kind = 'Долгая партия';
    else if (n > 56) kind = 'Средняя партия';
    return kind + ', около ' + minutes + ' мин';
  }

  function setRangeFill(slider) {
    const min = Number(slider.min);
    const max = Number(slider.max);
    slider.style.setProperty('--range-fill', ((slider.value - min) / (max - min) * 100) + '%');
  }

  // Привести элементы экрана в соответствие с параметрами
  function syncMixControls() {
    document.querySelectorAll('#mix-methods [data-mix-method]').forEach(b =>
      b.classList.toggle('active', b.dataset.mixMethod === A.state.mixOpts.method));
    document.querySelectorAll('#mix-symmetry [data-mix-sym]').forEach(b =>
      b.classList.toggle('active', b.dataset.mixSym === A.state.mixOpts.symmetry));
    const tiles = document.getElementById('mix-tiles');
    const layers = document.getElementById('mix-layers');
    // v45: кап фишек зависит от галки «Гигантские доски»
    const big = !!A.state.mixOpts.bigboard;
    tiles.max = String(big ? MixGen.MAX_TILES_BIG : MixGen.MAX_TILES);
    document.getElementById('mix-bigboard').checked = big;
    document.getElementById('mix-cap-panel').hidden = !big;
    // Сращивание на гигантах стоит секунды — гасим карточку способа
    document.querySelector('#mix-methods [data-mix-method="blend"]')
      .classList.toggle('is-off', big);
    tiles.value = String(A.state.mixOpts.tiles);
    layers.value = String(A.state.mixOpts.layers);
    document.getElementById('mix-tiles-out').textContent = A.state.mixOpts.tiles;
    document.getElementById('mix-layers-out').textContent = A.state.mixOpts.layers;
    document.getElementById('mix-tiles-hint').textContent = mixTilesHint(A.state.mixOpts.tiles);
    document.getElementById('mix-stagger').checked = !!A.state.mixOpts.stagger;
    setRangeFill(tiles);
    setRangeFill(layers);
    // «Из двух раскладок» не использует слои/симметрию — гасим эти настройки;
    // «Иероглиф» использует слои (хребет штрихов), но не симметрию/пирамиду
    const method = A.state.mixOpts.method;
    document.getElementById('mix-scratch-opts').classList.toggle('is-off', method === 'blend');
    ['mix-sym-block', 'mix-stagger-row'].forEach(id =>
      document.getElementById(id).classList.toggle('is-off', method === 'glyph'));
    // Жёсткость направляет форму «С нуля» и выбор пары в «Из двух»;
    // у иероглифа форма задана знаком — слайдер не работает
    document.getElementById('mix-hardness-group').classList.toggle('is-off', method === 'glyph');
    const hard = A.state.mixOpts.hardness || 0;
    const hs = document.getElementById('mix-hardness');
    hs.value = String(hard);
    setRangeFill(hs);
    document.getElementById('mix-hardness-out').textContent = hard ? hard + '/10' : 'Любая';
    document.getElementById('mix-hardness-hint').textContent = !hard ? 'Любая — как получится'
      : (hard >= 8 ? 'Подбирается из 8 вариантов; для максимума может включить «слои пирамидой»'
        : 'Подбирается из 8 вариантов; если форма не позволяет — ближайший');
    document.getElementById('mix-glyph-opts').hidden = method !== 'glyph';
    const text = A.state.mixOpts.glyph ? A.state.mixOpts.glyph.text : '';
    const input = document.getElementById('mix-glyph-text');
    if (document.activeElement !== input) input.value = text;
    document.querySelectorAll('#mix-glyph-chips [data-glyph]').forEach(b =>
      b.classList.toggle('active', b.dataset.glyph === text));
  }

  // Пересоздать раскладку и перерисовать превью
  function regenerateMix(animate) {
    mixLayout = MixGen.generate(A.state.mixOpts);
    const preview = document.getElementById('mix-preview');
    preview.classList.remove('is-fresh', 'is-stale');
    A.drawLayoutPreview(preview, mixLayout, 16);
    if (animate) {
      void preview.offsetWidth; // перезапуск анимации появления фишек
      preview.classList.add('is-fresh');
    }
    document.getElementById('mix-name').textContent = mixLayout.name;
    document.getElementById('mix-desc').textContent = mixLayout.description;
    document.getElementById('mix-facts').textContent =
      mixLayout.tilesCount + ' фишек · ' + mixLayout.layers + ' ' +
      (mixLayout.layers === 1 ? 'слой' : (mixLayout.layers < 5 ? 'слоя' : 'слоёв')) +
      ' · ' + mixLayout.width + '×' + mixLayout.height;
    // v40: измеренная жёсткость — по пробным разборкам, не по размеру
    const hEl = document.getElementById('mix-hardness-fact');
    if (hEl) {
      hEl.textContent = mixLayout.hardness
        ? 'Жёсткость ' + Math.round(mixLayout.hardness) + '/10' : '';
      hEl.title = 'Измерено пробными разборками: чем меньше свободных фишек для такой массы и чем чаще случайная игра заходит в тупик, тем выше. 4 — типичная готовая раскладка.';
    }
  }

  // ---------- Знак для режима «Иероглиф» ----------
  function setGlyph(g) {
    if (!g) return false;
    A.state.mixOpts.glyph = { text: g.text, w: g.w, h: g.h, bits: g.bits };
    persistMixOpts();
    return true;
  }

  function randomCurated(excludeText) {
    const order = (typeof GlyphData !== 'undefined' ? GlyphData.order : []).filter(c => c !== excludeText);
    if (!order.length) return null;
    return MixGlyph.fromChar(order[Math.floor(Math.random() * order.length)]);
  }

  // Свой текст: готовый символ берём из данных (одинаков у всех),
  // остальное рисуем на canvas один раз — битмап уходит в спецификацию
  function applyGlyphText(raw) {
    const text = Array.from(raw.replace(/\s+/g, '')).slice(0, 3).join('');
    const hint = document.getElementById('mix-glyph-hint');
    if (!text) return;
    const ready = Array.from(text).length === 1 ? MixGlyph.fromChar(text) : null;
    const done = g => {
      if (!g) {
        hint.textContent = 'Не удалось нарисовать этот знак — попробуйте другой';
        return;
      }
      hint.textContent = 'До трёх символов: иероглиф, буквы, инициалы. Сложные знаки лучше от 120 фишек';
      setGlyph(g); syncMixControls(); regenerateMix(true);
    };
    if (ready) done(ready); else MixGlyph.rasterize(text).then(done);
  }

  function buildGlyphChips() {
    const box = document.getElementById('mix-glyph-chips');
    if (!box || typeof GlyphData === 'undefined') return;
    GlyphData.order.forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mix-glyph-chip';
      b.dataset.glyph = ch;
      b.textContent = ch;
      b.addEventListener('click', () => { setGlyph(MixGlyph.fromChar(ch)); syncMixControls(); regenerateMix(true); });
      box.appendChild(b);
    });
  }

  function scheduleMixRegen() {
    clearTimeout(mixTimer);
    // v45 (фикс бага «превью издалека»): старая доска гаснет СРАЗУ при
    // движении слайдера. Раньше плотная старая доска висела на экране,
    // пока debounce + генератор готовили новую — на малых числах фишек
    // это читалось как «на секунду картинка как бы издалека».
    document.getElementById('mix-preview').classList.add('is-stale');
    mixTimer = setTimeout(() => {
      // кадр на отрисовку затухания: generate() блокирует поток
      requestAnimationFrame(() => regenerateMix(false));
    }, 140);
  }

  function openMixScreen() {
    if (!A.state.mixOpts) A.state.mixOpts = loadMixOpts();
    A.state.mixOpts.seed = MixGen.randomSeed(); // каждое открытие — новый узор
    syncMixControls();
    A.showScreen('mix');
    // Превью меряет размеры контейнера — ждём, пока экран реально покажется
    requestAnimationFrame(() => regenerateMix(true));
  }

  function initMixScreen() {
    A.state.mixOpts = loadMixOpts();
    document.querySelectorAll('#mix-methods [data-mix-method]').forEach(b =>
      b.addEventListener('click', () => {
        A.state.mixOpts.method = b.dataset.mixMethod;
        if (A.state.mixOpts.method === 'glyph') {
          if (!A.state.mixOpts.glyph) setGlyph(randomCurated());
          // на 96 фишках сложные знаки расплываются — поднимаем размер до 120
          if (A.state.mixOpts.tiles < 120) A.state.mixOpts.tiles = 120;
        }
        persistMixOpts(); syncMixControls(); regenerateMix(true);
      }));
    document.querySelectorAll('#mix-symmetry [data-mix-sym]').forEach(b =>
      b.addEventListener('click', () => {
        A.state.mixOpts.symmetry = b.dataset.mixSym;
        persistMixOpts(); syncMixControls(); regenerateMix(true);
      }));
    document.getElementById('mix-tiles').addEventListener('input', e => {
      // v45: нормализуем С флагом гиганта — иначе галка 600 режется до 200
      A.state.mixOpts.tiles = MixGen.normalize({
        tiles: e.target.value,
        bigboard: !!A.state.mixOpts.bigboard,
      }).tiles;
      persistMixOpts(); syncMixControls(); scheduleMixRegen();
    });
    document.getElementById('mix-layers').addEventListener('input', e => {
      A.state.mixOpts.layers = Number(e.target.value);
      persistMixOpts(); syncMixControls(); scheduleMixRegen();
    });
    document.getElementById('mix-stagger').addEventListener('change', e => {
      A.state.mixOpts.stagger = e.target.checked;
      persistMixOpts(); regenerateMix(true);
    });
    // v45: галка «Гигантские доски» — кап 200 → 600
    document.getElementById('mix-bigboard').addEventListener('change', e => {
      A.state.mixOpts.bigboard = e.target.checked;
      reconcileMixOpts(A.state.mixOpts);
      if (!e.target.checked && A.state.mixOpts.tiles > MixGen.MAX_TILES) {
        A.state.mixOpts.tiles = MixGen.MAX_TILES; // слезаем с гиганта мягко
      }
      persistMixOpts(); syncMixControls(); regenerateMix(true);
      if (e.target.checked) {
        // расширяем слайдер — подводим его к глазам
        const sl = document.getElementById('mix-tiles');
        const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        sl.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' });
      }
    });
    document.getElementById('mix-hardness').addEventListener('input', e => {
      A.state.mixOpts.hardness = Number(e.target.value);
      persistMixOpts(); syncMixControls(); scheduleMixRegen();
    });
    let glyphTimer = null;
    document.getElementById('mix-glyph-text').addEventListener('input', e => {
      clearTimeout(glyphTimer);
      const v = e.target.value;
      glyphTimer = setTimeout(() => applyGlyphText(v), 300);
    });
    buildGlyphChips();
    document.getElementById('mix-reroll').addEventListener('click', () => {
      // «Другой узор» у иероглифа — другой знак (сам по себе seed форму почти не меняет)
      const cur = A.state.mixOpts.glyph;
      if (A.state.mixOpts.method === 'glyph' && (!cur || (cur.text.length === 1 && MixGlyph.fromChar(cur.text)))) {
        setGlyph(randomCurated(cur && cur.text)); syncMixControls();
      }
      A.state.mixOpts.seed = MixGen.randomSeed();
      regenerateMix(true);
    });
    document.getElementById('mix-play').addEventListener('click', () => {
      if (!mixLayout) regenerateMix(false);
      startMix(mixLayout);
    });
    document.getElementById('back-mix').addEventListener('click', () => A.showScreen('menu'));
  }

  function startMix(layout) {
    if (!layout) return;
    const seed = Math.floor(Math.random() * 0x100000000) >>> 0;
    Game.newGame(layout, seed);
    const state = Game.getState();
    state.mode = 'mix';
    Render.fitBoard(layout);
    Render.renderFull();
    A.resetLoupe(); // v34: лупа начинает с чистого листа
    // v44: раздача и звук — когда экран игры реально показан (после шторки)
    A.afterScreen('game', () => { Render.playDealAnimation(); Audio2.deal(); });
    Render.highlightFree(Storage.getSetting('highlight', true));
    A.updateGameInfo();
    A.showScreen('game');
    A.startTimer();
    A.state.lastActionTime = Date.now();
    A.scheduleAutohint();
    A.saveCurrentGame();
    setTimeout(() => A.toast('«' + layout.name + '» — ' + layout.tilesCount + ' фишек'), 600);
  }

  Object.assign(A, {
    initMixScreen,
    loadMixOpts,
    openMixScreen,
    startMix,
  });
})(App);
