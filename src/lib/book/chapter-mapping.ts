/** Maps book chapters to Playbook feature docs, journeys, and case studies */

/**
 * Single source of truth: chapter ID → markdown filename slug.
 * Used by content loader, chapter generator, and update detector.
 * Slug corresponds to files in book/chapters/ (without .md extension).
 */
export const CHAPTER_SLUGS: Record<string, string> = {
  "ch-1": "ch-1-from-hierarchy-to-intelligence",
  "ch-2": "ch-2-the-ai-native-blueprint",
  "ch-3": "ch-3-the-refinery",
  "ch-4": "ch-4-the-forge",
  "ch-5": "ch-5-blueprints",
  "ch-6": "ch-6-the-arena",
  "ch-7": "ch-7-institutional-memory",
  "ch-8": "ch-8-the-swarm",
  "ch-9": "ch-9-the-governance-layer",
  "ch-10": "ch-10-the-world-model",
  "ch-11": "ch-11-the-machine-that-builds-machines",
  "ch-12": "ch-12-the-road-ahead",
};

interface ChapterMapping {
  docs: string[];
  journey?: string;
  /** Source code files this chapter references (for staleness detection) */
  sourceFiles?: string[];
  /** Case study article slugs from ai-native-notes/ */
  caseStudies?: string[];
}

/**
 * Static mapping from chapter IDs to related Playbook content.
 * Doc slugs correspond to files in docs/features/.
 * Journey slugs correspond to files in docs/journeys/.
 * Case study slugs correspond to files in ai-native-notes/ (without .md extension).
 */
export const CHAPTER_MAPPING: Record<string, ChapterMapping> = {
  "ch-1": {
    docs: [],
    caseStudies: ["sequoa-hierarchy-to-intelligence", "harvey-legal-is-next", "making-machine-that-builds-machines"],
  },
  "ch-2": {
    docs: ["home-workspace", "dashboard-kanban"],
    sourceFiles: ["src/lib/db/schema.ts"],
    caseStudies: ["stripe-minions", "ramp-background-agent", "karpathy-one-gpu-research-lab", "making-machine-that-builds-machines"],
  },
  "ch-3": {
    docs: ["projects", "documents", "home-workspace"],
    journey: "personal-use",
    sourceFiles: ["src/lib/db/schema.ts", "src/lib/documents/processor.ts", "src/lib/documents/registry.ts", "src/lib/documents/context-builder.ts"],
    caseStudies: ["making-machine-that-builds-machines", "stripe-minions", "ramp-background-agent"],
  },
  "ch-4": {
    docs: ["agent-intelligence", "profiles", "monitoring"],
    journey: "work-use",
    sourceFiles: ["src/lib/agents/profiles/registry.ts", "src/lib/agents/execution-manager.ts"],
    caseStudies: ["stripe-minions", "ramp-background-agent", "harvey-legal-is-next"],
  },
  "ch-5": {
    docs: ["workflows", "agent-intelligence"],
    journey: "power-user",
    sourceFiles: ["src/lib/workflows/engine.ts", "src/lib/workflows/types.ts"],
    caseStudies: ["stripe-minions", "karpathy-one-gpu-research-lab", "making-machine-that-builds-machines"],
  },
  "ch-6": {
    docs: ["schedules", "monitoring"],
    sourceFiles: ["src/lib/schedules/scheduler.ts", "src/lib/schedules/interval-parser.ts"],
    caseStudies: ["karpathy-one-gpu-research-lab"],
  },
  "ch-7": {
    docs: ["agent-intelligence", "profiles"],
    journey: "developer",
    sourceFiles: ["src/lib/db/schema.ts", "src/lib/agents/profiles/"],
    caseStudies: ["making-machine-that-builds-machines", "karpathy-one-gpu-research-lab"],
  },
  "ch-8": {
    docs: ["profiles", "agent-intelligence"],
    sourceFiles: ["src/lib/agents/profiles/"],
    caseStudies: ["karpathy-one-gpu-research-lab", "harvey-legal-is-next", "stripe-minions"],
  },
  "ch-9": {
    docs: ["inbox-notifications", "tool-permissions", "settings"],
    sourceFiles: ["src/lib/agents/claude-agent.ts", "src/lib/data/notifications.ts"],
    caseStudies: ["harvey-legal-is-next", "ramp-background-agent", "stripe-minions"],
  },
  "ch-10": {
    docs: ["workflows", "profiles", "schedules"],
    sourceFiles: ["src/lib/workflows/engine.ts", "src/lib/schedules/scheduler.ts", "src/lib/db/schema.ts"],
    caseStudies: ["sequoa-hierarchy-to-intelligence", "harvey-legal-is-next"],
  },
  "ch-11": {
    docs: [],
    sourceFiles: ["src/lib/book/chapter-generator.ts", "src/lib/book/update-detector.ts", "src/lib/book/content.ts"],
    caseStudies: ["making-machine-that-builds-machines", "karpathy-one-gpu-research-lab"],
  },
  "ch-12": {
    docs: ["workflows", "profiles", "schedules"],
    sourceFiles: [],
    caseStudies: ["stripe-minions", "ramp-background-agent", "harvey-legal-is-next", "sequoa-hierarchy-to-intelligence", "karpathy-one-gpu-research-lab", "making-machine-that-builds-machines"],
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

/** Get case study slugs for a chapter */
export function getCaseStudies(chapterId: string): string[] {
  return CHAPTER_MAPPING[chapterId]?.caseStudies ?? [];
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
