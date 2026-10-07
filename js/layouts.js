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
      // z=1: тело 8×4 = 32 (со смещением 0.5)
      ['   XXXXXXXX   ',
       '   XXXXXXXX   ',
       '   XXXXXXXX   ',
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

  // ---------- Регистрация ----------
  const all = [pyramid, turtle, cross, wall, boat, butterfly, heart, spider];

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

  return { all: layouts, getById, getByDifficulty };
})();
