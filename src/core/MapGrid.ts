import { TILE } from './config';
import type { HoleState, LadderDef, LevelData } from './types';

/** One diggable floor tile. progress: 0 = solid … digPulses = open. */
export interface Tile {
  floor: number;
  col: number;
  progress: number;
  /** Last action applied while partially dug, to distinguish DIGGING vs REFILLING. */
  lastAction: 'dig' | 'fill' | null;
  /** Id of the enemy trapped in this hole, or null. */
  trappedEnemyId: number | null;
  poundProgress: number;
}

/**
 * Logical topology: floors, ladders, and per-tile hole state.
 * Never derived from graphics; this is the single source of truth.
 */
export class MapGrid {
  readonly cols: number;
  readonly floorY: readonly number[];
  readonly ladders: readonly LadderDef[];
  readonly bottomFloor: number;
  private readonly diggable: ReadonlySet<number>;
  private readonly ladderCells: ReadonlySet<string>;
  private readonly tiles = new Map<string, Tile>();

  constructor(
    level: LevelData,
    readonly openAt: number,
  ) {
    this.cols = level.cols;
    this.floorY = level.floorY;
    this.ladders = level.ladders;
    this.bottomFloor = level.floorY.length - 1;
    this.diggable = new Set(level.diggableFloors);
    const lc = new Set<string>();
    for (const l of level.ladders) {
      lc.add(key(l.top, l.col));
      lc.add(key(l.bottom, l.col));
    }
    this.ladderCells = lc;
  }

  static colOf(x: number): number {
    return Math.floor(x / TILE);
  }

  static colCenter(col: number): number {
    return col * TILE + TILE / 2;
  }

  isLadderCell(floor: number, col: number): boolean {
    return this.ladderCells.has(key(floor, col));
  }

  /** Whether a tile may ever be dug (bounds, diggable floor, not a ladder cell). */
  canDig(floor: number, col: number): boolean {
    if (!Number.isInteger(floor) || !Number.isInteger(col)) return false;
    if (col < 0 || col >= this.cols) return false;
    if (floor < 0 || floor > this.bottomFloor) return false;
    if (!this.diggable.has(floor)) return false;
    if (this.isLadderCell(floor, col)) return false;
    return true;
  }

  tile(floor: number, col: number): Tile | undefined {
    return this.tiles.get(key(floor, col));
  }

  /** Get or lazily create a tile record (only for diggable cells). */
  ensureTile(floor: number, col: number): Tile {
    const k = key(floor, col);
    let t = this.tiles.get(k);
    if (!t) {
      t = { floor, col, progress: 0, lastAction: null, trappedEnemyId: null, poundProgress: 0 };
      this.tiles.set(k, t);
    }
    return t;
  }

  isOpen(floor: number, col: number): boolean {
    const t = this.tile(floor, col);
    return !!t && t.progress >= this.openAt && t.trappedEnemyId === null;
  }

  holeState(floor: number, col: number): HoleState {
    const t = this.tile(floor, col);
    if (!t || t.progress <= 0) return 'SOLID';
    if (t.trappedEnemyId !== null) return t.poundProgress > 0 ? 'POUNDING' : 'OCCUPIED';
    if (t.progress >= this.openAt) return 'OPEN';
    return t.lastAction === 'fill' ? 'REFILLING' : 'DIGGING';
  }

  fill(floor: number, col: number): void {
    const t = this.tile(floor, col);
    if (!t) return;
    t.progress = 0;
    t.lastAction = null;
    t.trappedEnemyId = null;
    t.poundProgress = 0;
  }

  setOpen(floor: number, col: number): void {
    const t = this.ensureTile(floor, col);
    t.progress = this.openAt;
    t.lastAction = 'dig';
  }

  clearAll(): void {
    this.tiles.clear();
  }

  /** All tiles that are not solid (for rendering). */
  activeTiles(): Tile[] {
    return [...this.tiles.values()].filter((t) => t.progress > 0);
  }

  laddersAt(col: number): LadderDef[] {
    return this.ladders.filter((l) => l.col === col);
  }

  ladderUpFrom(floor: number, col: number): LadderDef | undefined {
    return this.ladders.find((l) => l.col === col && l.bottom === floor);
  }

  ladderDownFrom(floor: number, col: number): LadderDef | undefined {
    return this.ladders.find((l) => l.col === col && l.top === floor);
  }
}

function key(floor: number, col: number): string {
  return `${floor}:${col}`;
}
