/* ============================================================
   TILESET.JS — Реестр и фасад скинов фишек (v44: реестр)

   ЧТО ЭТО. Единственное место, которое знает про «набор фишек». Скины
   (js/skins/*.js) сами регистрируются через Tileset.register(...);
   ни список скинов, ни порядок, ни названия больше нигде не
   продублированы: карточки в настройках, превью, проверка выбранного
   скина — всё читает этот реестр. Чтобы добавить скин — см.
   js/skins/README.md (один файл + две строки подключения).

   Контракт скина (то, что передаётся в Tileset.register):
     id      'neon'                  — a-z, 0-9, дефис; ключ в настройках
     name    'Неон'                  — название на карточке и в тосте
     desc    'Светящиеся линии'      — подпись на карточке
     order   40                      — порядок в списке (меньше — выше)
     ЛИБО create() → { tiles, isMatch, groups }   — полный набор сам
     ЛИБО face(suit, rank) → '<svg…>' [+ names]   — только рисунок лиц;
          состав из 144 фишек, имена и правила соберёт TilesetCore.

   Набор строится ЛЕНИВО — при первом обращении — и кэшируется. Раньше
   все скины строились при загрузке страницы (4 × 144 SVG), а нужен
   всегда один. Скин, который не построился (ошибка в create), не
   роняет игру: в консоль пишется причина, а игра берёт скин по умолчанию.

   Фасад отдаёт тот же API, что и прежде: tiles, groups, isMatch,
   activeSkinId, sampleFaces, SKINS. Активный скин — setting 'tileSkin'
   (читается при каждом обращении, поэтому смена скина работает на лету:
   App.applyTileSkin() после смены вызывает Render.renderFull()).
   ============================================================ */

const Tileset = (function () {
  'use strict';

  const ID_RE = /^[a-z][a-z0-9-]*$/;
  const FALLBACK_ID = 'classic';      // желанный скин по умолчанию (если зарегистрирован)

  // id → { def, built } ; SKINS — «живой» список для UI (тот же массив всегда)
  const registry = new Map();
  const SKINS = [];

  // ---------- Регистрация ----------
  function register(def) {
    if (!def || typeof def !== 'object') throw new Error('Tileset.register: нужен объект скина');
    if (!ID_RE.test(def.id || '')) throw new Error('Tileset.register: id должен быть вида "neon" (a-z, 0-9, дефис): ' + def.id);
    if (registry.has(def.id)) throw new Error('Tileset.register: скин "' + def.id + '" уже зарегистрирован');
    if (!def.name || typeof def.name !== 'string') throw new Error('Tileset.register: у скина "' + def.id + '" нет name');
    const hasFace = typeof def.face === 'function';
    if (typeof def.create !== 'function' && !hasFace) {
      throw new Error('Tileset.register: у скина "' + def.id + '" нужен create() или face(suit, rank)');
    }
    registry.set(def.id, { def, built: null, broken: false });
    SKINS.push({ id: def.id, name: def.name, desc: def.desc || '', order: typeof def.order === 'number' ? def.order : 1000 });
    SKINS.sort((a, b) => a.order - b.order);   // стабильно: при равном order — порядок регистрации
    return def;
  }

  function has(id) { return registry.has(id); }

  // Построенный набор скина { tiles, isMatch, groups } или null (нет скина / он сломан)
  function get(id) {
    const rec = registry.get(id);
    if (!rec || rec.broken) return null;
    if (!rec.built) {
      try {
        const d = rec.def;
        rec.built = typeof d.create === 'function' ? d.create() : TilesetCore.build(d.face, d.names);
        if (!rec.built || !Array.isArray(rec.built.tiles)) throw new Error('create() должен вернуть { tiles, isMatch, groups }');
      } catch (e) {
        rec.broken = true;
        if (typeof console !== 'undefined') console.error('Скин "' + id + '" не построился:', e);
        const i = SKINS.findIndex(s => s.id === id);
        if (i >= 0) SKINS.splice(i, 1);          // сломанный скин не показываем в списке
        return null;
      }
    }
    return rec.built;
  }

  // Скин по умолчанию: classic, если он есть, иначе первый в списке
  function defaultSkinId() {
    if (registry.has(FALLBACK_ID) && !registry.get(FALLBACK_ID).broken) return FALLBACK_ID;
    return SKINS.length ? SKINS[0].id : FALLBACK_ID;
  }

  // ---------- Какой скин сейчас активен? ----------
  function activeSkinId() {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('mj_setting_tileSkin');
        if (v && registry.has(v) && get(v)) return v;
      }
    } catch (e) { /* localStorage недоступен — fallback */ }
    return defaultSkinId();
  }

  function pick() {
    const id = activeSkinId();
    const set = get(id) || get(defaultSkinId()) || (SKINS.length ? get(SKINS[0].id) : null);
    if (!set) throw new Error('Tileset: нет ни одного рабочего скина (проверьте подключение js/skins/*.js)');
    return set;
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
    const m = get(id);
    if (!m) return [];
    return SAMPLES.map(([suit, rank]) => {
      const t = m.tiles.find(x => x.suit === suit && x.rank === rank);
      return t ? t.face : '';
    }).filter(Boolean);
  }

  // ---------- Проверка контракта (для автора нового скина и для тестов) ----------
  // Возвращает массив строк-проблем; пустой массив — скин годен.
  // В консоли браузера: Tileset.validate('neon')
  function validate(id) {
    const problems = [];
    const set = get(id);
    if (!set) return ['скин "' + id + '" не зарегистрирован или не построился'];
    const tiles = set.tiles;
    if (tiles.length !== 144) problems.push('должно быть 144 фишки, а их ' + tiles.length);
    const ids = new Set();
    tiles.forEach((t, i) => {
      if (typeof t.id !== 'number' || ids.has(t.id)) problems.push('фишка #' + i + ': id не уникален');
      ids.add(t.id);
      if (!t.suit || t.rank === undefined) problems.push('фишка #' + i + ': нет suit/rank');
      if (!t.name) problems.push('фишка #' + i + ': нет name');
      if (typeof t.face !== 'string' || t.face.indexOf('<svg') !== 0) problems.push('фишка #' + i + ': face не <svg>');
    });
    // 34 вида: 27 мастей + 4 ветра + 3 дракона (+ цветы/сезоны — по одной в виде)
    const kinds = new Set(tiles.filter(t => t.suit !== 'flowers' && t.suit !== 'seasons').map(t => t.suit + ':' + t.rank));
    if (kinds.size !== 34) problems.push('должно быть 34 вида фишек без бонусных, а их ' + kinds.size);
    if (!set.groups) problems.push('нет groups');
    if (typeof set.isMatch !== 'function') problems.push('нет isMatch');
    if (tiles.some(t => /<script|onerror=|onload=|javascript:/i.test(t.face || ''))) problems.push('в face есть скрипты');
    return Array.from(new Set(problems)).slice(0, 12);
  }

  // tiles и groups — геттеры: при смене скина сразу отражают новый набор.
  return {
    register, has, get, defaultSkinId, validate,
    get tiles() { return pick().tiles; },
    get groups() { return pick().groups; },
    isMatch,
    activeSkinId,
    sampleFaces,
    SKINS,
  };
})();
