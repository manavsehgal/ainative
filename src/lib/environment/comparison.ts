/**
 * Cross-project comparison data layer.
 * Queries environment artifacts across multiple projects for fleet visibility.
 */

import { db } from "@/lib/db";
import {
  environmentScans,
  environmentArtifacts,
  projects,
} from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface MatrixCell {
  projectId: string;
  projectName: string;
  category: string;
  count: number;
}

export interface ComparisonMatrix {
  projects: Array<{ id: string; name: string; scanId: string | null }>;
  categories: string[];
  cells: MatrixCell[];
}

/**
 * Get comparison matrix: projects × artifact categories with counts.
 * Uses the latest scan per project.
 */
export function getComparisonMatrix(): ComparisonMatrix {
  // Get all projects with their latest scan
  const projectScans = db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      scanId: environmentScans.id,
    })
    .from(projects)
    .leftJoin(
      environmentScans,
      and(
        eq(environmentScans.projectId, projects.id),
        eq(environmentScans.scanStatus, "completed")
      )
    )
    .orderBy(projects.name)
    .all();

  // Deduplicate: keep latest scan per project
  const projectMap = new Map<string, { id: string; name: string; scanId: string | null }>();
  for (const row of projectScans) {
    if (!projectMap.has(row.projectId)) {
      projectMap.set(row.projectId, {
        id: row.projectId,
        name: row.projectName,
        scanId: row.scanId,
      });
    }
  }

  const projectList = Array.from(projectMap.values());
  const scanIds = projectList
    .map((p) => p.scanId)
    .filter((id): id is string => id !== null);

  if (scanIds.length === 0) {
    return { projects: projectList, categories: [], cells: [] };
  }

  // Get artifact counts grouped by scan → category
  const counts = db
    .select({
      scanId: environmentArtifacts.scanId,
      category: environmentArtifacts.category,
      count: sql<number>`count(*)`,
    })
    .from(environmentArtifacts)
    .where(inArray(environmentArtifacts.scanId, scanIds))
    .groupBy(environmentArtifacts.scanId, environmentArtifacts.category)
    .all();

  // Map scan IDs back to project IDs
  const scanToProject = new Map<string, { id: string; name: string }>();
  for (const p of projectList) {
    if (p.scanId) {
      scanToProject.set(p.scanId, { id: p.id, name: p.name });
    }
  }

  const cells: MatrixCell[] = counts
    .map((c) => {
      const project = scanToProject.get(c.scanId);
      if (!project) return null;
      return {
        projectId: project.id,
        projectName: project.name,
        category: c.category,
        count: c.count,
      };
    })
    .filter((c): c is MatrixCell => c !== null);

  const categories = [...new Set(cells.map((c) => c.category))].sort();

  return { projects: projectList, categories, cells };
}

/**
 * Find projects that have a specific artifact (by name and category).
 */
export function findProjectsWithArtifact(
  name: string,
  category: string
): Array<{ projectId: string; projectName: string; artifactId: string }> {
  const results = db
    .select({
      projectId: environmentScans.projectId,
      projectName: projects.name,
      artifactId: environmentArtifacts.id,
    })
    .from(environmentArtifacts)
    .innerJoin(environmentScans, eq(environmentArtifacts.scanId, environmentScans.id))
    .innerJoin(projects, eq(environmentScans.projectId, projects.id))
    .where(
      and(
        eq(environmentArtifacts.name, name),
        eq(environmentArtifacts.category, category),
        eq(environmentScans.scanStatus, "completed")
      )
    )
    .all();

  return results.filter(
    (r): r is { projectId: string; projectName: string; artifactId: string } =>
      r.projectId !== null
  );
}

/**
 * Get artifact details for comparison between two projects.
 */
export function getArtifactDiff(
  artifactName: string,
  category: string,
  projectIdA: string,
  projectIdB: string
): { a: { preview: string | null; metadata: string | null } | null; b: { preview: string | null; metadata: string | null } | null } {
  function getArtifact(projectId: string) {
    return db
      .select({
        preview: environmentArtifacts.preview,
        metadata: environmentArtifacts.metadata,
      })
      .from(environmentArtifacts)
      .innerJoin(environmentScans, eq(environmentArtifacts.scanId, environmentScans.id))
      .where(
        and(
          eq(environmentScans.projectId, projectId),
          eq(environmentScans.scanStatus, "completed"),
          eq(environmentArtifacts.name, artifactName),
          eq(environmentArtifacts.category, category)
        )
      )
      .limit(1)
      .get() || null;
  }

  return { a: getArtifact(projectIdA), b: getArtifact(projectIdB) };
}
