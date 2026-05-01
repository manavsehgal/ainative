import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

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
vi.mock("@/lib/tables/enrichment", () => ({
  createEnrichmentWorkflow: vi.fn(),
}));

import { tableTools } from "../table-tools";

function getTool(name: string) {
  const tools = tableTools({ projectId: "proj-1" } as never);
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function parseArgs(toolName: string, args: unknown) {
  const tool = getTool(toolName);
  return z.object(tool.zodShape).safeParse(args);
}

describe("create_table appId discipline", () => {
  const baseArgs = {
    name: "Books",
    columns: [
      { name: "title", displayName: "Title", dataType: "text" as const },
    ],
  };

  it("accepts a clean app slug appId", () => {
    const result = parseArgs("create_table", {
      ...baseArgs,
      appId: "habit-loop",
    });
    expect(result.success).toBe(true);
  });

  it("accepts omitted appId (non-app-composition table)", () => {
    const result = parseArgs("create_table", baseArgs);
    expect(result.success).toBe(true);
  });

  it("rejects an artifact id passed as appId (contains '--')", () => {
    const result = parseArgs("create_table", {
      ...baseArgs,
      appId: "habit-loop--coach",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues
        .map((iss) => iss.message)
        .join(" ");
      expect(message).toMatch(/appId/);
      expect(message).toMatch(/--/);
      expect(message).toMatch(/slug/i);
    }
  });
});
