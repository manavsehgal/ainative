import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as schema from "@/lib/db/schema";

/**
 * Safety-net test: every table exported from schema.ts must appear in clear.ts
 * (except `settings`, which is intentionally preserved across clears).
 *
 * When you add a new table to schema.ts, this test will fail until you add a
 * corresponding db.delete() call to clear.ts in the correct FK-safe order.
 */
describe("clearAllData coverage", () => {
  const INTENTIONALLY_PRESERVED = ["settings", "snapshots"];

  it("deletes every schema table (except settings)", () => {
    const clearSource = readFileSync(
      join(__dirname, "..", "clear.ts"),
      "utf-8"
    );

    // Collect all sqliteTable exports from schema
    const tableExports = Object.entries(schema)
      .filter(
        ([, value]) =>
          value != null &&
          typeof value === "object" &&
          "getSQL" in (value as Record<string, unknown>)
      )
      .map(([name]) => name);

    expect(tableExports.length).toBeGreaterThan(0);

    const missing = tableExports.filter(
      (name) =>
        !INTENTIONALLY_PRESERVED.includes(name) &&
        !clearSource.includes(`db.delete(${name})`)
    );

    expect(missing, `Tables missing from clear.ts: ${missing.join(", ")}`).toEqual([]);
  });
});
