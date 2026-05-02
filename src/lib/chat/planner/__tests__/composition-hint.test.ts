import { describe, it, expect } from "vitest";
import { buildCompositionHint } from "../composition-hint";
import type { ComposePlan } from "../types";

describe("buildCompositionHint", () => {
  const plan: ComposePlan = {
    kind: "primitive_matched",
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

  describe("generic plan", () => {
    const generic: ComposePlan = {
      kind: "generic",
      rationale: "Matched compose trigger 'build me' with no known primitive",
    };

    it("emits a compact hint covering slug/appId/-- rules and forbids Skill", () => {
      const hint = buildCompositionHint(generic);
      expect(hint).toMatch(/kebab-case slug/);
      expect(hint).toMatch(/appId/);
      expect(hint).toMatch(/create_table/);
      expect(hint).toMatch(/create_schedule/);
      expect(hint).toMatch(/MUST NOT contain `--`/);
      expect(hint).toMatch(/MUST NOT invoke the Skill tool/i);
      expect(hint).toContain(generic.rationale);
      // "compact" relative to the primitive_matched hint (~2000 chars).
      expect(hint.length).toBeLessThan(700);
    });

    it("omits the noun warning when integrationNoun is absent", () => {
      const hint = buildCompositionHint(generic);
      expect(hint).not.toMatch(/external API calls/);
    });

    it("includes a noun warning + compose-don't-scaffold guidance when integrationNoun is present", () => {
      const hint = buildCompositionHint({
        ...generic,
        integrationNoun: "github",
      });
      expect(hint).toMatch(/`github`/);
      expect(hint).toMatch(/can't make external API calls/);
      expect(hint).toMatch(/scaffold a separate plugin/);
      expect(hint).toMatch(/Do NOT scaffold a plugin in this turn/);
    });
  });
});
