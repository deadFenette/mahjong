/* ============================================================
   APP/SETTINGS.JS — Настройки: тема, размер, скин, прозрачность, музыка и звук (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Настройки ----------
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    Storage.setSetting('theme', theme);
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === theme);
    });
    // v10: у каждой темы свой музыкальный лад
    Music.setTheme(theme);
  }

  function applyTileSize(size) {
    Storage.setSetting('tileSize', size);
    document.querySelectorAll('.size-card').forEach(c => {
      c.classList.toggle('active', c.dataset.size === size);
    });
    if (A.state.currentScreen === 'game') {
      Render.reposition();
      Render.highlightFree(Storage.getSetting('highlight', true));
    }
  }

  // ---------- Масштаб фишек прямо в игре (v14, расширено v19) ----------
  // Кнопка-лупа в шапке и клавиши + / − переключают тот же параметр
  // tileSize, что и «Настройки → Размер фишек».
  // v19: 5 размеров вместо 3 — добавились «Микро» и «Огромные».
  const TILE_SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'xl'];
  const TILE_SIZE_NAMES = {
    tiny: 'Микро',
    small: 'Маленькие',
    medium: 'Средние',
    large: 'Крупные',
    xl: 'Огромные',
  };

  function actZoom(dir) {
    const cur = Storage.getSetting('tileSize', 'large');
    let i = TILE_SIZE_ORDER.indexOf(cur);
    if (i < 0) i = TILE_SIZE_ORDER.indexOf('large');
    // dir: +1 крупнее, −1 мельче, 0 — по кругу (кнопка)
    const next = dir === 0
      ? (i + 1) % TILE_SIZE_ORDER.length
      : Math.max(0, Math.min(TILE_SIZE_ORDER.length - 1, i + dir));
    if (next === i) {
      A.toast(dir > 0 ? 'Уже самый крупный размер' : 'Уже самый мелкий размер');
      return;
    }
    applyTileSize(TILE_SIZE_ORDER[next]);
    A.toast('Размер фишек: ' + TILE_SIZE_NAMES[TILE_SIZE_ORDER[next]]);
  }

  // ---------- Прозрачность фишек (v6) ----------
  // Слайдер в настройках: 0% — фишки плотные (ничего не просвечивает),
  // до 50% — закрытые фишки «стеклянные». Пишется в Storage и применяется
  // через CSS-переменную на доске — мгновенно, даже прямо посреди партии.
  function applyTileTransparency(pct, opts = {}) {
    const clamped = Render.setTileTransparency(pct);
    if (opts.persist !== false) {
      Storage.setSetting('tileTransparency', clamped);
    }
    const out = document.getElementById('setting-tile-transparency-out');
    const slider = document.getElementById('setting-tile-transparency');
    if (out) out.textContent = clamped + '%';
    if (slider) {
      slider.value = String(clamped);
      // Заливка трека слайдера до текущего значения
      const max = Render.TRANSPARENCY_MAX || 50;
      slider.style.setProperty('--range-fill', (clamped / max * 100) + '%');
    }
    A.notifySettings('tileTransparency', clamped); // v38: живое превью
  }

  // ---------- Фоновая музыка (v10) ----------
  // Тумблер и громкость в настройках, дублирующая кнопка в паузе.
  // Настройка пишется в Storage и мгновенно применяется к движку.
  function updatePauseMusicLabel() {
    const btn = document.getElementById('pause-music');
    if (!btn) return;
    btn.textContent = 'Музыка: ' + (Storage.getSetting('music', true) ? 'вкл' : 'выкл');
  }

  function applyMusicEnabled(v, opts = {}) {
    if (opts.persist !== false) Storage.setSetting('music', !!v);
    Music.setEnabled(!!v);
    const cb = document.getElementById('setting-music');
    if (cb) cb.checked = !!v;
    updatePauseMusicLabel();
  }

  function applyMusicVolume(pct, opts = {}) {
    const p = Music.clampVolume(pct);
    if (opts.persist !== false) Storage.setSetting('musicVolume', p);
    Music.setVolume(p);
    const out = document.getElementById('setting-music-volume-out');
    const slider = document.getElementById('setting-music-volume');
    if (out) out.textContent = p + '%';
    if (slider) {
      slider.value = String(p);
      // Заливка трека слайдера до текущего значения
      slider.style.setProperty('--range-fill', p + '%');
    }
  }

  // ---------- Громкость эффектов (v26) ----------
  function applySfxVolume(pct, opts = {}) {
    const p = Audio2.clampVolume(pct);
    if (opts.persist !== false) Storage.setSetting('sfxVolume', p);
    Audio2.setVolume(p);
    const out = document.getElementById('setting-sfx-volume-out');
    const slider = document.getElementById('setting-sfx-volume');
    if (out) out.textContent = p + '%';
    if (slider) {
      slider.value = String(p);
      slider.style.setProperty('--range-fill', p + '%');
    }
  }

  // ---------- Сборник музыки (v26) ----------
  function buildTrackSelect() {
    const sel = document.getElementById('setting-music-track');
    if (!sel) return;
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = 'Авто — плейлист';
    sel.appendChild(auto);
    Music.getTracks().forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.name;
      sel.appendChild(o);
    });
  }

  function updateNowPlaying() {
    const mode = Music.getTrackMode();
    const sel = document.getElementById('setting-music-track');
    if (sel) sel.value = mode;
    const el = document.getElementById('music-now-playing');
    if (el) {
      const name = Music.getTrack().name;
      el.textContent = (mode === 'auto' ? 'Авто · сейчас: ' : 'По кругу: ') + name;
    }
  }

  function applyMusicTrack(id, opts = {}) {
    Music.setTrack(id);
    if (opts.persist !== false) Storage.setSetting('musicTrack', Music.getTrackMode());
    updateNowPlaying();
  }

  function loadSettings() {
    applyTheme(Storage.getSetting('theme', 'traditional'));
    applyTileSize(Storage.getSetting('tileSize', 'large'));
    // v19-skins: скин фишек (classic по умолчанию). silent — без toast.
    A.applyTileSkin(Storage.getSetting('tileSkin', Tileset.defaultSkinId()), { silent: true });
    // Прозрачность по умолчанию 0% — фишки плотные (регрессия v5: было 0.88)
    applyTileTransparency(Storage.getSetting('tileTransparency', 0), { persist: false });
    // v10: музыка — тумблер, громкость и заливка слайдера
    applyMusicEnabled(Storage.getSetting('music', true), { persist: false });
    applyMusicVolume(Storage.getSetting('musicVolume', Music.VOLUME_DEFAULT), { persist: false });
    buildTrackSelect();
    updateNowPlaying();
    applySfxVolume(Storage.getSetting('sfxVolume', Audio2.VOLUME_DEFAULT), { persist: false });
    document.getElementById('setting-sound').checked = Storage.getSetting('sound', true);
    document.getElementById('setting-win-sound').checked = Storage.getSetting('winSound', true);
    // v34: подсветка, масштаб, лупа — js/app/options.js
    A.loadOptions();
    document.getElementById('setting-autohint').checked = Storage.getSetting('autohint', false);
  }

  Object.assign(A, {
    actZoom,
    applyMusicEnabled,
    applyMusicTrack,
    applyMusicVolume,
    applySfxVolume,
    applyTheme,
    applyTileSize,
    applyTileTransparency,
    loadSettings,
    updateNowPlaying,
    updatePauseMusicLabel,
  });
})(App);
