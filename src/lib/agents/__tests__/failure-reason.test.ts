import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { writeTerminalFailureReason } from "../claude-agent";

function seedRunningTask(): string {
  const pid = randomUUID();
  const tid = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
    .run();
  db.insert(tasks)
    .values({
      id: tid,
      projectId: pid,
      title: "t",
      status: "running",
      priority: 2,
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return tid;
}

describe("writeTerminalFailureReason", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(projects).run();
  });

  it("writes 'turn_limit_exceeded' on turn limit errors", async () => {
    const tid = seedRunningTask();
    await writeTerminalFailureReason(
      tid,
      new Error("Agent exhausted its turn limit (42 turns used)"),
    );
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("turn_limit_exceeded");
  });

  it("writes 'aborted' on AbortError", async () => {
    const tid = seedRunningTask();
    const err = new Error("aborted");
    err.name = "AbortError";
    await writeTerminalFailureReason(tid, err);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("aborted");
  });

  it("writes 'sdk_error' for unknown errors", async () => {
    const tid = seedRunningTask();
    await writeTerminalFailureReason(tid, new Error("something weird"));
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("sdk_error");
  });

  it("writes 'rate_limited' on 429 errors", async () => {
    const tid = seedRunningTask();
    await writeTerminalFailureReason(tid, new Error("HTTP 429 rate limit"));
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("rate_limited");
  });
});
