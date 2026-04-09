import { describe, it, expect } from "vitest";
import { extractKeywords, jaccard, tagOverlap, STOP_WORDS } from "../similarity";

describe("similarity.extractKeywords", () => {
  it("returns an empty set for empty input", () => {
    expect(extractKeywords("")).toEqual(new Set());
  });

  it("lowercases and strips punctuation", () => {
    const result = extractKeywords("Research Customer Feedback!");
    expect(result.has("research")).toBe(true);
    expect(result.has("customer")).toBe(true);
    expect(result.has("feedback")).toBe(true);
  });

  it("excludes stop words", () => {
    const result = extractKeywords("the research about customer and the feedback");
    expect(result.has("the")).toBe(false);
    expect(result.has("about")).toBe(false);
    expect(result.has("research")).toBe(true);
  });

  it("filters tokens shorter than 4 chars", () => {
    const result = extractKeywords("go do it now with research");
    expect(result.has("go")).toBe(false);
    expect(result.has("do")).toBe(false);
    expect(result.has("it")).toBe(false);
    expect(result.has("now")).toBe(false);
    expect(result.has("research")).toBe(true);
  });

  it("filters tokens longer than 29 chars", () => {
    const longWord = "a".repeat(30);
    const result = extractKeywords(`research ${longWord} customer`);
    expect(result.has(longWord)).toBe(false);
    expect(result.has("research")).toBe(true);
  });

  it("respects the limit parameter", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel india juliet";
    const result = extractKeywords(text, 3);
    expect(result.size).toBe(3);
  });

  it("orders by frequency before applying the limit", () => {
    // 'research' appears 3 times, 'customer' 2 times, 'feedback' 1 time.
    const text = "research customer feedback research customer research";
    const result = extractKeywords(text, 2);
    expect(result.has("research")).toBe(true);
    expect(result.has("customer")).toBe(true);
    expect(result.has("feedback")).toBe(false);
  });

  it("preserves hyphenated tokens", () => {
    const result = extractKeywords("multi-agent workflow");
    expect(result.has("multi-agent")).toBe(true);
  });
});

describe("similarity.jaccard", () => {
  it("returns 0 for two empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("computes intersection / union correctly", () => {
    // {a,b,c} vs {b,c,d} → intersection=2, union=4 → 0.5
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBe(0.5);
  });

  it("returns 0 when one set is empty and other is not", () => {
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  });
});

describe("similarity.tagOverlap", () => {
  it("returns 0 when candidate has no tags", () => {
    expect(tagOverlap([], ["a", "b"])).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(tagOverlap(["Research"], ["research"])).toBe(1);
  });

  it("returns fraction of candidate tags present in existing", () => {
    expect(tagOverlap(["a", "b", "c"], ["a", "b", "z"])).toBeCloseTo(2 / 3);
  });

  it("returns 1 when all candidate tags match", () => {
    expect(tagOverlap(["a", "b"], ["a", "b", "c"])).toBe(1);
  });
});

describe("similarity.STOP_WORDS", () => {
  it("exposes a non-empty stop word set", () => {
    expect(STOP_WORDS.size).toBeGreaterThan(0);
    expect(STOP_WORDS.has("the")).toBe(true);
  });
});
