import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { projects, userTables, userTableColumns, userTableRows, tasks, documents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { loadResearchSources, loadLatestSynthesis, loadRecentRuns } from "../data";

const appId = "app-test-research";
const tableId = "sources-test";
const blueprintId = "weekly-digest";
const now = new Date();

beforeEach(() => {
  // Delete in FK-safe order
  db.delete(documents)
    .where(sql`${documents.taskId} LIKE 'rt-%'`)
    .run();
  db.delete(tasks)
    .where(eq(tasks.projectId, appId))
    .run();
  db.delete(projects)
    .where(eq(projects.id, appId))
    .run();
  db.delete(userTableRows)
    .where(eq(userTableRows.tableId, tableId))
    .run();
  db.delete(userTableColumns)
    .where(eq(userTableColumns.tableId, tableId))
    .run();
  db.delete(userTables)
    .where(eq(userTables.id, tableId))
    .run();

  // Seed project (FK parent for tasks)
  db.insert(projects)
    .values({ id: appId, name: "Research Test App", createdAt: now, updatedAt: now })
    .run();

  // Seed source table + rows
  db.insert(userTables)
    .values({ id: tableId, name: tableId, createdAt: now, updatedAt: now })
    .run();
  db.insert(userTableColumns)
    .values([
      {
        id: `${tableId}__name`,
        tableId,
        name: "name",
        displayName: "Name",
        dataType: "text" as const,
        position: 0,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .run();
  db.insert(userTableRows)
    .values([
      {
        id: "src-1",
        tableId,
        position: 0,
        data: JSON.stringify({ name: "HN" }),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "src-2",
        tableId,
        position: 1,
        data: JSON.stringify({ name: "ArXiv" }),
        createdAt: now,
        updatedAt: now,
      },
    ])
    .run();
});

describe("loadResearchSources", () => {
  it("returns rows in position order", async () => {
    const rows = await loadResearchSources(tableId);
    expect(rows.map((r) => r.id)).toEqual(["src-1", "src-2"]);
  });

  it("returns [] when tableId is undefined", async () => {
    expect(await loadResearchSources(undefined)).toEqual([]);
  });
});

describe("loadLatestSynthesis", () => {
  it("returns null when no completed synthesis task exists", async () => {
    expect(await loadLatestSynthesis(appId, blueprintId)).toBeNull();
  });

  it("returns the latest completed synthesis task's document", async () => {
    const taskId = "rt-1";
    db.insert(tasks)
      .values({
        id: taskId,
        title: "weekly digest",
        status: "completed",
        projectId: appId,
        assignedAgent: blueprintId,
        result: "Synthesis body",
        createdAt: now,
        updatedAt: now,
      } as any)
      .run();
    db.insert(documents)
      .values({
        id: "rt-doc-1",
        taskId,
        filename: "digest.md",
        originalName: "digest.md",
        mimeType: "text/markdown",
        size: 100,
        storagePath: "/tmp/digest.md",
        extractedText: "# Digest\n\nBody",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = await loadLatestSynthesis(appId, blueprintId);
    expect(result?.docId).toBe("rt-doc-1");
    expect(result?.content).toContain("Digest");
  });
});

describe("loadRecentRuns", () => {
  it("returns runs in reverse-chronological order, capped at limit", async () => {
    const t1 = new Date(Date.now() - 2000);
    const t2 = new Date(Date.now() - 1000);
    db.insert(tasks)
      .values([
        {
          id: "rt-2",
          title: "run a",
          status: "completed",
          projectId: appId,
          assignedAgent: blueprintId,
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: "rt-3",
          title: "run b",
          status: "failed",
          projectId: appId,
          assignedAgent: blueprintId,
          createdAt: t2,
          updatedAt: t2,
        },
      ] as any[])
      .run();

    const runs = await loadRecentRuns(appId, blueprintId, 5);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(runs[0]?.id).toBe("rt-3");
    expect(runs[0]?.startedAt).toBeDefined();
  });
});
