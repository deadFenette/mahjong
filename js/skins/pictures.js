/* ============================================================
   TILESET-PICTURES.JS — скин «Картинки» (v33)

   Для тех, кому трудно разбирать иероглифы: у каждой из 34 разных фишек
   своя крупная знакомая картинка.
     • «точки»   → 9 фруктов и ягод
     • «бамбук»  → 9 цветов и растений
     • «символы» → 9 птиц и зверушек
     • ветры     → солнце, облако, луна, снежинка
     • драконы   → сердце, лягушка, домик
     • цветы и сезоны (бонусные фишки, любая совпадает с любой из своей
       группы) — в цветном кольце со звездой: розовое — цветы, синее — сезоны.

   Лёгкий: только простые фигуры, цвет плоский, без градиентов и id
   (в лице 3–25 элементов). Контур тёмно-коричневый, толстый — картинка
   читается даже на маленькой фишке и при плохом зрении.
   ============================================================ */

Tileset.register({
  id: 'pictures',
  name: 'Картинки',
  desc: 'Фрукты, цветы и зверушки вместо иероглифов',
  order: 30,
  // Набор строится лениво — при первом обращении (см. tileset.js)
  create: function () {

  const INK = '#4a3320';

  // Обёртка лица: общий контур для всех фигур внутри
  function art(inner) {
    return TilesetCore.svg(
      '<g stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' +
      inner + '</g>');
  }

  // Лепестки по кругу: n эллипсов вокруг центра (cx, cy)
  function petals(n, cx, cy, rx, ry, dist, fill, rot) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = (rot || 0) + (360 / n) * i;
      out += '<ellipse cx="' + cx + '" cy="' + (cy - dist) + '" rx="' + rx + '" ry="' + ry +
        '" fill="' + fill + '" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>';
    }
    return out;
  }

  // Стебель с листьями (для цветов, у которых видна «головка» сверху)
  function stem(fromY) {
    return '<path d="M50 ' + fromY + ' L50 112" fill="none" stroke-width="4"/>' +
      '<path d="M50 104 C36 102 26 92 26 82 C40 82 50 92 50 104 Z" fill="#4caf50"/>' +
      '<path d="M50 96 C62 94 72 86 74 76 C60 76 52 84 50 96 Z" fill="#5cbf5c"/>';
  }

  const dot = (cx, cy, r, fill, extra) =>
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>';
  const shine = (cx, cy, rx, ry, rot) =>
    '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fff" fill-opacity="0.4" stroke="none"' +
    (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + '/>';

  // Клин с вершиной сверху: apexY — вершина, R — радиус дуги снизу, a — полуугол
  function wedge(apexY, R, a) {
    const r = a * Math.PI / 180;
    const dx = (R * Math.sin(r)).toFixed(1), dy = (R * Math.cos(r)).toFixed(1);
    return 'M50 ' + apexY + 'L' + (50 - dx).toFixed(1) + ' ' + (apexY + +dy).toFixed(1) +
      'A' + R + ' ' + R + ' 0 0 0 ' + (50 + +dx).toFixed(1) + ' ' + (apexY + +dy).toFixed(1) + 'Z';
  }
  // Лепесток-«миндаль» длиной L и полушириной w, растущий из точки (50, y0) под углом a
  function petal(L, w, a, y0, fill) {
    return '<path d="M0 0C' + (-w) + ' ' + (-L * 0.28) + ' ' + (-w) + ' ' + (-L * 0.74) + ' 0 ' + (-L) +
      'C' + w + ' ' + (-L * 0.74) + ' ' + w + ' ' + (-L * 0.28) + ' 0 0Z" fill="' + fill +
      '" transform="translate(50 ' + y0 + ') rotate(' + a + ')"/>';
  }

  // ---------- ФРУКТЫ (точки 1–9) ----------
  const fruits = {
    1: () => art( // яблоко
      '<path d="M50 38C36 28 14 38 16 62C18 86 36 100 50 94C64 100 82 86 84 62C86 38 64 28 50 38Z" fill="#d9322b"/>' +
      shine(33, 58, 5, 11, 15) +
      '<path d="M50 38C50 30 52 24 56 18" fill="none" stroke-width="4"/>' +
      '<path d="M55 30C62 18 76 20 82 26C74 38 62 38 55 30Z" fill="#4caf50"/>'),
    2: () => art( // груша
      '<path d="M50 24C42 24 40 36 36 46C26 56 20 68 24 82C30 102 70 102 76 82C80 68 74 56 64 46C60 36 58 24 50 24Z" fill="#b9d230"/>' +
      shine(38, 76, 4, 10, 15) +
      '<path d="M50 24C50 18 52 14 56 10" fill="none" stroke-width="4"/>' +
      '<path d="M54 20C62 10 76 12 80 18C72 28 60 28 54 20Z" fill="#4caf50"/>'),
    3: () => art( // вишни
      '<path d="M34 70C36 50 46 34 58 20M68 66C66 46 62 34 58 20" fill="none" stroke-width="3.4"/>' +
      '<path d="M58 22C66 12 80 14 86 20C78 30 64 30 58 22Z" fill="#4caf50"/>' +
      dot(33, 84, 16, '#c8202a') + dot(69, 80, 16, '#d92b38') +
      shine(27, 78, 3.5, 6, 20) + shine(63, 74, 3.5, 6, 20)),
    4: () => art( // лимон
      '<path d="M8 60C8 60 18 57 22 50C30 32 70 32 78 50C82 57 92 60 92 60C92 60 82 63 78 70C70 88 30 88 22 70C18 63 8 60 8 60Z" fill="#f8d82c" transform="rotate(-22 50 60)"/>' +
      shine(40, 50, 8, 4, -22) +
      '<path d="M66 30C70 20 82 18 88 22C84 32 74 36 66 30Z" fill="#4caf50"/>'),
    5: () => { // виноград
      const rows = [[26, 42, 58, 74], [34, 50, 66], [42, 58], [50]];
      let g = '';
      rows.forEach((xs, i) => xs.forEach(x => { g += dot(x, 44 + i * 15, 8.5, i % 2 ? '#8a47b5' : '#7b3fa0'); }));
      return art(
        '<path d="M50 38L52 16" fill="none" stroke-width="3.4"/>' +
        '<path d="M52 20C60 10 74 12 80 18C72 28 60 28 52 20Z" fill="#4caf50"/>' + g);
    },
    6: () => art( // арбуз: крупный клин — корка, светлая прослойка, мякоть, косточки
      '<path d="' + wedge(8, 104, 26) + '" fill="#3c9a45"/>' +
      '<path d="' + wedge(8, 95, 26) + '" fill="#eef5c4" stroke-width="1.6"/>' +
      '<path d="' + wedge(8, 89, 26) + '" fill="#e8404a" stroke-width="1.6"/>' +
      '<path d="M20 70C34 78 66 78 80 70" fill="none" stroke="#c9303b" stroke-width="1.4" stroke-opacity="0.0"/>' +
      [[50, 36, 0], [38, 54, -18], [62, 54, 18], [30, 74, -26], [50, 70, 0], [70, 74, 26]].map(p =>
        '<path d="M0 -5C4 -5 4 3 0 5C-4 3 -4 -5 0 -5Z" fill="#2a1a10" stroke="none" transform="translate(' + p[0] + ' ' + p[1] + ') rotate(' + p[2] + ')"/>').join('') +
      shine(40, 30, 3, 8, -20)),
    7: () => art( // апельсин
      dot(50, 66, 34, '#f7931e') + shine(36, 52, 6, 11, 30) +
      dot(50, 33, 2.6, '#8a4b10', ' stroke="none"') +
      '<path d="M52 32C60 20 74 22 80 28C72 40 60 40 52 32Z" fill="#4caf50"/>' +
      dot(40, 70, 1.6, '#c96a00', ' stroke="none"') + dot(58, 62, 1.6, '#c96a00', ' stroke="none"') +
      dot(62, 80, 1.6, '#c96a00', ' stroke="none"') + dot(44, 84, 1.6, '#c96a00', ' stroke="none"')),
    8: () => art( // клубника
      '<path d="M50 102C20 84 12 58 22 46C30 36 44 40 50 42C56 40 70 36 78 46C88 58 80 84 50 102Z" fill="#e8283c"/>' +
      [[36, 58], [52, 56], [66, 62], [30, 72], [46, 74], [62, 78], [42, 88], [56, 92]]
        .map(p => '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="2" ry="3" fill="#ffe27a" stroke="none"/>').join('') +
      '<path d="M50 44L36 30L45 36L50 22L55 36L64 30Z" fill="#3d9a40"/>'),
    9: () => art( // банан: толстый, на всю фишку, со стебельком и тёмным кончиком
      '<path d="M72 14C100 40 80 98 16 99C9 99 6 92 12 90C58 92 70 56 58 19Z" fill="#fbdc2e"/>' +
      '<path d="M62 26C76 56 64 84 22 93" fill="none" stroke-width="1.8" stroke-opacity="0.45"/>' +
      '<path d="M57 20C55 14 56 9 59 5L70 4C72 8 73 11 72 14Z" fill="#8a7a2a"/>' +
      '<path d="M16 99C9 99 6 92 12 90C13 94 15 97 16 99Z" fill="#5a3d1a"/>'),
  };

  // ---------- ЦВЕТЫ (бамбук 1–9) ----------
  const flowers = {
    1: () => art( // ромашка
      stem(66) + petals(12, 50, 46, 6, 17, 20, '#ffffff') + dot(50, 46, 11, '#f7c600')),
    2: () => art( // подсолнух
      stem(70) + petals(14, 50, 46, 7, 16, 23, '#f9c70c') + dot(50, 46, 15, '#6b3d1a') +
      dot(45, 42, 1.8, '#3a1f0a', ' stroke="none"') + dot(55, 42, 1.8, '#3a1f0a', ' stroke="none"') +
      dot(50, 50, 1.8, '#3a1f0a', ' stroke="none"') + dot(44, 52, 1.8, '#3a1f0a', ' stroke="none"') +
      dot(56, 52, 1.8, '#3a1f0a', ' stroke="none"')),
    3: () => art( // тюльпан: тёмные боковые лепестки, светлый передний, длинные листья
      '<path d="M50 90C50 100 47 108 50 116" fill="none" stroke-width="4.6"/>' +
      '<path d="M49 116C24 116 8 102 10 80C30 84 46 100 49 116Z" fill="#3f9e4a"/>' +
      '<path d="M51 112C76 110 92 96 90 74C70 78 54 94 51 112Z" fill="#4cb356"/>' +
      '<path d="M22 24C16 58 26 88 50 90C74 88 84 58 78 24C68 34 58 32 50 18C42 32 32 34 22 24Z" fill="#d22a42"/>' +
      '<path d="M50 18C38 38 36 68 50 90C64 68 62 38 50 18Z" fill="#f0475b"/>' +
      '<path d="M44 40C42 54 43 66 47 78" fill="none" stroke="#fff" stroke-width="3" stroke-opacity="0.4" stroke-linecap="round"/>'),
    4: () => art( // роза
      stem(74) + dot(50, 46, 30, '#e9506e') + dot(47, 43, 21, '#f06a86') + dot(53, 47, 12, '#e9506e') +
      '<path d="M44 44C48 38 58 40 58 48C58 54 50 56 47 52" fill="none" stroke-width="1.8"/>'),
    5: () => art( // лотос: симметричный веер из пяти лепестков над листом-кувшинкой
      '<ellipse cx="50" cy="104" rx="46" ry="11" fill="#4caf50"/>' +
      '<path d="M8 104Q50 112 92 104" fill="none" stroke-width="1.4" stroke-opacity="0.45"/>' +
      petal(46, 13, -60, 98, '#ee86b0') + petal(46, 13, 60, 98, '#ee86b0') +
      petal(60, 15, -31, 98, '#f49bc0') + petal(60, 15, 31, 98, '#f49bc0') +
      petal(72, 16, 0, 98, '#fbbfd8') +
      '<path d="M50 90L50 40" fill="none" stroke="#e57aa6" stroke-width="1.6" stroke-opacity="0.7"/>'),
    6: () => art( // василёк
      stem(64) + petals(8, 50, 44, 5, 15, 19, '#4a7bd6', 22.5) + dot(50, 44, 9, '#2b3f8f')),
    7: () => art( // мак
      stem(66) + petals(4, 50, 44, 17, 18, 15, '#e5282b', 45) + dot(50, 44, 8, '#2a1a10') +
      dot(50, 44, 3, '#fff', ' stroke="none" fill-opacity="0.5"')),
    8: () => { // клевер-четырёхлистник
      const leaf = 'M0 0C-24 -4 -26 -36 -11 -36C-3 -36 0 -28 0 -22C0 -28 3 -36 11 -36C26 -36 24 -4 0 0Z';
      return art(
        '<path d="M50 62C56 80 62 92 74 102" fill="none" stroke-width="4"/>' +
        [0, 90, 180, 270].map(a =>
          '<path d="' + leaf + '" fill="#3aa655" transform="translate(50 56) rotate(' + a + ')"/>').join(''));
    },
    9: () => { // лаванда
      let s = '<path d="M50 112L50 26" fill="none" stroke-width="4"/>' +
        '<path d="M50 104C36 102 26 92 26 82C40 82 50 92 50 104Z" fill="#4caf50"/>' +
        '<path d="M50 98C62 96 72 88 74 78C60 78 52 86 50 98Z" fill="#5cbf5c"/>';
      [[26, 0], [36, 1], [46, 0], [56, 1], [66, 0]].forEach(([y, k]) => {
        s += '<ellipse cx="' + (k ? 60 : 40) + '" cy="' + y + '" rx="6" ry="9" fill="#8e5fd0" transform="rotate(' + (k ? 24 : -24) + ' ' + (k ? 60 : 40) + ' ' + y + ')"/>';
        s += '<ellipse cx="' + (k ? 40 : 60) + '" cy="' + (y + 8) + '" rx="6" ry="9" fill="#a374e0" transform="rotate(' + (k ? -24 : 24) + ' ' + (k ? 40 : 60) + ' ' + (y + 8) + ')"/>';
      });
      s += '<ellipse cx="50" cy="18" rx="6" ry="10" fill="#8e5fd0"/>';
      return art(s);
    },
  };

  // ---------- ПТИЦЫ И ЗВЕРУШКИ (символы 1–9) ----------
  const creatures = {
    1: () => art( // птичка
      '<g transform="translate(-4 2) scale(0.94)">' +
      '<path d="M44 90L44 102M58 88L58 100" fill="none" stroke-width="3.4" stroke="#e08a12"/>' +
      '<path d="M16 72L2 82L6 64Z" fill="#2f78c9"/>' +
      '<path d="M16 72C14 50 36 42 52 44C56 28 82 26 86 44C88 52 82 58 74 60C72 80 46 92 16 72Z" fill="#3a8ee6"/>' +
      '<path d="M86 44L100 50L86 54Z" fill="#f7a81b"/>' +
      '<path d="M30 66C40 56 54 58 60 68C50 78 36 76 30 66Z" fill="#2f78c9"/>' +
      dot(76, 42, 3.2, '#222', ' stroke="none"') + '</g>'),
    2: () => art( // утёнок
      '<ellipse cx="46" cy="78" rx="34" ry="20" fill="#fbd534"/>' +
      dot(58, 42, 20, '#fbd534') +
      '<path d="M74 44C88 42 96 48 92 53C86 56 76 54 72 51Z" fill="#f7871e"/>' +
      '<ellipse cx="38" cy="76" rx="15" ry="8" fill="#f2bd1c" transform="rotate(-20 38 76)"/>' +
      dot(62, 38, 3.2, '#222', ' stroke="none"') +
      '<path d="M6 104q10 -9 20 0t20 0t20 0t20 0" fill="none" stroke="#3a8ee6" stroke-width="3.4"/>'),
    3: () => art( // сова
      '<path d="M22 40L26 16L42 30Z" fill="#a0703d"/><path d="M78 40L74 16L58 30Z" fill="#a0703d"/>' +
      '<ellipse cx="50" cy="66" rx="32" ry="38" fill="#a0703d"/>' +
      '<ellipse cx="50" cy="82" rx="19" ry="22" fill="#ecd3a6"/>' +
      '<path d="M40 76q4 4 8 0M52 76q4 4 8 0M44 88q4 4 8 0" fill="none" stroke-width="1.6" stroke-opacity="0.6"/>' +
      dot(37, 52, 13, '#fff') + dot(63, 52, 13, '#fff') + dot(38, 53, 6, '#222') + dot(62, 53, 6, '#222') +
      '<path d="M50 58L44 68L56 68Z" fill="#f7a81b"/>'),
    4: () => art( // рыбка
      '<path d="M72 60L96 38L96 82Z" fill="#e8700f"/>' +
      '<path d="M28 42Q44 16 58 42Z" fill="#e8700f"/>' +
      '<ellipse cx="44" cy="60" rx="35" ry="23" fill="#f7871e"/>' +
      '<path d="M50 40Q58 60 50 80M64 44Q70 60 64 76" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="4"/>' +
      dot(24, 54, 5.5, '#fff') + dot(23, 54, 2.6, '#222', ' stroke="none"') +
      '<path d="M12 66Q18 72 24 68" fill="none" stroke-width="2"/>'),
    5: () => art( // бабочка
      '<path d="M50 56C30 18 4 22 8 46C10 60 34 62 50 56Z" fill="#8a5ad8"/>' +
      '<path d="M50 56C70 18 96 22 92 46C90 60 66 62 50 56Z" fill="#8a5ad8"/>' +
      '<path d="M50 62C30 66 14 84 24 96C36 102 48 82 50 62Z" fill="#f58ab0"/>' +
      '<path d="M50 62C70 66 86 84 76 96C64 102 52 82 50 62Z" fill="#f58ab0"/>' +
      dot(24, 40, 5.5, '#fff', ' stroke="none"') + dot(76, 40, 5.5, '#fff', ' stroke="none"') +
      dot(34, 86, 4, '#fff', ' stroke="none"') + dot(66, 86, 4, '#fff', ' stroke="none"') +
      '<ellipse cx="50" cy="68" rx="4.5" ry="26" fill="#3a2a1a"/>' +
      '<path d="M48 42C44 32 38 28 34 26M52 42C56 32 62 28 66 26" fill="none" stroke-width="2.4"/>'),
    6: () => art( // божья коровка
      '<path d="M44 26L38 14M56 26L62 14" fill="none" stroke-width="2.6"/>' +
      '<ellipse cx="50" cy="70" rx="33" ry="36" fill="#e5282b"/>' +
      '<path d="M50 34L50 106" fill="none" stroke-width="2.4"/>' +
      '<path d="M26 40A32 14 0 0 1 74 40A28 20 0 0 0 26 40Z" fill="#2a1a10"/>' +
      [[34, 60], [66, 60], [30, 80], [70, 80], [40, 96], [60, 96]].map(p => dot(p[0], p[1], 6, '#2a1a10', ' stroke="none"')).join('') +
      dot(50, 34, 12, '#2a1a10') + dot(45, 32, 3, '#fff', ' stroke="none"') + dot(55, 32, 3, '#fff', ' stroke="none"')),
    7: () => art( // кот
      '<path d="M16 54L20 18L46 40Z" fill="#9aa0a6"/><path d="M84 54L80 18L54 40Z" fill="#9aa0a6"/>' +
      '<path d="M24 46L25 28L38 40Z" fill="#f5a3b5" stroke="none"/><path d="M76 46L75 28L62 40Z" fill="#f5a3b5" stroke="none"/>' +
      '<ellipse cx="50" cy="68" rx="37" ry="31" fill="#9aa0a6"/>' +
      '<ellipse cx="35" cy="62" rx="6" ry="8" fill="#9ad66b"/><ellipse cx="65" cy="62" rx="6" ry="8" fill="#9ad66b"/>' +
      '<ellipse cx="35" cy="62" rx="2.2" ry="6" fill="#222" stroke="none"/><ellipse cx="65" cy="62" rx="2.2" ry="6" fill="#222" stroke="none"/>' +
      '<path d="M44 74L56 74L50 81Z" fill="#f08aa0"/>' +
      '<path d="M50 81Q44 90 36 86M50 81Q56 90 64 86" fill="none" stroke-width="2"/>' +
      '<path d="M8 74L28 78M8 86L28 83M92 74L72 78M92 86L72 83" fill="none" stroke-width="1.8"/>'),
    8: () => art( // улитка
      '<path d="M6 98C6 90 14 88 26 88L72 88L76 64C76 58 86 58 86 64L86 88C95 90 96 98 88 98Z" fill="#e7cf9a"/>' +
      '<path d="M78 62L74 46M85 62L91 47" fill="none" stroke-width="2.6"/>' + dot(74, 45, 3.6, '#e7cf9a') + dot(91, 46, 3.6, '#e7cf9a') +
      dot(42, 62, 30, '#c98a3c') +
      '<path d="M42 62a4 4 0 0 1 8 0a8 8 0 0 1 -16 0a12 12 0 0 1 24 0a16 16 0 0 1 -32 0a20 20 0 0 1 40 0" fill="none" stroke-width="2.4" stroke="#8a5420"/>' +
      dot(80, 76, 1.8, '#222', ' stroke="none"')),
    9: () => art( // черепаха
      '<ellipse cx="22" cy="42" rx="9" ry="13" fill="#7bc46b" transform="rotate(-35 22 42)"/>' +
      '<ellipse cx="78" cy="42" rx="9" ry="13" fill="#7bc46b" transform="rotate(35 78 42)"/>' +
      '<ellipse cx="24" cy="86" rx="9" ry="13" fill="#7bc46b" transform="rotate(35 24 86)"/>' +
      '<ellipse cx="76" cy="86" rx="9" ry="13" fill="#7bc46b" transform="rotate(-35 76 86)"/>' +
      '<path d="M44 100L50 112L56 100Z" fill="#7bc46b"/>' +
      dot(50, 22, 11, '#7bc46b') + dot(46, 20, 2.2, '#222', ' stroke="none"') + dot(54, 20, 2.2, '#222', ' stroke="none"') +
      '<ellipse cx="50" cy="64" rx="31" ry="37" fill="#4a9a4a"/>' +
      '<path d="M50 48L64 56L64 72L50 80L36 72L36 56ZM50 48L50 32M64 56L78 48M64 72L78 80M50 80L50 98M36 72L22 80M36 56L22 48" fill="none" stroke-width="2" stroke-opacity="0.75"/>'),
  };

  // ---------- ВЕТРЫ: небо ----------
  const winds = {
    E: () => { // солнце
      let rays = '';
      for (let i = 0; i < 12; i++) {
        rays += '<path d="M50 14L50 28" stroke="#f0a010" stroke-width="5" transform="rotate(' + (i * 30) + ' 50 60)"/>';
      }
      return art(rays + dot(50, 60, 22, '#fbd534') + shine(42, 52, 5, 8, 30) +
        '<path d="M41 64Q50 72 59 64" fill="none" stroke-width="2.4"/>' +
        dot(43, 56, 2.2, '#222', ' stroke="none"') + dot(57, 56, 2.2, '#222', ' stroke="none"'));
    },
    S: () => art( // облако с каплями
      '<path d="M24 74C8 74 6 52 24 50C24 34 48 28 56 42C70 34 90 44 82 58C96 62 92 76 78 74Z" fill="#d6e8f6"/>' +
      '<path d="M30 82Q40 94 30 102Q20 94 30 82ZM52 82Q62 94 52 102Q42 94 52 82ZM74 82Q84 94 74 102Q64 94 74 82Z" fill="#4aa3df" stroke-width="1.8"/>'),
    W: () => art( // луна со звездой
      '<path d="M60 16A44 44 0 1 0 90 82A36 36 0 1 1 60 16Z" fill="#f5dd7b"/>' +
      '<path d="M76 30L79 38L88 38L81 43L84 52L76 47L68 52L71 43L64 38L73 38Z" fill="#fbd534" transform="translate(-4 4)"/>'),
    N: () => { // снежинка
      let arms = '';
      for (let i = 0; i < 6; i++) {
        arms += '<g transform="rotate(' + (i * 60) + ' 50 60)"><path d="M50 60L50 22M50 38L42 30M50 38L58 30" fill="none" stroke="#4aa3df" stroke-width="5"/></g>';
      }
      return art(arms + dot(50, 60, 6, '#e8f4fc'));
    },
  };

  // ---------- ДРАКОНЫ ----------
  const dragons = {
    R: () => art( // сердце
      '<path d="M50 98C10 68 6 30 30 26C42 24 50 34 50 40C50 34 58 24 70 26C94 30 90 68 50 98Z" fill="#e0212f"/>' +
      shine(28, 42, 5, 10, 25)),
    G: () => art( // лягушка
      dot(30, 38, 14, '#4cb04a') + dot(70, 38, 14, '#4cb04a') +
      '<ellipse cx="50" cy="68" rx="40" ry="30" fill="#4cb04a"/>' +
      dot(30, 38, 8.5, '#fff') + dot(70, 38, 8.5, '#fff') + dot(31, 39, 4, '#222', ' stroke="none"') + dot(69, 39, 4, '#222', ' stroke="none"') +
      '<path d="M26 70Q50 92 74 70" fill="none" stroke-width="3"/>' +
      dot(44, 58, 1.8, '#222', ' stroke="none"') + dot(56, 58, 1.8, '#222', ' stroke="none"') +
      dot(22, 72, 5, '#f58a9b', ' stroke="none" fill-opacity="0.7"') + dot(78, 72, 5, '#f58a9b', ' stroke="none" fill-opacity="0.7"')),
    W: () => art( // домик
      '<rect x="68" y="22" width="10" height="22" fill="#a05a3a"/>' +
      '<rect x="20" y="54" width="60" height="44" fill="#fff6e0"/>' +
      '<path d="M10 58L50 18L90 58Z" fill="#c0392b"/>' +
      '<rect x="42" y="68" width="16" height="30" fill="#8a5a2a"/>' +
      '<rect x="26" y="64" width="12" height="12" fill="#9fd3f5"/><rect x="62" y="64" width="12" height="12" fill="#9fd3f5"/>' +
      dot(54, 84, 1.6, '#f7c600', ' stroke="none"')),
  };

  // ---------- БОНУС: ЦВЕТЫ (розовое кольцо) и СЕЗОНЫ (синее) ----------
  function bonus(ring, inner) {
    return art(
      '<circle cx="50" cy="62" r="42" fill="#fffaf0" stroke="' + ring + '" stroke-width="4"/>' +
      '<circle cx="50" cy="62" r="36" fill="none" stroke="' + ring + '" stroke-width="1.4" stroke-opacity="0.6"/>' +
      inner +
      '<path d="M50 6L53 14L62 14L55 19L58 28L50 22L42 28L45 19L38 14L47 14Z" fill="#f7c600" stroke-width="1.6"/>');
  }
  const bonusFlowers = {
    1: () => bonus('#d6336c', petals(5, 50, 62, 11, 13, 14, '#f8a5c2', 0) + dot(50, 62, 7, '#f7c600')),
    2: () => bonus('#d6336c', petals(5, 50, 62, 11, 13, 14, '#c79af0', 36) + dot(50, 62, 7, '#fff3a0')),
    3: () => bonus('#d6336c', petals(8, 50, 62, 6, 15, 15, '#ffd23f', 0) + dot(50, 62, 8, '#e8700f')),
    4: () => bonus('#d6336c', petals(6, 50, 62, 8, 14, 14, '#ffffff', 0) + dot(50, 62, 7, '#4aa3df')),
  };
  function tree(crown, extra) {
    return '<rect x="46" y="74" width="8" height="22" fill="#8a5a2a"/>' + dot(50, 56, 22, crown) + (extra || '');
  }
  const bonusSeasons = {
    1: () => bonus('#2c7be5', tree('#8fd18a', dot(42, 50, 3.4, '#f8a5c2', ' stroke="none"') + dot(56, 46, 3.4, '#f8a5c2', ' stroke="none"') + dot(52, 62, 3.4, '#f8a5c2', ' stroke="none"') + dot(40, 62, 3.4, '#f8a5c2', ' stroke="none"'))),
    2: () => bonus('#2c7be5', tree('#3aa655', dot(70, 40, 7, '#fbd534', ' stroke-width="1.6"'))),
    3: () => bonus('#2c7be5', tree('#e8832a', dot(34, 88, 3.4, '#c0392b', ' stroke="none"') + dot(66, 84, 3.4, '#e8a02a', ' stroke="none"') + dot(60, 96, 3.4, '#c0392b', ' stroke="none"'))),
    4: () => bonus('#2c7be5', tree('#eef6fb', dot(42, 52, 3, '#9fcbe8', ' stroke="none"') + dot(58, 58, 3, '#9fcbe8', ' stroke="none"') + dot(50, 44, 3, '#9fcbe8', ' stroke="none"'))),
  };

  function face(suit, rank) {
    const table = { dots: fruits, bamboo: flowers, characters: creatures, winds, dragons, flowers: bonusFlowers, seasons: bonusSeasons }[suit];
    return table[rank]();
  }

  // Названия — то, что нарисовано (их показывает «Лупа»)
  const NAMES = {
    dots: ['Яблоко', 'Груша', 'Вишни', 'Лимон', 'Виноград', 'Арбуз', 'Апельсин', 'Клубника', 'Банан'],
    bamboo: ['Ромашка', 'Подсолнух', 'Тюльпан', 'Роза', 'Лотос', 'Василёк', 'Мак', 'Клевер', 'Лаванда'],
    characters: ['Птичка', 'Утёнок', 'Сова', 'Рыбка', 'Бабочка', 'Божья коровка', 'Кот', 'Улитка', 'Черепаха'],
    winds: { E: 'Солнце', S: 'Облако с дождём', W: 'Луна', N: 'Снежинка' },
    dragons: { R: 'Сердце', G: 'Лягушка', W: 'Домик' },
    flowers: ['Цветок', 'Цветок', 'Цветок', 'Цветок'],
    seasons: ['Весна', 'Лето', 'Осень', 'Зима'],
  };
  const set = TilesetCore.build(face, NAMES);
  return { tiles: set.tiles, isMatch: set.isMatch, groups: set.groups };
  }
});
