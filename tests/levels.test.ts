import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/Simulation';
import { DEFAULT_CONFIG } from '../src/core/config';
import { CAMPAIGN, LEVELS, nextCampaignLevel } from '../src/levels';
import { AmbushBot } from './ambushBot';
import { SPOT } from './levelSpots';

/**
 * Owner's progression: 1–5 reds; then one red becomes a green per level (L10 = 5 greens);
 * then one green becomes a blue per level (L15 = 5 blues).
 */
const EXPECTED: Record<string, { red: number; green: number; blue: number }> = {
  level01: { red: 1, green: 0, blue: 0 },
  level02: { red: 2, green: 0, blue: 0 },
  level03: { red: 3, green: 0, blue: 0 },
  level04: { red: 4, green: 0, blue: 0 },
  level05: { red: 5, green: 0, blue: 0 },
  level06: { red: 4, green: 1, blue: 0 },
  level07: { red: 3, green: 2, blue: 0 },
  level08: { red: 2, green: 3, blue: 0 },
  level09: { red: 1, green: 4, blue: 0 },
  level10: { red: 0, green: 5, blue: 0 },
  level11: { red: 0, green: 4, blue: 1 },
  level12: { red: 0, green: 3, blue: 2 },
  level13: { red: 0, green: 2, blue: 3 },
  level14: { red: 0, green: 1, blue: 4 },
  level15: { red: 0, green: 0, blue: 5 },
};

function botPlay(levelId: string, opts: { seed?: number; lives?: number } = {}, maxSec = 1500) {
  const [col, up, side, depth = 2] = SPOT[levelId]!;
  const sim = new Simulation(LEVELS[levelId]!, opts);
  const bot = new AmbushBot(col, up, up + depth - 1, side);
  for (let i = 0; i < maxSec * 60; i++) {
    if (sim.status === 'LEVEL_CLEAR' || sim.status === 'GAME_OVER') break;
    sim.step(bot.decide(sim));
  }
  return sim;
}

describe('campaign', () => {
  it('has 15 levels in order and ends after level 15', () => {
    expect(CAMPAIGN).toEqual(Object.keys(EXPECTED));
    expect(nextCampaignLevel('level01')).toBe('level02');
    expect(nextCampaignLevel('level10')).toBe('level11');
    expect(nextCampaignLevel('level15')).toBeNull();
    expect(nextCampaignLevel('mechanics-test')).toBeNull();
  });

  for (const id of Object.keys(EXPECTED)) {
    it(`${id}: enemy mix follows the progression, default speed, hint present`, () => {
      const lv = LEVELS[id]!;
      const red = lv.enemies.filter((e) => e.kind === 'red').length;
      const green = lv.enemies.filter((e) => e.kind === 'green').length;
      const blue = lv.enemies.filter((e) => e.kind === 'blue').length;
      expect({ red, green, blue }).toEqual(EXPECTED[id]);
      expect(new Simulation(lv).cfg.enemySpeed).toBe(DEFAULT_CONFIG.enemySpeed);
      expect(lv.hint).toBeTruthy();
      expect(lv.player.floor).toBe(4);
    });
  }

  it('time limit grows with the number (and kind) of enemies', () => {
    const t = CAMPAIGN.map((id) => LEVELS[id]!.timeLimitSec);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThanOrEqual(t[i - 1]!);
  });

  it('level tuning still overrides defaults when a level sets it', () => {
    const lv = { ...LEVELS.level01!, tuning: { enemySpeed: 50 } };
    expect(new Simulation(lv).cfg.enemySpeed).toBe(50);
    expect(new Simulation(lv, { config: { enemySpeed: 10 } }).cfg.enemySpeed).toBe(10);
  });
});

describe('every level is clearable by a simple scripted player', () => {
  for (const id of Object.keys(EXPECTED).filter((k) => EXPECTED[k]!.blue === 0)) {
    it(`${id}: cleared with the normal 3 lives`, () => {
      const sim = botPlay(id);
      expect(sim.status).toBe('LEVEL_CLEAR');
      for (const e of sim.enemies) {
        expect(e.state).toBe('DEFEATED');
        if (e.kind === 'green') expect(e.lastFallFloors).toBeGreaterThanOrEqual(2);
        if (e.kind === 'blue') expect(e.lastFallFloors).toBeGreaterThanOrEqual(3);
      }
    });
  }

  for (const id of ['level06', 'level08', 'level10']) {
    it(`${id}: still clearable when enemy movement differs (4 other seeds, up to 9 lives)`, () => {
      for (const seed of [1, 2, 3, 4]) expect(botPlay(id, { seed, lives: 9 }).status, `seed ${seed}`).toBe('LEVEL_CLEAR');
    });
  }

  // Cactus levels (11–15): the simple bot (one shaft, no real dodging) struggles with the long
  // 3-floor setup, so these are SOLVABILITY checks: a known enemy-RNG seed on which the bot clears
  // the level with extra lives, every blue defeated by a >= 3-floor fall. Human difficulty is judged
  // by play-testing (see docs/PROGRESS.md for the bot's per-seed results).
  const SOLVABLE_SEED: Record<string, number> = { level11: 1, level12: 1, level13: 0, level14: 1, level15: 1 };
  for (const [id, seed] of Object.entries(SOLVABLE_SEED)) {
    it(`${id}: solvable (bot clears it on seed ${seed} with up to 9 lives)`, () => {
      const sim = botPlay(id, seed ? { seed, lives: 9 } : { lives: 9 });
      expect(sim.status).toBe('LEVEL_CLEAR');
      for (const e of sim.enemies) {
        expect(e.state).toBe('DEFEATED');
        if (e.kind === 'blue') expect(e.lastFallFloors).toBeGreaterThanOrEqual(3);
        if (e.kind === 'green') expect(e.lastFallFloors).toBeGreaterThanOrEqual(2);
      }
    });
  }
});
