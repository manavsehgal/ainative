import { describe, expect, it } from "vitest";
import {
  detectComposedApp,
  extractAppIdFromArtifactId,
} from "../composition-detector";
import type { ToolResultCapture } from "@/lib/chat/entity-detector";

function call(toolName: string, result: unknown): ToolResultCapture {
  return { toolName, result };
}

describe("extractAppIdFromArtifactId", () => {
  it("parses the prefix before double-hyphen", () => {
    expect(extractAppIdFromArtifactId("wealth-tracker--portfolio-coach")).toBe("wealth-tracker");
    expect(extractAppIdFromArtifactId("reading-list--weekly-review")).toBe("reading-list");
  });

  it("returns null when id lacks the namespace convention", () => {
    expect(extractAppIdFromArtifactId("portfolio-coach")).toBeNull();
    expect(extractAppIdFromArtifactId("")).toBeNull();
    expect(extractAppIdFromArtifactId(undefined)).toBeNull();
  });

  it("only splits on the first occurrence", () => {
    expect(extractAppIdFromArtifactId("a--b--c")).toBe("a");
  });
});

describe("detectComposedApp", () => {
  const profileCall = call("create_profile", { id: "wealth-tracker--coach", name: "Coach" });
  const blueprintCall = call("create_blueprint", { id: "wealth-tracker--review", name: "Weekly Review" });
  const tableCall = call("create_table", { id: "wealth-tracker--positions", name: "Positions" });
  const scheduleCall = call("create_schedule", { id: "wealth-tracker--monday", name: "Monday 8am" });

  it("returns null when no tool calls match", () => {
    expect(detectComposedApp([])).toBeNull();
    expect(detectComposedApp([call("create_task", { id: "t1", title: "T1" })])).toBeNull();
  });

  it("returns null when only a profile call fires", () => {
    expect(detectComposedApp([profileCall])).toBeNull();
  });

  it("returns null when only a blueprint call fires", () => {
    expect(detectComposedApp([blueprintCall])).toBeNull();
  });

  it("returns null when profile+blueprint exist but no table or schedule", () => {
    expect(detectComposedApp([profileCall, blueprintCall])).toBeNull();
  });

  it("detects profile+blueprint+table for the same app-id", () => {
    const app = detectComposedApp([profileCall, blueprintCall, tableCall]);
    expect(app).not.toBeNull();
    expect(app?.appId).toBe("wealth-tracker");
    expect(app?.hasProfile).toBe(true);
    expect(app?.hasBlueprint).toBe(true);
    expect(app?.tableCount).toBe(1);
    expect(app?.scheduleCount).toBe(0);
  });

  it("detects profile+blueprint+schedule for the same app-id", () => {
    const app = detectComposedApp([profileCall, blueprintCall, scheduleCall]);
    expect(app?.appId).toBe("wealth-tracker");
    expect(app?.scheduleCount).toBe(1);
  });

  it("counts multiple tables and schedules", () => {
    const t2 = call("create_table", { id: "wealth-tracker--history", name: "History" });
    const s2 = call("create_schedule", { id: "wealth-tracker--daily", name: "Daily" });
    const app = detectComposedApp([profileCall, blueprintCall, tableCall, t2, scheduleCall, s2]);
    expect(app?.tableCount).toBe(2);
    expect(app?.scheduleCount).toBe(2);
  });

  it("rejects cross-app mixing (profile of app A, blueprint of app B)", () => {
    const otherBlueprint = call("create_blueprint", { id: "reading-list--rev", name: "R" });
    expect(detectComposedApp([profileCall, otherBlueprint, tableCall])).toBeNull();
  });

  it("prefers the app that satisfies the full composition when multiple groups exist", () => {
    const otherProfile = call("create_profile", { id: "orphan-app--p", name: "P" });
    const app = detectComposedApp([otherProfile, profileCall, blueprintCall, tableCall]);
    expect(app?.appId).toBe("wealth-tracker");
  });

  it("skips tool results whose id does not follow the -- convention", () => {
    const looseTable = call("create_table", { id: "looseTable", name: "T" });
    expect(detectComposedApp([profileCall, blueprintCall, looseTable])).toBeNull();
  });

  it("ignores irrelevant tool calls without breaking", () => {
    const task = call("create_task", { id: "t1", title: "T1" });
    const app = detectComposedApp([task, profileCall, blueprintCall, tableCall, task]);
    expect(app?.appId).toBe("wealth-tracker");
  });

  it("derives a displayable app name from manifest.name when present in a result", () => {
    // Some tool result shapes include a `name`; we prefer manifest style humanize otherwise.
    const app = detectComposedApp([profileCall, blueprintCall, tableCall]);
    expect(app?.displayName).toBe("Wealth Tracker");
  });

  it("humanizes app-id when no name is available", () => {
    const p = call("create_profile", { id: "reading-list--coach", name: "Coach" });
    const b = call("create_blueprint", { id: "reading-list--review", name: "R" });
    const t = call("create_table", { id: "reading-list--items", name: "Items" });
    const app = detectComposedApp([p, b, t]);
    expect(app?.displayName).toBe("Reading List");
  });
});
