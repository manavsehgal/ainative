# Stagent Project Memory

This file captures evolving project facts, decisions, and recurring gotchas that are useful across sessions for both Codex and Claude Code.

## Current State

- Core Stagent app is on Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, and SQLite via Drizzle.
- Main product surfaces are Home, Dashboard, Inbox, Monitor, Projects, Workflows, Documents, Profiles, Schedules, and Settings.
- `features/`, `ideas/`, and `wireframes/` are intentionally local planning artifacts and remain gitignored.
- `.claude/` is also gitignored; it is useful for Claude workflows and as source material for Codex skill ports.
- macOS desktop releases are now built locally via `npm run desktop:release`; the published GitHub assets are normalized to `Stagent.dmg` and `Stagent.app.zip` so `releases/latest/download/Stagent.dmg` stays stable.
- Publishing those desktop assets now requires `APPLE_SIGNING_IDENTITY` plus notarization credentials (`APPLE_NOTARY_PROFILE` or `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`) so shipped downloads clear Gatekeeper.
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
- The desktop sidecar must bind Next to `127.0.0.1`, not wildcard interfaces. The Tauri shell polls `127.0.0.1`, and binding Next to `::` can recreate the "Waiting for the localhost app to answer" hang when another app already occupies the same IPv6 localhost port.

## Recurring Gotchas

- Drizzle schema changes and migration SQL must be kept in sync.
- Raw Drizzle `sql` interpolation for column references is easy to misuse; prefer typed query builder patterns.
- Tailwind v4 utility layers can beat naive custom selectors; increased specificity may be required when overriding `data-slot` components.
- New sheet or dialog bodies often need explicit inner padding; do not assume Radix/shadcn body spacing exists by default.
- `npm run desktop:build` now includes `scripts/desktop-sidecar-smoke.mjs`, which starts the packaged sidecar while an IPv6-only localhost listener already owns the same port. Keep that smoke test passing; it is the regression guard for the desktop boot screen hang.

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
