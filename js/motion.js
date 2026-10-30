/* ============================================================
   MOTION.JS — Настройки анимаций (v44 «Шёлк»)

   Один источник правды о том, ЧТО в игре может двигаться:
     • общий выключатель «Анимации» (master);
     • семь категорий эффектов (раздача, выбор, пара, подсказки,
       перемешивание, праздник, живой фон) — у каждой свой тумблер;
     • стиль перехода между экранами: curtain | fade | none.

   Подключается в <head> сразу после perf.js — как и «Графика»,
   чтобы флаги легли на <html> ДО первой отрисовки (иначе у
   игрока, выключившего анимации, они бы мелькнули при загрузке).
   Поэтому читаем localStorage напрямую (Storage ещё не загружен);
   формат ключей тот же: mj_setting_<имя> = 'true' | 'false' | строка.

   Результат применения — атрибуты <html>:
     data-anim="on|off"            — итог по общему выключателю;
     data-fx-<категория>="on|off"  — итог по каждой категории;
     data-tr="curtain|fade|none"   — итоговый стиль перехода.
   «Итог» учитывает prefers-reduced-motion: если система просит
   меньше движения, всё гасится, что бы ни стояло в настройках.
   CSS читает эти атрибуты (motion.css), JS — Motion.isOn(id).

   Чистая логика (resolve, normalize) проверяется тестами в Node.
   ============================================================ */

const Motion = (function () {
  'use strict';

  const KEY_MASTER = 'mj_setting_animMaster';
  const KEY_TRANSITION = 'mj_setting_screenFx';
  const keyFx = id => 'mj_setting_fx_' + id;

  // Категории — порядок = порядок тумблеров в настройках
  const FX = [
    { id: 'deal',      name: 'Раздача фишек',       desc: 'Фишки падают на доску волной' },
    { id: 'select',    name: 'Выбор и наведение',   desc: 'Пружинка и блик на фишке, «нажатие», отклик кнопок' },
    { id: 'match',     name: 'Эффекты пары',        desc: 'Сближение, кольцо, искры и «+N» при сборе пары' },
    { id: 'camera',    name: 'Приближение стола',   desc: 'Фишки плавно подрастают внутри стола, когда доска пустеет' },
    { id: 'hint',      name: 'Подсказки',           desc: 'Дыхание фишек и бегущая линия между ними' },
    { id: 'shuffle',   name: 'Перемешивание',       desc: 'Разлёт фишек и толчок стола' },
    { id: 'celebrate', name: 'Праздник',            desc: 'Всплывающее «Комбо», дождь победы, штамп ачивки, накат чисел' },
    { id: 'ambient',   name: 'Живой фон',           desc: 'Пыль, облака и фонарики в меню; медленное проявление медальона на столе' },
  ];
  const FX_IDS = FX.map(f => f.id);

  const TRANSITIONS = [
    { id: 'fade',    name: 'Плавно',   desc: 'Мягкое растворение и лёгкий сдвиг' },
    { id: 'curtain', name: 'Занавес',  desc: 'Лаковые шторки с печатью — как раньше' },
    { id: 'none',    name: 'Мгновенно', desc: 'Без перехода' },
  ];
  const TR_IDS = TRANSITIONS.map(t => t.id);
  const TR_DEFAULT = 'fade';   // v44: красный занавес между экранами утомлял — по умолчанию «Плавно»

  // Готовые наборы — быстрый выбор в настройках
  //   all   — всё включено;
  //   calm  — без «резкого»: тряска, разлёт, виньетка, дождь, искры
  //           (остаётся мягкое: раздача, выбор, подсказки);
  //   off   — всё выключено.
  const PRESETS = {
    all:  { master: true,  transition: 'fade', fx: { deal: true,  select: true,  match: true,  camera: true,  hint: true,  shuffle: true,  celebrate: true,  ambient: true  } },
    calm: { master: true,  transition: 'fade',    fx: { deal: true,  select: true,  match: false, camera: false, hint: true,  shuffle: false, celebrate: false, ambient: false } },
    off:  { master: false, transition: 'none',    fx: { deal: false, select: false, match: false, camera: false, hint: false, shuffle: false, celebrate: false, ambient: false } },
  };

  // ---------- Чистая логика (проверяется тестами) ----------

  function normalizeBool(v, def) {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return def;
  }

  function normalizeTransition(v) {
    return TR_IDS.indexOf(v) >= 0 ? v : TR_DEFAULT;
  }

  // raw: { master, transition, fx: {id: any} } — как лежит в хранилище (мусор допустим)
  // → чистая запись настроек
  function normalize(raw) {
    const r = raw || {};
    const fx = {};
    FX_IDS.forEach(id => { fx[id] = normalizeBool(r.fx && r.fx[id], true); });
    return {
      master: normalizeBool(r.master, true),
      transition: normalizeTransition(r.transition),
      fx,
    };
  }

  // Итог для DOM и кода: настройки + среда (env.reduced — системная просьба
  // «меньше движения»). Если анимации выключены или система просит покой —
  // гаснет всё, включая переход между экранами.
  function resolve(settings, env) {
    const s = normalize(settings);
    const reduced = !!(env && env.reduced);
    const on = s.master && !reduced;
    const fx = {};
    FX_IDS.forEach(id => { fx[id] = on && s.fx[id]; });
    return {
      master: on,
      reduced,
      fx,
      transition: on ? s.transition : 'none',
    };
  }

  // ---------- Работа с браузером ----------
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* приватный режим */ }
  }

  function reducedNow() {
    try {
      return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  // Что хранится у игрока (без учёта системы)
  function load() {
    const raw = { master: read(KEY_MASTER), transition: read(KEY_TRANSITION), fx: {} };
    FX_IDS.forEach(id => { raw.fx[id] = read(keyFx(id)); });
    return normalize(raw);
  }

  let current = resolve(load(), { reduced: reducedNow() });

  function apply() {
    current = resolve(load(), { reduced: reducedNow() });
    if (typeof document !== 'undefined' && document.documentElement) {
      const h = document.documentElement;
      h.setAttribute('data-anim', current.master ? 'on' : 'off');
      FX_IDS.forEach(id => h.setAttribute('data-fx-' + id, current.fx[id] ? 'on' : 'off'));
      h.setAttribute('data-tr', current.transition);
    }
    try {
      if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
        document.dispatchEvent(new CustomEvent('motionchange', { detail: current }));
      }
    } catch (e) { /* событие — удобство, не необходимость */ }
    return current;
  }

  // ---------- Запросы ----------
  // Включена ли категория (с учётом общего выключателя и системы)
  function isOn(id) { return !!current.fx[id]; }
  function masterOn() { return !!current.master; }
  function transition() { return current.transition; }
  // Что выбрал игрок (без учёта системы) — для тумблеров в настройках
  function stored() { return load(); }
  function systemReduced() { return reducedNow(); }

  // ---------- Изменения ----------
  function setMaster(v) { write(KEY_MASTER, !!v); return apply(); }
  function setFx(id, v) {
    if (FX_IDS.indexOf(id) < 0) return current;
    write(keyFx(id), !!v);
    return apply();
  }
  function setTransition(v) { write(KEY_TRANSITION, normalizeTransition(v)); return apply(); }
  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return current;
    write(KEY_MASTER, p.master);
    write(KEY_TRANSITION, p.transition);
    FX_IDS.forEach(id => write(keyFx(id), p.fx[id]));
    return apply();
  }
  // Какой пресет совпадает с текущими настройками (или '' — «свои»)
  function matchPreset(settings) {
    const s = normalize(settings || load());
    const names = Object.keys(PRESETS);
    for (let i = 0; i < names.length; i++) {
      const p = normalize(PRESETS[names[i]]);
      // у выключенного набора остальное не важно — он «off», пока master выключен
      if (!s.master && !p.master) return names[i];
      if (s.master === p.master && s.transition === p.transition &&
          FX_IDS.every(id => s.fx[id] === p.fx[id])) return names[i];
    }
    return '';
  }

  // Следим за системной настройкой на лету (игрок включил «уменьшить движение»)
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = () => apply();
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch (e) { /* без слежки — не страшно */ }

  apply(); // сразу при загрузке скрипта (в <head>)

  return {
    FX, FX_IDS, TRANSITIONS, PRESETS,
    normalize, resolve,
    apply, isOn, masterOn, transition, stored, systemReduced,
    setMaster, setFx, setTransition, applyPreset, matchPreset,
  };
})();
