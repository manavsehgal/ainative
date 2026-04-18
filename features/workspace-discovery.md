---
title: Workspace Discovery
status: completed
priority: P1
milestone: post-mvp
source: retrospective — code exists without spec (2026-03-31)
dependencies: [environment-scanner, environment-cache]
---

# Workspace Discovery

## Description

A project discovery engine that walks a parent directory to find child folders containing `.claude/` or `.codex/` configuration markers. This powers the "Import from workspace" flow where users can onboard multiple projects into ainative at once by pointing to their development directory (e.g., `~/Developer/`).

The discovery engine is lightweight by design — it uses stat checks only, never reads file content. It reports artifact hints (skill count, MCP server count, instruction presence) so the UI can show richness indicators before the user commits to a full environment scan.

Paired with the import pipeline (`src/lib/import/`), discovered projects can be batch-imported with deduplication, format adaptation, and GitHub API integration for remote repo metadata.

## User Story

As a developer with multiple Claude/Codex-configured projects, I want to discover all my projects automatically so that I can onboard them into ainative without manually adding each one.

## Technical Approach

- **Discovery engine** (`src/lib/environment/discovery.ts`):
  - Walks parent directory up to configurable `maxDepth`
  - Detects `.claude/` and `.codex/` markers via stat checks
  - Collects artifact hints (skills, MCP servers, CLAUDE.md/AGENTS.md presence)
  - Reports git branch, last modified time, and whether project is already imported
  - Skip list for `node_modules`, `.git`, hidden dirs, and common non-project directories
- **Import pipeline** (`src/lib/import/`):
  - `repo-scanner.ts` — Scans GitHub repos for profile/skill content
  - `format-adapter.ts` — Normalizes different profile formats
  - `dedup.ts` — Prevents duplicate imports
  - `github-api.ts` — Typed GitHub API client with error handling (private repos, rate limits, 404s)
- **API routes**:
  - `GET /api/workspace/discover` — Triggers discovery scan
  - `POST /api/workspace/import` — Batch-imports selected projects

### Key Files

- `src/lib/environment/discovery.ts` — Core discovery engine
- `src/lib/import/repo-scanner.ts` — GitHub repo scanning
- `src/lib/import/format-adapter.ts` — Profile format normalization
- `src/lib/import/dedup.ts` — Deduplication logic
- `src/lib/import/github-api.ts` — Typed GitHub API client

## Acceptance Criteria

- [x] Discovery walks parent directory and finds all `.claude/` and `.codex/` marker directories
- [x] Artifact hints reported without reading file content (stat-only for performance)
- [x] Skip list excludes `node_modules`, `.git`, and other non-project directories
- [x] Already-imported projects flagged to prevent duplicate imports
- [x] Git branch detection for each discovered project
- [x] GitHub API integration with typed errors for private repos and rate limits
- [x] Format adapter normalizes different profile/skill formats
- [x] Deduplication prevents duplicate profile imports

## Scope Boundaries

**Included:**
- Parent directory walking with marker detection
- Artifact hint collection (stat-based)
- GitHub repo scanning and API integration
- Format adaptation and deduplication
- API routes for discovery and import

**Excluded:**
- Full environment scanning of discovered projects (covered by `environment-scanner`)
- Profile generation from discovered artifacts (covered by `agent-profile-from-environment`)
- UI for the discovery/import flow (covered by `environment-dashboard`)

## References

- Related features: `environment-scanner` (deep scan after discovery), `skills-repo-import` (GitHub profile import), `environment-dashboard` (UI for discovery)
- Source: Retrospective spec — code implemented during environment onboarding initiative
