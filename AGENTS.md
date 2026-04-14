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
- **Smoke-test budget for runtime-registry-adjacent features.** Whenever a plan adds, removes, or reshapes an import in any module transitively reachable from `@/lib/agents/runtime/catalog.ts` — notably `src/lib/agents/claude-agent.ts`, `src/lib/agents/runtime/claude.ts`, `src/lib/agents/runtime/openai-direct.ts`, `src/lib/agents/runtime/anthropic-direct.ts`, or `src/lib/workflows/engine.ts` — it **must** budget an end-to-end smoke step that runs a real task under `npm run dev`, not just unit tests. Unit tests that `vi.mock("@/lib/chat/stagent-tools", ...)` (or any other chat-tools module) structurally cannot catch module-load cycles, because the real module is never evaluated during the test run. A static `import ... from "@/lib/chat/stagent-tools"` in any file under `src/lib/agents/` will compile and pass 100% of unit tests while crashing at the first Next.js request with `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`. Use a dynamic `await import()` inside function bodies instead, and always smoke-verify. See TDR-032 and `features/task-runtime-stagent-mcp-injection.md` → "Verification run — 2026-04-11" for the precedent.

### Chat stream termination runbook

Before filing a bug report about chat streams cutting off mid-response ("conversation refreshed", "my answer got lost"), hit the diagnostics endpoint:

```
curl http://localhost:3000/api/diagnostics/chat-streams?windowMinutes=10
```

This returns counts by reason code for the last 10 minutes. What to look for:

- Mostly `stream.completed` → normal end-of-generation. Symptom is likely client-side (browser extension, tab suspension, misattributed cutoff).
- Elevated `stream.aborted.client` → clients are disconnecting mid-stream. Check for accidental `AbortController.abort()` calls, stale React effects unmounting the chat, or Next.js dev HMR remounting the shell.
- Any `stream.aborted.signal` → `req.signal` fired. Expected for the user clicking Stop; unexpected otherwise.
- Any `stream.finalized.error` → the engine's generator threw. The `error` field on each event has a 500-char snippet; grep logs for the full trace.
- Any `stream.abandoned` → the generator was abandoned via `iterator.return()` (consumer broke out of the for-await without an error). Happens when the client disconnects cleanly or when Next.js dev HMR interrupts an active stream. Non-zero counts are a signal that something is terminating streams through a path that skips both the success and catch branches.
- Any `stream.reconciled.stale` → the 10-minute safety net swept an orphan row at page load. If this number is non-zero, even the finalize safety net missed a cleanup — that's a real bug worth investigating.

Client-side exits are logged via `console.info` with a `[chat-stream]` prefix — filter DevTools for that string to see `client.stream.done`, `client.stream.user-abort`, and `client.stream.reader-error`. Attach the diagnostics response + DevTools filter output to any stream-cutoff bug report so we don't waste a review cycle chasing symptoms.

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

## Instance Bootstrap Dev-Mode Gate

The canonical stagent dev repo (`/Users/manavsehgal/Developer/stagent`) must skip the `instance-bootstrap` feature's auto-upgrade machinery — otherwise a pre-push hook would be installed on first `npm run dev` and block contributor pushes to `origin/main`.

Two independent gates prevent this, both already in place:

1. **`STAGENT_DEV_MODE=true` in `.env.local`** (primary, per-developer). Set on this machine. Required for every contributor's local setup — add it to your `.env.local` before first `npm run dev` after pulling in the instance-bootstrap feature.
2. **`.git/stagent-dev-mode` sentinel file** (secondary, git-dir-scoped). Never cloned, never committed, persists across `.env.local` edits. Create once per clone: `touch .git/stagent-dev-mode`.

When either gate is active, `ensureInstance()` returns immediately with no side effects — no branches created, no hooks installed, no scheduled tasks registered.

**To test the instance-bootstrap feature in the main repo** (e.g., verifying the consent flow): set `STAGENT_INSTANCE_MODE=true` in your shell — this override wins over both dev-mode gates. Unset it when done testing.

See `features/instance-bootstrap.md` for the full gate logic and `PRIVATE-INSTANCES.md` (gitignored) for the end-user workflow this feature automates.

## Cross-Tool Compatibility

- `MEMORY.md` is the shared evolving context file for this project.
- `CLAUDE.md` is the Claude Agent SDK's `project` setting source — the SDK loads it directly rather than following pointers. It mirrors selected authoritative sections from this file (marked `<!-- synced from AGENTS.md#... -->`). Edit `AGENTS.md` first, then sync the corresponding section into `CLAUDE.md`.
- Project-specific Codex skills live under `~/.codex/skills`; repo-local `.claude/skills/` remains useful as source material and for Claude compatibility.
