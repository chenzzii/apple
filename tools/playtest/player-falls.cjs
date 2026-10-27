// Browser check via REAL keyboard: in the mechanics level, dig right with K (6 pulses),
// then walk right onto the hole. The col-10 shaft has preset holes on floors 1 and 2,
// so the gardener should drop straight from floor 0 to floor 3 without losing a life.
// Usage: npm run dev, then node tools/playtest/player-falls.cjs
require('fs').mkdirSync('test-artifacts', { recursive: true });
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:5173/');
  await sleep(1000);
  await p.keyboard.press('1'); // 1.0x so the timing is easy to follow
  await p.keyboard.press('KeyT');
  const read = () => p.evaluate(() => { const s = window.__orchard.sim; return { status: s.status, x: s.player.x, floor: s.player.floor, state: s.player.state, lives: s.lives, h: s.map.holeState(0, 10) }; });
  await p.waitForFunction(() => window.__orchard && window.__orchard.sim.status === 'PLAYING');
  const start = await read();
  for (let i = 0; i < 6; i++) { await p.keyboard.press('k'); await sleep(180); }
  const afterDig = await read();
  await p.screenshot({ path: 'test-artifacts/fall-01-dug.png' });
  await p.keyboard.down('ArrowRight');
  let sawFalling = false;
  for (let i = 0; i < 100; i++) {
    const s = await read();
    if (s.state === 'FALLING' && !sawFalling) { sawFalling = true; await p.keyboard.up('ArrowRight'); await p.screenshot({ path: 'test-artifacts/fall-02-falling.png' }); }
    if (sawFalling && s.state !== 'FALLING') break;
    await sleep(30);
  }
  await p.keyboard.up('ArrowRight');
  await sleep(300);
  const end = await read();
  await p.screenshot({ path: 'test-artifacts/fall-03-landed.png' });
  console.log(JSON.stringify({ start, afterDig, sawFalling, end, errors: errs }, null, 1));
  await b.close();
})();
