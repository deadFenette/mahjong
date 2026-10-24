/* ============================================================
   APP/WIN.JS — Победа: итоги, ачивки на экране победы, салют (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Победа ----------
  function handleWin() {
    const state = Game.getState();
    Game.markWon();
    Audio2.win();
    A.buzz(40); // v9: заметный виброотклик победы
    A.stopTimer();
    const time = Game.getElapsedSeconds();
    // v10: снимаем рекорды ДО записи результата — иначе всё станет рекордом
    const prevStats = Storage.getStats();
    const statsAfter = Storage.addResult({
      won: true,
      score: state.score,
      time,
      pairs: state.pairsFound,
      layoutId: state.layout.id, // v9: для бейджей «собрана N раз»
      mode: state.mode || 'classic',
    });
    // v21-daily: если это Daily-партия — пишем результат в daily-статистику
    if (state.mode === 'daily') {
      Storage.addDailyResult({ won: true, score: state.score, time });
    }
    Storage.clearGame();

    // v11: достижения за победу — считаем по УЖЕ обновлённой статистике
    const winUnlocked = Achievements.evaluateWin(statsAfter, {
      hintsUsed: state.hintsUsed,
      shufflesUsed: state.shufflesUsed,
      undosUsed: state.undosUsed || 0,
      timeSec: time,
      layoutId: state.layout.id,
      mode: state.mode || 'classic',
      endlessLevel: state.endlessLevel || 0,
    });
    if (winUnlocked.length) Storage.unlockAchievements(winUnlocked);

    // Заполняем экран победы
    document.getElementById('win-score').textContent = state.score;
    document.getElementById('win-time').textContent = A.formatTime(time);
    document.getElementById('win-hints').textContent = state.hintsUsed;

    // v10: золотой бейдж «Новый рекорд!» — побит лучший счёт или время
    const recEl = document.getElementById('win-record');
    if (recEl) {
      const beatScore = state.score > prevStats.bestScore;
      const beatTime = prevStats.bestTime === null || time < prevStats.bestTime;
      recEl.hidden = !(beatScore || beatTime);
    }

    // В бесконечном режиме — показать "следующая"
    const nextBtn = document.getElementById('win-next');
    if (state.mode === 'endless') {
      nextBtn.hidden = false;
      document.getElementById('win-text').textContent =
        `Раскладка ${state.endlessLevel + 1} собрана!`;
    } else if (state.mode === 'daily') {
      // v21-daily: предлагаем сыграть ещё раз (та же раскладка на день)
      nextBtn.hidden = false;
      nextBtn.innerHTML = Icons.label('Ещё раз', 'next');
      const todayResult = Storage.getDailyResult();
      const bestStr = todayResult && todayResult.bestTime !== null
        ? ` Лучший результат сегодня: ${todayResult.bestScore} очков, ${A.formatTime(todayResult.bestTime)}`
        : '';
      document.getElementById('win-text').textContent =
        `Ежедневная «${state.layout.name}» собрана!${bestStr}`;
    } else if (state.mode === 'mix') {
      // v31: новый узор с теми же настройками
      nextBtn.hidden = false;
      nextBtn.innerHTML = Icons.label('Новый узор', 'next');
      document.getElementById('win-text').textContent =
        `«${state.layout.name}» собрана!`;
    } else {
      nextBtn.hidden = true;
      nextBtn.innerHTML = Icons.label('Следующая', 'next');
      document.getElementById('win-text').textContent =
        `«${state.layout.name}» собрана!`;
    }

    A.showScreen('win');
    renderWinAchievements(winUnlocked); // v11
    launchWinBurst();
  }

  // ---------- Ачивки на экране победы (v11) ----------
  // Показываем ВСЕ разблокированные; полученные в этой партии —
  // с золотой рамкой и меткой «новое»
  function renderWinAchievements(newIds) {
    const box = document.getElementById('win-achievements');
    if (!box) return;
    box.innerHTML = '';
    const unlocked = (Storage.getStats().achievements) || {};
    const newSet = new Set(Array.isArray(newIds) ? newIds : []);
    Achievements.LIST.forEach(a => {
      if (!Object.prototype.hasOwnProperty.call(unlocked, a.id)) return;
      const chip = document.createElement('div');
      chip.className = 'win-ach' + (newSet.has(a.id) ? ' win-ach-new' : '');
      chip.title = a.desc;
      chip.innerHTML =
        '<span class="win-ach-icon">' + Icons.get(a.icon) + '</span>' +
        '<span class="win-ach-name">' + a.name + '</span>' +
        (newSet.has(a.id) ? '<span class="win-ach-tag">новое</span>' : '');
      box.appendChild(chip);
    });
    box.hidden = box.childElementCount === 0;
  }

  function launchWinBurst() {
    const burst = document.getElementById('win-burst');
    if (!burst) return;
    burst.innerHTML = '';
    // v8: 42 частицы — кружки и квадратные «мини-фишки»,
    // каждый со своим размером, поворотом, задержкой и длительностью
    const colors = ['#c8202a', '#1f7a3a', '#e8a83a', '#3a6a8a', '#d63384', '#f0e6c8', '#f4d27a'];
    for (let i = 0; i < 42; i++) {
      const p = document.createElement('span');
      p.className = 'burst-particle' + (i % 3 === 0 ? ' burst-square' : '');
      const angle = (i / 42) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const dist = 110 + Math.random() * 170;
      p.style.setProperty('--tx', (Math.cos(angle) * dist) + 'px');
      p.style.setProperty('--ty', (Math.sin(angle) * dist) + 'px');
      p.style.setProperty('--rot', (Math.random() * 360 - 180).toFixed(0) + 'deg');
      p.style.setProperty('--delay', (i * 0.018).toFixed(3) + 's');
      p.style.setProperty('--dur', (1.2 + Math.random() * 0.9).toFixed(2) + 's');
      const size = 8 + Math.random() * 8;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = colors[i % colors.length];
      burst.appendChild(p);
    }
  }

  Object.assign(A, {
    handleWin,
  });
})(App);
