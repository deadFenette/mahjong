/* ============================================================
   STORAGE.JS — Сохранение настроек, статистики, текущей игры
   Все данные — в localStorage под префиксом 'mj_'
   ============================================================ */

const Storage = (function () {
  const PREFIX = 'mj_';

  // ---------- Настройки ----------
  const DEFAULT_SETTINGS = {
    theme: 'traditional',
    sound: true,
    winSound: true,
    highlight: true,
    autohint: false,   // ← OFF по умолчанию (пользователь просил отключаемой)
    tileSize: 'large', // «Максимальные» — по умолчанию, для слабовидящих
    tileTransparency: 0, // v6: 0% — фишки плотные, ничего не просвечивает (для слабовидящих важно)
    music: true,       // v10: фоновая музыка включена по умолчанию (тихая)
    musicVolume: 35,   // v10: громкость музыки, % — «тихо и ненавязчиво»
    tutorialSeen: false, // v12: обучение показано при первом визите
  };

  function getSetting(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + 'setting_' + key);
      if (v === null) return fallback !== undefined ? fallback : DEFAULT_SETTINGS[key];
      if (v === 'true') return true;
      if (v === 'false') return false;
      return v;
    } catch (e) {
      return fallback !== undefined ? fallback : DEFAULT_SETTINGS[key];
    }
  }

  function setSetting(key, value) {
    try { localStorage.setItem(PREFIX + 'setting_' + key, String(value)); } catch (e) {}
  }

  // ---------- Статистика ----------
  // layouts (v9): { [layoutId]: сколько раз раскладка собрана } —
  // на карточках галереи рисуется бейдж «✓ N»
  // achievements (v11): { [achievementId]: timestamp разблокировки }
  function emptyStats() {
    return {
      played: 0, won: 0, bestScore: 0, bestTime: null,
      totalPairs: 0, layouts: {}, achievements: {},
    };
  }

  function getStats() {
    try {
      const raw = localStorage.getItem(PREFIX + 'stats');
      if (!raw) return emptyStats();
      const s = JSON.parse(raw);
      // Легаси-статистика без поля layouts чинится на лету
      if (!s.layouts || typeof s.layouts !== 'object' || Array.isArray(s.layouts)) {
        s.layouts = {};
      }
      // v11: то же для достижений
      if (!s.achievements || typeof s.achievements !== 'object' || Array.isArray(s.achievements)) {
        s.achievements = {};
      }
      return s;
    } catch (e) {
      return emptyStats();
    }
  }

  function setStats(stats) {
    try { localStorage.setItem(PREFIX + 'stats', JSON.stringify(stats)); } catch (e) {}
  }

  function addResult({ won, score, time, pairs, layoutId, mode }) {
    const s = getStats();
    s.played += 1;
    if (won) {
      s.won += 1;
      s.totalPairs += pairs;
      if (score > s.bestScore) s.bestScore = score;
      if (s.bestTime === null || time < s.bestTime) s.bestTime = time;
      // Победа раскладки — только в классике: в бесконечном
      // раскладки циклятся, счётчик там ничего не значит
      if (mode !== 'endless' && layoutId) {
        s.layouts[layoutId] = (s.layouts[layoutId] || 0) + 1;
      }
    }
    setStats(s);
    return s;
  }

  function resetStats() {
    setStats(emptyStats());
  }

  // ---------- Достижения (v11) ----------
  // Разблокировать список id (дубликаты и мусор молча пропускаются).
  // Возвращает обновлённую статистику.
  function unlockAchievements(ids) {
    const s = getStats();
    const list = Array.isArray(ids) ? ids : [];
    let changed = false;
    list.forEach(id => {
      if (typeof id === 'string' && id &&
          !Object.prototype.hasOwnProperty.call(s.achievements, id)) {
        s.achievements[id] = Date.now();
        changed = true;
      }
    });
    if (changed) setStats(s);
    return s;
  }

  // ---------- Текущая игра (для "Продолжить") ----------
  function saveGame(stateData) {
    try {
      localStorage.setItem(PREFIX + 'savegame', JSON.stringify(stateData));
    } catch (e) {}
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(PREFIX + 'savegame');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function clearGame() {
    try { localStorage.removeItem(PREFIX + 'savegame'); } catch (e) {}
  }

  function hasSavedGame() {
    return loadGame() !== null;
  }

  return {
    getSetting,
    setSetting,
    getStats,
    setStats,
    addResult,
    resetStats,
    unlockAchievements,
    saveGame,
    loadGame,
    clearGame,
    hasSavedGame,
  };
})();
