import { describe, it, expect } from "vitest";
import {
  renderBlueprintPrompt,
  UnresolvedTokenError,
} from "../render-prompt";
import type { WorkflowBlueprint } from "../types";

function makeBlueprint(
  overrides: Partial<WorkflowBlueprint> = {}
): WorkflowBlueprint {
  return {
    id: "test-bp",
    name: "Test Blueprint",
    description: "A blueprint for tests",
    version: "1.0.0",
    domain: "work",
    tags: [],
    pattern: "sequence",
    variables: [],
    steps: [],
    ...overrides,
  };
}

describe("renderBlueprintPrompt", () => {
  it("uses chatPrompt when present", () => {
    const bp = makeBlueprint({
      chatPrompt: "Research {{topic}} for {{timeframe}}.",
      steps: [
        { name: "s1", promptTemplate: "fallback should not be used", requiresApproval: false },
      ],
    });
    const out = renderBlueprintPrompt(bp, { topic: "AI agents", timeframe: "2026" });
    expect(out.firstMessage).toBe("Research AI agents for 2026.");
  });

  it("falls back to steps[0].promptTemplate when chatPrompt absent", () => {
    const bp = makeBlueprint({
      steps: [
        {
          name: "s1",
          promptTemplate: "Summarize {{topic}} in ≤500 words.",
          requiresApproval: false,
        },
      ],
    });
    const out = renderBlueprintPrompt(bp, { topic: "browser agents" });
    expect(out.firstMessage).toBe("Summarize browser agents in ≤500 words.");
  });

  it("renders title with variable substitution", () => {
    const bp = makeBlueprint({
      name: "Research {{topic}}",
      chatPrompt: "go",
    });
    const out = renderBlueprintPrompt(bp, { topic: "SSE streams" });
    expect(out.title).toBe("Research SSE streams");
  });

  it("returns empty firstMessage when no chatPrompt and no steps", () => {
    const bp = makeBlueprint({ steps: [] });
    const out = renderBlueprintPrompt(bp, {});
    expect(out.firstMessage).toBe("");
    expect(out.title).toBe("Test Blueprint");
  });

  it("substitutes missing optional variables with empty string (non-strict)", () => {
    const bp = makeBlueprint({
      chatPrompt: "Topic: {{topic}}. Scope: {{scope}}.",
    });
    const out = renderBlueprintPrompt(bp, { topic: "rate limits" });
    expect(out.firstMessage).toBe("Topic: rate limits. Scope: .");
  });

  it("handles {{#if}} conditional blocks", () => {
    const bp = makeBlueprint({
      chatPrompt:
        "Base prompt.{{#if extra}}\n\nExtra: {{extra}}{{/if}}",
    });
    const withExtra = renderBlueprintPrompt(bp, { extra: "deep dive" });
    expect(withExtra.firstMessage).toBe("Base prompt.\n\nExtra: deep dive");

    const withoutExtra = renderBlueprintPrompt(bp, {});
    expect(withoutExtra.firstMessage).toBe("Base prompt.");
  });

  it("throws UnresolvedTokenError in strict mode when token is missing", () => {
    const bp = makeBlueprint({
      chatPrompt: "Hello {{name}}, today is {{date}}.",
    });
    expect(() =>
      renderBlueprintPrompt(bp, { name: "Ada" }, { strict: true })
    ).toThrow(UnresolvedTokenError);

    try {
      renderBlueprintPrompt(bp, { name: "Ada" }, { strict: true });
    } catch (err) {
      expect(err).toBeInstanceOf(UnresolvedTokenError);
      expect((err as UnresolvedTokenError).tokens).toEqual(["date"]);
    }
  });

  it("does not throw in strict mode when all tokens resolve", () => {
    const bp = makeBlueprint({
      chatPrompt: "Hello {{name}}.",
    });
    const out = renderBlueprintPrompt(
      bp,
      { name: "Ada" },
      { strict: true }
    );
    expect(out.firstMessage).toBe("Hello Ada.");
  });

  it("strict mode treats empty-string values as resolved (not unresolved)", () => {
    // Empty string is a resolved-to-empty substitution, distinct from an
    // undefined variable which leaves {{token}} in the output string.
    const bp = makeBlueprint({
      chatPrompt: "Name: [{{name}}]",
    });
    const out = renderBlueprintPrompt(bp, { name: "" }, { strict: true });
    expect(out.firstMessage).toBe("Name: []");
  });
});
