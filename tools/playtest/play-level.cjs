// Browser playthrough of any campaign level via REAL keyboard input.
// Decisions come from the same AmbushBot + spot table the unit tests use (loaded in the page via the
// Vite dev server); it only READS window.__orchard.sim and this script turns them into key presses.
// Usage: npm run dev, then  LEVEL=level06 node tools/playtest/play-level.cjs   (MAX_ATTEMPTS=8 default)
require('fs').mkdirSync('test-artifacts', { recursive: true });
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LEVEL = process.env.LEVEL || 'level01';
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 8);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => window.__game && window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 });
  await sleep(800);
  await p.keyboard.press('1'); // world speed 1.0x
  await sleep(300);
  const target = Number(LEVEL.slice(5)) - 1;
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate((t) => window.__game.scene.getScene('MenuScene').startIdx === t, target)) break;
    await p.keyboard.press('KeyL'); // cycle start level
    await sleep(250);
  }
  await p.keyboard.press('Enter');
  await p.waitForFunction((id) => window.__orchard && window.__orchard.sim.level.id === id, LEVEL);
  await sleep(300);
  await p.screenshot({ path: `test-artifacts/${LEVEL}-ready.png` });
  const makeBot = () => p.evaluate(async (id) => {
    const m = await import('/tests/ambushBot.ts');
    const s = await import('/tests/levelSpots.ts');
    const [col, up, side, depth = 2] = s.SPOT[id];
    window.__bot = new m.AmbushBot(col, up, up + depth - 1, side);
  }, LEVEL);
  await makeBot();
  const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', digLeftHeld: 'j', digRightHeld: 'k' };
  const held = new Set();
  const t0 = Date.now();
  let attempts = 1;
  let shot = false;
  while (Date.now() - t0 < 1500000) {
    const r = await p.evaluate(() => {
      const s = window.__orchard.sim;
      return { d: s.status === 'PLAYING' ? window.__bot.decide(s) : {}, status: s.status, trapped: s.enemies.some((e) => e.state === 'TRAPPED') };
    });
    if (!shot && r.trapped) { shot = true; await p.screenshot({ path: `test-artifacts/${LEVEL}-trapped.png` }); }
    if (r.status === 'LEVEL_CLEAR') break;
    if (r.status === 'GAME_OVER') {
      if (attempts >= MAX_ATTEMPTS) break;
      for (const k of held) await p.keyboard.up(k);
      held.clear();
      await sleep(400);
      await p.keyboard.press('Enter'); // retry, like a player
      await p.waitForFunction(() => window.__orchard.sim.status !== 'GAME_OVER');
      await makeBot();
      attempts++;
      continue;
    }
    const want = new Set(Object.entries(KEYS).filter(([k]) => r.d[k]).map(([, v]) => v));
    for (const k of [...held]) if (!want.has(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
    await sleep(15);
  }
  for (const k of held) await p.keyboard.up(k);
  await sleep(500);
  await p.screenshot({ path: `test-artifacts/${LEVEL}-end.png` });
  const fin = await p.evaluate(() => {
    const s = window.__orchard.sim;
    return { level: s.level.id, status: s.status, score: s.score, lives: s.lives, enemies: s.enemies.map((e) => `${e.kind}:${e.state}:fell${e.lastFallFloors}`) };
  });
  console.log(JSON.stringify({ ...fin, attempts, realSeconds: Math.round((Date.now() - t0) / 1000), errors: errs }));
  await b.close();
})();
