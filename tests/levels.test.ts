import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core/Simulation';
import { DEFAULT_CONFIG } from '../src/core/config';
import { CAMPAIGN, LEVELS, nextCampaignLevel } from '../src/levels';
import { AmbushBot } from './ambushBot';

/** Play a level with the scripted bot; returns the finished sim. */
function botPlay(levelId: string, bot: AmbushBot, opts: { seed?: number; lives?: number } = {}, maxSec = 1200) {
  const sim = new Simulation(LEVELS[levelId]!, opts);
  for (let i = 0; i < maxSec * 60; i++) {
    if (sim.status === 'LEVEL_CLEAR' || sim.status === 'GAME_OVER') break;
    sim.step(bot.decide(sim));
  }
  return sim;
}

describe('campaign', () => {
  it('runs level01 -> level02, then ends', () => {
    expect(CAMPAIGN).toEqual(['level01', 'level02']);
    expect(nextCampaignLevel('level01')).toBe('level02');
    expect(nextCampaignLevel('level02')).toBeNull();
    expect(nextCampaignLevel('mechanics-test')).toBeNull();
  });

  it('every campaign level validates and has a hint', () => {
    for (const id of CAMPAIGN) {
      expect(LEVELS[id]).toBeDefined();
      expect(LEVELS[id]!.hint).toBeTruthy();
    }
  });
});

describe('level 2: 捕蠅草溫室', () => {
  const lv = LEVELS.level02!;

  it('introduces two green flytraps alongside two red apples', () => {
    const kinds = lv.enemies.map((e) => e.kind).sort();
    expect(kinds).toEqual(['green', 'green', 'red', 'red']);
  });

  it('applies level tuning (faster enemies) but explicit options still win', () => {
    expect(new Simulation(lv).cfg.enemySpeed).toBe(84);
    expect(new Simulation(lv).cfg.digPulses).toBe(DEFAULT_CONFIG.digPulses);
    expect(new Simulation(lv, { config: { enemySpeed: 10 } }).cfg.enemySpeed).toBe(10);
  });

  it('has a stacked-ambush spot on the top floor: cols 8/10 diggable on floor 0, col 10 on floor 1', () => {
    const sim = new Simulation(lv);
    expect(sim.map.canDig(0, 8)).toBe(true);
    expect(sim.map.canDig(0, 10)).toBe(true);
    expect(sim.map.canDig(1, 10)).toBe(true);
  });

  it('is clearable with the normal 3 lives: scripted player wins, both greens by 2-floor falls', () => {
    const sim = botPlay('level02', new AmbushBot(9, 0, 1, 1));
    expect(sim.status).toBe('LEVEL_CLEAR');
    for (const e of sim.enemies.filter((x) => x.kind === 'green')) {
      expect(e.state).toBe('DEFEATED');
      expect(e.lastFallFloors).toBeGreaterThanOrEqual(2);
    }
  });

  it('stays clearable when enemy RNG differs (5 seeds, simple bot, up to 5 lives)', () => {
    for (const seed of [2026, 1, 2, 3, 4]) {
      const sim = botPlay('level02', new AmbushBot(9, 0, 1, 1), { seed, lives: 5 });
      expect(sim.status, `seed ${seed}`).toBe('LEVEL_CLEAR');
    }
  });
});

describe('level 1 still clearable with the same bot', () => {
  it('wins', () => {
    const sim = botPlay('level01', new AmbushBot(6, 1, 2, -1));
    expect(sim.status).toBe('LEVEL_CLEAR');
  });
});
