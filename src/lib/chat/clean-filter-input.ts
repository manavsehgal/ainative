/**
 * Sanitize the filterInput we persist for a saved search.
 *
 * The chat popover input may include the mention trigger prefix
 * (e.g. `@task: ` or `task: ` depending on what the trigger regex
 * stripped). When the user "Saves this view", we want the persisted
 * filterInput to contain ONLY the meaningful filter expression —
 * `#key:value` clauses plus any free-text search the user typed —
 * not the trigger residue.
 *
 * Pure function. Tested in isolation; called from
 * `chat-command-popover.tsx` at the SaveViewFooter call site.
 *
 * See `features/saved-search-polish-v1.md` for the bug history.
 */

import type { FilterClause } from "@/lib/filters/parse";

const TRIGGER_RESIDUE = /^@?[a-z]+:\s*/i;

export function cleanFilterInput(
  clauses: FilterClause[],
  rawQuery: string
): string {
  const cleanRawQuery = rawQuery.replace(TRIGGER_RESIDUE, "").trim();
  return [
    ...clauses.map((c) => `#${c.key}:${c.value}`),
    ...(cleanRawQuery ? [cleanRawQuery] : []),
  ].join(" ");
}
