/* ============================================================
   APP/INIT.JS — Инициализация: навешивание обработчиков, запуск (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Инициализация ----------
  function init() {
    Icons.hydrate(); // v32: SVG вместо эмодзи (на Windows 7 их нет)
    Audio2.init();
    // v10: фоновая музыка — лад берём из сохранённой темы
    Music.init({
      theme: Storage.getSetting('theme', 'traditional'),
      enabled: Storage.getSetting('music', true),
      volumePct: Storage.getSetting('musicVolume', Music.VOLUME_DEFAULT),
      track: Storage.getSetting('musicTrack', 'auto'), // v26: сборник
    });
    Music.onTrackChange(A.updateNowPlaying);
    Render.init(document.getElementById('board'));
    A.loadSettings();
    A.updateMenuStats();
    A.initGoldDust(); // v10

    // Кнопки главного меню
    document.getElementById('btn-continue').addEventListener('click', A.continueSaved);
    document.getElementById('btn-classic').addEventListener('click', () => {
      A.renderLayoutsGrid();
      A.showScreen('layouts');
    });
    document.getElementById('btn-endless').addEventListener('click', () => {
      A.showScreen('difficulty');
    });
    // v21-daily: ежедневная раскладка (одна на всех, по дате)
    document.getElementById('btn-daily').addEventListener('click', A.startDaily);
    // v31: Микс — экран генератора раскладки (способ, число фишек, форма)
    A.initMixScreen();
    A.initPerfSettings(); // v32
    A.initGraphicsMenu(); // v44: меню «Графика и анимации»
    document.getElementById('btn-mix').addEventListener('click', A.openMixScreen);
    document.getElementById('btn-settings').addEventListener('click', () => {
      A.showScreen('settings');
    });

    // v12: обучение — кнопка в меню, автопоказ при первом визите,
    // «Играть!» на последнем шаге стартует лёгкую «Пирамиду»
    if (typeof Tutorial !== 'undefined') {
      Tutorial.init({ startGame: () => A.startClassic('pyramid') });
      const tutBtn = document.getElementById('btn-tutorial');
      if (tutBtn) tutBtn.addEventListener('click', () => Tutorial.open());
      if (!Tutorial.isSeen()) Tutorial.open();
    }

    // Назад
    document.getElementById('back-layouts').addEventListener('click', () => A.showScreen('menu'));
    document.getElementById('back-difficulty').addEventListener('click', () => A.showScreen('menu'));
    document.getElementById('back-settings').addEventListener('click', () => A.showScreen('menu'));

    // Сложность
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => {
        A.startEndless(card.dataset.difficulty);
      });
    });

    // Кнопки игры
    document.getElementById('game-menu').addEventListener('click', A.openPause);
    document.getElementById('btn-zoom').addEventListener('click', () => A.actZoom(0));
    document.getElementById('btn-hint').addEventListener('click', A.actHint);
    document.getElementById('btn-shuffle').addEventListener('click', A.actShuffle);
    document.getElementById('btn-undo').addEventListener('click', A.actUndo);

    // Пауза
    document.getElementById('pause-resume').addEventListener('click', A.closePause);
    // v9: полноэкранный режим в карточке паузы
    const fsBtn = document.getElementById('pause-fullscreen');
    if (fsBtn) {
      if (A.fullscreenAvailable()) {
        fsBtn.addEventListener('click', A.toggleFullscreen);
        ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
          document.addEventListener(ev, A.updateFullscreenLabel));
      } else {
        fsBtn.hidden = true;
      }
    }
    document.getElementById('pause-restart').addEventListener('click', () => {
      const state = Game.getState();
      if (state) {
        Game.newGame(state.layout);
        Render.fitBoard(state.layout);
        Render.renderFull();
        // v44: раздача и звук — когда экран игры реально показан (после шторки)
        A.afterScreen('game', () => { Render.playDealAnimation(); Audio2.deal(); });
        Render.highlightFree(Storage.getSetting('highlight', true));
        A.updateGameInfo();
        A.startTimer();
        A.closePause();
        A.saveCurrentGame();
      }
    });
    document.getElementById('pause-new').addEventListener('click', () => {
      const st = Game.getState();
      A.closePause();
      if (st && st.mode === 'mix') { A.openMixScreen(); return; } // v31
      A.renderLayoutsGrid();
      A.showScreen('layouts');
    });
    document.getElementById('pause-menu').addEventListener('click', () => {
      A.closePause();
      A.saveCurrentGame();
      A.showScreen('menu');
    });

    // Победа
    document.getElementById('win-again').addEventListener('click', () => {
      const state = Game.getState();
      if (state) {
        Game.newGame(state.layout);
        Render.fitBoard(state.layout);
        Render.renderFull();
        // v44: раздача и звук — когда экран игры реально показан (после шторки)
        A.afterScreen('game', () => { Render.playDealAnimation(); Audio2.deal(); });
        Render.highlightFree(Storage.getSetting('highlight', true));
        A.updateGameInfo();
        A.showScreen('game');
        A.startTimer();
        A.state.lastActionTime = Date.now();
        A.scheduleAutohint();
      }
    });
    document.getElementById('win-next').addEventListener('click', () => {
      const state = Game.getState();
      if (state && state.mode === 'endless') {
        // Счёт сохраняем, переходим к следующей раскладке
        const prevScore = state.score;
        const prevHints = state.hintsUsed;
        const prevShuffles = state.shufflesUsed;
        const endlessLevel = state.endlessLevel + 1;
        A.startEndlessRound(endlessLevel);
        // Переносим накопленный счёт
        const newState = Game.getState();
        newState.score = prevScore + 50; // бонус за победу
        newState.hintsUsed = prevHints;
        newState.shufflesUsed = prevShuffles;
        A.updateGameInfo();
      } else if (state && state.mode === 'daily') {
        // v21-daily: та же раскладка на день — заново (счёт не переносим)
        A.startDaily();
      } else if (state && state.mode === 'mix') {
        // v31: свежий узор с теми же настройками
        if (!A.state.mixOpts) A.state.mixOpts = A.loadMixOpts();
        A.state.mixOpts.seed = MixGen.randomSeed();
        A.startMix(MixGen.generate(A.state.mixOpts));
      }
    });
    document.getElementById('win-menu').addEventListener('click', () => {
      A.showScreen('menu');
    });

    // Темы
    document.querySelectorAll('.theme-card').forEach(c => {
      c.addEventListener('click', () => A.smoothChange(() => A.applyTheme(c.dataset.theme)));
    });

    // Размер фишек
    document.querySelectorAll('.size-card').forEach(c => {
      c.addEventListener('click', () => A.applyTileSize(c.dataset.size));
    });

    // v44: карточки скинов рисуются из реестра Tileset (js/app/skins.js)
    A.initSkinPicker();

    // Прозрачность фишек — живой отклик на движение слайдера
    const transparencySlider = document.getElementById('setting-tile-transparency');
    if (transparencySlider) {
      transparencySlider.addEventListener('input', e => {
        A.applyTileTransparency(Number(e.target.value));
      });
    }

    // Звук
    document.getElementById('setting-sound').addEventListener('change', e => {
      Storage.setSetting('sound', e.target.checked);
      Audio2.setEnabled(e.target.checked);
      if (e.target.checked) Audio2.click();
    });
    document.getElementById('setting-win-sound').addEventListener('change', e => {
      Storage.setSetting('winSound', e.target.checked);
      Audio2.setWinEnabled(e.target.checked);
    });

    // v26: громкость эффектов (по отпусканию ползунка — пробный звук)
    const sfxVolSlider = document.getElementById('setting-sfx-volume');
    if (sfxVolSlider) {
      sfxVolSlider.addEventListener('input', e => {
        A.applySfxVolume(Number(e.target.value));
      });
      sfxVolSlider.addEventListener('change', () => Audio2.previewSound('match'));
    }

    // v26: сборник — выбор пьесы и «следующая»
    const trackSel = document.getElementById('setting-music-track');
    if (trackSel) {
      trackSel.addEventListener('change', e => {
        A.applyMusicTrack(e.target.value);
        if (!Music.isPlaying() && Storage.getSetting('music', true)) Music.start();
        Audio2.click();
      });
    }
    const nextTrackBtn = document.getElementById('setting-music-next');
    if (nextTrackBtn) {
      nextTrackBtn.addEventListener('click', () => {
        if (!Storage.getSetting('music', true)) A.applyMusicEnabled(true);
        const t = Music.nextTrack();
        Storage.setSetting('musicTrack', Music.getTrackMode());
        A.updateNowPlaying();
        A.toast('Играет: ' + t.name);
        Audio2.click();
      });
    }

    // v10: фоновая музыка — тумблер, громкость, кнопка в паузе
    document.getElementById('setting-music').addEventListener('change', e => {
      A.applyMusicEnabled(e.target.checked);
      if (e.target.checked) Audio2.click();
    });
    const musicVolSlider = document.getElementById('setting-music-volume');
    if (musicVolSlider) {
      musicVolSlider.addEventListener('input', e => {
        A.applyMusicVolume(Number(e.target.value));
      });
    }
    const pauseMusicBtn = document.getElementById('pause-music');
    if (pauseMusicBtn) {
      pauseMusicBtn.addEventListener('click', () => {
        A.applyMusicEnabled(!Storage.getSetting('music', true));
        Audio2.click();
      });
    }
    // v34: подсветка, масштаб, лупа и пресеты — в js/app/options.js
    A.bindOptions();
    // v34: «Сначала крупные» на экране выбора раскладки
    const sortBtn = document.getElementById('layouts-sort');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        Storage.setSetting('layoutsSort', !(Storage.getSetting('layoutsSort', false) === true));
        A.renderLayoutsGrid();
      });
    }
    document.getElementById('setting-autohint').addEventListener('change', e => {
      Storage.setSetting('autohint', e.target.checked);
      if (e.target.checked) A.scheduleAutohint();
      else clearTimeout(A.state.hintTimer);
    });

    // Сброс статистики
    document.getElementById('setting-reset-stats').addEventListener('click', async () => {
      // v20: кастомный confirm overlay вместо нативного window.confirm()
      const ok = await A.showConfirm({
        title: 'Сбросить статистику?',
        message: 'Сыграно партий, победы, рекорды и достижения будут удалены. Это действие нельзя отменить.',
        okLabel: 'Да, сбросить',
        cancelLabel: 'Отмена',
        danger: true,
      });
      if (ok) {
        Storage.resetStats();
        A.updateMenuStats();
        A.toast('Статистика сброшена');
      }
    });

    // Ресайз
    window.addEventListener('resize', A.onResize);
    window.addEventListener('orientationchange', A.onResize);
    // Следим за самим контейнером доски — PWA/зум/док-панели
    const stage = document.getElementById('board-stage');
    if (stage && 'ResizeObserver' in window) {
      new ResizeObserver(A.onResize).observe(stage);
    }

    // Клавиатура
    document.addEventListener('keydown', e => {
      if (A.state.currentScreen !== 'game') return;
      const pauseEl = document.getElementById('pause-overlay');
      const pauseOpen = pauseEl && !pauseEl.hidden;
      if (e.key === 'Escape') {
        if (pauseOpen) A.closePause(); else A.openPause();
        return;
      }
      // Игровые действия заблокированы, пока открыта пауза
      if (pauseOpen) return;
      if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') A.actHint();
      if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') A.actShuffle();
      if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') A.actUndo();
      if (e.key === '+' || e.key === '=') A.actZoom(1);
      if (e.key === '-' || e.key === '_') A.actZoom(-1);
    });
  }

  Object.assign(A, {
    init,
  });
})(App);

// Запуск приложения
document.addEventListener('DOMContentLoaded', App.init);
