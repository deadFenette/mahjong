/* ============================================================
   PERF.JS — «Лёгкий режим» для слабых компьютеров (v32)

   Подключается ПЕРВЫМ скриптом, в <head>, чтобы режим применился
   до первой отрисовки (иначе на слабом ПК успеет мелькнуть тяжёлое меню).

   Режим хранится в настройке «Графика» (mj_setting_perfMode):
     auto — решаем сами (по умолчанию)
     lite — лёгкий: без размытия, свечений, пыли, текстур
     full — полный: всё как задумано художником

   В режиме auto лёгкий включается, если:
   • система — Windows XP / Vista / 7 (Windows NT 5.x–6.1): их браузеры
     старые, а видеокарты чаще всего слабые или программные;
   • браузер старый (Chrome / Edge до 100);
   • процессор ≤ 2 ядер или памяти ≤ 2 ГБ (если браузер сообщает);
   • ИЛИ сторож кадров увидел, что игра идёт медленнее ~30 кадров/с.

   Сам режим — это атрибут <html data-perf="lite|full">; всё остальное
   делает CSS (раздел «v32: ЛЁГКИЙ РЕЖИМ» в main.css) и пара проверок
   в JS (пыль в меню, длина реверберации).
   ============================================================ */

const Perf = (function () {

  const SETTING_KEY = 'mj_setting_perfMode';
  const AUTO_KEY = 'mj_perf_auto_lite'; // сторож кадров решил, что нужен лёгкий
  const MODES = ['auto', 'lite', 'full'];

  // ---------- Чистая логика (проверяется тестами) ----------

  // Слабая ли среда — по User-Agent и данным о железе.
  // env: { ua, cores, memory }
  function isLowEnd(env) {
    const e = env || {};
    const ua = String(e.ua || '');
    // Windows NT 5.x (XP), 6.0 (Vista), 6.1 (7)
    if (/Windows NT (5\.\d|6\.[01])(?!\d)/.test(ua)) return true;
    // Старый Chrome / Edge
    const chrome = /(?:Chrome|Edg|CriOS)\/(\d+)/.exec(ua);
    if (chrome && Number(chrome[1]) < 100) return true;
    // Старый Firefox (до ESR 91)
    const ff = /Firefox\/(\d+)/.exec(ua);
    if (ff && Number(ff[1]) < 91) return true;
    if (Number(e.cores) > 0 && Number(e.cores) <= 2) return true;
    if (Number(e.memory) > 0 && Number(e.memory) <= 2) return true;
    return false;
  }

  function normalizeMode(v) {
    return MODES.indexOf(v) >= 0 ? v : 'auto';
  }

  // Итог: 'lite' или 'full'
  function resolve(mode, lowEnd, watchdogSaidLite) {
    const m = normalizeMode(mode);
    if (m === 'lite') return 'lite';
    if (m === 'full') return 'full';
    return (lowEnd || watchdogSaidLite) ? 'lite' : 'full';
  }

  // Средний FPS по списку интервалов между кадрами (мс)
  function fpsFromDeltas(deltas) {
    if (!deltas || !deltas.length) return 60;
    const total = deltas.reduce((a, b) => a + b, 0);
    return total > 0 ? (deltas.length / total) * 1000 : 60;
  }

  // ---------- Работа с браузером ----------
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }

  function env() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    return { ua: nav.userAgent, cores: nav.hardwareConcurrency, memory: nav.deviceMemory };
  }

  let current = 'full';

  function getMode() { return normalizeMode(read(SETTING_KEY)); }

  function apply() {
    current = resolve(getMode(), isLowEnd(env()), read(AUTO_KEY) === '1');
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-perf', current);
    }
    return current;
  }

  function setMode(mode) {
    write(SETTING_KEY, normalizeMode(mode));
    if (normalizeMode(mode) !== 'auto') write(AUTO_KEY, '0'); // выбор игрока важнее сторожа
    return apply();
  }

  const isLite = () => current === 'lite';

  // Сторож кадров: в режиме auto мерит FPS первые секунды в игре.
  // Если ниже порога — включает лёгкий режим и запоминает это.
  // Меряем только когда вкладка видна и только один раз за запуск.
  let watched = false;
  function watch(onSwitch) {
    if (watched || typeof requestAnimationFrame === 'undefined') return;
    if (getMode() !== 'auto' || current === 'lite') return;
    watched = true;
    const deltas = [];
    let last = 0;
    let start = 0;
    function tick(t) {
      if (typeof document !== 'undefined' && document.hidden) { last = 0; start = 0; deltas.length = 0; }
      else {
        if (!start) start = t;
        if (last && t - start > 800) deltas.push(t - last); // первые 0.8 с — прогрев
        last = t;
      }
      if (deltas.length < 120 && (!start || t - start < 6000)) { requestAnimationFrame(tick); return; }
      if (deltas.length >= 40 && fpsFromDeltas(deltas) < 30) {
        write(AUTO_KEY, '1');
        apply();
        if (typeof onSwitch === 'function') onSwitch();
      }
    }
    requestAnimationFrame(tick);
  }

  apply(); // применяем сразу при загрузке скрипта

  return { isLowEnd, resolve, normalizeMode, fpsFromDeltas, apply, setMode, getMode, isLite, watch, MODES };
})();
