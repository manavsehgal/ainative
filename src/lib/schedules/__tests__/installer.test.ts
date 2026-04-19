import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { schedules as schedulesTable } from "@/lib/db/schema";
import { eq, like } from "drizzle-orm";
import { installSchedulesFromSpecs } from "../installer";
import type { ScheduleSpec } from "@/lib/validators/schedule-spec";

const fakeScheduled = (id: string, overrides: Partial<ScheduleSpec> = {}): ScheduleSpec => ({
  type: "scheduled",
  id,
  name: `Test ${id}`,
  version: "1.0.0",
  prompt: "Do the thing",
  cronExpression: "0 9 * * *",
  recurs: true,
  ...overrides,
} as ScheduleSpec);

const fakeHeartbeat = (id: string, overrides: Partial<ScheduleSpec> = {}): ScheduleSpec => ({
  type: "heartbeat",
  id,
  name: `HB ${id}`,
  version: "1.0.0",
  prompt: "Check the thing",
  cronExpression: "*/15 * * * *",
  recurs: true,
  ...overrides,
} as ScheduleSpec);

describe("installSchedulesFromSpecs — state preservation", () => {
  beforeEach(() => {
    db.delete(schedulesTable).where(like(schedulesTable.id, "test-%")).run();
  });

  // ── STATE PRESERVATION TESTS (15) ─────────────────────────────────────────

  it("preserves status (pause survives reload)", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s1")]);
    db.update(schedulesTable).set({ status: "paused" }).where(eq(schedulesTable.id, "test-s1")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s1", { prompt: "new prompt" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s1")).get();
    expect(row?.status).toBe("paused");
    expect(row?.prompt).toBe("new prompt");
  });

  it("preserves firingCount across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s2")]);
    db.update(schedulesTable).set({ firingCount: 42 }).where(eq(schedulesTable.id, "test-s2")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s2", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s2")).get();
    expect(row?.firingCount).toBe(42);
  });

  it("preserves suppressionCount across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s3")]);
    db.update(schedulesTable).set({ suppressionCount: 7 }).where(eq(schedulesTable.id, "test-s3")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s3", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s3")).get();
    expect(row?.suppressionCount).toBe(7);
  });

  it("preserves failureStreak across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s4")]);
    db.update(schedulesTable).set({ failureStreak: 3 }).where(eq(schedulesTable.id, "test-s4")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s4", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s4")).get();
    expect(row?.failureStreak).toBe(3);
  });

  it("preserves turnBudgetBreachStreak across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s5")]);
    db.update(schedulesTable).set({ turnBudgetBreachStreak: 2 }).where(eq(schedulesTable.id, "test-s5")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s5", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s5")).get();
    expect(row?.turnBudgetBreachStreak).toBe(2);
  });

  it("preserves heartbeatSpentToday across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s6")]);
    db.update(schedulesTable).set({ heartbeatSpentToday: 1500 }).where(eq(schedulesTable.id, "test-s6")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s6", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s6")).get();
    expect(row?.heartbeatSpentToday).toBe(1500);
  });

  it("preserves lastFiredAt across reload", () => {
    const pastDate = new Date("2025-01-15T10:00:00.000Z");
    installSchedulesFromSpecs([fakeScheduled("test-s7")]);
    db.update(schedulesTable).set({ lastFiredAt: pastDate }).where(eq(schedulesTable.id, "test-s7")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s7", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s7")).get();
    expect(row?.lastFiredAt?.getTime()).toBe(pastDate.getTime());
  });

  it("preserves lastActionAt across reload", () => {
    const pastDate = new Date("2025-02-20T14:30:00.000Z");
    installSchedulesFromSpecs([fakeScheduled("test-s8")]);
    db.update(schedulesTable).set({ lastActionAt: pastDate }).where(eq(schedulesTable.id, "test-s8")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s8", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s8")).get();
    expect(row?.lastActionAt?.getTime()).toBe(pastDate.getTime());
  });

  it("preserves heartbeatBudgetResetAt across reload", () => {
    const resetDate = new Date("2025-03-01T00:00:00.000Z");
    installSchedulesFromSpecs([fakeScheduled("test-s9")]);
    db.update(schedulesTable).set({ heartbeatBudgetResetAt: resetDate }).where(eq(schedulesTable.id, "test-s9")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s9", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s9")).get();
    expect(row?.heartbeatBudgetResetAt?.getTime()).toBe(resetDate.getTime());
  });

  it("preserves maxTurnsSetAt across reload", () => {
    const setDate = new Date("2025-04-10T08:00:00.000Z");
    installSchedulesFromSpecs([fakeScheduled("test-s10")]);
    db.update(schedulesTable).set({ maxTurnsSetAt: setDate }).where(eq(schedulesTable.id, "test-s10")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s10", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s10")).get();
    expect(row?.maxTurnsSetAt?.getTime()).toBe(setDate.getTime());
  });

  it("preserves avgTurnsPerFiring across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s11")]);
    db.update(schedulesTable).set({ avgTurnsPerFiring: 12 }).where(eq(schedulesTable.id, "test-s11")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s11", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s11")).get();
    expect(row?.avgTurnsPerFiring).toBe(12);
  });

  it("preserves lastTurnCount across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s12")]);
    db.update(schedulesTable).set({ lastTurnCount: 8 }).where(eq(schedulesTable.id, "test-s12")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s12", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s12")).get();
    expect(row?.lastTurnCount).toBe(8);
  });

  it("preserves lastFailureReason across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s13")]);
    db.update(schedulesTable).set({ lastFailureReason: "turn_limit_exceeded" }).where(eq(schedulesTable.id, "test-s13")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s13", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s13")).get();
    expect(row?.lastFailureReason).toBe("turn_limit_exceeded");
  });

  it("preserves nextFireAt across reload", () => {
    const futureDate = new Date("2099-12-31T23:59:00.000Z");
    installSchedulesFromSpecs([fakeScheduled("test-s14")]);
    db.update(schedulesTable).set({ nextFireAt: futureDate }).where(eq(schedulesTable.id, "test-s14")).run();
    installSchedulesFromSpecs([fakeScheduled("test-s14", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s14")).get();
    expect(row?.nextFireAt?.getTime()).toBe(futureDate.getTime());
  });

  it("preserves createdAt across reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-s15")]);
    const after1st = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s15")).get();
    const originalCreatedAt = after1st?.createdAt;
    expect(originalCreatedAt).toBeDefined();

    installSchedulesFromSpecs([fakeScheduled("test-s15", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-s15")).get();
    expect(row?.createdAt.getTime()).toBe(originalCreatedAt!.getTime());
  });

  // ── CONFIG RECONCILIATION TESTS (3) ───────────────────────────────────────

  it("updates prompt in place on reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-cfg1", { prompt: "original prompt" })]);
    installSchedulesFromSpecs([fakeScheduled("test-cfg1", { prompt: "updated prompt" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-cfg1")).get();
    expect(row?.prompt).toBe("updated prompt");
  });

  it("updates cronExpression in place on reload", () => {
    installSchedulesFromSpecs([fakeScheduled("test-cfg2", { cronExpression: "0 9 * * *" })]);
    installSchedulesFromSpecs([fakeScheduled("test-cfg2", { cronExpression: "0 17 * * *" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-cfg2")).get();
    expect(row?.cronExpression).toBe("0 17 * * *");
  });

  it("updates updatedAt on reload (strictly after manually-set past value)", () => {
    // Install, then manually set updatedAt to a known past timestamp (epoch),
    // then reload — updatedAt must move forward. This avoids sub-second clock
    // precision issues with SQLite's integer timestamp storage (second resolution).
    const pastTime = new Date(0); // epoch = 1970-01-01
    installSchedulesFromSpecs([fakeScheduled("test-cfg3")]);
    db.update(schedulesTable).set({ updatedAt: pastTime }).where(eq(schedulesTable.id, "test-cfg3")).run();

    installSchedulesFromSpecs([fakeScheduled("test-cfg3", { prompt: "updated" })]);
    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-cfg3")).get();
    expect(row?.updatedAt.getTime()).toBeGreaterThan(pastTime.getTime());
  });

  // ── RACE-TOLERANCE INVARIANT (1) ──────────────────────────────────────────

  it("reconciles a row pre-inserted by a concurrent writer (race-tolerance invariant)", () => {
    // Simulates a multi-process WAL scenario: another ainative process has
    // already inserted a row with the same id between our hypothetical SELECT
    // and INSERT. installSchedulesFromSpecs must not throw a UNIQUE constraint
    // error, and must reconcile config while preserving pre-existing state.
    const staleCreatedAt = new Date("2020-01-01T00:00:00.000Z");
    const staleUpdatedAt = new Date("2020-01-01T00:00:00.000Z");

    db.insert(schedulesTable).values({
      id: "test-race1",
      name: "Stale Name",
      prompt: "stale prompt",
      cronExpression: "0 1 * * *",
      status: "paused",
      firingCount: 99,
      suppressionCount: 5,
      failureStreak: 2,
      heartbeatSpentToday: 500,
      turnBudgetBreachStreak: 1,
      recurs: true,
      type: "scheduled",
      deliveryChannels: JSON.stringify([]),
      createdAt: staleCreatedAt,
      updatedAt: staleUpdatedAt,
    }).run();

    // Should not throw a UNIQUE constraint error
    expect(() =>
      installSchedulesFromSpecs([fakeScheduled("test-race1", { prompt: "fresh prompt", cronExpression: "0 9 * * *" })])
    ).not.toThrow();

    const row = db.select().from(schedulesTable).where(eq(schedulesTable.id, "test-race1")).get();
    // Config reconciled
    expect(row?.prompt).toBe("fresh prompt");
    expect(row?.cronExpression).toBe("0 9 * * *");
    // State preserved
    expect(row?.status).toBe("paused");
    expect(row?.firingCount).toBe(99);
    expect(row?.suppressionCount).toBe(5);
    expect(row?.failureStreak).toBe(2);
    expect(row?.heartbeatSpentToday).toBe(500);
    expect(row?.turnBudgetBreachStreak).toBe(1);
    // createdAt preserved
    expect(row?.createdAt.getTime()).toBe(staleCreatedAt.getTime());
  });
});
