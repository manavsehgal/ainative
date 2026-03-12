import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Coins,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { listRuntimeCatalog } from "@/lib/agents/runtime/catalog";
import type {
  ProviderModelBreakdownEntry,
  UsageAuditEntry,
} from "@/lib/usage/ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutRing } from "@/components/charts/donut-ring";
import { MiniBar } from "@/components/charts/mini-bar";
import { Sparkline } from "@/components/charts/sparkline";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { CostFilters } from "@/components/costs/cost-filters";

type BudgetHealth = "unlimited" | "ok" | "warning" | "blocked";
type BudgetMetric = "spend" | "tokens";
type BudgetWindow = "daily" | "monthly";

interface BudgetStatus {
  id: string;
  scopeId: string;
  scopeLabel: string;
  runtimeId: string | null;
  metric: BudgetMetric;
  window: BudgetWindow;
  currentValue: number;
  limitValue: number | null;
  ratio: number | null;
  health: BudgetHealth;
  resetAtIso: string;
}

interface CostSummary {
  todaySpendMicros: number;
  monthSpendMicros: number;
  todayTokens: number;
  monthTokens: number;
}

interface RuntimeBreakdownRow {
  runtimeId: string;
  label: string;
  providerId: string;
  costMicros: number;
  totalTokens: number;
  runs: number;
  share: number;
  unknownPricingRuns: number;
}

interface ModelVisualMeta {
  share: number;
  valueLabel: string;
  basisLabel: string;
}

interface TrendSeries {
  spend7: number[];
  spend30: number[];
  tokens7: number[];
  tokens30: number[];
}

interface FilterState {
  dateRange: string;
  runtimeId: string;
  status: string;
  activityType: string;
}

interface CostDashboardProps {
  filters: FilterState;
  summary: CostSummary;
  trendSeries: TrendSeries;
  budgetStatuses: BudgetStatus[];
  runtimeBreakdown: RuntimeBreakdownRow[];
  modelBreakdown: ProviderModelBreakdownEntry[];
  auditEntries: UsageAuditEntry[];
}

const runtimeCatalog = listRuntimeCatalog();
const runtimeLabelMap = new Map<string, string>(
  runtimeCatalog.map((runtime) => [runtime.id, runtime.label])
);

function formatCurrencyMicros(value: number | null | undefined) {
  const amount = value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: amount >= 1_000_000 ? 2 : 4,
  }).format(amount / 1_000_000);
}

function formatTokenCount(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatCompactCount(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateRangeLabel(range: string) {
  switch (range) {
    case "7d":
      return "Last 7 days";
    case "90d":
      return "Last 90 days";
    case "all":
      return "All time";
    default:
      return "Last 30 days";
  }
}

function formatActivityLabel(value: UsageAuditEntry["activityType"]) {
  switch (value) {
    case "task_run":
      return "Task run";
    case "task_resume":
      return "Task resume";
    case "workflow_step":
      return "Workflow step";
    case "scheduled_firing":
      return "Scheduled firing";
    case "task_assist":
      return "Task assist";
    case "profile_test":
      return "Profile test";
    default:
      return value;
  }
}

function formatLedgerStatusLabel(value: UsageAuditEntry["status"]) {
  switch (value) {
    case "unknown_pricing":
      return "Unknown pricing";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

function statusBadge(status: UsageAuditEntry["status"]) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Completed</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "blocked":
      return (
        <Badge
          variant="outline"
          className="border-status-warning/30 bg-status-warning/10 text-status-warning"
        >
          Blocked
        </Badge>
      );
    case "unknown_pricing":
      return (
        <Badge variant="outline" className="border-border/70 text-muted-foreground">
          Unknown pricing
        </Badge>
      );
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{formatLedgerStatusLabel(status)}</Badge>;
  }
}

function budgetBadge(status: BudgetStatus) {
  if (status.health === "blocked") {
    return <Badge variant="destructive">Blocked</Badge>;
  }
  if (status.health === "warning") {
    return (
      <Badge
        variant="outline"
        className="border-status-warning/30 bg-status-warning/10 text-status-warning"
      >
        Warning
      </Badge>
    );
  }
  if (status.health === "ok") {
    return <Badge variant="success">Tracked</Badge>;
  }
  return <Badge variant="secondary">Unlimited</Badge>;
}

function formatBudgetValue(status: BudgetStatus, value: number) {
  return status.metric === "spend"
    ? formatCurrencyMicros(value)
    : formatTokenCount(value);
}

function renderEntityLink(entry: UsageAuditEntry) {
  if (entry.taskId && entry.taskTitle) {
    return (
      <Link href={`/tasks/${entry.taskId}`} className="font-medium hover:underline">
        {entry.taskTitle}
      </Link>
    );
  }
  if (entry.workflowId && entry.workflowName) {
    return (
      <Link
        href={`/workflows/${entry.workflowId}`}
        className="font-medium hover:underline"
      >
        {entry.workflowName}
      </Link>
    );
  }
  if (entry.scheduleId && entry.scheduleName) {
    return (
      <Link
        href={`/schedules/${entry.scheduleId}`}
        className="font-medium hover:underline"
      >
        {entry.scheduleName}
      </Link>
    );
  }

  return <span className="font-medium">{formatActivityLabel(entry.activityType)}</span>;
}

function resolveModelVisualMeta(
  row: ProviderModelBreakdownEntry,
  totals: { costMicros: number; totalTokens: number }
): ModelVisualMeta {
  if (totals.costMicros > 0 && row.costMicros > 0) {
    const share = clampPercent((row.costMicros / totals.costMicros) * 100);
    return {
      share,
      valueLabel: formatCurrencyMicros(row.costMicros),
      basisLabel: `${formatPercent(share)} of filtered spend`,
    };
  }

  if (totals.totalTokens > 0 && row.totalTokens > 0) {
    const share = clampPercent((row.totalTokens / totals.totalTokens) * 100);
    return {
      share,
      valueLabel: `${formatCompactCount(row.totalTokens)} tokens`,
      basisLabel: `${formatPercent(share)} of filtered tokens`,
    };
  }

  return {
    share: 0,
    valueLabel:
      row.unknownPricingRuns === row.runs ? "Pricing unavailable" : formatCurrencyMicros(0),
    basisLabel: "No measurable cost or token usage",
  };
}

function SummaryCard({
  eyebrow,
  title,
  value,
  detail,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="surface-card rounded-3xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
        <div className="surface-card-muted rounded-2xl p-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function CostDashboard({
  filters,
  summary,
  trendSeries,
  budgetStatuses,
  runtimeBreakdown,
  modelBreakdown,
  auditEntries,
}: CostDashboardProps) {
  const warnings = budgetStatuses.filter((status) => status.health === "warning");
  const blocked = budgetStatuses.filter((status) => status.health === "blocked");
  const configuredBudgets = budgetStatuses.filter((status) => status.limitValue != null);
  const nearestBudget = configuredBudgets
    .slice()
    .sort((left, right) => (right.ratio ?? 0) - (left.ratio ?? 0))[0];
  const hasUsage =
    summary.monthSpendMicros > 0 ||
    summary.monthTokens > 0 ||
    modelBreakdown.length > 0 ||
    auditEntries.length > 0;
  const filteredUnknownPricingRuns = modelBreakdown.reduce(
    (total, row) => total + row.unknownPricingRuns,
    0
  );
  const modelTotals = modelBreakdown.reduce(
    (totals, row) => ({
      costMicros: totals.costMicros + row.costMicros,
      totalTokens: totals.totalTokens + row.totalTokens,
    }),
    { costMicros: 0, totalTokens: 0 }
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="max-w-3xl space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          Governance &amp; Analytics
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Cost &amp; Usage</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review spend, token usage, and the execution history behind each paid
            runtime action without leaving the operational shell.
          </p>
        </div>
      </div>

      <CostFilters
        dateRange={filters.dateRange}
        runtimeId={filters.runtimeId}
        status={filters.status}
        activityType={filters.activityType}
        runtimeOptions={runtimeCatalog.map((runtime) => ({
          id: runtime.id,
          label: runtime.label,
        }))}
      />

      {blocked.length > 0 ? (
        <div className="surface-card rounded-3xl border border-status-failed/25 bg-status-failed/8 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-status-failed">
                <ShieldAlert className="h-4 w-4" />
                <p className="text-sm font-semibold">Provider activity is currently blocked</p>
              </div>
              <p className="text-sm text-muted-foreground">
                One or more active budget windows have been exceeded. New paid work
                will remain blocked until the affected window resets.
              </p>
            </div>
            <div className="grid gap-2 lg:min-w-[320px]">
              {blocked.slice(0, 2).map((status) => (
                <div
                  key={status.id}
                  className="surface-card-muted flex items-start justify-between gap-3 rounded-2xl p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {status.scopeLabel} {status.window} {status.metric}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBudgetValue(status, status.currentValue)} of{" "}
                      {formatBudgetValue(status, status.limitValue ?? 0)} used
                    </p>
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    Resets {formatDateTime(status.resetAtIso)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {blocked.length === 0 && warnings.length > 0 ? (
        <div className="surface-card rounded-3xl border border-status-warning/25 bg-status-warning/8 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-status-warning" />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Budget usage is approaching a cap</p>
              <p className="text-sm text-muted-foreground">
                {warnings[0].scopeLabel} {warnings[0].window} {warnings[0].metric} is at{" "}
                {formatPercent((warnings[0].ratio ?? 0) * 100)} of its configured
                limit and resets {formatDateTime(warnings[0].resetAtIso)}.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          eyebrow="Today"
          title="Spend"
          value={formatCurrencyMicros(summary.todaySpendMicros)}
          detail="Current-day spend across governed runtimes"
          icon={Wallet}
        />
        <SummaryCard
          eyebrow="Month"
          title="Spend"
          value={formatCurrencyMicros(summary.monthSpendMicros)}
          detail="Current-month spend used so far"
          icon={CalendarRange}
        />
        <SummaryCard
          eyebrow="Today"
          title="Tokens"
          value={formatCompactCount(summary.todayTokens)}
          detail={`${formatTokenCount(summary.todayTokens)} total tokens today`}
          icon={Coins}
        />
        <SummaryCard
          eyebrow="Month"
          title="Tokens"
          value={formatCompactCount(summary.monthTokens)}
          detail={`${formatTokenCount(summary.monthTokens)} total tokens this month`}
          icon={Coins}
        />

        <div className="surface-card rounded-3xl p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Budgets
              </p>
              <h2 className="text-sm font-medium text-foreground">Guardrail state</h2>
            </div>
            <div className="surface-card-muted rounded-2xl p-2.5">
              {blocked.length > 0 ? (
                <ShieldAlert className="h-4 w-4 text-status-failed" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-status-completed" />
              )}
            </div>
          </div>

          {nearestBudget ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {budgetBadge(nearestBudget)}
                <span className="text-xs text-muted-foreground">
                  {nearestBudget.scopeLabel} {nearestBudget.window} {nearestBudget.metric}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold tracking-tight">
                  {formatBudgetValue(
                    nearestBudget,
                    Math.max((nearestBudget.limitValue ?? 0) - nearestBudget.currentValue, 0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Remaining before the nearest configured cap. Resets{" "}
                  {formatDateTime(nearestBudget.resetAtIso)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Badge variant="secondary">Unconfigured</Badge>
              <p className="text-sm text-muted-foreground">
                No spend or token caps are configured yet. Usage is being metered,
                but there is no automatic stop condition.
              </p>
            </div>
          )}
        </div>
      </div>

      {hasUsage ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="surface-card rounded-3xl p-5">
              <SectionHeading>Trend View</SectionHeading>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="surface-card-muted rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Spend velocity</p>
                      <p className="text-xs text-muted-foreground">
                        7-day and 30-day spend series
                      </p>
                    </div>
                    <Badge variant="outline">{formatCurrencyMicros(summary.monthSpendMicros)}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        7-day
                      </p>
                      <Sparkline
                        data={trendSeries.spend7}
                        width={160}
                        height={48}
                        color="var(--chart-1)"
                        label="7 day spend trend"
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        30-day
                      </p>
                      <MiniBar
                        data={trendSeries.spend30.map((value) => ({
                          value,
                          color: "var(--chart-1)",
                        }))}
                        width={220}
                        height={48}
                        label="30 day spend trend"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="surface-card-muted rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Token velocity</p>
                      <p className="text-xs text-muted-foreground">
                        7-day and 30-day token series
                      </p>
                    </div>
                    <Badge variant="outline">{formatCompactCount(summary.monthTokens)} tokens</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        7-day
                      </p>
                      <Sparkline
                        data={trendSeries.tokens7}
                        width={160}
                        height={48}
                        color="var(--chart-2)"
                        label="7 day token trend"
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        30-day
                      </p>
                      <MiniBar
                        data={trendSeries.tokens30.map((value) => ({
                          value,
                          color: "var(--chart-2)",
                        }))}
                        width={220}
                        height={48}
                        label="30 day token trend"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="surface-card rounded-3xl p-5">
              <SectionHeading>Runtime Breakdown</SectionHeading>
              <div className="space-y-3">
                {runtimeBreakdown.length > 0 ? (
                  runtimeBreakdown.map((runtime) => (
                    <div
                      key={runtime.runtimeId}
                      className="surface-card-muted flex items-center justify-between gap-4 rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-4">
                        <DonutRing
                          value={runtime.share}
                          size={44}
                          strokeWidth={4}
                          color="var(--chart-1)"
                          trackColor="var(--muted)"
                          label={`${runtime.label} share of spend`}
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{runtime.label}</p>
                            <Badge variant="outline">{runtime.providerId}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent(runtime.share)} of filtered spend across{" "}
                            {runtime.runs} runs
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-right text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Spend
                          </p>
                          <p className="font-medium">
                            {formatCurrencyMicros(runtime.costMicros)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Tokens
                          </p>
                          <p className="font-medium">
                            {formatCompactCount(runtime.totalTokens)}
                          </p>
                        </div>
                        {runtime.unknownPricingRuns > 0 ? (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">
                              {runtime.unknownPricingRuns} run
                              {runtime.unknownPricingRuns === 1 ? "" : "s"} missing
                              pricing data
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="surface-card-muted rounded-2xl p-4 text-sm text-muted-foreground">
                    No metered runtime activity exists for {formatDateRangeLabel(filters.dateRange).toLowerCase()}.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="surface-card rounded-3xl p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <SectionHeading className="mb-2">Model Breakdown</SectionHeading>
                <p className="text-sm text-muted-foreground">
                  Concentration by model for {formatDateRangeLabel(filters.dateRange).toLowerCase()}.
                </p>
              </div>
              {filteredUnknownPricingRuns > 0 ? (
                <Badge variant="outline">
                  {filteredUnknownPricingRuns} unknown-pricing row
                  {filteredUnknownPricingRuns === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>

            {modelBreakdown.length > 0 ? (
              <div className="space-y-3">
                {modelBreakdown.map((row) => {
                  const visual = resolveModelVisualMeta(row, modelTotals);
                  return (
                    <div
                      key={`${row.runtimeId}-${row.modelId ?? "unknown"}`}
                      className="surface-card-muted rounded-2xl p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {row.modelId ?? "Unknown model"}
                                </p>
                                <Badge variant="outline">
                                  {runtimeLabelMap.get(row.runtimeId) ?? row.runtimeId}
                                </Badge>
                                {row.unknownPricingRuns > 0 ? (
                                  <Badge variant="outline">Pricing unavailable</Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {row.providerId} • {row.runs} run
                                {row.runs === 1 ? "" : "s"} •{" "}
                                {formatCompactCount(row.totalTokens)} tokens
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-sm font-medium">{visual.valueLabel}</p>
                              <p className="text-xs text-muted-foreground">
                                {visual.basisLabel}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="h-2.5 overflow-hidden rounded-full bg-background/70">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,var(--chart-1),var(--chart-2))]"
                                style={{ width: `${Math.max(visual.share, visual.share > 0 ? 6 : 0)}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>{formatPercent(visual.share)} of current filtered volume</span>
                              {row.unknownPricingRuns > 0 ? (
                                <span>
                                  {row.unknownPricingRuns} run
                                  {row.unknownPricingRuns === 1 ? "" : "s"} without price data
                                </span>
                              ) : (
                                <span>Cost and token totals are both shown above</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="surface-card-muted rounded-2xl p-4 text-sm text-muted-foreground">
                No model breakdown is available for the selected window yet.
              </div>
            )}
          </div>

          <div className="surface-card rounded-3xl p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <SectionHeading className="mb-2">Audit Log</SectionHeading>
                <p className="text-sm text-muted-foreground">
                  Filtered execution history for {formatDateRangeLabel(filters.dateRange).toLowerCase()}.
                </p>
              </div>
              <Badge variant="outline">{auditEntries.length} rows</Badge>
            </div>

            {auditEntries.length > 0 ? (
              <div className="surface-scroll rounded-2xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Linked entity</TableHead>
                      <TableHead>Runtime</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="align-top text-xs text-muted-foreground">
                          {formatDateTime(entry.finishedAt.toISOString())}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p className="font-medium">
                              {formatActivityLabel(entry.activityType)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.modelId ?? "Unknown model"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            {renderEntityLink(entry)}
                            {entry.projectId && entry.projectName ? (
                              <p className="text-xs text-muted-foreground">
                                <Link
                                  href={`/projects/${entry.projectId}`}
                                  className="hover:underline"
                                >
                                  {entry.projectName}
                                </Link>
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p className="font-medium">
                              {runtimeLabelMap.get(entry.runtimeId) ?? entry.runtimeId}
                            </p>
                            <p className="text-xs text-muted-foreground">{entry.providerId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right">
                          {formatCompactCount(entry.totalTokens ?? 0)}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          {entry.status === "unknown_pricing"
                            ? "Unavailable"
                            : formatCurrencyMicros(entry.costMicros)}
                        </TableCell>
                        <TableCell className="align-top">{statusBadge(entry.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="surface-card-muted rounded-2xl p-4 text-sm text-muted-foreground">
                No audit rows match the current filters. Adjust the runtime, status,
                activity, or date range to widen the view.
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Wallet}
          heading="No usage recorded yet"
          description="Metering is wired, but there are no paid runtime rows to visualize yet. Run a task, schedule, or workflow to populate the dashboard."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/dashboard?create=task">
                  Create Task
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Review Budgets</Link>
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}
