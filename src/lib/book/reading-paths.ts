import type { UsageStage } from "@/lib/docs/types";

export interface ReadingPath {
  id: string;
  name: string;
  description: string;
  persona: string;
  chapterIds: string[];
  usageStage: UsageStage;
}

export const READING_PATHS: ReadingPath[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    description: "The thesis and first building blocks — understand why AI-native matters",
    persona: "new",
    chapterIds: ["ch-1", "ch-2", "ch-3", "ch-4"],
    usageStage: "new",
  },
  {
    id: "team-lead",
    name: "Team Lead",
    description: "Workflows, scheduling, and governance — orchestrate your team's AI",
    persona: "work",
    chapterIds: ["ch-1", "ch-5", "ch-6", "ch-9", "ch-10"],
    usageStage: "early",
  },
  {
    id: "power-user",
    name: "Power User",
    description: "Deep dive into the intelligence layer — memory, swarms, and world models",
    persona: "active",
    chapterIds: ["ch-5", "ch-6", "ch-7", "ch-8", "ch-9", "ch-10"],
    usageStage: "active",
  },
  {
    id: "developer",
    name: "Developer",
    description: "The complete journey — every chapter, thesis to roadmap",
    persona: "developer",
    chapterIds: ["ch-1", "ch-2", "ch-3", "ch-4", "ch-5", "ch-6", "ch-7", "ch-8", "ch-9", "ch-10", "ch-11", "ch-12"],
    usageStage: "power",
  },
];

/** Recommend a reading path based on the user's usage stage */
export function recommendPath(stage: UsageStage): string {
  switch (stage) {
    case "new":
      return "getting-started";
    case "early":
      return "team-lead";
    case "active":
      return "power-user";
    case "power":
      return "developer";
    default:
      return "getting-started";
  }
}

/** Get a reading path by ID */
export function getReadingPath(id: string): ReadingPath | undefined {
  return READING_PATHS.find((p) => p.id === id);
}

/** Get the next chapter ID in a path after the current one, or null if at end */
export function getNextPathChapter(pathId: string, currentChapterId: string): string | null {
  const path = getReadingPath(pathId);
  if (!path) return null;
  const idx = path.chapterIds.indexOf(currentChapterId);
  if (idx === -1 || idx >= path.chapterIds.length - 1) return null;
  return path.chapterIds[idx + 1];
}

/** Check if a chapter is part of a reading path */
export function isChapterInPath(pathId: string, chapterId: string): boolean {
  const path = getReadingPath(pathId);
  if (!path) return false;
  return path.chapterIds.includes(chapterId);
}
