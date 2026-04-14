import { describe, expect, it } from "vitest";
import {
  CLAUDE_SDK_ALLOWED_TOOLS,
  CLAUDE_SDK_SETTING_SOURCES,
  CLAUDE_SDK_READ_ONLY_FS_TOOLS,
} from "@/lib/chat/engine";

describe("Claude SDK options (Phase 1a)", () => {
  it("declares settingSources loading user and project config", () => {
    expect(CLAUDE_SDK_SETTING_SOURCES).toEqual(["user", "project"]);
  });

  it("includes Skill, filesystem tools, Bash, and TodoWrite in allowedTools", () => {
    expect(CLAUDE_SDK_ALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        "Skill",
        "Read",
        "Grep",
        "Glob",
        "Edit",
        "Write",
        "Bash",
        "TodoWrite",
      ])
    );
  });

  it("does NOT include Task (subagent delegation replaced by Stagent primitives)", () => {
    expect(CLAUDE_SDK_ALLOWED_TOOLS).not.toContain("Task");
  });

  it("declares Read, Grep, Glob as read-only filesystem tools", () => {
    expect(CLAUDE_SDK_READ_ONLY_FS_TOOLS).toEqual(
      new Set(["Read", "Grep", "Glob"])
    );
  });

  it("does NOT treat Edit, Write, Bash, or TodoWrite as read-only", () => {
    for (const tool of ["Edit", "Write", "Bash", "TodoWrite"]) {
      expect(CLAUDE_SDK_READ_ONLY_FS_TOOLS.has(tool)).toBe(false);
    }
  });
});

import { canUseToolForTest } from "@/lib/chat/engine";

describe("canUseTool auto-allow policy for SDK filesystem tools", () => {
  it("auto-allows Read without a permission request", async () => {
    const result = await canUseToolForTest("Read", { file_path: "/tmp/x" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Grep without a permission request", async () => {
    const result = await canUseToolForTest("Grep", { pattern: "foo" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Glob without a permission request", async () => {
    const result = await canUseToolForTest("Glob", { pattern: "**/*.ts" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Skill tool invocation", async () => {
    const result = await canUseToolForTest("Skill", { skill: "code-reviewer" });
    expect(result.behavior).toBe("allow");
  });

  it("does NOT auto-allow Edit (must go through permission flow)", async () => {
    const result = await canUseToolForTest("Edit", { file_path: "/tmp/x", content: "y" });
    expect(result.behavior).not.toBe("allow");
  });

  it("does NOT auto-allow Bash", async () => {
    const result = await canUseToolForTest("Bash", { command: "ls" });
    expect(result.behavior).not.toBe("allow");
  });
});

describe("hooks excluded per Q2", () => {
  it("does not declare a hooks field alongside settingSources", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const enginePath = path.resolve(__dirname, "../engine.ts");
    const source = fs.readFileSync(enginePath, "utf8");
    // Assert that within the query() options block, there is no `hooks:` field.
    // This is a regex-level check because the options object is inline literals.
    const optionsBlock = source.match(/query\(\s*\{[\s\S]*?\}\s*\)/)?.[0] ?? "";
    expect(optionsBlock).toContain("settingSources");
    expect(optionsBlock).not.toMatch(/\bhooks\s*:/);
  });
});
