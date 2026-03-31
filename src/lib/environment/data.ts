/**
 * Data access layer for environment scan results.
 * Bridges scanner output → SQLite cache for instant dashboard queries.
 */

import { db } from "@/lib/db";
import {
  environmentScans,
  environmentArtifacts,
  environmentCheckpoints,
  environmentSyncOps,
  type EnvironmentScanRow,
  type EnvironmentArtifactRow,
  type EnvironmentCheckpointRow,
  type EnvironmentSyncOpRow,
} from "@/lib/db/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
import type { ScanResult, ArtifactCategory, ToolPersona, ArtifactScope } from "./types";
import { linkArtifactsToProfiles } from "./profile-linker";

/** Persist a scan result (scan + all artifacts) in a single transaction. */
export function createScan(
  result: ScanResult,
  scanPath: string,
  projectId?: string
): EnvironmentScanRow {
  const scanId = crypto.randomUUID();
  const now = new Date();

  const scanRow = {
    id: scanId,
    projectId: projectId || null,
    scanPath,
    persona: JSON.stringify(result.personas),
    scanStatus: "completed" as const,
    artifactCount: result.artifacts.length,
    durationMs: result.durationMs,
    errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    scannedAt: now,
    createdAt: now,
  };

  const artifactRows = result.artifacts.map((a) => ({
    id: crypto.randomUUID(),
    scanId,
    tool: a.tool,
    category: a.category,
    scope: a.scope,
    name: a.name,
    relPath: a.relPath,
    absPath: a.absPath,
    contentHash: a.contentHash,
    preview: a.preview || null,
    metadata: Object.keys(a.metadata).length > 0 ? JSON.stringify(a.metadata) : null,
    sizeBytes: a.sizeBytes,
    modifiedAt: a.modifiedAt,
    createdAt: now,
  }));

  // Insert in a transaction for atomicity
  db.transaction(() => {
    db.insert(environmentScans).values(scanRow).run();
    if (artifactRows.length > 0) {
      // SQLite has a max variable limit; batch inserts if needed
      const batchSize = 50;
      for (let i = 0; i < artifactRows.length; i += batchSize) {
        db.insert(environmentArtifacts)
          .values(artifactRows.slice(i, i + batchSize))
          .run();
      }
    }
  });

  // Link skill artifacts to their corresponding profiles
  try {
    linkArtifactsToProfiles(scanId);
  } catch (err) {
    console.warn("[environment] Profile linking failed (non-blocking):", err);
  }

  return db
    .select()
    .from(environmentScans)
    .where(eq(environmentScans.id, scanId))
    .get()!;
}

/**
 * Invalidate the latest scan by marking it as stale.
 * Called after profile mutations to ensure the next ensureFreshScan() re-scans.
 */
export function invalidateLatestScan(projectId?: string): void {
  const latest = getLatestScan(projectId);
  if (!latest) return;

  // Set scannedAt far enough in the past that shouldRescan() returns true.
  // The auto-scan staleness window is 5 minutes, so subtracting 10 minutes is safe.
  const staleTime = new Date(Date.now() - 10 * 60 * 1000);
  db.update(environmentScans)
    .set({ scannedAt: staleTime })
    .where(eq(environmentScans.id, latest.id))
    .run();
}

/** Get the most recent completed scan. */
export function getLatestScan(projectId?: string): EnvironmentScanRow | undefined {
  const conditions = [eq(environmentScans.scanStatus, "completed")];
  if (projectId) {
    conditions.push(eq(environmentScans.projectId, projectId));
  }

  return db
    .select()
    .from(environmentScans)
    .where(and(...conditions))
    .orderBy(desc(environmentScans.scannedAt))
    .limit(1)
    .get();
}

/** Get a scan by ID. */
export function getScanById(id: string): EnvironmentScanRow | undefined {
  return db
    .select()
    .from(environmentScans)
    .where(eq(environmentScans.id, id))
    .get();
}

/** Filter options for artifact queries. */
export interface ArtifactFilters {
  scanId: string;
  category?: ArtifactCategory;
  tool?: ToolPersona;
  scope?: ArtifactScope;
  search?: string;
}

/** Get artifacts with optional filters. */
export function getArtifacts(filters: ArtifactFilters): EnvironmentArtifactRow[] {
  const conditions = [eq(environmentArtifacts.scanId, filters.scanId)];

  if (filters.category) {
    conditions.push(eq(environmentArtifacts.category, filters.category));
  }
  if (filters.tool) {
    conditions.push(eq(environmentArtifacts.tool, filters.tool));
  }
  if (filters.scope) {
    conditions.push(eq(environmentArtifacts.scope, filters.scope));
  }
  if (filters.search) {
    conditions.push(like(environmentArtifacts.name, `%${filters.search}%`));
  }

  return db
    .select()
    .from(environmentArtifacts)
    .where(and(...conditions))
    .orderBy(environmentArtifacts.category, environmentArtifacts.name)
    .all();
}

/** Get a single artifact by ID. */
export function getArtifactById(id: string): EnvironmentArtifactRow | undefined {
  return db
    .select()
    .from(environmentArtifacts)
    .where(eq(environmentArtifacts.id, id))
    .get();
}

/** Get artifact counts grouped by category for a scan. */
export function getArtifactCounts(
  scanId: string
): Array<{ category: string; count: number }> {
  return db
    .select({
      category: environmentArtifacts.category,
      count: sql<number>`count(*)`,
    })
    .from(environmentArtifacts)
    .where(eq(environmentArtifacts.scanId, scanId))
    .groupBy(environmentArtifacts.category)
    .all();
}

/** Get artifact counts grouped by tool for a scan. */
export function getToolCounts(
  scanId: string
): Array<{ tool: string; count: number }> {
  return db
    .select({
      tool: environmentArtifacts.tool,
      count: sql<number>`count(*)`,
    })
    .from(environmentArtifacts)
    .where(eq(environmentArtifacts.scanId, scanId))
    .groupBy(environmentArtifacts.tool)
    .all();
}

// ── Checkpoint CRUD ──────────────────────────────────────────────────

/** Insert a new checkpoint record. */
export function insertCheckpoint(data: {
  projectId?: string;
  label: string;
  checkpointType: "pre-sync" | "manual" | "pre-onboard";
  gitTag?: string;
  gitCommitSha?: string;
  backupPath?: string;
  filesCount: number;
}): EnvironmentCheckpointRow {
  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(environmentCheckpoints)
    .values({
      id,
      projectId: data.projectId || null,
      label: data.label,
      checkpointType: data.checkpointType,
      gitTag: data.gitTag || null,
      gitCommitSha: data.gitCommitSha || null,
      backupPath: data.backupPath || null,
      filesCount: data.filesCount,
      status: "active",
      createdAt: now,
    })
    .run();

  return db
    .select()
    .from(environmentCheckpoints)
    .where(eq(environmentCheckpoints.id, id))
    .get()!;
}

/** Get checkpoints for a project (or all if no projectId). */
export function getCheckpoints(
  projectId?: string
): EnvironmentCheckpointRow[] {
  const conditions = [];
  if (projectId) {
    conditions.push(eq(environmentCheckpoints.projectId, projectId));
  }

  return db
    .select()
    .from(environmentCheckpoints)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(environmentCheckpoints.createdAt))
    .all();
}

/** Get a single checkpoint by ID. */
export function getCheckpointById(
  id: string
): EnvironmentCheckpointRow | undefined {
  return db
    .select()
    .from(environmentCheckpoints)
    .where(eq(environmentCheckpoints.id, id))
    .get();
}

/** Update checkpoint status (e.g., mark as rolled_back or superseded). */
export function updateCheckpointStatus(
  id: string,
  status: "active" | "rolled_back" | "superseded"
): void {
  db.update(environmentCheckpoints)
    .set({ status })
    .where(eq(environmentCheckpoints.id, id))
    .run();
}

/** Insert a sync operation record. */
export function insertSyncOp(data: {
  checkpointId: string;
  artifactId?: string;
  operation: "create" | "update" | "delete" | "sync";
  targetTool: string;
  targetPath: string;
  diffPreview?: string;
}): EnvironmentSyncOpRow {
  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(environmentSyncOps)
    .values({
      id,
      checkpointId: data.checkpointId,
      artifactId: data.artifactId || null,
      operation: data.operation,
      targetTool: data.targetTool,
      targetPath: data.targetPath,
      diffPreview: data.diffPreview || null,
      status: "pending",
      createdAt: now,
    })
    .run();

  return db
    .select()
    .from(environmentSyncOps)
    .where(eq(environmentSyncOps.id, id))
    .get()!;
}

/** Get sync operations for a checkpoint. */
export function getSyncOps(checkpointId: string): EnvironmentSyncOpRow[] {
  return db
    .select()
    .from(environmentSyncOps)
    .where(eq(environmentSyncOps.checkpointId, checkpointId))
    .orderBy(desc(environmentSyncOps.createdAt))
    .all();
}
