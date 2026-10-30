/* ============================================================
   TILESET-CORE.JS — Общий «сборщик» набора из 144 фишек (v33)

   Новые скины (pictures, clear) отличаются только рисунком лиц.
   Состав набора, имена и правила совпадения — одни и те же, поэтому
   они собираются здесь: скину нужно лишь дать функцию
   face(suit, rank) → строка <svg>.

   Состав (канон): 3 масти × 9 × 4 = 108, ветры 4×4 = 16,
   драконы 3×4 = 12, цветы 4, сезоны 4 → 144.
   ============================================================ */

const TilesetCore = (function () {

  const dotNames = ['1 точка', '2 точки', '3 точки', '4 точки', '5 точек', '6 точек', '7 точек', '8 точек', '9 точек'];
  const bambooNames = ['1 бамбук', '2 бамбука', '3 бамбука', '4 бамбука', '5 бамбука', '6 бамбука', '7 бамбуков', '8 бамбуков', '9 бамбуков'];
  const charNames = ['1 万', '2 万', '3 万', '4 万', '5 万', '6 万', '7 万', '8 万', '9 万'];
  const winds = [['E', 'Восток'], ['S', 'Юг'], ['W', 'Запад'], ['N', 'Север']];
  const dragons = [['R', 'Красный дракон'], ['G', 'Зелёный дракон'], ['W', 'Белый дракон']];
  const flowerNames = ['Слива', 'Орхидея', 'Хризантема', 'Бамбук-цветок'];
  const seasonNames = ['Весна', 'Лето', 'Осень', 'Зима'];

  // SVG-обёртка: единый класс и viewBox для всех скинов
  function svg(inner, viewBox) {
    return '<svg viewBox="' + (viewBox || '0 0 100 120') + '" preserveAspectRatio="xMidYMid meet" ' +
      'class="tile-face-svg" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  // face(suit, rank) вызывается один раз на вид фишки (не на каждую копию).
  // names — необязательные свои названия {масть: [..9 имён] | {код: имя}}: скину с картинками
  // «Вишни» понятнее, чем «3 точки» (их показывают лупа и подсказки).
  function build(face, names) {
    const tiles = [];
    let nextId = 0;
    function add(suit, rank, name, copies) {
      const own = names && names[suit];
      if (own) {
        const v = Array.isArray(own) ? own[rank - 1] : own[rank];
        if (v) name = v;
      }
      const f = face(suit, rank);
      for (let i = 0; i < copies; i++) tiles.push({ id: nextId++, suit, rank, name, face: f });
    }
    for (let n = 1; n <= 9; n++) {
      add('dots', n, dotNames[n - 1], 4);
      add('bamboo', n, bambooNames[n - 1], 4);
      add('characters', n, charNames[n - 1], 4);
    }
    winds.forEach(([code, name]) => add('winds', code, name, 4));
    dragons.forEach(([code, name]) => add('dragons', code, name, 4));
    // цветы и сезоны — по одной фишке каждого вида, у каждой своё лицо
    for (let f = 1; f <= 4; f++) add('flowers', f, flowerNames[f - 1], 1);
    for (let s = 1; s <= 4; s++) add('seasons', s, seasonNames[s - 1], 1);

    function isMatch(a, b) {
      // по ССЫЛКЕ, не по id (см. комментарий в tileset-classic.js, v13)
      if (!a || !b || a === b) return false;
      if (a.suit === 'flowers' && b.suit === 'flowers') return true;
      if (a.suit === 'seasons' && b.suit === 'seasons') return true;
      return a.suit === b.suit && a.rank === b.rank;
    }

    return {
      tiles,
      isMatch,
      groups: { dots: dotNames, bamboo: bambooNames, characters: charNames, winds, dragons, flowers: flowerNames, seasons: seasonNames },
    };
  }

  return { build, svg };
})();
