/**
 * Lightweight keyword-based profile suggestion.
 * Used as fallback when AI doesn't suggest a profile for a step.
 */

const KEYWORD_MAP: Record<string, string[]> = {
  researcher: ["research", "search", "investigate", "explore", "find", "discover", "analyze data", "survey"],
  "code-reviewer": ["review", "audit", "security", "vulnerability", "lint", "inspect", "code quality"],
  "document-writer": ["write", "document", "report", "summarize", "draft", "compose", "blog", "article"],
  "devops-engineer": ["deploy", "ci", "infrastructure", "pipeline", "docker", "kubernetes", "terraform", "monitor"],
  "data-analyst": ["analyze", "data", "statistics", "metrics", "chart", "visualization", "dashboard", "aggregate"],
};

export function suggestProfileForStep(
  title: string,
  description: string,
  availableProfileIds: string[]
): string {
  const text = `${title} ${description}`.toLowerCase();
  let bestProfile = "auto";
  let bestScore = 0;

  for (const [profileId, keywords] of Object.entries(KEYWORD_MAP)) {
    if (!availableProfileIds.includes(profileId)) continue;
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profileId;
    }
  }

  return bestScore >= 1 ? bestProfile : "auto";
}
