/**
 * Trigger evaluator — checks active triggers on row mutations
 * and fires matching actions (create task or start workflow).
 */

import { db } from "@/lib/db";
import { userTableTriggers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { FilterSpec } from "./types";

type TriggerEvent = "row_added" | "row_updated" | "row_deleted";

interface ActionConfig {
  workflowId?: string;
  title?: string;
  description?: string;
  projectId?: string;
}

/**
 * Evaluate and fire triggers for a table event.
 * Called from row mutation API routes after successful writes.
 */
export async function evaluateTriggers(
  tableId: string,
  event: TriggerEvent,
  rowData: Record<string, unknown>
): Promise<void> {
  // Find active triggers matching this event
  const triggers = db
    .select()
    .from(userTableTriggers)
    .where(
      and(
        eq(userTableTriggers.tableId, tableId),
        eq(userTableTriggers.triggerEvent, event),
        eq(userTableTriggers.status, "active")
      )
    )
    .all();

  if (triggers.length === 0) return;

  for (const trigger of triggers) {
    // Evaluate condition if present
    if (trigger.condition) {
      const condition = JSON.parse(trigger.condition) as FilterSpec;
      if (!matchesCondition(rowData, condition)) continue;
    }

    // Fire the action
    try {
      const config = JSON.parse(trigger.actionConfig) as ActionConfig;
      await fireAction(trigger.actionType as "run_workflow" | "create_task", config, rowData);

      // Update fire count
      db.update(userTableTriggers)
        .set({
          fireCount: trigger.fireCount + 1,
          lastFiredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userTableTriggers.id, trigger.id))
        .run();
    } catch (err) {
      console.error(`[triggers] Failed to fire trigger ${trigger.id}:`, err);
    }
  }
}

/**
 * Check if row data matches a filter condition.
 * Reuses the same operator logic as the query builder.
 */
function matchesCondition(
  data: Record<string, unknown>,
  condition: FilterSpec
): boolean {
  const value = data[condition.column];
  const strValue = value == null ? "" : String(value);

  switch (condition.operator) {
    case "eq":
      return strValue === String(condition.value);
    case "neq":
      return strValue !== String(condition.value);
    case "gt":
      return Number(value) > Number(condition.value);
    case "gte":
      return Number(value) >= Number(condition.value);
    case "lt":
      return Number(value) < Number(condition.value);
    case "lte":
      return Number(value) <= Number(condition.value);
    case "contains":
      return strValue.toLowerCase().includes(String(condition.value).toLowerCase());
    case "starts_with":
      return strValue.toLowerCase().startsWith(String(condition.value).toLowerCase());
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(strValue);
    case "is_empty":
      // Whitespace-only counts as empty (matches SQL `is_empty` operator).
      return value == null || strValue.trim() === "";
    case "is_not_empty":
      return value != null && strValue.trim() !== "";
    default:
      return true;
  }
}

/**
 * Fire a trigger action — create a task or start a workflow.
 */
async function fireAction(
  actionType: "run_workflow" | "create_task",
  config: ActionConfig,
  rowData: Record<string, unknown>
): Promise<void> {
  if (actionType === "create_task") {
    const description = config.description
      ? `${config.description}\n\nTrigger data: ${JSON.stringify(rowData, null, 2)}`
      : `Triggered by table row change.\n\nData: ${JSON.stringify(rowData, null, 2)}`;

    await fetch(`${getBaseUrl()}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: config.title ?? "Triggered Task",
        description,
        projectId: config.projectId ?? null,
      }),
    });
  } else if (actionType === "run_workflow" && config.workflowId) {
    // Start workflow execution
    await fetch(`${getBaseUrl()}/api/workflows/${config.workflowId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: `Table row data: ${JSON.stringify(rowData, null, 2)}`,
      }),
    });
  }
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
