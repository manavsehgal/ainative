/**
 * Converts non-Stagent skill formats into valid ProfileConfig + SKILL.md pairs.
 * Handles gstack-style SKILL.md-with-frontmatter → profile.yaml generation.
 */

import { createHash } from "node:crypto";
import yaml from "js-yaml";
import { ProfileConfigSchema, type ProfileConfig } from "@/lib/validators/profile";
import type { ImportMeta } from "@/lib/validators/profile";
import type { DiscoveredSkill } from "./repo-scanner";

export interface AdaptedProfile {
  config: ProfileConfig;
  skillMd: string;
  importMeta: ImportMeta;
}

interface RepoMeta {
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
}

/** Slugify a name to a valid profile ID. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Infer domain from description/name keywords. */
function inferDomain(description: string, name: string): "work" | "personal" {
  const text = `${description} ${name}`.toLowerCase();
  const personalKeywords = [
    "personal", "health", "fitness", "travel", "shopping",
    "nutrition", "workout", "hobby", "recipe", "meditation",
  ];
  return personalKeywords.some((kw) => text.includes(kw)) ? "personal" : "work";
}

/** Infer tags from frontmatter and directory name. */
function inferTags(frontmatter: Record<string, string>, dirName: string): string[] {
  const tags = new Set<string>();

  // Add directory name as a tag
  if (dirName) tags.add(dirName.toLowerCase());

  // Parse allowed-tools as tags
  const tools = frontmatter["allowed-tools"];
  if (tools) {
    for (const tool of tools.split(/[,\n]/).map((t) => t.replace(/^-\s*/, "").trim()).filter(Boolean)) {
      tags.add(tool.toLowerCase());
    }
  }

  // Add description keywords that look useful
  const desc = frontmatter.description ?? "";
  const kws = desc
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && w.length < 20)
    .slice(0, 5);
  for (const kw of kws) tags.add(kw);

  return Array.from(tags).slice(0, 10);
}

/** Parse allowed-tools from frontmatter (comma-separated, YAML array, or newline-separated). */
function parseAllowedTools(frontmatter: Record<string, string>): string[] | undefined {
  const raw = frontmatter["allowed-tools"];
  if (!raw) return undefined;

  const tools = raw
    .split(/[,\n]/)
    .map((t) => t.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  return tools.length > 0 ? tools : undefined;
}

/** Compute SHA-256 content hash. */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Adapt a SKILL.md-only format (e.g., gstack) into a Stagent ProfileConfig.
 */
export function adaptSkillMdOnly(
  skill: DiscoveredSkill,
  skillMd: string,
  repoMeta: RepoMeta
): AdaptedProfile {
  const fm = skill.frontmatter;
  const dirName = skill.path.split("/").pop() ?? skill.name;
  const id = slugify(fm.name ?? dirName);
  const name = fm.name ?? dirName;

  const config: ProfileConfig = {
    id,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    version: fm.version ?? "1.0.0",
    domain: inferDomain(fm.description ?? "", name),
    tags: inferTags(fm, dirName),
    allowedTools: parseAllowedTools(fm),
    author: repoMeta.owner,
    source: `https://github.com/${repoMeta.owner}/${repoMeta.repo}/tree/${repoMeta.branch}/${skill.path}`,
    importMeta: {
      repoUrl: repoMeta.repoUrl,
      repoOwner: repoMeta.owner,
      repoName: repoMeta.repo,
      branch: repoMeta.branch,
      filePath: skill.path,
      commitSha: repoMeta.commitSha,
      contentHash: contentHash(skillMd),
      importedAt: new Date().toISOString(),
      sourceFormat: "skillmd-only",
    },
  };

  return { config, skillMd, importMeta: config.importMeta! };
}

/**
 * Adapt a Stagent-native format (profile.yaml + SKILL.md) from a remote repo.
 */
export function adaptStagentNative(
  skill: DiscoveredSkill,
  skillMd: string,
  profileYamlContent: string,
  repoMeta: RepoMeta
): AdaptedProfile {
  const parsed = yaml.load(profileYamlContent) as Record<string, unknown>;
  const result = ProfileConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Invalid profile.yaml in ${skill.path}: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  const config = result.data;

  // Inject importMeta
  config.importMeta = {
    repoUrl: repoMeta.repoUrl,
    repoOwner: repoMeta.owner,
    repoName: repoMeta.repo,
    branch: repoMeta.branch,
    filePath: skill.path,
    commitSha: repoMeta.commitSha,
    contentHash: contentHash(skillMd),
    importedAt: new Date().toISOString(),
    sourceFormat: "stagent",
  };

  // Set source URL if not already set
  if (!config.source) {
    config.source = `https://github.com/${repoMeta.owner}/${repoMeta.repo}/tree/${repoMeta.branch}/${skill.path}`;
  }

  // Set author if not already set
  if (!config.author) {
    config.author = repoMeta.owner;
  }

  return { config, skillMd, importMeta: config.importMeta };
}
