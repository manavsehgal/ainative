# ainative pivot — product code repo

**Date:** 2026-04-17
**Author:** Manav Sehgal (via brainstorming session)
**Companion:** `handoff/2026-04-17-ainative-pivot-ainative-repo.md` (inbound contract)
**Companion (website):** `docs/superpowers/specs/2026-04-17-ainative-pivot-design.md` in `../stagent.github.io/`
**Status:** Draft — pending implementation plan

---

## Goal

Rewrite every `stagent` reference in the product-code repo (`manavsehgal/stagent`, to be renamed `manavsehgal/ainative`) to `ainative`, publish `ainative@0.12.0` to npm, rename the GitHub repo, and migrate existing user data in place — all in one PR, landing on `main` atomically with the website-repo pivot.

**Non-goals:** changing runtime behavior, refactoring product code, anything in the website repo, DNS changes.

## Context

The website repo is pivoting from "Stagent" to "ainative". The handoff (see References) covers the contract between the two parallel sessions. This spec covers the implementation strategy inside the product-code repo.

Key settled decisions (inherited from handoff §Decisions already made):
- Software canonical name is lowercase `ainative` (npm/bun convention).
- Software runtime behavior does **not** change.
- Full rewrite, no dual-name period.
- Atomic execution in one PR/commit batch.
- Repo rename target: `manavsehgal/ainative`.
- npm package name: `ainative`.

Open decisions settled during brainstorming:
- **User data migration:** one-shot automatic on first boot (option A).
- **Env var rename:** clean break, no fallback (option A).
- **Internal protocol identifiers:** full clean rename + DB + keychain migration; retain external-YAML alias for `sourceFormat: "stagent"` (option A).
- **Historical markdown filenames:** rename all, including dated handoff/features/plans (option A).
- **Book prose:** mechanical pass + proofreading pass in two commits (option B).
- **Version bump:** `0.12.0` (continuing stagent's numbering).
- **npm deprecation:** yes, deprecate `stagent@*` after `ainative@0.12.0` publishes.
- **Execution location:** in this worktree (`claude/focused-tharp-abc3c7`), finish via `superpowers:finishing-a-development-branch`.

## Architecture: 7 Execution Phases

One PR on `main`. Internally structured as 7 sequential phases, each ending with a verification checkpoint. Ordering is chosen so each phase's output becomes input to the next phase's verification.

| # | Phase | Scope | Checkpoint |
|---|-------|-------|------------|
| 1 | Data migration infrastructure | New migration module, no renames yet | `npm test` green; migration unit tests pass |
| 2 | Identifier rewrite — code | TypeScript types, classes, functions, non-string identifiers | `npx tsc --noEmit` green |
| 3 | Identifier rewrite — strings | String literals, env vars, tool prefixes, keychain name | `npm run dev` boots + smoke task completes |
| 4 | Identifier rewrite — filenames | `git mv` pass for code + historical markdown | `rg --files \| grep -i stagent` returns zero |
| 5 | Docs + README + CHANGELOG | Reader-facing docs | `rg -i stagent docs/ README.md` = zero |
| 6 | Book + ai-native-notes | Prose rewrite — 2 commits (mechanical + proofread) | 15 files read-through complete |
| 7 | Package metadata + version | `package.json`, `.gitignore`, lockfile regen | `npm publish --dry-run` passes |

## Phase 1: Data Migration Infrastructure

New module: `src/lib/utils/migrate-to-ainative.ts`. Exports one idempotent function `migrateFromStagent(): Promise<MigrationReport>`.

Called from:
- `bin/cli.ts` — entry for `npx ainative`.
- `src/instrumentation-node.ts` — entry for `npm run dev`.

Runs **before** any `getStagentDataDir()` / `getAinativeDataDir()` call. During Phase 1, `getStagentDataDir()` remains exported alongside a new `getAinativeDataDir()` that returns `~/.ainative/` by default. Both work so the migration can run. In Phase 2, `getStagentDataDir()` is removed (and all call sites updated to the new name).

### Migration steps (all idempotent, all logged)

1. **Directory rename.** If `~/.stagent/` exists and `~/.ainative/` doesn't → `fs.promises.rename()`. Fallback to copy+delete on `EXDEV` (cross-device).
2. **DB file rename.** Inside the moved dir: rename `stagent.db`, `stagent.db-shm`, `stagent.db-wal` → `ainative.db*`.
3. **SQL data migration.** Open `ainative.db`:
   - `UPDATE agent_profiles SET allowed_tools = REPLACE(allowed_tools, 'mcp__stagent__', 'mcp__ainative__')`
   - `UPDATE agent_profiles SET import_meta = REPLACE(import_meta, '"sourceFormat":"stagent"', '"sourceFormat":"ainative"')` (JSON-in-TEXT column; regex-safe enough because quotes are literal).
   - Other tables: audit required — see TODO below.
4. **Sentinel file rename.** `.git/stagent-dev-mode` → `.git/ainative-dev-mode` (per-clone; the dev-mode gate's belt-and-suspenders file).
5. **Keychain rename.** On macOS, if service `"stagent"` has an entry for the current account and `"ainative"` doesn't → copy item, delete old. Linux (libsecret) / Windows (credential manager) handled analogously via existing keytar wrapper.

### Error handling
- Each step wrapped in try/catch. On error: log `console.error("[migrate] step X failed:", err)` and continue. Never throws — the app must still boot.
- Pre-flight backup is the user's responsibility (documented in README + CHANGELOG), not automated — cloning 688 MB on every boot would be absurd.

### Tests
- Unit tests: mock `fs` + `better-sqlite3` + keytar, verify each step is idempotent (runs twice = no-op on second).
- Integration test: temp dir `TMPDIR/.stagent/` with a minimal SQLite file, run `migrateFromStagent()`, assert `TMPDIR/.ainative/` exists with migrated schema.

### SQL column audit (performed as part of Phase 1)

Scan `src/lib/db/schema.ts` and seed data for any column storing literal `"stagent"` strings. Expected candidates:
- `agent_profiles.allowed_tools` ✓
- `agent_profiles.import_meta` (JSON) ✓
- `agent_logs.content`, `chat_messages.content` — may contain user text mentioning stagent. **Do not rewrite** (user-generated content; rewriting is revisionist).
- `documents.extracted_text` — likewise, do not rewrite.
- `learned_context.*` — do not rewrite.
- `settings.*` — check for any key/value literal `"stagent"`.

Rule of thumb: rewrite columns we control (schemas, enum values, tool prefixes). Leave columns that hold user-authored text alone.

## Phase 2: Identifier Rewrite — Code

Compiler-enforced. Safe to do mechanically.

### Scope
- **Type names:** `StagentConfig` → `AinativeConfig`, `StagentDbPath` → `AinativeDbPath`, etc.
- **Function names:** `getStagentDataDir` → `getAinativeDataDir`, `withStagentMcpServer` → `withAinativeMcpServer`, `withStagentAllowedTools` → `withAinativeAllowedTools`.
- **Variable/class names** containing `stagent` → `ainative`.
- **Module filename renames** (deferred to Phase 4 for git-mv hygiene, but tree-shaking is compiler-enforced here).

### Tool
- `rg --pcre2 '\bStagent\b|\bstagent\b' -t ts -t tsx` → generate worklist.
- Manual replace with LSP rename (preserves references) where possible; bulk replace via `sd` for clear cases.

### Checkpoint
- `npx tsc --noEmit` → zero errors.
- `npm test` → green.

## Phase 3: Identifier Rewrite — Strings

Runtime-visible. Smoke test required.

### Scope — string literals

| Literal | Location | Target |
|---------|----------|--------|
| `source: "stagent"` | webhook/channel adapters | `source: "ainative"` |
| `name: "stagent"` | `src/lib/chat/stagent-tools.ts` (MCP server name) | `name: "ainative"` |
| `serviceName: "stagent"` | Codex runtime, keychain | `serviceName: "ainative"` |
| `sourceFormat: "stagent"` | Zod enum in `src/lib/validators/profile.ts` | `"ainative"` + accept `"stagent"` alias |
| `"mcp__stagent__*"` | builtin profiles' `allowedTools` | `"mcp__ainative__*"` |
| `"stagent"` (author field) | `src/lib/validators/__tests__/profile.test.ts` | `"ainative"` |

### Scope — env vars

Clean break, no fallback.

| Old | New |
|-----|-----|
| `STAGENT_DATA_DIR` | `AINATIVE_DATA_DIR` |
| `STAGENT_DEV_MODE` | `AINATIVE_DEV_MODE` |
| `STAGENT_INSTANCE_MODE` | `AINATIVE_INSTANCE_MODE` |

- `.env.local` rewritten as part of PR (user's file — update in this session).
- All `process.env.STAGENT_*` references updated.

### Scope — splash, banner, help text, log lines
- CLI banner in `bin/cli.ts`.
- Log prefixes containing "Stagent" → "ainative".
- Prompt strings in any interactive CLI flow.

### Scope — `sourceFormat` alias

`src/lib/validators/profile.ts`:

```ts
sourceFormat: z.enum(["ainative", "stagent", "skillmd-only", "unknown"])
  .transform(x => x === "stagent" ? "ainative" : x)
```

Rationale: externally-authored profile YAML in other repos may still have `sourceFormat: "stagent"`. Accepting as alias (normalized on read) avoids silent import failures. Zero maintenance cost — no deprecation timeline needed, it's a one-line alias.

### Checkpoint — Smoke tests (non-negotiable per CLAUDE.md runtime-registry rule)
1. `npm run dev` → boots cleanly, no `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`.
2. Open `localhost:3000`, start a chat, run a task that invokes a stagent tool → verify `mcp__ainative__*` tool dispatches correctly.
3. `npm pack && npx ./ainative-0.12.0.tgz` → verify help text, splash, no `Stagent` in output.

## Phase 4: Identifier Rewrite — Filenames

All `stagent`-bearing filenames rename via `git mv`. Per handoff verification step 1 and brainstorming decision (option A): everything, including dated historical markdown.

### Categories

**Code filenames:**
- `src/lib/utils/stagent-paths.ts` → `src/lib/utils/ainative-paths.ts`
- `src/lib/chat/stagent-tools.ts` → `src/lib/chat/ainative-tools.ts`
- (And any other `stagent-*.ts` / `stagent-*.tsx` files found during scan.)

**Asset filenames:**
- `public/ainative-s-64.png` → `public/ainative-s-64.png`
- `public/ainative-s-128.png` → `public/ainative-s-128.png`
- Any SVGs referencing the name (`public/readme/architecture-light.svg`, etc.) — rename if filename contains `stagent`, update contents regardless.
- Update `package.json` `files[]` entries to match.

**Historical markdown:**
- `handoff/bug-task-execution-missing-ainative-mcp.md`
- `features/task-runtime-ainative-mcp-injection.md`
- `handoff/ainative-app-marketplace-spec.md`
- `docs/superpowers/plans/2026-04-11-task-runtime-ainative-mcp-injection.md`
- `.claude/skills/architect/references/tdr-032-runtime-ainative-mcp-injection.md`
- All other `*stagent*.md` under tracked folders.

### Discipline
- `git mv` in commits separate from content-rewrite commits, so `git log --follow` traces work cleanly.
- macOS case-insensitive filesystem: check `git status` between batches for phantom casing conflicts.
- Update any `import ... from "./stagent-paths"` statements (handled in Phase 2 since those are code-level).

### Checkpoint
- `git ls-files | grep -i stagent` returns zero.
- `npm test` still green (imports updated).

## Phase 5: Docs + README + CHANGELOG

Per handoff §5. Full rewrite of:
- `README.md` — reframed per handoff §4 as book companion; primary positioning: *"Companion software for the AI Native Business book by Manav Sehgal."* Link `https://ainative.business`.
- `CONTRIBUTING.md` (if present) — brand update.
- `CHANGELOG.md` — new entry for `0.12.0`:
  - `## [0.12.0] — 2026-04-17 — Renamed from stagent`
  - Notes: package rename, repo rename, data migration behavior.
- `docs/` — full sweep for `stagent` → `ainative`.
- `AGENTS.md` + `CLAUDE.md` + `FLOW.md` — update env var names, path references, any inline examples.
- `.claude/skills/**/*.md` — sweep. Note: some skills (`upgrade-assistant`, `ainative-app` scaffolder) have `stagent` in the skill name itself. Rename skill directories via `git mv` too.
- `MEMORY.md` — sweep.

### Skill directory renames (nuance)

The `.claude/skills/ainative-app/` skill directory contains the scaffolder. Renaming to `.claude/skills/ainative-app/` is consistent. Skill frontmatter `name:` field also renames. No user data at stake since skills aren't DB-backed.

### Checkpoint
- `rg -i stagent docs/ README.md CHANGELOG.md AGENTS.md CLAUDE.md FLOW.md MEMORY.md .claude/skills/` → zero matches.

## Phase 6: Book + ai-native-notes

14 chapters under `book/chapters/ch-*.md` + `ai-native-notes/ai-native-book-strategy.md`. Two commits.

### Commit 6a: Mechanical rewrite
- `find book ai-native-notes -name '*.md' -exec sd 'Stagent' 'ainative' {} \;`
- `find book ai-native-notes -name '*.md' -exec sd '\bstagent\b' 'ainative' {} \;`
- No other changes.

### Commit 6b: Proofreading pass
- Read all 15 files end-to-end.
- Fix sentence-start cases where lowercase `ainative` reads awkwardly. Per handoff rule: capitalize only where grammar absolutely demands it (proper-noun usage at sentence start where context forces nominal reading).
- Fix any awkward phrasings introduced by the mechanical pass (e.g., "Stagent provides" → "ainative provides" reads fine; "With Stagent, you can..." → "With ainative, you can..." also fine; "Stagent's" → "ainative's" — possessive apostrophe preserves readability).
- **Do not add or remove substantive content.** Style/grammar fixes only.

### Checkpoint
- `rg -i stagent book/ ai-native-notes/` → zero matches.

## Phase 7: Package Metadata + Version Bump

Single final commit before publish.

### `package.json` changes

| Field | From | To |
|-------|------|-----|
| `name` | `"stagent"` | `"ainative"` |
| `version` | `"0.11.2"` | `"0.12.0"` |
| `description` | AI Business Operating System... | *"Companion software for the AI Native Business book — a local-first agent runtime and builder scaffold for AI-native businesses."* |
| `homepage` | `"https://stagent.io"` | `"https://ainative.business"` |
| `repository.url` | `"https://github.com/manavsehgal/stagent.git"` | `"https://github.com/manavsehgal/ainative.git"` |
| `bugs.url` | `"https://github.com/manavsehgal/stagent/issues"` | `"https://github.com/manavsehgal/ainative/issues"` |
| `keywords` | existing list | keep + add `ai-native-business`, `book-companion` |
| `bin` | `{"stagent": "./dist/cli.js"}` | `{"ainative": "./dist/cli.js"}` |
| `files` | includes `public/ainative-s-*.png` | update to `public/ainative-s-*.png` |

### Other files in this commit
- `.gitignore`: `stagent-*.tgz` → `ainative-*.tgz`
- `package-lock.json`: regenerate via `npm install` (fresh lockfile, clean of `stagent` name).
- `scripts/sync-worktree.sh` / `bin/sync-worktree.sh`: sweep for `stagent` references.

### Checkpoint
- `npm publish --dry-run` → metadata shows ainative branding throughout.
- `rg -i stagent .` (global) → zero matches outside `.git/`, `node_modules/`, `package-lock.json` (which has no ainative-vs-stagent nuance after regen), and the single CHANGELOG provenance heading.

## Verification (Before Commit / Publish)

Full checklist run after all 7 phases complete. Order matters — later steps depend on earlier ones.

1. **Static:** `rg -i stagent .` → zero matches outside allowed exceptions (`.git/`, `node_modules/`, CHANGELOG provenance heading).
2. **Static:** `git ls-files | grep -i stagent` → zero matches.
3. **Build:** `npm run build:cli` → green.
4. **Types:** `npx tsc --noEmit` → zero errors.
5. **Unit + integration tests:** `npm test` → green (including new migration tests).
6. **Coverage:** `npm run test:coverage` → no regression on critical tiers.
7. **Smoke — runtime registry (CLAUDE.md mandate):** `npm run dev` → boot clean, open `localhost:3000`, run a task that dispatches `mcp__ainative__*` tools. Verify output.
8. **Smoke — CLI:** `npm pack && npx ./ainative-0.12.0.tgz` → verify help text, splash, no `Stagent` in output.
9. **Smoke — migration:** Restore `~/.stagent.bak` as `~/.stagent`, delete `~/.ainative`, run `npm run dev`, verify data migrates cleanly and app shows all pre-rename data.
10. **Publish dry-run:** `npm publish --dry-run` → metadata sanity.

## Release Sequence (coordinated with website session)

Per handoff §Cross-repo coordination, within a single hour:

1. Land product-repo PR on `main`, tag `v0.12.0`.
2. Land website-repo PR on `main`.
3. Rename `manavsehgal/stagent.github.io` → `manavsehgal/ainative-business.github.io` (website).
4. Rename `manavsehgal/stagent` → `manavsehgal/ainative` (product code).
5. Update local clone: `git remote set-url origin git@github.com:manavsehgal/ainative.git`.
6. `npm publish` for `ainative@0.12.0`.
7. `npm deprecate "stagent@*" "Renamed to ainative. Install with: npm i ainative"`.
8. Update CNAME + DNS (website session owns this).
9. Create `stagent-io-redirect` shell (website session owns this).

## Rollback Plan

**Pre-flight:** `cp -r ~/.stagent ~/.stagent.bak-pre-rename-2026-04-17` before the first `npm run dev` on the renamed code.

| Failure point | Rollback |
|---------------|----------|
| Commits fail pre-publish | `git reset --hard origin/main`, worktree state preserved |
| `npm publish ainative@0.12.0` fails | Fix and retry; no downstream effect |
| `npm publish` succeeds, GitHub rename fails | Leave publish, retry GitHub rename. If blocked, `npm unpublish` within 72hr |
| GitHub rename succeeds, website doesn't deploy | Website session's rollback path |
| Post-publish regression discovered | `npm deprecate ainative@0.12.0 "Rolled back"` within 72hr, fix forward in 0.12.1 |
| User data migration fails on your machine | Restore `~/.stagent.bak-pre-rename-2026-04-17` manually |

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Circular-import regression from touching runtime-registry-adjacent code | Smoke test 7 (mandatory per CLAUDE.md) |
| Keychain migration loses Codex OAuth token | Existing token is backed up before migration; user can re-auth in 30s if needed |
| 688 MB user data corrupts during `fs.rename` | Pre-flight backup + EXDEV fallback to copy+delete |
| `sed` pass in Phase 6 produces awkward prose | Dedicated proofreading commit (Phase 6b) |
| External profile YAML imports break on `sourceFormat` | Zod alias (accept `"stagent"` → normalize to `"ainative"`) |
| npm `ainative@0.12.0` accidentally published pre-rename | Checkpoint: `npm publish --dry-run` required before real publish |
| Case-insensitive filesystem collisions on `git mv` | `git status` check between batches; unlikely for our rename set |
| Phase 6 proofreading blows up PR scope | Cap at style/grammar only — no content edits; defer any content drift to a follow-up |

## Out of Scope (hard no)

- Anything in `../stagent.github.io/`.
- DNS changes.
- The `stagent-io-redirect` repo.
- Feature-set changes / refactors.
- User-authored content columns in SQLite (`agent_logs.content`, `chat_messages.content`, etc.).

## References

- Inbound handoff: `handoff/2026-04-17-ainative-pivot-ainative-repo.md`
- Website spec: `../stagent.github.io/docs/superpowers/specs/2026-04-17-ainative-pivot-design.md`
- Website plan: `../stagent.github.io/docs/superpowers/plans/2026-04-17-ainative-pivot.md`
- CLAUDE.md runtime-registry smoke-test mandate (in this repo).
- MEMORY.md — runtime registry circular-import precedent (TDR-032).
