import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock infrastructure (vi.hoisted so vi.mock factories can reference them) ──

const {
  mockDb,
  mockFrom,
  mockWhere,
  mockSet,
  mockSetWhere,
  mockValues,
  mockSetExecution,
  mockRemoveExecution,
  mockGetAuthEnv,
  mockUpdateAuthStatus,
  mockPrepareTaskOutputDirectory,
  mockBuildTaskOutputInstructions,
  mockScanTaskOutputDocuments,
  mockGetProfile,
  mockIsToolAllowed,
  mockGetActiveLearnedContext,
  mockAnalyzeForLearnedPatterns,
  mockProcessSweepResult,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockSet = vi.fn();
  const mockSetWhere = vi.fn().mockResolvedValue(undefined);
  const mockValues = vi.fn();
  const mockDb = {
    select: vi.fn().mockReturnValue({ from: mockFrom }),
    update: vi.fn().mockReturnValue({ set: mockSet }),
    insert: vi.fn().mockReturnValue({ values: mockValues }),
  };
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSet.mockReturnValue({ where: mockSetWhere });
  mockValues.mockResolvedValue(undefined);
  const mockSetExecution = vi.fn();
  const mockRemoveExecution = vi.fn();
  const mockGetAuthEnv = vi.fn().mockResolvedValue(undefined);
  const mockUpdateAuthStatus = vi.fn().mockResolvedValue(undefined);
  const mockPrepareTaskOutputDirectory = vi.fn().mockResolvedValue("/tmp/stagent-outputs/task-1");
  const mockBuildTaskOutputInstructions = vi
    .fn()
    .mockReturnValue("Write outputs to /tmp/stagent-outputs/task-1");
  const mockScanTaskOutputDocuments = vi.fn().mockResolvedValue([]);
  const mockGetProfile = vi.fn().mockReturnValue({
    id: "general",
    name: "General",
    systemPrompt: "",
    allowedTools: undefined,
  });
  const mockIsToolAllowed = vi.fn().mockResolvedValue(false);
  const mockGetActiveLearnedContext = vi.fn().mockReturnValue(null);
  const mockAnalyzeForLearnedPatterns = vi.fn().mockResolvedValue(null);
  const mockProcessSweepResult = vi.fn().mockResolvedValue(undefined);
  return {
    mockDb,
    mockFrom,
    mockWhere,
    mockSet,
    mockSetWhere,
    mockValues,
    mockSetExecution,
    mockRemoveExecution,
    mockGetAuthEnv,
    mockUpdateAuthStatus,
    mockPrepareTaskOutputDirectory,
    mockBuildTaskOutputInstructions,
    mockScanTaskOutputDocuments,
    mockGetProfile,
    mockIsToolAllowed,
    mockGetActiveLearnedContext,
    mockAnalyzeForLearnedPatterns,
    mockProcessSweepResult,
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/schema", () => ({
  tasks: {
    id: "id",
    status: "status",
    sessionId: "session_id",
    resumeCount: "resume_count",
  },
  agentLogs: {},
  notifications: { id: "notif_id" },
  settings: { key: "key" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn((_col, val) => val) }));
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));
vi.mock("@/lib/agents/execution-manager", () => ({
  setExecution: mockSetExecution,
  removeExecution: mockRemoveExecution,
}));
vi.mock("@/lib/settings/auth", () => ({
  getAuthEnv: mockGetAuthEnv,
  updateAuthStatus: mockUpdateAuthStatus,
}));
vi.mock("@/lib/agents/profiles/registry", () => ({
  getProfile: mockGetProfile,
}));
vi.mock("@/lib/documents/context-builder", () => ({
  buildDocumentContext: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/documents/output-scanner", () => ({
  prepareTaskOutputDirectory: mockPrepareTaskOutputDirectory,
  buildTaskOutputInstructions: mockBuildTaskOutputInstructions,
  scanTaskOutputDocuments: mockScanTaskOutputDocuments,
}));
vi.mock("@/lib/settings/permissions", () => ({
  isToolAllowed: mockIsToolAllowed,
}));
vi.mock("@/lib/usage/ledger", () => ({
  extractUsageSnapshot: vi.fn().mockReturnValue({}),
  mergeUsageSnapshot: vi.fn((current: Record<string, unknown>, next: Record<string, unknown>) => ({
    ...current,
    ...next,
  })),
  recordUsageLedgerEntry: vi.fn().mockResolvedValue(undefined),
  resolveUsageActivityType: vi.fn().mockReturnValue("task_run"),
}));
vi.mock("@/lib/agents/learned-context", () => ({
  getActiveLearnedContext: mockGetActiveLearnedContext,
}));
vi.mock("@/lib/agents/pattern-extractor", () => ({
  analyzeForLearnedPatterns: mockAnalyzeForLearnedPatterns,
}));
vi.mock("@/lib/agents/sweep", () => ({
  processSweepResult: mockProcessSweepResult,
}));

// Static imports (works because vi.mock is hoisted)
import { query } from "@anthropic-ai/claude-agent-sdk";
import { executeClaudeTask, resumeClaudeTask } from "../claude-agent";

const mockQuery = vi.mocked(query);

// ─── Helpers ─────────────────────────────────────────────────────────

/** Create an async iterable from an array of message objects */
function createMockStream(
  messages: Record<string, unknown>[]
): AsyncIterable<Record<string, unknown>> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) {
        yield msg;
      }
    },
  };
}

/** Standard task object for tests */
function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Test description",
    projectId: null,
    workflowId: null,
    scheduleId: null,
    sessionId: null,
    resumeCount: 0,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  // Re-establish mock chains after clearAllMocks
  mockDb.select.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockDb.update.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockSetWhere });
  mockDb.insert.mockReturnValue({ values: mockValues });
  mockValues.mockResolvedValue(undefined);
  mockSetWhere.mockResolvedValue(undefined);
  mockPrepareTaskOutputDirectory.mockResolvedValue("/tmp/stagent-outputs/task-1");
  mockBuildTaskOutputInstructions.mockReturnValue(
    "Write outputs to /tmp/stagent-outputs/task-1"
  );
  mockScanTaskOutputDocuments.mockResolvedValue([]);
  mockGetProfile.mockReturnValue({
    id: "general",
    name: "General",
    systemPrompt: "",
    allowedTools: undefined,
  });
  mockIsToolAllowed.mockResolvedValue(false);
  mockGetActiveLearnedContext.mockReturnValue(null);
  mockAnalyzeForLearnedPatterns.mockResolvedValue(null);
  mockProcessSweepResult.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════
// Group A: executeClaudeTask + processAgentStream
// ═══════════════════════════════════════════════════════════════════════

describe("executeClaudeTask", () => {
  it("A1: throws if task not found", async () => {
    mockWhere.mockResolvedValueOnce([]);
    await expect(executeClaudeTask("nonexistent")).rejects.toThrow("not found");
  });

  it("A2: completes with result message — updates status, creates notification and log", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockQuery.mockReturnValue(
      createMockStream([
        { type: "result", result: "Task done successfully" },
      ]) as unknown as ReturnType<typeof query>
    );

    await executeClaudeTask("task-1");

    // Status updated to completed
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", result: "Task done successfully" })
    );
    // Notification created
    expect(mockDb.insert).toHaveBeenCalled();
    // removeExecution called in finally
    expect(mockRemoveExecution).toHaveBeenCalledWith("task-1");
  });

  it("A3: captures sessionId from init message and re-calls setExecution", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockQuery.mockReturnValue(
      createMockStream([
        { type: "system", subtype: "init", session_id: "sess-abc" },
        { type: "result", result: "done" },
      ]) as unknown as ReturnType<typeof query>
    );

    await executeClaudeTask("task-1");

    // sessionId saved to DB
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-abc" })
    );
    // setExecution called twice: initial + with sessionId
    expect(mockSetExecution).toHaveBeenCalledTimes(2);
    expect(mockSetExecution).toHaveBeenLastCalledWith(
      "task-1",
      expect.objectContaining({ sessionId: "sess-abc" })
    );
  });

  it("A4: logs stream events (content_block_start, content_block_delta, message_start)", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockQuery.mockReturnValue(
      createMockStream([
        { type: "stream_event", event: { type: "content_block_start", data: "x" } },
        { type: "stream_event", event: { type: "content_block_delta", data: "y" } },
        { type: "stream_event", event: { type: "message_start", data: "z" } },
        { type: "result", result: "done" },
      ]) as unknown as ReturnType<typeof query>
    );

    await executeClaudeTask("task-1");

    // 3 stream event logs + 1 completed log + 1 notification = 5 inserts
    expect(mockValues).toHaveBeenCalledTimes(5);
  });

  it("A5: logs tool_use from assistant messages", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockQuery.mockReturnValue(
      createMockStream([
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "Read", input: { path: "/foo" } },
            ],
          },
        },
        { type: "result", result: "done" },
      ]) as unknown as ReturnType<typeof query>
    );

    await executeClaudeTask("task-1");

    // tool_start log should have been inserted
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ event: "tool_start" })
    );
  });

  it("A6: JSON.stringify non-string result", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockQuery.mockReturnValue(
      createMockStream([
        { type: "result", result: { key: "value" } },
      ]) as unknown as ReturnType<typeof query>
    );

    await executeClaudeTask("task-1");

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ result: '{"key":"value"}' })
    );
  });

  it("A7: uses task.title when description is null", async () => {
    mockWhere.mockResolvedValueOnce([makeTask({ description: null })]);
    mockQuery.mockReturnValue(
      createMockStream([{ type: "result", result: "done" }]) as unknown as ReturnType<typeof query>
    );

    await executeClaudeTask("task-1");

    // query prompt should include output instructions and fall back to the title
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Write outputs to /tmp/stagent-outputs/task-1\n\nTest Task",
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Group B: handleExecutionError (via executeClaudeTask catch)
// ═══════════════════════════════════════════════════════════════════════

describe("handleExecutionError", () => {
  it("B1: sets status→failed, creates notification + error log on SDK error", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockQuery.mockImplementation(() => {
      return {
        async *[Symbol.asyncIterator]() {
          throw new Error("SDK connection failed");
        },
      } as unknown as ReturnType<typeof query>;
    });

    await executeClaudeTask("task-1");

    // Status set to failed
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", result: "SDK connection failed" })
    );
    // Notification created for failure
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task_failed" })
    );
    // Error log created
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ event: "error" })
    );
  });

  it("B2: sets status→cancelled when abort signal is aborted (no notification)", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    // Capture the abort controller and abort it before throwing
    mockSetExecution.mockImplementation((_taskId: string, execution: unknown) => {
      const ac = (execution as { abortController: AbortController }).abortController;
      ac.abort();
    });

    mockQuery.mockImplementation(() => {
      return {
        async *[Symbol.asyncIterator]() {
          throw new Error("Aborted");
        },
      } as unknown as ReturnType<typeof query>;
    });

    await executeClaudeTask("task-1");

    // Status set to cancelled
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
    // No notification or error log for cancellation
    expect(mockValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "task_failed" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Group C: resumeClaudeTask
// ═══════════════════════════════════════════════════════════════════════

describe("resumeClaudeTask", () => {
  it("throws if task not found", async () => {
    mockWhere.mockResolvedValueOnce([]);
    await expect(resumeClaudeTask("nonexistent")).rejects.toThrow("not found");
  });

  it("throws if task has no sessionId", async () => {
    mockWhere.mockResolvedValueOnce([makeTask({ sessionId: null })]);
    await expect(resumeClaudeTask("task-1")).rejects.toThrow(
      "No session to resume"
    );
  });

  it("throws if resume count is at limit", async () => {
    mockWhere.mockResolvedValueOnce([
      makeTask({ sessionId: "sess-123", resumeCount: 3 }),
    ]);
    await expect(resumeClaudeTask("task-1")).rejects.toThrow(
      "Resume limit reached"
    );
  });

  it("C1: resumes successfully — increments resumeCount, logs session_resumed, calls query with resume", async () => {
    mockWhere.mockResolvedValueOnce([
      makeTask({ sessionId: "sess-123", resumeCount: 1 }),
    ]);
    mockQuery.mockReturnValue(
      createMockStream([{ type: "result", result: "resumed ok" }]) as unknown as ReturnType<typeof query>
    );

    await resumeClaudeTask("task-1");

    // Resume count incremented
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ resumeCount: 2 })
    );
    // session_resumed log
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ event: "session_resumed" })
    );
    // query called with resume option
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ resume: "sess-123" }),
      })
    );
    // removeExecution in finally
    expect(mockRemoveExecution).toHaveBeenCalledWith("task-1");
  });

  it("C2: handles session expired error — sets failed, clears sessionId", async () => {
    mockWhere.mockResolvedValueOnce([
      makeTask({ sessionId: "sess-123", resumeCount: 0 }),
    ]);
    mockQuery.mockImplementation(() => {
      return {
        async *[Symbol.asyncIterator]() {
          throw new Error("session has expired");
        },
      } as unknown as ReturnType<typeof query>;
    });

    await resumeClaudeTask("task-1");

    // Status set to failed with session expired message
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        sessionId: null,
        result: "Session expired — re-queue for fresh start",
      })
    );
    // Notification created
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task_failed",
        title: expect.stringContaining("Session expired"),
      })
    );
  });

  it("C3: handles session not found error — same branch as C2", async () => {
    mockWhere.mockResolvedValueOnce([
      makeTask({ sessionId: "sess-123", resumeCount: 0 }),
    ]);
    mockQuery.mockImplementation(() => {
      return {
        async *[Symbol.asyncIterator]() {
          throw new Error("session not found");
        },
      } as unknown as ReturnType<typeof query>;
    });

    await resumeClaudeTask("task-1");

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", sessionId: null })
    );
  });

  it("C4: falls through to handleExecutionError for non-session errors", async () => {
    mockWhere.mockResolvedValueOnce([
      makeTask({ sessionId: "sess-123", resumeCount: 0 }),
    ]);
    mockQuery.mockImplementation(() => {
      return {
        async *[Symbol.asyncIterator]() {
          throw new Error("network timeout");
        },
      } as unknown as ReturnType<typeof query>;
    });

    await resumeClaudeTask("task-1");

    // Falls through to handleExecutionError → status failed
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", result: "network timeout" })
    );
    // Error log created (not session expired path)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ event: "error" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Group D: handleToolPermission (via canUseTool callback)
// ═══════════════════════════════════════════════════════════════════════

describe("handleToolPermission", () => {
  it("D1: creates permission_required notification for tool use", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string }>;

            // Poll will find this response on first check
            mockWhere.mockResolvedValueOnce([
              { id: "notif-1", response: JSON.stringify({ behavior: "allow" }) },
            ]);

            await canUseTool("Write", { path: "/test.ts" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    // Notification inserted with permission_required type
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "permission_required",
        title: "Permission required: Write",
      })
    );
  });

  it("D2: creates agent_message notification for AskUserQuestion", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string }>;

            mockWhere.mockResolvedValueOnce([
              { id: "notif-1", response: JSON.stringify({ behavior: "allow" }) },
            ]);

            await canUseTool("AskUserQuestion", { question: "What color?" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent_message",
        title: "Agent has a question",
      })
    );
  });

  it("D3: returns parsed JSON response from notification", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    let toolResult: unknown;
    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string }>;

            mockWhere.mockResolvedValueOnce([
              {
                id: "notif-1",
                response: JSON.stringify({
                  behavior: "allow",
                  updatedInput: { path: "/new.ts" },
                }),
              },
            ]);

            toolResult = await canUseTool("Write", { path: "/test.ts" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    expect(toolResult).toEqual({
      behavior: "allow",
      updatedInput: { path: "/new.ts" },
    });
  });

  it("D3b: fills in updatedInput when an allow response omits it", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    let toolResult: unknown;
    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string; updatedInput?: Record<string, unknown> }>;

            mockWhere.mockResolvedValueOnce([
              { id: "notif-1", response: JSON.stringify({ behavior: "allow" }) },
            ]);

            toolResult = await canUseTool("Write", { path: "/test.ts" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    expect(toolResult).toEqual({
      behavior: "allow",
      updatedInput: { path: "/test.ts" },
    });
  });

  it("D4: returns deny when response is invalid JSON", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    let toolResult: unknown;
    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string }>;

            mockWhere.mockResolvedValueOnce([
              { id: "notif-1", response: "not valid json {{{" },
            ]);

            toolResult = await canUseTool("Write", { path: "/test.ts" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    expect(toolResult).toEqual({
      behavior: "deny",
      message: "Invalid response format",
    });
  });

  it("D5: reuses an answered permission for identical repeated tool input", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);

    let firstResult: unknown;
    let secondResult: unknown;
    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string }>;

            mockWhere.mockResolvedValueOnce([
              { id: "notif-1", response: JSON.stringify({ behavior: "allow" }) },
            ]);

            firstResult = await canUseTool("Write", { path: "/test.ts" });
            secondResult = await canUseTool("Write", { path: "/test.ts" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    const permissionNotifications = mockValues.mock.calls.filter(
      ([value]) => (value as { type?: string }).type === "permission_required"
    );

    expect(firstResult).toEqual({
      behavior: "allow",
      updatedInput: { path: "/test.ts" },
    });
    expect(secondResult).toEqual({
      behavior: "allow",
      updatedInput: { path: "/test.ts" },
    });
    expect(permissionNotifications).toHaveLength(1);
  });

  it("D5b: auto-approved tools keep the original input in updatedInput", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockGetProfile.mockReturnValue({
      id: "general",
      name: "General",
      systemPrompt: "",
      canUseToolPolicy: {
        autoApprove: ["Bash"],
      },
    });

    let toolResult: unknown;
    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string; updatedInput?: Record<string, unknown> }>;

            toolResult = await canUseTool("Bash", {
              command: "mkdir -p /tmp/stagent-outputs/task-1",
            });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    expect(toolResult).toEqual({
      behavior: "allow",
      updatedInput: {
        command: "mkdir -p /tmp/stagent-outputs/task-1",
      },
    });
    expect(mockValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "permission_required" })
    );
  });

  it("D5c: saved tool permissions keep the original input in updatedInput", async () => {
    mockWhere.mockResolvedValueOnce([makeTask()]);
    mockIsToolAllowed.mockResolvedValue(true);

    let toolResult: unknown;
    mockQuery.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
        return {
          async *[Symbol.asyncIterator]() {
            const canUseTool = options.canUseTool as (
              toolName: string,
              input: Record<string, unknown>
            ) => Promise<{ behavior: string; updatedInput?: Record<string, unknown> }>;

            toolResult = await canUseTool("Write", { path: "/test.ts" });

            yield { type: "result", result: "done" };
          },
        } as unknown as ReturnType<typeof query>;
      }
    );

    await executeClaudeTask("task-1");

    expect(toolResult).toEqual({
      behavior: "allow",
      updatedInput: { path: "/test.ts" },
    });
    expect(mockValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "permission_required" })
    );
  });

  describe("D6: timeout behavior", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("auto-denies on timeout after 55s", async () => {
      mockWhere.mockResolvedValueOnce([makeTask()]);

      let toolResult: unknown;
      mockQuery.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ options }: any) => {
          return {
            async *[Symbol.asyncIterator]() {
              const canUseTool = options.canUseTool as (
                toolName: string,
                input: Record<string, unknown>
              ) => Promise<{ behavior: string }>;

              // Always return no response — notification never answered
              mockWhere.mockImplementation(() => {
                return Promise.resolve([
                  { id: "notif-1", response: null },
                ]) as unknown as ReturnType<typeof mockWhere>;
              });

              // Run canUseTool and timer advancement concurrently
              const toolPromise = canUseTool("Write", { path: "/test.ts" });

              // Advance past deadline: 55s / 1.5s intervals ≈ 37 polls
              for (let i = 0; i < 40; i++) {
                await vi.advanceTimersByTimeAsync(1500);
              }

              toolResult = await toolPromise;

              yield { type: "result", result: "done" };
            },
          } as unknown as ReturnType<typeof query>;
        }
      );

      await executeClaudeTask("task-1");

      expect(toolResult).toEqual({
        behavior: "deny",
        message: "Permission request timed out",
      });
    });

    it("reuses an in-flight permission request for identical input", async () => {
      mockWhere.mockResolvedValueOnce([makeTask()]);

      let releaseResponse: (() => void) | null = null;
      const pollStarted = new Promise<void>((resolve) => {
        releaseResponse = resolve;
      });

      let firstResult: unknown;
      let secondResult: unknown;

      mockQuery.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ options }: any) => {
          return {
            async *[Symbol.asyncIterator]() {
              const canUseTool = options.canUseTool as (
                toolName: string,
                input: Record<string, unknown>
              ) => Promise<{ behavior: string }>;

              mockWhere.mockImplementation(async () => {
                await pollStarted;
                return [
                  {
                    id: "notif-1",
                    response: JSON.stringify({ behavior: "allow" }),
                  },
                ];
              });

              const firstPromise = canUseTool("Write", { path: "/test.ts" });
              const secondPromise = canUseTool("Write", { path: "/test.ts" });

              await vi.advanceTimersByTimeAsync(0);
              releaseResponse?.();
              await vi.advanceTimersByTimeAsync(1500);

              [firstResult, secondResult] = await Promise.all([
                firstPromise,
                secondPromise,
              ]);

              yield { type: "result", result: "done" };
            },
          } as unknown as ReturnType<typeof query>;
        }
      );

      await executeClaudeTask("task-1");

      const permissionNotifications = mockValues.mock.calls.filter(
        ([value]) => (value as { type?: string }).type === "permission_required"
      );

      expect(firstResult).toEqual({
        behavior: "allow",
        updatedInput: { path: "/test.ts" },
      });
      expect(secondResult).toEqual({
        behavior: "allow",
        updatedInput: { path: "/test.ts" },
      });
      expect(permissionNotifications).toHaveLength(1);
    });
  });
});
