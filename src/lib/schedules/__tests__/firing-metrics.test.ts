import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  tasks,
  schedules,
  projects,
  scheduleFiringMetrics,
  agentLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { recordFiringMetrics } from "../scheduler";

describe("schedule_firing_metrics insertion", () => {
  beforeEach(() => {
    db.delete(scheduleFiringMetrics).run();
    db.delete(agentLogs).run();
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
  });

  it("inserts a row for every firing with slot_wait_ms and duration_ms", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const tid = randomUUID();
    const firedAt = new Date(Date.now() - 5000);
    const slotClaimedAt = new Date(Date.now() - 4000);
    const completedAt = new Date(Date.now() - 100);

    db.insert(projects)
      .values({
        id: pid,
        name: "p",
        status: "active",
        createdAt: firedAt,
        updatedAt: firedAt,
      })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "test",
        prompt: "x",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 1,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        maxTurns: 50,
        createdAt: firedAt,
        updatedAt: firedAt,
      })
      .run();
    db.insert(tasks)
      .values({
        id: tid,
        scheduleId: sid,
        title: "firing",
        status: "completed",
        priority: 2,
        sourceType: "scheduled",
        resumeCount: 0,
        slotClaimedAt,
        createdAt: firedAt,
        updatedAt: completedAt,
      })
      .run();
    for (let i = 0; i < 7; i++) {
      db.insert(agentLogs)
        .values({
          id: randomUUID(),
          taskId: tid,
          agentType: "test",
          event: "assistant_message",
          timestamp: new Date(),
        })
        .run();
    }

    await recordFiringMetrics(sid, tid);

    const rows = db
      .select()
      .from(scheduleFiringMetrics)
      .where(eq(scheduleFiringMetrics.scheduleId, sid))
      .all();

    expect(rows.length).toBe(1);
    expect(rows[0].turnCount).toBe(7);
    expect(rows[0].maxTurnsAtFiring).toBe(50);
    expect(rows[0].slotWaitMs).toBeGreaterThan(0);
    expect(rows[0].durationMs).toBeGreaterThan(0);
  });
});
