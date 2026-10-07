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
    tileSize: 'medium',
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
  function getStats() {
    try {
      const raw = localStorage.getItem(PREFIX + 'stats');
      if (!raw) return { played: 0, won: 0, bestScore: 0, bestTime: null, totalPairs: 0 };
      return JSON.parse(raw);
    } catch (e) {
      return { played: 0, won: 0, bestScore: 0, bestTime: null, totalPairs: 0 };
    }
  }

  function setStats(stats) {
    try { localStorage.setItem(PREFIX + 'stats', JSON.stringify(stats)); } catch (e) {}
  }

  function addResult({ won, score, time, pairs }) {
    const s = getStats();
    s.played += 1;
    if (won) {
      s.won += 1;
      s.totalPairs += pairs;
      if (score > s.bestScore) s.bestScore = score;
      if (s.bestTime === null || time < s.bestTime) s.bestTime = time;
    }
    setStats(s);
    return s;
  }

  function resetStats() {
    setStats({ played: 0, won: 0, bestScore: 0, bestTime: null, totalPairs: 0 });
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
    saveGame,
    loadGame,
    clearGame,
    hasSavedGame,
  };
})();
