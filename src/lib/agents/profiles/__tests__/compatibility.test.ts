import { describe, expect, it } from "vitest";
import {
  getProfileRuntimeCompatibility,
  getSupportedRuntimes,
  profileSupportsRuntime,
  resolveProfileRuntimePayload,
} from "../compatibility";

const baseProfile = {
  id: "general",
  name: "General",
  skillMd: "# Shared instructions",
  supportedRuntimes: ["claude-code", "openai-codex-app-server"] as const,
  allowedTools: ["Read"],
  tests: [
    {
      task: "Summarize the task",
      expectedKeywords: ["summary"],
    },
  ],
};

describe("profile compatibility helpers", () => {
  it("defaults missing runtime coverage to Claude Code", () => {
    expect(getSupportedRuntimes({})).toEqual(["claude-code"]);
  });

  it("reports supported runtimes explicitly", () => {
    expect(getSupportedRuntimes(baseProfile)).toEqual([
      "claude-code",
      "openai-codex-app-server",
    ]);
  });

  it("detects unsupported runtime assignments", () => {
    expect(
      profileSupportsRuntime(
        { ...baseProfile, supportedRuntimes: ["claude-code"] },
        "openai-codex-app-server"
      )
    ).toBe(false);
  });

  it("resolves runtime-specific instruction overrides", () => {
    const payload = resolveProfileRuntimePayload(
      {
        ...baseProfile,
        runtimeOverrides: {
          "openai-codex-app-server": {
            instructions: "# Codex instructions",
            allowedTools: ["Read", "Bash"],
          },
        },
      },
      "openai-codex-app-server"
    );

    expect(payload.supported).toBe(true);
    expect(payload.instructions).toBe("# Codex instructions");
    expect(payload.instructionsSource).toBe("runtime-override");
    expect(payload.allowedTools).toEqual(["Read", "Bash"]);
  });

  it("returns an unsupported compatibility summary when runtime is blocked", () => {
    const compatibility = getProfileRuntimeCompatibility(
      {
        ...baseProfile,
        supportedRuntimes: ["claude-code"],
      },
      "openai-codex-app-server"
    );

    expect(compatibility.supported).toBe(false);
    expect(compatibility.reason).toContain("does not support");
  });
});
