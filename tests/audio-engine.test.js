/* ============================================================
   TESTS/AUDIO-ENGINE.TEST.JS — v26-audio
   1. Сборник: целостность данных пьес (гармония, мотивы, темы).
   2. Чистые функции плейлиста: trackForTheme, pickNextTrackIndex,
      scaleMidi, chordNotes.
   3. РАНТАЙМ с мок-AudioContext: каждый звук и планировщик музыки
      прогоняются целиком. Мок бросает исключение там, где его бросил
      бы браузер (exponentialRamp к нулю, отрицательное время и т.п.),
      поэтому ошибки огибающих ловятся без колонок.
   4. Разметка/интеграция: новые контролы, вызовы в app.js.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assertOk, assertEq, assertAlmostEq } = require('./runner');
const { loadGameModules, makeLocalStorageShim } = require('./load');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ============================================================
//  Мок Web Audio
// ============================================================

function makeMockAC() {
  const stats = { oscillators: 0, sources: 0, contexts: 0, freqs: [], maxPeak: 0 };

  class Param {
    constructor(v) { this._v = v === undefined ? 0 : v; }
    get value() { return this._v; }
    set value(x) {
      if (!Number.isFinite(x)) throw new RangeError('AudioParam.value не число: ' + x);
      this._v = x;
    }
    setValueAtTime(v, t) { this._chk(v, t); this._v = v; return this; }
    linearRampToValueAtTime(v, t) { this._chk(v, t); stats.maxPeak = Math.max(stats.maxPeak, Math.abs(v)); return this; }
    exponentialRampToValueAtTime(v, t) {
      this._chk(v, t);
      if (!(v > 0)) throw new RangeError('exponentialRamp к значению ≤ 0: ' + v);
      return this;
    }
    setTargetAtTime(v, t, tc) { this._chk(v, t); if (!(tc > 0)) throw new RangeError('timeConstant ≤ 0'); return this; }
    cancelScheduledValues(t) { this._chk(0, t); return this; }
    _chk(v, t) {
      if (!Number.isFinite(v)) throw new RangeError('значение автоматизации не число: ' + v);
      if (!Number.isFinite(t) || t < 0) throw new RangeError('время автоматизации некорректно: ' + t);
    }
  }

  class Node {
    constructor(kind) {
      this.kind = kind;
      this.gain = new Param(1);
      this.frequency = new Param(440);
      this.Q = new Param(1);
      this.detune = new Param(0);
      this.pan = new Param(0);
      this.threshold = new Param(-24);
      this.knee = new Param(30);
      this.ratio = new Param(12);
      this.attack = new Param(0.003);
      this.release = new Param(0.25);
      this.delayTime = new Param(0);
      this.type = 'sine';
      this.buffer = null;
      this.loop = false;
    }
    connect(n) { return n; }
    disconnect() {}
    start(t) {
      if (t !== undefined && !(t >= 0)) throw new RangeError('start(t<0)');
      if (this.kind === 'osc') { stats.oscillators++; stats.freqs.push(this.frequency.value); }
      if (this.kind === 'src') stats.sources++;
    }
    stop(t) { if (t !== undefined && !(t >= 0)) throw new RangeError('stop(t<0)'); }
  }

  class MockAudioContext {
    constructor() {
      stats.contexts++;
      this.currentTime = 0;
      this.sampleRate = 8000; // маленькая частота — быстрые тесты
      this.state = 'running';
      this.destination = new Node('dest');
    }
    resume() { this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
    createGain() { return new Node('gain'); }
    createOscillator() { return new Node('osc'); }
    createBufferSource() { return new Node('src'); }
    createBiquadFilter() { return new Node('filter'); }
    createDynamicsCompressor() { return new Node('comp'); }
    createConvolver() { return new Node('conv'); }
    createDelay() { return new Node('delay'); }
    createStereoPanner() { return new Node('pan'); }
    createBuffer(ch, len, rate) {
      const data = [];
      for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
      return { getChannelData: i => data[i], length: len, sampleRate: rate };
    }
  }
  return { MockAudioContext, stats };
}

// Загружает Storage + Music + Sounds + Audio2 в одну песочницу с моком
function loadAudioSandbox() {
  const { MockAudioContext, stats } = makeMockAC();
  const timers = [];
  const sandbox = {
    console, Math, Date, JSON, Set, Map, Promise,
    localStorage: makeLocalStorageShim(),
    setTimeout: fn => { fn(); return 0; },   // слушатели смены трека — сразу
    clearTimeout: () => {},
    setInterval: fn => { timers.push(fn); return timers.length; },
    clearInterval: () => { timers.length = 0; },
    window: { AudioContext: MockAudioContext },
  };
  const ctx = vm.createContext(sandbox);
  const soundIds = ['hover', 'click', 'deselect', 'blocked', 'match', 'combo',
    'mismatch', 'hint', 'undo', 'shuffle', 'deal', 'win'];
  const files = ['js/storage.js', 'js/music.js', 'js/sounds/init.js',
    ...soundIds.map(id => `js/sounds/${id}.js`), 'js/sounds/index.js', 'js/audio.js'];
  let src = '';
  files.forEach(f => { src += `\n/* ==== ${f} ==== */\n` + read(f); });
  src += '\n;globalThis.__m = { Storage, Music, Sounds, Audio2 };';
  vm.runInContext(src, ctx, { filename: 'audio-bundle.js' });
  return Object.assign({}, ctx.__m, { stats, timers, sandbox, soundIds });
}

// ============================================================
//  1. Сборник — целостность данных
// ============================================================

const { Music } = loadGameModules();

suite('Сборник — данные пьес', () => {

  test('в сборнике не меньше 7 пьес с уникальными id и названиями', () => {
    assertOk(Music.TRACKS.length >= 7, 'пьес: ' + Music.TRACKS.length);
    assertEq(new Set(Music.TRACKS.map(t => t.id)).size, Music.TRACKS.length);
    assertEq(new Set(Music.TRACKS.map(t => t.name)).size, Music.TRACKS.length);
  });

  test('у каждой из пяти тем есть фирменная пьеса в той же тональности', () => {
    Object.keys(Music.MOODS).forEach(theme => {
      const id = Music.trackForTheme(theme);
      const tr = Music.TRACKS.find(t => t.id === id);
      assertEq(tr.theme, theme);
      assertEq(tr.root, Music.MOODS[theme].root, `${theme}: корень пьесы = корень лада`);
      assertEq(tr.scale, Music.MOODS[theme].scale, `${theme}: гамма пьесы = гамма лада`);
      assertEq(tr.timbre, Music.MOODS[theme].timbre, `${theme}: тембр`);
    });
  });

  test('гармония: 8 тактов, все аккорды известны и соответствуют ладу', () => {
    Music.TRACKS.forEach(t => {
      assertEq(t.prog.length, Music.TRACK_BARS, t.id + ': длина прогрессии');
      const allowed = t.mode === 'minor' ? ['i', 'VI', 'III', 'VII'] : ['I', 'IV', 'V', 'vi'];
      t.prog.forEach(name => {
        assertOk(Music.chordNotes(name), `${t.id}: неизвестный аккорд ${name}`);
        assertOk(allowed.includes(name), `${t.id}: аккорд ${name} не из ${t.mode}`);
      });
    });
  });

  test('форма: 4 фразы, индексы мотивов существуют', () => {
    Music.TRACKS.forEach(t => {
      assertEq(t.form.length, 4, t.id + ': 4 фразы по 2 такта');
      t.form.forEach(i => assertOk(t.motifs[i], `${t.id}: нет мотива ${i}`));
    });
  });

  test('мотивы: ноты в пределах 8 долей, моно, без наложений', () => {
    Music.TRACKS.forEach(t => {
      t.motifs.forEach((m, mi) => {
        let end = 0;
        m.forEach(([beat, deg, dur]) => {
          const where = `${t.id}/мотив ${mi}`;
          assertOk(beat >= 0 && beat < 8, `${where}: доля ${beat}`);
          assertOk(dur > 0, `${where}: длительность ${dur}`);
          assertOk(beat + dur <= 8.0001, `${where}: нота выходит за фразу`);
          assertOk(beat >= end - 1e-9, `${where}: наложение на доле ${beat}`);
          assertOk(Number.isInteger(deg), `${where}: ступень ${deg}`);
          end = beat + dur;
        });
      });
    });
  });

  test('регистр мелодии (с форшлагом и октавным бликом) — G3…F#6', () => {
    Music.TRACKS.forEach(t => {
      t.motifs.forEach(m => m.forEach(([, deg]) => {
        const lo = Music.scaleMidi(t, deg - 1);
        const hi = Music.scaleMidi(t, deg + t.scale.length);
        assertOk(lo >= 55, `${t.id}: слишком низко (${lo})`);
        assertOk(hi <= 96, `${t.id}: слишком высоко (${hi})`);
      }));
    });
  });

  test('темп 50–80 bpm, 3–5 кругов, тембр из известных', () => {
    Music.TRACKS.forEach(t => {
      assertOk(t.bpm >= 50 && t.bpm <= 80, `${t.id}: bpm ${t.bpm}`);
      assertOk(t.loops >= 3 && t.loops <= 5, `${t.id}: loops ${t.loops}`);
      assertOk(['guzheng', 'koto', 'glass', 'metal'].includes(t.timbre), `${t.id}: тембр`);
    });
  });

  test('длина пьесы 1–3 минуты', () => {
    Music.TRACKS.forEach(t => {
      const sec = t.loops * Music.TRACK_BARS * Music.barSeconds(t.bpm);
      assertOk(sec >= 60 && sec <= 180, `${t.id}: ${Math.round(sec)} с`);
    });
  });

  test('в музыке нет резких форм волны (пила, квадрат)', () => {
    const src = read('js/music.js');
    assertOk(!/'sawtooth'|'square'/.test(src), 'sawtooth/square в music.js');
  });
});

// ============================================================
//  2. Чистые функции плейлиста
// ============================================================

suite('Сборник — чистые функции', () => {

  test('trackForTheme: мусор → первая пьеса', () => {
    assertEq(Music.trackForTheme('мусор'), Music.TRACKS[0].id);
    assertEq(Music.trackForTheme(undefined), Music.TRACKS[0].id);
  });

  test('pickNextTrackIndex никогда не повторяет текущую и достигает всех остальных', () => {
    const n = Music.TRACKS.length;
    for (let cur = 0; cur < n; cur++) {
      const seen = new Set();
      for (let i = 0; i < 200; i++) {
        const r = i / 200;
        const next = Music.pickNextTrackIndex(cur, n, r);
        assertOk(next >= 0 && next < n, 'вне диапазона');
        assertOk(next !== cur, `повтор пьесы ${cur} при r=${r}`);
        seen.add(next);
      }
      assertEq(seen.size, n - 1, `из ${cur} достижимы не все пьесы`);
    }
  });

  test('pickNextTrackIndex: мусор и граничные значения безопасны', () => {
    assertEq(Music.pickNextTrackIndex(0, 1, 0.5), 0);
    assertEq(Music.pickNextTrackIndex(0, 0, 0.5), 0);
    const v = Music.pickNextTrackIndex('x', 7, 'y');
    assertOk(v >= 0 && v < 7);
    assertOk(Music.pickNextTrackIndex(3, 7, 1) !== 3, 'r=1 не должен вернуть ту же пьесу');
    assertOk(Music.pickNextTrackIndex(3, 7, -5) !== 3);
  });

  test('scaleMidi: корень, октава, ступени ниже корня, минор', () => {
    const tea = Music.TRACKS.find(t => t.id === 'tea');
    assertEq(Music.scaleMidi(tea, 0), 60);
    assertEq(Music.scaleMidi(tea, 5), 72);
    assertEq(Music.scaleMidi(tea, 1), 62);
    assertEq(Music.scaleMidi(tea, -1), 57);   // A3 — ступень ниже корня
    assertEq(Music.scaleMidi(tea, -5), 48);
    const night = Music.TRACKS.find(t => t.id === 'night');
    assertEq(Music.scaleMidi(night, 1), 60);  // A + малая терция
  });

  test('chordNotes: неизвестное имя → null', () => {
    assertEq(Music.chordNotes('XYZ'), null);
    assertEq(Music.chordNotes('toString'), null); // не прототипные ключи
    assertEq(Music.chordNotes('I'), [0, 4, 7]);
  });
});

// ============================================================
//  3. Рантайм: звуковые эффекты
// ============================================================

suite('Audio2 — рантайм на мок-AudioContext', () => {

  test('каждый звук проигрывается без ошибок и создаёт голоса', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.soundIds.forEach(id => {
      const before = m.stats.oscillators + m.stats.sources;
      m.Audio2.previewSound(id);
      assertOk(m.stats.oscillators + m.stats.sources > before, `звук ${id} ничего не создал`);
    });
  });

  test('комбо ×2…×8 и мусорные множители не падают; тон остаётся ниже 7 кГц', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    [2, 3, 4, 5, 6, 7, 8, 9, 100, 'x', undefined, null, -1, 2.5].forEach(mult => {
      m.Audio2.combo(mult);
    });
    assertOk(m.stats.oscillators > 0);
    const top = Math.max(...m.stats.freqs);
    assertOk(top < 7000, 'слишком высокая частота: ' + Math.round(top));
  });

  test('комбо: чем выше серия, тем больше нот', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    const count = mult => {
      const b = m.stats.oscillators;
      m.Audio2.combo(mult);
      return m.stats.oscillators - b;
    };
    const c2 = count(2), c8 = count(8);
    assertOk(c8 > c2, `×8 (${c8}) должно звучать насыщеннее ×2 (${c2})`);
  });

  test('при выключенных эффектах — полная тишина', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.Audio2.setEnabled(false);
    ['click', 'match', 'combo', 'mismatch', 'hint', 'undo', 'win', 'deal', 'shuffleSound',
      'deselect', 'blocked'].forEach(fn => m.Audio2[fn]());
    assertEq(m.stats.oscillators + m.stats.sources, 0);
    assertEq(m.stats.contexts, 0, 'контекст не должен создаваться');
  });

  test('«Звук победы» выключен — победа молчит, остальное играет', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.Audio2.setWinEnabled(false);
    m.Audio2.win();
    assertEq(m.stats.oscillators, 0, 'win должен молчать');
    m.Audio2.click();
    assertOk(m.stats.oscillators > 0, 'click должен играть');
  });

  test('hover не создаёт AudioContext до первого жеста и троттлится', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.Audio2.hover();
    assertEq(m.stats.contexts, 0, 'hover создал контекст до жеста');
    m.Audio2.click();                       // жест — контекст появился
    const base = m.stats.oscillators;
    m.Audio2.hover();
    const afterOne = m.stats.oscillators;
    assertOk(afterOne > base, 'hover после жеста должен играть');
    m.Audio2.hover();                       // мгновенно второй раз — троттлинг
    assertEq(m.stats.oscillators, afterOne, 'троттлинг 60 мс не сработал');
  });

  test('эффекты берут тональность играющей пьесы (Music.getKey)', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.Music.setTrack('night');                  // минор, корень A
    assertEq(m.Music.getKey().scale, [0, 3, 5, 7, 10]);
    m.Audio2.click();
    // A-минор-пентатоника, корень сведён в окно 52..63 → 57 (A3).
    // Ступень 7 = октава + третья нота гаммы (D): 57 + 5 + 12 = 74 → D5 = 587.33 Гц
    assertOk(m.stats.freqs.some(f => Math.abs(f - 587.33) < 0.5),
      'в click нет ноты тональности night: ' + m.stats.freqs.map(f => Math.round(f)));
  });

  test('degreeToFreq: C-мажор пентатоника, ступени ниже корня и выше октавы', () => {
    const m = loadAudioSandbox();
    const k = { root: 60, scale: [0, 2, 4, 7, 9] };
    assertAlmostEq(m.Audio2.degreeToFreq(k, 0), 261.63, 0.01);
    assertAlmostEq(m.Audio2.degreeToFreq(k, 5), 523.25, 0.01);
    assertAlmostEq(m.Audio2.degreeToFreq(k, -1), 220.0, 0.01);
    assertAlmostEq(m.Audio2.degreeToFreq(k, 10), 1046.5, 0.01);
  });

  test('fitRoot: окно 52..63, сохраняет нотный класс', () => {
    const m = loadAudioSandbox();
    for (let r = 36; r < 100; r++) {
      const f = m.Audio2.fitRoot(r);
      assertOk(f >= 52 && f <= 63, `fitRoot(${r}) = ${f}`);
      assertEq(((f - r) % 12 + 12) % 12, 0, `нотный класс изменён у ${r}`);
    }
    assertEq(m.Audio2.fitRoot('мусор'), 60);
  });

  test('громкость: квадратичная кривая, границы и мусор', () => {
    const m = loadAudioSandbox();
    assertEq(m.Audio2.volumeGain(0), 0);
    assertAlmostEq(m.Audio2.volumeGain(100), m.Audio2.VOLUME_MAX, 1e-12);
    assertAlmostEq(m.Audio2.volumeGain(50), m.Audio2.VOLUME_MAX * 0.25, 1e-12);
    assertEq(m.Audio2.clampVolume(-4), 0);
    assertEq(m.Audio2.clampVolume(400), 100);
    assertEq(m.Audio2.clampVolume('abc'), m.Audio2.VOLUME_DEFAULT);
  });

  test('громкость эффектов читается из настроек (sfxVolume)', () => {
    const m = loadAudioSandbox();
    m.Storage.setSetting('sfxVolume', 30);
    m.Audio2.init();
    m.Audio2.click();
    assertOk(m.stats.contexts === 1);
    m.Audio2.setVolume(80);                    // не падает на живом графе
    m.Audio2.setVolume('мусор');
  });

  test('пиковые значения огибающих не превышают 0.5 (запас до клиппинга)', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.soundIds.forEach(id => m.Audio2.previewSound(id));
    m.Audio2.combo(8);
    assertOk(m.stats.maxPeak <= 0.5, 'пик огибающей ' + m.stats.maxPeak);
  });

  test('старые звуки v25 (playTone-стиль) продолжают работать через kit', () => {
    const m = loadAudioSandbox();
    m.Audio2.init();
    m.Sounds.legacy = {
      name: 'Старый', desc: 'v25',
      play: function (ctx, playTone) { playTone(440, 0.1, 'sine', 0.1); playTone(660, 0.1, 'triangle', 0.1, 0.05); },
    };
    m.Audio2.play('legacy');
    assertEq(m.stats.oscillators, 2);
  });
});

// ============================================================
//  3b. Рантайм: музыка
// ============================================================

// Гоним планировщик музыки по «времени» мок-контекста
function runMusic(m, seconds) {
  const c = m.sandbox.__ctx;
  const step = 0.3;
  for (let t = 0; t < seconds; t += step) {
    c.currentTime += step;
    m.timers.slice().forEach(fn => fn());
  }
}

function startMusic(m, opts) {
  m.Music.init(Object.assign({ theme: 'traditional', enabled: true, volumePct: 40 }, opts || {}));
  // Перехватываем мок-контекст, который создаст Music при start()
  const OrigAC = m.sandbox.window.AudioContext;
  m.sandbox.window.AudioContext = function () {
    const c = new OrigAC();
    m.sandbox.__ctx = c;
    return c;
  };
  m.Music.start();
  assertOk(m.Music.isPlaying(), 'музыка не запустилась');
}

suite('Музыка — рантайм на мок-AudioContext', () => {

  test('start() планирует голоса, без ошибок за 3 минуты игры', () => {
    const m = loadAudioSandbox();
    startMusic(m);
    runMusic(m, 180);
    assertOk(m.stats.oscillators > 200, 'слишком мало голосов: ' + m.stats.oscillators);
  });

  test('режим «Авто»: пьеса меняется после своих кругов и не повторяется подряд', () => {
    const m = loadAudioSandbox();
    const seen = [];
    m.Music.onTrackChange(t => seen.push(t.id));
    startMusic(m);
    runMusic(m, 600);
    assertEq(seen[0], 'tea', 'игра начинается с фирменной пьесы темы');
    assertOk(seen.length >= 4, 'за 10 минут должно смениться ≥3 пьес: ' + seen.join(','));
    for (let i = 1; i < seen.length; i++) {
      assertOk(seen[i] !== seen[i - 1], 'пьеса повторилась подряд: ' + seen.join(','));
    }
  });

  test('фирменная пьеса следует за темой', () => {
    const m = loadAudioSandbox();
    startMusic(m, { theme: 'night' });
    assertEq(m.Music.getTrack().id, 'night');
    m.Music.setTheme('imperial');
    runMusic(m, 10);
    assertEq(m.Music.getTrack().id, 'imperial');
  });

  test('выбранная пьеса играет по кругу и не меняется', () => {
    const m = loadAudioSandbox();
    const seen = [];
    m.Music.onTrackChange(t => seen.push(t.id));
    startMusic(m, { track: 'mist' });
    runMusic(m, 400);
    assertEq(m.Music.getTrackMode(), 'mist');
    assertEq(m.Music.getTrack().id, 'mist');
    assertEq(new Set(seen).size, 1, 'пьеса сменилась: ' + seen.join(','));
  });

  test('setTrack посреди игры → смена на границе такта; «auto» возвращает плейлист', () => {
    const m = loadAudioSandbox();
    startMusic(m);
    runMusic(m, 8);
    m.Music.setTrack('cranes');
    runMusic(m, 8);
    assertEq(m.Music.getTrack().id, 'cranes');
    m.Music.setTrack('auto');
    assertEq(m.Music.getTrackMode(), 'auto');
    runMusic(m, 8);
    assertEq(m.Music.getTrack().id, 'tea', 'в «Авто» возвращается пьеса темы');
  });

  test('nextTrack идёт по кругу сборника и фиксирует пьесу в режиме одной', () => {
    const m = loadAudioSandbox();
    startMusic(m, { track: 'tea' });
    const t = m.Music.nextTrack();
    assertEq(t.id, m.Music.TRACKS[1].id);
    assertEq(m.Music.getTrackMode(), t.id, 'выбранная пьеса должна обновиться');
    runMusic(m, 8);
    assertEq(m.Music.getTrack().id, t.id);
    // обход всего круга возвращает к первой пьесе
    for (let i = 0; i < m.Music.TRACKS.length - 1; i++) m.Music.nextTrack();
    runMusic(m, 8);
    assertEq(m.Music.getTrack().id, 'tea');
  });

  test('неизвестный id пьесы → режим «Авто»', () => {
    const m = loadAudioSandbox();
    m.Music.init({ theme: 'jade', track: 'нет-такой' });
    assertEq(m.Music.getTrackMode(), 'auto');
    assertEq(m.Music.getTrack().id, 'jade');
  });

  test('stop() и повторный start() работают; пауза (duck) не падает', () => {
    const m = loadAudioSandbox();
    startMusic(m);
    runMusic(m, 5);
    m.Music.duck(true);
    m.Music.duck(false);
    m.Music.stop();
    assertEq(m.Music.isPlaying(), false);
    m.Music.start();
    assertOk(m.Music.isPlaying());
    runMusic(m, 5);
  });

  test('getKey отдаёт тональность текущей пьесы', () => {
    const m = loadAudioSandbox();
    m.Music.init({ theme: 'night' });
    const k = m.Music.getKey();
    assertEq(k.root, 57);
    assertEq(k.scale, [0, 3, 5, 7, 10]);
  });
});

// ============================================================
//  4. Разметка и интеграция
// ============================================================

suite('v26-audio — разметка и интеграция', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const render = read('js/render.js');
  const storage = loadGameModules().Storage;

  test('в настройках есть выбор пьесы, «следующая», громкость эффектов', () => {
    ['setting-music-track', 'setting-music-next', 'music-now-playing',
      'setting-sfx-volume', 'setting-sfx-volume-out'].forEach(id => {
      assertOk(html.includes(`id="${id}"`), 'нет #' + id);
    });
  });

  test('app.js вызывает новые звуки: blocked, deselect, undo, deal', () => {
    ['Audio2.blocked()', 'Audio2.deselect()', 'Audio2.undo()', 'Audio2.deal()'].forEach(call => {
      assertOk(app.includes(call), 'нет вызова ' + call);
    });
    // deal — при каждом старте/продолжении партии (7 мест), но не в перемешивании
    const deals = app.split('Audio2.deal()').length - 1;
    assertEq(deals, 7, 'Audio2.deal() должен быть в 7 местах раздачи');
  });

  test('app.js: сборник и громкость эффектов подключены к настройкам', () => {
    assertOk(/Music\.init\(\{[\s\S]*track:/.test(app), 'Music.init должен получать track');
    assertOk(app.includes('Music.onTrackChange'), 'нет подписки на смену пьесы');
    assertOk(app.includes("'sfxVolume'"), 'нет настройки sfxVolume');
    assertOk(app.includes("'musicTrack'"), 'нет настройки musicTrack');
  });

  test('Storage: дефолты sfxVolume = 70, musicTrack = auto', () => {
    assertEq(storage.getSetting('sfxVolume', undefined), 70);
    assertEq(storage.getSetting('musicTrack', undefined), 'auto');
  });

  test('render.js: hover только над свободными фишками (Game.isFree)', () => {
    assertOk(/Game\.isFree\(tile\)/.test(render), 'hover должен проверять Game.isFree');
  });

  test('CSS: стили выбора пьесы', () => {
    const css = read('css/main.css');
    assertOk(css.includes('.music-picker') && css.includes('.setting-select'));
  });

  test('в звуках и движке эффектов нет резких форм волны', () => {
    const files = ['js/audio.js'].concat(
      fs.readdirSync(path.join(ROOT, 'js/sounds')).map(f => 'js/sounds/' + f));
    files.forEach(f => {
      assertOk(!/'sawtooth'|'square'/.test(read(f)), `${f}: sawtooth/square`);
    });
  });
});
