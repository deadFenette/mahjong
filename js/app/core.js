/* ============================================================
   APP/CORE.JS — Общее пространство имён App и ядро (v33)

   js/app.js (1500+ строк) разрезан на модули js/app/*.js. Все они —
   IIFE, получающие один и тот же объект App:
     • App.state — разделяемое изменяемое состояние (экран, таймеры...);
     • функции других модулей вызываются как App.имя(...);
     • внутри своего модуля функции вызываются как раньше, напрямую.
   Порядок подключения в index.html важен только для core.js (первым):
   вызовы между модулями происходят уже после загрузки всех файлов.
   ============================================================ */

const App = {
  screens: ['menu', 'layouts', 'difficulty', 'mix', 'game', 'win', 'settings'],
  // Разделяемое изменяемое состояние (то, что читают/пишут несколько модулей)
  state: {
    currentScreen: 'menu',
    endlessLayouts: [],
    hintTimer: null,
    lastActionTime: 0,
    mixOpts: null,
  },
};

(function (A) {
  'use strict';

  // ---------- Навигация ----------
  // Используем body[data-screen] как единый источник правды.
  // CSS гарантирует, что активен только один .screen (без наложений).
  function showScreen(name) {
    document.body.dataset.screen = name;
    // На всякий случай — переключаем и класс .active (для анимации opacity)
    A.screens.forEach(s => {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('active', s === name);
    });
    A.state.currentScreen = name;

    // Закрываем паузу, если она была открыта
    const pauseEl = document.getElementById('pause-overlay');
    if (pauseEl) pauseEl.hidden = true;

    if (name === 'menu') updateMenuStats();
    if (name === 'game') {
      const st = Game.getState();
      // v9: Game.resume() вместо прямого st.paused = false —
      // заодно корректно перезапускает игровые часы
      if (st && !st.ended) Game.resume();
      // Пересчитать под текущий размер экрана.
      // Двойной rAF: ждём реальную отрисовку экрана — измерения
      // надёжнее, чем старый setTimeout(50).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => Render.reposition());
      });
    }
  }

  // ---------- Пульс значения при изменении (v8) ----------
  // Счёт/пары/ходы в шапке и статистика в меню «подпрыгивают»,
  // когда меняются — глаз сразу видит, ЧТО именно обновилось.
  function bumpValue(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('bump');
  }
  function setTextBumped(el, value) {
    if (!el) return;
    const text = String(value);
    if (el.textContent !== text) {
      el.textContent = text;
      bumpValue(el);
    }
  }

  // ---------- Виброотклик на мобильных (v9) ----------
  // Мягкий короткий отклик на матч/победу; на десктопе тихо игнорируется
  function buzz(ms) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch (e) { /* вибрация недоступна — не страшно */ }
  }

  function updateMenuStats() {
    const stats = Storage.getStats();
    setTextBumped(document.getElementById('stat-played'), stats.played);
    setTextBumped(document.getElementById('stat-won'), stats.won);
    setTextBumped(document.getElementById('stat-best'), stats.bestScore);
    // v9: рекорд времени (— если побед ещё нет)
    const bt = stats.bestTime;
    setTextBumped(document.getElementById('stat-best-time'),
      (bt === null || bt === undefined) ? '—' : A.formatTime(Number(bt) || 0));
    // Кнопка «Продолжить» видна только если есть сохранённая игра
    document.getElementById('btn-continue').hidden = !Storage.hasSavedGame();
  }

  // ---------- Достижения (v11) ----------
  // Тост по каждому новому достижению с интервалом, чтобы
  // несколько сразу не съедали друг друга
  function announceAchievements(ids) {
    const list = Array.isArray(ids) ? ids : [];
    list.forEach((id, i) => {
      const a = Achievements.getById(id);
      if (!a) return;
      setTimeout(() => toast('Достижение: «' + a.name + '»'), i * 1400);
    });
  }


  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('toast-out'); // v8: перезапуск, если тост уже уходит
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      // v8: мягкий уход вместо мгновенного скрытия
      el.classList.add('toast-out');
      setTimeout(() => {
        el.hidden = true;
        el.classList.remove('toast-out');
      }, 280);
    }, 2500);
  }

  // ---------- Кастомный confirm overlay (v20) ----------
  // Заменяет нативный window.confirm() — он ломается в PWA standalone
  // (не показывается или выглядит как убогий системный диалог) и не
  // темизируется. Этот overlay — тёмная карточка с двумя кнопками,
  // в стиле паузы/победы.
  //
  // showConfirm(opts) → Promise<boolean>: true — пользователь нажал «ОК»,
  // false — отменил (кнопка Отмена, Esc, клик вне карточки).
  //
  // opts = { title, message, okLabel, cancelLabel, danger }
  //   danger: true → кнопка ОК красная (для деструктивных действий)
  let confirmResolver = null;
  function showConfirm(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const overlay = document.getElementById('confirm-overlay');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!overlay || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      // Фолбэк на нативный confirm, если разметки нет (не должно случиться)
      return Promise.resolve(window.confirm(o.message || 'Подтвердите действие'));
    }

    titleEl.textContent = o.title || 'Подтверждение';
    msgEl.textContent = o.message || 'Вы уверены?';
    okBtn.textContent = o.okLabel || 'ОК';
    cancelBtn.textContent = o.cancelLabel || 'Отмена';
    okBtn.classList.toggle('btn-danger', !!o.danger);

    overlay.hidden = false;

    return new Promise(resolve => {
      // Если уже был открыт confirm — закрываем предыдущий без действия
      if (confirmResolver) confirmResolver(false);
      confirmResolver = resolve;

      const cleanup = (result) => {
        overlay.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        confirmResolver = null;
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => { if (e.target === overlay) cleanup(false); };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
        else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);

      // Фокус на кнопке «Отмена» — безопаснее для деструктивных действий
      cancelBtn.focus();
    });
  }

  // ---------- Событие «настройка изменилась» (v38) ----------
  // Живое превью на экране настроек слушает его и обновляет «экранчик».
  // dispatchEvent недоступен в урезанных окружениях (тесты с document:{}) —
  // там тихо пропускаем. Ключ — какая настройка поменялась (для перерисовки).
  function notifySettings(key, value) {
    try {
      if (typeof document !== 'undefined' && document.dispatchEvent) {
        document.dispatchEvent(new CustomEvent('mahjong:settings', {
          detail: { key: key, value: value },
        }));
      }
    } catch (e) { /* без события превью просто не обновится — не страшно */ }
  }

  Object.assign(A, {
    announceAchievements,
    buzz,
    notifySettings,
    setTextBumped,
    showConfirm,
    showScreen,
    toast,
    updateMenuStats,
  });
})(App);
