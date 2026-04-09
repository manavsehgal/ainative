/**
 * Deduplication engine for profile import.
 * Three-tier matching: exact ID, name match, content similarity.
 *
 * Keyword / Jaccard / tag-overlap helpers are shared with the chat workflow
 * dedup path — see `src/lib/util/similarity.ts`.
 */

import type { ProfileConfig } from "@/lib/validators/profile";
import type { AgentProfile } from "@/lib/agents/profiles/types";
import { extractKeywords, jaccard, tagOverlap } from "@/lib/util/similarity";

export interface DedupResult {
  candidate: ProfileConfig;
  candidateSkillMd: string;
  status: "new" | "exact-match" | "near-match";
  matchedProfile?: AgentProfile;
  matchReason?: string;
  similarity?: number;
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
