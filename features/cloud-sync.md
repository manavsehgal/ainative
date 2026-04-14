---
title: Cloud Sync
status: completed
priority: P1
layer: PLG Core
dependencies:
  - local-license-manager
  - supabase-cloud-backend
  - stripe-billing-integration
---

# Cloud Sync

> **Superseded by `community-edition-simplification` (2026-04-13).** This feature shipped but was later fully reverted when Stagent pivoted to a 100% free Community Edition with no tiers, billing, or cloud dependency. Kept as historical record.

## Description

Encrypted SQLite backup and restore via Supabase Storage for Operator+ tier users. The sync mechanism exports the entire SQLite database as an AES-256-GCM encrypted snapshot, uploads it to Supabase Storage, and supports downloading and restoring from any previous snapshot. This enables multi-device usage and disaster recovery while preserving the local-first architecture — data is always encrypted at rest in the cloud and only decryptable by the user.

V1 is full-database export (no selective/incremental sync). Conflict resolution is last-write-wins for settings, with a conflict banner shown when a restore would overwrite local changes. A safety backup is always created before any restore operation.

## User Story

As an Operator tier user working across multiple machines, I want to sync my Stagent database between devices so that my agent memories, workflow configurations, and execution history are available everywhere — with the confidence that my data is encrypted and only I can read it.

## Technical Approach

### Encryption Design

All data is encrypted client-side before upload using AES-256-GCM with HKDF-derived keys:

```ts
// Key derivation
const ikm = new TextEncoder().encode(userId);
const info = new TextEncoder().encode('stagent-sync-v1');
const salt = crypto.getRandomValues(new Uint8Array(32));

const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'HKDF', hash: 'SHA-256', salt, info },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);
```

The encryption envelope format:

```
[4 bytes: version] [32 bytes: salt] [12 bytes: IV] [N bytes: ciphertext] [16 bytes: auth tag]
```

Version byte allows future algorithm migration without breaking existing snapshots.

### Core Module

File: `src/lib/sync/cloud-sync.ts`

```ts
export class CloudSync {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Export the SQLite database, encrypt it, and upload to Supabase Storage.
   * Uses better-sqlite3's .backup() for a consistent snapshot.
   */
  async exportAndEncrypt(): Promise<SyncResult> {
    // 1. Create a temporary backup using better-sqlite3 .backup()
    const tempPath = path.join(os.tmpdir(), `stagent-export-${Date.now()}.db`);
    await db.backup(tempPath);

    // 2. Read the backup file
    const dbBuffer = await fs.readFile(tempPath);

    // 3. Encrypt with AES-256-GCM
    const { encrypted, salt, iv } = await this.encrypt(dbBuffer);

    // 4. Build envelope
    const envelope = this.buildEnvelope(encrypted, salt, iv);

    // 5. Upload to Supabase Storage
    const result = await this.uploadSnapshot(envelope);

    // 6. Clean up temp file
    await fs.unlink(tempPath);

    return result;
  }

  /**
   * Upload encrypted snapshot to Supabase Storage.
   * Path: stagent-sync/{userId}/{timestamp}.enc
   */
  async uploadSnapshot(envelope: Buffer): Promise<SyncResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `stagent-sync/${this.userId}/${timestamp}.enc`;

    const { error } = await this.supabase.storage
      .from('sync-snapshots')
      .upload(storagePath, envelope, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) throw new SyncError('upload_failed', error.message);

    // Record sync session
    await this.recordSyncSession('export', storagePath);

    return { success: true, path: storagePath, timestamp: Date.now() };
  }

  /**
   * Download the latest snapshot and decrypt it.
   */
  async downloadLatestSnapshot(): Promise<Buffer> {
    // List snapshots for this user, sorted by timestamp descending
    const { data: files } = await this.supabase.storage
      .from('sync-snapshots')
      .list(`stagent-sync/${this.userId}`, {
        sortBy: { column: 'created_at', order: 'desc' },
        limit: 1,
      });

    if (!files?.length) throw new SyncError('no_snapshots', 'No sync snapshots found');

    const { data } = await this.supabase.storage
      .from('sync-snapshots')
      .download(`stagent-sync/${this.userId}/${files[0].name}`);

    if (!data) throw new SyncError('download_failed', 'Failed to download snapshot');

    const envelope = Buffer.from(await data.arrayBuffer());
    return this.decrypt(envelope);
  }

  /**
   * Decrypt a snapshot and restore it as the active database.
   * Always creates a safety backup of the current database first.
   */
  async decryptAndRestore(): Promise<RestoreResult> {
    // 1. Safety backup of current database
    const safetyPath = path.join(
      path.dirname(DB_PATH),
      `stagent-pre-restore-${Date.now()}.db`
    );
    await db.backup(safetyPath);

    // 2. Download and decrypt latest snapshot
    const decrypted = await this.downloadLatestSnapshot();

    // 3. Write decrypted database to temp file
    const tempPath = path.join(os.tmpdir(), `stagent-restore-${Date.now()}.db`);
    await fs.writeFile(tempPath, decrypted);

    // 4. Validate the decrypted database
    const validation = await this.validateDatabase(tempPath);
    if (!validation.valid) {
      await fs.unlink(tempPath);
      throw new SyncError('invalid_snapshot', validation.error);
    }

    // 5. Close current DB connection, replace file, reopen
    db.close();
    await fs.copyFile(tempPath, DB_PATH);
    reopenDatabase();

    // 6. Clean up
    await fs.unlink(tempPath);

    // 7. Record restore session
    await this.recordSyncSession('restore', safetyPath);

    return { success: true, safetyBackupPath: safetyPath };
  }

  /**
   * Validate a database file has expected tables and schema version.
   */
  private async validateDatabase(dbPath: string): Promise<ValidationResult> {
    const testDb = new Database(dbPath, { readonly: true });
    try {
      const tables = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all();
      const requiredTables = ['projects', 'tasks', 'workflows', 'agent_logs', 'settings'];
      const missing = requiredTables.filter(
        t => !tables.some((row: any) => row.name === t)
      );
      if (missing.length > 0) {
        return { valid: false, error: `Missing tables: ${missing.join(', ')}` };
      }
      return { valid: true };
    } finally {
      testDb.close();
    }
  }
}
```

### Supabase Infrastructure

**Storage bucket**: `sync-snapshots` with RLS policy:
- Users can only access `stagent-sync/{their-user-id}/*`
- Max file size: 100MB (covers large SQLite databases)

**Database table**: `sync_sessions` for tracking restore points:

```sql
CREATE TABLE sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('export', 'restore')),
  storage_path TEXT,
  device_name TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only see their own sessions
ALTER TABLE sync_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions"
  ON sync_sessions FOR ALL
  USING (auth.uid() = user_id);
```

### Settings UI

File: `src/components/settings/cloud-sync-section.tsx`

```tsx
export function CloudSyncSection() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  return (
    <FormSectionCard title="Cloud Sync" description="Encrypted backup to the cloud">
      <div className="space-y-4">
        {/* Last sync info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Last synced</p>
            <p className="text-sm text-muted-foreground">
              {lastSync ? formatRelative(lastSync) : 'Never'}
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Cloud className="size-4 mr-2" />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Device list */}
        <DeviceList sessions={sessions} />

        {/* Conflict banner */}
        {hasConflict && (
          <ConflictBanner
            localTimestamp={localLastModified}
            remoteTimestamp={remoteLastSync}
            onResolve={handleConflictResolve}
          />
        )}

        {/* Restore from backup */}
        <div className="border-t pt-4">
          <Button variant="outline" onClick={handleRestore}>
            Restore from cloud backup
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            A safety backup of your current data will be created automatically.
          </p>
        </div>
      </div>
    </FormSectionCard>
  );
}
```

### DeviceList Component

File: `src/components/settings/device-list.tsx`

Shows all devices that have synced, with last sync timestamp:

```tsx
export function DeviceList({ sessions }: { sessions: SyncSession[] }) {
  const devices = groupByDevice(sessions);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Synced devices</p>
      {devices.map(device => (
        <div key={device.id} className="flex items-center justify-between surface-card elevation-0 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Monitor className="size-4 text-muted-foreground" />
            <span className="text-sm">{device.name}</span>
            {device.isCurrent && (
              <StatusChip variant="secondary">This device</StatusChip>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRelative(device.lastSync)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

Device identification: `os.hostname()` for device name, a randomly generated UUID stored in the settings table for device ID (generated on first sync).

### Conflict Detection

Conflict detection uses timestamps (last-write-wins):

1. Before sync, compare local DB's `last_modified` timestamp (from settings table) with the remote snapshot's timestamp
2. If remote is newer than last sync and local has changes since last sync, show conflict banner
3. Conflict resolution options: "Keep local" (skip restore), "Use cloud" (overwrite local), "Sync now" (export local first, then users can restore from either)

Settings table conflicts use last-write-wins by default. The conflict banner is informational — it warns but doesn't block.

### API Routes

```
POST /api/sync/export   -- Trigger export + encrypt + upload
POST /api/sync/restore  -- Download + decrypt + restore (creates safety backup)
GET  /api/sync/sessions -- List sync history (devices, timestamps)
```

Each route checks `isFeatureAllowed('cloud_sync')` and returns 402 if the user is on Community tier.

### Feature Gate

```ts
// In each API route
const allowed = await isFeatureAllowed('cloud_sync');
if (!allowed) {
  return NextResponse.json(
    { error: 'Cloud sync requires Operator tier', upgradeUrl: '/settings/subscription', requiredTier: 'operator' },
    { status: 402 }
  );
}
```

## Acceptance Criteria

- [ ] `exportAndEncrypt()` creates a consistent SQLite backup and encrypts with AES-256-GCM
- [ ] Encryption uses HKDF with userId as IKM and 'stagent-sync-v1' as info
- [ ] Encrypted snapshots uploaded to Supabase Storage at `stagent-sync/{userId}/{timestamp}.enc`
- [ ] `downloadLatestSnapshot()` retrieves and decrypts the most recent snapshot
- [ ] `decryptAndRestore()` creates a safety backup before overwriting the active database
- [ ] Database validation checks for required tables before completing restore
- [ ] CloudSyncSection in settings shows sync button, last sync time, and device list
- [ ] DeviceList component displays all synced devices with timestamps
- [ ] Conflict banner appears when both local and remote have changes since last sync
- [ ] Last-write-wins resolution for settings table conflicts
- [ ] `POST /api/sync/export`, `POST /api/sync/restore`, `GET /api/sync/sessions` routes work
- [ ] All sync routes check `isFeatureAllowed('cloud_sync')` and return 402 for Community tier
- [ ] `sync_sessions` table in Supabase tracks all export/restore operations with device info
- [ ] Supabase Storage RLS restricts access to user's own snapshots
- [ ] Safety backup path returned in restore result for manual recovery

## Scope Boundaries

**Included:**
- Full-database encrypted export and restore
- AES-256-GCM encryption with HKDF key derivation
- Supabase Storage for snapshot persistence
- Safety backup before every restore
- Device list and sync session history
- Conflict detection with last-write-wins resolution
- Feature gate for Operator+ tier
- Database validation before restore

**Excluded:**
- Incremental/selective sync (only changed tables) — V2 optimization
- Real-time sync (WebSocket-based live replication) — fundamentally different architecture
- Automatic scheduled sync — manual trigger only for V1
- End-to-end encrypted sharing between users — single-user only
- Snapshot diff viewer (compare two snapshots) — future enhancement
- Bandwidth optimization (compression before encryption) — V2
- Offline queue (sync when connection restored) — V2
- Migration between schema versions during restore — snapshots are version-locked

## References

- Depends on: `features/local-license-manager.md` — `isFeatureAllowed('cloud_sync')`, tier gate
- Depends on: `features/supabase-cloud-backend.md` — Supabase client, Storage bucket, RLS policies
- Depends on: `features/stripe-billing-integration.md` — Operator tier verification
- SQLite backup: better-sqlite3 `.backup()` API — consistent snapshot without WAL issues
- Database location: `~/.stagent/stagent.db` — backup source and restore target
- Database module: `src/lib/db/index.ts` — connection management, close/reopen helpers
- Settings UI pattern: `src/app/settings/page.tsx` — FormSectionCard layout
- Web Crypto API: AES-GCM + HKDF available in Node.js and browser environments
