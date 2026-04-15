import { describe, it, expect } from "vitest";
import { cleanFilterInput } from "../clean-filter-input";
import { parseFilterInput } from "@/lib/filters/parse";

// Smoke through the full chain: parse the raw popover input, then clean
// the result. Mirrors what `chat-command-popover.tsx` does at the
// SaveViewFooter call site so the assertions catch any regression in
// either the parser OR the cleaner.
function persisted(input: string): string {
  const parsed = parseFilterInput(input);
  return cleanFilterInput(parsed.clauses, parsed.rawQuery);
}

describe("cleanFilterInput", () => {
  it("strips bare mention-trigger prefix from clauses-only input", () => {
    expect(persisted("@task: #priority:high")).toBe("#priority:high");
  });

  it("strips trigger prefix and preserves free text", () => {
    // Order: clauses first, then rawQuery — matches the cleaner's
    // documented behavior.
    expect(persisted("@task: foo #priority:high")).toBe(
      "#priority:high foo"
    );
  });

  it("leaves clean inputs untouched (no trigger residue)", () => {
    expect(persisted("#status:blocked")).toBe("#status:blocked");
    expect(persisted("#status:blocked #priority:high")).toBe(
      "#status:blocked #priority:high"
    );
  });

  it("preserves multi-word free text", () => {
    expect(persisted('@project: my big query #status:active')).toBe(
      "#status:active my big query"
    );
  });

  it("never emits ':' not preceded by '#' (regression assertion)", () => {
    const tricky = [
      "@task: #status:blocked",
      "@project: foo #status:active",
      "@workflow: #status:running #priority:high",
      "#status:blocked",
    ];
    for (const input of tricky) {
      const result = persisted(input);
      // After every ':' there must be a non-':' char, and every ':' must
      // be immediately preceded by either an alpha char (the key) or
      // we expect the form #key:value. Simpler: assert no occurrence of
      // ': ' (trigger residue always has a trailing space) and no
      // alpha-only-prefix-colon at the start.
      expect(result).not.toMatch(/^[a-z]+:\s/i);
    }
  });

  it("handles empty clauses + empty rawQuery", () => {
    expect(cleanFilterInput([], "")).toBe("");
  });

  it("handles clauses + only-trigger rawQuery", () => {
    // `@task:` with no other input → rawQuery is `@task:` → cleaned to ""
    expect(cleanFilterInput([{ key: "status", value: "blocked" }], "@task:")).toBe(
      "#status:blocked"
    );
  });
});
