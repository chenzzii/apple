# Project Orchard Panic — Claude Code project rules

## Source of truth and scope
- Read `docs/GDD.md` for the intended gameplay and Stage 1 acceptance criteria.
- This is an original HD 2D cartoon *spiritual remake* of 1981 Apple Panic. Do not copy original artwork, code, music, logos, or brand presentation.
- Core identity: walk left/right, climb ladders, dig/pound holes, trap enemies and defeat them through consecutive aligned-floor falls. There is **no jump**.
- Keep verified original rules separate from provisional tuning. Log ambiguities and departures in `docs/DECISIONS.md` or `docs/PROGRESS.md`.
- Stage 1 objective: a **genuinely playable** web game with one clearable level and one mechanics-test level, not a mockup.

## Stack and architecture
- Phaser **4.2.1**, TypeScript (strict), Vite, Vitest; pin tested dependency versions and commit lockfile.
- Phaser 4 ESM uses `import * as Phaser from 'phaser'`, not `import Phaser from 'phaser'`.
- Keep `src/core/` simulation independent of Phaser. Phaser scenes own input, rendering, audio and HUD.
- Only one authoritative position/collision system. Do not have Arcade Physics and custom logic both move the same entity.
- Use logical grid coordinates/topology for holes, platforms and ladders, not sprite transparency or approximate graphics overlap.
- Favor a playable vertical slice over premature abstractions, fancy menus, or unrelated features.

## Non-negotiable simulation rules
- Deterministic simulation with fixed **60Hz logic timestep** and optional seeded RNG.
- Render separately with interpolation; monitor performance, but do not claim hardware-independent 60 FPS.
- World speed selector: 1.0x, 1.25x, 1.5x, 2.0x. Apply consistently to all game-clock timers, movement and enemy behavior; do not multiply render FPS.
- Pause and background-tab handling must stop simulation/game-clock progress and avoid large catch-up bursts.
- Digging a legal tile takes 6 valid pulses; pounding a trapped enemy takes 6 valid pulses (tunable values).
- Red enemies need 1 consecutive floor of fall, green 2, blue 3. Separate non-consecutive falls **do not** accumulate; offset holes do not chain.
- Never destroy a trapped enemy simply because a sprite overlaps the pit. Make explicit state transitions and score only once.
- Gameplay configuration may use placeholders where original timing is unverified; label values clearly.

## Art and usability
- Target 1280x720 logical design, responsive 16:9 scaling; original programmatically drawn colorful cartoon placeholders are permitted.
- Visuals must communicate trap progress, trapped state, fall path, remaining life, score, time and speed.
- Make the game playable with keyboard and help screen. Reserve architecture for later high-resolution texture atlases.
- No server, database, paid AI service, or copyrighted third-party assets in Stage 1.

## Verification and work rhythm
- First inspect repository and GDD, make a brief concrete plan; then implement the agreed stage end-to-end.
- After each vertical slice, run focused tests. Before stating completion, actually run `npm run typecheck`, `npm run test`, `npm run build` and record results.
- If browser tooling is available, launch the game and verify at least movement, climb, trap, pound, win and loss. Record browser screenshots or observations; if unavailable, explicitly mark browser verification as **not performed**.
- Check runtime errors and missing assets. Never equate successful build with a playable game.
- Keep `docs/PROGRESS.md` updated with completed work, commands/results, blockers, provisional game timings, and next actions.
- If a test fails, fix or clearly report it; never fabricate passed checks.
- Don't push to remote or deploy without an explicit instruction.
