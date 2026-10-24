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

  // ---------- Реестр скинов ----------
  // v33: добавлены 'pictures' («Картинки») и 'clear» («Контраст»).
  // Модули скинов — отдельные файлы, подключённые ДО этого; если какого-то
  // нет (например, в урезанной песочнице) — скин просто недоступен.
  const SKINS = [
    { id: 'classic',  name: 'Классический', desc: 'Чистый минимализм' },
    { id: 'ornate',   name: 'Богатый',      desc: 'Золотая гравировка и орнаменты' },
    { id: 'pictures', name: 'Картинки',     desc: 'Фрукты, цветы и зверушки вместо иероглифов' },
    { id: 'clear',    name: 'Контраст',     desc: 'Крупные цифры и формы, без цвета' },
  ];

  function moduleFor(id) {
    switch (id) {
      case 'ornate':   return typeof TilesetOrnate !== 'undefined' ? TilesetOrnate : null;
      case 'pictures': return typeof TilesetPictures !== 'undefined' ? TilesetPictures : null;
      case 'clear':    return typeof TilesetClear !== 'undefined' ? TilesetClear : null;
      default:         return typeof TilesetClassic !== 'undefined' ? TilesetClassic : null;
    }
  }

  // ---------- Какой скин сейчас активен? ----------
  function activeSkinId() {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('mj_setting_tileSkin');
        if (v && SKINS.some(s => s.id === v) && moduleFor(v)) return v;
      }
    } catch (e) { /* localStorage недоступен — fallback */ }
    return 'classic';
  }

  function pick() {
    return moduleFor(activeSkinId()) || moduleFor('classic') || moduleFor('ornate');
  }

  // ---------- Чистая функция isMatch — одинакова для всех скинов ----------
  // Не зависит от выбранного скина: правила совпадения не меняются.
  function isMatch(a, b) {
    if (!a || !b || a === b) return false;
    if (a.suit === 'flowers' && b.suit === 'flowers') return true;
    if (a.suit === 'seasons' && b.suit === 'seasons') return true;
    return a.suit === b.suit && a.rank === b.rank;
  }

  // Образцы лиц для карточки скина в настройках: [масть, ранг] → <svg>
  const SAMPLES = [['dots', 5], ['bamboo', 3], ['characters', 7]];
  function sampleFaces(id) {
    const m = moduleFor(id);
    if (!m) return [];
    return SAMPLES.map(([suit, rank]) => {
      const t = m.tiles.find(x => x.suit === suit && x.rank === rank);
      return t ? t.face : '';
    }).filter(Boolean);
  }

  // tiles и groups — геттеры: при смене скина сразу отражают новый набор.
  // App.applyTileSkin() после смены вызывает Render.renderFull().
  return {
    get tiles() { return pick().tiles; },
    get groups() { return pick().groups; },
    isMatch,
    activeSkinId,
    sampleFaces,
    SKINS,
  };
})();
