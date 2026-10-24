/* ============================================================
   APP/GALLERY.JS — Галерея раскладок и миниатюры схем (v33)
   Часть бывшего js/app.js; общее состояние — App.state (см. core.js).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Галерея раскладок ----------
  function renderLayoutsGrid() {
    const grid = document.getElementById('layouts-grid');
    grid.innerHTML = '';
    // v9: сколько раз каждая раскладка собрана — золотой бейдж на карточке
    const winsByLayout = Storage.getStats().layouts || {};
    // v34: размер фишки на ЭТОМ экране для каждой раскладки — цена выбора
    // видна до начала партии. Порог «мелких» — 40 px, «крупных» — от 54 px.
    const est = {};
    const eo = {
      uiScale: A.optionTables.UI_K[A.getChoice('uiScale')],
      loupe: A.getToggle('loupe'),
    };
    Layouts.all.forEach(l => { est[l.id] = Render.estimateTileWidth(l, window.innerWidth, window.innerHeight, eo); });
    const bySize = Storage.getSetting('layoutsSort', false) === true;
    const btn = document.getElementById('layouts-sort');
    if (btn) btn.setAttribute('aria-pressed', bySize ? 'true' : 'false');
    const list = bySize
      ? Layouts.all.slice().sort((a, b) => est[b.id] - est[a.id])
      : Layouts.all;
    list.forEach((layout, index) => {
      const card = document.createElement('button');
      card.className = 'layout-card';
      card.style.setProperty('--i', index); // v8: каскад появления карточек
      const wins = Number(winsByLayout[layout.id]) || 0;
      card.innerHTML = `
        <div class="layout-preview" data-layout="${layout.id}">
          ${wins > 0 ? `<span class="layout-wins" title="Собрано раз: ${wins}">${Icons.get('check')} ${wins}</span>` : ''}
        </div>
        <div class="layout-info">
          <span class="layout-name">${layout.name}</span>
          <span class="layout-desc">${layout.description}</span>
          <span class="layout-meta">${layout.tilesCount} фишек · ${layout.layers} слоя</span>
          <span class="layout-size ${est[layout.id] >= 54 ? 'size-l' : est[layout.id] >= 40 ? 'size-m' : 'size-s'}">фишка ≈ ${est[layout.id]} px · ${est[layout.id] >= 54 ? 'крупно' : est[layout.id] >= 40 ? 'средне' : 'мелко'}</span>
        </div>
      `;
      card.addEventListener('click', () => A.startClassic(layout.id));
      grid.appendChild(card);
    });

    // Рисуем мини-превью для каждой раскладки
    setTimeout(() => {
      list.forEach(layout => {
        const preview = document.querySelector(`.layout-preview[data-layout="${layout.id}"]`);
        if (preview) drawLayoutPreview(preview, layout);
      });
    }, 50);
  }

  function drawLayoutPreview(container, layout, pad) {
    const m = pad === undefined ? 4 : pad; // отступ от краёв контейнера (v31)
    const w = container.clientWidth || 140;
    const h = container.clientHeight || 90;
    const layers = Math.max(1, layout.layers);
    const zOff = 3; // подъём слоя в превью

    // Резервируем место под подъём верхних слоёв, иначе они обрезаются
    const availW = w - 2 * m;
    const availH = h - 2 * m - (layers - 1) * zOff;
    const tileW = Math.max(3, Math.min(availW / layout.width, (availH / layout.height) / 1.4));
    const tileH = tileW * 1.4;
    const gap = Math.max(0.5, tileW * 0.06);

    const boardW = layout.width * (tileW + gap) - gap;
    const boardH = layout.height * (tileH + gap) - gap;
    const liftTotal = (layers - 1) * zOff;
    const offsetX = (w - boardW) / 2;
    // Блок целиком (вместе с подъёмом) центрируем по вертикали
    const offsetY = (h - boardH - liftTotal) / 2 + liftTotal;

    // v9: стираем только мини-фишки — бейдж «✓ N» внутри превью
    // должен переживать перерисовку (первый показ и resize)
    container.querySelectorAll('.preview-tile').forEach(d => d.remove());
    // Сортируем по z, y, x — нижние рисуются раньше верхних
    const sorted = layout.positions.slice().sort((a, b) =>
      a.z - b.z || a.y - b.y || a.x - b.x);
    sorted.forEach(p => {
      const dot = document.createElement('div');
      dot.className = 'preview-tile';
      dot.dataset.z = p.z; // v31: для затенения слоёв в превью микса
      dot.style.width = tileW + 'px';
      dot.style.height = tileH + 'px';
      dot.style.left = (offsetX + p.x * (tileW + gap)) + 'px';
      dot.style.top = (offsetY + p.y * (tileH + gap) - p.z * zOff) + 'px';
      dot.style.zIndex = (p.z + 1) * 100 + Math.round(p.y * 2);
      container.appendChild(dot);
    });
  }

  Object.assign(A, {
    drawLayoutPreview,
    renderLayoutsGrid,
  });
})(App);
