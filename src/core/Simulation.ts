import { DEFAULT_CONFIG, STEP_MS, STEP_SEC, WORLD_W, secToSteps, type GameplayConfig } from './config';
import { MapGrid, type Tile } from './MapGrid';
import { SeededRng } from './rng';
import {
  ENEMY_KINDS,
  type Dir,
  type EnemyKind,
  type EnemySpawn,
  type EnemyState,
  type GameEvent,
  type GameStatus,
  type InputFrame,
  type LadderDef,
  type LevelData,
  type PlayerState,
} from './types';

export interface Player {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  floor: number;
  ladder: LadderDef | null;
  facing: Dir;
  state: PlayerState;
  invulnSteps: number;
  cooldownSteps: number;
  actionAnimSteps: number;
  lastAction: 'dig' | 'pound' | null;
  /** Floor index the player is falling toward (only while FALLING). */
  fallTarget: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  spawn: EnemySpawn;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  floor: number;
  dir: Dir;
  state: EnemyState;
  ladder: LadderDef | null;
  climbDir: Dir;
  timerSteps: number;
  /** Floor index the current fall started from. */
  fallFrom: number;
  /** Floor index the enemy is currently falling toward. */
  fallTarget: number;
  trapCol: number;
  /** Total floors fallen in the most recent fall (for display/tests). */
  lastFallFloors: number;
}

export interface SimOptions {
  config?: Partial<GameplayConfig>;
  score?: number;
  lives?: number;
  /** Override level seed (tests). */
  seed?: number;
}

/** How deep a trapped enemy sinks into the hole (render + logic y). */
export const TRAP_SINK = 20;

/**
 * Authoritative, deterministic, Phaser-free game simulation.
 * Call step() exactly once per fixed 60 Hz logic tick.
 */
export class Simulation {
  readonly cfg: GameplayConfig;
  readonly level: LevelData;
  readonly map: MapGrid;
  readonly player: Player;
  readonly enemies: Enemy[];
  status: GameStatus = 'READY';
  score: number;
  lives: number;
  /** Logic steps executed while PLAYING (game time). */
  playSteps = 0;
  stepCount = 0;
  private timeLeftSteps: number;
  private statusTimer: number;
  private readonly rng: SeededRng;
  private events: GameEvent[] = [];
  private readonly s: {
    pulseCooldown: number;
    trap: number;
    escape: number;
    stun: number;
    invuln: number;
    lifeLost: number;
    ready: number;
    timeLimit: number;
  };

  constructor(level: LevelData, opts: SimOptions = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...opts.config };
    this.level = level;
    this.map = new MapGrid(level, this.cfg.digPulses);
    this.rng = new SeededRng(opts.seed ?? level.seed);
    this.score = opts.score ?? 0;
    this.lives = opts.lives ?? this.cfg.startLives;
    this.s = {
      pulseCooldown: Math.max(1, Math.round(this.cfg.pulseCooldownMs / STEP_MS)),
      trap: secToSteps(this.cfg.trapSeconds),
      escape: secToSteps(this.cfg.escapeSeconds),
      stun: secToSteps(this.cfg.landStunSeconds),
      invuln: secToSteps(this.cfg.invulnSeconds),
      lifeLost: secToSteps(this.cfg.lifeLostSeconds),
      ready: secToSteps(this.cfg.readySeconds),
      timeLimit: secToSteps(level.timeLimitSec),
    };
    this.timeLeftSteps = this.s.timeLimit;
    this.statusTimer = this.s.ready;
    this.player = {
      x: 0, y: 0, prevX: 0, prevY: 0, floor: 0, ladder: null, facing: 1, state: 'IDLE',
      invulnSteps: 0, cooldownSteps: 0, actionAnimSteps: 0, lastAction: null, fallTarget: 0,
    };
    this.enemies = level.enemies.map((spawn, i) => ({
      id: i + 1, kind: spawn.kind, spawn, x: 0, y: 0, prevX: 0, prevY: 0, floor: 0, dir: 1 as Dir,
      state: 'PATROL' as EnemyState, ladder: null, climbDir: 1 as Dir, timerSteps: 0,
      fallFrom: 0, fallTarget: 0, trapCol: 0, lastFallFloors: 0,
    }));
    this.resetActors(true);
  }

  // ---------------------------------------------------------------- public API

  get timeLeftSec(): number {
    return this.timeLeftSteps * STEP_SEC;
  }

  get remainingEnemies(): number {
    return this.enemies.filter((e) => e.state !== 'DEFEATED').length;
  }

  /** Returns and clears events emitted since the last drain. */
  drainEvents(): GameEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  /** Column of the player's tile; J acts on col-1, K on col+1. */
  get playerCol(): number {
    return MapGrid.colOf(this.player.x);
  }

  /** Whether the player can currently act on the floor (not mid-ladder, not falling). */
  get playerOnFloor(): boolean {
    return this.player.ladder === null && this.player.state !== 'FALLING';
  }

  /** Debug/mechanics level helper: re-open preset aligned holes (one key). */
  reopenPresetHoles(): void {
    for (const h of this.level.presetHoles ?? []) {
      const t = this.map.tile(h.floor, h.col);
      if (t && t.trappedEnemyId !== null) continue;
      // Never open a hole directly under an enemy that is standing/climbing out there.
      const cx = MapGrid.colCenter(h.col);
      const blocked = this.enemies.some(
        (e) => e.state !== 'DEFEATED' && e.floor === h.floor && Math.abs(e.x - cx) < 40,
      );
      if (blocked) continue;
      this.map.setOpen(h.floor, h.col);
    }
  }

  /** Advance one fixed 60 Hz logic step. */
  step(input: InputFrame): void {
    this.stepCount++;
    this.savePrev();
    switch (this.status) {
      case 'READY':
        if (--this.statusTimer <= 0) this.status = 'PLAYING';
        return;
      case 'LIFE_LOST':
        if (--this.statusTimer <= 0) {
          this.resetActors(false);
          this.status = 'READY';
          this.statusTimer = this.s.ready;
        }
        return;
      case 'LEVEL_CLEAR':
      case 'GAME_OVER':
        return;
      case 'PLAYING':
        break;
    }

    this.playSteps++;
    this.updatePlayer(input);
    this.updateEnemies();
    if (this.status !== 'PLAYING') return;
    this.checkContacts();
    if (this.status !== 'PLAYING') return;

    if (this.remainingEnemies === 0) {
      this.clearLevel();
      return;
    }
    if (--this.timeLeftSteps <= 0) {
      this.timeLeftSteps = 0;
      this.loseLife('time');
    }
  }

  // ---------------------------------------------------------------- setup

  private savePrev(): void {
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    for (const e of this.enemies) {
      e.prevX = e.x;
      e.prevY = e.y;
    }
  }

  /** Level start / respawn: holes cleared (+presets), surviving enemies back to spawn. */
  private resetActors(initial: boolean): void {
    this.map.clearAll();
    for (const h of this.level.presetHoles ?? []) this.map.setOpen(h.floor, h.col);
    const p = this.player;
    p.floor = this.level.player.floor;
    p.x = MapGrid.colCenter(this.level.player.col);
    p.y = this.level.floorY[p.floor]!;
    p.ladder = null;
    p.facing = 1;
    p.state = 'IDLE';
    p.invulnSteps = this.s.invuln;
    p.cooldownSteps = 0;
    p.actionAnimSteps = 0;
    p.lastAction = null;
    p.fallTarget = 0;
    for (const e of this.enemies) {
      if (!initial && e.state === 'DEFEATED') continue;
      e.floor = e.spawn.floor;
      e.x = MapGrid.colCenter(e.spawn.col);
      e.y = this.level.floorY[e.floor]!;
      e.dir = e.spawn.dir ?? 1;
      e.state = 'PATROL';
      e.ladder = null;
      e.timerSteps = 0;
      e.lastFallFloors = 0;
    }
    this.timeLeftSteps = this.s.timeLimit;
    this.savePrev();
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(input: InputFrame): void {
    const p = this.player;
    const cfg = this.cfg;
    if (p.invulnSteps > 0) p.invulnSteps--;
    if (p.cooldownSteps > 0) p.cooldownSteps--;
    if (p.actionAnimSteps > 0) p.actionAnimSteps--;
    let moved = false;

    if (p.state === 'FALLING') {
      this.playerFall();
      return; // no control while falling (there is no jump either)
    }

    if (p.ladder) {
      const l = p.ladder;
      const v = cfg.playerClimbSpeed * STEP_SEC;
      const top = this.level.floorY[l.top]!;
      const bot = this.level.floorY[l.bottom]!;
      if (input.up && !input.down) p.y -= v;
      else if (input.down && !input.up) p.y += v;
      if (p.y <= top) {
        p.y = top;
        p.floor = l.top;
        p.ladder = null;
      } else if (p.y >= bot) {
        p.y = bot;
        p.floor = l.bottom;
        p.ladder = null;
      }
      p.state = p.ladder ? 'CLIMBING' : 'IDLE';
      if (p.ladder) return;
    } else {
      const col = MapGrid.colOf(p.x);
      const nearCenter = Math.abs(p.x - MapGrid.colCenter(col)) <= cfg.ladderSnap;
      const up = input.up && !input.down ? this.map.ladderUpFrom(p.floor, col) : undefined;
      const down = input.down && !input.up ? this.map.ladderDownFrom(p.floor, col) : undefined;
      const lad = nearCenter ? (up ?? down) : undefined;
      if (lad) {
        p.ladder = lad;
        p.x = MapGrid.colCenter(col);
        p.state = 'CLIMBING';
        return;
      }
      const h = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (h !== 0) {
        p.facing = h as Dir;
        const v = cfg.playerSpeed * STEP_SEC;
        p.x = clamp(p.x + h * v, cfg.playerHalfW, WORLD_W - cfg.playerHalfW);
        moved = true;
      }
      p.state = moved ? 'WALKING' : 'IDLE';
      // Walking onto an open hole drops the player to the floor below.
      if (this.startPlayerFallIfOverHole()) return;
    }

    // J = act on the LEFT tile, K = act on the RIGHT tile. Each pulse digs, or pounds
    // if that tile holds a trapped enemy. Only while standing on a floor.
    if (p.cooldownSteps === 0) {
      const left = input.digLeftPressed || input.digLeftHeld;
      const right = input.digRightPressed || input.digRightHeld;
      if (left || right) {
        const dir: Dir = left ? -1 : 1;
        const explicit = left ? input.digLeftPressed : input.digRightPressed;
        p.facing = dir;
        this.actPulse(dir, explicit);
        p.cooldownSteps = this.s.pulseCooldown;
      }
    }
    if (p.actionAnimSteps > 0) p.state = p.lastAction === 'dig' ? 'DIGGING' : 'POUNDING';
  }

  private startPlayerFallIfOverHole(): boolean {
    const p = this.player;
    const col = MapGrid.colOf(p.x);
    if (!this.map.isOpen(p.floor, col)) return false;
    if (Math.abs(p.x - MapGrid.colCenter(col)) > this.cfg.holeCatch) return false;
    p.x = MapGrid.colCenter(col);
    p.state = 'FALLING';
    p.fallTarget = p.floor + 1;
    p.actionAnimSteps = 0;
    this.emit({ type: 'player-fall-started', floor: p.floor, col });
    return true;
  }

  private playerFall(): void {
    const p = this.player;
    const col = MapGrid.colOf(p.x);
    p.y += this.cfg.fallSpeed * STEP_SEC;
    // Like enemies, keep falling through ALIGNED open holes below.
    while (p.y >= this.level.floorY[p.fallTarget]!) {
      const f = p.fallTarget;
      if (f < this.map.bottomFloor && this.map.isOpen(f, col)) {
        p.fallTarget = f + 1;
        continue;
      }
      p.y = this.level.floorY[f]!;
      p.floor = f;
      p.state = 'IDLE';
      this.emit({ type: 'player-landed', floor: f });
      return;
    }
  }

  /** One dig/pound pulse on the tile at the player's column + dir. */
  private actPulse(dir: Dir, explicit: boolean): void {
    const p = this.player;
    const col = MapGrid.colOf(p.x) + dir;
    const f = p.floor;
    const t = this.map.canDig(f, col) ? this.map.ensureTile(f, col) : undefined;
    if (t && t.trappedEnemyId !== null) {
      const enemy = this.enemies.find((e) => e.id === t.trappedEnemyId);
      if (!enemy || enemy.state !== 'TRAPPED') {
        if (explicit) this.emit({ type: 'invalid-action', action: 'pound' });
        return;
      }
      t.poundProgress++;
      p.lastAction = 'pound';
      p.actionAnimSteps = 8;
      this.emit({ type: 'hole-pound-progress', enemyId: enemy.id, floor: f, col, progress: t.poundProgress });
      if (t.poundProgress >= this.cfg.poundPulses) this.knockThrough(enemy, t);
      return;
    }
    if (!t || t.progress >= this.cfg.digPulses) {
      if (explicit) this.emit({ type: 'invalid-action', action: 'dig' });
      return;
    }
    t.progress++;
    t.lastAction = 'dig';
    p.lastAction = 'dig';
    p.actionAnimSteps = 8;
    this.emit({ type: 'hole-dig-progress', floor: f, col, progress: t.progress });
    if (t.progress >= this.cfg.digPulses) this.emit({ type: 'hole-opened', floor: f, col });
  }

  private knockThrough(e: Enemy, t: Tile): void {
    // The pounded hole is sealed behind the enemy; only holes BELOW can extend the fall.
    this.map.fill(t.floor, t.col);
    e.state = 'FALLING';
    e.fallFrom = t.floor;
    e.fallTarget = t.floor + 1;
    e.x = MapGrid.colCenter(t.col);
    e.trapCol = t.col;
    this.emit({ type: 'enemy-fall-started', enemyId: e.id, fromFloor: t.floor, col: t.col });
  }

  // ---------------------------------------------------------------- enemies

  private updateEnemies(): void {
    for (const e of this.enemies) {
      switch (e.state) {
        case 'PATROL':
          this.enemyPatrol(e);
          break;
        case 'CLIMBING':
          this.enemyClimb(e);
          break;
        case 'TRAPPED':
          if (--e.timerSteps <= 0) {
            e.state = 'ESCAPING';
            e.timerSteps = this.s.escape;
          }
          break;
        case 'ESCAPING':
          e.y = this.level.floorY[e.floor]! + TRAP_SINK * (e.timerSteps / Math.max(1, this.s.escape));
          if (--e.timerSteps <= 0) {
            // PROVISIONAL: climbing out seals the hole (prevents instant re-trap loops).
            this.map.fill(e.floor, e.trapCol);
            e.y = this.level.floorY[e.floor]!;
            e.state = 'PATROL';
            this.emit({ type: 'enemy-escaped', enemyId: e.id });
          }
          break;
        case 'FALLING':
          this.enemyFall(e);
          break;
        case 'STUNNED':
          if (--e.timerSteps <= 0) e.state = 'PATROL';
          break;
        case 'DEFEATED':
          break;
      }
    }
  }

  private enemyPatrol(e: Enemy): void {
    const cfg = this.cfg;
    const prevX = e.x;
    e.x += e.dir * cfg.enemySpeed * STEP_SEC;
    const minX = cfg.enemyHalfW;
    const maxX = WORLD_W - cfg.enemyHalfW;
    if (e.x <= minX) {
      e.x = minX;
      e.dir = 1;
    } else if (e.x >= maxX) {
      e.x = maxX;
      e.dir = -1;
    }

    // Ladder decision when the enemy centre crosses a ladder column centre.
    const col = MapGrid.colOf(e.x);
    const cx = MapGrid.colCenter(col);
    const crossed = (prevX < cx && e.x >= cx) || (prevX > cx && e.x <= cx);
    if (crossed) {
      const up = this.map.ladderUpFrom(e.floor, col);
      const down = this.map.ladderDownFrom(e.floor, col);
      if (up || down) {
        const pf = this.playerFloorEstimate();
        const towardUp = up && pf < e.floor;
        const towardDown = down && pf > e.floor;
        let pick: { l: LadderDef; d: Dir } | null = null;
        if (towardUp && this.rng.chance(cfg.ladderTowardPlayerChance)) pick = { l: up, d: -1 };
        else if (towardDown && this.rng.chance(cfg.ladderTowardPlayerChance)) pick = { l: down, d: 1 };
        else if (up && !towardUp && this.rng.chance(cfg.ladderOtherChance)) pick = { l: up, d: -1 };
        else if (down && !towardDown && this.rng.chance(cfg.ladderOtherChance)) pick = { l: down, d: 1 };
        if (pick) {
          e.x = cx;
          e.ladder = pick.l;
          e.climbDir = pick.d;
          e.state = 'CLIMBING';
          return;
        }
      }
    }

    // Fall into an open hole only when the logical centre is over the hole column.
    const hc = MapGrid.colOf(e.x);
    if (this.map.isOpen(e.floor, hc) && Math.abs(e.x - MapGrid.colCenter(hc)) <= cfg.holeCatch) {
      const t = this.map.ensureTile(e.floor, hc);
      t.trappedEnemyId = e.id;
      t.poundProgress = 0;
      e.state = 'TRAPPED';
      e.x = MapGrid.colCenter(hc);
      e.y = this.level.floorY[e.floor]! + TRAP_SINK;
      e.trapCol = hc;
      e.timerSteps = this.s.trap;
      this.emit({ type: 'enemy-trapped', enemyId: e.id, floor: e.floor, col: hc });
    }
  }

  private enemyClimb(e: Enemy): void {
    const l = e.ladder!;
    e.y += e.climbDir * this.cfg.enemyClimbSpeed * STEP_SEC;
    const top = this.level.floorY[l.top]!;
    const bot = this.level.floorY[l.bottom]!;
    if (e.y <= top) {
      e.y = top;
      e.floor = l.top;
      e.ladder = null;
      e.state = 'PATROL';
    } else if (e.y >= bot) {
      e.y = bot;
      e.floor = l.bottom;
      e.ladder = null;
      e.state = 'PATROL';
    }
  }

  private enemyFall(e: Enemy): void {
    e.y += this.cfg.fallSpeed * STEP_SEC;
    // Loop handles multiple floor boundaries crossed in a single step (high fall speeds).
    while (e.y >= this.level.floorY[e.fallTarget]!) {
      const f = e.fallTarget;
      const passThrough = f < this.map.bottomFloor && this.map.isOpen(f, e.trapCol);
      if (passThrough) {
        e.fallTarget = f + 1;
        continue;
      }
      this.enemyLand(e, f);
      return;
    }
  }

  private enemyLand(e: Enemy, floor: number): void {
    const floorsFallen = floor - e.fallFrom;
    e.y = this.level.floorY[floor]!;
    e.floor = floor;
    e.lastFallFloors = floorsFallen;
    const info = ENEMY_KINDS[e.kind];
    if (floorsFallen >= info.requiredFallFloors) {
      // Single explicit transition FALLING -> DEFEATED: the only place points are awarded.
      e.state = 'DEFEATED';
      const points = info.baseScore * floorsFallen;
      this.score += points;
      this.emit({ type: 'enemy-landed', enemyId: e.id, floorsFallen, survived: false });
      this.emit({ type: 'enemy-defeated', enemyId: e.id, kind: e.kind, floorsFallen, points, x: e.x, y: e.y });
    } else {
      e.state = 'STUNNED';
      e.timerSteps = this.s.stun;
      this.emit({ type: 'enemy-landed', enemyId: e.id, floorsFallen, survived: true });
    }
  }

  private playerFloorEstimate(): number {
    const p = this.player;
    if (!p.ladder) return p.floor;
    const mid = (this.level.floorY[p.ladder.top]! + this.level.floorY[p.ladder.bottom]!) / 2;
    return p.y < mid ? p.ladder.top : p.ladder.bottom;
  }

  // ---------------------------------------------------------------- contacts / flow

  private checkContacts(): void {
    const p = this.player;
    if (p.invulnSteps > 0) return;
    const cfg = this.cfg;
    for (const e of this.enemies) {
      if (e.state !== 'PATROL' && e.state !== 'CLIMBING') continue;
      if (Math.abs(e.x - p.x) < cfg.playerHalfW + cfg.enemyHalfW - 4 && Math.abs(e.y - p.y) < cfg.contactHalfH) {
        this.loseLife('enemy');
        return;
      }
    }
  }

  private loseLife(reason: 'enemy' | 'time'): void {
    this.lives = Math.max(0, this.lives - 1);
    this.player.state = 'HURT';
    if (reason === 'enemy') this.emit({ type: 'player-hit', livesLeft: this.lives });
    this.emit({ type: 'life-lost', livesLeft: this.lives, reason });
    if (this.lives <= 0) {
      this.status = 'GAME_OVER';
      this.player.state = 'DEAD';
      this.emit({ type: 'game-over', score: this.score });
    } else {
      this.status = 'LIFE_LOST';
      this.statusTimer = this.s.lifeLost;
    }
  }

  private clearLevel(): void {
    this.status = 'LEVEL_CLEAR';
    const timeBonus = Math.floor(this.timeLeftSec) * this.cfg.timeBonusPerSecond;
    this.score += timeBonus;
    this.emit({ type: 'level-cleared', timeBonus, score: this.score });
  }

  private emit(ev: GameEvent): void {
    this.events.push(ev);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
