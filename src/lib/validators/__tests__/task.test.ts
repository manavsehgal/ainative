import { describe, it, expect } from "vitest";
import { createTaskSchema, updateTaskSchema } from "@/lib/validators/task";

describe("createTaskSchema", () => {
  it("accepts minimal valid input", () => {
    const result = createTaskSchema.safeParse({ title: "Do something" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(2); // default
    }
  });

  it("accepts full valid input", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      description: "Details",
      projectId: "proj-1",
      priority: 0,
      assignedAgent: "claude-code",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all supported runtime values", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      assignedAgent: "openai-codex-app-server",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported assignedAgent values", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      assignedAgent: "unknown-runtime",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 200 characters", () => {
    const result = createTaskSchema.safeParse({ title: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects description exceeding 2000 characters", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      description: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects priority below 0", () => {
    const result = createTaskSchema.safeParse({ title: "Test", priority: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects priority above 3", () => {
    const result = createTaskSchema.safeParse({ title: "Test", priority: 4 });
    expect(result.success).toBe(false);
  });

  it("accepts all valid priority values (0-3)", () => {
    for (const priority of [0, 1, 2, 3]) {
      const result = createTaskSchema.safeParse({ title: "Test", priority });
      expect(result.success).toBe(true);
    }
  });

  it("accepts fileIds as optional array of strings", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      fileIds: ["abc-123", "def-456"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileIds).toEqual(["abc-123", "def-456"]);
    }
  });

  it("accepts task without fileIds", () => {
    const result = createTaskSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileIds).toBeUndefined();
    }
  });

  it("accepts empty fileIds array", () => {
    const result = createTaskSchema.safeParse({ title: "Test", fileIds: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileIds).toEqual([]);
    }
  });

  it("rejects fileIds with non-string elements", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      fileIds: [123, true],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("accepts empty object", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status transitions", () => {
    const statuses = ["planned", "queued", "running", "completed", "failed", "cancelled"];
    for (const status of statuses) {
      const result = updateTaskSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = updateTaskSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });

  it("accepts result and sessionId fields", () => {
    const result = updateTaskSchema.safeParse({
      result: "Task output here",
      sessionId: "session-abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported assignedAgent values on update", () => {
    const result = updateTaskSchema.safeParse({
      assignedAgent: "unknown-runtime",
    });
    expect(result.success).toBe(false);
  });
});
