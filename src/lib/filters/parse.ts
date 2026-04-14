/**
 * `#key:value` filter namespace parser.
 *
 * Pure function that extracts filter clauses from free-text input and returns
 * the non-filter remainder as `rawQuery`. Designed to be reused across chat
 * popovers (entity filtering) and list pages (URL state, FilterBar input).
 *
 * Syntax (v1):
 *   - `#key:value` — single clause. Keys are `[A-Za-z][\w-]*`, values are
 *     `[^\s]+` (whitespace-terminated). No quoted values in v1.
 *   - Multiple clauses may chain: `#status:blocked #priority:high` → two clauses.
 *   - Clauses may appear anywhere in the input; everything else becomes rawQuery.
 *   - Unknown keys pass through unchanged — the consumer decides what to do.
 *   - Tokens like `#123` (no colon) are treated as raw-query text, not clauses.
 *
 * Design notes:
 *   - AND-only. NOT/OR deferred to v2.
 *   - Case of keys is preserved; consumer normalizes if needed. Values are
 *     preserved verbatim (including case) — status codes are commonly lowercase.
 *   - rawQuery whitespace is collapsed to single spaces and trimmed so callers
 *     can feed it directly to a search input without extra cleanup.
 */

export interface FilterClause {
  key: string;
  value: string;
}

export interface ParsedFilterInput {
  clauses: FilterClause[];
  rawQuery: string;
}

// Clause pattern: `#<key>:<value>`. Key must start with a letter to avoid
// eating `#123` hash references. `\b` after value ensures we stop at the next
// whitespace or input boundary — non-greedy match not needed because `[^\s]+`
// is already bounded by whitespace.
// Value terminates at whitespace OR the next `#` so back-to-back clauses like
// `#a:1#b:2` parse as two clauses. Downside: literal `#` can't appear in a
// value — deferred to v2 (quoted values).
const CLAUSE_PATTERN = /#([A-Za-z][\w-]*):([^\s#]+)/g;

export function parseFilterInput(input: string): ParsedFilterInput {
  if (!input) return { clauses: [], rawQuery: "" };

  const clauses: FilterClause[] = [];
  let rawQuery = input;

  // Replace each match with a single space to preserve word boundaries, then
  // collapse whitespace. This is simpler than maintaining offsets and survives
  // back-to-back clauses like `#a:1#b:2` (which we don't officially support
  // but shouldn't crash on — the regex with `g` flag matches both).
  rawQuery = rawQuery.replace(CLAUSE_PATTERN, (_match, key: string, value: string) => {
    clauses.push({ key, value });
    return " ";
  });

  rawQuery = rawQuery.replace(/\s+/g, " ").trim();

  return { clauses, rawQuery };
}

/**
 * Evaluate an object against a list of clauses using a caller-supplied
 * predicate per key. Returns true if ALL clauses match (AND semantics) or
 * the clauses list is empty.
 *
 * `predicates` maps known filter keys to value-checkers. Unknown keys are
 * silently skipped (not considered a mismatch) so callers can layer their
 * own matching logic without breaking on typos.
 */
export function matchesClauses<T>(
  item: T,
  clauses: FilterClause[],
  predicates: Record<string, (item: T, value: string) => boolean>
): boolean {
  if (clauses.length === 0) return true;
  for (const clause of clauses) {
    const predicate = predicates[clause.key.toLowerCase()];
    if (!predicate) continue; // unknown key → skip, per spec
    if (!predicate(item, clause.value)) return false;
  }
  return true;
}
