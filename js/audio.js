/* ============================================================
   AUDIO.JS — Звуковые эффекты через Web Audio API
   Без внешних файлов — генерируем на лету
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

  // Простой тон с огибающей
  function tone(freq, duration, type = 'sine', volume = 0.2, delay = 0) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  // Клик фишки — мягкий "клик"
  function click() {
    tone(660, 0.06, 'triangle', 0.12);
    tone(880, 0.04, 'sine', 0.08, 0.01);
  }

  // Совпадение — приятный аккорд (восходящий)
  function match() {
    tone(523.25, 0.15, 'sine', 0.18);        // C5
    tone(659.25, 0.15, 'sine', 0.16, 0.04);  // E5
    tone(783.99, 0.22, 'sine', 0.18, 0.08);  // G5
  }

  // Комбо (v11) — восходящая искристая фраза; чем длиннее
  // серия, тем выше тон. Ограничение сверху — чтобы к ×8
  // звук оставался приятным, а не звенел.
  function combo(mult) {
    const m = Number(mult);
    const level = (Number.isInteger(m) && m >= 2) ? Math.min(m, 8) : 2;
    const k = 1 + (level - 2) * 0.06; // 1.0 … 1.36
    tone(523.25 * k, 0.12, 'sine', 0.16);
    tone(659.25 * k, 0.12, 'sine', 0.15, 0.05);
    tone(783.99 * k, 0.18, 'sine', 0.17, 0.10);
    tone(1046.5 * k, 0.26, 'sine', 0.15, 0.15);
  }

  // Не совпало — мягкий "пуф"
  function mismatch() {
    tone(220, 0.1, 'sawtooth', 0.08);
  }

  // Подсказка — короткий звонок
  function hint() {
    tone(987.77, 0.08, 'sine', 0.12);
    tone(1318.51, 0.1, 'sine', 0.1, 0.05);
  }

  // Победа — мелодия
  function win() {
    if (!winSoundEnabled) return;
    const notes = [
      [523.25, 0],   // C5
      [659.25, 0.15], // E5
      [783.99, 0.3],  // G5
      [1046.5, 0.45], // C6
      [1318.51, 0.65], // E6
      [1567.98, 0.85], // G6
      [2093.0, 1.1],   // C7
    ];
    notes.forEach(([f, t]) => tone(f, 0.3, 'sine', 0.18, t));
  }

  // Перемешать — шуршание
  function shuffleSound() {
    for (let i = 0; i < 6; i++) {
      tone(400 + Math.random() * 400, 0.05, 'triangle', 0.06, i * 0.04);
    }
  }

  function setEnabled(v) { enabled = v; }
  function setWinEnabled(v) { winSoundEnabled = v; }

  return { init, click, match, combo, mismatch, hint, win, shuffleSound, setEnabled, setWinEnabled };
})();
