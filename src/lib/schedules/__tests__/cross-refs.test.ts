import { describe, it, expect, vi } from "vitest";

// Mock the profile registry before importing the module-under-test so that
// the dynamic `await import()` inside validateScheduleRefs resolves to this
// mock. vi.mock() calls are hoisted to the top of the file by Vitest.
vi.mock("@/lib/agents/profiles/registry", () => ({
  getProfile: vi.fn((id: string) =>
    id === "general" || id === "code-reviewer" ? { id, name: id } : undefined
  ),
}));

import { validateScheduleRefs } from "../registry";
import type { ScheduleSpec } from "@/lib/validators/schedule-spec";

// ---------------------------------------------------------------------------
// Fixture helpers — ScheduleSpec is a discriminated union; both branches
// require `type`, `id`, `name`, `version`, `prompt`, and exactly one of
// `interval` or `cronExpression`. We use the simpler "scheduled" branch.
// ---------------------------------------------------------------------------

function fakeScheduled(overrides: Partial<ScheduleSpec> = {}): ScheduleSpec {
  return {
    type: "scheduled",
    id: "test-schedule",
    name: "Test Schedule",
    version: "1.0.0",
    prompt: "Do the thing.",
    interval: "1d",
    ...overrides,
  } as ScheduleSpec;
}

const defaultOpts = {
  pluginId: "finance-pack",
  siblingProfileIds: new Set<string>(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateScheduleRefs", () => {
  it("builtin profile ref returns { ok: true }", async () => {
    const spec = fakeScheduled({ agentProfile: "general" });
    const result = await validateScheduleRefs(spec, defaultOpts);
    expect(result).toEqual({ ok: true });
  });

  it("sibling plugin profile ref returns { ok: true }", async () => {
    const spec = fakeScheduled({ agentProfile: "finance-pack/personal-cfo" });
    const opts = {
      pluginId: "finance-pack",
      siblingProfileIds: new Set(["finance-pack/personal-cfo"]),
    };
    const result = await validateScheduleRefs(spec, opts);
    expect(result).toEqual({ ok: true });
  });

  it("cross-plugin profile ref returns { ok: false } with descriptive error", async () => {
    const spec = fakeScheduled({ agentProfile: "other-plugin/some-profile" });
    const opts = {
      pluginId: "finance-pack",
      siblingProfileIds: new Set<string>(),
    };
    const result = await validateScheduleRefs(spec, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cross-plugin profile reference not allowed/);
      expect(result.error).toContain("other-plugin/some-profile");
    }
  });

  it("unknown unnamespaced profile ref returns { ok: false } with descriptive error", async () => {
    const spec = fakeScheduled({ agentProfile: "nonexistent-profile" });
    const result = await validateScheduleRefs(spec, defaultOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unresolved profile reference/);
      expect(result.error).toContain("nonexistent-profile");
    }
  });

  it("unknown sibling profile ref returns { ok: false } with descriptive error", async () => {
    const spec = fakeScheduled({ agentProfile: "finance-pack/missing" });
    const opts = {
      pluginId: "finance-pack",
      siblingProfileIds: new Set<string>(),
    };
    const result = await validateScheduleRefs(spec, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unresolved sibling profile reference/);
      expect(result.error).toContain("finance-pack/missing");
    }
  });

  it("no agentProfile and no assignedAgent returns { ok: true }", async () => {
    // Both fields are undefined — exercises the `spec.agentProfile ?? spec.assignedAgent` path
    const spec = fakeScheduled({ agentProfile: undefined, assignedAgent: undefined });
    const result = await validateScheduleRefs(spec, defaultOpts);
    expect(result).toEqual({ ok: true });
  });
});
