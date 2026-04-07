import { describe, it, expect } from "vitest";
import { analyzePromptEfficiency } from "../prompt-analyzer";

describe("analyzePromptEfficiency", () => {
  it("returns no warnings for a clean batched prompt", () => {
    const warnings = analyzePromptEfficiency(
      "Search for stock prices AMZN GOOGL NVDA AAPL today and write a summary."
    );
    expect(warnings).toEqual([]);
  });

  it("flags 'for each' loop pattern", () => {
    const warnings = analyzePromptEfficiency(
      "For each stock in my portfolio, search the latest price."
    );
    expect(warnings.some((w) => w.type === "loop_pattern")).toBe(true);
  });

  it("flags 'for every' loop pattern", () => {
    const warnings = analyzePromptEfficiency(
      "For every market, fetch the current odds."
    );
    expect(warnings.some((w) => w.type === "loop_pattern")).toBe(true);
  });

  it("flags 'individually' loop pattern", () => {
    const warnings = analyzePromptEfficiency(
      "Look up each ticker individually and report results."
    );
    expect(warnings.some((w) => w.type === "loop_pattern")).toBe(true);
  });

  it("flags large list pattern", () => {
    const warnings = analyzePromptEfficiency(
      "Check all 32 markets and write a report."
    );
    expect(warnings.some((w) => w.type === "large_list")).toBe(true);
  });

  it("flags high turn estimate", () => {
    // Many search verbs should trip the >30 estimate
    const verbs = Array(35).fill("search").join(" ");
    const warnings = analyzePromptEfficiency(verbs);
    expect(warnings.some((w) => w.type === "high_turn_estimate")).toBe(true);
  });

  it("does not flag a single quick action", () => {
    const warnings = analyzePromptEfficiency("Send me a daily news digest.");
    expect(warnings).toEqual([]);
  });
});
