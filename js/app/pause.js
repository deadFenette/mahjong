/* ============================================================
   APP/PAUSE.JS — Пауза, полный экран, ресайз, режим графики, золотая пыль (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Пауза ----------
  function openPause() {
    const state = Game.getState();
    if (!state || state.ended) return;
    Game.pause(); // v9: флаг + честная остановка часов
    // v10: музыка приглушается — но не выключается
    Music.duck(true);
    // v9: сводка на карточке паузы — счёт и время видно без выхода из паузы
    const sEl = document.getElementById('pause-score');
    const tEl = document.getElementById('pause-time');
    if (sEl) sEl.textContent = state.score;
    if (tEl) tEl.textContent = A.formatTime(Game.getElapsedSeconds());
    A.updatePauseMusicLabel();
    document.getElementById('pause-overlay').hidden = false;
    A.cancelAutohint();
  }
  function closePause() {
    document.getElementById('pause-overlay').hidden = true;
    Game.resume(); // v9
    Music.duck(false); // v10: возвращаем громкость
    A.state.lastActionTime = Date.now();
    A.scheduleAutohint();
  }

  // ---------- Полный экран (v9) ----------
  // Кнопка в карточке паузы. Без поддержки API — кнопка скрывается.
  function fullscreenAvailable() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }
  function toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    const fsEl = d.fullscreenElement || d.webkitFullscreenElement;
    if (fsEl) {
      const exit = d.exitFullscreen || d.webkitExitFullscreen;
      if (exit) exit.call(d);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        // Отказ (нет жеста пользователя, запрет iframe и т.п.) не роняет страницу
        const p = req.call(el);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    }
  }
  function updateFullscreenLabel() {
    const btn = document.getElementById('pause-fullscreen');
    if (!btn) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    btn.textContent = fsEl ? 'Обычный экран' : 'Полный экран';
  }

  // ---------- Ресайз ----------
  // Дебаунс + ResizeObserver: ловит и изменение окна, и изменение
  // самого контейнера (PWA-окно, панель разработчика, системный зум)
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (A.state.currentScreen === 'game') {
        Render.reposition();
      }
      // Перерисовать превью раскладок, если мы в галерее
      if (A.state.currentScreen === 'layouts') {
        Layouts.all.forEach(layout => {
          const preview = document.querySelector(`.layout-preview[data-layout="${layout.id}"]`);
          if (preview) A.drawLayoutPreview(preview, layout);
        });
      }
    }, 150);
  }

  // ---------- Графика: авто / лёгкая / полная (v32) ----------
  function syncPerfPicker() {
    const mode = Perf.getMode();
    document.querySelectorAll('#perf-picker [data-perf-mode]').forEach(b =>
      b.classList.toggle('active', b.dataset.perfMode === mode));
    const note = document.getElementById('perf-note');
    if (note) {
      note.textContent = (mode === 'auto'
        ? 'Сейчас выбрана ' + (Perf.isLite() ? 'лёгкая' : 'полная') + ' графика (определилась сама). '
        : '') + 'Если игра тормозит — включите «Лёгкая»: она отключает размытие, свечения и анимации фона.';
    }
  }

  function initPerfSettings() {
    document.querySelectorAll('#perf-picker [data-perf-mode]').forEach(b =>
      b.addEventListener('click', () => {
        Perf.setMode(b.dataset.perfMode);
        syncPerfPicker();
        // Доска считает размеры от стола — после смены режима пересчитаем
        requestAnimationFrame(() => Render.reposition());
      }));
    syncPerfPicker();
    // Сторож кадров: если в авто-режиме игра идёт медленнее ~30 кадров/с —
    // молча переходим на лёгкую графику (и запоминаем это)
    setTimeout(() => Perf.watch(() => {
      syncPerfPicker();
      A.toast('Включена лёгкая графика — так игра пойдёт плавнее');
    }), 2500);
  }

  // ---------- Золотая пыль (v10) ----------
  // Медленно поднимающиеся золотые искры в меню — глубина и «богатство».
  // CSS-анимация, reduced-motion гасит глобально (main.css).
  function initGoldDust() {
    const container = document.getElementById('menu-dust');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const mote = document.createElement('span');
      mote.className = 'dust-mote';
      mote.style.left = (Math.random() * 100) + '%';
      mote.style.bottom = (-10 - Math.random() * 20) + '%';
      mote.style.animationDuration = (14 + Math.random() * 14) + 's';
      mote.style.animationDelay = (-Math.random() * 24) + 's';
      const size = 2 + Math.random() * 4;
      mote.style.width = size.toFixed(1) + 'px';
      mote.style.height = size.toFixed(1) + 'px';
      mote.style.setProperty('--dx', ((Math.random() * 2 - 1) * 60).toFixed(0) + 'px');
      container.appendChild(mote);
    }
  }

  Object.assign(A, {
    closePause,
    fullscreenAvailable,
    initGoldDust,
    initPerfSettings,
    onResize,
    openPause,
    toggleFullscreen,
    updateFullscreenLabel,
  });
})(App);
