"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { listRuntimeCatalog } from "@/lib/agents/runtime/catalog";
import type { BudgetPolicy } from "@/lib/validators/settings";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Coins,
  Landmark,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

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

interface BudgetSnapshot {
  policy: BudgetPolicy;
  statuses: BudgetStatus[];
  dailyResetAtIso: string;
  monthlyResetAtIso: string;
}

interface BudgetFormState {
  overallDailySpendCapUsd: string;
  overallMonthlySpendCapUsd: string;
  runtimes: Record<
    string,
    {
      dailySpendCapUsd: string;
      monthlySpendCapUsd: string;
      dailyTokenCap: string;
      monthlyTokenCap: string;
    }
  >;
}

const runtimes = listRuntimeCatalog();

interface DerivedTokenEstimate {
  estimatedBudgetTokens: number | null;
  estimatedRemainingTokens: number | null;
  sourceLabel: string | null;
}

function toInputValue(value: number | null) {
  return value == null ? "" : String(value);
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function buildFormState(policy: BudgetPolicy): BudgetFormState {
  return {
    overallDailySpendCapUsd: toInputValue(policy.overall.dailySpendCapUsd),
    overallMonthlySpendCapUsd: toInputValue(policy.overall.monthlySpendCapUsd),
    runtimes: Object.fromEntries(
      runtimes.map((runtime) => [
        runtime.id,
        {
          dailySpendCapUsd: toInputValue(
            policy.runtimes[runtime.id].dailySpendCapUsd
          ),
          monthlySpendCapUsd: toInputValue(
            policy.runtimes[runtime.id].monthlySpendCapUsd
          ),
          dailyTokenCap: toInputValue(policy.runtimes[runtime.id].dailyTokenCap),
          monthlyTokenCap: toInputValue(
            policy.runtimes[runtime.id].monthlyTokenCap
          ),
        },
      ])
    ),
  };
}

function buildPayload(form: BudgetFormState): BudgetPolicy {
  return {
    overall: {
      dailySpendCapUsd: toNullableNumber(form.overallDailySpendCapUsd),
      monthlySpendCapUsd: toNullableNumber(form.overallMonthlySpendCapUsd),
    },
    runtimes: Object.fromEntries(
      runtimes.map((runtime) => [
        runtime.id,
        {
          dailySpendCapUsd: toNullableNumber(
            form.runtimes[runtime.id].dailySpendCapUsd
          ),
          monthlySpendCapUsd: toNullableNumber(
            form.runtimes[runtime.id].monthlySpendCapUsd
          ),
          dailyTokenCap: toNullableNumber(form.runtimes[runtime.id].dailyTokenCap),
          monthlyTokenCap: toNullableNumber(
            form.runtimes[runtime.id].monthlyTokenCap
          ),
        },
      ])
    ) as BudgetPolicy["runtimes"],
  };
}

function formatResetAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatStatusValue(status: BudgetStatus) {
  if (status.metric === "tokens") {
    return new Intl.NumberFormat("en-US").format(status.currentValue);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(status.currentValue / 1_000_000);
}

function formatStatusLimit(status: BudgetStatus) {
  if (status.limitValue == null) {
    return "Unlimited";
  }

  if (status.metric === "tokens") {
    return new Intl.NumberFormat("en-US").format(status.limitValue);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(status.limitValue / 1_000_000);
}

function formatEstimatedTokens(value: number | null) {
  if (value == null) {
    return "Unavailable";
  }

  const rounded = Math.max(0, Math.round(value));
  return new Intl.NumberFormat("en-US", {
    notation: rounded >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: rounded >= 100_000 ? 1 : 0,
  }).format(rounded);
}

function SectionEyebrow({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function healthBadge(status: BudgetStatus) {
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
    return <Badge variant="success">Healthy</Badge>;
  }
  return <Badge variant="secondary">Unlimited</Badge>;
}

function getStatus(
  statuses: BudgetStatus[],
  scopeId: string,
  window: BudgetWindow,
  metric: BudgetMetric
) {
  return statuses.find(
    (status) =>
      status.scopeId === scopeId &&
      status.window === window &&
      status.metric === metric
  );
}

function deriveTokenEstimate(input: {
  spendCapUsd: string;
  primarySpendStatus?: BudgetStatus;
  primaryTokenStatus?: BudgetStatus;
  fallbackSpendStatus?: BudgetStatus;
  fallbackTokenStatus?: BudgetStatus;
}): DerivedTokenEstimate {
  const spendCapUsd = toNullableNumber(input.spendCapUsd);
  if (spendCapUsd == null) {
    return {
      estimatedBudgetTokens: null,
      estimatedRemainingTokens: null,
      sourceLabel: null,
    };
  }

  const spendCapMicros = spendCapUsd * 1_000_000;
  const primaryHasRate =
    (input.primarySpendStatus?.currentValue ?? 0) > 0 &&
    (input.primaryTokenStatus?.currentValue ?? 0) > 0;
  const fallbackHasRate =
    (input.fallbackSpendStatus?.currentValue ?? 0) > 0 &&
    (input.fallbackTokenStatus?.currentValue ?? 0) > 0;

  const spendStatus = primaryHasRate
    ? input.primarySpendStatus
    : fallbackHasRate
      ? input.fallbackSpendStatus
      : undefined;
  const tokenStatus = primaryHasRate
    ? input.primaryTokenStatus
    : fallbackHasRate
      ? input.fallbackTokenStatus
      : undefined;

  if (!spendStatus || !tokenStatus) {
    return {
      estimatedBudgetTokens: null,
      estimatedRemainingTokens: null,
      sourceLabel: null,
    };
  }

  const tokensPerMicro = tokenStatus.currentValue / spendStatus.currentValue;
  const estimatedBudgetTokens = spendCapMicros * tokensPerMicro;
  const estimatedRemainingTokens = Math.max(
    0,
    (spendCapMicros - spendStatus.currentValue) * tokensPerMicro
  );

  return {
    estimatedBudgetTokens,
    estimatedRemainingTokens,
    sourceLabel:
      spendStatus.window === input.primarySpendStatus?.window
        ? `${spendStatus.window} blended pricing`
        : `${spendStatus.window} blended pricing fallback`,
  };
}

export function BudgetGuardrailsSection() {
  const [snapshot, setSnapshot] = useState<BudgetSnapshot | null>(null);
  const [form, setForm] = useState<BudgetFormState | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSnapshot() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/budgets");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.formErrors?.[0] ?? "Failed to load budget settings");
      }

      const parsed = data as BudgetSnapshot;
      setSnapshot(parsed);
      setForm(buildFormState(parsed.policy));
      setAdvancedOpen(
        Object.fromEntries(
          runtimes.map((runtime) => [
            runtime.id,
            Boolean(
              parsed.policy.runtimes[runtime.id].dailyTokenCap ||
                parsed.policy.runtimes[runtime.id].monthlyTokenCap
            ),
          ])
        )
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load budget settings"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSnapshot();
  }, []);

  async function handleSave() {
    if (!form) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.formErrors?.[0] ?? "Failed to save budget settings");
      }

      const parsed = data as BudgetSnapshot;
      setSnapshot(parsed);
      setForm(buildFormState(parsed.policy));
      toast.success("Budget guardrails updated");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save budget settings";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !snapshot || !form) {
    return (
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Cost &amp; Usage Guardrails</CardTitle>
          <CardDescription>Loading budget policy and current usage windows.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const blockedStatuses = snapshot.statuses.filter((status) => status.health === "blocked");
  const warningStatuses = snapshot.statuses.filter((status) => status.health === "warning");
  const groupedStatuses = snapshot.statuses.reduce<Record<string, BudgetStatus[]>>(
    (acc, status) => {
      const key = status.scopeId;
      acc[key] ??= [];
      acc[key].push(status);
      return acc;
    },
    {}
  );

  return (
    <Card className="surface-card">
      <CardHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Cost &amp; Usage Guardrails
            </CardTitle>
            <CardDescription>
              Set optional daily and monthly spend caps for all runtime activity.
              Runtime sections keep spend as the primary control, show derived
              token guidance from recent blended pricing, and tuck hard token
              ceilings into an advanced section.
            </CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="surface-card-muted flex items-start gap-3 rounded-xl px-4 py-3">
              <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Blocked now
                </p>
                <p className="mt-1 text-lg font-semibold">{blockedStatuses.length}</p>
              </div>
            </div>
            <div className="surface-card-muted flex items-start gap-3 rounded-xl px-4 py-3">
              <div className="rounded-lg bg-status-warning/10 p-2 text-status-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Near cap
                </p>
                <p className="mt-1 text-lg font-semibold">{warningStatuses.length}</p>
              </div>
            </div>
            <div className="surface-card-muted flex items-start gap-3 rounded-xl px-4 py-3">
              <div className="rounded-lg bg-info/10 p-2 text-info">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reset windows
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Day: {formatResetAt(snapshot.dailyResetAtIso)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Month: {formatResetAt(snapshot.monthlyResetAtIso)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="surface-panel rounded-xl p-4">
          <div className="flex items-start gap-3">
            {blockedStatuses.length > 0 ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 text-status-warning" />
            )}
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Warning notifications are emitted once per window when usage
                reaches 80% of a configured cap.
              </p>
              <p>
                Blocked attempts are recorded in the usage ledger with zero cost
                so later audit views can explain why work did not start.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <SectionEyebrow icon={Landmark} label="Global Guardrails" />
              <h3 className="text-sm font-semibold">Overall spend caps</h3>
              <p className="text-xs text-muted-foreground">
                Leave an input blank to keep that window unlimited.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Daily spend cap (USD)</span>
                <Input
                  className="surface-control"
                  inputMode="decimal"
                  placeholder="Unlimited"
                  value={form.overallDailySpendCapUsd}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            overallDailySpendCapUsd: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Monthly spend cap (USD)</span>
                <Input
                  className="surface-control"
                  inputMode="decimal"
                  placeholder="Unlimited"
                  value={form.overallMonthlySpendCapUsd}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            overallMonthlySpendCapUsd: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </label>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            {runtimes.map((runtime) => (
              <div key={runtime.id} className="surface-card-muted rounded-xl p-4">
                <div className="mb-3">
                  <SectionEyebrow icon={Wallet} label="Runtime Budget" />
                  <h3 className="mt-1 text-sm font-semibold">{runtime.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {runtime.description}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Daily spend cap (USD)</span>
                    <Input
                      className="surface-control"
                      inputMode="decimal"
                      placeholder="Unlimited"
                      value={form.runtimes[runtime.id].dailySpendCapUsd}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                runtimes: {
                                  ...current.runtimes,
                                  [runtime.id]: {
                                    ...current.runtimes[runtime.id],
                                    dailySpendCapUsd: event.target.value,
                                  },
                                },
                              }
                            : current
                        )
                      }
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Monthly spend cap (USD)</span>
                    <Input
                      className="surface-control"
                      inputMode="decimal"
                      placeholder="Unlimited"
                      value={form.runtimes[runtime.id].monthlySpendCapUsd}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                runtimes: {
                                  ...current.runtimes,
                                  [runtime.id]: {
                                    ...current.runtimes[runtime.id],
                                    monthlySpendCapUsd: event.target.value,
                                  },
                                },
                              }
                            : current
                        )
                      }
                    />
                  </label>
                </div>
                {(() => {
                  const dailySpendStatus = getStatus(
                    snapshot.statuses,
                    runtime.id,
                    "daily",
                    "spend"
                  );
                  const dailyTokenStatus = getStatus(
                    snapshot.statuses,
                    runtime.id,
                    "daily",
                    "tokens"
                  );
                  const monthlySpendStatus = getStatus(
                    snapshot.statuses,
                    runtime.id,
                    "monthly",
                    "spend"
                  );
                  const monthlyTokenStatus = getStatus(
                    snapshot.statuses,
                    runtime.id,
                    "monthly",
                    "tokens"
                  );
                  const dailyEstimate = deriveTokenEstimate({
                    spendCapUsd: form.runtimes[runtime.id].dailySpendCapUsd,
                    primarySpendStatus: dailySpendStatus,
                    primaryTokenStatus: dailyTokenStatus,
                    fallbackSpendStatus: monthlySpendStatus,
                    fallbackTokenStatus: monthlyTokenStatus,
                  });
                  const monthlyEstimate = deriveTokenEstimate({
                    spendCapUsd: form.runtimes[runtime.id].monthlySpendCapUsd,
                    primarySpendStatus: monthlySpendStatus,
                    primaryTokenStatus: monthlyTokenStatus,
                    fallbackSpendStatus: dailySpendStatus,
                    fallbackTokenStatus: dailyTokenStatus,
                  });
                  const hasAdvancedTokenCaps =
                    Boolean(form.runtimes[runtime.id].dailyTokenCap) ||
                    Boolean(form.runtimes[runtime.id].monthlyTokenCap);

                  return (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="surface-panel rounded-lg px-3 py-3">
                          <SectionEyebrow icon={Coins} label="Derived Guidance" />
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Estimated Daily Token Budget
                          </p>
                          {dailyEstimate.sourceLabel ? (
                            <>
                              <p className="mt-1 text-sm font-semibold">
                                ~{formatEstimatedTokens(dailyEstimate.estimatedBudgetTokens)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                ~{formatEstimatedTokens(dailyEstimate.estimatedRemainingTokens)} remaining headroom based on {dailyEstimate.sourceLabel}.
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Set a spend cap and accumulate priced usage to see a token estimate.
                            </p>
                          )}
                        </div>
                        <div className="surface-panel rounded-lg px-3 py-3">
                          <SectionEyebrow icon={Coins} label="Derived Guidance" />
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Estimated Monthly Token Budget
                          </p>
                          {monthlyEstimate.sourceLabel ? (
                            <>
                              <p className="mt-1 text-sm font-semibold">
                                ~{formatEstimatedTokens(monthlyEstimate.estimatedBudgetTokens)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                ~{formatEstimatedTokens(monthlyEstimate.estimatedRemainingTokens)} remaining headroom based on {monthlyEstimate.sourceLabel}.
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Set a spend cap and accumulate priced usage to see a token estimate.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-border/60 bg-background/40">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 cursor-pointer px-3 py-2 text-left text-sm font-medium"
                          onClick={() =>
                            setAdvancedOpen((current) => ({
                              ...current,
                              [runtime.id]: !(current[runtime.id] ?? hasAdvancedTokenCaps),
                            }))
                          }
                        >
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            {advancedOpen[runtime.id] ?? hasAdvancedTokenCaps
                              ? "Hide advanced token guardrails"
                              : "Show advanced token guardrails"}
                          </span>
                          {advancedOpen[runtime.id] ?? hasAdvancedTokenCaps ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        {(advancedOpen[runtime.id] ?? hasAdvancedTokenCaps) && (
                          <div className="border-t border-border/60 px-3 py-3">
                          <SectionEyebrow icon={ShieldCheck} label="Advanced Override" />
                          <p className="mb-3 text-xs text-muted-foreground">
                            Use hard token caps only when you need a strict technical ceiling. Spend caps remain the primary operator control.
                          </p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-sm font-medium">Daily token cap</span>
                              <Input
                                className="surface-control"
                                inputMode="numeric"
                                placeholder="Unlimited"
                                value={form.runtimes[runtime.id].dailyTokenCap}
                                onChange={(event) =>
                                  setForm((current) =>
                                    current
                                      ? {
                                          ...current,
                                          runtimes: {
                                            ...current.runtimes,
                                            [runtime.id]: {
                                              ...current.runtimes[runtime.id],
                                              dailyTokenCap: event.target.value,
                                            },
                                          },
                                        }
                                      : current
                                  )
                                }
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium">Monthly token cap</span>
                              <Input
                                className="surface-control"
                                inputMode="numeric"
                                placeholder="Unlimited"
                                value={form.runtimes[runtime.id].monthlyTokenCap}
                                onChange={(event) =>
                                  setForm((current) =>
                                    current
                                      ? {
                                          ...current,
                                          runtimes: {
                                            ...current.runtimes,
                                            [runtime.id]: {
                                              ...current.runtimes[runtime.id],
                                              monthlyTokenCap: event.target.value,
                                            },
                                          },
                                        }
                                      : current
                                  )
                                }
                              />
                            </label>
                          </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Blank fields are treated as unlimited. Changes reset warning dedupe for the current windows.
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save guardrails"}
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div>
            <SectionEyebrow icon={ArrowRight} label="Live Status" />
            <h3 className="text-sm font-semibold">Current window status</h3>
            <p className="text-xs text-muted-foreground">
              Live usage is derived from the normalized usage ledger in the
              machine&apos;s local timezone.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {Object.entries(groupedStatuses).map(([scopeId, statuses]) => (
              <div key={scopeId} className="surface-card-muted rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">{statuses[0]?.scopeLabel}</h4>
                  {statuses.some((status) => status.health === "blocked")
                    ? <Badge variant="destructive">Blocked</Badge>
                    : statuses.some((status) => status.health === "warning")
                      ? (
                        <Badge
                          variant="outline"
                          className="border-status-warning/30 bg-status-warning/10 text-status-warning"
                        >
                          Warning
                        </Badge>
                      )
                      : <Badge variant="success">Healthy</Badge>}
                </div>
                <div className="space-y-2">
                  {statuses.map((status) => (
                    <div key={status.id} className="surface-panel rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {status.window} {status.metric}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatStatusValue(status)} / {formatStatusLimit(status)}
                          </p>
                        </div>
                        {healthBadge(status)}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Resets {formatResetAt(status.resetAtIso)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
