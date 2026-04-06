import { describe, expect, it } from "vitest";
import { canAccessFeature, LICENSE_FEATURES, type LicenseFeature } from "../features";
import type { LicenseTier } from "../tier-limits";

describe("features", () => {
  it("community can browse marketplace", () => {
    expect(canAccessFeature("community", "marketplace-browse")).toBe(true);
  });

  it("community cannot access analytics", () => {
    expect(canAccessFeature("community", "analytics")).toBe(false);
  });

  it("community cannot access cloud sync", () => {
    expect(canAccessFeature("community", "cloud-sync")).toBe(false);
  });

  it("solo can import from marketplace", () => {
    expect(canAccessFeature("solo", "marketplace-import")).toBe(true);
  });

  it("solo cannot publish to marketplace", () => {
    expect(canAccessFeature("solo", "marketplace-publish")).toBe(false);
  });

  it("operator can access analytics and cloud sync", () => {
    expect(canAccessFeature("operator", "analytics")).toBe(true);
    expect(canAccessFeature("operator", "cloud-sync")).toBe(true);
    expect(canAccessFeature("operator", "marketplace-publish")).toBe(true);
  });

  it("scale can access everything", () => {
    for (const feature of LICENSE_FEATURES) {
      expect(canAccessFeature("scale", feature)).toBe(true);
    }
  });

  it("higher tiers inherit lower tier features", () => {
    const tiers: LicenseTier[] = ["community", "solo", "operator", "scale"];
    for (const feature of LICENSE_FEATURES) {
      let unlocked = false;
      for (const tier of tiers) {
        if (canAccessFeature(tier, feature)) {
          unlocked = true;
        }
        // Once unlocked, must stay unlocked for all higher tiers
        if (unlocked) {
          expect(
            canAccessFeature(tier, feature),
            `${tier} should access ${feature} since a lower tier can`
          ).toBe(true);
        }
      }
    }
  });
});
