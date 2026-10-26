# Decisions, provisional values and departures — Stage 1

Legend: **VERIFIED** = stated in the original Apple II manual / GDD §1 sources. **PROVISIONAL** = our own tuning, not measured from the 1981 original. Change values in `src/core/config.ts`.

## Verified rules kept as-is
| Rule | Where |
|---|---|
| No jump; move left/right, climb ladders, dig, pound/fill | `Simulation.updatePlayer` |
| Red 1 floor / green 2 / blue 3, achieved in ONE continuous fall | `ENEMY_KINDS`, `Simulation.enemyLand` |
| Base score 100 / 200 / 300 per floor fallen | `ENEMY_KINDS` |
| 3 lives | `DEFAULT_CONFIG.startLives` |
| Player can pass over holes safely | see D1 |
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
- **D1 Player over holes.** The manual says the player can safely cross holes, so the player walks over open holes and never falls through them. The GDD FSM's player `FALLING` state is therefore unused in Stage 1.
- **D2 Bottom floor.** The bottom floor is never diggable (enforced by level validation), so every fall has a landing floor.
- **D3 Pounded hole seals.** When an enemy is knocked through, the hole it was in is refilled. Only *other* open holes in the same column below can extend the fall.
- **D4 Occupied hole is solid.** A falling enemy lands on a lower hole that already holds a trapped enemy; it does not pass through.
- **D5 Escape seals the hole.** A trapped enemy that climbs out refills its hole (prevents instant re-trap loops). Unverified vs. the original.
- **D6 Survived falls.** An enemy that lands without enough floors is stunned 0.6 s (harmless), then patrols. Floor counts never accumulate across falls.
- **D7 Life lost.** On a hit (or time-out), the game freezes 1.2 s, then: holes reset (preset holes re-opened), surviving enemies return to spawn, player returns to spawn with 1.0 s invulnerability, timer restarts. Defeated enemies stay defeated.
- **D8 Trapped enemies are harmless**, as are enemies that are falling, stunned or climbing out.
- **D9 Hole catch.** An enemy falls in only when its logical centre is within 10 px of the hole tile centre (grid logic, never sprite overlap).
- **D10 Ladder cells.** The floor tile at both ends of a ladder is a ladder cell and can never be dug.
- **D11 Keymaps.** Modern: arrows/WASD + J dig + K pound. Classic (original-style): I/J/K/M move + A dig + S pound. Only one keymap is active at a time (toggle with C on the menu).
- **D12 Frame timing.** The scene measures its own real frame delta with `performance.now()` (Phaser's delta is smoothed), clamps it to 100 ms, multiplies by world speed, and runs at most `ceil(5 × speed)` logic steps per frame; extra time is dropped, not replayed.
- **D13 Mechanics test level** starts the player on the top floor with the green and blue enemies, and pre-opens aligned shafts (col 8: one hole below → green 2 floors; col 10: two holes below → blue 3 floors) plus an offset hole (col 9 on floor 2). Key **G** re-opens the preset holes (never under an enemy).

## Not done yet (by design for Stage 1)
- No comparison against original gameplay footage: speeds, trap time, scoring bonus and level layouts are not frame-accurate.
- Only one campaign level; no original 32-level data.
- No gamepad / touch controls; no LICENSE chosen yet (owner's decision).
