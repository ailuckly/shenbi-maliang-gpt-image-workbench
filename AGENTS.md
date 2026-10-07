# ShenBi workspace guide

Read [docs/project/README.md](docs/project/README.md) and [docs/project/CURRENT-STATE.md](docs/project/CURRENT-STATE.md) before changing this fork. The product goal and phased acceptance criteria are in [docs/project/GOAL-ROADMAP.md](docs/project/GOAL-ROADMAP.md).

**Execution:** work through [docs/project/CODEX-EXECUTION.md](docs/project/CODEX-EXECUTION.md) task by task (P0-1 onward), following its section 0 rules: one branch per phase, at least one commit per task, run check/build/tests, and append evidence to [docs/project/PROGRESS.md](docs/project/PROGRESS.md) after every task. Work is independently reviewed against that file's acceptance criteria; unrecorded or unreproducible claims are treated as not done.

## Project map

- Frontend: React/Vite; `src/App.tsx`, `src/pages/LoginPage.tsx`, `src/components/WorkbenchShell.tsx`, `src/pages/ChatPage.tsx`.
- Admin: `src/config/ConfigApp.tsx`, `ConfigDashboard.tsx`, `configNav.ts`, `panels/`.
- Backend: Bun/Hono `server/index.ts`; generation/edit `server/imageRoutes.ts`; provider calls `server/providerRuntime.ts`.
- Prompt optimize handler is in `server/promptTemplateRoutes.ts`; provider management is in `server/promptOptimizerRoutes.ts`.
- SQLite: `server/schema.ts`, `server/db.ts`; data defaults to ignored `data/`.

## Established decisions

- Product name: ShenBi. Restrained, professional UI (no gradients, glass, decorative animation). Homepage reference is `docs/assets-library/shenbi/homepage-v3/design.png` with the changes listed in CODEX-EXECUTION.md P3-2; it is a design reference, not an implemented page.
- Reuse existing authentication, image jobs, optimizer, editor, asset library and config APIs. Keep the ChatGPT-style conversation UI (ChatComposer, ChatMessages, ConversationView, ChatPage, WorkbenchShell sidebar): add features only as toolbar controls, popovers or in-conversation message cards, never as page forms — see "聊天界面约束" in CODEX-EXECUTION.md. `src/v2/` tokens must not restyle legacy pages. Hide unrelated upstream modules via switches instead of deleting them.
- Prompt engine may adapt linshenkx/prompt-optimizer (AGPL-3.0-only, reference commit 92c5aaa); every adapted template must record its source path and commit.
- License is AGPL-3.0-only; keep the upstream MIT notice (LICENSES/MIT-upstream.txt), NOTICE.md attribution, and compatibility identifiers such as `maliang` MCP tool names/headers; display branding and protocol identifiers have different purposes.
- Keep credentials, runtime databases and private user files out of Git and documentation. File encryption keys live in config.db; backups need both DBs and files together.

## Verification and maintenance

- `bun run check`; `bun run build`; use isolated data for tests: `GPT_IMAGE_DATA_DIR="$PWD/tmp/test-data" bun test`.
- Bun can be invoked locally with `npx --yes --package=bun bun` when not globally installed. Existing local services use frontend 5173 and backend 8787.
- Baseline on 2026-10-06: build passed; Bun tests 537 pass / 1 known upstream-reproduced local MCP stdio failure. Do not report the full suite as passing until fixed.
- Real third-party model calls and optional Python bridge were not validated in this baseline. Model IDs in the source are not evidence of a supplier's supported models.
- Regenerate project indexes with `node scripts/project-inventory.mjs`. Update `docs/database-schema.md` for schema changes and project docs for meaningful API/flow/deployment changes.
