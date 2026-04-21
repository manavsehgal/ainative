import { describe, it, expect } from "vitest";
import { classifyMessage } from "../planner/classifier";

/**
 * Contract test for the M4.5 engine planner hook.
 *
 * Full SDK behavior is covered by the broader chat engine suite; this
 * test locks the classifier contract the engine depends on so that a
 * future refactor of the planner can't silently regress engine.ts
 * expectations.
 */
describe("M4.5 engine planner contract", () => {
  it("compose prompts yield ComposePlan verdicts", () => {
    const v = classifyMessage("build me a weekly portfolio check-in", {
      projectId: null,
      history: [],
    });
    expect(v.kind).toBe("compose");
  });

  it("scaffold prompts yield ScaffoldPlan verdicts with valid CreatePluginSpecInput", () => {
    const v = classifyMessage(
      "I need a tool that pulls my github issues",
      { projectId: null, history: [] }
    );
    expect(v.kind).toBe("scaffold");
    if (v.kind !== "scaffold") return;
    expect(v.plan.plugin).toMatchObject({
      id: expect.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/),
      name: expect.any(String),
      description: expect.any(String),
      transport: "stdio",
      language: "python",
    });
    expect(v.plan.plugin.tools.length).toBeGreaterThan(0);
    expect(v.plan.composeAltPrompt).toBeTruthy();
    expect(v.plan.explanation).toBeTruthy();
    expect(v.plan.rationale).toBeTruthy();
  });

  it("conversation prompts yield conversation verdicts", () => {
    const v = classifyMessage("hi, how are you?", {
      projectId: null,
      history: [],
    });
    expect(v.kind).toBe("conversation");
  });
});
