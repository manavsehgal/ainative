import { describe, expect, it } from "vitest";
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

  it("throws for unknown runtime ids", () => {
    expect(() => resolveAgentRuntime("unknown-runtime")).toThrow(
      "Unknown agent type: unknown-runtime"
    );
  });
});
