/* ============================================================
   APP/MODES.JS — Запуск игр: классическая, бесконечная, ежедневная (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Запуск классической игры ----------
  function startClassic(layoutId) {
    const layout = Layouts.getById(layoutId);
    if (!layout) return;
    Game.newGame(layout);
    Render.fitBoard(layout);
    Render.renderFull();
    A.resetLoupe(); // v34: лупа начинает с чистого листа
    Render.playDealAnimation(); // v8: каскадная раздача
    Audio2.deal(); // v26: каскад мягких стуков
    Render.highlightFree(Storage.getSetting('highlight', true));
    A.updateGameInfo();
    A.showScreen('game');
    A.startTimer();
    A.state.lastActionTime = Date.now();
    A.scheduleAutohint();
    A.saveCurrentGame();
  }

  // ---------- Запуск бесконечного режима ----------
  function startEndless(difficulty) {
    A.state.endlessLayouts = Layouts.getByDifficulty(difficulty);
    startEndlessRound(0);
  }

  function startEndlessRound(roundIdx) {
    // Циклически берём раскладки
    const layout = A.state.endlessLayouts[roundIdx % A.state.endlessLayouts.length];
    const state = Game.newGame(layout);
    state.mode = 'endless';
    state.endlessLevel = roundIdx;
    Render.fitBoard(layout);
    Render.renderFull();
    A.resetLoupe(); // v34: лупа начинает с чистого листа
    Render.playDealAnimation(); // v8: каскадная раздача
    Audio2.deal(); // v26: каскад мягких стуков
    Render.highlightFree(Storage.getSetting('highlight', true));
    A.updateGameInfo();
    A.showScreen('game');
    A.startTimer();
    A.state.lastActionTime = Date.now();
    A.scheduleAutohint();
    A.saveCurrentGame();
  }

  // ---------- Daily Mahjong (v21-daily, v22-mix) ----------
  // Один детерминированный seed на сутки (UTC). Каждый НЕЧЁТНЫЙ день —
  // обычная раскладка, каждый ЧЁТНЫЙ — МИКС двух раскладок бок о бок.
  // Это разнообразит Daily: половина дней — знакомая форма, половина —
  // уникальная комбинированная доска, которую видно только сегодня.
  function startDaily() {
    const seed = Game.dailySeedFromDate(new Date());
    // Чётный день → микс, нечётный → обычная раскладка
    const useMix = (seed % 2) === 0;
    let layout;
    if (useMix) {
      // v31: Ежедневный микс — одна новая раскладка из генератора.
      // Размер 72–120 фишек выбирается из seed, поэтому у всех игроков
      // в этот день доска одинаковая (генератор детерминирован).
      layout = MixGen.generate({
        seed: seed * 2654435761 % 4294967296 || seed,
        method: 'surprise',
        tiles: 72 + (seed % 5) * 12,
        layers: 2 + (seed % 3),
        symmetry: MixGen.SYMMETRIES[seed % 3],
        stagger: (seed % 4) === 1,
      });
    } else {
      const idx = Game.dailyLayoutIndex(seed, Layouts.all.length);
      layout = Layouts.all[idx];
    }
    if (!layout) return;
    // Передаём seed в newGame → детерминированная раздача
    Game.newGame(layout, seed);
    const state = Game.getState();
    state.mode = 'daily';
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

    // Подсказка: если сегодня уже играл — покажи лучший результат
    const todayResult = Storage.getDailyResult();
    if (todayResult && todayResult.played > 0) {
      const timeStr = todayResult.bestTime !== null
        ? A.formatTime(todayResult.bestTime) : '—';
      setTimeout(() => A.toast(
        `Сегодня уже сыграно: ${todayResult.played} партий. ` +
        `Лучшее: ${todayResult.bestScore} очков, ${timeStr}`
      ), 600);
    } else {
      const label = useMix ? 'Ежедневный микс: ' : 'Ежедневная раскладка: ';
      setTimeout(() => A.toast(label + '«' + layout.name + '»'), 600);
    }
  }

  Object.assign(A, {
    startClassic,
    startDaily,
    startEndless,
    startEndlessRound,
  });
})(App);
