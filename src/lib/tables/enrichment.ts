/**
 * Table enrichment orchestration.
 *
 * V1 shipped a single-step loop primitive. V2 keeps the row fan-out model but
 * promotes planning, typed contracts, and richer metadata so the same plan can
 * drive preview, launch, runtime validation, and recent-run UX.
 */

import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { listRows, getTable } from "@/lib/data/tables";
import { executeWorkflow } from "@/lib/workflows/engine";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import type { ColumnDef, FilterSpec } from "@/lib/tables/types";
import {
  assertEnrichmentCompatibleColumn,
  buildEnrichmentPlan,
  type EnrichmentPlan,
  type EnrichmentPromptMode,
  type EnrichmentRow,
  validateEnrichmentPlan,
  wrapPromptWithOutputContract,
} from "@/lib/tables/enrichment-planner";

export type { EnrichmentPlan, EnrichmentPromptMode, EnrichmentRow };
export { wrapPromptWithOutputContract };

export interface GenerateEnrichmentInput {
  rows: EnrichmentRow[];
  tableId: string;
  tableName?: string;
  targetColumn: ColumnDef | string;
  plan?: EnrichmentPlan;
  prompt?: string;
  agentProfile?: string;
  itemVariable?: string;
}

/**
 * Build a row-driven loop workflow definition. Each plan step becomes one
 * inner step inside the row iteration. Only the final step carries the
 * writeback postAction.
 */
export function generateEnrichmentDefinition(
  input: GenerateEnrichmentInput
): WorkflowDefinition {
  const targetColumn =
    typeof input.targetColumn === "string"
      ? {
          name: input.targetColumn,
          displayName: input.targetColumn,
          dataType: "text" as const,
          position: 0,
        }
      : input.targetColumn;
  const plan =
    input.plan ??
    buildEnrichmentPlan({
      targetColumn,
      sampleRows: input.rows,
      eligibleRowCount: input.rows.length,
      promptMode: "custom",
      prompt: input.prompt ?? "",
      agentProfileOverride: input.agentProfile,
    });
  const itemVariable =
    input.itemVariable && input.itemVariable.length > 0
      ? input.itemVariable
      : "row";

  const items = input.rows.map((row) => ({
    id: row.id,
    ...row.data,
  }));

  return {
    pattern: "loop",
    steps: plan.steps.map((step, index) => ({
      id: step.id,
      name: step.name,
      prompt: step.prompt,
      agentProfile: step.agentProfile ?? plan.agentProfile,
      postAction:
        index === plan.steps.length - 1
          ? {
              type: "update_row" as const,
              tableId: input.tableId,
              rowId: `{{${itemVariable}.id}}`,
              column: targetColumn.name,
            }
          : undefined,
    })),
    loopConfig: {
      maxIterations: items.length,
      items,
      itemVariable,
    },
    metadata: {
      enrichment: {
        tableId: input.tableId,
        tableName: input.tableName ?? input.tableId,
        targetColumn: targetColumn.name,
        targetColumnLabel: targetColumn.displayName,
        promptMode: plan.promptMode,
        strategy: plan.strategy,
        agentProfile: plan.agentProfile,
        eligibleRowCount: items.length,
        targetContract: plan.targetContract,
      },
    },
  };
}

/**
 * Idempotent skip: drop rows whose target column already has a non-empty,
 * non-whitespace value. Missing keys, null, "", and whitespace-only all
 * count as "not yet populated".
 */
export function filterUnpopulatedRows(
  rows: EnrichmentRow[],
  targetColumn: string
): EnrichmentRow[] {
  return rows.filter((row) => {
    const value = row.data[targetColumn];
    if (value === undefined || value === null) return true;
    if (typeof value !== "string") return false;
    return value.trim() === "";
  });
}

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;

interface EnrichmentPlanningParams {
  targetColumn: string;
  filter?: FilterSpec;
  promptMode?: EnrichmentPromptMode;
  prompt?: string;
  agentProfile?: string;
  agentProfileOverride?: string;
  batchSize?: number;
}

export interface PreviewEnrichmentPlanParams extends EnrichmentPlanningParams {}

export interface CreateEnrichmentWorkflowParams extends EnrichmentPlanningParams {
  projectId?: string | null;
  itemVariable?: string;
  workflowName?: string;
  plan?: EnrichmentPlan;
}

export interface CreateEnrichmentWorkflowResult {
  workflowId: string;
  rowCount: number;
}

export interface EnrichmentRunSummary {
  workflowId: string;
  name: string;
  status: string;
  updatedAt: string;
  targetColumn: string;
  targetColumnLabel: string;
  rowCount: number;
  strategy: EnrichmentPlan["strategy"];
  promptMode: EnrichmentPromptMode;
}

export async function previewEnrichmentPlan(
  tableId: string,
  params: PreviewEnrichmentPlanParams
): Promise<EnrichmentPlan> {
  const prepared = await prepareEnrichment(tableId, params);
  return buildEnrichmentPlan({
    targetColumn: prepared.targetColumn,
    sampleRows: prepared.eligibleRows,
    eligibleRowCount: prepared.eligibleRows.length,
    promptMode: resolvePromptMode(params.promptMode, params.prompt),
    prompt: params.prompt,
    agentProfileOverride: params.agentProfileOverride ?? params.agentProfile,
    filter: params.filter,
  });
}

export async function createEnrichmentWorkflow(
  tableId: string,
  params: CreateEnrichmentWorkflowParams
): Promise<CreateEnrichmentWorkflowResult> {
  const prepared = await prepareEnrichment(tableId, params);

  const plan =
    params.plan ??
    buildEnrichmentPlan({
      targetColumn: prepared.targetColumn,
      sampleRows: prepared.eligibleRows,
      eligibleRowCount: prepared.eligibleRows.length,
      promptMode: resolvePromptMode(params.promptMode, params.prompt),
      prompt: params.prompt,
      agentProfileOverride: params.agentProfileOverride ?? params.agentProfile,
      filter: params.filter,
    });

  validateEnrichmentPlan(plan, prepared.targetColumn);

  const definition = generateEnrichmentDefinition({
    rows: prepared.eligibleRows,
    tableId,
    tableName: prepared.table.name,
    targetColumn: prepared.targetColumn,
    plan,
    itemVariable: params.itemVariable,
  });

  const workflowId = crypto.randomUUID();
  const now = new Date();
  const name =
    params.workflowName?.trim() ||
    `Enrich ${prepared.table.name} · ${prepared.targetColumn.displayName}`;

  await db.insert(workflows).values({
    id: workflowId,
    name,
    projectId: params.projectId ?? prepared.table.projectId ?? null,
    definition: JSON.stringify(definition),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  executeWorkflow(workflowId).catch((err) => {
    console.error(`[enrichment] executeWorkflow failed for ${workflowId}:`, err);
  });

  await db.select().from(workflows).where(eq(workflows.id, workflowId));

  return {
    workflowId,
    rowCount: prepared.eligibleRows.length,
  };
}

export async function listRecentEnrichmentRuns(
  tableId: string,
  limit: number = 5
): Promise<EnrichmentRunSummary[]> {
  const rows = await db
    .select()
    .from(workflows)
    .orderBy(desc(workflows.updatedAt));

  const runs = rows
    .map((workflow): EnrichmentRunSummary | null => {
      try {
        const definition = JSON.parse(workflow.definition) as WorkflowDefinition;
        const meta = definition.metadata?.enrichment;
        if (!meta || meta.tableId !== tableId) return null;
        return {
          workflowId: workflow.id,
          name: workflow.name,
          status: workflow.status,
          updatedAt: workflow.updatedAt.toISOString(),
          targetColumn: meta.targetColumn,
          targetColumnLabel: meta.targetColumnLabel,
          rowCount: meta.eligibleRowCount,
          strategy: meta.strategy,
          promptMode: meta.promptMode,
        } satisfies EnrichmentRunSummary;
      } catch {
        return null;
      }
    });

  return runs
    .filter((run): run is EnrichmentRunSummary => run !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

async function prepareEnrichment(
  tableId: string,
  params: EnrichmentPlanningParams
): Promise<{
  table: NonNullable<Awaited<ReturnType<typeof getTable>>>;
  targetColumn: ColumnDef;
  eligibleRows: EnrichmentRow[];
}> {
  const table = await getTable(tableId);
  if (!table) {
    throw new Error(`Table ${tableId} not found`);
  }

  const columnSchema = JSON.parse(table.columnSchema) as ColumnDef[];
  const targetColumn = columnSchema.find((column) => column.name === params.targetColumn);
  if (!targetColumn) {
    throw new Error(
      `Column "${params.targetColumn}" does not exist on table ${tableId}`
    );
  }
  assertEnrichmentCompatibleColumn(targetColumn);

  const batchSize = Math.min(params.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
  const rawRows = await listRows(tableId, {
    filters: params.filter ? [params.filter] : undefined,
    limit: batchSize,
  });

  const rows: EnrichmentRow[] = rawRows.map((row) => ({
    id: row.id,
    data: JSON.parse(row.data) as Record<string, unknown>,
  }));

  const eligibleRows = filterUnpopulatedRows(rows, targetColumn.name);
  return {
    table,
    targetColumn,
    eligibleRows,
  };
}

function resolvePromptMode(
  promptMode: EnrichmentPromptMode | undefined,
  prompt: string | undefined
): EnrichmentPromptMode {
  if (promptMode) return promptMode;
  return prompt?.trim() ? "custom" : "auto";
}
