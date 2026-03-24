// Types for the Playbook documentation system

export interface DocManifest {
  generated: string;
  version: number;
  sections: DocSection[];
  journeys: DocJourney[];
  metadata: {
    totalDocs: number;
    totalScreengrabs: number;
    featuresCovered: number;
    appSections: number;
  };
}

export interface DocSection {
  slug: string;
  title: string;
  category: string;
  path: string;
  route: string;
  tags: string[];
  features: string[];
  screengrabCount: number;
}

export interface DocJourney {
  slug: string;
  title: string;
  persona: string;
  difficulty: string;
  path: string;
  sections: string[];
  stepCount: number;
}

export interface ParsedDoc {
  frontmatter: Record<string, unknown>;
  body: string;
  slug: string;
}

export interface BookDoc extends ParsedDoc {
  chapter: number;
  part: number;
  readingTime: number;
  relatedDocs: string[];
  relatedJourney?: string;
  lastGeneratedBy?: string | null;
}

export type UsageStage = "new" | "early" | "active" | "power";

export interface AdoptionEntry {
  adopted: boolean;
  depth: "none" | "light" | "deep";
}

export interface JourneyCompletion {
  completed: number;
  total: number;
  percentage: number;
}
