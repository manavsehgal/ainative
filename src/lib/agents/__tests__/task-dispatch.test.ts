import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentLogs, notifications, tasks } from "@/lib/db/schema";
import { RetryableRuntimeLaunchError } from "@/lib/agents/runtime/launch-failure";

const {
  mockExecuteTaskWithRuntime,
  mockResumeTaskWithRuntime,
  mockResolveTaskExecutionTarget,
  mockResolveResumeExecutionTarget,
} = vi.hoisted(() => ({
  mockExecuteTaskWithRuntime: vi.fn(),
  mockResumeTaskWithRuntime: vi.fn(),
  mockResolveTaskExecutionTarget: vi.fn(),
  mockResolveResumeExecutionTarget: vi.fn(),
}));

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: mockExecuteTaskWithRuntime,
  resumeTaskWithRuntime: mockResumeTaskWithRuntime,
}));

vi.mock("@/lib/agents/runtime/execution-target", () => ({
  resolveTaskExecutionTarget: mockResolveTaskExecutionTarget,
  resolveResumeExecutionTarget: mockResolveResumeExecutionTarget,
}));

import { startTaskExecution } from "../task-dispatch";

function seedTask() {
  const id = randomUUID();
  const now = new Date();
  db.insert(tasks)
    .values({
      id,
      title: "Upgrade local clone",
      description: "Merge upstream changes safely",
      status: "queued",
      assignedAgent: "claude-code",
      agentProfile: "upgrade-assistant",
      priority: 2,
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

describe("startTaskExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.delete(notifications).run();
    db.delete(agentLogs).run();
    db.delete(tasks).run();
  });

  it("retries once on a retryable launch failure and persists the fallback runtime", async () => {
    const taskId = seedTask();

    mockResolveTaskExecutionTarget
      .mockResolvedValueOnce({
        requestedRuntimeId: "claude-code",
        effectiveRuntimeId: "claude-code",
        requestedModelId: null,
        effectiveModelId: null,
        fallbackApplied: false,
        fallbackReason: null,
      })
      .mockResolvedValueOnce({
        requestedRuntimeId: "claude-code",
        effectiveRuntimeId: "openai-codex-app-server",
        requestedModelId: null,
        effectiveModelId: null,
        fallbackApplied: false,
        fallbackReason: null,
      });

    mockExecuteTaskWithRuntime
      .mockRejectedValueOnce(
        new RetryableRuntimeLaunchError({
          runtimeId: "claude-code",
          message:
            "Claude Code failed to launch before task execution started: Claude Code process exited with code 1",
          cause: new Error("Claude Code process exited with code 1"),
        })
      )
      .mockResolvedValueOnce(undefined);

    await startTaskExecution(taskId, { requestedRuntimeId: "claude-code" });

    expect(mockExecuteTaskWithRuntime).toHaveBeenNthCalledWith(1, taskId, "claude-code");
    expect(mockExecuteTaskWithRuntime).toHaveBeenNthCalledWith(
      2,
      taskId,
      "openai-codex-app-server"
    );
    expect(mockResolveTaskExecutionTarget).toHaveBeenNthCalledWith(2, {
      title: "Upgrade local clone",
      description: "Merge upstream changes safely",
      requestedRuntimeId: "claude-code",
      profileId: "upgrade-assistant",
      unavailableRuntimeIds: ["claude-code"],
      unavailableReasons: {
        "claude-code":
          "Claude Code failed to launch before task execution started: Claude Code process exited with code 1",
      },
    });

    const row = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    expect(row?.status).toBe("running");
    expect(row?.effectiveRuntimeId).toBe("openai-codex-app-server");
    expect(row?.runtimeFallbackReason).toContain("Fell back to OpenAI Codex App Server.");

    const logs = db
      .select({ event: agentLogs.event, payload: agentLogs.payload })
      .from(agentLogs)
      .where(eq(agentLogs.taskId, taskId))
      .all();
    expect(logs.map((log) => log.event)).toContain("runtime_launch_failed");
    expect(logs.map((log) => log.event)).toContain("runtime_fallback");
  });

  it("marks the task failed when a retryable launch failure has no compatible alternate", async () => {
    const taskId = seedTask();

    mockResolveTaskExecutionTarget
      .mockResolvedValueOnce({
        requestedRuntimeId: "claude-code",
        effectiveRuntimeId: "claude-code",
        requestedModelId: null,
        effectiveModelId: null,
        fallbackApplied: false,
        fallbackReason: null,
      })
      .mockRejectedValueOnce(
        new Error("No compatible configured runtime is available for this task.")
      );

    mockExecuteTaskWithRuntime.mockRejectedValueOnce(
      new RetryableRuntimeLaunchError({
        runtimeId: "claude-code",
        message:
          "Claude Code failed to launch before task execution started: Claude Code process exited with code 1",
        cause: new Error("Claude Code process exited with code 1"),
      })
    );

    await expect(
      startTaskExecution(taskId, { requestedRuntimeId: "claude-code" })
    ).rejects.toThrow("No compatible configured runtime is available for this task.");

    const row = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    expect(row?.status).toBe("failed");
    expect(row?.result).toBe("No compatible configured runtime is available for this task.");

    const taskNotifications = db
      .select()
      .from(notifications)
      .where(eq(notifications.taskId, taskId))
      .all();
    expect(taskNotifications).toHaveLength(1);
  });
});
