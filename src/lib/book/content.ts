import type { Book, BookChapter, BookPart } from "./types";

/** Mapping from chapter ID to markdown filename slug (without ch-N- prefix) */
const CHAPTER_SLUG_MAP: Record<string, string> = {
  "ch-1": "ch-1-project-management",
  "ch-2": "ch-2-task-execution",
  "ch-3": "ch-3-document-processing",
  "ch-4": "ch-4-workflow-orchestration",
  "ch-5": "ch-5-scheduled-intelligence",
  "ch-6": "ch-6-agent-self-improvement",
  "ch-7": "ch-7-multi-agent-swarms",
  "ch-8": "ch-8-human-in-the-loop",
  "ch-9": "ch-9-the-autonomous-organization",
};

/** The three parts of the AI Native book */
export const PARTS: BookPart[] = [
  {
    number: 1,
    title: "Foundation",
    description: "Operations — from manual processes to AI-assisted automation",
  },
  {
    number: 2,
    title: "Intelligence",
    description: "Workflows & Learning — adaptive systems that improve over time",
  },
  {
    number: 3,
    title: "Autonomy",
    description: "Advanced Patterns — fully delegated business processes",
  },
];

/**
 * Chapter metadata stubs — content is loaded from docs/book/*.md at runtime.
 * These stubs provide the chapter list for navigation and iteration.
 * Sections are populated by tryLoadMarkdownChapter().
 */
export const CHAPTERS: BookChapter[] = [
  {
    id: "ch-1",
    number: 1,
    title: "Project Management",
    subtitle: "From Manual Planning to Autonomous Sprint Planning",
    part: PARTS[0],
    readingTime: 12,
    relatedDocs: ["projects", "home-workspace", "dashboard-kanban"],
    relatedJourney: "personal-use",
    sections: [],
  },
  {
    id: "ch-2",
    number: 2,
    title: "Task Execution",
    subtitle: "Single-Agent to Multi-Agent Task Orchestration",
    part: PARTS[0],
    readingTime: 15,
    relatedDocs: ["agent-intelligence", "profiles", "monitoring"],
    relatedJourney: "work-use",
    sections: [],
  },
  {
    id: "ch-3",
    number: 3,
    title: "Document Processing",
    subtitle: "Unstructured Input to Structured Knowledge",
    part: PARTS[0],
    readingTime: 14,
    relatedDocs: ["documents", "shared-components"],
    sections: [],
  },
  {
    id: "ch-4",
    number: 4,
    title: "Workflow Orchestration",
    subtitle: "From Linear Sequences to Adaptive Blueprints",
    part: PARTS[1],
    readingTime: 14,
    relatedDocs: ["workflows", "agent-intelligence"],
    relatedJourney: "power-user",
    sections: [],
  },
  {
    id: "ch-5",
    number: 5,
    title: "Scheduled Intelligence",
    subtitle: "Time-Based Automation and Recurring Intelligence Loops",
    part: PARTS[1],
    readingTime: 11,
    relatedDocs: ["schedules", "monitoring"],
    sections: [],
  },
  {
    id: "ch-6",
    number: 6,
    title: "Agent Self-Improvement",
    subtitle: "Learning from Execution Logs and Feedback",
    part: PARTS[1],
    readingTime: 13,
    relatedDocs: ["agent-intelligence", "profiles"],
    relatedJourney: "developer",
    sections: [],
  },
  {
    id: "ch-7",
    number: 7,
    title: "Multi-Agent Swarms",
    subtitle: "Parallel Execution, Consensus, and Specialization",
    part: PARTS[2],
    readingTime: 16,
    relatedDocs: ["profiles", "agent-intelligence"],
    sections: [],
  },
  {
    id: "ch-8",
    number: 8,
    title: "Human-in-the-Loop",
    subtitle: "Permission Systems and Graceful Escalation",
    part: PARTS[2],
    readingTime: 12,
    relatedDocs: ["inbox-notifications", "tool-permissions", "settings"],
    sections: [],
  },
  {
    id: "ch-9",
    number: 9,
    title: "The Autonomous Organization",
    subtitle: "Fully Delegated Business Processes",
    part: PARTS[2],
    readingTime: 18,
    relatedDocs: ["workflows", "profiles", "schedules"],
    sections: [],
  },
];

/**
 * Try to load a chapter from its markdown file in book/chapters/.
 * Only works server-side (where fs is available). Returns null on client.
 */
function tryLoadMarkdownChapter(id: string): BookChapter | null {
  // Only attempt markdown loading on the server
  if (typeof window !== "undefined") return null;

  try {
    const fileSlug = CHAPTER_SLUG_MAP[id];
    if (!fileSlug) return null;

    // Dynamic require to avoid bundling fs in client builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path") as typeof import("path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseMarkdownChapter } = require("./markdown-parser") as { parseMarkdownChapter: (md: string, slug: string) => { sections: Array<{ id: string; title: string; content: import("./types").ContentBlock[] }> } };

    // Resolve relative to source file, not cwd (npx-safe)
    const appRoot = join(import.meta.dirname ?? __dirname, "..", "..", "..");
    const filePath = join(appRoot, "book", "chapters", `${fileSlug}.md`);
    if (!existsSync(filePath)) return null;

    const content = readFileSync(filePath, "utf-8");

    // Parse frontmatter
    const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const fmMatch = content.match(fmRegex);
    const fmBlock = fmMatch ? fmMatch[1] : "";
    const body = fmMatch ? fmMatch[2] : content;

    const fm: Record<string, unknown> = {};
    for (const line of fmBlock.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      let value: unknown = line.slice(colonIdx + 1).trim();
      if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        try { value = JSON.parse(value); } catch {
          value = (value as string).slice(1, -1).split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      }
      fm[key] = value;
    }
    const chapterNum = Number(fm.chapter) || 0;
    const partNum = Number(fm.part) || 1;
    const part = PARTS[partNum - 1] || PARTS[0];

    const { sections } = parseMarkdownChapter(body, id);

    const relatedDocs = Array.isArray(fm.relatedDocs)
      ? (fm.relatedDocs as string[])
      : typeof fm.relatedDocs === "string"
        ? [fm.relatedDocs]
        : [];

    const chapter: BookChapter = {
      id,
      number: chapterNum,
      title: (fm.title as string) || "",
      subtitle: (fm.subtitle as string) || "",
      part,
      sections,
      readingTime: Number(fm.readingTime) || 0,
    };

    if (relatedDocs.length > 0) chapter.relatedDocs = relatedDocs;
    if (fm.relatedJourney && fm.relatedJourney !== "null") {
      chapter.relatedJourney = fm.relatedJourney as string;
    }

    return chapter;
  } catch {
    return null;
  }
}

/** Get the full book object */
export function getBook(): Book {
  const chapters = CHAPTERS.map((ch) => {
    const md = tryLoadMarkdownChapter(ch.id);
    return md || ch;
  });

  return {
    title: "AI Native",
    subtitle: "Building Autonomous Business Systems with AI Agents",
    description:
      "A practical guide to building AI-native applications, from single-agent task execution to fully autonomous business processes. Every pattern is demonstrated with working code from Stagent — a tool that built itself.",
    parts: PARTS,
    chapters,
    totalReadingTime: chapters.reduce((sum, ch) => sum + ch.readingTime, 0),
  };
}

/** Get a chapter by its ID */
export function getChapter(id: string): BookChapter | undefined {
  const mdChapter = tryLoadMarkdownChapter(id);
  if (mdChapter) return mdChapter;
  return CHAPTERS.find((ch) => ch.id === id);
}

/** Get chapters grouped by part */
export function getChaptersByPart(): Map<number, BookChapter[]> {
  const grouped = new Map<number, BookChapter[]>();
  for (const ch of CHAPTERS) {
    const part = ch.part.number;
    if (!grouped.has(part)) grouped.set(part, []);
    grouped.get(part)!.push(ch);
  }
  return grouped;
}
