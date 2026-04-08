import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { schedules, projects } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { checkCollision } from "../collision-check";

function seedSchedule(opts: {
  cron: string;
  avgTurns: number;
  projectId: string;
  status?: "active" | "paused";
}): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(schedules)
    .values({
      id,
      projectId: opts.projectId,
      name: `s-${id.slice(0, 4)}`,
      prompt: "test",
      cronExpression: opts.cron,
      status: opts.status ?? "active",
      type: "scheduled",
      firingCount: 0,
      suppressionCount: 0,
      heartbeatSpentToday: 0,
      failureStreak: 0,
      turnBudgetBreachStreak: 0,
      avgTurnsPerFiring: opts.avgTurns,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

function seedProject(): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id, name: "p", status: "active", createdAt: now, updatedAt: now })
    .run();
  return id;
}

describe("checkCollision", () => {
  beforeEach(() => {
    db.delete(schedules).run();
    db.delete(projects).run();
  });

  it("returns no warnings when no overlap exists", () => {
    const pid = seedProject();
    seedSchedule({ cron: "0 3 * * *", avgTurns: 500, projectId: pid });
    expect(checkCollision("0 15 * * *", 500, pid, null)).toEqual([]);
  });

  it("detects overlap when two heavy schedules share a 5-min bucket", () => {
    const pid = seedProject();
    seedSchedule({ cron: "2 * * * *", avgTurns: 2000, projectId: pid });
    const warnings = checkCollision("0 * * * *", 2000, pid, null);
    expect(warnings.length).toBe(1);
    expect(warnings[0].type).toBe("cron_collision");
    expect(warnings[0].estimatedConcurrentSteps).toBeGreaterThanOrEqual(4000);
  });

  it("ignores paused schedules", () => {
    const pid = seedProject();
    seedSchedule({
      cron: "2 * * * *",
      avgTurns: 2000,
      projectId: pid,
      status: "paused",
    });
    expect(checkCollision("0 * * * *", 2000, pid, null)).toEqual([]);
  });

  it("excludes the excludeScheduleId (for PUT updates)", () => {
    const pid = seedProject();
    const existing = seedSchedule({
      cron: "0 * * * *",
      avgTurns: 3000,
      projectId: pid,
    });
    expect(checkCollision("0 * * * *", 3000, pid, existing)).toEqual([]);
  });

  it("does not warn when combined steps are below the threshold", () => {
    const pid = seedProject();
    seedSchedule({ cron: "2 * * * *", avgTurns: 500, projectId: pid });
    expect(checkCollision("0 * * * *", 500, pid, null)).toEqual([]);
  });
});
