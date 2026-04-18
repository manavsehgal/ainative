import { describe, expect, it } from "vitest";
import { getFeaturesForModel, getRuntimeForModel } from "@/lib/chat/types";

describe("getFeaturesForModel", () => {
  it("returns Claude features for a Claude model id", () => {
    const features = getFeaturesForModel("sonnet");
    expect(features.hasNativeSkills).toBe(true);
    expect(features.autoLoadsInstructions).toBe("CLAUDE.md");
  });

  it("returns Ollama features for an ollama-prefixed model id", () => {
    const features = getFeaturesForModel("ollama:llama3");
    expect(features.ainativeInjectsSkills).toBe(true);
    expect(features.hasNativeSkills).toBe(false);
  });

  it("returns Codex features for a GPT model id", () => {
    const features = getFeaturesForModel("gpt-5.4");
    expect(features.autoLoadsInstructions).toBe("AGENTS.md");
  });

  it("falls back to claude-code features for an unknown model id", () => {
    // getRuntimeForModel's fallback chain lands on claude-code for unknown ids.
    const features = getFeaturesForModel("totally-made-up-model");
    expect(features.hasNativeSkills).toBe(true);
    expect(getRuntimeForModel("totally-made-up-model")).toBe("claude-code");
  });
});
