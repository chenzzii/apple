# Claude Code — Phase 1: inspect and plan (Plan Mode)

Read `CLAUDE.md` and `docs/GDD.md`, then inspect the current repo and environment.

This project is an original high-definition 2D cartoon spiritual remake of the 1981 Apple Panic gameplay. You are working toward a *playable* Stage 1, not a presentation website.

In **Plan Mode**, do not edit code yet. Please:

1. Identify whether the repository is empty or already has a functioning Phaser/TypeScript project.
2. Confirm the Phaser 4.2.1 import/module conventions and propose a minimal, viable stack.
3. Outline a vertical-slice implementation sequence:
   - boot, grid, player walk and ladders;
   - digging holes (6 pulses) and visual feedback;
   - red enemy patrol / trap / pound / 1-level fall and win-loss loop;
   - green/blue enemies, aligned 2/3-floor fall tests;
   - pause/speed options, HUD and 60Hz fixed-step loop;
   - unit tests and real browser checks.
4. Identify the three riskiest rules or physics corner cases.
5. Show the exact verification commands, browser checks, and files to create.
6. Keep the proposal concise enough to execute, and flag any GDD values that are unverified historical approximations.

Do not ask for routine architectural choices: apply sensible defaults and record them. Request approval for the plan before code edits; upon approval, use `prompts/02_BUILD_STAGE1.md` for the implementation.
