# Claude Code Guide

This file is the Claude Agent SDK's `project` setting source. The SDK loads
it directly and does not follow pointers — so canonical Claude-visible
content lives here, not in `AGENTS.md`.

**Sync contract:** the sections marked `<!-- synced from AGENTS.md#X -->`
are copy-pasted verbatim from `AGENTS.md`. Edit `AGENTS.md` first, then
mirror here. See `MEMORY.md` for evolving context (recurring gotchas,
lessons learned) and `AGENTS.md` for the full cross-tool agent guide.

## Quick Start

```bash
npm run dev
npm run build:cli
npm test
npm run test:coverage
```

## Claude-Specific Notes

- Claude-local settings may live in `.claude/settings.local.json`.
- Claude memory also exists under `~/.claude/projects/.../memory/`; the
  repo-level shared files are canonical first.
- Project skills live in `.claude/skills/`. `superpowers:*` skills drive
  the dev lifecycle; `writing-plans`, `subagent-driven-development`, and
  `verification-before-completion` are mandatory for non-trivial work.

<!-- synced from AGENTS.md#operating-model -->
## Operating Model

- Read the codebase first. Do not assume architecture or product intent from memory alone.
- Preserve user changes. Never revert unrelated work without explicit instruction.
- Prefer small, verifiable edits over speculative rewrites.
- For searches, prefer `rg` and `rg --files`.
- For manual file edits, use patch-based edits rather than ad hoc file rewrites.

<!-- synced from AGENTS.md#backend-and-data-rules -->
## Backend and Data Rules

- Database: SQLite via better-sqlite3 + Drizzle.
- Server Components should query the DB directly; API routes are for client mutations.
- Validate boundaries with Zod.
- Prefer typed query-builder usage over fragile raw SQL where Drizzle column refs are involved.

<!-- synced from AGENTS.md#testing-and-verification -->
## Testing and Verification

- Prefer targeted tests first, then broader suite runs when risk warrants it.
- For UI work, use browser evaluation when the user asks or when a visual change needs real verification.
- Save browser artifacts under `output/` unless the task explicitly wants another location.
- **Smoke-test budget for runtime-registry-adjacent features.** Whenever a plan adds, removes, or reshapes an import in any module transitively reachable from `@/lib/agents/runtime/catalog.ts` — notably `src/lib/agents/claude-agent.ts`, `src/lib/agents/runtime/claude.ts`, `src/lib/agents/runtime/openai-direct.ts`, `src/lib/agents/runtime/anthropic-direct.ts`, or `src/lib/workflows/engine.ts` — it **must** budget an end-to-end smoke step that runs a real task under `npm run dev`, not just unit tests. Unit tests that `vi.mock("@/lib/chat/stagent-tools", ...)` (or any other chat-tools module) structurally cannot catch module-load cycles, because the real module is never evaluated during the test run. A static `import ... from "@/lib/chat/stagent-tools"` in any file under `src/lib/agents/` will compile and pass 100% of unit tests while crashing at the first Next.js request with `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`. Use a dynamic `await import()` inside function bodies instead, and always smoke-verify. See TDR-032 and `features/task-runtime-ainative-mcp-injection.md` → "Verification run — 2026-04-11" for the precedent.

<!-- synced from AGENTS.md#engineering-principles -->
## Engineering Principles

These 7 directives apply to all skills, all code, and all reviews.

1. **Zero silent failures** — every failure mode must be visible to the user. If something can fail, the failure path must produce output, not swallow it.
2. **Every error has a name** — use specific error types, not generic catches. `DocumentProcessingError` beats `Error`. Name it, throw it, handle it at the right level.
3. **Data flows have shadow paths** — trace nil, empty, and upstream-error through every pipeline. Ask: what happens when this value is undefined? What if the upstream call returns an empty array? What if it errors?
4. **Interactions have edge cases** — double-click, navigate-away, slow connection, stale state. Every user-facing interaction has at least one edge case that isn't the happy path. Find it before the user does.
5. **Explicit over clever** — readability beats elegance; minimal diffs beat rewrites. If you need a comment to explain it, simplify the code instead.
6. **DRY with judgment** — extract on third use, not first. Three similar lines of code is better than a premature abstraction. When you do extract, the abstraction must earn its weight.
7. **Permission to scrap** — if a better approach emerges mid-implementation, table current work and switch. Sunk cost is not a reason to continue a suboptimal path.

<!-- synced from AGENTS.md#instance-bootstrap-dev-mode-gate -->
## Instance Bootstrap Dev-Mode Gate

The canonical stagent dev repo must skip the `instance-bootstrap` feature's auto-upgrade machinery — otherwise a pre-push hook would be installed on first `npm run dev` and block contributor pushes to `origin/main`.

Two independent gates prevent this, both already in place:

1. **`STAGENT_DEV_MODE=true` in `.env.local`** (primary, per-developer).
2. **`.git/stagent-dev-mode` sentinel file** (secondary, git-dir-scoped). Never cloned, never committed.

When either gate is active, `ensureInstance()` returns immediately with no side effects. Do NOT remove either.

**To test instance-bootstrap in the main repo:** set `STAGENT_INSTANCE_MODE=true` in your shell — overrides both dev-mode gates.

## Cross-Tool Sync (Codex ↔ Claude)

- Codex config: `~/.codex/config.toml` (model, trust levels, MCP servers)
- Codex global skills: `~/.codex/skills/` — 23 skills including OpenAI API media tools (imagegen, sora, speech, transcribe) and security analysis skills
- Shared skills live in both `.claude/skills/` and `~/.codex/skills/` — keep in sync when updating
- Codex SDK reference docs captured at `.claude/reference/developers-openai-com-codex-sdk/`
- Codex App Server runtime integrated via `src/lib/agents/runtime/codex-app-server-client.ts`
