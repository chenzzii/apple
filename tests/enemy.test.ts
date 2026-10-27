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
      sim.step(input({ digRightPressed: true }));
      for (let i = 0; i < 8; i++) sim.step(input());
    }
    expect(e.state).toBe('TRAPPED');
    expect(sim.map.holeState(0, 10)).toBe('POUNDING');
    sim.step(input({ digRightPressed: true }));
    expect(e.state).toBe('FALLING');
  });

  it('holding K after the knock-through does not start digging the sealed tile', () => {
    const sim = trapScenario('red', []);
    for (let i = 0; i < 200; i++) sim.step(input({ digRightHeld: true }));
    expect(sim.enemies[0]!.state).toBe('DEFEATED');
    expect(sim.map.holeState(0, 10)).toBe('SOLID');
  });

  it('pounding after release cannot score twice', () => {
    const sim = trapScenario('red', []);
    sim.drainEvents();
    poundUntilResolved(sim);
    for (let i = 0; i < 100; i++) sim.step(input({ digRightHeld: true }));
    const ev = sim.drainEvents();
    expect(ev.filter((x) => x.type === 'enemy-defeated')).toHaveLength(1);
  });

  it('player walking onto an open hole falls to the next floor (not trapped, not hurt)', () => {
    const sim = trapScenario('red', [{ floor: 0, col: 7 }]);
    poundUntilResolved(sim);
    const p = sim.player;
    const lives = sim.lives;
    sim.drainEvents();
    runUntil(sim, () => p.state === 'FALLING', input({ left: true }), 600);
    expect(p.x).toBe(7 * 40 + 20);
    runUntil(sim, () => p.state !== 'FALLING', input({ left: true }), 600);
    expect(p.floor).toBe(1);
    expect(p.y).toBe(204);
    expect(sim.lives).toBe(lives);
    expect(sim.map.holeState(0, 7)).toBe('OPEN');
    const ev = sim.drainEvents().map((e) => e.type);
    expect(ev).toContain('player-fall-started');
    expect(ev).toContain('player-landed');
    expect(ev).not.toContain('enemy-trapped');
  });

  it('player falls through aligned holes in one drop', () => {
    const sim = trapScenario('red', [{ floor: 0, col: 7 }, { floor: 1, col: 7 }]);
    poundUntilResolved(sim);
    const p = sim.player;
    runUntil(sim, () => p.state === 'FALLING', input({ left: true }), 600);
    runUntil(sim, () => p.state !== 'FALLING', input(), 600);
    expect(p.floor).toBe(2);
  });

  it('player walks over a hole that holds a trapped enemy (it is not open)', () => {
    const sim = trapScenario('red', []);
    const p = sim.player;
    // walk right across the occupied hole at col 10
    for (let i = 0; i < 40; i++) sim.step(input({ right: true }));
    expect(p.state).not.toBe('FALLING');
    expect(p.floor).toBe(0);
  });
});
