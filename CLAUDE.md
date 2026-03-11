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
