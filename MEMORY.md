# Stagent Project Memory

This file captures evolving project facts, decisions, and recurring gotchas that are useful across sessions for both Codex and Claude Code.

## Current State

- Core Stagent app is on Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, and SQLite via Drizzle.
- Main product surfaces are Home, Costs, Dashboard, Documents, Inbox, Monitor, Profiles, Projects, Schedules, Settings, Tasks, and Workflows.
- `features/`, `ideas/`, and `wireframes/` are intentionally local planning artifacts and remain gitignored.
- `.claude/` is also gitignored; it is useful for Claude workflows and as source material for Codex skill ports.
- Distribution is `npx stagent` (npm) and web app only — no desktop shell.
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

## Browser and Capture Notes

- Browser evaluation has been done successfully in local Chrome and via headless Chrome screenshots.
- Playwright is available as a Codex skill, but local environment quirks may still require Chrome fallback at times.
- The Codex skill set now includes Stagent-specific ports of:
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
- `.claude/skills/` contains Claude-first source material for shared project workflows. The overlapping Stagent-specific skills also exist under `~/.codex/skills/`, but the Codex versions are adapted for Codex tooling and should not be expected to stay byte-identical to the Claude copies.
- Claude-local settings live in `.claude/settings.local.json`; treat them as tool-specific execution preferences, not as the canonical shared instruction source.

## Tooling Conventions

- Use `AGENTS.md` for stable instructions.
- Use this file for evolving memory.
- Keep `CLAUDE.md` as a compatibility shim pointing back to these shared files.
