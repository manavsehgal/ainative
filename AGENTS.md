# Stagent Agent Guide

This repository supports both Codex and Claude Code. Treat this file as the stable, shared instruction source for project-specific agent behavior.

## Operating Model

- Read the codebase first. Do not assume architecture or product intent from memory alone.
- Preserve user changes. Never revert unrelated work without explicit instruction.
- Prefer small, verifiable edits over speculative rewrites.
- For searches, prefer `rg` and `rg --files`.
- For manual file edits, use patch-based edits rather than ad hoc file rewrites.

## Product Docs

- `ideas/`, `features/`, and `wireframes/` are local planning artifacts.
- `features/` is intentionally gitignored in this repo.
- If the user asks for roadmap, changelog, or feature-spec updates, update the local files, but do not assume they belong in git.
- When changing shipped behavior, keep product docs consistent with code when requested.

## Design System

- Read `design-system/MASTER.md` and `src/app/globals.css` before making substantial UI changes.
- Use semantic tokens instead of raw Tailwind semantic colors.
- Stagent uses two surface families:
  - glass surfaces for shell chrome, dialogs, popovers, and low-density accent panels
  - solid `surface-*` utilities for dense operational screens
- On dashboard, inbox, monitor, kanban, project, and settings screens, prefer readability and scan speed over decorative blur.

## Frontend Rules

- Stack: Next.js App Router, React 19, Tailwind v4, shadcn/ui.
- Typography defaults: Geist Sans and Geist Mono.
- Icon library: Lucide React.
- Keep interactive cards keyboard-accessible and preserve visible focus styles.
- Avoid introducing new visual patterns when an existing shared component or token already covers the use case.

## Backend and Data Rules

- Database: SQLite via better-sqlite3 + Drizzle.
- Server Components should query the DB directly; API routes are for client mutations.
- Validate boundaries with Zod.
- Prefer typed query-builder usage over fragile raw SQL where Drizzle column refs are involved.

## Testing and Verification

- Prefer targeted tests first, then broader suite runs when risk warrants it.
- For UI work, use browser evaluation when the user asks or when a visual change needs real verification.
- Save browser artifacts under `output/` unless the task explicitly wants another location.

## Engineering Principles

These 7 directives apply to all skills, all code, and all reviews. They are the shared engineering vocabulary.

1. **Zero silent failures** — every failure mode must be visible to the user. If something can fail, the failure path must produce output, not swallow it.
2. **Every error has a name** — use specific error types, not generic catches. `DocumentProcessingError` beats `Error`. Name it, throw it, handle it at the right level.
3. **Data flows have shadow paths** — trace nil, empty, and upstream-error through every pipeline. Ask: what happens when this value is undefined? What if the upstream call returns an empty array? What if it errors?
4. **Interactions have edge cases** — double-click, navigate-away, slow connection, stale state. Every user-facing interaction has at least one edge case that isn't the happy path. Find it before the user does.
5. **Explicit over clever** — readability beats elegance; minimal diffs beat rewrites. If you need a comment to explain it, simplify the code instead.
6. **DRY with judgment** — extract on third use, not first. Three similar lines of code is better than a premature abstraction. When you do extract, the abstraction must earn its weight.
7. **Permission to scrap** — if a better approach emerges mid-implementation, table current work and switch. Sunk cost is not a reason to continue a suboptimal path.

## Worktree Context

- Dogfooding worktrees use isolated data dirs via `STAGENT_DATA_DIR` in `.env.local`. Never share a DB between instances.
- Migration files: use `XXXX_` prefix during development, renumber to next sequential at PR time.
- Run `/worktree-production` for setup, sync, seed, and migration procedures.
- In a dogfooding worktree: focus on using the app. Report bugs — don't fix them here.
- On main: normal FLOW.md lifecycle. Check dogfooding feedback before picking next work.

## Cross-Tool Compatibility

- `MEMORY.md` is the shared evolving context file for this project.
- `CLAUDE.md` should remain a thin compatibility pointer, not a second source of truth.
- Project-specific Codex skills live under `~/.codex/skills`; repo-local `.claude/skills/` remains useful as source material and for Claude compatibility.
