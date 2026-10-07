/* ============================================================
   APP.JS — Главный контроллер
   Управляет экранами, режимами, событиями
   ============================================================ */

const App = (function () {

  const screens = ['menu', 'layouts', 'difficulty', 'game', 'win', 'settings'];
  let currentScreen = 'menu';
  let hintTimer = null;       // таймер авто-подсказки
  let lastActionTime = 0;
  let endlessLayouts = [];    // очередь раскладок для бесконечного режима

  // ---------- Навигация ----------
  // Используем body[data-screen] как единый источник правды.
  // CSS гарантирует, что активен только один .screen (без наложений).
  function showScreen(name) {
    document.body.dataset.screen = name;
    // На всякий случай — переключаем и класс .active (для анимации opacity)
    screens.forEach(s => {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('active', s === name);
    });
    currentScreen = name;

    // Закрываем паузу, если она была открыта
    const pauseEl = document.getElementById('pause-overlay');
    if (pauseEl) pauseEl.hidden = true;

    if (name === 'menu') updateMenuStats();
    if (name === 'game') {
      const st = Game.getState();
      if (st) st.paused = false;
      // Пересчитать под текущий размер экрана.
      // Двойной rAF: ждём реальную отрисовку экрана — измерения
      // надёжнее, чем старый setTimeout(50).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => Render.reposition());
      });
    }
  }

  function updateMenuStats() {
    const stats = Storage.getStats();
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-won').textContent = stats.won;
    document.getElementById('stat-best').textContent = stats.bestScore;
    // Кнопка «Продолжить» видна только если есть сохранённая игра
    document.getElementById('btn-continue').hidden = !Storage.hasSavedGame();
  }

  // ---------- Запуск классической игры ----------
  function startClassic(layoutId) {
    const layout = Layouts.getById(layoutId);
    if (!layout) return;
    Game.newGame(layout);
    Render.fitBoard(layout);
    Render.renderFull();
    Render.highlightFree(Storage.getSetting('highlight', true));
    updateGameInfo();
    showScreen('game');
    startTimer();
    lastActionTime = Date.now();
    scheduleAutohint();
    saveCurrentGame();
  }

  // ---------- Запуск бесконечного режима ----------
  function startEndless(difficulty) {
    endlessLayouts = Layouts.getByDifficulty(difficulty);
    startEndlessRound(0);
  }

  function startEndlessRound(roundIdx) {
    // Циклически берём раскладки
    const layout = endlessLayouts[roundIdx % endlessLayouts.length];
    const state = Game.newGame(layout);
    state.mode = 'endless';
    state.endlessLevel = roundIdx;
    Render.fitBoard(layout);
    Render.renderFull();
    Render.highlightFree(Storage.getSetting('highlight', true));
    updateGameInfo();
    showScreen('game');
    startTimer();
    lastActionTime = Date.now();
    scheduleAutohint();
    saveCurrentGame();
  }

  // ---------- Обработка клика по фишке ----------
  function onTileClick(tile) {
    if (currentScreen !== 'game') return;
    const state = Game.getState();
    if (!state || state.ended || state.paused) return;

    lastActionTime = Date.now();
    const result = Game.selectTile(tile);

    if (result === 'notfree') {
      // Лёгкое визуальное "покачивание"
      const el = document.querySelector(`[data-tile-id="${tile.id}"]`);
      if (el) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 300);
      }
      return;
    }

    if (result === 'selected') {
      Audio2.click();
      Render.setSelected(tile);
    } else if (result === 'deselected') {
      Render.setSelected(null);
    } else if (result === 'matched') {
      Audio2.match();
      const st = Game.getState();
      const last = st.history[st.history.length - 1];
      Render.animateRemove([last.tile1, last.tile2]);
      Render.setSelected(null);
      updateGameInfo();

      // Подсветка могла поменяться
      Render.clearHighlight();
      Render.highlightFree(Storage.getSetting('highlight', true));

      // Проверка победы
      if (Game.isWon()) {
        handleWin();
        return;
      }
      // Проверка тупика
      if (!Game.hasAnyMove()) {
        // В тупике — перемешать автоматически
        toast('Ходов больше нет — перемешиваем');
        setTimeout(() => {
          Game.shuffleBoard(false);
          Render.renderFull();
          Render.highlightFree(Storage.getSetting('highlight', true));
          updateGameInfo();
          Audio2.shuffleSound();
        }, 600);
      }
      saveCurrentGame();
    } else if (result === 'mismatched') {
      Audio2.mismatch();
      Render.setSelected(tile);
    }

    scheduleAutohint();
  }

  // ---------- Победа ----------
  function handleWin() {
    const state = Game.getState();
    Game.markWon();
    Audio2.win();
    stopTimer();
    const time = Game.getElapsedSeconds();
    const stats = Storage.addResult({
      won: true,
      score: state.score,
      time,
      pairs: state.pairsFound,
    });
    Storage.clearGame();

    // Заполняем экран победы
    document.getElementById('win-score').textContent = state.score;
    document.getElementById('win-time').textContent = formatTime(time);
    document.getElementById('win-hints').textContent = state.hintsUsed;

    // В бесконечном режиме — показать "следующая"
    const nextBtn = document.getElementById('win-next');
    if (state.mode === 'endless') {
      nextBtn.hidden = false;
      document.getElementById('win-text').textContent =
        `Раскладка ${state.endlessLevel + 1} собрана!`;
    } else {
      nextBtn.hidden = true;
      document.getElementById('win-text').textContent =
        `«${state.layout.name}» собрана!`;
    }

    showScreen('win');
    launchWinBurst();
  }

  function launchWinBurst() {
    const burst = document.getElementById('win-burst');
    burst.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('span');
      p.className = 'burst-particle';
      const angle = (i / 24) * Math.PI * 2;
      const dist = 120 + Math.random() * 60;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.setProperty('--delay', (i * 0.02) + 's');
      const colors = ['#c8202a', '#1f7a3a', '#e8a83a', '#3a6a8a', '#d63384', '#f0e6c8'];
      p.style.background = colors[i % colors.length];
      burst.appendChild(p);
    }
  }

  // ---------- Кнопки во время игры ----------
  function actHint() {
    const pair = Game.findHint();
    if (!pair) {
      toast('Подсказок нет — перемешайте фишки');
      return;
    }
    const state = Game.getState();
    state.hintsUsed += 1;
    Render.flashPair(pair);
    Audio2.hint();
    lastActionTime = Date.now();
    saveCurrentGame();
  }

  function actShuffle() {
    Game.shuffleBoard(true);
    Render.renderFull();
    Render.highlightFree(Storage.getSetting('highlight', true));
    updateGameInfo();
    Audio2.shuffleSound();
    lastActionTime = Date.now();
    saveCurrentGame();
  }

  function actUndo() {
    if (Game.undo()) {
      Render.renderFull();
      Render.highlightFree(Storage.getSetting('highlight', true));
      updateGameInfo();
      Audio2.click();
      lastActionTime = Date.now();
      saveCurrentGame();
    }
  }

  // ---------- Авто-подсказка ----------
  // По умолчанию OFF. Если включена в настройках — мигает через 15 секунд
  // бездействия. Каждое действие сбрасывает таймер.
  const AUTOHINT_DELAY = 15000;
  function scheduleAutohint() {
    clearTimeout(hintTimer);
    if (!Storage.getSetting('autohint', false)) return;
    if (currentScreen !== 'game') return;
    hintTimer = setTimeout(() => {
      if (currentScreen !== 'game') return;
      const state = Game.getState();
      if (!state || state.ended || state.paused) return;
      const pair = Game.findHint();
      if (pair) Render.flashPair(pair);
      // Снова на 15 сек
      scheduleAutohint();
    }, AUTOHINT_DELAY);
  }
  function cancelAutohint() { clearTimeout(hintTimer); }

  // ---------- Таймер ----------
  let timerInterval = null;
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (currentScreen !== 'game') return;
      const state = Game.getState();
      if (!state || state.ended) return;
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
    document.getElementById('game-score').textContent = state.score;
    document.getElementById('game-pairs').textContent =
      `${state.pairsFound}/${state.totalPairs}`;
    // Счётчик ходов: сколько пар ещё можно собрать прямо сейчас
    const moves = countAvailableMoves();
    document.getElementById('game-moves').textContent = moves;
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

  // ---------- Сохранение/загрузка текущей игры ----------
  function saveCurrentGame() {
    const state = Game.getState();
    if (!state) return;
    // Сохраняем достаточно данных для восстановления
    const tilesData = state.tiles.map(t => ({
      id: t.id, suit: t.suit, rank: t.rank, name: t.name, face: t.face,
      x: t.x, y: t.y, z: t.z, removed: t.removed,
    }));
    Storage.saveGame({
      layoutId: state.layout.id,
      tiles: tilesData,
      score: state.score,
      pairsFound: state.pairsFound,
      totalPairs: state.totalPairs,
      hintsUsed: state.hintsUsed,
      shufflesUsed: state.shufflesUsed,
      startTime: state.startTime,
      mode: state.mode,
      endlessLevel: state.endlessLevel || 0,
    });
  }

  function continueSaved() {
    const saved = Storage.loadGame();
    if (!saved) return;
    const layout = Layouts.getById(saved.layoutId);
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
      state.board = {};
      state.tiles.forEach(t => { state.board[Game.key(t.x, t.y, t.z)] = t; });
      state.score = saved.score || 0;
      state.pairsFound = saved.pairsFound || 0;
      state.totalPairs = saved.totalPairs || Math.floor(state.tiles.length / 2);
      state.hintsUsed = saved.hintsUsed || 0;
      state.shufflesUsed = saved.shufflesUsed || 0;
      state.startTime = saved.startTime || Date.now();
      state.mode = saved.mode || 'classic';
      state.endlessLevel = saved.endlessLevel || 0;
    } else {
      // Сохранение не совпадает с раскладкой — начинаем заново,
      // вместо сломанной доски
      Storage.clearGame();
      toast('Сохранение устарело — начинаем заново');
    }

    state.selected = null;
    state.history = []; // историю не сохраняем — упрощаем

    Render.fitBoard(layout);
    Render.renderFull();
    Render.highlightFree(Storage.getSetting('highlight', true));
    updateGameInfo();
    showScreen('game');
    startTimer();
    lastActionTime = Date.now();
    scheduleAutohint();
  }

  // ---------- Галерея раскладок ----------
  function renderLayoutsGrid() {
    const grid = document.getElementById('layouts-grid');
    grid.innerHTML = '';
    Layouts.all.forEach(layout => {
      const card = document.createElement('button');
      card.className = 'layout-card';
      card.innerHTML = `
        <div class="layout-preview" data-layout="${layout.id}"></div>
        <div class="layout-info">
          <span class="layout-name">${layout.name}</span>
          <span class="layout-desc">${layout.description}</span>
          <span class="layout-meta">${layout.tilesCount} фишек · ${layout.layers} слоя</span>
        </div>
      `;
      card.addEventListener('click', () => startClassic(layout.id));
      grid.appendChild(card);
    });

    // Рисуем мини-превью для каждой раскладки
    setTimeout(() => {
      Layouts.all.forEach(layout => {
        const preview = document.querySelector(`.layout-preview[data-layout="${layout.id}"]`);
        if (preview) drawLayoutPreview(preview, layout);
      });
    }, 50);
  }

  function drawLayoutPreview(container, layout) {
    const w = container.clientWidth || 140;
    const h = container.clientHeight || 90;
    const layers = Math.max(1, layout.layers);
    const zOff = 3; // подъём слоя в превью

    // Резервируем место под подъём верхних слоёв, иначе они обрезаются
    const availW = w - 8;
    const availH = h - 8 - (layers - 1) * zOff;
    const tileW = Math.max(3, Math.min(availW / layout.width, (availH / layout.height) / 1.4));
    const tileH = tileW * 1.4;
    const gap = Math.max(0.5, tileW * 0.06);

    const boardW = layout.width * (tileW + gap) - gap;
    const boardH = layout.height * (tileH + gap) - gap;
    const liftTotal = (layers - 1) * zOff;
    const offsetX = (w - boardW) / 2;
    // Блок целиком (вместе с подъёмом) центрируем по вертикали
    const offsetY = (h - boardH - liftTotal) / 2 + liftTotal;

    container.innerHTML = '';
    // Сортируем по z, y, x — нижние рисуются раньше верхних
    const sorted = layout.positions.slice().sort((a, b) =>
      a.z - b.z || a.y - b.y || a.x - b.x);
    sorted.forEach(p => {
      const dot = document.createElement('div');
      dot.className = 'preview-tile';
      dot.style.width = tileW + 'px';
      dot.style.height = tileH + 'px';
      dot.style.left = (offsetX + p.x * (tileW + gap)) + 'px';
      dot.style.top = (offsetY + p.y * (tileH + gap) - p.z * zOff) + 'px';
      dot.style.zIndex = (p.z + 1) * 100 + Math.round(p.y * 2);
      container.appendChild(dot);
    });
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
  }

  // ---------- Настройки ----------
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    Storage.setSetting('theme', theme);
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === theme);
    });
  }

  function applyTileSize(size) {
    Storage.setSetting('tileSize', size);
    document.querySelectorAll('.size-card').forEach(c => {
      c.classList.toggle('active', c.dataset.size === size);
    });
    if (currentScreen === 'game') {
      Render.reposition();
      Render.highlightFree(Storage.getSetting('highlight', true));
    }
  }

  function loadSettings() {
    applyTheme(Storage.getSetting('theme', 'traditional'));
    applyTileSize(Storage.getSetting('tileSize', 'large'));
    document.getElementById('setting-sound').checked = Storage.getSetting('sound', true);
    document.getElementById('setting-win-sound').checked = Storage.getSetting('winSound', true);
    document.getElementById('setting-highlight').checked = Storage.getSetting('highlight', true);
    document.getElementById('setting-autohint').checked = Storage.getSetting('autohint', false);
  }

  // ---------- Пауза ----------
  function openPause() {
    const state = Game.getState();
    if (!state || state.ended) return;
    state.paused = true;
    document.getElementById('pause-overlay').hidden = false;
    cancelAutohint();
  }
  function closePause() {
    document.getElementById('pause-overlay').hidden = true;
    const state = Game.getState();
    if (state) state.paused = false;
    lastActionTime = Date.now();
    scheduleAutohint();
  }

  // ---------- Ресайз ----------
  // Дебаунс + ResizeObserver: ловит и изменение окна, и изменение
  // самого контейнера (PWA-окно, панель разработчика, системный зум)
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentScreen === 'game') {
        Render.reposition();
      }
      // Перерисовать превью раскладок, если мы в галерее
      if (currentScreen === 'layouts') {
        Layouts.all.forEach(layout => {
          const preview = document.querySelector(`.layout-preview[data-layout="${layout.id}"]`);
          if (preview) drawLayoutPreview(preview, layout);
        });
      }
    }, 150);
  }

  // ---------- Лепестки сакуры ----------
  function initPetals() {
    const container = document.getElementById('petals-container');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const petal = document.createElement('div');
      petal.className = 'petal';
      petal.style.left = (Math.random() * 100) + '%';
      petal.style.animationDuration = (12 + Math.random() * 10) + 's';
      petal.style.animationDelay = (-Math.random() * 15) + 's';
      const scale = 0.6 + Math.random() * 0.7;
      petal.style.transform = `scale(${scale})`;
      container.appendChild(petal);
    }
  }

  // ---------- Инициализация ----------
  function init() {
    Audio2.init();
    Render.init(document.getElementById('board'));
    loadSettings();
    updateMenuStats();
    initPetals();

    // Кнопки главного меню
    document.getElementById('btn-continue').addEventListener('click', continueSaved);
    document.getElementById('btn-classic').addEventListener('click', () => {
      renderLayoutsGrid();
      showScreen('layouts');
    });
    document.getElementById('btn-endless').addEventListener('click', () => {
      showScreen('difficulty');
    });
    document.getElementById('btn-settings').addEventListener('click', () => {
      showScreen('settings');
    });

    // Назад
    document.getElementById('back-layouts').addEventListener('click', () => showScreen('menu'));
    document.getElementById('back-difficulty').addEventListener('click', () => showScreen('menu'));
    document.getElementById('back-settings').addEventListener('click', () => showScreen('menu'));

    // Сложность
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => {
        startEndless(card.dataset.difficulty);
      });
    });

    // Кнопки игры
    document.getElementById('game-menu').addEventListener('click', openPause);
    document.getElementById('btn-hint').addEventListener('click', actHint);
    document.getElementById('btn-shuffle').addEventListener('click', actShuffle);
    document.getElementById('btn-undo').addEventListener('click', actUndo);

    // Пауза
    document.getElementById('pause-resume').addEventListener('click', closePause);
    document.getElementById('pause-restart').addEventListener('click', () => {
      const state = Game.getState();
      if (state) {
        Game.newGame(state.layout);
        Render.fitBoard(state.layout);
        Render.renderFull();
        Render.highlightFree(Storage.getSetting('highlight', true));
        updateGameInfo();
        startTimer();
        closePause();
        saveCurrentGame();
      }
    });
    document.getElementById('pause-new').addEventListener('click', () => {
      closePause();
      renderLayoutsGrid();
      showScreen('layouts');
    });
    document.getElementById('pause-menu').addEventListener('click', () => {
      closePause();
      saveCurrentGame();
      showScreen('menu');
    });

    // Победа
    document.getElementById('win-again').addEventListener('click', () => {
      const state = Game.getState();
      if (state) {
        Game.newGame(state.layout);
        Render.fitBoard(state.layout);
        Render.renderFull();
        Render.highlightFree(Storage.getSetting('highlight', true));
        updateGameInfo();
        showScreen('game');
        startTimer();
        lastActionTime = Date.now();
        scheduleAutohint();
      }
    });
    document.getElementById('win-next').addEventListener('click', () => {
      const state = Game.getState();
      if (state && state.mode === 'endless') {
        // Счёт сохраняем, переходим к следующей раскладке
        const prevScore = state.score;
        const prevHints = state.hintsUsed;
        const prevShuffles = state.shufflesUsed;
        const endlessLevel = state.endlessLevel + 1;
        startEndlessRound(endlessLevel);
        // Переносим накопленный счёт
        const newState = Game.getState();
        newState.score = prevScore + 50; // бонус за победу
        newState.hintsUsed = prevHints;
        newState.shufflesUsed = prevShuffles;
        updateGameInfo();
      }
    });
    document.getElementById('win-menu').addEventListener('click', () => {
      showScreen('menu');
    });

    // Темы
    document.querySelectorAll('.theme-card').forEach(c => {
      c.addEventListener('click', () => applyTheme(c.dataset.theme));
    });

    // Размер фишек
    document.querySelectorAll('.size-card').forEach(c => {
      c.addEventListener('click', () => applyTileSize(c.dataset.size));
    });

    // Звук
    document.getElementById('setting-sound').addEventListener('change', e => {
      Storage.setSetting('sound', e.target.checked);
      Audio2.setEnabled(e.target.checked);
      if (e.target.checked) Audio2.click();
    });
    document.getElementById('setting-win-sound').addEventListener('change', e => {
      Storage.setSetting('winSound', e.target.checked);
      Audio2.setWinEnabled(e.target.checked);
    });
    document.getElementById('setting-highlight').addEventListener('change', e => {
      Storage.setSetting('highlight', e.target.checked);
      if (currentScreen === 'game') {
        Render.clearHighlight();
        if (e.target.checked) Render.highlightFree(true);
      }
    });
    document.getElementById('setting-autohint').addEventListener('change', e => {
      Storage.setSetting('autohint', e.target.checked);
      if (e.target.checked) scheduleAutohint();
      else clearTimeout(hintTimer);
    });

    // Сброс статистики
    document.getElementById('setting-reset-stats').addEventListener('click', () => {
      if (confirm('Сбросить всю статистику? Это действие нельзя отменить.')) {
        Storage.resetStats();
        updateMenuStats();
        toast('Статистика сброшена');
      }
    });

    // Ресайз
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // Следим за самим контейнером доски — PWA/зум/док-панели
    const stage = document.getElementById('board-stage');
    if (stage && 'ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(stage);
    }

    // Клавиатура
    document.addEventListener('keydown', e => {
      if (currentScreen !== 'game') return;
      const pauseEl = document.getElementById('pause-overlay');
      const pauseOpen = pauseEl && !pauseEl.hidden;
      if (e.key === 'Escape') {
        if (pauseOpen) closePause(); else openPause();
        return;
      }
      // Игровые действия заблокированы, пока открыта пауза
      if (pauseOpen) return;
      if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') actHint();
      if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') actShuffle();
      if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') actUndo();
    });
  }

  return { init, onTileClick };
})();

// Запуск приложения
document.addEventListener('DOMContentLoaded', App.init);
