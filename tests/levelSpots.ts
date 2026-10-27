/**
 * Ambush spot per campaign level for the scripted player (tests/ambushBot.ts): [col, upperFloor, shaftSide].
 * Found by searching all spots over several enemy-RNG seeds; used by unit tests and the browser playtest.
 */
export const SPOT: Record<string, [number, number, -1 | 1]> = {
  level01: [3, 0, -1],
  level02: [7, 1, -1],
  level03: [12, 1, -1],
  level04: [15, 0, -1],
  level05: [7, 0, -1],
  level06: [19, 0, -1],
  level07: [5, 0, 1],
  level08: [19, 1, -1],
  level09: [12, 1, 1],
  level10: [18, 1, -1],
};
