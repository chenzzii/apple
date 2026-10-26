// Browser checks via REAL keyboard input: speed, pause, (simulated) tab hide, help, loss + retry,
// and a full clear of the mechanics test level (green 2-floor / blue 3-floor kills).
// Usage: npm run dev, then node tools/playtest/checks-and-mechanics.cjs
const { chromium } = require('playwright');
require('fs').mkdirSync('test-artifacts', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://localhost:5173/');
  await sleep(1200);
  const held = new Set();
  async function hold(keys) {
    for (const k of [...held]) if (!keys.includes(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
  }
  async function tap(k) { await hold([]); await p.keyboard.down(k); await sleep(15); await p.keyboard.up(k); }
  const read = () => p.evaluate(() => {
    const s = window.__orchard.sim;
    return {
      status: s.status, score: s.score, lives: s.lives, steps: s.stepCount, paused: window.__orchard.scene.clock.paused,
      speed: window.__orchard.scene.clock.speed,
      p: { x: s.player.x, floor: s.player.floor, ladder: s.player.ladder, facing: s.player.facing },
      ladders: s.level.ladders, floorY: s.level.floorY,
      enemies: s.enemies.map((e) => ({ id: e.id, kind: e.kind, state: e.state, x: e.x, floor: e.floor, trapCol: e.trapCol, fallen: e.lastFallFloors })),
    };
  });
  const cc = (c) => c * 40 + 20;
  // generic navigation, returns true when at target
  async function nav(s, tf, tx, tol = 10) {
    const { x, floor, ladder } = s.p;
    if (ladder) { await hold([tf < floor || (ladder && s.p.floor === ladder.bottom && tf <= ladder.top) ? 'ArrowUp' : 'ArrowDown']); return false; }
    if (floor === tf) {
      if (x < tx - tol) await hold(['ArrowRight']);
      else if (x > tx + tol) await hold(['ArrowLeft']);
      else { await hold([]); return true; }
      return false;
    }
    const up = tf < floor;
    const cands = s.ladders.filter((l) => (up ? l.bottom === floor : l.top === floor));
    cands.sort((a, b) => Math.abs(cc(a.col) - x) - Math.abs(cc(b.col) - x));
    const l = cands[0];
    if (Math.abs(x - cc(l.col)) > 8) await hold([x < cc(l.col) ? 'ArrowRight' : 'ArrowLeft']);
    else await hold([up ? 'ArrowUp' : 'ArrowDown']);
    return false;
  }

  // ---------- A. speed / pause / tab-hidden checks on level 1
  await p.keyboard.press('1');
  await p.keyboard.press('Enter');
  await sleep(800);
  let a = await read(); await sleep(2000); let bb = await read();
  out.stepsPerSec_1x = Math.round((bb.steps - a.steps) / 2);
  await p.keyboard.press('4');
  a = await read(); await sleep(2000); bb = await read();
  out.stepsPerSec_2x = Math.round((bb.steps - a.steps) / 2);
  await p.keyboard.press('Escape');
  await sleep(300);
  a = await read(); await sleep(1500); bb = await read();
  out.pause = { paused: bb.paused, stepsDuringPause: bb.steps - a.steps };
  await p.screenshot({ path: 'test-artifacts/09-paused.png' });
  await p.keyboard.press('Escape');
  await sleep(300);
  // tab hidden: headless Chromium does not flip document.hidden on tab switch, so simulate the
  // Page Visibility API change exactly as the browser would deliver it.
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  a = await read(); await sleep(2500); bb = await read();
  out.tabHidden = { simulated: true, paused: bb.paused, stepsWhileHidden: bb.steps - a.steps };
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300);
  a = await read();
  out.afterReturn = { stillPausedUntilPlayerResumes: a.paused, status: a.status, lives: a.lives };
  await p.keyboard.press('Escape');
  await sleep(300);
  out.renderFps = await p.evaluate(() => { const f = window.__orchard.scene.fpsSamples; return Math.round(1000 / (f.reduce((a, b) => a + b, 0) / f.length)); });
  await p.keyboard.press('h');
  await sleep(300);
  await p.screenshot({ path: 'test-artifacts/10-help.png' });
  await p.keyboard.press('Escape');
  await sleep(200);

  // ---------- B. loss: chase enemies until GAME_OVER
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < 120000) {
    s = await read();
    if (s.status === 'GAME_OVER') break;
    if (s.status !== 'PLAYING') { await hold([]); await sleep(30); continue; }
    const tgt = s.enemies.filter((e) => e.state === 'PATROL').sort((x, y) => Math.abs(x.floor - s.p.floor) - Math.abs(y.floor - s.p.floor))[0];
    if (tgt) await nav(s, tgt.floor, tgt.x, 4);
    await sleep(20);
  }
  await hold([]);
  await sleep(500);
  await p.screenshot({ path: 'test-artifacts/11-game-over.png' });
  out.loss = { status: s.status, lives: s.lives, realSec: Math.round((Date.now() - t0) / 1000) };
  await p.keyboard.press('Enter');
  await sleep(600);
  s = await read();
  out.retry = { status: s.status, lives: s.lives, score: s.score };

  // ---------- C. mechanics test: blue/green via aligned shaft at col 10 (floors 1,2 preset open)
  await p.keyboard.press('KeyQ'); // menu only allowed when paused/over; so pause first
  await p.keyboard.press('Escape');
  await sleep(200);
  await p.keyboard.press('KeyQ');
  await sleep(500);
  await p.keyboard.press('KeyT');
  await sleep(800);
  await p.screenshot({ path: 'test-artifacts/12-mechanics.png' });
  const t1 = Date.now();
  const fallLog = [];
  let prev = '';
  let shotTrapped = false;
  while (Date.now() - t1 < 200000) {
    s = await read();
    const sig = s.enemies.map((e) => `${e.kind}:${e.state}:${e.floor}:${e.fallen}`).join(' ');
    if (sig !== prev) { fallLog.push(`[${((Date.now() - t1) / 1000).toFixed(1)}s] ${sig} score=${s.score} lives=${s.lives}`); prev = sig; }
    if (s.status === 'LEVEL_CLEAR' || s.status === 'GAME_OVER') break;
    if (s.status !== 'PLAYING') { await hold([]); await sleep(30); continue; }
    const holes = await p.evaluate(() => { const m = window.__orchard.sim.map; return { h10: m.holeState(0, 10), h8: m.holeState(0, 8), s1: m.holeState(1, 10), s2: m.holeState(2, 10) }; });
    // keep the aligned shaft open (debug level key G), as a developer would in the test level
    if (holes.s1 === 'SOLID' || holes.s2 === 'SOLID') await tap('g');
    const trapped = s.enemies.find((e) => e.state === 'TRAPPED' && e.floor === s.p.floor && Math.abs(cc(e.trapCol) - s.p.x) < 60);
    // red lives on floor 3 below; for it, stand on floor 2 col 13 and dig (2,12)? ladder. Use generic: only blue/green targeted at floor 0.
    const remainingTop = s.enemies.filter((e) => e.state !== 'DEFEATED' && e.kind !== 'red');
    if (remainingTop.length) {
      if (!(await nav(s, 0, cc(9), 8))) { await sleep(20); continue; }
      if (trapped) {
        if (!shotTrapped) { shotTrapped = true; await p.screenshot({ path: 'test-artifacts/13-blue-or-green-trapped.png' }); }
        const want = trapped.trapCol > 9 ? 1 : -1;
        if (s.p.facing !== want) await tap(want === 1 ? 'ArrowRight' : 'ArrowLeft'); else await hold(['k']);
      } else if (holes.h10 !== 'OPEN' && holes.h10 !== 'OCCUPIED') {
        if (s.p.facing !== 1) await tap('ArrowRight'); else await hold(['j']);
      } else if (holes.h8 !== 'OPEN' && holes.h8 !== 'OCCUPIED') {
        if (s.p.facing !== -1) await tap('ArrowLeft'); else await hold(['j']);
      } else await hold([]);
    } else {
      // red on lower floors: ambush on floor 3 at col 9 like level 1 (holes at 3,8 / 3,10)
      if (!(await nav(s, 3, cc(9), 8))) { await sleep(20); continue; }
      const st = await p.evaluate(() => { const m = window.__orchard.sim.map; return { a: m.holeState(3, 10), b: m.holeState(3, 8) }; });
      if (trapped) {
        const want = trapped.trapCol > 9 ? 1 : -1;
        if (s.p.facing !== want) await tap(want === 1 ? 'ArrowRight' : 'ArrowLeft'); else await hold(['k']);
      } else if (st.a !== 'OPEN' && st.a !== 'OCCUPIED') { if (s.p.facing !== 1) await tap('ArrowRight'); else await hold(['j']); }
      else if (st.b !== 'OPEN' && st.b !== 'OCCUPIED') { if (s.p.facing !== -1) await tap('ArrowLeft'); else await hold(['j']); }
      else await hold([]);
    }
    await sleep(20);
  }
  await hold([]);
  await sleep(400);
  await p.screenshot({ path: 'test-artifacts/14-mechanics-end.png' });
  s = await read();
  out.mechanics = { status: s.status, score: s.score, lives: s.lives, enemies: s.enemies.map((e) => `${e.kind}:${e.state}:fell${e.fallen}`) };
  console.log(fallLog.join('\n'));
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();
