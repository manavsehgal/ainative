"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_LABELS, type LicenseTier } from "@/lib/license/tier-limits";
import type { LimitResource } from "@/lib/license/tier-limits";
import { trackConversionEvent } from "@/lib/telemetry/conversion-events";

const BANNER_TITLES: Record<LimitResource, string> = {
  agentMemories: "Memory limit approaching",
  contextVersions: "Context version limit reached",
  activeSchedules: "Schedule limit reached",
  historyRetentionDays: "History retention limit",
  parallelWorkflows: "Parallel workflow limit reached",
  maxCloudInstances: "Cloud instance limit reached",
};

function getBannerMessage(
  resource: LimitResource,
  current: number,
  max: number,
  requiredTier: string
): string {
  const tierLabel = TIER_LABELS[requiredTier as LicenseTier] ?? requiredTier;
  switch (resource) {
    case "agentMemories":
      return `${current} of ${max} agent memories used. Upgrade to ${tierLabel} for more capacity.`;
    case "contextVersions":
      return `${current} of ${max} context versions used. Upgrade to ${tierLabel} to unlock more.`;
    case "activeSchedules":
      return `${current} of ${max} active schedules. Upgrade to ${tierLabel} for more schedules.`;
    case "historyRetentionDays":
      return `Execution history limited to ${max} days. Upgrade to ${tierLabel} for longer retention.`;
    case "parallelWorkflows":
      return `${current} of ${max} parallel workflows running. Upgrade to ${tierLabel} for more concurrency.`;
    case "maxCloudInstances":
      return `${current} of ${max} cloud instances in use. Upgrade to ${tierLabel} for additional instance seats.`;
  }
}

interface UpgradeBannerProps {
  resource: LimitResource;
  current: number;
  max: number;
  requiredTier: string;
  variant: "warning" | "blocked";
  onDismiss?: () => void;
  onSnooze?: () => void;
  className?: string;
}

export function UpgradeBanner({
  resource,
  current,
  max,
  requiredTier,
  variant,
  onDismiss,
  onSnooze,
  className,
}: UpgradeBannerProps) {
  const Icon = variant === "blocked" ? Lock : AlertTriangle;
  const tierLabel = TIER_LABELS[requiredTier as LicenseTier] ?? requiredTier;

  // Track banner impression on mount
  useEffect(() => {
    trackConversionEvent("banner_impression", resource);
  }, [resource]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "surface-card-muted rounded-lg border p-4 flex items-start gap-3",
        variant === "warning" && "border-amber-500/25",
        variant === "blocked" && "border-destructive/25",
        className
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 mt-0.5",
          variant === "warning" ? "text-amber-500" : "text-destructive"
        )}
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{BANNER_TITLES[resource]}</p>
        <p className="text-xs text-muted-foreground">
          {getBannerMessage(resource, current, max, requiredTier)}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" asChild onClick={() => trackConversionEvent("banner_click", resource)}>
            <Link href={`/settings?highlight=${requiredTier}`}>
              Upgrade to {tierLabel}
            </Link>
          </Button>
          {onSnooze && (
            <Button size="sm" variant="ghost" onClick={onSnooze}>
              Remind later
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
