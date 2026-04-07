# Claude Code Compatibility

This repository now uses a shared cross-tool setup:

- Read `AGENTS.md` for stable project instructions.
- Read `MEMORY.md` for evolving project context, decisions, and recurring gotchas.

Keep this file as a thin Claude-compatible pointer rather than a second source of truth.

## Quick Start

```bash
npm run dev
npm run build:cli
npm test
npm run test:coverage
```

## Claude-Specific Notes

- Claude-local settings may live in `.claude/settings.local.json`.
- Claude memory may also exist under `~/.claude/projects/.../memory/`, but the repo-level shared files should be treated as canonical first.

## Instance Bootstrap Dev-Mode Gate

This dev repo sets `STAGENT_DEV_MODE=true` in `.env.local` and has a `.git/stagent-dev-mode` sentinel file, both of which make the planned `instance-bootstrap` feature a no-op here. Do **not** remove either — they prevent the auto-upgrade machinery from installing a pre-push hook that would block contributor pushes. Full rationale and testing override (`STAGENT_INSTANCE_MODE=true`) documented in `AGENTS.md` → "Instance Bootstrap Dev-Mode Gate".

## Cross-Tool Sync (Codex ↔ Claude)

- Codex config: `~/.codex/config.toml` (model, trust levels, MCP servers)
- Codex global skills: `~/.codex/skills/` — 23 skills including OpenAI API media tools (imagegen, sora, speech, transcribe) and security analysis skills
- Shared skills live in both `.claude/skills/` and `~/.codex/skills/` — keep in sync when updating
- Codex SDK reference docs captured at `.claude/reference/developers-openai-com-codex-sdk/`
- Codex App Server runtime integrated via `src/lib/agents/runtime/codex-app-server-client.ts`
