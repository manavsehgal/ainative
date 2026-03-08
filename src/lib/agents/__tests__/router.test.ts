import { describe, it, expect, vi } from "vitest";
import { executeTaskWithAgent, resumeTaskWithAgent } from "@/lib/agents/router";

vi.mock("@/lib/agents/claude-agent", () => ({
  executeClaudeTask: vi.fn().mockResolvedValue(undefined),
  resumeClaudeTask: vi.fn().mockResolvedValue(undefined),
}));

describe("executeTaskWithAgent", () => {
  it("delegates to executeClaudeTask for claude-code agent", async () => {
    const { executeClaudeTask } = await import("@/lib/agents/claude-agent");
    await executeTaskWithAgent("task-1", "claude-code");
    expect(executeClaudeTask).toHaveBeenCalledWith("task-1");
  });

  it("defaults to claude-code when no agent type specified", async () => {
    const { executeClaudeTask } = await import("@/lib/agents/claude-agent");
    await executeTaskWithAgent("task-2");
    expect(executeClaudeTask).toHaveBeenCalledWith("task-2");
  });

  it("throws for unknown agent type", async () => {
    await expect(
      executeTaskWithAgent("task-1", "unknown-agent")
    ).rejects.toThrow("Unknown agent type: unknown-agent");
  });
});

describe("resumeTaskWithAgent", () => {
  it("delegates to resumeClaudeTask for claude-code agent", async () => {
    const { resumeClaudeTask } = await import("@/lib/agents/claude-agent");
    await resumeTaskWithAgent("task-1", "claude-code");
    expect(resumeClaudeTask).toHaveBeenCalledWith("task-1");
  });

  it("defaults to claude-code when no agent type specified", async () => {
    const { resumeClaudeTask } = await import("@/lib/agents/claude-agent");
    await resumeTaskWithAgent("task-2");
    expect(resumeClaudeTask).toHaveBeenCalledWith("task-2");
  });

  it("throws for unknown agent type", async () => {
    await expect(
      resumeTaskWithAgent("task-1", "unknown-agent")
    ).rejects.toThrow("Unknown agent type: unknown-agent");
  });
});
