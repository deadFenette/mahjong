/* ============================================================
   TILESET-CLEAR.JS — скин «Контраст» (v33)

   Различим без цвета: ничего не зависит от того, красное оно или зелёное.
   Масть определяет ФОРМА рамки, значение — КРУПНАЯ цифра:
     • точки      — круг
     • бамбук     — высокий «стебель» с узлами по бокам
     • символы    — квадрат с угловыми скобками
     • ветры      — ромб: буква (В Ю З С) и чёрный «указатель» на той
                    вершине, куда смотрит сторона света
     • драконы    — шестиугольник; красный — залит чёрным, зелёный —
                    в штриховку, белый — пустой с двойной рамкой
     • цветы      — «ромашка»-рамка с цветком, сезоны — звезда с солнцем.
                    Все 4 цветка выглядят одинаково (и все 4 сезона —
                    тоже): любой цветок собирается с любым цветком.
   Только чёрное на белом, цифры и буквы крупнее, чем где-либо ещё
   (около 50% высоты фишки), у 6 и 9 есть подчёркивание, чтобы их не
   путать. Лицо — 3–14 простых элементов, без градиентов.
   ============================================================ */

Tileset.register({
  id: 'clear',
  name: 'Контраст',
  desc: 'Крупные цифры и формы — различимо без цвета',
  order: 40,
  // Набор строится лениво — при первом обращении (см. tileset.js)
  create: function () {

  const INK = '#111';
  const FONT = "'Arial Black','Segoe UI',Arial,'Helvetica Neue',sans-serif";

  // Текст: класс ct нужен CSS, чтобы перебить общий «иероглифный» шрифт
  function txt(s, y, size, fill, x) {
    return '<text class="ct" x="' + (x || 50) + '" y="' + y + '" text-anchor="middle" font-size="' + size +
      '" font-weight="900" fill="' + (fill || INK) + '" stroke="none" font-family="' + FONT + '">' + s + '</text>';
  }

  function wrap(inner) {
    return TilesetCore.svg('<g stroke="' + INK + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">' + inner + '</g>');
  }

  // Подчёркивание у 6 и 9 (иначе перевёрнутая цифра неотличима)
  function under(n, y) {
    return (n === 6 || n === 9) ? '<path d="M38 ' + y + 'L62 ' + y + '" stroke-width="4" fill="none"/>' : '';
  }

  // ---------- Масти: рамка + цифра ----------
  function dotsFace(n) {
    return wrap(
      '<circle cx="50" cy="60" r="43" fill="#fff"/>' +
      '<circle cx="50" cy="60" r="35" fill="none" stroke-width="1.6"/>' +
      txt(n, 80, 60) + under(n, 90));
  }
  function bambooFace(n) {
    return wrap(
      '<rect x="15" y="10" width="70" height="100" rx="24" fill="#fff"/>' +
      '<path d="M9 42L24 42M76 42L91 42M9 78L24 78M76 78L91 78" stroke-width="4" fill="none"/>' +
      txt(n, 80, 60) + under(n, 91));
  }
  function charFace(n) {
    return wrap(
      '<rect x="11" y="21" width="78" height="78" rx="5" fill="#fff"/>' +
      '<path d="M19 38L19 29L28 29M72 29L81 29L81 38M19 82L19 91L28 91M72 91L81 91L81 82" stroke-width="3" fill="none"/>' +
      txt(n, 80, 60) + under(n, 90));
  }

  // ---------- Ветры: ромб, буква, указатель ----------
  function windFace(code) {
    const letter = { E: 'В', S: 'Ю', W: 'З', N: 'С' }[code];
    const pointer = {
      N: 'M50 21L40 37L60 37Z', S: 'M50 99L40 83L60 83Z',
      E: 'M85 60L69 50L69 70Z', W: 'M15 60L31 50L31 70Z',
    }[code];
    return wrap(
      '<path d="M50 8L94 60L50 112L6 60Z" fill="#fff"/>' +
      '<path d="' + pointer + '" fill="' + INK + '"/>' +
      txt(letter, 76, 42, null, 50 + { E: -5, W: 5, N: 0, S: 0 }[code]));
  }

  // ---------- Драконы: шестиугольник ----------
  const HEX = 'M50 8L92 34L92 86L50 112L8 86L8 34Z';
  function dragonFace(code) {
    if (code === 'R') {
      return wrap('<path d="' + HEX + '" fill="' + INK + '"/>' + txt('К', 78, 56, '#fff'));
    }
    if (code === 'G') {
      return wrap(
        '<defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<rect width="9" height="9" fill="#fff" stroke="none"/><rect width="4.5" height="9" fill="' + INK + '" stroke="none"/></pattern></defs>' +
        '<path d="' + HEX + '" fill="url(#hatch)"/>' +
        '<circle cx="50" cy="60" r="26" fill="#fff" stroke-width="3"/>' +
        txt('З', 78, 46));
    }
    return wrap(
      '<path d="' + HEX + '" fill="#fff"/>' +
      '<path d="M50 20L82 40L82 80L50 100L18 80L18 40Z" fill="none" stroke-width="2"/>' +
      txt('Б', 78, 52));
  }

  // ---------- Бонус: цветы — «ромашка», сезоны — звезда ----------
  function flowerFace() {
    let bumps = '';
    for (let i = 0; i < 10; i++) {
      const a = (i * 36) * Math.PI / 180;
      bumps += '<circle cx="' + (50 + Math.sin(a) * 33).toFixed(1) + '" cy="' + (60 - Math.cos(a) * 33).toFixed(1) + '" r="12" fill="#fff"/>';
    }
    let petals = '';
    for (let i = 0; i < 6; i++) {
      petals += '<ellipse cx="50" cy="43" rx="8.5" ry="15" fill="' + INK + '" stroke="none" transform="rotate(' + (i * 60) + ' 50 60)"/>';
    }
    return wrap(
      bumps + '<circle cx="50" cy="60" r="33" fill="#fff" stroke="none"/>' +
      petals + '<circle cx="50" cy="60" r="7" fill="#fff" stroke="none"/>');
  }
  function seasonFace() {
    let pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i * 22.5) * Math.PI / 180, r = i % 2 ? 31 : 46;
      pts.push((50 + Math.sin(a) * r).toFixed(1) + ' ' + (60 - Math.cos(a) * r).toFixed(1));
    }
    let rays = '';
    for (let i = 0; i < 8; i++) {
      rays += '<path d="M50 38L50 31" stroke-width="4" transform="rotate(' + (i * 45) + ' 50 60)"/>';
    }
    return wrap(
      '<path d="M' + pts.join('L') + 'Z" fill="#fff"/>' +
      '<circle cx="50" cy="60" r="13" fill="' + INK + '"/>' + rays);
  }

  function face(suit, rank) {
    switch (suit) {
      case 'dots': return dotsFace(rank);
      case 'bamboo': return bambooFace(rank);
      case 'characters': return charFace(rank);
      case 'winds': return windFace(rank);
      case 'dragons': return dragonFace(rank);
      case 'flowers': return flowerFace();
      default: return seasonFace();
    }
  }

  const set = TilesetCore.build(face);
  return { tiles: set.tiles, isMatch: set.isMatch, groups: set.groups };
  }
});
