# Changelog

## Renamed from stagent

This project was formerly published as `stagent` on npm and hosted at `github.com/manavsehgal/stagent`. As of 2026-04-17 it is `ainative`. The old GitHub URL redirects permanently; `stagent` on npm is deprecated with an upgrade pointer to `ainative`.

## [0.13.3] — 2026-04-18

### Fixed

- **Settings → Instance no longer shows a false "setup incomplete" warning on npx installs.** The bootstrap correctly skips when there's no `.git/` directory (per `ensureInstance()`'s decision tree), but the Settings UI was treating that skip as a failure. `GET /api/instance/config` now returns `skippedReason: "no_git"` in the npx case, and the `InstanceSection` component renders an accurate "npx install — upgrade via `npx ainative-business@latest`" notice instead of the amber warning and dead-end "Run setup" button.

## [0.13.2] — 2026-04-18

### Fixed

- **`npx ainative-business` isolated-data-dir Fix button now persists.** The CLI previously used Next.js-style env precedence (shell env wins over `.env.local`), so a stale `AINATIVE_DATA_DIR` shell export silently defeated the sidebar's Fix action on every restart. `bin/cli.ts` now treats the launch folder's `.env.local` as authoritative, matching a CLI launcher's semantics.

### Changed

- **First-run auto-writer.** The first `npx ainative-business` invocation in a non-dev folder now writes `.env.local` with `AINATIVE_DATA_DIR=~/.<folder>` automatically. New users see a green data-dir chip on first launch — no red badge, no manual Fix click, no restart cycle. Skipped in the main dev repo (`AINATIVE_DEV_MODE` / `.git/ainative-dev-mode` gates) and when the user has already chosen an explicit shell override.
- **Clearer post-Fix copy.** The sidebar's "restart to apply" hint now reads "Ctrl-C, then re-run npx ainative-business" so users know the exact action.

### Added

- Regression coverage: `src/lib/__tests__/cli-env-local.test.ts` — 6 subprocess tests for `.env.local` precedence, auto-writer happy path, and every skip condition.

## [0.12.1] — 2026-04-18

### Changed

- **npm package renamed** from `ainative` to `ainative-business`. Install with `npm i ainative-business` or run `npx ainative-business`. The CLI binary remains `ainative`.
- **Brand wordmark** added — new `AinativeWordmark` component used in dashboard welcome and sidebar header.
- **Icon set refreshed** — `public/icon-512.png`, `public/ainative-s-64.png`, `public/ainative-s-128.png` updated to the new visual identity.
- **Skill naming convention** documented in `book-updater`, `doc-generator`, and `user-guide-sync` SKILL.md files.

### Unchanged

- Runtime behavior, CLI subcommands, SQLite schema, agent contracts, workflow blueprint format.

## [0.12.0] — 2026-04-17

### Changed — BREAKING

- **Package renamed** from `stagent` to `ainative`. Install with `npm i ainative` or run `npx ainative`. The `stagent` npm package is deprecated.
- **GitHub repo renamed** to `manavsehgal/ainative`. Old URL redirects permanently.
- **Homepage** is now [ainative.business](https://ainative.business).
- **User data directory** auto-migrates from `~/.stagent/` to `~/.ainative/` on first boot. The database file inside is also renamed (`stagent.db` → `ainative.db`), and in-place SQL migrations rewrite `mcp__stagent__*` tool prefixes and `sourceFormat: "stagent"` enum values in `agent_profiles` rows. Pre-flight backup recommended: `cp -r ~/.stagent ~/.stagent.bak-pre-ainative`.
- **Environment variables renamed** to `AINATIVE_DATA_DIR`, `AINATIVE_DEV_MODE`, `AINATIVE_INSTANCE_MODE`, `AINATIVE_LAUNCH_CWD`. Clean break — update any shell aliases, `.env.local`, or CI configurations.
- **macOS Keychain service** renamed from `stagent` to `ainative`. The migration pass copies the existing entry best-effort; OpenAI Codex OAuth re-login may be required on failure.
- **MCP tool prefix** for Stagent's internal tool server changed from `mcp__stagent__*` to `mcp__ainative__*`. User-authored agent profiles referencing the old prefix are auto-migrated.
- **Agent profile `sourceFormat`** enum value `"stagent"` accepted as a read-side alias (normalized to `"ainative"` on parse) — externally-authored profile YAML files in other repos continue to import without modification.

### Unchanged

- Runtime behavior.
- CLI commands and subcommands (just the binary name changed: `stagent` → `ainative`).
- SQLite schema, migration numbering, and data layout.
- Agent runtime contracts, tool shapes, and workflow blueprint format.
