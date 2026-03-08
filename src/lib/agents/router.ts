import { executeClaudeTask, resumeClaudeTask } from "./claude-agent";

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
