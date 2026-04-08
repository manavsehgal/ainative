import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { conversations, documents } from "@/lib/db/schema";
import { clearAllData } from "../clear";

/**
 * Safety-net test: every table exported from schema.ts must appear in clear.ts
 * (except tables in INTENTIONALLY_PRESERVED, which are kept across clears:
 *  - settings: auth config
 *  - snapshots: backups, not working data
 *  - license: paid tier activation — clearing data must not silently downgrade)
 *
 * When you add a new table to schema.ts, this test will fail until you add a
 * corresponding db.delete() call to clear.ts in the correct FK-safe order.
 */
describe("clearAllData coverage", () => {
  const INTENTIONALLY_PRESERVED = ["settings", "snapshots", "license"];

  it("deletes every schema table (except preserved ones)", () => {
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

/**
 * FK ordering regression: `documents.conversation_id` references `conversations.id`.
 * If clearAllData deletes `conversations` before `documents`, SQLite raises
 * FOREIGN KEY constraint failed. This test seeds a document attached to a
 * conversation and then calls clearAllData to ensure the ordering holds.
 *
 * Incident: the stagent-growth domain clone (2026-04-07) hit this because its
 * seeded data included chat-attached documents.
 */
describe("clearAllData FK ordering", () => {
  it("clears a conversation that has an attached document without FK violation", () => {
    const now = new Date();
    const conversationId = "test-conv-fk-ordering";
    const documentId = "test-doc-fk-ordering";

    db.insert(conversations)
      .values({
        id: conversationId,
        runtimeId: "test-runtime",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(documents)
      .values({
        id: documentId,
        filename: "fk-ordering-test.txt",
        originalName: "fk-ordering-test.txt",
        mimeType: "text/plain",
        size: 10,
        storagePath: "/tmp/fk-ordering-test.txt",
        conversationId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() => clearAllData()).not.toThrow();

    const remainingConvs = db.select().from(conversations).all();
    const remainingDocs = db.select().from(documents).all();
    expect(remainingConvs).toHaveLength(0);
    expect(remainingDocs).toHaveLength(0);
  });
});
