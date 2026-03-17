"use client";

import { useState } from "react";
import { CalendarClock, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PricingRegistrySnapshot, PricingRow } from "@/lib/usage/pricing-registry";
import { toast } from "sonner";

interface PricingRegistryPanelProps {
  initialSnapshot: PricingRegistrySnapshot;
  showClaudePlans?: boolean;
}

function formatCurrencyUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatMicrosPerMillion(value: number) {
  return `${formatCurrencyUsd(value / 1_000_000)} / 1M`;
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Not refreshed yet";
  }

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function providerRows(
  rows: PricingRow[],
  showClaudePlans: boolean | undefined
) {
  return rows.filter((row) =>
    row.visible &&
    (showClaudePlans ? true : row.kind === "api_model")
  );
}

export function PricingRegistryPanel({
  initialSnapshot,
  showClaudePlans = false,
}: PricingRegistryPanelProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/settings/pricing", { method: "POST" });
      const data = (await response.json()) as PricingRegistrySnapshot;
      setSnapshot(data);
      toast.success("Pricing refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh pricing");
    } finally {
      setRefreshing(false);
    }
  }

  const providerCards = [
    snapshot.providers.anthropic,
    snapshot.providers.openai,
  ];

  return (
    <div className="surface-card-muted rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>Latest Pricing</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Official provider pricing with manual refresh and the last known update time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshot.stale ? (
            <Badge
              variant="outline"
              className="border-status-warning/30 bg-status-warning/10 text-status-warning"
            >
              Stale
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh pricing
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {providerCards.map((provider) => (
          <div key={provider.providerId} className="surface-panel rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold capitalize">{provider.providerId}</p>
                <p className="text-xs text-muted-foreground">
                  Updated {formatUpdatedAt(provider.fetchedAtIso)}
                </p>
              </div>
              <Badge variant="outline">{provider.sourceLabel}</Badge>
            </div>

            <div className="mt-3 space-y-2">
              {providerRows(provider.rows, showClaudePlans && provider.providerId === "anthropic").map(
                (row) => (
                  <div
                    key={row.key}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.kind === "subscription_plan" ? "Monthly plan" : "Input / output"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {row.kind === "subscription_plan" ? (
                        <p className="font-medium">
                          {formatCurrencyUsd(row.monthlyPriceUsd ?? 0)}
                        </p>
                      ) : (
                        <>
                          <p className="font-medium">
                            {formatMicrosPerMillion(row.inputCostPerMillionMicros ?? 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatMicrosPerMillion(row.outputCostPerMillionMicros ?? 0)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {provider.refreshError ? (
              <p className="mt-3 text-xs text-status-warning">{provider.refreshError}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
