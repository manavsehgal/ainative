import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { tasks, schedules, projects, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { tickScheduler } from "../scheduler";

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn().mockResolvedValue(undefined),
}));

describe("per-schedule turn budget propagation", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.insert(settings)
      .values({ key: "schedule.maxConcurrent", value: "10", updatedAt: new Date() })
      .run();
  });

  it("copies schedules.max_turns into tasks.max_turns at firing time", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "bounded",
        prompt: "test",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 0,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        nextFireAt: new Date(now.getTime() - 10_000),
        maxTurns: 42,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await tickScheduler();

    const [task] = db.select().from(tasks).where(eq(tasks.scheduleId, sid)).all();
    expect(task?.maxTurns).toBe(42);
  });

  it("leaves tasks.max_turns null when schedules.max_turns is null", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "unbounded",
        prompt: "test",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 0,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        nextFireAt: new Date(now.getTime() - 10_000),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await tickScheduler();

    const [task] = db.select().from(tasks).where(eq(tasks.scheduleId, sid)).all();
    expect(task?.maxTurns).toBeNull();
  });
});
