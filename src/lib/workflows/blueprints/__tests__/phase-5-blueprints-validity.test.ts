import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { getBlueprint, reloadBlueprints, getUserBlueprintsDir } from "../registry";

/**
 * Phase 5 blueprints live at `~/.ainative/blueprints/<id>.yaml` (gitignored,
 * authored as part of the row-trigger-blueprint-execution feature). vitest
 * setup overrides AINATIVE_DATA_DIR to a temp dir, so the registry would not
 * see them by default. Stage them into the test data dir before each suite
 * so we validate the ACTUAL ship YAML against BlueprintSchema rather than a
 * test-only fixture that could drift.
 */
const SOURCE_DIR = path.join(homedir(), ".ainative", "blueprints");
const TARGET_IDS = [
  "customer-follow-up-drafter--draft-followup",
  "research-digest--weekly-digest",
];

beforeAll(() => {
  const targetDir = getUserBlueprintsDir();
  fs.mkdirSync(targetDir, { recursive: true });
  for (const id of TARGET_IDS) {
    const src = path.join(SOURCE_DIR, `${id}.yaml`);
    if (!fs.existsSync(src)) {
      throw new Error(
        `Phase 5 blueprint missing at ${src}. Did Wave 3 author it under ~/.ainative/blueprints/?`
      );
    }
    fs.copyFileSync(src, path.join(targetDir, `${id}.yaml`));
  }
  reloadBlueprints();
});

describe("customer-follow-up-drafter--draft-followup blueprint", () => {
  it("loads from the user blueprints dir and parses cleanly", () => {
    const bp = getBlueprint("customer-follow-up-drafter--draft-followup");
    expect(bp).toBeDefined();
    expect(bp!.id).toBe("customer-follow-up-drafter--draft-followup");
    expect(bp!.steps.length).toBe(1);
    expect(bp!.variables.find((v) => v.id === "customer")).toBeDefined();
    expect(bp!.variables.find((v) => v.id === "summary")?.required).toBe(true);
  });
});

describe("research-digest--weekly-digest blueprint", () => {
  it("loads from the user blueprints dir and parses cleanly", () => {
    const bp = getBlueprint("research-digest--weekly-digest");
    expect(bp).toBeDefined();
    expect(bp!.id).toBe("research-digest--weekly-digest");
    expect(bp!.steps.length).toBe(1);
  });
});
