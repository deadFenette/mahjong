/* ============================================================
   TESTS/AUDIO.TEST.JS — Звуковые эффекты (v25-sounds)
   audio.js теперь тонкая обёртка над модулями в js/sounds/.
   Тестируем через статический анализ исходников:
   - audio.js экспортирует нужные методы + getCatalog + previewSound
   - sounds/ содержит отдельные файлы для каждого звука
   - hover.js имеет троттлинг + деревянный ток (sine + triangle)
   - render.js вызывает Audio2.hover() при mouseenter
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk, assertEq } = require('./runner');

const ROOT = path.join(__dirname, '..');
const audioSrc = fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8');
const renderSrc = fs.readFileSync(path.join(ROOT, 'js/render.js'), 'utf8');

// Читаем все sound-файлы
const soundsDir = path.join(ROOT, 'js/sounds');
const soundFiles = fs.readdirSync(soundsDir).filter(f => f.endsWith('.js') && f !== 'index.js');
const soundsIndex = fs.readFileSync(path.join(soundsDir, 'index.js'), 'utf8');
const hoverSrc = fs.readFileSync(path.join(soundsDir, 'hover.js'), 'utf8');

suite('Audio2 — API (v25-sounds)', () => {

  test('Audio2 экспортирует все нужные методы', () => {
    const expected = ['init', 'click', 'match', 'combo', 'mismatch', 'hint',
      'win', 'shuffleSound', 'hover', 'setEnabled', 'setWinEnabled',
      'getCatalog', 'previewSound'];
    expected.forEach(m => {
      assertOk(new RegExp(`\\b${m}\\b`).test(audioSrc),
        `Audio2 должен содержать ${m}`);
    });
  });

  test('audio.js — тонкая обёртка: делегирует в Sounds.*.play()', () => {
    assertOk(/playSound\(/.test(audioSrc), 'должна быть функция playSound()');
    assertOk(/Sounds\[soundId\]/.test(audioSrc), 'должен обращаться к Sounds[id]');
  });

  test('getCatalog возвращает каталог звуков', () => {
    assertOk(/getCatalog/.test(audioSrc), 'должен быть getCatalog()');
    assertOk(/Sounds\.CATALOG/.test(soundsIndex), 'sounds/index.js должен иметь CATALOG');
  });

  test('previewSound позволяет предпрослушать звук', () => {
    assertOk(/previewSound/.test(audioSrc), 'должен быть previewSound()');
  });
});

suite('Sounds — модульная структура (v25-sounds)', () => {

  test('каждый звук — отдельный файл в js/sounds/', () => {
    const expected = ['click.js', 'match.js', 'combo.js', 'mismatch.js',
      'hint.js', 'win.js', 'shuffle.js', 'hover.js'];
    expected.forEach(f => {
      assertOk(soundFiles.includes(f), `должен быть файл sounds/${f}`);
    });
  });

  test('каждый звук имеет name, desc, play', () => {
    const ids = ['click', 'match', 'combo', 'mismatch', 'hint', 'win', 'shuffle', 'hover'];
    ids.forEach(id => {
      const src = fs.readFileSync(path.join(soundsDir, id + '.js'), 'utf8');
      assertOk(src.includes(`Sounds.${id} = {`), `sounds/${id}.js должен определять Sounds.${id}`);
      assertOk(src.includes('name:'), `${id}: должен иметь name`);
      assertOk(src.includes('desc:'), `${id}: должен иметь desc`);
      assertOk(src.includes('play:'), `${id}: должен иметь play`);
    });
  });

  test('sounds/index.js собирает каталог', () => {
    assertOk(soundsIndex.includes('Sounds.CATALOG'), 'CATALOG должен быть');
    assertOk(soundsIndex.includes('getById'), 'getById должен быть');
    // Каталог содержит все 8 звуков
    const ids = ['click', 'match', 'combo', 'mismatch', 'hint', 'win', 'shuffle', 'hover'];
    ids.forEach(id => {
      assertOk(soundsIndex.includes(`'${id}'`), `CATALOG должен содержать '${id}'`);
    });
  });

  test('index.html подключает все sound-файлы перед audio.js', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const ids = ['click', 'match', 'combo', 'mismatch', 'hint', 'win', 'shuffle', 'hover'];
    ids.forEach(id => {
      assertOk(html.includes(`js/sounds/${id}.js`),
        `index.html должен подключать sounds/${id}.js`);
    });
    assertOk(html.includes('js/sounds/index.js'), 'должен быть sounds/index.js');
    // audio.js должен быть ПОСЛЕ sounds/
    const iSounds = html.indexOf('js/sounds/index.js');
    const iAudio = html.indexOf('js/audio.js');
    assertOk(iSounds > -1 && iAudio > -1 && iSounds < iAudio,
      'sounds/index.js должен быть перед audio.js');
  });

  test('sw.js кэширует все sound-файлы', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const ids = ['click', 'match', 'combo', 'mismatch', 'hint', 'win', 'shuffle', 'hover'];
    ids.forEach(id => {
      assertOk(sw.includes(`js/sounds/${id}.js`),
        `sw.js должен кэшировать sounds/${id}.js`);
    });
    assertOk(sw.includes('js/sounds/index.js'), 'sw должен кэшировать sounds/index.js');
  });
});

suite('Sounds — hover (деревянный ток + троттлинг)', () => {

  test('hover.js имеет троттлинг 60 мс', () => {
    assertOk(hoverSrc.includes('_lastAt'), 'hover должен иметь _lastAt для троттлинга');
    assertOk(/60/.test(hoverSrc), 'троттлинг 60 мс');
  });

  test('hover.js — деревянный ток (sine + triangle обертон)', () => {
    assertOk(/osc1\.type\s*=\s*['"]sine['"]/.test(hoverSrc),
      'основной осциллятор hover должен быть sine');
    assertOk(/osc2\.type\s*=\s*['"]triangle['"]/.test(hoverSrc),
      'обертон hover должен быть triangle');
    assertOk(/frequency\.value\s*=\s*660/.test(hoverSrc),
      'основная частота hover ~660 Hz');
    assertOk(/frequency\.value\s*=\s*220/.test(hoverSrc),
      'обертон hover ~220 Hz');
  });

  test('hover.js не использует старый пищащий 1320 Hz', () => {
    assertOk(!/tone\(1320/.test(hoverSrc),
      'старый пищащий 1320 Hz должен быть убран');
  });
});

suite('Audio2 — интеграция с render.js (hover)', () => {

  test('render.js вызывает Audio2.hover() при mouseenter на фишке', () => {
    assertOk(/mouseenter/.test(renderSrc),
      'render.js должен слушать mouseenter на фишках');
    assertOk(/Audio2\.hover/.test(renderSrc),
      'render.js должен вызывать Audio2.hover() при mouseenter');
  });
});
