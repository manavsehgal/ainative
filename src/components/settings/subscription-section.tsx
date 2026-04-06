"use client";

import { useEffect, useState, useCallback } from "react";
import { Crown, BarChart3, Brain, Calendar, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TIER_LABELS, TIER_PRICING, TIERS, type LicenseTier } from "@/lib/license/tier-limits";
import { ActivationForm } from "./activation-form";

interface LicenseStatus {
  tier: LicenseTier;
  status: string;
  email: string | null;
  isPremium: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  limits: Record<string, number>;
  features: Record<string, boolean>;
}

interface UsageData {
  agentMemories: { current: number; limit: number };
  contextVersions: { current: number; limit: number };
  activeSchedules: { current: number; limit: number };
  parallelWorkflows: { current: number; limit: number };
}

const TIER_BADGE_VARIANT: Record<LicenseTier, "secondary" | "default" | "destructive" | "outline"> = {
  community: "secondary",
  solo: "default",
  operator: "default",
  scale: "outline",
};

function UsageCard({
  icon: Icon,
  label,
  current,
  limit,
}: {
  icon: typeof Brain;
  label: string;
  current: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const ratio = isUnlimited ? 0 : (current / limit) * 100;
  const isWarning = !isUnlimited && ratio >= 80;
  const isBlocked = !isUnlimited && ratio >= 100;

  return (
    <div className="surface-card-muted rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {current} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={Math.min(ratio, 100)}
          className={`h-1.5 ${isBlocked ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-amber-500" : ""}`}
        />
      )}
    </div>
  );
}

export function SubscriptionSection() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [licRes, usageRes] = await Promise.all([
        fetch("/api/license"),
        fetch("/api/license/usage"),
      ]);
      if (licRes.ok) setLicense(await licRes.json());
      if (usageRes.ok) setUsage(await usageRes.json());
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Check for post-purchase success
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Subscription activated! Premium features are now available.");
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.toString());
      // Refresh status after a short delay to pick up the new tier
      setTimeout(fetchStatus, 2000);
    }
  }, [fetchStatus]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tier = license?.tier ?? "community";
  const isPremium = license?.isPremium ?? false;

  async function handleUpgrade(targetTier: string) {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/license/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: targetTier, billingPeriod: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? "Failed to start checkout");
      }
    } catch {
      toast.error("Failed to connect to billing service");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your plan and usage limits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={TIER_BADGE_VARIANT[tier]}>
              {TIER_LABELS[tier]}
            </Badge>
            {!isPremium && (
              <span className="text-sm text-muted-foreground">Free forever</span>
            )}
            {license?.expiresAt && (
              <span className="text-sm text-muted-foreground">
                Renews {new Date(license.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {isPremium && (
            <Button variant="outline" size="sm" asChild>
              <a href="/api/license/portal" target="_blank" rel="noopener">
                Manage Billing <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>

        {/* Usage Summary */}
        {usage && (
          <div className="grid grid-cols-2 gap-3">
            <UsageCard icon={Brain} label="Agent Memories" current={usage.agentMemories.current} limit={usage.agentMemories.limit} />
            <UsageCard icon={BarChart3} label="Context Versions" current={usage.contextVersions.current} limit={usage.contextVersions.limit} />
            <UsageCard icon={Calendar} label="Active Schedules" current={usage.activeSchedules.current} limit={usage.activeSchedules.limit} />
            <UsageCard icon={Zap} label="Parallel Workflows" current={usage.parallelWorkflows.current} limit={usage.parallelWorkflows.limit} />
          </div>
        )}

        {/* Tier Comparison */}
        {!isPremium && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Upgrade</h4>
            <div className="grid grid-cols-3 gap-3">
              {TIERS.filter((t) => t !== "community").map((t) => (
                <div
                  key={t}
                  className={`surface-card-muted rounded-lg p-3 space-y-2 ${t === "operator" ? "ring-1 ring-primary/30" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{TIER_LABELS[t]}</span>
                    {t === "operator" && (
                      <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold">
                    ${TIER_PRICING[t].monthly}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <Button
                    size="sm"
                    variant={t === "operator" ? "default" : "outline"}
                    className="w-full"
                    disabled={checkoutLoading}
                    onClick={() => handleUpgrade(t)}
                  >
                    {checkoutLoading ? "Loading..." : "Upgrade"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* License Key Activation (fallback for manual entry) */}
        {!isPremium && (
          <ActivationForm onActivated={fetchStatus} />
        )}

        {/* License Info */}
        {license?.email && (
          <p className="text-xs text-muted-foreground">
            Licensed to {license.email}
            {license.status === "grace" && (
              <span className="text-amber-500 ml-2">
                (Offline grace period — reconnect to validate)
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
