---
title: Environment Scanner
status: completed
priority: P0
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: []
---

# Environment Scanner

## Description

Server-side scanner that reads all Claude Code and Codex CLI artifacts from the filesystem and returns structured data. This is the foundation layer for the entire environment onboarding feature set — every other environment feature depends on the scanner's ability to discover, parse, and classify artifacts.

The scanner handles three user personas: Claude Code only (`.claude/`, `CLAUDE.md`, `~/.claude/`), Codex only (`~/.codex/`, `AGENTS.md`, `config.toml`), and dual-tool setups where both tools coexist in the same project. It auto-detects which tools are present and adapts accordingly.

All scanning is **read-only** — the scanner never modifies any CLI artifacts. It reads from both project-level directories (the project's `workingDirectory`) and user-level directories (`~/.claude/`, `~/.codex/`).

## User Story

As a Stagent user with an existing Claude Code and/or Codex setup, I want Stagent to automatically discover all my CLI configurations — skills, plugins, hooks, MCP servers, permissions, instructions, memory, and rules — so I can see everything in one place without manually entering any configuration.

## Technical Approach

### Scanner Architecture

Create `src/lib/environment/` directory following the document processor registry pattern from `src/lib/documents/processor.ts`:

- **`types.ts`** — Core types: `ToolId` ("claude-code" | "codex" | "shared"), `Persona` ("claude-only" | "codex-only" | "both"), `ArtifactCategory` (10 categories: skill, plugin, hook, mcp-server, permission, instruction, memory, rule, reference, output-style), `ArtifactScope` ("project" | "user" | "global"), `EnvironmentArtifact`, `ScanResult`
- **`scanner.ts`** — Orchestrator that takes a project path, detects persona by checking for `.claude/` and `~/.codex/` existence, dispatches to tool-specific scanners, and merges results
- **`scanners/claude-code.ts`** — Reads project `.claude/` (settings.local.json, skills/\*/SKILL.md, reference/\*, rules/\*.md, worktrees/), project root (CLAUDE.md, CLAUDE.local.md, AGENTS.md, MEMORY.md), and user-level `~/.claude/` (settings.json, skills, .mcp.json, rules, plugins/installed_plugins.json, output-styles, per-project memory)
- **`scanners/codex.ts`** — Reads `~/.codex/` (config.toml, .codex-global-state.json, skills/, vendor_imports/skills/, rules/) and project root (AGENTS.md)
- **`scanners/shared.ts`** — Identifies artifacts that exist in both tools (AGENTS.md, MEMORY.md, overlapping skills by name matching)

### Parser Layer

Category-specific parsers that extract structured metadata from raw files:

- **`parsers/skill.ts`** — Parses SKILL.md YAML frontmatter (name, description, allowed-tools) + content. Also handles Codex-format plain skill files
- **`parsers/mcp-config.ts`** — Parses `.mcp.json` (JSON) and `config.toml` [mcp_servers] section (TOML) into unified MCP server descriptors
- **`parsers/settings.ts`** — Parses Claude Code `settings.json` to extract hooks, enabledPlugins, statusLine config, and `settings.local.json` for permission allow rules
- **`parsers/toml.ts`** — Lightweight TOML parser for Codex config.toml (model, personality, MCP servers, project trust levels). Use a small library or hand-roll for the subset of TOML used by Codex
- **`parsers/instructions.ts`** — Reads CLAUDE.md, AGENTS.md, CLAUDE.local.md, rules/\*.md — extracts frontmatter if present, content preview, line count
- **`parsers/memory.ts`** — Parses MEMORY.md structure (sections, links to memory files)

### Artifact Model

Each discovered artifact has: tool (who owns it), category (what kind), scope (project vs user), name, file paths (relative + absolute), SHA-256 content hash (for change detection), 500-char content preview, category-specific parsed metadata, file size, and modification time.

### Persona Detection

Auto-detect by checking filesystem presence:
- `.claude/` exists in project OR `~/.claude/` exists → Claude Code present
- `~/.codex/` exists → Codex present
- Both → persona "both"
- Neither → scan returns empty result with warning

### Performance

Typical scan should complete in 10-50ms for a project with 20 skills, 3 MCP servers, and standard configs. Content hashing uses SHA-256 on first 10KB of each file to cap scan time. Large reference directories (vendor_imports, reference/) are scanned shallowly — enumerate files but don't read content until requested.

## Acceptance Criteria

- [ ] Scanner detects Claude Code artifacts in project `.claude/` directory
- [ ] Scanner detects Codex artifacts in `~/.codex/` directory
- [ ] Scanner detects shared artifacts (AGENTS.md, MEMORY.md, overlapping skills)
- [ ] Persona auto-detection correctly identifies claude-only, codex-only, and both
- [ ] Each artifact has tool, category, scope, name, paths, contentHash, preview, metadata
- [ ] Skill parser extracts SKILL.md frontmatter (name, description) and content preview
- [ ] MCP parser handles both `.mcp.json` (JSON) and `config.toml` (TOML) formats
- [ ] Settings parser extracts hooks, plugins, and permissions from settings.json/settings.local.json
- [ ] Scanner completes in under 100ms for a typical project
- [ ] Scanner handles missing directories gracefully (warns, doesn't fail)
- [ ] Scanner skips binary files and caps preview at 500 chars
- [ ] All parsers have unit tests

## Scope Boundaries

**Included:**
- Reading all Claude Code and Codex configuration artifacts
- Parsing structured metadata from each artifact type
- Auto-detecting which tools are present
- Content hashing for change detection
- Shallow scanning of large directories (reference, vendor_imports)

**Excluded:**
- Persisting scan results to database (see environment-cache)
- Any write operations to filesystem
- Reading credentials (auth.json, API keys, OAuth tokens)
- Reading debug logs, paste cache, or session history
- Real-time file watching (manual scan trigger only)

## References

- Source: environment onboarding plan — Feature 1
- Pattern: `src/lib/documents/processor.ts` — registry-based processor architecture
- Pattern: `src/lib/settings/runtime-setup.ts` — existing persona detection
- Related features: environment-cache (persists results), environment-dashboard (displays results)
