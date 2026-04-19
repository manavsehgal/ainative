import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { userTableTemplates } from "@/lib/db/schema";
import { like, eq } from "drizzle-orm";
import { installPluginTables, removePluginTables } from "../table-templates";
import type { PluginTableTemplate } from "@/lib/plugins/sdk/types";

const fakeTable = (id: string): PluginTableTemplate => ({
  id,
  name: `Test ${id}`,
  description: "test",
  category: "finance",
  icon: "DollarSign",
  columns: [
    { name: "x", displayName: "X", dataType: "text" },
  ],
});

describe("plugin tables", () => {
  beforeEach(() => {
    db.delete(userTableTemplates).where(like(userTableTemplates.id, "plugin:test-%:%")).run();
  });

  it("installs as DB rows with composite ids", () => {
    installPluginTables("test-pack", [fakeTable("transactions")]);
    const row = db.select().from(userTableTemplates).where(eq(userTableTemplates.id, "plugin:test-pack:transactions")).get();
    expect(row).toBeTruthy();
    expect(row?.scope).toBe("system");
    // Plugin-id suffix prevents picker collision with builtin rows of the same name
    expect(row?.name).toBe("Test transactions (test-pack)");
  });

  it("upserts on second install (no duplicate row)", () => {
    installPluginTables("test-pack", [fakeTable("transactions")]);
    installPluginTables("test-pack", [{ ...fakeTable("transactions"), name: "Renamed" }]);
    const rows = db.select().from(userTableTemplates).where(like(userTableTemplates.id, "plugin:test-pack:%")).all();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Renamed (test-pack)");
  });

  it("removePluginTables deletes only that plugin's rows", () => {
    installPluginTables("test-pack-a", [fakeTable("a")]);
    installPluginTables("test-pack-b", [fakeTable("b")]);
    removePluginTables("test-pack-a");
    const remaining = db.select().from(userTableTemplates).where(like(userTableTemplates.id, "plugin:test-pack-%:%")).all();
    expect(remaining.map((r) => r.id)).toEqual(["plugin:test-pack-b:b"]);
  });

  it("reconciles a row pre-inserted by a concurrent writer (race-tolerance invariant)", () => {
    // Simulates a multi-process WAL scenario: another ainative-business process
    // has already inserted a row with the same composite id between our
    // hypothetical SELECT and INSERT. installPluginTables must not throw, and
    // must reconcile the row to our desired values. This locks in the
    // defensive upsert contract from TDR-034 / Path C.
    const compositeId = "plugin:test-pack:transactions";
    const now = new Date(0);
    db.insert(userTableTemplates).values({
      id: compositeId,
      name: "Stale name",
      description: "stale",
      category: "finance",
      columnSchema: JSON.stringify([]),
      sampleData: null,
      scope: "system",
      icon: "OldIcon",
      createdAt: now,
      updatedAt: now,
    }).run();

    expect(() => installPluginTables("test-pack", [fakeTable("transactions")])).not.toThrow();

    const row = db
      .select()
      .from(userTableTemplates)
      .where(eq(userTableTemplates.id, compositeId))
      .get();
    expect(row?.name).toBe("Test transactions (test-pack)");
    expect(row?.icon).toBe("DollarSign");
    // createdAt must be preserved across the upsert; only updatedAt moves.
    expect(row?.createdAt.getTime()).toBe(now.getTime());
    expect(row?.updatedAt.getTime()).toBeGreaterThan(now.getTime());
  });
});
