import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { license as licenseTable } from "@/lib/db/schema";
import { licenseManager } from "../manager";

const LICENSE_ROW_ID = "default";

/**
 * Regression: under Turbopack module instance separation, the singleton's
 * in-memory cache could disagree with the DB. If another module instance
 * (or another process) updates the license row, getTier() must reflect
 * the new value — otherwise gated limits silently fall back to community
 * tier rules even on paid tiers.
 *
 * The fix in manager.ts makes getTier() / getStatus() read from the DB.
 * This test simulates the cross-instance scenario by mutating the DB row
 * directly without going through licenseManager.activate().
 */
describe("LicenseManager — DB-direct tier reads", () => {
  beforeEach(() => {
    // Reset to a known community baseline.
    db.delete(licenseTable).where(eq(licenseTable.id, LICENSE_ROW_ID)).run();
    licenseManager.initialize();
  });

  afterEach(() => {
    db.delete(licenseTable).where(eq(licenseTable.id, LICENSE_ROW_ID)).run();
  });

  it("getTier() reflects DB updates that bypassed activate()", () => {
    expect(licenseManager.getTier()).toBe("community");

    // Simulate "another module instance wrote scale to the DB".
    db.update(licenseTable)
      .set({ tier: "scale", status: "active", updatedAt: new Date() })
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .run();

    expect(licenseManager.getTier()).toBe("scale");
    expect(licenseManager.getLimit("agentMemories")).toBe(Infinity);
    expect(licenseManager.getLimit("activeSchedules")).toBe(Infinity);
    expect(licenseManager.getLimit("parallelWorkflows")).toBe(Infinity);
    expect(licenseManager.isPremium()).toBe(true);
  });

  it("getStatus() also reads from DB, not stale cache", () => {
    expect(licenseManager.getStatus().tier).toBe("community");

    db.update(licenseTable)
      .set({
        tier: "operator",
        status: "active",
        email: "ops@example.com",
        updatedAt: new Date(),
      })
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .run();

    const status = licenseManager.getStatus();
    expect(status.tier).toBe("operator");
    expect(status.email).toBe("ops@example.com");
  });
});
