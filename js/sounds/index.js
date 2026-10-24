/* ============================================================
   SOUNDS/INDEX.JS — Каталог звуковых эффектов (v26-audio)

   Все звуки — в отдельных файлах в папке js/sounds/.
   Сгруппированы по роли:

     Взаимодействие с фишками
       hover.js     — наведение на свободную фишку
       click.js     — выбор фишки
       deselect.js  — снятие выбора
       blocked.js   — фишка занята
     Результат хода
       match.js     — совпадение пары
       combo.js     — комбо-серия
       mismatch.js  — несовпадение
     Помощь и управление
       hint.js      — подсказка
       undo.js      — отмена хода
       shuffle.js   — перемешать
       deal.js      — раздача
     Финал
       win.js       — победа

   Каждый звук — объект: { name, desc, play(ctx, kit, ...args) }.
   kit — набор голосов из audio.js (bell, pure, thump, noise, tap,
   note) и одновременно функция playTone для совместимости с v25.
   ============================================================ */

Sounds.CATALOG = [
  // Фишки
  { id: 'hover',    name: Sounds.hover.name,    desc: Sounds.hover.desc    },
  { id: 'click',    name: Sounds.click.name,    desc: Sounds.click.desc    },
  { id: 'deselect', name: Sounds.deselect.name, desc: Sounds.deselect.desc },
  { id: 'blocked',  name: Sounds.blocked.name,  desc: Sounds.blocked.desc  },
  // Результат хода
  { id: 'match',    name: Sounds.match.name,    desc: Sounds.match.desc    },
  { id: 'combo',    name: Sounds.combo.name,    desc: Sounds.combo.desc    },
  { id: 'mismatch', name: Sounds.mismatch.name, desc: Sounds.mismatch.desc },
  // Помощь и управление
  { id: 'hint',     name: Sounds.hint.name,     desc: Sounds.hint.desc     },
  { id: 'undo',     name: Sounds.undo.name,     desc: Sounds.undo.desc     },
  { id: 'shuffle',  name: Sounds.shuffle.name,  desc: Sounds.shuffle.desc  },
  { id: 'deal',     name: Sounds.deal.name,     desc: Sounds.deal.desc     },
  // Финал
  { id: 'win',      name: Sounds.win.name,      desc: Sounds.win.desc      },
];

// Получить звук по id
Sounds.getById = function (id) {
  return Sounds[id] || null;
};
