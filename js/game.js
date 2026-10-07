/* ============================================================
   GAME.JS — Игровое состояние и логика
   Состояние: фишки на доске, история ходов, счёт
   Логика: какие фишки свободны, можно ли подобрать пару,
           победа, тупик, перемешивание, отмена хода
   ============================================================ */

const Game = (function () {

  // Состояние игры
  // board: { [positionKey]: tileInstance }
  // tileInstance: { id, suit, rank, name, face, x, y, z, removed }
  // history: [{ tile1, tile2, score }] для отмены
  let state = null;

  // ---------- Ключ позиции в Map ----------
  // Используем округление до пол-фишки (×2) — это позволяет работать
  // с дробными координатами (когда слои центрированы по Y).
  function key(x, y, z) {
    return `${Math.round(x * 2)},${Math.round(y * 2)},${z}`;
  }

  // ---------- Создать новую игру ----------
  // layout — раскладка из Layouts
  // seed — для воспроизводимости (если не задан — случайно)
  function newGame(layout, seed) {
    const positions = layout.positions;
    const count = positions.length;

    // Берём подмножество фишек из полного тайлсета так, чтобы получилось чётное число
    // и количество совпадало с позициями
    let pool = Tileset.tiles.slice();

    pool = shuffle(pool, seed);
    if (count > pool.length) {
      while (pool.length < count) pool = pool.concat(Tileset.tiles.slice());
    }
    const usedTiles = pool.slice(0, count);

    // Создаём инстансы
    const board = {};
    const tileInstances = [];

    const shuffledPositions = shuffle(positions.slice(), seed ? seed + 1 : undefined);

    const pairs = [];
    for (let i = 0; i < usedTiles.length; i += 2) {
      pairs.push([usedTiles[i], usedTiles[i + 1]]);
    }

    for (let i = 0; i < pairs.length; i++) {
      const pos1 = shuffledPositions[i];
      const pos2 = shuffledPositions[shuffledPositions.length - 1 - i];
      const [t1, t2] = pairs[i];
      const inst1 = { ...t1, x: pos1.x, y: pos1.y, z: pos1.z, removed: false };
      const inst2 = { ...t2, x: pos2.x, y: pos2.y, z: pos2.z, removed: false };
      board[key(pos1.x, pos1.y, pos1.z)] = inst1;
      board[key(pos2.x, pos2.y, pos2.z)] = inst2;
      tileInstances.push(inst1, inst2);
    }

    state = {
      layout: layout,
      board: board,
      tiles: tileInstances,
      selected: null,
      score: 0,
      pairsFound: 0,
      totalPairs: Math.floor(count / 2),
      hintsUsed: 0,
      shufflesUsed: 0,
      history: [],
      startTime: Date.now(),
      endTime: null,
      paused: false,
      ended: false,
      mode: 'classic',
      endlessLevel: 0,
    };

    if (!hasAnyMove()) {
      shuffleBoard(false);
    }

    return state;
  }

  // ---------- Свободна ли фишка? ----------
  // Фишка свободна, если:
  //   1. Никто не лежит прямо сверху (z+1 в той же позиции x,y ± 0.5)
  //   2. Нет фишки слева (x-1, тот же y, тот же z) ИЛИ
  //      нет фишки справа (x+1, тот же y, тот же z)
  // Используем "расстояние" вместо точного совпадения, т.к. координаты
  // могут быть дробными (при центрировании слоёв разной ширины).
  function isFree(inst) {
    if (!inst || inst.removed) return false;
    const { x, y, z } = inst;

    // 1. Сверху — ищем фишку на z+1, с близкими x, y
    for (const t of state.tiles) {
      if (t.removed) continue;
      if (t.z !== z + 1) continue;
      if (Math.abs(t.x - x) < 0.75 && Math.abs(t.y - y) < 0.75) return false;
    }

    // 2. Сосед слева и справа на том же z
    let leftBlocked = false;
    let rightBlocked = false;
    for (const t of state.tiles) {
      if (t.removed) continue;
      if (t.z !== z) continue;
      if (Math.abs(t.y - y) > 0.75) continue;
      const dx = t.x - x;
      if (dx < -0.25 && dx > -1.75) leftBlocked = true;
      else if (dx > 0.25 && dx < 1.75) rightBlocked = true;
      if (leftBlocked && rightBlocked) return false;
    }
    return true;
  }

  // ---------- Найти все свободные фишки ----------
  function getFreeTiles() {
    return state.tiles.filter(t => !t.removed && isFree(t));
  }

  // ---------- Есть ли хотя бы одна пара? ----------
  function hasAnyMove() {
    const free = getFreeTiles();
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (Tileset.isMatch(free[i], free[j])) return true;
      }
    }
    return false;
  }

  // ---------- Найти подсказку (первую доступную пару) ----------
  function findHint() {
    const free = getFreeTiles();
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (Tileset.isMatch(free[i], free[j])) return [free[i], free[j]];
      }
    }
    return null;
  }

  // ---------- Выбрать фишку ----------
  // Возвращает: 'selected' | 'matched' | 'mismatched' | 'notfree'
  function selectTile(inst) {
    if (state.ended) return 'ended';
    if (!isFree(inst)) return 'notfree';

    if (!state.selected) {
      state.selected = inst;
      return 'selected';
    }

    // Уже была выбрана
    if (state.selected === inst) {
      // Сняли выделение
      state.selected = null;
      return 'deselected';
    }

    if (Tileset.isMatch(state.selected, inst)) {
      // Совпадение!
      const first = state.selected;
      const second = inst;
      first.removed = true;
      second.removed = true;
      state.history.push({ tile1: first, tile2: second, scoreDelta: 10 + bonusScore() });
      state.score += 10 + bonusScore();
      state.pairsFound += 1;
      state.selected = null;
      return 'matched';
    }

    // Не совпало — заменяем выбор
    state.selected = inst;
    return 'mismatched';
  }

  function bonusScore() {
    // Бонус за скорость (больше, если мало подсказок и перемешиваний)
    const hintsPenalty = state.hintsUsed * 2;
    const shufflesPenalty = state.shufflesUsed * 3;
    return Math.max(0, 5 - hintsPenalty - shufflesPenalty);
  }

  // ---------- Победа? ----------
  function isWon() {
    return state.tiles.every(t => t.removed);
  }

  // ---------- Отменить последний ход ----------
  function undo() {
    if (state.history.length === 0) return false;
    const last = state.history.pop();
    last.tile1.removed = false;
    last.tile2.removed = false;
    state.score = Math.max(0, state.score - last.scoreDelta);
    state.pairsFound = Math.max(0, state.pairsFound - 1);
    state.selected = null;
    return true;
  }

  // ---------- Перемешать оставшиеся фишки ----------
  function shuffleBoard(countAsUse = true) {
    const remaining = state.tiles.filter(t => !t.removed);
    if (remaining.length === 0) return false;

    // Сохраняем позиции, перемешиваем фишки
    const positions = remaining.map(t => ({ x: t.x, y: t.y, z: t.z }));
    const shuffledPos = shuffle(positions.slice());

    // Очищаем старые ключи
    remaining.forEach(t => { delete state.board[key(t.x, t.y, t.z)]; });

    // Назначаем новые позиции, но так чтобы пары были разнесены
    // (упрощённо — просто случайно)
    const tilesShuffled = shuffle(remaining.slice());
    tilesShuffled.forEach((t, i) => {
      const p = shuffledPos[i];
      t.x = p.x; t.y = p.y; t.z = p.z;
      state.board[key(p.x, p.y, p.z)] = t;
    });

    state.selected = null;
    if (countAsUse) state.shufflesUsed += 1;

    // Если всё равно тупик — повторим
    if (!hasAnyMove() && remaining.length > 0) {
      return shuffleBoard(false);
    }
    return true;
  }

  // ---------- Завершить игру (для бесконечного — начать новый уровень) ----------
  function markWon() {
    state.endTime = Date.now();
    state.ended = true;
  }

  // ---------- Подсчёт времени ----------
  function getElapsedSeconds() {
    if (!state) return 0;
    const end = state.endTime || Date.now();
    return Math.floor((end - state.startTime) / 1000);
  }

  // ---------- Получить состояние ----------
  function getState() { return state; }

  // ---------- Утилита: shuffle (Fisher–Yates) ----------
  function shuffle(arr, seed) {
    let s = seed || (Date.now() & 0xffffffff);
    // Простой LCG для воспроизводимости
    function rand() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    }
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return {
    newGame,
    isFree,
    getFreeTiles,
    hasAnyMove,
    findHint,
    selectTile,
    isWon,
    undo,
    shuffleBoard,
    markWon,
    getElapsedSeconds,
    getState,
    key,
  };
})();
