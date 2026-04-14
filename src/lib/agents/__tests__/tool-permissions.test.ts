import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}));

vi.mock("@/lib/settings/permissions", () => ({
  isToolAllowed: vi.fn().mockResolvedValue(false),
}));

import { handleToolPermission, clearPermissionCache } from "@/lib/agents/tool-permissions";

describe("handleToolPermission — SDK filesystem and Skill auto-allow", () => {
  beforeEach(() => {
    clearPermissionCache("test-task");
    clearPermissionCache("test-task-edit");
  });

  it("auto-allows Read without creating a notification", async () => {
    const result = await handleToolPermission("test-task", "Read", { file_path: "/tmp/x" });
    expect(result.behavior).toBe("allow");
    expect(result.updatedInput).toEqual({ file_path: "/tmp/x" });
  });

  it("auto-allows Grep", async () => {
    const result = await handleToolPermission("test-task", "Grep", { pattern: "foo" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Glob", async () => {
    const result = await handleToolPermission("test-task", "Glob", { pattern: "**/*.ts" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Skill invocations", async () => {
    const result = await handleToolPermission("test-task", "Skill", { skill: "code-reviewer" });
    expect(result.behavior).toBe("allow");
  });

  it("does NOT auto-allow Edit (must route through notification flow)", async () => {
    const { db } = await import("@/lib/db");
    const insertSpy = vi.spyOn(db, "insert");
    handleToolPermission("test-task-edit", "Edit", { file_path: "/tmp/x", content: "y" });
    await new Promise((r) => setTimeout(r, 10));
    expect(insertSpy).toHaveBeenCalled();
  });

  it("profile autoDeny for Read wins over auto-allow", async () => {
    const result = await handleToolPermission(
      "test-task",
      "Read",
      { file_path: "/tmp/x" },
      { autoApprove: [], autoDeny: ["Read"] },
    );
    expect(result.behavior).toBe("deny");
  });
});
