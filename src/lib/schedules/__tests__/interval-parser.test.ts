import { describe, it, expect } from "vitest";
import {
  expandCronMinutes,
  computeStaggeredCron,
} from "../interval-parser";

describe("expandCronMinutes", () => {
  it("expands */N step pattern", () => {
    expect(expandCronMinutes("*/30 * * * *")).toEqual([0, 30]);
    expect(expandCronMinutes("*/15 * * * *")).toEqual([0, 15, 30, 45]);
  });

  it("expands wildcard", () => {
    const all = expandCronMinutes("* * * * *");
    expect(all.length).toBe(60);
    expect(all[0]).toBe(0);
    expect(all[59]).toBe(59);
  });

  it("expands comma list", () => {
    expect(expandCronMinutes("5,15,45 * * * *")).toEqual([5, 15, 45]);
  });

  it("expands ranges", () => {
    expect(expandCronMinutes("10-13 * * * *")).toEqual([10, 11, 12, 13]);
  });

  it("expands stepped ranges", () => {
    expect(expandCronMinutes("0-30/10 * * * *")).toEqual([0, 10, 20, 30]);
  });

  it("expands single value", () => {
    expect(expandCronMinutes("7 * * * *")).toEqual([7]);
  });

  it("throws on invalid cron", () => {
    expect(() => expandCronMinutes("not a cron")).toThrow();
  });
});

describe("computeStaggeredCron", () => {
  it("returns original cron when no existing schedules", () => {
    const result = computeStaggeredCron("*/30 * * * *", []);
    expect(result.collided).toBe(false);
    expect(result.offsetApplied).toBe(0);
    expect(result.cronExpression).toBe("*/30 * * * *");
  });

  it("returns original cron when no collision", () => {
    const result = computeStaggeredCron("*/30 * * * *", ["7 * * * *"]);
    expect(result.collided).toBe(false);
    expect(result.cronExpression).toBe("*/30 * * * *");
  });

  it("staggers two */30 schedules", () => {
    // First schedule fires at :00 and :30. Second should be offset by ≥5min.
    const result = computeStaggeredCron("*/30 * * * *", ["*/30 * * * *"]);
    expect(result.collided).toBe(true);
    expect(result.offsetApplied).toBeGreaterThanOrEqual(5);
    // Should produce a comma list reflecting the new fire times
    const minutes = expandCronMinutes(result.cronExpression);
    // Both fire minutes should be ≥5 away from {0,30}
    for (const m of minutes) {
      const distTo0 = Math.min(m, 60 - m);
      const distTo30 = Math.abs(m - 30);
      expect(distTo0).toBeGreaterThanOrEqual(5);
      expect(distTo30).toBeGreaterThanOrEqual(5);
    }
  });

  it("enforces 5-minute minimum gap", () => {
    // Existing schedule at :00, new schedule wants :03 — should stagger.
    const result = computeStaggeredCron("3 * * * *", ["0 * * * *"]);
    expect(result.collided).toBe(true);
    const minutes = expandCronMinutes(result.cronExpression);
    expect(minutes.length).toBe(1);
    const m = minutes[0];
    const distTo0 = Math.min(m, 60 - m);
    expect(distTo0).toBeGreaterThanOrEqual(5);
  });

  it("ignores unparseable existing crons gracefully", () => {
    const result = computeStaggeredCron("*/30 * * * *", ["garbage"]);
    expect(result.collided).toBe(false);
    expect(result.cronExpression).toBe("*/30 * * * *");
  });
});
