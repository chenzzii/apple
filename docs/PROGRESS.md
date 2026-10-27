# Progress log — Project Orchard Panic

Status: **Stage 1 playable prototype implemented and verified** (2026-10-26).

## How to play locally
```bash
npm install
npm run dev        # open the printed http://localhost:5173 URL
```
Menu: **Enter** start game · **L** choose start level · **T** mechanics test level · **H** help · **C** switch keymap · **1–4** world speed (1.0 / 1.25 / 1.5 / 2.0x).
In game: arrows/WASD move & climb, **J** LEFT tile / **K** RIGHT tile — dig solid floor, fill an open hole, pound a trapped enemy (classic keymap: I/J/K/M + A/S) · **Esc/P** pause · **H** help · **R** restart · **N** mute all · **B** music on/off · **G** re-open test holes (test level only).

## 2026-10-27 (5) — Level 2 「捕蠅草溫室」 (owner request: next level)
- New `src/levels/level02.json`: 2 green flytraps + 2 red apples, new ladder layout, 200 s, mint "greenhouse" sky, enemies slightly faster (84 vs 80 px/s, via new per-level `tuning`). Teaches the core skill: greens need a 2-floor fall, so dig the lower hole, then the aligned hole above.
- Campaign: level 1 → level 2 → 「全部過關」; score and lives carry over. Clear screen names the next level. Menu **L** picks the start level. READY screen shows a per-level `hint`.
- Level format additions (validated): `tuning` (per-level config overrides), `theme` (sky colours), `hint`.
- Tests: **50** passing. New `tests/levels.test.ts` + scripted `tests/ambushBot.ts`: level 2 cleared by the bot with the normal 3 lives (both greens by 2-floor falls) and across 5 enemy-RNG seeds (≤ 5 lives); level 1 still cleared.
- Browser (`tools/playtest/level02-win.cjs`, real keys driven by the same bot): **LEVEL_CLEAR on attempt 6** (score 2500, both greens fell 2). Earlier attempts lost because the headless container renders at ~8–15 fps and the bot reacts late; a human on a normal PC should find it easier, but **human difficulty is not yet verified**.
- `npm run typecheck` ✅ · `npm run test` ✅ 50 · `npm run build` ✅ · 0 console errors.

## 2026-10-27 (4) — enemies redesigned as plants (owner request)
- Red stays an apple (already a plant; now with root feet and two leaves). Green butterfly → **綠捕蠅草** (wide, two spiky jaws hinged at the back that snap open toward its walking direction). Blue mask → **藍仙人掌** (tall, arms, spines, flower on top). Rules, colours and scores unchanged; silhouettes stay squat / wide / tall so they are distinguishable without colour.
- Labels updated in legend, menu help and in-game help. Side panels made taller so the test-level key list fits.
- `npm run typecheck` ✅ · `npm run test` ✅ 42 · `npm run build` ✅ · browser: menu/legend/trapped flytrap screenshots checked; loss + mechanics clear still pass; 0 console errors.

## 2026-10-27 (3) — original background music (owner request)
- Two original loops written as data in `src/game/music/score.ts`, played by a look-ahead Web Audio sequencer (`src/game/music/Music.ts`); no audio files, no third-party music.
  - Menu: "Morning Orchard" (100 BPM, triangle lead + arpeggio + bass).
  - In game: "Orchard Run" (140 BPM, square lead, oom-pah bass, kick/snare/hat).
- Music plays in READY/PLAYING; silent while paused, after a hit, on level clear / game over (SFX jingles take over). Tempo × (1 + (speed−1)/2), and ×1.2 when ≤ 20 s remain. **B** toggles music; **N** still mutes everything. Setting persists.
- `npm run typecheck` ✅ · `npm run test` ✅ **42 tests** (new `tests/music.test.ts`: pitch math, every voice/drum bar fills the loop) · `npm run build` ✅
- Browser (`tools/playtest/music-check.cjs`): silent before first key (autoplay policy), menu theme after a key, game theme in level, both with measured signal on the music bus (RMS ≈ 0.06–0.07), 0 while paused and after B, resumes after; tempo 1.5 at 2.0x; 0 console errors.

## 2026-10-27 (2) — same key digs, fills or pounds (owner request)
- J/K: solid or partly dug tile → dig; open hole → fill (6 pulses, like pounding); trapped enemy → pound. Fill action is back.
- Held key locks after a completed action until released; taps during the cooldown are buffered.
- Target labels show 挖 / 補 / 敲 per side; help, menu, side panel updated.
- `npm run typecheck` ✅ · `npm run test` ✅ **38 tests** (new: fill in 6, partly dug keeps digging, hold-lock after open / knock-through, tap buffering) · `npm run build` ✅
- Browser (real keys): K×6 open → K×6 fill (SOLID) → K×6 open → walk → fell floor 0→3; level 1 cleared; pause/speed/tab-hide/loss/retry pass; mechanics level cleared (blue 3, green 2, red 1); 0 console errors.

## 2026-10-27 — controls + hole-fall change (owner request)
- J = dig the LEFT tile, K = dig the RIGHT tile; the same key pounds if an enemy is trapped in that tile. Fill-hole action removed.
- Walking onto an open hole now drops the player to the next floor (through aligned holes too). See DECISIONS D1/D11.
- On-screen J/K labels under the two target tiles (gold "敲" when it will pound); help, menu and side panel updated.
- `npm run typecheck` ✅ · `npm run test` ✅ **33 tests** (new: J/K sides, own-hole fall, aligned multi-floor player fall, walking over an occupied hole) · `npm run build` ✅
- Browser (headless Chromium, real keys): level 1 cleared with J/K; `tools/playtest/player-falls.cjs` dug with K ×6, walked right, fell floor 0 → 3 through the aligned shaft; full checks script: pause/speed/tab-hide/loss/retry pass, mechanics level cleared (blue 3 floors, green 2, red 1); 0 console errors.

## Latest verified work
- Pure TypeScript deterministic simulation in `src/core/` (fixed 60 Hz, seeded RNG, typed events), no Phaser imports.
- Phaser 4.2.1 scenes in `src/game/` render with interpolation, own the keyboard, HUD, overlays, Web Audio SFX and particles.
- Validated JSON levels in `src/levels/`: `level01` (3 red), `level02` (2 green + 2 red) and `mechanics-test` (green + blue + red with aligned/offset preset shafts).
- Original programmatic cartoon art (`src/rendering/VectorArt.ts`): gardener and three plant enemies (squat apple, wide flytrap, tall cactus); no external assets.

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
