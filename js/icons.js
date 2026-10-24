/* ============================================================
   ICONS.JS — Набор SVG-иконок вместо эмодзи и символов (v32)

   ЗАЧЕМ. Эмодзи (🌿 🎋 🍁) и символы вроде ✦ ❖ ✵ ⏭ рисуются шрифтом
   системы. На Windows 7 и в старых браузерах цветного шрифта нет —
   вместо иконок появляются пустые квадраты. Здесь все они нарисованы
   векторно: выглядят одинаково на любом компьютере и красятся
   через currentColor (цвет берётся из темы).

   КАК ПОЛЬЗОВАТЬСЯ.
   • В HTML:  <span class="ico" data-icon="leaf"></span>
     (Icons.hydrate() подставляет SVG при запуске).
   • В JS:    Icons.get('star')  → строка с <svg>…</svg>
              Icons.label('Далее', 'next', 'after') → «Далее →» с SVG.

   СТИЛЬ. Сетка 24×24 (крупные «карточные» иконки — 48×48),
   контур 1.6, скруглённые концы; «duo»-иконки получают мягкую
   заливку тем же цветом (opacity .2) — получается золотая
   «инкрустация», а не плоская клякса.
   ============================================================ */

const Icons = (function () {

  // Каждая иконка: { vb: размер сетки, body: содержимое <svg> }.
  // class="f" — заливка (мягкая), class="s" — только контур,
  // class="k" — сплошной акцент.
  const SET = {
    /* ---------- Интерфейс ---------- */
    back:  { vb: 24, body: '<path class="s" d="M19 12H5M11 6l-6 6 6 6"/>' },
    next:  { vb: 24, body: '<path class="s" d="M5 12h14M13 6l6 6-6 6"/>' },
    check: { vb: 24, body: '<path class="s" d="M5 12.5l4.5 4.5L19 7"/>' },
    cross: { vb: 24, body: '<path class="s" d="M6 6l12 12M18 6L6 18"/>' },
    play:  { vb: 24, body: '<path class="k" d="M8 5.5v13l11-6.5z"/>' },
    skip:  { vb: 24, body: '<path class="k" d="M5 6v12l10-6z"/><path class="s" d="M18.5 6v12"/>' },
    note:  { vb: 24, body: '<path class="s" d="M9 18V5.5l10-2V16"/><circle class="k" cx="6.8" cy="18" r="2.6"/><circle class="k" cx="16.8" cy="16" r="2.6"/>' },

    /* ---------- Достижения и подсказки ---------- */
    star: { vb: 24, body:
      '<path class="f" d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>' +
      '<path class="s" d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>' },
    gem: { vb: 24, body:
      '<path class="f" d="M12 3l8 9-8 9-8-9z"/>' +
      '<path class="s" d="M12 3l8 9-8 9-8-9z"/><path class="s" d="M4 12h16M9 12l3-9 3 9-3 9z"/>' },
    spark: { vb: 24, body:
      '<path class="f" d="M12 2c.8 5 2.6 8.2 10 10-7.4 1.8-9.2 5-10 10-.8-5-2.6-8.2-10-10 7.4-1.8 9.2-5 10-10z"/>' +
      '<path class="s" d="M12 2c.8 5 2.6 8.2 10 10-7.4 1.8-9.2 5-10 10-.8-5-2.6-8.2-10-10 7.4-1.8 9.2-5 10-10z"/>' },
    combo: { vb: 24, body:
      '<path class="f" d="M12 2.5l3.2 3.2-3.2 3.2-3.2-3.2zM12 15.1l3.2 3.2-3.2 3.2-3.2-3.2zM2.5 12l3.2-3.2L8.9 12l-3.2 3.2zM15.1 12l3.2-3.2L21.5 12l-3.2 3.2z"/>' +
      '<path class="s" d="M12 2.5l3.2 3.2-3.2 3.2-3.2-3.2zM12 15.1l3.2 3.2-3.2 3.2-3.2-3.2zM2.5 12l3.2-3.2L8.9 12l-3.2 3.2zM15.1 12l3.2-3.2L21.5 12l-3.2 3.2z"/>' +
      '<path class="k" d="M12 9.6l2.4 2.4-2.4 2.4-2.4-2.4z"/>' },
    rosette: { vb: 24, body:
      '<path class="f" d="M12 2l2.2 4.3L19 5l-1.3 4.8L22 12l-4.3 2.2L19 19l-4.8-1.3L12 22l-2.2-4.3L5 19l1.3-4.8L2 12l4.3-2.2L5 5l4.8 1.3z"/>' +
      '<path class="s" d="M12 2l2.2 4.3L19 5l-1.3 4.8L22 12l-4.3 2.2L19 19l-4.8-1.3L12 22l-2.2-4.3L5 19l1.3-4.8L2 12l4.3-2.2L5 5l4.8 1.3z"/>' +
      '<circle class="s" cx="12" cy="12" r="3"/>' },
    flower: { vb: 24, body:
      '<g class="f"><circle cx="12" cy="6.9" r="3.7"/><circle cx="16.9" cy="10.5" r="3.7"/><circle cx="15" cy="16.2" r="3.7"/><circle cx="9" cy="16.2" r="3.7"/><circle cx="7.1" cy="10.5" r="3.7"/></g>' +
      '<g class="s"><circle cx="12" cy="6.9" r="3.7"/><circle cx="16.9" cy="10.5" r="3.7"/><circle cx="15" cy="16.2" r="3.7"/><circle cx="9" cy="16.2" r="3.7"/><circle cx="7.1" cy="10.5" r="3.7"/></g>' +
      '<circle class="k" cx="12" cy="12" r="2.1"/>' },
    infinity: { vb: 24, body:
      '<path class="s" d="M12 12c-2-3-3.5-4.5-5.5-4.5a4.5 4.5 0 0 0 0 9c2 0 3.5-1.5 5.5-4.5s3.5-4.5 5.5-4.5a4.5 4.5 0 0 1 0 9c-2 0-3.5-1.5-5.5-4.5z"/>' },
    flag: { vb: 24, body:
      '<path class="f" d="M6 4h12l-2.6 4L18 12H6z"/>' +
      '<path class="s" d="M6 4h12l-2.6 4L18 12H6M6 21V3"/>' },
    layers: { vb: 24, body:
      '<path class="f" d="M12 3l9 4.5-9 4.5-9-4.5z"/>' +
      '<path class="s" d="M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"/>' },

    /* ---------- Крупные карточки (48×48): бесконечный режим ---------- */
    leaf: { vb: 48, body:        // «Спокойный» — молодая веточка
      '<path class="f" d="M24 30C14 30 8 23 8 12c10 0 17 5 16 18zM25 22c0-8 5-13 15-14 0 11-6 16-15 14z"/>' +
      '<path class="s" d="M24 30C14 30 8 23 8 12c10 0 17 5 16 18zM25 22c0-8 5-13 15-14 0 11-6 16-15 14z"/>' +
      '<path class="s" d="M24 43c0-9 0-16 0-27M24 33l-9-8M24 26l9-8"/>' +
      '<circle class="k" cx="24" cy="43.5" r="1.6"/>' },
    bamboo: { vb: 48, body:      // «Классический» — стебли бамбука
      '<g class="f"><rect x="8" y="12" width="7" height="32" rx="3.5"/><rect x="20.5" y="5" width="7" height="39" rx="3.5"/><rect x="33" y="15" width="7" height="29" rx="3.5"/></g>' +
      '<g class="s"><rect x="8" y="12" width="7" height="32" rx="3.5"/><rect x="20.5" y="5" width="7" height="39" rx="3.5"/><rect x="33" y="15" width="7" height="29" rx="3.5"/>' +
      '<path d="M8 22h7M8 33h7M20.5 15h7M20.5 26h7M20.5 36h7M33 25h7M33 35h7"/>' +
      '<path d="M15 18c4-1 7-4 8-8M33 22c-4-1-6-4-7-7"/></g>' },
    maple: { vb: 48, body:       // «Большой» — кленовый лист
      '<path class="f" d="M24 4l4.2 8.3 6.3-3.2-2.3 9.4 8.8-2.6-3.6 6.8 5.6 3.4-10.3 5.6 1.1 4.3-9.8-1.2V44h-2v-9.2l-9.8 1.2 1.1-4.3L7 26.1l5.6-3.4L9 15.9l8.8 2.6-2.3-9.4 6.3 3.2z"/>' +
      '<path class="s" d="M24 4l4.2 8.3 6.3-3.2-2.3 9.4 8.8-2.6-3.6 6.8 5.6 3.4-10.3 5.6 1.1 4.3-9.8-1.2V44h-2v-9.2l-9.8 1.2 1.1-4.3L7 26.1l5.6-3.4L9 15.9l8.8 2.6-2.3-9.4 6.3 3.2z"/>' +
      '<path class="s" d="M24 34V16M24 28l-7-6M24 28l7-6"/>' },
  };

  // Старые символы → имена (для данных, где ещё остались юникод-значки)
  const ALIAS = {
    '★': 'star', '◆': 'gem', '✦': 'spark', '❖': 'combo', '✵': 'rosette',
    '✿': 'flower', '∞': 'infinity', '☰': 'flag', '◈': 'layers',
    '✓': 'check', '✗': 'cross', '✕': 'cross', '←': 'back', '→': 'next',
    '▶': 'play', '⏭': 'skip', '♪': 'note',
    '🌿': 'leaf', '🎋': 'bamboo', '🍁': 'maple',
  };

  function resolve(name) {
    return SET[name] ? name : (ALIAS[name] && SET[ALIAS[name]] ? ALIAS[name] : null);
  }

  // Строка с готовым <svg>. size — в px (по умолчанию 1em: растёт вместе с текстом).
  function get(name, opts) {
    const key = resolve(name);
    const o = opts || {};
    if (!key) return '';
    const ic = SET[key];
    const size = o.size ? o.size + 'px' : '1em';
    return '<svg class="ico-svg" viewBox="0 0 ' + ic.vb + ' ' + ic.vb + '" width="' + size +
      '" height="' + size + '" aria-hidden="true" focusable="false">' + ic.body + '</svg>';
  }

  // Подпись с иконкой: label('Далее', 'next', 'after') → «Далее →»
  function label(text, name, where) {
    const svg = get(name);
    return where === 'before' ? svg + '<span>' + text + '</span>' : '<span>' + text + '</span>' + svg;
  }

  // Заменить все <… data-icon="имя"> на SVG
  function hydrate(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope) return 0;
    let n = 0;
    scope.querySelectorAll('[data-icon]').forEach(el => {
      const svg = get(el.getAttribute('data-icon'), { size: el.getAttribute('data-size') || 0 });
      if (svg) { el.innerHTML = svg; el.classList.add('ico'); n++; }
    });
    return n;
  }

  return { get, label, hydrate, names: Object.keys(SET), has: n => !!resolve(n), ALIAS };
})();
