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
    status: "workflows.status",
  },
  tasks: {
    id: "tasks.id",
  },
  agentLogs: {},
  notifications: {},
  // usageLedger is read by execution-stats.ts in the finally-block fire-and-forget.
  // Without this export the import throws, cascading through the catch handler
  // and causing downstream updateWorkflowState reads to run out of mock entries.
  usageLedger: {
    workflowId: "usageLedger.workflowId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: string, value: unknown) => ({ column, value })),
  and: vi.fn((...conditions: unknown[]) => ({ and: conditions })),
}));

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: mockExecuteTaskWithRuntime,
}));

const { mockStartTaskExecution } = vi.hoisted(() => ({
  mockStartTaskExecution: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/agents/task-dispatch", () => ({
  startTaskExecution: mockStartTaskExecution,
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
      .mockResolvedValueOnce([workflow])
      // syncSourceTaskStatus reads the workflow to find sourceTaskId
      .mockResolvedValueOnce([workflow]);

    const { executeWorkflow } = await import("../engine");

    await executeWorkflow(workflowId);

    expect(mockSet.mock.calls.at(-1)?.[0]).toMatchObject({ status: "failed" });
  });
});

describe("executeChildTask context_row_id stamping", () => {
  beforeEach(() => {
    mockWhere.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockUpdateWhere.mockReset();
    mockUpdateWhere.mockResolvedValue(undefined);
    mockSet.mockReset();
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockClear();
    mockInsertValues.mockReset();
    mockInsertValues.mockResolvedValue(undefined);
    mockInsert.mockClear();
    mockStartTaskExecution.mockReset();
    mockStartTaskExecution.mockResolvedValue(undefined);
  });

  it("populates tasks.context_row_id from workflow.definition._contextRowId", async () => {
    const workflowId = "workflow-ctx-1";
    const workflow = {
      id: workflowId,
      name: "Row-attributed workflow",
      projectId: null,
      runNumber: null,
      definition: JSON.stringify({
        pattern: "sequence",
        steps: [],
        _blueprintId: "test-bp",
        _contextRowId: "row-xyz-789",
      }),
      status: "draft",
    };
    const completedTask = { id: "anything", status: "completed", result: "ok" };

    // mockWhere consumption order:
    // 1) executeChildTask: workflow lookup
    // 2) executeChildTask: completed task lookup at the end
    mockWhere
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([completedTask]);

    const { executeChildTask } = await import("../engine");

    await executeChildTask(
      workflowId,
      "Test step",
      "test prompt",
      undefined, // assignedAgent
      undefined, // agentProfile
      undefined, // parentTaskId
      undefined, // stepId
      undefined, // maxBudgetUsd
      "test-runtime-noop"
    );

    expect(mockInsertValues).toHaveBeenCalled();
    const insertedValues = mockInsertValues.mock.calls[0]?.[0];
    expect(insertedValues).toBeDefined();
    expect(insertedValues.contextRowId).toBe("row-xyz-789");
  });

  it("leaves context_row_id null when workflow definition has no _contextRowId", async () => {
    const workflowId = "workflow-ctx-2";
    const workflow = {
      id: workflowId,
      name: "No-context workflow",
      projectId: null,
      runNumber: null,
      definition: JSON.stringify({
        pattern: "sequence",
        steps: [],
        _blueprintId: "test-bp",
      }),
      status: "draft",
    };
    const completedTask = { id: "anything", status: "completed", result: "ok" };

    mockWhere
      .mockResolvedValueOnce([workflow])
      .mockResolvedValueOnce([completedTask]);

    const { executeChildTask } = await import("../engine");

    await executeChildTask(
      workflowId,
      "Step",
      "prompt",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "test-runtime-noop"
    );

    expect(mockInsertValues).toHaveBeenCalled();
    const insertedValues = mockInsertValues.mock.calls[0]?.[0];
    expect(insertedValues).toBeDefined();
    expect(insertedValues.contextRowId).toBeNull();
  });
});
