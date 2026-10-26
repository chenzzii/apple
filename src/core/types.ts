/** Shared simulation types. No Phaser imports allowed in src/core. */

export type Dir = -1 | 1;

export type EnemyKind = 'red' | 'green' | 'blue';

export interface EnemyKindInfo {
  /** Consecutive floors an enemy must fall in ONE fall to be defeated. Verified from the original manual. */
  requiredFallFloors: number;
  /** Base score per floor fallen. Verified from the original manual (100/200/300). */
  baseScore: number;
}

export const ENEMY_KINDS: Readonly<Record<EnemyKind, EnemyKindInfo>> = Object.freeze({
  red: { requiredFallFloors: 1, baseScore: 100 },
  green: { requiredFallFloors: 2, baseScore: 200 },
  blue: { requiredFallFloors: 3, baseScore: 300 },
});

export type PlayerState =
  | 'IDLE'
  | 'WALKING'
  | 'CLIMBING'
  | 'DIGGING'
  | 'POUNDING'
  | 'HURT'
  | 'DEAD'
  | 'RESPAWNING';

export type EnemyState = 'PATROL' | 'CLIMBING' | 'FALLING' | 'TRAPPED' | 'ESCAPING' | 'STUNNED' | 'DEFEATED';

export type HoleState = 'SOLID' | 'DIGGING' | 'OPEN' | 'OCCUPIED' | 'POUNDING' | 'REFILLING';

export type GameStatus = 'READY' | 'PLAYING' | 'LIFE_LOST' | 'LEVEL_CLEAR' | 'GAME_OVER';

/** One logic-step worth of input. `*Pressed` are edge flags latched by the input layer. */
export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  digHeld: boolean;
  digPressed: boolean;
  poundHeld: boolean;
  poundPressed: boolean;
}

export const NO_INPUT: Readonly<InputFrame> = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  digHeld: false,
  digPressed: false,
  poundHeld: false,
  poundPressed: false,
});

export interface LadderDef {
  col: number;
  /** Upper floor index (smaller number = higher on screen). */
  top: number;
  /** Lower floor index; must equal top + 1. */
  bottom: number;
}

export interface EnemySpawn {
  kind: EnemyKind;
  col: number;
  floor: number;
  dir?: Dir;
}

export interface LevelData {
  id: string;
  name: string;
  cols: number;
  /** World-space Y of each walkable floor surface, top to bottom. */
  floorY: number[];
  /** Floors whose tiles may be dug. The bottom floor is never diggable in Stage 1. */
  diggableFloors: number[];
  ladders: LadderDef[];
  player: { col: number; floor: number };
  enemies: EnemySpawn[];
  timeLimitSec: number;
  seed: number;
  /** Optional pre-opened holes (used by the mechanics test level). */
  presetHoles?: { floor: number; col: number }[];
  /** Mechanics/debug level flag: allows re-opening preset holes with a key. */
  debug?: boolean;
}

export type GameEvent =
  | { type: 'hole-dig-progress'; floor: number; col: number; progress: number }
  | { type: 'hole-opened'; floor: number; col: number }
  | { type: 'hole-fill-progress'; floor: number; col: number; progress: number }
  | { type: 'hole-filled'; floor: number; col: number }
  | { type: 'enemy-trapped'; enemyId: number; floor: number; col: number }
  | { type: 'hole-pound-progress'; enemyId: number; floor: number; col: number; progress: number }
  | { type: 'enemy-fall-started'; enemyId: number; fromFloor: number; col: number }
  | { type: 'enemy-landed'; enemyId: number; floorsFallen: number; survived: boolean }
  | { type: 'enemy-defeated'; enemyId: number; kind: EnemyKind; floorsFallen: number; points: number; x: number; y: number }
  | { type: 'enemy-escaped'; enemyId: number }
  | { type: 'invalid-action'; action: 'dig' | 'pound' }
  | { type: 'player-hit'; livesLeft: number }
  | { type: 'life-lost'; livesLeft: number; reason: 'enemy' | 'time' }
  | { type: 'level-cleared'; timeBonus: number; score: number }
  | { type: 'game-over'; score: number };
