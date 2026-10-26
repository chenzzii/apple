import { validateLevel } from '../src/core/LevelLoader';
import { Simulation, type SimOptions } from '../src/core/Simulation';
import { NO_INPUT, type EnemySpawn, type InputFrame, type LevelData } from '../src/core/types';

export const FLOOR_Y = [112, 204, 296, 388, 480];

/** Five floors, ladders only at the far edges (cols 0 and 23) so they never interfere. */
export function makeLevel(over: Partial<LevelData> = {}): LevelData {
  const ladders = [];
  for (let f = 0; f < 4; f++) {
    ladders.push({ col: 0, top: f, bottom: f + 1 }, { col: 23, top: f, bottom: f + 1 });
  }
  return validateLevel({
    id: 'test',
    name: 'test',
    cols: 24,
    floorY: FLOOR_Y,
    diggableFloors: [0, 1, 2, 3],
    ladders,
    player: { col: 9, floor: 0 },
    enemies: [{ kind: 'red', col: 13, floor: 0, dir: -1 }],
    timeLimitSec: 999,
    seed: 7,
    ...over,
  });
}

export function input(p: Partial<InputFrame> = {}): InputFrame {
  return { ...NO_INPUT, ...p };
}

/** Skip the READY phase. */
export function startPlaying(sim: Simulation): void {
  let guard = 1000;
  while (sim.status === 'READY' && guard-- > 0) sim.step(NO_INPUT);
}

export function runUntil(
  sim: Simulation,
  pred: (s: Simulation) => boolean,
  inp: InputFrame | ((step: number) => InputFrame) = NO_INPUT,
  max = 5000,
): number {
  for (let i = 0; i < max; i++) {
    if (pred(sim)) return i;
    sim.step(typeof inp === 'function' ? inp(i) : inp);
  }
  throw new Error('runUntil: condition not met');
}

/**
 * Build a sim where one enemy of `kind` walks left into a hole at (floor 0, col 10)
 * while the player waits at col 9 facing right. Extra preset holes may be added below.
 */
export function trapScenario(kind: EnemySpawn['kind'], belowHoles: { floor: number; col: number }[], opts: SimOptions = {}) {
  const lv = makeLevel({
    player: { col: 9, floor: 0 },
    // Second enemy is a parked bystander on the bottom floor so a defeat does not end the level.
    enemies: [{ kind, col: 13, floor: 0, dir: -1 }, { kind: 'red', col: 12, floor: 4, dir: 1 }],
    presetHoles: [{ floor: 0, col: 10 }, ...belowHoles],
  });
  const sim = new Simulation(lv, opts);
  startPlaying(sim);
  runUntil(sim, (s) => s.enemies[0]!.state === 'TRAPPED');
  return sim;
}

/** Hold the pound key until the trapped enemy is released and has finished falling. */
export function poundUntilResolved(sim: Simulation) {
  const e = sim.enemies[0]!;
  runUntil(sim, (s) => s.enemies[0]!.state !== 'TRAPPED', input({ poundHeld: true }), 400);
  runUntil(sim, () => e.state !== 'FALLING', input(), 400);
  return e;
}
