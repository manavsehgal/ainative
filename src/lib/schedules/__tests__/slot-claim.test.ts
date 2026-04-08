import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { tasks, schedules, projects, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { claimSlot, countRunningScheduledSlots } from "../slot-claim";

function seedProject(): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id, name: "test", status: "active", createdAt: now, updatedAt: now })
    .run();
  return id;
}

function seedSchedule(projectId: string): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(schedules)
    .values({
      id,
      projectId,
      name: `sched-${id.slice(0, 4)}`,
      prompt: "test",
      cronExpression: "* * * * *",
      status: "active",
      type: "scheduled",
      firingCount: 0,
      suppressionCount: 0,
      heartbeatSpentToday: 0,
      failureStreak: 0,
      turnBudgetBreachStreak: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

function seedQueuedTask(scheduleId: string): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(tasks)
    .values({
      id,
      scheduleId,
      title: "test firing",
      status: "queued",
      priority: 2,
      sourceType: "scheduled",
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

describe("claimSlot", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
  });

  it("claims a slot when capacity available, transitioning queued→running", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const result = claimSlot(tid, 2, 1200);

    expect(result.claimed).toBe(true);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.status).toBe("running");
    expect(row?.slotClaimedAt).not.toBeNull();
    expect(row?.leaseExpiresAt).not.toBeNull();
  });

  it("refuses to claim when cap=0", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const result = claimSlot(tid, 0, 1200);

    expect(result.claimed).toBe(false);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.status).toBe("queued");
  });

  it("refuses when cap already full", () => {
    const pid = seedProject();
    const sid1 = seedSchedule(pid);
    const sid2 = seedSchedule(pid);
    const tid1 = seedQueuedTask(sid1);
    const tid2 = seedQueuedTask(sid2);

    expect(claimSlot(tid1, 1, 1200).claimed).toBe(true);
    expect(claimSlot(tid2, 1, 1200).claimed).toBe(false);

    const row2 = db.select().from(tasks).where(eq(tasks.id, tid2)).get();
    expect(row2?.status).toBe("queued");
  });

  it("two concurrent claim attempts for the same task yield exactly one winner", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const first = claimSlot(tid, 10, 1200);
    const second = claimSlot(tid, 10, 1200);

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false); // task already running, can't re-claim
  });

  it("respects cap across multiple tasks from different schedules", () => {
    const pid = seedProject();
    const tids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const sid = seedSchedule(pid);
      tids.push(seedQueuedTask(sid));
    }

    // Cap of 3 → first 3 claim, last 2 fail
    const results = tids.map((tid) => claimSlot(tid, 3, 1200));
    expect(results.filter((r) => r.claimed).length).toBe(3);
    expect(results.filter((r) => !r.claimed).length).toBe(2);

    expect(countRunningScheduledSlots()).toBe(3);
  });

  it("countRunningScheduledSlots ignores non-scheduled tasks", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const schedTid = seedQueuedTask(sid);
    claimSlot(schedTid, 10, 1200);

    // Insert a manual running task — must not count against scheduled cap
    const manualId = randomUUID();
    const now = new Date();
    db.insert(tasks)
      .values({
        id: manualId,
        title: "manual",
        status: "running",
        priority: 2,
        sourceType: "manual",
        resumeCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(countRunningScheduledSlots()).toBe(1);
  });

  it("writes leaseExpiresAt = slotClaimedAt + leaseSec", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const before = Date.now();
    claimSlot(tid, 10, 60);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();

    expect(row?.slotClaimedAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(
      row!.leaseExpiresAt!.getTime() - row!.slotClaimedAt!.getTime(),
    ).toBe(60 * 1000);
  });
});
