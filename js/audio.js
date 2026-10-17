/* ============================================================
   AUDIO.JS — Тонкая обёртка над Sounds-модулем (v25-sounds)

   Все звуки теперь лежат в js/sounds/ — каждый в отдельном файле.
   Этот модуль управляет AudioContext, глобальными настройками
   (вкл/выкл) и делегирует проигрывание в Sounds.*.play().

   Чтобы добавить новый звук:
   1. Создайте js/sounds/my-sound.js:
      Sounds.mySound = {
        name: 'Мой звук',
        desc: 'Описание',
        play: function(ctx, playTone, ...args) {
          playTone(440, 0.1, 'sine', 0.2);
        }
      };
   2. Подключите его в index.html перед sounds/index.js:
      <script src="js/sounds/my-sound.js"></script>
   3. Вызывайте: Audio2.mySound() — обёртка ниже это поддерживает.

   Чтобы заменить существующий звук: отредактируйте нужный файл
   в js/sounds/ — например, sounds/click.js для клика фишки.
   ============================================================ */

const Audio2 = (function () {
  let ctx = null;
  let enabled = true;
  let winSoundEnabled = true;

  function init() {
    enabled = Storage.getSetting('sound', true);
    winSoundEnabled = Storage.getSetting('winSound', true);
  }

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Базовый хелпер — простой тон с огибающей. Передаётся в каждый
  // звук как playTone, чтобы звуки могли его использовать.
  function tone(freq, duration, type, volume, delay) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume || 0.2, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  // Универсальный проигрыватель звука по id из каталога Sounds.
  // ctx передаётся в play(), а также playTone для простых тонов.
  function playSound(soundId, ...args) {
    if (!enabled && soundId !== 'win') return; // win проверяет winSoundEnabled внутри
    const sound = Sounds[soundId];
    if (!sound || typeof sound.play !== 'function') return;
    const c = ensureCtx();
    if (!c) return;
    // Для win-звука передаём winSoundEnabled как опцию
    if (soundId === 'win') {
      sound.play(c, tone, { winSoundEnabled });
    } else {
      sound.play(c, tone, ...args);
    }
  }

  // ---------- Публичный API (совместимый со старым) ----------
  // Каждый метод — тонкая обёртка над Sounds[id].play().

  function click()    { playSound('click'); }
  function match()    { playSound('match'); }
  function combo(mult){ playSound('combo', mult); }
  function mismatch() { playSound('mismatch'); }
  function hint()     { playSound('hint'); }
  function win()      { playSound('win'); }
  function shuffleSound() { playSound('shuffle'); }
  function hover() {
    if (!enabled) return;
    playSound('hover');
  }

  // ---------- Управление настройками ----------
  function setEnabled(v) { enabled = v; }
  function setWinEnabled(v) { winSoundEnabled = v; }

  // ---------- Каталог звуков (для UI предпросмотра) ----------
  function getCatalog() {
    return Sounds.CATALOG || [];
  }

  // ---------- Предпросмотр звука (для тестов в настройках) ----------
  function previewSound(id) {
    // Предпросмотр играем даже если звук выключен — это тест
    const wasEnabled = enabled;
    enabled = true;
    playSound(id);
    enabled = wasEnabled;
  }

  return {
    init,
    click,
    match,
    combo,
    mismatch,
    hint,
    win,
    shuffleSound,
    hover,
    setEnabled,
    setWinEnabled,
    // v25: каталог + предпросмотр
    getCatalog,
    previewSound,
  };
})();
