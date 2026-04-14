import { describe, it, expect } from "vitest";
import { parseFilterInput, matchesClauses } from "../parse";

describe("parseFilterInput", () => {
  it("returns empty result for empty input", () => {
    expect(parseFilterInput("")).toEqual({ clauses: [], rawQuery: "" });
  });

  it("returns input as rawQuery when no clauses present", () => {
    const out = parseFilterInput("hello world");
    expect(out.clauses).toEqual([]);
    expect(out.rawQuery).toBe("hello world");
  });

  it("parses a single clause and strips it from rawQuery", () => {
    const out = parseFilterInput("#status:blocked");
    expect(out.clauses).toEqual([{ key: "status", value: "blocked" }]);
    expect(out.rawQuery).toBe("");
  });

  it("parses multiple clauses with AND semantics", () => {
    const out = parseFilterInput("#status:blocked #priority:high");
    expect(out.clauses).toEqual([
      { key: "status", value: "blocked" },
      { key: "priority", value: "high" },
    ]);
    expect(out.rawQuery).toBe("");
  });

  it("preserves raw text between and around clauses", () => {
    const out = parseFilterInput("auth #status:blocked service #priority:high");
    expect(out.clauses).toEqual([
      { key: "status", value: "blocked" },
      { key: "priority", value: "high" },
    ]);
    expect(out.rawQuery).toBe("auth service");
  });

  it("treats `#123` as raw-query text, not a clause (no colon)", () => {
    const out = parseFilterInput("see #123 for context");
    expect(out.clauses).toEqual([]);
    expect(out.rawQuery).toBe("see #123 for context");
  });

  it("treats `#1abc:val` as raw-query text (key must start with a letter)", () => {
    const out = parseFilterInput("#1abc:val");
    expect(out.clauses).toEqual([]);
    expect(out.rawQuery).toBe("#1abc:val");
  });

  it("accepts hyphens and underscores in keys", () => {
    const out = parseFilterInput("#created-by:me #user_id:42");
    expect(out.clauses).toEqual([
      { key: "created-by", value: "me" },
      { key: "user_id", value: "42" },
    ]);
  });

  it("preserves case of values verbatim (keys keep case too)", () => {
    const out = parseFilterInput("#Status:Blocked");
    expect(out.clauses).toEqual([{ key: "Status", value: "Blocked" }]);
  });

  it("accepts back-to-back clauses without space between them", () => {
    const out = parseFilterInput("#a:1#b:2");
    expect(out.clauses).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
    expect(out.rawQuery).toBe("");
  });

  it("collapses extra whitespace in rawQuery", () => {
    const out = parseFilterInput("  foo   bar  ");
    expect(out.rawQuery).toBe("foo bar");
  });

  it("handles values with special chars except whitespace", () => {
    const out = parseFilterInput("#path:src/lib/filters.ts");
    expect(out.clauses).toEqual([{ key: "path", value: "src/lib/filters.ts" }]);
  });
});

describe("matchesClauses", () => {
  const task = { id: "t1", status: "blocked", priority: "high", type: "task" };

  it("returns true when clauses list is empty", () => {
    expect(matchesClauses(task, [], {})).toBe(true);
  });

  it("returns true when all clauses match via predicates", () => {
    const out = matchesClauses(
      task,
      [{ key: "status", value: "blocked" }],
      { status: (t, v) => t.status === v }
    );
    expect(out).toBe(true);
  });

  it("returns false when any clause fails", () => {
    const out = matchesClauses(
      task,
      [
        { key: "status", value: "blocked" },
        { key: "priority", value: "low" },
      ],
      {
        status: (t, v) => t.status === v,
        priority: (t, v) => t.priority === v,
      }
    );
    expect(out).toBe(false);
  });

  it("silently skips unknown keys (does not fail the match)", () => {
    const out = matchesClauses(
      task,
      [
        { key: "status", value: "blocked" },
        { key: "totally-unknown", value: "xyz" },
      ],
      { status: (t, v) => t.status === v }
    );
    expect(out).toBe(true);
  });

  it("normalizes key lookup to lowercase", () => {
    const out = matchesClauses(
      task,
      [{ key: "Status", value: "blocked" }],
      { status: (t, v) => t.status === v }
    );
    expect(out).toBe(true);
  });
});
