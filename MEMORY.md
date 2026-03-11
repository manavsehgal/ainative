# Stagent Project Memory

This file captures evolving project facts, decisions, and recurring gotchas that are useful across sessions for both Codex and Claude Code.

## Current State

- Core Stagent app is on Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, and SQLite via Drizzle.
- Main product surfaces are Home, Dashboard, Inbox, Monitor, Projects, Workflows, Documents, Profiles, Schedules, and Settings.
- `features/`, `ideas/`, and `wireframes/` are intentionally local planning artifacts and remain gitignored.
- `.claude/` is also gitignored; it is useful for Claude workflows and as source material for Codex skill ports.
- Provider runtime abstraction is now in place under `src/lib/agents/runtime/`, with Claude registered as the first adapter and shared runtime services handling task assist, profile tests, scheduler/workflow launches, and settings health checks.

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

## Remaining UX Follow-Up

- Sidebar/background cohesion on the home shell still needs refinement.
- Inbox toolbar density and control affordance can be improved.
- Projects page composition feels sparse when project count is low.

## Architecture Notes

- Server Components query the database directly; API routes are mainly for client mutations.
- Task execution is fire-and-forget and human-in-the-loop flows are mediated through notifications.
- SSE is used for log streaming.
- Database bootstrap logic should stay aligned with migration SQL to avoid deployed-schema drift.
- New provider work should extend the runtime registry instead of importing Claude-specific helpers directly from shared orchestration code.

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

## Tooling Conventions

- Use `AGENTS.md` for stable instructions.
- Use this file for evolving memory.
- Keep `CLAUDE.md` as a compatibility shim pointing back to these shared files.
