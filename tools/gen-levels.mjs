// Generates src/levels/level01.json … level10.json from the owner's progression rule:
//   L1–L5: 1–5 red apples. From L6 the total stays 5 and one red becomes a green flytrap per level
//   (L6 4R+1G … L10 5G). Enemy speed stays at the default 80 px/s for every level.
// Ladder layouts are varied with a seeded RNG but checked against simple rules so every level is
// fair. Run: node tools/gen-levels.mjs   (output is deterministic; commit the JSON it writes)
import { writeFileSync } from 'node:fs';

const COLS = 24;
const FLOOR_Y = [112, 204, 296, 388, 480];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const META = [
  { name: '果園入口', theme: null, hint: '紅蘋果掉 1 層就消滅：挖洞、等牠掉進去、再敲下去！' },
  { name: '蘋果小徑', theme: null, hint: '兩隻紅蘋果：在牠們會經過的地方先挖好洞。' },
  { name: '果樹林', theme: { skyTop: '#8fd0ff', skyBottom: '#ffe3c2' }, hint: '小心別走進自己挖的洞，會掉到下一層！' },
  { name: '摘果平台', theme: { skyTop: '#9bc8ff', skyBottom: '#ffd9b0' }, hint: '洞挖錯了？同一個鍵再按 6 下就能補回去。' },
  { name: '蘋果大豐收', theme: { skyTop: '#ffb88a', skyBottom: '#ffe7b8' }, hint: '五隻紅蘋果！善用梯子繞路，別被前後夾擊。' },
  { name: '溫室入口', theme: { skyTop: '#9fe3c9', skyBottom: '#fff4d6' }, hint: '綠捕蠅草要連續掉 2 層：先在下一層挖洞，再回上一層挖對齊的洞！' },
  { name: '捕蠅草苗圃', theme: { skyTop: '#a6e8c4', skyBottom: '#f6f9d8' }, hint: '對齊的兩層洞也能一次打倒紅蘋果，好好利用。' },
  { name: '濕地溫室', theme: { skyTop: '#8fd8c8', skyBottom: '#eaf6e0' }, hint: '捕蠅草變多了：先把對齊的洞準備好再引牠們過來。' },
  { name: '食蟲植物園', theme: { skyTop: '#7fcfb8', skyBottom: '#f3f0d0' }, hint: '只剩一隻紅蘋果，其他都要掉 2 層！' },
  { name: '捕蠅草大溫室', theme: { skyTop: '#6fc0a8', skyBottom: '#f8ead0' }, hint: '五隻捕蠅草！準備好兩組對齊的洞再開始。' },
];

function counts(n) {
  if (n <= 5) return { red: n, green: 0 };
  return { red: 10 - n, green: n - 5 };
}

/** Pick ladders: per gap 2–3 columns, spaced >= 5 apart, not stacked on the gap above/below. */
function ladders(r) {
  const out = [];
  let prev = [];
  for (let top = 0; top < 4; top++) {
    const n = 2 + (r() < 0.5 ? 1 : 0);
    const cols = [];
    let guard = 0;
    while (cols.length < n && guard++ < 500) {
      const c = 1 + Math.floor(r() * (COLS - 2));
      if (cols.some((x) => Math.abs(x - c) < 5)) continue;
      if (prev.some((x) => Math.abs(x - c) < 2)) continue;
      cols.push(c);
    }
    cols.sort((a, b) => a - b);
    for (const c of cols) out.push({ col: c, top, bottom: top + 1 });
    prev = cols;
  }
  return out;
}

function ladderCells(ls) {
  const s = new Set();
  for (const l of ls) {
    s.add(`${l.top}:${l.col}`);
    s.add(`${l.bottom}:${l.col}`);
  }
  return s;
}

/** A 2-deep shaft spot on the top floors exists (needed to make greens beatable comfortably). */
function hasShaftSpot(ls) {
  const cells = ladderCells(ls);
  for (let c = 3; c <= 20; c++) {
    const ok = [`0:${c - 1}`, `0:${c}`, `0:${c + 1}`, `1:${c + 1}`, `1:${c + 2}`, `1:${c - 1}`, `1:${c - 2}`].every((k) => !cells.has(k));
    if (ok) return true;
  }
  return false;
}

function spawns(r, red, green, ls) {
  // Enemies start on floors 0–2, away from ladder cells, spread out; the player starts on the bottom floor.
  const cells = ladderCells(ls);
  const kinds = [...Array(green).fill('green'), ...Array(red).fill('red')];
  const out = [];
  const floorsFor = (k, i) => (k === 'green' ? [0, 1][i % 2] : [0, 1, 2][i % 3]);
  kinds.forEach((kind, i) => {
    const floor = floorsFor(kind, i);
    let col = 0;
    let guard = 0;
    do {
      col = 1 + Math.floor(r() * (COLS - 2));
    } while (
      guard++ < 500 &&
      (cells.has(`${floor}:${col}`) || out.some((e) => e.floor === floor && Math.abs(e.col - col) < 4))
    );
    out.push({ kind, col, floor, dir: col < COLS / 2 ? 1 : -1 });
  });
  return out;
}

// Layout-seed bumps chosen after checking fairness with the scripted player (see tests/levels.test.ts).
const LAYOUT_BUMP = { 6: 2, 7: 6, 8: 3, 9: 1, 10: 4, ...JSON.parse(process.env.LAYOUT_BUMP ?? '{}') };
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : null;
const OUT_DIR = process.env.OUT_DIR ?? null;

for (let n = 1; n <= 10; n++) {
  if (ONLY && n !== ONLY) continue;
  const meta = META[n - 1];
  const { red, green } = counts(n);
  let seed = 1000 + n * 97 + (LAYOUT_BUMP[n] ?? 0) * 7919;
  let r = rng(seed);
  let ls = ladders(r);
  let tries = 0;
  while (!hasShaftSpot(ls) && tries++ < 50) {
    seed++;
    r = rng(seed);
    ls = ladders(r);
  }
  const level = {
    id: `level${String(n).padStart(2, '0')}`,
    name: `第 ${n} 關：${meta.name}`,
    cols: COLS,
    floorY: FLOOR_Y,
    diggableFloors: [0, 1, 2, 3],
    ladders: ls,
    player: { col: 11, floor: 4 },
    enemies: spawns(r, red, green, ls),
    // Time grows with the work: a base plus more per green (needs a 2-floor setup).
    timeLimitSec: 90 + 30 * red + 45 * green,
    seed: 2026 + n,
    ...(meta.theme ? { theme: meta.theme } : {}),
    hint: meta.hint,
  };
  const file = OUT_DIR ? `${OUT_DIR}/${level.id}.json` : new URL(`../src/levels/${level.id}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify(level, null, 2) + '\n');
  console.log(level.id, `${red}R ${green}G`, `${level.timeLimitSec}s`, 'ladders', ls.map((l) => `${l.top}:${l.col}`).join(' '));
}
