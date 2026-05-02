import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";

const now = new Date();

describe("tasks.contextRowId", () => {
  it("accepts inserts with contextRowId set", () => {
    const taskId = `t_${Date.now()}`;
    db.insert(tasks).values({
      id: taskId,
      title: "test",
      status: "queued",
      projectId: null,
      contextRowId: "row-abc-123",
      createdAt: now,
      updatedAt: now,
    } as any).run();

    const row = db
      .select()
      .from(tasks)
      .where(sql`${tasks.id} = ${taskId}`)
      .get();
    expect(row?.contextRowId).toBe("row-abc-123");

    db.delete(tasks).where(sql`${tasks.id} = ${taskId}`).run();
  });

  it("accepts inserts without contextRowId (column is nullable)", () => {
    const taskId = `t_${Date.now() + 1}`;
    db.insert(tasks).values({
      id: taskId,
      title: "test",
      status: "queued",
      projectId: null,
      createdAt: now,
      updatedAt: now,
    } as any).run();

    const row = db
      .select()
      .from(tasks)
      .where(sql`${tasks.id} = ${taskId}`)
      .get();
    expect(row?.contextRowId).toBeNull();

    db.delete(tasks).where(sql`${tasks.id} = ${taskId}`).run();
  });
});
