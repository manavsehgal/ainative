import { describe, it, expect } from "vitest";
import {
  buildIterationPrompt,
  detectCompletionSignal,
} from "../loop-executor";

describe("buildIterationPrompt", () => {
  it("formats the first iteration without previous output", () => {
    const result = buildIterationPrompt("Write a poem", "", 1, 5);
    expect(result).toContain("Iteration 1 of 5.");
    expect(result).toContain("Write a poem");
    expect(result).toContain("LOOP_COMPLETE");
    expect(result).not.toContain("Previous iteration output:");
  });

  it("includes previous output for subsequent iterations", () => {
    const result = buildIterationPrompt("Write a poem", "Roses are red...", 2, 5);
    expect(result).toContain("Iteration 2 of 5.");
    expect(result).toContain("Previous iteration output:\nRoses are red...");
    expect(result).toContain("Write a poem");
    expect(result).toContain("LOOP_COMPLETE");
  });

  it("shows correct iteration and max in the header", () => {
    const result = buildIterationPrompt("Do something", "", 7, 10);
    expect(result).toContain("Iteration 7 of 10.");
  });
});

describe("detectCompletionSignal", () => {
  it("detects LOOP_COMPLETE by default", () => {
    expect(detectCompletionSignal("Result: all done. LOOP_COMPLETE")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(detectCompletionSignal("loop_complete")).toBe(true);
    expect(detectCompletionSignal("Loop_Complete")).toBe(true);
  });

  it("returns false when signal is absent", () => {
    expect(detectCompletionSignal("Still working on it...")).toBe(false);
  });

  it("detects custom signals", () => {
    const signals = ["DONE", "FINISHED"];
    expect(detectCompletionSignal("I am DONE now.", signals)).toBe(true);
    expect(detectCompletionSignal("Task finished successfully", signals)).toBe(true);
    expect(detectCompletionSignal("Not there yet", signals)).toBe(false);
  });

  it("uses defaults when signals array is empty", () => {
    expect(detectCompletionSignal("LOOP_COMPLETE", [])).toBe(true);
  });
});
