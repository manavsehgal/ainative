/**
 * Profile-Artifact Linker
 *
 * Reconciles environment skill artifacts with profile registry entries.
 * Runs after each scan to populate linkedProfileId on skill artifacts,
 * enabling the UI to show which skills are already profiles and which
 * are candidates for promotion.
 *
 * Matching strategy: directory basename under ~/.claude/skills/ is the
 * shared key between both systems.
 */

import { db } from "@/lib/db";
import { environmentArtifacts } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { listAllProfiles } from "@/lib/agents/profiles/registry";
import path from "node:path";

export interface LinkResult {
  linked: number;
  unlinked: number;
  unlinkedArtifactIds: string[];
}

/**
 * Link skill artifacts from a scan to their corresponding profiles.
 *
 * For each skill artifact, extracts the directory basename from its absPath
 * (e.g., ~/.claude/skills/code-reviewer/SKILL.md → "code-reviewer") and
 * matches it against profile IDs in the registry.
 */
export function linkArtifactsToProfiles(
  scanId: string,
  projectDir?: string
): LinkResult {
  // Get all skill artifacts from this scan
  const skillArtifacts = db
    .select()
    .from(environmentArtifacts)
    .where(
      and(
        eq(environmentArtifacts.scanId, scanId),
        eq(environmentArtifacts.category, "skill")
      )
    )
    .all();

  if (skillArtifacts.length === 0) {
    return { linked: 0, unlinked: 0, unlinkedArtifactIds: [] };
  }

  // Build a set of known profile IDs
  const profiles = listAllProfiles(projectDir);
  const profileIds = new Set(profiles.map((p) => p.id));

  let linked = 0;
  const unlinkedArtifactIds: string[] = [];

  // Match each skill artifact to a profile by directory basename
  for (const artifact of skillArtifacts) {
    const dirBasename = extractProfileId(artifact.absPath);
    if (!dirBasename) {
      unlinkedArtifactIds.push(artifact.id);
      continue;
    }

    if (profileIds.has(dirBasename)) {
      // Link this artifact to the profile
      db.update(environmentArtifacts)
        .set({ linkedProfileId: dirBasename })
        .where(eq(environmentArtifacts.id, artifact.id))
        .run();
      linked++;
    } else {
      unlinkedArtifactIds.push(artifact.id);
    }
  }

  return {
    linked,
    unlinked: unlinkedArtifactIds.length,
    unlinkedArtifactIds,
  };
}

/**
 * Extract the profile ID from a skill artifact's absolute path.
 *
 * The scanner stores absPath as either:
 *   - The directory: ~/.claude/skills/code-reviewer
 *   - Or the file:   ~/.claude/skills/code-reviewer/SKILL.md
 *
 * The profile ID is the skill directory basename ("code-reviewer").
 */
function extractProfileId(absPath: string): string | null {
  // The absPath may point to the skill directory itself or a file within it.
  // Use the basename of the path first — if it looks like a directory name
  // (no extension), use it directly. Otherwise, use the parent directory.
  const basename = path.basename(absPath);

  // If basename has a file extension (e.g., "SKILL.md"), go up one level
  if (basename.includes(".")) {
    const parentBasename = path.basename(path.dirname(absPath));
    if (parentBasename === "skills" || parentBasename === ".claude") {
      return null;
    }
    return parentBasename;
  }

  // basename is a directory name — skip if it's the skills root
  if (basename === "skills" || basename === ".claude") {
    return null;
  }

  return basename;
}

/**
 * Get all unlinked skill artifact IDs for a scan.
 * Useful for the suggestion engine to generate Tier 2 suggestions.
 */
export function getUnlinkedSkillArtifacts(
  scanId: string
): Array<{ id: string; name: string; absPath: string; contentHash: string; preview: string | null; metadata: string | null }> {
  return db
    .select({
      id: environmentArtifacts.id,
      name: environmentArtifacts.name,
      absPath: environmentArtifacts.absPath,
      contentHash: environmentArtifacts.contentHash,
      preview: environmentArtifacts.preview,
      metadata: environmentArtifacts.metadata,
    })
    .from(environmentArtifacts)
    .where(
      and(
        eq(environmentArtifacts.scanId, scanId),
        eq(environmentArtifacts.category, "skill"),
        isNull(environmentArtifacts.linkedProfileId)
      )
    )
    .all();
}
