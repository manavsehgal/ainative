/**
 * Lightweight heuristic that flags when two SKILL.md bodies issue
 * divergent directives on the same topic. Pure function — no I/O.
 *
 * Approach (v1):
 *   1. For each skill, extract "directive lines" containing one of:
 *      always | never | must | prefer | use | avoid | don't | do not
 *   2. Tokenize each directive into content words (lowercase, drop
 *      stopwords + the directive verb itself).
 *   3. For each pair of directives across the two skills with significant
 *      keyword overlap (≥2 shared content words ≥4 chars), check if their
 *      directive verbs disagree (always vs never, prefer vs avoid, etc.).
 *   4. Surface the disagreeing pair as a SkillConflict.
 *
 * False positives are acceptable — the consumer presents excerpts to the
 * user, not a binary block. False negatives (semantic conflict without
 * keyword overlap) await the embedding-based v2.
 */

export interface SkillMarkdown {
  id: string;
  name: string;
  content: string;
}

export interface SkillConflict {
  skillA: string;       // skill name
  skillB: string;       // skill name
  sharedTopic: string;  // joined keywords that overlapped
  excerptA: string;     // the directive line from A
  excerptB: string;     // the directive line from B
}

const POSITIVE_DIRECTIVES = new Set(["always", "must", "prefer", "use", "do"]);
const NEGATIVE_DIRECTIVES = new Set(["never", "avoid", "don't", "dont", "skip"]);
const ALL_DIRECTIVES = new Set([...POSITIVE_DIRECTIVES, ...NEGATIVE_DIRECTIVES]);

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "without",
  "to", "of", "in", "on", "at", "by", "from", "as", "is", "are",
  "be", "this", "that", "these", "those", "it", "its", "before",
  "after", "during", "into", "out",
]);

interface DirectiveLine {
  raw: string;
  polarity: "positive" | "negative";
  keywords: Set<string>;
}

function extractDirectives(content: string): DirectiveLine[] {
  const lines = content.split(/\r?\n/);
  const out: DirectiveLine[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;
    const lower = line.toLowerCase();
    let polarity: "positive" | "negative" | null = null;
    for (const tok of lower.split(/\s+/)) {
      const cleaned = tok.replace(/[^a-z']/g, "");
      if (POSITIVE_DIRECTIVES.has(cleaned)) { polarity = "positive"; break; }
      if (NEGATIVE_DIRECTIVES.has(cleaned)) { polarity = "negative"; break; }
    }
    if (!polarity) continue;
    const keywords = new Set<string>();
    for (const tok of lower.split(/[^a-z0-9]+/)) {
      if (tok.length < 4) continue;
      if (STOPWORDS.has(tok) || ALL_DIRECTIVES.has(tok)) continue;
      keywords.add(tok);
    }
    if (keywords.size === 0) continue;
    out.push({ raw: line, polarity, keywords });
  }
  return out;
}

function intersect(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const tok of a) if (b.has(tok)) out.push(tok);
  return out;
}

export function detectSkillConflicts(
  a: SkillMarkdown,
  b: SkillMarkdown
): SkillConflict[] {
  const directivesA = extractDirectives(a.content);
  const directivesB = extractDirectives(b.content);
  const conflicts: SkillConflict[] = [];
  for (const da of directivesA) {
    for (const db of directivesB) {
      if (da.polarity === db.polarity) continue;
      const shared = intersect(da.keywords, db.keywords);
      if (shared.length < 2) continue;
      conflicts.push({
        skillA: a.name,
        skillB: b.name,
        sharedTopic: shared.slice(0, 3).join(", "),
        excerptA: da.raw,
        excerptB: db.raw,
      });
    }
  }
  return conflicts;
}
