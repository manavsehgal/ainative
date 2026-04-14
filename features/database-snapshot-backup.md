---
title: Database Snapshot Backup
status: completed
priority: P1
milestone: post-mvp
source: brainstorming session 2026-04-03
dependencies: []
---

# Database Snapshot Backup

## Description

Full-state snapshot system for stagent. Creates atomic copies of the SQLite database using better-sqlite3's `.backup()` API (WAL-safe) and tarballs all `~/.stagent/` file directories into a single restorable archive. Supports three modes: auto-backup on user-configurable intervals, user-initiated manual snapshots with optional labels, and full-state restore from any snapshot.

Retention is enforced automatically with two configurable dimensions: keep last N snapshots and keep last N weeks of snapshots. Both are checked after every snapshot creation — whichever limit triggers first causes older snapshots to be purged.

## User Story

As a stagent user, I want automatic periodic backups so my data is protected without manual effort.

As a stagent user, I want to create a named snapshot before risky operations so I can roll back if something goes wrong.

As a stagent user, I want to restore my entire stagent state from a previous snapshot with one click.

As a stagent user, I want to configure how many snapshots to keep and how old they can be, so disk usage stays manageable.

## Technical Approach

- **Snapshot storage**: `~/.stagent/snapshots/{timestamp}_{label}/` containing `snapshot.db`, `files.tar.gz`, `manifest.json`
- **DB backup**: `better-sqlite3` `.backup()` API for atomic WAL-safe copy. Raw `sqlite` handle exported from `src/lib/db/index.ts`
- **File archival**: `tar` npm package creates gzipped tarball of uploads, screenshots, outputs, sessions, documents, logs
- **Metadata**: `snapshots` table tracks id, label, type, status, sizes, file path, created timestamp
- **Auto-backup**: Separate lightweight `setInterval` timer in `src/lib/snapshots/auto-backup.ts`, started at boot via `src/instrumentation.ts`
- **Settings**: `getSetting()`/`setSetting()` helpers with dotted keys (snapshot.autoBackup.enabled, .interval, .retention.maxCount, .retention.maxAgeWeeks)
- **Retention**: `enforceRetention()` runs after every snapshot creation, deletes oldest by both count and age limits
- **Restore**: Full replace — creates pre-restore safety snapshot, wipes file dirs, extracts tarball, copies DB. Requires process restart (SQLite singleton)
- **API**: CRUD at `/api/snapshots`, restore at `/api/snapshots/[id]/restore`, settings at `/api/snapshots/settings`
- **UI**: `DatabaseSnapshotsSection` card in Settings page with snapshot list, create/delete/restore, auto-backup config, retention config

## Acceptance Criteria

- [x] Manual snapshot creates an atomic SQLite backup + tarball of all file dirs
- [x] Manual snapshot accepts an optional user-provided label
- [x] Snapshot stored at `~/.stagent/snapshots/{timestamp}_{label}/` with `snapshot.db`, `files.tar.gz`, `manifest.json`
- [x] Manifest records: version, timestamp, included directories, file count per dir, total size
- [x] Auto-backup can be enabled/disabled via settings toggle
- [x] Auto-backup interval is configurable (e.g., "6h", "1d", "1w") using existing interval-parser
- [x] Auto-backup timer starts at server boot via `instrumentation.ts`
- [x] Auto-backup respects enabled/disabled setting (checks each tick)
- [x] Retention: configurable max snapshot count (default: 10)
- [x] Retention: configurable max age in weeks (default: 4 weeks)
- [x] Retention enforced after every snapshot creation (auto or manual)
- [x] Oldest snapshots pruned first when either limit is exceeded
- [x] Snapshot list shows: label, type (auto/manual), date, size, status
- [x] Individual snapshots can be deleted manually
- [x] Restore creates a pre-restore safety snapshot automatically before replacing
- [x] Restore wipes current DB + file dirs, replaces with snapshot contents
- [x] Restore signals that process restart is required
- [x] UI shows restart banner after restore
- [x] Snapshot creation shows progress feedback (toast)
- [x] Restore confirmation uses ConfirmDialog with destructive styling
- [x] Cannot create snapshot while another is in progress (mutex)
- [x] Cannot restore while a snapshot is in progress
- [x] Snapshots table in DB tracks metadata
- [x] Running tasks checked before restore (409 if active)
- [x] Disk space shown: total snapshots size in settings section

## Scope Boundaries

**Included:**
- Full SQLite database backup via `.backup()` API
- All `~/.stagent/` file directories (uploads, screenshots, outputs, sessions, documents, logs)
- Auto-backup on configurable intervals with retention policies
- Manual snapshots with optional labels
- Full-replace restore with pre-restore safety snapshot
- Settings UI in Settings page
- Snapshot list with create/delete/restore actions
- Disk usage display

**Excluded:**
- Incremental/differential backups (always full snapshots)
- Cloud/remote backup destinations (local only)
- Selective restore (always full replace)
- Snapshot encryption
- Snapshot compression level configuration
- Export/download snapshot as single file
- Hot-swap restore without restart (SQLite singleton limitation)

## References

- Existing backup infrastructure: `src/lib/environment/backup-manager.ts`
- Scheduler pattern: `src/lib/schedules/scheduler.ts`
- Interval parser: `src/lib/schedules/interval-parser.ts`
- Settings helpers: `src/lib/settings/helpers.ts`
