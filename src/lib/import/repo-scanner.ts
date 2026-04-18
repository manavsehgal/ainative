/**
 * Scans a GitHub repository for importable skills.
 * Discovers all directories containing SKILL.md files and classifies their format.
 */

import {
  parseRepoUrl,
  getDefaultBranch,
  getLatestCommitSha,
  getRepoTree,
  getFileContent,
  type TreeEntry,
} from "./github-api";

export interface DiscoveredSkill {
  name: string;
  path: string; // directory path within repo, e.g. "skills/qa"
  format: "ainative" | "skillmd-only" | "unknown";
  hasProfileYaml: boolean;
  hasSkillMd: boolean;
  hasSkillMdTmpl: boolean;
  hasReadme: boolean;
  description: string;
  frontmatter: Record<string, string>;
}

export interface RepoScanResult {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  discoveredSkills: DiscoveredSkill[];
  repoReadme: string;
  scanDurationMs: number;
}

/**
 * Parse YAML frontmatter from a SKILL.md file content.
 * Handles multi-line YAML block scalars (`|` and `>` indicators)
 * and YAML arrays (lines starting with `- `).
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm: Record<string, string> = {};
  const lines = match[1].split("\n");
  let currentKey = "";
  let currentValue = "";
  let isBlock = false; // inside a `|` or `>` block scalar
  let blockJoin = " "; // " " for `>` (folded), "\n" for `|` (literal)

  function flushKey() {
    if (currentKey) {
      fm[currentKey] = currentValue.trim();
    }
  }

  for (const line of lines) {
    // Indented continuation line (part of a block scalar or YAML array)
    if (isBlock && (line.startsWith("  ") || line.startsWith("\t"))) {
      const trimmed = line.trim();
      // Skip YAML array items for non-description fields (e.g. allowed-tools list)
      if (trimmed.startsWith("- ") && currentKey !== "description") {
        currentValue += (currentValue ? ", " : "") + trimmed.slice(2);
      } else if (trimmed) {
        currentValue += (currentValue ? blockJoin : "") + trimmed;
      }
      continue;
    }

    // New top-level key
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
      flushKey();

      currentKey = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();

      if (rawValue === "|" || rawValue === "|+" || rawValue === "|-") {
        // YAML literal block scalar — preserve newlines as spaces for description
        isBlock = true;
        blockJoin = " ";
        currentValue = "";
      } else if (rawValue === ">" || rawValue === ">+" || rawValue === ">-") {
        // YAML folded block scalar
        isBlock = true;
        blockJoin = " ";
        currentValue = "";
      } else if (rawValue === "") {
        // Value on next line(s) — treat like a block
        isBlock = true;
        blockJoin = ", ";
        currentValue = "";
      } else {
        isBlock = false;
        currentValue = rawValue;
      }
    }
  }
  flushKey();

  return fm;
}

/**
 * Scan a GitHub repo URL and discover all importable skills.
 */
export async function scanRepo(repoUrl: string): Promise<RepoScanResult> {
  const start = Date.now();

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub URL. Provide a URL like https://github.com/owner/repo");
  }

  const { owner, repo } = parsed;
  const branch = parsed.branch || (await getDefaultBranch(owner, repo));
  const commitSha = await getLatestCommitSha(owner, repo, branch);
  const tree = await getRepoTree(owner, repo, commitSha);

  // Build a set of all file paths for quick lookup
  const filePaths = new Set(tree.filter((e: TreeEntry) => e.type === "blob").map((e: TreeEntry) => e.path));

  // Find all directories containing SKILL.md
  const skillDirs = new Map<string, { hasSkillMd: boolean; hasSkillMdTmpl: boolean; hasProfileYaml: boolean; hasReadme: boolean }>();

  for (const filePath of filePaths) {
    const fileName = filePath.split("/").pop() ?? "";
    const dirPath = filePath.split("/").slice(0, -1).join("/");

    if (fileName === "SKILL.md") {
      const entry = skillDirs.get(dirPath) ?? { hasSkillMd: false, hasSkillMdTmpl: false, hasProfileYaml: false, hasReadme: false };
      entry.hasSkillMd = true;
      skillDirs.set(dirPath, entry);
    } else if (fileName === "SKILL.md.tmpl") {
      const entry = skillDirs.get(dirPath) ?? { hasSkillMd: false, hasSkillMdTmpl: false, hasProfileYaml: false, hasReadme: false };
      entry.hasSkillMdTmpl = true;
      skillDirs.set(dirPath, entry);
    } else if (fileName === "profile.yaml") {
      const entry = skillDirs.get(dirPath) ?? { hasSkillMd: false, hasSkillMdTmpl: false, hasProfileYaml: false, hasReadme: false };
      entry.hasProfileYaml = true;
      skillDirs.set(dirPath, entry);
    } else if (fileName.toLowerCase() === "readme.md") {
      const entry = skillDirs.get(dirPath) ?? { hasSkillMd: false, hasSkillMdTmpl: false, hasProfileYaml: false, hasReadme: false };
      entry.hasReadme = true;
      skillDirs.set(dirPath, entry);
    }
  }

  // For each skill dir, fetch just the first 500 bytes of SKILL.md to get frontmatter
  const skills: DiscoveredSkill[] = [];

  const fetchPromises = Array.from(skillDirs.entries()).map(
    async ([dirPath, info]) => {
      if (!info.hasSkillMd && !info.hasSkillMdTmpl) return null;

      const skillFile = info.hasSkillMd ? "SKILL.md" : "SKILL.md.tmpl";
      const fullPath = dirPath ? `${dirPath}/${skillFile}` : skillFile;

      try {
        const content = await getFileContent(owner, repo, fullPath, branch);
        const frontmatter = parseFrontmatter(content);

        const name = dirPath.split("/").pop() ?? (dirPath || repo);
        const format: DiscoveredSkill["format"] = info.hasProfileYaml
          ? "ainative"
          : Object.keys(frontmatter).length > 0
            ? "skillmd-only"
            : "unknown";

        return {
          name: frontmatter.name ?? name,
          path: dirPath,
          format,
          hasProfileYaml: info.hasProfileYaml,
          hasSkillMd: info.hasSkillMd,
          hasSkillMdTmpl: info.hasSkillMdTmpl,
          hasReadme: info.hasReadme,
          description: frontmatter.description ?? "",
          frontmatter,
        } satisfies DiscoveredSkill;
      } catch {
        return null;
      }
    }
  );

  const results = await Promise.all(fetchPromises);
  for (const skill of results) {
    if (skill) skills.push(skill);
  }

  // Fetch repo-level README.md for context
  let repoReadme = "";
  try {
    repoReadme = await getFileContent(owner, repo, "README.md", branch);
  } catch {
    // No README.md — continue without it
  }

  // Sort by path for consistent ordering
  skills.sort((a, b) => a.path.localeCompare(b.path));

  return {
    owner,
    repo,
    branch,
    commitSha,
    discoveredSkills: skills,
    repoReadme,
    scanDurationMs: Date.now() - start,
  };
}

/**
 * Fetch the full SKILL.md and optional profile.yaml content for a specific skill path.
 */
export async function fetchSkillContent(
  owner: string,
  repo: string,
  branch: string,
  skill: DiscoveredSkill
): Promise<{ skillMd: string; profileYaml: string | null; readme: string | null }> {
  const skillFile = skill.hasSkillMd ? "SKILL.md" : "SKILL.md.tmpl";
  const skillPath = skill.path ? `${skill.path}/${skillFile}` : skillFile;

  const skillMd = await getFileContent(owner, repo, skillPath, branch);

  let profileYaml: string | null = null;
  if (skill.hasProfileYaml) {
    const yamlPath = skill.path ? `${skill.path}/profile.yaml` : "profile.yaml";
    try {
      profileYaml = await getFileContent(owner, repo, yamlPath, branch);
    } catch {
      // profile.yaml fetch failed — continue without it
    }
  }

  let readme: string | null = null;
  if (skill.hasReadme) {
    const readmePath = skill.path ? `${skill.path}/README.md` : "README.md";
    try {
      readme = await getFileContent(owner, repo, readmePath, branch);
    } catch {
      // README fetch failed — continue without it
    }
  }

  return { skillMd, profileYaml, readme };
}
