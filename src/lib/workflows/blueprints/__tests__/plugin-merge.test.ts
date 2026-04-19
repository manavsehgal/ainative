import { describe, it, expect, afterEach } from "vitest";
import {
  mergePluginBlueprints,
  clearPluginBlueprints,
  clearAllPluginBlueprints,
  validateBlueprintRefs,
  getBlueprint,
} from "../registry";
import type { WorkflowBlueprint } from "../types";

function fakeBlueprint(id: string, profileRef?: string): WorkflowBlueprint {
  return {
    id,
    name: id,
    description: "test",
    domain: "personal",
    pattern: "sequence",
    tags: [],
    difficulty: "easy",
    estimatedDuration: 5,
    isBuiltin: false,
    variables: [],
    steps: profileRef
      ? [{ id: "s1", name: "Step 1", profileId: profileRef, prompt: "" }]
      : [],
  } as unknown as WorkflowBlueprint;
}

describe("plugin blueprint merge", () => {
  afterEach(() => clearAllPluginBlueprints());

  it("registers blueprints with namespaced ids", () => {
    mergePluginBlueprints([
      { pluginId: "finance-pack", blueprint: fakeBlueprint("finance-pack/monthly-close") },
    ]);
    expect(getBlueprint("finance-pack/monthly-close")).toBeTruthy();
  });

  it("clearPluginBlueprints removes only that plugin's blueprints", () => {
    mergePluginBlueprints([
      { pluginId: "finance-pack", blueprint: fakeBlueprint("finance-pack/monthly-close") },
      { pluginId: "ops-pack", blueprint: fakeBlueprint("ops-pack/incident-runbook") },
    ]);
    clearPluginBlueprints("finance-pack");
    expect(getBlueprint("finance-pack/monthly-close")).toBeUndefined();
    expect(getBlueprint("ops-pack/incident-runbook")).toBeTruthy();
  });
});

describe("validateBlueprintRefs", () => {
  it("accepts builtin profile reference", () => {
    const bp = fakeBlueprint("finance-pack/x", "general"); // 'general' is a real builtin
    const result = validateBlueprintRefs(bp, {
      pluginId: "finance-pack",
      siblingProfileIds: new Set(),
    });
    expect(result.ok).toBe(true);
  });

  it("accepts same-plugin profile reference", () => {
    const bp = fakeBlueprint("finance-pack/x", "finance-pack/personal-cfo");
    const result = validateBlueprintRefs(bp, {
      pluginId: "finance-pack",
      siblingProfileIds: new Set(["finance-pack/personal-cfo"]),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects cross-plugin profile reference", () => {
    const bp = fakeBlueprint("finance-pack/x", "ops-pack/incident-lead");
    const result = validateBlueprintRefs(bp, {
      pluginId: "finance-pack",
      siblingProfileIds: new Set(),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ops-pack\/incident-lead/);
  });
});
