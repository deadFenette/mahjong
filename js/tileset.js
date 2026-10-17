/* ============================================================
   TILESET.JS — Фасад выбора скина фишек (v19-skins)

   По setting 'tileSkin' из Storage отдаёт один из двух наборов:
   - 'classic' (по умолчанию): простой чистый SVG без золотых рамок,
     как было до v19. Лёгкий, читаемый, минималистичный.
   - 'ornate': ультратрадиционный богатый скин — золотая гравировка,
     угловые «жемчужины», радиальное свечение, глубокие градиенты.
     В стиле дорогого маджонг-набора.

   Storage.setSetting('tileSkin', ...) пишется в settings; при смене
   скина App.applyTileSkin() вызывает Render.renderFull(), и фишки
   перерисовываются на лету — даже посреди партии.

   Фасад экспортирует тот же API, что и оригинальный Tileset:
   tiles, isMatch, groups. При недоступности Storage (например, в
   Node-песочнице для тестов) — используется 'classic'.
   ============================================================ */

const Tileset = (function () {

  // ---------- Какой скин сейчас активен? ----------
  function activeSkinId() {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('mj_setting_tileSkin');
        if (v === 'ornate') return 'ornate';
      }
    } catch (e) { /* localStorage недоступен — fallback */ }
    return 'classic';
  }

  // ---------- Выбор набора под текущий скин ----------
  // TilesetClassic и TilesetOrnate определены в tileset-classic.js
  // и tileset-ornate.js, подключённых ДО этого файла в index.html.
  function pick() {
    return activeSkinId() === 'ornate'
      ? (typeof TilesetOrnate !== 'undefined' ? TilesetOrnate : TilesetClassic)
      : (typeof TilesetClassic !== 'undefined' ? TilesetClassic : TilesetOrnate);
  }

  // ---------- Чистая функция isMatch — одинакова для всех скинов ----------
  // Не зависит от выбранного скина: правила совпадения не меняются.
  function isMatch(a, b) {
    if (!a || !b || a === b) return false;
    if (a.suit === 'flowers' && b.suit === 'flowers') return true;
    if (a.suit === 'seasons' && b.suit === 'seasons') return true;
    return a.suit === b.suit && a.rank === b.rank;
  }

  // ---------- Прокси к текущему набору ----------
  // tiles и groups — это массивы/объекты текущего скина. App и Render
  // читают их напрямую; при смене скина им нужно вызвать
  // Render.renderFull() (фишки перерисуются из нового Tileset.tiles).
  // В тестах без браузера tiles фиксированы — classic.
  let current = pick();

  // Если Storage доступен (браузер) — пересчитываем при доступе,
  // чтобы подсветка подхватила смену скина без перезагрузки.
  // В Node-песочнице localStorage шимирован — pick() вернёт classic.

  return {
    // tiles и groups — геттеры, чтобы при смене скина сразу
    // отражали новый набор. App.applyTileSkin() после смены
    // вызывает Render.renderFull() — он читает tiles и сразу
    // видит новые фишки.
    get tiles() {
      current = pick();
      return current.tiles;
    },
    get groups() {
      current = pick();
      return current.groups;
    },
    isMatch,
    // Какой скин сейчас активен (для UI-индикации)
    activeSkinId,
    // Список доступных скинов (для меню настроек)
    SKINS: [
      { id: 'classic', name: 'Классический', desc: 'Чистый минимализм' },
      { id: 'ornate',  name: 'Богатый',      desc: 'Золотая гравировка и орнаменты' },
    ],
  };
})();
