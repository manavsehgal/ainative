import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  tasks,
  schedules,
  projects,
  settings,
  scheduleFiringMetrics,
  agentLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { tickScheduler } from "../scheduler";
import { countRunningScheduledSlots } from "../slot-claim";

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn(async () => {
    // Simulate a short-running task
    await new Promise((r) => setTimeout(r, 20));
  }),
}));

describe("schedule orchestration end-to-end", () => {
  beforeEach(() => {
    db.delete(scheduleFiringMetrics).run();
    db.delete(agentLogs).run();
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.insert(settings)
      .values({ key: "schedule.maxConcurrent", value: "2", updatedAt: new Date() })
      .run();
  });

  it("5 schedules firing at once → exactly 2 run, 3 queue", async () => {
    const pid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();

    const past = new Date(now.getTime() - 10_000);
    for (let i = 0; i < 5; i++) {
      db.insert(schedules)
        .values({
          id: randomUUID(),
          projectId: pid,
          name: `sched-${i}`,
          prompt: "test",
          cronExpression: "* * * * *",
          status: "active",
          type: "scheduled",
          firingCount: 0,
          suppressionCount: 0,
          heartbeatSpentToday: 0,
          failureStreak: 0,
          turnBudgetBreachStreak: 0,
          nextFireAt: past,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    await tickScheduler();

    expect(countRunningScheduledSlots()).toBe(2);
    const queued = db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "queued"))
      .all();
    expect(queued.length).toBe(3);
  });
});
