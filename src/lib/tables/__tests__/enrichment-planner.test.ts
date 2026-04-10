import { describe, expect, it } from "vitest";
import {
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
});

describe("buildEnrichmentPlan", () => {
  it("chooses single-pass-classify for boolean columns", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: {
        name: "qualified",
        displayName: "Qualified",
        dataType: "boolean",
        position: 0,
      },
      sampleRows: [{ id: "row_1", data: { company: "Acme" } }],
      eligibleRowCount: 1,
      promptMode: "auto",
    });

    expect(plan.strategy).toBe("single-pass-classify");
    expect(plan.steps).toHaveLength(1);
  });

  it("chooses research-and-synthesize when text guidance asks for synthesis", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: {
        name: "summary",
        displayName: "Summary",
        dataType: "text",
        position: 0,
      },
      sampleRows: [{ id: "row_1", data: { company: "Acme" } }],
      eligibleRowCount: 1,
      promptMode: "auto",
      prompt: "Research the company and synthesize a short account summary.",
    });

    expect(plan.strategy).toBe("research-and-synthesize");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1].prompt).toContain("{{previous}}");
  });

  it("keeps custom mode single-step and wraps the typed contract", () => {
    const plan = buildEnrichmentPlan({
      targetColumn: baseColumn,
      sampleRows: [{ id: "row_1", data: { company: "Acme" } }],
      eligibleRowCount: 1,
      promptMode: "custom",
      prompt: "Find the profile URL.",
    });

    expect(plan.promptMode).toBe("custom");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].prompt).toContain("RESPONSE FORMAT");
  });
});

describe("normalizeEnrichmentOutput", () => {
  it("canonicalizes select output to the configured option casing", () => {
    const result = normalizeEnrichmentOutput("qualified", {
      columnName: "status",
      columnLabel: "Status",
      dataType: "select",
      allowedOptions: ["Lead", "Qualified", "Closed Won"],
    });

    expect(result).toEqual({ kind: "valid", value: "Qualified" });
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
});
