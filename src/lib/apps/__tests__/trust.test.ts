import { describe, expect, it } from "vitest";
import {
  canExecutePrimitive,
  requiredTrustLevel,
  categorizePrimitives,
} from "../trust";
import type { AppTrustLevel } from "../types";

const TRUST_LEVELS: AppTrustLevel[] = ["private", "community", "verified", "official"];

describe("canExecutePrimitive", () => {
  // Tier A — all levels can use
  const tierA = [
    "tables", "schedules", "profiles", "blueprints", "triggers",
    "notifications", "savedViews", "documents", "envVars",
  ];

  for (const primitive of tierA) {
    for (const level of TRUST_LEVELS) {
      it(`allows ${primitive} for ${level}`, () => {
        expect(canExecutePrimitive(level, primitive)).toBe(true);
      });
    }
  }

  // Tier B — verified+ only
  const tierB = ["mcpServers", "chatTools", "channels", "memory"];

  for (const primitive of tierB) {
    it(`blocks ${primitive} for private`, () => {
      expect(canExecutePrimitive("private", primitive)).toBe(false);
    });

    it(`blocks ${primitive} for community`, () => {
      expect(canExecutePrimitive("community", primitive)).toBe(false);
    });

    it(`allows ${primitive} for verified`, () => {
      expect(canExecutePrimitive("verified", primitive)).toBe(true);
    });

    it(`allows ${primitive} for official`, () => {
      expect(canExecutePrimitive("official", primitive)).toBe(true);
    });
  }

  // Full — official only
  it("blocks budgetPolicies for private", () => {
    expect(canExecutePrimitive("private", "budgetPolicies")).toBe(false);
  });

  it("blocks budgetPolicies for community", () => {
    expect(canExecutePrimitive("community", "budgetPolicies")).toBe(false);
  });

  it("blocks budgetPolicies for verified", () => {
    expect(canExecutePrimitive("verified", "budgetPolicies")).toBe(false);
  });

  it("allows budgetPolicies for official", () => {
    expect(canExecutePrimitive("official", "budgetPolicies")).toBe(true);
  });

  // Unknown primitives — safe by default
  it("blocks unknown primitives for all levels", () => {
    for (const level of TRUST_LEVELS) {
      expect(canExecutePrimitive(level, "unknownPrimitive")).toBe(false);
    }
  });
});

describe("requiredTrustLevel", () => {
  it("returns private for Tier A primitives", () => {
    expect(requiredTrustLevel("tables")).toBe("private");
    expect(requiredTrustLevel("schedules")).toBe("private");
  });

  it("returns verified for Tier B primitives", () => {
    expect(requiredTrustLevel("mcpServers")).toBe("verified");
    expect(requiredTrustLevel("memory")).toBe("verified");
  });

  it("returns official for Full primitives", () => {
    expect(requiredTrustLevel("budgetPolicies")).toBe("official");
  });

  it("returns null for unknown primitives", () => {
    expect(requiredTrustLevel("unknownPrimitive")).toBeNull();
  });
});

describe("categorizePrimitives", () => {
  it("allows all Tier A for community", () => {
    const result = categorizePrimitives("community", [
      "tables", "schedules", "profiles",
    ]);
    expect(result.allowed).toEqual(["tables", "schedules", "profiles"]);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips Tier B for community", () => {
    const result = categorizePrimitives("community", [
      "tables", "mcpServers", "schedules",
    ]);
    expect(result.allowed).toEqual(["tables", "schedules"]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].primitive).toBe("mcpServers");
    expect(result.skipped[0].requiredLevel).toBe("verified");
  });

  it("allows everything for official", () => {
    const result = categorizePrimitives("official", [
      "tables", "mcpServers", "budgetPolicies",
    ]);
    expect(result.allowed).toEqual(["tables", "mcpServers", "budgetPolicies"]);
    expect(result.skipped).toHaveLength(0);
  });

  it("handles empty list", () => {
    const result = categorizePrimitives("private", []);
    expect(result.allowed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});
