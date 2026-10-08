/* ============================================================
   MUSIC.JS — Фоновая музыка (v10)
   Тихая генеративная музыка через Web Audio API — БЕЗ аудиофайлов
   (альбома нет, поэтому музыка синтезируется на лету и весит ноль).

   • У каждой темы свой «лад» (настроение): гамма, темп, тембр.
   • Мелодия — случайная прогулка по пентатонике (никогда не фальшивит),
     пэд-аккорды и бас меняются каждые два такта.
   • Вкл/выкл и громкость — в настройках, кнопка «Музыка» — в паузе.
   • Стартует только после первого жеста пользователя (политика
     автовоспроизведения), приглушается в паузе и на скрытой вкладке.
   • Чистые функции (midiToFreq, moodForTheme, nextNoteIndex,
     volumeGain, barSeconds, clampVolume) покрыты unit-тестами.
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

  // Лады тем: root — MIDI корня мелодии, scale — ступени от корня
  // (пентатоника — любое блуждание звучит стройно), bpm — темп тактов,
  // density — вероятность ноты на долю, sparkle — шанс октавного призвука.
  const MOODS = {
    // Традиционный — тёплая мажорная пентатоника, средний темп
    traditional: { id: 'traditional', root: 60, scale: [0, 2, 4, 7, 9], bpm: 66, wave: 'triangle', padWave: 'sine',     density: 0.55, sparkle: 0.22 },
    // Нефрит — светлее и чуть подвижнее
    jade:        { id: 'jade',        root: 67, scale: [0, 2, 4, 7, 9], bpm: 74, wave: 'sine',     padWave: 'triangle', density: 0.50, sparkle: 0.30 },
    // Фарфор — воздушные колокольчики, реже ноты
    porcelain:   { id: 'porcelain',   root: 62, scale: [0, 2, 4, 7, 9], bpm: 60, wave: 'sine',     padWave: 'sine',     density: 0.42, sparkle: 0.35 },
    // Ночь — минорная пентатоника, низко и редко
    night:       { id: 'night',       root: 57, scale: [0, 3, 5, 7, 10], bpm: 54, wave: 'sine',    padWave: 'sine',     density: 0.38, sparkle: 0.10 },
    // Император — торжественно, неспешно, с золотым блеском
    imperial:    { id: 'imperial',    root: 65, scale: [0, 2, 4, 7, 9], bpm: 58, wave: 'triangle', padWave: 'sine',     density: 0.50, sparkle: 0.18 },
  };

  function moodForTheme(theme) {
    return Object.prototype.hasOwnProperty.call(MOODS, theme)
      ? MOODS[theme]
      : MOODS.traditional;
  }

  // Шаг мелодической прогулки: from cur на -maxStep..+maxStep (0 → шаг +1),
  // выход за границы ОТРАЖАЕТСЯ (мелодия «отскакивает» от края гаммы).
  // rand (0..1) вводится снаружи — функция детерминирована и тестируема.
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
    if (next > n - 1) next = Math.max(0, 2 * (n - 1) - next); // отражение справа
    if (next < 0) next = Math.min(n - 1, -next);              // отражение слева
    return Math.max(0, Math.min(n - 1, next));
  }

  // Проценты 0..100 → мастер-гейн. Квадратичная кривая: нижняя половина
  // шкалы регулируется плавнее — «тихо» должно быть именно тихим.
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

  // Длительность такта (4 доли) в секундах. Мусор/неположительный bpm → null
  function barSeconds(bpm) {
    const b = Number(bpm);
    if (!Number.isFinite(b) || b <= 0) return null;
    return 240 / b;
  }

  // ==================== РАНТАЙМ ====================

  let ctx = null;
  let bus = null;        // сухой микс голосов
  let duckGain = null;   // приглушение на паузе
  let master = null;     // пользовательская громкость
  let delaySend = null;  // посыл в мягкое «эхо»
  let schedTimer = null; // планировщик
  let enabled = true;
  let volumePct = VOLUME_DEFAULT;
  let mood = MOODS.traditional;
  let playing = false;
  let nextBarTime = 0;   // по шкале времени AudioContext
  let barIndex = 0;
  let noteIdx = 2;       // позиция прогулки по гамме

  const LOOKAHEAD_S = 1.2; // планируем на секунду с небольшим вперёд
  const TICK_MS = 300;

  // Пэд-сонорности из ступеней пентатоники — меняются каждые 2 такта
  const PAD_CHORDS = [
    [0, 4, 9],
    [2, 7, 12],
    [0, 4, 7],
    [4, 9, 14],
  ];

  function documentHidden() {
    return typeof document !== 'undefined' && document.hidden;
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

    // «Зал»: короткое затухающее эхо — воздух и глубина
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.31;
    const dampen = ctx.createBiquadFilter();
    dampen.type = 'lowpass';
    dampen.frequency.value = 2200;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    delaySend = ctx.createGain();
    delaySend.gain.value = 1;
    delaySend.connect(delay);
    delay.connect(dampen);
    dampen.connect(fb);
    fb.connect(delay);
    dampen.connect(wet);
    wet.connect(duckGain);

    bus.connect(duckGain);
    duckGain.connect(master);
    master.connect(ctx.destination);
  }

  // Щипковый звук (гучжэн-подобный): основной тон + тихий призвук октавой выше
  function pluck(freq, t, dur, vel) {
    if (!ctx || !freq) return;
    const o1 = ctx.createOscillator();
    o1.type = mood.wave;
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const shimmer = ctx.createGain();
    shimmer.gain.value = 0.25;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o1.connect(g);
    o2.connect(shimmer);
    shimmer.connect(g);
    g.connect(bus);
    g.connect(delaySend);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.1);
    o2.stop(t + dur + 0.1);
  }

  // Тёплый пэд: два расстроенных осциллятора на ноту через низкий фильтр
  function padChord(semis, t, dur) {
    if (!ctx) return;
    const base = mood.root - 12;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1000;
    filt.Q.value = 0.4;
    filt.connect(bus);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    env.gain.linearRampToValueAtTime(0.03, t + dur * 0.8);
    env.gain.linearRampToValueAtTime(0, t + dur + 1.2);
    env.connect(filt);
    semis.forEach(s => {
      const f = midiToFreq(base + s);
      if (!f) return;
      [-4, 3].forEach(cents => {
        const o = ctx.createOscillator();
        o.type = mood.padWave;
        o.frequency.value = f;
        o.detune.value = cents;
        o.connect(env);
        o.start(t);
        o.stop(t + dur + 1.4);
      });
    });
  }

  // Низкая опора в начале такта
  function bass(freq, t, dur) {
    if (!ctx || !freq) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  // Один такт: бас, иногда пэд, мелодия по четвертям с «дыханием»
  function scheduleBar(t0) {
    const barDur = barSeconds(mood.bpm);
    if (!barDur || !ctx) return;
    const beat = barDur / 4;

    if (barIndex % 2 === 0) {
      padChord(PAD_CHORDS[(barIndex / 2) % PAD_CHORDS.length], t0, barDur * 2);
    }
    const bassF = midiToFreq(mood.root - 24);
    if (bassF) bass(bassF, t0, barDur * 1.8);

    for (let b = 0; b < 4; b++) {
      if (Math.random() > mood.density) continue;
      const t = t0 + b * beat + Math.random() * 0.05;
      let semis = mood.scale[noteIdx];
      if (mood.sparkle && Math.random() < mood.sparkle) semis += 12;
      const f = midiToFreq(mood.root + semis);
      if (f) pluck(f, t, beat * (1.4 + Math.random() * 1.6), 0.14 + Math.random() * 0.07);
      noteIdx = nextNoteIndex(noteIdx, mood.scale.length, 2, Math.random());
    }
  }

  function tick() {
    if (!playing || !ctx || !mood) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    let guard = 0;
    while (nextBarTime < horizon && guard < 16) {
      scheduleBar(nextBarTime);
      nextBarTime += barSeconds(mood.bpm) || 4;
      barIndex++;
      guard++;
    }
  }

  function start() {
    if (!enabled || playing) return;
    const c = ensureCtx();
    if (!c) return;
    playing = true;
    barIndex = 0;
    nextBarTime = c.currentTime + 0.2;
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime);
    master.gain.linearRampToValueAtTime(volumeGain(volumePct), c.currentTime + 2);
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

  // Смена лада под тему: незапланированные ноты (≤1.2 с старого лада)
  // доигрывают как естественный переход
  function setTheme(theme) {
    mood = moodForTheme(theme);
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
    setTheme(opts.theme);
    if (typeof document === 'undefined') return;
    // Автозапуск — строго после первого жеста пользователя
    // (политика автовоспроизведения браузеров)
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
    midiToFreq,
    moodForTheme,
    nextNoteIndex,
    volumeGain,
    barSeconds,
    clampVolume,
    VOLUME_MAX,
    VOLUME_DEFAULT,
    // рантайм
    init,
    start,
    stop,
    setEnabled,
    setVolume,
    setTheme,
    duck,
    isPlaying: () => playing,
    isEnabled: () => enabled,
  };
})();
