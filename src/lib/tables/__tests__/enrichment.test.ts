import { describe, it, expect } from "vitest";
import {
  generateEnrichmentDefinition,
  filterUnpopulatedRows,
  wrapPromptWithOutputContract,
} from "../enrichment";

describe("generateEnrichmentDefinition", () => {
  const baseInput = {
    rows: [
      { id: "row_1", data: { name: "Alice", company: "Acme" } },
      { id: "row_2", data: { name: "Bob", company: "Beta" } },
      { id: "row_3", data: { name: "Carol", company: "Gamma" } },
    ],
    tableId: "tbl_contacts",
    prompt: "Find LinkedIn URL for {{row.name}} at {{row.company}}",
    targetColumn: "linkedin",
    agentProfile: "sales-researcher",
  };

  it("produces a loop-pattern workflow definition", () => {
    const def = generateEnrichmentDefinition(baseInput);
    expect(def.pattern).toBe("loop");
    expect(def.steps).toHaveLength(1);
    expect(def.loopConfig).toBeDefined();
  });

  it("binds rows into loopConfig.items merged with their id", () => {
    const def = generateEnrichmentDefinition(baseInput);
    expect(def.loopConfig?.items).toEqual([
      { id: "row_1", name: "Alice", company: "Acme" },
      { id: "row_2", name: "Bob", company: "Beta" },
      { id: "row_3", name: "Carol", company: "Gamma" },
    ]);
  });

  it("defaults itemVariable to 'row' and caps maxIterations to row count", () => {
    const def = generateEnrichmentDefinition(baseInput);
    expect(def.loopConfig?.itemVariable).toBe("row");
    expect(def.loopConfig?.maxIterations).toBe(3);
  });

  it("respects a custom itemVariable", () => {
    const def = generateEnrichmentDefinition({
      ...baseInput,
      itemVariable: "contact",
    });
    expect(def.loopConfig?.itemVariable).toBe("contact");
  });

  it("attaches a postAction with templated rowId on the loop step", () => {
    const def = generateEnrichmentDefinition(baseInput);
    const step = def.steps[0];
    expect(step.postAction).toEqual({
      type: "update_row",
      tableId: "tbl_contacts",
      rowId: "{{row.id}}",
      column: "linkedin",
    });
  });

  it("templates the postAction rowId against the custom itemVariable", () => {
    const def = generateEnrichmentDefinition({
      ...baseInput,
      itemVariable: "contact",
    });
    expect(def.steps[0].postAction?.rowId).toBe("{{contact.id}}");
  });

  it("wraps the supplied prompt with an output-format contract", () => {
    const def = generateEnrichmentDefinition(baseInput);
    const prompt = def.steps[0].prompt;
    // User prompt is preserved
    expect(prompt).toContain(baseInput.prompt);
    // Output contract is appended so the agent returns a bare value
    expect(prompt).toContain("RESPONSE FORMAT");
    expect(prompt).toContain("NOT_FOUND");
    expect(prompt).toContain('"linkedin"');
    expect(def.steps[0].agentProfile).toBe("sales-researcher");
  });

  it("produces a single-step definition even when there are zero rows", () => {
    const def = generateEnrichmentDefinition({ ...baseInput, rows: [] });
    expect(def.steps).toHaveLength(1);
    expect(def.loopConfig?.items).toEqual([]);
    expect(def.loopConfig?.maxIterations).toBe(0);
  });
});

describe("wrapPromptWithOutputContract", () => {
  it("preserves the user's original prompt at the top", () => {
    const wrapped = wrapPromptWithOutputContract(
      "Find the LinkedIn URL for {{row.name}}",
      "linkedin"
    );
    expect(wrapped.startsWith("Find the LinkedIn URL for {{row.name}}")).toBe(true);
  });

  it("appends a strict output contract that names the target column", () => {
    const wrapped = wrapPromptWithOutputContract("Do x", "email");
    expect(wrapped).toContain('"email"');
    expect(wrapped).toContain("Return ONLY the value");
  });

  it("teaches the agent to use NOT_FOUND, not prose like 'Not found'", () => {
    const wrapped = wrapPromptWithOutputContract("Do x", "value");
    expect(wrapped).toContain("NOT_FOUND");
    // Explicit guard against the verbose-prose failure mode we saw in E2E:
    expect(wrapped).toContain("Do NOT return prose");
  });

  it("trims the user prompt before wrapping", () => {
    const wrapped = wrapPromptWithOutputContract("  spaced  \n", "x");
    expect(wrapped.startsWith("spaced")).toBe(true);
  });
});

describe("filterUnpopulatedRows", () => {
  const rows = [
    { id: "r1", data: { name: "A", linkedin: "https://linkedin.com/in/a" } },
    { id: "r2", data: { name: "B", linkedin: "" } },
    { id: "r3", data: { name: "C" } }, // missing key entirely
    { id: "r4", data: { name: "D", linkedin: "   " } }, // whitespace
    { id: "r5", data: { name: "E", linkedin: null as unknown as string } },
  ];

  it("keeps rows whose target column is missing, null, empty, or whitespace", () => {
    const result = filterUnpopulatedRows(rows, "linkedin");
    expect(result.map((r) => r.id)).toEqual(["r2", "r3", "r4", "r5"]);
  });

  it("keeps all rows when none have the target column populated", () => {
    const blankRows = [
      { id: "r1", data: { name: "A" } },
      { id: "r2", data: { name: "B" } },
    ];
    expect(filterUnpopulatedRows(blankRows, "linkedin")).toHaveLength(2);
  });

  it("returns an empty array when every row is already populated", () => {
    const populated = [
      { id: "r1", data: { linkedin: "x" } },
      { id: "r2", data: { linkedin: "y" } },
    ];
    expect(filterUnpopulatedRows(populated, "linkedin")).toEqual([]);
  });
});
