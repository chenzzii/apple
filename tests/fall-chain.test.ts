import { describe, expect, it } from 'vitest';
import { poundUntilResolved, trapScenario } from './helpers';
import type { EnemyKind } from '../src/core/types';

const shaft = (n: number) => Array.from({ length: n }, (_, i) => ({ floor: i + 1, col: 10 }));

function fall(kind: EnemyKind, alignedBelow: number) {
  const sim = trapScenario(kind, shaft(alignedBelow));
  sim.drainEvents();
  const e = poundUntilResolved(sim);
  return { sim, e, events: sim.drainEvents() };
}

describe('consecutive aligned-floor falls (T04)', () => {
  it('red is defeated by a 1-floor fall', () => {
    const { e, sim } = fall('red', 0);
    expect(e.lastFallFloors).toBe(1);
    expect(e.state).toBe('DEFEATED');
    expect(sim.score).toBeGreaterThanOrEqual(100);
  });

  it('green survives 1 floor, is defeated by 2', () => {
    expect(fall('green', 0).e.state).not.toBe('DEFEATED');
    const r = fall('green', 1);
    expect(r.e.lastFallFloors).toBe(2);
    expect(r.e.state).toBe('DEFEATED');
  });

  it('blue survives 2 floors, is defeated by 3', () => {
    expect(fall('blue', 1).e.state).not.toBe('DEFEATED');
    const r = fall('blue', 2);
    expect(r.e.lastFallFloors).toBe(3);
    expect(r.e.state).toBe('DEFEATED');
  });

  it('scores base x floors exactly once per enemy', () => {
    const { events } = fall('blue', 2);
    const defeated = events.filter((ev) => ev.type === 'enemy-defeated');
    expect(defeated).toHaveLength(1);
    expect(defeated[0]).toMatchObject({ points: 900, floorsFallen: 3 });
  });
});

describe('misaligned / non-consecutive falls (T05)', () => {
  it('a one-column offset hole breaks the chain', () => {
    const sim = trapScenario('green', [{ floor: 1, col: 11 }]);
    const e = poundUntilResolved(sim);
    expect(e.lastFallFloors).toBe(1);
    expect(e.state).not.toBe('DEFEATED');
    expect(sim.map.holeState(1, 11)).toBe('OPEN');
  });

  it('two separate 1-floor falls do not accumulate for green', () => {
    // Floor 0 trap at col 10, and a second preset trap at (1, 10)? No: that would be aligned.
    // Instead: second preset hole on floor 1 at col 6, reached by walking after the first fall.
    const sim = trapScenario('green', [{ floor: 1, col: 6 }]);
    const e = poundUntilResolved(sim);
    expect(e.state).not.toBe('DEFEATED');
    expect(e.floor).toBe(1);
    // Force the green to walk left toward col 6 hole.
    e.dir = -1;
    for (let i = 0; i < 1000 && e.state !== 'TRAPPED'; i++) sim.step({ left: false, right: false, up: false, down: false, digHeld: false, digPressed: false, poundHeld: false, poundPressed: false });
    expect(e.state).toBe('TRAPPED');
    expect(e.floor).toBe(1);
    // Knock it through from floor 1 -> floor 2: still a 1-floor fall, total history ignored.
    sim.player.floor = 1;
    sim.player.y = 204;
    sim.player.x = 5 * 40 + 20;
    sim.player.facing = 1;
    sim.player.invulnSteps = 9999;
    const e2 = poundUntilResolved(sim);
    expect(e2.lastFallFloors).toBe(1);
    expect(e2.state).not.toBe('DEFEATED');
  });
});
