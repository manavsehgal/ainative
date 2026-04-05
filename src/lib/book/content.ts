import type { Book, BookChapter, BookPart } from "./types";
import { CHAPTER_SLUGS } from "./chapter-mapping";

/** The four parts of the AI Native book */
export const PARTS: BookPart[] = [
  {
    number: 1,
    title: "The Thesis",
    description: "Why AI-Native? — from hierarchy to intelligence",
  },
  {
    number: 2,
    title: "The Factory Floor",
    description: "Building Blocks — the stations of an AI-native system",
  },
  {
    number: 3,
    title: "The Intelligence Layer",
    description: "What Makes It Learn — memory, coordination, and trust",
  },
  {
    number: 4,
    title: "The Autonomous Organization",
    description: "The Vision — world models, self-building, and the road ahead",
  },
];

/**
 * Chapter metadata stubs — content is loaded from docs/book/*.md at runtime.
 * These stubs provide the chapter list for navigation and iteration.
 * Sections are populated by tryLoadMarkdownChapter().
 */
export const CHAPTERS: BookChapter[] = [
  // Part 1: The Thesis
  {
    id: "ch-1",
    number: 1,
    title: "From Hierarchy to Intelligence",
    subtitle: "The 2,000-Year Problem and Why It's Finally Solvable",
    part: PARTS[0],
    readingTime: 14,
    sections: [],
  },
  {
    id: "ch-2",
    number: 2,
    title: "The AI-Native Blueprint",
    subtitle: "Anatomy of the Factory",
    part: PARTS[0],
    readingTime: 12,
    relatedDocs: ["home-workspace", "dashboard-kanban"],
    sections: [],
  },
  // Part 2: The Factory Floor
  {
    id: "ch-3",
    number: 3,
    title: "The Refinery",
    subtitle: "From Intent to Structured Work",
    part: PARTS[1],
    readingTime: 15,
    relatedDocs: ["projects", "documents", "home-workspace"],
    relatedJourney: "personal-use",
    sections: [],
  },
  {
    id: "ch-4",
    number: 4,
    title: "The Forge",
    subtitle: "Task Execution at Scale",
    part: PARTS[1],
    readingTime: 16,
    relatedDocs: ["agent-intelligence", "profiles", "monitoring"],
    relatedJourney: "work-use",
    sections: [],
  },
  {
    id: "ch-5",
    number: 5,
    title: "Blueprints",
    subtitle: "Workflow Orchestration",
    part: PARTS[1],
    readingTime: 14,
    relatedDocs: ["workflows", "agent-intelligence"],
    relatedJourney: "power-user",
    sections: [],
  },
  {
    id: "ch-6",
    number: 6,
    title: "The Arena",
    subtitle: "Scheduled Intelligence",
    part: PARTS[1],
    readingTime: 12,
    relatedDocs: ["schedules", "monitoring"],
    sections: [],
  },
  // Part 3: The Intelligence Layer
  {
    id: "ch-7",
    number: 7,
    title: "Institutional Memory",
    subtitle: "The Knowledge Graph",
    part: PARTS[2],
    readingTime: 14,
    relatedDocs: ["agent-intelligence", "profiles"],
    relatedJourney: "developer",
    sections: [],
  },
  {
    id: "ch-8",
    number: 8,
    title: "The Swarm",
    subtitle: "Multi-Agent Coordination",
    part: PARTS[2],
    readingTime: 16,
    relatedDocs: ["profiles", "agent-intelligence"],
    sections: [],
  },
  {
    id: "ch-9",
    number: 9,
    title: "The Governance Layer",
    subtitle: "Trust at Scale",
    part: PARTS[2],
    readingTime: 13,
    relatedDocs: ["inbox-notifications", "tool-permissions", "settings"],
    sections: [],
  },
  // Part 4: The Autonomous Organization
  {
    id: "ch-10",
    number: 10,
    title: "The World Model",
    subtitle: "From Project State to Organizational Intelligence",
    part: PARTS[3],
    readingTime: 15,
    relatedDocs: ["workflows", "profiles", "schedules"],
    sections: [],
  },
  {
    id: "ch-11",
    number: 11,
    title: "The Machine That Builds Machines",
    subtitle: "Stagent Building Itself Using Itself",
    part: PARTS[3],
    readingTime: 14,
    sections: [],
  },
  {
    id: "ch-12",
    number: 12,
    title: "The Road Ahead",
    subtitle: "What the Case Studies Tell Us About the Future",
    part: PARTS[3],
    readingTime: 10,
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
    const fileSlug = CHAPTER_SLUGS[id];
    if (!fileSlug) return null;

    // Dynamic require to avoid bundling fs in client builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path") as typeof import("path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseMarkdownChapter } = require("./markdown-parser") as { parseMarkdownChapter: (md: string, slug: string) => { sections: Array<{ id: string; title: string; content: import("./types").ContentBlock[] }> } };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAppRoot } = require("../utils/app-root") as { getAppRoot: (metaDirname: string | undefined, depth: number) => string };
    const appRoot = getAppRoot(import.meta.dirname, 3);
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
