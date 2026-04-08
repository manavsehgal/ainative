/**
 * Post-step action helpers — pure logic for the declarative side-effect
 * framework that bulk row enrichment uses to write agent results back into
 * user table cells.
 *
 * Dispatch (the actual `updateRow` call) lives in the loop-executor where
 * it has DB access; this module stays pure so the resolution + skip rules
 * can be unit-tested without mocking DB.
 *
 * See features/bulk-row-enrichment.md.
 */

import type { StepPostAction } from "./types";

/**
 * Substitute `{{itemVariable.field}}` placeholders in a postAction definition
 * against the current loop iteration's row. Supports nested paths via dotted
 * field names (e.g. `{{row.meta.id}}`). Only `rowId` is templated today —
 * `tableId` and `column` are static, and templating them would invite SQL
 * surprises.
 */
export function resolvePostAction(
  action: StepPostAction,
  row: unknown,
  itemVariable: string
): StepPostAction {
  return {
    ...action,
    rowId: substituteRowPath(action.rowId, row, itemVariable),
  };
}

/**
 * Replace `{{itemVariable.path.to.field}}` with the value at that path on row.
 * Multiple placeholders in the same string are all replaced. Missing paths
 * resolve to an empty string (caller should validate the result).
 */
function substituteRowPath(
  template: string,
  row: unknown,
  itemVariable: string
): string {
  // Match {{<itemVariable>.<dotted.path>}} — escape itemVariable for safety
  const escaped = itemVariable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\{\\{\\s*${escaped}\\.([\\w.]+)\\s*\\}\\}`, "g");

  return template.replace(pattern, (_match, path: string) => {
    const value = readPath(row, path);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function readPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Decide whether the agent's result should be written back to the cell, or
 * skipped silently. We skip empty/whitespace-only results and the literal
 * `NOT_FOUND` sentinel (case-insensitive) so an enrichment workflow can
 * gracefully say "no value for this row" without overwriting a real value
 * with garbage.
 *
 * Substring matches are intentionally NOT skipped — only the trimmed value
 * being exactly `NOT_FOUND` triggers the skip. This avoids dropping a long
 * answer that happens to mention the sentinel.
 */
export function shouldSkipPostActionValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (trimmed.toUpperCase() === "NOT_FOUND") return true;
  return false;
}

/**
 * Pull the writable value out of a task result. Trims whitespace and tolerates
 * undefined/null without throwing. The caller should run the result through
 * `shouldSkipPostActionValue` before writing.
 */
export function extractPostActionValue(result: string | undefined | null): string {
  if (result === undefined || result === null) return "";
  return result.trim();
}
