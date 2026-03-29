/**
 * Deduplication engine for profile import.
 * Three-tier matching: exact ID, name match, content similarity.
 */

import type { ProfileConfig } from "@/lib/validators/profile";
import type { AgentProfile } from "@/lib/agents/profiles/types";

export interface DedupResult {
  candidate: ProfileConfig;
  candidateSkillMd: string;
  status: "new" | "exact-match" | "near-match";
  matchedProfile?: AgentProfile;
  matchReason?: string;
  similarity?: number;
}

/** Common stop words to exclude from keyword extraction. */
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "have", "that", "this", "with",
  "from", "they", "been", "will", "each", "make", "like", "into", "them",
  "some", "when", "what", "your", "should", "would", "could", "about",
  "which", "their", "other", "than", "then", "more", "also", "been",
  "only", "must", "does", "here", "just", "over", "such", "after",
  "before", "between", "through", "where", "these", "those", "being",
  "using", "ensure", "every", "following", "include",
]);

/** Extract meaningful keywords from text. */
function extractKeywords(text: string, limit = 20): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && w.length < 30 && !STOP_WORDS.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Sort by frequency, take top N
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);

  return new Set(sorted);
}

/** Jaccard similarity between two sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Tag overlap ratio (how many of candidate's tags match existing). */
function tagOverlap(candidateTags: string[], existingTags: string[]): number {
  if (candidateTags.length === 0) return 0;
  const existingSet = new Set(existingTags.map((t) => t.toLowerCase()));
  const matches = candidateTags.filter((t) => existingSet.has(t.toLowerCase()));
  return matches.length / candidateTags.length;
}

/**
 * Check a batch of candidate profiles against all existing profiles for duplicates.
 */
export function checkDuplicates(
  candidates: Array<{ config: ProfileConfig; skillMd: string }>,
  existingProfiles: AgentProfile[]
): DedupResult[] {
  return candidates.map(({ config, skillMd }) => {
    // Tier 1: Exact ID match
    const idMatch = existingProfiles.find(
      (p) => p.id === config.id
    );
    if (idMatch) {
      return {
        candidate: config,
        candidateSkillMd: skillMd,
        status: "exact-match" as const,
        matchedProfile: idMatch,
        matchReason: `Same ID: "${config.id}"`,
        similarity: 1.0,
      };
    }

    // Tier 2: Name match (case-insensitive)
    const nameMatch = existingProfiles.find(
      (p) => p.name.toLowerCase() === config.name.toLowerCase()
    );
    if (nameMatch) {
      return {
        candidate: config,
        candidateSkillMd: skillMd,
        status: "exact-match" as const,
        matchedProfile: nameMatch,
        matchReason: `Same name: "${config.name}"`,
        similarity: 1.0,
      };
    }

    // Tier 3: Content similarity via keyword Jaccard + tag overlap
    const candidateKeywords = extractKeywords(skillMd);
    let bestSimilarity = 0;
    let bestMatch: AgentProfile | undefined;

    for (const existing of existingProfiles) {
      const existingKeywords = extractKeywords(existing.skillMd);
      let similarity = jaccard(candidateKeywords, existingKeywords);

      // Boost by tag overlap
      const overlap = tagOverlap(config.tags, existing.tags);
      if (overlap > 0.5) {
        similarity = Math.min(1.0, similarity + 0.1);
      }

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = existing;
      }
    }

    if (bestSimilarity > 0.6 && bestMatch) {
      return {
        candidate: config,
        candidateSkillMd: skillMd,
        status: "near-match" as const,
        matchedProfile: bestMatch,
        matchReason: `Similar content to "${bestMatch.name}" (${Math.round(bestSimilarity * 100)}%)`,
        similarity: bestSimilarity,
      };
    }

    // No match found
    return {
      candidate: config,
      candidateSkillMd: skillMd,
      status: "new" as const,
    };
  });
}
