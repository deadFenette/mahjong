/* ============================================================
   LAYOUTS.JS — Раскладки фишек маджонга
   Все раскладки переделаны с правильной классической структурой:
   - ВСЕ строки в раскладке ОДНОЙ длины (maxWidth)
   - Каждый следующий слой на 2 короче (по 1 с каждой стороны)
   - Нечётные слои (z=1, 3, ...) смещаются на пол-фишки в positionTile
   - Все координаты целые (стабильное позиционирование)
   ============================================================ */

const Layouts = (function () {

  function parseLayer(rows) {
    const positions = [];
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'X') positions.push({ x, y });
      }
    }
    return positions;
  }

  function buildLayout(layers) {
    const result = [];
    const layerWidths = layers.map(layer => Math.max(...layer.map(r => r.length)));
    const layerHeights = layers.map(layer => layer.length);
    const maxWidth = Math.max(...layerWidths);
    const maxHeight = Math.max(...layerHeights);

    for (let z = 0; z < layers.length; z++) {
      const layer = layers[z];
      // Y-центрирование: каждый слой вертикально центрирован
      // относительно самого высокого слоя (maxHeight).
      // Это убирает "съезжание" пирамиды вверх.
      const yOff = (maxHeight - layerHeights[z]) / 2;
      const positions = parseLayer(layer);
      positions.forEach(p => {
        result.push({
          x: p.x,
          y: p.y + yOff,
          z: z,
        });
      });
    }
    return { positions: result, width: maxWidth, height: maxHeight };
  }

  // ---------- РАСКЛАДКИ ----------
  // ВАЖНО: все строки в каждой раскладке должны быть ОДНОЙ длины!

  // 1. Пирамида — maxWidth=8
  const pyramid = {
    id: 'pyramid',
    name: 'Пирамида',
    description: 'Простая симметричная форма, отличный старт',
    difficulty: 'easy',
    icon: '△',
    layers: [
      // z=0: 8×8 = 64
      ['XXXXXXXX',
       'XXXXXXXX',
       'XXXXXXXX',
       'XXXXXXXX',
       'XXXXXXXX',
       'XXXXXXXX',
       'XXXXXXXX',
       'XXXXXXXX'],
      // z=1: 6×6 = 36 (со смещением 0.5)
      [' XXXXXX ',
       ' XXXXXX ',
       ' XXXXXX ',
       ' XXXXXX ',
       ' XXXXXX ',
       ' XXXXXX '],
      // z=2: 4×4 = 16
      ['  XXXX  ',
       '  XXXX  ',
       '  XXXX  ',
       '  XXXX  '],
      // z=3: 2×2 = 4 (со смещением 0.5)
      ['   XX   ',
       '   XX   '],
    ],
  };

  // 2. Черепаха — maxWidth=12
  const turtle = {
    id: 'turtle',
    name: 'Черепаха',
    description: 'Классический Шанхай, самая узнаваемая раскладка',
    difficulty: 'normal',
    icon: '🐢',
    layers: [
      // z=0: тело черепахи (12 wide × 8 tall)
      ['  XXXXXXXX  ',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       '  XXXXXXXX  '],
      // z=1: 8×6 = 48 (со смещением 0.5)
      ['  XXXXXXXX  ',
       '  XXXXXXXX  ',
       '  XXXXXXXX  ',
       '  XXXXXXXX  ',
       '  XXXXXXXX  ',
       '  XXXXXXXX  '],
      // z=2: 4×4 = 16
      ['    XXXX    ',
       '    XXXX    ',
       '    XXXX    ',
       '    XXXX    '],
      // z=3: 2×2 = 4 (со смещением 0.5)
      ['     XX     ',
       '     XX     '],
    ],
  };

  // 3. Крест — maxWidth=16
  const cross = {
    id: 'cross',
    name: 'Крест',
    description: 'Симметричный крест, ровные формы',
    difficulty: 'normal',
    icon: '✚',
    layers: [
      // z=0: крест (16 wide × 10 tall)
      ['    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    ',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       '    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    '],
      // z=1: 10×6 = 60 (со смещением 0.5)
      ['    XXXXXXXX    ',
       '    XXXXXXXX    ',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       '    XXXXXXXX    ',
       '    XXXXXXXX    '],
      // z=2: 4×2 = 8
      ['      XXXX      ',
       '      XXXX      '],
      // z=3: 2×1 = 2 (со смещением 0.5)
      ['       XX       '],
    ],
  };

  // 4. Стена — maxWidth=12
  const wall = {
    id: 'wall',
    name: 'Стена',
    description: 'Прямоугольная крепость, просторная',
    difficulty: 'easy',
    icon: '▥',
    layers: [
      // z=0: 12×8 = 96
      ['XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX'],
      // z=1: 10×6 = 60 (со смещением 0.5)
      [' XXXXXXXXXX ',
       ' XXXXXXXXXX ',
       ' XXXXXXXXXX ',
       ' XXXXXXXXXX ',
       ' XXXXXXXXXX ',
       ' XXXXXXXXXX '],
      // z=2: 6×4 = 24
      ['   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   '],
      // z=3: 4×2 = 8 (со смещением 0.5)
      ['    XXXX    ',
       '    XXXX    '],
    ],
  };

  // 5. Лодка — maxWidth=14
  const boat = {
    id: 'boat',
    name: 'Лодка',
    description: 'Лодка с мачтой, симметрия',
    difficulty: 'normal',
    icon: '⛵',
    layers: [
      // z=0: форма лодки (14 wide × 9 tall)
      ['    XXXXXX    ',
       '   XXXXXXXX   ',
       '  XXXXXXXXXX  ',
       ' XXXXXXXXXXXX ',
       'XXXXXXXXXXXXXX',
       ' XXXXXXXXXXXX ',
       '  XXXXXXXXXX  ',
       '   XXXXXXXX   ',
       '    XXXXXX    '],
      // z=1: 10×4 = 40 (со смещением 0.5)
      ['  XXXXXXXXXX  ',
       '  XXXXXXXXXX  ',
       '  XXXXXXXXXX  ',
       '  XXXXXXXXXX  '],
      // z=2: 2×1 = 2
      ['      XX      '],
    ],
  };

  // 6. Бабочка — maxWidth=14
  const butterfly = {
    id: 'butterfly',
    name: 'Бабочка',
    description: 'Крылья бабочки, красивая симметрия',
    difficulty: 'hard',
    icon: '✿',
    layers: [
      // z=0: крылья бабочки (14 wide × 8 tall)
      ['XX          XX',
       'XXXX      XXXX',
       'XXXXXX  XXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXX  XXXXXX',
       'XXXX      XXXX',
       'XX          XX'],
      // z=1: тело 8×2 = 16 — ТОЛЬКО на полных рядах y=3,4.
      // Раньше тело было 8×4 и его углы висели в воздухе над
      // пустотой между крыльями (тест это поймал).
      ['   XXXXXXXX   ',
       '   XXXXXXXX   '],
      // z=2: центр 4×2 = 8
      ['     XXXX     ',
       '     XXXX     '],
      // z=3: усики 2×1 = 2 (со смещением 0.5)
      ['      XX      '],
    ],
  };

  // 7. Сердце — maxWidth=16
  const heart = {
    id: 'heart',
    name: 'Сердце',
    description: 'Форма сердца, тёплая раскладка',
    difficulty: 'normal',
    icon: '♥',
    layers: [
      // z=0: сердце (16 wide × 12 tall)
      ['  XXXX    XXXX  ',
       ' XXXXXX  XXXXXX ',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       ' XXXXXXXXXXXXXX ',
       '  XXXXXXXXXXXX  ',
       '   XXXXXXXXXX   ',
       '    XXXXXXXX    ',
       '     XXXXXX     ',
       '      XXXX      ',
       '       XX       '],
      // z=1: 8×4 = 32 (со смещением 0.5)
      ['    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    '],
      // z=2: 4×2 = 8
      ['      XXXX      ',
       '      XXXX      '],
    ],
  };

  // 8. Паук — maxWidth=16
  const spider = {
    id: 'spider',
    name: 'Паук',
    description: 'Большая раскладка с восемью лапками',
    difficulty: 'hard',
    icon: '✲',
    layers: [
      // z=0: паук с лапками (16 wide × 10 tall)
      ['  XXXX    XXXX  ',
       '  XXXX    XXXX  ',
       '  XXXX    XXXX  ',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       '  XXXX    XXXX  ',
       '  XXXX    XXXX  '],
      // z=1: тело 8×4 = 32 (со смещением 0.5)
      ['    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    '],
      // z=2: центр 4×2 = 8
      ['      XXXX      ',
       '      XXXX      '],
      // z=3: верхушка 2×1 = 2 (со смещением 0.5)
      ['       XX       '],
    ],
  };

  // ============================================================
  //  КАНОНИЧЕСКИЕ РАСКЛАДКИ (v18): 8 новых классических форм
  //  Все они следуют тем же правилам геометрии — чётное число фишек,
  //  каждый верхний слой опирается на нижний (±0.5 допуска).
  // ============================================================

  // 9. Крепость — квадратная крепость с зубцами по углам, maxWidth=16
  const fortress = {
    id: 'fortress',
    name: 'Крепость',
    description: 'Стены с зубцами по углам — оборонительная форма',
    difficulty: 'easy',
    icon: '🏯',
    layers: [
      // z=0: 16×9, зубцы в углах
      ['XXXX        XXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXX        XXXX'],
      // z=1: 12×6 внутренний двор
      ['  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  '],
      // z=2: 6×3 донжон
      ['     XXXXXX     ',
       '     XXXXXX     ',
       '     XXXXXX     '],
      // z=3: 2×1 флаг
      ['       XX       '],
    ],
  };

  // 10. Башня — высокая 5-ярусная, maxWidth=10
  const tower = {
    id: 'tower',
    name: 'Башня',
    description: 'Высокая 5-ярусная башня — самая длинная вертикаль',
    difficulty: 'hard',
    icon: '🗼',
    layers: [
      // z=0: 10×12 основание
      ['XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX'],
      // z=1: 8×9 второй ярус
      [' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX '],
      // z=2: 6×6 третий ярус
      ['  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  '],
      // z=3: 4×3 четвёртый ярус
      ['   XXXX   ',
       '   XXXX   ',
       '   XXXX   '],
      // z=4: 2×1 шпиль
      ['    XX    '],
    ],
  };

  // 11. Мост — арка с перилами, maxWidth=16
  const bridge = {
    id: 'bridge',
    name: 'Мост',
    description: 'Арочный мост с перилами над рекой',
    difficulty: 'normal',
    icon: '🌉',
    layers: [
      // z=0: 16×8 — форма арки
      ['  XXXXXXXXXXXX  ',
       ' XXXXXXXXXXXXXX ',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       ' XXXXXXXXXXXXXX ',
       '  XXXXXXXXXXXX  '],
      // z=1: 16×4 — настил моста
      ['    XXXXXXXX    ',
       '  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  ',
       '    XXXXXXXX    '],
      // z=2: 16×2 — перила
      ['     XXXXXX     ',
       '     XXXXXX     '],
      // z=3: 16×1 — фонарь
      ['       XX       '],
    ],
  };

  // 12. Облако — пухлое с двумя «боками», maxWidth=16
  const cloud = {
    id: 'cloud',
    name: 'Облако',
    description: 'Воздушное облако с двумя боками',
    difficulty: 'normal',
    icon: '☁',
    layers: [
      // z=0: 16×7 — силуэт облака
      ['  XXXX    XXXX  ',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       ' XXXXXXXXXXXXXX ',
       '  XXXXXXXXXXXX  '],
      // z=1: 16×4 — выпуклость
      ['    XXXXXXXX    ',
       '  XXXXXXXXXXXX  ',
       '  XXXXXXXXXXXX  ',
       '    XXXXXXXX    '],
      // z=2: 16×2 — верхушка
      ['      XXXX      ',
       '      XXXX      '],
      // z=3: 16×1 — пик
      ['       XX       '],
    ],
  };

  // 13. Пагода — многоярусная японская пагода, maxWidth=12, height=13
  const pagoda = {
    id: 'pagoda',
    name: 'Пагода',
    description: 'Многоярусная пагода с загнутыми вверх карнизами',
    difficulty: 'hard',
    icon: '⛩',
    layers: [
      // z=0: 12×13 — основание с чередой карнизов
      ['  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  '],
      // z=1: 12×9 — внутренние этажи
      ['   XXXXXX   ',
       '  XXXXXXXX  ',
       '   XXXXXX   ',
       '  XXXXXXXX  ',
       '   XXXXXX   ',
       '  XXXXXXXX  ',
       '   XXXXXX   ',
       '  XXXXXXXX  ',
       '   XXXXXX   '],
      // z=2: 12×5 — верхние ярусы
      ['    XXXX    ',
       '   XXXXXX   ',
       '    XXXX    ',
       '   XXXXXX   ',
       '    XXXX    '],
      // z=3: 12×3 — шпиль-карниз
      ['    XXXX    ',
       '     XX     ',
       '    XXXX    '],
      // z=4: 12×1 — острие
      ['     XX     '],
    ],
  };

  // 14. Кристалл — ромб с острыми концами, maxWidth=14, height=11
  const crystal = {
    id: 'crystal',
    name: 'Кристалл',
    description: 'Огранный кристалл с острыми вершинами',
    difficulty: 'hard',
    icon: '◈',
    layers: [
      // z=0: 14×11 — ромб целиком
      ['      XX      ',
       '     XXXX     ',
       '    XXXXXX    ',
       '   XXXXXXXX   ',
       '  XXXXXXXXXX  ',
       ' XXXXXXXXXXXX ',
       '  XXXXXXXXXX  ',
       '   XXXXXXXX   ',
       '    XXXXXX    ',
       '     XXXX     ',
       '      XX      '],
      // z=1: 14×7 — внутренний ромб
      ['    XXXXXX    ',
       '   XXXXXXXX   ',
       '  XXXXXXXXXX  ',
       ' XXXXXXXXXXXX ',
       '  XXXXXXXXXX  ',
       '   XXXXXXXX   ',
       '    XXXXXX    '],
      // z=2: 14×3 — ядро
      ['   XXXXXXXX   ',
       '  XXXXXXXXXX  ',
       '   XXXXXXXX   '],
      // z=3: 14×1 — кабошон
      ['     XXXX     '],
      // z=4: 14×1 — блик
      ['      XX      '],
    ],
  };

  // 15. Звезда — пятиконечная звезда с лучами, maxWidth=14, height=9
  const star = {
    id: 'star',
    name: 'Звезда',
    description: 'Звезда с расходящимися лучами и плотным центром',
    difficulty: 'normal',
    icon: '★',
    layers: [
      // z=0: 14×9 — звезда с 4 углами-лучами
      ['XX          XX',
       ' XXX      XXX ',
       '  XXXXXXXXXX  ',
       ' XXXXXXXXXXXX ',
       'XXXXXXXXXXXXXX',
       ' XXXXXXXXXXXX ',
       '  XXXXXXXXXX  ',
       ' XXX      XXX ',
       'XX          XX'],
      // z=1: 14×5 — центр звезды
      ['   XXXXXXXX   ',
       '  XXXXXXXXXX  ',
       ' XXXXXXXXXXXX ',
       '  XXXXXXXXXX  ',
       '   XXXXXXXX   '],
      // z=2: 14×3 — ядро
      ['    XXXXXX    ',
       '  XXXXXXXXXX  ',
       '    XXXXXX    '],
      // z=3: 14×1 — центральная точка
      ['     XXXX     '],
      // z=4: 14×1 — блеск
      ['      XX      '],
    ],
  };

  // 16. Цветок — цветок с четырьмя лепестками, maxWidth=12, height=10
  const flower = {
    id: 'flower',
    name: 'Цветок',
    description: 'Цветок с лепестками и плотной сердцевиной',
    difficulty: 'normal',
    icon: '✿',
    layers: [
      // z=0: 12×10 — цветок: верхний и нижний лепестки + боковые
      ['   XXXXXX   ',
       '  XXXXXXXX  ',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XX  XXXX  XX',
       'XX  XXXX  XX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       '  XXXXXXXX  ',
       '   XXXXXX   '],
      // z=1: 12×6 — внутренний круг лепестков
      ['    XXXX    ',
       '  XXXXXXXX  ',
       '    XXXX    ',
       '    XXXX    ',
       '  XXXXXXXX  ',
       '    XXXX    '],
      // z=2: 12×3 — сердцевина
      ['    XXXX    ',
       '    XXXX    ',
       '    XXXX    '],
      // z=3: 12×1 — пестик
      ['     XX     '],
    ],
  };

  // ============================================================
  //  НОВЫЕ РАСКЛАДКИ v22: Dragon, Fan, Labyrinth, Square
  // ============================================================

  // 17. Дракон — сплошная основа + средний ярус + пик-голова
  const dragon = {
    id: 'dragon',
    name: 'Дракон',
    description: 'Сплошная основа с устремлённым вверх телом',
    difficulty: 'normal',
    icon: '龍',
    layers: [
      ['XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX'],
      ['                ',
       '                ',
       '  XXXXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '                ',
       '                '],
      ['                ',
       '                ',
       '                ',
       '                ',
       '      XXXX      ',
       '      XXXX      ',
       '      XXXX      ',
       '      XXXX      ',
       '                ',
       '                '],
    ],
  };

  // 18. Веер — раскрывающийся полукруг, 3 слоя
  const fan = {
    id: 'fan',
    name: 'Веер',
    description: 'Раскрывающийся полукруг, как боевой веер самурая',
    difficulty: 'normal',
    icon: '扇',
    layers: [
      ['      XX        ',
       '     XXXX       ',
       '    XXXXXX      ',
       '   XXXXXXXX     ',
       '  XXXXXXXXXX    ',
       ' XXXXXXXXXXXX   ',
       'XXXXXXXXXXXXXX  ',
       'XXXXXXXXXXXXXX  ',
       'XXXXXXXXXXXXXX  '],
      ['                ',
       '                ',
       '                ',
       '                ',
       '                ',
       ' XXXXXXXXXXXX   ',
       '  XXXXXXXXXX    ',
       '    XXXXXX      ',
       '      XX        '],
      ['                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '    XXXXXX      ',
       '    XXXXXX      ',
       '      XX        '],
    ],
  };

  // 19. Лабиринт — сплошная основа + ступенчатая башня, 5 слоёв
  const labyrinth = {
    id: 'labyrinth',
    name: 'Лабиринт',
    description: 'Квадратная основа с уходящей вверх башней',
    difficulty: 'hard',
    icon: '迷',
    layers: [
      ['XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX'],
      ['                ',
       '                ',
       '                ',
       ' XXXXXXXXXXXXXX ',
       ' XXXXXXXXXXXXXX ',
       ' XXXXXXXXXXXXXX ',
       ' XXXXXXXXXXXXXX ',
       ' XXXXXXXXXXXXXX ',
       '                ',
       '                '],
      ['                ',
       '                ',
       '                ',
       '                ',
       '   XXXXXXXXXX   ',
       '   XXXXXXXXXX   ',
       '   XXXXXXXXXX   ',
       '   XXXXXXXXXX   ',
       '                ',
       '                '],
      ['                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '     XXXXXX     ',
       '     XXXXXX     ',
       '                ',
       '                '],
      ['                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '                ',
       '      XXXX      ',
       '                ',
       '                '],
    ],
  };

  // 20. Квадрат — 12×12, 4 слоя, тренировка скорости
  const square = {
    id: 'square',
    name: 'Квадрат',
    description: 'Плотный квадрат, плоский и симметричный',
    difficulty: 'easy',
    icon: '方',
    layers: [
      ['XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX'],
      ['            ',
       '            ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '  XXXXXX    ',
       '            ',
       '            '],
      ['            ',
       '            ',
       '            ',
       '            ',
       '   XXXX     ',
       '   XXXX     ',
       '   XXXX     ',
       '   XXXX     ',
       '            ',
       '            ',
       '            ',
       '            '],
      ['            ',
       '            ',
       '            ',
       '            ',
       '            ',
       '    XX      ',
       '    XX      ',
       '            ',
       '            ',
       '            ',
       '            ',
       '            '],
    ],
  };

  // ============================================================
  //  НОВЫЕ РАСКЛАДКИ v28: Crown, Hourglass, Mushroom, Fish,
  //  Stairs, Barrel, Lighthouse, Ornament — 8 свежих форм.
  //  Все следуют правилам геометрии: чётное число фишек (≥60),
  //  каждая верхняя фишка опирается на нижний слой (±0.5),
  //  размеры 8–16 по ширине и 6–14 по высоте.
  // ============================================================

  // 21. Корона — корона с тремя зубцами, maxWidth=14, height=6
  const crown = {
    id: 'crown',
    name: 'Корона',
    description: 'Корона с тремя зубцами — символ власти',
    difficulty: 'normal',
    icon: '♛',
    layers: [
      // z=0: 14×6 — основание короны (84 фишки)
      ['XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX'],
      // z=1: 14×4 — средний ярус с прорезями (40 фишек)
      ['XX  XXXXXX  XX',
       'XX  XXXXXX  XX',
       'XX  XXXXXX  XX',
       'XX  XXXXXX  XX'],
      // z=2: 14×2 — зубцы (12 фишек)
      ['XX    XX    XX',
       'XX    XX    XX'],
      // z=3: 14×1 — острия (4 фишки)
      ['XX          XX'],
    ],
  };

  // 22. Песочные часы — узкая середина, широкие края, maxWidth=12, height=10
  const hourglass = {
    id: 'hourglass',
    name: 'Песочные часы',
    description: 'Время течёт — узкая середина, широкие края',
    difficulty: 'normal',
    icon: '⌛',
    layers: [
      // z=0: 12×10 — силуэт песочных часов (80 фишек)
      ['XXXXXXXXXXXX',
       ' XXXXXXXXXX ',
       '  XXXXXXXX  ',
       '   XXXXXX   ',
       '    XXXX    ',
       '    XXXX    ',
       '   XXXXXX   ',
       '  XXXXXXXX  ',
       ' XXXXXXXXXX ',
       'XXXXXXXXXXXX'],
      // z=1: 12×6 — внутренний конус (36 фишек)
      ['  XXXXXXXX  ',
       '   XXXXXX   ',
       '    XXXX    ',
       '    XXXX    ',
       '   XXXXXX   ',
       '  XXXXXXXX  '],
      // z=2: 12×4 — узкая перемычка (20 фишек)
      ['   XXXXXX   ',
       '    XXXX    ',
       '    XXXX    ',
       '   XXXXXX   '],
      // z=3: 12×2 — пиковая точка (8 фишек)
      ['    XXXX    ',
       '    XXXX    '],
    ],
  };

  // 23. Гриб — шляпка сверху, ножка снизу, maxWidth=12, height=10
  const mushroom = {
    id: 'mushroom',
    name: 'Гриб',
    description: 'Шляпка и ножка — лесной мотив',
    difficulty: 'easy',
    icon: '🍄',
    layers: [
      // z=0: 12×10 — силуэт гриба (82 фишки)
      ['  XXXXXXXX  ',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       'XXXXXXXXXXXX',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '  XXXXXXXX  '],
      // z=1: 12×6 — шляпка + верх ножки (40 фишек)
      ['  XXXXXXXX  ',
       '  XXXXXXXX  ',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   '],
      // z=2: 12×3 — середина ножки (18 фишек)
      ['   XXXXXX   ',
       '   XXXXXX   ',
       '   XXXXXX   '],
      // z=3: 12×1 — шляпка гриба (4 фишки)
      ['    XXXX    '],
    ],
  };

  // 24. Рыба — тело + хвост, maxWidth=14, height=7
  const fish = {
    id: 'fish',
    name: 'Рыба',
    description: 'Плывущая рыба с раздвоенным хвостом',
    difficulty: 'normal',
    icon: '🐟',
    layers: [
      // z=0: 14×7 — силуэт рыбы (86 фишек)
      ['XX    XXXXXXXX',
       'XXXX  XXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXX  XXXXXXXX',
       'XX    XXXXXXXX'],
      // z=1: 14×4 — тело рыбы (56 фишек)
      ['XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX'],
      // z=2: 14×2 — спинка (20 фишек)
      ['  XXXXXXXXXX  ',
       '  XXXXXXXXXX  '],
      // z=3: 14×1 — плавник (6 фишек)
      ['    XXXXXX    '],
    ],
  };

  // 25. Лестница — ступенчатый подъём, maxWidth=14, height=8
  const stairs = {
    id: 'stairs',
    name: 'Лестница',
    description: 'Ступенчатый подъём — путь наверх',
    difficulty: 'normal',
    icon: '🪜',
    layers: [
      // z=0: 14×8 — лестница вверх-вправо (88 фишек)
      ['      XXXXXXXX',
       '      XXXXXXXX',
       '    XXXXXXXXXX',
       '    XXXXXXXXXX',
       '  XXXXXXXXXXXX',
       '  XXXXXXXXXXXX',
       'XXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXX'],
      // z=1: 14×4 — средняя ступень (32 фишки)
      ['    XXXXXXXX  ',
       '    XXXXXXXX  ',
       '    XXXXXXXX  ',
       '    XXXXXXXX  '],
      // z=2: 14×2 — верхняя ступень (8 фишек)
      ['      XXXX    ',
       '      XXXX    '],
      // z=3: 14×1 — вершинка (2 фишки)
      ['       XX     '],
    ],
  };

  // 26. Бочка — пухлая вертикальная форма, maxWidth=10, height=10
  const barrel = {
    id: 'barrel',
    name: 'Бочка',
    description: 'Пухлая бочка — классическая тара',
    difficulty: 'easy',
    icon: '🛢',
    layers: [
      // z=0: 10×10 — силуэт бочки (84 фишки)
      ['  XXXXXX  ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       'XXXXXXXXXX',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       '  XXXXXX  '],
      // z=1: 10×6 — средний ярус (48 фишек)
      [' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX '],
      // z=2: 10×4 — узкое горлышко (16 фишек)
      ['   XXXX   ',
       '   XXXX   ',
       '   XXXX   ',
       '   XXXX   '],
      // z=3: 10×2 — крышка (4 фишки)
      ['    XX    ',
       '    XX    '],
    ],
  };

  // 27. Маяк — высокий, сужается кверху, maxWidth=10, height=12, 5 слоёв
  const lighthouse = {
    id: 'lighthouse',
    name: 'Маяк',
    description: 'Высокий маяк с пятью ярусами',
    difficulty: 'hard',
    icon: '🗼',
    layers: [
      // z=0: 10×12 — основание маяка (94 фишки)
      ['XXXXXXXXXX',
       'XXXXXXXXXX',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       '  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  '],
      // z=1: 10×8 — второй ярус (62 фишки)
      [' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       ' XXXXXXXX ',
       '  XXXXXX  '],
      // z=2: 10×5 — третий ярус (30 фишек)
      ['  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  ',
       '  XXXXXX  '],
      // z=3: 10×3 — четвёртый ярус (12 фишек)
      ['   XXXX   ',
       '   XXXX   ',
       '   XXXX   '],
      // z=4: 10×1 — фонарь (2 фишки)
      ['    XX    '],
    ],
  };

  // 28. Орнамент — симметричный узор с боковыми крыльями, maxWidth=16, height=7
  const ornament = {
    id: 'ornament',
    name: 'Орнамент',
    description: 'Декоративный узор с боковыми крыльями',
    difficulty: 'hard',
    icon: '✶',
    layers: [
      // z=0: 16×7 — узор с крыльями (102 фишки)
      ['XX  XXXXXXXX  XX',
       'XXXX XXXXXX XXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXXXXXXXXXXXXXX',
       'XXXX XXXXXX XXXX',
       'XX  XXXXXXXX  XX'],
      // z=1: 16×6 — внутренний медальон (48 фишек)
      ['    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '  XXXXXXXXXX    ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    '],
      // z=2: 16×4 — центральный крест (24 фишки)
      ['      XXXX      ',
       '    XXXXXXXX    ',
       '    XXXXXXXX    ',
       '      XXXX      '],
      // z=3: 16×1 — пиковая точка (2 фишки)
      ['       XX       '],
    ],
  };

  // ---------- Регистрация ----------
  const all = [
    pyramid, turtle, cross, wall, boat, butterfly, heart, spider,
    fortress, tower, bridge, cloud, pagoda, crystal, star, flower,
    dragon, fan, labyrinth, square,
    crown, hourglass, mushroom, fish, stairs, barrel, lighthouse, ornament,
  ];

  const layouts = all.map(layout => {
    const built = buildLayout(layout.layers);
    return {
      id: layout.id,
      name: layout.name,
      description: layout.description,
      difficulty: layout.difficulty,
      icon: layout.icon,
      tilesCount: built.positions.length,
      positions: built.positions,
      width: built.width,
      height: built.height,
      layers: built.positions.reduce((max, p) => Math.max(max, p.z), 0) + 1,
    };
  });

  function getById(id) {
    return layouts.find(l => l.id === id);
  }

  function getByDifficulty(difficulty) {
    if (difficulty === 'easy') return layouts.filter(l => l.difficulty === 'easy');
    if (difficulty === 'hard') return layouts.filter(l => l.difficulty === 'hard' || l.difficulty === 'normal');
    return layouts;
  }

  // ============================================================
  //  ГЕНЕРАТОР МИКСОВ (v22)
  //  Комбинирует 2 раскладки бок о бок: A слева, B справа со
  //  смещением по X. Фишки B сдвигаются на (A.width + gap).
  //  Если суммарное число фишек нечётное — добавляем 2 фишки
  //  в зазор (z=0), чтобы пары всегда были.
  //  Микс-раскладка помечается isMix=true, и её width может
  //  превышать 16 (обычный лимит) — computeFit просто сделает
  //  фишки мельче, скролла не будет.
  // ============================================================

  function combineLayouts(layoutA, layoutB, opts) {
    if (!layoutA || !layoutB) return null;
    const o = opts && typeof opts === 'object' ? opts : {};
    const gap = Number.isFinite(o.gap) && o.gap >= 0 ? Math.floor(o.gap) : 2;
    const offsetB = layoutA.width + gap;
    const positions = [];
    // A — как есть
    layoutA.positions.forEach(p => positions.push({ x: p.x, y: p.y, z: p.z }));
    // B — сдвигаем по X
    layoutB.positions.forEach(p => positions.push({ x: p.x + offsetB, y: p.y, z: p.z }));
    // Если фишек нечётно — добавляем 2 фишки в зазор (z=0, y=0)
    if (positions.length % 2 !== 0) {
      positions.push({ x: layoutA.width, y: 0, z: 0 });
      positions.push({ x: layoutA.width + 1, y: 0, z: 0 });
    }
    const nameA = o.nameA || layoutA.name || layoutA.id;
    const nameB = o.nameB || layoutB.name || layoutB.id;
    return {
      id: o.id || ('mix_' + layoutA.id + '_' + layoutB.id),
      name: o.name || (nameA + ' + ' + nameB),
      description: o.description || 'Микс двух раскладок',
      difficulty: o.difficulty || 'normal',
      icon: o.icon || '✦',
      tilesCount: positions.length,
      positions: positions,
      width: layoutA.width + gap + layoutB.width,
      height: Math.max(layoutA.height, layoutB.height),
      layers: Math.max(layoutA.layers, layoutB.layers),
      isMix: true,
      mixComponents: [layoutA.id, layoutB.id],
    };
  }

  // Детерминированно выбрать 2 разные раскладки из seed.
  // Возвращает [layoutA, layoutB] — всегда разные.
  function pickMixPair(seed) {
    const s = (Number(seed) >>> 0) || 1;
    const n = layouts.length;
    // Первый индекс — s % n
    const i = s % n;
    // Второй — (s >> 4) % (n-1), пропуская i
    let j = (s >>> 4) % (n - 1);
    if (j >= i) j += 1;
    return [layouts[i], layouts[j]];
  }

  // Готовая микс-раскладка из seed (для Daily-микса и режима «Микс»)
  function getMixFromSeed(seed) {
    const [a, b] = pickMixPair(seed);
    return combineLayouts(a, b, { gap: 2 });
  }

  return { all: layouts, getById, getByDifficulty, combineLayouts, pickMixPair, getMixFromSeed };
})();
