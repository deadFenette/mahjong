/* ============================================================
   APP/SKINS.JS — Выбор скина фишек: карточки, применение (v44)

   Вынесено из settings.js. Сами скины и их список живут в реестре
   Tileset (js/tileset.js, файлы js/skins/*.js); здесь только то, что
   нужно интерфейсу:
     • карточки в «Настройки → Скин фишек» рисуются ИЗ РЕЕСТРА
       (Tileset.SKINS) — HTML больше не знает названий скинов;
     • применение скина: запись настройки, перерисовка доски на лету,
       уведомление превью;
     • образцы лиц на карточках (три фишки из каждого скина).
   Новый скин появляется на карточках сам, ничего здесь править не нужно.
   ============================================================ */

(function (A) {
  'use strict';

  const PICKER_ID = 'skin-picker';

  // Скин из настройки, а если такого уже нет (удалили файл) — по умолчанию
  function resolve(id) {
    return Tileset.SKINS.some(k => k.id === id) ? id : Tileset.defaultSkinId();
  }

  // ---------- Карточки ----------
  function buildSkinCards() {
    const box = document.getElementById(PICKER_ID);
    if (!box) return;
    const active = Tileset.activeSkinId();
    box.textContent = '';
    Tileset.SKINS.forEach(skin => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'skin-card' + (skin.id === active ? ' active' : '');
      card.dataset.skin = skin.id;
      card.innerHTML =
        '<span class="skin-sample" aria-hidden="true"></span>' +
        '<span class="skin-name"></span>' +
        '<span class="skin-desc"></span>';
      // названия — textContent: имя скина может прийти из чужого файла
      card.querySelector('.skin-name').textContent = skin.name;
      card.querySelector('.skin-desc').textContent = skin.desc;
      box.appendChild(card);
    });
    renderSkinSamples();
  }

  // ---------- Образцы лиц на карточках ----------
  // Три лица из каждого скина — чтобы выбирать глазами, а не по названию.
  // id градиентов внутри SVG делаем уникальными (как Render.makeFaceUnique).
  function renderSkinSamples() {
    document.querySelectorAll('.skin-card').forEach(card => {
      const box = card.querySelector('.skin-sample');
      if (!box) return;
      const id = card.dataset.skin;
      box.innerHTML = Tileset.sampleFaces(id).map((face, i) => {
        const key = 'sk' + id + i;
        const f = face
          .replace(/id="([A-Za-z0-9_-]+)"/g, (m, x) => 'id="' + x + '-' + key + '"')
          .replace(/url\(#([A-Za-z0-9_-]+)\)/g, (m, x) => 'url(#' + x + '-' + key + ')');
        return '<span class="skin-sample-tile">' + f + '</span>';
      }).join('');
    });
  }

  // ---------- Применить скин ----------
  // Записывает настройку в Storage и ПЕРЕРИСОВЫВАЕТ доску на лету — даже
  // посреди партии. Фасад Tileset читает Storage при каждом доступе к .tiles,
  // поэтому Render.renderFull() сразу видит новый скин.
  // opts.silent = true — без toast (так вызывается при старте приложения).
  function applyTileSkin(skin, opts) {
    skin = resolve(skin);
    const known = Tileset.SKINS.find(k => k.id === skin);
    Storage.setSetting('tileSkin', skin);
    document.querySelectorAll('.skin-card').forEach(c => {
      c.classList.toggle('active', c.dataset.skin === skin);
    });
    if (A.state.currentScreen === 'game') {
      // fitBoard не нужен — размер фишек не меняется, только их лица
      Render.renderFull();
      Render.highlightFree(Storage.getSetting('highlight', true));
    }
    A.notifySettings('tileSkin', skin); // превью перерисует лица
    if (!opts || !opts.silent) A.toast('Скин фишек: ' + (known ? known.name : skin));
  }

  // Делегирование: карточки пересоздаются, обработчик один на контейнер
  function initSkinPicker() {
    const box = document.getElementById(PICKER_ID);
    if (!box) return;
    buildSkinCards();
    box.addEventListener('click', e => {
      const card = e.target.closest && e.target.closest('.skin-card');
      if (!card) return;
      A.smoothChange(() => A.applyTileSkin(card.dataset.skin));
    });
  }

  Object.assign(A, { applyTileSkin, renderSkinSamples, initSkinPicker, buildSkinCards });
})(App);
