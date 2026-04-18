/**
 * Provider-agnostic tool definition registry.
 *
 * `defineTool()` replaces the SDK's `tool()` so that tool definitions
 * are decoupled from any specific provider SDK. The resulting
 * `ToolDefinition` objects carry both the original Zod schema (for
 * backward-compatible SDK wrapping) and a pre-computed JSON Schema
 * (for direct API runtimes).
 */

import { z } from "zod";

// ── Types ────────────────────────────────────────────────────────────

/** MCP-compatible tool result (matches ok/err helper output). */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/** Provider-neutral tool definition (type-erased for storage in arrays). */
export interface ToolDefinition {
  name: string;
  description: string;
  /** Original Zod shape — retained for SDK bridge wrapping. */
  zodShape: z.ZodRawShape;
  /** Pre-computed JSON Schema (Draft 2020-12) for direct API runtimes. */
  inputSchema: Record<string, unknown>;
  /** Async handler that receives validated args and returns MCP content. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<ToolResult>;
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Define a provider-agnostic tool.
 *
 * Signature mirrors the SDK's `tool(name, description, zodShape, handler)`
 * so that converting existing tool files is a simple import swap.
 */
export function defineTool<T extends z.ZodRawShape>(
  name: string,
  description: string,
  inputShape: T,
  handler: (args: z.infer<z.ZodObject<T>>) => Promise<ToolResult>,
): ToolDefinition {
  const zodObject = z.object(inputShape);
  const inputSchema = z.toJSONSchema(zodObject) as Record<string, unknown>;

  return { name, description, zodShape: inputShape, inputSchema, handler };
}

// ── Provider formatters ──────────────────────────────────────────────

/** Format for Anthropic Messages API `tools` parameter. */
export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function toAnthropicToolDef(def: ToolDefinition): AnthropicToolDef {
  return {
    name: def.name,
    description: def.description,
    input_schema: def.inputSchema,
  };
}

/** Format for OpenAI Responses API function tool. */
export interface OpenAIFunctionDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toOpenAIFunctionDef(def: ToolDefinition): OpenAIFunctionDef {
  return {
    type: "function",
    function: {
      name: def.name,
      description: def.description,
      parameters: def.inputSchema,
    },
  };
}
