# ainative Project Memory

This file captures evolving project facts, decisions, and recurring gotchas that are useful across sessions for both Codex and Claude Code.

## Current State

- Core ainative app is on Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, and SQLite via Drizzle.
- Main product surfaces are Home, Costs, Dashboard, Documents, Inbox, Monitor, Profiles, Projects, Schedules, Settings, Tasks, and Workflows.
- `features/`, `ideas/`, and `wireframes/` are intentionally local planning artifacts and remain gitignored.
- `.claude/` is also gitignored; it is useful for Claude workflows and as source material for Codex skill ports.
- Distribution is `npx ainative` (npm) and web app only — no desktop shell.
- Provider runtime abstraction is now in place under `src/lib/agents/runtime/`, with Claude and OpenAI Codex App Server registered as runtime adapters and shared runtime services handling task assist, scheduler/workflow launches, inbox approvals, and settings health checks.

## Design System

- The canonical design-system source is `design-system/MASTER.md`.
- `src/app/globals.css` contains the actual token and utility implementation.
- The app still uses route-level gradient identities and glassmorphism in the shell, but dense operational surfaces now have a solid-surface layer via:
  - `surface-card`
  - `surface-card-muted`
  - `surface-control`
  - `surface-scroll`
- Current rule of thumb:
  - glass for shell framing, popovers, dialogs, and accent surfaces
  - solid surfaces for dense lists, cards, forms, boards, monitoring UI, and profile browser/detail content

## Recent UX Foundation Work

- Theme bootstrapping was hardened so light/dark mode resolves before paint.
- Theme state is synchronized through DOM class, `data-theme`, `color-scheme`, local storage, and cookie.
- Dashboard, monitor, kanban, inbox, projects, profiles, and settings moved toward solid operational surfaces for better readability.
- Profile routes now use bounded `surface-page` framing plus `surface-card` and `surface-control` primitives to avoid scroll jank and card compositing flash.
- Settings content width was widened to improve scanability.
- Home, inbox, and projects now use bounded route canvases and denser composition so the shell, toolbar, and sparse project states feel more intentional in browser review.

## Remaining UX Follow-Up

- Sidebar/background cohesion, inbox toolbar density, and sparse projects composition were addressed by `ui-density-refinement`.

## Architecture Notes

- Server Components query the database directly; API routes are mainly for client mutations.
- Task execution is fire-and-forget and human-in-the-loop flows are mediated through notifications.
- SSE is used for log streaming.
- Database bootstrap logic should stay aligned with migration SQL to avoid deployed-schema drift.
- New provider work should extend the runtime registry instead of importing Claude-specific helpers directly from shared orchestration code.
- Schedule rows now carry `assignedAgent`, and workflow steps / loop configs can target provider runtimes directly.
- Technical Decision Records (TDRs) are maintained in `.claude/skills/architect/references/tdr-*.md` with 7 categories (data-layer, agent-system, api-design, frontend-architecture, runtime, workflow, infrastructure).
- The `/architect` skill provides architecture review, change impact analysis, integration design, TDR management, architecture health, and drift detection. Supervisor delegates architecture questions to it.
- Drift detection identifies positive patterns to codify as new TDRs and negative patterns (anti-patterns) to remediate in code.

## Recurring Gotchas

- Drizzle schema changes and migration SQL must be kept in sync.
- Raw Drizzle `sql` interpolation for column references is easy to misuse; prefer typed query builder patterns.
- Tailwind v4 utility layers can beat naive custom selectors; increased specificity may be required when overriding `data-slot` components.
- New sheet or dialog bodies often need explicit inner padding; do not assume Radix/shadcn body spacing exists by default.
- **All ainative clones on a machine share `~/.ainative/ainative.db`** (see `src/lib/utils/ainative-paths.ts`) unless `AINATIVE_DATA_DIR` is set in `.env.local`. Any clone used for license/tier experiments — e.g. the wealth-manager evaluation branch at `/Users/manavsehgal/Developer/ainative-wealth` (isolated to `~/.ainative-wealth/`) — MUST override `AINATIVE_DATA_DIR` or its `licenseManager.activate()` writes (and any other DB mutations) will leak into every other clone. Symptom: main repo's Settings page shows `scale` instead of `community` after the wealth clone runs.
- **`addColumnIfMissing` runs BEFORE the table CREATE in `src/lib/db/bootstrap.ts`.** Adding a new column via ALTER alone fails silently on fresh DBs (the test temp dir, a brand-new install) because the table doesn't exist yet at the ALTER's call site. Fix: add the column to BOTH the `CREATE TABLE IF NOT EXISTS` statement (covers fresh DBs) AND the `addColumnIfMissing` call (covers existing DBs). The ALTER's silent error swallow (`if (!msg.includes("duplicate column"))`) means the failure will only show as downstream `SqliteError: table X has no column named Y` from Drizzle inserts. Caught in the `chat-ollama-native-skills` PR.
- **Spec frontmatter `status: planned` is unreliable.** Two of three Wave 1 features (`chat-session-persistence-provider`, `chat-settings-tool`) were code-shipped with `status: planned` in the spec. ALWAYS grep for the spec's referenced files / functions / DB columns BEFORE treating a planned feature as greenfield. If the artifacts already exist, the work shifts from "build" to "verify + close out", which is much faster.
- **Features that touch system-prompt construction need cross-runtime consideration upfront.** Initial `chat-ollama-native-skills` injected SKILL.md unconditionally, duplicating context on Codex/Claude where the SDK already loads it natively. The `runtime-capability-matrix` (`hasNativeSkills`, `ainativeInjectsSkills`, `autoLoadsInstructions`) is the source of truth for "should ainative do X or trust the runtime to do X". Consult it in any Tier 0 / system-prompt code path.

## Test & Smoke Discipline

Lessons worth keeping after the chat-ollama / chat-codex skill wave:

- **Mock at the outermost boundary, not the wrapper interface.** A unit test that mocks `getSkill()` end-to-end will pass even if `getSkill()` itself is broken. Mocking `node:fs` (or whatever real boundary the wrapper crosses) lets the wrapper's logic actually execute against the mock. The `EISDIR` bug in `chat-ollama-native-skills` (calling `readFileSync` on a directory) shipped with all 11 unit tests green and crashed at the first real `activate_skill` call — only the smoke test caught it.
- **`vi.mock("node:fs")` and `vi.mock("fs")` are different module-graph nodes.** If your module under test imports from `"node:fs"`, mocking `"fs"` is a no-op. Match the import specifier exactly. Caught in the `chat-file-mentions` test setup.
- **Provide BOTH named exports AND `default` export when mocking node built-ins.** `vi.mock("node:fs", () => ({ realpathSync, statSync }))` will fail downstream code that does `import fs from "fs"` and then `fs.statSync(...)`. Pattern: `return { default: { realpathSync, statSync, ... }, realpathSync, statSync, ... };`.
- **The smoke-test budget rule from `.claude/skills/writing-plans/SKILL.md` paid for itself three times this session.** Bugs caught at smoke that unit tests structurally couldn't reach: (1) `EISDIR` on skill directory; (2) test temp DB missing `active_skill_id` because ALTER ran before CREATE; (3) Tier 0 SKILL.md duplication on runtimes with native skill discovery. All three would have shipped with full unit-test green.
- **A/B browser smoke = highest-confidence behavior verification possible.** When changing behavior, capture a "before" reading from the model in the same conversation, then ask the same question after the code change. The model itself becomes the oracle, comparing two of its own system prompts. Pattern used to verify `ainativeInjectsSkills` flag in `chat-codex-app-server-skills`.
- **The TS diagnostic panel is consistently flaky for newly-edited files.** Stale "is declared but its value is never read" + phantom "Cannot find module" warnings appear after every edit and clear after a few seconds. Trust `npx tsc --noEmit | grep <file>` over the inline panel for ground truth.
- **Always read upstream API docs before implementing the spec's interpretation.** The original `chat-codex-app-server-skills` spec called for wiring `turn/start` skill parameters into `sendCodexMessage()`. Reading `.claude/reference/developers-openai-com-codex-sdk/app-server.md` revealed the protocol has no such parameters — Codex auto-discovers from `cwd`. Hours saved by reading first.

## Browser and Capture Notes

- Browser evaluation has been done successfully in local Chrome and via headless Chrome screenshots.
- Playwright is available as a Codex skill, but local environment quirks may still require Chrome fallback at times.
- The Codex skill set now includes ainative-specific ports of:
  - `product-manager`
  - `quality-manager`
  - `supervisor`
  - `frontend-designer`
  - `refer`
  - `capture`
  - `taste`
  - `screengrab`

## Claude and Codex Interop

- `.claude/reference/` currently contains local captures for:
  - Anthropic's "Building Effective Agents"
  - OpenAI Codex SDK / App Server docs
  - Claude Agent SDK docs
- `.claude/skills/` contains Claude-first source material for shared project workflows. The overlapping ainative-specific skills also exist under `~/.codex/skills/`, but the Codex versions are adapted for Codex tooling and should not be expected to stay byte-identical to the Claude copies.
- Verified Codex-installed ainative workflow ports currently include:
  - `architect`
  - `book-updater`
  - `brainstorming`
  - `capture`
  - `code-review`
  - `commit-push-pr`
  - `doc-generator`
  - `docx`
  - `frontend-design`
  - `frontend-designer`
  - `product-manager`
  - `pptx`
  - `quality-manager`
  - `refer`
  - `screengrab`
  - `supervisor`
  - `taste`
  - `user-guide-sync`
  - `worktree-production`
  - `writing-plans`
  - `xlsx`
- Claude-local skill files remain the detailed source material for the ainative-specific ports above. The Codex versions intentionally stay concise and point back to `.claude/skills/...` when deeper workflow detail is needed.
- Some Claude skill names are covered by existing Codex or system skills rather than separate project ports:
  - `skill-creator` -> Codex system `skill-creator`
  - `docx` -> Codex `doc` workflow plus the local compatibility shim
  - `xlsx` -> Codex `spreadsheet` workflow plus the local compatibility shim
- Claude-local settings live in `.claude/settings.local.json`; treat them as tool-specific execution preferences, not as the canonical shared instruction source.

## Tooling Conventions

- Use `AGENTS.md` for stable instructions.
- Use this file for evolving memory.
- Keep `CLAUDE.md` as a compatibility shim pointing back to these shared files.
