import { describe, expect, it } from "vitest";
import {
  TIERS,
  TIER_RANK,
  TIER_LIMITS,
  TIER_LABELS,
  TIER_PRICING,
  type LicenseTier,
  type LimitResource,
} from "../tier-limits";

describe("tier-limits", () => {
  it("defines all four tiers", () => {
    expect(TIERS).toEqual(["community", "solo", "operator", "scale"]);
  });

  it("ranks tiers in ascending order", () => {
    expect(TIER_RANK.community).toBeLessThan(TIER_RANK.solo);
    expect(TIER_RANK.solo).toBeLessThan(TIER_RANK.operator);
    expect(TIER_RANK.operator).toBeLessThan(TIER_RANK.scale);
  });

  it("all limit resources are defined for every tier", () => {
    const resources: LimitResource[] = [
      "agentMemories",
      "contextVersions",
      "activeSchedules",
      "historyRetentionDays",
      "parallelWorkflows",
    ];
    for (const tier of TIERS) {
      for (const resource of resources) {
        expect(TIER_LIMITS[tier][resource]).toBeDefined();
        expect(typeof TIER_LIMITS[tier][resource]).toBe("number");
      }
    }
  });

  it("higher tiers have equal or greater limits", () => {
    const tierOrder: LicenseTier[] = ["community", "solo", "operator", "scale"];
    for (let i = 1; i < tierOrder.length; i++) {
      const current = tierOrder[i];
      const previous = tierOrder[i - 1];
      for (const resource of Object.keys(TIER_LIMITS[current]) as LimitResource[]) {
        expect(TIER_LIMITS[current][resource]).toBeGreaterThanOrEqual(
          TIER_LIMITS[previous][resource]
        );
      }
    }
  });

  it("scale tier has Infinity for all resources", () => {
    for (const value of Object.values(TIER_LIMITS.scale)) {
      expect(value).toBe(Infinity);
    }
  });

  it("community tier has finite limits", () => {
    for (const value of Object.values(TIER_LIMITS.community)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("labels exist for all tiers", () => {
    for (const tier of TIERS) {
      expect(TIER_LABELS[tier]).toBeTruthy();
    }
  });

  it("pricing exists for all tiers with annual < 12x monthly", () => {
    for (const tier of TIERS) {
      const { monthly, annual } = TIER_PRICING[tier];
      expect(monthly).toBeGreaterThanOrEqual(0);
      if (monthly > 0) {
        expect(annual).toBeLessThan(monthly * 12);
      }
    }
  });
});
