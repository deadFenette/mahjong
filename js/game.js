/* ============================================================
   GAME.JS — Игровое состояние и логика
   Состояние: фишки на доске, история ходов, счёт
   Логика: какие фишки свободны, можно ли подобрать пару,
           победа, тупик, перемешивание, отмена хода
   ============================================================ */

const Game = (function () {

  // ---------- Комбо (v11) ----------
  // Пары, собранные подряд без паузы дольше COMBO_WINDOW_MS,
  // наращивают серию: второй матч — ×2, третий — ×3 и т.д. до COMBO_MAX.
  // Каждый следующий уровень серии добавляет 5 очков (comboBonusOf).
  const COMBO_WINDOW_MS = 5000;
  const COMBO_MAX = 8;

  // Состояние игры
  // board: { [positionKey]: tileInstance }
  // tileInstance: { id, suit, rank, name, face, x, y, z, removed }
  // history: [{ tile1, tile2, scoreDelta, combo }] для отмены
  // combo/lastMatchAt (v11): текущая серия и момент прошлого матча
  // undosUsed (v11): для достижения «Чистая победа»
  // Игровые часы (v9): playedMs — накопленное время игры,
  // resumedAt — метка текущего отрезка (null = часы стоят).
  // Пауза теперь ЧЕСТНО останавливает время: раньше интервал
  // продолжал считать секунды под оверлеем паузы.
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
      combo: 0,
      lastMatchAt: null,
      undosUsed: 0,
      startTime: Date.now(), // легаси (сейвы до v9); время теперь в playedMs/resumedAt
      playedMs: 0,
      resumedAt: Date.now(),
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

  // ---------- Комбо: чистые функции (v11) ----------
  // Множитель серии: прошлый матч был в окне → prevCombo+1 (потолок COMBO_MAX),
  // иначе/мусор/перескок часов назад → 1.
  function comboMultiplierFor(lastMatchAt, now, prevCombo, windowMs) {
    const w = Number(windowMs);
    const window = Number.isFinite(w) && w > 0 ? w : COMBO_WINDOW_MS;
    const prev = Number(prevCombo);
    const base = Number.isInteger(prev) && prev >= 1 ? prev : 1;
    if (lastMatchAt === null || lastMatchAt === undefined) return 1;
    const l = Number(lastMatchAt);
    const n = Number(now);
    if (!Number.isFinite(l) || !Number.isFinite(n)) return 1;
    const diff = n - l;
    if (diff < 0 || diff > window) return 1;
    return Math.min(base + 1, COMBO_MAX);
  }

  // Бонус очков серии: ×1 → 0, ×2 → 5, … ×8 → 35. Мусор → 0.
  function comboBonusOf(multiplier) {
    const m = Number(multiplier);
    if (!Number.isInteger(m) || m < 2) return 0;
    return (Math.min(m, COMBO_MAX) - 1) * 5;
  }

  // ---------- Выбрать фишку ----------
  // Возвращает: 'selected' | 'matched' | 'mismatched' | 'notfree'
  // nowMs — точка времени для тестов (по умолчанию Date.now())
  function selectTile(inst, nowMs) {
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
      // v11: серия подряд наращивает множитель и бонус очков
      const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
      const mult = comboMultiplierFor(state.lastMatchAt, now, state.combo);
      state.combo = mult;
      state.lastMatchAt = now;
      const delta = 10 + bonusScore() + comboBonusOf(mult);
      state.history.push({ tile1: first, tile2: second, scoreDelta: delta, combo: mult });
      state.score += delta;
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
  // v11: отмена сбрасывает серию (честно: откатил ход — комбо заново)
  // и считается в undosUsed для достижения «Чистая победа»
  function undo() {
    if (state.history.length === 0) return false;
    const last = state.history.pop();
    last.tile1.removed = false;
    last.tile2.removed = false;
    state.score = Math.max(0, state.score - last.scoreDelta);
    state.pairsFound = Math.max(0, state.pairsFound - 1);
    state.selected = null;
    state.combo = 0;
    state.lastMatchAt = null;
    state.undosUsed += 1;
    return true;
  }

  // ---------- Перемешать оставшиеся фишки ----------
  // v5: БЕЗ рекурсии! Раньше shuffleBoard вызывала сама себя при тупике,
  // а если среди оставшихся фишек не было ни одной совпадающей пары
  // (бывает в эндшпиле) — бесконечная рекурсия роняла игру
  // («Maximum call stack size exceeded»).
  // Теперь: цикл «случайные расстановки → посадка готовой пары на
  // свободные места → при полном отсутствии совпадений копируем
  // личность одной фишки на другую». Ходы появляются гарантированно.
  function shuffleBoard(countAsUse = true) {
    const remaining = state.tiles.filter(t => !t.removed);
    if (remaining.length === 0) return false;

    for (let round = 0; round < 3; round++) {
      if (findArrangementWithMove(remaining)) break;
      // Совпадающих пар нет вообще — меняем личность одной фишки,
      // чтобы партия гарантированно могла продолжиться
      rescueByCopyingIdentity(remaining);
    }

    state.selected = null;
    if (countAsUse) state.shufflesUsed += 1;
    return true;
  }

  // Случайные расстановки + конструктивная посадка пары.
  // Возвращает true, если в итоге ход есть.
  function findArrangementWithMove(remaining) {
    let positions = remaining.map(t => ({ x: t.x, y: t.y, z: t.z }));

    // Деградировавший набор позиций чиним ДО перебора: если последние
    // фишки стоят друг на друге — ни одна расстановка лиц не даст ход
    const repaired = repairPositionSet(positions);
    if (repaired) positions = repaired;

    for (let attempt = 0; attempt < 300; attempt++) {
      applyArrangement(remaining, shuffle(positions.slice()));
      if (hasAnyMove()) return true;
    }

    // Случайные переборы не помогли. Если пара совпадающих фишек есть —
    // сажаем её прямо на свободные места (проверяем результат).
    return seatMatchingPairOnFreeSpots(remaining, positions);
  }

  // Чинит деградировавший набор позиций. Классика эндшпиля: остались
  // две фишки, и одна НАКРЫВАЕТ другую — свободна только одна, ходов
  // нет и не будет при любом раскладе лиц. Переносим накрытую позицию
  // в свободную «дырку» раскладки (позиция, которую никто не накрывает).
  // Возвращает исправленный набор или null, если всё в порядке.
  function repairPositionSet(positions) {
    if (positions.length < 2) return null;
    if (freeSpotsCount(positions) >= 2) return null; // норм

    const layout = state.layout;
    const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
    let fixed = positions.slice();

    for (let guard = 0; guard < 50 && freeSpotsCount(fixed) < 2; guard++) {
      // накрытая позиция — та, над которой стоит другая оставшаяся
      const covered = fixed.find(p =>
        fixed.some(q => q !== p && q.z === p.z + 1 &&
          Math.abs(q.x - p.x) < 0.75 && Math.abs(q.y - p.y) < 0.75));
      if (!covered) break;
      // свободная дырка: позиция раскладки, свободная сейчас и не занятая
      const hole = layout.positions.find(p =>
        !fixed.some(q => same(q, p)) &&
        spotIsFree(fixed.filter(q => q !== covered).concat([p]), p));
      if (!hole) break;
      fixed = fixed.map(q => q === covered
        ? { x: hole.x, y: hole.y, z: hole.z } : q);
    }
    return freeSpotsCount(fixed) >= 2 ? fixed : null;
  }

  function freeSpotsCount(spots) {
    return spots.filter(p => spotIsFree(spots, p)).length;
  }

  function applyArrangement(remaining, arrangement) {
    remaining.forEach(t => { delete state.board[key(t.x, t.y, t.z)]; });
    remaining.forEach((t, i) => {
      const p = arrangement[i];
      t.x = p.x; t.y = p.y; t.z = p.z;
      state.board[key(p.x, p.y, p.z)] = t;
    });
  }

  function rebuildBoardKeys(remaining) {
    remaining.forEach(t => { delete state.board[key(t.x, t.y, t.z)]; });
    remaining.forEach(t => { state.board[key(t.x, t.y, t.z)] = t; });
  }

  // Первая найденная пара совпадающих фишек среди remaining
  function firstMatchingPair(tiles) {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (Tileset.isMatch(tiles[i], tiles[j])) return [tiles[i], tiles[j]];
      }
    }
    return null;
  }

  // Геометрия свободной позиции — та же, что в isFree, но для места
  function spotIsFree(spots, spot) {
    const covered = spots.some(o =>
      o !== spot && o.z === spot.z + 1 &&
      Math.abs(o.x - spot.x) < 0.75 && Math.abs(o.y - spot.y) < 0.75);
    if (covered) return false;
    let left = false;
    let right = false;
    for (const o of spots) {
      if (o === spot || o.z !== spot.z) continue;
      if (Math.abs(o.y - spot.y) > 0.75) continue;
      const dx = o.x - spot.x;
      if (dx < -0.25 && dx > -1.75) left = true;
      else if (dx > 0.25 && dx < 1.75) right = true;
    }
    return !(left && right);
  }

  // Посадить пару совпадающих фишек на фактически свободные позиции.
  // В любой расстановке свободных позиций не меньше двух
  // (верхний слой: крайние левая-верхняя и правая-нижняя фишки),
  // поэтому рано или поздно пара встанет на места и останется свободной.
  function seatMatchingPairOnFreeSpots(remaining, positions) {
    const pair = firstMatchingPair(remaining);
    if (!pair) return false;

    for (let attempt = 0; attempt < 80; attempt++) {
      applyArrangement(remaining, shuffle(positions.slice()));
      const spots = remaining.filter(t => spotIsFree(remaining, t));
      if (spots.length < 2) continue;
      swapTileToSpot(remaining, pair[0], spots[0]);
      swapTileToSpot(remaining, pair[1], spots[1]);
      rebuildBoardKeys(remaining);
      if (hasAnyMove()) return true;
      // Перестановка сломала свободу — пробуем другую расстановку
    }
    return false;
  }

  // Обменять фишку местами с той, что стоит на spot (по координатам)
  function swapTileToSpot(remaining, tile, spot) {
    const occupant = remaining.find(o =>
      o !== tile && o.x === spot.x && o.y === spot.y && o.z === spot.z);
    const old = { x: tile.x, y: tile.y, z: tile.z };
    tile.x = spot.x; tile.y = spot.y; tile.z = spot.z;
    if (occupant) {
      occupant.x = old.x; occupant.y = old.y; occupant.z = old.z;
    }
  }

  // Эндшпиль без единой пары (все партнёры собраны раньше):
  // копируем масть/ранг/лицо одной фишки на другую —
  // совпадающая пара появляется, партия продолжается.
  function rescueByCopyingIdentity(remaining) {
    if (remaining.length < 2) return;
    const src = remaining[0];
    const dst = remaining.find(t =>
      t !== src && (t.suit !== src.suit || t.rank !== src.rank));
    if (!dst) return;
    dst.suit = src.suit;
    dst.rank = src.rank;
    dst.name = src.name;
    dst.face = src.face;
  }

  // ============================================================
  //  ИГРОВЫЕ ЧАСЫ (v9)
  // ============================================================

  // Чистая функция: суммарные секунды из накопленного времени и
  // текущего отрезка. resumedAt = null — пауза/победа, отрезка нет.
  // Мусор в аргументах трактуется как ноль — никогда не NaN.
  function elapsedSecondsOf(playedMs, resumedAt, now) {
    const played = Number(playedMs);
    const base = Number.isFinite(played) && played > 0 ? played : 0;
    let extra = 0;
    if (resumedAt !== null && resumedAt !== undefined) {
      const r = Number(resumedAt);
      const n = Number(now);
      if (Number.isFinite(r) && Number.isFinite(n) && n > r) extra = n - r;
    }
    return Math.floor((base + extra) / 1000);
  }

  function pauseClock() {
    if (!state || state.resumedAt === null) return;
    state.playedMs += Date.now() - state.resumedAt;
    state.resumedAt = null;
  }

  function resumeClock() {
    if (!state || state.resumedAt !== null) return;
    state.resumedAt = Date.now();
  }

  // Пауза: флаг для игровой логики + остановка часов
  function pause() {
    if (!state || state.ended) return;
    state.paused = true;
    pauseClock();
  }

  function resume() {
    if (!state || state.ended) return;
    state.paused = false;
    resumeClock();
  }

  // Восстановление времени из сейва (v9): секунды игры продолжаются
  function setElapsedMs(ms) {
    if (!state) return;
    const n = Number(ms);
    state.playedMs = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    state.resumedAt = null; // resumeClock() вызовет App после загрузки
  }

  function getElapsedMs() {
    if (!state) return 0;
    return state.playedMs +
      (state.resumedAt === null ? 0 : Math.max(0, Date.now() - state.resumedAt));
  }

  // ---------- Завершить игру (для бесконечного — начать новый уровень) ----------
  function markWon() {
    pauseClock(); // фиксируем финальное время — после победы часы не идут
    state.endTime = Date.now();
    state.ended = true;
  }

  // ---------- Подсчёт времени ----------
  function getElapsedSeconds() {
    if (!state) return 0;
    return elapsedSecondsOf(state.playedMs, state.resumedAt, Date.now());
  }

  // ============================================================
  //  ИСТОРИЯ ХОДОВ: СЕРИАЛИЗАЦИЯ ДЛЯ СЕЙВА (v9)
  //  Раньше после «Продолжить» отменять было нечего — история
  //  терялась. Теперь пишем в сейв индексы пар в стабильном
  //  массиве state.tiles (порядок никогда не меняется —
  //  перемешивание двигает только координаты).
  // ============================================================

  // Чистая: [{tile1, tile2, scoreDelta}] → [{a, b, d}] (индексы).
  // Комбо в сейв не пишем: после «Продолжить» серия начинается заново.
  function serializeHistory(items, tiles) {
    const arr = Array.isArray(items) ? items : [];
    const ts = Array.isArray(tiles) ? tiles : [];
    return arr.map(h => ({
      a: ts.indexOf(h && h.tile1),
      b: ts.indexOf(h && h.tile2),
      d: h && Number.isFinite(Number(h.scoreDelta)) ? Number(h.scoreDelta) : 10,
    }));
  }

  // Чистая: [{a, b, d}] → [{tile1, tile2, scoreDelta}]. Мусор фильтруется:
  // не-индексы, выход за границы, самопары — молча пропускаются.
  function deserializeHistory(list, tiles) {
    const ts = Array.isArray(tiles) ? tiles : [];
    const out = [];
    if (!Array.isArray(list)) return out;
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const a = Number(item.a);
      const b = Number(item.b);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return;
      if (a < 0 || b < 0 || a >= ts.length || b >= ts.length || a === b) return;
      const d = Number(item.d);
      out.push({
        tile1: ts[a],
        tile2: ts[b],
        scoreDelta: Number.isFinite(d) ? d : 10,
      });
    });
    return out;
  }

  // Восстановить историю в текущее состояние (из сейва)
  function restoreHistory(list) {
    if (!state) return;
    state.history = deserializeHistory(list, state.tiles);
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
    // комбо (v11)
    comboMultiplierFor,
    comboBonusOf,
    COMBO_WINDOW_MS,
    COMBO_MAX,
    // игровые часы (v9)
    pause,
    resume,
    setElapsedMs,
    getElapsedMs,
    elapsedSecondsOf,
    // история отмены для сейва (v9)
    serializeHistory,
    deserializeHistory,
    restoreHistory,
  };
})();
