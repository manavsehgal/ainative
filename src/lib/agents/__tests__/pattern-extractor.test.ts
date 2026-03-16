import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock infrastructure ──────────────────────────────────────────────

const {
  mockAll,
  mockLimit,
  mockOrderBy,
  mockWhere,
  mockFrom,
  mockSelect,
  mockValues,
  mockInsert,
} = vi.hoisted(() => {
  const mockAll = vi.fn();
  const mockLimit = vi.fn().mockReturnValue(mockAll);
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  return {
    mockAll,
    mockLimit,
    mockOrderBy,
    mockWhere,
    mockFrom,
    mockSelect,
    mockValues,
    mockInsert,
  };
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
    title: "title",
    description: "description",
    result: "result",
  },
  agentLogs: {
    taskId: "task_id",
    event: "event",
    payload: "payload",
    timestamp: "timestamp",
  },
  notifications: { id: "id" },
  learnedContext: {
    profileId: "profile_id",
    version: "version",
    changeType: "change_type",
    content: "content",
    proposalNotificationId: "proposal_notification_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: string, val: unknown) => ({ col: _col, val })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  desc: vi.fn((col: string) => ({ desc: col })),
}));

const {
  mockRunMetaCompletion,
  mockGetActiveLearnedContext,
  mockProposeContextAddition,
} = vi.hoisted(() => ({
  mockRunMetaCompletion: vi.fn(),
  mockGetActiveLearnedContext: vi.fn().mockReturnValue(null),
  mockProposeContextAddition: vi.fn().mockResolvedValue("notif-123"),
}));

vi.mock("../runtime/claude", () => ({
  runMetaCompletion: mockRunMetaCompletion,
}));

vi.mock("../learned-context", () => ({
  getActiveLearnedContext: mockGetActiveLearnedContext,
  proposeContextAddition: mockProposeContextAddition,
}));

import { analyzeForLearnedPatterns } from "../pattern-extractor";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue(mockAll);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockResolvedValue(undefined);
  mockGetActiveLearnedContext.mockReturnValue(null);
  mockProposeContextAddition.mockResolvedValue("notif-123");
});

// ═════════════════════════════════════════════════════════════════════

describe("analyzeForLearnedPatterns", () => {
  it("returns null when task not found", async () => {
    // Task query returns empty
    mockWhere.mockResolvedValueOnce([]);

    const result = await analyzeForLearnedPatterns("task-1", "general");

    expect(result).toBeNull();
    expect(mockRunMetaCompletion).not.toHaveBeenCalled();
  });

  it("proposes context when patterns are found", async () => {
    // Task query
    mockWhere.mockResolvedValueOnce([
      {
        title: "Fix auth bug",
        description: "Token validation was broken",
        result: "Fixed by adding null check",
      },
    ]);

    // Agent logs query (returns array directly from .limit())
    mockLimit.mockResolvedValueOnce([
      { event: "completed", payload: '{"result":"done"}' },
    ]);

    // runMetaCompletion returns JSON text with patterns
    mockRunMetaCompletion.mockResolvedValue({
      text: JSON.stringify([
        {
          title: "Null check tokens",
          description: "Always validate token existence before parsing",
          category: "error_resolution",
        },
      ]),
      usage: {},
    });

    const result = await analyzeForLearnedPatterns("task-1", "general");

    expect(result).toBe("notif-123");
    expect(mockRunMetaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ activityType: "pattern_extraction" })
    );
    expect(mockProposeContextAddition).toHaveBeenCalledWith(
      "general",
      "task-1",
      expect.stringContaining("Null check tokens")
    );
  });

  it("returns null when no patterns are found", async () => {
    mockWhere.mockResolvedValueOnce([
      { title: "Routine task", description: "Nothing special", result: "Done" },
    ]);
    mockLimit.mockResolvedValueOnce([]);

    mockRunMetaCompletion.mockResolvedValue({
      text: "[]",
      usage: {},
    });

    const result = await analyzeForLearnedPatterns("task-1", "general");

    expect(result).toBeNull();
    expect(mockProposeContextAddition).not.toHaveBeenCalled();
  });

  it("returns null when response has no valid JSON array", async () => {
    mockWhere.mockResolvedValueOnce([
      { title: "Task", description: "Desc", result: "Done" },
    ]);
    mockLimit.mockResolvedValueOnce([]);

    mockRunMetaCompletion.mockResolvedValue({
      text: "No patterns found in this task.",
      usage: {},
    });

    const result = await analyzeForLearnedPatterns("task-1", "general");

    expect(result).toBeNull();
  });

  it("passes existing learned context for dedup", async () => {
    mockWhere.mockResolvedValueOnce([
      { title: "Task", description: "Desc", result: "Done" },
    ]);
    mockLimit.mockResolvedValueOnce([]);
    mockGetActiveLearnedContext.mockReturnValue("Existing pattern: check nulls");

    mockRunMetaCompletion.mockResolvedValue({
      text: "[]",
      usage: {},
    });

    await analyzeForLearnedPatterns("task-1", "general");

    // Verify prompt includes existing context for dedup
    const callArgs = mockRunMetaCompletion.mock.calls[0][0];
    expect(callArgs.prompt).toContain("Existing pattern: check nulls");
  });

  it("formats multiple patterns correctly", async () => {
    mockWhere.mockResolvedValueOnce([
      { title: "Task", description: "Desc", result: "Done" },
    ]);
    mockLimit.mockResolvedValueOnce([]);

    mockRunMetaCompletion.mockResolvedValue({
      text: JSON.stringify([
        {
          title: "Pattern A",
          description: "Description A",
          category: "best_practice",
        },
        {
          title: "Pattern B",
          description: "Description B",
          category: "shortcut",
        },
      ]),
      usage: {},
    });

    await analyzeForLearnedPatterns("task-1", "code-reviewer");

    const additions = mockProposeContextAddition.mock.calls[0][2];
    expect(additions).toContain("### Pattern A [best_practice]");
    expect(additions).toContain("### Pattern B [shortcut]");
    expect(additions).toContain("Description A");
    expect(additions).toContain("Description B");
  });
});
