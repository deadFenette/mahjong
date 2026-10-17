/* ============================================================
   SOUNDS/INDEX.JS — Каталог звуковых эффектов (v25-sounds)

   Все звуки — в отдельных файлах в папке js/sounds/:
     - click.js     — клик фишки
     - match.js     — совпадение пары
     - combo.js     — комбо-серия
     - mismatch.js  — несовпадение
     - hint.js      — подсказка
     - win.js       — победа
     - shuffle.js   — перемешать
     - hover.js     — наведение на фишку

   Каждый звук — объект: { name, desc, play(ctx, playTone, ...args) }.
   Чтобы заменить звук: отредактируйте нужный файл — частоты, тип
   волны, длительность. Можно добавить новый звук: создайте файл
   my-sound.js с Sounds.mySound = { name, desc, play() {...} },
   подключите его в index.html перед sounds/index.js, и вызывайте
   Audio2.mySound().

   Этот файл (index.js) собирает все звуки в каталог Sounds.CATALOG
   и предоставляет хелперы.
   ============================================================ */

// Sounds уже объявлен глобально каждым файлом звука.
// Здесь собираем каталог.
Sounds.CATALOG = [
  { id: 'click',    name: Sounds.click.name,    desc: Sounds.click.desc    },
  { id: 'match',    name: Sounds.match.name,    desc: Sounds.match.desc    },
  { id: 'combo',    name: Sounds.combo.name,    desc: Sounds.combo.desc    },
  { id: 'mismatch', name: Sounds.mismatch.name, desc: Sounds.mismatch.desc },
  { id: 'hint',     name: Sounds.hint.name,     desc: Sounds.hint.desc     },
  { id: 'win',      name: Sounds.win.name,      desc: Sounds.win.desc      },
  { id: 'shuffle',  name: Sounds.shuffle.name,  desc: Sounds.shuffle.desc  },
  { id: 'hover',    name: Sounds.hover.name,    desc: Sounds.hover.desc    },
];

// Получить звук по id
Sounds.getById = function (id) {
  return Sounds[id] || null;
};
