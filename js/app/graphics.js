/* ============================================================
   APP/GRAPHICS.JS — Меню «Графика и анимации» + живые числа и кнопки (v44)

   Раскрывающийся блок в настройках. Внутри:
     • общий выключатель «Анимации»;
     • быстрые наборы: Все эффекты / Спокойно / Выключено;
     • стиль перехода между экранами (Занавес / Плавно / Мгновенно);
     • тумблеры 7 категорий (Motion.FX);
     • режим графики Авто/Лёгкая/Полная (его кнопки #perf-picker
       обслуживает pause.js — здесь только лежит их разметка).
   Сами настройки, их хранение и применение — js/motion.js;
   этот файл только рисует состояние и ловит клики.
   ============================================================ */

(function (A) {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function build() {
    const list = el('gfx-fx-list');
    if (list && !list.childElementCount) {
      Motion.FX.forEach(f => {
        const row = document.createElement('label');
        row.className = 'setting-row toggle-row gfx-fx-row';
        row.innerHTML =
          '<span class="setting-label">' +
            '<span class="setting-name"></span>' +
            '<span class="setting-desc"></span>' +
          '</span>' +
          '<input type="checkbox" class="toggle" data-gfx-fx="' + f.id + '" />' +
          '<span class="toggle-switch"></span>';
        row.querySelector('.setting-name').textContent = f.name;
        row.querySelector('.setting-desc').textContent = f.desc;
        list.appendChild(row);
      });
    }
    const tr = el('gfx-transitions');
    if (tr && !tr.childElementCount) {
      Motion.TRANSITIONS.forEach(t => {
        const b = document.createElement('button');
        b.className = 'mix-card';
        b.type = 'button';
        b.setAttribute('data-gfx-tr', t.id);
        b.innerHTML = '<span class="mix-card-name"></span><span class="mix-card-desc"></span>';
        b.querySelector('.mix-card-name').textContent = t.name;
        b.querySelector('.mix-card-desc').textContent = t.desc;
        tr.appendChild(b);
      });
    }
  }

  // Нарисовать текущее состояние
  function sync() {
    const st = Motion.stored();
    const sys = Motion.systemReduced();
    const master = el('gfx-master');
    if (master) {
      master.checked = st.master && !sys;
      master.disabled = sys;
    }
    const mnote = el('gfx-master-note');
    if (mnote) {
      mnote.textContent = sys
        ? 'Система просит уменьшить движение — анимации отключены'
        : 'Общий выключатель всего движения в игре';
    }
    const sub = el('gfx-sub');
    if (sub) sub.classList.toggle('is-disabled', !st.master || sys);

    document.querySelectorAll('[data-gfx-fx]').forEach(inp => {
      inp.checked = !!st.fx[inp.getAttribute('data-gfx-fx')];
      inp.disabled = !st.master || sys;
    });
    document.querySelectorAll('[data-gfx-tr]').forEach(b => {
      const on = b.getAttribute('data-gfx-tr') === st.transition;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.disabled = !st.master || sys;
    });
    const preset = Motion.matchPreset(st);
    document.querySelectorAll('[data-gfx-preset]').forEach(b => {
      const on = b.getAttribute('data-gfx-preset') === preset;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    const note = el('gfx-summary-note');
    if (note) {
      if (sys || !st.master) note.textContent = 'Анимации выключены';
      else if (preset === 'all') note.textContent = 'Все эффекты включены';
      else if (preset === 'calm') note.textContent = 'Спокойный режим';
      else {
        const n = Motion.FX_IDS.filter(id => st.fx[id]).length;
        note.textContent = 'Включено эффектов: ' + n + ' из ' + Motion.FX_IDS.length;
      }
    }
  }

  function initGraphicsMenu() {
    if (typeof Motion === 'undefined' || !el('gfx-menu')) return;
    build();

    const master = el('gfx-master');
    if (master) master.addEventListener('change', () => { Motion.setMaster(master.checked); sync(); });

    el('gfx-fx-list').addEventListener('change', e => {
      const id = e.target && e.target.getAttribute && e.target.getAttribute('data-gfx-fx');
      if (!id) return;
      Motion.setFx(id, e.target.checked);
      sync();
    });
    el('gfx-transitions').addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-gfx-tr]');
      if (!b || b.disabled) return;
      Motion.setTransition(b.getAttribute('data-gfx-tr'));
      sync();
    });
    el('gfx-presets').addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-gfx-preset]');
      if (!b) return;
      Motion.applyPreset(b.getAttribute('data-gfx-preset'));
      sync();
    });

    // Системная настройка «меньше движения» могла поменяться на лету
    document.addEventListener('motionchange', sync);
    sync();
  }


  // ---------- Накат числа (v44) ----------
  // Плавно прокручивает число в элементе к новому значению (easeOutCubic).
  // opts: from (стартовое), ms, delay, format (число → текст),
  //       fx — категория Motion, которая должна быть включена.
  // Выключены анимации — число ставится сразу. Повторный вызов на том же
  // элементе перехватывает прокрутку с текущего значения (без скачка).
  const rollTimers = new WeakMap();
  function rollNumber(el, to, opts) {
    if (!el) return;
    const o = opts || {};
    const fmt = typeof o.format === 'function' ? o.format : String;
    const active = typeof Motion === 'undefined' ? true : (o.fx ? Motion.isOn(o.fx) : Motion.masterOn());
    const prev = rollTimers.get(el);
    if (prev) { cancelAnimationFrame(prev.raf); clearTimeout(prev.t); }
    const shown = parseFloat(String(el.textContent).replace(/[^\d.-]/g, ''));
    const from = typeof o.from === 'number' ? o.from : (isFinite(shown) ? shown : to);
    if (!active || !isFinite(from) || from === to || typeof requestAnimationFrame !== 'function') {
      el.textContent = fmt(to);
      return;
    }
    el.textContent = fmt(from);
    const ms = o.ms || 600;
    const state = { raf: 0, t: 0 };
    rollTimers.set(el, state);
    function run() {
      const t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, ((now || performance.now()) - t0) / ms);
        const k = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(from + (to - from) * k));
        if (p < 1) state.raf = requestAnimationFrame(step);
        else el.textContent = fmt(to);
      })(t0);
    }
    if (o.delay) state.t = setTimeout(run, o.delay); else run();
  }

  // ---------- Отклик кнопки действия (v44) ----------
  // Иконка кнопки «живёт» при нажатии: лампочка вспыхивает, стрелки
  // перемешивания крутятся, отмена проворачивается назад.
  function pulseButton(id, cls, fx) {
    if (typeof Motion !== 'undefined' && !Motion.isOn(fx || 'select')) return;
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.remove(cls);
    void b.offsetWidth;
    b.classList.add(cls);
    setTimeout(() => b.classList.remove(cls), 900);
  }

  // ---------- Плавная смена темы/скина (v44) ----------
  // View Transitions API: браузер делает снимок «до», применяет изменение
  // и перекрёстно растворяет снимок в живую страницу — без мигания.
  // Нет API / анимации выключены / лёгкий режим — просто применяем.
  function smoothChange(fn) {
    const ok = typeof document.startViewTransition === 'function' &&
      typeof Motion !== 'undefined' && Motion.masterOn() &&
      !(typeof Perf !== 'undefined' && Perf.isLite && Perf.isLite());
    if (!ok) { fn(); return; }
    try { document.startViewTransition(fn); } catch (e) { fn(); }
  }

  // ---------- Карточка → доска (v44) ----------
  // Из выбранной карточки раскладки вылетает «призрак» (тот же прямоугольник),
  // разворачивается на весь экран и растворяется, открывая игру. Занавес на
  // этот переход не нужен (showScreen получает nextMode='fade').
  function launchFromCard(card) {
    if (!card || typeof Motion === 'undefined' || !Motion.isOn('deal')) return;
    if (Motion.transition() === 'none' || (typeof Perf !== 'undefined' && Perf.isLite && Perf.isLite())) return;
    const r = card.getBoundingClientRect();
    if (!r.width) return;
    const ghost = document.createElement('div');
    ghost.className = 'launch-ghost';
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    const sx = window.innerWidth / r.width, sy = window.innerHeight / r.height;
    ghost.style.setProperty('--lg-dx', Math.round(window.innerWidth / 2 - (r.left + r.width / 2)) + 'px');
    ghost.style.setProperty('--lg-dy', Math.round(window.innerHeight / 2 - (r.top + r.height / 2)) + 'px');
    ghost.style.setProperty('--lg-sx', sx.toFixed(3));
    ghost.style.setProperty('--lg-sy', sy.toFixed(3));
    document.body.appendChild(ghost);
    A.state.nextMode = 'fade';
    // запуск не дошёл до showScreen (ошибка/отмена) — разовая подмена не должна
    // «прилипнуть» к следующему переходу
    setTimeout(() => { A.state.nextMode = null; }, 250);
    setTimeout(() => ghost.remove(), 700);
  }

  A.smoothChange = smoothChange;
  A.launchFromCard = launchFromCard;
  A.rollNumber = rollNumber;
  A.pulseButton = pulseButton;
  A.initGraphicsMenu = initGraphicsMenu;
})(App);
