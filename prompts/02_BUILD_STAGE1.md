# Claude Code — Phase 1: implement the playable prototype

The plan has been approved. Read `CLAUDE.md`, `docs/GDD.md`, and `prompts/01_PLAN.md`, then **implement code in this repository**.

## Goal
Deliver a self-contained, real, playable Phaser 4.2.1 + TypeScript + Vite 2D game that preserves the Apple Panic-style trap gameplay with *original* cartoon placeholder assets.

Do not stop after scaffolding, a screenshot, a menu, a design document or a passing build. Reach a genuine playable loop.

## Stage 1 requirements
- 1280x720 design resolution, fixed five-floor test board with ladders and clear grid/hole alignment.
- Player walk left/right, climb ladders, dig and pound with separate J/K controls. There is **no jump**.
- Six valid dig pulses open one eligible adjacent floor tile; six valid pound pulses release a trapped enemy through the floor. Support keyboard tapping and held-key repeat with cooldown. Invalid cells (including ladders) cannot be dug.
- Red enemy: patrol, ladder traversal, falling, trapped, escape, elimination after 1 continuous floor of fall. A first stage containing three red enemies is actually winnable.
- Mechanics test stage with green (2-floor) and blue (3-floor) enemies. Verify vertical hole alignment, and reject accumulated or misaligned falls.
- Lives=3, player collision/hurt/invulnerability, level complete, game over, retry.
- Score, lives, level, time, current multiplier in visible HUD; keyboard instructions clearly discoverable.
- Game-clock multipliers 1.0, 1.25, 1.5, 2.0; pause and background-tab handling; deterministic logic updates fixed at 60Hz, independent of rendering rate.
- Hand-drawn HD-cartoon-inspired geometry via Phaser Graphics is fine for Stage 1. Use distinct silhouettes for three enemy types. Basic sprite motion/particles if practical, but gameplay is more important.
- Do not depend on missing images. The final system must be able to launch with only repository files and npm install.

## Architecture
- `src/core/`: pure TypeScript simulation, typed states and events, map topology, enemy/hole/player rules, seeded RNG and fixed-step clock.
- `src/game/`: Phaser scenes, camera, keyboard, graphics, HUD, sound and effects.
- `src/levels/`: JSON levels with validation.
- `tests/`: Vitest pure logic tests.
- Avoid competing physics authorities: simulation owns true positions/occupancy; Phaser renders.
- TypeScript strict. Phaser 4 ESM wildcard import required where applicable.

## Required tests
- Exactly 6 actions to open a diggable hole; 5 must leave it incomplete.
- Ladder cell and invalid/out-of-bounds cells cannot be dug.
- Trapping, timed escape, 6-pound knock-through, refill where applicable.
- Required uninterrupted aligned-floor fall: red=1, green=2, blue=3.
- A one-column mismatch breaks the fall chain.
- Only one enemy-defeated and one scoring event per enemy.
- Player hurt invulnerability, third-life game over, last enemy level clear.
- Pause, tab-return and speed multiplier simulations behave as intended.
- Render tick cadence 30/60/144Hz does not alter game outcome at equal simulated world time.

## Execution policy
- Implement vertical slices in order and run tests after each major subsystem.
- When a dependency/API question arises, use installed typings and official Phaser 4 documentation, not Phaser 3 snippets.
- Investigate errors; do not claim success without executing checks.
- At the end run (or create as needed): `npm run typecheck`, `npm run test`, `npm run build`, and `npm run dev`.
- If available, use browser automation/manual control to actually run the game and verify moving, climbing, digging, pounding, enemy fall, a win and a loss. Capture objective results; if browser control isn't available, say so.
- Update `docs/PROGRESS.md` with the stage result, actual evidence, gaps, test output summary, tentative original-rule values, and the exact commands a human can use to play.
- Do not deploy or push the repository without explicit approval.

## Final response format
1. What works **in the running game**, not just source code.
2. Files/modules changed.
3. Commands actually run and whether they passed.
4. Browser/gameplay tests performed (or explicitly not performed).
5. Known limitations and next concrete steps.
