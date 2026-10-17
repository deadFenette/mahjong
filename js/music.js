/* ============================================================
   MUSIC.JS — Фоновая музыка: «Сборник» (v26-audio)
   Музыка по-прежнему синтезируется на лету через Web Audio API —
   БЕЗ аудиофайлов (вес — ноль, работает офлайн).

   Что изменилось по сравнению с v10–v25 (случайное блуждание):
   • СБОРНИК ИЗ 7 ПЬЕС. Каждая — это композиция: тональность,
     темп, 8-тактовая гармония, три мелодических мотива и форма
     A–B–A–C. Мелодия не блуждает, а ПОЁТ фразами.
   • Аккомпанемент: бас, пэд с плавной сменой аккордов, арпеджио.
   • Живое исполнение: лёгкая «человеческая» неровность тайминга и
     силы, на повторах — украшения (форшлаги, октавные блики).
   • ПЛЕЙЛИСТ: пьеса играет 4 круга (~1.5–2 мин), затем плавно
     растворяется и начинается следующая. У каждой темы — своя
     «фирменная» пьеса, с неё и начинается игра.
   • Режимы: «Авто» (плейлист) или одна выбранная пьеса по кругу.
   • Реверб-«зал» (свёртка) вместо простого эха; мягкие тембры
     без пилы и квадрата.
   • Тональность играющей пьесы отдаётся эффектам — Music.getKey().

   Вкл/выкл и громкость — в настройках, кнопка «Музыка» — в паузе.
   Стартует только после первого жеста пользователя, приглушается
   в паузе и на скрытой вкладке.
   Чистые функции (midiToFreq, moodForTheme, trackForTheme,
   pickNextTrackIndex, scaleMidi, chordNotes, volumeGain, barSeconds,
   clampVolume) покрыты unit-тестами.
   ============================================================ */

const Music = (function () {

  // ============ ЧИСТАЯ МАТЕМАТИКА (покрыта тестами) ============

  // Мастер-гейн при 100% громкости. 0.5 — музыка тихая по определению
  const VOLUME_MAX = 0.5;
  const VOLUME_DEFAULT = 35; // % по умолчанию — «тихо и ненавязчиво»

  // MIDI-номер → частота в Гц. Мусор → null (а не NaN)
  function midiToFreq(m) {
    const n = Number(m);
    if (!Number.isFinite(n)) return null;
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // Лады тем: root — MIDI корня, scale — ступени пентатоники, bpm,
  // timbre — тембр, density/sparkle — легаси-параметры (генеративный
  // режим v10–v25; сейчас информационные).
  // Корень и гамма совпадают с «фирменной» пьесой темы (см. TRACKS).
  const MOODS = {
    traditional: { id: 'traditional', root: 60, scale: [0, 2, 4, 7, 9], bpm: 66, wave: 'triangle', padWave: 'sine',     density: 0.55, sparkle: 0.22, timbre: 'guzheng' },
    jade:        { id: 'jade',        root: 67, scale: [0, 2, 4, 7, 9], bpm: 74, wave: 'sine',     padWave: 'triangle', density: 0.50, sparkle: 0.30, timbre: 'koto' },
    porcelain:   { id: 'porcelain',   root: 62, scale: [0, 2, 4, 7, 9], bpm: 60, wave: 'sine',     padWave: 'sine',     density: 0.42, sparkle: 0.35, timbre: 'glass' },
    night:       { id: 'night',       root: 57, scale: [0, 3, 5, 7, 10], bpm: 54, wave: 'sine',    padWave: 'sine',     density: 0.38, sparkle: 0.10, timbre: 'koto' },
    imperial:    { id: 'imperial',    root: 65, scale: [0, 2, 4, 7, 9], bpm: 58, wave: 'triangle', padWave: 'sine',     density: 0.50, sparkle: 0.18, timbre: 'metal' },
  };

  // Гармоники «стеклянного» тембра: 3-я и 5-я дают колокольчиковость
  const GLASS_HARMONICS = [
    { mult: 1.0,  gain: 1.00 },
    { mult: 3.0,  gain: 0.18 },
    { mult: 5.0,  gain: 0.06 },
  ];

  // Ambient: тихий розовый шум («воздух в комнате»), ≈ -40 dB
  const AMBIENT_GAIN = 0.012;
  let ambientNode = null;
  let ambientGain = null;

  function moodForTheme(theme) {
    return Object.prototype.hasOwnProperty.call(MOODS, theme)
      ? MOODS[theme]
      : MOODS.traditional;
  }

  function timbreForTheme(theme) {
    return moodForTheme(theme).timbre || 'guzheng';
  }

  // Легаси-утилита генеративной прогулки по гамме (v10). Движок v26
  // её не использует — оставлена как тестируемая функция для
  // расширений (например, импровизационных вставок).
  function nextNoteIndex(cur, len, maxStep, r01) {
    let n = Math.floor(Number(len));
    if (!Number.isFinite(n) || n < 1) return 0;
    const cNum = Number(cur);
    let c = Number.isFinite(cNum) ? Math.floor(cNum) : 0;
    c = Math.max(0, Math.min(n - 1, c));
    let s = Math.floor(Number(maxStep));
    if (!Number.isFinite(s) || s < 1) s = 1;
    const r = Number(r01);
    let step;
    if (!Number.isFinite(r)) {
      step = 1;
    } else {
      step = Math.floor(r * (2 * s + 1)) - s;
      if (step === 0) step = 1;
    }
    let next = c + step;
    if (next > n - 1) next = Math.max(0, 2 * (n - 1) - next);
    if (next < 0) next = Math.min(n - 1, -next);
    return Math.max(0, Math.min(n - 1, next));
  }

  // Проценты 0..100 → мастер-гейн. Квадратичная кривая.
  function volumeGain(pct) {
    const p = clampVolume(pct);
    return VOLUME_MAX * (p / 100) * (p / 100);
  }

  // Проценты 0..100 с защитой от мусора (мусор → VOLUME_DEFAULT)
  function clampVolume(pct) {
    const p = Number(pct);
    if (!Number.isFinite(p)) return VOLUME_DEFAULT;
    return Math.max(0, Math.min(100, Math.round(p)));
  }

  // Длительность такта (4 доли) в секундах. Мусор → null
  function barSeconds(bpm) {
    const b = Number(bpm);
    if (!Number.isFinite(b) || b <= 0) return null;
    return 240 / b;
  }

  // ============ СБОРНИК: ДАННЫЕ ПЬЕС ============

  const SCALES = {
    major: [0, 2, 4, 7, 9],   // мажорная пентатоника
    minor: [0, 3, 5, 7, 10],  // минорная пентатоника
  };

  // Аккорды — полутоны от корня тональности; первый элемент —
  // основной тон аккорда (для баса). Мелодии написаны на пентатонике,
  // а она ложится на любую перестановку этих аккордов.
  const CHORDS = {
    I:   [0, 4, 7],    IV:  [5, 9, 12],   V:   [7, 11, 14],  vi: [9, 12, 16],
    i:   [0, 3, 7],    VI:  [8, 12, 15],  III: [3, 7, 10],   VII: [10, 14, 17],
  };

  // Шаблоны арпеджио: по восьмым долям такта; число — индекс ноты в
  // [основа, терция, квинта, основа+октава], null — пауза.
  const ARP_PATTERNS = {
    rolling: [0, 1, 2, 3, 2, 1, 2, 1],
    sparse:  [0, null, 2, null, 1, null, 3, null],
  };

  // Мотив: [доля 0..8, ступень гаммы (0 = корень, 5 = октава), длительность в долях].
  // Мотив — две такта (8 долей). Форма пьесы — порядок мотивов по фразам.
  function T(def) {
    def.scale = SCALES[def.mode];
    def.loops = def.loops || 4;
    return def;
  }

  const TRACKS = [
    T({ id: 'tea', name: 'Чайная церемония', theme: 'traditional',
        root: 60, mode: 'major', bpm: 66, timbre: 'guzheng', pad: 'sine', arp: 'sparse',
        prog: ['I', 'vi', 'IV', 'V', 'I', 'vi', 'IV', 'V'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 5, 1.5], [1.5, 4, 0.5], [2, 3, 2], [4, 4, 1], [5, 2, 1], [6, 3, 2]],
          [[0, 7, 1.5], [1.5, 6, 0.5], [2, 5, 2], [4, 3, 1], [5, 4, 1], [6, 5, 2]],
          [[0, 4, 2], [2, 3, 1], [3, 2, 1], [4, 1, 2], [6, 0, 2]],
        ] }),
    T({ id: 'jade', name: 'Нефритовый ручей', theme: 'jade',
        root: 67, mode: 'major', bpm: 76, timbre: 'koto', pad: 'triangle', arp: 'rolling',
        prog: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV', 'V'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 4, 1], [1, 3, 0.5], [1.5, 2, 0.5], [2, 3, 1], [3, 1, 1], [4, 2, 1], [5, 3, 0.5], [5.5, 2, 0.5], [6, 0, 2]],
          [[0, 5, 1], [1, 4, 0.5], [1.5, 3, 0.5], [2, 4, 1], [3, 2, 1], [4, 3, 1.5], [5.5, 4, 0.5], [6, 5, 2]],
          [[0, 3, 1], [1, 2, 1], [2, 1, 1], [3, 2, 1], [4, 3, 2], [6, 2, 2]],
        ] }),
    T({ id: 'porcelain', name: 'Фарфоровые колокольчики', theme: 'porcelain',
        root: 62, mode: 'major', bpm: 60, timbre: 'glass', pad: 'sine', arp: 'sparse',
        prog: ['I', 'IV', 'vi', 'V', 'I', 'IV', 'V', 'I'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 7, 2], [2, 6, 1], [3, 5, 1], [4, 6, 2], [6, 8, 2]],
          [[0, 8, 1], [1, 7, 1], [2, 6, 2], [4, 5, 1], [5, 6, 1], [6, 7, 2]],
          [[0, 6, 1.5], [1.5, 5, 0.5], [2, 4, 2], [4, 5, 1], [6, 4, 2]],
        ] }),
    T({ id: 'night', name: 'Лунная ночь', theme: 'night',
        root: 57, mode: 'minor', bpm: 54, timbre: 'koto', pad: 'sine', arp: 'sparse',
        prog: ['i', 'VI', 'III', 'VII', 'i', 'VI', 'III', 'VII'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 5, 3], [3, 4, 1], [4, 3, 2], [6, 4, 2]],
          [[0, 6, 2], [2, 5, 1], [3, 4, 1], [4, 5, 2], [6, 3, 2]],
          [[0, 7, 2], [2, 6, 1], [3, 5, 1], [4, 4, 2], [6, 3, 2]],
        ] }),
    T({ id: 'imperial', name: 'Императорский сад', theme: 'imperial',
        root: 65, mode: 'major', bpm: 58, timbre: 'metal', pad: 'sine', arp: 'sparse',
        prog: ['I', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 5, 2], [2, 6, 1], [3, 7, 1], [4, 8, 2], [6, 7, 1], [7, 6, 1]],
          [[0, 7, 2], [2, 6, 2], [4, 5, 2], [6, 3, 2]],
          [[0, 5, 1], [1, 6, 1], [2, 7, 2], [4, 6, 1], [5, 5, 1], [6, 4, 2]],
        ] }),
    T({ id: 'mist', name: 'Утренний туман', theme: null,
        root: 64, mode: 'major', bpm: 68, timbre: 'koto', pad: 'triangle', arp: 'rolling',
        prog: ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 4, 1.5], [1.5, 5, 0.5], [2, 6, 2], [4, 5, 1], [5, 4, 1], [6, 3, 2]],
          [[0, 5, 1], [1, 6, 1], [2, 7, 2], [4, 6, 1], [5, 5, 1], [6, 4, 2]],
          [[0, 3, 2], [2, 4, 1], [3, 5, 1], [4, 4, 2], [6, 5, 2]],
        ] }),
    T({ id: 'cranes', name: 'Журавли', theme: null,
        root: 58, mode: 'major', bpm: 62, timbre: 'guzheng', pad: 'sine', arp: 'sparse',
        prog: ['I', 'V', 'vi', 'IV', 'vi', 'IV', 'V', 'I'], form: [0, 1, 0, 2],
        motifs: [
          [[0, 6, 1], [1, 5, 1], [2, 4, 2], [4, 5, 1], [5, 6, 1], [6, 7, 2]],
          [[0, 8, 2], [2, 7, 1], [3, 6, 1], [4, 5, 2], [6, 4, 2]],
          [[0, 5, 1.5], [1.5, 6, 0.5], [2, 7, 1], [3, 6, 1], [4, 5, 2], [6, 3, 2]],
        ] }),
  ];

  const TRACK_BARS = 8; // длина прохода по гармонии

  function trackIndexById(id) {
    for (let i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return i;
    return -1;
  }

  // Фирменная пьеса темы; мусор → первая пьеса
  function trackForTheme(theme) {
    for (let i = 0; i < TRACKS.length; i++) if (TRACKS[i].theme === theme) return TRACKS[i].id;
    return TRACKS[0].id;
  }

  // Следующая пьеса плейлиста: случайная, но НИКОГДА не та же самая.
  // r01 вводится снаружи — функция детерминирована и тестируема.
  function pickNextTrackIndex(cur, len, r01) {
    const n = Math.floor(Number(len));
    if (!Number.isFinite(n) || n < 2) return 0;
    let c = Math.floor(Number(cur));
    if (!Number.isFinite(c)) c = 0;
    c = Math.max(0, Math.min(n - 1, c));
    let r = Number(r01);
    if (!Number.isFinite(r)) r = 0;
    r = Math.max(0, Math.min(0.999999, r));
    return (c + 1 + Math.floor(r * (n - 1))) % n;
  }

  // Ступень гаммы пьесы (может быть отрицательной / выше октавы) → MIDI
  function scaleMidi(track, idx) {
    const n = track.scale.length;
    const d = Math.round(Number(idx) || 0);
    const oct = Math.floor(d / n);
    const i = ((d % n) + n) % n;
    return track.root + track.scale[i] + 12 * oct;
  }

  // Имя аккорда → полутоны от корня; неизвестное имя → null
  function chordNotes(name) {
    return Object.prototype.hasOwnProperty.call(CHORDS, name) ? CHORDS[name] : null;
  }

  // ==================== РАНТАЙМ ====================

  let ctx = null;
  let bus = null;        // сухой микс голосов (+ вход в реверб)
  let duckGain = null;   // приглушение на паузе
  let master = null;     // пользовательская громкость
  let enabled = true;
  let volumePct = VOLUME_DEFAULT;
  let mood = MOODS.traditional;
  let playing = false;
  let schedTimer = null;
  let nextBarTime = 0;   // по шкале времени AudioContext

  // Состояние плейлиста
  let userTrack = 'auto';      // 'auto' — плейлист, иначе id пьесы по кругу
  let track = TRACKS[0];       // играющая (или подготовленная) пьеса
  let barPos = 0;              // тактов сыграно в этой пьесе
  let queued = -1;             // индекс пьесы, ожидающей смены
  const trackListeners = [];

  const LOOKAHEAD_S = 1.2;
  const TICK_MS = 300;

  function documentHidden() {
    return typeof document !== 'undefined' && document.hidden;
  }

  function makeImpulse(c, seconds, decay) {
    const rate = c.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += ((Math.random() * 2 - 1) - lp) * 0.3;
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function ensureCtx() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      } catch (e) {
        ctx = null;
        return null;
      }
      buildGraph();
    }
    if (ctx.state === 'suspended' && !documentHidden()) {
      ctx.resume();
    }
    return ctx;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;
    duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    bus = ctx.createGain();
    bus.gain.value = 1;

    // «Зал»: свёрточный реверб 2.8 с — глубина без металлического эха
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 2.8, 2.6);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    bus.connect(send);
    send.connect(conv);
    conv.connect(wet);
    wet.connect(duckGain);

    bus.connect(duckGain);
    duckGain.connect(master);
    master.connect(ctx.destination);

    // Ambient pad — розовый шум через lowpass с медленным «дыханием»
    try {
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
      }
      ambientNode = ctx.createBufferSource();
      ambientNode.buffer = noiseBuffer;
      ambientNode.loop = true;
      const ambientFilt = ctx.createBiquadFilter();
      ambientFilt.type = 'lowpass';
      ambientFilt.frequency.value = 800;
      ambientFilt.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(ambientFilt.frequency);
      ambientGain = ctx.createGain();
      ambientGain.gain.value = AMBIENT_GAIN;
      ambientNode.connect(ambientFilt);
      ambientFilt.connect(ambientGain);
      ambientGain.connect(duckGain);
      ambientNode.start();
      lfo.start();
    } catch (e) {
      ambientNode = null;
      ambientGain = null;
    }
  }

  // ---------- Голоса ----------
  // Партиалы щипковых тембров: { type, mult, gain, decay (доля dur) }.
  // Без пилы и квадрата — только мягкие формы волны.
  const PARTIALS = {
    guzheng: [
      { type: 'triangle', mult: 1, gain: 1.00, decay: 1.0 },
      { type: 'sine',     mult: 2, gain: 0.22, decay: 0.6 },
    ],
    koto: [
      { type: 'sine',     mult: 1, gain: 1.00, decay: 1.0 },
      { type: 'triangle', mult: 2, gain: 0.12, decay: 0.5 },
      { type: 'sine',     mult: 3, gain: 0.05, decay: 0.35 },
    ],
    glass: GLASS_HARMONICS.map((h, i) => (
      { type: 'sine', mult: h.mult, gain: h.gain, decay: [1.0, 0.7, 0.5][i] }
    )),
    // «Бронза»: два чуть расстроенных основных тона (биение, как у гонга)
    // + неклассические обертоны колокола
    metal: [
      { type: 'sine', mult: 1,     gain: 0.80, decay: 1.0 },
      { type: 'sine', mult: 1.004, gain: 0.60, decay: 1.0 },
      { type: 'sine', mult: 2.76,  gain: 0.18, decay: 0.5 },
      { type: 'sine', mult: 5.4,   gain: 0.06, decay: 0.3 },
    ],
  };

  // Щипок: o = { soft, pan }. soft — тише и мягче (для арпеджио).
  function pluck(freq, t, dur, vel, o) {
    if (!ctx || !freq) return;
    o = o || {};
    const partials = PARTIALS[track.timbre] || PARTIALS.guzheng;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * (o.soft ? 0.7 : 1), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    // Lowpass срезает верха — звук тёплый, без «пищалки»
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(freq * (o.soft ? 3.5 : 6.5), 7000);
    lp.Q.value = 0.5;
    g.connect(lp);
    let out = lp;
    if (o.pan && ctx.createStereoPanner) {
      const sp = ctx.createStereoPanner();
      sp.pan.value = o.pan;
      lp.connect(sp);
      out = sp;
    }
    out.connect(bus);

    partials.forEach(p => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.mult;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(p.gain, t);
      if (p.decay < 1) pg.gain.exponentialRampToValueAtTime(0.0008, t + dur * p.decay);
      osc.connect(pg);
      pg.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  }

  // Тёплый пэд: два расстроенных осциллятора на ноту через низкий фильтр
  function padChord(semis, t, dur) {
    if (!ctx) return;
    const base = track.root - 12;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    filt.Q.value = 0.3;
    filt.connect(bus);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.03, t + dur * 0.4);
    env.gain.linearRampToValueAtTime(0.02, t + dur * 0.85);
    env.gain.linearRampToValueAtTime(0, t + dur + 1.2);
    env.connect(filt);
    semis.forEach(s => {
      let m = base + s;
      while (m < 52) m += 12; // держим пэд в тёплой средней зоне
      while (m > 70) m -= 12;
      const f = midiToFreq(m);
      if (!f) return;
      [-4, 3].forEach(cents => {
        const o = ctx.createOscillator();
        o.type = track.pad;
        o.frequency.value = f;
        o.detune.value = cents;
        o.connect(env);
        o.start(t);
        o.stop(t + dur + 1.4);
      });
    });
  }

  // Бас: основной тон аккорда + тихий октавный призвук (слышен и на
  // ноутбучных динамиках)
  function bass(midi, t, dur, vel) {
    if (!ctx) return;
    let m = midi;
    while (m > 52) m -= 12;
    while (m < 38) m += 12;
    const f = midiToFreq(m);
    if (!f) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    g.connect(bus);
    [[1, 1], [2, 0.25]].forEach(([mult, gain]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  }

  // ---------- Исполнение ----------
  function human(sec) { return (Math.random() - 0.5) * 2 * sec; }

  // Один такт пьесы: бас, пэд, арпеджио, мелодия
  function scheduleBar(t0) {
    const tr = track;
    const barDur = barSeconds(tr.bpm);
    if (!barDur || !ctx) return;
    const beat = barDur / 4;
    const bar = barPos % TRACK_BARS;
    const loop = Math.floor(barPos / TRACK_BARS);
    const chord = chordNotes(tr.prog[bar]);
    if (!chord) return;

    // Появление пьесы и растворение в конце
    if (barPos === 0) {
      bus.gain.setValueAtTime(0.0001, t0);
      bus.gain.linearRampToValueAtTime(1, t0 + barDur * 0.9);
    }
    if (userTrack === 'auto' && barPos === tr.loops * TRACK_BARS - 1) {
      bus.gain.setValueAtTime(1, t0);
      bus.gain.linearRampToValueAtTime(0.0001, t0 + barDur);
    }

    // Пэд (плавно перетекает) и бас
    padChord(chord, t0, barDur * 1.15);
    bass(tr.root + chord[0], t0, barDur * 1.6, 0.085);
    if (Math.random() < 0.4) bass(tr.root + chord[2], t0 + beat * 2, beat * 1.6, 0.05);

    // Арпеджио (со второго такта пьесы, пока мелодия ещё не «зажглась»)
    const pattern = ARP_PATTERNS[tr.arp];
    if (pattern && barPos >= 2) {
      const tones = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
      pattern.forEach((pi, s) => {
        if (pi === null) return;
        const f = midiToFreq(tr.root + tones[pi]);
        pluck(f, t0 + s * beat / 2 + human(0.012), beat * 1.5,
          0.05 + Math.random() * 0.02, { soft: true, pan: -0.25 });
      });
    }

    // Мелодия: нужный такт фразы по форме A-B-A-C
    const phrase = Math.floor(bar / 2);
    const motif = tr.motifs[tr.form[phrase]];
    const from = (bar % 2) * 4;
    const ornament = loop >= 1;
    motif.forEach(n => {
      const nb = n[0];
      if (nb < from || nb >= from + 4) return;
      if (ornament && Math.random() < 0.12) return; // иногда «дышим»
      const t = t0 + (nb - from) * beat + human(0.018);
      const accent = nb === 0 ? 1.1 : 1;
      const vel = (0.15 + Math.random() * 0.05) * accent;
      const dur = n[2] * beat * 1.6 + 0.5;
      if (ornament && Math.random() < 0.25) {
        // форшлаг — соседняя ступень чуть раньше основной ноты
        pluck(midiToFreq(scaleMidi(tr, n[1] - 1)), t - 0.09, 0.3, vel * 0.5, { pan: 0.2 });
      }
      pluck(midiToFreq(scaleMidi(tr, n[1])), t, dur, vel, { pan: 0.2 });
      if (ornament && n[2] >= 2 && Math.random() < 0.35) {
        // октавный блик на длинных нотах
        pluck(midiToFreq(scaleMidi(tr, n[1] + tr.scale.length)), t + 0.02, dur, vel * 0.4, { soft: true, pan: 0.35 });
      }
    });
  }

  function notifyTrack(t0) {
    const t = track;
    const delay = ctx ? Math.max(0, (t0 - ctx.currentTime) * 1000) : 0;
    setTimeout(() => trackListeners.forEach(fn => { try { fn(t); } catch (e) {} }), delay);
  }

  // Переключение пьесы на границе такта t0. dip — «нырок» громкости
  // (для смены посреди пьесы), чтобы звучащие ноты не обрывались щелчком.
  function switchTrack(idx, t0, dip) {
    if (dip && ctx && bus) {
      const tf = Math.max(ctx.currentTime, t0 - 0.6);
      bus.gain.cancelScheduledValues(tf);
      bus.gain.setTargetAtTime(0.0001, tf, 0.12);
    }
    track = TRACKS[idx];
    barPos = 0;
    notifyTrack(t0);
  }

  function tick() {
    if (!playing || !ctx || !track) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    let guard = 0;
    while (nextBarTime < horizon && guard < 16) {
      if (queued >= 0) {
        switchTrack(queued, nextBarTime, true);
        queued = -1;
      } else if (userTrack === 'auto' && barPos >= track.loops * TRACK_BARS) {
        // Пьеса закончилась — следующая из плейлиста после короткой паузы
        const next = pickNextTrackIndex(trackIndexById(track.id), TRACKS.length, Math.random());
        nextBarTime += 0.8;
        switchTrack(next, nextBarTime, false);
      }
      scheduleBar(nextBarTime);
      nextBarTime += barSeconds(track.bpm) || 4;
      barPos++;
      guard++;
    }
  }

  function start() {
    if (!enabled || playing) return;
    const c = ensureCtx();
    if (!c) return;
    playing = true;
    barPos = 0;
    queued = -1;
    nextBarTime = c.currentTime + 0.2;
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime);
    master.gain.linearRampToValueAtTime(volumeGain(volumePct), c.currentTime + 2);
    notifyTrack(nextBarTime);
    schedTimer = setInterval(tick, TICK_MS);
    tick();
  }

  function stop(fadeSeconds) {
    playing = false;
    if (schedTimer) {
      clearInterval(schedTimer);
      schedTimer = null;
    }
    if (ctx && master) {
      const fade = fadeSeconds || 0.9;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    }
  }

  function setEnabled(v) {
    enabled = !!v;
    if (enabled) start();
    else stop(1.2);
  }

  function setVolume(pct) {
    volumePct = clampVolume(pct);
    if (ctx && master && playing) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(volumeGain(volumePct), ctx.currentTime, 0.2);
    }
  }

  // Запрос смены пьесы: если музыка ещё не играет — просто готовим,
  // иначе — смена на ближайшей границе такта с мягким «нырком»
  function requestTrack(idx) {
    if (idx < 0) return;
    if (!playing) {
      track = TRACKS[idx];
      barPos = 0;
      return;
    }
    if (TRACKS[idx] === track && queued < 0) return;
    queued = idx;
  }

  // Смена темы: в режиме «Авто» играет фирменная пьеса новой темы
  function setTheme(theme) {
    mood = moodForTheme(theme);
    if (userTrack === 'auto') requestTrack(trackIndexById(trackForTheme(mood.id)));
  }

  // 'auto' — плейлист, либо id пьесы (играет по кругу)
  function setTrack(id) {
    if (id === 'auto' || trackIndexById(id) < 0) {
      userTrack = 'auto';
      requestTrack(trackIndexById(trackForTheme(mood.id)));
    } else {
      userTrack = id;
      requestTrack(trackIndexById(id));
    }
  }

  // Следующая пьеса по порядку сборника. В режиме одной пьесы новая
  // становится выбранной.
  function nextTrack() {
    // Считаем от пьесы в очереди — быстрые повторные нажатия «Следующая»
    // должны идти вперёд, а не перезаписывать друг друга
    const cur = queued >= 0 ? queued : trackIndexById(track.id);
    const idx = (cur + 1) % TRACKS.length;
    if (userTrack !== 'auto') userTrack = TRACKS[idx].id;
    requestTrack(idx);
    return TRACKS[idx];
  }

  function onTrackChange(fn) {
    if (typeof fn === 'function') trackListeners.push(fn);
  }

  // Тональность играющей пьесы — для звуковых эффектов (audio.js)
  function getKey() {
    return { root: track.root, scale: track.scale };
  }

  // Приглушение на паузе — музыка остаётся, но уходит на второй план
  function duck(on) {
    if (ctx && duckGain) {
      duckGain.gain.setTargetAtTime(on ? 0.45 : 1, ctx.currentTime, 0.25);
    }
  }

  function init(opts) {
    opts = opts || {};
    enabled = opts.enabled !== false;
    volumePct = clampVolume(opts.volumePct);
    userTrack = (opts.track && trackIndexById(opts.track) >= 0) ? opts.track : 'auto';
    if (userTrack === 'auto') setTheme(opts.theme);
    else { mood = moodForTheme(opts.theme); requestTrack(trackIndexById(userTrack)); }
    if (typeof document === 'undefined') return;
    // Автозапуск — строго после первого жеста пользователя
    const gesture = () => {
      if (enabled) start();
    };
    document.addEventListener('pointerdown', gesture, { once: true });
    document.addEventListener('keydown', gesture, { once: true });
    // Скрытая вкладка — тишина; вернулись — музыка продолжается
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) {
        ctx.suspend();
      } else if (playing) {
        ctx.resume();
      }
    });
  }

  return {
    // чистые функции и константы — под тестами
    MOODS,
    TRACKS,
    CHORDS,
    SCALES,
    TRACK_BARS,
    midiToFreq,
    moodForTheme,
    timbreForTheme,
    trackForTheme,
    pickNextTrackIndex,
    scaleMidi,
    chordNotes,
    nextNoteIndex,
    volumeGain,
    barSeconds,
    clampVolume,
    VOLUME_MAX,
    VOLUME_DEFAULT,
    AMBIENT_GAIN,
    GLASS_HARMONICS,
    // рантайм
    init,
    start,
    stop,
    setEnabled,
    setVolume,
    setTheme,
    setTrack,
    nextTrack,
    onTrackChange,
    getKey,
    getTracks: () => TRACKS,
    getTrack: () => track,
    getTrackMode: () => userTrack,
    duck,
    isPlaying: () => playing,
    isEnabled: () => enabled,
  };
})();
