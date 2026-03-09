import { executeClaudeTask, resumeClaudeTask } from "./claude-agent";
import { getProfileTags } from "./profiles/registry";

/**
 * Classify a task into an agent profile based on keyword matching.
 * Scores each profile by keyword hits in title + description.
 * Returns the highest-scoring profile ID, or "general" if no strong match.
 */
export function classifyTaskProfile(title: string, description?: string | null): string {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const tagMap = getProfileTags();

  let bestProfile = "general";
  let bestScore = 0;

  for (const [profileId, tags] of tagMap) {
    if (profileId === "general") continue;
    let score = 0;
    for (const tag of tags) {
      if (text.includes(tag)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profileId;
    }
  }

  // Require at least 2 keyword hits to avoid false positives
  return bestScore >= 2 ? bestProfile : "general";
}

export async function executeTaskWithAgent(
  taskId: string,
  agentType = "claude-code"
): Promise<void> {
  switch (agentType) {
    case "claude-code":
      return executeClaudeTask(taskId);
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

export async function resumeTaskWithAgent(
  taskId: string,
  agentType = "claude-code"
): Promise<void> {
  switch (agentType) {
    case "claude-code":
      return resumeClaudeTask(taskId);
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}
