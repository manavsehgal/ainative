/**
 * Skill portfolio: unified catalog with drift detection across all scans.
 */

import { db } from "@/lib/db";
import { environmentArtifacts, environmentScans } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface AggregatedSkill {
  name: string;
  locations: Array<{
    id: string;
    tool: string;
    scope: string;
    absPath: string;
    contentHash: string;
    preview: string | null;
    sizeBytes: number;
    modifiedAt: number;
    scanId: string;
  }>;
  driftStatus: "synced" | "drifted" | "one-sided";
  toolPresence: string[];
}

/** Aggregate all skills across all completed scans. */
export function aggregateSkills(): AggregatedSkill[] {
  // Get all skill artifacts from latest scans
  const skills = db
    .select({
      id: environmentArtifacts.id,
      scanId: environmentArtifacts.scanId,
      tool: environmentArtifacts.tool,
      scope: environmentArtifacts.scope,
      name: environmentArtifacts.name,
      absPath: environmentArtifacts.absPath,
      contentHash: environmentArtifacts.contentHash,
      preview: environmentArtifacts.preview,
      sizeBytes: environmentArtifacts.sizeBytes,
      modifiedAt: environmentArtifacts.modifiedAt,
    })
    .from(environmentArtifacts)
    .innerJoin(environmentScans, eq(environmentArtifacts.scanId, environmentScans.id))
    .where(
      and(
        eq(environmentArtifacts.category, "skill"),
        eq(environmentScans.scanStatus, "completed")
      )
    )
    .all();

  // Group by name
  const groups = new Map<string, AggregatedSkill["locations"]>();
  for (const skill of skills) {
    const existing = groups.get(skill.name) || [];
    // Avoid duplicates from multiple scans of same location
    if (!existing.some((e) => e.absPath === skill.absPath)) {
      existing.push(skill);
    }
    groups.set(skill.name, existing);
  }

  // Build aggregated skills with drift detection
  const result: AggregatedSkill[] = [];
  for (const [name, locations] of groups) {
    const tools = [...new Set(locations.map((l) => l.tool))];
    const hashes = [...new Set(locations.map((l) => l.contentHash))];

    let driftStatus: AggregatedSkill["driftStatus"];
    if (locations.length === 1) {
      driftStatus = "one-sided";
    } else if (hashes.length === 1) {
      driftStatus = "synced";
    } else {
      driftStatus = "drifted";
    }

    result.push({
      name,
      locations,
      driftStatus,
      toolPresence: tools,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Detect drift for a specific skill. */
export function detectDrift(
  skillName: string
): { status: AggregatedSkill["driftStatus"]; locations: AggregatedSkill["locations"] } {
  const all = aggregateSkills();
  const skill = all.find((s) => s.name === skillName);
  if (!skill) return { status: "one-sided", locations: [] };
  return { status: skill.driftStatus, locations: skill.locations };
}
