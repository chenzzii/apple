// Browser playthrough of level 2 via REAL keyboard input.
// The decision logic is the same AmbushBot used by the unit tests (tests/ambushBot.ts), loaded
// in the page through the Vite dev server; it only READS window.__orchard.sim, and this script
// turns its decisions into real key presses (arrows, J, K).
// Usage: npm run dev, then node tools/playtest/level02-win.cjs
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
  await p.waitForFunction(() => window.__game && window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 });
  await sleep(800);
  await p.keyboard.press('1'); // 1.0x
  await sleep(300);
  for (let i = 0; i < 5; i++) {
    await p.keyboard.press('KeyL'); // start level -> level 2
    await sleep(400);
    if (await p.evaluate(() => window.__game.scene.getScene('MenuScene').startIdx === 1)) break;
  }
  await sleep(300);
  await p.screenshot({ path: 'test-artifacts/l2-menu.png' });
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__orchard && window.__orchard.sim.level.id === 'level02');
  await sleep(300);
  await p.screenshot({ path: 'test-artifacts/l2-ready.png' });
  await p.evaluate(async () => {
    const m = await import('/tests/ambushBot.ts');
    window.__bot = new m.AmbushBot(9, 0, 1, 1);
  });
  const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', digLeftHeld: 'j', digRightHeld: 'k' };
  const held = new Set();
  const t0 = Date.now();
  let prev = '';
  const log = [];
  let shotTrap = false;
  let attempts = 1;
  const MAX_ATTEMPTS = 8;
  while (Date.now() - t0 < 1500000) {
    const r = await p.evaluate(() => {
      const s = window.__orchard.sim;
      const d = s.status === 'PLAYING' ? window.__bot.decide(s) : {};
      return {
        d, status: s.status, score: s.score, lives: s.lives,
        en: s.enemies.map((e) => `${e.kind}:${e.state}:f${e.floor}:fell${e.lastFallFloors}`).join(' '),
      };
    });
    const sig = `${r.en} score=${r.score} lives=${r.lives}`;
    if (sig !== prev) { log.push(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${sig}`); prev = sig; }
    if (!shotTrap && /green:TRAPPED/.test(r.en)) { shotTrap = true; await p.screenshot({ path: 'test-artifacts/l2-green-trapped.png' }); }
    if (r.status === 'LEVEL_CLEAR') break;
    if (r.status === 'GAME_OVER') {
      // Like a player: retry the level (Enter on the GAME OVER screen) and keep a count.
      if (attempts >= MAX_ATTEMPTS) break;
      for (const k of held) await p.keyboard.up(k);
      held.clear();
      await sleep(400);
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => window.__orchard.sim.status !== 'GAME_OVER');
      await p.evaluate(async () => { const m = await import('/tests/ambushBot.ts'); window.__bot = new m.AmbushBot(9, 0, 1, 1); });
      attempts++;
      log.push(`--- attempt ${attempts}`);
      continue;
    }
    const want = new Set(Object.entries(KEYS).filter(([k]) => r.d[k]).map(([, v]) => v));
    for (const k of [...held]) if (!want.has(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
    await sleep(15);
  }
  for (const k of held) await p.keyboard.up(k);
  await sleep(500);
  await p.screenshot({ path: 'test-artifacts/l2-end.png' });
  const fin = await p.evaluate(() => ({ status: window.__orchard.sim.status, score: window.__orchard.sim.score, lives: window.__orchard.sim.lives }));
  console.log(log.filter((l) => /attempt|green:DEFEATED|LEVEL/.test(l)).slice(-20).join('\n'));
  console.log(JSON.stringify({ final: fin, attempts, realSeconds: Math.round((Date.now() - t0) / 1000), errors: errs }, null, 1));
  await b.close();
})();
