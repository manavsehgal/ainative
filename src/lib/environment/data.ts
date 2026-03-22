/**
 * Data access layer for environment scan results.
 * Bridges scanner output → SQLite cache for instant dashboard queries.
 */

import { db } from "@/lib/db";
import {
  environmentScans,
  environmentArtifacts,
  type EnvironmentScanRow,
  type EnvironmentArtifactRow,
} from "@/lib/db/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
import type { ScanResult, ArtifactCategory, ToolPersona, ArtifactScope } from "./types";

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

  return db
    .select()
    .from(environmentScans)
    .where(eq(environmentScans.id, scanId))
    .get()!;
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
