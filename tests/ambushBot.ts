import { MapGrid } from '../src/core/MapGrid';
import type { Simulation } from '../src/core/Simulation';
import { ENEMY_KINDS, NO_INPUT, type InputFrame } from '../src/core/types';

/**
 * A simple scripted player used to prove levels are clearable.
 * Strategy ("stacked ambush"): dig an aligned shaft next to `col` from floor `upper` down to floor
 * `lower` — the lower holes first, deepest first, each from the outside so the bot never has to cross
 * it — then stand at `col` on `upper`, open the shaft top and a plain hole on the other side, and
 * pound whatever gets trapped next to it. A trapped enemy in the shaft falls (lower - upper + 1)
 * floors: 2 is enough for green, 3 for blue. Basic danger handling: wait clear of busy ladders,
 * dig a hole toward an approaching enemy, step away if it is very close.
 * Navigation fills any open hole in its path instead of falling through it.
 */
export class AmbushBot {
  private lastKey: 'L' | 'R' | null = null;
  private lastPurpose = '';

  constructor(
    readonly col: number,
    readonly upper: number,
    /** Deepest floor of the shaft (upper + 1 for a 2-floor drop, upper + 2 for 3). */
    readonly lower: number,
    /** Which side of `col` the shaft is on (-1 left, 1 right). */
    readonly side: -1 | 1 = -1,
  ) {}

  decide(sim: Simulation): InputFrame {
    if (sim.status !== 'PLAYING') return this.none();
    const p = sim.player;
    if (p.state === 'FALLING') return this.none();
    const map = sim.map;
    const cx = MapGrid.colCenter(this.col);

    // Pound a trapped enemy next to us if its fall will be deep enough.
    if (!p.ladder) {
      const pc = MapGrid.colOf(p.x);
      for (const e of sim.enemies) {
        if (e.state !== 'TRAPPED' || e.floor !== p.floor || Math.abs(e.trapCol - pc) !== 1) continue;
        if (Math.abs(p.x - MapGrid.colCenter(pc)) > 6) continue;
        let land = e.floor + 1;
        while (land < map.bottomFloor && map.isOpen(land, e.trapCol)) land++;
        // Deep enough -> defeat. Not deep enough -> still knock it down a floor to get it off ours.
        void ENEMY_KINDS;
        void land;
        return this.act(e.trapCol < pc ? 'L' : 'R', `pound${e.id}`);
      }
    }

    // Defence: an enemy walking toward us on our floor -> dig a hole between us, or run if too close.
    if (!p.ladder) {
      const pc = MapGrid.colOf(p.x);
      const threats = sim.enemies
        .filter((e) => (e.state === 'PATROL') && e.floor === p.floor && !e.ladder)
        .filter((e) => Math.sign(p.x - e.x) === e.dir || Math.abs(p.x - e.x) < 45)
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
      const t = threats[0];
      if (t) {
        const d = Math.abs(t.x - p.x);
        const side = t.x < p.x ? -1 : 1;
        const toward = pc + side;
        const st = map.holeState(p.floor, toward);
        const centred = Math.abs(p.x - MapGrid.colCenter(pc)) <= 6;
        const roomAway = side < 0 ? p.x < 900 : p.x > 60;
        if (d < 40 && roomAway) return { ...NO_INPUT, ...(side < 0 ? { right: true } : { left: true }) };
        if (d < 210 && st !== 'OPEN' && st !== 'OCCUPIED' && st !== 'POUNDING' && map.canDig(p.floor, toward) && centred) {
          return this.act(side < 0 ? 'L' : 'R', `defend${p.floor}:${toward}`);
        }
        if (d < 210 && (st === 'OPEN' || st === 'OCCUPIED')) return this.none(); // let it walk in
      }
    }

    const open = (f: number, c: number) => {
      const st = map.holeState(f, c);
      return st === 'OPEN' || st === 'OCCUPIED' || st === 'POUNDING';
    };
    const shaft = this.col + this.side; // column of the 2-deep shaft
    const outerKey: 'L' | 'R' = this.side < 0 ? 'R' : 'L';

    // 1) Lower part of the shaft (floors upper+1 … lower), deepest first, each dug from OUTSIDE
    //    so we never have to cross our own hole.
    for (let lf = this.lower; lf > this.upper; lf--) {
      if (open(lf, shaft)) continue;
      const stand = MapGrid.colCenter(this.col + 2 * this.side);
      if (!this.navigate(sim, lf, stand)) return this.lastNav;
      return this.act(outerKey, `dig-lower${lf}`);
    }
    // 2) Upper floor: stand next to the shaft, open the shaft top and a plain hole on the other side.
    if (!this.navigate(sim, this.upper, cx)) return this.lastNav;
    const f = this.upper;
    const sideKey: 'L' | 'R' = this.side < 0 ? 'L' : 'R';
    const otherKey: 'L' | 'R' = sideKey === 'L' ? 'R' : 'L';
    const other = this.col - this.side;
    if (!open(f, shaft) && map.holeState(f, shaft) !== 'REFILLING') return this.act(sideKey, 'dig-shaft-top');
    if (!open(f, other) && map.holeState(f, other) !== 'REFILLING') return this.act(otherKey, 'dig-other');
    return this.none();
  }

  private lastNav: InputFrame = NO_INPUT;

  /** Returns true when standing at (floor, x). Otherwise sets lastNav to the input to use. */
  private navigate(sim: Simulation, floor: number, x: number): boolean {
    const p = sim.player;
    const map = sim.map;
    const go = (frame: Partial<InputFrame>) => {
      this.lastNav = { ...NO_INPUT, ...frame, ...this.releaseFrame() };
      return false;
    };
    if (p.ladder) return go(floor <= p.ladder.top ? { up: true } : { down: true });
    let tx = x;
    let wantFloor = floor;
    if (p.floor !== floor) {
      const up = floor < p.floor;
      const cands = map.ladders.filter((l) => (up ? l.bottom === p.floor : l.top === p.floor));
      cands.sort((a, b) => Math.abs(MapGrid.colCenter(a.col) - p.x) - Math.abs(MapGrid.colCenter(b.col) - p.x));
      const l = cands[0]!;
      tx = MapGrid.colCenter(l.col);
      const dest = up ? l.top : l.bottom;
      const busy = sim.enemies.some(
        (e) =>
          (e.state === 'CLIMBING' && e.ladder?.col === l.col) ||
          ((e.state === 'PATROL' || e.state === 'STUNNED') && e.floor === dest && Math.abs(e.x - tx) < 90),
      );
      if (busy) {
        // Keep clear of a ladder someone is using; wait at a distance.
        if (Math.abs(p.x - tx) < 110) {
          const away = p.x < tx ? (p.x > 60 ? -1 : 1) : p.x < 900 ? 1 : -1;
          return go(away < 0 ? { left: true } : { right: true });
        }
        this.lastNav = this.none();
        return false;
      }
      if (Math.abs(p.x - tx) <= 4) return go(up ? { up: true } : { down: true });
      wantFloor = p.floor;
    }
    if (Math.abs(p.x - tx) <= 4) {
      this.lastNav = this.none();
      return p.floor === wantFloor && p.floor === floor;
    }
    const dir = tx > p.x ? 1 : -1;
    // Fill an open hole in the way rather than dropping through it.
    const pc = MapGrid.colOf(p.x);
    const nextCol = pc + dir;
    const centred = Math.abs(p.x - MapGrid.colCenter(pc)) <= 4;
    if (map.isOpen(p.floor, nextCol) && centred) {
      this.lastNav = this.act(dir < 0 ? 'L' : 'R', `fill${p.floor}:${nextCol}`);
      return false;
    }
    return go(dir > 0 ? { right: true } : { left: true });
  }

  /** Hold J/K like a human: release for one step when switching to a new purpose. */
  private act(key: 'L' | 'R', purpose: string): InputFrame {
    if (purpose !== this.lastPurpose && this.lastKey === key) {
      this.lastPurpose = purpose;
      this.lastKey = null;
      return this.none();
    }
    this.lastPurpose = purpose;
    this.lastKey = key;
    return key === 'L' ? { ...NO_INPUT, digLeftHeld: true } : { ...NO_INPUT, digRightHeld: true };
  }

  private releaseFrame(): Partial<InputFrame> {
    this.lastKey = null;
    return {};
  }

  private none(): InputFrame {
    this.lastKey = null;
    return NO_INPUT;
  }
}
