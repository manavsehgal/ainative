import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock infrastructure ──────────────────────────────────────────────

const { mockWhere, mockFrom, mockSelect, mockValues, mockInsert } =
  vi.hoisted(() => {
    const mockWhere = vi.fn();
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    return { mockWhere, mockFrom, mockSelect, mockValues, mockInsert };
  });

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  tasks: {
    id: "id",
    result: "result",
    projectId: "project_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: string, val: unknown) => ({ col: _col, val })),
}));

import { processSweepResult } from "../sweep";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════════════════════
// processSweepResult
// ═════════════════════════════════════════════════════════════════════

describe("processSweepResult", () => {
  it("creates improvement tasks from valid JSON array in result", async () => {
    const proposals = [
      {
        title: "Refactor auth module",
        description: "Reduce duplication in token validation",
        priority: 2,
        suggestedProfile: "code-reviewer",
      },
      {
        title: "Add missing test for parser",
        description: "The CSV parser has no test coverage",
        priority: 3,
      },
    ];

    mockWhere.mockResolvedValueOnce([
      { result: JSON.stringify(proposals), projectId: "proj-1" },
    ]);

    await processSweepResult("sweep-task-1");

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Refactor auth module",
          description: "[Sweep-generated] Reduce duplication in token validation",
          status: "planned",
          priority: 2,
          agentProfile: "code-reviewer",
          projectId: "proj-1",
        }),
        expect.objectContaining({
          title: "Add missing test for parser",
          agentProfile: "general", // default when not specified
          priority: 3,
        }),
      ])
    );
  });

  it("extracts JSON array from surrounding text", async () => {
    const result = `Here are my findings:\n${JSON.stringify([
      { title: "Fix bug", description: "Important fix", priority: 1 },
    ])}\nEnd of report.`;

    mockWhere.mockResolvedValueOnce([{ result, projectId: null }]);

    await processSweepResult("sweep-task-1");

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fix bug" }),
      ])
    );
  });

  it("silently returns when task has no result", async () => {
    mockWhere.mockResolvedValueOnce([{ result: null, projectId: null }]);

    await processSweepResult("sweep-task-1");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("silently returns when task not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    await processSweepResult("sweep-task-1");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("silently returns when result contains no JSON array", async () => {
    mockWhere.mockResolvedValueOnce([
      { result: "No actionable findings.", projectId: null },
    ]);

    await processSweepResult("sweep-task-1");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("silently returns when result contains invalid JSON", async () => {
    mockWhere.mockResolvedValueOnce([
      { result: "[{broken json}]", projectId: null },
    ]);

    await processSweepResult("sweep-task-1");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("caps tasks at 10", async () => {
    const proposals = Array.from({ length: 15 }, (_, i) => ({
      title: `Task ${i + 1}`,
      description: `Description ${i + 1}`,
      priority: 3,
    }));

    mockWhere.mockResolvedValueOnce([
      { result: JSON.stringify(proposals), projectId: null },
    ]);

    await processSweepResult("sweep-task-1");

    const insertedValues = mockValues.mock.calls[0][0] as unknown[];
    expect(insertedValues).toHaveLength(10);
  });

  it("clamps priority to 1-4 range", async () => {
    mockWhere.mockResolvedValueOnce([
      {
        result: JSON.stringify([
          { title: "Low", description: "d", priority: 0 },
          { title: "High", description: "d", priority: 10 },
        ]),
        projectId: null,
      },
    ]);

    await processSweepResult("sweep-task-1");

    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "Low", priority: 1 }),
        expect.objectContaining({ title: "High", priority: 4 }),
      ])
    );
  });

  it("filters out entries with missing title or description", async () => {
    mockWhere.mockResolvedValueOnce([
      {
        result: JSON.stringify([
          { title: "Valid", description: "Has both" },
          { title: "No desc" },
          { description: "No title" },
          { title: "Also valid", description: "Also has both" },
        ]),
        projectId: null,
      },
    ]);

    await processSweepResult("sweep-task-1");

    const insertedValues = mockValues.mock.calls[0][0] as unknown[];
    expect(insertedValues).toHaveLength(2);
  });
});
