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
    // v44: счёт и время «накатываются» с нуля, пока въезжают плашки (0.45 с)
    A.rollNumber(document.getElementById('win-score'), state.score,
      { from: 0, ms: 1100, delay: 450, fx: 'celebrate' });
    A.rollNumber(document.getElementById('win-time'), time,
      { from: 0, ms: 1100, delay: 450, fx: 'celebrate', format: A.formatTime });
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
    launchWinRain(); // v42
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

  // ---------- Дождь из мини-фишек мастей (v42 «Intent») ----------
  // Чистый CSS: мини-фишки (точки/бамбук/иероглифы с чернильными
  // цветами фишек) падают сверху с вращением. У каждой свой размер,
  // длительность, задержка, поворот и снос — дождь неровный, живой.
  // В лёгком режиме и при reduced-motion не запускается вовсе.
  function launchWinRain() {
    const screenEl = document.getElementById('screen-win');
    if (!screenEl) return;
    // Деградация: лёгкий режим / уменьшенная анимация — без дождя
    if (typeof Perf !== 'undefined' && Perf.isLite && Perf.isLite()) return;
    try {
      if (typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) { /* нет matchMedia — играем как обычно */ }

    const old = document.getElementById('win-rain');
    if (old) old.remove();

    const box = document.createElement('div');
    box.className = 'win-rain';
    box.id = 'win-rain';
    box.setAttribute('aria-hidden', 'true');

    // Мастя → иероглиф и чернила (как на настоящих фишках):
    // 筒 — точки, 索 — бамбук, 万 — символы, 中/發 — драконы
    const symbols = [
      { s: '筒', ink: '#1a1a1a' },
      { s: '筒', ink: '#c8202a' },
      { s: '索', ink: '#1f7a3a' },
      { s: '万', ink: '#1a1a1a' },
      { s: '萬', ink: '#c8202a' },
      { s: '中', ink: '#c8202a' },
      { s: '發', ink: '#1f7a3a' },
    ];

    const COUNT = 30;
    for (let i = 0; i < COUNT; i++) {
      const d = document.createElement('span');
      const sym = symbols[(Math.random() * symbols.length) | 0];
      d.className = 'win-drop';
      d.textContent = sym.s;
      const size = 18 + Math.random() * 14; // 18–32px
      d.style.left = (2 + Math.random() * 96) + '%';
      d.style.setProperty('--rd-size', size.toFixed(0) + 'px');
      d.style.setProperty('--rd-ink', sym.ink);
      d.style.setProperty('--rf', (2.6 + Math.random() * 2).toFixed(2) + 's');
      d.style.setProperty('--rd', (Math.random() * 1.4).toFixed(2) + 's');
      d.style.setProperty('--rr', (300 + Math.random() * 480).toFixed(0) + 'deg');
      d.style.setProperty('--rdx', (Math.random() * 60 - 30).toFixed(0) + 'px');
      box.appendChild(d);
    }
    screenEl.appendChild(box);
    // Дождь конечен: убираем контейнер, когда последняя капля упала
    setTimeout(() => { if (box.parentNode) box.remove(); }, 7800);
  }

  Object.assign(A, {
    handleWin,
  });
})(App);
