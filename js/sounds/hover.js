/* ============================================================
   SOUNDS/HOVER.JS — Наведение на фишку
   Мягкий «деревянный ток»: 660 Hz sine (E5) + 220 Hz triangle (A3).
   Троттлинг 60 мс — на быстром движении мыши звуки не сливаются.
   На тач-устройствах mouseenter не срабатывает.
   ============================================================ */

Sounds.hover = {
  name: 'Наведение',
  desc: 'Деревянный ток при наведении мышью на фишку',
  // Внутренний троттлинг — не чаще 60 мс
  _lastAt: 0,
  play: function (ctx, playTone) {
    const now = Date.now();
    if (now - Sounds.hover._lastAt < 60) return;
    Sounds.hover._lastAt = now;

    // Hover использует кастомные осцилляторы (не playTone) для
    // более точного контроля атаки/затухания
    if (!ctx) return;
    const t0 = ctx.currentTime;

    // Основной тон — тёплый sine, мягкая атака 8ms, затухание 65ms
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 660;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0, t0);
    g1.gain.linearRampToValueAtTime(0.022, t0 + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.065);
    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.08);

    // Тихий низкий обертон — «деревянность», 220 Hz
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 220;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(0.010, t0 + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.05);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(t0);
    osc2.stop(t0 + 0.06);
  },
};
