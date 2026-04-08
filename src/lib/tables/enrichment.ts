/**
 * Bulk row enrichment — generate row-driven loop workflows that fan out one
 * agent task per table row and write the result back via `postAction`.
 *
 * The pure helpers (`generateEnrichmentDefinition`, `filterUnpopulatedRows`)
 * have no DB dependencies and own the unit-test surface. The DB-backed
 * `createEnrichmentWorkflow` wires them up to `listRows` + `executeWorkflow`.
 *
 * See features/bulk-row-enrichment.md.
 */

import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listRows, getTable } from "@/lib/data/tables";
import { executeWorkflow } from "@/lib/workflows/engine";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import type { FilterSpec } from "@/lib/tables/types";

/** A row in the enrichment input — id + parsed user data. */
export interface EnrichmentRow {
  id: string;
  data: Record<string, unknown>;
}

export interface GenerateEnrichmentInput {
  rows: EnrichmentRow[];
  tableId: string;
  prompt: string;
  targetColumn: string;
  agentProfile: string;
  itemVariable?: string;
}

/**
 * Build a row-driven loop workflow definition. Pure — no DB. Each row's
 * `id` is merged into the bound iteration object so `{{row.id}}` works in
 * the postAction template AND the agent sees every user-defined column.
 *
 * The user's prompt is wrapped in an output-format contract so the agent
 * returns ONLY the value to write into the target cell (or the literal
 * `NOT_FOUND` sentinel). Without this scaffold, agents tend to return
 * verbose prose explanations that would clobber the target cell with
 * markdown garbage instead of being skipped by `shouldSkipPostActionValue`.
 */
export function generateEnrichmentDefinition(
  input: GenerateEnrichmentInput
): WorkflowDefinition {
  const itemVariable = input.itemVariable && input.itemVariable.length > 0
    ? input.itemVariable
    : "row";

  const items = input.rows.map((row) => ({
    id: row.id,
    ...row.data,
  }));

  return {
    pattern: "loop",
    steps: [
      {
        id: crypto.randomUUID(),
        name: "Enrich row",
        prompt: wrapPromptWithOutputContract(input.prompt, input.targetColumn),
        agentProfile: input.agentProfile,
        postAction: {
          type: "update_row",
          tableId: input.tableId,
          rowId: `{{${itemVariable}.id}}`,
          column: input.targetColumn,
        },
      },
    ],
    loopConfig: {
      maxIterations: items.length,
      items,
      itemVariable,
    },
  };
}

/**
 * Wrap a user-supplied enrichment prompt with an output-format contract
 * so the agent returns a single bare value (or `NOT_FOUND`). The wrapped
 * prompt is what gets persisted on the workflow step and sent to the agent
 * verbatim — there's no second layer of enforcement, so this contract has
 * to be unambiguous on its own.
 */
export function wrapPromptWithOutputContract(
  userPrompt: string,
  targetColumn: string
): string {
  return [
    userPrompt.trim(),
    "",
    "---",
    "RESPONSE FORMAT (strict — your response will be written verbatim into a single table cell):",
    `- Return ONLY the value to write into the "${targetColumn}" column.`,
    "- No explanations, no preamble, no markdown formatting, no surrounding prose, no source citations.",
    "- If you cannot determine a confident value, return the literal string: NOT_FOUND",
    "- Do NOT return prose like \"Not found\", \"Insufficient data\", or a guess — return exactly NOT_FOUND.",
  ].join("\n");
}

/**
 * Idempotent skip: drop rows whose target column already has a non-empty,
 * non-whitespace value. Missing keys, null, "", and whitespace-only all
 * count as "not yet populated". Mirrors the same emptiness rules used by
 * `shouldSkipPostActionValue` so the round-trip is consistent.
 */
export function filterUnpopulatedRows(
  rows: EnrichmentRow[],
  targetColumn: string
): EnrichmentRow[] {
  return rows.filter((row) => {
    const value = row.data[targetColumn];
    if (value === undefined || value === null) return true;
    if (typeof value !== "string") return false; // already a real value
    return value.trim() === "";
  });
}

// ── DB-backed wrapper ─────────────────────────────────────────────────

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;

export interface CreateEnrichmentWorkflowParams {
  prompt: string;
  targetColumn: string;
  filter?: FilterSpec;
  agentProfile?: string;
  projectId?: string | null;
  batchSize?: number;
  itemVariable?: string;
  workflowName?: string;
}

export interface CreateEnrichmentWorkflowResult {
  workflowId: string;
  rowCount: number;
}

/**
 * Create and start an enrichment workflow for a table. Lists matching rows
 * (capped at `batchSize`, max 200), filters out already-populated rows for
 * idempotency, generates a row-driven loop workflow, persists it, and fires
 * `executeWorkflow` (fire-and-forget per TDR-001).
 *
 * Throws if the table doesn't exist or the target column isn't in its schema.
 */
export async function createEnrichmentWorkflow(
  tableId: string,
  params: CreateEnrichmentWorkflowParams
): Promise<CreateEnrichmentWorkflowResult> {
  const table = await getTable(tableId);
  if (!table) {
    throw new Error(`Table ${tableId} not found`);
  }

  // Validate target column exists
  const columnSchema = JSON.parse(table.columnSchema) as Array<{ name: string }>;
  const columnNames = new Set(columnSchema.map((c) => c.name));
  if (!columnNames.has(params.targetColumn)) {
    throw new Error(
      `Column "${params.targetColumn}" does not exist on table ${tableId}`
    );
  }

  const batchSize = Math.min(
    params.batchSize ?? DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE
  );

  const rawRows = await listRows(tableId, {
    filters: params.filter ? [params.filter] : undefined,
    limit: batchSize,
  });

  const rows: EnrichmentRow[] = rawRows.map((r) => ({
    id: r.id,
    data: JSON.parse(r.data) as Record<string, unknown>,
  }));

  const eligible = filterUnpopulatedRows(rows, params.targetColumn);

  const definition = generateEnrichmentDefinition({
    rows: eligible,
    tableId,
    prompt: params.prompt,
    targetColumn: params.targetColumn,
    agentProfile: params.agentProfile ?? "sales-researcher",
    itemVariable: params.itemVariable,
  });

  const workflowId = crypto.randomUUID();
  const now = new Date();
  const name =
    params.workflowName?.trim() || `Enrich ${table.name} · ${params.targetColumn}`;

  await db.insert(workflows).values({
    id: workflowId,
    name,
    projectId: params.projectId ?? table.projectId ?? null,
    definition: JSON.stringify(definition),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  // Fire-and-forget execution (TDR-001) — don't await
  executeWorkflow(workflowId).catch((err) => {
    console.error(
      `[enrichment] executeWorkflow failed for ${workflowId}:`,
      err
    );
  });

  // Touch the workflow row to confirm DB write committed before responding
  await db.select().from(workflows).where(eq(workflows.id, workflowId));

  return {
    workflowId,
    rowCount: eligible.length,
  };
}
