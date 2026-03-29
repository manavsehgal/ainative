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

/** Extra context from README files used to enrich profile metadata. */
export interface ReadmeContext {
  /** Per-skill README.md (if the skill directory has one) */
  skillReadme: string | null;
  /** Repo-level README.md */
  repoReadme: string;
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

/** Common stop words to exclude from tag extraction. */
const TAG_STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "was", "one", "our", "out", "has", "have", "that", "this", "with",
  "from", "they", "been", "will", "each", "make", "like", "into", "them",
  "some", "when", "what", "your", "should", "would", "could", "about",
  "which", "their", "other", "than", "then", "more", "also", "only",
  "must", "does", "here", "just", "over", "such", "after", "before",
  "using", "ensure", "every", "following", "include", "note", "step",
  "always", "never", "check", "first", "output", "input", "file",
  "true", "false", "null", "undefined", "return", "function", "class",
]);

/**
 * Extract a rich description from SKILL.md body content + optional README.
 *
 * Priority:
 * 1. Frontmatter `description` (if multi-word and meaningful)
 * 2. Per-skill README.md first paragraph
 * 3. First meaningful paragraph from SKILL.md body (after frontmatter)
 * 4. Fallback to frontmatter description or name
 */
function extractDescription(
  frontmatter: Record<string, string>,
  skillMdBody: string,
  readmeCtx: ReadmeContext | null,
  skillName: string,
  repoReadmeSkillDesc: string | null,
): string {
  // 1. If frontmatter description is already rich (> 20 chars), use it
  const fmDesc = frontmatter.description ?? "";
  if (fmDesc.length > 20) return fmDesc;

  // 2. Try per-skill README first paragraph
  if (readmeCtx?.skillReadme) {
    const para = extractFirstParagraph(readmeCtx.skillReadme);
    if (para) return para;
  }

  // 3. Try description extracted from repo README (skill-specific section)
  if (repoReadmeSkillDesc) return repoReadmeSkillDesc;

  // 4. Extract from SKILL.md body — first non-heading, non-empty paragraph
  const bodyPara = extractFirstParagraph(skillMdBody);
  if (bodyPara) return bodyPara;

  // 5. Fallback
  return fmDesc || skillName;
}

/** Extract the first meaningful paragraph from markdown (skip headings, lists, code blocks). */
function extractFirstParagraph(md: string): string | null {
  const lines = md.split("\n");
  let inCodeBlock = false;
  const paraLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const trimmed = line.trim();

    // Skip headings, empty lines at start, HR, HTML
    if (trimmed.startsWith("#") || trimmed.startsWith("---") || trimmed.startsWith("<")) {
      if (paraLines.length > 0) break; // end of paragraph
      continue;
    }
    // Skip list items and blockquotes
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("> ") || /^\d+\.\s/.test(trimmed)) {
      if (paraLines.length > 0) break;
      continue;
    }

    if (trimmed === "") {
      if (paraLines.length > 0) break; // end of paragraph
      continue;
    }

    paraLines.push(trimmed);
  }

  const para = paraLines.join(" ").trim();
  // Only use if it's actually descriptive (not too short, not a command)
  if (para.length > 15 && !para.startsWith("```") && !para.startsWith("$")) {
    return para.length > 200 ? para.slice(0, 197) + "..." : para;
  }
  return null;
}

/**
 * Search the repo README for a section or table row that describes a specific skill.
 * Handles formats like:
 * - Table rows: `| skill-name | description |`
 * - List items: `- **skill-name**: description`
 * - Headings: `### skill-name\n description paragraph`
 */
function findSkillInRepoReadme(repoReadme: string, skillName: string): string | null {
  if (!repoReadme) return null;

  const nameL = skillName.toLowerCase();
  const namePat = skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Table row: | name | description | ... or | /name | description |
  const tableMatch = repoReadme.match(
    new RegExp(`\\|\\s*/?${namePat}\\s*\\|\\s*([^|\\n]+)`, "i")
  );
  if (tableMatch) {
    const desc = tableMatch[1].trim();
    if (desc.length > 10) return desc;
  }

  // List item: - **name** — description  or  - **name**: description
  const backtick = "`";
  const listMatch = repoReadme.match(
    new RegExp("[-*]\\s+(?:\\*\\*|" + backtick + ")" + namePat + "(?:\\*\\*|" + backtick + ")\\s*[—:\\-]\\s*(.+)", "i")
  );
  if (listMatch) {
    const desc = listMatch[1].trim();
    if (desc.length > 10) return desc;
  }

  // Section heading: ### name \n paragraph
  const lines = repoReadme.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,4}\s/.test(line) && line.toLowerCase().includes(nameL)) {
      // Grab the next non-empty line as description
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const next = lines[j].trim();
        if (next && !next.startsWith("#") && !next.startsWith("---") && next.length > 15) {
          return next.length > 200 ? next.slice(0, 197) + "..." : next;
        }
      }
    }
  }

  return null;
}

/**
 * Extract semantic tags from SKILL.md body content + README context.
 * Looks at headings, role keywords, domain terms, and tool names.
 */
function extractTags(
  frontmatter: Record<string, string>,
  skillMdBody: string,
  dirName: string,
  readmeCtx: ReadmeContext | null,
): string[] {
  const tags = new Set<string>();
  const text = skillMdBody.toLowerCase();

  // Directory name is always a tag
  if (dirName && dirName.length > 1) tags.add(dirName.toLowerCase());

  // Role/persona keywords found in content
  const rolePatterns: Array<[RegExp, string]> = [
    [/\bcode review/i, "code-review"],
    [/\bsecurity\b/i, "security"],
    [/\bqa\b|\bquality assurance/i, "qa"],
    [/\btesting\b|\btest suite/i, "testing"],
    [/\bdesign\b|\bui\/ux\b|\bfrontend design/i, "design"],
    [/\bdeployment\b|\bci\/cd\b|\binfrastructure/i, "devops"],
    [/\bship\b|\brelease\b|\bchangelog/i, "shipping"],
    [/\bresearch\b|\binvestigat/i, "research"],
    [/\bplanning\b|\barchitect/i, "planning"],
    [/\brefactor/i, "refactoring"],
    [/\bperformance\b|\bbenchmark/i, "performance"],
    [/\baccessibility\b|\ba11y/i, "accessibility"],
    [/\bdocument/i, "documentation"],
    [/\bapi\b/i, "api"],
    [/\bdatabase\b|\bsql\b/i, "database"],
    [/\bbrowser\b|\bplaywright\b|\bpuppeteer/i, "browser"],
    [/\bautomation\b/i, "automation"],
    [/\bworkflow/i, "workflow"],
    [/\blint/i, "linting"],
    [/\bmigrat/i, "migration"],
    [/\bmonitor/i, "monitoring"],
    [/\bdebug/i, "debugging"],
    [/\bowasp\b|\bvulnerabilit/i, "security"],
    [/\bprompt\b|\bllm\b|\bai\b/i, "ai"],
  ];

  for (const [pattern, tag] of rolePatterns) {
    if (pattern.test(text)) tags.add(tag);
  }

  // Extract heading-level topics (## headings become tags)
  const headings = skillMdBody.match(/^#{2,3}\s+(.+)$/gm) ?? [];
  for (const h of headings.slice(0, 5)) {
    const topic = h.replace(/^#+\s+/, "").trim().toLowerCase();
    // Only use short, meaningful heading words as tags
    const words = topic.split(/\s+/).filter(
      (w) => w.length > 3 && w.length < 20 && !TAG_STOP_WORDS.has(w)
    );
    for (const w of words.slice(0, 2)) tags.add(w);
  }

  // Parse allowed-tools from frontmatter (but as capability tags, not raw tool names)
  const tools = frontmatter["allowed-tools"];
  if (tools) {
    const toolList = tools
      .split(/[,\n]/)
      .map((t) => t.replace(/^-\s*/, "").trim().toLowerCase())
      .filter(Boolean);
    if (toolList.includes("bash")) tags.add("cli");
    if (toolList.includes("webfetch") || toolList.includes("websearch")) tags.add("web");
    if (toolList.includes("agent")) tags.add("orchestration");
  }

  // Look for keywords in README context
  if (readmeCtx?.skillReadme) {
    const readmeText = readmeCtx.skillReadme.toLowerCase();
    for (const [pattern, tag] of rolePatterns) {
      if (pattern.test(readmeText)) tags.add(tag);
    }
  }

  return Array.from(tags).slice(0, 12);
}

/** Strip YAML frontmatter from markdown, returning just the body. */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
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
 * Reads SKILL.md body + README context for rich descriptions and tags.
 */
export function adaptSkillMdOnly(
  skill: DiscoveredSkill,
  skillMd: string,
  repoMeta: RepoMeta,
  readmeCtx: ReadmeContext | null = null,
): AdaptedProfile {
  const fm = skill.frontmatter;
  const dirName = skill.path.split("/").pop() ?? skill.name;
  const id = slugify(fm.name ?? dirName);
  const name = fm.name ?? dirName;
  const body = stripFrontmatter(skillMd);

  // Extract rich description from content + README
  const repoReadmeSkillDesc = readmeCtx
    ? findSkillInRepoReadme(readmeCtx.repoReadme, name)
    : null;
  const description = extractDescription(fm, body, readmeCtx, name, repoReadmeSkillDesc);

  // Extract semantic tags from content
  const tags = extractTags(fm, body, dirName, readmeCtx);

  // Inject description into SKILL.md frontmatter so registry picks it up
  const enrichedSkillMd = ensureSkillMdDescription(skillMd, description);

  const config: ProfileConfig = {
    id,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    version: fm.version ?? "1.0.0",
    domain: inferDomain(description, name),
    tags,
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

  return { config, skillMd: enrichedSkillMd, importMeta: config.importMeta! };
}

/**
 * Adapt a Stagent-native format (profile.yaml + SKILL.md) from a remote repo.
 * Enriches tags/description from SKILL.md body + README if the profile.yaml values are weak.
 */
export function adaptStagentNative(
  skill: DiscoveredSkill,
  skillMd: string,
  profileYamlContent: string,
  repoMeta: RepoMeta,
  readmeCtx: ReadmeContext | null = null,
): AdaptedProfile {
  const parsed = yaml.load(profileYamlContent) as Record<string, unknown>;
  const result = ProfileConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Invalid profile.yaml in ${skill.path}: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  const config = result.data;
  const body = stripFrontmatter(skillMd);
  const dirName = skill.path.split("/").pop() ?? skill.name;

  // Enrich tags if the profile has fewer than 3
  if (config.tags.length < 3) {
    const enrichedTags = extractTags(skill.frontmatter, body, dirName, readmeCtx);
    // Merge — keep originals, add new ones
    const merged = new Set([...config.tags, ...enrichedTags]);
    config.tags = Array.from(merged).slice(0, 12);
  }

  // Ensure SKILL.md frontmatter has a rich description
  const repoReadmeSkillDesc = readmeCtx
    ? findSkillInRepoReadme(readmeCtx.repoReadme, config.name)
    : null;
  const richDescription = extractDescription(
    skill.frontmatter, body, readmeCtx, config.name, repoReadmeSkillDesc
  );
  const enrichedSkillMd = ensureSkillMdDescription(skillMd, richDescription);

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

  return { config, skillMd: enrichedSkillMd, importMeta: config.importMeta };
}

/**
 * Ensure SKILL.md has a `description:` in its frontmatter.
 * If frontmatter exists but has no description (or a weak one), inject one.
 * If no frontmatter exists, prepend one with name + description.
 */
function ensureSkillMdDescription(skillMd: string, description: string): string {
  const fmMatch = skillMd.match(/^(---\s*\n)([\s\S]*?)\n(---)/);
  if (!fmMatch) {
    // No frontmatter — prepend one
    const name = description.split(/[.—:,]/, 1)[0].trim().slice(0, 40);
    return `---\nname: ${name}\ndescription: ${description}\n---\n\n${skillMd}`;
  }

  const [fullMatch, open, body, close] = fmMatch;
  const descLine = body.match(/^description:\s*(.*)$/m);

  if (descLine && descLine[1].trim().length > 20) {
    // Already has a rich description — don't touch
    return skillMd;
  }

  if (descLine) {
    // Replace weak description
    const newBody = body.replace(
      /^description:\s*.*$/m,
      `description: ${description}`
    );
    return skillMd.replace(fullMatch, `${open}${newBody}\n${close}`);
  }

  // No description line — add one
  return skillMd.replace(fullMatch, `${open}${body}\ndescription: ${description}\n${close}`);
}

/**
 * Re-extract description and tags for an already-imported profile during update.
 * Used by apply-updates to refresh metadata when upstream SKILL.md changes.
 */
export function enrichProfileFromContent(
  skillMd: string,
  currentTags: string[],
  name: string,
  dirName: string,
  readmeCtx: ReadmeContext | null = null,
): { enrichedSkillMd: string; tags: string[]; description: string } {
  const fmMatch = skillMd.match(/^---\s*\n([\s\S]*?)\n---/);
  const fm: Record<string, string> = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (key && value) fm[key] = value;
      }
    }
  }

  const body = stripFrontmatter(skillMd);
  const repoReadmeSkillDesc = readmeCtx
    ? findSkillInRepoReadme(readmeCtx.repoReadme, name)
    : null;
  const description = extractDescription(fm, body, readmeCtx, name, repoReadmeSkillDesc);
  const newTags = extractTags(fm, body, dirName, readmeCtx);
  const mergedTags = Array.from(new Set([...currentTags, ...newTags])).slice(0, 12);
  const enrichedSkillMd = ensureSkillMdDescription(skillMd, description);

  return { enrichedSkillMd, tags: mergedTags, description };
}
