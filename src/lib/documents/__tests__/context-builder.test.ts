import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockFrom, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return {
    mockSelect,
    mockFrom,
    mockWhere,
  };
});

const { mockEq, mockAnd } = vi.hoisted(() => {
  const mockEq = vi.fn((column: string, value: unknown) => ({ column, value }));
  const mockAnd = vi.fn((...parts: unknown[]) => ({ type: "and", parts }));
  return { mockEq, mockAnd };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  documents: {
    taskId: "task_id",
    direction: "direction",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
}));

describe("buildDocumentContext", () => {
  beforeEach(() => {
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockEq.mockClear();
    mockAnd.mockClear();
  });

  it("filters task document context to input documents only", async () => {
    mockWhere.mockResolvedValueOnce([]);
    const { buildDocumentContext } = await import("../context-builder");

    await buildDocumentContext("task-1");

    expect(mockEq).toHaveBeenCalledWith("task_id", "task-1");
    expect(mockEq).toHaveBeenCalledWith("direction", "input");
    expect(mockAnd).toHaveBeenCalled();
  });
});
