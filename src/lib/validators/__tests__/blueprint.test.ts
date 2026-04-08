import { describe, expect, it } from "vitest";
import { BlueprintStepSchema } from "../blueprint";

// ── Task step fixtures ──────────────────────────────────────────────────

const validTaskStep = {
  name: "Research prospect",
  profileId: "sales-researcher",
  promptTemplate: "Research {{row.name}}",
  requiresApproval: false,
};

// ── Delay step fixtures ─────────────────────────────────────────────────

const validDelayStep = {
  name: "Wait 3 days",
  delayDuration: "3d",
  requiresApproval: false,
};

describe("BlueprintStepSchema", () => {
  describe("task step (profile + prompt)", () => {
    it("accepts a valid task step", () => {
      const result = BlueprintStepSchema.safeParse(validTaskStep);
      expect(result.success).toBe(true);
    });

    it("accepts a task step with optional expectedOutput and condition", () => {
      const result = BlueprintStepSchema.safeParse({
        ...validTaskStep,
        expectedOutput: "structured-findings",
        condition: "rowCount > 0",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a task step missing profileId", () => {
      const { profileId: _profileId, ...stepWithoutProfile } = validTaskStep;
      const result = BlueprintStepSchema.safeParse(stepWithoutProfile);
      expect(result.success).toBe(false);
    });

    it("rejects a task step missing promptTemplate", () => {
      const { promptTemplate: _promptTemplate, ...stepWithoutPrompt } = validTaskStep;
      const result = BlueprintStepSchema.safeParse(stepWithoutPrompt);
      expect(result.success).toBe(false);
    });
  });

  describe("delay step (duration only)", () => {
    it("accepts a valid delay step", () => {
      const result = BlueprintStepSchema.safeParse(validDelayStep);
      expect(result.success).toBe(true);
    });

    it("accepts all valid duration formats", () => {
      for (const duration of ["1m", "30m", "2h", "3d", "1w", "30d"]) {
        const result = BlueprintStepSchema.safeParse({
          ...validDelayStep,
          delayDuration: duration,
        });
        expect(result.success, `duration "${duration}" should validate`).toBe(true);
      }
    });

    it("rejects a delay step with invalid duration format", () => {
      const result = BlueprintStepSchema.safeParse({
        ...validDelayStep,
        delayDuration: "bogus",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error.issues)).toMatch(/30m, 2h, 3d, 1w/);
      }
    });

    it("rejects a delay step with duration below 1 minute", () => {
      const result = BlueprintStepSchema.safeParse({
        ...validDelayStep,
        delayDuration: "0m",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error.issues)).toMatch(/minimum/i);
      }
    });

    it("rejects a delay step with duration above 30 days", () => {
      const result = BlueprintStepSchema.safeParse({
        ...validDelayStep,
        delayDuration: "31d",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error.issues)).toMatch(/maximum/i);
      }
    });

    it("rejects compound duration formats", () => {
      const result = BlueprintStepSchema.safeParse({
        ...validDelayStep,
        delayDuration: "3d2h",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("XOR cross-field validation", () => {
    it("rejects a step that mixes delayDuration with profileId", () => {
      const result = BlueprintStepSchema.safeParse({
        name: "Mixed",
        profileId: "sales-researcher",
        delayDuration: "3d",
        requiresApproval: false,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error.issues)).toMatch(/delay|task|both/i);
      }
    });

    it("rejects a step that mixes delayDuration with promptTemplate", () => {
      const result = BlueprintStepSchema.safeParse({
        name: "Mixed",
        promptTemplate: "Do the thing",
        delayDuration: "3d",
        requiresApproval: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a step that mixes all three fields", () => {
      const result = BlueprintStepSchema.safeParse({
        name: "Mixed",
        profileId: "sales-researcher",
        promptTemplate: "Do the thing",
        delayDuration: "3d",
        requiresApproval: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a step with neither delay nor task fields", () => {
      const result = BlueprintStepSchema.safeParse({
        name: "Empty",
        requiresApproval: false,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error.issues)).toMatch(/delay|profile|prompt|required/i);
      }
    });

    it("rejects a step with profileId but missing promptTemplate (partial task step)", () => {
      const result = BlueprintStepSchema.safeParse({
        name: "Partial",
        profileId: "sales-researcher",
        requiresApproval: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a step with promptTemplate but missing profileId (partial task step)", () => {
      const result = BlueprintStepSchema.safeParse({
        name: "Partial",
        promptTemplate: "Do the thing",
        requiresApproval: false,
      });
      expect(result.success).toBe(false);
    });
  });
});
