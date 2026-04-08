import { describe, it, expect } from "vitest";
import {
  buildIterationPrompt,
  buildRowIterationPrompt,
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

describe("buildRowIterationPrompt", () => {
  it("renders the iteration header using row index out of total rows", () => {
    const result = buildRowIterationPrompt(
      "Research {{row}}",
      { name: "Alice", company: "Acme" },
      "row",
      1,
      3
    );
    expect(result).toContain("Row 1 of 3.");
  });

  it("includes the bound row data so the agent can read it", () => {
    const row = { name: "Alice", company: "Acme" };
    const result = buildRowIterationPrompt(
      "Find LinkedIn for the contact above",
      row,
      "row",
      1,
      3
    );
    // Row payload must be visible in the prompt under the bound name
    expect(result).toContain("row");
    expect(result).toContain("Alice");
    expect(result).toContain("Acme");
    expect(result).toContain("Find LinkedIn for the contact above");
  });

  it("respects a custom itemVariable name", () => {
    const result = buildRowIterationPrompt(
      "Process item",
      { id: 42, label: "widget" },
      "contact",
      2,
      5
    );
    expect(result).toContain("contact");
    expect(result).toContain("widget");
    expect(result).toContain("Row 2 of 5.");
  });

  it("does not append the LOOP_COMPLETE instruction (row-driven loops finish when items are exhausted)", () => {
    const result = buildRowIterationPrompt(
      "Do work",
      { x: 1 },
      "row",
      1,
      1
    );
    expect(result).not.toContain("LOOP_COMPLETE");
  });
});
