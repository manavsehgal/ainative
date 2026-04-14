import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("claude-agent.ts SDK options parity with chat engine", () => {
  const agentSource = fs.readFileSync(
    path.resolve(__dirname, "../claude-agent.ts"),
    "utf8",
  );

  // Split the source at the resumeClaudeTask function boundary. The first
  // half contains executeClaudeTask's query() block; the second half contains
  // resumeClaudeTask's query() block. This is more robust than a single
  // regex over the whole file — a future edit that adds a stray `canUseTool`
  // reference above either function won't cause a parity test to match the
  // wrong query() call.
  const resumeMarker = "export async function resumeClaudeTask";
  const splitIndex = agentSource.indexOf(resumeMarker);
  if (splitIndex === -1) {
    throw new Error(
      "claude-agent-sdk-options.test.ts: could not find `" + resumeMarker +
      "` in claude-agent.ts — rename or refactor broke this test's assumptions",
    );
  }
  const executeSection = agentSource.slice(0, splitIndex);
  const resumeSection = agentSource.slice(splitIndex);

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
    // The execute section must contain a query( call AND settingSources.
    expect(executeSection).toMatch(/query\(/);
    expect(executeSection).toContain("settingSources");
  });

  it("passes settingSources inside resumeClaudeTask query() options", () => {
    expect(resumeSection).toMatch(/query\(/);
    expect(resumeSection).toContain("settingSources");
  });

  it("hooks field is NOT present in either query() options block", () => {
    for (const section of [executeSection, resumeSection]) {
      expect(section).not.toMatch(/\bhooks\s*:/);
    }
  });
});
