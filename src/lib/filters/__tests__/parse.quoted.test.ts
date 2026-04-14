import { describe, it, expect } from "vitest";
import { parseFilterInput } from "../parse";

describe("parseFilterInput — quoted values", () => {
  it("parses a double-quoted value with spaces", () => {
    expect(parseFilterInput('#tag:"needs review"')).toEqual({
      clauses: [{ key: "tag", value: "needs review" }],
      rawQuery: "",
    });
  });

  it("preserves raw query surrounding a quoted clause", () => {
    expect(parseFilterInput('auth #label:"in progress" redesign')).toEqual({
      clauses: [{ key: "label", value: "in progress" }],
      rawQuery: "auth redesign",
    });
  });

  it("allows `#` inside quoted values (previously a terminator)", () => {
    expect(parseFilterInput('#note:"see #123"')).toEqual({
      clauses: [{ key: "note", value: "see #123" }],
      rawQuery: "",
    });
  });

  it("falls back to whitespace termination for unquoted values", () => {
    expect(parseFilterInput("#status:blocked more text")).toEqual({
      clauses: [{ key: "status", value: "blocked" }],
      rawQuery: "more text",
    });
  });

  it("treats a lone opening quote as an unquoted value (malformed input survives)", () => {
    // Fallback behavior: the regex's unquoted alternative matches `"unterminated` as the bare value
    // since there's no closing quote. Acceptable degradation — no crash.
    const result = parseFilterInput('#tag:"unterminated');
    expect(result.clauses).toEqual([{ key: "tag", value: '"unterminated' }]);
    expect(result.rawQuery).toBe("");
  });
});
