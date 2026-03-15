import { describe, it, expect } from "vitest";
import { suggestProfileForStep } from "../suggest";

const ALL_PROFILES = [
  "general",
  "researcher",
  "code-reviewer",
  "document-writer",
  "devops-engineer",
  "data-analyst",
];

describe("suggestProfileForStep", () => {
  it("suggests researcher for research-related tasks", () => {
    expect(
      suggestProfileForStep("Research API patterns", "Investigate best practices", ALL_PROFILES)
    ).toBe("researcher");
  });

  it("suggests code-reviewer for review tasks", () => {
    expect(
      suggestProfileForStep("Security audit", "Review code for vulnerabilities", ALL_PROFILES)
    ).toBe("code-reviewer");
  });

  it("suggests document-writer for writing tasks", () => {
    expect(
      suggestProfileForStep("Write documentation", "Document the API endpoints", ALL_PROFILES)
    ).toBe("document-writer");
  });

  it("suggests devops-engineer for deployment tasks", () => {
    expect(
      suggestProfileForStep("Deploy to production", "Set up CI pipeline and infrastructure", ALL_PROFILES)
    ).toBe("devops-engineer");
  });

  it("suggests data-analyst for data tasks", () => {
    expect(
      suggestProfileForStep("Analyze metrics", "Aggregate data and create statistics", ALL_PROFILES)
    ).toBe("data-analyst");
  });

  it('returns "auto" when no keywords match', () => {
    expect(
      suggestProfileForStep("Fix the thing", "Make it work", ALL_PROFILES)
    ).toBe("auto");
  });

  it("only suggests from available profiles", () => {
    expect(
      suggestProfileForStep("Research API patterns", "Investigate", ["general"])
    ).toBe("auto");
  });

  it("picks highest-scoring profile when multiple match", () => {
    // "review" + "security" + "vulnerability" = 3 hits for code-reviewer
    // "investigate" = 1 hit for researcher
    expect(
      suggestProfileForStep(
        "Security review",
        "Investigate vulnerability audit",
        ALL_PROFILES
      )
    ).toBe("code-reviewer");
  });
});
