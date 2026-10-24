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

    A.toast('Ходов больше нет — перемешиваем');
    const stateAtSchedule = state; // за 600мс могли начать новую партию
    setTimeout(() => {
      if (Game.getState() !== stateAtSchedule) return;
      Game.shuffleBoard(false);
      Render.renderFull();
      Render.playDealAnimation(); // v8: каскадная раздача
      Render.pulseTable();        // v8: стол вздрагивает
      Render.highlightFree(Storage.getSetting('highlight', true));
      updateGameInfo();
      Audio2.shuffleSound();
      A.saveCurrentGame(); // v13: починенная доска попадает в сейв
    }, 600);
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
        setTimeout(() => el.classList.remove('shake'), 300);
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
      // v11: серия — своя мелодия и свой всплывающий бейдж;
      // серия ×5 приносит достижение
      if (last && Number(last.combo) > 1) {
        Audio2.combo(last.combo);
        Render.spawnComboFloat('Комбо ×' + last.combo, last.tile1, last.tile2);
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
      if (last.scoreDelta > 0) {
        Render.spawnScoreFloat('+' + last.scoreDelta, last.tile1, last.tile2);
      }
      updateGameInfo();

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
      Render.setSelected(tile);
    }

    scheduleAutohint();
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
    Audio2.hint();
    A.state.lastActionTime = Date.now();
    A.saveCurrentGame();
  }

  function actShuffle() {
    Game.shuffleBoard(true);
    Render.renderFull();
    Render.playDealAnimation(); // v8: фишки пересыпаются волной
    Render.pulseTable();        // v8: стол вздрагивает
    Render.highlightFree(Storage.getSetting('highlight', true));
    updateGameInfo();
    Audio2.shuffleSound();
    A.state.lastActionTime = Date.now();
    A.saveCurrentGame();
  }

  function actUndo() {
    if (Game.undo()) {
      // v34: вернулись фишки — рамка оставшихся могла вырасти, фишки уменьшатся
      Render.fitBoard(Game.getState().layout);
      Render.renderFull();
      Render.playDealAnimation({ fast: true }); // v8: фишки быстро возвращаются
      Render.highlightFree(Storage.getSetting('highlight', true));
      updateGameInfo();
      // v13: единая проверка тупика (после отмены ход есть всегда,
      // но проверка дешёвая и спасает от вырожденных сейвов)
      ensureMovesAvailable();
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
  function updateGameInfo() {
    const state = Game.getState();
    if (!state) return;
    // v8: изменение значения подсвечивается пульсом (bump)
    A.setTextBumped(document.getElementById('game-score'), state.score);
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
