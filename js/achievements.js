/* ============================================================
   ACHIEVEMENTS.JS — Достижения (v11)
   Чистая логика: по статистике и данным партии решаем,
   какие достижения разблокировались. Сами значки хранит
   Storage в stats.achievements ({ id: timestamp }).
   Никакого DOM и localStorage напрямую — только чистые
   функции, покрытые тестами.
   ============================================================ */

const Achievements = (function () {

  // ---------- Каталог ----------
  // icon — текстовый символ (как ❖/★ в интерфейсе), не эмодзи:
  // шрифт любой темы рисует их одинаково.
  const LIST = [
    { id: 'first-win', icon: '★', name: 'Первая победа',
      desc: 'Соберите любую раскладку до конца' },
    { id: 'clean-win', icon: '◆', name: 'Чистая победа',
      desc: 'Победа без подсказок, перемешиваний и отмен' },
    { id: 'fast-win', icon: '✦', name: 'Молния',
      desc: 'Победа быстрее 5 минут' },
    { id: 'combo-5', icon: '❖', name: 'Серия ×5',
      desc: 'Пять пар подряд без паузы' },
    { id: 'veteran', icon: '✵', name: 'Ветеран',
      desc: 'Десять побед' },
    { id: 'collector', icon: '✿', name: 'Коллекционер',
      desc: 'Пять разных раскладок собраны' },
    { id: 'endless-3', icon: '∞', name: 'Бесконечность',
      desc: 'Третий уровень бесконечного режима' },
    { id: 'marathon', icon: '☰', name: 'Марафонец',
      desc: 'Двадцать пять побед всего' },
  ];

  // ---------- Пороги ----------
  const FAST_WIN_SECONDS = 300;      // «Молния»: быстрее 5 минут
  const VETERAN_WINS = 10;           // «Ветеран»
  const MARATHON_WINS = 25;          // «Марафонец»
  const COLLECTOR_LAYOUTS = 5;       // «Коллекционер»: разных раскладок
  const COMBO_TARGET = 5;            // «Серия ×5»
  const ENDLESS_LEVEL_TARGET = 2;    // endlessLevel 0-based: индекс 2 = третий уровень

  // ---------- Вспомогательное ----------
  function unlockedMap(stats) {
    const a = stats && stats.achievements;
    return (a && typeof a === 'object' && !Array.isArray(a)) ? a : {};
  }

  function isNew(stats, id) {
    return !Object.prototype.hasOwnProperty.call(unlockedMap(stats), id);
  }

  // ---------- Победа партии ----------
  // stats — УЖЕ обновлённая статистика (после Storage.addResult:
  // won увеличен, layouts дополнен). ev — данные партии.
  // Мусор в ev трактуется осторожно: достижение просто не выдаётся.
  function evaluateWin(stats, ev) {
    const e = ev && typeof ev === 'object' ? ev : {};
    const out = [];
    const push = (id) => { if (isNew(stats, id)) out.push(id); };

    push('first-win');

    // «Чистая победа»: ноль помощи за всю партию. Не-число → не считаем чистой.
    const hints = Number(e.hintsUsed);
    const shuffles = Number(e.shufflesUsed);
    const undos = Number(e.undosUsed);
    if (hints === 0 && shuffles === 0 && undos === 0) push('clean-win');

    const t = Number(e.timeSec);
    if (Number.isFinite(t) && t > 0 && t <= FAST_WIN_SECONDS) push('fast-win');

    const won = stats && Number(stats.won);
    if (Number.isFinite(won) && won > 0) {
      if (won >= VETERAN_WINS) push('veteran');
      if (won >= MARATHON_WINS) push('marathon');
    }

    const layouts = stats && stats.layouts;
    if (layouts && typeof layouts === 'object' && !Array.isArray(layouts)) {
      if (Object.keys(layouts).length >= COLLECTOR_LAYOUTS) push('collector');
    }

    if (e.mode === 'endless' && Number(e.endlessLevel) >= ENDLESS_LEVEL_TARGET) {
      push('endless-3');
    }

    return out;
  }

  // ---------- Серия матчей ----------
  // combo >= 5 в живой партии (уже unlocked — не повторяем).
  // Мусорная статистика → fail-safe: ничего не выдаём.
  function evaluateCombo(stats, combo) {
    const c = Number(combo);
    const okStats = !!stats && typeof stats === 'object' && !Array.isArray(stats);
    if (okStats && Number.isInteger(c) && c >= COMBO_TARGET && isNew(stats, 'combo-5')) {
      return ['combo-5'];
    }
    return [];
  }

  // ---------- Описание по id ----------
  function getById(id) {
    return LIST.find(a => a.id === id) || null;
  }

  return {
    LIST,
    evaluateWin,
    evaluateCombo,
    getById,
    FAST_WIN_SECONDS,
    COMBO_TARGET,
    VETERAN_WINS,
    MARATHON_WINS,
    COLLECTOR_LAYOUTS,
    ENDLESS_LEVEL_TARGET,
  };
})();
