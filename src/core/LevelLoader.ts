import { TILE, WORLD_H, WORLD_W } from './config';
import type { LevelData } from './types';

export class LevelValidationError extends Error {}

/** Validate a level object (e.g. parsed JSON). Throws LevelValidationError listing all problems. */
export function validateLevel(raw: unknown): LevelData {
  const errors: string[] = [];
  const lv = raw as LevelData;
  if (!lv || typeof lv !== 'object') throw new LevelValidationError('level is not an object');

  if (typeof lv.id !== 'string' || !lv.id) errors.push('id missing');
  if (lv.cols !== WORLD_W / TILE) errors.push(`cols must be ${WORLD_W / TILE}`);
  if (!Array.isArray(lv.floorY) || lv.floorY.length < 2) errors.push('need at least 2 floors');
  else {
    for (let i = 1; i < lv.floorY.length; i++) {
      if (!(lv.floorY[i]! > lv.floorY[i - 1]!)) errors.push(`floorY must increase (index ${i})`);
    }
    if (lv.floorY[lv.floorY.length - 1]! + 24 > WORLD_H) errors.push('bottom floor too low for world');
    if (lv.floorY[0]! < 60) errors.push('top floor too high (need room for sprites)');
  }
  const nFloors = Array.isArray(lv.floorY) ? lv.floorY.length : 0;
  const bottom = nFloors - 1;
  const inCols = (c: number) => Number.isInteger(c) && c >= 0 && c < lv.cols;
  const inFloors = (f: number) => Number.isInteger(f) && f >= 0 && f < nFloors;

  for (const f of lv.diggableFloors ?? []) {
    if (!inFloors(f)) errors.push(`diggable floor ${f} out of range`);
    if (f === bottom) errors.push('bottom floor may not be diggable in Stage 1');
  }

  const ladderCells = new Set<string>();
  for (const [i, l] of (lv.ladders ?? []).entries()) {
    if (!inCols(l.col)) errors.push(`ladder ${i} col out of range`);
    if (!inFloors(l.top) || !inFloors(l.bottom) || l.bottom !== l.top + 1)
      errors.push(`ladder ${i} must connect adjacent floors (top+1 === bottom)`);
    ladderCells.add(`${l.top}:${l.col}`);
    ladderCells.add(`${l.bottom}:${l.col}`);
  }

  // Reachability: every floor must be connected to the player's floor by ladders.
  if (nFloors > 0) {
    const reach = new Set<number>([lv.player?.floor ?? 0]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of lv.ladders ?? []) {
        if (reach.has(l.top) !== reach.has(l.bottom)) {
          reach.add(l.top);
          reach.add(l.bottom);
          grew = true;
        }
      }
    }
    for (let f = 0; f < nFloors; f++) if (!reach.has(f)) errors.push(`floor ${f} unreachable by ladders`);
  }

  if (!lv.player || !inCols(lv.player.col) || !inFloors(lv.player.floor)) errors.push('player spawn invalid');
  if (!Array.isArray(lv.enemies) || lv.enemies.length === 0) errors.push('level needs at least one enemy');
  for (const [i, e] of (lv.enemies ?? []).entries()) {
    if (!['red', 'green', 'blue'].includes(e.kind)) errors.push(`enemy ${i} kind invalid`);
    if (!inCols(e.col) || !inFloors(e.floor)) errors.push(`enemy ${i} spawn invalid`);
  }
  for (const [i, h] of (lv.presetHoles ?? []).entries()) {
    if (!inCols(h.col) || !inFloors(h.floor)) errors.push(`preset hole ${i} out of range`);
    else if (!(lv.diggableFloors ?? []).includes(h.floor)) errors.push(`preset hole ${i} on non-diggable floor`);
    else if (ladderCells.has(`${h.floor}:${h.col}`)) errors.push(`preset hole ${i} on a ladder cell`);
  }
  if (!(lv.timeLimitSec > 0)) errors.push('timeLimitSec must be > 0');
  if (!Number.isInteger(lv.seed)) errors.push('seed must be an integer');
  for (const [k, v] of Object.entries(lv.tuning ?? {})) {
    if (typeof v !== 'number' || !(v >= 0)) errors.push(`tuning.${k} must be a non-negative number`);
  }
  for (const [k, v] of Object.entries(lv.theme ?? {})) {
    if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) errors.push(`theme.${k} must be #rrggbb`);
  }

  if (errors.length) throw new LevelValidationError(`Level "${lv.id}": ${errors.join('; ')}`);
  return lv;
}
