import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  schedules,
  tasks,
  usageLedger,
  workflows,
} from "@/lib/db/schema";
import { deriveUsageCostMicros } from "./pricing";

export type UsageActivityType =
  | "task_run"
  | "task_resume"
  | "workflow_step"
  | "scheduled_firing"
  | "task_assist"
  | "profile_test";

export type UsageLedgerStatus =
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked"
  | "unknown_pricing";

export interface UsageSnapshot {
  modelId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface UsageLedgerWriteInput extends UsageSnapshot {
  taskId?: string | null;
  workflowId?: string | null;
  scheduleId?: string | null;
  projectId?: string | null;
  activityType: UsageActivityType;
  runtimeId: string;
  providerId: string;
  status: Exclude<UsageLedgerStatus, "unknown_pricing">;
  startedAt: Date;
  finishedAt: Date;
}

export interface UsageAuditEntry {
  id: string;
  activityType: UsageActivityType;
  runtimeId: string;
  providerId: string;
  modelId: string | null;
  status: UsageLedgerStatus;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costMicros: number | null;
  pricingVersion: string | null;
  startedAt: Date;
  finishedAt: Date;
  taskId: string | null;
  taskTitle: string | null;
  workflowId: string | null;
  workflowName: string | null;
  scheduleId: string | null;
  scheduleName: string | null;
  projectId: string | null;
  projectName: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return null;
}

function mergeValue(
  current: number | string | null | undefined,
  next: number | string | null | undefined
) {
  return current ?? next ?? null;
}

export function mergeUsageSnapshot(
  current: UsageSnapshot,
  next: UsageSnapshot
): UsageSnapshot {
  return {
    modelId: mergeValue(current.modelId, next.modelId) as string | null,
    inputTokens: mergeValue(current.inputTokens, next.inputTokens) as number | null,
    outputTokens: mergeValue(current.outputTokens, next.outputTokens) as number | null,
    totalTokens: mergeValue(current.totalTokens, next.totalTokens) as number | null,
  };
}

export function extractUsageSnapshot(value: unknown): UsageSnapshot {
  const snapshot: UsageSnapshot = {};
  const visited = new Set<unknown>();

  function visit(node: unknown, depth: number) {
    if (depth > 6 || node == null || visited.has(node)) {
      return;
    }
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((entry) => visit(entry, depth + 1));
      return;
    }

    if (!isRecord(node)) {
      return;
    }

    const modelId =
      (typeof node.model === "string" ? node.model : null) ??
      (typeof node.modelId === "string" ? node.modelId : null) ??
      (typeof node.model_id === "string" ? node.model_id : null);
    if (modelId && !snapshot.modelId) {
      snapshot.modelId = modelId;
    }

    const inputTokens =
      parseInteger(node.input_tokens) ??
      parseInteger(node.inputTokens) ??
      parseInteger(node.prompt_tokens) ??
      parseInteger(node.promptTokens);
    if (inputTokens !== null && snapshot.inputTokens == null) {
      snapshot.inputTokens = inputTokens;
    }

    const outputTokens =
      parseInteger(node.output_tokens) ??
      parseInteger(node.outputTokens) ??
      parseInteger(node.completion_tokens) ??
      parseInteger(node.completionTokens);
    if (outputTokens !== null && snapshot.outputTokens == null) {
      snapshot.outputTokens = outputTokens;
    }

    const totalTokens =
      parseInteger(node.total_tokens) ?? parseInteger(node.totalTokens);
    if (totalTokens !== null && snapshot.totalTokens == null) {
      snapshot.totalTokens = totalTokens;
    }

    Object.values(node).forEach((child) => visit(child, depth + 1));
  }

  visit(value, 0);

  if (
    snapshot.totalTokens == null &&
    snapshot.inputTokens != null &&
    snapshot.outputTokens != null
  ) {
    snapshot.totalTokens = snapshot.inputTokens + snapshot.outputTokens;
  }

  return snapshot;
}

export function resolveUsageActivityType(input: {
  workflowId?: string | null;
  scheduleId?: string | null;
  isResume?: boolean;
}): UsageActivityType {
  if (input.workflowId) {
    return "workflow_step";
  }
  if (input.scheduleId) {
    return "scheduled_firing";
  }
  return input.isResume ? "task_resume" : "task_run";
}

export async function recordUsageLedgerEntry(input: UsageLedgerWriteInput) {
  const normalizedInputTokens = input.inputTokens ?? null;
  const normalizedOutputTokens = input.outputTokens ?? null;
  const normalizedTotalTokens =
    input.totalTokens ??
    (normalizedInputTokens != null && normalizedOutputTokens != null
      ? normalizedInputTokens + normalizedOutputTokens
      : null);
  const { costMicros, pricingVersion } = deriveUsageCostMicros({
    providerId: input.providerId,
    modelId: input.modelId,
    inputTokens: normalizedInputTokens,
    outputTokens: normalizedOutputTokens,
  });

  const status: UsageLedgerStatus =
    input.status === "completed" &&
    normalizedTotalTokens != null &&
    costMicros === null
      ? "unknown_pricing"
      : input.status;

  const row = {
    id: crypto.randomUUID(),
    taskId: input.taskId ?? null,
    workflowId: input.workflowId ?? null,
    scheduleId: input.scheduleId ?? null,
    projectId: input.projectId ?? null,
    activityType: input.activityType,
    runtimeId: input.runtimeId,
    providerId: input.providerId,
    modelId: input.modelId ?? null,
    status,
    inputTokens: normalizedInputTokens,
    outputTokens: normalizedOutputTokens,
    totalTokens: normalizedTotalTokens,
    costMicros,
    pricingVersion,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
  } as const;

  await db.insert(usageLedger).values(row);
  return row;
}

function startOfWindow(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function formatLocalDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getDailySpendTotals(days = 7) {
  const rows = await db
    .select()
    .from(usageLedger)
    .where(gte(usageLedger.finishedAt, startOfWindow(days)))
    .orderBy(usageLedger.finishedAt);

  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const day = formatLocalDay(row.finishedAt);
    totals.set(day, (totals.get(day) ?? 0) + (row.costMicros ?? 0));
  });

  return Array.from(totals.entries()).map(([day, costMicros]) => ({
    day,
    costMicros,
  }));
}

export async function getDailyTokenTotals(days = 7) {
  const rows = await db
    .select()
    .from(usageLedger)
    .where(gte(usageLedger.finishedAt, startOfWindow(days)))
    .orderBy(usageLedger.finishedAt);

  const totals = new Map<
    string,
    { inputTokens: number; outputTokens: number; totalTokens: number }
  >();

  rows.forEach((row) => {
    const day = formatLocalDay(row.finishedAt);
    const bucket = totals.get(day) ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    bucket.inputTokens += row.inputTokens ?? 0;
    bucket.outputTokens += row.outputTokens ?? 0;
    bucket.totalTokens += row.totalTokens ?? 0;
    totals.set(day, bucket);
  });

  return Array.from(totals.entries()).map(([day, values]) => ({
    day,
    ...values,
  }));
}

export async function getProviderModelBreakdown(options?: {
  startedAt?: Date;
  finishedAt?: Date;
}) {
  const conditions = [];
  if (options?.startedAt) {
    conditions.push(gte(usageLedger.finishedAt, options.startedAt));
  }
  if (options?.finishedAt) {
    conditions.push(lte(usageLedger.finishedAt, options.finishedAt));
  }

  const rows = await db
    .select()
    .from(usageLedger)
    .where(conditions.length ? and(...conditions) : undefined);

  const totals = new Map<
    string,
    {
      providerId: string;
      modelId: string | null;
      runtimeId: string;
      costMicros: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      runs: number;
    }
  >();

  rows.forEach((row) => {
    const key = `${row.providerId}::${row.modelId ?? "unknown"}::${row.runtimeId}`;
    const bucket = totals.get(key) ?? {
      providerId: row.providerId,
      modelId: row.modelId ?? null,
      runtimeId: row.runtimeId,
      costMicros: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      runs: 0,
    };

    bucket.costMicros += row.costMicros ?? 0;
    bucket.inputTokens += row.inputTokens ?? 0;
    bucket.outputTokens += row.outputTokens ?? 0;
    bucket.totalTokens += row.totalTokens ?? 0;
    bucket.runs += 1;
    totals.set(key, bucket);
  });

  return Array.from(totals.values()).sort(
    (left, right) => right.costMicros - left.costMicros
  );
}

export async function listUsageAuditEntries(options?: {
  limit?: number;
  offset?: number;
  statuses?: UsageLedgerStatus[];
  activityTypes?: UsageActivityType[];
}) {
  const conditions = [];
  if (options?.statuses?.length) {
    conditions.push(inArray(usageLedger.status, options.statuses));
  }
  if (options?.activityTypes?.length) {
    conditions.push(inArray(usageLedger.activityType, options.activityTypes));
  }

  const rows = await db
    .select()
    .from(usageLedger)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(usageLedger.finishedAt));

  const pagedRows = rows.slice(
    options?.offset ?? 0,
    (options?.offset ?? 0) + (options?.limit ?? 50)
  );

  const taskIds = Array.from(
    new Set(pagedRows.map((row) => row.taskId).filter(Boolean))
  ) as string[];
  const workflowIds = Array.from(
    new Set(pagedRows.map((row) => row.workflowId).filter(Boolean))
  ) as string[];
  const scheduleIds = Array.from(
    new Set(pagedRows.map((row) => row.scheduleId).filter(Boolean))
  ) as string[];
  const projectIds = Array.from(
    new Set(pagedRows.map((row) => row.projectId).filter(Boolean))
  ) as string[];

  const [taskRows, workflowRows, scheduleRows, projectRows] = await Promise.all([
    taskIds.length
      ? db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(inArray(tasks.id, taskIds))
      : Promise.resolve([]),
    workflowIds.length
      ? db
          .select({ id: workflows.id, name: workflows.name })
          .from(workflows)
          .where(inArray(workflows.id, workflowIds))
      : Promise.resolve([]),
    scheduleIds.length
      ? db
          .select({ id: schedules.id, name: schedules.name })
          .from(schedules)
          .where(inArray(schedules.id, scheduleIds))
      : Promise.resolve([]),
    projectIds.length
      ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : Promise.resolve([]),
  ]);

  const taskMap = new Map(taskRows.map((row) => [row.id, row.title]));
  const workflowMap = new Map(workflowRows.map((row) => [row.id, row.name]));
  const scheduleMap = new Map(scheduleRows.map((row) => [row.id, row.name]));
  const projectMap = new Map(projectRows.map((row) => [row.id, row.name]));

  return pagedRows.map(
    (row): UsageAuditEntry => ({
      id: row.id,
      activityType: row.activityType,
      runtimeId: row.runtimeId,
      providerId: row.providerId,
      modelId: row.modelId ?? null,
      status: row.status,
      inputTokens: row.inputTokens ?? null,
      outputTokens: row.outputTokens ?? null,
      totalTokens: row.totalTokens ?? null,
      costMicros: row.costMicros ?? null,
      pricingVersion: row.pricingVersion ?? null,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      taskId: row.taskId ?? null,
      taskTitle: row.taskId ? taskMap.get(row.taskId) ?? null : null,
      workflowId: row.workflowId ?? null,
      workflowName: row.workflowId
        ? workflowMap.get(row.workflowId) ?? null
        : null,
      scheduleId: row.scheduleId ?? null,
      scheduleName: row.scheduleId
        ? scheduleMap.get(row.scheduleId) ?? null
        : null,
      projectId: row.projectId ?? null,
      projectName: row.projectId ? projectMap.get(row.projectId) ?? null : null,
    })
  );
}
