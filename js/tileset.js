/* ============================================================
   TILESET.JS — Определение 144 фишек маджонга
   Каждая фишка рисуется как детальный SVG с настоящими
   китайскими символами, реалистичными точками, бамбуком.
   ============================================================ */

const Tileset = (function () {

  // ---------- SVG-обёртка ----------
  function svg(inner, viewBox = '0 0 100 120') {
    return `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" class="tile-face-svg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  // ---------- ТОЧКИ (Dots/饼) ----------
  // Реалистичные точки с градиентом и бликами, как на настоящих фишках
  function dotsFace(n) {
    // Большая точка для 1 — традиционно красная с орнаментом
    if (n === 1) {
      return svg(`
        <defs>
          <radialGradient id="dot1" cx="35%" cy="35%">
            <stop offset="0%" stop-color="#ff6b6b"/>
            <stop offset="60%" stop-color="#c8202a"/>
            <stop offset="100%" stop-color="#7a1420"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="60" r="26" fill="url(#dot1)" stroke="#5a0e18" stroke-width="1.5"/>
        <circle cx="42" cy="50" r="8" fill="rgba(255,255,255,0.4)"/>
        <circle cx="50" cy="60" r="26" fill="none" stroke="rgba(255,200,200,0.6)" stroke-width="0.5"/>
      `);
    }
    // Для 2-9 используем разные цвета (классика — красный/зелёный/синий)
    const colors = {
      2: ['#1f7a3a', '#0d4a22'],
      3: ['#c8202a', '#7a1420'],
      4: ['#1f7a3a', '#0d4a22'],
      5: ['#c8202a', '#7a1420'],
      6: ['#1f7a3a', '#0d4a22'],
      7: ['#c8202a', '#7a1420'],
      8: ['#1f7a3a', '#0d4a22'],
      9: ['#c8202a', '#7a1420'],
    };
    const [main, dark] = colors[n];
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
    const r = n >= 7 ? 8 : 10;
    const circles = pts.map(([cx, cy]) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${main}" stroke="${dark}" stroke-width="0.8"/>
      <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.35}" fill="rgba(255,255,255,0.4)"/>
    `).join('');
    return svg(circles);
  }

  // ---------- БАМБУК (Bamboo/索) ----------
  // 1 бамбук — птичка (традиция), 2-9 — зелёные палочки с узлами
  function bambooFace(n) {
    if (n === 1) {
      // 1 бамбук — стилизованная птичка на бамбуке
      return svg(`
        <defs>
          <linearGradient id="birdBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3a9a5a"/>
            <stop offset="100%" stop-color="#1a5a2a"/>
          </linearGradient>
        </defs>
        <!-- стебель бамбука -->
        <rect x="48" y="68" width="4" height="34" fill="#8a5a1f" stroke="#5a3a0f" stroke-width="0.5"/>
        <line x1="50" y1="78" x2="50" y2="80" stroke="#5a3a0f" stroke-width="0.5"/>
        <line x1="50" y1="92" x2="50" y2="94" stroke="#5a3a0f" stroke-width="0.5"/>
        <!-- тело птицы -->
        <path d="M50 28 Q28 32 24 56 Q34 62 50 56 Q66 62 76 56 Q72 32 50 28 Z" fill="url(#birdBody)" stroke="#0d4a22" stroke-width="1"/>
        <!-- глаз -->
        <circle cx="40" cy="44" r="2.5" fill="#1a1a1a"/>
        <circle cx="39" cy="43" r="0.8" fill="#fff"/>
        <!-- клюв -->
        <path d="M30 48 L26 50 L30 52 Z" fill="#e8a83a" stroke="#7a5520" stroke-width="0.4"/>
        <!-- крыло -->
        <path d="M40 50 Q48 56 60 50" fill="none" stroke="#0d4a22" stroke-width="1.2"/>
        <!-- хохолок -->
        <path d="M50 28 L52 22 L48 24" fill="none" stroke="#0d4a22" stroke-width="1.2"/>
      `);
    }
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
      const h = 22;
      const w = 5;
      return `
        <rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="1.5" fill="#1f7a3a" stroke="#0d4a22" stroke-width="0.6"/>
        <line x1="${cx - w/2}" y1="${cy - h/4}" x2="${cx + w/2}" y2="${cy - h/4}" stroke="#0d4a22" stroke-width="0.4"/>
        <line x1="${cx - w/2}" y1="${cy + h/4}" x2="${cx + w/2}" y2="${cy + h/4}" stroke="#0d4a22" stroke-width="0.4"/>
        <rect x="${cx - w/2 + 1}" y="${cy - h/2 + 1}" width="${w - 2}" height="${h - 2}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.4"/>
      `;
    }).join('');
    return svg(sticks);
  }

  // ---------- СИМВОЛЫ (Characters/万) ----------
  function charFace(n) {
    const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const num = numerals[n - 1];
    return svg(`
      <text x="50" y="50" text-anchor="middle" font-size="40" font-weight="700"
            fill="#1a1a1a" font-family="'Noto Serif SC', 'Songti SC', serif">${num}</text>
      <text x="50" y="98" text-anchor="middle" font-size="40" font-weight="700"
            fill="#c8202a" font-family="'Noto Serif SC', 'Songti SC', serif">万</text>
    `);
  }

  // ---------- ВЕТРЫ (Winds/风) ----------
  function windFace(wind) {
    const map = { E: '東', S: '南', W: '西', N: '北' };
    const colors = { E: '#1a1a1a', S: '#1a1a1a', W: '#1a1a1a', N: '#1a1a1a' };
    return svg(`
      <text x="50" y="76" text-anchor="middle" font-size="68" font-weight="700"
            fill="${colors[wind]}" font-family="'Noto Serif SC', 'Songti SC', serif">${map[wind]}</text>
    `);
  }

  // ---------- ДРАКОНЫ (Dragons/箭) ----------
  // Красный 中 — каллиграфический, Зелёный 發 — каллиграфический, Белый — рамка с орнаментом
  function dragonFace(dragon) {
    if (dragon === 'R') {
      return svg(`
        <rect x="18" y="32" width="64" height="56" fill="none" stroke="#c8202a" stroke-width="1" opacity="0.3"/>
        <text x="50" y="80" text-anchor="middle" font-size="68" font-weight="900"
              fill="#c8202a" font-family="'Noto Serif SC', 'Songti SC', serif">中</text>
      `);
    }
    if (dragon === 'G') {
      return svg(`
        <rect x="18" y="32" width="64" height="56" fill="none" stroke="#1f7a3a" stroke-width="1" opacity="0.3"/>
        <text x="50" y="80" text-anchor="middle" font-size="60" font-weight="900"
              fill="#1f7a3a" font-family="'Noto Serif SC', 'Songti SC', serif">發</text>
      `);
    }
    // Белый дракон — рамка с орнаментом (традиционно — пустая синяя рамка)
    return svg(`
      <rect x="18" y="32" width="64" height="56" rx="2" fill="none" stroke="#1a3a5a" stroke-width="3"/>
      <rect x="24" y="38" width="52" height="44" rx="1" fill="none" stroke="#1a3a5a" stroke-width="1" opacity="0.5"/>
      <text x="50" y="70" text-anchor="middle" font-size="28" font-weight="700"
            fill="#1a3a5a" font-family="'Noto Serif SC', serif">白</text>
    `);
  }

  // ---------- ЦВЕТЫ (Flowers/花) ----------
  function flowerFace(flower) {
    const flowers = [
      // 梅 (слива) — розовая
      { name: '梅', color: '#d63384', bg: 'rgba(214, 51, 132, 0.08)', petals: 5 },
      // 兰 (орхидея) — фиолетовая
      { name: '蘭', color: '#7a3a9a', bg: 'rgba(122, 58, 154, 0.08)', petals: 5 },
      // 菊 (хризантема) — золотая
      { name: '菊', color: '#e8a83a', bg: 'rgba(232, 168, 58, 0.08)', petals: 8 },
      // 竹 (бамбук-цветок) — зелёный
      { name: '竹', color: '#2c7a3a', bg: 'rgba(44, 122, 58, 0.08)', petals: 6 },
    ];
    const f = flowers[flower - 1];
    // Рисуем декоративный круг-медальон с символом
    let petalsSvg = '';
    if (f.petals) {
      for (let i = 0; i < f.petals; i++) {
        const angle = (i / f.petals) * Math.PI * 2 - Math.PI / 2;
        const px = 50 + Math.cos(angle) * 22;
        const py = 50 + Math.sin(angle) * 22;
        petalsSvg += `<circle cx="${px}" cy="${py}" r="6" fill="${f.color}" opacity="0.25"/>`;
      }
    }
    return svg(`
      ${petalsSvg}
      <circle cx="50" cy="50" r="20" fill="${f.bg}" stroke="${f.color}" stroke-width="1" opacity="0.7"/>
      <text x="50" y="58" text-anchor="middle" font-size="26" font-weight="700"
            fill="${f.color}" font-family="'Noto Serif SC', 'Songti SC', serif">${f.name}</text>
      <text x="50" y="102" text-anchor="middle" font-size="13"
            fill="#666" font-family="'Noto Serif SC', serif">花</text>
    `);
  }

  // ---------- СЕЗОНЫ (Seasons/季) ----------
  function seasonFace(season) {
    const seasons = [
      { name: '春', color: '#5c9a3a', desc: '春', icon: '🌸' }, // весна
      { name: '夏', color: '#d6772a', desc: '夏' }, // лето
      { name: '秋', color: '#c8662a', desc: '秋' }, // осень
      { name: '冬', color: '#3a6a8a', desc: '冬' }, // зима
    ];
    const s = seasons[season - 1];
    return svg(`
      <circle cx="50" cy="50" r="22" fill="rgba(0,0,0,0.04)" stroke="${s.color}" stroke-width="1" opacity="0.7"/>
      <text x="50" y="58" text-anchor="middle" font-size="26" font-weight="700"
            fill="${s.color}" font-family="'Noto Serif SC', 'Songti SC', serif">${s.name}</text>
      <text x="50" y="102" text-anchor="middle" font-size="13"
            fill="#666" font-family="'Noto Serif SC', serif">季</text>
    `);
  }

  // ---------- Сборка тайлсета ----------
  const tiles = [];
  let nextId = 0;

  function addTile(suit, rank, name, face) {
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
    if (!a || !b || a.id === b.id) return false;
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
