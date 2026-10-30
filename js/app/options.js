/* ============================================================
   APP/OPTIONS.JS — Подсветка, масштаб и читаемость (v34)

   Настройки «для глаз»: насколько заметны свободные фишки, выбранная
   фишка и подсказка; автомасштаб доски, крупный рисунок на фишках,
   лупа, размер интерфейса — и два пресета в один тап.

   Два вида настроек, оба описаны таблицами ниже:
     • CHOICES — выбор из нескольких вариантов (карточки .opt-card);
     • TOGGLES — тумблеры (чекбоксы .opt-toggle).
   Хранятся в Storage.setSetting(ключ, значение); значения проверяются
   по таблице — мусор из localStorage превращается в значение по умолчанию.
   ============================================================ */

(function (A) {
  'use strict';

  const CHOICES = {
    highlightLevel: { values: ['off', 'soft', 'bold', 'focus'], def: 'soft' },
    selectStyle:    { values: ['soft', 'bold'],                 def: 'soft' },
    hintStyle:      { values: ['normal', 'bold', 'max'],        def: 'normal' },
    uiScale:        { values: ['normal', 'large', 'xlarge'],    def: 'normal' },
  };
  // Множитель интерфейса (--ui-k): табло, кнопки и боковые планки
  const UI_K = { normal: 1, large: 1.2, xlarge: 1.4 };

  const TOGGLES = {
    showMatches: false, // подсветить свободных «двойников» выбранной фишки
    autozoom:    true,  // фишки растут по мере того, как стол пустеет
    bigSymbols:  false, // рисунок на фишке без полей
    loupe:       true,  // лупа в боковой планке
  };

  // Пресеты: «Крупно и ярко» — всё, что помогает плохому зрению; «Обычные» — как было
  const PRESETS = {
    bright: {
      name: 'Крупно и ярко',
      choices: { highlightLevel: 'bold', selectStyle: 'bold', hintStyle: 'max', uiScale: 'large' },
      toggles: { showMatches: true, autozoom: true, bigSymbols: true, loupe: true },
      tileSize: 'large',
    },
    default: {
      name: 'Обычные',
      choices: { highlightLevel: 'soft', selectStyle: 'soft', hintStyle: 'normal', uiScale: 'normal' },
      toggles: { showMatches: false, autozoom: true, bigSymbols: false, loupe: true },
      tileSize: 'large',
    },
  };

  function getChoice(key) {
    const c = CHOICES[key];
    const v = Storage.getSetting(key, c.def);
    return c.values.indexOf(v) >= 0 ? v : c.def;
  }
  function getToggle(key) {
    const v = Storage.getSetting(key, TOGGLES[key]);
    return typeof v === 'boolean' ? v : TOGGLES[key];
  }

  // Перекроить доску после изменения размеров (боковые планки, поля фишек)
  function relayout() {
    if (A.state.currentScreen !== 'game') return;
    requestAnimationFrame(() => {
      Render.reposition();
      Render.highlightFree(Storage.getSetting('highlight', true));
    });
  }

  function syncCards(key, value) {
    document.querySelectorAll('.opt-card[data-opt="' + key + '"]').forEach(c => {
      const on = c.dataset.value === value;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function applyChoice(key, value, opts) {
    const c = CHOICES[key];
    if (!c) return;
    if (c.values.indexOf(value) < 0) value = c.def;
    Storage.setSetting(key, value);
    syncCards(key, value);

    if (key === 'highlightLevel') {
      document.body.dataset.hl = value;
      // старый булев ключ читают десятки мест — держим его в согласии
      Storage.setSetting('highlight', value !== 'off');
      if (A.state.currentScreen === 'game') {
        Render.clearHighlight();
        if (value !== 'off') Render.highlightFree(true);
      }
    } else if (key === 'selectStyle') {
      document.body.dataset.sel = value;
    } else if (key === 'uiScale') {
      document.documentElement.style.setProperty('--ui-k', String(UI_K[value]));
      relayout();
    }
    // hintStyle читает Render.flashPair при каждой подсказке — делать нечего
    A.notifySettings(key, value); // v38: живое превью в настройках
    if (!opts || !opts.silent) A.toast('Сохранено');
  }

  function applyToggle(key, on, opts) {
    if (!(key in TOGGLES)) return;
    on = !!on;
    Storage.setSetting(key, on);
    document.querySelectorAll('.opt-toggle[data-opt="' + key + '"]').forEach(i => { i.checked = on; });

    if (key === 'loupe') {
      document.body.dataset.loupe = on ? 'on' : 'off';
      relayout(); // левая планка стала шире/уже
    } else if (key === 'autozoom' || key === 'bigSymbols') {
      relayout();
    } else if (key === 'showMatches' && A.state.currentScreen === 'game') {
      const st = Game.getState();
      Render.setSelected(st && st.selected ? st.selected : null);
    }
    A.notifySettings(key, on); // v38: живое превью в настройках
    if (!opts || !opts.silent) A.toast('Сохранено');
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    Object.keys(p.choices).forEach(k => applyChoice(k, p.choices[k], { silent: true }));
    Object.keys(p.toggles).forEach(k => applyToggle(k, p.toggles[k], { silent: true }));
    A.applyTileSize(p.tileSize);
    A.notifySettings('preset', name); // v38: превью обновится одним махом
    A.toast('Настройки: «' + p.name + '»');
  }

  // Применить всё сохранённое — при старте приложения
  function loadOptions() {
    Object.keys(CHOICES).forEach(k => applyChoice(k, getChoice(k), { silent: true }));
    Object.keys(TOGGLES).forEach(k => applyToggle(k, getToggle(k), { silent: true }));
  }

  // ---------- Лупа: выбранная/наведённая фишка крупно (боковая планка) ----------
  let loupeTile = null;
  function updateLoupe(tile) {
    const box = document.getElementById('loupe');
    if (!box || tile === loupeTile) return;
    loupeTile = tile || null;
    const card = box.querySelector('.loupe-card');
    const name = box.querySelector('.loupe-name');
    const state = box.querySelector('.loupe-state');
    if (!tile) {
      card.innerHTML = '';
      name.textContent = 'Лупа';
      state.textContent = 'наведите на фишку';
      box.classList.add('empty');
      box.classList.remove('is-free');
      return;
    }
    const free = Game.getFreeTiles().indexOf(tile) >= 0;
    card.innerHTML = Render.faceHtml(tile, 'loupe');
    name.textContent = tile.name;
    state.textContent = free ? 'можно убрать' : 'закрыта';
    box.classList.remove('empty');
    box.classList.toggle('is-free', free);
  }
  function resetLoupe() { loupeTile = null; updateLoupe(null); }

  // ---------- Подписки на элементы настроек ----------
  function bindOptions() {
    document.querySelectorAll('.opt-card').forEach(c => {
      c.addEventListener('click', () => applyChoice(c.dataset.opt, c.dataset.value));
    });
    document.querySelectorAll('.opt-toggle').forEach(i => {
      i.addEventListener('change', () => applyToggle(i.dataset.opt, i.checked));
    });
    document.querySelectorAll('[data-preset]').forEach(b => {
      b.addEventListener('click', () => applyPreset(b.dataset.preset));
    });
    const board = document.getElementById('board');
    if (board) {
      board.addEventListener('mouseover', e => {
        const t = Render.tileOf(e.target);
        if (t) updateLoupe(t);
      });
    }
  }

  Object.assign(A, {
    applyChoice,
    applyToggle,
    applyPreset,
    loadOptions,
    bindOptions,
    updateLoupe,
    resetLoupe,
    getChoice,
    getToggle,
  });
  A.optionTables = { CHOICES, TOGGLES, PRESETS, UI_K };
})(App);
