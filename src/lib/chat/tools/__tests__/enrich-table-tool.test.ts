import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateEnrichmentWorkflow } = vi.hoisted(() => ({
  mockCreateEnrichmentWorkflow: vi.fn(),
}));

vi.mock("@/lib/tables/enrichment", () => ({
  createEnrichmentWorkflow: mockCreateEnrichmentWorkflow,
}));

// Stub the rest of @/lib/data/tables so importing table-tools doesn't drag in DB.
vi.mock("@/lib/data/tables", () => ({
  listTables: vi.fn(),
  getTable: vi.fn(),
  createTable: vi.fn(),
  updateTable: vi.fn(),
  deleteTable: vi.fn(),
  listRows: vi.fn(),
  addRows: vi.fn(),
  updateRow: vi.fn(),
  deleteRows: vi.fn(),
  listTemplates: vi.fn(),
  cloneFromTemplate: vi.fn(),
  addColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
}));

vi.mock("@/lib/tables/history", () => ({ getTableHistory: vi.fn() }));
vi.mock("@/lib/tables/import", () => ({
  extractStructuredData: vi.fn(),
  inferColumnTypes: vi.fn(),
  importRows: vi.fn(),
  createImportRecord: vi.fn(),
}));

import { tableTools } from "../table-tools";

function findEnrichTool() {
  const tools = tableTools({ projectId: "proj_test" });
  const tool = tools.find((t) => t.name === "enrich_table");
  if (!tool) throw new Error("enrich_table tool not registered");
  return tool;
}

describe("enrich_table tool", () => {
  beforeEach(() => {
    mockCreateEnrichmentWorkflow.mockReset();
  });

  it("is registered in tableTools", () => {
    const tools = tableTools({ projectId: "proj_test" });
    const names = tools.map((t) => t.name);
    expect(names).toContain("enrich_table");
  });

  it("delegates to createEnrichmentWorkflow with the supplied params", async () => {
    mockCreateEnrichmentWorkflow.mockResolvedValueOnce({
      workflowId: "wf_xyz",
      rowCount: 4,
    });

    const tool = findEnrichTool();
    const result = await tool.handler({
      tableId: "tbl_contacts",
      prompt: "Find LinkedIn for {{row.name}}",
      targetColumn: "linkedin",
      filter: { column: "linkedin", operator: "is_empty" },
      agentProfile: "sales-researcher",
    });

    expect(mockCreateEnrichmentWorkflow).toHaveBeenCalledWith(
      "tbl_contacts",
      expect.objectContaining({
        prompt: "Find LinkedIn for {{row.name}}",
        targetColumn: "linkedin",
        filter: { column: "linkedin", operator: "is_empty" },
        agentProfile: "sales-researcher",
      })
    );

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text) as {
      workflowId: string;
      rowCount: number;
    };
    expect(payload.workflowId).toBe("wf_xyz");
    expect(payload.rowCount).toBe(4);
  });

  it("falls back to ctx.projectId when projectId is not supplied", async () => {
    mockCreateEnrichmentWorkflow.mockResolvedValueOnce({
      workflowId: "wf_a",
      rowCount: 1,
    });

    const tool = findEnrichTool();
    await tool.handler({
      tableId: "tbl_x",
      prompt: "x",
      targetColumn: "linkedin",
    });

    const callArg = mockCreateEnrichmentWorkflow.mock.calls[0][1] as {
      projectId?: string;
    };
    expect(callArg.projectId).toBe("proj_test");
  });

  it("returns an error result when createEnrichmentWorkflow throws", async () => {
    mockCreateEnrichmentWorkflow.mockRejectedValueOnce(
      new Error("Table tbl_missing not found")
    );

    const tool = findEnrichTool();
    const result = await tool.handler({
      tableId: "tbl_missing",
      prompt: "x",
      targetColumn: "linkedin",
    });

    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text) as { error: string };
    expect(payload.error).toContain("not found");
  });
});
