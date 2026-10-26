# Progress log — Project Orchard Panic

Status: **Stage 1 playable prototype implemented and verified** (2026-10-26).

## How to play locally
```bash
npm install
npm run dev        # open the printed http://localhost:5173 URL
```
Menu: **Enter** start level 1 · **T** mechanics test level · **H** help · **C** switch keymap · **1–4** world speed (1.0 / 1.25 / 1.5 / 2.0x).
In game: arrows/WASD move & climb, **J** dig, **K** pound/fill (classic keymap: I/J/K/M + A/S) · **Esc/P** pause · **H** help · **R** restart · **N** mute · **G** re-open test holes (test level only).

## Latest verified work
- Pure TypeScript deterministic simulation in `src/core/` (fixed 60 Hz, seeded RNG, typed events), no Phaser imports.
- Phaser 4.2.1 scenes in `src/game/` render with interpolation, own the keyboard, HUD, overlays, Web Audio SFX and particles.
- Two validated JSON levels in `src/levels/`: `level01` (3 red, clearable) and `mechanics-test` (green + blue + red with aligned/offset preset shafts).
- Original programmatic cartoon art (`src/rendering/VectorArt.ts`): gardener, round apple, wide-winged butterfly, tall mask; no external assets.

## Commands run (2026-10-26, Node 22.23, this container)
| Command | Result |
|---|---|
| `npm run typecheck` | ✅ pass (tsc strict, 0 errors) |
| `npm run test` | ✅ 5 files, **29 tests passed** |
| `npm run build` | ✅ pass (`dist/` 1.41 MB JS, 373 kB gzip; Phaser is most of it) |
| `npm run dev` / `vite preview` | ✅ both served; game boots with 0 console errors, 0 failed requests |

## Browser verification (headless Chromium + Playwright, REAL keyboard input)
Scripts: `tools/playtest/level01-win.cjs`, `tools/playtest/checks-and-mechanics.cjs`. The bots read `window.__orchard.sim` only to choose keys; they never write game state.
- Level 1 at 2.0x: walked, climbed ladder, dug holes, trapped, pounded, enemies fell, **3/3 red defeated → LEVEL_CLEAR** (score 1480, 40 s real). Repeated at 1.25x: **LEVEL_CLEAR** (score 1380).
- Mechanics level at 2.0x: **green defeated by a 2-floor fall (+400), blue defeated by a 3-floor fall (+900)**, red by 1 floor → LEVEL_CLEAR. Earlier runs also showed a blue surviving a 2-floor fall and a green surviving a 1-floor fall (rule working as intended).
- Loss: chasing enemies → 3 hits → **GAME_OVER**; Enter → retry with 3 lives / 0 score.
- Speed: measured ≈57 logic steps/s at 1.0x vs ≈122/s at 2.0x.
- Pause (Esc): 0 logic steps during 1.5 s paused.
- Tab hidden: headless Chromium does not switch `document.hidden` on tab change, so the Page Visibility event was **simulated**; game auto-paused, 0 steps over 2.5 s, stays paused until the player resumes.
- Help overlay, pause overlay, game-over and level-clear panels rendered (see `docs/screenshots/`).
- Render FPS in this headless software-GL container was only ~16–39 fps; logic still ran at 60 Hz game time. **No real-GPU FPS measurement has been done yet** (GDD T12 open).

## Development checklist
- [x] Scaffold Phaser 4.2.1 / TypeScript / Vite (versions pinned, lockfile committed)
- [x] Grid, five floors, ladders and player
- [x] Six-pulse hole creation and filling
- [x] Enemy trap / pound / fall states
- [x] Red / green / blue fall requirements, aligned-only chains
- [x] Win, lose, scoring, pause, retry
- [x] 60 Hz fixed logic, speed multipliers, render interpolation
- [x] Typecheck / unit tests / build
- [x] Play through win and loss in a (headless) browser

## Provisional timing / rules
See `docs/DECISIONS.md` (all speeds, trap time, cooldown, bonus and respawn rules are PROVISIONAL).

## Known gaps / next actions
1. Play-test by a human on a real desktop browser (feel, difficulty — the scripted bot lost 2 lives per run, enemies may be too eager to change floors).
2. Measure real FPS on Chrome/Edge 1080p (GDD T12).
3. Compare speeds / trap timer against original footage; log in `docs/legacy-parity.md`.
4. More levels; HD sprite atlas; original music.
5. Choose a LICENSE.
