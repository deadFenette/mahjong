/* ============================================================
   TESTS/MENU.TEST.JS — Новый главный экран и масштаб в игре (v14)
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assertOk } = require('./runner');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const menuCss = fs.readFileSync(path.join(ROOT, 'css/menu.css'), 'utf8');
const mainCss = fs.readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

suite('Главное меню (v14) — id, на которые завязан app.js', () => {
  ['btn-continue', 'btn-classic', 'btn-endless', 'btn-daily', 'btn-mix', 'btn-tutorial', 'btn-settings',
   'stat-played', 'stat-won', 'stat-best', 'stat-best-time', 'menu-dust'].forEach(id => {
    test(`есть #${id}`, () => assertOk(html.includes(`id="${id}"`), `нет #${id}`));
  });
  test('«Продолжить» скрыта по умолчанию', () => {
    assertOk(/id="btn-continue" hidden/.test(html));
  });
  test('menu.css подключён и закэширован service worker-ом', () => {
    assertOk(html.includes('css/menu.css'));
    assertOk(sw.includes("'./css/menu.css'"));
  });
  test('старый декор убран (лепестки, облака, кисточки)', () => {
    assertOk(!html.includes('petals-container') && !html.includes('menu-clouds') && !html.includes('brush-line'));
    assertOk(!/initPetals/.test(app));
    assertOk(!mainCss.includes('.petal'));
  });
  test('есть стили для телефона и фокуса с клавиатуры', () => {
    assertOk(menuCss.includes('@media (max-width: 640px)'));
    assertOk(menuCss.includes(':focus-visible'));
  });
  test('меню не обрезается сверху: нет justify-content:center на экране', () => {
    assertOk(/#screen-menu\s*\{[^}]*justify-content:\s*flex-start/.test(menuCss));
  });
});

suite('Масштаб фишек в игре (v14)', () => {
  test('кнопка #btn-zoom в шапке игры', () => {
    assertOk(html.includes('id="btn-zoom"'));
  });
  test('app.js подключает кнопку и клавиши +/−', () => {
    assertOk(app.includes("getElementById('btn-zoom')"));
    assertOk(app.includes("e.key === '+'") && app.includes("e.key === '-'"));
  });
});

suite('Кастомный confirm overlay (v20)', () => {

  test('overlay #confirm-overlay есть в index.html', () => {
    assertOk(html.includes('id="confirm-overlay"'), 'должен быть #confirm-overlay');
    assertOk(html.includes('id="confirm-title"'), 'должен быть #confirm-title');
    assertOk(html.includes('id="confirm-message"'), 'должен быть #confirm-message');
    assertOk(html.includes('id="confirm-ok"'), 'должна быть кнопка #confirm-ok');
    assertOk(html.includes('id="confirm-cancel"'), 'должна быть кнопка #confirm-cancel');
  });

  test('overlay имеет роль dialog и aria-modal', () => {
    assertOk(html.includes('role="dialog"'), 'должна быть role="dialog"');
    assertOk(html.includes('aria-modal="true"'), 'должно быть aria-modal="true"');
  });

  test('app.js содержит showConfirm() и использует его вместо confirm()', () => {
    assertOk(/function\s+showConfirm\s*\(/.test(app), 'showConfirm должна быть определена');
    assertOk(/showConfirm\(\{/.test(app), 'showConfirm должна вызываться с opts');
    assertOk(app.includes('Сбросить статистику?'), 'должен быть вызов для сброса');
    assertOk(app.includes('danger: true'), 'должна быть danger-кнопка');
    // Старый нативный confirm должен быть убран из хендлера сброса
    assertOk(!/if\s*\(confirm\(['"]Сбросить/.test(app),
      'нативный confirm("Сбросить...") должен быть убран');
  });

  test('CSS содержит стили для confirm-card и btn-danger', () => {
    assertOk(mainCss.includes('.confirm-card'), 'должен быть .confirm-card');
    assertOk(mainCss.includes('.confirm-title'), 'должен быть .confirm-title');
    assertOk(mainCss.includes('.confirm-message'), 'должен быть .confirm-message');
    assertOk(mainCss.includes('.confirm-actions'), 'должен быть .confirm-actions');
    assertOk(mainCss.includes('.btn-danger'), 'должна быть .btn-danger');
  });
});
