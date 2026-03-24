/** Maps book chapters to Playbook feature docs and journeys */

interface ChapterMapping {
  docs: string[];
  journey?: string;
  /** Source code files this chapter references (for staleness detection) */
  sourceFiles?: string[];
}

/**
 * Static mapping from chapter IDs to related Playbook content.
 * Doc slugs correspond to files in docs/features/.
 * Journey slugs correspond to files in docs/journeys/.
 */
export const CHAPTER_MAPPING: Record<string, ChapterMapping> = {
  "ch-1": {
    docs: ["projects", "home-workspace", "dashboard-kanban"],
    journey: "personal-use",
    sourceFiles: ["src/lib/db/schema.ts", "src/lib/agents/profiles/general.ts"],
  },
  "ch-2": {
    docs: ["agent-intelligence", "profiles", "monitoring"],
    journey: "work-use",
    sourceFiles: ["src/lib/agents/profiles/registry.ts", "src/lib/agents/execution-manager.ts"],
  },
  "ch-3": {
    docs: ["documents", "shared-components"],
    sourceFiles: ["src/lib/documents/processor.ts", "src/lib/documents/registry.ts", "src/lib/documents/context-builder.ts"],
  },
  "ch-4": {
    docs: ["workflows", "agent-intelligence"],
    journey: "power-user",
    sourceFiles: ["src/lib/workflows/engine.ts", "src/lib/workflows/types.ts"],
  },
  "ch-5": {
    docs: ["schedules", "monitoring"],
    sourceFiles: ["src/lib/schedules/scheduler.ts", "src/lib/schedules/interval-parser.ts"],
  },
  "ch-6": {
    docs: ["agent-intelligence", "profiles"],
    journey: "developer",
    sourceFiles: ["src/lib/db/schema.ts", "src/lib/agents/profiles/"],
  },
  "ch-7": {
    docs: ["profiles", "agent-intelligence"],
    sourceFiles: ["src/lib/agents/profiles/"],
  },
  "ch-8": {
    docs: ["inbox-notifications", "tool-permissions", "settings"],
    sourceFiles: ["src/lib/agents/claude-agent.ts", "src/lib/data/notifications.ts"],
  },
  "ch-9": {
    docs: ["workflows", "profiles", "schedules"],
    sourceFiles: ["src/lib/workflows/engine.ts", "src/lib/schedules/scheduler.ts"],
  },
};

/** Get related Playbook doc slugs for a chapter */
export function getRelatedDocs(chapterId: string): string[] {
  return CHAPTER_MAPPING[chapterId]?.docs ?? [];
}

/** Get related journey slug for a chapter */
export function getRelatedJourney(chapterId: string): string | undefined {
  return CHAPTER_MAPPING[chapterId]?.journey;
}

/** Get source code files for a chapter (for staleness detection) */
export function getSourceFiles(chapterId: string): string[] {
  return CHAPTER_MAPPING[chapterId]?.sourceFiles ?? [];
}

/** Reverse lookup: find which chapter a Playbook doc belongs to */
export function getChapterForDoc(docSlug: string): string | undefined {
  for (const [chapterId, mapping] of Object.entries(CHAPTER_MAPPING)) {
    if (mapping.docs.includes(docSlug)) {
      return chapterId;
    }
  }
  return undefined;
}

/** Reverse lookup: find which chapter a journey belongs to */
export function getChapterForJourney(journeySlug: string): string | undefined {
  for (const [chapterId, mapping] of Object.entries(CHAPTER_MAPPING)) {
    if (mapping.journey === journeySlug) {
      return chapterId;
    }
  }
  return undefined;
}
