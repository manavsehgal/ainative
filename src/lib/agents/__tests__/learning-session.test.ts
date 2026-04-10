import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAll,
  mockLimit,
  mockOrderBy,
  mockWhere,
  mockFrom,
  mockSelect,
  mockValues,
  mockInsert,
  mockSetWhere,
  mockSet,
  mockUpdate,
  mockGetActiveLearnedContext,
  mockCheckContextSize,
  mockSummarizeContext,
} = vi.hoisted(() => {
  const mockAll = vi.fn();
  const mockLimit = vi.fn().mockReturnValue({ all: mockAll });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockWhere = vi.fn().mockReturnValue({ all: mockAll, orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockSetWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  return {
    mockAll,
    mockLimit,
    mockOrderBy,
    mockWhere,
    mockFrom,
    mockSelect,
    mockValues,
    mockInsert,
    mockSetWhere,
    mockSet,
    mockUpdate,
    mockGetActiveLearnedContext: vi.fn(),
    mockCheckContextSize: vi.fn(),
    mockSummarizeContext: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  learnedContext: {
    id: "id",
    profileId: "profile_id",
    changeType: "change_type",
    version: "version",
  },
  notifications: {
    id: "id",
    toolInput: "tool_input",
    type: "type",
    response: "response",
  },
  tasks: {
    workflowId: "workflow_id",
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: string, val: unknown) => ({ val })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  desc: vi.fn((col: string) => ({ desc: col })),
  isNull: vi.fn((col: string) => ({ isNull: col })),
}));

vi.mock("../learned-context", () => ({
  getActiveLearnedContext: mockGetActiveLearnedContext,
  checkContextSize: mockCheckContextSize,
  summarizeContext: mockSummarizeContext,
}));

import { batchApproveProposals } from "../learning-session";

describe("batchApproveProposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ all: mockAll, orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ all: mockAll });
    mockInsert.mockReturnValue({ values: mockValues });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockSetWhere });
    mockValues.mockResolvedValue(undefined);
    mockSetWhere.mockResolvedValue(undefined);
    mockGetActiveLearnedContext.mockReturnValue("Existing context");
    mockCheckContextSize.mockReturnValue({
      currentSize: 9000,
      limit: 8000,
      needsSummarization: true,
    });
    mockSummarizeContext.mockResolvedValue(undefined);
  });

  it("resolves without waiting for summarization and checks each profile once", async () => {
    let releaseSummaries: (() => void) | null = null;
    mockSummarizeContext.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseSummaries = resolve;
      })
    );

    mockAll
      .mockReturnValueOnce([
        {
          id: "proposal-1",
          profileId: "general",
          proposedAdditions: "First addition",
          sourceTaskId: "task-1",
          proposalNotificationId: null,
        },
      ])
      .mockReturnValueOnce([{ version: 2 }])
      .mockReturnValueOnce([
        {
          id: "proposal-2",
          profileId: "general",
          proposedAdditions: "Second addition",
          sourceTaskId: "task-2",
          proposalNotificationId: null,
        },
      ])
      .mockReturnValueOnce([{ version: 3 }])
      .mockReturnValueOnce([
        {
          id: "batch-notif-1",
          toolInput: JSON.stringify({ proposalIds: ["proposal-1", "proposal-2"] }),
        },
      ]);

    const result = await batchApproveProposals(["proposal-1", "proposal-2"]);

    expect(result).toBe(2);
    expect(mockCheckContextSize).toHaveBeenCalledTimes(1);
    expect(mockCheckContextSize).toHaveBeenCalledWith("general");
    expect(mockSummarizeContext).toHaveBeenCalledTimes(1);
    expect(mockSummarizeContext).toHaveBeenCalledWith("general");

    releaseSummaries?.();
  });
});
