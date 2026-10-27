// Browser check for the original BGM: menu theme starts after the first key press,
// game theme plays in-level, music stops on pause / B toggle, and real audio signal is produced.
// Usage: npm run dev, then node tools/playtest/music-check.cjs
require('fs').mkdirSync('test-artifacts', { recursive: true });
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:5173/');
  await sleep(1200);
  const state = () => p.evaluate(() => ({ playing: window.__music.playing, pos: window.__music.position }));
  // RMS level of the music bus over ~300 ms
  const level = () => p.evaluate(async () => {
    const a = window.__music.analyser();
    if (!a) return -1;
    const buf = new Float32Array(a.fftSize);
    let peak = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 30));
      a.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      peak = Math.max(peak, Math.sqrt(sum / buf.length));
    }
    return Number(peak.toFixed(4));
  });
  const out = {};
  out.beforeAnyKey = await state();
  await p.keyboard.press('1'); // any key = user gesture, also sets speed 1.0x
  await sleep(800);
  const m1 = await state(); await sleep(1000); const m2 = await state();
  out.menu = { playing: m1.playing, advanced: m2.pos !== m1.pos, rms: await level() };
  await p.keyboard.press('Enter');
  await sleep(1500);
  const g1 = await state(); await sleep(1000); const g2 = await state();
  out.game = { playing: g1.playing, advanced: g2.pos !== g1.pos, rms: await level() };
  await p.keyboard.press('Escape');
  await sleep(400);
  out.paused = { ...(await state()), rms: await level() };
  await p.keyboard.press('Escape');
  await sleep(500);
  out.resumed = (await state()).playing;
  await p.keyboard.press('b');
  await sleep(400);
  out.afterB = { ...(await state()), rms: await level() };
  await p.keyboard.press('b');
  await sleep(500);
  out.afterBAgain = (await state()).playing;
  await p.keyboard.press('4');
  await sleep(300);
  out.tempoAt2x = await p.evaluate(() => window.__music.tempo);
  await p.screenshot({ path: 'test-artifacts/music-ingame.png' });
  out.errors = errs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
