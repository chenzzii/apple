import { describe, expect, it } from 'vitest';
import { input, poundUntilResolved, runUntil, trapScenario } from './helpers';

describe('trap / escape / pound (T06/T07)', () => {
  it('a trapped enemy is NOT defeated just by sitting in the pit', () => {
    const sim = trapScenario('red', []);
    const e = sim.enemies[0]!;
    for (let i = 0; i < 120; i++) sim.step(input());
    expect(e.state).toBe('TRAPPED');
    expect(sim.score).toBe(0);
    expect(sim.map.holeState(0, 10)).toBe('OCCUPIED');
  });

  it('escapes after the trap timer (5 s game time) and seals the hole', () => {
    const sim = trapScenario('red', []);
    const e = sim.enemies[0]!;
    const steps = runUntil(sim, () => e.state === 'PATROL', input(), 1000);
    // 300 trap steps + 36 escape steps (+-1)
    expect(steps).toBeGreaterThanOrEqual(330);
    expect(steps).toBeLessThanOrEqual(340);
    expect(sim.map.holeState(0, 10)).toBe('SOLID');
    expect(sim.drainEvents().filter((ev) => ev.type === 'enemy-escaped')).toHaveLength(1);
  });

  it('5 pounds do not release; the 6th knocks it through', () => {
    const sim = trapScenario('red', []);
    const e = sim.enemies[0]!;
    for (let k = 0; k < 5; k++) {
      sim.step(input({ poundPressed: true }));
      for (let i = 0; i < 8; i++) sim.step(input());
    }
    expect(e.state).toBe('TRAPPED');
    expect(sim.map.holeState(0, 10)).toBe('POUNDING');
    sim.step(input({ poundPressed: true }));
    expect(e.state).toBe('FALLING');
  });

  it('pounding after release cannot score twice', () => {
    const sim = trapScenario('red', []);
    sim.drainEvents();
    poundUntilResolved(sim);
    for (let i = 0; i < 100; i++) sim.step(input({ poundHeld: true }));
    const ev = sim.drainEvents();
    expect(ev.filter((x) => x.type === 'enemy-defeated')).toHaveLength(1);
  });

  it('player walks safely across an open hole (not trapped, not hurt)', () => {
    const sim = trapScenario('red', [{ floor: 0, col: 7 }]);
    poundUntilResolved(sim);
    const p = sim.player;
    const lives = sim.lives;
    // walk left over the hole at col 7
    runUntil(sim, () => p.x < 6 * 40, input({ left: true }), 600);
    expect(p.floor).toBe(0);
    expect(p.y).toBe(112);
    expect(sim.lives).toBe(lives);
    expect(sim.map.holeState(0, 7)).toBe('OPEN');
  });
});
