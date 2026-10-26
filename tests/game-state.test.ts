import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/Simulation';
import { input, makeLevel, poundUntilResolved, runUntil, startPlaying, trapScenario } from './helpers';

describe('lives, invulnerability, game over (T08)', () => {
  it('loses exactly one life per hit and never during invulnerability', () => {
    // Stationary enemy right next to spawn: overlaps the player every step.
    const sim = new Simulation(
      makeLevel({ player: { col: 10, floor: 2 }, enemies: [{ kind: 'red', col: 10, floor: 2 }] }),
      { config: { enemySpeed: 0 } },
    );
    startPlaying(sim);
    // Spawn invulnerability = 60 steps.
    for (let i = 0; i < 59; i++) sim.step(input());
    expect(sim.lives).toBe(3);
    runUntil(sim, (s) => s.status === 'LIFE_LOST', input(), 10);
    expect(sim.lives).toBe(2);
    const hits = sim.drainEvents().filter((e) => e.type === 'player-hit');
    expect(hits).toHaveLength(1);
    // After respawn: READY then 60 invulnerable steps again.
    runUntil(sim, (s) => s.status === 'PLAYING', input(), 500);
    for (let i = 0; i < 58; i++) sim.step(input());
    expect(sim.lives).toBe(2);
  });

  it('third life lost => GAME_OVER exactly once', () => {
    const sim = new Simulation(
      makeLevel({ player: { col: 10, floor: 2 }, enemies: [{ kind: 'red', col: 10, floor: 2 }] }),
      { config: { enemySpeed: 0 } },
    );
    runUntil(sim, (s) => s.status === 'GAME_OVER', input(), 5000);
    expect(sim.lives).toBe(0);
    for (let i = 0; i < 100; i++) sim.step(input());
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'game-over')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'life-lost')).toHaveLength(3);
  });

  it('running out of time costs a life', () => {
    const sim = new Simulation(makeLevel({ timeLimitSec: 2, enemies: [{ kind: 'red', col: 20, floor: 4 }] }), {
      config: { enemySpeed: 0 },
    });
    runUntil(sim, (s) => s.status === 'LIFE_LOST', input(), 400);
    expect(sim.lives).toBe(2);
  });
});

describe('level clear (T09)', () => {
  it('defeating the last enemy triggers LEVEL_CLEAR once, with time bonus', () => {
    const lv = makeLevel({
      player: { col: 9, floor: 0 },
      enemies: [{ kind: 'red', col: 13, floor: 0, dir: -1 }],
      presetHoles: [{ floor: 0, col: 10 }],
      timeLimitSec: 100,
    });
    const sim = new Simulation(lv);
    startPlaying(sim);
    runUntil(sim, (s) => s.enemies[0]!.state === 'TRAPPED');
    poundUntilResolved(sim);
    expect(sim.status).toBe('LEVEL_CLEAR');
    for (let i = 0; i < 50; i++) sim.step(input());
    const ev = sim.drainEvents();
    const clears = ev.filter((e) => e.type === 'level-cleared');
    expect(clears).toHaveLength(1);
    expect(sim.score).toBeGreaterThan(100);
  });

  it('respawn after a hit keeps defeated enemies defeated', () => {
    const sim = trapScenario('red', []);
    poundUntilResolved(sim);
    expect(sim.enemies[0]!.state).toBe('DEFEATED');
    // Teleport bystander onto player to force a hit.
    const b = sim.enemies[1]!;
    sim.player.invulnSteps = 0;
    b.floor = 0;
    b.y = sim.player.y;
    b.x = sim.player.x;
    runUntil(sim, (s) => s.status === 'LIFE_LOST', input(), 5);
    runUntil(sim, (s) => s.status === 'PLAYING', input(), 500);
    expect(sim.enemies[0]!.state).toBe('DEFEATED');
    expect(sim.remainingEnemies).toBe(1);
  });
});
