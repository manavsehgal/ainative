import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("claude-agent.ts SDK options parity with chat engine", () => {
  const agentSource = fs.readFileSync(
    path.resolve(__dirname, "../claude-agent.ts"),
    "utf8",
  );

  it("imports CLAUDE_SDK_ALLOWED_TOOLS from runtime/claude-sdk", () => {
    expect(agentSource).toMatch(/CLAUDE_SDK_ALLOWED_TOOLS[\s\S]*runtime\/claude-sdk/);
  });

  it("imports CLAUDE_SDK_SETTING_SOURCES from runtime/claude-sdk", () => {
    expect(agentSource).toMatch(/CLAUDE_SDK_SETTING_SOURCES[\s\S]*runtime\/claude-sdk/);
  });

  it("imports getFeaturesForModel to gate native-skill options", () => {
    expect(agentSource).toMatch(/getFeaturesForModel/);
  });

  it("passes settingSources inside executeClaudeTask query() options", () => {
    // Extract the first query() call (executeClaudeTask's)
    const queryBlocks = agentSource.match(/query\(\s*\{[\s\S]*?canUseTool/g);
    expect(queryBlocks).toBeTruthy();
    expect(queryBlocks![0]).toContain("settingSources");
  });

  it("passes settingSources inside resumeClaudeTask query() options", () => {
    const queryBlocks = agentSource.match(/query\(\s*\{[\s\S]*?canUseTool/g);
    expect(queryBlocks).toBeTruthy();
    expect(queryBlocks!.length).toBeGreaterThanOrEqual(2);
    expect(queryBlocks![1]).toContain("settingSources");
  });

  it("hooks field is NOT present in either query() options block", () => {
    const queryBlocks = agentSource.match(/query\(\s*\{[\s\S]*?canUseTool/g) ?? [];
    for (const block of queryBlocks) {
      expect(block).not.toMatch(/\bhooks\s*:/);
    }
  });
});
