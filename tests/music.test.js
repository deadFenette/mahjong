/* ============================================================
   TESTS/MUSIC.TEST.JS — v10 «Музыка и богатство»
   1. Чистая математика музыкального движка (music.js):
      midiToFreq, moodForTheme, nextNoteIndex, volumeGain,
      barSeconds, clampVolume.
   2. Дефолты настроек музыки в Storage.
   3. Разметка и стили: контролы музыки, тема «Император»,
      золотая пыль, бейдж рекорда, золотая нить стола.
   Рантайм-функции (start/stop/init) проверяются на «не падает
   без браузера» — реальный звук ловится браузерной проверкой.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq, assertAlmostEq, assertLte, assertGte } = require('./runner');
const { loadGameModules } = require('./load');

const { Music, Storage } = loadGameModules();

// ============================================================
//  1. midiToFreq — MIDI-номер в частоту
// ============================================================

suite('Music — midiToFreq', () => {

  test('эталонные ноты: A4 = 440, A3 = 220, A5 = 880', () => {
    assertAlmostEq(Music.midiToFreq(69), 440, 1e-9);
    assertAlmostEq(Music.midiToFreq(57), 220, 1e-9);
    assertAlmostEq(Music.midiToFreq(81), 880, 1e-9);
  });

  test('C4 ≈ 261.63, MIDI 0 ≈ 8.18', () => {
    assertAlmostEq(Music.midiToFreq(60), 261.6256, 0.001);
    assertAlmostEq(Music.midiToFreq(0), 8.1758, 0.001);
  });

  test('октава вверх — ровно удвоение частоты', () => {
    assertAlmostEq(Music.midiToFreq(72), Music.midiToFreq(60) * 2, 1e-9);
  });

  test('мусор даёт null, а не NaN', () => {
    assertEq(Music.midiToFreq('abc'), null);
    assertEq(Music.midiToFreq(NaN), null);
    assertEq(Music.midiToFreq(undefined), null);
    assertEq(Music.midiToFreq(Infinity), null);
  });
});

// ============================================================
//  2. moodForTheme — лад под каждую тему
// ============================================================

suite('Music — moodForTheme', () => {

  test('каждая из пяти тем имеет свой лад', () => {
    ['traditional', 'jade', 'porcelain', 'night', 'imperial'].forEach(t => {
      const mood = Music.moodForTheme(t);
      assertOk(mood && mood.id === t, `у темы ${t} нет лада`);
    });
  });

  test('лады различаются: у night минорная пентатоника и низкий корень', () => {
    const night = Music.moodForTheme('night');
    assertEq(night.scale, [0, 3, 5, 7, 10]);
    assertOk(night.root < Music.moodForTheme('traditional').root,
      'ночь должна звучать ниже традиционной');
  });

  test('ночь — самый редкий и медленный лад', () => {
    const night = Music.moodForTheme('night');
    ['traditional', 'jade', 'porcelain', 'imperial'].forEach(t => {
      assertOk(night.bpm <= Music.moodForTheme(t).bpm, `ночь медленнее ${t}`);
      assertOk(night.density <= Music.moodForTheme(t).density, `ночь реже ${t}`);
    });
  });

  test('мусор → лад traditional (безопасный фолбэк)', () => {
    assertEq(Music.moodForTheme('мусор'), Music.MOODS.traditional);
    assertEq(Music.moodForTheme(undefined), Music.MOODS.traditional);
    assertEq(Music.moodForTheme(''), Music.MOODS.traditional);
  });
});

// ============================================================
//  3. nextNoteIndex — мелодическая прогулка по гамме
// ============================================================

suite('Music — nextNoteIndex', () => {

  test('детерминирован: r=0 → шаг влево, r→1 → шаг вправо', () => {
    assertEq(Music.nextNoteIndex(5, 10, 2, 0), 3);
    assertEq(Music.nextNoteIndex(5, 10, 2, 0.999), 7);
  });

  test('шаг 0 запрещён (мелодия не топчется на месте)', () => {
    // r такой, что floor(r*5)-2 = 0 → шаг принудительно +1
    assertEq(Music.nextNoteIndex(5, 10, 2, 0.5), 6);
  });

  test('отражение от левой границы', () => {
    // cur=0, шаг -2 → -2 → отражение → 2
    assertEq(Music.nextNoteIndex(0, 10, 2, 0), 2);
    // cur=0, шаг -1 → -1 → 1
    assertEq(Music.nextNoteIndex(0, 10, 2, 0.3), 1); // floor(0.3*5)-2 = -1
  });

  test('отражение от правой границы', () => {
    // cur=9 (последний), шаг +2 → 11 → отражение 2*9-11 = 7
    assertEq(Music.nextNoteIndex(9, 10, 2, 0.999), 7);
    // cur=4 в гамме из 5, шаг +2 → 6 → отражение 2*4-6 = 2
    assertEq(Music.nextNoteIndex(4, 5, 2, 0.999), 2);
  });

  test('всегда в пределах гаммы при любом r из [0,1)', () => {
    for (let i = 0; i < 100; i++) {
      const r = i / 100;
      const res = Music.nextNoteIndex(3, 5, 2, r);
      assertOk(res >= 0 && res <= 4, `r=${r} вышел за границы: ${res}`);
    }
  });

  test('гамма из одной ноты всегда даёт 0', () => {
    assertEq(Music.nextNoteIndex(0, 1, 2, 0), 0);
    assertEq(Music.nextNoteIndex(0, 1, 2, 0.9), 0);
  });

  test('мусор в аргументах безопасен', () => {
    assertEq(Music.nextNoteIndex(NaN, 10, 2, 0.5), 1); // cur→0, шаг +1
    assertEq(Music.nextNoteIndex(0, 0, 2, 0), 0);      // пустая гамма
    assertEq(Music.nextNoteIndex(0, -3, 2, 0), 0);
    assertEq(Music.nextNoteIndex(0, 10, 'мусор', 0.5), 1); // maxStep→1
    assertEq(Music.nextNoteIndex(0, 10, 2, 'мусор'), 1);   // r→шаг +1
  });
});

// ============================================================
//  4. volumeGain и clampVolume — кривая громкости
// ============================================================

suite('Music — volumeGain / clampVolume', () => {

  test('0% → тишина, 100% → VOLUME_MAX', () => {
    assertEq(Music.volumeGain(0), 0);
    assertAlmostEq(Music.volumeGain(100), Music.VOLUME_MAX, 1e-12);
  });

  test('квадратичная кривая: 50% → четверть от максимума', () => {
    assertAlmostEq(Music.volumeGain(50), Music.VOLUME_MAX * 0.25, 1e-12);
    assertAlmostEq(Music.volumeGain(35), Music.VOLUME_MAX * 0.1225, 1e-12);
  });

  test('выход за границы клампится', () => {
    assertEq(Music.volumeGain(-50), 0);
    assertAlmostEq(Music.volumeGain(250), Music.VOLUME_MAX, 1e-12);
  });

  test('мусор → громкость по умолчанию (35%)', () => {
    assertAlmostEq(Music.volumeGain('мусор'),
      Music.volumeGain(Music.VOLUME_DEFAULT), 1e-12);
    assertAlmostEq(Music.volumeGain(NaN),
      Music.volumeGain(Music.VOLUME_DEFAULT), 1e-12);
  });

  test('clampVolume: границы, округление, мусор', () => {
    assertEq(Music.clampVolume(-5), 0);
    assertEq(Music.clampVolume(150), 100);
    assertEq(Music.clampVolume(42.4), 42);
    assertEq(Music.clampVolume(42.6), 43);
    assertEq(Music.clampVolume('abc'), Music.VOLUME_DEFAULT);
    assertEq(Music.clampVolume(undefined), Music.VOLUME_DEFAULT);
  });

  test('VOLUME_MAX заметно тише полной громкости: 0.5', () => {
    assertEq(Music.VOLUME_MAX, 0.5);
    assertEq(Music.VOLUME_DEFAULT, 35);
  });
});

// ============================================================
//  5. barSeconds — длительность такта
// ============================================================

suite('Music — barSeconds', () => {

  test('60 bpm → 4 с, 120 bpm → 2 с', () => {
    assertEq(Music.barSeconds(60), 4);
    assertEq(Music.barSeconds(120), 2);
  });

  test('дробная длительность точна', () => {
    assertAlmostEq(Music.barSeconds(90), 8 / 3, 1e-12);
  });

  test('мусор и неположительный bpm → null', () => {
    assertEq(Music.barSeconds(0), null);
    assertEq(Music.barSeconds(-10), null);
    assertEq(Music.barSeconds('abc'), null);
    assertEq(Music.barSeconds(undefined), null);
    assertEq(Music.barSeconds(NaN), null);
  });
});

// ============================================================
//  6. Рантайм в песочнице (без window) — только не падать
// ============================================================

suite('Music — рантайм безопасен без браузера', () => {

  test('start/stop/setEnabled/setVolume/setTheme/duck — тихие no-op', () => {
    Music.setTheme('night');
    Music.setVolume(50);
    Music.setEnabled(true);   // window нет → ensureCtx → null → no-op
    Music.setEnabled(false);
    Music.duck(true);
    Music.duck(false);
    Music.start();
    Music.stop();
    assertOk(Music.isEnabled() === false, 'после disable — выключен');
    assertOk(Music.isPlaying() === false, 'в песочнице никогда не играет');
  });

  test('init без document не падает', () => {
    Music.init({ theme: 'jade', enabled: true, volumePct: 40 });
    assertOk(true);
  });
});

// ============================================================
//  7. Storage — дефолты музыки
// ============================================================

suite('Music — настройки по умолчанию', () => {

  test('музыка включена по умолчанию (тихая)', () => {
    assertEq(Storage.getSetting('music', undefined), true);
  });

  test('громкость по умолчанию — 35%', () => {
    assertEq(Storage.getSetting('musicVolume', undefined), 35);
  });

  test('пользовательский выбор переживает перезапись', () => {
    Storage.setSetting('music', false);
    Storage.setSetting('musicVolume', 60);
    assertEq(Storage.getSetting('music', true), false);
    // Storage хранит числа строками (легаси-поведение) — рантайм
    // прогоняет их через clampVolume/Number, поэтому сравниваем как число
    assertEq(Number(Storage.getSetting('musicVolume', 35)), 60);
  });
});

// ============================================================
//  8. Разметка и стили v10
// ============================================================

suite('Music — разметка index.html', () => {

  const html = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'), 'utf8');

  test('модуль music.js подключён в index.html', () => {
    assertOk(html.includes('<script src="js/music.js">'),
      'нет тега подключения js/music.js');
  });

  test('в настройках есть тумблер музыки и слайдер громкости', () => {
    assertOk(html.includes('id="setting-music"'), 'нет тумблера музыки');
    assertOk(html.includes('id="setting-music-volume"'), 'нет слайдера громкости');
    assertOk(html.includes('id="setting-music-volume-out"'), 'нет вывода громкости');
  });

  test('в паузе есть быстрая кнопка музыки', () => {
    assertOk(html.includes('id="pause-music"'), 'нет кнопки музыки в паузе');
  });

  test('в меню есть контейнер золотой пыли, на победе — бейдж рекорда', () => {
    assertOk(html.includes('id="menu-dust"'), 'нет контейнера золотой пыли');
    assertOk(html.includes('id="win-record"'), 'нет бейджа рекорда');
  });
});

suite('Music — стили v10', () => {

  const mainCss = fs.readFileSync(
    path.join(__dirname, '..', 'css', 'main.css'), 'utf8');

  test('золотая пыль стилизована', () => {
    assertOk(mainCss.includes('.menu-dust'), 'нет .menu-dust');
    assertOk(mainCss.includes('.dust-mote'), 'нет .dust-mote');
    assertOk(mainCss.includes('dust-rise'), 'нет анимации dust-rise');
  });

  test('бейдж рекорда стилизован и скрывается', () => {
    assertOk(mainCss.includes('.win-record'), 'нет .win-record');
    assertOk(mainCss.includes('.win-record[hidden]'), 'нет скрытия .win-record');
  });

  test('золотая нить стола — через .board-table::before', () => {
    assertOk(mainCss.includes('.board-table::before'),
      'нет золотой нити на столе');
  });

  test('превью императорской темы стилизовано', () => {
    assertOk(mainCss.includes('.theme-preview-imperial'),
      'нет превью imperial в main.css');
  });
});
