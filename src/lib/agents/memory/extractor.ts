import { db } from "@/lib/db";
import { agentMemory } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { MemoryExtractionResult } from "./types";

/** Keywords that signal a preference statement */
const PREFERENCE_KEYWORDS = [
  "prefer",
  "should",
  "recommend",
  "best practice",
  "always",
  "never",
  "avoid",
  "instead",
  "better to",
];

/** Keywords that signal an outcome statement */
const OUTCOME_KEYWORDS = [
  "succeeded",
  "failed",
  "error",
  "success",
  "completed",
  "result",
  "resolved",
  "fixed",
  "broke",
  "caused",
];

/** Keywords that signal a pattern (conditional logic) */
const PATTERN_KEYWORDS = [
  "when",
  "if",
  "whenever",
  "each time",
  "tends to",
  "usually",
  "typically",
  "pattern",
  "consistently",
];

/** Phrases that start definitive factual statements */
const FACT_STARTERS = [
  "the ",
  "this project ",
  "this repo ",
  "users ",
  "the system ",
  "the api ",
  "the database ",
  "the app ",
  "currently ",
];

function classifyStatement(line: string): MemoryExtractionResult["category"] {
  const lower = line.toLowerCase();

  if (PATTERN_KEYWORDS.some((kw) => lower.includes(kw))) return "pattern";
  if (PREFERENCE_KEYWORDS.some((kw) => lower.includes(kw))) return "preference";
  if (OUTCOME_KEYWORDS.some((kw) => lower.includes(kw))) return "outcome";
  return "fact";
}

function extractTags(line: string): string[] {
  const tags: string[] = [];
  // Extract words that look like identifiers or technical terms (camelCase, kebab-case, etc.)
  const techTerms = line.match(
    /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b|\b[a-z]+-[a-z]+(?:-[a-z]+)*\b|\b[A-Z]{2,}\b/g
  );
  if (techTerms) {
    tags.push(...techTerms.slice(0, 5));
  }
  return [...new Set(tags)];
}

function extractStatements(text: string): string[] {
  const lines = text.split("\n");
  const statements: string[] = [];

  for (const raw of lines) {
    // Clean up markdown bullets and heading markers
    const line = raw.replace(/^[\s]*[-*>#]+\s*/, "").trim();
    if (line.length < 20 || line.length > 500) continue;

    // Skip code blocks, URLs, file paths that are just paths
    if (line.startsWith("```") || line.startsWith("http") || /^[\/.][\w\/]+$/.test(line)) continue;

    const lower = line.toLowerCase();

    // Check for definitive starters
    const isDefinitive = FACT_STARTERS.some((s) => lower.startsWith(s));
    // Check for keyword matches
    const hasKeyword = [
      ...PREFERENCE_KEYWORDS,
      ...OUTCOME_KEYWORDS,
      ...PATTERN_KEYWORDS,
    ].some((kw) => lower.includes(kw));

    if (isDefinitive || hasKeyword) {
      statements.push(line);
    }
  }

  return statements;
}

/**
 * Check if a candidate memory is too similar to existing memories for the profile.
 * Returns true if a similar memory already exists (>80% substring overlap).
 */
function isSimilarToExisting(
  candidate: string,
  existingContents: string[]
): boolean {
  const candidateLower = candidate.toLowerCase();
  for (const existing of existingContents) {
    const existingLower = existing.toLowerCase();
    // Simple substring check: if either contains >80% of the other
    const shorter =
      candidateLower.length < existingLower.length
        ? candidateLower
        : existingLower;
    const longer =
      candidateLower.length >= existingLower.length
        ? candidateLower
        : existingLower;
    if (longer.includes(shorter)) return true;
    // Check word overlap
    const candidateWords = new Set(candidateLower.split(/\s+/));
    const existingWords = new Set(existingLower.split(/\s+/));
    const overlap = [...candidateWords].filter((w) => existingWords.has(w));
    const overlapRatio =
      overlap.length / Math.max(candidateWords.size, existingWords.size);
    if (overlapRatio > 0.8) return true;
  }
  return false;
}

/**
 * Extract factual knowledge memories from a task result text.
 * Uses heuristic pattern extraction (no LLM calls).
 */
export async function extractMemories(
  taskResult: string,
  profileId: string
): Promise<MemoryExtractionResult[]> {
  if (!taskResult || taskResult.trim().length === 0) return [];

  // Get existing memory contents for deduplication
  const existingMemories = db
    .select({ content: agentMemory.content })
    .from(agentMemory)
    .where(
      and(eq(agentMemory.profileId, profileId), eq(agentMemory.status, "active"))
    )
    .all();
  const existingContents = existingMemories.map((m) => m.content);

  const statements = extractStatements(taskResult);
  const results: MemoryExtractionResult[] = [];

  for (const statement of statements) {
    if (isSimilarToExisting(statement, existingContents)) continue;

    const category = classifyStatement(statement);
    const tags = extractTags(statement);
    const confidence = category === "fact" ? 0.7 : category === "pattern" ? 0.5 : 0.6;

    results.push({ category, content: statement, tags, confidence });

    // Also add to existing contents to deduplicate within this batch
    existingContents.push(statement);
  }

  // Cap at 20 memories per extraction to avoid noise
  return results.slice(0, 20);
}
