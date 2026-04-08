import { describe, it, expect } from "vitest";
import {
  resolvePostAction,
  shouldSkipPostActionValue,
  extractPostActionValue,
} from "../post-action";
import type { StepPostAction } from "../types";

describe("resolvePostAction", () => {
  it("substitutes {{row.id}} with the row's id field", () => {
    const action: StepPostAction = {
      type: "update_row",
      tableId: "tbl_contacts",
      rowId: "{{row.id}}",
      column: "linkedin",
    };
    const row = { id: "row_abc", name: "Alice" };

    const resolved = resolvePostAction(action, row, "row");

    expect(resolved.rowId).toBe("row_abc");
    expect(resolved.tableId).toBe("tbl_contacts");
    expect(resolved.column).toBe("linkedin");
  });

  it("respects a custom itemVariable name", () => {
    const action: StepPostAction = {
      type: "update_row",
      tableId: "tbl_x",
      rowId: "{{contact.id}}",
      column: "email",
    };
    const row = { id: "c_42" };

    const resolved = resolvePostAction(action, row, "contact");

    expect(resolved.rowId).toBe("c_42");
  });

  it("supports nested field paths like {{row.meta.id}}", () => {
    const action: StepPostAction = {
      type: "update_row",
      tableId: "tbl_x",
      rowId: "{{row.meta.id}}",
      column: "value",
    };
    const row = { meta: { id: "nested_99" } };

    const resolved = resolvePostAction(action, row, "row");

    expect(resolved.rowId).toBe("nested_99");
  });

  it("leaves rowId untouched when no placeholder is present", () => {
    const action: StepPostAction = {
      type: "update_row",
      tableId: "tbl_x",
      rowId: "literal_row_id",
      column: "value",
    };

    const resolved = resolvePostAction(action, { id: "ignored" }, "row");

    expect(resolved.rowId).toBe("literal_row_id");
  });
});

describe("shouldSkipPostActionValue", () => {
  it("skips empty strings", () => {
    expect(shouldSkipPostActionValue("")).toBe(true);
    expect(shouldSkipPostActionValue("   ")).toBe(true);
    expect(shouldSkipPostActionValue("\n\t")).toBe(true);
  });

  it("skips NOT_FOUND sentinel (case-insensitive)", () => {
    expect(shouldSkipPostActionValue("NOT_FOUND")).toBe(true);
    expect(shouldSkipPostActionValue("not_found")).toBe(true);
    expect(shouldSkipPostActionValue("  NOT_FOUND  ")).toBe(true);
    expect(shouldSkipPostActionValue("Not_Found")).toBe(true);
  });

  it("does not skip real values", () => {
    expect(shouldSkipPostActionValue("https://linkedin.com/in/alice")).toBe(false);
    expect(shouldSkipPostActionValue("alice@example.com")).toBe(false);
    expect(shouldSkipPostActionValue("0")).toBe(false);
  });

  it("does not skip values that merely contain NOT_FOUND as a substring", () => {
    // We only skip when the trimmed value IS the sentinel; substrings stay.
    expect(shouldSkipPostActionValue("Status: NOT_FOUND in registry")).toBe(false);
  });
});

describe("extractPostActionValue", () => {
  it("trims whitespace from the agent result", () => {
    expect(extractPostActionValue("  hello  ")).toBe("hello");
    expect(extractPostActionValue("\nhttps://example.com\n")).toBe("https://example.com");
  });

  it("returns the raw string for normal values", () => {
    expect(extractPostActionValue("plain")).toBe("plain");
  });

  it("returns empty string for null/undefined-shaped inputs", () => {
    expect(extractPostActionValue(undefined)).toBe("");
    expect(extractPostActionValue("")).toBe("");
  });
});
