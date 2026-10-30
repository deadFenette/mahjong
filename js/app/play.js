/* ============================================================
   APP/PLAY.JS — Игровой цикл: клик по фишке, тупик, подсказка/перемешать/отмена, авто-подсказка, таймер, шапка (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Гарантия наличия ходов (v13) ----------
  // Тупик мог возникать не только после матча: сейв писался ДО
  // отложенного (600мс) авто-перемешивания и не обновлялся после
  // него — закрыв игру сразу после перемешивания, игрок сохранял
  // ТУПИКОВУЮ доску. При загрузке сейва тупик вообще не проверялся.
  // Теперь одна проверка на все случаи: после матча, после отмены
  // и после загрузки сейва. Нет ходов — через 600мс (дать анимации
  // матча доиграть) перемешиваем и ОБЯЗАТЕЛЬНО пересохраняем доску.
  function ensureMovesAvailable() {
    const state = Game.getState();
    if (!state || state.ended) return;
    if (Game.hasAnyMove()) return;

    // v44: тупик — маленькая драматургия вместо тихого тоста: плашка
    // «Ходов нет» проявляется сразу, перемешивание стартует через 800 мс
    // (игрок успевает понять ЧТО происходит), плашка уходит вместе с разлётом
    const drama = showDeadEnd();
    if (!drama) A.toast('Ходов больше нет — перемешиваем');
    const stateAtSchedule = state; // за 800мс могли начать новую партию
    setTimeout(() => {
      hideDeadEnd();
      if (Game.getState() !== stateAtSchedule) return;
      Game.shuffleBoard(false);
      // v42: сначала разлёт фишек и тряска, потом пересып волной
      reshuffleBoardVisual(false);
      A.saveCurrentGame(); // v13: починенная доска попадает в сейв
    }, drama ? 800 : 600);
  }

  // ---------- Плашка «Ходов нет» (v44) ----------
  let deadEndEl = null;
  function showDeadEnd() {
    if (typeof Motion !== 'undefined' && !Motion.isOn('shuffle')) return false;
    const host = document.getElementById('screen-game');
    if (!host) return false;
    hideDeadEnd(true);
    deadEndEl = document.createElement('div');
    deadEndEl.className = 'deadend-banner';
    deadEndEl.setAttribute('role', 'status');
    deadEndEl.innerHTML = '<strong>Ходов нет</strong><span>Перемешиваем доску…</span>';
    host.appendChild(deadEndEl);
    return true;
  }
  function hideDeadEnd(now) {
    const el = deadEndEl;
    if (!el) return;
    deadEndEl = null;
    if (now) { el.remove(); return; }
    el.classList.add('out');
    setTimeout(() => el.remove(), 380);
  }

  // ---------- Индикатор серии (v44) ----------
  // Тонкая полоска под счётом сгорает за окно комбо (Game.COMBO_WINDOW_MS):
  // игрок ВИДИТ, сколько у него осталось, чтобы продолжить серию.
  // Источник правды — state.lastMatchAt (как и у самого комбо), поэтому
  // после загрузки сейва или отмены хода полоска честно показывает остаток.
  let meterKey = null;
  function syncComboMeter(state) {
    const m = document.getElementById('combo-meter');
    if (!m) return;
    const win = Game.COMBO_WINDOW_MS || 5000;
    const last = state ? state.lastMatchAt : null;
    const elapsed = last ? Date.now() - last : Infinity;
    const finished = !!state && state.totalPairs > 0 && state.pairsFound >= state.totalPairs;
    if (!last || finished || !(elapsed >= 0) || elapsed >= win) {
      m.hidden = true;
      m.classList.remove('run', 'hot');
      meterKey = null;
      return;
    }
    if (meterKey === last) return;
    meterKey = last;
    m.hidden = false;
    m.classList.remove('run', 'hot');
    void m.offsetWidth;
    m.style.setProperty('--cm-dur', win + 'ms');
    m.style.setProperty('--cm-skip', (-elapsed) + 'ms');
    m.dataset.combo = state.combo > 1 ? '×' + state.combo : '';
    m.classList.toggle('hot', state.combo >= 2);
    m.classList.add('run');
  }

  // ---------- Напряжение финала (v44) ----------
  // ≤3 пар до победы — сукно темнеет к краям; последняя пара — доска
  // «дышит», золотая вставка пульсирует (css: [data-tension]).
  function syncTension(state) {
    const g = document.getElementById('screen-game');
    if (!g || !state) return;
    const left = state.totalPairs - state.pairsFound;
    const lvl = (state.totalPairs >= 8 && left > 0) ? (left <= 1 ? 2 : left <= 3 ? 1 : 0) : 0;
    if (g.dataset.tension !== String(lvl)) g.dataset.tension = String(lvl);
  }

  // ---------- Общая визуальная часть перемешивания (v42) ----------
  // Порядок Intent: стол вздрагивает и фишки разлетаются СРАЗУ
  // (мгновенный отклик), пересып каскадом — следом. fast — без разлёта
  // (быстрый возврат после undo не перемешивает).
  function reshuffleBoardVisual(fast) {
    Render.pulseTable(); // тряска стартует немедленно
    Render.scatterTiles(() => {
      Render.renderFull();
      Render.playDealAnimation({ fast: !!fast }); // каскадная раздача
      Render.highlightFree(Storage.getSetting('highlight', true));
      updateGameInfo();
    });
  }

  // ---------- Обработка клика по фишке ----------
  function onTileClick(tile) {
    if (A.state.currentScreen !== 'game') return;
    const state = Game.getState();
    if (!state || state.ended || state.paused) return;

    A.state.lastActionTime = Date.now();
    Render.clearHint(); // v34: «очень заметная» подсказка держится до первого действия
    const result = Game.selectTile(tile);

    if (result === 'notfree') {
      // Лёгкое визуальное "покачивание"
      const el = document.querySelector(`[data-tile-id="${tile.id}"]`);
      if (el) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 400);
      }
      A.buzz(8); // v9: мягкий виброотклик «сюда нельзя»
      Audio2.blocked(); // v26: глухой «ток»
      return;
    }

    if (result === 'selected') {
      Audio2.click();
      Render.setSelected(tile);
      A.updateLoupe(tile);
    } else if (result === 'deselected') {
      Audio2.deselect(); // v26
      Render.setSelected(null);
    } else if (result === 'matched') {
      const st = Game.getState();
      const last = st.history[st.history.length - 1];
      // v42: медальон — импульс на порогах 25/50/75/100% собранной доски
      bumpMedallionProgress(st);
      // v11: серия — своя мелодия и свой всплывающий бейдж;
      // серия ×5 приносит достижение
      if (last && Number(last.combo) > 1) {
        Audio2.combo(last.combo);
        Render.spawnComboFloat('Комбо ×' + last.combo, last.tile1, last.tile2);
        // v42: виньетка ×4+ и золотая пыль ×8 — синхронно с бейджем
        Render.comboFeedback(last.combo, midpointOfTiles(last.tile1, last.tile2));
        const comboUnlocked = Achievements.evaluateCombo(Storage.getStats(), last.combo);
        if (comboUnlocked.length) {
          Storage.unlockAchievements(comboUnlocked);
          A.announceAchievements(comboUnlocked);
        }
      } else {
        Audio2.match();
      }
      A.buzz(12); // v9
      Render.animateRemove([last.tile1, last.tile2]);
      Render.setSelected(null);
      Render.scheduleRefit(); // v34: стол опустел — фишки могут стать крупнее
      // v8: над собранной парой всплывает «+N»
      // v44: очки летят в табло; число счёта обновляется в момент «прилёта»
      let holdScore = false;
      if (last.scoreDelta > 0) {
        holdScore = Render.spawnScoreFloat('+' + last.scoreDelta, last.tile1, last.tile2,
          () => { refreshScore(); scoreHit(); });
      }
      updateGameInfo(holdScore ? { holdScore: true } : null);
      if (holdScore) setTimeout(refreshScore, Render.SCORE_FLY_MS + 300); // страховка

      // Подсветка могла поменяться
      Render.clearHighlight();
      Render.highlightFree(Storage.getSetting('highlight', true));

      // Проверка победы
      if (Game.isWon()) {
        A.handleWin();
        return;
      }
      // v13: проверка тупика — общая с загрузкой сейва и отменой
      ensureMovesAvailable();
      A.saveCurrentGame();
    } else if (result === 'mismatched') {
      Audio2.mismatch();
      // v44: прежняя фишка «качает головой» (наклон, не сдвиг — её поза
      // подъёма не затрагивается), затем выбор переходит на новую
      const prevEl = document.querySelector('#board .tile.selected');
      if (prevEl) {
        prevEl.classList.remove('reject');
        void prevEl.offsetWidth;
        prevEl.classList.add('reject');
        setTimeout(() => prevEl.classList.remove('reject'), 420);
      }
      Render.setSelected(tile);
    }

    scheduleAutohint();
  }


  // ---------- Медальон: импульс на порогах прогресса (v42) ----------
  // 25/50/75/100% собранных пар. V4: визуального эффекта больше нет (медальон
  // не крутится) — проявление идёт плавно от общего прогресса (Render.setProgress).
  // Порог пересекается ОДИН раз: сравниваем процент до и после матча.
  const MEDALLION_THRESHOLDS = [0.25, 0.5, 0.75, 1];
  function bumpMedallionProgress(state) {
    if (!state || !state.totalPairs) return;
    const prev = Math.max(0, state.pairsFound - 1) / state.totalPairs;
    const now = state.pairsFound / state.totalPairs;
    const crossed = MEDALLION_THRESHOLDS.some(
      t => prev < t && now >= t - 1e-9
    );
    if (crossed) Render.pulseMedallion();
  }

  // ---------- Середина пары в координатах доски (для комбо-эффектов) ----------
  function midpointOfTiles(tileA, tileB) {
    try {
      const size = { w: Render.getTileSize().w, h: Render.getTileSize().h, gap: Render.getGap(), zLift: Render.getZLift() };
      const posA = Render.tilePosition(tileA, size);
      const posB = Render.tilePosition(tileB, size);
      return {
        x: (posA.left + posB.left) / 2 + size.w / 2,
        y: (posA.top + posB.top) / 2 + size.h / 2,
      };
    } catch (e) { return null; }
  }

  // ---------- Кнопки во время игры ----------
  function actHint() {
    const pair = Game.findHint();
    if (!pair) {
      A.toast('Подсказок нет — перемешайте фишки');
      return;
    }
    const state = Game.getState();
    state.hintsUsed += 1;
    Render.flashPair(pair);
    A.pulseButton('btn-hint', 'pulse-hint', 'hint');
    Audio2.hint();
    A.state.lastActionTime = Date.now();
    A.saveCurrentGame();
  }

  function actShuffle() {
    Game.shuffleBoard(true);
    Audio2.shuffleSound();
    A.pulseButton('btn-shuffle', 'pulse-shuffle', 'shuffle');
    A.state.lastActionTime = Date.now();
    // v42: разлёт + тряска сразу, пересып волной — следом
    reshuffleBoardVisual(false);
    A.saveCurrentGame();
  }

  function actUndo() {
    // v44: запоминаем, какие две фишки вернутся — падать будут только они
    const hist = Game.getState().history;
    const lastMove = hist.length ? hist[hist.length - 1] : null;
    const restored = lastMove ? [lastMove.tile1, lastMove.tile2] : null;
    if (Game.undo()) {
      // v34: вернулись фишки — рамка оставшихся могла вырасти, фишки уменьшатся
      Render.fitBoard(Game.getState().layout);
      Render.renderFull();
      Render.playDealAnimation(restored ? { fast: true, only: restored } : { fast: true });
      Render.highlightFree(Storage.getSetting('highlight', true));
      updateGameInfo();
      // v13: единая проверка тупика (после отмены ход есть всегда,
      // но проверка дешёвая и спасает от вырожденных сейвов)
      ensureMovesAvailable();
      A.pulseButton('btn-undo', 'pulse-undo', 'select');
      Audio2.undo(); // v26: свой звук отмены
      A.state.lastActionTime = Date.now();
      A.saveCurrentGame();
    } else {
      // v9: раньше кнопка молчала — непонятно, сработало ли
      A.toast('Нечего отменять');
    }
  }

  // ---------- Авто-подсказка ----------
  // По умолчанию OFF. Если включена в настройках — мигает через 15 секунд
  // бездействия. Каждое действие сбрасывает таймер.
  const AUTOHINT_DELAY = 15000;
  function scheduleAutohint() {
    clearTimeout(A.state.hintTimer);
    if (!Storage.getSetting('autohint', false)) return;
    if (A.state.currentScreen !== 'game') return;
    A.state.hintTimer = setTimeout(() => {
      if (A.state.currentScreen !== 'game') return;
      const state = Game.getState();
      if (!state || state.ended || state.paused) return;
      const pair = Game.findHint();
      if (pair) Render.flashPair(pair);
      // Снова на 15 сек
      scheduleAutohint();
    }, AUTOHINT_DELAY);
  }
  function cancelAutohint() { clearTimeout(A.state.hintTimer); }

  // ---------- Таймер ----------
  let timerInterval = null;
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (A.state.currentScreen !== 'game') return;
      const state = Game.getState();
      if (!state || state.ended || state.paused) return; // v9: пауза не тикает
      document.getElementById('game-time').textContent = formatTime(Game.getElapsedSeconds());
    }, 1000);
  }
  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---------- Обновление инфо в шапке ----------
  function refreshScore() {
    const state = Game.getState();
    if (state) A.setTextBumped(document.getElementById('game-score'), state.score);
  }
  // Короткая вспышка табло в момент прилёта очков
  function scoreHit() {
    if (typeof Motion !== 'undefined' && !Motion.isOn('match')) return;
    const b = document.getElementById('game-score');
    const block = b && b.closest ? b.closest('.info-block') : null;
    if (!block) return;
    block.classList.remove('score-hit');
    void block.offsetWidth;
    block.classList.add('score-hit');
    setTimeout(() => block.classList.remove('score-hit'), 600);
  }

  function updateGameInfo(opts) {
    const state = Game.getState();
    if (!state) return;
    syncComboMeter(state);
    syncTension(state);
    Render.setProgress(state.totalPairs ? state.pairsFound / state.totalPairs : 0);   // V4: медальон проявляется без движения
    // v8: изменение значения подсвечивается пульсом (bump)
    if (!(opts && opts.holdScore)) A.setTextBumped(document.getElementById('game-score'), state.score);
    A.setTextBumped(document.getElementById('game-pairs'),
      `${state.pairsFound}/${state.totalPairs}`);
    // Счётчик ходов: сколько пар ещё можно собрать прямо сейчас
    A.setTextBumped(document.getElementById('game-moves'), countAvailableMoves());
  }

  // ---------- Сколько пар можно собрать прямо сейчас ----------
  function countAvailableMoves() {
    const free = Game.getFreeTiles();
    let count = 0;
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (Tileset.isMatch(free[i], free[j])) count++;
      }
    }
    return count;
  }

  Object.assign(A, {
    actHint,
    actShuffle,
    actUndo,
    cancelAutohint,
    ensureMovesAvailable,
    formatTime,
    onTileClick,
    scheduleAutohint,
    startTimer,
    stopTimer,
    updateGameInfo,
  });
})(App);
