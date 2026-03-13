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

## Cross-Tool Compatibility

- `MEMORY.md` is the shared evolving context file for this project.
- `CLAUDE.md` should remain a thin compatibility pointer, not a second source of truth.
- Project-specific Codex skills live under `~/.codex/skills`; repo-local `.claude/skills/` remains useful as source material and for Claude compatibility.
- The tracked local desktop release skill lives at `.claude/skills/stagent-release/`; keep it aligned with `scripts/release-desktop.mjs` and the README desktop release section.
