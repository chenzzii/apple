import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/Simulation';
import { makeLevel, input, runUntil, startPlaying } from './helpers';

function digSim(over = {}) {
  // Player on floor 1 at col 9. J targets (1, 8), K targets (1, 10). Enemy parked on floor 4.
  const sim = new Simulation(
    makeLevel({ player: { col: 9, floor: 1 }, enemies: [{ kind: 'red', col: 20, floor: 4, dir: 1 }], ...over }),
    { config: { enemySpeed: 0 } },
  );
  startPlaying(sim);
  return sim;
}

/** One isolated tap of J (left) or K (right), then wait out the cooldown. */
function tap(sim: Simulation, side: 'left' | 'right') {
  sim.step(input(side === 'left' ? { digLeftPressed: true } : { digRightPressed: true }));
  for (let i = 0; i < 10; i++) sim.step(input());
}

describe('digging with J (left) / K (right) (T02/T03)', () => {
  it('K opens the RIGHT tile after exactly 6 pulses; 5 leaves it incomplete', () => {
    const sim = digSim();
    for (let i = 0; i < 5; i++) tap(sim, 'right');
    expect(sim.map.holeState(1, 10)).toBe('DIGGING');
    expect(sim.map.tile(1, 10)!.progress).toBe(5);
    tap(sim, 'right');
    expect(sim.map.holeState(1, 10)).toBe('OPEN');
    expect(sim.map.holeState(1, 8)).toBe('SOLID');
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'hole-opened')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'hole-dig-progress')).toHaveLength(6);
  });

  it('J opens the LEFT tile and turns the player to face left', () => {
    const sim = digSim();
    expect(sim.player.facing).toBe(1);
    for (let i = 0; i < 6; i++) tap(sim, 'left');
    expect(sim.map.holeState(1, 8)).toBe('OPEN');
    expect(sim.map.holeState(1, 10)).toBe('SOLID');
    expect(sim.player.facing).toBe(-1);
    expect(sim.player.x).toBe(9 * 40 + 20); // digging never moves the player
  });

  it('held key repeats with cooldown and cannot exceed one pulse per cooldown', () => {
    const sim = digSim();
    // 20 steps held at 7-step cooldown => pulses at steps 0,7,14 = 3 pulses.
    for (let i = 0; i < 20; i++) sim.step(input({ digRightHeld: true }));
    expect(sim.map.tile(1, 10)!.progress).toBe(3);
    for (let i = 0; i < 20; i++) sim.step(input({ digRightPressed: true }));
    expect(sim.map.tile(1, 10)!.progress).toBeLessThanOrEqual(6);
  });

  it('cannot dig a ladder cell', () => {
    // Player at col 1: J targets col 0, which is a ladder cell on every floor.
    const sim = digSim({ player: { col: 1, floor: 1 } });
    for (let i = 0; i < 8; i++) tap(sim, 'left');
    expect(sim.map.holeState(1, 0)).toBe('SOLID');
    expect(sim.drainEvents().some((e) => e.type === 'invalid-action')).toBe(true);
  });

  it('cannot dig out of bounds or on the non-diggable bottom floor', () => {
    expect(new Simulation(makeLevel()).map.canDig(1, -1)).toBe(false);
    expect(new Simulation(makeLevel()).map.canDig(1, 24)).toBe(false);
    const sim = digSim({ player: { col: 9, floor: 4 } });
    for (let i = 0; i < 8; i++) tap(sim, 'right');
    expect(sim.map.holeState(4, 10)).toBe('SOLID');
  });

  it('extra pulses on an already open hole do nothing', () => {
    const sim = digSim();
    for (let i = 0; i < 9; i++) tap(sim, 'right');
    expect(sim.map.tile(1, 10)!.progress).toBe(6);
    expect(sim.map.holeState(1, 10)).toBe('OPEN');
  });

  it('walking into your own freshly dug hole drops you a floor', () => {
    const sim = digSim();
    for (let i = 0; i < 6; i++) tap(sim, 'right');
    runUntil(sim, (s) => s.player.state === 'FALLING', input({ right: true }), 200);
    runUntil(sim, (s) => s.player.state !== 'FALLING', input(), 200);
    expect(sim.player.floor).toBe(2);
    expect(sim.lives).toBe(3);
  });

  it('has no jump: up/down away from a ladder does not change floor (T01)', () => {
    const sim = digSim();
    const y0 = sim.player.y;
    for (let i = 0; i < 60; i++) sim.step(input({ up: true }));
    for (let i = 0; i < 60; i++) sim.step(input({ down: true }));
    expect(sim.player.y).toBe(y0);
    expect(sim.player.floor).toBe(1);
  });

  it('climbs a ladder between floors', () => {
    const sim = digSim({ player: { col: 0, floor: 1 } });
    for (let i = 0; i < 200 && sim.player.floor !== 0; i++) sim.step(input({ up: true }));
    expect(sim.player.floor).toBe(0);
    expect(sim.player.y).toBe(112);
  });
});
