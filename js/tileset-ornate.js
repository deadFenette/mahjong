/* ============================================================
   TILESET.JS — v19 «Ультратрадиционный» скин фишек маджонга

   Богатый декоративный SVG в стиле настоящих лакированных фишек
   из дорогого маджонг-набора: глубокие градиенты, золотая гравировка,
   тёмные тени, мелкая сетка-орнамент на фоне, тонкие контурные рамки.

   Дизайн-принципы:
   - Каждая фишка — не просто символ на фоне, а мини-картинка:
     золотая рамка-«гравюра» с орнаментом, тёмная подложка под символ
     для контраста, акцентный цвет масти (красный/зелёный/синий/чёрный).
   - Все SVG используют <defs> с уникальными id (radialGradient,
     linearGradient) — Render.makeFaceUnique делает их уникальными
     на экземпляр, чтобы 4 копии одной фишки не конфликтовали.
   - Размер viewBox 100×120 (соотношение 5:6, как настоящая фишка).
   - Все url(#id) имеют парные id="..." — тесты это проверяют.
   - Тексты используют 'Noto Serif SC', 'Songti SC', serif —
     каллиграфический шрифт, доступный в браузере.
   ============================================================ */

const TilesetOrnate = (function () {

  // ---------- SVG-обёртка ----------
  function svg(inner, viewBox = '0 0 100 120') {
    return `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" class="tile-face-svg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  // ---------- Общий декор: золотая рамка-гравировка + орнамент фона ----------
  // Возвращает defs + фоновые элементы, которые рисуются ПОД символом.
  // Уникальные id = 'g' + suffix — Render.makeFaceUnique подменит их.
  function decorFrame(suffix) {
    return `
      <defs>
        <linearGradient id="goldFrame${suffix}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5d57a"/>
          <stop offset="35%" stop-color="#d4a955"/>
          <stop offset="70%" stop-color="#a87833"/>
          <stop offset="100%" stop-color="#6a4818"/>
        </linearGradient>
        <linearGradient id="goldInner${suffix}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fce8a8"/>
          <stop offset="50%" stop-color="#e8c878"/>
          <stop offset="100%" stop-color="#b8902a"/>
        </linearGradient>
        <radialGradient id="bgGlow${suffix}" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stop-color="rgba(255, 245, 220, 0.55)"/>
          <stop offset="55%" stop-color="rgba(255, 240, 210, 0.18)"/>
          <stop offset="100%" stop-color="rgba(180, 140, 70, 0.08)"/>
        </radialGradient>
      </defs>
      <!-- мягкое свечение под символом — фишка как бы подсвечена изнутри -->
      <rect x="6" y="6" width="88" height="108" rx="6" fill="url(#bgGlow${suffix})"/>
      <!-- внешняя золотая рамка -->
      <rect x="5" y="5" width="90" height="110" rx="7" fill="none"
            stroke="url(#goldFrame${suffix})" stroke-width="2.2"/>
      <!-- внутренняя тонкая золотая линия -->
      <rect x="9" y="9" width="82" height="102" rx="5" fill="none"
            stroke="url(#goldInner${suffix})" stroke-width="0.8" opacity="0.85"/>
      <!-- угловые акценты-«жемчужины» (традиционный мотив) -->
      <circle cx="12" cy="12" r="1.8" fill="url(#goldInner${suffix})"/>
      <circle cx="88" cy="12" r="1.8" fill="url(#goldInner${suffix})"/>
      <circle cx="12" cy="108" r="1.8" fill="url(#goldInner${suffix})"/>
      <circle cx="88" cy="108" r="1.8" fill="url(#goldInner${suffix})"/>
    `;
  }

  // ---------- ТОЧКИ (Dots/饼) ----------
  function dotsFace(n) {
    if (n === 1) {
      // 1 точка — большая красная с золотым ободком и бликующим центром
      return svg(`
        ${decorFrame('Dot1')}
        <defs>
          <radialGradient id="dotBig" cx="38%" cy="35%">
            <stop offset="0%" stop-color="#ff8a8a"/>
            <stop offset="40%" stop-color="#e63a3a"/>
            <stop offset="80%" stop-color="#9a1820"/>
            <stop offset="100%" stop-color="#5a0e18"/>
          </radialGradient>
          <radialGradient id="dotGoldRing" cx="50%" cy="40%">
            <stop offset="0%" stop-color="#f5d57a"/>
            <stop offset="100%" stop-color="#8a6020"/>
          </radialGradient>
        </defs>
        <!-- золотой ободок -->
        <circle cx="50" cy="60" r="30" fill="none" stroke="url(#dotGoldRing)" stroke-width="2.5"/>
        <!-- основная точка -->
        <circle cx="50" cy="60" r="26" fill="url(#dotBig)" stroke="#5a0e18" stroke-width="1.2"/>
        <!-- блик -->
        <ellipse cx="42" cy="50" rx="8" ry="6" fill="rgba(255,255,255,0.55)"/>
        <circle cx="44" cy="52" r="3" fill="rgba(255,255,255,0.85)"/>
        <!-- внутреннее золотое колечко -->
        <circle cx="50" cy="60" r="20" fill="none" stroke="rgba(245, 213, 122, 0.4)" stroke-width="0.8"/>
      `);
    }
    // 2-9: точки с золотым ободком, цвет чередуется красный/зелёный (классика)
    const isRed = n % 2 === 1;
    const main = isRed ? '#c8202a' : '#1f7a3a';
    const dark = isRed ? '#7a1420' : '#0d4a22';
    const light = isRed ? '#ff8a8a' : '#5cb87a';
    const positions = {
      2: [[35, 38], [65, 78]],
      3: [[28, 28], [50, 60], [72, 92]],
      4: [[30, 32], [70, 32], [30, 88], [70, 88]],
      5: [[28, 28], [72, 28], [50, 60], [28, 92], [72, 92]],
      6: [[28, 24], [72, 24], [28, 60], [72, 60], [28, 96], [72, 96]],
      7: [[50, 18], [28, 42], [72, 42], [50, 60], [28, 78], [72, 78], [50, 96]],
      8: [[28, 22], [72, 22], [28, 46], [72, 46], [28, 74], [72, 74], [28, 98], [72, 98]],
      9: [[25, 18], [50, 18], [75, 18], [25, 46], [50, 46], [75, 46], [25, 74], [50, 74], [75, 74]],
    };
    const pts = positions[n] || [];
    const r = n >= 7 ? 8 : (n >= 5 ? 9 : 10);
    const circles = pts.map(([cx, cy]) => `
      <circle cx="${cx}" cy="${cy}" r="${r + 1.5}" fill="none" stroke="url(#goldInnerDot${n})" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${main}" stroke="${dark}" stroke-width="0.8"/>
      <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.35}" fill="${light}" opacity="0.7"/>
      <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.15}" fill="rgba(255,255,255,0.9)"/>
    `).join('');
    return svg(`
      ${decorFrame('Dot' + n)}
      <defs>
        <linearGradient id="goldInnerDot${n}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5d57a"/>
          <stop offset="100%" stop-color="#8a6020"/>
        </linearGradient>
      </defs>
      ${circles}
    `);
  }

  // ---------- БАМБУК (Bamboo/索) ----------
  function bambooFace(n) {
    if (n === 1) {
      // 1 бамбук — стилизованная птичка на бамбуке, богатый дизайн
      return svg(`
        ${decorFrame('Bam1')}
        <defs>
          <linearGradient id="birdBody1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#5cb87a"/>
            <stop offset="50%" stop-color="#2c8a4a"/>
            <stop offset="100%" stop-color="#0d4a22"/>
          </linearGradient>
          <linearGradient id="bambooStem1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#6a4020"/>
            <stop offset="50%" stop-color="#a8783a"/>
            <stop offset="100%" stop-color="#4a2810"/>
          </linearGradient>
          <radialGradient id="birdHead1" cx="40%" cy="35%">
            <stop offset="0%" stop-color="#7ad08a"/>
            <stop offset="100%" stop-color="#1a5a2a"/>
          </radialGradient>
        </defs>
        <!-- стебель бамбука с узлами -->
        <rect x="46" y="68" width="8" height="34" rx="1" fill="url(#bambooStem1)" stroke="#3a1f08" stroke-width="0.6"/>
        <rect x="44" y="78" width="12" height="2.5" rx="0.5" fill="#5a3a18" stroke="#3a1f08" stroke-width="0.4"/>
        <rect x="44" y="92" width="12" height="2.5" rx="0.5" fill="#5a3a18" stroke="#3a1f08" stroke-width="0.4"/>
        <!-- листик на стебле -->
        <path d="M54 80 Q 62 78 64 72 Q 58 76 54 80 Z" fill="#2c8a4a" stroke="#0d4a22" stroke-width="0.5"/>
        <!-- тело птицы (полумесяц) -->
        <path d="M50 28 Q28 32 24 56 Q34 62 50 56 Q66 62 76 56 Q72 32 50 28 Z"
              fill="url(#birdBody1)" stroke="#0d4a22" stroke-width="1.2"/>
        <!-- голова/шейка -->
        <ellipse cx="50" cy="32" rx="10" ry="8" fill="url(#birdHead1)" stroke="#0d4a22" stroke-width="1"/>
        <!-- глаз -->
        <circle cx="44" cy="30" r="3" fill="#1a1a1a"/>
        <circle cx="44" cy="30" r="2.2" fill="#0a0a0a"/>
        <circle cx="43" cy="29" r="0.9" fill="#fff"/>
        <!-- клюв золотой -->
        <path d="M32 32 L26 34 L32 36 Z" fill="url(#goldInnerBam1)" stroke="#5a3a18" stroke-width="0.4"/>
        <!-- крыло (дуговая линия) -->
        <path d="M38 50 Q 50 60 64 50" fill="none" stroke="#0d4a22" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M42 54 Q 50 60 60 54" fill="none" stroke="#0d4a22" stroke-width="0.8" stroke-linecap="round"/>
        <!-- хохолок -->
        <path d="M50 22 L52 14 L48 18 M50 22 L46 16 L50 22" fill="none" stroke="#0d4a22" stroke-width="1.2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="goldInnerBam1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f5d57a"/>
            <stop offset="100%" stop-color="#8a6020"/>
          </linearGradient>
        </defs>
      `);
    }
    // 2-9 бамбук — зелёные палочки с золотыми узлами
    const positions = {
      2: [[35, 38], [65, 78]],
      3: [[28, 28], [50, 60], [72, 92]],
      4: [[30, 32], [70, 32], [30, 88], [70, 88]],
      5: [[28, 28], [72, 28], [50, 60], [28, 92], [72, 92]],
      6: [[28, 24], [72, 24], [28, 60], [72, 60], [28, 96], [72, 96]],
      7: [[50, 16], [28, 42], [72, 42], [50, 60], [28, 78], [72, 78], [50, 96]],
      8: [[28, 22], [72, 22], [50, 40], [28, 58], [72, 58], [50, 76], [28, 96], [72, 96]],
      9: [[25, 18], [50, 18], [75, 18], [25, 46], [50, 46], [75, 46], [25, 74], [50, 74], [75, 74]],
    };
    const pts = positions[n] || [];
    const sticks = pts.map(([cx, cy]) => {
      const h = 24;
      const w = 5.5;
      return `
        <rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="1.8"
              fill="url(#bambooGrad${n})" stroke="#0d4a22" stroke-width="0.7"/>
        <!-- золотые узлы -->
        <rect x="${cx - w/2 - 0.5}" y="${cy - h/4}" width="${w + 1}" height="2" rx="0.5"
              fill="url(#bambooGold${n})" stroke="#5a3a18" stroke-width="0.3"/>
        <rect x="${cx - w/2 - 0.5}" y="${cy + h/4}" width="${w + 1}" height="2" rx="0.5"
              fill="url(#bambooGold${n})" stroke="#5a3a18" stroke-width="0.3"/>
        <!-- блик -->
        <rect x="${cx - w/2 + 1}" y="${cy - h/2 + 2}" width="${w - 3}" height="${h - 4}"
              fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="0.5"/>
      `;
    }).join('');
    return svg(`
      ${decorFrame('Bam' + n)}
      <defs>
        <linearGradient id="bambooGrad${n}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0d4a22"/>
          <stop offset="35%" stop-color="#2c8a4a"/>
          <stop offset="65%" stop-color="#1f7a3a"/>
          <stop offset="100%" stop-color="#0d4a22"/>
        </linearGradient>
        <linearGradient id="bambooGold${n}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f5d57a"/>
          <stop offset="100%" stop-color="#8a6020"/>
        </linearGradient>
      </defs>
      ${sticks}
    `);
  }

  // ---------- СИМВОЛЫ (Characters/万) ----------
  function charFace(n) {
    const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const num = numerals[n - 1];
    return svg(`
      ${decorFrame('Char' + n)}
      <!-- верхний иероглиф (число) — чёрный, каллиграфический -->
      <text x="50" y="52" text-anchor="middle" font-size="42" font-weight="700"
            fill="#1a1a1a" stroke="rgba(255, 240, 200, 0.6)" stroke-width="0.4"
            font-family="'Noto Serif SC', 'Songti SC', serif">${num}</text>
      <!-- нижний иероглиф 万 — красный, как на классических фишках -->
      <text x="50" y="102" text-anchor="middle" font-size="42" font-weight="700"
            fill="#c8202a" stroke="rgba(255, 200, 180, 0.5)" stroke-width="0.4"
            font-family="'Noto Serif SC', 'Songti SC', serif">万</text>
      <!-- разделительная золотая линия между числом и 万 -->
      <line x1="22" y1="68" x2="78" y2="68" stroke="url(#goldInnerChar${n})" stroke-width="0.8" opacity="0.6"/>
      <defs>
        <linearGradient id="goldInnerChar${n}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(245, 213, 122, 0)"/>
          <stop offset="50%" stop-color="rgba(245, 213, 122, 0.9)"/>
          <stop offset="100%" stop-color="rgba(245, 213, 122, 0)"/>
        </linearGradient>
      </defs>
    `);
  }

  // ---------- ВЕТРЫ (Winds/风) ----------
  function windFace(wind) {
    const map = { E: '東', S: '南', W: '西', N: '北' };
    const accentColor = { E: '#c8202a', S: '#1f7a3a', W: '#1a3a5a', N: '#1a1a1a' };
    const accent = accentColor[wind];
    return svg(`
      ${decorFrame('Wind' + wind)}
      <!-- каллиграфический иероглиф с обводкой -->
      <text x="50" y="78" text-anchor="middle" font-size="72" font-weight="900"
            fill="${accent}" stroke="rgba(255, 240, 200, 0.4)" stroke-width="0.5"
            font-family="'Noto Serif SC', 'Songti SC', serif">${map[wind]}</text>
      <!-- акцентная точка-маркер внизу -->
      <circle cx="50" cy="104" r="2.5" fill="${accent}" opacity="0.7"/>
      <circle cx="50" cy="104" r="1.2" fill="rgba(255, 240, 200, 0.85)"/>
    `);
  }

  // ---------- ДРАКОНЫ (Dragons/箭) ----------
  function dragonFace(dragon) {
    if (dragon === 'R') {
      // Красный дракон 中 — самый мощный символ в маджонге
      return svg(`
        ${decorFrame('DragR')}
        <!-- декоративная рамка вокруг символа -->
        <rect x="20" y="32" width="60" height="56" rx="2" fill="none"
              stroke="url(#goldInnerDragR)" stroke-width="1.2" opacity="0.6"/>
        <rect x="24" y="36" width="52" height="48" rx="1" fill="none"
              stroke="rgba(200, 32, 42, 0.3)" stroke-width="0.6"/>
        <!-- сам иероглиф 中 — крупный, насыщенный красный -->
        <text x="50" y="82" text-anchor="middle" font-size="72" font-weight="900"
              fill="#c8202a" stroke="rgba(255, 200, 180, 0.5)" stroke-width="0.5"
              font-family="'Noto Serif SC', 'Songti SC', serif">中</text>
        <defs>
          <linearGradient id="goldInnerDragR" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f5d57a"/>
            <stop offset="100%" stop-color="#8a6020"/>
          </linearGradient>
        </defs>
      `);
    }
    if (dragon === 'G') {
      // Зелёный дракон 發
      return svg(`
        ${decorFrame('DragG')}
        <rect x="20" y="32" width="60" height="56" rx="2" fill="none"
              stroke="url(#goldInnerDragG)" stroke-width="1.2" opacity="0.6"/>
        <rect x="24" y="36" width="52" height="48" rx="1" fill="none"
              stroke="rgba(31, 122, 58, 0.3)" stroke-width="0.6"/>
        <text x="50" y="78" text-anchor="middle" font-size="62" font-weight="900"
              fill="#1f7a3a" stroke="rgba(180, 220, 180, 0.5)" stroke-width="0.5"
              font-family="'Noto Serif SC', 'Songti SC', serif">發</text>
        <defs>
          <linearGradient id="goldInnerDragG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f5d57a"/>
            <stop offset="100%" stop-color="#8a6020"/>
          </linearGradient>
        </defs>
      `);
    }
    // Белый дракон — традиционно синяя рамка с символом 白
    return svg(`
      ${decorFrame('DragW')}
      <defs>
        <linearGradient id="blueFrameW" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3a6a9a"/>
          <stop offset="50%" stop-color="#1a3a5a"/>
          <stop offset="100%" stop-color="#0a1a2a"/>
        </linearGradient>
        <linearGradient id="goldInnerDragW" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5d57a"/>
          <stop offset="100%" stop-color="#8a6020"/>
        </linearGradient>
      </defs>
      <!-- внешняя синяя рамка (традиция белого дракона) -->
      <rect x="18" y="32" width="64" height="56" rx="3" fill="none"
            stroke="url(#blueFrameW)" stroke-width="3.5"/>
      <!-- внутренняя золотая рамка -->
      <rect x="22" y="36" width="56" height="48" rx="2" fill="none"
            stroke="url(#goldInnerDragW)" stroke-width="1" opacity="0.8"/>
      <!-- угловые синие акценты рамки -->
      <rect x="16" y="30" width="6" height="6" fill="#1a3a5a"/>
      <rect x="78" y="30" width="6" height="6" fill="#1a3a5a"/>
      <rect x="16" y="84" width="6" height="6" fill="#1a3a5a"/>
      <rect x="78" y="84" width="6" height="6" fill="#1a3a5a"/>
      <!-- символ 白 -->
      <text x="50" y="72" text-anchor="middle" font-size="32" font-weight="700"
            fill="#1a3a5a" stroke="rgba(180, 200, 230, 0.5)" stroke-width="0.4"
            font-family="'Noto Serif SC', serif">白</text>
    `);
  }

  // ---------- ЦВЕТЫ (Flowers/花) ----------
  function flowerFace(flower) {
    const flowers = [
      { name: '梅', color: '#d63384', dark: '#7a1a48', light: '#f06aa8', petals: 5, label: '梅' },  // слива
      { name: '蘭', color: '#7a3a9a', dark: '#3a1a5a', light: '#b87ad8', petals: 5, label: '蘭' },  // орхидея
      { name: '菊', color: '#e8a83a', dark: '#8a6020', light: '#f5d57a', petals: 8, label: '菊' },  // хризантема
      { name: '竹', color: '#2c7a3a', dark: '#0d4a22', light: '#5cb87a', petals: 6, label: '竹' },  // бамбук-цветок
    ];
    const f = flowers[flower - 1];
    // Лепестки вокруг центра
    let petalsSvg = '';
    for (let i = 0; i < f.petals; i++) {
      const angle = (i / f.petals) * Math.PI * 2 - Math.PI / 2;
      const px = 50 + Math.cos(angle) * 22;
      const py = 50 + Math.sin(angle) * 22;
      petalsSvg += `
        <ellipse cx="${px}" cy="${py}" rx="9" ry="6"
                  transform="rotate(${(angle * 180 / Math.PI) + 90} ${px} ${py})"
                  fill="${f.color}" stroke="${f.dark}" stroke-width="0.6" opacity="0.78"/>
        <ellipse cx="${px - 2}" cy="${py - 1}" rx="3" ry="2"
                 transform="rotate(${(angle * 180 / Math.PI) + 90} ${px} ${py})"
                 fill="${f.light}" opacity="0.55"/>
      `;
    }
    return svg(`
      ${decorFrame('Flower' + flower)}
      <defs>
        <radialGradient id="flowerCenter${flower}" cx="40%" cy="35%">
          <stop offset="0%" stop-color="#f5d57a"/>
          <stop offset="60%" stop-color="#d4a955"/>
          <stop offset="100%" stop-color="#6a4818"/>
        </radialGradient>
      </defs>
      <!-- лепестки -->
      ${petalsSvg}
      <!-- золотой центр-медальон -->
      <circle cx="50" cy="50" r="13" fill="url(#flowerCenter${flower})"
              stroke="${f.dark}" stroke-width="1"/>
      <circle cx="46" cy="46" r="3" fill="rgba(255, 245, 200, 0.7)"/>
      <!-- символ цветка в центре -->
      <text x="50" y="56" text-anchor="middle" font-size="18" font-weight="700"
            fill="${f.dark}" font-family="'Noto Serif SC', 'Songti SC', serif">${f.name}</text>
      <!-- подпись 花 внизу -->
      <text x="50" y="104" text-anchor="middle" font-size="13" font-weight="600"
            fill="${f.color}" opacity="0.85"
            font-family="'Noto Serif SC', serif">花</text>
    `);
  }

  // ---------- СЕЗОНЫ (Seasons/季) ----------
  function seasonFace(season) {
    const seasons = [
      { name: '春', color: '#5c9a3a', dark: '#2c5a1a', light: '#8acb6a', icon: '春' },   // весна
      { name: '夏', color: '#d6772a', dark: '#7a3a0a', light: '#f0a560', icon: '夏' },   // лето
      { name: '秋', color: '#c8662a', dark: '#7a2a0a', light: '#e89860', icon: '秋' },   // осень
      { name: '冬', color: '#3a6a8a', dark: '#1a3a5a', light: '#7aa0c0', icon: '冬' },   // зима
    ];
    const s = seasons[season - 1];
    return svg(`
      ${decorFrame('Season' + season)}
      <defs>
        <radialGradient id="seasonBg${season}" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="${s.color}" stop-opacity="0.25"/>
          <stop offset="60%" stop-color="${s.color}" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="${s.color}" stop-opacity="0.04"/>
        </radialGradient>
        <linearGradient id="seasonRing${season}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${s.light}"/>
          <stop offset="50%" stop-color="${s.color}"/>
          <stop offset="100%" stop-color="${s.dark}"/>
        </linearGradient>
      </defs>
      <!-- медальон-фон -->
      <circle cx="50" cy="50" r="26" fill="url(#seasonBg${season})"/>
      <!-- двойное кольцо: внешнее золотое, внутреннее цветное -->
      <circle cx="50" cy="50" r="24" fill="none" stroke="url(#seasonRing${season})" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="20" fill="none" stroke="${s.color}" stroke-width="0.8" opacity="0.6"/>
      <!-- 4 точки-«розы ветров» по сторонам света -->
      <circle cx="50" cy="26" r="1.5" fill="${s.color}"/>
      <circle cx="74" cy="50" r="1.5" fill="${s.color}"/>
      <circle cx="50" cy="74" r="1.5" fill="${s.color}"/>
      <circle cx="26" cy="50" r="1.5" fill="${s.color}"/>
      <!-- символ сезона -->
      <text x="50" y="58" text-anchor="middle" font-size="28" font-weight="700"
            fill="${s.dark}" stroke="rgba(255, 245, 220, 0.4)" stroke-width="0.4"
            font-family="'Noto Serif SC', 'Songti SC', serif">${s.name}</text>
      <!-- подпись 季 -->
      <text x="50" y="104" text-anchor="middle" font-size="13" font-weight="600"
            fill="${s.color}" opacity="0.85"
            font-family="'Noto Serif SC', serif">季</text>
    `);
  }

  // ---------- Сборка тайлсета ----------
  const tiles = [];
  let nextId = 0;

  function addTile(suit, rank, name, face) {
    // 4 копии каждой масти (кроме цветов/сезонов — они по одной ниже)
    for (let i = 0; i < 4; i++) {
      tiles.push({ id: nextId++, suit, rank, name, face });
    }
  }

  const dotNames = ['1 точка', '2 точки', '3 точки', '4 точки', '5 точек', '6 точек', '7 точек', '8 точек', '9 точек'];
  const bambooNames = ['1 бамбук', '2 бамбука', '3 бамбука', '4 бамбука', '5 бамбука', '6 бамбука', '7 бамбуков', '8 бамбуков', '9 бамбуков'];
  const charNames = ['1 万', '2 万', '3 万', '4 万', '5 万', '6 万', '7 万', '8 万', '9 万'];

  for (let n = 1; n <= 9; n++) {
    addTile('dots', n, dotNames[n - 1], dotsFace(n));
    addTile('bamboo', n, bambooNames[n - 1], bambooFace(n));
    addTile('characters', n, charNames[n - 1], charFace(n));
  }

  const winds = [['E', 'Восток'], ['S', 'Юг'], ['W', 'Запад'], ['N', 'Север']];
  winds.forEach(([code, name]) => addTile('winds', code, name, windFace(code)));

  const dragons = [['R', 'Красный дракон'], ['G', 'Зелёный дракон'], ['W', 'Белый дракон']];
  dragons.forEach(([code, name]) => addTile('dragons', code, name, dragonFace(code)));

  const flowerNames = ['Слива', 'Орхидея', 'Хризантема', 'Бамбук-цветок'];
  for (let f = 1; f <= 4; f++) {
    tiles.push({ id: nextId++, suit: 'flowers', rank: f, name: flowerNames[f - 1], face: flowerFace(f) });
  }

  const seasonNames = ['Весна', 'Лето', 'Осень', 'Зима'];
  for (let s = 1; s <= 4; s++) {
    tiles.push({ id: nextId++, suit: 'seasons', rank: s, name: seasonNames[s - 1], face: seasonFace(s) });
  }

  function isMatch(a, b) {
    // v13: защита от «партии с самим собой» — по ССЫЛКЕ на объект,
    // а не по id. Раньше сравнивался id: у раскладок >144 фишек пул
    // дублируется, у двух РАЗНЫХ экземпляров одной фишки оказывался
    // один id — и они не могли собраться никогда (вечный тупик
    // «последние 2 фишки не убрать»). Сравнение по ссылке чинит и
    // старые сейвы, где дубликаты id уже сохранены.
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
})();
// Tileset — фасад, выбирается ниже в tileset.js
