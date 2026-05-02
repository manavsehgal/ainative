import type { ComposePlan } from "./types";

export type PrimitiveMapEntry = Omit<ComposePlan, "kind">;

export const PRIMITIVE_MAP: Record<string, PrimitiveMapEntry> = {
  portfolio: {
    profileId: "wealth-manager",
    blueprintId: "investment-research",
    rationale: "Matched 'portfolio' → wealth-manager + investment-research",
    tables: [
      {
        name: "positions",
        columns: [
          { name: "ticker", type: "text" },
          { name: "shares", type: "number" },
          { name: "cost_basis", type: "number" },
        ],
      },
    ],
  },
  investment: {
    profileId: "wealth-manager",
    blueprintId: "investment-research",
    rationale: "Matched 'investment' → wealth-manager + investment-research",
  },
  stocks: {
    profileId: "wealth-manager",
    blueprintId: "investment-research",
    rationale: "Matched 'stocks' → wealth-manager + investment-research",
  },
  "reading list": {
    profileId: "researcher",
    blueprintId: "documentation-generation",
    rationale:
      "Matched 'reading list' → researcher + documentation-generation",
  },
  research: {
    profileId: "researcher",
    blueprintId: "investment-research",
    rationale: "Matched 'research' → researcher + investment-research",
  },
  "code review": {
    profileId: "code-reviewer",
    blueprintId: "code-review-pipeline",
    rationale: "Matched 'code review' → code-reviewer + code-review-pipeline",
  },
  "pull request": {
    profileId: "code-reviewer",
    blueprintId: "code-review-pipeline",
    rationale: "Matched 'pull request' → code-reviewer + code-review-pipeline",
  },
  "content marketing": {
    profileId: "content-creator",
    blueprintId: "content-marketing-pipeline",
    rationale:
      "Matched 'content marketing' → content-creator + content-marketing-pipeline",
  },
  "customer support": {
    profileId: "customer-support-agent",
    blueprintId: "customer-support-triage",
    rationale:
      "Matched 'customer support' → customer-support-agent + customer-support-triage",
  },
  meal: {
    profileId: "health-fitness-coach",
    blueprintId: "meal-planning",
    rationale: "Matched 'meal' → health-fitness-coach + meal-planning",
  },
  recipe: {
    profileId: "health-fitness-coach",
    blueprintId: "meal-planning",
    rationale: "Matched 'recipe' → health-fitness-coach + meal-planning",
  },
  "lead research": {
    profileId: "sales-researcher",
    blueprintId: "lead-research-pipeline",
    rationale:
      "Matched 'lead research' → sales-researcher + lead-research-pipeline",
  },
  briefing: {
    profileId: "general",
    blueprintId: "business-daily-briefing",
    rationale: "Matched 'briefing' → general + business-daily-briefing",
  },
  documentation: {
    profileId: "document-writer",
    blueprintId: "documentation-generation",
    rationale:
      "Matched 'documentation' → document-writer + documentation-generation",
  },
  travel: {
    profileId: "travel-planner",
    blueprintId: "travel-planning",
    rationale: "Matched 'travel' → travel-planner + travel-planning",
  },
};
