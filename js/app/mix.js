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
    tiles.value = String(A.state.mixOpts.tiles);
    layers.value = String(A.state.mixOpts.layers);
    document.getElementById('mix-tiles-out').textContent = A.state.mixOpts.tiles;
    document.getElementById('mix-layers-out').textContent = A.state.mixOpts.layers;
    document.getElementById('mix-tiles-hint').textContent = mixTilesHint(A.state.mixOpts.tiles);
    document.getElementById('mix-stagger').checked = !!A.state.mixOpts.stagger;
    setRangeFill(tiles);
    setRangeFill(layers);
    // «Из двух раскладок» не использует слои/симметрию — гасим эти настройки
    document.getElementById('mix-scratch-opts')
      .classList.toggle('is-off', A.state.mixOpts.method === 'blend');
  }

  // Пересоздать раскладку и перерисовать превью
  function regenerateMix(animate) {
    mixLayout = MixGen.generate(A.state.mixOpts);
    const preview = document.getElementById('mix-preview');
    preview.classList.remove('is-fresh');
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
  }

  function scheduleMixRegen() {
    clearTimeout(mixTimer);
    mixTimer = setTimeout(() => regenerateMix(false), 140);
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
        persistMixOpts(); syncMixControls(); regenerateMix(true);
      }));
    document.querySelectorAll('#mix-symmetry [data-mix-sym]').forEach(b =>
      b.addEventListener('click', () => {
        A.state.mixOpts.symmetry = b.dataset.mixSym;
        persistMixOpts(); syncMixControls(); regenerateMix(true);
      }));
    document.getElementById('mix-tiles').addEventListener('input', e => {
      A.state.mixOpts.tiles = MixGen.normalize({ tiles: e.target.value }).tiles;
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
    document.getElementById('mix-reroll').addEventListener('click', () => {
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
    Render.playDealAnimation();
    Audio2.deal(); // v26: каскад мягких стуков
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
