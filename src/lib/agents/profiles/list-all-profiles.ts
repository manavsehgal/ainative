import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { listProfiles } from "./registry";
import type { AgentProfile } from "./types";

/**
 * Minimal YAML frontmatter parser — handles the `---\nkey: value\n---\n...`
 * pattern used by SKILL.md files. Returns null if no frontmatter or no `name`.
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function loadFilesystemSkills(
  skillsDir: string,
  origin: "filesystem-project" | "filesystem-user"
): AgentProfile[] {
  if (!existsSync(skillsDir)) return [];
  const profiles: AgentProfile[] = [];
  for (const entry of readdirSync(skillsDir)) {
    const skillPath = join(skillsDir, entry);
    try {
      if (!statSync(skillPath).isDirectory()) continue;
      const skillMdPath = join(skillPath, "SKILL.md");
      if (!existsSync(skillMdPath)) continue;
      const content = readFileSync(skillMdPath, "utf8");
      const fm = parseFrontmatter(content);
      if (!fm || !fm.name) {
        console.warn(
          `[listAllProfiles] skipping ${skillMdPath}: missing name in frontmatter`
        );
        continue;
      }
      profiles.push({
        id: fm.name,
        name: fm.name,
        description: fm.description ?? "",
        domain: "skill",
        tags: [],
        systemPrompt: content,
        skillMd: content,
        allowedTools: [],
        mcpServers: {},
        supportedRuntimes: ["claude-code"],
        origin,
        scope: origin === "filesystem-project" ? "project" : "user",
        readOnly: true,
        projectDir: origin === "filesystem-project" ? skillsDir : undefined,
      } as AgentProfile);
    } catch (err) {
      console.warn(
        `[listAllProfiles] failed to load skill at ${skillPath}:`,
        (err as Error).message
      );
    }
  }
  return profiles;
}

/**
 * Lists every agent profile reachable from this Stagent instance:
 *   1. Registry profiles (builtins + user registry)
 *   2. Project filesystem skills at `<projectDir>/.claude/skills/*\/SKILL.md`
 *   3. User filesystem skills at `~/.claude/skills/*\/SKILL.md` (or `userSkillsDir` override)
 * Dedupes by id — registry profiles win on collision (they're curated).
 *
 * @param projectDir Absolute path to the active project's working directory
 * @param userSkillsDir Override for user skills dir (tests); defaults to `~/.claude/skills`
 */
export async function listAllProfiles(
  projectDir: string | null | undefined,
  userSkillsDir: string = join(homedir(), ".claude", "skills")
): Promise<AgentProfile[]> {
  const registry = listProfiles();
  const registryIds = new Set(registry.map((p) => p.id));

  const userSkills = loadFilesystemSkills(userSkillsDir, "filesystem-user").filter(
    (p) => !registryIds.has(p.id)
  );

  const projectSkills = projectDir
    ? loadFilesystemSkills(
        join(projectDir, ".claude", "skills"),
        "filesystem-project"
      ).filter((p) => !registryIds.has(p.id) && !userSkills.some((u) => u.id === p.id))
    : [];

  return [...registry, ...userSkills, ...projectSkills];
}
