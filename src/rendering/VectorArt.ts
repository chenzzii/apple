import * as Phaser from 'phaser';
import type { EnemyKind } from '../core/types';

/**
 * Original programmatic cartoon placeholders (Stage 1). Every draw function takes the
 * FOOT-CENTRE screen position so it can later be swapped for an atlas sprite with
 * origin (0.5, 1) without touching gameplay code.
 */
type G = Phaser.GameObjects.Graphics;

export const PALETTE = {
  ink: 0x2a1b3d,
  skyTop: 0x7fd3ff,
  skyBottom: 0xffe9b8,
  hillFar: 0x9fd98a,
  hillNear: 0x6fbf5e,
  brick: 0xc8794a,
  brickDark: 0x9a5532,
  brickLight: 0xf0a776,
  grassTop: 0x7ccf4d,
  ladder: 0x8e5cf0,
  ladderLight: 0xd7c2ff,
  hole: 0x1d1228,
  holeRim: 0xffd27a,
  red: 0xe8433f,
  redDark: 0xa82424,
  green: 0x4ccf6a,
  greenDark: 0x23894a,
  blue: 0x4b7bea,
  blueDark: 0x2647a8,
  skin: 0xffcfa3,
  overalls: 0x2f8f6f,
  shirt: 0xfff1d6,
  hat: 0xf2c14e,
  hatBand: 0xd9534f,
  steel: 0xcfd8e3,
  wood: 0x9b6a3c,
  white: 0xffffff,
  good: 0x5ee07a,
  bad: 0xff6b6b,
  gold: 0xffd34d,
} as const;

export const ENEMY_COLORS: Record<EnemyKind, { main: number; dark: number; label: string; floors: number }> = {
  red: { main: PALETTE.red, dark: PALETTE.redDark, label: '紅蘋果', floors: 1 },
  green: { main: PALETTE.green, dark: PALETTE.greenDark, label: '綠捕蠅草', floors: 2 },
  blue: { main: PALETTE.blue, dark: PALETTE.blueDark, label: '藍仙人掌', floors: 3 },
};

export interface GardenerPose {
  facing: -1 | 1;
  walkPhase: number; // radians, advances while walking
  climbing: boolean;
  falling: boolean;
  action: 'none' | 'dig' | 'pound';
  actionT: number; // 0..1 animation progress
  blink: boolean; // invulnerability flicker
  hurt: boolean;
}

/** Little original gardener: straw hat, teal overalls, tool belt, shovel. ~50px tall. */
export function drawGardener(g: G, x: number, y: number, pose: GardenerPose): void {
  if (pose.blink) return;
  const f = pose.facing;
  const swing = pose.falling ? 0 : Math.sin(pose.walkPhase);
  if (pose.falling) {
    // arms up + speed lines while dropping through a hole
    g.lineStyle(3, PALETTE.white, 0.6);
    g.lineBetween(x - 12, y - 64, x - 12, y - 86);
    g.lineBetween(x + 12, y - 60, x + 12, y - 80);
    g.fillStyle(PALETTE.skin, 1);
    g.lineStyle(3, PALETTE.ink, 1);
    g.fillCircle(x - 15, y - 54, 4.5);
    g.strokeCircle(x - 15, y - 54, 4.5);
    g.fillCircle(x + 15, y - 54, 4.5);
    g.strokeCircle(x + 15, y - 54, 4.5);
  }
  g.lineStyle(3, PALETTE.ink, 1);

  if (pose.climbing) {
    // Back view on ladder
    const s = Math.sin(pose.walkPhase) * 4;
    g.fillStyle(PALETTE.overalls, 1);
    g.fillRoundedRect(x - 7, y - 16 + s, 6, 16 - s, 2);
    g.fillRoundedRect(x + 1, y - 16 - s, 6, 16 + s, 2);
    g.fillStyle(PALETTE.overalls, 1);
    g.fillRoundedRect(x - 12, y - 36, 24, 22, 6);
    g.strokeRoundedRect(x - 12, y - 36, 24, 22, 6);
    g.fillStyle(PALETTE.skin, 1);
    g.fillCircle(x - 15, y - 34 - s, 4);
    g.fillCircle(x + 15, y - 34 + s, 4);
    g.fillStyle(PALETTE.skin, 1);
    g.fillCircle(x, y - 42, 9);
    g.strokeCircle(x, y - 42, 9);
    drawHat(g, x, y - 47, 1);
    return;
  }

  // Legs
  g.fillStyle(PALETTE.overalls, 1);
  g.fillRoundedRect(x - 8 + swing * 3, y - 14, 7, 14, 2);
  g.fillRoundedRect(x + 1 - swing * 3, y - 14, 7, 14, 2);
  g.fillStyle(PALETTE.ink, 1);
  g.fillEllipse(x - 4 + swing * 4 + f * 2, y - 1, 11, 5);
  g.fillEllipse(x + 5 - swing * 4 + f * 2, y - 1, 11, 5);

  // Body: shirt + overalls bib + tool belt
  g.fillStyle(PALETTE.shirt, 1);
  g.fillRoundedRect(x - 12, y - 36, 24, 24, 8);
  g.strokeRoundedRect(x - 12, y - 36, 24, 24, 8);
  g.fillStyle(PALETTE.overalls, 1);
  g.fillRoundedRect(x - 9, y - 30, 18, 18, 4);
  g.fillStyle(PALETTE.wood, 1);
  g.fillRect(x - 12, y - 17, 24, 4);
  g.fillStyle(PALETTE.gold, 1);
  g.fillRect(x - 2, y - 17, 4, 4);

  // Head
  const hurtTilt = pose.hurt ? 4 : 0;
  g.fillStyle(PALETTE.skin, 1);
  g.fillCircle(x + f * 1, y - 44 + hurtTilt, 10);
  g.strokeCircle(x + f * 1, y - 44 + hurtTilt, 10);
  // Face
  g.fillStyle(PALETTE.ink, 1);
  if (pose.hurt) {
    g.lineStyle(2, PALETTE.ink, 1);
    g.lineBetween(x + f * 3 - 2, y - 47 + hurtTilt, x + f * 3 + 2, y - 43 + hurtTilt);
    g.lineBetween(x + f * 3 + 2, y - 47 + hurtTilt, x + f * 3 - 2, y - 43 + hurtTilt);
  } else {
    g.fillCircle(x + f * 4, y - 45, 1.8);
    g.fillStyle(0xff8f8f, 0.7);
    g.fillCircle(x + f * 7, y - 41, 2.5);
  }
  g.lineStyle(3, PALETTE.ink, 1);
  drawHat(g, x + f, y - 50 + hurtTilt, f);

  // Arm + shovel
  let angle: number; // shovel angle from vertical, radians
  if (pose.action === 'dig') {
    angle = f * (0.2 + 1.1 * Math.sin(pose.actionT * Math.PI));
  } else if (pose.action === 'pound') {
    angle = f * (1.6 - 1.4 * Math.sin(pose.actionT * Math.PI));
  } else {
    angle = f * (0.35 + swing * 0.08);
  }
  const hx = x + f * 10;
  const hy = y - 28;
  const len = 30;
  const ex = hx + Math.sin(angle) * len;
  const ey = hy + Math.cos(angle) * len;
  g.lineStyle(4, PALETTE.wood, 1);
  g.lineBetween(hx, hy - 8, ex, ey);
  g.fillStyle(PALETTE.steel, 1);
  g.lineStyle(2, PALETTE.ink, 1);
  g.fillEllipse(ex, ey, 11, 13);
  g.strokeEllipse(ex, ey, 11, 13);
  g.fillStyle(PALETTE.skin, 1);
  g.fillCircle(hx, hy - 4, 4.5);
  g.strokeCircle(hx, hy - 4, 4.5);
}

function drawHat(g: G, x: number, y: number, f: number): void {
  g.fillStyle(PALETTE.hat, 1);
  g.fillEllipse(x, y + 2, 30, 8);
  g.strokeEllipse(x, y + 2, 30, 8);
  g.fillRoundedRect(x - 9, y - 8, 18, 10, 4);
  g.strokeRoundedRect(x - 9, y - 8, 18, 10, 4);
  g.fillStyle(PALETTE.hatBand, 1);
  g.fillRect(x - 9, y - 1, 18, 3);
  void f;
}

export interface EnemyPose {
  t: number; // seconds, for idle animation
  dir: -1 | 1;
  trapped: boolean;
  falling: boolean;
  stunned: boolean;
  climbing: boolean;
}

/**
 * Three PLANT enemies with distinct silhouettes (not just colour):
 * red = squat round walking apple, green = wide snapping flytrap, blue = tall cactus.
 */
export function drawEnemy(g: G, kind: EnemyKind, x: number, y: number, pose: EnemyPose): void {
  switch (kind) {
    case 'red':
      return drawApple(g, x, y, pose);
    case 'green':
      return drawFlytrap(g, x, y, pose);
    case 'blue':
      return drawCactus(g, x, y, pose);
  }
}

function eyes(g: G, x: number, y: number, dir: number, angry: boolean, dizzy: boolean): void {
  if (dizzy) {
    g.lineStyle(2, PALETTE.ink, 1);
    for (const ox of [-5, 5]) {
      g.lineBetween(x + ox - 3, y - 3, x + ox + 3, y + 3);
      g.lineBetween(x + ox + 3, y - 3, x + ox - 3, y + 3);
    }
    return;
  }
  g.fillStyle(PALETTE.white, 1);
  g.fillEllipse(x - 5, y, 8, 9);
  g.fillEllipse(x + 5, y, 8, 9);
  g.fillStyle(PALETTE.ink, 1);
  g.fillCircle(x - 5 + dir * 1.5, y + 1, 2.2);
  g.fillCircle(x + 5 + dir * 1.5, y + 1, 2.2);
  if (angry) {
    g.lineStyle(2.5, PALETTE.ink, 1);
    g.lineBetween(x - 9, y - 7, x - 2, y - 4);
    g.lineBetween(x + 9, y - 7, x + 2, y - 4);
  }
}

/** Little root "feet" that shuffle while walking. */
function rootFeet(g: G, x: number, y: number, t: number, spread: number, still: boolean): void {
  const s = still ? 0 : Math.sin(t * 10) * 3;
  g.lineStyle(3, PALETTE.wood, 1);
  g.lineBetween(x - spread * 0.4, y - 6, x - spread + s, y - 1);
  g.lineBetween(x - spread * 0.1, y - 6, x - spread * 0.35 - s, y);
  g.lineBetween(x + spread * 0.1, y - 6, x + spread * 0.35 + s, y);
  g.lineBetween(x + spread * 0.4, y - 6, x + spread - s, y - 1);
}

const PINK = 0xff8fb1;
const PINK_DARK = 0xd94f7c;

/** Red: squat, round walking apple (1 floor). */
function drawApple(g: G, x: number, y: number, p: EnemyPose): void {
  const bob = p.trapped || p.falling ? 0 : Math.abs(Math.sin(p.t * 10)) * 2;
  const squash = p.falling ? 0.85 : 1;
  const cy = y - 17 - bob;
  if (!p.trapped) rootFeet(g, x, y, p.t, 13, p.falling || p.stunned);
  g.lineStyle(3, PALETTE.ink, 1);
  g.fillStyle(PALETTE.red, 1);
  // two-lobed apple body
  g.fillEllipse(x - 5, cy, 22 * squash, 27 / squash);
  g.fillEllipse(x + 5, cy, 22 * squash, 27 / squash);
  g.strokeEllipse(x, cy, 33 * squash, 28 / squash);
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(x - 8, cy - 6, 8, 6);
  // stem + two leaves
  g.lineStyle(3, PALETTE.wood, 1);
  g.lineBetween(x, cy - 12, x + 2, cy - 20);
  g.fillStyle(PALETTE.grassTop, 1);
  g.lineStyle(2, PALETTE.ink, 1);
  g.fillEllipse(x + 9, cy - 18, 13, 6);
  g.strokeEllipse(x + 9, cy - 18, 13, 6);
  g.fillEllipse(x - 6, cy - 19, 9, 5);
  eyes(g, x, cy - 1, p.dir, true, p.stunned);
}

/** Green: WIDE snapping flytrap — two spiky jaws hinged at the back, opening toward where it walks (2 floors). */
function drawFlytrap(g: G, x: number, y: number, p: EnemyPose): void {
  const d = p.dir;
  const open = p.trapped ? 0.12 : p.stunned ? 0.05 : p.falling ? 0.55 : 0.3 + 0.28 * Math.abs(Math.sin(p.t * 7));
  const hy = y - 26;
  const hx = x - d * 20; // hinge at the back of the head
  const R = 22; // half jaw length
  const H = 13; // jaw thickness
  // local (u along the mouth toward the front, v up) -> screen, with jaw rotation
  const toScreen = (u: number, v: number, a: number) => {
    const ur = u * Math.cos(a) - v * Math.sin(a);
    const vr = u * Math.sin(a) + v * Math.cos(a);
    return new Phaser.Math.Vector2(hx + d * ur, hy - vr);
  };
  const jaw = (side: 1 | -1) => {
    const a = side * open;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const th = (i / 14) * Math.PI;
      pts.push(toScreen(R - R * Math.cos(th), side * H * Math.sin(th), a));
    }
    return { a, pts };
  };
  // stem + leaf feet
  g.lineStyle(3, PALETTE.ink, 1);
  g.fillStyle(PALETTE.greenDark, 1);
  const sx = x - d * 10; // stem sits under the middle-back of the head
  g.fillRect(sx - 3, hy + 4, 6, y - hy - 10);
  const s = p.trapped || p.falling || p.stunned ? 0 : Math.sin(p.t * 10) * 3;
  if (!p.trapped) {
    g.fillStyle(PALETTE.green, 1);
    g.lineStyle(2, PALETTE.ink, 1);
    g.fillEllipse(sx - 8 + s, y - 4, 16, 7);
    g.strokeEllipse(sx - 8 + s, y - 4, 16, 7);
    g.fillEllipse(sx + 8 - s, y - 4, 16, 7);
    g.strokeEllipse(sx + 8 - s, y - 4, 16, 7);
  }
  const lower = jaw(-1);
  const upper = jaw(1);
  // pink mouth between the jaws
  g.fillStyle(PINK, 1);
  g.fillPoints([toScreen(0, 0, 0), toScreen(2 * R, 0, upper.a), toScreen(2 * R, 0, lower.a)], true);
  for (const j of [lower, upper]) {
    const side = j === upper ? 1 : -1;
    // bristles along the inner edge (pointing into the mouth)
    g.fillStyle(PALETTE.white, 1);
    for (let u = 8; u <= 2 * R; u += 6) {
      const b0 = toScreen(u - 2.5, 0, j.a);
      const b1 = toScreen(u + 2.5, 0, j.a);
      const tip = toScreen(u, -side * 6, j.a);
      g.fillTriangle(b0.x, b0.y, b1.x, b1.y, tip.x, tip.y);
    }
    g.fillStyle(side === 1 ? PALETTE.green : PALETTE.greenDark, 1);
    g.lineStyle(3, PALETTE.ink, 1);
    g.fillPoints(j.pts, true);
    g.strokePoints(j.pts, true);
  }
  // pink inner blush + eyes on the upper jaw
  const spot = toScreen(R * 1.3, H * 0.35, upper.a);
  g.fillStyle(PINK_DARK, 0.85);
  g.fillCircle(spot.x, spot.y, 2.5);
  const e = toScreen(R * 0.85, H * 0.95, upper.a);
  eyes(g, e.x, e.y - 3, d, false, p.stunned);
}

/** Blue: TALL cactus with arms, spines and a flower (3 floors). */
function drawCactus(g: G, x: number, y: number, p: EnemyPose): void {
  const sway = p.trapped ? 0 : Math.sin(p.t * 6) * 2;
  const top = y - 46;
  const bx = x + sway;
  if (!p.trapped) rootFeet(g, x, y, p.t, 12, p.falling || p.stunned);
  g.lineStyle(3, PALETTE.ink, 1);
  g.fillStyle(PALETTE.blue, 1);
  // arms (behind body)
  g.fillRoundedRect(bx - 22, top + 18, 12, 8, 4);
  g.strokeRoundedRect(bx - 22, top + 18, 12, 8, 4);
  g.fillRoundedRect(bx - 22, top + 6, 8, 18, 4);
  g.strokeRoundedRect(bx - 22, top + 6, 8, 18, 4);
  g.fillRoundedRect(bx + 10, top + 24, 12, 8, 4);
  g.strokeRoundedRect(bx + 10, top + 24, 12, 8, 4);
  g.fillRoundedRect(bx + 14, top + 12, 8, 18, 4);
  g.strokeRoundedRect(bx + 14, top + 12, 8, 18, 4);
  // tall body
  g.fillRoundedRect(bx - 12, top, 24, 42, 11);
  g.strokeRoundedRect(bx - 12, top, 24, 42, 11);
  // ribs
  g.lineStyle(2, PALETTE.blueDark, 0.9);
  g.lineBetween(bx - 5, top + 6, bx - 5, top + 38);
  g.lineBetween(bx + 5, top + 6, bx + 5, top + 38);
  // spines
  g.lineStyle(1.5, PALETTE.white, 0.95);
  for (const [sx, sy] of [[-12, 26], [12, 30], [-12, 36], [12, 14], [-19, 10], [18, 16]] as const) {
    g.lineBetween(bx + sx, top + sy, bx + sx + (sx < 0 ? -4 : 4), top + sy - 2);
  }
  // flower on top
  g.fillStyle(PINK, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    g.fillCircle(bx + Math.cos(a) * 5, top - 2 + Math.sin(a) * 5, 3.5);
  }
  g.fillStyle(PALETTE.gold, 1);
  g.fillCircle(bx, top - 2, 3);
  eyes(g, bx, top + 14, p.dir, true, p.stunned);
}

/** Dizzy stars orbiting a trapped enemy's head. */
export function drawDizzy(g: G, x: number, y: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + (i * Math.PI * 2) / 3;
    const sx = x + Math.cos(a) * 14;
    const sy = y + Math.sin(a) * 4;
    drawStar(g, sx, sy, 4, PALETTE.gold);
  }
}

export function drawStar(g: G, x: number, y: number, r: number, color: number): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
}

export function drawHeart(g: G, x: number, y: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(x - s * 0.5, y - s * 0.2, s * 0.55);
  g.fillCircle(x + s * 0.5, y - s * 0.2, s * 0.55);
  g.fillTriangle(x - s * 1.02, y, x + s * 1.02, y, x, y + s * 1.1);
}
