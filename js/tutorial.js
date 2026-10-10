/* ============================================================
   TUTORIAL.JS — Обучение (v12)
   Простенький пошаговый туториал «Как играть»:
   6 шагов с картинками-схемами (мини-фишки на CSS).

   Архитектура как у achievements.js/music.js:
   • Чистая логика (каталог шагов, навигация, флаг «показано»)
     — без DOM, покрыта тестами (tests/tutorial.test.js).
   • Рантайм (открытие оверлея, кнопки, точки) — безвреден
     без document: все обращения к DOM спрятаны за hasDOM().
   • Флаг tutorialSeen хранится в Storage (настройки),
     автопоказ — только при первом визите.
   ============================================================ */

const Tutorial = (function () {

  // ---------- Каталог шагов (чистые данные) ----------
  // icon — текстовый глиф (как в достижениях): рендерится
  // одинаково в любой теме. Тексты короткие — «простенькое».
  const SLIDES = [
    {
      id: 'welcome', icon: '中', title: 'Добро пожаловать!',
      text: 'Это маджонг-пасьянс. Перед вами пирамида из фишек. Цель — разобрать её полностью, убирая фишки парами.',
    },
    {
      id: 'pairs', icon: '✦', title: 'Убирайте пары',
      text: 'Найдите две одинаковые фишки и нажмите их по очереди — пара исчезнет с доски.',
    },
    {
      id: 'free', icon: '✓', title: 'Свободная фишка',
      text: 'Фишка свободна, если её не накрывает другая сверху и слева или справа у неё открыт бок. Закрытую фишку взять нельзя — сначала освободите её.',
    },
    {
      id: 'layers', icon: '◈', title: 'Как различать слои',
      text: 'Свободные фишки светятся ярче, закрытые — приглушённые. Толстый «бок» снизу подсказывает: фишка лежит слоем выше.',
    },
    {
      id: 'help', icon: '❖', title: 'Помощь под рукой',
      text: 'Лампочка подсветит пару, стрелка отменит ход, перемешивание спасёт в тупике. В настройках есть подсветка доступных фишек — она сама покажет, что можно убрать.',
    },
    {
      id: 'play', icon: '★', title: 'Всё, играем!',
      text: 'Пары подряд дают комбо ×2…×8 и золотые бонусы, а за победы — достижения. Начнём с лёгкой «Пирамиды»!',
    },
  ];

  // ---------- Чистая навигация по шагам ----------
  // Любой мусор → шаг 0. Выход за границы → прижимается к краю.
  function clampIndex(i) {
    const n = Number(i);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(SLIDES.length - 1, Math.floor(n)));
  }

  function slideCount() {
    return SLIDES.length;
  }

  function nextIndex(i) {
    return Math.min(SLIDES.length - 1, clampIndex(i) + 1);
  }

  function prevIndex(i) {
    return Math.max(0, clampIndex(i) - 1);
  }

  function isLastIndex(i) {
    return clampIndex(i) === SLIDES.length - 1;
  }

  function isFirstIndex(i) {
    return clampIndex(i) === 0;
  }

  function stepLabel(i) {
    return 'Шаг ' + (clampIndex(i) + 1) + ' из ' + SLIDES.length;
  }

  // ---------- Флаг «обучение уже показано» ----------
  // Читается/пишется через Storage (настройка tutorialSeen).
  // Без Storage (старый кэш, песочница) — считаем показанным,
  // чтобы не мешать игроку.
  function isSeen() {
    if (typeof Storage === 'undefined') return true;
    try {
      return Storage.getSetting('tutorialSeen', false) === true;
    } catch (e) {
      return true;
    }
  }

  function markSeen() {
    if (typeof Storage === 'undefined') return;
    try {
      Storage.setSetting('tutorialSeen', true);
    } catch (e) { /* хранилище недоступно — не страшно */ }
  }

  // ============================================================
  // РАНТАЙМ — всё, что ниже, безопасно без DOM
  // ============================================================
  let idx = 0;
  let openNow = false;
  let startGameCb = null;
  let els = null;

  function hasDOM() {
    return typeof document !== 'undefined' &&
      !!document.getElementById('tutorial-overlay');
  }

  function collectEls() {
    const ids = [
      'tutorial-overlay', 'tutorial-step', 'tutorial-slides',
      'tutorial-dots', 'tutorial-prev', 'tutorial-next',
      'tutorial-play', 'tutorial-skip',
    ];
    const found = {};
    for (const id of ids) {
      found[id] = document.getElementById(id);
      if (!found[id]) return null; // разметка неполная — туториал молчит
    }
    found.slides = Array.prototype.slice.call(
      found['tutorial-slides'].querySelectorAll('.tutorial-slide'));
    return found;
  }

  function buildDots() {
    const box = els['tutorial-dots'];
    box.innerHTML = '';
    SLIDES.forEach((s, i) => {
      const d = document.createElement('button');
      d.className = 'tut-dot';
      d.type = 'button';
      d.dataset.slide = String(i);
      d.setAttribute('aria-label', 'Шаг ' + (i + 1));
      box.appendChild(d);
    });
  }

  function render() {
    idx = clampIndex(idx);
    els.slides.forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
    els['tutorial-step'].textContent = stepLabel(idx);
    Array.prototype.forEach.call(els['tutorial-dots'].children, (d, i) => {
      d.classList.toggle('active', i === idx);
    });
    els['tutorial-prev'].hidden = isFirstIndex(idx);
    els['tutorial-next'].hidden = isLastIndex(idx);
    els['tutorial-play'].hidden = !isLastIndex(idx);
  }

  function open() {
    if (!hasDOM()) return;
    els = els || collectEls();
    if (!els) return;
    if (!els['tutorial-dots'].childElementCount) buildDots();
    idx = 0;
    openNow = true;
    els['tutorial-overlay'].hidden = false;
    render();
  }

  function close(opts) {
    if (!hasDOM() || !openNow) { openNow = false; return; }
    const o = opts && typeof opts === 'object' ? opts : {};
    openNow = false;
    els['tutorial-overlay'].hidden = true;
    // Любой путь закрытия = «обучение пройдено», больше не показываем
    markSeen();
    if (o.startGame && typeof startGameCb === 'function') {
      startGameCb();
    }
  }

  function goTo(i) {
    if (!openNow) return;
    idx = clampIndex(i);
    render();
  }

  function next() { if (openNow) goTo(nextIndex(idx)); }
  function prev() { if (openNow) goTo(prevIndex(idx)); }

  function isOpenState() { return openNow; }

  // ---------- Инициализация (вызывается из App.init) ----------
  // options.startGame — что делать по кнопке «Играть!»
  // (App передаёт старт лёгкой «Пирамиды»).
  function init(options) {
    const o = options && typeof options === 'object' ? options : {};
    startGameCb = typeof o.startGame === 'function' ? o.startGame : null;
    if (!hasDOM()) return;
    els = collectEls();
    if (!els) return;
    buildDots();

    els['tutorial-skip'].addEventListener('click', () => close());
    els['tutorial-prev'].addEventListener('click', prev);
    els['tutorial-next'].addEventListener('click', next);
    els['tutorial-play'].addEventListener('click', () => close({ startGame: true }));

    // Точки-переключатели
    els['tutorial-dots'].addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.tut-dot') : null;
      if (t) goTo(Number(t.dataset.slide));
    });

    // Клавиатура: Esc — закрыть, стрелки — листать.
    // Конфликта с игровыми хоткеями нет: App слушает H/S/Z
    // только на экране игры, туториал реагирует лишь когда открыт.
    document.addEventListener('keydown', (e) => {
      if (!openNow) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowRight') { next(); return; }
      if (e.key === 'ArrowLeft') { prev(); }
    });
  }

  // Экспорт: чистая логика + рантайм-функции (без DOM — no-op)
  return {
    SLIDES,
    slideCount,
    clampIndex,
    nextIndex,
    prevIndex,
    isFirstIndex,
    isLastIndex,
    stepLabel,
    isSeen,
    markSeen,
    init,
    open,
    close,
    next,
    prev,
    goTo,
    isOpenState,
  };
})();
