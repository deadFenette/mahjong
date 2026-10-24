/* ============================================================
   APP/SAVES.JS — Сохранение и продолжение текущей партии (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Сохранение/загрузка текущей игры ----------
  function saveCurrentGame() {
    const state = Game.getState();
    if (!state) return;
    // v21-saveopt: face (SVG-строка) НЕ пишется в сейв — на раскладке
    // Крест (202 фишки × длинный SVG) это упиралось в лимит localStorage
    // ~5 МБ. face восстанавливается из Tileset по suit/rank при загрузке.
    const tilesData = state.tiles.map(t => ({
      id: t.id, suit: t.suit, rank: t.rank, name: t.name,
      x: t.x, y: t.y, z: t.z, removed: t.removed,
    }));
    const elapsedMs = Game.getElapsedMs();
    Storage.saveGame({
      layoutId: state.layout.id,
      tiles: tilesData,
      score: state.score,
      pairsFound: state.pairsFound,
      totalPairs: state.totalPairs,
      hintsUsed: state.hintsUsed,
      shufflesUsed: state.shufflesUsed,
      // v9: честные часы (пауза не считается) + история отмены.
      // startTime оставляем для отката на версии до v9.
      startTime: Date.now() - elapsedMs,
      elapsedMs,
      history: Game.serializeHistory(state.history, state.tiles),
      mode: state.mode,
      endlessLevel: state.endlessLevel || 0,
      // v31: сгенерированную раскладку не храним целиком — храним параметры,
      // генератор детерминирован и пересоздаст ту же доску
      mixSpec: state.layout.mixSpec || null,
    });
  }

  function continueSaved() {
    const saved = Storage.loadGame();
    if (!saved) return;
    let layout = Layouts.getById(saved.layoutId);
    if (!layout && saved.mixSpec) layout = MixGen.generate(saved.mixSpec); // v31
    if (!layout) { Storage.clearGame(); return; }

    // Создаём чистое состояние — оно станет запасным вариантом,
    // если сохранение повреждено или устарело (изменились раскладки)
    Game.newGame(layout);
    let state = Game.getState();

    // Валидация сохранения: число фишек должно совпадать с раскладкой
    const savedOk = Array.isArray(saved.tiles) &&
      saved.tiles.length === layout.tilesCount;

    if (savedOk) {
      state.tiles = saved.tiles.map(t => ({ ...t }));
      // v21-saveopt: восстанавливаем face из Tileset по suit/rank
      // (раньше face писался в сейв и занимал ~80% места)
      Game.restoreFaces(state.tiles);
      state.board = {};
      state.tiles.forEach(t => { state.board[Game.key(t.x, t.y, t.z)] = t; });
      state.score = saved.score || 0;
      state.pairsFound = saved.pairsFound || 0;
      state.totalPairs = saved.totalPairs || Math.floor(state.tiles.length / 2);
      state.hintsUsed = saved.hintsUsed || 0;
      state.shufflesUsed = saved.shufflesUsed || 0;
      state.mode = saved.mode || 'classic';
      state.endlessLevel = saved.endlessLevel || 0;

      // v9: время и история отмены переживают закрытие игры.
      // Восстанавливаем ТОЛЬКО при валидном сейве: при устаревшем
      // сейве партия начинается с нуля — и часы с историей тоже.
      // Легаси-сейвы (до v9) не имели elapsedMs — считаем из startTime.
      const savedElapsed = Number(saved.elapsedMs);
      const legacyMs = (!Number.isFinite(savedElapsed) && saved.startTime)
        ? Math.max(0, Date.now() - saved.startTime) : 0;
      Game.setElapsedMs(Number.isFinite(savedElapsed) && savedElapsed > 0
        ? savedElapsed : legacyMs);
      Game.restoreHistory(saved.history);
    } else {
      // Сохранение не совпадает с раскладкой — начинаем заново,
      // вместо сломанной доски
      Storage.clearGame();
      A.toast('Сохранение устарело — начинаем заново');
    }

    state.selected = null;
    state.history = state.history || []; // уже восстановлена, если сейв валиден
    Game.resume(); // часы пошли заново (или с восстановленного места)

    // v13: сейв мог быть сохранён в тупике (см. ensureMovesAvailable) —
    // после восстановления сразу гарантируем наличие ходов
    A.ensureMovesAvailable();

    Render.fitBoard(layout);
    Render.renderFull();
    A.resetLoupe(); // v34: лупа начинает с чистого листа
    Render.playDealAnimation(); // v8: каскадная раздача при продолжении
    Audio2.deal(); // v26: каскад мягких стуков
    Render.highlightFree(Storage.getSetting('highlight', true));
    A.updateGameInfo();
    A.showScreen('game');
    A.startTimer();
    A.state.lastActionTime = Date.now();
    A.scheduleAutohint();
  }

  Object.assign(A, {
    continueSaved,
    saveCurrentGame,
  });
})(App);
