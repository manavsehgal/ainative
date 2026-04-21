import { describe, it, expect } from "vitest";
import { buildCompositionHint } from "../composition-hint";
import type { ComposePlan } from "../types";

describe("buildCompositionHint", () => {
  const plan: ComposePlan = {
    profileId: "wealth-manager",
    blueprintId: "investment-research",
    rationale: "Matched 'portfolio'",
    tables: [
      {
        name: "positions",
        columns: [
          { name: "ticker", type: "text" },
          { name: "shares", type: "number" },
        ],
      },
    ],
  };

  it("includes profile + blueprint ids", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toContain("wealth-manager");
    expect(hint).toContain("investment-research");
  });

  it("includes table proposals when present", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toContain("positions");
    expect(hint).toContain("ticker");
  });

  it("omits table section when no tables", () => {
    const hint = buildCompositionHint({ ...plan, tables: undefined });
    expect(hint).not.toContain("Tables:");
  });

  it("includes the rationale", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toContain("Matched 'portfolio'");
  });

  it("ends with the advisory fallback instruction", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toMatch(/prefer their stated intent/i);
  });

  it("is marked as an M4.5 planner hint", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toContain("M4.5");
  });
});
