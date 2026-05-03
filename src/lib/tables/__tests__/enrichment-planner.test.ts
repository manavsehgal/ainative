import { describe, expect, it } from "vitest";
import {
  assertEnrichmentCompatibleColumn,
  buildEnrichmentPlan,
  buildTargetContract,
  normalizeEnrichmentOutput,
} from "../enrichment-planner";
import type { ColumnDef } from "../types";

const baseColumn: ColumnDef = {
  name: "linkedin_url",
  displayName: "LinkedIn URL",
  dataType: "url",
  position: 0,
};

const textColumn: ColumnDef = {
  name: "summary",
  displayName: "Summary",
  dataType: "text",
  position: 0,
};

const booleanColumn: ColumnDef = {
  name: "qualified",
  displayName: "Qualified",
  dataType: "boolean",
  position: 0,
};

const sampleRow = { id: "row_1", data: { company: "Acme" } };

describe("assertEnrichmentCompatibleColumn", () => {
  it("accepts every supported data type", () => {
    for (const dataType of ["text", "number", "boolean", "select", "url", "email"] as const) {
      expect(() =>
        assertEnrichmentCompatibleColumn({
          name: "x",
          displayName: "X",
          dataType,
          position: 0,
        })
      ).not.toThrow();
    }
  });

  it("throws a typed error naming the unsupported data type", () => {
    expect(() =>
      assertEnrichmentCompatibleColumn({
        name: "due",
        displayName: "Due",
        dataType: "date" as ColumnDef["dataType"],
        position: 0,
      })
    ).toThrow(/unsupported data type "date"/);
  });

  it("runs before the cast inside buildTargetContract — unsupported columns never reach the contract shape", () => {
    expect(() =>
      buildTargetContract({
        name: "due",
        displayName: "Due",
        dataType: "date" as ColumnDef["dataType"],
        position: 0,
      })
    ).toThrow(/unsupported data type "date"/);
  });
});

describe("buildTargetContract", () => {
  it("preserves select options for categorical columns", () => {
    const contract = buildTargetContract({
      name: "status",
      displayName: "Status",
      dataType: "select",
      position: 1,
      config: { options: ["Lead", "Qualified", "Closed Won"] },
    });

    expect(contract.allowedOptions).toEqual(["Lead", "Qualified", "Closed Won"]);
  });

  it("omits allowedOptions for non-select columns", () => {
    const contract = buildTargetContract(baseColumn);
    expect(contract.allowedOptions).toBeUndefined();
  });
});

describe("buildEnrichmentPlan — strategy selection", () => {
  it("chooses single-pass-classify for boolean columns regardless of prompt", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: booleanColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "research the company deeply and synthesize a multi-paragraph summary",
    });

    expect(plan.strategy).toBe("single-pass-classify");
    expect(plan.steps).toHaveLength(1);
  });

  it("chooses single-pass-classify for select columns regardless of prompt", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: {
        name: "tier",
        displayName: "Tier",
        dataType: "select",
        position: 0,
        config: { options: ["Free", "Pro"] },
      },
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "write a long synthesis essay",
    });

    expect(plan.strategy).toBe("single-pass-classify");
  });

  it("forces single-pass-lookup for URL columns even with a research-shaped prompt", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "research and synthesize the canonical profile URL",
    });

    expect(plan.strategy).toBe("single-pass-lookup");
  });

  it("chooses research-and-synthesize when a text prompt hints at synthesis", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: textColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "Research the company and synthesize a short account summary.",
    });

    expect(plan.strategy).toBe("research-and-synthesize");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1].prompt).toContain("{{previous}}");
  });

  it("falls back to single-pass-lookup for text columns when the prompt has no synthesis hints", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: textColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "headline",
    });

    expect(plan.strategy).toBe("single-pass-lookup");
  });

  it("treats an empty prompt as a no-hint signal for text columns", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: textColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "",
    });

    expect(plan.strategy).toBe("single-pass-lookup");
  });

  it("still picks research-and-synthesize for very long prompts containing the hint words", () => {
    const longPrompt = "Research the company. " + "x ".repeat(2000);
    const plan = buildEnrichmentPlan({
      targetColumn: textColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: longPrompt,
    });

    expect(plan.strategy).toBe("research-and-synthesize");
  });

  it("keeps custom mode single-step and wraps the typed contract", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "custom",
      prompt: "Find the profile URL.",
    });

    expect(plan.promptMode).toBe("custom");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].prompt).toContain("RESPONSE FORMAT");
  });

  it("throws a typed error in custom mode when the prompt is missing", () => {
    expect(() =>
      buildEnrichmentPlan({
        targetColumn: baseColumn,
        sampleRows: [sampleRow],
        eligibleRowCount: 1,
        promptMode: "custom",
      })
    ).toThrow(/Custom enrichment requires a prompt/);
  });

  it("throws in custom mode when the prompt is whitespace-only", () => {
    expect(() =>
      buildEnrichmentPlan({
        targetColumn: baseColumn,
        sampleRows: [sampleRow],
        eligibleRowCount: 1,
        promptMode: "custom",
        prompt: "   \n  ",
      })
    ).toThrow(/Custom enrichment requires a prompt/);
  });
});

describe("buildEnrichmentPlan — reasoning strings", () => {
  it("explains the categorical path for select columns", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: {
        name: "tier",
        displayName: "Tier",
        dataType: "select",
        position: 0,
        config: { options: ["Free", "Pro"] },
      },
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.reasoning).toMatch(/categorical/i);
    expect(plan.reasoning).toMatch(/classification path/i);
  });

  it("explains the boolean contract for boolean columns", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: booleanColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.reasoning).toMatch(/boolean/i);
    expect(plan.reasoning).toMatch(/true\/false/i);
  });

  it("describes the research split for synthesis-shaped text prompts", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: textColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "research and synthesize",
    });

    expect(plan.reasoning).toMatch(/research/i);
    expect(plan.reasoning).toMatch(/final writeback|synthesis/i);
  });

  it("notes the lightweight text path when no synthesis hint is present", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: textColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.reasoning).toMatch(/free-form text/i);
    expect(plan.reasoning).toMatch(/lightweight/i);
  });

  it("describes the single-pass concrete value path for URL/email/number columns", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.reasoning).toMatch(/concrete factual value/i);
    expect(plan.reasoning).toMatch(/single-pass/i);
  });

  it("appends a filter rationale clause when a filter is supplied", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      filter: { column: "linkedin_url", operator: "is_empty" },
    });

    expect(plan.reasoning).toContain('"linkedin_url"');
    expect(plan.reasoning).toMatch(/filter/i);
  });

  it("appends an operator-guidance clause when an extra prompt is supplied", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "prefer the company LinkedIn over personal profiles",
    });

    expect(plan.reasoning).toMatch(/operator's extra instructions/i);
  });

  it("omits the operator-guidance clause when no prompt is supplied", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.reasoning).not.toMatch(/operator's extra instructions/i);
  });
});

describe("buildEnrichmentPlan — null-input paths", () => {
  it("accepts undefined prompt for non-custom strategies", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.strategy).toBe("single-pass-lookup");
    expect(plan.steps).toHaveLength(1);
    expect(plan.reasoning).toBeTruthy();
  });

  it("accepts undefined agentProfileOverride and falls back to recommendation", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.agentProfile).toBe("sales-researcher");
  });

  it("ignores empty-string agentProfileOverride and falls back to recommendation", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      agentProfileOverride: "   ",
    });

    expect(plan.agentProfile).toBe("sales-researcher");
  });

  it("uses agentProfileOverride when provided", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
      agentProfileOverride: "researcher",
    });

    expect(plan.agentProfile).toBe("researcher");
  });

  it("accepts undefined filter and produces a plan with no filter clause in reasoning", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [sampleRow],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.reasoning).not.toMatch(/Preview applies the current filter/i);
  });

  it("caps sampleBindings at the documented preview limit", () => {
    const sampleRows = Array.from({ length: 10 }, (_, i) => ({
      id: `row_${i}`,
      data: { company: `Acme-${i}` },
    }));

    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows,
      eligibleRowCount: 10,
      promptMode: "auto",
    });

    expect(plan.sampleBindings).toHaveLength(2);
    expect(plan.sampleBindings[0]).toMatchObject({ id: "row_0", company: "Acme-0" });
    expect(plan.sampleBindings[1]).toMatchObject({ id: "row_1", company: "Acme-1" });
  });
});

describe("normalizeEnrichmentOutput", () => {
  it("trims and returns text for text columns", () => {
    expect(
      normalizeEnrichmentOutput("  An account summary.  ", {
        columnName: "summary",
        columnLabel: "Summary",
        dataType: "text",
      })
    ).toEqual({ kind: "valid", value: "An account summary." });
  });

  it("validates email addresses for email columns", () => {
    expect(
      normalizeEnrichmentOutput("ada@example.com", {
        columnName: "email",
        columnLabel: "Email",
        dataType: "email",
      })
    ).toEqual({ kind: "valid", value: "ada@example.com" });

    expect(
      normalizeEnrichmentOutput("not-an-email", {
        columnName: "email",
        columnLabel: "Email",
        dataType: "email",
      })
    ).toEqual({
      kind: "invalid",
      reason: "Expected a valid email address or NOT_FOUND",
    });
  });

  it("rejects non-true/false values for boolean columns", () => {
    expect(
      normalizeEnrichmentOutput("maybe", {
        columnName: "qualified",
        columnLabel: "Qualified",
        dataType: "boolean",
      })
    ).toEqual({
      kind: "invalid",
      reason: "Expected exactly true, false, or NOT_FOUND",
    });
  });

  it("rejects non-numeric strings for number columns", () => {
    expect(
      normalizeEnrichmentOutput("forty-two", {
        columnName: "score",
        columnLabel: "Score",
        dataType: "number",
      })
    ).toEqual({
      kind: "invalid",
      reason: "Expected a bare numeric value or NOT_FOUND",
    });
  });

  it("returns valid URL for url columns", () => {
    expect(
      normalizeEnrichmentOutput("https://example.com/x", {
        columnName: "url",
        columnLabel: "URL",
        dataType: "url",
      })
    ).toEqual({ kind: "valid", value: "https://example.com/x" });
  });

  it("canonicalizes select output to the configured option casing", () => {
    const result = normalizeEnrichmentOutput("qualified", {
      columnName: "status",
      columnLabel: "Status",
      dataType: "select",
      allowedOptions: ["Lead", "Qualified", "Closed Won"],
    });

    expect(result).toEqual({ kind: "valid", value: "Qualified" });
  });

  it("rejects unknown options for select columns and lists the allowed values", () => {
    const result = normalizeEnrichmentOutput("Pending", {
      columnName: "status",
      columnLabel: "Status",
      dataType: "select",
      allowedOptions: ["Lead", "Qualified"],
    });

    expect(result).toEqual({
      kind: "invalid",
      reason: "Expected one of Lead, Qualified or NOT_FOUND",
    });
  });

  it("parses booleans and numbers into typed values", () => {
    expect(
      normalizeEnrichmentOutput("true", {
        columnName: "qualified",
        columnLabel: "Qualified",
        dataType: "boolean",
      })
    ).toEqual({ kind: "valid", value: true });

    expect(
      normalizeEnrichmentOutput("42", {
        columnName: "score",
        columnLabel: "Score",
        dataType: "number",
      })
    ).toEqual({ kind: "valid", value: 42 });
  });

  it("rejects invalid urls", () => {
    expect(
      normalizeEnrichmentOutput("not-a-url", {
        columnName: "linkedin_url",
        columnLabel: "LinkedIn URL",
        dataType: "url",
      })
    ).toEqual({
      kind: "invalid",
      reason: "Expected a valid URL or NOT_FOUND",
    });
  });

  it("treats empty/whitespace input as skip:empty", () => {
    expect(
      normalizeEnrichmentOutput("   ", {
        columnName: "summary",
        columnLabel: "Summary",
        dataType: "text",
      })
    ).toEqual({ kind: "skip", reason: "empty" });

    expect(
      normalizeEnrichmentOutput(undefined, {
        columnName: "summary",
        columnLabel: "Summary",
        dataType: "text",
      })
    ).toEqual({ kind: "skip", reason: "empty" });

    expect(
      normalizeEnrichmentOutput(null, {
        columnName: "summary",
        columnLabel: "Summary",
        dataType: "text",
      })
    ).toEqual({ kind: "skip", reason: "empty" });
  });

  it("treats NOT_FOUND (any casing) as skip:not_found", () => {
    expect(
      normalizeEnrichmentOutput("NOT_FOUND", {
        columnName: "summary",
        columnLabel: "Summary",
        dataType: "text",
      })
    ).toEqual({ kind: "skip", reason: "not_found" });

    expect(
      normalizeEnrichmentOutput("not_found", {
        columnName: "summary",
        columnLabel: "Summary",
        dataType: "text",
      })
    ).toEqual({ kind: "skip", reason: "not_found" });
  });
});
