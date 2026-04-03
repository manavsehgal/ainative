/**
 * Build markdown context for tables linked to tasks/workflows.
 * Mirrors the document context-builder pattern.
 */

import { db } from "@/lib/db";
import {
  taskTableInputs,
  workflowTableInputs,
  userTables,
  userTableRows,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { ColumnDef } from "./types";

/**
 * Build table context for a task — queries task_table_inputs junction,
 * returns formatted schema + sample rows as markdown.
 */
export async function buildTableContext(taskId: string): Promise<string> {
  const links = db
    .select({ tableId: taskTableInputs.tableId })
    .from(taskTableInputs)
    .where(eq(taskTableInputs.taskId, taskId))
    .all();

  if (links.length === 0) return "";

  const tableIds = links.map((l) => l.tableId);
  const tables = db
    .select()
    .from(userTables)
    .where(inArray(userTables.id, tableIds))
    .all();

  if (tables.length === 0) return "";

  const sections: string[] = [];

  for (const table of tables) {
    let columns: ColumnDef[] = [];
    try {
      columns = JSON.parse(table.columnSchema) as ColumnDef[];
    } catch {
      continue;
    }

    // Fetch up to 5 sample rows
    const sampleRows = db
      .select()
      .from(userTableRows)
      .where(eq(userTableRows.tableId, table.id))
      .limit(5)
      .all();

    const lines: string[] = [];
    lines.push(`### Table: ${table.name}`);
    if (table.description) lines.push(table.description);
    lines.push(`Rows: ${table.rowCount} | Columns: ${columns.length}`);
    lines.push("");

    // Schema as markdown table
    lines.push("| Column | Type | Required |");
    lines.push("|--------|------|----------|");
    for (const col of columns) {
      lines.push(`| ${col.displayName} | ${col.dataType} | ${col.required ? "Yes" : "No"} |`);
    }
    lines.push("");

    // Sample data as markdown table
    if (sampleRows.length > 0 && columns.length > 0) {
      const displayCols = columns.slice(0, 6); // Limit width
      lines.push("**Sample data:**");
      lines.push("| " + displayCols.map((c) => c.displayName).join(" | ") + " |");
      lines.push("| " + displayCols.map(() => "---").join(" | ") + " |");

      for (const row of sampleRows) {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(row.data) as Record<string, unknown>;
        } catch {
          continue;
        }
        const cells = displayCols.map((c) => {
          const val = data[c.name];
          if (val == null || val === "") return "—";
          const str = String(val);
          return str.length > 40 ? str.slice(0, 37) + "..." : str;
        });
        lines.push("| " + cells.join(" | ") + " |");
      }
      lines.push("");
    }

    sections.push(lines.join("\n"));
  }

  if (sections.length === 0) return "";

  return "## Linked Tables\n\n" + sections.join("\n---\n\n");
}

/**
 * Build table context for a workflow — aggregates table context
 * for all linked tables.
 */
export async function buildWorkflowTableContext(
  workflowId: string
): Promise<string> {
  const links = db
    .select({ tableId: workflowTableInputs.tableId })
    .from(workflowTableInputs)
    .where(eq(workflowTableInputs.workflowId, workflowId))
    .all();

  if (links.length === 0) return "";

  const tableIds = links.map((l) => l.tableId);
  const tables = db
    .select()
    .from(userTables)
    .where(inArray(userTables.id, tableIds))
    .all();

  if (tables.length === 0) return "";

  const lines: string[] = ["## Workflow Tables\n"];
  for (const table of tables) {
    let columns: ColumnDef[] = [];
    try {
      columns = JSON.parse(table.columnSchema) as ColumnDef[];
    } catch {
      continue;
    }
    lines.push(`- **${table.name}**: ${columns.length} columns, ${table.rowCount} rows`);
  }

  return lines.join("\n");
}
