/**
 * Project introspection for the chat app builder.
 *
 * Provides a structured fingerprint of an existing project's resources
 * so the LLM can understand what the user already has before proposing
 * new data models, schedules, and profiles.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, schedules, documents } from "@/lib/db/schema";
import { listTables } from "@/lib/data/tables";
import type { ColumnDef } from "@/lib/tables/types";

// ── Types ────────────────────────────────────────────────────────────

export interface TableFingerprint {
  id: string;
  name: string;
  description: string | null;
  columns: ColumnDef[];
  rowCount: number;
  source: string;
}

export interface ScheduleFingerprint {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  status: string;
  agentProfile: string | null;
}

export interface DocumentFingerprint {
  id: string;
  filename: string;
  mimeType: string | null;
  direction: string;
  status: string;
}

export interface ProjectFingerprint {
  projectId: string;
  projectName: string;
  tables: TableFingerprint[];
  schedules: ScheduleFingerprint[];
  documents: DocumentFingerprint[];
}

// ── Implementation ───────────────────────────────────────────────────

function parseColumnSchema(raw: string): ColumnDef[] {
  try {
    return JSON.parse(raw) as ColumnDef[];
  } catch {
    return [];
  }
}

export async function introspectProject(
  projectId: string,
): Promise<ProjectFingerprint> {
  // Verify project exists
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) {
    throw new Error(`Project "${projectId}" not found`);
  }

  // Tables with column schemas
  const tables = await listTables({ projectId });
  const tableFingerprints: TableFingerprint[] = tables.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    columns: parseColumnSchema(t.columnSchema),
    rowCount: t.rowCount,
    source: t.source,
  }));

  // Schedules in this project
  const projectSchedules = db
    .select()
    .from(schedules)
    .where(eq(schedules.projectId, projectId))
    .all();

  const scheduleFingerprints: ScheduleFingerprint[] = projectSchedules.map(
    (s) => ({
      id: s.id,
      name: s.name,
      prompt: s.prompt,
      cronExpression: s.cronExpression,
      status: s.status,
      agentProfile: s.agentProfile,
    }),
  );

  // Documents linked to this project
  const projectDocs = db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .all();

  const documentFingerprints: DocumentFingerprint[] = projectDocs.map((d) => ({
    id: d.id,
    filename: d.filename,
    mimeType: d.mimeType,
    direction: d.direction,
    status: d.status,
  }));

  return {
    projectId: project.id,
    projectName: project.name,
    tables: tableFingerprints,
    schedules: scheduleFingerprints,
    documents: documentFingerprints,
  };
}
