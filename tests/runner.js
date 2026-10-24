/* ============================================================
   TESTS/RUNNER.JS — Мини-фреймворк тестов без зависимостей
   Запуск: node tests/run.js
   ============================================================ */

'use strict';

const results = { passed: 0, failed: 0, suites: [] };
const suiteStack = [];
let currentPrefix = '';

function currentSuite() {
  return suiteStack.length ? suiteStack[suiteStack.length - 1] : null;
}

function suite(name, fn) {
  const s = { name, tests: [], passed: 0, failed: 0 };
  results.suites.push(s);
  const parentPrefix = currentPrefix;
  suiteStack.push(s);
  currentPrefix = parentPrefix + name + ' › ';
  fn();
  suiteStack.pop();
  currentPrefix = parentPrefix;
}

function test(name, fn) {
  const full = currentPrefix + name;
  const s = currentSuite();
  const started = process.hrtime.bigint();
  try {
    fn();
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    s.tests.push({ name: full, ok: true, ms });
    results.passed++;
    s.passed++;
  } catch (err) {
    s.tests.push({ name: full, ok: false, error: err, ms: 0 });
    results.failed++;
    s.failed++;
  }
}

// ---------- Ассерты ----------
function assertOk(cond, msg) {
  if (!cond) throw new Error(msg || 'expected truthy, got ' + String(cond));
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error((msg || 'assertEq failed') +
      `\n  actual:   ${a}\n  expected: ${b}`);
  }
}

function assertAlmostEq(actual, expected, eps, msg) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error((msg || 'assertAlmostEq failed') +
      `\n  actual:   ${actual}\n  expected: ${expected} (±${eps})`);
  }
}

function assertGt(a, b, msg) {
  if (!(a > b)) throw new Error(msg || `expected ${a} > ${b}`);
}

function assertGte(a, b, msg) {
  if (!(a >= b)) throw new Error(msg || `expected ${a} >= ${b}`);
}

function assertLte(a, b, msg) {
  if (!(a <= b)) throw new Error(msg || `expected ${a} <= ${b}`);
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(msg || 'expected function to throw');
}

// ---------- Итоги ----------
function report() {
  let totalMs = 0;
  for (const s of results.suites) {
    if (s.tests.length === 0) continue; // пустые родительские suite не печатаем
    console.log('\n▶ ' + s.name);
    for (const t of s.tests) {
      totalMs += t.ms;
      if (t.ok) {
        console.log(`  ✔ ${t.name} (${t.ms.toFixed(1)} ms)`);
      } else {
        console.log(`  ✘ ${t.name}`);
        console.log('    ' + String(t.error && t.error.message).split('\n').join('\n    '));
      }
    }
    const mark = s.failed === 0 ? 'OK' : 'FAIL';
    console.log(`  — ${mark}: ${s.passed} passed, ${s.failed} failed`);
  }
  console.log('\n' + '='.repeat(52));
  console.log(`ИТОГО: ${results.passed} passed, ${results.failed} failed` +
    ` (${totalMs.toFixed(0)} ms)`);
  console.log('='.repeat(52));
  return results.failed === 0;
}

module.exports = {
  suite, test,
  assertOk, assertEq, assertAlmostEq, assertGt, assertGte, assertLte, assertThrows,
  report,
};
