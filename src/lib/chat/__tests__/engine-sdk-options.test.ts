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

  it("does NOT include Task (subagent delegation replaced by ainative primitives)", () => {
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

import { canUseToolForTest, composeSkillPolicyForTest } from "@/lib/chat/engine";

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

describe("M4.5 compose-path Skill denial (composeSkillPolicyForTest)", () => {
  it("denies Skill when verdictKind is compose", () => {
    const result = composeSkillPolicyForTest("brainstorming", "compose");
    expect(result.behavior).toBe("deny");
  });

  it("includes the skill name in the deny message so the model knows what was blocked", () => {
    const result = composeSkillPolicyForTest("brainstorming", "compose");
    if (result.behavior !== "deny") throw new Error("expected deny");
    expect(result.message).toContain("brainstorming");
  });

  it("explains the alternative (direct composition tool calls) in the deny message", () => {
    const result = composeSkillPolicyForTest("product-manager", "compose");
    if (result.behavior !== "deny") throw new Error("expected deny");
    expect(result.message).toMatch(/create_profile|create_blueprint/);
  });

  it("allows Skill when verdictKind is conversation (no compose routing)", () => {
    const result = composeSkillPolicyForTest("brainstorming", "conversation");
    expect(result.behavior).toBe("allow");
  });

  it("allows Skill when verdictKind is scaffold (scaffold short-circuits the LLM anyway)", () => {
    const result = composeSkillPolicyForTest("brainstorming", "scaffold");
    expect(result.behavior).toBe("allow");
  });

  it("denies regardless of skill name when in compose — no allow-list escape hatch", () => {
    // A skill named "create_profile" shouldn't trick the policy into allowing
    const result = composeSkillPolicyForTest("create_profile", "compose");
    expect(result.behavior).toBe("deny");
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

describe("CLAUDE_SDK_* constants source-of-truth", () => {
  it("exports CLAUDE_SDK_ALLOWED_TOOLS from runtime/claude-sdk", async () => {
    const mod = await import("@/lib/agents/runtime/claude-sdk");
    expect(mod.CLAUDE_SDK_ALLOWED_TOOLS).toEqual([
      "Skill",
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "Bash",
      "TodoWrite",
    ]);
  });

  it("exports CLAUDE_SDK_SETTING_SOURCES from runtime/claude-sdk", async () => {
    const mod = await import("@/lib/agents/runtime/claude-sdk");
    expect(mod.CLAUDE_SDK_SETTING_SOURCES).toEqual(["user", "project"]);
  });

  it("exports CLAUDE_SDK_READ_ONLY_FS_TOOLS from runtime/claude-sdk", async () => {
    const mod = await import("@/lib/agents/runtime/claude-sdk");
    expect(mod.CLAUDE_SDK_READ_ONLY_FS_TOOLS).toEqual(new Set(["Read", "Grep", "Glob"]));
  });
});
