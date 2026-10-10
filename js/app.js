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
      // v9: Game.resume() вместо прямого st.paused = false —
      // заодно корректно перезапускает игровые часы
      if (st && !st.ended) Game.resume();
      // Пересчитать под текущий размер экрана.
      // Двойной rAF: ждём реальную отрисовку экрана — измерения
      // надёжнее, чем старый setTimeout(50).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => Render.reposition());
      });
    }
  }

  // ---------- Пульс значения при изменении (v8) ----------
  // Счёт/пары/ходы в шапке и статистика в меню «подпрыгивают»,
  // когда меняются — глаз сразу видит, ЧТО именно обновилось.
  function bumpValue(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('bump');
  }
  function setTextBumped(el, value) {
    if (!el) return;
    const text = String(value);
    if (el.textContent !== text) {
      el.textContent = text;
      bumpValue(el);
    }
  }

  // ---------- Виброотклик на мобильных (v9) ----------
  // Мягкий короткий отклик на матч/победу; на десктопе тихо игнорируется
  function buzz(ms) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch (e) { /* вибрация недоступна — не страшно */ }
  }

  function updateMenuStats() {
    const stats = Storage.getStats();
    setTextBumped(document.getElementById('stat-played'), stats.played);
    setTextBumped(document.getElementById('stat-won'), stats.won);
    setTextBumped(document.getElementById('stat-best'), stats.bestScore);
    // v9: рекорд времени (— если побед ещё нет)
    const bt = stats.bestTime;
    setTextBumped(document.getElementById('stat-best-time'),
      (bt === null || bt === undefined) ? '—' : formatTime(Number(bt) || 0));
    // Кнопка «Продолжить» видна только если есть сохранённая игра
    document.getElementById('btn-continue').hidden = !Storage.hasSavedGame();
  }

  // ---------- Достижения (v11) ----------
  // Тост по каждому новому достижению с интервалом, чтобы
  // несколько сразу не съедали друг друга
  function announceAchievements(ids) {
    const list = Array.isArray(ids) ? ids : [];
    list.forEach((id, i) => {
      const a = Achievements.getById(id);
      if (!a) return;
      setTimeout(() => toast('Достижение: «' + a.name + '»'), i * 1400);
    });
  }

  // ---------- Запуск классической игры ----------
  function startClassic(layoutId) {
    const layout = Layouts.getById(layoutId);
    if (!layout) return;
    Game.newGame(layout);
    Render.fitBoard(layout);
    Render.renderFull();
    Render.playDealAnimation(); // v8: каскадная раздача
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
    Render.playDealAnimation(); // v8: каскадная раздача
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
      buzz(8); // v9: мягкий виброотклик «сюда нельзя»
      return;
    }

    if (result === 'selected') {
      Audio2.click();
      Render.setSelected(tile);
    } else if (result === 'deselected') {
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
          announceAchievements(comboUnlocked);
        }
      } else {
        Audio2.match();
      }
      buzz(12); // v9
      Render.animateRemove([last.tile1, last.tile2]);
      Render.setSelected(null);
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
          Render.playDealAnimation(); // v8
          Render.pulseTable();        // v8: стол вздрагивает
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
    buzz(40); // v9: заметный виброотклик победы
    stopTimer();
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
    document.getElementById('win-time').textContent = formatTime(time);
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
    } else {
      nextBtn.hidden = true;
      document.getElementById('win-text').textContent =
        `«${state.layout.name}» собрана!`;
    }

    showScreen('win');
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
        '<span class="win-ach-icon">' + a.icon + '</span>' +
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
    Render.playDealAnimation(); // v8: фишки пересыпаются волной
    Render.pulseTable();        // v8: стол вздрагивает
    Render.highlightFree(Storage.getSetting('highlight', true));
    updateGameInfo();
    Audio2.shuffleSound();
    lastActionTime = Date.now();
    saveCurrentGame();
  }

  function actUndo() {
    if (Game.undo()) {
      Render.renderFull();
      Render.playDealAnimation({ fast: true }); // v8: фишки быстро возвращаются
      Render.highlightFree(Storage.getSetting('highlight', true));
      updateGameInfo();
      Audio2.click();
      lastActionTime = Date.now();
      saveCurrentGame();
    } else {
      // v9: раньше кнопка молчала — непонятно, сработало ли
      toast('Нечего отменять');
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
    setTextBumped(document.getElementById('game-score'), state.score);
    setTextBumped(document.getElementById('game-pairs'),
      `${state.pairsFound}/${state.totalPairs}`);
    // Счётчик ходов: сколько пар ещё можно собрать прямо сейчас
    setTextBumped(document.getElementById('game-moves'), countAvailableMoves());
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
      toast('Сохранение устарело — начинаем заново');
    }

    state.selected = null;
    state.history = state.history || []; // уже восстановлена, если сейв валиден
    Game.resume(); // часы пошли заново (или с восстановленного места)

    Render.fitBoard(layout);
    Render.renderFull();
    Render.playDealAnimation(); // v8: каскадная раздача при продолжении
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
    // v9: сколько раз каждая раскладка собрана — золотой бейдж на карточке
    const winsByLayout = Storage.getStats().layouts || {};
    Layouts.all.forEach((layout, index) => {
      const card = document.createElement('button');
      card.className = 'layout-card';
      card.style.setProperty('--i', index); // v8: каскад появления карточек
      const wins = Number(winsByLayout[layout.id]) || 0;
      card.innerHTML = `
        <div class="layout-preview" data-layout="${layout.id}">
          ${wins > 0 ? `<span class="layout-wins" title="Собрано раз: ${wins}">✓ ${wins}</span>` : ''}
        </div>
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

    // v9: стираем только мини-фишки — бейдж «✓ N» внутри превью
    // должен переживать перерисовку (первый показ и resize)
    container.querySelectorAll('.preview-tile').forEach(d => d.remove());
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
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('toast-out'); // v8: перезапуск, если тост уже уходит
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      // v8: мягкий уход вместо мгновенного скрытия
      el.classList.add('toast-out');
      setTimeout(() => {
        el.hidden = true;
        el.classList.remove('toast-out');
      }, 280);
    }, 2500);
  }

  // ---------- Настройки ----------
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    Storage.setSetting('theme', theme);
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === theme);
    });
    // v10: у каждой темы свой музыкальный лад
    Music.setTheme(theme);
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

  // ---------- Прозрачность фишек (v6) ----------
  // Слайдер в настройках: 0% — фишки плотные (ничего не просвечивает),
  // до 50% — закрытые фишки «стеклянные». Пишется в Storage и применяется
  // через CSS-переменную на доске — мгновенно, даже прямо посреди партии.
  function applyTileTransparency(pct, opts = {}) {
    const clamped = Render.setTileTransparency(pct);
    if (opts.persist !== false) {
      Storage.setSetting('tileTransparency', clamped);
    }
    const out = document.getElementById('setting-tile-transparency-out');
    const slider = document.getElementById('setting-tile-transparency');
    if (out) out.textContent = clamped + '%';
    if (slider) {
      slider.value = String(clamped);
      // Заливка трека слайдера до текущего значения
      const max = Render.TRANSPARENCY_MAX || 50;
      slider.style.setProperty('--range-fill', (clamped / max * 100) + '%');
    }
  }

  // ---------- Фоновая музыка (v10) ----------
  // Тумблер и громкость в настройках, дублирующая кнопка в паузе.
  // Настройка пишется в Storage и мгновенно применяется к движку.
  function updatePauseMusicLabel() {
    const btn = document.getElementById('pause-music');
    if (!btn) return;
    btn.textContent = 'Музыка: ' + (Storage.getSetting('music', true) ? 'вкл' : 'выкл');
  }

  function applyMusicEnabled(v, opts = {}) {
    if (opts.persist !== false) Storage.setSetting('music', !!v);
    Music.setEnabled(!!v);
    const cb = document.getElementById('setting-music');
    if (cb) cb.checked = !!v;
    updatePauseMusicLabel();
  }

  function applyMusicVolume(pct, opts = {}) {
    const p = Music.clampVolume(pct);
    if (opts.persist !== false) Storage.setSetting('musicVolume', p);
    Music.setVolume(p);
    const out = document.getElementById('setting-music-volume-out');
    const slider = document.getElementById('setting-music-volume');
    if (out) out.textContent = p + '%';
    if (slider) {
      slider.value = String(p);
      // Заливка трека слайдера до текущего значения
      slider.style.setProperty('--range-fill', p + '%');
    }
  }

  function loadSettings() {
    applyTheme(Storage.getSetting('theme', 'traditional'));
    applyTileSize(Storage.getSetting('tileSize', 'large'));
    // Прозрачность по умолчанию 0% — фишки плотные (регрессия v5: было 0.88)
    applyTileTransparency(Storage.getSetting('tileTransparency', 0), { persist: false });
    // v10: музыка — тумблер, громкость и заливка слайдера
    applyMusicEnabled(Storage.getSetting('music', true), { persist: false });
    applyMusicVolume(Storage.getSetting('musicVolume', Music.VOLUME_DEFAULT), { persist: false });
    document.getElementById('setting-sound').checked = Storage.getSetting('sound', true);
    document.getElementById('setting-win-sound').checked = Storage.getSetting('winSound', true);
    document.getElementById('setting-highlight').checked = Storage.getSetting('highlight', true);
    document.getElementById('setting-autohint').checked = Storage.getSetting('autohint', false);
  }

  // ---------- Пауза ----------
  function openPause() {
    const state = Game.getState();
    if (!state || state.ended) return;
    Game.pause(); // v9: флаг + честная остановка часов
    // v10: музыка приглушается — но не выключается
    Music.duck(true);
    // v9: сводка на карточке паузы — счёт и время видно без выхода из паузы
    const sEl = document.getElementById('pause-score');
    const tEl = document.getElementById('pause-time');
    if (sEl) sEl.textContent = state.score;
    if (tEl) tEl.textContent = formatTime(Game.getElapsedSeconds());
    updatePauseMusicLabel();
    document.getElementById('pause-overlay').hidden = false;
    cancelAutohint();
  }
  function closePause() {
    document.getElementById('pause-overlay').hidden = true;
    Game.resume(); // v9
    Music.duck(false); // v10: возвращаем громкость
    lastActionTime = Date.now();
    scheduleAutohint();
  }

  // ---------- Полный экран (v9) ----------
  // Кнопка в карточке паузы. Без поддержки API — кнопка скрывается.
  function fullscreenAvailable() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }
  function toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    const fsEl = d.fullscreenElement || d.webkitFullscreenElement;
    if (fsEl) {
      const exit = d.exitFullscreen || d.webkitExitFullscreen;
      if (exit) exit.call(d);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        // Отказ (нет жеста пользователя, запрет iframe и т.п.) не роняет страницу
        const p = req.call(el);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    }
  }
  function updateFullscreenLabel() {
    const btn = document.getElementById('pause-fullscreen');
    if (!btn) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    btn.textContent = fsEl ? 'Обычный экран' : 'Полный экран';
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

  // ---------- Золотая пыль (v10) ----------
  // Медленно поднимающиеся золотые искры в меню — глубина и «богатство».
  // CSS-анимация, reduced-motion гасит глобально (main.css).
  function initGoldDust() {
    const container = document.getElementById('menu-dust');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const mote = document.createElement('span');
      mote.className = 'dust-mote';
      mote.style.left = (Math.random() * 100) + '%';
      mote.style.bottom = (-10 - Math.random() * 20) + '%';
      mote.style.animationDuration = (14 + Math.random() * 14) + 's';
      mote.style.animationDelay = (-Math.random() * 24) + 's';
      const size = 2 + Math.random() * 4;
      mote.style.width = size.toFixed(1) + 'px';
      mote.style.height = size.toFixed(1) + 'px';
      mote.style.setProperty('--dx', ((Math.random() * 2 - 1) * 60).toFixed(0) + 'px');
      container.appendChild(mote);
    }
  }

  // ---------- Инициализация ----------
  function init() {
    Audio2.init();
    // v10: фоновая музыка — лад берём из сохранённой темы
    Music.init({
      theme: Storage.getSetting('theme', 'traditional'),
      enabled: Storage.getSetting('music', true),
      volumePct: Storage.getSetting('musicVolume', Music.VOLUME_DEFAULT),
    });
    Render.init(document.getElementById('board'));
    loadSettings();
    updateMenuStats();
    initPetals();
    initGoldDust(); // v10

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

    // v12: обучение — кнопка в меню, автопоказ при первом визите,
    // «Играть!» на последнем шаге стартует лёгкую «Пирамиду»
    if (typeof Tutorial !== 'undefined') {
      Tutorial.init({ startGame: () => startClassic('pyramid') });
      const tutBtn = document.getElementById('btn-tutorial');
      if (tutBtn) tutBtn.addEventListener('click', () => Tutorial.open());
      if (!Tutorial.isSeen()) Tutorial.open();
    }

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
    // v9: полноэкранный режим в карточке паузы
    const fsBtn = document.getElementById('pause-fullscreen');
    if (fsBtn) {
      if (fullscreenAvailable()) {
        fsBtn.addEventListener('click', toggleFullscreen);
        ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
          document.addEventListener(ev, updateFullscreenLabel));
      } else {
        fsBtn.hidden = true;
      }
    }
    document.getElementById('pause-restart').addEventListener('click', () => {
      const state = Game.getState();
      if (state) {
        Game.newGame(state.layout);
        Render.fitBoard(state.layout);
        Render.renderFull();
        Render.playDealAnimation(); // v8
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
        Render.playDealAnimation(); // v8
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

    // Прозрачность фишек — живой отклик на движение слайдера
    const transparencySlider = document.getElementById('setting-tile-transparency');
    if (transparencySlider) {
      transparencySlider.addEventListener('input', e => {
        applyTileTransparency(Number(e.target.value));
      });
    }

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

    // v10: фоновая музыка — тумблер, громкость, кнопка в паузе
    document.getElementById('setting-music').addEventListener('change', e => {
      applyMusicEnabled(e.target.checked);
      if (e.target.checked) Audio2.click();
    });
    const musicVolSlider = document.getElementById('setting-music-volume');
    if (musicVolSlider) {
      musicVolSlider.addEventListener('input', e => {
        applyMusicVolume(Number(e.target.value));
      });
    }
    const pauseMusicBtn = document.getElementById('pause-music');
    if (pauseMusicBtn) {
      pauseMusicBtn.addEventListener('click', () => {
        applyMusicEnabled(!Storage.getSetting('music', true));
        Audio2.click();
      });
    }
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
