/**
 * Gameplay tuning values.
 *
 * Every value marked PROVISIONAL is a reasonable starting point from docs/GDD.md §4,
 * NOT a verified measurement of the 1981 original. See docs/DECISIONS.md.
 */

/** Fixed logic timestep (60 Hz). */
export const STEP_HZ = 60;
export const STEP_MS = 1000 / STEP_HZ;
export const STEP_SEC = 1 / STEP_HZ;

/** Grid geometry (world stage is 960x576 inside the 1280x720 design canvas). */
export const TILE = 40;
export const WORLD_W = 960;
export const WORLD_H = 576;

export const SPEED_OPTIONS = [1.0, 1.25, 1.5, 2.0] as const;
export type SpeedOption = (typeof SPEED_OPTIONS)[number];
/** GDD §2 default; not a claim about the original's speed. */
export const DEFAULT_SPEED: SpeedOption = 1.25;

export interface GameplayConfig {
  /** Valid dig pulses to open one tile (GDD: ~6 per player walkthrough; PROVISIONAL). */
  digPulses: number;
  /** Valid pound pulses to knock a trapped enemy through (PROVISIONAL ~6). */
  poundPulses: number;
  /** Minimum game-time between two valid dig/pound pulses, ms (PROVISIONAL 110). */
  pulseCooldownMs: number;
  playerSpeed: number; // px / game second (PROVISIONAL 120)
  playerClimbSpeed: number; // px / game second (PROVISIONAL 88)
  enemySpeed: number; // px / game second (PROVISIONAL 80)
  enemyClimbSpeed: number; // px / game second (PROVISIONAL 60)
  fallSpeed: number; // px / game second (PROVISIONAL 360)
  /** How long an enemy stays trapped before climbing out, s (PROVISIONAL 5.0). */
  trapSeconds: number;
  /** Climb-out animation; enemy is harmless until it completes, s (PROVISIONAL). */
  escapeSeconds: number;
  /** Stun after surviving a short fall; harmless while stunned, s (PROVISIONAL). */
  landStunSeconds: number;
  /** Player invulnerability after (re)spawn, s (GDD 1.0). */
  invulnSeconds: number;
  /** Freeze between a hit and respawn, s. */
  lifeLostSeconds: number;
  /** "READY" pause at level start / after respawn, s. */
  readySeconds: number;
  /** Horizontal tolerance for grabbing a ladder, px. */
  ladderSnap: number;
  /** Enemy centre must be within this many px of a hole centre to fall in. */
  holeCatch: number;
  /** Collision half-sizes for the player/enemy contact test, px. */
  playerHalfW: number;
  enemyHalfW: number;
  contactHalfH: number;
  startLives: number;
  /** Probability an enemy takes a ladder that leads toward the player's floor. */
  ladderTowardPlayerChance: number;
  /** Probability an enemy takes any other ladder. */
  ladderOtherChance: number;
  /** Bonus points per remaining game second on level clear (PROVISIONAL). */
  timeBonusPerSecond: number;
}

export const DEFAULT_CONFIG: Readonly<GameplayConfig> = Object.freeze({
  digPulses: 6,
  poundPulses: 6,
  pulseCooldownMs: 110,
  playerSpeed: 120,
  playerClimbSpeed: 88,
  enemySpeed: 80,
  enemyClimbSpeed: 60,
  fallSpeed: 360,
  trapSeconds: 5.0,
  escapeSeconds: 0.6,
  landStunSeconds: 0.6,
  invulnSeconds: 1.0,
  lifeLostSeconds: 1.2,
  readySeconds: 1.0,
  ladderSnap: 12,
  holeCatch: 10,
  playerHalfW: 14,
  enemyHalfW: 14,
  contactHalfH: 26,
  startLives: 3,
  ladderTowardPlayerChance: 0.6,
  ladderOtherChance: 0.25,
  timeBonusPerSecond: 10,
});

/** Convert a duration in game seconds to whole logic steps. */
export function secToSteps(sec: number): number {
  return Math.round(sec * STEP_HZ);
}
