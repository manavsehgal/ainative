import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { CHAPTER_MAPPING } from "./chapter-mapping";

export interface ChapterStaleness {
  chapterId: string;
  /** ISO timestamp from frontmatter, or null if never generated */
  lastGenerated: string | null;
  /** ISO timestamp of most recent source file change */
  latestSourceChange: string | null;
  /** Whether the chapter needs regeneration */
  isStale: boolean;
  /** Source files that changed since last generation */
  changedFiles: string[];
}

/** Chapter ID to markdown filename mapping */
const CHAPTER_SLUGS: Record<string, string> = {
  "ch-1": "ch-1-project-management",
  "ch-2": "ch-2-task-execution",
  "ch-3": "ch-3-document-processing",
  "ch-4": "ch-4-workflow-orchestration",
  "ch-5": "ch-5-scheduled-intelligence",
  "ch-6": "ch-6-agent-self-improvement",
  "ch-7": "ch-7-multi-agent-swarms",
  "ch-8": "ch-8-human-in-the-loop",
  "ch-9": "ch-9-autonomous-organization",
};

/** Read the lastGeneratedBy timestamp from a chapter's markdown frontmatter */
function getLastGenerated(chapterId: string): string | null {
  const slug = CHAPTER_SLUGS[chapterId];
  if (!slug) return null;

  const mdPath = join(process.cwd(), "book", "chapters", `${slug}.md`);
  if (!existsSync(mdPath)) return null;

  const content = readFileSync(mdPath, "utf-8");
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const lastGenLine = fmMatch[1]
    .split("\n")
    .find((line) => line.startsWith("lastGeneratedBy:"));
  if (!lastGenLine) return null;

  const value = lastGenLine.slice("lastGeneratedBy:".length).trim();
  if (value === "null" || value === "") return null;

  return value.replace(/^["']|["']$/g, "");
}

/** Get the most recent commit timestamp for a set of files using execFileSync (safe) */
function getLatestChangeTimestamp(files: string[]): string | null {
  if (files.length === 0) return null;

  try {
    const result = execFileSync(
      "git",
      ["log", "-1", "--format=%aI", "--", ...files],
      { encoding: "utf-8", timeout: 10_000 }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

/** Get files changed since a given timestamp */
function getChangedFilesSince(
  timestamp: string,
  sourceFiles: string[]
): string[] {
  if (sourceFiles.length === 0) return [];

  try {
    const result = execFileSync(
      "git",
      ["log", `--since=${timestamp}`, "--name-only", "--pretty=format:", "--", ...sourceFiles],
      { encoding: "utf-8", timeout: 10_000 }
    ).trim();
    if (!result) return [];
    return [...new Set(result.split("\n").filter(Boolean))];
  } catch {
    return [];
  }
}

/** Check if git is available in the current directory */
function isGitAvailable(): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      encoding: "utf-8",
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which chapters are stale by comparing git log timestamps
 * against chapter lastGeneratedBy metadata.
 */
export function detectStaleChapters(): ChapterStaleness[] {
  const gitAvailable = isGitAvailable();
  const results: ChapterStaleness[] = [];

  for (const chapterId of Object.keys(CHAPTER_SLUGS)) {
    const mapping = CHAPTER_MAPPING[chapterId];
    const sourceFiles = mapping?.docs?.map((d) => `docs/features/${d}.md`) ?? [];
    const lastGenerated = getLastGenerated(chapterId);

    if (!gitAvailable) {
      results.push({
        chapterId,
        lastGenerated,
        latestSourceChange: null,
        isStale: false,
        changedFiles: [],
      });
      continue;
    }

    const latestSourceChange = getLatestChangeTimestamp(sourceFiles);

    let isStale = false;
    let changedFiles: string[] = [];

    if (!lastGenerated) {
      isStale = sourceFiles.length > 0;
    } else if (latestSourceChange) {
      isStale = new Date(latestSourceChange) > new Date(lastGenerated);
      if (isStale) {
        changedFiles = getChangedFilesSince(lastGenerated, sourceFiles);
      }
    }

    results.push({
      chapterId,
      lastGenerated,
      latestSourceChange,
      isStale,
      changedFiles,
    });
  }

  return results;
}

/** Get staleness for a single chapter */
export function getChapterStaleness(chapterId: string): ChapterStaleness | null {
  const all = detectStaleChapters();
  return all.find((s) => s.chapterId === chapterId) ?? null;
}
