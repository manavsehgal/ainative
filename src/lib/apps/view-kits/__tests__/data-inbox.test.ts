import { describe, expect, it, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { projects, userTables, userTableColumns, userTableRows, tasks, documents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { loadInboxQueue, loadInboxDraft } from "../data";

// unstable_cache requires Next.js cache infrastructure absent in Vitest.
// Make it a simple passthrough so loadInboxDraft exercises the real fetch logic.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// ---------------------------------------------------------------------------
// Task 21: loadInboxQueue
// ---------------------------------------------------------------------------

describe("loadInboxQueue", () => {
  const tableId = "test-touchpoints";
  const now = new Date();

  beforeEach(() => {
    db.delete(userTableRows).where(eq(userTableRows.tableId, tableId)).run();
    db.delete(userTableColumns).where(eq(userTableColumns.tableId, tableId)).run();
    db.delete(userTables).where(eq(userTables.id, tableId)).run();
    db.insert(userTables)
      .values({ id: tableId, name: "test-touchpoints", createdAt: now, updatedAt: now })
      .run();
    db.insert(userTableColumns)
      .values([
        {
          id: `${tableId}__channel`,
          tableId,
          name: "channel",
          displayName: "Channel",
          dataType: "text" as const,
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `${tableId}__summary`,
          tableId,
          name: "summary",
          displayName: "Summary",
          dataType: "text" as const,
          position: 1,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();
    db.insert(userTableRows)
      .values([
        {
          id: "r1",
          tableId,
          position: 0,
          data: JSON.stringify({ channel: "email", summary: "Acme reply" }),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "r2",
          tableId,
          position: 1,
          data: JSON.stringify({ channel: "email", summary: "Beta reply" }),
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();
  });

  it("returns rows in position order", async () => {
    const queue = await loadInboxQueue(tableId);
    expect(queue).toHaveLength(2);
    expect(queue[0]?.id).toBe("r1");
    expect(queue[1]?.id).toBe("r2");
  });

  it("parses data JSON into values", async () => {
    const queue = await loadInboxQueue(tableId);
    expect(queue[0]?.values).toEqual({ channel: "email", summary: "Acme reply" });
  });

  it("returns [] when tableId is undefined", async () => {
    expect(await loadInboxQueue(undefined)).toEqual([]);
  });

  it("caps at 50 rows", async () => {
    db.insert(userTableRows)
      .values(
        Array.from({ length: 60 }, (_, i) => ({
          id: `bulk-${i}`,
          tableId,
          position: i + 10,
          data: JSON.stringify({ channel: "x", summary: `S${i}` }),
          createdAt: now,
          updatedAt: now,
        }))
      )
      .run();
    const queue = await loadInboxQueue(tableId);
    expect(queue.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// Task 22: loadInboxDraft
// ---------------------------------------------------------------------------

describe("loadInboxDraft", () => {
  const appId = "app-test-inbox";
  const rowId = "r1";
  const now = new Date();

  beforeEach(() => {
    // Delete in FK-safe order: documents → tasks → projects
    db.delete(documents)
      .where(sql`${documents.taskId} LIKE 'task-test-%'`)
      .run();
    db.delete(tasks)
      .where(eq(tasks.projectId, appId))
      .run();
    db.delete(projects)
      .where(eq(projects.id, appId))
      .run();
    // Seed the project (FK parent for tasks.projectId)
    db.insert(projects)
      .values({ id: appId, name: "Inbox Test App", createdAt: now, updatedAt: now })
      .run();
  });

  it("returns null when no task matches the row", async () => {
    expect(await loadInboxDraft(appId, rowId)).toBeNull();
  });

  it("returns the most recent document linked to the matching task", async () => {
    const taskId = "task-test-1";
    db.insert(tasks)
      .values({
        id: taskId,
        title: "draft for r1",
        status: "completed",
        projectId: appId,
        contextRowId: rowId,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(documents)
      .values({
        id: "doc-1",
        taskId,
        filename: "draft-r1.md",
        originalName: "draft-r1.md",
        mimeType: "text/markdown",
        size: 50,
        storagePath: "/tmp/draft-r1.md",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const draft = await loadInboxDraft(appId, rowId);
    expect(draft?.id).toBe("doc-1");
    expect(draft?.taskId).toBe(taskId);
  });
});
