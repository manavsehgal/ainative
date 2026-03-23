/**
 * Shared helpers and types for Stagent chat MCP tools.
 */

/** Context passed to each tool factory — provides project scoping and entity callbacks. */
export interface ToolContext {
  projectId?: string | null;
  onToolResult?: (toolName: string, result: unknown) => void;
}

/** Wrap a successful tool result as MCP content. */
export function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Wrap an error message as MCP content. */
export function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}
