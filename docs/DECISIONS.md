# Decisions, provisional values and departures — Stage 1

Legend: **VERIFIED** = stated in the original Apple II manual / GDD §1 sources. **PROVISIONAL** = our own tuning, not measured from the 1981 original. Change values in `src/core/config.ts`.

## Verified rules kept as-is
| Rule | Where |
|---|---|
| No jump; move left/right, climb ladders, dig, pound | `Simulation.updatePlayer` |
| Red 1 floor / green 2 / blue 3, achieved in ONE continuous fall | `ENEMY_KINDS`, `Simulation.enemyLand` |
| Base score 100 / 200 / 300 per floor fallen | `ENEMY_KINDS` |
| 3 lives | `DEFAULT_CONFIG.startLives` |
| ~6 dig pulses per hole, ~6 pound pulses (player-guide figure, treated as reference) | `digPulses`, `poundPulses` |

## Provisional values (GDD §4 starting points)
| Value | Setting |
|---|---|
| Player walk 120 px/s, climb 88 px/s; enemy walk 80 px/s, climb 60 px/s | config |
| Pulse cooldown 110 ms → rounds to **7 logic steps (116.7 ms)** at 60 Hz | config |
| Trap time 5.0 s, climb-out 0.6 s (harmless while climbing out) | config |
| Fall speed 360 px/s | config |
| Invulnerability 1.0 s after every (re)spawn | config |
| Default world speed 1.25x (not a claim about the original) | `DEFAULT_SPEED` |
| Level time 150 s (level 1) / 240 s (mechanics test), +10 points per remaining second | level JSON / config |
| Enemy ladder choice: 60% take a ladder toward the player's floor, 25% any other ladder (seeded RNG) | config |

## Design decisions (ambiguities resolved)
- **D1 Player falls into open holes (owner decision 2026-10-27).** Walking onto an open hole (logical centre within 10 px of the hole centre) drops the player to the next floor, continuing through any ALIGNED open holes below, like enemies. No damage and no control while falling. Reason: walking over holes made the game too easy. This departs from the manual's "player can safely cross holes". A hole holding a trapped enemy is not open, so the player can walk over it.
- **D2 Bottom floor.** The bottom floor is never diggable (enforced by level validation), so every fall has a landing floor.
- **D3 Pounded hole seals.** When an enemy is knocked through, the hole it was in is refilled. Only *other* open holes in the same column below can extend the fall.
- **D4 Occupied hole is solid.** A falling enemy lands on a lower hole that already holds a trapped enemy; it does not pass through.
- **D5 Escape seals the hole.** A trapped enemy that climbs out refills its hole (prevents instant re-trap loops). Unverified vs. the original.
- **D6 Survived falls.** An enemy that lands without enough floors is stunned 0.6 s (harmless), then patrols. Floor counts never accumulate across falls.
- **D7 Life lost.** On a hit (or time-out), the game freezes 1.2 s, then: holes reset (preset holes re-opened), surviving enemies return to spawn, player returns to spawn with 1.0 s invulnerability, timer restarts. Defeated enemies stay defeated.
- **D8 Trapped enemies are harmless**, as are enemies that are falling, stunned or climbing out.
- **D9 Hole catch.** An enemy falls in only when its logical centre is within 10 px of the hole tile centre (grid logic, never sprite overlap).
- **D10 Ladder cells.** The floor tile at both ends of a ladder is a ladder cell and can never be dug.
- **D11 Context-sensitive directional keys (owner decisions 2026-10-27).** J acts on the tile to the LEFT, K on the tile to the RIGHT (classic keymap: A left, S right; I/J/K/M move). What one pulse does depends on that tile: solid or partly dug → dig; open hole (or a fill in progress) → fill; trapped enemy → pound. Every action takes 6 pulses (filling uses the same count as pounding). Pressing J/K turns the player to face that side. A HELD key stops after an action completes (hole opened / filled / enemy knocked through) until it is released, so holding never rolls from digging straight into filling. A tap during the 7-step cooldown is buffered (one deep) instead of dropped.
- **D12 Frame timing.** The scene measures its own real frame delta with `performance.now()` (Phaser's delta is smoothed), clamps it to 100 ms, multiplies by world speed, and runs at most `ceil(5 × speed)` logic steps per frame; extra time is dropped, not replayed.
- **D13 Mechanics test level** starts the player on the top floor with the green and blue enemies, and pre-opens aligned shafts (col 8: one hole below → green 2 floors; col 10: two holes below → blue 3 floors) plus an offset hole (col 9 on floor 2). Key **G** re-opens the preset holes (never under an enemy).

- **D17 Cactus levels keep the same rules (2026-10-28).** Tried two gentler variants for L11–15 (trap time 7.5 s; trap 7.5 s + less player-seeking enemies): no clear change in the scripted player's results, so the owner's spec is kept as-is (speed 80, default trap time). The simple bot only proves these levels solvable; their human difficulty is to be judged by play-testing.
- **D16 Level progression (owner decision 2026-10-27).** Levels 1–5: 1–5 red apples. From level 6 the total stays 5 and one red becomes a green per level (L6 4R+1G … L10 5G). Enemy speed stays at the default 80 for all levels; time limit = 90 s + 30 s per red + 45 s per green. Ladder layouts come from a seeded generator (`tools/gen-levels.mjs`); for levels 6–10 the layout was picked among 7 candidates by how a scripted player fared over 5 enemy-RNG seeds, aiming for a gradual rise. From level 11 one green becomes a blue per level (L11 4G+1B … L15 5B); time adds 60 s per blue. Score and lives carry between levels; time resets per level; after level 15 the game returns to the menu.
- **D15 Plant enemies (owner decision 2026-10-27).** All three enemies are plants: red apple (squat), green flytrap (wide), blue cactus (tall). Internal kind ids stay `red` / `green` / `blue`.
- **D14 Music.** Original compositions only (no recreation of the 1981 game's audio). Music restarts from the top after pause or a lost life rather than resuming mid-phrase (simpler; PROVISIONAL). Music volume is fixed relative to SFX; a volume slider is not in Stage 1.

## Not done yet (by design for Stage 1)
- No comparison against original gameplay footage: speeds, trap time, scoring bonus and level layouts are not frame-accurate.
- Only one campaign level; no original 32-level data.
- No gamepad / touch controls; no LICENSE chosen yet (owner's decision).
