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
  mockSetWhere,
  mockSet,
  mockUpdate,
} = vi.hoisted(() => {
  const mockAll = vi.fn();
  const mockLimit = vi.fn().mockReturnValue({ all: mockAll });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, all: mockAll });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy, all: mockAll });
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
    profileId: "profile_id",
    version: "version",
    changeType: "change_type",
    content: "content",
    proposalNotificationId: "proposal_notification_id",
  },
  notifications: {
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: string, val: unknown) => ({ col: _col, val })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  desc: vi.fn((col: string) => ({ desc: col })),
  sql: Object.assign((strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(""), { raw: (s: string) => s }),
}));

// Mock runMetaCompletion for summarization
const { mockRunMetaCompletion } = vi.hoisted(() => ({
  mockRunMetaCompletion: vi.fn(),
}));
vi.mock("../runtime/claude", () => ({
  runMetaCompletion: mockRunMetaCompletion,
}));

vi.mock("@/lib/settings/helpers", () => ({
  getSettingSync: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/constants/settings", () => ({
  SETTINGS_KEYS: {
    LEARNING_CONTEXT_CHAR_LIMIT: "learning.contextCharLimit",
  },
}));

vi.mock("@/lib/license/limit-check", () => ({
  checkLimit: vi.fn().mockReturnValue({ allowed: true, current: 0, limit: 10, tier: "community", requiredTier: "community" }),
}));

vi.mock("@/lib/license/limit-queries", () => ({
  getContextVersionCount: vi.fn().mockReturnValue(0),
}));

vi.mock("@/lib/license/notifications", () => ({
  createTierLimitNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import under test ────────────────────────────────────────────────

import {
  getActiveLearnedContext,
  getContextHistory,
  proposeContextAddition,
  approveProposal,
  rejectProposal,
  rollbackToVersion,
  checkContextSize,
  summarizeContext,
  addDirectContext,
} from "../learned-context";

// ─── Helpers ──────────────────────────────────────────────────────────

function resetMockChain() {
  mockAll.mockReset();
  mockLimit.mockReset().mockReturnValue({ all: mockAll });
  mockOrderBy.mockReset().mockReturnValue({ limit: mockLimit, all: mockAll });
  mockWhere.mockReset().mockReturnValue({ orderBy: mockOrderBy, all: mockAll });
  mockFrom.mockReset().mockReturnValue({ where: mockWhere });
  mockSelect.mockReset().mockReturnValue({ from: mockFrom });
  mockValues.mockReset().mockResolvedValue(undefined);
  mockInsert.mockReset().mockReturnValue({ values: mockValues });
  mockSetWhere.mockReset().mockResolvedValue(undefined);
  mockSet.mockReset().mockReturnValue({ where: mockSetWhere });
  mockUpdate.mockReset().mockReturnValue({ set: mockSet });
  mockRunMetaCompletion.mockReset();
}

beforeEach(resetMockChain);

// ═════════════════════════════════════════════════════════════════════
// getActiveLearnedContext
// ═════════════════════════════════════════════════════════════════════

describe("getActiveLearnedContext", () => {
  it("returns content from the latest approved version", () => {
    mockAll.mockReturnValue([{ content: "Use retry pattern for flaky APIs" }]);

    const result = getActiveLearnedContext("code-reviewer");

    expect(result).toBe("Use retry pattern for flaky APIs");
  });

  it("returns null when no approved context exists", () => {
    mockAll.mockReturnValue([]);

    const result = getActiveLearnedContext("general");

    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// getContextHistory
// ═════════════════════════════════════════════════════════════════════

describe("getContextHistory", () => {
  it("returns all versions ordered by version descending", async () => {
    const rows = [
      { id: "v3", profileId: "general", version: 3, changeType: "approved" },
      { id: "v2", profileId: "general", version: 2, changeType: "proposal" },
      { id: "v1", profileId: "general", version: 1, changeType: "approved" },
    ];
    mockAll.mockReturnValue(rows);

    const result = await getContextHistory("general");

    expect(result).toEqual(rows);
    expect(result).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// proposeContextAddition
// ═════════════════════════════════════════════════════════════════════

describe("proposeContextAddition", () => {
  it("inserts a proposal row and a notification", async () => {
    // getNextVersion query returns no existing versions
    mockAll.mockReturnValue([]);

    const notificationId = await proposeContextAddition(
      "code-reviewer",
      "task-42",
      "Always check for null pointers"
    );

    expect(notificationId).toBeDefined();
    expect(typeof notificationId).toBe("string");

    // Two inserts: learned_context row + notification
    expect(mockInsert).toHaveBeenCalledTimes(2);

    // Proposal row has correct shape
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "code-reviewer",
        version: 1,
        content: null, // not yet approved
        diff: "Always check for null pointers",
        changeType: "proposal",
        sourceTaskId: "task-42",
        proposedAdditions: "Always check for null pointers",
      })
    );

    // Notification has correct type
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "context_proposal",
        title: "Context proposal for code-reviewer",
      })
    );
  });

  it("increments version based on existing versions", async () => {
    mockAll.mockReturnValue([{ version: 5 }]);

    await proposeContextAddition("general", "task-1", "New pattern");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ version: 6 })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// approveProposal
// ═════════════════════════════════════════════════════════════════════

describe("approveProposal", () => {
  it("merges additions into current context and creates approved version", async () => {
    // First call: find proposal by notification ID
    mockAll
      .mockReturnValueOnce([
        {
          id: "proposal-1",
          profileId: "general",
          proposedAdditions: "New pattern: use early returns",
          sourceTaskId: "task-1",
        },
      ])
      // Second call: getActiveLearnedContext (existing context)
      .mockReturnValueOnce([{ content: "Existing pattern: validate inputs" }])
      // Third call: getNextVersion
      .mockReturnValueOnce([{ version: 2 }])
      // Fourth call: checkContextSize -> getActiveLearnedContext
      .mockReturnValueOnce([
        { content: "Existing pattern: validate inputs\n\nNew pattern: use early returns" },
      ]);

    await approveProposal("notif-1");

    // Approved version inserted with merged content
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: "approved",
        content: "Existing pattern: validate inputs\n\nNew pattern: use early returns",
        diff: "New pattern: use early returns",
        approvedBy: "human",
      })
    );

    // Notification marked as responded
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        response: JSON.stringify({ action: "approved" }),
      })
    );
  });

  it("throws if proposal not found", async () => {
    mockAll.mockReturnValue([]);

    await expect(approveProposal("notif-nonexistent")).rejects.toThrow(
      "Proposal not found"
    );
  });

  it("uses editedContent when provided", async () => {
    mockAll
      .mockReturnValueOnce([
        {
          id: "proposal-1",
          profileId: "general",
          proposedAdditions: "Original text",
          sourceTaskId: "task-1",
        },
      ])
      .mockReturnValueOnce([]) // no existing context
      .mockReturnValueOnce([]) // no existing versions
      .mockReturnValueOnce([{ content: "Edited by human" }]); // checkContextSize

    await approveProposal("notif-1", "Edited by human");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Edited by human",
        diff: "Edited by human",
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// rejectProposal
// ═════════════════════════════════════════════════════════════════════

describe("rejectProposal", () => {
  it("creates rejected version and marks notification responded", async () => {
    mockAll
      .mockReturnValueOnce([
        {
          id: "proposal-1",
          profileId: "general",
          proposedAdditions: "Bad pattern",
          sourceTaskId: "task-1",
        },
      ])
      // getActiveLearnedContext for preserving current content
      .mockReturnValueOnce([{ content: "Good pattern" }])
      // getNextVersion
      .mockReturnValueOnce([{ version: 3 }]);

    await rejectProposal("notif-1");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: "rejected",
        diff: "Bad pattern",
      })
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        response: JSON.stringify({ action: "rejected" }),
      })
    );
  });

  it("throws if proposal not found", async () => {
    mockAll.mockReturnValue([]);

    await expect(rejectProposal("notif-nonexistent")).rejects.toThrow(
      "Proposal not found"
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// rollbackToVersion
// ═════════════════════════════════════════════════════════════════════

describe("rollbackToVersion", () => {
  it("creates a new version with the target version's content", async () => {
    mockAll
      // Find target version
      .mockReturnValueOnce([
        { id: "v2", profileId: "general", version: 2, content: "Version 2 content" },
      ])
      // getNextVersion
      .mockReturnValueOnce([{ version: 5 }]);

    await rollbackToVersion("general", 2);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "general",
        version: 6,
        content: "Version 2 content",
        diff: "Rolled back to version 2",
        changeType: "rollback",
      })
    );
  });

  it("throws if target version not found", async () => {
    mockAll.mockReturnValue([]);

    await expect(rollbackToVersion("general", 999)).rejects.toThrow(
      "Version 999 not found"
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// checkContextSize
// ═════════════════════════════════════════════════════════════════════

describe("checkContextSize", () => {
  it("reports size and summarization need", () => {
    mockAll.mockReturnValue([{ content: "x".repeat(7000) }]);

    const result = checkContextSize("general");

    expect(result.currentSize).toBe(7000);
    expect(result.limit).toBe(8000);
    expect(result.needsSummarization).toBe(true);
  });

  it("reports no summarization needed for small context", () => {
    mockAll.mockReturnValue([{ content: "small" }]);

    const result = checkContextSize("general");

    expect(result.currentSize).toBe(5);
    expect(result.needsSummarization).toBe(false);
  });

  it("handles no context gracefully", () => {
    mockAll.mockReturnValue([]);

    const result = checkContextSize("general");

    expect(result.currentSize).toBe(0);
    expect(result.needsSummarization).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// summarizeContext
// ═════════════════════════════════════════════════════════════════════

describe("summarizeContext", () => {
  it("calls runMetaCompletion to summarize and inserts a summarization version", async () => {
    const longContent = "x".repeat(7000);
    mockAll
      // getActiveLearnedContext
      .mockReturnValueOnce([{ content: longContent }])
      // getNextVersion
      .mockReturnValueOnce([{ version: 4 }]);

    mockRunMetaCompletion.mockResolvedValue({
      text: "condensed version",
      usage: {},
    });

    await summarizeContext("general");

    expect(mockRunMetaCompletion).toHaveBeenCalledOnce();
    expect(mockRunMetaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ activityType: "context_summarization" })
    );
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: "summarization",
        content: "condensed version",
      })
    );
  });

  it("skips summarization when content is below threshold", async () => {
    mockAll.mockReturnValue([{ content: "short" }]);

    await summarizeContext("general");

    expect(mockRunMetaCompletion).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips if summarized text is longer than original", async () => {
    const longContent = "x".repeat(7000);
    mockAll.mockReturnValueOnce([{ content: longContent }]);

    mockRunMetaCompletion.mockResolvedValue({
      text: "x".repeat(8000),
      usage: {},
    });

    await summarizeContext("general");

    // No insert because summarized is longer
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════
// addDirectContext
// ═════════════════════════════════════════════════════════════════════

describe("addDirectContext", () => {
  it("merges new content with existing and creates approved version", async () => {
    mockAll
      // getActiveLearnedContext
      .mockReturnValueOnce([{ content: "Existing" }])
      // getNextVersion
      .mockReturnValueOnce([{ version: 1 }])
      // checkContextSize -> getActiveLearnedContext
      .mockReturnValueOnce([{ content: "Existing\n\nNew pattern" }]);

    await addDirectContext("general", "New pattern");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Existing\n\nNew pattern",
        diff: "New pattern",
        changeType: "approved",
        approvedBy: "human",
      })
    );
  });

  it("handles first context addition (no existing content)", async () => {
    mockAll
      .mockReturnValueOnce([]) // no existing context
      .mockReturnValueOnce([]) // no existing versions
      .mockReturnValueOnce([{ content: "First pattern" }]); // checkContextSize

    await addDirectContext("general", "First pattern");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "First pattern",
        version: 1,
      })
    );
  });
});
