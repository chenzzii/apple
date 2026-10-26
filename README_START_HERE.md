# Claude Code starter kit — Orchard Panic

Files:
- `CLAUDE.md`: persistent project rules; keep concise and checked into Git.
- `docs/GDD.md`: original game design document and test specifications.
- `docs/PROGRESS.md`: durable actual work status and verified checks.
- `prompts/01_PLAN.md`: enter Claude Code Plan Mode and ask it to read this file.
- `prompts/02_BUILD_STAGE1.md`: after approving the plan, leave Plan Mode and ask it to carry out this task.

Usage:
1. Extract this folder to a new, empty Git repository (or place its contents in the existing project root).
2. Launch Claude Code from the project root (`claude`).
3. Plan Mode: ask `請讀取 prompts/01_PLAN.md 並依指示提出計畫。`
4. Approve plan, leave Plan Mode.
5. Ask `請執行 prompts/02_BUILD_STAGE1.md；不要只規劃，請產出可遊玩的程式碼並完成驗證。`
6. Review actual `npm` command results and browser gameplay, and use `docs/PROGRESS.md` for continuity.

Notes:
- No game engine source code is included here.
- If your repository already has a CLAUDE.md, merge carefully rather than overwrite it.
- Keep references to the GDD instead of copying its entire content into CLAUDE.md.
