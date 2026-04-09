/**
 * Shared similarity utilities.
 *
 * Small, dependency-free helpers for fuzzy matching: keyword extraction,
 * Jaccard similarity, and tag overlap. Used by the profile import dedup
 * engine (`src/lib/import/dedup.ts`) and the chat workflow tool dedup
 * check (`src/lib/chat/tools/workflow-tools.ts`).
 *
 * Extracted into a shared module so both callers use the same keyword
 * normalization and comparison math — if one grows, the other benefits.
 */

/** Common stop words to exclude from keyword extraction. */
export const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "have", "that", "this", "with",
  "from", "they", "been", "will", "each", "make", "like", "into", "them",
  "some", "when", "what", "your", "should", "would", "could", "about",
  "which", "their", "other", "than", "then", "more", "also",
  "only", "must", "does", "here", "just", "over", "such", "after",
  "before", "between", "through", "where", "these", "those", "being",
  "using", "ensure", "every", "following", "include",
]);

/**
 * Extract meaningful keywords from text.
 *
 * Lowercases, strips non-alphanumeric, filters out stop words and tokens
 * outside a reasonable length window, then returns the top-N most frequent
 * terms as a Set.
 */
export function extractKeywords(text: string, limit = 20): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && w.length < 30 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);

  return new Set(sorted);
}

/**
 * Jaccard similarity between two sets — |A ∩ B| / |A ∪ B|.
 *
 * Returns 0 when both sets are empty (a reasonable default for "nothing to
 * compare" rather than the mathematical indeterminate form).
 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Tag overlap ratio — how many of the candidate's tags match the existing
 * set, normalized by candidate size. Case-insensitive.
 */
export function tagOverlap(candidateTags: string[], existingTags: string[]): number {
  if (candidateTags.length === 0) return 0;
  const existingSet = new Set(existingTags.map((t) => t.toLowerCase()));
  const matches = candidateTags.filter((t) => existingSet.has(t.toLowerCase()));
  return matches.length / candidateTags.length;
}
