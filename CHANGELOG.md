# Changelog

## Renamed from stagent

This project was formerly published as `stagent` on npm and hosted at `github.com/manavsehgal/stagent`. As of 2026-04-17 it is `ainative`. The old GitHub URL redirects permanently; `stagent` on npm is deprecated with an upgrade pointer to `ainative`.

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
