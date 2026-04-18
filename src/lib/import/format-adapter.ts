/**
 * Converts non-ainative skill formats into valid ProfileConfig + SKILL.md pairs.
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

/**
 * Patterns that indicate a paragraph is AI instruction text, not a human-readable description.
 * These are common across skill repos (not specific to any one repo).
 */
const INSTRUCTION_PATTERNS = [
  /^you are\b/i,
  /^you must\b/i,
  /^you should\b/i,
  /^you will\b/i,
  /^your (?:role|job|task|goal)\b/i,
  /^run the\b/i,
  /^execute\b/i,
  /^always\b/i,
  /^never\b/i,
  /^when the user\b/i,
  /^when asked\b/i,
  /^this skill\b/i,
  /^this tool\b/i,
  /^this agent\b/i,
  /^if the user\b/i,
  /^before (?:you|running|starting)\b/i,
  /^after (?:you|running|completing)\b/i,
  /^do not\b/i,
  /^don't\b/i,
  /^make sure\b/i,
  /^important:/i,
  /^note:/i,
  /^⚠/,
  /^warning/i,
  /^todo/i,
];

/** Check if a paragraph looks like AI skill instructions rather than a description. */
function isInstructionText(text: string): boolean {
  // Check against known instruction patterns
  if (INSTRUCTION_PATTERNS.some((p) => p.test(text))) return true;

  // Heavy use of second-person "you" suggests instruction text
  const youCount = (text.match(/\byou\b/gi) ?? []).length;
  const wordCount = text.split(/\s+/).length;
  if (youCount >= 3 || (wordCount > 0 && youCount / wordCount > 0.08)) return true;

  // References to tool names suggest internal skill instructions
  const toolRefs = /\b(Bash|Read|Write|Edit|Glob|Grep|WebFetch|WebSearch|Agent|AskUserQuestion)\b/;
  if (toolRefs.test(text)) return true;

  return false;
}

/**
 * Extract the first meaningful, non-instruction paragraph from markdown.
 * Skips headings, lists, code blocks, HTML comments, and AI instruction text.
 */
function extractFirstParagraph(md: string): string | null {
  const lines = md.split("\n");
  let inCodeBlock = false;
  let inComment = false;

  // Collect candidate paragraphs, return the first non-instruction one
  let paraLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (paraLines.length > 0) { paraLines = []; } // discard partial
      continue;
    }
    if (inCodeBlock) continue;

    const trimmed = line.trim();

    // Skip HTML comments (single-line and multi-line)
    if (trimmed.startsWith("<!--")) {
      if (!trimmed.includes("-->")) inComment = true;
      if (paraLines.length > 0) { paraLines = []; }
      continue;
    }
    if (inComment) {
      if (trimmed.includes("-->")) inComment = false;
      continue;
    }

    // Skip headings, HR, HTML tags
    if (trimmed.startsWith("#") || trimmed.startsWith("---") || trimmed.startsWith("<")) {
      if (paraLines.length > 0) {
        // Try this paragraph
        const candidate = paraLines.join(" ").trim();
        if (isGoodDescription(candidate)) return formatDescription(candidate);
        paraLines = [];
      }
      continue;
    }
    // Skip list items and blockquotes
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("> ") || /^\d+\.\s/.test(trimmed)) {
      if (paraLines.length > 0) {
        const candidate = paraLines.join(" ").trim();
        if (isGoodDescription(candidate)) return formatDescription(candidate);
        paraLines = [];
      }
      continue;
    }

    if (trimmed === "") {
      if (paraLines.length > 0) {
        const candidate = paraLines.join(" ").trim();
        if (isGoodDescription(candidate)) return formatDescription(candidate);
        paraLines = [];
      }
      continue;
    }

    paraLines.push(trimmed);
  }

  // Check final paragraph
  if (paraLines.length > 0) {
    const candidate = paraLines.join(" ").trim();
    if (isGoodDescription(candidate)) return formatDescription(candidate);
  }

  return null;
}

/** Check if text is a good human-readable description (not instruction text). */
function isGoodDescription(text: string): boolean {
  if (text.length < 15) return false;
  if (text.startsWith("```") || text.startsWith("$")) return false;
  if (isInstructionText(text)) return false;
  return true;
}

/** Trim description to max length. */
function formatDescription(text: string): string {
  return text.length > 200 ? text.slice(0, 197) + "..." : text;
}

/** Strip markdown inline formatting: **bold**, *italic*, `code`, [links](url) */
function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")  // **bold**
    .replace(/\*(.+?)\*/g, "$1")       // *italic*
    .replace(/`(.+?)`/g, "$1")         // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [text](url)
    .trim();
}

/**
 * Search the repo README for a section or table row that describes a specific skill.
 * Generalized for any repo format:
 * - N-column tables: `| /name | role | description |` or `| name | description |`
 * - List items: `- **name**: description` or `- \`name\` — description`
 * - Headings: `### name\n description paragraph`
 */
function findSkillInRepoReadme(repoReadme: string, skillName: string): string | null {
  if (!repoReadme) return null;

  const nameL = skillName.toLowerCase();
  const namePat = skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Strategy 1: Table rows — find any row where a cell matches the skill name,
  // then take the LAST non-name cell as the description (works for 2, 3, or N columns).
  const tableLines = repoReadme.split("\n").filter((l) => l.trim().startsWith("|"));
  for (const line of tableLines) {
    // Skip separator rows (| --- | --- |)
    if (/^\|[\s-:|]+\|$/.test(line.trim())) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    // Check if any cell contains the skill name (with or without / prefix)
    const nameCell = cells.findIndex((c) => {
      const stripped = stripMarkdownFormatting(c).replace(/^\//, "").toLowerCase();
      return stripped === nameL || stripped === namePat.toLowerCase();
    });

    if (nameCell >= 0 && cells.length > nameCell + 1) {
      // Take the last cell as description (skip the name cell and any role/middle cells)
      const descCell = stripMarkdownFormatting(cells[cells.length - 1]);
      // But if the last cell IS the name cell, try the one before it
      const desc = nameCell === cells.length - 1
        ? stripMarkdownFormatting(cells[Math.max(0, cells.length - 2)])
        : descCell;

      if (desc.length > 10 && desc.toLowerCase() !== nameL) {
        return formatDescription(desc);
      }
    }
  }

  // Strategy 2: List items — `- **name** — desc` or `- \`name\`: desc` etc.
  const backtick = "`";
  const listPatterns = [
    // - **name** — description  or  - **name**: description
    new RegExp("[-*]\\s+\\*\\*/?\\s*" + namePat + "\\s*\\*\\*\\s*[—:\\-–|]\\s*(.+)", "i"),
    // - `name` — description  or  - `/name`: description
    new RegExp("[-*]\\s+" + backtick + "/?" + namePat + backtick + "\\s*[—:\\-–|]\\s*(.+)", "i"),
    // - name: description (plain)
    new RegExp("[-*]\\s+/?" + namePat + "\\s*[—:\\-–]\\s*(.+)", "i"),
  ];

  for (const pattern of listPatterns) {
    const match = repoReadme.match(pattern);
    if (match) {
      const desc = stripMarkdownFormatting(match[1].trim());
      if (desc.length > 10) return formatDescription(desc);
    }
  }

  // Strategy 3: Section heading containing the skill name, then next paragraph
  const lines = repoReadme.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,4}\s/.test(line)) {
      const headingText = line.replace(/^#+\s+/, "").toLowerCase();
      // Check if heading matches skill name (exact word, not substring of a longer word)
      const headingWords = headingText.split(/[\s/]+/);
      if (!headingWords.includes(nameL) && !headingText.includes(`/${nameL}`)) continue;

      // Grab the next non-empty, non-heading line as description
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const next = lines[j].trim();
        if (!next || next.startsWith("#") || next.startsWith("---") || next.startsWith("|")) continue;
        if (next.length > 15) {
          return formatDescription(stripMarkdownFormatting(next));
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
 * Adapt a SKILL.md-only format (e.g., gstack) into a ainative ProfileConfig.
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
 * Adapt a ainative-native format (profile.yaml + SKILL.md) from a remote repo.
 * Enriches tags/description from SKILL.md body + README if the profile.yaml values are weak.
 */
export function adaptAinativeNative(
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
    sourceFormat: "ainative",
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
