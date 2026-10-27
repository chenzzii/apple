// Browser playtest via REAL keyboard input. Usage: npm run dev, then (with Playwright + Chromium installed)
//   node tools/playtest/level01-win.cjs   (SPEED=1..4 picks world speed, default 4 = 2.0x)
// The bot only READS window.__orchard.sim to decide which keys to press; it never writes game state.
// Plays level 1 through REAL keyboard input (no state writes). Reads sim state only to decide keys.
require('fs').mkdirSync('test-artifacts', { recursive: true });
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://localhost:5173/');
  await sleep(1200);
  await p.keyboard.press(process.env.SPEED || '4'); // world speed
  await p.keyboard.press('Enter');
  await sleep(500);

  const held = new Set();
  async function hold(keys) {
    for (const k of [...held]) if (!keys.includes(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
  }
  async function tap(k) { await hold([]); await p.keyboard.down(k); await sleep(15); await p.keyboard.up(k); }
  const read = () => p.evaluate(() => {
    const s = window.__orchard.sim;
    return {
      status: s.status, score: s.score, lives: s.lives, time: s.timeLeftSec,
      p: { x: s.player.x, floor: s.player.floor, ladder: !!s.player.ladder, facing: s.player.facing },
      enemies: s.enemies.map((e) => ({ id: e.id, kind: e.kind, state: e.state, x: e.x, floor: e.floor, trapCol: e.trapCol, fallen: e.lastFallFloors })),
      h8: s.map.holeState(3, 8), h10: s.map.holeState(3, 10),
    };
  });

  const log = [];
  const shots = new Set();
  const shot = async (name) => { if (!shots.has(name)) { shots.add(name); await p.screenshot({ path: `test-artifacts/${name}.png` }); } };
  let prevStates = '';
  const t0 = Date.now();
  let sawWalk = false, sawClimb = false, sawDig = false, sawTrap = false, sawPound = false, sawFall = false, defeats = 0;
  let lastX = null;

  while (Date.now() - t0 < 240000) {
    const s = await read();
    const states = s.enemies.map((e) => `${e.id}:${e.state}`).join(',');
    if (states !== prevStates) { log.push(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${states} score=${s.score} lives=${s.lives}`); prevStates = states; }
    if (lastX !== null && Math.abs(s.p.x - lastX) > 0.5) sawWalk = true;
    lastX = s.p.x;
    if (s.p.ladder) { sawClimb = true; await shot('03-climbing'); }
    if (s.h8 === 'DIGGING' || s.h10 === 'DIGGING') { sawDig = true; await shot('04-digging'); }
    if (s.enemies.some((e) => e.state === 'TRAPPED')) { sawTrap = true; await shot('05-trapped'); }
    if (s.h8 === 'POUNDING' || s.h10 === 'POUNDING') { sawPound = true; await shot('06-pounding'); }
    if (s.enemies.some((e) => e.state === 'FALLING')) { sawFall = true; await shot('07-falling'); }
    defeats = s.enemies.filter((e) => e.state === 'DEFEATED').length;
    if (s.status === 'LEVEL_CLEAR' || s.status === 'GAME_OVER') { await hold([]); await sleep(400); await shot(s.status === 'LEVEL_CLEAR' ? '08-level-clear' : '08-game-over'); break; }
    if (s.status !== 'PLAYING') { await hold([]); await sleep(30); continue; }

    const { x, floor, ladder } = s.p;
    if (ladder) { await hold(['ArrowUp']); }
    else if (floor === 4) {
      if (x < 255) await hold(['ArrowRight']);
      else if (x > 265) await hold(['ArrowLeft']);
      else await hold(['ArrowUp']);
    } else if (floor === 3) {
      const trapped = s.enemies.find((e) => e.state === 'TRAPPED' && e.floor === 3 && (e.trapCol === 8 || e.trapCol === 10));
      if (x < 368) await hold(['ArrowRight']);
      else if (x > 392) await hold(['ArrowLeft']);
      else if (trapped) {
        const want = trapped.trapCol === 10 ? 1 : -1;
        await hold([want === 1 ? 'k' : 'j']); // same key pounds when an enemy is trapped there
      } else if (s.h10 !== 'OPEN' && s.h10 !== 'OCCUPIED') {
        await hold(['k']); // K = dig right
      } else if (s.h8 !== 'OPEN' && s.h8 !== 'OCCUPIED') {
        await hold(['j']); // J = dig left
      } else await hold([]);
    } else {
      // On another floor (should not happen in this plan): head down via any ladder by waiting.
      await hold([]);
    }
    await sleep(20);
  }
  const fin = await read();
  console.log(log.join('\n'));
  console.log(JSON.stringify({ final: { status: fin.status, score: fin.score, lives: fin.lives, timeLeft: Math.round(fin.time) }, sawWalk, sawClimb, sawDig, sawTrap, sawPound, sawFall, defeats, realSeconds: Math.round((Date.now() - t0) / 1000) }, null, 1));
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();
