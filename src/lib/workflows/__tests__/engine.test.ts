import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockWhere,
  mockFrom,
  mockSelect,
  mockUpdateWhere,
  mockSet,
  mockUpdate,
  mockInsertValues,
  mockInsert,
} = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  return {
    mockWhere,
    mockFrom,
    mockSelect,
    mockUpdateWhere,
    mockSet,
    mockUpdate,
    mockInsertValues,
    mockInsert,
  };
});

const { mockExecuteTaskWithRuntime } = vi.hoisted(() => ({
  mockExecuteTaskWithRuntime: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  workflows: {
    id: "workflows.id",
  },
  tasks: {
    id: "tasks.id",
  },
  agentLogs: {},
  notifications: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: string, value: unknown) => ({ column, value })),
}));

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: mockExecuteTaskWithRuntime,
}));

describe("executeWorkflow", () => {
  beforeEach(() => {
    mockWhere.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockUpdateWhere.mockReset();
    mockSet.mockReset();
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockClear();
    mockInsertValues.mockReset();
    mockInsertValues.mockResolvedValue(undefined);
    mockInsert.mockClear();
    mockExecuteTaskWithRuntime.mockClear();
    mockExecuteTaskWithRuntime.mockResolvedValue(undefined);
  });

  it("persists failed workflow executions with failed top-level status", async () => {
    const workflowId = "workflow-1";
    const workflow = {
      id: workflowId,
      name: "Parallel workflow",
      projectId: null,
      definition: JSON.stringify({
        pattern: "sequence",
        steps: [{ id: "step-1", name: "Step 1", prompt: "Do the work." }],
      }),
      status: "draft",
    };
    const failedTask = {
      id: "task-1",
      status: "failed",
      result: "Provider runtime error",
    };

    mockWhere
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([failedTask])
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([workflow]);

    const { executeWorkflow } = await import("../engine");

    await executeWorkflow(workflowId);

    expect(mockSet.mock.calls.at(-1)?.[0]).toMatchObject({ status: "failed" });
  });
});
