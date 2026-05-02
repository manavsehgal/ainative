import { describe, it, expect } from "vitest";
import { resolveBindings } from "../resolve";
import type { AppManifest } from "@/lib/apps/registry";

describe("resolveBindings", () => {
  it("returns empty arrays for an empty manifest", () => {
    const manifest = {
      id: "empty-app",
      name: "Empty",
      profiles: [],
      blueprints: [],
      tables: [],
      schedules: [],
    } as unknown as AppManifest;

    const out = resolveBindings(manifest);

    expect(out).toEqual({
      profileIds: [],
      blueprintIds: [],
      tableIds: [],
      scheduleIds: [],
      schedules: [],
    });
  });

  it("collects ids and preserves cron metadata for a full manifest", () => {
    const manifest = {
      id: "habit-tracker",
      name: "Habit Tracker",
      profiles: [{ id: "habit-tracker--habit-coach" }],
      blueprints: [{ id: "habit-tracker--weekly-review" }],
      tables: [
        { id: "table-1", columns: ["habit"] },
        { id: "table-2", columns: ["date", "completed"] },
      ],
      schedules: [
        { id: "sched-1", cron: "0 20 * * *" },
        { id: "sched-2" },
      ],
    } as unknown as AppManifest;

    const out = resolveBindings(manifest);

    expect(out.profileIds).toEqual(["habit-tracker--habit-coach"]);
    expect(out.blueprintIds).toEqual(["habit-tracker--weekly-review"]);
    expect(out.tableIds).toEqual(["table-1", "table-2"]);
    expect(out.scheduleIds).toEqual(["sched-1", "sched-2"]);
    expect(out.schedules).toEqual([
      { id: "sched-1", cron: "0 20 * * *" },
      { id: "sched-2", cron: undefined },
    ]);
  });
});
