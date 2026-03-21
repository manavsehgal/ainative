---
title: Environment Cache
status: planned
priority: P0
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-scanner]
---

# Environment Cache

## Description

Persistence layer that stores environment scan results in Stagent's SQLite database. Adds 4 new tables (`environment_scans`, `environment_artifacts`, `environment_checkpoints`, `environment_sync_ops`) to cache scanner output for instant dashboard queries, track checkpoint history for rollback safety, and log sync operations.

The cache follows the "scanner + cache" pattern — the filesystem is the source of truth, the database is a read-optimized mirror. Stale data is mitigated by "last scanned" timestamps and manual refresh triggers.

## User Story

As a Stagent user, I want my environment scan results to be instantly queryable — filtered, sorted, and searched — without re-scanning the filesystem every time I load the dashboard.

## Technical Approach

### New DB Tables

Add 4 tables following existing Drizzle schema patterns in `src/lib/db/schema.ts`:

**`environment_scans`** — One row per scan execution:
- id (TEXT PK, nanoid), project_id (TEXT FK→projects, nullable), scan_path (TEXT), persona (TEXT: "claude-only"/"codex-only"/"both"), scan_status (TEXT: "running"/"completed"/"failed"), artifact_count (INTEGER), scan_duration_ms (INTEGER), scanned_at (INTEGER timestamp), created_at (INTEGER timestamp)
- Indexes: (project_id), (scanned_at)

**`environment_artifacts`** — One row per discovered artifact:
- id (TEXT PK, nanoid), scan_id (TEXT FK→environment_scans), tool (TEXT), category (TEXT), scope (TEXT), name (TEXT), rel_path (TEXT), abs_path (TEXT), content_hash (TEXT), content_preview (TEXT), metadata (TEXT JSON), size_bytes (INTEGER), modified_at (INTEGER timestamp), created_at (INTEGER timestamp)
- Indexes: (scan_id, tool), (scan_id, category), (scan_id, tool, category)

**`environment_checkpoints`** — Snapshots before write-back operations:
- id (TEXT PK, nanoid), project_id (TEXT FK→projects), label (TEXT), git_tag (TEXT nullable), git_commit_sha (TEXT nullable), backup_path (TEXT nullable — for non-git dirs), checkpoint_type (TEXT: "pre-sync"/"manual"/"pre-onboard"), files_count (INTEGER), status (TEXT: "active"/"rolled_back"/"superseded"), created_at (INTEGER timestamp)
- Index: (project_id, status)

**`environment_sync_ops`** — Write-back operation log:
- id (TEXT PK, nanoid), checkpoint_id (TEXT FK→environment_checkpoints), artifact_id (TEXT FK→environment_artifacts, nullable), operation (TEXT: "create"/"update"/"delete"/"sync"), target_tool (TEXT), target_path (TEXT), diff_preview (TEXT), status (TEXT: "pending"/"applied"/"failed"/"rolled_back"), error (TEXT nullable), applied_at (INTEGER timestamp nullable)
- Index: (checkpoint_id)

### Data Access Layer

Create `src/lib/environment/data.ts` with functions:
- `insertScan(scan)` / `getLatestScan(projectId)` / `getScanById(id)`
- `insertArtifacts(scanId, artifacts[])` / `getArtifacts(scanId, filters)` / `getArtifactById(id)`
- `insertCheckpoint(checkpoint)` / `getCheckpoints(projectId)` / `updateCheckpointStatus(id, status)`
- `insertSyncOp(op)` / `getSyncOps(checkpointId)` / `updateSyncOpStatus(id, status)`
- `getArtifactCounts(scanId)` — grouped by category for dashboard summary cards

### API Routes

- **`POST /api/environment/scan`** — Accepts `{ path: string, projectId?: string }`. Triggers scan, persists results, returns `{ scanId, status }`. Uses fire-and-forget pattern (returns 202) for large scans.
- **`GET /api/environment/scan?projectId=xxx`** — Returns latest scan result with artifact counts and persona.
- **`GET /api/environment/artifacts?scanId=xxx&tool=&category=&scope=`** — Filtered artifact list with pagination.
- **`GET /api/environment/artifacts/[id]`** — Full artifact detail including reading current file content from disk (not cached content).

### Bootstrap & Migration

- Add `CREATE TABLE IF NOT EXISTS` for all 4 tables in `src/lib/db/index.ts` (self-healing bootstrap)
- Create migration `src/lib/db/migrations/NNNN_add_environment_tables.sql`
- Update `src/lib/data/clear.ts` with environment table deletes in FK-safe order: sync_ops → checkpoints → artifacts → scans

### Scan-on-Project-Open Pattern

When a project page loads and the project has a `workingDirectory`:
1. Check if a recent scan exists (< 5 minutes old)
2. If yes, use cached data
3. If no, trigger a background scan via POST to scan API
4. Dashboard shows "Scanning..." state until complete

## Acceptance Criteria

- [ ] 4 new tables created with proper Drizzle schema definitions and type exports
- [ ] Bootstrap DDL added to `src/lib/db/index.ts` for self-healing
- [ ] Migration SQL file created
- [ ] `clear.ts` updated with FK-safe environment table cleanup
- [ ] Data access functions for all CRUD operations
- [ ] POST /api/environment/scan triggers scan and persists results
- [ ] GET /api/environment/scan returns latest scan for a project
- [ ] GET /api/environment/artifacts supports filtering by tool, category, scope
- [ ] GET /api/environment/artifacts/[id] reads current file content from disk
- [ ] Scan results are queryable with < 5ms response time from SQLite
- [ ] Artifact counts grouped by category available for dashboard summary

## Scope Boundaries

**Included:**
- 4 new DB tables with schema, types, and bootstrap
- Data access layer (CRUD functions)
- API routes for scan trigger, scan results, artifact queries
- Scan-on-project-open pattern

**Excluded:**
- Dashboard UI (see environment-dashboard)
- Git checkpoint creation logic (see git-checkpoint-manager)
- Write-back / sync operations (see environment-sync-engine)
- Real-time file watching or auto-refresh

## References

- Source: environment onboarding plan — Feature 2
- Pattern: `src/lib/db/schema.ts` — existing Drizzle table definitions
- Pattern: `src/lib/db/index.ts` — bootstrap CREATE TABLE IF NOT EXISTS
- Pattern: `src/lib/data/clear.ts` — FK-safe table cleanup
- Related features: environment-scanner (produces data), environment-dashboard (consumes data)
