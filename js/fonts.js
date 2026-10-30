/* ============================================================
   FONTS.JS — фирменные шрифты по требованию (v47-perf)

   История: до v20 игра тянула шрифты с Google Fonts (в офлайне тема
   «проседала»), в v20 их положили в /fonts/ (самохостинг). В v47
   бинарники убраны из репозитория и архива — вместо этого модуль
   подключает шрифты тремя способами, по приоритету:

     1. IndexedDB — если шрифты уже загружали (кнопкой или из папки),
        они просто восстанавливаются. Дальше — навсегда офлайн.
     2. Папка fonts/ рядом с index.html — если игрок сам положил туда
        файлы (мини-архив «Шрифты» с сайта релиза). Найденные файлы
        кэшируются в IndexedDB на будущее.
     3. Кнопка в меню/настройках — докачка с Google Fonts (те же самые
        гарнитуры) напрямую в IndexedDB: разбираем css2-ответ, качаем
        только куски (unicode-range), в которых лежат нужные игре
        символы. ~300–400 запросов по 5–60 КБ, один раз за всё время.

   Пока шрифтов нет — игра живёт на системном фолбэке (как и сейчас).
   Ничего не качается без явного клика игрока.

   Чистые функции (parseCssFontFaces, rangesIntersect, usedSetHas)
   покрыты tests/perf47.test.js.
   ============================================================ */

const GameFonts = (function () {
  'use strict';

  // ---------- Каталог локальных/кэшированных файлов ----------
  // Один файл = один вес. Имена совпадают с «мини-архивом шрифтов».
  const FILES = [
    { file: 'mashanzheng-400.woff2',   family: 'Ma Shan Zheng',  weight: '400' },
    { file: 'zcoolxiaowei-400.woff2',  family: 'ZCOOL XiaoWei',  weight: '400' },
    { file: 'notoserifsc-400.woff2',   family: 'Noto Serif SC',  weight: '400' },
    { file: 'notoserifsc-600.woff2',   family: 'Noto Serif SC',  weight: '600' },
    { file: 'notoserifsc-700.woff2',   family: 'Noto Serif SC',  weight: '700' },
    { file: 'notoserifsc-900.woff2',   family: 'Noto Serif SC',  weight: '900' },
    { file: 'notosanssc-400.woff2',    family: 'Noto Sans SC',   weight: '400' },
    { file: 'notosanssc-500.woff2',    family: 'Noto Sans SC',   weight: '500' },
    { file: 'notosanssc-700.woff2',    family: 'Noto Sans SC',   weight: '700' },
  ];

  // Семейства и веса для CDN-докачки (css2), в терминах Google
  const CDN_FAMILIES = [
    { q: 'Ma Shan Zheng',  weights: [400] },
    { q: 'ZCOOL XiaoWei',  weights: [400] },
    { q: 'Noto Serif SC',  weights: [400, 600, 700, 900] },
    { q: 'Noto Sans SC',   weights: [400, 500, 700] },
  ];
  const CSS2_URL = 'https://fonts.googleapis.com/css2?' +
    CDN_FAMILIES.map(f => {
      const fam = f.q.replace(/ /g, '+') +
        (f.weights.length > 1 ? ':wght@' + f.weights.join(';') : '');
      return 'family=' + fam;
    }).join('&') + '&display=swap';

  // Символы, которые игра реально рисует (UI, лица фишек, каллиграфия).
  // Компактные диапазоны; пересечение с unicode-range блоков css2.
  const USED_RANGES = (function (s) {
    const out = [];
    for (const part of s.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const m = /^([0-9a-f]+)(?:-([0-9a-f]+))?$/.exec(t);
      if (m) out.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
    }
    return out;
  })('a,20-7e,a0,ab,b0-b3,b7,bb,d7,3b6,400-45f,2013-2014,2018-2019,201c-201d,2022,2026,2032-2033,2116,2190,2192,2212,221a,221e,2248,2261,2264-2265,231b,23ed,2500,2514,251c,25a5,25b3,25b6,25c6,25c8,2601,2605,2630,265b,2665,266a,26e9,26f5,2713,2715,2717,271a,2726,2732,2735-2736,273f,2756,27f7,27fa,4e00,4e03,4e07,4e09,4e1c,4e2d,4e5d,4e8c,4e94,4eba,516b,516d,5170,51ac,52dd,5317,5357,535a,53d1,5409,548c,559c,56db,571f,590f,5927,5929,5b63,5b78,5b89,5bff,5c07,5c71,5e73,5eb7,5f08,5fc3,6247,65b9,65e5,6625,6708,6728,6771,6885,68a6,6c34,6c38,6df7,706b,7231,738b,7530,767c-767d,7984,798f,79a7,79cb,7af9,7b52,7bad,7c73,7d22,7e8c,82b1,83ca,842c,862d,897f,8a2d,8d22,8ff7,9053,91d1,96ea,9759,98ce,997c,9ebb,9f8d,9f99,1f004,1f309,1f338,1f33f,1f341,1f344,1f38b,1f3ef,1f41f,1f422,1f5fc,1f6e2,1fa9c');

  // ---------- Чистые функции (тестируются) ----------

  // Есть ли в диапазоне unicode-range хоть один нужный игре символ
  function rangesIntersect(a, b) {
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i][1] < b[j][0]) { i++; continue; }
      if (b[j][1] < a[i][0]) { j++; continue; }
      return true;
    }
    return false;
  }

  function parseUnicodeRange(str) {
    const out = [];
    for (const tok of String(str).split(',')) {
      const t = tok.trim().toLowerCase().replace(/^u\+/, '');
      if (!t) continue;
      const m = /^([0-9a-f?]+)(?:-([0-9a-f?]+))?$/.exec(t);
      if (!m) continue;
      if (m[2]) out.push([parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[2].replace(/\?/g, 'f'), 16)]);
      else if (m[1].includes('?')) out.push([parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'f'), 16)]);
      else out.push([parseInt(m[1], 16), parseInt(m[1], 16)]);
    }
    return out;
  }

  // css2-ответ → дескрипторы блоков (чистая функция)
  function parseCssFontFaces(css) {
    const out = [];
    const re = /@font-face\s*\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const b = m[1];
      const fam = /font-family:\s*'([^']+)'/i.exec(b);
      const w = /font-weight:\s*(\d+)/i.exec(b);
      const url = /url\((https?:\/\/[^)]+)\)/i.exec(b);
      const ur = /unicode-range:\s*([^;]+);/i.exec(b);
      if (!fam || !w || !url || !ur) continue;
      out.push({
        family: fam[1],
        weight: w[1],
        url: url[1],
        unicodeRange: ur[1].trim(),
      });
    }
    return out;
  }

  // ---------- IndexedDB ----------
  const DB_NAME = 'mahjong-fonts';
  const STORE = 'kv';
  const KEY = 'fonts';

  function idbOpen() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('no idb')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- Состояние и события ----------
  // status: 'checking' | 'missing' | 'loading' | 'loaded' | 'error'
  let status = 'checking';
  let source = null;     // 'idb' | 'local' | 'cdn'
  let progress = null;   // { done, total } при загрузке

  function emit() {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('mahjong:fonts', {
      detail: { status, source, progress },
    }));
  }

  function setStatus(s) { status = s; emit(); }

  // ---------- Применение ----------
  const activeFaces = [];

  function applyFaces(descs, buffers) {
    // desc: { family, weight, unicodeRange? } ; buffer: ArrayBuffer
    const style = document.getElementById('runtime-fonts') ||
      (() => {
        const el = document.createElement('style');
        el.id = 'runtime-fonts';
        document.head.appendChild(el);
        return el;
      })();
    let css = '';
    for (let i = 0; i < descs.length; i++) {
      const d = descs[i];
      const buf = buffers[i];
      if (!buf) continue;
      const blob = new Blob([buf], { type: 'font/woff2' });
      const url = URL.createObjectURL(blob);
      const ur = d.unicodeRange ? `unicode-range: ${d.unicodeRange};` : '';
      css += `@font-face{font-family:'${d.family}';font-style:normal;font-weight:${d.weight};` +
        `font-display:swap;src:url(${url}) format('woff2');${ur}}\n`;
      try {
        const face = new FontFace(d.family, buf, {
          weight: d.weight,
          display: 'swap',
          unicodeRange: d.unicodeRange || undefined,
        });
        document.fonts.add(face);
        activeFaces.push(face);
      } catch (e) { /* FontFace может отсутствовать — работает <style> */ }
    }
    style.textContent = css;
  }

  // ---------- Источники ----------
  async function loadFromIdb() {
    const rec = await idbGet(KEY);
    if (!rec || !Array.isArray(rec.files) || !rec.files.length) return false;
    applyFaces(rec.files, rec.files.map(f => f.buf));
    source = rec.source || 'idb';
    setStatus('loaded');
    return true;
  }

  async function loadFromLocalFolder() {
    const files = [];
    for (const f of FILES) {
      const res = await fetch('fonts/' + f.file, { cache: 'no-cache' });
      if (!res.ok) throw new Error('нет файла ' + f.file);
      files.push({ ...f, buf: await res.arrayBuffer() });
    }
    try { await idbPut(KEY, { source: 'local', ts: Date.now(), files }); } catch (e) { /* приватный режим */ }
    applyFaces(files, files.map(f => f.buf));
    source = 'local';
    setStatus('loaded');
    return true;
  }

  // CDN: css2 → выбор блоков по символам игры → woff2 → IndexedDB
  async function downloadFromCdn(onProgress) {
    const cssResp = await fetch(CSS2_URL, { cache: 'no-cache' });
    if (!cssResp.ok) throw new Error('css2 HTTP ' + cssResp.status);
    const css = await cssResp.text();
    const blocks = parseCssFontFaces(css).filter(b => {
      const fam = CDN_FAMILIES.find(f => f.q === b.family);
      if (!fam) return false;
      if (!fam.weights.includes(Number(b.weight))) return false;
      return rangesIntersect(USED_RANGES, parseUnicodeRange(b.unicodeRange));
    });
    if (!blocks.length) throw new Error('css2 не дал нужных блоков');

    const files = [];
    let done = 0;
    const BATCH = 12;
    for (let i = 0; i < blocks.length; i += BATCH) {
      const slice = blocks.slice(i, i + BATCH);
      const bufs = await Promise.all(slice.map(async b => {
        const r = await fetch(b.url, { cache: 'no-cache' });
        if (!r.ok) throw new Error('font HTTP ' + r.status);
        return r.arrayBuffer();
      }));
      slice.forEach((b, k) => files.push({
        family: b.family, weight: b.weight, unicodeRange: b.unicodeRange, buf: bufs[k],
      }));
      done += slice.length;
      progress = { done, total: blocks.length };
      if (typeof onProgress === 'function') onProgress(done, blocks.length);
      emit();
    }
    try { await idbPut(KEY, { source: 'cdn', ts: Date.now(), files }); } catch (e) { /* приватный режим */ }
    applyFaces(files, files.map(f => f.buf));
    source = 'cdn';
    setStatus('loaded');
    return true;
  }

  // ---------- Публичный API ----------
  async function init() {
    if (typeof document === 'undefined' || typeof fetch === 'undefined') return;
    setStatus('checking');
    try {
      if (await loadFromIdb()) return;
    } catch (e) { /* idb недоступен — работаем без кеша */ }
    try {
      await loadFromLocalFolder();
      return;
    } catch (e) { /* папки нет — обычный случай */ }
    setStatus('missing');
  }

  async function download(onProgress) {
    if (status === 'loading') return;
    setStatus('loading');
    progress = { done: 0, total: 0 };
    emit();
    try {
      await downloadFromCdn(onProgress);
    } catch (e) {
      progress = null;
      setStatus('error');
      return false;
    }
    return true;
  }

  function clear() {
    // Откат: забыть кеш (для тестов и «Сбросить» в настройках не нужен —
    // шрифты безопасно держать всегда; функция на будущее)
    try { indexedDB.deleteDatabase(DB_NAME); } catch (e) { /* ignore */ }
    status = 'missing';
    source = null;
    emit();
  }

  return {
    init, download, clear,
    getStatus: () => status,
    getSource: () => source,
    getProgress: () => progress,
    FILES, CSS2_URL,
    // чистые функции для тестов
    rangesIntersect, parseUnicodeRange, parseCssFontFaces, USED_RANGES,
  };
})();

// Автозапуск при подключении скрипта
if (typeof document !== 'undefined') {
  GameFonts.init();
}

// ============================================================
//  UI: кнопка в меню + строка в настройках (v47-perf)
//  Модуль самодостаточен: сам находит свои элементы и сам
//  обновляет их по событию mahjong:fonts.
// ============================================================
(function (GF) {
  'use strict';
  if (typeof document === 'undefined') return;

  function texts(st, src, progress) {
    switch (st) {
      case 'checking':
        return { btn: '', note: 'Проверяем подключение шрифтов…', btnHidden: true };
      case 'missing':
        return {
          btn: 'Подключить фирменные шрифты',
          note: 'Игра использует системные шрифты. Кнопка скачает фирменные (Ma Shan Zheng, Noto Serif SC, Noto Sans SC, ZCOOL XiaoWei) из сети — один раз, дальше они живут в браузере и работают офлайн. Либо положите папку fonts/ рядом с index.html.',
          btnHidden: false,
        };
      case 'loading':
        return {
          btn: progress && progress.total
            ? `Загрузка шрифтов… ${progress.done}/${progress.total}`
            : 'Загрузка шрифтов…',
          note: 'Идёт докачка — обычно минута-другая.',
          btnHidden: false,
        };
      case 'error':
        return {
          btn: 'Повторить загрузку шрифтов',
          note: 'Не удалось скачать шрифты. Проверьте интернет и попробуйте ещё раз — или положите папку fonts/ рядом с index.html.',
          btnHidden: false,
        };
      case 'loaded':
      default:
        return {
          btn: '',
          note: src === 'local'
            ? 'Фирменные шрифты подключены из папки fonts/.'
            : src === 'cdn'
              ? 'Фирменные шрифты подключены (загружены из сети, работают офлайн).'
              : 'Фирменные шрифты подключены.',
          btnHidden: true,
        };
    }
  }

  function sync(detail) {
    const d = detail || { status: GF.getStatus(), source: GF.getSource(), progress: GF.getProgress() };
    const t = texts(d.status, d.source, d.progress);
    const menuBtn = document.getElementById('btn-fonts');
    const setBtn = document.getElementById('btn-fonts-settings');
    const note = document.getElementById('fonts-setting-status');
    if (menuBtn) {
      menuBtn.hidden = t.btnHidden;
      menuBtn.textContent = t.btn;
      menuBtn.disabled = d.status === 'loading';
    }
    if (setBtn) {
      setBtn.hidden = t.btnHidden;
      setBtn.textContent = t.btn;
      setBtn.disabled = d.status === 'loading';
    }
    if (note) note.textContent = t.note;
  }

  document.addEventListener('mahjong:fonts', e => sync(e.detail));
  sync();

  const onClick = e => {
    if (e.target && (e.target.id === 'btn-fonts' || e.target.id === 'btn-fonts-settings')) {
      GF.download();
    }
  };
  document.addEventListener('click', onClick);
})(GameFonts);
