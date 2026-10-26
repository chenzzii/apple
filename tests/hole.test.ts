import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/Simulation';
import { makeLevel, input, startPlaying } from './helpers';

function digSim(over = {}) {
  // Player on floor 1 at col 9 facing right; target tile = (1, 10). Enemy parked far away on floor 4.
  const sim = new Simulation(
    makeLevel({ player: { col: 9, floor: 1 }, enemies: [{ kind: 'red', col: 20, floor: 4, dir: 1 }], ...over }),
    { config: { enemySpeed: 0 } },
  );
  startPlaying(sim);
  return sim;
}

/** One isolated tap: press for one step then wait out the cooldown. */
function tap(sim: Simulation, key: 'dig' | 'pound') {
  sim.step(input(key === 'dig' ? { digPressed: true } : { poundPressed: true }));
  for (let i = 0; i < 10; i++) sim.step(input());
}

describe('digging (T02/T03)', () => {
  it('opens a hole after exactly 6 valid pulses; 5 leaves it incomplete', () => {
    const sim = digSim();
    for (let i = 0; i < 5; i++) tap(sim, 'dig');
    expect(sim.map.holeState(1, 10)).toBe('DIGGING');
    expect(sim.map.tile(1, 10)!.progress).toBe(5);
    tap(sim, 'dig');
    expect(sim.map.holeState(1, 10)).toBe('OPEN');
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'hole-opened')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'hole-dig-progress')).toHaveLength(6);
  });

  it('held key repeats with cooldown and cannot exceed one pulse per cooldown', () => {
    const sim = digSim();
    // 20 steps held at 7-step cooldown => pulses at steps 0,7,14 = 3 pulses.
    for (let i = 0; i < 20; i++) sim.step(input({ digHeld: true }));
    expect(sim.map.tile(1, 10)!.progress).toBe(3);
    // Mashing every step is rate-limited the same way.
    for (let i = 0; i < 20; i++) sim.step(input({ digPressed: true }));
    expect(sim.map.tile(1, 10)!.progress).toBeLessThanOrEqual(6);
  });

  it('cannot dig a ladder cell', () => {
    // Player at col 1 facing left -> target col 0, which is a ladder cell on every floor.
    const sim = digSim({ player: { col: 1, floor: 1 } });
    sim.step(input({ left: true }));
    for (let i = 0; i < 10; i++) sim.step(input());
    for (let i = 0; i < 8; i++) tap(sim, 'dig');
    expect(sim.player.facing).toBe(-1);
    expect(sim.map.holeState(1, 0)).toBe('SOLID');
    expect(sim.drainEvents().some((e) => e.type === 'invalid-action')).toBe(true);
  });

  it('cannot dig out of bounds or on the non-diggable bottom floor', () => {
    expect(new Simulation(makeLevel()).map.canDig(1, -1)).toBe(false);
    expect(new Simulation(makeLevel()).map.canDig(1, 24)).toBe(false);
    const sim = digSim({ player: { col: 9, floor: 4 } });
    for (let i = 0; i < 8; i++) tap(sim, 'dig');
    expect(sim.map.holeState(4, 10)).toBe('SOLID');
  });

  it('refills an open hole with 6 pound pulses', () => {
    const sim = digSim();
    for (let i = 0; i < 6; i++) tap(sim, 'dig');
    expect(sim.map.holeState(1, 10)).toBe('OPEN');
    for (let i = 0; i < 5; i++) tap(sim, 'pound');
    expect(sim.map.holeState(1, 10)).toBe('REFILLING');
    tap(sim, 'pound');
    expect(sim.map.holeState(1, 10)).toBe('SOLID');
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
