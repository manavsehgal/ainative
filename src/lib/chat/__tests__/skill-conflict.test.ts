import { describe, it, expect } from "vitest";
import { detectSkillConflicts } from "../skill-conflict";

describe("detectSkillConflicts", () => {
  it("returns no conflicts for two unrelated skills", () => {
    const a = { id: "a", name: "code-reviewer", content: "Always run ESLint before reviewing code." };
    const b = { id: "b", name: "haiku-poet", content: "Use 5-7-5 syllable structure." };
    expect(detectSkillConflicts(a, b)).toEqual([]);
  });

  it("flags directive divergence on a shared topic", () => {
    const a = { id: "a", name: "tdd", content: "Always write the test first. Never write production code without a failing test." };
    const b = { id: "b", name: "spike", content: "Never write tests during a spike. Prefer exploratory code." };
    const conflicts = detectSkillConflicts(a, b);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toMatchObject({
      skillA: "tdd",
      skillB: "spike",
    });
    expect(conflicts[0].excerptA).toMatch(/test/i);
    expect(conflicts[0].excerptB).toMatch(/test/i);
  });

  it("returns no conflicts when both skills agree on a topic", () => {
    const a = { id: "a", name: "tdd", content: "Always write tests first." };
    const b = { id: "b", name: "qa-strict", content: "Always write tests first and add coverage gates." };
    expect(detectSkillConflicts(a, b)).toEqual([]);
  });

  it("ignores non-directive lines", () => {
    const a = { id: "a", name: "x", content: "This skill is for documentation tasks." };
    const b = { id: "b", name: "y", content: "Documentation is important context." };
    expect(detectSkillConflicts(a, b)).toEqual([]);
  });
});
