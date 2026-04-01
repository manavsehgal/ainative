---
title: Auto Environment Scan
status: completed
priority: P1
milestone: post-mvp
source: dogfooding discovery (manual scan friction, 2026-03-31)
dependencies: [environment-scanner, environment-cache]
---

# Auto Environment Scan

## Description

The environment scanner currently requires manual activation — users must click "Scan" on a project page or the environment dashboard. This creates friction: new projects appear "empty" until the user remembers to scan, and chat conversations lack workspace context because no scan has run.

This feature makes environment scanning automatic. When a project with a `workingDirectory` is accessed — via its project page, a chat conversation, or task execution — Stagent checks whether the last scan is stale (>5 minutes old or missing) and triggers a fresh scan inline. The scan takes 10-50ms, so it runs synchronously without perceptible delay.

The manual "Scan" button remains as a force-refresh option, but the default experience is zero-config: open a project, see its environment.

## User Story

As a Stagent user, I want my project's environment to be scanned automatically when I open it or start a chat, so I never have to remember to click "Scan" and always see up-to-date workspace context.

## Technical Approach

### Auto-Scan Module

Create `src/lib/environment/auto-scan.ts`:

- **`shouldRescan(projectId?: string): boolean`** — queries `getLatestScan(projectId)` from the environment data layer. Returns `true` if no scan exists or if `scannedAt` is older than 5 minutes.
- **`ensureFreshScan(projectDir: string, projectId?: string): ScanResult | null`** — calls `shouldRescan()`, and if stale, runs `scanEnvironment({ projectDir })` and persists via `createScan()`. Returns the scan result or `null` if already fresh.

Both functions are synchronous (the scanner and DB layer are synchronous). The 5-minute staleness threshold is a module constant, not a user setting.

### Integration Points

1. **Chat conversation creation** (`src/app/api/chat/stream/route.ts` or conversation init path): When a conversation is created/resumed with a `projectId`, look up the project's `workingDirectory` and call `ensureFreshScan()`. This ensures chat context includes fresh environment data.

2. **Project page load** (`src/components/environment/environment-summary-card.tsx`): On mount, if the project has a `workingDirectory`, call `ensureFreshScan()` via the existing `POST /api/environment/scan` endpoint instead of waiting for the user to click "Scan". The "Scan" button becomes a manual refresh.

3. **Task execution** (`src/app/api/tasks/[id]/execute/route.ts`): Before executing a task with a `projectId`, call `ensureFreshScan()` so the agent has fresh workspace context. This is a lightweight addition to the existing execution flow.

### Reuse

- `scanEnvironment()` from `src/lib/environment/scanner.ts` — unchanged
- `getLatestScan()`, `createScan()` from `src/lib/environment/data.ts` — unchanged
- `getLaunchCwd()` from `src/lib/environment/workspace-context.ts` — fallback when no projectDir

## Acceptance Criteria

- [ ] Auto-scan triggers on project page load when last scan is >5 minutes old or missing
- [ ] Auto-scan triggers on chat conversation creation/resume for projects with `workingDirectory`
- [ ] Auto-scan triggers before task execution for projects with `workingDirectory`
- [ ] Scan does NOT trigger if last scan is <5 minutes old (staleness check works)
- [ ] Manual "Scan" button still works as force-refresh
- [ ] Auto-scan completes in <100ms (no perceptible delay)
- [ ] Projects without `workingDirectory` are unaffected (no scan attempted)
- [ ] Scan errors are logged but do not block the primary operation (chat, page load, task exec)

## Scope Boundaries

**Included:**
- Staleness-based auto-trigger for environment scans
- Integration with chat, project page, and task execution paths
- Module-level staleness threshold (5 minutes)

**Excluded:**
- File watcher / real-time monitoring (manual refresh covers this)
- User-configurable staleness threshold (over-engineering for now)
- WebSocket push notifications when environment changes
- Scanning directories the user hasn't explicitly set as `workingDirectory`

## References

- Source: dogfooding — manual scan friction during chat sessions
- Existing code: `src/lib/environment/scanner.ts` — `scanEnvironment()`, 10-50ms per scan
- Existing code: `src/lib/environment/data.ts` — `getLatestScan()`, `createScan()`
- Related features: [environment-scanner](environment-scanner.md), [environment-cache](environment-cache.md), [project-scoped-profiles](project-scoped-profiles.md)
