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

  it("includes the intent-mismatch fallback guidance", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toMatch(/stated intent/i);
  });

  it("forbids Skill invocation for the compose turn", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toMatch(/MUST NOT invoke the Skill tool/i);
  });

  it("directs the model to call composition tools before prose", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toMatch(/MUST call `create_profile`/i);
  });

  it("is marked as an M4.5 planner hint", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toContain("M4.5");
  });

  it("instructs the model to pass appId on create_table", () => {
    const hint = buildCompositionHint(plan);
    expect(hint).toMatch(/pass `appId: '<app-id>'`/);
  });

  it("instructs the model to pass appId on create_schedule when tables are absent", () => {
    const hint = buildCompositionHint({ ...plan, tables: undefined });
    expect(hint).toMatch(/create_schedule.*appId/s);
  });
});
