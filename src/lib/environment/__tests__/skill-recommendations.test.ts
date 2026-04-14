import { describe, it, expect } from "vitest";
import { computeRecommendation } from "../skill-recommendations";
import type { EnrichedSkill } from "../skill-enrichment";

const mkSkill = (
  name: string,
  preview: string,
  overrides: Partial<EnrichedSkill> = {}
): EnrichedSkill => ({
  id: name,
  name,
  tool: "claude-code",
  scope: "user",
  preview,
  sizeBytes: 0,
  absPath: `/p/${name}`,
  healthScore: "healthy",
  syncStatus: "claude-only",
  linkedProfileId: null,
  absPaths: [`/p/${name}`],
  ...overrides,
});

describe("computeRecommendation", () => {
  it("recommends a healthy skill whose keywords match 2+ in recent messages", () => {
    const skills = [
      mkSkill("code-reviewer", "Review pull requests for security"),
      mkSkill("researcher", "Search the web for up-to-date information"),
    ];
    const rec = computeRecommendation(skills, [
      "can you review this pull request for security issues?",
    ]);
    expect(rec?.name).toBe("code-reviewer");
  });

  it("returns null when no strong keyword match exists", () => {
    const skills = [mkSkill("code-reviewer", "Review PRs for security")];
    const rec = computeRecommendation(skills, ["hi there"]);
    expect(rec).toBeNull();
  });

  it("excludes already-active skill", () => {
    const skills = [mkSkill("code-reviewer", "Review pull requests security")];
    const rec = computeRecommendation(
      skills,
      ["review this pull request for security"],
      { activeSkillId: "code-reviewer" }
    );
    expect(rec).toBeNull();
  });

  it("excludes dismissed skills", () => {
    const skills = [mkSkill("code-reviewer", "Review pull requests security")];
    const rec = computeRecommendation(
      skills,
      ["review pull request security issues"],
      { dismissedIds: new Set(["code-reviewer"]) }
    );
    expect(rec).toBeNull();
  });

  it("excludes broken/aging skills", () => {
    const skills = [
      mkSkill("code-reviewer", "Review pull requests security", {
        healthScore: "aging",
      }),
    ];
    const rec = computeRecommendation(skills, [
      "review pull request security issues",
    ]);
    expect(rec).toBeNull();
  });

  it("ignores stopwords and requires ≥2 distinct meaningful hits", () => {
    const skills = [mkSkill("researcher", "the and for a of in on")];
    const rec = computeRecommendation(skills, ["the and for a of in on"]);
    expect(rec).toBeNull();
  });

  it("returns null on empty message list", () => {
    const rec = computeRecommendation(
      [mkSkill("code-reviewer", "review pull request security")],
      []
    );
    expect(rec).toBeNull();
  });
});
