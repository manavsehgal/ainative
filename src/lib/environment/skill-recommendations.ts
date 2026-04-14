import type { EnrichedSkill } from "./skill-enrichment";

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","your","will","not","but",
  "you","are","was","can","any","all","has","his","her","how","who","why","what",
  "when","where","use","using","used","its","into","new","one","two","get","got",
  "please","help","like","need","want","make","made","just","also","some",
  "more","most","very","than","then","them","they","their","out","off","put",
  "let","say","said","see","saw","per","via","about","over","under","code",
  "file","files",
]);

const MIN_KEYWORD_LEN = 4;
const MIN_DISTINCT_HITS = 2;

interface Options {
  activeSkillId?: string | null;
  dismissedIds?: Set<string>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_KEYWORD_LEN && !STOPWORDS.has(t));
}

export function computeRecommendation(
  skills: EnrichedSkill[],
  recentMessages: string[],
  opts: Options = {}
): EnrichedSkill | null {
  if (recentMessages.length === 0) return null;
  const messageTokens = new Set(tokenize(recentMessages.join(" ")));
  if (messageTokens.size === 0) return null;

  const candidates: Array<{ skill: EnrichedSkill; hits: number }> = [];

  for (const skill of skills) {
    if (opts.activeSkillId && skill.id === opts.activeSkillId) continue;
    if (opts.dismissedIds?.has(skill.id)) continue;
    if (skill.healthScore !== "healthy" && skill.healthScore !== "stale") continue;

    const skillTokens = new Set(tokenize(`${skill.name} ${skill.preview}`));
    let hits = 0;
    for (const t of skillTokens) {
      if (messageTokens.has(t)) hits++;
    }
    if (hits >= MIN_DISTINCT_HITS) {
      candidates.push({ skill, hits });
    }
  }

  if (candidates.length === 0) return null;

  // Rank by hits DESC, then health (healthy > stale), then name for determinism.
  candidates.sort((a, b) => {
    if (a.hits !== b.hits) return b.hits - a.hits;
    if (a.skill.healthScore !== b.skill.healthScore) {
      return a.skill.healthScore === "healthy" ? -1 : 1;
    }
    return a.skill.name.localeCompare(b.skill.name);
  });

  return candidates[0].skill;
}
