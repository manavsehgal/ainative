import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, tasks, usageLedger } from "@/lib/db/schema";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCatalogEntry,
  resolveAgentRuntime,
  SUPPORTED_AGENT_RUNTIMES,
  type AgentRuntimeId,
} from "@/lib/agents/runtime/catalog";
import { getSetting, setSetting } from "./helpers";
import {
  budgetPolicySchema,
  type BudgetPolicy,
  type RuntimeBudgetPolicy,
  type UpdateBudgetPolicyInput,
} from "@/lib/validators/settings";
import {
  recordUsageLedgerEntry,
  resolveUsageActivityType,
  type UsageActivityType,
} from "@/lib/usage/ledger";

const WARNING_THRESHOLD = 0.8;

type BudgetWindow = "daily" | "monthly";
type BudgetMetric = "spend" | "tokens";
type BudgetHealth = "unlimited" | "ok" | "warning" | "blocked";
type BudgetScopeId = "overall" | AgentRuntimeId;

interface UsageAggregate {
  costMicros: number;
  totalTokens: number;
}

interface BudgetWindowStatus {
  id: string;
  scopeId: BudgetScopeId;
  scopeLabel: string;
  runtimeId: AgentRuntimeId | null;
  metric: BudgetMetric;
  window: BudgetWindow;
  currentValue: number;
  limitValue: number | null;
  ratio: number | null;
  health: BudgetHealth;
  resetAt: Date;
}

interface BudgetWarningState {
  [statusId: string]: string;
}

interface BudgetSnapshot {
  policy: BudgetPolicy;
  statuses: Array<BudgetWindowStatus & { resetAtIso: string }>;
  dailyResetAtIso: string;
  monthlyResetAtIso: string;
}

interface BudgetGuardInput {
  runtimeId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  workflowId?: string | null;
  scheduleId?: string | null;
  activityType: UsageActivityType;
  failTaskOnBlock?: boolean;
}

function createEmptyRuntimeBudgetPolicy(): RuntimeBudgetPolicy {
  return {
    dailySpendCapUsd: null,
    monthlySpendCapUsd: null,
    dailyTokenCap: null,
    monthlyTokenCap: null,
  };
}

export function createEmptyBudgetPolicy(): BudgetPolicy {
  return {
    overall: {
      dailySpendCapUsd: null,
      monthlySpendCapUsd: null,
    },
    runtimes: Object.fromEntries(
      SUPPORTED_AGENT_RUNTIMES.map((runtimeId) => [
        runtimeId,
        createEmptyRuntimeBudgetPolicy(),
      ])
    ) as BudgetPolicy["runtimes"],
  };
}

function formatWindowKey(window: BudgetWindow, date: Date) {
  if (window === "daily") {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function formatMicrosAsUsd(micros: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(micros / 1_000_000);
}

function formatTokenCount(tokens: number) {
  return new Intl.NumberFormat("en-US").format(tokens);
}

function formatResetAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function usdToMicros(value: number | null) {
  return value == null ? null : Math.round(value * 1_000_000);
}

function getBudgetWindowBounds(now = new Date()) {
  const dailyStart = new Date(now);
  dailyStart.setHours(0, 0, 0, 0);

  const dailyEnd = new Date(dailyStart);
  dailyEnd.setDate(dailyEnd.getDate() + 1);

  const monthlyStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthlyStart.setHours(0, 0, 0, 0);

  const monthlyEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  monthlyEnd.setHours(0, 0, 0, 0);

  return { dailyStart, dailyEnd, monthlyStart, monthlyEnd };
}

async function getWarningState(): Promise<BudgetWarningState> {
  const raw = await getSetting(SETTINGS_KEYS.BUDGET_WARNING_STATE);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as BudgetWarningState)
      : {};
  } catch {
    return {};
  }
}

async function setWarningState(state: BudgetWarningState) {
  await setSetting(SETTINGS_KEYS.BUDGET_WARNING_STATE, JSON.stringify(state));
}

export async function getBudgetPolicy(): Promise<BudgetPolicy> {
  const raw = await getSetting(SETTINGS_KEYS.BUDGET_POLICY);
  if (!raw) {
    return createEmptyBudgetPolicy();
  }

  try {
    const parsed = budgetPolicySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : createEmptyBudgetPolicy();
  } catch {
    return createEmptyBudgetPolicy();
  }
}

export async function setBudgetPolicy(
  input: UpdateBudgetPolicyInput
): Promise<BudgetPolicy> {
  const parsed = budgetPolicySchema.parse(input);
  await setSetting(SETTINGS_KEYS.BUDGET_POLICY, JSON.stringify(parsed));
  await setWarningState({});
  return parsed;
}

async function getUsageAggregates(now = new Date()) {
  const { dailyStart, dailyEnd, monthlyStart, monthlyEnd } =
    getBudgetWindowBounds(now);

  const rows = await db
    .select({
      runtimeId: usageLedger.runtimeId,
      costMicros: usageLedger.costMicros,
      totalTokens: usageLedger.totalTokens,
      finishedAt: usageLedger.finishedAt,
    })
    .from(usageLedger)
    .where(
      and(
        gte(usageLedger.finishedAt, monthlyStart),
        lt(usageLedger.finishedAt, monthlyEnd)
      )
    );

  const overall = {
    daily: { costMicros: 0, totalTokens: 0 },
    monthly: { costMicros: 0, totalTokens: 0 },
  };
  const runtimes = Object.fromEntries(
    SUPPORTED_AGENT_RUNTIMES.map((runtimeId) => [
      runtimeId,
      {
        daily: { costMicros: 0, totalTokens: 0 },
        monthly: { costMicros: 0, totalTokens: 0 },
      },
    ])
  ) as Record<AgentRuntimeId, { daily: UsageAggregate; monthly: UsageAggregate }>;

  rows.forEach((row) => {
    const runtimeId = SUPPORTED_AGENT_RUNTIMES.find(
      (candidate) => candidate === row.runtimeId
    );
    if (!runtimeId) {
      return;
    }

    const costMicros = row.costMicros ?? 0;
    const totalTokens = row.totalTokens ?? 0;

    overall.monthly.costMicros += costMicros;
    overall.monthly.totalTokens += totalTokens;
    runtimes[runtimeId].monthly.costMicros += costMicros;
    runtimes[runtimeId].monthly.totalTokens += totalTokens;

    if (row.finishedAt >= dailyStart && row.finishedAt < dailyEnd) {
      overall.daily.costMicros += costMicros;
      overall.daily.totalTokens += totalTokens;
      runtimes[runtimeId].daily.costMicros += costMicros;
      runtimes[runtimeId].daily.totalTokens += totalTokens;
    }
  });

  return {
    overall,
    runtimes,
    ...getBudgetWindowBounds(now),
  };
}

function buildStatus(input: {
  scopeId: BudgetScopeId;
  scopeLabel: string;
  runtimeId: AgentRuntimeId | null;
  metric: BudgetMetric;
  window: BudgetWindow;
  currentValue: number;
  limitValue: number | null;
  resetAt: Date;
}): BudgetWindowStatus {
  const ratio =
    input.limitValue && input.limitValue > 0
      ? input.currentValue / input.limitValue
      : null;

  let health: BudgetHealth = "unlimited";
  if (input.limitValue != null) {
    if (ratio != null && ratio >= 1) {
      health = "blocked";
    } else if (ratio != null && ratio >= WARNING_THRESHOLD) {
      health = "warning";
    } else {
      health = "ok";
    }
  }

  return {
    id: `${input.scopeId}:${input.window}:${input.metric}`,
    scopeId: input.scopeId,
    scopeLabel: input.scopeLabel,
    runtimeId: input.runtimeId,
    metric: input.metric,
    window: input.window,
    currentValue: input.currentValue,
    limitValue: input.limitValue,
    ratio,
    health,
    resetAt: input.resetAt,
  };
}

function buildBudgetStatuses(
  policy: BudgetPolicy,
  aggregates: Awaited<ReturnType<typeof getUsageAggregates>>
) {
  const statuses: BudgetWindowStatus[] = [];

  statuses.push(
    buildStatus({
      scopeId: "overall",
      scopeLabel: "Overall",
      runtimeId: null,
      metric: "spend",
      window: "daily",
      currentValue: aggregates.overall.daily.costMicros,
      limitValue: usdToMicros(policy.overall.dailySpendCapUsd),
      resetAt: aggregates.dailyEnd,
    }),
    buildStatus({
      scopeId: "overall",
      scopeLabel: "Overall",
      runtimeId: null,
      metric: "spend",
      window: "monthly",
      currentValue: aggregates.overall.monthly.costMicros,
      limitValue: usdToMicros(policy.overall.monthlySpendCapUsd),
      resetAt: aggregates.monthlyEnd,
    })
  );

  SUPPORTED_AGENT_RUNTIMES.forEach((runtimeId) => {
    const runtime = getRuntimeCatalogEntry(runtimeId);
    const runtimePolicy = policy.runtimes[runtimeId];
    const usage = aggregates.runtimes[runtimeId];

    statuses.push(
      buildStatus({
        scopeId: runtimeId,
        scopeLabel: runtime.label,
        runtimeId,
        metric: "spend",
        window: "daily",
        currentValue: usage.daily.costMicros,
        limitValue: usdToMicros(runtimePolicy.dailySpendCapUsd),
        resetAt: aggregates.dailyEnd,
      }),
      buildStatus({
        scopeId: runtimeId,
        scopeLabel: runtime.label,
        runtimeId,
        metric: "spend",
        window: "monthly",
        currentValue: usage.monthly.costMicros,
        limitValue: usdToMicros(runtimePolicy.monthlySpendCapUsd),
        resetAt: aggregates.monthlyEnd,
      }),
      buildStatus({
        scopeId: runtimeId,
        scopeLabel: runtime.label,
        runtimeId,
        metric: "tokens",
        window: "daily",
        currentValue: usage.daily.totalTokens,
        limitValue: runtimePolicy.dailyTokenCap,
        resetAt: aggregates.dailyEnd,
      }),
      buildStatus({
        scopeId: runtimeId,
        scopeLabel: runtime.label,
        runtimeId,
        metric: "tokens",
        window: "monthly",
        currentValue: usage.monthly.totalTokens,
        limitValue: runtimePolicy.monthlyTokenCap,
        resetAt: aggregates.monthlyEnd,
      })
    );
  });

  return statuses;
}

function describeBudgetStatus(status: BudgetWindowStatus) {
  const metricLabel = status.metric === "spend" ? "spend" : "token usage";
  const currentLabel =
    status.metric === "spend"
      ? formatMicrosAsUsd(status.currentValue)
      : formatTokenCount(status.currentValue);
  const limitLabel =
    status.limitValue == null
      ? "Unlimited"
      : status.metric === "spend"
        ? formatMicrosAsUsd(status.limitValue)
        : formatTokenCount(status.limitValue);

  return `${status.scopeLabel} ${status.window} ${metricLabel} is ${currentLabel} of ${limitLabel}. Resets ${formatResetAt(status.resetAt)}.`;
}

async function createBudgetNotification(input: {
  title: string;
  body: string;
  taskId?: string | null;
}) {
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    taskId: input.taskId ?? null,
    type: "budget_alert",
    title: input.title,
    body: input.body,
    read: false,
    toolName: null,
    toolInput: null,
    response: null,
    respondedAt: null,
    createdAt: new Date(),
  });
}

async function emitWarningNotifications(
  statuses: BudgetWindowStatus[],
  warningState: BudgetWarningState,
  taskId?: string | null
) {
  let changed = false;

  for (const status of statuses) {
    const windowKey = formatWindowKey(status.window, status.resetAt);
    if (warningState[status.id] === windowKey) {
      continue;
    }

    const percent = status.ratio == null ? 0 : Math.round(status.ratio * 100);
    await createBudgetNotification({
      taskId,
      title: `${status.scopeLabel} ${status.window} ${status.metric} at ${percent}%`,
      body: describeBudgetStatus(status),
    });
    warningState[status.id] = windowKey;
    changed = true;
  }

  if (changed) {
    await setWarningState(warningState);
  }
}

async function recordBlockedAttempt(input: {
  runtimeId: AgentRuntimeId;
  activityType: UsageActivityType;
  taskId?: string | null;
  projectId?: string | null;
  workflowId?: string | null;
  scheduleId?: string | null;
}) {
  const runtime = getRuntimeCatalogEntry(input.runtimeId);
  await recordUsageLedgerEntry({
    taskId: input.taskId ?? null,
    projectId: input.projectId ?? null,
    workflowId: input.workflowId ?? null,
    scheduleId: input.scheduleId ?? null,
    activityType: input.activityType,
    runtimeId: input.runtimeId,
    providerId: runtime.providerId,
    status: "blocked",
    startedAt: new Date(),
    finishedAt: new Date(),
  });
}

async function markTaskBlocked(taskId: string, message: string) {
  await db
    .update(tasks)
    .set({
      status: "failed",
      result: message,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

async function getTaskBudgetContext(taskId: string, isResume = false) {
  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      workflowId: tasks.workflowId,
      scheduleId: tasks.scheduleId,
      assignedAgent: tasks.assignedAgent,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  return {
    runtimeId: resolveAgentRuntime(task.assignedAgent ?? DEFAULT_AGENT_RUNTIME),
    taskId: task.id,
    projectId: task.projectId ?? null,
    workflowId: task.workflowId ?? null,
    scheduleId: task.scheduleId ?? null,
    activityType: resolveUsageActivityType({
      workflowId: task.workflowId,
      scheduleId: task.scheduleId,
      isResume,
    }),
  };
}

export class BudgetLimitExceededError extends Error {
  readonly status: BudgetWindowStatus;

  constructor(status: BudgetWindowStatus) {
    super(describeBudgetStatus(status));
    this.name = "BudgetLimitExceededError";
    this.status = status;
  }
}

export async function enforceBudgetGuardrails(input: BudgetGuardInput) {
  const runtimeId = resolveAgentRuntime(input.runtimeId ?? DEFAULT_AGENT_RUNTIME);
  const policy = await getBudgetPolicy();
  const warningState = await getWarningState();
  const aggregates = await getUsageAggregates();
  const statuses = buildBudgetStatuses(policy, aggregates).filter(
    (status) => status.scopeId === "overall" || status.runtimeId === runtimeId
  );

  const blocked = statuses.find((status) => status.health === "blocked");
  const warnings = statuses.filter((status) => status.health === "warning");

  if (!blocked && warnings.length > 0) {
    await emitWarningNotifications(warnings, warningState, input.taskId ?? null);
  }

  if (!blocked) {
    return;
  }

  const runtime = getRuntimeCatalogEntry(runtimeId);
  const title = `${runtime.label} blocked by ${blocked.window} ${blocked.metric} cap`;
  const body = describeBudgetStatus(blocked);

  await createBudgetNotification({
    taskId: input.taskId ?? null,
    title,
    body,
  });
  await recordBlockedAttempt({
    runtimeId,
    activityType: input.activityType,
    taskId: input.taskId ?? null,
    projectId: input.projectId ?? null,
    workflowId: input.workflowId ?? null,
    scheduleId: input.scheduleId ?? null,
  });

  if (input.failTaskOnBlock && input.taskId) {
    await markTaskBlocked(input.taskId, body);
  }

  throw new BudgetLimitExceededError(blocked);
}

export async function enforceTaskBudgetGuardrails(
  taskId: string,
  options?: {
    isResume?: boolean;
    failTaskOnBlock?: boolean;
  }
) {
  const context = await getTaskBudgetContext(taskId, options?.isResume);
  return enforceBudgetGuardrails({
    ...context,
    failTaskOnBlock: options?.failTaskOnBlock,
  });
}

export async function getBudgetGuardrailSnapshot(): Promise<BudgetSnapshot> {
  const policy = await getBudgetPolicy();
  const aggregates = await getUsageAggregates();
  const statuses = buildBudgetStatuses(policy, aggregates).map((status) => ({
    ...status,
    resetAtIso: status.resetAt.toISOString(),
  }));

  return {
    policy,
    statuses,
    dailyResetAtIso: aggregates.dailyEnd.toISOString(),
    monthlyResetAtIso: aggregates.monthlyEnd.toISOString(),
  };
}
