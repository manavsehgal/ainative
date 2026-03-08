import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
};

const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

// Chain builders
mockDb.select.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockDb.update.mockReturnValue({ set: mockSet });
mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
mockDb.insert.mockReturnValue({ values: mockValues });
mockValues.mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/schema", () => ({
  tasks: { id: "id", status: "status", sessionId: "session_id", resumeCount: "resume_count" },
  agentLogs: {},
  notifications: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));
vi.mock("./execution-manager", () => ({
  setExecution: vi.fn(),
  removeExecution: vi.fn(),
}));

describe("resumeClaudeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if task has no sessionId", async () => {
    mockWhere.mockResolvedValueOnce([
      {
        id: "task-1",
        title: "Test",
        description: "desc",
        sessionId: null,
        resumeCount: 0,
      },
    ]);

    const { resumeClaudeTask } = await import("@/lib/agents/claude-agent");
    await expect(resumeClaudeTask("task-1")).rejects.toThrow(
      "No session to resume"
    );
  });

  it("throws if resume count is at limit", async () => {
    mockWhere.mockResolvedValueOnce([
      {
        id: "task-1",
        title: "Test",
        description: "desc",
        sessionId: "sess-123",
        resumeCount: 3,
      },
    ]);

    const { resumeClaudeTask } = await import("@/lib/agents/claude-agent");
    await expect(resumeClaudeTask("task-1")).rejects.toThrow(
      "Resume limit reached"
    );
  });

  it("throws if task not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { resumeClaudeTask } = await import("@/lib/agents/claude-agent");
    await expect(resumeClaudeTask("nonexistent")).rejects.toThrow(
      "not found"
    );
  });
});
