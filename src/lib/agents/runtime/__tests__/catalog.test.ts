import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCapabilities,
  getRuntimeCatalogEntry,
  listRuntimeCatalog,
  resolveAgentRuntime,
} from "@/lib/agents/runtime/catalog";

describe("runtime catalog", () => {
  it("defaults to the Claude runtime", () => {
    expect(resolveAgentRuntime()).toBe(DEFAULT_AGENT_RUNTIME);
  });

  it("returns runtime metadata and capabilities", () => {
    const runtime = getRuntimeCatalogEntry("claude-code");
    const capabilities = getRuntimeCapabilities("claude-code");

    expect(runtime.label).toBe("Claude Code");
    expect(capabilities.resume).toBe(true);
    expect(capabilities.profileTests).toBe(true);
  });

  it("lists the OpenAI Codex runtime", () => {
    const runtimes = listRuntimeCatalog();

    expect(runtimes.some((runtime) => runtime.id === "openai-codex-app-server")).toBe(
      true
    );
    expect(getRuntimeCapabilities("openai-codex-app-server").resume).toBe(true);
  });

  it("falls back to default for unknown runtime ids with a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveAgentRuntime("unknown-runtime");
    expect(result).toBe(DEFAULT_AGENT_RUNTIME);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown agent runtime")
    );
    warnSpy.mockRestore();
  });

  it("falls back to default for typo 'claude' instead of 'claude-code'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveAgentRuntime("claude");
    expect(result).toBe("claude-code");
    warnSpy.mockRestore();
  });
});
