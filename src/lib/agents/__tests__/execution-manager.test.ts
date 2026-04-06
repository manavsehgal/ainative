import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/license/manager", () => ({
  licenseManager: {
    getLimit: vi.fn().mockReturnValue(Infinity),
    getTier: vi.fn().mockReturnValue("scale"),
  },
}));

vi.mock("@/lib/license/notifications", () => ({
  createTierLimitNotification: vi.fn().mockResolvedValue(undefined),
}));

import {
  getExecution,
  setExecution,
  removeExecution,
  getAllExecutions,
  ParallelLimitError,
} from "@/lib/agents/execution-manager";

function makeExecution(taskId: string) {
  return {
    abortController: new AbortController(),
    sessionId: `session-${taskId}`,
    taskId,
    startedAt: new Date(),
  };
}

describe("execution-manager", () => {
  beforeEach(() => {
    // Clear all executions between tests
    for (const key of getAllExecutions().keys()) {
      removeExecution(key);
    }
  });

  it("returns undefined for non-existent task", () => {
    expect(getExecution("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves an execution", () => {
    const exec = makeExecution("task-1");
    setExecution("task-1", exec);
    expect(getExecution("task-1")).toBe(exec);
  });

  it("removes an execution", () => {
    setExecution("task-1", makeExecution("task-1"));
    removeExecution("task-1");
    expect(getExecution("task-1")).toBeUndefined();
  });

  it("returns all executions", () => {
    setExecution("task-1", makeExecution("task-1"));
    setExecution("task-2", makeExecution("task-2"));
    const all = getAllExecutions();
    expect(all.size).toBe(2);
    expect(all.has("task-1")).toBe(true);
    expect(all.has("task-2")).toBe(true);
  });

  it("overwrites execution for same taskId", () => {
    const exec1 = makeExecution("task-1");
    const exec2 = makeExecution("task-1");
    setExecution("task-1", exec1);
    setExecution("task-1", exec2);
    expect(getExecution("task-1")).toBe(exec2);
    expect(getAllExecutions().size).toBe(1);
  });

  it("removing non-existent task does not throw", () => {
    expect(() => removeExecution("nonexistent")).not.toThrow();
  });

  it("throws ParallelLimitError when limit is reached", async () => {
    const { licenseManager } = await import("@/lib/license/manager");
    (licenseManager.getLimit as ReturnType<typeof vi.fn>).mockReturnValue(2);
    (licenseManager.getTier as ReturnType<typeof vi.fn>).mockReturnValue("community");

    setExecution("task-1", makeExecution("task-1"));
    setExecution("task-2", makeExecution("task-2"));

    expect(() => setExecution("task-3", makeExecution("task-3"))).toThrow(ParallelLimitError);

    // Restore unlimited for other tests
    (licenseManager.getLimit as ReturnType<typeof vi.fn>).mockReturnValue(Infinity);
  });
});
