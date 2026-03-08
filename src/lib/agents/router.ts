import { executeClaudeTask } from "./claude-agent";

export async function executeTaskWithAgent(
  taskId: string,
  agentType = "claude-code"
): Promise<void> {
  switch (agentType) {
    case "claude-code":
      return executeClaudeTask(taskId);
    default:
      return executeClaudeTask(taskId);
  }
}
