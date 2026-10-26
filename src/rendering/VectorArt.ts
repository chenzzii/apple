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
  green: { main: PALETTE.green, dark: PALETTE.greenDark, label: '綠蝴蝶', floors: 2 },
  blue: { main: PALETTE.blue, dark: PALETTE.blueDark, label: '藍面具', floors: 3 },
};

export interface GardenerPose {
  facing: -1 | 1;
  walkPhase: number; // radians, advances while walking
  climbing: boolean;
  action: 'none' | 'dig' | 'pound';
  actionT: number; // 0..1 animation progress
  blink: boolean; // invulnerability flicker
  hurt: boolean;
}

/** Little original gardener: straw hat, teal overalls, tool belt, shovel. ~50px tall. */
export function drawGardener(g: G, x: number, y: number, pose: GardenerPose): void {
  if (pose.blink) return;
  const f = pose.facing;
  const swing = Math.sin(pose.walkPhase);
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

/** Three distinct silhouettes: squat round apple, wide-winged butterfly, tall mask. */
export function drawEnemy(g: G, kind: EnemyKind, x: number, y: number, pose: EnemyPose): void {
  switch (kind) {
    case 'red':
      return drawApple(g, x, y, pose);
    case 'green':
      return drawButterfly(g, x, y, pose);
    case 'blue':
      return drawMask(g, x, y, pose);
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

function drawApple(g: G, x: number, y: number, p: EnemyPose): void {
  const bob = p.trapped || p.falling ? 0 : Math.abs(Math.sin(p.t * 10)) * 2;
  const squash = p.falling ? 0.85 : 1;
  const cy = y - 16 - bob;
  // feet
  if (!p.trapped) {
    g.fillStyle(PALETTE.redDark, 1);
    g.fillEllipse(x - 7 + Math.sin(p.t * 10) * 3, y - 2, 10, 5);
    g.fillEllipse(x + 7 - Math.sin(p.t * 10) * 3, y - 2, 10, 5);
  }
  g.lineStyle(3, PALETTE.ink, 1);
  g.fillStyle(PALETTE.red, 1);
  g.fillEllipse(x, cy, 32 * squash, 28 / squash);
  g.strokeEllipse(x, cy, 32 * squash, 28 / squash);
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(x - 7, cy - 6, 8, 6);
  // stem + leaf
  g.lineStyle(3, PALETTE.wood, 1);
  g.lineBetween(x, cy - 13, x + 2, cy - 20);
  g.fillStyle(PALETTE.grassTop, 1);
  g.fillEllipse(x + 8, cy - 18, 11, 6);
  eyes(g, x, cy - 1, p.dir, true, p.stunned);
}

function drawButterfly(g: G, x: number, y: number, p: EnemyPose): void {
  const flap = p.trapped ? 0.4 : 0.5 + 0.5 * Math.sin(p.t * 14);
  const cy = y - 20;
  const w = 16 + flap * 10;
  g.lineStyle(3, PALETTE.ink, 1);
  g.fillStyle(PALETTE.green, 1);
  // wings (wide silhouette)
  g.fillEllipse(x - w * 0.8, cy - 6, w, 20);
  g.strokeEllipse(x - w * 0.8, cy - 6, w, 20);
  g.fillEllipse(x + w * 0.8, cy - 6, w, 20);
  g.strokeEllipse(x + w * 0.8, cy - 6, w, 20);
  g.fillStyle(PALETTE.greenDark, 1);
  g.fillEllipse(x - w * 0.7, cy + 8, w * 0.7, 12);
  g.fillEllipse(x + w * 0.7, cy + 8, w * 0.7, 12);
  g.fillStyle(PALETTE.gold, 1);
  g.fillCircle(x - w * 0.8, cy - 6, 3);
  g.fillCircle(x + w * 0.8, cy - 6, 3);
  // body
  g.fillStyle(PALETTE.greenDark, 1);
  g.fillEllipse(x, cy + 2, 12, 30);
  g.strokeEllipse(x, cy + 2, 12, 30);
  // antennae
  g.lineStyle(2, PALETTE.ink, 1);
  g.lineBetween(x - 2, cy - 12, x - 7, cy - 22);
  g.lineBetween(x + 2, cy - 12, x + 7, cy - 22);
  g.fillStyle(PALETTE.ink, 1);
  g.fillCircle(x - 7, cy - 22, 2.5);
  g.fillCircle(x + 7, cy - 22, 2.5);
  eyes(g, x, cy - 6, p.dir, false, p.stunned);
}

function drawMask(g: G, x: number, y: number, p: EnemyPose): void {
  const sway = p.trapped ? 0 : Math.sin(p.t * 6) * 2;
  const top = y - 46;
  g.lineStyle(3, PALETTE.ink, 1);
  // cape
  g.fillStyle(PALETTE.blueDark, 1);
  g.fillTriangle(x - 14, y, x + 14, y, x + sway, top + 20);
  // tall mask
  g.fillStyle(PALETTE.blue, 1);
  g.fillRoundedRect(x - 12 + sway, top, 24, 38, 10);
  g.strokeRoundedRect(x - 12 + sway, top, 24, 38, 10);
  // stripes pattern
  g.fillStyle(PALETTE.ladderLight, 0.9);
  g.fillRect(x - 12 + sway, top + 26, 24, 3);
  g.fillRect(x - 12 + sway, top + 31, 24, 2);
  // crown points
  g.fillStyle(PALETTE.gold, 1);
  g.fillTriangle(x - 10 + sway, top + 2, x - 4 + sway, top + 2, x - 7 + sway, top - 7);
  g.fillTriangle(x + 4 + sway, top + 2, x + 10 + sway, top + 2, x + 7 + sway, top - 7);
  g.fillTriangle(x - 3 + sway, top + 1, x + 3 + sway, top + 1, x + sway, top - 10);
  // eye slits
  if (p.stunned) {
    eyes(g, x + sway, top + 15, p.dir, false, true);
  } else {
    g.fillStyle(PALETTE.ink, 1);
    g.fillEllipse(x - 5 + sway + p.dir, top + 15, 7, 4);
    g.fillEllipse(x + 5 + sway + p.dir, top + 15, 7, 4);
    g.fillStyle(PALETTE.gold, 1);
    g.fillCircle(x - 5 + sway + p.dir * 2, top + 15, 1.3);
    g.fillCircle(x + 5 + sway + p.dir * 2, top + 15, 1.3);
  }
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
