/**
 * Shared helpers and types for Stagent chat MCP tools.
 */

import { db } from "@/lib/db";
import { like } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

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

/**
 * Resolve an entity ID that may be a prefix (8+ chars) to the full UUID.
 * Uses LIKE 'prefix%' which hits the primary key B-tree index on SQLite.
 *
 * Fast path: IDs >=32 chars are returned as-is (already full UUIDs).
 */
export async function resolveEntityId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: SQLiteTableWithColumns<any>,
  idColumn: SQLiteColumn,
  rawId: string,
): Promise<{ id: string } | { error: string }> {
  // Full UUIDs are 36 chars (with hyphens) or 32 (without) — skip prefix search
  if (rawId.length >= 32) {
    return { id: rawId };
  }

  const matches = await db
    .select({ id: idColumn })
    .from(table)
    .where(like(idColumn, `${rawId}%`))
    .limit(2);

  if (matches.length === 0) {
    return { error: `No entity found matching ID prefix: ${rawId}` };
  }
  if (matches.length > 1) {
    return {
      error: `Ambiguous ID prefix "${rawId}" matches multiple entities: ${matches.map((m) => m.id).join(", ")}. Use the full ID.`,
    };
  }
  return { id: matches[0].id as string };
}
