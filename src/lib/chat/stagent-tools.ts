import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { type ToolContext } from "./tools/helpers";
import { projectTools } from "./tools/project-tools";
import { taskTools } from "./tools/task-tools";
import { workflowTools } from "./tools/workflow-tools";
import { scheduleTools } from "./tools/schedule-tools";
import { documentTools } from "./tools/document-tools";
import { notificationTools } from "./tools/notification-tools";
import { profileTools } from "./tools/profile-tools";
import { usageTools } from "./tools/usage-tools";
import { settingsTools } from "./tools/settings-tools";

/**
 * Create an in-process MCP server exposing all Stagent tools.
 * The `projectId` closure auto-scopes operations to the active project.
 * `onToolResult` is called after each successful CRUD operation with the
 * tool name and returned entity data — used by the entity detector to
 * generate deterministic Quick Access navigation links.
 */
export function createStagentMcpServer(
  projectId?: string | null,
  onToolResult?: (toolName: string, result: unknown) => void
) {
  const ctx: ToolContext = { projectId, onToolResult };

  return createSdkMcpServer({
    name: "stagent",
    version: "1.0.0",
    tools: [
      ...projectTools(ctx),
      ...taskTools(ctx),
      ...workflowTools(ctx),
      ...scheduleTools(ctx),
      ...documentTools(ctx),
      ...notificationTools(ctx),
      ...profileTools(ctx),
      ...usageTools(ctx),
      ...settingsTools(ctx),
    ],
  });
}
