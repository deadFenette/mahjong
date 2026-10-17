/* ============================================================
   AUDIO.JS — Движок звуковых эффектов (v26-audio)

   Архитектура:
     Sounds.*.play(ctx, kit, ...args)  →  kit-голоса  →  sfxBus
                                                          ├─ сухой сигнал
                                                          └─ общий реверб («комната»)
     sfxBus → DynamicsCompressor (мягкий лимитер) → destination

   Что нового по сравнению с v25:
   • ОБЩАЯ ШИНА: громкость эффектов, лимитер от клиппинга и один
     реверб на все звуки — они звучат как из одной «комнаты».
   • ОДНА ТОНАЛЬНОСТЬ с музыкой: звуки берут ноты из пентатоники
     играющего трека (kit.note(ступень)), поэтому клик, пара и
     комбо никогда не «фальшивят» поверх музыки.
   • Богатый набор голосов (kit): bell, pure, thump, noise, tap.
   • Новые звуки: deselect, blocked, undo, deal.
   • Ползунок громкости эффектов (настройка sfxVolume).

   Чтобы добавить звук:
   1. Создайте js/sounds/my-sound.js:
        Sounds.mySound = {
          name: 'Мой звук', desc: 'Описание',
          play: function (ctx, kit, ...args) {
            kit.bell(kit.note(7), 0.4, 0.06, 0, 0.3);
          }
        };
   2. Подключите его в index.html перед sounds/index.js и добавьте
      в sw.js и в CATALOG (sounds/index.js).
   3. Вызывайте: Audio2.play('mySound').

   kit — это ещё и функция playTone(freq, dur, type, vol, delay):
   старые звуки, написанные под v25, продолжают работать.
   ============================================================ */

const Audio2 = (function () {
  const VOLUME_MAX = 1.2;     // мастер-гейн эффектов при 100%
  const VOLUME_DEFAULT = 70;  // % по умолчанию

  let ctx = null;
  let enabled = true;
  let winSoundEnabled = true;
  let volumePct = VOLUME_DEFAULT;

  let sfxBus = null;      // громкость эффектов
  let reverbSend = null;  // вход в общий реверб
  let noiseBuf = null;    // 1 с белого шума для шуршаний
  let key = { root: 60, scale: [0, 2, 4, 7, 9] };

  // ---------- Чистая математика ----------
  function clampVolume(pct) {
    const p = Number(pct);
    if (!Number.isFinite(p)) return VOLUME_DEFAULT;
    return Math.max(0, Math.min(100, Math.round(p)));
  }
  // Квадратичная кривая: нижняя половина ползунка регулируется плавнее
  function volumeGain(pct) {
    const v = clampVolume(pct) / 100;
    return VOLUME_MAX * v * v;
  }
  // Корень тональности загоняем в окно MIDI 52..63 — эффекты всегда
  // звучат в комфортной области (без писка на высоких комбо)
  function fitRoot(root) {
    const r = Number(root);
    if (!Number.isFinite(r)) return 60;
    return 52 + (((r - 52) % 12) + 12) % 12;
  }
  // Ступень пентатоники (можно отрицательную/выше октавы) → частота
  function degreeToFreq(k, deg) {
    const n = k.scale.length;
    const d = Math.round(Number(deg) || 0);
    const oct = Math.floor(d / n);
    const idx = ((d % n) + n) % n;
    return 440 * Math.pow(2, (k.root + k.scale[idx] + 12 * oct - 69) / 12);
  }

  // ---------- Контекст и граф ----------
  function makeImpulse(c, seconds, decay) {
    const rate = c.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += ((Math.random() * 2 - 1) - lp) * 0.35; // тёмный «бархатный» хвост
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function buildGraph() {
    sfxBus = ctx.createGain();
    sfxBus.gain.value = volumeGain(volumePct);

    // Мягкий лимитер: быстрые пики (комбо, победа) не клиппят
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    sfxBus.connect(comp);
    comp.connect(ctx.destination);

    // Общий реверб — короткая тёплая комната (1.4 с)
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 1.4, 3.2);
    reverbSend = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverbSend.connect(conv);
    conv.connect(wet);
    wet.connect(sfxBus);

    // Белый шум для шуршаний и «стука»
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        buildGraph();
      } catch (e) {
        ctx = null;
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Подхватываем тональность играющего трека (Music грузится позже)
  function refreshKey() {
    if (typeof Music === 'undefined' || typeof Music.getKey !== 'function') return;
    const k = Music.getKey();
    if (k && Array.isArray(k.scale) && k.scale.length) {
      key = { root: fitRoot(k.root), scale: k.scale };
    }
  }

  // ---------- Голоса (kit) ----------
  // Подать узел в сухую шину и (опционально) в реверб
  function route(node, wet, pan) {
    let out = node;
    if (pan && ctx.createStereoPanner) {
      const sp = ctx.createStereoPanner();
      sp.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(sp);
      out = sp;
    }
    out.connect(sfxBus);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      out.connect(s);
      s.connect(reverbSend);
    }
  }

  // Совместимый с v25 простой тон. Теперь идёт через общую шину.
  function tone(freq, duration, type, volume, delay) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(volume || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    osc.connect(g);
    route(g, 0);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Чистый синус с мягкой атакой — для наведения и тонких акцентов
  function pure(freq, dur, vol, delay, wet) {
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g);
    route(g, wet || 0);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Мягкий колокольчик/маримба: основной тон + два быстро гаснущих
  // обертона. Тёплый, без металлического «дзынь».
  const BELL_PARTIALS = [
    { mult: 1.0,  gain: 1.00, decay: 1.00 },
    { mult: 2.0,  gain: 0.28, decay: 0.55 },
    { mult: 3.01, gain: 0.10, decay: 0.35 },
  ];
  function bell(freq, dur, vol, delay, wet, pan) {
    const t0 = ctx.currentTime + (delay || 0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    BELL_PARTIALS.forEach(p => {
      const osc = ctx.createOscillator();
      const pg = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * p.mult;
      pg.gain.setValueAtTime(p.gain, t0);
      pg.gain.exponentialRampToValueAtTime(0.0008, t0 + dur * p.decay);
      osc.connect(pg);
      pg.connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
    route(g, wet || 0, pan);
  }

  // Глухой «тук» — тело фишки: синус с быстрым падением высоты
  function thump(freq, vol, delay, dur) {
    const t0 = ctx.currentTime + (delay || 0);
    const d = dur || 0.1;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.04);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
    osc.connect(g);
    route(g, 0);
    osc.start(t0);
    osc.stop(t0 + d + 0.02);
  }

  // Фильтрованный шум: opts = { type, freq, freqTo, q, wet, pan }
  function noise(dur, vol, delay, opts) {
    opts = opts || {};
    const t0 = ctx.currentTime + (delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true; // шорох длиннее буфера (1 с) не обрывается
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1500, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
    f.Q.value = opts.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.01, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f);
    f.connect(g);
    route(g, opts.wet || 0, opts.pan);
    src.start(t0, Math.random() * 0.6);
    src.stop(t0 + dur + 0.02);
  }

  // «Фишка о дерево»: тук + короткий приглушённый шорох.
  // bright 0..1 — насколько «сухой и яркий» контакт.
  function tap(vol, delay, bright) {
    const b = Math.max(0, Math.min(1, bright == null ? 0.3 : bright));
    thump(150, vol, delay, 0.09);
    noise(0.025, vol * 0.5, delay, { type: 'lowpass', freq: 700 + b * 2500, q: 0.7 });
  }

  // Нота тональности: ступень пентатоники → частота
  function note(deg) { return degreeToFreq(key, deg); }

  // kit = функция playTone (совместимость с v25) + голоса
  const kit = tone;
  kit.tone = tone;
  kit.pure = pure;
  kit.bell = bell;
  kit.thump = thump;
  kit.noise = noise;
  kit.tap = tap;
  kit.note = note;

  // ---------- Проигрыватель ----------
  function playSound(soundId, ...args) {
    if (!enabled) return;
    const sound = Sounds[soundId];
    if (!sound || typeof sound.play !== 'function') return;
    const c = ensureCtx();
    if (!c) return;
    refreshKey();
    if (soundId === 'win') {
      sound.play(c, kit, { winSoundEnabled });
    } else {
      sound.play(c, kit, ...args);
    }
  }

  function init() {
    enabled = Storage.getSetting('sound', true);
    winSoundEnabled = Storage.getSetting('winSound', true);
    volumePct = clampVolume(Storage.getSetting('sfxVolume', VOLUME_DEFAULT));
  }

  // ---------- Публичный API ----------
  function click()      { playSound('click'); }
  function deselect()   { playSound('deselect'); }
  function blocked()    { playSound('blocked'); }
  function match()      { playSound('match'); }
  function combo(mult)  { playSound('combo', mult); }
  function mismatch()   { playSound('mismatch'); }
  function hint()       { playSound('hint'); }
  function undo()       { playSound('undo'); }
  function win()        { playSound('win'); }
  function shuffleSound() { playSound('shuffle'); }
  function deal()       { playSound('deal'); }
  function hover() {
    if (!enabled || !ctx) return;           // до первого жеста контекста нет
    if (ctx.state === 'suspended') { ctx.resume(); return; }
    playSound('hover');
  }

  function setEnabled(v) { enabled = !!v; }
  function setWinEnabled(v) { winSoundEnabled = !!v; }
  function setVolume(pct) {
    volumePct = clampVolume(pct);
    if (ctx && sfxBus) sfxBus.gain.setTargetAtTime(volumeGain(volumePct), ctx.currentTime, 0.05);
  }

  function getCatalog() { return Sounds.CATALOG || []; }

  // Предпросмотр играет даже при выключенном звуке — это тест
  function previewSound(id) {
    const was = enabled, wasWin = winSoundEnabled;
    enabled = true;
    winSoundEnabled = true;
    playSound(id);
    enabled = was;
    winSoundEnabled = wasWin;
  }

  return {
    init,
    click, deselect, blocked, match, combo, mismatch, hint, undo,
    win, shuffleSound, deal, hover,
    play: playSound,
    setEnabled, setWinEnabled, setVolume,
    getCatalog, previewSound,
    // чистые функции и константы
    clampVolume, volumeGain, fitRoot, degreeToFreq,
    VOLUME_MAX, VOLUME_DEFAULT,
  };
})();
