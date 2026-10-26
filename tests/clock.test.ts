import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../src/core/FixedStepClock';
import { Simulation } from '../src/core/Simulation';
import { LEVELS } from '../src/levels';
import { input } from './helpers';
import type { InputFrame } from '../src/core/types';

/** Deterministic scripted input keyed by logic step number (not by frame). */
function script(step: number): InputFrame {
  const phase = Math.floor(step / 90) % 6;
  return input({
    left: phase === 0 || phase === 3,
    right: phase === 1 || phase === 4,
    up: phase === 2,
    down: phase === 5,
    digHeld: step % 200 < 50,
    poundHeld: step % 300 > 250,
  });
}

/** Drive a sim through the clock at a given render rate for `realMs` milliseconds. */
function runAtHz(hz: number, realMs: number, speed = 1) {
  const sim = new Simulation(LEVELS.level01!);
  const clock = new FixedStepClock();
  clock.speed = speed;
  const frame = 1000 / hz;
  let t = 0;
  while (t < realMs - 1e-9) {
    const n = clock.advance(frame);
    for (let i = 0; i < n; i++) sim.step(script(sim.stepCount));
    t += frame;
  }
  return { sim, clock };
}

function snapshot(sim: Simulation) {
  return JSON.stringify({
    p: [sim.player.x, sim.player.y, sim.player.floor],
    e: sim.enemies.map((e) => [e.x, e.y, e.state, e.floor]),
    holes: sim.map.activeTiles().map((t) => [t.floor, t.col, t.progress]),
    score: sim.score,
    lives: sim.lives,
    status: sim.status,
  });
}

describe('fixed-step clock (T10/T11)', () => {
  it('produces 60 steps per real second at 1x', () => {
    const c = new FixedStepClock();
    let n = 0;
    for (let i = 0; i < 60; i++) n += c.advance(1000 / 60);
    expect(n).toBe(60);
  });

  it('2x speed runs twice as many logic steps in the same real time', () => {
    const a = runAtHz(60, 10_000, 1).clock.totalSteps;
    const b = runAtHz(60, 10_000, 2).clock.totalSteps;
    expect(a).toBe(600);
    expect(b).toBe(1200);
    for (const s of [1.25, 1.5]) expect(runAtHz(60, 10_000, s).clock.totalSteps).toBe(600 * s);
  });

  it('30 / 60 / 144 Hz rendering gives identical outcomes at equal world time', () => {
    const a = runAtHz(30, 10_000);
    const b = runAtHz(60, 10_000);
    const c = runAtHz(144, 10_000);
    expect(a.sim.stepCount).toBe(600);
    expect(b.sim.stepCount).toBe(600);
    expect(c.sim.stepCount).toBe(600);
    expect(snapshot(a.sim)).toBe(snapshot(b.sim));
    expect(snapshot(b.sim)).toBe(snapshot(c.sim));
  });

  it('pause stops all progress', () => {
    const c = new FixedStepClock();
    c.paused = true;
    let n = 0;
    for (let i = 0; i < 600; i++) n += c.advance(16.67);
    expect(n).toBe(0);
  });

  it('a long background-tab gap is clamped (no catch-up burst)', () => {
    const c = new FixedStepClock();
    const n = c.advance(30_000); // 30 s hidden
    expect(n).toBeLessThanOrEqual(6);
    c.resetAccumulator();
    expect(c.alpha).toBe(0);
  });

  it('a trapped enemy does not escape during a paused period', () => {
    const sim = new Simulation(LEVELS['mechanics-test']!);
    const c = new FixedStepClock();
    const before = snapshot(sim);
    c.paused = true;
    for (let i = 0; i < 1000; i++) {
      const n = c.advance(16.67);
      for (let k = 0; k < n; k++) sim.step(input());
    }
    expect(snapshot(sim)).toBe(before);
  });
});
