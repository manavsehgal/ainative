import { readFileSync } from "node:fs";
import { scanEnvironment } from "./scanner";
import { getLaunchCwd } from "./workspace-context";
import type { EnvironmentArtifact } from "./types";

export interface SkillSummary {
  /** Stable opaque ID used by activate_skill. Today: the relative path. */
  id: string;
  /** Short display name, e.g. "capture" or "code-review". */
  name: string;
  /** Which tool persona (claude-code | codex | shared). */
  tool: string;
  /** "user" or "project". */
  scope: string;
  /** Short description (first ~200 chars of SKILL.md body). */
  preview: string;
  sizeBytes: number;
  /** Absolute path to the skill's SKILL.md — consumers can read it. */
  absPath: string;
}

/**
 * Discover skills from both `.claude/skills/` and `.agents/skills/` under
 * the active project and user home. Reuses the existing environment
 * scanner — we're just filtering to `category === "skill"`.
 *
 * Deliberately narrow surface: the scanner returns many artifact
 * categories; the skill MCP tools only care about skills.
 */
export function listSkills(
  options: { projectDir?: string } = {}
): SkillSummary[] {
  const projectDir = options.projectDir ?? getLaunchCwd();
  const scan = scanEnvironment({ projectDir });
  const skills: SkillSummary[] = [];
  for (const a of scan.artifacts) {
    if (a.category !== "skill") continue;
    skills.push(artifactToSummary(a));
  }
  // Stable sort: tool, then scope, then name — deterministic listing is
  // easier for the LLM to reason over.
  skills.sort((a, b) => {
    if (a.tool !== b.tool) return a.tool.localeCompare(b.tool);
    if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
    return a.name.localeCompare(b.name);
  });
  return skills;
}

/**
 * Locate a single skill by its opaque ID (the relative path) and return
 * its full SKILL.md content. Returns `null` if the skill is not found.
 */
export function getSkill(
  id: string,
  options: { projectDir?: string } = {}
): (SkillSummary & { content: string }) | null {
  const all = listSkills(options);
  const hit = all.find((s) => s.id === id);
  if (!hit) return null;
  try {
    const content = readFileSync(hit.absPath, "utf8");
    return { ...hit, content };
  } catch {
    return null;
  }
}

function artifactToSummary(a: EnvironmentArtifact): SkillSummary {
  return {
    id: a.relPath,
    name: a.name,
    tool: a.tool,
    scope: a.scope,
    preview: a.preview,
    sizeBytes: a.sizeBytes,
    absPath: a.absPath,
  };
}
