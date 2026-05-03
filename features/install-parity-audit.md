---
id: install-parity-audit
name: Install Parity Audit
status: completed
shipped-date: 2026-04-21
milestone: M5
dependencies:
  - nl-to-composition-v1 (M4.5, shipped 2026-04-21)
  - chat-tools-plugin-kind-1 (M3, shipped 2026-04-20)
handoff: .archive/handoff/2026-04-21-m5-shipped-handoff.md
---

# Install Parity Audit (Milestone 5)

Final release gate before the single batched npm publish of the Self-Extending Machine milestones (M1 + M2 + M3 + M4 + M4.5). Verifies that a fresh `npx ainative@X.Y.Z` install exercises the same code paths as the dev repo, with no repo-local assumptions silently degrading features.

## Goals

- Fresh clone → `npm install` → `npm run build:cli` → `node dist/cli.js` from a scratch directory must boot cleanly.
- Every runtime-read directory and file must ship in the published tarball.
- Dev-mode gates (`AINATIVE_DEV_MODE`, `.git/ainative-dev-mode` sentinel) must correctly differentiate repo vs. npx.
- Path resolution for app-internal assets must not rely on `process.cwd()`.
- M4.5 surface (planner + scaffold API route) must work in npx mode without additional configuration.

## Non-goals (M5 explicitly does not)

- Rewrite the bootstrap or hoisting machinery.
- Add new user-facing features.
- Change the CLI argument surface.
- Publish to npm — M5 is the gate; publishing is a separate step after M5 passes.

## Audit matrix (2026-04-21)

| Check | Result | Notes |
|---|---|---|
| CLI boots from scratch dir (`/tmp/m5-smoke`) | ✅ pass | `--help` renders, data-dir resolves to `AINATIVE_DATA_DIR` or `~/.<folder>`, no crashes. |
| Auto `.env.local` writes on first run in non-dev folder | ✅ pass | `/tmp/m5-smoke2/.env.local` correctly created with `AINATIVE_DATA_DIR=~/.m5-smoke2`. |
| Auto `.env.local` skipped when env var pre-set | ✅ pass | `AINATIVE_DATA_DIR` in env short-circuits the write. |
| Auto `.env.local` skipped in dev mode | ✅ pass | `isDevMode()` returns true for the main repo via sentinel + env. |
| Plugin subcommand accessible | ✅ pass | `node dist/cli.js plugin` (no action) returns usage error with exit 1. |
| `process.cwd()` safety test | ✅ pass | 4/4 green in `npx-process-cwd.test.ts`. M4.5 surface clean. |
| CLI env.local test | ✅ pass | 6/6 green in `cli-env-local.test.ts`. |
| M4.5 planner in package tarball | ✅ pass | `src/lib/chat/planner/*` included under `src/`. |
| M4.5 scaffold API route in package tarball | ✅ pass | `src/app/api/plugins/scaffold/*` included under `src/`. |
| `book/chapters/` in tarball | 🛑 FAIL → ✅ fixed | Runtime-read by `src/lib/book/content.ts:204` but missing from `files`. Fixed: added `book/chapters/`. |
| `ai-native-notes/*.md` in tarball | 🛑 FAIL → ✅ fixed | Runtime-read by `src/lib/book/chapter-generator.ts:58,66` but missing from `files`. Fixed: added `ai-native-notes/*.md` (scoped to .md to exclude 4.7MB of internal PNGs). |
| Regression test against future `files` drift | ✅ added | `src/lib/__tests__/npm-pack-files.test.ts` (5 tests). |
| Full chat + components + api + lib test sweep | ✅ pass | 338/338 green. |
| Typecheck | ✅ clean | `npx tsc --noEmit` reports no errors on M5 surface. |
| Tarball size sanity | ✅ reasonable | 4.5MB packed / 7.4MB unpacked. Up from 1.8MB/7MB pre-fix — the unpacked delta is small because the main bulk was always `src/`. |

## Fix summary

**One finding, one fix, one regression test.** The M4.5 surface was audit-clean.

- `package.json` `files`: added `"book/chapters/"` + `"ai-native-notes/*.md"`.
- `src/lib/__tests__/npm-pack-files.test.ts`: asserts `files` array includes those entries, AND the working tree actually has the referenced directories with at least one `.md` in each.

## What's next (post-M5)

1. Bump `package.json` version per semver for cumulative M1 + M2 + M3 + M4 + M4.5 + M5 delta (currently 0.13.3; likely 0.14.0 for the batched self-extending-machine release).
2. `npm publish --access public` as `manavsehgal` maintainer.
3. Announce release; link to the handoffs (2026-04-20 Phase 6, 2026-04-21 M4.5, 2026-04-21 M5).

See the ship handoff for full context.
