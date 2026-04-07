/**
 * Heuristic prompt-efficiency analyzer for scheduled prompts.
 *
 * Field deployments showed that scheduled tasks frequently exhausted their
 * `maxTurns` budget because authors wrote prompts using per-item language
 * ("for each holding, search the price"), which causes agents to issue N
 * sequential tool calls instead of one batched call. This analyzer flags
 * those patterns at schedule-creation time so the user can rewrite the
 * prompt before it ever fires.
 *
 * The analyzer is intentionally conservative: it returns *warnings*, not
 * errors. The chat tool surfaces them to the user but still creates the
 * schedule. The runtime turn limit remains the hard backstop.
 */

export type WarningSeverity = "low" | "medium" | "high";

export interface PromptWarning {
  type: string;
  severity: WarningSeverity;
  message: string;
}

const LOOP_PATTERNS: RegExp[] = [
  /\bfor each\b/i,
  /\bfor every\b/i,
  /\bone by one\b/i,
  /\bindividually\b/i,
  /\bper[\s-]?(symbol|stock|item|market|ticker|holding|row)\b/i,
  /\bsearch for [^.]+ then search for\b/i,
];

const LARGE_LIST_PATTERNS: RegExp[] = [
  /\ball \d{2,}\b/i, // "all 32 markets"
  /\beach of the \d{2,}\b/i,
];

/**
 * Analyze a scheduled prompt for known turn-exhaustion anti-patterns.
 *
 * The estimate uses a deliberately rough heuristic: count occurrences of
 * search/fetch/lookup verbs and table operations, add 3 for orchestration
 * overhead, and warn if the result exceeds 30. Tuned against the failures
 * observed in production (97 / 84 / 69 turn cases all triggered).
 */
export function analyzePromptEfficiency(prompt: string): PromptWarning[] {
  const warnings: PromptWarning[] = [];

  for (const pattern of LOOP_PATTERNS) {
    if (pattern.test(prompt)) {
      warnings.push({
        type: "loop_pattern",
        severity: "high",
        message:
          "Prompt contains per-item processing language. Consider batching: instead of \"search for each stock price\", use \"search for all stock prices in one query: AMZN GOOGL NVDA...\".",
      });
      break;
    }
  }

  for (const pattern of LARGE_LIST_PATTERNS) {
    if (pattern.test(prompt)) {
      warnings.push({
        type: "large_list",
        severity: "medium",
        message:
          "Prompt references a large number of items. Consider a bulk API call instead of iterating.",
      });
      break;
    }
  }

  // Rough turn estimate. Each search-style verb ≈ 1 turn; each table op ≈ 1 turn.
  const webSearchCount = (prompt.match(/\b(search|fetch|look up|check.*price)\b/gi) || []).length;
  const tableOps = (prompt.match(/\b(read|query|update|insert|write).*(table|row)\b/gi) || []).length;
  const estimatedTurns = webSearchCount + tableOps + 3;

  if (estimatedTurns > 30) {
    warnings.push({
      type: "high_turn_estimate",
      severity: "high",
      message: `Estimated ${estimatedTurns}+ turns required. Consider splitting into a multi-step workflow or batching operations.`,
    });
  }

  return warnings;
}
