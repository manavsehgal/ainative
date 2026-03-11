import { describe, it, expect, vi } from "vitest";
import { executeTaskWithAgent, resumeTaskWithAgent } from "@/lib/agents/router";

const throwIfUnknownRuntime = (agentType?: string | null) => {
  if (agentType === "unknown-agent") {
    throw new Error("Unknown agent type: unknown-agent");
  }
};

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn().mockImplementation(
    async (_taskId: string, agentType?: string | null) => {
      throwIfUnknownRuntime(agentType);
    }
  ),
  resumeTaskWithRuntime: vi.fn().mockImplementation(
    async (_taskId: string, agentType?: string | null) => {
      throwIfUnknownRuntime(agentType);
    }
  ),
}));

describe("executeTaskWithAgent", () => {
  it("delegates to the runtime registry for claude-code agent", async () => {
    const { executeTaskWithRuntime } = await import("@/lib/agents/runtime");
    await executeTaskWithAgent("task-1", "claude-code");
    expect(executeTaskWithRuntime).toHaveBeenCalledWith("task-1", "claude-code");
  });

  it("defaults to claude-code when no agent type specified", async () => {
    const { executeTaskWithRuntime } = await import("@/lib/agents/runtime");
    await executeTaskWithAgent("task-2");
    expect(executeTaskWithRuntime).toHaveBeenCalledWith("task-2", "claude-code");
  });

  it("throws for unknown agent type", async () => {
    await expect(
      executeTaskWithAgent("task-1", "unknown-agent")
    ).rejects.toThrow("Unknown agent type: unknown-agent");
  });
});

describe("resumeTaskWithAgent", () => {
  it("delegates to the runtime registry for claude-code agent", async () => {
    const { resumeTaskWithRuntime } = await import("@/lib/agents/runtime");
    await resumeTaskWithAgent("task-1", "claude-code");
    expect(resumeTaskWithRuntime).toHaveBeenCalledWith("task-1", "claude-code");
  });

  it("defaults to claude-code when no agent type specified", async () => {
    const { resumeTaskWithRuntime } = await import("@/lib/agents/runtime");
    await resumeTaskWithAgent("task-2");
    expect(resumeTaskWithRuntime).toHaveBeenCalledWith("task-2", "claude-code");
  });

  it("throws for unknown agent type", async () => {
    await expect(
      resumeTaskWithAgent("task-1", "unknown-agent")
    ).rejects.toThrow("Unknown agent type: unknown-agent");
  });
});
